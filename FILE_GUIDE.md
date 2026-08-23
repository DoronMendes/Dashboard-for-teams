# Project Dashboard — What Every File Does

A file-by-file reference for the codebase as it stands after Phases 1–3.

Read it in whatever order suits you, but the two "how a request travels" walkthroughs
near the end are the fastest way to see how the pieces connect.

---

## The shape of the thing

Both halves are layered, and each layer only knows about the one below it:

```
Backend                          Frontend
─────────────────────────        ─────────────────────────
routers   (HTTP)                 components  (what you see)
   ↓                                ↓
services  (the rules)            hooks       (fetching + caching)
   ↓                                ↓
repositories (queries)           services    (HTTP calls)
   ↓                                ↓
models    (tables)               types       (data shapes)
```

This is why new features slot in without breaking old ones. A rule change touches a
service. A query change touches a repository. Neither one forces the other to change.

---

# Root folder

### `docker-compose.yml`
Defines the PostgreSQL 16 container. Notable parts: a **healthcheck** so you can tell
when the database is actually ready rather than merely started; a **named volume**
(`dashboard_pgdata`) so your data survives `docker compose down`; and a configurable
host port, which is what let you move to 5433 when another project was already using
5432. Also includes Adminer, an optional web database browser on port 8080.

### `.env`
Your local settings — database credentials, ports, allowed CORS origins. Read by
**both** docker-compose and the FastAPI app, which is deliberate: one file means the
container and the application can never disagree about the password.

Yours has `POSTGRES_PORT=5433`.

### `.env.example`
The committed template. `.env` is git-ignored (it holds secrets); this one is checked
in so a teammate knows which variables to set. Copy it to `.env` and edit.

### `.gitignore`
Keeps `__pycache__`, `.venv`, `.env`, and caches out of version control.

### `README.md`
Setup instructions, the API endpoint table, design notes, and a troubleshooting
section covering the specific issues you hit.

---

# Backend

## Configuration and dependencies

### `backend/requirements.txt`
Production dependencies, exact-pinned. FastAPI, SQLAlchemy, asyncpg (the async
PostgreSQL driver), Alembic, Pydantic. Pinning means a fresh install gets the same
versions that were tested, not whatever released this morning.

### `backend/requirements-dev.txt`
Everything above plus test tooling: pytest, pytest-asyncio, **aiosqlite** (the one
that was missing and made all 34 tests error), httpx, and ruff.

### `backend/pyproject.toml`
Configures ruff (linting, 100-character lines) and pytest (`asyncio_mode = "auto"` so
async tests run without decorators, `pythonpath = ["."]` so `import app` resolves).

### `backend/alembic.ini`
Alembic's config file. Note the `sqlalchemy.url` line is deliberately **empty** — the
URL is injected at runtime from your settings, so credentials live in exactly one place.

---

## Migrations

### `backend/alembic/env.py`
Runs on every Alembic command. Pulls the database URL from `app.core.config` and
imports `app.db.base` so every model is registered before Alembic compares the code
against the live database.

### `backend/alembic/script.py.mako`
The template for generated migration files.

### `backend/alembic/versions/`
Your actual migrations. Contains the one you generated — the file that created the
`projects` and `links` tables. **Never delete these**; they're the history of your
schema.

---

## Application core

### `backend/app/main.py`
The entry point — what `uvicorn app.main:app` loads. Creates the FastAPI app,
enables **CORS** (so the browser lets your frontend call the API), registers error
handlers, and mounts the routers. Health endpoints are mounted twice: unversioned at
`/health` for infrastructure probes, and under `/api/v1/` for API clients.

Written as a factory function (`create_app()`) so tests can build an isolated instance.

### `backend/app/core/config.py`
Every setting in one typed class. Reads `.env`, validates types, and builds the
database URL from the individual parts.

Contains a fix worth knowing about: `BACKEND_CORS_ORIGINS` is marked `NoDecode`
because pydantic-settings otherwise tries to JSON-parse list fields *before*
validators run, which breaks comma-separated values.

### `backend/app/core/exceptions.py`
Defines `EntityNotFoundError` (→ 404) and `DuplicateEntityError` (→ 409), plus the
handlers that turn them into HTTP responses.

