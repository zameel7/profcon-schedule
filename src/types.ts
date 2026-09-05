export type ScheduleStatus = "Published" | "Draft" | "Cancelled";
export type FacultyConfirmation = "Confirmed" | "Not Confirmed" | "Pending" | "Declined";

export interface ScheduleItem {
  id: string;
  date: string;
  day: string;
  track: string;
  venue: string;
  start_time: string;
  end_time: string;
  session_code?: string;
  title: string;
  details: string;
  faculty?: string;
  duty?: string;
  faculty_confirmation?: FacultyConfirmation | string;
  media_status?: string;
  materials_url?: string;
  hints_url?: string;
  category: string;
  status: ScheduleStatus;
  last_updated: string;
  source_sheet?: string;
  source_page?: number | string;
}

export interface VenueInfo {
  id: string;
  name: string;
  program_head: string;
  incharge_name: string;
  incharge_phone: string;
  it_coordinator: string;
  it_phone: string;
  coordinator_name: string;
  coordinator_phone: string;
  sort_order: number;
  active: boolean;
}

export interface ApiResponse {
  ok: boolean;
  sessions?: ScheduleItem[];
  venues?: VenueInfo[];
  session?: ScheduleItem;
  venue?: VenueInfo;
  deletedId?: string;
  error?: string;
}
