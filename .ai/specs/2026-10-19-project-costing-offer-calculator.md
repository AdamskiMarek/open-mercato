# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v2 — zmiany po przeglądzie Marka) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications` |
| **Wyłączone upstream (nie aktywować)** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## Streszczenie

Moduł `project_costing` dodaje kalkulator kosztów ofertowych przypiętych do Deali w Open Mercato CRM. Działa jak uproszczony Excel: siatka linii kosztowych z edycją inline, import/eksport XLSX/CSV (`exceljs`), szablony per segment, wersjonowanie kalkulacji, harmonogram produkcji (batche), abstrakcja źródeł cennikowych oraz zakładka „Kalkulacja" wstrzykiwana na kartę deala. Wyniki zasilają pole `value_amount` deala przez istniejący command bus i analitykę dashboardów (TOP/BOTTOM marża, prognoza produkcji 6 miesięcy z batchów harmonogramu). Widoczność kosztów/marż/cen jest konfigurowalna per organizacja/tenant z wymuszeniem server-side. PDF oferty generowany server-side i przechowywany jako attachment.

Moduł żyje wyłącznie w `apps/mercato/src/modules/project_costing` – zero zmian w `packages/core`. Integracja wyłącznie przez punkty rozszerzeń OM: injection spots, events, command bus, `analytics.ts`.

---

## 1. Kontekst i cel

### 1.1 Problem

Firmy z branży budowlanej (v1: prefabrykacja żelbetowa) liczą wyceny w Excelu, a wyniki przepisują ręcznie do CRM-u. Brak powiązania kalkulacji z Dealem, brak historii wersji, brak kontroli widoczności marż między rolami.

### 1.2 Propozycja wartości

- Kalkulacja kosztów bezpośrednio na karcie Deala (zakładka „Kalkulacja").
- Import z istniejących arkuszy XLSX/CSV z kreatorem mapowania kolumn (zapamiętywane mappingi).
- Wyliczenie marży, narzutu, przychodu – zasilenie `value_amount` deala przez command bus.
- Szablony per segment, wersjonowanie kalkulacji (wysłana/zablokowana/historia).
- Harmonogram produkcji (batche per typ elementu) → prognoza m³/szt. na 6 miesięcy w dashboardach.
- Abstrakcja źródeł cennikowych z proweniencją każdej ceny (własny cennik v1, adaptery v2).
- Konfigurowalny poziom widoczności kosztów/marż/cen per rola – wymuszenie server-side.
- PDF oferty dla generalnego wykonawcy (logo, pozycje, warunki, ważność) – wersjonowany, jako attachment.

### 1.3 Zakres spec

Spec **nie** scaffolduje kodu aplikacji. Definiuje model, API, UI, ACL, PDF, harmonogram i integracje wymagane do implementacji.

---

## 2. Model danych

### 2.1 Konwencje globalne

- Wielodostępność: każda tabela zawiera `organization_id` + `tenant_id`. Wszystkie zapytania filtrują przez obie wartości pobierane z kontekstu żądania.
- UUID PK: `gen_random_uuid()`.
- Brak bezpośrednich relacji ORM między modułami – tylko FK-id (wartości UUID bez dekoratora ORM `@ManyToOne`).
- `updated_at` na każdej tabeli edytowalnej przez użytkownika (optimistic locking).

### 2.2 Tabele

#### `pc_settings` — ustawienia modułu per tenant

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `key` | `text` NOT NULL | klucz ustawienia |
| `value` | `jsonb` NOT NULL | wartość |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, key)`.

Kluczowe ustawienia (seed w `setup.ts`):
- `visibility.costs_visible_features` — tablica feature ID uprawnionych do widzenia kosztów (domyślnie `["project_costing.view_costs"]`).
- `visibility.margin_visible_features` — feature ID dla marży (domyślnie `["project_costing.view_margin"]`).
- `visibility.prices_visible_features` — feature ID dla cen sprzedaży (domyślnie `["project_costing.view_prices"]`).
- `pdf.company_name`, `pdf.logo_url`, `pdf.footer_text`, `pdf.validity_days` — dane do szablonu PDF.
- `default_currency` — domyślna waluta kalkulacji (domyślnie `'PLN'`).
- `default_overhead_rate` — domyślny narzut (domyślnie `0.10`).

#### `pc_cost_categories` — słownik kategorii kosztów

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `code` | `text` NOT NULL | unikalny per org+tenant, np. `production`, `transport`, `assembly`, `material`, `labour`, `equipment`, `subcontractor` |
| `label` | `text` NOT NULL | |
| `segment_id` | `uuid` NULL | FK → `pc_segments.id`; NULL = wspólna dla wszystkich segmentów |
| `sort_order` | `int` DEFAULT 0 | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, code)`. Indeks: `(organization_id, tenant_id)`.

Seed domyślny: `production`, `transport`, `assembly`.

#### `pc_segments` — segmenty branżowe

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `code` | `text` NOT NULL | np. `precast_concrete`, `general_construction` |
| `label` | `text` NOT NULL | |
| `description` | `text` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, code)`.

Seed: segment `precast_concrete` (prefabrykacja żelbetowa) dla v1.

#### `pc_element_types` — typy elementów per segment

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_id` | `uuid` NOT NULL | FK → `pc_segments.id` |
| `code` | `text` NOT NULL | np. `floor_slab`, `wall`, `column`, `beam`, `staircase` |
| `label` | `text` NOT NULL | |
| `default_unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `sort_order` | `int` DEFAULT 0 | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Seed dla `precast_concrete`: strop (`floor_slab`), ściana (`wall`), słup (`column`), belka (`beam`), klatka schodowa (`staircase`).

#### `pc_price_sources` — rejestr źródeł cennikowych (provider registry)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `provider_id` | `text` NOT NULL | identyfikator providera, np. `company_catalog`, `sekocenbud`, `intercenbud` |
| `label` | `text` NOT NULL | etykieta dla UI |
| `price_list_version` | `text` NULL | np. `Q3/2026`, `2026-10` |
| `price_list_date` | `date` NULL | data obowiązywania |
| `region` | `text` NULL | np. `PL-MZ` (ISO 3166-2) |
| `is_active` | `bool` DEFAULT true | |
| `meta` | `jsonb` NULL | dodatkowe metadane providera |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, provider_id, price_list_version)`.

Seed: jeden wpis `provider_id = 'company_catalog'` dla własnego cennika.

#### `pc_price_catalog` — własny cennik firmy (i przyszłe proweniencje)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `price_source_id` | `uuid` NOT NULL | FK → `pc_price_sources.id` |
| `segment_id` | `uuid` NULL | NULL = wspólna pozycja |
| `cost_category_id` | `uuid` NULL | FK → `pc_cost_categories.id` |
| `external_code` | `text` NULL | kod zewnętrzny (np. KNR 4-01/1234) – mapowanie z cennika zewnętrznego |
| `code` | `text` NOT NULL | wewnętrzny kod pozycji |
| `label` | `text` NOT NULL | |
| `description` | `text` NULL | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | koszt jedn. (zakup) |
| `unit_price` | `numeric(14,4)` NULL | cena jedn. (sprzedaż) |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `valid_from` | `date` NULL | |
| `valid_to` | `date` NULL | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(organization_id, tenant_id)`, `(price_source_id)`, `(organization_id, tenant_id, code)`.

#### `pc_calculation_templates` — szablony kalkulacji per segment

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_id` | `uuid` NOT NULL | FK → `pc_segments.id` |
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
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | koszt jedn. domyślny |
| `unit_price` | `numeric(14,4)` NULL | cena jedn. domyślna |
| `sort_order` | `int` DEFAULT 0 | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |

