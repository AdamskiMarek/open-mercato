# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Moduł** | `project_schedule` (`apps/mercato/src/modules/project_schedule`) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `attachments`, `notifications` |
| **Powiązany spec** | `.ai/specs/2026-10-19-project-costing-offer-calculator.md` |
| **Kierunek zależności** | `project_costing` → konsumuje `project_schedule`; `project_schedule` nigdy nie importuje z `project_costing` |

---

## Streszczenie

Moduł `project_schedule` dostarcza interaktywny harmonogram produkcji z widokiem Gantt (drag & drop) dla branży budowlanej. Faza v1: harmonogram wewnętrzny (ręczny Gantt + import/eksport XLSX), powiązany z Dealami i kalkulacjami z `project_costing` przez wyraźnie zdefiniowany kontrakt (events + API). Faza v2: adaptery dla zewnętrznych narzędzi (MS Project, własne Gantt) przez interfejs providerów, webhooks. Moduł jest **niezależny** — `project_costing` czyta z niego przez API i subskrybuje zdarzenia, nigdy odwrotnie.

Zero zmian w `packages/core`. Integracja wyłącznie przez punkty rozszerzeń OM.

---

## 1. Cel i zakres

### 1.1 Faza v1 — Harmonogram wewnętrzny

- Interaktywny Gantt z drag & drop (przesuwanie, zmiana rozpiętości batchów).
- Batche per typ elementu (strop/ściana/słup/…), powiązane z kalkulacją i dealem.
- Status batcha: `planned` / `in_progress` / `done` / `cancelled`.
- Import/eksport XLSX/CSV harmonogramu (ręczny, kompatybilny z prostym eksportem z MS Project).
- Zakładka „Harmonogram" na karcie Deala (injection spot `detail:customers.deal:tabs`).
- Widok cross-deal: lista/Gantt harmonogramów firmy per segment/miesiąc.
- Prognoza produkcji 6 miesięcy (pro-rata z batchów) eksponowana przez `analytics.ts`.

### 1.2 Faza v2 — Integracja zewnętrzna

- Interfejs providera (adapter) dla zewnętrznych narzędzi harmonogramowania.
- Inbound/outbound webhooks (Standard Webhooks signing).
- Import MS Project XML (opcjonalny, złożony format).
- Bidirectional sync (zmiany w Gantt → webhook do zewnętrznego narzędzia).

### 1.3 Granica z `project_costing`

| Pytanie | Odpowiedź |
|---------|-----------|
| Kto posiada `ps_schedule_batches`? | `project_schedule` |
| Kto posiada `pc_calculations`? | `project_costing` |
| Jak `project_costing` czyta batche? | `GET /api/project-schedule/batches?calculationId=` |
| Jak `project_costing` dostaje prognozy? | Subskrybuje `project_schedule.batch.*` events |
| Czy `project_schedule` importuje z `project_costing`? | **NIE.** Tylko FK-id (`calculation_id`, `deal_id`) |
| Gdzie żyją typy wspólne (`ScheduleBatch`, `ScheduleForecast`)? | `apps/mercato/src/modules/project_schedule/types.ts` (re-eksportowane jako kontrakt) |

---

## 2. Model danych

### 2.1 Konwencje

Wszystkie tabele: `organization_id` + `tenant_id`, UUID PK, `updated_at` (optimistic locking).

### 2.2 Tabele

