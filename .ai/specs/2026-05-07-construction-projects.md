# Construction Projects Module

## TLDR
**Key Points:**
- Add an app-level `construction_projects` module at `apps/mercato/src/modules/construction_projects` for construction-project creation, bid coordination, cost estimation, margin tracking, and lost-opportunity analysis.
- The module introduces a dedicated `construction_project` aggregate instead of overloading `deal` or `sales` records, while preserving strict module isolation through FK ids only.
- v1 uses a versioned estimate model: `cost_estimate` plus `cost_line_item`, with graph-save semantics for draft editing and explicit approval for management reporting.
- Business cardinality is `1:N` from project to deal, enforced through a dedicated link entity with unique `deal_id` rather than modifying core `deal` schema.
- All monetary values in v1 are stored in the tenant base currency, with a currency snapshot on each estimate for historical stability and later currencies-module expansion.

**Scope:**
- Project CRUD, status workflow, deal linkage, and detail views
- Draft and approved estimate revisions with line-item calculations
- Lost-reason capture when marking a project as lost
- Margin ranking and lost-reason report pages
- ACL, search, notifications, events, and integration tests

**Concerns:**
- The cost editor touches tightly coupled parent-child data and must avoid partial writes.
- Costs and margins are commercially sensitive and must stay out of search indexes and unauthorized UI.
- The module must not mutate or directly relate ORM entities from `customers` or `sales`.

## Overview
`construction_projects` targets construction firms, developers, and general contractors whose commercial process revolves around a real-world build rather than a single CRM opportunity. One construction project can spawn multiple negotiations, estimate revisions, and eventual delivery decisions, but the current Open Mercato surfaces stop at customers, deals, and sales documents.

This module adds a first-class construction-project record to anchor that workflow. The project becomes the place where teams register site context, link the commercial opportunity, prepare estimate revisions, track expected profitability, and record why a bid was lost.

> **Market Reference**: The closest open-source reference pattern is the combination of ERPNext-style project and job-costing workflows plus Odoo-style project-centric coordination. Open Mercato should adopt the project-first anchor and revisioned estimating, but reject task scheduling, procurement, Gantt planning, and full execution ERP depth from MVP.

## Problem Statement
Construction sales and estimating do not map cleanly to a generic CRM pipeline.

Current gaps:
- a single build site has no durable identity separate from one specific deal;
- multiple bid rounds or variants cannot be analyzed at the project level;
- estimating data sits outside the platform or inside unstructured notes;
- lost-opportunity reporting is too generic for construction tender workflows;
- management cannot rank projects by approved margin without manually merging CRM and spreadsheet data.

As a result, teams lose visibility into cost revisions, cannot compare profitability across similar projects, and struggle to learn from lost bids.

## Proposed Solution
Create a standalone app module, `construction_projects`, that owns the construction-project lifecycle and integrates with existing `customers`, `sales`, `attachments`, `search`, `events`, and `notifications` capabilities through stable extension points.

### Core Rules
1. `construction_project` is the module anchor; `deal` remains a linked external record, not the source of truth.
2. Cross-module links use scalar FK ids only: `client_company_id`, `client_person_id`, `deal_id`, `owner_user_id`, `approved_by_user_id`, `attachment_id` in future phases.
3. Every module-owned entity is tenant- and organization-scoped.
4. Project mutations are command-based.
5. Estimate draft editing is a graph-save operation because header and line items form one calculation aggregate.
6. Marking a project as `lost` is a compound command that requires loss details in the same request.
7. Approved estimates, not drafts, drive management reports.
8. v1 runs on tenant base currency only; each estimate stores a `currency_code` snapshot for historical consistency and later multi-currency support.
9. Search covers project identity fields only. Costs, margins, and estimate notes stay out of search indexes.
10. Core `deal` schema is not modified. `1:N` project-to-deal cardinality is enforced by a dedicated link record with unique `deal_id`.
11. Sensitive financial fields are returned only on routes guarded for estimate/report access; plain project viewers can see project identity and workflow state without margin data.
12. A project can have many linked deals, but at most one link with role `primary` at a time.
13. Draft version allocation and estimate approval are serialized per project so concurrent requests cannot create duplicate `version_no` values or multiple active approved estimates.
14. Read APIs keep stable response shapes for permission-sensitive financial fragments; redacted financial fields are returned as `null`, not omitted.
15. Sensitive site details, loss-analysis text, and estimate notes are encrypted at rest, excluded from search, and read only through tenant-scoped decryption helpers.
16. Monetary amounts are stored with 4-decimal internal precision; percentage fields also use 4-decimal precision and UI formatting does not alter stored values.

### Design Decisions
| Decision | Rationale |
|----------|-----------|
| App module under `apps/mercato/src/modules/construction_projects` | This is a vertical, tenant-facing domain feature rather than reusable cross-app platform core |
| Use `construction_project_deal` link entity with `UNIQUE(deal_id)` | Enforces `1:N` business rule without breaking core module isolation or modifying `customers` schema |
| Use `cost_estimate` + `cost_line_item` instead of flat project costs | Revision history and approval state are central to estimating workflows |
| Save draft estimates as a graph | Parent totals depend on child rows; graph save eliminates partial-write math drift |
| Keep project status sync explicit, not automatic from deal changes | Avoid hidden cross-module side effects and circular workflow confusion |
| Approved estimate only for reporting | Prevents unfinished drafts from polluting management metrics |
| Base-currency-only v1 | Keeps MVP smaller while preserving a clean path to `currencies` integration |
| Kebab-case route paths with snake_case module id | Preserves internal conventions while keeping user-facing URLs readable |
| Use page-based list/report envelopes | Aligns custom read routes with `DataTable` and platform query conventions (`page`, `pageSize`, `sortField`, `sortDir`) |
| Return `null` for redacted financial fragments | Keeps typed UI contracts stable and avoids route-specific omitted-key behavior |
| Encrypt non-searchable address/loss/note fields | Reduces leakage risk while preserving searchable identity fields |
| Resolve base currency via raw Knex query on `currencies` table | The `currencies` module exposes no cross-module DI service for base-currency lookup. Importing the `Currency` entity class from `@open-mercato/core/modules/currencies/data/entities` would couple modules at compile time and break if that module refactors its entity path. Instead, use a raw Knex query: `em.getKnex().select('code').from('currencies').where({ is_base: true, is_active: true, tenant_id: tenantId, organization_id: organizationId }).first()` — only the scalar `code` field is read and snapshotted on the estimate; no ORM relation is declared between modules |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|-------------|
| Add `construction_project_id` directly to `deal` | Breaks app-module isolation and couples a vertical feature into core schema |
| Keep costs directly on `construction_project` | Cannot model revisions or approval history cleanly |
| Expose per-line-item CRUD endpoints only | Increases concurrency and partial-write risk for aggregate calculations |
| Auto-update project status from linked deal status | Creates opaque behavior and harder-to-debug side effects |
| Multi-currency in v1 | Too much scope for the first release; reporting and approval flow are higher-value first |
| PDF/Excel export in v1 | Adds document-generation complexity before core workflows are proven |
| Currency lookup via a dedicated `currencies` DI service | The `currencies` module registers only `rateFetchingService` and `exchangeRateService` in its `di.ts`; adding a new service solely for base-currency resolution would create asymmetric DI coupling |
| Currency lookup via direct ORM entity class import | Importing `Currency` from `@open-mercato/core/modules/currencies/data/entities` creates a compile-time coupling that breaks if the `currencies` module refactors its entity path — a strict violation of the no-cross-module-business-logic-imports rule. A raw Knex table query is the compliant alternative |

## User Stories / Use Cases
- **Estimator** wants to create a project and prepare several estimate revisions so that bid assumptions are versioned instead of overwritten.
- **Sales rep** wants to link a construction project to an existing deal so that CRM activity stays connected to the physical build opportunity.
- **Manager** wants only approved estimates to influence margin rankings so that portfolio reports are stable and auditable.
- **Sales manager** wants a loss reason to be captured at the same moment the project is marked lost so that reporting data is complete.
- **Operations lead** wants to search projects by code, name, and site location so that the right record can be found quickly.
- **Admin** wants to grant project access separately from estimate approval so that sensitive margin workflows remain permissioned.

## Architecture
The module lives at `apps/mercato/src/modules/construction_projects` and is enabled through `apps/mercato/src/modules.ts` with `{ id: 'construction_projects', from: '@app' }`.

### Domain Boundaries
- `construction_project` owns project identity, status, client/site metadata, and current deal linkage.
- `construction_project_deal` owns the `1:N` project-to-deal business relationship.
- `cost_estimate` owns revision state, approval state, and aggregate totals.
- `cost_line_item` belongs only to a `cost_estimate` and is not edited as a standalone business record.
- `construction_project_loss` owns structured lost-bid capture.
- `customers` remains the source of truth for people, companies, and deals.

> **Cross-module entity access rule**: This module MUST NOT import entity classes from other modules (`Currency` from `currencies`, `CustomerDeal` from `customers`). All cross-module reads use raw Knex queries against the underlying tables. This prevents compile-time coupling and ensures the module stays fully isolated.
- `sales` remains the source of truth for quotes/orders/invoices that may already hang off linked deals.

### Placement & File Structure
Planned structure:

