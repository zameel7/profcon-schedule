import fallbackSchedule from "./data/schedule.json";
import type { ApiResponse, ScheduleItem } from "./types";

export const apiUrl = (import.meta.env.VITE_SCHEDULE_API_URL as string | undefined)?.trim() || "";
const DEMO_STORAGE_KEY = "profcon-2026-demo-schedule";

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

export async function fetchPublicSchedule(): Promise<{ sessions: ScheduleItem[]; source: "sheet" | "demo" }> {
  if (!apiUrl) return { sessions: getDemoSchedule().filter((item) => item.status === "Published"), source: "demo" };

  try {
    const response = await fetch(`${apiUrl}?action=schedule`, { redirect: "follow" });
    if (!response.ok) throw new Error(`Schedule API returned ${response.status}`);
    const data = (await response.json()) as ApiResponse;
    if (!data.ok || !data.sessions) throw new Error(data.error || "Schedule API returned no data");
    return { sessions: sortSessions(data.sessions), source: "sheet" };
  } catch (error) {
    console.warn("Using bundled schedule because the live API is unavailable.", error);
    return { sessions: getDemoSchedule().filter((item) => item.status === "Published"), source: "demo" };
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
