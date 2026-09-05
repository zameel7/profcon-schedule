import fallbackSchedule from "./data/schedule.json";
import fallbackVenues from "./data/venues.json";
import type { ApiResponse, ScheduleItem, VenueInfo } from "./types";

// Production uses a same-origin Cloudflare Pages Function. The Apps Script URL
// stays in Cloudflare's environment rather than being embedded in this bundle.
export const apiUrl = import.meta.env.DEV ? "" : "/api/schedule";
const DEMO_STORAGE_KEY = "profcon-2026-demo-schedule";
const VENUE_STORAGE_KEY = "profcon-2026-demo-venues";

const sortSessions = (sessions: ScheduleItem[]) =>
  [...sessions].sort((a, b) =>
    `${a.date}T${a.start_time}-${a.venue}-${a.title}`.localeCompare(
      `${b.date}T${b.start_time}-${b.venue}-${b.title}`,
    ),
  );

export function getDemoSchedule(): ScheduleItem[] {
  const saved = localStorage.getItem(DEMO_STORAGE_KEY);
  if (saved) {
    try {
      return sortSessions(JSON.parse(saved) as ScheduleItem[]);
    } catch {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  }
  return sortSessions(fallbackSchedule as ScheduleItem[]);
}

export function saveDemoSchedule(sessions: ScheduleItem[]) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(sortSessions(sessions)));
}

export function getDemoVenues(): VenueInfo[] {
  const saved = localStorage.getItem(VENUE_STORAGE_KEY);
  if (saved) {
    try {
      return (JSON.parse(saved) as VenueInfo[]).sort((a, b) => a.sort_order - b.sort_order);
    } catch {
      localStorage.removeItem(VENUE_STORAGE_KEY);
    }
  }
  return [...(fallbackVenues as VenueInfo[])];
}

export function saveDemoVenues(venues: VenueInfo[]) {
  localStorage.setItem(VENUE_STORAGE_KEY, JSON.stringify([...venues].sort((a, b) => a.sort_order - b.sort_order)));
}

export async function fetchPublicSchedule(): Promise<{ sessions: ScheduleItem[]; venues: VenueInfo[]; source: "sheet" | "tracker" | "demo" }> {
  if (!apiUrl) return { sessions: getDemoSchedule().filter((item) => item.status === "Published"), venues: getDemoVenues(), source: "demo" };

  try {
    const response = await fetch(`${apiUrl}?action=schedule`, { redirect: "follow" });
    if (!response.ok) throw new Error(`Schedule API returned ${response.status}`);
    const data = (await response.json()) as ApiResponse;
    if (!data.ok || !data.sessions) throw new Error(data.error || "Schedule API returned no data");
    const hasTrackerSchema = data.sessions.length === 0 || data.sessions.some((item) => "faculty_confirmation" in item || "session_code" in item);
    return {
      sessions: hasTrackerSchema ? sortSessions(data.sessions) : getDemoSchedule().filter((item) => item.status === "Published"),
      venues: (data.venues?.length ? data.venues : getDemoVenues()).filter((venue) => venue.active !== false).sort((a, b) => a.sort_order - b.sort_order),
      source: hasTrackerSchema ? "sheet" : "tracker",
    };
  } catch (error) {
    console.warn("Using bundled schedule because the live API is unavailable.", error);
    return { sessions: getDemoSchedule().filter((item) => item.status === "Published"), venues: getDemoVenues(), source: "demo" };
  }
}

export async function adminRequest(body: Record<string, unknown>): Promise<ApiResponse> {
  if (!apiUrl) throw new Error("The Google Sheets API URL is not configured.");
  const response = await fetch(apiUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiResponse;
  if (!response.ok || !data.ok) throw new Error(data.error || `API request failed (${response.status})`);
  return data;
}
