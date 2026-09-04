import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const outputDir = path.join(root, "outputs", "2026-09-04-profcon-schedule");
const previewDir = path.join(root, "tmp", "spreadsheets");
const schedule = JSON.parse(
  await fs.readFile(path.join(root, "src", "data", "schedule.json"), "utf8"),
);

const workbook = Workbook.create();
const guide = workbook.worksheets.add("Guide");
const dataSheet = workbook.worksheets.add("Schedule");

guide.showGridLines = false;
guide.getRange("A1:B1").values = [["30th PROFCON 2026", ""]];
guide.getRange("A2:B2").values = [["Schedule data for the public website and admin editor", ""]];
guide.getRange("A4:B9").values = [
  ["Event", "30th PROFCON 2026"],
  ["Dates", "September 11-13, 2026"],
  ["Location", "Ahalia Campus, Palakkad"],
  ["Timezone", "Asia/Kolkata"],
  ["Source", "30th PROFCON 2026 - Complete Event Schedule.pdf"],
  ["Schedule rows", schedule.length],
];
guide.getRange("A11:B15").values = [
  ["How this workbook is used", ""],
  ["1", "Keep the Schedule sheet name and header row unchanged."],
  ["2", "The website reads published rows through the included Apps Script API."],
  ["3", "Use the website admin page for changes after the API is connected."],
  ["4", "Draft rows stay hidden from the public schedule."],
];
guide.getRange("A1:B1").format.font = { bold: true, size: 18, color: "#183153" };
guide.getRange("A2:B2").format.font = { italic: true, size: 11, color: "#5B677A" };
guide.getRange("A4:A9").format.font = { bold: true, color: "#183153" };
guide.getRange("A11:B11").format.fill = "#183153";
guide.getRange("A11:B11").format.font = { bold: true, color: "#FFFFFF" };
guide.getRange("A4:B9").format.borders = { preset: "outside", style: "thin", color: "#CDD5DF" };
guide.getRange("A12:A15").format.font = { bold: true, color: "#D75B36" };
guide.getRange("A1:B15").format.font.typeface = "Arial";
guide.getRange("A1:B15").format.verticalAlignment = "center";
guide.getRange("B4:B15").format.wrapText = true;
guide.getRange("A:A").format.columnWidth = 22;
guide.getRange("B:B").format.columnWidth = 74;
guide.getRange("1:2").format.rowHeight = 25;
guide.getRange("11:11").format.rowHeight = 23;
guide.tabColor = "#D75B36";

const headers = [
  "id",
  "date",
  "day",
  "track",
  "venue",
  "start_time",
  "end_time",
  "title",
  "details",
  "category",
  "status",
  "last_updated",
  "source_page",
];

const minutesToFraction = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60 + minutes) / (24 * 60);
};

const rows = schedule.map((item) => [
  item.id,
  new Date(`${item.date}T00:00:00`),
  item.day,
  item.track,
  item.venue,
  minutesToFraction(item.start_time),
  minutesToFraction(item.end_time),
  item.title,
  item.details,
  item.category,
  item.status,
  new Date(item.last_updated),
  item.source_page,
]);

dataSheet.showGridLines = false;
dataSheet.getRange("A1:M1").values = [headers];
dataSheet.getRange(`A2:M${rows.length + 1}`).values = rows;
dataSheet.getRange(`A1:M${rows.length + 1}`).format.font.typeface = "Arial";
dataSheet.getRange("A1:M1").format.fill = "#183153";
dataSheet.getRange("A1:M1").format.font = { bold: true, color: "#FFFFFF" };
dataSheet.getRange("A1:M1").format.horizontalAlignment = "center";
dataSheet.getRange("A1:M1").format.verticalAlignment = "center";
dataSheet.getRange("A1:M1").format.rowHeight = 28;
dataSheet.getRange(`A2:M${rows.length + 1}`).format.verticalAlignment = "top";
dataSheet.getRange(`H2:I${rows.length + 1}`).format.wrapText = true;
dataSheet.getRange(`B2:B${rows.length + 1}`).setNumberFormat("yyyy-mm-dd");
dataSheet.getRange(`F2:G${rows.length + 1}`).setNumberFormat("h:mm AM/PM");
dataSheet.getRange(`L2:L${rows.length + 1}`).setNumberFormat("yyyy-mm-dd h:mm");
dataSheet.getRange(`M2:M${rows.length + 1}`).setNumberFormat("0");
dataSheet.freezePanes.freezeRows(1);
dataSheet.getRange("A:A").format.columnWidth = 22;
dataSheet.getRange("B:B").format.columnWidth = 13;
dataSheet.getRange("C:C").format.columnWidth = 12;
dataSheet.getRange("D:D").format.columnWidth = 22;
dataSheet.getRange("E:E").format.columnWidth = 18;
dataSheet.getRange("F:G").format.columnWidth = 13;
dataSheet.getRange("H:H").format.columnWidth = 34;
dataSheet.getRange("I:I").format.columnWidth = 58;
dataSheet.getRange("J:K").format.columnWidth = 16;
dataSheet.getRange("L:L").format.columnWidth = 21;
dataSheet.getRange("M:M").format.columnWidth = 12;
dataSheet.getRange(`A2:M${rows.length + 1}`).format.autofitRows();
dataSheet.getRange(`J2:J500`).dataValidation = {
  rule: { type: "list", values: ["Session", "Ceremony", "Engagement", "Break", "Workshop", "Gathering"] },
};
dataSheet.getRange(`K2:K500`).dataValidation = {
  rule: { type: "list", values: ["Published", "Draft", "Cancelled"] },
};

const table = dataSheet.tables.add(`A1:M${rows.length + 1}`, true, "ScheduleTable");
table.style = "TableStyleMedium2";
table.showBandedRows = true;
table.showFilterButton = true;
dataSheet.tabColor = "#183153";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const guidePreview = await workbook.render({ sheetName: "Guide", range: "A1:B15", scale: 1.5, format: "png" });
await fs.writeFile(path.join(previewDir, "guide.png"), new Uint8Array(await guidePreview.arrayBuffer()));
const schedulePreview = await workbook.render({ sheetName: "Schedule", range: "A1:M16", scale: 1.2, format: "png" });
await fs.writeFile(path.join(previewDir, "schedule.png"), new Uint8Array(await schedulePreview.arrayBuffer()));

const inspection = await workbook.inspect({
  kind: "table",
  range: `Schedule!A1:M8`,
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 13,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(outputDir, "Profcon-2026-Schedule.xlsx");
await output.save(outputPath);
console.log(`Saved ${outputPath}`);
