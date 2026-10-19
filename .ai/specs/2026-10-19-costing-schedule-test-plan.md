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
| Waluty (TC-CUR) | 5 |
| Firmy bez modułu harmonogramu (TC-NOSCHED) | 4 |
| Prognoza produkcji (TC-FCST) | 6 |
| Harmonogram ofertowy → wykonawczy (TC-EXEC) | 5 |
| Bezpieczeństwo plików (TC-SEC) | 6 |
| Izolacja multi-tenant (TC-TEN) | 6 |
| Edycja równoległa (TC-CONC) | 5 |
| **Razem** | **109** |

---

## 1. Zakres i priorytety (macierz ryzyka)

### 1.1. Ryzyka biznesowe i ich mapowanie

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Błędy kalkulacji finansowej (zaokrąglenia, dzielenie przez zero) | Wysoki | Krytyczny | P0 | Kalkulacja | TC-COST-001 do TC-COST-022 |
| R2 | Wyciek danych międzytenantowych (multitenant izolacja) | Średni | Krytyczny | P0 | Uprawnienia + Tenant | TC-PERM-001 do TC-PERM-008, TC-TEN-001 do TC-TEN-006 |
| R3 | Uszkodzenie danych przy imporcie (złe kodowanie, formatowanie) | Wysoki | Wysoki | P1 | Import/eksport | TC-IMP-001 do TC-IMP-008 |
| R4 | Utrata integralności oferty po wysłaniu (zmiana ceny, marży) | Średni | Wysoki | P1 | Wersje | TC-VER-001 do TC-VER-006 |
| R5 | Niekonwersja oferty przy wygranym dealu (brak synchronizacji) | Średni | Wysoki | P1 | Harmonogram wykonawczy | TC-EXEC-001 do TC-EXEC-005 |
| R6 | Błędy harmonogramu (cykl, zależności, auto-przesunięcie) | Średni | Wysoki | P1 | Harmonogram | TC-GANTT-005 do TC-GANTT-008 |
| R7 | Duplikowanie lub gubianie inwestycji (dopasowanie) | Niski | Wysoki | P2 | Powiązania | TC-DEAL-009, TC-DEAL-010 |
| R8 | Ataki plikowe (XLSX bomb, formula injection) na VPS | Wysoki | Krytyczny | P0 | Bezpieczeństwo plików | TC-SEC-001 do TC-SEC-006 |
| R9 | Utrata danych przy równoległej edycji (race condition) | Średni | Krytyczny | P0 | Edycja równoległa | TC-CONC-001 do TC-CONC-005 |
| R10 | Błędy walutowe (kursy, zamrożenie, zaokrąglenia per waluta) | Średni | Wysoki | P1 | Waluty | TC-CUR-001 do TC-CUR-005 |
| R11 | Nieprawidłowa prognoza produkcji (suma ≠ partie, prob) | Niski | Średni | P2 | Prognoza | TC-FCST-001 do TC-FCST-006 |
| R12 | Wyciek danych przez eksport / PDF (marża, koszty) | Wysoki | Wysoki | P1 | Uprawnienia, Waluty, Tenant | TC-PERM-007, TC-TEN-004, TC-CUR-005 |

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
- **Oczekiwane wyniki**:
  - Każda linia zaokrąglana half-up do 2 miejsc dziesiętnych: 100.33, 200.34, 150.33 (tu bez zmiany)
  - Suma = 100.33 + 200.34 + 150.33 = 450.99 (suma już-zaokrąglonych linii, nie zaokrąglenie sumy surowej)
  - Tryb zaokrąglenia konfigurowalny per firma (domyślnie half-up); zmiana trybu w ustawieniach firmy przelicza na żywo
  - Różnica względem bankierskiego: 0.5 zawsze idzie w górę; test: linia = 1.005 → 1.01 (nie 1.00)

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
  - Marża kwotowa = 1000 - 600 = 400 PLN
  - Marża % = (1000 - 600) / 1000 = 40% **na cenie** (definicja: marża = % od ceny sprzedaży)
  - Narzut % (widok pomocniczy): 400 / 600 = 66.7% na koszcie — wyświetlany osobno z jasnym podpisem "Narzut"
  - Oba wyświetlone: "Marża 40% (na cenie)" i "Narzut 66.7% (na koszcie)"

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

#### TC-PERM-006: Marża po zamknięciu deala — widoczność per firma (ustawienie globalne)

- **Priorytet**: P1 | **Poziom**: Integration + UI
- **Kroki**:
  1. Deal wygrana, status = "Zaakceptowana"
  2. Admin firmy: zmień ustawienie "Widoczność marży po zamknięciu deala" na ON/OFF
  3. Zaloguj się jako Manager, Handlowiec, Obsługa
  4. Otwórz closed deal
- **Oczekiwane wyniki**:
  - Ustawienie PER FIRMA (nie per rola): gdy OFF — żadna rola nie widzi marży po zamknięciu
  - Gdy ON — wszystkie role z uprawnieniem do marży widzą ją też po zamknięciu
  - Zmiana ustawienia firmy natychmiastowo skuteczna (bez re-logowania)
  - Dotyczy tylko wersji zaakceptowanej, nie roboczych

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

## 12. Scenariusze testowe: Waluty (TC-CUR) — 5 TC

Kalkulacja jednowalutowa, kursy wymiany, zaokrąglenie per waluta, zmiana waluty deala.

#### TC-CUR-001: Waluta kalkulacji = waluta deala / domyślna firmy

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma A z domyślną walutą PLN; Deal X z walutą EUR
- **Kroki**:
  1. Stwórz kalkulację bez podpięcia do deala → waluta = PLN (domyślna firmy)
  2. Podepnij do Deal X (EUR) → waluta kalkulacji zmienia się na EUR
  3. Odepnij od deala → waluta wraca do PLN (domyślna firmy)
- **Oczekiwane wyniki**:
  - Kalkulacja jednowalutowa: dokładnie jedna waluta aktywna w danym momencie
  - Zmiana waluty po podpięciu: komunikat "Waluta zostanie zmieniona z PLN na EUR. Przelicz wartości czy zachowaj liczby?" z wyborem
  - Brak mieszanych walut w liniach jednej kalkulacji

#### TC-CUR-002: Kurs wymiany — źródło, data kursu, zamrożenie w wysłanej wersji

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Kalkulacja w EUR, kurs EUR/PLN = 4.25 na dzień T
- **Kroki**:
  1. Robocza wersja: kurs EUR/PLN z dnia T = 4.25; wartość pozycji 1000 EUR = 4250 PLN
  2. Wyślij wersję (status "Wysłana")
  3. Następnego dnia kurs zmienia się na 4.30
  4. Otwórz wysłaną wersję
- **Oczekiwane wyniki**:
  - Wysłana wersja zachowuje kurs 4.25 (snapshot z dnia wysłania)
  - Nowa robocza kopia pokaże kurs 4.30 (aktualny)
  - Metadane kursu: źródło, data pobrania, wartość — widoczne per wersja
  - PDF oferty zawiera kurs z daty wysłania

