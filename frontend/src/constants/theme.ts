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
  in_progress: { bg: colors.blueMuted, fg: colors.blue, label: 'In Progress' },
  completed: { bg: colors.greenMuted, fg: colors.green, label: 'Completed' },
  cancelled: { bg: colors.grayMuted, fg: colors.gray, label: 'Cancelled' },
};

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
