# Klin #1 — dziennik decyzji

**Stan na:** 2026-10-20
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
| D7 | 2026-10-18 | Projekt/Budowa jako encja `klin:project` w Data designerze, z relacją do deali. | analiza §2, push-contract §9.5 | active (do rozstrzygnięcia vs `pc_investments` — przegląd Kod pkt 11) |
| D8 | 2026-10-18 | Koszty i kalkulacje wiszą na dealu. | analiza §2 | superseded (D10) |

## Moduł kalkulacji (costing) — tylko specyfikacja

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D9 | ≤2026-10-20 | Kalkulator działa jak Excel i importuje XLSX. | Marek | active |
| D10 | 2026-10-19 | Kalkulacja może istnieć bez deala. | Marek; cost spec A4 | active |
| D11 | ≤2026-10-20 | PDF oferty w pierwszej wersji. | Marek | active |
| D12 | ≤2026-10-20 | Start od własnego cennika użytkownika; później zgodność z Sekocenbud i innymi cennikami. | Marek; cost spec §13 | active |
| D13 | 2026-10-19 | Widoczność kalkulacji i marży to ustawienie per firma (w tym widoczność marży po zamknięciu deala). | Marek (rev 7); plan testów §22 pkt 6 | active |
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
| D27 | ≤2026-10-20 | Dane do PDF z profilu firmy. | Marek | active |

## MVP

| # | Data | Decyzja | Uzasadnienie / źródło | Status |
|---|---|---|---|---|
| D28 | 2026-10-19 | MVP: costing 17 d + schedule 14 d (pełny Gantt), PDF i wersje w v1; razem 94,5 d. | cost spec §14 (rev 7) | superseded (D29) |
| D29 | ≤2026-10-20 | MVP przycięte wg Kod: siatka, tryby A i C, prosty cennik, mark-sent ze snapshotem i PDF, apply-to-deal, RBAC, partie produkcji bez Gantta. | przegląd Kod pkt 15 | active |
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
| D39 | 2026-10-18 | n8n wysyła `offer_role = primary` przy POST, nie wysyła go przy PUT; istniejące deale uzupełnić `primary`. | push-contract §9.1 | active |
| D40 | 2026-10-18 | n8n nie nadpisuje pól ręcznych (`docs_url`, `production_start`, `volume_m3`, `pieces`). | push-contract §9.1 | active |
| D41 | 2026-10-18 | Słownik `sales.deal_loss_reason` z 9 powodami (odblokowuje „Oznacz jako przegrany” w UI). | analiza F6; `ids.json` → `lossReasons` | active |
| D42 | 2026-10-18 | Wynik przetargu ustawia `winner_*` i `competitor*`; n8n nie zmienia `closure_outcome` ani powodu przegranej. | push-contract §9.4 | active |
| D43 | 2026-10-18 | n8n nie tworzy automatycznie projektów `klin:project`; zakłada je handlowiec. | push-contract §9.5 | active |
| D44 | 2026-10-18 | Backfill max 30 dni, partie 20–50, 1 równoległe żądanie (VPS 2 vCPU / 4 GB). | push-contract §0, §8 | active |
| D45 | 2026-10-18 | Własne moduły jako moduły aplikacji w forku (`apps/mercato/src/modules`), bez zmian w `packages/core`. | analiza §2 | active |
| D46 | ≤2026-10-20 | Faza 1 u Enki (dopasowanie duplikatów inwestycji, konkurent) wstrzymana do akceptacji Marka. | Marek | active |

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
