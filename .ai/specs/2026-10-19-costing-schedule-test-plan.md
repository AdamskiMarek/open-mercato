# Niezależny plan testów: Koszty projektu + Kalkulator ofert + Harmonogram

**Dokument**: Specyfikacja planów testów na podstawie wymagań biznesowych  
**Data**: 2026-10-19  
**Status**: Spec Only — plan testów, bez kodu i testów wykonywalnych  
**Liczba scenariuszy**: 62 (Kalkulacja: 22, Import/eksport: 8, Powiązania: 8, Wersje: 6, Cenniki: 4, Uprawnienia: 6, Koszty rzeczywiste: 2, Harmonogram: 6)

---

## 1. Macierz ryzyka i priorytety

### 1.1 Ryzyka biznesowe

| Ryzyko | Prawdopodobieństwo | Wpływ | Poziom | Priorytet |
|--------|-------------------|-------|--------|-----------|
| Błędna kalkulacja ceny/marży (zaokrąglenia, dzielenie przez zero) | Średnie | Krytyczny | P0 | Błędy finansowe |
| Wyciek kosztów/marży pomiędzy roli/firmami (multitenant) | Niskie | Krytyczny | P0 | Bezpieczeństwo |
| Import złych danych XLSX łamie bazę/kalkulację | Średnie | Wysoki | P0 | Integracja |
| Konflikt wersji przy równolegielnej edycji | Niskie | Wysoki | P1 | Konkurencja |
| Harmonogram: cykl w zależnościach blokuje planowanie | Niskie | Wysoki | P1 | Funkcjonalność |
| Wydajność na małym VPS (<100ms na 5000 wierszy) | Średnie | Wysoki | P1 | Infrastruktura |
| Brak izolacji danych multi-tenant w filtrach/eksportach | Niskie | Krytyczny | P0 | Bezpieczeństwo |

### 1.2 Priorytetyzacja scenariuszy

- **P0 (Blokerowe)**: Kalkulacja prawidłowa, multitenant izolacja, import безопасny, zaokrąglenia
- **P1 (Krytyczne)**: Wersje, uprawnienia, Gantt, wydajność
- **P2 (Ważne)**: Cenniki, porównanie wersji, eksport
- **Poza zakresem**: Integracje Sekocenbud/Intercenbud (faza II); MS Project adapter (faza II); API webhooków (opcjonalnie)

---

## 2. Scenariusze testowe

### 2.1 Kalkulacja kosztów (22 scenariusze)

#### TC-COST-001: Kalkulacja podstawowa — suma wierszy
- **Priorytet**: P0  
- **Poziom testu**: Unit + Integration  
- **Moduł**: Kalkulacja (core domain)  
- **Warunki wstępne**: Firma istnieje, użytkownik zalogowany, uprawnienia do edycji  
- **Kroki**:
  1. Utwórz kalkulację nową
  2. Dodaj 3 wiersze: (pozycja A: il. 10, j.m. szt., koszt 50, cena 100) → wartość 1000; (pozycja B: il. 5, j.m. szt., koszt 30, cena 60) → wartość 300
  3. System automatycznie oblicza sumę wierszy = 1300
  4. Sprawdź, czy marja = suma cen - suma kosztów = 500
- **Oczekiwany wynik**: Suma i marża zgadzają się; kolumny przeliczane w czasie rzeczywistym  
- **Dane testowe**: Wiersze z jednostkami: szt., m³, m²  
- **Typ walidacji**: Asercja matematyczna

#### TC-COST-002: Kalkulacja — cena z docelowej marży (procent)
- **Priorytet**: P0  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz kalkulację, ustaw tryb: „cena z marży"
  2. Dodaj wiersz: koszt 100, marża 30% (żądana marja)
  3. System przelicza cenę = koszt × (1 + marża/100) = 130
  4. Zmień marżę na 50%, cena → 150
- **Oczekiwany wynik**: Cena zmienia się; marża docelowa zawsze osiągnięta  
- **Kryteria**: Bez zaokrągleń bankowych (do znormalizowania w speku)

#### TC-COST-003: Kalkulacja — pełny koszt × narzut
- **Priorytet**: P0  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Ustaw tryb: „pełny koszt × narzut"
  2. Pełny koszt = suma kosztów z narzutem pośrednim, np. 100 + 10 narzut = 110
  3. Ustaw narzut cenowy = 40% na poziomie kalkulacji
  4. Cena = 110 × 1.40 = 154
- **Oczekiwany wynik**: Prawidłowe zastosowanie narzutu, dziedziczenie z poziomu wersji  

#### TC-COST-004: Wiersze: sekcja, pozycja, notatka, podsumowanie
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Dodaj sekcję „Produkcja"
  2. Pod nią 2 pozycje (sumy cząstkowe sekcji = 500)
  3. Dodaj notatkę (bez wartości, tylko tekst)
  4. Dodaj podsumowanie częściowe (wynik = 500)
  5. Dodaj sekcję „Transport" z pozycjami (200)
  6. Sprawdź, czy suma całkowita = 700, podsumowania sekcji się nie sumują
