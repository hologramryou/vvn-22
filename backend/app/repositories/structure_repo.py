"""Repository for Dynamic Tournament Structure — nodes, katas, participant assignments."""
from __future__ import annotations

from collections import deque
from typing import Optional, Literal

from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.models.club import Club
from app.models.student import Student, StudentClub
from app.models.tournament import (
    Tournament,
    TournamentStructureTemplate,
    TournamentStructureNode,
    TournamentKata,
    TournamentTeamKataRegistration,
    TournamentTeamKataMember,
    StudentWeightAssignment,
    StudentContestSelection,
    BracketMatch,
    TournamentWeightClass,
)
from app.schemas.tournament_structure import (
    NodeResponse,
    NodeTreeResponse,
    KataResponse,
    ContestTypeItem,
    StudentRegistrationResponse,
)

NodeType = Literal["group", "weight_class"]
NODE_TYPE_KEY = "_node_type"


def _extract_node_type(rule_json: Optional[dict]) -> Optional[NodeType]:
    if isinstance(rule_json, dict) and rule_json.get(NODE_TYPE_KEY) in ("group", "weight_class"):
        return rule_json[NODE_TYPE_KEY]
    return None


def _merge_node_type(rule_json: Optional[dict], node_type: NodeType) -> dict:
    merged = dict(rule_json) if isinstance(rule_json, dict) else {}
    merged[NODE_TYPE_KEY] = node_type
    return merged


def _resolve_node_type(
    node: TournamentStructureNode,
    flat_nodes: Optional[list[TournamentStructureNode]] = None,
) -> NodeType:
    explicit = _extract_node_type(node.rule_json)
    if explicit:
        return explicit
    if flat_nodes is not None and any(child.parent_id == node.id for child in flat_nodes):
        return "group"
    return "weight_class"


async def _persist_node_type(db: AsyncSession, node: TournamentStructureNode, node_type: NodeType) -> None:
    node.rule_json = _merge_node_type(node.rule_json, node_type)
    await db.flush()


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_tournament(db: AsyncSession, tournament_id: int) -> Optional[Tournament]:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    return result.scalar_one_or_none()


async def _get_all_nodes_flat(db: AsyncSession, tournament_id: int) -> list[TournamentStructureNode]:
    result = await db.execute(
        select(TournamentStructureNode)
        .where(TournamentStructureNode.tournament_id == tournament_id)
        .order_by(TournamentStructureNode.level, TournamentStructureNode.sort_order)
    )
    return list(result.scalars().all())


async def _get_descendants(db: AsyncSession, node_id: int) -> list[int]:
    """Return list of all descendant node IDs (BFS)."""
    result = await db.execute(
        select(TournamentStructureNode.id, TournamentStructureNode.parent_id)
        .where(TournamentStructureNode.parent_id.isnot(None))
    )
    rows = result.all()
    children_map: dict[int, list[int]] = {}
    for nid, pid in rows:
        children_map.setdefault(pid, []).append(nid)

    descendants: list[int] = []
    queue = deque(children_map.get(node_id, []))
    while queue:
        current = queue.popleft()
        descendants.append(current)
        queue.extend(children_map.get(current, []))
    return descendants


async def _build_node_path(db: AsyncSession, node_id: int) -> str:
    """Build breadcrumb path like 'Nam > Phong trào > Loại 1A > 45kg'."""
    result = await db.execute(
        select(TournamentStructureNode)
        .where(TournamentStructureNode.id == node_id)
    )
    node = result.scalar_one_or_none()
    if not node:
        return ""

    parts: list[str] = [node.name]
    current = node
    while current.parent_id is not None:
        r = await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.id == current.parent_id)
        )
        parent = r.scalar_one_or_none()
        if not parent:
            break
        parts.insert(0, parent.name)
        current = parent
    return " > ".join(parts)


# NOTE: Tên node (name) là display label KHÔNG phải machine key.
# Domain meaning được lưu trong node_code và rule_json — không parse name.


async def _get_student_count(db: AsyncSession, node_id: int, all_nodes_flat: list[TournamentStructureNode]) -> int:
    """Count students assigned to node_id and all its descendants (new system only)."""
    children_map: dict[int, list[int]] = {}
    for n in all_nodes_flat:
        if n.parent_id is not None:
            children_map.setdefault(n.parent_id, []).append(n.id)

    subtree_ids: list[int] = [node_id]
    queue = deque(children_map.get(node_id, []))
    while queue:
        current = queue.popleft()
        subtree_ids.append(current)
        queue.extend(children_map.get(current, []))

    result = await db.execute(
        select(func.count(StudentWeightAssignment.id))
        .join(Student, Student.id == StudentWeightAssignment.student_id)
        .where(
            StudentWeightAssignment.node_id.in_(subtree_ids),
            Student.status == "active",
        )
    )
    return result.scalar() or 0


async def _check_tournament_locked(db: AsyncSession, tournament_id: int) -> tuple[bool, bool]:
    """Return (is_published, has_bracket)."""
    t = await _get_tournament(db, tournament_id)
    if not t:
        return False, False
    is_published = t.status in ("PUBLISHED", "ONGOING", "COMPLETED")

    # Check if any bracket matches exist for this tournament via weight classes
    result = await db.execute(
        select(func.count(BracketMatch.id))
        .join(TournamentWeightClass, BracketMatch.weight_class_id == TournamentWeightClass.id)
        .where(TournamentWeightClass.tournament_id == tournament_id)
    )
    bracket_count = result.scalar() or 0
    return is_published, bracket_count > 0


def _build_tree(flat_nodes: list[TournamentStructureNode], counts: dict[int, int]) -> list[NodeTreeResponse]:
    """Build nested tree from flat list."""
    node_map: dict[int, NodeTreeResponse] = {}
    for n in flat_nodes:
        node_map[n.id] = NodeTreeResponse(
            id=n.id,
            tournament_id=n.tournament_id,
            parent_id=n.parent_id,
            level=n.level,
            node_type=_resolve_node_type(n, flat_nodes),
            name=n.name,
            node_code=n.node_code,
            rule_json=n.rule_json,
            sort_order=n.sort_order,
            student_count=counts.get(n.id, 0),
            created_at=n.created_at,
            updated_at=n.updated_at,
            children=[],
        )

    roots: list[NodeTreeResponse] = []
    for n in flat_nodes:
        nr = node_map[n.id]
        if n.parent_id is None:
            roots.append(nr)
        elif n.parent_id in node_map:
            node_map[n.parent_id].children.append(nr)

    # Sort children by sort_order
    def _sort_children(nodes: list[NodeTreeResponse]) -> None:
        nodes.sort(key=lambda x: x.sort_order)
        for nd in nodes:
            _sort_children(nd.children)

    _sort_children(roots)
    return roots


async def _compute_student_counts(db: AsyncSession, tournament_id: int, flat_nodes: list[TournamentStructureNode]) -> dict[int, int]:
    """Compute student_count for all nodes using StudentWeightAssignment (dynamic system only).

    Chỉ đọc từ StudentWeightAssignment — không parse tên node để bridge với legacy.
    Legacy tournaments (structure_mode='legacy') không có nodes trong dynamic system nên sẽ trả 0.
    """
    if not flat_nodes:
        return {}

    # Fetch assignment counts per node_id scoped to this tournament
    node_ids = [n.id for n in flat_nodes]
    swa_result = await db.execute(
        select(StudentWeightAssignment.node_id, func.count(StudentWeightAssignment.id))
        .join(Student, Student.id == StudentWeightAssignment.student_id)
        .where(
            StudentWeightAssignment.node_id.in_(node_ids),
            StudentWeightAssignment.tournament_id == tournament_id,
            Student.status == "active",
        )
        .group_by(StudentWeightAssignment.node_id)
    )
    counts: dict[int, int] = {n.id: 0 for n in flat_nodes}
    for node_id, cnt in swa_result.all():
        counts[node_id] = cnt

    # Propagate leaf counts up to parent nodes (deepest level first)
    max_level = max((n.level for n in flat_nodes), default=0)
    for level in range(max_level, 0, -1):
        for node in flat_nodes:
            if node.level == level and node.parent_id is not None:
                counts[node.parent_id] = counts.get(node.parent_id, 0) + counts.get(node.id, 0)

    return counts


