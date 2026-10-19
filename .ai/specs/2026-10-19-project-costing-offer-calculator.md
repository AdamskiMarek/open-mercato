# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v4 — element_types → ps_, reguła B/C, typos, referencje) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications`, `directory` |
| **Moduł powiązany** | `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`) — **konsumowany** |
| **Wyłączone upstream (nie aktywować)** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## Streszczenie

Moduł `project_costing` dostarcza kalkulator kosztów ofertowych przypiętych do Deali w Open Mercato CRM. Działa jak uproszczony Excel: siatka linii kosztowych z edycją inline (react-data-grid), import/eksport XLSX/CSV (exceljs), szablony per segment, wersjonowanie kalkulacji, abstrakcja źródeł cennikowych.

Typy elementów prefabrykacji (strop/ściana/słup/…) są własnością modułu `project_schedule` (`ps_element_types`). `project_costing` referencjonuje je przez `element_type_id` (FK-id UUID do `ps_element_types`) i odczytuje listę przez `GET /api/project-schedule/element-types`.

Harmonogram produkcji i prognoza m³/szt. konsumowane z `project_schedule` przez API i zdarzenia — `project_costing` nie posiada własnych tabel harmonogramu ani typów elementów.

Wyniki zasilają `value_amount` deala przez command bus, eksponowane w analityce. PDF oferty server-side (`@react-pdf/renderer`). Zero zmian w `packages/core`.

---

## 1. Kontekst i cel

### 1.1 Problem

Firmy z branży budowlanej (v1: prefabrykacja żelbetowa) liczą wyceny w Excelu, ręcznie wpisując wyniki do CRM. Brak historii wersji, brak kontroli widoczności marż.

### 1.2 Propozycja wartości

- Kalkulacja kosztów na karcie Deala (zakładka „Kalkulacja").
- Import z arkuszy XLSX/CSV z kreatorem mapowania kolumn.
- Trzy tryby wyznaczania ceny (A/B/C) — §3.4.
- Konfigurowalny poziom widoczności kosztów/marż/cen per rola i scope (own/all).
- Szablony per segment, wersjonowanie, blokowanie wysłanych wersji.
- PDF oferty immutable, wersjonowany, bez kosztów/marż dla klienta.
- `apply-to-deal` przez command bus → historia deala.
- Analityka: TOP/BOTTOM marża.
- Harmonogram i prognoza: konsumowane z `project_schedule`.

---

## 2. Model danych

### 2.1 Konwencje globalne

- Wielodostępność: `organization_id` + `tenant_id` na każdej tabeli.
- UUID PK: `gen_random_uuid()`.
- FK-id: wartości UUID bez dekoratora ORM `@ManyToOne`.
- `updated_at` na tabelach edytowalnych (optimistic locking).
- Typy elementów: własnością `project_schedule`; `project_costing` przechowuje `element_type_id` jako UUID FK-id → `ps_element_types.id`.

### 2.2 Tabele

#### `pc_settings` — ustawienia modułu per tenant

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `key` | `text` NOT NULL | |
| `value` | `jsonb` NOT NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, key)`.

Kluczowe ustawienia (seed w `setup.ts`):
- `visibility.costs_visible_features` — feature ID dla kosztów (domyślnie `["project_costing.view_costs"]`).
- `visibility.margin_visible_features` — dla marży.
- `visibility.prices_visible_features` — dla cen sprzedaży.
- `visibility.calculation_scope` — `"all"` (default) | `"own"` (filtr po właścicielu deala).
- `default_currency` — domyślnie `'PLN'`.
- `default_overhead_rate` — domyślnie `0.10`.
- `pdf.validity_days`, `pdf.footer_text`, `pdf.contact_email`, `pdf.contact_phone`.
- `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account` — pola nieobecne w `Organization` entity z `directory` (§5.3).

#### `pc_cost_categories` — słownik kategorii kosztów

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `code` | `text` NOT NULL | unikalny per org+tenant |
| `label` | `text` NOT NULL | |
| `segment_code` | `text` NULL | np. `precast_concrete`; opaque string (nie FK) |
| `sort_order` | `int` DEFAULT 0 | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, code)`.

Seed: `production`, `transport`, `assembly`.

#### `pc_segments` — segmenty branżowe

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `code` | `text` NOT NULL | np. `precast_concrete` |
| `label` | `text` NOT NULL | |
| `description` | `text` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, code)`. Seed: `precast_concrete`.

#### `pc_price_sources` — rejestr źródeł cennikowych

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `provider_id` | `text` NOT NULL | np. `company_catalog` |
| `label` | `text` NOT NULL | |
| `price_list_version` | `text` NULL | |
| `price_list_date` | `date` NULL | |
| `region` | `text` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `meta` | `jsonb` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, provider_id, price_list_version)`.

Seed: `provider_id = 'company_catalog'`.

#### `pc_price_catalog` — cennik firmy

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `price_source_id` | `uuid` NOT NULL | FK → `pc_price_sources.id` |
| `segment_code` | `text` NULL | opaque string |
| `cost_category_id` | `uuid` NULL | FK → `pc_cost_categories.id` |
| `external_code` | `text` NULL | kod zewnętrzny (KNR, Sekocenbud) |
| `code` | `text` NOT NULL | |
| `label` | `text` NOT NULL | |
| `description` | `text` NULL | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | |
| `unit_price` | `numeric(14,4)` NULL | |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `valid_from` | `date` NULL | |
| `valid_to` | `date` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `pc_calculation_templates` — szablony kalkulacji per segment

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_code` | `text` NOT NULL | opaque string |
| `code` | `text` NOT NULL | |
| `label` | `text` NOT NULL | |
| `description` | `text` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `pc_calculation_template_lines` — linie szablonu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `template_id` | `uuid` NOT NULL | FK → `pc_calculation_templates.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK-id → `ps_element_types.id` (w `project_schedule`) |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | |
| `unit_price` | `numeric(14,4)` NULL | |
| `sort_order` | `int` DEFAULT 0 | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |

