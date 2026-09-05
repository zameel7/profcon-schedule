const SCHEDULE_SHEET = 'Schedule';
const VENUES_SHEET = 'Venues';
const TASKS_SHEET = 'Tasks';
const TIMEZONE = 'Asia/Kolkata';
const SCHEDULE_HEADERS = [
  'id', 'date', 'day', 'track', 'venue', 'start_time', 'end_time',
  'session_code', 'title', 'details', 'faculty', 'duty', 'faculty_confirmation',
  'media_status', 'materials_url', 'hints_url', 'category', 'status',
  'last_updated', 'source_sheet', 'source_page'
];
const VENUE_HEADERS = [
  'id', 'name', 'program_head', 'incharge_name', 'incharge_phone',
  'it_coordinator', 'it_phone', 'coordinator_name', 'coordinator_phone',
  'sort_order', 'active'
];
const TASK_HEADERS = [
  'id', 'title', 'details', 'assignee', 'venue', 'due_at', 'remind_at',
  'priority', 'status', 'created_at', 'completed_at'
];
const DEFAULT_VENUES = [
  ['prime', 'PRIME', 'Faseeh PO', 'Hilal Saleem', '', 'Zameel Hassan', '', '', '', 1, true],
  ['florets', 'FLORETS', 'Abdulla Basil', 'Shifa Haris', '', 'Jazeel Madani', '', '', '', 2, true],
  ['global', 'GLOBAL', 'Haroun', 'Hisham', '', 'Adhil Ahmed', '', '', '', 3, true],
  ['bloom', 'BLOOM', 'Waseem', 'Athil Moideen', '', 'Abdul Ahad', '', '', '', 4, true],
  ['quest', 'QUEST', 'Waseem', 'Athil Moideen', '', 'Abdul Ahad', '', '', '', 5, true],
  ['idam', 'IDAM', '', '', '', '', '', 'Safeer Al Hikami', '', 6, true]
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PROFCON Website')
    .addItem('Set admin key', 'configureAdminKey')
    .addItem('Set up website sheets', 'setupWebsiteSheets')
    .addToUi();
}

function configureAdminKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Set website admin key', 'Use a long, unique password. It is saved in Apps Script project settings, not in the sheet.', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const key = result.getResponseText().trim();
  if (key.length < 12) throw new Error('Use an admin key with at least 12 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  ui.alert('Admin key saved in Script properties.');
}

function setupWebsiteSheets() {
  SpreadsheetApp.getActive().setSpreadsheetTimeZone(TIMEZONE);
  ensureWebsiteSheets_();
  const schedule = getSheet_(SCHEDULE_SHEET);
  const headers = getHeaders_(schedule);
  const rowCount = Math.max(schedule.getMaxRows() - 1, 1);
  setColumnFormat_(schedule, headers, 'date', rowCount, 'yyyy-mm-dd');
  setColumnFormat_(schedule, headers, 'start_time', rowCount, 'h:mm AM/PM');
  setColumnFormat_(schedule, headers, 'end_time', rowCount, 'h:mm AM/PM');
  setColumnFormat_(schedule, headers, 'last_updated', rowCount, 'yyyy-mm-dd h:mm');
  const tasks = getSheet_(TASKS_SHEET);
  const taskHeaders = getHeaders_(tasks);
  const taskRowCount = Math.max(tasks.getMaxRows() - 1, 1);
  ['due_at', 'remind_at', 'created_at', 'completed_at'].forEach((header) => setColumnFormat_(tasks, taskHeaders, header, taskRowCount, 'yyyy-mm-dd h:mm'));
  SpreadsheetApp.getUi().alert('Schedule, venue-contact, and task sheets are ready.');
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'schedule';
    if (action !== 'schedule') throw new Error('Unsupported action.');
    ensureWebsiteSheets_();
    const sessions = readObjects_(SCHEDULE_SHEET).filter((session) => session.status === 'Published');
    const venues = readObjects_(VENUES_SHEET).filter((venue) => venue.active !== false && venue.active !== 'false');
    return json_({ ok: true, sessions: sortSessions_(sessions), venues: sortVenues_(venues) });
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    requireAdmin_(body.adminKey);
    ensureWebsiteSheets_();
    if (body.action === 'list') return json_({ ok: true, sessions: sortSessions_(readObjects_(SCHEDULE_SHEET)), venues: sortVenues_(readObjects_(VENUES_SHEET)), tasks: sortTasks_(readObjects_(TASKS_SHEET)) });
    if (body.action === 'upsert') return json_({ ok: true, session: upsertObject_(SCHEDULE_SHEET, SCHEDULE_HEADERS, validateSession_(body.session)) });
    if (body.action === 'upsertVenue') return json_({ ok: true, venue: upsertObject_(VENUES_SHEET, VENUE_HEADERS, validateVenue_(body.venue)) });
    if (body.action === 'upsertTask') return json_({ ok: true, task: upsertObject_(TASKS_SHEET, TASK_HEADERS, validateTask_(body.task)) });
    if (body.action === 'delete') return json_({ ok: true, deletedId: deleteObject_(SCHEDULE_SHEET, body.id) });
    if (body.action === 'deleteTask') return json_({ ok: true, deletedId: deleteObject_(TASKS_SHEET, body.id) });
    if (body.action === 'replaceAll') return json_({ ok: true, result: replaceAll_(body.sessions, body.venues) });
    throw new Error('Unsupported action.');
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function requireAdmin_(providedKey) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expectedKey) throw new Error('Set ADMIN_KEY in Apps Script Project settings → Script properties.');
  if (!providedKey || providedKey !== expectedKey) throw new Error('Invalid admin key.');
}

