# Zasady dla agentów (Klin #1)

**Status:** 2026-10-31 (P17). Minimum kontekstu: tylko zakazy z alternatywą i pułapki, które już się zdarzyły. Bez map repo i opisów systemu — te są w spekach, w `.ai/architecture.md` i w rejestrze `.ai/decisions.md` (jedyne źródło decyzji, P12).

## Zakazy i co robić zamiast

| # | Nie rób | Zamiast tego | Źródło |
|---|---|---|---|
| Z1 | Nie wdrażaj i nie pisz kodu modułów Klin #1. | Przygotuj spekę albo plan i poproś o zgodę; kod dopiero po „implementujemy” od Marka. | P3; nagłówek sekcji D98–D130 |
| Z2 | Nie merguj PR. | Zostaw PR jako draft i zgłoś gotowość; merge po „merguj” od Marka albo w ramach stałej zgody Marka na PR doc-only, jeśli taka zgoda została dana. | P5 |
| Z3 | Nie pushuj do upstream (`open-mercato/open-mercato`). | Każde polecenie `gh` z `--repo AdamskiMarek/open-mercato`; zgłoszenie do upstream tylko jako issue, gdy decyzja tak mówi. | P6, D96 |
| Z4 | Nie rób force-push ani nie przepisuj historii. | Nowy commit na gałęzi; przez Git Data API ref aktualizowany z `force=false` po sprawdzeniu heada. | reguła pracy (Koordynator) |
| Z5 | Nie zapisuj sekretów w repo, ustawieniach, logach ani w raportach. | Sekrety tylko w zmiennych środowiskowych wdrożenia; token używany wyłącznie w `bash -lc` i nigdy nie drukowany. | D130, D143 |
| Z6 | Nie podawaj estymat w dniach. | Opisz zakres jako listę funkcji i encji per faza (MVP/v1/v2). | P11 |
| Z7 | Nie pytaj Marka bezpośrednio. | Pytanie biznesowe dopisz do grupy „Do decyzji człowieka” (`.ai/process/review-format.md`) i przekaż Koordynatorowi. | P1 |
| Z8 | Nie zmieniaj ani nie usuwaj wiersza D/P. | Nowa decyzja = nowy wiersz; stary dostaje `superseded (Dnn)`. | `.ai/decisions.md`, „Zasada” |
| Z9 | Nie rozstrzygaj sam sprzeczności speki z rejestrem. | Nie commituj spornego punktu; zgłoś cytat z obu miejsc (plik:linia). | reguła pracy (Koordynator) |
| Z10 | Nie traktuj briefu jak speki. | Brief to cel i zakres; zachowanie, model i kody błędów bierz ze speki i z D. | P14 |
| Z11 | Wykonawca nie zmienia treści TC w planach testów (kroki, asercje). | Drobne zmiany meta w planach (nagłówki, changelog, daty, odesłania) może zrobić wykonawca, z wpisem w changelogu; zmianę treści TC zgłoś jako zadanie dla niezależnej sesji planu. | P4; Cezar 2026-10-31 |

## Pułapki, które już się zdarzyły

| # | Co poszło źle | Reguła | Jak robić |
|---|---|---|---|
| T1 | spec-check uruchomiony na plikach z working tree zamiast z repo. | Wynik liczy się tylko dla plików przy SHA heada. | Pobierz pliki przez `git show <SHA>:<ścieżka>` (albo `gh api …/contents/…?ref=<SHA>`), uruchom spec-check na nich i podaj SHA w raporcie. |
| T2 | Pomylone KA-6 z KA-7. | KA-6 = pomiar RAM workera importu (D115, D120); KA-7 = PoC bucketu OVHcloud z wersjonowaniem i lifecycle (D117, D129). | Przy każdym odwołaniu do KA podaj numer D obok numeru KA. |
| T3 | `--tc-pending-from` użyte jako bramka. | Flaga tylko oznacza brak TC dla nowych D jako oczekujący; nie jest werdyktem. | Bramka = spec-check bez flag: PASS, 0 FAIL. Wynik z flagą podawaj osobno i z nazwą flagi. |
| T4 | Plan testów pisany ze speki zamiast z decyzji. | Plan testów pisze inny model niż speka, w osobnej sesji, z rejestru D, bez czytania speki (P4). | Wejście planu: `.ai/decisions.md` + brief; spekę porównuje dopiero review. |
| T5 | Force-push. | Jak Z4. | Nowy commit; przy konflikcie heada — stop i raport. |
| T6 | Push do upstream. | Jak Z3. | Sprawdź `--repo` w każdym poleceniu `gh` i zdalne repo przed pushem. |
| T7 | Estymaty w dniach w specu. | Jak Z6. | Przed commitem przeszukaj tekst pod kątem liczb z jednostką czasu w kontekście wyceny. |
| T8 | Sekret w repo. | Jak Z5. | Przed commitem przejrzyj diff pod kątem kluczy, tokenów i haseł; w razie wątpliwości — nie commituj i zgłoś. |
| T9 | Pytanie do Marka z pominięciem Koordynatora. | Jak Z7. | Każde pytanie biznesowe idzie przez Koordynatora. |
| T10 | Merge bez „merguj” i bez stałej zgody na doc-only. | Jak Z2. | Przed merge wskaż wiadomość z „merguj” albo stałą zgodę dla PR doc-only. |
