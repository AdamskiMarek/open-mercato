# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v5 — snapshots, typy linii, layered pricelists, actual costs, lifecycle) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications`, `directory` |
| **Moduł powiązany** | `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`) — konsumowany |
| **Wyłączone upstream** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## Streszczenie

Moduł `project_costing` dostarcza kalkulator kosztów ofertowych przypiętych do Deali. Kluczowe cechy rev 5:
- **Oferta = zamrożony snapshot** wersji kalkulacji wysłanej klientowi (renderowane linie + sumy + proweniencja cen w momencie wysyłki).
- **Typy linii**: `section` / `item` / `note` / `subtotal` z hierarchią (section → items) i dziedziczonym narzutem.
- **Cykl życia wersji**: `draft` → `sent` → `accepted`/`rejected`/`superseded`; numeracja `K/2026/001-R1`.
- **Layered price list**: wielopoziomowe reguły cennikowe (zakres: global/segment/kategoria/pozycja, baza: koszt/inna lista/fixed).
- **Koszty rzeczywiste** (`CostEntry`): wpisy kosztu do budżetu vs realizacja per kategoria.
- **Widoczność marży**: domyślnie UKRYTA; włączana per firma/rola przez ustawienia.

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
- `element_type_id` → FK-id → `ps_element_types.id` (własność `project_schedule`).
- Segmenty referencjonowane przez `segment_code` (string, nie FK ORM).

### 2.2 Tabele

#### `pc_settings` — ustawienia modułu per tenant

| Kolumna | Typ | Seed |
|---------|-----|------|
| `key` = `visibility.costs_visible_features` | `jsonb` | `["project_costing.view_costs"]` |
| `key` = `visibility.margin_visible_features` | `jsonb` | `["project_costing.view_margin"]` |
| `key` = `visibility.prices_visible_features` | `jsonb` | `["project_costing.view_prices"]` |
| `key` = `visibility.margin_visible_by_default` | `jsonb` | `false` — **marża UKRYTA domyślnie** |
| `key` = `visibility.calculation_scope` | `jsonb` | `"all"` |
| `key` = `default_currency` | `jsonb` | `"PLN"` |
| `key` = `default_overhead_rate` | `jsonb` | `0.10` |
| `key` = `pdf.validity_days` | `jsonb` | `30` |
| `key` = `pdf.footer_text` | `jsonb` | `""` |
| `key` = `pdf.contact_email`, `pdf.contact_phone` | `jsonb` | |
| `key` = `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account` | `jsonb` | (brak w `Organization` entity) |

Pełna definicja tabeli (id, organization_id, tenant_id, key, value jsonb, created_at, updated_at) — `UNIQUE (organization_id, tenant_id, key)`.

#### `pc_cost_categories` — kategorie kosztów

Kolumny: id, organization_id, tenant_id, code, label, segment_code (opaque string), sort_order, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`.

Seed: `production`, `transport`, `assembly`.

#### `pc_segments` — segmenty branżowe

Kolumny: id, organization_id, tenant_id, code, label, description, is_active, created_at, updated_at. `UNIQUE (organization_id, tenant_id, code)`. Seed: `precast_concrete`.

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
| `project_id` | `uuid` NULL | FK-id → `klin:project` custom entity id; NULL = niepowiązana z projektem; dołączana później |
| `investment_name` | `text` NULL | nazwa inwestycji (wolny tekst, do fuzzy-match) |
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
| `total_quantity_m3` | `numeric(14,3)` NULL | z project_schedule |
| `total_quantity_pcs` | `numeric(14,0)` NULL | z project_schedule |
| `production_start_at` | `date` NULL | z project_schedule |
| `production_end_at` | `date` NULL | z project_schedule |
| `notes` | `text` NULL | |
| `sent_at` | `timestamptz` NULL | |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` |
| `created_by` | `uuid` NULL | |
| `unlocked_by` | `uuid` NULL | |
| `unlocked_at` | `timestamptz` NULL | |
| `unlock_reason` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, base_code, revision)`.

Partial unique index:
```sql
CREATE UNIQUE INDEX pc_calculations_active_unique
  ON pc_calculations (deal_id, organization_id, tenant_id)
  WHERE is_active_version = true AND deal_id IS NOT NULL;
