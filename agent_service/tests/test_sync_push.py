import json
import unittest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory
from agent_api.views import push_event_to_google

class TestSyncPushEndpoint(unittest.TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.sample_payload = {
            "googleToken": "ya29.sample_oauth_token_123",
            "event": {
                "id": "event_123",
                "courseCode": "CSE 30",
                "title": "Programming Abstractions in Python",
                "description": "Lecture 01 - MWF 10:00-11:05",
                "days": "M,W,F",
                "startTime": "10:00",
                "endTime": "11:05",
                "startDate": "2027-01-04",
                "endDate": "2027-03-19",
            },
        }

    def test_missing_google_token_returns_400(self):
        req = self.factory.post(
            "/api/sync/push/",
            data=json.dumps({"event": self.sample_payload["event"]}),
            content_type="application/json",
        )
        resp = push_event_to_google(req)
        self.assertEqual(resp.status_code, 400)
        data = json.loads(resp.content)
        self.assertFalse(data["success"])

    @patch("requests.post")
    def test_successful_google_push(self, mock_post):
        mock_google_resp = MagicMock()
        mock_google_resp.status_code = 200
        mock_google_resp.json.return_value = {"id": "google_event_id_xyz789"}
        mock_post.return_value = mock_google_resp

        req = self.factory.post(
            "/api/sync/push/",
            data=json.dumps(self.sample_payload),
            content_type="application/json",
        )
        resp = push_event_to_google(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["googleEventId"], "google_event_id_xyz789")

        # Verify Google API request
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://www.googleapis.com/calendar/v3/calendars/primary/events")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer ya29.sample_oauth_token_123")
        google_body = kwargs["json"]
        self.assertIn("CSE 30: Programming Abstractions in Python", google_body["summary"])
        self.assertIn("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR", google_body["recurrence"][0])

    @patch("requests.post")
    def test_expired_token_returns_401(self, mock_post):
        mock_google_resp = MagicMock()
        mock_google_resp.status_code = 401
        mock_google_resp.json.return_value = {"error": {"message": "Invalid Credentials"}}
        mock_post.return_value = mock_google_resp

        req = self.factory.post(
            "/api/sync/push/",
            data=json.dumps(self.sample_payload),
            content_type="application/json",
        )
        resp = push_event_to_google(req)
        self.assertEqual(resp.status_code, 401)
        data = json.loads(resp.content)
        self.assertEqual(data["error"], "GOOGLE_TOKEN_EXPIRED")

if __name__ == "__main__":
    unittest.main()
