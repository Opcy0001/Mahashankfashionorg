# MahaAI — Mahashankh Chat Widget

A drop-in AI chat widget for **mahashankh.com**, styled like the reference design
(purple gradient header, floating launcher, quick-reply cards). Backend is Django,
AI replies come from the **Mistral AI** API, and the widget is grounded on real
Mahashankh company info (services, AI tools, internships, contact details).

## Stack
- **Backend:** Django 4/5 (`chatbot` app) + `requests` to call Mistral
- **AI:** Mistral AI Chat Completions API (`mistral-small-latest` by default)
- **Frontend:** Vanilla HTML/CSS/JS widget + Bootstrap 5 demo page
- **DB:** SQLite (stores chat sessions & messages for history/analytics)

## 1. Setup

```bash
cd mahashankh_chatbot
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then fill in MISTRAL_API_KEY
export $(cat .env | xargs)       # or use django-environ / python-dotenv

python manage.py migrate
python manage.py createsuperuser # optional, to view chats in /admin/
python manage.py runserver
```

Get a Mistral API key from **https://console.mistral.ai/** and put it in `.env` as
`MISTRAL_API_KEY`.

Visit **http://127.0.0.1:8000/** to see the demo page with the widget, or
**http://127.0.0.1:8000/admin/** to view stored chat sessions.

## 2. Embedding on mahashankh.com

You only need 3 lines on any page of the real site (WordPress theme footer, etc.):

```html
<link rel="stylesheet" href="https://YOUR-BACKEND-DOMAIN/static/chatbot/css/widget.css">
<script>window.MAHA_API_BASE = "https://YOUR-BACKEND-DOMAIN";</script>
<script src="https://YOUR-BACKEND-DOMAIN/static/chatbot/js/widget.js"></script>
```

Since mahashankh.com is WordPress and this backend is a separate Django app, host
the Django app on its own domain/subdomain (e.g. `chatbot.mahashankh.com`), then
add the snippet above into the WordPress theme footer or via a "Insert Headers and
Footers" plugin. CORS is already enabled in `settings.py` (tighten
`CORS_ALLOW_ALL_ORIGINS` to just your domain before going live).

## 3. How it answers questions

`chatbot/knowledge_base.py` contains a system prompt built from the real content on
mahashankh.com — services (textile, fashion, interior, tiles, wallpaper, luxury,
saree design), AI tools (Ajupy AI, Pattern/Textile/Tiles/Fashion/Saree Designer AI,
3D Wallpaper/Home Presenter), internship programs, and contact info (phone,
WhatsApp, address, working hours, Calendly link). Edit this file any time the
website content changes — no code changes needed elsewhere.

## 4. API endpoints

| Method | Endpoint                | Purpose                                   |
|--------|--------------------------|--------------------------------------------|
| POST   | `/api/chat/`             | `{ message, session_id }` → `{ reply, session_id }` |
| GET    | `/api/quick-replies/`    | Returns the 4 quick-reply cards            |

## 5. Project structure

```
mahashankh_chatbot/
├── manage.py
├── requirements.txt
├── mahashankh_chatbot/       # Django project settings
├── chatbot/                  # Django app
│   ├── models.py             # ChatSession, ChatMessage
│   ├── views.py              # Mistral API integration + chat endpoint
│   ├── knowledge_base.py     # Company system prompt & quick replies
│   └── urls.py
├── static/chatbot/
│   ├── css/widget.css        # Widget styling (purple theme)
│   └── js/widget.js          # Widget logic (vanilla JS)
└── templates/chatbot/demo.html  # Bootstrap demo page
```

## 6. Production notes
- Set `DJANGO_DEBUG=False`, a real `DJANGO_SECRET_KEY`, and restrict
  `DJANGO_ALLOWED_HOSTS` / `CORS_ALLOW_ALL_ORIGINS` before deploying.
- Run behind gunicorn + nginx (gunicorn already in `requirements.txt`).
- Consider swapping SQLite for Postgres/MySQL if chat volume grows.
