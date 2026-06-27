# Mailchimp export — findings note (Part B → Priority 4)

> Settles which export format(s) the Priority 4 collection export should support
> and why. Researched June 2026. Assume nothing; keep the export flexible.

## The key finding

**Mailchimp has no "import a product-collection file straight into a campaign"
feature.** The two things Mailchimp *does* ingest are different from each other:

1. **Contact/audience imports** accept **CSV, TXT, XLS, XLSX** — but that is for
   *subscribers*, not products. Irrelevant to promoting a collection.
2. **Product content blocks** (and Product Recommendation blocks) pull product
   data — image, title, price, URL — **only from a connected e-commerce store or
   a custom Marketing API 3.0 integration**, max 4 per block (10 via
   recommendation blocks). They cannot read an uploaded file. PromoShop has no
   connected store, so this path is closed unless we build an API integration
   (out of scope for the June release).

So there is **no one-click file → campaign path**. What the team actually does
is **hand-build the campaign** in Mailchimp's drag-and-drop editor (or paste
markup into its **Code/HTML content block**), referencing the collection's
products. The export's job is therefore to make that hand-build as fast as
possible — a flexible "collection brief" the team works from — not a magic
import file.

## What that means for our export

Offer the formats the master file named, each serving a real sub-use:

| Format | Best for | Notes |
| --- | --- | --- |
| **CSV** | The data spine. Opens in Excel/Sheets; the format Mailchimp natively imports; feeds any mail-merge / future API push. | **Primary recommendation.** Columns: name, SKU, brand, category, description, min qty, colours, sizes, image URL, product link. |
| **XLSX** | Same data, nicer for non-technical staff who live in Excel. | Same columns as CSV. |
| **Markdown** | A readable brief to drop in Notion/Docs or a PR; copy-pastes cleanly. | Per-product heading + bullets + image/link. |
| **Plain text** | Lowest-friction copy-paste into an email draft or chat. | Same content, no markup. |
| **PDF** | A share-ready, good-looking one-pager of the collection for sign-off. | Rendered from the same data. |

## One addition worth flagging to Victor

The single **fastest** path to *campaign content* (not just data) is an **HTML
snippet** of product cards (image + name + short description + CTA link) pasted
into Mailchimp's **Code / HTML content block**. That isn't in the master file's
five formats, but it is the only export that drops in as finished campaign
content. **Recommendation:** add **HTML** as a sixth export option. Low cost
(we already render product cards) and it is the closest thing to the "move a
collection into a campaign quickly" goal.

## Decision for the build

- Implement the five named formats (CSV, XLSX, Markdown, plain text, PDF), and
  add **HTML** per the recommendation above.
- Each export is built from the **same canonical row shape** (name, SKU, brand,
  category, description, min qty, colours, sizes, image URL, absolute product
  link) so formats can't drift. CSV/TXT/MD/HTML are pure string builders (no
  deps); XLSX and PDF use a small library each.
- Keep it flexible: the export is a *brief*, deliberately not over-fit to one
  Mailchimp screen, because Mailchimp's own ingest path may change and the team
  also uses these for internal sign-off.

## Sources

- [Format Guidelines for Your Import File — Mailchimp](https://mailchimp.com/help/format-guidelines-for-your-import-file/) (CSV/TXT/XLS/XLSX for contact imports)
- [Use Product Content Blocks — Mailchimp](https://mailchimp.com/help/use-product-content-blocks/) (products come from a connected store, ≤4/block)
- [Use Product Recommendation Content Blocks — Mailchimp](https://mailchimp.com/help/use-product-recommendation-content-blocks/) (≤10 products, store/API required)
- [E-commerce Stores › Products — Mailchimp Marketing API](https://mailchimp.com/developer/marketing/api/ecommerce-products/) (the only programmatic product path is the API integration)
