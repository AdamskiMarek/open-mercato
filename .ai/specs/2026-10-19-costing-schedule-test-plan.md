# Niezależny plan testów — Kalkulacja kosztów + Kalkulator ofert + Harmonogram

**Dokument**: SPEC ONLY (plan testów niezależny od specyfikacji PR #10, brak kodu)
**Data**: 2026-10-19
**Autor**: Copilot (plan testów na podstawie wymagań biznesowych Marka Adamskiego)
**Rewizja**: rev 9k (2026-10-31) — asercje wg D192 (11), (12) (rejestr @2f20fed, PR #38): TC-DEAL-032 krok 3 (422 na trasie, bez joba), TC-DEAL-027 krok 4 i TC-DEAL-033 krok 1 (`failedItems` w podsumowaniu joba), TC-DEAL-033 krok 2 (nagłówek przez trasę API `customers/deals`); poprzednio rev 9j (2026-10-31) — meta (P21): wniosek 39 zamknięty, oznaczenia „brak w rejestrze” w TC-DEAL-027, TC-DEAL-031–034 zastąpione odesłaniami do doprecyzowań D192/D193 (PR #38), bez zmiany asercji; poprzednio rev 9i (2026-10-31) — rozstrzygnięcia Q-LR-8, Q-LR-9 i wyjątek D191 (rejestr @fe7a2c2, PR #38): nowe TC-DEAL-035 (D193), TC-FCST-008 (D191); TC-DEAL-030 rozszerzony (D185); TC-DEAL-027, TC-DEAL-031, TC-DEAL-034 wg rejestru @fe7a2c2; poprzednio rev 9h (2026-10-31) — rozstrzygnięcia Q-LR-1…7 w D185, D192, D193 (rejestr @32bf708, PR #38): nowe TC-DEAL-030 do TC-DEAL-034; TC-DEAL-022, TC-DEAL-023, TC-DEAL-025, TC-DEAL-026, TC-DEAL-027 wg nowych reguł; wnioski 34–36, 38 rozstrzygnięte, nowy 39; poprzednio rev 9g (2026-10-31) — doprecyzowanie D192 (rejestr @cdf27dc, PR #38): nowe TC-DEAL-028 („Oznacz jako przegrany” i `status = lost` bez powodu → 422 `REASON_REQUIRED`) i TC-DEAL-029 (masowa zmiana na `rejected` → `failedItems`); zapis `403 FORBIDDEN` w asercjach braku uprawnień; poprzednio rev 9f (2026-10-31) — poprawki z review #33 (rev 4): etap `contact` zamiast spoza D33 w TC-DEAL-023 i TC-DEAL-025, definicja U4 w TC-DEAL-022; poprzednio rev 9e (2026-10-31) — nowe TC-DEAL-023 do TC-DEAL-027 (D192: etap `rejected`, powód i wynik, „Oznacz jako przegrany”, ścieżka masowa, seed, okno UI na etapie kodu); TC-DEAL-018 wg D185 rev 4d (`rejected` poza sumą inwestycji); D41 przez TC D192; wniosek 28 zamknięty; rejestr @0bff741 (PR #33); poprzednio rev 9d (2026-10-31) — TC-DEAL-018 i TC-FCST-007 wg doprecyzowań D185/D191 (prognoza wyklucza etap `rejected` niezależnie od `closure_outcome`); nowy TC-DEAL-022 (D193: domyślny opiekun deala z n8n); zapis `403 FORBIDDEN` w TC-EXEC-006; rejestr @0be9356 (PR #33); poprzednio rev 9c (2026-10-31) — nowy TC-FCST-007 (D191: deal `lost` → otwarty wraca do prognozy, bez reakcji modułów własnych); asercje TC-DEAL-019 (D187: 403 `FORBIDDEN`, 422 `INVESTMENT_ARCHIVED`, kto archiwizuje, CHECK) i TC-EXEC-006 (D188: 403 bez `project_schedule.edit`, bez powodu, audyt); decisions @fa3c15d (PR #36, doprecyzowania D186–D188 „zmiana 2026-10-31”, nowa D191); poprzednio rev 9b (2026-10-31) — meta (P21): numery D w TC-DEAL-018..021 i TC-EXEC-006; poprzednio rev 9a (2026-10-31) — asercje TC-DEAL-019 (D187), TC-DEAL-020 (D190), TC-DEAL-021 (D189), TC-EXEC-006 (D188) wg decisions @49384e6 (PR #35, runda 2: rozstrzygnięcia techniczne Cezara 2026-10-31); notatka przy TC-DEAL-009 (L3); poprzednio rev 9 (2026-10-31) — nowe TC dla D185 (etapy lejka a kosztorys), D187 (status inwestycji), D189 (klucz push części, etap kodu), D190 (właściciel inwestycji) i D188 w części harmonogramu (`reopened_at` po usunięciu deala), rejestr decisions @730b77d (PR #35, `docs/arch-gaps-d185`); poprzednio rev 8e (2026-10-31) — meta: data rev 8d poprawiona na faktyczną; poprzednio rev 8d (2026-10-31) — TC-DEAL-017: priorytet P1 → P0 (spójnie z TC-PD-PRJ-012, reguła D31/D132); poprzednio rev 8c (2026-10-23) — TC-DEAL-016: lookup po postępowaniu + części (etap kodu, D32); poprzednio rev 8b (2026-10-23, rozstrzygnięcie D31) — wiersz D31 wg nowej treści (przetarg bez części = 1 deal, z częściami — deal i inwestycja na część), nowy TC-DEAL-017 (przetarg z częściami, D132); poprzednio rev 8a (2026-10-23, odbiór #20) — TC-CUR-012: usunięta zbędna linia „Krok 3: kurs ręczny nie odblokowuje…” (treść w linii kroku 3); poprzednio rev 8 (2026-10-23, runda PR D) — TC-CUR-012 i TC-CUR-014: wskazany krok zwracający 422 (samo ustawienie kursu ręcznego nie zwraca 422; 422 przy wysłaniu, odpowiednio przy powtórzeniu dodania pozycji); poprzednio runda rev 8h — waluta bez kursu w żadnej tabeli NBP: TC-CUR-012 przepisany (422 dla waluty oferty, kurs ręczny nie odblokowuje, CNY przechodzi), nowy TC-CUR-014 (v1, 422 dla waluty pozycji), wniosek 26 zamknięty, annex do D97; poprzednio runda rev 8g — TC-CUR-011: wyszukiwanie modułu Waluty o 00:30 czasu warszawskiego daje kurs z dnia poprzedniego, wysłanie oferty liczy datę w Europe/Warsaw, suma deali zaokrąglona do całości, godziny graniczne lato/zima; TC-CUR-001: zamrożony obraz bez źródła kursu; poprzednio rev 7 (runda rev 8f) — waluty przez moduł Waluty platformy (TC-CUR-002..007 przepisane, nowe TC-CUR-008..013), annex do D94; poprzednio rev 6 — zgodność z decyzjami koordynacyjnymi (`.ai/vision.md`, `.ai/decisions.md`, `.ai/om-architecture-checklist.md`) i rozstrzygnięciami Koordynatora z 2026-10-23; mapowanie scenariuszy na decyzje w załączniku „Traceability TC → D”

---

## Liczniki scenariuszy

| Obszar | Liczba scenariuszy |
|--------|-------------------|
| Kalkulacja kosztów (TC-COST) | 24 |
| Import/eksport (TC-IMP) | 8 |
| Powiązania deal/projekt/inwestycja (TC-DEAL) | 35 |
| Wersje i oferta (TC-VER) | 12 |
| Cenniki (TC-PRICE) | 5 |
| Widoczność i uprawnienia (TC-PERM) | 12 |
| Koszty rzeczywiste (TC-REAL) | 3 |
| Harmonogram Gantt (TC-GANTT) | 11 |
| Testy wydajności (TC-PERF) | 3 |
| Waluty (TC-CUR) | 14 |
| Firmy bez modułu harmonogramu (TC-NOSCHED) | 5 |
| Prognoza produkcji (TC-FCST) | 8 |
| Harmonogram ofertowy → wykonawczy (TC-EXEC) | 6 |
| Bezpieczeństwo plików (TC-SEC) | 6 |
| Izolacja multi-tenant (TC-TEN) | 7 |
| Edycja równoległa (TC-CONC) | 5 |
| **Razem** | **164** |

---

## 1. Zakres i priorytety (macierz ryzyka)

### 1.1. Ryzyka biznesowe i ich mapowanie

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Błędy kalkulacji finansowej (zaokrąglenia, dzielenie przez zero) | Wysoki | Krytyczny | P0 | Kalkulacja | TC-COST-001 do TC-COST-024 |
| R2 | Wyciek danych międzytenantowych (multitenant izolacja) | Średni | Krytyczny | P0 | Uprawnienia + Tenant | TC-PERM-001 do TC-PERM-012, TC-TEN-001 do TC-TEN-007, TC-VER-009, TC-VER-011 |
| R3 | Uszkodzenie danych przy imporcie (złe kodowanie, formatowanie) | Wysoki | Wysoki | P1 | Import/eksport | TC-IMP-001 do TC-IMP-008 |
| R4 | Utrata integralności oferty po wysłaniu (zmiana ceny, marży) | Średni | Wysoki | P1 | Wersje | TC-VER-001 do TC-VER-012, TC-PRICE-005 |
| R5 | Niekonwersja oferty przy wygranym dealu (brak synchronizacji) | Średni | Wysoki | P1 | Harmonogram wykonawczy | TC-EXEC-001 do TC-EXEC-006 |
| R6 | Błędy harmonogramu (cykl, zależności, auto-przesunięcie) | Średni | Wysoki | P1 | Harmonogram | TC-GANTT-002 do TC-GANTT-011, TC-NOSCHED-002 do TC-NOSCHED-005 |
| R7 | Duplikowanie lub gubianie inwestycji (dopasowanie) | Niski | Wysoki | P2 | Powiązania | TC-DEAL-009 do TC-DEAL-022 |
| R8 | Ataki plikowe (XLSX bomb, formula injection) na VPS | Wysoki | Krytyczny | P0 | Bezpieczeństwo plików | TC-SEC-001 do TC-SEC-006 |
| R9 | Utrata danych przy równoległej edycji (race condition) | Średni | Krytyczny | P0 | Edycja równoległa | TC-CONC-001 do TC-CONC-005 |
| R10 | Błędy walutowe (kursy, zamrożenie, zaokrąglenia per waluta) | Średni | Wysoki | P1 | Waluty | TC-CUR-001 do TC-CUR-014 |
| R11 | Nieprawidłowa prognoza produkcji (suma ≠ partie, prob) | Niski | Średni | P2 | Prognoza | TC-FCST-001 do TC-FCST-007 |
| R12 | Wyciek danych przez eksport / PDF (marża, koszty) | Wysoki | Wysoki | P1 | Uprawnienia, Waluty, Tenant | TC-PERM-007, TC-TEN-004, TC-CUR-005 |
| R13 | Wartość deala niezgodna z ofertą (automatyczna zmiana, nadpisanie z n8n, wersja nieaktywna) | Średni | Wysoki | P0 | Powiązania, Wersje | TC-DEAL-002, TC-DEAL-016, TC-VER-007, TC-VER-010 |
| R14 | Wysłanie oferty z błędem (brak pozycji, ujemna cena, błędy importu) albo wyciek znaku marży przy blokadzie | Średni | Wysoki | P0 | Wersje | TC-VER-008, TC-VER-009 |
| R15 | Błędna migracja inwestycji (duplikaty, utrata ról ofert) | Średni | Wysoki | P0 | Powiązania | TC-DEAL-013 do TC-DEAL-015 |

### 1.2. Poza zakresem (Phase 2+)

- Integracje z Sekocenbud, Intercenbud, systemami zewnętrznymi
- Adapter MS Project
- Ręczny wiersz sumy częściowej (w MVP sumy sekcji liczy system — TC-COST-020)
- Ręczna korekta kursu poza oknem przed wysłaniem (TC-CUR-007)
- Kurs krzyżowy przy walucie bazowej innej niż PLN
- Scenariusze sprawdzające konkretne biblioteki (siatka, Gantt, XLSX, PDF): plan testuje zachowanie, nie pakiety
- Systemy płatności i faktury
- Mobilna aplikacja

### 1.3. Etapy (pole „Etap” w scenariuszach)

| Etap | Zakres | Scenariusze |
|------|--------|-------------|
| **MVP** | Tryby ceny A (suma linii) i C (koszt × (1 + narzut)); wiersze: sekcja, pozycja, notatka; sumy sekcji automatyczne; import XLSX linii i harmonogramu; ręczne partie; prognoza; zamrożony obraz + PDF; blokady i ostrzeżenia wysłania; „Zastosuj wartość do deala” z aktywnej wersji; „Przelicz z cennika” dla linii bez ręcznej ceny; minimalne inwestycje (ręczne wskazanie, podpowiedź po kodzie), role ofert, pierwsza oferta główna; import CLI inwestycji i ról ofert jako krok wdrożenia; jedna waluta na kalkulację (waluta deala; waluta bazowa bez kursu; inna waluta z kursem z tabeli A NBP zamrożonym przy wysłaniu albo kursem ręcznym z wersji roboczej) | TC-COST (poza -007, -012), TC-IMP-001..007, TC-DEAL-001..005, TC-DEAL-011..016, TC-VER-002, -003, -006..-012, TC-PRICE-003, -005, TC-PERM (poza -004, -006, -008), w tym -010..-012, TC-PERF-001, -003, TC-CUR-001..012 (TC-CUR-004 i -005 częściowo v1), TC-NOSCHED-001, -003, TC-FCST-002..006, TC-SEC (poza -003), TC-TEN, TC-CONC |
| **v1** | Cały moduł harmonogramu z Ganttem (włączanie per organizacja, harmonogram inwestycji, faza wykonawcza); tryb B (marża docelowa); eksport XLSX; „Nowa rewizja”; porównanie wersji; cennik warstwowy; przeliczniki jednostek; marża po zamknięciu deala; „tylko własne deale”; koszty rzeczywiste; dopasowanie inwestycji po identyfikatorach; scalanie i rozdzielanie inwestycji (wybór oferty głównej); dashboard rankingu marż; waluty per pozycja; dzienne pobieranie kursów | TC-COST-007, -012, TC-IMP-008, TC-DEAL-006..010, TC-VER-001, -004, -005, TC-PRICE-001, -002, TC-PERM-004, -006, -008, TC-REAL, TC-GANTT, TC-PERF-002, TC-CUR-004 (przeliczenie), TC-CUR-005 (XLSX), TC-CUR-013, TC-NOSCHED-002, -004, -005, TC-FCST-001, TC-EXEC, TC-SEC-003 |
| **v2** | Integracje cenników zewnętrznych | TC-PRICE-004 |

---

## 2. Poziomy testów

Mapowanie do narzędzi i konwencji repo:

| Poziom | Narzędzie | Konfiguracja | Ścieżka testów | Komenda |
|--------|-----------|--------------|----------------|---------|
| **Unit** | Jest | `apps/mercato/jest.config.cjs` (rozszerza `jest.config.base.cjs`; `testMatch: src/**/__tests__/**/*.test.(ts\|tsx)`) | `apps/mercato/src/modules/<moduł>/__tests__/*.test.ts` | `yarn test` (całość, turbo) lub `yarn workspace @open-mercato/app test src/modules/<moduł>/__tests__` |
| **Integration** | Playwright (`@playwright/test`) | `.ai/qa/tests/playwright.config.ts` (tylko współdzielony config + discovery) | `apps/mercato/src/modules/<moduł>/__integration__/TC-*.spec.ts` | `yarn test:integration` / `yarn test:integration:ephemeral` |
| **API** | Playwright (`request` + helpery `@open-mercato/core/helpers/integration/api`) | jw. | jw. (`__integration__/TC-*.spec.ts`) | jw. |
| **E2E/UI** | Playwright (przeglądarka + `helpers/integration/auth`) | jw. | jw. (`__integration__/TC-*.spec.ts`) | jw. |
| **Performance** | Custom bash/Node | `.ai/agentic.config.json` | Manualne + monit RAM/CPU | `yarn dev:profile` |

Zasady (zgodnie z `.ai/qa/AGENTS.md` i wzorcem `packages/core/src/modules/sync_excel/__integration__/TC-SX-001.spec.ts`):

- **Unit** = wyłącznie logika czysta, bez DB i HTTP: kalkulacje, zaokrąglenia, narzuty/marża, parser importu XLSX/CSV, walidatory zod, auto-planowanie harmonogramu (przesuwanie następników, wykrywanie cykli), prognoza produkcji.
- **Integration / API / E2E/UI** = jeden mechanizm: Playwright w folderze `__integration__` modułu, uruchamiany na prawdziwej aplikacji i bazie (dev server lub środowisko ephemeral w Dockerze). Oznaczenia „Integration”, „API”, „UI”, „E2E” w scenariuszach opisują *warstwę asercji* (stan danych / kontrakt HTTP / interfejs), a nie osobne narzędzie.
- Przykładowe ścieżki: `apps/mercato/src/modules/project_costing/__integration__/TC-COST-021.spec.ts`, `apps/mercato/src/modules/project_schedule/__integration__/TC-GANTT-001.spec.ts` (moduły `project_costing` i `project_schedule`). Jeden plik `.spec.ts` na scenariusz, ID scenariusza w nazwie pliku.
- Dane testowe: fixtures tworzone per test przez API (helpery `@open-mercato/core/helpers/integration/*`, np. `crmFixtures`, `authFixtures`, `generalFixtures`), sprzątanie w `finally`; nigdy nie polegać na danych seed/demo. Bezpośrednie asercje na DB (np. idempotentność, constrainty) — jak w TC-SX-001 przez klienta `pg`; kolejki — `drainIntegrationQueue`.
- Testy zależne od modułu harmonogramu oznaczyć metadanymi `__integration__/meta.ts` (`requiredModules`), żeby były pomijane, gdy moduł nie jest włączony.
- Nie umieszczać wykonywalnych `.spec.ts` w `.ai/qa/tests` (katalog tylko na współdzielony config Playwright).
- Każda trasa API modułu ma test Playwright w `__integration__` dodany w tej samej zmianie co trasa (checklista architektury, „Wycena i testy”).
- Role w testach: wyłącznie role OM `superadmin`, `admin`, `employee` oraz role własne tworzone w fixture (`createRoleFixture`) z wybranymi feature'ami. Nie zakładamy, że istnieją role manager lub sales. Widoczność kosztu i marży oraz edycja narzutu wynikają wyłącznie z feature'ów ról; ustawienie organizacji to tylko domyślne przypisanie feature'ów do ról.
- Feature'y `project_costing` (MVP): `view`, `view_prices`, `view_costs`, `view_margin`, `edit`, `edit_markup`, `lock`, `apply_to_deal`, `import`, `admin`, `manage_investments`, `manage_offer_roles`; (v1): `view_margin_after_close`, `export`, `new_revision`, `view_actual_costs`, `edit_actual_costs`. Feature'y `project_schedule` (v1): `view`, `edit`, `admin`, `import`, `export`, `manage_investment_schedule`.
- Domyślnie `employee` nie ma: `project_costing.view_costs`, `view_margin`, `view_margin_after_close`, `edit_markup`, `apply_to_deal`, `admin`, `new_revision`, `view_actual_costs`, `edit_actual_costs` oraz `project_schedule.admin`.
- „Audit trail” w scenariuszach = wpis w `audit_logs` z zapisu wykonanego komendą (z undo); bez własnych tabel audytu. Pola wrażliwe (koszt jednostkowy, narzuty, docelowa marża) — w audycie tylko nazwa pola, bez wartości (TC-VER-011).
- Ustawienia modułu są per organizacja (`ModuleConfigService`, `module_configs`); feature toggle tylko jako globalny wyłącznik modułu per tenant.
- Daty harmonogramu: koniec wliczony, czas trwania = koniec − start + 1 w dniach kalendarzowych.
- Asercje na komunikatach UI: na locale `pl`, dokładny tekst; klucz i18n musi mieć też tłumaczenie `en`.

---

## 3. Scenariusze testowe: Kalkulacja kosztów (24 TC)

Podstawowe operacje kalkulacji, arytmetyka finansowa, zaokrąglenia, jednostki, narzuty i ceny.

#### TC-COST-001: Siatka wierszy — dodaj pozycję

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Kalkulator otwarty, pusty lub z istniejącymi wierszami
- **Kroki**:
  1. Kliknij "Dodaj pozycję"
  2. Uzupełnij: nazwa, ilość (1.5), jednostka (m³), koszt jednostkowy (100.00), cena (150.00)
  3. Zapisz
- **Oczekiwane wyniki**:
  - Wiersz dodany, wartość = 1.5 × 150 = 225.00
  - Sumy zaktualizowane
  - Brak błędów walidacji

#### TC-COST-002: Siatka wierszy — sekcja grupująca

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Kalkulator z co najmniej 2 pozycjami
- **Kroki**:
  1. Dodaj sekcję "Materiały"
  2. Przenieś 2 pozycje do sekcji (drag-drop lub pole Parent)
  3. Sekcja ma pole "Marża sekcji" (% lub kwota)
- **Oczekiwane wyniki**:
  - Sekcja grupuje pozycje, warunkowe rozwijanie
  - Suma sekcji = sum(pozycji) + marża sekcji
  - Narzut sekcji dziedziczony do pozycji (bez ręcznej ceny)

#### TC-COST-003: Zaokrąglenia — suma groszy vs suma zaokrąglonych

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: 3 pozycje z cenami nie-całkowitymi; organizacja z domyślnym ustawieniem zaokrąglenia
- **Kroki**:
  1. Cena 1: 100.33 PLN, Cena 2: 200.34 PLN, Cena 3: 150.33 PLN
  2. Sumy = ?
  3. Pozycja o wartości surowej 1.005 oraz pozycja o wartości surowej 2.345
- **Oczekiwane wyniki**:
  - Każda pozycja zaokrąglana half-up do 2 miejsc dziesiętnych: 100.33, 200.34, 150.33 (tu bez zmiany)
  - Suma = 100.33 + 200.34 + 150.33 = 450.99 (suma pozycji już zaokrąglonych, nie zaokrąglenie sumy surowej)
  - 1.005 → 1.01 (nie 1.00); 2.345 → 2.35 (nie 2.34) — zaokrąglenie „do parzystej” nie występuje w żadnym ustawieniu
  - Zaokrąglenie konfigurowalne per organizacja (domyślnie half-up do 2 miejsc); dwie organizacje z różnymi ustawieniami — TC-TEN-007

#### TC-COST-004: Dzielenie przez zero — jednostka z zerem

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z ilością = 0
- **Kroki**:
  1. Ustaw ilość = 0, koszt = 100, cena = 50
  2. Zapisz
- **Oczekiwane wyniki**:
  - Wartość = 0 × 50 = 0 (poprawnie)
  - Brak exception, UI nie zawieszony
  - Komunikat ostrzegawczy: "Ilość = 0"

#### TC-COST-005: Marża ujemna — sygnalizacja

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Pozycja z całkowitym kosztem 200, ceną 150
- **Kroki**:
  1. Marża kalkulowana = 150 - 200 = -50 (ujemna)
  2. Zapisz
- **Oczekiwane wyniki**:
  - Marża wyświetlona na czerwono (status token), wartość -50 PLN (-25%)
  - Widget podsumowania pokazuje marżę ujemną całej kalkulacji
  - Brak blokady zapisu, ale ostrzeżenie

#### TC-COST-006: Cena zero — dopuszczalna, ostrzeżenie przy wysłaniu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Pozycja z kosztem 100; użytkownik z `project_costing.view_margin`
- **Kroki**:
  1. Ustaw cenę jednostkową = 0 (darmowy transport, reklamacja)
  2. Zapisz
  3. Wyślij wersję
- **Oczekiwane wyniki**:
  - Zapis przyjęty, brak błędu walidacji
  - Marża kwotowa pozycji = 0 − 100 = −100; marża % przy cenie 0 jest niezdefiniowana — wyświetlana jako „—”, bez wyjątku i bez dzielenia przez zero
  - Wysłanie: ostrzeżenie „cena zero” wymagające potwierdzenia, bez blokady; po ponowieniu z potwierdzeniem wersja wysłana (macierz w TC-VER-008)

#### TC-COST-007: Jednostki — przeliczniki ze słownika

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Słownik jednostek organizacji z przelicznikiem m³ → t (1 m³ = 2.4 t) dla elementu „Beton C30/37”; pozycja w m³, cena z cennika w t
- **Kroki**:
  1. Dodaj pozycję 2 m³ z ceną z cennika 100.00 PLN/t
  2. Zapisz
  3. Dodaj pozycję w szt. z ceną w t (brak przelicznika szt. ↔ t)
- **Oczekiwane wyniki**:
  - Cena pozycji przeliczona przez przelicznik ze słownika: 100.00 PLN/t × 2.4 = 240.00 PLN/m³; wartość = 2 × 240.00 = 480.00
  - Brak przelicznika: błąd walidacji, brak cichego przyjęcia ceny w innej jednostce
  - W MVP przeliczników nie ma — patrz TC-COST-023

#### TC-COST-008: Jednostki — niezgodne (błąd)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z m³
- **Kroki**:
  1. Spróbuj sumować m³ + kg w tej samej sekcji
  2. Zapisz
- **Oczekiwane wyniki**:
  - Ostrzeżenie: "Niezgodne jednostki w sekcji"
  - Sumy sekcji nie sumują jednostek (tylko wartości PLN)
  - Zezwolone w całej kalkulacji

#### TC-COST-009: Narzut — dziedziczenie (pozycja → sekcja → wersja)

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Struktura: Wersja (narzut 20%) > Sekcja A (narzut 30%) > Pozycja 1 (bez narzutu)
- **Kroki**:
  1. Pozycja 1: koszt 100, cena wpisana?
  2. Wyznacz cenę od narzutu sekcji (100 × 1.30 = 130)
  3. Jeśli sekcja bez narzutu, użyj wersji (100 × 1.20 = 120)
- **Oczekiwane wyniki**:
  - Najściślejszy narzut (sekcja 30%) przebija wersję (20%)
  - Jeśli ręczna cena pozycji → nie nadpisywana

#### TC-COST-010: Ręczna cena pozycji — nie nadpisywana

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z narzutem sekcji 30%, ręczna cena
- **Kroki**:
  1. Ustaw cenę = 999 (ręcznie, poza narzutem)
  2. Zmień narzut sekcji z 30% na 50%
  3. Zapisz
- **Oczekiwane wyniki**:
  - Cena pozycji pozostaje 999 (nie zmienia się automatycznie)
  - Marża zmienia się (nowa = 999 - koszt), ale cena nie

#### TC-COST-011: Trzy sposoby ustalenia ceny — suma linii

- **Priorytet**: P0 | **Etap**: MVP (tryb A) | **Poziom**: Integration
- **Warunki wstępne**: 3 pozycje, każda z ręczną ceną
- **Kroki**:
  1. Mode: "Suma cen z wierszy"
  2. Pozycja 1: 100 PLN, 2: 200 PLN, 3: 150 PLN
  3. Cena oferty = suma
- **Oczekiwane wyniki**:
  - Cena oferty = 100 + 200 + 150 = 450 PLN
  - Zmiana ceny pozycji → zmiana oferty automatycznie

#### TC-COST-012: Trzy sposoby ustalenia ceny — marża docelowa

- **Priorytet**: P0 | **Etap**: v1 (tryb B) | **Poziom**: Integration
- **Kroki**:
  1. Mode: "Marża docelowa"
  2. Całkowity koszt = 1000 PLN, marża docelowa = 30% (procent od ceny)
  3. Wyznacz cenę: Koszt = Cena × (1 - Marża%), czyli 1000 = Cena × 0.70
  4. Cena = 1000 / 0.70 = 1428.57 PLN
- **Oczekiwane wyniki**:
  - Cena oferty = 1428.57 PLN
  - Marża rzeczywista = 428.57 / 1428.57 = 30%
  - Zmiana kosztu → nowa cena

#### TC-COST-013: Trzy sposoby ustalenia ceny — koszt × (1 + narzut)

- **Priorytet**: P0 | **Etap**: MVP (tryb C) | **Poziom**: Unit + Integration
- **Kroki**:
  1. Tryb ceny: „Koszt × (1 + narzut)”
  2. Pozycja P1: koszt 600.00; pozycja P2: koszt 400.00; narzut 50%
  3. Odczytaj cenę każdej pozycji, cenę oferty, marżę i narzut
- **Oczekiwane wyniki**:
  - Narzut liczony per pozycja: P1 = 600.00 × 1.50 = 900.00; P2 = 400.00 × 1.50 = 600.00
  - Cena oferty = 900.00 + 600.00 = 1 500.00 PLN (suma pozycji już zaokrąglonych)
  - Marża kwotowo = 1 500.00 − 1 000.00 = 500.00 PLN
  - Marża % liczona od ceny sprzedaży: 500.00 / 1 500.00 = 33.33%
  - Narzut 50% (od kosztu) to wartość wejściowa i widok pomocniczy — narzut ≠ marża; UI i API nie pokazują 50% jako marży

#### TC-COST-014: Marża — kwotowa i procentowa

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Cena 1000, koszt 600
- **Kroki**:
  1. Marża kwotowa = 1000 - 600 = 400 PLN
  2. Marża % = (1000 - 600) / 1000 = 40% (na cenie) lub (400 / 600) = 66.7% (na koszcie)
- **Oczekiwane wyniki**:
  - Marża kwotowa = 1000 - 600 = 400 PLN
  - Marża % = (1000 - 600) / 1000 = 40% **na cenie** (definicja: marża = % od ceny sprzedaży)
  - Narzut % (widok pomocniczy): 400 / 600 = 66.7% na koszcie — wyświetlany osobno z jasnym podpisem "Narzut"
  - Oba wyświetlone: "Marża 40% (na cenie)" i "Narzut 66.7% (na koszcie)"

#### TC-COST-015: Narzut — ręczne nadpisanie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Narzut sekcji = 30%, cena pozycji = koszt × 1.40
  2. Zapisz jako "ręczne nadpisanie narzutu"
- **Oczekiwane wyniki**:
  - Cena nie zmienia się przy zmianie narzutu
  - Pole "źródło ceny" = "ręczne nadpisanie"

#### TC-COST-016: Jednostki — słownik firm

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Firma ustawiła słownik: m³, m², mb, kg, szt., h
- **Kroki**:
  1. Dodaj pozycję, dropdown jednostek
  2. Wybierz m³
- **Oczekiwane wyniki**:
  - Tylko jednostki ze słownika firmy dostępne
  - Dodaj nową jednostkę (rola Admin)

#### TC-COST-017: Ekstremalne wartości — duże liczby

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: -
- **Kroki**:
  1. Ilość = 999999, koszt = 99999.99, cena = 999999.99
  2. Zapisz
- **Oczekiwane wyniki**:
  - Brak overflow/underflow (JavaScript Number lub Decimal)
  - Wyświetlenie bez naukowej notacji

#### TC-COST-018: Ekstremalne wartości — ujemne

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Kroki**:
  1. Ilość = -5 (zwrot?), koszt = -100 (kredyt), cena = -200
  2. Zapisz wersję roboczą
  3. Wyślij wersję
- **Oczekiwane wyniki**:
  - Zapis wersji roboczej przyjęty (zwrot, rabat)
  - Marża liczona tym samym wzorem: (cena − koszt) / cena
  - Wysłanie zablokowane: pozycja z ujemną ceną blokuje wysłanie (macierz w TC-VER-008)

#### TC-COST-019: Notatka (wiersz informacyjny)

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Kroki**:
  1. Dodaj wiersz typu "notatka"
  2. Tekst = "Transport dodatkowo negocjowany"
  3. Zapisz
- **Oczekiwane wyniki**:
  - Wiersz widoczny w siatce, bez ilości i ceny, nie wpływa na sumy sekcji ani całości
  - PDF zawiera notatki
  - Sekcja zawierająca wyłącznie notatki liczy się przy wysłaniu jako „brak pozycji”, jeśli w całej wersji nie ma żadnej pozycji (TC-VER-008)

#### TC-COST-020: Sumy sekcji — liczone automatycznie (bez wiersza sumy częściowej)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Kroki**:
  1. Sekcja A: 3 pozycje o wartościach 100.00, 150.00, 250.00
  2. Sekcja B: 2 pozycje o wartościach 100.00, 200.00
  3. Spróbuj dodać wiersz typu „suma częściowa” (UI i API)
  4. Dodaj w sekcji A pozycję 50.00; usuń z sekcji B pozycję 100.00; przenieś pozycję 150.00 z sekcji A do B
- **Oczekiwane wyniki**:
  - Suma sekcji A = 500.00 i sekcji B = 300.00 — liczone automatycznie przez system i pokazywane przy sekcji
  - Suma całości = 800.00 = suma pozycji już zaokrąglonych
  - W MVP nie ma typu wiersza „suma częściowa”: brak opcji w UI; API odrzuca taki typ wiersza błędem walidacji (422)
  - Dozwolone typy wierszy w MVP: sekcja, pozycja, notatka
  - Krok 4: po każdej operacji sumy przeliczone; końcowo sekcja A = 400.00, sekcja B = 350.00, całość = 750.00

#### TC-COST-021: Edycja bezpośrednia w komórkach (Excel-like)

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI
- **Kroki**:
  1. Kliknij na komórkę "ilość"
  2. Wpisz nową wartość, Enter
  3. Następna komórka aktywna
- **Oczekiwane wyniki**:
  - Wartość zaktualizowana, sumy przeliczone
  - Brak full-page refresh
  - Kopiuj/wklej z Excela działa

#### TC-COST-022: Kopiuj/wklej z Excela — przywleczenie całego wiersza

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: E2E/UI + Integration
- **Kroki**:
  1. Excel: 2 m³ | 100 | 50 PLN/m³ | 100 PLN (wpisane)
  2. Kopiuj wiersz z Excela, wklej do kalkulatora
  3. Mapowanie kolumn (lub automatyczne)
- **Oczekiwane wyniki**:
  - Wiersz wklejony z poprawnymi wartościami
  - Sumy przeliczone

#### TC-COST-023: Jednostka pozycji i ceny — w MVP muszą być zgodne

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Warunki wstępne**: Słownik jednostek organizacji: m³, t, szt.; pozycja cennika „Beton C30/37” w m³
- **Kroki**:
  1. Dodaj pozycję w m³ z ceną z cennika w m³, zapisz
  2. Zmień jednostkę pozycji na t, zostawiając cenę z cennika w m³, zapisz
  3. Wyślij przez API pozycję z jednostką spoza słownika („tona”)
- **Oczekiwane wyniki**:
  - Krok 1: zapis przyjęty
  - Krok 2: błąd walidacji niezgodności jednostki pozycji i jednostki ceny; brak automatycznego przeliczenia (przeliczniki od v1, TC-COST-007)
  - Krok 3: 422 — jednostka spoza słownika organizacji
  - Komunikaty walidacji na locale `pl`, klucze i18n z tłumaczeniem `en`

#### TC-COST-024: Brak formuł w siatce MVP

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + E2E/UI + API
- **Kroki**:
  1. W komórce „ilość” wpisz kolejno: `=2*3`, `2*3`, `=A1+B1`
  2. Zapisz
  3. Wyślij przez API pozycję z ilością `"=2*3"`
- **Oczekiwane wyniki**:
  - Wartość nie jest obliczana ani w przeglądarce, ani na serwerze
  - Zapis odrzucony błędem walidacji (ilość musi być liczbą); API 422
  - Wyrażenia ilości (np. z wymiarów elementu) z bezpiecznym parserem są poza MVP (v1) i nie są częścią tego scenariusza

---

## 4. Scenariusze testowe: Import/Eksport (8 TC)

Łatwy import z XLSX/CSV, kreator mapowania, walidacja, eksport zgodny z Excelem.

**Import XLSX jest w MVP**: scenariusze importu TC-IMP-001..007 mają etap MVP i priorytet P0–P1; eksport XLSX (TC-IMP-008) ma etap v1. Pliki testowe to pliki zapisane w polskim Excelu (przecinek dziesiętny, „1 234,56”, polskie znaki); scenariusze nie sprawdzają konkretnej biblioteki. Import działa asynchronicznie (`ProgressJob` + worker kolejki) — w testach Playwright kolejka opróżniana przez `drainIntegrationQueue`.

#### TC-IMP-001: Import XLSX — mapowanie kolumn

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: E2E/UI + Integration
- **Warunki wstępne**: Plik XLSX: Pozycja | Ilość | Cena
- **Kroki**:
  1. Kliknij "Import"
  2. Wybierz plik XLSX
  3. Kreator: mapuj Pozycja → Nazwa, Ilość → Ilość, Cena → Cena jednostkowa
  4. Zapisz mapowanie (remember)
  5. Podgląd: ~10 wierszy
  6. Import
- **Oczekiwane wyniki**:
  - Wiersze zaimportowane, sumy przeliczone
  - Mapowanie zapamiętane dla kolejnych importów z tego pliku
  - Import uruchomiony jako `ProgressJob` (postęp widoczny, nie blokuje żądania HTTP)

#### TC-IMP-002: Import CSV — kodowanie UTF-8 i ANSI

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Kroki**:
  1. CSV UTF-8 z polskimi znakami: "śruba M10 × 50mm"
  2. CSV ANSI (Windows-1250)
  3. Import obu
- **Oczekiwane wyniki**:
  - Obie poprawnie zdekodowane (auto-detect lub dropdown)
  - Znaki pojawiają się prawidłowo

#### TC-IMP-003: Import — separator (przecinek / średnik / tab)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. CSV z ";", CSV z ","
  2. Import
- **Oczekiwane wyniki**:
  - Auto-detect lub dropdown
  - Kolumny rozdzielone prawidłowo

#### TC-IMP-004: Import — przecinek dziesiętny (1.5 vs 1,5)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. XLSX/CSV: "1.5 m³", "100,50 PLN", "1 234,56" (polski format z separatorem tysięcy spacją)
  2. Import
- **Oczekiwane wyniki**:
  - Rozpoznane jako 1.5, 100.50 i 1234.56
  - Logika: jeśli separator=",", to "," = kropka, "." = separator tysiąca
  - Brak błędów parsowania

#### TC-IMP-005: Import — błędy w wierszach (złe dane)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. XLSX: Wiersz 3 brakuje ilości, Wiersz 5 cena = "abc", Wiersz 7 = puste
  2. Import
- **Oczekiwane wyniki**:
  - Wiersze 1,2,4,6,8+ zaimportowane
  - Wiersz 3,5,7 wyróżniony (czerwony), błąd: "Brakuje Ilości", "Cena: wartość nie-numeryczna"
  - Opcja: pomiń, popraw lub przerwij
  - Wersja z nierozwiązanymi błędami importu nie może zostać wysłana (blokada — TC-VER-008)

#### TC-IMP-006: Import — duże pliki i limity

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Performance
- **Kroki**:
  1. XLSX: 5000 wierszy × 10 kolumn (~5 MB)
  2. Import, monit RAM/CPU, czas
- **Oczekiwane wyniki**:
  - Import < 10s (budżet czasu)
  - RAM peak < 500 MB (budżet)
  - **Luka spec**: konkretne limity (5000 rows? 10 MB?) nie sprecyzowane

#### TC-IMP-007: Import XLSX — scalone komórki, formuły, makra

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. XLSX: scalone komórki, formuły (=SUM) z zapisaną wartością i bez zapisanej wartości, wiele arkuszy, makra
  2. Import
- **Oczekiwane wyniki**:
  - Ignoruj formatowanie, bierz wartości
  - Formuła bez zapisanej wartości: wiersz oznaczony błędem („brak wartości formuły”), nie liczony po stronie serwera
  - Wiele arkuszy: użytkownik wybiera arkusz w kreatorze
  - Makra = ignoruj (bezpieczeństwo)
  - Scalone komórki: pierwsze komórka scalona zawiera wartość

#### TC-IMP-008: Eksport XLSX — zgodny z polskim Excelem

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Kalkulator z 5 pozycjami, różne jednostki, marże
  2. Eksport XLSX
  3. Otwórz w polskim Excelu
- **Oczekiwane wyniki**:
  - Format: .xlsx (Microsoft Office), nie .xls
  - Kodowanie UTF-8
  - Polskie znaki: "Śruba" wyświetla się poprawnie
  - Sekcje, sumy, nie tylko dane (opcjonalnie formatowanie)
  - Użytkownik bez `project_costing.export`: brak przycisku, API `403 FORBIDDEN`; użytkownik bez `project_costing.view_margin`: kolumny kosztu i marży pominięte

---


---

## 5. Scenariusze testowe: Powiązania (Deal / Projekt / Inwestycja) — 35 TC

Kalkulacja bez deala, podpięcie deala i inwestycji, rozpoznawanie inwestycji, wybór oferty głównej, migracja starej encji projektu.

Inwestycję zakłada handlowiec w module kalkulacji; n8n inwestycji nie tworzy. Stara encja projektu z Data Designera jest importowana komendą CLI (najpierw przebieg próbny z raportem, potem import po akceptacji) i wyłączana po imporcie.

#### TC-DEAL-001: Kalkulacja bez deala — wycena wewnętrzna

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Nowy kalkulator, bez deala
- **Kroki**:
  1. Stwórz kalkulację: nazwa "Wycena X"
  2. Dodaj 3 pozycje, oblicz cenę
  3. Zapisz bez przypisania do deala
- **Oczekiwane wyniki**:
  - Kalkulator zapisany, status "Robocza" (bez deala)
  - Możliwość edycji i ponownego zapisu
  - Widoczny w liście kalkulacji bez filtra deal

#### TC-DEAL-002: Podpięcie deala później — kalkulacja robocza → deal

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Kroki**:
  1. Otwarty kalkulator bez deala
  2. Kliknij "Podepnij deal"
  3. Wybierz deal z listy (lub utwórz nowy)
  4. Zapisz
- **Oczekiwane wyniki**:
  - Deal przypisany, kalkulacja widoczna na zakładce deala
  - Samo podpięcie NIE zmienia wartości deala; wartość deala zmienia się tylko jawnym przyciskiem „Zastosuj wartość do deala” (TC-VER-007)
  - Historia deala: brak wpisu o zmianie wartości po samym podpięciu

#### TC-DEAL-003: Podpięcie inwestycji — 1:N wiele deali

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Inwestycja "Hala produkcyjna"
  2. Deal 1 (Generalny wykonawca A), Deal 2 (Generalny wykonawca B)
  3. Każdy deal ma swoją kalkulację
- **Oczekiwane wyniki**:
  - Oba deale przypisane do tej samej inwestycji
  - Przy zapisie oferty Deal 2 (inny wykonawca, ta sama inwestycja) system pokazuje dokładnie komunikat „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna” (jak w TC-DEAL-005)
  - Widget inwestycji podsumowuje: 2 oferty, wartości, oferta główna

#### TC-DEAL-004: Oferta główna vs alternatywna — wybór

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Kroki**:
  1. Inwestycja z Deal A (główna, cena 100k) i Deal B (alternatywna, cena 120k)
  2. Zmień ofertę główną na Deal B
  3. Zapisz
- **Oczekiwane wyniki**:
  - System pokazuje komunikat: "Istnieje już oferta główna. Zmienić na nową?"
  - Użytkownik potwierdza
  - Audit trail (`audit_logs`): kto, kiedy, stara→nowa
  - Deal A → alternatywna, Deal B → główna — w jednej transakcji; w bazie nigdy dwie oferty `primary` na inwestycję (baza gwarantuje najwyżej jedną ofertę główną na inwestycję)

#### TC-DEAL-005: Komunikat — wielokrotne oferty dla tej samej inwestycji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: E2E/UI
- **Kroki**:
  1. Inwestycja zaistniała (2 oferty)
  2. Zaloguj się jako użytkownik i przejdź do Deal 3 nowego generalnego
  3. Spróbuj podpiąć do tej samej inwestycji
- **Oczekiwane wyniki**:
  - Komunikat dokładnie: „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”
  - Wybór: Nowa (Deal 3) jako główna | Istniejąca (Deal A/B) zostaje główna | Anuluj
  - Po wyborze: dokładnie jedna oferta `primary` na inwestycję, pozostałe `alternative`; suma lejka liczy tylko oferty główne

#### TC-DEAL-006: Inwestycja — dopasowanie po e-Zamówienia BZP

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Excel import: "e-Zamówienia ID: 9876543"
  2. System szuka istniejących inwestycji po ID
  3. Dopasuj lub utwórz nową
- **Oczekiwane wyniki**:
  - Znaleziona istniejąca inwestycja → podpięcie
  - Lub: "Nowa inwestycja? Potwierdzić mapowanie"
  - Identyfikator e-Zamówienia zapamiętany w inwestycji

#### TC-DEAL-007: Inwestycja — dopasowanie po TED

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Plik import z numerem TED (ogłoszenia)
  2. System szuka inwestycji po identyfikatorze TED
- **Oczekiwane wyniki**:
  - Znaleziona inwestycja → podpięcie
  - Lub fallback: szukaj po nazwie i NIP

#### TC-DEAL-008: Inwestycja — dopasowanie fallback (nazwa + NIP)

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Brak ID przetargowego
  2. Kalkulator: klient = "Acme Inc", NIP = "1234567890", nazwa projektu = "Hala montażu"
  3. System szuka inwestycji "Hala montażu" + NIP
- **Oczekiwane wyniki**:
  - **Podpowiedź**, nie automatyczne dopasowanie
  - Użytkownik potwierdza: "To ta inwestycja? Tak/Nie/Nowa"
  - Priorytet identyfikatorów inwestycji: e-Zamówienia, potem TED, potem BIP, potem własny kod `INV-YYYY-NNNNNN`; podobieństwo nazwy (z NIP) daje wyłącznie podpowiedź (rozstrzygnięte)

#### TC-DEAL-009: Inwestycja — scalanie

> Do przeglądu po decyzji o skutkach merge dla ofert, projektu i harmonogramu (luka L3, D187); kroki bez zmian.

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Dwie inwestycje "Hala A" i "Hala B" (ta sama fizycznie, różne ID)
  2. Admin: "Scal inwestycje"
  3. Wybierz źródłową i docelową
- **Oczekiwane wyniki**:
  - Wszystkie deale/kalkulacje przeniesione
  - Identyfikatory zapamiętane (mapowanie)
  - Audit trail

#### TC-DEAL-010: Inwestycja — rozdzielanie i wybór oferty głównej

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration + E2E/UI + `pg`
- **Warunki wstępne**: Inwestycja „Kompleks” z trzema ofertami: Deal 1 (oryginał, oferta główna), Deal 2 i Deal 3 (alternatywne); admin. Rozdzielenie: Deal 1 i Deal 2 zostają w inwestycji źródłowej „Kompleks” (nazwa bez zmian po podziale), Deal 3 przechodzi do nowej inwestycji „Hala B”
- **Kroki**:
  1. Rozdziel inwestycję, akceptując domyślny wybór oferty głównej
  2. Na świeżych danych: rozdziel, w kroku podziału wybierz Deal 2 jako ofertę główną „Kompleks”
  3. Na świeżych danych: w kroku podziału zaznacz dwie oferty główne dla „Kompleks” (UI i API)
  4. Po każdym kroku: przez `pg` policz oferty główne na inwestycję
- **Oczekiwane wyniki**:
  - Rozdzielenie niedostępne w MVP (brak akcji w UI, API odrzuca)
  - Krok podziału pokazuje wybór oferty głównej osobno dla każdej inwestycji po podziale („Kompleks” i „Hala B”); domyślnie zaznaczona dotychczasowa oferta główna (oryginał, Deal 1) w „Kompleks”, a w „Hala B” jej jedyna oferta (Deal 3)
  - Krok 1: „Kompleks” — Deal 1 główna, Deal 2 alternatywna; „Hala B” — Deal 3 główna (pierwsza oferta na inwestycji)
  - Krok 2: „Kompleks” — Deal 2 główna, Deal 1 alternatywna
  - Krok 3: odrzucone z komunikatem dokładnie „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”; rozdzielenie nie wykonane, dane bez zmian
  - Krok 4: przez `pg` w każdej inwestycji po podziale („Kompleks” i „Hala B”) dokładnie jedna oferta główna
  - Audit trail rozdzielenia

#### TC-DEAL-011: Pierwsza oferta na inwestycji — automatycznie główna

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Inwestycja „Hala C” bez żadnej oferty; Deal X (wykonawca A) i Deal Y (wykonawca B); użytkownik z `project_costing.manage_offer_roles`
- **Kroki**:
  1. Wskaż inwestycję „Hala C” dla oferty na Deal X (pierwsza oferta na tej inwestycji)
  2. Sprawdź rolę oferty Deal X
  3. Wskaż „Hala C” dla oferty na Deal Y
- **Oczekiwane wyniki**:
  - Krok 2: oferta Deal X ma rolę główną automatycznie — bez pytania użytkownika i bez komunikatu
  - Krok 3: komunikat dokładnie „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”; dopóki użytkownik nie wybierze inaczej, główna zostaje Deal X
  - W bazie dokładnie jedna oferta główna na „Hala C” (asercja przez `pg`)
  - Wpis audytu nadania roli: stara wartość brak, nowa wartość „główna”

#### TC-DEAL-012: Ręczne wskazanie inwestycji z podpowiedzią po kodzie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Organizacja A: inwestycje „Hala A” (identyfikator e-Zamówienia i własny kod `INV-2026-000045`) i „Hala B” (`INV-2026-000123`); organizacja B: inwestycja „Hala A” (`INV-2026-000046`); użytkownik A z `project_costing.manage_offer_roles` i `project_costing.manage_investments`
- **Kroki**:
  1. Na dealu otwórz wskazanie inwestycji
  2. Wpisz fragment kodu `INV-2026-0000`
  3. Wybierz „Hala A” z podpowiedzi i zapisz
  4. Na innym dealu wpisz samą nazwę „Hala”, bez kodu
  5. Załóż ręcznie nową inwestycję „Hala D”
- **Oczekiwane wyniki**:
  - Podpowiedzi po kodzie tylko z własnej organizacji („Hala A” z organizacji B się nie pojawia)
  - Przy inwestycji z kilkoma identyfikatorami podpowiedź pokazuje identyfikator o najwyższym priorytecie (e-Zamówienia przed własnym kodem)
  - Nic nie jest przypisywane automatycznie: powiązanie powstaje dopiero po wyborze i zapisie
  - Podobna nazwa to tylko podpowiedź wymagająca potwierdzenia
  - Nowa inwestycja zakładana ręcznie przez użytkownika (handlowca); bez `project_costing.manage_investments` brak przycisku i `403 FORBIDDEN` w API

#### TC-DEAL-013: Import starej encji projektu — przebieg próbny nic nie zapisuje

- **Priorytet**: P0 | **Etap**: MVP (krok wdrożenia) | **Poziom**: Integration (komenda CLI + asercje przez `pg`)
- **Warunki wstępne**: Organizacja A: 5 rekordów starej encji projektu z Data Designera (2 z identyfikatorem e-Zamówienia, 1 z TED, 1 z BIP, 1 bez identyfikatora) powiązanych z 6 dealami
- **Kroki**:
  1. Policz inwestycje i powiązania ofert w module kalkulacji
  2. Uruchom komendę CLI importu inwestycji w trybie próbnym (dry-run)
  3. Policz ponownie, przeczytaj raport
  4. Spróbuj uruchomić właściwy import bez akceptacji raportu
- **Oczekiwane wyniki**:
  - Liczba inwestycji i powiązań bez zmian — przebieg próbny nic nie zapisuje
  - Raport: ile rekordów zostanie utworzonych, pominiętych i odrzuconych (z powodem) oraz jaki identyfikator kanoniczny dostanie każda inwestycja (wg priorytetu identyfikatorów)
  - Stara encja dalej aktywna
  - Właściwy import nie startuje bez jawnej akceptacji raportu (sposób akceptacji wg speki)

#### TC-DEAL-014: Import starej encji projektu — idempotencja i wyłączenie starej encji

- **Priorytet**: P0 | **Etap**: MVP (krok wdrożenia) | **Poziom**: Integration (komenda CLI + asercje przez `pg`)
- **Warunki wstępne**: Stan po TC-DEAL-013; raport zaakceptowany
- **Kroki**:
  1. Uruchom właściwy import
  2. Zapisz stan: liczba inwestycji, ich ID, powiązania z dealami
  3. Uruchom import ponownie
  4. Wyłącz starą encję
- **Oczekiwane wyniki**:
  - Po kroku 1: 5 inwestycji w module kalkulacji, każda z identyfikatorem źródłowym; powiązania z 6 dealami
  - Po kroku 3: stan identyczny jak po kroku 2 — brak duplikatów (idempotencja po identyfikatorze źródłowym)
  - Po kroku 4: stara encja niedostępna do tworzenia i edycji; inwestycja istnieje tylko jako encja modułu kalkulacji
  - Nowe inwestycje po migracji zakłada handlowiec ręcznie (TC-DEAL-012)

#### TC-DEAL-015: Okres przejściowy — rola oferty z n8n przenoszona do modułu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Moduł wdrożony, migracja ról ofert jeszcze niezakończona; n8n wysyła rolę oferty w polu własnym deala przy utworzeniu deala
- **Kroki**:
  1. Symuluj push n8n: nowy deal z rolą „główna” w polu własnym
  2. Uruchom import ról ofert (CLI)
  3. Uruchom import ról ponownie
  4. Symuluj push n8n aktualizujący ten deal (bez pola roli)
  5. Symuluj push n8n z nowym przetargiem
  6. Zakończ migrację; zmień pole własne roli na dealu
- **Oczekiwane wyniki**:
  - Krok 2: rola oferty w module zgodna z polem własnym deala
  - Krok 3: stan bez zmian (import ról idempotentny)
  - Krok 4: rola w module bez zmian
  - Krok 5: push nie tworzy inwestycji (inwestycje zakłada handlowiec)
  - Krok 6: po migracji źródłem roli jest moduł — zmiana pola własnego nie zmienia roli w module
  - Kontrakt n8n w okresie przejściowym bez zmian (n8n nadal wysyła pole roli)

#### TC-DEAL-016: Wartość deala z „Zastosuj wartość do deala” wygrywa z aktualizacją z n8n

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API (kontrakt n8n)
- **Warunki wstępne**: Deal X (postępowanie T-X) z powiązaną kalkulacją; Deal Z (postępowanie T-Z) bez powiązanej kalkulacji; klucz API integracji n8n; drugi klucz API spoza n8n (inna integracja)
- **Kroki**:
  1. Na Deal X kliknij „Zastosuj wartość do deala” z aktywnej wersji: 125 000.00 PLN
  2. Kluczem n8n, ścieżką jak w integracji: wyszukaj deal po identyfikatorze postępowania T-X (lookup), potem PUT aktualizacji Deal X: wartość 140 000.00, waluta EUR, zmiana pola przetargowego (szacunkowa wartość zamówienia, termin składania ofert) i pola roli oferty
  3. Sprawdź Deal X, historię deala i audyt
  4. Kontrola: tą samą ścieżką (lookup T-Z + PUT) kluczem n8n zmień wartość Deal Z
  5. Kontrola: kluczem API spoza n8n zmień wartość Deal X na 150 000.00 PLN
  6. Kontrola: użytkownik CRM ręcznie edytuje wartość Deal X
  7. Etap kodu (kontrakt push z kluczem postępowanie + część, D32): postępowanie T-P z częściami 1 i 2 (jak w TC-DEAL-017), deal części 1 z powiązaną kalkulacją po „Zastosuj wartość do deala”; kluczem n8n wyszukaj deal po identyfikatorze postępowania T-P + część 1 (lookup), potem PUT aktualizacji: wartość i pole przetargowe
- **Oczekiwane wyniki**:
  - Krok 2: lookup zwraca Deal X; PUT przyjęty (bez błędu)
  - Krok 3: wartość 125 000.00 i waluta PLN bez zmian; pole przetargowe i pole roli oferty zaktualizowane; w audycie informacja o pominięciu wartości z n8n
  - Krok 4: wartość Deal Z zmieniona przez n8n (brak powiązanej kalkulacji)
  - Krok 5: wartość Deal X zmieniona na 150 000.00 — reguła dotyczy tylko integracji n8n
  - Krok 6: edycja użytkownika nie jest blokowana; zmiana w historii deala
  - Krok 7: lookup zwraca deal części 1 (nie deal części 2); wartość deala części 1 bez zmian, pole przetargowe zaktualizowane; deal części 2 nietknięty. Do zmiany kontraktu push lookup po samym identyfikatorze postępowania (klucz bez zmian) i krok nie jest wykonywany

#### TC-DEAL-017: Przetarg z częściami — osobna inwestycja i osobny deal na część, wspólny numer ogłoszenia

- **Priorytet**: P0 | **Etap**: MVP (inwestycja i deal na część, `tender_notice_number`), v1 (identyfikator części) | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Dane importu z e-Zamówień: postępowanie T-P z numerem ogłoszenia N i dwiema częściami (1, 2); postępowanie T-S bez części; handlowiec zakłada inwestycje z danych importu
- **Kroki**:
  1. Załóż inwestycje dla części 1 i 2 postępowania T-P; odczytaj `pc_investments.tender_notice_number`; spróbuj zmienić go po założeniu
  2. Utwórz deal dla każdej części, każdy na swojej inwestycji; dodaj w każdej kalkulację i oznacz ofertę `primary`
  3. Filtruj inwestycje po N; `pg`: policz inwestycje i deale postępowania T-P
  4. Postępowanie T-S: kolejne ogłoszenie aktualizuje istniejący deal (ścieżka n8n jak w TC-DEAL-016)
  5. v1: odczytaj identyfikatory dopasowania części w `pc_investment_identifiers`; spróbuj dodać duplikat `(source, value)`
- **Oczekiwane wyniki**:
  - Krok 1: dwie inwestycje ze wspólnym `tender_notice_number` = N (bez unikalności); po założeniu pole tylko do odczytu
  - Krok 2: dwa deale; oferta `primary` per inwestycja (per część) — oznaczenie `primary` w części 2 nie zmienia części 1
  - Krok 3: obie inwestycje na liście; numer nie bierze udziału w dopasowaniu; dokładnie dwie inwestycje i dwa deale (brak wspólnego deala dla całego postępowania)
  - Krok 4: T-S ma jeden deal; brak nowego deala
  - Krok 5 (v1): `source = 'bzp_notice_part'`, `value = 'N#1'` i `'N#2'`; brak identyfikatora `bzp_notice_number` z samym N; duplikat odrzucony
  - Aktualizacja deala danej części przez push n8n wymaga klucza postępowanie + część — etap kodu (zmiana kontraktu push, zadanie Enki); do tego czasu klucz push bez zmian i TC tego nie sprawdza

#### TC-DEAL-018: Etap deala z n8n tylko `result_lead` i `cancelled`; etap nie zmienia kosztorysu

> Decyzje: D185 (z doprecyzowaniami 2026-10-31: prognoza bez `rejected`; rev 4d: `rejected` poza aktywnym lejkiem i sumą inwestycji), D33, D34, D42.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API (kontrakt n8n)
- **Warunki wstępne**: Lejek „Przetargi” (D33); deale z kalkulacją i partiami, `closure_outcome` = NULL: A i D na etapie `new`, B na `result_lead`, C na `offer` i E na `qualify` (ustawione przez użytkownika); deal F na `contact`, z kalkulacją, wersją wysłaną i partiami w prognozie; deale R1 (etap `rejected`, `closure_outcome` NULL) i R2 (etap `rejected`, `closure_outcome = 'lost'`) z kalkulacją i partiami (stan ustawiony w danych testowych); inwestycja I z podpiętymi dealami F, R1, R2 i aktywnym dealem G (wartości różne od zera)
- **Kroki**:
  1. Push n8n: wynik postępowania dla A; unieważnienie dla D
  2. Push n8n: wynik postępowania dla C; unieważnienie dla E
  3. Push n8n: wynik postępowania ze zwycięzcą dla B
  4. Użytkownik w UI OM przestawia etap F z `contact` na `offer`; sprawdź kalkulację, wersje, rolę oferty, harmonogram ofertowy i prognozę
  5. Otwórz prognozę; odczytaj pozycje R1 i R2; użytkownik przestawia F na `rejected` (`closure_outcome` NULL) i ponownie otwiera prognozę
  6. Odczytaj sumę inwestycji I w kosztorysie przed i po przestawieniu F na `rejected` (krok 5)
- **Oczekiwane wyniki**:
  - Krok 1: A → `result_lead`, D → `cancelled`; `closure_outcome` obu bez zmian (NULL); brak przejścia na inny etap (np. `won`, `lost`)
  - Krok 2: etap C i E bez zmian (D34: tylko etap ustawiony przez automat)
  - Krok 3: `winner_*` ustawione (D42); `closure_outcome` bez zmian; etap B `result_lead`
  - Krok 4: kalkulacja, wersje, rola oferty i harmonogram ofertowy bez zmian (logika kosztorysu tylko z `closure_outcome` i `deleted_at`); w prognozie partie F w grupie etapu `offer`, suma prognozy bez zmian
  - Krok 5: R1 i R2 poza prognozą (wykluczenie etapu `rejected` niezależnie od `closure_outcome`); po przestawieniu F na `rejected` jego partie znikają z prognozy; kalkulacja, wersje i rola oferty F bez zmian
  - Krok 6: suma inwestycji I nie zawiera wartości R1 i R2 (niezależnie od `closure_outcome`); po przestawieniu F na `rejected` wartość F wypada z sumy, G zostaje
  - Pozostałe reguły etapu `rejected` (powód, wynik) — TC-DEAL-023 do TC-DEAL-027 (D192)

#### TC-DEAL-019: Status inwestycji — `active`/`archived` w MVP, `merged` od v1

> Decyzje: D187 (z doprecyzowaniem 2026-10-31), D83.

- **Priorytet**: P2 | **Etap**: MVP (`active`, `archived`), v1 (`merged`) | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Inwestycje I-A, I-B; użytkownik U-I z feature `project_costing.manage_investments`, użytkownik U-N bez niego; deal D-N bez inwestycji
- **Kroki**:
  1. Załóż inwestycję I-C; odczytaj `status`
  2. Archiwizacja I-C: U-N; U-I; potem spróbuj edytować I-C (nazwa)
  3. Lista inwestycji bez filtra; potem z filtrem statusu `archived`
  4. Spróbuj podpiąć deal D-N do I-C
  5. Przywrócenie I-C do `active`: U-N; U-I; odczytaj `audit_logs`
  6. MVP: `pg` — spróbuj zapisać w I-C `status = 'merged'` oraz wartość spoza listy; v1: zapis `merged` z `merged_into_id`
  7. v1: scal I-B do I-A (TC-DEAL-009); odczytaj `status` i `merged_into_id` I-B
- **Oczekiwane wyniki**:
  - Krok 1: `status = 'active'` (domyślny)
  - Krok 2: U-N → 403 `FORBIDDEN`, I-C zostaje `active`; U-I → `archived`; edycja odrzucona (tylko odczyt), dane bez zmian
  - Krok 3: bez filtra I-C niewidoczna; z filtrem `archived` I-C na liście
  - Krok 4: 422 `INVESTMENT_ARCHIVED`, D-N bez inwestycji
  - Krok 5: U-N → 403 `FORBIDDEN`, I-C zostaje `archived`; U-I → `active`, wpis w `audit_logs` z autorem U-I
  - Krok 6: MVP — oba zapisy odrzucone przez CHECK (lista wartości fazy: `active`, `archived`), rekord bez zmian; v1 — CHECK przyjmuje `merged`
  - Krok 7: I-B `status = 'merged'`, `merged_into_id` = ID I-A; I-A `active`
  - Kod błędu edycji inwestycji `archived` — bez asercji (wniosek 29); skutki merge dla ofert, projektu i harmonogramu — bez asercji (luka L3, wniosek 30)

#### TC-DEAL-020: Właściciel inwestycji = `created_by`; zapis kluczem API

> Decyzje: D190 (meta, P21 — odesłanie dla macierzy spec-check; treść TC bez zmian).

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Użytkownicy U1 i U2 z prawem zakładania i edycji inwestycji; klucz API K-U należący do U1; klucz API K-0 bez użytkownika; administratorzy organizacji A1 i A2; integracja n8n
- **Kroki**:
  1. U1 zakłada inwestycję I-W w UI; odczytaj ją przez API i `pg`
  2. U2 edytuje I-W (nazwa); odczytaj ponownie
  3. `pg`: lista kolumn `pc_investments`
  4. Załóż inwestycję I-K kluczem K-U; załóż inwestycję I-0 kluczem K-0
  5. Wywołaj dla I-0 zdarzenie, które tworzy szkic albo powiadomienie dla właściciela inwestycji; sprawdź odbiorców
  6. Push n8n postępowania bez pasującej inwestycji
- **Oczekiwane wyniki**:
  - Krok 1: `created_by` = U1
  - Krok 2: `created_by` nadal U1
  - Krok 3: brak osobnej kolumny właściciela; API nie zwraca innego pola właściciela niż `created_by`
  - Krok 4: I-K `created_by` = U1; I-0 `created_by` = NULL
  - Krok 5: szkic albo powiadomienie trafia do administratorów organizacji (A1, A2)
  - Krok 6: n8n nie zakłada inwestycji (D63); liczba rekordów `pc_investments` bez zmian
  - Rodzaje szkiców i powiadomień inwestycji (reguła z `crm_followups`, PR #33, poza rejestrem) oraz właściciel deala z n8n (Q-ARCH-2) — bez asercji (wniosek 31)

#### TC-DEAL-021: Klucz push części postępowania `ezamowienia:<tender_id>#<nr części>`

> Decyzje: D189 (meta, P21 — odesłanie dla macierzy spec-check; treść TC bez zmian).

- **Priorytet**: P0 | **Etap**: etap kodu kontraktu push (D32; zadanie Enki), test razem z kontraktem push | **Poziom**: Integration (kontrakt n8n) + `pg`
- **Warunki wstępne**: Postępowanie z `tender_id` = TP i częściami 1, 2 (jak TC-DEAL-017); postępowanie T-S bez części z dealem i kluczem push sprzed zmiany kontraktu; lista kluczy wszystkich istniejących deali zapisana przed wdrożeniem
- **Kroki**:
  1. Push n8n dla części 1 i części 2 postępowania TP
  2. Ponowny push części 1 ze zmianą treści; potem drugi raz z tym samym payloadem
  3. Push n8n dla T-S
  4. `pg`: klucze idempotencji push (`om_sync`, D32) po wdrożeniu
- **Oczekiwane wyniki**:
  - Krok 1: dwa deale z kluczami `ezamowienia:TP#1` i `ezamowienia:TP#2`
  - Krok 2: zaktualizowany tylko deal części 1; deal części 2 nietknięty; identyczny payload niczego nie zmienia (hash, D32)
  - Krok 3: klucz T-S = `ezamowienia:<tender_id T-S>` (format bez części przyjęty w D189, do potwierdzenia przez Enkę przy kodzie), taki sam jak przed wdrożeniem; deal T-S zaktualizowany, nie powstaje nowy
  - Krok 4: klucze istniejących deali bez części identyczne z listą sprzed wdrożenia (bez migracji)
  - Powiązane kroki etapu kodu: TC-DEAL-016 krok 7, TC-PD-PRJ-011 krok 3, TC-PD-PRJ-012 krok 5

#### TC-DEAL-022: Domyślny opiekun deala tworzonego przez push n8n

> Decyzje: D193 (z doprecyzowaniem 2026-10-31: 422 `INVALID_SETTING_VALUE`, klucze z `crm.n8n_api_key_ids`), D69, D179.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API (kontrakt n8n) + `pg`
- **Warunki wstępne**: Organizacja O1; użytkownicy: U1 aktywny w O1, U2 nieaktywny w O1, U3 aktywny w innej organizacji, U4 aktywny w O1 (opiekun podawany jawnie w pushu i przy ręcznej zmianie, nie z ustawienia); klucz API integracji n8n (ID na liście `crm.n8n_api_key_ids` O1); klucz API innej integracji (spoza listy); deal D-OLD z n8n utworzony przed zmianą ustawienia, bez opiekuna
- **Kroki**:
  1. Odczytaj `crm.n8n_default_deal_owner_user_id` (`org:{id}:settings`); push n8n tworzy deal DN1
  2. Zapisz ustawienie: U2; U3; U1
  3. Push n8n tworzy deal DN2; push n8n tworzy deal DN3 z jawnym opiekunem U4; kluczem innej integracji utwórz deal DN4; użytkownik tworzy ręcznie deal DN5
  4. Kolejny push n8n aktualizuje DN2; użytkownik zmienia opiekuna DN2 na U4, potem kolejny push aktualizuje DN2; odczytaj D-OLD
  5. U1 dezaktywowany po zapisie ustawienia; push n8n tworzy deal DN6; odczytaj log importu
- **Oczekiwane wyniki**:
  - Krok 1: wartość domyślna `null`; DN1 bez opiekuna, a szkice follow-upów DN1 trafiają do administratorów (plan `crm_followups`, TC-FU-ACL-001)
  - Krok 2: U2 i U3 → 422 `INVALID_SETTING_VALUE`, ustawienie bez zmian; U1 zapisany
  - Krok 3: DN2 `owner_user_id` = U1; DN3 zostaje z U4 (push z jawnym opiekunem nie jest zmieniany); DN4 i DN5 bez opiekuna z ustawienia (rozpoznanie klucza — TC-DEAL-034)
  - Krok 4: opiekun DN2 bez zmian po pushu (U1, potem U4 — pushe nie zmieniają opiekuna); D-OLD bez opiekuna (bez wstecznego przypisania)
  - Krok 5: DN6 bez opiekuna; ostrzeżenie w logu importu z wyłącznie ID deala i użytkownika
  - Bez automatycznych reguł przydziału

#### TC-DEAL-023: Przejście deala na `rejected` — powód wymagany, wynik z mapowania

> Decyzje: D192, D41, D45, D42, D185.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API (`customers.deals.create`, `customers.deals.update`) + `pg`
- **Warunki wstępne**: Lejek „Przetargi” (D33); seed D192 wykonany (TC-DEAL-026); powody: PL `price_too_high` (mapowanie `lost`), PZ „Odrzucona przez zamawiającego” (`lost`), PN `not_bid` (`no_result`), PR „Nasza rezygnacja” (`no_result`); wpis PX dodany do `sales.deal_loss_reason` po seedzie, bez wiersza w tabeli mapującej; deale otwarte DR1–DR6 na etapie `offer`, `closure_outcome` NULL
- **Kroki**:
  1. `customers.deals.update`: DR1 na `rejected` bez `loss_reason_id`; utwórz deal od razu na `rejected` bez `loss_reason_id`
  2. DR2 na `rejected` z PL; DR3 na `rejected` z PZ
  3. DR4 na `rejected` z PN; DR5 na `rejected` z PR
  4. DR6 na `rejected` z PX; utwórz deal na `rejected` z PZ
  5. `customers.deals.update`: deal DR7 (otwarty) na `rejected` z PN i jawnym `closureOutcome = lost`
  6. Deal DR8 na `offer` → `contact` z `loss_reason_id` = PL (bez przejścia na `rejected`)
  7. Push n8n (aktualizacja postępowania) dla DR2 i DR4; `pg`: wartości `closure_outcome` wszystkich deali testu
- **Oczekiwane wyniki**:
  - Krok 1: oba żądania → 422 `REASON_REQUIRED`; DR1 zostaje na `offer`; deal nie powstaje
  - Krok 2: DR2 i DR3 na `rejected`, `closureOutcome = lost` (powody `lost`)
  - Krok 3: DR4 i DR5 na `rejected`, `closure_outcome` NULL (powody `no_result`)
  - Krok 4: DR6 na `rejected`, `closure_outcome` NULL (wpis bez mapowania → domyślnie `no_result`); nowy deal na `rejected` z `closureOutcome = lost`
  - Krok 5: 422 `INVALID_LOSS_REASON`; DR7 bez zmian
  - Krok 6: `closure_outcome` DR8 bez zmian (NULL) — mapowanie działa tylko na etapie `rejected` (przejście albo zmiana powodu, TC-DEAL-031)
  - Krok 7: push nie zmienia etapu, `closure_outcome` ani powodu DR2 i DR4 (D42, D185); w `closure_outcome` tylko NULL, `won`, `lost` — enum bez nowej wartości (D45); każdy deal z `closure_outcome = lost` ma powód zmapowany na `lost`
  - Deale DR2–DR6 na `rejected` poza prognozą — TC-DEAL-018, TC-FCST-007

#### TC-DEAL-024: „Oznacz jako przegrany” — zawsze `lost`, tylko powody `lost` (API)

> Decyzje: D192, D41.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API (`customers.deals.update`, ścieżka „Oznacz jako przegrany”) + `pg`
- **Warunki wstępne**: Seed D192 wykonany; powody PL, PZ, PN, PR, PX jak w TC-DEAL-023; deale otwarte DL1–DL4 na etapie `offer`
- **Kroki**:
  1. Ścieżka „Oznacz jako przegrany” dla DL1 z PL i dla DL2 z PZ
  2. Ta sama ścieżka dla DL3 z PN, z PR i z PX
  3. Ta sama ścieżka dla DL4 bez powodu
  4. `pg`: `closure_outcome`, `loss_reason_id` i etap DL1–DL4
- **Oczekiwane wyniki**:
  - Krok 1: DL1 i DL2 → `closureOutcome = lost` z podanym powodem; mapowanie etapu `rejected` nie bierze udziału (etap nie przechodzi na `rejected` z powodu tej ścieżki)
  - Krok 2: każde żądanie → 422 `INVALID_LOSS_REASON` (`no_result` i wpis bez mapowania); DL3 bez zmian, `closure_outcome` NULL
  - Krok 3: 422 `REASON_REQUIRED` (doprecyzowanie D192 2026-10-31) — TC-DEAL-028
  - Krok 4: `closure_outcome = lost` występuje tylko z powodem typu `lost`
  - Okno UI z listą tylko powodów `lost` — TC-DEAL-027 (etap kodu)

#### TC-DEAL-025: Zmiana etapu na `rejected` z widoku lejka i masowo — ten sam interceptor

> Decyzje: D192 (z doprecyzowaniem 2026-10-31: ścieżka masowa bez `lossReasonId`), D45.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API (worker masowej zmiany etapu → `customers.deals.update`) + E2E (widok lejka)
- **Warunki wstępne**: Seed D192 wykonany; deale otwarte DB1–DB3 na etapie `offer`, deal DB4 na `contact`
- **Kroki**:
  1. W widoku lejka przeciągnij DB1 na `rejected` bez powodu
  2. Masowa zmiana etapu DB2, DB3 i DB4 na `rejected` bez powodu
  3. Odczytaj payload i podsumowanie joba masowej zmiany z kroku 2
  4. `pg`: etapy i `closure_outcome` DB1–DB4
- **Oczekiwane wyniki**:
  - Krok 1: kanban otwiera okno powodu modułu (TC-DEAL-027); żądanie zmiany etapu bez powodu wysłane bezpośrednio → 422 `REASON_REQUIRED`; DB1 zostaje na `offer`
  - Krok 2: żaden z deali nie przechodzi na `rejected` bez powodu (worker wywołuje `customers.deals.update`, ten sam interceptor)
  - Krok 3: payload joba niesie tylko `pipelineStageId` (bez `lossReasonId`), więc ścieżka masowa nie ustawi `rejected`; `failedItems` per deal — TC-DEAL-029; przejście na `rejected` z powodem — pojedynczo (TC-DEAL-023) albo trasą masową modułu (TC-DEAL-033)
  - Bez zmian w `packages/core` — TC-DEAL-027

#### TC-DEAL-026: Seed powodów i mapowania `outcome` — bez duplikatów

> Decyzje: D192 (z doprecyzowaniem 2026-10-31: moduł `crm_deal_rules`, `value` nowych wpisów), D41.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` (migracja/seed)
- **Warunki wstępne**: Organizacja O1 ze słownikiem `sales.deal_loss_reason` zawierającym 9 powodów D41 (`ids.json` → `lossReasons`), bez seedu D192
- **Kroki**:
  1. Uruchom seed D192 dla O1
  2. `pg`: wpisy `sales.deal_loss_reason` O1; wiersze tabeli mapującej `cdr_loss_reason_outcomes` (moduł `crm_deal_rules`) O1 (`dictionary_entry_id`, `outcome`)
  3. Uruchom seed ponownie; powtórz krok 2
  4. `pg`: dodaj drugi wiersz mapowania dla tego samego `(organization_id, dictionary_entry_id)`; dodaj wiersz z `outcome` spoza `lost` | `no_result`
- **Oczekiwane wyniki**:
  - Krok 2: słownik ma 12 wpisów; dodane dokładnie `rejected_by_buyer` („Odrzucona przez zamawiającego”), `our_withdrawal` („Nasza rezygnacja”), `other` („Inne”); brak wpisu „nie składamy oferty” (duplikat `not_bid`)
  - Krok 2: mapowanie jawne dla wszystkich 12 wpisów; `lost`: `price_too_high`, `delivery_time`, `no_capacity`, `technical_requirements`, `lost_to_competitor`, `investment_cancelled`, `no_decision`, `payment_terms` i `rejected_by_buyer` (razem 9); `no_result`: `not_bid`, `our_withdrawal`, `other` (razem 3) — 12 jawnych mapowań
  - Krok 3: seed idempotentny — bez nowych wpisów słownika i bez duplikatów mapowania (12 i 12)
  - Krok 4: oba zapisy odrzucone przez bazę (unikalność per organizacja; `outcome` tylko `lost` | `no_result`)
  - Tabela w module `crm_deal_rules` z prefiksem `cdr_`

#### TC-DEAL-027: Okno powodu modułu `crm_deal_rules` w UI — formularz, szczegóły, kanban, okno masowe; „Oznacz jako przegrany”

> Decyzje: D192 (z doprecyzowaniami 2026-10-31, Q-LR-5, Q-LR-8), D45.

- **Priorytet**: P0 | **Etap**: MVP (samo API nie wystarcza — D192) | **Poziom**: E2E (UI OM) + przegląd kodu
- **Warunki wstępne**: Seed D192 wykonany; deale otwarte DU1–DU6 na etapie `offer`; powody `rejected_by_buyer` (`lost`), `our_withdrawal` (`no_result`)
- **Kroki**:
  1. Formularz deala DU1: zmień etap na `rejected`, zapisz
  2. Strona szczegółów DU2: zmień etap na `rejected`
  3. Kanban: przeciągnij DU3 na `rejected`
  4. Okno masowe: zaznacz DU4 i DU5, zmień etap na `rejected`
  5. W oknie z kroku 1 anuluj; potem otwórz ponownie i wybierz `our_withdrawal`
  6. „Oznacz jako przegrany” dla DU6 z powodem `our_withdrawal`
  7. Przegląd zmian forka: `packages/core`
- **Oczekiwane wyniki**:
  - Krok 1, 3, 4: otwiera się okno powodu modułu `crm_deal_rules` przed zapisem (kanban — dla pojedynczego deala)
  - Krok 2: okno powodu modułu (D192 (9), doprecyzowanie 2026-10-31)
  - Krok 4: zapis trasą masową modułu `POST /api/crm-deal-rules/deals/bulk-reject` z wybranym powodem; trasa kolejkuje job postępu modułu; `failedItems` (`id`, `message`) w podsumowaniu joba, nie w odpowiedzi trasy (D192 (12), doprecyzowanie 2026-10-31)
  - Krok 5: anulowanie = brak zapisu, DU1 zostaje na `offer` (D192 (10), doprecyzowanie 2026-10-31); po wyborze DU1 na `rejected`, `closure_outcome` NULL
  - Krok 6: zapis z powodem spoza `lost` przechwycony; okno modułu z wyłącznie 9 powodami `lost`; po wyborze DU6 `closureOutcome = lost`; API odrzuca taki zapis bez okna (422 `INVALID_LOSS_REASON`, TC-DEAL-024). Lista w oknie core zostaje pełna (D192, Q-LR-8 — bez wyjątku od D45)
  - Krok 7: brak zmian w `packages/core` (D45)

#### TC-DEAL-028: „Oznacz jako przegrany” i `status = lost` bez powodu → 422 `REASON_REQUIRED`

> Decyzje: D192 (doprecyzowanie 2026-10-31), D41.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API (`customers.deals.update`) + `pg`
- **Warunki wstępne**: Seed D192 wykonany; powody PL `price_too_high` (`lost`) i PN `not_bid` (`no_result`); deale otwarte DQ1–DQ5 na etapie `offer`, `closure_outcome` NULL
- **Kroki**:
  1. Ścieżka „Oznacz jako przegrany” dla DQ1 bez `lossReasonId`
  2. `customers.deals.update` dla DQ2: `status = lost` bez `lossReasonId` i bez `closureOutcome` (wynik wyprowadzany ze statusu)
  3. `customers.deals.update` dla DQ3: `closureOutcome = lost` bez `lossReasonId`
  4. `customers.deals.update` dla DQ4: `status = lost` z PN
  5. `customers.deals.update` dla DQ5: `status = lost` z PL
- **Oczekiwane wyniki**:
  - Krok 1–3: każde → 422 `REASON_REQUIRED` (ten sam kod co przy `rejected`); DQ1–DQ3 bez zmian, `closure_outcome` NULL
  - Krok 4: 422 `INVALID_LOSS_REASON`; DQ4 bez zmian
  - Krok 5: DQ5 `closureOutcome = lost` z powodem PL

#### TC-DEAL-029: Masowa zmiana etapu na `rejected` — 422 `REASON_REQUIRED` per deal w `failedItems`, reszta przetwarzana

> Decyzje: D192 (doprecyzowanie 2026-10-31), D45.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration (worker masowej zmiany etapu, job postępu) + `pg`
- **Warunki wstępne**: Seed D192 wykonany; deale otwarte DM1, DM2, DM3 na etapie `offer`
- **Kroki**:
  1. Masowa zmiana etapu DM1, DM2, DM3 na `rejected`; poczekaj na zakończenie joba
  2. Odczytaj podsumowanie joba postępu (`failedItems`) i etapy deali
  3. Masowa zmiana etapu DM1, DM2, DM3 na `contact` (kontrola)
- **Oczekiwane wyniki**:
  - Krok 2: `failedItems` zawiera wpis dla każdego z DM1, DM2, DM3 (`id` deala, `message` z 422 `REASON_REQUIRED`); job nie przerywa się na pierwszym błędzie — przetworzone wszystkie pozycje; etapy i `closure_outcome` bez zmian
  - Krok 3: wszystkie trzy deale na `contact`, `failedItems` pusty (interceptor blokuje tylko przejście na `rejected` bez powodu)

#### TC-DEAL-030: Oferta `primary` deala na `rejected` — historia; widget i suma inwestycji ze statusem „odrzucony”

> Decyzje: D185 (doprecyzowanie 2026-10-31, Q-LR-3), D192.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E (widget inwestycji)
- **Warunki wstępne**: Inwestycja IR z dealami DP (oferta `primary`) i DA (oferta `alternative`), oba otwarte, wartości różne od zera
- **Kroki**:
  1. DP na `rejected` z powodem `rejected_by_buyer`
  2. Odczytaj rolę oferty DP, widget inwestycji IR i sumę inwestycji IR
  3. `pg`: wiersze `pc_deal_offer_roles` IR; odczytaj tabelę ofert inwestycji IR w kosztorysie
- **Oczekiwane wyniki**:
  - Oferta DP zachowuje rolę `primary` (historia); rola DA bez zmian
  - Krok 3: wiersz `primary` DP w `pc_deal_offer_roles` bez zmian (brak usunięcia i zmiany roli); tabela ofert inwestycji pokazuje DP ze statusem „odrzucony”, suma bez DP
  - Widget IR pokazuje DP ze statusem „odrzucony”; suma inwestycji IR bez wartości DP (DA zostaje)
  - DP poza prognozą (TC-DEAL-018)

#### TC-DEAL-031: Zmiana powodu na `rejected` przelicza wynik; wyjście z `rejected` czyści wynik i powód

> Decyzje: D192 (doprecyzowanie 2026-10-31, Q-LR-4), D191 (wyjątek wyjścia z `rejected`), D45.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg` (audyt)
- **Warunki wstępne**: Seed D192 wykonany; deal DW1 na `rejected` z `rejected_by_buyer` (`closureOutcome = lost`) i z `loss_notes`; deal DW2 na `rejected` z `our_withdrawal` (`closure_outcome` NULL)
- **Kroki**:
  1. DW1: zmień powód na `our_withdrawal` (etap bez zmian)
  2. DW2: zmień powód na `price_too_high`
  3. DW1: zmień tylko etap na `offer`
  4. Odczytaj DW1 i audyt zmiany z kroku 3; `pg`: deale z `closure_outcome = lost` i typem ich powodu
- **Oczekiwane wyniki**:
  - Krok 1: DW1 `closure_outcome` NULL
  - Krok 2: DW2 `closureOutcome = lost`
  - Krok 3–4: DW1 `closure_outcome` NULL i `loss_reason_id` NULL; poprzednie wartości w audycie; `loss_notes` zostają (D192 (14), doprecyzowanie 2026-10-31)
  - Krok 4: każdy deal z `closure_outcome = lost` ma powód typu `lost`

#### TC-DEAL-032: Powód spoza aktywnych wpisów słownika → 422 `INVALID_LOSS_REASON`

> Decyzje: D192 (doprecyzowanie 2026-10-31, Q-LR-7).

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Integration
- **Warunki wstępne**: Seed D192 wykonany; wpisy: PI (nieaktywny wpis `sales.deal_loss_reason` O1), PO (wpis innej organizacji), identyfikator nieistniejący; deale otwarte DI1–DI3 na `offer`
- **Kroki**:
  1. DI1 na `rejected` z PI; z PO; z nieistniejącym ID
  2. „Oznacz jako przegrany” DI2 z tymi samymi trzema ID
  3. Trasa masowa modułu (`POST /api/crm-deal-rules/deals/bulk-reject`) dla DI3 z PI
- **Oczekiwane wyniki**:
  - Krok 1–2: każde → 422 `INVALID_LOSS_REASON`; deale bez zmian
  - Krok 3: całe żądanie → 422 `INVALID_LOSS_REASON` na poziomie trasy (sprawdzenie aktywności powodu przed zakolejkowaniem, D192 (12)); job postępu nie powstaje, brak `failedItems`; DI3 bez zmian

#### TC-DEAL-033: API modułu `crm_deal_rules` — trasa masowa, nagłówek powodu, lista powodów

> Decyzje: D192 (doprecyzowanie 2026-10-31, Q-LR-5); reguły trasy, nagłówka i listy — D192 (doprecyzowanie 2026-10-31, reguły realizacji (11)–(13)).

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + Integration
- **Warunki wstępne**: Seed D192 wykonany; deale otwarte DK1–DK4 na `offer`
- **Kroki**:
  1. `POST /api/crm-deal-rules/deals/bulk-reject` dla DK1 i DK2 z `rejected_by_buyer`
  2. `PUT /api/customers/deals` dla DK3 na `rejected`: nagłówek `x-cdr-loss-reason-id` = `our_withdrawal`, body `lossReasonId` = `rejected_by_buyer` (przez trasę API — samo wywołanie komendy nie ma nagłówków)
  3. Bezpośrednio core `bulk-update-stage` DK4 na `rejected`
  4. `GET /api/crm-deal-rules/loss-reasons?mode=rejected`; `?mode=lost`
- **Oczekiwane wyniki**:
  - Krok 1: trasa kolejkuje job postępu modułu; po zakończeniu joba DK1, DK2 na `rejected`, `closureOutcome = lost`; podsumowanie joba z pustym `failedItems` (błędy pozycji tylko tam, nie w odpowiedzi trasy)
  - Krok 2: interceptor API modułu (`before`, `PUT`/`POST` `customers/deals`) przepisuje nagłówek do `body.lossReasonId`; nagłówek wygrywa — powód `our_withdrawal`, `closure_outcome` NULL
  - Krok 3: 422 `REASON_REQUIRED` dla deala w `failedItems` (jak TC-DEAL-029)
  - Krok 4: `mode=lost` — wyłącznie 9 powodów `lost`; `mode=rejected` — aktywne wpisy słownika (jeden słownik dla `rejected`, D192: 12 po seedzie)

#### TC-DEAL-034: Deal „z n8n” tylko z klucza z `crm.n8n_api_key_ids`; ustawienia `crm_deal_rules`

> Decyzje: D193 (doprecyzowanie 2026-10-31, Q-LR-1, Q-LR-2), D69, D179.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + Integration + `pg`
- **Warunki wstępne**: O1 z `crm.n8n_default_deal_owner_user_id` = U1; klucze API: KN1 (ID na liście `crm.n8n_api_key_ids`), KN2 o nazwie zawierającej „n8n”, spoza listy, KN3 z tymi samymi feature'ami co KN1, spoza listy; użytkownik UA z `crm_deal_rules.settings.manage`, użytkownik UB bez niego
- **Kroki**:
  1. KN1, KN2, KN3 tworzą po jednym dealu
  2. UA dodaje KN2 do `crm.n8n_api_key_ids`; KN2 tworzy deal
  3. UB zmienia `crm.n8n_default_deal_owner_user_id` i `crm.n8n_api_key_ids`
- **Oczekiwane wyniki**:
  - Krok 1: tylko deal KN1 z opiekunem U1; deale KN2 i KN3 bez opiekuna z ustawienia (bez rozpoznania po nazwie i po feature)
  - Krok 2: nowy deal KN2 z opiekunem U1
  - Krok 3: `403 FORBIDDEN`, ustawienia bez zmian (feature `crm_deal_rules.settings.manage` — D193, doprecyzowanie 2026-10-31, reguła realizacji)
  - Walidacja listy `crm.n8n_api_key_ids` — TC-DEAL-035

#### TC-DEAL-035: Walidacja `crm.n8n_api_key_ids` — tylko UUID istniejących, nieodwołanych kluczy organizacji

> Decyzje: D193 (doprecyzowanie 2026-10-31, Q-LR-9), D69.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + Integration + `pg`
- **Warunki wstępne**: O1 z `crm.n8n_api_key_ids` = [KV1]; `crm.n8n_default_deal_owner_user_id` = U1; użytkownik UA z `crm_deal_rules.settings.manage`; klucze: KV1, KV2 (aktywne, O1), KR (odwołany, O1), KO (aktywny, inna organizacja); wartość `abc` (nie UUID); losowy UUID bez klucza
- **Kroki**:
  1. UA zapisuje listę: [KV1, `abc`]; [KV1, losowy UUID]; [KV1, KR]; [KV1, KO]
  2. Odczytaj ustawienie
  3. UA zapisuje [KV1, KV2]
  4. Odwołaj KV2; KV2 próbuje utworzyć deal; odczytaj ustawienie
  5. KV1 tworzy deal
- **Oczekiwane wyniki**:
  - Krok 1: każdy zapis → 422 `INVALID_SETTING_VALUE`
  - Krok 2: ustawienie bez zmian ([KV1])
  - Krok 3: zapis przyjęty
  - Krok 4: deal nie powstaje (klucz odwołany); ustawienie nadal [KV1, KV2] — bez czyszczenia
  - Krok 5: deal z opiekunem U1

---

## 6. Scenariusze testowe: Wersje i Oferta — 12 TC

Numeracja wersji, statusy, zamrożenie, PDF, porównanie wersji, wysłanie (blokady i ostrzeżenia), „Zastosuj wartość do deala”, aktywna kalkulacja, audyt.

#### TC-VER-001: Wersje — numeracja (numer bazowy + rewizja)

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Utwórz kalkulację, jest wersja 1.0
  2. Duplikuj jako nową wersję → 1.1
  3. Duplikuj znowu → 1.2
  4. Zmień numer bazowy na 2 → 2.0
- **Oczekiwane wyniki**:
  - Numeracja: 1.0, 1.1, 1.2, 2.0, 2.1 (jeśli duplikuj po 2.0)
  - Widoczna historia wersji

#### TC-VER-002: Statusy wersji — robocza → wysłana → zastąpiona / zaakceptowana / odrzucona

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Kroki**:
  1. Wersja 1.0: status "Robocza" (edytowalna)
  2. Kliknij "Wyślij" → status "Wysłana", zamrożona
  3. Utwórz wersję 2.0, wyślij → 1.0 zmienia się na "Zastąpiona"
  4. Na wersji 2.0: przycisk "Zaakceptuj" / "Odrzuć"
  5. Kliknij "Zaakceptuj" → status "Zaakceptowana"
- **Oczekiwane wyniki**:
  - Transition: Robocza → Wysłana → (Zaakceptowana | Odrzucona | Zastąpiona)
  - Logika: Robocza = edytowalna, Wysłana+ = nieedytowalna
  - Krok 3 przez „Nową rewizję” jest dostępny od v1 (TC-VER-004); w MVP sprawdzamy kroki 1, 2, 4, 5

#### TC-VER-003: Po wysłaniu — wersja zamrożona, niewidoczne zmiany

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Kroki**:
  1. Wersja 1.0, wysłana, cena = 100k
  2. Spróbuj zmienić cenę lub pozycje (UI i API)
  3. Zapisz
- **Oczekiwane wyniki**:
  - UI: pola tylko do odczytu; API: 409 lub 422 „Wersja wysłana — edycja niemożliwa”
  - Od v1 komunikat proponuje akcję „Nowa rewizja” (TC-VER-004)
  - PDF generowany w momencie wysłania (zamrożony obraz)

#### TC-VER-004: „Nowa rewizja” — jedna akcja (odblokowanie i kopia)

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Warunki wstępne**: Wysłana wersja 1.0; admin (ma `project_costing.new_revision`) i employee (domyślnie bez)
- **Kroki**:
  1. Jako employee: sprawdź przycisk „Nowa rewizja”, wywołaj akcję przez API
  2. Jako admin: kliknij „Nowa rewizja”, podaj powód „Zmiana zakresu po negocjacjach”
  3. Sprawdź listę wersji i wpis audytu
  4. Spróbuj osobnej akcji „Odblokuj” (UI i API)
- **Oczekiwane wyniki**:
  - Employee: brak przycisku, API `403 FORBIDDEN`
  - Admin: jedna akcja tworzy wersję 1.1 jako roboczą kopię 1.0; 1.0 pozostaje zamrożona (status „Zastąpiona”); brak pośredniego stanu „odblokowana”
  - Nie istnieje osobna akcja „Odblokuj” — ani w UI, ani w API
  - Powód zapisany w metadanych akcji we wpisie audytu (kto, kiedy, powód); wpis nie zawiera wartości kosztu ani marży
  - Zamrożony obraz i PDF wersji 1.0 bez zmian

#### TC-VER-005: Porównanie dwóch wersji

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Wersja 1.0 (cena 100k) vs Wersja 1.1 (cena 110k)
  2. Kliknij "Porównaj" na wersji 1.1
  3. Wybierz 1.0
- **Oczekiwane wyniki**:
  - Widok side-by-side
  - Zmiany wyróżnione: pozycja dodana/usunięta/zmieniona (różnica w cenie/ilości)
  - Suma różnicy: +10k

#### TC-VER-006: PDF oferty — zamrożony obraz, dane firmy z ustawień modułu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + Integration
- **Warunki wstępne**: Ustawienia modułu organizacji A: nazwa „Prefabet Sp. z o.o.”, logo, adres, NIP; wersja 1.0 gotowa do wysłania
- **Kroki**:
  1. Wyślij wersję 1.0
  2. Opróżnij kolejkę (`drainIntegrationQueue`), pobierz PDF
  3. Zmień w ustawieniach modułu nazwę firmy na „Prefabet S.A.”
  4. (od v1) Nowa rewizja 1.1 zmienia cenę
  5. Pobierz ponownie PDF wersji 1.0
- **Oczekiwane wyniki**:
  - PDF generowany w tle (zadanie w kolejce); żądanie wysłania nie czeka na PDF
  - Dane firmy w PDF (nazwa, logo, adres, NIP) pochodzą z ustawień modułu organizacji
  - PDF wersji 1.0 po krokach 3–4: stara cena i stare dane firmy (zamrożony obraz z momentu wysłania), brak przeliczeń
  - PDF nie zawiera kosztów ani marży (TC-PERM-007)
  - „Profil firmy” nie jest źródłem danych PDF i nie jest testowany

#### TC-VER-007: „Zastosuj wartość do deala” — jawny przycisk, tylko z aktywnej wersji

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + E2E/UI
- **Warunki wstępne**: Deal X o wartości 100 000.00 PLN; kalkulacje K1 (aktywna, cena oferty 125 000.00) i K2 (nieaktywna, 130 000.00); admin (ma `project_costing.apply_to_deal`) i employee (domyślnie bez)
- **Kroki**:
  1. Zapisz zmiany w K1, sprawdź wartość deala
  2. Jako admin na K1 kliknij „Zastosuj wartość do deala”
  3. Otwórz K2: sprawdź przycisk; wywołaj akcję dla K2 przez API
  4. Jako employee: przycisk i API na K1
  5. Cofnij zmianę wartości deala
- **Oczekiwane wyniki**:
  - Krok 1: wartość deala bez zmian (brak automatycznej synchronizacji)
  - Krok 2: wartość deala = 125 000.00, zmieniona standardowym mechanizmem CRM; zmiana widoczna w historii deala (stara → nowa)
  - Krok 3: przycisk nieaktywny; API odrzuca żądanie (422, wersja nieaktywna); wartość deala bez zmian
  - Krok 4: brak przycisku, API `403 FORBIDDEN`
  - Krok 5: wartość wraca do 100 000.00; historia deala odnotowuje cofnięcie

#### TC-VER-008: Wysłanie — macierz blokad i ostrzeżeń

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit (reguły) + Integration + API + E2E/UI
- **Warunki wstępne**: Admin (ma `project_costing.lock` i `project_costing.view_margin`); osobna wersja robocza dla każdego wiersza macierzy
- **Kroki**:
  1. Dla każdego wiersza: wyślij wersję
  2. Gdy odpowiedź zawiera ostrzeżenia: ponów wysłanie z potwierdzeniem ostrzeżeń
- **Macierz**:

  | # | Stan wersji | Pierwsze żądanie | Ponowienie z potwierdzeniem |
  |---|---|---|---|
  | 1 | Nierozwiązane błędy importu | blokada: 422, kod blokady, komunikat „błędy importu” | nadal blokada |
  | 2 | Brak pozycji (tylko sekcje lub notatki) | blokada: 422, kod blokady, komunikat „brak pozycji” | nadal blokada |
  | 3 | Pozycja z ujemną ceną | blokada: 422, kod blokady, komunikat „ujemna cena” ze wskazaniem pozycji | nadal blokada |
  | 4 | Ujemna marża całości | ostrzeżenie: 422, kod „wymaga potwierdzenia”, lista ostrzeżeń: ujemna marża | wysłana |
  | 5 | Pusta sekcja | ostrzeżenie: pusta sekcja (ze wskazaniem sekcji) | wysłana |
  | 6 | Pozycja z ceną 0 | ostrzeżenie: cena zero (ze wskazaniem pozycji) | wysłana |
  | 7 | Ujemna marża + pusta sekcja + cena 0 | jedno żądanie zwraca wszystkie trzy ostrzeżenia | wysłana po jednym potwierdzeniu wszystkich |
  | 8 | Błąd importu + pusta sekcja | blokada (blokada ma pierwszeństwo przed ostrzeżeniami) | nadal blokada |
  | 9 | Kalkulacja bez deala, bez problemów | wysłana od razu — brak deala nie blokuje i nie ostrzega | — |
  | 10 | Poprawna wersja na dealu | wysłana od razu | — |

- **Oczekiwane wyniki**:
  - Każda blokada ma własny kod błędu i komunikat (locale `pl`, klucz i18n z `en`); nazwy kodów wg speki
  - Każde ostrzeżenie wymaga ponowienia z potwierdzeniem; bez potwierdzenia stan wersji się nie zmienia
  - Po blokadzie lub niepotwierdzonym ostrzeżeniu: status „Robocza”, brak zamrożonego obrazu, brak zadania PDF
  - Po wysłaniu: zamrożony obraz i zadanie PDF w kolejce

#### TC-VER-009: Ujemna marża — wysłanie przez użytkownika bez wglądu w marżę

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + E2E/UI
- **Warunki wstępne**: Wersja z ujemną marżą całości (koszt 1 200.00, cena 1 000.00); employee (domyślnie z `project_costing.lock`, bez `project_costing.view_margin` i `project_costing.view_costs`); admin; druga wersja z dodatnią marżą
- **Kroki**:
  1. Jako employee: kliknij „Wyślij”
  2. Jako employee: wywołaj wysłanie przez API, także z potwierdzeniem ostrzeżeń
  3. Sprawdź treść komunikatu, body odpowiedzi API oraz wpisy audytu i historii akcji widoczne dla employee
  4. Jako admin: wyślij tę samą wersję, potwierdź ostrzeżenie o ujemnej marży
  5. Jako employee: wyślij wersję z dodatnią marżą
  6. Jako employee: edytuj wersję z ujemną marżą i obserwuj siatkę i podgląd
- **Oczekiwane wyniki**:
  - Kroki 1–2: wysłanie zablokowane z komunikatem dokładnie „Oferta wymaga zatwierdzenia przez administratora”; potwierdzenie ostrzeżeń nie odblokowuje; wersja zostaje „Robocza”
  - Krok 3: ani komunikat, ani odpowiedź API, ani wpisy widoczne dla employee nie ujawniają wartości ani znaku marży (brak słowa „ujemna”, brak liczb marży i kosztu, brak pola marży) — asercja bezwarunkowa
  - Krok 4: admin dostaje standardowe ostrzeżenie o ujemnej marży; po potwierdzeniu wersja wysłana
  - Krok 5: wysłanie bez żadnego komunikatu
  - Krok 6: siatka i podgląd nie dają żadnego sygnału ujemnej marży (kolor, ikona, podpowiedź, pole)

#### TC-VER-010: Pierwsza kalkulacja na dealu od razu aktywna; aktywacja kolejnej

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Kroki**:
  1. Na dealu bez kalkulacji utwórz K1
  2. Utwórz drugą kalkulację K2 na tym samym dealu
  3. Aktywuj K2
  4. Sprawdź wpis audytu i wartość deala
- **Oczekiwane wyniki**:
  - K1 aktywna od razu po utworzeniu
  - K2 nieaktywna, dopóki użytkownik jej nie aktywuje
  - Po aktywacji: K2 aktywna, K1 nieaktywna — dokładnie jedna aktywna kalkulacja na deal (asercja przez `pg`)
  - Aktywacja audytowana (kto, kiedy, poprzednia → nowa aktywna)
  - Wartość deala bez zmian — zmienia ją tylko przycisk z TC-VER-007

#### TC-VER-011: Lista pól audytu — pola wrażliwe bez wartości

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration (`audit_logs` przez API i `pg`)
- **Kroki**:
  1. Na wersji roboczej zmień kolejno: koszt jednostkowy, narzut cenowy, narzut kosztowy, docelową marżę, cenę sprzedaży, ilość, jednostkę, etykietę, tryb ceny, status wersji, rolę oferty
  2. Po każdej zmianie odczytaj wpis audytu jako admin
  3. Wyślij wersję; jako employee otwórz jej zamrożony obraz
- **Oczekiwane wyniki**:

  | Pole | Zawartość wpisu audytu |
  |---|---|
  | koszt jednostkowy, narzut cenowy, narzut kosztowy, docelowa marża | tylko nazwa zmienionego pola, kto, kiedy — bez starej i nowej wartości, także dla admina |
  | cena sprzedaży, ilość, jednostka, etykieta, tryb ceny, status wersji, rola oferty | nazwa pola, stara i nowa wartość, kto, kiedy |

  - Historia kwot pól wrażliwych jest dostępna tylko w zamrożonych obrazach wersji, z tą samą redakcją widoczności (employee nie widzi kosztu ani marży w obrazie)
  - Payloady eventów zawierają tylko ID

#### TC-VER-012: Cofnięcie i ponowienie zmiany kosztu jednostkowego (undo / redo)

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Admin (ma `project_costing.view_costs`); rola własna R z `project_costing.edit`, bez `project_costing.view_costs`
- **Kroki**:
  1. Jako admin: wersja robocza, pozycja z kosztem jednostkowym 100.00
  2. Jako admin: zmień koszt na 120.00, zapisz
  3. Jako admin: cofnij zmianę
  4. Jako R: spróbuj ponowić (redo) cofniętą zmianę (UI i API)
  5. Jako admin: ponów (redo) zmianę
  6. Jako R: spróbuj cofnąć zmianę admina (UI i API)
  7. Wyślij wersję; spróbuj cofnąć lub ponowić zmianę kosztu
- **Oczekiwane wyniki**:
  - Krok 3: koszt wraca do 100.00; sumy i marża przeliczone; wpis audytu bez wartości (pole wrażliwe, TC-PERM-012)
  - Krok 4: `403 FORBIDDEN`; koszt bez zmian (100.00)
  - Krok 5: koszt = 120.00; sumy i marża przeliczone
  - Krok 6: `403 FORBIDDEN`; koszt bez zmian (120.00)
  - Kroki 4 i 6: R nie widzi wartości kosztu nigdzie — odpowiedź API, historia akcji, wyszukiwarka, payloady zdarzeń
  - Krok 7: po wysłaniu wersji cofnięcie i ponowienie zmian kosztu są niedostępne (brak akcji w UI, API odrzuca)

---

## 7. Scenariusze testowe: Cenniki — 5 TC

Reguły warstwowe, historyczność, proweniencja ceny.

#### TC-PRICE-001: Cennik warstwowy — reguły (zakres, narzut, minimalna ilość, ważność)

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Utwórz regułę cennika:
     - Zakres: kategoria "Słupy"
     - Podstawa: koszt pozycji
     - Narzut: 25%
     - Min. ilość: 10 szt.
     - Ważna od 2026-10-01 do 2026-12-31
  2. Pozycja: 15 szt. × 100 = 1500 (koszt)
  3. Cena z cennika = 1500 × 1.25 = 1875
- **Oczekiwane wyniki**:
  - Reguła zastosowana (ilość ≥ 10)
  - Cena = 1875
  - Po 2026-12-31: reguła wygaśnie

#### TC-PRICE-002: Cennik — priorytet reguł

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Reguła A: kategoria "Słupy", narzut 20%
  2. Reguła B: całe cenniki, narzut 15% (bardziej ogólna)
  3. Reguła C: pozycja konkretna (SKU), narzut 30% (najbardziej konkretna)
  4. Pozycja pasuje do wszystkich trzech
- **Oczekiwane wyniki**:
  - Reguła C wygrywa (najbardziej konkretna)
  - Narzut = 30%
  - **Luka spec**: system priorytetów nie zdefiniowany

#### TC-PRICE-003: Proweniencja ceny — źródło, data, wartość historyczna

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Pozycja: koszt z cennika od 2026-10-15, wartość 100 PLN
  2. Po 2026-10-20: cennik zmienia się na 110 PLN
  3. Otwórz kalkulację z 2026-10-15
- **Oczekiwane wyniki**:
  - Kalkulacja wyświetla: koszt = 100 (historyczna wartość)
  - Metatag: "Źródło: Cennik 'Jesień 2026', snapshot 2026-10-15"
  - Brak retroaktywnej zmiany wstecz

#### TC-PRICE-004: Gotowość pod Sekocenbud / Intercenbud — mapowanie kodów

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Firma ma mapowanie: SKU "S10" = Sekocenbud kod "SK-12345"
  2. Pozycja w kalkulacji: S10
  3. Eksport do Sekocenbud (Phase 2)
- **Oczekiwane wyniki**:
  - Mapowanie zapamiętane
  - Nie ma jeszcze integracji, ale architektura gotowa


#### TC-PRICE-005: „Przelicz z cennika” — tylko linie bez ręcznej ceny

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Prosty cennik: B1 = 100.00, B2 = 200.00, B3 = 50.00; wersja robocza: P1 (z B1, cena z cennika), P2 (z B2, ręczna cena 999.00), P3 (z B3, cena z cennika)
- **Kroki**:
  1. Zmień cennik: B1 → 110.00, B2 → 220.00, B3 → 55.00
  2. Kliknij „Przelicz z cennika”
  3. Wyślij wersję i spróbuj przeliczenia na wersji wysłanej
- **Oczekiwane wyniki**:
  - P1 i P3 zaktualizowane do nowych wartości z cennika, sumy przeliczone
  - P2 bez zmian (999.00), ręczna cena zachowana
  - Akcja przeliczenia zapisana w audycie
  - Na wersji wysłanej: brak akcji w UI, API 422

---

## 8. Scenariusze testowe: Widoczność i Uprawnienia — 12 TC

Role, widoczność kosztów/marży/cen, multi-tenant izolacja, uprawnienia do edycji.

Role w scenariuszach: `superadmin`, `admin`, `employee` i role własne z fixture (patrz §2). Widoczność zależy wyłącznie od feature'ów; „admin ustawia widoczność” = edycja roli (nadanie lub odebranie feature'a), nie osobne ustawienie modułu. Zasada szczelności: ukryta marża = ukryty koszt (inaczej marżę da się policzyć z ceny i kosztu). Domyślnie `employee` nie widzi kosztów ani marży.

#### TC-PERM-001: Widoczność kosztów — feature'y ról

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Organizacja A; użytkownicy: superadmin, admin, employee (domyślne przypisanie), rola własna R1 (`project_costing.view`, `view_prices`, `view_costs`, `view_margin`), rola własna R2 (`view_costs` bez `view_margin`)
- **Kroki**:
  1. Każdy użytkownik otwiera tę samą kalkulację (UI)
  2. Każdy pobiera kalkulację przez API
- **Oczekiwane wyniki**:
  - Superadmin, admin, R1: koszt widoczny w UI i obecny w odpowiedzi API
  - Employee: kolumna „Koszt” niewidoczna; w odpowiedzi API brak wartości kosztu (filtrowanie w API, nie tylko w UI)
  - R2: zapis takiej roli odrzucony albo koszt ukryty (ukryta marża = ukryty koszt) — wariant wg speki; asercja bezwarunkowa: R2 nigdy nie dostaje kosztu
  - Organizacja zmienia widoczność wyłącznie przez przypisanie feature'ów do ról; brak osobnego ustawienia widoczności w module

#### TC-PERM-002: Widoczność marży — domyślnie ukryta dla employee, brak wycieków

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + UI + API
- **Kroki**:
  1. Employee (domyślne przypisanie) otwiera kalkulację
  2. Admin edytuje rolę employee: dodaje `project_costing.view_costs` i `project_costing.view_margin`
  3. Employee ponownie pobiera kalkulację
  4. Admin zmienia koszt i narzut; sprawdź wpisy audytu, historię akcji, wyszukiwarkę, payloady eventów, (v1) porównanie wersji i eksport XLSX
- **Oczekiwane wyniki**:
  - Domyślnie employee nie widzi kosztów ani marży (UI i API); admin widzi
  - Po edycji roli employee widzi koszt i marżę — zmiana przez edycję roli, bez osobnego ustawienia
  - W MVP marżę widzi wyłącznie rola z `project_costing.view_margin`; odsłonięcia po zamknięciu deala w MVP nie ma (TC-PERM-006, v1)
  - Wpisy audytu i historii akcji nie zawierają wartości kosztu ani marży — nawet dla admina (TC-VER-011)
  - Dla roli bez feature'ów marża i koszt nie wyciekają przez wyszukiwarkę (`query_index`/search), payloady eventów (tylko ID), porównanie wersji ani eksport XLSX

#### TC-PERM-003: Edycja narzutu — feature `edit_markup`

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + UI + API
- **Warunki wstępne**: Admin (ma `project_costing.edit_markup`); employee (domyślnie bez); rola własna R3 (`project_costing.edit`, `edit_markup`, `view_costs`, `view_margin`)
- **Kroki**:
  1. Każdy użytkownik otwiera pozycję i próbuje zmienić narzut sekcji z 20% na 30%
- **Oczekiwane wyniki**:
  - Admin i R3: pole „Narzut %” edytowalne, zapis przyjęty
  - Employee: pole narzutu tylko do odczytu lub ukryte; API `403 FORBIDDEN` przy zmianie narzutu; pozostałe pola edytowalne dzięki `project_costing.edit`

#### TC-PERM-004: Uprawnienia — wszystkie deale vs tylko własne

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Organizacja A: ustawienie „Każdy widzi tylko swoje deale”
  2. Użytkownik A (employee) tworzy Deal X z kalkulacją
  3. Użytkownik B (employee) — czy widzi Deal X i kalkulację?
- **Oczekiwane wyniki**:
  - Domyślnie wszyscy widzą wszystkie deale
  - Przy „tylko własne”: użytkownik B nie widzi Deal X ani jego kalkulacji (lista bez wpisu, API 404)
  - Admin: zawsze widzi
  - W MVP tego ustawienia nie ma — scenariusz od v1

#### TC-PERM-005: Multi-tenant izolacja — brak przecieków danych

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API
- **Kroki**:
  1. Zaloguj się jako użytkownik Firmy A
  2. Przez API odczytaj kalkulację deala Firmy B po jego ID
  3. Spróbuj /kalkulacje?ids=id_firmy_b_1,id_firmy_b_2
  4. (od v1) Eksport wszystkich kalkulacji
- **Oczekiwane wyniki**:
  - `403 FORBIDDEN` dla Firmy B
  - Filtrowanie: tylko Firmy A
  - Eksport: tylko dane Firmy A
  - **Luka spec**: czy organization filter na DB czy w aplikacji?

#### TC-PERM-006: Marża po zamknięciu deala — wygrany i przegrany

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + UI + API
- **Warunki wstępne**: Rola własna R4 z `project_costing.view_margin_after_close`, bez `view_margin` i `view_costs`; employee (domyślnie bez obu); deal O otwarty, deal W wygrany, deal L przegrany — każdy z aktywną i nieaktywną wersją
- **Kroki**:
  1. Jako R4 otwórz O, W, L
  2. Jako employee otwórz W i L
  3. Admin dodaje `project_costing.view_margin_after_close` do roli employee; employee otwiera W
- **Oczekiwane wyniki**:
  - R4: w O marża i koszt ukryte; w W i L marża i koszt wersji aktywnej widoczne (zarówno wygrany, jak i przegrany); wersje nieaktywne ukryte
  - Employee: w W i L ukryte, dopóki rola nie dostanie feature'a; po kroku 3 widzi
  - Brak osobnego przełącznika „per firma”: organizacja zmienia tylko domyślne przypisanie feature'a do ról
  - W MVP odsłonięcia po zamknięciu nie ma — marżę widzi tylko rola z `project_costing.view_margin`

#### TC-PERM-007: Widoczność w PDF oferty — nigdy nie zawiera kosztów/marży

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI
- **Kroki**:
  1. Admin (widzi koszt i marżę) wysyła wersję i pobiera PDF
  2. Employee pobiera PDF tej samej wersji
- **Oczekiwane wyniki**:
  - PDF dla klienta: dane firmy z ustawień modułu organizacji, pozycje, ceny; brak kosztów, brak marży
  - Ten sam PDF niezależnie od roli generującej — zawsze widok publiczny

#### TC-PERM-008: Widoczność w dashboardach / analityce

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Dashboard "Ranking marż TOP 10"
  2. Employee z `project_costing.view_margin` otwiera ranking
  3. Admin otwiera ranking; employee bez `view_margin` otwiera ranking
- **Oczekiwane wyniki**:
  - Ranking marż widoczny tylko dla ról z `project_costing.view_margin` (bez feature'a: brak widgetu, API `403 FORBIDDEN`)
  - Zakres deali w rankingu zgodny z widocznością deali (wszystkie albo tylko własne — od v1, TC-PERM-004)
  - Admin: agregat wszystkich deali organizacji

#### TC-PERM-009: Feature'y inwestycji, nowej rewizji i harmonogramu inwestycji

- **Priorytet**: P1 | **Etap**: MVP (`manage_investments`) + v1 (pozostałe) | **Poziom**: Integration + API + E2E/UI
- **Macierz**:

  | Feature | Etap | admin | employee (domyślnie) | Akcja |
  |---|---|---|---|---|
  | `project_costing.manage_investments` | MVP | ✅ | ✅ | utworzenie i edycja inwestycji |
  | `project_costing.new_revision` | v1 | ✅ | ❌ | „Nowa rewizja” |
  | `project_schedule.manage_investment_schedule` | v1 | ✅ | ✅ | utworzenie i edycja harmonogramu inwestycji |

- **Kroki**:
  1. Dla każdego feature'a: admin i employee wykonują akcję
  2. Rola własna bez danego feature'a wykonuje akcję
  3. Sprawdź domyślne przypisanie employee przez API ról
- **Oczekiwane wyniki**:
  - Wyniki zgodne z macierzą; brak feature'a = brak przycisku w UI i `403 FORBIDDEN` w API
  - Domyślnie employee nie ma: `project_costing.view_costs`, `view_margin`, `view_margin_after_close`, `edit_markup`, `apply_to_deal`, `admin`, `new_revision`, `view_actual_costs`, `edit_actual_costs`, ani `project_schedule.admin`; pozostałe feature'y ma
  - Organizacja może zmienić domyślne przypisanie przez edycję roli

#### TC-PERM-010: Zamknięcie deala w MVP niczego nie odsłania roli bez `view_margin`

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + UI + API
- **Warunki wstępne**: Employee (domyślnie bez `project_costing.view_costs` i `project_costing.view_margin`); deal W wygrany i deal L przegrany, każdy z wysłaną aktywną wersją
- **Kroki**:
  1. Jako employee otwórz kalkulacje W i L w siatce
  2. Pobierz kalkulacje W i L przez API
  3. Pobierz PDF oferty W i L
  4. (od v1, gdy jest eksport) Wyeksportuj kalkulacje W i L
- **Oczekiwane wyniki**:
  - Kroki 1–2: koszt i marża ukryte tak samo jak przed zamknięciem deala (brak kolumn, brak pól w odpowiedzi API)
  - Krok 3: PDF bez kosztów i marży (jak zawsze)
  - Krok 4: eksport bez kosztów i marży
  - Zamknięcie deala, wygranego ani przegranego, nie zmienia widoczności; w MVP marżę widzi tylko rola z `project_costing.view_margin`

#### TC-PERM-011: „Tylko własne deale” odrzucone w MVP — widoczne wszystkie kalkulacje organizacji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Organizacja A; użytkownicy U1 i U2 (employee, `project_costing.view`); U1 ma Deal X z kalkulacją; admin
- **Kroki**:
  1. Jako admin: spróbuj ustawić zakres widoczności „tylko własne” przez API ustawień modułu
  2. Jako U2: pobierz listę kalkulacji i kalkulację Deal X
- **Oczekiwane wyniki**:
  - Krok 1: 422; ustawienia bez zmian
  - Krok 2: U2 widzi wszystkie kalkulacje organizacji, w tym Deal X; koszt i marża zredagowane zgodnie z feature'ami U2 (domyślnie ukryte)

#### TC-PERM-012: Dziennik akcji bez kosztu, narzutu i marży — także undo i redo

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Admin; wersja robocza z pozycją P1. Wartości kontrolne, łatwe do wyszukania: koszt jednostkowy 777.77, narzut 37.5%, wynikowa marża pozycji znana z góry
- **Kroki**:
  1. Zmień koszt jednostkowy P1 na 777.77
  2. Zmień narzut P1 na 37.5%
  3. Zmień cenę P1 tak, by zmieniła się marża
  4. Dodaj pozycję P2 z kosztem i narzutem; usuń P2
  5. Import XLSX z kolumną kosztu (wartość 777.77)
  6. Cofnij (undo) krok 1, potem ponów (redo)
  7. Po każdym kroku: przez `pg` odczytaj wpisy `action_logs` tej kalkulacji — kolumny `command_payload`, `snapshot_before`, `snapshot_after`, `changes_json`
- **Oczekiwane wyniki**:
  - Żadna z czterech kolumn, w żadnym wpisie (także undo i redo), nie zawiera wartości kosztu, narzutu ani marży — ani wartości kontrolnych, ani wartości sprzed zmiany
  - Dozwolone: ID rekordów i nazwy zmienionych pól, bez wartości
  - Undo i redo działają (koszt wraca i ponownie przyjmuje 777.77 — weryfikacja przez API jako admin), mimo braku wartości w dzienniku

---

## 9. Scenariusze testowe: Koszty rzeczywiste — 3 TC

Rejestracja wydatków, budżet vs realizacja, marża rzeczywista. Etap v1; dostęp przez `project_costing.view_actual_costs` i `project_costing.edit_actual_costs` (domyślnie `employee` ich nie ma).

#### TC-REAL-001: Rejestracja kosztu rzeczywistego — kategoria, kwota, data, źródło

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Kalkulator zaakceptowany, budżet kosztów 1000 PLN
  2. Deal wykonywany, rejestruj koszty:
     - 2026-10-20: Transport 200 PLN (kategoria: Transport)
     - 2026-10-22: Produkcja 150 PLN (kategoria: Produkcja)
     - 2026-10-25: Instalacja 100 PLN (kategoria: Montaż)
  3. Zapisz
- **Oczekiwane wyniki**:
  - Koszty powiązane z kalkulacją (opcjonalnie z dealem)
  - Tabelka: data | kategoria | kwota | źródło (np. "FV-1234")
  - Sumy per kategoria
  - Użytkownik bez `project_costing.edit_actual_costs`: brak przycisku dodawania, API `403 FORBIDDEN`; bez `project_costing.view_actual_costs`: brak zakładki, API `403 FORBIDDEN`

#### TC-REAL-002: Raport budżet vs koszty rzeczywiste

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Kalkulator: Budżet = Produkcja 500, Transport 200, Montaż 300 (razem 1000)
  2. Rzeczywisty koszt (z TC-REAL-001):
     - Produkcja 150
     - Transport 200
     - Montaż 100
  3. Otwórz raport
- **Oczekiwane wyniki**:
  - Tabela: Kategoria | Budżet | Rzeczywisty | Różnica | %
  - Produkcja: 500 | 150 | -350 | -70% (pod budżetem)
  - Transport: 200 | 200 | 0 | 0% (zgodnie)
  - Montaż: 300 | 100 | -200 | -66% (pod budżetem)
  - Razem: 1000 | 450 | -550 | -55%

#### TC-REAL-003: Marża rzeczywista vs oferowana — porównanie

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Oferowana marża: 300 PLN (cena 1000 - koszt 700)
  2. Rzeczywisty koszt: 450 PLN
  3. Rzeczywista marża = 1000 - 450 = 550 PLN
  4. Raport efektywności
- **Oczekiwane wyniki**:
  - Marża oferowana vs rzeczywista: +250 PLN (lepiej niż zakładano)
  - ROI: (550 - 300) / 300 = 83% lepiej

---

## 10. Scenariusze testowe: Harmonogram Gantt — 11 TC

Zależności, auto-planowanie, baseline, części produkcji, prognoza produkcji. Wszystkie scenariusze mają etap v1.

Konwencja dat: data końca wliczona; czas trwania = koniec − start + 1 w dniach kalendarzowych (weekendy i święta się liczą); FS: następnik startuje dzień po końcu poprzednika + lag; kamień milowy ma 0 dni (start = koniec), a jego następnik startuje tego samego dnia + lag. Auto-planowanie przesuwa następniki tylko w przód; wcześniejszą datę system tylko proponuje. Jeden harmonogram na inwestycję (rekord z fazą ofertowy → wykonawczy).

#### TC-GANTT-001: Interaktywny Gantt — przeciąganie, zmiana długości

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: E2E/UI
- **Warunki wstępne**: Inwestycja z 5 zadaniami, harmonogram włączony
- **Kroki**:
  1. Zadanie "Produkcja" zaplanowane na 2026-11-01 do 2026-11-15 (15 dni, koniec wliczony)
  2. Przeciągnij na start 2026-11-05 (przesuń całe zadanie)
  3. Przeciągnij prawą krawędź paska: nowa data końca 2026-11-16
- **Oczekiwane wyniki**:
  - Po kroku 2: 2026-11-05 – 2026-11-19 (czas trwania bez zmian: 15 dni)
  - Po kroku 3: 2026-11-05 – 2026-11-16 (czas trwania 12 dni)
  - Zmiany zapisane w DB
  - Następniki przesunięte automatycznie do przodu zgodnie z TC-GANTT-005

#### TC-GANTT-002: Zależności i konwencja dat — przykłady liczbowe

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Konwencja: data końca wliczona; czas trwania = koniec − start + 1 w dniach kalendarzowych (weekend się liczy). Zadanie „Projekt”: 2026-11-02 (pon) – 2026-11-06 (pt). Zadanie „Produkcja”: czas trwania 10 dni
- **Kroki**:
  1. Sprawdź czas trwania „Projekt”
  2. Dodaj zależność FS z lagiem 0
  3. Zmień lag FS na 1
  4. Zmień na SS z lagiem 0
  5. Zmień na FF z lagiem −2
  6. Zmień na SF z lagiem 0
- **Oczekiwane wyniki**:
  - Krok 1: czas trwania 6 − 2 + 1 = 5 dni
  - Krok 2: „Produkcja” 2026-11-07 (sobota — dzień po końcu poprzednika, weekend się liczy) – 2026-11-16
  - Krok 3: 2026-11-08 (niedziela) – 2026-11-17
  - Krok 4: 2026-11-02 – 2026-11-11
  - Krok 5: koniec = 2026-11-06 − 2 = 2026-11-04, start 2026-10-26
  - Krok 6: następnik kończy się najpóźniej dzień przed startem poprzednika + lag: „Produkcja” koniec 2026-11-01 (dzień przed 2026-11-02), start 2026-10-23 (czas trwania 10 dni kalendarzowych)
  - Brak cykli (TC-GANTT-004)

#### TC-GANTT-003: Lag ujemny i weekend

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: „Projekt” 2026-11-02 – 2026-11-06; „Produkcja” — czas trwania 10 dni; „Transport” — czas trwania 2 dni, następnik zadania „Montaż” kończącym się w piątek 2026-11-13
- **Kroki**:
  1. „Produkcja” FS od „Projekt” z lagiem −2
  2. „Produkcja” SS od „Projekt” z lagiem −1
  3. „Transport” FS od „Montaż” z lagiem 0, potem z lagiem 2
- **Oczekiwane wyniki**:
  - Krok 1: start = 2026-11-07 − 2 = 2026-11-05, koniec 2026-11-14 (nakładanie 2026-11-05 – 2026-11-06), czas trwania bez zmian
  - Krok 2: start 2026-11-01, koniec 2026-11-10
  - Krok 3: lag 0 → 2026-11-14 (sobota) – 2026-11-15; lag 2 → 2026-11-16 (pon) – 2026-11-17
  - Wizualizacja pokazuje nakładanie zadań

#### TC-GANTT-004: Blokada cykli — brak nieskończonych pętli

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Zadania A → B → C
  2. Spróbuj dodać zależność C → A
- **Oczekiwane wyniki**:
  - System detektuje cykl
  - Komunikat: "Nie można dodać zależności — spowoduje cykl"
  - Zależność nie dodana

#### TC-GANTT-005: Auto-planowanie — najpóźniejszy poprzednik, przesuwanie tylko w przód

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + Integration + E2E
- **Warunki wstępne**: A 2026-11-02 – 2026-11-06; B (3 dni) FS od A, lag 0 → 2026-11-07 – 2026-11-09; C (4 dni) z dwoma poprzednikami: A (FS, lag 0) i B (FS, lag 2)
- **Kroki**:
  1. Sprawdź daty C
  2. Przesuń A na 2026-11-09 – 2026-11-13 (później)
  3. Przesuń A na 2026-10-30 – 2026-11-03 (wcześniej)
  4. Zaakceptuj propozycję przesunięcia
- **Oczekiwane wyniki**:
  - Krok 1: C = 2026-11-12 – 2026-11-15 (start od najpóźniejszego poprzednika: max(2026-11-07, 2026-11-12))
  - Krok 2: B przesunięte automatycznie do 2026-11-14 – 2026-11-16; C do 2026-11-19 – 2026-11-22 (max(2026-11-14, 2026-11-19)); jedno zdarzenie przeplanowania
  - Krok 3: B i C NIE przesuwają się same; system pokazuje propozycję: B 2026-11-04 – 2026-11-06, C 2026-11-09 – 2026-11-12
  - Krok 4: po akceptacji daty zgodne z propozycją; bez akceptacji bez zmian

#### TC-GANTT-006: Przypięte zadanie — kolizja, ostrzeżenie i propozycja odpięcia

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Warunki wstępne**: A 2026-11-02 – 2026-11-06; B (3 dni) przypięte na 2026-11-07 – 2026-11-09, FS od A; C (2 dni) FS od B
- **Kroki**:
  1. Przesuń A na 2026-11-09 – 2026-11-13
  2. Odrzuć propozycję odpięcia
  3. Powtórz krok 1 i zaakceptuj propozycję odpięcia
- **Oczekiwane wyniki**:
  - Krok 1: B nie zmienia dat (przypięte zadanie nie zmienia się po cichu); odpowiedź API zawiera jawną informację o kolizji z przypiętym zadaniem; UI pokazuje ostrzeżenie z propozycją odpięcia B
  - Krok 2: B i C bez zmian; kolizja nadal widoczna
  - Krok 3: B odpięte i przesunięte do 2026-11-14 – 2026-11-16; C do 2026-11-17 – 2026-11-18

#### TC-GANTT-007: Baseline i odchylenia — zaplanowane vs rzeczywiste

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Harmonogram w fazie ofertowej: A (2026-11-01 – 2026-11-05), B (2026-11-06 – 2026-11-10)
  2. Deal wygrany: harmonogram przechodzi w fazę wykonawczą
  3. Baseline = daty z fazy ofertowej
  4. Rzeczywistość: A faktycznie 2026-11-02 – 2026-11-08, B 2026-11-10 – 2026-11-15
  5. Raport odchyleń
- **Oczekiwane wyniki**:
  - Baseline: plan z oferty (zamrożony)
  - Rzeczywiste daty: edytowalne oddzielnie
  - Odchylenia: A start +1 dzień, czas trwania +2 dni (plan 5, rzeczywisty 7); B start +4 dni, czas trwania +1 dzień (plan 5, rzeczywisty 6)
  - Brak retroaktywnej zmiany planu

#### TC-GANTT-008: Jeden harmonogram na inwestycję — osobny rekord wspólny dla deali

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E + `pg`
- **Warunki wstępne**: Inwestycja I1 z dealami A (oferta główna) i B (alternatywna); użytkownik z `project_schedule.manage_investment_schedule`
- **Kroki**:
  1. Utwórz harmonogram inwestycji I1 z poziomu deala A
  2. Otwórz harmonogram z deala B
  3. Spróbuj utworzyć drugi harmonogram dla I1 (UI i API)
  4. Wstaw drugi rekord harmonogramu dla I1 bezpośrednio przez `pg`
- **Oczekiwane wyniki**:
  - Jeden rekord harmonogramu inwestycji, wspólny dla deali A i B (to samo ID z obu deali)
  - Rekord ma fazę: najpierw ofertowa, potem wykonawcza — nie ma osobnych rekordów ofertowego i wykonawczego (TC-GANTT-011)
  - Krok 3: odrzucony — UI bez akcji tworzenia, API 409 z ID istniejącego rekordu (TC-GANTT-010)
  - Krok 4: baza odrzuca zapis (unikalność: jeden główny rekord harmonogramu na inwestycję)

#### TC-GANTT-009: Następnik kamienia milowego — start tego samego dnia

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: „Montaż” 2026-11-05 – 2026-11-09; kamień milowy „Odbiór” FS od „Montaż”, lag 0 (start = koniec = 2026-11-10); „Rozliczenie” — czas trwania 3 dni, FS od „Odbiór”; zadanie kontrolne „Malowanie” (zwykłe) kończące się 2026-11-10 i jego następnik „Sprzątanie” FS, lag 0
- **Kroki**:
  1. Sprawdź daty „Odbiór”
  2. Sprawdź daty „Rozliczenie” przy lagu 0
  3. Zmień lag „Rozliczenie” na 2
  4. Sprawdź start „Sprzątanie”
- **Oczekiwane wyniki**:
  - Krok 1: kamień milowy ma 0 dni; start = koniec = 2026-11-10
  - Krok 2: „Rozliczenie” startuje 2026-11-10 — ten sam dzień co kamień milowy, bez +1; koniec 2026-11-12
  - Krok 3: lag 2 → start 2026-11-12, koniec 2026-11-14
  - Krok 4: następnik zwykłego zadania kończącego się 2026-11-10 przy lagu 0 startuje 2026-11-11 (dzień po końcu)
  - Kamień milowy nie wydłuża ścieżki

#### TC-GANTT-010: Druga próba założenia harmonogramu inwestycji → 409

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Inwestycja I1 z istniejącym harmonogramem H1; inwestycja I2 bez harmonogramu; użytkownik z `project_schedule.manage_investment_schedule`
- **Kroki**:
  1. API: utwórz harmonogram dla I1
  2. API: wyślij równolegle dwa żądania utworzenia harmonogramu dla I2
  3. Policz rekordy harmonogramu dla I1 i I2 przez `pg`
- **Oczekiwane wyniki**:
  - Krok 1: 409 z ID istniejącego rekordu H1 w odpowiedzi; H1 bez zmian
  - Krok 2: jedno żądanie przechodzi (201), drugie dostaje 409 z ID rekordu utworzonego przez pierwsze
  - Krok 3: dokładnie jeden rekord na I1 i jeden na I2

#### TC-GANTT-011: Zmiana fazy na wykonawczą z baseline — ten sam rekord, bez kopii

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E/UI + `pg`
- **Warunki wstępne**: Inwestycja I1, harmonogram H1 w fazie ofertowej (6 zadań z datami)
- **Kroki**:
  1. Na rekordzie inwestycji wywołaj akcję „Utwórz harmonogram wykonawczy”
  2. Sprawdź H1 przez `pg` i w UI
  3. Wywołaj akcję ponownie (UI i API)
- **Oczekiwane wyniki**:
  - Krok 1–2: H1 ma fazę wykonawczą; baseline przechwycony (daty planowane 6 zadań = daty sprzed akcji); to samo ID rekordu; brak drugiego rekordu i brak kopii zadań
  - Krok 3: niczego nie zmienia (faza, baseline i zadania bez zmian, brak nowego rekordu); odpowiedź bez błędu albo informacja, że harmonogram jest już wykonawczy

---

## 11. Testy wydajności

#### TC-PERF-001: Duża kalkulacja (5000 linii)

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Performance
- **Kroki**:
  1. Import XLSX: 5000 linii × 10 kolumn
  2. Render siatki, scroll, obliczenia
  3. Export PDF
  4. Monit: RAM, CPU, czas
- **Budżet czasowy**: < 10s (import) + < 5s (render) + < 15s (PDF)
- **Budżet pamięci**: peak < 500 MB
- **Oczekiwane wyniki**:
  - Brak hangu, responsywne UI
  - RAM peak zanotowany

#### TC-PERF-002: Duży Gantt (kilkaset zadań)

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Performance
- **Kroki**:
  1. Projekt: 300 zadań z zależnościami
  2. Render Gantta, scroll, drag-drop
  3. Kalkulacja ścieżki krytycznej
- **Budżet**: < 3s (render) + < 2s (critical path)
- **Oczekiwane wyniki**:
  - Animacje płynne
  - Brak laggów przy interakcji

#### TC-PERF-003: Równoległe żądania — concurrency

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Performance + API
- **Kroki**:
  1. 10 równoczesnych żądań API (lista kalkulacji, Gantt, raport budżetu)
  2. Monit: response time, DB connections
  3. Na VPS 3.8 GiB RAM
- **Oczekiwane wyniki**:
  - Wszystkie < 500ms
  - Brak out-of-memory
  - DB pool nie wyczerpany

---

## 12. Scenariusze testowe: Waluty (TC-CUR) — 14 TC

Kalkulacja jednowalutowa (MVP) i wielowalutowa (v1), waluta bazowa, kursy wymiany, zaokrąglenie per waluta, zmiana waluty deala.

Waluty i kursy pochodzą z modułu Waluty platformy (lista walut aktywnych, waluta bazowa organizacji, kursy). MVP: jedna waluta na kalkulację — waluta deala, a bez deala waluta domyślna firmy albo waluta bazowa. Gdy waluta kalkulacji jest walutą bazową, kurs nie jest pobierany. Gdy jest inna: kurs średni z tabeli A NBP pobrany na żądanie przy wysłaniu i zamrożony w wysłanej wersji, w dzień bez tabeli ostatnia opublikowana tabela, kurs ręczny tylko w wersji roboczej. Liczba miejsc po przecinku z ustawień waluty w module Waluty. v1: waluta per pozycja. Wszystkie wartości kursów w scenariuszach to **kurs przykładowy** podstawiany w teście bez ruchu sieciowego — nie są to rzeczywiste notowania.

#### TC-CUR-001: Waluta kalkulacji = waluta deala / domyślna firmy; PLN bez kursu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Organizacja A z walutą bazową PLN (moduł Waluty) i bez własnej waluty domyślnej kalkulacji; Deal X w PLN
- **Kroki**:
  1. Stwórz kalkulację bez deala
  2. Podepnij ją do Deal X
  3. Wyślij wersję
  4. Monitoruj ruch wychodzący serwera i tabelę kursów modułu Waluty
- **Oczekiwane wyniki**:
  - Bez deala waluta = waluta bazowa (PLN); po podpięciu waluta = waluta deala
  - Kalkulacja jednowalutowa: jedna waluta na kalkulację, brak mieszanych walut w liniach
  - W PLN kwoty mają 2 miejsca po przecinku; kurs = 1, zapisany w zamrożonym obrazie jako 1, z pustym rodzajem i pustym źródłem kursu (ani „NBP tabela A”, ani „ręczny”)
  - Brak pobierania kursu (zero żądań do NBP, brak nowych wierszy w tabeli kursów)

#### TC-CUR-002: Kurs z tabeli A NBP pobrany przy wysłaniu, zamrożony w wysłanej wersji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Waluta bazowa PLN; Deal X w EUR; kalkulacja podpięta do Deal X (waluta EUR); tabela A NBP z 2026-10-21: EUR 4.2500 (kurs przykładowy), z 2026-10-22: EUR 4.3000 (kurs przykładowy); w tabeli kursów brak kursu EUR z tabeli A przed wysłaniem
- **Kroki**:
  1. Robocza wersja: wartość pozycji 1000 EUR; sprawdź, że w wersji roboczej nie pobrano kursu
  2. Wyślij wersję 2026-10-21 po publikacji tabeli
  3. 2026-10-22 otwórz wysłaną wersję
  4. (od v1) Nowa rewizja jako robocza kopia i jej wysłanie 2026-10-22
- **Oczekiwane wyniki**:
  - Krok 1: brak żądania do NBP przed wysłaniem
  - Krok 2: kurs pobrany na żądanie przy wysłaniu z tabeli A (kurs średni), nie z tabeli kupna/sprzedaży; 1000 EUR = 4250.00 PLN
  - Zamrożony obraz zawiera: parę EUR → PLN, kurs 4.2500 jako tekst z pełną precyzją, rodzaj kursu „średni”, źródło „NBP tabela A”, datę i numer tabeli
  - Krok 3: kurs bez zmian (nadal 4.2500); PDF zawiera kurs z dnia wysłania
  - Krok 4: nowa rewizja po wysłaniu ma kurs 4.3000 z tabeli z 2026-10-22; poprzednia wersja nadal 4.2500

#### TC-CUR-003: Zaokrąglenie per waluta z ustawień waluty — JPY 0, PLN 2, KWD 3 miejsca

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit
- **Warunki wstępne**: Moduł Waluty: PLN (2 miejsca), JPY (0 miejsc), KWD (3 miejsca), wszystkie aktywne; organizacja bez własnego nadpisania liczby miejsc
- **Kroki**:
  1. Kalkulacja JPY: pozycja 1 = 1005.4 JPY, pozycja 2 = 2003.5 JPY
  2. Kalkulacja PLN: pozycja 1 = 100.345 PLN, pozycja 2 = 200.344 PLN
  3. Kalkulacja KWD: pozycja 1 = 10.0005 KWD, pozycja 2 = 20.0004 KWD
  4. Zmień w module Waluty liczbę miejsc testowej waluty i przelicz roboczą kalkulację w tej walucie
- **Oczekiwane wyniki**:
  - JPY (0 miejsc): 1005, 2004; suma 3009
  - PLN (2 miejsca): 100.35, 200.34; suma 300.69
  - KWD (3 miejsca): 10.001, 20.000; suma 30.001
  - Krok 4: liczba miejsc pochodzi z ustawień waluty w module Waluty, nie ze stałej listy w module kalkulacji; standardowa liczba miejsc ISO 4217 tylko gdy moduł Waluty jej nie podaje
  - Tryb half-up i zasada „suma z pozycji już zaokrąglonych” bez zmian; jawne ustawienie liczby miejsc przez organizację nadpisuje wartość z waluty (TC-TEN-007)
  - PDF (i od v1 eksport) respektują precyzję waluty

#### TC-CUR-004: Zmiana waluty deala po podpięciu — ostrzeżenie (MVP), przeliczenie (v1)

- **Priorytet**: P1 | **Etap**: MVP (ostrzeżenie), v1 (przeliczenie) | **Poziom**: Integration + E2E
- **Warunki wstępne**: Kalkulacja z 5 liniami w EUR, podpięta do Deal X (EUR); jedna wysłana wersja i jedna robocza
- **Kroki**:
  1. Zmień walutę Deal X z EUR na USD
  2. Otwórz roboczą wersję i spróbuj „Zastosuj wartość do deala”
  3. (v1) Wybierz: „Przelicz po kursie” albo „Zachowaj liczby w nowej walucie” i zapisz
- **Oczekiwane wyniki**:
  - Wysłana wersja bez zmian (waluta, kwoty i kurs z zamrożonego obrazu)
  - MVP: robocza wersja pokazuje ostrzeżenie o niezgodności walut (kalkulacja EUR, deal USD); „Zastosuj wartość do deala” niedostępne do czasu zmiany waluty kalkulacji
  - v1, opcja „Przelicz”: każda linia przeliczona po kursie z dnia zmiany, kurs zapamiętany
  - v1, opcja „Zachowaj liczby”: wartości bez zmian, zmienia się tylko waluta
  - Audit trail: zmiana waluty + wybrana metoda + kurs (jeśli przeliczenie)
  - „Zastosuj wartość do deala” przenosi kwotę i walutę kalkulacji

#### TC-CUR-005: Eksport i PDF w walucie oferty

- **Priorytet**: P1 | **Etap**: MVP (PDF), v1 (eksport XLSX) | **Poziom**: E2E/UI
- **Warunki wstępne**: Kalkulacja EUR, wysłana wersja z kursem 4.2500 (kurs przykładowy) z tabeli A z 2026-10-15
- **Kroki**:
  1. Wygeneruj PDF
  2. (v1) Eksportuj do XLSX
  3. Sprawdź nagłówki kolumn, symbole walut, precyzję
- **Oczekiwane wyniki**:
  - PDF: symbol waluty spójny w całym dokumencie (bez mieszania PLN/EUR); w stopce kurs z zamrożonego obrazu („Kurs: 1 EUR = 4.2500 PLN, NBP tabela A z 2026-10-15”)
  - XLSX: kolumna „Wartość (EUR)” — kwoty w EUR z liczbą miejsc waluty
  - Eksport przez użytkownika bez uprawnień do marży: kolumna marży pominięta

#### TC-CUR-006: Dzień bez publikacji tabeli A — ostatnia opublikowana tabela

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Waluta bazowa PLN; kalkulacja w EUR; tabele A NBP: piątek 2026-10-23 (EUR 4.2800, kurs przykładowy), wtorek 2026-11-10 (EUR 4.3100, kurs przykładowy); NBP podstawione w teście
- **Kroki**:
  1. Wyślij wersję w sobotę 2026-10-24
  2. Wyślij inną wersję w poniedziałek 2026-10-26 przed publikacją tabeli z tego dnia
  3. Wyślij inną wersję w święto 2026-11-11
  4. Podstaw niedostępne API NBP i brak tabeli w bazie: wyślij wersję bez kursu ręcznego
- **Oczekiwane wyniki**:
  - Krok 1: kurs 4.2800 z tabeli z 2026-10-23; w zamrożonym obrazie data tabeli 2026-10-23 (nie data wysłania)
  - Krok 2: kurs z ostatniej opublikowanej tabeli (2026-10-23)
  - Krok 3: kurs 4.3100 z tabeli z 2026-11-10
  - Kroki 1–3: wysłanie nie jest blokowane
  - Krok 4: wysłanie odrzucone, 422 `FX_RATE_UNAVAILABLE`, komunikat z prośbą o kurs ręczny; wersja pozostaje robocza

#### TC-CUR-007: Kurs ręczny — tylko w wersji roboczej, do zamrożonego obrazu, nie do tabeli kursów

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Waluta bazowa PLN; robocza wersja w EUR; w tabeli kursów modułu Waluty kurs EUR z tabeli A 4.2500 (kurs przykładowy); użytkownik z prawem edycji kalkulacji
- **Kroki**:
  1. Ustaw kurs ręczny 4.2700 (kurs przykładowy) bez podania powodu
  2. Ustaw kurs ręczny 4.2700 z powodem „kurs z umowy”
  3. Wyślij wersję
  4. Sprawdź tabelę kursów modułu Waluty
  5. Spróbuj zmienić kurs w wysłanej wersji (UI i API)
- **Oczekiwane wyniki**:
  - Krok 1: odrzucone — powód wymagany
  - Krok 2: kurs przyjęty, oznaczony jako ręczny; wpis w audycie (kto, kiedy, powód); undo przywraca stan bez kursu ręcznego
  - Krok 3: kurs ręczny ma pierwszeństwo przed NBP (brak żądania do NBP); zamrożony obraz zawiera 4.2700 ze źródłem „ręczny” i rodzajem kursu „ręczny”
  - Krok 4: tabela kursów bez nowego wiersza i bez zmiany kursu 4.2500 — kurs ręczny nie zmienia kursów firmy
  - Krok 5: pole tylko do odczytu, API 422; kurs bez zmian; zmiana kursu wymaga nowej rewizji

#### TC-CUR-008: Brak waluty bazowej organizacji — wysłanie zablokowane

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Organizacja B bez waluty bazowej w module Waluty; robocza kalkulacja w EUR podpięta do deala; druga kalkulacja bez deala, organizacja bez waluty domyślnej kalkulacji
- **Kroki**:
  1. Wyślij roboczą wersję w EUR
  2. Stwórz kalkulację bez deala
  3. Ustaw walutę bazową PLN w module Waluty i powtórz krok 1
- **Oczekiwane wyniki**:
  - Krok 1: 422 `BASE_CURRENCY_MISSING`; brak zamrożonego obrazu, brak PDF; wersja pozostaje robocza
  - Krok 2: 422 `BASE_CURRENCY_MISSING` (nie da się ustalić waluty kalkulacji)
  - Krok 3: wysłanie przechodzi z kursem EUR → PLN
  - Organizacja A w tym samym tenancie (z walutą bazową) działa bez zmian

#### TC-CUR-009: Waluta nieaktywna albo spoza modułu Waluty — 422

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Moduł Waluty: CHF nieaktywny, SEK nie istnieje; Deal Y w SEK (waluta ze słownika deala); robocza kalkulacja w CHF utworzona, gdy CHF był aktywny
- **Kroki**:
  1. Stwórz kalkulację w CHF
  2. Podepnij nową kalkulację do Deal Y
  3. Wyślij istniejącą roboczą wersję w CHF
  4. Aktywuj CHF i powtórz krok 3
- **Oczekiwane wyniki**:
  - Kroki 1–3: 422 z kodem błędu nieaktywnej waluty i komunikatem „Waluta {kod} nie jest aktywna w module Waluty — dodaje ją administrator”; brak zapisu
  - Krok 4: wysłanie przechodzi (kurs z tabeli A albo ręczny)
  - Lista wyboru waluty w kalkulacji nie pokazuje CHF (przed aktywacją) ani SEK

#### TC-CUR-010: Pracownik widzi wybór waluty bez dostępu do modułu Waluty

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Warunki wstępne**: Użytkownik z rolą `employee` z prawem podglądu i edycji kalkulacji, bez uprawnień modułu Waluty; aktywne PLN (bazowa), EUR, JPY
- **Kroki**:
  1. Otwórz kalkulację bez deala i rozwiń wybór waluty
  2. Pobierz listę walut przez API modułu kalkulacji
  3. Otwórz ekran i API modułu Waluty (lista walut, kursy)
  4. Użytkownik bez prawa podglądu kalkulacji pobiera listę walut z kroku 2
- **Oczekiwane wyniki**:
  - Krok 1: wybór pokazuje PLN, EUR, JPY; PLN oznaczony jako bazowa
  - Krok 2: lista tylko aktywnych walut z kodem, nazwą, liczbą miejsc i oznaczeniem waluty bazowej; bez kursów
  - Krok 3: ekran i API modułu Waluty niedostępne (`403 FORBIDDEN`) — rola nie dostała uprawnień modułu Waluty
  - Krok 4: `403 FORBIDDEN`
  - Tenant istniejący przed wdrożeniem: ten sam wynik bez synchronizacji ról

#### TC-CUR-011: Kurs zapisany dla daty D znajdowany dla tej samej daty, także w sumach deali w EUR; godziny graniczne

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Waluta bazowa PLN; strefa serwera i organizacji Europe/Warsaw; w tabeli kursów tylko wiersze dostawcy „NBP tabela A” (bez wierszy tabeli C); tabela A z datą D-1 = 2026-10-22: EUR 4.3305 (kurs przykładowy) i z datą D = 2026-10-23: EUR 4.3281 (kurs przykładowy); dla przypadku zimowego tabela A z 2026-10-26: EUR 4.3350 i z 2026-10-27: EUR 4.3400 (kursy przykładowe); pobieranie kursów z sieci wyłączone w teście (dostawca podstawiony, bez automatycznego dociągania); deale: 2 w EUR (10 000 EUR i 5 000 EUR) i 1 w PLN (20 000 PLN)
- **Kroki**:
  1. Zapisz kursy z tabeli A dla daty D przez dostawcę „NBP tabela A” (wiersz z datą D 00:00 UTC), nie przez dostawcę tabeli C
  2. Wyszukaj kurs EUR → PLN tak, jak robi to moduł Waluty, dla chwili D 12:00 czasu warszawskiego
  3. Wyszukaj kurs tak, jak robi to moduł Waluty, dla chwil: D 23:30 i D 00:30 czasu warszawskiego
  4. Przy zegarze ustawionym na D 12:00 czasu warszawskiego otwórz podsumowanie deali (wartość lejka w walucie bazowej)
  5. Wyślij kalkulację w EUR w dniu D o 12:00, o 23:30 i (na świeżych danych) o 00:30 czasu warszawskiego
  6. Przypadek graniczny, czas letni (D = 2026-10-23, UTC+2): wyszukaj kurs jak moduł Waluty dla D 01:59:59 i D 02:00:00 czasu warszawskiego; wyślij kalkulację o D 01:59:59
  7. Przypadek graniczny, czas zimowy (D = 2026-10-27, UTC+1): wyszukaj kurs jak moduł Waluty dla D 00:59:59 i D 01:00:00 czasu warszawskiego; wyślij kalkulację o D 00:59:59
- **Oczekiwane wyniki**:
  - Krok 2: kurs znaleziony dla daty D (4.3281), bez cofania do dni poprzednich
  - Krok 3: 23:30 → kurs z daty D (4.3281); 00:30 → kurs z daty D-1 (4.3305) — wyszukiwanie modułu Waluty liczy dzień w UTC, więc o 00:30 czasu warszawskiego widzi jeszcze poprzedni dzień; zachowanie udokumentowane w specyfikacji, nie błąd
  - Krok 4: podsumowanie nie zgłasza braku kursu EUR (wszystkie deale przeliczone, lista walut bez kursu pusta); suma = 15 000 × 4.3281 + 20 000 = 84 921.50 → **84 922 PLN** (podsumowanie deali zaokrągla do pełnych złotych; przykład liczbowy na kursach przykładowych)
  - Krok 5: każde z trzech wysłań zamraża kurs z tabeli z datą D (4.3281) — data wysłania to data kalendarzowa w Europe/Warsaw, niezależnie od godziny; w realnym NBP o 00:30 tabela z dnia D nie jest jeszcze opublikowana i wynikiem byłaby tabela z D-1
  - Krok 6: 01:59:59 → D-1 (4.3305); 02:00:00 → D (4.3281); wysłanie o 01:59:59 → kurs z daty D (4.3281)
  - Krok 7: 00:59:59 → 2026-10-26 (4.3350); 01:00:00 → 2026-10-27 (4.3400); wysłanie o 00:59:59 → kurs z 2026-10-27 (4.3400)
  - Test regresyjny dla opisanego w specyfikacji błędu daty (zapis o północy czasu warszawskiego, wyszukiwanie o północy UTC)

#### TC-CUR-012: Waluta bez kursu w żadnej tabeli NBP jako waluta oferty — 422

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Waluta bazowa PLN; CNH i CNY aktywne w module Waluty; CNH nie występuje w żadnej tabeli NBP (A, B, C), CNY występuje w tabeli A; deal D-CNH z walutą CNH; kalkulacja robocza K-CNH w CNH utworzona przed wdrożeniem walidacji (dane przez `pg`)
- **Kroki**:
  1. Utwórz kalkulację bez deala w walucie CNH
  2. Podepnij nową kalkulację do deala D-CNH
  3. Ustaw kurs ręczny 0.5400 (kurs przykładowy) w K-CNH i wyślij wersję
  4. Utwórz kalkulację bez deala w walucie CNY
  5. Sprawdź listę walut do wyboru w kalkulacji
- **Oczekiwane wyniki**:
  - Kroki 1–2: 422 z kodem błędu waluty bez źródła kursu (kod proponowany) i czytelnym komunikatem: „Waluta CNH nie ma kursu w tabeli A NBP i nie może być walutą oferty ani pozycji — wybierz inną walutę”; nic nie zapisane
  - Krok 3: samo ustawienie kursu ręcznego nie zwraca 422 (kurs ręczny jest dozwolony w wersji roboczej); 422 z tym samym kodem i komunikatem zwraca wysłanie wersji (mark-sent); K-CNH pozostaje robocza bez zamrożonego obrazu; brak kursu zgadywanego, krzyżowego i kursów kupna/sprzedaży z innej tabeli
  - Krok 1: błąd waluty bez źródła kursu różni się od błędu nieaktywnej waluty (CNH jest aktywna) i od błędu chwilowego braku kursu
  - Krok 4: 201 — CNY przechodzi walidację (jest w tabeli A); bez kursu z dnia wysłania i bez kursu ręcznego wysłanie kończy się błędem chwilowego braku kursu, nie błędem waluty bez źródła kursu
  - Krok 5: CNY i CNH nadal aktywne w module Waluty (nic nie dezaktywowane); CNH oznaczona jako niedostępna w wyborze (propozycja)

#### TC-CUR-013: Waluty per pozycja — suma w walucie kalkulacji

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Waluta bazowa PLN; kalkulacja w PLN; tabela A z dnia wysłania: EUR 4.2500, USD 3.8000 (kursy przykładowe)
- **Kroki**:
  1. Dodaj pozycje: 1000 EUR, 500 USD, 2000 PLN
  2. Dodaj pozycję w walucie nieaktywnej
  3. Wyślij wersję
  4. Zmień kurs ręczny jednej pary w nowej rewizji
- **Oczekiwane wyniki**:
  - Krok 1: każda pozycja pokazuje własną walutę; suma kalkulacji w PLN = 4250.00 + 1900.00 + 2000.00 = 8150.00
  - Krok 2: 422 z kodem błędu nieaktywnej waluty
  - Krok 3: zamrożony obraz zawiera osobny wpis kursu dla każdej pary (EUR → PLN, USD → PLN) z rodzajem kursu, źródłem i datą tabeli; pozycje PLN bez kursu
  - Krok 4: zmiana dotyczy tylko nowej rewizji i tylko jednej pary

#### TC-CUR-014: Waluta pozycji bez kursu w żadnej tabeli NBP — 422

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + API
- **Warunki wstępne**: Waluta bazowa PLN; kalkulacja robocza w PLN z pozycją 1000 EUR; CNH aktywna w module Waluty, poza tabelami A, B i C NBP; tabela A z dnia wysłania: EUR 4.2500 (kurs przykładowy)
- **Kroki**:
  1. Dodaj pozycję 500 CNH
  2. Zmień walutę istniejącej pozycji EUR na CNH
  3. Ustaw kurs ręczny pary CNH → PLN 0.5400 (kurs przykładowy) i powtórz krok 1
  4. Wyślij wersję
- **Oczekiwane wyniki**:
  - Kroki 1–2: 422 z kodem błędu waluty bez źródła kursu (kod proponowany) i czytelnym komunikatem wskazującym CNH i pozycję: „Waluta CNH nie ma kursu w tabeli A NBP i nie może być walutą oferty ani pozycji — wybierz inną walutę”; pozycja nie zapisana albo bez zmian
  - Krok 3: samo ustawienie kursu ręcznego pary CNH → PLN nie zwraca 422 (kurs ręczny jest dozwolony w wersji roboczej); 422 z tym samym kodem i komunikatem zwraca powtórzony krok 1; pozycja nie zapisana
  - Krok 2: pozycja zostaje w EUR; suma kalkulacji bez zmian (4250.00 PLN)
  - Krok 4: wysłanie przechodzi; zamrożony obraz zawiera tylko parę EUR → PLN, brak wpisu dla CNH

---

## 13. Scenariusze testowe: Firmy BEZ modułu harmonogramu (TC-NOSCHED) — 5 TC

Kalkulacja, partie, prognoza działają; brak Ganttu; włączanie/wyłączanie modułu.

Firma = organizacja. Harmonogram włącza się per organizacja w ustawieniach modułu (`ModuleConfigService`); dodatkowo działa globalny wyłącznik modułu per tenant (feature toggle). Wyłączony harmonogram: brak menu, brak zakładki na dealu, brak widgetu, API 404. Wyłączenie ukrywa dane, nie usuwa ich; po ponownym włączeniu zadanie w tle tworzy brakujące harmonogramy wykonawcze. Ręczne partie i import harmonogramu z XLSX dla firm bez Gantta są w MVP; włączanie i wyłączanie modułu harmonogramu ma etap v1. Testy zależne od włączonego Gantta mają `requiredModules` w `__integration__/meta.ts`.

#### TC-NOSCHED-001: Kalkulacja + partie/daty bez modułu harmonogramu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Firma B z wyłączonym modułem harmonogramu
- **Kroki**:
  1. Firma B: harmonogram wyłączony w ustawieniach modułu organizacji (w MVP modułu harmonogramu nie ma — oczekiwany ten sam wynik)
  2. Otwórz kalkulator w Firmie B
  3. Dodaj pozycje z datą produkcji i datą dostawy bezpośrednio w liniach kalkulacji
  4. Dodaj partie: element "Słup SB-01", ilość 10 szt., data produkcji 2026-11-15, data dostawy 2026-11-30
  5. Zapisz
- **Oczekiwane wyniki**:
  - Linie kalkulacji mają pola "Data produkcji" i "Data dostawy" — działają normalnie
  - Partie produkcji widoczne i edytowalne w kalkulacji
  - Prognoza produkcji działa (z tych dat, bez Ganttu)
  - Brak zakładki "Harmonogram Gantt" w nawigacji
  - Brak endpointów `/schedule/gantt` (404) dla Firmy B

#### TC-NOSCHED-002: Brak endpointów i UI harmonogramu; globalny wyłącznik tenanta

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: API + E2E
- **Warunki wstępne**: Tenant T1: organizacja A (harmonogram włączony), organizacja B (wyłączony); Deal X w B, Deal Y w A
- **Kroki**:
  1. Jako użytkownik B: wywołaj API harmonogramu dla Deal X (zadania, harmonogram inwestycji)
  2. Jako użytkownik B: sprawdź menu boczne, zakładki deala, widgety dashboardu
  3. Jako użytkownik A: te same endpointy dla Deal Y
  4. Włącz globalny wyłącznik modułu dla tenanta T1; użytkownik A ponawia kroki 1–2
  5. Zdejmij wyłącznik tenanta
- **Oczekiwane wyniki**:
  - Krok 1: 404 — blokada w guardzie trasy, nie tylko w UI
  - Krok 2: brak pozycji menu, brak zakładki na dealu (spot `detail:customers.deal:tabs`), brak widgetu (komponent nie ładowany)
  - Krok 3: 200 OK
  - Krok 4: dla A też 404, brak menu, zakładki i widgetu — mimo włączenia w ustawieniach organizacji
  - Krok 5: A znowu 200, dane bez zmian

#### TC-NOSCHED-003: Import harmonogramu z XLSX bez Gantta — zastąpienie po potwierdzeniu, raport błędów

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Organizacja B bez Gantta; kalkulacja K z 5 partiami z wcześniejszego importu; plik XLSX z polskiego Excela z kolumnami Zadanie | Start | Koniec | Ilość | Poprzednik, 20 wierszy: wiersz 7 ma koniec przed startem, wiersz 12 ma datę „31.02.2026”, wiersz 15 zależy od wiersza 7
- **Kroki**:
  1. Import → podgląd
  2. Anuluj na ekranie potwierdzenia
  3. Import ponownie → potwierdź zastąpienie danych
- **Oczekiwane wyniki**:
  - Podgląd: 17 poprawnych wierszy; raport: wiersze 7 i 12 odrzucone z powodem, wiersz 15 odrzucony i raportowany jako zależny od odrzuconego wiersza 7
  - Krok 2: 5 starych partii bez zmian, nic nie zapisane
  - Krok 3: stare 5 partii zastąpione 17 nowymi; raport dostępny po imporcie; import działa w tle (`ProgressJob`)
  - Daty interpretowane wg konwencji: koniec wliczony
  - Prognoza produkcji odzwierciedla daty z importu
  - Brak rekordów Gantta

#### TC-NOSCHED-004: Włączenie harmonogramu w trakcie — uzupełnienie harmonogramów wykonawczych w tle

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration + E2E
- **Warunki wstępne**: Organizacja B (harmonogram wyłączony) z 10 kalkulacjami z partiami; 2 deale wygrane w czasie, gdy harmonogram był wyłączony
- **Kroki**:
  1. Admin B włącza harmonogram w ustawieniach modułu
  2. Opróżnij kolejkę (`drainIntegrationQueue`)
  3. Uruchom zadanie uzupełniające ponownie
  4. Wyłącz harmonogram
- **Oczekiwane wyniki**:
  - Krok 1: menu, zakładka i widget pojawiają się; API 200
  - Krok 2: zadanie w tle utworzyło brakujące harmonogramy wykonawcze dla 2 wygranych deali
  - Krok 3: brak duplikatów (idempotencja)
  - Partie i daty w kalkulacji nadal widoczne
  - Krok 4: menu, zakładka i widget znikają, API 404; dane harmonogramu zostają w bazie — ukryte, nieusunięte (asercja przez `pg`)

#### TC-NOSCHED-005: Wyłącz → włącz → dane bez zmian

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Organizacja A z harmonogramem inwestycji (12 zadań, 3 zależności, 1 zadanie przypięte, 1 kamień milowy) w fazie wykonawczej
- **Kroki**:
  1. Zapisz stan (API i `pg`)
  2. Wyłącz harmonogram w ustawieniach modułu
  3. Spróbuj odczytu i zapisu przez API
  4. Włącz harmonogram
  5. Porównaj stan z krokiem 1
- **Oczekiwane wyniki**:
  - Krok 2: dane w bazie bez zmian — nie usunięte, nie zarchiwizowane
  - Krok 3: 404 dla odczytu i zapisu
  - Krok 5: dane identyczne z krokiem 1 (zadania, daty, zależności, przypięcia, faza)
  - Brak zdarzeń przeplanowania w czasie wyłączenia

---

## 14. Scenariusze testowe: Prognoza produkcji (TC-FCST) — 8 TC

Horyzont 6 miesięcy, tygodnie/miesiące, ważenie prawdopodobieństwem, partie, zmiana oferty.

#### TC-FCST-001: Prognoza z Ganttem — tygodnie i miesiące

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Firma A z modułem harmonogramu; deal z Ganttem; kilkanaście partii produkcji
- **Kroki**:
  1. Partie: Słup SB-01 × 10 szt. (2026-11-05), Strop ST-02 × 5 m³ (2026-11-20), Ściana SC-03 × 3 m³ (2027-01-10)
  2. Otwórz prognozę: tryb "miesiące"
  3. Przełącz na tryb "tygodnie"
- **Oczekiwane wyniki**:
  - Tryb miesiące: Listopad=15 szt. + 5 m³, Grudzień=brak, Styczeń=3 m³
  - Tryb tygodnie: Tydzień 45 (Słup SB-01), Tydzień 47 (Strop), Tydzień 2/2027 (Ściana)
  - Suma tygodni listopad = suma miesiąca listopad (konsolidacja spójna)
  - Partie powiązane z zadaniami Ganttu — zmiana daty w Ganttcie automatycznie aktualizuje prognozę

#### TC-FCST-002: Prognoza bez Ganttu — daty z kalkulacji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Firma B (harmonogram OFF); partie z datami w liniach kalkulacji
- **Kroki**:
  1. Kalkulacja z partiami: Element A (2026-11-01, 10 szt.), Element B (2026-12-15, 5 m³)
  2. Otwórz prognozę produkcji
- **Oczekiwane wyniki**:
  - Prognoza działa bez Ganttu — agreguje z dat bezpośrednio w partiach
  - Listopad: 10 szt. Element A; Grudzień: 5 m³ Element B
  - Brak zakładki Gantt, ale zakładka Prognoza widoczna

#### TC-FCST-003: Jednostki w prognozie — m³ i szt. oddzielnie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Partie: 10 szt. Słup, 3 m³ Strop, 2 szt. Belka
- **Kroki**:
  1. Prognoza listopad
- **Oczekiwane wyniki**:
  - Wyświetlenie per jednostka: "12 szt. | 3 m³" (nie sumy różnych jednostek)
  - Ewentualnie osobne kolumny per jednostka miary
  - Brak sumowania m³ + szt. (niezgodne jednostki)

#### TC-FCST-004: Ważenie prawdopodobieństwem deala; kalkulacja bez deala osobno

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Deal X (prawdopodobieństwo 60%), Deal Y (100%), Deal Z (0%); kalkulacja K0 bez deala z partią 7 szt. w listopadzie
- **Kroki**:
  1. Deal X: 10 szt. w listopadzie → ważone = 6 szt.
  2. Deal Y: 5 szt. w listopadzie → ważone = 5 szt.
  3. Deal Z: 20 szt. w listopadzie → ważone = 0 szt.
  4. Zmień prawdopodobieństwo Deal X na 80%
  5. Prognoza ponownie
- **Oczekiwane wyniki**:
  - Prognoza "niezważona" (surowa) deali: 10 + 5 + 20 = 35 szt.
  - Prognoza "ważona": 6 + 5 + 0 = 11 szt.
  - Obie dostępne (dwa widoki lub przełącznik)
  - K0 nie wchodzi do prognozy ważonej; pokazana osobno w pozycji „Kalkulacje bez deala”: 7 szt.
  - Po zmianie prob Deal X na 80%: ważona = 8 + 5 + 0 = 13 szt. (natychmiastowa aktualizacja); K0 nadal osobno
  - Deal Z (0%): nie pojawia się w prognozie ważonej (filtrowany)

#### TC-FCST-005: Partie przekraczające horyzont 6 miesięcy

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Prognoza z horyzontem 6 mies. (2026-11 do 2027-04); partie: Element D data 2027-05-01 (poza horyzontem)
- **Kroki**:
  1. Otwórz prognozę
  2. Rozszerz horyzont na 12 mies.
  3. Powróć do 6 mies.
- **Oczekiwane wyniki**:
  - Partie poza horyzontem: widoczne w sekcji "Po horyzoncie" lub po rozszerzeniu widoku
  - Suma partii w horyzoncie ≠ suma wszystkich partii (jeśli są poza horyzontem)
  - UI: informacja "X partii poza horyzontem (suma: Y szt.)"
  - Nie ukrywaj cicho — użytkownik widzi, że coś jest pominięte

#### TC-FCST-006: Suma okresów = suma partii; zmiana oferty głównej

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja z dwoma dealami; Deal A = oferta główna; Deal B = alternatywna
- **Kroki**:
  1. Deal A: 15 szt. łącznie (rozłożone: 5/4/6 na listopad/grudzień/styczeń)
  2. Prognoza: suma okresów = 5 + 4 + 6 = 15 ✓
  3. Zmień ofertę główną na Deal B (10 szt. w różnych miesiącach)
  4. Prognoza po zmianie
- **Oczekiwane wyniki**:
  - Suma tygodni/miesięcy = całkowita ilość partii w danym dealu (invariant zawsze spełniony)
  - Po zmianie oferty głównej: prognoza inwestycji opiera się na Deal B (oferta główna)
  - Deal A: nie znika, ale oznaczony jako "Alternatywna" w prognozie zbiorczej
  - Zmiana oferty głównej jest audytowana

#### TC-FCST-007: Deal przegrany ponownie otwarty (`lost` → NULL) wraca do prognozy; bez reakcji modułów własnych

> Decyzje: D191 (z doprecyzowaniem 2026-10-31: `rejected` nie wraca do prognozy), D185, D45, D72, D141.

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Deal L z kalkulacją i partiami (8 szt. w listopadzie), nigdy niewygrany, `closure_outcome = 'lost'`, etap inny niż `rejected`; deal LR jak L, ale na etapie `rejected`; harmonogram ofertowy deala L (gdy moduł harmonogramu włączony); subskrybent eventów
- **Kroki**:
  1. Otwórz prognozę; odczytaj pozycję deala L
  2. Otwórz ponownie deal L standardową ścieżką modułu `customers` OM core (`closure_outcome` `lost` → NULL)
  3. Otwórz prognozę ponownie
  4. `pg` i eventy: `ps_schedules.reopened_at`, `ps_schedule_tasks.reopened_at`, `pd_projects` dla deala L, eventy `project_delivery.*` i `project_schedule.*`; kalkulacja, wersje i rola oferty deala L
  5. Otwórz ponownie deal LR tą samą ścieżką (`lost` → NULL, etap `rejected` bez zmian); otwórz prognozę
- **Oczekiwane wyniki**:
  - Krok 1: deal L poza prognozą
  - Krok 2: `closure_outcome` = NULL — przejście wykonuje moduł `customers` bez zmian w forku (D45)
  - Krok 3: partie deala L wracają do prognozy (8 szt. w listopadzie, ważone prawdopodobieństwem jak TC-FCST-004)
  - Krok 4: brak flag `reopened_at` (D72) i `deal_reopened_at` (D141), brak projektu dla deala L, brak eventów modułów własnych dla tego przejścia; kalkulacja, wersje i rola oferty bez zmian
  - Krok 5: LR nadal poza prognozą (etap `rejected` wykluczony także przy `closure_outcome` NULL); kalkulacja i wersje LR bez zmian
  - Deal `won` → `lost` → otwarty: flagi D72/D141 z przejścia `won` → `lost` — poza tym TC (TC-PD-PRJ-008, TC-EXEC-003)

#### TC-FCST-008: Wyjście z `rejected` samą zmianą etapu czyści wynik i powód; `lost` → otwarty poza `rejected` jak w core

> Decyzje: D191 (doprecyzowanie 2026-10-31, Z7), D192 (pkt 6, Q-LR-4), D45.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg` (audyt)
- **Warunki wstępne**: Seed D192 wykonany; deal DJ1 na `rejected` z `rejected_by_buyer` (`closureOutcome = lost`) z kalkulacją i partiami; deal DJ2 na `offer` przegrany ścieżką „Oznacz jako przegrany” (`closureOutcome = lost`, powód `price_too_high`); wzorzec: ten sam przypadek DJ2 w środowisku bez modułu `crm_deal_rules`
- **Kroki**:
  1. DJ1: zmień tylko etap na `offer`; odczytaj deal, audyt i prognozę
  2. DJ2: otwórz ponownie (`lost` → NULL) bez zmiany etapu; odczytaj deal i audyt
- **Oczekiwane wyniki**:
  - Krok 1: DJ1 `closure_outcome` NULL i `loss_reason_id` NULL (czyści moduł `crm_deal_rules`); poprzednie wartości w audycie; partie DJ1 wracają do prognozy (etap poza `rejected`, D185)
  - Krok 2: `closure_outcome` NULL; `loss_reason_id` i pozostałe pola jak we wzorcu bez modułu (zachowanie core, D45); brak zmian wprowadzonych przez moduł `crm_deal_rules`

---

## 15. Scenariusze testowe: Harmonogram ofertowy → wykonawczy (TC-EXEC) — 6 TC

Automatyczne przejście w fazę wykonawczą, idempotentność, ponowne otwarcie, deal bez harmonogramu, wiele dealów. Wszystkie scenariusze mają etap v1. Harmonogram inwestycji to jeden rekord z fazą: ofertowy, a po wygraniu deala wykonawczy.

#### TC-EXEC-001: Automatyczne przejście harmonogramu w fazę wykonawczą przy wygraniu deala

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Deal X (otwarty) na inwestycji I1; harmonogram inwestycji I1 w fazie ofertowej z 5 zadaniami
- **Kroki**:
  1. Zamknij Deal X jako wygrany (`closure_outcome = won`, zdarzenie `customers.deal.won`)
  2. Sprawdź harmonogram
- **Oczekiwane wyniki**:
  - Harmonogram przechodzi w fazę wykonawczą AUTOMATYCZNIE (bez klikania użytkownika)
  - To ten sam rekord harmonogramu inwestycji (brak kopii, brak drugiego rekordu)
  - Baseline = daty z fazy ofertowej (zamrożony punkt odniesienia); nie zmienia się automatycznie
  - Daty planowane = daty wykonawcze (edytowalne przez kierownika projektu)
  - Użytkownik widzi notyfikację "Harmonogram wykonawczy utworzony"

#### TC-EXEC-002: Idempotentność — podwójne zdarzenie won

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Deal X wygrany; harmonogram inwestycji w fazie wykonawczej
- **Kroki**:
  1. Wyemituj zdarzenie `customers.deal.won` ponownie (np. retry systemu, błąd integracji, podwójny klik)
  2. Sprawdź liczbę rekordów harmonogramu dla inwestycji
- **Oczekiwane wyniki**:
  - Dokładnie jeden rekord harmonogramu (asercja przez `pg`)
  - Drugie zdarzenie: no-op z logiem ostrzegawczym
  - Brak duplikatów baseline, zadań, kamieni milowych
  - Stan harmonogramu po podwójnym zdarzeniu = identyczny jak po pierwszym

#### TC-EXEC-003: Deal ponownie otwarty i ponownie wygrany — oznaczenie bez usuwania

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Organizacja A (harmonogram włączony): Deal X wygrany, harmonogram w fazie wykonawczej (8 zadań). Organizacja B (harmonogram wyłączony): Deal Y wygrany, harmonogram utworzony przed wyłączeniem
- **Kroki**:
  1. Otwórz ponownie Deal X (cofnięcie zamknięcia)
  2. Sprawdź harmonogram, deal i Gantt inwestycji
  3. Zamknij Deal X ponownie jako wygrany
  4. Organizacja B: otwórz ponownie Deal Y
- **Oczekiwane wyniki**:
  - Kroki 1–2: harmonogram oznaczony „deal ponownie otwarty”; nic nie jest usuwane ani archiwizowane (zadania, daty, baseline bez zmian — asercja przez `pg`); badge widoczny na dealu i w Gantcie inwestycji
  - Krok 3: oznaczenie usunięte; brak drugiego harmonogramu (jeden rekord); baseline bez zmian
  - Krok 4: ponowne otwarcie niczego nie zmienia w danych harmonogramu (brak oznaczenia, brak zmian)
  - Audit trail: wygranie → ponowne otwarcie → wygranie

#### TC-EXEC-004: Deal bez harmonogramu ofertowego — wygranie

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Deal Y bez harmonogramu ofertowego (tylko kalkulacja); wygranie
- **Kroki**:
  1. Deal Y: status "Propozycja", brak Ganttu ofertowego
  2. Zmień status → "Wygrana"
  3. Sprawdź harmonogram
- **Oczekiwane wyniki**:
  - System nie tworzy harmonogramu wykonawczego (brak danych źródłowych)
  - LUB: tworzy pusty harmonogram wykonawczy z komunikatem "Harmonogram ofertowy nie istniał — utwórz ręcznie"
  - Notyfikacja dla użytkownika: "Deal wygrany, brak harmonogramu ofertowego — warto dodać harmonogram"
  - Deal wygrywa normalnie (brak blokady)

#### TC-EXEC-005: Wiele deali tej samej inwestycji — wygranie jednego

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja I1: Deal A (oferta główna), Deal B (alternatywna); harmonogram inwestycji I1 w fazie ofertowej
- **Kroki**:
  1. Deal A wygrywa
  2. Sprawdź harmonogram inwestycji
  3. Deal B: co się dzieje?
- **Oczekiwane wyniki**:
  - Harmonogram inwestycji I1 (jeden rekord) przechodzi w fazę wykonawczą automatycznie
  - Brak drugiego rekordu harmonogramu dla Deal B; kalkulacja i partie Deal B bez zmian
  - Deal B pozostaje "alternatywna" — brak automatycznych zmian

#### TC-EXEC-006: Usunięcie i przywrócenie deala z harmonogramem wykonawczym — `reopened_at` bez kaskady

> Decyzje: D188 (z doprecyzowaniem 2026-10-31), D72, D131, D140.

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Organizacja z modułem harmonogramu; inwestycja I-1: harmonogram wykonawczy bez fazy projektu, deal X wygrany; inwestycja I-2: rekord z fazą projektu (zadanie `ps_schedule_tasks` z `execution_project_id`) włączoną z dealem Y (`execution_deal_id`), projekt P-Y; inwestycja I-3: harmonogram wykonawczy bez fazy projektu, deal W wygrany; użytkownik U-E z feature `project_schedule.edit`, użytkownik U-R bez niego; subskrybent eventów
- **Kroki**:
  1. Usuń deal X w UI OM (`customers.deal.deleted`)
  2. Usuń deal Y w UI OM
  3. `pg`: `ps_schedules.reopened_at`, `ps_schedule_tasks.reopened_at`, zadania, daty, baseline obu rekordów
  4. Wyślij kolejny push n8n dla postępowania deala X
  5. Przywróć deale X i Y (`deleted_at` → NULL); odczytaj flagi i eventy
  6. `project_schedule.schedules.reopen_flag_clear` dla I-1 i I-2: U-R; U-E bez powodu w żądaniu; odczytaj `audit_logs`
  7. Usuń deal W, przywróć go, potem oznacz W jako wygrany (`customers.deal.won`)
- **Oczekiwane wyniki**:
  - Krok 1: I-1 — `reopened_at` na rekordzie harmonogramu
  - Krok 2: I-2 — `reopened_at` na zadaniu fazy projektu, nie na rekordzie (`ps_schedules.reopened_at` I-2 bez zmian); projekt P-Y z flagą deala (TC-PD-PRJ-015)
  - Krok 3: nic nie jest usuwane ani archiwizowane (bez kaskady); zadania, daty i baseline bez zmian
  - Krok 4: deal nie jest odtwarzany (D35); harmonogram bez zmian
  - Krok 5: event `project_schedule.schedule.deal_restored` dla I-1 i I-2; flagi zostają (bez automatycznego czyszczenia)
  - Krok 6: U-R → `403 FORBIDDEN`, flagi zostają; U-E bez powodu → flaga I-1 (rekord) i I-2 (zadanie fazy) = NULL (powód nie jest wymagany), wpisy w `audit_logs` z autorem U-E
  - Krok 7: po przywróceniu flaga I-3 zostaje; po `won` czyszczona automatycznie (D140 bez zmian)
  - Event `customers`, którym przychodzi przywrócenie deala — do potwierdzenia na etapie kodu (D188); krok 5 sprawdza wyłącznie skutek w module harmonogramu

---

## 16. Scenariusze testowe: Bezpieczeństwo plików (TC-SEC) — 6 TC

XLSX/zip bomb, ogromne arkusze, formula injection, makra, MIME spoofing, timeouty.

#### TC-SEC-001: XLSX bomb / zip bomb — wysoki współczynnik kompresji

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: VPS 3.8 GiB RAM; plik XLSX (zip bomb) o rozmiarze 100 kB skompresowanym, >500 MB po rozwinięciu
- **Kroki**:
  1. Prześlij plik przez endpoint importu
  2. Monit: RAM, czas odpowiedzi
- **Oczekiwane wyniki**:
  - Odrzucenie PRZED pełnym rozpakowaniem (sprawdzenie proporcji zip: compressed/uncompressed ratio)
  - Limit: jeśli uncompressed > X MB (np. 200 MB), odrzuć z kodem 413 i komunikatem "Plik zbyt duży po rozpakowaniu"
  - RAM VPS nie przekracza 80% (3 GiB)
  - Timeout: max 30s dla całego procesu importu
  - Brak crash serwera; inne żądania obsługiwane normalnie

#### TC-SEC-002: Ogromne arkusze — miliony komórek, tysiące kolumn

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: XLSX z 1 000 000 wierszy × 10 kolumn; XLSX z 100 wierszy × 5000 kolumn
- **Kroki**:
  1. Import pliku 1M wierszy
  2. Import pliku 5000 kolumn
  3. Monit: RAM, CPU, czas
- **Oczekiwane wyniki**:
  - 1M wierszy: odrzucenie z komunikatem "Przekroczono limit 100k wierszy" (lub skonfigurowany limit)
  - 5000 kolumn: odrzucenie "Zbyt wiele kolumn (max 500)"
  - Streaming/chunked parsing — nie ładuj całego pliku do pamięci naraz
  - Odpowiedź w < 5s (szybkie odrzucenie, nie pełny parsing)

#### TC-SEC-003: Formula injection w eksporcie — CSV i XLSX

- **Priorytet**: P0 | **Etap**: v1 (eksport) | **Poziom**: Integration
- **Warunki wstępne**: Kalkulacja z pozycją nazwaną `=CMD|'/c calc'!A1` lub `+1+1`
- **Kroki**:
  1. Zapisz pozycję z nazwą `=1+1`, `@SUM(1,2)`, `-2+3*4`, `+CMD` itp.
  2. Eksportuj do CSV
  3. Eksportuj do XLSX
  4. Otwórz w Excelu
- **Oczekiwane wyniki**:
  - CSV eksport: wartości zaczynające się od `=`, `+`, `-`, `@` są poprzedzone apostrofem lub cudzysłowem: `'=1+1`
  - XLSX eksport: komórki ustawione jako Text (nie Formula), Excel nie interpretuje jako formuły
  - Zewnętrzne linki w formulach (`=IMPORTRANGE(...)`) — zawsze zablokowane
  - Test w Excelu: otwarcie pliku bez ostrzeżeń o potencjalnie niebezpiecznych formułach

#### TC-SEC-004: Makra (.xlsm) i zły MIME / rozszerzenie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Plik z rozszerzeniem .xlsm (z makrami); plik .xlsx ale z MIME text/plain; plik .csv z MIME application/octet-stream
- **Kroki**:
  1. Import pliku .xlsm
  2. Import .xlsx z MIME text/html (fałszywy MIME)
  3. Import .csv z rozszerzeniem .xls (mismatch)
- **Oczekiwane wyniki**:
  - .xlsm: odrzucony (422) z komunikatem "Pliki z makrami (.xlsm) nie są obsługiwane"
  - Fałszywy MIME: walidacja po rzeczywistej sygnaturze pliku (magic bytes), nie tylko po MIME headerze
  - Mismatch rozszerzenie/content: ostrzeżenie lub odrzucenie; nie przetwarzaj blindly
  - Brak wykonania makr pod żadnym warunkiem

#### TC-SEC-005: Timeouty i limity pamięci na małym VPS

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Performance + Integration
- **Warunki wstępne**: VPS 3.8 GiB RAM; 3 równoczesne importy dużych plików
- **Kroki**:
  1. Przesyłaj 3 pliki ~5 MB jednocześnie od różnych użytkowników
  2. Monit: RAM całego procesu Node.js, czas odpowiedzi na każde żądanie
  3. Przesyłaj 1 plik 50 MB (graniczna porcja)
- **Oczekiwane wyniki**:
  - 3 importy równoczesne: każdy < 30s; RAM peak < 1 GB (dla importu)
  - Plik 50 MB: odrzucony przed parsowaniem (rozmiar skompresowany > limit)
  - Brak OOM (Out of Memory) — watchdog lub limit pamięci na poziomie procesu
  - Po odrzuceniu/timeoucie: zasoby zwolnione, GC zakończony; kolejne żądania normalne

#### TC-SEC-006: Zewnętrzne linki i SSRF w formulach arkusza

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: XLSX z formulami `=WEBSERVICE("http://internal-api/secret")`, `=IMPORTDATA(...)`, linkami do plików sieciowych
- **Kroki**:
  1. Import XLSX zawierającego formuły z zewnętrznymi referencjami
  2. Monit: czy serwer wykonuje jakiekolwiek żądania HTTP podczas parsowania
- **Oczekiwane wyniki**:
  - Parser arkuszy traktuje formuły jako tekst (wartości statyczne), nie oblicza ich
  - Zero wychodzących żądań HTTP z serwera podczas importu
  - Wartości z komórek: zapamiętana wartość obliczona (cached value z XLSX), nie re-evaluation
  - Logi: brak zewnętrznych połączeń; jeśli parser wymaga sieci — blokada na poziomie OS/firewall

---

## 17. Scenariusze testowe: Izolacja multi-tenant (TC-TEN) — 7 TC

API cross-tenant, wyszukiwanie inwestycji, eksport, PDF, webhooki, cenniki cross-deal, niezależne ustawienia organizacji w jednym tenancie.

#### TC-TEN-001: API — cudze ID kalkulacji w ścieżce → 404

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API
- **Warunki wstępne**: Firma A (organizacja A), Firma B (organizacja B); kalkulacja `calc-B-123` należy do Firmy B
- **Kroki**:
  1. Zaloguj się jako użytkownik Firmy A
  2. Przez API kalkulacji odczytaj (GET) kalkulację `calc-B-123`
  3. Przez API kalkulacji zapisz (PUT) kalkulację `calc-B-123` z ciałem kalkulacji
  4. Przez API kalkulacji usuń (DELETE) kalkulację `calc-B-123`
- **Oczekiwane wyniki**:
  - GET, PUT, DELETE: 404 (nie ujawniać, że zasób istnieje pod inną organizacją)
  - Brak 403 (to ujawniłoby istnienie zasobu) — konsekwentnie 404
  - Logi serwera: wpis "cross-tenant access attempt: user org_A, resource org_B"
  - Test odporny na enumeration: sekwencyjne UUIDs nie ujawniają ID innych firm

#### TC-TEN-002: Cudze ID w ciele żądania POST/PUT

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API
- **Warunki wstępne**: Jak wyżej; deal `deal-B-456` należy do Firmy B
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. Przez API kalkulacji utwórz (POST) kalkulację z body `{"deal_id": "deal-B-456", "name": "Atak"}`
  3. Przez API kalkulacji zapisz (PUT) kalkulację `calc-A-789` z body `{"organization_id": "org-B"}` (próba zmiany właściciela)
- **Oczekiwane wyniki**:
  - POST z obcym deal_id: 404 lub 422 "Deal not found" (deal z org B nie widoczny dla org A)
  - PUT próba zmiany organization_id: pole ignorowane lub 422 "Cannot change organization"
  - `organization_id` zawsze pochodzi z tokenu sesji, nie z body — nadpisanie niemożliwe

#### TC-TEN-003: Wyszukiwanie i dopasowanie inwestycji — izolacja cross-tenant

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja "Hala A" istnieje w Firmie A i w Firmie B (przypadkowa zbieżność nazwy)
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. Wyszukaj inwestycje: wyszukiwarką inwestycji (API) fraza „Hala”
  3. Podpięcie identyfikatora e-Zamówienia współdzielonego przez obie firmy
- **Oczekiwane wyniki**:
  - Wyniki wyszukiwania: tylko inwestycje Firmy A (zero z Firmy B — mimo zbieżności nazwy)
  - Dopasowanie po e-Zamówienia ID: wynik zawiera tylko inwestycję Firmy A
  - Brak "podpowiedzi" z danych innej firmy

#### TC-TEN-004: Eksport i PDF — tylko własne dane organizacji

- **Priorytet**: P0 | **Etap**: MVP (PDF) + v1 (eksport XLSX) | **Poziom**: E2E/UI + API
- **Warunki wstępne**: Firma A z 5 kalkulacjami; Firma B z 3 kalkulacjami
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. Eksport XLSX "Wszystkie kalkulacje"
  3. Wygeneruj PDF dla każdego dostępnego zasobu
  4. Eksport listy dealów
- **Oczekiwane wyniki**:
  - XLSX: zawiera dokładnie 5 kalkulacji Firmy A (żadnych z Firmy B)
  - PDF: nagłówek z danymi Firmy A; brak danych Firmy B
  - Brak możliwości "wylistowania" ID z innej organizacji przez masowy eksport

#### TC-TEN-005: Zdarzenia i webhooki — cross-tenant nie emitowane

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Firma A z subskrypcją na webhooki; zdarzenie pochodzi z kalkulacji Firmy B
- **Kroki**:
  1. Firma A: zarejestruj webhook na `calculation.updated`
  2. Użytkownik Firmy B aktualizuje swoją kalkulację
  3. Sprawdź webhooki odebrane przez Firmę A
- **Oczekiwane wyniki**:
  - Firma A nie otrzymuje webhooka z zdarzenia Firmy B
  - Payload webhooka zawiera `organization_id` — zawsze zgodny z organizacją subskrybenta
  - Wewnętrzny bus zdarzeń: zdarzenia scopowane per organizacja; brak "broadcast" cross-tenant

#### TC-TEN-006: ID z tej samej organizacji vs różnego tenanta

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API
- **Warunki wstępne**: Multi-tenant setup: Tenant T1 (Firma A, Firma B) i Tenant T2 (Firma C). Firm A i B dzielą tenanta T1.
- **Kroki**:
  1. Użytkownik Firmy A (Tenant T1): próba dostępu do cennika Firmy B (też T1) przez API
  2. Użytkownik Firmy A (Tenant T1): próba dostępu do zasobu Firmy C (Tenant T2)
- **Oczekiwane wyniki**:
  - Firma B (ten sam tenant, inna organizacja): 404 — izolacja per organization, nie tylko per tenant
  - Firma C (inny tenant): 404 lub 401 — silniejsza izolacja
  - Cenniki: per organizacja (Firma A nie widzi cennika Firmy B nawet przy wspólnym tenancie)
  - Harmonogram cross-deal z innej organizacji: niedostępny

#### TC-TEN-007: Ustawienia dwóch organizacji w jednym tenancie są niezależne

- **Priorytet**: P0 | **Etap**: MVP (zaokrąglenie) + v1 (harmonogram) | **Poziom**: Integration + API
- **Warunki wstępne**: Tenant T1: organizacja A i organizacja B; admin w każdej
- **Kroki**:
  1. A: zaokrąglenie domyślne (2 miejsca); B: inne dozwolone ustawienie zaokrąglenia (np. 0 miejsc)
  2. W obu organizacjach pozycja: ilość 3 × cena 33.335 (wartość surowa 100.005)
  3. (v1) A: harmonogram włączony; B: wyłączony
  4. Admin B zmienia swoje ustawienia; sprawdź ustawienia i wyniki w A
  5. Każdy admin odczytuje ustawienia modułu przez API
- **Oczekiwane wyniki**:
  - Krok 2: A → 100.01; B → wynik wg ustawienia B (przy 0 miejsc: 100)
  - Krok 3: A — menu i API harmonogramu 200; B — 404
  - Krok 4: zmiana w B nie wpływa na ustawienia ani wyniki w A (i odwrotnie)
  - Krok 5: każda organizacja dostaje wyłącznie własne ustawienia, nigdy drugiej, mimo wspólnego tenanta

---

## 18. Scenariusze testowe: Edycja równoległa (TC-CONC) — 5 TC

Optimistic locking, wyścig zamrożenia wersji, równoległe zmiany oferty głównej, import.

#### TC-CONC-001: Dwóch użytkowników edytuje tę samą kalkulację jednocześnie

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + E2E
- **Warunki wstępne**: Kalkulacja K1 z wersją updatedAt=T0; zalogowani Użytkownik A i Użytkownik B
- **Kroki**:
  1. Użytkownik A otwiera K1 (widzi K1 @ T0)
  2. Użytkownik B otwiera K1 (widzi K1 @ T0)
  3. Użytkownik A zmienia Pozycja P1: cena 100 → 200, zapisuje (K1 @ T1)
  4. Użytkownik B (nadal z K1 @ T0) zmienia Pozycja P2: ilość 5 → 10, próbuje zapisać
- **Oczekiwane wyniki**:
  - Krok 3: Użytkownik A → 200 OK; K1.updatedAt = T1
  - Krok 4: Użytkownik B → 409 Conflict z komunikatem "Kalkulacja została zmodyfikowana przez innego użytkownika. Odśwież i spróbuj ponownie."
  - Brak cichego nadpisania zmian Użytkownika A
  - K1 po konflikcie: zawiera zmiany Użytkownika A (P1 = 200), P2 = 5 (niezmienione)
  - Użytkownik B widzi odświeżony formularz z aktualnym stanem i może ponowić edycję

#### TC-CONC-002: Optimistic locking — konflikt → 409 + szczegółowy komunikat

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API
- **Warunki wstępne**: Kalkulacja K2 z updatedAt=T0
- **Kroki**:
  1. Przez API kalkulacji odczytaj K2 → odpowiedź zawiera `updatedAt: T0`
  2. Przez API kalkulacji zapisz K2 z nagłówkiem `If-Unmodified-Since: T0` i zmienionymi danymi
  3. Niezależnie: inny klient zapisuje K2 (updatedAt→T1)
  4. PUT z `If-Unmodified-Since: T0` ponownie
- **Oczekiwane wyniki**:
  - Krok 2 (przed zmianą przez inny klient): 200 OK
  - Krok 4 (po zmianie): 409 Conflict z body `{"error": "conflict", "currentUpdatedAt": "T1"}`
  - Brak utraty danych: rekord zawiera ostatnią poprawną wersję
  - Klient może: odczytać aktualny stan (GET), scalić i ponowić PUT z nowym `If-Unmodified-Since: T1`

#### TC-CONC-003: Wyścig zamrożenia wersji — wysłanie podczas edycji

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Wersja V1.0 w stanie "Robocza"; Użytkownik A edytuje, Użytkownik B wysyła
- **Kroki**:
  1. Użytkownik A otwiera V1.0 (Robocza)
  2. Użytkownik B klika "Wyślij" na V1.0 → status zmienia się na "Wysłana", V1.0 zamrożona
  3. Użytkownik A (nie wiedząc o zmianie) zmienia cenę i klika "Zapisz"
- **Oczekiwane wyniki**:
  - Krok 3: 409 Conflict lub 422 "Wersja jest już wysłana i nie może być edytowana"
  - Brak nadpisania zamrożonej wersji
  - Użytkownik A widzi komunikat: "Wersja V1.0 została wysłana przez innego użytkownika. Utwórz nową wersję, aby kontynuować."
  - Od v1: akcja „Nowa rewizja” dostępna od razu w komunikacie błędu (TC-VER-004)

#### TC-CONC-004: Równoległe przełączanie oferty głównej

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja I1; aktualnie oferta główna = Deal A; Użytkownik A i Użytkownik B jednocześnie próbują zmienić ofertę główną
- **Kroki**:
  1. Użytkownik A: zmienia ofertę główną na Deal B (przez API inwestycji: wskazanie oferty głównej I1 = Deal B)
  2. Użytkownik B: jednocześnie zmienia na Deal C (PUT `.../primary-deal`, body `{dealId: "C"}`)
  3. Oba żądania docierają do serwera prawie jednocześnie
- **Oczekiwane wyniki**:
  - Jedno żądanie wygrywa (serialized): inwestycja ma jedną ofertę główną
  - Drugie żądanie: 409 Conflict lub wymusza potwierdzenie ("Oferta główna właśnie zmieniona na B. Nadpisać na C?")
  - Brak stanu inconsistentnego: nigdy dwie oferty główne jednocześnie (baza gwarantuje najwyżej jedną ofertę główną na inwestycję; asercja przez `pg`)
  - Audit trail: dwa wpisy (zmiana A→B, i opcjonalne B→C)

#### TC-CONC-005: Równoległy import XLSX — dwa importy tej samej kalkulacji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Kalkulacja K3 (Robocza); Użytkownik A i B importują różne XLSX do tej samej kalkulacji jednocześnie
- **Kroki**:
  1. Użytkownik A importuje Plik A (10 wierszy) do K3
  2. Użytkownik B importuje Plik B (8 wierszy) do K3 jednocześnie
  3. Oba importy kończą się
- **Oczekiwane wyniki**:
  - Brak interleaving danych (wiersze z Pliku A i B nie przeplatają się losowo)
  - Jeden import blokuje drugi (mutex/lock na czas importu) LUB import drugi dostaje 409 "Import w toku"
  - Finalny stan K3: spójny (wszystkie wiersze jednego importu, nie mix)
  - Komunikat dla drugiego użytkownika: "Import kalkulacji jest już w toku. Spróbuj za chwilę."

---

## 19. Zbiory danych testowych (Fixtures)

| Typ | Opis | Ilość |
|-----|------|-------|
| **Organizacje** | 3 firmy (A, B, C), różne konfiguracje ról, uprawnień, walut, modułów | 3 |
| **Użytkownicy** | superadmin, admin i employee w organizacjach A i B + użytkownicy ról własnych tworzonych per test (`createRoleFixture`/`createUserFixture`) z wybranymi feature'ami (np. R1–R4 ze scenariuszy uprawnień, R z `lock` bez `view_margin`) | 8 |
| **Deale** | 5 dealów: otwarte, wygrane i przegrane (`closure_outcome`), ponownie otwarte | 5 |
| **Projekty/Inwestycje** | 3 inwestycje (Hala A, Kompleks, Łącznica) z różnymi ID (e-Zamówienia, TED, BIP) | 3 |
| **Kalkulacje** | 12 kalkulacji (różne statusy, wersje, ceny, marże, jednostki, waluty) | 12 |
| **Cenniki** | 1 prosty cennik (MVP) + 1 cennik z regułami warstwowymi (v1) | 2 |
| **Stara encja projektu** | Rekordy Data Designera z identyfikatorami e-Zamówienia, TED, BIP i bez identyfikatora, powiązane z dealami (import CLI) | 5 |
| **Ustawienia modułu** | 2 organizacje w jednym tenancie z różnym zaokrągleniem i włączeniem harmonogramu | 2 |
| **XLSX/CSV testowe** | 15 plików (poprawne, złe kodowanie, brak kolumn, separator ;, duże, XLSX bomb, formula injection, .xlsm) | 15 |
| **Harmonogramy** | 4 harmonogramy inwestycji (faza ofertowa, faza wykonawcza, z cyklem, 300+ zadań) + 2 harmonogramy XLSX z polskiego Excela (dla firm bez Gantta) | 6 |
| **Koszty rzeczywiste** | 20 wpisów kosztów (różne kategorie, daty, kwoty) | 20 |
| **Kursy walut** | Moduł Waluty: waluty aktywne i nieaktywne (PLN bazowa, EUR, USD, JPY 0 miejsc, KWD 3 miejsca, CHF, CNH bez kursu), organizacja bez waluty bazowej; tabele A NBP (kursy przykładowe), w tym weekend i święto; podstawiane w teście bez ruchu sieciowego | 16 rekordów |
| **Partie produkcji** | 30 partii dla testu prognozy (różne jednostki, daty, prawdopodobieństwa) | 30 |
| **Zdarzenia customers.deal.won** | Duplikaty i sekwencje dla testu idempotentności | 5 zdarzeń |

---

## 20. Poziomy testów — mapowanie do narzędzi

### Unit (Jest — `__tests__` modułu)

- **Ścieżka**: `apps/mercato/src/modules/<moduł>/__tests__/*.test.ts` (dopasowanie `testMatch` z `apps/mercato/jest.config.cjs`)
- Testy arytmetyki: zaokrąglenia (TC-COST-003), dzielenie (TC-COST-004), narzuty (TC-COST-009), marża (TC-COST-014), zaokrąglenia per waluta (TC-CUR-003)
- Validatory zod: schema kalkulacji, cennika, kosztu
- Parser importu: parsowanie XLSX/CSV, kodowania, separatory, konwersje jednostek
- Auto-planowanie harmonogramu: konwencja dat, przesuwanie następników tylko w przód, kamień milowy, wykrywanie cykli (TC-GANTT-002, -003, -005, -009; logika czysta, bez UI)
- Reguły wysłania: blokady i ostrzeżenia (TC-VER-008)
- Prognoza produkcji: agregacja partii, ważenie prawdopodobieństwem, horyzont
- **Komenda**: `yarn test` (wszystkie pakiety przez turbo) lub `yarn workspace @open-mercato/app test src/modules/<moduł>/__tests__` (tylko moduł)

### Integration / API / E2E/UI (Playwright — `__integration__` modułu)

- **Ścieżka**: `apps/mercato/src/modules/<moduł>/__integration__/TC-<ID>.spec.ts`, np. `apps/mercato/src/modules/project_costing/__integration__/TC-COST-021.spec.ts`; wzorzec: `packages/core/src/modules/sync_excel/__integration__/` (TC-SX-001..008 + `helpers/` + `meta.ts`)
- **Discovery**: `.ai/qa/tests/playwright.config.ts` automatycznie zbiera specy z folderów `__integration__` modułów; `.ai/qa/tests` zawiera tylko współdzielony config
- **Warstwa danych (Integration)**: powiązania deal/inwestycja i import CLI (TC-DEAL-*), import/eksport (TC-IMP-*), wersje (TC-VER-*), cenniki (TC-PRICE-*), prognoza (TC-FCST-*), harmonogram wykonawczy (TC-EXEC-*), bezpieczeństwo plików (TC-SEC-*), edycja równoległa (TC-CONC-*) — setup i asercje przez API (`getAuthToken`, `apiRequest`), w razie potrzeby bezpośrednio na DB (`pg`) i kolejce (`drainIntegrationQueue`)
- **Warstwa kontraktu HTTP (API)**: CRUD kalkulacji, filtrowanie multi-tenant (`organization_id`, TC-TEN-*, TC-PERM-005), ukrywanie marży/kosztu w odpowiedziach, kody błędów (400, `403 FORBIDDEN`, 404, 409 concurrent edit)
- **Warstwa UI (E2E/UI)**: siatka kalkulacji (TC-COST-021, TC-COST-022, TC-COST-024), drag-drop Gantta (TC-GANTT-001), kreator mapowania importu (TC-IMP-001), generowanie i pobranie PDF (TC-VER-006, TC-PERM-007) — logowanie przez `@open-mercato/core/helpers/integration/auth`
- **Komendy** (z `package.json` w root):
  - `yarn test:integration` — Playwright na działającym dev serverze (`BASE_URL`, domyślnie `http://localhost:3000`)
  - `yarn test:integration:ephemeral` — pełny przebieg w izolowanym środowisku ephemeral (Docker, bez dev servera)
  - `yarn test:integration:ephemeral:interactive` — jedno środowisko, wielokrotne uruchamianie wybranych specy
  - pojedynczy plik: `npx playwright test --config .ai/qa/tests/playwright.config.ts <ścieżka-do-spec>`
  - tylko wybrane moduły: zmienna `OM_INTEGRATION_MODULES=<moduł>[,<moduł>]`
  - raport: `yarn test:integration:report`

### Performance (Custom bash / Node.js profiling)

- Import dużych plików (TC-PERF-001)
- Render Gantta (TC-PERF-002)
- Concurrency API (TC-PERF-003)
- **Komenda**: `yarn dev:profile` + monit RAM/CPU

---

## 21. Kryteria akceptacji

### Wejścia

- [x] Wymagania biznesowe zdefiniowane (Marek)
- [x] Infrastruktura testowa dostępna (Jest, Playwright)
- [ ] Specyfikacja techniczna finalna (oczekiwanie na feedback z tego planu)

### Wyjścia / Miary sukcesu

| Kryterium | Wymaganie | Status |
|-----------|-----------|--------|
| **Pokrycie P0 scenariuszy** | 100% (TC-COST-003, TC-COST-004, TC-COST-021, TC-DEAL-004, TC-DEAL-011, TC-DEAL-013, TC-DEAL-014, TC-VER-003, TC-VER-006, TC-VER-007, TC-VER-008, TC-VER-009, TC-PERM-001, TC-PERM-002, TC-PERM-005, TC-PERM-010, TC-PERM-012, TC-PERM-007, TC-SEC-001, TC-SEC-002, TC-SEC-003, TC-CONC-001, TC-CONC-002, TC-CONC-003, TC-TEN-001, TC-TEN-002, TC-TEN-003, TC-TEN-004, TC-TEN-007, TC-EXEC-001, TC-EXEC-002, TC-FCST-006, TC-NOSCHED-002) | TBD |
| **Multi-tenant izolacja** | Brak przecieków danych przez API, eksport, PDF, webhooki (TC-PERM-005, TC-TEN-001 do TC-TEN-007) | TBD |
| **Budżety wydajności** | Import < 10s, Gantt render < 3s, API < 500ms (TC-PERF-*) | TBD |
| **Budżety bezpieczeństwa plików** | Zip bomb odrzucony < 5s, RAM import < 1 GB, brak SSRF (TC-SEC-001 do TC-SEC-006) | TBD |
| **Arytmetyka finansowa** | Zaokrąglenia half-up do 2 miejsc (1,005 → 1,01), suma z pozycji zaokrąglonych, ustawienie per organizacja; marża = (cena − koszt) / cena; jednostki ze słownika, w MVP jednostka pozycji = jednostka ceny (TC-COST-*) | TBD |
| **Poprawność walutowa** | MVP: waluta deala, waluta bazowa bez kursu, kurs z tabeli A NBP zamrożony, liczba miejsc z modułu Waluty, kurs ręczny tylko w wersji roboczej i poza tabelą kursów, błędy braku waluty bazowej, nieaktywnej waluty i braku kursu, waluta bez kursu w żadnej tabeli odrzucana (TC-CUR-012), kurs znajdowany dla daty zapisu (TC-CUR-001 do TC-CUR-012); v1: waluty per pozycja i waluta pozycji bez kursu odrzucana (TC-CUR-013, TC-CUR-014) | TBD |
| **Edycja równoległa** | Optimistic locking 409 + brak utraty danych (TC-CONC-001 do TC-CONC-005) | TBD |
| **Integracja z dealami/inwestycjami** | Wartość deala tylko jawnym przyciskiem z aktywnej wersji, z historią i cofnięciem (TC-VER-007, TC-DEAL-002); wartość z kalkulacji nie jest nadpisywana przez n8n (TC-DEAL-016); oferta główna, pierwsza oferta główna (TC-DEAL-004, TC-DEAL-011) | TBD |
| **Wysłanie oferty** | Blokady z kodem i komunikatem, ostrzeżenia z potwierdzeniem, brak deala nie blokuje; blokada ujemnej marży dla roli bez wglądu w marżę bez ujawnienia znaku (TC-VER-008, TC-VER-009) | TBD |
| **Migracja inwestycji** | Przebieg próbny bez zapisów, import idempotentny, przeniesienie ról z n8n (TC-DEAL-013 do TC-DEAL-015) | TBD |
| **Audyt** | Pola wrażliwe bez wartości, pola jawne ze starą i nową wartością (TC-VER-011, TC-PERM-002) | TBD |
| **Obsługa XLSX/CSV (MVP)** | Import XLSX w MVP: kodowania, separatory, „1 234,56”, scalone komórki, formuły bez wartości, wiele arkuszy, `ProgressJob` (TC-IMP-001..007), bezpieczeństwo (TC-SEC-*) | TBD |
| **Komunikat duplikatu oferty** | Dokładnie „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna” przy zapisie oferty do innego wykonawcy na tę samą inwestycję (TC-DEAL-003, TC-DEAL-005) | TBD |
| **Pokrycie tras API** | Każda trasa API ma test Playwright w `__integration__` w tej samej zmianie | TBD |
| **Zamrożenie oferty po wysłaniu** | Brak edycji, zamrożony obraz, PDF w tle z danymi firmy z ustawień modułu, kurs zamrożony (TC-VER-*, TC-CUR-002) | TBD |
| **Harmonogram wykonawczy** | Jeden rekord na inwestycję z fazą, przejście automatyczne i idempotentne, baseline, oznaczenie ponownego otwarcia bez usuwania (TC-EXEC-001 do TC-EXEC-005, TC-GANTT-008) | TBD |
| **Firma bez modułu harmonogramu** | Kalkulacja i prognoza działają; API 404, brak menu, zakładki i widgetu; wyłączenie nie usuwa danych (TC-NOSCHED-*) | TBD |

---

## 22. Wnioski do specyfikacji (Luki i niejasności)

**Liczba wniosków**: 25 (20 z rev 2 + 5 nowych w rev 5)

### Priorytet 1 (Musi być w spec przed kodem)

1. **Standard zaokrąglenia** (TC-COST-003, TC-COST-014) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja (2026-10-19)**: half-up do 2 miejsc po przecinku per linia; sumy = suma już-zaokrąglonych linii (nie zaokrąglona suma surowa); tryb zaokrąglania konfigurowalny per firma. Np.: linia 1.005 → 1.01.
   - ~~**Rekomendacja**: Math.round() (IEEE 754) + test cases z konkretnymi przykładami~~ **ODRZUCONE**: `Math.round()` zaokrągla 0.5 w dół dla ujemnych (np. -0.5 → 0), co jest mylące biznesowo. Używamy jawnego `half-up` niezależnie od `Math.round` semantyki JS.

2. **Jednostki i konwersje** (TC-COST-007, TC-COST-023) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
   - **Decyzja**: Słownik jednostek per organizacja. W MVP jednostka pozycji musi być taka sama jak jednostka ceny (inaczej błąd walidacji); przeliczniki od v1.

3. **Definicja marży** (TC-COST-014) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Marża = % od ceny sprzedaży: `(Cena - Koszt) / Cena × 100%`. Narzut (markup) = `(Cena - Koszt) / Koszt × 100%` — wyłącznie jako widok pomocniczy.

4. **Multi-tenant mapping** (TC-PERM-005) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Firma = organizacja OM (`organization`); filter `organization_id` na poziomie DB (Awilix scoped payload).

5. **Priorytet źródeł ID inwestycji** (TC-DEAL-008) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: e-Zamówienia (BZP/postępowanie/plan) > TED > BIP > własny kod INV > fallback nazwa+NIP (tylko podpowiedź, zawsze wymaga potwierdzenia użytkownika).

### Priorytet 2 (Ważne, ale można mieć domyślne)

6. **Marża po zamknięciu deala** (TC-PERM-006) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
   - **Decyzja**: Od v1, wyłącznie przez feature `project_costing.view_margin_after_close` (po wygraniu lub przegraniu deala); bez osobnego ustawienia organizacji. W MVP o widoczności marży decyduje tylko `project_costing.view_margin`.
   - ~~Ustawienie per firma~~ **ZASTĄPIONE**: widoczność wynika wyłącznie z feature'ów ról.

7. **Trigger harmonogramu ofertowego → wykonawczego** (TC-GANTT-008, TC-EXEC-001) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
   - **Decyzja**: Jeden harmonogram na inwestycję (rekord z fazą); przy wygraniu deala (`customers.deal.won`, subscriber `persistent: true`) przechodzi automatycznie i idempotentnie w fazę wykonawczą. Etap v1.

8. **Lista pól do audytu** (TC-VER-011) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
   - **Decyzja**: Zapis komendą z undo trafia do `audit_logs`. Pola wrażliwe (koszt jednostkowy, narzuty, docelowa marża) — tylko nazwa pola, bez wartości; pozostałe pola ze starą i nową wartością.

9. **Limity rozmiaru pliku i wierszy** (TC-IMP-006, TC-PERF-001, TC-SEC-001)
   - **Otwarte**: Max 5 MB? 5000 wierszy?
   - **Rekomendacja**: 10 MB / 10k wierszy z komunikatem; odrzucenie ≥ 100 MB; streaming dla dużych plików; timeout import = 30s

10. **Definicja „błędnego wiersza” w imporcie** (TC-IMP-005) — **CZĘŚCIOWO ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Wersja z nierozwiązanymi błędami importu nie może zostać wysłana (TC-VER-008). Otwarte: które braki to błąd, a które ostrzeżenie.

### Priorytet 3 (Uwagi/sugestie)

11. **Notacja narzutu** — "30% narzutu" = ×1.30 czy +0.30?
    - **Otwarte** → **Rekomendacja**: Zawsze ×(1 + narzut%), czyli 30% = ×1.30

12. **Prognoza produkcji** — jak waży prawdopodobieństwo? (TC-FCST-004)
    - **Otwarte**: Ilość = sum(partii) czy sum(partii × probability)?
    - **Rekomendacja**: Obie metryki: niezważona (partii) i ważona; suma ważona ≠ suma partii jeśli prob < 100%

13. **Widoczność kosztów w API vs UI**
    - **Otwarte**: Czy API zawsze filtruje czy tylko UI?
    - **Rekomendacja**: API zawsze filtruje (backend security, nie client-side); TC-TEN-001 to weryfikuje

14. **Cena zero** (TC-COST-006) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Dozwolona; przy wysłaniu ostrzeżenie z potwierdzeniem; marża % przy cenie 0 wyświetlana jako „—”. Cena ujemna blokuje wysłanie (TC-COST-018).

15. **Gotowość Sekocenbud/Intercenbud** — architektura mapowania kodów
    - **Otwarte**: Gdzie przechowywać mapping?
    - **Rekomendacja**: Osobny moduł integrations, mapowanie per-firma

### Nowe wnioski (rev 2)

16. **Zaokrąglenia per waluta** (TC-CUR-003) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Liczba miejsc z ustawień waluty w module Waluty; ISO 4217 jako zapas.

17. **Zamrożenie kursu w wysłanej wersji** (TC-CUR-002, TC-CUR-006, TC-CUR-007) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Gdy waluta kalkulacji ≠ bazowa: kurs średni z tabeli A NBP z dnia wysłania, zamrożony w wersji; w dzień bez tabeli ostatnia opublikowana tabela; ręczna korekta dozwolona przed wysłaniem, po wysłaniu zablokowana.

18. **Idempotentność harmonogramu wykonawczego** (TC-EXEC-002) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Unikalność jednego harmonogramu na inwestycję; powtórne zdarzenie won = brak zmian (no-op z logiem).

19. **Zachowanie harmonogramu przy ponownym otwarciu deala** (TC-EXEC-003) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Harmonogram nie jest usuwany; dostaje oznaczenie ponownego otwarcia; ponowne wygranie nie tworzy duplikatu.

20. **Limity antybombowe na VPS** (TC-SEC-001, TC-SEC-002)
    - **Otwarte**: Max expanded size w MB? Max liczba wierszy w arkuszu?
    - **Rekomendacja**: Limit przed rozpakowaniem: 50 MB; po: 200 MB; wiersze: 100k; kolumny: 500; timeout: 30s

### Nowe wnioski (rev 5)

21. **Cofnięcie zmiany kosztu** (TC-VER-012) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Undo komendy na wersji roboczej; bez prawa do pola kosztu `403 FORBIDDEN` i brak wartości w API, historii, wyszukiwarce i zdarzeniach; po wysłaniu niedostępne.

22. **Zależność SF** (TC-GANTT-002, krok 6) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: Przy końcu wliczonym następnik kończy się najpóźniej dzień przed startem poprzednika + lag.

23. **Waluty inne niż PLN** (TC-CUR-002..013) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: MVP jedna waluta na kalkulację = waluta deala, v1 waluta per pozycja; waluty i kursy z modułu Waluty platformy.

24. **Etap dashboardu rankingu marż** (TC-PERM-008) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: v1.

25. **Etap scalania i podziału inwestycji** (TC-DEAL-009, TC-DEAL-010) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: oba v1. Przy rozdzieleniu użytkownik wybiera ofertę główną (domyślnie oryginał); jedna oferta główna na inwestycję, próba dwóch daje ten sam komunikat co przy duplikacie oferty.

### Nowe wnioski (rev 7)

26. **Aktywne waluty bez kursu w żadnej tabeli NBP** (TC-CUR-012, TC-CUR-014) — ✅ **ROZSTRZYGNIĘTE (Koordynator 2026-10-23)**
    - **Decyzja**: waluty zostają aktywne (CNY i CNH); waluta bez kursu w żadnej tabeli NBP nie może być walutą oferty ani pozycji — 422 z czytelnym komunikatem, kurs ręczny tego nie zmienia; CNY działa po włączeniu pobierania kursów z tabeli A.

27. **Kurs zapisany dla daty nie jest znajdowany dla tej samej daty** (TC-CUR-011) — opisane w specyfikacji kalkulacji (ryzyko daty kursu; konwencja daty wysłania w Europe/Warsaw; wyszukiwanie modułu Waluty o 00:00–02:00 latem i 00:00–01:00 zimą widzi dzień poprzedni); scenariusz regresyjny P0.

### Nowe wnioski (rev 9 — D185, D187, D188, D189, D190; reguł brak w rejestrze @730b77d, nie zgadywano; rozstrzygnięcia rev 9a z rejestru @49384e6)

28. ~~**Znaczenie etapu `rejected`**~~ — ✅ **ROZSTRZYGNIĘTE (D192 @0bff741; D185, D191)**: powód wymagany (422 `REASON_REQUIRED`), wynik z tabeli mapującej (`lost` → `closureOutcome = lost`, `no_result` → NULL), „Oznacz jako przegrany” tylko z powodem `lost` (422 `INVALID_LOSS_REASON`), seed bez duplikatów; prognoza i suma inwestycji bez `rejected`. TC: TC-DEAL-018 kroki 5–6, TC-FCST-007 krok 5, TC-DEAL-023 do TC-DEAL-027. Reguła metryk skuteczności — bez TC (D192).
29. **Status inwestycji — kody i archiwizacja** (TC-DEAL-019) — ✅ prawie w całości (D187, zmiana 2026-10-31 @fa3c15d): archiwizuje i przywraca użytkownik z `project_costing.manage_investments`, bez niego 403 `FORBIDDEN`; podpięcie deala do `archived` → 422 `INVESTMENT_ARCHIVED`; CHECK na listę wartości fazy. Otwarte: kod błędu edycji inwestycji `archived`.
30. **Skutki merge inwestycji (luka L3)** (TC-DEAL-009, TC-DEAL-019) — skutki dla ofert (primary, D51, D65), projektu (D116) i harmonogramu (D23) nierozstrzygnięte do v1. TC-DEAL-009 nie jest unieważniony (nie ma asercji o ofertach, projekcie i harmonogramie), ale po decyzji wymaga uzupełnienia.
31. **Właściciel przy zakładaniu automatycznym** (TC-DEAL-020) — częściowo ✅ (D190 @49384e6): klucz API z użytkownikiem → ten użytkownik, bez użytkownika → `created_by = NULL`, szkice i powiadomienia do administratorów; n8n inwestycji nie zakłada (D63). Otwarte: właściciel deala z n8n (Q-ARCH-2); zakres szkiców i powiadomień inwestycji — do rozstrzygnięcia w PR #33 (`crm_followups`).
32. ~~**Przywrócenie usuniętego deala**~~ — ✅ **ROZSTRZYGNIĘTE (D188, zmiana 2026-10-31 @fa3c15d)**: event `project_schedule.schedule.deal_restored`, flaga zostaje; `project_schedule.schedules.reopen_flag_clear` bez `project_schedule.edit` → `403 FORBIDDEN`, bez powodu, wpis w `audit_logs` z autorem; czyszczenie przy `won` bez zmian. Scenariusz: TC-EXEC-006. Do etapu kodu: event `customers` przywrócenia deala.
33. ~~**Format istniejącego klucza bez części**~~ — ✅ **ROZSTRZYGNIĘTE warunkowo (D189 @49384e6)**: `ezamowienia:<tender_id>`, do potwierdzenia przez Enkę przy kodzie. Scenariusz: TC-DEAL-021 krok 3.

### Nowe wnioski (rev 9d — D193; reguł brak w rejestrze @0be9356, nie zgadywano)

34. ~~**Kod błędu walidacji ustawienia `crm.n8n_default_deal_owner_user_id`**~~ — ✅ **ROZSTRZYGNIĘTE (D193 @32bf708, Q-LR-1)**: 422 `INVALID_SETTING_VALUE` (TC-DEAL-022 krok 2).
35. ~~**Rozpoznanie „klucza API integracji n8n”**~~ — ✅ **ROZSTRZYGNIĘTE (D193 @32bf708, Q-LR-2; @fe7a2c2, Q-LR-9)**: lista `crm.n8n_api_key_ids`, bez nazwy i feature'a (TC-DEAL-034); walidacja listy — UUID istniejącego, nieodwołanego klucza organizacji (TC-DEAL-035).

### Nowe wnioski (rev 9e — D192, D185 rev 4d; reguł brak w rejestrze @0bff741, nie zgadywano)

36. ~~**Oferta główna na `rejected`**~~ — ✅ **ROZSTRZYGNIĘTE (D185 @32bf708, Q-LR-3)**: rola `primary` zostaje jako historia, widget i suma pomijają deal, status „odrzucony” (TC-DEAL-030).
37. ~~**„Oznacz jako przegrany” bez powodu**~~ — ✅ **ROZSTRZYGNIĘTE (D192, zmiana 2026-10-31 @cdf27dc)**: każda komenda z `closureOutcome = lost` (także ze `status = lost`) bez powodu → 422 `REASON_REQUIRED` (TC-DEAL-028).
38. ~~**Ścieżka masowa z powodem i raport błędów**~~ — ✅ **ROZSTRZYGNIĘTE (D192 @cdf27dc i @32bf708, Q-LR-4)**: `failedItems` per deal (TC-DEAL-029); zmiana powodu na `rejected` przelicza wynik, wyjście z `rejected` czyści wynik i powód (TC-DEAL-031).

### Nowe wnioski (rev 9h — reguły z polecenia rundy spoza rejestru @32bf708)

39. ~~**Reguły realizacji `crm_deal_rules` bez wiersza w rejestrze**~~ — ✅ **ROZSTRZYGNIĘTE (D192 pkt (9)–(15) i D193, doprecyzowania 2026-10-31 — reguły realizacji z Q-LR-2, Q-LR-4, Q-LR-5, PR #38)**: reguły zarejestrowane 1:1 ze speką realizacji; oznaczenia w TC zastąpione odesłaniami do D192/D193 (rev 9j, meta). Pierwotna treść wniosku: (TC-DEAL-027 kroki 2, 4, 5; TC-DEAL-031 krok 3; TC-DEAL-032 krok 3; TC-DEAL-033; TC-DEAL-034 krok 3) — okno przy zmianie etapu na stronie szczegółów, trasa `POST /api/crm-deal-rules/deals/bulk-reject` z `failedItems`, anulowanie okna = brak zapisu, nagłówek `x-cdr-loss-reason-id` wygrywa z body, `GET /api/crm-deal-rules/loss-reasons?mode=rejected|lost`, `loss_notes` zostają przy wyjściu z `rejected`, feature `crm_deal_rules.settings.manage`. Źródło: polecenie rundy (speka realizacji §6), sesja planu speki nie czytała. Do promocji do rejestru (wzorzec D166) albo potwierdzenia przez Cezara; do tego czasu asercje oznaczone w TC.
---

## 23. Podsumowanie

**Dokument**: Niezależny plan testów — spec only
**Liczba scenariuszy**: 164 (rev 9i: +2; rev 9h: +5; rev 9g: +2; rev 9e: +5; rev 9d: +1; rev 9c: +1; rev 9: +5; rev 8b: +1; runda rev 8h: +1; rev 7: +6; rev 6: +1; rev 5: +25; rev 2–4: 109; rev 1: 72)
**Liczba wniosków do speki**: 39 (15 oryginalnych + 5 z rev 2 + 5 z rev 5 + 2 z rev 7 + 6 z rev 9 + 2 z rev 9d + 3 z rev 9e + 1 z rev 9h)
**Status**: SPEC ONLY — bez kodu, bez testów wykonywalnych

**Kolejne kroki**:
1. Sprecyzować odpowiedzi na otwarte wnioski (9, 10, 11, 12, 13, 15, 20–25, 30, 31, 39 w sekcji 22; 29 i 31 częściowo rozstrzygnięte)
2. Zatwierdzić dokument (review przez Marka + PO)
3. Przejść do fazy implementacji

---

## Załącznik: Traceability TC → D

Źródło: `.ai/decisions.md`@b544719 (develop_OM_CRM) — 73 aktywne decyzje, w tym D75–D82 i poprawiona D71. D83: `.ai/decisions.md`@3f00542 (develop_OM_CRM, merge PR #14), rozstrzygnięte przez Koordynatora 2026-10-23. D84–D94: `.ai/decisions.md`@0f0c6aa (develop_OM_CRM, merge PR #16; Rozstrzygnięte przez Koordynatora 2026-10-23, audyt om-overlap-audit §3–4). D95–D97: `.ai/decisions.md` z tego PR (Rozstrzygnięte przez Koordynatora 2026-10-23; obowiązują po „implementujemy” od Marka); razem 88 aktywnych decyzji w zakresie D1–D97. N/A = decyzja bez zachowania testowanego w tym planie.

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| D1 | Klin #1 — agregator przetargów + CRM budowlany | N/A | decyzja produktowa, bez zachowania modułów do testu |
| D2 | Pierwsza nisza prefabrykacja, rozwiązanie wielosegmentowe | N/A | decyzja produktowa, bez zachowania modułów do testu |
| D4 | n8n pushuje przetargi jako deale (próg score) | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D5 | Duplikat oferty na inwestycji — komunikat | TC-DEAL-003, TC-DEAL-004, TC-DEAL-005 |  |
| D6 | Dopasowanie inwestycji, fallback nazwa+NIP tylko podpowiedź | TC-DEAL-008, TC-DEAL-012 |  |
| D9 | Import XLSX w MVP | TC-COST-021, TC-COST-022, TC-IMP-001..007 |  |
| D10 | Kalkulacja bez deala, podpięcie później | TC-DEAL-001, TC-DEAL-002 |  |
| D11 | PDF oferty w pierwszej wersji | TC-VER-006, TC-PERM-007 | |
| D12 | Własny cennik użytkownika, później cenniki zewnętrzne | TC-PRICE-003, TC-PRICE-005, TC-PRICE-004 | |
| D14 | Marża % od ceny, tryby ceny | TC-COST-013, TC-COST-014, TC-COST-012 |  |
| D15 | Izolacja organizacji | TC-TEN-006, TC-TEN-007 |  |
| D16 | Zaokrąglenie half-up | TC-COST-003, TC-TEN-007 |  |
| D17 | Słownik jednostek | TC-COST-016, TC-COST-007, TC-COST-023 |  |
| D18 | Własny moduł `project_costing` zamiast modułu `sales` | N/A | decyzja architektoniczna, bez zachowania do testu |
| D19 | Firmy bez harmonogramu | TC-NOSCHED-001..005 |  |
| D20 | Ręczne partie i import harmonogramu | TC-NOSCHED-001, TC-NOSCHED-003, TC-FCST-002 |  |
| D21 | Własna implementacja Gantta | TC-GANTT-001 | testowane zachowanie Gantta |
| D22 | Auto-planowanie | TC-GANTT-005, TC-GANTT-006 |  |
| D23 | Harmonogram ofertowy → wykonawczy | TC-GANTT-008 |  |
| D24 | Przejście przy wygraniu deala | TC-EXEC-001, TC-EXEC-002 |  |
| D25 | Import MS Project od v2 | N/A | etap v2, poza planem |
| D26 | Harmonogram wewnętrzny, gotowy na integrację | N/A | bez zachowania do testu |
| D30 | Siatka kalkulacji | TC-COST-024, TC-IMP-007, TC-SEC-006 |  |
| D31 | Przetarg bez części = 1 deal (`tender_id`), kolejne ogłoszenia aktualizują deal; z częściami — osobny deal i inwestycja na część, deale łączy wspólny `tender_notice_number` (D132), kolejne ogłoszenia aktualizują deal danej części | TC-DEAL-016, TC-DEAL-017 | nowa treść (decyzja Marka 2026-10-23, decisions @develop po PR #30); zachowanie n8n testowane w kontrakcie n8n; lookup postępowanie + część — etap kodu (D32, TC-DEAL-016 krok 7) |
| D32 | Idempotencja `om_sync` + hash payloadu; na etapie kodu klucz push postępowanie + część (D31, D132), do tego czasu bez zmian | TC-DEAL-016 (krok 7, etap kodu) | idempotencja testowana w kontrakcie n8n; tu tylko lookup deala części |
| D33 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D34 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D35 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D36 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D37 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D38 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D40 | n8n nie nadpisuje pól ręcznych | TC-DEAL-016 | zachowanie n8n testowane w kontrakcie n8n; tu tylko wartość deala z kalkulacji |
| D41 | Słownik `sales.deal_loss_reason` (9 powodów); seed D192 tylko brakujące wpisy (12 po seedzie); „Oznacz jako przegrany” zawsze `lost`, powody — D192 | TC-DEAL-024, TC-DEAL-026, TC-DEAL-027 | zmiana 2026-10-31 (rev 4c/4d): bez osobnej asercji poza TC D192; rejestr @0bff741 |
| D42 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D44 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D46 | Obszar n8n / integracje | N/A | poza zakresem modułów kalkulacji/harmonogramu, testowane w kontrakcie n8n |
| D45 | Architektura wdrożenia | N/A | decyzja architektoniczna |
| D47 | Harmonogram per organizacja, wyłącznik tenanta | TC-NOSCHED-002, TC-NOSCHED-004, TC-NOSCHED-005 |  |
| D48 | Widoczność przez feature'y ról | TC-PERM-001, TC-PERM-002, TC-PERM-003, TC-PERM-012 |  |
| D49 | Marża odsłania się po zamknięciu deala (wygrany lub przegrany) | TC-PERM-006 | etap v1 (status: active, faza v1); w MVP TC-PERM-010 |
| D50 | Etapy MVP/v1 | TC-COST-019, TC-IMP-001, TC-NOSCHED-001, TC-NOSCHED-003, TC-DEAL-012 | pole „Etap” we wszystkich scenariuszach |
| D51 | Komunikat duplikatu oferty | TC-DEAL-003, TC-DEAL-005, TC-DEAL-010 |  |
| D52 | Import CLI starej encji projektu | TC-DEAL-013, TC-DEAL-014 |  |
| D53 | Jeden harmonogram na inwestycję | TC-GANTT-008 |  |
| D54 | Przesuwanie tylko w przód, przypięte zadania | TC-GANTT-005, TC-GANTT-006 |  |
| D55 | Konwencja dat | TC-GANTT-002, TC-GANTT-003 |  |
| D56 | Import harmonogramu XLSX — zastąpienie po potwierdzeniu | TC-NOSCHED-003 |  |
| D57 | „Przelicz z cennika” / nowa rewizja | TC-PRICE-005, TC-VER-004 |  |
| D58 | Blokady i ostrzeżenia wysłania | TC-VER-008, TC-COST-018 |  |
| D59 | „Zastosuj wartość do deala” | TC-VER-007 |  |
| D60 | PDF — zamrożony obraz, dane firmy | TC-VER-006, TC-PERM-007 |  |
| D61 | Prognoza — ważenie prawdopodobieństwem | TC-FCST-004 |  |
| D62 | Zaokrąglenie per organizacja, słownik jednostek | TC-COST-003, TC-TEN-007, TC-COST-023, TC-DEAL-008 | |
| D63 | Inwestycje i role ofert w module | TC-DEAL-013, TC-DEAL-014, TC-DEAL-015 |  |
| D64 | Okres przejściowy ról ofert z n8n | TC-DEAL-015 |  |
| D65 | Pierwsza oferta główna | TC-DEAL-011, TC-DEAL-010 |  |
| D66 | Wartość deala tylko jawnie, aktywna wersja | TC-VER-007, TC-DEAL-002 |  |
| D67 | Uzupełnienie harmonogramów po włączeniu | TC-NOSCHED-004, TC-NOSCHED-005 |  |
| D68 | Lista feature'ów ACL | TC-PERM-001, TC-PERM-002, TC-PERM-009 |  |
| D69 | Niezależne ustawienia organizacji | TC-TEN-007 |  |
| D70 | Liczba miejsc per waluta (z modułu Waluty, ISO 4217 jako zapas) | TC-CUR-003 | realizacja: D87 |
| D71 | Kurs NBP tabela A, ostatnia tabela, korekta przed wysłaniem | TC-CUR-002, TC-CUR-006, TC-CUR-007 | realizacja: D85 |
| D72 | Ponowne otwarcie deala — oznaczenie bez usuwania | TC-EXEC-003 |  |
| D73 | Cena zero / marża „—” | TC-COST-006, TC-VER-008 |  |
| D74 | Akceptacja nowych zależności | TC-IMP-004 | zależności, nie zachowanie; testy plikami z polskiego Excela, bez testów konkretnej biblioteki |
| D75 | Marża po zamknięciu od v1, w MVP tylko `view_margin` | TC-PERM-006, TC-PERM-010, TC-PERM-002 | |
| D76 | Ujemna marża bez `view_margin` — blokada bez ujawnienia znaku | TC-VER-009 | |
| D77 | Jeden rekord harmonogramu z fazą, unikalność | TC-GANTT-008, TC-GANTT-010, TC-GANTT-011, TC-EXEC-001, TC-EXEC-002 | |
| D78 | Bez wiersza sumy częściowej w MVP | TC-COST-020 | |
| D79 | „Tylko własne deale” od v1 | TC-PERM-004, TC-PERM-011 | |
| D80 | Następnik kamienia milowego tego samego dnia | TC-GANTT-009 | |
| D81 | Wartość z „Zastosuj do deala” wygrywa; n8n tylko pola przetargowe | TC-DEAL-016 | |
| D82 | Gantt własny, zewnętrzna biblioteka tylko PoC w v1 | N/A | zależności, nie zachowanie; scenariusze Gantta bez nazwy biblioteki |
| D83 | Rozdzielenie w v1; wybór oferty głównej, domyślnie oryginał | TC-DEAL-010 | etap v1; źródło: `.ai/decisions.md`@3f00542 (Rozstrzygnięte przez Koordynatora 2026-10-23) |
| D84 | Waluty z modułu Waluty; MVP waluta deala, v1 waluta per pozycja | TC-CUR-001, TC-CUR-004, TC-CUR-013, TC-CUR-014 | v1: TC-CUR-013, TC-CUR-014 |
| D85 | Tabela A na żądanie przy wysłaniu; kurs ręczny tylko w wersji roboczej, poza tabelą kursów | TC-CUR-002, TC-CUR-006, TC-CUR-007, TC-CUR-011, TC-CUR-012 | |
| D86 | Waluta bazowa organizacji; brak → 422 | TC-CUR-001, TC-CUR-008 | |
| D87 | Liczba miejsc z modułu Waluty; waluta aktywna | TC-CUR-003, TC-CUR-009, TC-CUR-010 | kod błędu nieaktywnej waluty — propozycja |
| D88 | Zamrożony kurs z rodzajem, źródłem i parą; v1 wpis per para | TC-CUR-002, TC-CUR-007, TC-CUR-013 | |
| D89 | Dzienne pobieranie kursów w v1, w MVP na żądanie | TC-CUR-002 | job dzienny v1 — zachowanie jak TC-CUR-011 |
| D90 | Bez ofert i produktów platformy (`sales`, `catalog`) | N/A | zakres modułów, nie zachowanie |
| D91 | XLSX bez modułu importu CSV platformy | TC-IMP-004 | zależność; testy plikami XLSX |
| D92 | PDF z plikiem w załącznikach | TC-CUR-005, TC-VER-002 | |
| D93 | Bez obiegu akceptacji w MVP | N/A | kandydat v2, brak zachowania w MVP |
| D94 | Zapisane widoki i harmonogram zadań opcjonalne w v1 | N/A | opcjonalne komponenty platformy |
| D95 | Waluta bez kursu w żadnej tabeli NBP nie może być walutą oferty ani pozycji; waluty zostają aktywne | TC-CUR-012, TC-CUR-014 | v1: TC-CUR-014; kod błędu — propozycja |
| D96 | Jedno źródło kursu w sumie deali (wyłączenie dostawcy tabeli C); błąd daty do upstream jako zgłoszenie | TC-CUR-011 | konfiguracja etapu kodu; suma deali z jednego źródła — TC-CUR-011 |
| D97 | Poprawka platformy dla jednej waluty bazowej pobrana z pierwszym PR modułu | N/A | zależność etapu kodu, brak zachowania modułu |
| D132 | Postępowanie z częściami: inwestycja i deal na część, wspólny `tender_notice_number` (tylko do odczytu, bez unikalności, poza dopasowaniem); primary per inwestycja; v1 identyfikator `bzp_notice_part` `{numer}#{część}`, bez `bzp_notice_number` | TC-DEAL-017, TC-DEAL-016 (krok 7) | decisions @develop (po PR #30); aktywna bez warunku |
| D185 | n8n zmienia etap deala tylko na `result_lead` i `cancelled` (z D34), nie zmienia `closure_outcome` (D42); inne zmiany etapu w UI nie wpływają na kosztorys; etap grupuje prognozę, a prognoza wyklucza etap `rejected` niezależnie od `closure_outcome` (zmiana 2026-10-31); `rejected` poza aktywnym lejkiem, także poza sumą inwestycji (rev 4d) | TC-DEAL-018, TC-DEAL-030 | MVP; rejestr @0bff741 (PR #33, rev 4b/4d); kroki 5–6; wniosek 28 zamknięty, 36; oferta `primary` na `rejected` — historia, widget „odrzucony” (zmiana 2026-10-31, @32bf708); tabela ofert i `pc_deal_offer_roles` — TC-DEAL-030 krok 3 |
| D187 | Status inwestycji: domyślnie `active`; MVP `active`/`archived` (tylko odczyt, ukryta w listach, filtr pokazuje); archiwizacja i przywrócenie z `project_costing.manage_investments` (bez niego 403 `FORBIDDEN`), przywrócenie z audytem; podpięcie deala do `archived` → 422 `INVESTMENT_ARCHIVED`; CHECK na listę wartości fazy; v1 `merged` z `merged_into_id`; skutki merge nierozstrzygnięte (L3) | TC-DEAL-019, TC-DEAL-009 (notatka L3) | MVP, v1; rejestr @fa3c15d (zmiana 2026-10-31); wnioski 29 (kod edycji), 30 |
| D188 | Usunięcie deala z harmonogramem wykonawczym: bez kaskady, `reopened_at` na rekordzie albo na zadaniu fazy projektu (D72, D131); flagi zostają; przywrócenie → `project_schedule.schedule.deal_restored`; zdjęcie `project_schedule.schedules.reopen_flag_clear` — bez `project_schedule.edit` `403 FORBIDDEN`, bez powodu, audyt z autorem; event `customers` przywrócenia — etap kodu; czyszczenie przy `won` bez zmian; n8n deala nie odtwarza (D35); część projektu — plan `project_delivery` (TC-PD-PRJ-015) | TC-EXEC-006 | v1 (harmonogram); rejestr @fa3c15d (zmiana 2026-10-31) |
| D189 | Klucz push części `ezamowienia:<tender_id>#<nr części>`; klucz bez części `ezamowienia:<tender_id>` bez zmian (do potwierdzenia przez Enkę), bez migracji; wdrożenie n8n — Enka, etap kodu (D32) | TC-DEAL-021 | etap kodu kontraktu push; rejestr @49384e6 |
| D190 | Właściciel inwestycji = `created_by`, bez osobnego pola; klucz API z użytkownikiem → ten użytkownik, bez użytkownika → NULL i powiadomienia do administratorów; n8n inwestycji nie zakłada (D63); właściciel deala z n8n otwarty (Q-ARCH-2) | TC-DEAL-020 | MVP; rejestr @49384e6; wniosek 31 (częściowo) |
| D191 | Ponowne otwarcie deala po przegranej (`lost` → NULL) — zachowanie `customers` OM core, fork go nie zmienia (D45); deal wraca do prognozy, chyba że jest na etapie `rejected` (zmiana 2026-10-31); bez reakcji modułów własnych (flagi D72/D141 tylko dla deala, który był `won`) | TC-FCST-007, TC-FCST-008 | MVP; rejestr @0be9356 (PR #33, rev 4b); @fe7a2c2: wyjście z `rejected` czyści `closure_outcome` i `loss_reason_id` (moduł), poza tym core — TC-FCST-008 |
| D192 | Etap `rejected` = każde odrzucenie; powód z `sales.deal_loss_reason` wymagany (422 `REASON_REQUIRED`); seed bez duplikatów (12 wpisów, 9 `lost`, 3 `no_result`); tabela mapująca, unikalność per organizacja, domyślne `no_result` dla nowych wpisów; mapowanie tylko przy `rejected` (`lost` → `closureOutcome = lost`, `no_result` → NULL, enum bez zmian); „Oznacz jako przegrany” tylko powody `lost` (422 `INVALID_LOSS_REASON`), UI tylko powody `lost`; interceptor create/update obejmuje widok lejka i ścieżkę masową; „Oznacz jako przegrany” i `status = lost` bez powodu → 422 `REASON_REQUIRED`; masowo na `rejected` → 422 per deal w `failedItems`, reszta przetwarzana (zmiana 2026-10-31); n8n nie ustawia `rejected` ani powodu | TC-DEAL-023, TC-DEAL-024, TC-DEAL-025, TC-DEAL-026, TC-DEAL-027, TC-DEAL-028, TC-DEAL-029, TC-DEAL-031, TC-DEAL-032, TC-DEAL-033; prognoza: TC-DEAL-018, TC-FCST-007 | MVP; TC-DEAL-027 etap kodu (mechanizm forka dla okna UI); reguła metryk skuteczności bez TC (D192); rejestr @0bff741, doprecyzowanie @cdf27dc (PR #38); wniosek 37 rozstrzygnięty, 38 częściowo; @32bf708: moduł `crm_deal_rules` / `cdr_loss_reason_outcomes`, `value` seedu, 422 `INVALID_LOSS_REASON` dla wpisu nieaktywnego, przeliczenie przy zmianie powodu i czyszczenie przy wyjściu z `rejected`, okno modułu w UI (TC-DEAL-027 MVP); Q-LR-8 bez asercji; wniosek 39; @fe7a2c2: Q-LR-8 — okno core zostaje pełne, przechwycenie modułu (TC-DEAL-027) |
| D193 | Ustawienie `crm.n8n_default_deal_owner_user_id` (domyślnie `null` → deal bez opiekuna, szkice do administratorów); ustawione → opiekun deali tworzonych pushem n8n; walidacja 422 (aktywny, w organizacji); nieaktywny przy imporcie → bez opiekuna i ostrzeżenie w logu (tylko ID); tylko przy tworzeniu, bez zmian jawnego opiekuna, bez wstecz, pushe nie zmieniają opiekuna | TC-DEAL-022, TC-DEAL-034, TC-DEAL-035 | MVP; rejestr @0be9356 (PR #33); routing szkiców — plan `crm_followups` (TC-FU-ACL-001); wnioski 34, 35; @32bf708: 422 `INVALID_SETTING_VALUE`, klucze z `crm.n8n_api_key_ids`; Q-LR-9 bez asercji; wnioski 34, 35 rozstrzygnięte; @fe7a2c2: walidacja `crm.n8n_api_key_ids` (Q-LR-9) — TC-DEAL-035 |

**Decyzje zastąpione — nie testujemy:**
- D3 — zastąpione przez D4
- D7 — zastąpione przez D63
- D8 — zastąpione przez D10
- D13 — zastąpione przez D48 i D49
- D27 — zastąpione przez D60
- D28 — zastąpione przez D29; D29 — zastąpione przez D50
- D39 — zastąpione przez D64 (okres przejściowy pokrywa TC-DEAL-015)
- D43 — zastąpione przez D63

---

## Changelog

### Rev 9k — 2026-10-31 (D192 (11), (12); rejestr @2f20fed, PR #38)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @2f20fed
- TC-DEAL-032 krok 3: nieaktywny powód w `POST /api/crm-deal-rules/deals/bulk-reject` → 422 `INVALID_LOSS_REASON` dla całego żądania na poziomie trasy, bez joba i bez wpisu w `failedItems` (D192 (12))
- TC-DEAL-027 krok 4, TC-DEAL-033 krok 1: trasa kolejkuje job postępu; `failedItems` w podsumowaniu joba, nie w synchronicznej odpowiedzi trasy (D192 (12))
- TC-DEAL-033 krok 2: nagłówek `x-cdr-loss-reason-id` przez `PUT /api/customers/deals` (interceptor API modułu, D192 (11)) zamiast wywołania komendy
- Liczba scenariuszy bez zmian: 164

### Rev 9j — 2026-10-31 (meta, P21; PR #38)

- Zmiana meta wykonana przez Kod (P21), bez zmiany asercji i bez nowych TC
- Wniosek 39 zamknięty: reguły realizacji `crm_deal_rules` zarejestrowane w D192 pkt (9)–(15) i D193 (doprecyzowania 2026-10-31)
- TC-DEAL-027 (kroki 2, 4, 5), TC-DEAL-031 (krok 3–4), TC-DEAL-032 (krok 3), TC-DEAL-033 (nagłówek decyzji), TC-DEAL-034 (krok 3): oznaczenie „reguła z polecenia rundy …, brak w rejestrze @32bf708 — wniosek 39” zastąpione odesłaniem do D192/D193
- Liczba scenariuszy bez zmian

### Rev 9i — 2026-10-31 (Q-LR-8, Q-LR-9, wyjątek D191; rejestr @fe7a2c2, PR #38)

- Niezależna sesja planu (P4): jedyne źródło reguł — `.ai/decisions.md` @fe7a2c2; speki nieczytane
- Nowe TC: TC-DEAL-035 (D193, Q-LR-9 — walidacja `crm.n8n_api_key_ids`: nie UUID, nieistniejący, odwołany, inna organizacja → 422 `INVALID_SETTING_VALUE`; klucz odwołany po zapisie nie zakłada deala, ustawienie zostaje; P1, MVP), TC-FCST-008 (D191 — wyjście z `rejected` czyści wynik i powód, `lost` → otwarty poza `rejected` jak w core; P0, MVP)
- TC-DEAL-030 rozszerzony (D185, Q-LR-3): krok 3 — `pc_deal_offer_roles` bez zmian, tabela ofert inwestycji „odrzucony”, suma bez deala
- TC-DEAL-027 (Q-LR-8: lista okna core pełna, przechwycenie modułu), TC-DEAL-031 (odesłanie do D191), TC-DEAL-034 (walidacja listy → TC-DEAL-035)
- §22 wniosek 35 domknięty; załącznik — wiersze D185, D191, D192, D193
- Liczba scenariuszy: 162 → 164 (TC-DEAL 34 → 35, TC-FCST 7 → 8)

### Rev 9h — 2026-10-31 (rozstrzygnięcia Q-LR-1…7; rejestr @32bf708, PR #38)

- Niezależna sesja planu (P4): jedyne źródło reguł — `.ai/decisions.md` @32bf708; speki nieczytane. Reguły z polecenia rundy bez wiersza w rejestrze oznaczone w TC i zebrane we wniosku 39
- Nowe TC: TC-DEAL-030 (D185 — oferta `primary` na `rejected`; P1), TC-DEAL-031 (D192 — zmiana powodu na `rejected`, wyjście z `rejected`; P0), TC-DEAL-032 (D192 — powód spoza aktywnych wpisów → 422 `INVALID_LOSS_REASON`; P0), TC-DEAL-033 (D192 — API modułu: trasa masowa, nagłówek, lista powodów; P1), TC-DEAL-034 (D193 — `crm.n8n_api_key_ids`, `crm_deal_rules.settings.manage`; P1); wszystkie MVP
- Zmienione TC: TC-DEAL-022 (422 `INVALID_SETTING_VALUE`, klucz z listy), TC-DEAL-023 krok 6 (mapowanie na etapie `rejected`), TC-DEAL-025 (kanban otwiera okno; trasa masowa modułu), TC-DEAL-026 (`crm_deal_rules`, `cdr_loss_reason_outcomes`, `rejected_by_buyer` / `our_withdrawal` / `other`, 12 mapowań), TC-DEAL-027 (przebudowa: okno modułu w UI, etap kodu → MVP P0; lista okna core bez asercji — Q-LR-8)
- §22: wnioski 34, 35, 36, 38 rozstrzygnięte, nowy 39; §23; załącznik — wiersze D185, D192, D193
- Liczba scenariuszy: 157 → 162 (TC-DEAL 29 → 34)

### Rev 9g — 2026-10-31 (doprecyzowanie D192; zapis `403 FORBIDDEN`; rejestr @cdf27dc, PR #38)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @cdf27dc; bez speki i bez briefów
- Nowe TC: TC-DEAL-028 (D192, P0, MVP — „Oznacz jako przegrany” i `status = lost` bez powodu → 422 `REASON_REQUIRED`, powód `no_result` → 422 `INVALID_LOSS_REASON`), TC-DEAL-029 (D192, P0, MVP — masowa zmiana na `rejected`: 422 `REASON_REQUIRED` per deal w `failedItems`, reszta przetwarzana)
- TC-DEAL-024 krok 3: kod zamiast luki (odesłanie do TC-DEAL-028); TC-DEAL-025 krok 3: zamiast warunku „jeśli ścieżka masowa przyjmuje powód” — payload joba bez `lossReasonId` (odesłanie do TC-DEAL-029)
- Zapis `403 FORBIDDEN` (D187 i pozostałe asercje braku uprawnień): 17 linii w TC, strategii i wnioskach; bez zmian: „Brak 403” w TC izolacji (asercja 404), stare wpisy changelogu
- §22: wniosek 37 rozstrzygnięty, 38 częściowo; §23; załącznik — wiersz D192
- Liczba scenariuszy: 155 → 157 (TC-DEAL 27 → 29)

### Rev 9f — 2026-10-31 (review #33, rev 4 @700cc63)

- TC-DEAL-023 krok 6 i TC-DEAL-025 (warunki wstępne): etap spoza lejka „Przetargi” zastąpiony etapem `contact` (D33); sens bez zmian — zmiana etapu na inny niż `rejected`
- TC-DEAL-022: U4 zdefiniowany w warunkach wstępnych (aktywny w O1, opiekun podawany jawnie)
- Liczba scenariuszy bez zmian: 155

### Rev 9e — 2026-10-31 (D192, D185 rev 4d, D41 rev 4c/4d; rejestr @0bff741, PR #33)

- Niezależna sesja planu (P4, P21): jedyne źródło — `.ai/decisions.md` @0bff741; bez speki i bez briefów
- Nowe TC (D192): TC-DEAL-023 (P0, MVP: przejście na `rejected` z powodem i bez, mapowanie `lost`/`no_result`, wpis bez mapowania, enum bez zmian, n8n bez zmian powodu), TC-DEAL-024 (P0, MVP: „Oznacz jako przegrany”, 422 `INVALID_LOSS_REASON`), TC-DEAL-025 (P0, MVP: widok lejka i ścieżka masowa), TC-DEAL-026 (P0, MVP: seed i tabela mapująca), TC-DEAL-027 (P1, etap kodu: okno UI tylko z powodami `lost`, bez zmian w `packages/core`)
- TC-DEAL-018 (D185 rev 4d): nowy krok 6 — `rejected` poza sumą inwestycji; odesłanie do TC D192 zamiast „poza tym TC”
- D41: bez osobnej asercji — reguły rev 4c/4d pokrywają TC-DEAL-024, TC-DEAL-026, TC-DEAL-027
- §22: wniosek 28 zamknięty odesłaniem do D192; nowe 36–38; §23; załącznik — wiersze D41, D185, nowy D192
- Liczba scenariuszy: 150 → 155 (TC-DEAL 22 → 27)

### Rev 9d — 2026-10-31 (D185/D191 rev 4b, D193; rejestr @0be9356, PR #33)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @0be9356; bez speki i bez briefów
- TC-DEAL-018 (D185, zmiana 2026-10-31): nowy krok 5 — deale na etapie `rejected` (z `closure_outcome` NULL i `lost`) poza prognozą; przestawienie na `rejected` usuwa partie z prognozy
- TC-FCST-007 (D191, zmiana 2026-10-31): nowy krok 5 — deal `rejected` po ponownym otwarciu (`lost` → NULL) nie wraca do prognozy
- Nowy TC-DEAL-022 (D193, P1, MVP): domyślny opiekun deala z n8n — wartość `null`, walidacja 422, tylko przy tworzeniu, jawny opiekun i późniejsze pushe bez zmian, bez wstecz, ostrzeżenie w logu przy nieaktywnym użytkowniku
- TC-EXEC-006 (meta): zapis `403 FORBIDDEN`
- §22: wniosek 28 częściowo, nowe 34–35; §23; załącznik — wiersze D185, D191, D193; liczniki i R7
- Liczba scenariuszy: 149 → 150 (TC-DEAL 21 → 22); TC `crm_followups` — osobny plan `2026-10-31-crm-followups-test-plan.md`

### Rev 9c — 2026-10-31 (D191, doprecyzowania D187 i D188; rejestr @fa3c15d, PR #36)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @fa3c15d; bez speki i bez briefów
- Nowy TC-FCST-007 (D191, P1, MVP): deal `lost` → otwarty ścieżką `customers` OM core wraca do prognozy; brak flag D72/D141, projektu i eventów modułów własnych
- TC-DEAL-019 (D187, zmiana 2026-10-31): archiwizacja i przywrócenie bez `project_costing.manage_investments` → 403 `FORBIDDEN`; podpięcie deala do `archived` → 422 `INVESTMENT_ARCHIVED`; CHECK statusu na listę wartości fazy
- TC-EXEC-006 (D188, zmiana 2026-10-31): `project_schedule.schedules.reopen_flag_clear` bez `project_schedule.edit` → 403; działa bez powodu, wpis w `audit_logs` z autorem; event `customers` przywrócenia — etap kodu
- TC-DEAL-020 (D190): bez zmian — zakres szkiców i powiadomień zostaje do rozstrzygnięcia w PR #33
- §22: wniosek 29 prawie zamknięty (kod edycji `archived`), 31 z odesłaniem do PR #33, 32 rozstrzygnięty; §23; załącznik — wiersze D187, D188, D191; liczniki i macierz ryzyka R11
- Liczba scenariuszy: 148 → 149 (TC-FCST 6 → 7)

### Rev 9b — 2026-10-31 (meta, P21; wykonawca, nity po merge #35)

- Linie „> Decyzje: …” pod nagłówkami TC-DEAL-018 (D185), TC-DEAL-019 (D187), TC-DEAL-020 (D190), TC-DEAL-021 (D189), TC-EXEC-006 (D188) — odesłanie dla macierzy spec-check
- Kroki i asercje TC bez zmian (P4, P21)

### Rev 9a — 2026-10-31 (rozstrzygnięcia Cezara do D187–D190; rejestr @49384e6, PR #35)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @49384e6; bez speki i bez briefów
- TC-DEAL-019 (D187): domyślny `active`, `archived` tylko do odczytu, ukrycie w listach i filtr, blokada podpięcia deala, przywrócenie z `project_costing.manage_investments` i audytem
- TC-DEAL-009: notatka o przeglądzie po decyzji o skutkach merge (L3); kroki bez zmian
- TC-DEAL-020 (D190): klucz API z użytkownikiem i bez (`created_by = NULL`), szkice i powiadomienia do administratorów, n8n nie zakłada inwestycji (D63)
- TC-DEAL-021 (D189): klucz bez części `ezamowienia:<tender_id>` (do potwierdzenia przez Enkę, etap kodu)
- TC-EXEC-006 (D188): przywrócenie deala (event `project_schedule.schedule.deal_restored`, flagi zostają), ręczne zdjęcie z audytem, czyszczenie przy `won` po przywróceniu
- §22: wnioski 32, 33 rozstrzygnięte, 29 i 31 częściowo; załącznik — wiersze D187, D188, D189, D190
- Liczba scenariuszy bez zmian: 148

### Rev 9 — 2026-10-31 (D185, D187, D188, D189, D190; rejestr @730b77d, PR #35)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @730b77d; bez speki i bez briefów
- Nowe TC: TC-DEAL-018 (D185, P1), TC-DEAL-019 (D187, P2), TC-DEAL-020 (D190, P2), TC-DEAL-021 (D189, P0, etap kodu razem z kontraktem push Enki), TC-EXEC-006 (D188 część harmonogramu, P1, v1)
- §22: nowe wnioski 28–33; §23; załącznik — wiersze D185, D187, D188, D189, D190; macierz ryzyka R5, R7
- Istniejące TC bez zmian; TC-DEAL-009 (scalanie) nie jest unieważniony przez D187, ale po decyzji o skutkach merge (L3) wymaga uzupełnienia (wniosek 30)
- Liczba scenariuszy: 143 → 148 (TC-DEAL 17 → 21, TC-EXEC 5 → 6)

### Rev 8e — 2026-10-31 (meta, wykonawca)

- Data wpisu rev 8d poprawiona na faktyczną (2026-10-31); bez zmian w treści TC (kroki, asercje), liczba scenariuszy bez zmian: 143

### Rev 8d — 2026-10-31 (nity Cezara po r8)

- TC-DEAL-017: priorytet P1 → P0, spójnie z TC-PD-PRJ-012 (P0). Podstawa: ta sama reguła biznesowa D31/D132 (decyzja Marka 2026-10-23) — scalenie części w jeden deal lub jedną inwestycję psuje ofertę `primary` per inwestycja (D5; TC-DEAL-011 to P0) i projekt per inwestycja (R5 w planie `project_delivery`, P0); w R7 są już TC P0 (TC-DEAL-011, 013, 014), więc wiersz R7 bez zmian
- Liczba scenariuszy bez zmian: 143

### Rev 8c — 2026-10-23 (inputy Cezara do r8)

- TC-DEAL-016: nowy krok 7 — lookup po postępowaniu + części, deal części 2 nietknięty; etap kodu (D32)
- Załącznik: wiersze D31, D32 (teraz TC-DEAL-016 krok 7) i D132 doprecyzowane; podstawa decisions @develop po PR #30
- Sprawdzone bez zmian: TC-DEAL-017 pokrywa `tender_notice_number` (tylko do odczytu, bez unikalności, filtr) i `bzp_notice_part` (v1)
- Liczba scenariuszy bez zmian: 143

### Rev 8b — 2026-10-23 (rozstrzygnięcie D31)

- Niezależna sesja planu `project_delivery`, wyłącznie na podstawie `.ai/decisions.md` z commita 82c4ec3 (PR #30, na develop_OM_CRM @cec4242), bez dostępu do spek
- Wiersz D31 w załączniku: nowa treść (przetarg bez części = 1 deal; z częściami — deal i inwestycja na część, wspólny `tender_notice_number`); dawny zapis „1 postępowanie = 1 deal” nieaktualny
- Nowy TC-DEAL-017 (D31, D132, D5): przetarg z częściami — dwie inwestycje i dwa deale ze wspólnym numerem ogłoszenia, primary per część, kontrola przetargu bez części; nowy wiersz D132 w załączniku
- Liczba scenariuszy: 142 → 143 (TC-DEAL 16 → 17)

### Rev 8a — 2026-10-23 (odbiór #20)

- TC-CUR-012: usunięta stara linia „Krok 3: kurs ręczny nie odblokowuje waluty bez źródła kursu…”; zakaz kursu zgadywanego, krzyżowego i z innej tabeli dopisany do linii kroku 3
- Liczba scenariuszy bez zmian: 142

### Rev 8 — 2026-10-23 (runda PR D)

- TC-CUR-012: kroki 1–2 → 422; krok 3 — samo ustawienie kursu ręcznego nie zwraca 422, 422 zwraca wysłanie wersji (zgodnie z §3.10 speki kalkulacji i D95)
- TC-CUR-014: kroki 1–2 → 422; krok 3 — samo ustawienie kursu ręcznego nie zwraca 422, 422 zwraca powtórzony krok 1
- Liczba scenariuszy bez zmian: 142

### Rev 8 — 2026-10-23 (runda rev 8h)

- TC-CUR-012 przepisany: waluta bez kursu w żadnej tabeli NBP (CNH) jako waluta oferty — 422 przy utworzeniu, podpięciu do deala i wysłaniu; kurs ręczny nie odblokowuje; CNY przechodzi walidację; waluty zostają aktywne
- Nowy TC-CUR-014 (v1): waluta pozycji bez kursu w żadnej tabeli NBP — 422 z czytelnym komunikatem
- Wniosek 26 zamknięty (Koordynator 2026-10-23)
- Annex: D95–D97 (D95 → TC-CUR-012, TC-CUR-014; D96 → TC-CUR-011; D97 N/A); 88 aktywnych decyzji w zakresie D1–D97
- Liczba scenariuszy: 141 → 142 (TC-CUR: 13 → 14)

### Rev 8 — 2026-10-23

**Runda rev 8g — poprawki po review PR #16:**
- TC-CUR-011 (P0): krok 1 — zapis przez dostawcę „NBP tabela A”; krok 3 — wyszukiwanie modułu Waluty o 23:30 daje kurs z D, o 00:30 kurs z D-1 (dzień liczony w UTC); krok 4 — suma deali 84 922 PLN (zaokrąglenie do całości) i brak walut bez kursu; krok 5 — wysłanie o 12:00, 23:30 i 00:30 zamraża kurs z D (data w Europe/Warsaw); nowe kroki 6–7 — godziny graniczne lato (01:59:59 / 02:00:00) i zima (00:59:59 / 01:00:00)
- TC-CUR-001: zamrożony obraz przy walucie bazowej bez rodzaju i źródła kursu
- §22 pkt 27 doprecyzowany
- Liczba scenariuszy bez zmian: 141

### Rev 7 — 2026-10-23

**Runda rev 8f — waluty przez moduł Waluty platformy (D84–D94):**
- TC-CUR-002..007 przepisane: etap MVP zamiast „warunkowe”; kurs z tabeli A pobierany na żądanie przy wysłaniu; kurs ręczny tylko w wersji roboczej, do zamrożonego obrazu ze źródłem „ręczny” i nie do tabeli kursów; liczba miejsc z modułu Waluty; zmiana waluty deala — ostrzeżenie w MVP, przeliczenie w v1; wartości kursów oznaczone „kurs przykładowy”
- TC-CUR-001: waluta bazowa organizacji zamiast stałego PLN
- Nowe TC-CUR-008 (brak waluty bazowej), TC-CUR-009 (waluta nieaktywna), TC-CUR-010 (pracownik widzi wybór waluty), TC-CUR-011 (kurs dla daty zapisu, sumy deali w EUR — P0), TC-CUR-012 (waluta bez kursu), TC-CUR-013 (v1 waluty per pozycja)
- §1.3 bez wiersza „Warunkowe”; fixtures i kryteria akceptacji zaktualizowane; §22 pkt 16, 17, 23 rozstrzygnięte, nowe pkt 26 (otwarte) i 27
- Annex: D70, D71 bez „warunkowe”; D84–D94 (źródło: `.ai/decisions.md` z tego PR)
- Liczba scenariuszy: 135 → 141

### Rev 6 — 2026-10-23

**Poprawki po odbiorze rev 5 (Koordynator):**
- TC-COST-013: marża liczona od ceny sprzedaży (500.00 / 1 500.00 = 33.33%), narzut ≠ marża; narzut per pozycja (600.00 + 400.00 → 900.00 + 600.00)
- Nowy TC-PERM-012 (P0): `action_logs` (`command_payload`, `snapshot_before`, `snapshot_after`, `changes_json`) bez kosztu, narzutu i marży, także przy undo i redo
- TC-VER-012: kroki 1–3 wykonuje admin; redo przez R → 403, redo przez admina → 120.00
- TC-DEAL-016: ścieżka n8n lookup + PUT; kontrola klucza API spoza n8n (wartość zmieniona)
- TC-GANTT-002 krok 6: reguła SF z przykładem liczbowym
- TC-PERM-008, TC-DEAL-009 → v1; TC-DEAL-010 → v1 z wyborem oferty głównej (domyślnie oryginał) i komunikatem przy dwóch ofertach głównych (D83); §1.3 bez wiersza „poza MVP”
- §22 pkt 22, 24, 25 rozstrzygnięte
- Porządki: TC-VER-009 „employee” zamiast „R”; opis D21 w aneksie; ścieżki API i warunki SQL zastąpione opisem zachowania (TC-PERM-005, TC-TEN-001..003, TC-CONC-002, TC-CONC-004, TC-DEAL-004)
- Liczba scenariuszy: 134 → 135

### Rev 5 — 2026-10-23

**Zgodność z decyzjami D47–D74 i rozstrzygnięciami Koordynatora D75–D82; traceability:**
- Pole „Etap” (MVP / v1 / v2 / warunkowe / poza MVP) w każdym scenariuszu; nowa §1.3 (D50)
- Uprawnienia wyłącznie przez feature'y `project_costing.*` i `project_schedule.*`, role OM + role własne z fixture; TC-PERM-001..004, -006..-008 przepisane, TC-PERM-002 P1 → P0, nowe TC-PERM-009..011 (zamknięcie deala w MVP niczego nie odsłania; „tylko własne” odrzucone w MVP) (D48, D49 — etap v1, D68, D75, D79)
- Wersje i wysłanie: TC-VER-002..004, -006 przepisane; nowe TC-VER-007..012 (zastosowanie wartości do deala, blokady i ostrzeżenia, ujemna marża bez wglądu w marżę, aktywna kalkulacja, audyt pól wrażliwych, undo) (D57–D60, D66, D73, D76)
- Inwestycje: TC-DEAL-002, -003, -008 przepisane; nowe TC-DEAL-011..016 (pierwsza oferta główna, ręczne wskazanie, import CLI, okres przejściowy ról, wartość z kalkulacji vs n8n) (D52, D63–D66, D81)
- Kalkulacja: TC-COST-003, -006, -007, -018..-020 przepisane; nowe TC-COST-023 (jednostka pozycji = jednostka ceny w MVP), TC-COST-024 (bez formuł w MVP) (D17, D30, D58, D62, D73, D78)
- Harmonogram: konwencja dat (koniec wliczony, +1), jeden rekord na inwestycję z fazą, przesuwanie tylko w przód; TC-GANTT-001..003, -005..-008 przepisane, nowe TC-GANTT-009..011 (kamień milowy, 409 przy drugim rekordzie, zmiana fazy z baseline); TC-EXEC-001..003, -005 przepisane (D53–D55, D72, D77, D80)
- Firmy bez harmonogramu: ustawienia modułu per organizacja + wyłącznik tenanta; TC-NOSCHED-002..004 przepisane, nowy TC-NOSCHED-005 (D47, D56, D67)
- Waluty: TC-CUR-001 bezwarunkowo jednowalutowy (PLN); TC-CUR-002..007 warunkowe; nowe TC-CUR-006 (dzień bez tabeli NBP), TC-CUR-007 (ręczna korekta przed wysłaniem) (D70, D71 w wersji z 2026-10-23)
- Cenniki: nowy TC-PRICE-005 „Przelicz z cennika” (D57); prognoza TC-FCST-004 (D61); TC-IMP-005, -008 (D58, D74); nowy TC-TEN-007 (D62, D69)
- §1, §2, §4, §5, §8–§10, §12, §13, §15, §19–§23 zaktualizowane; usunięto zbędną linię roboczą i literówki; §22: 25 wniosków
- Nowy załącznik „Traceability TC → D” (D1–D82)
- Liczba scenariuszy: 109 → 134
- Źródło decyzji: `.ai/decisions.md`@b544719 (develop_OM_CRM), zawiera D75–D82 i poprawioną D71; usunięto szacunek dniowy z TC-GANTT-001 i odwołanie do decyzji zastąpionej w changelogu Rev 4 (teraz z adnotacją „zastąpiona przez”)

### Rev 4 — 2026-10-20

**Decyzje koordynacyjne** (`.ai/vision.md`, `.ai/decisions.md`, część testowa `.ai/om-architecture-checklist.md`):
- TC-DEAL-005: dokładny komunikat „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”; ten sam komunikat oczekiwany w TC-DEAL-003 (ta sama sytuacja: zapis oferty do innego wykonawcy na tę samą inwestycję). TC-DEAL-004 i TC-CONC-004 (ręczna / równoległa zmiana oferty głównej) to inna sytuacja — komunikaty bez zmian
- Import XLSX w MVP (D9; D29 zastąpiona przez D50): TC-IMP-001..007 oznaczone `Etap: MVP`; TC-IMP-006 i TC-IMP-007 P2 → P1; TC-IMP-008 (eksport) — etap do potwierdzenia w specy; dodano `ProgressJob`, „1 234,56”, formuły bez zapisanej wartości, wiele arkuszy
- Uprawnienia przez feature'y w `acl.ts`, role biznesowe jako role testowe (TC-PERM-001..003, fixtures); szczelność marży (ukryta marża = ukryty koszt) i brak wycieku przez search/`action_logs`/eventy/`/compare`/eksport (TC-PERM-001, TC-PERM-002)
- Przełącznik harmonogramu per firma przez `ModuleConfigService` z blokadą menu, zakładek/widgetów i API (TC-NOSCHED-001, -002, -004); ustawienie marży po zamknięciu przez `ModuleConfigService` (TC-PERM-006)
- Statusy deala wg OM: `closure_outcome = won`, zdarzenie `customers.deal.won` (TC-PERM-006, TC-EXEC-001, TC-EXEC-002, fixtures, §22 pkt 7)
- Unikalność oferty głównej w bazie (TC-DEAL-004, TC-CONC-004); audit = `audit_logs`; §2 i §21: test każdej trasy API w tej samej zmianie, asercje komunikatów na locale `pl` z tłumaczeniem `en`

### Rev 3 — 2026-10-20

**Poziomy testów dopasowane do konwencji repo** (review PR #10/#11, pkt 17):
- §2 i §20 przepisane: Unit = Jest w `apps/mercato/src/modules/<moduł>/__tests__/*.test.ts` (logika czysta: kalkulacje, zaokrąglenia, parser importu, auto-planowanie, prognoza); Integration/API/E2E/UI = Playwright w `apps/mercato/src/modules/<moduł>/__integration__/TC-*.spec.ts` wg wzorca `sync_excel/__integration__`
- Komendy zgodne z `package.json`: `yarn test`, `yarn workspace @open-mercato/app test`, `yarn test:integration`, `yarn test:integration:ephemeral` (+ `:interactive`, `test:integration:report`, `OM_INTEGRATION_MODULES`)
- Usunięto odwołania do narzędzi i ścieżek, których nie ma w repo lub które łamią `.ai/qa/AGENTS.md` (helper testowej bazy dla Jest, biblioteka HTTP do testów API w Jest, jestowe sufiksy plików dla poziomów Integration/API, discovery specy z katalogu `.ai/qa/tests`)
- Doprecyzowano znaczenie oznaczeń „Integration”/„API”/„UI”/„E2E” w scenariuszach (warstwa asercji w Playwright) — oznaczenia i ID scenariuszy bez zmian, licznik 109 bez zmian

### Rev 2 — 2026-10-19

**Dodane scenariusze** (+37 TC):
- TC-CUR-001..005: Waluty (kalkulacja jednowalutowa, kursy, zaokrąglenie per waluta, zmiana waluty, eksport/PDF)
- TC-NOSCHED-001..004: Firmy BEZ modułu harmonogramu (partie/daty, brak Ganttu, import XLSX, włączenie/wyłączenie)
- TC-FCST-001..006: Prognoza produkcji 6 mies. (z/bez Ganttu, m³/szt., prawdopodobieństwo, horyzont, suma partii, zmiana oferty)
- TC-EXEC-001..005: Harmonogram ofertowy → wykonawczy (automatyczny, idempotentny, ponowne otwarcie, brak harmonogramu, wiele dealów)
- TC-SEC-001..006: Bezpieczeństwo plików (XLSX bomb, ogromne arkusze, formula injection, makra, MIME, SSRF)
- TC-TEN-001..006: Izolacja multi-tenant (API 404, cudze ID w body, wyszukiwanie inwestycji, eksport/PDF, webhooki, same-tenant/cross-tenant)
- TC-CONC-001..005: Edycja równoległa (optimistic locking, 409 conflict, wyścig zamrożenia, równoległe przełączanie oferty, import)

**Zmiany w istniejących scenariuszach**:
- TC-COST-003: oczekiwany wynik zaktualizowany do half-up per linia (usunięto "Luka spec")
- TC-COST-014: definicja marży zaktualizowana: marża = % od ceny sprzedaży (usunięto "Luka spec")
- TC-PERM-006: widoczność marży per FIRMA (nie per rola) — zmiana treści scenariusza

**Zmiany w sekcji Wnioski (sekcja 22)**:
- Oznaczono jako **ROZSTRZYGNIĘTE**: standard zaokrąglenia (half-up), słownik jednostek z przelicznikami, definicja marży (% od ceny), firma = organizacja OM, priorytet ID inwestycji (e-Zamówienia > TED > BIP > INV)
- Oznaczono jako **ODRZUCONE z uzasadnieniem**: Math.round dla kwot, harmonogram wykonawczy "na żądanie", widoczność marży per rola
- Dodano nowe wnioski 16–20 (zaokrąglenia per waluta, zamrożenie kursu, idempotentność exec, ponowne otwarcie deala, limity antybombowe)

**Zmiany strukturalne**:
- Sekcje 12–16 → 19–23 (aby zrobić miejsce na nowe sekcje TC 12–18)
- Macierz ryzyk rozszerzona o R8–R12
- Fixtures zaktualizowane o nowe typy danych testowych
- Kryteria akceptacji zaktualizowane o nowe obszary

---

**Koniec dokumentu**
*Data wygenerowania: 2026-10-19 | Rev 2: 2026-10-19 | Rev 3: 2026-10-20 | Rev 4: 2026-10-20 | Rev 5: 2026-10-23 | Rev 6: 2026-10-23*

