# College Compass

A full-stack college discovery platform built with React, Node.js, Express, and PostgreSQL.

## Features

- Searchable college listing page
- College detail page with admissions, fees, courses, and placement highlights
- Compare up to three colleges
- Basic email/password login and registration
- PostgreSQL schema and seed data

## Project Structure

```text
college-compass/
  backend/      Express API and PostgreSQL access
  frontend/     React app powered by Vite
  database/     Schema and seed SQL
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

1. Create the database:

```bash
createdb college_compass
psql -d college_compass -f database/schema.sql
psql -d college_compass -f database/seed.sql
```

For an existing database, add saved colleges support without dropping data:

```bash
psql -d college_compass -f database/add_saved_colleges.sql
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` if your PostgreSQL credentials differ.

3. Install dependencies:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

4. Run the app:

```bash
npm run dev
```

Frontend: http://localhost:5173

Backend: http://localhost:4000

## Environment Variables

Backend (`backend/.env`):

```bash
PORT=4000
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/college_compass
DB_SSL=false
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGINS=http://localhost:5173
```

Frontend (`frontend/.env`):

```bash
VITE_API_URL=http://localhost:4000/api
```

## API Summary

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/colleges?name=&location=&minFees=&maxFees=`
- `GET /api/colleges/:id`
- `GET /api/colleges/compare?ids=1,2,3`
- `GET /api/saved-colleges`
- `POST /api/saved-colleges/:collegeId`
- `DELETE /api/saved-colleges/:collegeId`

## Deployment

### Backend on Render

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from the repository. The included `render.yaml` creates:
   - a Node web service using `backend` as the root directory
   - a PostgreSQL database
   - a generated `JWT_SECRET`
   - a pre-deploy migration command that creates tables and seeds starter colleges
3. After the first frontend deployment, set the backend service environment variable:

```bash
CLIENT_ORIGINS=https://your-vercel-app.vercel.app
```

For multiple frontend URLs, use comma-separated origins:

```bash
CLIENT_ORIGINS=http://localhost:5173,https://your-vercel-app.vercel.app
```

4. Keep `DB_SSL=false` for Render's internal database connection string. Set `DB_SSL=true` only if you use an external PostgreSQL URL that requires SSL.
5. Redeploy the backend after changing environment variables.

### Frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `frontend`.
3. Vercel should detect Vite. The included `frontend/vercel.json` sets:
   - build command: `npm run build`
   - output directory: `dist`
   - SPA rewrites for React Router routes
4. Add this environment variable in Vercel:

```bash
VITE_API_URL=https://your-render-service.onrender.com/api
```

5. Deploy the frontend.
6. Copy the Vercel production URL back into Render's `CLIENT_ORIGINS`.

### CORS Notes

The backend only allows origins listed in `CLIENT_ORIGINS`. Do not include trailing slashes. If login or API calls fail in the browser with a CORS error, confirm:

- `VITE_API_URL` points to the Render backend `/api` URL
- `CLIENT_ORIGINS` contains the exact Vercel origin, for example `https://college-compass.vercel.app`
- the backend was redeployed after editing `CLIENT_ORIGINS`