```

Constraints: `CHECK (status IN ('draft','sent','superseded','accepted','rejected'))`, `CHECK (price_mode IN ('line_prices','target_margin','markup'))`.

**Numeracja**: serwis przypisuje `base_code = K/{YYYY}/{NNN}` (auto-increment per tenant). `revision` startuje od 1 i rośnie przy każdym odlokowaniu/duplikacji. Display code: `base_code-R{revision}` gdy `revision > 1`, sam `base_code` gdy `revision = 1`.

**Kalkulacja standalone** (bez deala): `deal_id = NULL`, `project_id = NULL`. Może być tworzona i edytowana niezależnie. `apply-to-deal` i `forecast_value` działają wyłącznie gdy `deal_id != NULL`. `project_id` może być dołączony w dowolnym momencie przez endpoint `attach-project`. Deal dołączany przez `attach-deal`. Scope „own" dla standalone: `created_by = current_user_id`.

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
| `element_type_id` | `uuid` NULL | FK-id → `ps_element_types.id` |
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

#### `pc_calculation_audit_log` — log akcji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `action` | `text` NOT NULL | `sent` \| `unlocked` \| `accepted` \| `rejected` \| `superseded` \| `activated` \| `apply_to_deal` |
| `performed_by` | `uuid` NOT NULL | |
| `reason` | `text` NULL | obowiązkowy przy `unlocked` |
| `previous_status` | `text` NULL | |
| `new_status` | `text` NULL | |
| `meta` | `jsonb` NULL | |
| `created_at` | `timestamptz` | |

#### `pc_calculation_pdf_attachments` — PDF per wersja

Kolumny: id, calculation_id, snapshot_id FK → pc_offer_snapshots.id, organization_id, tenant_id, attachment_id FK-id, generated_at, generated_by, is_latest, template_version. Partial unique index `(calculation_id) WHERE is_latest = true`.

#### `pc_cost_entries` — koszty rzeczywiste

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id |
| `calculation_id` | `uuid` NULL | FK-id → pc_calculations (opcjonalne — wiąże z wersją budżetu) |
| `calculation_line_id` | `uuid` NULL | FK-id → pc_calculation_lines (opaque, dla granularności) |
| `schedule_task_id` | `uuid` NULL | FK-id → ps_schedule_tasks (w project_schedule) |
| `entry_date` | `date` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → pc_cost_categories |
| `element_type_id` | `uuid` NULL | FK-id → ps_element_types |
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

Indeksy: `(deal_id, organization_id, tenant_id)`, `(calculation_id)`, `(entry_date)`.

#### `pc_import_column_mappings`, `pc_calculation_template_lines`

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

Input: `markup_rate` na poziomie kalkulacji (dziedziczony per pozycja przez §3.4). Dla pozycji bez własnego `markup_pct`:
```
item.unit_price_derived = item.unit_cost × (1 + overhead_rate) × (1 + effective_markup_pct)
```
`target_subtotal_price = full_cost × (1 + markup_rate)`. Redistrybuowanie wg §3.6.

> **Nazewnictwo (konsekwentne)**:
>
> | Pole | Definicja |
> |------|-----------|
> | `overhead_rate` | % kosztu pośredniego na koszt zakupu (dodaje do kosztu) |
> | `full_cost` | `subtotal_cost + overhead_amount` |
> | `markup_rate` | % cenowy na `full_cost` (tryb C / dziedziczenie) |
> | `target_margin_rate` | % marży od ceny (tryb B) |
> | `margin_rate` | `total_margin / subtotal_price` — zawsze z rzeczywistych sum |
> | `line_margin_pct` | marża % per pozycja (na linii) |

### 3.6 Redistrybuowanie cen pozycji (tryby B i C)

Jednolita reguła:

1. `T = target_subtotal_price` (z §3.5 B lub C).
2. `S_ov = SUM(item.line_price WHERE price_override = true)`.
3. `R = T − S_ov`. Gdy `R < 0`: warning UI (nie blokada); `subtotal_price = rzeczywista suma`.
4. Non-override pozycje N: `base = SUM(item.line_cost × (1 + overhead_rate))`. Proporcja per item: `base > 0` → `item_full_cost / base`; `base = 0` → równy podział.
5. Nowe ceny: `new_item.line_price = ROUND(R × proporcja, 2, HALF_EVEN)`; `new_unit_price = ROUND(new_line_price / quantity, 4, HALF_EVEN)`.
6. Rounding residual: ostatnia pozycja w N absorbuje `R − SUM(new_line_price)`.
7. Sekcje przeliczane z nowych sum dzieci. `subtotal_price = SUM(new_item.line_price + override_item.line_price)`.

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

**Odblokowanie** (admin only): nowa wersja `(base_code, revision + 1)`, `draft`; oryginał → `superseded`. Wpis w `pc_calculation_audit_log`.

**Duplikacja jako nowa wersja**: `POST .../duplicate` kopiuje linie.

### 3.10 Waluta kalkulacji

Waluta = `customer_deals.value_currency` gdy `deal_id != NULL`, else `pc_settings.default_currency`. Jednowalutowe v1.

### 3.11 Prognoza wartości = wartość × prawdopodobieństwo

**Tylko gdy `deal_id != NULL`**:
```
forecast_value = is_active_version.subtotal_price × deal.probability / 100
```

Kalkulacje standalone (bez deala) nie wchodzą do prognozy lejka. Recalculate przy zmianie `is_active_version`, `deal.probability`, po `apply-to-deal`.

Widget dashboardu „Prognoza lejka": `SUM(forecast_value)` per etap pipeline lub `expected_close_at`.

### 3.12 `cf_offer_role`, reguła sumy projektu i detekcja duplikatów inwestycji

**`cf_offer_role`** (id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`): read-only przez API entities. Aktualizacja wyłącznie przez `customers.deals.update` command bus (§8.7), nie bezpośrednio.

