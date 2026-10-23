# Spec: Moduł Harmonogram Produkcji (`project_schedule`)

<!-- Source doc: .ai/specs/2026-10-19-project-schedule.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-23 (rev 8i — zmiana na potrzeby `project_delivery` (D98, D100): provider harmonogramu wykonawczego w `executionScheduleRegistry` costingu, zakres zbiorczy trzech modułów; poprzednio rev 8h — zakres traceability D1–D97: D95–D97 N/A; poprzednio rev 8f — zakres traceability D1–D94: D91 realizowana, D84–D90 i D92–D94 N/A; poprzednio rev 8e — zakres traceability D1–D83, D83 N/A; poprzednio rev 8d, rev 8c, rev 8b 2026-10-23, rev 8a 2026-10-20) |
| **Moduł** | `project_schedule` (`apps/mercato/src/modules/project_schedule`) |
| **Zależności upstream** | **`project_costing` (moduł bazowy)**, `customers`, `dictionaries`, `dashboards`, `attachments`, `notifications`, `configs`, `feature_toggles`, `audit_logs`, `query_index`, `progress` |
| **Powiązany spec** | `.ai/specs/2026-10-19-project-costing-offer-calculator.md`; zmiana na potrzeby project_delivery (D98): `.ai/specs/2026-10-23-project-delivery-docs.md` — `project_delivery` nie importuje `project_schedule` i odwrotnie; spotykają się w `executionScheduleRegistry` costingu (§5.2) |
| **Kierunek zależności** | rev 8a: `project_schedule` (opcjonalny) **zależy od** `project_costing` (baza) i rejestruje provider `ScheduleSource` w DI; `project_costing` nigdy nie importuje `project_schedule` (Kod P0-1) |

---

## TLDR