The point: business code raises a meaningful error and stays ignorant of HTTP. Adding
a new error type means adding a subclass — the existing handlers keep working.

---

## Database plumbing

### `backend/app/db/base_class.py`
The declarative `Base` all models inherit, plus two mixins: `UUIDPrimaryKeyMixin`
(UUID primary keys generated app-side) and `TimestampMixin` (`created_at` /
`updated_at` maintained by the database clock).

Also sets a naming convention for constraints, so Alembic generates readable,
stable names like `fk_links_project_id_projects` instead of database-assigned ones.

### `backend/app/db/session.py`
Creates the async engine and the per-request session dependency. The session
**commits on success and rolls back on failure** — this is why repositories never
commit, and why one endpoint can use several repositories in a single atomic
transaction.

### `backend/app/db/base.py`
Just imports. Alembic needs every model loaded before it reads the metadata;
otherwise autogenerate happily writes a migration that *drops* your tables.

**When you add a model in Phase 4, import it here.**

---

## Models — the database tables

### `backend/app/models/enums.py`
`LinkCategory`: environment, docs, code, logs, monitoring, other.

Stored as VARCHAR rather than a native PostgreSQL enum. That's a deliberate trade:
adding a category later is a one-line code change instead of an `ALTER TYPE`
migration. Validation happens at the Pydantic boundary instead.

### `backend/app/models/project.py`
The `projects` table: `id`, `name` (unique, indexed), `description`, timestamps. The
`links` relationship uses `selectin` loading so reading a project never triggers extra
lazy queries.

### `backend/app/models/link.py`
The `links` table. The foreign key carries **`ON DELETE CASCADE`**, so deleting a
project removes its links at the database level. There's also a composite index on
`(project_id, category)` matching the dashboard's main read pattern.

---

## Schemas — request and response validation

### `backend/app/schemas/common.py`
Shared building blocks: the `from_attributes` config that lets Pydantic read
SQLAlchemy objects, an `IdentifiedModel` with id and timestamps, and the health-check
response shapes.

### `backend/app/schemas/project.py`
`ProjectCreate`, `ProjectUpdate`, `ProjectResponse` (which nests its links).

`ProjectUpdate` has all fields optional and `extra="forbid"` — send only what changes,
and a typo like `{"nmae": "x"}` gets rejected instead of silently ignored.

### `backend/app/schemas/link.py`
`LinkCreate`, `LinkUpdate`, `LinkResponse`. Validates URL shape but stores the
caller's original string. Shared validators live in a mixin class so the create and
update schemas can't drift apart.

---

## Repositories — the only place SQL lives

### `backend/app/repositories/base.py`
Generic async CRUD, written once. A new entity means a subclass with a `model`
attribute and no edits here — that's the Open/Closed Principle in practice.

Contains a subtle fix: reads use `populate_existing` so an object already loaded in
the session gets refreshed. Without it, a project fetched after links were added
through a different repository would still report zero links.

### `backend/app/repositories/project.py`
Adds `search()` (case-insensitive match on name **and** description — this is what
your search box calls) and `name_taken()`, which can exclude the row being updated so
a project can keep its own name.

### `backend/app/repositories/link.py`
Listing by project with optional category filter.

---

## Services — the business rules

### `backend/app/services/project.py`
Where the decisions live: reject a duplicate name with 409, raise 404 for a missing
project, apply partial updates with `exclude_unset` so omitted fields keep their
values.

Notice this file imports no FastAPI. It doesn't know HTTP exists.

### `backend/app/services/link.py`
Checks the parent project exists **before** inserting a link. Without this you'd get
an ugly foreign-key 500 instead of a clean 404.

---

## API layer

### `backend/app/api/deps.py`
Dependency injection wiring: session → repositories → services. Also defines shared
pagination (`skip`/`limit`) so every list endpoint behaves identically.

Overriding one provider here swaps an entire layer — which is exactly how the tests
substitute a test database.

### `backend/app/api/v1/router.py`
Collects all v1 routers in one place.

**This is where Phase 4 routers get registered.** `main.py` shouldn't need to change
again.

### `backend/app/api/v1/endpoints/health.py`
`/health` (is the process alive?) and `/health/db` (can it actually reach Postgres?).
The second is what you used to confirm the whole chain was wired.

