# Project Dashboard — Backend (Phase 1)

Internal link-management portal organised by project.
FastAPI · PostgreSQL · SQLAlchemy 2.0 (async) · Alembic · Repository Pattern.

---

## 1. Prerequisites

- Docker + Docker Compose
- Python 3.11+

## 2. Configure

```bash
cp .env.example .env      # adjust the password if you like
```

`.env` is read by **both** `docker-compose.yml` and the FastAPI app, so the
credentials can never drift apart.

## 3. Start PostgreSQL

```bash
docker compose up -d db          # add `adminer` for a DB browser on :8080
docker compose ps                # wait for state = healthy
docker compose logs -f db        # optional
```

## 4. Install the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements-dev.txt
```

## 5. Create the schema

```bash
# still in backend/, venv active
alembic revision --autogenerate -m "create projects and links tables"
alembic upgrade head
```

Verify:

```bash
docker compose exec db psql -U dashboard -d dashboard -c "\dt"
```

## 6. Run the API

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

| URL | Purpose |
| --- | --- |
| http://127.0.0.1:8010/health | Liveness probe |
| http://127.0.0.1:8010/health/db | Readiness probe (pings Postgres) |
| http://127.0.0.1:8010/api/v1/health | Same probe, versioned surface |
| http://127.0.0.1:8010/docs | Swagger UI |

```bash
curl http://127.0.0.1:8010/health
# {"status":"ok","service":"Project Dashboard API","version":"0.1.0","environment":"local"}
```

## 7. Tests

```bash
pytest -q
```

Tests run against a throwaway SQLite file by default — no database setup needed,
and the schema is rebuilt per test so they never interfere with each other.
To run the same suite against the real engine:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://dashboard:dashboard_dev_pw@localhost:5433/dashboard_test"
pytest -q
```

(Create that database first:
`docker compose exec db psql -U dashboard -d dashboard -c "CREATE DATABASE dashboard_test"`.)

---

## API (Phase 2)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/projects` | Create a project (409 if the name is taken) |
| GET | `/api/v1/projects` | List projects with links; `?q=` searches name + description, `?skip=`/`?limit=` paginate |
| GET | `/api/v1/projects/{project_id}` | One project with its links |
| PUT | `/api/v1/projects/{project_id}` | Partial update — omitted fields are left alone |
| DELETE | `/api/v1/projects/{project_id}` | Delete the project and cascade to its links |
| POST | `/api/v1/projects/{project_id}/links` | Add a link to a project |
| GET | `/api/v1/projects/{project_id}/links` | List a project's links; `?category=` filters |
| GET | `/api/v1/links/{link_id}` | One link |
| PUT | `/api/v1/links/{link_id}` | Partial update of title / url / category |
| DELETE | `/api/v1/links/{link_id}` | Delete a link |

Categories: `environment`, `docs`, `code`, `logs`, `monitoring`, `other`.

Errors are uniform: `{"detail": "...", "type": "EntityNotFoundError"}` for 404,
`DuplicateEntityError` for 409, and FastAPI's standard validation body for 422.

### Layering

Routers handle HTTP, services hold the rules, repositories own the queries.
A service never imports fastapi and a repository never decides policy, so a rule
change touches one file. `PUT` is partial-update by design (`exclude_unset`),
which is technically PATCH semantics under a PUT verb — flag it if you'd rather
switch the verb.

---

## Design notes

**Repository Pattern / Open-Closed.** `SQLAlchemyRepository` implements async CRUD
once, generically. A new entity means a new subclass with a `model` attribute —
no edits to existing code. Endpoints depend on the `AbstractRepository`
contract, so the storage engine can be swapped or faked without touching them.

**Transaction ownership.** Repositories `flush` but never `commit`; the
request-scoped session in `app/db/session.py` commits on success and rolls back
on error. Several repositories can therefore take part in one atomic unit of work.

**Categories are VARCHAR, not a native PG enum.** Adding a category is a
one-line change in `app/models/enums.py` instead of an `ALTER TYPE` migration.
Validation lives at the Pydantic boundary.

**Cascade delete** is enforced at two levels: `ON DELETE CASCADE` on the FK
(`passive_deletes=True` lets Postgres do the work) and `delete-orphan` on the
ORM relationship for in-session consistency.

**Adding routes in Phase 2** means registering them in `app/api/v1/router.py`.
`main.py` should not need to change again.

## Common issues