**Reguła sumy projektu** (gdy `project_id != NULL`):
```
project_total = SUM(deal.value_amount)
  WHERE cf_offer_role = 'primary'
    AND deal.status NOT IN ('lost', 'archived')
    AND calc.project_id = :project_id
```
Deale `alternative` widoczne w tabeli projektu, nie wliczane.

**Detekcja duplikatów inwestycji**:

Gdy kalkulacja jest dołączana do deala/projektu (lub gdy `investment_name`/`investment_location` jest ustawiane), serwis sprawdza podobne kalkulacje w tej samej organizacji przez `pg_trgm`:

```sql
SELECT c.id, c.base_code, c.deal_id, c.investment_name,
       similarity(c.investment_key, :target_key) AS score
FROM pc_calculations c
WHERE c.organization_id = :org AND c.tenant_id = :tenant AND c.id != :this_id
  AND c.investment_key IS NOT NULL
  AND similarity(c.investment_key, :target_key) > 0.5
ORDER BY score DESC
LIMIT 10;
```

Wynik: `GET /api/project-costing/calculations/:id/duplicate-investment-candidates`.

**UI notice** (brak automatyzacji — user decyduje):
> „Istnieje już oferta dla innego wykonawcy (${dealName}, ${similarity}% podobieństwo nazwy inwestycji). Upewnij się, która powinna być główna."

Przyciski per kandydat: „Ta jest główna" / „Tamta jest główna" / „Ignoruj".

Po wyborze: `POST /api/project-costing/calculations/:id/set-primary-offer` → serwis wywołuje `customers.deals.update` command bus:
- Wybrany deal: `customFields: { cf_offer_role: 'primary' }`.
- Poprzedni primary deal: `customFields: { cf_offer_role: 'alternative' }`.
- Zmiana logowana: `pc_calculation_audit_log` (`action = 'set_primary_offer'`, `meta: { changed_deal_id, previous_role, new_role }`).