- **Oczekiwany wynik**: Hierarchia zachowana, sumy poprawne

#### TC-COST-005: Marża ujemna — sygnalizacja
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz wiersz: koszt 100, cena 80 → marża -20 (ujemna)
  2. System wyświetla ostrzeżenie (czerwony tekst / ikona)
  3. Pozwala na zapisanie (marża ujemna jest dopuszczalna)
- **Oczekiwany wynik**: Ostrzeżenie, ale zapis nie zablokowany

#### TC-COST-006: Marża zerowa
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz wiersz: koszt 100, cena 100 → marża 0%
  2. Brak ostrzeżenia
- **Oczekiwany wynik**: Zero marży zaakceptowane bez sygnału

#### TC-COST-007: Cena zero
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz wiersz: koszt 100, cena 0 → marża -100%
  2. System wyświetla ostrzeżenie
  3. Dopuszcza zapisanie (np. promocja)
- **Oczekiwany wynik**: Zapis dozwolony, ostrzeżenie widoczne

#### TC-COST-008: Dzielenie przez zero — ochrona
- **Priorytet**: P0  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Ustaw tryb: „koszt × (1+narzut)", ale koszt = 0
  2. Narzut = 40% → próba podziału
  3. System obsługuje błąd bez upadku
- **Oczekiwany wynik**: Komunikat błędu, kalkulacja zawieszana

#### TC-COST-009: Zaokrąglenia — gros vs złoty
- **Priorytet**: P0  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Koszt = 33.33, ilość = 3 → wartość = 99.99
  2. Marża = 10% → cena = 109.989
  3. System zaokrągla do 2 miejsc po przecinku (PLN) → 110.00
  4. Sprawdź, czy suma wierszy = suma zaokrąglonych wartości
- **Oczekiwany wynik**: Zaokrąglenia konsystentne, bez błędu „groszowy"

#### TC-COST-010: Narzut dziedziczony: pozycja → sekcja → wersja
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Ustaw narzut na wersji = 30%
  2. Ustaw narzut na sekcji = 40% (nadpisuje)
  3. Pozycja bez narzutu → bierze 40%
  4. Pozycja z narzutem = 50% (własny, nie używa sekcji)
- **Oczekiwany wynik**: Najbardziej szczegółowy narzut wygrywa; brak kaskady

#### TC-COST-011: Ręczna cena — nie nadpisywana przeliczeniami
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Ustaw cenę pozycji na 150 (ręcznie)
  2. Zmień narzut wersji z 30% na 50%
  3. System NE PRZELICZA ceny ręcznej pozycji
- **Oczekiwany wynik**: Cena ręczna zafiksowana, marża się zmienia

#### TC-COST-012: Import danych z Excela — mapowanie kolumn (złe kodowanie)
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Moduł**: Import/eksport  
- **Kroki**:
  1. XLSX z kodowaniem UTF-16 (za poprzednim Excelem)
  2. Kolumny: [A: znaki polskie „Pozycja", B: „Ilość", C: „J.M.", D: „Koszt"]
  3. Użytkownik mapuje: A→Pozycja, B→Ilość, C→Jednostka, D→KosztJednostkowy
  4. Kreator wyświetla podgląd (dekoduje prawidłowo)
  5. Zapisz
- **Oczekiwany wynik**: Import z UTF-16 działa; znaki polskie zachowane

#### TC-COST-013: Import CSV — separator ; (domyślnie ,)
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. CSV: „Pozycja;Ilość;Koszt" (separator ;)
  2. System detekcji separatora
  3. Kreator wyświetla opcję „Separator: ; (auto-detect)"
  4. Można ręcznie zmienić na ,
  5. Podgląd się aktualizuje
- **Oczekiwany wynik**: Detekcja separatora; mapowanie bez błędów

#### TC-COST-014: Import XLSX — błędne wiersze oznaczane, import ciąg dalszy
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. XLSX z 100 wierszy; wiersze 25, 50: złe dane (brak ilości)
  2. Kreatoir: mapowanie → podgląd zaznacza wiersze 25, 50 na czerwono
  3. Użytkownik klika „Pomiń błędne wiersze i importuj"
  4. Import: 98 wierszy wstawione
- **Oczekiwany wynik**: Częściowy import, raport błędów

#### TC-COST-015: Import — limit rozmiaru pliku (rozsądny, np. 5 MB)
- **Priorytet**: P2  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Spróbuj załadować plik 10 MB
  2. System pokazuje błąd: „Plik przekracza limit 5 MB"
- **Oczekiwany wynik**: Błąd z komunikatem

#### TC-COST-016: Import — limit liczby wierszy (np. 5000)
- **Priorytet**: P2  
- **Poziom testu**: Unit  
- **Kroki**:
  1. XLSX z 6000 wierszy danych
  2. System ostrzega: „Plik zawiera 6000 wierszy, limit to 5000"
