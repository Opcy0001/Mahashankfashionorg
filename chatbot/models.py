import uuid
from django.db import models


class ChatSession(models.Model):
    """A single visitor's chat session with MahaAI."""

    session_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    visitor_name = models.CharField(max_length=150, blank=True, null=True)
    visitor_contact = models.CharField(max_length=150, blank=True, null=True)

    def __str__(self):
        return f"Session {self.session_id} ({self.created_at:%Y-%m-%d %H:%M})"


class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ("user", "User"),
        ("assistant", "Assistant"),
    )

    session = models.ForeignKey(ChatSession, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"
