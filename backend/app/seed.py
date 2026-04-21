"""
Seed data cho localhost.
Chạy: docker compose exec api python -m app.seed
Reset + reseed: docker compose exec api python -m app.seed --reset
"""
import asyncio
import random
import sys
from datetime import date
from decimal import Decimal

from sqlalchemy import select, delete, func
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.club import Province, Club
from app.models.student import Student, StudentClub
from app.models.tournament import (
    Tournament, TournamentWeightClass, TournamentParticipant, BracketMatch,
    TournamentStructureNode, TournamentKata,
    StudentWeightAssignment, StudentContestSelection,
)

# ── Static master data ────────────────────────────────────────────────────────

PROVINCES = [
    (1,  "Hà Nội",            "HNI"),
    (2,  "TP. Hồ Chí Minh",   "HCM"),
    (3,  "Đà Nẵng",           "DNG"),
    (4,  "Cần Thơ",           "CTH"),
    (5,  "Hải Phòng",         "HPG"),
    (6,  "An Giang",          "AGG"),
    (7,  "Bà Rịa - Vũng Tàu", "BRV"),
    (8,  "Bắc Giang",         "BGG"),
    (9,  "Bắc Ninh",          "BNH"),
    (10, "Bến Tre",           "BTR"),
    (11, "Bình Dương",        "BDG"),
    (12, "Bình Định",         "BDH"),
    (13, "Bình Phước",        "BPC"),
    (14, "Bình Thuận",        "BTN"),
    (15, "Đắk Lắk",          "DLK"),
    (16, "Đồng Nai",          "DNI"),
    (17, "Đồng Tháp",         "DTP"),
    (18, "Gia Lai",           "GLA"),
    (19, "Hà Tĩnh",           "HTH"),
    (20, "Khánh Hòa",         "KHA"),
    (21, "Kiên Giang",        "KGG"),
    (22, "Kon Tum",           "KTM"),
    (23, "Lâm Đồng",          "LDG"),
    (24, "Long An",           "LAN"),
    (25, "Nghệ An",           "NAN"),
    (26, "Ninh Thuận",        "NTN"),
    (27, "Phú Thọ",           "PTH"),
    (28, "Quảng Nam",         "QNM"),
    (29, "Quảng Ngãi",        "QNI"),
    (30, "Tây Ninh",          "TNH"),
    (31, "Tiền Giang",        "TGG"),
    (32, "Vĩnh Long",         "VLG"),
]

CLUBS = [
    ("CLB-HCM-001", "CLB Vovinam Quận 1",        2, "123 Nguyễn Trãi, Q.1"),
    ("CLB-HCM-002", "CLB Vovinam Bình Thạnh",     2, "45 Đinh Tiên Hoàng, Bình Thạnh"),
    ("CLB-HCM-003", "CLB Vovinam Gò Vấp",         2, "78 Nguyễn Văn Nghi, Gò Vấp"),
    ("CLB-HNI-001", "CLB Vovinam Đống Đa",        1, "12 Tôn Đức Thắng, Đống Đa"),
    ("CLB-DNG-001", "CLB Vovinam Hải Châu",       3, "56 Trần Phú, Hải Châu"),
    ("CLB-HCM-004", "CLB Vovinam Lương Tài",      2, None),
]

# Bài quyền cho loại 5 (quyền)
QUYEN_BAI_LIST = [
    "Tứ trụ quyền", "Bình pháp quyền", "Ngũ môn quyền",
    "Thập thủ đạo", "Thập tứ thế", "Long hổ quyền",
]

