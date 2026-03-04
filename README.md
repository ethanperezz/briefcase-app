# Briefcase

**Client portals for freelancers.** Stop juggling emails, Google Drive links, and Venmo requests. Give every client their own branded portal.

## What It Does

Briefcase lets freelancers and consultants create a simple, branded portal for each client where they can:

- **Track progress** — Visual milestones so clients always know the project status
- **Share files** — Upload deliverables for clients to download directly
- **Message** — Keep all project communication in one threaded conversation
- **Invoice** — Create and send invoices that clients see in their portal
- **Brand it** — Your business name and colors, not ours

Clients access their portal via a unique link — no account creation needed.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:4567

**Demo account:** `demo@briefcase.dev` / `demo123`

## Tech Stack

- **Backend:** Node.js + Express 5
- **Database:** SQLite (via better-sqlite3)
- **Auth:** JWT
- **Frontend:** Vanilla HTML/CSS/JS (no build step)

## Project Structure

```
briefcase-app/
├── server.js              # Express server entry point
├── src/
│   ├── database.js        # SQLite schema, init, seed data
│   ├── middleware.js       # JWT auth & portal token middleware
│   └── routes/
│       ├── auth.js         # Register, login, current user
│       ├── clients.js      # Client CRUD
│       ├── projects.js     # Projects, milestones, messages, invoices
│       ├── files.js        # File upload/download/delete
│       └── portal.js       # Public client portal API
├── public/
│   ├── index.html          # Landing/marketing page
│   ├── dashboard.html      # Freelancer dashboard (SPA)
│   ├── css/style.css       # Dashboard styles
│   ├── js/app.js           # Dashboard application logic
│   └── portal/             # Client portal pages
│       ├── index.html      # Portal home (project list)
│       ├── project.html    # Portal project detail
│       └── css/portal.css  # Portal styles
└── uploads/                # Uploaded files storage
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `GET /api/auth/me` — Current user

### Clients (requires auth)
- `GET /api/clients` — List clients
- `POST /api/clients` — Create client
- `PUT /api/clients/:id` — Update client
- `DELETE /api/clients/:id` — Delete client

### Projects (requires auth)
- `GET /api/projects` — List projects
- `GET /api/projects/:id` — Project detail (with milestones, files, messages, invoices)
- `POST /api/projects` — Create project
- `PUT /api/projects/:id` — Update project
- `POST /api/projects/:id/milestones` — Add milestone
- `PUT /api/projects/:id/milestones/:mid` — Update milestone status
- `POST /api/projects/:id/messages` — Send message
- `POST /api/projects/:id/invoices` — Create invoice

### Files (requires auth)
- `POST /api/files/upload/:projectId` — Upload file
- `DELETE /api/files/:id` — Delete file

### Portal (public, via token)
- `GET /api/portal/:token` — Portal overview
- `GET /api/portal/:token/projects/:id` — Project detail
- `POST /api/portal/:token/projects/:id/messages` — Client sends message
- `GET /api/portal/:token/files/:id` — Download file

## Pricing Model

- **Free:** 2 clients, 3 projects, 100MB storage
- **Pro ($19/mo):** Unlimited clients & projects, 5GB storage, priority support

## License

ISC
