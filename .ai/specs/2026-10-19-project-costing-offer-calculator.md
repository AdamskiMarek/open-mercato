# Spec: Moduł Koszty Projektu + Kalkulator Ofert (`project_costing`)

<!-- Source doc: .ai/specs/2026-10-19-project-costing-offer-calculator.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-19 |
| **Rewizja** | 2026-10-23 (rev 8e — D83: split inwestycji w v1, nity n8n przy D81 (`bulk-update-owner`, lookup + POST/PUT, `auth: null`, R21); poprzednio rev 8d, rev 8c, rev 8b 2026-10-23, rev 8a 2026-10-20) |
| **Moduł** | `project_costing` (`apps/mercato/src/modules/project_costing`) |
| **Nisza v1** | Prefabrykacja żelbetowa |
| **Docelowo** | Cała branża budowlana (multi-segment) |
| **Zależności upstream** | `customers`, `dictionaries`, `dashboards`, `currencies`, `attachments`, `notifications`, `directory`, `configs` (ModuleConfigService), `audit_logs`, `query_index`, `progress` (ProgressJob), `feature_toggles` |
| **Moduł powiązany** | `project_schedule` (spec: `.ai/specs/2026-10-19-project-schedule.md`) — **opcjonalny konsument**: zależy od `project_costing` i rejestruje swój provider `ScheduleSource` w DI. `project_costing` = moduł bazowy, nigdy nie importuje `project_schedule` (rev 8a, Kod P0-1) |
| **Wyłączone upstream** | `sales`, `workflows`, `catalog`, `business_rules` (rev 8b: przeliczniki jednostek `catalog` są per produkt — nie używamy, §2.4) |

---

## TLDR

- **Co:** moduł aplikacji `project_costing` (fork, `apps/mercato/src/modules`, zero zmian w `packages/core`): kalkulator kosztów i ofert „jak Excel” dla firm budowlanych (v1: prefabrykacja żelbetowa). Kalkulacja może istnieć bez deala.
- **MVP (rev 8b):** siatka kosztów (sekcje → pozycje, linie `note`), import XLSX (ProgressJob + worker), tryby ceny A (suma linii) i C (koszt × (1 + narzut)), prosty cennik firmy z akcją „Przelicz z cennika” (D57), mark-sent ze snapshotem + PDF oferty (pdf-lib) z walidacją D58, apply-to-deal z wersji aktywnej (jawny przycisk, D59/D66), widoczność przez RBAC (`acl.ts`), minimalne `pc_investments` + `pc_deal_offer_roles` (D50/D51/D65), partie produkcji ręczne i z importu XLSX (`xlsx_import`, D50/D56) z prognozą 6 mies. **Bez Gantta, bez formuł, bez eksportu XLSX.** Zakres faz: §14 (listy funkcji i encji, bez estymat — P11).
- **Architektura:** `project_costing` = moduł bazowy. Posiada interfejs `ScheduleSource` i rejestr w DI (Awilix). Opcjonalny `project_schedule` zależy od costing i rejestruje swój provider. Zero HTTP między modułami; dane przez serwisy DI, eventy (payload = same ID), FK-id + snapshot, widget + enricher. Zapisy przez komendy (undo, `audit_logs`), CRUD przez `makeCrudRoute` + indexer.
- **Oferta główna/alternatywna:** własna encja-rozszerzenie `pc_deal_offer_roles` (deklaracja w `data/extensions.ts`), partial unique na `primary`, przełączenie jedną komendą w jednej transakcji. Zero zapisów do pól/tabel `customers` (jedyny wyjątek: jawna komenda `customers.deals.update` w apply-to-deal, uruchamiana przez użytkownika).
- **Ukryta marża = ukryty koszt** dla roli bez `project_costing.view_margin`; reguła obowiązuje we wszystkich kanałach (API, query_index, search, audit, eventy, eksport, PDF, compare, analityka, snapshot).
- **Firma = organizacja OM.** Ustawienia per organizacja przez `ModuleConfigService` (`module_configs`), bez własnej tabeli `pc_settings`.
- **Inwestycja = jedna encja `pc_investments`** (D63, kanoniczna; MVP minimalnie: ręczne wskazanie z podpowiedzią po kodzie; v1: identyfikatory zewnętrzne, dopasowanie, merge i split — D83). Inwestycje zakłada handlowiec (n8n ich nie tworzy). `klin:project` importujemy po `--dry-run` i akceptacji raportu, potem wyłączamy.
- **Zaokrąglenia (D62/D16):** half-up do 2 miejsc per linia; sumy = suma zaokrąglonych linii; konfigurowalne per organizacja (`rounding.*`).
- **Zakres faz:** §14 — MVP/v1/v2 jako listy funkcji i encji; estymaty w dniach usunięte (P11).

---

## Streszczenie

Moduł `project_costing` dostarcza kalkulator kosztów ofertowych przypiętych do Deali. Kluczowe cechy (stan rev 8b):
- **Oferta = zamrożony snapshot** wersji kalkulacji wysłanej klientowi (renderowane linie + sumy + proweniencja cen w momencie wysyłki).
- **Typy linii**: `section` / `item` / `note` z hierarchią (sekcja → pozycje, jeden poziom) i dziedziczonym narzutem; sumy sekcji renderowane automatycznie, bez wiersza sumy częściowej (D78; rev 8b: `subtotal` usunięty).
- **Cykl życia wersji**: `draft` → `sent` → `accepted`/`rejected`/`superseded`; numeracja `K/2026/001-R1` z sekwencji Postgresa per organizacja; „Nowa rewizja” jako jedna akcja (D57).
- **Layered price list** (v1): wielopoziomowe reguły cennikowe (zakres: global/segment/kategoria/pozycja, baza: koszt/inna lista/fixed).
- **Koszty rzeczywiste** (`CostEntry`, v1): wpisy kosztu do budżetu vs realizacja per kategoria.
- **Widoczność marży**: domyślnie UKRYTA; wyłącznie przez feature'y RBAC (`acl.ts`); ukryta marża ⇒ ukryty koszt (rev 8a).

> Zakres MVP/v1/v2 — §14. Pojęcia „projekt” (`klin:project`) i `cf_offer_role` zostały usunięte z modelu (§3.12, §10.4; D63, D64).

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

Wszystkie zapisy domenowe przez komendy (`packages/core/AGENTS.md` l.8–13): audyt w `audit_logs` (`action_logs`), undo, cache, eventy, indeks. Trasy CRUD przez `makeCrudRoute` z `indexer: { entityType, buildUpsertPayload }` i `openApi`; trasy akcji (mark-sent, apply-to-deal, set-primary, recalc) jako własne trasy wywołujące komendy, przez mutation guard. Komendy MVP: `project_costing.calculations.create|update|delete|save_lines|recalc|recalc_from_catalog|mark_sent|activate|attach_deal|detach_deal|attach_investment|detach_investment|apply_to_deal|refresh_schedule_totals`, `project_costing.price_catalog.*`, `project_costing.cost_categories.*`, `project_costing.element_types.*`, `project_costing.production_batches.*`, `project_costing.schedule_import.commit` (z workera), `project_costing.import.commit` (z workera), `project_costing.investments.create|update`, `project_costing.offer_roles.assign|set_primary`. v1: `…investments.merge`, `…investment_identifiers.*`, `…calculations.new_revision|mark_accepted|mark_rejected`, `…cost_entries.*`, `…price_list_rules.*`, `…segments.*`, `…templates.*`.

**Write path (rev 8b, Kod p6/p8):**
- **Jedna czysta funkcja `calculate(input, settings) → { lines, totals, issues }`** w `lib/calculate.ts`, współdzielona przez klienta (siatka liczy na żywo) i serwer (komendy). Wejście = pola wejściowe linii + nagłówka + ustawienia `rounding.*`; wyjście = pola pochodne linii (`line_cost`, `line_price`, `line_margin`, `line_margin_pct`, `line_full_cost`, w trybie B `unit_price` pozycji bez override), sumy nagłówka i lista problemów (ujemne ceny, ujemna marża, pusta sekcja — §3.8). Problem „ujemna marża” zdradza znak marży, więc serwer zwraca go tylko użytkownikowi z `view_margin`; pozostali widzą go dopiero przy mark-sent jako blokadę bez znaku i kwoty (D76, §3.8). Klient bez `view_margin` nie dostaje danych, z których mógłby go policzyć (§4.2).
- **Minimalny zapis.** Autosave wysyła tylko zmienione wiersze (pola wejściowe) do `POST .../calculation-lines/batch` → komenda `calculations.save_lines`: w jednej transakcji zapisuje wejścia zmienionych linii, przelicza `calculate()` po stronie serwera i zapisuje **sumy w nagłówku**. Pola pochodne linii nie są przechowywane w wierszach (liczone przy odczycie tą samą funkcją); zamrażane są w `pc_offer_snapshots` przy mark-sent. Tryb B nie przepisuje wszystkich wierszy.
- **Lock na nagłówku.** Komenda przyjmuje `updatedAt` nagłówka (optimistic locking); konflikt → 409 i odświeżenie siatki. W transakcji `SELECT … FOR UPDATE` tylko na wierszu `pc_calculations`; linie są sub-resource bez osobnego locka. Bez `SERIALIZABLE`.
- **Jeden event na zapis** (`project_costing.calculation.updated`, payload z ID), indeksowany jest tylko nagłówek (bez kwot, §4.3). Bez eventu i broadcastu per linia.
- **Audyt (`audit_logs`).** Każda komenda zapisuje: aktora (`user_id`), czas, `command_id`, ID encji i powiązań (kalkulacja, deal, inwestycja), `changed_fields` oraz wartości old/new pól niewrażliwych (ilość, jednostka, etykieta, tryb ceny, status wersji, rola oferty, powiązania). Dla pól kosztu, narzutu i marży (`unit_cost`, `markup_pct`, `markup_rate`, `overhead_rate`, `target_margin_rate`) zapisujemy tylko nazwę pola w `changed_fields`, bez wartości (§4.3); historia ich wartości per wersja jest w `pc_offer_snapshots`. Ceny sprzedaży (`unit_price`) mają old/new.
- **Undo i redo pól bez wartości w audycie (rev 8c, uzupełnione).** Komendy OM cofają i ponawiają zmianę na podstawie `CommandLogMetadata` z `buildLog` (`undoToken`, `payload`, `snapshotBefore`, `snapshotAfter`, `changes`, `redoInput`; `packages/shared/src/lib/commands/types.ts`, `undo.ts` — `extractUndoPayload`). Szyna komend zapisuje w `action_logs.command_payload` envelope redo z inputem komendy; gdy `redoInput` nie jest ustawiony, zapisuje **surowy input** (`CommandLogMetadata.redoInput`, `types.ts` l. 123–133). Ponieważ `action_logs` nie może zawierać kosztu, narzutu ani marży, każda komenda modułu, której input zawiera pole wrażliwe (lista §4.2: `unit_cost`, `markup_pct`, `markup_rate`, `overhead_rate`, `target_margin_rate` i kwoty pochodne) — m.in. `calculations.create`, `calculations.update`, `calculations.save_lines`, `calculations.recalc`, `calculations.recalc_from_catalog`, `import.commit`, zapisy cennika, linii szablonów i kosztów rzeczywistych:
  1. w `buildLog` ustawia **`redoInput` na projekcję zredagowaną** (input bez wartości pól wrażliwych: ID, pola niewrażliwe, nazwy zmienionych pól), a `payload`, `snapshotBefore`, `snapshotAfter` i `changes` buduje również bez tych wartości (pola niewrażliwe old/new, `changed_fields`, `undoToken`);
  2. w tej samej transakcji zapisuje wartości pól wrażliwych sprzed zmiany (pre-image, `fields_before`) i po zmianie (post-image, `fields_after`) w tabeli modułu `pc_command_undo_payloads` (`id`, `organization_id`, `tenant_id`, `undo_token` UNIQUE, `calculation_id` NULL, `fields_before jsonb`, `fields_after jsonb` — tylko pola wrażliwe zmienione przez komendę, `created_at`; indeks `(organization_id, tenant_id, calculation_id)`);
  3. `undo()` czyta wiersz po `undoToken` **z filtrem `organization_id` i `tenant_id` z kontekstu komendy** i przywraca pola wrażliwe z `fields_before`, a pola niewrażliwe z `snapshotBefore`; `redo()` (handler `redo` szyny komend, z `redoLogEntry`) czyta ten sam wiersz z tym samym filtrem i łączy zredagowany `redoInput` z `fields_after`. `authorizeReplay` dla `undo` i `redo` wymaga `project_costing.edit` i prawa do zapisu przywracanych pól (§4.2; pole niewidoczne → 403, jak przy edycji). Redo zapisuje nowy wpis `action_logs` z nowym `undoToken` i nowym wierszem; wiersz źródłowy jest wtedy usuwany;
  4. komenda, która nie zapisuje post-image, ustawia jawnie `replayable: false` (wpis audytu bez tokenu undo i bez `command_payload`, bez undo i redo) — „bez redo” jest decyzją komendy, nie skutkiem ubocznym;
  5. `pc_command_undo_payloads` nie ma trasy API, nie jest indeksowany w `query_index`, wyszukiwany ani wysyłany w eventach; czytają go wyłącznie handlery `undo()` i `redo()`;
  6. retencja (twarde usuwanie): (a) **mark-sent** — usuwane wszystkie wiersze tej kalkulacji (linie wersji wysłanej są immutable, więc undo i redo zmian kosztowych po mark-sent nie istnieją); (b) **usunięcie kalkulacji** (komenda `calculations.delete`, także soft delete) — usuwane wiersze tej kalkulacji w tej samej transakcji; (c) **usunięcie wpisu `action_logs`** (czyszczenie audytu) albo jego zastąpienie przez redo — wiersz bez odpowiadającego wpisu `action_logs` z tym `undo_token` usuwa worker czyszczący (anti-join po `undo_token`, `organization_id`, `tenant_id`), a redo usuwa wiersz źródłowy od razu (pkt 3). Moduł nie zakłada „okna undo” — wiersz żyje tak długo, jak wpis `action_logs`, z którego można go użyć;
  7. jawny wyjątek od reguły `deleted_at` (`packages/core/AGENTS.md` § Database Entities): `pc_command_undo_payloads` to tabela techniczna, nie encja domenowa — bez `deleted_at`, `updated_at` i encji CRUD; wiersze usuwane twardo, bo zachowanie ich po usunięciu byłoby właśnie przechowywaniem wartości, których audyt nie może trzymać.
  Ryzyko: R19 (§15).
- **Benchmark:** `calculate()` i `save_lines` na 10 000 liniach w testach unit/integracyjnych (R1).

### 0.4 Eventy

`project_costing.*` (§10.1). **Payload = wyłącznie identyfikatory** (`id`, `organizationId`, `tenantId`, `dealId?`, `investmentId?`) — bez kosztów, cen ani marży; `clientBroadcast` tylko z ID (UI dociąga dane przez API z redakcją). Subskrypcje cudzych eventów: `customers.deal.won`, `customers.deal.lost`, `customers.deal.updated`, `customers.deal.deleted` (persistent; mapowanie statusów — §0.6).

### 0.5 Granice i konfiguracja

| Temat | Rozstrzygnięcie (rev 8a/8b) |
|---|---|
| Firma | = organizacja OM (D15). Ustawienia i włączniki funkcji per organizacja. |
| Ustawienia | `ModuleConfigService` (`packages/core/src/modules/configs/lib/module-config-service.ts`), tabela `module_configs`; brak `pc_settings` (§2.2). |
| Widoczność kosztów/marży | wyłącznie RBAC (`acl.ts`) — §4, §9. Ustawienie „per firma” = domyślne przypisanie feature'ów do ról (`setup.ts` `defaultRoleFeatures` + edycja ról w organizacji). |
| Włączenie harmonogramu | build (`apps/mercato/src/modules.ts`); włącznik per organizacja = `schedule.enabled` w ModuleConfigService (`module_configs`) + feature'y ACL `project_schedule.*` + blokady w menu, zakładce deala i API; `feature_toggles` wyłącznie jako globalny kill-switch per tenant — schedule §1.0. |
| Inwestycja | jedna encja `pc_investments` (D63; minimalna w MVP — D50); `klin:project` importowany i wyłączany (§10.4). |
| Oferta główna | `pc_deal_offer_roles` (§2.2, §3.12; MVP — D50). |
| Ustawienia per organizacja | klucz `org:{id}:settings` to świadome obejście (D69), bo `ModuleConfigService` ignoruje `organizationId` przy odczycie (R12). |

### 0.6 Statusy deala w OM (rev 8b, Kod p5)

Zweryfikowano w kodzie (`packages/core/src/modules/customers/data/entities.ts`, `CustomerDeal`): `status` (domyślnie `'open'`), `pipeline_stage`/`pipeline_stage_id`, `probability`, `value_amount`, `value_currency`, `closure_outcome` (text NULL), archiwum = `deleted_at`. Eventy (`customers/events.ts`): `customers.deal.created|updated|deleted|won|lost`.

| Stan w costingu | Źródło w OM | Użycie |
|---|---|---|
| otwarty | `closure_outcome IS NULL` i `deleted_at IS NULL` | prognoza ważona (§3.11), suma inwestycji |
| wygrany | `closure_outcome = 'won'` (event `customers.deal.won`) | prognoza z prawdopodobieństwem 100%; marża po zamknięciu (D49); harmonogram wykonawczy (schedule §5, D24) |
| przegrany | `closure_outcome = 'lost'` (event `customers.deal.lost`) | poza prognozą i sumą inwestycji; marża po zamknięciu (D49) |
| usunięty/zarchiwizowany | `deleted_at IS NOT NULL` (event `customers.deal.deleted`) | poza prognozą i sumą; kalkulacja zostaje (FK-id bez constraintu) |
| ponownie otwarty | `closure_outcome` wraca do NULL (event `customers.deal.updated`) | wraca do prognozy; harmonogram wykonawczy dostaje flagę „deal ponownie otwarty” (`ps_schedules.reopened_at`), bez usuwania danych (D72, §16; schedule §2.2) |

Subscribery (`persistent: true`) zapisują te pola w `pc_calculations.deal_snapshot`. Etapy lejka (`pipeline_stage`) to 9 etapów z D33: `new`, `result_lead`, `qualify`, `contact`, `offer`, `won`, `lost`, `rejected`, `cancelled`; n8n ustawia etap, ale nie zmienia `closure_outcome` (D42). Costing opiera logikę wyłącznie na `closure_outcome` i `deleted_at`; etap służy tylko do grupowania prognozy (§11).


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
| `calculation_scope` | `"all"` | MVP: tylko `all`; `own` od v1 (D79, §4.4) |
| `integrations.n8n_api_key_ids` | `[]` | ID kluczy API integracji n8n (`auth.keyId`), dla których działa interceptor D81 (§10.2); same ID, bez sekretów |
| `pdf.validity_days` | `30` | |
| `pdf.footer_text`, `pdf.contact_email`, `pdf.contact_phone` | `""` | |
| `pdf.company_address`, `pdf.company_nip`, `pdf.company_bank_account` | — | brak w `Organization` (D60: dane do PDF z `module_configs` `pdf.*`) |
| `schedule_source` | `"calculation_embedded"` | §7a.3 |
| `schedule.enabled` | `false` | włącznik modułu harmonogramu per organizacja (schedule §1.0); `project_schedule` czyta go przez `projectCostingSettings` |
| `rounding.mode` | `"half_up"` | rev 8b (D62/D16): `half_up` (połówki od zera: 1,005 → 1,01; −1,005 → −1,01) \| `up` (zawsze od zera) \| `down` (obcięcie); per organizacja |
| `rounding.line_decimals` | `2` | miejsca po przecinku dla wartości linii i sum (0–4); ceny jednostkowe zawsze z 4 miejscami |
| `investments.trgm_threshold` | `0.5` | v1 — próg podpowiedzi pg_trgm (§3.12) |

