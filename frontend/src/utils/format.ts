export function displayName(email: string): string {
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Compact form for hero/headline numbers only (e.g. "1.00M", "349.65K") —
// list rows elsewhere still use the full formatMoney value.
export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return formatMoney(value);
}

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}
