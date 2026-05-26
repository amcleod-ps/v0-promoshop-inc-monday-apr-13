"use client"

import { useEffect, useState, useTransition } from "react"
import {
  createTeamMember,
  replaceTeamMemberImage,
  softDeleteTeamMember,
  updateTeamMemberText,
  type TeamMemberField,
} from "./create-actions"

export interface TeamMemberRow {
  slug: string
  name: string
  role: string
  description: string | null
  image_url: string | null
}

export function TeamTab({ members }: { members: TeamMemberRow[] }) {
  return (
    <div>
      <AddTeamMemberForm />
      {members.length === 0 ? (
        <p style={styles.empty}>
          No team members yet. Use the form above to add one. (If you applied
          migration 0005 you should already see four seeded members; check
          that the migration ran in the Supabase SQL Editor.)
        </p>
      ) : null}
      <div style={styles.list}>
        {members.map((m) => (
          <TeamMemberCard key={m.slug} member={m} />
        ))}
      </div>
    </div>
  )
}

function AddTeamMemberForm() {
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createTeamMember({
        name: name.trim(),
        role: role.trim(),
        description: description.trim() || undefined,
      })
      if (result.ok) {
        setStatus({ kind: "ok", message: `Created. Refresh to see "${name.trim()}" in the list below.` })
        setName("")
        setRole("")
        setDescription("")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <details style={styles.addShell}>
      <summary style={styles.addSummary}>
        <strong>+ Add new team member</strong>
      </summary>
      <form onSubmit={handleSubmit} style={styles.addForm}>
        <Field label="Name *">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            style={styles.input}
            placeholder="e.g. Sarah Johnson"
          />
        </Field>
        <Field label="Role *">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isPending}
            style={styles.input}
            placeholder="e.g. Account Manager"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={2}
            style={{ ...styles.input, resize: "vertical" }}
            placeholder="One-liner shown under the role on the About page."
          />
        </Field>
        <div style={styles.actionsRow}>
          <button type="submit" disabled={isPending || !name.trim() || !role.trim()} style={styles.button}>
            {isPending ? "Saving…" : "Create"}
          </button>
          {status.message ? (
            <span
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
            </span>
          ) : null}
        </div>
      </form>
    </details>
  )
}

