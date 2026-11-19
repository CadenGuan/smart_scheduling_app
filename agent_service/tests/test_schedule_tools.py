import unittest
from unittest.mock import MagicMock, patch

from agent.tools import (
    create_class_event,
    delete_class_event,
    find_free_time,
    get_inspection_tools,
    list_google_events,
    set_tool_context,
)


class TestScheduleTools(unittest.TestCase):
    def setUp(self):
        self.student = {"userId": "usr_123", "name": "Sammy Slug", "major": "Computer Science B.S."}
        self.preferences = {"majorRequirementsTaken": ["CSE 20", "MATH 19A"]}
        self.schedule = [
            {
                "id": "item_1",
                "courseCode": "CSE 30",
                "title": "Programming Abstractions in Python",
                "days": "M,W,F",
                "startTime": "10:00",
                "endTime": "11:05",
            }
        ]
        set_tool_context(
            student=self.student,
            preferences=self.preferences,
            schedule=self.schedule,
            session_token="test_jwt_token_abc",
            node_api_url="http://localhost:3000",
        )

    @patch("agent.catalog_dao.get_course_details")
    @patch("requests.post")
    def test_create_class_event_success(self, mock_post, mock_get_details):
        mock_get_details.return_value = [
            {
                "course_code": "CSE 30",
                "section": "01",
                "title": "Programming Abstractions in Python",
                "days": "M,W,F",
                "start_time": "10:00",
                "end_time": "11:05",
            }
        ]
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {
            "success": True,
            "data": {
                "id": "new_ev_123",
                "courseCode": "CSE 30",
                "title": "Programming Abstractions in Python",
                "days": "M,W,F",
                "startTime": "10:00",
                "endTime": "11:05",
                "syncStatus": "pending",
            },
        }
        mock_post.return_value = mock_resp

        result = create_class_event.invoke({"course_code": "CSE 30", "section": "01"})
        self.assertIn("Successfully added CSE 30", result)
        self.assertTrue(mock_post.called)
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "http://localhost:3000/api/user_schedule")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test_jwt_token_abc")
        self.assertEqual(kwargs["json"]["courseCode"], "CSE 30")

    @patch("requests.delete")
    def test_delete_class_event_success(self, mock_delete):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True, "data": {"id": "item_1"}}
        mock_delete.return_value = mock_resp

        result = delete_class_event.invoke({"course_code": "CSE 30"})
        self.assertIn("Successfully removed CSE 30", result)
        self.assertTrue(mock_delete.called)
        args, kwargs = mock_delete.call_args
        self.assertEqual(args[0], "http://localhost:3000/api/user_schedule/item_1")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test_jwt_token_abc")

    def test_read_only_google_mcp_tools(self):
        # Verify read-only calendar tools return valid outputs
        events_res = list_google_events.invoke({})
        self.assertIsInstance(events_res, str)

        free_time_res = find_free_time.invoke({"duration_minutes": 60})
        self.assertIsInstance(free_time_res, str)

        # Verify Google MCP write operations are strictly forbidden from inspection tools
        tool_names = [t.name for t in get_inspection_tools()]
        self.assertIn("create_class_event", tool_names)
        self.assertIn("delete_class_event", tool_names)
        self.assertIn("list_google_events", tool_names)
        self.assertIn("find_free_time", tool_names)

        # Prohibited write tools MUST NOT exist in tool registry
        self.assertNotIn("create_event", tool_names)
        self.assertNotIn("update_event", tool_names)
        self.assertNotIn("delete_event", tool_names)


if __name__ == "__main__":
    unittest.main()
