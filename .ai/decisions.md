# Klin #1 — dziennik decyzji

**Stan na:** 2026-10-23
**Zasada:** nowa decyzja = nowy wiersz. Gdy decyzja zmienia wcześniejszą, stary wiersz dostaje status `superseded` (z odwołaniem do nowego numeru) i **nie jest usuwany**. Decyzje biznesowe/produktowe podejmuje Marek; procesowe — Koordynator i Cezar.

Data „≤2026-10-20” oznacza decyzję obowiązującą na 2026-10-20, bez potwierdzonej dokładnej daty w źródłach.

## Produkt i zakres

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D1 | ≤2026-10-20 | Klin #1 = agregator przetargów (e-Zamówienia: Polska, TED: wszystkie kraje) + CRM budowlany na Open Mercato (open-mercato.pl). | Marek | active |
| D2 | ≤2026-10-20 | Pierwsza nisza: prefabrykacja żelbetowa; cel: cała budowlanka, więc wszystko wielosegmentowe. | Marek; push-contract §7 | active |
| D3 | 2026-10-18 | Do OM idzie wszystko, bez progu; `prefab_score` tylko do filtrowania i sortowania. | push-contract §0, §7 | superseded (D4) |
| D4 | ≤2026-10-20 | n8n (Enka) pushuje przetargi jako deale do lejka „Przetargi” przy score ≥ 50. | Marek | active |
| D5 | ≤2026-10-20 | Duplikaty ofert: jedna oferta na inwestycję do wielu GW, wygrać można najwyżej jedną. Pole `offer_role` = `primary`/`alternative`. Przy zapisie oferty system sprawdza ofertę do innego wykonawcy na tę samą inwestycję i pokazuje „istnieje oferta dla innego wykonawcy, wskaż główną”. | Marek; push-contract §9.1 | active |
| D6 | 2026-10-19 | Każdy przetarg dostaje kod inwestycji. Priorytet: identyfikator e-Zamówienia → TED → BIP → własny `INV-YYYY-NNNNNN`. Podobieństwo nazwy tylko jako podpowiedź. | Marek (rev 7); plan testów §22 pkt 5 | active |
| D7 | 2026-10-18 | Projekt/Budowa jako encja `klin:project` w Data designerze, z relacją do deali. | analiza §2, push-contract §9.5 | superseded (D63) |
| D8 | 2026-10-18 | Koszty i kalkulacje wiszą na dealu. | analiza §2 | superseded (D10) |

## Moduł kalkulacji (costing) — tylko specyfikacja

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D9 | ≤2026-10-20 | Kalkulator działa jak Excel i importuje XLSX. | Marek | active |
| D10 | 2026-10-19 | Kalkulacja może istnieć bez deala. | Marek; cost spec A4 | active |
| D11 | ≤2026-10-20 | PDF oferty w pierwszej wersji. | Marek | active |
| D12 | ≤2026-10-20 | Start od własnego cennika użytkownika; później zgodność z Sekocenbud i innymi cennikami. | Marek; cost spec §13 | active |
| D13 | 2026-10-19 | Widoczność kalkulacji i marży to ustawienie per firma (w tym widoczność marży po zamknięciu deala). | Marek (rev 7); plan testów §22 pkt 6 | superseded (D48, D49) |
| D14 | 2026-10-19 | Marża liczona od ceny sprzedaży: (cena − koszt) / cena. | plan testów §22 pkt 3 | active |
| D15 | 2026-10-19 | Firma = organizacja w OM. | plan testów §22 pkt 4 | active |
| D16 | 2026-10-19 | Zaokrąglenie half-up do 2 miejsc per linia, konfigurowalne per firma; sumy z zaokrąglonych linii. | plan testów §22 pkt 1 | active |
| D17 | 2026-10-19 | Słownik jednostek z przelicznikami. | plan testów §22 pkt 2 | active |
| D18 | 2026-10-18 | Nie włączamy całego modułu `sales` pod kalkulator; własny moduł aplikacji `project_costing`. | analiza F2 | active |