```text
apps/mercato/src/modules/construction_projects/
├── index.ts
├── acl.ts
├── events.ts
├── notifications.ts
├── search.ts
├── setup.ts
├── translations.ts
├── commands/
│   ├── index.ts
│   ├── projects.ts
│   └── estimates.ts
├── data/
│   ├── entities.ts
│   └── validators.ts
├── api/
│   ├── openapi.ts
│   ├── get/construction-projects.ts
│   ├── post/construction-projects.ts
│   ├── get/construction-projects/[id].ts
│   ├── patch/construction-projects/[id].ts
│   ├── delete/construction-projects/[id].ts
│   ├── post/construction-projects/[id]/status.ts
│   ├── post/construction-projects/[id]/deals.ts
│   ├── delete/construction-projects/[id]/deals/[linkId].ts
│   ├── get/construction-projects/[id]/estimates.ts
│   ├── post/construction-projects/[id]/estimates.ts
│   ├── get/construction-projects/[id]/estimates/[estimateId].ts
│   ├── patch/construction-projects/[id]/estimates/[estimateId].ts
│   ├── delete/construction-projects/[id]/estimates/[estimateId].ts
│   ├── post/construction-projects/[id]/estimates/[estimateId]/approve.ts
│   ├── get/reports/construction-projects/margins.ts
│   └── get/reports/construction-projects/lost-reasons.ts
├── backend/
│   ├── construction-projects/page.tsx
│   ├── construction-projects/page.meta.ts
│   ├── construction-projects/create/page.meta.ts
│   ├── construction-projects/create/page.tsx
│   ├── construction-projects/[id]/page.meta.ts
│   ├── construction-projects/[id]/page.tsx
│   ├── construction-projects/[id]/edit/page.meta.ts
│   ├── construction-projects/[id]/edit/page.tsx
│   ├── construction-projects/[id]/estimates/[estimateId]/page.meta.ts
│   ├── construction-projects/[id]/estimates/[estimateId]/page.tsx
│   ├── construction-projects/reports/margins/page.meta.ts
│   ├── construction-projects/reports/margins/page.tsx
│   ├── construction-projects/reports/lost-reasons/page.meta.ts
│   └── construction-projects/reports/lost-reasons/page.tsx
├── components/
│   ├── ConstructionProjectForm.tsx
│   ├── EstimateEditor.tsx
│   ├── EstimateSummaryCard.tsx
│   └── LossReasonDialog.tsx
├── widgets/
│   ├── injection-table.ts
│   └── injection/
│       └── construction-projects-menus/
│           ├── widget.ts
│           └── widget.meta.ts
├── subscribers/
│   ├── estimate-approved-notification.ts
│   ├── project-lost-notification.ts
│   └── project-lifecycle-cache-invalidation.ts
└── __integration__/
		├── construction-projects-crud.spec.ts
		├── construction-projects-estimates.spec.ts
		└── construction-projects-reports.spec.ts
```

### Aggregate Strategy
`construction_project` and `cost_estimate` are separate aggregates.

Project aggregate operations:
- create, update, archive;
- status change;
- link and unlink deal;
- read current approved-estimate summary;
- read latest loss record.

Estimate aggregate operations:
- create draft estimate revision;
- save draft graph of header and line items in one transaction;
- clone estimate into a new draft revision;
- approve draft estimate;
- archive unused draft estimate.

This split follows the "Command Graph vs. Independent Ops" heuristic:
- project/deal/status changes are independent operations;
- estimate draft save is a graph save because header totals depend on all child rows.

### Commands & Events
**Commands**
- `construction_projects.project.create`
- `construction_projects.project.update`
- `construction_projects.project.archive`
- `construction_projects.project.change_status`
- `construction_projects.project.link_deal`
- `construction_projects.project.unlink_deal`
- `construction_projects.estimate.create`
- `construction_projects.estimate.clone_version`
- `construction_projects.estimate.save_draft_graph`
- `construction_projects.estimate.approve`
- `construction_projects.estimate.archive`

**Events**
- `construction_projects.project.created`
- `construction_projects.project.updated`
- `construction_projects.project.archived`
- `construction_projects.project.status_changed`
- `construction_projects.project.deal_linked`
- `construction_projects.project.deal_unlinked`
- `construction_projects.project.lost_recorded`
- `construction_projects.estimate.created`
- `construction_projects.estimate.draft_saved`
- `construction_projects.estimate.approved`
- `construction_projects.estimate.archived`

Event rules:
- events are declared in `events.ts` with `createModuleEvents()` and `as const`;
- persistent subscribers are idempotent;
- subscribers do one side effect each: notification, cache invalidation, indexing update;
- no subscriber mutates `customers.deal` or `sales` records in v1;
- `estimate-approved-notification.ts` handles the `construction_projects.estimate.approved` event and sends the estimate-approved in-app notification;
- `project-lost-notification.ts` handles the `construction_projects.project.lost_recorded` event and sends the project-lost in-app notification;
- `project-lifecycle-cache-invalidation.ts` handles all cache-invalidating events (project CRUD, status change, deal link/unlink, all estimate lifecycle events, loss recording) in one subscriber file — this is a deliberate exception to the one-side-effect rule because all effects are the same kind (cache tag invalidation) and consolidating them avoids proliferating near-identical subscriber files.

Minimum event payload contract:
- every event payload includes `tenantId`, `organizationId`, `projectId`, `actorUserId`, and the module record id for the mutated aggregate;
- `construction_projects.project.status_changed` includes `previousStatus`, `nextStatus`, and `lossRecordId` when status becomes `lost`;
- `construction_projects.project.deal_linked` and `.deal_unlinked` include `linkId`, `dealId`, and `role`;
- `construction_projects.estimate.created`, `.draft_saved`, `.approved`, and `.archived` include `estimateId`, `versionNo`, `status`, and `projectId`;
- `construction_projects.estimate.approved` also includes `previousApprovedEstimateId` when one exists so subscribers can invalidate summaries and notifications deterministically.

### Command Snapshot Types

Commands use typed before/after snapshots for audit and undo. The following shapes MUST be used consistently across all command handlers in `commands/projects.ts` and `commands/estimates.ts`:

```typescript
type ConstructionProjectSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  projectCode: string
  name: string
  projectType: string | null
  status: string
  description: string | null
  notes: string | null
  siteCity: string | null
  siteCountryCode: string | null
  clientCompanyId: string | null
  clientPersonId: string | null
  ownerUserId: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  estimatedRevenueAmount: string | null
  latestApprovedEstimateId: string | null
  createdAt: Date
  updatedAt: Date
}

type CostEstimateSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  constructionProjectId: string
  versionNo: number
  revision: number
  name: string
  status: string
  currencyCode: string
  defaultMarkupPercent: string | null
  totalCostAmount: string
  totalSaleAmount: string
  marginAmount: string
  marginPercent: string
  approvedByUserId: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

`captureAfter` loads the snapshot using a forked `EntityManager` (`em.fork()`); `buildLog` serializes it into `snapshotAfter`. `extractUndoPayload<T>` from `@open-mercato/shared/lib/commands/undo` reads the typed payload from the log entry in `undo` handlers.

### Transaction & Undo Contract
- Project create/update/archive commands use standard before/after snapshots and are undoable.
- Deal link/unlink commands are undoable because unlink soft-deletes module-owned link rows and undo restores the same row id and timestamps.
- Status change is undoable while the project remains otherwise untouched; loss-record creation is reverted with the same command undo. This internal undo path does not create a user-facing reopen workflow from terminal states.
- Draft estimate graph save is atomic inside one transaction and guarded by optimistic `revision` checks. Existing line items update in place by `id`, omitted draft rows are soft-deleted, and new rows are inserted.
- Approval is only reversible while no newer approved estimate exists; once a subsequent estimate is approved, earlier approval undo becomes a compensating archive rather than true rollback.
- Notifications and search indexing are side effects and are not reversed synchronously; undo emits compensating events so downstream subscribers can recalculate state.

**Implementation notes for all command handlers:**
- Multi-step writes MUST use `withAtomicFlush(em, [...steps], { transaction: true })` from `@open-mercato/shared/lib/commands/flush` to guarantee atomicity and avoid partial write drift.
- Post-write index and event side effects MUST use `emitCrudSideEffects` (with `indexer: { entityType, cacheAliases }`) from `@open-mercato/shared/lib/commands/helpers`. For query-index updates on non-`makeCrudRoute` write paths, add a module-local `emitProjectQueryIndexEvents` helper in `commands/shared.ts` following the pattern in `packages/core/src/modules/customers/commands/shared.ts` — `emitQueryIndexUpsertEvents` is not exported from `@open-mercato/shared`.
- `captureAfter` and `buildLog` MUST use `em.fork()` to avoid MikroORM identity-map stale snapshots (see `lessons.md`: "Avoid identity-map stale snapshots in command logs").
- Undo handlers MUST use `extractUndoPayload` from `@open-mercato/shared/lib/commands/undo`.
- The `commands/index.ts` barrel MUST import all command files so they are auto-registered at module load time (follow the pattern in `packages/core/src/modules/customers/commands/index.ts`).
- The module root `index.ts` MUST `import './commands/index'` so all command handlers are registered when the module loads. Without this import, commands will not be available at runtime even though the barrel exists.
- Base currency resolution MUST use a raw Knex query (`em.getKnex()...`) — never import `Currency` entity class from the `currencies` module. Deal existence verification uses `em.getKnex()` equivalently or a scoped `em.findOne` where the entity class is already loaded in the same request context.

### Concurrency & Invariants
- estimate draft creation allocates `version_no` inside the same transaction after acquiring a project-scoped pessimistic write lock (`LockMode.PESSIMISTIC_WRITE` via MikroORM) on the `ConstructionProject` row, so parallel draft creation cannot reuse the same version number;
- estimate approval acquires `LockMode.PESSIMISTIC_WRITE` on the `ConstructionProject` row and on the current approved `CostEstimate` row, re-checks estimate status inside the transaction, and guarantees that at most one estimate remains `approved` per project;
- graph save uses optimistic `revision` checks and returns `412` on stale revision rather than last-write-wins behavior;
- role `primary` on `construction_project_deal` is enforced both by command validation and a database constraint.

### Command Validation Matrix

| Command / Route | Invariant | Failure |
|-----------------|-----------|---------|
| `project.create` / `POST /api/construction-projects` | `project_code` unique per `(organization_id, tenant_id)`; timeline date ordering valid | `409` for duplicate code; `400` for schema/date validation |
| `project.update` / `PATCH /api/construction-projects/:id` | Status is not changed here; timeline date ordering valid | `409` when payload attempts status mutation; `400` for schema/date validation |
| `project.change_status` / `POST /api/construction-projects/:id/status` | Leaving `draft` requires `client_company_id` or `client_person_id`; entering `offered`, `won`, or `in_progress` requires at least one active `primary` deal link; entering `lost` requires `loss` payload | `409` for missing client/deal/status preconditions; `409` for invalid transition |
| `project.link_deal` / `POST /api/construction-projects/:id/deals` | A deal may belong to only one active project; a project may have only one active `primary` link | `409` for duplicate active deal assignment or second active `primary` link |
| `project.unlink_deal` / `DELETE /api/construction-projects/:id/deals/:linkId` | `offered`, `won`, and `in_progress` projects must retain an active `primary` link after the command commits | `409` when unlink would leave the project without a required active `primary` link |
| `estimate.create` / `POST /api/construction-projects/:id/estimates` | Tenant base currency must resolve from the currencies source of truth; cloned estimate, when provided, must belong to the same project | `409` when no base currency exists; `404` or `409` for invalid clone source |
| `estimate.save_draft_graph` / `PATCH /api/construction-projects/:id/estimates/:estimateId` | Estimate must still be `draft`; `revision` must match; max `500` active line items; every referenced line item id must belong to the same estimate | `409` for non-draft save; `412` for stale revision; `400` for payload/line-item validation |
| `estimate.approve` / `POST /api/construction-projects/:id/estimates/:estimateId/approve` | Only `draft` estimates can be approved; approval is serialized per project | `409` for approval race or invalid status |
| `project.archive` / `DELETE /api/construction-projects/:id` | Approved estimates require explicit confirmation | `409` when approved estimates exist and confirmation flag is missing |

### Read Model, Query, Search, and Cache Strategy
- Project list API is a custom read route backed by indexed project data plus a latest-approved-estimate summary join, but it follows the platform-standard page envelope (`page`, `pageSize`, `sortField`, `sortDir`) so it works with `DataTable` without custom pagination adapters.
- Search indexes only `construction_projects:construction_project`.
- Search strategies in v1: `fulltext` and `tokens`.
- `cost_estimate` and `cost_line_item` are not searchable entities because monetary data is sensitive.
- Report endpoints use DI-resolved `cacheService` with tenant-scoped keys and tag invalidation.
- Cache tags:
	- `tenant:<tenantId>`
	- `construction_projects`
	- `construction_projects:project`
	- `construction_projects:project:<projectId>`
	- `construction_projects:estimate`
	- `construction_projects:loss`
- permission-dependent financial fragments on project list/detail responses are not cached in v1; only report endpoints and non-financial summary joins are cached;
- cached financial report payloads are only produced for routes guarded by `construction_projects.report.view`, so cache keys do not mix redacted and non-redacted shapes.

Cache invalidation matrix:
- project create, update, archive, status change, deal link, and deal unlink invalidate `tenant:<tenantId>`, `construction_projects`, `construction_projects:project`, and `construction_projects:project:<projectId>`;
- estimate create, draft save, and archive invalidate `tenant:<tenantId>`, `construction_projects:estimate`, and `construction_projects:project:<projectId>`;
- estimate approve invalidates `tenant:<tenantId>`, `construction_projects`, `construction_projects:project`, `construction_projects:estimate`, and `construction_projects:project:<projectId>`;
- loss record creation invalidates `tenant:<tenantId>`, `construction_projects`, `construction_projects:loss`, and `construction_projects:project:<projectId>`.

### Performance Rules
- Project list `pageSize` is capped at `100`.
- Estimate graph save caps `lineItems.length` at `500` in v1; larger imports are deferred to a later worker-based phase.
- Margin and lost-reasons report `pageSize` is capped at `100` rows.
- Project list reads are designed to stay within three query groups: projects, latest approved estimate summaries, linked deal counts.
- Report sorting is deterministic by `(margin_percent, project_id)` or `(recorded_at, project_id)` to support stable pagination and caching.

## Data Models
Entity ids for registry and indexer coverage:
- `construction_projects:construction_project`
- `construction_projects:construction_project_deal`
- `construction_projects:cost_estimate`
- `construction_projects:cost_line_item`
- `construction_projects:construction_project_loss`

### Sensitive Data Classification & Encryption
- Plain searchable fields on `construction_project`: `project_code`, `name`, `project_type`, `status`, `description`, `site_city`, and `site_country_code`.
- Encrypted at rest and excluded from search: `construction_project.notes`, `construction_project.site_address`, `construction_project.site_postal_code`, `construction_project.site_latitude`, `construction_project.site_longitude`, `cost_estimate.notes`, `construction_project_loss.reason_details`, and `construction_project_loss.competitor_name`.
- Financial amount fields remain numeric database columns so reporting and sorting stay efficient, but they are excluded from search indexes, omitted from vector sources, and guarded strictly by route-level feature checks.
- Any read path that returns encrypted fields MUST use `findWithDecryption` / `findOneWithDecryption` with tenant- and organization-scoped options. Read paths that only need list/report summaries SHOULD avoid selecting encrypted columns.

### Monetary Precision & Rounding
- All currency amount fields use `decimal(19,4)` in v1.
- Quantity fields use `decimal(19,4)`.
- Percentage fields (`default_markup_percent`, `markup_percent`, `margin_percent`) use `decimal(9,4)`.
- Calculation steps retain 4-decimal precision through line-item and aggregate math. Persisted totals are rounded half-up to 4 decimal places.
- UI formatting may render fewer decimals according to currency display settings, but JSON/CSV payloads and stored values preserve the 4-decimal internal precision.

### ConstructionProject (Singular)
Table: `construction_projects`

- `id`: UUID PK
- `organization_id`: UUID required
- `tenant_id`: UUID required
- `project_code`: text required, unique per `(organization_id, tenant_id)`
- `name`: text required
- `project_type`: text nullable
- `status`: enum required
- `description`: text nullable
- `notes`: text nullable
- `site_address`: text nullable
- `site_city`: text nullable
- `site_postal_code`: text nullable
- `site_country_code`: text nullable
- `site_latitude`: decimal(10,6) nullable
- `site_longitude`: decimal(10,6) nullable
- `client_company_id`: UUID nullable
- `client_person_id`: UUID nullable
- `owner_user_id`: UUID nullable
- `planned_start_date`: date nullable
- `planned_end_date`: date nullable
- `actual_start_date`: date nullable
- `actual_end_date`: date nullable
- `estimated_revenue_amount`: decimal(19,4) nullable
- `latest_approved_estimate_id`: UUID nullable
- `created_at`: timestamptz required
- `updated_at`: timestamptz required
- `deleted_at`: timestamptz nullable

Indexes:
- `UNIQUE(organization_id, tenant_id, project_code)`
- `INDEX(organization_id, tenant_id, status, created_at)`
- `INDEX(organization_id, tenant_id, owner_user_id, status)`

Status enum:
- `draft`
- `planning`
- `offered`
- `won`
- `in_progress`
- `completed`
- `lost`
- `cancelled`

Validation rules:
- `name` length `1..200`
- at least one of `client_company_id` or `client_person_id` is recommended; required before leaving `draft`
- `planned_end_date >= planned_start_date` when both exist
- `actual_end_date >= actual_start_date` when both exist

Allowed status transitions in v1:
- `draft -> planning | cancelled`
- `planning -> offered | lost | cancelled`
- `offered -> planning | won | lost | cancelled`
- `won -> in_progress | lost | cancelled`
- `in_progress -> completed | cancelled`
- `completed` → no outgoing transitions (terminal)
- `lost` → no outgoing transitions (terminal)
- `cancelled` → no outgoing transitions (terminal)

### ConstructionProjectDeal (Singular)
Table: `construction_project_deals`

- `id`: UUID PK
- `organization_id`: UUID required
- `tenant_id`: UUID required
- `construction_project_id`: UUID required
- `deal_id`: UUID required
- `role`: enum required
- `linked_by_user_id`: UUID nullable
- `linked_at`: timestamptz required
- `created_at`: timestamptz required
- `updated_at`: timestamptz required
- `deleted_at`: timestamptz nullable

Role enum:
- `primary`
- `variant`
- `follow_up`
- `subcontract`

Indexes:
- `UNIQUE(organization_id, tenant_id, deal_id) WHERE deleted_at IS NULL`
- `UNIQUE(organization_id, tenant_id, construction_project_id, deal_id) WHERE deleted_at IS NULL`
- `UNIQUE(organization_id, tenant_id, construction_project_id) WHERE role = 'primary' AND deleted_at IS NULL`
- `INDEX(organization_id, tenant_id, construction_project_id, linked_at)`

> **Implementation note**: The `UNIQUE(...) WHERE role = 'primary' AND deleted_at IS NULL` partial unique index cannot be generated automatically from a standard MikroORM `@Unique` decorator in v7. The generated migration file must be edited to add this index as raw SQL; otherwise the database-level single-`primary`-per-project enforcement will be absent. Copy-pasteable SQL:
> ```sql
> CREATE UNIQUE INDEX CONCURRENTLY "idx_cpd_unique_primary"
> ON "construction_project_deals" ("organization_id", "tenant_id", "construction_project_id")
> WHERE role = 'primary' AND deleted_at IS NULL;
> ```

This entity preserves the chosen `1:N` rule while keeping the core `deal` entity untouched.

Validation rules:
- a project may have at most one `primary` deal link;
- `offered`, `won`, and `in_progress` projects must keep at least one `primary` link unless the status changes in a prior command.

### CostEstimate (Singular)
Table: `cost_estimates`

- `id`: UUID PK
- `organization_id`: UUID required
- `tenant_id`: UUID required
- `construction_project_id`: UUID required
- `version_no`: integer required
- `revision`: integer required, optimistic concurrency counter
- `name`: text required
- `status`: enum required
- `currency_code`: text required
- `default_markup_percent`: decimal(9,4) nullable
- `notes`: text nullable
- `total_cost_amount`: decimal(19,4) required, computed
- `total_sale_amount`: decimal(19,4) required, computed
- `margin_amount`: decimal(19,4) required, computed
- `margin_percent`: decimal(9,4) required, computed
- `source_estimate_id`: UUID nullable
- `approved_by_user_id`: UUID nullable
- `approved_at`: timestamptz nullable
- `created_by_user_id`: UUID nullable
- `created_at`: timestamptz required
- `updated_at`: timestamptz required
- `archived_at`: timestamptz nullable

Status enum:
- `draft`
- `approved`
- `superseded`
- `archived`

Indexes:
- `UNIQUE(organization_id, tenant_id, construction_project_id, version_no)`
- `INDEX(organization_id, tenant_id, construction_project_id, status, updated_at)`
- `INDEX(organization_id, tenant_id, approved_at)`

Lifecycle invariants:
- `version_no` is assigned by selecting the next project-scoped version under lock inside the create transaction;
- at most one estimate may have status `approved` for a given project at any time;
- approval always supersedes the previously approved estimate in the same transaction that updates `latest_approved_estimate_id`.

Calculation rules:
- `effective_markup_percent = line_item.markup_percent ?? estimate.default_markup_percent ?? 0`
- `line_total_cost_amount = quantity * unit_cost_amount`
- `line_total_sale_amount = line_total_cost_amount * (1 + effective_markup_percent / 100)`
- `margin_amount = total_sale_amount - total_cost_amount`
- `margin_percent = margin_amount / NULLIF(total_sale_amount, 0) * 100`

### CostLineItem (Singular)
Table: `cost_line_items`

- `id`: UUID PK
- `organization_id`: UUID required
- `tenant_id`: UUID required
- `cost_estimate_id`: UUID required
- `sort_order`: integer required
- `category`: enum required
- `description`: text required
- `unit`: text required
- `quantity`: decimal(19,4) required
- `unit_cost_amount`: decimal(19,4) required
- `markup_percent`: decimal(9,4) nullable
- `notes`: text nullable
- `total_cost_amount`: decimal(19,4) required, computed
- `total_sale_amount`: decimal(19,4) required, computed
- `created_at`: timestamptz required
- `updated_at`: timestamptz required
- `deleted_at`: timestamptz nullable

Category enum:
- `materials`
- `labor`
- `equipment`
- `subcontract`
- `overhead`
- `other`

Indexes:
- `INDEX(organization_id, tenant_id, cost_estimate_id, sort_order) WHERE deleted_at IS NULL`

Validation rules:
- `quantity > 0`
- `unit_cost_amount >= 0`
- `markup_percent >= 0` when present
- maximum `500` line items per estimate in v1

### ConstructionProjectLoss (Singular)
Table: `construction_project_losses`

- `id`: UUID PK
- `organization_id`: UUID required
- `tenant_id`: UUID required
- `construction_project_id`: UUID required
- `deal_id`: UUID nullable
- `reason_code`: enum required
- `reason_details`: text required
- `competitor_name`: text nullable
- `recorded_by_user_id`: UUID nullable
- `recorded_at`: timestamptz required
- `created_at`: timestamptz required
- `updated_at`: timestamptz required

Reason enum:
- `price`
- `timeline`
- `competition`
- `scope_mismatch`
- `financing`
- `client_changed_requirements`
- `internal_capacity`
- `other`

Indexes:
- `INDEX(organization_id, tenant_id, construction_project_id, recorded_at)`
- `INDEX(organization_id, tenant_id, reason_code, recorded_at)`

Loss records are append-only. Reports use the latest loss record per project in the selected period.

> **Design note**: `construction_project_loss` intentionally omits the standard `deleted_at` soft-delete column. These records are immutable audit entries by design. Incorrect records can be superseded by a subsequent `project.change_status` re-record (where the status allows it); an admin-only loss-archive command is planned for v2.

## API Contracts
All routes must export `openApi`. Write routes use command handlers and mutation guards.

### Authentication & Field Visibility
All routes require `requireAuth: true`.

| Route family | Required features | Financial field behavior |
|-------------|-------------------|--------------------------|
| Project list/detail | `construction_projects.view` | `latestApprovedEstimate`, margin values, and estimate totals are returned only when the caller also has one of `construction_projects.estimate.manage`, `construction_projects.estimate.approve`, or `construction_projects.report.view`; otherwise the same keys remain present and the financial values are `null`. |
| Project create | `construction_projects.create` | n/a |
| Project update | `construction_projects.update` | n/a |
| Project archive | `construction_projects.delete` | n/a |
| Deal link/unlink | `construction_projects.deal.link` | n/a |
| Estimate list/detail | one of `construction_projects.estimate.manage`, `construction_projects.estimate.approve`, `construction_projects.report.view` | full estimate financials are available |
| Estimate create/save/archive | `construction_projects.estimate.manage` | full estimate financials are available |
| Estimate approve | `construction_projects.estimate.approve` | full estimate financials are available |
| Margin and lost-reasons reports | `construction_projects.report.view` | full report financials are available |

HTTP error conventions:
- `403` for missing feature access;
- `404` when the project, estimate, or link does not exist in the caller's tenant and organization scope;
- `409` for business-rule conflicts such as duplicate deal assignment, invalid status transition, missing replacement `primary` deal, or approval race;
- `412` for stale estimate `revision` values during graph save.

### Project List
`GET /api/construction-projects`

Query:
```json
{
	"q": "warehouse",
	"status": ["planning", "offered"],
	"ownerUserId": "uuid",
	"projectType": "residential",
	"dealId": "uuid",
	"page": 1,
	"pageSize": 50,
	"sortField": "createdAt",
	"sortDir": "desc"
}
```

Response:
```json
{
	"items": [
		{
			"id": "uuid",
			"projectCode": "CP-2026-001",
			"name": "North Estate Phase A",
			"status": "offered",
			"projectType": "residential",
			"ownerUserId": "uuid",
			"latestApprovedEstimate": {
				"id": "uuid",
				"marginPercent": 14.25,
				"totalSaleAmount": 2400000
			},
			"linkedDealCount": 2
		}
	],
	"total": 124,
	"page": 1,
	"pageSize": 50,
	"totalPages": 3
}
```

Rules:
- the route is custom because it joins permission-aware approved-estimate summaries, but it follows the platform-standard page envelope so backend `DataTable` pages can use it directly;
- `latestApprovedEstimate` is returned as `null` when the caller lacks estimate/report access.

### Project Create
`POST /api/construction-projects`

Request:
```json
{
	"projectCode": "CP-2026-001",
	"name": "North Estate Phase A",
	"projectType": "residential",
	"clientCompanyId": "uuid",
	"ownerUserId": "uuid",
	"siteAddress": "ul. Przemyslowa 10, Krakow",
	"plannedStartDate": "2026-06-01",
	"plannedEndDate": "2027-03-31",
	"estimatedRevenueAmount": 2400000,
	"description": "Mixed-use development"
}
```

Response:
```json
{
	"ok": true,
	"id": "uuid"
}
```

### Project Detail
`GET /api/construction-projects/:id`

Response includes:
- project summary;
- linked deals with role and timestamps;
- estimate revision list with stable keys for `id`, `versionNo`, `status`, `revision`, `updatedAt`, `totalCostAmount`, `totalSaleAmount`, `marginAmount`, and `marginPercent`; financial fields are `null` when the caller lacks estimate/report access;
- `latestApprovedEstimate` key is always present and is `null` when the caller lacks estimate/report access or when no approved estimate exists;
- `latestLossRecord` key is always present and is `null` when no loss record exists.

### Project Update
`PATCH /api/construction-projects/:id`

Request accepts editable project fields only. Status change is not allowed through this route.

### Project Archive
`DELETE /api/construction-projects/:id`

Request:
```json
{
	"confirmArchiveApprovedEstimates": true
}
```

Behavior:
- soft-delete project record;
- reject with `409` when the project still has approved estimates unless `confirmArchiveApprovedEstimates = true` is supplied;
- invalidate project and report caches.

### Project Status Change
`POST /api/construction-projects/:id/status`

Request:
```json
{
	"status": "lost",
	"note": "Client selected another general contractor",
	"loss": {
		"dealId": "uuid",
		"reasonCode": "price",
		"reasonDetails": "Competitor came in 8% lower",
		"competitorName": "BuildMax"
	}
}
```

Rules:
- `loss` object is required when `status = lost`;
- request is rejected if `status = lost` without structured loss payload;
- request is rejected with `409` when leaving `draft` without `clientCompanyId` or `clientPersonId` already set on the project;
- request is rejected with `409` when entering `offered`, `won`, or `in_progress` without at least one active `primary` deal link;
- request is rejected with `409` for transitions outside the allowed v1 status matrix;
- `note` is audit metadata for the command log and status history and is not indexed for search;
- `lost` is terminal in v1; there is no public reopen route or UI workflow.

### Deal Link
`POST /api/construction-projects/:id/deals`

Request:
```json
{
	"dealId": "uuid",
	"role": "primary"
}
```

Rules:
- reject with `409` when `dealId` is already linked to another project;
- reject with `409` when `role = primary` and the project already has another primary deal link;
- reject with `409` when the resulting active-link set would violate the status-dependent primary-link invariant;
- verify deal existence via a raw Knex query against the `customer_deals` table (no ORM entity class from the `customers` module is imported): `em.getKnex().select('id').from('customer_deals').where({ id: dealId, deleted_at: null, tenant_id: tenantId, organization_id: organizationId }).first()`.

### Deal Unlink
`DELETE /api/construction-projects/:id/deals/:linkId`

Rules:
- reject unlink when it would remove the last `primary` link from a project in `offered`, `won`, or `in_progress`; caller must first add a replacement `primary` link or change project status in a prior command;
- unlink soft-deletes the row; undo restores the same link row id.

### Estimate List
`GET /api/construction-projects/:id/estimates`

Response returns revision summaries ordered by `version_no DESC`.

Each item includes `id`, `versionNo`, `status`, `revision`, `updatedAt`, and financial totals.

### Estimate Create
`POST /api/construction-projects/:id/estimates`

Request:
```json
{
	"name": "Tender Estimate v2",
	"cloneFromEstimateId": "uuid",
	"defaultMarkupPercent": 12.5
}
```

Behavior:
- creates a new `draft` estimate;
- if `cloneFromEstimateId` is provided, copies line items and notes into the new draft;
- `currencyCode` is resolved by a raw Knex query: `em.getKnex().select('code').from('currencies').where({ is_base: true, is_active: true, tenant_id: tenantId, organization_id: organizationId }).first()` — no ORM entity class from the `currencies` module is imported;
- request fails with `409` when tenant base currency cannot be resolved;
- `versionNo` is allocated transactionally under project lock.

Response:
```json
{
	"ok": true,
	"id": "uuid",
	"versionNo": 2
}
```

### Estimate Detail
`GET /api/construction-projects/:id/estimates/:estimateId`

Response:
```json
{
	"estimate": {
		"id": "uuid",
		"versionNo": 2,
		"revision": 7,
		"status": "draft",
		"currencyCode": "PLN",
		"defaultMarkupPercent": 12.5,
		"totalCostAmount": 1800000,
		"totalSaleAmount": 2025000,
		"marginAmount": 225000,
		"marginPercent": 11.11
	},
	"lineItems": [
		{
			"id": "uuid",
			"sortOrder": 10,
			"category": "materials",
			"description": "Concrete C30/37",
			"unit": "m3",
			"quantity": 600,
			"unitCostAmount": 420,
			"markupPercent": 8,
			"totalCostAmount": 252000,
			"totalSaleAmount": 272160
		}
	]
}
```

### Estimate Draft Graph Save
`PATCH /api/construction-projects/:id/estimates/:estimateId`

Request:
```json
{
	"revision": 7,
	"name": "Tender Estimate v2",
	"defaultMarkupPercent": 12.5,
	"notes": "Updated subcontract assumptions",
	"lineItems": [
		{
			"id": "uuid-or-null",
			"sortOrder": 10,
			"category": "materials",
			"description": "Concrete C30/37",
			"unit": "m3",
			"quantity": 600,
			"unitCostAmount": 420,
			"markupPercent": 8,
			"notes": null
		}
	]
}
```

Rules:
- full graph save reconciles the current draft line-item set transactionally: matching ids update in place, missing active ids are soft-deleted, and `id = null` rows are inserted as new line items;
- optimistic concurrency enforced by `revision`;
- approved or archived estimates cannot be patched;
- validation rejects more than `500` line items;
- line item ids from another estimate are rejected with `400`;
- stale `revision` returns `412` with the latest persisted `revision` in the error payload.

### Estimate Approve
`POST /api/construction-projects/:id/estimates/:estimateId/approve`

Rules:
- requires approval feature;
- only `draft` estimates can be approved;
- marks older approved estimate for the project as `superseded`;
- updates `construction_project.latest_approved_estimate_id` in the same transaction;
- acquires project-scoped approval lock and returns `409` if another approval succeeds first;
- emits `construction_projects.estimate.approved`.

### Estimate Archive
`DELETE /api/construction-projects/:id/estimates/:estimateId`

Rules:
- only `draft` or `superseded` estimates can be archived in v1;
- the currently approved estimate cannot be archived; the caller must first approve a replacement draft (which automatically moves the current estimate to `superseded`), then archive the now-`superseded` estimate.

### Margin Report
`GET /api/reports/construction-projects/margins`

Query:
```json
{
	"status": ["offered", "won", "in_progress"],
	"ownerUserId": "uuid",
	"projectType": "residential",
	"dateFrom": "2026-01-01",
	"dateTo": "2026-12-31",
	"page": 1,
	"pageSize": 10,
	"sortField": "marginPercent",
	"sortDir": "desc",
	"format": "json"
}
```

Rules:
- uses latest approved estimate per project only;
- max `pageSize = 100`;
- v1 supports `json` and `csv`; PDF is deferred.
- JSON responses use the stable list envelope `{ items, total, page, pageSize, totalPages, summary }`;
- CSV responses export the full filtered result set using the active filters and sort order, ignoring the request page window;
- CSV export is capped at 10 000 rows; requests exceeding this cap return `400` with a descriptive error message;
- CSV columns in v1: `projectCode`, `name`, `status`, `projectType`, `ownerUserId`, `estimateVersionNo`, `currencyCode`, `totalCostAmount`, `totalSaleAmount`, `marginAmount`, `marginPercent`, `approvedAt`;
- when the caller lacks financial access, this route is not reachable rather than returning a redacted dataset.

### Lost Reasons Report
`GET /api/reports/construction-projects/lost-reasons`

Query:
```json
{
	"groupBy": "reasonCode",
	"projectType": "residential",
	"ownerUserId": "uuid",
	"dateFrom": "2026-01-01",
	"dateTo": "2026-12-31",
	"page": 1,
	"pageSize": 25,
	"sortField": "recordedAt",
	"sortDir": "desc",
	"format": "json"
}
```

Rules:
- groups by `reason_code` or month in v1;
- JSON responses use the stable list envelope `{ items, total, page, pageSize, totalPages, summary }`, where `summary` contains aggregate buckets for the chosen grouping;
- CSV responses export the full filtered result set using the active filters and sort order, ignoring the request page window;
- CSV export is capped at 10 000 rows; requests exceeding this cap return `400` with a descriptive error message;
- CSV columns in v1: `projectCode`, `name`, `status`, `projectType`, `ownerUserId`, `dealId`, `reasonCode`, `reasonDetails`, `competitorName`, `recordedAt`;
- uses cache tags invalidated by status changes and loss records.

## Internationalization (i18n)
- Locale namespace: `construction_projects`.
- All user-facing strings ship in `en` and `pl` in the same phase.
- Status, loss reason, category, actions, flash messages, report labels, and column headers use translation keys.
- No hard-coded UI strings in pages, forms, dialogs, or notifications.

Key families:
- `construction_projects.nav.*`
- `construction_projects.page.list.*`
- `construction_projects.page.detail.*`
- `construction_projects.form.project.*`
- `construction_projects.form.estimate.*`
- `construction_projects.status.*`
- `construction_projects.loss_reason.*`
- `construction_projects.report.margin.*`
- `construction_projects.report.loss.*`
- `construction_projects.flash.*`
- `construction_projects.notifications.*`

`translations.ts` declares translatable entity fields for project and estimate user-facing text so the translation manager can attach to edit pages.

## UI/UX
### Backend Pages
- `/backend/construction-projects` shows summary KPI cards and a `DataTable` project list.
- `/backend/construction-projects/create` and `/backend/construction-projects/[id]/edit` use `CrudForm` with grouped sections.
- `/backend/construction-projects/[id]` is a detail page with `FormHeader` detail mode and tabs:
	- Overview
	- Estimates
	- Linked Deals
	- Loss Analysis
- `/backend/construction-projects/[id]/estimates/[estimateId]` hosts the custom estimate editor.
- `/backend/construction-projects/reports/margins` and `/backend/construction-projects/reports/lost-reasons` are report pages with filters, summary cards, and `DataTable` outputs.
- every routable backend page ships a sibling `page.meta.ts` declaring `requireAuth`, `requireFeatures`, titles, grouping, and breadcrumb metadata.

Page metadata and feature guards:
- list and detail pages require `construction_projects.view`;
- create page requires `construction_projects.create`;
- edit page requires `construction_projects.update`;
- estimate editor page requires one of `construction_projects.estimate.manage`, `construction_projects.estimate.approve`, or `construction_projects.report.view`, with the approve action itself shown only for `construction_projects.estimate.approve`;
- report pages require `construction_projects.report.view`.

### Project Form
Project form sections:
- Identity: code, name, type, owner
- Client: company/person references
- Site: address and coordinates
- Timeline: planned/actual dates
- Commercial: estimated revenue
- Notes

`CrudForm` handles create/edit validation and standard save/delete actions.

### Estimate Editor
The estimate editor is a custom page, not a `CrudForm`, because it edits a graph aggregate.

Requirements:
- use `useGuardedMutation(...).runMutation(...)` for every draft save and approval action;
- keyboard support: `Cmd/Ctrl+Enter` save, `Escape` close dialogs;
- editable line-item table with category, description, unit, quantity, unit cost, markup, and totals;
- sticky summary panel showing total cost, total sale, margin amount, and margin percent;
- read-only mode for approved estimates;
- viewers with read-only financial access can open the page, but write controls remain hidden unless they have `construction_projects.estimate.manage`;
- optimistic concurrency conflict banner on stale `revision`.

### Lost Reason Flow
- Marking project as `lost` opens a dedicated dialog or side panel using shared dialog patterns.
- Dialog requires reason code and details before submit.
- No raw `window.confirm`; use shared confirm/dialog primitives only.

### Design-System Constraints
- Use `DataTable`, `CrudForm`, `LoadingMessage`, `ErrorMessage`, `FormHeader`, and shared button/checkbox/dialog primitives.
- No hardcoded Tailwind status colors or arbitrary spacing tokens.
- Sensitive margin visuals use semantic tokens and permission-aware rendering.

## Configuration
### ACL
Feature ids:
- `construction_projects.view`
- `construction_projects.create`
- `construction_projects.update`
- `construction_projects.delete`
- `construction_projects.deal.link`
- `construction_projects.estimate.manage`
- `construction_projects.estimate.approve`
- `construction_projects.report.view`

Default role features in `setup.ts`:
- `superadmin`: `construction_projects.*`
- `admin`: `construction_projects.*`
- `employee`: `construction_projects.view`, `construction_projects.create`, `construction_projects.update`, `construction_projects.deal.link`, `construction_projects.estimate.manage`

Approval and reporting remain add-on features for custom roles or admin users.

### Search
`search.ts` config:
- entity: `construction_projects:construction_project`
- default strategies: `fulltext`, `tokens`
- `fieldPolicy.searchable`: `project_code`, `name`, `project_type`, `site_city`, `site_country_code`, `description`
- `fieldPolicy.excluded`: `site_address`, `site_postal_code`, `site_latitude`, `site_longitude`, `notes`, `estimated_revenue_amount`, `latest_approved_estimate_id`, all cost- and margin-derived fields, client-linked ids, and private loss details
- `formatResult`: title `project_code + name`, subtitle `status + site_city`, badge `construction_projects.search.badge`
- no `vector` strategy or `buildSource` output in v1, so no cost or estimate narrative is embedded outside the database-backed search engines
- search result presenters never expose totals, margin percentages, or private notes.

### Notifications
`notifications.ts` declares:
- `construction_projects.estimate.approved` with title/body keys under `construction_projects.notifications.estimateApproved.*`, severity `success`, and recipient resolution for project owner plus the estimate creator when they are still active in the tenant;
- `construction_projects.project.lost` with title/body keys under `construction_projects.notifications.projectLost.*`, severity `warning`, and recipient resolution for project owner and tenant admins;
- both types define explicit `expiresAfterHours` values and standard action labels;
- `notifications.client.ts` is optional in v1 and only needed if the default renderer proves insufficient.

Renderers live in `notifications.client.ts` if client customization becomes necessary; v1 can use standard notification rendering if shape remains simple.

### Setup & Operations
- Enable the module in `apps/mercato/src/modules.ts`.
- The module assumes `currencies` is enabled and that each tenant/organization scope has exactly one active base currency row where `isBase = true`; estimate creation fails closed when that precondition is not met.
- **`currencies` is a required module dependency.** Operators who disable `currencies` after enabling `construction_projects` will find estimate creation returning `409`. Inside `setup.ts > onTenantCreated`, log a clear operational warning when no active base currency exists for the tenant so the misconfiguration is visible early.
- **`search` module dependency**: The `search` module must be enabled for project full-text and token search to function. If `search` is disabled, project indexing is silently skipped but core CRUD functions normally.
- Register all 8 encrypted fields in `apps/mercato/src/modules/entities/lib/encryptionDefaults.ts` before running migrations (see Phase 1, step 3).
- Run `yarn generate` after adding module files, `events.ts`, `search.ts`, or `ce.ts`.
- Run `yarn db:generate` after entity changes. After generating, manually add the partial unique index SQL for `construction_project_deals` (see the implementation note in the ConstructionProjectDeal section).
- Run `yarn mercato configs cache structural --all-tenants` after enabling the module or adding backend navigation pages.

## Migration & Backward Compatibility
- This is an additive app-module rollout; no existing core route, import path, or event id is changed.
- No cross-module database columns are added to `customers` or `sales`.
- Contract surfaces 1-13 remain additive-only: no existing auto-discovery files, public types, function signatures, widget spots, DI keys, ACL feature ids, notification types, CLI commands, or generated-file exports are renamed or removed.
- Backward compatibility risk is low because the module introduces new entities and routes only.
- Existing tenants receive empty module state; no historical backfill is required.
- `construction_project_deal` preserves the chosen `1:N` rule without forcing schema changes into core modules.
- Currency integration remains backward-compatible because v1 already stores `currency_code` on estimates; future phases may allow non-base currencies without rewriting historical rows.

## Implementation Plan
### Phase 1: Module Skeleton & Data Layer
1. Create `construction_projects` app module with `index.ts`, `acl.ts`, `setup.ts`, `events.ts`, `search.ts`, `notifications.ts`, and `translations.ts`. No `ce.ts` (no custom field sets in v1); no `di.ts` (no DI services to register — the base-currency operational check is placed inside `setup.ts > onTenantCreated`).
2. Add entity definitions, validators, encryption defaults, precision rules, and migrations for `construction_project`, `construction_project_deal`, `cost_estimate`, `cost_line_item`, and `construction_project_loss`.
3. Register all 8 encrypted fields (`construction_project.notes`, `construction_project.site_address`, `construction_project.site_postal_code`, `construction_project.site_latitude`, `construction_project.site_longitude`, `cost_estimate.notes`, `construction_project_loss.reason_details`, `construction_project_loss.competitor_name`) in `apps/mercato/src/modules/entities/lib/encryptionDefaults.ts` so the platform encryption layer handles them transparently.
4. Register the module in `apps/mercato/src/modules.ts`, run `yarn generate`, then purge structural config cache.

### Phase 2: Project CRUD & Deal Linkage
1. Implement project CRUD commands and routes using `makeCrudRoute` where appropriate, and keep the custom project list route on the standard page-based envelope. Create `commands/index.ts` barrel importing all command files. Create `commands/shared.ts` with `emitProjectQueryIndexEvents` helper following the pattern in `packages/core/src/modules/customers/commands/shared.ts`. Create a central `api/openapi.ts` factory helper following the customers module pattern.
2. Build backend list, create, edit, and detail pages using `DataTable`, `CrudForm`, `ConstructionProjectForm.tsx` component, shared detail primitives, and sibling `page.meta.ts` files. Add `widgets/injection-table.ts` with a `menu:sidebar:main` entry (headless widget at `widgets/injection/construction-projects-menus/`) so the module appears in the admin sidebar navigation.
3. Implement link/unlink deal commands with uniqueness enforcement and integration tests.
4. Add N+1 guard: the project list endpoint MUST resolve estimate summaries via a single JOIN or a single IN-lookup keyed by `latest_approved_estimate_id`, not per-row ORM eager-loading.

### Phase 3: Estimate Aggregate & Approval Flow
1. Implement estimate create, clone, draft graph save, archive, and approve commands.
2. Add estimate editor UI with guarded mutations and optimistic concurrency handling.
3. Persist latest approved estimate pointer on project in the same transaction as approval.

### Phase 4: Loss Capture, Reports, Notifications, Search
1. Implement `lost` status command path with mandatory loss payload.
2. Build margin and lost-reason report endpoints with cache tags, stable JSON envelopes, and explicit CSV export contracts.
3. Add search indexing, notification subscribers (`estimate-approved-notification.ts`, `project-lost-notification.ts`), and the consolidated cache-invalidation subscriber (`project-lifecycle-cache-invalidation.ts`).
4. Create `components/LossReasonDialog.tsx` for the status-change dialog.

### Phase 5: Tests, Polish, and Documentation
1. Add unit tests for estimate calculations and status/loss validation.
2. Add integration tests for CRUD, estimate approval, deal uniqueness, ACL, reports, and cache invalidation.
3. Finalize translations, page metadata, and operator docs.

### File Manifest
| File | Action | Purpose |
|------|--------|---------|
| `apps/mercato/src/modules/construction_projects/index.ts` | Create | Module metadata (MUST `import './commands/index'`) |
| `apps/mercato/src/modules/construction_projects/acl.ts` | Create | Feature declarations |
| `apps/mercato/src/modules/construction_projects/setup.ts` | Create | Default role features |
| `apps/mercato/src/modules/construction_projects/events.ts` | Create | Typed event declarations |
| `apps/mercato/src/modules/construction_projects/notifications.ts` | Create | Notification type definitions (type IDs are FROZEN once deployed) |
| `apps/mercato/src/modules/construction_projects/search.ts` | Create | Search config |
| `apps/mercato/src/modules/construction_projects/translations.ts` | Create | Translatable field declarations |
| `apps/mercato/src/modules/construction_projects/data/entities.ts` | Create | MikroORM entities |
| `apps/mercato/src/modules/construction_projects/data/validators.ts` | Create | Zod schemas |
| `apps/mercato/src/modules/construction_projects/commands/index.ts` | Create | Command auto-import barrel |
| `apps/mercato/src/modules/construction_projects/commands/shared.ts` | Create | `emitProjectQueryIndexEvents` helper + scope utilities |
| `apps/mercato/src/modules/construction_projects/commands/projects.ts` | Create | Project commands |
| `apps/mercato/src/modules/construction_projects/commands/estimates.ts` | Create | Estimate commands |
| `apps/mercato/src/modules/construction_projects/api/openapi.ts` | Create | Central OpenAPI factory helper |
| `apps/mercato/src/modules/construction_projects/components/ConstructionProjectForm.tsx` | Create | Shared project form (used by create and edit pages) |
| `apps/mercato/src/modules/construction_projects/components/EstimateEditor.tsx` | Create | Estimate editor component |
| `apps/mercato/src/modules/construction_projects/components/EstimateSummaryCard.tsx` | Create | Estimate summary card for detail page |
| `apps/mercato/src/modules/construction_projects/components/LossReasonDialog.tsx` | Create | Dialog for capturing loss reason on status change |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/page.meta.ts` | Create | List page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/page.tsx` | Create | List page |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/create/page.meta.ts` | Create | Create page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/create/page.tsx` | Create | Create page |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/page.meta.ts` | Create | Detail page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/page.tsx` | Create | Detail page |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/edit/page.meta.ts` | Create | Edit page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/edit/page.tsx` | Create | Edit page |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/estimates/[estimateId]/page.meta.ts` | Create | Estimate editor metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/[id]/estimates/[estimateId]/page.tsx` | Create | Estimate editor |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/reports/margins/page.meta.ts` | Create | Margin report page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/reports/margins/page.tsx` | Create | Margin report page |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/reports/lost-reasons/page.meta.ts` | Create | Lost-reasons report page metadata |
| `apps/mercato/src/modules/construction_projects/backend/construction-projects/reports/lost-reasons/page.tsx` | Create | Lost-reasons report page |
| `apps/mercato/src/modules/construction_projects/subscribers/estimate-approved-notification.ts` | Create | Sends estimate-approved in-app notification |
| `apps/mercato/src/modules/construction_projects/subscribers/project-lost-notification.ts` | Create | Sends project-lost in-app notification |
| `apps/mercato/src/modules/construction_projects/subscribers/project-lifecycle-cache-invalidation.ts` | Create | Handles all cache tag invalidation across all module events |
| `apps/mercato/src/modules/construction_projects/widgets/injection-table.ts` | Create | Widget-to-slot mappings including `menu:sidebar:main` sidebar navigation |
| `apps/mercato/src/modules/construction_projects/widgets/injection/construction-projects-menus/widget.ts` | Create | Headless sidebar menu injection widget |
| `apps/mercato/src/modules/construction_projects/widgets/injection/construction-projects-menus/widget.meta.ts` | Create | Menu widget metadata |
| `apps/mercato/src/modules/construction_projects/commands/__tests__/estimate-calculations.test.ts` | Create | Unit tests for margin/markup calculation formulas |
| `apps/mercato/src/modules/construction_projects/commands/__tests__/status-transitions.test.ts` | Create | Unit tests for status transition guards and loss-required rules |
| `apps/mercato/src/modules/construction_projects/commands/__tests__/revision-conflicts.test.ts` | Create | Unit tests for optimistic revision conflict handling |
| `apps/mercato/src/modules/construction_projects/__integration__/construction-projects-crud.spec.ts` | Create | CRUD, ACL, and deal-link integration tests |
| `apps/mercato/src/modules/construction_projects/__integration__/construction-projects-estimates.spec.ts` | Create | Estimate workflow integration tests |
| `apps/mercato/src/modules/construction_projects/__integration__/construction-projects-reports.spec.ts` | Create | Report endpoints, CSV export, and cache isolation tests |
| `apps/mercato/src/modules/entities/lib/encryptionDefaults.ts` | Modify | Register 8 encrypted fields for platform-layer encryption |
| `apps/mercato/src/modules.ts` | Modify | Enable the app module |

### Testing Strategy
- Unit tests for calculation formulas, graph-save validation, optimistic revision conflicts, and loss-required rules.
- Integration tests for:
	- project CRUD and ACL
	- deal link uniqueness across projects
	- single-`primary` deal enforcement on one project
	- estimate create, clone, save, approve, and archive
	- approval race handling and version allocation under concurrent draft creation
	- lost status command and report visibility
	- margin report correctness using latest approved estimate only
	- field redaction on project list/detail for users without estimate/report access, with stable nullable keys
	- project-list and report pagination compatibility with `DataTable`
	- CSV export semantics for both report endpoints
	- `409` when estimate creation is attempted without a configured tenant base currency
	- cache invalidation after estimate approval and loss recording
	- tenant-scoped cache isolation for margin and loss reports
- Search smoke test for project indexing and permission-safe presentation.

## Risks & Impact Review
### Data Integrity Failures
- Estimate draft saves are atomic graph writes guarded by optimistic `revision`.
- Status change to `lost` and loss-record creation occur in one compound command.
- Deal linkage uses a unique constraint on `deal_id` to prevent one deal landing in multiple projects.

### Cascading Failures & Side Effects
- Notifications, cache invalidation, and indexing run through subscribers and must remain idempotent.
- No subscriber mutates `customers` or `sales`, reducing the blast radius of subscriber failure.