# Demo students — 20 VĐV mẫu
# (name, dob, gender, cccd, phone, belt, weight, club_idx, category_type, category_loai, compete_events, quyen_selections)
STUDENTS_DEMO = [
    ("Nguyễn Văn An",    date(2000, 3, 15), "M", "079200001001", "0901111001", "Hoàng đai",         54.0, 1, "phong_trao", "4",  ["sparring"],              None),
    ("Trần Thị Bình",    date(2001, 7, 22), "F", "079200001002", "0901111002", "Lam đai II",         51.0, 1, "phong_trao", "4",  ["sparring"],              None),
    ("Lê Văn Cường",     date(1999, 1, 10), "M", "079200001003", "0901111003", "Chuẩn Hoàng đai",   68.0, 2, "phong_trao", "4",  ["sparring"],              None),
    ("Phạm Thị Dung",    date(2002, 5, 30), "F", "079200001004", "0901111004", "Lam đai I",          57.0, 2, "phong_trao", "4",  ["sparring"],              None),
    ("Hoàng Văn Em",     date(1998, 11, 8), "M", "079200001005", "0901111005", "Hoàng đai I",        77.0, 3, "phong_trao", "4",  ["sparring"],              None),
    ("Vũ Thị Fương",     date(2003, 9, 14), "F", "079200001006", "0901111006", "Lam đai nhập môn",  48.0, 3, "phong_trao", "4",  ["sparring"],              None),
    ("Đặng Văn Giáp",    date(2000, 6, 25), "M", "079200001007", "0901111007", "Chuẩn Hoàng đai",   60.0, 4, "phong_trao", "5",  ["don_luyen", "song_luyen"], ["Tứ trụ quyền", "Bình pháp quyền"]),
    ("Bùi Thị Hoa",      date(2001, 2, 18), "F", "079200001008", "0901111008", "Lam đai III",        54.0, 4, "phong_trao", "5",  ["don_luyen"],             ["Tứ trụ quyền"]),
    ("Ngô Văn Inh",      date(1997, 12, 3), "M", "079200001009", "0901111009", "Hoàng đai II",       77.0, 5, "phong_trao", "4",  ["sparring"],              None),
    ("Đinh Thị Kim",     date(2002, 8, 7),  "F", "079200001010", "0901111010", "Tự vệ nhập môn",    51.0, 5, "phong_trao", "4",  ["sparring"],              None),
    ("Trương Văn Long",  date(1999, 4, 20), "M", "079200001011", "0901111011", "Lam đai II",         60.0, 1, "phong_trao", "5",  ["don_luyen", "song_luyen"], ["Ngũ môn quyền"]),
    ("Lý Thị Mai",       date(2000, 10, 12),"F", "079200001012", "0901111012", "Chuẩn Hoàng đai",   57.0, 2, "pho_thong",  "4",  ["sparring"],              None),
    ("Phan Văn Nam",     date(2001, 3, 5),  "M", "079200001013", "0901111013", "Lam đai nhập môn",  54.0, 3, "pho_thong",  "4",  ["sparring"],              None),
    ("Tô Thị Oanh",      date(2003, 6, 28), "F", "079200001014", "0901111014", "Lam đai I",          51.0, 4, "pho_thong",  "4",  ["sparring"],              None),
    ("Cao Văn Phúc",     date(1998, 7, 16), "M", "079200001015", "0901111015", "Hoàng đai III",      68.0, 5, "pho_thong",  "4",  ["sparring"],              None),
    ("Mai Thị Quỳnh",    date(2002, 1, 9),  "F", "079200001016", "0901111016", "Tự vệ nhập môn",    45.0, 1, "pho_thong",  "4",  ["sparring"],              None),
    ("Dương Văn Rạng",   date(2000, 9, 23), "M", "079200001017", "0901111017", "Lam đai III",        68.0, 2, "phong_trao", "5",  ["don_luyen"],             ["Thập thủ đạo"]),
    ("Hồ Thị Sen",       date(2001, 5, 4),  "F", "079200001018", "0901111018", "Chuẩn Hoàng đai",   60.0, 3, "phong_trao", "5",  ["don_luyen", "song_luyen"], ["Bình pháp quyền", "Thập tứ thế"]),
    ("Lưu Văn Tâm",      date(1999, 8, 17), "M", "079200001019", "0901111019", "Chuẩn Hồng đai",    77.0, 4, "phong_trao", "4",  ["sparring"],              None),
    ("Kiều Thị Uyên",    date(2003, 11, 30),"F", "079200001020", "0901111020", "Lam đai II",         51.0, 5, "pho_thong",  "4",  ["sparring"],              None),
]

