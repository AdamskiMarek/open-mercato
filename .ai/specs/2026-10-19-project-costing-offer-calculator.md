# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-19 (v3 — podział modułów, tryb C ceny, widoczność scope, dane firmy PDF) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications`, `directory` |
| **Moduł powiązany** | `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`) — **konsumowany** |
| **Wyłączone upstream (nie aktywować)** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## Streszczenie

Moduł `project_costing` dostarcza kalkulator kosztów ofertowych przypiętych do Deali w Open Mercato CRM. Działa jak uproszczony Excel: siatka linii kosztowych z edycją inline (react-data-grid), import/eksport XLSX/CSV (exceljs), szablony per segment, wersjonowanie kalkulacji, abstrakcja źródeł cennikowych (provider registry) oraz zakładka „Kalkulacja" wstrzykiwana na kartę deala.

Dane o harmonogramie produkcji (batche, prognoza m³/szt.) **konsumowane** z modułu `project_schedule` przez API i zdarzenia — `project_costing` nie posiada własnych tabel harmonogramu.

Wyniki kalkulacji zasilają `value_amount` deala przez command bus, eksponowane w analityce dashboardów (TOP/BOTTOM marża). PDF oferty generowany server-side (`@react-pdf/renderer`), przechowywany jako attachment, zawiera dane firmy z profilu organizacji OM uzupełnione o `pc_settings`.

Zero zmian w `packages/core`. Integracja wyłącznie przez extension points OM.

---

## 1. Kontekst i cel

### 1.1 Problem

Firmy z branży budowlanej (v1: prefabrykacja żelbetowa) liczą wyceny w Excelu, a wyniki ręcznie wpisują do CRM. Brak powiązania kalkulacji z Dealem, brak historii wersji, brak kontroli widoczności marż.

### 1.2 Propozycja wartości