**Usunięte klucze** (dublowały RBAC — Kod p4/p7, decyzja Koordynatora (e)): `visibility.costs_visible_features`, `visibility.margin_visible_features`, `visibility.prices_visible_features`, `visibility.margin_visible_by_default`, `visibility.margin_visible_after_deal_close` (→ feature `project_costing.view_margin_after_close`, §9). Zaokrąglenia per organizacja (D16/D62) = klucze `rounding.*` powyżej (rev 8b). Waluty inne niż PLN i zaokrąglenie per waluta (ISO 4217) — pytanie otwarte Q7 (§16).

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
| `investment_id` | `uuid` NULL | FK → `pc_investments.id`; NULL = brak inwestycji; ustawiany komendą `attach_investment` (MVP: ręczny wybór z podpowiedzią po kodzie/nazwie). Rev 8b: nazwa, lokalizacja i `investment_key` żyją wyłącznie w `pc_investments` |
| `segment_code` | `text` NULL | |
| `base_code` | `text` NOT NULL | bazowy numer, np. `K/2026/001` |
| `revision` | `int` NOT NULL DEFAULT 1 | numer rewizji; display = `base_code-R{revision}` |
| `label` | `text` NOT NULL | |
| `status` | `text` NOT NULL DEFAULT `'draft'` | `draft` \| `sent` \| `superseded` \| `accepted` \| `rejected` |
| `is_active_version` | `bool` NOT NULL DEFAULT false | jedna true per deal (gdy `deal_id != NULL`); dla kalkulacji standalone: informacyjne |
| `currency` | `char(3)` NOT NULL DEFAULT `'PLN'` | |
| `price_mode` | `text` NOT NULL DEFAULT `'line_prices'` | `line_prices` \| `target_margin` \| `markup` |
| `overhead_rate` | `numeric(6,4)` DEFAULT 0 | koszty pośrednie jako ułamek kosztu (0.10 = 10%); `CHECK (overhead_rate >= 0)` |
| `markup_rate` | `numeric(6,4)` NULL | tryb C / narzut na poziomie kalkulacji (dziedziczony przez sekcje/pozycje); ułamek: 0.30 = cena × 1.30; `CHECK (markup_rate > -1)` |
| `target_margin_rate` | `numeric(6,4)` NULL | tryb B; ułamek (0.25 = 25% marży od ceny); `CHECK (target_margin_rate >= 0 AND target_margin_rate < 1)` |
| `subtotal_cost` | `numeric(14,2)` NULL | SUM(zaokrąglonych item line_cost); zapisywane przez `save_lines`/`recalc` |
| `overhead_amount` | `numeric(14,2)` NULL | subtotal_cost × overhead_rate |
| `full_cost` | `numeric(14,2)` NULL | subtotal_cost + overhead_amount |
| `subtotal_price` | `numeric(14,2)` NULL | cena oferty |
| `total_margin` | `numeric(14,2)` NULL | subtotal_price − full_cost |
| `margin_rate` | `numeric(6,4)` NULL | total_margin / subtotal_price |
| `total_quantity_m3` | `numeric(14,3)` NULL | cache przez `ScheduleSource` (§7a): komenda `refresh_schedule_totals` z kolejki z debounce (§7a.4) |
| `total_quantity_pcs` | `numeric(14,0)` NULL | cache przez `ScheduleSource` (§7a), jw. |
| `production_start_at` | `date` NULL | cache przez `ScheduleSource` (§7a), jw. |
| `production_end_at` | `date` NULL | cache przez `ScheduleSource` (§7a), jw. |
| `schedule_source_override` | `text` NULL | §7a.3; NULL = ustawienie organizacji |
| `notes` | `text` NULL | |
| `sent_at` | `timestamptz` NULL | |
| `template_id` | `uuid` NULL | FK → `pc_calculation_templates.id` |
| `created_by` | `uuid` NULL | |
| `revision_created_by` | `uuid` NULL | (v1) autor „Nowej rewizji”, która utworzyła tę wersję (D57) |
| `revision_created_at` | `timestamptz` NULL | (v1) |
| `revision_reason` | `text` NULL | (v1) powód „Nowej rewizji” (D57); źródłem audytu jest metadana komendy `new_revision` w `audit_logs` |
| `deal_snapshot` | `jsonb` NULL | snapshot pól deala: `title`, `value_currency`, `probability`, `status`, `closure_outcome`, `pipeline_stage`, `expected_close_at`, `owner_user_id`, `deleted` (§0.6); odświeżany subscriberami `customers.deal.*` (persistent); bez HTTP |
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

Constraints: `CHECK (status IN ('draft','sent','superseded','accepted','rejected'))`, `CHECK (price_mode IN ('line_prices','target_margin','markup'))`, `CHECK (target_margin_rate IS NULL OR (target_margin_rate >= 0 AND target_margin_rate < 1))`, `CHECK (overhead_rate >= 0)`, `CHECK (markup_rate IS NULL OR markup_rate > -1)`.

**Numeracja** (rev 8b, Kod p18): `base_code = K/{YYYY}/{NNN}` z sekwencji Postgresa per (organizacja, tenant, rodzaj) według wzoru `SalesDocumentNumberGenerator` (`packages/core/src/modules/sales/services/salesDocumentNumberGenerator.ts`: rejestr sekwencji w tabeli, `nextval` na sekwencji dedykowanej). Własny rejestr `pc_document_sequences` (`organization_id`, `tenant_id`, `kind`, `sequence_name`); `kind = 'calculation:{YYYY}'` (numeracja od 1 w każdym roku). `NNN` = co najmniej 3 cyfry, bez górnego limitu. Luki w numeracji są dopuszczalne (sekwencje nie są transakcyjne). `revision` startuje od 1 i rośnie przy każdej „Nowej rewizji” (D57). Display code: `base_code-R{revision}` gdy `revision > 1`, sam `base_code` gdy `revision = 1`.

**Kalkulacja standalone** (bez deala): `deal_id = NULL`. Może być tworzona i edytowana niezależnie. `apply-to-deal` działa wyłącznie gdy `deal_id != NULL`. Deal dołączany przez `attach-deal`; inwestycja przez `attach-investment` (MVP). (Rev 8a: `project_id`/`attach-project` usunięte — jedna encja inwestycji, §10.4.) Scope „own" dla standalone: `created_by = current_user_id`.

**Kalkulacja bez deala a prognoza (D61):** kalkulacja bez deala nie wchodzi do prognozy ważonej; jest pokazywana osobno (§3.11, §11).

**Indeks `investment_key`** (rev 8b): tylko na `pc_investments` (§2.2 `pc_investments`); na `pc_calculations` zostaje wyłącznie FK `investment_id`.

#### `pc_calculation_lines` — linie kalkulacji (z hierarchią i typami)

| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| `id` | `uuid` PK | |
| `calculation_id` | `uuid` NOT NULL | FK → `pc_calculations.id` |
| `organization_id` | `uuid` NOT NULL | |
| `tenant_id` | `uuid` NOT NULL | |
| `parent_line_id` | `uuid` NULL | FK → `pc_calculation_lines.id`; NULL = linia główna; MVP: rodzicem może być tylko `section`, a sekcja nie ma rodzica (jeden poziom, wymuszane w serwisie) |
| `line_type` | `text` NOT NULL DEFAULT `'item'` | `section` \| `item` \| `note` |
| `cost_category_id` | `uuid` NULL | FK → `pc_cost_categories.id`; wymagane dla `item` |
| `element_type_id` | `uuid` NULL | FK → `pc_element_types.id` |
| `label` | `text` NOT NULL | |
| `quantity` | `numeric(14,4)` NULL | item only; `CHECK (quantity IS NULL OR quantity >= 0)`; 0 dozwolone (§3.1) |
| `unit_id` | `uuid` NULL | item only; FK-id → wpis słownika jednostek (§2.4) |
| `unit_cost` | `numeric(14,4)` NULL | item only |
| `unit_price` | `numeric(14,4)` NULL | item only |
| `markup_pct` | `numeric(6,4)` NULL | narzut cenowy tej linii/sekcji jako ułamek (0.30 = × 1.30); NULL = dziedziczony; `CHECK (markup_pct IS NULL OR markup_pct > -1)` |
| `price_override` | `bool` NOT NULL DEFAULT false | true = cena ręczna; „Przelicz z cennika” i redystrybucja trybu B jej nie zmieniają (D57) |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `catalog_entry_id` | `uuid` NULL | FK → `pc_price_catalog.id` |
| `price_source_id` | `uuid` NULL | FK → `pc_price_sources.id` |
| `price_source_item_code` | `text` NULL | |
| `price_captured_at` | `timestamptz` NULL | |
| `price_captured_unit_cost` | `numeric(14,4)` NULL | |
| `price_captured_unit_price` | `numeric(14,4)` NULL | |
| `import_error` | `bool` DEFAULT false | linia zaimportowana z błędem do poprawy (§6.2); blokuje mark-sent (D58) |
| `import_error_reason` | `text` NULL | kod błędu, np. `unknown_unit`, `formula_without_value` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Constraint: `CHECK (line_type IN ('section','item','note'))`.

**Pola pochodne** (`line_cost`, `line_price`, `line_margin`, `line_margin_pct`, `line_full_cost`) nie są kolumnami (rev 8b, Kod p8): liczy je `calculate()` (§0.3, §3) przy odczycie i w siatce, a przy mark-sent są zamrażane w `pc_offer_snapshots`.

Reguły per typ:
- `section`: `quantity`, `unit_id`, `unit_cost`, `unit_price` = NULL; `line_cost/price/margin` = agregat dzieci.
- `item`: pełne pola.
- `note`: tylko `label` (i `notes`); żadne wartości numeryczne; nie wliczane do sum; drukowana w PDF (D50).
- Sumy sekcji i kalkulacji renderowane automatycznie (bez osobnego typu linii; rev 8b usuwa `subtotal`, Kod p13). MVP: tylko automatyczne sumy sekcji, bez wiersza sumy częściowej (D78).

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

Snapshot tworzony przy `mark-sent`. `snapshot_data` zawiera: lines (line_type, label, qty, unit, unit_cost, unit_price, line_cost, line_price, line_margin_pct per item — wartości z `calculate()`), rounding (`rounding.*` użyte przy wyliczeniu), totals (subtotal_cost, overhead_amount, full_cost, subtotal_price, total_margin, margin_rate), price_provenance (catalog_entry_id, price_source_id, price_source_item_code, price_captured_at, price_captured_unit_cost/price per linia), fx (kurs zamrożony przy mark-sent — §3.10, D71; dla PLN kurs = 1). PDF generowany z snapshota (nie z bieżących linii).

#### ~~`pc_calculation_audit_log`~~ — usunięte w rev 8a

Audyt akcji (mark-sent, new-revision, accept/reject, activate, apply-to-deal, recalc-from-catalog, set-primary, merge i split inwestycji, importy) pochodzi z `audit_logs` (`action_logs`) zapisywanego przez komendy. Powód „Nowej rewizji” i inne parametry akcji = metadane/payload komendy. Pola kosztu i marży w `snapshot_before`/`snapshot_after`/`changes_json` są redagowane (§4.3). Lista pól audytu: §0.3.

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
| `investment_code` | `text` NOT NULL | wygenerowany stabilny kod `INV-{YYYY}-{NNNNNN}` z sekwencji Postgresa per (organizacja, tenant, `kind = 'investment:{YYYY}'`) w `pc_document_sequences` (wzór `SalesDocumentNumberGenerator`), 6 cyfr z zerami, np. `INV-2026-000123` |
| `name` | `text` NOT NULL | nazwa inwestycji |
| `location` | `text` NULL | lokalizacja |
| `investment_key` | `text` NULL | (v1) `lower(trim(name)) \|\| '\|' \|\| lower(trim(location))`; aktualizowany przez serwis; podpowiedzi pg_trgm |
| `legacy_klin_project_id` | `uuid` NULL | rev 8a: ID rekordu `klin:project` z jednorazowego importu (§10.4); tylko informacyjnie, bez zależności runtime |
| `status` | `text` NOT NULL DEFAULT `'active'` | `active` \| `archived` (MVP); `merged` (v1) |
| `merged_into_id` | `uuid` NULL | (v1) FK → `pc_investments.id`; wypełniony gdy `status = 'merged'` |
| `notes` | `text` NULL | |
| `created_by` | `uuid` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

`UNIQUE (organization_id, tenant_id, investment_code)`.

Indeksy: `(organization_id, tenant_id, status)`; MVP: `(organization_id, tenant_id, investment_code)` + `lower(name)` do podpowiedzi po kodzie/nazwie; v1: `CREATE INDEX pc_investments_investment_key_trgm ON pc_investments USING gin(investment_key gin_trgm_ops)` (`pg_trgm`).

**MVP (D50):** inwestycję zakłada handlowiec (n8n ich nie tworzy — D63) albo wybiera istniejącą z podpowiedzi po kodzie `INV-…` lub nazwie. Bez identyfikatorów zewnętrznych, bez automatycznego dopasowania i bez merge — to v1.

**Merge inwestycji (v1)**: endpoint `POST /api/project-costing/investments/:id/merge` (body: `{ targetId }`). Przenosi kalkulacje (`pc_calculations.investment_id`), role ofert (`pc_deal_offer_roles.investment_id`) i identyfikatory (`pc_investment_identifiers`) na `targetId`; ustawia `status = 'merged'`, `merged_into_id = targetId`; audyt przez komendę `project_costing.investments.merge` (`audit_logs`). Idempotent. Gdy po merge'u w `targetId` byłyby dwie oferty `primary`, komenda wymaga wskazania jednej (partial unique, `pc_deal_offer_roles`). **Split inwestycji (v1, D83)**: endpoint `POST /api/project-costing/investments/:id/split` (body: `{ newInvestment: { name }, dealIds, primaryDealIds: { source, target } }`), komenda `project_costing.investments.split` (`audit_logs`, ACL `project_costing.admin`). W jednej transakcji tworzy nową inwestycję (`investments.create`, nowy kod `INV-…`) i przenosi na nią wskazane deale: ich kalkulacje (`pc_calculations.investment_id`) i role ofert (`pc_deal_offer_roles.investment_id`); identyfikatory zewnętrzne zostają przy inwestycji źródłowej. Odwraca merge przez nowy rekord (rekord `merged` nie jest przywracany). Ofertę główną każdej z dwóch inwestycji wskazuje użytkownik w kroku podziału (D83); domyślnie zaznaczona jest oferta oryginalna, czyli dotychczasowa `primary` inwestycji źródłowej, w tej inwestycji, do której trafia. W inwestycji bez oferty oryginalnej użytkownik wskazuje główną w tym samym kroku (bez cichej automatyki, A18). Zasady primary jak w D51/D65: najwyżej jedna oferta `primary` na inwestycję (partial unique, `pc_deal_offer_roles`); próba zapisu dwóch `primary` w jednej inwestycji → 422 z komunikatem „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna” (D51) i bez zmian w danych. Split bez ofert w jednej z inwestycji jest dozwolony; pierwsza oferta dołączona później dostaje `primary` (D65). Undo: przywraca `investment_id` kalkulacji i ról oraz poprzednie role z `snapshotBefore`, a nową inwestycję usuwa (soft delete); tylko gdy od podziału nikt nie zmienił ról ani kalkulacji nowej inwestycji, inaczej 409 `UNDO_CONFLICT`.

#### `pc_investment_identifiers` — zewnętrzne identyfikatory inwestycji (v1)

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

**Priorytet identyfikatorów (D6/D62):** e-Zamówienia (`bzp_*`) > TED (`ted_*`) > BIP (`bip_number`) > kod `INV-…`. Nazwa i NIP są tylko podpowiedzią (wymagają potwierdzenia użytkownika).

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

**Kolumna `investment_id` na `pc_calculations`**: jedyne powiązanie kalkulacji z inwestycją (rev 8b: `investment_name`/`investment_location`/`investment_key` usunięte z `pc_calculations`; źródłem prawdy jest `pc_investments`).

#### `pc_deal_offer_roles` — rola oferty deala w inwestycji (encja-rozszerzenie, rev 8a; MVP od rev 8b — D50)

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

#### `pc_production_batches` — partie produkcji w kalkulacji (źródła `calculation_embedded` i `xlsx_import`)

Tabela używana gdy aktywne `ScheduleSource` = `calculation_embedded` (partie ręczne) lub `xlsx_import` (import harmonogramu z XLSX dla firm bez Gantta — D50/D56). Umożliwia prognozę produkcji bez modułu `project_schedule`.

**Jedno źródło prawdy (rev 8b, spójne ze schedule §1.4):** partie kalkulacji należą do `project_costing` (`pc_production_batches`); partie harmonogramu do `project_schedule` (`ps_production_batches`). Prognoza i sumy kalkulacji czytają **wyłącznie aktywne źródło** (§7a.3), więc partie nigdy nie są liczone podwójnie. Przy włączeniu harmonogramu dla kalkulacji `project_schedule` proponuje jednorazowe skopiowanie partii `pc_` → `ps_` (po potwierdzeniu) i ustawia `schedule_source_override = 'internal'`; kierunek tylko `pc_` → `ps_`, nigdy odwrotnie. Wiersze `pc_` zostają nietknięte (tylko do odczytu w UI, gdy aktywne jest `internal`). Po wyłączeniu harmonogramu (D67) aktywne staje się z powrotem źródło kalkulacji, a UI pokazuje ostrzeżenie, że partie mogą być nieaktualne.

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
| `origin` | `text` NOT NULL DEFAULT `'manual'` | `manual` \| `xlsx_import` |
| `import_job_id` | `uuid` NULL | ProgressJob importu, z którego pochodzi wiersz |
| `sort_order` | `int` DEFAULT 0 | |
| `notes` | `text` NULL | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` NULL | soft delete (rev 8c); import zastępujący (D56) i komendy `production_batches.*` oznaczają wiersze jako usunięte; prognoza i sumy pomijają `deleted_at IS NOT NULL` |

Indeksy: `(calculation_id, organization_id, tenant_id)`, `(production_start_at)`.

Constraints: `CHECK (production_end_at >= production_start_at)`, `CHECK (quantity_m3 IS NULL OR quantity_m3 >= 0)`, `CHECK (quantity_pcs IS NULL OR quantity_pcs >= 0)`. Daty jako dni kalendarzowe, koniec włącznie (jak schedule D55).

`pc_calculation_template_lines` (v1) ma `line_type`, `parent_line_id`, `markup_pct` analogicznie do `pc_calculation_lines`.

#### `pc_document_sequences` — rejestr sekwencji numeracji (rev 8b)

Kolumny: id, organization_id, tenant_id, kind (`calculation:{YYYY}` \| `investment:{YYYY}`), sequence_name, created_at. `UNIQUE (organization_id, tenant_id, kind)`. Sekwencję tworzy serwis numeracji przy pierwszym użyciu (wzór `SalesDocumentNumberGenerator`).

### 2.3 Waluta i zaokrąglenia

`numeric(14,2)` dla wartości linii i sum, `numeric(14,4)` dla cen jednostkowych i ilości. Jednowalutowe (§3.10; wiele walut — pytanie Q6, §16, otwarte). Gdy Q6 ≠ (a), liczba miejsc zaokrąglenia kwot w walucie innej niż PLN wynika z kodu waluty ISO 4217 (D70); dla PLN pozostaje 2 (D62).

**Zaokrąglenie (D62/D16):** `round(x)` w tej specyfikacji oznacza zaokrąglenie wg ustawień organizacji `rounding.mode` (domyślnie `half_up`, połówki od zera) do `rounding.line_decimals` miejsc (domyślnie 2). Każda wartość linii jest zaokrąglana osobno; **sumy = suma już zaokrąglonych linii** (nigdy zaokrąglona suma surowa). Ceny jednostkowe wyliczane (tryb B/C) zaokrąglamy do 4 miejsc. Arytmetyka na liczbach dziesiętnych (ciągi/liczby całkowite w groszach), nie na `float`; `Math.round` nie jest używany (dla −0,5 daje 0). Zmiana ustawienia działa na wersje `draft`; wersje wysłane zostają w snapshocie z ustawieniem z chwili mark-sent.

### 2.4 Jednostki i przeliczniki (D17/D62, rev 8b)

- **Lista jednostek** = słownik modułu `dictionaries` (np. `project_costing.units`; `unit_id` → `dictionary_entries.id`). Kody kanonizowane funkcją `canonicalizeUnitCode` z `@open-mercato/shared/lib/units/unitCodes` (już w repo).
- **Weryfikacja w kodzie:** `dictionary_entries` ma pola `value`, `normalized_value`, `label`, `color?`, `icon?`, `position`, `is_default` — **nie ma pola liczbowego na współczynnik**. Przeliczniki `catalog` (`catalog/lib/unitCodes.ts`, `unitResolution.ts`, `product-unit-conversions`) są per produkt, a `catalog` jest wyłączony. Dlatego przeliczniki trzymamy we własnej tabeli.
- **`pc_unit_conversions`** (v1): id, organization_id, tenant_id, `unit_code` (kanoniczny), `dimension` (`length` \| `area` \| `volume` \| `mass` \| `count` \| `time` \| `other`), `factor_to_base` `numeric(18,8)` > 0, `is_base` bool. `UNIQUE (organization_id, tenant_id, unit_code)`; jedna jednostka bazowa per wymiar. Konwersja tylko w obrębie wymiaru; m³ ↔ szt. wyłącznie przez parametr typu elementu (`pc_element_types.volume_m3_per_piece`, v1).
- **MVP:** jednostka linii musi być równa jednostce pozycji cennika; inaczej „Przelicz z cennika” pomija linię i zgłasza ostrzeżenie. Import: nieznana jednostka → linia z `import_error = true` (`unknown_unit`).

---

## 3. Reguły wyliczeń

### 3.1 Wycena pozycji (`item`)

```
line_cost    = round(quantity × unit_cost)      -- round() = rounding.* (§2.3), domyślnie half-up, 2 miejsca
line_price   = round(quantity × unit_price)
line_margin  = line_price − line_cost
line_margin_pct = line_margin / line_price   (gdy line_price > 0, else NULL — wyświetlane „—”)
```

`quantity = 0` (rev 8b, Kod p19): `line_cost = line_price = 0`; pozycja jest pomijana w redystrybucji trybu B i w liczeniu `unit_price` trybu C (cena jednostkowa zostaje bez zmian). Ujemna ilość jest odrzucana (CHECK).

### 3.2 Agregacja sekcji (`section`)

```
section.line_cost  = SUM(child.line_cost  WHERE child.line_type = 'item')
section.line_price = SUM(child.line_price WHERE child.line_type = 'item')
section.line_margin = section.line_price − section.line_cost
section.line_margin_pct = section.line_margin / section.line_price
```

`note` nie jest wliczana do sum. MVP: jeden poziom (sekcja → pozycje), więc suma sekcji obejmuje wszystkie jej pozycje; sumy sekcji są wyłącznie automatyczne, bez wiersza sumy częściowej (D78); sekcja bez pozycji = „pusta sekcja” (ostrzeżenie przy mark-sent, D58; tak samo pozycja z ceną zero — D73).

### 3.3 Sumy kalkulacji

```
subtotal_cost   = SUM(item.line_cost)         -- suma zaokrąglonych linii; tylko item, nie sekcje
overhead_amount = round(subtotal_cost × overhead_rate)
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

