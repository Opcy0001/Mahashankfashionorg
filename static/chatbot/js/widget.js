(function () {
  "use strict";

  const API_BASE = window.MAHA_API_BASE || "";
  const ICONS = { company: "🏢", services: "🎨", ai: "🤖", technology: "💻", contact: "📞", ai_solutions: "✨", internship: "🎓" };

  let sessionId = localStorage.getItem("maha_session_id") || null;
  let isOpen = false;
  let hasGreeted = false;

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function nowLabel() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    const box = document.getElementById("maha-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }

  // ✅ NEW: Convert text to safe HTML with clickable links
  function formatMessage(text) {

    let html = text;


    // Remove markdown heading symbols
    html = html.replace(/^#{1,6}\s*/gm, "");


    // Remove markdown bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "$1");


    // Convert markdown links
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );


    // Convert normal URLs
    html = html.replace(
        /(?<!href=")(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );


    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
}

  function addMessage(role, text) {
    const box = document.getElementById("maha-messages");
    if (!box) return;
    const row = el(`
      <div class="maha-row maha-${role === "user" ? "user" : "bot"}">
        <div class="maha-bubble-avatar">${role === "user" ? "🧑" : "🤖"}</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble"></div>
          <div class="maha-timestamp">${nowLabel()}${role === "user" ? " ✔✔" : ""}</div>
        </div>
      </div>
    `);
    
    // ✅ CHANGED: Use innerHTML with formatMessage instead of textContent
    row.querySelector(".maha-bubble").innerHTML = formatMessage(text);
    
    box.appendChild(row);
    scrollToBottom();
  }

  function showTyping() {
    const box = document.getElementById("maha-messages");
    if (!box) return;
    box.insertAdjacentHTML("beforeend", `
      <div class="maha-row maha-bot maha-typing" id="maha-typing-row">
        <div class="maha-bubble-avatar">🤖</div>
        <div class="maha-bubble-wrap">
          <div class="maha-bubble"><div class="maha-typing-dots"><span></span><span></span><span></span></div></div>
        </div>
      </div>
    `);
    scrollToBottom();
  }

  function hideTyping() {
    document.getElementById("maha-typing-row")?.remove();
  }

  async function loadQuickReplies() {
    const wrap = document.getElementById("maha-quick-replies");
    if (!wrap) return;
    try {
      const res = await fetch(`${API_BASE}/api/quick-replies/`);
      const data = await res.json();
      wrap.innerHTML = "";
      // Strip any leading emoji the backend may already include in label/sub,
      // so ICONS stays the single source of truth for the card icon.
      const stripLeadingEmoji = (str) =>
        (str || "").replace(/^[\p{Extended_Pictographic}\u200d\uFE0F\s]+/gu, "").trim();

      (data.quick_replies || []).forEach((qr) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "maha-quick-card";
        const cleanLabel = stripLeadingEmoji(qr.label);
        const cleanSub = stripLeadingEmoji(qr.sub);
        btn.innerHTML = `<span class="maha-quick-icon">${ICONS[qr.key] || "💬"}</span><span class="maha-quick-text"><strong>${cleanLabel}</strong><span>${cleanSub}</span></span>`;
        btn.addEventListener("click", () => sendMessage(qr.prompt));
        wrap.appendChild(btn);
      });
    } catch (e) { wrap.innerHTML = ""; }
  }

  async function sendMessage(text) {
    const input = document.getElementById("maha-input");
    const sendBtn = document.getElementById("maha-send");
    const trimmed = (text || input?.value || "").trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });
      const data = await res.json();
      hideTyping();
      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("maha_session_id", sessionId);
      }
      addMessage("bot", data.reply || "Sorry, I couldn't process that.");
    } catch (err) {
      hideTyping();
      addMessage("bot", "Couldn't reach the server.");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function openWidget() {
    document.getElementById("maha-widget")?.classList.add("maha-open");
    isOpen = true;
    document.querySelector("#maha-launcher .maha-dot")?.remove();
    if (!hasGreeted) {
      hasGreeted = true;
      addMessage("bot", "Hello 👋\nI'm MahaAI. How can I help you?");
      loadQuickReplies();
    }
    setTimeout(() => document.getElementById("maha-input")?.focus(), 250);
  }

  function closeWidget() {
    document.getElementById("maha-widget")?.classList.remove("maha-open");
    isOpen = false;
  }

  async function clearChat() {
    const btn = document.getElementById("maha-confirm-delete");
    if (btn) btn.disabled = true;

    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/chat/clear/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId })
        });
      } catch (e) { }
    }

    sessionId = null;
    localStorage.removeItem("maha_session_id");
    document.getElementById("maha-messages").innerHTML = "";
    document.getElementById("maha-quick-replies").innerHTML = "";
    addMessage("bot", "Chat cleared! 👋 How can I help you?");
    loadQuickReplies();
    if (btn) btn.disabled = false;
    document.getElementById("maha-delete-confirm").classList.remove("maha-show");
  }

  function buildWidgetDOM() {
    if (document.getElementById("maha-widget")) return;

    // ✅ NEW: Inject link styles automatically
    const style = document.createElement("style");
    style.textContent = `
      .maha-bubble a {
        color: #0066cc;
        text-decoration: none;
        font-weight: 500;
        word-break: break-word;
      }
      .maha-bubble a:hover {
        color: #004499;
      }
      .maha-user .maha-bubble a {
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);

    const launcher = el(`
      <button id="maha-launcher" aria-label="Chat with MahaAI">
        <span class="maha-dot"></span>
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h10v2H7V9zm7 5H7v-2h7v2zm3-6H7V6h10v2z"/></svg>
      </button>
    `);

    const widget = el(`
      <div id="maha-widget">
        <div class="maha-header">
          <div class="maha-avatar">🤖<span class="maha-status"></span></div>
          <div class="maha-header-info">
            <h5>MahaAI</h5>
            <small><span class="maha-online-dot"></span>AI Assistant &nbsp;•&nbsp; Online</small>
          </div>
          <div class="maha-header-actions">
            <button id="maha-delete" aria-label="Delete chat">
              <svg viewBox="0 0 24 24"><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>
            </button>
            <button id="maha-close" aria-label="Close chat">✕</button>
          </div>
          <div id="maha-delete-confirm">
            <p>Delete this conversation?</p>
            <div class="maha-confirm-actions">
              <button id="maha-cancel-delete" type="button">Cancel</button>
              <button id="maha-confirm-delete" type="button">Delete</button>
            </div>
          </div>
        </div>
        <div id="maha-messages"></div>
        <div id="maha-quick-replies"></div>
        <div id="maha-input-bar">
          <input id="maha-input" type="text" placeholder="Type your message..." autocomplete="off" />
          <button id="maha-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="maha-footer-brand">✨ Powered by <strong>Mahashankh AI</strong></div>
      </div>
    `);

    document.body.appendChild(widget);
    document.body.appendChild(launcher);

    document.getElementById("maha-launcher").addEventListener("click", () => isOpen ? closeWidget() : openWidget());
    document.getElementById("maha-close").addEventListener("click", closeWidget);
    document.getElementById("maha-send").addEventListener("click", () => sendMessage());
    document.getElementById("maha-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    document.getElementById("maha-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.toggle("maha-show");
    });
    document.getElementById("maha-cancel-delete").addEventListener("click", () => {
      document.getElementById("maha-delete-confirm").classList.remove("maha-show");
    });
    document.getElementById("maha-confirm-delete").addEventListener("click", clearChat);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidgetDOM);
  } else {
    buildWidgetDOM();
  }
})();
async function sendMessage(text) {
    const input = document.getElementById("maha-input");
    const sendBtn = document.getElementById("maha-send");
    const trimmed = (text || input?.value || "").trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    if (input) input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });

      const data = await res.json();
      hideTyping();

      // ✅ Handle HTTP errors (429, 401, 500, etc.)
      if (!res.ok) {
        const errMsg = data?.error?.message || data?.detail || data?.message || `Error ${res.status}`;
        
        if (res.status === 429) {
          const retryAfter = data?.error?.retry_after;
          const waitMsg = retryAfter ? ` Wait ${retryAfter}s and retry.` : " Wait a minute and try again.";
          addMessage("bot", `⚠️ Rate limited.${waitMsg}`);
          
          // ✅ Optional: Auto-retry after delay
          if (retryAfter) {
            setTimeout(() => {
              addMessage("bot", "🔄 Retrying now...");
              sendMessage(trimmed);
            }, retryAfter * 1000);
          }
        } else if (res.status === 401) {
          addMessage("bot", "⚠️ API key issue. Please contact support.");
        } else if (res.status === 402) {
          addMessage("bot", "⚠️ Credits exhausted. Please top up your account.");
        } else if (res.status >= 500) {
          addMessage("bot", `⚠️ Server error. Please try again later.`);
        } else {
          addMessage("bot", `⚠️ ${errMsg}`);
        }
        return;
      }

      // ✅ Success path
      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("maha_session_id", sessionId);
      }
      addMessage("bot", data.reply || "Sorry, I couldn't process that.");

    } catch (err) {
      hideTyping();
      // ✅ Network errors (offline, DNS fail, CORS, etc.)
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        addMessage("bot", "⚠️ Couldn't reach the server. Check your internet connection.");
      } else {
        addMessage("bot", "⚠️ Something went wrong. Please try again.");
      }
      console.error("Chat error:", err);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }