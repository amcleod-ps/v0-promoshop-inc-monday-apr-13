# Archived runbooks

These phased runbooks were written during the iterative Azure-integration scaffold. They are **superseded by `docs/runbooks/production-go-live.md`**, which is the single end-to-end walkthrough for spinning up the client's production environment.

Kept in-tree for reference on the history of:
- `phase-0-bootstrap.md` — original subscription + OIDC + Key Vault + SWA bootstrap. Pivoted to App Service Linux; OIDC steps still valid and folded into §1 of the production runbook.
- `phase-1-data-layer.md` — Cosmos + Blob bootstrap. Outcome is identical to what main.bicep creates today; the runbook just used to walk each step manually.
- `phase-2-auth.md` — Entra External ID tenant bootstrap. §2 of the production runbook.

Read `./azure-production-go-live.md (ARCHIVED — wrong stack; see ../production-go-live.md for the real Vercel+Supabase checklist)` first.
