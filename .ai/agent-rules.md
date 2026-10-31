# Zasady dla agentów (Klin #1)

**Status:** 2026-10-31 (P17; Z4, Z9, Z11 ze źródłem P19–P21, Z8 zgodny z „Zasadą” rejestru; Z13 — praca w ClickUp, P22; brzmienie Z13 zmienione 2026-10-31 — Cezar; role w Z13 (kto buduje, kto kontroluje) — Marek 2026-10-31 (via Koordynator), P23; zmiana 2026-10-31: Kod tylko obserwator (Z2, Z11, Z13) — Marek 2026-10-31 (via Koordynator)). Minimum kontekstu: tylko zakazy z alternatywą i pułapki, które już się zdarzyły. Bez map repo i opisów systemu — te są w spekach, w `.ai/architecture.md` i w rejestrze `.ai/decisions.md` (jedyne źródło decyzji, P12).

## Zakazy i co robić zamiast

| # | Nie rób | Zamiast tego | Źródło |
|---|---|---|---|
| Z1 | Nie wdrażaj i nie pisz kodu modułów Klin #1. | Przygotuj spekę albo plan i poproś o zgodę; kod dopiero po „implementujemy” od Marka. | P3; nagłówek sekcji D98–D130 |
| Z2 | Nie merguj PR. | Zostaw PR jako draft i zgłoś gotowość; merge po „merguj” od Marka albo w ramach stałej zgody Marka na PR doc-only, jeśli taka zgoda została dana. Zmiana 2026-10-31: PR doc-only merguje Cezar po review Kod bez FAIL (stała zgoda Marka); PR z kodem tylko po „merguj”; Kod nie merguje. | P5, P23 (6) |
| Z3 | Nie pushuj do upstream (`open-mercato/open-mercato`). | Każde polecenie `gh` z `--repo AdamskiMarek/open-mercato`; zgłoszenie do upstream tylko jako issue, gdy decyzja tak mówi. | P6, D96 |
| Z4 | Nie rób force-push ani nie przepisuj historii. | Nowy commit na gałęzi; przez Git Data API ref aktualizowany z `force=false` po sprawdzeniu heada. | P19 |
| Z5 | Nie zapisuj sekretów w repo, ustawieniach, logach ani w raportach. | Sekrety tylko w zmiennych środowiskowych wdrożenia; token używany wyłącznie w `bash -lc` i nigdy nie drukowany. | D130, D143 |
| Z6 | Nie podawaj estymat w dniach. | Opisz zakres jako listę funkcji i encji per faza (MVP/v1/v2). | P11 |
| Z7 | Nie pytaj Marka bezpośrednio. | Pytanie biznesowe dopisz do grupy „Do decyzji człowieka” (`.ai/process/review-format.md`) i przekaż Koordynatorowi. | P1 |
| Z8 | Nie usuwaj wiersza i nie zmieniaj sensu aktywnej decyzji bez śladu. | Nowa decyzja to nowy wiersz plus `superseded` (stary wiersz: `superseded (Dnn)`). Doprecyzowanie w tym samym wierszu tylko z adnotacją „zmiana RRRR-MM-DD” i źródłem. | `.ai/decisions.md`, „Zasada” |
| Z9 | Nie rozstrzygaj sam sprzeczności speki z rejestrem. | Nie commituj spornego punktu; zgłoś cytat z obu miejsc (plik:linia). | P20 |
| Z10 | Nie traktuj briefu jak speki. | Brief to cel i zakres; zachowanie, model i kody błędów bierz ze speki i z D. | P14 |
| Z11 | Wykonawca (Cezar albo jego agent kodujący, P23) nie zmienia treści TC w planach testów (kroki, asercje). | Drobne zmiany meta w planach (nagłówki, changelog, daty, odesłania) może zrobić Cezar, z wpisem w changelogu; zmianę treści TC zgłoś jako zadanie dla niezależnej sesji planu — jej wynik commituje Cezar bez zmiany treści TC (zmiana 2026-10-31). | P21 (P4), P23 |
| Z12 | Nie zamykaj zadania bez werdyktu Weryfikatora. | Przekaż Weryfikatorowi TC zadania i środowisko testowe; zamknij dopiero po werdykcie „spełnione” (przepływ: `.ai/process/workflow.md`). | P18 |
| Z13 | Budujący (Cezar albo jego agent kodujący, P23): nie zaczynaj budowy story, które nie przeszło przez „gotowe do budowy” (dalej: „w budowie”, także po niespełnionych TC). Speki, plany testów i PR doc-only nie wymagają story. | Weź story z „gotowe do budowy” (po „implementujemy” i PASS bramki), podlinkuj PR w story, zostaw ocenę Weryfikatorowi; przepływ i statusy: `.ai/process/workflow.md`, „Praca w ClickUp”. Kod nie buduje story, które sam weryfikuje — uruchamia osobne sesje planu TC, spec-checku, review i bramki gotowości. Kod (zmiana 2026-10-31): nie commituje, nie otwiera PR i nie edytuje plików w repo — wynik sesji przekazuje w raporcie Cezarowi; FAIL w raporcie blokuje merge do poprawki Cezara; spory — Koordynator. | P22, P23 (Marek 2026-10-31 (via Koordynator)) |

## Pułapki, które już się zdarzyły

| # | Co poszło źle | Reguła | Jak robić |
|---|---|---|---|
| T1 | spec-check uruchomiony na plikach z working tree zamiast z repo. | Wynik liczy się tylko dla plików przy SHA heada. | Pobierz pliki przez `git show <SHA>:<ścieżka>` (albo `gh api …/contents/…?ref=<SHA>`), uruchom spec-check na nich i podaj SHA w raporcie. |
| T2 | Pomylone KA-6 z KA-7. | KA-6 = pomiar RAM workera importu (D115, D120); KA-7 = PoC bucketu OVHcloud z wersjonowaniem i lifecycle (D117, D129). | Przy każdym odwołaniu do KA podaj numer D obok numeru KA. |
| T3 | `--tc-pending-from` użyte jako bramka. | Flaga tylko oznacza brak TC dla nowych D jako oczekujący; nie jest werdyktem. | Bramka = spec-check bez flag: PASS, 0 FAIL. Wynik z flagą podawaj osobno i z nazwą flagi. |
| T4 | Plan testów pisany ze speki zamiast z decyzji. | Plan testów pisze inny model niż speka, w osobnej sesji, z rejestru D, bez czytania speki (P4). | Wejście planu: wyłącznie `.ai/decisions.md` — bez speki i bez briefów (P4); spekę porównuje dopiero review. |
| T5 | Force-push. | Jak Z4. | Nowy commit; przy konflikcie heada — stop i raport. |
| T6 | Push do upstream. | Jak Z3. | Sprawdź `--repo` w każdym poleceniu `gh` i zdalne repo przed pushem. |
| T7 | Estymaty w dniach w specu. | Jak Z6. | Przed commitem przeszukaj tekst pod kątem liczb z jednostką czasu w kontekście wyceny. |
| T8 | Sekret w repo. | Jak Z5. | Przed commitem przejrzyj diff pod kątem kluczy, tokenów i haseł; w razie wątpliwości — nie commituj i zgłoś. |
| T9 | Pytanie do Marka z pominięciem Koordynatora. | Jak Z7. | Każde pytanie biznesowe idzie przez Koordynatora. |
| T10 | Merge bez „merguj” i bez stałej zgody na doc-only. | Jak Z2. | Przed merge wskaż wiadomość z „merguj” albo stałą zgodę dla PR doc-only. |
