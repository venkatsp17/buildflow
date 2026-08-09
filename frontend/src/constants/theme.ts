import type { OrderSort } from '@/api/client';

export const colors = {
  navy: '#101B33',
  navyMuted: '#8894AC',
  amber: '#F5B93F',
  amberMuted: '#FDF3DC',
  background: '#F4F5F7',
  card: '#FFFFFF',
  border: '#E3E6EB',
  text: '#101B33',
  textMuted: '#64748B',
  error: '#C0392B',

  red: '#E5484D',
  redMuted: '#FDECEC',
  orange: '#F2994A',
  orangeMuted: '#FDF1E5',
  blue: '#2F80ED',
  blueMuted: '#E9F1FD',
  green: '#27AE60',
  greenMuted: '#E8F8EF',
  gray: '#8894AC',
  grayMuted: '#EEF0F3',
};

export const statusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.orangeMuted, fg: colors.orange, label: 'Pending' },
  approved: { bg: colors.blueMuted, fg: colors.blue, label: 'Approved' },
  rejected: { bg: colors.redMuted, fg: colors.red, label: 'Rejected' },
  in_progress: { bg: colors.blueMuted, fg: colors.blue, label: 'In Progress' },
  dispatched: { bg: colors.amberMuted, fg: '#B8860B', label: 'Dispatch' },
  delayed: { bg: colors.redMuted, fg: colors.red, label: 'Delayed' },
  delivered: { bg: colors.greenMuted, fg: colors.green, label: 'Delivered' },
  cancelled: { bg: colors.grayMuted, fg: colors.gray, label: 'Cancelled' },
};

// Pending, Approved, and Rejected are the top-level "super states". Approved
// is really a family — every order that's cleared the approval gate — with
// its own sub-states selectable via approvedSubStatusFilters below. The
// backend's ?status=approved expands to the whole family; the sub-states
// are literal/derived values within it.
export const superStatusFilters: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export const approvedSubStatusFilters: { key: string; label: string }[] = [
  { key: 'in_progress', label: 'In Progress' },
  { key: 'dispatched', label: 'Dispatch' },
  { key: 'delayed', label: 'Delayed' },
  { key: 'delivered', label: 'Delivered' },
];

export const sortOptions: { key: OrderSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'due_asc', label: 'Due Soonest' },
  { key: 'due_desc', label: 'Due Latest' },
  { key: 'value_desc', label: 'Highest Value' },
  { key: 'value_asc', label: 'Lowest Value' },
];

export const urgencyStyle: Record<string, { bg: string; fg: string; label: string }> = {
  urgent: { bg: colors.redMuted, fg: colors.red, label: 'Urgent' },
  high: { bg: colors.orangeMuted, fg: colors.orange, label: 'High' },
  medium: { bg: colors.amberMuted, fg: '#B8860B', label: 'Medium' },
  low: { bg: colors.grayMuted, fg: colors.gray, label: 'Low' },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};