#### `pc_calculations` — kalkulacja (głowa)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `segment_code` | `text` NULL | opaque string (kod segmentu) |
| `code` | `text` NOT NULL | np. `K/2026/001` |
| `label` | `text` NOT NULL | |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `sent` \| `locked` \| `archived` |
| `version` | `int` NOT NULL DEFAULT 1 | |
| `is_active_version` | `bool` NOT NULL DEFAULT false | |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | = waluta deala (§3.7) |
| `price_mode` | `text` NOT NULL DEFAULT `'line_prices'` | `line_prices` \| `target_margin` \| `markup` |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | koszty pośrednie jako % kosztu zakupu |
| `target_margin_rate` | `numeric(6,4)` NULL | tryb B: docelowa marża % od ceny |
| `markup_rate` | `numeric(6,4)` NULL | tryb C: narzut cenowy na full_cost |
| `subtotal_cost` | `numeric(14,2)` NULL | SUM(line_cost) |
| `overhead_amount` | `numeric(14,2)` NULL | subtotal_cost × overhead_rate |
| `full_cost` | `numeric(14,2)` NULL | subtotal_cost + overhead_amount |
| `subtotal_price` | `numeric(14,2)` NULL | cena oferty (input lub derived wg price_mode) |
| `total_margin` | `numeric(14,2)` NULL | subtotal_price − full_cost |
| `margin_rate` | `numeric(6,4)` NULL | total_margin / subtotal_price |
| `suggested_price` | `numeric(14,2)` NULL | informacyjna (tryb alternatywny) |
| `total_quantity_m3` | `numeric(14,3)` NULL | z `project_schedule` (denorm) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | z `project_schedule` (denorm) |
| `production_start_at` | `date` NULL | z `project_schedule` (derived min) |
| `production_end_at` | `date` NULL | z `project_schedule` (derived max) |
| `notes` | `text` NULL | |
| `sent_at` | `timestamptz` NULL | |
| `locked_at` | `timestamptz` NULL | |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` |
| `created_by` | `uuid` NULL | FK-id → users |
| `unlocked_by` | `uuid` NULL | |
| `unlocked_at` | `timestamptz` NULL | |
| `unlock_reason` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | optimistic locking |

`UNIQUE (organization_id, tenant_id, code)`.

Partial unique index:
```sql
CREATE UNIQUE INDEX pc_calculations_active_unique
  ON pc_calculations (deal_id, organization_id, tenant_id)
  WHERE is_active_version = true;