#### `ps_schedules` — głowa harmonogramu per kalkulacja/deal

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `calculation_id` | `uuid` NULL | FK-id → `pc_calculations.id` (może być NULL gdy brak kalkulacji) |
| `label` | `text` NOT NULL | tytuł harmonogramu |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `locked` \| `archived` |
| `currency` | `char(3)` DEFAULT `'PLN'` | pochodna z kalkulacji/deala |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | FK-id → users |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(deal_id)`, `(calculation_id)`, `(organization_id, tenant_id)`.

#### `ps_schedule_batches` — batche/etapy harmonogramu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `schedule_id` | `uuid` NOT NULL | FK → `ps_schedules.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `element_type_code` | `text` NULL | kod z `pc_element_types.code` (FK-id free — nie ORM) |
| `label` | `text` NOT NULL | opis etapu |
| `quantity_m3` | `numeric(14,3)` NULL | ilość m³ |
| `quantity_pcs` | `numeric(14,0)` NULL | ilość szt. |
| `planned_start_at` | `date` NOT NULL | |
| `planned_end_at` | `date` NOT NULL | |
| `actual_start_at` | `date` NULL | |
| `actual_end_at` | `date` NULL | |
| `status` | `text` DEFAULT `'planned'` | `planned` \| `in_progress` \| `done` \| `cancelled` |
| `color` | `text` NULL | kolor na Gantt (hex lub token DS) |
| `depends_on_batch_id` | `uuid` NULL | FK → `ps_schedule_batches.id` (dependency strzałka) |
| `external_id` | `text` NULL | ID zadania w zewnętrznym narzędziu |
| `external_tool_id` | `uuid` NULL | FK → `ps_external_integrations.id` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(schedule_id)`, `(organization_id, tenant_id)`, `(planned_start_at, planned_end_at)`.

Constraint: `CHECK (planned_end_at >= planned_start_at)`.

#### `ps_external_integrations` — rejestr połączeń z zewnętrznymi narzędziami (v2)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `provider_id` | `text` NOT NULL | np. `ms_project`, `custom_gantt`, `primavera` |
| `label` | `text` NOT NULL | |
| `inbound_webhook_secret` | `text` NULL | HMAC secret (nie eksponować w API response) |
| `outbound_webhook_url` | `text` NULL | URL dla outbound zdarzeń |
| `config` | `jsonb` NULL | konfiguracja providera (bez secrets) |
| `is_active` | `bool` DEFAULT true | |
| `last_sync_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, provider_id)`.

---

## 3. Biblioteka Gantt

### 3.1 Porównanie opcji

| Biblioteka | Licencja | Ver. | Ostatnia aktualizacja | React-native | Drag & drop | Zależności | Bundle (~) | Uwagi |
|------------|----------|------|----------------------|--------------|-------------|-----------|-----------|-------|
| **frappe-gantt** | MIT | 1.2.2 | Feb 2026 | Nie (vanilla JS) | ✅ | Brak (standalone) | ~50 KB | Aktywnie utrzymywana, drag&drop przesuwanie/resize, React wrapper przez `useRef+useEffect` |
| @wamra/gantt-task-react | MIT | 0.6.17 | Nov 2024 | ✅ React 18+ | ✅ | `@mui/material` (~400 KB) | ~450 KB+ | Fork gantt-task-react; wymaga MUI, ciężki |
| gantt-task-react | MIT | 0.3.9 | Jul 2022 | ✅ | ✅ | Brak | ~80 KB | **Unmaintained** — ostatnia aktualizacja 2022 |
| react-gantt-timeline | MIT | 0.4.3 | [niezweryfikowane] | ✅ | Ograniczony | [niezweryfikowane] | [niezweryfikowane] | Prosty, bez zależności, brak drag&drop resize |
| DHTMLX Gantt | GPL (standard) / Commercial (PRO) | — | — | Nie (vanilla) | ✅ | Brak | ~200 KB | Licencja GPL niekompatybilna z zamkniętym fork; PRO = komercyjna |
| Bryntum Gantt | Komercyjna | 7.3.7 | — | ✅ | ✅ | Brak | ~500 KB | Pełen Gantt, ale płatna licencja [niezweryfikowane — npm podaje MIT, lecz oficjalna strona Bryntum wymaga licencji komercyjnej] |
| svelte-gantt | MIT | 4.5.0 | — | Nie (Svelte) | ✅ | Svelte | — | Svelte — niekompatybilny z Next.js/React |

### 3.2 Wybór i uzasadnienie

**Wybrana biblioteka**: `frappe-gantt` v1.2.2 (MIT, github.com/frappe/gantt).

Uzasadnienie:
- **Licencja MIT** — bez ograniczeń w forku open-source i komercyjnym.
- **Lekka** (~50 KB gzip) — istotne na VPS 3.77 GiB RAM; MUI dependency z @wamra wykluczone (OM używa Tailwind/własnych DS tokenów, nie MUI).
- **Aktywne utrzymanie** — ostatni release Feb 2026.
- **Drag & drop** — pełne: przesuwanie batchów (zmiana `planned_start_at`/`planned_end_at`), zmiana rozpiętości, strzałki zależności (`depends_on_batch_id`).
- **React wrapper** — frameworki vanilla JS integruje się łatwo przez `useRef`+`useEffect` w `GanttChart.tsx` (renderowanie w `div`, listener zdarzeń `on_date_change`/`on_progress_change`). Brak potrzeby frameworkowej biblioteki React-native.

Kompromis: brak natywnych React komponentów — wrapper jest jednorazowo implementowany w `components/GanttChart.tsx`. Każda aktualizacja frappe-gantt wymaga weryfikacji kompatybilności wrappera (niskie ryzyko — stabilne API od 2019).

### 3.3 Kluczowe cechy `frappe-gantt` (wymagane w v1)

- Widok: Day / Week / Month (przełącznik).
- Drag & drop przesuwanie batcha → emituje `on_date_change(task, start, end)` → PATCH `/api/project-schedule/batches/:id`.
- Zmiana rozpiętości (resize) → ta sama obsługa.
- Strzałka zależności: `task.dependencies = [id_poprzednika]` → wizualizacja na wykresie (mapuje `depends_on_batch_id`).
- Kliknięcie batcha → panel boczny z detalami (edycja etykiety, ilości, statusu).
- Kolory batchów: `task.custom_class` → DS token klasy CSS per `element_type_code`.

---

## 4. Reguły wyliczeń — prognoza produkcji

### 4.1 Pro-rata z batchów

Prognoza m³/szt. per miesiąc (zakres 6 miesięcy od `today`):

```
Dla batcha B [planned_start_at, planned_end_at]:
  batch_days = planned_end_at - planned_start_at + 1    (min 1 dzień)
  Dla każdego miesiąca M w zakresie prognozy:
    overlap_days = dni nakładające się między [planned_start_at, planned_end_at] a [M_start, M_end]
    m3_in_M  = B.quantity_m3  × (overlap_days / batch_days)  -- zaokrągl(·, 2, HALF_EVEN)
    pcs_in_M = B.quantity_pcs × (overlap_days / batch_days)  -- zaokrągl(·, 0, HALF_UP)
