#!/usr/bin/env python3
"""
Spec pipeline runner theo workflow moi:

raw_request/*.md
    -> basic_design/_clarification/<feature_code>.md
    -> basic_design/<module>/<feature_name>.md
    -> detail_design/<module>/<feature_name>.md

Script nay chi scaffold artifact va naming convention.
No khong goi LLM that, khong sinh code runtime, va khong thay the agent that.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re


BASE_DIR = Path(__file__).parent
RAW_REQUEST_DIR = BASE_DIR / "raw_request"
BASIC_DESIGN_DIR = BASE_DIR / "basic_design"
DETAIL_DESIGN_DIR = BASE_DIR / "detail_design"
TEMPLATES_DIR = BASE_DIR / "templates"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "feature"


def feature_code_from_name(name: str) -> str:
    return slugify(name).upper()


@dataclass
class PipelineContext:
    module: str
    feature_name: str
    feature_code: str

    @property
    def raw_request_path(self) -> Path:
        return RAW_REQUEST_DIR / f"{self.feature_name}.md"

    @property
    def clarification_path(self) -> Path:
        return BASIC_DESIGN_DIR / "_clarification" / f"{self.feature_code}.md"

    @property
    def basic_design_path(self) -> Path:
        return BASIC_DESIGN_DIR / self.module / f"{self.feature_name}.md"

    @property
    def detail_design_path(self) -> Path:
        return DETAIL_DESIGN_DIR / self.module / f"{self.feature_name}.md"


class PipelineRunner:
    def __init__(self, context: PipelineContext):
        self.context = context

    def validate_inputs(self) -> None:
        if not self.context.raw_request_path.exists():
            raise FileNotFoundError(
                f"Khong tim thay raw request: {self.context.raw_request_path}"
            )

    def load_template(self, name: str) -> str:
        path = TEMPLATES_DIR / name
        return path.read_text(encoding="utf-8")

    def ensure_parent_dirs(self) -> None:
        self.context.clarification_path.parent.mkdir(parents=True, exist_ok=True)
        self.context.basic_design_path.parent.mkdir(parents=True, exist_ok=True)
        self.context.detail_design_path.parent.mkdir(parents=True, exist_ok=True)

    def build_clarification_stub(self, raw_content: str) -> str:
        return f"""# Clarification - {self.context.feature_code}

## Raw Sources

- `{self.context.raw_request_path.relative_to(BASE_DIR).as_posix()}`

## Da ro

- Muc tieu tinh nang:
- Actor:
- Luong chinh:
- Business rules:
- Event nghiep vu:
- Cum tinh nang / man hinh:
- API list muc co ban:

## Assumptions

- 

## Open Questions

- Q-01:

## Raw Excerpt

```md
{raw_content[:2000]}
```
"""

    def build_basic_design_stub(self) -> str:
        template = self.load_template("basic_design_template.md")
        replacements = {
            "[Tên tính năng]": self.context.feature_name,
            "[FEATURE_CODE]": self.context.feature_code,
            "YYYY-MM-DD": "2026-04-07",
        }
        for old, new in replacements.items():
            template = template.replace(old, new)
        return template

    def build_detail_design_stub(self) -> str:
        template = self.load_template("detail_design_template.md")
        replacements = {
            "[Tên tính năng]": self.context.feature_name,
            "[FEATURE_CODE]": self.context.feature_code,
            "YYYY-MM-DD": "2026-04-07",
            "`basic_design/.../basic_design.md`": f"`{self.context.basic_design_path.relative_to(BASE_DIR).as_posix()}`",
        }
        for old, new in replacements.items():
            template = template.replace(old, new)
        return template

    def run(self) -> None:
        self.validate_inputs()
        self.ensure_parent_dirs()

        raw_content = self.context.raw_request_path.read_text(encoding="utf-8").strip()

        self.context.clarification_path.write_text(
            self.build_clarification_stub(raw_content),
            encoding="utf-8",
        )
        self.context.basic_design_path.write_text(
            self.build_basic_design_stub(),
            encoding="utf-8",
        )
        self.context.detail_design_path.write_text(
            self.build_detail_design_stub(),
            encoding="utf-8",
        )

        print("Da scaffold workflow moi:")
        print(f"- raw_request:      {self.context.raw_request_path.relative_to(BASE_DIR)}")
        print(f"- clarification:    {self.context.clarification_path.relative_to(BASE_DIR)}")
        print(f"- basic_design:     {self.context.basic_design_path.relative_to(BASE_DIR)}")
        print(f"- detail_design:    {self.context.detail_design_path.relative_to(BASE_DIR)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold spec workflow moi")
    parser.add_argument("--module", required=True, help="Vi du: 03_tournament_management")
    parser.add_argument(
        "--feature-name",
        required=True,
        help="Ten file feature dang snake_case, vi du: dynamic_tournament_structure",
    )
    parser.add_argument(
        "--feature-code",
        help="Ma feature dang UPPER_SNAKE_CASE. Mac dinh suy ra tu feature-name.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    feature_name = slugify(args.feature_name)
    feature_code = args.feature_code or feature_code_from_name(feature_name)

    context = PipelineContext(
        module=args.module,
        feature_name=feature_name,
        feature_code=feature_code,
    )

    runner = PipelineRunner(context)
    runner.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