Input: `target_margin_rate` na poziomie kalkulacji (ułamek, `0 ≤ m < 1` — CHECK). `target_subtotal_price = round(full_cost / (1 − target_margin_rate))`. Redystrybucja na pozycje wg §3.6.

#### Tryb C — `markup`

Tryb C liczy `unit_price` **per pozycję** z `line_full_cost` i efektywnego narzutu. Brak globalnej redistrybuowania — każda pozycja jest niezależna.

Dla każdej pozycji `item i` z `price_override = false`:
```
line_full_cost_i = round(line_cost_i × (1 + overhead_rate))
effective_markup_i = pierwsze non-NULL z: [item.markup_pct, parent_section.markup_pct,
                                           calc.markup_rate, 0]
line_price_i     = round(line_full_cost_i × (1 + effective_markup_i))   -- narzut jako ułamek: 0.30 = × 1.30
unit_price_i     = round4(line_price_i / quantity_i)   -- gdy quantity > 0; round4 = ten sam tryb, 4 miejsca
```

Pozycje z `price_override = true`: zachowują bieżące `unit_price`, a `line_price = round(quantity × unit_price)`. W trybie C `line_price` jest wartością wiodącą; `unit_price` (4 miejsca) jest pochodną do wyświetlenia, więc `quantity × unit_price` może różnić się od `line_price` o mniej niż jednostkę zaokrąglenia.

```
subtotal_price = SUM(line_price_i)   -- suma zaokrąglonych linii (override i nie-override); tryb C nie ma reszty do rozdzielenia
total_margin   = subtotal_price − full_cost
margin_rate    = total_margin / subtotal_price
```

> **Nazewnictwo (konsekwentne)**:
>
> | Pole | Definicja |
> |------|-----------|
> | `overhead_rate` | % kosztów pośrednich na koszt zakupu (zwiększa koszt) |
> | `full_cost` | `subtotal_cost + overhead_amount` |
> | `markup_rate` | narzut cenowy na `full_cost` jako ułamek (0.30 = × 1.30) — poziom kalkulacji (tryb C, dziedziczony) |
> | `markup_pct` | narzut per pozycja/sekcja jako ułamek — nadpisuje `markup_rate` dla danej gałęzi |
> | `target_margin_rate` | marża od ceny jako ułamek (D14) — input trybu B |
> | `margin_rate` | `total_margin / subtotal_price` — zawsze obliczony z rzeczywistych sum |
> | `line_full_cost` | `line_cost × (1 + overhead_rate)` — koszt pozycji z narzutem pośrednim |
> | `line_margin_pct` | `line_margin / line_price` per pozycja |

### 3.6 Redistrybuowanie cen pozycji (tryb B — `target_margin`)

Stosowane **wyłącznie w trybie B**. Tryb C używa per-item formuły (§3.5).

1. `T = round(full_cost / (1 − target_margin_rate))` (docelowa cena całkowita).
2. `S_ov = SUM(item.line_price WHERE price_override = true)`.
3. `R = T − S_ov`. Gdy `R < 0`: pozycje bez override dostałyby ujemne ceny → `calculate()` zgłasza problem `negative_price`; UI pokazuje ostrzeżenie w edycji, a **mark-sent jest zablokowany** (D58, §3.8).
4. Pozycje N = bez override i z `quantity > 0`: `base = SUM(line_full_cost_i FOR i IN N)`, gdzie `line_full_cost_i = round(line_cost_i × (1 + overhead_rate))`. Proporcja: `base > 0` → `line_full_cost_i / base`; `base = 0` → równy podział `1/|N|`. Gdy N jest puste, `subtotal_price = S_ov` (bez redystrybucji).
5. `new_line_price[i] = round(R × proporcja[i])`; `new_unit_price[i] = round4(new_line_price[i] / quantity[i])`.
6. **Reszta z zaokrągleń** `R − SUM(new_line_price)` trafia do pozycji z N o największym `line_full_cost` (remis: najniższy `sort_order`), więc suma linii = `T` co do grosza. Pozycja wiodąca pozostaje deterministyczna przy tych samych danych (ten sam wynik na kliencie i serwerze).
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
1. Serwis weryfikuje `status = 'draft'` i uruchamia `calculate()`.
1a. **Walidacja (D58):**
   - **Blokuje** (422 `MARK_SENT_BLOCKED` z listą problemów): linie z `import_error = true`; brak pozycji `item`; ujemna cena (`unit_price < 0` lub `line_price < 0`, także z redystrybucji trybu B przy `R < 0`); **ujemna marża, gdy mark-sent wykonuje osoba bez `view_margin` (D76)** — problem z kodem `APPROVAL_REQUIRED` i komunikatem dokładnie „Oferta wymaga zatwierdzenia przez administratora”, bez znaku i bez kwoty (nie wskazuje też, której pozycji dotyczy); taką ofertę wysyła admin (rola z `view_margin`).
   - **Ostrzega** (422 `MARK_SENT_CONFIRMATION_REQUIRED`; ponowienie z `confirmWarnings: true`): ujemna marża (`total_margin < 0` lub `line_margin < 0` na pozycji) — tylko gdy mark-sent wykonuje osoba z `view_margin` (pozostali: blokada D76 powyżej); pusta sekcja; cena zero (`unit_price = 0` na pozycji `item`; D73).
   - **Nie blokuje:** brak deala (oferta standalone jest dozwolona). Cena zero tylko ostrzega (D73), nie blokuje.
2. Tworzy `pc_offer_snapshots.snapshot_data` z bieżącymi liniami, sumami i proweniencją.
3. Ustawia `status = 'sent'`, `sent_at = now()`.
4. Linie `pc_calculation_lines` tej wersji są od tej chwili **immutable** (API nie przyjmuje PATCH).
5. Generuje PDF z `snapshot_data` (nie z linii bazy) jako ProgressJob w workerze (§5.2).

PDF klienta generowany **zawsze ze snapshota** — żadne zmiany konfiguracji cennikowej nie wpływają retroaktywnie.

### 3.9 Cykl życia wersji i `is_active_version`

**Statusy**: `draft` → `sent` → `accepted` | `rejected` | `superseded`.
- `superseded`: gdy powstaje nowa wersja z tej samej `base_code`.
- `accepted`/`rejected`: zmiana ręczna (klient podjął decyzję).
- `is_active_version = true`: tylko gdy `deal_id != NULL`; wersja zasilająca `deal.value_amount`.

**Wersja aktywna (D59):** `is_active_version` wskazuje wersję, z której wolno zastosować wartość do deala. MVP: pierwsza kalkulacja dołączona do deala staje się aktywna automatycznie; zmiana przez komendę `activate` (przycisk „Ustaw jako aktywną”).

**„Nowa rewizja” (D57, v1)** — jedna akcja zamiast dawnych „odblokuj” i „duplikuj”: `POST .../new-revision` (body `{ reason }`) kopiuje wejścia linii do nowej wersji `(base_code, revision + 1)` w stanie `draft`; wersja źródłowa `sent` → `superseded`; nowa wersja przejmuje `is_active_version`, jeśli źródłowa ją miała. Komenda `calculations.new_revision` z powodem w metadanych (`audit_logs`), feature `project_costing.new_revision`.

**„Przelicz z cennika” (D57, MVP):** `POST .../recalc-from-catalog` (komenda `calculations.recalc_from_catalog`, tylko `draft`) odświeża `unit_cost`/`unit_price` i proweniencję (`price_captured_*`) wyłącznie w liniach z `catalog_entry_id` i `price_override = false`; linie z override zostają bez zmian. Wynik: liczba zmienionych i pominiętych linii (z powodem, np. inna jednostka — §2.4).

### 3.10 Waluta kalkulacji

Waluta = `value_currency` z `deal_snapshot` (snapshot przy attach-deal, odświeżany subscriberem) gdy `deal_id != NULL`, else ustawienie `default_currency` (ModuleConfigService). Jednowalutowe. Wiele walut — pytanie Q6 (§16, **otwarte**). Decyzje warunkowe D70 i D71 — obowiązują, gdy Q6 ≠ (a):
- **D70:** waluty jako kody ISO 4217 (`char(3)`, walidacja względem słownika walut); liczba miejsc zaokrąglenia kwot wg minor unit ISO 4217 danej waluty (PLN = 2, zgodnie z D62).
- **D71:** kurs do waluty bazowej organizacji (`default_currency`, potrzebny do sum w prognozie i sumy inwestycji) = kurs średni NBP z tabeli A z dnia mark-sent, zamrożony w `snapshot_data.fx` (`currency`, `base_currency`, `rate`, `nbp_table_no`, `effective_date`, `source: 'nbp_a' | 'manual'`). **Pierwszeństwo: kurs ręczny ma pierwszeństwo przed NBP** — gdy wersja `draft` ma kurs ręczny, mark-sent zamraża go (`source: 'manual'`) i nie pobiera kursu NBP; bez kursu ręcznego mark-sent zamraża kurs NBP (`source: 'nbp_a'`). Ręczna korekta kursu (D71): dozwolona **przed** mark-sent (wartość zapisana w wersji `draft`, `source: 'manual'`, metadana komendy w `audit_logs`); **po** mark-sent zablokowana — kurs w snapshocie jest niezmienny, a zmiana wymaga nowej rewizji. Gdy w dniu mark-sent nie ma tabeli (weekend, święto, przed publikacją), używana jest ostatnia opublikowana tabela A, a `effective_date` wskazuje jej datę (D71; A33). `FX_RATE_UNAVAILABLE` (422 przy mark-sent) tylko wtedy, gdy nie jest dostępna żadna tabela A (np. API NBP niedostępne) i nie podano kursu ręcznego (R17).
- Dla PLN (`currency = default_currency`) kurs = 1, bez wywołania NBP.

### 3.11 Prognoza wartości = wartość × prawdopodobieństwo

Dwie metryki (rev 8b, wniosek planu testów):
```
forecast_unweighted = active_version.subtotal_price                       -- deal otwarty lub wygrany
forecast_weighted   = active_version.subtotal_price × p / 100
  p = deal_snapshot.probability dla deala otwartego; 100 dla closure_outcome = 'won'
```
- Deal przegrany lub usunięty (§0.6) — poza obiema metrykami. Deal z `probability IS NULL` — tylko w nieważonej (oznaczony „brak prawdopodobieństwa”).
- **Kalkulacja bez deala (D61)** — poza prognozą ważoną; pokazywana osobno jako „Kalkulacje bez deala” (suma nieważona).
- Przeliczenie przy zmianie wersji aktywnej, `deal_snapshot` (subscriber) i po `apply-to-deal`. Wartości liczone w zapytaniu z aktualnego stanu (bez przechowywanego `forecast_value`).

Widget dashboardu „Prognoza lejka” (v1, §11): obie metryki per etap lejka (D33) lub `expected_close_at` + osobny wiersz „Kalkulacje bez deala”. API zawsze liczy i filtruje po stronie serwera (z redakcją §4).

### 3.12 Rola oferty (`pc_deal_offer_roles`), suma inwestycji i zarządzanie inwestycjami (MVP minimalnie — D50; dopasowanie, merge i split — v1)

**Rev 8a — usunięte:** podejście z custom field `cf_offer_role` (hardkodowany UUID definicji `73f8260a-…`, który nie istnieje w innym tenancie), EAV na encji obcego modułu, sekwencja dwóch komend `customers.deals.update` z akcją kompensującą i ryzyko R10. Rola oferty jest daną `project_costing` (tabela `pc_deal_offer_roles`, §2.2).

**Reguła sumy inwestycji:**
```
investment_total = SUM(active_calculation(deal).subtotal_price)
  FOR deal IN pc_deal_offer_roles WHERE investment_id = :investment_id
                                     AND offer_role = 'primary' AND deleted_at IS NULL
  AND deal_snapshot.closure_outcome IS DISTINCT FROM 'lost' AND NOT deal_snapshot.deleted   -- §0.6
```
Oferty `alternative` są widoczne w tabeli inwestycji, ale nie wliczane. Suma liczona z danych costingu (aktywna kalkulacja), bez odczytu `deal.value_amount` przez HTTP.

**Przypisanie roli przy dołączeniu deala do inwestycji** (komenda `project_costing.offer_roles.assign`):
- pierwsza oferta w inwestycji → `primary` automatycznie (D65);
- istnieje oferta dla innego wykonawcy → wiersz zapisany jako `alternative`, a UI pokazuje dokładnie komunikat: **„Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”** (D51). Użytkownik wybiera ofertę główną (`set_primary`) albo zostawia bieżący stan.
- Wybór inwestycji przy dołączaniu deala/kalkulacji (MVP): ręcznie, z podpowiedzią po kodzie `INV-…` i nazwie; brak trafienia → „Nowa inwestycja” (komenda `investments.create`).

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

**Migracja istniejących wartości `cf_offer_role`** (546 deali na instancji Marka; D64): jednorazowy import przy wdrożeniu (komenda CLI `yarn mercato project_costing import-offer-roles [--dry-run]`) czyta wartości custom fieldu przez serwis `entities` w DI i tworzy wiersze `pc_deal_offer_roles` dla deali przypisanych do inwestycji (po imporcie `klin:project`, §10.4). Import jest idempotentny: tworzy tylko brakujące wiersze i nie nadpisuje ról zmienionych już w module, więc można go powtórzyć przed wyłączeniem wysyłki z n8n. Bez zależności runtime: moduł nie czyta `cf_offer_role`. **Okres przejściowy (D64):** n8n wysyła `cf_offer_role` do czasu wdrożenia modułu i migracji; potem wysyłkę wyłącza Enka, a pole na dealu zostaje nietknięte (zarządza nim `customers`/Data Designer). Ryzyko R13.

---

**Zarządzanie inwestycjami (entity `pc_investments`)**

Inwestycja (`pc_investments`) żyje w module `project_costing` i jest **jedynym, kanonicznym** bytem „inwestycja/projekt” w systemie (D63; `klin:project` importowany i wyłączany — §10.4). Inwestycje zakłada handlowiec; n8n ich nie tworzy. Każda kalkulacja może być skojarzona z inwestycją przez `pc_calculations.investment_id`, a deal przez `pc_deal_offer_roles`.

**Stabilny kod inwestycji**: `INV-{YYYY}-{NNNNNN}` (sekwencja Postgresa per organizacja, §2.2). Kod jest niezmienny po przypisaniu.

**Dopasowanie (v1) — kolejność priorytetu** (D6/D62: e-Zamówienia > TED > BIP > INV; nazwa/NIP tylko podpowiedź):

1. **Priorytet 1 — zewnętrzne identyfikatory** (`pc_investment_identifiers`): serwis szuka inwestycji z dokładnie pasującym identyfikatorem `(source, value)`. Gdy znaleziono jednoznaczny wynik → automatyczne skojarzenie (bez pytania użytkownika); przy trafieniach w kilku źródłach wygrywa źródło o wyższym priorytecie. Obsługiwane źródła: `bzp_notice_number`, `bzp_procedure_id`, `bzp_procedure_number`, `bzp_plan_item`, `ted_procedure_id`, `ted_notice_id`, `bip_number`, `other`. Formaty zewnętrznych identyfikatorów oznaczone `[do weryfikacji]` w §2.2.

2. **Priorytet 2 — fuzzy-match (fallback)**: gdy brak dopasowania przez identyfikatory, serwis generuje kandydatów przez:
   - **Źródło A — pg_trgm**: `similarity(investment_key, :target_key) > investments.trgm_threshold` na `pc_investments.investment_key`
   - **Źródło B — NIP klienta**: matching po `company.cf_nip` z deala = NIP inwestora w istniejących inwestycjach (odczyt przez query engine / serwis DI `customers`, bez HTTP — rev 8a)
   - Wyniki łączone, zdeduplikowane, posortowane wg `score DESC`. Próg `investments.trgm_threshold` (domyślnie 0.5, per organizacja, §2.2).
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

**Merge/split inwestycji (v1)** (patrz §2.2 `pc_investments`): `POST .../merge`, komenda `project_costing.investments.merge`; `POST .../split`, komenda `project_costing.investments.split` (D83: split w v1, nie w MVP; ofertę główną wskazuje użytkownik w kroku podziału, domyślnie oferta oryginalna; jedna `primary` na inwestycję i komunikat D51 jak przy `offer_roles.assign`/`set_primary`, D65). Obie z audytem w `audit_logs`.

`pg_trgm` wymagane w v1: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` w migracji v1.

### 3.13 Koszty rzeczywiste vs budżet (v1)

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

## 4. Widoczność (wyłącznie RBAC; ukryta marża = ukryty koszt)

### 4.1 Źródło prawdy: `acl.ts`

Widoczność kosztów, cen i marży wynika **wyłącznie** z feature'ów w `project_costing/acl.ts` (§9). Ustawienia modułu nie zawierają list feature'ów ani flag widoczności (Kod p4, D48). „Ustawienie per firma” = które role w organizacji mają dane feature'y: domyślne przypisanie w `setup.ts` `defaultRoleFeatures` (admin/employee), dalej edycja ról w UI auth. Sprawdzanie feature'ów zawsze wildcard-aware (`project_costing.*`), nigdy przez porównanie stringów.

### 4.2 Reguła efektywnej widoczności (Kod P0-3)

Marża = cena − koszt, więc kto widzi cenę i koszt, zna marżę. Dlatego:

```
canSeePrices = has('project_costing.view_prices')
canSeeMargin = has('project_costing.view_margin')                       -- MVP: tylko to (D75)
             || (has('project_costing.view_margin_after_close')          -- od v1 (D75)
                 && calc.is_active_version
                 && deal_snapshot.closure_outcome IN ('won','lost'))   -- D49