```

Aggregacja per miesiąc:
```
monthly_m3[M]  = SUM(m3_in_M  FOR all B WHERE B.status IN ('planned','in_progress') AND schedule.is_active=true)
monthly_pcs[M] = SUM(pcs_in_M FOR all B WHERE B.status IN ('planned','in_progress') AND schedule.is_active=true)
```

Filtr kontekstowy: aktywne harmonogramy (`status IN ('active')`) powiązane z aktywną kalkulacją (`is_active_version = true` w `pc_calculations`) — weryfikowane przez query parameter `activeOnly=true` lub domyślnie w widgecie dashboardu.

### 4.2 Reguła aktywnego harmonogramu

Harmonogram ma `status = 'active'` gdy `ps_schedules.status = 'active'`. Zmiana aktywności harmonogramu emituje event `project_schedule.schedule.activated`, na który może reagować `project_costing` (np. odświeżenie prognoz).

---

## 5. Kontrakt z `project_costing` (i innymi modułami)

### 5.1 API eksponowane przez `project_schedule`

```typescript
// Typy wspólne re-eksportowane z: apps/mercato/src/modules/project_schedule/types.ts
export type ScheduleBatchSummary = {
  scheduleId: string
  calculationId: string | null
  dealId: string
  totalQuantityM3: number | null
  totalQuantityPcs: number | null
  productionStartAt: string | null   // ISO date
  productionEndAt: string | null
  batchCount: number
}

