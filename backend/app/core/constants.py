"""
Data master — Belt ranks và Weight classes theo quy định Liên đoàn Vovinam.
"""

# Đai thi đấu (11 cấp)
COMPETING_BELTS = [
    "Tự vệ nhập môn",
    "Lam đai nhập môn",
    "Lam đai I",
    "Lam đai II",
    "Lam đai III",
    "Chuẩn Hoàng đai",
    "Hoàng đai",
    "Hoàng đai I",
    "Hoàng đai II",
    "Hoàng đai III",
    "Chuẩn Hồng đai",
]

# Tất cả đai (cho import/validation)
ALL_BELTS = COMPETING_BELTS + [
    "Hồng đai I", "Hồng đai II", "Hồng đai III",
    "Hồng đai IV", "Hồng đai V", "Hồng đai VI",
    "Bạch đai",
]

# Map tên import Excel → tên chuẩn
BELT_IMPORT_MAP: dict[str, str] = {
    b.lower(): b for b in ALL_BELTS
}
# Thêm alias không dấu
BELT_IMPORT_MAP.update({
    "tu ve nhap mon":   "Tự vệ nhập môn",
    "lam dai nhap mon": "Lam đai nhập môn",
    "lam dai i":        "Lam đai I",
    "lam dai ii":       "Lam đai II",
    "lam dai iii":      "Lam đai III",
    "chuan hoang dai":  "Chuẩn Hoàng đai",
    "hoang dai":        "Hoàng đai",
    "hoang dai i":      "Hoàng đai I",
    "hoang dai ii":     "Hoàng đai II",
    "hoang dai iii":    "Hoàng đai III",
    "chuan hong dai":   "Chuẩn Hồng đai",
    "hong dai i":       "Hồng đai I",
    "hong dai ii":      "Hồng đai II",
    "hong dai iii":     "Hồng đai III",
    "hong dai iv":      "Hồng đai IV",
    "hong dai v":       "Hồng đai V",
    "hong dai vi":      "Hồng đai VI",
    "bach dai":         "Bạch đai",
    # Legacy aliases
    "vang":  "Lam đai nhập môn",
    "xanh":  "Lam đai I",
    "nau":   "Chuẩn Hoàng đai",
})

WEIGHT_CLASSES = {
    "M": [
        {"label": "45 kg",      "range": "Dưới 45 kg",        "value": 45},
        {"label": "48 kg",      "range": "45 – 48 kg",        "value": 48},
        {"label": "51 kg",      "range": "48 – 51 kg",        "value": 51},
        {"label": "54 kg",      "range": "51 – 54 kg",        "value": 54},
        {"label": "57 kg",      "range": "54 – 57 kg",        "value": 57},
        {"label": "60 kg",      "range": "57 – 60 kg",        "value": 60},
        {"label": "64 kg",      "range": "60 – 64 kg",        "value": 64},
        {"label": "68 kg",      "range": "64 – 68 kg",        "value": 68},
        {"label": "72 kg",      "range": "68 – 72 kg",        "value": 72},
        {"label": "77 kg",      "range": "72 – 77 kg",        "value": 77},
        {"label": "82 kg",      "range": "77 – 82 kg",        "value": 82},
        {"label": "92 kg",      "range": "82 – 92 kg",        "value": 92},
        {"label": "Trên 92 kg", "range": "Hạng nặng tuyệt đối", "value": 999},
    ],
    "F": [
        {"label": "42 kg",      "range": "Dưới 42 kg", "value": 42},
        {"label": "45 kg",      "range": "42 – 45 kg", "value": 45},
        {"label": "48 kg",      "range": "45 – 48 kg", "value": 48},
        {"label": "51 kg",      "range": "48 – 51 kg", "value": 51},
        {"label": "54 kg",      "range": "51 – 54 kg", "value": 54},
        {"label": "57 kg",      "range": "54 – 57 kg", "value": 57},
        {"label": "60 kg",      "range": "57 – 60 kg", "value": 60},
        {"label": "63 kg",      "range": "60 – 63 kg", "value": 63},
        {"label": "66 kg",      "range": "63 – 66 kg", "value": 66},
        {"label": "70 kg",      "range": "66 – 70 kg", "value": 70},
        {"label": "75 kg",      "range": "70 – 75 kg", "value": 75},
        {"label": "Trên 75 kg", "range": "Hạng nặng",  "value": 999},
    ],
}
