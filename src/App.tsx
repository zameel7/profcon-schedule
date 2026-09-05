import { useEffect, useMemo, useState } from "react";
import { fetchPublicSchedule } from "./api";
import Admin from "./components/Admin";
import type { ScheduleItem, VenueInfo } from "./types";

const DAYS = [
  { date: "2026-09-11", short: "Fri 11", label: "Friday" },
  { date: "2026-09-12", short: "Sat 12", label: "Saturday" },
  { date: "2026-09-13", short: "Sun 13", label: "Sunday" },
];

const VENUE_COLORS: Record<string, string> = {
  PRIME: "coral", FLORETS: "violet", GLOBAL: "teal", QUEST: "amber", BLOOM: "green", IDAM: "blue",
};

const displayTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(2026, 0, 1, hours, minutes));
};

const isConfirmed = (value?: string) => value?.trim().toLowerCase() === "confirmed";
const validLink = (value?: string) => {
  if (!value) return "";
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : ""; } catch { return ""; }
};
const cleanPhone = (phone: string) => phone.replace(/[^+\d]/g, "");

function Contact({ role, name, phone }: { role: string; name: string; phone: string }) {
  if (!name) return null;
  return <div className="contact-row"><div><span>{role}</span><strong>{name}</strong></div>{phone ? <a href={`tel:${cleanPhone(phone)}`} aria-label={`Call ${name}`}>Call <span aria-hidden="true">↗</span></a> : <small>Number pending</small>}</div>;
}

