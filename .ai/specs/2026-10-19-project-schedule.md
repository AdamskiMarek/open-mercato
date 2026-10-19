# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v5 — WBS, milestones, FS/SS/FF/SF, baseline, schedule types, probability forecast) |
| **Moduł** | `project_schedule` (`apps/mercato/src/modules/project_schedule`) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `attachments`, `notifications` |
| **Powiązany spec** | `.ai/specs/2026-10-19-project-costing-offer-calculator.md` |
| **Kierunek zależności** | `project_costing` → konsumuje `project_schedule`; odwrotna zależność zabroniona |

---

## Streszczenie

Moduł `project_schedule` dostarcza interaktywny harmonogram produkcji z widokiem Gantt (WBS + drag & drop od MVP). Rev 5 dodaje:
- **Dwa typy harmonogramów**: `offer` (szacunki na etapie ofertowania) i `execution` (harmonogram realizacji).
- **WBS z hierarchią** (`parent_task_id`) i **milestones** (zero-duration).
- **Zależności zadań**: FS / SS / FF / SF + lag (dni, może być ujemny); walidacja cykli.
- **Baseline**: zrzut harmonogramu ofertowego przy przejściu do realizacji; wariancja.
- **ProductionBatch** powiązany z zadaniem WBS i opcjonalnie z linią kalkulacji (`calculation_line_id` = opaque UUID).
- **Prognoza 6 miesięcy** (tygodnie i miesiące) z opcjonalnym ważeniem prawdopodobieństwem deala.

Właściciel `ps_element_types` (typy elementów) i `ps_schedule_tasks` (zadania WBS). `project_costing` czyta przez API i events.

---

## 1. Cel i zakres

### 1.1 Faza MVP — Interaktywny harmonogram z WBS i Gantt

- `ps_element_types`: własny słownik typów elementów + seed precast.
- `ps_schedules` z typem `offer` / `execution`.
- `ps_schedule_tasks`: hierarchia WBS, milestones, pola baseline.
- `ps_task_dependencies`: FS/SS/FF/SF + lag; walidacja cykli.
- `ps_production_batches`: partia produkcji powiązana z zadaniem.
- Gantt z WBS tree, milestones, dependency arrows — od MVP.
- Zakładka „Harmonogram" na karcie Deala.
- Prognoza 6 miesięcy (LRM rounding).

### 1.2 Faza v1 — Import/eksport i baseline

- Import/eksport XLSX/CSV harmonogramu.
- `ps_import_column_mappings`.
- Baseline capture (offer → execution transition).
- Zdarzenia dla `project_costing` (batch.updated, schedule.activated).

### 1.3 Faza v2 — Integracje zewnętrzne i krytyczna ścieżka

- Provider/adapter interface + webhooks (Standard Webhooks).
- Import MS Project XML.
- Algoritm krytycznej ścieżki (CPM).

### 1.4 Granica z `project_costing`

| Pytanie | Odpowiedź |
|---------|-----------|
| Kto posiada `ps_element_types`, `ps_schedule_tasks`, `ps_production_batches`? | `project_schedule` |
| Jak `project_costing` czyta dane? | HTTP API + events |
| Czy `project_schedule` importuje z `project_costing`? | NIE — tylko FK-id (calculation_id, deal_id, calculation_line_id) jako opaque UUID; `ps_schedules.deal_id` nullable (harmonogram może istnieć bez deala) |
| Skąd `project_schedule` bierze prawdopodobieństwo do prognozy? | Parametr query `?probability=` albo `deal.probability` pobrany przez consumer (project_costing lub dashboard) |

---

## 2. Model danych

### 2.1 Konwencje

`organization_id` + `tenant_id`, UUID PK, FK-id bez ORM relation, `updated_at`.

### 2.2 Tabele

#### `ps_element_types` — typy elementów (słownik)