- **Oczekiwany wynik**: Ostrzeżenie; możliwość podzielenia pliku

#### TC-COST-017: Import — XLSX bomba (zipbomb)
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Plik XLSX z techniką zipbomb (rozpakowuje się na TB)
  2. System limit zasobów (timeout 10 s)
  3. Błąd: „Plik uszkodzony lub zbyt złożony"
- **Oczekiwany wynik**: Timeout/błąd, brak UB

#### TC-COST-018: Import — XLSX z formułami (ignoar)
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. XLSX: kolumna D = formuła =SUM(A:C)
  2. Import → system importuje wartość, NE formułę
- **Oczekiwany wynik**: Wartości zamiast formuł

#### TC-COST-019: Eksport do XLSX — zgodny z polskim Excelem
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Kalkulacja z polskimi znakami i PLN
  2. Eksport do XLSX
  3. Otwórz w Excelu (Windows, UTF-8)
  4. Dane widoczne prawidłowo
- **Oczekiwany wynik**: Znaki polskie, formaty walut OK

#### TC-COST-020: Eksport — tylko kolumny widoczne dla roli
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Moduł**: Uprawnienia  
- **Kroki**:
  1. Użytkownik z uprawnieniami „brak marży"
  2. Eksportuje kalkulację do XLSX
  3. Kolumna „Marża" NE pojawia się w pliku
- **Oczekiwany wynik**: Filtrowanie kolumn w eksporcie

#### TC-COST-021: Edycja w siatce — kopiuj/wklej z Excela
- **Priorytet**: P1  
- **Poziom testu**: E2E (Playwright)  
- **Kroki**:
  1. Excel: 3 wiersze × 4 kolumny (Pozycja, Ilość, Koszt, Cena)
  2. Zaznacz, skopiuj (Ctrl+C)
  3. Przejdź do siatki kalkulacji
  4. Kliknij wiersz 1, kolumna 1
  5. Wklej (Ctrl+V)
  6. System parsuje CSV/TSV, mapuje na kolumny
- **Oczekiwany wynik**: Dane wklejone, siatka przeliczona

#### TC-COST-022: Jednostki — niezgodność (m³ podpasowana na m²)
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Wiersz A: j.m. = m³, ilość = 10
  2. Zmień j.m. na m² (kliknięcie dropdown)
  3. Ilość dalej = 10 (nie przelicza się automatycnie)
  4. System ostrzega: „Zmiana j.m. bez przeliczenia — sprawdź ilość"
- **Oczekiwany wynik**: Ostrzeżenie, umożliwia zmianę

---

### 2.2 Powiązania: deal, projekt, inwestycja (8 scenariuszy)

#### TC-DEAL-001: Kalkulacja bez deala (wycena wewnętrzna)
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz kalkulację
  2. Pole "Deal" = brak
  3. Zapisz, widoczna w liście
  4. Może być podpięta później
- **Oczekiwany wynik**: Kalkulacja istnieje niezależnie

#### TC-DEAL-002: Podpięcie deala do kalkulacji
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Istniejąca kalkulacja
  2. Wybierz deal z dropdown (czy wyszukuj)
  3. System sprawdza: czy inwestycja już ma ofertę główną
  4. Zapisz
  5. Cena z kalkulacji pojawia się w polu "Wartość" deala
- **Oczekiwany wynik**: Deal podpięty, wartość zsynchronizowana

#### TC-DEAL-003: Wiele ofert na jedną inwestycję — komunikat
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Inwestycja X ma 2 deale: A (oferta główna, wartość 1000), B (nowy, wartość 800)
  2. Spróbuj podpiąć ofertę dla B jako główną (zamiast A)
  3. System pokazuje komunikat: "Istnieje już oferta dla innego wykonawcy. Której firmy oferta powinna być główna?"
  4. Opcje: [A (Contractor1), B (Contractor2)]
  5. Wybierz B
- **Oczekiwany wynik**: Zmiana główna auditowana; stara oferta → alternatywna

#### TC-DEAL-004: Zmiana oferty głównej — audyt
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Moduł**: Audyt  
- **Kroki**:
  1. (po TC-DEAL-003) Sprawdź log zmian deala/inwestycji
  2. Wpis: "Zmiana oferty głównej: A → B, użytkownik: john.doe, czas: 2026-10-19 14:30"
- **Oczekiwany wynik**: Audyt zachowany

#### TC-DEAL-005: Dopasowanie inwestycji po ID przetargowym (e-Zamówienia)
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Moduł**: Matching  
- **Kroki**:
  1. Użytkownik wpisuje "ID e-Zamówienia: BZP-2026-123456"
  2. System szuka inwestycji ze zdefiniowanym mappingiem tego ID
  3. Znaleziona → sugeruje "Inwestycja: Prefab stropy dla ABC sp. z o.o."
  4. Użytkownik potwierdza
