import math
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text, update, exists
from sqlalchemy.orm import aliased
from typing import Optional
from app.models.student import Student, StudentClub
from app.models.club import Club
from app.models.tournament import Tournament, TournamentWeightClass, TournamentParticipant, StudentWeightAssignment, StudentContestSelection, TournamentStructureNode, TournamentKata

REQUIRED_EXCEL_COLS = {"ho_ten", "gioi_tinh", "ten_cau_lac_bo", "dai_cap"}
from app.core.constants import BELT_IMPORT_MAP as BELT_MAP


def _parse_csv_filter(value: Optional[str]) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item and item.strip()]


async def import_students_from_rows(db: AsyncSession, rows: list[dict]) -> dict:
    errors, success = [], 0
    clubs_res = await db.execute(select(Club.id, Club.name))
    club_map = {r.name.strip().lower(): r.id for r in clubs_res}

    for i, row in enumerate(rows, start=2):
        try:
            full_name  = str(row.get("ho_ten", "")).strip()
            gender_raw = str(row.get("gioi_tinh", "")).strip().lower()
            club_raw   = str(row.get("ten_cau_lac_bo", "")).strip()
            belt_raw   = str(row.get("dai_cap", "")).strip().lower()

            if not full_name:
                errors.append({"row": i, "status": "error", "full_name": "", "error": "Thiếu họ tên"})
                continue

            club_id = club_map.get(club_raw.lower())
            if not club_id:
                errors.append({"row": i, "status": "error", "full_name": full_name, "error": f"CLB '{club_raw}' không tồn tại"})
                continue

            belt = BELT_MAP.get(belt_raw)
            if not belt:
                errors.append({"row": i, "status": "error", "full_name": full_name, "error": f"Đai cấp '{belt_raw}' không hợp lệ"})
                continue

            def parse_date(v):
                if not v:
                    return None
                if isinstance(v, datetime):
                    return v.date()
                for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
                    try:
                        return datetime.strptime(str(v).strip(), fmt).date()
                    except Exception:
                        pass
                return None

            gender = "M" if gender_raw in ("nam", "m", "male") else "F"
            code   = await get_next_code(db)

            import uuid
            from datetime import date as date_type
            s = Student(
                code=code,
                full_name=full_name,
                date_of_birth=parse_date(row.get("ngay_sinh")) or date_type(2000, 1, 1),
                gender=gender,
                id_number=str(row.get("cccd", "") or "").strip() or uuid.uuid4().hex[:12].upper(),
                phone=str(row.get("so_dien_thoai", "") or "").strip() or None,
                current_belt=belt,
                join_date=parse_date(row.get("ngay_nhap_mon")) or date_type.today(),
                status="active",
                weight_class=float(row["hang_can"]) if row.get("hang_can") else None,
            )
            db.add(s)
            await db.flush()
            db.add(StudentClub(student_id=s.id, club_id=club_id, joined_at=s.join_date, is_current=True))
            success += 1
        except Exception as e:
            errors.append({"row": i, "status": "error", "full_name": row.get("ho_ten", "?"), "error": str(e)})

    return {"total_rows": len(rows), "success_rows": success, "failed_rows": len(errors), "errors": errors}