function TeamMemberCard({ member }: { member: TeamMemberRow }) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [description, setDescription] = useState(member.description ?? "")
  const [savedName, setSavedName] = useState(member.name)
  const [savedRole, setSavedRole] = useState(member.role)
  const [savedDescription, setSavedDescription] = useState(member.description ?? "")
  const [imageUrl, setImageUrl] = useState(member.image_url)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const u = URL.createObjectURL(file)
    setFilePreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  if (removed) {
    return (
      <div style={{ ...styles.card, opacity: 0.6 }}>
        <p style={styles.removedNote}>
          {savedName} removed from the public site. Refresh the dashboard to
          confirm. (Use Supabase Dashboard to undo.)
        </p>
      </div>
    )
  }

  const saveField = (field: TeamMemberField, value: string, after: () => void) => {
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      const result = await updateTeamMemberText(member.slug, field, value)
      if (result.ok) {
        setStatus({ kind: "ok", message: "Saved." })
        after()
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setStatus({ kind: "idle", message: "Uploading…" })
    const fd = new FormData()
    fd.append("file", file)
    startTransition(async () => {
      const result = await replaceTeamMemberImage(member.slug, fd)
      if (result.ok) {
        setImageUrl(result.url)
        setFile(null)
        setStatus({ kind: "ok", message: "Photo saved." })
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Remove ${member.name} from the team grid?`)) {
      return
    }
    setStatus({ kind: "idle", message: "Removing…" })
    startTransition(async () => {
      const result = await softDeleteTeamMember(member.slug)
      if (result.ok) {
        setRemoved(true)
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.photoColumn}>
          <div style={styles.photoLabel}>Photo</div>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={savedName} style={styles.photo} />
          ) : (
            <div style={styles.photoEmpty}>No photo</div>
          )}
          {file && filePreview ? (
            <>
              <div style={{ ...styles.photoLabel, color: "#0066cc", marginTop: 8 }}>New (preview)</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreview} alt="Preview" style={{ ...styles.photo, borderColor: "#0066cc" }} />
            </>
          ) : null}
          <form onSubmit={handleUpload} style={styles.uploadForm}>
            <input
              type="file"
              accept="image/*"
              disabled={isPending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={styles.fileInput}
            />
            {file ? (
              <button type="submit" disabled={isPending} style={styles.button}>
                {isPending ? "…" : "Upload"}
              </button>
            ) : null}
          </form>
        </div>

        <div style={styles.fieldsColumn}>
          <Field label="Name">
            <RowEditor
              value={name}
              setValue={setName}
              savedValue={savedName}
              onSave={(v) => saveField("name", v, () => setSavedName(v))}
              disabled={isPending}
            />
          </Field>
          <Field label="Role">
            <RowEditor
              value={role}
              setValue={setRole}
              savedValue={savedRole}
              onSave={(v) => saveField("role", v, () => setSavedRole(v))}
              disabled={isPending}
            />
          </Field>
          <Field label="Description">
            <RowEditor
              value={description}
              setValue={setDescription}
              savedValue={savedDescription}
              onSave={(v) => saveField("description", v, () => setSavedDescription(v))}
              disabled={isPending}
              multiline
            />
          </Field>
          <div style={styles.cardActions}>
            <button type="button" onClick={handleDelete} disabled={isPending} style={styles.removeButton}>
              Remove from team
            </button>
            <code style={styles.slug}>{member.slug}</code>
            {status.message ? (
              <span
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
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function RowEditor({
  value,
  setValue,
  savedValue,
  onSave,
  disabled,
  multiline,
}: {
  value: string
  setValue: (v: string) => void
  savedValue: string
  onSave: (v: string) => void
  disabled: boolean
  multiline?: boolean
}) {
  const dirty = value !== savedValue
  return (
    <div style={styles.editorRow}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          rows={2}
          style={{ ...styles.input, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          style={styles.input}
        />
      )}
      <button
        type="button"
        disabled={!dirty || disabled}
        onClick={() => onSave(value)}
        style={styles.button}
      >
        Save
      </button>
      {dirty ? (
        <button
          type="button"
          onClick={() => setValue(savedValue)}
          disabled={disabled}
          style={styles.cancelButton}
        >
          Revert
        </button>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

const styles: Record<string, React.CSSProperties> = {
  addShell: {
    border: "1px dashed #999",
    borderRadius: 6,
    padding: "10px 14px",
    background: "#fcfcff",
    marginBottom: 16,
  },
  addSummary: { cursor: "pointer", fontSize: 14 },
  addForm: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },
  empty: { color: "#666", fontStyle: "italic" },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: {
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    padding: 14,
  },
  cardHeader: { display: "flex", gap: 18 },
  photoColumn: { flex: "0 0 160px" },
  photoLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#777",
    marginBottom: 4,
  },
  photo: {
    width: 160,
    height: 160,
    objectFit: "cover",
    border: "1px solid #eee",
    borderRadius: 6,
    background: "#fafafa",
  },
  photoEmpty: {
    width: 160,
    height: 160,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fafafa",
    color: "#999",
    border: "1px dashed #ddd",
    borderRadius: 6,
    fontSize: 12,
  },
  uploadForm: { display: "flex", gap: 6, alignItems: "center", marginTop: 8 },
  fileInput: { fontSize: 12, maxWidth: 100 },
  fieldsColumn: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 12, color: "#444", fontWeight: 600 },
  editorRow: { display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 220,
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
    fontFamily: "inherit",
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
  cardActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 },
  actionsRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  slug: {
    fontFamily: "monospace",
    background: "#f5f5f5",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: 12,
  },
  status: { fontSize: 13 },
  removedNote: { color: "#0a7f3f", fontWeight: 600 },
}