- **Oczekiwany wynik**: Automatyczne dopasowanie po ID

#### TC-DEAL-006: Dopasowanie inwestycji — fallback po nazwie (tylko podpowiedź)
- **Priorytet**: P2  
- **Poziom testu**: Integration  
- **Kroki**:
  1. ID przetargowe unknown
  2. Wpisz "stropy dla ABC"
  3. System szuka inwestycji podobne po nazwie (substring match)
  4. Wyświetla 3 sugestie (brak pewności)
  5. Użytkownik wybiera manualnie
- **Oczekiwany wynik**: Podpowiedź, decyzja człowieka

#### TC-DEAL-007: Scalanie inwestycji (administratora)
- **Priorytet**: P2  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Inwestycja A (3 deale) i Inwestycja B (2 deale)
  2. Admin: "Połącz jako jedną inwestycję"
  3. System: przejrzeć konflikty (np. obie mają ofertę główną)
  4. Wybrać główną ofertę dla połączonej
  5. Przepisać deale, audyt
- **Oczekiwany wynik**: Scalanie bez utraty danych

#### TC-DEAL-008: Prognoza wartości: zmiana wartości deala przy aktualizacji oferty
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Deal A: oferta główna wartość 1000, prawdopodobieństwo 50% → prognoza = 500
  2. Zaktualizuj kalkulację → nowa cena 1200
  3. Deal A: prognoza → 600 (1200 × 50%)
- **Oczekiwany wynik**: Prognoza zmieniana real-time

---


### 2.3 Wersje i status oferty (6 scenariuszy)

#### TC-VER-001: Numeracja wersji — bazowa + rewizja
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz kalkulację, numer domyślny = "1.0"
  2. Duplikuj jako nową wersję → "1.1"
  3. Duplikuj "1.1" jako nową → "1.2"
  4. Zmień bazę na 2 (menu) → "2.0"
- **Oczekiwany wynik**: Numeracja sekwencyjna, kontrola manualnaADOWANA możliwa

#### TC-VER-002: Status wersji: robocza → wysłana → zamrożona
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Wersja nowa: status = "Robocza"
  2. Możliwość edycji
  3. Kliknij "Wyślij" → status = "Wysłana"
  4. Wersja nieedytowalna (kolumny disabled)
  5. Dokument PDF wygenerowany i zapisany
- **Oczekiwany wynik**: Zamrożenie po wysłaniu; PDF snapshot

#### TC-VER-003: Ręczna edycja wysłanej wersji — tylko admin, nowa wersja
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Moduł**: Uprawnienia  
- **Kroki**:
  1. Admin klika "Odblokuj tę wersję" (wysłana)
  2. Wyświetli modal: "Bezpośrednia edycja tworzy nową wersję (audyt). Kontynuować?"
  3. Potwierdź
  4. Nowa wersja 1.2 (jeśli poprzednia 1.1)
  5. Edycja; poprzednia 1.1 → status "Zastąpiona"
- **Oczekiwany wynik**: Nowa wersja, audyt, stara wersja oznaczona

#### TC-VER-004: Porównanie dwóch wersji — różnice podświetlone
- **Priorytet**: P2  
- **Poziom testu**: E2E (Playwright)  
- **Kroki**:
  1. Otwórz wersję 1.0 i 1.1 w "Porównaj" widoku
  2. System wyświetla tabelę: kolumna Wersja 1.0, kolumna Wersja 1.1
  3. Różnice podświetlone (Wersja 1.1: pozycja A zmieniona z 100 → 120)
  4. Sumy: 1.0 = 1000, 1.1 = 1020 (różnica zaznaczona)
- **Oczekiwany wynik**: Wizualne porównanie różnic

#### TC-VER-005: PDF oferty — snapshot wersji, dane firmy
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Moduł**: PDF  
- **Kroki**:
  1. Wyślij wersję 1.1
  2. System generuje PDF z headrem: logo firmy, dane (nazwa, NIP, adres)
  3. Zawiera pozycje, sumy
  4. NE zawiera: koszty, marża
  5. Rodryty (ważność, warunki) z szablonu firmy
  6. PDF zapisany powiązany z wersją
- **Oczekiwany wynik**: PDF dla klienta, bez wrażliwych danych

#### TC-VER-006: Historia PDF — kilka wersji → kilka plików
- **Priorytet**: P2  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Wyślij wersję 1.1 → PDF_1_1.pdf
  2. Wyślij wersję 1.2 → PDF_1_2.pdf
  3. Obie dostępne, oznaczone, linkowane do wersji
- **Oczekiwany wynik**: Archum PDF per wersja

---

### 2.4 Cenniki (4 scenariusze)