canSeeCosts  = has('project_costing.view_costs') && (canSeeMargin || !canSeePrices)
```

- Rola bez prawa do marży, która widzi ceny, **nie widzi też kosztów** (`unit_cost`, `line_cost`, `subtotal_cost`, `overhead_amount`, `full_cost`, `line_full_cost`, koszty rzeczywiste, wariancja budżetu) ani pól, z których da się odtworzyć marżę (`markup_pct`, `markup_rate`, `overhead_rate`, `target_margin_rate`).
- Edycja (`project_costing.edit`) dotyczy tylko pól widocznych dla użytkownika; zapis pola niewidocznego → 403.
- `view_margin` i `view_costs` domyślnie ma tylko `admin`; `employee` domyślnie nie widzi kosztów ani marży (D68). Organizacja zmienia to, edytując role (feature'y zostają w `acl.ts`).
- Redakcja zawsze po stronie serwera (API, eksport, PDF, analityka); UI tylko odzwierciedla odpowiedź API.

### 4.3 Kanały i reguła dla każdego

| Kanał | Reguła |
|---|---|
| API/CRUD (list, detail, sub-resources linii, trasy akcji) | `applyVisibilityRedaction(record, acl)` w `afterList`/`afterGet` i w trasach akcji; pola niewidoczne usuwane (nie `null`) |
| `query_index` (indexer `makeCrudRoute`) | `indexer.buildUpsertPayload` (typ `CrudIndexerConfig`, `packages/shared/src/lib/crud/types.ts`) buduje dokument **bez** pól kosztu, ceny i marży; filtrowanie/sortowanie po kwotach tylko w zapytaniu bazowym z ACL |
| Wyszukiwanie (`search.ts`) | `fieldPolicy` indeksuje tylko `label`, `base_code`, `notes` nagłówka i etykiety linii; kwot nigdy |
| `audit_logs` / `action_logs` (`snapshot_before`, `snapshot_after`, `changes_json`, `command_payload` — `packages/core/src/modules/audit_logs/data/entities.ts`) | komendy budują snapshoty bez pól kosztu/marży (zostają `changed_fields` i ID); kwoty odtwarzalne z `pc_offer_snapshots`, dostępnego przez API z redakcją; `redoInput`, `payload`, snapshoty i `changes` zredagowane — `command_payload` bez kosztu, narzutu i marży (§0.3 pkt 1); undo i redo tych pól przez `pc_command_undo_payloads` (§0.3, R19) |
| `pc_command_undo_payloads` (pre-image i post-image) | brak trasy API, indeksu w `query_index`, wyszukiwania i eventów; czytają tylko `undo()`/`redo()` po `authorizeReplay`, z filtrem org/tenant; twarde usuwanie wg §0.3 pkt 6 |
| Walidacja `calculate()` / mark-sent (`issues`, 422) | „ujemna marża” tylko dla roli z `view_margin`; bez niej — blokada mark-sent z komunikatem „Oferta wymaga zatwierdzenia przez administratora”, bez znaku i kwoty (D76, §3.8) |
| Payloady eventów i `clientBroadcast` | tylko ID (§0.4) |
| Eksport XLSX/CSV (v1) | ta sama funkcja redakcji; kolumny niewidoczne pominięte |
| PDF oferty | strukturalnie bez kosztu, narzutu i marży (dokument dla klienta); generowany ze snapshota |
| `/compare` (v1) | delty kosztów/marży tylko gdy `canSeeCosts`/`canSeeMargin` |
| Analityka/dashboardy (`analytics.ts`) | pola kosztu: `requiredFeatures: ['project_costing.view_costs','project_costing.view_margin']`; marża: `view_margin`; widget TOP/BOTTOM (v1) tylko z `view_margin` |
| Snapshot oferty (`pc_offer_snapshots`) | dostęp wyłącznie przez `GET .../snapshot` z redakcją; nie jest indeksowany ani wysyłany w eventach |
| Notyfikacje | treść bez kwot; link do kalkulacji |

### 4.3a Zamknięty deal (v1 — D75)

W MVP marżę widzi wyłącznie rola z `project_costing.view_margin`; zamknięcie deala niczego nie odsłania (D75). Od v1 feature `project_costing.view_margin_after_close` (zastępuje ustawienie `margin_visible_after_deal_close`) odsłania marżę i koszt wersji aktywnej po zamknięciu deala — przy `closure_outcome` = `won` **albo** `lost` (D49). „Ustawienie organizacji” = przypisanie tego feature'a do ról (domyślnie `admin`; D48). Status deala z `deal_snapshot` (subscribery `customers.deal.won`/`lost`, persistent), bez HTTP.

### 4.4 Scope kalkulacji (`calculation_scope`) — `own` od v1 (D79)

MVP: tylko `"all"` — użytkownik z `project_costing.view` widzi wszystkie kalkulacje organizacji (z redakcją wg §4.2). Wartość `"own"` („tylko własne deale”) wchodzi w v1 (D79); do tego czasu API ustawień odrzuca `own` (422).

v1: `"all"` (default) | `"own"`:
- Gdy `deal_id != NULL`: „own" filtruje po właścicielu deala.
- Gdy `deal_id IS NULL` (standalone): „own" filtruje po `created_by = current_user_id`.
- Admin (`project_costing.admin`) zawsze widzi wszystkie.
- Wartość z ustawień organizacji (ModuleConfigService, §2.2).

---

## 5. PDF oferty

### 5.1 Frozen snapshot + PDF

PDF generowany zawsze z `pc_offer_snapshots.snapshot_data` — niezmienny po wysyłce. Dane firmy: `Organization.name` + `Organization.logoUrl` z `directory` + brakujące pola z ustawień `pdf.*` (ModuleConfigService, §2.2).

### 5.2 Renderowanie: `pdf-lib` (już w repo)

Rev 8b (Kod p10): PDF składamy biblioteką `pdf-lib`, która jest już zależnością `packages/core` (`packages/core/package.json` l.256; wzór użycia: `packages/core/src/modules/forms/services/pdf-snapshot-service.ts`). Bez nowej zależności i bez Chromium. Generowanie zawsze jako ProgressJob + worker (`@open-mercato/queue`); wynik zapisany w `attachments` i w `pc_calculation_pdf_attachments`. Font z polskimi znakami osadzany w PDF (plik fontu w module).

### 5.3 Zawartość PDF

Logo + dane firmy, numer oferty (display code `K/2026/001-R2`), data, ważność, dane odbiorcy, hierarchiczna tabela pozycji (sekcje z automatyczną sumą + pozycje, `note` stylizowana inaczej), kolumny: label, qty, unit, unit_price, line_price. **Bez** unit_cost, line_cost, narzutu, marży. Warunki, stopka, podpis.

### 5.4 Endpointy

```
POST /api/project-costing/calculations/:id/mark-sent      (tworzy snapshot + zamraża)
POST /api/project-costing/calculations/:id/generate-pdf   (generuje PDF ze snapshota)
GET  /api/project-costing/calculations/:id/pdf-attachments
```

---

## 6. Import / Eksport

### 6.1 Biblioteka XLSX: `exceljs` v4.4.0 (MIT) — zaakceptowana (D74)

Nowa zależność produkcyjna (ostatnie wydanie 2023-10-19) — zaakceptowana (D74; root `AGENTS.md` l.26; §18a). Instalacja dopiero przy implementacji, nie na etapie speki. Odczyt strumieniowy (`WorkbookReader`).

### 6.2 Import XLSX/CSV — kreator mapowania (MVP, rev 8a)

Rev 8a: import XLSX jest w **MVP** (decyzja Koordynatora (a) — główna potrzeba: przeniesienie kosztów z Excela). Wykonanie: upload i podgląd synchronicznie, zatwierdzenie jako ProgressJob + worker kolejki, zapis komendą `project_costing.import.commit`. MVP nie ma formuł — importujemy wartości komórek.

**Przypadki brzegowe (rev 8b, Kod p9):**
- **Formuły:** czytamy wyłącznie ostatnią wartość zapisaną w pliku (`result`); formuła bez zapisanej wartości → linia z `import_error` (`formula_without_value`). Formuł nigdy nie wyliczamy.
- **Scalone komórki:** wartość z lewej górnej komórki zakresu; pozostałe komórki zakresu puste.
- **Wiele arkuszy:** użytkownik wybiera arkusz w kreatorze (domyślnie pierwszy niepusty).
- **Liczby:** format wybierany w kreatorze (domyślnie `pl`: separator tysięcy spacja lub twarda spacja, przecinek dziesiętny, np. „1 234,56”); alternatywnie `en` („1,234.56”). Komórki liczbowe XLSX bierzemy bez parsowania tekstu.
- **Jednostki:** mapowane na słownik jednostek przez `canonicalizeUnitCode` (§2.4); nieznana → linia z `import_error` (`unknown_unit`).
- **Sekcje:** jawna kolumna `line_type` albo reguła wybrana w kreatorze („wiersz bez ilości i ceny = sekcja”) z podglądem wyniku przed zapisem — bez ukrytej heurystyki.

**Błędny wiersz (rev 8b):** dwa poziomy.
- *Odrzucony* (nie importowany, w raporcie z numerem wiersza i powodem): pusta etykieta przy niepustych liczbach, ilość nieliczbowa lub ujemna, koszt/cena nieliczbowe, wiersz ponad limit.
- *Zaimportowany z błędem* (`import_error = true`, do poprawy w siatce; blokuje mark-sent — D58): nieznana jednostka, nieznana kategoria kosztu, formuła bez wartości.
Import nigdy nie przerywa się na pierwszym błędzie; podgląd przed zapisem pokazuje liczby wierszy poprawnych, z błędem i odrzuconych. Tryb zapisu: `replace` (zastępuje linie wersji `draft`) albo `append`; wybór w kreatorze.


1. Upload (limity — §6.4).
2. Podgląd (5 wierszy). Mapowanie: `line_type`, `label`, `quantity`, `unit`, `unit_cost`, `unit_price`, `cost_category`, `element_type`, `markup_pct`, `notes`.
3. Sekcje importowane jako `line_type=section` gdy `quantity=null`. Mapowanie z `pc_import_column_mappings`.
4. Walidacja + podgląd po mapowaniu. Zatwierdzenie: `POST .../import`.

### 6.3 Eksport XLSX (v1)

Rev 8a: eksport XLSX/CSV idzie do **v1**, bo nie jest marginalny — wymaga tej samej redakcji widoczności co API (§4.3) i osobnych testów tego kanału, a w MVP ofertę wysyła się jako PDF.


Wieloarkuszowy (kolumny redagowane wg §4): linie, sumy per kategoria, nagłówek. Ochrona przed formula/CSV injection: wartości tekstowe zaczynające się od `=`, `+`, `-`, `@`, tabulatora lub CR są poprzedzane apostrofem; eksport nie zawiera formuł.

### 6.4 Limity i bezpieczeństwo importu XLSX/CSV (jedna wartość dla obu modułów — schedule §8.3)

| Limit | Wartość |
|---|---|
| Rozmiar pliku (przed rozpakowaniem) | 10 MB |
| Suma rozpakowanych części XLSX (sprawdzana z katalogu ZIP przed parsowaniem) | 100 MB |
| Wiersze danych | 10 000 |
| Kolumny | 200 |
| Upload + podgląd (synchronicznie) | 30 s, potem 408 z komunikatem |
| Zatwierdzenie (worker, ProgressJob) | 120 s na zadanie, potem status `failed` z raportem |

- Odrzucane: pliki z makrami (`.xlsm`, `vbaProject.bin` w archiwum), niezgodność rozszerzenia i zawartości (sygnatura ZIP/CSV), zaszyfrowane arkusze.
- Formuły nie są wyliczane (tylko wartość zapisana w pliku); zewnętrzne łącza i obiekty osadzone są ignorowane; parser bez pobierania czegokolwiek z sieci.
- Parsowanie strumieniowe; przekroczenie limitu wierszy lub kolumn przerywa odczyt od razu (szybkie odrzucenie, bez pełnego parsowania).
- Te same limity dotyczą importu harmonogramu do partii (§6.5) i importu harmonogramu w `project_schedule` (schedule §8.3).

### 6.5 Import harmonogramu z XLSX do partii (`xlsx_import`, MVP — D50/D56)

Dla firm bez Gantta: `POST /api/project-costing/calculations/:id/import-schedule` (upload + podgląd synchronicznie, zatwierdzenie jako ProgressJob, komenda `schedule_import.commit`). Kolumny: `label`, `element_type_code`, `quantity_m3`, `quantity_pcs`, `production_start_at`, `production_end_at`, `delivery_at` (daty jako komórki daty XLSX lub `YYYY-MM-DD`).
- **Zastąpienie po potwierdzeniu (D56):** import zastępuje wszystkie partie kalkulacji; podgląd pokazuje, ile partii zostanie usuniętych (soft delete) i utworzonych; zapis dopiero po potwierdzeniu.
- **Błędne wiersze odrzucane z raportem (D56):** pusta etykieta, niepoprawna data, koniec przed startem, ujemna ilość, obie ilości puste, nieznany `element_type_code`. Raport (numer wiersza, kolumna, powód) jest dostępny w ProgressJob i do pobrania.
- Po zapisie: `origin = 'xlsx_import'`, `import_job_id`; aktywne źródło kalkulacji = `xlsx_import` (§7a.3); komenda `refresh_schedule_totals` przez kolejkę z debounce.

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
| `XlsxImportSource` | `project_costing` | Te same `pc_production_batches`, zasilane importem harmonogramu z XLSX (§6.5); `POST .../calculations/:id/import-schedule` (MVP — D50) |
| `InternalScheduleSource` | **`project_schedule`** | Rejestrowana przez `project_schedule/di.ts`; czyta `ps_*` przez własne serwisy schedule. `isAvailable()` = moduł aktywny w organizacji (schedule §1.0) i istnieje harmonogram powiązany z kalkulacją. **Zero HTTP.** |
| `ExternalAdapterSource` | przyszły moduł integracji | v2; rejestruje się tak samo |

`project_costing` nie importuje żadnej z implementacji spoza siebie; zna tylko interfejs i rejestr.

### 7a.3 Wybór aktywnego źródła

Priorytet (per kalkulacja/organizacja):
1. `pc_calculations.schedule_source_override` (pole opcjonalne, nullable text) — nadpisuje ustawienie organizacji.
2. Ustawienie `schedule_source` (ModuleConfigService per organizacja, §2.2); domyślnie `calculation_embedded`.
3. Fallback: gdy wybrane źródło nie jest zarejestrowane albo `isAvailable() = false` → `EmbeddedScheduleSource` (transparent fallback, log warning).

### 7a.4 Prognoza 6 miesięcy z aktywnego źródła

Prognoza (`GET /api/project-costing/calculations/:id/production-forecast?months=6`) agreguje dane wyłącznie z aktywnego źródła (`scheduleSourceRegistry.getActive(calculationId)`), więc partie `pc_` i `ps_` nie są liczone podwójnie. Pro-rata LRM; zwraca obie metryki: ilości nieważone i ważone prawdopodobieństwem deala (§3.11; kalkulacja bez deala — tylko nieważone, D61). Logika identyczna niezależnie od źródła (wzory LRM — schedule §4).

Pola `total_quantity_m3/pcs`, `production_start_at/end_at` w `pc_calculations` są cache'em przez `ScheduleSource`; aktualizuje je komenda `project_costing.calculations.refresh_schedule_totals` (DI, zadanie kolejki z debounce per kalkulacja). Wywołuje ją właściciel danych: costing po zmianie partii `pc_` (ręcznej lub z importu `xlsx_import`), a `project_schedule` (jego subscriber na własne eventy) po zmianie harmonogramu. Costing nie subskrybuje eventów `project_schedule.*`.

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

Odczyt i zapis przez `ModuleConfigService` (§2.2): `GET` zwraca ustawienia efektywne organizacji z kontekstu; `PATCH` zapisuje `org:{organizationId}:settings` (feature `project_costing.admin`). Klucze: `default_currency`, `default_overhead_rate`, `calculation_scope`, `pdf.*`, `schedule_source`, `schedule.enabled`, `rounding.mode`, `rounding.line_decimals`, `investments.trgm_threshold` (v1). Walidacja zod; nieznane klucze → 400.

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

POST .../recalc              (MVP: przelicz sumy nagłówka funkcją calculate())
POST .../recalc-from-catalog (MVP, D57: odśwież ceny z cennika tylko w liniach bez override)
POST .../activate            (MVP: is_active_version → true; wymaga deal_id != NULL)
POST .../mark-sent           (MVP: walidacja D58, snapshot + status=sent; body { confirmWarnings? })
POST .../apply-to-deal       (MVP: tylko z wersji aktywnej — D59; jawna komenda customers.deals.update — D66)
POST .../generate-pdf        (MVP: ProgressJob, z snapshota)
POST .../attach-deal         (MVP: body { dealId })
DELETE .../attach-deal       (MVP: odłącz deal; is_active_version → false)
POST .../attach-investment   (MVP: body { investmentId } albo { newInvestment: { name, location } })
DELETE .../attach-investment (MVP)
GET  .../production-forecast?months=6  (MVP: z aktywnego ScheduleSource; metryki nieważona i ważona)
POST .../import              (MVP: upload + podgląd; commit jako ProgressJob)
GET  .../pdf-attachments     (MVP)
GET  .../snapshot            (MVP, z redakcją)

POST .../new-revision        (v1, D57: jedna akcja zamiast unlock + duplicate; body { reason })
POST .../mark-accepted       (v1: status=accepted)
POST .../mark-rejected       (v1: status=rejected)
GET  .../investment-match-candidates?name=&location=&identifiers[]=  (v1, §3.12)
GET  .../export?format=xlsx|csv  (v1)
GET  .../compare?with=<otherId>  (v1, §8.10)
```

### 8.5a Inwestycje

```
GET/POST  /api/project-costing/investments?status=&q=           (MVP; q = podpowiedź po kodzie INV-… lub nazwie)
GET/PATCH /api/project-costing/investments/:id                    (MVP)
DELETE    /api/project-costing/investments/:id   (MVP; tylko gdy brak powiązanych kalkulacji i ról ofert)
GET       /api/project-costing/investments/:id/offer-roles               (MVP; lista ról ofert, §3.12)
POST      /api/project-costing/investments/:id/offer-roles               (MVP; assign: body { dealId }; pierwsza oferta = primary — D65; komunikat D51)
POST      /api/project-costing/investments/:id/offer-roles/set-primary   (MVP; body { dealId }; jedna komenda, jedna transakcja)

GET/POST/DELETE /api/project-costing/investments/:id/identifiers[/:identifierId]   (v1)
POST      /api/project-costing/investments/:id/merge   (v1; body: { targetId })
POST      /api/project-costing/investments/:id/split   (v1, D83; body: { newInvestment: { name }, dealIds, primaryDealIds: { source, target } }; dwie primary w jednej inwestycji → 422 z komunikatem D51)
GET       /api/project-costing/investments/match-candidates?name=&location=&identifiers[]=   (v1)
```

### 8.5b Partie produkcji w kalkulacji (MVP)

```
GET/POST  /api/project-costing/calculations/:id/production-batches
PATCH/DELETE /api/project-costing/calculations/:id/production-batches/:batchId
POST      /api/project-costing/calculations/:id/import-schedule   (xlsx_import; podgląd → potwierdzenie → zastąpienie partii, D56; §6.5)
```

`PATCH /api/project-costing/calculations/:id` akceptuje: `price_mode`, `overhead_rate`, `markup_rate`, `target_margin_rate`, `label`, `currency`, `notes`, `schedule_source_override`. Zmiana `price_mode` lub stawek przelicza sumy nagłówka w tej samej komendzie.

### 8.6 Linie kalkulacji

```
GET/POST /api/project-costing/calculation-lines?calculationId=
PATCH/DELETE /api/project-costing/calculation-lines/:id
POST /api/project-costing/calculation-lines/batch   (auto-save: tylko zmienione wiersze, pola wejściowe + updatedAt nagłówka; komenda save_lines — §0.3)
```

Wersje z `status != 'draft'`: API odrzuca PATCH/DELETE z 409. Odpowiedzi zawierają pola pochodne z `calculate()` po redakcji (§4).

### 8.7 `apply-to-deal` — jawna komenda `customers` wywołana przez użytkownika (D59, D66)