- Kalkulacja kosztów bezpośrednio na karcie Deala (zakładka „Kalkulacja").
- Import z istniejących arkuszy XLSX/CSV z kreatorem mapowania kolumn.
- Trzy tryby wyznaczania ceny (A/B/C) — szczegóły w §3.
- Konfigurowalny poziom widoczności kosztów/marż/cen per rola i per kalkulacja (scope: tylko własne lub wszystkie).
- Szablony per segment, wersjonowanie, blokowanie wysłanych wersji.
- PDF oferty dla generalnego wykonawcy — immutable, wersjonowany, bez kosztów/marż dla klienta.
- `apply-to-deal` przez command bus → zachowanie historii deala i zdarzeń CRM.
- Analityka: TOP/BOTTOM marża w dashboardach.
- Harmonogram produkcji i prognoza 6 miesięcy: **konsumowane z `project_schedule`**.

---

## 2. Model danych

### 2.1 Konwencje globalne

- Wielodostępność: `organization_id` + `tenant_id` na każdej tabeli.
- UUID PK: `gen_random_uuid()`.
- Brak bezpośrednich relacji ORM między modułami (tylko FK-id UUID).
- `updated_at` na tabelach edytowalnych (optimistic locking).

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
- `visibility.costs_visible_features` — tablica feature ID uprawnionych do widzenia kosztów (domyślnie `["project_costing.view_costs"]`).
- `visibility.margin_visible_features` — dla marży (domyślnie `["project_costing.view_margin"]`).
- `visibility.prices_visible_features` — dla cen sprzedaży (domyślnie `["project_costing.view_prices"]`).
- `visibility.calculation_scope` — `"all"` (wszyscy w org widzą kalkulacje na wszystkich dealach) lub `"own"` (filtr po właścicielu deala). Domyślnie `"all"`. Szczegóły w §4.
- `default_currency` — domyślna waluta (domyślnie `'PLN'`).
- `default_overhead_rate` — domyślny narzut (domyślnie `0.10`).
- `pdf.validity_days` — ważność oferty PDF (np. `30`).
- `pdf.footer_text` — tekst warunków/stopka (HTML-safe).
- `pdf.contact_email`, `pdf.contact_phone` — dane kontaktowe do PDF (uzupełnienie profilu org).
- `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account` — dane firmy nieobecne w profilu `directory` (patrz §5.3).

#### `pc_cost_categories` — słownik kategorii kosztów

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `code` | `text` NOT NULL | unikalny per org+tenant |
| `label` | `text` NOT NULL | |
| `segment_id` | `uuid` NULL | FK → `pc_segments.id`; NULL = wspólna |
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

#### `pc_element_types` — typy elementów per segment

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_id` | `uuid` NOT NULL | FK → `pc_segments.id` |
| `code` | `text` NOT NULL | np. `floor_slab`, `wall`, `column`, `beam` |
| `label` | `text` NOT NULL | |
| `default_unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `sort_order` | `int` DEFAULT 0 | |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Seed dla `precast_concrete`: strop, ściana, słup, belka, klatka schodowa.

#### `pc_price_sources` — rejestr źródeł cennikowych

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `provider_id` | `text` NOT NULL | np. `company_catalog`, `sekocenbud` |
| `label` | `text` NOT NULL | |
| `price_list_version` | `text` NULL | np. `Q3/2026` |
| `price_list_date` | `date` NULL | |
| `region` | `text` NULL | np. `PL-MZ` |
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
| `segment_id` | `uuid` NULL | |
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

#### `pc_calculation_templates` + `pc_calculation_template_lines`

Struktura analogiczna do kalkulacji: nagłówek (segment, code, label) + linie (kategoria, typ elementu, ilość, unit, unit_cost, unit_price). Patrz v1 spec dla pełnych kolumn (bez zmian od v2).

#### `pc_calculations` — kalkulacja (głowa)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `segment_id` | `uuid` NULL | FK → `pc_segments.id` |
| `code` | `text` NOT NULL | np. `K/2026/001` |
| `label` | `text` NOT NULL | |
| `status` | `text` DEFAULT `'draft'` | `draft` \| `active` \| `sent` \| `locked` \| `archived` |
| `version` | `int` NOT NULL DEFAULT 1 | |
| `is_active_version` | `bool` NOT NULL DEFAULT false | |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | = waluta deala (§3.7) |
| `price_mode` | `text` NOT NULL DEFAULT `'line_prices'` | `line_prices` \| `target_margin` \| `markup` — patrz §3.4 |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | narzut (koszty pośrednie / full_cost) |
| `target_margin_rate` | `numeric(6,4)` NULL | tryb B: docelowa marża % od ceny |
| `markup_rate` | `numeric(6,4)` NULL | tryb C: narzut cenowy na full_cost (cena = full_cost × (1 + markup_rate)) |
| `subtotal_cost` | `numeric(14,2)` NULL | suma kosztów linii (przed narzutem overhead) |
| `overhead_amount` | `numeric(14,2)` NULL | subtotal_cost × overhead_rate |
| `full_cost` | `numeric(14,2)` NULL | subtotal_cost + overhead_amount |
| `subtotal_price` | `numeric(14,2)` NULL | przychód (cena oferty) — wyliczone wg trybu |
| `total_margin` | `numeric(14,2)` NULL | subtotal_price − full_cost |
| `margin_rate` | `numeric(6,4)` NULL | total_margin / subtotal_price |
| `suggested_price` | `numeric(14,2)` NULL | cena informacyjna wg trybu alternatywnego |
| `total_quantity_m3` | `numeric(14,3)` NULL | z `project_schedule` (denorm, odświeżane z harmonogramu) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | z `project_schedule` |
| `production_start_at` | `date` NULL | z `project_schedule` (derived) |
| `production_end_at` | `date` NULL | z `project_schedule` (derived) |
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

`UNIQUE (organization_id, tenant_id, code)`. Partial unique index dla `is_active_version`:
```sql
CREATE UNIQUE INDEX pc_calculations_active_unique
  ON pc_calculations (deal_id, organization_id, tenant_id)
  WHERE is_active_version = true;
```

Constraint: `CHECK (status IN ('draft','active','sent','locked','archived'))`.
Constraint: `CHECK (price_mode IN ('line_prices','target_margin','markup'))`.

#### `pc_calculation_lines` — linie kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` NOT NULL DEFAULT 1 | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NOT NULL DEFAULT 0 | |
| `unit_price` | `numeric(14,4)` NOT NULL DEFAULT 0 | wyliczone lub override |
| `price_override` | `bool` NOT NULL DEFAULT false | true = ręcznie wpisana, nie nadpisywana przy sync cennika |
| `line_cost` | `numeric(14,2)` NULL | denorm: quantity × unit_cost |
| `line_price` | `numeric(14,2)` NULL | denorm: quantity × unit_price |
| `line_margin` | `numeric(14,2)` NULL | line_price − line_cost |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |
| `price_source_id` | `uuid` NULL | FK → `pc_price_sources.id` |
| `price_source_item_code` | `text` NULL | |
| `price_captured_at` | `timestamptz` NULL | |
| `price_captured_unit_cost` | `numeric(14,4)` NULL | archiwum ceny z cennika |
| `price_captured_unit_price` | `numeric(14,4)` NULL | |
| `import_error` | `bool` DEFAULT false | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `pc_calculation_audit_log` — log akcji kalkulacji

*(poprzednia nazwa `pc_schedule_audit_log` — zmieniona w rev 3)*

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
| `meta` | `jsonb` NULL | dodatkowe dane (np. `value_amount` przed/po apply-to-deal) |
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

#### `pc_import_column_mappings`

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

### 2.3 Waluta i zaokrąglenia

- Waluta kalkulacji = waluta deala (§3.7 — założenie rozwiązane).
- Wartości pieniężne: `numeric(14,2)`, zaokrąglenie HALF_EVEN.
- Ceny jednostkowe: `numeric(14,4)`.
- Ilości: `numeric(14,4)`.

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

**`overhead_rate`** = koszty pośrednie jako % kosztu zakupu (amortyzacja form, koszty ogólnozakładowe). Nie zmienia ceny linii — podnosi próg rentowności.

### 3.3 Sumy per kategoria

```
category_subtotal_cost  = SUM(line_cost  WHERE cost_category_id = cat)
category_subtotal_price = SUM(line_price WHERE cost_category_id = cat)
category_margin         = category_subtotal_price − category_subtotal_cost
```

### 3.4 Tryby wyznaczania ceny (`price_mode`)

Trzy wzajemnie wykluczające się tryby — wybrany przez użytkownika w nagłówku kalkulacji.

#### Tryb A — `line_prices` (domyślny)

Cena oferty = suma cen wpisanych w liniach. Input: `unit_price` per linia. Derived: `subtotal_price`, `total_margin`, `margin_rate`.

```
subtotal_price = SUM(line_price)
total_margin   = subtotal_price − full_cost
margin_rate    = total_margin / subtotal_price   (gdy subtotal_price > 0, else 0)
```

Pola informacyjne (nie zmieniają kalkulacji):
```
suggested_price_for_target = full_cost / (1 − target_margin_rate)  [gdy target_margin_rate < 1]
suggested_price_for_markup  = full_cost × (1 + markup_rate)
```

#### Tryb B — `target_margin` (marża docelowa)

Input: `target_margin_rate`. Serwis oblicza `subtotal_price` i **dystrybuuje proporcjonalnie** `unit_price` na linie (proporcja do `line_cost`).

```
subtotal_price = full_cost / (1 − target_margin_rate)   [gdy target_margin_rate ∈ (0, 1))
unit_price[i]  = unit_price_old[i] × (subtotal_price / subtotal_price_old)
               -- lub: unit_price[i] = unit_cost[i] / (1 − target_margin_rate)  [gdy subtotal_price_old = 0]
total_margin   = subtotal_price − full_cost
margin_rate    = target_margin_rate   [tautologia]
```

Warunek: `target_margin_rate < 1` (marża < 100%) — walidacja zod.

#### Tryb C — `markup` (narzut cenowy na full_cost)

Input: `markup_rate` (np. `0.20` = 20% ponad full_cost). Serwis oblicza `subtotal_price` i **dystrybuuje proporcjonalnie** `unit_price` na linie.

```
subtotal_price = full_cost × (1 + markup_rate)
unit_price[i]  = unit_cost[i] × (1 + overhead_rate) × (1 + markup_rate)
               -- lub proporcjonalne jak w trybie B
total_margin   = subtotal_price − full_cost
margin_rate    = markup_rate / (1 + markup_rate)   [z definicji]
```

> **Nazewnictwo (konsekwentne w całej spec)**
>
> | Pole | Definicja | Typ |
> |------|-----------|-----|
> | `overhead_rate` | Koszty pośrednie / narzut na koszt zakupu (zwiększa koszt) | Input |
> | `full_cost` | `subtotal_cost + overhead_amount` | Derived |
> | `markup_rate` | Narzut cenowy na `full_cost` (tryb C — zwiększa cenę ponad full_cost) | Input (tryb C) |
> | `target_margin_rate` | Docelowa marża % od ceny (tryb B) | Input (tryb B) |
> | `subtotal_price` | Cena oferty (przychód) | Derived (A) / Derived (B/C z redistrib.) |
> | `total_margin` | `subtotal_price − full_cost` | Derived |
> | `margin_rate` | `total_margin / subtotal_price` | Derived |
>
> Pola `markup_rate` i `target_margin_rate` **współistnieją** w tabeli (oba nullable). Który jest aktywnym inputem określa `price_mode`. Serwis `recalc` czyta `price_mode` i używa odpowiedniego pola. Pola nieaktywnego trybu zachowują ostatnią wpisaną wartość (informacyjnie), ale nie wpływają na wynik.

### 3.5 Dystrybuowanie cen linii (tryby B i C)

Przy zmianie `price_mode` na B lub C:
1. Serwis `recalc` oblicza nowe `subtotal_price` wg wzoru.
2. Linie bez `price_override = true` otrzymują nowe `unit_price` proporcjonalnie:
   ```
   unit_price[i] = unit_price_old[i] × (subtotal_price_new / subtotal_price_old)
   ```
   Gdy `subtotal_price_old = 0`: równy podział `subtotal_price_new / N`.
3. Linie z `price_override = true` są pomijane — ich ceny pozostają bez zmian. Różnica między oczekiwaną `subtotal_price` a sumą override-linii jest rozdzielana na linie bez override.
4. Wynik: każda linia ma nową `unit_price`, `line_price`, `line_margin`; nagłówek ma nowe `subtotal_price`, `total_margin`, `margin_rate`.

### 3.6 Zachowanie przy ręcznej edycji ceny linii

Jeśli użytkownik ręcznie edytuje `unit_price` linii → `price_override = true`. Linia nie jest nadpisywana przy sync cennika ani przy redistrybuowaniu trybu B/C (patrz §3.5 punkt 3). Reset flagi: ręcznie przez użytkownika lub przy imporcie z szablonu.

### 3.7 Waluta kalkulacji (założenie rozwiązane)

Waluta kalkulacji = `customer_deals.value_currency`. Serwis kopiuje przy tworzeniu kalkulacji. Brak walutyt deala → `pc_settings.default_currency` (domyślnie `PLN`). Jednowalutowe w v1.

### 3.8 Reguła aktywnej wersji i `apply-to-deal`

- Partial unique index wymusza co najwyżej jedną `is_active_version = true` per `(deal_id, organization_id, tenant_id)`.
- `activate`: transakcja — stara `→ false`, nowa `→ true`.
- `apply-to-deal`: osobne wywołanie; aktualizuje `customer_deals.value_amount = subtotal_price` przez command bus (szczegóły: §8.7). Zapisuje wpis w `pc_calculation_audit_log`.

### 3.9 Odblokowanie kalkulacji (założenie rozwiązane)

Admin only (`project_costing.admin`). Odblokowanie tworzy **nową wersję** (`version += 1`, `status = 'draft'`, kopia linii). Oryginał: status `locked`/`sent`, nienaruszony. Wpis w `pc_calculation_audit_log`: `action = 'unlocked'`, `reason` obowiązkowy, `performed_by`.

### 3.10 Sumy z harmonogramu (`project_schedule`)

Pola `total_quantity_m3`, `total_quantity_pcs`, `production_start_at`, `production_end_at` w `pc_calculations` to denormalizacja z `project_schedule`. Serwis `project_costing` subskrybuje zdarzenia `project_schedule.batch.updated` i `project_schedule.schedule.activated` przez subscriber (bez importu z modułu `project_schedule` — wyłącznie przez event bus i HTTP API call do `/api/project-schedule/schedules/:id/summary`).

### 3.11 `cf_offer_role` i reguła sumy projektu

`cf_offer_role` (id: `73f8260a-94c2-42d1-abc4-c08c4177be9f`): moduł **tylko odczytuje** przez API entities. Reguła:
```
project_total = SUM(deal.value_amount)
  WHERE cf_offer_role = 'primary'
    AND deal.status NOT IN ('lost', 'archived')
```
Deale `alternative` widoczne w tabeli projektu ale nie w sumie.

---

## 4. Widoczność kalkulacji i kosztów/marż/cen

### 4.1 Scope widoczności kalkulacji

Sterowany przez `pc_settings.visibility.calculation_scope`:
- `"all"` (domyślnie): użytkownik z `project_costing.view` widzi kalkulacje na wszystkich dealach w organizacji.
- `"own"`: użytkownik widzi tylko kalkulacje powiązane z dealami, których jest właścicielem (`customer_deals.owner_id = current_user_id` lub powiązany przez `customer_deal_person_links` z aktywnym userem).

Wymuszenie server-side: serwis list/detail/export/PDF/analytics filtruje po właścicielu gdy `calculation_scope = "own"` i requester nie ma `project_costing.admin`.

Użytkownicy z `project_costing.admin` zawsze widzą wszystkie kalkulacje w org.

### 4.2 Widoczność pól (koszty / marże / ceny)

Trzy niezależne wymiary, sterowane przez `pc_settings.visibility.*_visible_features`:

| Wymiar | Feature | Domyślna rola |
|--------|---------|---------------|
| Koszty (`unit_cost`, `line_cost`, `full_cost`, `overhead_amount`) | `project_costing.view_costs` | admin, manager |
| Marże (`total_margin`, `margin_rate`, `line_margin`) | `project_costing.view_margin` | admin, manager |
| Ceny sprzedaży (`unit_price`, `line_price`, `subtotal_price`) | `project_costing.view_prices` | admin, manager, sales |

### 4.3 Wymuszenie server-side

```typescript
// lib/visibility.ts
function applyVisibilityRedaction(response: CalculationResponse, features: string[], settings: VisibilitySettings) {
  if (!hasAnyFeature(features, settings.costsVisibleFeatures)) {
    response.unitCost = null; response.lineCost = null;
    response.subtotalCost = null; response.fullCost = null; response.overheadAmount = null;
  }
  if (!hasAnyFeature(features, settings.marginVisibleFeatures)) {
    response.lineMargin = null; response.totalMargin = null; response.marginRate = null;
  }
  if (!hasAnyFeature(features, settings.pricesVisibleFeatures)) {
    response.unitPrice = null; response.linePrice = null; response.subtotalPrice = null;
  }
  return response
}
```

Redakcja stosowana: API response, eksport XLSX/CSV (kolumny pomijane), PDF (zawsze bez kosztów/marż dla klienta), analytics `requiredFeatures`.

---

## 5. PDF oferty

### 5.1 Wymagania

- Szablon: logo + dane firmy, numer oferty, data, ważność (z `pdf.validity_days`), dane odbiorcy (z deala + firmy z `customers`), tabela pozycji (label, qty, unit, unit_price, line_price), warunki (`pdf.footer_text`), podpis.
- PDF klienta **zawsze bez** kosztów, narzutu, marży — strukturalnie wykluczone z szablonu.
- Immutable po `sent`/`locked`. Wersjonowany: każde wygenerowanie → `pc_calculation_pdf_attachments`, poprzednie `is_latest → false`.

### 5.2 Renderowanie server-side

**Biblioteka**: `@react-pdf/renderer` v3 (MIT, ~300 KB bez Chromium).

Uzasadnienie: brak Puppeteer/Chromium (~300 MB RAM — wykluczone na VPS 3.77 GiB). Pure Node.js, React components, utrzymywalny szablon.

### 5.3 Dane firmy na PDF

**Dostępne w `directory` (zweryfikowane w kodzie)**:
- `Organization.name` (`packages/core/src/modules/directory/data/entities.ts`, pole `name`)
- `Organization.logoUrl` (`packages/core/src/modules/directory/data/entities.ts`, pole `logo_url`)

**Nieobecne w `directory`** (brak w modelu `Organization` i `Tenant`): adres, NIP/tax_id, REGON, numer rachunku bankowego, telefon, email firmy.

**Rozwiązanie bez zmian w `packages/core`**: brakujące pola przechowywane w `pc_settings` (klucze `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account`, `pdf.contact_email`, `pdf.contact_phone`). Edytowalne w `/project-costing/settings` → zakładka „PDF / Dane firmy".

Serwis PDF (`lib/pdf.service.ts`) odczytuje:
1. `Organization.name` i `Organization.logoUrl` przez `GET /api/directory/organizations/:id` (server-side fetch, authorization z DI token).
2. Pozostałe dane z `pc_settings`.

### 5.4 Endpoint generowania

```
POST /api/project-costing/calculations/:id/generate-pdf
```
Odpowiedź: `{ attachmentId, url }`. Generowanie asynchroniczne przy >200 liniach (job ID, polling/SSE).

---

## 6. Import / Eksport

### 6.1 Biblioteka XLSX

**Biblioteka**: `exceljs` v4.4.0 (MIT, ostatnia aktualizacja 2024-12-20).

Uzasadnienie: npm `xlsx` zatrzymany na v0.18.5 (brak aktywnego developmentu na npm od 2023; nowe wersje SheetJS wymagają instalacji z CDN tarball — niestandardowe w yarn workspace monorepo). `exceljs` jest aktywnie utrzymywaną alternatywą MIT z obsługą `.xlsx`, `.csv`, streamingu, wielu arkuszy.

### 6.2 Import XLSX/CSV — kreator mapowania

1. Upload (max 10 MB, max 5000 wierszy — §6.5).
2. Podgląd: pierwsze 5 wierszy.
3. Mapowanie kolumn: `label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `notes`.
4. Zapis mapowania: `pc_import_column_mappings`.
5. Walidacja: typy, znane kody kategorii/jednostek.
6. Podgląd po mapowaniu z flagami błędów.
7. Zatwierdzenie: `POST /api/project-costing/calculations/:id/import` (tryb: dołącz / zastąp).

Błędne wiersze → `import_error = true`, widoczne w siatce.

### 6.3 Eksport XLSX

`GET /api/project-costing/calculations/:id/export?format=xlsx|csv`

XLSX — wieloarkuszowy (kolumny redagowane wg widoczności — §4.3):
- Arkusz 1: linie kalkulacji.
- Arkusz 2: sumy per kategoria.
- Arkusz 3: nagłówek (meta, marża — jeśli uprawnienie).

### 6.4 Limity importu (założenie rozwiązane)

Max **5000 wierszy** / **10 MB** per import. Timeout parsowania 30 s. Uzasadnienie: typowe arkusze prefabrykacji 50–500 wierszy; 5000 = bezpieczny zapas; powyżej → błąd z komunikatem.

---

## 7. Abstrakcja źródeł cennikowych (Price Source Provider)

### 7.1 Interfejs providera

```typescript
// lib/price-source/provider.interface.ts
export interface PriceSourceProvider {
  providerId: string
  label: string
  search(query: PriceSourceQuery, ctx: ProviderContext): Promise<PriceSourceItem[]>
  getByCode(code: string, ctx: ProviderContext): Promise<PriceSourceItem | null>
}
export type PriceSourceItem = {
  code: string; externalCode?: string; label: string
  unitId?: string; unitCost?: number; unitPrice?: number; currency: string
  priceListVersion?: string; priceListDate?: string; region?: string
}
```

Provider `company_catalog` w v1 czyta z `pc_price_catalog`. Adaptery Sekocenbud/Intercenbud w v2.

### 7.2 Proweniencja ceny

Na każdej linii kalkulacji: `price_source_id`, `price_source_item_code`, `price_captured_at`, `price_captured_unit_cost/price` — archiwum ceny w momencie dodania. Zmiany cennika nie wpływają retroaktywnie na kalkulacje.

---

## 8. API

Prefix: `/api/project-costing/`. Konwencje OM: `makeCrudRoute`, zod validators. Optimistic locking na `PATCH`/`DELETE` (`If-Unmodified-Since`).

### 8.1 Ustawienia

```
GET   /api/project-costing/settings
PATCH /api/project-costing/settings
```

### 8.2 Segmenty, kategorie, typy elementów

```
GET/POST /api/project-costing/segments
PATCH/DELETE /api/project-costing/segments/:id
GET/POST /api/project-costing/cost-categories?segmentId=
PATCH/DELETE /api/project-costing/cost-categories/:id
GET/POST /api/project-costing/element-types?segmentId=
PATCH/DELETE /api/project-costing/element-types/:id
```

### 8.3 Źródła cennikowe i cennik

```
GET/POST /api/project-costing/price-sources
PATCH/DELETE /api/project-costing/price-sources/:id
GET/POST /api/project-costing/price-catalog?priceSourceId=&segmentId=&categoryId=&q=
PATCH/DELETE /api/project-costing/price-catalog/:id
GET /api/project-costing/price-catalog/export?format=xlsx|csv
POST /api/project-costing/price-catalog/import
POST /api/project-costing/price-catalog/search
```

### 8.4 Szablony

```
GET/POST /api/project-costing/calculation-templates?segmentId=
GET/PATCH/DELETE /api/project-costing/calculation-templates/:id
GET/POST /api/project-costing/calculation-templates/:id/lines
PATCH/DELETE /api/project-costing/calculation-template-lines/:lineId
```

### 8.5 Kalkulacje — CRUD i lifecycle

```
GET/POST  /api/project-costing/calculations?dealId=&status=&isActiveVersion=
GET/PATCH/DELETE /api/project-costing/calculations/:id

POST /api/project-costing/calculations/:id/duplicate
POST /api/project-costing/calculations/:id/recalc        (przelicz linie + sumy; aplikuje price_mode)
POST /api/project-costing/calculations/:id/activate
POST /api/project-costing/calculations/:id/mark-sent
POST /api/project-costing/calculations/:id/lock
POST /api/project-costing/calculations/:id/unlock        (admin only; tworzy nową wersję)
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
POST /api/project-costing/calculation-lines/batch   (bulk upsert — auto-save siatki)
```

### 8.7 `apply-to-deal` — mechanizm (zweryfikowany w kodzie)

**Zweryfikowane w kodzie**:
- Command `customers.deals.update` zarejestrowany: `packages/core/src/modules/customers/commands/deals.ts`:745
- `CommandBus` w DI: `packages/shared/src/lib/di/container.ts`:218 (`asValue(new CommandBus())`)
- Dispatch przez `makeCrudRoute`: `packages/shared/src/lib/crud/factory.ts`:2372

```typescript
// lib/calculation.service.ts — applyToDeal
const commandBus = ctx.container.resolve('commandBus') as CommandBus
const deal = await em.findOneOrFail(/* customer_deals */ { id: calculation.dealId, ... })
await commandBus.execute({
  commandId: 'customers.deals.update',
  input: { id: calculation.dealId, valueAmount: calculation.subtotalPrice },
  ctx,
})
await logAudit(calculationId, 'apply_to_deal', { meta: { valueAmount: calculation.subtotalPrice } }, ctx)
```

Efekty: historia deala (`audit_log`), zdarzenie `customers.deal.updated`, cache/search invalidation — zero zmian w `packages/core`.

### 8.8 Mapowania importu

```
GET/POST /api/project-costing/import-column-mappings
PATCH/DELETE /api/project-costing/import-column-mappings/:id
```

---

## 9. Uprawnienia (ACL)

| Feature ID | Opis |
|-----------|------|
| `project_costing.view` | Podgląd kalkulacji (z uwzględnieniem `calculation_scope`) |
| `project_costing.view_costs` | Widzenie kosztów |
| `project_costing.view_margin` | Widzenie marży |
| `project_costing.view_prices` | Widzenie cen sprzedaży |
| `project_costing.edit` | Edycja linii, wersji (bez locked/sent) |
| `project_costing.admin` | Ustawienia, cennik, segmenty, odblokowanie, widzi wszystko niezależnie od scope |
| `project_costing.apply_to_deal` | Aktualizacja `value_amount` deala |
| `project_costing.import` | Import XLSX/CSV |
| `project_costing.export` | Eksport XLSX/CSV/PDF |
| `project_costing.lock` | Blokowanie / oznaczanie jako wysłane |

Domyślne przypisania w `setup.ts`:
- `admin` → wszystkie.
- `manager` → `view`, `view_costs`, `view_margin`, `view_prices`, `edit`, `apply_to_deal`, `import`, `export`, `lock`.
- `sales` → `view`, `view_prices`, `edit`, `import`, `export`.

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
- Subscriber na `customers.deal.updated` → jeśli zmiana `value_currency` → update `pc_calculations.currency`.

### 10.3 Integracja z `project_schedule`

Subskrypcja: `project_schedule.batch.updated`, `project_schedule.schedule.activated` → update `pc_calculations.(total_quantity_m3, total_quantity_pcs, production_start_at, production_end_at)` przez HTTP API call do `GET /api/project-schedule/schedules/:id/summary`.

Dane harmonogramu w zakładce deala: widget `project_costing` wyświetla miniaturę prognozy m³/szt. (link do widgetu `project_schedule`). Pełny Gantt: odrębna zakładka z `project_schedule/widgets/DealScheduleTab.tsx`.

### 10.4 Integracja z `klin:project`

Odczyt `cf_offer_role` przez API entities (read-only). Reguła sumy projektu: §3.11. Widget projektu: osobna strona `/project-costing/projects/:projectId` (fallback gdy spot na `klin:project` nie istnieje — do weryfikacji w implementacji).

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
      id:           { dbColumn: 'id',              type: 'uuid' },
      dealId:       { dbColumn: 'deal_id',         type: 'uuid' },
      segmentId:    { dbColumn: 'segment_id',      type: 'uuid' },
      status:       { dbColumn: 'status',          type: 'text' },
      priceMode:    { dbColumn: 'price_mode',      type: 'text' },
      currency:     { dbColumn: 'currency',        type: 'text' },
      // Koszty — wymagają project_costing.view_costs
      subtotalCost:   { dbColumn: 'subtotal_cost',   type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      overheadAmount: { dbColumn: 'overhead_amount', type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      fullCost:       { dbColumn: 'full_cost',       type: 'numeric', requiredFeatures: ['project_costing.view_costs'] },
      // Ceny — wymagają view_prices
      subtotalPrice:  { dbColumn: 'subtotal_price',  type: 'numeric', requiredFeatures: ['project_costing.view_prices'] },
      // Marża — wymaga view_margin
      totalMargin:    { dbColumn: 'total_margin',    type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      marginRate:     { dbColumn: 'margin_rate',     type: 'numeric', requiredFeatures: ['project_costing.view_margin'] },
      // Ilości produkcyjne — publiczne
      totalQuantityM3:  { dbColumn: 'total_quantity_m3',  type: 'numeric' },
      totalQuantityPcs: { dbColumn: 'total_quantity_pcs', type: 'numeric' },
      createdAt:        { dbColumn: 'created_at',         type: 'timestamp' },
      isActiveVersion:  { dbColumn: 'is_active_version',  type: 'boolean' },
    },
  },
]
```

Widget TOP/BOTTOM marża: encja `project_costing:calculations`, filtr `isActiveVersion = true`, metryka `marginRate`, groupBy `dealId`, sortowanie w widgecie. Widgety ukrywają pola z `requiredFeatures` których user nie posiada.

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs`. Widget: `project_costing/widgets/DealCalculationTab.tsx`.

Zawartość:
- Nagłówek: dropdown wersji kalkulacji, status badge, przyciski: „Nowa wersja", „Importuj", „Eksportuj XLSX", „Generuj PDF".
- Panel trybu ceny: wybór A/B/C, pola `overhead_rate`, `target_margin_rate` lub `markup_rate` (zależnie od trybu).
- Siatka linii kosztowych (§12.2).
- Panel podsumowania: sumy per kategoria, `full_cost`, `subtotal_price`, `total_margin`, `margin_rate` — redagowane wg §4.
- Miniatura prognozy m³/szt. z `project_schedule` (link do zakładki harmonogramu).
- Przycisk „Zastosuj do Deala".

### 12.2 Siatka kosztów — `react-data-grid` v7 (MIT, ~50 KB)

Uzasadnienie: najlżejsza opcja z natywnym Excel-like UX (klawiatura, kopiuj/wklej); brak MUI; OM używa Tailwind/DS tokenów.

Kolumny (widoczność sterowana przez ACL §4.2):

| Kolumna | Edytowalna | Widoczność |
|---------|-----------|-----------|
| Lp. | Nie | zawsze |
| Kategoria | Tak | zawsze |
| Typ elementu | Tak | zawsze |
| Opis | Tak | zawsze |
| Ilość | Tak | zawsze |
| J.m. | Tak | zawsze |
| Koszt jedn. | Tak | `view_costs` |
| Cena jedn. | Tak (z flagą `price_override`) | `view_prices` |
| Wartość kosztu | Nie | `view_costs` |
| Wartość ceny | Nie | `view_prices` |
| Marża zł | Nie | `view_margin` |
| Marża % | Nie | `view_margin` |
| Źródło ceny | Nie (info ikona) | zawsze |
| Akcje | Nie | zawsze |

Auto-save: debounce 800 ms. Kopiuj/wklej: tab-separated (kompatybilny Excel).

### 12.3 Strony backend modułu

| URL | Opis |
|-----|------|
| `/project-costing/settings` | Ustawienia (widoczność, scope, PDF / dane firmy) |
| `/project-costing/segments` + `[id]` | Segmenty + kategorie + typy elementów |
| `/project-costing/templates` + `[id]` | Szablony kalkulacji |
| `/project-costing/price-sources` | Rejestr źródeł cennikowych |
| `/project-costing/price-catalog` + `[id]` | Cennik firmy |
| `/project-costing/calculations` + `[id]` | Lista i szczegóły kalkulacji cross-deal |

---

## 13. Rekomendacja integracji cennikowej

### v1 — własny cennik firmy

`pc_price_catalog` z `price_source_id = company_catalog`. Wprowadzany ręcznie lub importem XLSX/CSV. Brak zewnętrznych licencji.

### v2 — adaptery pliku Sekocenbud/Intercenbud

Sekocenbud i Intercenbud: brak publicznie dostępnego REST API [niezweryfikowane]. Pliki XLSX/PDF per kwartał. Adapter importu XLSX z predefiniowanym mapowaniem kolumn → `pc_price_catalog` przez `PriceSourceProvider`. Licencje komercyjne — koszt subskrypcji [niezweryfikowane].

### v2+ — bazy norm KNR/KNNR

Biblioteka szablonów kalkulacji opartych na normach KNR jako seed data (`pc_calculation_templates`). Historyczne KNR w domenie publicznej.

---

## 14. Fazy i szacowanie wysiłku

### `project_costing` — MVP (~14 dni roboczych)

**Cel**: Ręczna kalkulacja (tryby A/B/C), widoczność ACL, ustawienia, podstawowa analityka.

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (wszystkie tabele `pc_*`) | L (3 dni) |
| API CRUD: ustawienia, segmenty, kategorie, typy elementów, price-sources, price-catalog, calculations, calculation-lines | L (3 dni) |
| Siatka `react-data-grid` — zakładka deala, sumy, tryby A/B/C, widoczność | L (3 dni) |
| Widoczność (3 features, redakcja server-side, `calculation_scope`) | M (2 dni) |
| Backend strony: ustawienia, segmenty, cennik | M (1.5 dnia) |
| ACL + setup.ts (seed: kategorie, segment precast, ustawienia) | S (0.5 dnia) |
| Analytics.ts + `requiredFeatures` + widget TOP/BOTTOM marża | S (1 dzień) |

**Suma MVP `project_costing`**: 14 dni roboczych.

### `project_costing` — v1 (~15 dni roboczych, po MVP)

**Cel**: Import/eksport, szablony, wersjonowanie, PDF, apply-to-deal.

| Zadanie | Rozmiar |
|---------|---------|
| Import XLSX/CSV + kreator mapowania + walidacja (`exceljs`) | L (3 dni) |
| Eksport XLSX/CSV (redakcja widoczności) + cennik import/eksport | M (2 dni) |
| Szablony kalkulacji + generowanie z szablonu | M (2 dni) |
| Wersjonowanie (duplicate, activate, mark-sent, lock, unlock + audit log) | M (2 dni) |
| `apply-to-deal` via command bus | S (1 dzień) |
| PDF oferty (`@react-pdf/renderer`) + dane firmy z dir + pc_settings | L (3 dni) |
| Widok porównania wersji kalkulacji | S (1 dzień) |
| i18n PL/EN + testy jednostkowe serwisów | S (1 dzień) |

**Suma v1 `project_costing`**: 15 dni roboczych.

### `project_costing` — v2 (~12 dni roboczych, po v1)

**Cel**: Multi-segment, adaptery cennikowe, `klin:project`.

| Zadanie | Rozmiar |
|---------|---------|
| Nowe segmenty branżowe + kategorie | S (1 dzień) |
| Adapter importu Sekocenbud/Intercenbud XLSX | M (2 dni) |
| `pc_element_unit_factors` (szt↔m³) | S (1 dzień) |
| Integracja `klin:project` (widget sumy projektu, cf_offer_role aggregation) | M (2 dni) |
| Biblioteka szablonów KNR (seed data) | M (2 dni) |
| Konwersja walutowa v2 (`currencies`) | S (1 dzień) |
| AI-tool: generowanie linii z opisu projektu | L (3 dni) |

**Suma v2 `project_costing`**: 12 dni roboczych.

### Podsumowanie zbiorcze (oba moduły)

| Moduł | MVP | v1 | v2 | Suma |
|-------|-----|----|----|------|
| `project_costing` | 14 d | 15 d | 12 d | 41 d |
| `project_schedule` | 5 d | 8 d | 7 d | 20 d |
| **Łącznie** | **19 d** | **23 d** | **19 d** | **61 d** |

---

## 15. Ryzyki

| # | Ryzyko | P-stwo | Wpływ | Mitygacja |
|---|--------|--------|-------|-----------|
| R1 | `react-data-grid` niezgodność ze stylami DS OM | Średnie | Wysoki | PoC przed v1; custom cell renderers z DS tokenami |
| R2 | `@react-pdf/renderer` ograniczenia typograficzne (polskie znaki, fonty) | Średnie | Średni | Test z polskim tekstem + fontami (Source Sans Pro) przed implementacją |
| R3 | Wydajność `recalc` przy 5000 linii na VPS 3.77 GiB | Niskie | Wysoki | Recalc async (queue job) >500 linii; sync ≤500 |
| R4 | Redistrybuowanie cen linii (tryby B/C) przy `price_override` — rounding drift | Średnie | Niski | Ostatnia linia (bez override) absorbuje rounding remainder; test precyzji |
| R5 | Race condition przy równoległych `activate` (is_active_version) | Niskie | Wysoki | Transakcja `SERIALIZABLE` lub advisory lock per `deal_id` |
| R6 | Optimistic lock deala przy `apply-to-deal` — staleness | Średnie | Średni | Serwis pobiera aktualne `deal.updatedAt` tuż przed dispatch command |
| R7 | Spot `klin:project` może nie istnieć | Nieznane | Średni | Fallback strona `/project-costing/projects/:projectId` |
| R8 | `exceljs` streaming przy plikach >2 MB — wzrost RAM | Niskie | Niski | Streaming reader dla plików >2 MB |
| R9 | Dane PDF firmy: użytkownik nie skonfiguruje `pc_settings.pdf.*` — PDF wyjdzie bez NIP/adresu | Wysokie | Niski | Onboarding wizard krok „Skonfiguruj dane firmy dla PDF"; ostrzeżenie przy generate-pdf gdy brakuje pól |

---

## 16. Pytania otwarte do Marka

1. **Spot `klin:project`**: Czy strona szczegółów `klin:project` (custom entity) ma spot na wstrzyknięcie widgetu modułu? Jeśli nie — czy wystarczy osobna strona `/project-costing/projects/:projectId`?

2. **PDF krok onboarding**: Czy moduł powinien dodać krok onboardingowy „Uzupełnij dane firmy dla PDF" (adres, NIP, itd.) do kreatora pierwszego uruchomienia (`onboarding` module)?

3. **Tryb ceny B/C — redistrybuowanie linii**: Przy przejściu na tryb B lub C linia z `price_override = true` nie zmienia ceny. Czy to akceptowalne, że rzeczywista `subtotal_price` może różnić się od `target_margin_rate`-implied ceny gdy override-linie mają nieoptymalną cenę? (Spec definiuje tak w §3.5 — potwierdzenie.)

---

## 17. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Siatka: `react-data-grid` v7 (MIT, ~50 KB) | Najlżejsza z natywnym Excel-like UX; brak MUI w OM |
| A2 | Tryby A/B/C ceny: A = suma linii, B = target_margin, C = markup na full_cost | Trzy jasno oddzielone modele — łatwiej w UI niż jeden hybrydowy input |
| A3 | Redistrybuowanie cen linii (tryb B/C): proporcjonalnie do line_cost, override linie pomijane | Minimalizuje zaburzenie istniejących proporcji cen |
| A4 | Partial unique index dla `is_active_version` | DB-level constraint zamiast soft check w aplikacji |
| A5 | Catalog module nie aktywowany; własna tabela `pc_element_types` | RAM VPS, prostszy sync |
| A6 | Waluta kalkulacji = waluta deala | Eliminuje konwersje w v1 |
| A7 | Limity importu: 5000 wierszy / 10 MB | Bezpieczne dla typowych arkuszy prefabrykacji |
| A8 | Auto-save: debounce 800 ms, batch upsert dla paste | Minimalizuje requesty HTTP |
| A9 | Biblioteka XLSX: `exceljs` v4.4.0 (MIT) | `xlsx` npm nieaktualizowane; `exceljs` aktywny MIT |
| A10 | PDF: `@react-pdf/renderer` v3 (MIT) | Brak Chromium/Puppeteer; lekki na VPS |
| A11 | Odblokowanie: admin only; tworzy nową wersję + `pc_calculation_audit_log` | Immutability wysłanych wersji; audit trail |
| A12 | `apply-to-deal`: command bus `customers.deals.update` (zweryfikowano w kodzie) | Historia deala + CRM events; zero zmian core |
| A13 | `cf_offer_role`: read-only (id `73f8260a-94c2-42d1-abc4-c08c4177be9f`) | Pole istnieje na produkcji ze 546 dealami = primary |
| A14 | Dane firmy PDF: `Organization.name` + `Organization.logoUrl` z directory; reszta z `pc_settings` | `Organization` entity nie ma adresu/NIP; `pc_settings` = fallback bez zmian core |
| A15 | `calculation_scope`: domyślnie `"all"` | Backward-compatible; firmy mogą zmienić na `"own"` w ustawieniach |
| A16 | Harmonogram prognoza: konsumowana z `project_schedule` przez API + events | Podział modułów per decyzja Marka |
| A17 | Mockupy UI: pominięte (`--no-mockups`) | Środowisko VPS |

---

## 18. Migracje i backward compatibility

Moduł dodaje wyłącznie nowe tabele (`pc_*`). Zero zmian w `packages/core`. Brak ryzyka backward compatibility dla upstream.

Kolejność migracji: `pc_settings` → `pc_segments` → `pc_cost_categories` → `pc_element_types` → `pc_price_sources` → `pc_price_catalog` → `pc_calculation_templates` + `pc_calculation_template_lines` → `pc_calculations` → `pc_calculation_lines` → `pc_calculation_audit_log` → `pc_calculation_pdf_attachments` → `pc_import_column_mappings`.

---

## 19. Szkielet plików modułu

```
apps/mercato/src/modules/project_costing/
├── index.ts
├── acl.ts                          # 10 features
├── analytics.ts                    # requiredFeatures per pole
├── events.ts
├── setup.ts                        # seed: kategorie, segment precast, pc_settings
├── di.ts
├── extension-points.ts
├── api/
│   ├── settings/route.ts
│   ├── segments/route.ts + [id]/route.ts
│   ├── cost-categories/route.ts + [id]/route.ts
│   ├── element-types/route.ts + [id]/route.ts
│   ├── price-sources/route.ts + [id]/route.ts
│   ├── price-catalog/route.ts + [id]/route.ts
│   ├── price-catalog/export/route.ts + import/route.ts + search/route.ts
│   ├── calculation-templates/route.ts + [id]/route.ts
│   ├── calculation-template-lines/[lineId]/route.ts
│   ├── calculations/route.ts + [id]/route.ts
│   ├── calculations/[id]/{duplicate,recalc,activate,mark-sent,lock,unlock,apply-to-deal,generate-pdf,export,import,pdf-attachments}/route.ts
│   ├── calculation-lines/route.ts + [id]/route.ts + batch/route.ts
│   └── import-column-mappings/route.ts
├── backend/project-costing/
│   ├── settings/page.tsx
│   ├── segments/page.tsx + [id]/page.tsx
│   ├── templates/page.tsx + [id]/page.tsx
│   ├── price-sources/page.tsx
│   ├── price-catalog/page.tsx + [id]/page.tsx
│   └── calculations/page.tsx + [id]/page.tsx
├── components/
│   ├── CalculationGrid.tsx          # react-data-grid
│   ├── CalculationSummary.tsx       # panel podsumowania (z redakcją)
│   ├── PriceModeSelector.tsx        # wybór trybu A/B/C
│   ├── ImportWizard.tsx
│   ├── VersionSelector.tsx
│   └── PdfTemplateEditor.tsx
├── data/entities.ts + validators.ts
├── i18n/pl.json + en.json
├── migrations/Migration20261019*.ts
├── subscribers/
│   ├── scheduleUpdated.ts           # nasłuchuje project_schedule.batch.updated
│   └── dealUpdated.ts               # nasłuchuje customers.deal.updated (currency sync)
├── widgets/index.ts + DealCalculationTab.tsx
└── lib/
    ├── calculation.service.ts        # recalc (tryby A/B/C), activate, apply-to-deal, unlock
    ├── pdf.service.ts                # @react-pdf/renderer + directory API call
    ├── import.service.ts             # exceljs
    ├── visibility.ts                 # applyVisibilityRedaction, getCalculationScope
    └── price-source/
        ├── provider.interface.ts
        ├── registry.ts
        └── providers/company-catalog.provider.ts
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | v1 — inicjalna spec (autonomous, `om-auto-write-spec`) |
| 2026-10-19 | v2 — rewizja: widoczność (pc_settings + 3 ACL features), PDF v1 (@react-pdf/renderer), price-source provider abstraction, harmonogram z batchów, overhead/margin model, apply-to-deal command bus, exceljs, odblokowanie = nowa wersja |
| 2026-10-19 | v3 — podział modułów: harmonogram wydzielony do `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`); dodanie trybu C ceny (`markup_rate`); przemianowanie `pc_schedule_audit_log` → `pc_calculation_audit_log`; `calculation_scope` (all/own) per tenant; dane firmy PDF z `directory` (name+logo) + `pc_settings` (adres, NIP etc. — gap w `Organization` entity); przekrojowe szacunki effort (project_costing 14+15+12=41d + project_schedule 5+8+7=20d = 61d łącznie); pytania otwarte skrócone do 3 |
