"use client"

import { useState, useTransition } from "react"
import {
  updateBrandText,
  updateHeroSlideText,
  updateSiteContent,
  type BrandField,
  type HeroSlideField,
} from "./actions"

interface BaseProps {
  label: string
  hint?: string | null
  currentValue: string
  multiline?: boolean
}

interface SiteContentProps extends BaseProps {
  source: "site_content"
  contentKey: string
  contentLabel: string
}

interface HeroSlideProps extends BaseProps {
  source: "hero_slide"
  slideId: string
  field: HeroSlideField
}

interface BrandProps extends BaseProps {
  source: "brand"
  brandSlug: string
  field: BrandField
}

export type TextRowProps = SiteContentProps | HeroSlideProps | BrandProps

export function TextRow(props: TextRowProps) {
  const [value, setValue] = useState(props.currentValue)
  const [savedValue, setSavedValue] = useState(props.currentValue)
  const [status, setStatus] = useState<{
    kind: "idle" | "success" | "error"
    message: string
  }>({ kind: "idle", message: "" })
  const [isPending, startTransition] = useTransition()

  const dirty = value !== savedValue

  const handleSave = () => {
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      let result
      if (props.source === "site_content") {
        result = await updateSiteContent(props.contentKey, props.contentLabel, value)
      } else if (props.source === "hero_slide") {
        result = await updateHeroSlideText(props.slideId, props.field, value)
      } else {
        result = await updateBrandText(props.brandSlug, props.field, value)
      }

      if (result.ok) {
        setStatus({ kind: "success", message: "Saved. Live on the site." })
        setSavedValue(value)
      } else {
        setStatus({ kind: "error", message: result.error })
      }
    })
  }

  const handleRevert = () => {
    setValue(savedValue)
    setStatus({ kind: "idle", message: "" })
  }

  const idHint =
    props.source === "site_content"
      ? props.contentKey
      : props.source === "hero_slide"
        ? `hero_slide:${props.slideId}:${props.field}`
        : `brand:${props.brandSlug}:${props.field}`

  return (
    <div style={styles.row}>
      <div style={styles.label}>{props.label}</div>
      <div style={styles.meta}>
        <code style={styles.id}>{idHint}</code>
        {props.hint ? <span style={styles.hint}> · {props.hint}</span> : null}
      </div>

      {props.multiline ? (
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (status.message) setStatus({ kind: "idle", message: "" })
          }}
          disabled={isPending}
          rows={Math.min(8, Math.max(3, value.split("\n").length + 1))}
          style={styles.textarea}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (status.message) setStatus({ kind: "idle", message: "" })
          }}
          disabled={isPending}
          style={styles.input}
        />
      )}

      <div style={styles.actions}>
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
            onClick={handleRevert}
            disabled={isPending}
            style={styles.cancelButton}
          >
            Revert
          </button>
        ) : null}
        {status.message ? (
          <span
            style={{
              ...styles.status,
              color:
                status.kind === "error"
                  ? "#b00020"
                  : status.kind === "success"
                    ? "#0a7f3f"
                    : "#444",
            }}
          >
            {status.message}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
  },
  label: { fontWeight: 700, fontSize: 15 },
  meta: { fontSize: 12, color: "#666" },
  id: {
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "1px 6px",
    borderRadius: 3,
  },
  hint: { color: "#888" },
  input: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
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
  cancelButton: {
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
