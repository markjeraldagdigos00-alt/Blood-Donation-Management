const state = { activities: [], donors: [], screenings: [], donations: [] };

const titles = {
    dashboard: "Dashboard",
    activities: "MBD Activities",
    donors: "Donor Records",
    screening: "Medical Screening",
    donations: "Donation Records",
    reports: "Reports"
};

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

/* ---------- API ---------- */
async function api(url, options) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
}

function showError(message) {
    const box = $("error-box");
    box.textContent = message;
    box.classList.remove("hidden");
    clearTimeout(showError.timer);
    showError.timer = setTimeout(() => box.classList.add("hidden"), 5000);
}

async function loadAll() {
    try {
        const [activities, donors, screenings, donations] = await Promise.all([
            api("/api/activities"),
            api("/api/donors"),
            api("/api/screenings"),
            api("/api/donations")
        ]);
        Object.assign(state, { activities, donors, screenings, donations });
        renderAll();
    } catch (err) {
        showError("Could not load data: " + err.message);
    }
}

/* ---------- Helpers ---------- */
const donorName = id => {
    const d = state.donors.find(x => x.id === id);
    return d ? `${d.first} ${d.last}` : "Unknown donor";
};
const activityName = id => {
    const a = state.activities.find(x => x.id === id);
    return a ? a.name : "Unknown activity";
};
const pad = (n, len = 3) => String(n).padStart(len, "0");

function statusBadge(status) {
    let color = "red";
    if (status === "Completed" || status === "Cleared") color = "green";
    else if (status === "Scheduled") color = "orange";
    return `<span class="badge ${color}">${escapeHTML(status)}</span>`;
}

/* ---------- Navigation ---------- */
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p =>
        p.classList.toggle("hidden", p.id !== pageId));
    document.querySelectorAll(".nav-link").forEach(l =>
        l.classList.toggle("active", l.dataset.page === pageId));
    $("page-title").textContent = titles[pageId] || "MBDMS";
}

document.querySelectorAll(".nav-link").forEach(link =>
    link.addEventListener("click", () => showPage(link.dataset.page)));

document.querySelectorAll("[data-goto]").forEach(btn =>
    btn.addEventListener("click", () => showPage(btn.dataset.goto)));

document.querySelectorAll("[data-toggle]").forEach(btn =>
    btn.addEventListener("click", () =>
        $(btn.dataset.toggle).classList.toggle("hidden")));

/* ---------- Rendering ---------- */
function activityRow(item) {
    return `
        <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.date)}</td>
            <td>${escapeHTML(item.venue)}</td>
            <td>${statusBadge(item.status)}</td>
        </tr>`;
}

function renderActivities() {
    const q = $("activity-search").value.toLowerCase();
    const filtered = state.activities.filter(i =>
        `${i.name} ${i.venue} ${i.date}`.toLowerCase().includes(q));

    $("activity-table").innerHTML = filtered.length
        ? filtered.map(activityRow).join("")
        : `<tr><td colspan="4" class="empty">No activities found.</td></tr>`;

    $("dashboard-activities").innerHTML = state.activities.length
        ? state.activities.slice(0, 5).map(activityRow).join("")
        : `<tr><td colspan="4" class="empty">No activities yet.</td></tr>`;
}

