# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-20 (rev 8a — P0 architecture, MVP cut, OM sections, honest estimate; poprzednio v7 2026-10-19) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications`, `directory`, `configs` (ModuleConfigService), `audit_logs`, `query_index`, `progress` (ProgressJob), `feature_toggles` |
| **Moduł powiązany** | `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`) — **opcjonalny konsument**: zależy od `project_costing` i rejestruje swój provider `ScheduleSource` w DI. `project_costing` = moduł bazowy, nigdy nie importuje `project_schedule` (rev 8a, Kod P0-1) |
| **Wyłączone upstream** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## TLDR

- **Co:** moduł aplikacji `project_costing` (fork, `apps/mercato/src/modules`, zero zmian w `packages/core`): kalkulator kosztów i ofert „jak Excel” dla firm budowlanych (v1: prefabrykacja żelbetowa). Kalkulacja może istnieć bez deala.
- **MVP (rev 8a, ~40 d):** siatka kosztów (sekcje → pozycje), import XLSX (ProgressJob + worker), tryby ceny A (suma linii) i C (koszt × (1 + narzut)), prosty cennik firmy, mark-sent ze snapshotem + PDF oferty, apply-to-deal (jawna akcja użytkownika), widoczność przez RBAC (`acl.ts`), partie produkcji w kalkulacji z prognozą 6 mies. **Bez Gantta, bez formuł, bez eksportu XLSX.**
- **Architektura:** `project_costing` = moduł bazowy. Posiada interfejs `ScheduleSource` i rejestr w DI (Awilix). Opcjonalny `project_schedule` zależy od costing i rejestruje swój provider. Zero HTTP między modułami; dane przez serwisy DI, eventy (payload = same ID), FK-id + snapshot, widget + enricher. Zapisy przez komendy (undo, `audit_logs`), CRUD przez `makeCrudRoute` + indexer.
- **Oferta główna/alternatywna:** własna encja-rozszerzenie `pc_deal_offer_roles` (deklaracja w `data/extensions.ts`), partial unique na `primary`, przełączenie jedną komendą w jednej transakcji. Zero zapisów do pól/tabel `customers` (jedyny wyjątek: jawna komenda `customers.deals.update` w apply-to-deal, uruchamiana przez użytkownika).
- **Ukryta marża = ukryty koszt** dla roli bez `project_costing.view_margin`; reguła obowiązuje we wszystkich kanałach (API, query_index, search, audit, eventy, eksport, PDF, compare, analityka, snapshot).
- **Firma = organizacja OM.** Ustawienia per organizacja przez `ModuleConfigService` (`module_configs`), bez własnej tabeli `pc_settings`.
- **Inwestycja = jedna encja `pc_investments`** (v1); `klin:project` wygaszamy przez jednorazowy, opcjonalny import.
- **Wycena:** costing 101 d (MVP 40 / v1 45 / v2 16), oba moduły 151 d — patrz §14.

---

## Streszczenie

Moduł `project_costing` dostarcza kalkulator kosztów ofertowych przypiętych do Deali. Kluczowe cechy rev 5:
- **Oferta = zamrożony snapshot** wersji kalkulacji wysłanej klientowi (renderowane linie + sumy + proweniencja cen w momencie wysyłki).
- **Typy linii**: `section` / `item` / `note` / `subtotal` z hierarchią (section → items) i dziedziczonym narzutem.
- **Cykl życia wersji**: `draft` → `sent` → `accepted`/`rejected`/`superseded`; numeracja `K/2026/001-R1`.
- **Layered price list**: wielopoziomowe reguły cennikowe (zakres: global/segment/kategoria/pozycja, baza: koszt/inna lista/fixed).
- **Koszty rzeczywiste** (`CostEntry`): wpisy kosztu do budżetu vs realizacja per kategoria.
- **Widoczność marży**: domyślnie UKRYTA; wyłącznie przez feature'y RBAC (`acl.ts`); ukryta marża ⇒ ukryty koszt (rev 8a).

> Rev 8a: zakres MVP/v1/v2 — §14. Pojęcia „projekt” (`klin:project`) i `cf_offer_role` zostały usunięte z modelu (§3.12, §10.4).

---

## 0. Architecture (rev 8a)

### 0.1 Moduły i kierunek zależności

```
customers  directory  dictionaries  configs  audit_logs  query_index  progress  attachments  feature_toggles
    ^  (FK-id + snapshot, eventy customers.deal.*, enricher/widget; jawna komenda customers.deals.update w apply-to-deal)
    |
project_costing  (moduł BAZOWY; zawsze włączony w buildzie)
    |  posiada: ScheduleSource (interfejs), scheduleSourceRegistry (DI), elementTypeService (DI),
    |           calculationLookupService (DI, read-only), projectCostingSettings (DI), eventy project_costing.*
    ^
    |  zależy od (import typów/tokenów DI z project_costing, subskrypcja eventów project_costing.*)
project_schedule (moduł OPCJONALNY; rejestruje InternalScheduleSource w scheduleSourceRegistry)
```

Reguły (źródło: `packages/core/AGENTS.md` § Cross-Module Coupling, l.240–250 na gałęzi spec):
- `project_costing` **nie importuje, nie resolve'uje i nie wymaga** `project_schedule`. Nie zna nazw jego eventów, tras ani tabel.
- `project_schedule` może importować typy i tokeny DI z `project_costing` (to konsument; costing jest bazą). Swoje powiązania (provider, subscribery, widget) trzyma u siebie.
- Zero wywołań HTTP między modułami (także do `customers`). Odczyt danych innych modułów: query engine / serwisy DI (`tryResolve` dla opcjonalnych) / enricher; zapis cudzych encji tylko jawną komendą właściciela (jedyny przypadek: apply-to-deal, §8.7).
- Brak relacji ORM między modułami; FK-id bez constraintu DB między modułami + snapshot potrzebnych pól.

### 0.2 DI (Awilix) — kontrakty eksportowane przez `project_costing`

| Token DI | Typ | Kto rejestruje | Kto używa |
|---|---|---|---|
| `scheduleSourceRegistry` | `ScheduleSourceRegistry` (`register(source)`, `getActive(calculationId, ctx)`) | `project_costing/di.ts` | costing (prognoza, sumy); `project_schedule/di.ts` rejestruje w nim provider |
| `embeddedScheduleSource` | `ScheduleSource` (`pc_production_batches`) | `project_costing` | rejestr (fallback zawsze dostępny) |
| `elementTypeService` | read-only lista/lookup `pc_element_types` | `project_costing` | costing, `project_schedule` (zamiast `GET /api/project-costing/element-types`) |
| `calculationLookupService` | read-only: `getById`, `listByInvestment(investmentId)` (ID + pola niewrażliwe) | `project_costing` | `project_schedule` (cross-deal Gantt, schedule §7.3) |
| `projectCostingSettings` | odczyt ustawień per organizacja (§2.2 „Ustawienia”) | `project_costing` | costing; `project_schedule` (włącznik `schedule.enabled`) |

### 0.3 Komendy (write path)

Wszystkie zapisy domenowe przez komendy (`packages/core/AGENTS.md` l.8–13): audyt w `audit_logs` (`action_logs`), undo, cache, eventy, indeks. Trasy CRUD przez `makeCrudRoute` z `indexer: { entityType, buildUpsertPayload }` i `openApi`; trasy akcji (mark-sent, apply-to-deal, set-primary, recalc) jako własne trasy wywołujące komendy, przez mutation guard. Komendy MVP: `project_costing.calculations.create|update|delete|save_lines|mark_sent|attach_deal|detach_deal|apply_to_deal|refresh_schedule_totals`, `project_costing.price_catalog.*`, `project_costing.cost_categories.*`, `project_costing.element_types.*`, `project_costing.production_batches.*`, `project_costing.import.commit` (z workera). v1: `…offer_roles.assign|set_primary`, `…investments.*`, `…calculations.unlock|duplicate|activate|mark_accepted|mark_rejected`, `…cost_entries.*`. Szczegóły write path (lock na nagłówku, minimalny zapis): rev 8b (Kod p6, p8).

### 0.4 Eventy

`project_costing.*` (§10.1). **Payload = wyłącznie identyfikatory** (`id`, `organizationId`, `tenantId`, `dealId?`, `investmentId?`) — bez kosztów, cen ani marży; `clientBroadcast` tylko z ID (UI dociąga dane przez API z redakcją). Subskrypcje cudzych eventów: `customers.deal.won`, `customers.deal.lost`, `customers.deal.updated`, `customers.deal.deleted` (persistent; szczegóły statusów: rev 8b, Kod p5).

### 0.5 Granice i konfiguracja

| Temat | Rozstrzygnięcie rev 8a |
|---|---|
| Firma | = organizacja OM (D15). Ustawienia i włączniki funkcji per organizacja. |
| Ustawienia | `ModuleConfigService` (`packages/core/src/modules/configs/lib/module-config-service.ts`), tabela `module_configs`; brak `pc_settings` (§2.2). |
| Widoczność kosztów/marży | wyłącznie RBAC (`acl.ts`) — §4, §9. Ustawienie „per firma” = domyślne przypisanie feature'ów do ról (`setup.ts` `defaultRoleFeatures` + edycja ról w organizacji). |
| Włączenie harmonogramu | build (`apps/mercato/src/modules.ts`); włącznik per organizacja = `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL `project_schedule.*` + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant — schedule §1.0. |
| Inwestycja | jedna encja `pc_investments` (v1); `klin:project` wygaszany (§10.4). |
| Oferta główna | `pc_deal_offer_roles` (§2.2, §3.12). |


---

## 1. Kontekst i cel

### 1.1 Problem

Firmy budowlane (v1: prefabrykacja żelbetowa) liczą wyceny w Excelu, tracą historię wersji ofert i nie kontrolują widoczności marż między rolami.

### 1.2 Propozycja wartości

- Kalkulator na karcie Deala; eksport do PDF oferty (frozen snapshot).
- Hierarchia linii (sekcje → pozycje) z dziedziczonym narzutem.
- Wersjonowanie ofert z cyklem życia; prognoza = wartość × prawdopodobieństwo.
- Wielopoziomowe reguły cennikowe + proweniencja każdej ceny.
- Koszty rzeczywiste vs budżet (kalkulacja zatwierdzona).
- Widoczność marży konfigurowana per firma (domyślnie off).

---

## 2. Model danych

### 2.1 Konwencje

- `organization_id` + `tenant_id` na każdej tabeli; UUID PK; FK-id bez ORM relation; `updated_at` (optimistic locking).
- **Soft delete (rev 8a):** każda encja domenowa `pc_*` ma `deleted_at timestamptz NULL` (`packages/core/AGENTS.md` § Database Entities, l.636). Zapytania i partial unique indexy filtrują `deleted_at IS NULL`. Kolumna nie jest powtarzana w każdej tabeli poniżej, ale obowiązuje wszędzie. Wyjątek: `pc_offer_snapshots` jest niemutowalny i usuwany tylko (soft) razem z kalkulacją.
- FK-id do encji innych modułów (`deal_id` → `customers`) bez constraintu DB; spójność przez subscriber `customers.deal.deleted`.
- `element_type_id` → FK → `pc_element_types.id` (własność `project_costing`; `project_schedule` referencjonuje przez `element_type_code` string).
- Segmenty referencjonowane przez `segment_code` (string, nie FK ORM).

### 2.2 Tabele

#### Ustawienia modułu — `ModuleConfigService` (rev 8a: zastępuje `pc_settings`)

Tabela `pc_settings` **usunięta**. Ustawienia trzymamy w `module_configs` przez `ModuleConfigService` (`packages/core/src/modules/configs/lib/module-config-service.ts`; opis: `packages/core/AGENTS.md` § Module Config).

**Weryfikacja w kodzie (2026-10-20):** serwis przyjmuje `scope: { tenantId?, organizationId? }`, ale odczyt (`getRecord`) szuka wyłącznie po `(moduleId, name, tenantId)` z fallbackiem na wiersz globalny; `organizationId` jest tylko zapisywany jako metadana i nadpisywany przy kolejnym zapisie. Natywnego rozróżnienia per organizacja **nie ma**. Dlatego wartości per organizacja zapisujemy pod nazwą zawierającą ID organizacji (nazwa ≤ 128 znaków — `packages/core/src/modules/configs/data/validators.ts`), w scope tenanta z kontekstu auth:

| `moduleId` | `name` | Zakres | Przykład wartości |
|---|---|---|---|
| `project_costing` | `settings` | tenant (domyślne dla wszystkich organizacji) | `{ "default_overhead_rate": 0.10 }` |
| `project_costing` | `org:{organizationId}:settings` | organizacja (nadpisuje klucze z `settings`) | `{ "pdf": { "validity_days": 30 }, "schedule": { "enabled": true } }` |

Rozwiązanie wartości: `org:{orgId}:settings` → `settings` (tenant) → wartości domyślne w kodzie (`lib/settings-defaults.ts`). Serwis `projectCostingSettings` (DI) robi merge; cache zapewnia ModuleConfigService. `tenantId`/`organizationId` zawsze z kontekstu auth, nigdy z body.

Klucze (rev 8a):

| Klucz | Domyślnie | Uwagi |
|---|---|---|
| `default_currency` | `"PLN"` | |
| `default_overhead_rate` | `0.10` | |
| `calculation_scope` | `"all"` | `all` \| `own` (§4.4) |
| `pdf.validity_days` | `30` | |
| `pdf.footer_text`, `pdf.contact_email`, `pdf.contact_phone` | `""` | |
| `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account` | — | brak w `Organization` (D27: dane do PDF z profilu firmy) |
| `schedule_source` | `"calculation_embedded"` | §7a.3 |
| `schedule.enabled` | `false` | włącznik modułu harmonogramu per organizacja (schedule §1.0); `project_schedule` czyta go przez `projectCostingSettings` |

**Usunięte klucze** (dublowały RBAC — Kod p4/p7, decyzja Koordynatora (e)): `visibility.costs_visible_features`, `visibility.margin_visible_features`, `visibility.prices_visible_features`, `visibility.margin_visible_by_default`, `visibility.margin_visible_after_deal_close` (→ feature `project_costing.view_margin_after_close`, §9). Zaokrąglenia per firma (D16) dochodzą w rev 8b jako klucz w tej samej strukturze.

#### `pc_cost_categories` — kategorie kosztów

Kolumny: id, organization_id, tenant_id, code, label, segment_code (opaque string), sort_order, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`.

Seed: `production`, `transport`, `assembly`.

#### `pc_segments` — segmenty branżowe

Kolumny: id, organization_id, tenant_id, code, label, description, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`. Seed: `precast_concrete`.

#### `pc_element_types` — typy elementów (własność `project_costing`)

Kolumny: id, organization_id, tenant_id, segment_code (opaque string), code, label, default_unit_id (FK-id → dictionaries unit), sort_order, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`.

Seed `segment_code = 'precast_concrete'`: `floor_slab`, `wall`, `column`, `beam`, `staircase`.

> **Własność:** `project_costing` jest jedynym modułem zarządzającym typami elementów. `project_schedule` referencjonuje typy elementów wyłącznie przez `element_type_code` (opaque string) — brak FK-id do `pc_element_types`. Dzięki temu `project_schedule` pozostaje opcjonalny (§7a ScheduleSource).

