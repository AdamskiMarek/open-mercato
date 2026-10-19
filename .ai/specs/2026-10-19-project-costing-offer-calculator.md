# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications` |
| **Wyłączone upstream (nie aktywować)** | `sales`, `workflows`, `catalog` (v1), `business_rules` |

---

## Streszczenie

Moduł `project_costing` dodaje kalkulator kosztów ofertowych przypiętych do Deali w Open Mercato CRM. Działa jak uproszczony Excel: siatka linii kosztowych z edycją inline, import/eksport XLSX/CSV, szablony per segment, wersjonowanie kalkulacji oraz zakładka „Kalkulacja" wstrzykiwana na kartę deala. Wyniki (cena oferty, koszt, marża %) zasilają pole `value_amount` deala i silnik dashboardów, umożliwiając widgety TOP/BOTTOM marża i prognozę produkcji na 6 miesięcy.

Moduł żyje wyłącznie w `apps/mercato/src/modules/project_costing` – zero zmian w `packages/core`. Integracja wyłącznie przez punkty rozszerzeń OM: injection spots, events, interceptors, `analytics.ts`.

---

## 1. Kontekst i cel

### 1.1 Problem

Firmy z branży budowlanej (v1: prefabrykacja żelbetowa) liczą wyceny w Excelu, a wyniki przepisują ręcznie do CRM-u. Brak powiązania kalkulacji z Dealem i brak historii wersji.

### 1.2 Propozycja wartości

