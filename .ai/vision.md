# Klin #1 — wizja produktu

**Stan na:** 2026-10-20
**Zasada aktualizacji:** ten plik aktualizujemy za każdym razem, gdy Marek zmieni kierunek produktu. Zmianę dopisujemy też jako nowy wiersz w `decisions.md` (stary wiersz dostaje status `superseded`). Plik opisuje kierunek, nie szczegóły implementacji — te są w specach w `.ai/specs/`.

## Czym jest Klin #1
- Agregator przetargów publicznych połączony z CRM dla budownictwa.
- Źródła przetargów: e-Zamówienia (cała Polska) i TED (wszystkie kraje).
- CRM: Open Mercato (OM), instancja open-mercato.pl (Dokploy). To jest instancja testowa Marka.
- Przetargi trafiają do OM jako deale w lejku „Przetargi”.

## Dla kogo
- Pierwsza nisza: zakłady prefabrykacji żelbetowej (prefabrykaty betonowe).
- Docelowo: cała branża budowlana. Dlatego scoring, kategorie kosztów i konfiguracja są wielosegmentowe; nowy segment to konfiguracja, nie nowy kod.
- „Firma” = organizacja w OM.

## Segmenty
- Scoring per segment, oparty na regułach w tabelach (`segments`, `segment_rules`, `tender_scores` w Postgresie Enki).
- Pierwszy segment: `prefab` (Prefabrykacja betonowa, próg 50).
- Kolejne segmenty (np. `roads`) dodajemy INSERT-ami reguł, bez zmian w workflow.
- `prefab_score` = wynik segmentu prefab; `probability` deala = najwyższy wynik ze wszystkich segmentów; `cf_segments` = segmenty powyżej progu.

## Główne części

### 1. Ingest (n8n, Enka)
- Pobieranie ogłoszeń z e-Zamówień do Postgresa (`notices`), scoring, push do OM.
- 1 postępowanie = 1 deal; kolejne ogłoszenia aktualizują deal i dodają interakcję (sprostowanie, wynik, unieważnienie).
- Idempotencja po naszej stronie: tabela `om_sync` + hash payloadu.
- Do OM trafiają przetargi ze score ≥ 50.
- Wynik przetargu: zwycięzca zapisywany jako `winner_*` i `competitor*`; to lead na generalnego wykonawcę (GW). Zamknięcie deala jako przegranego to decyzja handlowca.

### 2. CRM (Open Mercato)
- Lejek „Przetargi” z 9 etapami (nowy, rozstrzygnięty–lead, kwalifikacja, kontakt, oferta, wygrany, przegrany, odrzucony, unieważniony).
- Pola przetargowe `cf_*` na dealu i firmie (NIP, rola zamawiający/wykonawca).
- Słownik powodów przegranej (9 powodów).
- Duplikaty ofert: zakład wysyła oferty na tę samą inwestycję do kilku GW, a wygrać może najwyżej jedną. Każda oferta ma `offer_role` = `primary` albo `alternative`. Przy zapisie oferty system sprawdza, czy na tę samą inwestycję jest oferta do innego wykonawcy, i pokazuje komunikat „istnieje oferta dla innego wykonawcy, wskaż główną”. Suma lejka liczy tylko oferty główne.
- Inwestycja: każdy przetarg dostaje kod inwestycji. Priorytet identyfikatora: e-Zamówienia → TED → BIP → własny kod `INV-YYYY-NNNNNN`. Podobieństwo nazwy jest tylko podpowiedzią, zawsze do potwierdzenia przez użytkownika.

### 3. Kalkulacja / kalkulator ofert (moduł costing, tylko specyfikacja)
- Działa jak Excel, importuje XLSX.
- Kalkulacja może istnieć bez deala.
- PDF oferty w pierwszej wersji.
- Start od własnego cennika użytkownika; później zgodność z Sekocenbud i innymi cennikami.
- Widoczność kalkulacji i marży ustawiana per firma.
- Marża liczona od ceny sprzedaży.
- Zaokrąglenia: half-up do 2 miejsc per linia, konfigurowalne per firma.
- Słownik jednostek z przelicznikami.

### 4. Harmonogram (moduł schedule, tylko specyfikacja)
- Osobny moduł, opcjonalny per firma (część firm używa Excela lub innych narzędzi).
- Kalkulacja i prognoza produkcji muszą działać bez niego: przez `ScheduleSource` albo import z Excela.
- Gantt budowany samodzielnie (bez SVAR PRO).
- Auto-przesuwanie następników, z możliwością ręcznego przypięcia zadania.
- Jeden Gantt na inwestycję.
- Harmonogram ofertowy staje się wykonawczym po wygraniu deala.
- MS Project dopiero od v2.
- Na razie wewnętrzny, przygotowany na późniejszą integrację zewnętrzną.
- Dane do PDF z profilu firmy.

## MVP modułów costing/schedule (po przeglądzie Kod)
- W MVP: siatka, tryby ceny A i C, prosty cennik, mark-sent ze snapshotem i PDF, apply-to-deal, RBAC, partie produkcji bez Gantta.
- Bez formuł w MVP. W v1 `quantity_expr` z bezpiecznym parserem (ilość z wymiarów).

## Zasady produktowe i procesowe
- Marek decyduje tylko o sprawach biznesowych i produktowych. Proces, modele i skille ustalają Koordynator i Cezar.
- Cały kod OM idzie przez Cezara. Wszystko zostaje w forku `AdamskiMarek/open-mercato`; nigdy nie pushujemy do `open-mercato/open-mercato`.
- Moduły costing i schedule: żadnej implementacji, dopóki Marek wprost nie powie „implementujemy”.
- Przed kodem powstaje osobny plan testów, pisany innym modelem niż spec i bez czytania speki.
- Merge tylko po „merguj”.
- „Gotowe” = dowód: testy + zrzuty ekranu albo przebieg na instancji testowej open-mercato.pl.
- Cezar pracuje na Copilocie (limit odnawia się 1. dnia miesiąca). Gdy limit się skończy, runnerem jest Kod.
- Kod robi niezależny przegląd architektury przed kodem (lista: `om-architecture-checklist.md`).
- Własne moduły jako moduły aplikacji w forku, bez zmian w `packages/core`.

## Czego (jeszcze) nie robimy
- Nie implementujemy modułów costing i schedule (tylko specyfikacja).
- Nie kupujemy SVAR PRO.
- Nie włączamy całego modułu `sales` pod kalkulator.
- Nie ma formuł w MVP kalkulatora.
- Nie ma importu MS Project przed v2.
- Nie ma Sekocenbud na start (najpierw własny cennik).
- n8n nie tworzy automatycznie projektów/inwestycji ani nie zamyka deali jako przegranych.
- Faza 1 u Enki (dopasowanie duplikatów inwestycji i konkurent w n8n) wstrzymana do akceptacji Marka.

## Otwarte kierunki
- TED: ingest dla wszystkich krajów (ten sam kontrakt, `cf_source="ted"`).
- Hałaśliwy scoring: dostroić słowa kluczowe segmentu prefab.
- Publikacja godzinnej automatyki n8n: nieopublikowana; przed publikacją próg ≥ 50 dla nowych deali i publikacja workflow podrzędnego `E_zamowienia_om_request`; wymaga zgody Marka.
- Przegląd pól fazy 0 w OM przez Marka.
- Rev 8 speki: wnieść uwagi Kod i wnioski z planu testów (Cezar; gdy brak limitu Copilota, runnerem jest Kod).
