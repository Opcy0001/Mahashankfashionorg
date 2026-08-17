"""
MahaAI Chatbot — Django Backend Views
Mahashankh Design & Technology
"""

import json
import logging

import requests
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .knowledge_base import SYSTEM_PROMPT, QUICK_REPLIES
from .models import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 12  # how many past turns to send to Mistral for context


# ─── Pages ────────────────────────────────────────────────────────────────────

def site_home(request):
    """The MAHASHANKH GROUP 3D website with the integrated MahaAI chat widget."""
    return render(request, "chatbot/index.html")


def widget_demo(request):
    """Renders a demo page with the drop-in chat widget, for testing."""
    return render(request, "chatbot/demo.html")


# ─── Quick Replies ───────────────────────────────────────────────────────────

@require_GET
def quick_replies(request):
    """Returns the quick-reply cards shown under the first bot message."""
    return JsonResponse({"quick_replies": QUICK_REPLIES})


# ─── Clear Chat ──────────────────────────────────────────────────────────────
@csrf_exempt
@require_POST
def clear_chat(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    session_id = payload.get("session_id")
    if session_id:
        ChatSession.objects.filter(session_id=session_id).delete()

    return JsonResponse({"status": "cleared"})


# ─── Main Chat Endpoint ──────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def chat_api(request):
    """
    Main chat endpoint.
    Expects JSON: { "message": "...", "session_id": "optional-uuid" }
    Returns JSON: { "reply": "...", "session_id": "uuid" }
    """
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    user_message = (payload.get("message") or "").strip()
    session_id = payload.get("session_id")

    if not user_message:
        return JsonResponse({"error": "Message cannot be empty."}, status=400)

    # --- Get or create session ---
    session = None
    if session_id:
        session = ChatSession.objects.filter(session_id=session_id).first()
    if session is None:
        session = ChatSession.objects.create()

    # --- Save user message ---
    ChatMessage.objects.create(session=session, role="user", content=user_message)

    # --- Build conversation history for Mistral ---
    history_qs = session.messages.order_by("-created_at")[:MAX_HISTORY_MESSAGES]
    history = list(reversed(history_qs))

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        role = "assistant" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})

    # --- Call Mistral AI ---
    reply_text = call_mistral(messages)

    # --- Save assistant reply ---
    ChatMessage.objects.create(session=session, role="assistant", content=reply_text)

    return JsonResponse({
        "reply": reply_text,
        "session_id": str(session.session_id),
    })


# ─── Mistral API Call ────────────────────────────────────────────────────────

def call_mistral(messages):
    """Calls the Mistral AI chat completions API and returns the reply text."""

    # CHECK 1: API Key missing
    if not getattr(settings, "MISTRAL_API_KEY", None):
        logger.error("MISTRAL_API_KEY is not set in Django settings.")
        return (
            "🚫 MahaAI isn't fully connected yet — the admin needs to set the "
            "MISTRAL_API_KEY environment variable. Meanwhile, reach us on "
            "WhatsApp at +91 6203495282."
        )

    # CHECK 2: API URL missing
    api_url = getattr(settings, "MISTRAL_API_URL", "https://api.mistral.ai/v1/chat/completions")
    model = getattr(settings, "MISTRAL_MODEL", "mistral-small-latest")

    headers = {
        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 220,
    }

    # --- Make the API call ---
    try:
        logger.info(f"Calling Mistral API — model={model}, messages={len(messages)}")
        response = requests.post(api_url, headers=headers, json=body, timeout=30)
        response.raise_for_status()
        data = response.json()
        reply = data["choices"][0]["message"]["content"].strip()
        logger.info("Mistral API call successful.")
        return reply

    except requests.exceptions.HTTPError as exc:
        logger.error(f"Mistral API HTTP error: {exc.response.status_code} — {exc.response.text}")
        return (
            "⚠️ I'm having trouble with my AI connection right now. "
            "Please try again in a moment, or reach us on WhatsApp at +91 6203495282."
        )

    except requests.exceptions.Timeout:
        logger.error("Mistral API request timed out.")
        return (
            "⏳ The AI took too long to respond. Please try again, or reach us "
            "on WhatsApp at +91 6203495282."
        )

    except requests.exceptions.RequestException as exc:
        logger.exception("Mistral API request failed")
        return (
            "⚠️ I'm having trouble connecting right now. Please try again in "
            "a moment, or reach us directly on WhatsApp at +91 6203495282."
        )

    except (KeyError, IndexError, ValueError) as exc:
        logger.exception(f"Unexpected Mistral API response format: {exc}")
        return (
            "⚠️ Something went wrong while processing that. Please try again."
        )