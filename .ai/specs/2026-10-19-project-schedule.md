# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v7 — Marek decisions, optional module, auto-scheduling server-side, ScheduleSource contract) |
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

> **Moduł opcjonalny**: `project_schedule` jest opcjonalny per firma (feature toggle). `project_costing` działa poprawnie bez tego modułu dzięki abstrakcji `ScheduleSource` (patrz `project_costing` §7a). Gdy moduł jest wyłączony, costing korzysta z `calculation_embedded` lub `xlsx_import` source.

Właściciel `ps_schedule_tasks` (zadania WBS) i `ps_production_batches` (partie produkcji). **Typy elementów** (`pc_element_types`) są własnością `project_costing` i referencjonowane przez `element_type_code` (string, nie FK). `project_costing` czyta dane przez API i events.

---

## 1. Cel i zakres

### 1.1 Faza MVP — Interaktywny harmonogram z WBS i Gantt

> Moduł aktywowany per firma przez feature toggle. Gdy nieaktywny, `project_costing` używa `ScheduleSource = calculation_embedded`.

- `ps_schedules` z typem `offer` / `execution` + `auto_scheduling_enabled`.
- `ps_schedule_tasks`: hierarchia WBS, milestones, pola baseline, `is_pinned` (manual override).
- `ps_task_dependencies`: FS/SS/FF/SF + lag; walidacja cykli.
- `ps_production_batches`: partia produkcji powiązana z zadaniem; `element_type_code` (string, ref do `pc_element_types`).
- Gantt z WBS tree, milestones, dependency arrows — od MVP.
- Zakładka „Harmonogram" na karcie Deala.
- Prognoza 6 miesięcy (LRM rounding).

### 1.2 Faza v1 — Import/eksport, baseline i auto-scheduling

- Import/eksport XLSX/CSV harmonogramu.
- `ps_import_column_mappings`.
- Baseline capture (offer → execution transition).
- **Auto-scheduling server-side** (FS/SS/FF/SF + lag propagacja; `is_pinned` manual override; `auto_scheduling_enabled` per harmonogram).
- Trigger `offer → execution` gdy deal WON (subscriber `customers.deal.won`; idempotent).
- **Cross-deal Gantt** per inwestycja/projekt.
- Zdarzenia dla `project_costing` (batch.updated, schedule.activated).

### 1.3 Faza v2 — Integracje zewnętrzne i krytyczna ścieżka

- Provider/adapter interface + webhooks (Standard Webhooks).
- Import MS Project XML (v2+ — potwierdzone przez Marka).
- **Algorytm CPM** (Critical Path Method — ES/EF/LS/LF/float) server-side; renderowanie `is_critical_path` przez custom CSS overlay na pasku.

### 1.4 Granica z `project_costing`

| Pytanie | Odpowiedź |
|---------|-----------|
| Kto posiada typy elementów? | `project_costing` (`pc_element_types`); `project_schedule` referencjonuje przez `element_type_code` (string) — brak FK-id do costing |
| Kto posiada `ps_schedule_tasks`, `ps_production_batches`? | `project_schedule` |
| Jak `project_costing` czyta dane? | HTTP API + events |
| Czy `project_schedule` importuje z `project_costing`? | NIE — tylko opaque string `element_type_code`; `calculation_id`, `deal_id`, `calculation_line_id` = opaque UUID FK-id |
| Czy `project_schedule` jest wymagany do działania kosztorysowania? | NIE — moduł opcjonalny; costing używa `ScheduleSource` abstraction (patrz costing §7a) |
| Skąd `project_schedule` bierze prawdopodobieństwo do prognozy? | Parametr query `?probability=` albo `deal.probability` pobrany przez consumer (project_costing lub dashboard) |

---

## 2. Model danych

### 2.1 Konwencje

`organization_id` + `tenant_id`, UUID PK, FK-id bez ORM relation, `updated_at`.

### 2.2 Tabele

> **Uwaga**: tabela `ps_element_types` została przeniesiona do `project_costing` jako `pc_element_types` (rev 7). `project_schedule` referencjonuje typy elementów przez `element_type_code` (opaque string) pobrany z `GET /api/project-costing/element-types`.

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
| `auto_scheduling_enabled` | `bool` NOT NULL DEFAULT true | gdy true: przesunięcie zadania propaguje daty successor-ów wg zależności (serwis); gdy false: daty ręczne |
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
| `is_pinned` | `bool` NOT NULL DEFAULT false | manual override: gdy true, auto-scheduling pomija to zadanie (data nie jest propagowana — musi być ustawiona ręcznie) |
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