`pg_trgm` wymagane: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` w migracji.

### 3.13 Koszty rzeczywiste vs budżet

Budżet = wartości `full_cost` / `subtotal_price` per kategoria z wersji `accepted` (lub najnowszej `sent` gdy brak accepted):

```
budget_cost[cat] = SUM(item.line_cost WHERE cost_category_id = cat AND calc.status = 'accepted')
actual_cost[cat] = SUM(total_amount WHERE cost_category_id = cat AND entry.deal_id = deal.id)
variance[cat]    = actual_cost[cat] − budget_cost[cat]
margin_offer     = subtotal_price − full_cost          (z accepted version)
margin_actual    = subtotal_price − actual_total_cost  (total_amount SUM)
```

---

## 4. Widoczność

### 4.1 Marża — ukryta domyślnie

`pc_settings.visibility.margin_visible_by_default = false`. Manager **nie widzi marży domyślnie** — tenant musi aktywnie włączyć widoczność marży dla roli.

`pc_settings.visibility.margin_visible_features = ["project_costing.view_margin"]` — feature ID uprawniające do marży. Tylko role z tym feature-m (gdy tenant to skonfiguruje) widzą `total_margin`, `margin_rate`, `line_margin`, `line_margin_pct`.

### 4.2 Wymiary widoczności

| Wymiar | Feature | Default (seed) |
|--------|---------|---------------|
| Koszty | `project_costing.view_costs` | manager ✅ |
| Marża | `project_costing.view_margin` | **manager ❌ (wyłączone domyślnie)** |
| Ceny sprzedaży | `project_costing.view_prices` | manager ✅, sales ✅ |
| Edycja narzutu | `project_costing.edit_markup` | manager ✅ |

### 4.3 Wymuszenie server-side

`applyVisibilityRedaction()` null-uje pola `{line_margin, line_margin_pct, total_margin, margin_rate}` gdy brak `view_margin`. Stosowane: API responses, eksport XLSX/CSV, analytics `requiredFeatures`, PDF (strukturalnie zawsze bez marży dla klienta).

### 4.4 Scope kalkulacji (`calculation_scope`)

`"all"` (default) | `"own"`:
- Gdy `deal_id != NULL`: „own" filtruje po właścicielu deala.
- Gdy `deal_id IS NULL` (standalone): „own" filtruje po `created_by = current_user_id`.
- Admin (`project_costing.admin`) zawsze widzi wszystkie.

---

## 5. PDF oferty

### 5.1 Frozen snapshot + PDF

PDF generowany zawsze z `pc_offer_snapshots.snapshot_data` — niezmienny po wysyłce. Dane firmy: `Organization.name` + `Organization.logoUrl` z `directory` + brakujące pola z `pc_settings.pdf.*` (§2.2).

### 5.2 Renderowanie: `@react-pdf/renderer` v3 (MIT)

Brak Chromium. Async generowanie przy >200 pozycjach.

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

### 6.2 Import XLSX/CSV — kreator mapowania

1. Upload (max 10 MB, max 5000 wierszy — patrz §6.4).
2. Podgląd (5 wierszy). Mapowanie: `line_type`, `label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `markup_pct`, `notes`.
3. Sekcje importowane jako `line_type=section` gdy `quantity=null`. Mapowanie z `pc_import_column_mappings`.
4. Walidacja + podgląd po mapowaniu. Zatwierdzenie: `POST .../import`.

### 6.3 Eksport XLSX

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

## 8. API

Prefix: `/api/project-costing/`. Optimistic locking na `PATCH`/`DELETE`.

### 8.1–8.2 Ustawienia, segmenty, kategorie

```
GET/PATCH /api/project-costing/settings
GET/POST/PATCH/DELETE /api/project-costing/segments[/:id]
GET/POST/PATCH/DELETE /api/project-costing/cost-categories[/:id]?segmentCode=
```

> Typy elementów: `GET /api/project-schedule/element-types` (własność `project_schedule`).

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
POST .../attach-deal         (dołącz deal: body { dealId }; sprawdza duplikaty inwestycji)
DELETE .../attach-deal       (odłącz deal; is_active_version → false)
POST .../attach-project      (dołącz project: body { projectId })
DELETE .../attach-project    (odłącz project)
GET  .../duplicate-investment-candidates  (fuzzy-match §3.12)
POST .../set-primary-offer   (ustaw cf_offer_role via command bus §3.12)

GET  .../export?format=xlsx|csv
POST .../import
GET  .../pdf-attachments
GET  .../snapshot
```

`PATCH /api/project-costing/calculations/:id` akceptuje: `price_mode`, `overhead_rate`, `markup_rate`, `target_margin_rate`, `label`, `currency`, `notes`. Zmiana `price_mode` wyzwala recalc.

### 8.6 Linie kalkulacji

```
GET/POST /api/project-costing/calculation-lines?calculationId=
PATCH/DELETE /api/project-costing/calculation-lines/:id
POST /api/project-costing/calculation-lines/batch   (bulk upsert — auto-save)
```

Wersje z `status != 'draft'`: API odrzuca PATCH/DELETE z 409.

### 8.7 `apply-to-deal` (zweryfikowano w kodzie)

```typescript
// Command customers.deals.update — packages/core/src/modules/customers/commands/deals.ts:745
// CommandBus w DI — packages/shared/src/lib/di/container.ts:218
await commandBus.execute({ commandId: 'customers.deals.update',
  input: { id: calculation.dealId, valueAmount: calculation.subtotalPrice }, ctx })
