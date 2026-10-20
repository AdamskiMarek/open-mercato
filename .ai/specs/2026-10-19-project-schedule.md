# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-20 (rev 8a — P0 architecture, MVP cut, OM sections, honest estimate; poprzednio v7 2026-10-19) |
| **Moduł** | `project_schedule` (`apps/mercato/src/modules/project_schedule`) |
| **Zależności upstream** | **`project_costing` (moduł bazowy)**, `customers`, `dictionaries`, `dashboards`, `attachments`, `notifications`, `configs`, `feature_toggles`, `audit_logs`, `query_index`, `progress` |
| **Powiązany spec** | `.ai/specs/2026-10-19-project-costing-offer-calculator.md` |
| **Kierunek zależności** | rev 8a: `project_schedule` (opcjonalny) **zależy od** `project_costing` (baza) i rejestruje provider `ScheduleSource` w DI; `project_costing` nigdy nie importuje `project_schedule` (Kod P0-1) |

---

## TLDR

- **Co:** opcjonalny moduł aplikacji `project_schedule`: harmonogram produkcji z Ganttem (WBS, milestone'y, zależności FS/SS/FF/SF + lag, auto-przesuwanie z przypinaniem, baseline), partie produkcji i prognoza 6 mies. Jeden Gantt na inwestycję (D23).
- **Faza (rev 8a):** cały moduł poza MVP — **v1** (34 d), integracje zewnętrzne i CPM w **v2** (16 d). MVP kalkulatora działa bez niego (partie w kalkulacji, `ScheduleSource` embedded).
- **Architektura:** `project_schedule` **zależy od** `project_costing` (moduł bazowy) i rejestruje `InternalScheduleSource` w `scheduleSourceRegistry` (DI). Costing nigdy nie importuje schedule. Zero HTTP między modułami: typy elementów przez `elementTypeService`, kalkulacje przez `calculationLookupService`, sumy w costingu przez komendę `refresh_schedule_totals`.
- **Włączanie per organizacja:** `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant (§1.0).
- **Gantt:** SVAR React Gantt MIT core + własny auto-scheduling, CPM, baseline, undo i linia „dziś”; **bez SVAR PRO** (D21).
- **Wycena:** 50 d (MVP 0 / v1 34 / v2 16); oba moduły 151 d (§13).

---

## Streszczenie

Moduł `project_schedule` dostarcza interaktywny harmonogram produkcji z widokiem Gantt (WBS + drag & drop; rev 8a: cały moduł w v1). Rev 5 dodaje:
- **Dwa typy harmonogramów**: `offer` (szacunki na etapie ofertowania) i `execution` (harmonogram realizacji).
- **WBS z hierarchią** (`parent_task_id`) i **milestones** (zero-duration).
- **Zależności zadań**: FS / SS / FF / SF + lag (dni, może być ujemny); walidacja cykli.
- **Baseline**: zrzut harmonogramu ofertowego przy przejściu do realizacji; wariancja.
- **ProductionBatch** powiązany z zadaniem WBS i opcjonalnie z linią kalkulacji (`calculation_line_id` = opaque UUID).
- **Prognoza 6 miesięcy** (tygodnie i miesiące) z opcjonalnym ważeniem prawdopodobieństwem deala.

> **Moduł opcjonalny**: `project_schedule` jest opcjonalny per firma (organizację) — §1.0. `project_costing` działa poprawnie bez tego modułu dzięki abstrakcji `ScheduleSource` (patrz `project_costing` §7a). Gdy moduł jest wyłączony, costing korzysta z `calculation_embedded` lub `xlsx_import` source.

Właściciel `ps_schedule_tasks` (zadania WBS) i `ps_production_batches` (partie produkcji). **Typy elementów** (`pc_element_types`) są własnością `project_costing` i referencjonowane przez `element_type_code` (string, nie FK). Rev 8a: `project_costing` dostaje dane wyłącznie przez `ScheduleSource` zarejestrowany przez ten moduł w DI (zero HTTP).

---

## 0. Architecture (rev 8a)

```
project_costing (BAZA)                               project_schedule (OPCJONALNY KONSUMENT)
  ScheduleSource, scheduleSourceRegistry   <─register── di.ts: InternalScheduleSource
  elementTypeService                       <─resolve─── typy elementów (element_type_code)
  calculationLookupService                 <─resolve─── cross-deal Gantt per inwestycja
  projectCostingSettings                   <─resolve─── schedule.enabled per organizacja
  komenda refresh_schedule_totals          <─execute─── subscriber na własne eventy schedule (kolejka, debounce)
  eventy project_costing.calculation.*     ──event────> subscribers/calculationActivated.ts, calculationDeleted.ts
customers: eventy customers.deal.won ──────────────────> subscribers/dealWon.ts (offer → execution)
```

- Kierunek: `project_schedule` → `project_costing` (import typów/tokenów DI, subskrypcja eventów). Odwrotnie nic: costing nie zna eventów, tras ani tabel schedule (`packages/core/AGENTS.md` § Cross-Module Coupling).
- Zero HTTP między modułami. Wszystkie wcześniejsze wywołania HTTP (`GET /api/project-costing/element-types`, `GET /api/project-schedule/schedules/:id/summary` wołane przez costing) zastąpione serwisami DI.
- Brak relacji ORM i constraintów DB do tabel `pc_*`; `calculation_id`, `calculation_line_id` to FK-id; sprzątanie przez subscriber `project_costing.calculation.deleted`.
- Zapisy przez komendy (`audit_logs`, undo), CRUD przez `makeCrudRoute` + indexer, `openApi` na trasach. Eventy z payloadem = ID.
- Gdy moduł nie jest w buildzie albo jest wyłączony: costing działa (fallback `EmbeddedScheduleSource`); `packages/core/src/__tests__/module-decoupling.test.ts` jako wzór testu.



---

## 1. Cel i zakres

### 1.0 Włączanie modułu per organizacja (rev 8a, decyzja Koordynatora (d))

„Firma” = organizacja OM (D15). Zweryfikowano w kodzie core (gałąź spec, 2026-10-20):
- **Build:** moduły włącza lista w `apps/mercato/src/modules.ts`; nie ma rejestru modułów włączanego w runtime.
- **`feature_toggles` działa per tenant:** `packages/core/src/modules/feature_toggles/lib/feature-flag-check.ts` rozwiązuje toggle po `(identifier, tenantId)` (klucz cache `feature_toggles:resolution:{identifier}:{tenantId}`, override `FeatureToggleOverride` szukany po `tenantId`) — brak wymiaru organizacji.
- **`ModuleConfigService` nie ma natywnego scope organizacji:** `packages/core/src/modules/configs/lib/module-config-service.ts` — `getRecord` szuka po `(moduleId, name, tenantId)` i fallbacku globalnym; `organizationId` zapisywany jest tylko jako metadana. Wartość per organizacja = osobna nazwa klucza z `organizationId` (costing §2.2).

Mechanizm (potwierdzony przez Koordynatora 2026-10-20): **włącznik per organizacja = ModuleConfigService (`module_configs`)**, razem z feature'ami ACL i blokadami w menu i API; **`feature_toggles` = wyłącznie globalny kill-switch per tenant**. Wszystkie warunki muszą być spełnione:

| Warstwa | Mechanizm | Zakres | Rola |
|---|---|---|---|
| 1. Build | `project_schedule` w `apps/mercato/src/modules.ts` | instancja | moduł istnieje w aplikacji |
| 2. Tenant | feature toggle `project_schedule` (moduł `feature_toggles`), domyślnie włączony | tenant | **tylko globalny kill-switch** — operator może awaryjnie wyłączyć moduł w całym tenancie; nie służy do włączania per firma |
| 3. Organizacja | ustawienie `schedule.enabled` w ModuleConfigService (`module_configs`; `project_costing`, klucz `org:{organizationId}:settings`, czytany przez `projectCostingSettings`) | organizacja | **włącznik per firma** — admin organizacji (`project_costing.admin`) |
| 4. Użytkownik | feature'y ACL `project_schedule.view/edit/import/export/admin` (§9) | rola | kto w organizacji widzi i edytuje harmonogram |

`isScheduleEnabled(ctx) = !killSwitchOff(tenantId) && settings(organizationId).schedule.enabled`; dostęp użytkownika dodatkowo wymaga feature'a ACL. Blokady, gdy `false`:
- **menu:** pozycje backendu `project-schedule` ukryte (guard w definicji strony/menu);
- **zakładka deala:** widget `DealScheduleTab` na `detail:customers.deal:tabs` nie renderuje się (warunek w widgecie, dane z endpointu statusu);
- **API:** route guard we wszystkich trasach `/api/project-schedule/*` → `404 { code: 'MODULE_DISABLED' }` (jeden wspólny wrapper; test integracyjny per grupa tras);
- **DI/costing:** `InternalScheduleSource.isAvailable()` = `false` → costing przechodzi na `EmbeddedScheduleSource`;
- **subscribery** schedule (np. `dealWon`) są no-op dla organizacji z wyłączonym modułem.

Wyłączenie nie usuwa danych (Q4 w costing §16). Ustawienie trzyma costing, bo moduł bazowy jest zawsze obecny, a schedule tylko je czyta przez DI — kierunek zależności się nie odwraca.


### 1.1 Zakres harmonogramu z WBS i Gantt (rev 8a: przeniesiony z MVP do **v1**)

> Rev 8a (Kod p15): moduł nie wchodzi do MVP; MVP kalkulatora liczy prognozę z partii w kalkulacji (`calculation_embedded`). Gdy moduł nieaktywny w organizacji, `project_costing` używa `ScheduleSource = calculation_embedded`.

- `ps_schedules` z typem `offer` / `execution` + `auto_scheduling_enabled`.
- `ps_schedule_tasks`: hierarchia WBS, milestones, pola baseline, `is_pinned` (manual override).
- `ps_task_dependencies`: FS/SS/FF/SF + lag; walidacja cykli.
- `ps_production_batches`: partia produkcji powiązana z zadaniem; `element_type_code` (string, ref do `pc_element_types`).
- Gantt z WBS tree, milestones, dependency arrows (v1).
- Zakładka „Harmonogram" na karcie Deala.
- Prognoza 6 miesięcy (LRM rounding).

### 1.2 Faza v1 (cd.) — Import/eksport, baseline i auto-scheduling

- Import/eksport XLSX/CSV harmonogramu.
- `ps_import_column_mappings`.
- Baseline capture (offer → execution transition).
- **Auto-scheduling server-side** (FS/SS/FF/SF + lag propagacja; `is_pinned` manual override; `auto_scheduling_enabled` per harmonogram).
- Trigger `offer → execution` gdy deal WON (subscriber `customers.deal.won`; idempotent).
- **Cross-deal Gantt** per inwestycja/projekt.
- Odświeżanie sum w `project_costing` przez komendę `refresh_schedule_totals` (DI) z subscribera tego modułu.

### 1.3 Faza v2 — Integracje zewnętrzne i krytyczna ścieżka

- Provider/adapter interface + webhooks (Standard Webhooks).
- Import MS Project XML (v2+ — potwierdzone przez Marka).
- **Algorytm CPM** (Critical Path Method — ES/EF/LS/LF/float) server-side; renderowanie `is_critical_path` przez custom CSS overlay na pasku.

### 1.4 Granica z `project_costing` (rev 8a)

| Pytanie | Odpowiedź |
|---------|-----------|
| Kierunek zależności? | `project_schedule` → zależy od `project_costing` (baza). Costing nie importuje, nie resolve'uje i nie wymaga schedule. |
| Kto posiada typy elementów? | `project_costing` (`pc_element_types`); `project_schedule` czyta je przez serwis DI `elementTypeService` i referencjonuje przez `element_type_code` (string) — brak FK do costing |
| Kto posiada `ps_schedule_tasks`, `ps_production_batches`? | `project_schedule` |
| Jak `project_costing` dostaje dane harmonogramu? | Przez `ScheduleSource`: `project_schedule` rejestruje `InternalScheduleSource` w `scheduleSourceRegistry` (DI). Zero HTTP. |
| Jak sumy w `pc_calculations` są odświeżane? | Subscriber schedule na własne eventy → komenda costingu `refresh_schedule_totals` (DI, kolejka z debounce) |
| Czy `project_schedule` jest wymagany przez costing? | NIE — fallback `EmbeddedScheduleSource` (costing §7a) |
| Skąd prawdopodobieństwo do prognozy? | Parametr `?probability=` albo `deal_snapshot` kalkulacji (przez `calculationLookupService`) |


---

## 2. Model danych

### 2.1 Konwencje

`organization_id` + `tenant_id`, UUID PK, FK-id bez ORM relation, `updated_at`.

**Rev 8a:** każda encja domenowa `ps_*` ma `deleted_at timestamptz NULL` (soft delete, `packages/core/AGENTS.md` § Database Entities); zapytania i indeksy unikalne filtrują `deleted_at IS NULL`. FK-id do tabel `pc_*` bez constraintu DB.

### 2.2 Tabele

> **Uwaga**: tabela `ps_element_types` została przeniesiona do `project_costing` jako `pc_element_types` (rev 7). `project_schedule` referencjonuje typy elementów przez `element_type_code` (opaque string) pobrany z serwisu DI `elementTypeService` (rev 8a; zamiast `GET /api/project-costing/element-types`).

#### `ps_schedules` — głowa harmonogramu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NULL | FK-id → customer_deals; NULL = harmonogram bez deala (kalkulacja standalone) |
| `calculation_id` | `uuid` NULL | FK-id → pc_calculations (bez constraintu DB; rev 8a: przy `project_costing.calculation.deleted` subscriber tego modułu ustawia NULL) |
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
| **@svar-ui/react-gantt MIT core** | **MIT ✅** | **✅ TS, React 19/Next.js** | **✅** | **✅** (rev 8a, review Kod p20) | **✅** | ❌ PRO | ❌ PRO | ❌ PRO | ~100–200 KB [niezwer.] | Zweryfikowano z tarball; 17 @svar-ui/* + date-fns |
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

**Decyzja (rev 8a, D21, zamknięte pytanie pkt 20): Gantt = własna implementacja na SVAR MIT core, BEZ SVAR PRO.** Uzasadnienie: PRO dla SaaS wymaga licencji Application ($1,899); tańsza Developer ($749) zabrania użycia w SaaS; własny kod daje pełną kontrolę (bez uzależnienia od vendora, licencji per produkt i paywalla przy kolejnych funkcjach). Koszt świadomie przyjęty: ~10,5 d (auto-scheduling 3,5 + własne elementy UI ~2 + CPM 3 + kalendarz dni roboczych 2), ujęty w wycenie §12.

Fakty SVAR wg review Kod (p20): w MIT są summary, **milestone'y**, zależności (wyświetlanie/edycja), hierarchia, drag/resize, edycja w gridzie, szablony pasków (baseline da się narysować samemu), wirtualizacja, import z Excela. `wbs_code` = własna kolumna (kody WBS są w PRO). W MIT **nie ma undo przy drag ani linii „dziś”** (vertical markers) — robimy je sami.

**Wyłącznie w SVAR PRO — NIE kupujemy (D21)**:
- ❌ Auto-scheduling FS/SS/FF/SF z lag i constraints → **własna implementacja server-side** (v1, patrz §3a)
- ❌ Critical Path Method (CPM, slack, deadlines) → **własna implementacja server-side** (v2, CPM w `lib/critical-path.ts`)
- ❌ Baselines / progress line / S-curve → **własne overlays/markery** (custom task renderer)
- ❌ Working calendars, resources → poza scope
- ❌ MS Project import/export (wbudowane) → **server-side parser XML** (v2)
- ❌ Summary-task automation, split tasks
- ❌ Undo/redo, vertical markers (linia „dziś”), kody WBS → **własne**: stos undo dla operacji drag (komendy z undo), marker „dziś” w szablonie skali, `wbs_code` jako kolumna

**Milestones**: ✅ w MIT (rev 8a — wg review Kod p20; usunięto [niezwer.] i plan B).

**Implikacje dla projektu:**
- WBS tree, drag&drop, dependency links: ✅ MIT — bez dodatkowych kosztów.
- FS/SS/FF/SF **type labels i lag renderowanie**: client-side custom CSS overlay na linkach; propagacja dat = server-side (§3a).
- **Auto-scheduling** (propagacja dat): server-side v1 (§3a); MIT core renderuje wynikowe daty bez auto-scheduling UI.
- **CPM rendering**: server-side algorytm (v2) → `is_critical_path: bool` na zadaniu → custom CSS class na pasku.
- **Baseline wizualizacja**: custom overlay/marker na pasku zadania (`baseline_start/end_at`).
- **MS Project import/export**: server-side parser (v2, `exceljs`/`xml2js`), nie PRO.

### 3.3 Wymagania Gantt (rev 8a: v1)

- **WBS tree**: ✅ MIT.
- **Milestones** (zero-duration, diamond): ✅ MIT.
- **Drag & drop** (move + resize): ✅ MIT. Po przesunięciu → PATCH do API → serwis propaguje daty successor-ów (gdy `auto_scheduling_enabled = true`; §3a) → live update w Gantt.
- **Dependency links** (strzałki): ✅ MIT. Etykiety typ (FS/SS/FF/SF) + lag = custom CSS nad linkami.
- **Przełącznik Day / Week / Month**: ✅ MIT.
- **Baseline overlay** (v1): custom rendering — dla każdego zadania z `baseline_start_at` rysowany dodatkowy cienki pasek (np. szary, za/przed głównym) przez custom task renderer w @svar-ui. Tooltip: `Baseline: ${baseline_start} – ${baseline_end} | Odchylenie: ${start_variance_days}d start, ${end_variance_days}d koniec`.
- **Linia „dziś”** i **undo przy drag**: własne (brak w MIT).
- **`wbs_code`**: własna kolumna w gridzie.
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

### 5.2 Kontrakty DI między modułami (rev 8a — zastępuje „API konsumowane przez `project_costing`”)

Kierunek: `project_schedule` używa kontraktów `project_costing` i rejestruje w nim swój provider. Zero HTTP.

| Kontrakt (DI) | Właściciel | Użycie w `project_schedule` |
|---|---|---|
| `scheduleSourceRegistry.register(InternalScheduleSource)` | costing | `di.ts` tego modułu rejestruje provider; `getBatches`/`getSummary`/`isAvailable` czytają `ps_*` przez `schedule.service` |
| `elementTypeService` | costing | lista i walidacja `element_type_code` w formularzach i imporcie |
| `calculationLookupService.getById / listByInvestment` | costing | powiązanie harmonogramu z kalkulacją, cross-deal Gantt (§7.3) |
| `projectCostingSettings` | costing | `schedule.enabled` per organizacja (§1.0) |
| komenda `project_costing.calculations.refresh_schedule_totals` | costing | wywoływana z subscribera tego modułu po `schedule.rescheduled` / `batch.*` (kolejka, debounce) |

Endpointy `/api/project-schedule/*` (§6) służą UI i klientom zewnętrznym, nie innym modułom.

> **Typy elementów**: `project_schedule` czyta je przez `elementTypeService` (DI). Brak własnego endpointu dla element-types w `project_schedule`.

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
project_schedule.schedule.rescheduled   (rev 8a: jeden event z listą ID po propagacji, zamiast task.updated per zadanie — szczegóły rev 8b, Kod p12)
```

Rev 8a: payload = ID (`id`, `scheduleId`, `organizationId`, `tenantId`, `calculationId?`); `clientBroadcast` tylko z ID.

### 5.4 Kierunek zależności i opcjonalność modułu (rev 8a)

`project_schedule` zależy od `project_costing`: może importować typy (`ScheduleSource`, `ProductionBatchSummary`) i tokeny DI costingu oraz subskrybować `project_costing.calculation.*`. `calculation_id` i `calculation_line_id` to FK-id bez constraintu DB; `element_type_code` i `segment_code` to stringi.

`project_costing` nie ma żadnej zależności od `project_schedule`: nie importuje jego kodu, nie zna jego eventów ani tras. Gdy moduł jest nieobecny w buildzie albo wyłączony w organizacji (§1.0), w `scheduleSourceRegistry` nie ma `InternalScheduleSource` albo zwraca on `isAvailable() = false`, a costing używa `EmbeddedScheduleSource`. Subscribery `calculationActivated.ts`/`calculationDeleted.ts` są po stronie właściwego modułu — tego (konsumenta).

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Optimistic locking. Rev 8a: każda trasa za wspólnym guardem `isScheduleEnabled` (§1.0) → `404 MODULE_DISABLED`; `openApi` na trasach; CRUD przez `makeCrudRoute` + indexer; zapisy przez komendy.

> **Typy elementów**: brak własnych endpointów w `project_schedule` — zarządza nimi `project_costing` (UI administracji); ten moduł czyta je przez `elementTypeService` (DI).

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

**Cross-deal Gantt per inwestycja**: `GET /api/project-schedule/investment-schedules?investmentId=` — agreguje harmonogramy wielu deali powiązanych z daną inwestycją (rev 8a: `projectId` usunięte — jedna encja inwestycji `pc_investments`). Zwraca tasks z `dealId` i `calculationId` per każde zadanie. UI: `/project-schedule/investments/:investmentId/gantt`.

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

### 7.1 Zakładka „Harmonogram" na karcie Deala (v1)

Rev 8a: widget renderuje się tylko gdy `isScheduleEnabled` dla organizacji i użytkownik ma `project_schedule.view` (§1.0).

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
// Milestones: ✅ MIT (rev 8a); linia „dziś” i undo przy drag: własne
// FS/SS/FF/SF auto-scheduling: PRO only; MIT renderuje linki (custom etykiety type/lag)
// Baseline overlay: custom rendering (not PRO) — dodatkowy div per task
// Dokładne API props (@svar-ui/react-gantt): zweryfikuj w svar.dev/react/gantt/docs
```

Zaktualizuj API call po weryfikacji docs: propsName onTaskUpdate/onChange, format zadania (id, start, end, parent, type: 'milestone'|'task', dependencies).

Drag&drop callback → `PATCH /api/project-schedule/tasks/:id`.

### 7.3 Cross-deal Gantt per inwestycja/projekt

Strona `/project-schedule/investments/:investmentId/gantt`. Aggregowany widok Gantt zadań ze wszystkich harmonogramów powiązanych z daną inwestycją. Rev 8a (bez joinu do tabel costingu): `calculationLookupService.listByInvestment(investmentId)` (DI, costing) zwraca ID kalkulacji, a ten moduł filtruje `ps_schedules WHERE calculation_id IN (...)`. To zależność schedule → costing (dozwolona), nie odwrotnie. Zadania kolorowane per deal. Umożliwia planowanie zasobów produkcyjnych dla całej inwestycji.

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

Rev 8a — role OM (`superadmin`, `admin`, `employee`; ról `manager`/`sales` nie ma): `admin` → wszystkie; `employee` → `view`, `edit`, `import`, `export` (propozycja). Feature'y w `setup.ts` `defaultRoleFeatures`. `project_schedule.admin` obejmuje integracje zewnętrzne; włącznik modułu w organizacji wymaga `project_costing.admin` (ustawienie costingu, §1.0).

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

## 12. Fazy i szacowanie wysiłku (rev 8a — przeliczone od zera)

Metoda i stawki jak w costing §14: prace domenowe (D) osobno od narzutu OM (O: per encja 0,5 d — migracja, zod, komendy z undo, `makeCrudRoute` + `openApi` + indexer, granty; per ekran 0,4 d; i18n; ~0,1 d testu integracyjnego na trasę; unit Jest), plus bufor 10%. Gantt bez SVAR PRO (D21) — koszt własnych elementów jest w pozycjach D3, D4 (v1) i D5–D6 (v2).

### Faza MVP (0 dni)

Moduł poza MVP (Kod p15). MVP kalkulatora: partie produkcji w kalkulacji i prognoza 6 mies. przez `EmbeddedScheduleSource` (costing §14 MVP D10).

### Faza v1 (34 dni roboczych)

Encje: 5 (`ps_schedules`, `ps_schedule_tasks`, `ps_task_dependencies`, `ps_production_batches`, `ps_import_column_mappings`). Trasy API: 33 (schedules CRUD 4 + activate/lock/duplicate/capture-baseline/create-execution 5 + summary/forecast/export/import 4, investment-schedules 1, tasks 4 + batch 1 + reschedule 1, task-dependencies 4, production-batches 4 + batch 1, import-column-mappings 4). Ekrany: 4 (lista harmonogramów, szczegóły/Gantt, ustawienia, Gantt inwestycji); zakładka deala liczona w D.

| # | Zadanie | Dni |
|---|---------|-----|
| D1 | Szkielet modułu, gating per organizacja (§1.0: guard API, menu, widget), rejestracja `InternalScheduleSource` w DI, subscribery `calculationActivated`/`calculationDeleted` | 1,5 |
| D2 | Logika domenowa: harmonogramy offer/execution, WBS (summary z dzieci), zależności z walidacją cykli, partie | 3 |
| D3 | Własny silnik auto-scheduling (max po wszystkich poprzednikach, milestone 0, konwencja daty końca, naruszenia przypiętych zadań, `schedule.rescheduled`) — zamiast SVAR PRO | 3,5 |
| D4 | Gantt: SVAR MIT core + własne: etykiety zależności, linia „dziś”, undo przy drag, baseline overlay, `wbs_code`; zakładka deala | 5 |
| D5 | Baseline capture, offer → execution (`customers.deal.won`, persistent, idempotent), wariancja | 2 |
| D6 | Cross-deal Gantt per inwestycja (`calculationLookupService`) | 2 |
| D7 | Import/eksport XLSX harmonogramu (ProgressJob + worker) | 2,5 |
| D8 | Prognoza z harmonogramu (LRM) + odświeżanie sum costingu (komenda DI, kolejka, debounce) | 1,5 |
| | **Suma prac domenowych** | **21** |
| O1 | Narzut OM per encja: 5 × 0,5 | 2,5 |
| O2 | `CrudForm`/`DataTable`: 4 ekrany × ~0,4 | 1,5 |
| O3 | i18n pl/en | 0,5 |
| O4 | Testy integracyjne: 33 trasy × ~0,1 | 3,5 |
| O5 | Testy unit (scheduler, cykle, LRM, wariancja) | 2 |
| | **Suma narzutu OM** | **10** |
| B | Bufor 10% | 3 |
| | **Suma v1** | **34** |

### Faza v2 (16 dni roboczych)

| # | Zadanie | Dni |
|---|---------|-----|
| D1 | `ps_external_integrations` + provider interface + registry | 1,5 |
| D2 | Inbound webhook (Standard Webhooks HMAC, idempotentność) | 1,5 |
| D3 | Outbound webhook (zmiana dat, retry przez kolejkę) | 1,5 |
| D4 | Import MS Project XML (D25: od v2) | 2,5 |
| D5 | Własny CPM (forward/backward pass, float, `is_critical_path`) — zamiast SVAR PRO | 3 |
| D6 | Kalendarz dni roboczych w auto-schedulingu i wariancji — zamiast SVAR PRO | 2 |
| | **Suma prac domenowych** | **12** |
| O | Narzut OM: 1 encja (0,5), ~5 tras (0,5), testy (1), i18n (0,5) | 2,5 |
| B | Bufor 10% | 1,5 |
| | **Suma v2** | **16** |

**Łącznie `project_schedule`**: 0 + 34 + 16 = **50 dni roboczych**.

---

## 13. Podsumowanie zbiorcze (oba moduły) — rev 8a

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 40 d | 45 d | 16 d | 101 d |
| `project_schedule` | 0 d | 34 d | 16 d | 50 d |
| **Łącznie** | **40 d** | **79 d** | **32 d** | **151 d** |

Jednostka: dzień roboczy doświadczonego dewelopera znającego OM. Każda faza zawiera osobne pozycje na narzut OM (encje, ekrany, i18n, testy) i bufor 10%. Szczegóły: costing §14, schedule §12. Tabela identyczna jak w costing §14.

**Porównanie z szacunkiem Kod (review PR #10, 2026-10-19):** Kod: przycięte MVP ~25–30 d, całość ~150–170 d, MVP bez przycięcia ~50–60 d; rev 7: 94,5 d. Rev 8a: MVP 40 d = ~31,5 d dla zakresu Kod (górna granica jego widełek) + import XLSX w MVP (decyzja Koordynatora (a): ~3,5 d domeny + ~1,5 d narzutu) + bufor 3,5 d. Całość 151 d mieści się w widełkach Kod. Różnica względem rev 7 (+56,5 d) to głównie narzut OM liczony jawnie (~52 d we wszystkich fazach), bufor (~15 d) i własny Gantt bez SVAR PRO (~10,5 d: auto-scheduling 3,5 + własne elementy UI ~2 + CPM 3 + kalendarz dni roboczych 2).

---

## 14. Risks (rev 8a — z ryzykiem rezydualnym)

| # | Scenariusz awarii | Obszar | Ważność | Mitygacja | Ryzyko rezydualne |
|---|---|---|---|---|---|
| R1 | Własny auto-scheduling/CPM (bez SVAR PRO) daje błędne daty | Algorytmy | Wysoka | Czysta funkcja schedulera + testy unit na przypadkach brzegowych (wielu poprzedników, milestone, pinned); szczegóły rev 8b (Kod p12) | Średnie — przypadki brzegowe wyjdą w użyciu |
| R2 | SSR Next.js + SVAR wymaga DOM | UI | Średnia | `dynamic(..., { ssr: false })` | Niskie |
| R3 | Walidacja cykli przy setkach zależności | Wydajność | Niska | DFS O(V+E); WBS budowlane < 200 zadań | Niskie |
| R4 | LRM przy bardzo krótkich partiach (< 3 dni) | Prognoza | Niska | Min. 1 dzień; residual do okresu z największym overlapem | Niskie |
| R5 | Brak execution schedule przy capture-baseline | Dane | Niska | `capture-baseline` tworzy execution, jeśli brak | Niskie |
| R6 | Osierocone `calculation_line_id`/`calculation_id` po usunięciu w costingu | Dane | Niska | Subscriber `project_costing.calculation.deleted` nulluje FK-id | Niskie |
| R7 | Wiele wersji formatu MS Project XML | Import (v2) | Niska | v2; v1 = XLSX/CSV | Niskie |
| R8 | Kolizja zakładek deala (costing + schedule) | UI | Niska | Różne `groupId`, priorytet | Niskie |
| R9 | Nieskończona propagacja przy cyklu | Algorytmy | Wysoka | Walidacja cykli przy zapisie (422 `DEPENDENCY_CYCLE`) + limit głębokości | Niskie |
| R10 | `customers.deal.won` dostarczony więcej niż raz | Integracja | Niska | `create-execution` idempotentne; subscriber persistent | Niskie |
| R11 | Organizacja wyłącza moduł, a dane/subscribery dalej działają | Konfiguracja | Średnia | Guard API + no-op subscriberów + `isAvailable() = false` (§1.0); test integracyjny wyłączenia | Niskie |
| R12 | Kill-switch tenanta wyłączony przez pomyłkę ukrywa harmonogramy wszystkich organizacji | Konfiguracja | Średnia | Toggle domyślnie włączony; dane nieusuwane | Niskie |
| R13 | Koszt własnego Gantta wyższy niż ~10,5 d | Plan | Średnia | Bufor 10%; PoC Gantta przed D4 | Średnie (świadoma decyzja D21) |

---

## 15. Pytania otwarte do Marka

*(Rev 8a: brak nowych pytań dla tego modułu. Pytanie Q4 o wyłączanie modułu w organizacji z danymi — costing §16.)*

| Pytanie | Odpowiedź Marka | Implementacja |
|---------|-----------------|---------------|
| Rescheduling automatyczny? | TAK — auto-scheduling server-side, manual override per-task (`is_pinned`) | §3a, v1 |
| Cross-deal Gantt? | TAK — widok per inwestycja | §6.1, §7.3, v1 |
| MS Project XML? | v2+ — XLSX/CSV wystarczy na v1 | §6.7, v2 |
| Offer → Execution trigger? | TAK — event `customers.deal.won`; idempotent | §6.1 `create-execution`, v1 |
| SVAR PRO? (pkt 20, **zamknięte w rev 8a**) | NIE — własna implementacja na SVAR MIT core (D21) | §3.2 (uzasadnienie: Application $1,899, Developer $749 zabrania SaaS, kontrola nad kodem); koszt ~10,5 d w §12 |

---

## 16. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | @svar-ui/react-gantt v2.8.1 (MIT, zweryfikowano z tarball): WBS ✅, drag&drop ✅, dep links ✅, milestones ✅ (rev 8a), React 19/Next.js ✅; auto-scheduling, CPM, baseline, undo, linia „dziś”, kody WBS = własna implementacja (NIE PRO — D21) | React-native TS, aktywna (Oct 2026); frappe-gantt niewystarczający (brak WBS/milestones); PRO nie kupujemy |
| A2 | SSR: `dynamic(..., { ssr: false })` | Biblioteki Gantt wymagają DOM |
| A3 | **Rev 8a (poprawione):** `project_schedule` zależy od `project_costing` (baza) i rejestruje provider `ScheduleSource` w DI; costing nie importuje schedule; zero HTTP | Jednokierunkowa zależność (Kod P0-1; `packages/core/AGENTS.md` § Cross-Module Coupling) |
| A4 | Prognoza: endpoint `/forecast` z LRM + probability param | Precyzja LRM; probability = param (nie hardcoded) |
| A5 | MS Project XML w v2 po potwierdzeniu | Złożony format |
| A6 | `ps_import_column_mappings` — własna tabela | Niezależność modułów |
| A7 | ~~`ps_element_types` — własna tabela; costing czyta przez API~~ — nieaktualne (patrz A13; rev 8a: typy przez `elementTypeService` DI); porządek numeracji/A7–A13: rev 8b | — |
| A8 | LRM rounding m³ (3 d.p.) i szt. (int) per miesiąc i tydzień | `SUM(periodic) = batch_total` dokładnie |
| A9 | `ps_schedules` bez `currency` | Waluta = własność kalkulacji |
| A10 | Walidacja cykli: DFS synchroniczny | Typowe WBS < 200 zadań; wystarczające |
| A11 | `calculation_line_id` w `ps_production_batches` = FK-id bez constraintu DB | Brak relacji ORM/constraintów między modułami (rev 8a: schedule zależy od costing, ale nie przez FK DB) |
| A12 | `schedule_type: offer|execution`; baseline w polach `baseline_start/end_at` na `ps_schedule_tasks` | Upraszcza model; bez osobnej tabeli snapshot |
| A13 | `ps_element_types` usunięte z project_schedule; typy elementów = `pc_element_types` (project_costing); referencja przez `element_type_code` string | Rev 7: project_schedule opcjonalny; costing musi posiadać element types niezależnie |
| A14 | Auto-scheduling v1 server-side (forward-pass DAG, dni kalendarzowe); v2 = dni robocze | Decyzja Marka rev 7: NIE PRO; własna impl.; calendars = v2 |
| A15 | Offer→execution trigger przez event `customers.deal.won` (nie `accepted`); idempotent `create-execution` | Decyzja Marka rev 7 |
| A16 | Cross-deal Gantt per inwestycja: dedykowana strona i endpoint `investment-schedules` | Decyzja Marka rev 7 |

---

## 17. Migracje i backward compatibility

Nowe tabele `ps_*` only, wszystkie z `deleted_at` (rev 8a). Brak FK DB do `pc_*`. Kolejność: `ps_schedules` → `ps_schedule_tasks` → `ps_task_dependencies` → `ps_production_batches` → `ps_import_column_mappings` → `ps_external_integrations`.

---

## 18. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts (rejestracja providera w scheduleSourceRegistry), types.ts
├── commands/                    # rev 8a: zapisy przez komendy (undo, audit_logs)
├── workers/                     # import XLSX (ProgressJob)
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
│   ├── calculationActivated.ts  # event project_costing.* (ten moduł = konsument)
│   ├── calculationDeleted.ts    # nulluje calculation_id
│   ├── scheduleChanged.ts       # → komenda costingu refresh_schedule_totals (kolejka, debounce)
│   └── dealWon.ts              # trigger offer→execution transition (persistent)
├── widgets/DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── auto-scheduling.service.ts  # §3a forward-pass DAG propagation
    ├── forecast.ts              # pro-rata LRM + probability weighting
    ├── import.service.ts
    ├── cycle-detection.ts       # DFS cycle check
    ├── internal-schedule.source.ts  # implementacja ScheduleSource z project_costing; rejestrowana w di.ts
    ├── module-gate.ts           # isScheduleEnabled (§1.0): route guard, menu, widget
    └── external/provider.interface.ts + registry.ts
```

---

## 19. Final Compliance Report (rev 8a, vs `AGENTS.md`)

| Reguła | Źródło | Status |
|---|---|---|
| Sekcje TLDR, Architecture, Data Models, API Contracts, Risks (z rezydualnym), Final Compliance Report, Changelog | `.ai/specs/AGENTS.md` § Spec Content Checklist | ✅ TLDR, §0, §2, §6, §14, §19, Changelog |
| Kierunek zależności: opcjonalny konsument trzyma glue, baza go nie zna | `packages/core/AGENTS.md` § Cross-Module Coupling | ✅ §0, §1.4, §5 |
| Zero HTTP / relacji ORM między modułami | `packages/core/AGENTS.md` § Never; review Kod P0-1 | ✅ |
| Komendy, `makeCrudRoute` + indexer, `openApi` | `packages/core/AGENTS.md` § Always | ✅ §6 (szczegóły rev 8b) |
| Feature'y ACL w `setup.ts`; role admin/employee | `packages/core/AGENTS.md` § ACL Grant Sync | ✅ §9 |
| `deleted_at` | `packages/core/AGENTS.md` § Database Entities | ✅ §2.1 |
| Włączanie modułu zgodne z platformą (build, feature_toggles, module_configs) | `apps/mercato/src/modules.ts`, `feature-flag-check.ts`, `module-config-service.ts` | ✅ §1.0 |
| Import przez ProgressJob + worker | `packages/core/AGENTS.md` § Operation Progress | ✅ §12 v1 D7 (szczegóły rev 8b) |
| Testy integracyjne każdej trasy | root `AGENTS.md` l.166 | ✅ w wycenie (§12 O4) |
| Nowe zależności (`@svar-ui/*`) = ask first | root `AGENTS.md` l.26 | ⚠️ rev 8b (Kod p10) |

## 20. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-20)

| Punkt listy (Kod pN) | Wynik rev 8a |
|---|---|
| Komunikacja przez DI/eventy; zero HTTP (p1) | ✅ §0, §5.2 |
| Zależność jednokierunkowa; provider w rejestrze DI bazy (p1) | ✅ §5.2, §5.4 |
| Brak zapisów do cudzych tabel (p2) | ✅ sumy costingu przez jego komendę `refresh_schedule_totals` |
| Jedno pojęcie inwestycji (p11) | ✅ `projectId` usunięte; inwestycja = `pc_investments` |
| RBAC w `acl.ts`, role admin/employee (p4) | ✅ §9 |
| Pola ukryte poza eventami (p3) | ✅ eventy tylko z ID (§5.3) |
| Komendy + `audit_logs`; `makeCrudRoute` + `openApi` (p6) | ✅ §0, §6 |
| `deleted_at` (p20) | ✅ §2.1 |
| Ustawienia przez ModuleConfigService (**p7**) | ✅ **spełniony** — `schedule.enabled` w `module_configs` (§1.0) |
| Włączanie: build + feature_toggles + blokady menu/widget/API (**p7**) | ✅ **spełniony** — §1.0: ModuleConfigService per organizacja + ACL + blokady w menu, w zakładce `detail:customers.deal:tabs` i w API (route guard); `feature_toggles` per tenant tylko jako globalny kill-switch; źródła: `packages/core/src/modules/configs/lib/module-config-service.ts`, `packages/core/src/modules/feature_toggles/lib/feature-flag-check.ts` |
| Zakres „firmy” (**p7**) | ✅ **spełniony** — firma = organizacja (§1.0) |
| Statusy deala / `customers.deal.won` persistent (p5) | ⚠️ subscriber `dealWon` persistent; mapowanie statusów rev 8b |
| Import przez ProgressJob (p9) | ✅ §12 v1 D7; edge case'y rev 8b |
| Nowe zależności = ask first (p10) | ⚠️ rev 8b |
| Algorytmy harmonogramu (p12) | ⚠️ rev 8b (zakres i koszt w §12 v1 D3) |
| Wycena z narzutem OM (p16) | ✅ §12 |
| MVP pocięty po wartości (p15) | ✅ moduł poza MVP |
| Forma speki (p20) | ✅ |

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-20 | **rev 8a** — Review Kod (PR #10 rev 7) + decyzje Koordynatora/Marka. **P0-1:** kierunek odwrócony — `project_schedule` zależy od `project_costing` (baza) i rejestruje `InternalScheduleSource` w `scheduleSourceRegistry` (DI); usunięte HTTP (§5.2 `GET /api/project-costing/element-types` → `elementTypeService`; API konsumowane przez costing → kontrakty DI); join `ps_schedules.calculation_id → pc_calculations` opisany poprawnie (`calculationLookupService.listByInvestment`); subscriber `calculationActivated` po stronie tego modułu (konsumenta); odświeżanie sum costingu przez jego komendę `refresh_schedule_totals`; A3 poprawione; nowa §0 Architecture, §1.4, §5.4. **Decyzja (d) + potwierdzenie Koordynatora:** §1.0 — włącznik per organizacja = `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant (zweryfikowano w `feature-flag-check.ts` i `module-config-service.ts`; ModuleConfigService nie ma natywnego scope organizacji → klucz `org:{id}:settings`). **Pkt 20 zamknięte (D21):** Gantt własny na SVAR MIT, bez PRO (Application $1,899; Developer $749 zabrania SaaS; kontrola nad kodem); fakty SVAR: milestone'y w MIT (usunięte [niezwer.] i plan B), `wbs_code` własna kolumna, brak undo przy drag i linii „dziś” w MIT → własne. **P1-15:** cały moduł przeniesiony z MVP do v1. **P1-16:** wycena od zera z narzutem OM i buforem: 0 / 34 / 16 = 50 d; tabela zbiorcza identyczna z costing (151 d). `projectId` usunięte (jedna encja inwestycji). Role admin/employee (§9). Dodane: TLDR, Risks z ryzykiem rezydualnym, Final Compliance Report, Checklist compliance, `deleted_at`. Poza zakresem (rev 8b): Kod p12 (szczegóły algorytmu), A7/A13 (`element_type_id` w `ps_schedule_tasks`, `elementTypeId` w analytics), partie pc_/ps_, numeracja założeń. |
| 2026-10-19 | v1 (rev 3) — inicjalna spec |
| 2026-10-19 | v2 (rev 4) — Gantt MVP, @svar-ui, ps_element_types, ps_import_column_mappings, LRM |
| 2026-10-19 | v3 (rev 5) — …(jak poprzednio)… |
| 2026-10-19 | v4 (rev 6) — wariancja baseline: ON READ (start/end/duration/actual), §2.2 ps_schedule_tasks, API §6.2, Gantt tooltip+overlay §3.3, v1 +1d; ScheduleBatchSummary.dealId string|null; combined 83→85d |
| 2026-10-19 | **v5 (rev 7)** — Decyzje Marka: auto-scheduling server-side (NIE PRO) — §3.2, §3a, v1 +3d; cross-deal Gantt per inwestycja — §6.1, §7.3, v1 +2d; MS Project = v2+ potwierdzone; offer→execution trigger przez `customers.deal.won` event — §6.1, v1 +0.5d; SVAR PRO = NIE. Moduł OPCJONALNY (feature toggle, §1.1, Streszczenie). `ps_element_types` usunięte — przeniesione do `project_costing` jako `pc_element_types`; referencja przez `element_type_code` string (§2.2, §5.2, §6.1, §17, A13). `ps_schedules.auto_scheduling_enabled` + `ps_schedule_tasks.is_pinned` dodane (§2.2). `ps_production_batches.element_type_id` → `element_type_code` (§2.2). §15 pytania usunięte (wszystkie odpowiedziane). Wysiłek: MVP 15→14d (-1d element_types), v1 6→11d (+auto-sched+cross-deal+trigger), v2 10d; total schedule 31→35d; combined 85→94.5d. A13-A16 dodane |
| 2026-10-19 | v3 patch (b) — ps_schedules.deal_id nullable (kalkulacja standalone może mieć harmonogram bez deala); combined table zaktualizowane: project_costing 53d + project_schedule 30d = 83d |
| 2026-10-19 | v3 patch (a) — @svar-ui/react-gantt 2.8.1 MIT/PRO zweryfikowane z tarball: MIT core ma WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; FS/SS/FF/SF auto-scheduling = PRO only; CPM/baselines/MS Project = PRO; milestones [niezwer.]; zaktualizowano §3.1 tabela, §3.2 (MIT/PRO split), §3.3, GanttChart.tsx, R1, A1; dodano pytanie otwarte o SVAR PRO vs impl. własna (§15 pkt 5) |