#### TC-PRICE-001: Cennik warstwowy — zakres, priorytet, ważność
- **Priorytet**: P2  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Utwórz cennik firmy
  2. Reguła 1: Segment "Produkcja", koszt*1.2, ważna 2026-01-01…2026-06-30, priorytet 10
  3. Reguła 2: Kategoria "Stropy", koszt*1.3, min. il. 100, priorytet 20 (wyższy)
  4. Dla pozycji "Strop 30 cm", il. 200: stosowana Reguła 2 (priorytet wyższy)
  5. Dla pozycji "Ściana 20 cm", il. 50: Reguła 1
- **Oczekiwany wynik**: Prawidłowa aplikacja reguł, priorytet wygrywa

#### TC-PRICE-002: Brak wstecznej zmiany kalkulacji przy zmianie cennika
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Kalkulacja stworzona 2026-10-15 z ceną z cencika (koszt 100 → narzut 1.2 = cena 120)
  2. Data import: cena zapamiętana jako "2026-10-15"
  3. 2026-10-20: zmień cennik (narzut 1.2 → 1.5)
  4. Otwórz starą kalkulację: cena dalej 120 (nie przeliczana)
- **Oczekiwany wynik**: Historyczność ceny; brak backdateowania

#### TC-PRICE-003: Proweniencja ceny — źródło zapamiętane
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Pozycja: cena pobrana z Cencika warstwowego, reguła "Produkcja", data 2026-10-19
  2. UI: wyświetl ikona/tooltip: "Źródło: Cennik Produkcja (2026-10-19), narzut 1.2"
- **Oczekiwany wynik**: Widoczna proweniencja

#### TC-PRICE-004: Gotowość pod Sekocenbud/Intercenbud (mapowanie kodów)
- **Priorytet**: P2  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Konfiguracja firmy: mapowanie kodów Sekocenbud → własne kody pozycji
  2. Import: pozycja Sekocenbud KB-001 → lokalny kod POS-050
  3. System auto-mapuje cenę na POS-050
- **Oczekiwany wynik**: Mapowanie gotowe do integracji

---

### 2.5 Uprawnienia i widoczność (6 scenariuszy)

#### TC-PERM-001: Widoczność kosztów — per rola
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Rola "Handlowiec": widzi kalkulację, ceny, marżę
  2. Rola "Księgowy": widzi koszty, NE widzi marż
  3. Rola "Obsługa": widzi tylko pozycje i ceny (bez kosztów, marży)
  4. API response filtruje pola per rola
- **Oczekiwany wynik**: Filtrowanie per rola konsystentne

#### TC-PERM-002: Uprawnieni do edycji narzutu — tylko manager
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Handlowiec otwiera kalkulację
  2. Pole "Narzut" readonly (szare)
  3. Manager widzi edytowalne pole
  4. Zmiana narzutu przez managera auditowana
- **Oczekiwany wynik**: Pole kontrolowane per uprawnień

#### TC-PERM-003: Ustawienie firmy — użytkownicy widzą tylko własne deale
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Moduł**: Konfiguracja  
- **Kroki**:
  1. Firma ustawienie: "Użytkownicy widzą: Tylko własne deale"
  2. User1 (handle john): jego deale widoczne
  3. User2 (handle jane): deale jane widoczne, deale john NE widoczne
  4. Admin: widzi wszystko
- **Oczekiwany wynik**: Filtrowanie list per użytkownika (jeśli ustawienie włączone)

#### TC-PERM-004: Marża po zamknięciu deala — konfiguracja widoczności
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Firma ustawienie: "Marża zaakceptowanej wersji widoczna po zamknięciu deala: Tak/Nie"
  2. Deal zamknięty (wygrany), wersja zaakceptowana
  3. Jeśli Nie: widoczna tylko cena, NE marża
  4. Jeśli Tak: marża widoczna
- **Oczekiwany wynik**: Konfiguracja respektowana

#### TC-PERM-005: Eksport — filtrowanie kolumn per uprawnienie
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Obsługa eksportuje kalkulację do CSV
  2. Kolumny: Pozycja, Ilość, Cena (brak Kosztów, Marży)
  3. Handlowiec eksportuje: Pozycja, Ilość, Koszt, Cena, Marża
- **Oczekiwany wynik**: Eksport respektuje uprawnienia

#### TC-PERM-006: Wielotenant — wyciek danych przez ID w API
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Moduł**: Bezpieczeństwo  
- **Kroki**:
  1. User1 z Firmy A, User2 z Firmy B
  2. User1 próbuje dostępu API: GET /api/calcs/id-z-firmy-B
  3. System zwraca 403 Forbidden (brak dostępu do firmy B)
  4. Nawet jeśli User1 zna ID, NE może pobrać
- **Oczekiwany wynik**: API blokuje dostęp cross-tenant

---

### 2.6 Koszty rzeczywiste i analityka (2 scenariusze)

#### TC-REAL-001: Rejestracja kosztów rzeczywistych — powiązanie z kalkulacją
- **Priorytet**: P2  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Kalkulacja: Pozycja "Stropy", koszt 5000
  2. Deal zamknięty, realizacja
  3. User rejestruje koszt rzeczywisty: data 2026-10-18, kategoria "Produkcja", kwota 4800, źródło "Faktura 123"
  4. System powiązuje z kalkulacją
  5. Raport: Budżet 5000, Rzeczywiste 4800, Oszczędność 200
