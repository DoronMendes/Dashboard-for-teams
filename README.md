# Dashboard for Teams

A full-stack workspace for organizing projects, links, teams, bookmarks, and activity in one place.

## Features

- Project and link CRUD
- Tags, categories, bookmarks, pinning, and drag-and-drop ordering
- Workspace membership, teams, roles, and invitations
- Google and Microsoft OAuth authentication
- Activity feed, notifications, and engagement analytics
- Server-side search and filtering
- Responsive RTL/LTR interface with light and dark themes
- Interactive API documentation with Swagger UI

## Tech stack

### Backend

- Python 3.11+
- FastAPI
- PostgreSQL 16
- SQLAlchemy 2.0 (async)
- Alembic migrations
- Pydantic

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- Axios
- dnd-kit

## Project structure

```text
.
├── backend/              FastAPI application, migrations, and tests
├── frontend/             React application
├── docker/               PostgreSQL initialization files
├── docker-compose.yml    Local PostgreSQL and Adminer services
├── .env.example          Backend and database configuration template
└── README.md
```

## Prerequisites

Install the following before starting:

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), or Docker Engine with Compose
- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/) with npm

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/DoronMendes/Dashboard-for-teams.git
cd Dashboard-for-teams
```

### 2. Configure environment variables

macOS/Linux:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
```

Open `.env` and replace the placeholder values. At minimum:

```env
JWT_SECRET_KEY=replace-with-a-long-random-secret
ALLOWED_EMAILS=you@example.com
```

Generate a JWT secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3. Start PostgreSQL

```bash
docker compose up -d db
docker compose ps
```

Wait until the `db` service is reported as healthy.

Optional database browser:

```bash
docker compose up -d adminer
```

Adminer will be available at [http://localhost:8080](http://localhost:8080).

### 4. Install and run the backend

macOS/Linux:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Windows PowerShell:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

The direct `.venv` commands work even when PowerShell script activation is disabled.

Backend URLs:

| URL | Purpose |
| --- | --- |
| [http://127.0.0.1:8010/health](http://127.0.0.1:8010/health) | API health check |
| [http://127.0.0.1:8010/health/db](http://127.0.0.1:8010/health/db) | Database health check |
| [http://127.0.0.1:8010/docs](http://127.0.0.1:8010/docs) | Swagger UI |

### 5. Install and run the frontend

Open another terminal from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## OAuth configuration

OAuth is optional for inspecting the API, but it is required for signing in through the frontend.

### Google

Create a Web application OAuth client and add this authorized redirect URI:

```text
http://127.0.0.1:8010/api/v1/auth/google/callback
```

Then set:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8010/api/v1/auth/google/callback
```

### Microsoft

Register an application and add this redirect URI:

```text
http://127.0.0.1:8010/api/v1/auth/microsoft/callback
```

Then set:

```env
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=http://127.0.0.1:8010/api/v1/auth/microsoft/callback
```

Restart the backend after changing `.env`.

## Testing

Backend tests use a temporary SQLite database by default:

```bash
cd backend
python -m pytest -q
```

Frontend validation:

```bash
cd frontend
npm run typecheck
npm run build
```

## Database migrations

Apply existing migrations after pulling new code:

```bash
cd backend
python -m alembic upgrade head
```

Create a migration after changing SQLAlchemy models:

```bash
python -m alembic revision --autogenerate -m "describe the change"
python -m alembic upgrade head
```

## Configuration notes

- `.env` files contain local secrets and are intentionally ignored by Git.
- `.env.example` files contain only templates and should remain committed.
- The backend reads the root `.env` file.
- The frontend reads `frontend/.env` when Vite starts.
- Restart the relevant development server after changing environment variables.
- PostgreSQL data is stored in the Docker volume `dashboard_pgdata`.
- Copying the source directory does not copy the database volume; use `pg_dump` for backups or migration between machines.

## Common issues

| Problem | Suggested fix |
| --- | --- |
| PostgreSQL connection refused | Start Docker and run `docker compose up -d db`; wait for the health check. |
| Port 5432 is already in use | Change `POSTGRES_PORT` in `.env` and restart the database and backend. |
| CORS error in the browser | Add the frontend origin to `BACKEND_CORS_ORIGINS` without a trailing slash. |
| OAuth redirect mismatch | Ensure the provider redirect URI exactly matches the value in `.env`. |
| PowerShell blocks `Activate.ps1` | Run commands through `.venv\Scripts\python.exe` directly. |
| Vite does not pick up environment changes | Stop and restart `npm run dev`. |

## Security

Never commit:

- `.env`
- OAuth client secrets
- JWT secrets
- database backups
- access tokens

Review `.gitignore` before adding new generated or sensitive files.

## License

No license has been selected yet. Add a license before distributing or reusing the project outside its repository terms.
