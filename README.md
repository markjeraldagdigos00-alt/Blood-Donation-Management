# MBDMS – Mobile Blood Donation Management System

Student project prototype (fictional data only). Not an official Philippine Red Cross system. Do not enter real donor or medical information.

**Stack:** Express (Node) · Supabase (Postgres) · plain HTML/CSS/JS frontend · deployed on Render

## Project structure

```
mbdms/
├── server.js            Express server + JSON API (talks to Supabase)
├── package.json
├── render.yaml          Render deployment config
├── .env.example         Template for your secrets (copy to .env)
├── supabase/
│   └── schema.sql       Tables, security rules, demo data
└── public/              Frontend (index.html, styles.css, app.js)
```

## 1. Set up Supabase

1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, click **Run**.
   This creates the tables, locks them down, and loads the demo data.
3. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

> The `service_role` key bypasses all security. Keep it only in `.env` / Render's environment settings. Never commit it or put it in `public/`.

## 2. Run locally (VS Code terminal)

```bash
npm install
cp .env.example .env      # then edit .env with your two Supabase values
npm start
```

Open http://localhost:3000

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/mbdms.git
git push -u origin main
```

`.env` is git-ignored, so your keys stay private.

## 4. Deploy on Render

1. Render → **New +** → **Web Service** → connect your GitHub repo (or **Blueprint** to use `render.yaml`).
2. Runtime **Node**, build `npm install`, start `npm start`.
3. Under **Environment**, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Data is now stored in Supabase and survives restarts and redeploys.

Notes: Render's free plan sleeps after inactivity (first request is slow), and free Supabase projects pause after about a week of no activity – resume them from the dashboard.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/summary` | Counts |
| GET/POST | `/api/activities` | List / add activity |
| GET/POST | `/api/donors` | List / register donor |
| GET/POST | `/api/screenings` | List / record screening |
| GET/POST | `/api/donations` | List / record donation (needs a "Cleared" screening for the same donor and activity) |
| POST | `/api/reset` | Restore demo data |