#### TC-CUR-003: Zaokrąglenie per waluta — JPY (0 miejsc), PLN (2 miejsca)

- **Priorytet**: P1 | **Poziom**: Unit
- **Warunki wstępne**: Firma z dwoma aktywnymi walutami (PLN, JPY)
- **Kroki**:
  1. Kalkulacja JPY: linia 1 = 1005.4 JPY, linia 2 = 2003.6 JPY
  2. Oczekiwane zaokrąglenia half-up per linia: 1005, 2004
  3. Suma = 1005 + 2004 = 3009 JPY (0 miejsc)
  4. Kalkulacja PLN: linia 1 = 100.345 PLN → 100.35; linia 2 = 200.344 → 200.34
  5. Suma = 100.35 + 200.34 = 300.69 PLN
- **Oczekiwane wyniki**:
  - JPY: 0 miejsc po przecinku (ISO 4217 standard)
  - PLN: 2 miejsca po przecinku
  - Konfiguracja per waluta: admin może nadpisać domyślne miejsca dziesiętne (np. BTC → 8)
  - Eksport i PDF respektują precyzję waluty

#### TC-CUR-004: Zmiana waluty deala po podpięciu — ostrzeżenie i przeprzeliczenie

- **Priorytet**: P1 | **Poziom**: Integration + E2E
- **Warunki wstępne**: Kalkulacja z 5 liniami (EUR), podpięta do Deal X
- **Kroki**:
  1. Zmień walutę Deal X z EUR na USD
  2. System wykrywa niezgodność walut (kalkulacja EUR, deal USD)
  3. Wybierz: "Przelicz po kursie" lub "Zachowaj liczby w nowej walucie"
  4. Zapisz
- **Oczekiwane wyniki**:
  - Opcja A (przelicz): każda linia = wartość_EUR × kurs_EUR/USD; kurs z dnia zmiany zapamiętany
  - Opcja B (zachowaj liczby): wartości numeryczne bez zmian, tylko symbol waluty się zmienia
  - Audit trail: zmiana waluty + wybrana metoda + kurs (jeśli A)
  - Wersje robocze i wysłane traktowane różnie: wysłane nie mogą być zmienione

#### TC-CUR-005: Eksport i PDF w walucie oferty

- **Priorytet**: P1 | **Poziom**: E2E/UI
- **Warunki wstępne**: Kalkulacja EUR, wysłana wersja
- **Kroki**:
  1. Eksportuj do XLSX
  2. Wygeneruj PDF
  3. Sprawdź nagłówki kolumn, symbole walut, precyzję
- **Oczekiwane wyniki**:
  - XLSX: kolumna "Wartość (EUR)" — wszystkie kwoty w EUR z 2 miejscami
  - PDF: symbol waluty spójny w całym dokumencie (nie mieszaj PLN/EUR)
  - Kurs użyty do wysłania: widoczny w stopce PDF ("Kurs: 1 EUR = 4.25 PLN na dzień 2026-10-15")
  - Eksport przez użytkownika bez uprawnień do marży: kolumna marży pominięta

---

## 13. Scenariusze testowe: Firmy BEZ modułu harmonogramu (TC-NOSCHED) — 4 TC

Kalkulacja, partie, prognoza działają; brak Ganttu; włączanie/wyłączanie modułu.

#### TC-NOSCHED-001: Kalkulacja + partie/daty bez modułu harmonogramu

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma B z wyłączonym modułem harmonogramu
- **Kroki**:
  1. Firma B: w ustawieniach "Moduł harmonogramu" = OFF
  2. Otwórz kalkulator w Firmie B
  3. Dodaj pozycje z datą produkcji i datą dostawy bezpośrednio w liniach kalkulacji
  4. Dodaj partie: element "Słup SB-01", ilość 10 szt., data produkcji 2026-11-15, data dostawy 2026-11-30
  5. Zapisz
- **Oczekiwane wyniki**:
  - Linie kalkulacji mają pola "Data produkcji" i "Data dostawy" — działają normalnie
  - Partie produkcji widoczne i edytowalne w kalkulacji
  - Prognoza produkcji działa (z tych dat, bez Ganttu)
  - Brak zakładki "Harmonogram Gantt" w nawigacji
  - Brak endpointów `/schedule/gantt` (404) dla Firmy B

#### TC-NOSCHED-002: Brak endpointów i UI harmonogramu

- **Priorytet**: P0 | **Poziom**: API + E2E
- **Warunki wstępne**: Firma B (harmonogram OFF), zalogowany użytkownik Firmy B
- **Kroki**:
  1. GET `/api/v1/schedule/gantt?deal_id=X` (deal Firmy B)
  2. GET `/api/v1/schedule/tasks?deal_id=X`
  3. Sprawdź UI: menu boczne, zakładki na dealu, zakładki na kalkulacji
- **Oczekiwane wyniki**:
  - API: 404 lub 403 z komunikatem "Moduł harmonogramu niedostępny dla tej organizacji"
  - UI: brak zakładki "Harmonogram" w menu i na stronach deal/projekt
  - Widget Gantta nie ładowany (brak importu JS)
  - Użytkownik Firmy A (z harmonogramem) wywołując te same endpointy dla SWOJEGO deala → 200 OK

#### TC-NOSCHED-003: Import harmonogramu z XLSX bez modułu Gantta

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma B (harmonogram OFF), plik XLSX z kolumnami Zadanie|Start|Koniec|Ilość
- **Kroki**:
  1. Import XLSX harmonogramu do kalkulacji (bez Ganttu)
  2. Mapuj kolumny: Zadanie → Nazwa, Start → Data produkcji, Koniec → Data dostawy
  3. Import 20 wierszy
- **Oczekiwane wyniki**:
  - 20 partii/zadań zaimportowanych jako wiersze kalkulacji z datami
  - Prognoza produkcji odzwierciedla daty z importu
  - Brak próby tworzenia Gantta (żadnych rekordów w tabelach harmonogramu)

#### TC-NOSCHED-004: Włączenie modułu harmonogramu w trakcie — migracja danych

- **Priorytet**: P2 | **Poziom**: Integration + E2E
- **Warunki wstępne**: Firma B (moduł OFF) z 10 kalkulacjami z datami/partiami
- **Kroki**:
  1. Admin Firmy B: ustawienia → "Moduł harmonogramu" = ON
  2. Odśwież aplikację
  3. Sprawdź: czy istniejące daty/partie są widoczne w nowym Ganttcie?
  4. Odwróć: "Moduł harmonogramu" = OFF ponownie
- **Oczekiwane wyniki**:
  - Włączenie: zakładka Gantt pojawia się; istniejące partie mogą być opcjonalnie zmigrowne do zadań Ganttu (lub pozostają jako daty w kalkulacji)
  - Wyłączenie: Gantt znika z UI; dane harmonogramu zachowane w DB (nie kasowane); partie/daty w kalkulacji nadal widoczne
  - Brak utraty danych przy obu operacjach

