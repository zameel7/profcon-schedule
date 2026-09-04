export type ScheduleStatus = "Published" | "Draft" | "Cancelled";

export interface ScheduleItem {
  id: string;
  date: string;
  day: string;
  track: string;
  venue: string;
  start_time: string;
  end_time: string;
  title: string;
  details: string;
  category: string;
  status: ScheduleStatus;
  last_updated: string;
  source_page?: number | string;
}

export interface ApiResponse {
  ok: boolean;
  sessions?: ScheduleItem[];
  session?: ScheduleItem;
  deletedId?: string;
  error?: string;
}