async def get_students(
    db: AsyncSession,
    keyword: Optional[str],
    club_id: Optional[int],
    belt_rank: Optional[str],
    event: Optional[str],
    gender: Optional[str],
    dynamic_node_id: Optional[int],
    weight_class: Optional[str],
    category_type: Optional[str],
    category_loai: Optional[str],
    quyen_selection: Optional[str],
    status: str,
    page: int,
    page_size: int,
    weight_verified: Optional[bool] = None,
    tournament_id: Optional[int] = None,
) -> tuple[list, int, Optional[str]]:
    """Returns (rows, total, t_mode). t_mode is None when no tournament_id given."""
    from sqlalchemy import and_ as _and

    base_cols = [
        Student.id,
        Student.code,
        Student.full_name,
        Student.gender,
        Student.current_belt,
        Student.weight_class,
        Student.weight_classes,
        Student.compete_events,
        Student.quyen_selections,
        Student.category_type,
        Student.category_loai,
        Student.status,
        Student.weight_verified,
        StudentClub.club_id,
        Club.name.label("club_name"),
    ]

    t_mode: Optional[str] = None

    if tournament_id is not None:
        t_mode_result = await db.execute(
            select(Tournament.structure_mode).where(Tournament.id == tournament_id)
        )
        t_mode = t_mode_result.scalar_one_or_none()
        if t_mode != "dynamic":
            has_dynamic_assignments = await db.execute(
                select(exists().where(StudentWeightAssignment.tournament_id == tournament_id))
            )
            has_dynamic_nodes = await db.execute(
                select(exists().where(TournamentStructureNode.tournament_id == tournament_id))
            )
            if has_dynamic_assignments.scalar() or has_dynamic_nodes.scalar():
                t_mode = "dynamic"

    dynamic_subtree_ids: Optional[set[int]] = None
    if t_mode == "dynamic" and tournament_id is not None and dynamic_node_id is not None:
        nodes_rows = (
            await db.execute(
                select(TournamentStructureNode.id, TournamentStructureNode.parent_id)
                .where(TournamentStructureNode.tournament_id == tournament_id)
            )
        ).all()
        children_by_parent: dict[int | None, list[int]] = {}
        for row in nodes_rows:
            children_by_parent.setdefault(row.parent_id, []).append(row.id)

        dynamic_subtree_ids = set()
        stack = [dynamic_node_id]
        while stack:
            current_id = stack.pop()
            if current_id in dynamic_subtree_ids:
                continue
            dynamic_subtree_ids.add(current_id)
            stack.extend(children_by_parent.get(current_id, []))

    if t_mode == "dynamic":
        assigned_node = aliased(TournamentStructureNode)
        classification_node = aliased(TournamentStructureNode)
        category_node = aliased(TournamentStructureNode)
        # JOIN StudentWeightAssignment + TournamentStructureNode to expose node data in rows
        base = (
            select(
                *base_cols,
                StudentWeightAssignment.node_id.label("swa_node_id"),
                assigned_node.name.label("swa_node_name"),
                classification_node.name.label("swa_group_name"),
                category_node.name.label("swa_category_name"),
            )
            .outerjoin(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))
            .outerjoin(Club, Club.id == StudentClub.club_id)
            .join(
                StudentWeightAssignment,
                _and(
                    StudentWeightAssignment.student_id == Student.id,
                    StudentWeightAssignment.tournament_id == tournament_id,
                ),
            )
            .outerjoin(assigned_node, assigned_node.id == StudentWeightAssignment.node_id)
            .outerjoin(
                classification_node,
                or_(
                    _and(
                        assigned_node.node_type == "weight_class",
                        classification_node.id == assigned_node.parent_id,
                    ),
                    _and(
                        assigned_node.node_type != "weight_class",
                        classification_node.id == assigned_node.id,
                    ),
                ),
            )
            .outerjoin(category_node, category_node.id == classification_node.parent_id)
        )
    else:
        base = (
            select(*base_cols)
            .outerjoin(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))
            .outerjoin(Club, Club.id == StudentClub.club_id)
        )
        if tournament_id is not None:
            # Legacy or unknown: TournamentParticipant (primary) + StudentWeightAssignment fallback
            base = base.where(
                or_(
                    Student.id.in_(
                        select(TournamentParticipant.student_id)
                        .join(TournamentWeightClass, TournamentWeightClass.id == TournamentParticipant.weight_class_id)
                        .where(TournamentWeightClass.tournament_id == tournament_id)
                        .distinct()
                    ),
                    Student.id.in_(
                        select(StudentWeightAssignment.student_id)
                        .where(StudentWeightAssignment.tournament_id == tournament_id)
                        .distinct()
                    ),
                )
            )

    if keyword:
        base = base.where(
            or_(
                Student.full_name.ilike(f"%{keyword}%"),
                Student.code.ilike(f"%{keyword}%"),
            )
        )
    if club_id:
        base = base.where(StudentClub.club_id == club_id)
    if belt_rank:
        base = base.where(Student.current_belt == belt_rank)
    if event:
        if t_mode == "dynamic":
            base = base.where(
                exists(
                    select(StudentContestSelection.id).where(
                        StudentContestSelection.student_id == Student.id,
                        StudentContestSelection.tournament_id == tournament_id,
                        StudentContestSelection.contest_type == event,
                    )
                )
            )
        else:
            base = base.where(Student.compete_events.contains([event]))
    if gender:
        base = base.where(Student.gender == gender)
    if dynamic_subtree_ids:
        base = base.where(StudentWeightAssignment.node_id.in_(dynamic_subtree_ids))
    weight_classes = _parse_csv_filter(weight_class)
    if weight_classes:
        if t_mode == "dynamic":
            normalized_weight_classes = [item.lower() for item in weight_classes]
            base = base.where(
                _and(
                    assigned_node.node_type == "weight_class",
                    func.lower(func.trim(assigned_node.name)).in_(normalized_weight_classes),
                )
            )
        else:
            from sqlalchemy import cast
            from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
            from sqlalchemy import Numeric as SANumeric
            weight_conditions = []
            for item in weight_classes:
                try:
                    wc_dec = float(item)
                except (TypeError, ValueError):
                    wc_dec = item
                weight_conditions.append(
                    or_(
                        Student.weight_class == wc_dec,
                        Student.weight_classes.contains(cast([wc_dec], PG_ARRAY(SANumeric(5, 2)))),
                    )
                )
            if weight_conditions:
                base = base.where(or_(*weight_conditions))
    if category_type:
        if t_mode == "dynamic":
            normalized_category_type = category_type.strip()
            base = base.where(
                func.lower(func.trim(category_node.name)) == normalized_category_type.lower()
            )
        else:
            base = base.where(Student.category_type == category_type)
    if category_loai:
        if t_mode == "dynamic":
            normalized_category_loai = category_loai.strip()
            base = base.where(
                func.lower(func.trim(classification_node.name)) == normalized_category_loai.lower()
            )
        else:
            base = base.where(Student.category_loai == category_loai)
    quyen_selections = _parse_csv_filter(quyen_selection)
    if quyen_selections:
        if t_mode == "dynamic":
            kata_name_conditions = [TournamentKata.name == item for item in quyen_selections]
            base = base.where(
                exists(
                    select(StudentContestSelection.id)
                    .join(TournamentKata, TournamentKata.id == StudentContestSelection.kata_id)
                    .where(
                        StudentContestSelection.student_id == Student.id,
                        StudentContestSelection.tournament_id == tournament_id,
                        StudentContestSelection.contest_type == "kata",
                        or_(*kata_name_conditions),
                    )
                )
            )
        else:
            base = base.where(or_(*[
                Student.quyen_selections.contains([item])
                for item in quyen_selections
            ]))
    if weight_verified is not None:
        base = base.where(Student.weight_verified == weight_verified)
    if status != "all":
        base = base.where(Student.status == status)

    count_q = select(func.count()).select_from(base.subquery())
    total   = (await db.execute(count_q)).scalar_one()

    rows_q = base.order_by(Student.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows   = (await db.execute(rows_q)).mappings().all()
    return rows, total, t_mode


async def get_all_clubs(db: AsyncSession, tournament_id: int | None = None) -> list:
    q = select(Club.id, Club.name).where(Club.status == "active")
    if tournament_id is not None:
        q = q.where(Club.tournament_ids.contains([tournament_id]))
    result = await db.execute(q.order_by(Club.name))
    return result.mappings().all()


async def get_students_for_export(
    db: AsyncSession,
    ids: list[int] | None = None,
    club_id: int | None = None,
    tournament_id: int | None = None,
) -> list:
    q = (
        select(
            Student.id,
            Student.code,
            Student.full_name,
            Student.avatar_url,
            Student.date_of_birth,
            Student.gender,
            Student.weight_class,
            Student.compete_events,
            Student.category_type,
            Student.category_loai,
            Student.status,
            Club.name.label("club_name"),
        )
        .outerjoin(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))
        .outerjoin(Club, Club.id == StudentClub.club_id)
        .where(Student.status == "active")
    )
    if ids is not None:
        q = q.where(Student.id.in_(ids))
    if club_id is not None:
        q = q.where(StudentClub.club_id == club_id)
    if tournament_id is not None and ids is None:
        # Only export students registered in this tournament
        q = q.where(
            exists(
                select(StudentWeightAssignment.id).where(
                    StudentWeightAssignment.student_id == Student.id,
                    StudentWeightAssignment.tournament_id == tournament_id,
                )
            ) | exists(
                select(StudentContestSelection.id).where(
                    StudentContestSelection.student_id == Student.id,
                    StudentContestSelection.tournament_id == tournament_id,
                )
            )
        )
    q = q.order_by(Club.name.asc(), Student.category_type.asc(), Student.full_name.asc()).limit(1000)
    rows = (await db.execute(q)).mappings().all()

    if tournament_id is None or not rows:
        return rows

    t_mode_result = await db.execute(select(Tournament.structure_mode).where(Tournament.id == tournament_id))
    t_mode = t_mode_result.scalar_one_or_none()
    if t_mode != "dynamic":
        has_dynamic_assignments = await db.execute(
            select(exists().where(StudentWeightAssignment.tournament_id == tournament_id))
        )
        has_dynamic_nodes = await db.execute(
            select(exists().where(TournamentStructureNode.tournament_id == tournament_id))
        )
        if has_dynamic_assignments.scalar() or has_dynamic_nodes.scalar():
            t_mode = "dynamic"

    if t_mode != "dynamic":
        return rows

    student_ids = [r["id"] for r in rows]
    assignment_rows = await db.execute(
        select(
            StudentWeightAssignment.student_id,
            StudentWeightAssignment.node_id,
            TournamentStructureNode.name.label("node_name"),
        )
        .join(TournamentStructureNode, TournamentStructureNode.id == StudentWeightAssignment.node_id)
        .where(
            StudentWeightAssignment.tournament_id == tournament_id,
            StudentWeightAssignment.student_id.in_(student_ids),
        )
    )
    student_node_map = {
        r.student_id: {"node_id": r.node_id, "node_name": r.node_name}
        for r in assignment_rows
        if r.node_id is not None
    }
    if not student_node_map:
        return rows

    reg_info = await enrich_dynamic_registration(db, tournament_id, student_node_map)
    merged_rows = []
    for row in rows:
        payload = dict(row)
        payload.update(reg_info.get(payload["id"], {}))
        merged_rows.append(payload)
    return merged_rows


