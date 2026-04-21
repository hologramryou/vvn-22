#!/usr/bin/env python3
"""
UI Review Agent — phân tích consistency và quality của frontend codebase.

Chạy: python scripts/ui_review_agent.py [--path frontend/src] [--out docs/analysis/ui_review.md]
"""

import os
import re
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, field


# ── Semantic-aware check engine ──────────────────────────────────────────────
#
# Mỗi check có thể dùng:
#   pattern       : regex khớp trên từng dòng
#   context_re    : regex bổ sung phải khớp CÙNG dòng (AND)
#   context_not   : regex KHÔNG được khớp cùng dòng (exclusion guard)
#   exclude_files : skip nếu filename chứa chuỗi này
#   exclude_dirs  : skip nếu path chứa chuỗi này
#   only_files    : chỉ scan nếu filename chứa một trong các chuỗi này
#   only_dirs     : chỉ scan nếu path chứa một trong các chuỗi này
#   severity      : critical | warning | suggestion

CHECKS = {

    # ── 1. Nút action dùng màu blue hardcode thay vì CSS var ────────────────
    # Pattern: bg-blue-6xx/7xx/8xx KÈM text-white (= primary button)
    # Loại trừ: màu nhạt (bg-blue-50/100/200), semantic text (text-blue-xxx một mình)
    "primary_button_hardcoded": {
        "pattern": r"bg-(?:blue|indigo)-(?:600|700|800|900)",
        "context_re": r"text-white",           # phải có text-white cùng dòng
        "exclude_files": ["tokens.ts", "StatusBadge.tsx", "BeltBadge.tsx", "Modal.tsx",
                          "ConfirmDialog.tsx", "FilterChip.tsx"],
        "exclude_dirs": ["ui/"],
        # Bỏ qua các file scoring/display/judge vì màu đã design cố ý
        "exclude_files_extra": ["ScoringPage", "QuyenScoringPage", "QuyenJudgePage",
                                "MatchJudgePanelPage", "RefereeConsolePage", "DisplayPage",
                                "BracketExportModal"],
        "severity": "warning",
        "message": "Primary button hardcode bg-blue-xxx — đổi thành bg-[var(--color-primary)]",
    },

    # ── 2. Hover state trên primary button ──────────────────────────────────
    "primary_hover_hardcoded": {
        "pattern": r"hover:bg-(?:blue|indigo)-(?:700|800|900)",
        "context_not": r"(?:bg-blue-50|bg-blue-100|bg-blue-200)",  # không phải hover của pill nhạt
        "exclude_files": ["tokens.ts", "FilterChip.tsx", "Modal.tsx"],
        "exclude_dirs": ["ui/"],
        "exclude_files_extra": ["ScoringPage", "QuyenScoringPage", "QuyenJudgePage",
                                "MatchJudgePanelPage", "RefereeConsolePage", "DisplayPage",
                                "BracketExportModal"],
        "severity": "warning",
        "message": "Hover primary hardcode hover:bg-blue-xxx — đổi thành hover:bg-[var(--color-primary-dark)]",
    },

    # ── 3. Focus ring trên input/button dùng màu blue cứng ─────────────────
    "focus_ring_hardcoded": {
        "pattern": r"focus:ring-(?:blue|indigo)-(?:400|500|600)",
        "exclude_files": ["tokens.ts"],
        "exclude_dirs": ["ui/"],
        "exclude_files_extra": ["ScoringPage", "QuyenScoringPage", "DisplayPage"],
        "severity": "suggestion",
        "message": "Focus ring hardcode — đổi thành focus:ring-[var(--color-primary)]",
    },

    # ── 4. border/text primary hardcode (không phải semantic blue) ──────────
    # Chỉ bắt khi KÈM border-blue-600/700 + text-blue-600/700 trên button/link context
    "primary_border_text_hardcoded": {
        "pattern": r"(?:border|text)-(?:blue|indigo)-(?:600|700)",
        "context_re": r"(?:hover:|focus:|active:)",  # chỉ khi có interactive state
        "context_not": r"(?:bg-blue-50|bg-emerald|bg-amber|bg-fuchsia|TreePath|pill|badge|status)",
        "exclude_files": ["tokens.ts", "StatusBadge.tsx", "BeltBadge.tsx", "TreePathPills.tsx"],
        "exclude_dirs": ["ui/"],
        "exclude_files_extra": ["ScoringPage", "QuyenScoringPage", "QuyenJudgePage",
                                "MatchJudgePanelPage", "RefereeConsolePage", "DisplayPage",
                                "QuyenResultsModal", "BracketExportModal"],
        "severity": "suggestion",
        "message": "Interactive border/text primary hardcode — cân nhắc dùng CSS var",
    },

    # ── 5. window.confirm() ─────────────────────────────────────────────────
    "window_confirm": {
        "pattern": r"window\.confirm\(",
        "severity": "critical",
        "message": "Dùng window.confirm() — thay bằng <ConfirmDialog>",
    },

    # ── 6. Modal thủ công (không dùng base Modal) ───────────────────────────
    "inline_modal": {
        "pattern": r"fixed inset-0",
        "exclude_files": ["Modal.tsx"],
        # Bỏ qua các màn chuyên biệt có layout cố ý
        "exclude_files_extra": ["ScoringPage", "QuyenScoringPage", "QuyenJudgePage",
                                "MatchJudgePanelPage", "RefereeConsolePage", "DisplayPage",
                                "QuyenSetupPage", "MatchSetupPage"],
        "severity": "warning",
        "message": "Modal thủ công — nên dùng <Modal> component từ ui/",
    },

    # ── 7. Dùng `any` type ──────────────────────────────────────────────────
    "any_type": {
        "pattern": r":\s*any(?:\b|[\[\]|>\s])",
        "exclude_dirs": ["api/", "types/"],
        "severity": "warning",
        "message": "Dùng `any` type — khai báo type cụ thể",
    },

    # ── 8. Định nghĩa StatusBadge local ─────────────────────────────────────
    "local_statusbadge": {
        "pattern": r"function\s+StatusBadge|const\s+StatusBadge\s*=",
        "exclude_files": ["StatusBadge.tsx"],
        "severity": "warning",
        "message": "Định nghĩa StatusBadge local — import từ components/ui",
    },

    # ── 9. Icon-only button thiếu aria-label ────────────────────────────────
    "missing_aria_label": {
        "pattern": r"<button(?![^>]*aria-label)[^>]*>\s*<(?:X|Trash|Pencil|Plus|Search|Settings|Filter)\b",
        "severity": "suggestion",
        "message": "Icon-only button thiếu aria-label — thêm aria-label để accessibility",
    },

    # ── 10. h1 trực tiếp trong page (không dùng PageHeader) ─────────────────
    "h1_raw_in_page": {
        "pattern": r"<h1[\s>]",
        "only_dirs": ["pages/"],
        "exclude_files": ["PageHeader.tsx"],
        "severity": "suggestion",
        "message": "h1 trực tiếp trong page — cân nhắc dùng <PageHeader>",
    },
}