export type MonthlyForecast = {
  month: string         // 'YYYY-MM'
  quantityM3: number
  quantityPcs: number
}
```

Endpointy konsumowane przez `project_costing`:
```
GET /api/project-schedule/schedules?calculationId={id}&dealId={id}
GET /api/project-schedule/schedules/:id/summary    → ScheduleBatchSummary
GET /api/project-schedule/schedules/:id/forecast   → MonthlyForecast[]  (zakres 6 mies.)
GET /api/project-schedule/batches?scheduleId={id}&calculationId={id}
```

`project_costing` używa tych endpointów jako **internal API call** (server-side `fetch` lub przez DI service) — nigdy `@import` z modułu `project_schedule`.

### 5.2 Zdarzenia emitowane przez `project_schedule`

```
project_schedule.schedule.created      (clientBroadcast: true)
project_schedule.schedule.activated    (clientBroadcast: true)
project_schedule.schedule.locked
project_schedule.schedule.archived
project_schedule.batch.created
project_schedule.batch.updated         (clientBroadcast: true — odświeża prognozę na karcie deala)
project_schedule.batch.deleted
project_schedule.batch.status_changed
project_schedule.import.completed      (clientBroadcast: true)
project_schedule.sync.webhook_received (v2)
```

`project_costing` subskrybuje `project_schedule.batch.updated` i `schedule.activated` przez `subscribers/` do aktualizacji denormalizowanych sum (`total_quantity_m3/pcs`, `production_start_at/end_at`) w `pc_calculations`.

### 5.3 Zasada braku odwrotnej zależności

- `project_schedule` **nie importuje** żadnego kodu z `project_costing`.
- `project_schedule` przechowuje `calculation_id` jako UUID FK-id, bez wiedzy o strukturze `pc_calculations`.
- Jeśli `pc_calculations` zostaną usunięte (deal zamknięty, archived): `calculation_id` w `ps_schedules` zostaje `NULL` (ON DELETE SET NULL lub przy archiwizacji serwis nulluje ręcznie).

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Konwencje OM, optimistic locking na `PATCH`/`DELETE`.

### 6.1 Harmonogramy

```
GET    /api/project-schedule/schedules?dealId=&calculationId=&status=
POST   /api/project-schedule/schedules
GET    /api/project-schedule/schedules/:id
PATCH  /api/project-schedule/schedules/:id
DELETE /api/project-schedule/schedules/:id          (tylko draft/archived)
POST   /api/project-schedule/schedules/:id/activate
POST   /api/project-schedule/schedules/:id/lock
POST   /api/project-schedule/schedules/:id/duplicate
GET    /api/project-schedule/schedules/:id/summary    → ScheduleBatchSummary
GET    /api/project-schedule/schedules/:id/forecast   → MonthlyForecast[]
GET    /api/project-schedule/schedules/:id/export?format=xlsx|csv
POST   /api/project-schedule/schedules/:id/import
```

### 6.2 Batche

```
GET    /api/project-schedule/batches?scheduleId=&status=&startFrom=&startTo=
POST   /api/project-schedule/batches
PATCH  /api/project-schedule/batches/:id
DELETE /api/project-schedule/batches/:id
POST   /api/project-schedule/batches/batch           (bulk upsert — drag&drop save)
```

### 6.3 Integracje zewnętrzne (v2)

```
GET    /api/project-schedule/external-integrations
POST   /api/project-schedule/external-integrations
PATCH  /api/project-schedule/external-integrations/:id
DELETE /api/project-schedule/external-integrations/:id

POST   /api/project-schedule/schedules/:id/sync/push   (outbound: push do zewnętrznego narzędzia)
POST   /api/project-schedule/webhook/:integrationId     (inbound: odbiór zdarzeń)
POST   /api/project-schedule/schedules/:id/import-ms-project  (v2: import MS Project XML)
```

---

## 7. UI / UX

### 7.1 Zakładka „Harmonogram" na karcie Deala

Spot: `detail:customers.deal:tabs` (ten sam co `project_costing` — oddzielna zakładka z innym `groupId`).

Widget: `project_schedule/widgets/DealScheduleTab.tsx`.

Zawartość:
- Przełącznik widoku: Gantt / Lista batchów.
- Gantt (`frappe-gantt` wrapper `components/GanttChart.tsx`): drag & drop, strzałki zależności, przełącznik Day/Week/Month.
- Panel boczny: edycja wybranego batcha (etykieta, typ elementu, m³/szt., daty, status, notatki).
- Przyciski: „Dodaj batch", „Importuj XLSX", „Eksportuj XLSX", status harmonogramu.
- Miniatura prognozy: sumy m³/szt. z podziałem na miesiące (6 miesięcy), link do dashboardu.

### 7.2 Strony backend modułu

| URL | Opis |
|-----|------|
| `/project-schedule/schedules` | Lista harmonogramów cross-deal |
| `/project-schedule/schedules/[id]` | Widok Gantt standalone |
| `/project-schedule/settings` | Ustawienia (v2: external integrations) |

### 7.3 Komponent `GanttChart.tsx`

```typescript
// components/GanttChart.tsx
'use client'
import React from 'react'
import Gantt from 'frappe-gantt'  // vanilla JS import

