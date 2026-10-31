# Format review

**Status:** obowiązuje od 2026-10-31 (P15). Źródło: Marek 2026-10-31 (przez Koordynatora).

Dotyczy każdego review speki, planu testów, briefu, rejestru i (po „implementujemy”) kodu. Recenzent to osobna sesja tylko do odczytu; autor sprawdza każde ustalenie, zanim je przyjmie.

## Trzy grupy

| Grupa | Co tam trafia | Kto zamyka |
|---|---|---|
| **Do poprawy** | Błąd albo brak, który autor może poprawić teraz, bez nowej decyzji biznesowej: sprzeczność speki z D, brak kodu błędu, zła ścieżka, brak testu dla aktywnej D. | Autor w tym samym PR. |
| **Na później** | Słuszna uwaga poza zakresem PR albo fazy (v1, v2, etap kodu). | Wpis w „Otwarte” speki albo w rejestrze z fazą; bez zmiany w tym PR. |
| **Do decyzji człowieka** | Rozstrzygnięcie biznesowe albo produktowe (P1): zakres, zachowanie widoczne dla klienta, cennik, prawo. | **Marek, wyłącznie przez Koordynatora.** Recenzent, Cezar i Kod nie piszą do Marka bezpośrednio. |

Ustalenia odrzucone (fałszywy alarm, sprzeczne z D) idą na osobną listę „Odrzucone” z jednym zdaniem powodu.

## Pole każdego ustalenia

| Pole | Treść |
|---|---|
| ID | `R<runda>-<nr>`, np. `R2-3` |
| Waga | krytyczna / ważna / drobna (jak w `readiness-gate.md`) |
| Grupa | jedna z trzech powyżej |
| Miejsce | plik:linia przy SHA albo numer D |
| Dowód | cytat z pliku albo z D |
| Propozycja | konkretna zmiana albo pytanie |

## Reguła stopu

- Rundy review liczymy per PR (R1, R2, R3).
- Gdy **trzecia runda** nadal ma ustalenia krytyczne albo ważne w grupie „Do poprawy”, nie robimy czwartej rundy. Problem jest w specyfikacji: Cezar poprawia spekę u źródła (sekcja, brief, brakująca albo sprzeczna D), a dopiero potem jest nowe review z licznikiem od R1.
- Ustalenia z „Do decyzji człowieka” nie liczą się do reguły stopu; czekają na Marka (przez Koordynatora).

## Szablon raportu review

```markdown
# Review R<n> — <PR / plik> @ <SHA>

**Recenzent:** <sesja, tylko do odczytu> · **Data:** <RRRR-MM-DD>
**Podsumowanie:** do poprawy N (krytyczne N, ważne N), na później N, do decyzji człowieka N, odrzucone N

## Do poprawy
| ID | Waga | Miejsce | Dowód | Propozycja |
|---|---|---|---|---|

## Na później
| ID | Waga | Miejsce | Dowód | Gdzie zapisać (Otwarte / faza) |
|---|---|---|---|---|

## Do decyzji człowieka (tylko przez Koordynatora)
| ID | Pytanie do Marka | Warianty | Skutek każdego wariantu | Miejsce |
|---|---|---|---|---|

## Odrzucone
| ID | Powód |
|---|---|
```