function renderDonors() {
    const q = $("donor-search").value.toLowerCase();
    const filtered = state.donors.filter(d =>
        `${d.first} ${d.last} DON-${pad(d.id)}`.toLowerCase().includes(q));

    $("donor-table").innerHTML = filtered.length
        ? filtered.map(d => `
            <tr>
                <td>DON-${pad(d.id)}</td>
                <td>${escapeHTML(d.first)} ${escapeHTML(d.last)}</td>
                <td>${escapeHTML(d.birthdate)}</td>
                <td>${escapeHTML(d.contact)}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" class="empty">No donors found.</td></tr>`;
}

function renderScreenings() {
    $("screening-table").innerHTML = state.screenings.length
        ? state.screenings.map(s => `
            <tr>
                <td>SCR-${pad(s.id)}</td>
                <td>${escapeHTML(donorName(s.donorId))}</td>
                <td>${escapeHTML(activityName(s.activityId))}</td>
                <td>${statusBadge(s.outcome)}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" class="empty">No screening records yet.</td></tr>`;
}

function renderDonations() {
    $("donation-table").innerHTML = state.donations.length
        ? state.donations.map(d => `
            <tr>
                <td>DONATION-${pad(d.id)}</td>
                <td>${escapeHTML(donorName(d.donorId))}</td>
                <td>${escapeHTML(activityName(d.activityId))}</td>
                <td>${statusBadge(d.status)}</td>
            </tr>`).join("")
        : `<tr><td colspan="4" class="empty">No donations recorded yet.</td></tr>`;
}

function renderStats() {
    const completed = state.donations.filter(d => d.status === "Completed").length;
    const values = {
        "activity-count": state.activities.length,
        "donor-count": state.donors.length,
        "screening-count": state.screenings.length,
        "donation-count": completed,
        "report-activities": state.activities.length,
        "report-donors": state.donors.length,
        "report-screenings": state.screenings.length,
        "report-donations": completed
    };
    Object.entries(values).forEach(([id, v]) => ($(id).textContent = v));
}

function fillSelect(id, options) {
    const select = $(id);
    const previous = select.value;
    select.innerHTML = options.length
        ? options.map(o => `<option value="${o.value}">${escapeHTML(o.label)}</option>`).join("")
        : `<option value="">No records available</option>`;
    if (previous) select.value = previous;
}

function renderSelects() {
    const donorOptions = state.donors.map(d => ({
        value: d.id, label: `DON-${pad(d.id)} - ${d.first} ${d.last}`
    }));
    const activityOptions = state.activities.map(a => ({
        value: a.id, label: `${a.name} (${a.date})`
    }));
    fillSelect("screening-donor", donorOptions);
    fillSelect("donation-donor", donorOptions);
    fillSelect("screening-activity", activityOptions);
    fillSelect("donation-activity", activityOptions);
}

function renderAll() {
    renderActivities();
    renderDonors();
    renderScreenings();
    renderDonations();
    renderStats();
    renderSelects();
}

/* ---------- Events ---------- */
$("activity-search").addEventListener("input", renderActivities);
$("donor-search").addEventListener("input", renderDonors);

async function submitForm(event, url, body, formId) {
    event.preventDefault();
    try {
        await api(url, { method: "POST", body: JSON.stringify(body) });
        event.target.reset();
        $(formId).classList.add("hidden");
        await loadAll();
    } catch (err) {
        showError(err.message);
    }
}

$("new-activity").addEventListener("submit", e =>
    submitForm(e, "/api/activities", {
        name: $("activity-name").value,
        date: $("activity-date").value,
        venue: $("activity-venue").value
    }, "activity-form"));

$("new-donor").addEventListener("submit", e =>
    submitForm(e, "/api/donors", {
        first: $("first-name").value,
        last: $("last-name").value,
        birthdate: $("birthdate").value,
        contact: $("contact").value
    }, "donor-form"));

$("new-screening").addEventListener("submit", e =>
    submitForm(e, "/api/screenings", {
        donorId: $("screening-donor").value,
        activityId: $("screening-activity").value,
        outcome: $("screening-outcome").value
    }, "screening-form"));

$("new-donation").addEventListener("submit", e =>
    submitForm(e, "/api/donations", {
        donorId: $("donation-donor").value,
        activityId: $("donation-activity").value
    }, "donation-form"));

$("reset-data").addEventListener("click", async () => {
    if (!confirm("Reset all data back to the original demo records?")) return;
    try {
        await api("/api/reset", { method: "POST" });
        await loadAll();
    } catch (err) {
        showError(err.message);
    }
});

loadAll();
