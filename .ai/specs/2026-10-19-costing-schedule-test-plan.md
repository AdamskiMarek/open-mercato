# Niezależny plan testów — Kalkulacja kosztów + Kalkulator ofert + Harmonogram

**Dokument**: SPEC ONLY (plan testów niezależny od specyfikacji PR #10, brak kodu)
**Data**: 2026-10-19
**Autor**: Copilot (plan testów na podstawie wymagań biznesowych Marka Adamskiego)

---

## Liczniki scenariuszy (aktualizacja na końcu)

| Obszar | Liczba scenariuszy |
|--------|-------------------|
| Kalkulacja kosztów (TC-COST) | 22 |
| Import/eksport (TC-IMP) | 8 |
| Powiązania deal/projekt/inwestycja (TC-DEAL) | 10 |
| Wersje i oferta (TC-VER) | 6 |
| Cenniki (TC-PRICE) | 4 |
| Widoczność i uprawnienia (TC-PERM) | 8 |
| Koszty rzeczywiste (TC-REAL) | 3 |
| Harmonogram Gantt (TC-GANTT) | 8 |
| Testy wydajności (TC-PERF) | 3 |
| **Razem** | **72** |

---

## 1. Zakres i priorytety (macierz ryzyka)

### 1.1. Ryzyka biznesowe i ich mapowanie

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Błędy kalkulacji finansowej (zaokrąglenia, dzielenie przez zero) | Wysoki | Krytyczny | P0 | Kalkulacja | TC-COST-001 do TC-COST-022 |
| R2 | Wyciek danych międzytenantowych (multitenant izolacja) | Średni | Krytyczny | P0 | Uprawnienia | TC-PERM-001 do TC-PERM-008 |
| R3 | Uszkodzenie danych przy imporcie (złe kodowanie, formatowanie) | Wysoki | Wysoki | P1 | Import/eksport | TC-IMP-001 do TC-IMP-008 |
| R4 | Utrata integralności oferty po wysłaniu (zmiana ceny, marży) | Średni | Wysoki | P1 | Wersje | TC-VER-001 do TC-VER-006 |
| R5 | Niekonwersja oferty przy wygranym dealu (brak synchronizacji) | Średni | Wysoki | P1 | Harmonogram | TC-GANTT-001 do TC-GANTT-008 |
| R6 | Błędy harmonogramu (cykl, zależności, auto-przesunięcie) | Średni | Wysoki | P1 | Harmonogram | TC-GANTT-005 do TC-GANTT-008 |
| R7 | Duplikowanie lub gubianie inwestycji (dopasowanie) | Niski | Wysoki | P2 | Powiązania | TC-DEAL-009, TC-DEAL-010 |

### 1.2. Poza zakresem (Phase 2+)

- Integracje z Sekocenbud, Intercenbud, systemami zewnętrznymi
- Adapter MS Project
- Systemy płatności i faktury
- Mobilna aplikacja

---

## 2. Poziomy testów

Mapowanie do narzędzi i konwencji repo:

| Poziom | Narzędzie | Konfiguracja | Ścieżka testów | Komenda |
|--------|-----------|--------------|----------------|---------|
| **Unit** | Jest/Vitest | `jest.config.cjs`, `jest.config.base.cjs` | `__tests__/*.test.ts` | `yarn test` |
| **Integration** | Jest + mock DB | `jest.config.cjs` z `createTestDb` | `__tests__/*.integration.test.ts` | `yarn test` |
| **API** | Jest + Supertest | `jest.config.cjs` | `__tests__/*.api.test.ts` | `yarn test` |
| **E2E/UI** | Playwright | `.ai/qa/tests/playwright.config.ts` | `__integration__/**/*.spec.ts` | `yarn test:integration` |
| **Performance** | Custom bash/Node | `.ai/agentic.config.json` | Manualne + monit RAM/CPU | `yarn dev:profile` |

---

## 3. Scenariusze testowe: Kalkulacja kosztów (22 TC)

Podstawowe operacje kalkulacji, arytmetyka finansowa, zaokrąglenia, jednostki, narzuty i ceny.

#### TC-COST-001: Siatka wierszy — dodaj pozycję

- **Priorytet**: P0 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Kalkulator otwarty, pusty lub z istniejącymi wierszami
- **Kroki**:
  1. Kliknij "Dodaj pozycję"
  2. Uzupełnij: nazwa, ilość (1.5), jednostka (m³), koszt jednostkowy (100.00), cena (150.00)
  3. Zapisz
- **Oczekiwane wyniki**:
  - Wiersz dodany, wartość = 1.5 × 150 = 225.00
  - Sumy zaktualizowane
  - Brak błędów walidacji

#### TC-COST-002: Siatka wierszy — sekcja grupująca

- **Priorytet**: P1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Kalkulator z co najmniej 2 pozycjami
- **Kroki**:
  1. Dodaj sekcję "Materiały"
  2. Przenieś 2 pozycje do sekcji (drag-drop lub pole Parent)
  3. Sekcja ma pole "Marża sekcji" (% lub kwota)
- **Oczekiwane wyniki**:
  - Sekcja grupuje pozycje, warunkowe rozwijanie
  - Suma sekcji = sum(pozycji) + marża sekcji
  - Narzut sekcji dziedziczony do pozycji (bez ręcznej ceny)

#### TC-COST-003: Zaokrąglenia — suma groszy vs suma zaokrąglonych

- **Priorytet**: P0 | **Poziom**: Unit
- **Warunki wstępne**: 3 pozycje z cenami nie-całkowitymi
- **Kroki**:
  1. Cena 1: 100.33 PLN, Cena 2: 200.34 PLN, Cena 3: 150.33 PLN
  2. Sumy = ?
- **Oczekywane wyniki**:
  - Suma = 100.33 + 200.34 + 150.33 = 450.99 (lub zaokrąglona do 451.00)
  - **Luka spec**: standard zaokrąglenia (IEEE 754 / bankierski) nie sprecyzowany

#### TC-COST-004: Dzielenie przez zero — jednostka z zerem

- **Priorytet**: P0 | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z ilością = 0
- **Kroki**:
  1. Ustaw ilość = 0, koszt = 100, cena = 50
  2. Zapisz
- **Oczekiwane wyniki**:
  - Wartość = 0 × 50 = 0 (poprawnie)
  - Brak exception, UI nie zawieszony
  - Komunikat ostrzegawczy: "Ilość = 0"

#### TC-COST-005: Marża ujemna — sygnalizacja

- **Priorytet**: P1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Pozycja z całkowitym kosztem 200, ceną 150
- **Kroki**:
  1. Marża kalkulowana = 150 - 200 = -50 (ujemna)
  2. Zapisz
- **Oczekiwane wyniki**:
  - Marża wyświetlona na czerwono (status token), wartość -50 PLN (-25%)
  - Widget podsumowania pokazuje marżę ujemną całej kalkulacji
  - Brak blokady zapisu, ale ostrzeżenie

#### TC-COST-006: Cena zero — dopuszczalna

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z kosztem 100
- **Kroki**:
  1. Ustaw cenę = 0 (darmowy transport, reklamacja)
  2. Marża = 0 - 100 = -100
- **Oczekiwane wyniki**:
  - Zapisana, widoczna jako marża -100%
  - Oferta całą z marżą ujemną

#### TC-COST-007: Jednostki — konwersje

- **Priorytet**: P1 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Pozycja z m³, zamiana na szt.
- **Kroki**:
  1. Ilość = 2 m³, zmień na 2 szt.
  2. Koszt = 100/m³ (stary), zmiana na 200/szt. (nowy)
- **Oczekywane wyniki**:
  - Jednostka zmieniona
  - Koszt zmienia się (lub wymaga ręcznej aktualizacji)
  - Brak silnej konwersji między m³/m²/szt. (użytkownik decyduje)

#### TC-COST-008: Jednostki — niezgodne (błąd)

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z m³
- **Kroki**:
  1. Spróbuj sumować m³ + kg w tej samej sekcji
  2. Zapisz
- **Oczekiwane wyniki**:
  - Ostrzeżenie: "Niezgodne jednostki w sekcji"
  - Sumy sekcji nie sumują jednostek (tylko wartości PLN)
  - Zezwolone w całej kalkulacji

#### TC-COST-009: Narzut — dziedziczenie (pozycja → sekcja → wersja)

- **Priorytet**: P0 | **Poziom**: Unit + Integration
- **Warunki wstępne**: Struktura: Wersja (narzut 20%) > Sekcja A (narzut 30%) > Pozycja 1 (bez narzutu)
- **Kroki**:
  1. Pozycja 1: koszt 100, cena wpisana?
  2. Wyznacz cenę od narzutu sekcji (100 × 1.30 = 130)
  3. Jeśli sekcja bez narzutu, użyj wersji (100 × 1.20 = 120)
- **Oczekywane wyniki**:
  - Najściślejszy narzut (sekcja 30%) przebija wersję (20%)
  - Jeśli ręczna cena pozycji → nie nadpisywana

#### TC-COST-010: Ręczna cena pozycji — nie nadpisywana

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Pozycja z narzutem sekcji 30%, ręczna cena
- **Kroki**:
  1. Ustaw cenę = 999 (ręcznie, poza narzutem)
  2. Zmień narzut sekcji z 30% na 50%
  3. Zapisz
- **Oczekywane wyniki**:
  - Cena pozycji pozostaje 999 (nie zmienia się automatycznie)
  - Marża zmienia się (nowa = 999 - koszt), ale cena nie

#### TC-COST-011: Trzy sposoby ustalenia ceny — suma linii

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: 3 pozycje, każda z ręczną ceną
- **Kroki**:
  1. Mode: "Suma cen z wierszy"
  2. Pozycja 1: 100 PLN, 2: 200 PLN, 3: 150 PLN
  3. Cena oferty = suma
- **Oczekiwane wyniki**:
  - Cena oferty = 100 + 200 + 150 = 450 PLN
  - Zmiana ceny pozycji → zmiana oferty automatycznie

#### TC-COST-012: Trzy sposoby ustalenia ceny — marża docelowa

- **Priorytet**: P0 | **Poziom**: Integration
- **Kroki**:
  1. Mode: "Marża docelowa"
  2. Całkowity koszt = 1000 PLN, marża docelowa = 30% (procent od ceny)
  3. Wyznacz cenę: Koszt = Cena × (1 - Marża%), czyli 1000 = Cena × 0.70
  4. Cena = 1000 / 0.70 = 1428.57 PLN
- **Oczekywane wyniki**:
  - Cena oferty = 1428.57 PLN
  - Marża rzeczywista = 428.57 / 1428.57 = 30%
  - Zmiana kosztu → nowa cena

#### TC-COST-013: Trzy sposoby ustalenia ceny — koszt × (1 + narzut)

- **Priorytet**: P0 | **Poziom**: Integration
- **Kroki**:
  1. Mode: "Koszt × (1 + narzut)"
  2. Całkowity koszt = 1000, narzut = 50%
  3. Cena = 1000 × 1.50 = 1500 PLN
- **Oczekywane wyniki**:
  - Cena oferty = 1500 PLN
  - Marża = 500 PLN (na koszcie, nie na cenie)

#### TC-COST-014: Marża — kwotowa i procentowa

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Cena 1000, koszt 600
- **Kroki**:
  1. Marża kwotowa = 1000 - 600 = 400 PLN
  2. Marża % = (1000 - 600) / 1000 = 40% (na cenie) lub (400 / 600) = 66.7% (na koszcie)
- **Oczekywane wyniki**:
  - Wyświetl obydwie (kwotową i %), jasne podpisanie
  - **Luka spec**: który standard % (na cenie czy koszcie)?

#### TC-COST-015: Narzut — ręczne nadpisanie

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Narzut sekcji = 30%, cena pozycji = koszt × 1.40
  2. Zapisz jako "ręczne nadpisanie narzutu"
- **Oczekywane wyniki**:
  - Cena nie zmienia się przy zmianie narzutu
  - Pole "źródło ceny" = "ręczne nadpisanie"

#### TC-COST-016: Jednostki — słownik firm

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Firma ustawiła słownik: m³, m², mb, kg, szt., h
- **Kroki**:
  1. Dodaj pozycję, dropdown jednostek
  2. Wybierz m³
- **Oczekywane wyniki**:
  - Tylko jednostki ze słownika firmy dostępne
  - Dodaj nową jednostkę (rola Admin)

#### TC-COST-017: Ekstremalne wartości — duże liczby

- **Priorytet**: P2 | **Poziom**: Unit
- **Warunki wstępne**: -
- **Kroki**:
  1. Ilość = 999999, koszt = 99999.99, cena = 999999.99
  2. Zapisz
- **Oczekiwane wyniki**:
  - Brak overflow/underflow (JavaScript Number lub Decimal)
  - Wyświetlenie bez naukowej notacji

#### TC-COST-018: Ekstremalne wartości — ujemne

- **Priorytet**: P1 | **Poziom**: Unit
- **Kroki**:
  1. Ilość = -5 (zwrot?), koszt = -100 (kredyt), cena = -200
  2. Zapisz
- **Oczekiwane wyniki**:
  - Przyjęte (zwrot, rabat)
  - Marża może być ujemna/dodatnia w zależności od logiki

#### TC-COST-019: Notatka (wiersz informacyjny)

- **Priorytet**: P2 | **Poziom**: Unit
- **Kroki**:
  1. Dodaj wiersz typu "notatka"
  2. Tekst = "Transport dodatkowo negocjowany"
  3. Zapisz
- **Oczekywane wyniki**:
  - Wiersz widoczny w siatce, nie wpływ na sumy
  - PDF zawiera notatki

#### TC-COST-020: Podsumowanie częściowe — sekcja

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Sekcja A: 3 pozycje, suma = 500 PLN
  2. Sekcja B: 2 pozycje, suma = 300 PLN
  3. Podsumowanie częściowe po sekcji A
- **Oczekywane wyniki**:
  - Wiersz "Suma A" = 500 PLN
  - Wiersze poniżej + kolejne sumy

#### TC-COST-021: Edycja bezpośrednia w komórkach (Excel-like)

- **Priorytet**: P0 | **Poziom**: E2E/UI
- **Kroki**:
  1. Kliknij na komórkę "ilość"
  2. Wpisz nową wartość, Enter
  3. Następna komórka aktywna
- **Oczekywane wyniki**:
  - Wartość zaktualizowana, sumy przeliczone
  - Brak full-page refresh
  - Kopiuj/wklej z Excela działa

#### TC-COST-022: Kopiuj/wklej z Excela — przywleczenie całego wiersza

- **Priorytet**: P1 | **Poziom**: E2E/UI + Integration
- **Kroki**:
  1. Excel: 2 m³ | 100 | 50 PLN/m³ | 100 PLN (wpisane)
  2. Kopiuj wiersz z Excela, wklej do kalkulatora
  3. Mapowanie kolumn (lub automatyczne)
- **Oczekiwane wyniki**:
  - Wiersz wklejony z poprawnymi wartościami
  - Sumy przeliczone

---

## 4. Scenariusze testowe: Import/Eksport (8 TC)

Łatwy import z XLSX/CSV, kreator mapowania, walidacja, eksport zgodny z Excelem.

#### TC-IMP-001: Import XLSX — mapowanie kolumn

- **Priorytet**: P1 | **Poziom**: E2E/UI + Integration
- **Warunki wstępne**: Plik XLSX: Pozycja | Ilość | Cena
- **Kroki**:
  1. Kliknij "Import"
  2. Wybierz plik XLSX
  3. Kreator: mapuj Pozycja → Nazwa, Ilość → Ilość, Cena → Cena jednostkowa
  4. Zapisz mapowanie (remember)
  5. Podgląd: ~10 wierszy
  6. Import
- **Oczekiwane wyniki**:
  - Wiersze zaimportowane, sumy przeliczone
  - Mapowanie zapamiętane dla kolejnych importów z tego pliku

#### TC-IMP-002: Import CSV — kodowanie UTF-8 i ANSI

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. CSV UTF-8 z polskimi znakami: "śruba M10 × 50mm"
  2. CSV ANSI (Windows-1250)
  3. Import obu
- **Oczekiwane wyniki**:
  - Obie poprawnie zdekodowane (auto-detect lub dropdown)
  - Znaki pojawiają się prawidłowo

#### TC-IMP-003: Import — separator (przecinek / średnik / tab)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. CSV z ";", CSV z ","
  2. Import
- **Oczekywane wyniki**:
  - Auto-detect lub dropdown
  - Kolumny rozdzielone prawidłowo

#### TC-IMP-004: Import — przecinek dziesiętny (1.5 vs 1,5)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. XLSX/CSV: "1.5 m³", "100,50 PLN" (polski format)
  2. Import
- **Oczekiwane wyniki**:
  - Rozpoznane jako 1.5 i 100.50
  - Logika: jeśli separator=",", to "," = kropka, "." = separator tysiąca
  - Brak błędów parsowania

#### TC-IMP-005: Import — błędy w wierszach (złe dane)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. XLSX: Wiersz 3 brakuje ilości, Wiersz 5 cena = "abc", Wiersz 7 = puste
  2. Import
- **Oczekiwane wyniki**:
  - Wiersze 1,2,4,6,8+ zaimportowane
  - Wiersz 3,5,7 wyróżniony (czerwony), błąd: "Brakuje Ilości", "Cena: wartość nie-numeryczna"
  - Opcja: skip, fix, nebo abort

#### TC-IMP-006: Import — duże pliki i limity

- **Priorytet**: P2 | **Poziom**: Performance
- **Kroki**:
  1. XLSX: 5000 wierszy × 10 kolumn (~5 MB)
  2. Import, monit RAM/CPU, czas
- **Oczekiwane wyniki**:
  - Import < 10s (budżet czasu)
  - RAM peak < 500 MB (budżet)
  - **Luka spec**: konkretne limity (5000 rows? 10 MB?) nie sprecyzowane

#### TC-IMP-007: Import XLSX — scalone komórki, formuły, makra

- **Priorytet**: P2 | **Poziom**: Integration
- **Kroki**:
  1. XLSX: scalone komórki, formuły (=SUM), makra
  2. Import
- **Oczekiwane wyniki**:
  - Ignoruj formatowanie, bierz wartości
  - Makra = ignoruj (bezpieczeństwo)
  - Scalone komórki: pierwsze komórka scalona zawiera wartość

#### TC-IMP-008: Eksport XLSX — zgodny z polskim Excelem

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Kalkulator z 5 pozycjami, różne jednostki, marże
  2. Eksport XLSX
  3. Otwórz w Excelu
- **Oczekiwane wyniki**:
  - Format: .xlsx (Microsoft Office), nie .xls
  - Kodowanie UTF-8
  - Polskie znaki: "Śruba" wyświetla się poprawnie
  - Sekcje, sumy, nie tylko dane (opcjonalnie formatowanie)

---

Kontynuuję w następnym post z pozostałymi obszarami (Powiązania, Wersje, Cenniki, Uprawnienia, Koszty rzeczywiste, Harmonogram).

---

## 5. Scenariusze testowe: Powiązania (Deal / Projekt / Inwestycja) — 10 TC

Kalkulacja bez deala, podpięcie deala i projektu, rozpoznawanie inwestycji, wybór oferty głównej.

#### TC-DEAL-001: Kalkulacja bez deala — wycena wewnętrzna

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Nowy kalkulator, bez deala
- **Kroki**:
  1. Stwórz kalkulację: nazwa "Wycena X"
  2. Dodaj 3 pozycje, oblicz cenę
  3. Zapisz bez przypisania do deala
- **Oczekiwane wyniki**:
  - Kalkulator zapisany, status "Robocza" (bez deala)
  - Możliwość edycji i ponownego zapisu
  - Widoczny w liście kalkulacji bez filtra deal

#### TC-DEAL-002: Podpięcie deala później — kalkulacja robocza → deal

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Otwarty kalkulator bez deala
  2. Kliknij "Podepnij deal"
  3. Wybierz deal z listy (lub utwórz nowy)
  4. Zapisz
- **Oczekywane wyniki**:
  - Deal przypisany, kalkulator widoczny na deal
  - Cena kalkulacji trafia do deala (wartość szansy)
  - Historia zmian deala zarejestrowana

#### TC-DEAL-003: Podpięcie projektu/inwestycji — 1:N wiele dealów

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Inwestycja "Hala produkcyjna"
  2. Deal 1 (Generalny wykonawca A), Deal 2 (Generalny wykonawca B)
  3. Każdy deal ma swoją kalkulację
- **Oczekywane wyniki**:
  - Oba deale przypisane do tej samej inwestycji
  - Widget inwestycji podsumowuje: 2 oferty, wartości, oferta główna

#### TC-DEAL-004: Oferta główna vs alternatywna — wybór

- **Priorytet**: P0 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Inwestycja z Deal A (główna, cena 100k) i Deal B (alternatywna, cena 120k)
  2. Zmień ofertę główną na Deal B
  3. Zapisz
- **Oczekywane wyniki**:
  - System pokazuje komunikat: "Istnieje już oferta główna. Zmienić na nową?"
  - Użytkownik potwierdza
  - Audit trail: kto, kiedy, stara→nowa
  - Deal A → alternatywna, Deal B → główna

#### TC-DEAL-005: Komunikat — wielokrotne oferty dla tej samej inwestycji

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Inwestycja zaistniała (2 oferty)
  2. Zaloguj się jako użytkownik i przejdź do Deal 3 nowego generalnego
  3. Spróbuj podpiąć do tej samej inwestycji
- **Oczekiwane wyniki**:
  - Komunikat: "Ta inwestycja ma już ofertę dla innego wykonawcy. Którą ustawić jako główną?"
  3-button choice: Nowa (Deal 3) | Stara (Deal A/B) | Anuluj

#### TC-DEAL-006: Inwestycja — dopasowanie po e-Zamówienia BZP

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Excel import: "e-Zamówienia ID: 9876543"
  2. System szuka istniejących inwestycji po ID
  3. Dopasuj lub utwórz nową
- **Oczekiwane wyniki**:
  - Znaleziona istniejąca inwestycja → podpięcie
  - Lub: "Nowa inwestycja? Potwierdzić mapowanie"
  - Identyfikator e-Zamówienia zapamiętany w inwestycji

#### TC-DEAL-007: Inwestycja — dopasowanie po TED

- **Priorytet**: P2 | **Poziom**: Integration
- **Kroki**:
  1. Plik import z numerem TED (ogłoszenia)
  2. System szuka inwestycji po identyfikatorze TED
- **Oczekiwane wyniki**:
  - Znaleziona inwestycja → podpięcie
  - Lub fallback: szukaj po nazwie i NIP

#### TC-DEAL-008: Inwestycja — dopasowanie fallback (nazwa + NIP)

- **Priorytet**: P2 | **Poziom**: Integration
- **Kroki**:
  1. Brak ID przetargowego
  2. Kalkulator: klient = "Acme Inc", NIP = "1234567890", nazwa projektu = "Hala montażu"
  3. System szuka inwestycji "Hala montażu" + NIP
- **Oczekiwane wyniki**:
  - **Podpowiedź**, nie automatyczne dopasowanie
  - Użytkownik potwierdza: "To ta inwestycja? Tak/Nie/Nowa"
  - **Luka spec**: priorytet źródeł (e-Zamówienia > TED > BIP > kod > nazwa+NIP) nie jasny

#### TC-DEAL-009: Inwestycja — scalanie

- **Priorytet**: P2 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Dwie inwestycje "Hala A" i "Hala B" (ta sama fizycznie, różne ID)
  2. Admin: "Scal inwestycje"
  3. Wybierz źródłową i docelową
- **Oczekiwane wyniki**:
  - Wszystkie deale/kalkulacje przeniesione
  - Identyfikatory zapamiętane (mapowanie)
  - Audit trail

#### TC-DEAL-010: Inwestycja — rozdzielanie

- **Priorytet**: P2 | **Poziom**: Integration
- **Kroki**:
  1. Inwestycja "Kompleks" z 3 dealami
  2. Deal 1 i 2 powinny być "Hala A", Deal 3 = "Hala B"
  3. Admin: rozdziel
- **Oczekiwane wyniki**:
  - Nowa inwestycja "Hala B" stworzona
  - Deal 3 przeniesiony
  - Oferta główna: czy Deal 1 w Hali A czy Deal 3 w Hali B?

---

## 6. Scenariusze testowe: Wersje i Oferta — 6 TC

Numeracja wersji, statusy, zamrożenie, PDF, porównanie wersji.

#### TC-VER-001: Wersje — numeracja (numer bazowy + rewizja)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Utwórz kalkulację, jest wersja 1.0
  2. Duplikuj jako nową wersję → 1.1
  3. Duplikuj znowu → 1.2
  4. Zmień numer bazowy na 2 → 2.0
- **Oczekiwane wyniki**:
  - Numeracja: 1.0, 1.1, 1.2, 2.0, 2.1 (jeśli duplikuj po 2.0)
  - Widoczna historia wersji

#### TC-VER-002: Statusy wersji — robocza → wysłana → zastąpiona / zaakceptowana / odrzucona

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Wersja 1.0: status "Robocza" (edytowalna)
  2. Kliknij "Wyślij" → status "Wysłana", zamrożona
  3. Utwórz wersję 2.0, wyślij → 1.0 zmienia się na "Zastąpiona"
  4. Na wersji 2.0: przycisk "Zaakceptuj" / "Odrzuć"
  5. Kliknij "Zaakceptuj" → status "Zaakceptowana"
- **Oczekiwane wyniki**:
  - Transition: Robocza → Wysłana → (Zaakceptowana | Odrzucona | Zastąpiona)
  - Logika: Robocza = edytowalna, Wysłana+ = nieedytowalna

#### TC-VER-003: Po wysłaniu — wersja zamrożona, niewidoczne zmiany

- **Priorytet**: P0 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Wersja 1.0, wysłana, cena = 100k
  2. Spróbuj zmienić cenę lub pozycje
  3. Zapisz
- **Oczekiwane wyniki**:
  - Komunikat: "Wersja wysłana. Nową wersję? Duplikuj i edytuj"
  - Nie mogę edytować, muszę duplikować
  - PDF generowany w momencie wysłania (snapshot)

#### TC-VER-004: Odblokowanie wysłanej wersji — tylko admin + nowa wersja

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Wysłana wersja 1.0
  2. Zaloguj się jako Admin
  3. Kliknij "Odblokuj" na wersji 1.0
  4. Edytuj i zapisz
- **Oczekiwane wyniki**:
  - Komunikat: "Odblokowanie utworzy nową wersję 1.1 (po duplikacji)"
  - Tworzy kopię (wersja 1.1 jako Robocza)
  - Oryginalna 1.0 → "Zastąpiona"
  - Audit: Admin X odblokowała o godzinie Y, przyczyna (pole)

#### TC-VER-005: Porównanie dwóch wersji

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Wersja 1.0 (cena 100k) vs Wersja 1.1 (cena 110k)
  2. Kliknij "Porównaj" na wersji 1.1
  3. Wybierz 1.0
- **Oczekiwane wyniki**:
  - Widok side-by-side
  - Zmiany wyróżnione: pozycja dodana/usunięta/zmieniona (różnica w cenie/ilości)
  - Suma różnicy: +10k

#### TC-VER-006: PDF oferty — snapshot zamrożony

- **Priorytet**: P0 | **Poziom**: E2E/UI
- **Kroki**:
  1. Wysłana wersja 1.0, wygenerowany PDF
  2. Wersja 1.1 zmienia cenę
  3. Otwórz PDF z wersji 1.0
- **Oczekiwane wyniki**:
  - PDF z wersji 1.0: cena = stara wartość
  - PDF = snapshot z momentu wysłania
  - Brak przeliczeń, bezpośrednie wartości

---

## 7. Scenariusze testowe: Cenniki — 4 TC

Reguły warstwowe, historyczność, proweniencja ceny.

#### TC-PRICE-001: Cennik warstwowy — reguły (zakres, narzut, minimalna ilość, ważność)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Utwórz regułę cennika:
     - Zakres: kategoria "Słupy"
     - Podstawa: koszt pozycji
     - Narzut: 25%
     - Min. ilość: 10 szt.
     - Ważna od 2026-10-01 do 2026-12-31
  2. Pozycja: 15 szt. × 100 = 1500 (koszt)
  3. Cena z cennika = 1500 × 1.25 = 1875
- **Oczekiwane wyniki**:
  - Reguła zastosowana (ilość ≥ 10)
  - Cena = 1875
  - Po 2026-12-31: reguła wygaśnie

#### TC-PRICE-002: Cennik — priorytet reguł

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Reguła A: kategoria "Słupy", narzut 20%
  2. Reguła B: całe cenniki, narzut 15% (bardziej ogólna)
  3. Reguła C: pozycja konkretna (SKU), narzut 30% (najbardziej konkretna)
  4. Pozycja pasuje do wszystkich trzech
- **Oczekiwane wyniki**:
  - Reguła C wygrywa (najbardziej konkretna)
  - Narzut = 30%
  - **Luka spec**: system priorytetów nie zdefiniowany

#### TC-PRICE-003: Proweniencja ceny — źródło, data, wartość historyczna

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Pozycja: koszt z cennika od 2026-10-15, wartość 100 PLN
  2. Po 2026-10-20: cennik zmienia się na 110 PLN
  3. Otwórz kalkulację z 2026-10-15
- **Oczekiwane wyniki**:
  - Kalkulacja wyświetla: koszt = 100 (historyczna wartość)
  - Metatag: "Źródło: Cennik 'Jesień 2026', snapshot 2026-10-15"
  - Brak retroaktywnej zmiany wstecz

#### TC-PRICE-004: Gotowość pod Sekocenbud / Intercenbud — mapowanie kodów

- **Priorytet**: P2 | **Poziom**: Integration
- **Kroki**:
  1. Firma ma mapowanie: SKU "S10" = Sekocenbud kod "SK-12345"
  2. Pozycja w kalkulacji: S10
  3. Eksport do Sekocenbud (Phase 2)
- **Oczekiwane wyniki**:
  - Mapowanie zapamiętane
  - Nie ma jeszcze integracji, ale architektura gotowa


---

## 8. Scenariusze testowe: Widoczność i Uprawnienia — 8 TC

Role, widoczność kosztów/marży/cen, multi-tenant izolacja, uprawnienia do edycji.

#### TC-PERM-001: Widoczność kosztów — konfiguracja per firma + rola

- **Priorytet**: P0 | **Poziom**: Integration + API
- **Warunki wstępne**: Firma A, role: Handlowiec, Manager, Obsługa
- **Kroki**:
  1. Admin ustawi: Handlowiec = widzi koszty
  2. Obsługa = nie widzi
  3. Zaloguj się jako Handlowiec i Obsługa
  4. Otwórz tę samą kalkulację
- **Oczekiwane wyniki**:
  - Handlowiec: kolumna "Koszt" widoczna
  - Obsługa: kolumna "Koszt" ukryta (puste lub "-")
  - API: oba żądania mają odpowiednie filtry (koszt vrócony/schowany)

#### TC-PERM-002: Widoczność marży — domyślnie ukryta

- **Priorytet**: P1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Kalkulator otwarty
  2. Kolumna "Marża" — czy widoczna?
  3. Admin włączy widoczność dla Managers
  4. Zaloguj się jako Manager
- **Oczekiwane wyniki**:
  - Domyślnie: kolumna "Marża" ukryta dla wszystkich poza Adminem
  - Po włączeniu: Manager widzi
  - Handlowiec (bez konfigu) = ukryta

#### TC-PERM-003: Widoczność cen sprzedaży — edycja narzutu

- **Priorytet**: P1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Admin: "Handlowiec może edytować narzut"
  2. Handlowiec otwiera pozycję
  3. Czy może zmienić narzut z 20% na 30%?
- **Oczekiwane wyniki**:
  - Tak, jeśli ma uprawnienie
  5 minutes.Pola "Narzut %" edytowalne
  - Obsługa: pola zablokowane (readonly)

#### TC-PERM-004: Uprawnienia — wszystkie deale vs tylko własne

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Firma A: "Każdy widzi tylko swoje deale"
  2. Handlowiec A stworzył Deal X
  3. Handlowiec B — czy widzi Deal X?
- **Oczekiwane wyniki**:
  - Ustawienie firmy: "Wszyscy widżą wszystkie deale" (domyślnie) lub "Tylko własnicy"
  - Jeśli "Tylko własnicy": Handlowiec B nie widzi Deal X
  - Admin: zawsze widzi

#### TC-PERM-005: Multi-tenant izolacja — brak przecieków danych

- **Priorytet**: P0 | **Poziom**: Integration + API
- **Kroki**:
  1. Zaloguj się jako użytkownik Firmy A
  2. Spróbuj dostępu do API `/api/v1/costing/DEAL_ID_FIRMY_B`
  3. Spróbuj /kalkulacje?ids=id_firmy_b_1,id_firmy_b_2
  4. Eksport wszystkich kalkulacji
- **Oczekiwane wyniki**:
  - 403 Forbidden dla Firmy B
  - Filtrowanie: tylko Firmy A
  - Eksport: tylko dane Firmy A
  - **Luka spec**: czy organization filter na DB czy w aplikacji?

#### TC-PERM-006: Marża po zamknięciu deala — widoczność per rola

- **Priorytet**: P1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Deal wygrana, status = "Zaakceptowana"
  2. Admin: "Pokaż marżę zaakceptowanej wersji po zamknięciu"
  3. Zaloguj się jako Manager, Handlowiec, Obsługa
  4. Otwórz closed deal
- **Oczekiwane wyniki**:
  - Ustawienie firmy (global lub per-role): czy marża widoczna po zamknięciu?
  - Jeśli global "Nie": wszystkie role = marża ukryta
  - Jeśli per-role "Manager=Tak": Manager widzi, pozostali nie
  - **Luka spec**: global czy per-role?

#### TC-PERM-007: Widoczność w PDF oferty — nigdy nie zawiera kosztów/marży

- **Priorytet**: P0 | **Poziom**: E2E/UI
- **Kroki**:
  1. Handlowiec (widzi koszt/marżę) generuje PDF
  2. Klient otwiera PDF
- **Oczekiwane wyniki**:
  - PDF dla klienta: pozycje, ceny, brak kosztów, brak marży
  - Brak różnicy role dla PDF — zawsze public view

#### TC-PERM-008: Widoczność w dashboardach / analityce

- **Priorytet**: P1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Dashboard "Ranking marż TOP 10"
  2. Handlowiec widzi TOP 10 swoich dealów
  3. Manager widzi wszystkich Handlowców
- **Oczekiwane wyniki**:
  - Filtrowanie danych w dashboardzie
  - Handlowiec: 10 własnych + dowolny inny (jeśli "wszyscy widzą")
  - Manager: agregat (niezbędne do business intelligence)

---

## 9. Scenariusze testowe: Koszty rzeczywiste — 3 TC

Rejestracja wydatków, budżet vs realizacja, marża rzeczywista.

#### TC-REAL-001: Rejestracja kosztu rzeczywistego — kategoria, kwota, data, źródło

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Kalkulator zaakceptowany, budżet kosztów 1000 PLN
  2. Deal wykonywany, rejestruj koszty:
     - 2026-10-20: Transport 200 PLN (kategoria: Transport)
     - 2026-10-22: Produkcja 150 PLN (kategoria: Produkcja)
     - 2026-10-25: Instalacja 100 PLN (kategoria: Montaż)
  3. Zapisz
- **Oczekiwane wyniki**:
  - Koszty powiązane z kalkulacją (opcjonalnie z dealem)
  - Tabelka: data | kategoria | kwota | źródło (np. "FV-1234")
  - Sumy per kategoria

#### TC-REAL-002: Raport budżet vs koszty rzeczywiste

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Kroki**:
  1. Kalkulator: Budżet = Produkcja 500, Transport 200, Montaż 300 (razem 1000)
  2. Rzeczywisty koszt (z TC-REAL-001):
     - Produkcja 150
     - Transport 200
     - Montaż 100
  3. Otwórz raport
- **Oczekiwane wyniki**:
  - Tabela: Kategoria | Budżet | Rzeczywisty | Różnica | %
  - Produkcja: 500 | 150 | -350 | -70% (pod budżetem)
  - Transport: 200 | 200 | 0 | 0% (zgodnie)
  - Montaż: 300 | 100 | -200 | -66% (pod budżetem)
  - Razem: 1000 | 450 | -550 | -55%

#### TC-REAL-003: Marża rzeczywista vs oferowana — porównanie

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Oferowana marża: 300 PLN (cena 1000 - koszt 700)
  2. Rzeczywisty koszt: 450 PLN
  3. Rzeczywista marża = 1000 - 450 = 550 PLN
  4. Raport efektywności
- **Oczekiwane wyniki**:
  - Marża oferowana vs rzeczywista: +250 PLN (lepiej niż zakładano)
  - ROI: (550 - 300) / 300 = 83% lepiej

---

## 10. Scenariusze testowe: Harmonogram Gantt — 8 TC

Zależności, auto-planowanie, baseline, części produkcji, prognoza produkcji.

#### TC-GANTT-001: Interaktywny Gantt — przeciąganie, zmiana długości

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Warunki wstępne**: Projekt z 5 zadaniami, harmonogram włączony
- **Kroki**:
  1. Zadanie "Produkcja" zaplanowane na 2026-11-01 do 2026-11-15
  2. Przeciągnij na 2026-11-05 (przesuń start)
  3. Zmień długość: krótsze o 3 dni
- **Oczekiwane wyniki**:
  - Zadanie przesunięte na 2026-11-05-2026-11-17
  - Zmiany zapisane w DB
  - Auto-przesuniecie następników (jeśli ustawiono)

#### TC-GANTT-002: Zależności — cztery typy (FS, SS, FF, SF)

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Zadania: "Projekt" (2026-11-01-11-05), "Produkcja" (2026-11-06-11-20)
  2. Dodaj zależność FS (Finish-Start) z opóźnieniem 1 dzień
     - Produkcja starts = Projekt end + 1 dzień = 2026-11-07
  3. Zmień na SS (Start-Start) bez opóźnienia
     - Obie startują 2026-11-01
  4. Zmień na FF (Finish-Finish) z wyprzedzeniem -2 dni
     - Produkcja ends = Projekt end - 2 = 2026-11-03
  5. Zmień na SF (Start-Finish) — rare edge case
- **Oczekiwane wyniki**:
  - Wszystkie 4 typy obsługiwane
  - Kalkulacja dat automatyczna
  - Brak cykli (deadlock detection)

#### TC-GANTT-003: Opóźnienie i wyprzedzenie — ujemne wartości

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. FS z lag = -2 dni (overlapping start)
  2. SS z lead = -5 dni (start wcześniej, ale zależy od poprzednika)
- **Oczekiwane wyniki**:
  - Ujemne lag/lead obsługiwane (overlapping tasks)
  - Daty poprawnie wyliczone
  - Wizualizacja: połączenie pokazuje overlap

#### TC-GANTT-004: Blokada cykli — brak nieskończonych pętli

- **Priorytet**: P1 | **Poziom**: Integration
- **Kroki**:
  1. Zadania A → B → C
  2. Spróbuj dodać zależność C → A
- **Oczekiwane wyniki**:
  - System detektuje cykl
  - Komunikat: "Nie można dodać zależności — spowoduje cykl"
  - Zależność nie dodana

#### TC-GANTT-005: Auto-planowanie — przesunięcie następników

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. A (2026-11-01-11-05) → B (2026-11-06-11-10) [FS+1]
  2. Przeciągnij A na 2026-11-10
  3. Auto-planowanie ON
- **Oczekiwane wyniki**:
  - B automatycznie przesunięta na 2026-11-12
  - Łańcuch przesunięty całkowicie
  - Jeśli auto OFF: B nie zmienia się

#### TC-GANTT-006: Ręczne blokowanie zadania (pin) — override auto-planowania

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. B "przypięta" (pin) na 2026-11-06
  2. A przesunięta na 2026-11-20
  3. Auto-planowanie ON
- **Oczekywane wyniki**:
  - B nie przesuwa się (pin)
  - A i C mogą być w konflikcie lub mieć overlapping czasowy
  - Komunikat: "Zadanie B przypięte — możliwy konflikt"

#### TC-GANTT-007: Baseline i odchylenia — zaplanowane vs rzeczywiste

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Harmonogram ofertowy: A (2026-11-01-11-05), B (2026-11-06-11-10)
  2. Deal wygrany: harmonogram → wykonawczy
  3. Baseline = ofertowy
  4. Rzeczywistość: A faktycznie 2026-11-02-11-08, B 2026-11-10-11-15
  5. Raport odchyleń
- **Oczekiwane wyniki**:
  - Baseline: plan z oferty (frozen)
  - Rzeczywiste daty: edytowalne oddzielnie
  - Odchylenia: A +1 dzień (start), +3 dni (duration), B +4 dni (start)
  - Brak retroaktywnej zmiany planu

#### TC-GANTT-008: Jeden Gantt dla wielu dealów tej samej inwestycji

- **Priorytet**: P2 | **Poziom**: Integration + E2E
- **Kroki**:
  1. Inwestycja "Kompleks budowy"
  2. Deal A (Generalny wykonawca) — harmonogram ofertowy
  3. Deal B (Dostawca, element podwykonawstwa) — harmonogram own
  4. Oba powiązane z tą samą inwestycją
- **Oczekiwane wyniki**:
  - Jeden Gantt hierarchiczny: Projekt > Deal A (sekcja) + Deal B (sekcja)
  - Zależności między dealami (np. B starts po A milestone)
  - Widoczność: właściciel deala widzi swoje, Admin widzi wszystko

---

## 11. Testy wydajności

#### TC-PERF-001: Duża kalkulacja (5000 linii)

- **Priorytet**: P2 | **Poziom**: Performance
- **Kroki**:
  1. Import XLSX: 5000 linii × 10 kolumn
  2. Render siatki, scroll, obliczenia
  3. Export PDF
  4. Monit: RAM, CPU, czas
- **Budżet czasowy**: < 10s (import) + < 5s (render) + < 15s (PDF)
- **Budżet pamięci**: peak < 500 MB
- **Oczekiwane wyniki**:
  - Brak hangu, responsywne UI
  - RAM peak zanotowany

#### TC-PERF-002: Duży Gantt (kilkaset zadań)

- **Priorytet**: P2 | **Poziom**: Performance
- **Kroki**:
  1. Projekt: 300 zadań z zależnościami
  2. Render Gantta, scroll, drag-drop
  3. Kalkulacja ścieżki krytycznej
- **Budżet**: < 3s (render) + < 2s (critical path)
- **Oczekiwane wyniki**:
  - Animacje płynne
  - Brak laggów przy interakcji

#### TC-PERF-003: Równoległe żądania — concurrency

- **Priorytet**: P2 | **Poziom**: Performance + API
- **Kroki**:
  1. 10 równoczesnych żądań API (lista kalkulacji, Gantt, raport budżetu)
  2. Monit: response time, DB connections
  3. Na VPS 3.8 GiB RAM
- **Oczekiwane wyniki**:
  - Wszystkie < 500ms
  - Brak out-of-memory
  - DB pool nie wyczerpany

---

## 12. Zbiory danych testowych (Fixtures)

| Typ | Opis | Ilość |
|-----|------|-------|
| **Organizacje** | 3 firmy (A, B, C), różne konfiguracje ról i uprawnień | 3 |
| **Użytkownicy** | Admin (Firma A), Handlowiec (A), Manager (A/B), Obsługa (B), Klient (portal) | 8 |
| **Deale** | 5 dealów w różnych statusach (Nowy, Propozycja, Wygrana, Przegrana, Zamknięta) | 5 |
| **Projekty/Inwestycje** | 3 inwestycje (Hala A, Kompleks, Łącznica) z różnymi ID (e-Zamówienia, TED, BIP) | 3 |
| **Kalkulacje** | 12 kalkulacji (różne statusy, wersje, ceny, marże, jednostki) | 12 |
| **Cenniki** | 2 cenniki (domyślny, promocyjny) z regułami warstowymi | 2 |
| **XLSX/CSV testowe** | 10 plików (poprawne, złe kodowanie, brak kolumn, separator ;, duże) | 10 |
| **Harmonogramy** | 4 Gantta (ofertowy, wykonawczy, z cyklem, 300+ zadań) | 4 |
| **Koszty rzeczywiste** | 20 wpisów kosztów (verschiedne kategorie, daty, kwoty) | 20 |

---

## 13. Poziomy testów — mapowanie do narzędzi

### Unit (Jest)

- Testy arytmetyki: zaokrąglenia (TC-COST-003), dzielenie (TC-COST-004), narzuty (TC-COST-009)
- Validatory zod: schema kalkulacji, cennika, kosztu
- Helpery: parsowanie CSV, konwersje jednostek
- **Komenda**: `yarn test --testPathPattern="__tests__/.*\\.test\\.ts"`

### Integration (Jest + createTestDb)

- Powiązania deal/projekt (TC-DEAL-001 do TC-DEAL-010)
- Import/eksport XLSX/CSV (TC-IMP-001 do TC-IMP-008)
- Wersje kalkulacji (TC-VER-001 do TC-VER-006)
- Uprawnienia (TC-PERM-001 do TC-PERM-008)
- **Komenda**: `yarn test --testPathPattern="__tests__/.*\\.integration\\.test\\.ts"`

### API (Jest + Supertest)

- CRUD routes: POST /kalkulacje, PUT /kalkulacje/:id, GET /kalkulacje
- Filtrowanie multi-tenant (`organization_id`)
- Response enrichment (marża, cena)
- Error handling (400, 403, 409 concurrent edit)
- **Komenda**: `yarn test --testPathPattern="__tests__/.*\\.api\\.test\\.ts"`

### E2E/UI (Playwright)

- Interaktywne testy siatki (TC-COST-021, TC-COST-022)
- Drag-drop Gantta (TC-GANTT-001)
- Import z kreatory mapowania (TC-IMP-001)
- PDF generowanie i pobranie (TC-VER-006, TC-PERM-007)
- **Komenda**: `yarn test:integration` (discovery `.ai/qa/tests/__integration__/**/*.spec.ts`)

### Performance (Custom bash / Node.js profiling)

- Import dużych plików (TC-PERF-001)
- Render Gantta (TC-PERF-002)
- Concurrency API (TC-PERF-003)
- **Komenda**: `yarn dev:profile` + monit RAM/CPU

---

## 14. Kryteria akceptacji

### Wejścia

- [x] Wymagania biznesowe zdefiniowane (Marek)
- [x] Infrastruktura testowa dostępna (Jest, Playwright)
- [ ] Specyfikacja techniczna finalna (oczekiwanie na feedback z tego planu)

### Wyjścia / Miary sukcesu

| Kryterium | Wymaganie | Status |
|-----------|-----------|--------|
| **Pokrycie P0 scenariuszy** | 100% (TC-COST-003, TC-COST-004, TC-COST-021, TC-DEAL-004, TC-VER-002, TC-VER-003, TC-VER-006, TC-PERM-001, TC-PERM-005, TC-PERM-007) | TBD |
| **Multi-tenant izolacja** | Brak przecieków danych (TC-PERM-005) | TBD |
| **Budżety wydajności** | Import < 10s, Gantt render < 3s, API < 500ms (TC-PERF-*) | TBD |
| **Arytmetyka finansowa** | Zaokrąglenia, narzuty, marża (TC-COST-*) | TBD |
| **Integracja z dealami/projektami** | Cena → szansa (TC-DEAL-002) | TBD |
| **Obsługa XLSX/CSV** | Kodowania, separatory, walidacja (TC-IMP-*) | TBD |
| **Zamrożenie oferty po wysłaniu** | Brak edycji, snapshot PDF (TC-VER-*) | TBD |

---

## 15. Wnioski do specyfikacji (Luki i niejasności)

**Liczba wniosków**: 15

### Priorytet 1 (Musi być w spec przed kodem)

1. **Standard zaokrąglenia** (TC-COST-003, TC-COST-014)
   - Czy IEEE 754 czy bankierski (round half even)?
   - Czy sum(zaokrąglone) = zaokrąglona(sum) czy reverse?
   - **Rekomendacja**: Math.round() (IEEE 754) + test cases z konkretnymi przykładami

2. **Jednostki i konwersje** (TC-COST-007)
   - Czy są konwersje między m³/m²/szt. czy tylko ręczne?
   - Słownik jednostek: czy globalny czy per-firma?
   - **Rekomendacja**: Per-firma, brak automatycznych konwersji

3. **Definicja marży** (TC-COST-014)
   - Marża % na cenie czy na koszcie?
   - Wzór: (Cena - Koszt) / Cena czy / Koszt?
   - **Rekomendacja**: Wyświetl obydwie (% na cenie i na koszcie) z jasnym podpisem

4. **Multi-tenant mapping** (TC-PERM-005)
   - Czy `organization` (CRM) = `firma` (biznesowa) czy odrębne?
   - Czy filter `organization_id` na DB czy aplikacja?
   - **Rekomendacja**: organization = firma, filter na DB level (Awilix scoped payload)

5. **Priorytet źródeł ID inwestycji** (TC-DEAL-008)
   - Jaka kolejność: eZamówienia > TED > BIP > kod > nazwa+NIP?
   - Czy e-Zamówienia ma pewność 100% czy szansa?
   - **Rekomendacja**: Zdefiniuj ranking jasno, fallback na fallback

### Priorytet 2 (Ważne, ale można mieć domyślne)

6. **Marża po zamknięciu deala** (TC-PERM-006)
   - Global setting czy per-role?
   - Dotyczy tylko zaakceptowanej wersji czy wszystkich?
   - **Rekomendacja**: Per-role (Manager=widzi, Handlowiec=nie)

7. **Trigger harmonogramu ofertowego → wykonawczego** (TC-GANTT-008)
   - Natychmiast czy na żądanie?
   - Czy z ostrzeżeniem o zmianach?
   - **Rekomendacja**: Na żądanie (użytkownik kliknie "Zaakceptuj i utwórz harmonogram wykonawczy")

8. **Lista pól do audytu** (brak TC)
   - Każda zmiana ceny? Narzutu? Jednostki? Ilości?
   - Czy user_id + timestamp wystarczą czy więcej metadanych?
   - **Rekomendacja**: price, markup, cost, unit, quantity, status zmian + user_id + timestamp + old_value/new_value

9. **Limity rozmiaru pliku i wierszy** (TC-IMP-006, TC-PERF-001)
   - Max 5 MB? 5000 wierszy?
   - Co robić, gdy przekroczony?
   - **Rekomendacja**: 10 MB / 10k wierszy z komunikatem; splitting dla dużych plików

10. **Definicja "błędnego wiersza" w imporcie** (TC-IMP-005)
    - Brak ilości = błąd? Ujemna ilość? Null jednostka?
    - Czy skip czy abort?
    - **Rekomendacja**: Skip z logowaniem; nigdy nie abort całego importu

### Priorytet 3 (Uwagi/sugestie)

11. **Notacja narzutu** — "30% narzutu" = ×1.30 czy +0.30?
    - **Rekomendacja**: Zawsze ×(1 + narzut%), czyli 30% = ×1.30

12. **Prognoza produkcji** — jak waży prawdopodobieństwo?
    - Ilość = sum(partii) czy sum(partii × probability)?
    - **Rekomendacja**: Obie metryki: dedykowana (partii) i ważona (rzeczywista)

13. **Widoczność kosztów w API vs UI**
    - Czy API zawsze filtruje czy tylko UI?
    - **Rekomendacja**: API zawsze filtruje (backend security, nie client-side)

14. **Cena zero** — czy jest przypadkiem, czy przychód z innego źródła?
    - Czy wymagać przyczyny?
    - **Rekomendacja**: Dozwolone, opcjonalny komentarz

15. **Gotowość Sekocenbud/Intercenbud** — architektura mapowania kodów
    - Gdzie przechowywać mapping? W entity kalkulacji czy osobny cennik adapter?
    - **Rekomendacja**: Osobny moduł integrations, mapowanie per-firma

---

## 16. Podsumowanie

**Dokument**: Niezależny plan testów — spec only
**Liczba scenariuszy**: 72 (wszystkie obszary z wymagań + performance)
**Liczba wniosków do speki**: 15
**Status**: SPEC ONLY — bez kodu, bez testów wykonywalnych

**Kolejne kroki**:
1. Sprecyzować odpowiedzi na 15 wniosków w specyfikacji
2. Zatwierdzić dokument (review przez Marka + PO)
3. Przejść do fazy implementacji

---

**Koniec dokumentu**
*Data wygenerowania: 2026-10-19*

