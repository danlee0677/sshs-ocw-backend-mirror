// KST is UTC+9; the logical day boundary is 06:00 KST = 21:00 UTC (prev calendar day).
// Adding 3 h shifts 21:00 UTC → midnight, so getUTCDate() rolls over at the right moment.
const KST_BOUNDARY_OFFSET_MS = 3 * 60 * 60 * 1000

// Shifts a UTC timestamp so that 06:00 KST acts as the logical midnight
export function logicalDate(date: Date): Date {
  return new Date(date.getTime() + KST_BOUNDARY_OFFSET_MS)
}

// Returns 0-based day-of-year (0 = Jan 1, 364/365 = Dec 31). Pass logicalDate() output.
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  return Math.floor((date.getTime() - start) / 86_400_000) - 1
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}