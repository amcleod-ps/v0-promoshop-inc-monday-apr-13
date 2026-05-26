"use client"

import { useState, useTransition } from "react"
import {
  createBrand,
  createHeroSlide,
  createSiteImage,
} from "./create-actions"

interface CreateFormShellProps {
  title: string
  description: string
  children: React.ReactNode
  status: { kind: "idle" | "ok" | "err"; message: string }
}

function CreateFormShell({
  title,
  description,
  children,
  status,
}: CreateFormShellProps) {
  return (
    <details style={styles.shell}>
      <summary style={styles.summary}>
        <strong>+ {title}</strong>
      </summary>
      <p style={styles.shellDescription}>{description}</p>
      {children}
      {status.message ? (
        <p
          style={{
            ...styles.status,
            color:
              status.kind === "err"
                ? "#b00020"
                : status.kind === "ok"
                  ? "#0a7f3f"
                  : "#444",
          }}
        >
          {status.message}
        </p>
      ) : null}
    </details>
  )
}

// ===========================================================================
// AddBrandForm
// ===========================================================================

export function AddBrandForm() {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [categories, setCategories] = useState("")
  const [featured, setFeatured] = useState(false)
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const reset = () => {
    setName("")
    setSlug("")
    setDescription("")
    setCategories("")
    setFeatured(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createBrand({
        slug: slug.trim() || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        categories: categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        featured,
      })
      if (result.ok) {
        setStatus({ kind: "ok", message: `Created brand "${result.id}". Refresh to see it in the lists above.` })
        reset()
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <CreateFormShell
      title="Add new brand"
      description="Creates a brand row. Once it appears in the lists above you can upload its logo from the Images tab and edit its description from the Text content tab."
      status={status}
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <LabeledInput label="Brand name *" value={name} onChange={setName} disabled={isPending} placeholder="e.g. New Balance" />
        <LabeledInput
          label="Slug (lowercase, hyphens; auto-derived if empty)"
          value={slug}
          onChange={setSlug}
          disabled={isPending}
          placeholder="e.g. new-balance"
          mono
        />
        <LabeledTextarea
          label="Description"
          value={description}
          onChange={setDescription}
          disabled={isPending}
          placeholder="Short paragraph shown on the brand listing and detail page."
        />
        <LabeledInput
          label="Categories (comma-separated)"
          value={categories}
          onChange={setCategories}
          disabled={isPending}
          placeholder="e.g. Tops, Footwear, Activewear"
        />
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            disabled={isPending}
          />
          <span>Mark as featured</span>
        </label>
        <div style={styles.actions}>
          <button type="submit" disabled={isPending || !name.trim()} style={styles.button}>
            {isPending ? "Saving…" : "Create brand"}
          </button>
        </div>
      </form>
    </CreateFormShell>
  )
}

// ===========================================================================
// AddHeroSlideForm
// ===========================================================================

export function AddHeroSlideForm() {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [ctaText, setCtaText] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createHeroSlide({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      })
      if (result.ok) {
        setStatus({
          kind: "ok",
          message: "Created. Refresh to see it in the lists above, then upload its image from the Images tab.",
        })
        setTitle("")
        setSubtitle("")
        setCtaText("")
        setCtaUrl("")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <CreateFormShell
      title="Add new hero slide"
      description="Adds a new slide to the homepage slideshow. After saving, upload the slide image from the Images tab."
      status={status}
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <LabeledInput label="Slide title *" value={title} onChange={setTitle} disabled={isPending} />
        <LabeledTextarea label="Subtitle" value={subtitle} onChange={setSubtitle} disabled={isPending} />
        <LabeledInput label="CTA button text" value={ctaText} onChange={setCtaText} disabled={isPending} placeholder="e.g. Shop the collection" />
        <LabeledInput label="CTA destination URL" value={ctaUrl} onChange={setCtaUrl} disabled={isPending} placeholder="e.g. /brands/patagonia" />
        <div style={styles.actions}>
          <button type="submit" disabled={isPending || !title.trim()} style={styles.button}>
            {isPending ? "Saving…" : "Create slide"}
          </button>
        </div>
      </form>
    </CreateFormShell>
  )
}

// ===========================================================================
// AddSiteImageForm
// ===========================================================================

export function AddSiteImageForm() {
  const [key, setKey] = useState("")
  const [label, setLabel] = useState("")
  const [altText, setAltText] = useState("")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createSiteImage({
        key: key.trim(),
        label: label.trim(),
        altText: altText.trim() || undefined,
      })
      if (result.ok) {
        setStatus({
          kind: "ok",
          message: `Created slot "${result.id}". Refresh and upload its image from the list above.`,
        })
        setKey("")
        setLabel("")
        setAltText("")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <CreateFormShell
      title="Add new site image slot"
      description="Use for custom imagery referenced from new code paths. The key is what the React code looks up; the label is what an admin reads in this list."
      status={status}
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <LabeledInput
          label="Key * (lowercase, dots, hyphens)"
          value={key}
          onChange={setKey}
          disabled={isPending}
          placeholder="e.g. homepage.testimonial.acme"
          mono
        />
        <LabeledInput label="Label *" value={label} onChange={setLabel} disabled={isPending} placeholder="e.g. Homepage testimonial logo: Acme" />
        <LabeledInput label="Alt text" value={altText} onChange={setAltText} disabled={isPending} placeholder="Short description of the image for screen readers." />
        <div style={styles.actions}>
          <button type="submit" disabled={isPending || !key.trim() || !label.trim()} style={styles.button}>
            {isPending ? "Saving…" : "Create slot"}
          </button>
        </div>
      </form>
    </CreateFormShell>
  )
}

// ===========================================================================
// Shared atoms
// ===========================================================================

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  mono?: boolean
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.labelText}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{ ...styles.input, fontFamily: mono ? "monospace" : "inherit" }}
        spellCheck={!mono}
      />
    </label>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.labelText}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        style={{ ...styles.input, resize: "vertical" }}
      />
    </label>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    border: "1px dashed #999",
    borderRadius: 6,
    padding: "10px 14px",
    background: "#fcfcff",
    marginBottom: 14,
  },
  summary: { cursor: "pointer", fontSize: 14 },
  shellDescription: {
    color: "#555",
    fontSize: 13,
    margin: "10px 0",
    lineHeight: 1.5,
  },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  labelWrap: { display: "flex", flexDirection: "column", gap: 4 },
  labelText: { fontSize: 12, color: "#444", fontWeight: 600 },
  input: {
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  checkboxRow: {
    display: "flex",
    gap: 6,
    fontSize: 13,
    alignItems: "center",
  },
  actions: { display: "flex", gap: 8, marginTop: 4 },
  button: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  status: { fontSize: 13, marginTop: 8 },
}