---

## 14. Scenariusze testowe: Prognoza produkcji (TC-FCST) — 6 TC

Horyzont 6 miesięcy, tygodnie/miesiące, ważenie prawdopodobieństwem, partie, zmiana oferty.

#### TC-FCST-001: Prognoza z Ganttem — tygodnie i miesiące

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma A z modułem harmonogramu; deal z Ganttem; kilkanaście partii produkcji
- **Kroki**:
  1. Partie: Słup SB-01 × 10 szt. (2026-11-05), Strop ST-02 × 5 m³ (2026-11-20), Ściana SC-03 × 3 m³ (2027-01-10)
  2. Otwórz prognozę: tryb "miesiące"
  3. Przełącz na tryb "tygodnie"
- **Oczekiwane wyniki**:
  - Tryb miesiące: Listopad=15 szt. + 5 m³, Grudzień=brak, Styczeń=3 m³
  - Tryb tygodnie: Tydzień 45 (Słup SB-01), Tydzień 47 (Strop), Tydzień 2/2027 (Ściana)
  - Suma tygodni listopad = suma miesiąca listopad (konsolidacja spójna)
  - Partie powiązane z zadaniami Ganttu — zmiana daty w Ganttcie automatycznie aktualizuje prognozę

#### TC-FCST-002: Prognoza bez Ganttu — daty z kalkulacji

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma B (harmonogram OFF); partie z datami w liniach kalkulacji
- **Kroki**:
  1. Kalkulacja z partiami: Element A (2026-11-01, 10 szt.), Element B (2026-12-15, 5 m³)
  2. Otwórz prognozę produkcji
- **Oczekiwane wyniki**:
  - Prognoza działa bez Ganttu — agreguje z dat bezpośrednio w partiach
  - Listopad: 10 szt. Element A; Grudzień: 5 m³ Element B
  - Brak zakładki Gantt, ale zakładka Prognoza widoczna

#### TC-FCST-003: Jednostki w prognozie — m³ i szt. oddzielnie

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Partie: 10 szt. Słup, 3 m³ Strop, 2 szt. Belka
- **Kroki**:
  1. Prognoza listopad
- **Oczekiwane wyniki**:
  - Wyświetlenie per jednostka: "12 szt. | 3 m³" (nie sumy różnych jednostek)
  - Ewentualnie osobne kolumny per jednostka miary
  - Brak sumowania m³ + szt. (niezgodne jednostki)

#### TC-FCST-004: Ważenie prawdopodobieństwem deala

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Deal X (prawdopodobieństwo 60%), Deal Y (100%), Deal Z (0%)
- **Kroki**:
  1. Deal X: 10 szt. w listopadzie → ważone = 6 szt.
  2. Deal Y: 5 szt. w listopadzie → ważone = 5 szt.
  3. Deal Z: 20 szt. w listopadzie → ważone = 0 szt.
  4. Zmień prawdopodobieństwo Deal X na 80%
  5. Prognoza ponownie
- **Oczekiwane wyniki**:
  - Prognoza "niezważona" (surowa): 10 + 5 + 20 = 35 szt.
  - Prognoza "ważona": 6 + 5 + 0 = 11 szt.
  - Obie dostępne (dwa widoki lub przełącznik)
  - Po zmianie prob Deal X na 80%: ważona = 8 + 5 + 0 = 13 szt. (natychmiastowa aktualizacja)
  - Deal Z (0%): nie pojawia się w prognozie ważonej (filtrowany)

#### TC-FCST-005: Partie przekraczające horyzont 6 miesięcy

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Prognoza z horyzontem 6 mies. (2026-11 do 2027-04); partie: Element D data 2027-05-01 (poza horyzontem)
- **Kroki**:
  1. Otwórz prognozę
  2. Rozszerz horyzont na 12 mies.
  3. Powróć do 6 mies.
- **Oczekiwane wyniki**:
  - Partie poza horyzontem: widoczne w sekcji "Po horyzoncie" lub po rozszerzeniu widoku
  - Suma partii w horyzoncie ≠ suma wszystkich partii (jeśli są poza horyzontem)
  - UI: informacja "X partii poza horyzontem (suma: Y szt.)"
  - Nie ukrywaj cicho — użytkownik widzi, że coś jest pominięte

#### TC-FCST-006: Suma okresów = suma partii; zmiana oferty głównej

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja z dwoma dealami; Deal A = oferta główna; Deal B = alternatywna
- **Kroki**:
  1. Deal A: 15 szt. łącznie (rozłożone: 5/4/6 na listopad/grudzień/styczeń)
  2. Prognoza: suma okresów = 5 + 4 + 6 = 15 ✓
  3. Zmień ofertę główną na Deal B (10 szt. w różnych miesiącach)
  4. Prognoza po zmianie
- **Oczekiwane wyniki**:
  - Suma tygodni/miesięcy = całkowita ilość partii w danym dealu (invariant zawsze spełniony)
  - Po zmianie oferty głównej: prognoza inwestycji opiera się na Deal B (oferta główna)
  - Deal A: nie znika, ale oznaczony jako "Alternatywna" w prognozie zbiorczej
  - Zmiana oferty głównej jest audytowana

---

## 15. Scenariusze testowe: Harmonogram ofertowy → wykonawczy (TC-EXEC) — 5 TC

Automatyczne tworzenie, idempotentność, ponowne otwarcie, deal bez harmonogramu, wiele dealów.

#### TC-EXEC-001: Automatyczne tworzenie harmonogramu wykonawczego przy wygraniu deala

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Deal X ze statusem "Propozycja"; harmonogram ofertowy z 5 zadaniami
- **Kroki**:
  1. Zmień status Deal X → "Wygrana" (lub zdarzenie `deal.won`)
  2. Sprawdź harmonogram
- **Oczekiwane wyniki**:
  - Harmonogram wykonawczy tworzony AUTOMATYCZNIE (bez klikania użytkownika)
  - Nowy harmonogram: typ = "execution", powiązany z deal_id i versją ofertową
  - Baseline = kopia dat z harmonogramu ofertowego (zamrożony punkt odniesienia)
  - Daty planowane = daty wykonawcze (edytowalne przez kierownika projektu)
  - Daty bazowe ≠ zmieniają się automatycznie (baseline frozen)
  - Użytkownik widzi notyfikację "Harmonogram wykonawczy utworzony"

#### TC-EXEC-002: Idempotentność — podwójne zdarzenie won

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Deal X, harmonogram wykonawczy już istnieje (po pierwszym wygraniu)
- **Kroki**:
  1. Wyemituj zdarzenie `deal.won` ponownie (np. system retry, błąd integracji, podwójny klik)
  2. Sprawdź liczbę harmonogramów wykonawczych dla Deal X
