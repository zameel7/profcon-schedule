import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  adminRequest,
  apiUrl,
  getDemoSchedule,
  getDemoTasks,
  getDemoVenues,
  saveDemoSchedule,
  saveDemoTasks,
  saveDemoVenues,
} from "../api";
import type { AdminTask, FacultyConfirmation, ScheduleItem, ScheduleStatus, VenueInfo } from "../types";

const emptySession = (): ScheduleItem => ({
  id: `profcon-2026-${crypto.randomUUID().slice(0, 8)}`,
  date: "2026-09-12",
  day: "Saturday",
  track: "Programme",
  venue: "PRIME",
  start_time: "09:00",
  end_time: "09:30",
  session_code: "",
  title: "",
  details: "",
  faculty: "",
  duty: "",
  faculty_confirmation: "Not Confirmed",
  media_status: "Not Received",
  materials_url: "",
  hints_url: "",
  category: "Session",
  status: "Draft",
  last_updated: new Date().toISOString(),
  source_sheet: "Admin",
  source_page: "",
});

const emptyVenue = (): VenueInfo => ({
  id: crypto.randomUUID().slice(0, 8),
  name: "",
  program_head: "",
  incharge_name: "",
  incharge_phone: "",
  it_coordinator: "",
  it_phone: "",
  coordinator_name: "",
  coordinator_phone: "",
  sort_order: 10,
  active: true,
});

const emptyTask = (): AdminTask => ({
  id: `task-${crypto.randomUUID().slice(0, 8)}`,
  title: "",
  details: "",
  assignee: "",
  venue: "General",
  due_at: "",
  remind_at: "",
  priority: "Medium",
  status: "Open",
  created_at: new Date().toISOString(),
  completed_at: "",
});

const localDateTime = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const dayForDate = (date: string) =>
  ({ "2026-09-11": "Friday", "2026-09-12": "Saturday", "2026-09-13": "Sunday" })[date] || "";

const isConfirmed = (value?: string) => value?.trim().toLowerCase() === "confirmed";

const displayTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(
    new Date(2026, 0, 1, hours, minutes),
  );
};

const taskTime = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Anytime";