- **Co:** opcjonalny moduł aplikacji `project_schedule`: harmonogram produkcji z Ganttem (WBS, milestone'y, zależności FS/SS/FF/SF + lag, auto-przesuwanie z przypinaniem, baseline), partie produkcji i prognoza 6 mies. Jeden Gantt na inwestycję jako osobny rekord (D23, D53).
- **Faza:** cały moduł poza MVP — **v1**, integracje zewnętrzne i CPM w **v2** (§12, §13: listy funkcji; estymaty w dniach usunięte — P11). MVP kalkulatora działa bez niego (partie ręczne i import harmonogramu XLSX w kalkulacji — costing §6.5, D50).
- **Daty (D55):** koniec włącznie; FS = dzień po końcu poprzednika + lag; kamień milowy ma zerową długość, a jego następnik FS startuje tego samego dnia (D80); dni kalendarzowe. **Auto-przesuwanie (D54):** tylko w przód, od najpóźniejszego poprzednika; kolizja z przypiętym zadaniem → ostrzeżenie i propozycja odpięcia.
- **Architektura:** `project_schedule` **zależy od** `project_costing` (moduł bazowy) i rejestruje `InternalScheduleSource` w `scheduleSourceRegistry` (DI). Costing nigdy nie importuje schedule. Zero HTTP między modułami: typy elementów przez `elementTypeService`, kalkulacje przez `calculationLookupService`, sumy w costingu przez komendę `refresh_schedule_totals`.
- **Włączanie per organizacja:** `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant (§1.0).
- **Gantt:** kandydat SVAR React Gantt MIT core (tylko PoC w v1, potem osobna decyzja — D74, D82) + własny auto-scheduling, CPM, baseline, undo i linia „dziś”; **bez SVAR PRO** (D21).

---

## Streszczenie

Moduł `project_schedule` dostarcza interaktywny harmonogram produkcji z widokiem Gantt (WBS + drag & drop; cały moduł w v1). Kluczowe cechy (stan rev 8b):
- **Dwa typy harmonogramów**: `offer` (szacunki na etapie ofertowania) i `execution` (harmonogram realizacji).
- **WBS z hierarchią** (`parent_task_id`) i **milestones** (zerowa długość, D55).
- **Zależności zadań**: FS / SS / FF / SF + lag (dni, może być ujemny); walidacja cykli.
- **Baseline**: zrzut harmonogramu ofertowego przy przejściu do realizacji; wariancja.
- **ProductionBatch** powiązany z zadaniem WBS i opcjonalnie z linią kalkulacji (`calculation_line_id` = opaque UUID).
- **Prognoza 6 miesięcy** (tygodnie i miesiące), nieważona i ważona prawdopodobieństwem deala (costing §3.11).
- **Harmonogram inwestycji** (D53, D77): jeden rekord `ps_schedules` o zakresie `investment` na inwestycję, z fazą (najpierw ofertowa, potem wykonawcza), obok harmonogramów deali.

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
  executionScheduleRegistry                <─register── di.ts: InternalExecutionScheduleProvider (zmiana na potrzeby project_delivery, D100)
```

> **Zmiana na potrzeby project_delivery (D98, D100):** trzeci moduł `project_delivery` (projekty realizacji i dokumentacja) nie ma własnego Gantta. Harmonogram wykonawczy jest tutaj. `project_delivery` nie importuje `project_schedule` i nie subskrybuje jego eventów. Czyta stan i uruchamia fazę wykonawczą wyłącznie przez `executionScheduleRegistry` (rejestr w costingu), w którym ten moduł rejestruje providera (§5.2). Bez `project_schedule` delivery działa (provider nieobecny albo `isAvailable = false`).

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

**Wyłączenie (D67):** dane zostają, ale są ukryte do ponownego włączenia (guard API, menu i widget jak wyżej; brak odczytu przez `InternalScheduleSource`). Costing wraca do źródła z kalkulacji (`calculation_embedded`/`xlsx_import`) i pokazuje ostrzeżenie, że partie kalkulacji mogą być nieaktualne (costing, `pc_production_batches` — „Jedno źródło prawdy”). Po ponownym włączeniu dane wracają bez migracji; zadanie „catch-up” (ProgressJob) tworzy brakujące harmonogramy wykonawcze dla deali wygranych w czasie wyłączenia (idempotentnie, §2.2). Ustawienie trzyma costing, bo moduł bazowy jest zawsze obecny, a schedule tylko je czyta przez DI — kierunek zależności się nie odwraca.


### 1.1 Zakres harmonogramu z WBS i Gantt (rev 8a: przeniesiony z MVP do **v1**)

> Kod p15: moduł nie wchodzi do MVP; MVP kalkulatora liczy prognozę z partii w kalkulacji (`calculation_embedded` lub `xlsx_import`, D50). Gdy moduł nieaktywny w organizacji, `project_costing` używa `ScheduleSource = calculation_embedded`.

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
- **Deal ponownie otwarty (D72):** subscriber `customers.deal.updated` (persistent, no-op przy wyłączonym module). Wykrywanie przejścia (rev 8c): payload eventu niesie tylko ID, a subscriber nie polega na „starej wartości” z payloadu. Czyta bieżący `closure_outcome` deala (query engine / serwis DI `customers`, bez HTTP) i porównuje z własnym stanem modułu: przejście „zamknięty → otwarty” zachodzi, gdy bieżący `closure_outcome IS NULL`, a dla deala istnieje harmonogram `execution` (powstał z `customers.deal.won`) z `reopened_at IS NULL`. Powtórzony albo spóźniony event jest no-opem (flaga już ustawiona albo deal ponownie zamknięty). Wtedy ustawia `ps_schedules.reopened_at = now()` na harmonogramie `execution` tego deala oraz na rekordzie inwestycji, którego faza `execution` została włączona z tym dealem (`execution_deal_id` = ID deala, `reopened_at IS NULL`; §2.2). Nic nie jest usuwane ani archiwizowane; UI pokazuje badge „deal ponownie otwarty” w zakładce deala i w Gantcie inwestycji. Ponowne `customers.deal.won` czyści `reopened_at` na obu rekordach, a `create-execution` zwraca istniejący harmonogram (partial unique, §2.2). Rekord inwestycji przełączony na `execution` bez deala (`execution_deal_id IS NULL`) nie dostaje flagi D72 — nie ma deala, którego ponowne otwarcie by go dotyczyło.
- **Harmonogram inwestycji** (D53, D77): jeden rekord per inwestycja z fazą `offer` → `execution` (zmiana fazy na tym samym rekordzie, bez kopii) + widok zbiorczy harmonogramów deali tej inwestycji.
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
| Kto jest źródłem prawdy dla partii? (rev 8b) | Jedno źródło na kalkulację: aktywne `ScheduleSource` (costing §7a.3). Partie kalkulacji = `pc_production_batches` (costing; ręczne lub `xlsx_import`); partie harmonogramu = `ps_production_batches` (ten moduł). Przy pierwszym powiązaniu harmonogramu z kalkulacją, która ma partie `pc_`, UI proponuje jednorazowe skopiowanie `pc_` → `ps_` (po potwierdzeniu) i ustawia `schedule_source_override = 'internal'` komendą costingu. Kierunek tylko `pc_` → `ps_`. Prognoza czyta tylko aktywne źródło — bez podwójnego liczenia. |


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
| `schedule_scope` | `text` NOT NULL DEFAULT `'deal'` | rev 8b (D53): `deal` (harmonogram deala/kalkulacji) \| `investment` (jeden rekord harmonogramu na inwestycję — D77) |
| `investment_id` | `uuid` NULL | FK-id → `pc_investments.id` (bez constraintu DB); wymagane dla `schedule_scope = 'investment'` |
| `deal_id` | `uuid` NULL | FK-id → customer_deals; NULL = harmonogram bez deala (kalkulacja standalone) albo harmonogram inwestycji |
| `calculation_id` | `uuid` NULL | FK-id → pc_calculations (bez constraintu DB; rev 8a: przy `project_costing.calculation.deleted` subscriber tego modułu ustawia NULL) |
| `schedule_type` | `text` NOT NULL DEFAULT `'offer'` | `offer` \| `execution`; dla `schedule_scope = 'investment'` to faza jedynego rekordu inwestycji (D77): najpierw `offer`, potem zmiana na `execution` na tym samym rekordzie |
| `offer_schedule_id` | `uuid` NULL | FK → ps_schedules.id — referencja do harmonogramu ofertowego dla `execution` |
| `label` | `text` NOT NULL | |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `locked` \| `archived` |
| `baseline_captured_at` | `timestamptz` NULL | moment przechwycenia baseline |
| `reopened_at` | `timestamptz` NULL | flaga „deal ponownie otwarty” dla `execution` (D72): ustawiana, gdy `closure_outcome` deala wraca do NULL; dane harmonogramu bez zmian i bez usuwania; czyszczona przy ponownym `customers.deal.won` (§1.2). Dla `schedule_scope = 'investment'` dotyczy deala z `execution_deal_id` |
| `execution_deal_id` | `uuid` NULL | tylko `schedule_scope = 'investment'`: FK-id → `customers` deal (bez constraintu DB), z którym `create_execution` przełączył rekord inwestycji na `execution` (`dealId` w komendzie; deal musi należeć do tej inwestycji i mieć `closure_outcome = 'won'`, inaczej 422); NULL przy przełączeniu ręcznym bez deala; podstawa flagi D72 dla rekordu inwestycji (§1.2) |
| `auto_scheduling_enabled` | `bool` NOT NULL DEFAULT true | gdy true: przesunięcie zadania propaguje daty successor-ów wg zależności (serwis); gdy false: daty ręczne |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraints: `CHECK (schedule_type IN ('offer','execution'))`, `CHECK (schedule_scope IN ('deal','investment'))`, `CHECK (schedule_scope <> 'investment' OR investment_id IS NOT NULL)`.

Indeksy unikalne (rev 8b):
- **Idempotencja harmonogramu wykonawczego:** `UNIQUE (organization_id, tenant_id, deal_id) WHERE schedule_type = 'execution' AND deal_id IS NOT NULL AND deleted_at IS NULL` — powtórzony `customers.deal.won` albo catch-up po D67 nie tworzy drugiego harmonogramu (komenda `create_execution` przy konflikcie zwraca istniejący).
- **Harmonogram inwestycji (D53, D77):** `UNIQUE (organization_id, tenant_id, investment_id) WHERE schedule_scope = 'investment' AND deleted_at IS NULL` — klucz wymusza jeden główny rekord harmonogramu na inwestycję; `schedule_type` nie wchodzi do klucza, bo jest fazą tego rekordu (`offer` → `execution`). Przejście fazy: komenda `create_execution` wywołana dla rekordu inwestycji przechwytuje baseline (`baseline_start_at/end_at` zadań) i zmienia `schedule_type` na `execution` na tym samym rekordzie (bez kopii i bez `offer_schedule_id`); ponowne wywołanie jest no-opem.
- **Wyścig na indeksach unikalnych:** sprawdzenie „czy istnieje” przed `INSERT` nie wyklucza wyścigu dwóch równoległych żądań (np. dwa dostarczenia `customers.deal.won`, dwa `POST /schedules` z tym samym `investmentId`). Komenda nie polega na samym pre-checku: naruszenie partial unique (PostgreSQL `23505`, nazwa indeksu rozpoznawana jawnie) jest łapane, transakcja wycofana, istniejący rekord odczytany po kluczu z filtrem `organization_id`/`tenant_id`, a API zwraca **409** `SCHEDULE_ALREADY_EXISTS` z `existingScheduleId` (nigdy 500). Sekwencyjne powtórzenie `create-execution` dla deala (pre-check znajduje istniejący) zwraca istniejący harmonogram (200, idempotencja bez zmian). Subscriber `dealWon` traktuje 409 jako no-op (i dalej czyści `reopened_at`). Zmiana fazy rekordu inwestycji to `UPDATE … WHERE schedule_type = 'offer'` pod lockiem nagłówka (`SELECT … FOR UPDATE`, poniżej); drugi równoległy wywołujący widzi już `execution` i dostaje no-op.
- **Undo `create_execution`:** komenda zapisuje w `buildLog` `snapshotBefore` (nagłówek; dla inwestycji także `baseline_start_at/end_at` zadań i `baseline_captured_at`) i `updated_at` nagłówka po zapisie. Undo: (a) **deal** — soft delete utworzonego harmonogramu `execution` (z jego zadaniami, zależnościami i partiami), `offer` bez zmian; (b) **inwestycja** — przywraca `schedule_type = 'offer'`, poprzednie `baseline_start_at/end_at` zadań, `baseline_captured_at` i `execution_deal_id` (oraz czyści `reopened_at`). W obu przypadkach tylko, gdy `updated_at` nagłówka jest równy zapisanemu po komendzie (od zmiany fazy nikt nie zmienił harmonogramu); inaczej 409 `UNDO_CONFLICT` i dane bez zmian. Undo wywołania będącego no-opem (istniejący harmonogram, faza już `execution`) nic nie zmienia — komenda no-op loguje się z `replayable: false`.

**Lock na nagłówku (rev 8b, Kod p12):** każda zmiana zadań, zależności i partii harmonogramu (w tym propagacja §3a) przyjmuje `updatedAt` nagłówka `ps_schedules` (optimistic locking → 409) i w transakcji robi `SELECT … FOR UPDATE` tylko na wierszu `ps_schedules`; po zapisie podbija `updated_at` nagłówka. Bez `SERIALIZABLE`.

Reguła (harmonogramy deali): `execution` harmonogram jest kopią `offer` z zachowanym `offer_schedule_id`; harmonogram inwestycji zmienia fazę w miejscu (D77). Baseline rejestruje daty z `offer` w polach `baseline_start_at/end_at` zadań.

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
| `is_milestone` | `bool` NOT NULL DEFAULT false | kamień milowy o zerowej długości (D55): `planned_start_at = planned_end_at`, `duration_days = 0` |
| `element_type_code` | `text` NULL | rev 8b: kod typu elementu z `pc_element_types.code` (opaque string, walidowany przez `elementTypeService` w DI; brak FK — A12) |
| `planned_start_at` | `date` NULL | null dla summary tasks (wyliczone z dzieci) |
| `planned_end_at` | `date` NULL | koniec **włącznie** (D55) |
| `actual_start_at` | `date` NULL | |
| `actual_end_at` | `date` NULL | |
| `baseline_start_at` | `date` NULL | z offer schedule; nigdy nadpisywane po baseline_captured_at |
| `baseline_end_at` | `date` NULL | |
| `duration_days` | `int` NULL | liczba **dni kalendarzowych** (D55): `planned_end_at − planned_start_at + 1`; 0 dla kamienia milowego; utrzymywane przez serwis |
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

Constraints: `CHECK (is_milestone = false OR planned_start_at = planned_end_at)` (milestone: start = end), `CHECK (planned_end_at IS NULL OR planned_start_at IS NULL OR planned_end_at >= planned_start_at)`, `CHECK (duration_days IS NULL OR duration_days >= 0)`.

Reguły WBS:
- Zadania-podsumowanie (summary tasks) = te z dziećmi; ich `planned_start_at` = MIN(child.planned_start_at), `planned_end_at` = MAX(child.planned_end_at) — wyliczane przez serwis.
- Liście WBS = zadania bez dzieci.

**Wariancja baseline (obliczana ON READ — nigdy przechowywana)**:

Konwencja znaku: **+ = opóźnienie**, − = wyprzedzenie. Jednostka: dni kalendarzowe (D55); kalendarz dni roboczych w v2.

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
| `lag_days` | `int` NOT NULL DEFAULT 0 | lag w dniach kalendarzowych; może być ujemny (lead) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (predecessor_task_id, successor_task_id)`.

**Typy zależności**:
(D55: koniec włącznie, dni kalendarzowe; wzory w §3a.1)
- `FS` (Finish-to-Start): następnik zaczyna najwcześniej **dzień po** końcu poprzednika + lag.
- `SS` (Start-to-Start): następnik zaczyna najwcześniej w dniu startu poprzednika + lag.
- `FF` (Finish-to-Finish): następnik kończy najwcześniej w dniu końca poprzednika + lag.
- `SF` (Start-to-Finish): rzadkie; następnik kończy najwcześniej dzień przed startem poprzednika + lag.

**Walidacja zależności** (rev 8b, Kod p12) przy tworzeniu/aktualizacji — 422 z kodem:
- `DEPENDENCY_CYCLE` — cykl w DAG (DFS);
- `DEPENDENCY_ON_SUMMARY` — poprzednik albo następnik jest zadaniem-podsumowaniem (ma dzieci); zależności tylko między liśćmi WBS i kamieniami milowymi. Zadanie, które ma zależności, nie może dostać dzieci (ten sam kod przy dodaniu dziecka);
- `DEPENDENCY_PARENT_CHILD` — zależność między przodkiem a potomkiem w WBS;
- `DEPENDENCY_SELF` — poprzednik = następnik;
- `DEPENDENCY_CROSS_SCHEDULE` — zadania z różnych harmonogramów.

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
| `copied_from_pc_batch_id` | `uuid` NULL | rev 8b: FK-id → `pc_production_batches.id`, gdy partia powstała z jednorazowej kopii `pc_` → `ps_` (§1.4) |
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

Constraints: `CHECK (planned_end_at >= planned_start_at)`, `CHECK (quantity_m3 IS NULL OR quantity_m3 >= 0)`, `CHECK (quantity_pcs IS NULL OR quantity_pcs >= 0)`. Daty: koniec włącznie, dni kalendarzowe (D55).

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

**Decyzja (rev 8a, D21, zamknięte pytanie pkt 20): Gantt = własna implementacja, BEZ SVAR PRO.** Rev 8c (D74, D82): SVAR MIT core jest kandydatem — v1 zaczyna od PoC na `@svar-ui`, a wybór biblioteki zapada potem osobną decyzją; poniższe fakty SVAR są wejściem do PoC, nie przesądzeniem. Uzasadnienie: PRO dla SaaS wymaga licencji Application ($1,899); tańsza Developer ($749) zabrania użycia w SaaS; własny kod daje pełną kontrolę (bez uzależnienia od vendora, licencji per produkt i paywalla przy kolejnych funkcjach). Zakres świadomie przyjęty: własny auto-scheduling (v1), własne elementy UI — etykiety zależności, linia „dziś”, undo przy drag, baseline overlay (v1), CPM i kalendarz dni roboczych (v2); lista w §12–§13.

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
- **Mapowanie dat do SVAR (D55, rev 8b):** w bazie koniec jest włącznie (`planned_end_at`), a SVAR traktuje `end` jako chwilę końca (wyłącznie). Adapter `lib/svar-date-adapter.ts`: `svar.start = planned_start_at 00:00`, `svar.end` = początek (00:00) następnego dnia po `planned_end_at`; kamień milowy: `type: 'milestone'`, `svar.start = svar.end = planned_start_at 00:00`. Przy zapisie z drag/resize: `planned_end_at` = dzień poprzedzający `svar.end`. Strefa czasu: daty jako dni kalendarzowe bez czasu (UTC 00:00), bez przesunięć DST. [do potwierdzenia w PoC Gantta na wersji 2.8.1]
- **MS Project import/export**: server-side parser (v2, `exceljs`/`xml2js`), nie PRO.

### 3.3 Wymagania Gantt (rev 8a: v1)

- **WBS tree**: ✅ MIT.
- **Milestones** (zero-duration, diamond): ✅ MIT.
- **Drag & drop** (move + resize): ✅ MIT. Po przesunięciu → PATCH do API → serwis propaguje daty successor-ów (gdy `auto_scheduling_enabled = true`; §3a) → live update w Gantt.
- **Dependency links** (strzałki): ✅ MIT. Etykiety typ (FS/SS/FF/SF) + lag = custom CSS nad linkami.
- **Przełącznik Day / Week / Month**: ✅ MIT.
- **Baseline overlay** (v1): custom rendering — dla każdego zadania z `baseline_start_at` rysowany dodatkowy cienki pasek (np. szary, za/przed głównym) przez custom task renderer w @svar-ui. Tooltip: `Baseline: ${baseline_start} – ${baseline_end} | Odchylenie: start ${start_variance_days}, koniec ${end_variance_days} (dni kalendarzowe)`.
- **Linia „dziś”** i **undo przy drag**: własne (brak w MIT).
- **`wbs_code`**: własna kolumna w gridzie.
- **SSR**: `dynamic(() => import('./GanttChart'), { ssr: false })`.

---

## 3a. Auto-scheduling — propagacja dat (v1, server-side)

### 3a.1 Algorytm (rev 8b — D54, D55, Kod p12)

Gdy `ps_schedules.auto_scheduling_enabled = true` i zadanie jest przesuwane (drag&drop lub `POST .../reschedule`), serwis (czysta funkcja `lib/auto-scheduling.ts`, testy unit) przelicza następników forward-passem po DAG w porządku topologicznym.

**Konwencja (D55):** daty są dniami kalendarzowymi; `planned_end_at` jest **włącznie**; czas trwania `dur = end − start + 1`; kamień milowy ma `dur = 0` i `start = end`. **D80:** następnik FS kamienia milowego startuje tego samego dnia co kamień milowy (`P.start + lag`), bo kamień milowy nie zajmuje dnia.

```
Dla zadania T z nowym startem S':
  1. E' = S' + (dur_T − 1)      -- zadanie (dur_T ≥ 1)
     E' = S'                    -- kamień milowy (dur_T = 0)
  2. Dla każdego następnika X (porządek topologiczny) i każdej jego zależności (P → X, type, lag):
       FS: minStart = P.end + 1 + lag           -- dzień po końcu
           P kamień milowy: minStart = P.start + lag  -- D80: następnik startuje tego samego dnia
       SS: minStart = P.start + lag
       FF: minEnd   = P.end + lag   →  minStart = minEnd − (dur_X − 1)   (kamień milowy: minStart = minEnd)
       SF: minEnd   = P.start − 1 + lag  →  minStart jw.
     required_X = MAX(minStart po wszystkich poprzednikach X)   -- D54: liczy się najpóźniejszy
  3. Gdy required_X > X.start:
       - X nieprzypięty → X.start = required_X, X.end = X.start + (dur_X − 1) (0 dla kamienia milowego);
       - X przypięty (is_pinned) → daty X bez zmian; naruszenie `pinned_conflict` (ostrzeżenie + propozycja odpięcia, §3a.2).
  4. Gdy required_X < X.start (poprzednik przesunięty wcześniej): bez zmiany — tylko propozycja
     `earlier_possible` z datą required_X (D54: przesuwanie automatyczne tylko w przód).
  5. Zadania-podsumowania nie są przesuwane; ich daty = MIN/MAX z dzieci po propagacji.
  6. Zapis wszystkich zmienionych zadań jedną komendą `tasks.reschedule` w jednej transakcji z lockiem na nagłówku
     `ps_schedules` (§2.2); jeden event `project_schedule.schedule.rescheduled` z listą ID (§5.3).
```

Odpowiedź `reschedule`: `{ changedTaskIds[], violations: [{ taskId, code: 'pinned_conflict', requiredStart }], proposals: [{ taskId, code: 'earlier_possible', proposedStart }] }`. Naruszenia i propozycje nie blokują zapisu; UI pokazuje je użytkownikowi.

**Ograniczenia v1:** propagacja tylko w przód (D54); nie skraca zadań; dni kalendarzowe (D55); kalendarz dni roboczych w v2. Ochrona przed pętlą: walidacja cykli przy zapisie zależności + limit przejść = liczba zadań.

### 3a.2 Manual override (is_pinned)

Pole `is_pinned` na `ps_schedule_tasks`:
- `true`: zadanie jest „zakotwiczone" — auto-scheduling nie zmienia jego dat. Gdy poprzednik wymaga późniejszego startu, serwis zwraca ostrzeżenie `pinned_conflict` z propozycją odpięcia (D54); po odpięciu (komenda `tasks.unpin`) propagacja jest ponawiana.
- `false` (default): zadanie podlega auto-scheduling.

Dane UI: ikonka kłódki przy zadaniu w WBS grid; toggle w panelu bocznym.

### 3a.3 API endpoint

```
POST /api/project-schedule/tasks/:id/reschedule
```

Body: `{ newStartAt: string; scheduleUpdatedAt: string; propagate?: boolean }`. Propagate default = `schedule.auto_scheduling_enabled`. Konflikt `scheduleUpdatedAt` → 409.

Wewnętrznie używany przez drag&drop callback w Gantt.

---

## 4. Prognoza produkcji

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

**m³ (3 miejsca po przecinku)**: `SUM(monthly_m3) = B.quantity_m3` dokładnie.
1. `floor_m3[M] = floor(raw_m3[M], 3)`.
2. Reszta = `B.quantity_m3 − SUM(floor_m3[M])`.
3. Sort malejąco wg `frac = raw_m3[M] − floor_m3[M]`; dodaj `0.001` do top-k miesięcy.

**szt. (liczby całkowite)**: analogicznie z `floor(..., 0)` i `+1` per pozycja.

**Tygodnie**: ten sam algorytm LRM per tydzień; `SUM(weekly) = B.quantity_m3/pcs` dokładnie.

### 4.3 Prognoza z ważeniem prawdopodobieństwem

```
weighted_m3[M]  = monthly_m3[M]  × probability / 100
weighted_pcs[M] = monthly_pcs[M] × probability / 100
```

Odpowiedź zawiera zawsze obie metryki (nieważoną i ważoną). Harmonogram bez deala (kalkulacja standalone, D61) — tylko nieważona; ważona = NULL. Deal wygrany = 100; przegrany/usunięty — poza prognozą zbiorczą (costing §0.6).

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
| `executionScheduleRegistry.register(InternalExecutionScheduleProvider)` — **zmiana na potrzeby project_delivery (D100)** | costing (rejestr) | `di.ts` rejestruje providera: `isAvailable(ctx)` = `false`, gdy `schedule.enabled` wyłączony w organizacji (§1.0, D67); `findForInvestment(investmentId)` → `{ scheduleId, phase }` rekordu inwestycji (D77) albo `null`; `ensureExecution({ investmentId, dealId })` → istniejący rekord inwestycji (gdy go brak — `POST /schedules` z `investmentId` przez komendę tego modułu) i komenda `create_execution` (idempotentna, §2.2; 409 `SCHEDULE_ALREADY_EXISTS` traktowane jako sukces z istniejącym ID). Konsument: `project_delivery` (v1, delivery §4.1). Zapis wyłącznie komendami tego modułu |

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
project_schedule.schedule.rescheduled   (clientBroadcast: true) — jeden event po propagacji: { scheduleId, taskIds[], organizationId, tenantId }; zamiast task.updated per zadanie (Kod p12)
```

Payload = ID (`id`, `scheduleId`, `organizationId`, `tenantId`, `calculationId?`, przy `rescheduled` — `taskIds[]`); `clientBroadcast` tylko z ID. Eventy `task.*` nie są emitowane per zadanie w trakcie propagacji.

### 5.4 Kierunek zależności i opcjonalność modułu (rev 8a)

`project_schedule` zależy od `project_costing`: może importować typy (`ScheduleSource`, `ProductionBatchSummary`) i tokeny DI costingu oraz subskrybować `project_costing.calculation.*`. `calculation_id` i `calculation_line_id` to FK-id bez constraintu DB; `element_type_code` i `segment_code` to stringi.

`project_costing` nie ma żadnej zależności od `project_schedule`: nie importuje jego kodu, nie zna jego eventów ani tras. Gdy moduł jest nieobecny w buildzie albo wyłączony w organizacji (§1.0), w `scheduleSourceRegistry` nie ma `InternalScheduleSource` albo zwraca on `isAvailable() = false`, a costing używa `EmbeddedScheduleSource`. Subscribery `calculationActivated.ts`/`calculationDeleted.ts` są po stronie właściwego modułu — tego (konsumenta).

---

## 6. API modułu `project_schedule`

Prefix: `/api/project-schedule/`. Optimistic locking. Rev 8a: każda trasa za wspólnym guardem `isScheduleEnabled` (§1.0) → `404 MODULE_DISABLED`; `openApi` na trasach; CRUD przez `makeCrudRoute` + indexer; zapisy przez komendy.

> **Typy elementów**: brak własnych endpointów w `project_schedule` — zarządza nimi `project_costing` (UI administracji); ten moduł czyta je przez `elementTypeService` (DI).

### 6.1 Harmonogramy

```
GET/POST  /api/project-schedule/schedules?dealId=&calculationId=&investmentId=&scheduleScope=&scheduleType=
GET/PATCH /api/project-schedule/schedules/:id
DELETE    /api/project-schedule/schedules/:id   (tylko draft)

POST .../activate | .../lock | .../duplicate
POST .../capture-baseline   (offer → copies baseline_start/end do zadań)
POST .../create-execution   (deal: tworzy execution schedule z offer jako kopię; idempotentne — partial unique per deal, wyścig → 409 z existingScheduleId; inwestycja: zmiana fazy na tym samym rekordzie, opcjonalne dealId → execution_deal_id (D72) — D77, §2.2; undo §2.2)
POST .../copy-calculation-batches   (jednorazowa kopia pc_ → ps_ po potwierdzeniu, §1.4)

GET .../summary
GET .../forecast?months=6&weeks=true&probability=
GET .../export?format=xlsx|csv
POST .../import
```

**Harmonogram inwestycji (D53, D77)**: jeden rekord `ps_schedules` z `schedule_scope = 'investment'` na inwestycję (tworzony przez `POST /schedules` z `investmentId`; drugi → 409 z ID istniejącego, także przy równoległym wyścigu — `23505` mapowany na 409, §2.2; własne zadania, zależności i partie; faza `offer` → `execution` przez `create-execution`). Widok zbiorczy: `GET /api/project-schedule/investment-schedules?investmentId=` zwraca rekord inwestycji + harmonogramy deali powiązanych z inwestycją (tylko do odczytu; jedna encja inwestycji `pc_investments`). Zwraca tasks z `dealId` i `calculationId` per każde zadanie. API zawsze filtruje po stronie serwera (organizacja, ACL). UI: `/project-schedule/investments/:investmentId/gantt`.

### 6.3 Zadania WBS

```
GET/POST  /api/project-schedule/tasks?scheduleId=&parentTaskId=
PATCH/DELETE /api/project-schedule/tasks/:id
POST      /api/project-schedule/tasks/batch    (bulk upsert — drag&drop save)
POST      /api/project-schedule/tasks/:id/reschedule   (§3a auto-scheduling; violations + proposals)
POST      /api/project-schedule/tasks/:id/unpin        (D54: odpięcie po ostrzeżeniu pinned_conflict)
```

API response dla każdego zadania zawiera pola wariancji obliczone ON READ (§2.2): `startVarianceDays`, `endVarianceDays`, `durationVarianceDays`, `actualStartVariance`, `actualEndVariance` — tylko gdy `baseline_start_at` / `baseline_end_at` != NULL. Zawiera też `isPinned`.

### 6.4 Zależności

```
GET/POST  /api/project-schedule/task-dependencies?scheduleId=&predecessorId=&successorId=
PATCH/DELETE /api/project-schedule/task-dependencies/:id
```

Walidacja: `POST` i `PATCH` zwracają 422 z kodem `DEPENDENCY_CYCLE`, `DEPENDENCY_ON_SUMMARY`, `DEPENDENCY_PARENT_CHILD`, `DEPENDENCY_SELF` lub `DEPENDENCY_CROSS_SCHEDULE` (§2.2).

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
- Panel boczny edycji zadania: label, type, element_type (`element_type_code`), daty (koniec włącznie), progress, status, notes, dependency arrows, przypięcie (`is_pinned`) i lista ostrzeżeń `pinned_conflict`/propozycji z ostatniej propagacji.
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

Drag&drop callback → `POST /api/project-schedule/tasks/:id/reschedule` (daty przez adapter SVAR z §3.2).

### 7.3 Gantt inwestycji (D53)

Strona `/project-schedule/investments/:investmentId/gantt`: edytowalny harmonogram inwestycji (jeden rekord z fazą, `schedule_scope = 'investment'` — D77) oraz zbiorczy widok Gantt zadań ze wszystkich harmonogramów powiązanych z daną inwestycją. Rev 8a (bez joinu do tabel costingu): `calculationLookupService.listByInvestment(investmentId)` (DI, costing) zwraca ID kalkulacji, a ten moduł filtruje `ps_schedules WHERE calculation_id IN (...)`. To zależność schedule → costing (dozwolona), nie odwrotnie. Zadania kolorowane per deal. Umożliwia planowanie zasobów produkcyjnych dla całej inwestycji.

Breadcrumb: Inwestycja → Deale → Harmonogramy. Filtry: status harmonogramu, typ (offer/execution), deal.

---

## 8. Import / Eksport (v1)

### 8.1 Formaty XLSX/CSV (`exceljs`)

Kolumny harmonogramu XLSX: `wbs_code`, `label`, `parent_wbs_code`, `is_milestone`, `element_type_code`, `planned_start` (YYYY-MM-DD), `planned_end` (włącznie, D55), `duration_days` (dni kalendarzowe), `predecessors` (wbs_code csv, default FS; format: `1.2FS+2` dla FS z lagiem +2), `status`, `notes`.

Batche: opcjonalny drugi arkusz.

**Zapis (D56):** import zastępuje zadania, zależności i partie harmonogramu po potwierdzeniu w podglądzie (podgląd pokazuje liczby usuwanych i tworzonych rekordów); commit jako ProgressJob (komenda `schedule.import.commit`, lock na nagłówku, jeden event `project_schedule.import.completed`).

**Błędne wiersze (D56) — odrzucane z raportem** (numer wiersza, kolumna, powód): pusta etykieta, niepoprawna data, koniec przed startem, kamień milowy z różnym startem i końcem, nieznany `element_type_code`, ujemna ilość, nieznany `parent_wbs_code` lub `predecessors`, zależność tworząca cykl albo naruszająca reguły z §2.2. Wiersze zależne od odrzuconego (dzieci, następniki) są odrzucane z powodem `depends_on_rejected_row`. Przypadki brzegowe pliku (formuły, scalone komórki, wybór arkusza, format liczb) jak w costing §6.2.

MS Project CSV export compatibility: kolumny `Name`, `Duration`, `Start`, `Finish`, `Predecessors`, `WBS`.

### 8.2 MS Project XML (v2)

Parser `xml2js` (nowa zależność — dopiero w v2 wg D74, costing §18a); elementy `<Task><WBS>`, `<Start>`, `<Finish>`, `<Predecessors>`. Złożony format — v2 po potwierdzeniu z Markiem.

### 8.3 Limity i bezpieczeństwo

Te same wartości co w costing §6.4: plik 10 MB, 100 MB po rozpakowaniu (sprawdzane z katalogu ZIP przed parsowaniem), 10 000 wierszy, 200 kolumn; podgląd synchronicznie do 30 s, zatwierdzenie w workerze do 120 s. Odrzucane makra (`.xlsm`, `vbaProject.bin`), formuły czytane tylko jako wartość zapisana w pliku, zewnętrzne łącza ignorowane; eksport z ochroną przed formula injection.

---

## 9. Uprawnienia (ACL)

| Feature | Opis |
|---------|------|
| `project_schedule.view` | Podgląd |
| `project_schedule.edit` | Edycja zadań, drag & drop, batchów, zależności |
| `project_schedule.admin` | Ustawienia, integracje zewnętrzne (typy elementów należą do costingu — `project_costing.admin`) |
| `project_schedule.import` | Import XLSX/CSV |
| `project_schedule.export` | Eksport XLSX/CSV |
| `project_schedule.manage_investment_schedule` | Tworzenie i edycja harmonogramu inwestycji (D53) |

Rev 8a — role OM (`superadmin`, `admin`, `employee`; ról `manager`/`sales` nie ma): `admin` → wszystkie; `employee` → `view`, `edit`, `import`, `export`, `manage_investment_schedule`. Harmonogram nie zawiera kosztów ani marży, więc D68 go nie ogranicza. Feature'y w `setup.ts` `defaultRoleFeatures`. `project_schedule.admin` obejmuje integracje zewnętrzne; włącznik modułu w organizacji wymaga `project_costing.admin` (ustawienie costingu, §1.0).

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
      elementTypeCode: { dbColumn: 'element_type_code', type: 'text' },
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
      elementTypeCode: { dbColumn: 'element_type_code', type: 'text' },
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
- **Outbound**: po `task.updated` / `schedule.rescheduled` → POST do `outbound_webhook_url`; retry 3× przez `queue`.

### 11.3 Daty-change webhooks (outbound, v2)

Przy każdej zmianie `planned_start_at`/`planned_end_at` zadania (drag&drop) → event `project_schedule.task.updated` (zmiana pojedyncza) lub `project_schedule.schedule.rescheduled` (propagacja, lista ID) → outbound webhook dociąga daty po ID.

---

## 12. Fazy — zakres funkcji i encji (rev 8b)

Rev 8b (P11): estymaty w dniach usunięte. Fazy opisujemy listą funkcji, encji i tras. Gantt bez SVAR PRO (D21) — własne elementy są w liście v1 (auto-scheduling, elementy UI) i v2 (CPM, kalendarz).

### MVP

Moduł poza MVP (Kod p15). MVP kalkulatora: partie ręczne i import harmonogramu XLSX w kalkulacji, prognoza 6 mies. przez `EmbeddedScheduleSource`/`xlsx_import` (costing §6.5, §14 MVP, D50).

### v1

**Funkcje:**
1. Szkielet modułu, gating per organizacja (§1.0: guard API, menu, widget; D67 — dane ukryte po wyłączeniu, catch-up po ponownym włączeniu), rejestracja `InternalScheduleSource` w DI, subscribery `calculationActivated`/`calculationDeleted`.
2. Logika domenowa: harmonogramy offer/execution, WBS (summary z dzieci), zależności z walidacją (cykle, summary, rodzic–dziecko), partie, lock na nagłówku.
3. Własny silnik auto-scheduling (D54/D55: tylko w przód, najpóźniejszy poprzednik, kamień milowy 0, koniec włącznie, `pinned_conflict` + propozycja odpięcia, `schedule.rescheduled`) — zamiast SVAR PRO.
4. Gantt: PoC na SVAR MIT core, potem osobna decyzja o bibliotece (D74, D82) + adapter dat (koniec wyłącznie w SVAR) + własne: etykiety zależności, linia „dziś”, undo przy drag, baseline overlay, `wbs_code`; zakładka deala.
5. Baseline capture, offer → execution (`customers.deal.won`, persistent, idempotentne przez partial unique), flaga „deal ponownie otwarty” (`reopened_at`, D72), wariancja.
6. Harmonogram inwestycji jako jeden rekord z fazą (D53, D77) + widok zbiorczy (`calculationLookupService`).
7. Import/eksport XLSX harmonogramu (ProgressJob + worker; D56: zastąpienie po potwierdzeniu, raport odrzuconych wierszy).
8. Prognoza z harmonogramu (LRM, nieważona i ważona) + odświeżanie sum costingu (komenda DI, kolejka, debounce); jednorazowa kopia partii `pc_` → `ps_`.

**Encje v1:** `ps_schedules`, `ps_schedule_tasks`, `ps_task_dependencies`, `ps_production_batches`, `ps_import_column_mappings`.

### v2

1. `ps_external_integrations` + provider interface + registry.
2. Inbound webhook (Standard Webhooks HMAC, idempotentność).
3. Outbound webhook (zmiana dat, retry przez kolejkę).
4. Import MS Project XML (D25: od v2; `xml2js` w v2 — D74).
5. Własny CPM (forward/backward pass, float, `is_critical_path`) — zamiast SVAR PRO.
6. Kalendarz dni roboczych w auto-schedulingu i wariancji — zamiast SVAR PRO.

**Encje v2:** `ps_external_integrations`; pola CPM na `ps_schedule_tasks`.

### Narzut OM (wymagania, bez estymaty)

Jak w costing §14: każda encja i trasa przez migracje, zod, komendy z undo i `audit_logs`, `makeCrudRoute` + `openApi` + indexer, granty w `setup.ts`; ekrany na `CrudForm`/`DataTable`; i18n pl/en; testy integracyjne każdej trasy w tej samej zmianie i testy unit Jest (scheduler, walidacja zależności, adapter dat SVAR, LRM, wariancja).

---

## 13. Zakres zbiorczy (trzy moduły)

Zmiana na potrzeby project_delivery (D98): tabela obejmuje trzeci moduł.

| Moduł | MVP | v1 | v2 |
|---|---|---|---|
| `project_costing` | costing §14 MVP | costing §14 v1 | costing §14 v2 |
| `project_schedule` | — (moduł nie wchodzi do MVP) | §12 v1 | §12 v2 |
| `project_delivery` | delivery §11 MVP (bez harmonogramu) | delivery §11 v1 (+ link/uruchomienie harmonogramu przez provider z §5.2) | delivery §11 v2 |

Tabela identyczna jak w costing §14 „Zakres zbiorczy”.

---

## 14. Risks (rev 8a — z ryzykiem rezydualnym)

| # | Scenariusz awarii | Obszar | Ważność | Mitygacja | Ryzyko rezydualne |
|---|---|---|---|---|---|
| R1 | Własny auto-scheduling/CPM (bez SVAR PRO) daje błędne daty | Algorytmy | Wysoka | Czysta funkcja schedulera + testy unit na przypadkach brzegowych (wielu poprzedników, milestone, pinned); reguły D54/D55 opisane w §3a.1 (Kod p12) | Średnie — przypadki brzegowe wyjdą w użyciu |
| R2 | SSR Next.js + SVAR wymaga DOM; przesunięcie o dzień przy mapowaniu końca (włącznie vs wyłącznie) | UI | Średnia | `dynamic(..., { ssr: false })`; jeden adapter dat (§3.2) z testami unit | Niskie |
| R3 | Walidacja cykli przy setkach zależności | Wydajność | Niska | DFS O(V+E); WBS budowlane < 200 zadań | Niskie |
| R4 | LRM przy bardzo krótkich partiach (< 3 dni) | Prognoza | Niska | Min. 1 dzień; residual do okresu z największym overlapem | Niskie |
| R5 | Brak execution schedule przy capture-baseline | Dane | Niska | `capture-baseline` tworzy execution, jeśli brak | Niskie |
| R6 | Osierocone `calculation_line_id`/`calculation_id` po usunięciu w costingu | Dane | Niska | Subscriber `project_costing.calculation.deleted` nulluje FK-id | Niskie |
| R7 | Wiele wersji formatu MS Project XML | Import (v2) | Niska | v2; v1 = XLSX/CSV | Niskie |
| R8 | Kolizja zakładek deala (costing + schedule) | UI | Niska | Różne `groupId`, priorytet | Niskie |
| R9 | Nieskończona propagacja przy cyklu | Algorytmy | Wysoka | Walidacja cykli przy zapisie (422 `DEPENDENCY_CYCLE`) + limit głębokości | Niskie |
| R10 | `customers.deal.won` dostarczony więcej niż raz | Integracja | Niska | Partial unique `(org, tenant, deal_id) WHERE schedule_type = 'execution'` + `create-execution` zwraca istniejący; równoległy wyścig: `23505` → 409 `SCHEDULE_ALREADY_EXISTS`, subscriber traktuje jako no-op; harmonogram inwestycji: klucz `(org, tenant, investment_id)` i zmiana fazy no-op pod lockiem nagłówka (D77); undo zmiany fazy z kontrolą `updated_at` (§2.2); test integracyjny dwóch równoległych wywołań; subscriber persistent | Niskie |
| R11 | Organizacja wyłącza moduł, a dane/subscribery dalej działają | Konfiguracja | Średnia | Guard API + no-op subscriberów + `isAvailable() = false` (§1.0); test integracyjny wyłączenia | Niskie |
| R12 | Kill-switch tenanta wyłączony przez pomyłkę ukrywa harmonogramy wszystkich organizacji | Konfiguracja | Średnia | Toggle domyślnie włączony; dane nieusuwane | Niskie |
| R13 | Zakres własnego Gantta większy niż zakładany (elementy, których nie ma w SVAR MIT) | Plan | Średnia | PoC Gantta na SVAR MIT przed budową widoku (§12 v1 pkt 4), w tym adapter dat; `@svar-ui` tylko jako PoC w v1, potem osobna decyzja (D74, D82); bez SVAR PRO (D21); lista własnych elementów zamknięta w §3.2 | Średnie (świadoma decyzja D21) |
| R14 | Dwa źródła partii (`pc_` i `ps_`) dają różne liczby | Dane | Średnia | Prognoza czyta tylko aktywne źródło (costing §7a.3); kopia `pc_` → `ps_` jednorazowa po potwierdzeniu; UI oznacza nieaktywne partie | Niskie |
| R15 | Deal ponownie otwarty po wygranej, a harmonogram wykonawczy wygląda na obowiązujący | Dane / UI | Niska | Flaga `reopened_at` + badge „deal ponownie otwarty”; dane bez usuwania (D72); wykrywanie przez własny stan modułu (§1.2); ponowne `won` czyści flagę; rekord inwestycji flagowany przez `execution_deal_id`; test integracyjny won → reopen → won dla harmonogramu deala i rekordu inwestycji | Niskie |

---

## 15. Pytania otwarte do Marka

*(Rev 8b: Q4 o wyłączaniu modułu zamknięte — D67: dane ukryte do ponownego włączenia. Decyzje dotyczące modułu (zamknięte, costing §16): D72 (dawne Q9) — flaga „deal ponownie otwarty”, bez usuwania danych (§1.2, §2.2, R15); D74 (dawne Q11) — `@svar-ui` tylko PoC w v1, potem osobna decyzja (D82), bez SVAR PRO, `xml2js` w v2, nic nie instalujemy na etapie speki; D77 — jeden rekord harmonogramu na inwestycję z fazą (§2.2); D80 — następnik kamienia milowego startuje tego samego dnia (§3a.1). Otwarte pozostaje tylko Q6 (waluty, costing §16), które modułu nie dotyczy.)*

| Pytanie | Odpowiedź Marka | Implementacja |
|---------|-----------------|---------------|
| Rescheduling automatyczny? | TAK — auto-scheduling server-side, manual override per-task (`is_pinned`) | §3a, v1 |
| Cross-deal Gantt? | TAK — jeden rekord harmonogramu per inwestycja z fazą (D53, D77) + widok zbiorczy | §6.1, §7.3, v1 |
| MS Project XML? | v2+ — XLSX/CSV wystarczy na v1 | §6.7, v2 |
| Offer → Execution trigger? | TAK — event `customers.deal.won`; idempotent | §6.1 `create-execution`, v1 |
| SVAR PRO? (pkt 20, **zamknięte w rev 8a**) | NIE — własna implementacja bez SVAR PRO (D21); SVAR MIT core tylko PoC w v1 (D82) | §3.2 (uzasadnienie: Application $1,899, Developer $749 zabrania SaaS, kontrola nad kodem); zakres w §12 |
| Harmonogram po ponownym otwarciu deala? (Q9, **zamknięte — D72**) | flaga „deal ponownie otwarty”, bez usuwania danych | §1.2, §2.2 `reopened_at`, R15 |
| Zależności `@svar-ui`, `xml2js`? (Q11, **zamknięte — D74, D82**) | `@svar-ui` tylko PoC w v1, potem osobna decyzja (bez SVAR PRO); `xml2js` w v2; `exceljs` tak | costing §18a; §3.2, §8.2 |

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
| A7 | LRM rounding m³ (3 miejsca po przecinku) i szt. (int) per miesiąc i tydzień | `SUM(periodic) = batch_total` dokładnie |
| A8 | `ps_schedules` bez `currency` | Waluta = własność kalkulacji |
| A9 | Walidacja zależności: DFS synchroniczny + reguły summary/rodzic–dziecko | Typowe WBS < 200 zadań; wystarczające |
| A10 | `calculation_line_id` w `ps_production_batches` = FK-id bez constraintu DB | Brak relacji ORM/constraintów między modułami (schedule zależy od costing, ale nie przez FK DB) |
| A11 | `schedule_type: offer|execution`; baseline w polach `baseline_start/end_at` na `ps_schedule_tasks` | Upraszcza model; bez osobnej tabeli snapshot |
| A12 | Typy elementów = `pc_element_types` (project_costing); `ps_schedule_tasks` i `ps_production_batches` trzymają `element_type_code` (string), walidowany przez `elementTypeService` w DI; brak `element_type_id` | project_schedule opcjonalny; costing posiada typy elementów niezależnie |
| A13 | Auto-scheduling v1 server-side (forward-pass DAG, dni kalendarzowe); v2 = dni robocze | Decyzja Marka rev 7: NIE PRO; własna impl. |
| A14 | Offer→execution trigger przez event `customers.deal.won` (nie `accepted`); idempotentne `create-execution` (partial unique) | Decyzja Marka rev 7 |
| A15 | Harmonogram inwestycji: jeden rekord `ps_schedules` (`schedule_scope = 'investment'`) na inwestycję z fazą `offer` → `execution` + strona i endpoint `investment-schedules` | D23, D53, D77 |
| A16 | Daty: koniec włącznie; FS = dzień po końcu + lag; kamień milowy o zerowej długości, jego następnik FS startuje tego samego dnia (`P.start + lag`, decyzja D80); dni kalendarzowe; w SVAR koniec wyłącznie przez adapter | D55, D80 |
| A17 | Auto-przesuwanie tylko w przód, od najpóźniejszego poprzednika; przypięte zadanie → `pinned_conflict` + propozycja odpięcia; wcześniejszy termin → tylko propozycja | D54 |
| A18 | Import harmonogramu zastępuje dane po potwierdzeniu; błędne wiersze odrzucane z raportem | D56 |
| A19 | Wyłączenie modułu w organizacji: dane ukryte do ponownego włączenia; catch-up harmonogramów wykonawczych po włączeniu | D67 |

---

## 17. Migracje i backward compatibility

Nowe tabele `ps_*` only, wszystkie z `deleted_at` (rev 8a). Brak FK DB do `pc_*`. Kolejność: `ps_schedules` → `ps_schedule_tasks` → `ps_task_dependencies` → `ps_production_batches` → `ps_import_column_mappings` → `ps_external_integrations` (v2). Moduł jest nowy (v1), więc `element_type_code` zamiast `element_type_id` nie wymaga migracji danych.

---

## 18. Szkielet plików modułu

```
apps/mercato/src/modules/project_schedule/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts (rejestracja providera w scheduleSourceRegistry), types.ts
├── commands/                    # rev 8a: zapisy przez komendy (undo, audit_logs)
├── workers/                     # import XLSX (ProgressJob), catch-up po ponownym włączeniu (D67)
├── api/
│   ├── schedules/[id]?/{activate,lock,duplicate,capture-baseline,create-execution,copy-calculation-batches,
│   │                    summary,forecast,export,import}/route.ts
│   ├── investment-schedules/route.ts          # cross-deal Gantt data
│   ├── tasks/[id]?/{batch,reschedule,unpin}/route.ts
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
│   ├── dealWon.ts              # trigger offer→execution transition (persistent); 409 = no-op; czyści reopened_at (deal + rekord inwestycji z execution_deal_id)
│   └── dealReopened.ts         # customers.deal.updated: bieżący closure_outcome NULL + własny execution / rekord inwestycji z execution_deal_id bez flagi → reopened_at (D72, persistent)
├── widgets/DealScheduleTab.tsx
└── lib/
    ├── schedule.service.ts
    ├── auto-scheduling.ts       # §3a czysta funkcja: forward pass, D54/D55, violations/proposals
    ├── svar-date-adapter.ts     # §3.2 koniec włącznie ↔ SVAR end wyłącznie
    ├── forecast.ts              # pro-rata LRM + probability weighting
    ├── import.service.ts
    ├── dependency-validation.ts # DFS cycle check + summary + rodzic–dziecko
    ├── internal-schedule.source.ts  # implementacja ScheduleSource z project_costing; rejestrowana w di.ts
    ├── module-gate.ts           # isScheduleEnabled (§1.0): route guard, menu, widget
    └── external/provider.interface.ts + registry.ts
```

---

## 19. Final Compliance Report (rev 8b, vs `AGENTS.md`)

| Reguła | Źródło | Status |
|---|---|---|
| Sekcje TLDR, Architecture, Data Models, API Contracts, Risks (z rezydualnym), Final Compliance Report, Changelog | `.ai/specs/AGENTS.md` § Spec Content Checklist | ✅ TLDR, §0, §2, §6, §14, §19, Changelog |
| Kierunek zależności: opcjonalny konsument trzyma glue, baza go nie zna | `packages/core/AGENTS.md` § Cross-Module Coupling | ✅ §0, §1.4, §5 |
| Zero HTTP / relacji ORM między modułami | `packages/core/AGENTS.md` § Never; review Kod P0-1 | ✅ |
| Komendy, `makeCrudRoute` + indexer, `openApi` | `packages/core/AGENTS.md` § Always | ✅ §6; lock na nagłówku i jeden event `rescheduled` (§2.2, §3a.1) |
| Feature'y ACL w `setup.ts`; role admin/employee | `packages/core/AGENTS.md` § ACL Grant Sync | ✅ §9 |
| `deleted_at` | `packages/core/AGENTS.md` § Database Entities | ✅ §2.1 |
| Włączanie modułu zgodne z platformą (build, feature_toggles, module_configs) | `apps/mercato/src/modules.ts`, `feature-flag-check.ts`, `module-config-service.ts` | ✅ §1.0 |
| Import przez ProgressJob + worker | `packages/core/AGENTS.md` § Operation Progress | ✅ §8 (D56, limity §8.3), §12 v1 pkt 7 |
| Testy integracyjne każdej trasy | root `AGENTS.md` l.166 | ✅ wymaganie w każdej fazie (§12 „Narzut OM”) |
| Nowe zależności (`@svar-ui/*`, `exceljs`, `xml2js`) = ask first | root `AGENTS.md` l.26 | ✅ rozstrzygnięte w costing §18a (D74, D82); na etapie speki nic nie instalujemy |

## 20. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-23)

| Punkt listy (Kod pN) | Wynik rev 8b |
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
| Statusy deala / `customers.deal.won` persistent (p5) | ✅ subscriber `dealWon` persistent; statusy wg costing §0.6 (`closure_outcome`); idempotencja partial unique (§2.2) |
| Import przez ProgressJob (p9) | ✅ §8 (D56, błędne wiersze, limity §8.3; przypadki brzegowe jak costing §6.2) |
| Nowe zależności = ask first (p10) | ✅ costing §18a, D74 (zamknięte) |
| Algorytmy harmonogramu (p12) | ✅ §3a.1 (D54/D55), §2.2 (walidacja zależności, lock na nagłówku), §3.2 (adapter SVAR), §5.3 (`rescheduled`) |
| Narzut OM w zakresie faz (p16) | ✅ §12 „Narzut OM” (estymaty usunięte — P11) |
| MVP pocięty po wartości (p15) | ✅ moduł poza MVP |
| Typy elementów przez `element_type_code` + DI (A7/A13 z rev 8a) | ✅ §2.2, §10, A12 |
| Forma speki (p20) | ✅ |

---

## 21. Decision traceability (D1–D97)

Zakres D1–D97: `.ai/decisions.md`@b544719 (gałąź `develop_OM_CRM`) dla D1–D82; D83 — `.ai/decisions.md`@3f00542 (gałąź `develop_OM_CRM`); D84–D94 — `.ai/decisions.md`@0f0c6aa (gałąź `develop_OM_CRM`, merge PR #16; Koordynator 2026-10-23, audyt om-overlap-audit §3–4); D95–D97 — `.ai/decisions.md` z tego PR (Koordynator 2026-10-23). Pełna tabela wszystkich aktywnych decyzji (z N/A i powodami) jest w costing §22. Poniżej decyzje realizowane w tej specyfikacji. Decyzje zastąpione nie są cytowane (lista „superseded by” w costing §22).

| D | Decyzja (skrót) | Sekcje tej specyfikacji |
|---|---|---|
| **D1** | Klin = agregator przetargów + CRM budowlany na OM | §1 (kontekst) |
| **D9** | Kalkulator jak Excel + import XLSX | §8.1 |
| **D15** | Firma = organizacja | §1.0 |
| **D19** | Harmonogram = osobny moduł, opcjonalny per firma | §1.0, §5.4 |
| **D20** | Kalkulacja i prognoza bez harmonogramu (`ScheduleSource`/Excel) | §5.2 |
| **D21** | Gantt własny, bez SVAR PRO | §3.2, §12, §14 (R13) |
| **D22** | Auto-przesuwanie z przypięciem | §3a.1, §3a.2 |
| **D23** | Jeden Gantt na inwestycję | §6.1, §7.3 (doprecyzowane przez D53) |
| **D24** | Oferta → realizacja przy wygranej | §1.2, §6.1 (`create-execution`) |
| **D25** | MS Project w v2 | §8.2, §12 v2 |
| **D26** | Harmonogram wewnętrzny, gotowy na integrację | §11, §12 v2 |
| **D45** | Moduły aplikacji w forku, bez zmian w `packages/core` | nagłówek (Moduł), §18 |
| **D47** | Przełącznik harmonogramu per organizacja (`module_configs`) + kill-switch tenanta | §1.0 |
| **D48** | RBAC marży i kosztu | §9 |
| **D50** | Zakres MVP | §1.1, §12 MVP (moduł poza MVP) |
| **D52** | Inwestycja = jedna encja | §2.2 (`investment_id`) |
| **D53** | Gantt inwestycji = osobny rekord (klucz: D77) | §1.2, §2.2 (`schedule_scope`, `investment_id`), §6.1, §7.3 |
| **D54** | Przypięte zadania, propagacja tylko w przód | §3a.1, §3a.2, §6.3 |
| **D55** | Konwencja dat (koniec włącznie, FS, kamień milowy, dni kalendarzowe) | §2.2, §3.2 (adapter), §3a.1, §8.1 |
| **D56** | Import zastępuje dane po potwierdzeniu; błędne wiersze odrzucane | §8.1 |
| **D61** | Kalkulacja bez deala poza prognozą ważoną | §4.3 |
| **D67** | Wyłączenie modułu: dane ukryte | §1.0, §2.2 |
| **D68** | `employee` bez kosztów i marży | §9 |
| **D72** | Flaga „deal ponownie otwarty”, bez usuwania danych | §1.2, §2.2 (`reopened_at`, `execution_deal_id` — także rekord inwestycji), §6.1, §14 (R15) |
| **D74** | Zależności: `exceljs` tak; siatka najpierw `packages/ui`; `@svar-ui` tylko PoC w v1, potem osobna decyzja; `xml2js` w v2; nic nie instalujemy na etapie speki | §3.2, §8.2, §12, §14 (R13) |
| **D77** | Jeden rekord harmonogramu na inwestycję z fazą (najpierw ofertowa, potem wykonawcza); klucz wymusza jeden główny rekord na inwestycję | §1.2, §2.2 (indeks unikalny, wyścig → 409, undo zmiany fazy), §6.1, §7.3, §14 (R10) |
| **D80** | Następnik kamienia milowego (FS) startuje tego samego dnia (`P.start + lag`) | §3a.1, §16 (A16) |
| **D82** | §18a nie przesądza SVAR; `@svar-ui` zostaje PoC w v1 | §3.2, §14 (R13) |
| **D91** | XLSX na `exceljs`; moduł OM `sync_excel` (tylko CSV) nieużywany | §8.1 |

D83 (split inwestycji w v1, wybór oferty głównej) — N/A w tej specyfikacji: to komenda `project_costing.investments.split` (costing §2.2, §3.12). Rekord harmonogramu inwestycji (D77) zostaje przy inwestycji źródłowej; nowa inwestycja zaczyna bez harmonogramu.

Zmiana na potrzeby project_delivery (D98–D115): D98 (trzy moduły) i D100 (brak Gantta w delivery, provider w `executionScheduleRegistry`) realizowane w §0, §5.2 i §13. Pozostałe D99, D101–D115 — N/A w tej specyfikacji (projekt realizacji, dokumenty, storage, retencja: delivery §19).

D84–D90 i D92–D94 — N/A w tej specyfikacji (realizacja w costing §3.10, §14, §18a):
- D84–D89 (waluty, kursy `NBP_A`, waluta bazowa, `decimal_places`, `snapshot_data.fx`, job kursów): harmonogram nie liczy kwot ani kursów; sumy kosztów pochodzą z costing przez DI.
- D90 (bez `sales`, `catalog`, `@dainamite/cpq`): harmonogram nie korzysta z ofert ani produktów.
- D92 (`pdf-lib` + `attachments`): harmonogram nie generuje PDF.
- D93 (`workflows` kandydat v2): dotyczy akceptacji oferty z ujemną marżą w costing.
- D94 (`perspectives`, `@open-mercato/scheduler` opcjonalne w v1): `@open-mercato/scheduler` dotyczy joba kursów walut (D89), nie auto-planowania Gantta (§3a); `perspectives` dotyczą list kalkulacji costing.

D95–D97 — N/A w tej specyfikacji (realizacja w costing §3.10, §15, §18b; obowiązują dopiero po „implementujemy” od Marka):
- D95 (waluta bez źródła kursu nie może być walutą oferty ani pozycji): harmonogram nie wybiera walut ani nie liczy kwot.
- D96 (jedno źródło kursu: wyłączenie dostawcy `NBP` po włączeniu `NBP_A`; błąd daty do upstream jako issue): konfiguracja kursów i podsumowanie deali, poza harmonogramem.
- D97 (c46ad643 z pierwszym PR modułu costing): zależność etapu kodu costing; harmonogram nie korzysta z waluty bazowej.

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-23 | **rev 8i** — zmiana na potrzeby project_delivery (D98, D100), bez zmian w modelu danych, trasach i eventach. Nagłówek „Powiązany spec” + notka w §0 (trzy moduły). §5.2: rejestracja `InternalExecutionScheduleProvider` w `executionScheduleRegistry` costingu (`isAvailable`, `findForInvestment`, `ensureExecution` → `create_execution`, idempotentne). §13 „Zakres zbiorczy (trzy moduły)”. §21: akapit o D98–D113. |
| 2026-10-23 | **rev 8h** — traceability D1–D97 (§21): D95–D97 (waluta bez źródła kursu, jedno źródło kursu, c46ad643) N/A z powodami — dotyczą costing. Źródło D95–D97: `.ai/decisions.md` z tego PR; D84–D94: @0f0c6aa. |
| 2026-10-23 | **rev 8f** — traceability D1–D94 (§21): D91 (`exceljs`, `sync_excel` nieużywany) realizowana w §8.1; D84–D90 i D92–D94 N/A z powodami (waluty, PDF, `workflows`, `perspectives`, `@open-mercato/scheduler` — dotyczą costing). Źródło D84–D94: `.ai/decisions.md` z tego PR. |
| 2026-10-23 | **rev 8e** — traceability D1–D83 (§21): D83 (split inwestycji, costing) N/A w tej specyfikacji; rekord harmonogramu inwestycji (D77) zostaje przy inwestycji źródłowej. |
| 2026-10-23 | **rev 8d** — odbiór 8324f29. **Wyścig:** naruszenie partial unique (`23505`) mapowane na 409 `SCHEDULE_ALREADY_EXISTS` z `existingScheduleId`; zmiana fazy inwestycji pod lockiem nagłówka (§2.2, §6.1, R10). **Undo `create_execution`:** deal — soft delete harmonogramu `execution`; inwestycja — powrót do `offer` z poprzednim baseline; obie z kontrolą `updated_at` → 409 (§2.2). **D72 dla rekordu inwestycji:** kolumna `execution_deal_id`, flaga `reopened_at` ustawiana i czyszczona także na rekordzie inwestycji (§1.2, §2.2, R15). Źródło decyzji: `.ai/decisions.md`@b544719 (`develop_OM_CRM`), D1–D82 (§21). |
| 2026-10-23 | **rev 8c** — decyzje D72, D74 (`.ai/decisions.md` 72a63c9) oraz D77, D80, D82 (Koordynator 2026-10-23); traceability D1–D82 (§21). **D77:** jeden rekord harmonogramu na inwestycję z fazą `offer` → `execution`, klucz `(org, tenant, investment_id)` (§2.2, §6.1, §7.3, R10, A15). **dealReopened:** wykrywanie przez bieżący `closure_outcome` i własny stan modułu, nie przez starą wartość z payloadu (§1.2). **D80:** następnik kamienia milowego tego samego dnia (§3a.1, A16). **D82:** SVAR tylko PoC w v1 (TLDR, §3.2, §12, R13). `project_schedule.admin` bez typów elementów (§9). Sformułowania bez liczby dni (kamień milowy, adapter dat, lag, miejsca po przecinku). |
| 2026-10-23 | **rev 8b** — spójność, review P1/P2, decyzje (`.ai/decisions.md` d818aa2), wnioski z planu testów. **P11:** usunięte wszystkie estymaty w dniach (§12/§13 jako listy funkcji i encji; D21 bez kosztu w §3.2 i §15; R13 przeformułowane; starsze wiersze changelogu oczyszczone). **D53:** harmonogram inwestycji = osobny rekord (`schedule_scope`, `investment_id`, partial unique). **D54/D55:** §3a.1 przepisany — koniec włącznie, `E' = S' + (dur − 1)`, kamień milowy `E' = S'` (poprawka wzoru z rev 8a), FS = dzień po końcu + lag, start od najpóźniejszego poprzednika, tylko w przód, `pinned_conflict` + odpięcie, `earlier_possible` jako propozycja; `duration_days` = dni kalendarzowe; mapowanie końca do SVAR (koniec wyłącznie) przez adapter; walidacja zależności na podsumowaniach i rodzic–dziecko; lock na nagłówku `ps_schedules`; event `project_schedule.schedule.rescheduled` z listą ID. **D56:** import zastępuje dane po potwierdzeniu, błędne wiersze odrzucane z raportem. **D67:** dane ukryte po wyłączeniu, catch-up po włączeniu. **Spójność z costing:** jedno źródło partii (§1.4, kopia `pc_` → `ps_`), limity importu jak costing §6.4 (10 000 wierszy zamiast wcześniejszego limitu zadań), prognoza nieważona + ważona, idempotencja harmonogramu wykonawczego (partial unique per deal), zależności do akceptacji (costing §18a). **A7/A13:** `element_type_id` usunięte z `ps_schedule_tasks` → `element_type_code`; analytics `elementTypeId` → `elementTypeCode`. Brakujący nagłówek „## 4. Prognoza produkcji” dodany. **Założenia przenumerowane** (stary → nowy): A1–A6 bez zmian; A7 (nieaktualne) usunięte; A8→A7, A9→A8, A10→A9, A11→A10, A12→A11, A13→A12, A14→A13, A15→A14, A16→A15; nowe A16–A19. **Follow-up (spec-check):** §21 Decision traceability (decyzje realizowane w tej specyfikacji; pełna tabela w costing §22); Q9 (c) — flaga „deal ponownie otwarty” (§1.2, §2.2, subscriber `dealReopened`, R15) i Q11 (`@svar-ui` tylko PoC w v1, `xml2js` w v2) — rozstrzygnięcia Koordynatora 2026-10-23. |
| 2026-10-20 | **rev 8a** — Review Kod (PR #10 rev 7) + decyzje Koordynatora/Marka. **P0-1:** kierunek odwrócony — `project_schedule` zależy od `project_costing` (baza) i rejestruje `InternalScheduleSource` w `scheduleSourceRegistry` (DI); usunięte HTTP (§5.2 `GET /api/project-costing/element-types` → `elementTypeService`; API konsumowane przez costing → kontrakty DI); join `ps_schedules.calculation_id → pc_calculations` opisany poprawnie (`calculationLookupService.listByInvestment`); subscriber `calculationActivated` po stronie tego modułu (konsumenta); odświeżanie sum costingu przez jego komendę `refresh_schedule_totals`; A3 poprawione; nowa §0 Architecture, §1.4, §5.4. **Decyzja (d) + potwierdzenie Koordynatora:** §1.0 — włącznik per organizacja = `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant (zweryfikowano w `feature-flag-check.ts` i `module-config-service.ts`; ModuleConfigService nie ma natywnego scope organizacji → klucz `org:{id}:settings`). **Pkt 20 zamknięte (D21):** Gantt własny na SVAR MIT, bez PRO (Application $1,899; Developer $749 zabrania SaaS; kontrola nad kodem); fakty SVAR: milestone'y w MIT (usunięte [niezwer.] i plan B), `wbs_code` własna kolumna, brak undo przy drag i linii „dziś” w MIT → własne. **P1-15:** cały moduł przeniesiony z MVP do v1. **P1-16:** wycena od zera z narzutem OM (estymaty usunięte w rev 8b — P11). `projectId` usunięte (jedna encja inwestycji). Role admin/employee (§9). Dodane: TLDR, Risks z ryzykiem rezydualnym, Final Compliance Report, Checklist compliance, `deleted_at`. Poza zakresem rev 8a (zrobione w rev 8b): Kod p12 (szczegóły algorytmu), A7/A13 (`element_type_id` w `ps_schedule_tasks`, `elementTypeId` w analytics), partie pc_/ps_, numeracja założeń. |
| 2026-10-19 | v1 (rev 3) — inicjalna spec |
| 2026-10-19 | v2 (rev 4) — Gantt MVP, @svar-ui, ps_element_types, ps_import_column_mappings, LRM |
| 2026-10-19 | v3 (rev 5) — …(jak poprzednio)… |
| 2026-10-19 | v4 (rev 6) — wariancja baseline: ON READ (start/end/duration/actual), §2.2 ps_schedule_tasks, API §6.2, Gantt tooltip+overlay §3.3; ScheduleBatchSummary.dealId string|null |
| 2026-10-19 | **v5 (rev 7)** — Decyzje Marka: auto-scheduling server-side (NIE PRO) — §3.2, §3a; cross-deal Gantt per inwestycja — §6.1, §7.3; MS Project = v2+ potwierdzone; offer→execution trigger przez `customers.deal.won` event — §6.1; SVAR PRO = NIE. Moduł OPCJONALNY (feature toggle, §1.1, Streszczenie). `ps_element_types` usunięte — przeniesione do `project_costing` jako `pc_element_types`; referencja przez `element_type_code` string (§2.2, §5.2, §6.1, §17, A13). `ps_schedules.auto_scheduling_enabled` + `ps_schedule_tasks.is_pinned` dodane (§2.2). `ps_production_batches.element_type_id` → `element_type_code` (§2.2). §15 pytania usunięte (wszystkie odpowiedziane). A13-A16 dodane |
| 2026-10-19 | v3 patch (b) — ps_schedules.deal_id nullable (kalkulacja standalone może mieć harmonogram bez deala) |
| 2026-10-19 | v3 patch (a) — @svar-ui/react-gantt 2.8.1 MIT/PRO zweryfikowane z tarball: MIT core ma WBS ✅, drag&drop ✅, dep links ✅, React 19/Next.js ✅; FS/SS/FF/SF auto-scheduling = PRO only; CPM/baselines/MS Project = PRO; milestones [niezwer.]; zaktualizowano §3.1 tabela, §3.2 (MIT/PRO split), §3.3, GanttChart.tsx, R1, A1; dodano pytanie otwarte o SVAR PRO vs impl. własna (§15 pkt 5) |
