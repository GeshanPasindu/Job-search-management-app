# Job Search CRM and Application Assistant

A local full-stack MVP for collecting job postings, generating safe manual-open search URLs, scoring jobs against a target profile, managing CV/cover-letter templates, generating application packages, and tracking applications.

## Stack

- Frontend: React, TypeScript, Vite, clean CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- File upload: local `uploads/` storage through a small storage abstraction
- Auth: single-user MVP using `DEFAULT_USER_EMAIL`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Create a PostgreSQL database:

```sql
CREATE DATABASE job_search_crm;
```

4. Update `.env` if your PostgreSQL user, password, host, port, or database name differs:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/job_search_crm?schema=public"
```

5. Generate Prisma Client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Seed default profile skills, keywords, sources, and sample templates:

```bash
npm run seed
```

7. Run the backend:

```bash
npm run dev:backend
```

The API runs at `http://localhost:4000`.

8. Run the frontend in another terminal:

```bash
npm run dev:frontend
```

The app runs at `http://localhost:5173`.

## Common Scripts

- `npm run dev`: run backend and frontend workspace dev scripts
- `npm run dev:backend`: run Express API
- `npm run dev:frontend`: run Vite app
- `npm run build`: build all workspaces
- `npm run typecheck`: type-check all workspaces
- `npm run prisma:migrate`: run Prisma migrations for backend
- `npm run seed`: seed defaults

## Source Config

Job sources live in:

```text
apps/backend/config/job-sources.json
```

To add a new source, add a JSON object with an `id`, `name`, `type`, `enabled`, `baseUrl`, optional `queryParams`, optional `filterMappings`, and `applyMode`.

Example search URL source:

```json
{
  "id": "example",
  "name": "Example Jobs",
  "type": "search_url",
  "enabled": true,
  "baseUrl": "https://example.com/jobs",
  "queryParams": {
    "q": "{{keywords}}",
    "location": "{{location}}"
  },
  "applyMode": "manual_open"
}
```

New sources are synced into the database when `/api/sources` is loaded. Existing source rows can also be edited on the Sources page.

## MVP Workflows

- Add/edit/enable job keywords on the Keywords page.
- Generate LinkedIn search URLs from Search Builder and open them manually.
- Add other job sites by editing `apps/backend/config/job-sources.json`.
- Paste job descriptions or job fields into Jobs > Manual Import.
- Import public listings from Jobs > Import Public Jobs. XpressJobs uses its public JSON listing API; TopJobs imports from public listing/detail pages.
- Connect Gmail with read-only OAuth and import job-alert emails from Jobs > Import Gmail Job Alerts.
- Score imported jobs and review match explanations, matched skills, and gaps.
- Upload or edit CV summaries and cover-letter templates by role category.
- Generate editable application packages for selected jobs.
- Track applications, follow-up dates, contacts, salary notes, interviews, and outcomes.

## API Overview

Keywords:

- `GET /api/keywords`
- `POST /api/keywords`
- `PUT /api/keywords/:id`
- `DELETE /api/keywords/:id`

Sources:

- `GET /api/sources`
- `PUT /api/sources/:id`
- `POST /api/sources/test-url`

Jobs:

- `GET /api/jobs`
- `POST /api/jobs`
- `GET /api/jobs/:id`
- `PUT /api/jobs/:id`
- `DELETE /api/jobs/:id`
- `POST /api/jobs/import-manual`
- `POST /api/jobs/import-public`
- `POST /api/jobs/:id/score`
- `POST /api/jobs/rescore-all`

Email Imports:

- `GET /api/email/gmail/status`
- `GET /api/email/gmail/auth-url`
- `GET /api/email/gmail/callback`
- `POST /api/email/job-alerts/import`

## Gmail Job Alert Import

This local app can read job-alert emails through Gmail OAuth using the read-only Gmail scope. It does not need your Google password.

1. In Google Cloud Console, create a project.
2. Enable the Gmail API.
3. Configure OAuth consent screen for a local/testing app.
4. Create OAuth Client credentials for a web app.
5. Add this authorized redirect URI:

```text
http://localhost:4000/api/email/gmail/callback
```

6. Add the credentials to `.env`:

```env
GMAIL_CLIENT_ID="your-client-id"
GMAIL_CLIENT_SECRET="your-client-secret"
GMAIL_REDIRECT_URI=http://localhost:4000/api/email/gmail/callback
GMAIL_TOKEN_PATH=.local/gmail-token.json
```

7. Restart the backend.
8. Open Jobs > Import Gmail Job Alerts.
9. Click Connect Gmail, approve read-only access, then click Import Gmail alerts.

The token is stored locally at `.local/gmail-token.json`, which is ignored by git.

Templates:

- `GET /api/templates`
- `POST /api/templates/upload`
- `GET /api/templates/:id`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`

Application Packages:

- `POST /api/application-packages/generate`
- `GET /api/application-packages/:id`
- `PUT /api/application-packages/:id`

Applications:

- `GET /api/applications`
- `POST /api/applications`
- `PUT /api/applications/:id`
- `DELETE /api/applications/:id`

Settings/Profile:

- `GET /api/profile`
- `PUT /api/profile`

Dashboard:

- `GET /api/dashboard/stats`

## Template Variables

Cover-letter templates can use:

- `{{jobTitle}}`
- `{{company}}`
- `{{roleCategory}}`
- `{{matchedSkills}}`
- `{{missingSkills}}`
- `{{myRelevantExperience}}`
- `{{source}}`
- `{{applyUrl}}`
- `{{today}}`

`{{candidateName}}` is also supported by the sample template and resolves to `DEFAULT_USER_NAME`.

## Limitations

- No multi-user login screen yet; this is a single-user MVP.
- Gmail draft creation is represented by an `EmailDraftService` interface only.
- AI customization is represented by an `AiApplicationAssistant` interface only. Deterministic templates work without an API key.
- API and company-board adapters are placeholders until credentials and site-specific legal terms are reviewed.
- Uploaded files are stored locally first. Add S3 by implementing the file storage abstraction behind `apps/backend/src/lib/file-storage.ts`.
