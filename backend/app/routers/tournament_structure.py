"""Router for Dynamic Tournament Structure — 16 endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.repositories import structure_repo, tournament_repo, student_repo
from app.schemas.tournament_structure import (
    CreateNodeRequest,
    UpdateNodeRequest,
    DeleteNodeRequest,
    DeleteNodeResponse,
    ReorderNodesRequest,
    ReorderNodesResponse,
    CopyStructureRequest,
    CopyStructureResponse,
    NodeStudentsResponse,
    RegisterParticipantRequest,
    ReassignNodeRequest,
    UpdateContestTypesRequest,
    StudentRegistrationResponse,
    ListKatasResponse,
    CreateKataRequest,
    UpdateKataRequest,
    ReorderKatasRequest,
    ReorderKatasResponse,
    KataResponse,
    DeleteKataResponse,
    EligibleNodesResponse,
    RegisterStudentRequest,
    RegisterStudentResponse,
    BracketTreeResponse,
)
router = APIRouter(tags=["Tournament Structure"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _require_admin(current_user) -> None:
    if current_user.role != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin mới thực hiện được thao tác này"})


# ── 1. GET TREE ───────────────────────────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/weight-class-nodes")
async def get_weight_class_nodes(
    tournament_id: int,
    format: str = Query(default="tree", pattern="^(tree|flat)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    data, error = await structure_repo.get_nodes(db, tournament_id, format)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return data


# ── 2. CREATE NODE ────────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/weight-class-nodes", status_code=201)
async def create_weight_class_node(
    tournament_id: int,
    body: CreateNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    node, error = await structure_repo.create_node(
        db, tournament_id, body.parent_id, body.name, body.node_type, body.node_code, body.rule_json
    )
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node cha"})
    if error == "DUPLICATE_NAME":
        raise HTTPException(400, detail={"code": "DUPLICATE_NAME", "message": "Tên đã tồn tại trong cùng parent"})
    if error == "STRUCTURE_LOCKED":
        raise HTTPException(400, detail={"code": "STRUCTURE_LOCKED", "message": "Giải đã có bracket — không thể thay đổi cấu trúc"})
    if error == "PARENT_HAS_STUDENTS":
        raise HTTPException(400, detail={"code": "PARENT_HAS_STUDENTS", "message": "Không thể thêm cấp con vào hạng cân đã có VĐV đăng ký"})
    return node


# ── 3. UPDATE NODE ────────────────────────────────────────────────────────────

@router.patch("/tournaments/{tournament_id}/weight-class-nodes/{node_id}")
async def update_weight_class_node(
    tournament_id: int,
    node_id: int,
    body: UpdateNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    node, error = await structure_repo.update_node(db, tournament_id, node_id, body.name)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node"})
    if error == "DUPLICATE_NAME":
        raise HTTPException(400, detail={"code": "DUPLICATE_NAME", "message": "Tên đã tồn tại trong cùng parent"})
    return node


# ── 4. DELETE NODE ────────────────────────────────────────────────────────────

@router.delete("/tournaments/{tournament_id}/weight-class-nodes/{node_id}")
async def delete_weight_class_node(
    tournament_id: int,
    node_id: int,
    body: DeleteNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    result, error = await structure_repo.delete_node(db, tournament_id, node_id, body.move_to_node_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node"})
    if error == "STRUCTURE_LOCKED":
        raise HTTPException(400, detail={"code": "STRUCTURE_LOCKED", "message": "Giải có bracket — không thể xóa"})
    if error == "MOVE_TARGET_REQUIRED":
        raise HTTPException(400, detail={"code": "MOVE_TARGET_REQUIRED", "message": "Node có VĐV — cần move_to_node_id"})
    if error == "INVALID_MOVE_TARGET":
        raise HTTPException(400, detail={"code": "INVALID_MOVE_TARGET", "message": "Target phải cùng level, cùng tournament"})
    return result


# ── 5. REORDER NODES ──────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/weight-class-nodes/reorder")
async def reorder_weight_class_nodes(
    tournament_id: int,
    body: ReorderNodesRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    nodes_data = [{"node_id": n.node_id, "sort_order": n.sort_order} for n in body.nodes]
    result, error = await structure_repo.reorder_nodes(db, tournament_id, body.parent_id, nodes_data)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "INVALID_SIBLINGS":
        raise HTTPException(400, detail={"code": "INVALID_SIBLINGS", "message": "Tất cả nodes phải cùng parent"})
    if error == "INCOMPLETE_LIST":
        raise HTTPException(400, detail={"code": "INCOMPLETE_LIST", "message": "Phải cung cấp đủ tất cả siblings"})
    return result


# ── 6. COPY STRUCTURE ─────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/weight-class-nodes/copy", status_code=201)
async def copy_tournament_structure(
    tournament_id: int,
    body: CopyStructureRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    result, error = await structure_repo.copy_structure(
        db, tournament_id, body.source_tournament_id, body.copy_katas
    )
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu đích"})
    if error == "SOURCE_TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "SOURCE_TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu nguồn"})
    if error == "SAME_TOURNAMENT":
        raise HTTPException(400, detail={"code": "SAME_TOURNAMENT", "message": "Source và target là cùng 1 giải"})
    if error == "TARGET_NOT_EMPTY":
        raise HTTPException(400, detail={"code": "TARGET_NOT_EMPTY", "message": "Tournament đích đã có nodes"})
    if error == "TARGET_NOT_DRAFT":
        raise HTTPException(400, detail={"code": "TARGET_NOT_DRAFT", "message": "Tournament đích phải ở trạng thái DRAFT"})
    return result


# ── 7. GET NODE STUDENTS ──────────────────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/weight-class-nodes/{node_id}/students")
async def get_node_students(
    tournament_id: int,
    node_id: int,
    include_descendants: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Không đủ quyền truy cập"})
    result, error = await structure_repo.get_node_students(db, tournament_id, node_id, include_descendants)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node"})
    return result


# ── 8. REGISTER PARTICIPANT ───────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/participants/{student_id}/register", status_code=201)
async def register_participant(
    tournament_id: int,
    student_id: int,
    body: RegisterParticipantRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "club"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin hoặc club mới thực hiện được thao tác này"})

    # Club user: verify student belongs to their club
    if current_user.role == "club":
        if not current_user.club_id:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Tài khoản club chưa được gán câu lạc bộ"})
        from app.repositories import student_repo
        student_club_id = await student_repo.get_student_club_id(db, student_id)
        if student_club_id != current_user.club_id:
            raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Bạn chỉ có thể đăng ký VĐV của câu lạc bộ mình"})

    # Validate: must register for at least one contest type
    if not body.sparring and not body.kata:
        raise HTTPException(400, detail={
            "code": "MISSING_CONTEST_TYPE",
            "message": "Phải chọn ít nhất một nội dung thi đấu (Đối kháng hoặc Quyền)"
        })

    # Validate: if sparring, must specify sparring_weight_id
    if body.sparring and body.sparring_weight_id is None:
        raise HTTPException(400, detail={
            "code": "MISSING_SPARRING_WEIGHT",
            "message": "Chọn Đối kháng thì phải chọn hạng cân"
        })

    # Validate: if kata, must specify at least one kata_id
    if body.kata and not body.kata_ids:
        raise HTTPException(400, detail={
            "code": "MISSING_KATA_IDS",
            "message": "Chọn Quyền thì phải chọn ít nhất một bài quyền"
        })

    reg, error = await structure_repo.register_participant(
        db, tournament_id, student_id,
        node_id=body.node_id,
        sparring=body.sparring,
        sparring_weight_id=body.sparring_weight_id,
        kata=body.kata,
        kata_ids=body.kata_ids,
    )
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "STUDENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "STUDENT_NOT_FOUND", "message": "Không tìm thấy võ sinh"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node phân loại"})
    if error == "INVALID_NODE_LEVEL":
        raise HTTPException(400, detail={"code": "INVALID_NODE_LEVEL", "message": "node_id phải là parent của hạng cân (không phải node lá)"})
    if error == "SPARRING_WEIGHT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "SPARRING_WEIGHT_NOT_FOUND", "message": "Không tìm thấy hạng cân"})
    if error == "GENDER_MISMATCH":
        raise HTTPException(400, detail={"code": "GENDER_MISMATCH", "message": "Giới tính VĐV không khớp với nhóm thi đấu (Nam/Nữ)"})
    if error == "ALREADY_REGISTERED":
        raise HTTPException(409, detail={"code": "ALREADY_REGISTERED", "message": "VĐV đã đăng ký giải này"})
    if error == "INVALID_KATA_ID":
        raise HTTPException(400, detail={"code": "INVALID_KATA_ID", "message": "kata_id không tồn tại hoặc không thuộc giải"})
    return reg


# ── 9. REASSIGN NODE ──────────────────────────────────────────────────────────
async def _require_registration_access(
    db: AsyncSession,
    current_user,
    student_id: int,
    *,
    allow_referee: bool = False,
) -> None:
    if current_user.role == "admin":
        return
    if allow_referee and current_user.role == "referee":
        return
    if current_user.role != "club":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Khong du quyen truy cap"})
    if not current_user.club_id:
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Tai khoan club chua duoc gan cau lac bo"})

    student_club_id = await student_repo.get_student_club_id(db, student_id)
    if student_club_id != current_user.club_id:
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Ban chi co the thao tac voi VDV cua cau lac bo minh"})


@router.post("/tournaments/{tournament_id}/participants/{student_id}/reassign")
async def reassign_participant_node(
    tournament_id: int,
    student_id: int,
    body: ReassignNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _require_registration_access(db, current_user, student_id)
    reg, error = await structure_repo.reassign_node(db, tournament_id, student_id, body.new_node_id)
    if error == "PARTICIPANT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "PARTICIPANT_NOT_FOUND", "message": "VĐV chưa đăng ký giải này"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node"})
    if error == "INVALID_NODE_LEVEL":
        raise HTTPException(400, detail={"code": "INVALID_NODE_LEVEL", "message": "new_node_id phải là hạng cân (node lá, không có cấp con)"})
    if error == "GENDER_MISMATCH":
        raise HTTPException(400, detail={"code": "GENDER_MISMATCH", "message": "Giới tính VĐV không khớp với nhóm thi đấu (Nam/Nữ)"})
    if error == "SAME_NODE":
        raise HTTPException(400, detail={"code": "SAME_NODE", "message": "VĐV đã ở node này"})
    return reg


# ── 10. UPDATE CONTEST TYPES ──────────────────────────────────────────────────

@router.patch("/tournaments/{tournament_id}/participants/{student_id}/contest-types")
async def update_contest_types(
    tournament_id: int,
    student_id: int,
    body: UpdateContestTypesRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _require_registration_access(db, current_user, student_id)
    contest_types_data = [{"type": ct.type, "kata_id": ct.kata_id} for ct in body.contest_types]
    reg, error = await structure_repo.update_contest_types(db, tournament_id, student_id, contest_types_data)
    if error == "PARTICIPANT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "PARTICIPANT_NOT_FOUND", "message": "VĐV chưa đăng ký giải này"})
    if error == "DUPLICATE_SPARRING":
        raise HTTPException(400, detail={"code": "DUPLICATE_SPARRING", "message": "Chỉ 1 sparring entry"})
    if error == "INVALID_KATA_ID":
        raise HTTPException(400, detail={"code": "INVALID_KATA_ID", "message": "kata_id không tồn tại hoặc không thuộc giải"})
    if error == "MISSING_KATA_ID":
        raise HTTPException(400, detail={"code": "MISSING_KATA_ID", "message": "type=kata cần kata_id"})
    return reg


# ── 11. GET PARTICIPANT REGISTRATION ─────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/participants/{student_id}")
async def get_participant_registration(
    tournament_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("admin", "referee", "club"):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Không đủ quyền truy cập"})
    await _require_registration_access(db, current_user, student_id, allow_referee=True)
    reg, error = await structure_repo.get_registration(db, tournament_id, student_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "PARTICIPANT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "PARTICIPANT_NOT_FOUND", "message": "VĐV chưa đăng ký giải này"})
    return reg


# ── 12. LIST KATAS ────────────────────────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/katas")
async def list_katas(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result, error = await structure_repo.get_katas(db, tournament_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


# ── 13. CREATE KATA ───────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/katas", status_code=201)
async def create_kata(
    tournament_id: int,
    body: CreateKataRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    kata, error = await structure_repo.create_kata(db, tournament_id, body.division, body.name, body.description, body.team_size, body.min_team_size)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "DUPLICATE_KATA_NAME":
        raise HTTPException(400, detail={"code": "DUPLICATE_KATA_NAME", "message": "Tên bài quyền đã tồn tại trong giải"})
    return kata


# ── 14. UPDATE KATA ───────────────────────────────────────────────────────────

@router.patch("/tournaments/{tournament_id}/katas/{kata_id}")
async def update_kata(
    tournament_id: int,
    kata_id: int,
    body: UpdateKataRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    kata, error = await structure_repo.update_kata(db, tournament_id, kata_id, body.division, body.name, body.description, body.team_size, body.min_team_size)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "KATA_NOT_FOUND":
        raise HTTPException(404, detail={"code": "KATA_NOT_FOUND", "message": "Không tìm thấy bài quyền"})
    if error == "DUPLICATE_KATA_NAME":
        raise HTTPException(400, detail={"code": "DUPLICATE_KATA_NAME", "message": "Tên bài quyền đã tồn tại trong giải"})
    return kata


# ── 15. DELETE KATA ───────────────────────────────────────────────────────────

@router.delete("/tournaments/{tournament_id}/katas/{kata_id}")
async def delete_kata(
    tournament_id: int,
    kata_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    result, error, affected_count = await structure_repo.delete_kata(db, tournament_id, kata_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "KATA_NOT_FOUND":
        raise HTTPException(404, detail={"code": "KATA_NOT_FOUND", "message": "Không tìm thấy bài quyền"})
    if error == "KATA_IN_USE":
        raise HTTPException(409, detail={
            "error": "KATA_IN_USE",
            "affected_students_count": affected_count,
        })
    return result


# ── 16. REORDER KATAS ─────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/katas/reorder")
async def reorder_katas(
    tournament_id: int,
    body: ReorderKatasRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    katas_data = [{"kata_id": k.kata_id, "sort_order": k.sort_order} for k in body.katas]
    result, error = await structure_repo.reorder_katas(db, tournament_id, katas_data)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "INCOMPLETE_LIST":
        raise HTTPException(400, detail={"code": "INCOMPLETE_LIST", "message": "Kata ID không hợp lệ hoặc không thuộc giải"})
    return result


# ── 17. GET ELIGIBLE NODES ────────────────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/eligible-nodes/{student_id}")
async def get_eligible_nodes(
    tournament_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Gợi ý leaf nodes hợp lệ cho VĐV trong dynamic tournament.
    Dùng node_code + rule_json — không parse tên node.
    """
    _require_admin(current_user)
    result, error = await structure_repo.get_eligible_nodes(db, tournament_id, student_id)
    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "STUDENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "STUDENT_NOT_FOUND", "message": "Không tìm thấy võ sinh"})
    if error == "NO_NODES":
        raise HTTPException(400, detail={"code": "NO_NODES", "message": "Giải đấu chưa có cấu trúc hạng cân"})
    return result


