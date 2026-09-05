import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminRequest, apiUrl, getDemoSchedule, getDemoTasks, getDemoVenues, saveDemoSchedule, saveDemoTasks, saveDemoVenues } from "../api";
import type { AdminTask, FacultyConfirmation, ScheduleItem, ScheduleStatus, TaskPriority, TaskStatus, VenueInfo } from "../types";

const emptySession = (): ScheduleItem => ({
  id: `profcon-2026-${crypto.randomUUID().slice(0, 8)}`, date: "2026-09-12", day: "Saturday", track: "Programme", venue: "PRIME",
  start_time: "09:00", end_time: "09:30", session_code: "", title: "", details: "", faculty: "", duty: "",
  faculty_confirmation: "Not Confirmed", media_status: "Not Received", materials_url: "", hints_url: "",
  category: "Session", status: "Draft", last_updated: new Date().toISOString(), source_sheet: "Admin", source_page: "",
});
const emptyVenue = (): VenueInfo => ({ id: crypto.randomUUID().slice(0, 8), name: "", program_head: "", incharge_name: "", incharge_phone: "", it_coordinator: "", it_phone: "", coordinator_name: "", coordinator_phone: "", sort_order: 10, active: true });
const localDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const emptyTask = (): AdminTask => {
  const due = new Date(Date.now() + 60 * 60 * 1000); due.setMinutes(Math.ceil(due.getMinutes() / 15) * 15, 0, 0);
  const reminder = new Date(due.getTime() - 30 * 60 * 1000);
  return { id: `task-${crypto.randomUUID().slice(0, 8)}`, title: "", details: "", assignee: "", venue: "General", due_at: localDateTime(due), remind_at: localDateTime(reminder), priority: "Medium", status: "Open", created_at: new Date().toISOString(), completed_at: "" };
};
const dayForDate = (date: string) => ({ "2026-09-11": "Friday", "2026-09-12": "Saturday", "2026-09-13": "Sunday" })[date] || "";
const confirmationClass = (value?: string) => value?.toLowerCase() === "confirmed" ? "confirmed" : "unconfirmed";
const taskTime = (value: string) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No due time";
const dueState = (task: AdminTask) => task.status === "Done" ? "done" : new Date(task.due_at).getTime() < Date.now() ? "overdue" : new Date(task.due_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 ? "soon" : "upcoming";

export default function Admin() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueInfo | null>(null);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [section, setSection] = useState<"sessions" | "venues" | "tasks">("sessions");
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("profcon-admin-key") || "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "denied" : Notification.permission);
  const isDemo = !apiUrl;

  const loadData = async () => {
    setBusy(true); setNotice("");
    try {
      if (isDemo) { setSessions(getDemoSchedule()); setVenues(getDemoVenues()); setTasks(getDemoTasks()); }
      else if (adminKey) {
        const data = await adminRequest({ action: "list", adminKey });
        setSessions(data.sessions || []); setVenues(data.venues?.length ? data.venues : getDemoVenues()); setTasks(data.tasks || []);
        sessionStorage.setItem("profcon-admin-key", adminKey);
        if (!data.venues || !data.tasks) setNotice("The live Apps Script needs the latest Code.gs before venue contacts, tasks, and reminders can sync.");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load the schedule."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void loadData(); }, []);
  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const checkReminders = () => tasks.filter((task) => task.status !== "Done" && task.remind_at && new Date(task.remind_at).getTime() <= Date.now()).forEach((task) => {
      const marker = `profcon-reminder-${task.id}-${task.remind_at}`;
      if (sessionStorage.getItem(marker)) return;
      new Notification(`PROFCON task: ${task.title}`, { body: `${task.assignee ? `${task.assignee} · ` : ""}Due ${taskTime(task.due_at)}`, tag: task.id });
      sessionStorage.setItem(marker, "shown");
    });
    checkReminders();
    const timer = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(timer);
  }, [tasks, notificationPermission]);

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

  const persistTask = async (task: AdminTask) => {
    if (isDemo) {
      const next = [...tasks.filter((item) => item.id !== task.id), task];
      setTasks(next); saveDemoTasks(next);
    } else {
      await adminRequest({ action: "upsertTask", adminKey, task });
      await loadData();
    }
  };

  const saveTask = async (event: FormEvent) => {
    event.preventDefault(); if (!editingTask) return; setBusy(true); setNotice("");
    const task: AdminTask = {
      ...editingTask,
      due_at: new Date(editingTask.due_at).toISOString(),
      remind_at: editingTask.remind_at ? new Date(editingTask.remind_at).toISOString() : "",
      completed_at: editingTask.status === "Done" ? (editingTask.completed_at || new Date().toISOString()) : "",
    };
    try { await persistTask(task); setEditingTask(null); setNotice(`Saved task “${task.title}”.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not save this task."); }
    finally { setBusy(false); }
  };

  const toggleTaskDone = async (task: AdminTask) => {
    setBusy(true); setNotice("");
    const done = task.status !== "Done";
    try { await persistTask({ ...task, status: done ? "Done" : "Open", completed_at: done ? new Date().toISOString() : "" }); setNotice(done ? `Completed “${task.title}”.` : `Reopened “${task.title}”.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not update this task."); }
    finally { setBusy(false); }
  };

  const deleteTask = async (task: AdminTask) => {
    if (!window.confirm(`Delete task “${task.title}”?`)) return; setBusy(true); setNotice("");
    try {
      if (isDemo) { const next = tasks.filter((item) => item.id !== task.id); setTasks(next); saveDemoTasks(next); }
      else { await adminRequest({ action: "deleteTask", adminKey, id: task.id }); await loadData(); }
      setNotice(`Deleted task “${task.title}”.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete this task."); }
    finally { setBusy(false); }
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") { setNotice("Browser notifications are not supported here."); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(permission === "granted" ? "Browser reminders enabled while this admin page is open." : "Browser notification permission was not enabled.");
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
    <aside className="admin-sidebar"><a className="brand" href="/"><span>30</span><div><strong>PROFCON</strong><small>SCHEDULE ADMIN</small></div></a><nav><button className={section === "sessions" ? "selected" : ""} onClick={() => setSection("sessions")}>Sessions</button><button className={section === "venues" ? "selected" : ""} onClick={() => setSection("venues")}>Venue contacts</button><button className={section === "tasks" ? "selected" : ""} onClick={() => setSection("tasks")}>Tasks & reminders</button><a href="/" target="_blank">View public site ↗</a></nav><div className="admin-mode"><span className={isDemo ? "amber-dot" : "green-dot"} />{isDemo ? "Local preview mode" : "Google Sheet connected"}</div></aside>
    <main className="admin-main"><header className="admin-header"><div><span className="eyebrow">Event operations</span><h1>{section === "sessions" ? "Sessions" : section === "venues" ? "Venue contacts" : "Tasks & reminders"}</h1><p>{section === "sessions" ? `${sessions.length} sessions across three days` : section === "venues" ? `${venues.length} public venue desks` : `${tasks.filter((task) => task.status !== "Done").length} open tasks`}</p></div><div className="header-actions">{section === "sessions" && <button className="secondary-button" onClick={() => void importTracker()} disabled={busy}>Load latest tracker</button>}{section === "tasks" && notificationPermission !== "granted" && <button className="secondary-button" onClick={() => void enableNotifications()}>Enable reminders</button>}<button className="primary-button" onClick={() => section === "sessions" ? setEditing(emptySession()) : section === "venues" ? setEditingVenue(emptyVenue()) : setEditingTask(emptyTask())}>+ Add {section === "sessions" ? "session" : section === "venues" ? "venue" : "task"}</button></div></header>
      {isDemo && <div className="admin-banner"><strong>Preview mode.</strong> Changes are stored only in this browser.</div>}{notice && <div className="form-notice">{notice}</div>}
      {section === "sessions" ? <><section className="admin-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, faculty, code or venue" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Published</option><option>Draft</option><option>Cancelled</option></select><button onClick={() => void loadData()} disabled={busy}>Refresh</button></section><section className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date & time</th><th>Session</th><th>Venue</th><th>Faculty</th><th>Files</th><th /></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}><td><strong>{session.date.slice(5)}</strong><span>{session.start_time}–{session.end_time}</span></td><td><strong>{session.session_code ? `${session.session_code} · ` : ""}{session.title}</strong><span>{session.track}</span></td><td><strong>{session.venue}</strong><span className={`confirmation admin-confirmation ${confirmationClass(session.faculty_confirmation)}`}><i />{session.faculty_confirmation || "Not Confirmed"}</span></td><td><strong>{session.faculty || session.details}</strong><span>{session.duty || "No duty notes"}</span></td><td><strong>{session.media_status || "Not Received"}</strong><span>{session.materials_url || session.hints_url ? "Links added" : "No links"}</span></td><td><button className="text-button" onClick={() => setEditing({ ...session })}>Edit</button><button className="text-button danger" onClick={() => void deleteSession(session)}>Delete</button></td></tr>)}</tbody></table></section></> : section === "venues" ? <section className="venue-admin-grid">{[...venues].sort((a, b) => a.sort_order - b.sort_order).map((venue) => <article key={venue.id}><div><span className="eyebrow">Venue {venue.sort_order}</span><h2>{venue.name}</h2></div><dl><div><dt>Program head</dt><dd>{venue.program_head || "—"}</dd></div><div><dt>In-charge</dt><dd>{venue.incharge_name || "—"}<small>{venue.incharge_phone || "Number pending"}</small></dd></div><div><dt>IT coordination</dt><dd>{venue.it_coordinator || "—"}<small>{venue.it_phone || "Number pending"}</small></dd></div><div><dt>Coordinator</dt><dd>{venue.coordinator_name || "—"}<small>{venue.coordinator_phone || "Number pending"}</small></dd></div></dl><button className="secondary-button" onClick={() => setEditingVenue({ ...venue })}>Edit contacts</button></article>)}</section> : <section className="task-dashboard"><div className="task-summary"><article><span>Open</span><strong>{tasks.filter((task) => task.status !== "Done").length}</strong></article><article className="overdue"><span>Overdue</span><strong>{tasks.filter((task) => dueState(task) === "overdue").length}</strong></article><article><span>Completed</span><strong>{tasks.filter((task) => task.status === "Done").length}</strong></article></div>{notificationPermission === "granted" && <div className="reminder-note"><span className="green-dot" />Browser reminders are active while this page is open.</div>}{tasks.length === 0 ? <div className="empty-state">No tasks yet. Add the first task and choose when you want to be reminded.</div> : <div className="task-list">{[...tasks].sort((a, b) => Number(a.status === "Done") - Number(b.status === "Done") || a.due_at.localeCompare(b.due_at)).map((task) => <article className={`task-card ${dueState(task)}`} key={task.id}><button className="task-check" onClick={() => void toggleTaskDone(task)} aria-label={task.status === "Done" ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.status === "Done" ? "✓" : ""}</button><div className="task-copy"><div><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><span className={`task-state ${dueState(task)}`}>{dueState(task) === "overdue" ? "Overdue" : task.status}</span></div><h2>{task.title}</h2>{task.details && <p>{task.details}</p>}<small>{task.assignee || "Unassigned"} · {task.venue || "General"}</small></div><div className="task-times"><span>Due<strong>{taskTime(task.due_at)}</strong></span><span>Reminder<strong>{task.remind_at ? taskTime(task.remind_at) : "None"}</strong></span></div><div className="task-actions"><button className="text-button" onClick={() => setEditingTask({ ...task, due_at: localDateTime(task.due_at), remind_at: localDateTime(task.remind_at) })}>Edit</button><button className="text-button danger" onClick={() => void deleteTask(task)}>Delete</button></div></article>)}</div>}</section>}
    </main>

    {editing && <div className="drawer-backdrop" onMouseDown={() => setEditing(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Schedule item</span><h2>{sessions.some((item) => item.id === editing.id) ? "Edit session" : "New session"}</h2></div><button className="close-button" onClick={() => setEditing(null)}>×</button></div><form onSubmit={saveSession}>
      <label>Session code<input value={editing.session_code || ""} onChange={(event) => setEditing({ ...editing, session_code: event.target.value.toUpperCase() })} placeholder="D2-01" /></label><label>Publication<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as ScheduleStatus })}><option>Published</option><option>Draft</option><option>Cancelled</option></select></label>
      <label className="full">Title<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required /></label><label className="full">Faculty<textarea value={editing.faculty || editing.details} onChange={(event) => setEditing({ ...editing, faculty: event.target.value, details: event.target.value })} rows={3} /></label><label className="full">Duty / notes<textarea value={editing.duty || ""} onChange={(event) => setEditing({ ...editing, duty: event.target.value })} rows={2} /></label>
      <label>Date<select value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })}><option value="2026-09-11">Fri, Sep 11</option><option value="2026-09-12">Sat, Sep 12</option><option value="2026-09-13">Sun, Sep 13</option></select></label><label>Venue<select value={editing.venue} onChange={(event) => setEditing({ ...editing, venue: event.target.value })}>{venues.map((venue) => <option key={venue.id}>{venue.name}</option>)}</select></label><label>Start time<input type="time" value={editing.start_time} onChange={(event) => setEditing({ ...editing, start_time: event.target.value })} required /></label><label>End time<input type="time" value={editing.end_time} onChange={(event) => setEditing({ ...editing, end_time: event.target.value })} required /></label><label>Track<input value={editing.track} onChange={(event) => setEditing({ ...editing, track: event.target.value })} required /></label><label>Category<select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}><option>Session</option><option>Workshop</option><option>Ceremony</option><option>Engagement</option><option>Break</option><option>Gathering</option></select></label>
      <label>Faculty confirmation<select value={editing.faculty_confirmation || "Not Confirmed"} onChange={(event) => setEditing({ ...editing, faculty_confirmation: event.target.value as FacultyConfirmation })}><option>Confirmed</option><option>Not Confirmed</option><option>Pending</option><option>Declined</option></select></label><label>Media status<select value={editing.media_status || "Not Received"} onChange={(event) => setEditing({ ...editing, media_status: event.target.value })}><option>Received</option><option>Not Received</option><option>Not Required</option></select></label><label className="full">Presentation / video / material link<input type="url" value={editing.materials_url || ""} onChange={(event) => setEditing({ ...editing, materials_url: event.target.value })} placeholder="https://drive.google.com/…" /></label><label className="full">Hints file link<input type="url" value={editing.hints_url || ""} onChange={(event) => setEditing({ ...editing, hints_url: event.target.value })} placeholder="https://drive.google.com/…" /></label>
      <div className="drawer-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save session"}</button></div></form></aside></div>}

    {editingVenue && <div className="drawer-backdrop" onMouseDown={() => setEditingVenue(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Venue desk</span><h2>Edit contacts</h2></div><button className="close-button" onClick={() => setEditingVenue(null)}>×</button></div><form onSubmit={saveVenue}><label>Venue name<input value={editingVenue.name} onChange={(event) => setEditingVenue({ ...editingVenue, name: event.target.value.toUpperCase() })} required /></label><label>Display order<input type="number" min="1" value={editingVenue.sort_order} onChange={(event) => setEditingVenue({ ...editingVenue, sort_order: Number(event.target.value) })} /></label><label className="full">Program head<input value={editingVenue.program_head} onChange={(event) => setEditingVenue({ ...editingVenue, program_head: event.target.value })} /></label><label>Program in-charge<input value={editingVenue.incharge_name} onChange={(event) => setEditingVenue({ ...editingVenue, incharge_name: event.target.value })} /></label><label>In-charge phone<input type="tel" value={editingVenue.incharge_phone} onChange={(event) => setEditingVenue({ ...editingVenue, incharge_phone: event.target.value })} placeholder="+91 …" /></label><label>IT coordinator<input value={editingVenue.it_coordinator} onChange={(event) => setEditingVenue({ ...editingVenue, it_coordinator: event.target.value })} /></label><label>IT phone<input type="tel" value={editingVenue.it_phone} onChange={(event) => setEditingVenue({ ...editingVenue, it_phone: event.target.value })} placeholder="+91 …" /></label><label>Coordinator<input value={editingVenue.coordinator_name} onChange={(event) => setEditingVenue({ ...editingVenue, coordinator_name: event.target.value })} /></label><label>Coordinator phone<input type="tel" value={editingVenue.coordinator_phone} onChange={(event) => setEditingVenue({ ...editingVenue, coordinator_phone: event.target.value })} placeholder="+91 …" /></label><label className="checkbox-label"><input type="checkbox" checked={editingVenue.active} onChange={(event) => setEditingVenue({ ...editingVenue, active: event.target.checked })} /> Show on public site</label><div className="drawer-actions"><button type="button" onClick={() => setEditingVenue(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save venue"}</button></div></form></aside></div>}

    {editingTask && <div className="drawer-backdrop" onMouseDown={() => setEditingTask(null)}><aside className="editor-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">Operations task</span><h2>{tasks.some((task) => task.id === editingTask.id) ? "Edit task" : "New task"}</h2></div><button className="close-button" onClick={() => setEditingTask(null)}>×</button></div><form onSubmit={saveTask}><label className="full">Task title<input value={editingTask.title} onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })} required autoFocus /></label><label className="full">Notes<textarea value={editingTask.details} onChange={(event) => setEditingTask({ ...editingTask, details: event.target.value })} rows={4} placeholder="What needs to be done?" /></label><label>Assignee<input value={editingTask.assignee} onChange={(event) => setEditingTask({ ...editingTask, assignee: event.target.value })} placeholder="Name" /></label><label>Venue<select value={editingTask.venue} onChange={(event) => setEditingTask({ ...editingTask, venue: event.target.value })}><option>General</option>{venues.map((venue) => <option key={venue.id}>{venue.name}</option>)}</select></label><label>Priority<select value={editingTask.priority} onChange={(event) => setEditingTask({ ...editingTask, priority: event.target.value as TaskPriority })}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Status<select value={editingTask.status} onChange={(event) => setEditingTask({ ...editingTask, status: event.target.value as TaskStatus })}><option>Open</option><option>In Progress</option><option>Done</option></select></label><label>Due date & time<input type="datetime-local" value={editingTask.due_at} onChange={(event) => setEditingTask({ ...editingTask, due_at: event.target.value })} required /></label><label>Remind me at<input type="datetime-local" value={editingTask.remind_at} max={editingTask.due_at} onChange={(event) => setEditingTask({ ...editingTask, remind_at: event.target.value })} /></label><div className="drawer-actions"><button type="button" onClick={() => setEditingTask(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save task"}</button></div></form></aside></div>}
  </div>;
}
