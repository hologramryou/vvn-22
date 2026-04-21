from app.repositories.tournament_repo import (
    _resolve_quyen_classification_node_id,
    _split_node_path,
    _format_tree_path_for_export,
)


class TestResolveQuyenClassificationNodeId:
    def test_returns_parent_for_leaf_sparring_node(self):
        parent_by_id = {
            10: None,
            20: 10,
            30: 20,
        }
        parent_ids = {10, 20}

        assert _resolve_quyen_classification_node_id(30, parent_by_id, parent_ids) == 20

    def test_keeps_group_node_for_quyen_branch(self):
        parent_by_id = {
            10: None,
            20: 10,
            30: 20,
        }
        parent_ids = {10, 20}

        assert _resolve_quyen_classification_node_id(20, parent_by_id, parent_ids) == 20

    def test_handles_missing_node_id(self):
        assert _resolve_quyen_classification_node_id(None, {}, set()) is None


class TestBracketExportPathFormatting:
    def test_split_node_path_discards_empty_segments(self):
        assert _split_node_path("Nam > 12-14 tuoi > 12kg") == ["Nam", "12-14 tuoi", "12kg"]
        assert _split_node_path("Nam  >   > 12kg") == ["Nam", "12kg"]

    def test_format_tree_path_for_export_prefixes_leaf_with_hang(self):
        assert _format_tree_path_for_export("Nam > 12-14 tuoi > 12kg") == "Nam · 12-14 tuoi · Hạng 12kg"
        assert _format_tree_path_for_export("") == ""
