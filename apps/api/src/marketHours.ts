/** NSE cash-market session in Asia/Kolkata. Status only — never used to invent prices. */
export function nseMarketStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  const mins = hour * 60 + minute;
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  const open = mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
  const pre = mins >= 9 * 60 && mins < 9 * 60 + 15;
  const status = weekend || (!open && !pre) ? 'CLOSED' as const : pre ? 'PRE_OPEN' as const : 'OPEN' as const;
  return {status, weekend, timezone: 'Asia/Kolkata'};
}
