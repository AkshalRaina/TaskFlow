# TaskFlow

A mini project-management app. Users register, create projects, add tasks with a status, priority and due date, and track progress on a dashboard.

- **Frontend:** Next.js (App Router) + React + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL with the Prisma ORM
- **Auth:** bcrypt password hashing + JWT in an httpOnly cookie

![TaskFlow architecture](docs/architecture.svg)

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design decisions.

---

## Features

- Register, log in and log out (email + password)
- **Team projects with roles:** whoever creates a project is its **Owner**. The owner and admins **invite people by email**, make them Admin or Member, or remove them. This happens in a "Members & roles" tab on each project. The owner can't be removed or demoted.
- **Email invitations:** the invite link works once, only for the invited email, and **expires after 24 hours**. New people sign up straight from the link; a "Registration successful" popup confirms they've joined.
- **Who can do what:**
  - **Owners/admins** assign tasks to anyone, edit or delete any task, and edit or delete the project.
  - **Members** see only **tasks assigned to them**. They can change those tasks' status and comment on them.
  - Members can also **create tasks for themselves**. These are always assigned to them, and they can edit or delete them.
  - People outside the project can't see it at all.
  - The "What each role can do" table is shown to owners and admins.
- Tasks: title, description, status (To Do / In Progress / Done), priority (Low / Medium / High), due date, **assignee** (unassigned by default)
- **Task page:** click any task to open it. It has a **history timeline** (every change, who made it and when) and a **comments** section.
- **@mentions:** type `@` in a comment to tag **anyone in the project**; they get an email.
  - A tagged member can **open that task to read and reply**, even if it isn't assigned to them, but can't change it.
  - Tagged tasks don't appear on their board or in their counts. A **"Mentioned you"** card on their dashboard links to them.