type GanttTask = { id: string; name: string; start: string; end: string; progress: number; dependencies?: string; custom_class?: string }
type GanttChartProps = {
  tasks: GanttTask[]
  viewMode?: 'Day' | 'Week' | 'Month'
  onDateChange: (task: GanttTask, start: Date, end: Date) => void
  onTaskClick?: (task: GanttTask) => void
  readOnly?: boolean
}

export function GanttChart({ tasks, viewMode = 'Month', onDateChange, onTaskClick, readOnly }: GanttChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const ganttRef = React.useRef<InstanceType<typeof Gantt> | null>(null)

  React.useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return
    ganttRef.current = new Gantt(containerRef.current, tasks, {
      view_mode: viewMode,
      on_date_change: readOnly ? undefined : onDateChange,
      on_click: onTaskClick,
    })
    return () => { ganttRef.current = null }
  }, [tasks, viewMode, onDateChange, onTaskClick, readOnly])

  return <div ref={containerRef} className="pc-gantt-container" />
}
```

Zmiany drag&drop: `onDateChange` wywołuje `PATCH /api/project-schedule/batches/:id` z nowymi datami przez `useGuardedMutation`.

---

## 8. Import / Eksport harmonogramu

### 8.1 Formaty v1

**XLSX** (przez `exceljs`): kolumny `label`, `element_type_code`, `quantity_m3`, `quantity_pcs`, `planned_start` (YYYY-MM-DD), `planned_end`, `status`, `depends_on`. Kompatybilny z prostym CSV eksportem z MS Project (kolumny `Name`, `Duration`, `Start`, `Finish`, `Predecessors`).

**CSV** (UTF-8 BOM, separator `;`): te same kolumny.

Kreator mapowania: ten sam wzorzec co `project_costing` (`ps_import_column_mappings` — opcjonalnie, albo konfiguracja w `pc_import_column_mappings` w module kosztów).

### 8.2 Format MS Project XML (v2)

Import pliku `.mpp` → XML (save as XML z MS Project). Parser `xml2js` lub własny XPath. Mapowanie: `<Task><Name>`, `<Start>`, `<Finish>`, `<WBS>`, `<Predecessors>`. Złożony format — v2 tylko po potwierdzeniu przez Marka.

---

## 9. Uprawnienia (ACL)

Plik `acl.ts`:

| Feature ID | Opis |
|-----------|------|
| `project_schedule.view` | Podgląd harmonogramów |
| `project_schedule.edit` | Edycja batchów, drag & drop |
| `project_schedule.admin` | Zarządzanie ustawieniami, integracjami zewnętrznymi |
| `project_schedule.import` | Import XLSX/CSV |
| `project_schedule.export` | Eksport XLSX/CSV |

Domyślnie: `admin` → wszystkie; `manager` → `view`, `edit`, `import`, `export`; `sales` → `view`.

---

## 10. Analityka (`analytics.ts`)

```typescript
entities: [
  {
    entityId: 'project_schedule:batches',
    requiredFeatures: ['project_schedule.view'],
    entityConfig: {
      tableName: 'ps_schedule_batches',
      dateField: 'planned_start_at',
      defaultScopeFields: ['tenant_id', 'organization_id'],
    },
    fieldMappings: {
      id:             { dbColumn: 'id',               type: 'uuid' },
      scheduleId:     { dbColumn: 'schedule_id',      type: 'uuid' },
      elementTypeCode:{ dbColumn: 'element_type_code',type: 'text' },
      quantityM3:     { dbColumn: 'quantity_m3',      type: 'numeric' },
      quantityPcs:    { dbColumn: 'quantity_pcs',     type: 'numeric' },
      plannedStartAt: { dbColumn: 'planned_start_at', type: 'timestamp' },
      plannedEndAt:   { dbColumn: 'planned_end_at',   type: 'timestamp' },
      status:         { dbColumn: 'status',           type: 'text' },
    },
  },
]
```

Widget dashboardu „Prognoza produkcji 6 miesięcy": groupBy miesiąc z `plannedStartAt`, agregacja pro-rata realizowana jako `SUM(quantityM3) / batch_months` per miesiąc (uproszczenie) lub przez dedykowany endpoint `GET /api/project-schedule/forecast?months=6` (rekomendowane dla precyzji pro-rata).

---

## 11. Integracja zewnętrzna (v2)

### 11.1 Interfejs providera

```typescript
// lib/external/provider.interface.ts
export interface ScheduleExternalProvider {
  providerId: string
  label: string
  push(schedule: SchedulePushPayload, ctx: ProviderContext): Promise<void>
  mapInbound(payload: unknown): ScheduleBatchImport[]
}
```

Rejestr analogiczny do `PriceSourceRegistry` w `project_costing`.

### 11.2 Inbound Webhook

`POST /api/project-schedule/webhook/:integrationId` — Standard Webhooks HMAC (SHA-256, header `Webhook-Signature`). Payload mapowany przez `provider.mapInbound()`. Idempotentność przez `external_id`: jeśli batch z tym `external_id` istnieje → update, else → create.

### 11.3 Outbound Webhook

Po każdym `project_schedule.batch.updated` (lub `schedule.activated`) — jeśli integracja ma `outbound_webhook_url` → `POST` payload do URL (retry 3× exponential backoff przez moduł `queue`).

---

## 12. Fazy i szacowanie wysiłku

### Faza MVP (~5 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (`ps_schedules`, `ps_schedule_batches`) | S (1 dzień) |
| API CRUD: schedules, batches, bulk upsert | M (1.5 dnia) |
| ACL features + setup.ts | S (0.5 dnia) |
| Analytics.ts | S (0.5 dnia) |
| Endpoint `/forecast` + reguła pro-rata | M (1.5 dnia) |

**Suma MVP**: 5 dni roboczych.

### Faza v1 (~8 dni roboczych, po MVP)

| Zadanie | Rozmiar |
|---------|---------|
| GanttChart.tsx (frappe-gantt wrapper, drag & drop, zależności) | L (3 dni) |
| Zakładka deala (DealScheduleTab widget, widoki Gantt/Lista) | M (2 dni) |
| Import/eksport XLSX/CSV harmonogramu (`exceljs`) | M (1.5 dnia) |
| Zdarzenia + subskrypcja przez `project_costing` (update sum w `pc_calculations`) | S (1 dzień) |
| Strony backend: lista cross-deal, standalone Gantt | S (0.5 dnia) |

**Suma v1**: 8 dni roboczych.

### Faza v2 (~7 dni roboczych, po v1)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_external_integrations` + provider interface + registry | M (1.5 dnia) |
| Inbound webhook (Standard Webhooks HMAC, idempotentność) | M (1.5 dnia) |
| Outbound webhook (queue retry, payload formater) | M (1.5 dnia) |
| Import MS Project XML | L (2.5 dnia) |

