import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminRequest, apiUrl, getDemoSchedule, getDemoVenues, saveDemoSchedule, saveDemoVenues } from "../api";
import type { FacultyConfirmation, ScheduleItem, ScheduleStatus, VenueInfo } from "../types";

const emptySession = (): ScheduleItem => ({
  id: `profcon-2026-${crypto.randomUUID().slice(0, 8)}`, date: "2026-09-12", day: "Saturday", track: "Programme", venue: "PRIME",
  start_time: "09:00", end_time: "09:30", session_code: "", title: "", details: "", faculty: "", duty: "",
  faculty_confirmation: "Not Confirmed", media_status: "Not Received", materials_url: "", hints_url: "",
  category: "Session", status: "Draft", last_updated: new Date().toISOString(), source_sheet: "Admin", source_page: "",
});
const emptyVenue = (): VenueInfo => ({ id: crypto.randomUUID().slice(0, 8), name: "", program_head: "", incharge_name: "", incharge_phone: "", it_coordinator: "", it_phone: "", coordinator_name: "", coordinator_phone: "", sort_order: 10, active: true });
const dayForDate = (date: string) => ({ "2026-09-11": "Friday", "2026-09-12": "Saturday", "2026-09-13": "Sunday" })[date] || "";
const confirmationClass = (value?: string) => value?.toLowerCase() === "confirmed" ? "confirmed" : "unconfirmed";