async def id_number_exists(db: AsyncSession, id_number: str, exclude_id: Optional[int] = None) -> bool:
    q = select(Student.id).where(Student.id_number == id_number)
    if exclude_id:
        q = q.where(Student.id != exclude_id)
    return (await db.execute(q)).scalar_one_or_none() is not None


async def get_next_code(db: AsyncSession) -> str:
    result = await db.execute(text("SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)) FROM students WHERE code LIKE 'MS-%'"))
    max_num = result.scalar_one_or_none() or 0
    return f"MS-{(max_num + 1):05d}"


async def create_student(db: AsyncSession, data: dict, club_id: int) -> Student:
    import uuid
    from datetime import date as date_type
    code    = await get_next_code(db)
    payload = {k: v for k, v in data.items() if k not in ("club_id", "province_id")}
    if not payload.get("date_of_birth"):
        payload["date_of_birth"] = date_type(2000, 1, 1)
    if not payload.get("id_number"):
        payload["id_number"] = uuid.uuid4().hex[:12].upper()
    if not payload.get("join_date"):
        payload["join_date"] = date_type.today()
    student = Student(**payload, code=code)
    db.add(student)
    await db.flush()
    db.add(StudentClub(student_id=student.id, club_id=club_id, joined_at=payload["join_date"], is_current=True))
    return student