async def _get_kata_usage_count(db: AsyncSession, kata_id: int) -> int:
    kata_result = await db.execute(
        select(TournamentKata).where(TournamentKata.id == kata_id)
    )
    kata = kata_result.scalar_one_or_none()
    if not kata:
        return 0

    if getattr(kata, "division", "individual") == "team":
        result = await db.execute(
            select(func.count(TournamentTeamKataRegistration.id))
            .where(TournamentTeamKataRegistration.kata_id == kata_id)
        )
        return result.scalar() or 0

    result = await db.execute(
        select(func.count(StudentContestSelection.id))
        .where(StudentContestSelection.kata_id == kata_id)
    )
    return result.scalar() or 0


def _get_level0_node_code(node_id: int, id_to_node: dict) -> Optional[str]:
    """Walk up the tree to find level-0 ancestor's node_code (M/F gender code).
    Returns None if no level-0 ancestor or node_code not set.
    """
    current_id = node_id
    while current_id is not None:
        n = id_to_node.get(current_id)
        if not n:
            return None
        if n.level == 0:
            return n.node_code
        current_id = n.parent_id
    return None


def _template_summary(template: TournamentStructureTemplate) -> dict:
    payload = template.template_json or {}
    nodes = payload.get("nodes") or []
    katas = payload.get("katas") or []
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "structure_mode": template.structure_mode,
        "source_tournament_id": template.source_tournament_id,
        "node_count": len(nodes),
        "kata_count": len(katas),
        "created_at": template.created_at,
        "updated_at": template.updated_at,
    }


async def _ensure_template_table() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(TournamentStructureTemplate.__table__.create, checkfirst=True)


async def _get_template_snapshot(db: AsyncSession, tournament_id: int, copy_katas: bool = True) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    katas: list[dict] = []
    if copy_katas:
        kata_result = await db.execute(
            select(TournamentKata)
            .where(TournamentKata.tournament_id == tournament_id)
            .order_by(TournamentKata.division, TournamentKata.sort_order, TournamentKata.id)
        )
        katas = [
            {
                "division": getattr(k, "division", "individual"),
                "name": k.name,
                "description": k.description,
                "sort_order": k.sort_order,
            }
            for k in kata_result.scalars().all()
        ]

    return {
        "structure_mode": getattr(t, "structure_mode", "dynamic"),
        "nodes": [
            {
                "id": n.id,
                "parent_id": n.parent_id,
                "level": n.level,
                "node_type": n.node_type,
                "name": n.name,
                "node_code": n.node_code,
                "rule_json": n.rule_json,
                "sort_order": n.sort_order,
            }
            for n in flat_nodes
        ],
        "katas": katas,
    }, None


async def list_structure_templates(db: AsyncSession) -> list[dict]:
    await _ensure_template_table()
    result = await db.execute(
        select(TournamentStructureTemplate).order_by(TournamentStructureTemplate.id.desc())
    )
    return [_template_summary(t) for t in result.scalars().all()]