export default function Admin() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueInfo | null>(null);
  const [section, setSection] = useState<"sessions" | "venues">("sessions");
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("profcon-admin-key") || "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isDemo = !apiUrl;

  const loadData = async () => {
    setBusy(true); setNotice("");
    try {
      if (isDemo) { setSessions(getDemoSchedule()); setVenues(getDemoVenues()); }
      else if (adminKey) {
        const data = await adminRequest({ action: "list", adminKey });
        setSessions(data.sessions || []); setVenues(data.venues?.length ? data.venues : getDemoVenues());
        sessionStorage.setItem("profcon-admin-key", adminKey);
        if (!data.venues) setNotice("The live Apps Script is still on the previous schema. Deploy the updated Code.gs before editing contacts or importing the new tracker.");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load the schedule."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void loadData(); }, []);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return sessions.filter((item) => (status === "All statuses" || item.status === status) && (!needle || `${item.title} ${item.faculty || item.details} ${item.venue} ${item.session_code}`.toLowerCase().includes(needle)));
  }, [sessions, query, status]);

  const saveSession = async (event: FormEvent) => {
    event.preventDefault(); if (!editing) return; setBusy(true); setNotice("");
    const session = { ...editing, details: editing.faculty || editing.details, day: dayForDate(editing.date), last_updated: new Date().toISOString() };
    try {
      if (isDemo) { const next = [...sessions.filter((item) => item.id !== session.id), session]; setSessions(next); saveDemoSchedule(next); }
      else { await adminRequest({ action: "upsert", adminKey, session }); await loadData(); }
      setEditing(null); setNotice(`Saved “${session.title}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save this session."); }
    finally { setBusy(false); }
  };

  const saveVenue = async (event: FormEvent) => {
    event.preventDefault(); if (!editingVenue) return; setBusy(true); setNotice("");
    const venue = { ...editingVenue, name: editingVenue.name.trim().toUpperCase() };
    try {
      if (isDemo) { const next = [...venues.filter((item) => item.id !== venue.id), venue]; setVenues(next); saveDemoVenues(next); }
      else { await adminRequest({ action: "upsertVenue", adminKey, venue }); await loadData(); }
      setEditingVenue(null); setNotice(`Saved ${venue.name} contacts.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save this venue."); }
    finally { setBusy(false); }
  };

  const deleteSession = async (session: ScheduleItem) => {
    if (!window.confirm(`Delete “${session.title}”?`)) return; setBusy(true);
    try {
      if (isDemo) { const next = sessions.filter((item) => item.id !== session.id); setSessions(next); saveDemoSchedule(next); }
      else { await adminRequest({ action: "delete", adminKey, id: session.id }); await loadData(); }
      setNotice(`Deleted “${session.title}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete this session."); }
    finally { setBusy(false); }
  };

  const importTracker = async () => {
    if (!window.confirm("Replace the live schedule with all 68 sessions from the latest program-team tracker? Existing sessions will be replaced.")) return;
    setBusy(true); setNotice("");
    try {
      const trackerSessions = getDemoSchedule(); const trackerVenues = getDemoVenues();
      if (isDemo) { setSessions(trackerSessions); setVenues(trackerVenues); saveDemoSchedule(trackerSessions); saveDemoVenues(trackerVenues); }
      else { await adminRequest({ action: "replaceAll", adminKey, sessions: trackerSessions, venues: trackerVenues }); await loadData(); }
      setNotice("The latest master tracker is now the live schedule.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not import the tracker."); }
    finally { setBusy(false); }
  };

  if (!isDemo && !sessionStorage.getItem("profcon-admin-key")) return <main className="login-page"><a href="/" className="back-link">← Public schedule</a><form className="login-card" onSubmit={(event) => { event.preventDefault(); void loadData(); }}><span className="eyebrow">Schedule admin</span><h1>Welcome back.</h1><p>Enter the admin key saved in Apps Script → Project settings → Script properties.</p><label>Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required /></label>{notice && <div className="form-notice error">{notice}</div>}<button className="primary-button" disabled={busy}>{busy ? "Checking…" : "Open dashboard"}</button></form></main>;

  return <div className="admin-shell">
    <aside className="admin-sidebar"><a className="brand" href="/"><span>30</span><div><strong>PROFCON</strong><small>SCHEDULE ADMIN</small></div></a><nav><button className={section === "sessions" ? "selected" : ""} onClick={() => setSection("sessions")}>Sessions</button><button className={section === "venues" ? "selected" : ""} onClick={() => setSection("venues")}>Venue contacts</button><a href="/" target="_blank">View public site ↗</a></nav><div className="admin-mode"><span className={isDemo ? "amber-dot" : "green-dot"} />{isDemo ? "Local preview mode" : "Google Sheet connected"}</div></aside>
    <main className="admin-main"><header className="admin-header"><div><span className="eyebrow">Event operations</span><h1>{section === "sessions" ? "Sessions" : "Venue contacts"}</h1><p>{section === "sessions" ? `${sessions.length} sessions across three days` : `${venues.length} public venue desks`}</p></div><div className="header-actions">{section === "sessions" && <button className="secondary-button" onClick={() => void importTracker()} disabled={busy}>Load latest tracker</button>}<button className="primary-button" onClick={() => section === "sessions" ? setEditing(emptySession()) : setEditingVenue(emptyVenue())}>+ Add {section === "sessions" ? "session" : "venue"}</button></div></header>
      {isDemo && <div className="admin-banner"><strong>Preview mode.</strong> Changes are stored only in this browser.</div>}{notice && <div className="form-notice">{notice}</div>}
      {section === "sessions" ? <><section className="admin-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, faculty, code or venue" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Published</option><option>Draft</option><option>Cancelled</option></select><button onClick={() => void loadData()} disabled={busy}>Refresh</button></section><section className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date & time</th><th>Session</th><th>Venue</th><th>Faculty</th><th>Files</th><th /></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}><td><strong>{session.date.slice(5)}</strong><span>{session.start_time}–{session.end_time}</span></td><td><strong>{session.session_code ? `${session.session_code} · ` : ""}{session.title}</strong><span>{session.track}</span></td><td><strong>{session.venue}</strong><span className={`confirmation admin-confirmation ${confirmationClass(session.faculty_confirmation)}`}><i />{session.faculty_confirmation || "Not Confirmed"}</span></td><td><strong>{session.faculty || session.details}</strong><span>{session.duty || "No duty notes"}</span></td><td><strong>{session.media_status || "Not Received"}</strong><span>{session.materials_url || session.hints_url ? "Links added" : "No links"}</span></td><td><button className="text-button" onClick={() => setEditing({ ...session })}>Edit</button><button className="text-button danger" onClick={() => void deleteSession(session)}>Delete</button></td></tr>)}</tbody></table></section></> : <section className="venue-admin-grid">{[...venues].sort((a, b) => a.sort_order - b.sort_order).map((venue) => <article key={venue.id}><div><span className="eyebrow">Venue {venue.sort_order}</span><h2>{venue.name}</h2></div><dl><div><dt>Program head</dt><dd>{venue.program_head || "—"}</dd></div><div><dt>In-charge</dt><dd>{venue.incharge_name || "—"}<small>{venue.incharge_phone || "Number pending"}</small></dd></div><div><dt>IT coordination</dt><dd>{venue.it_coordinator || "—"}<small>{venue.it_phone || "Number pending"}</small></dd></div><div><dt>Coordinator</dt><dd>{venue.coordinator_name || "—"}<small>{venue.coordinator_phone || "Number pending"}</small></dd></div></dl><button className="secondary-button" onClick={() => setEditingVenue({ ...venue })}>Edit contacts</button></article>)}</section>}
    </main>

    {editing && <div className="drawer-backdrop" onMouseDown={() => setEditing(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Schedule item</span><h2>{sessions.some((item) => item.id === editing.id) ? "Edit session" : "New session"}</h2></div><button className="close-button" onClick={() => setEditing(null)}>×</button></div><form onSubmit={saveSession}>
      <label>Session code<input value={editing.session_code || ""} onChange={(event) => setEditing({ ...editing, session_code: event.target.value.toUpperCase() })} placeholder="D2-01" /></label><label>Publication<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as ScheduleStatus })}><option>Published</option><option>Draft</option><option>Cancelled</option></select></label>
      <label className="full">Title<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required /></label><label className="full">Faculty<textarea value={editing.faculty || editing.details} onChange={(event) => setEditing({ ...editing, faculty: event.target.value, details: event.target.value })} rows={3} /></label><label className="full">Duty / notes<textarea value={editing.duty || ""} onChange={(event) => setEditing({ ...editing, duty: event.target.value })} rows={2} /></label>
      <label>Date<select value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })}><option value="2026-09-11">Fri, Sep 11</option><option value="2026-09-12">Sat, Sep 12</option><option value="2026-09-13">Sun, Sep 13</option></select></label><label>Venue<select value={editing.venue} onChange={(event) => setEditing({ ...editing, venue: event.target.value })}>{venues.map((venue) => <option key={venue.id}>{venue.name}</option>)}</select></label><label>Start time<input type="time" value={editing.start_time} onChange={(event) => setEditing({ ...editing, start_time: event.target.value })} required /></label><label>End time<input type="time" value={editing.end_time} onChange={(event) => setEditing({ ...editing, end_time: event.target.value })} required /></label><label>Track<input value={editing.track} onChange={(event) => setEditing({ ...editing, track: event.target.value })} required /></label><label>Category<select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}><option>Session</option><option>Workshop</option><option>Ceremony</option><option>Engagement</option><option>Break</option><option>Gathering</option></select></label>
      <label>Faculty confirmation<select value={editing.faculty_confirmation || "Not Confirmed"} onChange={(event) => setEditing({ ...editing, faculty_confirmation: event.target.value as FacultyConfirmation })}><option>Confirmed</option><option>Not Confirmed</option><option>Pending</option><option>Declined</option></select></label><label>Media status<select value={editing.media_status || "Not Received"} onChange={(event) => setEditing({ ...editing, media_status: event.target.value })}><option>Received</option><option>Not Received</option><option>Not Required</option></select></label><label className="full">Presentation / video / material link<input type="url" value={editing.materials_url || ""} onChange={(event) => setEditing({ ...editing, materials_url: event.target.value })} placeholder="https://drive.google.com/…" /></label><label className="full">Hints file link<input type="url" value={editing.hints_url || ""} onChange={(event) => setEditing({ ...editing, hints_url: event.target.value })} placeholder="https://drive.google.com/…" /></label>
      <div className="drawer-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save session"}</button></div></form></aside></div>}

    {editingVenue && <div className="drawer-backdrop" onMouseDown={() => setEditingVenue(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Venue desk</span><h2>Edit contacts</h2></div><button className="close-button" onClick={() => setEditingVenue(null)}>×</button></div><form onSubmit={saveVenue}><label>Venue name<input value={editingVenue.name} onChange={(event) => setEditingVenue({ ...editingVenue, name: event.target.value.toUpperCase() })} required /></label><label>Display order<input type="number" min="1" value={editingVenue.sort_order} onChange={(event) => setEditingVenue({ ...editingVenue, sort_order: Number(event.target.value) })} /></label><label className="full">Program head<input value={editingVenue.program_head} onChange={(event) => setEditingVenue({ ...editingVenue, program_head: event.target.value })} /></label><label>Program in-charge<input value={editingVenue.incharge_name} onChange={(event) => setEditingVenue({ ...editingVenue, incharge_name: event.target.value })} /></label><label>In-charge phone<input type="tel" value={editingVenue.incharge_phone} onChange={(event) => setEditingVenue({ ...editingVenue, incharge_phone: event.target.value })} placeholder="+91 …" /></label><label>IT coordinator<input value={editingVenue.it_coordinator} onChange={(event) => setEditingVenue({ ...editingVenue, it_coordinator: event.target.value })} /></label><label>IT phone<input type="tel" value={editingVenue.it_phone} onChange={(event) => setEditingVenue({ ...editingVenue, it_phone: event.target.value })} placeholder="+91 …" /></label><label>Coordinator<input value={editingVenue.coordinator_name} onChange={(event) => setEditingVenue({ ...editingVenue, coordinator_name: event.target.value })} /></label><label>Coordinator phone<input type="tel" value={editingVenue.coordinator_phone} onChange={(event) => setEditingVenue({ ...editingVenue, coordinator_phone: event.target.value })} placeholder="+91 …" /></label><label className="checkbox-label"><input type="checkbox" checked={editingVenue.active} onChange={(event) => setEditingVenue({ ...editingVenue, active: event.target.checked })} /> Show on public site</label><div className="drawer-actions"><button type="button" onClick={() => setEditingVenue(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save venue"}</button></div></form></aside></div>}
  </div>;
}