- Search tasks by title, combined with status, priority, project, due date (overdue / due soon) and, for admins, **assignee** filters
- **Dashboard:** clickable stat cards and status chart (each opens the matching task list), a **"Needs attention"** list (overdue or due within 3 days: your own tasks, plus your team's in projects you own or admin), and progress per project. Lists show 4 items with a "View all" link.
- Every rule is enforced on the server; the UI just hides what you can't do
- Loading, error and empty states; responsive layout (sidebar on desktop, top bar on mobile)

---

## Quick start (Docker)

Needs Docker Desktop.

```bash
docker compose up --build
```

| Service  | URL                              |
| -------- | -------------------------------- |
| App      | http://localhost:3000            |
| API      | http://localhost:4000            |
| API docs | http://localhost:4000/api/docs   |
| Emails   | http://localhost:8025 (Mailpit inbox: invitations and @mention emails land here) |

Migrations run automatically when the backend container starts. To load the demo data (needs Node 22 on your machine):

```bash
cd backend && npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskflow npm run db:seed
```

Then sign in with any of the demo accounts (password **password123**):

| Email                | Name        | Roles                                                              |
| -------------------- | ----------- | ------------------------------------------------------------------ |
| `demo@taskflow.dev`  | Alex Morgan | Owner of Website Redesign, Mobile App, Customer Support Portal and Q4 Planning; member of Marketing Campaign |
| `sam@taskflow.dev`   | Sam Lee     | Member of Website Redesign and Mobile App                          |
| `priya@taskflow.dev` | Priya Shah  | Owner of Marketing Campaign, admin of Website Redesign, member of Customer Support Portal |

Log in as Alex and then as Sam to see the difference between the owner and member views.

> If port 5432 is already used by a local Postgres, start with `DB_PORT=5433 docker compose up --build` and use port 5433 in the seed command.

---

## Running locally without Docker

Needs Node.js 22+ and PostgreSQL 14+.

### 1. Database

Create two databases: one for the app and one for the tests (the tests wipe theirs).

```bash
createdb taskflow
createdb taskflow_test
```

Or start only the database from the compose file: `docker compose up db`.

### 2. Backend

```bash
cd backend
cp .env.example .env        # then edit the values (see below)
npm install
npm run db:migrate          # creates the tables
npm run db:seed             # optional: demo user + sample data
npm run dev                 # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable            | Required  | Example                                                    | Purpose                                         |
| ------------------- | --------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`      | yes       | `postgresql://postgres:postgres@localhost:5432/taskflow`   | Postgres connection for the app                 |
| `JWT_SECRET`        | yes       | output of `openssl rand -hex 32`                           | Signs login tokens. Keep it secret.             |
| `TEST_DATABASE_URL` | for tests | `postgresql://postgres:postgres@localhost:5432/taskflow_test` | Database the tests use; its name must contain `test` |
| `CLIENT_URL`        | no        | `http://localhost:3000`                                    | Frontend origin allowed by CORS, and the base of links in emails |
| `PORT`              | no        | `4000`                                                     | API port                                        |
| `SMTP_HOST`         | no        | `localhost`                                                | Mail server. **Empty = emails are printed in the backend terminal** (with their links) instead of sent |
| `SMTP_PORT`         | no        | `1025` (Mailpit) / `587`                                   | Mail server port                                |
| `SMTP_USER` / `SMTP_PASS` | no  |                                                            | Mail server login, if it needs one              |
| `EMAIL_FROM`        | no        | `TaskFlow <no-reply@taskflow.local>`                       | Sender shown on emails                          |

### Emails in local development

Invitations and @mention emails need somewhere to go. Pick one:

- **Do nothing:** with `SMTP_HOST` empty, each email (including the invite link) is printed in the terminal running `npm run dev`. Copy the link into your browser.
- **A local inbox:** run [Mailpit](https://mailpit.axllent.org) (`brew install mailpit && mailpit`, or it's already in `docker compose`), set `SMTP_HOST=localhost` and `SMTP_PORT=1025`, and read the emails at http://localhost:8025.
- **Real email:** put any SMTP provider's settings (e.g. SendGrid, Mailgun, Gmail app password) in the `SMTP_*` variables.

### Frontend (`frontend/.env.local`)

| Variable              | Example                 | Purpose                                                           |
| --------------------- | ----------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Where the browser sends API requests (built into the bundle)      |

No real secrets are committed. Only `.env.example` files are in the repo.

---

## Database

- Schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
- Migrations: [`backend/prisma/migrations/`](backend/prisma/migrations/)
- Seed script: [`backend/prisma/seed.ts`](backend/prisma/seed.ts)

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run db:migrate`   | Create/apply migrations in development          |
| `npm run db:deploy`    | Apply existing migrations (production / CI)     |
| `npm run db:seed`      | Recreate the demo users and sample data         |

---

## Tests

The backend has **unit tests** for pure logic (what goes into a task's history, HTML-escaping in emails, progress maths) and **integration tests** (real HTTP requests against a real Postgres database) for auth, projects, members and roles, invitations, tasks, assignees, filters, pagination, task history, comments and mentions, and the dashboard numbers. Emails are captured in memory during tests, so the tests can follow real invite links. Most importantly, they cover the **rules**:
- outsiders get 404
- members get 403 on owner/admin actions
- members only see their own tasks
- the owner can't be removed
- invite links expire, work once, and only for the invited email

```bash
cd backend
npm test        # needs TEST_DATABASE_URL in .env
```

Other checks:

```bash
cd backend  && npm run lint && npm run typecheck
cd frontend && npm run lint && npm run build
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of these on every push and pull request.

---

## API

Interactive Swagger docs: **http://localhost:4000/api/docs** (source: [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)).

| Method | Path                    | Description                                                    |
| ------ | ----------------------- | -------------------------------------------------------------- |
| POST   | `/api/auth/register`    | Create an account (logs you in). With `inviteToken`, also joins that project |
| POST   | `/api/auth/login`       | Log in (sets the httpOnly cookie)                              |
| POST   | `/api/auth/logout`      | Log out (clears the cookie)                                    |
| GET    | `/api/auth/me`          | Current user                                                   |
| GET    | `/api/projects`         | Projects I'm in, with my role, member count, task counts, progress |
| POST   | `/api/projects`         | Create a project (you become its admin)                        |
| GET    | `/api/projects/:id`     | One project                                                    |
| PATCH  | `/api/projects/:id`     | Update a project (admin)                                       |
| DELETE | `/api/projects/:id`     | Delete a project and its tasks (admin)                         |
| GET    | `/api/projects/:id/members` | List members and their roles                               |
| PATCH  | `/api/projects/:id/members/:userId` | Make someone Admin or Member (owner/admin)         |
| DELETE | `/api/projects/:id/members/:userId` | Remove a member (owner/admin) or leave (yourself)  |
| GET    | `/api/projects/:id/invitations` | Pending invitations (owner/admin)                      |
| POST   | `/api/projects/:id/invitations` | Email an invite link (owner/admin)                     |
| DELETE | `/api/projects/:id/invitations/:invitationId` | Cancel an invitation (owner/admin)       |
| GET    | `/api/invitations/:token` | What an invite link is for (public)                          |
| POST   | `/api/invitations/:token/accept` | Join the project (signed in as the invited email)     |
| GET    | `/api/tasks`            | Tasks I can see. Query: `projectId`, `status`, `priority`, `search`, `assigneeId` (id or `unassigned`), `due` (`overdue` / `soon` / `attention`), `page`, `limit` (max 100) |
| POST   | `/api/tasks`            | Create a task. Owner/admin: any `assigneeId`. Member: always assigned to themselves |
| GET    | `/api/tasks/:id`        | One task                                                       |
| GET    | `/api/tasks/:id/activity` | The task's history                                           |
| PATCH  | `/api/tasks/:id`        | Update a task, recorded in its history. Members: tasks they created (not the assignee), otherwise only `status` |
| DELETE | `/api/tasks/:id`        | Delete a task (owner/admin, or a member's own task)            |
| GET    | `/api/tasks/:id/comments` | Comments, plus who can be @mentioned (everyone in the project) |
| POST   | `/api/tasks/:id/comments` | Add a comment (`mentionedUserIds` get an email and read/comment access to the task) |
| DELETE | `/api/tasks/:id/comments/:commentId` | Delete a comment (author, or owner/admin)         |
| GET    | `/api/dashboard`        | Totals, completed, overdue, tasks by status, "needs attention" list, latest mentions |
| GET    | `/api/health`           | Health check (API + database)                                  |

Errors always have the same shape:

```json
{ "error": { "message": "Validation failed", "details": [{ "field": "title", "message": "Title is required" }] } }
```

Status codes: `200` OK, `201` created, `204` deleted, `400` invalid input, `401` not logged in, `403` your role can't do this (or the invite is for another email), `404` not found (or you can't see it), `409` conflict (email already registered, already a member, invite already used), `410` invite link expired.

---

## Project structure

```
TaskFlow/
├── backend/
│   ├── prisma/               schema, migrations, seed
│   ├── docs/openapi.yaml     API documentation
│   ├── src/
│   │   ├── app.ts            Express app (middleware + routes)
│   │   ├── server.ts         starts the server
│   │   ├── config.ts         environment variables
│   │   ├── middleware/       requireAuth, error handler
│   │   ├── email/            sending emails + templates (invitations, mentions)
│   │   └── modules/          auth, projects, invitations, tasks (+ comments), dashboard
│   │       └── <module>/     *.routes.ts (HTTP) → *.service.ts (logic + DB) ; *.schemas.ts (validation)
│   └── tests/                integration tests
├── frontend/
│   ├── app/(auth)/           login, register
│   ├── app/(app)/            dashboard, projects, projects/[id], tasks, tasks/[id] (logged-in pages)
│   ├── app/invite/[token]/   the page invitation emails link to
│   ├── components/           TaskCard, ProjectCard, forms, TasksView, MembersPanel, TaskTimeline, Comments, Sidebar, ui/
│   ├── context/AuthContext   who is logged in
│   ├── hooks/                useApi (data loading), useDebounce
│   └── lib/                  API client, types, formatting helpers
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Not included (optional items from the brief)

To keep the core simple and reliable, these were left out on purpose:

- Drag-and-drop Kanban (status changes use a dropdown on each card)
- Moving a task to a different project (a task stays in the project it was created in)
- Transferring project ownership to someone else
- In-app notifications (mentions are emailed only)
- Refresh tokens / server-side session revocation (logout clears the cookie; the token itself expires after 1 day)
- Rate limiting
- Public deployment
- Frontend unit tests and end-to-end tests

Pagination exists in the API (`page` / `limit`), and the tasks page shows Previous/Next when there are more than 50 matching tasks.
