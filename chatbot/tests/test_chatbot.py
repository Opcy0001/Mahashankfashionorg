"""Integration tests for the MahaAI chat API endpoints and site page."""

import json
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse

from chatbot.models import ChatSession, ChatMessage


def _mistral_ok(reply_text="Sure, here's the answer."):
    payload = {
        "choices": [{"message": {"role": "assistant", "content": reply_text}}]
    }
    resp = mock.Mock()
    resp.status_code = 200
    resp.json.return_value = payload
    return mock.patch("chatbot.views.requests.post", return_value=resp)


class SitePageTests(TestCase):
    def test_home_returns_3d_site(self):
        response = self.client.get(reverse("site_home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "MAHASHANKH GROUP")
        self.assertContains(response, "MAHASHANKH AI")
        self.assertContains(response, "ai-chat-toggle")
        self.assertContains(response, "site/chat")
        self.assertContains(response, "site/style")

    def test_quick_replies_endpoint(self):
        response = self.client.get(reverse("quick_replies"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("quick_replies", data)
        self.assertGreater(len(data["quick_replies"]), 0)
        for qr in data["quick_replies"]:
            self.assertIn("key", qr)
            self.assertIn("label", qr)
            self.assertIn("prompt", qr)


class ChatApiTests(TestCase):
    def _post_chat(self, message, session_id=None):
        body = {"message": message}
        if session_id:
            body["session_id"] = session_id
        return self.client.post(
            reverse("chat_api"),
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_chat_creates_session_and_messages(self):
        with _mistral_ok("The reply.") as post:
            response = self._post_chat("What services do you offer?")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["reply"], "The reply.")
        self.assertTrue(data["session_id"])

        session = ChatSession.objects.get(session_id=data["session_id"])
        roles = list(session.messages.values_list("role", flat=True))
        self.assertEqual(roles, ["user", "assistant"])

        # Mistral got system prompt + user message
        sent = post.call_args[1]["json"]["messages"]
        self.assertEqual(sent[0]["role"], "system")
        self.assertEqual(sent[-1]["content"], "What services do you offer?")

    def test_chat_history_sent_to_mistral(self):
        with _mistral_ok() as post:
            first = self._post_chat("first question")
            session_id = first.json()["session_id"]
            self._post_chat("second question", session_id=session_id)

        sent = post.call_args[1]["json"]["messages"]
        contents = [m["content"] for m in sent]
        self.assertIn("first question", contents)
        self.assertIn("second question", contents)

    def test_unknown_session_id_creates_new_session(self):
        with _mistral_ok():
            response = self._post_chat("hi", session_id="00000000-0000-0000-0000-000000000000")
        self.assertEqual(response.status_code, 200)
        session_id = response.json()["session_id"]
        self.assertNotEqual(session_id, "00000000-0000-0000-0000-000000000000")
        self.assertTrue(ChatSession.objects.filter(session_id=session_id).exists())

    def test_empty_message_returns_400(self):
        response = self._post_chat("   ")
        self.assertEqual(response.status_code, 400)

    def test_invalid_json_returns_400(self):
        response = self.client.post(
            reverse("chat_api"), data="not json", content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_missing_api_key_returns_fallback_with_200(self):
        with override_settings(MISTRAL_API_KEY=None):
            response = self._post_chat("hello")
        self.assertEqual(response.status_code, 200)
        self.assertIn("isn't fully connected yet", response.json()["reply"])


class ClearChatTests(TestCase):
    def _post_chat(self, message, session_id=None):
        body = {"message": message}
        if session_id:
            body["session_id"] = session_id
        return self.client.post(
            reverse("chat_api"),
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_clear_deletes_session(self):
        with _mistral_ok():
            response = self._post_chat("hello")
        session_id = response.json()["session_id"]
        self.assertTrue(ChatSession.objects.filter(session_id=session_id).exists())

        response = self.client.post(
            reverse("clear_chat"),
            data=json.dumps({"session_id": session_id}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "cleared")
        self.assertFalse(ChatSession.objects.filter(session_id=session_id).exists())
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_clear_unknown_session_is_ok(self):
        response = self.client.post(
            reverse("clear_chat"),
            data=json.dumps({"session_id": "00000000-0000-0000-0000-000000000000"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "cleared")

    def test_clear_invalid_json_returns_400(self):
        response = self.client.post(
            reverse("clear_chat"),
            data="not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
