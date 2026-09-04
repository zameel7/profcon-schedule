const SHEET_NAME = 'Schedule';
const TIMEZONE = 'Asia/Kolkata';
const HEADERS = [
  'id', 'date', 'day', 'track', 'venue', 'start_time', 'end_time',
  'title', 'details', 'category', 'status', 'last_updated', 'source_page'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PROFCON Website')
    .addItem('Set admin key', 'configureAdminKey')
    .addItem('Check sheet setup', 'setupScheduleSheet')
    .addToUi();
}

function configureAdminKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Set website admin key',
    'Use a long, unique password. The website will ask admins for this key.',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const key = result.getResponseText().trim();
  if (key.length < 12) throw new Error('Use an admin key with at least 12 characters.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  ui.alert('Admin key saved.');
}

function setupScheduleSheet() {
  const spreadsheet = SpreadsheetApp.getActive();
  spreadsheet.setSpreadsheetTimeZone(TIMEZONE);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Missing sheet: ${SHEET_NAME}`);
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (actual.join('|') !== HEADERS.join('|')) {
    throw new Error(`The ${SHEET_NAME} header row has changed. Restore the original headers before deploying.`);
  }
  // Use bounded data ranges. Google Sheets can reject whole-column formatting
  // across multiple columns (for example F:G) as a column-level action.
  const dataRowCount = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 2, dataRowCount, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 6, dataRowCount, 1).setNumberFormat('h:mm AM/PM');
  sheet.getRange(2, 7, dataRowCount, 1).setNumberFormat('h:mm AM/PM');
  sheet.getRange(2, 12, dataRowCount, 1).setNumberFormat('yyyy-mm-dd h:mm');
  SpreadsheetApp.getUi().alert('Schedule sheet is ready for the website.');
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'schedule';
    if (action !== 'schedule') throw new Error('Unsupported action.');
    const sessions = readSessions_().filter((session) => session.status === 'Published');
    return json_({ ok: true, sessions });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    requireAdmin_(body.adminKey);
    if (body.action === 'list') return json_({ ok: true, sessions: readSessions_() });
    if (body.action === 'upsert') return json_({ ok: true, session: upsertSession_(body.session) });
    if (body.action === 'delete') return json_({ ok: true, deletedId: deleteSession_(body.id) });
    throw new Error('Unsupported action.');
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function requireAdmin_(providedKey) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expectedKey) throw new Error('The admin key has not been configured in Apps Script.');
  if (!providedKey || providedKey !== expectedKey) throw new Error('Invalid admin key.');
}

function getScheduleSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Missing sheet: ${SHEET_NAME}`);
  return sheet;
}

function readSessions_() {
  const sheet = getScheduleSheet_();
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  return values
    .filter((row) => String(row[0]).trim())
    .map((row) => Object.fromEntries(HEADERS.map((header, index) => [header, serializeValue_(header, row[index])])))
    .sort((a, b) => `${a.date}T${a.start_time}-${a.venue}`.localeCompare(`${b.date}T${b.start_time}-${b.venue}`));
}

function serializeValue_(header, value) {
  if (!(value instanceof Date)) return value === null || value === undefined ? '' : String(value);
  if (header === 'date') return Utilities.formatDate(value, TIMEZONE, 'yyyy-MM-dd');
  if (header === 'start_time' || header === 'end_time') return Utilities.formatDate(value, TIMEZONE, 'HH:mm');
  return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function upsertSession_(session) {
  if (!session || !session.id || !session.title) throw new Error('Session id and title are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date)) throw new Error('Date must use YYYY-MM-DD.');
  if (!/^\d{2}:\d{2}$/.test(session.start_time) || !/^\d{2}:\d{2}$/.test(session.end_time)) throw new Error('Times must use HH:MM.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getScheduleSheet_();
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat() : [];
    const index = ids.indexOf(String(session.id));
    const rowNumber = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
    const now = new Date();
    const row = HEADERS.map((header) => toSheetValue_(header, header === 'last_updated' ? now : session[header]));
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
    sheet.getRange(rowNumber, 2).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(rowNumber, 6, 1, 2).setNumberFormat('h:mm AM/PM');
    sheet.getRange(rowNumber, 12).setNumberFormat('yyyy-mm-dd h:mm');
    SpreadsheetApp.flush();
    return readSessions_().find((item) => item.id === String(session.id));
  } finally {
    lock.releaseLock();
  }
}

function toSheetValue_(header, value) {
  if (header === 'date') {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  if (header === 'start_time' || header === 'end_time') {
    const [hours, minutes] = String(value).split(':').map(Number);
    return (hours * 60 + minutes) / 1440;
  }
  if (header === 'last_updated') return value instanceof Date ? value : new Date(value);
  if (header === 'source_page') return value === '' || value === undefined ? '' : Number(value);
  return value === null || value === undefined ? '' : String(value);
}

function deleteSession_(id) {
  if (!id) throw new Error('Session id is required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getScheduleSheet_();
    if (sheet.getLastRow() < 2) throw new Error('Session not found.');
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(String(id));
    if (index < 0) throw new Error('Session not found.');
    sheet.deleteRow(index + 2);
    return String(id);
  } finally {
    lock.releaseLock();
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
