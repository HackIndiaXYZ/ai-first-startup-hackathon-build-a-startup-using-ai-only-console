# Pharmaceutical distribution: product position and alternatives

Desk research reviewed on 3 October 2026. Sources are the vendors' own product pages and documentation. No customer interviews, industrial trials, sales outreach or vendor benchmarking were performed.

## Who RecallScope is for

The selected user is a pharmaceutical distributor or wholesaler's operations/quality team. The focused job is to connect a product-specific batch to recorded stock and customer shipments, then account for its return or other evidenced disposition during a recall.

The initial value proposition is **document-to-recall accounting with inspectable evidence**. A team can review a structured document, post a movement, trace an affected batch and export a fixed evidence package. Guided examples make that workflow accessible to judges without keys or external services; optional AI helps interpret documents when a provider is configured.

## Three established alternatives

| Alternative | What the primary source documents | Implication for RecallScope |
| --- | --- | --- |
| **TraceLink Targeted Recalls** | Recall notification, identification of affected sites, communication/reporting and audit trails. Its page describes using DSCSA EPCIS information from TraceLink U.S. Compliance to determine receipt and quantity at sites. Its stated audience includes pharmacies and health systems. | Recall management is an established category. Our distributor-focused, evidence-linked workflow is a positioning hypothesis, not a claim that competitors lack recalls or audit history. [Official product page](https://www.tracelink.com/products/product-orchestration/targeted-recalls) |
| **SAP Advanced Track and Trace for Pharmaceuticals** | A corporate serialisation repository, serial-number/aggregation management, ERP and warehouse integration, and country-specific reporting. | Our batch-focused implementation does not replace a serialisation and regulatory-reporting platform. Its narrower scope should be clear in the pitch and EPCIS tools. [Official product page](https://www.sap.com/uk/products/scm/track-trace-pharmaceuticals.html) |
| **Odoo Inventory** | Lot/serial tracking, expiry information and FEFO removal strategies. Its documentation describes delivery slip traceability and selecting stock by removal date. | Catalogue, lot and expiry tracking alone do not establish differentiation. RecallScope should demonstrate source-to-decision review and return accounting clearly. [Expiry documentation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html), [FEFO documentation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html) |

These observations do not establish comparative ease of use, implementation cost, extraction accuracy, customer satisfaction or vendor feature absence. No cost or performance superiority is claimed from product marketing pages.

## What this entry can demonstrate

1. **A specific operational problem.** Product strength, presentation, batch and warehouse matter. A same-code batch on another product must remain outside the case.
2. **An end-to-end result.** The authored case goes from 1,000 received boxes to four recipients, partial returns and completed accounting, with the arithmetic inspectable.
3. **Useful AI with predictable boundaries.** Optional extraction creates review proposals. Deterministic code governs identity, quantities and posting. The key-free example is clearly labelled as pre-filled.
4. **A credible interaction.** A judge can post a 40-box receipt, inspect its source, reload and export a report without an API credential.
5. **Substantive engineering.** Unit conversions, stock status, in-transit quantities, immutable report snapshots, idempotency and concurrent writes create more depth than a static dashboard.

This is an argument for a stronger competition demonstration, not a guarantee of a prize or proof of market demand.

## Commercial model to evaluate

The proposed offer is an organisation subscription with warehouse/user allowances and optional metered document extraction. Pricing, demand, retention and willingness to pay remain planning hypotheses. Do not reuse a food-manufacturer price assumption as pharmaceutical validation.

Use an explicit cost model before publishing a price:

| Input | How to measure |
| --- | --- |
| Hosting, D1 and R2 | Actual usage and the selected hosting arrangement |
| Document extraction | Requests × measured tokens/pages × the chosen provider's current rates |
| Storage and exports | Source-file volume, retention policy and egress |
| Support | Observed support time × an explicit loaded hourly cost |
| Revenue | Paying organisations × tested subscription price, plus any agreed usage charge |

Contribution per organisation equals revenue minus its variable service/support cost; break-even organisations equal fixed monthly cost divided by positive contribution per organisation. No current customer count, savings percentage, market share or revenue is invented.

The current release work can be evaluated entirely with synthetic scenarios, reproducible software checks, accessibility inspection and recorded provider mocks. Real industrial testing is outside the owner's requested scope.
