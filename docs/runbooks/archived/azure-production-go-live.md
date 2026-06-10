> **ARCHIVED — WRONG STACK. Do not follow.** This runbook describes an
> Azure App Service deployment that was never used. The site runs on
> **Vercel + Supabase**; the live launch checklist is
> `docs/runbooks/production-go-live.md`.

# Production Go-Live Runbook

End-to-end walkthrough to stand up the PromoShop production environment on Azure. Target: zero follow-up tickets. Run each section top-to-bottom; every checkbox is something a reviewer would expect to see signed off.

**Prerequisites (one-time, owner-level in Azure):**
- An Azure subscription (the client's). You need `Owner` at subscription scope for the bootstrap, then you step down.
- Domain registrar access to `promoshopinc.com` (or whatever FQDN you're binding).
- The Azure CLI (`az`) + Azure Developer CLI (`azd`) on your workstation. Runbook commands assume both are in PATH.
- A GitHub account with push access to `VicRobNes/v0-promoshop-inc-monday-apr-13`.

---

## 1 · Bootstrap: OIDC federated credential for GitHub Actions

No long-lived secrets. GitHub Actions authenticates to Azure via OIDC.

```bash
# Variables — fill these in:
export SUBSCRIPTION_ID=00000000-0000-0000-0000-000000000000
export TENANT_ID=00000000-0000-0000-0000-000000000000
export GITHUB_ORG=VicRobNes
export GITHUB_REPO=v0-promoshop-inc-monday-apr-13

# 1. Log in
az login --tenant "$TENANT_ID"
az account set --subscription "$SUBSCRIPTION_ID"

# 2. Create the App Registration the workflow authenticates as
APP_ID=$(az ad app create --display-name "promoshop-github-deployer" --query appId -o tsv)
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)

# 3. Grant Contributor on the subscription (for the initial provision).
#    After go-live, tighten to resource-group scope — see §6.
az role assignment create \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# 4. Federated credential for the `main` branch + the `workflow_dispatch` flow
cat <<EOF > /tmp/fed.json
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:$GITHUB_ORG/$GITHUB_REPO:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$APP_ID" --parameters /tmp/fed.json

# 5. GitHub repo secrets — set exactly these names:
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
```

Add the three values as **repository secrets** under *Settings → Secrets and variables → Actions*.

- [ ] `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` set in GitHub.
- [ ] App registration has Contributor on the subscription (will tighten later).

---

## 2 · Bootstrap: Entra External ID (CIAM) tenant

The External ID tenant itself is portal-only — ARM can't create it.

1. Azure portal → **Create a resource → Microsoft Entra External ID**.
2. Name it `promoshop-prod` (or similar). Domain prefix → `promoshop` yields `promoshop.ciamlogin.com`.
3. Inside the new tenant: **App registrations → New registration**.
   - Name: `promoshop-web-prod`
   - Supported account types: Accounts in this organizational directory only
   - Redirect URI: `Single-page application` → leave empty for now, we'll fill it after the site is deployed
4. Copy the **Application (client) ID** and the **Directory (tenant) ID**.
5. **User flows → New user flow → Sign up and sign in**. Name it `B2C_1_signupsignin`.

- [ ] Tenant provisioned
- [ ] App Registration created, client ID captured
- [ ] User flow `B2C_1_signupsignin` created

---

## 3 · Provision Azure infrastructure

Run the `Azure Provision (azd)` workflow from **Actions → Azure Provision (azd) → Run workflow**.

Inputs:
- **environmentName**: `prod`
- **location**: `canadacentral`
- **appServiceSku**: `P0v3` (or `P1v3` if you want zone redundancy from day 1)
- **customDomainName**: `www.promoshopinc.com` *(or empty to skip — you can add it later)*
- **budgetContactEmails**: `["ops@promoshopinc.com"]`
- **budgetAmountUsd**: `150`
- **alertContactEmails**: `["ops@promoshopinc.com"]`
- **grantDeployPrincipalRgContributor**: `false`

Wait for the workflow to finish. The **outputs** step dumps everything you need.

- [ ] `rg-promoshop-prod` exists with: Log Analytics, App Insights, Key Vault, Storage, Cosmos, App Service Plan, App Service, User-assigned MI
- [ ] Budget `promoshop-prod-monthly-budget` shows in *Cost Management → Budgets* with three email alerts
- [ ] Action group `ag-promoshop-prod` exists with the correct email receivers
- [ ] Availability test `at-promoshop-prod` is green within 10 min

---

## 4 · Wire the Entra External ID values into Key Vault

From the provision step above, `rg-promoshop-prod` has a Key Vault. Fill in the two auth values via the External ID parameters on the next provision pass:

```bash
gh workflow run "Azure Provision (azd)" \
  --field environmentName=prod \
  --field location=canadacentral \
  --field appServiceSku=P0v3 \
  --field customDomainName=www.promoshopinc.com \
  --field budgetContactEmails='["ops@promoshopinc.com"]' \
  --field alertContactEmails='["ops@promoshopinc.com"]' \
  -f EXTERNAL_ID_TENANT_ID=<tenant-id-from-step-2> \
  -f EXTERNAL_ID_TENANT_DOMAIN=promoshop.ciamlogin.com \
  -f EXTERNAL_ID_CLIENT_ID=<client-id-from-step-2>
```

*Note: if the provision workflow doesn't expose `EXTERNAL_ID_*` as inputs yet, write the values directly into Key Vault with `az keyvault secret set --vault-name <kv> --name AUTH-CLIENT-ID --value <id>` and `AUTH-AUTHORITY` = `https://promoshop.ciamlogin.com/<tenant-id>/B2C_1_signupsignin`.*

- [ ] Key Vault has `AUTH-CLIENT-ID` and `AUTH-AUTHORITY` secrets

---

## 5 · Deploy the Next.js app

Commit this runbook PR to `main`. The `Azure App Service Deploy` workflow fires automatically on any push to `main` outside `docs/` + `infra/`.

To deploy manually: **Actions → Azure App Service Deploy → Run workflow → environmentName=prod**.

The workflow:
1. Installs pnpm 10 + Node 22
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. `pnpm prune --prod`
5. Zips `.next/`, `public/`, `node_modules/`, `package.json`, `pnpm-lock.yaml`, `next.config.mjs`, `proxy.ts`
6. Deploys to App Service via `azure/webapps-deploy@v3`
7. Warms the home page with 5 retries

- [ ] Workflow green
- [ ] `https://app-promoshop-prod-<token>.azurewebsites.net/` returns 200
- [ ] `/admin` redirects unauthenticated users to `/sign-in` (proxy.ts matcher active)

---

## 6 · Custom domain + managed SSL

**At the registrar (Cloudflare/GoDaddy/etc.):**

For a `www.promoshopinc.com` subdomain:
- CNAME `www` → `<app-service-hostname>` (e.g. `app-promoshop-prod-abcd.azurewebsites.net`)
- TXT `asuid.www` → `<customDomainVerificationId>` (read it below)

```bash
# Read the verification id
APP_NAME=$(az webapp list -g rg-promoshop-prod --query "[0].name" -o tsv)
az webapp show -g rg-promoshop-prod --name "$APP_NAME" --query customDomainVerificationId -o tsv
```

Wait 5-10 minutes for DNS to propagate (`dig www.promoshopinc.com` should resolve to a `<app>.azurewebsites.net` record).

Re-run the provision workflow with `customDomainName=www.promoshopinc.com` (if not already set). Bicep creates the hostname binding + the managed certificate.

**Then bind SNI + cert** (this is the one-line post-Bicep step the custom-domain module defers):

```bash
THUMB=$(az webapp config ssl list -g rg-promoshop-prod \
  --query "[?subjectName=='www.promoshopinc.com'].thumbprint | [0]" -o tsv)
az webapp config ssl bind \
  --name "$APP_NAME" \
  --resource-group rg-promoshop-prod \
  --certificate-thumbprint "$THUMB" \
  --ssl-type SNI \
  --hostname www.promoshopinc.com
```

Update the Entra External ID App Registration's **redirect URIs** to include:
- `https://www.promoshopinc.com/`
- `https://www.promoshopinc.com/sign-in`
- `https://www.promoshopinc.com/sign-up`

- [ ] `https://www.promoshopinc.com/` returns 200 with a green padlock
- [ ] Cert is an "App Service Managed Certificate" issued by DigiCert (auto-renew every 45 days)
- [ ] MSAL sign-in succeeds from the custom domain

---

## 7 · Tighten RBAC (least privilege)

After the first successful provision, downgrade the deployer:

```bash
# 1. Remove subscription-level Contributor
az role assignment delete \
  --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# 2. Grant Contributor scoped to the resource group ONLY
az role assignment create \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-promoshop-prod"

# 3. Grant User Access Administrator ONLY on the RG so future Bicep deployments
#    can still create role assignments inside it.
az role assignment create \
  --assignee-object-id "$SP_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "User Access Administrator" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-promoshop-prod"
```

- [ ] `az role assignment list --assignee $APP_ID` shows RG-scoped Contributor + User Access Administrator. Nothing subscription-scoped.

---

## 8 · Verification & signoff

Run each of these from a fresh browser, not logged into Azure:

- [ ] `https://www.promoshopinc.com/` loads, logo + hero + brand scroll visible
- [ ] `/brands/patagonia` shows the Patagonia logo over a lifestyle background
- [ ] `/studio` opens the modal on a product click, multi-select works, "Add N items to Quote" lands on `/my-quote` with the expected rows
- [ ] Clicking **Sign In** redirects to `promoshop.ciamlogin.com`, lets you sign up with a throwaway email, and round-trips back to the site
- [ ] `/admin` is gated behind sign-in and only a user with the `admin` role passes
- [ ] Uploading a brand logo in the admin Images tab writes to the storage account's `brands` container, readable via the SAS URL returned to the browser
- [ ] App Insights → **Live Metrics** shows server-side requests when you browse the site
- [ ] App Insights → **Availability** shows green across all 5 test locations
- [ ] Log Analytics query `AppServiceHTTPLogs | where CsHost == 'www.promoshopinc.com' | take 50` returns rows
- [ ] Cost Management → Budgets shows `promoshop-prod-monthly-budget` accruing spend as the day progresses
- [ ] `az webapp identity show -n <app> -g rg-promoshop-prod` shows BOTH `SystemAssigned` AND the user-assigned MI attached
- [ ] `az storage account show -n <storage> -g rg-promoshop-prod --query allowSharedKeyAccess` → `false`
- [ ] `az keyvault show -n <kv> -g rg-promoshop-prod --query "properties.enablePurgeProtection"` → `true`

If every box ticks, you're production-grade.

---

## 9 · Known follow-ups (flagged for the app team, NOT infra)

None of these block go-live. Each requires an app-code change the infra branch deliberately didn't make:

1. **Runtime OpenTelemetry in the app bundle.** App Insights currently receives infra metrics + availability + platform logs, but not custom trace spans. Adding `@azure/monitor-opentelemetry` to `app/layout.tsx` (one import + one `useOpenTelemetry()` call) unlocks per-request spans, exceptions, and dependency traces. Until then, 5xx alerts fire on HTTP counters but not on thrown exceptions.
2. **Dedicated `/api/health` endpoint.** The App Service health check currently points at `/`, which is a real page render. A 5-line `app/api/health/route.ts` that returns `{ ok: true }` would be cheaper and more reliable.
3. **Entra External ID role claim.** The admin gate reads `roles: ['admin']` off the JWT. In the External ID App Registration, add an App Role called `admin` and assign it to the users who should see `/admin`. No code change needed once that's in place.

---

## Rollback

If anything in this runbook fails:

- **Bicep failure**: `az deployment sub cancel --name <deployment>`. Delete the RG with `az group delete -n rg-promoshop-prod --yes --no-wait`. Re-run provision.
- **App deploy failure**: Previous ZIP is retained as a deployment slot snapshot in App Service. Portal → **Deployment Center → Logs → Redeploy** on the last-good build.
- **Cert failure**: Re-run `az webapp config ssl bind` after the CNAME/TXT records settle.
