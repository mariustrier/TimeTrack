# TimeTrack

A modern time tracking SaaS built with Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Clerk, and Prisma/PostgreSQL.

## Features

- **Employee Timesheet** - Weekly grid view with project rows and day columns, time entry modal with comments, auto-calculated totals and time balance
- **Admin Dashboard** - Company-wide revenue, cost, profit, and utilization stats with per-employee profitability cards and monthly projections
- **Project Management** - Create and manage projects with color coding, client names, budget hours, and billable tracking
- **Team Management** - Invite members, set bill/cost rates, assign roles, and manage weekly targets
- **Data Export** - Download a full ZIP backup containing CSVs of all users, projects, and time entries
- **Authentication** - Clerk-powered sign-in/sign-up with role-based access control (admin vs employee)
- **Company Isolation** - All data is scoped to the authenticated user's company

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** Clerk
- **Database:** PostgreSQL via Prisma ORM
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk account

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/mariustrier/TimeTrack.git
   cd TimeTrack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Fill in your environment variables in `.env`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   DATABASE_URL=postgresql://user:password@localhost:5432/timetrack
   ```

5. Push the database schema:
   ```bash
   npx prisma db push
   ```

6. Start the dev server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
  (auth)/          Sign-in and sign-up pages
  (dashboard)/     Authenticated app pages
    dashboard/     Employee timesheet
    admin/         Admin dashboard and backups
    projects/      Project management
    team/          Team management
  onboarding/      Company creation flow
  api/             API routes
components/
  ui/              shadcn/ui components
  layout/          Sidebar and navigation
lib/
  db.ts            Prisma client singleton
  auth.ts          Auth helpers
  calculations.ts  Profitability formulas
prisma/
  schema.prisma    Database schema
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/sync` | Sync Clerk user and create company |
| GET/POST | `/api/time-entries` | List and create time entries |
| PUT/DELETE | `/api/time-entries/[id]` | Update and delete a time entry |
| GET/POST | `/api/projects` | List and create projects |
| PUT/DELETE | `/api/projects/[id]` | Update and delete a project |
| GET/POST | `/api/team` | List and invite team members |
| PUT/DELETE | `/api/team/[id]` | Update and remove a team member |
| GET | `/api/admin/stats` | Company statistics |
| GET | `/api/admin/export` | Download ZIP backup |

## License

MIT