# ── Data model ───────────────────────────────────────────────────────────────

@dataclass
class Finding:
    severity: str
    check_id: str
    file: str
    line: int
    message: str
    snippet: str


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    def add(self, f: Finding):
        self.findings.append(f)

    def by_severity(self, sev: str):
        return [f for f in self.findings if f.severity == sev]

    def summary(self) -> dict:
        return {
            "total": len(self.findings),
            "critical": len(self.by_severity("critical")),
            "warning": len(self.by_severity("warning")),
            "suggestion": len(self.by_severity("suggestion")),
            "files_affected": len({f.file for f in self.findings}),
        }


# ── Scanner ──────────────────────────────────────────────────────────────────

def _matches_extra_exclusion(filepath: str, check: dict) -> bool:
    """Kiểm tra exclude_files_extra (partial filename match)."""
    for ex in check.get("exclude_files_extra", []):
        if ex in filepath:
            return True
    return False


def should_skip_file(filepath: str, check: dict) -> bool:
    norm = filepath.replace("\\", "/")
    filename = os.path.basename(filepath)

    for ex in check.get("exclude_files", []):
        if ex in filename:
            return True
    for ex in check.get("exclude_dirs", []):
        if ex in norm:
            return True
    if _matches_extra_exclusion(norm, check):
        return True

    only_files = check.get("only_files", [])
    if only_files and not any(f in filename for f in only_files):
        return True

    only_dirs = check.get("only_dirs", [])
    if only_dirs and not any(d in norm for d in only_dirs):
        return True

    return False


def scan_file(filepath: Path, report: Report):
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return

    lines = content.splitlines()
    rel_path = str(filepath).replace("\\", "/")

    for check_id, check in CHECKS.items():
        if should_skip_file(rel_path, check):
            continue

        pattern = re.compile(check["pattern"])
        ctx_re = re.compile(check["context_re"]) if check.get("context_re") else None
        ctx_not = re.compile(check["context_not"]) if check.get("context_not") else None

        for i, line in enumerate(lines, start=1):
            if not pattern.search(line):
                continue
            if ctx_re and not ctx_re.search(line):
                continue
            if ctx_not and ctx_not.search(line):
                continue

            report.add(Finding(
                severity=check["severity"],
                check_id=check_id,
                file=rel_path,
                line=i,
                message=check["message"],
                snippet=line.strip()[:140],
            ))


