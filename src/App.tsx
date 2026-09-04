import { useEffect, useMemo, useState } from "react";
import { fetchPublicSchedule } from "./api";
import Admin from "./components/Admin";
import type { ScheduleItem } from "./types";

const DAYS = [
  { date: "2026-09-11", short: "Fri 11", label: "Friday" },
  { date: "2026-09-12", short: "Sat 12", label: "Saturday" },
  { date: "2026-09-13", short: "Sun 13", label: "Sunday" },
];

const VENUE_COLORS: Record<string, string> = {
  PRIME: "coral",
  FLORETS: "violet",
  GLOBAL: "teal",
  QUEST: "amber",
  BLOOM: "green",
  "PROFCON PLUS": "blue",
  "PROFCON RISE": "rose",
};

const displayTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(2026, 0, 1, hours, minutes),
  );
};

const sessionDate = (session: ScheduleItem, end = false) =>
  new Date(`${session.date}T${end ? session.end_time : session.start_time}:00+05:30`);

function LiveSummary({ sessions }: { sessions: ScheduleItem[] }) {
  const now = new Date();
  const current = sessions.find((session) => sessionDate(session) <= now && sessionDate(session, true) > now);
  const next = sessions.find((session) => sessionDate(session) > now);
  const eventStart = new Date("2026-09-11T17:00:00+05:30");
  const eventEnd = new Date("2026-09-13T15:00:00+05:30");

  if (current) {
    return (
      <section className="live-card active-live">
        <div className="live-pulse" />
        <div>
          <span className="eyebrow">Happening now · {current.venue}</span>
          <h2>{current.title}</h2>
          <p>Until {displayTime(current.end_time)} · {current.details}</p>
        </div>
      </section>
    );
  }

  if (now < eventStart && next) {
    const days = Math.max(1, Math.ceil((eventStart.getTime() - now.getTime()) / 86_400_000));
    return (
      <section className="live-card">
        <div className="date-tile"><strong>{days}</strong><span>days to go</span></div>
        <div>
          <span className="eyebrow">The first session</span>
          <h2>{next.title}</h2>
          <p>Friday at {displayTime(next.start_time)} · {next.venue}</p>
        </div>
      </section>
    );
  }

  if (now > eventEnd) {
    return <section className="live-card"><div><span className="eyebrow">Event complete</span><h2>Thank you for being part of PROFCON 2026.</h2></div></section>;
  }

  return next ? (
    <section className="live-card">
      <div className="date-tile"><strong>Next</strong><span>{next.venue}</span></div>
      <div><span className="eyebrow">Coming up</span><h2>{next.title}</h2><p>{displayTime(next.start_time)} · {next.details}</p></div>
    </section>
  ) : null;
}

function PublicSchedule() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(DAYS[0].date);
  const [selectedVenue, setSelectedVenue] = useState("All venues");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"sheet" | "demo">("demo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicSchedule().then((result) => {
      setSessions(result.sessions);
      setSource(result.source);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (DAYS.some((day) => day.date === today)) setSelectedDate(today);
      setLoading(false);
    });
  }, []);

  const daySessions = useMemo(() => sessions.filter((item) => item.date === selectedDate), [sessions, selectedDate]);
  const venues = useMemo(() => ["All venues", ...new Set(daySessions.map((item) => item.venue))], [daySessions]);
  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return daySessions.filter((item) => {
      const venueMatch = selectedVenue === "All venues" || item.venue === selectedVenue;
      const textMatch = !needle || `${item.title} ${item.details} ${item.track} ${item.venue}`.toLowerCase().includes(needle);
      return venueMatch && textMatch;
    });
  }, [daySessions, query, selectedVenue]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    visibleSessions.forEach((session) => map.set(session.venue, [...(map.get(session.venue) || []), session]));
    return [...map.entries()];
  }, [visibleSessions]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <nav className="nav wrap">
          <a className="brand" href="/" aria-label="PROFCON schedule home"><span>30</span><div><strong>PROFCON</strong><small>2026 · PALAKKAD</small></div></a>
          <a className="admin-link" href="/admin">Admin</a>
        </nav>
        <div className="hero wrap">
          <div>
            <span className="eyebrow light">September 11–13 · Ahalia Campus</span>
            <h1>Find your next<br /><em>conversation.</em></h1>
            <p>Three days of ideas, faith, campus life and community—organized into one live schedule.</p>
          </div>
          <div className="hero-mark" aria-hidden="true"><span>30</span><small>EDITIONS<br />ONE VISION</small></div>
        </div>
      </header>

      <main className="wrap main-content">
        {!loading && <LiveSummary sessions={sessions} />}
        {source === "demo" && <div className="demo-note"><span>Preview data</span> Connect the included Google Apps Script to make this schedule live.</div>}

        <section className="schedule-controls" aria-label="Schedule filters">
          <div className="day-tabs">
            {DAYS.map((day, index) => (
              <button key={day.date} className={selectedDate === day.date ? "selected" : ""} onClick={() => { setSelectedDate(day.date); setSelectedVenue("All venues"); }}>
                <span>Day {index + 1}</span><strong>{day.short}</strong>
              </button>
            ))}
          </div>
          <label className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions or speakers" /></label>
          <div className="venue-filters">
            {venues.map((venue) => <button key={venue} className={selectedVenue === venue ? "selected" : ""} onClick={() => setSelectedVenue(venue)}>{venue}</button>)}
          </div>
        </section>

        <div className="schedule-heading"><div><span className="eyebrow">Full programme</span><h2>{DAYS.find((day) => day.date === selectedDate)?.label}, September {selectedDate.slice(-2)}</h2></div><span>{visibleSessions.length} sessions</span></div>

        {loading ? <div className="empty-state">Loading the schedule…</div> : grouped.length === 0 ? <div className="empty-state">No sessions match these filters.</div> : (
          <div className="venue-groups">
            {grouped.map(([venue, items]) => (
              <section className="venue-group" key={venue}>
                <aside><span className={`venue-dot ${VENUE_COLORS[venue] || "blue"}`} /> <div><strong>{venue}</strong><small>{items[0].track}</small></div></aside>
                <div className="session-list">
                  {items.map((session) => (
                    <article className="session-card" key={session.id}>
                      <time><strong>{displayTime(session.start_time)}</strong><span>{displayTime(session.end_time)}</span></time>
                      <div className="session-copy"><span className="category">{session.category}</span><h3>{session.title}</h3><p>{session.details}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer><div className="wrap"><div className="brand footer-brand"><span>30</span><div><strong>PROFCON</strong><small>WISDOM STUDENTS</small></div></div><p>September 11–13, 2026 · Ahalia Campus, Palakkad</p></div></footer>
    </div>
  );
}

export default function App() {
  return window.location.pathname.startsWith("/admin") ? <Admin /> : <PublicSchedule />;
}
