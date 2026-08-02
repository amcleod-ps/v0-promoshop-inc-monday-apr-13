# Pricing add-on acceptance-test matrix

This inventory defines minimum acceptance coverage. Synthetic SKUs and prices must be used in repository tests and preview verification.

Priority meanings:

- **P0:** release-blocking correctness or security.
- **P1:** required initial-release behaviour.
- **P2:** useful resilience or usability coverage.

| ID | Priority | Area | Scenario | Expected result | Intended coverage |
|---|---|---|---|---|---|
| DATA-001 | P0 | Matrix | Required field is blank or malformed | Dry run identifies the exact row/field; no rows are written | Automated |
| DATA-002 | P0 | Matrix | Duplicate SKU and tier-start pair | Whole import is rejected; existing tiers remain unchanged | Automated |
| DATA-003 | P0 | Matrix | Tier starts below the SKU MOQ | Whole import is rejected with an actionable error | Automated |
| DATA-004 | P0 | Matrix | Starts are duplicated or not strictly increasing | Whole SKU set is rejected | Automated |
| DATA-005 | P1 | Matrix | First tier does not start at MOQ | Rejected unless a separately recorded rule allows it | Automated |
| DATA-006 | P0 | Matrix | Import includes one invalid row among valid rows | No partial write occurs | Integration |
| DATA-007 | P1 | Matrix | Unknown SKU | Row is rejected; no new product is created implicitly | Integration |
| TIER-001 | P0 | Calculator | Quantity equals MOQ/first tier start | First tier price is selected | Unit |
| TIER-002 | P0 | Calculator | Quantity is one below the next tier | Previous tier price is selected | Unit |
| TIER-003 | P0 | Calculator | Quantity equals the next tier start | New tier price is selected | Unit |
| TIER-004 | P0 | Calculator | Quantity exceeds the final tier start | Final tier remains effective | Unit |
| TIER-005 | P0 | Calculator | Quantity is below MOQ | No estimate is produced; approved correction message is returned | Unit/UI |
| TIER-006 | P0 | Calculator | Product has no valid tiers | No price is invented; approved missing-price state is shown | Unit/UI |
| MONEY-001 | P0 | Money | Decimal unit price multiplied by quantity | Result follows the approved exact scale and rounding rule | Unit |
| MONEY-002 | P1 | Money | Large valid quantity and price | No overflow, exponential notation or binary-float artefact | Unit |
| CART-001 | P0 | Cart | Two variants share one SKU | Quantity follows the approved aggregation rule and all lines display consistently | Unit/UI |
| CART-002 | P1 | Cart | Legacy local-storage entry lacks pricing fields | Cart loads safely and pricing is recalculated | Unit/UI |
| CART-003 | P1 | Cart | Quantity is edited across a tier boundary | Unit price and subtotal update immediately | UI |
| CART-004 | P1 | Cart | Priced and unpriced items coexist | Estimate completeness is explicit and no unpriced value is treated as zero | UI |
| QUOTE-001 | P0 | Submission | Client changes displayed price before submitting | Server ignores the altered value and calculates from current tiers | Integration |
| QUOTE-002 | P0 | Submission | Tier changes after browser display | Server applies the approved stale-price policy before saving | Integration/UI |
| QUOTE-003 | P0 | Submission | Valid estimated request | Structured snapshot matches the server calculation and human-readable request | Integration |
| QUOTE-004 | P0 | Submission | Pricing lookup fails | Request fails safely or follows the approved incomplete-estimate rule; no false total is stored | Integration |
| QUOTE-005 | P1 | Notification | Notification is enabled | Notification pricing matches the stored server snapshot | Integration |
| ADMIN-001 | P0 | Authorization | Unauthenticated user opens pricing administration | Access is denied before data or controls render | Browser/security |
| ADMIN-002 | P0 | Authorization | Unauthorized request invokes a pricing mutation directly | Mutation is denied and no tier changes | Integration/security |
| ADMIN-003 | P0 | Editing | Authorized user replaces a complete valid tier set | All tiers change atomically and the result is revalidated | Integration/UI |
| ADMIN-004 | P0 | Editing | Stale administrator form submits after another update | Conflict is detected; newer data is not overwritten silently | Integration |
| ADMIN-005 | P1 | Editing | User attempts to remove all tiers | Approved retirement rule is enforced and clearly reported | Integration/UI |
| DB-001 | P0 | Database | Anonymous role reads pricing | Only approved pricing columns/rows are readable | SQL/security |
| DB-002 | P0 | Database | Anonymous/authenticated role attempts pricing write | Database denies the write | SQL/security |
| DB-003 | P0 | Database | Migration is reapplied in verification environment | Result follows documented idempotency/one-way expectations without silent drift | SQL |
| FLAG-001 | P0 | Release flag | New code and schema deploy with flag off | Existing public behaviour remains unchanged | Integration/browser |
| REG-001 | P0 | Regression | Existing product catalogue, cart and quote submission without active pricing | Existing supported flow remains functional | Browser |
| REG-002 | P1 | Regression | Existing administrator CMS sections | Existing content/image/product operations remain functional | Browser |
| A11Y-001 | P1 | Accessibility | Price changes after quantity edit | Updated information is understandable by keyboard and assistive technology | Browser/manual |
| RESPONSIVE-001 | P1 | Responsive | Tier and estimate display at supported mobile widths | No clipping, overlap or inaccessible controls | Browser |
| OPS-001 | P0 | Deployment | Exact release commit deployed | Deployment metadata matches reviewed commit | Operational |
| OPS-002 | P0 | Domains | Apex and `www` custom hosts | TLS, redirect and canonical host checks pass without bypasses | Operational |
| OPS-003 | P0 | Database | Hosted migration application | Ledger, table, grants and policies match reviewed SQL | Operational/SQL |
| OPS-004 | P0 | Data load | Approved matrix loaded with feature off | Row counts, tier boundaries and reconciliation totals match the approved source | Operational |
| OPS-005 | P0 | Activation | Feature is enabled after all gates | Representative products and a quote submission pass production smoke tests | Operational/browser |
| OPS-006 | P1 | Rollback | Activation fault occurs | Flag can disable pricing without losing matrix or quote evidence | Operational |

## Required release evidence

- exact pull-request merge commit;
- green automated checks;
- reviewed migration checksum and hosted ledger entry;
- grants/RLS verification output;
- matrix dry-run and post-import reconciliation;
- preview acceptance outcomes;
- production deployment identifier;
- domain/TLS smoke results;
- representative server-calculated quote snapshot; and
- separate record of customer acceptance when received.

Passing an earlier item does not imply a later state. In particular, a green pull request does not imply a deployed migration, a loaded matrix, active pricing, production verification or customer acceptance.