`apply-to-deal` zapisuje `value_amount` deala, czyli pole modułu `customers`. Zgodnie z P0-2 costing **nie zapisuje pól obcego modułu po cichu**:
- akcję uruchamia wyłącznie przycisk użytkownika („Zastosuj wartość do deala”) z potwierdzeniem pokazującym starą i nową wartość; żaden subscriber ani automat tego nie robi;
- działa **tylko z wersji aktywnej** (`is_active_version = true`, D59); inna wersja → 422 `NOT_ACTIVE_VERSION`, a przycisk jest nieaktywny;
- wykonanie = komenda właściciela `customers.deals.update` (`packages/core/src/modules/customers/commands/deals.ts`) przez `commandBus` z kontekstem użytkownika — z audytem, undo i ACL `customers` (użytkownik musi mieć prawo edycji deala oraz `project_costing.apply_to_deal`);
- costing nie pisze bezpośrednio do tabel `customers` ani do custom fieldów deala.
- **Pierwszeństwo wartości (D81):** gdy deal ma powiązaną kalkulację (`pc_calculations.deal_id`, wersja aktywna), wartość deala ustala apply-to-deal; n8n aktualizuje tylko pola przetargowe i nie nadpisuje `value_amount`/`value_currency` (mechanizm: interceptor §10.2; R20, R21). Interceptor przepuszcza bez błędu i bez zmian wywołania z `auth: null` (np. z workerów bulk) — brak `auth` to nie n8n (§10.2).

```typescript
await commandBus.execute({ commandId: 'customers.deals.update',
  input: { id: calculation.dealId, valueAmount: calculation.subtotalPrice }, ctx /* użytkownik */ })
```
Rozstrzygnięte (D66, dawne Q1): apply-to-deal to jawna komenda `customers.deals.update`, nie enricher.

### 8.8 Koszty rzeczywiste (v1)

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

### 8.10 Porównanie wersji kalkulacji (v1)

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

## 9. Uprawnienia (ACL) — rev 8b

Role OM: `superadmin`, `admin`, `employee` (`packages/core/src/modules/customers/setup.ts` `defaultRoleFeatures`). Ról `manager`/`sales` nie zakładamy (Kod p4; role własne tworzy się w UI auth, `sync-role-acls` ról nie tworzy). Feature'y z `acl.ts` trafiają do `setup.ts` `defaultRoleFeatures`.

| Feature ID | Opis | Faza | `admin` | `employee` |
|-----------|------|------|---------|------------|
| `project_costing.view` | Podgląd kalkulacji | MVP | ✅ | ✅ |
| `project_costing.view_prices` | Ceny sprzedaży | MVP | ✅ | ✅ |
| `project_costing.view_costs` | Koszty (efektywnie tylko z `view_margin` albo bez `view_prices`, §4.2) | MVP | ✅ | ❌ |
| `project_costing.view_margin` | Marża (i koszt przy widocznych cenach) | MVP | ✅ | ❌ |
| `project_costing.view_margin_after_close` | Marża i koszt wersji aktywnej po zamknięciu deala (`closure_outcome` won albo lost — D49); faza v1 (D75), w MVP marża tylko z `view_margin` | v1 | ✅ | ❌ |
| `project_costing.edit` | Edycja kalkulacji i linii (tylko pól widocznych) | MVP | ✅ | ✅ |
| `project_costing.edit_markup` | Edycja narzutów i trybu ceny | MVP | ✅ | ❌ |
| `project_costing.lock` | Mark-sent (snapshot), generowanie PDF; oferta z ujemną marżą wymaga osoby z `view_margin` (D76) | MVP | ✅ | ✅ |
| `project_costing.apply_to_deal` | Zastosuj wartość do deala (§8.7) | MVP | ✅ | ❌ |
| `project_costing.import` | Import XLSX linii i harmonogramu do partii (`xlsx_import`) | MVP | ✅ | ✅ |
| `project_costing.export` | Eksport XLSX/CSV (PDF oferty wymaga `view` + `view_prices`) | v1 | ✅ | ✅ |
| `project_costing.admin` | Ustawienia (w tym `rounding.*`), cennik, kategorie, typy elementów; merge i split inwestycji (v1, D83) | MVP | ✅ | ❌ |
| `project_costing.new_revision` | „Nowa rewizja” wersji wysłanej (D57) | v1 | ✅ | ❌ |
| `project_costing.manage_investments` | Zakładanie i edycja inwestycji, dołączanie kalkulacji do inwestycji | MVP | ✅ | ✅ |
| `project_costing.manage_offer_roles` | Przypisanie i zmiana oferty głównej (D50) | MVP | ✅ | ✅ |
| `project_costing.view_actual_costs` | Koszty rzeczywiste | v1 | ✅ | ❌ |
| `project_costing.edit_actual_costs` | Wpisy kosztów rzeczywistych | v1 | ✅ | ❌ |

