# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v4 — Gantt w MVP, SVAR, ps_element_types, ps_import_column_mappings, rounding) |
| **Moduł** | `project_schedule` (`apps/mercato/src/modules/project_schedule`) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `attachments`, `notifications` |
| **Powiązany spec** | `.ai/specs/2026-10-19-project-costing-offer-calculator.md` |
| **Kierunek zależności** | `project_costing` → konsumuje `project_schedule`; `project_schedule` nigdy nie importuje z `project_costing` |

---

## Streszczenie

Moduł `project_schedule` dostarcza interaktywny harmonogram produkcji z widokiem Gantt (drag & drop od MVP) dla branży budowlanej. Posiada własny słownik typów elementów (`ps_element_types`) współdzielony z `project_costing` przez API/id. Faza MVP: Gantt interaktywny + zakładka na karcie deala + batche + prognoza. Faza v1: import/eksport XLSX/CSV. Faza v2: adaptery zewnętrznych narzędzi i webhooks.

`project_schedule` jest **niezależny** od `project_costing` — nie importuje żadnego kodu z kosztów. `project_costing` konsumuje ten moduł przez API i zdarzenia.

---

## 1. Cel i zakres

### 1.1 Faza MVP — Interaktywny harmonogram wewnętrzny (z Gantt)

- Interaktywny Gantt z drag & drop od MVP (Marek: „Gantt od razu").
- Własny słownik typów elementów (`ps_element_types`) z seedem dla prefabrykacji żelbetowej.
- Batche per typ elementu (strop/ściana/słup/belka), powiązane z kalkulacją i dealem przez `calculation_id` UUID.
- Status batcha: `planned` / `in_progress` / `done` / `cancelled`.
- Zakładka „Harmonogram" na karcie Deala (injection spot `detail:customers.deal:tabs`).
- Prognoza produkcji 6 miesięcy (pro-rata z batchów) eksponowana przez `analytics.ts`.

### 1.2 Faza v1 — Import/eksport i integracja

- Import/eksport XLSX/CSV harmonogramu.
- Zdarzenia notyfikujące `project_costing` o zmianach batchów.
- Widok cross-deal listy harmonogramów.

### 1.3 Faza v2 — Integracja zewnętrzna

- Interfejs providera/adaptera dla zewnętrznych narzędzi.
- Inbound/outbound webhooks (Standard Webhooks).
- Import MS Project XML (opcjonalny, złożony format — do weryfikacji z Markiem).

### 1.4 Granica z `project_costing`

| Pytanie | Odpowiedź |
|---------|-----------|
| Kto posiada `ps_element_types`? | `project_schedule` |
| Kto posiada `ps_schedule_batches`? | `project_schedule` |
| Kto posiada `pc_calculations`? | `project_costing` |
| Jak `project_costing` czyta batche i prognozy? | `GET /api/project-schedule/batches?calculationId=`, `/forecast` |
| Jak `project_costing` synchronizuje sumy? | Subskrybuje `project_schedule.batch.*` events |
| Czy `project_schedule` importuje z `project_costing`? | **NIE.** Tylko FK-id (`calculation_id`, `deal_id`) jako opaque UUID |
| Gdzie żyją typy wspólne? | `apps/mercato/src/modules/project_schedule/types.ts` |
| Element types: jak `project_costing` je zna? | Czyta przez `GET /api/project-schedule/element-types`; FK `element_type_id` = UUID z `ps_element_types` |

---

## 2. Model danych

### 2.1 Konwencje

Wszystkie tabele: `organization_id` + `tenant_id`, UUID PK, `updated_at` (optimistic locking).

### 2.2 Tabele

#### `ps_element_types` — typy elementów (słownik)

*Właściciel: `project_schedule`. Używany przez `project_costing` przez FK-id.*

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_code` | `text` NOT NULL | powiązanie z segmentem w `project_costing` (np. `precast_concrete`); opaque string (nie FK) |
| `code` | `text` NOT NULL | np. `floor_slab`, `wall`, `column`, `beam`, `staircase` |
| `label` | `text` NOT NULL | |
| `default_unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `sort_order` | `int` DEFAULT 0 | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, code)`. Indeks: `(organization_id, tenant_id, segment_code)`.

Seed dla `segment_code = 'precast_concrete'`: strop (`floor_slab`), ściana (`wall`), słup (`column`), belka (`beam`), klatka schodowa (`staircase`).

#### `ps_schedules` — głowa harmonogramu per kalkulacja/deal

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `calculation_id` | `uuid` NULL | FK-id → `pc_calculations.id` (opaque UUID, ON DELETE SET NULL) |
| `label` | `text` NOT NULL | |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `locked` \| `archived` |
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
| `element_type_id` | `uuid` NULL | FK → `ps_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity_m3` | `numeric(14,3)` NULL | |
| `quantity_pcs` | `numeric(14,0)` NULL | |
| `planned_start_at` | `date` NOT NULL | |
| `planned_end_at` | `date` NOT NULL | |
| `actual_start_at` | `date` NULL | |
| `actual_end_at` | `date` NULL | |
| `status` | `text` DEFAULT `'planned'` | `planned` \| `in_progress` \| `done` \| `cancelled` |
| `color` | `text` NULL | kolor na Gantt (hex lub token DS) |
| `depends_on_batch_id` | `uuid` NULL | FK → `ps_schedule_batches.id` (dependency arrow) |
| `external_id` | `text` NULL | ID zadania w zewnętrznym narzędziu |
| `external_tool_id` | `uuid` NULL | FK → `ps_external_integrations.id` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(schedule_id)`, `(organization_id, tenant_id)`, `(planned_start_at, planned_end_at)`.