await logAudit(calculationId, 'apply_to_deal', { meta: { valueAmount } }, ctx)
```

### 8.8 Koszty rzeczywiste

```
GET/POST /api/project-costing/cost-entries?dealId=&calculationId=
PATCH/DELETE /api/project-costing/cost-entries/:id
POST /api/project-costing/cost-entries/import   (v1)
GET  /api/project-costing/deals/:dealId/budget-vs-actual   (raport budżet vs realizacja)
```

### 8.9 Mapowania importu

```
GET/POST/PATCH/DELETE /api/project-costing/import-column-mappings[/:id]
```

---

## 9. Uprawnienia (ACL)

| Feature ID | Opis | Domyślne role |
|-----------|------|---------------|
| `project_costing.view` | Podgląd | admin, manager, sales |
| `project_costing.view_costs` | Koszty | admin, manager |
| `project_costing.view_margin` | Marża | admin (**manager: wyłączone!**) |
| `project_costing.view_prices` | Ceny sprzedaży | admin, manager, sales |
| `project_costing.edit` | Edycja linii | admin, manager |
| `project_costing.edit_markup` | Edycja narzutu | admin, manager |
| `project_costing.admin` | Ustawienia, cennik, segmenty, odblokowanie | admin |
| `project_costing.apply_to_deal` | Aktualizacja value_amount | admin, manager |
| `project_costing.import` | Import XLSX/CSV | admin, manager |
| `project_costing.export` | Eksport XLSX/CSV/PDF | admin, manager, sales |
| `project_costing.lock` | Mark-sent, lock | admin, manager |
| `project_costing.view_actual_costs` | Koszty rzeczywiste | admin, manager |
| `project_costing.edit_actual_costs` | Wpisy kosztów rzeczywistych | admin, manager |

**Zmiana od rev 4**: `project_costing.view_margin` usunięty z domyślnych uprawnień `manager`. Tenant musi aktywnie dodać manager do `visibility.margin_visible_features` w `pc_settings`.

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

### 10.2 Integracja z Dealem

- Zakładka `detail:customers.deal:tabs`.
- `apply-to-deal`: §8.7.
- Subscriber `customers.deal.updated` → sync `currency`, przelicz `forecast_value`.

### 10.3 Integracja z `project_schedule`

Subscriber `project_schedule.batch.updated`, `schedule.activated` → HTTP `GET /api/project-schedule/schedules/:id/summary` → update `total_quantity_m3/pcs`, `production_start_at/end_at`.

### 10.4 `klin:project`: §3.12.

---

## 11. Analityka (`analytics.ts`)

Encja `project_costing:calculations` (fieldMappings): id, dealId, status, priceMode, currency, subtotalCost[`view_costs`], overheadAmount[`view_costs`], fullCost[`view_costs`], subtotalPrice[`view_prices`], totalMargin[`view_margin`], marginRate[`view_margin`], totalQuantityM3, totalQuantityPcs, createdAt, isActiveVersion.

Widget TOP/BOTTOM marża: filtr `isActiveVersion=true`, metryka `marginRate`[`view_margin`].
Widget prognoza lejka: `subtotalPrice × deal.probability` per etap (query przez join z customers).

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs`. Widget: `DealCalculationTab.tsx`.

Nagłówek: dropdown wersji (display code `K/2026/001-R2`, status badge), tryb ceny A/B/C, `overhead_rate`, `markup_rate`/`target_margin_rate` per tryb, sumy (koszty/ceny/marża — redagowane wg §4), przycisk „Wyślij ofertę" → `mark-sent`, „Generuj PDF", „Aktywuj", „Zaakceptowano" / „Odrzucono", „Duplikuj jako nową rewizję".

### 12.2 Siatka kosztów — `react-data-grid` v7 (MIT, ~50 KB)

Hierarchia: kolumna `label` z wcięciem per `parent_line_id`. Typy linii: `section` (bold, tło DS), `item` (normalna), `note` (italic, bez liczb), `subtotal` (bold, podsumowanie).