function SessionDetails({ session, close }: { session: ScheduleItem; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  const material = validLink(session.materials_url);
  const hints = validLink(session.hints_url);
  return <div className="modal-backdrop" onMouseDown={close}><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close-button" onClick={close} aria-label="Close session details">×</button>
    <div className="modal-topline"><span className={`venue-dot ${VENUE_COLORS[session.venue] || "blue"}`} />{session.venue} · {session.track}</div>
    <span className="session-code">{session.session_code || session.category}</span><h2 id="session-title">{session.title}</h2>
    <div className="modal-time">{DAYS.find((day) => day.date === session.date)?.label}, September {session.date.slice(-2)} · {displayTime(session.start_time)}–{displayTime(session.end_time)}</div>
    <dl className="session-meta"><div><dt>Faculty</dt><dd>{session.faculty || session.details || "To be announced"}</dd></div><div><dt>Confirmation</dt><dd><span className={`confirmation ${isConfirmed(session.faculty_confirmation) ? "confirmed" : "unconfirmed"}`}><i />{session.faculty_confirmation || "Not Confirmed"}</span></dd></div>{session.duty && <div><dt>Duty / notes</dt><dd>{session.duty}</dd></div>}<div><dt>Media</dt><dd>{session.media_status || "Not Received"}</dd></div></dl>
    {(material || hints) && <div className="resource-links">{material && <a href={material} target="_blank" rel="noreferrer">Open presentation / media ↗</a>}{hints && <a href={hints} target="_blank" rel="noreferrer">Open hints file ↗</a>}</div>}
    {!material && !hints && <p className="resource-empty">Session files will appear here when the admin adds their Google Drive links.</p>}
  </section></div>;
}

function PublicSchedule() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [selectedVenue, setSelectedVenue] = useState("PRIME");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedSession, setSelectedSession] = useState<ScheduleItem | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"sheet" | "tracker" | "demo">("demo");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPublicSchedule().then((result) => { setSessions(result.sessions); setVenues(result.venues); setSource(result.source); if (result.venues.length && !result.venues.some((venue) => venue.name === "PRIME")) setSelectedVenue(result.venues[0].name); setLoading(false); }); }, []);

  const activeVenue = venues.find((venue) => venue.name === selectedVenue);
  const venueSessions = useMemo(() => sessions.filter((item) => item.venue === selectedVenue), [sessions, selectedVenue]);
  const availableDays = DAYS.filter((day) => venueSessions.some((session) => session.date === day.date));
  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return venueSessions.filter((item) => (selectedDate === "all" || item.date === selectedDate) && (!needle || `${item.title} ${item.faculty || item.details} ${item.track} ${item.session_code}`.toLowerCase().includes(needle)));
  }, [venueSessions, query, selectedDate]);
  const grouped = DAYS.map((day) => ({ day, sessions: visibleSessions.filter((session) => session.date === day.date) })).filter((group) => group.sessions.length);

  return <div className="site-shell">
    <header className="site-header compact-site-header"><nav className="nav wrap"><a className="brand" href="/" aria-label="PROFCON schedule home"><span>30</span><div><strong>PROFCON</strong><small>2026 · PALAKKAD</small></div></a><div className="compact-header-meta"><span>Sep 11–13 · Ahalia Campus</span><a className="admin-link" href="/admin">Admin</a></div></nav></header>
    <main className="wrap main-content no-hero">
      {source === "tracker" && <div className="demo-note"><span>Latest tracker loaded.</span> Venue contacts and admin fields will sync after the updated Apps Script is deployed.</div>}
      {source === "demo" && <div className="demo-note"><span>Offline view.</span> Showing the bundled master tracker while the live service is unavailable.</div>}
      <section className="venue-navigation" aria-labelledby="choose-venue"><div className="section-title"><span className="eyebrow">Start here</span><h2 id="choose-venue">Choose a venue</h2></div><div className="venue-grid">{venues.map((venue) => <button key={venue.id} className={`venue-choice ${selectedVenue === venue.name ? "selected" : ""}`} onClick={() => { setSelectedVenue(venue.name); setSelectedDate("all"); setQuery(""); }}><span className={`venue-dot ${VENUE_COLORS[venue.name] || "blue"}`} /><strong>{venue.name}</strong><small>{sessions.filter((session) => session.venue === venue.name).length} sessions</small></button>)}</div></section>
      {activeVenue && <section className="venue-overview"><div><span className="eyebrow">Venue desk</span><h2>{activeVenue.name}</h2><p>{venueSessions.length ? `${venueSessions.length} scheduled sessions across ${availableDays.length} day${availableDays.length === 1 ? "" : "s"}.` : "No sessions have been added yet."}</p></div><div className="venue-contacts"><Contact role="Program head" name={activeVenue.program_head} phone="" /><Contact role="Program in-charge" name={activeVenue.incharge_name} phone={activeVenue.incharge_phone} /><Contact role="IT coordination" name={activeVenue.it_coordinator} phone={activeVenue.it_phone} /><Contact role="Coordinator" name={activeVenue.coordinator_name} phone={activeVenue.coordinator_phone} /></div></section>}
      <section className="schedule-controls" aria-label="Schedule filters"><div className="day-tabs compact"><button className={selectedDate === "all" ? "selected" : ""} onClick={() => setSelectedDate("all")}><span>Schedule</span><strong>All days</strong></button>{availableDays.map((day) => <button key={day.date} className={selectedDate === day.date ? "selected" : ""} onClick={() => setSelectedDate(day.date)}><span>{day.label}</span><strong>{day.short}</strong></button>)}</div><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions or faculty" /></label></section>
      <div className="schedule-heading"><div><span className="eyebrow">Session list</span><h2>{selectedVenue}</h2></div><span>{visibleSessions.length} sessions</span></div>
      {loading ? <div className="empty-state">Loading the schedule…</div> : grouped.length === 0 ? <div className="empty-state">{selectedVenue === "IDAM" ? "IDAM is ready. Add its sessions from the admin view when confirmed." : "No sessions match these filters."}</div> : <div className="day-groups">{grouped.map(({ day, sessions: items }) => <section className="day-group" key={day.date}><header><div><span>{day.label}</span><strong>September {day.date.slice(-2)}</strong></div><small>{items.length} sessions</small></header><div className="session-list">{items.map((session) => <button className="session-card" key={session.id} onClick={() => setSelectedSession(session)}><time><strong>{displayTime(session.start_time)}</strong><span>{displayTime(session.end_time)}</span></time><div className="session-copy"><span className="category">{session.session_code || session.category}</span><h3>{session.title}</h3><p>{session.faculty || session.details}</p></div><span className={`confirmation compact-status ${isConfirmed(session.faculty_confirmation) ? "confirmed" : "unconfirmed"}`} title={session.faculty_confirmation || "Not Confirmed"}><i /><span>{isConfirmed(session.faculty_confirmation) ? "Confirmed" : "Not confirmed"}</span></span><span className="row-arrow" aria-hidden="true">›</span></button>)}</div></section>)}</div>}
    </main>
    <footer><div className="wrap"><div className="brand footer-brand"><span>30</span><div><strong>PROFCON</strong><small>WISDOM STUDENTS</small></div></div><p>September 11–13, 2026 · Ahalia Campus, Palakkad</p></div></footer>
    {selectedSession && <SessionDetails session={selectedSession} close={() => setSelectedSession(null)} />}
  </div>;
}

export default function App() { return window.location.pathname.startsWith("/admin") ? <Admin /> : <PublicSchedule />; }