Kolumny: id, organization_id, tenant_id, segment_code (opaque string), code, label, default_unit_id FK-id, sort_order, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`.

Seed `segment_code = 'precast_concrete'`: floor_slab, wall, column, beam, staircase.

#### `ps_schedules` — głowa harmonogramu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NULL | FK-id → customer_deals; NULL = harmonogram bez deala (kalkulacja standalone) |
| `calculation_id` | `uuid` NULL | FK-id → pc_calculations (opaque; ON DELETE SET NULL) |
| `schedule_type` | `text` NOT NULL DEFAULT `'offer'` | `offer` \| `execution` |
| `offer_schedule_id` | `uuid` NULL | FK → ps_schedules.id — referencja do harmonogramu ofertowego dla `execution` |
| `label` | `text` NOT NULL | |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `locked` \| `archived` |
| `baseline_captured_at` | `timestamptz` NULL | moment przechwycenia baseline |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraint: `CHECK (schedule_type IN ('offer','execution'))`.

Reguła: `execution` harmonogram jest kopią `offer` z zachowanym `offer_schedule_id`. Baseline rejestruje daty z `offer` w polach `baseline_start_at/end_at` zadań.

#### `ps_schedule_tasks` — zadania WBS

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `schedule_id` | `uuid` NOT NULL | FK → ps_schedules.id |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `parent_task_id` | `uuid` NULL | FK → ps_schedule_tasks.id (WBS hierarchy) |
| `wbs_code` | `text` NULL | np. `1.2.3` (auto-generated lub ręcznie) |
| `label` | `text` NOT NULL | |
| `is_milestone` | `bool` NOT NULL DEFAULT false | milestone = zero-duration task |
| `element_type_id` | `uuid` NULL | FK → ps_element_types.id |
| `planned_start_at` | `date` NULL | null dla summary tasks (wyliczone z dzieci) |
| `planned_end_at` | `date` NULL | |
| `actual_start_at` | `date` NULL | |
| `actual_end_at` | `date` NULL | |
| `baseline_start_at` | `date` NULL | z offer schedule; nigdy nadpisywane po baseline_captured_at |
| `baseline_end_at` | `date` NULL | |
| `duration_days` | `int` NULL | planowana liczba dni roboczych (informacyjna) |
| `progress_pct` | `numeric(5,2)` DEFAULT 0 | % ukończenia (0–100) |
| `status` | `text` DEFAULT `'not_started'` | `not_started` \| `in_progress` \| `done` \| `cancelled` |
| `color` | `text` NULL | hex lub DS token |
| `notes` | `text` NULL | |
| `sort_order` | `int` DEFAULT 0 | kolejność wśród rodzeństwa (per parent_task_id) |
| `external_id` | `text` NULL | ID w zewnętrznym narzędziu |
| `external_tool_id` | `uuid` NULL | FK → ps_external_integrations.id |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(schedule_id)`, `(parent_task_id)`, `(organization_id, tenant_id)`.

Constraints: `CHECK (is_milestone = false OR planned_start_at = planned_end_at)` (milestone: start=end).

Reguły WBS:
- Zadania-podsumowanie (summary tasks) = te z dziećmi; ich `planned_start_at` = MIN(child.planned_start_at), `planned_end_at` = MAX(child.planned_end_at) — wyliczane przez serwis.
- Liście WBS = zadania bez dzieci.

#### `ps_task_dependencies` — zależności między zadaniami

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `schedule_id` | `uuid` NOT NULL | FK → ps_schedules.id |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `predecessor_task_id` | `uuid` NOT NULL | FK → ps_schedule_tasks.id |
| `successor_task_id` | `uuid` NOT NULL | FK → ps_schedule_tasks.id |
| `dependency_type` | `text` NOT NULL DEFAULT `'FS'` | `FS` \| `SS` \| `FF` \| `SF` |
| `lag_days` | `int` NOT NULL DEFAULT 0 | lag (dni); może być ujemny (lead) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (predecessor_task_id, successor_task_id)`.

**Typy zależności**:
- `FS` (Finish-to-Start): successor zaczyna gdy predecessor kończy + lag.
- `SS` (Start-to-Start): successor zaczyna gdy predecessor zaczyna + lag.
- `FF` (Finish-to-Finish): successor kończy gdy predecessor kończy + lag.
- `SF` (Start-to-Finish): rzadkie; successor kończy gdy predecessor zaczyna + lag.

**Walidacja cykli**: przy tworzeniu/aktualizacji zależności — serwis weryfikuje brak cykli w DAG (DFS); błąd HTTP 422 gdy cykl wykryty.

**Krytyczna ścieżka** (v2): algorytm CPM (Critical Path Method) — forward pass (ES/EF) + backward pass (LS/LF) + float; zadania z float=0 = ścieżka krytyczna. Pola `early_start`, `early_finish`, `late_start`, `late_finish`, `float_days` dodane do `ps_schedule_tasks` w v2.

#### `ps_production_batches` — partie produkcji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `schedule_id` | `uuid` NOT NULL | FK → ps_schedules.id |
| `task_id` | `uuid` NULL | FK → ps_schedule_tasks.id (batch powiązany z zadaniem WBS) |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `element_type_id` | `uuid` NULL | FK → ps_element_types.id |
| `calculation_line_id` | `uuid` NULL | **opaque UUID** FK-id → pc_calculation_lines (project_costing) |
| `label` | `text` NOT NULL | |
| `quantity_m3` | `numeric(14,3)` NULL | |
| `quantity_pcs` | `numeric(14,0)` NULL | |
| `planned_start_at` | `date` NOT NULL | data startu produkcji |
| `planned_end_at` | `date` NOT NULL | data końca produkcji |
| `planned_delivery_at` | `date` NULL | data dostawy |
| `actual_start_at` | `date` NULL | |
| `actual_end_at` | `date` NULL | |
| `actual_delivery_at` | `date` NULL | |
| `status` | `text` DEFAULT `'planned'` | `planned` \| `in_progress` \| `done` \| `cancelled` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(schedule_id)`, `(task_id)`, `(planned_start_at)`.

