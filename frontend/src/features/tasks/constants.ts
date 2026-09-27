import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleEllipsis,
  Flame,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from 'lucide-react';

import type { DuePreset, LabelColor, TaskPriority, TaskStatus } from '@/types';

export interface TaskStatusMeta {
  label: string;
  icon: LucideIcon;
  /** Icon/dot color class. */
  colorClass: string;
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  BACKLOG: {
    label: 'Backlog',
    icon: CircleDashed,
    colorClass: 'text-slate-500 dark:text-slate-400',
  },
  TODO: { label: 'To do', icon: Circle, colorClass: 'text-sky-600 dark:text-sky-400' },
  IN_PROGRESS: {
    label: 'In progress',
    icon: CircleDot,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
  },
  REVIEW: {
    label: 'In review',
    icon: CircleEllipsis,
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  DONE: { label: 'Done', icon: CircleCheck, colorClass: 'text-emerald-600 dark:text-emerald-400' },
};

export interface TaskPriorityMeta {
  label: string;
  icon: LucideIcon;
  colorClass: string;
  rank: number;
}

export const TASK_PRIORITY_META: Record<TaskPriority, TaskPriorityMeta> = {
  LOW: { label: 'Low', icon: SignalLow, colorClass: 'text-muted-foreground', rank: 0 },
  MEDIUM: {
    label: 'Medium',
    icon: SignalMedium,
    colorClass: 'text-sky-600 dark:text-sky-400',
    rank: 1,
  },
  HIGH: {
    label: 'High',
    icon: SignalHigh,
    colorClass: 'text-orange-600 dark:text-orange-400',
    rank: 2,
  },
  URGENT: { label: 'Urgent', icon: Flame, colorClass: 'text-red-600 dark:text-red-400', rank: 3 },
};

export const DUE_PRESET_LABELS: Record<DuePreset, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  this_week: 'Due this week',
  next_7_days: 'Due in next 7 days',
  no_date: 'No due date',
};

export const LABEL_COLOR_CLASSES: Record<LabelColor, string> = {
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  pink: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
};

export const LABEL_DOT_CLASSES: Record<LabelColor, string> = {
  gray: 'bg-slate-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  teal: 'bg-teal-500',
  blue: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
};

/** Gap between neighbouring positions when appending/prepending in a column. */
export const POSITION_STEP = 1024;
