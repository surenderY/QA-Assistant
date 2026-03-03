# TestGen AI — Multi-Agent Test Automation Platform

> Reads JIRA user stories → generates test plans & pytest scripts → commits to Git → executes tests.
> Built with Python · FastAPI · PostgreSQL · LangChain · Anthropic Claude

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI 0.111 + Uvicorn |
| AI Agents | LangChain 0.2 + Anthropic Claude |
| Database | PostgreSQL 16 + SQLAlchemy 2 (async) |
| Migrations | Alembic |
| Task Queue | Celery + Redis |
| Frontend | React 18 + Vite (Phase 6) |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
testgen/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── dashboard.py
│   │   │   ├── stories.py      # JIRA import
│   │   │   ├── testplans.py
│   │   │   ├── scripts.py
│   │   │   └── executions.py
│   │   ├── agents/             # AI agent implementations (Phase 2+)
│   │   ├── core/
│   │   │   ├── config.py       # Settings (pydantic-settings)
│   │   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   │   ├── security.py     # JWT auth
│   │   │   └── celery_app.py   # Celery instance
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── tasks.py        # Celery background tasks
│   │   └── main.py             # FastAPI app entry point
│   ├── alembic/                # DB migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
├── frontend/                   # React app (Phase 6)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Clone & configure

```bash
git clone <your-repo-url>
cd testgen
cp .env.example .env
# Edit .env — fill in ANTHROPIC_API_KEY, JIRA_*, GIT_* values
```

### 2a. Run with Docker (recommended)

```bash
docker-compose up --build
```

Services started:
- **API**: http://localhost:8000
- **Swagger docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 2b. Run locally (no Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Make sure Postgres & Redis are running, then:
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Run DB migrations

```bash
# Inside Docker:
docker-compose exec backend alembic upgrade head

# Or locally:
cd backend && alembic upgrade head
```

### 4. Verify

```bash
curl http://localhost:8000/health
# → {"status": "ok", "app": "TestGen AI", "env": "development"}
```

---

## API Reference

Full interactive docs at **http://localhost:8000/docs**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Get JWT token |
| GET | `/api/v1/dashboard/stats` | Dashboard summary |
| POST | `/api/v1/jira/import/{story_id}` | Import JIRA story |
| GET | `/api/v1/jira/stories` | List stories |
| GET | `/api/v1/jira/stories/{id}` | Story detail |
| POST | `/api/v1/testplan/generate/{story_id}` | Generate test plan |
| GET | `/api/v1/testplan/{story_id}` | Get test plan |
| POST | `/api/v1/scripts/generate/{plan_id}` | Generate scripts |
| GET | `/api/v1/scripts/{plan_id}` | List scripts |
| POST | `/api/v1/scripts/{id}/commit` | Commit to Git |
| POST | `/api/v1/execute/run` | Run scripts |
| GET | `/api/v1/execute/{id}/results` | Get results |

---

## Development Phases

| Phase | Scope | Weeks |
|---|---|---|
| **1** | Scaffold, DB schema, Auth, Docker | 1–2 ✅ |
| **2** | JIRA Fetch Agent + Import View | 3–4 |
| **3** | Test Plan Agent + Script Gen Agent | 5–7 |
| **4** | Git Agent + commit flow | 8–9 |
| **5** | Execution Agent + Results View | 10–12 |
| **6** | Dashboard + Frontend polish | 13–14 |

---

## Running Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `DATABASE_URL` | Async PostgreSQL URL |
| `JIRA_SERVER_URL` | Your Atlassian instance |
| `JIRA_API_TOKEN` | JIRA personal access token |
| `GIT_REMOTE_URL` | Test scripts repository URL |
| `GIT_TOKEN` | Personal access token for Git push |
| `SECRET_KEY` | JWT signing secret — change in production |
