"""
Build tournament structure tree for tournament_id=1
"Giải Vovinam Lương Tài Mở Rộng 2026"

Structure:
  Level 0: Nam (id=3 existing), Nữ (create)
  Level 1: Phong trào, Phổ thông
  Level 2: Loại (1A/1B/2/3/4 for đối kháng, 5 for quyền in Phong trào; 1/2/3/4 in Phổ thông)
  Level 3: Leaf nodes
    - Đối kháng loại: weight classes ("48kg", "54kg", ...)
    - Quyền loại 5:   content names ("Đơn luyện", "Song luyện")
"""
import asyncio
import asyncpg

DSN = "postgresql://vovinam:vovinam123@postgres:5432/vovinam_db"
TID = 1      # tournament_id
NAM_ID = 3   # already in DB

# ── Tree: (name, children)
# Children of Nam and Nữ are built from data query above
# ─────────────────────────────────────────────────────────

NAM_CHILDREN = [
    ("Phong trào", [
        ("Loại 1A",          [("15kg",), ("20kg",), ("45kg",)]),
        ("Loại 1B",          [("20kg",), ("25kg",), ("30kg",)]),
        ("Loại 2",           [("25kg",), ("30kg",), ("35kg",), ("40kg",)]),
        ("Loại 3",           [("35kg",), ("40kg",), ("45kg",), ("50kg",)]),
        ("Loại 4",           [("48kg",), ("54kg",), ("60kg",), ("68kg",), ("77kg",)]),
        ("Loại 5 - Quyền",   [("Đơn luyện",), ("Song luyện",)]),
    ]),
    ("Phổ thông", [
        ("Loại 1",  [("48kg",), ("54kg",), ("60kg",)]),
        ("Loại 2",  [("35kg",), ("40kg",), ("45kg",), ("50kg",)]),
        ("Loại 3",  [("45kg",), ("51kg",), ("57kg",), ("60kg",)]),
        ("Loại 4",  [("48kg",), ("54kg",), ("60kg",), ("68kg",)]),
    ]),
]

NU_CHILDREN = [
    ("Phong trào", [
        ("Loại 1A",          [("15kg",), ("20kg",), ("45kg",)]),
        ("Loại 1B",          [("20kg",), ("25kg",), ("30kg",)]),
        ("Loại 2",           [("25kg",), ("30kg",), ("35kg",)]),
        ("Loại 3",           [("30kg",), ("35kg",), ("40kg",), ("45kg",)]),
        ("Loại 4",           [("45kg",), ("48kg",), ("51kg",), ("57kg",), ("63kg",)]),
        ("Loại 5 - Quyền",   [("Đơn luyện",), ("Song luyện",)]),
    ]),
    ("Phổ thông", [
        ("Loại 1",  [("45kg",), ("51kg",)]),
        ("Loại 2",  [("30kg",), ("35kg",), ("40kg",), ("45kg",)]),
        ("Loại 3",  [("42kg",), ("48kg",), ("54kg",)]),
        ("Loại 4",  [("45kg",), ("51kg",), ("57kg",), ("63kg",)]),
    ]),
]


async def upsert_node(conn, tid: int, parent_id: int | None, name: str, level: int, sort_order: int) -> int:
    """Insert or get existing node, return its id."""
    # Try to find existing
    if parent_id is None:
        existing = await conn.fetchval(
            "SELECT id FROM tournament_structure_nodes WHERE tournament_id=$1 AND parent_id IS NULL AND name=$2",
            tid, name,
        )
    else:
        existing = await conn.fetchval(
            "SELECT id FROM tournament_structure_nodes WHERE tournament_id=$1 AND parent_id=$2 AND name=$3",
            tid, parent_id, name,
        )

    if existing:
        return existing

    node_id = await conn.fetchval(
        """
        INSERT INTO tournament_structure_nodes (tournament_id, parent_id, level, name, sort_order)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
        """,
        tid, parent_id, level, name, sort_order,
    )
    return node_id


async def insert_children(conn, parent_id: int, children: list, depth: int, counter: list):
    level = depth  # depth == tree level (0-based from root)
    for i, node in enumerate(children, start=1):
        name = node[0]
        grandchildren = node[1] if len(node) > 1 else []
        node_id = await upsert_node(conn, TID, parent_id, name, level, i)
        counter[0] += 1
        indent = "  " * (level - 1)
        status = "✓ new" if counter[0] > 0 else "existing"
        print(f"  {indent}[L{level}] {name} (id={node_id})")
        if grandchildren:
            await insert_children(conn, node_id, grandchildren, depth + 1, counter)


async def main():
    conn = await asyncpg.connect(DSN)
    try:
        async with conn.transaction():
            counter = [0]

            # ── Nam (existing node id=3) ──
            print(f"\n[L0] Nam (id={NAM_ID}) — existing")
            await insert_children(conn, NAM_ID, NAM_CHILDREN, depth=1, counter=counter)

            # ── Nữ (create or get) ──
            nu_id = await upsert_node(conn, TID, None, "Nữ", 0, 2)
            print(f"\n[L0] Nữ (id={nu_id})")
            await insert_children(conn, nu_id, NU_CHILDREN, depth=1, counter=counter)

            print(f"\n=== Done. Total nodes upserted/found: {counter[0] + 1} ===")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