**Wariancja baseline (obliczana ON READ — nigdy przechowywana)**:

Konwencja znaku: **+ = opóźnienie**, − = wyprzedzenie. Jednostka: dni kalendarzowe (v1); dni robocze w v2.

```typescript
// Computed per task in API response (never stored, baseline_* never overwritten):
start_variance_days    = baseline_start_at
  ? Math.round((planned_start_at.getTime()  - baseline_start_at.getTime())  / 86_400_000)
  : null
end_variance_days      = baseline_end_at
  ? Math.round((planned_end_at.getTime()    - baseline_end_at.getTime())    / 86_400_000)
  : null
duration_variance_days = (baseline_start_at && baseline_end_at)
  ? (planned_duration_days - baseline_duration_days)   // planned - baseline
  : null

// Actual vs baseline (gdy actual dates exist):
actual_start_variance  = (actual_start_at && baseline_start_at)
  ? Math.round((actual_start_at.getTime()  - baseline_start_at.getTime())   / 86_400_000)
  : null
actual_end_variance    = (actual_end_at && baseline_end_at)
  ? Math.round((actual_end_at.getTime()    - baseline_end_at.getTime())     / 86_400_000)
  : null
```

Wariancja eksponowana w: response API `GET /api/project-schedule/tasks`, tooltip Gantt (overlay na pasku), analytics.ts (opcjonalnie).

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
| `element_type_code` | `text` NULL | **opaque string** — kod typu elementu z `pc_element_types.code` (project_costing); brak FK (moduł opcjonalny) |
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

**Wyłącznie w SVAR PRO (commercial open-core) — NIE kupujemy PRO (decyzja Marka rev 7)**:
- ❌ Auto-scheduling FS/SS/FF/SF z lag i constraints → **własna implementacja server-side** (v1, patrz §3a)
- ❌ Critical Path Method (CPM, slack, deadlines) → **własna implementacja server-side** (v2, CPM w `lib/critical-path.ts`)
- ❌ Baselines / progress line / S-curve → **własne overlays/markery** (custom task renderer)
- ❌ Working calendars, resources → poza scope
- ❌ MS Project import/export (wbudowane) → **server-side parser XML** (v2)
- ❌ Summary-task automation, split tasks

**Milestones**: nie wymienione wprost w MIT feature list [niezweryfikowane — dokumentacja SVAR sugeruje obsługę "milestone" task type; weryfikacja w svar.dev/react/gantt przed implementacją; fallback: custom task renderer z diamond shape].

**Implikacje dla projektu:**
- WBS tree, drag&drop, dependency links: ✅ MIT — bez dodatkowych kosztów.
- FS/SS/FF/SF **type labels i lag renderowanie**: client-side custom CSS overlay na linkach; propagacja dat = server-side (§3a).
- **Auto-scheduling** (propagacja dat): server-side v1 (§3a); MIT core renderuje wynikowe daty bez auto-scheduling UI.
- **CPM rendering**: server-side algorytm (v2) → `is_critical_path: bool` na zadaniu → custom CSS class na pasku.
- **Baseline wizualizacja**: custom overlay/marker na pasku zadania (`baseline_start/end_at`).
- **MS Project import/export**: server-side parser (v2, `exceljs`/`xml2js`), nie PRO.

### 3.3 Wymagania Gantt w MVP

- **WBS tree**: ✅ MIT.
- **Milestones** (zero-duration, diamond): [niezweryfikowane w MIT — weryfikacja przed implementacją; plan B: custom task renderer].
- **Drag & drop** (move + resize): ✅ MIT. Po przesunięciu → PATCH do API → serwis propaguje daty successor-ów (gdy `auto_scheduling_enabled = true`; §3a) → live update w Gantt.
- **Dependency links** (strzałki): ✅ MIT. Etykiety typ (FS/SS/FF/SF) + lag = custom CSS nad linkami.
- **Przełącznik Day / Week / Month**: ✅ MIT.
- **Baseline overlay** (v1): custom rendering — dla każdego zadania z `baseline_start_at` rysowany dodatkowy cienki pasek (np. szary, za/przed głównym) przez custom task renderer w @svar-ui. Tooltip: `Baseline: ${baseline_start} – ${baseline_end} | Odchylenie: ${start_variance_days}d start, ${end_variance_days}d koniec`.
- **SSR**: `dynamic(() => import('./GanttChart'), { ssr: false })`.