```

Constraints: `CHECK (status IN ('draft','active','sent','locked','archived'))`, `CHECK (price_mode IN ('line_prices','target_margin','markup'))`.

#### `pc_calculation_lines` — linie kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK-id → `ps_element_types.id` (w `project_schedule`) |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` NOT NULL DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NOT NULL DEFAULT 0 | |
| `unit_price` | `numeric(14,4)` NOT NULL DEFAULT 0 | |
| `price_override` | `bool` NOT NULL DEFAULT false | ręcznie wpisana cena; nie nadpisywana przy sync cennika ani redistrybuowaniu |
| `line_cost` | `numeric(14,2)` NULL | denorm: quantity × unit_cost |
| `line_price` | `numeric(14,2)` NULL | denorm: quantity × unit_price |
| `line_margin` | `numeric(14,2)` NULL | line_price − line_cost |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |
| `price_source_id` | `uuid` NULL | FK → `pc_price_sources.id` |
| `price_source_item_code` | `text` NULL | |
| `price_captured_at` | `timestamptz` NULL | |
| `price_captured_unit_cost` | `numeric(14,4)` NULL | archiwum ceny w momencie dodania |
| `price_captured_unit_price` | `numeric(14,4)` NULL | |
| `import_error` | `bool` DEFAULT false | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id)`, `(organization_id, tenant_id, cost_category_id)`.

#### `pc_calculation_audit_log` — log akcji kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `action` | `text` NOT NULL | `locked` \| `unlocked` \| `sent` \| `activated` \| `apply_to_deal` |
| `performed_by` | `uuid` NOT NULL | FK-id → users |
| `reason` | `text` NULL | obowiązkowy przy `unlocked` |
| `previous_status` | `text` NULL | |
| `new_status` | `text` NULL | |
| `meta` | `jsonb` NULL | |
| `created_at` | `timestamptz` | |

#### `pc_calculation_pdf_attachments` — PDF per wersja kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `attachment_id` | `uuid` NOT NULL | FK-id → `attachments` module |
| `generated_at` | `timestamptz` NOT NULL | |
| `generated_by` | `uuid` NULL | |
| `is_latest` | `bool` NOT NULL DEFAULT true | |
| `template_version` | `text` NULL | |

Partial unique index: `(calculation_id) WHERE is_latest = true`.

#### `pc_import_column_mappings` — mapowania importu kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `label` | `text` NOT NULL | |
| `file_type` | `text` NOT NULL | `xlsx` \| `csv` |
| `column_map` | `jsonb` NOT NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### 2.3 Waluta i zaokrąglenia

- Waluta kalkulacji = waluta deala (§3.7).
- `numeric(14,2)` dla sum pieniężnych, HALF_EVEN.
- `numeric(14,4)` dla cen jednostkowych.
- `numeric(14,4)` dla ilości.

---

## 3. Reguły wyliczeń

### 3.1 Wycena linii

```
line_cost  = ROUND(quantity × unit_cost,  2, HALF_EVEN)
line_price = ROUND(quantity × unit_price, 2, HALF_EVEN)
line_margin = line_price − line_cost
```

### 3.2 Narzut i pełny koszt

```
subtotal_cost   = SUM(line_cost)
overhead_amount = ROUND(subtotal_cost × overhead_rate, 2, HALF_EVEN)
full_cost       = subtotal_cost + overhead_amount
```

`overhead_rate` = koszty pośrednie jako % kosztu zakupu (nie zmienia cen linii).

### 3.3 Sumy per kategoria

```
category_subtotal_cost  = SUM(line_cost  WHERE cost_category_id = cat)
category_subtotal_price = SUM(line_price WHERE cost_category_id = cat)
category_margin         = category_subtotal_price − category_subtotal_cost
```

### 3.4 Tryby wyznaczania ceny (`price_mode`)

Trzy wzajemnie wykluczające się tryby.

#### Tryb A — `line_prices` (domyślny)

Input: `unit_price` per linia (ręcznie lub z cennika). Derived: `subtotal_price = SUM(line_price)`.

```
subtotal_price = SUM(line_price)
total_margin   = subtotal_price − full_cost
margin_rate    = total_margin / subtotal_price     (gdy subtotal_price > 0, else 0)
```

#### Tryb B — `target_margin` (marża docelowa)

Input: `target_margin_rate` ∈ (0, 1). Warunek: `target_margin_rate < 1` (walidacja zod).

```
target_subtotal_price = full_cost / (1 − target_margin_rate)
```

Redistrybuowanie `unit_price` na linie — patrz §3.5.

```
total_margin  = subtotal_price − full_cost
margin_rate   = total_margin / subtotal_price    (= target_margin_rate gdy brak override-linii)
```

#### Tryb C — `markup` (narzut cenowy)

Input: `markup_rate` ≥ 0.

```
target_subtotal_price = full_cost × (1 + markup_rate)
```

Redistrybuowanie `unit_price` na linie — patrz §3.5.

```
total_margin  = subtotal_price − full_cost
margin_rate   = total_margin / subtotal_price    (= markup_rate / (1 + markup_rate) gdy brak override-linii)
```

> **Uwaga**: formuły `margin_rate = target_margin_rate` (B) i `margin_rate = markup_rate / (1+markup_rate)` (C) zachodzą wyłącznie gdy brak linii z `price_override = true` lub reszta po override-liniach jest nieujemna. W ogólności `margin_rate` jest zawsze wyznaczana z rzeczywistych sum: `total_margin / subtotal_price`.

### 3.5 Redistrybuowanie cen linii (tryby B i C)

Jednolita reguła stosowana przez oba tryby:

1. **Target total**: `T = target_subtotal_price` (obliczone w §3.4 dla B lub C).

2. **Sumy override-linii**: `S_ov = SUM(line_price WHERE price_override = true)`.

3. **Remainder do redistrybuowania**: `R = T − S_ov`.
   - Gdy `R < 0` (override-linie przekraczają target) → **walidacja warning** (nie blokada): serwis notyfikuje UI, `subtotal_price` = rzeczywista suma (może przekraczać target). Redistrybuowanie nie jest wykonywane.
   - Gdy `R ≥ 0` → kontynuuj.

4. **Non-override linie**: zbiór N = `{linia WHERE price_override = false}`.
   - `base_total_cost = SUM(line_cost[i] × (1 + overhead_rate) FOR i IN N)` = suma line full_cost dla tych linii.
   - Gdy `base_total_cost > 0`: proporcja per linia = `line_cost[i] × (1 + overhead_rate) / base_total_cost`.
   - Gdy `base_total_cost = 0`: równy podział: proporcja = `1 / |N|` dla każdej linii w N.

5. **Nowe ceny**: dla każdej linii `i` w N:
   ```
   new_line_price[i] = ROUND(R × proporcja[i], 2, HALF_EVEN)
   new_unit_price[i] = ROUND(new_line_price[i] / quantity[i], 4, HALF_EVEN)   (gdy quantity > 0)
   ```

6. **Rounding remainder**: `delta = R − SUM(new_line_price[i] FOR i IN N)`. Ostatnia linia w N (największy `sort_order`) absorbuje `delta` (dodaj do jej `new_line_price`), analogicznie przelicz `unit_price`.

7. **Wynik**: `subtotal_price = SUM(line_price)`, `total_margin = subtotal_price − full_cost`, `margin_rate = total_margin / subtotal_price`.

### 3.6 Zachowanie `price_override` przy sync cennika

Linie z `price_override = true` nie są nadpisywane przy:
- Redistrybuowaniu trybu B/C (§3.5).
- Synchronizacji z cennikiem (np. po aktualizacji `pc_price_catalog`).
- Imporcie z szablonu kalkulacji.

Reset flagi: ręcznie przez użytkownika lub przy tworzeniu nowej wersji kalkulacji (`duplicate`).

### 3.7 Waluta kalkulacji (założenie rozwiązane)

Waluta kalkulacji = `customer_deals.value_currency` przy tworzeniu. Brak waluty deala → `pc_settings.default_currency` (`'PLN'`). Jednowalutowe w v1.

### 3.8 Reguła aktywnej wersji i `apply-to-deal`

- Partial unique index: co najwyżej jedna `is_active_version = true` per `(deal_id, organization_id, tenant_id)`.
- `activate`: transakcja — poprzednia `→ false`, nowa `→ true`.
- `apply-to-deal`: §8.7.

### 3.9 Odblokowanie kalkulacji (założenie rozwiązane)

Admin only (`project_costing.admin`). Tworzy nową wersję (`version += 1`, `status = 'draft'`, kopia linii). Oryginał nienaruszony. Wpis w `pc_calculation_audit_log` z obowiązkowym `reason`.

### 3.10 Sumy z `project_schedule`

Pola `total_quantity_m3`, `total_quantity_pcs`, `production_start_at`, `production_end_at` w `pc_calculations` to denormalizacja z `project_schedule`. Serwis subskrybuje `project_schedule.batch.updated` i `project_schedule.schedule.activated`, wywołuje `GET /api/project-schedule/schedules/:id/summary`.

### 3.11 `cf_offer_role` i reguła sumy projektu

`cf_offer_role` (id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`): read-only przez API entities. Reguła:
```
project_total = SUM(deal.value_amount)
  WHERE cf_offer_role = 'primary'
    AND deal.status NOT IN ('lost', 'archived')
```