# ── 18. ATOMIC REGISTER STUDENT ───────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/participants/register-student", status_code=201)
async def register_student_atomic(
    tournament_id: int,
    body: RegisterStudentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Tạo student mới + đăng ký vào dynamic tournament trong 1 transaction.
    Spec yêu cầu atomic để tránh trạng thái nửa vời.
    Chỉ dùng cho tournament có structure_mode='dynamic'.
    """
    _require_admin(current_user)

    student_dict = body.student.model_dump()
    club_id = student_dict.pop("club_id")
    contest_types_data = [{"type": ct.type, "kata_id": ct.kata_id} for ct in body.contest_types]

    result, error = await structure_repo.register_student_atomic(
        db=db,
        tournament_id=tournament_id,
        student_data=student_dict,
        club_id=club_id,
        node_id=body.node_id,
        contest_types=contest_types_data,
        override_reason=body.override_reason,
    )

    if error == "TOURNAMENT_NOT_FOUND":
        raise HTTPException(404, detail={"code": "TOURNAMENT_NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    if error == "NOT_DYNAMIC_TOURNAMENT":
        raise HTTPException(400, detail={"code": "NOT_DYNAMIC_TOURNAMENT",
            "message": "Endpoint này chỉ dành cho giải có structure_mode='dynamic'"})
    if error == "NODE_NOT_FOUND":
        raise HTTPException(404, detail={"code": "NODE_NOT_FOUND", "message": "Không tìm thấy node hạng cân"})
    if error == "INVALID_NODE_LEVEL":
        raise HTTPException(400, detail={"code": "INVALID_NODE_LEVEL", "message": "node_id phải là hạng cân (node lá, không có cấp con)"})
    if error == "GENDER_MISMATCH":
        raise HTTPException(400, detail={"code": "GENDER_MISMATCH", "message": "Giới tính VĐV không khớp với nhóm thi đấu (Nam/Nữ)"})
    if error == "DUPLICATE_ID_NUMBER":
        raise HTTPException(400, detail={"code": "DUPLICATE_ID_NUMBER", "message": "CCCD/ID đã tồn tại"})
    if error == "DUPLICATE_SPARRING":
        raise HTTPException(400, detail={"code": "DUPLICATE_SPARRING", "message": "Chỉ 1 sparring entry"})
    if error == "INVALID_KATA_ID":
        raise HTTPException(400, detail={"code": "INVALID_KATA_ID", "message": "kata_id không tồn tại hoặc không thuộc giải"})
    if error == "MISSING_KATA_ID":
        raise HTTPException(400, detail={"code": "MISSING_KATA_ID", "message": "type=kata cần kata_id"})

    await db.commit()
    return result


# ── Bracket tree endpoint ─────────────────────────────────────────────────────

@router.get(
    "/tournaments/{tournament_id}/bracket-tree",
    response_model=BracketTreeResponse,
    tags=["tournaments"],
)
async def get_bracket_tree(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get tournament bracket tables organized by the dynamic tree structure.

    Returns the node tree with leaf nodes enriched with bracket info (weight_class_id, status, players).
    """
    result = await tournament_repo.get_bracket_tree(db, tournament_id)
    if result is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result
