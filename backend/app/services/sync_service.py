"""
Sync service: pull match data from Railway DB → local DB before match starts,
and push results back to Railway after confirm.
Only used by api-local (ENVIRONMENT=development with RAILWAY_DATABASE_URL set).
"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, text
from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton engine — reuses connections across calls (avoids 2500ms handshake per sync)
_railway_engine = None

def _get_railway_engine():
    global _railway_engine
    if not settings.railway_database_url:
        raise RuntimeError("RAILWAY_DATABASE_URL not configured")
    if _railway_engine is None:
        _railway_engine = create_async_engine(
            settings.railway_database_url,
            pool_size=2,
            max_overflow=0,
            pool_pre_ping=True,
            pool_recycle=300,  # recycle connections every 5 min
        )
    return _railway_engine


async def sync_match_from_railway(match_id: int, local_db: AsyncSession) -> None:
    """
    Pull all data needed for match_id from Railway DB into local DB.
    Uses raw SQL UPSERT to avoid ORM relationship complexity.
    """
    engine = _get_railway_engine()
    try:
        async with engine.connect() as rconn:
            # --- BracketMatch ---
            row = (await rconn.execute(
                text("SELECT * FROM bracket_matches WHERE id = :id"),
                {"id": match_id}
            )).mappings().first()
            if not row:
                raise ValueError(f"Match {match_id} not found in Railway DB")
            match = dict(row)

            # --- TournamentWeightClass (parent of match) ---
            wc_row = (await rconn.execute(
                text("SELECT * FROM tournament_weight_classes WHERE id = :id"),
                {"id": match["weight_class_id"]}
            )).mappings().first()
            wc = dict(wc_row) if wc_row else None

            # --- Tournament ---
            tournament = None
            if wc:
                t_row = (await rconn.execute(
                    text("SELECT * FROM tournaments WHERE id = :id"),
                    {"id": wc["tournament_id"]}
                )).mappings().first()
                tournament = dict(t_row) if t_row else None

            # --- BracketJudgeAssignments ---
            judge_rows = (await rconn.execute(
                text("SELECT * FROM bracket_judge_assignments WHERE match_id = :id"),
                {"id": match_id}
            )).mappings().all()
            judges = [dict(r) for r in judge_rows]

            # --- Users for judges ---
            judge_user_ids = [j["judge_user_id"] for j in judges if j.get("judge_user_id")]
            users = []
            if judge_user_ids:
                user_rows = (await rconn.execute(
                    text("SELECT * FROM users WHERE id = ANY(:ids)"),
                    {"ids": judge_user_ids}
                )).mappings().all()
                users = [dict(r) for r in user_rows]

            # --- Avatar URLs and Club names for the 2 players ---
            avatar_map: dict[str, str | None] = {}
            club_map: dict[str, str | None] = {}
            player_names = [n for n in [match.get("player1_name"), match.get("player2_name")] if n]
            if player_names and match.get("weight_class_id"):
                player_rows = (await rconn.execute(
                    text("""
                        SELECT DISTINCT s.full_name, s.avatar_url, c.name AS club_name
                        FROM students s
                        JOIN tournament_participants tp ON tp.student_id = s.id
                        LEFT JOIN student_clubs sc ON sc.student_id = s.id AND sc.is_current = TRUE
                        LEFT JOIN clubs c ON c.id = sc.club_id
                        WHERE tp.weight_class_id = :wc_id
                          AND s.full_name = ANY(:names)
                    """),
                    {"wc_id": match["weight_class_id"], "names": player_names}
                )).mappings().all()
                for r in player_rows:
                    name = r["full_name"]
                    if name not in avatar_map:
                        avatar_map[name] = r["avatar_url"]
                    if name not in club_map:
                        club_map[name] = r["club_name"]

        # engine is singleton — do not dispose

        # --- Upsert into local DB ---
        # Tournament
        if tournament:
            await local_db.execute(text("""
                INSERT INTO tournaments (id, name, sport_icon, status, structure_mode, created_at)
                VALUES (:id, :name, :sport_icon, :status, :structure_mode, :created_at)
                ON CONFLICT (id) DO UPDATE SET
                    name=EXCLUDED.name, status=EXCLUDED.status
            """), tournament)

        # TournamentWeightClass — set node_id=NULL (structure nodes not synced locally)
        if wc:
            wc_local = {**wc, "node_id": None}
            await local_db.execute(text("""
                INSERT INTO tournament_weight_classes
                    (id, tournament_id, node_id, category, age_type_code, weight_class_name, gender, total_players, bracket_status, players)
                VALUES (:id, :tournament_id, :node_id, :category, :age_type_code, :weight_class_name, :gender, :total_players, :bracket_status, :players)
                ON CONFLICT (id) DO UPDATE SET
                    weight_class_name=EXCLUDED.weight_class_name,
                    total_players=EXCLUDED.total_players,
                    bracket_status=EXCLUDED.bracket_status
            """), wc_local)

        # Users — only sync fields that exist in local schema
        for u in users:
            u_local = {
                "id": u["id"],
                "username": u["username"],
                "password_hash": u.get("password_hash") or u.get("hashed_password", ""),
                "full_name": u.get("full_name") or u["username"],
                "email": u.get("email") or f"{u['username']}@sync.local",
                "role": u["role"],
                "club_id": u.get("club_id"),
                "created_at": u.get("created_at"),
            }
            await local_db.execute(text("""
                INSERT INTO users (id, username, password_hash, full_name, email, role, club_id, created_at)
                VALUES (:id, :username, :password_hash, :full_name, :email, :role, :club_id, :created_at)
                ON CONFLICT (id) DO UPDATE SET
                    username=EXCLUDED.username, full_name=EXCLUDED.full_name, role=EXCLUDED.role
            """), u_local)

        # BracketMatch — nullify next_match_id (referenced match may not exist locally)
        match["next_match_id"] = None
        match["player1_avatar_url"] = avatar_map.get(match.get("player1_name"))
        match["player2_avatar_url"] = avatar_map.get(match.get("player2_name"))
        match["player1_club"] = club_map.get(match.get("player1_name"))
        match["player2_club"] = club_map.get(match.get("player2_name"))
        await local_db.execute(text("""
            INSERT INTO bracket_matches
                (id, weight_class_id, round, match_number, match_code, court, schedule_order,
                 player1_name, player2_name, player1_avatar_url, player2_avatar_url,
                 player1_club, player2_club,
                 score1, score2, winner, status, is_bye,
                 next_match_id, current_hiep, match_phase, round_duration_seconds, break_duration_seconds,
                 started_at, finished_at)
            VALUES
                (:id, :weight_class_id, :round, :match_number, :match_code, :court, :schedule_order,
                 :player1_name, :player2_name, :player1_avatar_url, :player2_avatar_url,
                 :player1_club, :player2_club,
                 :score1, :score2, :winner, :status, :is_bye,
                 :next_match_id, :current_hiep, :match_phase, :round_duration_seconds, :break_duration_seconds,
                 :started_at, :finished_at)
            ON CONFLICT (id) DO UPDATE SET
                player1_name=EXCLUDED.player1_name,
                player2_name=EXCLUDED.player2_name,
                player1_avatar_url=EXCLUDED.player1_avatar_url,
                player2_avatar_url=EXCLUDED.player2_avatar_url,
                player1_club=EXCLUDED.player1_club,
                player2_club=EXCLUDED.player2_club,
                score1=EXCLUDED.score1,
                score2=EXCLUDED.score2,
                winner=EXCLUDED.winner,
                status=EXCLUDED.status,
                match_phase=EXCLUDED.match_phase,
                current_hiep=EXCLUDED.current_hiep,
                started_at=EXCLUDED.started_at,
                finished_at=EXCLUDED.finished_at,
                round_duration_seconds=EXCLUDED.round_duration_seconds,
                break_duration_seconds=EXCLUDED.break_duration_seconds
        """), match)

        # BracketJudgeAssignments — upsert theo (match_id, judge_slot) để tránh id mismatch
        for j in judges:
            await local_db.execute(text("""
                INSERT INTO bracket_judge_assignments
                    (match_id, judge_slot, judge_user_id, ready_at, score1, score2, submitted_at, created_at, updated_at)
                VALUES
                    (:match_id, :judge_slot, :judge_user_id, :ready_at, :score1, :score2, :submitted_at, :created_at, :updated_at)
                ON CONFLICT ON CONSTRAINT uq_bracket_judge_assignments_match_judge_slot DO UPDATE SET
                    judge_user_id=EXCLUDED.judge_user_id,
                    ready_at=EXCLUDED.ready_at,
                    score1=EXCLUDED.score1,
                    score2=EXCLUDED.score2,
                    submitted_at=EXCLUDED.submitted_at,
                    updated_at=EXCLUDED.updated_at
            """), j)

        await local_db.commit()
        logger.info(f"[sync] Match {match_id} synced from Railway to local DB")

    except Exception as e:
        await local_db.rollback()
        logger.error(f"[sync] Failed to sync match {match_id}: {e}")
        raise


async def sync_tournament_matches_from_railway(
    tournament_id: int,
    local_db: AsyncSession,
    page: int = 1,
    size: int = 20,
) -> dict:
    """
    Pull bracket matches of a tournament from Railway DB → local DB, paginated by match.
    Page 1 also syncs tournament, weight classes, and users.
    Returns { synced_count, total, has_more }.
    """
    engine = _get_railway_engine()
    offset = (page - 1) * size
    try:
        async with engine.connect() as rconn:
            # --- Tournament ---
            t_row = (await rconn.execute(
                text("SELECT * FROM tournaments WHERE id = :id"),
                {"id": tournament_id}
            )).mappings().first()
            if not t_row:
                raise ValueError(f"Tournament {tournament_id} not found in Railway DB")
            tournament = dict(t_row)

            # --- Weight classes ---
            wc_rows = (await rconn.execute(
                text("SELECT * FROM tournament_weight_classes WHERE tournament_id = :tid"),
                {"tid": tournament_id}
            )).mappings().all()
            wcs = [dict(r) for r in wc_rows]
            wc_ids = [w["id"] for w in wcs]

            # --- Total match count ---
            total = 0
            matches: list[dict] = []
            if wc_ids:
                total_row = (await rconn.execute(
                    text("""
                        SELECT COUNT(*) FROM bracket_matches
                        WHERE weight_class_id = ANY(:ids)
                          AND status NOT IN ('ongoing', 'completed')
                    """),
                    {"ids": wc_ids}
                )).scalar()
                total = int(total_row or 0)

                match_rows = (await rconn.execute(
                    text("""
                        SELECT * FROM bracket_matches
                        WHERE weight_class_id = ANY(:ids)
                          AND status NOT IN ('ongoing', 'completed')
                        ORDER BY id
                        LIMIT :limit OFFSET :offset
                    """),
                    {"ids": wc_ids, "limit": size, "offset": offset}
                )).mappings().all()
                matches = [dict(r) for r in match_rows]

            match_ids = [m["id"] for m in matches]

            # --- Judge assignments for this page ---
            judges: list[dict] = []
            if match_ids:
                judge_rows = (await rconn.execute(
                    text("SELECT * FROM bracket_judge_assignments WHERE match_id = ANY(:ids)"),
                    {"ids": match_ids}
                )).mappings().all()
                judges = [dict(r) for r in judge_rows]

            # --- Users for judges ---
            judge_user_ids = list({j["judge_user_id"] for j in judges if j.get("judge_user_id")})
            users: list[dict] = []
            if judge_user_ids:
                user_rows = (await rconn.execute(
                    text("SELECT * FROM users WHERE id = ANY(:ids)"),
                    {"ids": judge_user_ids}
                )).mappings().all()
                users = [dict(r) for r in user_rows]

            # --- Avatar URLs and Club names for all players in this page ---
            all_player_names = list({
                n for m in matches
                for n in [m.get("player1_name"), m.get("player2_name")] if n
            })
            bulk_avatar_map: dict[str, str | None] = {}
            bulk_club_map: dict[str, str | None] = {}
            if all_player_names and wc_ids:
                player_rows = (await rconn.execute(
                    text("""
                        SELECT DISTINCT s.full_name, s.avatar_url, c.name AS club_name
                        FROM students s
                        JOIN tournament_participants tp ON tp.student_id = s.id
                        LEFT JOIN student_clubs sc ON sc.student_id = s.id AND sc.is_current = TRUE
                        LEFT JOIN clubs c ON c.id = sc.club_id
                        WHERE tp.weight_class_id = ANY(:wc_ids)
                          AND s.full_name = ANY(:names)
                    """),
                    {"wc_ids": wc_ids, "names": all_player_names}
                )).mappings().all()
                for r in player_rows:
                    name = r["full_name"]
                    if name not in bulk_avatar_map:
                        bulk_avatar_map[name] = r["avatar_url"]
                    if name not in bulk_club_map:
                        bulk_club_map[name] = r["club_name"]

        # --- Upsert into local DB ---
        # Tournament + weight classes only on page 1 (avoid redundant upserts)
        if page == 1:
            await local_db.execute(text("""
                INSERT INTO tournaments (id, name, sport_icon, status, structure_mode, created_at)
                VALUES (:id, :name, :sport_icon, :status, :structure_mode, :created_at)
                ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status
            """), tournament)

            for wc in wcs:
                wc_local = {**wc, "node_id": None}
                await local_db.execute(text("""
                    INSERT INTO tournament_weight_classes
                        (id, tournament_id, node_id, category, age_type_code, weight_class_name, gender, total_players, bracket_status, players)
                    VALUES (:id, :tournament_id, :node_id, :category, :age_type_code, :weight_class_name, :gender, :total_players, :bracket_status, :players)
                    ON CONFLICT (id) DO UPDATE SET
                        weight_class_name=EXCLUDED.weight_class_name,
                        total_players=EXCLUDED.total_players,
                        bracket_status=EXCLUDED.bracket_status
                """), wc_local)

        for u in users:
            u_local = {
                "id": u["id"],
                "username": u["username"],
                "password_hash": u.get("password_hash") or u.get("hashed_password", ""),
                "full_name": u.get("full_name") or u["username"],
                "email": u.get("email") or f"{u['username']}@sync.local",
                "role": u["role"],
                "club_id": u.get("club_id"),
                "created_at": u.get("created_at"),
            }
            await local_db.execute(text("""
                INSERT INTO users (id, username, password_hash, full_name, email, role, club_id, created_at)
                VALUES (:id, :username, :password_hash, :full_name, :email, :role, :club_id, :created_at)
                ON CONFLICT (id) DO UPDATE SET
                    username=EXCLUDED.username, full_name=EXCLUDED.full_name, role=EXCLUDED.role
            """), u_local)

        for match in matches:
            match["next_match_id"] = None
            match["player1_avatar_url"] = bulk_avatar_map.get(match.get("player1_name"))
            match["player2_avatar_url"] = bulk_avatar_map.get(match.get("player2_name"))
            match["player1_club"] = bulk_club_map.get(match.get("player1_name"))
            match["player2_club"] = bulk_club_map.get(match.get("player2_name"))
            await local_db.execute(text("""
                INSERT INTO bracket_matches
                    (id, weight_class_id, round, match_number, match_code, court, schedule_order,
                     player1_name, player2_name, player1_avatar_url, player2_avatar_url,
                     player1_club, player2_club,
                     score1, score2, winner, status, is_bye,
                     next_match_id, current_hiep, match_phase, round_duration_seconds, break_duration_seconds,
                     started_at, finished_at)
                VALUES
                    (:id, :weight_class_id, :round, :match_number, :match_code, :court, :schedule_order,
                     :player1_name, :player2_name, :player1_avatar_url, :player2_avatar_url,
                     :player1_club, :player2_club,
                     :score1, :score2, :winner, :status, :is_bye,
                     :next_match_id, :current_hiep, :match_phase, :round_duration_seconds, :break_duration_seconds,
                     :started_at, :finished_at)
                ON CONFLICT (id) DO UPDATE SET
                    player1_name=EXCLUDED.player1_name,
                    player2_name=EXCLUDED.player2_name,
                    player1_avatar_url=EXCLUDED.player1_avatar_url,
                    player2_avatar_url=EXCLUDED.player2_avatar_url,
                    player1_club=EXCLUDED.player1_club,
                    player2_club=EXCLUDED.player2_club,
                    score1=EXCLUDED.score1,
                    score2=EXCLUDED.score2,
                    winner=EXCLUDED.winner,
                    status=EXCLUDED.status,
                    match_phase=EXCLUDED.match_phase,
                    current_hiep=EXCLUDED.current_hiep,
                    started_at=EXCLUDED.started_at,
                    finished_at=EXCLUDED.finished_at,
                    round_duration_seconds=EXCLUDED.round_duration_seconds,
                    break_duration_seconds=EXCLUDED.break_duration_seconds
            """), match)

        for j in judges:
            await local_db.execute(text("""
                INSERT INTO bracket_judge_assignments
                    (match_id, judge_slot, judge_user_id, ready_at, score1, score2, submitted_at, created_at, updated_at)
                VALUES
                    (:match_id, :judge_slot, :judge_user_id, :ready_at, :score1, :score2, :submitted_at, :created_at, :updated_at)
                ON CONFLICT ON CONSTRAINT uq_bracket_judge_assignments_match_judge_slot DO UPDATE SET
                    judge_user_id=EXCLUDED.judge_user_id,
                    ready_at=EXCLUDED.ready_at,
                    score1=EXCLUDED.score1,
                    score2=EXCLUDED.score2,
                    submitted_at=EXCLUDED.submitted_at,
                    updated_at=EXCLUDED.updated_at
            """), j)

        await local_db.commit()
        synced_count = len(matches)
        has_more = (offset + synced_count) < total
        logger.info(f"[sync] Tournament {tournament_id} page {page}: synced {synced_count}/{total} matches")
        return {"synced_count": synced_count, "total": total, "has_more": has_more}

    except Exception as e:
        await local_db.rollback()
        logger.error(f"[sync] Failed to sync tournament {tournament_id} page {page}: {e}")
        raise


async def push_match_result_to_railway(match_id: int) -> None:
    """
    Push match result from local DB to Railway DB after confirm.
    Creates its own local DB session (safe for asyncio.create_task).
    Also propagates winner name to next_match slot in Railway.
    """
    from app.core.database import AsyncSessionLocal
    engine = _get_railway_engine()
    try:
        async with AsyncSessionLocal() as local_db:
            match_row = (await local_db.execute(
                text("""SELECT score1, score2, winner, status, match_phase, finished_at,
                             next_match_id, match_number, player1_name, player2_name
                        FROM bracket_matches WHERE id = :id"""),
                {"id": match_id}
            )).mappings().first()
            if not match_row:
                logger.error(f"[sync-push] Match {match_id} not found in local DB")
                return

            judge_rows = (await local_db.execute(
                text("SELECT judge_slot, score1, score2, submitted_at FROM bracket_judge_assignments WHERE match_id = :id"),
                {"id": match_id}
            )).mappings().all()

        async with engine.begin() as rconn:
            await rconn.execute(text("""
                UPDATE bracket_matches SET
                    score1=:score1, score2=:score2, winner=:winner,
                    status=:status, match_phase=:match_phase, finished_at=:finished_at
                WHERE id=:id
            """), {
                "score1": match_row["score1"],
                "score2": match_row["score2"],
                "winner": match_row["winner"],
                "status": match_row["status"],
                "match_phase": match_row["match_phase"],
                "finished_at": match_row["finished_at"],
                "id": match_id,
            })

            for j in judge_rows:
                await rconn.execute(text("""
                    UPDATE bracket_judge_assignments SET
                        score1=:score1, score2=:score2, submitted_at=:submitted_at
                    WHERE match_id=:match_id AND judge_slot=:judge_slot
                """), {**dict(j), "match_id": match_id})

            # Propagate winner name to next match slot in Railway
            # Read next_match_id from Railway (local always has next_match_id=NULL)
            r_row = (await rconn.execute(
                text("SELECT next_match_id, match_number FROM bracket_matches WHERE id = :id"),
                {"id": match_id}
            )).mappings().first()
            winner = match_row["winner"]
            if r_row and r_row["next_match_id"] and winner in (1, 2):
                next_match_id = r_row["next_match_id"]
                winner_name = match_row["player1_name"] if winner == 1 else match_row["player2_name"]
                match_number = r_row["match_number"]
                if match_number % 2 == 1:
                    await rconn.execute(text(
                        "UPDATE bracket_matches SET player1_name=:name WHERE id=:id"
                    ), {"name": winner_name, "id": next_match_id})
                else:
                    await rconn.execute(text(
                        "UPDATE bracket_matches SET player2_name=:name WHERE id=:id"
                    ), {"name": winner_name, "id": next_match_id})

        # engine is singleton — do not dispose
        logger.info(f"[sync-push] Match {match_id} result pushed to Railway")

    except Exception as e:
        logger.error(f"[sync-push] Failed to push match {match_id}: {e}")
        raise