#### `pc_price_sources` — rejestr źródeł cennikowych

Kolumny: id, organization_id, tenant_id, provider_id, label, price_list_version, price_list_date, region, is_active, meta jsonb, created_at, updated_at. `UNIQUE (organization_id, tenant_id, provider_id, price_list_version)`. Seed: `company_catalog`.

#### `pc_price_catalog` — pozycje cennikowe

Kolumny: id, organization_id, tenant_id, price_source_id, segment_code, cost_category_id, external_code, code, label, description, unit_id, unit_cost numeric(14,4), unit_price numeric(14,4), currency char(3), valid_from, valid_to, is_active, created_at, updated_at.

#### `pc_price_list_rules` — wielopoziomowe reguły cennikowe

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `price_source_id` | `uuid` NOT NULL | FK → `pc_price_sources.id` |
| `scope_type` | `text` NOT NULL | `global` \| `segment` \| `category` \| `item` |
| `scope_ref` | `text` NULL | segment_code / category code / catalog item code (zależnie od scope_type) |
| `base_type` | `text` NOT NULL | `cost` \| `list` \| `fixed` |
| `base_list_id` | `uuid` NULL | FK → `pc_price_sources.id` (dla base_type=list) |
| `markup_pct` | `numeric(6,4)` NULL | narzut jako % (0.20 = 20%) |
| `discount_pct` | `numeric(6,4)` NULL | rabat jako % |
| `fixed_price` | `numeric(14,4)` NULL | cena stała (base_type=fixed) |
| `min_quantity` | `numeric(14,4)` NULL | minimalna ilość aktywująca regułę |
| `valid_from` | `date` NULL | |
| `valid_to` | `date` NULL | |
| `priority` | `int` DEFAULT 0 | wyższy = bardziej szczegółowy (item > category > segment > global) |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(organization_id, tenant_id, scope_type, scope_ref)`, `(price_source_id)`.

Reguła wyboru: przy wyliczaniu ceny linii, serwis szuka reguły o najwyższym `priority` pasującej do `scope_ref` linii, aktywnej w danej dacie i spełniającej `min_quantity`. Fallback: cena z `pc_price_catalog`.

KNR/index adapter: `external_code` w `pc_price_catalog` mapuje kody KNR/Sekocenbud na własne pozycje. Adapter `PriceSourceProvider` implementuje `mapExternalCode(externalCode)` → `PriceSourceItem`. Szczegóły: §7.

#### `pc_calculation_templates` + `pc_calculation_template_lines`

Analogiczne do kalkulacji: `segment_code`, linie z `line_type`, `parent_line_id`, `markup_pct`. Patrz `pc_calculation_lines` poniżej.

#### `pc_calculations` — kalkulacja (głowa)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NULL | FK-id → `customer_deals.id`; NULL = kalkulacja standalone (wycena wewnętrzna, przetarg przed wyborem GC) |
| `investment_id` | `uuid` NULL | FK-id → `pc_investments.id`; NULL = nieskojarzono z inwestycją; dołączany przez `attach-investment` lub automatycznie przy match |
| `investment_name` | `text` NULL | nazwa inwestycji (wolny tekst, zachowany dla fuzzy-match i migracji) |
| `investment_location` | `text` NULL | lokalizacja inwestycji (wolny tekst) |
| `investment_key` | `text` NULL | normalizowany klucz: `lower(trim(investment_name)) \|\| '\|' \|\| lower(trim(investment_location))`; aktualizowany przez serwis |
| `segment_code` | `text` NULL | |
| `base_code` | `text` NOT NULL | bazowy numer, np. `K/2026/001` |
| `revision` | `int` NOT NULL DEFAULT 1 | numer rewizji; display = `base_code-R{revision}` |
| `label` | `text` NOT NULL | |
| `status` | `text` NOT NULL DEFAULT `'draft'` | `draft` \| `sent` \| `superseded` \| `accepted` \| `rejected` |
| `is_active_version` | `bool` NOT NULL DEFAULT false | jedna true per deal (gdy `deal_id != NULL`); dla kalkulacji standalone: informacyjne |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `price_mode` | `text` NOT NULL DEFAULT `'line_prices'` | `line_prices` \| `target_margin` \| `markup` |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | koszty pośrednie jako % kosztu |
| `markup_rate` | `numeric(6,4)` NULL | tryb C / narzut na poziomie kalkulacji (dziedziczony przez sekcje/pozycje) |
| `target_margin_rate` | `numeric(6,4)` NULL | tryb B |
| `subtotal_cost` | `numeric(14,2)` NULL | SUM(item line_cost) |
| `overhead_amount` | `numeric(14,2)` NULL | subtotal_cost × overhead_rate |
| `full_cost` | `numeric(14,2)` NULL | subtotal_cost + overhead_amount |
| `subtotal_price` | `numeric(14,2)` NULL | cena oferty |
| `total_margin` | `numeric(14,2)` NULL | subtotal_price − full_cost |
| `margin_rate` | `numeric(6,4)` NULL | total_margin / subtotal_price |
| `total_quantity_m3` | `numeric(14,3)` NULL | z aktywnego `ScheduleSource` (§7a) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | z aktywnego `ScheduleSource` |
| `production_start_at` | `date` NULL | z aktywnego `ScheduleSource` |
| `production_end_at` | `date` NULL | z aktywnego `ScheduleSource` |
| `notes` | `text` NULL | |
| `sent_at` | `timestamptz` NULL | |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` |
| `created_by` | `uuid` NULL | |
| `unlocked_by` | `uuid` NULL | |
| `unlocked_at` | `timestamptz` NULL | |
| `unlock_reason` | `text` NULL | (v1) kopia powodu; źródłem audytu jest metadana komendy `unlock` w `audit_logs` |
| `deal_snapshot` | `jsonb` NULL | rev 8a: snapshot pól deala potrzebnych do odczytu (tytuł, waluta, prawdopodobieństwo, status/closure_outcome); odświeżany subscriberem `customers.deal.*`; bez HTTP |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` NULL | soft delete |

`UNIQUE (organization_id, tenant_id, base_code, revision)`.

Partial unique index:
```sql
CREATE UNIQUE INDEX pc_calculations_active_unique
  ON pc_calculations (deal_id, organization_id, tenant_id)
  WHERE is_active_version = true AND deal_id IS NOT NULL;
```

Constraints: `CHECK (status IN ('draft','sent','superseded','accepted','rejected'))`, `CHECK (price_mode IN ('line_prices','target_margin','markup'))`.

**Numeracja**: serwis przypisuje `base_code = K/{YYYY}/{NNN}` (auto-increment per tenant). `revision` startuje od 1 i rośnie przy każdym odlokowaniu/duplikacji. Display code: `base_code-R{revision}` gdy `revision > 1`, sam `base_code` gdy `revision = 1`.

**Kalkulacja standalone** (bez deala): `deal_id = NULL`. Może być tworzona i edytowana niezależnie. `apply-to-deal` i `forecast_value` działają wyłącznie gdy `deal_id != NULL`. Deal dołączany przez `attach-deal`; inwestycja (v1) przez `attach-investment`. (Rev 8a: `project_id`/`attach-project` usunięte — jedna encja inwestycji, §10.4.) Scope „own" dla standalone: `created_by = current_user_id`.

**Indeks `investment_key`**: `CREATE INDEX pc_calculations_investment_key_trgm ON pc_calculations USING gin(investment_key gin_trgm_ops)` — wymaga rozszerzenia `pg_trgm`. Używany do wyszukiwania duplikatów inwestycji (§3.12).

#### `pc_calculation_lines` — linie kalkulacji (z hierarchią i typami)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `parent_line_id` | `uuid` NULL | FK → `pc_calculation_lines.id`; NULL = linia główna |
| `line_type` | `text` NOT NULL DEFAULT `'item'` | `section` \| `item` \| `note` \| `subtotal` |
| `cost_category_id` | `uuid` NULL | FK → `pc_cost_categories.id`; wymagane dla `item` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` NULL | item only |
| `unit_id` | `uuid` NULL | item only |
| `unit_cost` | `numeric(14,4)` NULL | item only |
| `unit_price` | `numeric(14,4)` NULL | item only |
| `markup_pct` | `numeric(6,4)` NULL | narzut cenowy tej linii/sekcji; NULL = dziedziczony |
| `price_override` | `bool` NOT NULL DEFAULT false | |
| `line_cost` | `numeric(14,2)` NULL | item: quantity × unit_cost; section: SUM(child line_cost) |
| `line_price` | `numeric(14,2)` NULL | item: quantity × unit_price; section: SUM(child line_price) |
| `line_margin` | `numeric(14,2)` NULL | line_price − line_cost |
| `line_margin_pct` | `numeric(6,4)` NULL | line_margin / line_price |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |
| `price_source_id` | `uuid` NULL | FK → `pc_price_sources.id` |
| `price_source_item_code` | `text` NULL | |
| `price_captured_at` | `timestamptz` NULL | |
| `price_captured_unit_cost` | `numeric(14,4)` NULL | |
| `price_captured_unit_price` | `numeric(14,4)` NULL | |
| `import_error` | `bool` DEFAULT false | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraint: `CHECK (line_type IN ('section','item','note','subtotal'))`.

Reguły per typ:
- `section`: `quantity`, `unit_id`, `unit_cost`, `unit_price` = NULL; `line_cost/price/margin` = agregat dzieci.
- `item`: pełne pola.
- `note`: tylko `label`; żadne wartości numeryczne; nie wliczane do sum.
- `subtotal`: linia podsumowania — `line_cost/price/margin` = agregat wszystkich poprzednich linii na tym poziomie hierarchii (lub per sekcja zdefiniowana przez `parent_line_id`).

#### `pc_offer_snapshots` — zamrożony snapshot wersji wysłanej

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `snapshot_data` | `jsonb` NOT NULL | renderowane linie + sumy + price provenance w momencie send |
| `created_at` | `timestamptz` | moment zamrożenia |
| `created_by` | `uuid` NULL | |

`UNIQUE (calculation_id)` — jeden snapshot per wersja.

Snapshot tworzony przy `mark-sent`. `snapshot_data` zawiera: lines (label, qty, unit, unit_cost, unit_price, line_cost, line_price, line_margin_pct per item), totals (subtotal_cost, overhead_amount, full_cost, subtotal_price, total_margin, margin_rate), price_provenance (catalog_entry_id, price_source_id, price_source_item_code, price_captured_at, price_captured_unit_cost/price per linia). PDF generowany z snapshota (nie z bieżących linii).

#### ~~`pc_calculation_audit_log`~~ — usunięte w rev 8a

Audyt akcji (mark-sent, unlock, accept/reject, activate, apply-to-deal, set-primary, merge inwestycji) pochodzi z `audit_logs` (`action_logs`) zapisywanego przez komendy. Powód odblokowania i inne parametry akcji = metadane/payload komendy. Pola kosztu i marży w `snapshot_before`/`snapshot_after`/`changes_json` są redagowane (§4.3). Szczegóły: rev 8b (Kod p6).

#### `pc_calculation_pdf_attachments` — PDF per wersja

Kolumny: id, calculation_id, snapshot_id FK → pc_offer_snapshots.id, organization_id, tenant_id, attachment_id FK-id, generated_at, generated_by, is_latest, template_version. Partial unique index `(calculation_id) WHERE is_latest = true`.

#### `pc_cost_entries` — koszty rzeczywiste

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `calculation_id` | `uuid` NOT NULL | FK-id → pc_calculations (obowiązkowy — wiąże z wersją budżetu) |
| `deal_id` | `uuid` NULL | FK-id → customer_deals (opcjonalne; indeks opcjonalny) |
| `investment_id` | `uuid` NULL | FK-id → `pc_investments.id` (opcjonalne; rev 8a zamiast `project_id`) |
| `calculation_line_id` | `uuid` NULL | FK-id → pc_calculation_lines (opaque, dla granularności) |
| `schedule_task_id` | `uuid` NULL | FK-id → ps_schedule_tasks (w project_schedule) |
| `entry_date` | `date` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → pc_cost_categories |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `quantity` | `numeric(14,4)` NOT NULL DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries unit |
| `unit_amount` | `numeric(14,4)` NOT NULL | koszt jednostkowy |
| `total_amount` | `numeric(14,2)` NOT NULL | quantity × unit_amount (denorm) |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `source` | `text` NOT NULL DEFAULT `'manual'` | `manual` \| `import` \| `integration` |
| `reference` | `text` NULL | nr faktury / zamówienia |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id, organization_id, tenant_id)` (primary lookup), `(deal_id)` (opcjonalny), `(entry_date)`.

#### `pc_investments` — inwestycja (encja, własność `project_costing`)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `investment_code` | `text` NOT NULL | wygenerowany stabilny kod, format: `INV-{YYYY}-{NNNNNN}` (auto-increment per tenant, zero-padded 6 cyfr), np. `INV-2026-000123` |
| `name` | `text` NOT NULL | nazwa inwestycji |
| `location` | `text` NULL | lokalizacja |
| `legacy_klin_project_id` | `uuid` NULL | rev 8a: ID rekordu `klin:project` z jednorazowego importu (§10.4); tylko informacyjnie, bez zależności runtime |
| `status` | `text` NOT NULL DEFAULT `'active'` | `active` \| `merged` \| `archived` |
| `merged_into_id` | `uuid` NULL | FK → `pc_investments.id`; wypełniony gdy `status = 'merged'` |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, investment_code)`.

Indeks: `(organization_id, tenant_id, status)`.

**Merge inwestycji**: endpoint `POST /api/project-costing/investments/:id/merge` (body: `{ targetId }`). Przenosi kalkulacje (`pc_calculations.investment_id`), role ofert (`pc_deal_offer_roles.investment_id`) i identyfikatory (`pc_investment_identifiers`) na `targetId`; ustawia `status = 'merged'`, `merged_into_id = targetId`; audyt przez komendę `project_costing.investments.merge` (`audit_logs`). Idempotent. Gdy po merge'u w `targetId` byłyby dwie oferty `primary`, komenda wymaga wskazania jednej (partial unique, `pc_deal_offer_roles`). **Split** (v2): wydzielenie kalkulacji do nowej inwestycji; odwraca merge przez nowy rekord.

#### `pc_investment_identifiers` — zewnętrzne identyfikatory inwestycji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `investment_id` | `uuid` NOT NULL | FK → `pc_investments.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `source` | `text` NOT NULL | `bzp_notice_number` \| `bzp_procedure_id` \| `bzp_procedure_number` \| `bzp_plan_item` \| `ted_procedure_id` \| `ted_notice_id` \| `bip_number` \| `other` |
| `value` | `text` NOT NULL | wartość identyfikatora |
| `created_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, source, value)` — unikalny identyfikator per (tenant, source) chroni przed duplikatami.

**Typy identyfikatorów** (formaty [do weryfikacji] o ile nie zaznaczono inaczej):