---

## 3a. Auto-scheduling — propagacja dat (v1, server-side)

### 3a.1 Algorytm

Gdy `ps_schedules.auto_scheduling_enabled = true` i zadanie jest przesuwane (drag&drop lub PATCH `planned_start_at`/`planned_end_at`), serwis propaguje nowe daty do successor-ów metodą forward-pass DAG:

```
Dla zadania T z nową datą start S' i end E':
  1. Oblicz E' = S' + (original_duration - 1) days (duration zachowana; milestones: S' = E').
  2. Dla każdej zależności (T → successor, type, lag):
     FS: successor.planned_start = max(E' + lag + 1, old_start)  -- shift forward only
     SS: successor.planned_start = max(S' + lag, old_start)
     FF: successor.planned_end   = max(E' + lag, old_end); adjust start to keep duration
     SF: successor.planned_end   = max(S' + lag, old_end); adjust start to keep duration
  3. Rekurencja dla każdego zaktualizowanego successor-a (BFS/topo order).
  4. Pomiń zadania z is_pinned = true (nie nadpisuj ich dat).
  5. Pomiń summary tasks (ich daty wyliczane z dzieci).
  6. Zapis wszystkich zmienionych zadań w jednej transakcji.
```

**Ograniczenia v1**: propagacja tylko forward (brak backward shift); nie skraca poprzednika gdy successor wcześniejszy. **Dni kalendarzowe** (v1); dni robocze w v2.

### 3a.2 Manual override (is_pinned)

Pole `is_pinned` na `ps_schedule_tasks`:
- `true`: zadanie jest „zakotwiczone" — auto-scheduling pomija je. User ustawia ręcznie.
- `false` (default): zadanie podlega auto-scheduling.

Dane UI: ikonka kłódki przy zadaniu w WBS grid; toggle w panelu bocznym.

### 3a.3 API endpoint

```
POST /api/project-schedule/tasks/:id/reschedule
```

Body: `{ newStartAt: string; propagate?: boolean }`. Propagate default = `schedule.auto_scheduling_enabled`.

Wewnętrznie używany przez drag&drop callback w Gantt.