- **Oczekiwane wyniki**:
  - Tylko jeden harmonogram wykonawczy (constraint unikowy na deal_id + typ)
  - Drugie zdarzenie: no-op z logiem ostrzegawczym "execution schedule already exists for deal X"
  - Brak duplikatów baseline, zadań, kamieni milowych
  - Stan harmonogramu po podwójnym zdarzeniu = identyczny jak po pierwszym

#### TC-EXEC-003: Deal ponownie otwarty i ponownie wygrany

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Deal X wygrany → harmonogram wykonawczy (wer. 1) istnieje; deal cofnięty do "Otwarta"
- **Kroki**:
  1. Zmień status Deal X → "Otwarta" (cofnięcie wygrania)
  2. Sprawdź harmonogram: czy usunięty?
  3. Zmień deal ponownie → "Wygrana"
  4. Sprawdź harmonogram: czy nowy, czy stary?
- **Oczekiwane wyniki**:
  - Cofnięcie wygrania: harmonogram wykonawczy ZACHOWANY jako historia (nie kasowany); oznaczony jako "zawieszony" lub "historyczny"
  - Ponowne wygranie: tworzy NOWĄ wersję harmonogramu wykonawczego (ver. 2) z nowym baselinetem
  - Stary (ver. 1) dostępny w historii wersji
  - Audit trail: wygranie 1 → cofnięcie → wygranie 2

#### TC-EXEC-004: Deal bez harmonogramu ofertowego — wygranie

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Deal Y bez harmonogramu ofertowego (tylko kalkulacja); wygranie
- **Kroki**:
  1. Deal Y: status "Propozycja", brak Ganttu ofertowego
  2. Zmień status → "Wygrana"
  3. Sprawdź harmonogram
- **Oczekiwane wyniki**:
  - System nie tworzy harmonogramu wykonawczego (brak danych źródłowych)
  - LUB: tworzy pusty harmonogram wykonawczy z komunikatem "Harmonogram ofertowy nie istniał — utwórz ręcznie"
  - Notyfikacja dla użytkownika: "Deal wygrany, brak harmonogramu ofertowego — warto dodać harmonogram"
  - Deal wygrywa normalnie (brak blokady)

#### TC-EXEC-005: Wiele dealów tej samej inwestycji — wygranie jednego

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja I1: Deal A (oferta główna), Deal B (alternatywna); oба mają harmonogramy ofertowe
- **Kroki**:
  1. Deal A wygrywa (status → "Wygrana")
  2. Sprawdź harmonogramy
  3. Deal B: co się dzieje?
- **Oczekiwane wyniki**:
  - Deal A: harmonogram wykonawczy tworzony automatycznie
  - Deal B: harmonogram ofertowy ZACHOWANY bez zmian (nie tworzony wykonawczy)
  - Inwestycja I1: Gantt zbiorczy pokazuje harmonogram wykonawczy Deal A + ofertowy Deal B (opcjonalnie)
  - Deal B pozostaje "alternatywna" — brak automatycznych zmian

---

## 16. Scenariusze testowe: Bezpieczeństwo plików (TC-SEC) — 6 TC

XLSX/zip bomb, ogromne arkusze, formula injection, makra, MIME spoofing, timeouty.

#### TC-SEC-001: XLSX bomb / zip bomb — wysoki współczynnik kompresji

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: VPS 3.8 GiB RAM; plik XLSX (zip bomb) o rozmiarze 100 kB skompresowanym, >500 MB po rozwinięciu
- **Kroki**:
  1. Prześlij plik przez endpoint importu
  2. Monit: RAM, czas odpowiedzi
- **Oczekiwane wyniki**:
  - Odrzucenie PRZED pełnym rozpakowaniem (sprawdzenie proporcji zip: compressed/uncompressed ratio)
  - Limit: jeśli uncompressed > X MB (np. 200 MB), odrzuć z kodem 413 i komunikatem "Plik zbyt duży po rozpakowaniu"
  - RAM VPS nie przekracza 80% (3 GiB)
  - Timeout: max 30s dla całego procesu importu
  - Brak crash serwera; inne żądania obsługiwane normalnie

#### TC-SEC-002: Ogromne arkusze — miliony komórek, tysiące kolumn

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: XLSX z 1 000 000 wierszy × 10 kolumn; XLSX z 100 wierszy × 5000 kolumn
- **Kroki**:
  1. Import pliku 1M wierszy
  2. Import pliku 5000 kolumn
  3. Monit: RAM, CPU, czas
- **Oczekiwane wyniki**:
  - 1M wierszy: odrzucenie z komunikatem "Przekroczono limit 100k wierszy" (lub skonfigurowany limit)
  - 5000 kolumn: odrzucenie "Zbyt wiele kolumn (max 500)"
  - Streaming/chunked parsing — nie ładuj całego pliku do pamięci naraz
  - Odpowiedź w < 5s (szybkie odrzucenie, nie pełny parsing)

#### TC-SEC-003: Formula injection w eksporcie — CSV i XLSX

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Kalkulacja z pozycją nazwaną `=CMD|'/c calc'!A1` lub `+1+1`
- **Kroki**:
  1. Zapisz pozycję z nazwą `=1+1`, `@SUM(1,2)`, `-2+3*4`, `+CMD` itp.
  2. Eksportuj do CSV
  3. Eksportuj do XLSX
  4. Otwórz w Excelu
- **Oczekiwane wyniki**:
  - CSV eksport: wartości zaczynające się od `=`, `+`, `-`, `@` są poprzedzone apostrofem lub cudzysłowem: `'=1+1`
  - XLSX eksport: komórki ustawione jako Text (nie Formula), Excel nie interpretuje jako formuły
  - Zewnętrzne linki w formulach (`=IMPORTRANGE(...)`) — zawsze zablokowane
  - Test w Excelu: otwarcie pliku bez ostrzeżeń o potencjalnie niebezpiecznych formułach

#### TC-SEC-004: Makra (.xlsm) i zły MIME / rozszerzenie

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Plik z rozszerzeniem .xlsm (z makrami); plik .xlsx ale z MIME text/plain; plik .csv z MIME application/octet-stream
- **Kroki**:
  1. Import pliku .xlsm
  2. Import .xlsx z MIME text/html (fałszywy MIME)
  3. Import .csv z rozszerzeniem .xls (mismatch)
- **Oczekiwane wyniki**:
  - .xlsm: odrzucony (422) z komunikatem "Pliki z makrami (.xlsm) nie są obsługiwane"
  - Fałszywy MIME: walidacja po rzeczywistej sygnaturze pliku (magic bytes), nie tylko po MIME headerze
  - Mismatch rozszerzenie/content: ostrzeżenie lub odrzucenie; nie przetwarzaj blindly
  - Brak wykonania makr pod żadnym warunkiem

#### TC-SEC-005: Timeouty i limity pamięci na małym VPS