Constraint: `CHECK (planned_end_at >= planned_start_at)`.

#### `ps_import_column_mappings` — zapamiętane mapowania importu harmonogramu

*Własna tabela modułu, nie współdzielona z `project_costing`.*

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `label` | `text` NOT NULL | |
| `file_type` | `text` NOT NULL | `xlsx` \| `csv` |
| `column_map` | `jsonb` NOT NULL | mapowanie nazw kolumn importu |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, label)`.

#### `ps_external_integrations` — połączenia z zewnętrznymi narzędziami (v2)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `provider_id` | `text` NOT NULL | np. `ms_project`, `custom_gantt` |
| `label` | `text` NOT NULL | |
| `inbound_webhook_secret` | `text` NULL | HMAC secret (nie eksponować w API response) |
| `outbound_webhook_url` | `text` NULL | |
| `config` | `jsonb` NULL | konfiguracja providera (bez secrets) |
| `is_active` | `bool` DEFAULT true | |
| `last_sync_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, provider_id)`.

---

## 3. Biblioteka Gantt

### 3.1 Porównanie opcji

| Biblioteka | Licencja | Ver. | Ostatnia aktual. | React-native | Drag & drop | Zależności | Bundle (~) | Uwagi |
|------------|----------|------|-----------------|--------------|-------------|-----------|-----------|-------|
| **@svar-ui/react-gantt** | MIT | 2.8.1 | Oct 2026 | ✅ TS | ✅ [niezweryfikowane] | 17 (@svar-ui/*) | ~100–200 KB [niezweryfikowane] | React >=18, aktywna (relese tydzień temu), task tree [niezweryfikowane], dep arrows [niezweryfikowane] |
| frappe-gantt | MIT | 1.2.2 | Feb 2026 | Nie (vanilla JS) | ✅ | 0 | ~50 KB | Drag&drop potwierdzone, React wrapper przez `useRef+useEffect` |
| @wamra/gantt-task-react | MIT | 0.6.17 | Nov 2024 | ✅ | ✅ | @mui/material (~400 KB) | ~450 KB+ | Wymaga MUI — niekompatybilny ze stackiem OM (Tailwind) |
| gantt-task-react | MIT | 0.3.9 | Jul 2022 | ✅ | ✅ | 0 | ~80 KB | **Unmaintained** od 2022 |
| wx-react-gantt | **GPLv3** | 1.3.1 | — | ✅ | ✅ | — | — | **Nie używać** — GPLv3 niekompatybilne z projektem |
| DHTMLX Gantt | Podwójna licencja | — | — | Nie | ✅ | — | ~200 KB | npm registry podaje „MIT" — **niereliable**; oficjalnie: GPL (standard) / Commercial (PRO). Wymagana weryfikacja z vendorem przed użyciem. |
| Bryntum Gantt | Komercyjna | 7.3.7 | — | ✅ | ✅ | — | ~500 KB | npm registry podaje „MIT" — **niereliable**; oficjalnie licencja komercyjna. Wymagana weryfikacja z vendorem przed użyciem. |
| svelte-gantt | MIT | 4.5.0 | — | Nie (Svelte) | ✅ | Svelte | — | Svelte — niekompatybilny z Next.js/React |

> ⚠️ **DHTMLX i Bryntum**: metadane npm podają licencję MIT, co jest **niereliable** dla obu tych produktów komercyjnych/dual-licensed. Przed użyciem wymagana weryfikacja warunków licencyjnych bezpośrednio z vendorami (dhtmlx.com, bryntum.com).

### 3.2 Wybór i uzasadnienie

**Wybrana biblioteka**: `@svar-ui/react-gantt` v2.8.1 (MIT, github.com/svar-widgets/react-gantt).

Uzasadnienie:
- **React-native z TypeScript** — natywna integracja z Next.js/React 19 (`peerDependencies: react >=18`), brak wrappera; bezpieczeństwo typów od razu.
- **MIT license** — weryfikowalna (github.com/svar-widgets/react-gantt README) [niezweryfikowane tylko: czy repo jest publiczne i czy README potwierdza MIT bez zastrzeżeń].
- **Aktywne utrzymanie** — opublikowana tydzień temu (Oct 12 2026); frappe-gantt: Feb 2026.
- **Projekt specjalizowany** — opis: „high-performance React Gantt chart component for building project timelines" z keywords gantt, timeline, task.
- **Drag & drop** [niezweryfikowane z npm metadata — oczekiwane na podstawie opisu i przeznaczenia]: przesuwanie i zmiana rozpiętości batchów [do weryfikacji w dokumentacji svar.dev/react/gantt przed implementacją].
- **Task tree / hierarchia** [niezweryfikowane]: prawdopodobna na podstawie dep `@svar-ui/react-tasklist` w paczce.
- **Dependencies**: 17 paczek `@svar-ui/*` + `date-fns` — własne zależności ekosystemu SVAR, brak MUI; rozmiar bundle [niezweryfikowane: szacunkowo 100–200 KB gzip na podstawie 1.2 MB unpacked].

Kompromis: cechy drag&drop, rozmiar bundle i tree/hierarchy wymagają weryfikacji w dokumentacji (svar.dev/react/gantt) przed implementacją. Jeśli drag&drop okaże się niewystarczający — fallback: frappe-gantt (vanilla JS wrapper, ~50 KB, potwierdzone drag&drop, ale wymaga React wrappera).

frappe-gantt pozostaje **opcją fallback**: lighter (~50 KB), drag&drop potwierdzone, ale vanilla JS wrapper przez `useRef+useEffect` — mniej idiomatyczne dla React/TS.

### 3.3 Kluczowe cechy wymagane w MVP

- Widok: Day / Week / Month (przełącznik).
- Drag & drop przesuwanie batcha → `PATCH /api/project-schedule/batches/:id` (nowe daty).
- Resize (zmiana rozpiętości) → ta sama ścieżka.
- Strzałki zależności: `depends_on_batch_id` → wizualizacja.
- Klik batcha → panel boczny (edycja etykiety, ilości, statusu, notat).
- Kolory per `element_type_id` (custom class).
- SSR: komponent renderowany wyłącznie client-side: `dynamic(() => import('./GanttChart'), { ssr: false })`.

---

## 4. Reguły wyliczeń — prognoza produkcji

### 4.1 Pro-rata z batchów — reguła podziału

Prognoza m³ i szt. per miesiąc, zakres 6 miesięcy od `today`:

```
Dla batcha B [planned_start_at S, planned_end_at E]:
  batch_days = E − S + 1                             (min 1 dzień)
  Dla każdego miesiąca M w zakresie prognozy:
    M_start = pierwszy dzień miesiąca M
    M_end   = ostatni dzień miesiąca M
    overlap_days = max(0, min(E, M_end) − max(S, M_start) + 1)
    raw_m3[M]  = B.quantity_m3  × (overlap_days / batch_days)
    raw_pcs[M] = B.quantity_pcs × (overlap_days / batch_days)
```

### 4.2 Zaokrąglenie — metoda największej reszty (Largest Remainder Method)

**m³ (3 miejsca dziesiętne)**: suma zaokrąglonych miesięcy musi być równa `B.quantity_m3` (3 d.p.).
1. Oblicz `floor(raw_m3[M], 3)` per miesiąc.
2. Reszta do rozdysponowania = `B.quantity_m3 − SUM(floor_m3[M])`.
3. Posortuj miesiące malejąco wg `frac_m3[M] = raw_m3[M] − floor_m3[M]`.
4. Dodaj `0.001` do górnych `k` miesięcy (gdzie `k = reszta × 1000`, zaokrąglone do int).

**szt. (0 miejsc dziesiętnych)**: analogicznie z `floor(raw_pcs[M], 0)`:
1. `floor_pcs[M] = floor(raw_pcs[M])`.
2. Reszta = `B.quantity_pcs − SUM(floor_pcs[M])`.
3. Posortuj wg `frac_pcs[M]`.
4. Dodaj `1` do górnych `k` miesięcy (gdzie `k = reszta`).

**Wynik**: `SUM(allocated_m3[M]) = B.quantity_m3` i `SUM(allocated_pcs[M]) = B.quantity_pcs` dokładnie.

### 4.3 Agregacja per miesiąc

```
monthly_m3[M]  = SUM(allocated_m3[M]  FOR all B WHERE B.status IN ('planned','in_progress'))
monthly_pcs[M] = SUM(allocated_pcs[M] FOR all B WHERE B.status IN ('planned','in_progress'))
```

Filtr: `ps_schedules.status = 'active'` i (gdy kontekst `project_costing`) `is_active_version = true` po stronie kalkulacji — sprawdzane przez query param `activeOnly=true`.

### 4.4 Endpoint `/forecast`

`GET /api/project-schedule/schedules/:id/forecast?months=6`

Odpowiedź: `MonthlyForecast[]` z `month` (YYYY-MM), `quantityM3`, `quantityPcs`. Precyzyjna pro-rata z §4.1–4.2; analytics.ts jako uzupełniające źródło danych dla widgetów dashboard.

---

## 5. Kontrakt z `project_costing` (i innymi modułami)

### 5.1 Typy wspólne — `types.ts`

```typescript
// apps/mercato/src/modules/project_schedule/types.ts
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
  quantityM3: number    // 3 d.p.
  quantityPcs: number   // 0 d.p.
}
```

### 5.2 API konsumowane przez `project_costing`

```
GET /api/project-schedule/element-types?segmentCode=&isActive=   → lista typów elementów
GET /api/project-schedule/schedules?calculationId={id}&dealId={id}
GET /api/project-schedule/schedules/:id/summary    → ScheduleBatchSummary
GET /api/project-schedule/schedules/:id/forecast   → MonthlyForecast[]
GET /api/project-schedule/batches?scheduleId={id}&calculationId={id}
```

`project_costing` wywołuje przez internal server-side fetch lub DI service — nigdy przez `@import` z modułu `project_schedule`.

### 5.3 Zdarzenia emitowane przez `project_schedule`

```
project_schedule.schedule.created      (clientBroadcast: true)
project_schedule.schedule.activated    (clientBroadcast: true)
project_schedule.schedule.locked
project_schedule.schedule.archived
project_schedule.batch.created
project_schedule.batch.updated         (clientBroadcast: true)
project_schedule.batch.deleted
project_schedule.batch.status_changed
project_schedule.import.completed      (clientBroadcast: true)
project_schedule.sync.webhook_received (v2)
```

`project_costing` subskrybuje `project_schedule.batch.updated` i `schedule.activated` przez `subscribers/` do aktualizacji `total_quantity_m3/pcs`, `production_start_at/end_at` w `pc_calculations`.

### 5.4 Zasada braku odwrotnej zależności

- `project_schedule` **nie importuje** żadnego kodu z `project_costing`.
- `project_schedule` przechowuje `calculation_id` jako opaque UUID FK-id.
- Element types (`ps_element_types`) należą do `project_schedule`; `project_costing` czyta je przez API i przechowuje `element_type_id` jako FK-id UUID.
- Przy usunięciu kalkulacji: `ps_schedules.calculation_id → NULL` (ON DELETE SET NULL lub serwis nulluje przy archiwizacji).

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Konwencje OM, optimistic locking.

### 6.1 Typy elementów

```
GET    /api/project-schedule/element-types?segmentCode=&isActive=
POST   /api/project-schedule/element-types
PATCH  /api/project-schedule/element-types/:id
DELETE /api/project-schedule/element-types/:id
```

### 6.2 Harmonogramy

```
GET/POST  /api/project-schedule/schedules?dealId=&calculationId=&status=
GET/PATCH/DELETE /api/project-schedule/schedules/:id

POST /api/project-schedule/schedules/:id/activate
POST /api/project-schedule/schedules/:id/lock
POST /api/project-schedule/schedules/:id/duplicate
GET  /api/project-schedule/schedules/:id/summary
GET  /api/project-schedule/schedules/:id/forecast?months=6
GET  /api/project-schedule/schedules/:id/export?format=xlsx|csv
POST /api/project-schedule/schedules/:id/import
```

### 6.3 Batche

```
GET/POST /api/project-schedule/batches?scheduleId=&status=
PATCH/DELETE /api/project-schedule/batches/:id
POST /api/project-schedule/batches/batch    (bulk upsert — drag&drop save)
```

### 6.4 Mapowania importu

```
GET/POST /api/project-schedule/import-column-mappings
PATCH/DELETE /api/project-schedule/import-column-mappings/:id
```

### 6.5 Integracje zewnętrzne (v2)

```
GET/POST /api/project-schedule/external-integrations
PATCH/DELETE /api/project-schedule/external-integrations/:id
POST /api/project-schedule/schedules/:id/sync/push
POST /api/project-schedule/webhook/:integrationId
POST /api/project-schedule/schedules/:id/import-ms-project
```

---

## 7. UI / UX

### 7.1 Zakładka „Harmonogram" na karcie Deala (MVP)

Spot: `detail:customers.deal:tabs` (oddzielna zakładka od `project_costing`, inny `groupId`).

Widget: `project_schedule/widgets/DealScheduleTab.tsx`.

Zawartość:
- Przełącznik widoku: Gantt / Lista batchów.
- Gantt (§7.2): interaktywny drag & drop od MVP.
- Panel boczny: edycja wybranego batcha (etykieta, typ elementu, m³/szt., daty, status).
- Przyciski: „Dodaj batch", „Importuj XLSX" (v1), „Eksportuj XLSX" (v1), status harmonogramu.
- Miniatura prognozy: sumy m³/szt. podział na 6 miesięcy.

### 7.2 Komponent `GanttChart.tsx` (MVP — @svar-ui/react-gantt)

```typescript
// components/GanttChart.tsx
'use client'
import { Gantt } from '@svar-ui/react-gantt'
import type { GanttTask } from '@svar-ui/react-gantt'

type GanttChartProps = {
  tasks: GanttTask[]
  scales?: unknown
  onTaskUpdate: (task: GanttTask) => void
  onTaskClick?: (task: GanttTask) => void
  readOnly?: boolean
}

// GanttChart renderowany wyłącznie client-side przez:
// const DealScheduleTab = dynamic(() => import('./DealScheduleTab'), { ssr: false })
export function GanttChart({ tasks, onTaskUpdate, onTaskClick, readOnly }: GanttChartProps) {
  // Użycie @svar-ui/react-gantt API — dostosować do faktycznego API biblioteki
  // [do weryfikacji w dokumentacji svar.dev/react/gantt przed implementacją]
  return (
    <Gantt
      tasks={tasks}
      onTaskUpdate={readOnly ? undefined : onTaskUpdate}
      onClick={onTaskClick}
    />
  )
}
```

> **Uwaga implementacyjna**: dokładne API `@svar-ui/react-gantt` (nazwy propsów, event handlery) wymagają weryfikacji w dokumentacji svar.dev/react/gantt przed implementacją. Komponent musi być renderowany wyłącznie client-side przez `dynamic(..., { ssr: false })` z powodu wymagań DOM biblioteki [niezweryfikowane dla @svar-ui — założone na podstawie typowego zachowania bibliotek Gantt].

Drag&drop callback → `PATCH /api/project-schedule/batches/:id` z nowymi datami przez `useGuardedMutation`.

### 7.3 Strony backend

| URL | Opis |
|-----|------|
| `/project-schedule/element-types` | Lista typów elementów per segment |
| `/project-schedule/schedules` | Lista harmonogramów cross-deal |
| `/project-schedule/schedules/[id]` | Widok Gantt standalone |
| `/project-schedule/settings` | Ustawienia (v2: external integrations) |

---

## 8. Import / Eksport (v1)

### 8.1 Formaty

**XLSX** (`exceljs`): kolumny `label`, `element_type_code`, `quantity_m3`, `quantity_pcs`, `planned_start` (YYYY-MM-DD), `planned_end`, `status`, `depends_on`. Kompatybilny z CSV eksportem z MS Project.

**CSV** (UTF-8 BOM, separator `;`): te same kolumny.

Kreator mapowania: `POST /api/project-schedule/import-column-mappings` zapisuje do `ps_import_column_mappings`.

### 8.2 MS Project XML (v2)

Import pliku `.mpp` → XML. Złożony format — v2 po weryfikacji z Markiem (patrz §11 Pytania otwarte).

### 8.3 Limity importu

Max **5000 wierszy** / **10 MB** per import. Timeout 30 s.

---

## 9. Uprawnienia (ACL)

| Feature ID | Opis |
|-----------|------|
| `project_schedule.view` | Podgląd harmonogramów |
| `project_schedule.edit` | Edycja batchów, drag & drop, zarządzanie typami elementów |
| `project_schedule.admin` | Ustawienia, integracje zewnętrzne |
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
      id:             { dbColumn: 'id',                type: 'uuid' },
      scheduleId:     { dbColumn: 'schedule_id',       type: 'uuid' },
      elementTypeId:  { dbColumn: 'element_type_id',   type: 'uuid' },
      quantityM3:     { dbColumn: 'quantity_m3',       type: 'numeric' },
      quantityPcs:    { dbColumn: 'quantity_pcs',      type: 'numeric' },
      plannedStartAt: { dbColumn: 'planned_start_at',  type: 'timestamp' },
      plannedEndAt:   { dbColumn: 'planned_end_at',    type: 'timestamp' },
      status:         { dbColumn: 'status',            type: 'text' },
    },
  },
]
```

Widget dashboardu „Prognoza produkcji 6 miesięcy": rekomendowany przez dedykowany endpoint `GET /api/project-schedule/forecast?months=6` (precyzyjna pro-rata z §4); analytics.ts jako uzupełniające źródło dla widgetów opartych na silniku dashboard.

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

### 11.2 Inbound Webhook

`POST /api/project-schedule/webhook/:integrationId` — Standard Webhooks HMAC (SHA-256). Idempotentność przez `external_id`: batch istnieje → update, else → create.

### 11.3 Outbound Webhook

Po `project_schedule.batch.updated` → `POST` do `outbound_webhook_url` (retry 3× exponential backoff przez `queue`).

---

## 12. Fazy i szacowanie wysiłku

### Faza MVP (~11 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_element_types` — tabela, API CRUD, seed prefabrykacja | M (1 dzień) |
| `ps_schedules` + `ps_schedule_batches` — migracje | S (1 dzień) |
| API CRUD: schedules, batches, bulk upsert | M (1.5 dnia) |
| ACL features + setup.ts | S (0.5 dnia) |
| Analytics.ts | S (0.5 dnia) |
| Endpoint `/summary` + `/forecast` (pro-rata + LRM rounding) | M (1.5 dnia) |
| `GanttChart.tsx` (@svar-ui/react-gantt, drag & drop, dep arrows) | L (3 dni) |
| `DealScheduleTab` widget + zakładka deala + panel boczny + miniatura | M (2 dni) |

**Suma MVP**: 1+1+1.5+0.5+0.5+1.5+3+2 = **11 dni roboczych**.

### Faza v1 (~3 dni robocze, po MVP)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_import_column_mappings` + Import XLSX/CSV + kreator mapowania | M (1.5 dnia) |
| Zdarzenia + subscriber w `project_costing` (update sum) | S (1 dzień) |
| Backend strony: lista cross-deal, standalone Gantt, element-types | S (0.5 dnia) |

**Suma v1**: 1.5+1+0.5 = **3 dni robocze**.

### Faza v2 (~7 dni roboczych, po v1)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_external_integrations` + provider interface + registry | M (1.5 dnia) |
| Inbound webhook (Standard Webhooks HMAC, idempotentność) | M (1.5 dnia) |
| Outbound webhook (queue retry, payload formatter) | M (1.5 dnia) |
| Import MS Project XML | L (2.5 dnia) |

**Suma v2**: 1.5+1.5+1.5+2.5 = **7 dni roboczych**.

**Łącznie `project_schedule`**: 11+3+7 = **21 dni roboczych**.

---

## 13. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | `@svar-ui/react-gantt` — cechy drag&drop / rozmiar bundle do weryfikacji [niezweryfikowane z npm metadata] | Średnie | Wysoki | Weryfikacja w docs svar.dev/react/gantt przed implementacją; fallback: frappe-gantt (~50 KB, drag&drop potwierdzone) |
| R2 | `@svar-ui/react-gantt` wymaga DOM — SSR Next.js | Średnie | Średni | `dynamic(() => import('./GanttChart'), { ssr: false })` [niezweryfikowane czy konieczne — założone] |
| R3 | Kolizja zakładek deala (costing + schedule) — oba używają `detail:customers.deal:tabs` | Niskie | Niski | Różne `groupId` w widget registration; priorytet steruje kolejnością |
| R4 | Circular dependency: `ps_schedules.calculation_id` nullowany przy archiwizacji kalkulacji | Niskie | Średni | ON DELETE SET NULL na FK lub serwis nulluje przy archiwizacji |
| R5 | LRM rounding przy bardzo krótkich batchach (<3 dni): jeden miesiąc dostaje całość | Niskie | Niski | Min batch duration = 1 dzień; rounding artefakty nie sumują się do błędu globalnego |
| R6 | Import MS Project XML — wiele wersji formatu | Wysokie | Niski | v2 po potwierdzeniu z Markiem; v1 = CSV/XLSX tylko |
| R7 | DHTMLX/Bryntum: npm podaje MIT ale prawdziwa licencja jest komercyjna | N/A | — | Wybrano @svar-ui/react-gantt — ryzyko usunięte |

---

## 14. Pytania otwarte do Marka

1. **Zależności Gantt — rescheduling**: Czy przy przesunięciu batcha poprzednika system ma automatycznie przesuwać batche potomne (automatic rescheduling), czy tylko wizualizacja strzałki bez auto-update?

2. **Cross-deal Gantt**: Czy potrzebny jest widok Gantt agregujący harmonogramy wielu deali jednocześnie (planowanie zasobów produkcyjnych firmy)?

3. **MS Project XML — aktywne użycie**: Czy firma aktywnie używa MS Project? Czy wystarczy jednorazowy import CSV/XLSX kompatybilny z MS Project, czy potrzebna jest dwustronna synchronizacja w v2?

4. **Format importu XLSX**: Jaki format pliku XLSX exportuje wewnętrzny system firmy lub narzędzie używane przez Marka (jeśli istnieje)?

---

## 15. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Biblioteka Gantt: `@svar-ui/react-gantt` v2.8.1 (MIT) | React-native TS, aktywna (Oct 2026), MIT; drag&drop [niezweryfikowane — do sprawdzenia w docs przed implementacją]; fallback: frappe-gantt |
| A2 | SSR: Gantt tylko client-side `dynamic(..., { ssr: false })` | Biblioteki Gantt typowo wymagają DOM [niezweryfikowane dla @svar-ui] |
| A3 | `project_schedule` nie zależy od `project_costing`; zależność jest `project_costing → project_schedule` | Unika circular dependency; costing czyta schedule przez HTTP API i events |
| A4 | Prognoza: dedykowany endpoint `/forecast` zamiast wyłącznie dashboard query | Precyzja LRM niemożliwa w silniku analytics (brak operatora overlap) |
| A5 | Import MS Project XML w v2 po weryfikacji z Markiem | XML MS Project złożony — v1 = CSV/XLSX |
| A6 | `ps_import_column_mappings` — własna tabela modułu | Nie dzielona z `project_costing`; moduły są niezależne |
| A7 | `ps_element_types` — własna tabela modułu (nie `pc_element_types`) | `project_schedule` nie zależy od `project_costing`; costing używa `element_type_id` jako FK-id UUID do `ps_element_types` |
| A8 | LRM rounding dla pcs (integers) i m3 (3 d.p.) | Gwarantuje `SUM(monthly) = batch_total` dokładnie |
| A9 | `ps_schedules` bez pola `currency` | Waluta jest własnością kalkulacji (`pc_calculations.currency`); harmonogram przechowuje ilości, nie wartości |

---

## 16. Migracje i backward compatibility

Moduł dodaje wyłącznie nowe tabele (`ps_*`). Zero zmian w `packages/core`.

Kolejność migracji: `ps_element_types` → `ps_schedules` → `ps_schedule_batches` → `ps_import_column_mappings` → `ps_external_integrations`.

---

## 17. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── index.ts
├── acl.ts
├── analytics.ts
├── events.ts
├── setup.ts                          # seed: ps_element_types dla precast_concrete
├── di.ts
├── types.ts                          # ScheduleBatchSummary, MonthlyForecast
├── api/
│   ├── element-types/route.ts
│   ├── element-types/[id]/route.ts
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
│   ├── batches/batch/route.ts
│   ├── import-column-mappings/route.ts
│   ├── import-column-mappings/[id]/route.ts
│   ├── external-integrations/route.ts
│   ├── external-integrations/[id]/route.ts
│   └── webhook/[integrationId]/route.ts
├── backend/
│   └── project-schedule/
│       ├── element-types/page.tsx
│       ├── schedules/page.tsx
│       ├── schedules/[id]/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── GanttChart.tsx               # @svar-ui/react-gantt wrapper (client-only)
│   ├── BatchSidePanel.tsx
│   ├── BatchListView.tsx
│   └── ForecastMiniature.tsx
├── data/
│   ├── entities.ts
│   └── validators.ts
├── i18n/pl.json + en.json
├── migrations/Migration20261019*.ts
├── widgets/
│   ├── index.ts
│   └── DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── forecast.ts                   # pro-rata + LRM rounding
    ├── import.service.ts
    └── external/
        ├── provider.interface.ts
        └── registry.ts
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | v1 (rev 3) — inicjalna spec wydzielona z `project-costing-offer-calculator.md` |
| 2026-10-19 | v2 (rev 4) — Gantt przeniesiony do MVP (Marek: „od razu"); dodano `ps_element_types` (własna tabela, nie `pc_`); dodano `ps_import_column_mappings` (nie dzielone z `pc_`); usunięto `ps_schedules.currency`; poprawiono kierunek zależności w A3; dodano `@svar-ui/react-gantt` do porównania (MIT, Oct 2026, React-native TS, rekomendowany z uwagą weryfikacji; frappe-gantt = fallback); GanttChart.tsx zaktualizowany; pro-rata rounding: LRM (largest remainder method) dla szt. i m3; poprawiono wx-react-gantt = GPLv3; uwaga o DHTMLX/Bryntum: npm MIT niereliable — weryfikacja z vendorami; effort: MVP 11d, v1 3d, v2 7d = 21d |