---

## 4. Widoczność kalkulacji i kosztów/marż/cen

### 4.1 Scope widoczności kalkulacji

`pc_settings.visibility.calculation_scope`:
- `"all"` (default): widoczne wszystkie kalkulacje w organizacji dla `project_costing.view`.
- `"own"`: widoczne tylko kalkulacje deali, których właścicielem jest requester.

Admin (`project_costing.admin`): zawsze wszystkie. Wymuszenie server-side: serwis list/detail/export/PDF/analytics.

### 4.2 Widoczność pól

| Wymiar | Feature |
|--------|---------|
| Koszty (`unit_cost`, `line_cost`, `full_cost`, `overhead_amount`) | `project_costing.view_costs` |
| Marże (`total_margin`, `margin_rate`, `line_margin`) | `project_costing.view_margin` |
| Ceny sprzedaży (`unit_price`, `line_price`, `subtotal_price`) | `project_costing.view_prices` |

### 4.3 Wymuszenie server-side

`applyVisibilityRedaction(response, userFeatures, tenantSettings)` — null-uje pola bez uprawnień. Stosowane w API, eksporcie XLSX/CSV, analytics `requiredFeatures`.

---

## 5. PDF oferty

### 5.1 Wymagania

- Szablon: logo + dane firmy, numer oferty, data, ważność, dane odbiorcy (z deala + firmy), tabela pozycji (bez kosztów/marż), warunki, podpis.
- PDF zawsze bez kosztów, narzutu, marży.
- Wersjonowany: `pc_calculation_pdf_attachments`. Immutable po `sent`/`locked`.

### 5.2 Renderowanie: `@react-pdf/renderer` v3 (MIT)

Brak Puppeteer/Chromium (~300 MB RAM wykluczone na VPS 3.77 GiB). Pure Node.js.

### 5.3 Dane firmy na PDF (zweryfikowane w kodzie)

**Dostępne w `directory`** (`packages/core/src/modules/directory/data/entities.ts`):
- `Organization.name` (pole `name`)
- `Organization.logoUrl` (pole `logo_url`)

**Nieobecne w `Organization` entity**: adres, NIP/tax_id, REGON, numer konta, telefon, email.

**Rozwiązanie bez zmian w `packages/core`**: `pc_settings.pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account`, `pdf.contact_email`, `pdf.contact_phone`. Serwis PDF odczytuje `Organization.name`/`logoUrl` przez `GET /api/directory/organizations/:id` + brakujące pola z `pc_settings`. Edytowalne w `/project-costing/settings`.

### 5.4 Endpoint

```
POST /api/project-costing/calculations/:id/generate-pdf
```

Odpowiedź: `{ attachmentId, url }`. Async przy >200 liniach.

---

## 6. Import / Eksport

### 6.1 Biblioteka XLSX

**`exceljs` v4.4.0** (MIT, aktualizacja 2024-12). Npm `xlsx` zatrzymany na v0.18.5; nowsze SheetJS = CDN tarball (niestandardowe w yarn monorepo). `exceljs`: aktywna, streaming, wiele arkuszy.

### 6.2 Import XLSX/CSV — kreator mapowania