async def get_student_club_id(db: AsyncSession, student_id: int) -> int | None:
    """Return the current club_id of a student, or None if not found."""
    result = await db.execute(
        select(StudentClub.club_id)
        .where(StudentClub.student_id == student_id, StudentClub.is_current == True)
    )
    return result.scalar_one_or_none()


async def get_student_avatar(db: AsyncSession, student_id: int) -> str | None:
    result = await db.execute(select(Student.avatar_url).where(Student.id == student_id))
    return result.scalar_one_or_none()


async def update_avatar_url(db: AsyncSession, student_id: int, avatar_url: str) -> None:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if student:
        student.avatar_url = avatar_url


async def update_student(db: AsyncSession, student_id: int, data: dict, new_club_id: Optional[int] = None) -> Optional[Student]:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        return None
    for k, v in data.items():
        if k not in ("club_id", "province_id") and hasattr(student, k) and v is not None:
            setattr(student, k, v)
    # Nếu đổi CLB
    if new_club_id and new_club_id != student.__dict__.get("_club_id"):
        old_sc = await db.execute(
            select(StudentClub).where(StudentClub.student_id == student_id, StudentClub.is_current == True)
        )
        old_sc = old_sc.scalar_one_or_none()
        if old_sc and old_sc.club_id != new_club_id:
            from datetime import date as date_type
            old_sc.is_current = False
            old_sc.left_at = date_type.today()
            db.add(StudentClub(student_id=student_id, club_id=new_club_id, joined_at=date_type.today(), is_current=True))
    return student


