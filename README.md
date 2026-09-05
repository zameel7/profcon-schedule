# PROFCON 2026 live schedule

Public schedule and admin editor for the 30th PROFCON 2026. The website reads published sessions and venue contacts from a Google Sheet through a small Google Apps Script API. Admins can manage sessions, faculty confirmation, Drive links, and venue contacts without opening the sheet.

## What is included

- `src/data/schedule.json` — 68 sessions normalized from the program team's `PROFCON_30_Master_Tracker.xlsx`.
- `src/data/venues.json` — venue heads, in-charges, IT coordinators, and IDAM coordinator details.
- `apps-script/Code.gs` — Google Apps Script API for public reads and authenticated admin changes.
- `/` — venue-first public schedule, contact cards, call buttons, confirmation status, and clickable session details.
- `/admin` — session and venue-contact editor, including presentation/video/material and hints links.

## Connect the Google Sheet

1. In the existing Google Sheet, open **Extensions → Apps Script**. Replace the editor contents with `apps-script/Code.gs`, then save.
2. Open **Project settings → Script properties** and add `ADMIN_KEY` with a unique password of at least 12 characters. The sheet menu can also set this value.
3. Run `setupWebsiteSheets` once and approve the requested spreadsheet permission. It adds the new schedule fields and creates the `Venues` tab without whole-column actions.
4. Update the existing web-app deployment to a new version. Keep **Execute as** set to yourself and **Who has access** set to anyone.
5. Open `/admin`, sign in with `ADMIN_KEY`, and choose **Load latest tracker** once to replace the old live rows with the 68 sessions in the new master tracker.
6. Open **Venue contacts** in the admin to add phone numbers. A public **Call** button appears only when a number is present.

The Cloudflare Pages Function at `/api/schedule` reads `SCHEDULE_API_URL` from the Pages environment and proxies requests to Apps Script. The Apps Script URL is not embedded in the browser bundle. The public endpoint only returns rows whose `status` is `Published`. Admin POST requests require the key stored in Apps Script properties. The key is requested in the browser and kept in session storage; it is not built into the site.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL for the public schedule, and `/admin` for the editor. The Vite development server uses the bundled master-tracker data. Preview admin changes are stored only in that browser.

## Build for hosting

```bash
pnpm build
```

Deploy the generated `dist` directory and the root `functions` directory to Cloudflare Pages. Configure `SCHEDULE_API_URL` as a Pages environment secret:

```bash
wrangler pages secret put SCHEDULE_API_URL --project-name profcon-schedule
wrangler pages deploy dist --project-name profcon-schedule --branch main
```

The older PDF extraction and Google Sheets-ready workbook remain in `outputs/` for reference; the program team's master tracker is now the website's current schedule source.