- Kalkulacja kosztów bezpośrednio na karcie Deala (zakładka „Kalkulacja").
- Import z istniejących arkuszy XLSX/CSV z kreatorem mapowania kolumn.
- Automatyczne wyliczenie marży, narzutu, przeliczenie wartości Deala.
- Szablony per segment (prefabrykacja: stropy/ściany/słupy/belki × m³, z typowymi stawkami materiałów i robocizny).
- Wersjonowanie kalkulacji (historia, oznaczenie wysłanej klientowi, porównanie).
- Dashboardy: ranking deali wg marży (TOP/BOTTOM) i prognoza produkcji na 6 miesięcy.

### 1.3 Zakres (w spec, poza scope implementacji)

Spec **nie** scaffolduje kodu aplikacji. Definiuje model, API, UI, ACL i integracje wymagane do implementacji.

---

## 2. Model danych

### 2.1 Tabele i kolumny

> Wszystkie tabele: wielodostępność przez `organization_id` + `tenant_id`. UUID PK, brak bezpośrednich relacji ORM między modułami (tylko FK-id).

#### `pc_cost_categories` — słownik kategorii kosztów

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | gen_random_uuid() |
| `organization_id` | `uuid` NOT NULL | tenant scope |
| `tenant_id` | `uuid` NOT NULL | tenant scope |
| `code` | `text` NOT NULL | unikalny per org+tenant, np. `production`, `transport`, `assembly`, `material`, `labour`, `equipment`, `subcontractor` |
| `label` | `text` NOT NULL | etykieta i18n (klucz lub tekst) |
| `segment_id` | `uuid` NULL FK → `pc_segments.id` | NULL = wspólna dla wszystkich segmentów |
| `sort_order` | `int` DEFAULT 0 | kolejność w siatce |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(organization_id, tenant_id)`, `UNIQUE (organization_id, tenant_id, code)`.

Seed domyślny (setup.ts): `production`, `transport`, `assembly` dla każdego nowego tenanta.

#### `pc_segments` — segmenty branżowe (konfiguracja)

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

Indeksy: `(organization_id, tenant_id)`, `UNIQUE (organization_id, tenant_id, code)`.

Seed: `precast_concrete` (prefabrykacja żelbetowa) – v1.

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

Seed dla `precast_concrete`: strop, ściana, słup, belka, klatka schodowa.

#### `pc_price_catalog` — własny cennik firmy

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `segment_id` | `uuid` NULL | NULL = wspólna pozycja |
| `cost_category_id` | `uuid` NULL | FK → `pc_cost_categories.id` |
| `code` | `text` NOT NULL | SKU/kod pozycji cennikowej |
| `label` | `text` NOT NULL | |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | koszt jedn. (zakup) |
| `unit_price` | `numeric(14,4)` NULL | cena jedn. (sprzedaż) |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | ISO 4217 |
| `valid_from` | `date` NULL | |
| `valid_to` | `date` NULL | |
| `source` | `text` DEFAULT `'manual'` | `manual` \| `csv_import` \| `xlsx_import` |
| `is_active` | `bool` DEFAULT true | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(organization_id, tenant_id)`, `(organization_id, tenant_id, code)`, `(segment_id)`.

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
| `organization_id` | `uuid` NOT NULL | multi-tenant scope (dla indeksów) |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | opis pozycji |
| `quantity` | `numeric(14,4)` DEFAULT 1 | ilość domyślna |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` |
| `unit_cost` | `numeric(14,4)` NULL | koszt jedn. domyślny |
| `unit_price` | `numeric(14,4)` NULL | cena jedn. domyślna |
| `sort_order` | `int` DEFAULT 0 | |

Indeksy: `(template_id)`, `(organization_id, tenant_id)`.

#### `pc_calculations` — kalkulacja (głowa) powiązana z Dealem

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `deal_id` | `uuid` NOT NULL | FK-id → `customer_deals.id` |
| `segment_id` | `uuid` NULL | FK → `pc_segments.id` |
| `code` | `text` NOT NULL | numer kalkulacji, unik. per tenant+deal (np. `K/2026/001`) |
| `label` | `text` NOT NULL | tytuł wersji |
| `status` | `text` NOT NULL DEFAULT `'draft'` | `draft` \| `active` \| `sent` \| `locked` \| `archived` |
| `version` | `int` NOT NULL DEFAULT 1 | numer wersji (auto-increment per deal) |
| `is_active_version` | `bool` NOT NULL DEFAULT false | **tylko jedna** kalkulacja per deal może być `true` |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | narzut jako ułamek (0.10 = 10%) |
| `markup_rate` | `numeric(6,4)` DEFAULT 0 | marża target (informacyjna, wyliczona vs zadana) |
| `total_cost` | `numeric(14,2)` NULL | suma kosztów (denormalizacja, odświeżana przez recalc) |
| `total_price` | `numeric(14,2)` NULL | suma cen (dochód) |
| `total_margin` | `numeric(14,2)` NULL | zysk = total_price − total_cost |
| `margin_rate` | `numeric(6,4)` NULL | marża % = total_margin / total_price |
| `total_quantity_m3` | `numeric(14,3)` NULL | łączna ilość w m³ (prognoza produkcji) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | łączna ilość szt. (prognoza produkcji) |
| `production_start_at` | `date` NULL | planowany start produkcji |
| `production_end_at` | `date` NULL | planowany koniec produkcji |
| `notes` | `text` NULL | notatki |
| `sent_at` | `timestamptz` NULL | data wysłania klientowi |
| `locked_at` | `timestamptz` NULL | data zablokowania |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` (skąd wygenerowano) |
| `created_by` | `uuid` NULL | FK-id → users |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | **wymagane dla optimistic locking** |

Indeksy: `(organization_id, tenant_id)`, `(deal_id)`, `(deal_id, is_active_version)`, `UNIQUE (organization_id, tenant_id, code)`.

Ograniczenia: `CHECK (status IN ('draft','active','sent','locked','archived'))`.

> **Reguła aktywnej kalkulacji**: Constraint bazy (`is_active_version` może być `true` tylko raz per `deal_id` + `organization_id` + `tenant_id`) wymuszony przez unikalny partial index:
> ```sql
> CREATE UNIQUE INDEX pc_calculations_active_unique
>   ON pc_calculations (deal_id, organization_id, tenant_id)
>   WHERE is_active_version = true;
> ```

#### `pc_calculation_lines` — linie kalkulacji

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `cost_category_id` | `uuid` NOT NULL | FK → `pc_cost_categories.id` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | opis pozycji (edytowalny inline) |
| `quantity` | `numeric(14,4)` NOT NULL DEFAULT 1 | ilość |
| `unit_id` | `uuid` NULL | FK-id → dictionaries `unit` (m³, szt., mb…) |
| `unit_cost` | `numeric(14,4)` NOT NULL DEFAULT 0 | koszt jednostkowy netto |
| `unit_price` | `numeric(14,4)` NOT NULL DEFAULT 0 | cena jednostkowa netto |
| `line_cost` | `numeric(14,2)` GENERATED | `quantity × unit_cost` – wyliczone przez API (nie DB generated) |
| `line_price` | `numeric(14,2)` GENERATED | `quantity × unit_price` |
| `line_margin` | `numeric(14,2)` GENERATED | `line_price − line_cost` |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` (skąd pobrano cenę) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indeksy: `(calculation_id)`, `(organization_id, tenant_id, cost_category_id)`.

> `line_cost`, `line_price`, `line_margin` — wartości denormalizowane. Wyliczane i zapisywane przez endpoint `POST /api/project-costing/calculations/:id/recalc`. Nie używamy `GENERATED ALWAYS AS` w Postgresie, bo biblioteka ORM musi je widzeć jako zwykłe kolumny; obliczenia są w warstwie serwisowej.

#### `pc_import_column_mappings` — zapamiętane mapowania importu

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `label` | `text` NOT NULL | nazwa mapowania (np. „Excel Marek") |
| `file_type` | `text` NOT NULL | `xlsx` \| `csv` |
| `column_map` | `jsonb` NOT NULL | `{ "label": "Nazwa", "quantity": "Ilość", ... }` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### 2.2 Waluta i zaokrąglenia

- Każda kalkulacja ma jedną walutę (`currency`), domyślnie z ustawień tenanta (pole z `currencies` module lub DEFAULT `'PLN'`).
- Wszystkie wartości pieniężne: `numeric(14,2)` (zaokrąglenie bankierskie HALF_EVEN po każdej operacji).
- Ceny jednostkowe: `numeric(14,4)` (4 miejsca do wejścia, 2 do sum).
- Ilości: `numeric(14,4)` (m³, mb, kg mogą mieć 3+ miejsca).
- Kursy walut: brak konwersji w v1 (kalkulacja jednowalutowa). W v2: integracja z modułem `currencies`.

### 2.3 Multi-tenant scoping

Każda tabela zawiera `organization_id` + `tenant_id`. Wszystkie zapytania filtrują przez obie wartości pobierane z kontekstu żądania (`organizationId`, `tenantId` z DI). Brak cross-tenant leakage.

---

## 3. Reguły wyliczeń

### 3.1 Wycena linii

```
line_cost  = quantity × unit_cost      (zaokrągl(·, 2, HALF_EVEN))
line_price = quantity × unit_price     (zaokrągl(·, 2, HALF_EVEN))
line_margin = line_price − line_cost
```

### 3.2 Sumy per kategoria

```
category_total_cost  = SUM(line_cost  WHERE cost_category_id = cat)
category_total_price = SUM(line_price WHERE cost_category_id = cat)
category_margin      = category_total_price − category_total_cost
```

### 3.3 Sumy kalkulacji (przed narzutem)

```
subtotal_cost  = SUM(line_cost)
subtotal_price = SUM(line_price)
```

### 3.4 Narzut (`overhead_rate`)

Narzut **dodawany do kosztu** (podnosi próg rentowności):

```
overhead_amount = subtotal_cost × overhead_rate
total_cost      = subtotal_cost + overhead_amount
```

Cena oferty nie zmienia się automatycznie przy zmianie narzutu – to tylko informacja o realnym koszcie. Marża oblicza się od finalnej ceny:

```
total_price    = subtotal_price            (cena oferty bez narzutu – wg woli użytkownika)
total_margin   = total_price − total_cost  (zysk netto po narzucie)
margin_rate    = total_margin / total_price  (gdy total_price > 0, else 0)
```

> **Rozróżnienie: narzut vs marża**
>
> - **Narzut** (*markup*): procent doliczany DO kosztu (koszt × (1 + narzut) = cena minimalna rentowna). Używany wewnętrznie do obliczenia `total_cost` z kosztami pośrednimi.
> - **Marża** (*margin*): zysk jako procent OD ceny sprzedaży. `margin_rate = (cena − koszt) / cena`. To kluczowy KPI dla dashboardów.
>
> Obie wartości widoczne w nagłówku kalkulacji; użytkownik ustawia `overhead_rate` (narzut), widzi wyliczoną `margin_rate` (marżę). Może też wpisać docelową marżę – wtedy UI wyświetla sugerowaną cenę (nieaplikowaną automatycznie).

### 3.5 Prognoza produkcji

```
total_quantity_m3  = SUM(line.quantity WHERE line.unit = 'm3')
total_quantity_pcs = SUM(line.quantity WHERE line.unit IN ('szt','pc','pcs'))
```

Mapowanie `unit_id` → kodu jednostki pobierane ze słownika `dictionaries`. W `analytics.ts` eksponowane jako kolumny analityczne z `production_start_at`.

### 3.6 Reguła aktywnej kalkulacji i zasilanie `value_amount`

- Deal może mieć wiele kalkulacji (wersje), ale tylko jedną `is_active_version = true`.
- Po oznaczeniu kalkulacji jako aktywna → endpoint `POST /api/project-costing/calculations/:id/apply-to-deal` aktualizuje `customer_deals.value_amount = calculation.total_price` (przez interceptor lub bezpośrednie wywołanie API `customers` przez serwis modułu z użyciem klienta HTTP wewnętrznego lub przez event `project_costing.calculation.activated`).
- `cf_offer_role` (`primary` / `alternative`) na Dealu: **Projekt** (`klin:project` custom entity) sumuje wartości swoich Deali. Reguła sumowania:
  - `project_total_price = SUM(deal.value_amount WHERE cf_offer_role = 'primary' AND deal.status NOT IN ('lost','archived'))`.
  - Deale `alternative` nie wchodzą do sumy projektu, ale są widoczne w tabeli deali projektu (jako alternatywna oferta).
  - Dashboard prognozowy bierze deale `primary` + `status = 'active'|'won'` z `production_start_at` w przedziale 6 miesięcy.

---

## 4. UI / UX

### 4.1 Zakładka „Kalkulacja" na karcie Deala

**Punkt wstrzyknięcia**: `detail:customers.deal:tabs` (zweryfikowano w `packages/core/src/modules/customers/backend/customers/deals/[id]/hooks/useDealInjectedTabs.tsx`).

Widget: `project_costing/widgets/DealCalculationTab.tsx` rejestrowany w `widgets/index.ts`.

Zawartość zakładki:
- Nagłówek: wybór aktywnej kalkulacji (dropdown wersji), przyciski: „Nowa wersja", „Importuj", „Eksportuj XLSX".
- Siatka linii kosztowych (patrz §4.2).
- Panel podsumowania (prawostronny lub pod siatką): sumy per kategoria + łącznie, narzut, marża %.
- Przycisk „Zastosuj do Deala" → wywołuje `apply-to-deal`.

Zakładka jest **Client Component** (Next.js `'use client'`) — siatka wymaga interaktywności.

### 4.2 Siatka kosztów „jak Excel"

**Biblioteka**: `adazzle/react-data-grid` v7 (licencja MIT, ~50 KB gzip).

Uzasadnienie wyboru:
- Natywna obsługa edycji inline w komórce (klawiatura: Enter/Tab/Arrow), kopiuj/wklej z/do Excela (Ctrl+C/V przez schowek tekstu tabulowanego).
- Lekka (~50 KB gzip) — ważne na VPS 3.77 GiB RAM.
- Headless renderery kolumn → integracja z DS tokenami OM (kolory, fonty, spacing).
- MIT license — brak opłat licencyjnych dla open-source fork.

Alternatywy odrzucone:
- **AG Grid Community**: cięższy (~500 KB), duży footprint pamięci.
- **Handsontable**: licencja komercyjna wymagana dla użytku komercyjnego.
- **TanStack Table v8**: headless, ale nie ma wbudowanego Excel-like keyboard UX — wymagałoby znaczącej własnej implementacji.

Kolumny siatki (konfigurowalny porządek, resize):

| Kolumna | Edytowalna | Typ komórki |
|---------|-----------|-------------|
| Lp. | Nie | auto-increment |
| Kategoria | Tak | select (pc_cost_categories) |
| Typ elementu | Tak | select (pc_element_types) |
| Opis / Pozycja | Tak | text |
| Ilość | Tak | numeric |
| J.m. | Tak | select (dictionaries unit) |
| Koszt jedn. [PLN] | Tak | numeric |
| Cena jedn. [PLN] | Tak | numeric |
| Wartość kosztu | Nie | computed = ilość × koszt jedn. |
| Wartość ceny | Nie | computed = ilość × cena jedn. |
| Marża zł | Nie | computed |
| Marża % | Nie | computed |
| Akcje | Nie | usuń wiersz |

Funkcje siatki:
- Dodawanie wiersza: przycisk „+ Dodaj" lub klawisz Insert na ostatnim wierszu.
- Usuwanie wiersza: przycisk w kolumnie akcji lub Delete na zaznaczonym wierszu.
- Kopiuj/wklej blok komórek (wielowierszowy): zgodny format z Excel/Google Sheets (tab-separated values).
- Filtrowanie wierszy per kategoria (panel boczny checkboxy).
- Zwijanie/rozwijanie grupy per kategoria (group-by category).
- Auto-save (debounce 800 ms od ostatniej edycji) przez `PATCH /api/project-costing/calculation-lines/:id`.
- Optimistic UI: wartości computed aktualizowane lokalnie, potwierdzane po recalc.

### 4.3 Strony backend modułu

Trasy w `apps/mercato/src/modules/project_costing/backend/`:

| Ścieżka URL | Plik strony | Opis |
|-------------|-------------|------|
| `/project-costing/segments` | `segments/page.tsx` | Lista segmentów, CRUD |
| `/project-costing/segments/[id]` | `segments/[id]/page.tsx` | Edycja segmentu + kategorie kosztów |
| `/project-costing/templates` | `templates/page.tsx` | Lista szablonów kalkulacji |
| `/project-costing/templates/[id]` | `templates/[id]/page.tsx` | Edycja szablonu z siatką linii |
| `/project-costing/price-catalog` | `price-catalog/page.tsx` | Cennik firmy (DataTable + import CSV/XLSX) |
| `/project-costing/price-catalog/[id]` | `price-catalog/[id]/page.tsx` | Edycja pozycji cennikowej |
| `/project-costing/calculations` | `calculations/page.tsx` | Lista wszystkich kalkulacji (cross-deal) |
| `/project-costing/calculations/[id]` | `calculations/[id]/page.tsx` | Szczegóły kalkulacji (standalone, bez zakładki deala) |

Linki menu: wstrzyknięte do sidebaru głównego przez `widgets/menu.tsx` (spot: `main-menu:settings` lub dedykowany spot modułu settings).

### 4.4 Siatka szablonu

Identyczna biblioteka `react-data-grid`. Kolumny: Kategoria, Typ elementu, Opis, Ilość domyślna, J.m., Koszt jedn., Cena jedn.

### 4.5 Porównanie wersji kalkulacji

Strona `calculations/[id]/compare` — widok diff dwóch wersji kalkulacji (wybór z dropdown). Tabela różnic: kolumna „stara wartość" vs „nowa wartość", zakolorowane DS tokenami (status-positive/negative).

---

## 5. Import / Eksport

### 5.1 Import XLSX/CSV

**Biblioteka**: `xlsx` (SheetJS Community Edition, Apache-2.0). Obsługa formatów: `.xlsx`, `.xls`, `.csv`, `.ods` (ods opcjonalnie v2).

**Kreator mapowania kolumn** (`ImportWizard`):

1. **Upload**: przeciągnij lub wybierz plik (max 10 MB, max 5000 wierszy).
2. **Podgląd**: pierwsze 5 wierszy danych (DataTable bez edycji).
3. **Mapowanie**: dropdown per kolumnę modułu (label, quantity, unit, unit_cost, unit_price, cost_category, notes). Możliwość pominięcia kolumny.
4. **Zapis mapowania**: checkbox „Zapamiętaj to mapowanie jako: [nazwa]" → zapisuje do `pc_import_column_mappings`.
5. **Walidacja**: sprawdzenie typów (ilość/cena = liczba, kategoria = znany kod lub etykieta), wyróżnienie wierszy z błędami.
6. **Podgląd po mapowaniu**: zaimportowane wiersze z obliczonymi wartościami.
7. **Zatwierdzenie**: `POST /api/project-costing/calculations/:id/import` → dodaje linie do kalkulacji (tryb: dołącz lub zastąp).

Limity:
- Rozmiar pliku: 10 MB.
- Liczba wierszy: 5 000 per import (przy większych: błąd z informacją).
- Timeout parsowania: 30 s.

Obsługa błędów: błędne wiersze nie przerywają importu – wchodzą jako linie z flagą `import_error: true` i widoczne w podglądzie do ręcznej korekty lub pominięcia.

### 5.2 Eksport XLSX/CSV

Endpoint: `GET /api/project-costing/calculations/:id/export?format=xlsx|csv`.

XLSX: `SheetJS` — wieloarkuszowy plik:
- Arkusz 1: linie kalkulacji (wszystkie kolumny).
- Arkusz 2: sumy per kategoria.
- Arkusz 3: nagłówek kalkulacji (meta, marża, daty).

CSV: UTF-8 z BOM (dla zgodności z Excel PL), separator `;`.

Eksport cennika: `GET /api/project-costing/price-catalog/export?format=xlsx|csv`.

---

## 6. API

Wszystkie endpointy: `POST`, `GET`, `PATCH`, `DELETE` zgodne z konwencjami OM (`makeCrudRoute`, zod validators, `organizationId`/`tenantId` z DI). Prefix: `/api/project-costing/`.

### 6.1 Segmenty

```
GET    /api/project-costing/segments
POST   /api/project-costing/segments
GET    /api/project-costing/segments/:id
PATCH  /api/project-costing/segments/:id
DELETE /api/project-costing/segments/:id
```

### 6.2 Kategorie kosztów

```
GET    /api/project-costing/cost-categories
POST   /api/project-costing/cost-categories
PATCH  /api/project-costing/cost-categories/:id
DELETE /api/project-costing/cost-categories/:id
```

### 6.3 Typy elementów

```
GET    /api/project-costing/element-types?segmentId=
POST   /api/project-costing/element-types
PATCH  /api/project-costing/element-types/:id
DELETE /api/project-costing/element-types/:id
```

### 6.4 Cennik

```
GET    /api/project-costing/price-catalog?segmentId=&categoryId=&q=
POST   /api/project-costing/price-catalog
PATCH  /api/project-costing/price-catalog/:id
DELETE /api/project-costing/price-catalog/:id
GET    /api/project-costing/price-catalog/export?format=xlsx|csv
POST   /api/project-costing/price-catalog/import         (import pliku cennika)
```

### 6.5 Szablony

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

### 6.6 Kalkulacje

```
GET    /api/project-costing/calculations?dealId=&status=&isActiveVersion=
POST   /api/project-costing/calculations                           (nowa kalkulacja dla deala)
GET    /api/project-costing/calculations/:id
PATCH  /api/project-costing/calculations/:id                       (nagłówek: label, overhead_rate, status, currency…)
DELETE /api/project-costing/calculations/:id                       (tylko draft/archived)

POST   /api/project-costing/calculations/:id/duplicate             (nowa wersja = kopia linii)
POST   /api/project-costing/calculations/:id/recalc                (przelicz line_cost/price/margin + sumy nagłówka)
POST   /api/project-costing/calculations/:id/activate              (ustaw is_active_version=true, poprzednia → false)
POST   /api/project-costing/calculations/:id/apply-to-deal         (aktualizuje deal.value_amount = total_price)
POST   /api/project-costing/calculations/:id/mark-sent             (status → sent, sent_at = now())
POST   /api/project-costing/calculations/:id/lock                  (status → locked, locked_at = now())

GET    /api/project-costing/calculations/:id/export?format=xlsx|csv
POST   /api/project-costing/calculations/:id/import                (import linii z pliku)
```

### 6.7 Linie kalkulacji

```
GET    /api/project-costing/calculation-lines?calculationId=
POST   /api/project-costing/calculation-lines
PATCH  /api/project-costing/calculation-lines/:id
DELETE /api/project-costing/calculation-lines/:id
POST   /api/project-costing/calculation-lines/batch                (bulk upsert – dla auto-save siatki)
```

### 6.8 Mapowania importu

```
GET    /api/project-costing/import-column-mappings
POST   /api/project-costing/import-column-mappings
PATCH  /api/project-costing/import-column-mappings/:id
DELETE /api/project-costing/import-column-mappings/:id
```

### 6.9 Optimistic Locking

Wszystkie `PATCH` i `DELETE` na `pc_calculations` i `pc_calculation_lines` wymagają nagłówka `If-Unmodified-Since` (z `updatedAt`). Konflikty zwracają HTTP 409 + body `{ code: 'OPTIMISTIC_LOCK_CONFLICT' }`. UI obsługuje je przez `surfaceRecordConflict(err, t)`.

---

## 7. Uprawnienia (ACL)

Plik `acl.ts` w module eksponuje features:

| Feature ID | Opis |
|-----------|------|
| `project_costing.view` | Podgląd kalkulacji na dealach |
| `project_costing.edit` | Edycja linii, wersji, szablonów |
| `project_costing.admin` | Zarządzanie segmentami, kategoriami, cennikiem |
| `project_costing.apply_to_deal` | Prawo do aktualizacji `value_amount` deala |
| `project_costing.import` | Import XLSX/CSV |
| `project_costing.export` | Eksport XLSX/CSV |
| `project_costing.lock` | Blokowanie/oznaczanie wersji wysłanej |

Domyślne przypisania w `setup.ts`:
- Rola `admin` → wszystkie features.
- Rola `sales_manager` (lub odpowiednik w CRM) → `view`, `edit`, `apply_to_deal`, `import`, `export`.
- Rola `sales_rep` → `view`, `edit` (tylko własne deale – filtr `created_by` lub właściciel deala, do decyzji §14).

Strony backend: `requireFeatures(['project_costing.admin'])` dla `/project-costing/segments`, `requireFeatures(['project_costing.view'])` dla zakładki kalkulacji.

---

## 8. Zdarzenia i integracja z Dealem / `klin:project`

### 8.1 Zdarzenia modułu (`events.ts`)

```typescript
// project_costing.calculation.created
// project_costing.calculation.updated
// project_costing.calculation.activated   (is_active_version → true)
// project_costing.calculation.sent
// project_costing.calculation.locked
// project_costing.calculation.deleted
// project_costing.deal.value_applied      (value_amount zaktualizowany)
```

Zdarzenia z `clientBroadcast: true`: `activated`, `value_applied` (odświeżają zakładkę deala w przeglądarce przez SSE DOM Event Bridge).

### 8.2 Integracja z Dealem

- Zakładka wstrzyknięta przez spot `detail:customers.deal:tabs` (zweryfikowany w kodzie).
- `apply-to-deal` używa interceptora lub internal API call do aktualizacji `customer_deals.value_amount`. Szczegół implementacyjny: serwis `ProjectCostingService` wywołuje `em.nativeUpdate('customer_deals', { id: dealId }, { value_amount: totalPrice })` — dopuszczalne cross-module update przez raw SQL (nie ORM relation) lub przez dedykowany event subscriber w `customers` module, jeśli taki zostanie dodany.
- **Uwaga**: zmiana `value_amount` wymaga obsługi optimistic lock deala (przekazanie `updatedAt` deala, nie kalkulacji).

### 8.3 Integracja z `klin:project`

`klin:project` to custom entity (Data designer, `custom_entities_storage`). Moduł `project_costing` **nie** tworzy własnej relacji do `klin:project`. Integracja jest przez:
1. Deal ma `cf_offer_role` (custom field EAV) → moduł odczytuje go przez API `entities` przy wyświetlaniu listy deali projektu.
2. Dashboard widgetu projektu (widget wstrzyknięty przez spot na stronie szczegółów `klin:project` – jeśli taki spot istnieje) – filtruje kalkulacje po `deal_id IN (deale powiązane z projektem)`.
3. W braku spotu na `klin:project` (weryfikacja w implementacji): widget listy kalkulacji projektu dostarczany jako osobna strona `/project-costing/projects/:projectId`.

---

## 9. Analityka (`analytics.ts`)

Wpis w `analytics.ts` modułu – encje eksponowane do silnika dashboardów (`POST /api/dashboards/widgets/data`):

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
      totalCost:        { dbColumn: 'total_cost',      type: 'numeric' },
      totalPrice:       { dbColumn: 'total_price',     type: 'numeric' },
      totalMargin:      { dbColumn: 'total_margin',    type: 'numeric' },
      marginRate:       { dbColumn: 'margin_rate',     type: 'numeric' },
      overheadRate:     { dbColumn: 'overhead_rate',   type: 'numeric' },
      totalQuantityM3:  { dbColumn: 'total_quantity_m3',  type: 'numeric' },
      totalQuantityPcs: { dbColumn: 'total_quantity_pcs', type: 'numeric' },
      productionStartAt: { dbColumn: 'production_start_at', type: 'timestamp' },
      productionEndAt:   { dbColumn: 'production_end_at',   type: 'timestamp' },
      createdAt:        { dbColumn: 'created_at',      type: 'timestamp' },
      isActiveVersion:  { dbColumn: 'is_active_version', type: 'boolean' },
    },
  },
  {
    entityId: 'project_costing:calculation_lines',
    requiredFeatures: ['project_costing.view'],
    entityConfig: {
      tableName: 'pc_calculation_lines',
      dateField: 'created_at',
      defaultScopeFields: ['tenant_id', 'organization_id'],
    },
    fieldMappings: {
      id:             { dbColumn: 'id',               type: 'uuid' },
      calculationId:  { dbColumn: 'calculation_id',   type: 'uuid' },
      costCategoryId: { dbColumn: 'cost_category_id', type: 'uuid' },
      elementTypeId:  { dbColumn: 'element_type_id',  type: 'uuid' },
      quantity:       { dbColumn: 'quantity',         type: 'numeric' },
      unitCost:       { dbColumn: 'unit_cost',        type: 'numeric' },
      unitPrice:      { dbColumn: 'unit_price',       type: 'numeric' },
      lineCost:       { dbColumn: 'line_cost',        type: 'numeric' },
      linePrice:      { dbColumn: 'line_price',       type: 'numeric' },
      lineMargin:     { dbColumn: 'line_margin',      type: 'numeric' },
      createdAt:      { dbColumn: 'created_at',       type: 'timestamp' },
    },
  },
]
```

### 9.1 Widgety dashboardów

Poniższe konfiguracje widgetów są możliwe do zbudowania w silniku dashboardów:

**TOP/BOTTOM marża (deale)**:
- Encja: `project_costing:calculations`, filtr `is_active_version = true`.
- Metryka: `marginRate` (avg lub ostatnia wartość), groupBy: `dealId`.
- Sortowanie: malejąco (TOP) / rosnąco (BOTTOM) — konfigurowane w widgecie (nie w schemacie, jak zaznaczono w kontekście).
- Resolver etykiety: `deal_id` → `customer_deals.display_name` (przez `labelResolvers` w analytics lub join w widgecie).

**Prognoza produkcji – m³/szt. na 6 miesięcy**:
- Encja: `project_costing:calculations`, filtr `is_active_version = true AND status IN ('active','sent') AND production_start_at BETWEEN now() AND now() + 6 months`.
- Metryki: `SUM(totalQuantityM3)`, `SUM(totalQuantityPcs)`, groupBy: miesiąc (`productionStartAt`).
- Wynik: wykres słupkowy z 6 słupkami (miesiące).

---

## 10. Rekomendacja integracji cennikowej

### 10.1 Analiza dostępnych źródeł cennikowych

#### Sekocenbud (Orgbud-Serwis)

- **Licencja / warunki**: Komercyjne — subskrypcja roczna dla firm. Ceny orientacyjne [niezweryfikowane]: kilkaset–kilka tysięcy PLN/rok zależnie od zakresu danych.
- **API**: Brak publicznie udokumentowanego REST API [niezweryfikowane]. Dane dostępne głównie jako pliki do pobrania po zalogowaniu (PDF, Excel) lub przez dedykowane oprogramowanie (Norma PRO, Planista).
- **Formaty**: Pliki XLSX/PDF per kwartał. Brak oficjalnego formatu wymiany danych maszynowych.
- **Realistyczność v1**: ❌ Nie. Brak API, konieczność ręcznego pobierania i konwertowania plików. Możliwe jako adapter importu CSV/XLSX w v2.
- **v2 ścieżka**: Adapter importu pliku XLSX z Sekocenbud → mapowanie na `pc_price_catalog`.

#### Intercenbud

- **Licencja / warunki**: Komercyjne, subskrypcja. Dane kwartalne dla budownictwa ogólnego i instalacji [niezweryfikowane].
- **API**: Brak publicznie dostępnego API [niezweryfikowane].
- **Formaty**: Excel, własny format eksportu z oprogramowania Intercenbud.
- **Realistyczność v1**: ❌ Nie. Analogicznie do Sekocenbud.
- **v2 ścieżka**: Import pliku → `pc_price_catalog`.

#### Bazy norm KNR/KNNR

- **Charakter**: Katalogi Nakładów Rzeczowych — normy zużycia materiałów, robocizny, sprzętu na jednostkę roboty budowlanej. Nie są cenami, lecz normatywami ilościowymi.
- **Dostępność**: Historyczne KNR dostępne bezpłatnie (domeny publiczne po ~30 latach), nowsze KNNR — komercyjnie lub w oprogramowaniu kosztorysowym (Norma PRO, Zuzia, R3).
- **Format**: Bazy danych własnych systemów (nie REST API). Import możliwy przez eksport z Norma PRO do CSV/Excel.
- **Realistyczność v1**: ❌ Nie (jako automatyczna integracja). Możliwe jako ręczny import szablonów opartych na KNR.
- **v2 ścieżka**: Biblioteka szablonów kalkulacji opartych na normach KNR jako opcjonalny pakiet danych.

#### Własny cennik firmy

- **Charakter**: Tabela `pc_price_catalog` w module — pozycje wprowadzane ręcznie lub importowane z XLSX/CSV przez firmę.
- **Dostępność**: Pełna kontrola.
- **Format**: Dowolny (kreator mapowania kolumn).
- **Realistyczność v1**: ✅ **Tak** — to rekomendowane rozwiązanie dla v1.
- **Koszt implementacji**: Wbudowane (część modułu, brak zewnętrznych licencji).

### 10.2 Rekomendacja

> **v1: własny cennik firmy (`pc_price_catalog`) + import CSV/XLSX** — jedyne w pełni realistyczne źródło dla v1. Firmy budowlane mają własne cenniki w Excelu; kreator mapowania pozwala na jednorazowy import i bieżące aktualizacje.
>
> **v2: adaptery importu plików z cenników komercyjnych** — Sekocenbud i Intercenbud oferują pliki Excel per kwartał. Moduł `project_costing` może dostarczyć adapter importu (zmapowane kolumny predefiniowane dla formatu Sekocenbud) jako opcjonalną funkcję.
>
> **v2+: bazy KNR jako szablony** — biblioteka gotowych szablonów kalkulacji (np. płyta stropowa 1 m³: normy betonu, stali, deskowania, robocizny wg KNR 2-01) dostarczana jako plik seed/migration do `pc_calculation_templates`. Nie wymaga licencji API.
>
> Integracja z zewnętrznymi API cenników (Orgbud-Serwis, GUS) **nie jest realistyczna w v1 ani v2** ze względu na brak publicznie dostępnych API i warunki licencyjne [niezweryfikowane — gdyby Sekocenbud/Intercenbud udostępnił API B2B, wróć do analizy].

---

## 11. Ocena: Katalog produktów (`catalog` module) vs własna tabela elementów

| Kryterium | Aktywacja `catalog` | Własna tabela `pc_element_types` |
|-----------|---------------------|----------------------------------|
| RAM na VPS | ~+80–150 MB (wszystkie encje catalog) | ~+5 MB |
| Kompleksowość | Wysokie: produkty, warianty, SKU, kategorie, tagi, ceny, konwersje jednostek, historia cen | Niskie: tylko typy elementów + ewentualne konwersje |
| UI catalog | Pełny moduł katalogowy (bez `sales`) — duży UI overhead | Brak — zarządzanie w ustawieniach `project_costing` |
| Sprzężenia z upstream | Brak (`requires` catalog = brak w upstream) — ryzyko sync | Brak — własna tabela, brak sync-ryzyka |
| Konwersje jednostek | `catalog_product_unit_conversions` (szt↔m³↔t) — gotowe | Własna implementacja lub delegacja do dictionaries |
| Rekomendacja | ❌ **Nie** w v1 | ✅ **Tak** — własna lekka tabela `pc_element_types` |

**Decyzja**: `pc_element_types` (własna tabela) w v1. Konwersje jednostek (np. szt↔m³ dla różnych typów elementów) dodawane jako opcjonalna tabela `pc_element_unit_factors` w v2, jeśli zapotrzebowanie potwierdzone.

---

## 12. Fazy, zakres i szacowanie wysiłku

### Faza MVP (ok. 8–13 dni roboczych)

**Cel**: Ręczna kalkulacja linii kosztowych na karcie Deala + eksport XLSX.

| Zadanie | Rozmiar |
|---------|---------|
| Model danych + migracje (pc_calculations, pc_calculation_lines, pc_cost_categories, pc_segments, pc_element_types) | M (2 dni) |
| API CRUD: segments, cost-categories, element-types, calculations, calculation-lines | M (2 dni) |
| Siatka `react-data-grid` — zakładka na dealu (edycja inline, sumy, narzut/marża %) | L (3 dni) |
| Backend strony: segmenty, kategorie (ustawienia) | S (1 dzień) |
| Eksport XLSX/CSV | S (1 dzień) |
| ACL features + setup.ts (seed: kategorie domyślne, segment precast) | S (0.5 dnia) |
| Analytics.ts + podstawowy widget marży | S (0.5 dnia) |
| i18n PL/EN, testy jednostkowe kluczowych serwisów | M (2 dni) |

**Suma MVP**: ~12 dni roboczych.

### Faza v1 (ok. 9–14 dni roboczych, po MVP)

**Cel**: Import XLSX/CSV z mapowaniem, szablony kalkulacji, cennik firmy, `apply-to-deal`.

| Zadanie | Rozmiar |
|---------|---------|
| Import XLSX/CSV + kreator mapowania + walidacja | L (3 dni) |
| Cennik firmy (CRUD + import + eksport) | M (2 dni) |
| Szablony kalkulacji + generowanie kalkulacji z szablonu | M (2 dni) |
| Wersjonowanie kalkulacji (duplicate, activate, mark-sent, lock) + reguła `is_active_version` | M (2 dni) |
| `apply-to-deal` + prognoza produkcji (daty, m³/szt.) | M (1.5 dnia) |
| Widgety dashboard: TOP/BOTTOM marża, prognoza produkcji | M (2 dni) |
| Widok porównania wersji | S (1 dzień) |

**Suma v1**: ~13.5 dnia roboczych.

### Faza v2 (szacunek wstępny, po v1)

**Cel**: Multi-segment budowlany, adaptery importu cenników, konwersje jednostek, integracja projektu (`klin:project`).

| Zadanie | Rozmiar |
|---------|---------|
| Nowe segmenty: materiały/robocizna/sprzęt/podwykonawca | S (1 dzień) |
| Adapter importu Sekocenbud/Intercenbud (plik XLSX → cennik) | M (2 dni) |
| `pc_element_unit_factors` (szt↔m³ per typ elementu) | S (1 dzień) |
| Integracja z `klin:project` (widget na stronie projektu, sumowanie deali) | M (2 dni) |
| Biblioteka szablonów KNR (seed data) | M (2 dni) |
| Konwersja walutowa (integracja z `currencies`) | S (1 dzień) |
| Eksport PDF kalkulacji | M (2 dni) |
| AI-tool: generowanie linii kalkulacji na podstawie opisu projektu | L (3 dni) |

**Suma v2**: ~14 dni roboczych.

---

## 13. Ryzyka

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Mitygacja |
|---|--------|--------------------|-------|-----------|
| R1 | `react-data-grid` niezgodność z DS OM lub konflikty stylów Tailwind | Średnie | Wysoki | PoC siatki w izolacji przed v1; custom renderers tokenów DS |
| R2 | Wydajność `recalc` przy 5000 liniach (VPS 3.77 GiB) | Niskie | Wysoki | Recalc asynchroniczny (queue job) po próg >500 linii; synchroniczny poniżej |
| R3 | Aktualizacja `value_amount` deala bez optimistic lock → race condition | Średnie | Średni | `apply-to-deal` pobiera aktualne `deal.updatedAt` i przekazuje jako `If-Unmodified-Since` |
| R4 | Import pliku XLSX z nieoczekiwanym formatem (scalane komórki, wielopoziomowe nagłówki) | Wysokie | Średni | Kreator mapowania + walidacja + tryb „omiń błędne wiersze" |
| R5 | Brak spotu na stronie `klin:project` (custom entity) | Nieznane | Średni | Fallback: osobna strona `/project-costing/projects/:projectId` |
| R6 | SheetJS (xlsx) nie obsługuje wszystkich wariantów .xlsx (formuły, makra) | Niskie | Niski | Import tylko wartości (nie formuł); informacja dla użytkownika |
| R7 | Unique partial index `is_active_version` — race condition przy równoległych `activate` | Niskie | Wysoki | Transakcja `SERIALIZABLE` lub advisory lock per `deal_id` w serwisie `activate` |
| R8 | Scope creep: żądanie integracji z ERP/fakturowanie przed MVP | Wysokie | Wysoki | Granica scope: moduł `project_costing` nie zastępuje ERP; `sales` wyłączony celowo |

---

## 14. Pytania otwarte do Marka

1. **Rola użytkownika a widoczność kalkulacji**: Czy `sales_rep` widzi tylko kalkulacje na swoich dealach (filtr `created_by` lub właściciel deala), czy wszystkie w organizacji? Czy `sales_manager` może edytować kalkulacje cudzych deali?

2. **`cf_offer_role` — tworzenie custom fielda**: Custom field `cf_offer_role` na Dealu — czy jest już zdefiniowany w instancji produkcyjnej? Jeśli nie, spec powinien uwzględnić kroki konfiguracji lub automatyczne tworzenie przez `setup.ts`.

3. **Integracja `apply-to-deal` — mechanizm update**: Czy akceptowalne jest, że moduł `project_costing` bezpośrednio aktualizuje `customer_deals.value_amount` przez raw ORM update (cross-module), czy wymagany jest event subscriber w `customers` module (co by wymagało zmiany w `packages/core`)?

4. **Waluta kalkulacji vs waluta deala**: Czy kalkulacja zawsze ma tę samą walutę co deal (`value_currency`)? Czy możliwe kalkulacje wielowalutowe (np. materiały w EUR, robocizna w PLN)?

5. **Szablony a segmenty — preload danych**: Czy chcesz, żeby spec uwzględnił pakiet seed z typowymi stawkami dla prefabrykacji żelbetowej (np. cena betonu C30/37 ~380 PLN/m³, stal zbrojeniowa ~3200 PLN/t, roboczogodzina montażu ~60 PLN/h) jako punkt startowy dla nowych tenantów, czy dane cennikowe mają być zawsze wprowadzane ręcznie?

6. **Prognoza produkcji — granularność**: Prognoza 6 miesięcy opiera się na `production_start_at` kalkulacji. Czy wystarczy jeden przedział per deal (start–koniec), czy potrzebna jest bardziej szczegółowa harmonogramacja (np. per typ elementu / per etap)?

7. **Projekt (`klin:project`) — suma deali**: Potwierdzenie reguły: do sumy projektu wchodzą **tylko** deale z `cf_offer_role = 'primary'`? Co z dealem `primary`, który zmienił status na `lost` — odejmuję go od sumy projektu natychmiast czy po zamknięciu okresu?

8. **Limit wierszy importu**: Zaproponowany limit 5000 wierszy / 10 MB per import — czy to odpowiednie dla rzeczywistych arkuszy prefabrykacji?

9. **Wersje wysłane klientowi — blokada**: Po `mark-sent` / `lock` — czy użytkownik z rolą `admin` powinien móc odblokować kalkulację (np. dla korekty błędu), czy blokada jest trwała?

10. **Eksport PDF**: Czy PDF kalkulacji (wycena dla klienta) jest potrzebny już w v1, czy wystarczy XLSX/CSV?

---

## 15. Rozwiązane założenia autonomiczne

> Założenia podjęte samodzielnie przez agenta z braku wyraźnej decyzji w briefie. Każde może być nadpisane przez Marka przed implementacją.

| # | Obszar | Założenie | Uzasadnienie |
|---|--------|-----------|--------------|
| A1 | Biblioteka siatki | `adazzle/react-data-grid` v7 (MIT) | Najlżejsza opcja z natywnym Excel-like UX; TanStack Table wymaga dużej własnej implementacji klawiatury/paste |
| A2 | Narzut vs marża | Narzut = dodawany do kosztu (nie do ceny), marża wyliczona od ceny | Zgodne z polską praktyką budowlaną i terminologią KNR |
| A3 | Aktywna kalkulacja | Unique partial index w DB (nie soft constraint) | Gwarancja integralności bez warstwy aplikacyjnej |
| A4 | Catalog module | Nie aktywować w v1; własna tabela `pc_element_types` | RAM VPS, brak `requires` catalog w upstream, prostszy sync |
| A5 | Waluta | Jednowalutowa kalkulacja (PLN) w v1 | Eliminuje złożoność konwersji; v2 integruje `currencies` |
| A6 | Limity importu | 5000 wierszy / 10 MB | Kompromis między typowymi arkuszami budowlanymi a RAM VPS |
| A7 | Auto-save | Debounce 800 ms, `PATCH` per linia | Minimalizuje requesty; batch upsert dla wklejania wielu wierszy |
| A8 | Cennik zewnętrzny | v1 = tylko własny cennik; v2 = adaptery pliki Sekocenbud/Intercenbud | API zewnętrznych dostawców niedostępne publicznie |
| A9 | Prognoza produkcji | `production_start_at` na poziomie kalkulacji (nie linii) | Upraszcza model; szczegółowa harmonogramacja per linia = v2 |
| A10 | Mockupy UI | Pominięte (`--no-mockups`) | Ograniczenie środowiska (małe VPS); zakładka deala dobrze opisana tekstowo |

---

## 16. Migracje i backward compatibility

Moduł dodaje **wyłącznie nowe tabele** (`pc_*`). Zero zmian w tabelach `packages/core`. Brak ryzyka backward compatibility dla upstream.

Kolejność migracji (MikroORM):
1. `pc_segments`
2. `pc_cost_categories`
3. `pc_element_types`
4. `pc_price_catalog`
5. `pc_calculation_templates` + `pc_calculation_template_lines`
6. `pc_calculations`
7. `pc_calculation_lines`
8. `pc_import_column_mappings`

---

## 17. Pliki modułu (szkielet)

```
apps/mercato/src/modules/project_costing/
├── index.ts                    # rejestracja modułu
├── acl.ts                      # features
├── analytics.ts                # analytics config
├── events.ts                   # defineModuleEvents
├── setup.ts                    # seed: kategorie, segment precast
├── di.ts                       # DI: serwisy
├── extension-points.ts         # hosts (jeśli moduł eksponuje spoty)
├── api/
│   ├── segments/route.ts
│   ├── cost-categories/route.ts
│   ├── element-types/route.ts
│   ├── price-catalog/route.ts
│   ├── price-catalog/export/route.ts
│   ├── price-catalog/import/route.ts
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
│   ├── calculations/[id]/export/route.ts
│   ├── calculations/[id]/import/route.ts
│   ├── calculation-lines/route.ts
│   ├── calculation-lines/[id]/route.ts
│   ├── calculation-lines/batch/route.ts
│   └── import-column-mappings/route.ts
├── backend/
│   ├── project-costing/
│   │   ├── segments/page.tsx
│   │   ├── segments/[id]/page.tsx
│   │   ├── templates/page.tsx
│   │   ├── templates/[id]/page.tsx
│   │   ├── price-catalog/page.tsx
│   │   ├── price-catalog/[id]/page.tsx
│   │   ├── calculations/page.tsx
│   │   └── calculations/[id]/page.tsx
├── components/
│   ├── CalculationGrid.tsx     # react-data-grid wrapper
│   ├── CalculationSummary.tsx  # panel podsumowania
│   ├── ImportWizard.tsx        # kreator importu
│   └── VersionSelector.tsx     # dropdown wersji
├── data/
│   ├── entities.ts             # MikroORM entities
│   └── validators.ts           # zod schemas
├── i18n/
│   ├── pl.json
│   └── en.json
├── migrations/
│   └── Migration20261019*.ts   # migracje DB
├── widgets/
│   ├── index.ts                # rejestracja widgetów
│   └── DealCalculationTab.tsx  # zakładka deala
└── lib/
    ├── calculation.service.ts  # recalc, activate, apply-to-deal
    └── import.service.ts       # parsowanie XLSX/CSV
```

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-19 | Inicjalna wersja specyfikacji (autonomous, `om-auto-write-spec`) |