### `backend/app/api/v1/endpoints/projects.py`
Five project routes plus two nested link routes (`POST` and `GET` on
`/projects/{id}/links`). Links are created through their parent because a link can't
exist without a project.

### `backend/app/api/v1/endpoints/links.py`
Get, update, delete for individual links by their own id.

---

## Tests

### `backend/tests/conftest.py`
Shared fixtures. Runs against a throwaway SQLite file by default — no database setup
needed — with a **fresh schema per test**, so tests never contaminate each other.

Sets `PRAGMA foreign_keys=ON`, without which SQLite silently ignores `ON DELETE
CASCADE` and the cascade tests would pass for the wrong reason.

Set `TEST_DATABASE_URL` to run the same suite against real PostgreSQL.

### `backend/tests/test_health.py`
Three tests: both health routes and a CORS preflight check.

### `backend/tests/test_projects.py`
Nineteen tests. Creation, duplicate rejection, search by name and description,
pagination, partial updates, 404s, and two cascade tests.

Those two are worth understanding. The first verifies SQLAlchemy's cascade. The
second deletes via **raw SQL**, bypassing the ORM entirely, so the only thing that can
remove the child rows is the database constraint itself. I verified it genuinely fails
when foreign keys are disabled — otherwise it would have been testing nothing.

### `backend/tests/test_links.py`
Twelve tests: creation under a project, category defaults and validation, malformed
URL rejection, 404 on a missing parent, category filtering, partial updates, deletion.

---

# Frontend

## Configuration

### `frontend/package.json`
Dependencies, exact-pinned to versions I tested: React 19.2.8, Vite 8.2.1,
Tailwind 4.3.3, TanStack Query, Axios, Lucide icons.

Scripts: `dev` (development server), `build` (typecheck + production build),
`typecheck`.

### `frontend/vite.config.ts`
Registers the React and Tailwind plugins, maps the `@/` import alias to `src/`, and
pins the dev server to port 5173 with `strictPort` so a port clash fails loudly
instead of silently moving.

### `frontend/tsconfig.json` + `.app.json` + `.node.json`
TypeScript settings, split because app code and build tooling target different
environments. Strict mode is on.

### `frontend/index.html`
The page shell. Loads Space Grotesk, IBM Plex Sans, and IBM Plex Mono.

### `frontend/.env`
`VITE_API_BASE_URL` — where the frontend looks for your API.