- **Oczekiwany wynik**: Tracking rzeczywistych kosztów

#### TC-REAL-002: Marża ofertowa vs marża z realizacji
- **Priorytet**: P2  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Oferta: cena 1000, koszt 800, marża 200
  2. Koszty rzeczywiste: 750
  3. Raport: Marża z oferty 200, Marża z realizacji 250 (1000-750)
- **Oczekiwany wynik**: Osobne śledzenie obu marż

---

### 2.7 Harmonogram (Gantt) (6 scenariuszy)

#### TC-GANTT-001: Interaktywny Gantt — przeciąganie, zmiana długości
- **Priorytet**: P1  
- **Poziom testu**: E2E (Playwright)  
- **Kroki**:
  1. Gantt z zadaniami (paski)
  2. Przeciągnij pasek zadania A na prawo → data początkowa się przesunęła
  3. Zmień koniec paska (drag prawy koniec) → długość się zmienia
  4. Dane zmienione w DB
- **Oczekiwany wynik**: Interaktywne edycja Gantta

#### TC-GANTT-002: Zależności — wszystkie typy (FS, SS, FF, SF) z lag/lead
- **Priorytet**: P1  
- **Poziom testu**: Unit  
- **Kroki**:
  1. Zadanie A (2026-10-20…2026-10-25)
  2. Zadanie B zależy od A, typ FS (koniec A → początek B), lag 2 dni
  3. B zaczyna się 2026-10-27 (25+2)
  4. Zmień na SS (start-start), lead -1 dzień
  5. B zaczyna się 2026-10-19 (20-1)
  6. Sprawdzić FF, SF analogicznie
- **Oczekiwany wynik**: Wszystkie typy zależności działają

#### TC-GANTT-003: Blokada cykli w zależnościach
- **Priorytet**: P0  
- **Poziom testu**: Unit  
- **Kroki**:
  1. A → B → C → A (cykl)
  2. System próbuje dodać: C zależy od A
  3. Błąd: "Cykl w zależnościach: A → B → C → A. Nie może być dodana."
- **Oczekiwany wynik**: Cykl zdetektowany i zablokowany

#### TC-GANTT-004: Przesunięcie automatyczne następników
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. A (2026-10-20…25) → B (2026-10-26…30, zależy FS)
  2. Przesunięcie A o 5 dni (kończy się 2026-10-30)
  3. B auto-przesunięte o 5 dni (2026-10-31…11-04)
  4. Możliwość wyłączenia auto-planowania (toggle)
- **Oczekiwany wynik**: Przesunięcie cascade; możliwość disable

#### TC-GANTT-005: Jeden Gantt dla wielu deali inwestycji
- **Priorytet**: P1  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Inwestycja X: Deal A (kontraktor 1), Deal B (kontraktor 2)
  2. Gantt na inwestycji: wizualizacja obu deali (np. różne kolory)
  3. Zależności mogą być między dealami
- **Oczekiwany wynik**: Łączna wizualizacja

#### TC-GANTT-006: Harmonogram ofertowy → wykonawczy (baseline i odchylenia)
- **Priorytet**: P0  
- **Poziom testu**: Integration  
- **Kroki**:
  1. Deal wygrany
  2. System tworzy kopię: "Harmonogram wykonawczy" z baseline z oferty
  3. Realizacja: daty rzeczywiste wpisywane
  4. Odchylenia liczone: rzeczywiste vs plan (nigdy nie nadpisują)
  5. Raport: zaplanowany Gantt vs wykonany
- **Oczekiwany wynik**: Historia, baseline, odchylenia

---

## 3. Poziomy testów i narzędzia

### 3.1 Mapa testów do narzędzi

| Poziom | Narzędzie | Konfiguracja | Konwencja | Komenda |
|--------|-----------|--------------|-----------|---------|
| **Unit** | Jest/Vitest | `jest.config.cjs` (base) | `__tests__/*.test.ts` w katalogu modułu | `yarn test` |
| **Integration** | Jest + baza testowa | `jest.config.cjs` + helper `createTestDb` | `__tests__/*.integration.test.ts` | `yarn test` |
| **API** | Jest/Supertest | API routes, fixtures | `api/__tests__/routes.test.ts` | `yarn test` |
| **E2E/UI** | Playwright | `.ai/qa/tests/playwright.config.ts` | `__integration__/**/*.spec.ts` | `yarn test:integration` |
| **Wydajność** | Jest profiler / node --prof | Miara czasu, pamięci | `__tests__/perf.test.ts` | `yarn test --testNamePattern=perf` |

### 3.2 Konfiguracje testów w repo

