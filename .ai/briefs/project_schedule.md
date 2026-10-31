# Brief: harmonogram (`project_schedule`)

**To nie jest speka (P14).** Zachowanie, model danych i testy są w specu `.ai/specs/2026-10-19-project-schedule.md`, w planie `.ai/specs/2026-10-19-costing-schedule-test-plan.md` i w `.ai/decisions.md` (P12). Numery D bez zmian — tylko odesłania.

## 1. Po co

Firma, która chce planować produkcję i montaż w OM, ma jeden Gantt na inwestycję, który z ofertowego staje się wykonawczym po wygraniu deala. Firma, która planuje w Excelu albo innym narzędziu, może moduł wyłączyć (D19, D23, D24).

## 2. Co ma umieć (każda pozycja z warunkiem sukcesu)

| # | Zdolność | Warunek sukcesu | D |
|---|---|---|---|
| S1 | Jeden Gantt na inwestycję. | Na inwestycję istnieje najwyżej jeden rekord harmonogramu (osobny rekord, jeden primary). | D23, D53, D77 |
| S2 | Daty i zależności. | Koniec włącznie; FS = dzień po końcu + lag; kamień milowy zerowej długości, jego następnik startuje tego samego dnia; dni kalendarzowe. | D55, D80 |
| S3 | Auto-przesuwanie z przypięciem. | Następniki przesuwają się tylko w przód, od najpóźniejszego poprzednika; kolizja z przypiętym zadaniem → ostrzeżenie i propozycja odpięcia. | D22, D54 |
| S4 | Ofertowy → wykonawczy. | Po wygraniu deala rekord przechodzi w fazę wykonawczą; ponowne otwarcie deala tylko oznacza rekord (`reopened_at`), a ponowne `won` czyści flagę. | D24, D72, D140 |
| S5 | Faza projektu realizacji. | `ensureExecution` jest idempotentne per inwestycja; jedno zadanie fazy projektu na rekord; inny projekt → 409. | D100, D131 |
| S6 | Import harmonogramu. | Import zastępuje dane po potwierdzeniu; błędne wiersze odrzucone z raportem. | D56 |
| S7 | Włączanie per organizacja. | Przełącznik w `module_configs` + feature'y ACL + blokady menu, zakładki deala i API; wyłączenie ukrywa dane do ponownego włączenia. | D19, D47, D67 |
| S8 | Źródło danych dla kalkulacji. | Costing czyta harmonogram tylko przez `ScheduleSource` w DI; bez modułu kalkulacja działa dalej. | D20, D98 |

## 3. Ograniczenia

- Cały moduł w v1; MVP (kalkulator i projekty) działa bez niego (D20, D77, D100).
- Zależy od `project_costing`, nie importuje `project_delivery`; tylko DI i eventy, zero HTTP (D98, D100).
- Gantt własny; `@svar-ui/react-gantt` MIT core tylko jako PoC w v1, potem osobna decyzja (D21, D74, D82).
- Na razie wewnętrzny, przygotowany na integrację zewnętrzną (D26). Tylko specyfikacja do „implementujemy” (P3); bez estymat w dniach (P11).

## 4. Czego nie robimy

- Bez licencji SVAR PRO (D21).
- Bez importu MS Project przed v2 (D25); `xml2js` — decyzja w v2 (D74).
- Bez osobnego Gantta w `project_delivery` (D100).

## 5. Po czym poznamy sukces

- Na instancji testowej: harmonogram ofertowy inwestycji przechodzi w wykonawczy po wygraniu deala, auto-przesuwanie i przypięcia działają wg D54/D55/D80; dowód wg P7.
- Po wyłączeniu modułu w organizacji kalkulacja i projekt działają, a dane harmonogramu wracają po ponownym włączeniu (D20, D67, D100).
- Plan testów schedule przechodzi; spec-check bez flag: PASS, 0 FAIL; bramka gotowości: PASS.