async def get_student_detail(db: AsyncSession, student_id: int, tournament_id: int | None = None) -> dict | None:
    q = (
        select(
            Student,
            Club.id.label("club_id"),
            Club.name.label("club_name"),
            Club.address.label("club_address"),
            StudentClub.joined_at.label("club_joined_at"),
        )
        .outerjoin(StudentClub, (StudentClub.student_id == Student.id) & (StudentClub.is_current == True))
        .outerjoin(Club, Club.id == StudentClub.club_id)
        .where(Student.id == student_id)
    )
    row = (await db.execute(q)).mappings().first()
    if not row:
        return None
    data = dict(row)
    student_obj = data.pop("Student")
    for col in student_obj.__table__.columns:
        data[col.name] = getattr(student_obj, col.name)
    hist_q = (
        select(Club.name.label("club_name"), StudentClub.joined_at, StudentClub.left_at, StudentClub.is_current)
        .join(Club, Club.id == StudentClub.club_id)
        .where(StudentClub.student_id == student_id)
        .order_by(StudentClub.joined_at.desc())
    )
    hist = (await db.execute(hist_q)).mappings().all()
    data["club_history"] = [dict(h) for h in hist]
    data["coach_name"]  = None
    data["coach_phone"] = None

    # Override compete_events + quyen_selections with tournament-specific registrations
    if tournament_id is not None:
        scs_rows = (await db.execute(
            select(
                StudentContestSelection.contest_type,
                TournamentKata.name.label("kata_name"),
            )
            .outerjoin(TournamentKata, TournamentKata.id == StudentContestSelection.kata_id)
            .where(
                StudentContestSelection.student_id == student_id,
                StudentContestSelection.tournament_id == tournament_id,
            )
        )).mappings().all()

        if scs_rows:
            has_sparring = any(r["contest_type"] == "sparring" for r in scs_rows)
            kata_names = [r["kata_name"] for r in scs_rows if r["contest_type"] == "kata" and r["kata_name"]]
            data["compete_events"] = ["sparring"] if has_sparring else []
            data["quyen_selections"] = kata_names if kata_names else None
        else:
            has_sparring = False

        # Hạng cân: lấy tên leaf node từ StudentWeightAssignment (chỉ khi thi đối kháng)
        swa_row = (await db.execute(
            select(
                StudentWeightAssignment.node_id,
                TournamentStructureNode.name.label("node_name"),
            )
            .join(TournamentStructureNode, TournamentStructureNode.id == StudentWeightAssignment.node_id)
            .where(
                StudentWeightAssignment.student_id == student_id,
                StudentWeightAssignment.tournament_id == tournament_id,
            )
        )).mappings().first()

        if swa_row is not None:
            if not scs_rows:
                data["compete_events"] = ["sparring"]
                data["quyen_selections"] = None
                has_sparring = True

            # Kiểm tra leaf node (không có con)
            child_exists = (await db.execute(
                select(TournamentStructureNode.id)
                .where(TournamentStructureNode.parent_id == swa_row["node_id"])
                .limit(1)
            )).scalar_one_or_none()

            if has_sparring and child_exists is None:
                data["registration_weight_class_name"] = swa_row["node_name"]

    return data


# ── Tournament registration ────────────────────────────────────────────────────