Kolumny: line_type [icon], label, qty, unit, unit_cost [`view_costs`], unit_price [`view_prices`], markup_pct, line_cost [`view_costs`], line_price [`view_prices`], line_margin [`view_margin`], line_margin_pct [`view_margin`], akcje.

### 12.3 Widok budget vs actual

Strona `/project-costing/deals/:dealId/actual-costs`: tabela per kategoria — budżet (z accepted version) vs rzeczywisty (SUM cost_entries), wariancja.

### 12.4 Strony backend

`/settings`, `/segments[/id]`, `/templates[/id]`, `/price-sources`, `/price-catalog[/id]`, `/price-list-rules`, `/calculations[/id]`, `/deals/:dealId/actual-costs`.

---

## 13. Rekomendacja cennikowa

**v1**: własny cennik + import CSV/XLSX. **v2**: Sekocenbud/Intercenbud (pliki XLSX per kwartał, brak API). **v2+**: KNR szablony seed. Patrz §7 dla KNR adapter.

---

## 14. Fazy i szacowanie wysiłku

### `project_costing` — MVP (~17 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (pc_settings, pc_segments, pc_cost_categories, pc_price_sources, pc_price_catalog, pc_price_list_rules, pc_calculations, pc_calculation_lines [line_type+parent+markup], pc_calculation_audit_log, pc_offer_snapshots) | L (4 dni) |
| API CRUD: ustawienia, segmenty, kategorie, price-sources, price-catalog, price-list-rules, calculations, calculation-lines | L (3.5 dnia) |
| Siatka react-data-grid: hierarchia sekcji/pozycji, typy linii, markup inheritance, tryby A/B/C, widoczność | L (3.5 dnia) |
| Widoczność server-side (3 features + `calculation_scope`, marża ukryta domyślnie) | M (1.5 dnia) |
| Backend strony: ustawienia, segmenty, cennik, reguły cennikowe | M (2 dni) |
| ACL + setup.ts | S (0.5 dnia) |
| Analytics.ts + `requiredFeatures` + widget TOP/BOTTOM marża | S (1 dzień) |
| Integracja z `project_schedule` (subscriber + HTTP API calls) | S (0.5 dnia) |
| Cykl życia wersji (numeracja, statusy, snapshot przy mark-sent) | M (0.5 dnia) |

**Suma MVP**: 4+3.5+3.5+1.5+2+0.5+1+0.5+0.5 = **17 dni roboczych**.