- **Priorytet**: P0 | **Poziom**: Performance + Integration
- **Warunki wstępne**: VPS 3.8 GiB RAM; 3 równoczesne importy dużych plików
- **Kroki**:
  1. Przesyłaj 3 pliki ~5 MB jednocześnie od różnych użytkowników
  2. Monit: RAM całego procesu Node.js, czas odpowiedzi na każde żądanie
  3. Przesyłaj 1 plik 50 MB (graniczna porcja)
- **Oczekiwane wyniki**:
  - 3 importy równoczesne: każdy < 30s; RAM peak < 1 GB (dla importu)
  - Plik 50 MB: odrzucony przed parsowaniem (rozmiar skompresowany > limit)
  - Brak OOM (Out of Memory) — watchdog lub limit pamięci na poziomie procesu
  - Po odrzuceniu/timeoucie: zasoby zwolnione, GC zakończony; kolejne żądania normalne

#### TC-SEC-006: Zewnętrzne linki i SSRF w formulach arkusza

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: XLSX z formulami `=WEBSERVICE("http://internal-api/secret")`, `=IMPORTDATA(...)`, linkami do plików sieciowych
- **Kroki**:
  1. Import XLSX zawierającego formuły z zewnętrznymi referencjami
  2. Monit: czy serwer wykonuje jakiekolwiek żądania HTTP podczas parsowania
- **Oczekiwane wyniki**:
  - Parser arkuszy traktuje formuły jako tekst (wartości statyczne), nie oblicza ich
  - Zero wychodzących żądań HTTP z serwera podczas importu
  - Wartości z komórek: zapamiętana wartość obliczona (cached value z XLSX), nie re-evaluation
  - Logi: brak zewnętrznych połączeń; jeśli parser wymaga sieci — blokada na poziomie OS/firewall

---

## 17. Scenariusze testowe: Izolacja multi-tenant (TC-TEN) — 6 TC

API cross-tenant, wyszukiwanie inwestycji, eksport, PDF, webhooki, cenniki cross-deal.

#### TC-TEN-001: API — cudze ID kalkulacji w ścieżce → 404

- **Priorytet**: P0 | **Poziom**: API
- **Warunki wstępne**: Firma A (organizacja A), Firma B (organizacja B); kalkulacja `calc-B-123` należy do Firmy B
- **Kroki**:
  1. Zaloguj się jako użytkownik Firmy A
  2. GET `/api/v1/costing/calculations/calc-B-123`
  3. PUT `/api/v1/costing/calculations/calc-B-123` z ciałem kalkulacji
  4. DELETE `/api/v1/costing/calculations/calc-B-123`
- **Oczekiwane wyniki**:
  - GET, PUT, DELETE: 404 (nie ujawniać, że zasób istnieje pod inną organizacją)
  - Brak 403 (to ujawniłoby istnienie zasobu) — konsekwentnie 404
  - Logi serwera: wpis "cross-tenant access attempt: user org_A, resource org_B"
  - Test odporny na enumeration: sekwencyjne UUIDs nie ujawniają ID innych firm

#### TC-TEN-002: Cudze ID w ciele żądania POST/PUT

- **Priorytet**: P0 | **Poziom**: API
- **Warunki wstępne**: Jak wyżej; deal `deal-B-456` należy do Firmy B
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. POST `/api/v1/costing/calculations` z body `{"deal_id": "deal-B-456", "name": "Atak"}`
  3. PUT `/api/v1/costing/calculations/calc-A-789` z body `{"organization_id": "org-B"}` (próba zmiany właściciela)
- **Oczekiwane wyniki**:
  - POST z obcym deal_id: 404 lub 422 "Deal not found" (deal z org B nie widoczny dla org A)
  - PUT próba zmiany organization_id: pole ignorowane lub 422 "Cannot change organization"
  - `organization_id` zawsze pochodzi z tokenu sesji, nie z body — nadpisanie niemożliwe

#### TC-TEN-003: Wyszukiwanie i dopasowanie inwestycji — izolacja cross-tenant

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja "Hala A" istnieje w Firmie A i w Firmie B (przypadkowa zbieżność nazwy)
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. Wyszukaj inwestycje: `GET /api/v1/projects?q=Hala`
  3. Podpięcie identyfikatora e-Zamówienia współdzielonego przez obie firmy
- **Oczekiwane wyniki**:
  - Wyniki wyszukiwania: tylko inwestycje Firmy A (zero z Firmy B — mimo zbieżności nazwy)
  - Dopasowanie po e-Zamówienia ID: wynik zawiera tylko inwestycję Firmy A
  - Brak "podpowiedzi" z danych innej firmy

#### TC-TEN-004: Eksport i PDF — tylko własne dane organizacji

- **Priorytet**: P0 | **Poziom**: E2E/UI + API
- **Warunki wstępne**: Firma A z 5 kalkulacjami; Firma B z 3 kalkulacjami
- **Kroki**:
  1. Zaloguj jako użytkownik Firmy A
  2. Eksport XLSX "Wszystkie kalkulacje"
  3. Wygeneruj PDF dla każdego dostępnego zasobu
  4. Eksport listy dealów
- **Oczekiwane wyniki**:
  - XLSX: zawiera dokładnie 5 kalkulacji Firmy A (żadnych z Firmy B)
  - PDF: nagłówek z danymi Firmy A; brak danych Firmy B
  - Brak możliwości "wylistowania" ID z innej organizacji przez masowy eksport

#### TC-TEN-005: Zdarzenia i webhooki — cross-tenant nie emitowane

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Firma A z subskrypcją na webhooki; zdarzenie pochodzi z kalkulacji Firmy B
- **Kroki**:
  1. Firma A: zarejestruj webhook na `calculation.updated`
  2. Użytkownik Firmy B aktualizuje swoją kalkulację
  3. Sprawdź webhooki odebrane przez Firmę A
- **Oczekiwane wyniki**:
  - Firma A nie otrzymuje webhooka z zdarzenia Firmy B
  - Payload webhooka zawiera `organization_id` — zawsze zgodny z organizacją subskrybenta
  - Wewnętrzny bus zdarzeń: zdarzenia scopowane per organizacja; brak "broadcast" cross-tenant

#### TC-TEN-006: ID z tej samej organizacji vs różnego tenanta

- **Priorytet**: P0 | **Poziom**: API
- **Warunki wstępne**: Multi-tenant setup: Tenant T1 (Firma A, Firma B) i Tenant T2 (Firma C). Firm A i B dzielą tenanta T1.
- **Kroki**:
  1. Użytkownik Firmy A (Tenant T1): próba dostępu do cennika Firmy B (też T1) przez API
  2. Użytkownik Firmy A (Tenant T1): próba dostępu do zasobu Firmy C (Tenant T2)
- **Oczekiwane wyniki**:
  - Firma B (ten sam tenant, inna organizacja): 404 — izolacja per organization, nie tylko per tenant
  - Firma C (inny tenant): 404 lub 401 — silniejsza izolacja
  - Cenniki: per organizacja (Firma A nie widzi cennika Firmy B nawet przy wspólnym tenancie)
  - Harmonogram cross-deal z innej organizacji: niedostępny