**Suma v2**: 7 dni roboczych.

**Łącznie `project_schedule`**: ~20 dni roboczych (MVP 5 + v1 8 + v2 7).

---

## 13. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | `frappe-gantt` vanilla JS integracja z React SSR (Next.js) — `useEffect` only (no SSR) | Średnie | Średni | `dynamic(() => import('./GanttChart'), { ssr: false })` — Gantt renderuje tylko client-side |
| R2 | Kolizja zakładek na karcie deala (`project_costing` + `project_schedule`) — oba używają tego samego spotu | Niskie | Niski | Różne `groupId` w widget registration; priorytet steruje kolejnością |
| R3 | Circular dependency przez `calculation_id` FK (przy usunięciu kalkulacji) | Niskie | Średni | ON DELETE SET NULL lub serwis nulluje przy archiwizacji kalkulacji |
| R4 | Pro-rata aggregacja w silniku dashboardów (brak native support) | Średnie | Średni | Dedykowany endpoint `/forecast` zamiast dashboard query (fallback: avg zamiast pro-rata w widgecie) |
| R5 | Import MS Project XML — wiele wersji formatu | Wysokie | Niski | v2 z flagą `[niezweryfikowane]`; v1 = CSV tylko |
| R6 | DHTMLX/Bryntum: konieczna weryfikacja licencji przed użyciem | N/A | — | Wybrano frappe-gantt MIT — ryzyko usunięte |

---

## 14. Pytania otwarte do Marka