#### `pc_calculations` — kalkulacja (głowa), powiązana z Dealem

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `segment_id` | `uuid` NULL | FK → `pc_segments.id` |
| `code` | `text` NOT NULL | np. `K/2026/001` |
| `label` | `text` NOT NULL | tytuł wersji |
| `status` | `text` NOT NULL DEFAULT `'draft'` | `draft` \| `active` \| `sent` \| `locked` \| `archived` |
| `version` | `int` NOT NULL DEFAULT 1 | numer wersji per deal (auto-increment) |
| `is_active_version` | `bool` NOT NULL DEFAULT false | tylko jedna per deal może być `true` |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | waluta kalkulacji = waluta deala (patrz §3.7) |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | narzut jako ułamek, np. 0.10 = 10% |
| `target_margin_rate` | `numeric(6,4)` NULL | docelowa marża % (informacyjna / dla obliczenia sugerowanej ceny) |
| `subtotal_cost` | `numeric(14,2)` NULL | suma kosztów linii (przed narzutem) |
| `overhead_amount` | `numeric(14,2)` NULL | wartość narzutu = subtotal_cost × overhead_rate |
| `full_cost` | `numeric(14,2)` NULL | subtotal_cost + overhead_amount |
| `subtotal_price` | `numeric(14,2)` NULL | suma cen linii |
| `total_margin` | `numeric(14,2)` NULL | subtotal_price − full_cost |
| `margin_rate` | `numeric(6,4)` NULL | total_margin / subtotal_price |
| `total_quantity_m3` | `numeric(14,3)` NULL | suma ilości w m³ (prognoza, pochodna z harmonogramu) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | suma ilości szt. |
| `production_start_at` | `date` NULL | najwcześniejszy start z batchów (derived, informacyjny) |
| `production_end_at` | `date` NULL | najpóźniejszy koniec z batchów (derived, informacyjny) |
| `notes` | `text` NULL | |
| `sent_at` | `timestamptz` NULL | |
| `locked_at` | `timestamptz` NULL | |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` |
| `created_by` | `uuid` NULL | FK-id → users |
| `unlocked_by` | `uuid` NULL | FK-id → users (ostatni admin, który odblokował) |
| `unlocked_at` | `timestamptz` NULL | |
| `unlock_reason` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | wymagane dla optimistic locking |

`UNIQUE (organization_id, tenant_id, code)`. Indeksy: `(deal_id)`, `(deal_id, is_active_version)`.

Partial unique index dla `is_active_version`:
```sql
CREATE UNIQUE INDEX pc_calculations_active_unique
  ON pc_calculations (deal_id, organization_id, tenant_id)
  WHERE is_active_version = true;
```

Constraint: `CHECK (status IN ('draft','active','sent','locked','archived'))`.

#### `pc_calculation_lines` — linie kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | opis pozycji |
| `quantity` | `numeric(14,4)` NOT NULL DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NOT NULL DEFAULT 0 | koszt jednostkowy netto |
| `unit_price` | `numeric(14,4)` NOT NULL DEFAULT 0 | cena jednostkowa netto (może być 0 jeśli rola nie widzi cen) |
| `price_override` | `bool` NOT NULL DEFAULT false | `true` = cena wpisana ręcznie (nie z cennika); blokuje automatyczne przeliczenie z cennika |
| `line_cost` | `numeric(14,2)` NULL | denormalizacja: quantity × unit_cost |
| `line_price` | `numeric(14,2)` NULL | denormalizacja: quantity × unit_price |
| `line_margin` | `numeric(14,2)` NULL | line_price − line_cost |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |
| `price_source_id` | `uuid` NULL | FK → `pc_price_sources.id` (proweniencja) |
| `price_source_item_code` | `text` NULL | kod pozycji w źródle cennikowym |
| `price_captured_at` | `timestamptz` NULL | timestamp pobrania ceny ze źródła |
| `price_captured_unit_cost` | `numeric(14,4)` NULL | zarchiwizowana cena zakupu ze źródła |
| `price_captured_unit_price` | `numeric(14,4)` NULL | zarchiwizowana cena sprzedaży ze źródła |
| `import_error` | `bool` DEFAULT false | flaga błędnego wiersza z importu |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id)`, `(organization_id, tenant_id, cost_category_id)`.