`superadmin` ma wszystko z mocy roli. `employee` domyślnie bez kosztów i marży (D68, dawne Q5); konfigurowalne. Organizacja zmienia przypisanie, edytując role; to jest „ustawienie widoczności per firma” (D48). Feature'y zostają w `acl.ts`; trasy deklarują `requiredFeatures`, a sprawdzanie jest wildcard-aware. Zakres „tylko własne deale” (`calculation_scope = own`, §4.4) wchodzi w v1 (D79); w MVP widoczność kalkulacji zależy tylko od feature'ów.

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
project_costing.calculation.revision_created   (v1, D57; zastępuje .unlocked)
project_costing.calculation.deleted
project_costing.investment.created
project_costing.investment.updated
project_costing.offer_role.changed     (clientBroadcast: true)
project_costing.production_batches.replaced   (import harmonogramu, D56)
project_costing.deal.value_applied      (clientBroadcast: true)
project_costing.pdf.generated           (clientBroadcast: true)
project_costing.cost_entry.created
project_costing.cost_entry.updated
```

Payload każdego eventu = `{ id, organizationId, tenantId, dealId?, investmentId? }`, bez kwot (§4.3). `clientBroadcast` tylko z ID. `project_costing.calculation.deleted` służy konsumentom (np. `project_schedule`).

### 10.2 Integracja z Dealem

- Zakładka `detail:customers.deal:tabs`.
- `apply-to-deal`: §8.7.
- Subscribery (`persistent: true`) `customers.deal.updated|won|lost|deleted` → odśwież `deal_snapshot` (§0.6). Prognoza liczona z aktualnego snapshotu (§3.11). Dane deala przez query engine / serwis DI, bez HTTP.
- Rola oferty i inwestycja na dealu (MVP — D50): widget + response enricher (dane z `pc_deal_offer_roles`), bez zapisu do `customers`. Enricher tylko wyświetla; wartość deala zmienia wyłącznie jawna komenda apply-to-deal (D66).
- **Wartość deala a push n8n (D81):** wartość z apply-to-deal wygrywa. Kontrakt push n8n → `customers` (Enka, poza tymi specami) aktualizuje dla deala z powiązaną kalkulacją tylko pola przetargowe, bez `value_amount`/`value_currency`. Zabezpieczenie po stronie OM — interceptor komend w `project_costing/commands/interceptors.ts` (auto-discovery, `CommandInterceptor`, `packages/shared/src/lib/commands/command-interceptor.ts`):
  - `id: 'project_costing.d81-deal-value-guard'`, `targetCommand` na `customers.deals.create` i `customers.deals.update` (jedyne komendy zapisu deala w `customers/commands/deals.ts`), hook `beforeExecute`;
  - **bez `features`** — runner pomija interceptor, gdy aktor nie ma wymienionych feature'ów (`authorizeFeatures` w `command-interceptor-runner.ts`), a klucz API n8n nie ma feature'ów `project_costing`;
  - rozpoznanie n8n: `context.auth.isApiKey === true` **i** `context.auth.keyId` na liście `integrations.n8n_api_key_ids` w ustawieniach modułu (`module_configs`, §2.2); samo `isApiKey` nie wystarcza (inne integracje i klucze użytkowników mają wartość deala zapisywać normalnie);
  - **`auth: null`** (`CommandRuntimeContext.auth` jest typu `AuthContext | null`, np. wywołania z workerów bulk bez aktora): interceptor sprawdza `context.auth?.isApiKey` bezpiecznie (bez dereferencji `null`); brak `auth` to nie n8n, więc `beforeExecute` zwraca „przepuść” bez `modifiedInput` i bez błędu; input przechodzi bez zmian;
  - gdy deal ma powiązaną kalkulację (`pc_calculations.deal_id`, `deleted_at IS NULL`) i input zawiera `valueAmount` lub `valueCurrency`: `modifiedInput: { valueAmount: undefined, valueCurrency: undefined }` — runner scala `modifiedInput` płytko, więc pola są usuwane przez ustawienie `undefined`, a pozostałe pola inputu przechodzą bez zmian; dotyczy to też `cf_offer_role` i pozostałych `cf_*`, które n8n wysyła zgodnie z D64 do czasu migracji;
  - audyt: `metadata: { logContext: { d81: { strippedFields: ['valueAmount','valueCurrency'], calculationId } } }` — klucz `logContext` trafia do kontekstu wpisu `action_logs` komendy `customers.deals.update`; bez kwot;
  - inne ścieżki zapisu n8n: lookup + POST/PUT po stronie n8n (przez `makeCrudRoute`, czyli `commandBus`) i trasy zbiorcze muszą wykonywać `customers.deals.create`/`update` przez `commandBus` (workery `bulk-update-stage` i `bulk-update-owner` wołają `customers.deals.update` per rekord); ścieżka zapisu deala z kluczem n8n z pominięciem `commandBus` jest niezgodna z D81 — test integracyjny obejmuje create, update, lookup + POST/PUT i trasę zbiorczą wywołane kluczem z listy oraz wywołanie z `auth: null` (worker bulk), które przechodzi bez błędu i bez zmiany inputu;
  - zapis wartości przez użytkownika (apply-to-deal, edycja deala) i przez klucze spoza listy nie jest zmieniany (R20, R21).

### 10.3 Integracja z `project_schedule` (rev 8a)

`project_costing` nie subskrybuje eventów `project_schedule` i nie wywołuje jego API. Całą integrację trzyma `project_schedule` (konsument): rejestruje `InternalScheduleSource` w `scheduleSourceRegistry`, subskrybuje `project_costing.calculation.activated` / `.deleted` i po zmianach własnego harmonogramu wywołuje komendę costingu `refresh_schedule_totals` (DI, kolejka z debounce). Szczegóły: schedule §5.

### 10.4 Inwestycja = jedna encja (`pc_investments`); wygaszenie `klin:project` (D63)

**Decyzja D63:** `pc_investments` jest kanoniczne. Uzasadnienie:
- `klin:project` to custom entity Data Designera: istnieje tylko w tenancie, który ją zdefiniował, a moduł musiałby polegać na jej ID i polach (ten sam problem co hardkodowany UUID `cf_offer_role`);
- `pc_investments` ma typowany schemat, stabilny kod `INV-YYYY-NNNNNN`, identyfikatory zewnętrzne z unikalnością (D6), merge, partial unique na ofercie głównej i podlega komendom oraz ACL modułu;
- jedno pojęcie zamiast dwóch prawie identycznych (Kod p11).

Usunięte z modelu: `project_id` na `pc_calculations`/`pc_investments`/`pc_cost_entries`, endpointy `attach-project`, widget na stronie `klin:project`, strona `/project-costing/projects/:projectId`. Zamiast nich: strona inwestycji `/backend/project-costing/investments/:id` (deale z rolą oferty, suma inwestycji, kalkulacje) i zakładka na dealu przez istniejący spot `detail:customers.deal:tabs` (zweryfikowano: `packages/core/src/modules/customers/backend/customers/deals/[id]/hooks/useDealInjectedTabs.tsx` l.28).

**Migracja danych `klin:project`** (jednorazowa, przy wdrożeniu modułu; komenda CLI `yarn mercato project_costing import-klin-projects --tenant <id> [--dry-run]`):
1. Odczyt rekordów `klin:project` i ich relacji do deali przez serwis `entities` w DI (bez HTTP); brak definicji w tenancie = no-op.
2. Dla każdego rekordu: znajdź `pc_investments` po `legacy_klin_project_id` (idempotencja), a jeśli brak — utwórz nową (`name`, `location`, `legacy_klin_project_id`) komendą `investments.create` (audyt). Identyfikatory zewnętrzne (priorytet D6) dopisuje import, gdy tabela `pc_investment_identifiers` już istnieje (v1).
3. Dla każdego powiązanego deala utwórz `pc_deal_offer_roles` (rola z `cf_offer_role`, jeśli była — §3.12; brak = reguła „pierwsza oferta = primary”, D65).
4. Raport (`--dry-run` domyślnie pokazuje plan): utworzone, dopasowane, konflikty dwóch `primary`.
5. Import właściwy uruchamiamy dopiero po `--dry-run` i akceptacji raportu przez Marka (D63). Potem definicję `klin:project` wyłącza użytkownik w Data Designerze; moduł jej nie usuwa i po imporcie nie czyta. (Podstawa: D63.)

---

## 11. Analityka (`analytics.ts`)

Encja `project_costing:calculations` (fieldMappings): id, dealId, investmentId, status, priceMode, currency, subtotalCost[`view_costs`+`view_margin`], overheadAmount[`view_costs`+`view_margin`], fullCost[`view_costs`+`view_margin`], subtotalPrice[`view_prices`], totalMargin[`view_margin`], marginRate[`view_margin`], totalQuantityM3, totalQuantityPcs, createdAt, isActiveVersion. (Koszt wymaga też `view_margin`, §4.2. Analityka = v1.)

Widget TOP/BOTTOM marża: filtr `isActiveVersion=true`, metryka `marginRate`[`view_margin`].
Widget prognoza lejka (v1): metryki nieważona i ważona (§3.11) z `deal_snapshot` per etap D33 (bez joinu do tabel `customers` w czasie zapytania); kalkulacje bez deala w osobnym wierszu, poza ważoną (D61); deale przegrane i usunięte pominięte.

---

## 12. UI / UX

### 12.1 Zakładka „Kalkulacja" na karcie Deala

Spot: `detail:customers.deal:tabs`. Widget: `DealCalculationTab.tsx`.

Nagłówek: dropdown wersji (display code `K/2026/001-R2`, status badge), tryb ceny A/B/C, `overhead_rate`, `markup_rate`/`target_margin_rate` per tryb, sumy (koszty/ceny/marża — redagowane wg §4), przycisk „Wyślij ofertę" → `mark-sent` (dialog: błędy blokujące albo ostrzeżenia do potwierdzenia — D58), „Generuj PDF", „Ustaw jako aktywną", „Przelicz z cennika" (D57), „Zastosuj wartość do deala" (tylko wersja aktywna — D59), „Inwestycja" (wybór z podpowiedzią po kodzie, rola oferty — D50/D51). v1: „Zaakceptowano" / „Odrzucono", „Nowa rewizja" (jedna akcja — D57).

### 12.2 Siatka kosztów — `packages/ui` (`DataTable` + `InlineEditors`), `react-data-grid` tylko po akceptacji

Rev 8b (Kod p10): najpierw PoC na komponentach `packages/ui` (`packages/ui/src/backend/detail/InlineEditors.tsx`, `DataTable`). `react-data-grid` v7 jest tylko w wersji beta — użyjemy go wyłącznie, gdy PoC nie spełni wymagań i Marek zaakceptuje zależność (§18a, D74).

Hierarchia: kolumna `label` z wcięciem per `parent_line_id`. Typy linii: `section` (bold, tło DS, suma sekcji wyliczana automatycznie), `item` (normalna), `note` (italic, bez liczb).

Kolumny: line_type [icon], label, qty, unit, unit_cost [`view_costs`], unit_price [`view_prices`], markup_pct, line_cost [`view_costs`], line_price [`view_prices`], line_margin [`view_margin`], line_margin_pct [`view_margin`], akcje.

### 12.3 Widok budget vs actual (v1)

Strona `/project-costing/deals/:dealId/actual-costs`: tabela per kategoria z kolumnami: bezpośredni koszt (budżet), narzut pośredni (budżet), pełny koszt (budżet), rzeczywisty, wariancja, wariancja %. Dane z `GET /api/project-costing/deals/:dealId/budget-vs-actual`.

### 12.4 Porównanie wersji kalkulacji (v1)

Strona `/project-costing/calculations/:id/compare?with=<otherId>` (lub modal z version selectorem). Widok side-by-side:
- Nagłówek: sumy base vs compare (koszty/ceny/marża — redagowane wg §4), ze strzałkami kierunku zmiany (↑/↓) i kolorem DS.
- Tabela linii: kolumna „Zmiana" (added/removed/changed/unchanged) + pole deltas. `added` = zielone tło, `removed` = czerwone przekreślenie, `changed` = żółte wyróżnienie.
- Sekcje zwijalne.
- Uruchamiane z dropdown wersji kalkulacji (przycisk „Porównaj z...").

### 12.5 Strony backend

MVP: `/settings`, `/cost-categories`, `/element-types`, `/price-catalog[/id]`, `/calculations[/id]`, `/import-mappings`, `/investments[/id]` (lista, formularz, deale z rolą oferty i suma inwestycji). v1: `/segments[/id]`, `/templates[/id]`, `/price-list-rules`, `/investments/:id` (identyfikatory, merge), `/deals/:dealId/actual-costs`, `/calculations/:id/compare`. Listy i formularze na `DataTable`/`CrudForm` z `packages/ui`.

---

## 13. Rekomendacja cennikowa

**v1**: własny cennik + import CSV/XLSX. **v2**: Sekocenbud/Intercenbud (pliki XLSX per kwartał, brak API). **v2+**: KNR szablony seed. Patrz §7 dla KNR adapter.

---

## 14. Fazy — zakres funkcji i encji (rev 8b)

Rev 8b (P11): estymaty w dniach usunięte ze specyfikacji. Fazy opisujemy wyłącznie listą funkcji, encji i tras. Harmonogram realizacji i wycenę prowadzi Koordynator poza speką.

### `project_costing` — MVP

**Funkcje:**
1. Szkielet modułu: `index.ts`, `acl.ts`, `setup.ts` (`defaultRoleFeatures`), `events.ts`, `di.ts`; ustawienia per organizacja przez ModuleConfigService (`org:{id}:settings`, D69), w tym `rounding.*` (D62/D16).
2. Słowniki: kategorie kosztów, typy elementów, jednostki (słownik `dictionaries`, §2.4).
3. Prosty cennik firmy (jedno źródło `company_catalog`, bez reguł): lookup pozycji w siatce, proweniencja ceny, „Przelicz z cennika” tylko dla linii bez override (D57).
4. Nagłówek kalkulacji: numeracja sekwencją Postgresa per organizacja (`pc_document_sequences`, wzór `SalesDocumentNumberGenerator`), statusy `draft`/`sent`, attach/detach deal, `deal_snapshot` z subscriberów (§0.6), wersja aktywna (`activate`; pierwsza kalkulacja deala aktywna automatycznie).
5. Czysta funkcja `calculate()` (klient = serwer): tryby A i C, sekcja → pozycje (jeden poziom), linie `note`, narzut, zaokrąglenia half-up per linia (§2.3); komenda `save_lines` (wejścia + sumy nagłówka, lock na nagłówku); benchmark 10 000 linii.
6. Siatka „jak Excel” (edycja klawiaturą, sekcje, autosave) na komponentach `packages/ui`.
7. Import XLSX linii: upload, podgląd, kreator mapowania, przypadki brzegowe i limity (§6.2, §6.4), ProgressJob + worker, komenda commit.
8. Mark-sent z walidacją D58: snapshot (`pc_offer_snapshots`) + PDF oferty (`pdf-lib`) w workerze + `attachments`.
9. Apply-to-deal z wersji aktywnej (D59): jawna komenda `customers.deals.update` (D66) + zakładka „Kalkulacja” na `detail:customers.deal:tabs`.
10. RBAC i redakcja we wszystkich kanałach (§4.3): API, payload indexera, search, audit, eventy, PDF; `employee` bez kosztów i marży (D68).
11. Minimalne inwestycje (D50, D63): `pc_investments` (kod `INV-…`, nazwa, lokalizacja), ręczne wskazanie z podpowiedzią po kodzie/nazwie, strona inwestycji z sumą.
12. Role ofert (D50/D51/D65): `pc_deal_offer_roles`, assign (pierwsza oferta = primary), set-primary w jednej transakcji z komunikatem „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”, widget + enricher na dealu.
13. Importy wdrożeniowe CLI (D63/D64): `import-klin-projects` i `import-offer-roles` — idempotentne, z `--dry-run` i raportem.
14. Partie produkcji: ręczne (`calculation_embedded`) i import harmonogramu XLSX (`xlsx_import`, zastąpienie po potwierdzeniu, odrzucenie błędnych wierszy z raportem — D56); `ScheduleSource` + rejestr DI; prognoza 6 mies. (LRM, nieważona i ważona).

**Encje MVP:** `pc_cost_categories`, `pc_element_types`, `pc_price_sources` (seed), `pc_price_catalog`, `pc_calculations`, `pc_calculation_lines` (sub-resource), `pc_offer_snapshots`, `pc_calculation_pdf_attachments`, `pc_import_column_mappings`, `pc_production_batches`, `pc_investments` (minimalnie), `pc_deal_offer_roles`, `pc_document_sequences` (systemowa).

**Poza MVP:** Gantt, formuły, wiersz sumy częściowej (D78), marża po zamknięciu deala (D75), zakres „tylko własne” (D79), eksport XLSX, tryb B, reguły cennika, segmenty, szablony, identyfikatory i dopasowanie inwestycji, merge, split (D83), „Nowa rewizja”, accepted/rejected, porównanie wersji, koszty rzeczywiste, analityka.

### `project_costing` — v1

**Funkcje:**
1. Tryb B (`target_margin`) + redystrybucja z resztą na największej linii (§3.6).
2. Wielopoziomowe reguły cennika (`pc_price_list_rules`).
3. Segmenty.
4. Szablony kalkulacji.
5. Inwestycje — pełne: identyfikatory zewnętrzne (priorytet D6: e-Zamówienia > TED > BIP > INV), dopasowanie (identyfikator → pg_trgm), merge, split z wyborem oferty głównej (D83).
6. Pełny cykl wersji: „Nowa rewizja” jako jedna akcja (D57), `accepted`/`rejected`/`superseded`.
7. Porównanie wersji (`/compare` + UI).
8. Koszty rzeczywiste + raport budżet vs wykonanie.
9. Analityka: TOP/BOTTOM marża, prognoza lejka (nieważona i ważona; bez deala osobno — D61); `view_margin_after_close` (D49, D75 — w MVP marża tylko z `view_margin`).
10. Eksport XLSX/CSV z redakcją i ochroną przed formula injection.
11. `quantity_expr` z bezpiecznym parserem arytmetyki (bez `eval`; ilość z wymiarów) — D30.
12. Import/eksport cennika CSV/XLSX.
13. Przeliczniki jednostek (`pc_unit_conversions`, §2.4).
14. Zakres „tylko własne deale”: `calculation_scope = own` (D79, §4.4).

**Encje v1:** `pc_segments`, `pc_price_list_rules`, `pc_calculation_templates`, `pc_calculation_template_lines`, `pc_investment_identifiers`, `pc_cost_entries`, `pc_unit_conversions`; rozszerzenie `pc_investments` (`investment_key` + indeks trgm, `merged_into_id`).

### `project_costing` — v2

1. Multi-segment + nowe kategorie.
2. Adapter Sekocenbud/Intercenbud XLSX + KNR `mapExternalCode`.
3. Import kosztów rzeczywistych z faktur + integracje (ERP, plik).
4. Biblioteka szablonów KNR (seed).
5. Wiele walut i konwersja (`currencies`) — po decyzji Q6 (otwarte); zasady D70 (ISO 4217) i D71 (NBP tabela A, kurs zamrożony przy mark-sent, ręczna korekta tylko przed mark-sent) już rozstrzygnięte warunkowo (§3.10).
6. AI-tool: generowanie linii kalkulacji z opisu.

### Narzut OM (wymagania w każdej fazie, bez estymaty)

Każda encja i trasa z fazy przechodzi przez konwencje repo: migracja i snapshot, walidatory zod, komendy z undo i `audit_logs`, `makeCrudRoute` + `openApi` + indexer, granty w `setup.ts` (`packages/core/AGENTS.md` l.8–13); każdy ekran na `CrudForm`/`DataTable`; i18n pl/en; testy integracyjne każdej trasy API w tej samej zmianie (root `AGENTS.md` l.166, `.ai/qa/AGENTS.md`; Playwright w `__integration__` modułu) oraz testy unit Jest (`calculate()`, zaokrąglenia, LRM, numeracja, redakcja, import).

### Zakres zbiorczy (oba moduły)

| Moduł | MVP | v1 | v2 |
|---|---|---|---|
| `project_costing` | lista MVP powyżej | lista v1 powyżej | lista v2 powyżej |
| `project_schedule` | — (moduł nie wchodzi do MVP) | schedule §12 v1 | schedule §12 v2 |

---

## 15. Risks (rev 8a — z ryzykiem rezydualnym)

| # | Scenariusz awarii | Obszar | Ważność | Mitygacja | Ryzyko rezydualne |
|---|---|---|---|---|---|
| R1 | Siatka nie udźwignie hierarchii + 10 000 linii (lag, utrata edycji) | UI siatki | Wysoka | PoC na `packages/ui` przed budową siatki (§14 MVP pkt 6); benchmark 10 000 linii; minimalny zapis (§0.3); MVP: tylko sekcja → pozycje | Średnie — wydajność edycji „jak Excel” potwierdzi dopiero PoC |
| R2 | PDF z hierarchiczną tabelą łamie layout lub przekracza czas (`pdf-lib` nie ma silnika layoutu) | PDF | Średnia | Generowanie w workerze (ProgressJob); własny moduł łamania tabeli; test layoutu z wieloma sekcjami i polskimi znakami | Niskie |
| R3 | Tryb B przy `R < 0` daje ujemne ceny (v1) | Obliczenia | Średnia | Ostrzeżenie w edycji + blokada mark-sent (D58, §3.8) | Niskie |
| R4 | Dryf zaokrągleń | Obliczenia | Niska | Half-up per linia, suma = suma zaokrąglonych linii (D62); reszta trybu B na największej linii; jedna funkcja `calculate()` klient = serwer; arytmetyka dziesiętna | Niskie (≤ jednostka zaokrąglenia na linię) |
| R5 | Wyścig: dwie aktywne wersje albo dwie oferty `primary` | Dane | Wysoka | Partial unique indexy + obsługa konfliktu 409 (bez SERIALIZABLE) | Niskie — użytkownik ponawia akcję |
| R6 | Konflikt optimistic lock deala przy apply-to-deal | Integracja `customers` | Średnia | Komenda `customers.deals.update` z `updatedAt`; 409 → odśwież i ponów | Niskie |
| R7 | Brak integracji z fakturami w v1 | Koszty rzeczywiste | Niska | Ręczne wpisy w v1; import w v2 | Niskie (świadoma decyzja zakresu) |
| R8 | Snapshot `jsonb` rośnie (10 000 linii × N wersji) | Baza | Niska | Snapshot tylko przy mark-sent | Niskie |
| R9 | pg_trgm daje fałszywe dopasowania | Inwestycje (v1) | Niska | Próg konfigurowalny; zawsze potwierdza użytkownik | Niskie |
| R11 | Wyciek marży/kosztu kanałem pominiętym w §4.3 (np. nowy widget) | Bezpieczeństwo danych | Wysoka | Jedna funkcja redakcji; test integracyjny per kanał dla roli `employee` | Średnie — każdy nowy kanał wymaga testu |
| R12 | `ModuleConfigService` nie rozróżnia organizacji (zweryfikowane w kodzie) | Konfiguracja | Średnia | Świadome obejście D69: klucz `org:{id}:settings` + merge w `projectCostingSettings`; testy izolacji organizacji | Niskie — gdyby core dodał natywny scope organizacji, trzeba przenieść klucze |
| R13 | Okres przejściowy (D64): n8n wysyła `cf_offer_role` do wdrożenia modułu i migracji, więc przez ten czas są dwa źródła | Dane / integracja | Średnia | Import `import-offer-roles` idempotentny i powtarzalny (tworzy tylko brakujące wiersze) tuż przed wyłączeniem wysyłki w n8n; moduł nie czyta `cf_offer_role` w runtime | Niskie po wyłączeniu wysyłki w n8n |
| R14 | Import `klin:project` tworzy duplikaty inwestycji | Migracja | Średnia | `--dry-run` + akceptacja raportu (D63), idempotencja po `legacy_klin_project_id`, raport konfliktów | Niskie |
| R15 | Zakres niedoszacowany (konwencje OM, bety zależności) | Plan | Średnia | Narzut OM opisany jako wymagania w każdej fazie (§14); zależności rozstrzygnięte (D74, §18a), instalowane dopiero przy implementacji fazy; przegląd zakresu po MVP | Średnie |
| R16 | Zależność od wersji beta (`react-data-grid` v7) lub dużej rodziny pakietów (`@svar-ui`) | Zależności | Średnia | Najpierw `packages/ui`; `@svar-ui` tylko PoC w v1 schedule, potem osobna decyzja (D74, D82); bez SVAR PRO (D21) | Niskie |
| R17 | Brak tabeli A NBP z dnia mark-sent (weekend, święto, przed publikacją) albo niedostępne API NBP (gdy Q6 ≠ (a)) | Waluty | Średnia | Kurs ręczny ma pierwszeństwo przed NBP; bez niego ostatnia opublikowana tabela A z `effective_date` w snapshocie; ręczna korekta kursu przed mark-sent (D71; po mark-sent zablokowana); przy braku kursu mark-sent zwraca 422 `FX_RATE_UNAVAILABLE` z prośbą o ręczny kurs | Niskie |
| R18 | Deal ponownie otwarty po wygranej, a harmonogram wykonawczy wygląda na obowiązujący | Dane / harmonogram | Niska | Flaga „deal ponownie otwarty” (`reopened_at`) i badge w UI, bez usuwania danych (D72); ponowne `won` czyści flagę | Niskie |
| R19 | `action_logs.command_payload` albo tabela pre-image/post-image (`pc_command_undo_payloads`) staje się kanałem wycieku kosztu i marży | Bezpieczeństwo / audyt | Średnia | `redoInput`, `payload`, snapshoty i `changes` zredagowane w `buildLog` (§0.3 pkt 1); tabela bez trasy API, indeksu, wyszukiwania i eventów; odczyt tylko w `undo()`/`redo()` po `authorizeReplay`, z filtrem org/tenant; twarde usuwanie przy mark-sent, usunięciu kalkulacji i braku wpisu `action_logs` (§0.3 pkt 6). Testy integracyjne: po każdej komendzie z polem wrażliwym `action_logs.command_payload`, `snapshot_before`, `snapshot_after` i `changes_json` nie zawierają wartości kosztu, narzutu ani marży; użytkownik bez `view_margin` nie cofnie ani nie ponowi zmiany kosztu (403) | Niskie |
| R20 | Push n8n nadpisuje wartość deala ustawioną przez apply-to-deal (D31, D40) | Integracja n8n | Średnia | D81: interceptor `project_costing` (bez `features`) na `customers.deals.create`/`update` rozpoznaje n8n po `isApiKey` i `keyId` z `integrations.n8n_api_key_ids`; usuwa `valueAmount`/`valueCurrency` przez `undefined`, reszta inputu (w tym `cf_*`, D64) przechodzi; audyt w `logContext`; `auth: null` (workery bulk `bulk-update-stage`, `bulk-update-owner`) = nie n8n, przepuszczane bez błędu; test integracyjny create/update/lookup + POST/PUT/trasa zbiorcza oraz przypadek `auth: null` (§10.2) | Niskie |
| R21 | Kontrakt Enki/n8n nie zostanie zmieniony (n8n dalej wysyła wartość deala) albo n8n zapisze deal z pominięciem `commandBus` lub kluczem spoza listy | Integracja n8n / zależność zewnętrzna | Średnia | D81 wymaga zmiany kontraktu po stronie Enki (poza tymi specami); do tego czasu interceptor jest jedyną ochroną; lista `integrations.n8n_api_key_ids` utrzymywana przy rotacji kluczy (checklista wdrożenia); test kontraktowy z Enką przed włączeniem apply-to-deal; zmiana kontraktu n8n i klucz API n8n czekają na wdrożenie modułu i migrację (Q2/D64), klucz API generuje Marek (zadanie ClickUp 869fm3281) | Średnie — zależy od zmiany po stronie n8n |

(R10 z rev 7 — sekwencja dwóch komend `cf_offer_role` — usunięte: rola oferty zmieniana jedną komendą w jednej transakcji, §3.12.)

---

## 16. Pytania otwarte do Marka (rev 8b)

**Zamknięte** (`.ai/decisions.md`@b544719 (gałąź `develop_OM_CRM`): D1–D82; D83 — `.ai/decisions.md` z tego PR, gałąź `spec/rev8e`):

| # | Temat | Rozstrzygnięcie |
|---|---|---|
| Q1 | Apply-to-deal | D66: jawna komenda `customers.deals.update` (przycisk), nie enricher; tylko z wersji aktywnej (D59) |
| Q2 | `cf_offer_role` z n8n | D64: n8n wysyła do czasu wdrożenia i migracji; potem wyłączenie; R13 przejściowe |
| Q3 | Import `klin:project` | D63: `pc_investments` kanoniczne; import po `--dry-run` i akceptacji raportu, potem `klin:project` wyłączony; inwestycje zakłada handlowiec, nie n8n |
| Q4 | Wyłączenie harmonogramu | D67: dane zostają, ukryte do ponownego włączenia (schedule §1.0) |
| Q5 | Uprawnienia `employee` | D68: domyślnie bez kosztów i marży; konfigurowalne przez role |
| — | Ustawienia per organizacja | D69: klucz `org:{id}:settings` jako świadome obejście (R12) |
| — | Formuły | MVP bez formuł; v1 `quantity_expr` z bezpiecznym parserem (D30) |
| — | Gantt | własny, bez SVAR PRO (D21; schedule §3.2); wybór SVAR MIT nieprzesądzony — PoC w v1 (D82) |
| Q7 | Zaokrąglenie per waluta | D70 (warunkowe, Q6 ≠ (a)): kody walut ISO 4217 (§2.3, §3.10) |
| Q8 | Źródło kursów i zamrożenie kursu | D71 (warunkowe, Q6 ≠ (a)): NBP tabela A z dnia mark-sent, zamrożony w snapshocie; brak tabeli → ostatnia opublikowana; ręczna korekta przed mark-sent, po mark-sent zablokowana (§3.8, §3.10, R17, A33) |
| Q9 | Harmonogram wykonawczy po ponownym otwarciu deala | D72: flaga „deal ponownie otwarty”, bez usuwania danych (§0.6; schedule §2.2, R15) |
| Q10 | Cena zero na pozycji | D73: ostrzeżenie przy mark-sent, nie blokuje (lista ostrzeżeń D58, §3.8) |
| Q11 | Nowe zależności | D74: `exceljs` tak; siatka najpierw `packages/ui`; `@svar-ui` tylko PoC w v1 schedule, potem osobna decyzja (D82; bez SVAR PRO — D21); `xml2js` w v2; na etapie speki nic nie instalujemy (§18a) |
| — | Marża po zamknięciu deala | D75: dopiero v1; w MVP marża tylko z `view_margin` (§4.2, §4.3a, §9) |
| — | Ujemna marża przy mark-sent bez `view_margin` | D76: blokada z komunikatem „Oferta wymaga zatwierdzenia przez administratora”, bez znaku i kwoty; wysyła admin (§3.8, §4.3) |
| — | Klucz harmonogramu inwestycji | D77: jeden rekord na inwestycję z fazą (ofertowa → wykonawcza); klucz wymusza jeden główny rekord (schedule §2.2) |
| — | Wiersz sumy częściowej | D78: MVP tylko automatyczne sumy sekcji, bez wiersza sumy częściowej (§3.2) |
| — | „Wszystkie deale czy tylko własne” | D79: `own` od v1; MVP tylko `all` (§4.4) |
| — | Następnik kamienia milowego | D80: startuje tego samego dnia (schedule §3a.1) |
| — | Wartość deala po apply-to-deal a push n8n | D81: wartość z apply-to-deal wygrywa; n8n aktualizuje tylko pola przetargowe (§8.7, §10.2, R20, R21) |
| — | SVAR w §18a | D82: §18a nie przesądza SVAR; PoC w v1 (§18a) |
| — | Split inwestycji i oferta główna | D83: v1; ofertę główną wskazuje użytkownik w kroku podziału, domyślnie oferta oryginalna; jedna `primary` na inwestycję, komunikat D51 (§2.2, §3.12) |

**Otwarte (biznesowe, rev 8b):**

| # | Pytanie | Opcje | Propozycja |
|---|---|---|---|
| Q6 | Czy kalkulacja może być w walucie innej niż PLN (wiele walut)? | (a) tylko PLN; (b) waluta deala, jedna na kalkulację; (c) waluty per linia | (b) — waluta deala, bez mieszania walut w kalkulacji. Pytanie biznesowe do Marka; od odpowiedzi zależy, czy wchodzą w życie D70/D71 |

---

## 17. Rozwiązane założenia autonomiczne

| # | Założenie | Uzasadnienie |
|---|-----------|--------------|
| A1 | Siatka: najpierw `packages/ui` (`DataTable` + `InlineEditors`); `react-data-grid` v7 (beta) tylko gdy PoC na `packages/ui` nie wystarczy (D74) | Kod p10; root `AGENTS.md` l.26 |
| A2 | Tryby A/B/C + dziedziczenie markup_pct: jednolita redystrybucja §3.6; margin_rate z rzeczywistych sum | Spójność; markup per item/sekcja nie zastępuje trybów B/C, ale współdziała |
| A3 | **Rev 8a (poprawione):** `project_costing` = moduł bazowy; `project_schedule` (opcjonalny) zależy od costing i rejestruje provider `ScheduleSource` w DI; costing nigdy nie importuje schedule | Kod P0-1 |
| A4 | deal_id nullable ✅ (Marek potwierdził); ownership standalone = created_by (rev 8a: project_id usunięte) | Odpowiedź Marka na pytanie C |
| A5 | Waluta = waluta deala (jednowalutowe; wiele walut — Q6) | Eliminuje konwersje |
| A6 | Import XLSX/CSV: 10 MB, 100 MB po rozpakowaniu, 10 000 wierszy, 200 kolumn (§6.4; to samo w schedule) | Jeden limit dla obu modułów |
| A7 | Auto-save: debounce 800 ms | Minimalizuje requesty |
| A8 | exceljs v4.4.0 (MIT) — zaakceptowany (D74) | xlsx npm nieaktualizowane |
| A9 | PDF: `pdf-lib` (już w `packages/core`) | Bez nowej zależności, bez Chromium (Kod p10) |
| A10 | „Nowa rewizja” (D57): jedna akcja, feature `new_revision` (admin), powód w `audit_logs` | Immutability |
| A11 | apply-to-deal: komenda `customers.deals.update` (zweryfikowano w kodzie), tylko z wersji aktywnej | D59, D66; historia deala |
| A12 | Dane firmy PDF: Organization.name + logoUrl z directory; reszta z ustawień `pdf.*` (ModuleConfigService) | Organization nie ma adresu/NIP (D60) |
| A13 | Marża ukryta domyślnie: `view_margin` i `view_costs` tylko dla `admin` w `defaultRoleFeatures` (bez flagi w ustawieniach) | D48, D68 |
| A14 | Offer snapshot tworzony przy mark-sent; PDF generowany ze snapshota | Immutability oferowanej ceny |
| A15 | CostEntry w project_costing (nie osobnym module) | Spójność danych budżet vs realizacja w jednym module |
| A16 | pc_price_list_rules: priority = im wyższy, tym bardziej szczegółowy | Intuicyjne; item>category>segment>global |
| A17 | investment_key = lower(trim(name)) \|\| '\|' \|\| lower(trim(location)) **na `pc_investments`** (v1); próg `investments.trgm_threshold` = 0.5 | Prosty normalizowany klucz; jedno miejsce |
| A18 | Rola oferty: zmiana tylko decyzją użytkownika w UI; jedna komenda `offer_roles.set_primary` w jednej transakcji; pierwsza oferta = primary (D65) | Odpowiedź Marka — no silent automation; Kod P0-2 |
| A19 | attach-deal/attach-investment informuje o innej ofercie w inwestycji (komunikat D51); nie blokuje | Informowanie bez blokady |
| A20 | Version compare: matching linii po `label` + `sort_order` + `cost_category_id` (brak stabilnego line-id między wersjami) | Kalkulacje mogą mieć różne line IDs po „Nowej rewizji” |
| A21 | Budget vs actual: `calculation_id` NOT NULL na `pc_cost_entries`; `deal_id`/`investment_id` opcjonalne | Spójność z konkretną wersją oferty |
| A22 | NIP klienta: odczyt `company.cf_nip` przez query engine / serwis DI (bez HTTP); brak przechowywania w pc_calculations | Unika duplikacji danych; zero HTTP między modułami |
| A23 | `pc_element_types` własność `project_costing`; `project_schedule` referencjonuje przez `element_type_code` (string) i `elementTypeService` w DI; brak FK z `project_schedule` do `pc_element_types` | Opcjonalność schedule |
| A24 | `project_schedule` jest OPCJONALNY per organizację: `schedule.enabled` (ModuleConfigService) + ACL; feature toggle = globalny kill-switch per tenant; po wyłączeniu dane ukryte do ponownego włączenia (D67) | D15, D67 |
| A25 | Inwestycja = jedna encja `pc_investments` (kanoniczna, D63); `klin:project` importowany po `--dry-run` i wyłączany | D63; Kod p11 |
| A26 | Investment matching (v1) — priorytet identyfikatorów e-Zamówienia > TED > BIP > INV (D6), potem pg_trgm; user zawsze potwierdza fuzzy-match | D6, D62 |
| A27 | Marża po zamknięciu deala: feature `project_costing.view_margin_after_close`; won **albo** lost (D49); per firma = przypisanie do ról | D48, D49 |
| A28 | Zaokrąglenie: `rounding.mode` (domyślnie half-up, połówki od zera), 2 miejsca per linia; sumy = suma zaokrąglonych linii; per organizacja | D62/D16 |
| A29 | Jednostki: słownik `dictionaries` + własne przeliczniki `pc_unit_conversions` (v1); bez przeliczników `catalog` | `dictionary_entries` bez pola współczynnika (zweryfikowane) |
| A30 | Numeracja `K/{YYYY}/{NNN}` i `INV-{YYYY}-{NNNNNN}` z sekwencji PG per organizacja (`pc_document_sequences`); luki dopuszczalne | Kod p18; wzór `SalesDocumentNumberGenerator` |
| A31 | Pola pochodne linii liczone przez `calculate()`, nieprzechowywane; zamrażane w snapshocie | Kod p8; minimalny zapis |
| A33 | Kurs ręczny w wersji `draft` ma pierwszeństwo przed NBP; bez niego: brak tabeli A NBP w dniu mark-sent → ostatnia opublikowana tabela A (`effective_date` = jej data); `FX_RATE_UNAVAILABLE` tylko, gdy nie jest dostępna żadna tabela A i nie ma kursu ręcznego (R17) | D71 (warunkowe, Q6) |
| A32 | Partie: `pc_production_batches` (costing) i `ps_production_batches` (schedule); prognoza czyta tylko aktywne źródło; kopia `pc_` → `ps_` jednorazowa, po potwierdzeniu | Jedno źródło prawdy (§2.2, schedule §1.4) |

---

## 18. Migracje i backward compatibility

Nowe tabele `pc_*` only. Zero zmian w `packages/core`. Wszystkie encje domenowe z `deleted_at`. Ustawienia w `module_configs` (bez własnej tabeli). Kolejność MVP: pc_document_sequences → pc_cost_categories → pc_element_types → pc_price_sources (seed) → pc_price_catalog → pc_investments → pc_calculations → pc_calculation_lines → pc_offer_snapshots → pc_calculation_pdf_attachments → pc_import_column_mappings → pc_production_batches → pc_deal_offer_roles. v1: pc_segments → pc_price_list_rules → pc_calculation_templates + pc_calculation_template_lines → pc_investment_identifiers → pc_unit_conversions → pc_cost_entries; `pc_investments` + `investment_key`, `merged_into_id`, `CREATE EXTENSION pg_trgm` i indeks trgm. (Rev 8a: usunięte `pc_settings` i `pc_calculation_audit_log`.) Importy wdrożeniowe `klin:project` i `cf_offer_role` to komendy CLI (`--dry-run`, idempotentne), nie migracje; kolejność: najpierw `import-klin-projects`, potem `import-offer-roles`.

## 18a. Nowe zależności — rozstrzygnięte (rev 8c, Kod p10, D74, D82)

D74 (dawne Q11): rekomendacja przyjęta. D82: ta sekcja nie przesądza wyboru SVAR. Na etapie speki nic nie instalujemy; pakiety dodaje dopiero implementacja danej fazy.

| Pakiet | Wersja / stan | Moduł, faza | Alternatywa w repo | Rozstrzygnięcie (D74) |
|---|---|---|---|---|
| `exceljs` | 4.4.0, MIT, ostatnie wydanie 2023-10-19 | costing MVP (import), v1 (eksport); schedule v1 | brak czytnika XLSX w repo | **tak** |
| `react-data-grid` | v7 tylko beta, MIT | costing MVP (siatka), tylko gdy PoC na `packages/ui` nie wystarczy | `packages/ui` `DataTable` + `InlineEditors` | **najpierw `packages/ui`**; `react-data-grid` tylko, gdy PoC na `packages/ui` nie wystarczy (wtedy osobna akceptacja) |
| `@svar-ui/*` (`react-gantt` 2.8.1 i ok. 17 pakietów w drzewie zależności) | MIT | schedule v1 | brak Gantta w repo | **tylko PoC w v1 schedule**, potem osobna decyzja (D74, D82); bez SVAR PRO (D21) |
| `xml2js` | MIT | schedule v2 (MS Project XML) | — | **v2** |
| `pdf-lib` | już w `packages/core` | costing MVP (PDF) | — | bez nowej zależności |

---

## 19. Szkielet plików

```
apps/mercato/src/modules/project_costing/
├── acl.ts, analytics.ts, events.ts, index.ts, setup.ts, di.ts, search.ts, extension-points.ts
├── commands/                     # rev 8a: wszystkie zapisy (undo, audit_logs); rev 8d: redoInput zredagowany (§0.3)
│   └── interceptors.ts           # rev 8d: interceptor D81 na customers.deals.create/update (§10.2)
├── workers/                      # import XLSX, PDF (ProgressJob)
├── cli.ts                        # import-klin-projects, import-offer-roles (wdrożeniowe, --dry-run, idempotentne)
├── api/
│   ├── settings/ (ModuleConfigService), segments/, cost-categories/, element-types/
│   ├── price-sources/, price-catalog/, price-list-rules/
│   ├── calculation-templates/, calculation-template-lines/
│   ├── calculations/[id]/{recalc,recalc-from-catalog,activate,mark-sent,mark-accepted,mark-rejected,
│   │                       new-revision,apply-to-deal,generate-pdf,export,import,
│   │                       pdf-attachments,snapshot,production-batches,import-schedule,
│   │                       attach-deal,attach-investment,
│   │                       investment-match-candidates,
│   │                       production-forecast}/
│   ├── calculation-lines/ + batch/
│   ├── cost-entries/ + import/ | deals/:dealId/budget-vs-actual/
│   ├── investments/[id]/{identifiers,merge,split,match-candidates,offer-roles}/
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
│   └── DealOfferRoleWidget.tsx           # rola oferty i inwestycja na dealu (MVP — D50)
└── lib/
    ├── calculate.ts              # czysta funkcja calculate() — klient i serwer (§0.3)
    ├── money.ts                  # arytmetyka dziesiętna + round() wg rounding.* (§2.3)
    ├── numbering.ts              # pc_document_sequences, nextval per organizacja
    ├── calculation.service.ts    # snapshot, lifecycle, walidacja mark-sent (D58)
    ├── pdf.service.ts            # pdf-lib + snapshot data
    ├── import.service.ts
    ├── visibility.ts
    ├── forecast.ts               # metryki nieważona i ważona (§3.11)
    ├── investment.service.ts     # match candidates, merge, split (v1, D83)
    ├── offer-roles.service.ts    # assign (D65), set-primary w jednej transakcji (MVP)
    ├── settings.ts               # projectCostingSettings: merge org → tenant → defaults
    └── schedule-source/
        ├── schedule-source.interface.ts
        ├── schedule-source.registry.ts
        ├── embedded-schedule.source.ts     # pc_production_batches
        ├── xlsx-import.source.ts
        └── price-source/provider.interface.ts + registry.ts + providers/
```

---

## 20. Final Compliance Report (rev 8b, vs `AGENTS.md`)

| Reguła | Źródło | Status |
|---|---|---|
| Sekcje TLDR, Architecture, Data Models, API Contracts, Risks (z ryzykiem rezydualnym), Final Compliance Report, Changelog | `.ai/specs/AGENTS.md` § Spec Content Checklist | ✅ TLDR, §0, §2, §8, §15, §20, Changelog (Overview/Problem/Proposed Solution = §1) |
| Brak relacji ORM między modułami; FK-id | `packages/core/AGENTS.md` § Never | ✅ |
| Kierunek zależności: baza nie importuje opcjonalnego konsumenta | `packages/core/AGENTS.md` § Cross-Module Coupling | ✅ §0.1, §7a |
| Zapisy przez komendy; `makeCrudRoute` + indexer; `openApi` na trasach; mutation guard | `packages/core/AGENTS.md` § Always | ✅ §0.3 (write path: `calculate()`, `save_lines`, lock na nagłówku, audyt), §8 |
| Feature'y `acl.ts` w `setup.ts` `defaultRoleFeatures`; sprawdzanie wildcard-aware | `packages/core/AGENTS.md` § Always/Never, § ACL Grant Sync | ✅ §9 |
| `deleted_at` na encjach | `packages/core/AGENTS.md` § Database Entities | ✅ §2.1 |
| `updated_at` + optimistic locking na encjach edytowalnych | `packages/core/AGENTS.md` § Database Entities | ✅ |
| Ustawienia przez ModuleConfigService | `packages/core/AGENTS.md` § Module Config | ✅ §2.2 (klucz per organizacja; ograniczenie serwisu opisane) |
| ProgressJob + worker dla importu i PDF | `packages/core/AGENTS.md` § Operation Progress | ✅ §5.2, §6.2 |
| Testy integracyjne każdej trasy w tej samej zmianie | root `AGENTS.md` l.166 | ✅ wymaganie w każdej fazie (§14 „Narzut OM”); plan testów w PR #11 |
| Nowe zależności produkcyjne = ask first | root `AGENTS.md` l.26 | ✅ §18a — rozstrzygnięte (D74); na etapie speki nic nie instalujemy |
| Domyślne custom fieldy w `ce.ts`; brak hardkodowanych UUID | `packages/core/src/modules/customers/AGENTS.md` l.103 | ✅ `cf_offer_role` usunięte |

## 21. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-23)

| # | Punkt listy (Kod pN) | Wynik rev 8b |
|---|---|---|
| 1 | Komunikacja przez DI/eventy/widget/FK-id; zero HTTP (p1) | ✅ §0, §7a, §10 (odczyty `customers` też bez HTTP) |
| 2 | Zależność jednokierunkowa; provider w rejestrze DI bazy (p1) | ✅ §0.2, §7a.2 |
| 3 | Brak zapisów do cudzych tabel/pól; encja-rozszerzenie + `data/extensions.ts` (p2) | ✅ §2.2 `pc_deal_offer_roles`, §3.12; jawny wyjątek: apply-to-deal przez komendę `customers` (§8.7, D66) |
| 4 | Zero hardkodowanych UUID (p2) | ✅ UUID `cf_offer_role` usunięty |
| 5 | Partial unique na `primary`, zmiana w jednej transakcji (p2) | ✅ §2.2, §3.12 |
| 6 | Jedno pojęcie na byt (inwestycja); zakładka przez `detail:customers.deal:tabs` (p11) | ✅ §10.4 |
| 7 | RBAC tylko w `acl.ts`; role admin/employee (p4) | ✅ §9 |
| 8 | Ustawienia nie dublują RBAC (p4) | ✅ §2.2 (usunięte klucze `visibility.*`) |
| 9 | Ukryta marża = ukryty koszt (p3) | ✅ §4.2 |
| 10 | Pola ukryte wykluczone z index/search/audit/eventów/compare (p3) | ✅ §4.3 |
| 11 | Zapisy przez komendy: mark-sent, new-revision, recalc, apply-to-deal (p6) | ✅ §0.3 (lista komend + write path) |
| 12 | Audyt przez `audit_logs`, bez własnych tabel (p6) | ✅ `pc_calculation_audit_log` usunięte |
| 13 | `makeCrudRoute` + indexer, `openApi`, mutation guards (p6) | ✅ §0.3, §8 |
| 14 | Zapis minimalny, lock na nagłówku, `calculate()` klient = serwer, benchmark (p8) | ✅ §0.3 write path, §2.2 (pola pochodne nieprzechowywane), R1 benchmark 10 000 linii |
| 15 | `deleted_at` (p20) | ✅ §2.1 |
| 16 | Ustawienia przez ModuleConfigService (**p7**) | ✅ §2.2 — **spełniony**: ustawienia w `module_configs`; źródło: `packages/core/src/modules/configs/lib/module-config-service.ts` |
| 17 | Włączanie: build + `feature_toggles` per tenant + blokady menu/widget/API (**p7**) | ✅ §0.5, schedule §1.0 — **spełniony**: włącznik per organizacja `schedule.enabled` w ModuleConfigService + feature'y ACL; `feature_toggles` (per tenant — `packages/core/src/modules/feature_toggles/lib/feature-flag-check.ts`) tylko jako globalny kill-switch; blokady w menu, w zakładce `detail:customers.deal:tabs` i w API (route guard) |
| 18 | Zakres „firmy” zdefiniowany i dobrany mechanizm (**p7**) | ✅ **spełniony**: firma = organizacja (D15); ModuleConfigService per organizacja, feature toggle per tenant tylko kill-switch (schedule §1.0) |
| 19 | Statusy deala zgodne z OM, eventy won/lost, snapshot (p5) | ✅ §0.6 (`closure_outcome`, `deleted_at`, eventy won/lost persistent, etapy D33) |
| 20 | Import i PDF przez ProgressJob + worker (p9) | ✅ §5.2, §6.2 |
| 21 | Edge case'y importu (p9) | ✅ §6.2, §6.4, §6.5 |
| 22 | Nowe zależności = ask first (p10) | ✅ §18a, D74 |
| 23 | Najpierw to, co jest w repo: `pdf-lib`, `packages/ui` (p10) | ✅ siatka na `packages/ui` (§12.2); PDF na `pdf-lib` (§5.2) |
| 24 | Numeracja przez sekwencje PG per organizacja (p18) | ✅ §2.2 (`pc_document_sequences`, wzór `SalesDocumentNumberGenerator`) |
| 25 | Walidacje brzegowe: CHECK, qty 0, ujemne ceny (p19) | ✅ §2.2 (CHECK), §3.1 (qty 0), §3.8 (D58) |
| 26 | Hierarchia MVP: sekcja → pozycje, bez `subtotal` (p13) | ✅ §2.2 (`subtotal` usunięty, jeden poziom) |
| 27 | Algorytmy harmonogramu (p12) | ✅ schedule §3a (D54, D55) |
| 28 | Narzut OM w zakresie faz (p16) | ✅ §14 „Narzut OM” jako wymagania (estymaty usunięte — P11) |
| 29 | Testy: Jest `__tests__`, Playwright `__integration__` (p17) | ✅ §14 „Narzut OM” (plan testów PR #11) |
| 30 | MVP pocięty po wartości (p15) | ✅ §14, TLDR |
| 31 | Forma speki: TLDR, Architecture, Risks, FCR (p20) | ✅ |

Brak punktów ⚠️. Ryzyka rezydualne: §15 (R1, R2, R15, R16).

---

## 22. Decision traceability (D1–D83)

Źródło: `.ai/decisions.md`@b544719 (gałąź `develop_OM_CRM`, merge PR #13) dla D1–D82; D83 — `.ai/decisions.md` z tego PR (gałąź `spec/rev8e`, Koordynator 2026-10-23). D49 jest aktywna w fazie v1 (D75). Zakres D1–D83: 74 aktywnych i 9 zastąpionych. D70 i D71 są warunkowe — obowiązują, gdy Q6 ≠ (a) (Q6 otwarte, §16). Tabela obejmuje wszystkie aktywne decyzje; w kolumnach wskazane są sekcje, które je realizują, w obu specach (schedule ma skrót w schedule §21). Decyzje zastąpione nie są cytowane w tekście spec: D3 superseded by D4; D7 superseded by D63; D8 superseded by D10; D13 superseded by D48, D49; D27 superseded by D60; D28 superseded by D29; D29 superseded by D50; D39 superseded by D64 (z okresem przejściowym do migracji); D43 superseded by D63.

Bilans: 74 aktywnych, z czego 63 realizowanych w specach i 11 N/A (D4, D31, D32, D34, D35, D36, D37, D38, D41, D44, D46). N/A to kontrakt n8n → `customers` albo Enka: specy go nie zmieniają, moduły tylko czytają dane deala.

| D | Decyzja (skrót) | costing | schedule |
|---|---|---|---|
| **D1** | Klin = agregator przetargów + CRM budowlany na OM | §1.1, §1.2 (kontekst; moduły jako część CRM na OM) | §1 (kontekst) |
| **D2** | Nisza prefabrykacja, wszystko wielosegmentowe | §2.2 (`pc_segments`, `segment_code`), §8.2 | — |
| **D4** | n8n wysyła deale od score ≥ 50 | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D5** | Duplikaty ofert: `offer_role` primary/alternative + komunikat | §3.12, §8.5a, §12.1 | — |
| **D6** | Priorytet kodu inwestycji | §2.2 (`pc_investment_identifiers`), §3.12, §10.4 | — |
| **D9** | Kalkulator jak Excel + import XLSX | §6.2, §12.2 | §8.1 |
| **D10** | Kalkulacja bez deala | §2.2 (`deal_id` NULL), §3.8 (oferta standalone), §3.11 | — |
| **D11** | PDF oferty w pierwszej wersji | §5, §14 MVP | — |
| **D12** | Własny cennik, potem Sekocenbud | §2.2 (cennik), §7, §14 v2 | — |
| **D14** | Marża od ceny sprzedaży | §3.5 | — |
| **D15** | Firma = organizacja | §0.5 | §1.0 |
| **D16** | Half-up, 2 miejsca, per linia | §2.3 | — |
| **D17** | Słownik jednostek z przelicznikami | §2.4 | — |
| **D18** | Własny moduł zamiast `sales` | §0.1 | — |
| **D19** | Harmonogram = osobny moduł, opcjonalny per firma | §7a | §1.0, §5.4 |
| **D20** | Kalkulacja i prognoza bez harmonogramu (`ScheduleSource`/Excel) | §6.5, §7a | §5.2 |
| **D21** | Gantt własny, bez SVAR PRO | §16, §18a | §3.2, §12, §14 (R13) |
| **D22** | Auto-przesuwanie z przypięciem | — | §3a.1, §3a.2 |
| **D23** | Jeden Gantt na inwestycję | — | §6.1, §7.3 (doprecyzowane przez D53) |
| **D24** | Oferta → realizacja przy wygranej | §0.6 | §1.2, §6.1 (`create-execution`) |
| **D25** | MS Project w v2 | — | §8.2, §12 v2 |
| **D26** | Harmonogram wewnętrzny, gotowy na integrację | — | §11, §12 v2 |
| **D30** | MVP bez formuł; v1 `quantity_expr` z bezpiecznym parserem | §14 v1, §16 | — |
| **D31** | 1 przetarg = 1 deal | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają; wartość deala z powiązaną kalkulacją chroni D81 (§10.2) | N/A (j.w.) |
| **D32** | Idempotencja `om_sync` | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D33** | 9 etapów pipeline | §0.6, §3.11, §11 | — |
| **D34** | Automatyczna zmiana etapu przez n8n | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają; moduły nie zmieniają etapu deala | N/A (j.w.) |
| **D35** | Usunięte deale nie są odtwarzane | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D36** | API interakcji | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D37** | Scoring i `probability` | N/A — scoring liczy n8n; moduł tylko czyta `probability` z deala (§3.11) | N/A (j.w.; §4.3 przyjmuje `probability` od konsumenta) |
| **D38** | Kanał pozyskania | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D40** | n8n nie nadpisuje pól ręcznych | §8.7, §10.2 (wartość deala z powiązaną kalkulacją — D81), §15 (R20); reszta kontraktu push n8n poza specami | — |
| **D41** | Słownik powodów przegranej | N/A — słownik w `customers`/n8n; moduł czyta tylko `closure_outcome` (§0.6) | N/A (j.w.) |
| **D42** | Zwycięzca/konkurent; n8n nie zmienia `closure_outcome` | §0.6 | — |
| **D44** | Limity backfillu | N/A — kontrakt push n8n → `customers` (poza tymi specami); moduły kalkulacji i harmonogramu go nie zmieniają | N/A (j.w.) |
| **D45** | Moduły aplikacji w forku, bez zmian w `packages/core` | nagłówek (Moduł), §0.1, §19 | nagłówek (Moduł), §18 |
| **D46** | Enka faza 1 wstrzymana | N/A — Enka poza zakresem obu spec | N/A (j.w.) |
| **D47** | Przełącznik harmonogramu per organizacja (`module_configs`) + kill-switch tenanta | §0.5 | §1.0 |
| **D48** | RBAC marży i kosztu | §4.1, §4.3, §9 | §9 |
| **D49** | Marża po `closure_outcome` — aktywna, faza: v1 (D75) | §0.6, §4.2, §4.3a, §9 | — |
| **D50** | Zakres MVP | §14 MVP, §6.5, §7a.2 | §1.1, §12 MVP (moduł poza MVP) |
| **D51** | Komunikat o duplikacie oferty | §3.12, §8.5a, §12.1 | — |
| **D52** | Inwestycja = jedna encja | §2.2 (`pc_investments`), §3.12, §10.4 | §2.2 (`investment_id`) |
| **D53** | Gantt inwestycji = osobny rekord (klucz: D77) | — | §1.2, §2.2 (`schedule_scope`, `investment_id`), §6.1, §7.3 |
| **D54** | Przypięte zadania, propagacja tylko w przód | — | §3a.1, §3a.2, §6.3 |
| **D55** | Konwencja dat (koniec włącznie, FS, kamień milowy, dni kalendarzowe) | §2.2 (partie) | §2.2, §3.2 (adapter), §3a.1, §8.1 |
| **D56** | Import zastępuje dane po potwierdzeniu; błędne wiersze odrzucane | §6.2, §6.5, §8.5b | §8.1 |
| **D57** | Przeliczenie i nowa rewizja | §3.9, §8.5 | — |
| **D58** | Mark-sent: blokady i ostrzeżenia (lista poprawiona przez D73, D76) | §3.2, §3.6, §3.8 | — |
| **D59** | Apply-to-deal tylko z wersji aktywnej | §3.9, §8.7 | — |
| **D60** | PDF: pdf-lib + dane firmy z `module_configs` | §2.2 (ustawienia), §5.2, §5.3 | — |
| **D61** | Kalkulacja bez deala poza prognozą ważoną | §3.11, §7a.4, §11 | §4.3 |
| **D62** | Zaokrąglenia, jednostki, identyfikatory | §2.2, §2.3, §2.4, §3.12 | — |
| **D63** | `pc_investments` kanoniczne + import `klin:project` | §2.2, §10.4, §18 | — |
| **D64** | `cf_offer_role` z n8n do migracji | §3.12, §15 (R13) | — |
| **D65** | Pierwsza oferta = `primary` | §3.12, §8.5a | — |
| **D66** | Apply-to-deal = jawna komenda | §8.7, §10.2 | — |
| **D67** | Wyłączenie modułu: dane ukryte | §2.2 (partie), §16 (Q4) | §1.0, §2.2 |
| **D68** | `employee` bez kosztów i marży | §4.2, §9 | §9 |
| **D69** | Ustawienia: klucz `org:{id}:settings` | §0.5, §8.1, §15 (R12) | — |
| **D70** | Kody walut ISO 4217 (warunkowe — obowiązuje, gdy Q6 ≠ (a)) | §2.3, §3.10, §14 v2 | — |
| **D71** | Kurs NBP tabela A z dnia mark-sent, zamrożony w snapshocie; kurs ręczny ma pierwszeństwo przed NBP; brak tabeli z tego dnia → ostatnia opublikowana; ręczna korekta kursu przed mark-sent, po mark-sent zablokowana (warunkowe — Q6 ≠ (a)) | §2.2 (`snapshot_data.fx`), §3.8, §3.10, §15 (R17), §17 (A33) | — |
| **D72** | Flaga „deal ponownie otwarty”, bez usuwania danych | §0.6, §15 (R18) | §1.2, §2.2 (`reopened_at`, `execution_deal_id` — także rekord inwestycji), §6.1, §14 (R15) |
| **D73** | Cena zero = ostrzeżenie przy mark-sent (lista D58), bez blokady | §3.2, §3.8 | — |
| **D74** | Zależności: `exceljs` tak; siatka najpierw `packages/ui`; `@svar-ui` tylko PoC w v1, potem osobna decyzja; `xml2js` w v2; nic nie instalujemy na etapie speki | §6.1, §12.2, §15 (R16), §18a | §3.2, §8.2, §12, §14 (R13) |
| **D75** | Widoczność marży po zamknięciu deala dopiero w v1; w MVP marża tylko z `view_margin` | §4.2, §4.3a, §9, §14 v1 | — |
| **D76** | Mark-sent z ujemną marżą przez osobę bez `view_margin` → blokada z komunikatem „Oferta wymaga zatwierdzenia przez administratora”, bez znaku i kwoty; wysyła admin | §0.3, §3.8, §4.3, §9 | — |
| **D77** | Jeden rekord harmonogramu na inwestycję z fazą (najpierw ofertowa, potem wykonawcza); klucz wymusza jeden główny rekord na inwestycję | — | §1.2, §2.2 (indeks unikalny, wyścig → 409, undo zmiany fazy), §6.1, §7.3, §14 (R10) |
| **D78** | MVP: tylko automatyczne sumy sekcji, bez wiersza sumy częściowej | §2.2 (typy linii), §3.2, §14 MVP | — |
| **D79** | Zakres „tylko własne deale” (`calculation_scope = own`) w v1 | §2.2 (ustawienia), §4.4, §9, §14 v1 | — |
| **D80** | Następnik kamienia milowego (FS) startuje tego samego dnia (`P.start + lag`) | — | §3a.1, §16 (A16) |
| **D81** | Wartość z apply-to-deal wygrywa; n8n aktualizuje tylko pola przetargowe i nie nadpisuje wartości deala z powiązaną kalkulacją | §8.7, §10.2, §15 (R20, R21), §19 (`commands/interceptors.ts`) | — |
| **D82** | §18a nie przesądza SVAR; `@svar-ui` zostaje PoC w v1 | §15 (R16), §18a | §3.2, §14 (R13) |
| **D83** | Split inwestycji w v1; ofertę główną wskazuje użytkownik w kroku podziału (domyślnie oryginał); jedna `primary` na inwestycję i komunikat D51 (D65) | §2.2 (`pc_investments`, split), §3.12, §8 (trasa `split`), §9 (`admin`), §14 v1, §19 | N/A — komenda costingu; rekord harmonogramu inwestycji (D77) zostaje przy inwestycji źródłowej (schedule §21) |

Pytanie otwarte: Q6 (wiele walut, §16). Pozostałe pytania Q1–Q11 mają numery D (§16).

---

## Changelog

| Data | Zmiana |
|------|--------|
| 2026-10-23 | **rev 8e** — **D83** (`.ai/decisions.md`, ten PR): split inwestycji przeniesiony z v2 do v1 — komenda `project_costing.investments.split`, trasa `POST .../split`, ofertę główną wskazuje użytkownik w kroku podziału (domyślnie oferta oryginalna), jedna `primary` na inwestycję i komunikat D51 (D65), undo z kontrolą konfliktu (§2.2, §3.12, §8, §9, §14, §19); traceability D1–D83 (§22, §16). **Nity n8n (D81):** worker `bulk-update-owner` obok `bulk-update-stage`; „upsert po identyfikatorze przetargu” → lookup + POST/PUT po stronie n8n przez `makeCrudRoute`/`commandBus` (§10.2); interceptor przepuszcza `auth: null` (workery bulk) bez błędu, z testem (§8.7, §10.2, R20); R21: zmiana kontraktu n8n i klucz API czekają na wdrożenie i migrację (Q2/D64), klucz generuje Marek (ClickUp 869fm3281). |
| 2026-10-23 | **rev 8d** — odbiór 8324f29. **Wyciek:** komendy z polami wrażliwymi ustawiają `redoInput` na projekcję zredagowaną (bez tego szyna zapisuje surowy input w `action_logs.command_payload`); post-image `fields_after` w `pc_command_undo_payloads` dla `redo()`; komenda bez post-image = `replayable: false` (§0.3, §4.3, R19 z testem `command_payload`). **Retencja:** mark-sent, usunięcie kalkulacji, brak wpisu `action_logs` / redo; indeks `calculation_id`; lookup z filtrem org/tenant; jawny wyjątek od `deleted_at` (tabela techniczna, twarde usuwanie). **D81:** interceptor bez `features`, n8n = `isApiKey` + `keyId` z `integrations.n8n_api_key_ids`, pola przez `undefined` (merge płytki), audyt w `logContext`, `cf_*` przechodzą (D64), create/update/upsert/trasy zbiorcze, `commands/interceptors.ts` w §19, nowe R21 (kontrakt Enki). **D71:** kurs ręczny ma pierwszeństwo przed NBP (§3.10, A33, R17). Źródło decyzji: `.ai/decisions.md`@b544719 (`develop_OM_CRM`), D1–D82 (§16, §22). |
| 2026-10-23 | **rev 8c** — decyzje D70–D74 (`.ai/decisions.md` 72a63c9) i D75–D82 (Koordynator 2026-10-23); traceability D1–D82 (§22). **D71:** ręczna korekta kursu przed mark-sent, po mark-sent zablokowana; brak tabeli → ostatnia opublikowana (A33), `FX_RATE_UNAVAILABLE` i R17 bez zmian. **D76:** blokada mark-sent z ujemną marżą dla osoby bez `view_margin` z komunikatem bez znaku i kwoty (§3.8, §4.3, §9). **Undo** pól bez wartości w audycie: pre-image w `pc_command_undo_payloads` (§0.3, §4.3, R19). **D81:** pierwszeństwo apply-to-deal przed push n8n (§8.7, §10.2, R20). **D75/D79:** marża po zamknięciu i „tylko własne” w v1 (§4.2–§4.4, §9, §14). **D78:** tylko automatyczne sumy sekcji. **D82:** §18a bez przesądzenia SVAR (§18a, R16). Spec-check: D60 → `module_configs` `pdf.*` (§2.2), `deleted_at` w `pc_production_batches`, usunięty martwy link do kontraktu n8n (§22). |
| 2026-10-23 | **rev 8b** — spójność, review P1/P2, decyzje D47–D69 (`.ai/decisions.md` d818aa2), wnioski z planu testów. **P11:** usunięte wszystkie estymaty w dniach (tabele, sumy, narzut OM, rezerwy procentowe, porównania; też w starszych wierszach changelogu); §14 = listy funkcji i encji per faza; R15 bez rezerwy w dniach. **D50:** do MVP weszły minimalne `pc_investments`, `pc_deal_offer_roles` (D51 komunikat, D65 pierwsza = primary), linie `note`, partie ręczne + import harmonogramu XLSX `xlsx_import` (D56: zastąpienie po potwierdzeniu, raport odrzuconych wierszy); importy CLI `klin:project`/`cf_offer_role` jako wdrożeniowe. **D62/D16:** half-up 2 miejsca per linia, suma = suma zaokrąglonych linii, `rounding.*` per organizacja; wzory §3 przepisane; reszta trybu B na największej linii; zaokrąglanie bankierskie usunięte. **Jednostki:** słownik + własne `pc_unit_conversions` (v1), §2.4. **D6:** priorytet e-Zamówienia > TED > BIP > INV. **D57:** „Przelicz z cennika” (MVP) tylko bez override; „Nowa rewizja” = jedna akcja (zastępuje unlock + duplicate). **D58:** walidacja mark-sent (blokady/ostrzeżenia). **D59/D66:** apply-to-deal przycisk z wersji aktywnej, komenda `customers.deals.update`; `activate` w MVP. **D49:** `view_margin_after_close` przy won albo lost. **D61:** kalkulacja bez deala poza prognozą ważoną. **D68:** `employee` bez kosztów/marży. **D63/D64/D69:** §10.4, §3.12, R12, R13. **§16:** Q1–Q5 zamknięte; nowe Q6–Q11. **Kod p5:** §0.6 statusy deala (`closure_outcome`, etapy D33). **p6/p8:** write path (`calculate()`, `save_lines`, lock na nagłówku, pola pochodne nieprzechowywane, audyt). **p9:** przypadki brzegowe i bezpieczeństwo importu, limity 10 MB / 100 MB / 10 000 wierszy / 200 kolumn (wspólne ze schedule). **p10:** PDF na `pdf-lib`; siatka na `packages/ui`; §18a lista zależności. **p13:** `subtotal` usunięty. **p18:** numeracja sekwencjami PG (`pc_document_sequences`). **p19:** CHECK (marża < 1, narzut > −1), qty 0, ujemne ceny blokują mark-sent; bez SERIALIZABLE. **Plan testów:** pola audytu, jeden limit importu, definicja błędnego wiersza, narzut jako ułamek, prognoza nieważona + ważona, bezpieczeństwo XLSX, filtrowanie po stronie serwera. **A2–A5:** nagłówek „Kluczowe cechy”, cache `total_quantity` przez kolejkę, jedno źródło partii, `investment_key` na `pc_investments`. **Założenia przenumerowane** (stary → nowy): A1–A11 → A1–A11 (A1, A6, A8–A11 zaktualizowane); A12 usunięte; A13→A12, A14→A13, A15→A14, A16→A15, A17→A16, A18→A17, A19→A18, A20→A19, A21→A20, A22→A21, A23→A22, A24→A23, A25→A24, A26→A25, A27→A26, A28→A27; A29 usunięte; nowe A28–A32. **Follow-up (spec-check):** §22 Decision traceability — wszystkie aktywne decyzje z d818aa2 z sekcjami albo N/A z powodem, decyzje zastąpione tylko jako „superseded by”; rozstrzygnięcia Koordynatora 2026-10-23 Q7–Q11 zamknięte w §16 i wpisane w §0.6, §2.3, §3.8, §3.10, §6.1, §14 v2, §15 (R16–R18), §18a; Q6 otwarte; poprawka odsyłacza w §14 „Zakres zbiorczy” (schedule §12). |
| 2026-10-20 | **rev 8a** — Review Kod (PR #10 rev 7) + decyzje Koordynatora/Marka. **P0-1:** costing = moduł bazowy z `ScheduleSource` + `scheduleSourceRegistry` w DI; `project_schedule` rejestruje provider; usunięte HTTP (`InternalScheduleSource` przez HTTP, `GET element-types` dla schedule → `elementTypeService` w DI, odczyty `customers` → query engine/DI) i subscriber costingu na eventy schedule; A3 poprawione; nowa §0 Architecture. **P0-2:** `cf_offer_role` + UUID `73f8260a…` + dwie komendy usunięte → encja `pc_deal_offer_roles` (`data/extensions.ts`, partial unique na `primary`, `set_primary` w jednej transakcji); komunikat „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”; R10 usunięte; import 546 wartości jako opcjonalna komenda CLI; apply-to-deal = jawna komenda `customers` (Q1). **P0-3:** ukryta marża = ukryty koszt; tabela kanałów (API, query_index `buildUpsertPayload`, search, audit_logs, eventy tylko z ID, eksport, PDF, compare, analityka, snapshot, notyfikacje). **Firma = organizacja:** `pc_settings` → ModuleConfigService (zweryfikowano: brak natywnego scope organizacji → klucz `org:{id}:settings`); harmonogram per organizacja przez ModuleConfigService + ACL + blokady menu/API, `feature_toggles` tylko jako kill-switch per tenant (schedule §1.0). **Decyzja (e):** widoczność tylko przez `acl.ts`; role admin/employee; `view_margin_after_close`. **Decyzja (c):** inwestycja = `pc_investments`; `project_id`, `attach-project` i widget `klin:project` usunięte; migracja `klin:project` jako CLI. **P1-15 + (a):** nowe MVP (siatka, import XLSX, A/C, prosty cennik, mark-sent + PDF, apply-to-deal, RBAC, partie + prognoza); eksport XLSX → v1. **P1-16:** wycena od zera z narzutem OM (estymaty usunięte w rev 8b — P11). Pkt 14 i 20 zamknięte (D30, D21). Dodane: TLDR, Risks z ryzykiem rezydualnym, Final Compliance Report, Checklist compliance, `deleted_at`. `pc_calculation_audit_log` → `audit_logs`. Weryfikacja review w kodzie — zgodne: feature_toggles per tenant (`feature-flag-check.ts`: klucz cache i override po `tenantId`), role admin/employee (`customers/setup.ts`), `useDealInjectedTabs.tsx` l.28, snapshoty w `audit_logs/data/entities.ts`, `pdf-lib` w `packages/core/package.json` l.256, `salesDocumentNumberGenerator.ts`. **Niezgodne/uzupełnione:** ModuleConfigService przyjmuje `organizationId`, ale nie używa go przy odczycie (opisane w §2.2); `data/extensions.ts` jest dziś deklaracją bez runtime joinu (dlatego enricher). Numery linii w AGENTS.md podane wg gałęzi spec. Poza zakresem rev 8a (zrobione w rev 8b): Kod p4–6 (szczegóły), 8–13, 16 (szczegóły), 18–19, A7/A13, partie pc_/ps_, investment_key, numeracja założeń, half-up. |
| 2026-10-19 | v1–v4: patrz poprzednie rewizje |
| 2026-10-19 | v5 — Oferta = frozen snapshot (pc_offer_snapshots); typy linii (section/item/note/subtotal) + hierarchia (parent_line_id) + markup_pct z dziedziczeniem; cykl życia wersji: draft/sent/superseded/accepted/rejected + numeracja base_code-R{revision}; layered price list (pc_price_list_rules); koszty rzeczywiste CostEntry (pc_cost_entries); marża ukryta domyślnie; deal_id nullable |
| 2026-10-19 | v5 patch (a) — @svar-ui/react-gantt MIT/PRO split zweryfikowany z tarball (patrz project_schedule §3); bez wpływu na model danych project_costing |
| 2026-10-19 | v6 — mode C per-item (line_full_cost×(1+effective_markup)), redistyb. §3.6 tylko dla B; cf_offer_role: read+write (nie read-only), safe two-step z compensating action; budget formula: line_full_cost per kat., direct+overhead kolumny, calculation_id required; investment detection: NIP matching + deal search bez kalkulacji; compare API + UI side-by-side; §8.1-8.2 expand; §10.4 expand; §12.3/12.4 compare UI; R10 fix; A2/A12 fix; A21-A23 |
| 2026-10-19 | **v7** — Decyzje Marka: (1) widget `klin:project` YES (§10.4); (2) widoczność marży po zamknięciu deala: per-company `margin_visible_after_deal_close` (§2.2 pc_settings, §4.3); (3) investment matching primarynie przez zewnętrzne identyfikatory — nowe tabele `pc_investments` + `pc_investment_identifiers`, stabilny kod INV-YYYY-NNNNNN, merge/split+audit, pg_trgm tylko fallback (§3.12); (4) wszystkie pytania z §16 usunięte (odpowiedziane). ScheduleSource abstraction (§7a): `project_schedule` opcjonalny — implementacje `internal`/`calculation_embedded`/`xlsx_import`/`external_adapter`; nowe tabele `pc_production_batches` i `pc_element_types` (przejęte od schedule). pc_element_types własność costing (A24). pc_cost_entries: `calculation_id` NOT NULL, `deal_id` nullable, `project_id` added (§2.2). A12: usunięto "read-only". |
| 2026-10-19 | v5 patch (b) — Odpowiedzi Marka: kalkulacja może istnieć bez deala (deal_id+project_id nullable, project_id/investment_name/investment_location/investment_key na pc_calculations, ownership standalone=created_by, attach/detach-deal/project endpoints); detekcja duplikatów inwestycji (pg_trgm, duplicate-investment-candidates, UI notice bez automatyzacji, set-primary-offer via command bus, audit log); Pytania otwarte Q1/Q2 usunięte (odpowiedziane) |