| Symptom | Fix |
| --- | --- |
| `connection refused` on port 5432 | Container not healthy yet, or a local Postgres owns the port — change `POSTGRES_PORT` in `.env`. |
| Alembic autogenerate produces an empty migration | The model isn't imported in `app/db/base.py`. |
| CORS blocked in the browser | Add the exact origin (no trailing slash) to `BACKEND_CORS_ORIGINS`. |
| App can't resolve host `db` | `POSTGRES_HOST` must be `localhost` while uvicorn runs on the host. |


---

# Frontend (Phase 3)

React 19 + TypeScript + Vite 8 + Tailwind v4 + TanStack Query + Axios.

## Run it

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Opens on http://localhost:5173. The backend must be running too.

### Check VITE_API_BASE_URL before anything else

`.env` ships as:

```
VITE_API_BASE_URL=http://127.0.0.1:8010/api/v1
```

Two deliberate departures from the obvious default:

- **Port 8010, not 8000.** Another app on this machine owns 8000.
- **`127.0.0.1`, not `localhost`.** Windows resolves `localhost` to IPv6 `::1`
  first, which on this machine reaches a different process.

If you move the API, change this one line and **restart `npm run dev`** — Vite
reads `.env` at startup only.

CORS is already configured: the backend's `BACKEND_CORS_ORIGINS` includes
`http://localhost:5173`. If you open the UI on a different origin, add it there
and restart uvicorn.

## Layout

```
frontend/
├── index.html
├── vite.config.ts          # react + tailwind plugins, @/ alias, port 5173
├── tsconfig*.json
└── src/
    ├── main.tsx            # QueryClientProvider + root
    ├── App.tsx             # search state, debounced into the grid
    ├── index.css           # @theme design tokens (Tailwind v4 is CSS-first)
    ├── types/              # mirrors the backend Pydantic schemas
    ├── services/
    │   ├── apiClient.ts    # axios instance + ApiError normalisation
    │   └── api.ts          # one function per endpoint
    ├── lib/queryClient.ts  # cache defaults + query keys
    ├── hooks/              # useProjects + mutations, useDebouncedValue
    └── components/
        ├── layout/Header.tsx
        ├── projects/       # ProjectGrid, ProjectCard
        ├── links/LinkRow.tsx
        └── ui/             # CategoryBadge, StatePanel, skeletons
```

## Notes

Category values on the wire are lower-case (`"environment"`), matching the
backend enum; `CATEGORY_LABELS` holds the capitalised display strings. Changing
a label never changes a request.

Search is server-side via the backend's `q` parameter, debounced 250ms, so it
stays correct once the list outgrows one page.

Every axios rejection becomes an `ApiError` with `status`, `kind`, and a
readable `message`, so components never branch on transport details.


---

# Phase 4 — Full CRUD from the UI

Everything can now be done from the dashboard; Swagger is no longer required.

| Action | Where |
| --- | --- |
| Create a project | "New project" in the header, or the button on the empty state |
| Edit / delete a project | Hover a card — pencil and trash appear in its header |
| Add a link | "Add link" at the foot of each card |
| Edit / delete a link | Hover a link row |

## Behaviour worth knowing

**Deleting asks first.** The project confirmation counts the links that will go
with it ("This also deletes its 3 links").

**URLs don't need a scheme.** Type `stg.pay.internal` and `https://` is added
before sending, because the backend rejects a bare host.

**A duplicate project name** shows the server's 409 message on the name field
rather than as a generic banner.

**Toasts** confirm each success and report failures; errors stay on screen
longer than confirmations.

**Keyboard:** Escape closes any dialog, Tab is trapped inside it, focus returns
to the control that opened it. Delete buttons appear on keyboard focus, not only
on hover.

**Validation runs client-side first** (empty names, malformed URLs, length
limits) so obvious mistakes never become a request. The server still validates
everything.

## New files

```
src/
├── components/
│   ├── forms/
│   │   ├── ProjectForm.tsx     create + edit, one component
│   │   └── LinkForm.tsx        create + edit, with category select
│   ├── feedback/Toast.tsx      provider + hook
│   └── ui/
│       ├── Modal.tsx           focus trap, Escape, scroll lock
│       ├── ConfirmDialog.tsx   destructive confirmations
│       ├── Field.tsx           label + control + error wiring
│       └── Button.tsx          variants + busy state
├── hooks/useDialogs.ts         one state for every dialog
└── lib/validation.ts           mirrors the backend's rules
```