# ── Name pools ────────────────────────────────────────────────────────────────

_HO_M = [
    "Nguyễn Văn", "Trần Văn", "Lê Văn", "Phạm Văn", "Hoàng Văn",
    "Vũ Văn", "Đặng Văn", "Bùi Văn", "Ngô Văn", "Đinh Văn",
    "Trương Văn", "Lý Văn", "Phan Văn", "Tô Văn", "Cao Văn",
    "Mai Văn", "Dương Văn", "Hồ Văn", "Lưu Văn", "Kiều Văn",
]
_HO_F = [
    "Nguyễn Thị", "Trần Thị", "Lê Thị", "Phạm Thị", "Hoàng Thị",
    "Vũ Thị", "Đặng Thị", "Bùi Thị", "Ngô Thị", "Đinh Thị",
    "Trương Thị", "Lý Thị", "Phan Thị", "Tô Thị", "Cao Thị",
    "Mai Thị", "Dương Thị", "Hồ Thị", "Lưu Thị", "Kiều Thị",
]
_TEN_M = [
    "An", "Bình", "Cường", "Dũng", "Giang", "Hùng", "Khoa", "Long",
    "Minh", "Nam", "Phúc", "Quân", "Rạng", "Sơn", "Tuấn", "Vinh",
    "Xuân", "Ân", "Bảo", "Chiến",
]
_TEN_F = [
    "Anh", "Bình", "Chi", "Dung", "Phương", "Hoa", "Kim", "Lan",
    "Mai", "Ngọc", "Oanh", "Quỳnh", "Sen", "Uyên", "Vân", "Yến",
    "Xuân", "Linh", "Như", "Thảo",
]