def scan_dir(src_dir: Path, report: Report):
    skip_dirs = {"node_modules", ".git", "dist", "__pycache__"}
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            if Path(fname).suffix in {".tsx", ".ts"}:
                scan_file(Path(root) / fname, report)


# ── Renderer ─────────────────────────────────────────────────────────────────

SEV_ICON = {"critical": "🔴", "warning": "🟡", "suggestion": "🔵"}

CHECK_DESC = {
    "primary_button_hardcoded": "Nút action dùng màu primary hardcode (có text-white)",
    "primary_hover_hardcoded":  "Hover state primary hardcode",
    "focus_ring_hardcoded":     "Focus ring hardcode",
    "primary_border_text_hardcoded": "Border/text interactive hardcode",
    "window_confirm":           "window.confirm() — thay bằng ConfirmDialog",
    "inline_modal":             "Modal thủ công — thay bằng <Modal>",
    "any_type":                 "Dùng `any` type",
    "local_statusbadge":        "Định nghĩa StatusBadge local",
    "missing_aria_label":       "Icon button thiếu aria-label",
    "h1_raw_in_page":           "h1 raw trong page (không qua PageHeader)",
}

SAFE_CONTEXTS = """
> **Không flag (giữ nguyên màu cố ý):**
> - `bg-blue-50/100/200` — light background cho pill, info card, quyen result
> - `text-blue-700` standalone — TreePathPills level 0, QuyenResultsModal semantic
> - `bg-red-50`, `bg-emerald-50`, `bg-amber-50` — player color, status color
> - ScoringPage, QuyenScoringPage, DisplayPage, MatchJudgePanelPage — design màn đặc biệt
> - BracketExportModal — export layout cố ý
"""


def render_markdown(report: Report, src_dir: str) -> str:
    s = report.summary()

    # Count by check
    from collections import Counter
    check_counts = Counter(f.check_id for f in report.findings)

    lines = [
        "# UI Review Report",
        "",
        f"**Scanned:** `{src_dir}`  ",
        f"**Findings:** {s['total']} tổng — {s['critical']} 🔴 critical · {s['warning']} 🟡 warning · {s['suggestion']} 🔵 suggestion  ",
        f"**Files bị ảnh hưởng:** {s['files_affected']}",
        "",
        "## Tổng quan theo loại",
        "",
        "| Check | Count | Mô tả |",
        "|---|---|---|",
    ]
    for cid, cnt in check_counts.most_common():
        desc = CHECK_DESC.get(cid, cid)
        sev = next(f.severity for f in report.findings if f.check_id == cid)
        icon = SEV_ICON[sev]
        lines.append(f"| `{cid}` | {cnt} {icon} | {desc} |")

    lines += ["", SAFE_CONTEXTS, "---", ""]

    for severity in ("critical", "warning", "suggestion"):
        group = report.by_severity(severity)
        if not group:
            continue
        icon = SEV_ICON[severity]
        lines.append(f"## {icon} {severity.capitalize()} ({len(group)})")
        lines.append("")

        by_file: dict[str, list[Finding]] = {}
        for f in group:
            by_file.setdefault(f.file, []).append(f)

        for filepath, findings in sorted(by_file.items()):
            lines.append(f"### `{filepath}`")
            for f in findings:
                lines.append(f"- **L{f.line}** `[{f.check_id}]` {f.message}")
                lines.append(f"  ```")
                lines.append(f"  {f.snippet}")
                lines.append(f"  ```")
            lines.append("")

    if not report.findings:
        lines.append("✅ Không tìm thấy vấn đề nào!")

    return "\n".join(lines)


# ── Entry ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="UI Review Agent")
    parser.add_argument("--path", default="frontend/src", help="Thư mục nguồn frontend")
    parser.add_argument("--out", default=None, help="File output markdown")
    args = parser.parse_args()

    src_dir = Path(args.path)
    if not src_dir.exists():
        print(f"ERROR: Không tìm thấy thư mục {src_dir}", file=sys.stderr)
        sys.exit(1)

    report = Report()
    scan_dir(src_dir, report)

    md = render_markdown(report, str(src_dir))

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(md, encoding="utf-8")
        s = report.summary()
        print(f"OK Report: {out}")
        print(f"  {s['total']} findings - {s['critical']} critical, {s['warning']} warning, {s['suggestion']} suggestion")
        print(f"  Files: {s['files_affected']}")
    else:
        print(md)


if __name__ == "__main__":
    main()