#### `pc_production_batches` — harmonogram produkcji (Gantt-like)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | opis etapu/partii |
| `quantity_m3` | `numeric(14,3)` NULL | ilość m³ w tym batchu |
| `quantity_pcs` | `numeric(14,0)` NULL | ilość szt. w tym batchu |
| `planned_start_at` | `date` NOT NULL | planowany start |
| `planned_end_at` | `date` NOT NULL | planowany koniec |
| `actual_start_at` | `date` NULL | rzeczywisty start (dla śledzenia) |
| `actual_end_at` | `date` NULL | rzeczywisty koniec |
| `status` | `text` NOT NULL DEFAULT `'planned'` | `planned` \| `in_progress` \| `done` \| `cancelled` |
| `external_id` | `text` NULL | ID zadania w zewnętrznym narzędziu (MS Project, Gantt) |
| `external_tool` | `text` NULL | np. `ms_project`, `custom_gantt` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id)`, `(organization_id, tenant_id)`, `(planned_start_at, planned_end_at)`.

#### `pc_schedule_audit_log` — log odblokowania kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `action` | `text` NOT NULL | `locked` \| `unlocked` \| `sent` \| `activated` |
| `performed_by` | `uuid` NOT NULL | FK-id → users |
| `reason` | `text` NULL | obowiązkowy przy `unlocked` |
| `previous_status` | `text` NULL | |
| `new_status` | `text` NULL | |
| `created_at` | `timestamptz` | |

Indeks: `(calculation_id)`, `(organization_id, tenant_id)`.

#### `pc_calculation_pdf_attachments` — PDF oferty powiązany z wersją kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `attachment_id` | `uuid` NOT NULL | FK-id → `attachments` module |
| `generated_at` | `timestamptz` NOT NULL | |
| `generated_by` | `uuid` NULL | FK-id → users |
| `is_latest` | `bool` NOT NULL DEFAULT true | tylko jeden `true` per `calculation_id` |
| `template_version` | `text` NULL | wersja szablonu PDF |

Partial unique index: `(calculation_id) WHERE is_latest = true`.

#### `pc_import_column_mappings` — zapamiętane mapowania importu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `label` | `text` NOT NULL | |
| `file_type` | `text` NOT NULL | `xlsx` \| `csv` |
| `column_map` | `jsonb` NOT NULL | `{ "label": "Nazwa", "quantity": "Ilość", ... }` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### 2.3 Waluta i zaokrąglenia

- Waluta kalkulacji = waluta deala (patrz §3.7 — założenie rozwiązane autonomicznie).
- Wszystkie wartości pieniężne: `numeric(14,2)` (zaokrąglenie bankierskie HALF_EVEN po każdej operacji).
- Ceny jednostkowe: `numeric(14,4)`.
- Ilości: `numeric(14,4)` (m³, mb, kg mogą mieć 3+ miejsca).
- Brak konwersji walutowej w v1 (jednowalutowe). V2: integracja z modułem `currencies`.

---

## 3. Reguły wyliczeń

### 3.1 Wycena linii

```
line_cost  = ROUND(quantity × unit_cost,  2, HALF_EVEN)
line_price = ROUND(quantity × unit_price, 2, HALF_EVEN)
line_margin = line_price − line_cost
```

### 3.2 Sumy per kategoria

```
category_subtotal_cost  = SUM(line_cost  WHERE cost_category_id = cat)
category_subtotal_price = SUM(line_price WHERE cost_category_id = cat)
category_margin         = category_subtotal_price − category_subtotal_cost
```

### 3.3 Narzut i pełny koszt

```
subtotal_cost  = SUM(line_cost)      -- suma kosztów wszystkich linii
overhead_amount = ROUND(subtotal_cost × overhead_rate, 2, HALF_EVEN)
full_cost       = subtotal_cost + overhead_amount
```

**Narzut** (*overhead*): procent doliczany DO kosztu zakupu, reprezentuje koszty pośrednie (amortyzacja form, koszty ogólnozakładowe). Nie zmienia ceny oferty automatycznie — podnosi próg rentowności.

### 3.4 Cena oferty i marża

Dwa tryby wyznaczania ceny (wzajemnie wykluczające się, wybór w nagłówku kalkulacji):

**Tryb A — cena z linii** (domyślny):
```
subtotal_price = SUM(line_price)                       -- cena oferty = suma cen linii
total_margin   = subtotal_price − full_cost
margin_rate    = total_margin / subtotal_price          (gdy subtotal_price > 0, else 0)
```
Sugerowana cena dla docelowej marży (pole informacyjne, nie aplikowane automatycznie):
```
suggested_price = full_cost / (1 − target_margin_rate)  (gdy target_margin_rate < 1)
```

**Tryb B — cena z docelowej marży**:
Jeśli użytkownik wpisuje `target_margin_rate` i aktywuje tryb B, system wylicza:
```
subtotal_price = full_cost / (1 − target_margin_rate)
```
i zapisuje jako nową sumę (aktualizuje `unit_price` proporcjonalnie lub jako całościową cenę oferty bez redystrybucji na linie).

> **Nazewnictwo (konsekwentne w całej spec)**:
> - `overhead_rate` — narzut (% od kosztu, dodawany do kosztu)
> - `full_cost` — pełny koszt po narzucie
> - `subtotal_price` — przychód/cena oferty
> - `total_margin` — zysk bezwzględny
> - `margin_rate` — marża % (zysk / cena)
> - `target_margin_rate` — docelowa marża % (input użytkownika, tryb B)
>
> Pole `markup_rate` **nie istnieje** w modelu — usunięte z wcześniejszej wersji spec. Narzut to `overhead_rate`; marża to `margin_rate`.

### 3.5 Zachowanie przy ręcznej edycji ceny linii

Jeśli użytkownik ręcznie edytuje `unit_price` linii: `price_override = true`. Linia z `price_override = true` **nie jest** nadpisywana przy ponownym wyszukaniu w cenniku (np. po imporcie aktualizacji cennika). Użytkownik może ręcznie zresetować flagę.

### 3.6 Prognoza produkcji z harmonogramu

Prognoza 6-miesięczna agregowana z batchów harmonogramu (`pc_production_batches`):

```
-- Reguła pro-rata: batch trwający między planned_start_at a planned_end_at
-- jest rozkładany na miesiące proporcjonalnie do liczby dni w każdym miesiącu.
-- Dla batcha [ 2026-11-15 → 2026-12-20 ]:
--   Listopad: 15 dni z 45 → qty × (15/45)
--   Grudzień: 30 dni z 45 → qty × (30/45)
```

Kolumny analityczne eksponowane per miesiąc (zakres 6 miesięcy od bieżącego dnia):
- `forecast_m3_YYYY_MM` — prognozowana ilość m³
- `forecast_pcs_YYYY_MM` — prognozowana ilość szt.

W praktyce analytics.ts eksponuje `pc_production_batches` z polami `quantity_m3`, `quantity_pcs`, `planned_start_at`, `planned_end_at`; widget dashboardu dokonuje aggregacji pro-rata w swoim zapytaniu (przez `groupBy` miesięczny z normalizacją).

`pc_calculations.total_quantity_m3` i `total_quantity_pcs` to sumy całkowite wszystkich batchów (derived, odświeżane przez `recalc`). `production_start_at`/`production_end_at` to min/max dat batchów (derived).

### 3.7 Reguła walutowa (założenie rozwiązane)

Waluta kalkulacji = waluta deala (`customer_deals.value_currency`). Kalkulacja jednowalutowa w v1. Przy tworzeniu kalkulacji serwis odczytuje `value_currency` deala i kopiuje do `pc_calculations.currency`. Jeśli deal nie ma ustawionej waluty – używa `pc_settings.default_currency` (domyślnie `PLN`).

### 3.8 Reguła aktywnej wersji i zasilanie `value_amount`

- Tylko jedna kalkulacja per deal może mieć `is_active_version = true` (partial unique index).
- Po `activate`: endpoint ustawia `is_active_version = true` na wskazanej kalkulacji (poprzednia → `false`) w transakcji.
- `apply-to-deal` (oddzielne wywołanie): aktualizuje `customer_deals.value_amount = subtotal_price` przez command bus OM (patrz §6.6 i §8.2) — zachowuje historię deala i zdarzenia CRM.

### 3.9 Reguła odblokowania kalkulacji (założenie rozwiązane)

Kalkulacja `locked` lub `sent` może być odblokowana **wyłącznie przez admina** (`project_costing.admin`). Odblokowanie tworzy **nową wersję** kalkulacji (kopia linii, `version += 1`, status `draft`) zamiast edytowania wersji wysłanej. Oryginalna wersja pozostaje nienaruszona (`locked`/`sent`). Każde odblokowanie zapisuje wpis w `pc_schedule_audit_log` z `reason` (obowiązkowy), `performed_by`, `previous_status`.

### 3.10 Projekt (`klin:project`) — reguła sumowania deali

`klin:project` to custom entity (Data designer). Moduł `project_costing` odczytuje `cf_offer_role` (custom field, id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`, wartości: `primary`/`alternative`) per deal.

Reguła sumy projektu:
```
project_total = SUM(deal.value_amount)
  WHERE cf_offer_role = 'primary'
    AND deal.status NOT IN ('lost', 'archived')
```
Deale `alternative` wyświetlane w tabeli deali projektu (jako widok porównawczy), ale nie wchodzą do sumy. Deal `primary` ze statusem `lost` jest wykluczany natychmiast po zmianie statusu (reaguje na zdarzenie `customers.deal.updated`).

