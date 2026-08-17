"""Unit tests for the Mistral API wrapper in chatbot.views."""

from unittest import mock

from django.test import TestCase, override_settings

from chatbot.views import call_mistral


def _mock_response(status_code=200, json_data=None, text=""):
    resp = mock.Mock()
    resp.status_code = status_code
    resp.text = text
    resp.json.return_value = json_data or {}
    return resp


class CallMistralSuccessTests(TestCase):
    @override_settings(MISTRAL_API_KEY="test-key")
    def test_returns_reply_text(self):
        payload = {
            "choices": [
                {"message": {"role": "assistant", "content": "  Hello there!  "}}
            ]
        }
        with mock.patch("chatbot.views.requests.post") as post:
            post.return_value = _mock_response(json_data=payload)
            reply = call_mistral([{"role": "user", "content": "hi"}])

        self.assertEqual(reply, "Hello there!")
        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.mistral.ai/v1/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"]["model"], "mistral-small-latest")

    @override_settings(MISTRAL_API_KEY="test-key")
    def test_sends_messages_body(self):
        payload = {"choices": [{"message": {"content": "ok"}}]}
        msgs = [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "q"},
        ]
        with mock.patch("chatbot.views.requests.post") as post:
            post.return_value = _mock_response(json_data=payload)
            call_mistral(msgs)

        _, kwargs = post.call_args
        self.assertEqual(kwargs["json"]["messages"], msgs)


class CallMistralFailureTests(TestCase):
    @override_settings(MISTRAL_API_KEY=None)
    def test_missing_api_key_returns_friendly_fallback(self):
        reply = call_mistral([{"role": "user", "content": "hi"}])
        self.assertIn("isn't fully connected yet", reply)

    @override_settings(MISTRAL_API_KEY="test-key")
    def test_http_error_returns_fallback_not_exception(self):
        import requests as requests_lib

        resp = _mock_response(status_code=500, text="boom")
        error = requests_lib.exceptions.HTTPError(response=resp)
        with mock.patch("chatbot.views.requests.post") as post:
            post.return_value = resp
            post.side_effect = error
            reply = call_mistral([{"role": "user", "content": "hi"}])

        self.assertIn("having trouble", reply)

    @override_settings(MISTRAL_API_KEY="test-key")
    def test_timeout_returns_fallback(self):
        import requests as requests_lib

        with mock.patch("chatbot.views.requests.post") as post:
            post.side_effect = requests_lib.exceptions.Timeout()
            reply = call_mistral([{"role": "user", "content": "hi"}])

        self.assertIn("took too long", reply)

    @override_settings(MISTRAL_API_KEY="test-key")
    def test_network_error_returns_fallback(self):
        import requests as requests_lib

        with mock.patch("chatbot.views.requests.post") as post:
            post.side_effect = requests_lib.exceptions.ConnectionError("no route")
            reply = call_mistral([{"role": "user", "content": "hi"}])

        self.assertIn("having trouble connecting", reply)

    @override_settings(MISTRAL_API_KEY="test-key")
    def test_malformed_payload_returns_fallback(self):
        with mock.patch("chatbot.views.requests.post") as post:
            post.return_value = _mock_response(json_data={"unexpected": "shape"})
            reply = call_mistral([{"role": "user", "content": "hi"}])

        self.assertIn("Something went wrong", reply)
