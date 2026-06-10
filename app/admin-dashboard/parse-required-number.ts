/**
 * Parses a required numeric text field from the dashboard's inline editors.
 * `Number("") === 0`, so a cleared input would otherwise silently save 0 —
 * e.g. jumping a row to the front of the display order. Returning NaN for
 * blank input lets the server action reject it with its friendly validation
 * message instead.
 */
export function parseRequiredNumber(value: string): number {
  const trimmed = value.trim()
  return trimmed === "" ? Number.NaN : Number(trimmed)
}