- **Unit**: `packages/core/jest.config.cjs`, `packages/ui/jest.config.cjs`, `packages/shared/jest.config.cjs`  
- **Integration**: Testy `*.integration.test.ts` używają DI + mock bazy  
- **E2E**: Playwright, discovery `discoverIntegrationSpecFiles()`, spec files w `__integration__/`  
- **Helpers**: `packages/cli/src/lib/testing/` (fixtures, createTestDb, etc.)

### 3.3 Domyślne dane testowe

```sql
-- Fixture: Firma test (tenant)
INSERT INTO organizations (id, name) VALUES ('org-test', 'Test Corp');
INSERT INTO users (id, org_id, email, name) VALUES 
  ('user-handlowiec', 'org-test', 'john@test.com', 'John'),
  ('user-manager', 'org-test', 'manager@test.com', 'Manager');

-- Fixture: Deal + Projekt
INSERT INTO deals (id, org_id, ...) VALUES (...);
INSERT INTO projects (id, org_id, ...) VALUES (...);

-- Fixture: Kalkulacja
INSERT INTO calcs (id, deal_id, status) VALUES ('calc-001', 'deal-001', 'DRAFT');
```

---

## 4. Kryteria akceptacji

### 4.1 Pokrycie

- **P0**: 100% scenariuszy zaimplementowanych i przechodzących
- **P1**: ≥95% scenariuszy
- **P2**: ≥80% scenariuszy (ostatnia iteracja)

### 4.2 Wydajność

- Kalkulacja 5000 wierszy: <100 ms (obliczenie sum)
- Import XLSX 1000 wierszy: <2 s
- Export do XLSX: <1 s
- Gantt 500 zadań: render <500 ms, przesunięcie <200 ms
- Baza testowa: <500 MB RAM

### 4.3 Multi-tenant

- Brak wycieków danych między organizacjami (testy penetracyjne)
- Wszystkie API endpoints filtrują org_id

### 4.4 Wejście

- Spec zatwierdzona, wszystkie niejasności wyjaśnione
- Fixtures gotowe w repo
- Konfiguracja testów zatwierdzony PR

### 4.5 Wyjście

- Todos zakończone, testy zielone
- Coverage ≥80% (zakomentować TC o szacunkach)
- Dokumentacja wewnętrzna (AAA patterns, fixtures)

---

## 5. Zbiory danych testowych

### 5.1 Dane fixture'ów

#### Organizacje i użytkownicy
```
Org: "Prefab Corp" (org-prefab)
  User: john@prefab (Handlowiec, role: sales, view_margin=true)
  User: anna@prefab (Manager, role: manager, edit_markup=true)
  User: bob@prefab (Obsługa, role: support, view_costs=false)
Org: "Builder Inc" (org-builder)
  User: alice@builder (Handlowiec)
```

#### Deale i projekty
```
Deal: "ABC Sp. z o.o. - Stropy" (org-prefab)
  Project: "Budynek wielorodzinny ABC"
  Status: OPEN
  Value: 0 (będzie zasilony z kalkulacji)
  
Deal: "XYZ Developerzy - Ścianki" (org-builder)
  Project: "Apartamentowiec XYZ"
  Status: WON
  Value: 50000
```

#### Cenniki
```
Cennik: "Standard Produkcja" (org-prefab)
  Reguła: Segment "Produkcja", narzut 1.2, ważna 2026-01-01…2026-12-31
  Reguła: Kategoria "Stropy" >100 szt, narzut 1.3, priorytet 20
Cennik: "Rabat 2026" (org-prefab)
  Reguła: Narzut 1.1 dla całego cencika, ważna 2026-10-01…2026-10-31
```

#### Pliki testowe (XLSX/CSV)
```
- good-calc.xlsx: 10 wierszy, UTF-8, poprawne dane
- bad-calc.xlsx: 100 wierszy, wiersze 25/50 bez ilości
- large-calc.xlsx: 5000 wierszy
- encoding-utf16.xlsx: kodowanie UTF-16 LE, polskie znaki
- csv-semicolon.csv: separator ;
- csv-with-formulas.xlsx: formuły w kolumnach
```

#### Harmonogramy
```
Gantt "Oferta ABC": 
  - Zadanie "Projekt" (2026-10-20…11-20)
    - "Produkcja" (2026-10-20…11-10, zależy od Projekt FS+5 dni)
    - "Transport" (2026-11-11…11-15)
    - "Montaż" (2026-11-16…11-20, zależy od Transport FS)
```

---

## 6. Wnioski do speki

### Luki i niejasności znalezione w wymaganiach

1. **Zaokrąglenia — standard nie sprecyzowany**
   - Pytanie: Czy zaokrąglić do 2 miejsc decimalnch (PLN) zawsze?
   - Czy przy sumowaniu linii: sum(zaokrąglone) = zaokrąglona(sum)?
   - Zalecenie: Definiować standard IEEE 754 / bankierski z testami