---

## 18. Scenariusze testowe: Edycja równoległa (TC-CONC) — 5 TC

Optimistic locking, wyścig zamrożenia wersji, równoległe zmiany oferty głównej, import.

#### TC-CONC-001: Dwóch użytkowników edytuje tę samą kalkulację jednocześnie

- **Priorytet**: P0 | **Poziom**: Integration + E2E
- **Warunki wstępne**: Kalkulacja K1 z wersją updatedAt=T0; zalogowani Użytkownik A i Użytkownik B
- **Kroki**:
  1. Użytkownik A otwiera K1 (widzi K1 @ T0)
  2. Użytkownik B otwiera K1 (widzi K1 @ T0)
  3. Użytkownik A zmienia Pozycja P1: cena 100 → 200, zapisuje (K1 @ T1)
  4. Użytkownik B (nadal z K1 @ T0) zmienia Pozycja P2: ilość 5 → 10, próbuje zapisać
- **Oczekiwane wyniki**:
  - Krok 3: Użytkownik A → 200 OK; K1.updatedAt = T1
  - Krok 4: Użytkownik B → 409 Conflict z komunikatem "Kalkulacja została zmodyfikowana przez innego użytkownika. Odśwież i spróbuj ponownie."
  - Brak cichego nadpisania zmian Użytkownika A
  - K1 po konflikcie: zawiera zmiany Użytkownika A (P1 = 200), P2 = 5 (niezmienione)
  - Użytkownik B widzi odświeżony formularz z aktualnym stanem i może ponowić edycję

#### TC-CONC-002: Optimistic locking — konflikt → 409 + szczegółowy komunikat

- **Priorytet**: P0 | **Poziom**: API
- **Warunki wstępne**: Kalkulacja K2 z updatedAt=T0
- **Kroki**:
  1. GET `/api/v1/costing/calculations/K2` → odpowiedź zawiera `updatedAt: T0`
  2. PUT `/api/v1/costing/calculations/K2` z nagłówkiem `If-Unmodified-Since: T0` i zmienionymi danymi
  3. Niezależnie: inny klient zapisuje K2 (updatedAt→T1)
  4. PUT z `If-Unmodified-Since: T0` ponownie
- **Oczekiwane wyniki**:
  - Krok 2 (przed zmianą przez inny klient): 200 OK
  - Krok 4 (po zmianie): 409 Conflict z body `{"error": "conflict", "currentUpdatedAt": "T1"}`
  - Brak utraty danych: rekord zawiera ostatnią poprawną wersję
  - Klient może: odczytać aktualny stan (GET), scalić i ponowić PUT z nowym `If-Unmodified-Since: T1`

#### TC-CONC-003: Wyścig zamrożenia wersji — wysłanie podczas edycji

- **Priorytet**: P0 | **Poziom**: Integration
- **Warunki wstępne**: Wersja V1.0 w stanie "Robocza"; Użytkownik A edytuje, Użytkownik B wysyła
- **Kroki**:
  1. Użytkownik A otwiera V1.0 (Robocza)
  2. Użytkownik B klika "Wyślij" na V1.0 → status zmienia się na "Wysłana", V1.0 zamrożona
  3. Użytkownik A (nie wiedząc o zmianie) zmienia cenę i klika "Zapisz"
- **Oczekiwane wyniki**:
  - Krok 3: 409 Conflict lub 422 "Wersja jest już wysłana i nie może być edytowana"
  - Brak nadpisania zamrożonej wersji
  - Użytkownik A widzi komunikat: "Wersja V1.0 została wysłana przez innego użytkownika. Utwórz nową wersję, aby kontynuować."
  - Opcja "Duplikuj jako V1.1" dostępna od razu w komunikacie błędu

#### TC-CONC-004: Równoległe przełączanie oferty głównej

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Inwestycja I1; aktualnie oferta główna = Deal A; Użytkownik A i Użytkownik B jednocześnie próbują zmienić ofertę główną
- **Kroki**:
  1. Użytkownik A: zmienia ofertę główną na Deal B (PUT `/api/v1/projects/I1/primary-deal`, body `{dealId: "B"}`)
  2. Użytkownik B: jednocześnie zmienia na Deal C (PUT `.../primary-deal`, body `{dealId: "C"}`)
  3. Oba żądania docierają do serwera prawie jednocześnie
- **Oczekiwane wyniki**:
  - Jedno żądanie wygrywa (serialized): inwestycja ma jedną ofertę główną
  - Drugie żądanie: 409 Conflict lub wymusza potwierdzenie ("Oferta główna właśnie zmieniona na B. Nadpisać na C?")
  - Brak stanu inconsistentnego: nigdy dwie oferty główne jednocześnie
  - Audit trail: dwa wpisy (zmiana A→B, i opcjonalne B→C)

#### TC-CONC-005: Równoległy import XLSX — dwa importy tej samej kalkulacji

- **Priorytet**: P1 | **Poziom**: Integration
- **Warunki wstępne**: Kalkulacja K3 (Robocza); Użytkownik A i B importują różne XLSX do tej samej kalkulacji jednocześnie
- **Kroki**:
  1. Użytkownik A importuje Plik A (10 wierszy) do K3
  2. Użytkownik B importuje Plik B (8 wierszy) do K3 jednocześnie
  3. Oba importy kończą się
- **Oczekiwane wyniki**:
  - Brak interleaving danych (wiersze z Pliku A i B nie przeplatają się losowo)
  - Jeden import blokuje drugi (mutex/lock na czas importu) LUB import drugi dostaje 409 "Import w toku"
  - Finalny stan K3: spójny (wszystkie wiersze jednego importu, nie mix)
  - Komunikat dla drugiego użytkownika: "Import kalkulacji jest już w toku. Spróbuj za chwilę."

---

## 19. Zbiory danych testowych (Fixtures)

| Typ | Opis | Ilość |
|-----|------|-------|
| **Organizacje** | 3 firmy (A, B, C), różne konfiguracje ról, uprawnień, walut, modułów | 3 |
| **Użytkownicy** | Admin (Firma A), Handlowiec (A), Manager (A/B), Obsługa (B), Klient (portal) | 8 |
| **Deale** | 5 dealów w różnych statusach (Nowy, Propozycja, Wygrana, Przegrana, Zamknięta) | 5 |
| **Projekty/Inwestycje** | 3 inwestycje (Hala A, Kompleks, Łącznica) z różnymi ID (e-Zamówienia, TED, BIP) | 3 |
| **Kalkulacje** | 12 kalkulacji (różne statusy, wersje, ceny, marże, jednostki, waluty) | 12 |
| **Cenniki** | 2 cenniki (domyślny, promocyjny) z regułami warstowymi | 2 |
| **XLSX/CSV testowe** | 15 plików (poprawne, złe kodowanie, brak kolumn, separator ;, duże, XLSX bomb, formula injection, .xlsm) | 15 |
| **Harmonogramy** | 4 Gantta (ofertowy, wykonawczy, z cyklem, 300+ zadań) + 2 harmonogramy XLSX (dla Firm bez modułu) | 6 |
| **Koszty rzeczywiste** | 20 wpisów kosztów (verschiedne kategorie, daty, kwoty) | 20 |
| **Kursy walut** | Kursy historyczne EUR/PLN, USD/PLN, JPY/PLN dla testów zamrożenia kursu | 10 rekordów |
| **Partie produkcji** | 30 partii dla testu prognozy (różne jednostki, daty, prawdopodobieństwa) | 30 |
| **Zdarzenia deal.won** | Duplikaty i sekwencje dla testu idempotentności | 5 zdarzeń |

