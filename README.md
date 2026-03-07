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
- **Flower Celery**:  http://localhost:5555
- **Front end**:  http://localhost:5173

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

## Front-end ##
```
http://localhost:5173/
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
| **2** | JIRA Fetch Agent + Import View | 3–4 ✅ |
| **3** | Test Plan Agent + Script Gen Agent | 5–7 ✅ |
| **4** | Git Agent + commit flow | 8–9 ✅ |
| **5** | Execution Agent + Results View | 10–12 |
| **6** | Dashboard + Frontend polish | 13–14 ✅ |

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



---

# PHASE 2

New / changed files
| File | What it does |
|---|---|
| agents/jira_fetch_agent.py | Claude-powered agent — agentic loop with 2 tools: fetch_jira_story and structure_story_data |
| services/jira_service.py | Clean JIRA client wrapper — fetches issues, parses ADF format, extracts acceptance criteria |
| services/tasks.py | Celery task import_jira_story — runs agent in background, updates DB row with real data |
| schemas/story.py | Pydantic schemas for request/response shapes |
| api/routes/stories.py | Import endpoint now dispatches the Celery task + added retry endpoint |
| core/celery_app.py | Switched to autodiscover_tasks to fix worker crash |

        

### How it works end-to-end ###

POST /api/v1/jira/import/PROJ-123

```
  → Creates placeholder DB row  →  Dispatches Celery task
                                           ↓
                              JiraFetchAgent.run("PROJ-123")
                                         ↓
                              Claude calls fetch_jira_story tool
                                         ↓
                              JiraService fetches from JIRA API
                                         ↓
                              Claude analyses + calls structure_story_data
                                         ↓
                              DB row updated with full enriched data
```

GET /api/v1/jira/stories/{id}   ← poll this to see completed import

Apply & restart
```
bash# Copy the 6 new files into your project (matching paths)
docker-compose down
docker-compose up --build

# Test it
bash# Import a story (make sure .env has JIRA_* values set)
curl -X POST http://localhost:8000/api/v1/jira/import/Z33F586ECB-6

# Poll for result
curl http://localhost:8000/api/v1/jira/stories/{story_db_id}
```

# PHASE 3

Here's what was built:

| File | What it does |
|---|---|
| agents/test_plan_agent.py | Claude analyses story → calls structure_test_plan tool → returns TestPlanDocument with full scenario list |
| agents/script_gen_agent.py | Claude generates pytest script per scenario → validates Python AST syntax → retries if syntax error |
| schemas/testplan.py | TestScenario, TestPlanDocument, ScriptResponse Pydantic models |
| services/tasks.py | Two new Celery tasks: generate_test_plan and generate_scripts |
| api/routes/testplans.py | Full router — generate, get plan, list scenarios, delete |
| api/routes/scripts.py | Full router — generate, list, get content, delete |

## End-to-end flow after applying ##

```
# 1. Import a story (Phase 2)
POST /api/v1/jira/import/SCRUM-7

# 2. Generate test plan
POST /api/v1/testplan/generate/{story_db_id}

# 3. Poll until scenarios appear
GET /api/v1/testplan/{story_db_id}

# 4. Generate scripts for all scenarios
POST /api/v1/scripts/generate/{plan_id}

# 5. List generated scripts
GET /api/v1/scripts/{plan_id}

# 6. Read a script's content
GET /api/v1/scripts/{plan_id}/{script_id}/content
```



# Front End #

## File structure ##
frontend/
├── index.html
├── package.json          React 18 + Vite + TanStack Query + Recharts
├── vite.config.js        Proxy /api → backend:8000
└── src/
    ├── index.css         Design system — IBM Plex Mono, dark industrial theme
    ├── main.jsx
    ├── App.jsx           Router + QueryClient
    ├── api/client.js     All API calls in one place
    ├── hooks/useToast.js Toast notifications
    ├── components/
    │   ├── Layout.jsx    Sidebar nav with phase progress indicator
    │   └── ui.jsx        Badge, Button, Card, StatCard, Modal, Input, Toast...
    └── pages/
        ├── Dashboard.jsx     Stats, exec chart, recent stories, phase status
        ├── JiraImport.jsx    Import input, stories table, story detail modal
        ├── TestGeneration.jsx Story selector, plan viewer, scenario cards, script viewer
        └── Execution.jsx     Phase 5 placeholder


What each view does

View    Key interactions
Dashboard   Live stats, pass/fail chart, recent stories, phase progress
JIRA Import   Type story ID → import → poll table → click row for full detail modal
Test Generation   Select story → Generate Plan → expand scenarios → select some/all → Generate   Scripts → View code
ExecutionPhase 5 placeholder with planned feature list


# PHASE 4 #


## What was built ##

File      What it does
agents/git_agent.py   Claude generates branch name + commit message via create_git_commit_plan tool, with deterministic fallback if Claude fails
services/git_service.py   GitPython wrapper — clone/init repo, create branches, write files, stage, commit, push
services/tasks.pycommit_scripts_to_git Celery task — loads scripts, runs GitAgent, updates DB with branch/SHA
api/routes/scripts.py     Two new endpoints: POST /{script_id}/commit (single) and POST /commit-batch/{plan_id} (multiple) + GET /repo/status
frontend/TestGeneration.jsx   Commit button, script selection checkboxes, commit modal with repo status, committed scripts show branch + SHA
docker-compose.yml    Git env vars added to backend + worker, Flower included

End-to-end flow
```
Scripts generated
      ↓
Click "Commit to Git" → select scripts → modal shows repo info
      ↓
POST /api/v1/scripts/commit-batch/{plan_id}
      ↓
Celery task → GitAgent → Claude picks branch name + commit message
      ↓
GitService creates branch → writes files → commits → pushes (if remote)
      ↓
DB updated: is_committed=true, branch_name, commit_sha, git_path
      ↓
Frontend shows branch + short SHA on each script row
```

mkdir -p test_repo

## Git remote changes

What was added

Query logic — when a story is selected and has committed scripts, the unique branch names are extracted and fetched in one parallel Promise.allSettled call against GET /scripts/branch/{name}. Failed fetches (e.g. local-only repo) are silently dropped.

BranchPanel — appears below the story selector card whenever a story is selected:

State             Shows
No commits yet    Dashed placeholder "NO COMMITS YET"
Loading           Spinner with "Fetching branch info…"
Has branches      Green-tinted collapsible card listing each branch

BranchRow — per branch, shows:

Branch name with a ↗ external link to GitHub/GitLab/Bitbucket (auto-detected from remote URL)
Commit SHA pill (amber) + commit message (truncated)
Author name, commit timestamp, and ↑ PUSHED / ○ LOCAL status indicator

The panel stays collapsed/expanded between re-renders via local useState, and re-fetches when scriptsData changes (e.g. after a new commit).