**`cf_offer_role` — istniejące dane**: Custom field istnieje w produkcji (id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`). Moduł **wyłącznie odczytuje** wartość przez API `custom fields`. Moduł **nie tworzy** tego pola w `setup.ts`. Obecnie 546 deali = `primary`.

---

## 4. Widoczność kosztów/marż/cen (konfigurowalna)

### 4.1 Model konfiguracji

Widoczność sterowana przez `pc_settings` (klucze `visibility.*_visible_features`) i ACL features modułu. Trzy niezależne wymiary:

| Wymiar | Feature do widzenia | Domyślna rola |
|--------|---------------------|---------------|
| Koszty (`unit_cost`, `line_cost`, `full_cost`, `overhead_amount`) | `project_costing.view_costs` | `admin`, `manager` |
| Marże (`total_margin`, `margin_rate`, `line_margin`) | `project_costing.view_margin` | `admin`, `manager` |
| Ceny sprzedaży (`unit_price`, `line_price`, `subtotal_price`) | `project_costing.view_prices` | `admin`, `manager`, `sales` |

### 4.2 Wymuszenie server-side

Każde API response przechodzi przez `applyVisibilityRedaction(response, userFeatures, tenantSettings)`:

```typescript
// Przykład logiki redakcji (lib/visibility.ts)
function applyVisibilityRedaction(line: CalculationLine, features: string[], settings: VisibilitySettings) {
  if (!hasAnyFeature(features, settings.costsVisibleFeatures)) {
    line.unitCost = null
    line.lineCost = null
    // full_cost, overhead_amount z nagłówka też → null
  }
  if (!hasAnyFeature(features, settings.marginVisibleFeatures)) {
    line.lineMargin = null
    line.marginRate = null
  }
  if (!hasAnyFeature(features, settings.pricesVisibleFeatures)) {
    line.unitPrice = null
    line.linePrice = null
  }
  return line
}
```

### 4.3 Redakcja w eksporcie XLSX/CSV

Kolumny kosztów/marż/cen są pomijane w arkuszu eksportowym jeśli użytkownik nie ma odpowiednich features. Eksport jest generowany server-side — nie istnieje możliwość ominięcia przez UI.

### 4.4 PDF oferty (zawsze bez kosztów i marż)

PDF generowany dla klienta (generalny wykonawca) **nigdy nie zawiera** `unit_cost`, `line_cost`, `full_cost`, `overhead_amount`, `total_margin`, `margin_rate`. Zawiera: `label`, `quantity`, jednostkę, `unit_price`, `line_price`. Kolumny kosztów/marż są strukturalnie wykluczone z szablonu PDF klienta, niezależnie od uprawnień użytkownika.

### 4.5 Analityka (analytics.ts)

Pola `totalCost`, `fullCost`, `overheadAmount`, `totalMargin`, `marginRate` w analytics.ts mają `requiredFeatures: ['project_costing.view_costs']` / `'project_costing.view_margin'`. Widgety dashboardów ukrywają metryki, do których użytkownik nie ma dostępu.

---

## 5. PDF oferty

### 5.1 Wymagania

- Szablon: logo firmy, dane firmy, numer oferty (code kalkulacji + version), data, ważność oferty (`pdf.validity_days` z settings), odbiorca (dane deala/firmy z customers), tabela pozycji, warunki handlowe, podpis.
- Dane klienta: pobierane z deala (`customer_deals`) i powiązanej firmy/osoby przez API `customers`.
- Wersjonowanie: każde wygenerowanie PDF = nowy rekord w `pc_calculation_pdf_attachments`; poprzedni `is_latest` → `false`. Attachment przechowywany w module `attachments` (powiązany z `deal_id` i `calculation_id`). PDF immutable po `sent`/`locked`.

### 5.2 Renderowanie server-side

**Biblioteka**: `@react-pdf/renderer` v3 (MIT, ~300 KB zcompressed, brak zależności Chromium).

Uzasadnienie:
- Lekka — ważne na VPS 3.77 GiB RAM. Brak Puppeteer/Chromium (~300 MB RAM).
- Pure JS/Node.js, nie wymaga systemu plików ani headless browser.
- Generuje PDF bezpośrednio z React komponentów — utrzymywalny szablon.

Alternatywy odrzucone:
- **Puppeteer/html-to-pdf**: Chromium ~300 MB RAM per instancja — wykluczone na małym VPS.
- **PDFKit**: niski poziom (raw primitives), trudny do utrzymania szablonu.
- **wkhtmltopdf**: wymaga zewnętrznego binarnego, problem z deploy.

### 5.3 Endpoint generowania

```
POST /api/project-costing/calculations/:id/generate-pdf
```
Odpowiedź: `{ attachmentId, url }`. PDF przechowywany przez moduł `attachments`, powiązany tagami z `deal_id` i `calculation_id`. Generowanie asynchroniczne przy dużych kalkulacjach (>200 linii) – endpoint zwraca job ID, status przez SSE/polling.

### 5.4 Konfiguracja szablonu

Przez `pc_settings`: `pdf.company_name`, `pdf.logo_url` (URL do uploadu przez attachments lub publicznego CDN), `pdf.footer_text` (HTML-safe), `pdf.validity_days` (np. 30), `pdf.contact_email`, `pdf.contact_phone`. Edytowalne w ustawieniach modułu (`/project-costing/settings`).

---

## 6. Import / Eksport

### 6.1 Biblioteka XLSX

**Biblioteka**: `exceljs` v4.4.0 (MIT, ostatnia aktualizacja 2024-12; aktywnie utrzymywana).

Uzasadnienie:
- Npm `xlsx` (SheetJS) zatrzymał aktualizacje na npm na wersji 0.18.5 (lipiec 2022 dla aktywnego developmentu). Nowsze wersje SheetJS wymagają instalacji z CDN tarball (niestandardowe w yarn workspace monorepo, utrudnia CI i bezpieczeństwo łańcucha zależności).
- `exceljs` jest pełną, utrzymywaną alternatywą z obsługą `.xlsx`, `.csv`, formatowania komórek, wielu arkuszy i streamingu — wystarczające dla wymagań modułu.
- MIT license, kompatybilna z open-source fork.

Formaty: `.xlsx`, `.csv` (UTF-8 z BOM dla zgodności Excel PL, separator `;`).

### 6.2 Import XLSX/CSV — kreator mapowania

1. **Upload**: drag-and-drop lub przycisk (max 10 MB, max 5000 wierszy — patrz §3.9 rozwiązane założenia).
2. **Podgląd**: pierwsze 5 wierszy danych (DataTable read-only).
3. **Mapowanie kolumn**: dropdown per pole modułu (`label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `notes`). Możliwość pominięcia kolumny.
4. **Zapis mapowania**: opcja „Zapamiętaj jako [nazwa]" → `pc_import_column_mappings`.
5. **Walidacja**: typy (ilość/cena = liczba, kategoria = znany kod lub label), wyróżnienie błędów.
6. **Podgląd po mapowaniu**: zaimportowane linie z obliczonymi wartościami i flagami błędów.
7. **Zatwierdzenie**: `POST /api/project-costing/calculations/:id/import` (tryb: dołącz / zastąp).

Obsługa błędów: błędne wiersze wchodzą z `import_error = true`, widoczne w siatce z ikoną ostrzeżenia.

### 6.3 Eksport XLSX

`GET /api/project-costing/calculations/:id/export?format=xlsx|csv`

XLSX — wieloarkuszowy:
- Arkusz 1: linie kalkulacji (kolumny zredagowane wg widoczności użytkownika – §4.3).
- Arkusz 2: sumy per kategoria (widoczność jak wyżej).
- Arkusz 3: nagłówek (meta, daty, marża jeśli uprawnienie).

CSV: UTF-8 z BOM, separator `;`.

Import/eksport cennika: `GET/POST /api/project-costing/price-catalog/export|import`.

### 6.4 Import/eksport harmonogramu

```
GET  /api/project-costing/calculations/:id/schedule/export?format=xlsx|csv
POST /api/project-costing/calculations/:id/schedule/import
```

Format XLSX harmonogramu: kolumny `element_type`, `label`, `quantity_m3`, `quantity_pcs`, `planned_start`, `planned_end`, `status`. Kompatybilny z prostym eksportem z MS Project (CSV z nagłówkami).

### 6.5 Limity (założenie rozwiązane)

- Rozmiar pliku: 10 MB (kalkulacje prefabrykacji typowo 50–500 wierszy, 5000 to zapas bezpieczny).
- Liczba wierszy: 5000 per import.
- Timeout parsowania: 30 s.

---

## 7. Abstrakcja źródeł cennikowych (Price Source Provider)

### 7.1 Interfejs providera

```typescript
// lib/price-source/provider.interface.ts
export interface PriceSourceProvider {
  providerId: string              // np. 'company_catalog', 'sekocenbud'
  label: string
  search(query: PriceSourceQuery, ctx: ProviderContext): Promise<PriceSourceItem[]>
  getByCode(code: string, ctx: ProviderContext): Promise<PriceSourceItem | null>
}

export type PriceSourceQuery = {
  q?: string
  segmentId?: string
  categoryId?: string
  priceSourceId: string           // UUID konkretnego pc_price_sources
  limit?: number
}

export type PriceSourceItem = {
  code: string
  externalCode?: string           // kod z zewnętrznego systemu
  label: string
  description?: string
  unitId?: string                 // UUID dictionaries unit
  unitCost?: number
  unitPrice?: number
  currency: string
  priceListVersion?: string
  priceListDate?: string
  region?: string
}
```

### 7.2 Rejestr providerów

```typescript
// lib/price-source/registry.ts
class PriceSourceRegistry {
  register(provider: PriceSourceProvider): void
  get(providerId: string): PriceSourceProvider | undefined
  list(): PriceSourceProvider[]
}
export const priceSourceRegistry = new PriceSourceRegistry()
```

Inicjalizacja w `di.ts` modułu. Provider `company_catalog` rejestrowany zawsze (czyta z `pc_price_catalog`). Przyszłe adaptery (v2: Sekocenbud, Intercenbud) rejestrowane opcjonalnie.

### 7.3 Proweniencja ceny na linii kalkulacji

Przy każdym dodaniu/aktualizacji linii z cennika, serwis zapisuje:
- `catalog_entry_id` — UUID pozycji `pc_price_catalog`
- `price_source_id` — UUID `pc_price_sources`
- `price_source_item_code` — kod pozycji
- `price_captured_at` — timestamp
- `price_captured_unit_cost`, `price_captured_unit_price` — wartości w momencie dodania (archiwum)

Dzięki temu zmiany cennika nie wpływają retroaktywnie na kalkulacje (`unit_cost`/`unit_price` w linii to niezależne kopie). Linie z `price_override = true` nie są aktualizowane przy synchronizacji cennika.

### 7.4 v2: Adaptery zewnętrznych cenników

Format adaptera Sekocenbud/Intercenbud (v2):
- Import pliku XLSX z cennika → `pc_price_catalog` (mapowanie predefiniowane per provider).
- Adapter implementuje `PriceSourceProvider.search/getByCode` czytając z `pc_price_catalog` filtrując po `price_source_id`.
- `external_code` w `pc_price_catalog` przechowuje oryginalny kod KNR/KNNR lub numer pozycji Sekocenbud.