2. **Jednostki miary — konwersja czy ostrzeżenie?**
   - Wymaganie: Zmiana j.m. (m³→m²) ostrzega, ale nie przelicza
   - Niejasność: Czy system ma wiedzieć o konwersjach (m³=1000 litrów)?
   - Zalecenie: Definiować m-m mapa konwersji, jeśli konwersja obsługiwana

3. **Multitenant — organizacja vs firma czy to osobne encje?**
   - Wymaganie mówi o "firmie" i "organizacji" zamiennie
   - Pytanie: Czy `organization` (z CRM) = `firma` (biznesowa)?
   - Zalecenie: Definiować mapping entity w speke

4. **Dopasowanie inwestycji — ID przetargowe, priorytet źródeł**
   - Wymaganie: eZamówienia, TED, BIP, NIP+nazwa, własny kod
   - Niejasność: Jaki jest priorytet? (e-Zamówienia > TED > BIP > NIP+nazwa?)
   - Zalecenie: Zdefiniować precedencję matching

5. **Harmonogram ofertowy vs wykonawczy — kiedy tworzyć?**
   - Wymaganie: Tworzy się "gdy deal zostanie wygrany"
   - Niejasność: Czy natychmiast, czy na żądanie? Czy z warningiem jeśli różnice?
   - Zalecenie: Definiować trigger (event) i transformacja reguł

6. **Poziomy dostępu do marży — gdy deal zamknięty**
   - Wymaganie: "Marża zaakceptowanej wersji widoczna po zamknięciu → konfiguracja"
   - Niejasność: Czy to applies do wszystkich ról, czy tylko wybranych?
   - Zalecenie: Definiować per rola + ustawienie firmy interakcja

7. **Limity rozmiaru i wydajności — budżety nie podane**
   - Wymaganie: "rozsądne limity", <100 ms dla 5000 wierszy
   - Niejasność: Co to rozsądne? Czy 5MB OK, czy 10MB?
   - Zalecenie: Zdefiniować konkretne limity w spec (5MB XLSX, 5000 wierszy)

8. **Import złych danych — co to "błędny wiersz"?**
   - Wymaganie: Złe dane wyróżnione, import ciąg dalszy
   - Niejasność: Czy brak ilości = błąd? Brak jednostki? Ujemna wartość?
   - Zalecenie: Definiować validator reguł per kolumna + fallback strategy

9. **Narzut — czy to koszt-addition czy multiplikator?**
   - Wymaganie: "Narzut na koszt" (mnożnik), "Narzut cenowy" (mnożnik)
   - Niejasność: Czy "30% narzutu" = ×1.30 czy +0.30?
   - Zalecenie: Sprecyzować notację (sempre 1+procent, nigdy +procent)

10. **Audyt zmian — które pola auditować?**
    - Wymaganie: Zmiana oferty głównej auditowana
    - Niejasność: Czy każda zmiana ceny auditowana? Narzutu? Jednostki?
    - Zalecenie: Zdefiniować listę auditowanych pól per entity

### Rekomendacje dla następnych faz

- **Faza 2**: Integracje Sekocenbud/Intercenbud, mapowanie kodów KNR/KNNR
- **Faza 3**: MS Project import/export, webhooki zmian dat, adaptery ERP
- **Infrastruktura**: Decyzja Redis vs SQLite cache, monitoring RAM dla Gantt 500+

---

## 7. Podsumowanie

| Metryka | Wartość |
|---------|---------|
| Całkowita liczba scenariuszy | 62 |
| Scenariusze P0 | 14 |
| Scenariusze P1 | 32 |
| Scenariusze P2 | 16 |
| Obszary pokrytia | 8 (Kalkulacja, Import/eksport, Powiązania, Wersje, Cenniki, Uprawnienia, Koszty, Harmonogram) |
| Poziomy testów | 5 (Unit, Integration, API, E2E, Wydajność) |
| Liczba wniosków do speki | 10 |
| Liczba niejasności wymagań | 10 |
| Rekomendacje kolejnych faz | 3 |

---

## 8. Podsumowanie techniczne

**Ścieżka pliku**: `.ai/specs/2026-10-19-costing-schedule-test-plan.md`

**SHA commita**: (będzie po git commit)

**URL draft PR**: (będzie po gh pr create)

**Liczba scenariuszy**: 62 (TC-COST-001…022, TC-DEAL-001…008, TC-VER-001…006, TC-PRICE-001…004, TC-PERM-001…006, TC-REAL-001…002, TC-GANTT-001…006)

**Top 5 wniosków do speki**:
1. Zaokrąglenia — standard IEEE 754 / bankierski z testami
2. Multitenant mapping: `organization` ≡ `firma` (wyjaśnić entity model)
3. Dopasowanie inwestycji — priorytet źródeł ID przetargowych (eZamówienia > TED > BIP)
4. Harmonogram ofertowy→wykonawczy — trigger event i transformacja reguł
5. Audyt pól — lista kompletna auditowanych kolumn per entity

CEZ:DONE
