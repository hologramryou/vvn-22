#!/usr/bin/env python3
"""
Legacy orchestrator.

File nay duoc giu lai chi de thong bao rang pipeline cu
`human_spec.md` / `agent_spec.yaml` da bi thay the.

Hay dung:

    python scripts/spec_pipeline/run_pipeline.py --module <module> --feature-name <feature_name>
"""

from pathlib import Path
import sys


BASE_DIR = Path(__file__).parent


def main() -> int:
    print("Legacy orchestrator da bi ngung su dung.")
    print("Workflow moi:")
    print("  raw_request/*.md")
    print("    -> basic_design/_clarification/<feature_code>.md")
    print("    -> basic_design/<module>/<feature_name>.md")
    print("    -> detail_design/<module>/<feature_name>.md")
    print("")
    print("Hay chay:")
    print("  python scripts/spec_pipeline/run_pipeline.py --module 03_tournament_management --feature-name dynamic_tournament_structure")
    return 1


if __name__ == "__main__":
    sys.exit(main())
