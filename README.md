# Task Tracker

FastAPI + PostgreSQL backend, and a React (Vite) frontend wired to it, for
the task tracker app from the project brief. Single default user (`id = 1`),
no auth yet — see the brief's auth roadmap for later.

## Local dev

Backend + database:

```bash
docker compose up --build
```

- API: http://localhost:8000 (docs at `/docs`)
- Postgres: host port `5433` → container `5432` (user/pass/db: `tracker`).
  Host port is remapped to avoid clashing with any other local Postgres; the
  `api` service talks to `db` over the internal compose network on 5432
  regardless.

On startup the API creates the `users`/`tasks`/`checkins` tables (if missing)
and seeds the default user (`id = 1`).

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173
- Reads the API base URL from `VITE_API_BASE_URL` (see
  [`frontend/.env.example`](frontend/.env.example)); defaults to
  `http://localhost:8000` if unset.

The frontend isn't containerized — it runs as a plain Vite dev server so you
get HMR while iterating. `docker compose up` only brings up the API + DB.

## Run without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# point at a local Postgres, e.g.:
export DATABASE_URL=postgresql+asyncpg://tracker:tracker@localhost:5432/tracker

uvicorn app.main:app --reload
```

## Endpoints

| Method & path                                    | Purpose                                       |
| ------------------------------------------------ | --------------------------------------------- |
| `GET /api/tasks?month=YYYY-MM`                   | List tasks + that month's checkin dates       |
| `POST /api/tasks`                                | Create a task (`{name, icon, color_key}`)     |
| `DELETE /api/tasks/{id}`                         | Delete a task (cascades to checkins)          |
| `GET /api/tasks/{id}/checkins?year=YYYY&month=M` | Checkin dates for one task (`month` optional) |
| `POST /api/tasks/{id}/checkins/toggle`           | Toggle a day's checkin (`{date}`)             |

`icon` is validated against the 20 lucide-react names and `color_key` against
the 5 palette keys in [`app/constants.py`](backend/app/constants.py) — keep
these in sync with the frontend's `ICON_OPTIONS`/`PALETTE`.

## Project layout

```
backend/
  app/
    main.py         FastAPI app, CORS, startup table creation + user seed
    config.py        env-driven settings (DATABASE_URL, CORS_ORIGINS)
    database.py       async engine/session
    models.py          SQLAlchemy models (User, Task, Checkin)
    schemas.py          Pydantic request/response schemas
    constants.py          default user id, icon/color allow-lists
    routers/tasks.py        the 5 endpoints
  Dockerfile
  requirements.txt
frontend/
  src/
    api.js            fetch wrapper for the 5 endpoints
    App.jsx             the wired UI (list view, detail/calendar view, add/delete modals)
    main.jsx, index.css
docker-compose.yml
```

### Frontend wiring notes

- State is no longer local `useState` sample data — `App.jsx` fetches from
  the API on load and after every mutation. `checkinsByTask` accumulates
  known checkin dates per task as different months/years get viewed, so
  re-opening a previously loaded month doesn't refetch.
- `icon`/`color_key` travel as the plain strings the API expects; `App.jsx`
  maps them to the actual lucide icon component / palette colors for
  rendering via `ICON_MAP` / `PALETTE_BY_KEY`.
- "Today" is computed from the real system clock at module load (`new
Date()`), not hardcoded — the original prototype hardcoded Aug 1 2026.
