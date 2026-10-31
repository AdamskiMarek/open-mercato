# Przepływ pracy Klin #1 (od speki do merge)

**Status:** 2026-10-31 (P18). Opis kolejności kroków i ról. Szczegóły kroków: bramka — `readiness-gate.md` (P13), review — `review-format.md` (P15), zasady agentów — `../agent-rules.md` (P17). Źródło decyzji: `.ai/decisions.md` (P12).

## Przepływ

```mermaid
flowchart TD
    spec["Speka + plan testów<br/>(Cezar; plan: niezależna sesja, P4)"] --> sc{"spec-check bez flag<br/>@head: PASS?"}
    sc -- "nie" --> spec
    sc -- "tak" --> gate{"Bramka gotowości (P13)"}
    gate -- "CONCERNS / FAIL" --> spec
    gate -- "PASS" --> impl["„implementujemy” — Marek (P3)"]
    impl --> code["Kod i review (Cezar, P2; review wg P15)"]
    code --> qa{"Weryfikator na TC<br/>środowisko testowe (P18)"}
    qa -- "niespełnione TC" --> code
    qa -- "werdykt: spełnione" --> done["Zamknięcie zadania"]
    done --> merge{"„merguj” od Marka (P5)<br/>albo stała zgoda na doc-only"}
    merge -- "tak" --> m["Merge"]
```

| # | Krok | Kto | Wejście | Wyjście |
|---|---|---|---|---|
| 1 | Speka i plan testów | Cezar (speka); niezależna sesja innym modelem (plan, z rejestru D, bez czytania speki) | `.ai/decisions.md`, brief (P14) | speka + plan testów w PR doc-only |
| 2 | spec-check | wykonawca | pliki z repo przy SHA heada (`git show`) | PASS, 0 FAIL bez flag |
| 3 | Bramka gotowości | osobna sesja tylko do odczytu | speka, plan, rejestr, brief, `architecture.md` | PASS / CONCERNS / FAIL (P13) |
| 4 | „implementujemy” | Marek, przez Koordynatora | werdykt bramki PASS | zgoda na kod (P3) |
| 5 | Kod i review | Cezar (P2); review w formacie P15 | speka, TC | PR z kodem i testami |
| 6 | Weryfikacja na TC | Weryfikator (QA) | TC zadania + środowisko testowe (instancja testowa open-mercato.pl, P7) | werdykt per TC: spełnione / niespełnione, z dowodem |
| 7 | Zamknięcie zadania | Koordynator | werdykt Weryfikatora „spełnione” | zadanie zamknięte |
| 8 | Merge | wykonawca, dopiero po „merguj” Marka albo w ramach stałej zgody na PR doc-only (P5) | zamknięte zadanie, draft PR | merge do `develop_OM_CRM` w forku (P6) |

## Weryfikator (QA)

- Działa od „implementujemy”: dla każdego zadania sprawdza na środowisku testowym, czy spełnia swoje TC; zadanie zamykamy dopiero po jego werdykcie (P18).
- Dowód werdyktu wg P7: wynik testów i zrzuty ekranu albo przebieg na instancji testowej.
- Nie wdraża, nie merguje i nie ma dostępu do produkcji (P18). Niespełnione TC wracają do kroku 5 z listą TC i dowodem.
- Brak TC dla zachowania albo TC sprzeczne z D → ustalenie „Do poprawy” dla niezależnej sesji planu (treść TC zmienia tylko ona, `agent-rules.md` Z11); pytanie biznesowe → „Do decyzji człowieka”, przez Koordynatora (P1, P15).
- PR doc-only (bez kodu) nie wymaga Weryfikatora: kontrolą jest spec-check bez flag @head.