def _gen_name(gender: str, idx: int) -> str:
    if gender == "M":
        ho  = _HO_M[idx % len(_HO_M)]
        ten = _TEN_M[(idx // len(_HO_M)) % len(_TEN_M)]
    else:
        ho  = _HO_F[idx % len(_HO_F)]
        ten = _TEN_F[(idx // len(_HO_F)) % len(_TEN_F)]
    return f"{ho} {ten}"


# ── Student specs: (category, loai, gender, [weight_kg values]) ───────────────
# Covers ALL loai of phong_trao (1A,1B,2,3,4,5) and pho_thong (1,2,3,4).

STUDENT_SPECS = [
    # ── PHONG TRÀO ──────────────────────────────────────────────────────────
    # Loại 1A — Dưới 4 tuổi
    ("phong_trao", "1A", "M", [15, 20]),
    ("phong_trao", "1A", "F", [15, 20]),
    # Loại 1B — 4–6 tuổi
    ("phong_trao", "1B", "M", [20, 25, 30]),
    ("phong_trao", "1B", "F", [20, 25, 30]),
    # Loại 2 — 7–9 tuổi
    ("phong_trao", "2",  "M", [25, 30, 35, 40]),
    ("phong_trao", "2",  "F", [25, 30, 35]),
    # Loại 3 — 10–12 tuổi
    ("phong_trao", "3",  "M", [35, 40, 45, 50]),
    ("phong_trao", "3",  "F", [30, 35, 40, 45]),
    # Loại 4 — 18–25 tuổi đối kháng (dùng hạng cân chuẩn)
    # Mỗi hạng cân có số lượng khác nhau để test sơ đồ 8/10/12/14/16 VĐV
    ("phong_trao", "4",  "M", [48, 54, 60, 68, 77]),
    ("phong_trao", "4",  "F", [45, 51, 57, 63]),
    # Loại 5 — 18–35 tuổi quyền
    ("phong_trao", "5",  "M", [54, 60, 68]),
    ("phong_trao", "5",  "F", [48, 54, 60]),

    # ── PHỔ THÔNG ───────────────────────────────────────────────────────────
    # Loại 1 — Phổ thông chung
    ("pho_thong",  "1",  "M", [48, 54, 60]),
    ("pho_thong",  "1",  "F", [45, 51]),
    # Loại 2 — Cấp 2 (lớp 6–9), 11–15 tuổi
    ("pho_thong",  "2",  "M", [35, 40, 45, 50]),
    ("pho_thong",  "2",  "F", [30, 35, 40, 45]),
    # Loại 3 — Cấp 3 (lớp 10–12), 15–18 tuổi
    ("pho_thong",  "3",  "M", [45, 51, 57, 60]),
    ("pho_thong",  "3",  "F", [42, 48, 54]),
    # Loại 4 — 18–25 tuổi (dùng hạng cân chuẩn)
    ("pho_thong",  "4",  "M", [48, 54, 60, 68]),
    ("pho_thong",  "4",  "F", [45, 51, 57, 63]),
]

# Override số lượng VĐV cho từng hạng cân (mục đích test sơ đồ đa dạng)
# phong_trao loại 4 Nam: 5 hạng cân với 8/10/12/14/16 VĐV
_SLOT_COUNT: dict[tuple, int] = {
    ("phong_trao", "4", "M", 48): 8,
    ("phong_trao", "4", "M", 54): 10,
    ("phong_trao", "4", "M", 60): 12,
    ("phong_trao", "4", "M", 68): 14,
    ("phong_trao", "4", "M", 77): 16,
}

# DOB year ranges by (category, loai)
_DOB_RANGES: dict[tuple, tuple] = {
    ("phong_trao", "1A"): (2022, 2025),
    ("phong_trao", "1B"): (2019, 2021),
    ("phong_trao", "2"):  (2016, 2018),
    ("phong_trao", "3"):  (2013, 2015),
    ("phong_trao", "4"):  (2001, 2008),
    ("phong_trao", "5"):  (1991, 2008),
    ("pho_thong",  "1"):  (2000, 2010),
    ("pho_thong",  "2"):  (2010, 2014),
    ("pho_thong",  "3"):  (2007, 2010),
    ("pho_thong",  "4"):  (2001, 2008),
}

_BELTS: dict[str, list[str]] = {
    "1A": ["Lam đai nhập môn"],
    "1B": ["Lam đai nhập môn"],
    "2":  ["Lam đai nhập môn", "Lam đai I"],
    "3":  ["Lam đai I", "Lam đai II"],
    "4":  ["Lam đai III", "Chuẩn Hoàng đai", "Hoàng đai", "Hoàng đai I"],
    "5":  ["Lam đai III", "Chuẩn Hoàng đai", "Hoàng đai"],
}

# Default số lượng VĐV mỗi slot
_PER_SLOT = 4

# Nội dung thi đấu theo loại
_QUYEN_EVENTS = ["don_luyen", "song_luyen"]
_QUYEN_LOAI  = {"5"}   # phong_trao loại 5 là quyền


async def _clear_students_and_tournaments(db) -> None:
    """Xóa toàn bộ student/tournament data theo thứ tự tránh FK violation."""
    await db.execute(delete(StudentContestSelection))
    await db.execute(delete(StudentWeightAssignment))
    await db.execute(delete(BracketMatch))
    await db.execute(delete(TournamentParticipant))
    await db.execute(delete(TournamentKata))
    await db.execute(delete(TournamentStructureNode))
    await db.execute(delete(TournamentWeightClass))
    await db.execute(delete(Tournament))
    await db.execute(delete(StudentClub))
    await db.execute(delete(Student))
    await db.flush()
    print("🗑  Đã xóa toàn bộ student + tournament data")


async def seed(reset: bool = False):
    rng = random.Random(2026)

    async with AsyncSessionLocal() as db:

        # ── Provinces ─────────────────────────────────────────────────────────
        existing_pids = set(
            (await db.execute(select(Province.id))).scalars().all()
        )
        new_provinces = [(pid, name, code) for pid, name, code in PROVINCES if pid not in existing_pids]
        if new_provinces:
            for pid, name, code in new_provinces:
                db.add(Province(id=pid, name=name, code=code))
            await db.flush()
            print(f"✅ Provinces seeded ({len(new_provinces)} added)")

        # ── Clubs ──────────────────────────────────────────────────────────────
        if not (await db.execute(select(Club).limit(1))).scalar_one_or_none():
            for code, name, prov_id, address in CLUBS:
                db.add(Club(code=code, name=name, province_id=prov_id, address=address))
            await db.flush()
            print("✅ Clubs seeded")

        clubs     = (await db.execute(select(Club).order_by(Club.id))).scalars().all()
        club_ids  = [c.id for c in clubs]

        # ── Sample users (all roles) ───────────────────────────────────────────
        sample_users = [
            # (username, password,      full_name,              email,                         role,      club_idx_or_none)
            ("admin",    "Admin@123",   "Quản trị viên",        "admin@vovinam.vn",            "admin",   None),
            ("viewer",   "Viewer@123",  "Người xem",            "viewer@vovinam.vn",           "viewer",  None),
            ("referee1", "Referee@123", "Trọng tài Nguyễn Văn A","referee1@vovinam.vn",        "referee", None),
            ("referee2", "Referee@123", "Trọng tài Trần Thị B",  "referee2@vovinam.vn",        "referee", None),
            ("club1",    "Club@123",    "HLV CLB Quận 1",       "club1@vovinam.vn",            "club",    0),
            ("club2",    "Club@123",    "HLV CLB Bình Thạnh",   "club2@vovinam.vn",            "club",    1),
        ]
        for username, password, full_name, email, role, cidx in sample_users:
            if not (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
                db.add(User(
                    username=username,
                    password_hash=hash_password(password),
                    full_name=full_name,
                    email=email,
                    role=role,
                    club_id=club_ids[cidx] if cidx is not None else None,
                ))
                await db.flush()
                print(f"✅ User: {username} / {password}  [{role}]")

        # ── Reset nếu có flag --reset ──────────────────────────────────────────
        if reset:
            await _clear_students_and_tournaments(db)

        # ── Demo students (original 20) ────────────────────────────────────────
        if not (await db.execute(select(Student).limit(1))).scalar_one_or_none():
            for i, (name, dob, gender, cccd, phone, belt, weight, club_idx,
                    cat_type, cat_loai, events, quyen_sel) in enumerate(STUDENTS_DEMO, 1):
                s = Student(
                    code=f"MS-{i:05d}", full_name=name, date_of_birth=dob,
                    gender=gender, id_number=cccd, phone=phone,
                    current_belt=belt, join_date=date(2020, 1, 1),
                    weight_class=weight, status="active",
                    category_type=cat_type,
                    category_loai=cat_loai,
                    compete_events=events,
                    quyen_selections=quyen_sel,
                )
                db.add(s)
                await db.flush()
                db.add(StudentClub(
                    student_id=s.id,
                    club_id=club_ids[(club_idx - 1) % len(club_ids)],
                    joined_at=date(2020, 1, 1), is_current=True,
                ))
            print(f"✅ {len(STUDENTS_DEMO)} demo students seeded")

        # ── Tournament (chỉ seed nếu chưa có tournament nào) ─────────────────
        has_tournament = (await db.execute(
            select(Tournament).limit(1)
        )).scalar_one_or_none()

        if not has_tournament:

            # ── Generate tournament students from STUDENT_SPECS ────────────────
            existing_cccds = set(
                r[0] for r in (await db.execute(select(Student.id_number))).all()
            )
            ts_counter = 1
            student_created = 0
            name_counters: dict[str, int] = {"M": 0, "F": 0}

            for (cat, loai, gender, weights) in STUDENT_SPECS:
                dob_min_y, dob_max_y = _DOB_RANGES[(cat, loai)]
                belt_pool = _BELTS.get(loai, ["Lam đai nhập môn"])
                is_quyen  = (loai in _QUYEN_LOAI)

                for wkg in weights:
                    count = _SLOT_COUNT.get((cat, loai, gender, wkg), _PER_SLOT)

                    for j in range(count):
                        # Unique name
                        full_name = _gen_name(gender, name_counters[gender])
                        name_counters[gender] += 1

                        # Unique CCCD (12 digits)
                        cccd = f"079{ts_counter + 200000000:09d}"
                        while cccd in existing_cccds:
                            ts_counter += 1
                            cccd = f"079{ts_counter + 200000000:09d}"
                        existing_cccds.add(cccd)

                        dob_year  = rng.randint(dob_min_y, dob_max_y)
                        dob_month = rng.randint(1, 12)
                        dob_day   = rng.randint(1, 28)
                        dob = date(dob_year, dob_month, dob_day)

                        belt     = belt_pool[j % len(belt_pool)]
                        club_id  = rng.choice(club_ids)

                        if is_quyen:
                            # Loại 5: quyền — gán sự kiện và bài quyền ngẫu nhiên
                            quyen_events = rng.sample(_QUYEN_EVENTS, rng.randint(1, 2))
                            quyen_sel    = rng.sample(QUYEN_BAI_LIST, rng.randint(1, 2))
                        else:
                            quyen_events = ["sparring"]
                            quyen_sel    = None

                        s = Student(
                            code=f"TS-{ts_counter:05d}",
                            full_name=full_name,
                            date_of_birth=dob,
                            gender=gender,
                            id_number=cccd,
                            phone=f"09{(ts_counter + 10000000) % 100000000:08d}",
                            current_belt=belt,
                            join_date=date(2024, 1, 1),
                            weight_class=Decimal(str(wkg)),
                            category_type=cat,
                            category_loai=loai,
                            status="active",
                            compete_events=quyen_events,
                            quyen_selections=quyen_sel,
                        )
                        db.add(s)
                        await db.flush()
                        db.add(StudentClub(
                            student_id=s.id, club_id=club_id,
                            joined_at=date(2024, 1, 1), is_current=True,
                        ))
                        ts_counter    += 1
                        student_created += 1

            await db.flush()
            print(f"✅ {student_created} tournament students seeded")
            print(f"   phong_trao loại 4 Nam: 48kg=8, 54kg=10, 60kg=12, 68kg=14, 77kg=16 VĐV")

            # ── Build tournament weight classes from actual student data ────────
            groups = (await db.execute(
                select(
                    Student.gender,
                    Student.category_type,
                    Student.category_loai,
                    Student.weight_class,
                    func.array_agg(Student.id).label("student_ids"),
                    func.array_agg(Student.full_name).label("names"),
                )
                .where(
                    Student.status == "active",
                    Student.category_type.isnot(None),
                    Student.category_loai.isnot(None),
                    Student.weight_class.isnot(None),
                )
                .group_by(
                    Student.gender,
                    Student.category_type,
                    Student.category_loai,
                    Student.weight_class,
                )
                .order_by(
                    Student.gender,
                    Student.category_type,
                    Student.category_loai,
                    Student.weight_class,
                )
            )).all()

            tournament = Tournament(
                name="Giải Vovinam Lương Tài Mở Rộng 2026",
                status="DRAFT",
                structure_mode="dynamic",
            )
            db.add(tournament)
            await db.flush()
            tid = tournament.id

            wc_created = 0
            participant_created = 0

            for gender, cat, loai, wc_val, student_ids, names in groups:
                wc_name = f"{int(wc_val)}kg"

                # Shuffle for random bracket seeding
                paired = list(zip(student_ids, names))
                rng.shuffle(paired)
                shuffled_ids, shuffled_names = zip(*paired) if paired else ([], [])

                wc = TournamentWeightClass(
                    tournament_id=tid,
                    category=cat,
                    age_type_code=loai,
                    weight_class_name=wc_name,
                    gender=gender,
                    total_players=len(student_ids),
                    bracket_status="NOT_GENERATED",
                    players=list(shuffled_names),
                )
                db.add(wc)
                await db.flush()

                for sid in shuffled_ids:
                    db.add(TournamentParticipant(
                        weight_class_id=wc.id,
                        student_id=sid,
                    ))
                wc_created += 1
                participant_created += len(student_ids)

            await db.flush()
            print(f"✅ Tournament 'Giải Vovinam Lương Tài Mở Rộng 2026' created")
            print(f"   {wc_created} brackets  |  {participant_created} participants")
            print(f"   Cấu trúc: phong_trao (1A/1B/2/3/4/5) + pho_thong (1/2/3/4) × Nam/Nữ")

            # ── Seed tree structure nodes ──────────────────────────────────────
            # Map (category_type, loai) → display name
            CATEGORY_NAME = {"phong_trao": "Phong Trào", "pho_thong": "Phổ Thông"}
            LOAI_NAME: dict[tuple, str] = {
                ("phong_trao", "1A"): "Loại 1A", ("phong_trao", "1B"): "Loại 1B",
                ("phong_trao", "2"):  "Loại 2",   ("phong_trao", "3"):  "Loại 3",
                ("phong_trao", "4"):  "Loại 4",   ("phong_trao", "5"):  "Loại 5",
                ("pho_thong",  "1"):  "Loại 1",   ("pho_thong",  "2"):  "Loại 2",
                ("pho_thong",  "3"):  "Loại 3",   ("pho_thong",  "4"):  "Loại 4",
            }
            GENDER_NAME = {"M": "Nam", "F": "Nữ"}

            # Build tree spec from STUDENT_SPECS
            # tree_spec: {gender: {cat: {loai: [weights]}}}
            tree_spec: dict = {}
            for cat, loai, gender, weights in STUDENT_SPECS:
                tree_spec.setdefault(gender, {}).setdefault(cat, {}).setdefault(loai, set()).update(weights)

            # node_lookup: (gender, cat, loai, weight_name) -> node.id
            node_lookup: dict[tuple, int] = {}

            # node_code mapping cho level 2 (nhóm tuổi) — dùng rule_json để lưu khoảng tuổi
            LOAI_RULES: dict[tuple, dict] = {
                ("phong_trao", "1A"): {"min_age": 0,  "max_age": 3},
                ("phong_trao", "1B"): {"min_age": 4,  "max_age": 6},
                ("phong_trao", "2"):  {"min_age": 7,  "max_age": 9},
                ("phong_trao", "3"):  {"min_age": 10, "max_age": 12},
                ("phong_trao", "4"):  {"min_age": 18, "max_age": 25},
                ("phong_trao", "5"):  {"min_age": 18, "max_age": 35},
                ("pho_thong",  "1"):  {},
                ("pho_thong",  "2"):  {"min_age": 11, "max_age": 15},
                ("pho_thong",  "3"):  {"min_age": 15, "max_age": 18},
                ("pho_thong",  "4"):  {"min_age": 18, "max_age": 25},
            }

            gender_order = 1
            for gender in ["M", "F"]:
                if gender not in tree_spec:
                    continue
                g_node = TournamentStructureNode(
                    tournament_id=tid, parent_id=None, level=0,
                    name=GENDER_NAME[gender],
                    node_code=gender,   # "M" hoặc "F" — machine-readable
                    sort_order=gender_order,
                )
                db.add(g_node)
                await db.flush()
                gender_order += 1

                cat_order = 1
                for cat in ["phong_trao", "pho_thong"]:
                    if cat not in tree_spec[gender]:
                        continue
                    c_node = TournamentStructureNode(
                        tournament_id=tid, parent_id=g_node.id, level=1,
                        name=CATEGORY_NAME[cat],
                        node_code=cat,  # "phong_trao" hoặc "pho_thong"
                        sort_order=cat_order,
                    )
                    db.add(c_node)
                    await db.flush()
                    cat_order += 1

                    loai_order = 1
                    for loai in ["1A", "1B", "1", "2", "3", "4", "5"]:
                        if loai not in tree_spec[gender][cat]:
                            continue
                        loai_name = LOAI_NAME.get((cat, loai), f"Loại {loai}")
                        loai_rules = LOAI_RULES.get((cat, loai), {})
                        l_node = TournamentStructureNode(
                            tournament_id=tid, parent_id=c_node.id, level=2,
                            name=loai_name,
                            node_code=loai,         # "1A", "1B", "4", "5", ...
                            rule_json=loai_rules,   # min_age, max_age
                            sort_order=loai_order,
                        )
                        db.add(l_node)
                        await db.flush()
                        loai_order += 1

                        wc_order = 1
                        for wkg in sorted(tree_spec[gender][cat][loai]):
                            wc_name = f"{wkg}kg"
                            w_node = TournamentStructureNode(
                                tournament_id=tid, parent_id=l_node.id, level=3,
                                name=wc_name,
                                node_code=str(wkg),                     # "45", "54", ...
                                rule_json={"max_weight_kg": float(wkg)}, # eligibility rule
                                sort_order=wc_order,
                            )
                            db.add(w_node)
                            await db.flush()
                            node_lookup[(gender, cat, loai, wc_name)] = w_node.id
                            wc_order += 1

            await db.flush()
            print(f"✅ Tree structure seeded ({len(node_lookup)} leaf nodes)")

            # ── Seed TournamentKata ────────────────────────────────────────────
            kata_id_map: dict[str, int] = {}
            for i, kata_name in enumerate(QUYEN_BAI_LIST, 1):
                kt = TournamentKata(
                    tournament_id=tid, name=kata_name,
                    description=None, sort_order=i,
                )
                db.add(kt)
                await db.flush()
                kata_id_map[kata_name] = kt.id
            print(f"✅ {len(QUYEN_BAI_LIST)} katas seeded")

            # ── Seed StudentWeightAssignment + StudentContestSelection ─────────
            all_participants = (await db.execute(
                select(TournamentParticipant, TournamentWeightClass, Student)
                .join(TournamentWeightClass, TournamentParticipant.weight_class_id == TournamentWeightClass.id)
                .join(Student, TournamentParticipant.student_id == Student.id)
                .where(TournamentWeightClass.tournament_id == tid)
            )).all()

            assigned = 0
            for part, wc, student in all_participants:
                gender_code = student.gender  # "M" or "F"
                cat          = wc.category        # "phong_trao"
                loai         = wc.age_type_code   # "1A"
                wc_name      = wc.weight_class_name  # "45kg"

                node_id = node_lookup.get((gender_code, cat, loai, wc_name))
                if node_id is None:
                    continue  # skip if no matching tree node

                db.add(StudentWeightAssignment(
                    student_id=student.id,
                    tournament_id=tid,
                    node_id=node_id,
                    reason="registered",
                ))
                await db.flush()

                # Contest selections
                events = student.compete_events or []
                quyen_sel = student.quyen_selections or []

                if "sparring" in events:
                    db.add(StudentContestSelection(
                        student_id=student.id, tournament_id=tid,
                        contest_type="sparring", kata_id=None,
                    ))

                for kata_name in quyen_sel:
                    kid = kata_id_map.get(kata_name)
                    if kid:
                        db.add(StudentContestSelection(
                            student_id=student.id, tournament_id=tid,
                            contest_type="kata", kata_id=kid,
                        ))
                await db.flush()
                assigned += 1

            print(f"✅ {assigned} student weight assignments seeded")

        await db.commit()
        print("\n🎉 Seed hoàn tất!")
        print("   Frontend : http://localhost:5174")
        print("   API docs : http://localhost:8001/docs")
        print("   Tài khoản:")
        print("     admin    / Admin@123   [admin]")
        print("     viewer   / Viewer@123  [viewer]")
        print("     referee1 / Referee@123 [referee]")
        print("     referee2 / Referee@123 [referee]")
        print("     club1    / Club@123    [club]")
        print("     club2    / Club@123    [club]")


if __name__ == "__main__":
    do_reset = "--reset" in sys.argv
    if do_reset:
        print("⚠️  Chế độ RESET: xóa toàn bộ student + tournament data trước khi seed lại")
    asyncio.run(seed(reset=do_reset))