| Source | Opis | Format [do weryfikacji] |
|--------|------|-------------------------|
| `bzp_notice_number` | e-Zamówienia BZP — numer ogłoszenia | np. `2026/BZP 00123456/01` |
| `bzp_procedure_id` | e-Zamówienia — ID postępowania (UUID systemu) | UUID |
| `bzp_procedure_number` | e-Zamówienia — numer postępowania (zamawiającego) | wolny tekst [do weryfikacji] |
| `bzp_plan_item` | Pozycja planu postępowań BZP | wolny tekst [do weryfikacji] |
| `ted_procedure_id` | TED (Tenders Electronic Daily) — ID procedury | np. `2026/S 123-456789` [do weryfikacji] |
| `ted_notice_id` | TED — ID ogłoszenia | wolny tekst [do weryfikacji] |
| `bip_number` | BIP (Biuletyn Informacji Publicznej) numer | wolny tekst [do weryfikacji] |
| `other` | Inny identyfikator zewnętrzny | wolny tekst |

**Kolumna `investment_id` na `pc_calculations`**: dodana jako FK-id opcjonalna (nullable) w `pc_calculations` (zamiast/obok `investment_name`/`investment_location`/`investment_key` — pola pozostają dla kompatybilności i fuzzy-match). `pc_calculations.investment_id` → FK-id → `pc_investments.id`.

#### `pc_deal_offer_roles` — rola oferty deala w inwestycji (encja-rozszerzenie, rev 8a; v1)

Zastępuje custom field `cf_offer_role` na dealu (Kod P0-2). Własność `project_costing`; zero zapisów do `customers`.

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` (bez constraintu DB, bez relacji ORM) |
| `investment_id` | `uuid` NOT NULL | FK → `pc_investments.id` |
| `offer_role` | `text` NOT NULL | `primary` \| `alternative`; `CHECK (offer_role IN ('primary','alternative'))` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | optimistic locking |
| `deleted_at` | `timestamptz` NULL | soft delete |

Indeksy:
```sql
CREATE UNIQUE INDEX pc_deal_offer_roles_deal_investment_unique
  ON pc_deal_offer_roles (organization_id, tenant_id, deal_id, investment_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX pc_deal_offer_roles_one_primary
  ON pc_deal_offer_roles (organization_id, tenant_id, investment_id)
  WHERE offer_role = 'primary' AND deleted_at IS NULL;
```

Deklaracja w `project_costing/data/extensions.ts` (wzór: `apps/mercato/src/modules/example/data/extensions.ts`):
```typescript
{ base: 'customers:customer_deal', extension: 'project_costing:pc_deal_offer_role',
  join: { baseKey: 'id', extensionKey: 'deal_id' }, table: 'pc_deal_offer_roles',
  cardinality: 'one-to-many', description: 'Rola oferty deala (primary/alternative) w inwestycji' }
```
Weryfikacja: deklaracja `EntityExtension` jest kontraktem dla generatora; komentarz we wzorcu mówi, że dziś żaden runtime nie dołącza danych rozszerzenia do zapytań (`includeExtensions`). Dlatego rolę na dealu pokazujemy przez response enricher / widget wstrzyknięty na dealu, a nie przez join w query engine.

#### `pc_production_batches` — wbudowane partie produkcji (embedded schedule source)

Tabela używana gdy `ScheduleSource = calculation_embedded` lub `xlsx_import` (patrz §7a). Umożliwia prognozę produkcji bez modułu `project_schedule`.

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `calculation_line_id` | `uuid` NULL | FK-id → `pc_calculation_lines.id` (opaque, dla granularności) |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity_m3` | `numeric(14,3)` NULL | |
| `quantity_pcs` | `numeric(14,0)` NULL | |
| `production_start_at` | `date` NOT NULL | data startu produkcji |
| `production_end_at` | `date` NOT NULL | data końca produkcji |
| `delivery_at` | `date` NULL | planowana data dostawy |
| `status` | `text` DEFAULT `'planned'` | `planned` \| `in_progress` \| `done` \| `cancelled` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id, organization_id, tenant_id)`, `(production_start_at)`.

Constraint: `CHECK (production_end_at >= production_start_at)`.

Bez zmian strukturalnych (patrz rev 4); `pc_calculation_template_lines` ma dodatkowe `line_type`, `parent_line_id`, `markup_pct` analogicznie do `pc_calculation_lines`.

### 2.3 Waluta i zaokrąglenia

`numeric(14,2)` dla sum (HALF_EVEN), `numeric(14,4)` dla cen jedn., `numeric(14,4)` dla ilości. Jednowalutowe v1 (§3.9).

---

## 3. Reguły wyliczeń

### 3.1 Wycena pozycji (`item`)

```
line_cost    = ROUND(quantity × unit_cost,  2, HALF_EVEN)
line_price   = ROUND(quantity × unit_price, 2, HALF_EVEN)
line_margin  = line_price − line_cost
line_margin_pct = line_margin / line_price   (gdy line_price > 0, else 0)
```

### 3.2 Agregacja sekcji (`section`)

```
section.line_cost  = SUM(child.line_cost  WHERE child.line_type = 'item')
section.line_price = SUM(child.line_price WHERE child.line_type = 'item')
section.line_margin = section.line_price − section.line_cost
section.line_margin_pct = section.line_margin / section.line_price
```

`note` i `subtotal` nie wliczane do sum sekcji. `subtotal` wyświetla sumę pozycji powyżej niego w danej sekcji.

### 3.3 Sumy kalkulacji

```
subtotal_cost   = SUM(item.line_cost)         -- tylko item, nie sekcje (unikaj podwójnego liczenia)
overhead_amount = ROUND(subtotal_cost × overhead_rate, 2, HALF_EVEN)
full_cost       = subtotal_cost + overhead_amount
```

### 3.4 Dziedziczenie narzutu (`markup_pct`)

Dla każdej pozycji `item`: efektywny `markup_pct` = pierwsze nieNULL z:
1. `item.markup_pct`
2. `parent section.markup_pct`
3. `pc_calculations.markup_rate`
4. 0 (brak narzutu)

Efektywny `markup_pct` używany przy trybie C lub jako cena sugerowana (informacyjna) gdy tryb = A lub B.

### 3.5 Tryby ceny (`price_mode`)

#### Tryb A — `line_prices`

Input: `unit_price` per pozycja (ręcznie lub z cennika). `subtotal_price = SUM(item.line_price)`.

#### Tryb B — `target_margin`

Input: `target_margin_rate` na poziomie kalkulacji. `target_subtotal_price = full_cost / (1 − target_margin_rate)`. Redistrybuowanie na pozycje wg §3.6.

#### Tryb C — `markup`

Tryb C liczy `unit_price` **per pozycję** z `line_full_cost` i efektywnego narzutu. Brak globalnej redistrybuowania — każda pozycja jest niezależna.

Dla każdej pozycji `item i` z `price_override = false`:
```
line_full_cost_i = ROUND(line_cost_i × (1 + overhead_rate), 2, HALF_EVEN)
effective_markup_i = pierwsze non-NULL z: [item.markup_pct, parent_section.markup_pct,
                                           calc.markup_rate, 0]
line_price_i     = ROUND(line_full_cost_i × (1 + effective_markup_i), 2, HALF_EVEN)
unit_price_i     = ROUND(line_price_i / quantity_i, 4, HALF_EVEN)   -- gdy quantity > 0
```

Pozycje z `price_override = true`: zachowują bieżące `unit_price`/`line_price` bez zmian.

```
subtotal_price = SUM(line_price_i)   -- suma wszystkich item (override i nie-override)
total_margin   = subtotal_price − full_cost
margin_rate    = total_margin / subtotal_price
```

> **Nazewnictwo (konsekwentne)**:
>
> | Pole | Definicja |
> |------|-----------|
> | `overhead_rate` | % kosztów pośrednich na koszt zakupu (zwiększa koszt) |
> | `full_cost` | `subtotal_cost + overhead_amount` |
> | `markup_rate` | % cenowy na `full_cost` — narzut na poziomie kalkulacji (tryb C, dziedziczony) |
> | `markup_pct` | % cenowy per pozycja/sekcja — nadpisuje `markup_rate` dla danej gałęzi |
> | `target_margin_rate` | % marży od ceny — input trybu B |
> | `margin_rate` | `total_margin / subtotal_price` — zawsze obliczony z rzeczywistych sum |
> | `line_full_cost` | `line_cost × (1 + overhead_rate)` — koszt pozycji z narzutem pośrednim |
> | `line_margin_pct` | `line_margin / line_price` per pozycja |

### 3.6 Redistrybuowanie cen pozycji (tryb B — `target_margin`)

Stosowane **wyłącznie w trybie B**. Tryb C używa per-item formuły (§3.5).

1. `T = full_cost / (1 − target_margin_rate)` (target całkowita cena).
2. `S_ov = SUM(item.line_price WHERE price_override = true)`.
3. `R = T − S_ov`. Gdy `R < 0`: warning UI (nie blokada); `subtotal_price = rzeczywista suma`.
4. Non-override pozycje N: `base = SUM(line_full_cost_i FOR i IN N)` gdzie `line_full_cost_i = line_cost_i × (1 + overhead_rate)`. Proporcja per item: `base > 0` → `line_full_cost_i / base`; `base = 0` → równy podział `1/|N|`.
5. `new_line_price[i] = ROUND(R × proporcja[i], 2, HALF_EVEN)`; `new_unit_price[i] = ROUND(new_line_price[i] / quantity[i], 4, HALF_EVEN)`.
6. Rounding residual: ostatnia pozycja w N absorbuje `R − SUM(new_line_price)`.
7. `subtotal_price = SUM(line_price)` (override + non-override). `total_margin = subtotal_price − full_cost`. `margin_rate = total_margin / subtotal_price`.

### 3.7 Reguła wyznaczania ceny z cennika (layered pricelist)

Przy dodaniu/aktualizacji pozycji z cennika, serwis:
1. Zbiera kandydatów z `pc_price_list_rules` pasujących do `scope_ref` pozycji, posortowanych malejąco wg `priority`, filtrowanych wg `valid_from`/`valid_to` i `min_quantity`.
2. Bierze pierwszego kandydata:
   - `base_type = 'cost'`: `unit_price_derived = unit_cost × (1 + rule.markup_pct − rule.discount_pct)`.
   - `base_type = 'fixed'`: `unit_price_derived = rule.fixed_price`.
   - `base_type = 'list'`: `unit_price_derived` = cena z `base_list_id` (rekurencja 1 poziom).
3. Zapisuje `price_source_id`, `price_source_item_code`, `price_captured_at/unit_cost/unit_price`.

Gdy brak reguły: `unit_price = unit_price` z `pc_price_catalog` (bezpośrednio).

### 3.8 Zamrożony snapshot (offer = frozen version)

Przy `mark-sent`:
1. Serwis weryfikuje `status = 'draft'`.
2. Tworzy `pc_offer_snapshots.snapshot_data` z bieżącymi liniami, sumami i proweniencją.
3. Ustawia `status = 'sent'`, `sent_at = now()`.
4. Linie `pc_calculation_lines` tej wersji są od tej chwili **immutable** (API nie przyjmuje PATCH).
5. Generuje PDF z `snapshot_data` (nie z linii bazy).

PDF klienta generowany **zawsze ze snapshota** — żadne zmiany konfiguracji cennikowej nie wpływają retroaktywnie.

### 3.9 Cykl życia wersji i `is_active_version`

**Statusy**: `draft` → `sent` → `accepted` | `rejected` | `superseded`.
- `superseded`: gdy powstaje nowa wersja z tej samej `base_code`.
- `accepted`/`rejected`: zmiana ręczna (klient podjął decyzję).
- `is_active_version = true`: tylko gdy `deal_id != NULL`; wersja zasilająca `deal.value_amount`.

**Odblokowanie** (admin only, v1): nowa wersja `(base_code, revision + 1)`, `draft`; oryginał → `superseded`. Komenda `unlock` z powodem w metadanych (`audit_logs`).

**Duplikacja jako nowa wersja**: `POST .../duplicate` kopiuje linie.

### 3.10 Waluta kalkulacji

Waluta = `value_currency` z `deal_snapshot` (snapshot przy attach-deal, odświeżany subscriberem) gdy `deal_id != NULL`, else ustawienie `default_currency` (ModuleConfigService). Jednowalutowe v1.

### 3.11 Prognoza wartości = wartość × prawdopodobieństwo

**Tylko gdy `deal_id != NULL`**:
```
forecast_value = is_active_version.subtotal_price × deal.probability / 100
```

Kalkulacje standalone (bez deala) nie wchodzą do prognozy lejka. Recalculate przy zmianie `is_active_version`, `deal.probability`, po `apply-to-deal`.

Widget dashboardu „Prognoza lejka": `SUM(forecast_value)` per etap pipeline lub `expected_close_at`.

### 3.12 Rola oferty (`pc_deal_offer_roles`), suma inwestycji i zarządzanie inwestycjami (rev 8a; v1)

**Rev 8a — usunięte:** podejście z custom field `cf_offer_role` (hardkodowany UUID definicji `73f8260a-…`, który nie istnieje w innym tenancie), EAV na encji obcego modułu, sekwencja dwóch komend `customers.deals.update` z akcją kompensującą i ryzyko R10. Rola oferty jest daną `project_costing` (tabela `pc_deal_offer_roles`, §2.2).

**Reguła sumy inwestycji:**
```
investment_total = SUM(active_calculation(deal).subtotal_price)
  FOR deal IN pc_deal_offer_roles WHERE investment_id = :investment_id
                                     AND offer_role = 'primary' AND deleted_at IS NULL
  AND deal nieprzegrany i nieusunięty (wg pc_calculations.deal_snapshot; mapowanie statusów OM — rev 8b, Kod p5)
```
Oferty `alternative` są widoczne w tabeli inwestycji, ale nie wliczane. Suma liczona z danych costingu (aktywna kalkulacja), bez odczytu `deal.value_amount` przez HTTP.

**Przypisanie roli przy dołączeniu deala do inwestycji** (komenda `project_costing.offer_roles.assign`):
- brak innej aktywnej oferty w inwestycji → `primary`;
- istnieje oferta dla innego wykonawcy → wiersz zapisany jako `alternative`, a UI pokazuje dokładnie komunikat: **„Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”** (decyzja Koordynatora (b); D5). Użytkownik wybiera ofertę główną albo zostawia bieżący stan.

**Zmiana oferty głównej — jedna komenda, jedna transakcja** (`project_costing.offer_roles.set_primary`, `POST /api/project-costing/investments/:id/offer-roles/set-primary`, body `{ dealId }`):
```
BEGIN
  UPDATE pc_deal_offer_roles SET offer_role='alternative', updated_at=now()
   WHERE investment_id=:inv AND offer_role='primary' AND deal_id <> :deal AND deleted_at IS NULL;
  UPDATE pc_deal_offer_roles SET offer_role='primary', updated_at=now()
   WHERE investment_id=:inv AND deal_id=:deal AND deleted_at IS NULL;
