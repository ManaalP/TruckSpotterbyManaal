// Centralized US Timezone Utilities

export type USTimeZone = 'America/New_York' | 'America/Chicago' | 'America/Denver' | 'America/Los_Angeles' | 'UTC'

export const US_TIMEZONES: { id: USTimeZone; label: string; short: string }[] = [
  { id: 'America/Chicago', label: 'Central (CT)', short: 'CT' },
  { id: 'America/New_York', label: 'Eastern (ET)', short: 'ET' },
  { id: 'America/Denver', label: 'Mountain (MT)', short: 'MT' },
  { id: 'America/Los_Angeles', label: 'Pacific (PT)', short: 'PT' },
  { id: 'UTC', label: 'UTC', short: 'UTC' },
]

/**
 * Format a Date or ISO string into a specified US timezone.
 * Example output: "Fri, Nov 20, 04:00 PM CST"
 */
export function formatInTimeZone(
  dateInput: string | Date,
  timeZone: USTimeZone = 'America/Chicago',
  options?: { showDate?: boolean; showSeconds?: boolean }
): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: options?.showDate ? 'short' : undefined,
      month: options?.showDate ? 'short' : undefined,
      day: options?.showDate ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
    return formatter.format(d)
  } catch (_) {
    return String(dateInput)
  }
}

/**
 * Format date for datetime-local input string in a given timezone.
 * Returns "YYYY-MM-DDTHH:mm" matching the specified timezone's wall clock.
 */
export function getLocalInputStringForTimeZone(dateInput: Date, timeZone: USTimeZone): string {
  try {
    // Format parts in target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(dateInput)
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '00'
    const year = getVal('year')
    const month = getVal('month')
    const day = getVal('day')
    let hour = getVal('hour')
    if (hour === '24') hour = '00'
    const minute = getVal('minute')
    return `${year}-${month}-${day}T${hour}:${minute}`
  } catch (_) {
    return dateInput.toISOString().slice(0, 16)
  }
}

/**
 * Parse a datetime-local input value string ("YYYY-MM-DDTHH:mm") considered in `timeZone`,
 * and convert to an exact UTC ISO string for backend APIs.
 */
export function parseLocalInputToUTCISO(inputStr: string, timeZone: USTimeZone): string {
  if (!inputStr) return new Date().toISOString()
  try {
    // Determine the offset of the target timezone on that date
    const [datePart, timePart] = inputStr.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [hh, mm] = timePart.split(':').map(Number)

    // Create a UTC date guess
    const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm))

    // Formatter to inspect wall clock difference in target timezone
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })

    const parts = tzFormatter.formatToParts(utcGuess)
    const getPart = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0)
    const tzY = getPart('year')
    const tzM = getPart('month')
    const tzD = getPart('day')
    let tzH = getPart('hour')
    if (tzH === 24) tzH = 0
    const tzMin = getPart('minute')

    const tzDateAsUTC = new Date(Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin))
    const offsetMs = tzDateAsUTC.getTime() - utcGuess.getTime()

    // Adjusted UTC timestamp
    const trueUTC = new Date(utcGuess.getTime() - offsetMs)
    return trueUTC.toISOString()
  } catch (_) {
    return new Date(inputStr).toISOString()
  }
}
