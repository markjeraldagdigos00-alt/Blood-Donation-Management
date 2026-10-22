# MBDMS – Mobile Blood Donation Management System

Student project prototype (fictional data only). Not an official Philippine Red Cross system. Do not enter real donor or medical information.

## Features

- Dashboard with live counts
- MBD Activities (add + search)
- Donor Records (register + search)
- Medical Screening (record outcomes entered by authorized personnel – the app does not decide eligibility)
- Donation Records (a donation requires a "Cleared" screening for the same donor and activity)
- Reports (summary, print, reset demo data)

## Project structure

```
mbdms/
├── server.js          Express server + JSON API
├── package.json
├── render.yaml        Render deployment config
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── data/              db.json is created here automatically (git-ignored)
```

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Deploy to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/mbdms.git
git push -u origin main
```

## Deploy to Render

1. Go to https://render.com → **New +** → **Web Service**.
2. Connect your GitHub repo.
3. Settings (auto-filled if it detects `render.yaml`):
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Click **Create Web Service**.

## Important note about data

Records are stored in `data/db.json`. On Render's free plan the file system is **temporary**: data resets whenever the service restarts or redeploys. That's fine for a demo. For permanent storage, switch to a database such as PostgreSQL (Render offers one) or MySQL hosted elsewhere.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/summary` | Counts |
| GET/POST | `/api/activities` | List / add activity |
| GET/POST | `/api/donors` | List / register donor |
| GET/POST | `/api/screenings` | List / record screening |
| GET/POST | `/api/donations` | List / record donation |
| POST | `/api/reset` | Restore demo data |