## Moduł harmonogramu (schedule) — tylko specyfikacja

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D19 | 2026-10-19 | Harmonogram to osobny moduł, opcjonalny per firma (część firm używa Excela lub innych narzędzi). | Marek (rev 7) | active |
| D20 | 2026-10-19 | Kalkulacja i prognoza działają bez harmonogramu: przez `ScheduleSource` albo import z Excela. | Marek (rev 7); cost spec §7a | active |
| D21 | 2026-10-20 | Gantt budowany samodzielnie, bez licencji SVAR PRO (Marek: „Zostaje własna implementacja”, mimo wyliczenia Kod, że licencja $1,899 jest tańsza). | Marek; przegląd Kod pkt 20 | active |
| D22 | 2026-10-19 | Auto-przesuwanie następników z ręcznym przypięciem zadania. | Marek (rev 7) | active |
| D23 | 2026-10-19 | Jeden Gantt na inwestycję. | Marek (rev 7) | active |
| D24 | 2026-10-19 | Harmonogram ofertowy staje się wykonawczym po wygraniu deala (automatycznie). | Marek (rev 7); plan testów §22 pkt 7 | active |
| D25 | 2026-10-19 | Import MS Project dopiero od v2. | Marek (rev 7) | active |
| D26 | ≤2026-10-20 | Harmonogram na razie wewnętrzny, przygotowany na późniejszą integrację zewnętrzną. | Marek | active |
| D27 | ≤2026-10-20 | Dane do PDF z profilu firmy. | Marek | superseded (D60) |

## MVP

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D28 | 2026-10-19 | MVP: costing 17 d + schedule 14 d (pełny Gantt), PDF i wersje w v1; razem 94,5 d. | cost spec §14 (rev 7) | superseded (D29) |
| D29 | ≤2026-10-20 | MVP przycięte wg Kod: siatka, tryby A i C, prosty cennik, mark-sent ze snapshotem i PDF, apply-to-deal, RBAC, partie produkcji bez Gantta. | przegląd Kod pkt 15 | superseded (D50) |
| D30 | ≤2026-10-20 | Bez formuł w MVP; w v1 `quantity_expr` z bezpiecznym parserem (bez eval). | przegląd Kod pkt 14 | active |