1. Upload (max 10 MB, max 5000 wierszy — §6.4).
2. Podgląd: pierwsze 5 wierszy.
3. Mapowanie: `label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `notes`.
4. Zapis: `pc_import_column_mappings`.
5. Walidacja: typy, znane kody.
6. Podgląd z flagami błędów (`import_error = true`).
7. Zatwierdzenie: `POST /api/project-costing/calculations/:id/import`.

### 6.3 Eksport XLSX

`GET /api/project-costing/calculations/:id/export?format=xlsx|csv`

Trzy arkusze (kolumny redagowane wg §4.3): linie kalkulacji, sumy per kategoria, nagłówek.

### 6.4 Limity importu (założenie rozwiązane)

Max **5000 wierszy** / **10 MB** per import. Timeout 30 s.

---

## 7. Abstrakcja źródeł cennikowych (Price Source Provider)

### 7.1 Interfejs

```typescript
export interface PriceSourceProvider {
  providerId: string; label: string
  search(query: PriceSourceQuery, ctx: ProviderContext): Promise<PriceSourceItem[]>
  getByCode(code: string, ctx: ProviderContext): Promise<PriceSourceItem | null>
}
```

Provider `company_catalog` w v1. Adaptery Sekocenbud/Intercenbud w v2.

### 7.2 Proweniencja ceny

Na każdej linii: `price_source_id`, `price_source_item_code`, `price_captured_at`, `price_captured_unit_cost/price`. Zmiany cennika nie wpływają retroaktywnie.

---

## 8. API

Prefix: `/api/project-costing/`. Optimistic locking na `PATCH`/`DELETE`.

### 8.1 Ustawienia

```
GET/PATCH /api/project-costing/settings
```

### 8.2 Segmenty i kategorie

```
GET/POST /api/project-costing/segments
PATCH/DELETE /api/project-costing/segments/:id
GET/POST /api/project-costing/cost-categories?segmentCode=
PATCH/DELETE /api/project-costing/cost-categories/:id
```

> **Typy elementów** — brak endpointów w `project_costing`. Lista typów elementów czytana przez `GET /api/project-schedule/element-types?segmentCode=` (moduł `project_schedule`). Patrz kontrakt §5 w spec harmonogramu.

### 8.3 Źródła cennikowe i cennik

```
GET/POST /api/project-costing/price-sources
PATCH/DELETE /api/project-costing/price-sources/:id
GET/POST /api/project-costing/price-catalog?priceSourceId=&segmentCode=&categoryId=&q=
PATCH/DELETE /api/project-costing/price-catalog/:id
GET /api/project-costing/price-catalog/export?format=xlsx|csv
POST /api/project-costing/price-catalog/import
POST /api/project-costing/price-catalog/search
```

### 8.4 Szablony

```
GET/POST /api/project-costing/calculation-templates?segmentCode=
GET/PATCH/DELETE /api/project-costing/calculation-templates/:id
GET/POST /api/project-costing/calculation-templates/:id/lines
PATCH/DELETE /api/project-costing/calculation-template-lines/:lineId
```

### 8.5 Kalkulacje — CRUD i lifecycle

```
GET/POST  /api/project-costing/calculations?dealId=&status=&isActiveVersion=
GET/PATCH/DELETE /api/project-costing/calculations/:id

POST /api/project-costing/calculations/:id/duplicate
POST /api/project-costing/calculations/:id/recalc        (przelicz linie + sumy; price_mode)
POST /api/project-costing/calculations/:id/activate
POST /api/project-costing/calculations/:id/mark-sent
POST /api/project-costing/calculations/:id/lock
POST /api/project-costing/calculations/:id/unlock        (admin only; nowa wersja + audit log)
POST /api/project-costing/calculations/:id/apply-to-deal
POST /api/project-costing/calculations/:id/generate-pdf

GET  /api/project-costing/calculations/:id/export?format=xlsx|csv
POST /api/project-costing/calculations/:id/import
GET  /api/project-costing/calculations/:id/pdf-attachments
```

Body `PATCH /api/project-costing/calculations/:id` akceptuje zmianę `price_mode`, `overhead_rate`, `target_margin_rate`, `markup_rate`, `label`, `currency`, `notes`. Zmiana `price_mode` wyzwala `recalc`.

### 8.6 Linie kalkulacji

```
GET/POST /api/project-costing/calculation-lines?calculationId=
PATCH/DELETE /api/project-costing/calculation-lines/:id
POST /api/project-costing/calculation-lines/batch
```

### 8.7 `apply-to-deal` — mechanizm (zweryfikowany w kodzie)

**Zweryfikowane**:
- Command `customers.deals.update`: `packages/core/src/modules/customers/commands/deals.ts`:745
- `CommandBus` w DI: `packages/shared/src/lib/di/container.ts`:218
- Dispatch w `makeCrudRoute`: `packages/shared/src/lib/crud/factory.ts`:2372

```typescript
// lib/calculation.service.ts
const commandBus = ctx.container.resolve('commandBus') as CommandBus
await commandBus.execute({
  commandId: 'customers.deals.update',
  input: { id: calculation.dealId, valueAmount: calculation.subtotalPrice },
  ctx,
})
await logAudit(calculationId, 'apply_to_deal', { meta: { valueAmount: calculation.subtotalPrice } }, ctx)
```

Zero zmian w `packages/core`.

### 8.8 Mapowania importu

```
GET/POST /api/project-costing/import-column-mappings
PATCH/DELETE /api/project-costing/import-column-mappings/:id
```

---

## 9. Uprawnienia (ACL)

| Feature ID | Opis |
|-----------|------|
| `project_costing.view` | Podgląd (z uwzględnieniem `calculation_scope`) |
| `project_costing.view_costs` | Koszty |
| `project_costing.view_margin` | Marża |
| `project_costing.view_prices` | Ceny sprzedaży |
| `project_costing.edit` | Edycja linii, wersji |
| `project_costing.admin` | Ustawienia, cennik, segmenty, odblokowanie, `calculation_scope` override |
| `project_costing.apply_to_deal` | Aktualizacja `value_amount` deala |
| `project_costing.import` | Import XLSX/CSV |
| `project_costing.export` | Eksport XLSX/CSV/PDF |
| `project_costing.lock` | Blokowanie / mark-sent |

Domyślnie: `admin` → wszystkie; `manager` → `view`, `view_costs`, `view_margin`, `view_prices`, `edit`, `apply_to_deal`, `import`, `export`, `lock`; `sales` → `view`, `view_prices`, `edit`, `import`, `export`.

---

## 10. Zdarzenia i integracja

### 10.1 Zdarzenia modułu

```
project_costing.calculation.created     (clientBroadcast: true)
project_costing.calculation.updated
project_costing.calculation.activated   (clientBroadcast: true)
project_costing.calculation.sent
project_costing.calculation.locked
project_costing.calculation.unlocked
project_costing.calculation.deleted
project_costing.deal.value_applied      (clientBroadcast: true)
project_costing.pdf.generated           (clientBroadcast: true)
```

### 10.2 Integracja z Dealem

- Zakładka `detail:customers.deal:tabs` (zweryfikowany spot).
- `apply-to-deal`: §8.7.
- Subscriber na `customers.deal.updated` → sync `currency`.

### 10.3 Integracja z `project_schedule`

Subscriber: `project_schedule.batch.updated`, `project_schedule.schedule.activated` → HTTP API `GET /api/project-schedule/schedules/:id/summary` → update `pc_calculations.(total_quantity_m3, total_quantity_pcs, production_start_at, production_end_at)`.

Zakładka harmonogramu na dealu: renderowana przez `project_schedule/widgets/DealScheduleTab.tsx` (oddzielna zakładka).

### 10.4 Integracja z `klin:project`

Odczyt `cf_offer_role` (id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`) przez API entities (read-only). Reguła sumy projektu: §3.11.

