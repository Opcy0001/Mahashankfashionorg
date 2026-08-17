/* ============================================================
   MAHASHANKH AI — Chat widget logic for the 3D website
   Talks to the MahaAI Django backend (same origin):
     POST /api/chat/          {message, session_id?} -> {reply, session_id}
     POST /api/chat/clear/    {session_id}            -> {status}
     GET  /api/quick-replies/                          -> {quick_replies}
   ============================================================ */
(function () {
  "use strict";

  var panel = document.getElementById("ai-chat-panel");
  var toggle = document.getElementById("ai-chat-toggle");
  var closeBtn = document.getElementById("ai-chat-close-btn");
  var clearBtn = document.getElementById("ai-chat-clear-btn");
  var messagesEl = document.getElementById("ai-messages");
  var typingEl = document.getElementById("ai-typing");
  var input = document.getElementById("ai-chat-input");
  var sendBtn = document.getElementById("ai-send-btn");
  var badge = document.getElementById("chat-unread-badge");
  var quickBar = document.getElementById("ai-quick-bar");

  if (!panel || !toggle) return;

  var SESSION_KEY = "maha_session_id";
  var sessionId = null;
  try { sessionId = localStorage.getItem(SESSION_KEY); } catch (e) { /* private mode */ }

  var hasGreeted = false;
  var sending = false;

  // ---------- helpers ----------

  function timeLabel() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Convert assistant text to safe, chat-friendly HTML.
  // Text is escaped first, then only known-safe patterns become markup.
  function formatMessage(text) {
    var html = escapeHtml(text || "");
    html = html.replace(/^#{1,6}\s*/gm, "");                       // headings
    html = html.replace(/\*\*(.+?)\*\*/g, "$1");                   // bold
    html = html.replace(/\*(.+?)\*/g, "$1");                       // italic
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,                     // md links
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Group consecutive bullet lines into proper <ul> lists
    var lines = html.split("\n");
    var out = [];
    var inList = false;
    lines.forEach(function (line) {
      var bullet = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
      if (bullet) {
        if (!inList) { out.push("<ul>"); inList = true; }
        out.push("<li>" + bullet[1] + "</li>");
      } else {
        if (inList) { out.push("</ul>"); inList = false; }
        if (line.trim() !== "") out.push(line);
      }
    });
    if (inList) out.push("</ul>");
    return out
      .join("\n")
      .replace(/\n{2,}/g, "<br><br>")  // paragraph gaps
      .replace(/\n/g, "<br>");         // single line breaks
  }

  function scrollBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text) {
    if (!messagesEl) return;
    var row = document.createElement("div");
    row.className = "msg " + (role === "user" ? "user-msg" : "bot-msg");

    var avatar = document.createElement("div");
    avatar.className = "ai-avatar ai-avatar-sm";
    avatar.innerHTML =
      role === "user"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

    var wrap = document.createElement("div");
    wrap.className = "msg-wrap";

    var bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = formatMessage(text);

    var time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = timeLabel();

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesEl.appendChild(row);
    scrollBottom();
  }

  function showTyping() {
    if (typingEl) typingEl.classList.add("visible");
    scrollBottom();
  }

  function hideTyping() {
    if (typingEl) typingEl.classList.remove("visible");
  }

  // ---------- panel ----------

  function openPanel() {
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    if (badge) badge.classList.add("hidden");
    toggle.querySelector(".chat-open-icon").style.display = "none";
    toggle.querySelector(".chat-close-icon").style.display = "";
    if (!hasGreeted) {
      hasGreeted = true;
      addMessage(
        "bot",
        "Hello 👋 I'm MAHASHANKH AI.\nAsk me about our business units, design and tech services, AI tools, internships, or how to get in touch."
      );
    }
    setTimeout(function () { input && input.focus(); }, 250);
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".chat-open-icon").style.display = "";
    toggle.querySelector(".chat-close-icon").style.display = "none";
  }

  // ---------- API ----------

  async function sendMessage(text) {
    var value = (text || (input && input.value) || "").trim();
    if (!value || sending) return;

    addMessage("user", value);
    if (input) input.value = "";
    input && input.style.setProperty("height", "auto");
    sending = true;
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      var res = await fetch("/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value, session_id: sessionId }),
      });

      var data = {};
      try { data = await res.json(); } catch (e) { /* non-JSON body */ }
      hideTyping();

      if (!res.ok) {
        var errMsg = (data && data.error) || "Error " + res.status;
        if (res.status === 429) {
          addMessage("bot", "⚠️ You're sending messages too quickly. Please wait a moment and try again.");
        } else if (res.status === 401 || res.status === 402) {
          addMessage("bot", "⚠️ AI service issue on our side. Please reach us on WhatsApp meanwhile.");
        } else if (res.status >= 500) {
          addMessage("bot", "⚠️ Server error. Please try again in a moment.");
        } else {
          addMessage("bot", "⚠️ " + errMsg);
        }
        return;
      }

      if (data.session_id) {
        sessionId = data.session_id;
        try { localStorage.setItem(SESSION_KEY, sessionId); } catch (e) { }
      }
      addMessage("bot", data.reply || "Sorry, I couldn't process that.");
    } catch (err) {
      hideTyping();
      addMessage("bot", "⚠️ Couldn't reach the server. Please check your connection and try again.");
    } finally {
      sending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  async function clearChat() {
    if (sessionId) {
      try {
        await fetch("/api/chat/clear/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (e) { /* server session may already be gone */ }
    }
    sessionId = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { }
    if (messagesEl) messagesEl.innerHTML = "";
    hasGreeted = false;
    openPanel();
    if (quickBar) quickBar.style.display = "";
  }

  // ---------- events ----------

  toggle.addEventListener("click", function () {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (clearBtn) clearBtn.addEventListener("click", clearChat);
  if (sendBtn) sendBtn.addEventListener("click", function () { sendMessage(); });

  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 90) + "px";
    });
  }

  // Quick chips (messages pre-seeded in the markup's data-msg attributes)
  document.querySelectorAll(".quick-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      sendMessage(chip.getAttribute("data-msg"));
    });
  });
})();
