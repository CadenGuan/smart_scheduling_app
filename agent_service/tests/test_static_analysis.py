from pathlib import Path

from django.test import SimpleTestCase


class StaticAnalysisConfigurationTests(SimpleTestCase):
    def setUp(self):
        self.agent_dir = Path(__file__).resolve().parent.parent
        self.root_dir = self.agent_dir.parent
        self.pyproject_path = self.agent_dir / "pyproject.toml"

    def test_static_analysis_pyproject_toml_configuration(self):
        """Verifies pyproject.toml exists and configures ruff, mypy, and pytest coverage."""
        self.assertTrue(self.pyproject_path.exists())
        content = self.pyproject_path.read_text(encoding="utf-8")
        self.assertIn("[tool.ruff]", content)
        self.assertIn("[tool.mypy]", content)
        self.assertIn("[tool.pytest.ini_options]", content)
        self.assertIn("[tool.coverage.report]", content)

    def test_static_analysis_coverage_fail_under_threshold(self):
        """Verifies pytest-cov enforces a minimum 70% coverage threshold."""
        content = self.pyproject_path.read_text(encoding="utf-8")
        self.assertIn("fail_under = 70", content)

    def test_static_analysis_cross_platform_tool_launcher(self):
        """Verifies scripts/run-agent-tool.js exists to run python tools cross-platform."""
        launcher_path = self.root_dir / "scripts" / "run-agent-tool.js"
        self.assertTrue(launcher_path.exists())
        launcher_content = launcher_path.read_text(encoding="utf-8")
        self.assertIn("agent_service/.venv", launcher_content)
        self.assertIn("DJANGO_SETTINGS_MODULE", launcher_content)