COMMIT
```
Kolejność (najpierw degradacja) spełnia partial unique `pc_deal_offer_roles_one_primary`; równoległa zmiana kończy się naruszeniem unikalności → 409 i ponowienie przez użytkownika. Undo komendy przywraca poprzedni `primary`. Audyt: `audit_logs`.

**Migracja istniejących wartości `cf_offer_role`** (546 deali na instancji Marka): jednorazowy, **opcjonalny** import (komenda CLI `yarn mercato project_costing import-offer-roles`, uruchamiana ręcznie) czyta wartości custom fieldu przez serwis `entities` w DI i tworzy wiersze `pc_deal_offer_roles` dla deali przypisanych do inwestycji. Bez zależności runtime: po imporcie moduł nie czyta `cf_offer_role`. Pole na dealu zostaje nietknięte (zarządza nim `customers`/Data Designer); wygaszenie wysyłki z n8n (D39) — pytanie otwarte Q2 (§16).

---

**Zarządzanie inwestycjami (entity `pc_investments`)**

Inwestycja (`pc_investments`) żyje w module `project_costing` i jest **jedynym** bytem „inwestycja/projekt” w systemie (rev 8a; `klin:project` wygaszany — §10.4). Każda kalkulacja może być skojarzona z inwestycją przez `pc_calculations.investment_id`, a deal przez `pc_deal_offer_roles`.

**Stabilny kod inwestycji**: `INV-{YYYY}-{NNNNNN}` (auto-increment per tenant). Kod jest niezmienny po przypisaniu.

**Dopasowanie — kolejność priorytetu**:

1. **Priorytet 1 — zewnętrzne identyfikatory** (`pc_investment_identifiers`): serwis szuka inwestycji z dokładnie pasującym identyfikatorem `(source, value)`. Gdy znaleziono jednoznaczny wynik → automatyczne skojarzenie (bez pytania użytkownika). Obsługiwane źródła: `bzp_notice_number`, `bzp_procedure_id`, `bzp_procedure_number`, `bzp_plan_item`, `ted_procedure_id`, `ted_notice_id`, `bip_number`, `other`. Formaty zewnętrznych identyfikatorów oznaczone `[do weryfikacji]` w §2.2.

2. **Priorytet 2 — fuzzy-match (fallback)**: gdy brak dopasowania przez identyfikatory, serwis generuje kandydatów przez:
   - **Źródło A — pg_trgm**: `similarity(investment_key, :target_key) > 0.5` na `pc_investments` i/lub `pc_calculations.investment_key`
   - **Źródło B — NIP klienta**: matching po `company.cf_nip` z deala = NIP inwestora w istniejących inwestycjach (odczyt przez query engine / serwis DI `customers`, bez HTTP — rev 8a)
   - Wyniki łączone, zdeduplikowane, posortowane wg `score DESC`. `pg_trgm` threshold = 0.5 (konfigurowalny per tenant).
   - **User confirms**: każdy kandydat z fuzzy-match wymaga potwierdzenia użytkownika — brak automatyzacji.

**Endpoint**: `GET /api/project-costing/investments/match-candidates?name=&location=&identifiers[]=`

Response:
```typescript
type InvestmentMatchCandidate = {
  investment: { id: string; investmentCode: string; name: string; location: string | null }
  matchType: 'exact_identifier' | 'fuzzy_suggestion'
  matchedIdentifier?: { source: string; value: string }
  score?: number  // tylko dla fuzzy_suggestion
  matchReason: string[]
}
```

**UI notice** (dla fuzzy_suggestion):
> „Istnieje już inwestycja o podobnej nazwie (${investment.investmentCode}, ${matchReason}). Czy to ta sama inwestycja?"

Przyciski: „Tak — połącz" / „Nie — nowa inwestycja" / „Ignoruj".

**Merge/split inwestycji** (patrz §2.2 `pc_investments`): `POST .../merge`, komenda `project_costing.investments.merge` (audyt w `audit_logs`).

`pg_trgm` wymagane: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` w migracji.

### 3.13 Koszty rzeczywiste vs budżet

Budżet pochodzi z wersji `accepted` (fallback: najnowsza `sent`). `pc_cost_entries` wymaga `calculation_id` dla raportu budżet-vs-actual (zapewnia spójność z konkretną wersją); `deal_id`/`investment_id` opcjonalne (kalkulacje standalone obsługiwane przez `calculation_id`).

**Formuły per kategoria**:

```
-- Budżet (z zatwierdzonej wersji kalkulacji):
direct_budget[cat]   = SUM(item.line_cost WHERE cost_category_id = cat)
overhead_share[cat]  = direct_budget[cat] × overhead_rate
budget_full_cost[cat] = direct_budget[cat] + overhead_share[cat]   -- line_full_cost per kat.

-- Rzeczywiste (z pc_cost_entries):
actual_cost[cat]     = SUM(entry.total_amount WHERE cost_category_id = cat
                           AND entry.calculation_id = :calc_id)

-- Wariancja:
variance[cat]        = actual_cost[cat] − budget_full_cost[cat]    -- + = przekroczenie
variance_pct[cat]    = variance[cat] / budget_full_cost[cat] × 100
```

**Raport widok** (kolumny per kategoria):

| Kategoria | Koszt direct (budżet) | Narzut pośredni (budżet) | Pełny koszt (budżet) | Rzeczywisty | Wariancja | Wariancja % |
|-----------|-----------------------|--------------------------|----------------------|-------------|-----------|-------------|

**Marże ogólne**:
```
margin_offer  = subtotal_price − full_cost          (zaplanowana marża z kalkulacji)
margin_actual = subtotal_price − SUM(actual_cost)   (marża wykonawcza przy zrealizowanej cenie)
```

> Uwaga: `margin_actual` zakłada, że `subtotal_price` z kalkulacji odpowiada faktycznie uzyskanej cenie (cena oferty = cena realizacji). Odchylenie ceny realizacji od oferty jest poza scope v1.

---

## 4. Widoczność (rev 8a — wyłącznie RBAC; ukryta marża = ukryty koszt)

### 4.1 Źródło prawdy: `acl.ts`

Widoczność kosztów, cen i marży wynika **wyłącznie** z feature'ów w `project_costing/acl.ts` (§9). Ustawienia modułu nie zawierają list feature'ów ani flag widoczności (Kod p4, decyzja Koordynatora (e)). „Ustawienie per firma” = które role w organizacji mają dane feature'y: domyślne przypisanie w `setup.ts` `defaultRoleFeatures` (admin/employee), dalej edycja ról w UI auth. Sprawdzanie feature'ów zawsze wildcard-aware (`project_costing.*`), nigdy przez porównanie stringów.

### 4.2 Reguła efektywnej widoczności (Kod P0-3)

Marża = cena − koszt, więc kto widzi cenę i koszt, zna marżę. Dlatego:

```
canSeePrices = has('project_costing.view_prices')
canSeeMargin = has('project_costing.view_margin')
             || (has('project_costing.view_margin_after_close') && deal zamknięty jako wygrany && calc.status = 'accepted')
canSeeCosts  = has('project_costing.view_costs') && (canSeeMargin || !canSeePrices)
```

- Rola bez prawa do marży, która widzi ceny, **nie widzi też kosztów** (`unit_cost`, `line_cost`, `subtotal_cost`, `overhead_amount`, `full_cost`, `line_full_cost`, koszty rzeczywiste, wariancja budżetu) ani pól, z których da się odtworzyć marżę (`markup_pct`, `markup_rate`, `overhead_rate`, `target_margin_rate`).
- Edycja (`project_costing.edit`) dotyczy tylko pól widocznych dla użytkownika; zapis pola niewidocznego → 403.
- `view_margin` domyślnie ma tylko `admin`.

### 4.3 Kanały i reguła dla każdego

| Kanał | Reguła |
|---|---|
| API/CRUD (list, detail, sub-resources linii, trasy akcji) | `applyVisibilityRedaction(record, acl)` w `afterList`/`afterGet` i w trasach akcji; pola niewidoczne usuwane (nie `null`) |
| `query_index` (indexer `makeCrudRoute`) | `indexer.buildUpsertPayload` (typ `CrudIndexerConfig`, `packages/shared/src/lib/crud/types.ts`) buduje dokument **bez** pól kosztu, ceny i marży; filtrowanie/sortowanie po kwotach tylko w zapytaniu bazowym z ACL |
| Wyszukiwanie (`search.ts`) | `fieldPolicy` indeksuje tylko `label`, `base_code`, `notes` nagłówka i etykiety linii; kwot nigdy |
| `audit_logs` / `action_logs` (`snapshot_before`, `snapshot_after`, `changes_json`, `command_payload` — `packages/core/src/modules/audit_logs/data/entities.ts`) | komendy budują snapshoty bez pól kosztu/marży (zostają `changed_fields` i ID); kwoty odtwarzalne z `pc_offer_snapshots`, dostępnego przez API z redakcją |
| Payloady eventów i `clientBroadcast` | tylko ID (§0.4) |
| Eksport XLSX/CSV (v1) | ta sama funkcja redakcji; kolumny niewidoczne pominięte |
| PDF oferty | strukturalnie bez kosztu, narzutu i marży (dokument dla klienta); generowany ze snapshota |
| `/compare` (v1) | delty kosztów/marży tylko gdy `canSeeCosts`/`canSeeMargin` |
| Analityka/dashboardy (`analytics.ts`) | pola kosztu: `requiredFeatures: ['project_costing.view_costs','project_costing.view_margin']`; marża: `view_margin`; widget TOP/BOTTOM (v1) tylko z `view_margin` |
| Snapshot oferty (`pc_offer_snapshots`) | dostęp wyłącznie przez `GET .../snapshot` z redakcją; nie jest indeksowany ani wysyłany w eventach |
| Notyfikacje | treść bez kwot; link do kalkulacji |

### 4.3a Zamknięty deal

Feature `project_costing.view_margin_after_close` (zastępuje ustawienie `margin_visible_after_deal_close`) pozwala zobaczyć marżę zaakceptowanej wersji wygranego deala. Status deala z `deal_snapshot` (subscriber `customers.deal.won`/`lost`), bez HTTP.

### 4.4 Scope kalkulacji (`calculation_scope`)

`"all"` (default) | `"own"`:
- Gdy `deal_id != NULL`: „own" filtruje po właścicielu deala.
- Gdy `deal_id IS NULL` (standalone): „own" filtruje po `created_by = current_user_id`.
- Admin (`project_costing.admin`) zawsze widzi wszystkie.
- Wartość z ustawień organizacji (ModuleConfigService, §2.2).

---

## 5. PDF oferty

### 5.1 Frozen snapshot + PDF

PDF generowany zawsze z `pc_offer_snapshots.snapshot_data` — niezmienny po wysyłce. Dane firmy: `Organization.name` + `Organization.logoUrl` z `directory` + brakujące pola z ustawień `pdf.*` (ModuleConfigService, §2.2).

### 5.2 Renderowanie: `@react-pdf/renderer` v3 (MIT)

Brak Chromium. Rev 8a: generowanie PDF zawsze jako ProgressJob + worker (`@open-mercato/queue`). Wybór biblioteki (`pdf-lib` z core vs `@react-pdf/renderer`) i lista nowych zależności: rev 8b (Kod p10).

### 5.3 Zawartość PDF

Logo + dane firmy, numer oferty (display code `K/2026/001-R2`), data, ważność, dane odbiorcy, hierarchiczna tabela pozycji (sekcje + pozycje, `note` i `subtotal` stylizowane inaczej), kolumny: label, qty, unit, unit_price, line_price. **Bez** unit_cost, line_cost, narzutu, marży. Warunki, stopka, podpis.

### 5.4 Endpointy

```
POST /api/project-costing/calculations/:id/mark-sent      (tworzy snapshot + zamraża)
POST /api/project-costing/calculations/:id/generate-pdf   (generuje PDF ze snapshota)
GET  /api/project-costing/calculations/:id/pdf-attachments
```

---

## 6. Import / Eksport

### 6.1 Biblioteka XLSX: `exceljs` v4.4.0 (MIT)

### 6.2 Import XLSX/CSV — kreator mapowania (MVP, rev 8a)

Rev 8a: import XLSX jest w **MVP** (decyzja Koordynatora (a) — główna potrzeba: przeniesienie kosztów z Excela). Wykonanie: upload i podgląd synchronicznie, zatwierdzenie jako ProgressJob + worker kolejki, zapis komendą `project_costing.import.commit`. Edge case'y (formuły bez zapisanej wartości, scalone komórki, wiele arkuszy, „1 234,56”, jednostki ze słownika): rev 8b (Kod p9). MVP nie ma formuł — importujemy wartości komórek.


1. Upload (max 10 MB, max 5000 wierszy — patrz §6.4).
2. Podgląd (5 wierszy). Mapowanie: `line_type`, `label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `markup_pct`, `notes`.
3. Sekcje importowane jako `line_type=section` gdy `quantity=null`. Mapowanie z `pc_import_column_mappings`.
4. Walidacja + podgląd po mapowaniu. Zatwierdzenie: `POST .../import`.

### 6.3 Eksport XLSX (v1, rev 8a)

Rev 8a: eksport XLSX/CSV idzie do **v1**, bo nie jest marginalny — wymaga tej samej redakcji widoczności co API (§4.3) i osobnych testów tego kanału, a w MVP ofertę wysyła się jako PDF.


Wieloarkuszowy (kolumny redagowane wg §4): linie, sumy per kategoria, nagłówek.

### 6.4 Limity importu

Max **5000 pozycji** / **10 MB**. Timeout 30 s.

---

## 7. Abstrakcja źródeł cennikowych

### 7.1 PriceSourceProvider

```typescript
export interface PriceSourceProvider {
  providerId: string; label: string
  search(query: PriceSourceQuery, ctx: ProviderContext): Promise<PriceSourceItem[]>
  getByCode(code: string, ctx: ProviderContext): Promise<PriceSourceItem | null>
  mapExternalCode?(externalCode: string, ctx: ProviderContext): Promise<PriceSourceItem | null>
}
```

`mapExternalCode` — adapter KNR/index mapping: tłumaczy kody zewnętrzne (np. KNR `2-01/111/1`) na własne pozycje `pc_price_catalog` przez pole `external_code`.

### 7.2 Proweniencja ceny

Na każdej linii: `price_source_id`, `price_source_item_code`, `price_captured_at`, `price_captured_unit_cost/price` (archiwum w momencie dodania). `price_override = true` blokuje nadpisanie.

---

## 7a. ScheduleSource — abstrakcja harmonogramu (moduł `project_schedule` opcjonalny)

Moduł `project_schedule` jest **opcjonalny per firma (organizację)**: włączony w buildzie, włączany w organizacji ustawieniem `schedule.enabled` (ModuleConfigService), z feature toggle'em jako globalnym kill-switchem per tenant (schedule §1.0). Moduł `project_costing` MUSI działać poprawnie gdy `project_schedule` jest wyłączony lub nieobecny w buildzie. Rev 8a: `project_costing` jest właścicielem interfejsu i rejestru; nie zna implementacji `project_schedule`.

### 7a.1 Interfejs `ScheduleSource`

```typescript
// lib/schedule-source/schedule-source.interface.ts
export interface ScheduleSource {
  sourceType: 'internal' | 'calculation_embedded' | 'xlsx_import' | 'external_adapter'

  /** Pobierz partie produkcji do prognozy */
  getBatches(calculationId: string, ctx: ProviderContext): Promise<ProductionBatchSummary[]>

  /** Pobierz sumaryczne daty produkcji (start/end, total m³/pcs) */
  getSummary(calculationId: string, ctx: ProviderContext): Promise<ProductionSummary | null>

  /** Czy source jest dostępny (moduł włączony, dane istnieją) */
  isAvailable(calculationId: string, ctx: ProviderContext): Promise<boolean>
}

export type ProductionBatchSummary = {
  id: string; label: string
  elementTypeCode: string | null
  quantityM3: number | null; quantityPcs: number | null
  productionStartAt: string; productionEndAt: string
  deliveryAt: string | null; status: string
}

