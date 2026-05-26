"use client"

import { useState, useTransition } from "react"
import { updateThemeColor } from "./create-actions"

export interface ThemeEntry {
  key: string
  label: string
  value: string
}

export function ThemeTab({ entries }: { entries: ThemeEntry[] }) {
  return (
    <div>
      <p style={styles.intro}>
        Pick a new colour and click <strong>Save</strong>. The new value
        replaces the original hex everywhere it appears on the site — every
        button, accent stripe, eyebrow, and hover state for that colour
        switches at the next page load.
      </p>
      <div style={styles.grid}>
        {entries.map((entry) => (
          <ThemeRow key={entry.key} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function ThemeRow({ entry }: { entry: ThemeEntry }) {
  const [value, setValue] = useState(entry.value)
  const [savedValue, setSavedValue] = useState(entry.value)
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const dirty = value.toLowerCase() !== savedValue.toLowerCase()

  const handleSave = () => {
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      const result = await updateThemeColor(entry.key, value)
      if (result.ok) {
        setStatus({ kind: "ok", message: "Saved. Refresh the public site to see the change." })
        setSavedValue(value)
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <div style={styles.row}>
      <div
        style={{
          ...styles.swatch,
          background: value,
        }}
        aria-hidden
      />
      <div style={styles.body}>
        <div style={styles.label}>{entry.label}</div>
        <div style={styles.meta}>
          <code style={styles.id}>{entry.key}</code>
        </div>
        <div style={styles.controls}>
          <input
            type="color"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (status.message) setStatus({ kind: "idle", message: "" })
            }}
            disabled={isPending}
            style={styles.colorInput}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (status.message) setStatus({ kind: "idle", message: "" })
            }}
            disabled={isPending}
            style={styles.textInput}
            spellCheck={false}
            maxLength={9}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || isPending}
            style={styles.button}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                setValue(savedValue)
                setStatus({ kind: "idle", message: "" })
              }}
              disabled={isPending}
              style={styles.cancel}
            >
              Revert
            </button>
          ) : null}
          {status.message ? (
            <span
              style={{
                ...styles.status,
                color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
              }}
            >
              {status.message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  intro: {
    color: "#555",
    fontSize: 14,
    lineHeight: 1.55,
    marginBottom: 16,
  },
  grid: { display: "flex", flexDirection: "column", gap: 10 },
  row: {
    display: "flex",
    gap: 16,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    alignItems: "flex-start",
  },
  swatch: {
    width: 80,
    height: 80,
    border: "1px solid #ddd",
    borderRadius: 6,
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  label: { fontWeight: 700, fontSize: 15 },
  meta: { fontSize: 12, color: "#666", marginBottom: 8 },
  id: {
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "1px 6px",
    borderRadius: 3,
  },
  controls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  colorInput: {
    width: 48,
    height: 36,
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: 2,
    cursor: "pointer",
  },
  textInput: {
    width: 110,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "monospace",
    border: "1px solid #ccc",
    borderRadius: 4,
  },
  button: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  cancel: {
    padding: "6px 10px",
    fontSize: 12,
    background: "transparent",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
  },
  status: { fontSize: 13 },
}
