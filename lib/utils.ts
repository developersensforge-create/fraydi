/**
 * Utility helpers for Fraydi
 */

/**
 * Merge class names (lightweight cn without clsx/tailwind-merge dependency)
 * Replace with `clsx` + `tailwind-merge` for full conflict resolution.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format a Date to a human-readable time string (e.g. "9:30 AM")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Format a Date to a short date string (e.g. "Mon, Apr 7")
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