1. **Zależności między batchami (dependencies)**: Czy w v1 wystarczy wizualizacja strzałek zależności (finish-to-start), czy potrzebna jest automatyczna zmiana dat batchów potomnych przy przesunięciu poprzednika (rescheduling)?

2. **Widok cross-deal**: Czy potrzebny jest widok Gantt agregujący harmonogramy wielu deali w jednym timeline (np. planowanie zasobów produkcyjnych firmy)?

3. **Synchronizacja z MS Project v2**: Czy firma używa MS Project aktywnie? Czy wystarczy jednorazowy import pliku CSV/XLSX (kompatybilny z MS Project), czy potrzebna jest dwustronna synchronizacja?

4. **Kolumny importu harmonogramu**: Jaki format pliku XLSX eksportuje wewnętrzny system firmy (jeśli istnieje)? Czy jest to eksport z Excela/MS Project z określonymi nagłówkami kolumn?

---

## 15. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Biblioteka Gantt: `frappe-gantt` v1.2.2 (MIT) | Najlżejsza (~50 KB) z drag&drop, aktywna (Feb 2026), MIT; MUI z @wamra zbyt ciężki dla VPS bez MUI w stacku |
| A2 | SSR: Gantt tylko client-side przez `dynamic(..., { ssr: false })` | frappe-gantt wymaga DOM — SSR Next.js niekompatybilny |
| A3 | Kierunek zależności: schedule → costing (FK tylko `calculation_id` UUID) | Unika circular dependency; costing czyta przez HTTP API |
| A4 | Pro-rata endpoint: `/forecast` zamiast dashboard query | Precyzja pro-rata niemożliwa w silniku analytics (brak operatora overlap) |
| A5 | Import MS Project: CSV kompatybilny v1, XML w v2 | XML MS Project skomplikowany — weryfikacja z Markiem przed v2 |
| A6 | Brak `ps_import_column_mappings` — dzielone z `pc_import_column_mappings` | Unika duplikacji; harmonogram ma stałe kolumny (brak potrzeby mappera) |

---

## 16. Migracje i backward compatibility

Moduł dodaje wyłącznie nowe tabele (`ps_*`). Zero zmian w `packages/core`.

Kolejność migracji: `ps_schedules` → `ps_schedule_batches` → `ps_external_integrations`.

---

## 17. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── index.ts
├── acl.ts
├── analytics.ts
├── events.ts
├── setup.ts
├── di.ts
├── types.ts                         # ScheduleBatchSummary, MonthlyForecast — kontrakt dla innych modułów
├── api/
│   ├── schedules/route.ts
│   ├── schedules/[id]/route.ts
│   ├── schedules/[id]/activate/route.ts
│   ├── schedules/[id]/lock/route.ts
│   ├── schedules/[id]/duplicate/route.ts
│   ├── schedules/[id]/summary/route.ts
│   ├── schedules/[id]/forecast/route.ts
│   ├── schedules/[id]/export/route.ts
│   ├── schedules/[id]/import/route.ts
│   ├── schedules/[id]/sync/push/route.ts
│   ├── batches/route.ts
│   ├── batches/[id]/route.ts
│   ├── batches/batch/route.ts       # bulk upsert
│   ├── external-integrations/route.ts
│   ├── external-integrations/[id]/route.ts
│   └── webhook/[integrationId]/route.ts
├── backend/
│   └── project-schedule/
│       ├── schedules/page.tsx
│       ├── schedules/[id]/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── GanttChart.tsx               # frappe-gantt wrapper (client-only)
│   ├── BatchSidePanel.tsx           # edycja batcha
│   ├── BatchListView.tsx            # widok listowy
│   └── ForecastMiniature.tsx        # miniatura prognozy
├── data/
│   ├── entities.ts
│   └── validators.ts
├── i18n/
│   ├── pl.json
│   └── en.json
├── migrations/
│   └── Migration20261019*.ts
├── subscribers/
│   └── calculationActivated.ts      # nasłuchuje project_costing.calculation.activated
├── widgets/
│   ├── index.ts
│   └── DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── forecast.ts                  # pro-rata aggregation
    ├── import.service.ts            # exceljs XLSX parsing
    └── external/
        ├── provider.interface.ts
        └── registry.ts
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | Inicjalna wersja (rev 3 — wydzielona z `.ai/specs/2026-10-19-project-costing-offer-calculator.md` po decyzji Marka o osobnym module) |