---

## 11. Analityka (`analytics.ts`)

```typescript
entities: [
  {
    entityId: 'project_costing:calculations',
    requiredFeatures: ['project_costing.view'],
    entityConfig: { tableName: 'pc_calculations', dateField: 'created_at',
                    defaultScopeFields: ['tenant_id', 'organization_id'], currencyField: 'currency' },
    fieldMappings: {
      id: { dbColumn: 'id', type: 'uuid' },
      dealId: { dbColumn: 'deal_id', type: 'uuid' },
      status: { dbColumn: 'status', type: 'text' },
      priceMode: { dbColumn: 'price_mode', type: 'text' },
      currency: { dbColumn: 'currency', type: 'text' },
      subtotalCost:   { dbColumn: 'subtotal_cost',   type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      overheadAmount: { dbColumn: 'overhead_amount', type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      fullCost:       { dbColumn: 'full_cost',       type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      subtotalPrice:  { dbColumn: 'subtotal_price',  type: 'numeric', requiredFeatures: ['project_costing.view_prices'] },
      totalMargin:    { dbColumn: 'total_margin',    type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      marginRate:     { dbColumn: 'margin_rate',     type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      totalQuantityM3:  { dbColumn: 'total_quantity_m3',  type: 'numeric' },
      totalQuantityPcs: { dbColumn: 'total_quantity_pcs', type: 'numeric' },
      createdAt:        { dbColumn: 'created_at',         type: 'timestamp' },
      isActiveVersion:  { dbColumn: 'is_active_version',  type: 'boolean' },
    },
  },
]
```