---

## 8. API

Prefix: `/api/project-costing/`. Konwencje OM: `makeCrudRoute`, zod validators, `organizationId`/`tenantId` z DI. Optimistic locking (`If-Unmodified-Since`) na wszystkich `PATCH`/`DELETE` encji z `updated_at`.

### 8.1 Ustawienia

```
GET   /api/project-costing/settings
PATCH /api/project-costing/settings
```

### 8.2 Segmenty, kategorie, typy elementów

```
GET    /api/project-costing/segments
POST   /api/project-costing/segments
PATCH  /api/project-costing/segments/:id
DELETE /api/project-costing/segments/:id

GET    /api/project-costing/cost-categories?segmentId=
POST   /api/project-costing/cost-categories
PATCH  /api/project-costing/cost-categories/:id
DELETE /api/project-costing/cost-categories/:id

GET    /api/project-costing/element-types?segmentId=
POST   /api/project-costing/element-types
PATCH  /api/project-costing/element-types/:id
DELETE /api/project-costing/element-types/:id
```

### 8.3 Źródła cennikowe i cennik

```
GET    /api/project-costing/price-sources
POST   /api/project-costing/price-sources
PATCH  /api/project-costing/price-sources/:id
DELETE /api/project-costing/price-sources/:id

GET    /api/project-costing/price-catalog?priceSourceId=&segmentId=&categoryId=&q=
POST   /api/project-costing/price-catalog
PATCH  /api/project-costing/price-catalog/:id
DELETE /api/project-costing/price-catalog/:id
GET    /api/project-costing/price-catalog/export?format=xlsx|csv
POST   /api/project-costing/price-catalog/import
POST   /api/project-costing/price-catalog/search      (wyszukiwanie przez provider registry)
```

### 8.4 Szablony

```
GET    /api/project-costing/calculation-templates?segmentId=
POST   /api/project-costing/calculation-templates
GET    /api/project-costing/calculation-templates/:id
PATCH  /api/project-costing/calculation-templates/:id
DELETE /api/project-costing/calculation-templates/:id
GET    /api/project-costing/calculation-templates/:id/lines
POST   /api/project-costing/calculation-templates/:id/lines
PATCH  /api/project-costing/calculation-template-lines/:lineId
DELETE /api/project-costing/calculation-template-lines/:lineId
```

### 8.5 Kalkulacje

```
GET    /api/project-costing/calculations?dealId=&status=&isActiveVersion=
POST   /api/project-costing/calculations
GET    /api/project-costing/calculations/:id
PATCH  /api/project-costing/calculations/:id
DELETE /api/project-costing/calculations/:id                   (tylko draft/archived)

POST   /api/project-costing/calculations/:id/duplicate         (nowa wersja — kopia linii + batchów)
POST   /api/project-costing/calculations/:id/recalc            (przelicz linie + sumy + batch-derived)
POST   /api/project-costing/calculations/:id/activate          (is_active_version → true, poprzednia → false)
POST   /api/project-costing/calculations/:id/apply-to-deal     (value_amount deala via command bus)
POST   /api/project-costing/calculations/:id/mark-sent         (status → sent, sent_at = now())
POST   /api/project-costing/calculations/:id/lock              (status → locked, locked_at = now())
POST   /api/project-costing/calculations/:id/unlock            (admin only: nowa wersja draft + audit log)
POST   /api/project-costing/calculations/:id/generate-pdf      (server-side PDF → attachment)

GET    /api/project-costing/calculations/:id/export?format=xlsx|csv
POST   /api/project-costing/calculations/:id/import
```

### 8.6 Linie kalkulacji

```
GET    /api/project-costing/calculation-lines?calculationId=
POST   /api/project-costing/calculation-lines
PATCH  /api/project-costing/calculation-lines/:id
DELETE /api/project-costing/calculation-lines/:id
POST   /api/project-costing/calculation-lines/batch            (bulk upsert — auto-save siatki)
```

### 8.7 Harmonogram produkcji

```
GET    /api/project-costing/production-batches?calculationId=
POST   /api/project-costing/production-batches
PATCH  /api/project-costing/production-batches/:id
DELETE /api/project-costing/production-batches/:id
GET    /api/project-costing/calculations/:id/schedule/export?format=xlsx|csv
POST   /api/project-costing/calculations/:id/schedule/import

POST   /api/project-costing/calculations/:id/schedule/webhook  (inbound webhook od zewnętrznego narzędzia)
```

### 8.8 PDF i mapowania importu

```
GET    /api/project-costing/calculations/:id/pdf-attachments
GET    /api/project-costing/import-column-mappings
POST   /api/project-costing/import-column-mappings
PATCH  /api/project-costing/import-column-mappings/:id
DELETE /api/project-costing/import-column-mappings/:id
```

### 8.9 `apply-to-deal` — mechanizm (zweryfikowany w kodzie)

**Weryfikacja w kodzie** (`packages/core/src/modules/customers/commands/deals.ts`, linia 745; `packages/shared/src/lib/crud/factory.ts`, linia 2372; `packages/shared/src/lib/di/container.ts`, linia 218):

- Command `customers.deals.update` zarejestrowany przez `registerCommand(updateDealCommand)`.
- `CommandBus` dostępny w DI jako `commandBus` (singleton, `asValue(new CommandBus())`).
- `makeCrudRoute` wywołuje go przez `ctx.container.resolve('commandBus')`.

Implementacja `apply-to-deal` w serwisie modułu:
```typescript
// lib/calculation.service.ts
async applyToDeal(calculationId: string, ctx: ServiceContext) {
  const calculation = await this.loadCalculation(calculationId, ctx)
  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  await commandBus.execute({
    commandId: 'customers.deals.update',
    input: {
      id: calculation.dealId,
      valueAmount: calculation.subtotalPrice,
      // updatedAt deala pobrane z osobnego zapytania — optimistic lock deala
    },
    ctx,
  })
}
```

Efekt: zachowanie historii deala (`audit_log`), emisja zdarzenia `customers.deal.updated` przez command handler, aktualizacja cache/search index przez CRUD side effects. **Zero zmian w `packages/core`**.

---

## 9. Uprawnienia (ACL)

Plik `acl.ts` w module:

| Feature ID | Opis |
|-----------|------|
| `project_costing.view` | Podgląd kalkulacji (nagłówek, linie bez chronionych pól) |
| `project_costing.view_costs` | Widzenie kosztów (`unit_cost`, `line_cost`, `full_cost`) |
| `project_costing.view_margin` | Widzenie marży (`total_margin`, `margin_rate`, `line_margin`) |
| `project_costing.view_prices` | Widzenie cen sprzedaży (`unit_price`, `line_price`, `subtotal_price`) |
| `project_costing.edit` | Edycja linii, wersji, harmonogramu (bez locked/sent) |
| `project_costing.admin` | Zarządzanie segmentami, kategoriami, cenniktem, ustawieniami, odblokowanie |
| `project_costing.apply_to_deal` | Aktualizacja `value_amount` deala |
| `project_costing.import` | Import XLSX/CSV |
| `project_costing.export` | Eksport XLSX/CSV/PDF |
| `project_costing.lock` | Blokowanie/oznaczanie jako wysłane |

Domyślne przypisania w `setup.ts`:
- `admin` → wszystkie features.
- `manager` → `view`, `view_costs`, `view_margin`, `view_prices`, `edit`, `apply_to_deal`, `import`, `export`, `lock`.
- `sales` → `view`, `view_prices`, `edit`, `import`, `export`.

Strony backend: `requireFeatures(['project_costing.admin'])` dla ustawień; `requireFeatures(['project_costing.view'])` dla zakładki kalkulacji.

---

## 10. Zdarzenia i integracja

### 10.1 Zdarzenia modułu (`events.ts`)

```
project_costing.calculation.created     (clientBroadcast: true)
project_costing.calculation.updated
project_costing.calculation.activated   (clientBroadcast: true)
project_costing.calculation.sent
project_costing.calculation.locked
project_costing.calculation.unlocked    (zawiera: by, reason, new_version_id)
project_costing.calculation.deleted
project_costing.deal.value_applied      (clientBroadcast: true)
project_costing.pdf.generated           (clientBroadcast: true)
project_costing.schedule.batch_updated
```