async def register_student_to_tournament(db: AsyncSession, student_id: int) -> None:
    """
    Tự động đăng ký student vào tournament weight classes — CHỈ cho giải legacy.
    Giải dynamic (structure_mode='dynamic') KHÔNG dùng hàm này;
    registration phải đi qua structure_repo.register_participant() hoặc register_student_atomic().
    """
    # Lấy student
    student = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = student.scalar_one_or_none()
    if not student:
        return

    # Lấy tournament đầu tiên chưa hoàn thành
    from sqlalchemy import not_
    tournament = await db.execute(
        select(Tournament)
        .where(Tournament.status.in_(["DRAFT", "PUBLISHED", "ONGOING"]))
        .order_by(Tournament.id)
        .limit(1)
    )
    tournament = tournament.scalar_one_or_none()
    if not tournament:
        return

    # QUAN TRỌNG: Bỏ qua nếu tournament dùng dynamic structure
    # Dynamic tournaments dùng StudentWeightAssignment + StudentContestSelection
    # không ghi vào TournamentWeightClass/TournamentParticipant
    if getattr(tournament, 'structure_mode', 'legacy') == 'dynamic':
        return

    # Lấy danh sách weight_classes hiệu lực (ưu tiên mảng, fallback về giá trị đơn)
    effective_wcs = list(student.weight_classes or [])
    if not effective_wcs and student.weight_class is not None:
        effective_wcs = [student.weight_class]

    if not effective_wcs or not student.category_type or not student.category_loai:
        return

    # Xóa các TournamentParticipant cũ của student này trong tournament này
    from sqlalchemy import and_
    existing = (await db.execute(
        select(TournamentParticipant)
        .join(TournamentWeightClass)
        .where(
            and_(
                TournamentWeightClass.tournament_id == tournament.id,
                TournamentParticipant.student_id == student_id,
            )
        )
    )).scalars().all()
    old_wc_ids = {ep.weight_class_id for ep in existing}
    for ep in existing:
        await db.delete(ep)
    await db.flush()

    # Chuyển đổi giá trị số → tên nhãn WC (ví dụ 45 → "45kg")
    from app.core.constants import WEIGHT_CLASSES
    wc_list = WEIGHT_CLASSES.get(student.gender, WEIGHT_CLASSES["M"])

    matched_wc_ids = set()

    for raw_val in effective_wcs:
        # So sánh an toàn giữa Decimal/int/float
        try:
            float_val = float(raw_val)
        except (TypeError, ValueError):
            continue

        wc_def = next((w for w in wc_list if float(w["value"]) == float_val), None)
        if not wc_def:
            continue

        wc_name = wc_def["label"].replace(" ", "")  # "45 kg" → "45kg"

        # Tìm TournamentWeightClass phù hợp — hoặc TẠO MỚI nếu chưa có
        twc = (await db.execute(
            select(TournamentWeightClass)
            .where(
                TournamentWeightClass.tournament_id == tournament.id,
                TournamentWeightClass.gender == student.gender,
                TournamentWeightClass.category == student.category_type,
                TournamentWeightClass.age_type_code == student.category_loai,
                TournamentWeightClass.weight_class_name == wc_name,
            )
        )).scalar_one_or_none()

        if twc is None:
            twc = TournamentWeightClass(
                tournament_id=tournament.id,
                category=student.category_type,
                age_type_code=student.category_loai,
                weight_class_name=wc_name,
                gender=student.gender,
                total_players=0,
                bracket_status="NOT_GENERATED",
            )
            db.add(twc)
            await db.flush()  # cần flush để có twc.id

        # Đăng ký participant nếu chưa có
        exists = (await db.execute(
            select(TournamentParticipant)
            .where(
                TournamentParticipant.weight_class_id == twc.id,
                TournamentParticipant.student_id == student_id,
            )
        )).scalar_one_or_none()

        if not exists:
            db.add(TournamentParticipant(weight_class_id=twc.id, student_id=student_id))
            matched_wc_ids.add(twc.id)
        else:
            matched_wc_ids.add(twc.id)

    await db.flush()

    # ── Secondary registrations ────────────────────────────────────────────────
    # Case 1: phong_trao "5" (quyền adult) student who also has sparring
    #         → ALSO register in đối kháng WC (age_type_code "4")
    # Case 2: Non-"5" student who has quyen_selections
    #         → ALSO register in quyền WC (age_type_code "5")

    secondary_cases: list[str] = []
    if (student.category_loai == "5"
            and student.category_type == "phong_trao"
            and "sparring" in (student.compete_events or [])
            and effective_wcs):
        secondary_cases.append("4")  # đối kháng WC

    if (student.category_loai != "5"
            and student.quyen_selections
            and effective_wcs):
        secondary_cases.append("5")  # quyền WC

    for sec_code in secondary_cases:
        for raw_val in effective_wcs:
            try:
                float_val = float(raw_val)
            except (TypeError, ValueError):
                continue

            wc_def = next((w for w in wc_list if float(w["value"]) == float_val), None)
            if not wc_def:
                continue

            wc_name = wc_def["label"].replace(" ", "")

            sec_twc = (await db.execute(
                select(TournamentWeightClass)
                .where(
                    TournamentWeightClass.tournament_id == tournament.id,
                    TournamentWeightClass.gender == student.gender,
                    TournamentWeightClass.category == student.category_type,
                    TournamentWeightClass.age_type_code == sec_code,
                    TournamentWeightClass.weight_class_name == wc_name,
                )
            )).scalar_one_or_none()

            if sec_twc is None:
                sec_twc = TournamentWeightClass(
                    tournament_id=tournament.id,
                    category=student.category_type,
                    age_type_code=sec_code,
                    weight_class_name=wc_name,
                    gender=student.gender,
                    total_players=0,
                    bracket_status="NOT_GENERATED",
                )
                db.add(sec_twc)
                await db.flush()

            sec_exists = (await db.execute(
                select(TournamentParticipant)
                .where(
                    TournamentParticipant.weight_class_id == sec_twc.id,
                    TournamentParticipant.student_id == student_id,
                )
            )).scalar_one_or_none()

            if not sec_exists:
                db.add(TournamentParticipant(weight_class_id=sec_twc.id, student_id=student_id))
            matched_wc_ids.add(sec_twc.id)

    await db.flush()

    # Cập nhật total_players cho tất cả WC bị ảnh hưởng (cả mới lẫn cũ đã xóa)
    affected_wc_ids = matched_wc_ids | old_wc_ids
    from sqlalchemy import func as sa_func
    for wc_id in affected_wc_ids:
        count = (await db.execute(
            select(sa_func.count(TournamentParticipant.id))
            .where(TournamentParticipant.weight_class_id == wc_id)
        )).scalar_one()
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc_id)
            .values(total_players=count)
        )

    await db.flush()