Constraint: `CHECK (planned_end_at >= planned_start_at)`.

#### `ps_import_column_mappings` — mapowania importu harmonogramu

Kolumny: id, organization_id, tenant_id, label, file_type (xlsx|csv), column_map jsonb, created_at, updated_at. `UNIQUE (organization_id, tenant_id, label)`.

#### `ps_external_integrations` — integracje zewnętrzne (v2)

Kolumny: id, organization_id, tenant_id, provider_id, label, inbound_webhook_secret, outbound_webhook_url, config jsonb, is_active, last_sync_at, created_at, updated_at. `UNIQUE (organization_id, tenant_id, provider_id)`.

---

## 3. Biblioteka Gantt

### 3.1 Porównanie opcji

> **Źródło weryfikacji**: `@svar-ui/react-gantt` 2.8.1 npm tarball — `license.txt` (MIT, © 2025 XB Software Sp. z o.o.) + `readme.md`. Podział MIT/PRO zweryfikowany.

| Biblioteka | Licencja | React-native | WBS tree | Milestones | Dep links | FS/SS/FF/SF auto | CPM | Baseline UI | Bundle (~) | Uwagi |
|------------|----------|--------------|----------|------------|-----------|-----------------|-----|-------------|-----------|-------|
| **@svar-ui/react-gantt MIT core** | **MIT ✅** | **✅ TS, React 19/Next.js** | **✅** | [niezwer.] | **✅** | ❌ PRO | ❌ PRO | ❌ PRO | ~100–200 KB [niezwer.] | Zweryfikowano z tarball; 17 @svar-ui/* + date-fns |
| @svar-ui/react-gantt PRO | Komercyjna | ✅ | ✅ | ✅ | ✅ | ✅ + lag | ✅ | ✅ (S-curve) | — | Otwarto-źródłowe core, PRO paywall |
| frappe-gantt | MIT | Nie (JS) | ❌ | ❌ | FS only | ❌ | ❌ | ❌ | ~50 KB | **Niewystarczający** — brak WBS/milestones |
| DHTMLX Gantt | Podwójna lic. | Nie | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ~200 KB | npm MIT **niereliable**; weryfikacja z vendorem |
| Bryntum Gantt | Komercyjna | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ~500 KB | npm MIT **niereliable**; weryfikacja z vendorem |
| wx-react-gantt | **GPLv3** | — | — | — | — | — | — | — | — | **Nie używać** |

### 3.2 Wybór i uzasadnienie

**Wybrana biblioteka: `@svar-ui/react-gantt` v2.8.1 MIT core** (XB Software Sp. z o.o., © 2025, MIT zweryfikowano z `license.txt`).

**Zweryfikowane w MIT core (tarball README)**:
- ✅ React >=18, gotowe dla React 19 i Next.js (potwierdzono w README)
- ✅ TypeScript
- ✅ Interactive drag-and-drop timeline (przesuwanie + resize)
- ✅ Hierarchical view of subtasks (WBS tree) — przez `@svar-ui/react-tasklist` dep
- ✅ Dependency links — tworzenie na osi czasu i w formularzu; wizualizacja linków
- ✅ Progress na paskach, konfigurowane skale (Day/Week/Month/…)
- ✅ Grid z edycją w komórce, sort, reorder
- ✅ Edit form, toolbar, menu kontekstowe, wirtualizacja, RestDataProvider, lokalizacja

**Wyłącznie w SVAR PRO (commercial open-core)**:
- ❌ Auto-scheduling FS/SS/FF/SF z lag i constraints
- ❌ Critical Path Method (CPM, slack, deadlines)
- ❌ Baselines / progress line / S-curve
- ❌ Working calendars, resources
- ❌ MS Project import/export (wbudowane)
- ❌ Summary-task automation, split tasks

**Milestones**: nie wymienione wprost w MIT feature list [niezweryfikowane — dokumentacja SVAR sugeruje obsługę "milestone" task type; weryfikacja w svar.dev/react/gantt przed implementacją; fallback: custom task renderer z diamond shape].

**Implikacje dla projektu:**
- WBS tree, drag&drop, dependency links: ✅ MIT — bez dodatkowych kosztów.
- FS/SS/FF/SF **type labels i lag renderowanie**: client-side custom CSS overlay na linkach; server-side logika (`ps_task_dependencies`) bez zmian.
- **Auto-scheduling** (propagacja dat): NIE w zakresie v1/v2 bez PRO lub własnej implementacji.
- **CPM rendering**: server-side algorytm (v2) → `is_critical_path: bool` na zadaniu → custom CSS class na pasku.
- **Baseline wizualizacja**: custom overlay/marker na pasku zadania (`baseline_start/end_at`).
- **MS Project import/export**: server-side parser (v2, `exceljs`/`xml2js`), nie PRO.

**Decyzja SVAR PRO** — otwarte pytanie do Marka: §15, pkt 5.

### 3.3 Wymagania Gantt w MVP

- **WBS tree**: ✅ MIT.
- **Milestones** (zero-duration, diamond): [niezweryfikowane w MIT — weryfikacja przed implementacją; plan B: custom task renderer].
- **Drag & drop** (move + resize): ✅ MIT.
- **Dependency links** (strzałki): ✅ MIT. Etykiety typ (FS/SS/FF/SF) + lag = custom CSS nad linkami.
- **Przełącznik Day / Week / Month**: ✅ MIT.
- **Baseline overlay** (v1): custom rendering nadpisujące `baseline_start/end_at` jako pasek drugorzędny.
- **SSR**: `dynamic(() => import('./GanttChart'), { ssr: false })`.

---

## 4. Reguły wyliczeń — prognoza produkcji

### 4.1 Pro-rata z batchów

```
Dla batcha B [planned_start_at S, planned_end_at E]:
  batch_days = E − S + 1   (min 1)
  Dla miesiąca M:
    overlap_days = max(0, min(E, M_end) − max(S, M_start) + 1)
    raw_m3[M]  = B.quantity_m3  × (overlap_days / batch_days)
    raw_pcs[M] = B.quantity_pcs × (overlap_days / batch_days)
```

Agregacja tygodniowa: analogicznie z `[W_start, W_end]` (Mon–Sun).

### 4.2 Zaokrąglenie — Largest Remainder Method (LRM)

**m³ (3 d.p.)**: `SUM(monthly_m3) = B.quantity_m3` dokładnie.
1. `floor_m3[M] = floor(raw_m3[M], 3)`.
2. Reszta = `B.quantity_m3 − SUM(floor_m3[M])`.
3. Sort malejąco wg `frac = raw_m3[M] − floor_m3[M]`; dodaj `0.001` do top-k miesięcy.

**szt. (0 d.p.)**: analogicznie z `floor(..., 0)` i `+1` per pozycja.

**Tygodnie**: ten sam algorytm LRM per tydzień; `SUM(weekly) = B.quantity_m3/pcs` dokładnie.

### 4.3 Prognoza z ważeniem prawdopodobieństwem

```
weighted_m3[M]  = monthly_m3[M]  × probability / 100
weighted_pcs[M] = monthly_pcs[M] × probability / 100
```

`probability` przekazywane przez konsumenta (np. `project_costing` subskrybuje `customers.deal.updated` i dostarcza `deal.probability` do query). Endpoint `/forecast` akceptuje `?probability=0–100` (opcjonalny, default = 100 = bez ważenia).

### 4.4 Endpoint `/forecast`

`GET /api/project-schedule/schedules/:id/forecast?months=6&weeks=true&probability=75`

Odpowiedź: `{ monthly: MonthlyForecast[], weekly: WeeklyForecast[] }`.

```typescript
export type MonthlyForecast = { month: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
export type WeeklyForecast  = { week: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
```

---

## 5. Kontrakt z `project_costing`

### 5.1 Typy wspólne (`types.ts`)

```typescript
// apps/mercato/src/modules/project_schedule/types.ts
export type ScheduleBatchSummary = {
  scheduleId: string; calculationId: string | null; dealId: string
  totalQuantityM3: number | null; totalQuantityPcs: number | null
  productionStartAt: string | null; productionEndAt: string | null
  batchCount: number
}
export type MonthlyForecast = { month: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
export type WeeklyForecast  = { week: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
```

### 5.2 API konsumowane przez `project_costing`

```
GET /api/project-schedule/element-types?segmentCode=&isActive=
GET /api/project-schedule/schedules?calculationId=&dealId=
GET /api/project-schedule/schedules/:id/summary
GET /api/project-schedule/schedules/:id/forecast?months=6&probability=
GET /api/project-schedule/batches?scheduleId=&calculationId=
```

### 5.3 Zdarzenia

```
project_schedule.schedule.created       (clientBroadcast: true)
project_schedule.schedule.activated     (clientBroadcast: true)
project_schedule.schedule.locked
project_schedule.schedule.baseline_captured  (clientBroadcast: true)
project_schedule.task.created
project_schedule.task.updated           (clientBroadcast: true)
project_schedule.task.deleted
project_schedule.batch.created
project_schedule.batch.updated          (clientBroadcast: true)
project_schedule.batch.deleted
project_schedule.batch.status_changed
project_schedule.import.completed       (clientBroadcast: true)
project_schedule.sync.webhook_received  (v2)
```

### 5.4 Brak odwrotnej zależności

`project_schedule` nie importuje kodu z `project_costing`. `calculation_id` i `calculation_line_id` to opaque UUID FK-id. `ps_element_types` to niezależny słownik (nie `pc_`). `segment_code` to opaque string.

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Optimistic locking.

### 6.1 Typy elementów

```
GET/POST  /api/project-schedule/element-types?segmentCode=
PATCH/DELETE /api/project-schedule/element-types/:id
```

### 6.2 Harmonogramy

```
GET/POST  /api/project-schedule/schedules?dealId=&calculationId=&scheduleType=
GET/PATCH /api/project-schedule/schedules/:id
DELETE    /api/project-schedule/schedules/:id   (tylko draft)

POST .../activate | .../lock | .../duplicate
POST .../capture-baseline   (offer → copies baseline_start/end do zadań)
POST .../create-execution   (tworzy execution schedule z offer jako kopię)

GET .../summary
GET .../forecast?months=6&weeks=true&probability=
GET .../export?format=xlsx|csv
POST .../import
```

### 6.3 Zadania WBS

```
GET/POST  /api/project-schedule/tasks?scheduleId=&parentTaskId=
PATCH/DELETE /api/project-schedule/tasks/:id
POST      /api/project-schedule/tasks/batch    (bulk upsert — drag&drop save)
```

### 6.4 Zależności

```
GET/POST  /api/project-schedule/task-dependencies?scheduleId=&predecessorId=&successorId=
PATCH/DELETE /api/project-schedule/task-dependencies/:id
```

Walidacja cykli: `POST` i `PATCH` zwracają 422 `{ code: 'DEPENDENCY_CYCLE' }` przy wykryciu cyklu.

### 6.5 Batche produkcyjne

```
GET/POST  /api/project-schedule/production-batches?scheduleId=&taskId=
PATCH/DELETE /api/project-schedule/production-batches/:id
POST      /api/project-schedule/production-batches/batch
```

### 6.6 Import / mapowania

```
GET/POST/PATCH/DELETE /api/project-schedule/import-column-mappings[/:id]
```

### 6.7 Integracje (v2)

```
GET/POST/PATCH/DELETE /api/project-schedule/external-integrations[/:id]
POST /api/project-schedule/schedules/:id/sync/push
POST /api/project-schedule/webhook/:integrationId
POST /api/project-schedule/schedules/:id/import-ms-project
```

---

## 7. UI / UX

### 7.1 Zakładka „Harmonogram" na karcie Deala (MVP)

Spot: `detail:customers.deal:tabs` (oddzielna zakładka od project_costing).

Widget: `DealScheduleTab.tsx`.

Zawartość:
- Selektor harmonogramu (offer/execution) + status badge.
- Przełącznik Gantt / Lista WBS.
- Gantt z WBS tree, milestones, dependency arrows (§3).
- Panel boczny edycji zadania: label, type, element_type, daty, progress, status, notes, dependency arrows.
- Sekcja batchów powiązanych z zadaniem (lista + CRUD).
- Przyciski: „Dodaj zadanie", „Dodaj zależność", „Importuj XLSX" (v1), „Eksportuj" (v1).
- Miniatura prognozy (6 miesięcy, m³/szt.).

### 7.2 GanttChart.tsx — `@svar-ui/react-gantt`

```typescript
// components/GanttChart.tsx  — 'use client'
// Import przez: dynamic(() => import('./GanttChart'), { ssr: false })
import { Gantt } from '@svar-ui/react-gantt'
// MIT core: WBS tree ✅, drag&drop ✅, dependency links ✅, React 19 ✅
// Milestones: [niezweryfikowane — weryfikacja przed implementacją]
// FS/SS/FF/SF auto-scheduling: PRO only; MIT renderuje linki (custom etykiety type/lag)
// Baseline overlay: custom rendering (not PRO) — dodatkowy div per task
// Dokładne API props (@svar-ui/react-gantt): zweryfikuj w svar.dev/react/gantt/docs
```

Zaktualizuj API call po weryfikacji docs: propsName onTaskUpdate/onChange, format zadania (id, start, end, parent, type: 'milestone'|'task', dependencies).

Drag&drop callback → `PATCH /api/project-schedule/tasks/:id`.

### 7.3 Strony backend

`/project-schedule/element-types`, `/project-schedule/schedules`, `/project-schedule/schedules/[id]`, `/project-schedule/settings`.

---

## 8. Import / Eksport (v1)

### 8.1 Formaty XLSX/CSV (`exceljs`)

Kolumny harmonogramu XLSX: `wbs_code`, `label`, `parent_wbs_code`, `is_milestone`, `element_type_code`, `planned_start` (YYYY-MM-DD), `planned_end`, `duration_days`, `predecessors` (wbs_code csv, default FS; format: `1.2FS+2` dla FS z lagiem 2 dni), `status`, `notes`.

Batche: opcjonalny drugi arkusz.

MS Project CSV export compatibility: kolumny `Name`, `Duration`, `Start`, `Finish`, `Predecessors`, `WBS`.

### 8.2 MS Project XML (v2)

Parser `xml2js`; elementy `<Task><WBS>`, `<Start>`, `<Finish>`, `<Predecessors>`. Złożony format — v2 po potwierdzeniu z Markiem.

### 8.3 Limity

Max 5000 zadań / 10 MB. Timeout 30 s.

---

## 9. Uprawnienia (ACL)

| Feature | Opis |
|---------|------|
| `project_schedule.view` | Podgląd |
| `project_schedule.edit` | Edycja zadań, drag & drop, batchów, zależności |
| `project_schedule.admin` | Ustawienia, element types, integracje zewnętrzne |
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
    entityConfig: { tableName: 'ps_production_batches', dateField: 'planned_start_at',
                    defaultScopeFields: ['tenant_id', 'organization_id'] },
    fieldMappings: {
      id: { dbColumn: 'id', type: 'uuid' },
      scheduleId: { dbColumn: 'schedule_id', type: 'uuid' },
      taskId: { dbColumn: 'task_id', type: 'uuid' },
      elementTypeId: { dbColumn: 'element_type_id', type: 'uuid' },
      quantityM3: { dbColumn: 'quantity_m3', type: 'numeric' },
      quantityPcs: { dbColumn: 'quantity_pcs', type: 'numeric' },
      plannedStartAt: { dbColumn: 'planned_start_at', type: 'timestamp' },
      plannedEndAt: { dbColumn: 'planned_end_at', type: 'timestamp' },
      status: { dbColumn: 'status', type: 'text' },
    },
  },
  {
    entityId: 'project_schedule:tasks',
    requiredFeatures: ['project_schedule.view'],
    entityConfig: { tableName: 'ps_schedule_tasks', dateField: 'planned_start_at',
                    defaultScopeFields: ['tenant_id', 'organization_id'] },
    fieldMappings: {
      id: { dbColumn: 'id', type: 'uuid' },
      scheduleId: { dbColumn: 'schedule_id', type: 'uuid' },
      isMilestone: { dbColumn: 'is_milestone', type: 'boolean' },
      progressPct: { dbColumn: 'progress_pct', type: 'numeric' },
      plannedStartAt: { dbColumn: 'planned_start_at', type: 'timestamp' },
      plannedEndAt: { dbColumn: 'planned_end_at', type: 'timestamp' },
      baselineStartAt: { dbColumn: 'baseline_start_at', type: 'timestamp' },
      baselineEndAt: { dbColumn: 'baseline_end_at', type: 'timestamp' },
      status: { dbColumn: 'status', type: 'text' },
    },
  },
]
```

Prognoza produkcji z dokładnymi sumarycznymi wartościami: rekomendowany endpoint `GET /api/project-schedule/schedules/:id/forecast` (precyzyjna pro-rata LRM); analytics.ts jako uzupełnienie dla dashboard queries.

---

## 11. Integracja zewnętrzna (v2)

### 11.1 Provider interface

```typescript
export interface ScheduleExternalProvider {
  providerId: string; label: string
  push(schedule: SchedulePushPayload, ctx: ProviderContext): Promise<void>
  mapInbound(payload: unknown): ScheduleTaskImport[]
}
```

### 11.2 Webhooks

- **Inbound**: Standard Webhooks HMAC SHA-256; idempotentność przez `external_id`.
- **Outbound**: po `task.updated` → POST do `outbound_webhook_url`; retry 3× przez `queue`.

### 11.3 Daty-change webhooks (outbound, v2)

Przy każdej zmianie `planned_start_at`/`planned_end_at` zadania (drag&drop) → natychmiastowy event `project_schedule.task.updated` z `{ taskId, newStart, newEnd }` → outbound webhook.

---

## 12. Fazy i szacowanie wysiłku

### Faza MVP (~15 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_element_types` — tabela, API CRUD, seed precast_concrete | M (1 dzień) |
| `ps_schedules` (z schedule_type + offer_schedule_id) — migracje | S (0.5 dnia) |
| `ps_schedule_tasks` (WBS, parent_task_id, is_milestone, baseline cols) — migracje + API | M (1.5 dnia) |
| `ps_task_dependencies` (FS/SS/FF/SF + lag, walidacja cykli) — migracje + API | M (1.5 dnia) |
| `ps_production_batches` (task_id, calculation_line_id) — migracje + API | S (0.5 dnia) |
| Pozostałe API: schedules CRUD, bulk tasks, forecast endpoint (pro-rata LRM + prob. weighting) | M (2 dni) |
| ACL features + setup.ts + analytics.ts | S (1 dzień) |
| `GanttChart.tsx` (@svar-ui/react-gantt MIT: WBS ✅, drag&drop ✅, dep links ✅; milestones [niezwer.]; custom: dep type labels + baseline overlay) | L (4 dni) |
| `DealScheduleTab` widget + panel boczny + miniatura prognozy | M (3 dni) |

**Suma MVP**: 1+0.5+1.5+1.5+0.5+2+1+4+3 = **15 dni roboczych**.

### Faza v1 (~5 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_import_column_mappings` + Import/eksport XLSX/CSV (zadania + batche) | M (1.5 dnia) |
| Baseline capture (offer → execution, `create-execution` endpoint) | M (1.5 dnia) |
| Zdarzenia + subscriber w `project_costing` (update sum w pc_calculations) | S (1 dzień) |
| Backend strony: lista harmonogramów, element-types | S (0.5 dnia) |
| i18n PL/EN + testy serwisów (cycle detection, LRM rounding) | S (0.5 dnia) |

**Suma v1**: 1.5+1.5+1+0.5+0.5 = **5 dni roboczych**.

### Faza v2 (~10 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_external_integrations` + provider interface + registry | M (1.5 dnia) |
| Inbound webhook (Standard Webhooks HMAC, idempotentność) | M (1.5 dnia) |
| Outbound webhook (date-change, queue retry) | M (1.5 dnia) |
| Import MS Project XML | L (2.5 dnia) |
| Algorytm CPM (critical path): forward/backward pass, float, pola ES/EF/LS/LF | L (3 dni) |

**Suma v2**: 1.5+1.5+1.5+2.5+3 = **10 dni roboczych**.

**Łącznie `project_schedule`**: 15+5+10 = **30 dni roboczych**.

---

## 13. Podsumowanie zbiorcze (oba moduły)

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 17 d | 22 d | 14 d | 53 d |
| `project_schedule` | 15 d | 5 d | 10 d | 30 d |
| **Łącznie** | **32 d** | **27 d** | **24 d** | **83 d** |

---

## 14. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | @svar-ui/react-gantt MIT: milestones [niezwer.]; FS/SS/FF/SF auto-scheduling = PRO | Niskie | Średni | Milestones: weryfikacja w docs + plan B custom renderer; FS/SS/FF/SF type labels = custom CSS; auto-scheduling poza scope |
| R2 | SSR Next.js + @svar-ui/react-gantt — wymaga DOM | Średnie | Średni | `dynamic(..., { ssr: false })` |
| R3 | Walidacja cykli w dużych WBS (setki zależności) — wydajność DFS | Niskie | Niski | DFS O(V+E); dla typowych budowlanych WBS (<200 zadań) bez problemu |
| R4 | LRM rounding przy bardzo krótkich batchach (<3 dni) | Niskie | Niski | Min 1 dzień; residual absorbowany przez miesiąc/tydzień z max overlap |
| R5 | Baseline capture: jeśli execution schedule nie istnieje — brak baseline | Niskie | Niski | `capture-baseline` wymaga istnienia execution schedule lub tworzy je implicitly |
| R6 | calculation_line_id = opaque UUID: przy usunięciu linii kalkulacji batch ma orphaned FK | Niskie | Niski | ON DELETE SET NULL lub serwis nulluje przy archiwizacji linii |
| R7 | MS Project XML — wiele wersji formatu; pola zróżnicowane | Wysokie | Niski | v2 po potwierdzeniu z Markiem; v1 = XLSX/CSV |
| R8 | Kolizja zakładek deala (project_costing + project_schedule) | Niskie | Niski | Różne groupId; priorytet steruje kolejnością |

---

## 15. Pytania otwarte do Marka

1. **Rescheduling automatyczny**: Przy przesunięciu zadania poprzednika czy system ma automatycznie przesuwać zadania potomne (automatic rescheduling), czy tylko wizualizacja strzałki bez auto-update?

2. **Cross-deal Gantt**: Czy potrzebny jest widok Gantt agregujący harmonogramy wielu deali jednocześnie (planowanie zasobów produkcyjnych firmy)?

3. **MS Project XML**: Czy firma aktywnie używa MS Project? Czy wystarczy import CSV/XLSX kompatybilny z MS Project?

4. **Offer → Execution transition**: Kto inicjuje przejście z harmonogramu ofertowego (`offer`) do wykonawczego (`execution`)? Czy to akceptacja oferty (`accepted`) wyzwala `create-execution` automatycznie?

5. **SVAR PRO vs własna implementacja**: Funkcje potrzebne w v2 (auto-scheduling FS/SS/FF/SF z lag, CPM, baseline UI, MS Project import/export) są dostępne w SVAR PRO (commercial, open-core). Czy Marek chce zakupić licencję SVAR PRO dla tych funkcji, czy implementować je samodzielnie server-side (algorytm CPM w `lib/critical-path.ts`, MS Project XML parser, custom baseline renderer)? Spec zakłada server-side dla CPM/MS Project (plan MIT); PRO = szybsze i bogatsze UI ale koszt licencji [niezweryfikowany].

---

## 16. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | @svar-ui/react-gantt v2.8.1 (MIT, zweryfikowano z tarball): WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; milestones [niezwer.]; FS/SS/FF/SF auto = PRO | React-native TS, aktywna (Oct 2026); frappe-gantt niewystarczający (brak WBS/milestones); PRO = pytanie do Marka |
| A2 | SSR: `dynamic(..., { ssr: false })` | Biblioteki Gantt wymagają DOM |
| A3 | `project_schedule` nie zależy od `project_costing` | Brak circular dependency |
| A4 | Prognoza: endpoint `/forecast` z LRM + probability param | Precyzja LRM; probability = param (nie hardcoded) |
| A5 | MS Project XML w v2 po potwierdzeniu | Złożony format |
| A6 | `ps_import_column_mappings` — własna tabela | Niezależność modułów |
| A7 | `ps_element_types` — własna tabela; costing czyta przez API | Brak circular dependency |
| A8 | LRM rounding m³ (3 d.p.) i szt. (int) per miesiąc i tydzień | `SUM(periodic) = batch_total` dokładnie |
| A9 | `ps_schedules` bez `currency` | Waluta = własność kalkulacji |
| A10 | Walidacja cykli: DFS synchroniczny | Typowe WBS < 200 zadań; wystarczające |
| A11 | `calculation_line_id` w `ps_production_batches` = opaque UUID | `project_schedule` nie zależy od `project_costing` |
| A12 | `schedule_type: offer|execution`; baseline w polach `baseline_start/end_at` na `ps_schedule_tasks` | Upraszcza model; bez osobnej tabeli snapshot |

---

## 17. Migracje i backward compatibility

Nowe tabele `ps_*` only. Kolejność: `ps_element_types` → `ps_schedules` → `ps_schedule_tasks` → `ps_task_dependencies` → `ps_production_batches` → `ps_import_column_mappings` → `ps_external_integrations`.

---

## 18. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts, types.ts
├── api/
│   ├── element-types/[id]?/route.ts
│   ├── schedules/[id]?/{activate,lock,duplicate,capture-baseline,create-execution,
│   │                    summary,forecast,export,import}/route.ts
│   ├── tasks/[id]?/batch/route.ts
│   ├── task-dependencies/[id]?/route.ts
│   ├── production-batches/[id]?/batch/route.ts
│   ├── import-column-mappings/[id]?/route.ts
│   └── external-integrations/[id]?/webhook/[integrationId]/route.ts
├── backend/project-schedule/
│   ├── element-types/, schedules/[id]/, settings/
├── components/
│   ├── GanttChart.tsx          # @svar-ui/react-gantt wrapper (client-only)
│   ├── WBSTreeColumn.tsx
│   ├── TaskSidePanel.tsx
│   ├── BatchListView.tsx
│   └── ForecastMiniature.tsx
├── data/entities.ts + validators.ts
├── i18n/pl.json + en.json
├── migrations/Migration20261019*.ts
├── subscribers/calculationActivated.ts
├── widgets/DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── forecast.ts              # pro-rata LRM + probability weighting
    ├── import.service.ts
    ├── cycle-detection.ts       # DFS cycle check
    └── external/provider.interface.ts + registry.ts
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | v1 (rev 3) — inicjalna spec |
| 2026-10-19 | v2 (rev 4) — Gantt MVP, @svar-ui, ps_element_types, ps_import_column_mappings, LRM |
| 2026-10-19 | v3 (rev 5) — …(jak poprzednio)… |
| 2026-10-19 | v3 patch (b) — ps_schedules.deal_id nullable (kalkulacja standalone może mieć harmonogram bez deala); combined table zaktualizowane: project_costing 53d + project_schedule 30d = 83d |
| 2026-10-19 | v3 patch (a) — @svar-ui/react-gantt 2.8.1 MIT/PRO zweryfikowane z tarball: MIT core ma WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; FS/SS/FF/SF auto-scheduling = PRO only; CPM/baselines/MS Project = PRO; milestones [niezwer.]; zaktualizowano §3.1 tabela, §3.2 (MIT/PRO split), §3.3, GanttChart.tsx, R1, A1; dodano pytanie otwarte o SVAR PRO vs impl. własna (§15 pkt 5) |