function ensureWebsiteSheets_() {
  ensureSheet_(SCHEDULE_SHEET, SCHEDULE_HEADERS);
  const venueSheet = ensureSheet_(VENUES_SHEET, VENUE_HEADERS);
  ensureSheet_(TASKS_SHEET, TASK_HEADERS);
  if (venueSheet.getLastRow() === 1) venueSheet.getRange(2, 1, DEFAULT_VENUES.length, VENUE_HEADERS.length).setValues(DEFAULT_VENUES);
}

function ensureSheet_(name, requiredHeaders) {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String);
  if (!existing.some((value) => value.trim())) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const missing = requiredHeaders.filter((header) => !existing.includes(header));
    if (missing.length) sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}`);
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map((value) => String(value).trim());
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (sheet.getLastRow() < 2) return [];
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.filter((row) => String(row[0]).trim()).map((row) => Object.fromEntries(headers.map((header, index) => [header, serializeValue_(header, row[index])])));
}

function serializeValue_(header, value) {
  if (header === 'active') return value === true || String(value).toLowerCase() === 'true';
  if (header === 'sort_order') return Number(value) || 0;
  if (!(value instanceof Date)) return value === null || value === undefined ? '' : String(value);
  if (header === 'date') return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  if (header === 'start_time' || header === 'end_time') return Utilities.formatDate(value, TIMEZONE, 'HH:mm');
  return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function validateSession_(session) {
  if (!session || !session.id || !session.title) throw new Error('Session id and title are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) throw new Error('Date must use YYYY-MM-DD.');
  if (!/^\d{2}:\d{2}$/.test(session.start_time) || !/^\d{2}:\d{2}$/.test(session.end_time)) throw new Error('Times must use HH:MM.');
  ['materials_url', 'hints_url'].forEach((field) => { if (session[field] && !/^https?:\/\//i.test(session[field])) throw new Error(`${field} must be an http(s) link.`); });
  session.last_updated = new Date();
  return session;
}

function validateVenue_(venue) {
  if (!venue || !venue.id || !venue.name) throw new Error('Venue id and name are required.');
  venue.name = String(venue.name).trim().toUpperCase();
  venue.sort_order = Number(venue.sort_order) || 99;
  venue.active = venue.active !== false;
  return venue;
}

function validateTask_(task) {
  if (!task || !task.id || !String(task.title || '').trim()) throw new Error('Task id and title are required.');
  if (task.due_at && isNaN(new Date(task.due_at).getTime())) throw new Error('Task time is invalid.');
  if (task.remind_at && isNaN(new Date(task.remind_at).getTime())) throw new Error('Reminder time is invalid.');
  task.priority = task.priority || 'Medium';
  task.status = task.status || 'Open';
  if (!['Low', 'Medium', 'High'].includes(task.priority)) throw new Error('Task priority is invalid.');
  if (!['Open', 'In Progress', 'Done'].includes(task.status)) throw new Error('Task status is invalid.');
  if (!task.created_at) task.created_at = new Date();
  task.completed_at = task.status === 'Done' ? (task.completed_at || new Date()) : '';
  return task;
}

function upsertObject_(sheetName, requiredHeaders, object) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat() : [];
    const index = ids.indexOf(String(object.id));
    const rowNumber = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
    const row = headers.map((header) => toSheetValue_(header, object[header]));
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    if (sheetName === SCHEDULE_SHEET) formatScheduleRow_(sheet, headers, rowNumber);
    if (sheetName === TASKS_SHEET) formatTaskRow_(sheet, headers, rowNumber);
    SpreadsheetApp.flush();
    return readObjects_(sheetName).find((item) => item.id === String(object.id));
  } finally { lock.releaseLock(); }
}

function toSheetValue_(header, value) {
  if (header === 'date') { const parts = String(value).split('-').map(Number); return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0); }
  if (header === 'start_time' || header === 'end_time') { const parts = String(value).split(':').map(Number); return (parts[0] * 60 + parts[1]) / 1440; }
  if (header === 'last_updated') return value instanceof Date ? value : new Date(value || Date.now());
  if (['due_at', 'remind_at', 'created_at', 'completed_at'].includes(header)) return value ? (value instanceof Date ? value : new Date(value)) : '';
  if (header === 'source_page' || header === 'sort_order') return value === '' || value === undefined ? '' : Number(value);
  if (header === 'active') return value !== false && String(value).toLowerCase() !== 'false';
  const text = value === null || value === undefined ? '' : String(value);
  return text.startsWith('=') ? `'${text}` : text;
}

