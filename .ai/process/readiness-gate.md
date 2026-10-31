# Bramka gotowości (readiness gate)

**Status:** obowiązuje od 2026-10-31 (P13). Źródło: Marek 2026-10-31 (przez Koordynatora).

## Po co

Przed prośbą do Marka o „implementujemy” (P3) osobna sesja odpowiada na jedno pytanie:

> **Czy programista zbuduje to bez wymyślania niezapisanych decyzji?**

Spec-check sprawdza formę (sekcje, numery D, pokrycie testami). Bramka sprawdza treść: czy z rejestru, speki, briefu i planu testów da się zbudować moduł bez zgadywania.

## Kiedy

- Raz na moduł, gdy spec-check bez flag daje PASS (0 FAIL) na plikach z repo przy SHA heada.
- Ponownie po każdej zmianie speki, która zamyka uwagi z FAIL albo CONCERNS.
- Bramki nie uruchamia się w ramach tego samego PR, w którym powstała ta procedura. Uruchomienie zleca Cezar albo Koordynator.

## Kto

- Osobna sesja, **tylko do odczytu**: nowe okno bez historii, nie autor speki i nie autor planu testów.
- Nie zmienia plików, nie commituje, nie otwiera PR, nie uruchamia kodu.
- Nie pyta Marka. Uwagi biznesowe zbiera w grupie „Do decyzji człowieka”, a Koordynator przekazuje je Markowi (P1, `review-format.md`).

## Wejście (wyłącznie z repo przy podanym SHA)

Każdy plik czytany przez `git show <SHA>:<ścieżka>` (albo `gh api …/contents/<ścieżka>?ref=<SHA>`), nigdy z working tree:

1. `.ai/decisions.md` (rejestr D i P, jedyne źródło decyzji — P12).
2. Speka modułu z `.ai/specs/`.
3. Brief modułu z `.ai/briefs/` (cel i zakres, nie zastępuje speki — P14).
4. Plan testów modułu (`.ai/specs/*-test-plan.md`).
5. `.ai/architecture.md` (właściciele, stany, granice, klucze — P16).
6. Raport spec-check z tego samego SHA.

## Werdykty

| Werdykt | Kiedy |
|---|---|
| **PASS** | Brak uwag krytycznych i ważnych. Uwagi drobne są dopuszczalne. |
| **CONCERNS** | Brak uwag krytycznych, jest co najmniej jedna ważna. Każdą da się zamknąć doprecyzowaniem technicznym, bez nowej decyzji biznesowej. |
| **FAIL** | Co najmniej jedna uwaga krytyczna albo co najmniej jedna uwaga wymagająca decyzji biznesowej. |

Wagi uwag:

- **krytyczna** — programista musiałby wymyślić zachowanie widoczne dla użytkownika, model danych, uprawnienia, klucz unikalności, przejście stanu albo kontrakt między modułami;
- **ważna** — brakuje doprecyzowania technicznego (kod błędu, parametr, kolejność kroków), które Cezar może rozstrzygnąć bez Marka;
- **drobna** — redakcja, odesłanie, nazewnictwo; nie zmienia tego, co zostanie zbudowane.

## Co dalej po werdykcie

- **PASS** — Koordynator może poprosić Marka o „implementujemy” (P3).
- **CONCERNS** — Cezar poprawia spekę albo dopisuje decyzję techniczną; zamiast prosić Marka z otwartymi uwagami, bramka idzie ponownie.
- **FAIL** — poprawa speki albo nowa decyzja w rejestrze. Uwagi biznesowe idą do Marka wyłącznie przez Koordynatora. Bez prośby o „implementujemy” do czasu PASS.

## Prompt sesji (do skopiowania)

```text
Jesteś bramką gotowości (readiness gate) dla modułu <moduł> w repo AdamskiMarek/open-mercato.
Pracujesz TYLKO DO ODCZYTU: nie zmieniasz plików, nie commitujesz, nie otwierasz PR,
nie uruchamiasz kodu, nie piszesz do Marka. Nie podajesz estymat w dniach.

SHA: <pełny SHA heada develop_OM_CRM albo gałęzi PR>
Czytaj każdy plik przez `git show <SHA>:<ścieżka>` (albo gh api …/contents/<ścieżka>?ref=<SHA>):
- .ai/decisions.md
- .ai/specs/<speka modułu>.md
- .ai/briefs/<moduł>.md
- .ai/specs/<plan testów modułu>-test-plan.md
- .ai/architecture.md
- raport spec-check dla tego SHA: <ścieżka albo treść>

Pytanie: czy programista zbuduje ten moduł bez wymyślania niezapisanych decyzji?

Dla każdej zdolności z briefu („co ma umieć”) i każdego przejścia stanu, klucza
i kontraktu między modułami sprawdź, czy speka i rejestr D mówią jednoznacznie,
co zbudować. Szukaj w szczególności:
- zachowania, którego nie opisuje żadna D ani speka (programista musiałby zgadywać),
- sprzeczności między speką a D (cytat z obu, plik:linia),
- przejść stanów i kluczy unikalności bez źródła,
- kodów błędów, uprawnień i parametrów bez wartości albo bez właściciela,
- zdolności z briefu bez warunku sukcesu w specu lub bez testu w planie.

Nie oceniaj stylu. Nie proponuj nowych funkcji. Każda uwaga musi mieć dowód
(plik:linia przy SHA albo numer D).

Werdykt:
- PASS — brak uwag krytycznych i ważnych,
- CONCERNS — brak krytycznych, są ważne do zamknięcia technicznie,
- FAIL — jest krytyczna albo jest uwaga wymagająca decyzji biznesowej.

Wagi: krytyczna (trzeba wymyślić zachowanie, model, uprawnienia, klucz, stan
albo kontrakt), ważna (brak doprecyzowania technicznego), drobna (redakcja).

Odpowiedz dokładnie w formacie raportu z .ai/process/readiness-gate.md.
```

## Format raportu

```markdown
# Bramka gotowości — <moduł>

**SHA:** <pełny SHA> · **Data:** <RRRR-MM-DD> · **Sesja:** <identyfikator, tylko do odczytu>
**Werdykt: PASS | CONCERNS | FAIL** (krytyczne: N, ważne: N, drobne: N)

## Uwagi

| # | Waga | Grupa | Miejsce (plik:linia @SHA / D) | Czego brakuje albo co jest sprzeczne | Co programista musiałby wymyślić | Propozycja (kto) |
|---|---|---|---|---|---|---|
| G1 | krytyczna | Do decyzji człowieka | .ai/specs/…:123; D116 | … | … | pytanie do Marka przez Koordynatora |
| G2 | ważna | Do poprawy | … | … | … | Cezar: doprecyzować w specu §… |

Grupy jak w `.ai/process/review-format.md`: „Do poprawy”, „Na później”, „Do decyzji człowieka”.

## Sprawdzone bez uwag

- <zdolność z briefu / przejście / klucz> — źródło: <D albo plik:linia>

## Założenia sesji

- <co sesja przyjęła, gdy materiał był niejednoznaczny; każde założenie = uwaga albo jawne „bez wpływu”>
```