async def create_structure_template(
    db: AsyncSession,
    tournament_id: int,
    name: str,
    description: Optional[str],
    copy_katas: bool,
) -> tuple[Optional[dict], Optional[str]]:
    await _ensure_template_table()
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    existing = await db.execute(
        select(TournamentStructureTemplate).where(TournamentStructureTemplate.name == name)
    )
    if existing.scalar_one_or_none():
        return None, "DUPLICATE_TEMPLATE_NAME"

    snapshot, error = await _get_template_snapshot(db, tournament_id, copy_katas=copy_katas)
    if error:
        return None, error

    template = TournamentStructureTemplate(
        name=name,
        description=description,
        source_tournament_id=tournament_id,
        structure_mode="dynamic",
        template_json=snapshot,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return _template_summary(template), None


async def apply_structure_template(
    db: AsyncSession,
    tournament_id: int,
    template_id: int,
) -> tuple[Optional[dict], Optional[str]]:
    await _ensure_template_table()
    target = await _get_tournament(db, tournament_id)
    if not target:
        return None, "TOURNAMENT_NOT_FOUND"
    if target.status != "DRAFT":
        return None, "TARGET_NOT_DRAFT"

    template_result = await db.execute(
        select(TournamentStructureTemplate).where(TournamentStructureTemplate.id == template_id)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        return None, "TEMPLATE_NOT_FOUND"

    if target.structure_mode not in ("dynamic", "legacy"):
        target.structure_mode = template.structure_mode
    else:
        target.structure_mode = template.structure_mode

    existing_nodes = await db.execute(
        select(func.count(TournamentStructureNode.id)).where(TournamentStructureNode.tournament_id == tournament_id)
    )
    if (existing_nodes.scalar() or 0) > 0:
        return None, "TARGET_NOT_EMPTY"

    existing_katas = await db.execute(
        select(func.count(TournamentKata.id)).where(TournamentKata.tournament_id == tournament_id)
    )
    if (existing_katas.scalar() or 0) > 0:
        return None, "TARGET_NOT_EMPTY"

    payload = template.template_json or {}
    nodes = list(payload.get("nodes") or [])
    nodes.sort(key=lambda n: (n.get("level", 0), n.get("sort_order", 0), n.get("id", 0)))
    old_to_new: dict[int, int] = {}

    for src_node in nodes:
        src_id = int(src_node.get("id"))
        new_parent_id = old_to_new.get(src_node.get("parent_id"))
        new_node = TournamentStructureNode(
            tournament_id=tournament_id,
            parent_id=new_parent_id,
            level=int(src_node.get("level", 0)),
            node_type=src_node.get("node_type") or "group",
            name=src_node.get("name") or "",
            node_code=src_node.get("node_code"),
            rule_json=src_node.get("rule_json"),
            sort_order=int(src_node.get("sort_order", 1)),
        )
        db.add(new_node)
        await db.flush()
        await db.refresh(new_node)
        old_to_new[src_id] = new_node.id

    katas = list(payload.get("katas") or [])
    for kata_data in katas:
        kata = TournamentKata(
            tournament_id=tournament_id,
            division=str(kata_data.get("division") or "individual"),
            name=kata_data.get("name") or "",
            description=kata_data.get("description"),
            sort_order=int(kata_data.get("sort_order", 1)),
        )
        db.add(kata)

    await db.flush()
    return {
        "template_id": template.id,
        "copied_nodes": len(nodes),
        "copied_katas": len(katas),
    }, None


async def delete_structure_template(db: AsyncSession, template_id: int) -> tuple[Optional[dict], Optional[str]]:
    await _ensure_template_table()
    result = await db.execute(
        select(TournamentStructureTemplate).where(TournamentStructureTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        return None, "TEMPLATE_NOT_FOUND"

    await db.execute(delete(TournamentStructureTemplate).where(TournamentStructureTemplate.id == template_id))
    return {"deleted_template_id": template_id}, None


async def _is_leaf_node(db: AsyncSession, node_id: int) -> bool:
    """Returns True if node has no children (eligible as registration target)."""
    result = await db.execute(
        select(func.count(TournamentStructureNode.id)).where(
            TournamentStructureNode.parent_id == node_id
        )
    )
    return (result.scalar() or 0) == 0


async def _build_kata_response(db: AsyncSession, kata: TournamentKata) -> KataResponse:
    usage = await _get_kata_usage_count(db, kata.id)
    return KataResponse(
        id=kata.id,
        tournament_id=kata.tournament_id,
        division=getattr(kata, "division", "individual"),
        name=kata.name,
        description=kata.description,
        sort_order=kata.sort_order,
        usage_count=usage,
        team_size=getattr(kata, "team_size", 2) or 2,
        min_team_size=getattr(kata, "min_team_size", None),
    )


async def _build_node_response(db: AsyncSession, node: TournamentStructureNode, flat_nodes: list[TournamentStructureNode]) -> NodeResponse:
    count = await _get_student_count(db, node.id, flat_nodes)
    return NodeResponse(
        id=node.id,
        tournament_id=node.tournament_id,
        parent_id=node.parent_id,
        level=node.level,
        node_type=_resolve_node_type(node, flat_nodes),
        name=node.name,
        node_code=node.node_code,
        rule_json=node.rule_json,
        sort_order=node.sort_order,
        student_count=count,
        created_at=node.created_at,
        updated_at=node.updated_at,
    )


async def _get_registration_response(
    db: AsyncSession,
    assignment: StudentWeightAssignment,
) -> StudentRegistrationResponse:
    # Build node path only if node_id is set (sparring registration)
    # For kata-only registrations, node_id can be None
    node_path = await _build_node_path(db, assignment.node_id) if assignment.node_id else ""

    # Get contest selections
    result = await db.execute(
        select(StudentContestSelection, TournamentKata)
        .outerjoin(TournamentKata, StudentContestSelection.kata_id == TournamentKata.id)
        .where(
            StudentContestSelection.student_id == assignment.student_id,
            StudentContestSelection.tournament_id == assignment.tournament_id,
        )
    )
    rows = result.all()
    contest_types = [
        ContestTypeItem(
            type=row[0].contest_type,
            kata_id=row[0].kata_id,
            kata_name=row[1].name if row[1] else None,
        )
        for row in rows
    ]
    has_sparring = any(ct.type == "sparring" for ct in contest_types)

    classification_node_id: Optional[int] = None
    sparring_weight_id: Optional[int] = None
    if assignment.node_id:
        assigned_node_result = await db.execute(
            select(TournamentStructureNode).where(TournamentStructureNode.id == assignment.node_id)
        )
        assigned_node = assigned_node_result.scalar_one_or_none()
        if assigned_node:
            child_result = await db.execute(
                select(TournamentStructureNode.id)
                .where(TournamentStructureNode.parent_id == assigned_node.id)
                .limit(1)
            )
            is_leaf = child_result.scalar_one_or_none() is None
            if is_leaf:
                classification_node_id = assigned_node.parent_id
                if has_sparring:
                    sparring_weight_id = assigned_node.id
            else:
                classification_node_id = assigned_node.id

    return StudentRegistrationResponse(
        student_id=assignment.student_id,
        tournament_id=assignment.tournament_id,
        node_id=assignment.node_id,
        classification_node_id=classification_node_id,
        sparring_weight_id=sparring_weight_id,
        node_path=node_path,
        registered_at=assignment.registered_at,
        contest_types=contest_types,
    )


# ── Node CRUD ─────────────────────────────────────────────────────────────────

async def get_nodes(
    db: AsyncSession,
    tournament_id: int,
    format: str = "tree",
) -> tuple[Optional[dict], Optional[str]]:
    """
    Returns (response_data, error_code).
    response_data keys: tournament_id, tournament_name, tournament_status, nodes, stats
    """
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    counts = await _compute_student_counts(db, tournament_id, flat_nodes)

    weight_class_nodes = [n for n in flat_nodes if _resolve_node_type(n, flat_nodes) == "weight_class"]
    total_students = sum(counts.get(n.id, 0) for n in weight_class_nodes)

    stats = {
        "total_nodes": len(flat_nodes),
        "total_weight_classes": len(weight_class_nodes),
        "total_students": total_students,
    }

    if format == "flat":
        nodes_out = [
            NodeResponse(
                id=n.id,
                tournament_id=n.tournament_id,
                parent_id=n.parent_id,
                level=n.level,
                node_type=_resolve_node_type(n, flat_nodes),
                name=n.name,
                node_code=n.node_code,
                rule_json=n.rule_json,
                sort_order=n.sort_order,
                student_count=counts.get(n.id, 0),
                created_at=n.created_at,
                updated_at=n.updated_at,
            )
            for n in flat_nodes
        ]
    else:
        nodes_out = _build_tree(flat_nodes, counts)

    return {
        "tournament_id": t.id,
        "tournament_name": t.name,
        "tournament_status": t.status,
        "nodes": nodes_out,
        "stats": stats,
    }, None


async def create_node(
    db: AsyncSession,
    tournament_id: int,
    parent_id: Optional[int],
    name: str,
    node_type: Optional[NodeType] = None,
    node_code: Optional[str] = None,
    rule_json: Optional[dict] = None,
) -> tuple[Optional[NodeResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    # Any tournament with dynamic nodes should be treated as dynamic from here on.
    if getattr(t, "structure_mode", "legacy") != "dynamic":
        t.structure_mode = "dynamic"

    is_published, has_bracket = await _check_tournament_locked(db, tournament_id)

    # Determine level
    if parent_id is None:
        level = 0
    else:
        r = await db.execute(
            select(TournamentStructureNode)
            .where(TournamentStructureNode.id == parent_id, TournamentStructureNode.tournament_id == tournament_id)
        )
        parent_node = r.scalar_one_or_none()
        if not parent_node:
            return None, "NODE_NOT_FOUND"
        level = parent_node.level + 1
        await _persist_node_type(db, parent_node, "group")

        # If parent already has weight_class siblings, force new node to weight_class too
        if node_type is None:
            sibling_check = await db.execute(
                select(func.count(TournamentStructureNode.id)).where(
                    TournamentStructureNode.tournament_id == tournament_id,
                    TournamentStructureNode.parent_id == parent_id,
                )
            )
            # Check if any existing sibling has weight_class in rule_json
            siblings_q = await db.execute(
                select(TournamentStructureNode).where(
                    TournamentStructureNode.tournament_id == tournament_id,
                    TournamentStructureNode.parent_id == parent_id,
                )
            )
            siblings = siblings_q.scalars().all()
            if any(_extract_node_type(s.rule_json) == "weight_class" for s in siblings):
                node_type = "weight_class"

    effective_node_type: NodeType = node_type if node_type is not None else ("group" if level < 3 else "weight_class")

    # No hard level limit — tree can be arbitrarily deep

    if is_published and has_bracket:
        return None, "STRUCTURE_LOCKED"

    # Block adding children to a node that already has student registrations
    if parent_id is not None:
        students_in_parent = await db.execute(
            select(func.count(StudentWeightAssignment.id)).where(
                StudentWeightAssignment.node_id == parent_id
            )
        )
        if (students_in_parent.scalar() or 0) > 0:
            return None, "PARENT_HAS_STUDENTS"

    # Check duplicate name in same parent
    dup_check = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.tournament_id == tournament_id,
            TournamentStructureNode.parent_id == parent_id,
            TournamentStructureNode.name == name,
        )
    )
    if dup_check.scalar_one_or_none():
        return None, "DUPLICATE_NAME"

    # Compute sort_order = max siblings + 1
    siblings_result = await db.execute(
        select(func.max(TournamentStructureNode.sort_order)).where(
            TournamentStructureNode.tournament_id == tournament_id,
            TournamentStructureNode.parent_id == parent_id,
        )
    )
    max_order = siblings_result.scalar() or 0
    sort_order = max_order + 1

    node = TournamentStructureNode(
        tournament_id=tournament_id,
        parent_id=parent_id,
        level=level,
        node_type=effective_node_type,
        name=name,
        node_code=node_code,
        rule_json=_merge_node_type(rule_json, effective_node_type),
        sort_order=sort_order,
    )
    db.add(node)
    await db.flush()
    await db.refresh(node)

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    return await _build_node_response(db, node, flat_nodes), None


async def update_node(
    db: AsyncSession,
    tournament_id: int,
    node_id: int,
    name: str,
) -> tuple[Optional[NodeResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    r = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = r.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"

    # Check duplicate name in same parent (excluding self)
    dup_check = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.tournament_id == tournament_id,
            TournamentStructureNode.parent_id == node.parent_id,
            TournamentStructureNode.name == name,
            TournamentStructureNode.id != node_id,
        )
    )
    if dup_check.scalar_one_or_none():
        return None, "DUPLICATE_NAME"

    node.name = name
    await db.flush()
    await db.refresh(node)

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    return await _build_node_response(db, node, flat_nodes), None


async def delete_node(
    db: AsyncSession,
    tournament_id: int,
    node_id: int,
    move_to_node_id: Optional[int],
) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    r = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = r.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"

    parent_node = None
    if node.parent_id is not None:
        parent_result = await db.execute(
            select(TournamentStructureNode).where(
                TournamentStructureNode.id == node.parent_id,
                TournamentStructureNode.tournament_id == tournament_id,
            )
        )
        parent_node = parent_result.scalar_one_or_none()
        if parent_node:
            await _persist_node_type(db, parent_node, "group")

    is_published, has_bracket = await _check_tournament_locked(db, tournament_id)
    if is_published and has_bracket:
        return None, "STRUCTURE_LOCKED"

    # Get all descendant IDs
    descendant_ids = await _get_descendants(db, node_id)
    all_affected_ids = [node_id] + descendant_ids

    # Check if any students are assigned to this node or descendants
    student_count_result = await db.execute(
        select(func.count(StudentWeightAssignment.id)).where(
            StudentWeightAssignment.node_id.in_(all_affected_ids)
        )
    )
    student_count = student_count_result.scalar() or 0

    moved_students = 0
    if student_count > 0:
        if move_to_node_id is None:
            return None, "MOVE_TARGET_REQUIRED"

        # Validate move target: must exist, same tournament, same level as deleted node, not a descendant
        target_result = await db.execute(
            select(TournamentStructureNode).where(
                TournamentStructureNode.id == move_to_node_id,
                TournamentStructureNode.tournament_id == tournament_id,
            )
        )
        target = target_result.scalar_one_or_none()
        if not target or target.level != node.level or move_to_node_id in all_affected_ids:
            return None, "INVALID_MOVE_TARGET"

        # Move students: update node_id + set reason='moved'
        await db.execute(
            update(StudentWeightAssignment)
            .where(StudentWeightAssignment.node_id.in_(all_affected_ids))
            .values(node_id=move_to_node_id, reason="moved")
        )
        moved_students = student_count

    # Delete contest selections for students in descendants (will be handled by cascade on student deletion? No — we need explicit)
    # Actually students are NOT deleted, just reassigned. Contest selections stay intact.
    # Delete nodes — cascades to child nodes via FK? No, we have no explicit cascade on parent_id FK.
    # We must delete in reverse order (leaves first).
    # Sort all_affected_ids to delete children before parents.
    # Use a simple approach: delete all descendants first (deepest level), then node itself.

    # Delete in order: descendants (sorted by level desc), then the node
    if descendant_ids:
        # Get descendant nodes with their levels
        desc_result = await db.execute(
            select(TournamentStructureNode.id, TournamentStructureNode.level)
            .where(TournamentStructureNode.id.in_(descendant_ids))
            .order_by(TournamentStructureNode.level.desc())
        )
        desc_sorted = desc_result.all()
        for desc_id, _ in desc_sorted:
            await db.execute(
                delete(TournamentStructureNode).where(TournamentStructureNode.id == desc_id)
            )

    await db.execute(
        delete(TournamentStructureNode).where(TournamentStructureNode.id == node_id)
    )

    return {
        "deleted_node_id": node_id,
        "deleted_count": len(all_affected_ids),
        "moved_students": moved_students,
    }, None


async def reorder_nodes(
    db: AsyncSession,
    tournament_id: int,
    parent_id: Optional[int],
    nodes: list[dict],  # [{node_id, sort_order}]
) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    # Get all siblings
    siblings_result = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.tournament_id == tournament_id,
            TournamentStructureNode.parent_id == parent_id,
        )
    )
    siblings = list(siblings_result.scalars().all())
    sibling_ids = {s.id for s in siblings}

    request_ids = {n["node_id"] for n in nodes}
    if request_ids != sibling_ids:
        if not request_ids.issubset(sibling_ids):
            return None, "INVALID_SIBLINGS"
        if len(request_ids) != len(sibling_ids):
            return None, "INCOMPLETE_LIST"

    for item in nodes:
        await db.execute(
            update(TournamentStructureNode)
            .where(TournamentStructureNode.id == item["node_id"])
            .values(sort_order=item["sort_order"])
        )

    await db.flush()

    # Fetch updated nodes
    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    counts = await _compute_student_counts(db, tournament_id, flat_nodes)

    updated = [
        NodeResponse(
            id=n.id,
            tournament_id=n.tournament_id,
            parent_id=n.parent_id,
            level=n.level,
            node_type=_resolve_node_type(n, flat_nodes),
            name=n.name,
            node_code=n.node_code,
            rule_json=n.rule_json,
            sort_order=n.sort_order,
            student_count=counts.get(n.id, 0),
            created_at=n.created_at,
            updated_at=n.updated_at,
        )
        for n in flat_nodes
        if n.parent_id == parent_id and n.tournament_id == tournament_id
    ]

    return {"updated_count": len(updated), "nodes": updated}, None


async def copy_structure(
    db: AsyncSession,
    target_tournament_id: int,
    source_tournament_id: int,
    copy_katas: bool,
) -> tuple[Optional[dict], Optional[str]]:
    if source_tournament_id == target_tournament_id:
        return None, "SAME_TOURNAMENT"

    target = await _get_tournament(db, target_tournament_id)
    if not target:
        return None, "TOURNAMENT_NOT_FOUND"

    source = await _get_tournament(db, source_tournament_id)
    if not source:
        return None, "SOURCE_TOURNAMENT_NOT_FOUND"

    if target.status != "DRAFT":
        return None, "TARGET_NOT_DRAFT"

    target.structure_mode = "dynamic"

    # Check target is empty
    existing_result = await db.execute(
        select(func.count(TournamentStructureNode.id))
        .where(TournamentStructureNode.tournament_id == target_tournament_id)
    )
    if (existing_result.scalar() or 0) > 0:
        return None, "TARGET_NOT_EMPTY"

    # BFS copy source nodes, maintaining parent mapping
    source_nodes = await _get_all_nodes_flat(db, source_tournament_id)
    # Sort by level to ensure parents are created before children
    source_nodes.sort(key=lambda n: n.level)

    old_to_new: dict[int, int] = {}  # source_node_id -> new_node_id

    for src_node in source_nodes:
        new_parent_id = old_to_new.get(src_node.parent_id) if src_node.parent_id is not None else None
        new_node = TournamentStructureNode(
            tournament_id=target_tournament_id,
            parent_id=new_parent_id,
            level=src_node.level,
            name=src_node.name,
            node_code=src_node.node_code,
            rule_json=src_node.rule_json,
            sort_order=src_node.sort_order,
        )
        db.add(new_node)
        await db.flush()
        await db.refresh(new_node)
        old_to_new[src_node.id] = new_node.id

    copied_katas_count = 0
    if copy_katas:
        src_katas_result = await db.execute(
            select(TournamentKata)
            .where(TournamentKata.tournament_id == source_tournament_id)
            .order_by(TournamentKata.division, TournamentKata.sort_order, TournamentKata.id)
        )
        src_katas = list(src_katas_result.scalars().all())
        for sk in src_katas:
            new_kata = TournamentKata(
                tournament_id=target_tournament_id,
                division=getattr(sk, "division", "individual"),
                name=sk.name,
                description=sk.description,
                sort_order=sk.sort_order,
            )
            db.add(new_kata)
        copied_katas_count = len(src_katas)

    await db.flush()

    # Build response tree
    flat_target = await _get_all_nodes_flat(db, target_tournament_id)
    counts = await _compute_student_counts(db, target_tournament_id, flat_target)
    tree = _build_tree(flat_target, counts)

    return {
        "copied_nodes": len(source_nodes),
        "copied_katas": copied_katas_count,
        "tree": tree,
    }, None


# ── Node students ─────────────────────────────────────────────────────────────

async def get_node_students(
    db: AsyncSession,
    tournament_id: int,
    node_id: int,
    include_descendants: bool = True,
) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    node_result = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = node_result.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"

    node_path = await _build_node_path(db, node_id)

    if include_descendants:
        descendant_ids = await _get_descendants(db, node_id)
        target_ids = [node_id] + descendant_ids
    else:
        target_ids = [node_id]

    assignments_result = await db.execute(
        select(StudentWeightAssignment, Student, TournamentStructureNode)
        .join(Student, StudentWeightAssignment.student_id == Student.id)
        .join(TournamentStructureNode, StudentWeightAssignment.node_id == TournamentStructureNode.id)
        .where(
            StudentWeightAssignment.node_id.in_(target_ids),
            StudentWeightAssignment.tournament_id == tournament_id,
            Student.status == "active",
        )
    )
    rows = assignments_result.all()

    students_out = []
    for assignment, student, assigned_node in rows:
        # Get contest types for this student
        ct_result = await db.execute(
            select(StudentContestSelection, TournamentKata)
            .outerjoin(TournamentKata, StudentContestSelection.kata_id == TournamentKata.id)
            .where(
                StudentContestSelection.student_id == student.id,
                StudentContestSelection.tournament_id == tournament_id,
            )
        )
        ct_rows = ct_result.all()
        contest_types = [
            ContestTypeItem(
                type=ct.contest_type,
                kata_id=ct.kata_id,
                kata_name=kata.name if kata else None,
            )
            for ct, kata in ct_rows
        ]
        students_out.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "assigned_node_id": assigned_node.id,
            "assigned_node_name": assigned_node.name,
            "contest_types": contest_types,
        })

    return {
        "node_id": node_id,
        "node_path": node_path,
        "students": students_out,
        "total": len(students_out),
    }, None