## Faza 0 — integracja n8n → OM

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D31 | 2026-10-18 | 1 postępowanie (`tender_id`) = 1 deal; kolejne ogłoszenia aktualizują deal i dodają interakcję. | push-contract §0 | active |
| D32 | 2026-10-18 | Idempotencja przez tabelę `om_sync` + hash payloadu (OM nie ma upsertu po zewnętrznym ID). | push-contract §0, §2, §8 | active |
| D33 | 2026-10-18 | Lejek „Przetargi” z 9 etapami: new, result_lead, qualify, contact, offer, won, lost, rejected, cancelled. | push-contract §1; `ids.json` | active |
| D34 | 2026-10-18 | Etap zmieniany automatycznie tylko, gdy deal stoi na etapie ustawionym przez automat (`new`, `result_lead`). | push-contract §4 | active |
| D35 | 2026-10-18 | Deal usunięty ręcznie w UI nie jest odtwarzany (`last_error = 'deleted_in_om'`). | push-contract §5.2 | active |
| D36 | 2026-10-18 | Interakcje przez `/api/customers/interactions`, nie przez deprecated `activities`. | push-contract §5.3 | active |
| D37 | 2026-10-18 | Scoring per segment z reguł w tabelach; `probability` = max score; `cf_segments` z przecinkami na brzegach. | push-contract §7 | active |
| D38 | 2026-10-18 | Pole `channel` (tender/inbound/outbound/referral); n8n zawsze `tender`; techniczne źródło zostaje w `source`/`cf_source`. | push-contract §9.1; analiza faza 0 pkt 3 | active |
| D39 | 2026-10-18 | n8n wysyła `offer_role = primary` przy POST, nie wysyła go przy PUT; istniejące deale uzupełnić `primary`. | push-contract §9.1 | superseded (D64 — obowiązuje do migracji) |
| D40 | 2026-10-18 | n8n nie nadpisuje pól ręcznych (`docs_url`, `production_start`, `volume_m3`, `pieces`). | push-contract §9.1 | active |
| D41 | 2026-10-18 | Słownik `sales.deal_loss_reason` z 9 powodami (odblokowuje „Oznacz jako przegrany” w UI). | analiza F6; `ids.json` → `lossReasons` | active |
| D42 | 2026-10-18 | Wynik przetargu ustawia `winner_*` i `competitor*`; n8n nie zmienia `closure_outcome` ani powodu przegranej. | push-contract §9.4 | active |
| D43 | 2026-10-18 | n8n nie tworzy automatycznie projektów `klin:project`; zakłada je handlowiec. | push-contract §9.5 | superseded (D63) |
| D44 | 2026-10-18 | Backfill max 30 dni, partie 20–50, 1 równoległe żądanie (VPS 2 vCPU / 4 GB). | push-contract §0, §8 | active |
| D45 | 2026-10-18 | Własne moduły jako moduły aplikacji w forku (`apps/mercato/src/modules`), bez zmian w `packages/core`. | analiza §2 | active |
| D46 | ≤2026-10-20 | Faza 1 u Enki (dopasowanie duplikatów inwestycji, konkurent) wstrzymana do akceptacji Marka. | Marek | active |
| D47 | 2026-10-20 | Przełącznik modułu harmonogramu per organizacja w `module_configs` (ModuleConfigService) + feature'y ACL + blokady menu, zakładki deala i API; `feature_toggles` tylko jako globalny kill-switch modułu per tenant. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D48 | 2026-10-20 | Widoczność marży/kosztu: feature'y w `acl.ts` (RBAC); ustawienie organizacji to tylko domyślne przypisanie feature'ów do ról (admin/employee/własne). Ukryta marża = ukryty koszt. | Koordynator 2026-10-20; przegląd Kod P0-3 | active |
| D49 | 2026-10-20 | Marża odsłania się po `closure_outcome` (won lub lost), zgodnie z ustawieniem organizacji (doprecyzowanie D13). | Koordynator 2026-10-20 (makieta figma bro) | active (faza: v1 — D75) |
| D50 | 2026-10-20 | MVP = D29 + import XLSX + `offer_role` (ręczne wskazanie inwestycji z podpowiedzią po kodzie) + linia typu note + ręczne partie i import harmonogramu dla firm bez Gantta. | Koordynator 2026-10-20 (a) + Koordynator 2026-10-20 (makieta figma bro) | active |
| D51 | 2026-10-20 | Komunikat przy drugiej ofercie dla tej samej inwestycji dokładnie: „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna”. | Marek przez Koordynatora 2026-10-20 | active |
| D52 | 2026-10-20 | Inwestycja = jedna encja (nie `klin:project` obok `pc_investments`); spec wskazuje, którą zostawiamy, i migrację `klin:project`. | Koordynator 2026-10-20 (c) | active |
| D53 | 2026-10-20 | Jeden Gantt na inwestycję = osobny rekord (doprecyzowanie D23). | Koordynator 2026-10-20 (makieta figma bro) | active |
| D54 | 2026-10-20 | Kolizja z przypiętym zadaniem: ostrzeżenie + propozycja odpięcia. Auto-przesuwanie następników tylko w przód; przy wcześniejszym terminie tylko propozycja przesunięcia. Start przy kilku poprzednikach od najpóźniejszego. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D55 | 2026-10-20 | Konwencja dat harmonogramu: koniec włącznie; FS = dzień po końcu + lag; kamień milowy 0 dni; dni kalendarzowe. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D56 | 2026-10-20 | Import harmonogramu zastępuje dane po potwierdzeniu; błędne wiersze odrzucane z raportem. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D57 | 2026-10-20 | „Przelicz z cennika” dotyczy tylko linii bez override. „Nowa rewizja” to jedna akcja (unlock + duplicate scalone). | Koordynator 2026-10-20 (makieta figma bro) | active |
| D58 | 2026-10-20 | Mark-sent blokują: błędy importu, brak pozycji, ujemne ceny. Tylko ostrzeżenie: ujemna marża, pusta sekcja. Brak deala nie blokuje. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D59 | 2026-10-20 | apply-to-deal to przycisk, działa tylko z aktywnej wersji. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D60 | 2026-10-20 | PDF: dane firmy z `module_configs`, generowanie przez pdf-lib (zastępuje D27). | Koordynator 2026-10-20 (makieta figma bro) | active |
| D61 | 2026-10-20 | Kalkulacja bez deala nie wchodzi do prognozy ważonej; pokazywana osobno. | Koordynator 2026-10-20 (makieta figma bro) | active |
| D62 | 2026-10-20 | Zaokrąglanie half-up do 2 miejsc na pozycji, suma z pozycji już zaokrąglonych, konfigurowalne per organizacja; słownik jednostek z przelicznikami; priorytet identyfikatorów inwestycji: e-Zamówienia > TED > BIP > INV. | Koordynator 2026-10-19 | active |
| D63 | 2026-10-20 | Kanoniczna encja inwestycji = `pc_investments`. Jednorazowy import z `klin:project` po `--dry-run` i akceptacji raportu, potem `klin:project` wyłączamy. Inwestycje zakłada handlowiec (n8n nie tworzy ich automatycznie). | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D64 | 2026-10-20 | n8n przestaje wysyłać `cf_offer_role` dopiero po wdrożeniu modułu i migracji do `pc_deal_offer_roles`; do tego czasu kontrakt Enki (D39) bez zmian. | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D65 | 2026-10-20 | Pierwsza oferta na inwestycji dostaje rolę primary. | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D66 | 2026-10-20 | Apply-to-deal = jawna komenda użytkownika (zapis wartości deala przez komendę `customers`), nie enricher. | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D67 | 2026-10-20 | Wyłączenie harmonogramu w organizacji zostawia dane ukryte do ponownego włączenia. | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D68 | 2026-10-20 | Domyślnie rola employee nie widzi kosztów ani marży; organizacja może to zmienić (przypisanie feature'ów do ról). | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |
| D69 | 2026-10-20 | Ustawienia organizacji zapisywane pod kluczem `org:{id}:settings` jako obejście ograniczenia ModuleConfigService (odczyt ignoruje organizationId) — ryzyko R12. | Koordynator 2026-10-20 (Q1–Q5 z rev 8a) | active |

## Proces

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| P1 | 2026-10-20 | Marek decyduje tylko o sprawach biznesowych/produktowych; proces, modele i skille ustalają Koordynator i Cezar. | Marek | active |
| P2 | 2026-10-19 | Cały kod OM idzie przez Cezara. | Marek | active |
| P3 | 2026-10-19 | Costing i schedule: tylko specyfikacja; implementacja dopiero po wyraźnym „implementujemy” Marka. | Marek | active |
| P4 | 2026-10-19 | Przed kodem osobny plan testów, innym modelem niż spec, bez czytania speki; wnioski trafiają do speki później. | Marek | active |
| P5 | ≤2026-10-20 | Merge tylko po „merguj”. | Marek | active |
| P6 | ≤2026-10-20 | Nigdy nie pushujemy do `open-mercato/open-mercato`; wszystko w `AdamskiMarek/open-mercato`. | Marek | active |
| P7 | 2026-10-20 | „Gotowe” = dowód: testy + zrzuty ekranu albo przebieg na instancji testowej open-mercato.pl (Dokploy, instancja testowa Marka). | Marek | active |
| P8 | 2026-10-20 | Cezar używa Copilota (limit odnawia się 1. dnia miesiąca); gdy limit się skończy, runnerem jest Kod. | Marek | active |
| P9 | ≤2026-10-20 | Kod robi niezależny przegląd architektury (lista kontrolna: `om-architecture-checklist.md`). | Marek | active |
| P10 | 2026-10-20 | Pliki wizji i decyzji są aktualizowane, gdy zmienia się kierunek. | Marek | active |
| P11 | 2026-10-20 | Nie wyceniamy w dniach: speki zawierają tylko podział zakresu MVP / v1 / v2, bez sekcji i tabel estymat dniowych; raporty i prompty też bez dni. | Marek (przez Koordynatora) | active |

## Rozstrzygnięcia pytań Q7–Q11 (rev 8b)

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D70 | 2026-10-23 | Q7 — zaokrąglenie per waluta. Wybór (b): liczba miejsc po przecinku według ISO 4217 dla waluty kalkulacji (np. PLN/EUR 2, JPY 0, KWD 3); tryb half-up i zasada „suma z pozycji już zaokrąglonych” bez zmian (D62). Fazy (aktualizacja 2026-10-23, Q6 zamknięte przez D84–D88): MVP — obowiązuje dla waluty kalkulacji; źródłem liczby miejsc jest `currencies.decimal_places`, ISO 4217 tylko jako fallback (realizacja: D87). v1: to samo dla walut pozycji (D84). Bez własnej tabeli walut. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1: proces) — do potwierdzenia przez Marka, jeśli kwestia biznesowa; costing §16 rev 8b (e9857ab7); aktualizacja fazy: D84, D87 | active (realizacja: D87) |
| D71 | 2026-10-23 | Q8 — źródło kursów i zamrożenie kursu (korekta 2026-10-23). Kurs z tabeli A NBP z dnia mark-sent, zamrożony w snapshocie oferty (`pc_offer_snapshots`). Ręczna korekta kursu dozwolona przed mark-sent, zablokowana po mark-sent. Brak tabeli z tego dnia → ostatnia opublikowana tabela; `FX_RATE_UNAVAILABLE` tylko wtedy, gdy nie jest dostępna żadna tabela. Fazy (aktualizacja 2026-10-23, Q6 zamknięte przez D84–D88): MVP — gdy waluta kalkulacji ≠ waluta bazowa organizacji (D86); bez własnego fetchera — kurs z dostawcy `NBP_A` modułu `currencies`, pobierany na żądanie przy mark-sent, a kurs ręczny tylko w drafcie kalkulacji, nigdy w `exchange_rates` (realizacja: D85, D88, D89). | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6); costing §16 rev 8b (e9857ab7); aktualizacja fazy: D84, D85 | active (realizacja: D85) |
| D72 | 2026-10-23 | Q9 — harmonogram wykonawczy po ponownym otwarciu deala (`closure_outcome` → NULL). Wybór (c): harmonogram oznaczony „deal ponownie otwarty” (`reopened_at`), bez usuwania i bez archiwizacji danych. Fazy: v1 (moduł `project_schedule`); MVP i v2 bez zmian. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1: proces); costing §16 rev 8b (e9857ab7) | active |
| D73 | 2026-10-23 | Q10 — cena zero (`unit_price = 0`) na pozycji. Wybór (b): dozwolona, ale mark-sent pokazuje ostrzeżenie (lista ostrzeżeń z potwierdzeniem jak w D58), bez blokady. Fazy: MVP (walidacja mark-sent, doprecyzowanie D58); v1/v2 bez zmian. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1: proces); costing §16 rev 8b (e9857ab7) | active |
| D74 | 2026-10-23 | Q11 — akceptacja nowych zależności (costing §18a), zgodnie z rekomendacją Koda: `exceljs` — tak (costing MVP import, v1 eksport; schedule v1); siatka — najpierw `packages/ui` (`DataTable` + `InlineEditors`), `react-data-grid` tylko po PoC i akceptacji; Gantt — własny (D21, bez SVAR PRO), `@svar-ui/react-gantt` MIT core tylko jako PoC w v1 schedule, potem osobna decyzja; `xml2js` — decyzja dopiero w v2. Fazy: MVP `exceljs` + `packages/ui`; v1 PoC `@svar-ui`; v2 `xml2js`. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1: proces) — do potwierdzenia przez Marka, jeśli kwestia biznesowa; costing §16 rev 8b (e9857ab7) | active |