async def enrich_dynamic_registration(
    db: AsyncSession,
    tournament_id: int,
    student_node_map: dict[int, dict],
) -> dict[int, dict]:
    """Build per-student registration display data for a dynamic tournament.

    Args:
        student_node_map: dict[student_id] → {"node_id": int, "node_name": str}
                          — already available from the JOIN in get_students.
    Returns dict[student_id] with:
      registration_category          – level-1 ancestor node name (Hạng mục)
      registration_weight_class_name – leaf node name (Hạng cân)
      registration_content           – list of weight class + kata names (Nội dung thi đấu)
    """
    if not student_node_map:
        return {}

    student_ids = list(student_node_map.keys())

    # 1. Load all structure nodes for this tournament (to traverse level-1 ancestor)
    nodes_rows = await db.execute(
        select(
            TournamentStructureNode.id,
            TournamentStructureNode.parent_id,
            TournamentStructureNode.name,
            TournamentStructureNode.level,
        ).where(TournamentStructureNode.tournament_id == tournament_id)
    )
    node_map: dict[int, dict] = {}
    for r in nodes_rows:
        node_map[r.id] = {"id": r.id, "parent_id": r.parent_id, "name": r.name, "level": r.level}
    non_leaf_ids = {node["parent_id"] for node in node_map.values() if node["parent_id"] is not None}

    def category_name_for(node_id: int) -> str | None:
        """Walk up the tree to return the level-1 ancestor name (Loại hình / Hạng mục)."""
        seen: set[int] = set()
        curr_id: int | None = node_id
        while curr_id is not None and curr_id not in seen:
            seen.add(curr_id)
            n = node_map.get(curr_id)
            if n is None:
                break
            if n["level"] == 1:
                return n["name"]
            curr_id = n["parent_id"]
        return None

    # 2. Contest selections + kata names (batch query)
    scs_rows = await db.execute(
        select(
            StudentContestSelection.student_id,
            StudentContestSelection.contest_type,
            TournamentKata.name.label("kata_name"),
            TournamentKata.sort_order.label("kata_sort_order"),
        )
        .outerjoin(TournamentKata, TournamentKata.id == StudentContestSelection.kata_id)
        .where(
            StudentContestSelection.tournament_id == tournament_id,
            StudentContestSelection.student_id.in_(student_ids),
        )
    )
    scs_by_student: dict[int, dict] = {}
    for r in scs_rows.mappings().all():
        sid = r["student_id"]
        if sid not in scs_by_student:
            scs_by_student[sid] = {"has_sparring": False, "katas": []}
        if r["contest_type"] == "sparring":
            scs_by_student[sid]["has_sparring"] = True
        elif r["contest_type"] == "kata" and r["kata_name"]:
            scs_by_student[sid]["katas"].append((r["kata_sort_order"] or 0, r["kata_name"]))

    # 3. Assemble per-student result
    result: dict[int, dict] = {}
    for sid, node_data in student_node_map.items():
        node_id   = node_data["node_id"]
        node_name = node_data["node_name"]   # leaf node name = Hạng cân
        scs       = scs_by_student.get(sid, {"has_sparring": False, "katas": []})

        # Always prefer the real level-1 ancestor from the tree.
        # The joined category_name can drift when older assignments or deeper trees exist.
        category = category_name_for(node_id) or node_data.get("category_name")
        has_spar = scs["has_sparring"]
        # Nội dung: "Đối kháng" (word, not node name) + kata names
        kata_names = [name for _, name in sorted(scs["katas"], key=lambda item: (item[0], item[1]))]
        content: list[str] = (["Đối kháng"] if has_spar else []) + kata_names

        weight_class_name = node_name if has_spar and node_id not in non_leaf_ids else None
        result[sid] = {
            "registration_category":          category,
            # Hạng cân chỉ hiển thị khi VĐV thi đối kháng
            "registration_weight_class_name": weight_class_name,
            "registration_content":           content if content else None,
        }

    return result


