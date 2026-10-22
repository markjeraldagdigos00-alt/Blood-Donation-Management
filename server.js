require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.");
  process.exit(1);
}

// The service-role key stays on the server only. Never put it in /public.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Helpers ---------- */
const clean = v => String(v ?? "").trim();
const bad = (res, msg) => res.status(400).json({ error: msg });
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isId = n => Number.isInteger(n) && n > 0;

// Wrap async handlers so database errors become clean JSON responses.
const route = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error. Please try again." });
  }
};

// Row mappers: database snake_case -> the camelCase the frontend uses.
const toScreening = r => ({ id: r.id, donorId: r.donor_id, activityId: r.activity_id, outcome: r.outcome });
const toDonation = r => ({ id: r.id, donorId: r.donor_id, activityId: r.activity_id, status: r.status });

async function exists(table, id) {
  const { count, error } = await supabase
    .from(table).select("id", { count: "exact", head: true }).eq("id", id);
  if (error) throw error;
  return count > 0;
}

async function countOf(table, filter) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count;
}

/* ---------- API ---------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/summary", route(async (req, res) => {
  const [activities, donors, screenings, donations] = await Promise.all([
    countOf("activities"),
    countOf("donors"),
    countOf("screenings"),
    countOf("donations", q => q.eq("status", "Completed"))
  ]);
  res.json({ activities, donors, screenings, donations });
}));

// Activities
app.get("/api/activities", route(async (req, res) => {
  const { data, error } = await supabase.from("activities").select("*").order("id");
  if (error) throw error;
  res.json(data);
}));

app.post("/api/activities", route(async (req, res) => {
  const name = clean(req.body.name);
  const date = clean(req.body.date);
  const venue = clean(req.body.venue);
  if (!name || !date || !venue) return bad(res, "Name, date and venue are required.");
  if (!isDate(date)) return bad(res, "Invalid date.");

  const { data, error } = await supabase
    .from("activities").insert({ name, date, venue, status: "Scheduled" }).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

// Donors
app.get("/api/donors", route(async (req, res) => {
  const { data, error } = await supabase.from("donors").select("*").order("id");
  if (error) throw error;
  res.json(data);
}));

app.post("/api/donors", route(async (req, res) => {
  const first = clean(req.body.first);
  const last = clean(req.body.last);
  const birthdate = clean(req.body.birthdate);
  const contact = clean(req.body.contact);
  if (!first || !last || !birthdate || !contact) return bad(res, "All donor fields are required.");
  if (!isDate(birthdate)) return bad(res, "Invalid birthdate.");

  const { data, error } = await supabase
    .from("donors").insert({ first, last, birthdate, contact }).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

// Screenings (recorded by authorized personnel; this app does not decide eligibility)
app.get("/api/screenings", route(async (req, res) => {
  const { data, error } = await supabase.from("screenings").select("*").order("id");
  if (error) throw error;
  res.json(data.map(toScreening));
}));

app.post("/api/screenings", route(async (req, res) => {
  const donorId = Number(req.body.donorId);
  const activityId = Number(req.body.activityId);
  const outcome = clean(req.body.outcome);
  if (!isId(donorId) || !(await exists("donors", donorId))) return bad(res, "Unknown donor.");
  if (!isId(activityId) || !(await exists("activities", activityId))) return bad(res, "Unknown activity.");
  if (!["Cleared", "Not cleared"].includes(outcome)) return bad(res, "Invalid outcome.");

  const { data, error } = await supabase
    .from("screenings").insert({ donor_id: donorId, activity_id: activityId, outcome }).select().single();
  if (error) throw error;
  res.status(201).json(toScreening(data));
}));

// Donations (need a latest "Cleared" screening for the same donor + activity)
app.get("/api/donations", route(async (req, res) => {
  const { data, error } = await supabase.from("donations").select("*").order("id");
  if (error) throw error;
  res.json(data.map(toDonation));
}));

app.post("/api/donations", route(async (req, res) => {
  const donorId = Number(req.body.donorId);
  const activityId = Number(req.body.activityId);
  if (!isId(donorId) || !(await exists("donors", donorId))) return bad(res, "Unknown donor.");
  if (!isId(activityId) || !(await exists("activities", activityId))) return bad(res, "Unknown activity.");

  const { data: latest, error: scrErr } = await supabase
    .from("screenings").select("outcome")
    .eq("donor_id", donorId).eq("activity_id", activityId)
    .order("id", { ascending: false }).limit(1);
  if (scrErr) throw scrErr;
  if (!latest.length || latest[0].outcome !== "Cleared") {
    return bad(res, "Donor needs a 'Cleared' screening record for this activity first.");
  }

  const { data, error } = await supabase
    .from("donations").insert({ donor_id: donorId, activity_id: activityId, status: "Completed" })
    .select().single();
  if (error) {
    if (error.code === "23505") return bad(res, "Donation already recorded for this donor and activity.");
    throw error;
  }
  res.status(201).json(toDonation(data));
}));

// Reset demo data (runs the reset_demo_data() function from supabase/schema.sql)
app.post("/api/reset", route(async (req, res) => {
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) throw error;
  res.json({ ok: true });
}));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

app.listen(PORT, () => console.log(`MBDMS running on port ${PORT}`));