### Tenant & Data Isolation Risks
- Every entity is explicitly scoped by `tenant_id` and `organization_id`.
- Cache keys and tags are tenant-scoped.
- Search excludes cost and sensitive fields to avoid leakage through global search.

### Migration & Deployment Risks
- Rollout is additive-only.
- No data backfill is required.
- Structural cache must be purged after enabling module pages to avoid stale navigation.

### Operational Risks
- Estimate saves with too many line items can grow expensive; v1 caps graph size at `500`.
- Margin reports can become hot endpoints for management dashboards; cache and indexing are required from the start.

### Risk Register
#### Duplicate Deal Assignment
- **Scenario**: Two users try to link the same deal to different construction projects at nearly the same time.
- **Severity**: High
- **Affected area**: Project linkage, detail pages, commercial traceability
- **Mitigation**: Enforce `UNIQUE(organization_id, tenant_id, deal_id)` and surface `409` conflict from the command layer.
- **Residual risk**: Users may still choose the wrong project first; correction requires explicit unlink and relink.

#### Stale Estimate Totals
- **Scenario**: Parent estimate totals diverge from line items because updates land partially or concurrently.
- **Severity**: Critical
- **Affected area**: Margin reporting, approval workflow, portfolio analytics
- **Mitigation**: Draft editing uses graph-save semantics in one transaction with optimistic `revision` checks; totals are always recomputed server-side.
- **Residual risk**: Users can still overwrite newer drafts if they ignore conflict prompts and manually retry with outdated assumptions.