function deleteObject_(sheetName, id) {
  if (!id) throw new Error('Item id is required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(sheetName);
    if (sheet.getLastRow() < 2) throw new Error('Item not found.');
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(String(id));
    if (index < 0) throw new Error('Item not found.');
    sheet.deleteRow(index + 2);
    return String(id);
  } finally { lock.releaseLock(); }
}

function replaceAll_(sessions, venues) {
  if (!Array.isArray(sessions) || !Array.isArray(venues)) throw new Error('Sessions and venues are required.');
  if (sessions.length > 500 || venues.length > 50) throw new Error('Import is larger than the allowed limit.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    replaceSheetRows_(SCHEDULE_SHEET, sessions.map(validateSession_));
    replaceSheetRows_(VENUES_SHEET, venues.map(validateVenue_));
    return { sessions: sessions.length, venues: venues.length };
  } finally { lock.releaseLock(); }
}

function replaceSheetRows_(sheetName, objects) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  if (objects.length) sheet.getRange(2, 1, objects.length, headers.length).setValues(objects.map((object) => headers.map((header) => toSheetValue_(header, object[header]))));
  if (sheetName === SCHEDULE_SHEET && objects.length) {
    const rowCount = objects.length;
    setColumnFormat_(sheet, headers, 'date', rowCount, 'yyyy-mm-dd');
    setColumnFormat_(sheet, headers, 'start_time', rowCount, 'h:mm AM/PM');
    setColumnFormat_(sheet, headers, 'end_time', rowCount, 'h:mm AM/PM');
    setColumnFormat_(sheet, headers, 'last_updated', rowCount, 'yyyy-mm-dd h:mm');
  }
}

function formatScheduleRow_(sheet, headers, rowNumber) {
  ['date', 'start_time', 'end_time', 'last_updated'].forEach((header) => {
    const column = headers.indexOf(header) + 1;
    if (column > 0) sheet.getRange(rowNumber, column).setNumberFormat(header === 'date' ? 'yyyy-mm-dd' : header === 'last_updated' ? 'yyyy-mm-dd h:mm' : 'h:mm AM/PM');
  });
}

function formatTaskRow_(sheet, headers, rowNumber) {
  ['due_at', 'remind_at', 'created_at', 'completed_at'].forEach((header) => {
    const column = headers.indexOf(header) + 1;
    if (column > 0) sheet.getRange(rowNumber, column).setNumberFormat('yyyy-mm-dd h:mm');
  });
}

function setColumnFormat_(sheet, headers, header, rowCount, format) {
  const column = headers.indexOf(header) + 1;
  if (column > 0) sheet.getRange(2, column, rowCount, 1).setNumberFormat(format);
}

function sortSessions_(sessions) { return sessions.sort((a, b) => `${a.date}T${a.start_time}-${a.venue}-${a.title}`.localeCompare(`${b.date}T${b.start_time}-${b.venue}-${b.title}`)); }
function sortVenues_(venues) { return venues.sort((a, b) => Number(a.sort_order) - Number(b.sort_order)); }
function sortTasks_(tasks) { return tasks.sort((a, b) => `${a.status === 'Done' ? 1 : 0}-${a.due_at || '9999'}-${a.title}`.localeCompare(`${b.status === 'Done' ? 1 : 0}-${b.due_at || '9999'}-${b.title}`)); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