async def soft_delete_student(db: AsyncSession, student_id: int) -> bool:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        return False

    affected_wc_ids = [
        row[0] for row in (
            await db.execute(
                select(TournamentParticipant.weight_class_id)
                .where(TournamentParticipant.student_id == student_id)
                .distinct()
            )
        ).all()
    ]

    student.status = "inactive"
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(TournamentParticipant).where(TournamentParticipant.student_id == student_id))
    await db.execute(sa_delete(StudentWeightAssignment).where(StudentWeightAssignment.student_id == student_id))
    await db.execute(sa_delete(StudentContestSelection).where(StudentContestSelection.student_id == student_id))
    await db.execute(sa_delete(StudentClub).where(StudentClub.student_id == student_id))

    for wc_id in affected_wc_ids:
        active_count = (
            await db.execute(
                select(func.count(TournamentParticipant.id))
                .join(Student, Student.id == TournamentParticipant.student_id)
                .where(
                    TournamentParticipant.weight_class_id == wc_id,
                    Student.status == "active",
                )
            )
        ).scalar_one()
        await db.execute(
            update(TournamentWeightClass)
            .where(TournamentWeightClass.id == wc_id)
            .values(total_players=active_count)
        )
    return True


async def bulk_soft_delete_students(db: AsyncSession, student_ids: list[int]) -> int:
    result = await db.execute(
        update(Student)
        .where(Student.id.in_(student_ids))
        .values(status="inactive")
        .returning(Student.id)
    )
    deleted_ids = [row[0] for row in result.all()]
    if deleted_ids:
        affected_wc_ids = [
            row[0] for row in (
                await db.execute(
                    select(TournamentParticipant.weight_class_id)
                    .where(TournamentParticipant.student_id.in_(deleted_ids))
                    .distinct()
                )
            ).all()
        ]
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(TournamentParticipant).where(TournamentParticipant.student_id.in_(deleted_ids)))
        await db.execute(sa_delete(StudentWeightAssignment).where(StudentWeightAssignment.student_id.in_(deleted_ids)))
        await db.execute(sa_delete(StudentContestSelection).where(StudentContestSelection.student_id.in_(deleted_ids)))
        await db.execute(sa_delete(StudentClub).where(StudentClub.student_id.in_(deleted_ids)))

        for wc_id in affected_wc_ids:
            active_count = (
                await db.execute(
                    select(func.count(TournamentParticipant.id))
                    .join(Student, Student.id == TournamentParticipant.student_id)
                    .where(
                        TournamentParticipant.weight_class_id == wc_id,
                        Student.status == "active",
                    )
                )
            ).scalar_one()
            await db.execute(
                update(TournamentWeightClass)
                .where(TournamentWeightClass.id == wc_id)
                .values(total_players=active_count)
            )
    return len(deleted_ids)