#### Lost Status Without Analytics Data
- **Scenario**: A project is marked `lost` without a structured reason, making reports incomplete.
- **Severity**: High
- **Affected area**: Loss analytics, management reporting, process auditability
- **Mitigation**: `project.change_status` requires nested `loss` payload whenever status becomes `lost`.
- **Residual risk**: Users can still choose `other` with weak details; management process must enforce reporting discipline.

#### Cross-Tenant Cache Leakage
- **Scenario**: Cached report data is reused across tenants because keys or tags are not scoped correctly.
- **Severity**: Critical
- **Affected area**: Margin reports, loss reports, dashboard summaries
- **Mitigation**: All cache keys include `tenantId`; tags include tenant-specific prefixes; no cache entry stores unsafely shared global keys.
- **Residual risk**: Misimplementation in a future route could bypass conventions; integration tests must assert tenant isolation.

#### Unauthorized Cost Exposure Through Search
- **Scenario**: Sensitive estimate content appears in global search or search indexes.
- **Severity**: High
- **Affected area**: Search results, privacy, internal commercial confidentiality
- **Mitigation**: Only `construction_project` is indexed; `cost_estimate` and `cost_line_item` are excluded from search; project search config excludes cost fields and private notes.
- **Residual risk**: Project descriptions may still contain sensitive copy if users type it there; operator guidance and future content linting can reduce this.