function SessionEditor({
  value,
  setValue,
  venues,
  busy,
  existing,
  onSave,
  onCancel,
  onDelete,
}: {
  value: ScheduleItem;
  setValue: (value: ScheduleItem) => void;
  venues: VenueInfo[];
  busy: boolean;
  existing: boolean;
  onSave: (event: FormEvent) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <form className="inline-editor session-editor" onSubmit={onSave} onClick={(event) => event.stopPropagation()}>
      <div className="editor-heading">
        <span>{existing ? "Editing session" : "New session"}</span>
        <input
          className="title-input"
          value={value.title}
          onChange={(event) => setValue({ ...value, title: event.target.value })}
          placeholder="Session title"
          required
          autoFocus
        />
      </div>
      <label className="edit-field full">Faculty
        <input value={value.faculty || value.details} onChange={(event) => setValue({ ...value, faculty: event.target.value, details: event.target.value })} placeholder="Faculty name" />
      </label>
      <div className="edit-grid">
        <label className="edit-field">Date
          <select value={value.date} onChange={(event) => setValue({ ...value, date: event.target.value })}>
            <option value="2026-09-11">Fri, Sep 11</option><option value="2026-09-12">Sat, Sep 12</option><option value="2026-09-13">Sun, Sep 13</option>
          </select>
        </label>
        <label className="edit-field">Start
          <input type="time" value={value.start_time} onChange={(event) => setValue({ ...value, start_time: event.target.value })} required />
        </label>
        <label className="edit-field">End
          <input type="time" value={value.end_time} onChange={(event) => setValue({ ...value, end_time: event.target.value })} required />
        </label>
        <label className="edit-field">Venue
          <select value={value.venue} onChange={(event) => setValue({ ...value, venue: event.target.value })}>{venues.map((venue) => <option key={venue.id}>{venue.name}</option>)}</select>
        </label>
        <label className="edit-field">Session code
          <input value={value.session_code || ""} onChange={(event) => setValue({ ...value, session_code: event.target.value.toUpperCase() })} placeholder="D2-01" />
        </label>
        <label className="edit-field">Track
          <input value={value.track} onChange={(event) => setValue({ ...value, track: event.target.value })} />
        </label>
        <label className="edit-field">Faculty confirmation
          <select value={value.faculty_confirmation || "Not Confirmed"} onChange={(event) => setValue({ ...value, faculty_confirmation: event.target.value as FacultyConfirmation })}>
            <option>Confirmed</option><option>Not Confirmed</option><option>Pending</option><option>Declined</option>
          </select>
        </label>
        <label className="edit-field">Publication
          <select value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as ScheduleStatus })}>
            <option>Published</option><option>Draft</option><option>Cancelled</option>
          </select>
        </label>
        <label className="edit-field">Media
          <select value={value.media_status || "Not Received"} onChange={(event) => setValue({ ...value, media_status: event.target.value })}>
            <option>Received</option><option>Not Received</option><option>Not Required</option>
          </select>
        </label>
      </div>
      <label className="edit-field full">Duty / notes
        <textarea rows={2} value={value.duty || ""} onChange={(event) => setValue({ ...value, duty: event.target.value })} />
      </label>
      <label className="edit-field full">Presentation, video or material link
        <input type="url" value={value.materials_url || ""} onChange={(event) => setValue({ ...value, materials_url: event.target.value })} placeholder="https://drive.google.com/…" />
      </label>
      <label className="edit-field full">Hints file link
        <input type="url" value={value.hints_url || ""} onChange={(event) => setValue({ ...value, hints_url: event.target.value })} placeholder="https://drive.google.com/…" />
      </label>
      <div className="inline-actions">
        {existing && <button type="button" className="delete-action" onClick={onDelete}>Delete</button>}
        <span />
        <button type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function VenueEditor({ value, setValue, busy, onSave, onCancel }: {
  value: VenueInfo;
  setValue: (value: VenueInfo) => void;
  busy: boolean;
  onSave: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return <form className="inline-editor venue-editor" onSubmit={onSave} onClick={(event) => event.stopPropagation()}>
    <div className="editor-heading"><span>Editing venue</span><input className="title-input" value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value.toUpperCase() })} placeholder="Venue name" required autoFocus /></div>
    <div className="edit-grid">
      <label className="edit-field">Program head<input value={value.program_head} onChange={(event) => setValue({ ...value, program_head: event.target.value })} /></label>
      <label className="edit-field">Program in-charge<input value={value.incharge_name} onChange={(event) => setValue({ ...value, incharge_name: event.target.value })} /></label>
      <label className="edit-field">In-charge phone<input type="tel" value={value.incharge_phone} onChange={(event) => setValue({ ...value, incharge_phone: event.target.value })} /></label>
      <label className="edit-field">IT coordinator<input value={value.it_coordinator} onChange={(event) => setValue({ ...value, it_coordinator: event.target.value })} /></label>
      <label className="edit-field">IT phone<input type="tel" value={value.it_phone} onChange={(event) => setValue({ ...value, it_phone: event.target.value })} /></label>
      <label className="edit-field">Coordinator<input value={value.coordinator_name} onChange={(event) => setValue({ ...value, coordinator_name: event.target.value })} /></label>
      <label className="edit-field">Coordinator phone<input type="tel" value={value.coordinator_phone} onChange={(event) => setValue({ ...value, coordinator_phone: event.target.value })} /></label>
      <label className="edit-field">Display order<input type="number" min="1" value={value.sort_order} onChange={(event) => setValue({ ...value, sort_order: Number(event.target.value) })} /></label>
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={value.active} onChange={(event) => setValue({ ...value, active: event.target.checked })} /> Show on public site</label>
    <div className="inline-actions"><span /><button type="button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
  </form>;
}

