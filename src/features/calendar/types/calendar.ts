export type TaskPriority = 'high' | 'medium' | 'low';

export type CalendarEventType =
  | 'task'
  | 'dj_missing'
  | 'event'
  | 'maintenance'
  | 'meeting'
  | 'other';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface CalendarEvent {
  id: string;
  club_id: string;
  title: string;
  description?: string;
  event_type: CalendarEventType;
  event_date: string; // ISO date string
  start_time?: string; // HH:mm format
  end_time?: string; // HH:mm format
  all_day: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  is_completed: boolean;
  is_recurring: boolean;
  recurrence_pattern?: string;
  assigned_to?: string;
  needs_dj: boolean;
  dj_assigned: boolean;
  dj_user_id?: string;
  notes?: string;
  attachments?: any; // JSON attachments
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventWithAssignee extends CalendarEvent {
  assigned_email?: string;
  assigned_name?: string;
  dj_email?: string;
  dj_name?: string;
}

export interface CreateCalendarEventData {
  title: string;
  description?: string;
  event_date: string;
  event_type?: CalendarEventType;
  priority?: TaskPriority;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  assigned_to?: string;
  needs_dj?: boolean;
}

export interface UpdateCalendarEventData extends Partial<CreateCalendarEventData> {
  status?: TaskStatus;
  is_completed?: boolean;
  dj_assigned?: boolean;
  dj_user_id?: string;
  notes?: string;
}

export interface CalendarViewDate {
  year: number;
  month: number;
  day?: number;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export const PRIORITY_CONFIG = {
  high: {
    label: 'Alta',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  medium: {
    label: 'Media',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  low: {
    label: 'Baja',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  }
} as const;

export const EVENT_TYPE_CONFIG = {
  task: {
    label: 'Tarea',
    icon: 'CheckSquare',
    color: 'text-gray-600'
  },
  dj_missing: {
    label: 'Sin DJ',
    icon: 'Music',
    color: 'text-red-600'
  },
  event: {
    label: 'Evento',
    icon: 'Calendar',
    color: 'text-purple-600'
  },
  maintenance: {
    label: 'Mantenimiento',
    icon: 'Wrench',
    color: 'text-orange-600'
  },
  meeting: {
    label: 'Reunión',
    icon: 'Users',
    color: 'text-blue-600'
  },
  other: {
    label: 'Otro',
    icon: 'MoreHorizontal',
    color: 'text-gray-600'
  }
} as const;