### `project_costing` — v1 (~22 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Import XLSX/CSV + kreator mapowania + walidacja (`exceljs`) | L (3 dni) |
| Eksport XLSX/CSV (redakcja widoczności) + cennik import/eksport | M (2 dni) |
| Szablony kalkulacji z hierarchią linii + generowanie z szablonu | M (2 dni) |
| Wersjonowanie: lifecycle statusy, duplicate, activate, mark-accepted/rejected, unlock + audit log | M (2.5 dnia) |
| `apply-to-deal` via command bus | S (1 dzień) |
| PDF oferty ze snapshota (`@react-pdf/renderer`, hierarchiczna tabela) | L (3 dni) |
| Koszty rzeczywiste `CostEntry` (CRUD + simple import + raport budżet vs actual) | M (2 dni) |
| **Kalkulacja standalone**: attach/detach deal+project (endpoints + UI „Przypnij"), `project_id`, `investment_key`, ownership scope | M (1.5 dnia) |
| **Detekcja duplikatów inwestycji**: pg_trgm index, `/duplicate-investment-candidates`, UI notice, `set-primary-offer` via command bus | M (2 dni) |
| i18n PL/EN + testy jednostkowe serwisów | M (2 dni) |

**Suma v1**: 3+2+2+2.5+1+3+2+1.5+2+2 = **22 dni roboczych**.

### `project_costing` — v2 (~14 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Multi-segment + nowe kategorie | S (1 dzień) |
| Adapter importu Sekocenbud/Intercenbud XLSX + KNR mapExternalCode | M (2.5 dnia) |
| CostEntry import z faktur + integracje (ERP, plik) | M (2 dni) |
| `klin:project` widget sumy projektu, cf_offer_role aggregation | M (2 dni) |
| Biblioteka szablonów KNR seed data | M (2 dni) |
| Konwersja walutowa (`currencies` module) | S (1 dzień) |
| Forecast lejka (probability-weighted) w dashboardach | S (0.5 dnia) |
| AI-tool: generowanie linii kalkulacji z opisu | L (3 dni) |

**Suma v2**: 1+2.5+2+2+2+1+0.5+3 = **14 dni roboczych**.

**Total project_costing**: 17+22+14 = **53 dni roboczych**.

---

## 15. Ryzyki

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | react-data-grid: hierarchia sekcji/pozycji + typy linii — złożony rendering | Średnie | Wysoki | PoC hierarchii przed v1 |
| R2 | @react-pdf/renderer: hierarchiczna tabela z sekcjami — złożony layout | Średnie | Średni | Test z wielopoziomową strukturą przed implementacją |
| R3 | Redistrybuowanie B/C z `price_override` przy `R < 0` | Średnie | Niski | Warning UI; §3.6 definiuje zachowanie |
| R4 | Rounding drift redistributowania — residual per ostatnia linia | Niskie | Niski | Max 0.01 PLN |
| R5 | Race condition `activate` / partial unique index | Niskie | Wysoki | Transakcja SERIALIZABLE per `deal_id` |
| R6 | Optimistic lock deala przy `apply-to-deal` | Średnie | Średni | Pobierz `deal.updatedAt` tuż przed dispatch |
| R7 | Koszty rzeczywiste: brak integracji z fakturami v1 | Wysokie | Niski | Import XLSX v1; integracje v2 |
| R8 | Snapshot `jsonb` rośnie (5000 linii × N wersji) | Niskie | Niski | Tylko przy `sent`; compress opcjonalnie |
| R9 | pg_trgm false-positives przy zbyt niskim threshold | Niskie | Niski | Threshold konfigurowalny (default 0.5); user decyduje |
| R10 | `cf_offer_role` update na obu dealach: partial failure | Niskie | Średni | Oba command bus calls w jednej transakcji lub compensating action |

---

## 16. Pytania otwarte do Marka

1. **Spot `klin:project`**: Czy strona `klin:project` ma spot na widget modułu? Fallback: `/project-costing/projects/:projectId`.

2. **Widoczność marży przy accepted offer**: Czy sprzedawca (sales) powinien widzieć marżę wersji `accepted` po zamknięciu deala, mimo że marża jest ukryta domyślnie?

3. **pg_trgm threshold**: Domyślny próg similarity 0.5 dla detekcji duplikatów inwestycji — czy odpowiedni? (Wyższy = mniej false-positives, niższy = więcej podpowiedzi.)

---

## 17. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Siatka: react-data-grid v7 (MIT, ~50 KB) | Najlżejsza z Excel-like UX |
| A2 | Tryby A/B/C + dziedziczenie markup_pct: jednolita redistrybuowanie §3.6; margin_rate z rzeczywistych sum | Spójność; markup per item/sekcja nie zastępuje trybów B/C ale współdziała |
| A3 | project_costing → project_schedule; schedule nie zależy od costing | Brak circular dependency |
| A4 | deal_id nullable ✅ (Marek potwierdził); project_id nullable; ownership standalone = created_by | Odpowiedź Marka na pytanie C |
| A18 | investment_key = lower(trim(name)) \|\| '\|' \|\| lower(trim(location)); pg_trgm threshold = 0.5 | Prosty normalizowany klucz; próg konfigurowalny |
| A19 | cf_offer_role zmiana: brak automatyzmu; user decyduje przez UI; command bus | Odpowiedź Marka — no silent automation |
| A20 | attach-deal sprawdza duplikaty inwestycji i pokazuje notice; nie blokuje | Informowanie bez blokady |
| A5 | Waluta = waluta deala (jednowalutowe v1) | Eliminuje konwersje |
| A6 | Import: 5000 pozycji / 10 MB | §6.4 |
| A7 | Auto-save: debounce 800 ms | Minimalizuje requesty |
| A8 | exceljs v4.4.0 (MIT) | xlsx npm nieaktualizowane |
| A9 | @react-pdf/renderer v3 (MIT) | Brak Chromium |
| A10 | Odblokowanie: admin only; nowa rewizja + audit log | Immutability |
| A11 | apply-to-deal: command bus (zweryfikowano w kodzie) | Historia deala |
| A12 | cf_offer_role: read-only | Pole istnieje na produkcji |
| A13 | Dane firmy PDF: Organization.name + logoUrl z directory; reszta z pc_settings | Organization nie ma adresu/NIP |
| A14 | Marża ukryta domyślnie (margin_visible_by_default = false) | Wymóg Marka (rev 5) |
| A15 | Offer snapshot tworzony przy mark-sent; PDF generowany ze snapshota | Immutability oferowanej ceny |
| A16 | CostEntry w project_costing (nie osobnym module) | Spójność danych budżet vs realizacja w jednym module |
| A17 | pc_price_list_rules: priority = im wyższy, tym bardziej szczegółowy | Intuicyjne; item>category>segment>global |

---

## 18. Migracje i backward compatibility

Nowe tabele `pc_*` only. Zero zmian w `packages/core`. Kolejność: pc_settings → pc_segments → pc_cost_categories → pc_price_sources → pc_price_catalog → pc_price_list_rules → pc_calculation_templates + pc_calculation_template_lines → pc_calculations → pc_calculation_lines → pc_offer_snapshots → pc_calculation_audit_log → pc_calculation_pdf_attachments → pc_cost_entries → pc_import_column_mappings.

---

## 19. Szkielet plików

```
apps/mercato/src/modules/project_costing/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts, extension-points.ts
├── api/
│   ├── settings/, segments/, cost-categories/
│   ├── price-sources/, price-catalog/, price-list-rules/
│   ├── calculation-templates/, calculation-template-lines/
│   ├── calculations/[id]/{duplicate,recalc,activate,mark-sent,mark-accepted,mark-rejected,
│   │                       unlock,apply-to-deal,generate-pdf,export,import,
│   │                       pdf-attachments,snapshot}/
│   ├── calculation-lines/ + batch/
│   ├── cost-entries/ + import/ | deals/:dealId/budget-vs-actual/
│   └── import-column-mappings/
├── backend/project-costing/
│   ├── settings/, segments/, templates/, price-sources/, price-catalog/
│   ├── price-list-rules/, calculations/, deals/[dealId]/actual-costs/
├── components/
│   ├── CalculationGrid.tsx       # hierarchia sekcji/pozycji
│   ├── CalculationSummary.tsx
│   ├── PriceModeSelector.tsx
│   ├── ImportWizard.tsx, VersionSelector.tsx, PdfTemplateEditor.tsx
│   └── BudgetVsActualTable.tsx
├── data/entities.ts + validators.ts
├── i18n/pl.json + en.json
├── migrations/
├── subscribers/scheduleUpdated.ts + dealUpdated.ts
├── widgets/DealCalculationTab.tsx
└── lib/
    ├── calculation.service.ts    # recalc, redistribute B/C, snapshot, lifecycle
    ├── pdf.service.ts            # @react-pdf/renderer + snapshot data
    ├── import.service.ts
    ├── visibility.ts
    ├── forecast.ts               # forecast_value = price × probability
    └── price-source/provider.interface.ts + registry.ts + providers/
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | v1–v4: patrz poprzednie rewizje |
| 2026-10-19 | v5 — Oferta = frozen snapshot (pc_offer_snapshots); typy linii (section/item/note/subtotal) + hierarchia (parent_line_id) + markup_pct z dziedziczeniem; cykl życia wersji: draft/sent/superseded/accepted/rejected + numeracja base_code-R{revision}; layered price list (pc_price_list_rules); koszty rzeczywiste CostEntry (pc_cost_entries); marża ukryta domyślnie; deal_id nullable; effort: MVP 17d, v1 17d, v2 14d = 48d |
| 2026-10-19 | v5 patch (a) — @svar-ui/react-gantt MIT/PRO split zweryfikowany z tarball (patrz project_schedule §3); bez wpływu na model danych project_costing |
| 2026-10-19 | v5 patch (b) — Odpowiedzi Marka: kalkulacja może istnieć bez deala (deal_id+project_id nullable, project_id/investment_name/investment_location/investment_key na pc_calculations, ownership standalone=created_by, attach/detach-deal/project endpoints); detekcja duplikatów inwestycji (pg_trgm, duplicate-investment-candidates, UI notice bez automatyzacji, set-primary-offer via command bus, audit log); effort v1 17→22d; total 48→53d; combined 78→83d; Pytania otwarte Q1/Q2 usunięte (odpowiedziane) |