---

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
  scheduleId: string; calculationId: string | null; dealId: string | null
  totalQuantityM3: number | null; totalQuantityPcs: number | null
  productionStartAt: string | null; productionEndAt: string | null
  batchCount: number
}
export type MonthlyForecast = { month: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
export type WeeklyForecast  = { week: string; quantityM3: number; quantityPcs: number; weightedM3: number; weightedPcs: number }
```

### 5.2 API konsumowane przez `project_costing` (gdy `project_schedule` aktywny)

```
GET /api/project-schedule/schedules?calculationId=&dealId=
GET /api/project-schedule/schedules/:id/summary
GET /api/project-schedule/schedules/:id/forecast?months=6&probability=
GET /api/project-schedule/batches?scheduleId=&calculationId=
```

> **Typy elementów**: `project_schedule` czyta `GET /api/project-costing/element-types` — odwrotna zależność względem poprzednich rewizji. Brak własnego endpointu dla element-types w `project_schedule`.

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

### 5.4 Brak odwrotnej zależności i opcjonalność modułu

`project_schedule` nie importuje kodu z `project_costing`. `calculation_id` i `calculation_line_id` to opaque UUID FK-id. `element_type_code` to opaque string (kod z `pc_element_types.code`; `project_schedule` może działać z dowolnym kodem bez walidacji FK). `segment_code` to opaque string.

`project_costing` nie ma twardej zależności od `project_schedule`: gdy moduł wyłączony, `InternalScheduleSource.isAvailable()` zwraca `false` i `ScheduleSourceRegistry` wybiera `EmbeddedScheduleSource`. Żaden `import` z `project_schedule` nie istnieje w kodzie `project_costing` — wyłącznie HTTP calls when available.

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Optimistic locking.

> **Typy elementów**: brak własnych endpointów w `project_schedule` — zarządzane przez `GET/POST/PATCH/DELETE /api/project-costing/element-types`.

### 6.1 Harmonogramy

```
GET/POST  /api/project-schedule/schedules?dealId=&calculationId=&scheduleType=
GET/PATCH /api/project-schedule/schedules/:id
DELETE    /api/project-schedule/schedules/:id   (tylko draft)

POST .../activate | .../lock | .../duplicate
POST .../capture-baseline   (offer → copies baseline_start/end do zadań)
POST .../create-execution   (tworzy execution schedule z offer jako kopię; idempotent)

GET .../summary
GET .../forecast?months=6&weeks=true&probability=
GET .../export?format=xlsx|csv
POST .../import
```

**Cross-deal Gantt per inwestycja**: `GET /api/project-schedule/investment-schedules?investmentId=&projectId=` — agreguje harmonogramy wielu deali powiązanych z daną inwestycją/projektem. Zwraca tasks z `dealId` i `calculationId` per każde zadanie. UI: `/project-schedule/investments/:investmentId/gantt`.

### 6.3 Zadania WBS

```
GET/POST  /api/project-schedule/tasks?scheduleId=&parentTaskId=
PATCH/DELETE /api/project-schedule/tasks/:id
POST      /api/project-schedule/tasks/batch    (bulk upsert — drag&drop save)
POST      /api/project-schedule/tasks/:id/reschedule   (§3a auto-scheduling)
```

API response dla każdego zadania zawiera pola wariancji obliczone ON READ (§2.2): `startVarianceDays`, `endVarianceDays`, `durationVarianceDays`, `actualStartVariance`, `actualEndVariance` — tylko gdy `baseline_start_at` / `baseline_end_at` != NULL. Zawiera też `isPinned`.

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

### 7.3 Cross-deal Gantt per inwestycja/projekt

Strona `/project-schedule/investments/:investmentId/gantt`. Aggregowany widok Gantt zadań ze wszystkich harmonogramów powiązanych z daną inwestycją (`pc_investments.id` via `ps_schedules.calculation_id` → `pc_calculations.investment_id`). Zadania kolorowane per deal. Umożliwia planowanie zasobów produkcyjnych dla całej inwestycji.

Breadcrumb: Inwestycja → Deale → Harmonogramy. Filtry: status harmonogramu, typ (offer/execution), deal.

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

### Faza MVP (~14 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_schedules` (schedule_type, offer_schedule_id, auto_scheduling_enabled) — migracje | S (0.5 dnia) |
| `ps_schedule_tasks` (WBS, parent_task_id, is_milestone, baseline cols, is_pinned) — migracje + API | M (1.5 dnia) |
| `ps_task_dependencies` (FS/SS/FF/SF + lag, walidacja cykli) — migracje + API | M (1.5 dnia) |
| `ps_production_batches` (task_id, calculation_line_id, element_type_code) — migracje + API | S (0.5 dnia) |
| Pozostałe API: schedules CRUD, bulk tasks, forecast endpoint (pro-rata LRM + prob. weighting) | M (2 dni) |
| ACL features + setup.ts + analytics.ts | S (1 dzień) |
| `GanttChart.tsx` (@svar-ui/react-gantt MIT: WBS ✅, drag&drop ✅, dep links ✅; milestones [niezwer.]; custom: dep type labels + baseline overlay; drag&drop callback → reschedule endpoint) | L (4 dni) |
| `DealScheduleTab` widget + panel boczny (is_pinned toggle) + miniatura prognozy | M (3 dni) |

**Suma MVP**: 0.5+1.5+1.5+0.5+2+1+4+3 = **14 dni roboczych**.

### Faza v1 (~11.5 dnia roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_import_column_mappings` + Import/eksport XLSX/CSV (zadania + batche) | M (1.5 dnia) |
| Baseline capture (offer → execution, `create-execution` endpoint; idempotent) | M (1.5 dnia) |
| Wariancja baseline: API response, Gantt tooltip/overlay, baseline overlay renderer | S (1 dzień) |
| **Auto-scheduling server-side** (propagacja FS/SS/FF/SF + lag, forward-pass DAG, `reschedule` endpoint) | L (3 dni) |
| **Cross-deal Gantt** per inwestycja/projekt (`investment-schedules` endpoint + `/investments/:id/gantt` page) | M (2 dni) |
| **Offer → execution trigger** (subscriber `customers.deal.won`; `create-execution` idempotent) | S (0.5 dnia) |
| Zdarzenia + subscriber w `project_costing` (update sum w pc_calculations) | S (0.5 dnia) |
| Backend strony: lista harmonogramów | S (0.5 dnia) |
| i18n PL/EN + testy serwisów (cycle detection, LRM rounding, variance, auto-scheduling) | S (0.5 dnia) |

**Suma v1**: 1.5+1.5+1+3+2+0.5+0.5+0.5+0.5 = **11 dni roboczych**.

### Faza v2 (~10 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| `ps_external_integrations` + provider interface + registry | M (1.5 dnia) |
| Inbound webhook (Standard Webhooks HMAC, idempotentność) | M (1.5 dnia) |
| Outbound webhook (date-change, queue retry) | M (1.5 dnia) |
| Import MS Project XML (`xml2js`) — v2+ potwierdzone | L (2.5 dnia) |
| **Algorytm CPM** (critical path: forward/backward pass, ES/EF/LS/LF/float; pola na ps_schedule_tasks v2; rendering `is_critical_path` custom CSS) | L (3 dni) |

**Suma v2**: 1.5+1.5+1.5+2.5+3 = **10 dni roboczych**.

**Łącznie `project_schedule`**: 14+11+10 = **35 dni roboczych**.

---

## 13. Podsumowanie zbiorcze (oba moduły)

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 17 d | 28.5 d | 14 d | 59.5 d |
| `project_schedule` | 14 d | 11 d | 10 d | 35 d |
| **Łącznie** | **31 d** | **39.5 d** | **24 d** | **94.5 d** |

---

## 14. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | @svar-ui/react-gantt MIT: milestones [niezwer.]; auto-scheduling = własna implementacja server-side (NIE PRO — decyzja Marka) | Niskie | Średni | Milestones: weryfikacja w docs + plan B custom renderer; auto-scheduling: §3a + testy propagacji |
| R2 | SSR Next.js + @svar-ui/react-gantt — wymaga DOM | Średnie | Średni | `dynamic(..., { ssr: false })` |
| R3 | Walidacja cykli w dużych WBS (setki zależności) — wydajność DFS | Niskie | Niski | DFS O(V+E); dla typowych budowlanych WBS (<200 zadań) bez problemu |
| R4 | LRM rounding przy bardzo krótkich batchach (<3 dni) | Niskie | Niski | Min 1 dzień; residual absorbowany przez miesiąc/tydzień z max overlap |
| R5 | Baseline capture: jeśli execution schedule nie istnieje — brak baseline | Niskie | Niski | `capture-baseline` wymaga istnienia execution schedule lub tworzy je implicitly |
| R6 | calculation_line_id = opaque UUID: przy usunięciu linii kalkulacji batch ma orphaned FK | Niskie | Niski | ON DELETE SET NULL lub serwis nulluje przy archiwizacji linii |
| R7 | MS Project XML — wiele wersji formatu; pola zróżnicowane | Wysokie | Niski | v2 po potwierdzeniu; v1 = XLSX/CSV |
| R8 | Kolizja zakładek deala (project_costing + project_schedule) | Niskie | Niski | Różne groupId; priorytet steruje kolejnością |
| R9 | Auto-scheduling propagacja: nieskończona pętla przy is_pinned nieprzypisanym i cyklu | Niskie | Wysoki | Walidacja cykli przy zapisie zależności (§6.4 422 DEPENDENCY_CYCLE) + max-depth guard w propagacji |
| R10 | Offer→execution subscriber (`customers.deal.won`): brak gwarancji dokładnie-raz | Niskie | Niski | `create-execution` idempotent (sprawdza existing execution schedule przed created) |

---

## 15. Pytania otwarte do Marka

*(Wszystkie pytania odpowiedziane przez Marka w rev 7. Szczegóły w §16 i Changelog.)*

| Pytanie | Odpowiedź Marka | Implementacja |
|---------|-----------------|---------------|
| Rescheduling automatyczny? | TAK — auto-scheduling server-side, manual override per-task (`is_pinned`) | §3a, v1 |
| Cross-deal Gantt? | TAK — widok per inwestycja/projekt | §6.1, §7.3, v1 |
| MS Project XML? | v2+ — XLSX/CSV wystarczy na v1 | §6.7, v2 |
| Offer → Execution trigger? | TAK — event `customers.deal.won`; idempotent | §6.1 `create-execution`, v1 |
| SVAR PRO? | NIE — własna implementacja server-side | §3.2, §3a, §1.3 |

---

## 16. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | @svar-ui/react-gantt v2.8.1 (MIT, zweryfikowano z tarball): WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; milestones [niezwer.]; FS/SS/FF/SF auto-scheduling = własna implementacja server-side (NIE PRO — decyzja Marka rev 7) | React-native TS, aktywna (Oct 2026); frappe-gantt niewystarczający (brak WBS/milestones); PRO nie kupujemy |
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
| A13 | `ps_element_types` usunięte z project_schedule; typy elementów = `pc_element_types` (project_costing); referencja przez `element_type_code` string | Rev 7: project_schedule opcjonalny; costing musi posiadać element types niezależnie |
| A14 | Auto-scheduling v1 server-side (forward-pass DAG, dni kalendarzowe); v2 = dni robocze | Decyzja Marka rev 7: NIE PRO; własna impl.; calendars = v2 |
| A15 | Offer→execution trigger przez event `customers.deal.won` (nie `accepted`); idempotent `create-execution` | Decyzja Marka rev 7 |
| A16 | Cross-deal Gantt per inwestycja: dedykowana strona i endpoint `investment-schedules` | Decyzja Marka rev 7 |

---

## 17. Migracje i backward compatibility

Nowe tabele `ps_*` only. Kolejność: `ps_schedules` → `ps_schedule_tasks` → `ps_task_dependencies` → `ps_production_batches` → `ps_import_column_mappings` → `ps_external_integrations`.

---

## 18. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts, types.ts
├── api/
│   ├── schedules/[id]?/{activate,lock,duplicate,capture-baseline,create-execution,
│   │                    summary,forecast,export,import}/route.ts
│   ├── investment-schedules/route.ts          # cross-deal Gantt data
│   ├── tasks/[id]?/{batch,reschedule}/route.ts
│   ├── task-dependencies/[id]?/route.ts
│   ├── production-batches/[id]?/batch/route.ts
│   ├── import-column-mappings/[id]?/route.ts
│   └── external-integrations/[id]?/webhook/[integrationId]/route.ts
├── backend/project-schedule/
│   ├── schedules/[id]/, investments/[id]/gantt/, settings/
├── components/
│   ├── GanttChart.tsx          # @svar-ui/react-gantt wrapper (client-only)
│   ├── WBSTreeColumn.tsx
│   ├── TaskSidePanel.tsx       # includes is_pinned toggle
│   ├── BatchListView.tsx
│   ├── ForecastMiniature.tsx
│   └── InvestmentGanttView.tsx # cross-deal Gantt
├── data/entities.ts + validators.ts
├── i18n/pl.json + en.json
├── migrations/Migration20261019*.ts
├── subscribers/
│   ├── calculationActivated.ts
│   └── dealWon.ts              # trigger offer→execution transition
├── widgets/DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── auto-scheduling.service.ts  # §3a forward-pass DAG propagation
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
| 2026-10-19 | v4 (rev 6) — wariancja baseline: ON READ (start/end/duration/actual), §2.2 ps_schedule_tasks, API §6.2, Gantt tooltip+overlay §3.3, v1 +1d; ScheduleBatchSummary.dealId string|null; combined 83→85d |
| 2026-10-19 | **v5 (rev 7)** — Decyzje Marka: auto-scheduling server-side (NIE PRO) — §3.2, §3a, v1 +3d; cross-deal Gantt per inwestycja — §6.1, §7.3, v1 +2d; MS Project = v2+ potwierdzone; offer→execution trigger przez `customers.deal.won` event — §6.1, v1 +0.5d; SVAR PRO = NIE. Moduł OPCJONALNY (feature toggle, §1.1, Streszczenie). `ps_element_types` usunięte — przeniesione do `project_costing` jako `pc_element_types`; referencja przez `element_type_code` string (§2.2, §5.2, §6.1, §17, A13). `ps_schedules.auto_scheduling_enabled` + `ps_schedule_tasks.is_pinned` dodane (§2.2). `ps_production_batches.element_type_id` → `element_type_code` (§2.2). §15 pytania usunięte (wszystkie odpowiedziane). Wysiłek: MVP 15→14d (-1d element_types), v1 6→11d (+auto-sched+cross-deal+trigger), v2 10d; total schedule 31→35d; combined 85→94.5d. A13-A16 dodane |
| 2026-10-19 | v3 patch (b) — ps_schedules.deal_id nullable (kalkulacja standalone może mieć harmonogram bez deala); combined table zaktualizowane: project_costing 53d + project_schedule 30d = 83d |
| 2026-10-19 | v3 patch (a) — @svar-ui/react-gantt 2.8.1 MIT/PRO zweryfikowane z tarball: MIT core ma WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; FS/SS/FF/SF auto-scheduling = PRO only; CPM/baselines/MS Project = PRO; milestones [niezwer.]; zaktualizowano §3.1 tabela, §3.2 (MIT/PRO split), §3.3, GanttChart.tsx, R1, A1; dodano pytanie otwarte o SVAR PRO vs impl. własna (§15 pkt 5) |
