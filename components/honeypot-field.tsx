"use client"

/**
 * Canonical honeypot field name — must match the key the server action's
 * schema reads (`app/actions/quotes.ts`). Deliberately NOT "website":
 * Chrome's address autofill matches that name and silently swallowed real
 * submissions from visitors with autofill profiles.
 */
export const HONEYPOT_FIELD_NAME = "hp_check"

/**
 * Visually removed, keyboard- and screen-reader-skipped decoy field shared
 * by both public forms. Real visitors never fill it; the server silently
 * discards submissions where it has a value.
 */
export function HoneypotField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor={id}>Leave this field empty</label>
      <input
        type="text"
        id={id}
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