---

## 20. Poziomy testów — mapowanie do narzędzi

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

## 21. Kryteria akceptacji

### Wejścia

- [x] Wymagania biznesowe zdefiniowane (Marek)
- [x] Infrastruktura testowa dostępna (Jest, Playwright)
- [ ] Specyfikacja techniczna finalna (oczekiwanie na feedback z tego planu)

### Wyjścia / Miary sukcesu

| Kryterium | Wymaganie | Status |
|-----------|-----------|--------|
| **Pokrycie P0 scenariuszy** | 100% (TC-COST-003, TC-COST-004, TC-COST-021, TC-DEAL-004, TC-VER-002, TC-VER-003, TC-VER-006, TC-PERM-001, TC-PERM-005, TC-PERM-007, TC-SEC-001, TC-SEC-002, TC-SEC-003, TC-CONC-001, TC-CONC-002, TC-CONC-003, TC-TEN-001, TC-TEN-002, TC-TEN-003, TC-TEN-004, TC-EXEC-001, TC-EXEC-002, TC-FCST-006, TC-NOSCHED-002) | TBD |
| **Multi-tenant izolacja** | Brak przecieków danych przez API, eksport, PDF, webhooki (TC-PERM-005, TC-TEN-001 do TC-TEN-006) | TBD |
| **Budżety wydajności** | Import < 10s, Gantt render < 3s, API < 500ms (TC-PERF-*) | TBD |
| **Budżety bezpieczeństwa plików** | Zip bomb odrzucony < 5s, RAM import < 1 GB, brak SSRF (TC-SEC-001 do TC-SEC-006) | TBD |
| **Arytmetyka finansowa** | Zaokrąglenia half-up, narzuty, marża % od ceny (TC-COST-*) | TBD |
| **Poprawność walutowa** | Kurs zamrożony w wersji, zaokrąglenia per waluta ISO 4217 (TC-CUR-001 do TC-CUR-005) | TBD |
| **Edycja równoległa** | Optimistic locking 409 + brak utraty danych (TC-CONC-001 do TC-CONC-005) | TBD |
| **Integracja z dealami/projektami** | Cena → szansa (TC-DEAL-002), oferta główna (TC-DEAL-004) | TBD |
| **Obsługa XLSX/CSV** | Kodowania, separatory, walidacja (TC-IMP-*), bezpieczeństwo (TC-SEC-*) | TBD |
| **Zamrożenie oferty po wysłaniu** | Brak edycji, snapshot PDF, kurs zamrożony (TC-VER-*, TC-CUR-002) | TBD |
| **Harmonogram wykonawczy** | Automatyczny, idempotentny, baseline (TC-EXEC-001 do TC-EXEC-005) | TBD |
| **Firma bez modułu harmonogramu** | Kalkulacja/prognoza działają, brak endpointów Ganttu (TC-NOSCHED-*) | TBD |

---

## 22. Wnioski do specyfikacji (Luki i niejasności)

**Liczba wniosków**: 15 + nowe z rev 2

### Priorytet 1 (Musi być w spec przed kodem)

1. **Standard zaokrąglenia** (TC-COST-003, TC-COST-014) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja (2026-10-19)**: half-up do 2 miejsc po przecinku per linia; sumy = suma już-zaokrąglonych linii (nie zaokrąglona suma surowa); tryb zaokrąglania konfigurowalny per firma. Np.: linia 1.005 → 1.01.
   - ~~**Rekomendacja**: Math.round() (IEEE 754) + test cases z konkretnymi przykładami~~ **ODRZUCONE**: `Math.round()` zaokrągla 0.5 w dół dla ujemnych (np. -0.5 → 0), co jest mylące biznesowo. Używamy jawnego `half-up` niezależnie od `Math.round` semantyki JS.

2. **Jednostki i konwersje** (TC-COST-007) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Słownik jednostek z przelicznikami (współczynniki konwersji) per firma; konwersje wspierane systemowo. Słownik globalny + możliwość dostosowania per firma.

3. **Definicja marży** (TC-COST-014) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Marża = % od ceny sprzedaży: `(Cena - Koszt) / Cena × 100%`. Narzut (markup) = `(Cena - Koszt) / Koszt × 100%` — wyłącznie jako widok pomocniczy.

4. **Multi-tenant mapping** (TC-PERM-005) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Firma = organizacja OM (`organization`); filter `organization_id` na poziomie DB (Awilix scoped payload).

5. **Priorytet źródeł ID inwestycji** (TC-DEAL-008) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: e-Zamówienia (BZP/postępowanie/plan) > TED > BIP > własny kod INV > fallback nazwa+NIP (tylko podpowiedź, zawsze wymaga potwierdzenia użytkownika).

### Priorytet 2 (Ważne, ale można mieć domyślne)

6. **Marża po zamknięciu deala** (TC-PERM-006) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Ustawienie PER FIRMA (nie per rola). Gdy włączone — widczą wszyscy z uprawnieniem do marży; gdy wyłączone — nikt.
   - ~~**Rekomendacja**: Per-role (Manager=widzi, Handlowiec=nie)~~ **ODRZUCONE**: decyzja właściciela systemu jest per firma, nie per rola.

7. **Trigger harmonogramu ofertowego → wykonawczego** (TC-GANTT-008) — ✅ **ROZSTRZYGNIĘTE**
   - **Decyzja**: Tworzony AUTOMATYCZNIE, idempotentnie, gdy deal zostanie wygrany (zdarzenie `deal.won`). Brak ręcznego wyzwalania.
   - ~~**Rekomendacja**: Na żądanie (użytkownik kliknie "Zaakceptuj i utwórz harmonogram wykonawczy")~~ **ODRZUCONE**: automatyzm zapewnia, że żaden deal nie zostanie przeoczony.

8. **Lista pól do audytu** (brak TC)
   - **Otwarte**: Każda zmiana ceny? Narzutu? Jednostki? Ilości?
   - **Rekomendacja**: price, markup, cost, unit, quantity, status zmian + user_id + timestamp + old_value/new_value

