"use client"

import { useEffect, useState, useTransition } from "react"
import { replaceImage, type ReplaceTarget } from "./actions"

interface ImageRowProps {
  target: ReplaceTarget
  id: string
  label: string
  currentUrl: string | null
  hint?: string | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function ImageRow({ target, id, label, currentUrl, hint }: ImageRowProps) {
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    kind: "idle" | "success" | "error"
    message: string
  }>({ kind: "idle", message: "" })
  const [isPending, startTransition] = useTransition()
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)

  // Create / revoke an object URL so the user sees what they picked
  // before clicking Replace.
  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    setStatus({ kind: "idle", message: "" })
  }

  const clearFile = () => {
    setFile(null)
    setStatus({ kind: "idle", message: "" })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setStatus({ kind: "idle", message: "Uploading…" })

    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      const result = await replaceImage(target, id, formData)
      if (result.ok) {
        setStatus({ kind: "success", message: "Saved. Live on the site." })
        setPreviewUrl(result.url)
        setFile(null)
      } else {
        setStatus({ kind: "error", message: result.error })
      }
    })
  }

  return (
    <div style={styles.row}>
      <div style={styles.previewColumn}>
        <div style={styles.previewLabel}>Current</div>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            loading="lazy"
            style={styles.thumbnail}
          />
        ) : (
          <div style={styles.thumbnailEmpty}>No image set</div>
        )}
      </div>

      {file ? (
        <div style={styles.previewColumn}>
          <div style={{ ...styles.previewLabel, color: "#0066cc" }}>New (preview)</div>
          {filePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={filePreview}
              alt="Preview of new upload"
              style={{ ...styles.thumbnail, borderColor: "#0066cc" }}
            />
          ) : (
            <div style={styles.thumbnailEmpty}>…</div>
          )}
        </div>
      ) : null}

      <div style={styles.body}>
        <div style={styles.label}>{label}</div>
        <div style={styles.meta}>
          <code style={styles.id}>{id}</code>
          {hint ? <span style={styles.hint}> · {hint}</span> : null}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="file"
            accept="image/*"
            disabled={isPending}
            onChange={handleFile}
            style={styles.fileInput}
          />
          {file ? (
            <>
              <span style={styles.fileMeta}>
                {file.name} · {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={clearFile}
                disabled={isPending}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </>
          ) : null}
          <button
            type="submit"
            disabled={!file || isPending}
            style={styles.button}
          >
            {isPending ? "Saving…" : "Replace"}
          </button>
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
        </form>

        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            Open this image in a new tab
          </a>
        ) : null}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    gap: 16,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    alignItems: "flex-start",
  },
  previewColumn: { flex: "0 0 140px" },
  previewLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#777",
    marginBottom: 4,
  },
  thumbnail: {
    width: 140,
    height: 100,
    objectFit: "contain",
    background: "#f3f3f3",
    border: "1px solid #eee",
    borderRadius: 4,
  },
  thumbnailEmpty: {
    width: 140,
    height: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fafafa",
    color: "#999",
    border: "1px dashed #ddd",
    borderRadius: 4,
    fontSize: 12,
  },
  body: { flex: 1, minWidth: 0 },
  label: { fontWeight: 700, marginBottom: 2, fontSize: 15 },
  meta: { fontSize: 12, color: "#666", marginBottom: 8 },
  id: {
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "1px 6px",
    borderRadius: 3,
  },
  hint: { color: "#888" },
  form: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
  },
  fileInput: { fontSize: 13 },
  fileMeta: { fontSize: 12, color: "#444" },
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
  link: { fontSize: 12, color: "#0066cc", textDecoration: "underline" },
}