## Decyzje D75–D94 (2026-10-23)

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D75 | 2026-10-23 | Odsłanianie marży po zamknięciu deala (D49) przechodzi do v1. W MVP marżę widzi wyłącznie rola z uprawnieniem (`view_margin`, D48/D68). Fazy: MVP — tylko RBAC; v1 — odsłanianie po `closure_outcome`. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D76 | 2026-10-23 | Mark-sent z ujemną marżą przez osobę bez `view_margin` → blokada z neutralnym komunikatem „Oferta wymaga zatwierdzenia przez administratora”, bez znaku i wartości marży; wysyła administrator. Użytkownik bez `view_margin` nigdy nie widzi ostrzeżenia o znaku marży (doprecyzowanie D58). Fazy: MVP. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D77 | 2026-10-23 | Jeden rekord harmonogramu na inwestycję z fazą (ofertowy → wykonawczy); klucz wymusza jeden primary na inwestycję (doprecyzowanie D53). Fazy: v1 (moduł `project_schedule`). | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D78 | 2026-10-23 | Wystarczą automatyczne sumy sekcji; brak wiersza sumy częściowej (subtotal) w MVP. Fazy: MVP — tylko sumy sekcji. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D79 | 2026-10-23 | Ustawienie „tylko własne deale” (wymagania biznesowe §6.3) przechodzi do v1. Fazy: MVP bez tego ustawienia; v1. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D80 | 2026-10-23 | Następnik kamienia milowego (czas trwania 0) startuje w tym samym dniu co kamień milowy (FS bez +1; doprecyzowanie D55). Fazy: v1 (auto-scheduling). | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D81 | 2026-10-23 | Wartość deala ustawiona przez apply-to-deal wygrywa; n8n aktualizuje tylko pola przetargowe (szacunkowa wartość zamówienia) i nigdy nie nadpisuje wartości deala, gdy jest powiązana kalkulacja (doprecyzowanie D31/D40/D64/D66). Fazy: MVP (razem z apply-to-deal); wymaga zmiany kontraktu n8n (Enka). | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D82 | 2026-10-23 | Speka nie rozstrzyga o SVAR (w tym §18a): Gantt jest własny, `@svar-ui` tylko jako PoC w v1, potem osobna decyzja (doprecyzowanie D74). Fazy: v1 PoC; decyzja po PoC. | Rozstrzygnięte przez Koordynatora 2026-10-23 (P1, Marek sceduje rozstrzygnięcia na Koordynatora poza Q6) | active |
| D83 | 2026-10-23 | Split = podział inwestycji (wydzielenie kalkulacji i ofert do nowej inwestycji; nie podział oferty) przechodzi z v2 do v1, nie do MVP (wcześniej v2 w costing §2.2). W kroku podziału użytkownik wskazuje ofertę główną (`primary`) dla każdej z inwestycji po podziale; domyślnie zaznaczona jest dotychczasowa (oryginał). Obowiązują zasady primary z D51/D65: jedna oferta `primary` na inwestycję i ten sam komunikat „Istnieje już oferta dla innego wykonawcy — wskaż, która jest główna” (D51). Fazy: v1. | Rozstrzygnięte przez Koordynatora 2026-10-23 | active |
| D84 | 2026-10-23 | Q6 — waluty (przeredagowanie Q6 po audycie nakładania się z OM). Waluty realizuje moduł OM `currencies` (już w presecie `crm`: `apps/mercato/src/modules.ts` l.92, `packages/create-app/src/lib/starter-presets.ts` l.91); `project_costing` nie ma własnej tabeli walut ani kursów. MVP: jedna waluta na kalkulację = waluta deala (wariant b z Q6). v1: wiele walut w obrębie kalkulacji, waluta per pozycja (wariant c z Q6). Zamyka Q6 razem z D85–D88. Fazy: MVP (b); v1 (c). | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D85 | 2026-10-23 | D71 bez własnego fetchera: kursy NBP dostarcza własny dostawca `RateProvider` z `source: 'NBP_A'` (tabela A NBP, kurs średni `mid`, `type: null`), rejestrowany przez `registerCurrencyRateProvider` modułu `currencies` (dostawca NBP z OM używa tabeli C bid/ask, więc nie jest użyty). Pobranie: `rateFetchingService.fetchRatesForDate(data, scope, { providers: ['NBP_A'] })`; odczyt z `exchange_rates` z filtrem `source = 'NBP_A'` (odczyt kursu w OM nie filtruje po źródle). Kurs ręczny istnieje tylko w drafcie kalkulacji (z audytem) i trafia do snapshotu z `provider_source: 'manual'`; nigdy nie jest zapisywany w `exchange_rates`. Fazy: MVP. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D86 | 2026-10-23 | Waluta bazowa organizacji = `BaseCurrencyService.resolveBaseCurrency()` modułu `currencies` (flaga `is_base`). Klucz `default_currency` w ustawieniach `project_costing` zostaje tylko jako domyślna waluta kalkulacji bez deala. Gdy w organizacji nie ma waluty bazowej → 422 `BASE_CURRENCY_MISSING`. Fazy: MVP. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D87 | 2026-10-23 | D70: liczba miejsc po przecinku z `currencies.decimal_places` waluty, fallback ISO 4217. Waluta kalkulacji (i od v1 waluta pozycji) musi istnieć i być aktywna w module `currencies`; w przeciwnym razie 422 z czytelnym komunikatem (kod `CURRENCY_NOT_ACTIVE` — propozycja, do potwierdzenia w review). Dotyczy też deala, którego waluta pochodzi ze słownika `customers` (pełna lista ISO) i nie ma jej w module `currencies`. Fazy: MVP. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D88 | 2026-10-23 | `snapshot_data.fx` w `pc_offer_snapshots` zawiera dodatkowo: `rate_type`, `provider_source` (`NBP_A` albo `manual`) i parę walut `from`/`to` (obok kursu jako string numeric(18,8) i `effective_date` = data znalezionej tabeli). W v1 `fx` jest tablicą kursów per para walut (pozycja → kalkulacja i kalkulacja → baza). Fazy: MVP (jedna para); v1 (tablica per para). | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D89 | 2026-10-23 | Cykliczne pobieranie kursów `NBP_A` (dzienny job) — v1. W MVP kurs pobierany na żądanie przy mark-sent (`sync_time` w `currency_fetch_configs` nie jest dziś podpięty do żadnego harmonogramu zadań). Fazy: MVP na żądanie; v1 job dzienny. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D90 | 2026-10-23 | Potwierdzenie D18: nie włączamy modułów `sales`, `catalog` ani `@dainamite/cpq`. Uzasadnienie (audyt): `sales_quote_lines`/`sales_quotes` nie mają `dealId`, wersji, kosztu, marży ani PDF; koszt włączenia ≈ 39 tabel. Fazy: bez zmian zakresu. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D91 | 2026-10-23 | XLSX zostaje na `exceljs` (D74); moduł `sync_excel` (parsuje tylko CSV) nie jest używany. Wzmianka w costing §18a. Fazy: MVP (import), v1 (eksport). | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D92 | 2026-10-23 | PDF: `pdf-lib` (już w `packages/core`) na wzorcu `forms/services/pdf-snapshot-service.ts`, plik zapisany w `attachments` — bez nowej zależności PDF (doprecyzowanie D60). Fazy: MVP. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D93 | 2026-10-23 | Akceptacja oferty z ujemną marżą (D76) bez modułu `workflows` w MVP: blokada i wysyłka przez administratora wystarczą; `workflows` jako kandydat do ścieżki akceptacji w v2. Fazy: MVP bez `workflows`; v2 kandydat. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |
| D94 | 2026-10-23 | `perspectives` (zapisane widoki listy kalkulacji) — opcjonalne w v1. `@open-mercato/scheduler` — opcjonalny w v1 dla joba dziennego z D89 (nie jest włączony w forku). Fazy: v1 opcjonalnie. | Rozstrzygnięte przez Koordynatora 2026-10-23 (audyt om-overlap-audit §3–4) | active |