`clientBroadcast: true` odświeża zakładkę deala przez SSE DOM Event Bridge.

### 10.2 Integracja z Dealem

- Zakładka wstrzyknięta przez `detail:customers.deal:tabs` (zweryfikowany spot, `useDealInjectedTabs.tsx`, `packages/core/src/modules/customers/backend/customers/deals/[id]/hooks/useDealInjectedTabs.tsx`).
- `apply-to-deal` przez `customers.deals.update` command (§8.9).
- Subskrypcja na `customers.deal.updated` (w `subscribers/`) → jeśli zmiana `value_currency` deala → aktualizacja `currency` aktywnej kalkulacji + notify.

### 10.3 Integracja z `klin:project`

Jak opisano w §3.10: odczyt `cf_offer_role` przez API entities, brak tworzenia custom fielda. Widget sumy projektu wstrzyknięty przez spot na `klin:project` (do weryfikacji w implementacji — spot może nie istnieć, fallback: `/project-costing/projects/:projectId`).

### 10.4 Integracja zewnętrznych narzędzi harmonogramowania

Inbound webhook `POST /api/project-costing/calculations/:id/schedule/webhook` przyjmuje payload zgodny z `PriceSourceProvider` interfejsem dla harmonogramu:
```json
{
  "tool": "ms_project",
  "batches": [
    { "externalId": "task_123", "elementTypeCode": "floor_slab", "quantityM3": 45.5, "plannedStart": "2026-11-15", "plannedEnd": "2026-12-20" }
  ]
}
```
Serwis mapuje `elementTypeCode` → `element_type_id` przez `pc_element_types.code`. Nierozpoznane kody → batch z `element_type_id = null` i ostrzeżenie w odpowiedzi.

---

## 11. Analityka (`analytics.ts`)

```typescript
entities: [
  {
    entityId: 'project_costing:calculations',
    requiredFeatures: ['project_costing.view'],
    entityConfig: {
      tableName: 'pc_calculations',
      dateField: 'created_at',
      defaultScopeFields: ['tenant_id', 'organization_id'],
      currencyField: 'currency',
    },
    fieldMappings: {
      id:               { dbColumn: 'id',              type: 'uuid' },
      dealId:           { dbColumn: 'deal_id',         type: 'uuid' },
      segmentId:        { dbColumn: 'segment_id',      type: 'uuid' },
      status:           { dbColumn: 'status',          type: 'text' },
      currency:         { dbColumn: 'currency',        type: 'text' },
      // Koszty — chronione requiredFeatures
      subtotalCost:     { dbColumn: 'subtotal_cost',   type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      overheadAmount:   { dbColumn: 'overhead_amount', type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      fullCost:         { dbColumn: 'full_cost',       type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      // Ceny — chronione requiredFeatures
      subtotalPrice:    { dbColumn: 'subtotal_price',  type: 'numeric', requiredFeatures: ['project_costing.view_prices'] },
      // Marża — chroniona requiredFeatures
      totalMargin:      { dbColumn: 'total_margin',    type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      marginRate:       { dbColumn: 'margin_rate',     type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      // Ilości — publiczne (nie są wrażliwe)
      totalQuantityM3:  { dbColumn: 'total_quantity_m3',  type: 'numeric' },
      totalQuantityPcs: { dbColumn: 'total_quantity_pcs', type: 'numeric' },
      productionStartAt:{ dbColumn: 'production_start_at', type: 'timestamp' },
      productionEndAt:  { dbColumn: 'production_end_at',   type: 'timestamp' },
      createdAt:        { dbColumn: 'created_at',      type: 'timestamp' },
      isActiveVersion:  { dbColumn: 'is_active_version', type: 'boolean' },
    },
  },
  {
    entityId: 'project_costing:production_batches',
    requiredFeatures: ['project_costing.view'],
    entityConfig: {
      tableName: 'pc_production_batches',
      dateField: 'planned_start_at',
      defaultScopeFields: ['tenant_id', 'organization_id'],
    },
    fieldMappings: {
      id:             { dbColumn: 'id',               type: 'uuid' },
      calculationId:  { dbColumn: 'calculation_id',   type: 'uuid' },
      elementTypeId:  { dbColumn: 'element_type_id',  type: 'uuid' },
      quantityM3:     { dbColumn: 'quantity_m3',      type: 'numeric' },
      quantityPcs:    { dbColumn: 'quantity_pcs',     type: 'numeric' },
      plannedStartAt: { dbColumn: 'planned_start_at', type: 'timestamp' },
      plannedEndAt:   { dbColumn: 'planned_end_at',   type: 'timestamp' },
      status:         { dbColumn: 'status',           type: 'text' },
    },
  },
]
```

### 11.1 Widgety dashboardów

**TOP/BOTTOM marża** (wymaga `project_costing.view_margin`):
- Encja: `project_costing:calculations`, filtr `isActiveVersion = true`.
- Metryka: `avg(marginRate)` lub `sum(totalMargin)`, groupBy: `dealId`.
- Sortowanie: malejąco (TOP) / rosnąco (BOTTOM) — konfigurowane w widgecie.