export default function Admin() {
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [editingSession, setEditingSession] = useState<ScheduleItem | null>(null);
  const [editingVenue, setEditingVenue] = useState<VenueInfo | null>(null);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [section, setSection] = useState<"sessions" | "venues" | "tasks">("sessions");
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("profcon-admin-key") || "");
  const [query, setQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("All");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "denied" : Notification.permission);
  const isDemo = !apiUrl;

  const loadData = async () => {
    setBusy(true);
    setNotice("");
    try {
      if (isDemo) {
        setSessions(getDemoSchedule());
        setVenues(getDemoVenues());
        setTasks(getDemoTasks());
      } else if (adminKey) {
        const data = await adminRequest({ action: "list", adminKey });
        setSessions(data.sessions || []);
        setVenues(data.venues?.length ? data.venues : getDemoVenues());
        setTasks(data.tasks || []);
        sessionStorage.setItem("profcon-admin-key", adminKey);
        if (!data.venues || !data.tasks) setNotice("Update Code.gs to sync venue contacts and tasks with Google Sheets.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the schedule.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const checkReminders = () => tasks
      .filter((task) => task.status !== "Done" && task.remind_at && new Date(task.remind_at).getTime() <= Date.now())
      .forEach((task) => {
        const marker = `profcon-reminder-${task.id}-${task.remind_at}`;
        if (sessionStorage.getItem(marker)) return;
        new Notification(`PROFCON task: ${task.title}`, { body: `Due ${taskTime(task.due_at)}`, tag: task.id });
        sessionStorage.setItem(marker, "shown");
      });
    checkReminders();
    const timer = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(timer);
  }, [tasks, notificationPermission]);

  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sessions.filter((session) =>
      (selectedVenue === "All" || session.venue === selectedVenue)
      && (!needle || `${session.title} ${session.faculty || session.details} ${session.venue} ${session.session_code}`.toLowerCase().includes(needle)),
    );
  }, [sessions, query, selectedVenue]);

  const saveSession = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingSession) return;
    setBusy(true);
    setNotice("");
    const session = { ...editingSession, details: editingSession.faculty || editingSession.details, day: dayForDate(editingSession.date), last_updated: new Date().toISOString() };
    try {
      if (isDemo) {
        const next = [...sessions.filter((item) => item.id !== session.id), session];
        setSessions(next);
        saveDemoSchedule(next);
      } else {
        await adminRequest({ action: "upsert", adminKey, session });
        await loadData();
      }
      setEditingSession(null);
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
        await loadData();
      }
      setEditingSession(null);
      setNotice(`Deleted “${session.title}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete this session.");
    } finally {
      setBusy(false);
    }
  };

  const saveVenue = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingVenue) return;
    setBusy(true);
    setNotice("");
    const venue = { ...editingVenue, name: editingVenue.name.trim().toUpperCase() };
    try {
      if (isDemo) {
        const next = [...venues.filter((item) => item.id !== venue.id), venue];
        setVenues(next);
        saveDemoVenues(next);
      } else {
        await adminRequest({ action: "upsertVenue", adminKey, venue });
        await loadData();
      }
      setEditingVenue(null);
      setNotice(`Saved ${venue.name} contacts.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this venue.");
    } finally {
      setBusy(false);
    }
  };

  const persistTask = async (task: AdminTask) => {
    if (isDemo) {
      const next = [...tasks.filter((item) => item.id !== task.id), task];
      setTasks(next);
      saveDemoTasks(next);
    } else {
      await adminRequest({ action: "upsertTask", adminKey, task });
      await loadData();
    }
  };

  const saveTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingTask) return;
    setBusy(true);
    setNotice("");
    const time = editingTask.remind_at || editingTask.due_at;
    const isoTime = time ? new Date(time).toISOString() : "";
    const task: AdminTask = { ...editingTask, due_at: isoTime, remind_at: isoTime };
    try {
      await persistTask(task);
      setEditingTask(null);
      setNotice(`Saved task “${task.title}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this task.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTaskDone = async (task: AdminTask) => {
    const done = task.status !== "Done";
    setBusy(true);
    try {
      await persistTask({ ...task, status: done ? "Done" : "Open", completed_at: done ? new Date().toISOString() : "" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update this task.");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async (task: AdminTask) => {
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    setBusy(true);
    try {
      if (isDemo) {
        const next = tasks.filter((item) => item.id !== task.id);
        setTasks(next);
        saveDemoTasks(next);
      } else {
        await adminRequest({ action: "deleteTask", adminKey, id: task.id });
        await loadData();
      }
      setEditingTask(null);
      setNotice(`Deleted task “${task.title}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete this task.");
    } finally {
      setBusy(false);
    }
  };

  const importTracker = async () => {
    if (!window.confirm("Replace the live schedule with all 68 sessions from the latest tracker?")) return;
    setBusy(true);
    setNotice("");
    try {
      const trackerSessions = getDemoSchedule();
      const trackerVenues = getDemoVenues();
      if (isDemo) {
        setSessions(trackerSessions);
        setVenues(trackerVenues);
        saveDemoSchedule(trackerSessions);
        saveDemoVenues(trackerVenues);
      } else {
        await adminRequest({ action: "replaceAll", adminKey, sessions: trackerSessions, venues: trackerVenues });
        await loadData();
      }
      setNotice("The latest tracker is now the live schedule.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import the tracker.");
    } finally {
      setBusy(false);
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotice("Browser notifications are not supported here.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(permission === "granted" ? "Task notifications are enabled while this page is open." : "Notification permission was not enabled.");
  };

  const startTaskEdit = (task: AdminTask) => {
    const time = localDateTime(task.remind_at || task.due_at);
    setEditingTask({ ...task, due_at: time, remind_at: time });
  };

  if (!isDemo && !sessionStorage.getItem("profcon-admin-key")) {
    return <main className="login-page"><a href="/" className="back-link">← Public schedule</a><form className="login-card" onSubmit={(event) => { event.preventDefault(); void loadData(); }}><span className="eyebrow">Schedule admin</span><h1>Welcome back.</h1><p>Enter the admin key saved in Apps Script → Project settings → Script properties.</p><label>Admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required /></label>{notice && <div className="form-notice error">{notice}</div>}<button className="primary-button" disabled={busy}>{busy ? "Checking…" : "Open admin"}</button></form></main>;
  }

  const sortedTasks = [...tasks].sort((a, b) => Number(a.status === "Done") - Number(b.status === "Done") || (a.due_at || "9999").localeCompare(b.due_at || "9999"));

  return <div className="simple-admin">
    <header className="site-header compact-site-header"><nav className="nav wrap"><a className="brand" href="/"><span>30</span><div><strong>PROFCON</strong><small>SCHEDULE ADMIN</small></div></a><a className="admin-link" href="/">Public schedule</a></nav></header>
    <main className="wrap simple-admin-main">
      <header className="simple-admin-title"><div><span className="eyebrow">Event operations</span><h1>Schedule admin</h1><p>Click any session or venue to edit it.</p></div><span className={`connection-pill ${isDemo ? "preview" : "connected"}`}>{isDemo ? "Preview mode" : "Sheet connected"}</span></header>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={section === "sessions" ? "selected" : ""} onClick={() => setSection("sessions")}>Sessions <span>{sessions.length}</span></button>
        <button className={section === "venues" ? "selected" : ""} onClick={() => setSection("venues")}>Venues <span>{venues.length}</span></button>
        <button className={section === "tasks" ? "selected" : ""} onClick={() => setSection("tasks")}>Tasks <span>{tasks.filter((task) => task.status !== "Done").length}</span></button>
      </nav>
      {isDemo && <div className="admin-banner"><strong>Preview mode.</strong> Changes are saved only in this browser.</div>}
      {notice && <div className="form-notice">{notice}</div>}

      {section === "sessions" && <section>
        <div className="simple-toolbar">
          <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions or faculty" /></label>
          <div className="toolbar-buttons"><button onClick={() => void importTracker()} disabled={busy}>Load tracker</button><button className="primary-button" onClick={() => setEditingSession(emptySession())}>+ Add session</button></div>
        </div>
        <div className="venue-filter-row"><button className={selectedVenue === "All" ? "selected" : ""} onClick={() => setSelectedVenue("All")}>All</button>{venues.map((venue) => <button key={venue.id} className={selectedVenue === venue.name ? "selected" : ""} onClick={() => setSelectedVenue(venue.name)}>{venue.name}</button>)}</div>
        <div className="simple-session-list">
          {editingSession && !sessions.some((session) => session.id === editingSession.id) && <SessionEditor value={editingSession} setValue={setEditingSession} venues={venues} busy={busy} existing={false} onSave={saveSession} onCancel={() => setEditingSession(null)} onDelete={() => undefined} />}
          {filteredSessions.map((session) => editingSession?.id === session.id
            ? <SessionEditor key={session.id} value={editingSession} setValue={setEditingSession} venues={venues} busy={busy} existing onSave={saveSession} onCancel={() => setEditingSession(null)} onDelete={() => void deleteSession(session)} />
            : <article className="admin-session-card" key={session.id} role="button" tabIndex={0} onClick={() => setEditingSession({ ...session })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setEditingSession({ ...session }); }}>
              <time><strong>{displayTime(session.start_time)}</strong><span>{session.date.slice(5)} · {displayTime(session.end_time)}</span></time>
              <div className="session-copy"><span className="category">{session.session_code || session.category} · {session.venue}</span><h2>{session.title}</h2><p>{session.faculty || session.details || "Faculty not added"}</p></div>
              <span className={`confirmation compact-status ${isConfirmed(session.faculty_confirmation) ? "confirmed" : "unconfirmed"}`}><i /><span>{isConfirmed(session.faculty_confirmation) ? "Confirmed" : "Not confirmed"}</span></span>
              <span className="row-arrow" aria-hidden="true">›</span>
            </article>)}
        </div>
      </section>}

      {section === "venues" && <section>
        <div className="section-bar"><div><h2>Venue contacts</h2><p>Click a venue to update its contact details.</p></div><button className="primary-button" onClick={() => setEditingVenue(emptyVenue())}>+ Add venue</button></div>
        <div className="venue-simple-grid">
          {editingVenue && !venues.some((venue) => venue.id === editingVenue.id) && <VenueEditor value={editingVenue} setValue={setEditingVenue} busy={busy} onSave={saveVenue} onCancel={() => setEditingVenue(null)} />}
          {[...venues].sort((a, b) => a.sort_order - b.sort_order).map((venue) => editingVenue?.id === venue.id
            ? <VenueEditor key={venue.id} value={editingVenue} setValue={setEditingVenue} busy={busy} onSave={saveVenue} onCancel={() => setEditingVenue(null)} />
            : <article className="venue-simple-card" key={venue.id} role="button" tabIndex={0} onClick={() => setEditingVenue({ ...venue })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setEditingVenue({ ...venue }); }}><span className="eyebrow">Venue {venue.sort_order}</span><h2>{venue.name}</h2><dl><div><dt>Program head</dt><dd>{venue.program_head || "—"}</dd></div><div><dt>In-charge</dt><dd>{venue.incharge_name || "—"}<small>{venue.incharge_phone || "Number pending"}</small></dd></div><div><dt>IT coordination</dt><dd>{venue.it_coordinator || "—"}<small>{venue.it_phone || "Number pending"}</small></dd></div><div><dt>Coordinator</dt><dd>{venue.coordinator_name || "—"}<small>{venue.coordinator_phone || "Number pending"}</small></dd></div></dl><span className="edit-hint">Click to edit</span></article>)}
        </div>
      </section>}

      {section === "tasks" && <section className="simple-tasks">
        <div className="section-bar"><div><h2>Tasks</h2><p>{tasks.filter((task) => task.status !== "Done").length} open · {tasks.filter((task) => task.status === "Done").length} completed</p></div>{notificationPermission !== "granted" && <button onClick={() => void enableNotifications()}>Enable notifications</button>}</div>
        {notificationPermission === "granted" && <div className="reminder-note"><span className="green-dot" />Notifications are active while this page is open.</div>}
        {tasks.length === 0 ? <div className="empty-state">No tasks yet. Use the + button to add one.</div> : <div className="task-simple-list">{sortedTasks.map((task) => <article className={`task-simple-row ${task.status === "Done" ? "done" : ""}`} key={task.id}>
          <button className="task-circle" onClick={() => void toggleTaskDone(task)} aria-label={task.status === "Done" ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.status === "Done" ? "✓" : ""}</button>
          <button className="task-body" onClick={() => startTaskEdit(task)}><strong>{task.title}</strong>{task.details && <span>{task.details}</span>}{task.due_at && <time>{taskTime(task.due_at)}</time>}</button>
        </article>)}</div>}
      </section>}
    </main>

    {section === "tasks" && <button className="floating-add" onClick={() => setEditingTask(emptyTask())} aria-label="Add task">+</button>}
    {editingTask && <div className="composer-backdrop" onMouseDown={() => setEditingTask(null)}><form className="task-composer" onSubmit={saveTask} onMouseDown={(event) => event.stopPropagation()}>
      <div className="composer-head"><h2>{tasks.some((task) => task.id === editingTask.id) ? "Edit task" : "New task"}</h2><button type="button" onClick={() => setEditingTask(null)} aria-label="Close">×</button></div>
      <label>Task<input value={editingTask.title} onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })} placeholder="What needs to be done?" required autoFocus /></label>
      <label>Description <span>optional</span><textarea rows={3} value={editingTask.details} onChange={(event) => setEditingTask({ ...editingTask, details: event.target.value })} placeholder="Add details" /></label>
      <label>Time <span>optional · sends notification</span><input type="datetime-local" value={editingTask.remind_at || editingTask.due_at} onChange={(event) => setEditingTask({ ...editingTask, due_at: event.target.value, remind_at: event.target.value })} /></label>
      <div className="composer-actions">{tasks.some((task) => task.id === editingTask.id) && <button type="button" className="delete-action" onClick={() => void deleteTask(editingTask)}>Delete</button>}<span /><button type="button" onClick={() => setEditingTask(null)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form></div>}
  </div>;
}