export type ProductionSummary = {
  totalQuantityM3: number | null; totalQuantityPcs: number | null
  productionStartAt: string | null; productionEndAt: string | null
  batchCount: number
}
```

### 7a.2 Rejestr i implementacje (DI, rev 8a)

```typescript
// project_costing/lib/schedule-source/schedule-source.registry.ts
export interface ScheduleSourceRegistry {
  register(source: ScheduleSource): void              // wołane przez di.ts modułów-providerów
  list(): ScheduleSource[]
  getActive(calculationId: string, ctx: ProviderContext): Promise<ScheduleSource> // zawsze zwraca źródło (fallback: embedded)
}
// project_costing/di.ts: rejestruje scheduleSourceRegistry (singleton) + EmbeddedScheduleSource
// project_schedule/di.ts: container.resolve('scheduleSourceRegistry').register(new InternalScheduleSource(...))
```

| Implementacja | Właściciel | Opis |
|---------------|-----------|------|
| `EmbeddedScheduleSource` | `project_costing` | Czyta `pc_production_batches`; zawsze dostępna; fallback |
| `XlsxImportSource` | `project_costing` | Import harmonogramu z XLSX do `pc_production_batches` (wariant embedded); `POST .../calculations/:id/import-schedule` (v1) |
| `InternalScheduleSource` | **`project_schedule`** | Rejestrowana przez `project_schedule/di.ts`; czyta `ps_*` przez własne serwisy schedule. `isAvailable()` = moduł aktywny w organizacji (schedule §1.0) i istnieje harmonogram powiązany z kalkulacją. **Zero HTTP.** |
| `ExternalAdapterSource` | przyszły moduł integracji | v2; rejestruje się tak samo |

`project_costing` nie importuje żadnej z implementacji spoza siebie; zna tylko interfejs i rejestr.

### 7a.3 Wybór aktywnego źródła

Priorytet (per kalkulacja/organizacja):
1. `pc_calculations.schedule_source_override` (pole opcjonalne, nullable text) — nadpisuje ustawienie organizacji.
2. Ustawienie `schedule_source` (ModuleConfigService per organizacja, §2.2); domyślnie `calculation_embedded`.
3. Fallback: gdy wybrane źródło nie jest zarejestrowane albo `isAvailable() = false` → `EmbeddedScheduleSource` (transparent fallback, log warning).

### 7a.4 Prognoza 6 miesięcy z aktywnego źródła

Prognoza (`GET /api/project-costing/calculations/:id/production-forecast?months=6&probability=`) agreguje dane z `scheduleSourceService.getActiveSource(calculationId)`. Pro-rata LRM + ważenie prawdopodobieństwem — identyczna logika niezależnie od źródła (patrz `project_schedule` §4 dla wzorów LRM).

Pola `total_quantity_m3/pcs`, `production_start_at/end_at` w `pc_calculations` aktualizuje komenda `project_costing.calculations.refresh_schedule_totals` (DI, przez kolejkę z debounce). Wywołuje ją właściciel danych: costing po zmianie partii embedded, a `project_schedule` (jego subscriber na własne eventy) po zmianie harmonogramu. Costing nie subskrybuje eventów `project_schedule.*`.

### 7a.5 Element types a opcjonalność

`pc_element_types` (własność `project_costing`) dostępne zawsze — bez zależności od `project_schedule`. Rev 8a: `project_schedule` czyta typy elementów przez serwis DI `elementTypeService` (nie przez `GET /api/project-costing/element-types`) i referencjonuje je przez `element_type_code` (string). Brak FK z `project_schedule` do `pc_element_types`.

---

## 8. API

Prefix: `/api/project-costing/`. Optimistic locking na `PATCH`/`DELETE`. Rev 8a: każda trasa eksportuje `openApi`; CRUD przez `makeCrudRoute` + indexer z `buildUpsertPayload` (§4.3); akcje przez komendy. Fazę każdej trasy podaje §14. Trasy są API dla UI i klientów zewnętrznych, **nie** dla innych modułów (te używają DI, §0.2).

### 8.1 Ustawienia

```
GET   /api/project-costing/settings
PATCH /api/project-costing/settings    (partial update; body: { key: value, ... })
```

Odczyt i zapis przez `ModuleConfigService` (§2.2): `GET` zwraca ustawienia efektywne organizacji z kontekstu; `PATCH` zapisuje `org:{organizationId}:settings` (feature `project_costing.admin`). Klucze: `default_currency`, `default_overhead_rate`, `calculation_scope`, `pdf.*`, `schedule_source`, `schedule.enabled`.

### 8.2 Segmenty, kategorie kosztów i typy elementów

```
GET    /api/project-costing/segments
POST   /api/project-costing/segments
PATCH  /api/project-costing/segments/:id
DELETE /api/project-costing/segments/:id   (tylko gdy brak powiązanych kalkulacji)

GET    /api/project-costing/cost-categories?segmentCode=&isActive=
POST   /api/project-costing/cost-categories
PATCH  /api/project-costing/cost-categories/:id
DELETE /api/project-costing/cost-categories/:id

GET    /api/project-costing/element-types?segmentCode=&isActive=
POST   /api/project-costing/element-types
PATCH  /api/project-costing/element-types/:id
DELETE /api/project-costing/element-types/:id   (tylko gdy brak powiązanych danych)
```

> **Typy elementów** (`pc_element_types`): własność `project_costing`. Endpointy służą UI administracji. `project_schedule` czyta typy przez serwis DI `elementTypeService` (rev 8a — zero HTTP między modułami). Referencja w `project_schedule` przez `element_type_code` (string), nie FK-id.

### 8.3 Źródła i cennik

```
GET/POST/PATCH/DELETE /api/project-costing/price-sources[/:id]
GET/POST/PATCH/DELETE /api/project-costing/price-catalog[/:id]?priceSourceId=
GET /api/project-costing/price-catalog/export | POST .../import | POST .../search
GET/POST/PATCH/DELETE /api/project-costing/price-list-rules[/:id]
```

### 8.4 Szablony

```
GET/POST/PATCH/DELETE /api/project-costing/calculation-templates[/:id]
GET/POST .../lines | PATCH/DELETE .../template-lines/:lineId
```

### 8.5 Kalkulacje — CRUD i lifecycle

```
GET/POST  /api/project-costing/calculations?dealId=&status=&isActiveVersion=
GET/PATCH /api/project-costing/calculations/:id
DELETE    /api/project-costing/calculations/:id    (tylko draft)

POST .../duplicate           (nowa rewizja: base_code + revision+1)
POST .../recalc              (przelicz linie + narzut + tryb)
POST .../activate            (is_active_version → true; wymaga deal_id != NULL)
POST .../mark-sent           (snapshot + status=sent)
POST .../mark-accepted       (status=accepted, is_active_version=true gdy deal_id != NULL)
POST .../mark-rejected       (status=rejected)
POST .../unlock              (admin: nowa rewizja draft, stara=superseded, audit log)
POST .../apply-to-deal       (value_amount przez command bus; wymaga deal_id != NULL)
POST .../generate-pdf        (z snapshota)
POST .../attach-deal         (dołącz deal: body { dealId }; sprawdza match inwestycji)
DELETE .../attach-deal       (odłącz deal; is_active_version → false)
POST .../attach-investment   (dołącz inwestycję: body { investmentId }; tworzy pc_investments jeśli brak)
DELETE .../attach-investment (odłącz inwestycję)
GET  .../investment-match-candidates?name=&location=&identifiers[]=  (match §3.12)
GET  .../production-forecast?months=6&probability=  (z aktywnego ScheduleSource)

GET  .../export?format=xlsx|csv
POST .../import
GET  .../pdf-attachments
GET  .../snapshot
GET  .../compare?with=<otherId>          (diff dwóch wersji — patrz §8.10)
```

### 8.5a Inwestycje

```
GET/POST  /api/project-costing/investments?status=
GET/PATCH /api/project-costing/investments/:id
DELETE    /api/project-costing/investments/:id   (tylko gdy brak powiązanych kalkulacji)

GET/POST/DELETE /api/project-costing/investments/:id/identifiers[/:identifierId]
GET       /api/project-costing/investments/:id/offer-roles               (lista ról ofert, §3.12)
POST      /api/project-costing/investments/:id/offer-roles               (assign: body { dealId }; ostrzeżenie z komunikatem z §3.12)
POST      /api/project-costing/investments/:id/offer-roles/set-primary   (body { dealId }; jedna komenda, jedna transakcja)
POST      /api/project-costing/investments/:id/merge   (body: { targetId })
GET       /api/project-costing/investments/match-candidates?name=&location=&identifiers[]=
```

### 8.5b Embedded production batches

```
GET/POST  /api/project-costing/calculations/:id/production-batches
PATCH/DELETE /api/project-costing/calculations/:id/production-batches/:batchId
POST      /api/project-costing/calculations/:id/import-schedule   (xlsx_import source)
```

`PATCH /api/project-costing/calculations/:id` akceptuje: `price_mode`, `overhead_rate`, `markup_rate`, `target_margin_rate`, `label`, `currency`, `notes`. Zmiana `price_mode` wyzwala recalc.

### 8.6 Linie kalkulacji

```
GET/POST /api/project-costing/calculation-lines?calculationId=
PATCH/DELETE /api/project-costing/calculation-lines/:id
POST /api/project-costing/calculation-lines/batch   (bulk upsert — auto-save)
```

Wersje z `status != 'draft'`: API odrzuca PATCH/DELETE z 409.

### 8.7 `apply-to-deal` — jawna komenda `customers` wywołana przez użytkownika (rev 8a)

`apply-to-deal` zapisuje `value_amount` deala, czyli pole modułu `customers`. Zgodnie z P0-2 costing **nie zapisuje pól obcego modułu po cichu**:
- akcję uruchamia wyłącznie przycisk użytkownika („Zastosuj wartość do deala”) z potwierdzeniem pokazującym starą i nową wartość; żaden subscriber ani automat tego nie robi;
- wykonanie = komenda właściciela `customers.deals.update` (`packages/core/src/modules/customers/commands/deals.ts`) przez `commandBus` z kontekstem użytkownika — z audytem, undo i ACL `customers` (użytkownik musi mieć prawo edycji deala oraz `project_costing.apply_to_deal`);
- costing nie pisze bezpośrednio do tabel `customers` ani do custom fieldów deala.

```typescript
await commandBus.execute({ commandId: 'customers.deals.update',
  input: { id: calculation.dealId, valueAmount: calculation.subtotalPrice }, ctx /* użytkownik */ })
```
Alternatywa bez zapisu do `customers` (wartość kalkulacji tylko wyświetlana na dealu przez enricher) — pytanie otwarte Q1 (§16).

### 8.8 Koszty rzeczywiste

```
GET/POST /api/project-costing/cost-entries?dealId=&calculationId=
PATCH/DELETE /api/project-costing/cost-entries/:id
POST /api/project-costing/cost-entries/import   (v2)
GET  /api/project-costing/deals/:dealId/budget-vs-actual   (raport budżet vs realizacja)
```

### 8.9 Mapowania importu

```
GET/POST/PATCH/DELETE /api/project-costing/import-column-mappings[/:id]
```

### 8.10 Porównanie wersji kalkulacji

```
GET /api/project-costing/calculations/:id/compare?with=<otherId>
```

Parametry: `:id` = base version, `with=<otherId>` = version do porównania (obie muszą należeć do tego samego `base_code` lub być jawnie wskazane przez użytkownika). Zwraca:

```typescript
type CalculationCompareResult = {
  base: { id: string; displayCode: string; status: string }
  compare: { id: string; displayCode: string; status: string }
  headerDeltas: {
    subtotalCost: { base: number | null; compare: number | null; delta: number | null }
    fullCost: { base: number | null; compare: number | null; delta: number | null }
    subtotalPrice: { base: number | null; compare: number | null; delta: number | null }
    totalMargin: { base: number | null; compare: number | null; delta: number | null }
    marginRate: { base: number | null; compare: number | null; delta: number | null }
  }
  lineChanges: LineChange[]
}