**Prognoza produkcji — m³/szt. na 6 miesięcy**:
- Encja: `project_costing:production_batches`, join z `pc_calculations` (filtr `is_active_version = true`, status `active|sent`).
- Metryki: `SUM(quantityM3)`, `SUM(quantityPcs)`, groupBy: miesiąc z `plannedStartAt` (pro-rata w widgecie).
- Wynik: wykres słupkowy 6 miesięcy.

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs` (zweryfikowany w kodzie).

Widget: `project_costing/widgets/DealCalculationTab.tsx`.

Zawartość:
- Nagłówek: wybór wersji kalkulacji, status badge, przyciski: „Nowa wersja", „Importuj", „Eksportuj XLSX", „Generuj PDF".
- Siatka linii kosztowych (§12.2).
- Panel podsumowania: sumy per kategoria + łącznie, narzut %, marża % (zredagowane wg widoczności).
- Zakładka harmonogramu (view Gantt-list batchów, tylko dla kalkulacji z batchami).
- Przycisk „Zastosuj do Deala" (wymaga `project_costing.apply_to_deal`).

### 12.2 Siatka kosztów „jak Excel"

**Biblioteka**: `adazzle/react-data-grid` v7 (MIT, ~50 KB gzip, zweryfikowana lekka opcja).

Kolumny (widoczność zależna od ACL):

| Kolumna | Edytowalna | Widoczność |
|---------|-----------|-----------|
| Lp. | Nie | zawsze |
| Kategoria | Tak | zawsze |
| Typ elementu | Tak | zawsze |
| Opis / Pozycja | Tak | zawsze |
| Ilość | Tak | zawsze |
| J.m. | Tak | zawsze |
| Koszt jedn. [PLN] | Tak | `view_costs` |
| Cena jedn. [PLN] | Tak | `view_prices` |
| Wartość kosztu | Nie | `view_costs` |
| Wartość ceny | Nie | `view_prices` |
| Marża zł | Nie | `view_margin` |
| Marża % | Nie | `view_margin` |
| Źródło ceny | Nie (info) | zawsze (ikona) |
| Akcje | Nie | zawsze |

Funkcje: edycja inline (Enter/Tab/Arrow), kopiuj/wklej blok (tab-separated, kompatybilny Excel), dodawanie/usuwanie wierszy, filtrowanie per kategoria, zwijanie grup per kategoria, auto-save debounce 800 ms.

### 12.3 Widok harmonogramu produkcji

Lista/tabela batchów w zakładce kalkulacji:
- Kolumny: Typ elementu, Opis, m³, szt., Start, Koniec, Status.
- Prosta wizualizacja Gantt: horizontal bar per batch w timeline (bez zewnętrznej biblioteki Gantt — własny SVG/CSS).
- Import/eksport harmonogramu XLSX.

### 12.4 Strony backend modułu

| URL | Opis |
|-----|------|
| `/project-costing/settings` | Ustawienia modułu (widoczność, PDF config) |
| `/project-costing/segments` | Lista segmentów |
| `/project-costing/segments/[id]` | Edycja segmentu + kategorie + typy elementów |
| `/project-costing/templates` | Lista szablonów |
| `/project-costing/templates/[id]` | Edycja szablonu z siatką linii |
| `/project-costing/price-sources` | Rejest źródeł cennikowych |
| `/project-costing/price-catalog` | Cennik firmy (DataTable + import XLSX) |
| `/project-costing/price-catalog/[id]` | Edycja pozycji cennikowej |
| `/project-costing/calculations` | Lista kalkulacji cross-deal |
| `/project-costing/calculations/[id]` | Szczegóły kalkulacji (standalone) |

---

## 13. Rekomendacja integracji cennikowej

### 13.1 Analiza dostępnych źródeł

#### Sekocenbud (Orgbud-Serwis)

- **Licencja/warunki**: Komercyjne — subskrypcja roczna. Ceny [niezweryfikowane].
- **API**: Brak publicznie udokumentowanego REST API [niezweryfikowane]. Dane dostępne jako pliki XLSX/PDF per kwartał lub przez dedykowane oprogramowanie (Norma PRO).
- **v1**: ❌ Nie — brak API.
- **v2**: Adapter importu XLSX z mapowaniem predefiniowanym dla formatu Sekocenbud → `pc_price_catalog` przez `PriceSourceProvider`.

#### Intercenbud

- **API**: Brak publicznie dostępnego API [niezweryfikowane]. Pliki Excel, format własny.
- **v1**: ❌ Nie.
- **v2**: Analogicznie do Sekocenbud.

#### Bazy norm KNR/KNNR

- **Charakter**: Normatywy ilościowe (nie ceny). Import przez eksport z Norma PRO/Zuzia do CSV.
- **v1**: ❌ Nie (jako automatyczna integracja). Możliwe jako ręczne szablony.
- **v2**: Biblioteka szablonów kalkulacji opartych na normach KNR jako seed data.

#### Własny cennik firmy

- **v1**: ✅ **Tak** — `pc_price_catalog` z `price_source_id = company_catalog`. Wprowadzany ręcznie lub importowany z XLSX/CSV.

### 13.2 Rekomendacja

> **v1**: Własny cennik firmy + import CSV/XLSX + abstrakcja providera (gotowa na v2).
> **v2**: Adaptery pliku Sekocenbud/Intercenbud jako `PriceSourceProvider`.
> **v2+**: Biblioteka szablonów KNR jako seed data.

---

## 14. Fazy, zakres i szacowanie wysiłku

### Faza MVP (~15 dni roboczych)

**Cel**: Ręczna kalkulacja linii na dealu + widoczność + ustawienia + podstawowa analityka.

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (pc_settings, pc_segments, pc_cost_categories, pc_element_types, pc_price_sources, pc_price_catalog, pc_calculations, pc_calculation_lines, pc_schedule_audit_log) | L (3 dni) |
| API CRUD: segments, categories, element-types, price-sources, price-catalog, calculations, calculation-lines, settings | L (3 dni) |
| Siatka `react-data-grid` — zakładka na dealu, sumy, widoczność ACL | L (3 dni) |
| Konfiguracja widoczności (pc_settings, 3 features, redakcja server-side w API) | M (2 dni) |
| Backend strony: segmenty, kategorie, cennik, ustawienia | M (2 dni) |
| ACL features + setup.ts (seed: kategorie, segment precast, ustawienia widoczności) | S (0.5 dnia) |
| Analytics.ts + requiredFeatures per pole + widget TOP/BOTTOM marża | M (1.5 dnia) |

**Suma MVP**: 15 dni roboczych.

### Faza v1 (~18 dni roboczych, po MVP)

**Cel**: Import/eksport, szablony, wersjonowanie, PDF, harmonogram, apply-to-deal, prognoza.

| Zadanie | Rozmiar |
|---------|---------|
| Import XLSX/CSV + kreator mapowania + walidacja (`exceljs`) | L (3 dni) |
| Eksport XLSX/CSV (z redakcją widoczności) + cennik import/eksport | M (2 dni) |
| Szablony kalkulacji + generowanie z szablonu | M (2 dni) |
| Wersjonowanie (duplicate, activate, mark-sent, lock, unlock + audit log) | M (2 dni) |
| `apply-to-deal` via command bus (§8.9) | S (1 dzień) |
| PDF oferty (`@react-pdf/renderer`) + generowanie + attachment + template config | L (3 dni) |
| Harmonogram produkcji (pc_production_batches, CRUD, import/eksport XLSX, widok Gantt-list) | L (3 dni) |
| Widget prognozy produkcji 6 miesięcy (pro-rata z batchów) | M (2 dni) |

**Suma v1**: 18 dni roboczych.

### Faza v2 (~15 dni roboczych, po v1)

**Cel**: Multi-segment, adaptery cennikowe, klin:project, webhook harmonogramu.

| Zadanie | Rozmiar |
|---------|---------|
| Nowe segmenty branżowe (materiał/robocizna/sprzęt/podwykonawca) | S (1 dzień) |
| Adapter importu Sekocenbud/Intercenbud XLSX → `PriceSourceProvider` | M (2 dni) |
| `pc_element_unit_factors` (szt↔m³ per typ elementu) | S (1 dzień) |
| Integracja z `klin:project` (widget sumy projektu, cf_offer_role aggregation) | M (2 dni) |
| Biblioteka szablonów KNR (seed data) | M (2 dni) |
| Konwersja walutowa v2 (integracja `currencies`) | S (1 dzień) |
| Webhook inbound harmonogram (MS Project/zewnętrzne narzędzia) | M (2 dni) |
| Eksport PDF listy/porównania wersji | S (1 dzień) |
| AI-tool: generowanie linii kalkulacji z opisu | L (3 dni) |

**Suma v2**: 15 dni roboczych.

**Łącznie**: ~48 dni roboczych (MVP 15 + v1 18 + v2 15).

---

## 15. Ryzyka

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | `react-data-grid` niezgodność ze stylami DS OM | Średnie | Wysoki | PoC przed v1; custom cell renderers z DS tokenami |
| R2 | `@react-pdf/renderer` ograniczenia typograficzne (polskie znaki, fonty) | Średnie | Średni | Test z polskim tekstem i fontami (np. Source Sans Pro) przed implementacją |
| R3 | Wydajność `recalc` przy 5000 linii na VPS 3.77 GiB | Niskie | Wysoki | Recalc async (queue job) powyżej 500 linii; sync poniżej |
| R4 | Race condition przy równoległych `activate` | Niskie | Wysoki | Transakcja `SERIALIZABLE` lub advisory lock per `deal_id` w serwisie activate |
| R5 | Optimistic lock deala przy `apply-to-deal` — staleness | Średnie | Średni | Serwis pobiera aktualne `deal.updatedAt` tuż przed dispatching command |
| R6 | Spot na stronie `klin:project` może nie istnieć | Nieznane | Średni | Fallback strona `/project-costing/projects/:projectId` |
| R7 | Import XLSX z formułami/scalonymi komórkami (`exceljs`) | Średnie | Niski | Import tylko wartości (nie formuł); informacja dla użytkownika; test na przykładowych plikach klienta |
| R8 | `exceljs` streaming duże pliki: wzrost RAM przy 5000 wierszy | Niskie | Niski | Streaming reader zamiast `workbook.xlsx.read()` dla plików > 2 MB |
| R9 | Scope creep: żądanie ERP/fakturowanie przed MVP | Wysokie | Wysoki | Granica scope: `sales` wyłączony celowo; `project_costing` nie zastępuje ERP |
| R10 | Pro-rata batchów: precyzja przy bardzo krótkich batchach (<3 dni) | Niskie | Niski | Minimum batch duration = 1 dzień; ilości zaokrąglone do 2 miejsc |

---

## 16. Pytania otwarte do Marka

1. **Widok harmonogramu**: Czy prosta wizualizacja Gantt w tabeli (horizontal bar CSS) wystarczy w v1, czy potrzebna pełna biblioteka Gantt z drag-and-drop? Biblioteki Gantt (np. DHTMLX, frappe-gantt) dodają ~200–500 KB.

2. **Spot na `klin:project`**: Czy strona szczegółów `klin:project` (custom entity z Data designer) ma spot na wstrzyknięcie widgetu? Jeśli nie — czy wystarczy link „Idź do projektu" otwierający `/project-costing/projects/:projectId`?

3. **Widoczność kalkulacji między użytkownikami**: Czy `sales` (handlowiec) widzi kalkulacje na wszystkich dealach w organizacji, czy tylko na swoich (filtr po właścicielu deala)?

4. **Szablon PDF — dane firmy**: Skąd pobieramy dane nagłówkowe (NIP, adres, REGON)? Z `pc_settings` (ręcznie wpisywane) czy z profilu tenanta (moduł `directory`)?

5. **Webhook harmonogramu**: Czy integracja z zewnętrznym narzędziem harmonogramowania (MS Project, własne Gantt) jest realna w v1, czy można przesunąć do v2 (v1 = tylko ręczny import XLSX harmonogramu)?

---

## 17. Rozwiązane założenia autonomiczne

| # | Obszar | Założenie | Uzasadnienie |
|---|--------|-----------|--------------|
| A1 | Biblioteka siatki | `adazzle/react-data-grid` v7 (MIT) | Najlżejsza (~50 KB) z natywnym Excel-like UX |
| A2 | Model kosztów | `overhead_rate` = narzut do kosztu; `margin_rate` = marża od ceny; `full_cost = subtotal_cost + overhead`; tryby A/B ceny | Polska praktyka budowlana; konsekwentne nazwy w całej spec |
| A3 | Aktywna kalkulacja | Partial unique index w DB | Gwarancja integralności bez warstwy aplikacyjnej |
| A4 | Catalog module | Nie aktywować v1; własna tabela `pc_element_types` | RAM VPS, prostszy sync |
| A5 | Waluta kalkulacji | = waluta deala (`value_currency`); jednowalutowe v1 | Eliminuje złożoność konwersji |
| A6 | Limity importu | 5000 wierszy / 10 MB | Bezpieczne dla typowych arkuszy prefabrykacji |
| A7 | Auto-save | Debounce 800 ms; batch upsert dla paste | Minimalizuje requesty |
| A8 | Biblioteka XLSX | `exceljs` v4.4.0 (MIT) | `xlsx` npm nie aktualizowany; `exceljs` aktywnie utrzymywany, MIT |
| A9 | PDF rendering | `@react-pdf/renderer` v3 (MIT) | Brak Chromium/Puppeteer; lekki na VPS 3.77 GiB |
| A10 | Odblokowanie | Admin only; tworzy nową wersję, nie edytuje wysłanej | Immutability wersji wysłanych; audit log obowiązkowy |
| A11 | apply-to-deal | Przez `customers.deals.update` command bus (zweryfikowano w kodzie) | Zachowanie historii deala i zdarzeń CRM; zero zmian core |
| A12 | Prognoza produkcji | Pro-rata z batchów harmonogramu; `productionStartAt/EndAt` jako derived | Harmonogram daje granularność; single date range niewystarczający |
| A13 | cf_offer_role | Odczyt tylko (field id: 73f8260a…); brak tworzenia w setup.ts | Field istnieje na produkcji ze 546 dealami = primary |
| A14 | Mockupy UI | Pominięte (`--no-mockups`) | Środowisko VPS; zakładka opisana tekstowo |

---

## 18. Migracje i backward compatibility

Moduł dodaje wyłącznie nowe tabele (`pc_*`). Zero zmian w tabelach `packages/core`. Brak ryzyka backward compatibility dla upstream.

Kolejność migracji: `pc_settings` → `pc_segments` → `pc_cost_categories` → `pc_element_types` → `pc_price_sources` → `pc_price_catalog` → `pc_calculation_templates` + `pc_calculation_template_lines` → `pc_calculations` → `pc_calculation_lines` → `pc_production_batches` → `pc_schedule_audit_log` → `pc_calculation_pdf_attachments` → `pc_import_column_mappings`.

---

## 19. Szkielet plików modułu

```
apps/mercato/src/modules/project_costing/
├── index.ts
├── acl.ts                          # features (10 features)
├── analytics.ts                    # analytics config z requiredFeatures
├── events.ts                       # defineModuleEvents (9 zdarzeń)
├── setup.ts                        # seed: kategorie, segment, ustawienia widoczności
├── di.ts                           # DI: serwisy, price source registry
├── extension-points.ts
├── api/
│   ├── settings/route.ts
│   ├── segments/route.ts
│   ├── cost-categories/route.ts
│   ├── element-types/route.ts
│   ├── price-sources/route.ts
│   ├── price-catalog/route.ts
│   ├── price-catalog/export/route.ts
│   ├── price-catalog/import/route.ts
│   ├── price-catalog/search/route.ts
│   ├── calculation-templates/route.ts
│   ├── calculation-template-lines/[lineId]/route.ts
│   ├── calculations/route.ts
│   ├── calculations/[id]/route.ts
│   ├── calculations/[id]/duplicate/route.ts
│   ├── calculations/[id]/recalc/route.ts
│   ├── calculations/[id]/activate/route.ts
│   ├── calculations/[id]/apply-to-deal/route.ts
│   ├── calculations/[id]/mark-sent/route.ts
│   ├── calculations/[id]/lock/route.ts
│   ├── calculations/[id]/unlock/route.ts
│   ├── calculations/[id]/generate-pdf/route.ts
│   ├── calculations/[id]/export/route.ts
│   ├── calculations/[id]/import/route.ts
│   ├── calculations/[id]/schedule/export/route.ts
│   ├── calculations/[id]/schedule/import/route.ts
│   ├── calculations/[id]/schedule/webhook/route.ts
│   ├── calculation-lines/route.ts
│   ├── calculation-lines/[id]/route.ts
│   ├── calculation-lines/batch/route.ts
│   ├── production-batches/route.ts
│   ├── production-batches/[id]/route.ts
│   ├── calculations/[id]/pdf-attachments/route.ts
│   └── import-column-mappings/route.ts
├── backend/
│   └── project-costing/
│       ├── settings/page.tsx
│       ├── segments/page.tsx + [id]/page.tsx
│       ├── templates/page.tsx + [id]/page.tsx
│       ├── price-sources/page.tsx
│       ├── price-catalog/page.tsx + [id]/page.tsx
│       └── calculations/page.tsx + [id]/page.tsx
├── components/
│   ├── CalculationGrid.tsx         # react-data-grid wrapper
│   ├── CalculationSummary.tsx      # panel podsumowania (z redakcją)
│   ├── ScheduleGanttList.tsx       # widok batchów harmonogramu
│   ├── ImportWizard.tsx
│   ├── VersionSelector.tsx
│   └── PdfTemplateEditor.tsx       # konfiguracja szablonu PDF
├── data/
│   ├── entities.ts
│   └── validators.ts
├── i18n/
│   ├── pl.json
│   └── en.json
├── migrations/
│   └── Migration20261019*.ts
├── widgets/
│   ├── index.ts
│   └── DealCalculationTab.tsx
└── lib/
    ├── calculation.service.ts      # recalc, activate, apply-to-deal (command bus)
    ├── pdf.service.ts              # @react-pdf/renderer
    ├── import.service.ts           # exceljs parsing
    ├── visibility.ts               # applyVisibilityRedaction
    ├── price-source/
    │   ├── provider.interface.ts
    │   ├── registry.ts
    │   └── providers/
    │       └── company-catalog.provider.ts
    └── schedule/
        └── forecast.ts             # pro-rata aggregation
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | Inicjalna wersja (v1 — autonomous, `om-auto-write-spec`) |
| 2026-10-19 | Rewizja (v2 — po przeglądzie Marka): widoczność kosztów/marż/cen (pc_settings + ACL), PDF v1 (@react-pdf/renderer), abstrakcja price-source (provider interface + registry + proweniencja linii), harmonogram produkcji z batchów (pc_production_batches + pro-rata), wyjaśnienie modelu overhead/margin (full_cost, tryby A/B, price_override), apply-to-deal przez command bus (zweryfikowano w kodzie), exceljs zamiast xlsx npm, odblokowanie = nowa wersja (admin + audit log), waluta = waluta deala, cf_offer_role read-only. Aktualizacja wysiłku: MVP 15d, v1 18d, v2 15d. Pytania otwarte skrócone do 5 nierozwiązanych. |