Two deliberate departures from the obvious default, both specific to your machine:
**port 8010** (something else owns 8000) and **`127.0.0.1` rather than `localhost`**
(Windows resolves `localhost` to IPv6 first, where your API isn't listening).

Vite reads this at startup only — **change it and you must restart `npm run dev`**.

---

## Source

### `frontend/src/main.tsx`
Mounts React and wraps the app in `QueryClientProvider`, which is what gives every
component access to the shared cache.

### `frontend/src/App.tsx`
Holds the search text and passes a debounced copy to the grid. The input stays
instant; the network request waits for a pause in typing.

### `frontend/src/index.css`
All design tokens, in Tailwind v4's CSS-first `@theme` block. Colours, fonts, the
monospace label utility, visible keyboard focus, and reduced-motion support.

**There is no `tailwind.config.js`** — v4 doesn't use one. If you follow a v3 tutorial
and run `npx tailwindcss init`, it will fail, because that command no longer exists.

### `frontend/src/types/index.ts`
TypeScript mirrors of the backend schemas, so a shape mismatch is a compile error
rather than a runtime surprise.

Keeps wire values (`"environment"`) separate from display labels (`"Environment"`),
so renaming a label never changes a request.

### `frontend/src/services/apiClient.ts`
The Axios instance plus **error normalisation**. Every failure becomes one `ApiError`
type with `status`, `kind`, and a readable message — so components never branch on
Axios internals.

I tested all three paths against a live server: a 409 arrives as `isConflict` with
`kind: "DuplicateEntityError"`; a 404 as `isNotFound`; an unreachable backend produces
a message telling you to check `VITE_API_BASE_URL`.

### `frontend/src/services/api.ts`
One function per backend endpoint: `getProjects`, `createProject`, `updateProject`,
`deleteProject`, `createLink`, `updateLink`, `deleteLink`. Nothing else in the app
touches Axios.

### `frontend/src/lib/queryClient.ts`
Cache configuration. Notably: **don't retry 4xx errors** — retrying a 404 just delays
the message the user needs.

### `frontend/src/hooks/useProjects.ts`
`useProjects(search)` for reading, plus six mutation hooks for writing. Each mutation
invalidates the project list on success, so the UI refreshes itself.

The mutations are written and wired but **nothing calls them yet** — that's Phase 4.

### `frontend/src/hooks/useDebouncedValue.ts`
Delays a fast-changing value. Without it, typing "payments" would fire eight requests.

---

## Components

### `frontend/src/components/layout/Header.tsx`
App title, live search box with a clear button, and the "New project" button
(currently a placeholder alert). The logo is six dots — one per category, the board in
miniature.

### `frontend/src/components/projects/ProjectGrid.tsx`
Fetches projects and handles all four states: loading skeletons, error with a retry
button, empty (different message depending on whether you're searching), and the
populated grid.

### `frontend/src/components/projects/ProjectCard.tsx`
One project panel: name, description, per-category tallies, and its links sorted by
category.

### `frontend/src/components/links/LinkRow.tsx`
A single link. Splits the URL so the **host reads in monospace with the path dimmed** —
you can tell `stg.pay.internal` from `prod.pay.internal` at a glance. Falls back
gracefully if a URL won't parse.

### `frontend/src/components/ui/CategoryBadge.tsx`
The coloured dot and label. Colour is spent almost entirely here, because on this
screen the category *is* the information.

### `frontend/src/components/ui/StatePanel.tsx`
Empty, error, and loading states. An empty screen is an invitation to act; an error
says what happened and what to do about it.

---

# How a request travels

## Reading: the dashboard loads

```
ProjectGrid renders
   → useProjects("") hook
   → api.getProjects()
   → apiClient (axios)  ──HTTP──▶  GET /api/v1/projects
                                      → projects.py router
                                      → ProjectService.list()
                                      → ProjectRepository.search()
                                      → SQL SELECT with links
   ◀────────────────────────────── JSON
   → TanStack Query caches it
   → ProjectCard renders each one
```

## Writing: creating a link (Phase 4)

```
POST /api/v1/projects/{id}/links
   → router validates the body against LinkCreate
   → LinkService checks the project exists  ── missing? 404
   → LinkRepository.create() adds and flushes
   → session commits when the request succeeds
   → response serialised through LinkResponse
```

---

# The parts you'd most likely change

| To do this | Edit this |
| --- | --- |
| Add a link category | `backend/app/models/enums.py`, then `frontend/src/types/index.ts` |
| Add an API endpoint | new file in `endpoints/`, register in `api/v1/router.py` |
| Change a business rule | the relevant file in `backend/app/services/` |
| Change a query | the relevant file in `backend/app/repositories/` |
| Add a database table | new model, import in `db/base.py`, run Alembic |
| Change colours or fonts | `frontend/src/index.css` (the `@theme` block) |
| Point at a different API | `frontend/.env`, then restart `npm run dev` |

---

# Running it, start to finish

Three PowerShell windows. Two of them will be blocked by a running server.

**Window 1 — database and API**

```powershell
cd "...\project-dashboard"
docker compose up -d db
docker compose ps          # wait for: healthy
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8010
```

**Window 2 — frontend**

```powershell
cd "...\project-dashboard\frontend"
npm run dev
```

**Window 3 — free, for commands**

```powershell
cd "...\project-dashboard\backend"
.\.venv\Scripts\Activate.ps1
pytest -q
```

| What | Where |
| --- | --- |
| Dashboard | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8010/docs |
| Health check | http://127.0.0.1:8010/health/db |
| Database browser | http://localhost:8080 (if Adminer is running) |

---

# Three things that cost real time

**`.env` changes need a server restart.** Both servers read their environment at
startup. Code changes hot-reload; configuration does not.

**`localhost` is ambiguous on Windows.** It can resolve to IPv6 `::1` or IPv4
`127.0.0.1`. When something seems unreachable, try `127.0.0.1` before assuming
anything is broken.

**Ports collide across projects.** You're running Pulseboard alongside this. This
project is Postgres **5433**, API **8010**, frontend **5173**. A 404 from a server you
believe is running usually means a neighbour has the port.
