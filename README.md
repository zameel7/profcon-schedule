# PROFCON 2026 live schedule

Public schedule and admin editor for the 30th PROFCON 2026. The website reads published sessions from a Google Sheet through a small Google Apps Script API. Admins can add, edit, publish, draft, cancel, or delete sessions without opening the sheet.

## What is included

- `outputs/2026-09-04-profcon-schedule/Profcon-2026-Schedule.xlsx` — verified, Google Sheets-ready workbook with all 85 entries from the PDF.
- `src/data/schedule.json` — bundled fallback data for preview and development.
- `apps-script/Code.gs` — Google Apps Script API for public reads and authenticated admin changes.
- `/` — responsive public schedule with day, venue, and search filters.
- `/admin` — schedule dashboard and editor.

## Connect the Google Sheet

1. Import `Profcon-2026-Schedule.xlsx` into Google Drive as a native Google Sheet. Keep the `Schedule` sheet name and its first-row headers unchanged.
2. In the sheet, open **Extensions → Apps Script**. Replace the editor contents with `apps-script/Code.gs`, then save.
3. Run `setupScheduleSheet` once and approve the requested spreadsheet permission.
4. Reload the Google Sheet. Use **PROFCON Website → Set admin key** and enter a unique password of at least 12 characters.
5. In Apps Script, select **Deploy → New deployment → Web app**. Set **Execute as** to yourself and **Who has access** to anyone, then deploy.
6. Copy the `/exec` URL and store it in Cloudflare Pages as the `SCHEDULE_API_URL` environment secret.

The Cloudflare Pages Function at `/api/schedule` reads `SCHEDULE_API_URL` from the Pages environment and proxies requests to Apps Script. The Apps Script URL is not embedded in the browser bundle. The public endpoint only returns rows whose `status` is `Published`. Admin POST requests require the key stored in Apps Script properties. The key is requested in the browser and kept in session storage; it is not built into the site.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL for the public schedule, and `/admin` for the editor. The Vite development server uses the bundled PDF data. Preview admin changes are stored only in that browser.

## Build for hosting

```bash
pnpm build
```

Deploy the generated `dist` directory and the root `functions` directory to Cloudflare Pages. Configure `SCHEDULE_API_URL` as a Pages environment secret:

```bash
wrangler pages secret put SCHEDULE_API_URL --project-name profcon-schedule
wrangler pages deploy dist --project-name profcon-schedule --branch main
```

## Refresh the extracted data

The extraction script uses the original PDF and includes corrections for sessions split across PDF pages.

```bash
python3 scripts/extract_schedule.py
```
