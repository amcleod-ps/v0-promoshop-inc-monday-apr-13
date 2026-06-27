# Archived runbooks

These phased runbooks were written during the iterative Azure-integration scaffold. They are **superseded by `docs/runbooks/production-go-live.md`**, which is the single end-to-end walkthrough for spinning up the client's production environment.

Kept in-tree only as a historical record of the abandoned Azure-integration approach. **None of their content was carried into `production-go-live.md`** — that runbook is a fresh Vercel + Supabase checklist, and the Azure artifacts these phases reference (`main.bicep`, the OIDC / Cosmos / Blob / Entra steps) no longer exist in this repo:
- `phase-0-bootstrap.md` — original subscription + OIDC + Key Vault + SWA bootstrap.
- `phase-1-data-layer.md` — Cosmos + Blob bootstrap.
- `phase-2-auth.md` — Entra External ID tenant bootstrap.

The full Azure walkthrough is archived alongside this file as `azure-production-go-live.md` (wrong stack — see [`../production-go-live.md`](../production-go-live.md) for the real Vercel + Supabase checklist).