9. **Limity rozmiaru pliku i wierszy** (TC-IMP-006, TC-PERF-001, TC-SEC-001)
   - **Otwarte**: Max 5 MB? 5000 wierszy?
   - **Rekomendacja**: 10 MB / 10k wierszy z komunikatem; odrzucenie ≥ 100 MB; streaming dla dużych plików; timeout import = 30s

10. **Definicja "błędnego wiersza" w imporcie** (TC-IMP-005)
    - **Otwarte**: Brak ilości = błąd? Ujemna ilość? Null jednostka?
    - **Rekomendacja**: Skip z logowaniem; nigdy nie abort całego importu

### Priorytet 3 (Uwagi/sugestie)

11. **Notacja narzutu** — "30% narzutu" = ×1.30 czy +0.30?
    - **Otwarte** → **Rekomendacja**: Zawsze ×(1 + narzut%), czyli 30% = ×1.30

12. **Prognoza produkcji** — jak waży prawdopodobieństwo? (TC-FCST-004)
    - **Otwarte**: Ilość = sum(partii) czy sum(partii × probability)?
    - **Rekomendacja**: Obie metryki: niezważona (partii) i ważona; suma ważona ≠ suma partii jeśli prob < 100%

13. **Widoczność kosztów w API vs UI**
    - **Otwarte**: Czy API zawsze filtruje czy tylko UI?
    - **Rekomendacja**: API zawsze filtruje (backend security, nie client-side); TC-TEN-001 to weryfikuje

14. **Cena zero** — czy jest przypadkiem, czy przychód z innego źródła?
    - **Otwarte** → **Rekomendacja**: Dozwolone, opcjonalny komentarz

15. **Gotowość Sekocenbud/Intercenbud** — architektura mapowania kodów
    - **Otwarte**: Gdzie przechowywać mapping?
    - **Rekomendacja**: Osobny moduł integrations, mapowanie per-firma

### Nowe wnioski (rev 2)

16. **Zaokrąglenia per waluta** (TC-CUR-003)
    - **Otwarte**: Czy JPY = 0 miejsc dziesiętnych per reguła ISO 4217? Jak przechowywać konfigurację?
    - **Rekomendacja**: ISO 4217 jako default; możliwość nadpisania per firma

17. **Zamrożenie kursu w wysłanej wersji** (TC-CUR-002)
    - **Otwarte**: Jakie jest źródło kursów (NBP? ECB? ręczne)? Jak często odświeżane?
    - **Rekomendacja**: Kurs pobierany raz przy wysyłaniu, zapamiętany w wersji (snapshot), niemożliwy do zmiany

18. **Idempotentność tworzenia harmonogramu wykonawczego** (TC-EXEC-002)
    - **Otwarte**: Jak system wykrywa, że harmonogram już istnieje — po `deal_id` + typ = `execution`?
    - **Rekomendacja**: Unikalne constraint na (deal_id, schedule_type = 'execution'); powtórne zdarzenie → no-op z logiem

19. **Zachowanie harmonogramu przy ponownym otwarciu deala** (TC-EXEC-003)
    - **Otwarte**: Czy harmonogram wykonawczy jest archiwizowany czy kasowany przy cofnięciu do otwartego?
    - **Rekomendacja**: Harmonogram zachowany jako wersja historyczna; nowe wygranie tworzy nową wersję

20. **Limity antybombowe na VPS** (TC-SEC-001, TC-SEC-002)
    - **Otwarte**: Max expanded size w MB? Max liczba wierszy w arkuszu?
    - **Rekomendacja**: Limit przed rozpakowaniem: 50 MB; po: 200 MB; wiersze: 100k; kolumny: 500; timeout: 30s

---

## 23. Podsumowanie

**Dokument**: Niezależny plan testów — spec only
**Liczba scenariuszy**: 109 (rev 2; rev 1 miał 72)
**Liczba wniosków do speki**: 20 (15 oryginalnych + 5 nowych w rev 2)
**Status**: SPEC ONLY — bez kodu, bez testów wykonywalnych

**Kolejne kroki**:
1. Sprecyzować odpowiedzi na otwarte wnioski (8, 9, 10, 11, 14, 15–20 w sekcji 22)
2. Zatwierdzić dokument (review przez Marka + PO)
3. Przejść do fazy implementacji

---

## Changelog

### Rev 2 — 2026-10-19

**Dodane scenariusze** (+37 TC):
- TC-CUR-001..005: Waluty (kalkulacja jednowalutowa, kursy, zaokrąglenie per waluta, zmiana waluty, eksport/PDF)
- TC-NOSCHED-001..004: Firmy BEZ modułu harmonogramu (partie/daty, brak Ganttu, import XLSX, włączenie/wyłączenie)
- TC-FCST-001..006: Prognoza produkcji 6 mies. (z/bez Ganttu, m³/szt., prawdopodobieństwo, horyzont, suma partii, zmiana oferty)
- TC-EXEC-001..005: Harmonogram ofertowy → wykonawczy (automatyczny, idempotentny, ponowne otwarcie, brak harmonogramu, wiele dealów)
- TC-SEC-001..006: Bezpieczeństwo plików (XLSX bomb, ogromne arkusze, formula injection, makra, MIME, SSRF)
- TC-TEN-001..006: Izolacja multi-tenant (API 404, cudze ID w body, wyszukiwanie inwestycji, eksport/PDF, webhooki, same-tenant/cross-tenant)
- TC-CONC-001..005: Edycja równoległa (optimistic locking, 409 conflict, wyścig zamrożenia, równoległe przełączanie oferty, import)

**Zmiany w istniejących scenariuszach**:
- TC-COST-003: oczekiwany wynik zaktualizowany do half-up per linia (usunięto "Luka spec")
- TC-COST-014: definicja marży zaktualizowana: marża = % od ceny sprzedaży (usunięto "Luka spec")
- TC-PERM-006: widoczność marży per FIRMA (nie per rola) — zmiana treści scenariusza

**Zmiany w sekcji Wnioski (sekcja 22)**:
- Oznaczono jako **ROZSTRZYGNIĘTE**: standard zaokrąglenia (half-up), słownik jednostek z przelicznikami, definicja marży (% od ceny), firma = organizacja OM, priorytet ID inwestycji (e-Zamówienia > TED > BIP > INV)
- Oznaczono jako **ODRZUCONE z uzasadnieniem**: Math.round dla kwot, harmonogram wykonawczy "na żądanie", widoczność marży per rola
- Dodano nowe wnioski 16–20 (zaokrąglenia per waluta, zamrożenie kursu, idempotentność exec, ponowne otwarcie deala, limity antybombowe)

**Zmiany strukturalne**:
- Sekcje 12–16 → 19–23 (aby zrobić miejsce na nowe sekcje TC 12–18)
- Macierz ryzyk rozszerzona o R8–R12
- Fixtures zaktualizowane o nowe typy danych testowych
- Kryteria akceptacji zaktualizowane o nowe obszary

---

**Koniec dokumentu**
*Data wygenerowania: 2026-10-19 | Rev 2: 2026-10-19*

