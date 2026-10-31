# Brief: kalkulacja i oferta (`project_costing`)

**To nie jest speka (P14).** Brief mówi po co i co ma działać. Zachowanie, model danych, kody błędów i testy są w specu `.ai/specs/2026-10-19-project-costing-offer-calculator.md`, w planie `.ai/specs/2026-10-19-costing-schedule-test-plan.md` i w rejestrze `.ai/decisions.md` (jedyne źródło decyzji, P12). Numery D bez zmian — tylko odesłania.

## 1. Po co

Firma budowlana (na start prefabrykacja żelbetowa, docelowo cała budowlanka) liczy koszt i cenę oferty w OM tak, jak dziś w Excelu, wysyła ofertę w PDF i przenosi wartość do deala z przetargu (D1, D2, D9, D11).

## 2. Co ma umieć (każda pozycja z warunkiem sukcesu)

| # | Zdolność | Warunek sukcesu | D |
|---|---|---|---|
| C1 | Siatka kalkulacji: sekcje → pozycje, linie `note`, automatyczne sumy sekcji. | Użytkownik buduje kalkulację bez formuł; sumy sekcji liczą się same, bez wiersza subtotal. | D9, D30, D50, D78 |
| C2 | Import XLSX do kalkulacji. | Plik XLSX zamienia się w pozycje; błędy importu są widoczne i blokują mark-sent. | D9, D50, D58, D74, D91 |
| C3 | Cennik firmy i „Przelicz z cennika”. | Przeliczenie zmienia tylko linie bez override. | D12, D50, D57 |
| C4 | Marża, zaokrąglenia i jednostki. | Marża = (cena − koszt) / cena; half-up per linia, suma z zaokrąglonych linii, liczba miejsc wg waluty; słownik jednostek z przelicznikami. | D14, D16, D17, D62, D70, D87 |
| C5 | Mark-sent ze snapshotem i PDF. | Blokady i ostrzeżenia działają dokładnie wg rejestru (błędy importu, brak pozycji, ujemne ceny — blokada; ujemna marża, pusta sekcja, cena zero — ostrzeżenie); PDF z pdf-lib z danymi firmy z ustawień. | D11, D58, D60, D73, D76, D92 |
| C6 | Nowa rewizja oferty. | „Nowa rewizja” to jedna akcja (unlock + duplicate). | D57 |
| C7 | Apply-to-deal. | Przycisk działa tylko z aktywnej wersji; wartość z apply-to-deal wygrywa z n8n. | D59, D66, D81 |
| C8 | Inwestycja i oferta główna. | Jedna oferta `primary` na inwestycję; przy drugiej ofercie dokładny komunikat z D51; pierwsza oferta = primary; inwestycja wskazywana ręcznie z podpowiedzią po kodzie. | D5, D6, D50, D51, D52, D63, D65, D132 |
| C9 | Widoczność kosztu i marży. | Bez `view_margin` użytkownik nie widzi ani marży, ani kosztu w żadnym kanale; pracownik domyślnie nie widzi; mark-sent z ujemną marżą przez osobę bez uprawnienia → blokada z neutralnym komunikatem, wysyła administrator. | D48, D68, D75, D76 |
| C10 | Waluty i kursy. | Jedna waluta na kalkulację = waluta deala (MVP); kurs NBP tabela A z dnia mark-sent zamrożony w snapshocie; waluta bez źródła kursu odrzucana. | D71, D84, D85, D86, D88, D95 |
| C11 | Kalkulacja bez deala. | Działa i nie wchodzi do prognozy ważonej (pokazywana osobno). | D10, D61 |
| C12 | Partie produkcji i prognoza bez harmonogramu. | Partie ręczne albo z importu działają przy wyłączonym `project_schedule`. | D20, D50 |
| C13 | Migracja `klin:project`. | Jednorazowy import po `--dry-run` i akceptacji raportu, potem `klin:project` wyłączone. | D63, D64 |

Od v1 (bez zmiany zakresu MVP): odsłanianie marży po zamknięciu deala (D75), „tylko własne deale” (D79), split inwestycji (D83), waluta per pozycja (D84), dzienny job kursów (D89), `quantity_expr` (D30), eksport XLSX (D91).

## 3. Ograniczenia

- Moduł aplikacji w forku, bez zmian w `packages/core` (D45); `project_costing` jest bazą i nie zna modułów opcjonalnych (D98).
- Firma = organizacja OM; ustawienia przez ModuleConfigService pod `org:{id}:settings` (D15, D69).
- Waluty i kursy tylko przez moduł `currencies`, kurs ręczny nigdy w `exchange_rates` (D84, D85).
- Tylko specyfikacja do „implementujemy” (P3); bez estymat w dniach (P11).

## 4. Czego nie robimy

- Nie włączamy `sales`, `catalog` ani `@dainamite/cpq` (D18, D90).
- Bez formuł w MVP (D30), bez własnej tabeli walut (D84), bez `sync_excel` (D91), bez `workflows` w MVP (D93).
- Bez Gantta w kalkulatorze — to moduł `project_schedule` (D19, D20).

## 5. Po czym poznamy sukces

- Na instancji testowej handlowiec przechodzi drogę: import XLSX → kalkulacja → mark-sent z PDF → apply-to-deal, bez Excela poza importem (D9, D11, D59); dowód wg P7.
- Plan testów costing przechodzi dla wszystkich aktywnych D modułu; spec-check bez flag: PASS, 0 FAIL.
- Bramka gotowości (`.ai/process/readiness-gate.md`) daje PASS przed prośbą o „implementujemy”.