Widget TOP/BOTTOM marża: filtr `isActiveVersion = true`, metryka `marginRate`, groupBy `dealId`.

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs`. Widget: `DealCalculationTab.tsx`.

Zawartość: dropdown wersji, status badge, przyciski (Nowa wersja / Importuj / Eksportuj / PDF), panel trybu ceny (A/B/C + pola input), siatka linii (§12.2), panel podsumowania (redakcja wg §4), miniatura prognozy z `project_schedule`, przycisk „Zastosuj do Deala".

### 12.2 Siatka kosztów — `react-data-grid` v7 (MIT, ~50 KB)

Linia: kategoria, typ elementu (listę pobiera z `GET /api/project-schedule/element-types`), opis, ilość, j.m., koszt jedn. (`view_costs`), cena jedn. (`view_prices`, z ikoną lock gdy `price_override`), wartość kosztu/ceny/marży (computed, chronione). Auto-save debounce 800 ms. Kopiuj/wklej tab-separated.

### 12.3 Strony backend

`/project-costing/settings`, `/project-costing/segments` + `[id]`, `/project-costing/templates` + `[id]`, `/project-costing/price-sources`, `/project-costing/price-catalog` + `[id]`, `/project-costing/calculations` + `[id]`.

---

## 13. Rekomendacja integracji cennikowej

**v1**: własny cennik (`pc_price_catalog`, `provider_id = 'company_catalog'`) + import CSV/XLSX.

**v2**: adaptery Sekocenbud/Intercenbud — import pliku XLSX per kwartał (brak publicznego API [niezweryfikowane]). Licencje komercyjne [niezweryfikowane].

**v2+**: biblioteka szablonów KNR jako seed data.

---

## 14. Fazy i szacowanie wysiłku

### `project_costing` — MVP (~14 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (`pc_settings`, `pc_segments`, `pc_cost_categories`, `pc_price_sources`, `pc_price_catalog`, `pc_calculations`, `pc_calculation_lines`, `pc_calculation_audit_log`) | L (2.5 dnia) |
| API CRUD: ustawienia, segmenty, kategorie, price-sources, price-catalog, calculations, calculation-lines | L (3 dni) |
| Siatka `react-data-grid` + tryby A/B/C (redistrybuowanie §3.5) + widoczność | L (3 dni) |
| Widoczność server-side (3 features + `calculation_scope`) | M (2 dni) |
| Backend strony: ustawienia, segmenty, cennik | M (1.5 dnia) |
| ACL + setup.ts (seed: kategorie, segment, ustawienia) | S (0.5 dnia) |
| Analytics.ts + `requiredFeatures` + widget TOP/BOTTOM marża | S (1 dzień) |
| Integracja z `project_schedule` (subscriber + HTTP API calls dla sum) | S (0.5 dnia) |

**Suma MVP `project_costing`**: 2.5+3+3+2+1.5+0.5+1+0.5 = **14 dni roboczych**.

### `project_costing` — v1 (~15 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Import XLSX/CSV + kreator mapowania + walidacja (`exceljs`) | L (3 dni) |
| Eksport XLSX/CSV (redakcja widoczności) + cennik import/eksport | M (2 dni) |
| Szablony kalkulacji + generowanie z szablonu | M (2 dni) |
| Wersjonowanie (duplicate, activate, mark-sent, lock, unlock + audit log) | M (2 dni) |
| `apply-to-deal` via command bus | S (1 dzień) |
| PDF oferty (`@react-pdf/renderer`) + dane firmy z directory + pc_settings | L (3 dni) |
| Widok porównania wersji kalkulacji | S (1 dzień) |
| i18n PL/EN + testy jednostkowe | S (1 dzień) |

**Suma v1 `project_costing`**: 3+2+2+2+1+3+1+1 = **15 dni roboczych**.

### `project_costing` — v2 (~12 dni roboczych)

| Zadanie | Rozmiar |
|---------|---------|
| Nowe segmenty branżowe + kategorie | S (1 dzień) |
| Adapter importu Sekocenbud/Intercenbud XLSX | M (2 dni) |
| `pc_element_unit_factors` (szt↔m³ per typ elementu — opcjonalne) | S (1 dzień) |
| Integracja `klin:project` (widget sumy projektu) | M (2 dni) |
| Biblioteka szablonów KNR (seed data) | M (2 dni) |
| Konwersja walutowa v2 (`currencies`) | S (1 dzień) |
| AI-tool: generowanie linii z opisu projektu | L (3 dni) |

**Suma v2 `project_costing`**: 1+2+1+2+2+1+3 = **12 dni roboczych**.

### Podsumowanie zbiorcze (oba moduły)

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 14 d | 15 d | 12 d | 41 d |
| `project_schedule` | 11 d | 3 d | 7 d | 21 d |
| **Łącznie** | **25 d** | **18 d** | **19 d** | **62 d** |

---

## 15. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | `react-data-grid` niezgodność ze stylami DS OM | Średnie | Wysoki | PoC przed v1; custom cell renderers z DS tokenami |
| R2 | `@react-pdf/renderer` — polskie znaki, fonty | Średnie | Średni | Test z polskim tekstem + fontami przed implementacją |
| R3 | Wydajność `recalc` (5000 linii) na VPS 3.77 GiB | Niskie | Wysoki | Async (queue job) >500 linii; sync ≤500 |
| R4 | Redistrybuowanie B/C przy `price_override`: `R < 0` (override przekracza target) | Średnie | Niski | Warning w UI; `subtotal_price` = rzeczywista suma, nie target |
| R5 | Rounding drift redistrybuowania — ostatnia linia absorbuje residual | Niskie | Niski | §3.5 punkt 6 definiuje jawnie; max 0.01 PLN delta |
| R6 | Race condition przy `activate` (is_active_version) | Niskie | Wysoki | Transakcja `SERIALIZABLE` lub advisory lock per `deal_id` |
| R7 | Optimistic lock deala przy `apply-to-deal` — staleness | Średnie | Średni | Serwis pobiera aktualne `deal.updatedAt` tuż przed dispatch command |
| R8 | Spot `klin:project` może nie istnieć | Nieznane | Średni | Fallback strona `/project-costing/projects/:projectId` |
| R9 | `exceljs` RAM przy plikach >2 MB | Niskie | Niski | Streaming reader |
| R10 | `ps_element_types` nie załadowane gdy `project_schedule` nie aktywowany | Niskie | Średni | Oba moduły muszą być aktywowane razem; walidacja w setup.ts |

---

## 16. Pytania otwarte do Marka

1. **Spot `klin:project`**: Czy strona szczegółów `klin:project` ma spot na widget modułu? Jeśli nie — czy wystarczy `/project-costing/projects/:projectId`?

2. **PDF onboarding**: Czy moduł ma dodać krok onboardingowy „Uzupełnij dane firmy dla PDF" (adres, NIP)?

3. **Tryb B/C override warning**: Gdy override-linie przekraczają target (`R < 0`) — czy UI ma pokazywać ostrzeżenie i zostawiać ceny override bez zmian (spec tak definiuje w §3.5), czy blokować zmianę trybu?

---

## 17. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Siatka: `react-data-grid` v7 (MIT, ~50 KB) | Najlżejsza z natywnym Excel-like UX; brak MUI |
| A2 | Tryby A/B/C: jednolita reguła redistrybuowania (§3.5); `margin_rate` zawsze z rzeczywistych sum; formuły `target_margin_rate`/`markup/(1+markup)` tylko przy braku override | Konsekwentne nazewnictwo; jeden kod redistrybuowania dla B i C |
| A3 | `project_costing` zależy od `project_schedule`; nigdy odwrotnie | Unika circular dependency; element_types i schedule = property schedule |
| A4 | Partial unique index dla `is_active_version` | DB-level constraint |
| A5 | Catalog nie aktywowany; typy elementów w `ps_element_types` | RAM VPS; schedule jest właścicielem |
| A6 | Waluta kalkulacji = waluta deala | Eliminuje konwersje w v1 |
| A7 | Import: 5000 wierszy / 10 MB | §6.4 |
| A8 | Auto-save: debounce 800 ms | Minimalizuje requesty |
| A9 | `exceljs` v4.4.0 (MIT) | `xlsx` npm nieaktualizowane |
| A10 | PDF: `@react-pdf/renderer` v3 (MIT) | Brak Chromium |
| A11 | Odblokowanie: admin only; nowa wersja + `pc_calculation_audit_log` | Immutability wysłanych wersji |
| A12 | `apply-to-deal`: command bus `customers.deals.update` (zweryfikowano w kodzie) | Historia deala + CRM events |
| A13 | `cf_offer_role`: read-only (id `73f8260a-…`) | Pole istnieje na produkcji |
| A14 | Dane firmy PDF: `Organization.name` + `logoUrl` z directory; reszta z `pc_settings` | Organization entity nie ma adresu/NIP |
| A15 | `calculation_scope`: domyślnie `"all"` | Backward-compatible |
| A16 | Segmenty bez FK do `ps_element_types` — połączenie przez `segment_code` string | Moduły niezależne; kod jest stabilnym kontraktem |

---

## 18. Migracje i backward compatibility

Moduł dodaje wyłącznie nowe tabele (`pc_*`). Zero zmian w `packages/core`. Tabele `ps_*` to własność `project_schedule` — obie migracje muszą być uruchomione łącznie.

Kolejność w `project_costing`: `pc_settings` → `pc_segments` → `pc_cost_categories` → `pc_price_sources` → `pc_price_catalog` → `pc_calculation_templates` + `pc_calculation_template_lines` → `pc_calculations` → `pc_calculation_lines` → `pc_calculation_audit_log` → `pc_calculation_pdf_attachments` → `pc_import_column_mappings`.

---

## 19. Szkielet plików modułu

```
apps/mercato/src/modules/project_costing/
├── index.ts
├── acl.ts                          # 10 features
├── analytics.ts
├── events.ts
├── setup.ts                        # seed: kategorie, segment, pc_settings
├── di.ts
├── extension-points.ts
├── api/
│   ├── settings/route.ts
│   ├── segments/route.ts + [id]/route.ts
│   ├── cost-categories/route.ts + [id]/route.ts
│   ├── price-sources/route.ts + [id]/route.ts
│   ├── price-catalog/route.ts + [id]/route.ts + export|import|search/route.ts
│   ├── calculation-templates/route.ts + [id]/route.ts + [id]/lines/route.ts
│   ├── calculation-template-lines/[lineId]/route.ts
│   ├── calculations/route.ts + [id]/route.ts
│   ├── calculations/[id]/{duplicate,recalc,activate,mark-sent,lock,unlock,apply-to-deal,generate-pdf,export,import,pdf-attachments}/route.ts
│   ├── calculation-lines/route.ts + [id]/route.ts + batch/route.ts
│   └── import-column-mappings/route.ts + [id]/route.ts
├── backend/project-costing/
│   ├── settings/page.tsx
│   ├── segments/page.tsx + [id]/page.tsx
│   ├── templates/page.tsx + [id]/page.tsx
│   ├── price-sources/page.tsx
│   ├── price-catalog/page.tsx + [id]/page.tsx
│   └── calculations/page.tsx + [id]/page.tsx
├── components/
│   ├── CalculationGrid.tsx
│   ├── CalculationSummary.tsx
│   ├── PriceModeSelector.tsx
│   ├── ImportWizard.tsx
│   ├── VersionSelector.tsx
│   └── PdfTemplateEditor.tsx
├── data/entities.ts + validators.ts
├── i18n/pl.json + en.json
├── migrations/Migration20261019*.ts
├── subscribers/
│   ├── scheduleUpdated.ts
│   └── dealUpdated.ts
├── widgets/index.ts + DealCalculationTab.tsx
└── lib/
    ├── calculation.service.ts       # recalc (A/B/C redistrib §3.5), activate, apply-to-deal, unlock
    ├── pdf.service.ts
    ├── import.service.ts
    ├── visibility.ts
    └── price-source/
        ├── provider.interface.ts
        ├── registry.ts
        └── providers/company-catalog.provider.ts
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | v1 (rev 1) — inicjalna spec |
| 2026-10-19 | v2 (rev 2) — widoczność, PDF, price-source abstraction, harmonogram z batchów, overhead/margin model, apply-to-deal, exceljs, odblokowanie |
| 2026-10-19 | v3 (rev 3) — podział modułów (schedule → `project_schedule`); tryb C (`markup_rate`); `pc_schedule_audit_log` → `pc_calculation_audit_log`; `calculation_scope`; PDF dane firmy z directory |
| 2026-10-19 | v4 (rev 4) — `pc_element_types` usunięty → `ps_element_types` w `project_schedule`; `element_type_id` na liniach/szablonach = FK-id → `ps_element_types`; `segment_id` → `segment_code` (string) w tabelach PC (brak FK cross-module); API `element-types` usunięte z `project_costing`; redistrybuowanie B/C: jednolita reguła §3.5 (base = line_cost × (1+overhead_rate), override-linie pominięte, `R < 0` = warning, rounding → ostatnia linia); `margin_rate` zawsze z rzeczywistych sum; §6.2 opisuje kreator importu (limity §6.4); typos: waluta, cennikiem; effort: project_costing 14+15+12=41d + project_schedule 11+3+7=21d = 62d łącznie |