#### Report Latency on Large Tenants
- **Scenario**: Margin or loss reports become slow when a tenant accumulates many projects and estimate revisions.
- **Severity**: Medium
- **Affected area**: Report pages, dashboards, API latency
- **Mitigation**: Use latest-approved-estimate-only queries, supporting indexes, report cache, and `limit <= 100`.
- **Residual risk**: Historical export and broader analytics will still need a phase-2 read model or worker-generated snapshots.

#### Approval Undo Ambiguity
- **Scenario**: An approved estimate is superseded and a user attempts to undo an earlier approval after downstream decisions were made.
- **Severity**: Medium
- **Affected area**: Audit history, estimate lifecycle, management trust
- **Mitigation**: Approval undo is only allowed while no newer approved estimate exists; otherwise the system records compensating archive/supersede actions instead of destructive rollback.
- **Residual risk**: Operators must understand that not every approval can be fully reversed once business decisions have moved on.

## Final Compliance Report — 2026-05-07

### AGENTS.md Files Reviewed
- `AGENTS.md` (root)
- `.ai/specs/AGENTS.md`
- `packages/core/AGENTS.md`
- `packages/core/src/modules/customers/AGENTS.md`
- `packages/core/src/modules/sales/AGENTS.md`
- `packages/ui/AGENTS.md`
- `packages/search/AGENTS.md`
- `packages/events/AGENTS.md`
- `packages/cache/AGENTS.md`

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root `AGENTS.md` | No direct ORM relationships between modules | Compliant | Uses scalar FK ids and a module-owned deal link entity |
| root `AGENTS.md` | Filter by `organization_id` for tenant-scoped entities | Compliant | Every entity and query contract is organization- and tenant-scoped |
| root `AGENTS.md` | RBAC should use immutable feature ids | Compliant | Spec defines feature-based guards and avoids role-based page protection |
| root `AGENTS.md` | Input validation with zod | Compliant | `data/validators.ts` and command validation are required |
| root `AGENTS.md` | Modules added to `src/modules.ts` require structural cache purge | Compliant | Operational section includes module enable plus cache purge |
| `packages/core/AGENTS.md` | API routes MUST export `openApi` | Compliant | All route families explicitly require `openApi` |
| `packages/core/AGENTS.md` | Use `makeCrudRoute` with `indexer: { entityType }` for CRUD | Compliant | Project CRUD is specified to use CRUD factory where appropriate |
| `packages/core/AGENTS.md` | Events MUST be declared in `events.ts` | Compliant | Typed events are specified in module root |
| `packages/core/AGENTS.md` | User-facing text entities should declare `translations.ts` | Compliant | `translations.ts` is included for project and estimate user-facing fields |
| `packages/core/src/modules/customers/AGENTS.md` | New CRUD modules should follow customers patterns | Compliant | CRUD, commands, detail pages, and custom fields follow the reference model |
| `packages/core/src/modules/sales/AGENTS.md` | Sales remains source of truth for quotes/orders/invoices | Compliant | Construction module links commercial context through deal ids and does not reimplement sales docs |
| `packages/ui/AGENTS.md` | Use `CrudForm` and `DataTable` by default; use `useGuardedMutation` for custom writes | Compliant | Project CRUD uses `CrudForm`/`DataTable`; estimate editor uses guarded mutation |
| `packages/search/AGENTS.md` | Search config required; sensitive fields excluded | Compliant | Search covers project identity only; costs and notes excluded |
| `packages/events/AGENTS.md` | Subscribers must be idempotent and focused | Compliant | Subscriber design is one-side-effect-per-file |
| `packages/cache/AGENTS.md` | Cache must be tenant-scoped and tag-invalidated | Compliant | Report cache keys and tags are tenant-scoped with explicit invalidation |
| `packages/core/src/modules/currencies/AGENTS.md` | Monetary values must keep 4-decimal internal precision | Compliant | Amount and percentage fields now declare 4-decimal internal precision rules |
| review checklist / root conventions | Tenant-scoped entities keep standard timestamps | Compliant | Link and loss entities include `created_at` and `updated_at` alongside business timestamps |