## Otwarte

- Q6 (waluty) zamknięte 2026-10-23 przez D84–D88: MVP jedna waluta = waluta deala, v1 waluty per pozycja, realizacja przez moduł OM `currencies`; D70 i D71 przestały być warunkowe (realizacja: D87, D85).
- Różnice między briefem a audytem (om-overlap-audit §4) rozstrzygnięte na korzyść audytu: D84 z wariantami Q6 (b)/(c) i presetem `crm`; D86 z rolą `default_currency`; D88 z `rate_type`, `provider_source`, parą `from`/`to` i tablicą per para w v1; D93 z `workflows` jako kandydatem v2; D94 z odwołaniem do D89. Kod błędu w D87 nie występuje w audycie — `CURRENCY_NOT_ACTIVE` jest propozycją.
- Otwarte pytanie Q12 (bez numeru D; raport Koordynatora 2026-10-23 §5 pkt 2): co z aktywnymi walutami bez kursu w żadnej tabeli NBP — dziś CNH (CNY nie ma w tabeli C, jest w tabeli A). Do decyzji Marka kalkulacja w takiej walucie wymaga kursu ręcznego, bez niego mark-sent zwraca 422 `FX_RATE_UNAVAILABLE`.
- Stan według logu Koordynatora 2026-10-23 (`om-currency-change-2026-10-23.json`; stan, nie czynność): waluta bazowa na produkcji = PLN (wcześniej USD); kursy z tabeli C NBP (dostawca OM `NBP`) pobrane na 2026-10-23; CNY i CNH bez kursu; podsumowanie deali nie znajduje kursu EUR z powodu niezgodności daty zapisu (`nbp.ts` l.76–80, północ Europe/Warsaw) i lookupu (`exchangeRateService.ts` l.246–249, północ UTC) — błąd także w upstream `main`.
- Warunki wstępne etapu kodu (dane, nie decyzje; każdy tylko za zgodą Marka): (1) włączenie pobierania kursów `NBP_A`; (2) pobranie z upstream poprawki c46ad643 (jedna waluta bazowa przy undo/redo). Warunek operacyjny: przed jakimkolwiek cofnięciem zmiany waluty bazowej trzeba pobrać c46ad643.