type LineChange = {
  changeType: 'added' | 'removed' | 'changed' | 'unchanged'
  label: string
  baseLineId: string | null; compareLineId: string | null
  deltas: {
    quantity?: { base: number | null; compare: number | null }
    unitCost?: { base: number | null; compare: number | null }   // visibility: view_costs
    unitPrice?: { base: number | null; compare: number | null }  // visibility: view_prices
    lineCost?: { base: number | null; compare: number | null }   // visibility: view_costs
    linePrice?: { base: number | null; compare: number | null }  // visibility: view_prices
    lineMargin?: { base: number | null; compare: number | null } // visibility: view_margin
  }
}
```

Pola kosztów/marż/cen w `headerDeltas` i `lineChanges.deltas` podlegają tej samej redakcji widoczności co endpoint list/detail (§4.3). Wersje `sent`/`accepted`/`superseded` porównywalne (snapshot-based gdy obie mają snapshot).

---

## 9. Uprawnienia (ACL) — rev 8a

Role OM: `superadmin`, `admin`, `employee` (`packages/core/src/modules/customers/setup.ts` `defaultRoleFeatures`). Ról `manager`/`sales` nie zakładamy (Kod p4; role własne tworzy się w UI auth, `sync-role-acls` ról nie tworzy). Feature'y z `acl.ts` trafiają do `setup.ts` `defaultRoleFeatures`.

| Feature ID | Opis | Faza | `admin` | `employee` |
|-----------|------|------|---------|------------|
| `project_costing.view` | Podgląd kalkulacji | MVP | ✅ | ✅ |
| `project_costing.view_prices` | Ceny sprzedaży | MVP | ✅ | ✅ |
| `project_costing.view_costs` | Koszty (efektywnie tylko z `view_margin` albo bez `view_prices`, §4.2) | MVP | ✅ | ❌ |
| `project_costing.view_margin` | Marża (i koszt przy widocznych cenach) | MVP | ✅ | ❌ |
| `project_costing.view_margin_after_close` | Marża zaakceptowanej wersji wygranego deala | v1 | ✅ | ❌ |
| `project_costing.edit` | Edycja kalkulacji i linii (tylko pól widocznych) | MVP | ✅ | ✅ |
| `project_costing.edit_markup` | Edycja narzutów i trybu ceny | MVP | ✅ | ❌ |
| `project_costing.lock` | Mark-sent (snapshot) | MVP | ✅ | ✅ |
| `project_costing.apply_to_deal` | Zastosuj wartość do deala (§8.7) | MVP | ✅ | ❌ |
| `project_costing.import` | Import XLSX | MVP | ✅ | ✅ |
| `project_costing.export` | Eksport XLSX/CSV (PDF oferty wymaga `view` + `view_prices`) | v1 | ✅ | ✅ |
| `project_costing.admin` | Ustawienia, cennik, kategorie, typy elementów, odblokowanie, merge inwestycji | MVP | ✅ | ❌ |
| `project_costing.manage_offer_roles` | Przypisanie i zmiana oferty głównej | v1 | ✅ | ✅ |
| `project_costing.view_actual_costs` | Koszty rzeczywiste | v1 | ✅ | ❌ |
| `project_costing.edit_actual_costs` | Wpisy kosztów rzeczywistych | v1 | ✅ | ❌ |

`superadmin` ma wszystko z mocy roli. Domyślne przypisanie dla `employee` (bez kosztów i marży) to propozycja — pytanie Q5 (§16). Organizacja zmienia je, edytując role; to jest „ustawienie widoczności per firma” (D13, decyzja (e)).

---

## 10. Zdarzenia i integracja

### 10.1 Zdarzenia modułu

```
project_costing.calculation.created     (clientBroadcast: true)
project_costing.calculation.updated
project_costing.calculation.activated   (clientBroadcast: true)
project_costing.calculation.sent        (clientBroadcast: true)
project_costing.calculation.accepted
project_costing.calculation.rejected
project_costing.calculation.superseded
project_costing.calculation.unlocked
project_costing.deal.value_applied      (clientBroadcast: true)
project_costing.pdf.generated           (clientBroadcast: true)
project_costing.cost_entry.created
project_costing.cost_entry.updated
```

Rev 8a: payload każdego eventu = `{ id, organizationId, tenantId, dealId?, investmentId? }`, bez kwot (§4.3). `clientBroadcast` tylko z ID. Dochodzi `project_costing.calculation.deleted` (dla konsumentów, np. `project_schedule`).

### 10.2 Integracja z Dealem

- Zakładka `detail:customers.deal:tabs`.
- `apply-to-deal`: §8.7.
- Subscribery (persistent) `customers.deal.updated|won|lost|deleted` → odśwież `deal_snapshot` (waluta, prawdopodobieństwo, status), przelicz `forecast_value`. Dane deala przez query engine / serwis DI, bez HTTP.
- Rola oferty na dealu (v1): widget + response enricher (dane z `pc_deal_offer_roles`), bez zapisu do `customers`.

### 10.3 Integracja z `project_schedule` (rev 8a)

`project_costing` nie subskrybuje eventów `project_schedule` i nie wywołuje jego API. Całą integrację trzyma `project_schedule` (konsument): rejestruje `InternalScheduleSource` w `scheduleSourceRegistry`, subskrybuje `project_costing.calculation.activated` / `.deleted` i po zmianach własnego harmonogramu wywołuje komendę costingu `refresh_schedule_totals` (DI, kolejka z debounce). Szczegóły: schedule §5.

### 10.4 Inwestycja = jedna encja (`pc_investments`); wygaszenie `klin:project` (rev 8a, decyzja (c))

**Decyzja (propozycja rev 8a):** zostaje `pc_investments`. Uzasadnienie:
- `klin:project` to custom entity Data Designera: istnieje tylko w tenancie, który ją zdefiniował, a moduł musiałby polegać na jej ID i polach (ten sam problem co hardkodowany UUID `cf_offer_role`);
- `pc_investments` ma typowany schemat, stabilny kod `INV-YYYY-NNNNNN`, identyfikatory zewnętrzne z unikalnością (D6), merge, partial unique na ofercie głównej i podlega komendom oraz ACL modułu;
- jedno pojęcie zamiast dwóch prawie identycznych (Kod p11).

Usunięte z modelu: `project_id` na `pc_calculations`/`pc_investments`/`pc_cost_entries`, endpointy `attach-project`, widget na stronie `klin:project`, strona `/project-costing/projects/:projectId`. Zamiast nich: strona inwestycji `/backend/project-costing/investments/:id` (deale z rolą oferty, suma inwestycji, kalkulacje) i zakładka na dealu przez istniejący spot `detail:customers.deal:tabs` (zweryfikowano: `packages/core/src/modules/customers/backend/customers/deals/[id]/hooks/useDealInjectedTabs.tsx` l.28).

**Migracja danych `klin:project`** (jednorazowa, opcjonalna, v1; komenda CLI `yarn mercato project_costing import-klin-projects --tenant <id> [--dry-run]`):
1. Odczyt rekordów `klin:project` i ich relacji do deali przez serwis `entities` w DI (bez HTTP); brak definicji w tenancie = no-op.
2. Dla każdego rekordu: znajdź `pc_investments` po identyfikatorze zewnętrznym (D6), a jeśli brak — utwórz nową (`name`, `location`, `legacy_klin_project_id`, identyfikatory) komendą `investments.create` (audyt).
3. Dla każdego powiązanego deala utwórz `pc_deal_offer_roles` (rola z `cf_offer_role`, jeśli była — §3.12; brak = reguła „pierwsza oferta = primary”).
4. Raport (`--dry-run` domyślnie pokazuje plan): utworzone, dopasowane, konflikty dwóch `primary`.
5. Po akceptacji wyniku przez Marka definicję `klin:project` wyłącza użytkownik w Data Designerze; moduł jej nie usuwa i po imporcie nie czyta. D7/D43 wymagają nowego wiersza w `decisions.md` (Koordynator).

---

## 11. Analityka (`analytics.ts`)

Encja `project_costing:calculations` (fieldMappings): id, dealId, status, priceMode, currency, subtotalCost[`view_costs`+`view_margin`], overheadAmount[`view_costs`+`view_margin`], fullCost[`view_costs`+`view_margin`], subtotalPrice[`view_prices`], totalMargin[`view_margin`], marginRate[`view_margin`], totalQuantityM3, totalQuantityPcs, createdAt, isActiveVersion. (Rev 8a: koszt wymaga też `view_margin`, §4.2. Analityka = v1.)

Widget TOP/BOTTOM marża: filtr `isActiveVersion=true`, metryka `marginRate`[`view_margin`].
Widget prognoza lejka: `subtotalPrice × probability` z `deal_snapshot` per etap (bez joinu do tabel `customers` w czasie zapytania; v1).

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs`. Widget: `DealCalculationTab.tsx`.

Nagłówek: dropdown wersji (display code `K/2026/001-R2`, status badge), tryb ceny A/B/C, `overhead_rate`, `markup_rate`/`target_margin_rate` per tryb, sumy (koszty/ceny/marża — redagowane wg §4), przycisk „Wyślij ofertę" → `mark-sent`, „Generuj PDF", „Aktywuj", „Zaakceptowano" / „Odrzucono", „Duplikuj jako nową rewizję".

### 12.2 Siatka kosztów — `react-data-grid` v7 (MIT, ~50 KB)

Hierarchia: kolumna `label` z wcięciem per `parent_line_id`. Typy linii: `section` (bold, tło DS), `item` (normalna), `note` (italic, bez liczb), `subtotal` (bold, podsumowanie).

Kolumny: line_type [icon], label, qty, unit, unit_cost [`view_costs`], unit_price [`view_prices`], markup_pct, line_cost [`view_costs`], line_price [`view_prices`], line_margin [`view_margin`], line_margin_pct [`view_margin`], akcje.

### 12.3 Widok budget vs actual

Strona `/project-costing/deals/:dealId/actual-costs`: tabela per kategoria z kolumnami: bezpośredni koszt (budżet), narzut pośredni (budżet), pełny koszt (budżet), rzeczywisty, wariancja, wariancja %. Dane z `GET /api/project-costing/deals/:dealId/budget-vs-actual`.

### 12.4 Porównanie wersji kalkulacji

