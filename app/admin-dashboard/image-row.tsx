"use client"

import { useEffect, useState, useTransition } from "react"
import { removeImage, replaceImage, type ReplaceTarget } from "./actions"
import { updateImageFit, updateImageSize } from "./create-actions"
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits"
import { isSafeLinkTarget } from "@/lib/url-safety"

interface ImageRowProps {
  target: ReplaceTarget
  id: string
  label: string
  currentUrl: string | null
  hint?: string | null
  /** When set, offers the cover/contain display-mode selector for this
   *  placement (only pass it for slots the renderers actually consult —
   *  hero slides, about.hero, brand lifestyle backdrops). */
  fitSlot?: string
  currentFit?: string
  /** When set, offers the Smaller/Default/Larger display-size selector for
   *  this placement (only pass it for slots whose renderer reads it — today
   *  the site logo in the header and footer). */
  sizeSlot?: string
  currentSize?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function removeConfirmMessage(target: ReplaceTarget): string {
  if (target === "product_image") {
    return "Delete this gallery image? This removes the row entirely; the file stays in Storage so it can be re-attached from the Supabase Dashboard."
  }
  return "Remove this image? The site will fall back to its default. You can upload a new image any time."
}

export function ImageRow({ target, id, label, currentUrl, hint, fitSlot, currentFit, sizeSlot, currentSize }: ImageRowProps) {
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    kind: "idle" | "success" | "error"
    message: string
  }>({ kind: "idle", message: "" })
  const [isPending, startTransition] = useTransition()
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const [hiddenAfterDelete, setHiddenAfterDelete] = useState(false)

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
    // Pre-check the 10 MB cap client-side: a larger body is rejected by the
    // Server Action transport itself, so our friendly server-side size
    // message would never get a chance to run.
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus({
        kind: "error",
        message: `File is too large (${formatBytes(file.size)}). Maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      })
      return
    }
    setStatus({ kind: "idle", message: "Uploading…" })

    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      // try/catch so a network failure or thrown server error shows a
      // message and re-enables the buttons instead of leaving them stuck.
      try {
        const result = await replaceImage(target, id, formData)
        if (result.ok) {
          setStatus({ kind: "success", message: "Saved. Live on the site." })
          setPreviewUrl(result.url)
          setFile(null)
        } else {
          setStatus({ kind: "error", message: result.error })
        }
      } catch {
        setStatus({
          kind: "error",
          message: "Upload failed. Check your connection and try again.",
        })
      }
    })
  }

  const handleRemove = () => {
    if (typeof window !== "undefined" && !window.confirm(removeConfirmMessage(target))) {
      return
    }
    setStatus({ kind: "idle", message: "Removing…" })
    startTransition(async () => {
      try {
        const result = await removeImage(target, id)
        if (result.ok) {
          setPreviewUrl(null)
          setFile(null)
          if (target === "product_image") {
            // Row no longer exists in the database; collapse it out of the UI
            // so the admin doesn't think the delete failed.
            setHiddenAfterDelete(true)
            return
          }
          setStatus({ kind: "success", message: "Removed. Default will show on the site." })
        } else {
          setStatus({ kind: "error", message: result.error })
        }
      } catch {
        setStatus({
          kind: "error",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  if (hiddenAfterDelete) {
    return (
      <div style={{ ...styles.row, opacity: 0.55 }}>
        <div style={styles.body}>
          <div style={styles.label}>{label}</div>
          <div style={{ ...styles.meta, color: "#0a7f3f" }}>
            Deleted. Refresh the dashboard to confirm it&apos;s gone from the list.
          </div>
        </div>
      </div>
    )
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
            aria-label={`Replace image for ${label}`}
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
          {previewUrl ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              style={styles.removeButton}
              title="Remove this image"
            >
              Remove
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
        </form>

        {fitSlot ? <ImageFitControl slot={fitSlot} initial={currentFit} /> : null}
        {sizeSlot ? <ImageSizeControl slot={sizeSlot} initial={currentSize} /> : null}

        {previewUrl && isSafeLinkTarget(previewUrl) ? (
          // Guard the href: site_images.url can be set via the Supabase Table
          // Editor (bypassing upload validation), so a stored `javascript:` /
          // `data:text/html` value would otherwise be a clickable link right
          // here in the dashboard. Only render the link for http(s)/relative
          // targets; the <img> preview above is inert for those schemes anyway.
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Open this image in a new tab
          </a>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Cover/contain selector for placements that render inside a fixed frame.
 * Saves on change (a select pick is a deliberate action, like the Featured
 * toggle) and reverts the optimistic value if the server rejects it.
 */
function ImageFitControl({ slot, initial }: { slot: string; initial?: string }) {
  const [fit, setFit] = useState(initial === "contain" ? "contain" : "cover")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    const previous = fit
    setFit(next)
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      try {
        const result = await updateImageFit(slot, next)
        if (result.ok) {
          setStatus({ kind: "ok", message: "Saved. Live on the site." })
        } else {
          setFit(previous)
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setFit(previous)
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  return (
    <div style={styles.fitRow}>
      <label style={styles.fitLabel}>
        Image display
        <select
          value={fit}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          style={styles.fitSelect}
        >
          <option value="cover">Fill the frame (crops to fit)</option>
          <option value="contain">Show the whole image (no cropping)</option>
        </select>
      </label>
      {status.message ? (
        <span
          style={{
            ...styles.status,
            color:
              status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Smaller/Default/Larger size selector for free-standing images (the logo).
 * Saves on change and reverts the optimistic value if the server rejects it,
 * mirroring ImageFitControl above.
 */
function ImageSizeControl({ slot, initial }: { slot: string; initial?: string }) {
  const [size, setSize] = useState(initial === "sm" || initial === "lg" ? initial : "md")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    const previous = size
    setSize(next)
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      try {
        const result = await updateImageSize(slot, next)
        if (result.ok) {
          setStatus({ kind: "ok", message: "Saved. Live on the site." })
        } else {
          setSize(previous)
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setSize(previous)
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  return (
    <div style={styles.fitRow}>
      <label style={styles.fitLabel}>
        Display size
        <select
          value={size}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          style={styles.fitSelect}
        >
          <option value="sm">Smaller</option>
          <option value="md">Default size</option>
          <option value="lg">Larger</option>
        </select>
      </label>
      {status.message ? (
        <span
          style={{
            ...styles.status,
            color:
              status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    // Wrap on narrow screens: with the fixed preview column(s) the controls
    // used to overflow the card and overlap on phones.
    flexWrap: "wrap",
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
  // minWidth 220 (not 0) so the controls wrap below the thumbnails on
  // phones instead of being squeezed into an unusable sliver next to them.
  body: { flex: "1 1 220px", minWidth: 0 },
  label: { fontWeight: 700, marginBottom: 2, fontSize: 15 },
  meta: { fontSize: 12, color: "#666", marginBottom: 8 },
  id: {
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "1px 6px",
    borderRadius: 3,
    // UUID-bearing keys have no break points — without this they widen the
    // card past phone viewports.
    overflowWrap: "anywhere",
  },
  hint: { color: "#888" },
  form: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
  },
  fileInput: { fontSize: 13, maxWidth: "100%" },
  fileMeta: { fontSize: 12, color: "#444" },
  fitRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
  },
  fitLabel: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#444",
    maxWidth: "100%",
  },
  fitSelect: {
    padding: "5px 8px",
    fontSize: 13,
    border: "1px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    fontWeight: 400,
    // Long option labels must clip, not push the card wider than a phone.
    flex: "1 1 auto",
    minWidth: 0,
    maxWidth: "100%",
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
  removeButton: {
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    background: "#fff",
    color: "#b00020",
    border: "1px solid #b00020",
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