# ── Participant registration ──────────────────────────────────────────────────

async def register_participant(
    db: AsyncSession,
    tournament_id: int,
    student_id: int,
    node_id: int,
    sparring: bool,
    sparring_weight_id: Optional[int],
    kata: bool,
    kata_ids: list[int],
) -> tuple[Optional[StudentRegistrationResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    # Check student exists
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        return None, "STUDENT_NOT_FOUND"

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)

    # Validate classification node (parent of weight_class)
    node_result = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = node_result.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"

    # Node must not be a leaf, and must have weight_class leaf children
    # Use flat_nodes to check leaf status without DB queries (avoids await-in-generator)
    def _is_leaf_in_flat(nid: int) -> bool:
        return not any(n.parent_id == nid for n in flat_nodes)

    if _is_leaf_in_flat(node.id):
        return None, "INVALID_NODE_LEVEL"

    has_weight_children = any(
        c.parent_id == node.id
        and _is_leaf_in_flat(c.id)
        and _resolve_node_type(c, flat_nodes) == "weight_class"
        for c in flat_nodes
    )
    if not has_weight_children:
        return None, "INVALID_NODE_LEVEL"

    # Gender validation
    id_to_node = {n.id: n for n in flat_nodes}
    gender_code = _get_level0_node_code(node.id, id_to_node)
    if gender_code and gender_code != student.gender:
        return None, "GENDER_MISMATCH"

    # If sparring is selected, validate sparring_weight_id
    if sparring:
        if sparring_weight_id is None:
            return None, "MISSING_SPARRING_WEIGHT"

        # Check weight exists and is a child of the selected node
        weight_result = await db.execute(
            select(TournamentStructureNode).where(
                TournamentStructureNode.id == sparring_weight_id,
                TournamentStructureNode.parent_id == node_id,
                TournamentStructureNode.tournament_id == tournament_id,
            )
        )
        weight_node = weight_result.scalar_one_or_none()
        if not weight_node:
            return None, "SPARRING_WEIGHT_NOT_FOUND"

    # Check not already registered
    existing = await db.execute(
        select(StudentWeightAssignment).where(
            StudentWeightAssignment.student_id == student_id,
            StudentWeightAssignment.tournament_id == tournament_id,
        )
    )
    if existing.scalar_one_or_none():
        return None, "ALREADY_REGISTERED"

    # Validate kata_ids if kata is selected
    if kata and kata_ids:
        error = await _validate_kata_ids(db, tournament_id, kata_ids)
        if error:
            return None, error

    assignment_node_id = sparring_weight_id if sparring and sparring_weight_id is not None else node_id

    # Create weight assignment
    assignment = StudentWeightAssignment(
        student_id=student_id,
        tournament_id=tournament_id,
        node_id=assignment_node_id,
        reason="registered",
    )
    db.add(assignment)

    # Create contest selections
    if sparring:
        selection = StudentContestSelection(
            student_id=student_id,
            tournament_id=tournament_id,
            contest_type="sparring",
            kata_id=None,
        )
        db.add(selection)

    if kata:
        for kata_id in kata_ids:
            selection = StudentContestSelection(
                student_id=student_id,
                tournament_id=tournament_id,
                contest_type="kata",
                kata_id=kata_id,
            )
            db.add(selection)

    await db.flush()
    await db.refresh(assignment)

    return await _get_registration_response(db, assignment), None


async def reassign_node(
    db: AsyncSession,
    tournament_id: int,
    student_id: int,
    new_node_id: int,
) -> tuple[Optional[StudentRegistrationResponse], Optional[str]]:
    # Get existing assignment
    assignment_result = await db.execute(
        select(StudentWeightAssignment).where(
            StudentWeightAssignment.student_id == student_id,
            StudentWeightAssignment.tournament_id == tournament_id,
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        return None, "PARTICIPANT_NOT_FOUND"

    # Check new node exists and is a leaf (no children)
    node_result = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == new_node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = node_result.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"
    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    if not await _is_leaf_node(db, node.id) or _resolve_node_type(node, flat_nodes) != "weight_class":
        return None, "INVALID_NODE_LEVEL"

    if assignment.node_id == new_node_id:
        return None, "SAME_NODE"

    # Gender validation for new node
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    if student:
        id_to_node = {n.id: n for n in flat_nodes}
        gender_code = _get_level0_node_code(new_node_id, id_to_node)
        if gender_code and gender_code != student.gender:
            return None, "GENDER_MISMATCH"

    assignment.node_id = new_node_id
    assignment.reason = "moved"
    await db.flush()
    await db.refresh(assignment)

    return await _get_registration_response(db, assignment), None


async def update_contest_types(
    db: AsyncSession,
    tournament_id: int,
    student_id: int,
    contest_types: list[dict],
) -> tuple[Optional[StudentRegistrationResponse], Optional[str]]:
    assignment_result = await db.execute(
        select(StudentWeightAssignment).where(
            StudentWeightAssignment.student_id == student_id,
            StudentWeightAssignment.tournament_id == tournament_id,
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        return None, "PARTICIPANT_NOT_FOUND"

    # Validate contest types
    error = await _validate_contest_types(db, tournament_id, contest_types)
    if error:
        return None, error

    # Delete old, insert new (replace all)
    await db.execute(
        delete(StudentContestSelection).where(
            StudentContestSelection.student_id == student_id,
            StudentContestSelection.tournament_id == tournament_id,
        )
    )

    for ct in contest_types:
        selection = StudentContestSelection(
            student_id=student_id,
            tournament_id=tournament_id,
            contest_type=ct["type"],
            kata_id=ct.get("kata_id"),
        )
        db.add(selection)

    await db.flush()

    return await _get_registration_response(db, assignment), None


async def get_registration(
    db: AsyncSession,
    tournament_id: int,
    student_id: int,
) -> tuple[Optional[StudentRegistrationResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    assignment_result = await db.execute(
        select(StudentWeightAssignment).where(
            StudentWeightAssignment.student_id == student_id,
            StudentWeightAssignment.tournament_id == tournament_id,
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        return None, "PARTICIPANT_NOT_FOUND"

    return await _get_registration_response(db, assignment), None


# ── Kata CRUD ─────────────────────────────────────────────────────────────────

async def get_katas(
    db: AsyncSession,
    tournament_id: int,
) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    result = await db.execute(
        select(TournamentKata)
        .where(TournamentKata.tournament_id == tournament_id)
        .order_by(TournamentKata.division, TournamentKata.sort_order, TournamentKata.id)
    )
    katas = list(result.scalars().all())
    katas_out = [await _build_kata_response(db, k) for k in katas]

    return {
        "tournament_id": tournament_id,
        "katas": katas_out,
        "total": len(katas_out),
    }, None


async def create_kata(
    db: AsyncSession,
    tournament_id: int,
    division: str,
    name: str,
    description: Optional[str],
    team_size: int = 2,
    min_team_size: Optional[int] = None,
) -> tuple[Optional[KataResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    # Check duplicate
    dup = await db.execute(
        select(TournamentKata).where(
            TournamentKata.tournament_id == tournament_id,
            TournamentKata.division == division,
            TournamentKata.name == name,
        )
    )
    if dup.scalar_one_or_none():
        return None, "DUPLICATE_KATA_NAME"

    # Compute sort_order
    max_order_result = await db.execute(
        select(func.max(TournamentKata.sort_order))
        .where(
            TournamentKata.tournament_id == tournament_id,
            TournamentKata.division == division,
        )
    )
    max_order = max_order_result.scalar() or 0

    actual_team_size = team_size if division == "team" else 2
    kata = TournamentKata(
        tournament_id=tournament_id,
        division=division,
        name=name,
        description=description,
        sort_order=max_order + 1,
        team_size=actual_team_size,
        min_team_size=min_team_size if division == "team" else None,
    )
    db.add(kata)
    await db.flush()
    await db.refresh(kata)

    return await _build_kata_response(db, kata), None


async def update_kata(
    db: AsyncSession,
    tournament_id: int,
    kata_id: int,
    division: Optional[str],
    name: Optional[str],
    description: Optional[str],
    team_size: Optional[int] = None,
    min_team_size: Optional[int] = None,
) -> tuple[Optional[KataResponse], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    result = await db.execute(
        select(TournamentKata).where(
            TournamentKata.id == kata_id,
            TournamentKata.tournament_id == tournament_id,
        )
    )
    kata = result.scalar_one_or_none()
    if not kata:
        return None, "KATA_NOT_FOUND"

    next_name = name if name is not None else kata.name
    next_division = division or getattr(kata, "division", "individual")

    if name is not None or division is not None:
        dup = await db.execute(
            select(TournamentKata).where(
                TournamentKata.tournament_id == tournament_id,
                TournamentKata.division == next_division,
                TournamentKata.name == next_name,
                TournamentKata.id != kata_id,
            )
        )
        if dup.scalar_one_or_none():
            return None, "DUPLICATE_KATA_NAME"

    if name is not None:
        kata.name = name

    if division is not None:
        kata.division = division

    if description is not None:
        kata.description = description

    effective_division = division if division is not None else getattr(kata, "division", "individual")
    if team_size is not None and effective_division == "team":
        kata.team_size = team_size
    if min_team_size is not None and effective_division == "team":
        kata.min_team_size = min_team_size
    elif min_team_size is None and effective_division == "team" and 'min_team_size' in (kata.__dict__ or {}):
        kata.min_team_size = None

    await db.flush()
    await db.refresh(kata)

    return await _build_kata_response(db, kata), None


async def delete_kata(
    db: AsyncSession,
    tournament_id: int,
    kata_id: int,
) -> tuple[Optional[dict], Optional[str], Optional[int]]:
    """Returns (response, error_code, affected_students_count)."""
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND", None

    result = await db.execute(
        select(TournamentKata).where(
            TournamentKata.id == kata_id,
            TournamentKata.tournament_id == tournament_id,
        )
    )
    kata = result.scalar_one_or_none()
    if not kata:
        return None, "KATA_NOT_FOUND", None

    # Check usage
    usage_count = await _get_kata_usage_count(db, kata_id)
    if usage_count > 0:
        return None, "KATA_IN_USE", usage_count

    kata_name = kata.name
    await db.execute(delete(TournamentKata).where(TournamentKata.id == kata_id))

    return {"deleted_kata_id": kata_id, "kata_name": kata_name}, None, 0


async def reorder_katas(
    db: AsyncSession,
    tournament_id: int,
    katas: list[dict],  # [{kata_id, sort_order}]
) -> tuple[Optional[dict], Optional[str]]:
    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    # Validate all kata_ids belong to this tournament
    all_katas_result = await db.execute(
        select(TournamentKata).where(TournamentKata.tournament_id == tournament_id)
    )
    all_katas = list(all_katas_result.scalars().all())
    all_kata_ids = {k.id for k in all_katas}
    request_kata_ids = {item["kata_id"] for item in katas}

    if not request_kata_ids.issubset(all_kata_ids):
        return None, "INCOMPLETE_LIST"

    for item in katas:
        await db.execute(
            update(TournamentKata)
            .where(TournamentKata.id == item["kata_id"])
            .values(sort_order=item["sort_order"])
        )

    await db.flush()

    updated_result = await db.execute(
        select(TournamentKata)
        .where(TournamentKata.tournament_id == tournament_id)
        .order_by(TournamentKata.division, TournamentKata.sort_order)
    )
    updated_katas = list(updated_result.scalars().all())
    katas_out = [await _build_kata_response(db, k) for k in updated_katas]

    return {"updated_count": len(katas), "katas": katas_out}, None


async def _get_club_for_tournament(
    db: AsyncSession,
    tournament_id: int,
    club_id: int,
) -> tuple[Optional[Club], Optional[str]]:
    club_result = await db.execute(select(Club).where(Club.id == club_id))
    club = club_result.scalar_one_or_none()
    if not club:
        return None, "CLUB_NOT_FOUND"

    if tournament_id not in (getattr(club, "tournament_ids", None) or []):
        return None, "CLUB_NOT_IN_TOURNAMENT"
    return club, None


def _build_node_path_order_maps(
    flat_nodes: list[TournamentStructureNode],
) -> tuple[dict[int, str], dict[int, tuple[int, ...]]]:
    id_to_node = {node.id: node for node in flat_nodes}
    path_cache: dict[int, str] = {}
    order_cache: dict[int, tuple[int, ...]] = {}

    def build(node_id: int) -> tuple[str, tuple[int, ...]]:
        if node_id in path_cache:
            return path_cache[node_id], order_cache[node_id]

        node = id_to_node.get(node_id)
        if not node:
            return "", ()

        if node.parent_id is None:
            path = node.name
            order_key = (node.sort_order,)
        else:
            parent_path, parent_order = build(node.parent_id)
            path = f"{parent_path} > {node.name}" if parent_path else node.name
            order_key = (*parent_order, node.sort_order)

        path_cache[node_id] = path
        order_cache[node_id] = order_key
        return path, order_key

    for node in flat_nodes:
        build(node.id)

    return path_cache, order_cache


async def _normalize_team_kata_registration_items(
    db: AsyncSession,
    tournament_id: int,
    items: list[dict],
) -> tuple[Optional[list[dict]], Optional[str]]:
    normalized_items: list[dict] = []
    seen_keys: set[tuple[int, int]] = set()

    for item in items:
        node_id = int(item["node_id"])
        kata_id = int(item["kata_id"])
        key = (node_id, kata_id)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        normalized_items.append({"node_id": node_id, "kata_id": kata_id})

    kata_ids = [item["kata_id"] for item in normalized_items]
    validation_error = await _validate_kata_ids(
        db,
        tournament_id,
        kata_ids,
        division="team",
    )
    if validation_error:
        return None, validation_error

    node_ids = {item["node_id"] for item in normalized_items}
    if node_ids:
        flat_nodes = await _get_all_nodes_flat(db, tournament_id)
        node_map = {node.id: node for node in flat_nodes}
        if any(node_id not in node_map for node_id in node_ids):
            return None, "INVALID_NODE_ID"
        if any(node_map[node_id].node_type != "group" for node_id in node_ids):
            return None, "INVALID_NODE_ID"
        non_terminal_group_ids = {
            node.parent_id
            for node in flat_nodes
            if node.parent_id is not None and node.node_type == "group"
        }
        if any(node_id in non_terminal_group_ids for node_id in node_ids):
            return None, "INVALID_NODE_ID"

    return normalized_items, None


async def get_team_kata_registrations(
    db: AsyncSession,
    tournament_id: int,
    club_id: int,
) -> tuple[Optional[dict], Optional[str]]:
    tournament = await _get_tournament(db, tournament_id)
    if not tournament:
        return None, "TOURNAMENT_NOT_FOUND"

    _, club_error = await _get_club_for_tournament(db, tournament_id, club_id)
    if club_error:
        return None, club_error

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    path_map, order_map = _build_node_path_order_maps(flat_nodes)

    result = await db.execute(
        select(TournamentTeamKataRegistration, TournamentKata)
        .join(TournamentKata, TournamentKata.id == TournamentTeamKataRegistration.kata_id)
        .where(
            TournamentTeamKataRegistration.tournament_id == tournament_id,
            TournamentTeamKataRegistration.club_id == club_id,
        )
    )
    rows = result.all()
    registrations = [
        {
            "node_id": registration.node_id,
            "node_path": path_map.get(registration.node_id, ""),
            "kata_id": registration.kata_id,
            "kata_name": kata.name,
            "_node_order": order_map.get(registration.node_id, ()),
            "_kata_order": kata.sort_order,
        }
        for registration, kata in rows
    ]
    registrations.sort(
        key=lambda item: (
            item["_node_order"],
            item["_kata_order"],
            item["kata_name"],
            item["kata_id"],
        )
    )
    return {
        "tournament_id": tournament_id,
        "club_id": club_id,
        "registrations": [
            {
                "node_id": item["node_id"],
                "node_path": item["node_path"],
                "kata_id": item["kata_id"],
                "kata_name": item["kata_name"],
            }
            for item in registrations
        ],
    }, None


async def replace_team_kata_registrations(
    db: AsyncSession,
    tournament_id: int,
    club_id: int,
    items: list[dict],
) -> tuple[Optional[dict], Optional[str]]:
    tournament = await _get_tournament(db, tournament_id)
    if not tournament:
        return None, "TOURNAMENT_NOT_FOUND"

    _, club_error = await _get_club_for_tournament(db, tournament_id, club_id)
    if club_error:
        return None, club_error

    normalized_items, validation_error = await _normalize_team_kata_registration_items(
        db,
        tournament_id,
        items,
    )
    if validation_error:
        return None, validation_error

    await db.execute(
        delete(TournamentTeamKataMember).where(
            TournamentTeamKataMember.tournament_id == tournament_id,
            TournamentTeamKataMember.club_id == club_id,
        )
    )
    await db.execute(
        delete(TournamentTeamKataRegistration).where(
            TournamentTeamKataRegistration.tournament_id == tournament_id,
            TournamentTeamKataRegistration.club_id == club_id,
        )
    )

    for item in normalized_items or []:
        db.add(
            TournamentTeamKataRegistration(
                tournament_id=tournament_id,
                club_id=club_id,
                node_id=item["node_id"],
                kata_id=item["kata_id"],
            )
        )

    await db.flush()
    return await get_team_kata_registrations(db, tournament_id, club_id)


# ── Eligible nodes (rule-based node recommendation) ──────────────────────────

async def get_eligible_nodes(
    db: AsyncSession,
    tournament_id: int,
    student_id: int,
) -> tuple[Optional[dict], Optional[str]]:
    """
    Gợi ý leaf nodes hợp lệ cho VĐV dựa trên gender, tuổi, đai, cân nặng.
    Sử dụng node_code và rule_json — không parse tên node.
    """
    from datetime import date
    from app.models.student import Student

    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"

    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        return None, "STUDENT_NOT_FOUND"

    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    if not flat_nodes:
        return None, "NO_NODES"

    # Tính tuổi VĐV
    today = date.today()
    age: Optional[int] = None
    if student.date_of_birth:
        age = today.year - student.date_of_birth.year - (
            (today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day)
        )

    weight = student.competition_weight_kg or student.weight_class

    # Build parent index
    id_to_node = {n.id: n for n in flat_nodes}
    children_map: dict[int, list[int]] = {}
    for n in flat_nodes:
        if n.parent_id is not None:
            children_map.setdefault(n.parent_id, []).append(n.id)
    leaf_ids = {n.id for n in flat_nodes if n.id not in children_map}

    def node_path_sync(node_id: int) -> str:
        parts = []
        current_id = node_id
        while current_id is not None:
            n = id_to_node.get(current_id)
            if not n:
                break
            parts.insert(0, n.name)
            current_id = n.parent_id
        return " > ".join(parts)

    def get_ancestor_at_level(node_id: int, target_level: int) -> Optional[TournamentStructureNode]:
        current_id = node_id
        while current_id is not None:
            n = id_to_node.get(current_id)
            if not n:
                return None
            if n.level == target_level:
                return n
            current_id = n.parent_id
        return None

    def _passes_rules(node: TournamentStructureNode) -> tuple[bool, str]:
        """Check if student passes node rule_json. Returns (passes, reason)."""
        rules = node.rule_json or {}

        # Gender filter: level-0 ancestor node_code (M/F)
        gender_node = get_ancestor_at_level(node.id, 0)
        if gender_node and gender_node.node_code:
            if gender_node.node_code != student.gender:
                return False, "gender_mismatch"

        # Age filter from rule_json on level-2 (group) or level-3 (leaf)
        if age is not None:
            for lvl in (2, 3):
                ancestor = get_ancestor_at_level(node.id, lvl)
                if ancestor and ancestor.rule_json:
                    r = ancestor.rule_json
                    if "min_age" in r and age < r["min_age"]:
                        return False, "age_below_min"
                    if "max_age" in r and age > r["max_age"]:
                        return False, "age_above_max"

        # Belt filter from rule_json on level-2 (group)
        group_node = get_ancestor_at_level(node.id, 2)
        if group_node and group_node.rule_json:
            allowed_belts = group_node.rule_json.get("allowed_belts")
            if allowed_belts and student.current_belt not in allowed_belts:
                return False, "belt_not_allowed"

        # Weight filter: node rule_json max_weight_kg (leaf level)
        leaf_rules = node.rule_json or {}
        if "max_weight_kg" in leaf_rules and weight is not None:
            try:
                if float(weight) > float(leaf_rules["max_weight_kg"]):
                    return False, "weight_exceeds_max"
            except (TypeError, ValueError):
                pass

        return True, "eligible"

    candidates = []
    recommended_node_id = None
    min_weight_gap = None

    for node in flat_nodes:
        if node.id not in leaf_ids or _resolve_node_type(node, flat_nodes) != "weight_class":
            continue
        passes, reason = _passes_rules(node)
        path = node_path_sync(node.id)
        entry = {
            "node_id": node.id,
            "path": path,
            "node_code": node.node_code,
            "reason": "recommended" if passes else "override_allowed",
            "eligible": passes,
            "ineligible_reason": None if passes else reason,
        }
        candidates.append(entry)

        # Recommend the eligible leaf with smallest max_weight_kg gap
        if passes:
            leaf_rules = node.rule_json or {}
            max_wkg = leaf_rules.get("max_weight_kg")
            if max_wkg is not None and weight is not None:
                try:
                    gap = float(max_wkg) - float(weight)
                    if gap >= 0 and (min_weight_gap is None or gap < min_weight_gap):
                        min_weight_gap = gap
                        recommended_node_id = node.id
                except (TypeError, ValueError):
                    pass
            elif recommended_node_id is None:
                recommended_node_id = node.id

    # Sort: eligible first, then by node_id
    candidates.sort(key=lambda x: (0 if x["eligible"] else 1, x["node_id"]))

    recommended_path = None
    if recommended_node_id:
        recommended_path = node_path_sync(recommended_node_id)

    warnings = []
    if not any(c["eligible"] for c in candidates):
        warnings.append("NO_ELIGIBLE_WEIGHT_NODE")

    return {
        "tournament_id": tournament_id,
        "student_id": student_id,
        "recommended_node_id": recommended_node_id,
        "recommended_path": recommended_path,
        "candidate_nodes": candidates,
        "warnings": warnings,
    }, None


async def register_student_atomic(
    db: AsyncSession,
    tournament_id: int,
    student_data: dict,
    club_id: int,
    node_id: int,
    contest_types: list[dict],
    override_reason: Optional[str] = None,
) -> tuple[Optional[dict], Optional[str]]:
    """
    Tạo student mới + đăng ký vào dynamic tournament trong 1 transaction.
    Spec yêu cầu atomic để tránh trạng thái nửa vời (student tạo nhưng không đăng ký được).
    """
    from app.repositories.student_repo import create_student as _create_student, id_number_exists

    t = await _get_tournament(db, tournament_id)
    if not t:
        return None, "TOURNAMENT_NOT_FOUND"
    if getattr(t, 'structure_mode', 'legacy') != 'dynamic':
        return None, "NOT_DYNAMIC_TOURNAMENT"

    # Validate node
    node_result = await db.execute(
        select(TournamentStructureNode).where(
            TournamentStructureNode.id == node_id,
            TournamentStructureNode.tournament_id == tournament_id,
        )
    )
    node = node_result.scalar_one_or_none()
    if not node:
        return None, "NODE_NOT_FOUND"
    flat_nodes = await _get_all_nodes_flat(db, tournament_id)
    if not await _is_leaf_node(db, node.id) or _resolve_node_type(node, flat_nodes) != "weight_class":
        return None, "INVALID_NODE_LEVEL"

    # Validate id_number uniqueness before creating
    id_number = student_data.get("id_number")
    if id_number and await id_number_exists(db, id_number):
        return None, "DUPLICATE_ID_NUMBER"

    # Validate contest types
    error = await _validate_contest_types(db, tournament_id, contest_types)
    if error:
        return None, error

    # Gender validation: student gender must match level-0 ancestor node_code (M/F)
    id_to_node = {n.id: n for n in flat_nodes}
    gender_code = _get_level0_node_code(node_id, id_to_node)
    student_gender = student_data.get("gender")
    if gender_code and student_gender and gender_code != student_gender:
        return None, "GENDER_MISMATCH"

    # Create student
    student = await _create_student(db, student_data, club_id)

    # Register participant in dynamic tables
    assignment = StudentWeightAssignment(
        student_id=student.id,
        tournament_id=tournament_id,
        node_id=node_id,
        reason="registered",
    )
    db.add(assignment)

    for ct in contest_types:
        selection = StudentContestSelection(
            student_id=student.id,
            tournament_id=tournament_id,
            contest_type=ct["type"],
            kata_id=ct.get("kata_id"),
        )
        db.add(selection)

    await db.flush()
    await db.refresh(assignment)

    node_path = await _build_node_path(db, node_id)
    reg = await _get_registration_response(db, assignment)

    return {
        "student_id": student.id,
        "student_code": student.code,
        "registration": reg,
        "node_path": node_path,
    }, None


# ── Validation helpers ────────────────────────────────────────────────────────

async def _validate_kata_ids(
    db: AsyncSession,
    tournament_id: int,
    kata_ids: list[int],
    division: str = "individual",
) -> Optional[str]:
    """Validate kata_ids list. Returns error code or None if valid."""
    for kata_id in kata_ids:
        kata_result = await db.execute(
            select(TournamentKata).where(
                TournamentKata.id == kata_id,
                TournamentKata.tournament_id == tournament_id,
                TournamentKata.division == division,
            )
        )
        if not kata_result.scalar_one_or_none():
            return "INVALID_KATA_ID"

    return None


async def _validate_contest_types(
    db: AsyncSession,
    tournament_id: int,
    contest_types: list[dict],
) -> Optional[str]:
    """Validate contest_types list. Returns error code or None if valid."""
    sparring_count = 0
    for ct in contest_types:
        ct_type = ct.get("type")
        kata_id = ct.get("kata_id")

        if ct_type == "sparring":
            sparring_count += 1
            if sparring_count > 1:
                return "DUPLICATE_SPARRING"
            if kata_id is not None:
                return "INVALID_KATA_ID"
        elif ct_type == "kata":
            if kata_id is None:
                return "MISSING_KATA_ID"
            # Validate kata belongs to tournament
            kata_result = await db.execute(
                select(TournamentKata).where(
                    TournamentKata.id == kata_id,
                    TournamentKata.tournament_id == tournament_id,
                    TournamentKata.division == "individual",
                )
            )
            if not kata_result.scalar_one_or_none():
                return "INVALID_KATA_ID"

    return None


# ── Team kata members ─────────────────────────────────────────────────────────

async def get_team_kata_members(
    db: AsyncSession,
    tournament_id: int,
    club_id: int,
    node_id: int,
    kata_id: int,
) -> tuple[Optional[dict], Optional[str]]:
    tournament = await _get_tournament(db, tournament_id)
    if not tournament:
        return None, "TOURNAMENT_NOT_FOUND"

    _, club_error = await _get_club_for_tournament(db, tournament_id, club_id)
    if club_error:
        return None, club_error

    # Verify registration exists
    reg_result = await db.execute(
        select(TournamentTeamKataRegistration).where(
            TournamentTeamKataRegistration.tournament_id == tournament_id,
            TournamentTeamKataRegistration.club_id == club_id,
            TournamentTeamKataRegistration.node_id == node_id,
            TournamentTeamKataRegistration.kata_id == kata_id,
        )
    )
    if not reg_result.scalar_one_or_none():
        return None, "REGISTRATION_NOT_FOUND"

    # Get kata team_size
    kata_result = await db.execute(
        select(TournamentKata).where(TournamentKata.id == kata_id)
    )
    kata = kata_result.scalar_one_or_none()
    if not kata:
        return None, "KATA_NOT_FOUND"

    members_result = await db.execute(
        select(TournamentTeamKataMember, Student, Club)
        .join(Student, Student.id == TournamentTeamKataMember.student_id)
        .join(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))  # noqa: E712
        .join(Club, Club.id == StudentClub.club_id)
        .where(
            TournamentTeamKataMember.tournament_id == tournament_id,
            TournamentTeamKataMember.club_id == club_id,
            TournamentTeamKataMember.node_id == node_id,
            TournamentTeamKataMember.kata_id == kata_id,
        )
        .order_by(Student.full_name)
    )
    rows = members_result.all()
    members = [
        {"student_id": student.id, "student_name": student.full_name, "club_name": club.name}
        for _, student, club in rows
    ]

    return {
        "tournament_id": tournament_id,
        "club_id": club_id,
        "node_id": node_id,
        "kata_id": kata_id,
        "team_size": getattr(kata, "team_size", 2) or 2,
        "members": members,
    }, None


async def replace_team_kata_members(
    db: AsyncSession,
    tournament_id: int,
    club_id: int,
    node_id: int,
    kata_id: int,
    student_ids: list[int],
) -> tuple[Optional[dict], Optional[str]]:
    tournament = await _get_tournament(db, tournament_id)
    if not tournament:
        return None, "TOURNAMENT_NOT_FOUND"

    _, club_error = await _get_club_for_tournament(db, tournament_id, club_id)
    if club_error:
        return None, club_error

    # Verify registration exists
    reg_result = await db.execute(
        select(TournamentTeamKataRegistration).where(
            TournamentTeamKataRegistration.tournament_id == tournament_id,
            TournamentTeamKataRegistration.club_id == club_id,
            TournamentTeamKataRegistration.node_id == node_id,
            TournamentTeamKataRegistration.kata_id == kata_id,
        )
    )
    if not reg_result.scalar_one_or_none():
        return None, "REGISTRATION_NOT_FOUND"

    # Get kata team_size
    kata_result = await db.execute(
        select(TournamentKata).where(TournamentKata.id == kata_id)
    )
    kata = kata_result.scalar_one_or_none()
    if not kata:
        return None, "KATA_NOT_FOUND"

    team_size = getattr(kata, "team_size", 2) or 2
    min_team_size = getattr(kata, "min_team_size", None)
    unique_ids = list(dict.fromkeys(student_ids))  # deduplicate, preserve order

    if len(unique_ids) > team_size:
        return None, "EXCEEDS_TEAM_SIZE"
    if min_team_size is not None and len(unique_ids) < min_team_size:
        return None, "BELOW_MIN_TEAM_SIZE"

    # Validate all student_ids exist
    if unique_ids:
        students_result = await db.execute(
            select(Student.id).where(Student.id.in_(unique_ids))
        )
        found_ids = {row[0] for row in students_result.all()}
        if len(found_ids) != len(unique_ids):
            return None, "INVALID_STUDENT_ID"

    # Replace members
    await db.execute(
        delete(TournamentTeamKataMember).where(
            TournamentTeamKataMember.tournament_id == tournament_id,
            TournamentTeamKataMember.club_id == club_id,
            TournamentTeamKataMember.node_id == node_id,
            TournamentTeamKataMember.kata_id == kata_id,
        )
    )
    for student_id in unique_ids:
        db.add(TournamentTeamKataMember(
            tournament_id=tournament_id,
            club_id=club_id,
            node_id=node_id,
            kata_id=kata_id,
            student_id=student_id,
        ))

    await db.flush()
    return await get_team_kata_members(db, tournament_id, club_id, node_id, kata_id)