### Internal Consistency Check

| Check | Status | Notes |
|-------|--------|-------|
| Data models match API contracts | Pass | Routes align with `construction_project`, link, estimate graph, and loss entities |
| API contracts match UI/UX section | Pass | Pages correspond to list/detail/editor/report routes and use page-based envelopes compatible with `DataTable` |
| Field visibility and auth model are explicit | Pass | API routes and backend pages map features to redacted vs. full financial responses using stable nullable keys |
| Risks cover all write operations | Pass | CRUD, link, status, estimate save, approval, and cache/search side effects are covered |
| Commands defined for all mutations | Pass | All write paths map to command contracts |
| Cache strategy covers all read APIs | Pass | Report and summary reads define cache usage and invalidation |
| Migration & Backward Compatibility section is present | Pass | The spec now names the BC section explicitly and states the additive-only impact across frozen/stable surfaces |

### Non-Compliant Items
- None (all items identified in pre-implementation analyses have been addressed — see Changelog).

### Verdict
- **Fully compliant**: Approved — ready for implementation

### Additional Compliance Notes (pre-implement-spec revision 3)
- Cross-module ORM entity class imports are prohibited; raw Knex queries are the compliant pattern for `currencies` and `customer_deals` table reads.
- `encryptionDefaults.ts` registration added as explicit Phase 1 step.
- `commands/shared.ts`, `notifications.ts`, `api/openapi.ts`, subscriber files, component files, and integration test specs are now fully tracked in the File Manifest.

## Changelog
### 2026-05-07
- Initial skeleton created from prework analyses and Open Mercato spec-writing workflow.
- Expanded into a full implementation-ready specification with confirmed app placement, `1:N` deal linkage, versioned estimates, and base-currency v1 scope.
- Hardened the spec with financial-field authorization, single-primary-deal enforcement, estimate concurrency rules, `translations.ts`, and explicit search/notification/cache contracts.
- Clarified `lost` as a terminal public workflow state, standardized page-based list/report API envelopes, added explicit CSV/export rules, and documented encryption plus 4-decimal precision requirements.

### 2026-05-07 (pre-implement-spec revision)
- Added `commands/index.ts` barrel to file structure and manifest.
- Added `widgets/injection-table.ts` and `widgets/injection/construction-projects-menus/` to file structure and manifest to provide admin sidebar navigation (`menu:sidebar:main`).
- Replaced "DI-backed tenant currency query service" with explicit direct ORM query pattern on `Currency` entity (scoped by `tenantId`/`organizationId`); added to Design Decisions and Alternatives Considered.
- Specified `LockMode.PESSIMISTIC_WRITE` (MikroORM) as the concurrency lock mechanism for version allocation and approval serialization.
- Added Command Snapshot Types subsection with `ConstructionProjectSnapshot` and `CostEstimateSnapshot` type definitions.
- Added implementation notes for all command handlers: `withAtomicFlush`, `emitCrudSideEffects`, `emitQueryIndexUpsertEvents`, `extractUndoPayload`, and forked EM requirement in `captureAfter`/`buildLog`.
- Added `currencies` required-dependency operational note in Setup & Operations.
- Completed File Manifest with previously omitted files: `create/page.tsx`, report page TSX files, subscriber files, and widget files.
- Updated Phase 2 steps to include `commands/index.ts` creation and sidebar navigation widget.

### 2026-05-07 (pre-implement-spec revision 2)
- Fixed `withAtomicFlush` import path: `@open-mercato/shared/lib/orm` → `@open-mercato/shared/lib/commands/flush`.
- Replaced `emitQueryIndexUpsertEvents from '@open-mercato/shared'` guidance with: `emitCrudSideEffects` from shared + module-local `emitProjectQueryIndexEvents` helper in `commands/shared.ts` (pattern from `packages/core/src/modules/customers/commands/shared.ts`).
- Renamed notification type IDs to dot-separator convention: `construction_projects.estimate.approved` and `construction_projects.project.lost`.
- Removed `ce.ts` from module structure and Phase 1 (no custom field sets in v1).
- Removed `di.ts` from module structure and Phase 1 (no DI services to register; base-currency startup check moved to `setup.ts > onTenantCreated`).
- Added design note on `construction_project_loss` omitting `deleted_at` (append-only by design).
- Added implementation note for partial unique index on `construction_project_deals` requiring raw SQL in generated migration.
- Added 10 000-row cap for CSV export on both report endpoints with `400` error behavior.
- Clarified deal existence verification: `em.findOne(CustomerDeal, ...)` cross-entity read.
- Made terminal status states explicit in the transition matrix.
- Clarified estimate archive replacement requirement (approve replacement first, then archive superseded).
- Added unit test file entries to the file manifest.

### 2026-05-07 (pre-implement-spec revision 3)
- Replaced cross-module ORM entity class imports (`Currency`, `CustomerDeal`) with raw Knex queries in Design Decisions, Alternatives Considered, Estimate Create API, and Deal Link API sections.
- Added `commands/index.ts → './commands/index'` import requirement to implementation notes.
- Added base-currency Knex query pattern and deal-existence Knex query pattern to command handler implementation notes.
- Added cross-module entity access rule note to Domain Boundaries section.
- Renamed `project-status-cache-invalidation.ts` → `project-lifecycle-cache-invalidation.ts` and added `project-lost-notification.ts` subscriber to file structure and manifest; clarified cache subscriber consolidation rationale in event rules.
- Added partial unique index copy-pasteable SQL to ConstructionProjectDeal section.
- Added `notifications.ts`, `commands/shared.ts`, `api/openapi.ts`, `[id]/edit/page.tsx`, all `components/*.tsx` files, `project-lost-notification.ts`, `project-lifecycle-cache-invalidation.ts`, and all three integration test spec files to the File Manifest.
- Added `encryptionDefaults.ts` (Modify) to File Manifest and as Phase 1 step 3.
- Added `search` module dependency note to Setup & Operations.
- Added N+1 query guard note to Phase 2.
- Updated Phase 4 to explicitly list all three subscriber files to create.
- Updated compliance matrix with pre-implement-spec revision 3 notes.

### Review — 2026-05-07
- **Reviewer**: Agent
- **Security**: Passed
- **Performance**: Passed
- **Cache**: Passed
- **Commands**: Passed
- **Risks**: Passed
- **Verdict**: Approved