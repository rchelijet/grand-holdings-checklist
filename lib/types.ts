export type UserRole = "admin" | "manager" | "basic";
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type TaskStatus = "pending" | "closed";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  facility_id: number | null;
  access_all: number;
  active: number;
  created_at: string;
}

export interface Facility {
  id: number;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  created_at: string;
}

export interface Checklist {
  id: number;
  name: string;
  frequency: Frequency;
  created_at: string;
}

export interface ChecklistItem {
  id: number;
  checklist_id: number;
  description: string;
  sort_order: number;
}

export interface ChecklistCompletion {
  id: number;
  checklist_id: number;
  facility_id: number;
  user_id: number;
  due_date: string;
  submitted_at: string | null;
  status: "pending" | "completed";
}

export interface ChecklistCompletionItem {
  id: number;
  completion_id: number;
  item_id: number;
  completed: number;
  note: string | null;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  facilityId: number | null;
  facilityIds: number[];
  accessAll: boolean;
}

export interface Task {
  id: number;
  facility_id: number;
  title: string;
  description: string;
  expected_date: string;
  created_at: string;
  created_by: number;
  assigned_user_id: number | null;
  progress: number;
  status: TaskStatus;
  closed_at: string | null;
  facility_name?: string;
  created_by_name?: string;
  assigned_user_name?: string | null;
}
