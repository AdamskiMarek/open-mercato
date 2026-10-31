# Niezależny plan testów — `crm_followups` (v2: nocne szkice follow-upów CRM)

**Dokument**: SPEC ONLY — plan testów niezależny od specyfikacji, bez kodu
**Data**: 2026-10-31
**Autor**: Grok Bot (niezależna sesja planu testów, P4: specyfikacji modułu ani briefu nie czytał)
**Rewizja**: rev 1 (2026-10-31) — pierwsza wersja: TC dla D170–D184 (moduł `crm_followups`, v2)
**Podstawa**: wyłącznie rejestr decyzji `.ai/decisions.md` @0be9356 (PR #33, gałąź `spec/v2-nightly-followup-drafts`), sekcja „Decyzje D170–D184” oraz decyzje kontekstowe (D31, D33, D34, D47, D69, D94, D132, D147, D189, D193). Bez speki i bez briefu (P4).

---

## Liczniki scenariuszy

| Obszar | Liczba scenariuszy |
|--------|-------------------|
| Kwalifikacja obiektów i aktywność (TC-FU-SCAN) | 7 |
| Idempotencja i zamykanie szkiców (TC-FU-IDEM) | 4 |
| Wyciszenie po odrzuceniu (TC-FU-MUTE) | 1 |
| Rodzaje szkiców i przypomnienia o terminie (TC-FU-KIND) | 3 |
| Decyzje o szkicach (TC-FU-DEC) | 3 |
| Uprawnienia i widoczność (TC-FU-ACL) | 2 |
| Wyzwalacze i przebiegi (TC-FU-RUN) | 5 |
| Moduł i dane (TC-FU-MOD) | 1 |
| Ustawienia firmy (TC-FU-SET) | 1 |
| Izolacja organizacji (TC-FU-TEN) | 1 |
| Audyt i szyfrowanie (TC-FU-AUD) | 1 |
| Treść z szablonów (TC-FU-TPL) | 1 |
| **Razem** | **30** (wszystkie etap v2) |

---

## 1. Zakres i priorytety (macierz ryzyka)

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Coś wychodzi do klienta bez decyzji użytkownika (mail wysłany automatycznie) | Niski | Krytyczny | P0 | Decyzje | TC-FU-DEC-002, TC-FU-DEC-003, TC-FU-SCAN-001 |
| R2 | Spam szkiców: duplikaty, kilka szkiców na postępowanie z częściami albo na osobę | Średni | Wysoki | P0 | Kwalifikacja, idempotencja | TC-FU-SCAN-005, TC-FU-SCAN-006, TC-FU-SCAN-007, TC-FU-IDEM-001, TC-FU-KIND-003 |
| R3 | Szkic dla obiektu aktywnego albo zamkniętego (błędna miara aktywności) | Średni | Wysoki | P0 | Kwalifikacja, idempotencja | TC-FU-SCAN-002, TC-FU-SCAN-003, TC-FU-SCAN-004, TC-FU-IDEM-002, TC-FU-IDEM-003 |
| R4 | Handlowiec widzi szkice cudzych obiektów; klucz API (także sesji `ai_assistant`) zatwierdza szkic | Niski | Krytyczny | P0 | Uprawnienia | TC-FU-ACL-001, TC-FU-ACL-002, TC-FU-DEC-003 |
| R5 | Wyciek między organizacjami | Niski | Krytyczny | P0 | Izolacja | TC-FU-TEN-001 |
| R6 | Podwójny albo zablokowany przebieg (współbieżność, ponowienia, zawieszony `running`) | Średni | Średni | P0 | Przebiegi | TC-FU-RUN-002, TC-FU-RUN-003 |
| R7 | Pominięte przypomnienie o terminie składania ofert | Średni | Wysoki | P0 | Przypomnienia | TC-FU-KIND-002, TC-FU-KIND-003, TC-FU-IDEM-004 |
| R8 | Treść maili, adresy lub nazwy w logach i audycie | Niski | Wysoki | P1 | Audyt | TC-FU-AUD-001 |

Wszystkie scenariusze dotyczą etapu v2. Warunek wstępny etapu kodu: włączenie modułu `scheduler` i wybór `QUEUE_STRATEGY` (D180) — do tego czasu TC-FU-RUN-001 nie jest wykonywalny, a przebiegi wyzwala droga zastępcza `POST /api/crm-followups/runs`.

---

## 2. Poziomy testów

| Poziom | Narzędzie | Zakres |
|--------|-----------|--------|
| Unit | Jest | predykat kwalifikacji i zamknięcia (D172, D174), reguła kolizji (D173), liczenie doby i terminu w `followups.timezone` |
| Integration | Playwright `request` + helpery API, fixtures per test | przebiegi, szkice, decyzje, eventy, ACL, ustawienia |
| `pg` | zapytania SQL na bazie testowej | indeksy częściowe, `organization_id`/`tenant_id`, szyfrowanie kolumn, brak wpisów w `customer_interactions` i `inbox_proposals` |
| E2E/UI | Playwright | lista szkiców, okno wysyłki CRM po `handed_off`, powiadomienie in-app |

Dane testowe: zegar testowy (wstrzykiwany czas) dla granic N, doby i terminu; strefa `followups.timezone` = Europe/Warsaw, chyba że TC mówi inaczej.

---

## 3. Scenariusze testowe: Kwalifikacja obiektów i aktywność (TC-FU-SCAN) — 7 TC

#### TC-FU-SCAN-001: Bezczynność od N i szkic bez automatycznej wysyłki

> Decyzje: D170, D181.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Organizacja z `followups.enabled = true`, `inactivity_days` domyślne (N = 14); deale DL1 (ostatnia aktywność N temu) i DL2 (N−1 temu) w zakresie; kontakt K1 powiązany z otwartym dealem, bez aktywności od N
- **Kroki**:
  1. Wyzwól przebieg (`POST /api/crm-followups/runs`)
  2. Odczytaj `fu_drafts`, `fu_runs`, skrzynkę wychodzącą i interakcje CRM
  3. Zmień `inactivity_days` na 20; wyzwól kolejny przebieg z nowym `Idempotency-Key`
- **Oczekiwane wyniki**:
  - Krok 2: szkic dla DL1 i K1, brak dla DL2; żaden mail nie wyszedł, żadna interakcja nie powstała — każdy szkic czeka na zatwierdzenie albo odrzucenie; `fu_runs.note` z liczbą szkiców i linkiem do listy
  - Krok 3: nowe szkice tylko dla obiektów bezczynnych od 20; istniejące otwarte szkice zamknięte wg predykatu D174 (`activity`)
  - Worker nie jest schedulerem: bez wyzwalacza przebieg się nie odbywa

#### TC-FU-SCAN-002: Źródła aktywności obiektu

> Decyzje: D172.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Deale bezczynne od N + 1; dla każdego dokładnie jedno zdarzenie z listy w kroku 1, datowane dziś
- **Kroki**:
  1. Zdarzenia: interakcja zakończona (`occurred_at` dziś); interakcja nieterminalna utworzona dziś (`created_at`); mail zapisany do deala; todo; wpis legacy `customer_activities`; komentarz; przejście etapu; deal utworzony dziś; decyzja o szkicu dziś (także `handed_off`); zaplanowana przyszła interakcja (spotkanie za tydzień, status nieterminalny); zmiana `updated_at` deala pushem n8n
  2. Wyzwól przebieg
  3. Deal wraca na wcześniej odwiedzony etap; wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 2: dla każdego zdarzenia z kroku 1 poza `updated_at` — brak szkicu (aktywność = maksimum ze źródeł); zaplanowana przyszła interakcja → obiekt pominięty; deal ze zmianą tylko `updated_at` → szkic (push n8n się nie liczy)
  - Krok 3: powrót na odwiedzony etap nie tworzy nowego przejścia (`@Unique(deal, stageId)`) — szkic powstaje (znane ograniczenie R-FU-10)
  - Dni liczone kalendarzowo w `followups.timezone`: zdarzenie o 23:30 czasu Europe/Warsaw liczy się do tej doby

#### TC-FU-SCAN-003: Aktywność osób i firm deala z filtrem `deal_id`

> Decyzje: D172.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Deale DA i DB otwarte i bezczynne od N + 1; osoba O1 w `customer_deal_people` obu deali (link sprzed N + 1); firma F1 dodana dziś do `customer_deal_companies` DA
- **Kroki**:
  1. Mail O1 bez `deal_id` (dziś); wyzwól przebieg
  2. Reset; komentarz O1 z `deal_id = DB` (dziś); wyzwól przebieg
  3. Reset; interakcja F1 bez `deal_id` z wczoraj (sprzed dodania F1 do DA); wyzwól przebieg
  4. Reset; zaplanowane spotkanie O1 bez `deal_id` (za tydzień); wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: aktywność O1 bez `deal_id` liczy się dla DA i DB — brak szkiców obu deali
  - Krok 2: DB bez szkicu; DA dostaje szkic (aktywność przypięta do innego deala go nie dotyczy)
  - Krok 3: aktywność sprzed `created_at` linku się nie liczy — DA dostaje szkic
  - Krok 4: DA i DB pominięte (zaplanowana przyszła interakcja osoby deala z tym samym filtrem `deal_id`)

#### TC-FU-SCAN-004: Zakres obiektów — lejki, etapy, kontakty

> Decyzje: D173, D181, D33.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Wszystkie obiekty bezczynne od N + 1; lejek „Przetargi” w `deal_pipeline_ids`, lejek L2 poza ustawieniami; deale lejka „Przetargi” na każdym z 9 etapów, z `closure_outcome` NULL; deal `offer` z `closure_outcome = 'won'`; deal `offer` w L2; deal usunięty; osoby i firmy: powiązane z otwartym dealem, powiązane tylko z dealem zamkniętym, bez deala
- **Kroki**:
  1. Wyzwól przebieg
  2. Usuń `contact` z `deal_stage_keys`; wyzwól przebieg
  3. Spróbuj zapisać `deal_stage_keys` z etapem `won`
- **Oczekiwane wyniki**:
  - Krok 1: szkice tylko dla deali na `result_lead`, `qualify`, `contact`, `offer` z `closure_outcome` NULL w lejku „Przetargi”; brak dla `new`, `won`, `lost`, `rejected`, `cancelled`, deala z `closure_outcome`, deala z L2 i deala usuniętego; kontakty tylko powiązane z otwartym, nieusuniętym dealem
  - Krok 2: deal na `contact` bez nowego szkicu; jego otwarty szkic zamknięty jako `out_of_scope`
  - Krok 3: zapis odrzucony (etapy zamknięte niedozwolone), ustawienia bez zmian
  - `target_types` bez kontaktów → brak szkiców kontaktów

#### TC-FU-SCAN-005: Przetarg z częściami — jeden szkic na postępowanie

> Decyzje: D173, D189, D31, D132.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Postępowanie T1 z trzema częściami — deale P1, P2, P3 z `cf_source = 'ezamowienia'`, `cf_external_id` = `tender_id` T1; terminy `cf_deadline`: P1 za 10 dób, P2 za 5 dób, P3 bez terminu; deale P4 i P5 z różnymi `tender_id` i tym samym numerem ogłoszenia; deal R bez `cf_source`/`cf_external_id`; wszystkie bezczynne od N + 1
- **Kroki**:
  1. Wyzwól przebieg; odczytaj `fu_drafts.group_key`, cel i treść szkiców
  2. Odczytaj `fu_runs.note`
- **Oczekiwane wyniki**:
  - Krok 1: jeden szkic follow-upu dla T1 z `group_key = 'ezamowienia:<tender_id T1>'`, celem P2 (najbliższy przyszły termin; deal bez terminu po dealach z terminem); P1 i P3 wymienione w treści szkicu; P4 i P5 — osobne szkice (grupowanie po kluczu postępowania, nie po numerze ogłoszenia); R — `group_key = 'deal:<id R>'`
  - Klucz składany z pól własnych deala z pushu n8n, rozwiązywanych po kluczu, bez zależności od `project_costing` (moduł kosztorysu wyłączony — wynik ten sam)
  - Przy równych terminach wygrywa najdłuższa nieaktywność
  - Krok 2: licznik pominięć przez grupowanie części = 2

#### TC-FU-SCAN-006: Najwyżej jeden szkic follow-upu na osobę na dobę

> Decyzje: D173.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Osoba O1 z adresem e-mail jest osobą deali DA (termin za 4 doby, nieaktywny od N + 1) i DB (bez terminu, nieaktywny od N + 5); właściciel ma podłączoną skrzynkę; deal DC bez osób kontaktowych z adresem (zadanie, nieaktywny od N + 5), osoby O2 i O3 w `customer_deal_people`; deal DD z O2 (zadanie, nieaktywny od N + 1)
- **Kroki**:
  1. Wyzwól przebieg o 00:30 Europe/Warsaw
  2. Zamknij szkic DA jako `superseded`; wyzwól kolejny przebieg o 23:00 tej samej doby i jeden o 00:10 następnej doby
  3. Odczytaj `fu_runs.note`
- **Oczekiwane wyniki**:
  - Krok 1: szkic tylko dla DA (najbliższy termin); DB pominięty; DC — zadanie z osobami O2, O3 (dłuższa nieaktywność), więc DD pominięty
  - Krok 2: przebieg 23:00 — DB nadal pominięty (limit liczony ze wszystkich przebiegów doby); przebieg 00:10 następnej doby — DB dostaje szkic
  - Krok 3: pominięcia przez limit na osobę policzone w notce
  - Przypomnienie o terminie dla DA nie wchodzi do limitu na osobę (TC-FU-KIND-003)

#### TC-FU-SCAN-007: Kolejność deale → kontakty; kontakt z otwartym szkicem deala pomijany

> Decyzje: D173.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Bezczynne od N + 1: deal DA z osobą O1 i firmą F1; deal DB (otwarty szkic z poprzedniego przebiegu) z osobą O2; osoba O3 — adresat maila szkicu DB, poza `customer_deal_people`; osoba O4 bez otwartego szkicu deala
- **Kroki**:
  1. Wyzwól przebieg; odczytaj szkice w kolejności utworzenia
- **Oczekiwane wyniki**:
  - Szkice deali powstają przed szkicami kontaktów
  - O1 i F1 bez szkicu (otwarty szkic deala z tego przebiegu); O2 i O3 bez szkicu (otwarty szkic DB sprzed przebiegu, O3 jako adresat maila); O4 dostaje szkic

---

## 4. Scenariusze testowe: Idempotencja i zamykanie szkiców (TC-FU-IDEM) — 4 TC

#### TC-FU-IDEM-001: Jeden otwarty szkic follow-upu na obiekt i na postępowanie

> Decyzje: D174.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Deal DL1 z otwartym szkicem follow-upu; postępowanie T1 z otwartym szkicem na części P1; termin DL1 za 2 doby
- **Kroki**:
  1. Wyzwól dwa kolejne przebiegi
  2. `pg`: wstaw drugi otwarty szkic `kind = 'mail'` dla DL1; potem drugi otwarty szkic dla `group_key` T1 z celem P2; potem szkic z `deleted_at` ustawionym i szkic `superseded` dla DL1
  3. Odczytaj szkice `kind = 'reminder'` dla DL1
- **Oczekiwane wyniki**:
  - Krok 1: przebiegi pomijają DL1 i T1, brak nowych szkiców follow-upu
  - Krok 2: dwa pierwsze wstawienia odrzucone przez częściowe unikalne indeksy `(organization_id, target_type, target_id)` i `(organization_id, group_key)` (`status = 'open' AND kind <> 'reminder' AND deleted_at IS NULL`); szkice usunięty i `superseded` przyjęte
  - Krok 3: przypomnienie o terminie istnieje obok otwartego szkicu follow-upu

#### TC-FU-IDEM-002: Zamknięcie szkicu wg predykatu — przyczyna i droga

> Decyzje: D174, D172.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Otwarte szkice follow-upu dla deali DL1–DL8 i osoby O1; subscriber `persistent: true` aktywny
- **Kroki**:
  1. DL1: nowa interakcja (`customers.interaction.created`); DL2: zaplanowane spotkanie; DL3: `closure_outcome = 'won'`; DL4: etap `cancelled`; DL5: usunięcie; DL6: lejek poza ustawieniami; O1: komentarz (`customers.comment.created`)
  2. DL7: dołącz wstecz stary mail z datą sprzed N (`customers.email.linked`); DL8: wpisz dziś telefon datowany na wczoraj
  3. Odczytaj `status`, `superseded_reason`, `superseded_via`
- **Oczekiwane wyniki**:
  - Krok 3: DL1, DL2, O1 → `superseded`, `activity`; DL3, DL4 → `closed`; DL5 → `deleted`; DL6 → `out_of_scope`; wszystkie `superseded_via = 'event'`
  - DL7 zostaje otwarty (stary mail nie zamyka); DL8 → `superseded`, `activity`
  - Event tylko wyzwala sprawdzenie predykatu — DL7 pokazuje, że event bez zmiany kwalifikacji szkicu nie zamyka
  - Zdarzenia na osobach i firmach deala zamykają szkic deala z filtrem `deal_id` (jak TC-FU-SCAN-003)

#### TC-FU-IDEM-003: Rekoncyliacja na początku przebiegu

> Decyzje: D174.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Otwarte szkice dla DL1 i DL2; subscriber wstrzymany (zgubiony event)
- **Kroki**:
  1. DL1: nowa interakcja; DL2 bez zmian
  2. Wyzwól przebieg; odczytaj szkice i kolejność operacji w przebiegu
- **Oczekiwane wyniki**:
  - Szkic DL1 → `superseded`, `activity`, `superseded_via = 'reconciliation'`, zanim przebieg liczy kandydatów; DL1 nie dostaje nowego szkicu (aktywny)
  - Szkic DL2 zostaje otwarty; DL2 nie dostaje drugiego
  - Rekoncyliacja obejmuje wszystkie otwarte szkice organizacji; licznik zamkniętych w rekoncyliacji w `fu_runs.note` (D182)

#### TC-FU-IDEM-004: Zamknięcie przypomnienia o terminie

> Decyzje: D174, D177.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Postępowanie T1, części P1 i P2 z tym samym terminem X za 2 doby; otwarte przypomnienie (`group_key` T1, `term_value` X); deal DL3 z otwartym przypomnieniem
- **Kroki**:
  1. Nowa interakcja na P1 i P2
  2. Zmień termin P1 na Y
  3. Zmień termin P2 na Y
  4. DL3: przesuń zegar poza termin; wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: przypomnienie zostaje otwarte (aktywność go nie zamyka)
  - Krok 2: przypomnienie X zostaje (P2 w zakresie nadal ma termin X)
  - Krok 3: przypomnienie X → `superseded`, `term_changed`; nowe przypomnienie dla Y
  - Krok 4: przypomnienie DL3 zamknięte (termin minął)
  - Usunięcie lub zamknięcie ostatniej części z terminem X zamyka przypomnienie z przyczyną wg stanu części docelowej (`deleted`, `closed`)

---

## 5. Scenariusze testowe: Wyciszenie po odrzuceniu (TC-FU-MUTE) — 1 TC

#### TC-FU-MUTE-001: Odrzucenie wycisza obiekt na `mute_days`; przypomnienie nie wycisza

> Decyzje: D175, D181.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: N = 14; deale DL1 (`mute_days` domyślne = N), DL2 (organizacja z `mute_days = 30`) z otwartymi szkicami follow-upu; deal DL3 z otwartym przypomnieniem dla terminu X
- **Kroki**:
  1. Odrzuć szkice DL1 i DL2; odczytaj `muted_until`
  2. Przesuń zegar o N; wyzwól przebieg; potem o 30 od decyzji i znowu przebieg
  3. Odrzuć przypomnienie DL3; wyzwól przebieg
  4. Spróbuj zapisać `mute_days = 0`
- **Oczekiwane wyniki**:
  - Krok 1: `muted_until = decyzja + mute_days`; decyzja liczy się jako aktywność (D172)
  - Krok 2: po N — DL1 dostaje szkic (przy `mute_days ≤ N` decyduje N), DL2 nie; po 30 — DL2 dostaje szkic
  - Krok 3: DL3 nie jest wyciszony (`muted_until` bez zmian); przypomnienie dla X nie wraca
  - Krok 4: zapis odrzucony (minimum 1)

---

## 6. Scenariusze testowe: Rodzaje szkiców i przypomnienia (TC-FU-KIND) — 3 TC

#### TC-FU-KIND-001: Mail albo zadanie

> Decyzje: D177.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: Bezczynne deale: DA (osoba z adresem, właściciel ze skrzynką), DB (osoba z adresem, właściciel bez skrzynki), DC (osoba bez adresu); organizacja O2 z `kinds` bez `mail`
- **Kroki**:
  1. Wyzwól przebieg; odczytaj `kind`
  2. Organizacja O2: deal jak DA; wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: DA → `mail`; DB i DC → zadanie
  - Krok 2: brak szkicu `mail` (rodzaj spoza listy dozwolonych nie powstaje)

#### TC-FU-KIND-002: Przypomnienie o terminie — okno, pole terminu, niezależność od aktywności

> Decyzje: D177, D181.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Unit + Integration
- **Warunki wstępne**: `reminder_days_before` = 3, `reminder_term_field_key` = `cf_deadline`, strefa Europe/Warsaw; deale z `cf_deadline` za 4 doby, za 3 doby, dziś później, wczoraj; deal aktywny dziś z terminem za 2 doby; deal wyciszony (`muted_until` w przyszłości) z terminem za 2 doby; deal bez pola `cf_deadline` z `expected_close_at` za 2 doby; organizacja z `reminder_term_field_key` = inne pole własne
- **Kroki**:
  1. Wyzwól przebieg o 00:30 Europe/Warsaw
  2. Organizacja z innym kluczem pola: wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: przypomnienie `kind = 'reminder'` dla deali z terminem za 3 doby i dziś później, dla deala aktywnego, wyciszonego i bez `cf_deadline` (termin z `expected_close_at`); brak dla terminu za 4 doby i dla terminu, który minął
  - Doby liczone kalendarzowo w `followups.timezone`; dla deala z n8n `expected_close_at` (UTC) i `cf_deadline` dają ten sam termin
  - Krok 2: termin czytany z pola wskazanego kluczem (rozwiązywanie po kluczu, bez UUID)

#### TC-FU-KIND-003: Jedno przypomnienie na postępowanie i termin

> Decyzje: D177, D173.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Postępowanie T1: części P1, P2 z terminem X za 2 doby, P3 z terminem Y za 3 doby; `max_drafts_per_run` = 3; osoba O1 w P1 z otwartym szkicem follow-upu innego deala tej doby
- **Kroki**:
  1. Wyzwól przebieg
  2. Odrzuć przypomnienie X; wyzwól przebieg
  3. `pg`: wstaw drugie przypomnienie `(group_key T1, term_value X)` w statusie `open`
  4. Zmień termin P3 z Y na Z; wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: dwa przypomnienia: X (cel wg reguły kolizji D173, druga część wymieniona w treści) i Y; limit na osobę nie blokuje przypomnienia P1; oba wliczone do `max_drafts_per_run`
  - Krok 2: przypomnienie X nie wraca
  - Krok 3: odrzucone przez unikalny indeks `(organization_id, group_key, term_value) WHERE kind = 'reminder' AND deleted_at IS NULL` (wszystkie statusy)
  - Krok 4: nowe przypomnienie Z; przypomnienie Y → `superseded`, `term_changed`

---

## 7. Scenariusze testowe: Decyzje o szkicach (TC-FU-DEC) — 3 TC

#### TC-FU-DEC-001: Zatwierdzenie zadania i przypomnienia — interakcja `task`

> Decyzje: D176, D171.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Szkic zadania dla deala DL1 (opiekun U1); przypomnienie dla DL2 (opiekun U2 nieaktywny); szkic zadania dla DL3 bez opiekuna; zatwierdzający A1 (administrator)
- **Kroki**:
  1. U1 zatwierdza szkic DL1; A1 zatwierdza DL2 i DL3
  2. Odczytaj interakcje, widżet todo, status szkiców
- **Oczekiwane wyniki**:
  - Interakcje utworzone komendą `customers.interactions.create`, `interaction_type = 'task'`, widoczne w widżecie todo
  - DL1: właściciel interakcji U1, autor U1; DL2 i DL3: właściciel = zatwierdzający A1 (opiekun nieaktywny albo brak), autor A1
  - Szkice w statusie zatwierdzonym; decyzja jest aktywnością obiektu (D172)

#### TC-FU-DEC-002: Zatwierdzenie maila = przekazanie do okna wysyłki CRM

> Decyzje: D176, D182.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Szkic `mail` dla osoby O1 (opiekun U1 ze skrzynką, z `customers.email.compose`); przechwytywanie wychodzącej poczty i wywołań dostawców w środowisku testowym
- **Kroki**:
  1. U1 zatwierdza szkic
  2. Odczytaj status szkicu, przechwyconą pocztę, powiadomienia
  3. U1 wysyła mail ze zwykłego okna CRM
- **Oczekiwane wyniki**:
  - Krok 1: otwiera się zwykłe okno wysyłki CRM (`POST /api/customers/people/[id]/emails`) z treścią szkicu
  - Krok 2: szkic `handed_off`; zero wysłanych maili i zero wywołań dostawcy z modułu `crm_followups`; powiadomienia modułu tylko in-app; liczniki i notka mówią „przekazano do wysyłki”, nigdy „wysłano”
  - Krok 3: mail wysyła ścieżka CRM (`customers.email.compose`), nie moduł

#### TC-FU-DEC-003: Decyzje tylko z sesji użytkownika — każdy klucz API → `403 FORBIDDEN`

> Decyzje: D176, D179.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: API + Integration
- **Warunki wstępne**: Szkic S1 opiekuna U1 (rola z `crm_followups.drafts.decide` i `crm_followups.drafts.manage_all`); klucz API K1 z rolą administratora; efemeryczny klucz sesji czatu `ai_assistant` U1 (dziedziczy role U1); klucz n8n
- **Kroki**:
  1. Każdym kluczem: approve, reject, PATCH, reassign S1
  2. Wywołaj komendy approve i reject bezpośrednio z aktorem `api_key:*`
  3. U1 z sesji: approve S1
- **Oczekiwane wyniki**:
  - Krok 1: każde wywołanie → `403 FORBIDDEN` niezależnie od ról i uprawnień; S1 bez zmian
  - Krok 2: komenda odmawia (sprawdzenie powtórzone w komendach); S1 bez zmian
  - Krok 3: zatwierdzenie przyjęte

---

## 8. Scenariusze testowe: Uprawnienia i widoczność (TC-FU-ACL) — 2 TC

#### TC-FU-ACL-001: Kto widzi szkice

> Decyzje: D179, D193.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: API + Integration
- **Warunki wstępne**: Handlowcy H1, H2 z `crm_followups.view` i `crm_followups.drafts.decide`; administratorzy A1, A2 z `crm_followups.drafts.manage_all`; użytkownik U0 bez `crm_followups.view`; szkice: S1 (obiekt H1), S2 (obiekt H2), S3 (obiekt bez opiekuna), S4 (opiekun nieaktywny), S5 (deal z n8n bez opiekuna, `crm.n8n_default_deal_owner_user_id` = null), S6 (deal z n8n z opiekunem z tego ustawienia = H1)
- **Kroki**:
  1. H1, A1, U0: lista szkiców i odczyt S2 po ID
- **Oczekiwane wyniki**:
  - H1 widzi S1 i S6; odczyt S2 → 404 (nie ujawnia istnienia)
  - A1 widzi wszystkie; S3, S4, S5 widzą i rozstrzygają administratorzy (A1, A2)
  - U0 → `403 FORBIDDEN`

#### TC-FU-ACL-002: Uprawnienia decyzji, ustawień i wyzwalania

> Decyzje: D179.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: API + Integration
- **Warunki wstępne**: Szkic zadania S1 i maila S2 opiekuna H1; H1 bez `customers.interactions.manage`; H2 bez `crm_followups.drafts.decide`; klucz API n8n z wyłącznie `crm_followups.run`; użytkownik bez `crm_followups.settings.manage`
- **Kroki**:
  1. H1 zatwierdza S1; H1 zatwierdza S2 bez `customers.email.compose`
  2. H2 zatwierdza swój szkic
  3. Klucz n8n: `POST /api/crm-followups/runs`; lista szkiców; approve
  4. Użytkownik bez `settings.manage`: zmiana ustawień firmy
- **Oczekiwane wyniki**:
  - Krok 1: oba → `403 FORBIDDEN` (brak uprawnienia celu)
  - Krok 2: `403 FORBIDDEN`
  - Krok 3: przebieg przyjęty; lista szkiców → `403 FORBIDDEN`; approve → `403 FORBIDDEN`
  - Krok 4: `403 FORBIDDEN`, ustawienia bez zmian
  - Klucz n8n nie ma `crm_followups.drafts.*` ani `customers.email.compose` (asercja na konfiguracji klucza)

---

## 9. Scenariusze testowe: Wyzwalacze i przebiegi (TC-FU-RUN) — 5 TC

#### TC-FU-RUN-001: Job schedulera zakładany i usuwany komendą ustawień

> Decyzje: D180, D94.

- **Priorytet**: P1 | **Etap**: v2 (warunek etapu kodu: włączony moduł `scheduler`) | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Moduł `scheduler` włączony; organizacja O1 z `followups.enabled = false`; `followups.timezone` = Europe/Warsaw
- **Kroki**:
  1. Włącz `followups.enabled`; odczytaj `scheduled_jobs`
  2. Administrator zmienia godzinę joba na 05:00; wyłącz i ponownie włącz moduł w ustawieniach
  3. Środowisko z wyłączonym `scheduler`: przełącz `followups.enabled`
  4. Wykonaj job; odczytaj `fu_runs.run_key`
- **Oczekiwane wyniki**:
  - Krok 1: job `scheduled_jobs` ze scope organizacji, `0 3 * * *`, strefa = `followups.timezone`, worker `schedulerSafe` z `schedulerRequiredFeatures`; job założyła komenda zmiany ustawień (nie `setup.ts`)
  - Krok 2: wyłączenie usuwa job; ponowne włączenie przywraca job z godziną 05:00 (nie zakłada nowego z domyślną)
  - Krok 3: komenda ustawień pomija job bez błędu
  - Krok 4: `run_key` = klucz idempotencji schedulera; godzina żyje tylko w `scheduled_jobs`

#### TC-FU-RUN-002: `POST /api/crm-followups/runs` — `Idempotency-Key` i stany `run_key`

> Decyzje: D180.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: API + `pg`
- **Warunki wstępne**: Klucz API z `crm_followups.run`; `OM_CRM_FOLLOWUPS_RUN_STALE_MINUTES` = 10 (wartość testowa)
- **Kroki**:
  1. POST bez `Idempotency-Key`
  2. POST z kluczem K1; po zakończeniu ponów z K1
  3. Przebieg K2 kończy się `failed`; ponów z K2
  4. Przebieg K3 `running` z `heartbeat_at` starszym niż 10 minut; ponów z K3
  5. Przebieg K4 `running` z bieżącym `heartbeat_at`; POST z K5
  6. CLI: wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: żądanie odrzucone, brak wiersza w `fu_runs`
  - Krok 2: ponowienie zwraca istniejący przebieg `finished`, bez nowego wiersza (`run_key` unikalny per organizacja)
  - Krok 3 i 4: wznowienie tego samego wiersza
  - Krok 5: wiersz K5 `skipped` z `skip_reason = 'concurrent'`
  - Krok 6: przebieg trafia do kolejki `crm-followups-scan` jak pozostałe wyzwalacze

#### TC-FU-RUN-003: Jeden przebieg na organizację naraz; moduł wyłączony; heartbeat

> Decyzje: D180, D178.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Organizacje O1, O2; `OM_CRM_FOLLOWUPS_SCAN_BATCH_SIZE` mniejszy niż liczba obiektów O1
- **Kroki**:
  1. Dwa wyzwalacze O1 równocześnie (różne klucze); jeden wyzwalacz O2
  2. `pg`: wstaw drugi wiersz `running` dla O1
  3. Odczytaj `heartbeat_at` w trakcie przebiegu O1
  4. O1: `followups.enabled = false`; wyzwól przebieg
- **Oczekiwane wyniki**:
  - Krok 1: jeden przebieg O1 `running`, drugi `skipped` z `skip_reason`; O2 działa równolegle
  - Krok 2: odrzucone przez częściowy unikalny indeks `fu_runs (organization_id) WHERE status = 'running'`
  - Krok 3: `heartbeat_at` rośnie po każdej partii
  - Krok 4: wiersz `skipped` z `skip_reason`, brak szkiców

#### TC-FU-RUN-004: Notka z przebiegu i powiadomienia in-app

> Decyzje: D182, D170.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Przebieg tworzący szkice dla opiekunów U1 i U2 oraz szkic bez opiekuna; pominięcia przez `max_drafts_per_run`, grupowanie części i limit na osobę; szkic zamknięty w rekoncyliacji; druga organizacja bez kandydatów
- **Kroki**:
  1. Wyzwól przebieg; odczytaj `fu_runs.note`, `notifications`, `progress_jobs`
  2. Wyzwól przebieg w organizacji bez kandydatów
- **Oczekiwane wyniki**:
  - Krok 1: notka z licznikami (utworzone, pominięte przez limit przebiegu, przez grupowanie części, przez limit na osobę, zamknięte w rekoncyliacji) i linkiem do listy szkiców przebiegu; powiadomienie in-app dla U1, U2 i administratorów (szkic bez opiekuna); brak wpisu w `progress_jobs`; słownictwo „przekazano do wysyłki”, nigdy „wysłano”
  - Krok 2: tylko notka w `fu_runs`, brak powiadomień

#### TC-FU-RUN-005: Limit `max_drafts_per_run`

> Decyzje: D181, D182, D173.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration
- **Warunki wstępne**: 250 kwalifikujących się obiektów, w tym 10 przypomnień; `max_drafts_per_run` domyślne (200)
- **Kroki**:
  1. Wyzwól przebieg
  2. Ustaw `max_drafts_per_run` = 20; wyzwól kolejny przebieg
- **Oczekiwane wyniki**:
  - Krok 1: 200 szkiców łącznie z przypomnieniami; pozostałe policzone w notce jako pominięte przez limit
  - Krok 2: najwyżej 20 nowych szkiców
  - Relacja z `OM_CRM_FOLLOWUPS_MAX_DRAFTS_PER_RUN` — bez asercji (wniosek 3)

---

## 10. Scenariusze testowe: Moduł i dane (TC-FU-MOD) — 1 TC

#### TC-FU-MOD-001: Moduł opcjonalny z dwiema tabelami; szkice poza interakcjami CRM

> Decyzje: D171.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Moduł `crm_followups` w `apps/mercato/src/modules`; deal DL1 z licznikiem otwartych aktywności i `next_interaction_at`
- **Kroki**:
  1. `pg`: tabele z prefiksem `fu_`
  2. Utwórz szkic zadania dla DL1; odczytaj `customer_interactions`, `inbox_proposals`, licznik otwartych aktywności i `next_interaction_at` DL1
  3. Zatwierdź szkic
  4. Build bez modułu `crm_followups`
- **Oczekiwane wyniki**:
  - Krok 1: tylko `fu_drafts` i `fu_runs`
  - Krok 2: szkic nie ma wiersza w `customer_interactions` ani `inbox_proposals`; licznik i `next_interaction_at` bez zmian
  - Krok 3: dopiero zatwierdzenie tworzy interakcję `task` (TC-FU-DEC-001)
  - Krok 4: aplikacja działa bez modułu (brak tras i UI modułu); diff modułu bez zmian w `packages/core`

---

## 11. Scenariusze testowe: Ustawienia firmy (TC-FU-SET) — 1 TC

#### TC-FU-SET-001: Parametry firmy w ModuleConfigService i parametry instancji

> Decyzje: D181, D69.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Nowa organizacja; administrator z `crm_followups.settings.manage`
- **Kroki**:
  1. Odczytaj ustawienia (`org:{id}:settings`)
  2. Zapisz każdy parametr z wartością spoza zakresu: `mute_days = 0`, `deal_stage_keys` z `lost`
  3. Zmień `followups.timezone` na Europe/London; odczytaj liczenie doby i strefę joba
- **Oczekiwane wyniki**:
  - Krok 1: `followups.enabled`, `inactivity_days` 14, `mute_days` = N, `timezone`, `target_types`, `deal_pipeline_ids`, `deal_stage_keys` (`result_lead`, `qualify`, `contact`, `offer`), `kinds`, `reminder_days_before` 3, `reminder_term_field_key` `cf_deadline`, `max_drafts_per_run` 200, `templates`; brak `tender_group_field_key`, `contact_scope`, `contact_lifecycle_stages`, `content_mode`
  - Krok 2: oba zapisy odrzucone, ustawienia bez zmian
  - Krok 3: jedna strefa dla liczenia dni i joba schedulera (TC-FU-RUN-001)
  - Parametry instancji (env) obecne w konfiguracji: `OM_CRM_FOLLOWUPS_ENABLED`, `OM_CRM_FOLLOWUPS_SCAN_BATCH_SIZE`, `OM_CRM_FOLLOWUPS_MAX_DRAFTS_PER_RUN`, `OM_CRM_FOLLOWUPS_WORKER_CONCURRENCY`, `OM_CRM_FOLLOWUPS_RUN_STALE_MINUTES` (od `heartbeat_at`, TC-FU-RUN-002)

---

## 12. Scenariusze testowe: Izolacja organizacji (TC-FU-TEN) — 1 TC

#### TC-FU-TEN-001: Organizacja i tenant w każdym rekordzie i zapytaniu

> Decyzje: D178, D47.

- **Priorytet**: P0 | **Etap**: v2 | **Poziom**: API + Integration + `pg`
- **Warunki wstępne**: Tenant T z organizacjami O1 i O2; tenant T2 z organizacją O3; klucz API O1 z `crm_followups.run`; obiekty kwalifikujące się we wszystkich organizacjach
- **Kroki**:
  1. Kluczem O1: POST przebiegu z payloadem wskazującym O2
  2. `pg`: `organization_id` i `tenant_id` we wszystkich wierszach `fu_*`
  3. Administrator O1: lista i odczyt po ID szkicu O2
  4. O2: `followups.enabled = false`; kill-switch `feature_toggles` dla tenanta T2
- **Oczekiwane wyniki**:
  - Krok 1: przebieg dotyczy wyłącznie O1 (scope z kontekstu klucza API, nie z payloadu); brak szkiców O2
  - Krok 2: każdy wiersz ma oba pola zgodne z organizacją przebiegu
  - Krok 3: szkic O2 niewidoczny (404)
  - Krok 4: O2 bez przebiegów (`skipped`), O1 działa; T2 — moduł wyłączony dla tenanta

---

## 13. Scenariusze testowe: Audyt i szyfrowanie (TC-FU-AUD) — 1 TC

#### TC-FU-AUD-001: Audyt przez komendy, bez treści; szyfrowanie pól

> Decyzje: D183.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Przebieg z wyzwalacza n8n tworzący szkic `mail` z treścią, adresem i nazwą obiektu
- **Kroki**:
  1. Zatwierdź jeden szkic, odrzuć drugi z powodem
  2. Odczytaj `action_logs`/`audit_logs`, eventy, log workera
  3. `pg`: kolumny `payload`, `target_label_snapshot`, adres odbiorcy w `fu_drafts`
- **Oczekiwane wyniki**:
  - Krok 2: wpisy audytu z komend (brak własnej tabeli audytu); snapshoty i eventy zawierają tylko ID i statusy; powód odrzucenia i źródło wyzwalacza w metadanych komendy; log workera tylko ID i liczniki — bez treści, adresów i nazw obiektów
  - Krok 3: wartości zaszyfrowane wg mapy szyfrowania modułu (odczyt przez API zwraca jawną treść uprawnionemu)

---

## 14. Scenariusze testowe: Treść z szablonów (TC-FU-TPL) — 1 TC

#### TC-FU-TPL-001: Treść wyłącznie z szablonów pl/en

> Decyzje: D184, D181.

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Szablony domyślne pl i en; organizacja O1 z nadpisanym szablonem maila pl; śledzenie wywołań fabryki modeli `ai_assistant`
- **Kroki**:
  1. Wyzwól przebieg dla obiektów z kontaktem pl i en w O1 oraz w organizacji bez nadpisań
  2. Odczytaj treść szkiców, wywołania modeli, zależności pakietu modułu
- **Oczekiwane wyniki**:
  - Treść = szablon w języku kontaktu; w O1 — nadpisany szablon
  - Zero wywołań LLM; brak nowych zależności w module

---

## 15. Zbiory danych testowych (Fixtures)

| Zbiór | Zawartość |
|---|---|
| Organizacje | O1, O2 w tenancie T; O3 w tenancie T2; ustawienia domyślne i nadpisane |
| Lejek | „Przetargi” (9 etapów, D33) w ustawieniach; drugi lejek poza ustawieniami |
| Deale | na każdym etapie; z `closure_outcome`; usunięty; postępowanie z częściami (`cf_source`, `cf_external_id`, `cf_deadline`); bez pól postępowania; z n8n z opiekunem i bez |
| Kontakty | osoby z adresem i bez; firmy; powiązania z deali otwartych i zamkniętych |
| Aktywność | interakcje zakończone i zaplanowane, maile, todo, komentarze, legacy `customer_activities`, przejścia etapów |
| Użytkownicy i klucze | handlowcy, administratorzy, użytkownik bez `view`; klucz administratora, klucz n8n (`crm_followups.run`), efemeryczny klucz sesji `ai_assistant` |
| Zegar | wstrzykiwany czas dla granic N, doby i terminu |

---

## 16. Kryteria akceptacji

| Kryterium | Próg | Status |
|---|---|---|
| P0 | 100% scenariuszy P0 przechodzi | TBD |
| P1 | ≥ 95% przechodzi, odstępstwa z ticketem | TBD |
| Brak automatycznej wysyłki | TC-FU-DEC-002 bez ani jednego maila z modułu | TBD |
| Decyzje tylko z sesji | TC-FU-DEC-003 — każdy klucz API `403 FORBIDDEN` | TBD |
| Izolacja | TC-FU-TEN-001 bez wycieku | TBD |

---

## 17. Wnioski do specyfikacji (luki — reguł brak w rejestrze @0be9356; nie zgadywano)

1. **Kod odrzucenia ustawień spoza zakresu** (TC-FU-SCAN-004 krok 3, TC-FU-MUTE-001 krok 4, TC-FU-SET-001 krok 2) — D175 i D181 podają ograniczenia (`mute_days` min 1, etapy zamknięte niedozwolone), nie podają kodu błędu. TC sprawdza odrzucenie i brak zmian.
2. **Kod odrzucenia `POST /runs` bez `Idempotency-Key`** (TC-FU-RUN-002 krok 1) — D180 mówi „wymagany”, bez kodu.
3. **Relacja `max_drafts_per_run` (firma) i `OM_CRM_FOLLOWUPS_MAX_DRAFTS_PER_RUN` (instancja)** oraz znaczenie `OM_CRM_FOLLOWUPS_ENABLED` i `OM_CRM_FOLLOWUPS_WORKER_CONCURRENCY` (TC-FU-RUN-005, TC-FU-SET-001) — D181 wymienia parametry, nie reguły pierwszeństwa.
4. **Brak uprawnienia widoku obiektu przy zatwierdzaniu** (TC-FU-ACL-002) — D179 wymaga widoku obiektu, kodu nie podaje (404 dotyczy szkicu cudzego, `403 FORBIDDEN` — braku feature'a).
5. **Nazwa statusu po zatwierdzeniu zadania i odrzuceniu** (TC-FU-DEC-001, TC-FU-MUTE-001) — rejestr nazywa `open`, `superseded`, `handed_off`, `running`/`finished`/`failed`/`skipped`; nazw statusów zatwierdzonego zadania i odrzuconego szkicu nie podaje. TC sprawdza skutek, nie literał.
6. **Rodzaj spoza listy `kinds`** (TC-FU-KIND-001 krok 2) — czy przy braku `mail` powstaje zadanie, czy nic; TC sprawdza tylko brak szkicu `mail`.
7. **Treść szkicu przy częściach** (TC-FU-SCAN-005, TC-FU-KIND-003) — rejestr mówi, że pozostałe części są „wymienione w treści”; formatu nie podaje.
8. **`cf_external_id` deala części po wdrożeniu klucza D189** — rejestr („Otwarte”) zostawia do potwierdzenia przez Enkę, czy zostaje `tender_id` bez `#<nr części>`; TC-FU-SCAN-005 zakłada stan obecny (`tender_id`) i wymaga przeglądu po potwierdzeniu.
9. **Warunek etapu kodu `scheduler` i `QUEUE_STRATEGY`** (TC-FU-RUN-001) — scenariusz niewykonywalny do zgody Marka (D180, D94).

---

## 18. Podsumowanie

**Liczba scenariuszy**: 30 (wszystkie v2; P0: 17, P1: 13)
**Liczba wniosków do speki**: 9 (otwarte: 1–9)
**Status**: SPEC ONLY — bez kodu

---

## Załącznik: Traceability D → TC (macierz decyzji)

Źródło: `.ai/decisions.md` @0be9356 (PR #33), sekcja „Decyzje D170–D184”: 15 decyzji, wszystkie aktywne (v2). Każda ma co najmniej jeden TC.

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| **D170** | Worker tworzy szkice (mail, zadanie, przypomnienie) dla obiektów bez aktywności od N (domyślnie N = 14); nic nie wychodzi automatycznie; wyzwalacz z zewnątrz; notka z przebiegu | TC-FU-SCAN-001, TC-FU-RUN-004 | decyzja biznesowa Marka |
| **D171** | Moduł `crm_followups` (`fu_`), tylko `fu_drafts` i `fu_runs`; szkice poza `customer_interactions` i `inbox_proposals`; zatwierdzone zadanie = interakcja `task`; zero zmian w `packages/core` | TC-FU-MOD-001, TC-FU-DEC-001 | |
| **D172** | Aktywność = maksimum ze źródeł; osoby i firmy deala z filtrem `deal_id` od daty linku; zaplanowana interakcja = aktywność; `updated_at` się nie liczy; dni kalendarzowe w `followups.timezone` | TC-FU-SCAN-002, TC-FU-SCAN-003, TC-FU-IDEM-002 | R-FU-10 w TC-FU-SCAN-002 |
| **D173** | Zakres deali i kontaktów; jeden szkic na postępowanie (klucz D189 bez części, `group_key`); reguła kolizji; jeden szkic na osobę na dobę; deale przed kontaktami | TC-FU-SCAN-004, TC-FU-SCAN-005, TC-FU-SCAN-006, TC-FU-SCAN-007, TC-FU-KIND-003, TC-FU-RUN-005 | wnioski 7, 8 |
| **D174** | Częściowe unikalne indeksy; predykat zamknięcia `superseded` z `superseded_reason` i `superseded_via`; zamknięcie przypomnienia per postępowanie i termin; rekoncyliacja na starcie przebiegu | TC-FU-IDEM-001, TC-FU-IDEM-002, TC-FU-IDEM-003, TC-FU-IDEM-004 | |
| **D175** | Odrzucenie wycisza (`muted_until`, `mute_days` min 1); decyzja = aktywność; przypomnienie nie wycisza | TC-FU-MUTE-001 | wnioski 1, 5 |
| **D176** | Zatwierdzenie zadania → `customers.interactions.create`, właściciel i autor; mail → `handed_off` i okno wysyłki CRM; decyzje tylko z sesji, klucz API → `403 FORBIDDEN` także w komendach | TC-FU-DEC-001, TC-FU-DEC-002, TC-FU-DEC-003 | |
| **D177** | Mail albo zadanie; przypomnienie `reminder` w oknie `reminder_days_before` niezależnie od aktywności; pole terminu po kluczu; deduplikacja `(group_key, term_value)`; `term_changed` | TC-FU-KIND-001, TC-FU-KIND-002, TC-FU-KIND-003, TC-FU-IDEM-004 | wniosek 6 |
| **D178** | `organization_id` i `tenant_id` w każdym rekordzie i zapytaniu; scope z payloadu schedulera albo klucza API; `followups.enabled` per organizacja; `feature_toggles` jako kill-switch | TC-FU-TEN-001, TC-FU-RUN-003 | |
| **D179** | Feature'y `crm_followups.*`; widoczność opiekun/administrator; obiekt bez opiekuna → administratorzy; cudzy szkic → 404; brak feature'a → `403 FORBIDDEN`; klucz n8n tylko `run` | TC-FU-ACL-001, TC-FU-ACL-002, TC-FU-DEC-003 | wniosek 4 |
| **D180** | Wyzwalacze → kolejka `crm-followups-scan`: scheduler, `POST /runs` z `Idempotency-Key`, CLI; `run_key`; jeden przebieg naraz; `skipped`; `heartbeat_at`; wznowienie | TC-FU-RUN-001, TC-FU-RUN-002, TC-FU-RUN-003 | wnioski 2, 9 |
| **D181** | Parametry firmy (`org:{id}:settings`) z domyślnymi; usunięte parametry; parametry instancji (env) | TC-FU-SET-001, TC-FU-SCAN-001, TC-FU-SCAN-004, TC-FU-KIND-002, TC-FU-RUN-005, TC-FU-MUTE-001, TC-FU-TPL-001 | wnioski 1, 3 |
| **D182** | Notka `fu_runs.note` z licznikami i linkiem; powiadomienia in-app do właścicieli i administratorów; „przekazano do wysyłki”; nie w `progress_jobs` | TC-FU-RUN-004, TC-FU-RUN-005, TC-FU-DEC-002 | |
| **D183** | Audyt przez komendy, tylko ID i statusy; powód i źródło w metadanych; szyfrowanie `payload`, `target_label_snapshot`, adresu; logger bez treści | TC-FU-AUD-001 | |
| **D184** | Treść tylko z szablonów pl/en, nadpisywalnych per firma; bez LLM i nowych zależności | TC-FU-TPL-001 | |
| **D193** | Domyślny opiekun deala z n8n — kontekst: szkice deala bez opiekuna do administratorów | TC-FU-ACL-001 | reguła główna: plan costing TC-DEAL-022 |

---

## Changelog

### Rev 1 — 2026-10-31 (pierwsza wersja; rejestr @0be9356, PR #33)

- Niezależna sesja planu (P4): jedyne źródło — `.ai/decisions.md` @0be9356; bez speki i bez briefu
- 30 TC dla D170–D184 (v2; P0: 17, P1: 13); kontekstowo D193 (TC-FU-ACL-001)
- Wnioski 1–9 (kody i reguły, których rejestr nie podaje)
