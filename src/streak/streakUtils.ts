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

export function computeStreaks(
  currentYearDays: number[],
  prevYearDays: number[],
  todayDoy: number,
  isLeapPrevYear: boolean
): { currentStreak: number; longestStreak: number } {
  // Map prev-year days into a unified integer space where Jan 1 of current year = 0
  const prevMaxDoy = isLeapPrevYear ? 365 : 364
  const merged = [
    ...prevYearDays.map((d) => d - prevMaxDoy - 1),
    ...currentYearDays,
  ] // sorted ascending by construction

  if (merged.length === 0) return { currentStreak: 0, longestStreak: 0 }

  const activeSet = new Set(currentYearDays)

  // Determine the anchor day for current streak (with grace: yesterday counts).
  // Also check the last mapped prev-year day to handle the Jan 1 boundary case
  // (todayDoy=0, so todayDoy-1=-1 can never be in activeSet which only holds ≥0).
  let anchor: number | null = null
  if (activeSet.has(todayDoy)) {
    anchor = todayDoy
  } else if (activeSet.has(todayDoy - 1)) {
    anchor = todayDoy - 1
  } else if (merged.length > 0 && merged[merged.length - 1] >= todayDoy - 1) {
    anchor = merged[merged.length - 1]
  }

  // Walk backwards from anchor counting consecutive days
  let currentStreak = 0
  if (anchor !== null) {
    let expected = anchor
    for (let i = merged.length - 1; i >= 0; i--) {
      if (merged[i] === expected) {
        currentStreak++
        expected--
      } else if (merged[i] < expected) {
        break
      }
    }
  }

  // Walk forwards to find the longest consecutive run
  let longestStreak = 1
  let run = 1
  for (let i = 1; i < merged.length; i++) {
    if (merged[i] === merged[i - 1] + 1) {
      run++
      if (run > longestStreak) longestStreak = run
    } else {
      run = 1
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) }
}