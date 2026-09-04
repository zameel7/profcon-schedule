import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminRequest, apiUrl, getDemoSchedule, saveDemoSchedule } from "../api";
import type { ScheduleItem, ScheduleStatus } from "../types";

const emptySession = (): ScheduleItem => ({
  id: `profcon-2026-${crypto.randomUUID().slice(0, 8)}`,
  date: "2026-09-12",
  day: "Saturday",
  track: "The Deep",
  venue: "PRIME",
  start_time: "09:00",
  end_time: "09:30",
  title: "",
  details: "",
  category: "Session",
  status: "Draft",
  last_updated: new Date().toISOString(),
  source_page: "",
});

const dayForDate = (date: string) => ({ "2026-09-11": "Friday", "2026-09-12": "Saturday", "2026-09-13": "Sunday" })[date] || "";

export default function Admin() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("profcon-admin-key") || "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isDemo = !apiUrl;

  const loadSessions = async () => {
    setBusy(true);
    setNotice("");
    try {
      if (isDemo) {
        setSessions(getDemoSchedule());
      } else if (adminKey) {
        const data = await adminRequest({ action: "list", adminKey });
        setSessions(data.sessions || []);
        sessionStorage.setItem("profcon-admin-key", adminKey);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the schedule.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void loadSessions(); }, []);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return sessions.filter((item) =>
      (status === "All statuses" || item.status === status) &&
      (!needle || `${item.title} ${item.details} ${item.venue}`.toLowerCase().includes(needle)),
    );
  }, [sessions, query, status]);

  const saveSession = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setNotice("");
    const session = { ...editing, day: dayForDate(editing.date), last_updated: new Date().toISOString() };
    try {
      if (isDemo) {
        const next = [...sessions.filter((item) => item.id !== session.id), session];
        setSessions(next);
        saveDemoSchedule(next);
      } else {
        await adminRequest({ action: "upsert", adminKey, session });
        await loadSessions();
      }
      setEditing(null);
      setNotice(`Saved “${session.title}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this session.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSession = async (session: ScheduleItem) => {
    if (!window.confirm(`Delete “${session.title}”?`)) return;
    setBusy(true);
    try {
      if (isDemo) {
        const next = sessions.filter((item) => item.id !== session.id);
        setSessions(next);
        saveDemoSchedule(next);
      } else {
        await adminRequest({ action: "delete", adminKey, id: session.id });
        await loadSessions();
      }
      setNotice(`Deleted “${session.title}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete this session.");
    } finally {
      setBusy(false);
    }
  };

  if (!isDemo && !sessionStorage.getItem("profcon-admin-key")) {
    return (
      <main className="login-page">
        <a href="/" className="back-link">← Public schedule</a>
        <form className="login-card" onSubmit={(event) => { event.preventDefault(); void loadSessions(); }}>
          <span className="eyebrow">Schedule admin</span><h1>Welcome back.</h1><p>Enter the admin key configured in the Google Sheet’s Apps Script.</p>
          <label>Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required /></label>
          {notice && <div className="form-notice error">{notice}</div>}
          <button className="primary-button" disabled={busy}>{busy ? "Checking…" : "Open dashboard"}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="brand" href="/"><span>30</span><div><strong>PROFCON</strong><small>SCHEDULE ADMIN</small></div></a>
        <nav><a className="selected" href="/admin">Schedule</a><a href="/" target="_blank">View public site ↗</a></nav>
        <div className="admin-mode"><span className={isDemo ? "amber-dot" : "green-dot"} />{isDemo ? "Local preview mode" : "Google Sheet connected"}</div>
      </aside>
      <main className="admin-main">
        <header className="admin-header"><div><span className="eyebrow">Event operations</span><h1>Schedule</h1><p>{sessions.length} sessions across three days</p></div><button className="primary-button" onClick={() => setEditing(emptySession())}>+ Add session</button></header>
        {isDemo && <div className="admin-banner"><strong>Preview mode.</strong> Changes are stored only in this browser until VITE_SCHEDULE_API_URL is configured.</div>}
        {notice && <div className="form-notice">{notice}</div>}
        <section className="admin-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, speaker or venue" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Published</option><option>Draft</option><option>Cancelled</option></select><button onClick={() => void loadSessions()} disabled={busy}>Refresh</button></section>
        <section className="admin-table-wrap">
          <table className="admin-table"><thead><tr><th>Date & time</th><th>Session</th><th>Venue</th><th>Status</th><th /></tr></thead><tbody>
            {filtered.map((session) => <tr key={session.id}><td><strong>{session.date.slice(5)}</strong><span>{session.start_time}–{session.end_time}</span></td><td><strong>{session.title}</strong><span>{session.details}</span></td><td><strong>{session.venue}</strong><span>{session.track}</span></td><td><span className={`status-pill ${session.status.toLowerCase()}`}>{session.status}</span></td><td><button className="text-button" onClick={() => setEditing({ ...session })}>Edit</button><button className="text-button danger" onClick={() => void deleteSession(session)}>Delete</button></td></tr>)}
          </tbody></table>
        </section>
      </main>

      {editing && <div className="drawer-backdrop" onMouseDown={() => setEditing(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Schedule item</span><h2>{sessions.some((item) => item.id === editing.id) ? "Edit session" : "New session"}</h2></div><button className="close-button" onClick={() => setEditing(null)}>×</button></div><form onSubmit={saveSession}>
        <label className="full">Title<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required /></label>
        <label className="full">Speakers / details<textarea value={editing.details} onChange={(event) => setEditing({ ...editing, details: event.target.value })} rows={5} /></label>
        <label>Date<select value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })}><option value="2026-09-11">Fri, Sep 11</option><option value="2026-09-12">Sat, Sep 12</option><option value="2026-09-13">Sun, Sep 13</option></select></label>
        <label>Venue<input value={editing.venue} onChange={(event) => setEditing({ ...editing, venue: event.target.value.toUpperCase() })} required /></label>
        <label>Start time<input type="time" value={editing.start_time} onChange={(event) => setEditing({ ...editing, start_time: event.target.value })} required /></label>
        <label>End time<input type="time" value={editing.end_time} onChange={(event) => setEditing({ ...editing, end_time: event.target.value })} required /></label>
        <label>Track<input value={editing.track} onChange={(event) => setEditing({ ...editing, track: event.target.value })} required /></label>
        <label>Category<select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}><option>Session</option><option>Ceremony</option><option>Engagement</option><option>Break</option><option>Workshop</option><option>Gathering</option></select></label>
        <label>Status<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as ScheduleStatus })}><option>Published</option><option>Draft</option><option>Cancelled</option></select></label>
        <div className="drawer-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save session"}</button></div>
      </form></aside></div>}
    </div>
  );
}