Strona `/project-costing/calculations/:id/compare?with=<otherId>` (lub modal z version selectorem). Widok side-by-side:
- Nagłówek: sumy base vs compare (koszty/ceny/marża — redagowane wg §4), ze strzałkami kierunku zmiany (↑/↓) i kolorem DS.
- Tabela linii: kolumna „Zmiana" (added/removed/changed/unchanged) + pole deltas. `added` = zielone tło, `removed` = czerwone przekreślenie, `changed` = żółte wyróżnienie.
- Sekcje zwijalne.
- Uruchamiane z dropdown wersji kalkulacji (przycisk „Porównaj z...").

### 12.5 Strony backend

MVP: `/settings`, `/cost-categories`, `/element-types`, `/price-catalog[/id]`, `/calculations[/id]`, `/import-mappings`. v1: `/segments[/id]`, `/templates[/id]`, `/price-list-rules`, `/investments[/id]`, `/deals/:dealId/actual-costs`, `/calculations/:id/compare`. Listy i formularze na `DataTable`/`CrudForm` z `packages/ui`.

---

## 13. Rekomendacja cennikowa

**v1**: własny cennik + import CSV/XLSX. **v2**: Sekocenbud/Intercenbud (pliki XLSX per kwartał, brak API). **v2+**: KNR szablony seed. Patrz §7 dla KNR adapter.

---

## 14. Fazy i szacowanie wysiłku (rev 8a — przeliczone od zera)

**Metoda.** Liczymy encje, trasy API i ekrany w każdej fazie. Prace domenowe (D) szacujemy osobno od narzutu OM (O), który wynika z konwencji repo: per encja — migracja i snapshot, zod, komendy z undo, `makeCrudRoute` + `openApi` + indexer, granty w `setup.ts` (`packages/core/AGENTS.md` l.8–13); per ekran — `CrudForm`/`DataTable`; i18n pl/en; testy integracyjne każdej trasy API w tej samej zmianie (root `AGENTS.md` l.166, `.ai/qa/AGENTS.md`; Playwright w `__integration__` modułu) oraz unit Jest. Stawki: pełna encja 0,5 d, encja systemowa (bez CRUD dla użytkownika) 0,25 d, ekran 0,4 d, ~0,1 d testu integracyjnego na trasę. Do tego bufor 10% (integracja, review, poprawki po odbiorze Cezara).

### `project_costing` — MVP (40 dni roboczych)

Zakres (Kod p15 + decyzja (a)): siatka sekcje → pozycje, import XLSX, tryby A i C, prosty cennik firmy (jedno źródło `company_catalog`, bez reguł), mark-sent ze snapshotem + PDF, apply-to-deal, widoczność przez RBAC, partie produkcji w kalkulacji + prognoza 6 mies. Bez Gantta, formuł, eksportu XLSX, trybu B, inwestycji i porównania wersji.

Encje: pełne (7) `pc_cost_categories`, `pc_element_types`, `pc_price_catalog`, `pc_calculations`, `pc_calculation_lines` (sub-resource), `pc_production_batches`, `pc_import_column_mappings`; systemowe (2) `pc_offer_snapshots`, `pc_calculation_pdf_attachments`; seed `pc_price_sources` (1 wiersz, bez CRUD). Trasy API: 43 (settings 2, cost-categories 4, element-types 4, price-catalog 4 + search 1, calculations CRUD 4 + mark-sent, generate-pdf, pdf-attachments, snapshot, apply-to-deal, recalc, attach-deal, detach-deal, production-forecast = 13, calculation-lines 4 + batch 1, production-batches 4, import preview + commit 2, import-column-mappings 4). Ekrany: 6 (ustawienia, kategorie, typy elementów, cennik, lista kalkulacji, mapowania importu); siatka i zakładka deala liczone w D.

| # | Zadanie | Dni |
|---|---------|-----|
| D1 | Szkielet modułu: `index.ts`, `acl.ts`, `setup.ts` (`defaultRoleFeatures`), `events.ts`, `di.ts`; ustawienia per organizacja przez ModuleConfigService | 1 |
| D2 | Prosty cennik firmy: lookup pozycji w siatce, proweniencja ceny | 1 |
| D3 | Nagłówek kalkulacji: numeracja sekwencją Postgresa per organizacja (wzór `packages/core/src/modules/sales/services/salesDocumentNumberGenerator.ts`), statusy draft/sent, attach/detach deal, `deal_snapshot` | 1,5 |
| D4 | Czysta funkcja `calculate()` (klient = serwer): tryby A i C, sekcja → pozycje, narzut; komenda zapisu inputów + sum, lock na nagłówku; benchmark 5000 linii | 2,5 |
| D5 | Siatka „jak Excel” (edycja klawiaturą, sekcje, autosave) na komponentach `packages/ui` | 4 |
| D6 | Import XLSX: upload, podgląd, kreator mapowania, ProgressJob + worker, komenda commit | 3,5 |
| D7 | Mark-sent: snapshot (`pc_offer_snapshots`) + PDF oferty w workerze + `attachments` | 3 |
| D8 | Apply-to-deal (jawna komenda `customers`) + zakładka „Kalkulacja” na `detail:customers.deal:tabs` | 1,5 |
| D9 | RBAC i redakcja we wszystkich kanałach (§4.3): API, payload indexera, search, audit, eventy, PDF | 2 |
| D10 | Partie produkcji (`pc_production_batches`), `ScheduleSource` + rejestr DI, prognoza 6 mies. (LRM) | 2,5 |
| | **Suma prac domenowych** | **23** |
| O1 | Narzut OM per encja: 7 × 0,5 + 2 × 0,25 | 4 |
| O2 | `CrudForm`/`DataTable`: 6 ekranów × 0,4 | 2,5 |
| O3 | i18n pl/en | 1 |
| O4 | Testy integracyjne Playwright: 43 trasy × ~0,1 | 4,5 |
| O5 | Testy unit Jest (`calculate()`, LRM, numeracja, redakcja) | 1,5 |
| | **Suma narzutu OM** | **13,5** |
| B | Bufor 10% | 3,5 |
| | **Suma MVP** | **40** |

### `project_costing` — v1 (45 dni roboczych)

Encje: 8 (`pc_segments`, `pc_price_list_rules`, `pc_calculation_templates`, `pc_calculation_template_lines`, `pc_investments`, `pc_investment_identifiers`, `pc_deal_offer_roles`, `pc_cost_entries`). Trasy API: 44 (segments 4, price-list-rules 4, templates 4 + lines 4, investments 5 + identifiers 3 + merge 1 + match 1, offer-roles 3, lifecycle 5, compare 1, cost-entries 4 + budget-vs-actual 1 + import-schedule 1, export 1, price-catalog import/export 2). Ekrany: 8.

| # | Zadanie | Dni |
|---|---------|-----|
| D1 | Tryb B (`target_margin`) + redystrybucja | 1,5 |
| D2 | Wielopoziomowe reguły cennika (`pc_price_list_rules`) | 2,5 |
| D3 | Segmenty | 1 |
| D4 | Szablony kalkulacji | 2 |
| D5 | Inwestycje: encja, identyfikatory, dopasowanie (identyfikator → pg_trgm), merge, strona inwestycji | 4 |
| D6 | Role ofert (`pc_deal_offer_roles`): assign + komunikat, set-primary w jednej transakcji, enricher/widget na dealu | 2 |
| D7 | Jednorazowe importy `cf_offer_role` i `klin:project` (CLI, dry-run, raport) | 1,5 |
| D8 | Pełny cykl wersji: accepted/rejected/superseded, activate, unlock, duplicate | 2 |
| D9 | Porównanie wersji (`/compare` + UI) | 2 |
| D10 | Koszty rzeczywiste + raport budżet vs wykonanie | 2,5 |
| D11 | Analityka: TOP/BOTTOM marża, prognoza lejka | 1,5 |
| D12 | Eksport XLSX/CSV z redakcją (TC-IMP-008 → v1) + import harmonogramu XLSX do partii | 1,5 |
| D13 | `quantity_expr` z bezpiecznym parserem arytmetyki (bez `eval`; ilość z wymiarów) — D30 | 2 |
| D14 | Import/eksport cennika CSV/XLSX | 1 |
| | **Suma prac domenowych** | **27** |
| O1 | Narzut OM per encja: 8 × 0,5 | 4 |
| O2 | `CrudForm`/`DataTable`: 8 ekranów × ~0,4 | 3 |
| O3 | i18n pl/en | 1 |
| O4 | Testy integracyjne: 44 trasy × ~0,1 | 4,5 |
| O5 | Testy unit (tryb B, reguły, parser, dopasowanie) | 1,5 |
| | **Suma narzutu OM** | **14** |
| B | Bufor 10% | 4 |
| | **Suma v1** | **45** |

### `project_costing` — v2 (16 dni roboczych)

| # | Zadanie | Dni |
|---|---------|-----|
| D1 | Multi-segment + nowe kategorie | 1 |
| D2 | Adapter Sekocenbud/Intercenbud XLSX + KNR `mapExternalCode` | 2,5 |
| D3 | Import kosztów rzeczywistych z faktur + integracje (ERP, plik) | 2 |
| D4 | Biblioteka szablonów KNR (seed) | 2 |
| D5 | Konwersja walutowa (`currencies`) | 1 |
| D6 | AI-tool: generowanie linii kalkulacji z opisu | 3 |
| | **Suma prac domenowych** | **11,5** |
| O | Narzut OM (trasy, testy, i18n) | 3 |
| B | Bufor 10% | 1,5 |
| | **Suma v2** | **16** |

**Total `project_costing`**: 40 + 45 + 16 = **101 dni roboczych**.

---

### Podsumowanie zbiorcze (oba moduły) — rev 8a

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 40 d | 45 d | 16 d | 101 d |
| `project_schedule` | 0 d | 34 d | 16 d | 50 d |
| **Łącznie** | **40 d** | **79 d** | **32 d** | **151 d** |

Jednostka: dzień roboczy doświadczonego dewelopera znającego OM. Każda faza zawiera osobne pozycje na narzut OM (encje, ekrany, i18n, testy) i bufor 10%. Szczegóły: costing §14, schedule §12.

**Porównanie z szacunkiem Kod (review PR #10, 2026-10-19):** Kod: przycięte MVP ~25–30 d, całość ~150–170 d, MVP bez przycięcia ~50–60 d; rev 7: 94,5 d. Rev 8a: MVP 40 d = ~31,5 d dla zakresu Kod (górna granica jego widełek) + import XLSX w MVP (decyzja Koordynatora (a): ~3,5 d domeny + ~1,5 d narzutu) + bufor 3,5 d. Całość 151 d mieści się w widełkach Kod. Różnica względem rev 7 (+56,5 d) to głównie narzut OM liczony jawnie (~52 d we wszystkich fazach), bufor (~15 d) i własny Gantt bez SVAR PRO (~10,5 d: auto-scheduling 3,5 + własne elementy UI ~2 + CPM 3 + kalendarz dni roboczych 2).

---

## 15. Risks (rev 8a — z ryzykiem rezydualnym)

| # | Scenariusz awarii | Obszar | Ważność | Mitygacja | Ryzyko rezydualne |
|---|---|---|---|---|---|
| R1 | Siatka nie udźwignie hierarchii + 5000 linii (lag, utrata edycji) | UI siatki | Wysoka | PoC na `packages/ui` przed D5; benchmark 5000 linii; MVP: tylko sekcja → pozycje | Średnie — wydajność edycji „jak Excel” potwierdzi dopiero PoC |
| R2 | PDF z hierarchiczną tabelą łamie layout lub przekracza czas | PDF | Średnia | Generowanie w workerze (ProgressJob); test layoutu z wieloma sekcjami | Niskie |
| R3 | Tryb B przy `R < 0` daje ujemne ceny (v1) | Obliczenia | Średnia | Ostrzeżenie + blokada mark-sent (szczegóły rev 8b, Kod p19) | Niskie |
| R4 | Dryf zaokrągleń | Obliczenia | Niska | Residual na ostatniej linii; jedna funkcja `calculate()` klient = serwer | Niskie (≤ 0,01 PLN) |
| R5 | Wyścig: dwie aktywne wersje albo dwie oferty `primary` | Dane | Wysoka | Partial unique indexy + obsługa konfliktu 409 (bez SERIALIZABLE) | Niskie — użytkownik ponawia akcję |
| R6 | Konflikt optimistic lock deala przy apply-to-deal | Integracja `customers` | Średnia | Komenda `customers.deals.update` z `updatedAt`; 409 → odśwież i ponów | Niskie |
| R7 | Brak integracji z fakturami w v1 | Koszty rzeczywiste | Niska | Ręczne wpisy w v1; import w v2 | Niskie (świadoma decyzja zakresu) |
| R8 | Snapshot `jsonb` rośnie (5000 linii × N wersji) | Baza | Niska | Snapshot tylko przy mark-sent | Niskie |
| R9 | pg_trgm daje fałszywe dopasowania | Inwestycje (v1) | Niska | Próg konfigurowalny; zawsze potwierdza użytkownik | Niskie |
| R11 | Wyciek marży/kosztu kanałem pominiętym w §4.3 (np. nowy widget) | Bezpieczeństwo danych | Wysoka | Jedna funkcja redakcji; test integracyjny per kanał dla roli `employee` | Średnie — każdy nowy kanał wymaga testu |
| R12 | `ModuleConfigService` nie rozróżnia organizacji (zweryfikowane w kodzie) | Konfiguracja | Średnia | Nazwa klucza z `organizationId` + merge w `projectCostingSettings`; testy izolacji organizacji | Niskie — gdyby core dodał natywny scope organizacji, trzeba przenieść klucze |
| R13 | n8n dalej wysyła `cf_offer_role` (D39), więc są dwa źródła prawdy | Dane / integracja | Średnia | Moduł nie czyta `cf_offer_role` po imporcie; decyzja Q2 | Średnie do czasu decyzji Q2 |
| R14 | Import `klin:project` tworzy duplikaty inwestycji | Migracja | Średnia | `--dry-run`, dopasowanie po identyfikatorach, raport konfliktów | Niskie |
| R15 | Wycena niedoszacowana (konwencje OM, bety zależności) | Plan | Średnia | Jawny narzut OM + bufor 10%; przegląd po MVP | Średnie |

(R10 z rev 7 — sekwencja dwóch komend `cf_offer_role` — usunięte: rola oferty zmieniana jedną komendą w jednej transakcji, §3.12.)

---

## 16. Pytania otwarte do Marka (rev 8a)

Zamknięte w rev 8a: **pkt 14 (formuły)** — MVP bez formuł; v1 `quantity_expr` z bezpiecznym parserem arytmetyki, bez `eval` (D30; §14 v1 D13). **Pkt 20 (SVAR PRO)** — Gantt własny, bez SVAR PRO (D21; schedule §3.2).

| # | Pytanie | Opcje | Propozycja |
|---|---|---|---|
| Q1 | Apply-to-deal: czy kalkulacja ma zapisywać wartość deala? | (a) jawna akcja użytkownika → komenda `customers.deals.update` (§8.7); (b) bez zapisu — wartość kalkulacji tylko wyświetlana na dealu przez enricher | (a) — zgodne z dotychczasowym apply-to-deal, bez cichych zapisów |
| Q2 | Co z `cf_offer_role` wysyłanym przez n8n (D39) po przejściu na `pc_deal_offer_roles`? | (a) n8n przestaje wysyłać pole; rolę nadaje costing (pierwsza oferta = primary); (b) pole zostaje jako informacyjne, moduł je ignoruje | (a) — jedno źródło prawdy; wymaga zmiany kontraktu n8n (Enka) |
| Q3 | Czy wykonać jednorazowy import `klin:project` → `pc_investments` i potem wyłączyć `klin:project`? | tak / nie (inwestycje zakładane ręcznie) | tak, po `--dry-run` i akceptacji raportu |
| Q4 | Wyłączenie harmonogramu w organizacji, która ma już harmonogramy | (a) dane zostają, niewidoczne do ponownego włączenia; (b) archiwizacja | (a) |
| Q5 | Domyślne uprawnienia roli `employee` | (a) bez kosztów i marży (ceny, edycja ilości, import, mark-sent); (b) z kosztami bez marży — niemożliwe przy widocznych cenach (§4.2) | (a); osoby liczące koszty dostają rolę `admin` lub własną |

---

## 17. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Siatka: react-data-grid v7 (MIT, ~50 KB) | Najlżejsza z Excel-like UX |
| A2 | Tryby A/B/C + dziedziczenie markup_pct: jednolita redistrybuowanie §3.6; margin_rate z rzeczywistych sum | Spójność; markup per item/sekcja nie zastępuje trybów B/C ale współdziała |
| A3 | **Rev 8a (poprawione):** `project_costing` = moduł bazowy; `project_schedule` (opcjonalny) zależy od costing i rejestruje provider `ScheduleSource` w DI; costing nigdy nie importuje schedule; zero HTTP | Jednokierunkowa zależność zgodna z `packages/core/AGENTS.md` § Cross-Module Coupling (Kod P0-1) |
| A4 | deal_id nullable ✅ (Marek potwierdził); ownership standalone = created_by (rev 8a: project_id usunięte) | Odpowiedź Marka na pytanie C |
| A18 | investment_key = lower(trim(name)) \|\| '\|' \|\| lower(trim(location)); pg_trgm threshold = 0.5 | Prosty normalizowany klucz; próg konfigurowalny |
| A19 | Rola oferty: zmiana tylko decyzją użytkownika w UI; jedna komenda `offer_roles.set_primary` w jednej transakcji (rev 8a) | Odpowiedź Marka — no silent automation; Kod P0-2 |
| A20 | attach-deal sprawdza duplikaty inwestycji i pokazuje notice; nie blokuje | Informowanie bez blokady |
| A5 | Waluta = waluta deala (jednowalutowe v1) | Eliminuje konwersje |
| A6 | Import: 5000 pozycji / 10 MB | §6.4 |
| A7 | Auto-save: debounce 800 ms | Minimalizuje requesty |
| A8 | exceljs v4.4.0 (MIT) | xlsx npm nieaktualizowane |
| A9 | @react-pdf/renderer v3 (MIT) | Brak Chromium |
| A10 | Odblokowanie: admin only; nowa rewizja + audit log | Immutability |
| A11 | apply-to-deal: command bus (zweryfikowano w kodzie) | Historia deala |
| A12 | ~~`cf_offer_role` przez `customers.deals.update`~~ — **usunięte w rev 8a**; zastąpione `pc_deal_offer_roles` (§2.2, §3.12) | Kod P0-2: hardkodowany UUID, EAV na obcej encji, brak transakcji |
| A13 | Dane firmy PDF: Organization.name + logoUrl z directory; reszta z ustawień `pdf.*` (ModuleConfigService) | Organization nie ma adresu/NIP |
| A14 | Marża ukryta domyślnie: `view_margin` tylko dla `admin` w `defaultRoleFeatures` (rev 8a: bez flagi w ustawieniach) | Wymóg Marka (rev 5); decyzja (e) |
| A15 | Offer snapshot tworzony przy mark-sent; PDF generowany ze snapshota | Immutability oferowanej ceny |
| A16 | CostEntry w project_costing (nie osobnym module) | Spójność danych budżet vs realizacja w jednym module |
| A17 | pc_price_list_rules: priority = im wyższy, tym bardziej szczegółowy | Intuicyjne; item>category>segment>global |
| A21 | Version compare: matching linii po `label` + `sort_order` + `cost_category_id` (brak stabilnego line-id między wersjami) | Kalkulacje mogą mieć różne line IDs nawet przy duplikacji |
| A22 | Budget vs actual: `calculation_id` NOT NULL na `pc_cost_entries`; `deal_id`/`investment_id` opcjonalne (rev 8a) | Spójność z konkretną wersją oferty |
| A23 | NIP klienta: odczyt `company.cf_nip` przez query engine / serwis DI (rev 8a: bez HTTP); brak przechowywania w pc_calculations | Unika duplikacji danych; zero HTTP między modułami |
| A24 | `pc_element_types` własność `project_costing`; `project_schedule` referencjonuje przez `element_type_code` (string); brak FK z `project_schedule` do `pc_element_types` | Zapewnia opcjonalność `project_schedule`; costing zawsze dostępny |
| A25 | `project_schedule` jest OPCJONALNY per firma (organizację): `schedule.enabled` per organizacja (ModuleConfigService) + ACL; feature toggle = globalny kill-switch per tenant; `ScheduleSource` w project_costing zapewnia działanie bez niego | Decyzja Marka rev 7; decyzja (d) rev 8a |
| A26 | Inwestycja = jedna encja `pc_investments` w `project_costing`; `klin:project` wygaszany jednorazowym importem (rev 8a) | Decyzja (c); Kod p11 |
| A27 | Investment matching — Priorytet 1: zewnętrzne identyfikatory (dokładne), Priorytet 2: pg_trgm fallback (threshold 0.5, konfigurowalny); user zawsze potwierdza fuzzy-match | Decyzja Marka rev 7 |
| A28 | Marża po zamknięciu deala: feature `project_costing.view_margin_after_close` (rev 8a, zamiast ustawienia); per firma = przypisanie do ról | Decyzja Marka rev 7 + decyzja (e) |
| A29 | ~~Widget `klin:project`~~ — usunięte w rev 8a; zamiast niego strona inwestycji i zakładka deala (§10.4) | Decyzja (c) |

---

## 18. Migracje i backward compatibility

Nowe tabele `pc_*` only. Zero zmian w `packages/core`. Wszystkie encje domenowe z `deleted_at`. Ustawienia w `module_configs` (bez własnej tabeli). Kolejność MVP: pc_cost_categories → pc_element_types → pc_price_sources (seed) → pc_price_catalog → pc_calculations → pc_calculation_lines → pc_offer_snapshots → pc_calculation_pdf_attachments → pc_import_column_mappings → pc_production_batches. v1: pc_segments → pc_price_list_rules → pc_calculation_templates + pc_calculation_template_lines → pc_investments → pc_investment_identifiers → pc_deal_offer_roles → pc_cost_entries. (Rev 8a: usunięte `pc_settings` i `pc_calculation_audit_log`.) Jednorazowe importy `cf_offer_role` i `klin:project` to komendy CLI, nie migracje.

---

## 19. Szkielet plików

```
apps/mercato/src/modules/project_costing/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts, search.ts, extension-points.ts
├── commands/                     # rev 8a: wszystkie zapisy (undo, audit_logs)
├── workers/                      # import XLSX, PDF (ProgressJob)
├── cli.ts                        # import-offer-roles, import-klin-projects (jednorazowe)
├── api/
│   ├── settings/ (ModuleConfigService), segments/, cost-categories/, element-types/
│   ├── price-sources/, price-catalog/, price-list-rules/
│   ├── calculation-templates/, calculation-template-lines/
│   ├── calculations/[id]/{duplicate,recalc,activate,mark-sent,mark-accepted,mark-rejected,
│   │                       unlock,apply-to-deal,generate-pdf,export,import,
│   │                       pdf-attachments,snapshot,production-batches,import-schedule,
│   │                       attach-deal,attach-investment,
│   │                       investment-match-candidates,
│   │                       production-forecast}/
│   ├── calculation-lines/ + batch/
│   ├── cost-entries/ + import/ | deals/:dealId/budget-vs-actual/
│   ├── investments/[id]/{identifiers,merge,match-candidates,offer-roles}/
│   └── import-column-mappings/
├── backend/project-costing/
│   ├── settings/, segments/, templates/, price-sources/, price-catalog/
│   ├── price-list-rules/, calculations/, deals/[dealId]/actual-costs/
│   ├── investments/
├── components/
│   ├── CalculationGrid.tsx       # hierarchia sekcji/pozycji
│   ├── CalculationSummary.tsx
│   ├── PriceModeSelector.tsx
│   ├── ImportWizard.tsx, VersionSelector.tsx, PdfTemplateEditor.tsx
│   ├── BudgetVsActualTable.tsx
│   ├── EmbeddedBatchesTable.tsx  # pc_production_batches UI
│   └── InvestmentMatchDialog.tsx # confirm fuzzy-match
├── data/entities.ts + validators.ts + extensions.ts (pc_deal_offer_roles → customers:customer_deal) + enrichers.ts
├── i18n/pl.json + en.json
├── migrations/
├── subscribers/dealUpdated.ts + dealClosed.ts (won/lost) + dealDeleted.ts   # rev 8a: brak subscriberów na eventy project_schedule
├── widgets/
│   ├── DealCalculationTab.tsx
│   └── DealOfferRoleWidget.tsx           # rola oferty na dealu (v1)
└── lib/
    ├── calculation.service.ts    # recalc, redistribute B/C, snapshot, lifecycle
    ├── pdf.service.ts            # @react-pdf/renderer + snapshot data
    ├── import.service.ts
    ├── visibility.ts
    ├── forecast.ts               # forecast_value = price × probability
    ├── investment.service.ts     # match candidates, merge/split
    ├── offer-roles.service.ts    # set-primary w jednej transakcji (v1)
    ├── settings.ts               # projectCostingSettings: merge org → tenant → defaults
    └── schedule-source/
        ├── schedule-source.interface.ts
        ├── schedule-source.registry.ts
        ├── embedded-schedule.source.ts     # pc_production_batches
        ├── xlsx-import.source.ts
        └── price-source/provider.interface.ts + registry.ts + providers/
```

---

## 20. Final Compliance Report (rev 8a, vs `AGENTS.md`)

| Reguła | Źródło | Status |
|---|---|---|
| Sekcje TLDR, Architecture, Data Models, API Contracts, Risks (z ryzykiem rezydualnym), Final Compliance Report, Changelog | `.ai/specs/AGENTS.md` § Spec Content Checklist | ✅ TLDR, §0, §2, §8, §15, §20, Changelog (Overview/Problem/Proposed Solution = §1) |
| Brak relacji ORM między modułami; FK-id | `packages/core/AGENTS.md` § Never | ✅ |
| Kierunek zależności: baza nie importuje opcjonalnego konsumenta | `packages/core/AGENTS.md` § Cross-Module Coupling | ✅ §0.1, §7a |
| Zapisy przez komendy; `makeCrudRoute` + indexer; `openApi` na trasach; mutation guard | `packages/core/AGENTS.md` § Always | ✅ deklaratywnie §0.3, §8; szczegóły write path w rev 8b |
| Feature'y `acl.ts` w `setup.ts` `defaultRoleFeatures`; sprawdzanie wildcard-aware | `packages/core/AGENTS.md` § Always/Never, § ACL Grant Sync | ✅ §9 |
| `deleted_at` na encjach | `packages/core/AGENTS.md` § Database Entities | ✅ §2.1 |
| `updated_at` + optimistic locking na encjach edytowalnych | `packages/core/AGENTS.md` § Database Entities | ✅ |
| Ustawienia przez ModuleConfigService | `packages/core/AGENTS.md` § Module Config | ✅ §2.2 (klucz per organizacja; ograniczenie serwisu opisane) |
| ProgressJob + worker dla importu i PDF | `packages/core/AGENTS.md` § Operation Progress | ✅ §5.2, §6.2 |
| Testy integracyjne każdej trasy w tej samej zmianie | root `AGENTS.md` l.166 | ✅ w wycenie (§14 O4); plan testów w PR #11 |
| Nowe zależności produkcyjne = ask first | root `AGENTS.md` l.26 | ⚠️ rev 8b (Kod p10): lista do akceptacji Marka |
| Domyślne custom fieldy w `ce.ts`; brak hardkodowanych UUID | `packages/core/src/modules/customers/AGENTS.md` l.103 | ✅ `cf_offer_role` usunięte |

## 21. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-20)

| # | Punkt listy (Kod pN) | Wynik rev 8a |
|---|---|---|
| 1 | Komunikacja przez DI/eventy/widget/FK-id; zero HTTP (p1) | ✅ §0, §7a, §10 (odczyty `customers` też bez HTTP) |
| 2 | Zależność jednokierunkowa; provider w rejestrze DI bazy (p1) | ✅ §0.2, §7a.2 |
| 3 | Brak zapisów do cudzych tabel/pól; encja-rozszerzenie + `data/extensions.ts` (p2) | ✅ §2.2 `pc_deal_offer_roles`, §3.12; jawny wyjątek: apply-to-deal przez komendę `customers` (§8.7, Q1) |
| 4 | Zero hardkodowanych UUID (p2) | ✅ UUID `cf_offer_role` usunięty |
| 5 | Partial unique na `primary`, zmiana w jednej transakcji (p2) | ✅ §2.2, §3.12 |
| 6 | Jedno pojęcie na byt (inwestycja); zakładka przez `detail:customers.deal:tabs` (p11) | ✅ §10.4 |
| 7 | RBAC tylko w `acl.ts`; role admin/employee (p4) | ✅ §9 |
| 8 | Ustawienia nie dublują RBAC (p4) | ✅ §2.2 (usunięte klucze `visibility.*`) |
| 9 | Ukryta marża = ukryty koszt (p3) | ✅ §4.2 |
| 10 | Pola ukryte wykluczone z index/search/audit/eventów/compare (p3) | ✅ §4.3 |
| 11 | Zapisy przez komendy: mark-sent, unlock, recalc, apply-to-deal (p6) | ✅ §0.3 (szczegóły rev 8b) |
| 12 | Audyt przez `audit_logs`, bez własnych tabel (p6) | ✅ `pc_calculation_audit_log` usunięte |
| 13 | `makeCrudRoute` + indexer, `openApi`, mutation guards (p6) | ✅ §0.3, §8 |
| 14 | Zapis minimalny, lock na nagłówku, `calculate()` klient = serwer, benchmark (p8) | ⚠️ w wycenie (MVP D4); specyfikacja szczegółowa rev 8b |
| 15 | `deleted_at` (p20) | ✅ §2.1 |
| 16 | Ustawienia przez ModuleConfigService (**p7**) | ✅ §2.2 — **spełniony**: ustawienia w `module_configs`; źródło: `packages/core/src/modules/configs/lib/module-config-service.ts` |
| 17 | Włączanie: build + `feature_toggles` per tenant + blokady menu/widget/API (**p7**) | ✅ §0.5, schedule §1.0 — **spełniony**: włącznik per organizacja `schedule.enabled` w ModuleConfigService + feature'y ACL; `feature_toggles` (per tenant — `packages/core/src/modules/feature_toggles/lib/feature-flag-check.ts`) tylko jako globalny kill-switch; blokady w menu, w zakładce `detail:customers.deal:tabs` i w API (route guard) |
| 18 | Zakres „firmy” zdefiniowany i dobrany mechanizm (**p7**) | ✅ **spełniony**: firma = organizacja (D15); ModuleConfigService per organizacja, feature toggle per tenant tylko kill-switch (schedule §1.0) |
| 19 | Statusy deala zgodne z OM, eventy won/lost, snapshot (p5) | ⚠️ częściowo: `deal_snapshot` + subscribery; mapowanie statusów rev 8b |
| 20 | Import i PDF przez ProgressJob + worker (p9) | ✅ §5.2, §6.2 |
| 21 | Edge case'y importu (p9) | ⚠️ rev 8b |
| 22 | Nowe zależności = ask first (p10) | ⚠️ rev 8b |
| 23 | Najpierw to, co jest w repo: `pdf-lib`, `packages/ui` (p10) | ⚠️ siatka na `packages/ui` (§14 D5); PDF w rev 8b |
| 24 | Numeracja przez sekwencje PG per organizacja (p18) | ⚠️ w wycenie (MVP D3); opis w §2.2 w rev 8b |
| 25 | Walidacje brzegowe: CHECK, qty 0, ujemne ceny (p19) | ⚠️ rev 8b |
| 26 | Hierarchia MVP: sekcja → pozycje, bez `subtotal` (p13) | ⚠️ MVP = sekcja → pozycje (§14); usunięcie `subtotal` z modelu w rev 8b |
| 27 | Algorytmy harmonogramu (p12) | ⚠️ schedule — rev 8b |
| 28 | Wycena z narzutem OM (p16) | ✅ §14 (osobne pozycje O1–O5) |
| 29 | Testy: Jest `__tests__`, Playwright `__integration__` (p17) | ✅ §14 O4/O5 (plan testów PR #11) |
| 30 | MVP pocięty po wartości (p15) | ✅ §14, TLDR |
| 31 | Forma speki: TLDR, Architecture, Risks, FCR (p20) | ✅ |

Punkty ⚠️ są przypisane do rev 8b; ich ryzyko opisują §15 (R1, R3, R15).

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-20 | **rev 8a** — Review Kod (PR #10 rev 7) + decyzje Koordynatora/Marka. **P0-1:** costing = moduł bazowy z `ScheduleSource` + `scheduleSourceRegistry` w DI; `project_schedule` rejestruje provider; usunięte HTTP (`InternalScheduleSource` przez HTTP, `GET element-types` dla schedule → `elementTypeService` w DI, odczyty `customers` → query engine/DI) i subscriber costingu na eventy schedule; A3 poprawione; nowa §0 Architecture. **P0-2:** `cf_offer_role` + UUID `73f8260a…` + dwie komendy usunięte → encja `pc_deal_offer_roles` (`data/extensions.ts`, partial unique na `primary`, `set_primary` w jednej transakcji); komunikat „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”; R10 usunięte; import 546 wartości jako opcjonalna komenda CLI; apply-to-deal = jawna komenda `customers` (Q1). **P0-3:** ukryta marża = ukryty koszt; tabela kanałów (API, query_index `buildUpsertPayload`, search, audit_logs, eventy tylko z ID, eksport, PDF, compare, analityka, snapshot, notyfikacje). **Firma = organizacja:** `pc_settings` → ModuleConfigService (zweryfikowano: brak natywnego scope organizacji → klucz `org:{id}:settings`); harmonogram per organizacja przez ModuleConfigService + ACL + blokady menu/API, `feature_toggles` tylko jako kill-switch per tenant (schedule §1.0). **Decyzja (e):** widoczność tylko przez `acl.ts`; role admin/employee; `view_margin_after_close`. **Decyzja (c):** inwestycja = `pc_investments`; `project_id`, `attach-project` i widget `klin:project` usunięte; migracja `klin:project` jako CLI. **P1-15 + (a):** nowe MVP (siatka, import XLSX, A/C, prosty cennik, mark-sent + PDF, apply-to-deal, RBAC, partie + prognoza); eksport XLSX → v1. **P1-16:** wycena od zera z narzutem OM i buforem: costing 40/45/16 = 101 d; oba moduły 151 d. Pkt 14 i 20 zamknięte (D30, D21). Dodane: TLDR, Risks z ryzykiem rezydualnym, Final Compliance Report, Checklist compliance, `deleted_at`. `pc_calculation_audit_log` → `audit_logs`. Weryfikacja review w kodzie — zgodne: feature_toggles per tenant (`feature-flag-check.ts`: klucz cache i override po `tenantId`), role admin/employee (`customers/setup.ts`), `useDealInjectedTabs.tsx` l.28, snapshoty w `audit_logs/data/entities.ts`, `pdf-lib` w `packages/core/package.json` l.256, `salesDocumentNumberGenerator.ts`. **Niezgodne/uzupełnione:** ModuleConfigService przyjmuje `organizationId`, ale nie używa go przy odczycie (opisane w §2.2); `data/extensions.ts` jest dziś deklaracją bez runtime joinu (dlatego enricher). Numery linii w AGENTS.md podane wg gałęzi spec. Poza zakresem (rev 8b): Kod p4–6 (szczegóły), 8–13, 16 (szczegóły), 18–19, A7/A13, partie pc_/ps_, investment_key, numeracja założeń, half-up. |
| 2026-10-19 | v1–v4: patrz poprzednie rewizje |
| 2026-10-19 | v5 — Oferta = frozen snapshot (pc_offer_snapshots); typy linii (section/item/note/subtotal) + hierarchia (parent_line_id) + markup_pct z dziedziczeniem; cykl życia wersji: draft/sent/superseded/accepted/rejected + numeracja base_code-R{revision}; layered price list (pc_price_list_rules); koszty rzeczywiste CostEntry (pc_cost_entries); marża ukryta domyślnie; deal_id nullable; effort: MVP 17d, v1 17d, v2 14d = 48d |
| 2026-10-19 | v5 patch (a) — @svar-ui/react-gantt MIT/PRO split zweryfikowany z tarball (patrz project_schedule §3); bez wpływu na model danych project_costing |
| 2026-10-19 | v6 — mode C per-item (line_full_cost×(1+effective_markup)), redistyb. §3.6 tylko dla B; cf_offer_role: read+write (nie read-only), safe two-step z compensating action; budget formula: line_full_cost per kat., direct+overhead kolumny, calculation_id required; investment detection: NIP matching + deal search bez kalkulacji; compare API + UI side-by-side; §8.1-8.2 expand; §10.4 expand; §12.3/12.4 compare UI; effort v1 22→23d, total 53→54d; combined 83→84d; R10 fix; A2/A12 fix; A21-A23 |
| 2026-10-19 | **v7** — Decyzje Marka: (1) widget `klin:project` YES (§10.4); (2) widoczność marży po zamknięciu deala: per-company `margin_visible_after_deal_close` (§2.2 pc_settings, §4.3); (3) investment matching primarynie przez zewnętrzne identyfikatory — nowe tabele `pc_investments` + `pc_investment_identifiers`, stabilny kod INV-YYYY-NNNNNN, merge/split+audit, pg_trgm tylko fallback (§3.12); (4) wszystkie pytania z §16 usunięte (odpowiedziane). ScheduleSource abstraction (§7a): `project_schedule` opcjonalny — implementacje `internal`/`calculation_embedded`/`xlsx_import`/`external_adapter`; nowe tabele `pc_production_batches` i `pc_element_types` (przejęte od schedule). pc_element_types własność costing (A24). pc_cost_entries: `calculation_id` NOT NULL, `deal_id` nullable, `project_id` added (§2.2). A12: usunięto "read-only". Wysiłek: MVP 17d (bez zmian, absorbcja pc_element_types), v1 23→28.5d (+ScheduleSource+batches+investment), total costing 54→59.5d; combined (z schedule) 85→94.5d |
| 2026-10-19 | v5 patch (b) — Odpowiedzi Marka: kalkulacja może istnieć bez deala (deal_id+project_id nullable, project_id/investment_name/investment_location/investment_key na pc_calculations, ownership standalone=created_by, attach/detach-deal/project endpoints); detekcja duplikatów inwestycji (pg_trgm, duplicate-investment-candidates, UI notice bez automatyzacji, set-primary-offer via command bus, audit log); effort v1 17→22d; total 48→53d; combined 78→83d; Pytania otwarte Q1/Q2 usunięte (odpowiedziane) |
