const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Tiny JSON file "database" ---------- */
const seed = {
  activities: [
    { id: 1, name: "University Blood Donation Drive", date: "2026-11-15", venue: "University Activity Center", status: "Scheduled" },
    { id: 2, name: "Community Donation Drive", date: "2026-11-22", venue: "Community Hall", status: "Scheduled" }
  ],
  donors: [
    { id: 1, first: "Maria", last: "Santos", birthdate: "2000-05-10", contact: "000-000-0001" },
    { id: 2, first: "Juan", last: "Dela Cruz", birthdate: "1999-08-20", contact: "000-000-0002" },
    { id: 3, first: "Ana", last: "Reyes", birthdate: "2001-03-15", contact: "000-000-0003" }
  ],
  screenings: [
    { id: 1, donorId: 1, activityId: 1, outcome: "Cleared" },
    { id: 2, donorId: 2, activityId: 1, outcome: "Not cleared" }
  ],
  donations: [
    { id: 1, donorId: 1, activityId: 1, status: "Completed" }
  ]
};

let db;

function load() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = JSON.parse(JSON.stringify(seed));
    save();
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Could not save data:", err.message);
  }
}

const nextId = list => Math.max(0, ...list.map(i => i.id)) + 1;
const clean = v => String(v ?? "").trim();
const bad = (res, msg) => res.status(400).json({ error: msg });

/* ---------- API ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/summary", (req, res) => {
  res.json({
    activities: db.activities.length,
    donors: db.donors.length,
    screenings: db.screenings.length,
    donations: db.donations.filter(d => d.status === "Completed").length
  });
});

// Activities
app.get("/api/activities", (req, res) => res.json(db.activities));

app.post("/api/activities", (req, res) => {
  const name = clean(req.body.name);
  const date = clean(req.body.date);
  const venue = clean(req.body.venue);
  if (!name || !date || !venue) return bad(res, "Name, date and venue are required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, "Invalid date.");

  const item = { id: nextId(db.activities), name, date, venue, status: "Scheduled" };
  db.activities.push(item);
  save();
  res.status(201).json(item);
});

// Donors
app.get("/api/donors", (req, res) => res.json(db.donors));

app.post("/api/donors", (req, res) => {
  const first = clean(req.body.first);
  const last = clean(req.body.last);
  const birthdate = clean(req.body.birthdate);
  const contact = clean(req.body.contact);
  if (!first || !last || !birthdate || !contact) return bad(res, "All donor fields are required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return bad(res, "Invalid birthdate.");

  const item = { id: nextId(db.donors), first, last, birthdate, contact };
  db.donors.push(item);
  save();
  res.status(201).json(item);
});

// Screenings (recorded by authorized personnel; this app does not decide eligibility)
app.get("/api/screenings", (req, res) => res.json(db.screenings));

app.post("/api/screenings", (req, res) => {
  const donorId = Number(req.body.donorId);
  const activityId = Number(req.body.activityId);
  const outcome = clean(req.body.outcome);
  if (!db.donors.some(d => d.id === donorId)) return bad(res, "Unknown donor.");
  if (!db.activities.some(a => a.id === activityId)) return bad(res, "Unknown activity.");
  if (!["Cleared", "Not cleared"].includes(outcome)) return bad(res, "Invalid outcome.");

  const item = { id: nextId(db.screenings), donorId, activityId, outcome };
  db.screenings.push(item);
  save();
  res.status(201).json(item);
});

// Donations
app.get("/api/donations", (req, res) => res.json(db.donations));

app.post("/api/donations", (req, res) => {
  const donorId = Number(req.body.donorId);
  const activityId = Number(req.body.activityId);
  if (!db.donors.some(d => d.id === donorId)) return bad(res, "Unknown donor.");
  if (!db.activities.some(a => a.id === activityId)) return bad(res, "Unknown activity.");

  const screening = db.screenings
    .filter(s => s.donorId === donorId && s.activityId === activityId)
    .pop();
  if (!screening || screening.outcome !== "Cleared") {
    return bad(res, "Donor needs a 'Cleared' screening record for this activity first.");
  }
  if (db.donations.some(d => d.donorId === donorId && d.activityId === activityId)) {
    return bad(res, "Donation already recorded for this donor and activity.");
  }

  const item = { id: nextId(db.donations), donorId, activityId, status: "Completed" };
  db.donations.push(item);
  save();
  res.status(201).json(item);
});

// Reset demo data
app.post("/api/reset", (req, res) => {
  db = JSON.parse(JSON.stringify(seed));
  save();
  res.json({ ok: true });
});

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

load();
app.listen(PORT, () => console.log(`MBDMS running on port ${PORT}`));
