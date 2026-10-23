# Niezależny plan testów — Realizacja projektu i dokumentacja (`project_delivery`)

**Dokument**: SPEC ONLY (plan testów niezależny od specyfikacji modułu, brak kodu)
**Docelowa ścieżka w repo**: `.ai/specs/2026-10-23-project-delivery-docs-test-plan.md`
**Data**: 2026-10-23
**Autor**: Grok Bot (runner planu testów; specyfikacji modułu nie czytał)
**Rewizja**: rev 3 (2026-10-23) — rejestr z commita 4f83bd4: bufor tylko w RAM (partSize × queueSize), zero plików tymczasowych także w workerze, współbieżność 1 tylko dla kolejki modułu, dwa parametry presji RAM; PoC dostawcy domyślnego jako kryterium akceptacji etapu kodu z fallbackiem na B2; poprzednio rev 2 — rejestr finalny (akceptacje, worker, linki, dostawca storage, warianty, retencja)
**Podstawa**: rejestr decyzji (`.ai/decisions.md`, wersja finalna z 2026-10-23, sekcja modułu `project_delivery`), research `om-project-docs-research.md`, `odoo-project-docs.md`, `om-overlap-audit.md`, dokumentacja Backblaze B2 S3-Compatible API (stan na X 2026; dotyczy dostawcy zapasowego). Numery decyzji występują wyłącznie w załączniku pokrycia.
**Dostawca storage**: „dostawca domyślny” = najtańszy w UE dostawca w pełni kompatybilny z `storage_s3` i multipartem (wg rejestru: OVHcloud Object Storage, region i klasa jako parametry wdrożenia); „dostawca zapasowy” = Backblaze B2 EU Central z adapterem bez `If-None-Match` (wyłącznie unikalne klucze). Scenariusze storage przechodzą dla obu; różnice opisane w scenariuszu.

---

## Liczniki scenariuszy

| Obszar | Liczba scenariuszy |
|--------|-------------------|
| Projekt z wygranego przetargu (TC-PD-PRJ) | 8 |
| Kamienie milowe (TC-PD-MS) | 4 |
| Dokumenty i foldery (TC-PD-DOC) | 5 |
| Rewizje dokumentów (TC-PD-REV) | 5 |
| Przepływ plików i storage (TC-PD-STOR) | 9 |
| Quota (TC-PD-QUOTA) | 5 |
| Retencja i usuwanie (TC-PD-RET) | 6 |
| Import e-Zamówienia / TED (TC-PD-IMP) | 5 |
| Worker importu (TC-PD-WRK) | 7 |
| Pamięć i wydajność (TC-PD-PERF) | 3 |
| Uprawnienia i ACL (TC-PD-ACL) | 5 |
| Linki udostępniania (TC-PD-SHARE) | 3 |
| Bez modułu harmonogramu (TC-PD-NOSCHED) | 4 |
| Kontrakty DI między modułami (TC-PD-DI) | 5 |
| PoC storage (kryterium akceptacji etapu kodu): dostawca domyślny i zapasowy B2 (TC-PD-POC) | 7 |
| Dyski i bucket klienta (TC-PD-EXT) | 3 |
| Akceptacje (TC-PD-APR) | 4 |
| Zakres v1: rysunki, transmittale, korespondencja, protokoły (TC-PD-FLOW) | 4 |
| Zakres v2 (TC-PD-ADV) | 3 |
| Ryzyka prawne — brak funkcji (TC-PD-LEGAL) | 1 |
| Izolacja multi-tenant (TC-PD-TEN) | 3 |
| Bezpieczeństwo plików (TC-PD-SEC) | 4 |
| **Razem** | **103** |

---

## 1. Zakres i priorytety (macierz ryzyka)

### 1.1. Ryzyka i ich mapowanie

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Wyczerpanie RAM lub dysku VPS przez duże pliki (plik w pamięci procesu, plik tymczasowy, plik przez proxy aplikacji) | Wysoki | Krytyczny | P0 | Storage, import, worker | TC-PD-STOR-001..005, TC-PD-IMP-002, TC-PD-WRK-*, TC-PD-PERF-* |
| R2 | Utrata lub nadpisanie dokumentu (rewizja zmieniona, automatyczne usunięcie, DeleteObject z workera) | Średni | Krytyczny | P0 | Rewizje, retencja | TC-PD-REV-*, TC-PD-RET-*, TC-PD-POC-003, TC-PD-POC-005 |
| R3 | Produkcja ze starej rewizji rysunku | Średni | Krytyczny | P0 | Rewizje, v1 | TC-PD-REV-003, TC-PD-FLOW-001, TC-PD-APR-002 |
| R4 | Wyciek dokumentów (ACL, cudzy tenant, presigned URL, link bez wygaśnięcia) | Średni | Krytyczny | P0 | ACL, share, tenant | TC-PD-ACL-*, TC-PD-SHARE-*, TC-PD-TEN-*, TC-PD-SEC-004 |
| R5 | Duplikat projektu albo projekt utworzony automatycznie | Średni | Wysoki | P0 | Projekt | TC-PD-PRJ-002, TC-PD-PRJ-004 |
| R6 | Niekontrolowany koszt storage (quota, osierocone obiekty, niedokończone multiparty) | Średni | Wysoki | P1 | Quota, worker | TC-PD-QUOTA-*, TC-PD-WRK-006, TC-PD-STOR-008 |
| R7 | Sprzężenie modułów (import między modułami, HTTP, awaria przy braku harmonogramu) | Średni | Wysoki | P1 | DI, bez harmonogramu | TC-PD-DI-*, TC-PD-NOSCHED-* |
| R8 | Niezgodność dostawcy (domyślnego albo zapasowego B2) z S3 wykryta dopiero w kodzie | Wysoki | Wysoki | P0 | PoC | TC-PD-POC-* |
| R9 | Sekrety storage w repo lub w ustawieniach organizacji | Niski | Krytyczny | P0 | Konfiguracja | TC-PD-STOR-006 |
| R10 | Ataki plikowe (zip bomb, path traversal, SSRF, XSS przez podgląd) | Średni | Krytyczny | P0 | Bezpieczeństwo | TC-PD-SEC-*, TC-PD-IMP-005 |

### 1.2. Poza zakresem

- Własny Gantt w module (harmonogram wykonawczy należy do modułu harmonogramu; tu testujemy tylko link, uruchomienie i brak modułu).
- E-dziennik budowy, wyliczanie terminów rękojmi i zabezpieczenia z przepisów, ustawowe okresy przechowywania (ryzyka prawne, nie funkcje; tylko negatywny TC-PD-LEGAL-001).
- Pobieranie dokumentów z platform innych niż e-Zamówienia (platformazakupowa.pl, eB2B, SmartPZP) — tylko link.
- Testy konkretnych bibliotek (klient S3, parser ZIP, przeglądarka PDF): plan testuje zachowanie, nie pakiety. Wyjątek: PoC storage (TC-PD-POC-*), który sprawdza dostawcę domyślnego i zapasowego przed kodem.
- Ceny i wartości limitów (należą do cennika; w testach to parametry ustawiane w fixture).

### 1.3. Etapy (pole „Etap” w scenariuszach)

| Etap | Zakres | Scenariusze |
|------|--------|-------------|
| **Etap kodu — kryterium akceptacji** | PoC dostawcy domyślnego (OVHcloud, UE): warunkowy PUT, presigned PUT/GET, multipart i jego wznawianie; jeśli nie przejdzie — domyślnym zostaje B2 EU Central z adapterem (PoC B2). Scenariusze oznaczone Etap: MVP, bo rozstrzygają dostawcę MVP | TC-PD-POC-001..007 |
| **MVP** | Projekt jawną komendą z wygranej oferty i szablonu; etapy, zadania, kamienie milowe z linkiem do pozycji kalkulacji; foldery z ACL i dziedziczeniem; dokumenty z niemutowalnymi rewizjami na S3 (presigned PUT/GET, multipart); ręczne zatwierdzenie rewizji; podgląd PDF; ręczne pliki i linki; import plików publicznych e-Zamówień (w tym ZIP strumieniowo w workerze), TED tylko metadane i link; wariant storage A z quota (blokada albo dopłata); retencja w ustawieniach i data końca retencji na projekcie; brak usunięcia bez admina; działanie bez modułu harmonogramu; kontrakty DI | wszystkie poza wymienionymi niżej |
| **v1** | Billing % kamieni; link i uruchomienie harmonogramu; linki udostępniania z wygaśnięciem; rejestr rysunków; akceptacje (własna walidacja progów za `ApprovalEngine`); transmittale; korespondencja i RFI; protokoły; Google Drive w trybie linku (wariant B); alerty quota | TC-PD-MS-004, TC-PD-NOSCHED-003, -004, TC-PD-SHARE-*, TC-PD-APR-001, -002, -004, TC-PD-FLOW-*, TC-PD-EXT-001, TC-PD-QUOTA-005, TC-PD-STOR-007 (część v1) |
| **v2** | Gwarancja i rękojmia, dokumenty jakości przy partiach, SharePoint/OneDrive/Nextcloud, bucket klienta, OCR, podgląd DWG, podpis kwalifikowany, silnik `workflows` za tym samym interfejsem, auto-archiwizacja | TC-PD-EXT-002, -003, TC-PD-APR-003, TC-PD-ADV-*, TC-PD-RET-006, TC-PD-STOR-007 (część v2) |

---

## 2. Poziomy testów

| Poziom | Narzędzie | Ścieżka testów | Komenda |
|--------|-----------|----------------|---------|
| **Unit** | Jest | `apps/mercato/src/modules/project_delivery/__tests__/*.test.ts` | `yarn workspace @open-mercato/app test src/modules/project_delivery/__tests__` |
| **Integration / API / E2E/UI** | Playwright | `apps/mercato/src/modules/project_delivery/__integration__/TC-PD-*.spec.ts` | `yarn test:integration` / `yarn test:integration:ephemeral`; `OM_INTEGRATION_MODULES=project_delivery` |
| **Storage** | Playwright + emulator S3 (MinIO lub localstack z profilu `storage-s3`) w ephemeral; buckety testowe u dostawcy domyślnego i zapasowego (B2) tylko w PoC i na wersji testowej | jw. | jw. |
| **Static** | skrypt/lint w CI (graf importów, wyszukiwanie wywołań) | `apps/mercato/src/modules/project_delivery/__tests__/static/*.test.ts` | `yarn test` |
| **Performance / RAM** | skrypt Node/bash: próbkowanie `VmHWM`/`VmRSS` z `/proc/<pid>/status` procesu aplikacji i workera, `docker stats`, inotify na katalogach | manualnie + raport w PR | `yarn dev:profile`; przebieg na instancji testowej |

Zasady:

- Konwencje jak w planie testów kalkulacji: jeden `.spec.ts` na scenariusz z ID w nazwie, fixtures przez API (`crmFixtures`, `authFixtures`), sprzątanie w `finally`, asercje DB przez `pg`, kolejki przez `drainIntegrationQueue`, testy zależne od harmonogramu oznaczone w `meta.ts` (`requiredModules`).
- Role: `superadmin`, `admin`, `employee` i role własne z `createRoleFixture`. Nazwy feature'ów modułu są propozycją speki; w scenariuszach opisane funkcjonalnie („feature tworzenia projektu”, „feature administracji dokumentami”).
- Ruch do S3 w testach Integration idzie do emulatora; przeglądarka Playwright wysyła pliki bezpośrednio na adres emulatora. Asercja „bez proxy aplikacji” = brak żądań z treścią pliku do hosta aplikacji (nasłuch `page.on('request')` + liczniki bajtów procesu aplikacji).
- Proxy logujące S3 (cienki proxy HTTP przed emulatorem, tylko w testach) zapisuje metodę i operację każdego żądania; służy do asercji „zero DeleteObject/DeleteObjects”, „`If-None-Match: *` przy zapisie u dostawcy domyślnego / brak nagłówka w adapterze B2”, „brak GetObject z procesu aplikacji”. Emulator uruchamiany w dwóch profilach: zgodny (warunkowy zapis obsługiwany) i „B2” (nagłówek odrzucany z 501).
- Limity (rozmiar pliku, quota, rozmiar ZIP, timeout, współczynnik kompresji) są parametrami ustawianymi w fixture na małe wartości testowe; plan nie przyjmuje wartości produkcyjnych.
- Asercje komunikatów UI na locale `pl`, klucze i18n z tłumaczeniem `en`.

---
## 3. Scenariusze testowe: Projekt z wygranego przetargu (TC-PD-PRJ) — 8 TC

#### TC-PD-PRJ-001: Utworzenie projektu jawną komendą z wygranej oferty głównej

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + E2E/UI + `pg`
- **Warunki wstępne**: Deal D-A z `closure_outcome = 'won'`; inwestycja I1 (`pc_investments`); wysłana wersja kalkulacji V1 ze snapshotem oferty, rola oferty `primary`; szablon segmentu „prefabrykacja” (3 etapy, 2 kamienie milowe, drzewo folderów z folderem przetargowym); użytkownik z feature'em tworzenia projektu
- **Kroki**:
  1. Na dealu kliknij „Wygrany przetarg → realizacja”, wybierz szablon segmentu, potwierdź
  2. Odczytaj projekt przez API i `pg`
  3. Zmień nazwę deala i dane wersji źródłowej (nowa rewizja kalkulacji), odczytaj projekt ponownie
- **Oczekiwane wyniki**:
  - Krok 1: 201, projekt z ID; przekierowanie na projekt
  - Krok 2: zapisane `deal_id`, `winning_offer_version_id` = V1, `investment_id` = I1 oraz snapshot (nazwa deala, numer wersji, wartość oferty, waluta, nazwa inwestycji); etapy, kamienie i foldery skopiowane z szablonu; tenant i organizacja z kontekstu
  - Krok 3: snapshot bez zmian; ID nadal wskazują na pierwotne rekordy
  - Wpis w `audit_logs` (komenda), zdarzenie utworzenia projektu w zakresie organizacji

#### TC-PD-PRJ-002: Drugi projekt dla tej samej oferty głównej → 409 z ID istniejącego

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Jak TC-PD-PRJ-001, projekt P1 już istnieje dla (D-A, V1, I1); deal D-B wygrany z ofertą główną V2 na inwestycji I2 bez projektu
- **Kroki**:
  1. API: wywołaj komendę dla (D-A, V1, I1) ponownie (UI i API)
  2. API: wyślij równolegle dwa żądania komendy dla (D-B, V2, I2)
  3. `pg`: policz projekty dla obu kluczy; sprawdź istnienie częściowego indeksu unikalnego na kluczu projektu
- **Oczekiwane wyniki**:
  - Krok 1: 409, w treści ID P1; P1 bez zmian; w UI komunikat z linkiem do P1
  - Krok 2: jedno żądanie 201, drugie 409 z ID projektu utworzonego przez pierwsze
  - Krok 3: dokładnie jeden projekt na każdy klucz; indeks unikalny częściowy istnieje (ochrona na poziomie bazy, nie tylko w kodzie)

#### TC-PD-PRJ-003: Komenda odrzucona dla deala niewygranego i oferty niegłównej

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Unit (walidator)
- **Warunki wstępne**: Deal otwarty, deal przegrany, deal wygrany z wersją `alternative`, deal wygrany z wersją roboczą bez snapshotu, deal wygrany bez wersji kalkulacji
- **Kroki**:
  1. Wywołaj komendę dla każdego przypadku
- **Oczekiwane wyniki**:
  - Każdy przypadek: 422 z kodem błędu i czytelnym komunikatem `pl`; brak rekordu projektu, brak folderów i obiektów w S3
  - Przycisk komendy w UI niewidoczny albo nieaktywny z podpowiedzią przyczyny

#### TC-PD-PRJ-004: Brak automatycznego tworzenia projektu (n8n, subscriber)

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Deal z ofertą główną; moduł włączony
- **Kroki**:
  1. Zmień `closure_outcome` na `won` przez UI, potem przez API tak jak robi to n8n (push przetargu z wynikiem)
  2. `drainIntegrationQueue`; odczekaj przetworzenie wszystkich subscriberów
  3. Policz projekty
- **Oczekiwane wyniki**:
  - Zero projektów; zdarzenie wygrania deala nie wywołuje komendy
  - Na dealu widoczna akcja „Wygrany przetarg → realizacja” (projekt tworzy człowiek)

#### TC-PD-PRJ-005: Powiązania jako ID bez constraintu DB + snapshot

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Projekt P1 z TC-PD-PRJ-001
- **Kroki**:
  1. `pg`: sprawdź `information_schema.table_constraints` dla tabel z prefiksem `pd_`
  2. Usuń (soft delete) deal D-A; odczytaj P1 w UI i API
  3. Wyłącz moduł kalkulacji w organizacji (jeśli dostępne) albo zasymuluj brak wersji V1; odczytaj P1
- **Oczekiwane wyniki**:
  - Krok 1: brak kluczy obcych z `pd_*` do tabel deali, kalkulacji i inwestycji
  - Krok 2–3: P1 otwiera się; dane z snapshotu; oznaczenie „rekord źródłowy niedostępny” zamiast błędu 500

#### TC-PD-PRJ-006: Szablon per segment kopiowany w chwili utworzenia

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Szablony dwóch segmentów z różnymi drzewami folderów, etapami i kamieniami
- **Kroki**:
  1. Utwórz projekt z szablonu S1, potem projekt z S2 (inne deale)
  2. Zmień szablon S1 (dodaj folder, usuń etap)
  3. Odczytaj projekt z S1
- **Oczekiwane wyniki**:
  - Krok 1: każdy projekt ma strukturę swojego szablonu
  - Krok 3: istniejący projekt bez zmian (kopia, nie odwołanie); nowe projekty dostają zmieniony szablon
  - ACL folderów z szablonu skopiowane jako ACL folderów projektu

#### TC-PD-PRJ-007: Etapy i zadania bez Gantta

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Projekt z szablonu
- **Kroki**:
  1. Dodaj zadanie z terminem, przypisz dwie osoby, dodaj podzadanie
  2. Zmień status zadania i etap projektu niezależnie
  3. Sprawdź widoki projektu
- **Oczekiwane wyniki**:
  - Zadania i podzadania zapisane; status zadania odrębny od etapu projektu
  - W module brak widoku Gantta i edycji zależności na osi czasu (harmonogram jest w module harmonogramu)

#### TC-PD-PRJ-008: Deal ponownie otwarty po utworzeniu projektu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Warunki wstępne**: Projekt P1 dla deala D-A
- **Kroki**:
  1. Otwórz ponownie deal D-A (`closure_outcome` zmieniony z `won`)
  2. Ponownie oznacz deal jako wygrany i wywołaj komendę
- **Oczekiwane wyniki**:
  - Krok 1: P1 nie jest usuwany ani archiwizowany automatycznie; w projekcie widoczne oznaczenie, że deal źródłowy nie jest już wygrany
  - Krok 2: 409 z ID P1 (jak TC-PD-PRJ-002)

---

## 4. Scenariusze testowe: Kamienie milowe (TC-PD-MS) — 4 TC

#### TC-PD-MS-001: Kamień milowy linkuje pozycję albo sekcję zwycięskiej wersji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Projekt P1, wersja V1 z sekcją „Słupy” i pozycją „Słup S1”
- **Kroki**:
  1. Podlinkuj kamień „Odbiór częściowy 1” do sekcji „Słupy”, kamień „Odbiór końcowy” do pozycji „Słup S1”
  2. W nowej rewizji kalkulacji zmień nazwę sekcji
  3. Odczytaj kamienie
- **Oczekiwane wyniki**:
  - Zapisane ID pozycji/sekcji oraz snapshot etykiety
  - Po kroku 2 kamień pokazuje etykietę ze snapshotu (z V1); link nadal wskazuje element V1

#### TC-PD-MS-002: Link do elementu spoza zwycięskiej wersji odrzucony

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API
- **Kroki**:
  1. Podlinkuj kamień do pozycji z innej wersji tego samego deala, z wersji innego deala, z wersji innej organizacji
- **Oczekiwane wyniki**:
  - Inna wersja i inny deal: 422; inna organizacja: 404 (bez ujawniania istnienia); brak zapisu

#### TC-PD-MS-003: Osiągnięcie kamienia milowego

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Kroki**:
  1. Oznacz kamień jako osiągnięty; cofnij oznaczenie (undo komendy)
- **Oczekiwane wyniki**:
  - Zapis daty osiągnięcia i autora; wpis w `audit_logs`; undo przywraca stan poprzedni

#### TC-PD-MS-004: Procent rozliczenia przy odbiorach częściowych

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit + API
- **Warunki wstępne**: Trzy kamienie podlinkowane do tej samej pozycji
- **Kroki**:
  1. Ustaw procenty 30, 30, 40; potem zmień trzeci na 50
  2. Ustaw procent ujemny i powyżej 100
- **Oczekiwane wyniki**:
  - Krok 1: suma 100 przyjęta; suma 110 odrzucona (422) z komunikatem o przekroczeniu
  - Krok 2: 422
  - Kwota rozliczenia liczona od wartości pozycji ze snapshotu zwycięskiej wersji, zaokrąglenie half-up jak w kalkulacji

---

## 5. Scenariusze testowe: Dokumenty i foldery (TC-PD-DOC) — 5 TC

#### TC-PD-DOC-001: Dokument z ręcznego pliku — metadane w OM, plik w S3

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + E2E/UI + `pg` + proxy S3
- **Warunki wstępne**: Projekt P1; partycja `projectDocs` skonfigurowana na emulatorze S3 (prywatna)
- **Kroki**:
  1. W folderze „Umowa” dodaj plik PDF przez UI
  2. Odczytaj metadane przez API i `pg`; odczytaj obiekt przez proxy S3
- **Oczekiwane wyniki**:
  - Metadane: projekt, folder, typ dokumentu, nazwa, rozmiar, MIME, sha256, autor, data, klucz obiektu, partycja `projectDocs`
  - Obiekt istnieje w buckecie pod kluczem z prefiksem tenanta, organizacji i projektu; bucket i obiekt prywatne (anonimowy GET → 403)
  - Rozmiar w metadanych = rozmiar z HeadObject (nie z deklaracji przeglądarki)

#### TC-PD-DOC-002: Dokument-link (ręczny link zewnętrzny)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Dodaj dokument jako link `https://…` z nazwą i typem
  2. Spróbuj dodać link `javascript:`, `file:`, `http://localhost`, adres z sieci prywatnej
- **Oczekiwane wyniki**:
  - Krok 1: dokument typu link, brak obiektu w S3, brak wpływu na quota; otwarcie w nowej karcie z `rel="noopener noreferrer"`
  - Krok 2: 422 dla schematów innych niż `https` (i `http`, jeśli speka dopuści); link nie jest pobierany przez serwer

#### TC-PD-DOC-003: Podgląd PDF przez presigned GET

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: E2E/UI + proxy S3
- **Kroki**:
  1. Otwórz podgląd PDF; otwórz dokument DWG
  2. Rejestruj żądania przeglądarki i proxy S3
- **Oczekiwane wyniki**:
  - PDF wyświetlony w przeglądarce z presigned GET (inline, `Content-Type: application/pdf`); żadne żądanie z treścią pliku nie trafia do hosta aplikacji; proces aplikacji nie wykonuje GetObject
  - DWG: tylko „Pobierz” (attachment), bez podglądu

#### TC-PD-DOC-004: Brak OCR, miniatur i ekstrakcji treści po stronie serwera w MVP

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Wgraj PDF i skan JPG do `projectDocs`; `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Brak zadań OCR, miniatur i ekstrakcji tekstu dla partycji; brak GetObject z procesu aplikacji i workera; JPG bez zmniejszania rozdzielczości (sha256 obiektu = sha256 pliku źródłowego)

#### TC-PD-DOC-005: Foldery — drzewo, przenoszenie, nazwy

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Kroki**:
  1. Utwórz podfolder, przenieś do niego dokument, zmień nazwę folderu (polskie znaki, `/`, bardzo długa nazwa)
- **Oczekiwane wyniki**:
  - Przeniesienie i zmiana nazwy zmieniają tylko metadane; klucze obiektów w S3 bez zmian (brak CopyObject i DeleteObject)
  - Niedozwolone znaki i za długa nazwa → 422

---

## 6. Scenariusze testowe: Rewizje dokumentów (TC-PD-REV) — 5 TC

#### TC-PD-REV-001: Nowy plik = nowa rewizja, poprzednia nietknięta

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg` + proxy S3
- **Warunki wstępne**: Dokument z rewizją R0 (plik A)
- **Kroki**:
  1. Wgraj plik B jako nową wersję dokumentu
  2. Spróbuj przez API zmienić plik, rozmiar, hash, klucz albo autora R0 (PUT/PATCH na rewizję)
  3. Porównaj R0 przed i po
- **Oczekiwane wyniki**:
  - Krok 1: powstaje R1 z nowym kluczem obiektu; R0 ma ten sam klucz, sha256 i rozmiar; obiekt R0 nadal pobieralny
  - Krok 2: 405 albo 409/422; brak zmian w `pg` i w buckecie (brak PutObject na klucz R0)
  - Dokument wskazuje R1 jako najnowszą

#### TC-PD-REV-002: Klucz obiektu nowej rewizji nie może trafić w istniejący obiekt

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration + proxy S3 (oba profile emulatora)
- **Kroki**:
  1. Zażądaj presigned URL dla nowej rewizji 1000 razy (Unit: generator kluczy); sprawdź unikalność
  2. Spróbuj podać własny klucz albo ścieżkę w żądaniu presign (`../`, klucz R0)
  3. Zakończ upload deklarując rozmiar i sha256 niezgodne z obiektem
  4. Profil zgodny: wyślij drugi raz presigned PUT na klucz już zapisanej rewizji (ten sam URL)
- **Oczekiwane wyniki**:
  - Krok 1: klucze generuje serwer, unikalne, z losowym składnikiem
  - Krok 2: klucz z żądania ignorowany albo 422
  - Krok 3: rewizja nie powstaje (422); obiekt zostaje oznaczony jako osierocony do decyzji admina (nie usuwany automatycznie)
  - Krok 4 (dostawca domyślny): 412 Precondition Failed; obiekt bez zmian — zapis warunkowy `If-None-Match: *` w PutObject i presigned PUT
  - Profil „B2” (adapter): żaden PutObject nie zawiera `If-None-Match`; brak 501; ochrona wyłącznie przez unikalne klucze generowane przez serwer (krok 1–2)

#### TC-PD-REV-003: Do produkcji tylko najnowsza zatwierdzona rewizja (zatwierdzenie ręczne)

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration + E2E/UI
- **Warunki wstępne**: Dokument z R0 (zatwierdzona), użytkownik z feature'em zatwierdzania
- **Kroki**:
  1. Wgraj R1 (niezatwierdzona); odczytaj rewizję „do produkcji” (API i kontrakt DI)
  2. Zatwierdź R1 ręcznie; odczytaj ponownie
  3. Spróbuj zatwierdzić R0 ponownie jako produkcyjną
  4. Użytkownik bez feature'a zatwierdza R1
- **Oczekiwane wyniki**:
  - Krok 1: do produkcji R0; R1 oznaczona „niezatwierdzona”
  - Krok 2: do produkcji R1; R0 oznaczona „zastąpiona” (status, nie zmiana pliku)
  - Krok 3: odrzucone albo bez wpływu — do produkcji pozostaje najnowsza zatwierdzona R1
  - Krok 4: 403
  - Zatwierdzenie zapisane w `audit_logs` (kto, kiedy, która rewizja)

#### TC-PD-REV-004: Audyt operacji na rewizjach

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Wgraj, zatwierdź, pobierz (wydanie presigned GET), przenieś dokument
- **Oczekiwane wyniki**:
  - Każda operacja w `audit_logs` z użytkownikiem i rewizją; wpis pobrania nie zawiera pełnego presigned URL (bez podpisu)

#### TC-PD-REV-005: Równoległe wgranie dwóch rewizji tego samego dokumentu

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Dwóch użytkowników kończy upload nowej rewizji tego samego dokumentu w tym samym momencie
- **Oczekiwane wyniki**:
  - Dwie rewizje z kolejnymi, różnymi numerami; brak duplikatu numeru (constraint); żadna nie nadpisuje drugiej; najnowsza = później zakończona

---
## 7. Scenariusze testowe: Przepływ plików i storage (TC-PD-STOR) — 9 TC

#### TC-PD-STOR-001: Mały plik — presigned PUT z przeglądarki bezpośrednio do S3

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + proxy S3
- **Kroki**:
  1. Wgraj plik poniżej progu multipart; rejestruj żądania przeglądarki (`page.on('request')`), proxy S3 i liczniki bajtów odebranych przez proces aplikacji
- **Oczekiwane wyniki**:
  - Przeglądarka: żądanie do API aplikacji po URL (bez treści pliku), PUT treści na host S3, żądanie zakończenia do API (bez treści)
  - Bajty odebrane przez proces aplikacji ≪ rozmiar pliku (tylko JSON metadanych)
  - Presigned PUT ma krótką ważność, podpisany `Content-Type` i (jeśli dostawca pozwala) długość; PUT z innym `Content-Type` → 403
  - Dostawca domyślny: presigned PUT podpisany z `If-None-Match: *`; adapter B2: bez tego nagłówka

#### TC-PD-STOR-002: Duży plik — multipart z przeglądarki przez presigned URL części

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + Integration + proxy S3
- **Warunki wstępne**: Plik testowy powyżej progu multipart (próg i rozmiar części to parametry); CORS bucketu z `ExposeHeaders: ETag`
- **Kroki**:
  1. Rozpocznij upload: API tworzy multipart i zwraca presigned URL części
  2. Wyślij połowę części; przerwij (zamknij kartę); otwórz ponownie i wznów
  3. Zakończ upload
  4. Rozpocznij drugi upload i anuluj go w UI
- **Oczekiwane wyniki**:
  - Krok 1–3: części wysyłane przez przeglądarkę na host S3; wznowienie korzysta z listy wysłanych części (ListParts), nie wysyła ich ponownie; CompleteMultipartUpload z ETagami części; jeden obiekt, sha256 zgodny z plikiem
  - Krok 4: AbortMultipartUpload; brak obiektu i niedokończonego uploadu w ListMultipartUploads
  - Proces aplikacji nie odbiera treści części; brak żądań z treścią do hosta aplikacji

#### TC-PD-STOR-003: Pobranie przez presigned GET

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI + proxy S3
- **Kroki**:
  1. Pobierz plik o nazwie z polskimi znakami i spacją („Protokół odbioru – część 1.pdf”)
  2. Użyj tego samego URL po upływie ważności
  3. Zmień w URL parametr `response-content-disposition` lub klucz
- **Oczekiwane wyniki**:
  - Krok 1: odpowiedź API to przekierowanie albo URL; plik pobrany prosto z S3 z `Content-Disposition: attachment; filename*=UTF-8''…` i poprawną nazwą
  - Krok 2: 403 z S3
  - Krok 3: 403 (podpis nieważny)
  - Proces aplikacji nie wykonuje GetObject (proxy S3)

#### TC-PD-STOR-004: Ścieżki buforujące `storage_s3` nieużywane dla `projectDocs`

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Static + Integration
- **Kroki**:
  1. Static: wyszukaj w module wywołania odczytu sterownika S3 zwracające cały plik oraz użycia trasy `signed-upload/[token]`
  2. Integration: wyślij plik na trasę `signed-upload/[token]` z tokenem dla partycji `projectDocs`; wywołaj ogólne pobieranie załącznika dla dokumentu projektu
- **Oczekiwane wyniki**:
  - Krok 1: zero użyć w kodzie modułu
  - Krok 2: odmowa (4xx) dla partycji `projectDocs`; żaden fragment pliku nie trafia do pamięci procesu aplikacji (RSS bez skoku, TC-PD-PERF-001)

#### TC-PD-STOR-005: Brak plików projektu na dysku VPS

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Performance (inotify)
- **Warunki wstępne**: inotify (create/write) na: wolumenie załączników aplikacji, `os.tmpdir()` aplikacji i workera, katalogu cache miniatur, katalogu roboczym procesu
- **Kroki**:
  1. Wykonaj pełny cykl: upload mały i multipart, podgląd, pobranie, import pojedynczych plików i ZIP z e-Zamówień
- **Oczekiwane wyniki**:
  - Zero nowych plików i zero zapisów w obserwowanych katalogach (poza logami aplikacji) — także w procesie workera (`queue worker --all`); żadnego „małego bufora” na dysku
  - Bufor danych wyłącznie w RAM (rozmiar ograniczony w TC-PD-PERF-002)
  - Zużycie wolumenu załączników bez zmian

#### TC-PD-STOR-006: Endpoint, region i bucket z env/ustawień; brak sekretów w repo i ustawieniach

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static + Integration
- **Kroki**:
  1. Static: skan repo i obrazu (gitleaks lub równoważny) pod kątem kluczy S3; sprawdź `.env.example` (tylko nazwy zmiennych, puste wartości)
  2. Uruchom aplikację z endpointem emulatora, potem z innym endpointem, regionem i bucketem (zmiana tylko przez env/ustawienia)
  3. Odczytaj ustawienia organizacji przez API i `pg`
  4. Uruchom bez kluczy dostępowych
- **Oczekiwane wyniki**:
  - Krok 1: zero sekretów; zero zakodowanych endpointów i nazw bucketów w kodzie modułu
  - Krok 2: zapis i odczyt działają z każdą konfiguracją bez zmian kodu (dowolny dostawca zgodny z S3)
  - Krok 3: ustawienia zawierają najwyżej endpoint, region, bucket i wariant; brak access key i secret w odpowiedzi i w `module_configs`
  - Krok 4: health storage zgłasza błąd konfiguracji, upload zwraca czytelny błąd 503, bez wycieku konfiguracji w treści

#### TC-PD-STOR-007: Wybór wariantu storage A albo B w ustawieniach organizacji

- **Priorytet**: P1 | **Etap**: MVP (A), v1 (B: Google Drive link), v2 (B: bucket klienta, SharePoint/OneDrive/Nextcloud) | **Poziom**: API + E2E/UI
- **Kroki**:
  1. MVP: admin otwiera ustawienia modułu; próbuje ustawić wariant B przez UI i API
  2. v1: admin ustawia wariant B z Google Drive (link); użytkownik dodaje dokument
  3. v2: admin ustawia wariant B z bucketem klienta
  4. Employee próbuje zmienić wariant
- **Oczekiwane wyniki**:
  - Krok 1: domyślnie A; opcja B niedostępna (wyszarzona z opisem); API 422
  - Krok 2: dokumenty jako linki do Drive; nowe pliki nie trafiają do naszego bucketu; quota wariantu A nie rośnie
  - Krok 3: nowe obiekty w buckecie klienta; poświadczenia poza repo i ustawieniami (TC-PD-EXT-003)
  - Krok 4: 403
  - Zmiana wariantu nie przenosi ani nie usuwa istniejących plików

#### TC-PD-STOR-008: Osierocone obiekty i niedokończone uploady bez automatycznego usuwania

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Wykonaj presigned PUT bez wywołania zakończenia; rozpocznij multipart i porzuć go
  2. Uruchom zadania porządkowe modułu
- **Oczekiwane wyniki**:
  - Porzucony multipart: AbortMultipartUpload albo reguła bucketu przerywająca niedokończone uploady (nie jest to usunięcie obiektu)
  - Obiekt bez rewizji: oznaczony na liście „osierocone” do decyzji admina; zero DeleteObject bez potwierdzenia admina
  - Osierocone obiekty liczone w zużyciu quota (albo jawnie wyłączone — wg speki)

#### TC-PD-STOR-009: Limit rozmiaru, dostawca domyślny i zapasowy jako parametry

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + Unit
- **Kroki**:
  1. Ustaw w fixture limit rozmiaru pliku L; zażądaj presign dla pliku o deklarowanym rozmiarze L+1
  2. Zadeklaruj rozmiar mniejszy niż faktyczny i wyślij większy plik
  3. Odczytaj domyślną konfigurację storage (bez nadpisań)
- **Oczekiwane wyniki**:
  - Krok 1: 413 albo 422 przed wydaniem URL; brak multipartu w S3
  - Krok 2: S3 odrzuca nadmiarowe dane (podpisana długość części) albo zakończenie uploadu wykrywa niezgodność i rewizja nie powstaje
  - Krok 3: domyślny dostawca z konfiguracji wdrożenia (OVHcloud, region UE i klasa jako parametry); przełączenie na zapasowy B2 włącza adapter bez `If-None-Match`; limit nie ma wartości zakodowanej w module (pochodzi z konfiguracji)

---

## 8. Scenariusze testowe: Quota (TC-PD-QUOTA) — 5 TC

#### TC-PD-QUOTA-001: Zużycie liczone per organizacja z rozmiaru obiektu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Wgraj trzy pliki (w tym multipart) i dwa linki; wgraj nową rewizję jednego pliku
  2. Odczytaj zużycie organizacji (API i ustawienia)
- **Oczekiwane wyniki**:
  - Zużycie = suma rozmiarów obiektów wszystkich rewizji (z HeadObject); linki = 0
  - Zużycie per organizacja, nie per tenant (druga organizacja tego samego tenanta ma osobny licznik, TC-PD-TEN-002)

#### TC-PD-QUOTA-002: Przekroczenie quota w wariancie A — tryb blokady

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Warunki wstępne**: Wariant A, limit Q (parametr), tryb „blokada”; zużycie bliskie Q
- **Kroki**:
  1. Zażądaj presign dla pliku przekraczającego pozostałe miejsce
  2. Dodaj link; pobierz istniejący plik; zatwierdź rewizję
- **Oczekiwane wyniki**:
  - Krok 1: odmowa przed wydaniem URL (kod błędu quota, komunikat `pl` dla użytkownika i informacja dla admina)
  - Krok 2: działa (blokada dotyczy tylko nowych bajtów w naszym buckecie)

#### TC-PD-QUOTA-003: Przekroczenie quota w wariancie A — tryb dopłaty

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API
- **Warunki wstępne**: Wariant A, limit Q, tryb „dopłata”; cena nadwyżki jako parametr bez wartości w kodzie
- **Kroki**:
  1. Wgraj plik przekraczający Q
  2. Odczytaj stan nadwyżki
- **Oczekiwane wyniki**:
  - Upload przechodzi; zarejestrowana nadwyżka (bajty ponad Q, organizacja, okres) do rozliczenia; admin widzi ostrzeżenie
  - Kod i seed nie zawierają wartości limitu ani ceny (Static)

#### TC-PD-QUOTA-004: Równoległe uploady na granicy limitu (tryb blokady)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Dwóch użytkowników jednocześnie zaczyna multipart, każdy mieści się w pozostałym miejscu osobno, razem nie
- **Oczekiwane wyniki**:
  - Rezerwacja miejsca przy presign: jeden przechodzi, drugi dostaje odmowę quota; po anulowaniu pierwszego rezerwacja zwolniona
  - Zakończony upload większy niż rezerwacja (rozmiar z HeadObject) nie tworzy rewizji ponad limit

#### TC-PD-QUOTA-005: Alerty quota

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Ustaw progi alertu (parametry); przekrocz pierwszy próg, potem drugi
- **Oczekiwane wyniki**:
  - Po jednym powiadomieniu na próg do adminów organizacji (`notifications`); brak duplikatu przy kolejnych uploadach w tym samym progu

---

## 9. Scenariusze testowe: Retencja i usuwanie (TC-PD-RET) — 6 TC

#### TC-PD-RET-001: Ustawienie retencji w organizacji z podpowiedzią „koniec gwarancji i rękojmi”

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Admin otwiera ustawienia modułu, sekcja retencji
  2. Zapisuje regułę domyślną; employee próbuje ją zmienić
- **Oczekiwane wyniki**:
  - Domyślnie zaznaczona podpowiedź „do końca gwarancji i rękojmi”, potem archiwum; opis zaznacza, że okresy wymagają weryfikacji prawnej
  - Employee: 403
  - Ustawienie per organizacja (TC-PD-TEN-002)

#### TC-PD-RET-002: Data końca retencji na projekcie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration + E2E/UI
- **Kroki**:
  1. W projekcie wpisz datę końca gwarancji i datę końca rękojmi; odczytaj podpowiedź daty końca retencji
  2. Nadpisz datę ręcznie
  3. Projekt bez dat gwarancji/rękojmi
- **Oczekiwane wyniki**:
  - Krok 1: podpowiedź = późniejsza z dat (reguła organizacji)
  - Krok 2: data ręczna zapisana, oznaczona jako ręczna, w `audit_logs`
  - Krok 3: pole puste z informacją, czego brakuje; brak błędu

#### TC-PD-RET-003: Upływ daty retencji niczego nie usuwa

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Ustaw datę końca retencji w przeszłości (zegar testowy); uruchom wszystkie zadania okresowe modułu; `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Zero DeleteObject/DeleteObjects; metadane bez zmian; projekt najwyżej oznaczony „po retencji — do decyzji admina”

#### TC-PD-RET-004: Usunięcie dokumentu, rewizji, projektu tylko z potwierdzeniem admina

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI + proxy S3
- **Kroki**:
  1. Employee usuwa dokument; admin usuwa dokument (krok 1: soft delete); admin potwierdza fizyczne usunięcie (krok 2)
  2. Wywołaj API fizycznego usunięcia bez potwierdzenia albo z potwierdzeniem wygasłym
- **Oczekiwane wyniki**:
  - Employee: 403 albo tylko soft delete (wg speki) — w obu przypadkach obiekt w S3 nienaruszony
  - Soft delete: dokument ukryty, obiekt w S3, możliwe przywrócenie
  - DeleteObject wyłącznie po jawnym potwierdzeniu admina, w kontekście żądania admina; wpis w `audit_logs`
  - Krok 2: 4xx, zero DeleteObject

#### TC-PD-RET-005: Workery nigdy nie wywołują DeleteObject

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static + Integration + proxy S3
- **Kroki**:
  1. Static: w kodzie workerów i subscriberów modułu brak wywołań DeleteObject/DeleteObjects (reguła lint albo test grafu wywołań)
  2. Integration: import zakończony sukcesem, błędem, timeoutem i anulowaniem; zadania porządkowe
- **Oczekiwane wyniki**:
  - Krok 1: zero trafień
  - Krok 2: proxy S3 rejestruje zero DeleteObject/DeleteObjects; dozwolone tylko AbortMultipartUpload

#### TC-PD-RET-006: Auto-archiwizacja po retencji

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Projekt po dacie retencji; uruchom proces archiwizacji
- **Oczekiwane wyniki**:
  - Dostawca domyślny: archiwum = eksport albo zimna klasa przechowywania dostępna w regionie (parametr; TC-PD-POC-003)
  - Zapasowy B2 (jedna klasa): archiwum = wyłącznie eksport; opcja klasy niedostępna w UI i API (422)
  - Archiwizacja tylko po potwierdzeniu admina; nigdy usunięcie; projekt tylko do odczytu

---

## 10. Scenariusze testowe: Import e-Zamówienia / TED (TC-PD-IMP) — 5 TC

#### TC-PD-IMP-001: Import publicznych plików postępowania pojedynczo

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration (serwer e-Zamówień podstawiony w teście)
- **Kroki**:
  1. W projekcie uruchom import dla postępowania (ID ocds) z listą trzech plików publicznych
  2. `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Zadanie w workerze (postęp w `progress`); każdy plik strumieniowo z HTTP do S3 (multipart dla dużych); dokumenty w folderze przetargowym ze źródłem (URL, ID postępowania, data pobrania)
  - Brak plików tymczasowych (TC-PD-STOR-005); proces aplikacji nie pobiera plików

#### TC-PD-IMP-002: Duży ZIP z e-Zamówień importowany strumieniowo w workerze

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Performance + proxy S3
- **Warunki wstępne**: ZIP „pobierz wszystkie” z kilkudziesięcioma wpisami (PDF, DOCX, XLSX, katalogi, nazwy z polskimi znakami w UTF-8 i w CP852)
- **Kroki**:
  1. Uruchom import ZIP; obserwuj RSS workera (TC-PD-PERF-002), inotify (TC-PD-STOR-005) i proxy S3
- **Oczekiwane wyniki**:
  - Każdy wpis = dokument z rewizją w folderze odpowiadającym ścieżce w ZIP; nazwy poprawnie zdekodowane
  - Wpisy wysyłane multipartem do S3; RSS ograniczony (TC-PD-PERF-002); zero plików tymczasowych
  - Raport importu: liczba wpisów, pominięte (katalogi, puste, niedozwolone), błędy

#### TC-PD-IMP-003: Dokumentacja na zewnętrznych linkach — tylko link

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Import postępowania, w którym część dokumentacji wskazuje zasób zewnętrzny zamawiającego
- **Oczekiwane wyniki**:
  - Dla zasobów zewnętrznych powstają dokumenty-linki; serwer nie pobiera treści spod tych adresów

#### TC-PD-IMP-004: TED — tylko metadane i link

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration (API TED podstawione)
- **Kroki**:
  1. Import z ogłoszenia TED z polem dokumentów zamówienia (BT-15)
- **Oczekiwane wyniki**:
  - Metadane ogłoszenia i dokument-link do adresu z BT-15; zero obiektów w S3; zero pobrań plików

#### TC-PD-IMP-005: Ponowny import i modyfikacje SWZ

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Zaimportuj postępowanie; zaimportuj ponownie bez zmian; zaimportuj po zmianie jednego pliku (modyfikacja SWZ)
- **Oczekiwane wyniki**:
  - Drugi import: brak duplikatów (rozpoznanie po źródle i sha256)
  - Trzeci: zmieniony plik jako nowa rewizja istniejącego dokumentu; poprzednia rewizja nietknięta

---

## 11. Scenariusze testowe: Worker importu (TC-PD-WRK) — 7 TC

Import ZIP i multipart po stronie serwera idą przez istniejącą kolejkę OM (ProgressJob + worker kolejki). Worker działa jako proces potomny `queue worker --all` w kontenerze `app` i dzieli jego RAM.

#### TC-PD-WRK-001: Worker na istniejącej kolejce OM, bez nowego kontenera

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Static + Integration
- **Kroki**:
  1. Static: porównaj usługi w plikach compose (`docker-compose.fullapp*.yml`) i `Dockerfile` przed i po zmianie
  2. Integration: zadanie importu tworzy `ProgressJob` i przechodzi przez istniejący mechanizm kolejek OM (`drainIntegrationQueue` je przetwarza), tak jak eksport XLSX/PDF w kalkulacji
  3. Na instancji: lista procesów kontenera `app` w trakcie importu
- **Oczekiwane wyniki**:
  - Brak nowej usługi, obrazu i brokera kolejki
  - Import wykonuje proces potomny `queue worker --all` w kontenerze `app`; postęp i wynik w `ProgressJob`
  - Zadanie trwałe (przeżywa restart procesu)

#### TC-PD-WRK-002: Współbieżność 1 na instancję w kolejce importu i multipartu modułu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Performance
- **Kroki**:
  1. Zakolejkuj trzy importy ZIP w jednej instancji; rejestruj czasy startu i końca
  2. Uruchom dwie instancje workera i cztery importy
- **Oczekiwane wyniki**:
  - Krok 1: w danej chwili najwyżej jeden import w instancji (przedziały się nie nakładają)
  - Krok 2: najwyżej jeden import na instancję; każde zadanie przetworzone dokładnie raz

#### TC-PD-WRK-003: Limity rozmiaru jako parametry

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Unit
- **Warunki wstępne**: Parametry w fixture: maksymalny rozmiar ZIP, maksymalny rozmiar wpisu, maksymalna suma po rozpakowaniu, maksymalna liczba wpisów, maksymalny współczynnik kompresji
- **Kroki**:
  1. Uruchom import przekraczający kolejno każdy limit
- **Oczekiwane wyniki**:
  - Przerwanie przy pierwszym przekroczeniu (licznik bajtów w strumieniu, nie deklaracja z nagłówka ZIP); status „błąd” z nazwą limitu w raporcie
  - Wpisy zaimportowane przed przerwaniem: zachowanie wg speki (wszystko albo nic, albo częściowe z raportem) — bez DeleteObject; niedokończony multipart przerwany
  - Wartości limitów pochodzą z konfiguracji (Static: brak liczb zakodowanych w module)

#### TC-PD-WRK-004: Timeout zadania

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Ustaw timeout (parametr) na małą wartość; podstaw źródło HTTP, które wysyła dane bardzo wolno
- **Oczekiwane wyniki**:
  - Zadanie przerwane po timeoucie; AbortMultipartUpload dla otwartych uploadów; status „przekroczony czas” w `progress`; zero DeleteObject
  - Worker przyjmuje kolejne zadanie (brak zawieszenia)

#### TC-PD-WRK-005: Wznawianie albo abort multipartu po restarcie workera

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3
- **Kroki**:
  1. W trakcie importu dużego wpisu zabij proces workera (SIGKILL); uruchom ponownie
- **Oczekiwane wyniki**:
  - Zadanie ponowione: wznowienie od ostatniej potwierdzonej części (stan uploadId i części zapisany) albo abort i ponowienie wpisu od początku — wg speki
  - Brak duplikatów dokumentów i rewizji; brak porzuconych multipartów w ListMultipartUploads po zakończeniu

#### TC-PD-WRK-006: Sprzątanie niedokończonych multipartów

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + PoC
- **Kroki**:
  1. Zostaw niedokończony multipart (symulacja awarii bez restartu zadania); uruchom porządkowanie
- **Oczekiwane wyniki**:
  - Upload przerwany przez AbortMultipartUpload albo regułę bucketu (AbortIncompleteMultipartUpload); obiekty ukończone nietknięte


#### TC-PD-WRK-007: Współbieżność 1 tylko dla kolejki modułu — inne kolejki działają równolegle

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Static
- **Warunki wstępne**: Jedna instancja `queue worker --all`; zadania w kolejce importu/multipartu modułu projektów oraz w innych kolejkach (np. eksport XLSX/PDF kalkulacji, zdarzenia, powiadomienia)
- **Kroki**:
  1. Uruchom długi import ZIP; w trakcie zakolejkuj drugi import oraz po kilka zadań w innych kolejkach; rejestruj czasy startu i końca każdego zadania
  2. Static: porównaj konfigurację współbieżności innych kolejek przed i po zmianie
- **Oczekiwane wyniki**:
  - Drugi import czeka na koniec pierwszego (współbieżność 1 w kolejce modułu)
  - Zadania innych kolejek startują i kończą się w trakcie importu (przedziały nakładają się z importem); ich czas oczekiwania nie zależy od importu
  - Krok 2: współbieżność i konfiguracja pozostałych kolejek bez zmian
---

## 12. Testy pamięci i wydajności (TC-PD-PERF) — 3 TC

#### TC-PD-PERF-001: Szczytowy RSS aplikacji przy uploadzie i pobraniu — dwa rozmiary

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Performance
- **Warunki wstępne**: Pliki S i L, L co najmniej kilkukrotnie większy od S i większy od dostępnej pamięci limitu kontenera testowego (np. S = 100 MB, L = 1 GB — rozmiary testowe, nie limity)
- **Kroki**:
  1. Zmierz bazowy `VmRSS` procesu aplikacji
  2. Upload multipart S, pobranie S; zapisz `VmHWM` (reset `clear_refs` albo nowy proces)
  3. To samo dla L
- **Oczekiwane wyniki**:
  - Przyrost szczytowego RSS dla L nie większy niż dla S w granicach szumu pomiaru (brak zależności liniowej od rozmiaru)
  - Bajty odebrane i wysłane przez proces aplikacji ≪ rozmiar pliku (plik nie przechodzi przez proxy aplikacji)
  - Raport: rozmiar, RSS bazowy, szczyt, przyrost — dla obu plików

#### TC-PD-PERF-002: Szczytowy RSS workera przy imporcie ZIP — dwa rozmiary, granica partSize × queueSize

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Performance
- **Warunki wstępne**: ZIP S i ZIP L (np. 100 MB i 1 GB), wpis największy w L wielokrotnie większy od rozmiaru części; parametry partSize i queueSize znane z konfiguracji
- **Kroki**:
  1. Zmierz bazowy RSS procesu workera (`queue worker --all`) i procesu serwera aplikacji; import S; zapisz `VmHWM` obu procesów i szczyt pamięci kontenera `app`
  2. Restart workera; import L; zapisz te same wartości
- **Oczekiwane wyniki**:
  - Dla obu: szczyt − baza ≤ partSize × queueSize + bufor dekompresji + stały narzut (narzut zmierzony na pustym zadaniu i zapisany w raporcie)
  - Przyrost dla L ≈ przyrost dla S (brak proporcjonalności do rozmiaru)
  - Zero plików tymczasowych w czasie pomiaru (inotify)
  - Szczyt kontenera `app` (serwer + worker razem) w raporcie dla obu rozmiarów — worker dzieli RAM kontenera

#### TC-PD-PERF-003: Pomiar presji RAM na wersji testowej — kryterium akceptacji z dwoma parametrami

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Performance (instancja testowa open-mercato.pl)
- **Warunki wstępne**:
  - Wersja testowa z włączonym `storage_s3`, bucketem testowym u dostawcy domyślnego (albo B2 z adapterem, jeśli PoC dostawcy domyślnego nie przeszedł), limitem pamięci kontenera `app` jak na produkcji
  - **Wartości ustalone**: przed pomiarem zapisane wartości dwóch parametrów presji RAM — (P-RSS) maksymalny szczytowy przyrost RSS procesu workera podczas importu, (P-FREE) minimalna wolna pamięć hosta w trakcie pomiaru; plan nie podaje wartości
- **Kroki**:
  1. Sprawdź, czy P-RSS i P-FREE mają zapisane wartości; zapisz je w raporcie
  2. Powtórz TC-PD-PERF-001 i TC-PD-PERF-002 na wersji testowej, równolegle zwykły ruch UI
  3. Rejestruj szczytowy przyrost RSS procesu workera (`VmHWM` − baza) i minimalną wolną pamięć hosta (`MemAvailable` z `/proc/meminfo`, próbkowanie w trakcie całego importu); `docker stats` kontenera `app`
- **Oczekiwane wyniki**:
  - Brak wartości P-RSS lub P-FREE: wynik „brak werdyktu” (nie PASS, nie FAIL); pomiar może być wykonany, ale kryterium akceptacji pozostaje niespełnione
  - Wartości ustalone: „brak presji RAM” = przyrost RSS workera ≤ P-RSS **i** minimalna wolna pamięć hosta ≥ P-FREE dla obu rozmiarów; w przeciwnym razie „presja RAM” → wniosek o osobny kontener workera z limitem pamięci (bez zmiany w tym etapie)
  - Niezależnie od werdyktu: kryteria z TC-PD-PERF-001/002 spełnione; brak OOM i brak wzrostu użycia dysku hosta
  - Raport z wartościami parametrów, pomiarami i werdyktem dołączony do PR jako dowód „gotowe”

---
## 13. Scenariusze testowe: Uprawnienia i ACL (TC-PD-ACL) — 5 TC

#### TC-PD-ACL-001: Uprawnienia do dokumentów dziedziczone z projektu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Warunki wstępne**: Projekt P1 z członkami U1 (dostęp), U2 (brak dostępu do projektu) w tej samej organizacji
- **Kroki**:
  1. U2 otwiera listę dokumentów P1, metadane dokumentu, żąda presigned GET i presigned PUT
  2. U1 to samo
- **Oczekiwane wyniki**:
  - U2: 404 na projekt i dokumenty (bez ujawniania istnienia); brak wydanych URL; dokumentów P1 brak w wyszukiwarce U2
  - U1: dostęp zgodnie z rolą w projekcie

#### TC-PD-ACL-002: ACL folderu zawęża i nadpisuje dziedziczenie

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Folder „Umowa” z ACL: U1 viewer, U3 editor; podfolder bez własnego ACL; podfolder z jawnym nadpisaniem
  2. U1 próbuje wgrać do „Umowa”; U3 wgrywa; U1 pobiera
  3. Przenieś dokument z „Umowa” do folderu ogólnego
- **Oczekiwane wyniki**:
  - Krok 2: U1 → 403 przy presign PUT; U3 → 201; U1 pobiera
  - Podfolder bez ACL dziedziczy z rodzica; z nadpisaniem — własne
  - Krok 3: uprawnienia dokumentu po przeniesieniu wynikają z folderu docelowego

#### TC-PD-ACL-003: Presigned URL wydawany dopiero po sprawdzeniu uprawnień i krótko ważny

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Unit
- **Kroki**:
  1. Zażądaj URL; odbierz U1 dostęp; zażądaj ponownie
  2. Sprawdź parametr ważności w URL
- **Oczekiwane wyniki**:
  - Po odebraniu dostępu nowy URL nie jest wydawany (403/404); wcześniej wydany wygasa po krótkiej ważności (parametr)
  - URL nie pojawia się w zdarzeniach, wyszukiwarce i odpowiedziach list

#### TC-PD-ACL-004: Upload bez uprawnienia administracji storage

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API
- **Kroki**:
  1. Employee z feature'ami modułu (bez `storage_providers.manage`) wgrywa i pobiera dokument
  2. Ten sam employee woła ogólną trasę signed-url modułu `storage_s3`
- **Oczekiwane wyniki**:
  - Krok 1: działa przez trasy modułu projektów
  - Krok 2: 403 (ogólne trasy storage nadal tylko dla administracji storage)

#### TC-PD-ACL-005: Feature'y modułu i role domyślne

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API
- **Kroki**:
  1. Sprawdź operacje: utworzenie projektu, edycja projektu, upload, zatwierdzenie rewizji, ACL folderu, ustawienia modułu, fizyczne usunięcie — dla `admin`, `employee` i roli własnej z pojedynczym feature'em
- **Oczekiwane wyniki**:
  - Każda operacja wymaga swojego feature'a; ustawienia i fizyczne usunięcie tylko admin; macierz w raporcie testu zgodna ze speką

---

## 14. Scenariusze testowe: Linki udostępniania (TC-PD-SHARE) — 3 TC

#### TC-PD-SHARE-001: Data wygaśnięcia obowiązkowa

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Utwórz link do dokumentu bez daty wygaśnięcia; z datą w przeszłości; z datą powyżej maksimum (parametr); z poprawną datą
- **Oczekiwane wyniki**:
  - Pierwsze trzy: 422; UI nie pozwala zapisać bez daty
  - Poprawny: token losowy, zapisany autor, zakres, data wygaśnięcia; wpis w `audit_logs`

#### TC-PD-SHARE-002: Link po wygaśnięciu i odwołaniu

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Otwórz link przed wygaśnięciem (bez logowania); po wygaśnięciu (zegar testowy); po odwołaniu
- **Oczekiwane wyniki**:
  - Przed: pobranie przez świeżo wydany presigned GET, ważny nie dłużej niż link
  - Po wygaśnięciu i odwołaniu: 410 albo 404, brak URL

#### TC-PD-SHARE-003: Zakres linku

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: API
- **Kroki**:
  1. Link do dokumentu: spróbuj pobrać inną rewizję, inny dokument folderu, wylistować folder
  2. Link do folderu: pobierz dokument z podfolderu z jawnym ACL
- **Oczekiwane wyniki**:
  - Link do dokumentu daje dostęp tylko do rewizji określonej w specu (najnowsza zatwierdzona albo wskazana); reszta 404
  - Link do folderu respektuje ACL podfolderów (wg speki); tenant i organizacja z linku, nie z parametrów żądania

---

## 15. Scenariusze testowe: Bez modułu harmonogramu (TC-PD-NOSCHED) — 4 TC

#### TC-PD-NOSCHED-001: Moduł harmonogramu nieobecny w buildzie

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + E2E/UI (`OM_INTEGRATION_MODULES` bez modułu harmonogramu)
- **Kroki**:
  1. Utwórz projekt, otwórz wszystkie zakładki, kamienie, zadania; odczytaj rejestr DI rozszerzeń w module kalkulacji
- **Oczekiwane wyniki**:
  - Wszystko działa; brak zakładki i akcji harmonogramu; brak błędów w konsoli i logach; rejestr zwraca „brak dostawcy harmonogramu” (nie wyjątek)

#### TC-PD-NOSCHED-002: Moduł harmonogramu obecny, wyłączony w organizacji

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API
- **Kroki**:
  1. Wyłącz harmonogram w organizacji (ustawienie organizacji) i osobno globalnym wyłącznikiem tenanta; powtórz TC-PD-NOSCHED-001
- **Oczekiwane wyniki**:
  - Zachowanie jak przy braku modułu; API projektu bez 500; brak linków do harmonogramu w odpowiedziach

#### TC-PD-NOSCHED-003: Link i idempotentne uruchomienie harmonogramu przez kontrakt DI

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Harmonogram włączony; inwestycja I1 bez harmonogramu; inwestycja I2 z harmonogramem w fazie wykonawczej
- **Kroki**:
  1. W projekcie dla I1 kliknij „Uruchom harmonogram” dwa razy (także równolegle przez API)
  2. W projekcie dla I2 kliknij „Linkuj harmonogram”
- **Oczekiwane wyniki**:
  - Krok 1: dokładnie jeden harmonogram dla I1; drugie wywołanie zwraca istniejący (bez błędu albo 409 z ID — wg kontraktu)
  - Krok 2: link do istniejącego rekordu, brak kopii
  - Brak żądań HTTP między modułami (TC-PD-DI-002)

#### TC-PD-NOSCHED-004: Wyłączenie harmonogramu po podlinkowaniu

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Projekt z linkiem do harmonogramu; wyłącz harmonogram w organizacji; włącz ponownie
- **Oczekiwane wyniki**:
  - Po wyłączeniu: projekt działa, link ukryty; dane harmonogramu i link zachowane
  - Po włączeniu: link znów widoczny, bez zmian danych

---

## 16. Scenariusze testowe: Kontrakty DI między modułami (TC-PD-DI) — 5 TC

#### TC-PD-DI-001: Kierunek zależności modułów

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static
- **Kroki**:
  1. Zbuduj graf importów modułów kalkulacji, harmonogramu i projektów (dependency-cruiser lub test na AST)
- **Oczekiwane wyniki**:
  - Kalkulacja nie importuje żadnego z dwóch modułów opcjonalnych
  - Moduł projektów i moduł harmonogramu nie importują się nawzajem (także typów)
  - Moduł projektów importuje z kalkulacji tylko publiczne kontrakty (typy i tokeny DI)

#### TC-PD-DI-002: Zero HTTP między modułami

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static + Integration
- **Kroki**:
  1. Static: brak `fetch`/klienta HTTP do `/api/` w kodzie serwerowym modułu
  2. Integration: przechwyć wychodzące żądania HTTP procesu aplikacji podczas utworzenia projektu, linkowania kamieni, uruchomienia harmonogramu
- **Oczekiwane wyniki**:
  - Zero żądań do własnego API; współpraca tylko przez DI i zdarzenia

#### TC-PD-DI-003: Kontrakt odczytu zwycięskiej wersji z kalkulacji

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit (kontrakt z fake) + Integration
- **Kroki**:
  1. Unit: moduł projektów z fałszywą implementacją kontraktu (wersja, pozycje, sekcje, snapshot oferty, inwestycja)
  2. Integration: prawdziwa implementacja z modułu kalkulacji
- **Oczekiwane wyniki**:
  - Te same testy przechodzą dla obu implementacji (test kontraktowy)
  - Kontrakt zwraca tylko dane z zakresu organizacji wywołującego; brak dostępu do kosztów i marży, gdy rola ich nie widzi

#### TC-PD-DI-004: Rejestr rozszerzeń w kalkulacji

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Kroki**:
  1. Uruchom aplikację w czterech konfiguracjach: sama kalkulacja; + projekty; + harmonogram; wszystkie trzy
- **Oczekiwane wyniki**:
  - Każda konfiguracja startuje i przechodzi smoke test kalkulacji; rejestr zwraca tylko zarejestrowanych dostawców
  - Wyłączenie modułu projektów w organizacji: menu ukryte, API modułu 404, dane zachowane

#### TC-PD-DI-005: Zdarzenia modułu w zakresie organizacji

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Subskrybuj zdarzenia utworzenia projektu, nowej rewizji i zatwierdzenia w dwóch organizacjach
- **Oczekiwane wyniki**:
  - Zdarzenia zawierają ID i zakres organizacji, bez presigned URL i treści plików; subskrybent innej organizacji ich nie dostaje

---

## 17. Scenariusze testowe: PoC storage — kryterium akceptacji etapu kodu (TC-PD-POC) — 7 TC

Wykonywane na etapie kodu skryptem poza repo (poświadczenia ze zmiennych środowiska), na bucketach testowych u dostawcy domyślnego (OVHcloud Object Storage, region UE — parametr) i u dostawcy zapasowego (Backblaze B2 EU Central). TC-PD-POC-001..003 są kryterium akceptacji: zgodność OVHcloud (warunkowy PUT, presigned PUT/GET, multipart i jego wznawianie) potwierdza PoC, nie sama dokumentacja. Jeśli którykolwiek z nich nie przejdzie, domyślnym dostawcą zostaje B2 z adapterem; wtedy TC-PD-POC-004..006 muszą przejść, a raport dokumentuje przełączenie. Wynik: raport z odpowiedziami HTTP.

#### TC-PD-POC-001: Dostawca domyślny — operacje `storage_s3` i zapis warunkowy

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. PutObject z `If-None-Match: *` na nowy klucz, potem na ten sam klucz
  2. Presigned PUT podpisany z `If-None-Match: *`: wyślij plik z `curl` i z przeglądarki (CORS); wyślij drugi raz na ten sam klucz
  3. GetObject, ListObjectsV2, presigned GET, presigned GET po wygaśnięciu; DeleteObject wyłącznie na obiekcie testowym skryptu
- **Oczekiwane wyniki**:
  - Krok 1–2: pierwszy zapis 200, drugi 412; obiekt bez zmian
  - Krok 3: operacje zgodne z S3; GET po wygaśnięciu 403; sha256 zgodny
  - Raport potwierdza pełną zgodność z listą operacji z rejestru (z odnośnikami do oficjalnej dokumentacji dostawcy)
  - Niezaliczenie dowolnego kroku: werdykt „fallback na B2 z adapterem”; dalsze testy storage w profilu „B2”

#### TC-PD-POC-002: Dostawca domyślny — multipart z przeglądarki

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. Ustaw CORS bucketu (origin aplikacji, PUT/GET, `ExposeHeaders: ETag`)
  2. CreateMultipartUpload, presigned UploadPart, upload części z przeglądarki, ListParts, CompleteMultipartUpload; osobno AbortMultipartUpload
  3. Część mniejsza niż minimalny rozmiar części (nie ostatnia)
  4. Wznawianie: wyślij część części, przerwij (zamknięcie karty / zabicie skryptu), po przerwie odczytaj ListParts dla tego samego uploadId i doślij brakujące części z nowymi presigned URL; zakończ
- **Oczekiwane wyniki**:
  - Przeglądarka odczytuje `ETag` części; Complete 200; obiekt zgodny; Abort usuwa niedokończony upload z ListMultipartUploads
  - Krok 3: błąd przy Complete — kod i komunikat zapisane do speki
  - Krok 4: ListParts zwraca wysłane części z ETagami; wznowiony upload kończy się obiektem zgodnym (sha256) bez ponownego wysyłania wysłanych części
  - Niezaliczenie kroku 1, 2 lub 4: werdykt „fallback na B2 z adapterem”

#### TC-PD-POC-003: Dostawca domyślny — `response-content-*`, klasy archiwum, lifecycle

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. Presigned GET z `response-content-disposition` (attachment/inline, `filename*=UTF-8''` z polskimi znakami) i `response-content-type`
  2. Sprawdź klasy przechowywania dostępne w wybranym regionie (zimne klasy do archiwum) i sposób zmiany klasy obiektu
  3. Ustaw regułę AbortIncompleteMultipartUpload
- **Oczekiwane wyniki**:
  - Krok 1: nagłówki odpowiedzi zgodne z parametrami
  - Krok 2: lista klas dostępnych w regionie w raporcie (wejście dla archiwizacji v2, TC-PD-RET-006)
  - Krok 3: przyjęta; żadna reguła lifecycle nie usuwa obiektów ani wersji

#### TC-PD-POC-004: Zapasowy B2 — presigned PUT/GET i multipart

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. Presigned PUT (SigV4, bez `If-None-Match`) z `curl` i przeglądarki; presigned GET; GET po wygaśnięciu
  2. CORS przez PutBucketCors (`ExposeHeaders: ETag`); multipart z presigned UploadPart, ListParts, Complete; osobno Abort
- **Oczekiwane wyniki**:
  - PUT 200, GET 200 (sha256 zgodny), po wygaśnięciu 403; multipart i jego wznawianie jak w TC-PD-POC-002 (krok 4)
  - Presigned POST (formularz przeglądarki) nieużywany — B2 go nie obsługuje

#### TC-PD-POC-005: Zapasowy B2 — `If-None-Match` daje 501, adapter go nie wysyła

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC + Unit (adapter)
- **Kroki**:
  1. PutObject z `If-None-Match: *` na nowy i istniejący klucz
  2. Unit: adapter B2 buduje żądania PutObject i presigned PUT
- **Oczekiwane wyniki**:
  - Krok 1: 501 (NotImplemented) w obu przypadkach; wynik zapisany
  - Krok 2: adapter nie dodaje nagłówka; klucze wyłącznie unikalne z serwera (TC-PD-REV-002)

#### TC-PD-POC-006: Zapasowy B2 — `response-content-*`, wersjonowanie, lifecycle

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. Presigned GET z `response-content-disposition` i `response-content-type`
  2. Zapisz obiekt dwa razy pod tym samym kluczem; DeleteObject po kluczu (obiekt testowy); ListObjectVersions
  3. PutBucketLifecycleConfiguration z AbortIncompleteMultipartUpload; osobno z regułą Transition
- **Oczekiwane wyniki**:
  - Krok 1: nagłówki zgodne; jeśli B2 ich nie respektuje — zapis do speki i alternatywa (metadane `Content-Disposition` przy uploadzie)
  - Krok 2: zachowanie wersji zapisane (bucket wersjonowany; usunięcie po kluczu ukrywa najnowszą wersję) — wejście dla fizycznego usuwania i quota przy fallbacku
  - Krok 3: AbortIncompleteMultipartUpload przyjęte; Transition odrzucone (jedna klasa) — przy fallbacku archiwum tylko jako eksport

#### TC-PD-POC-007: Przełączanie dostawcy konfiguracją, region UE

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: PoC
- **Kroki**:
  1. Uruchom ten sam skrypt PoC z konfiguracją: dostawca domyślny, B2 (adapter), emulator S3 — bez zmian kodu
- **Oczekiwane wyniki**:
  - Wszystkie przebiegi przechodzą swoje scenariusze; adapter wybierany konfiguracją; region obu bucketów potwierdzony jako UE

---

## 18. Scenariusze testowe: Dyski i bucket klienta (TC-PD-EXT) — 3 TC

#### TC-PD-EXT-001: Google Drive w trybie linku

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration (API Google podstawione) + E2E/UI
- **Kroki**:
  1. Podłącz Drive (poświadczenia w integracjach, szyfrowane); dodaj dokument z Drive
  2. Odbierz aplikacji dostęp do pliku w Drive; otwórz dokument
- **Oczekiwane wyniki**:
  - Dokument przechowuje ID pliku, URL i metadane; plik nie jest kopiowany do S3; quota bez zmian
  - Krok 2: status „link niedostępny”, bez błędu 500; metadane zachowane

#### TC-PD-EXT-002: SharePoint, OneDrive, Nextcloud w trybie linku

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Jak TC-PD-EXT-001 dla każdego dostawcy
- **Oczekiwane wyniki**:
  - Jak TC-PD-EXT-001; ACL po stronie OM nie udaje ACL dysku klienta (komunikat, że dostęp do pliku zależy od dysku)

#### TC-PD-EXT-003: Bucket klienta (wariant B)

- **Priorytet**: P1 | **Etap**: v2 | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Skonfiguruj partycję organizacji na bucket klienta (poświadczenia w integracjach, nie w ustawieniach); wgraj plik
  2. Druga organizacja wgrywa plik
- **Oczekiwane wyniki**:
  - Plik organizacji 1 w buckecie klienta, organizacji 2 w naszym; poświadczenia nie wracają w żadnej odpowiedzi API
  - Presigned URL i ochrona przed usuwaniem działają jak w wariancie A

---

## 19. Scenariusze testowe: Akceptacje (TC-PD-APR) — 4 TC

Akceptacje v1 (rewizje dokumentów, transmittale, protokoły): własna walidacja progów w module (`pd_approval_tiers`, `pd_approval_reviews`) za interfejsem `ApprovalEngine` w DI; moduł `workflows` w v2 jako kolejna implementacja.

#### TC-PD-APR-001: Kontrakt interfejsu `ApprovalEngine`

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Unit (test kontraktowy) + Static + `pg`
- **Kroki**:
  1. Uruchom zestaw testów kontraktowych `ApprovalEngine` na implementacji v1 (walidacja progów) i na implementacji fałszywej
  2. Static: moduł projektów odwołuje się do silnika tylko przez interfejs (token DI); brak importów `workflows`
  3. `pg`: stan akceptacji w `pd_approval_tiers` i `pd_approval_reviews`
- **Oczekiwane wyniki**:
  - Obie implementacje przechodzą te same testy; v1 nie wymaga włączenia `workflows`; stan wyłącznie w tabelach modułu

#### TC-PD-APR-002: Akceptacja wielopoziomowa rewizji

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration + E2E/UI
- **Warunki wstępne**: Progi dla typu „rysunek”: poziom 1 konstruktor, poziom 2 kierownik produkcji
- **Kroki**:
  1. Wyślij R1 do akceptacji; poziom 2 próbuje zatwierdzić przed poziomem 1
  2. Poziom 1 „z uwagami” (B) z komentarzem; R2 wysłana; poziom 1 i 2 zatwierdzają (A)
  3. Poziom 1 odrzuca (C) inną rewizję bez komentarza
- **Oczekiwane wyniki**:
  - Krok 1: 409/422 (kolejność poziomów)
  - Krok 2: R1 nie trafia do produkcji, plik R1 bez zmian; R2 po pełnej akceptacji = rewizja do produkcji
  - Krok 3: 422, jeśli próg wymaga komentarza
  - Wszystkie decyzje w `audit_logs`; przypomnienia dla recenzenta (notifications)

#### TC-PD-APR-003: Podmiana implementacji na `workflows`

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Unit + Integration
- **Kroki**:
  1. Uruchom testy kontraktowe na implementacji opartej o `workflows`; przełącz implementację w trakcie trwającej akceptacji (migracja)
- **Oczekiwane wyniki**:
  - Testy kontraktowe przechodzą; trwające akceptacje nie tracą stanu ani decyzji; moduł projektów bez zmian kodu poza rejestracją DI

#### TC-PD-APR-004: Akceptacja transmittala i protokołu przez ten sam silnik

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Zdefiniuj progi dla transmittala (jeden poziom) i protokołu odbioru (dwa poziomy); przeprowadź akceptację obu
  2. Spróbuj wysłać transmittal przed akceptacją; zamknąć protokół przed akceptacją
- **Oczekiwane wyniki**:
  - Krok 1: oba obiekty przechodzą przez `ApprovalEngine`; recenzje w `pd_approval_reviews` z typem obiektu
  - Krok 2: 409/422 z komunikatem; po akceptacji wysłanie i zamknięcie działają (kamień milowy jak w TC-PD-FLOW-004)

---

## 20. Scenariusze testowe: Zakres v1 (TC-PD-FLOW) — 4 TC

#### TC-PD-FLOW-001: Rejestr rysunków i rewizja do produkcji

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration + E2E/UI
- **Kroki**:
  1. Dodaj rysunek (numer, tytuł, branża, element); rewizje 0, A, B ze statusami przeznaczenia; zatwierdź A „do produkcji”, potem B
- **Oczekiwane wyniki**:
  - Rejestr pokazuje jedną rewizję „do produkcji” na rysunek (najnowsza zatwierdzona); A automatycznie „zastąpiona”
  - Numer rysunku unikalny w projekcie

#### TC-PD-FLOW-002: Transmittal z niemutowalną listą pozycji

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Utwórz transmittal z rewizjami A dwóch rysunków; wyślij; dodaj rewizję B jednego rysunku; spróbuj edytować wysłany transmittal
- **Oczekiwane wyniki**:
  - Pozycje wskazują konkretne rewizje A (nie „najnowszą”); po wysłaniu lista niezmienna (409/422); paczka ZIP generowana asynchronicznie, bez plików na dysku i z ograniczonym RAM

#### TC-PD-FLOW-003: Korespondencja i RFI

- **Priorytet**: P2 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Zarejestruj pismo przychodzące i RFI z terminem odpowiedzi; odpowiedz; przekrocz termin (zegar testowy)
- **Oczekiwane wyniki**:
  - Kolejne numery kancelaryjne bez luk przy równoległym zapisie; odpowiedź powiązana z RFI; po terminie oznaczenie i powiadomienie

#### TC-PD-FLOW-004: Protokół odbioru zamyka kamień milowy

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Protokół odbioru częściowego powiązany z kamieniem (billing %); dodaj usterki; zamknij protokół
- **Oczekiwane wyniki**:
  - Kamień osiągnięty z datą protokołu; procent rozliczenia dostępny do faktury; usterki z terminami w protokole

---

## 21. Scenariusze testowe: Zakres v2 (TC-PD-ADV) — 3 TC

#### TC-PD-ADV-001: Gwarancja i rękojmia zasilają podpowiedź retencji

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Dodaj terminy gwarancji i rękojmi z przypomnieniami; odczytaj podpowiedź daty retencji
- **Oczekiwane wyniki**:
  - Podpowiedź liczona z najpóźniejszego terminu; ręczna data z MVP nie jest nadpisana bez potwierdzenia

#### TC-PD-ADV-002: Dokumenty jakości przypięte do partii produkcji

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Przypnij deklarację właściwości użytkowych i atest do partii z kalkulacji (przez kontrakt DI)
- **Oczekiwane wyniki**:
  - Dokument widoczny przy partii i w projekcie; brak importu modułu harmonogramu (TC-PD-DI-001)

#### TC-PD-ADV-003: OCR na żądanie, podgląd DWG, podpis kwalifikowany — bez łamania zasad storage

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration + Performance
- **Kroki**:
  1. Uruchom OCR na żądanie dla dużego PDF; podgląd DWG; podpis kwalifikowany protokołu
- **Oczekiwane wyniki**:
  - Przetwarzanie w workerze z ograniczonym RAM, bez plików tymczasowych na VPS (albo u zewnętrznego dostawcy); podpisany plik = nowa rewizja

---

## 22. Scenariusze testowe: Ryzyka prawne — brak funkcji (TC-PD-LEGAL) — 1 TC

#### TC-PD-LEGAL-001: Ryzyka prawne nie są funkcjami modułu

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: E2E/UI + Static
- **Kroki**:
  1. Przejrzyj menu, ustawienia i API modułu
- **Oczekiwane wyniki**:
  - Brak e-dziennika budowy, brak automatycznego wyliczania rękojmi i zabezpieczenia należytego wykonania z przepisów, brak wymuszanych ustawowych okresów przechowywania
  - Teksty przy retencji i datach gwarancji oznaczają je jako „do weryfikacji prawnej / wg umowy”

---

## 23. Scenariusze testowe: Izolacja multi-tenant (TC-PD-TEN) — 3 TC

#### TC-PD-TEN-001: Cudze ID projektu, dokumentu, rewizji, folderu → 404

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + proxy S3
- **Kroki**:
  1. Użytkownik organizacji B woła wszystkie trasy modułu z ID z organizacji A (ścieżka i ciało), w tym presign i zakończenie uploadu z kluczem obiektu A
- **Oczekiwane wyniki**:
  - 404 wszędzie; brak wydanego URL dla kluczy z prefiksem A; brak zapisu

#### TC-PD-TEN-002: Ustawienia i quota per organizacja

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Dwie organizacje w jednym tenancie: różny tryb quota, limit, reguła retencji; upload w obu
- **Oczekiwane wyniki**:
  - Każda organizacja ma własne ustawienia i licznik; zmiana w A nie wpływa na B

#### TC-PD-TEN-003: Prefiks klucza obiektu wymusza zakres

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration
- **Kroki**:
  1. Generuj klucze dla różnych kontekstów; podaj w żądaniu tenant/organizację inną niż z sesji
- **Oczekiwane wyniki**:
  - Klucz zawsze z prefiksem tenanta i organizacji z sesji; wartości z żądania ignorowane

---

## 24. Scenariusze testowe: Bezpieczeństwo plików (TC-PD-SEC) — 4 TC

#### TC-PD-SEC-001: Typ pliku, XSS przez podgląd

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + API
- **Kroki**:
  1. Wgraj HTML, SVG ze skryptem, PDF z JavaScriptem, plik `.pdf` z treścią HTML
  2. Otwórz podgląd i pobranie
- **Oczekiwane wyniki**:
  - Podgląd inline tylko dla dozwolonych typów (PDF, obrazy rastrowe); HTML/SVG zawsze `attachment`; treść nie wykonuje się w domenie aplikacji (bucket na innej domenie)
  - Niezgodność rozszerzenia i typu oznaczona albo odrzucona (wg speki)

#### TC-PD-SEC-002: ZIP — bomb, path traversal, symlinki, zagnieżdżenia

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Import ZIP: wysoki współczynnik kompresji; wpisy `../../x`, ścieżki absolutne; symlinki; ZIP w ZIP; zaszyfrowany ZIP; uszkodzony katalog centralny
- **Oczekiwane wyniki**:
  - Bomb: przerwanie po limicie (TC-PD-WRK-003), RAM ograniczony
  - Ścieżki znormalizowane do folderu projektu albo wpis odrzucony; symlinki pominięte; ZIP w ZIP importowany jako plik; zaszyfrowany i uszkodzony — błąd w raporcie, bez awarii workera

#### TC-PD-SEC-003: SSRF przy imporcie z URL

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Unit
- **Kroki**:
  1. Import z URL spoza listy dozwolonych hostów; z przekierowaniem na `169.254.169.254`, `localhost`, adres prywatny; z DNS rebinding
- **Oczekiwane wyniki**:
  - Odrzucenie (422) albo przerwanie po przekierowaniu; zero połączeń do sieci prywatnej (blokada po rozwiązaniu adresu)

#### TC-PD-SEC-004: Presigned URL nie wycieka

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration
- **Kroki**:
  1. Pobierz, wgraj, zaimportuj; przejrzyj logi aplikacji, `audit_logs`, zdarzenia, indeks wyszukiwania
- **Oczekiwane wyniki**:
  - Brak pełnych presigned URL (z `X-Amz-Signature`) i kluczy dostępowych; najwyżej klucz obiektu i operacja

---
## 25. Zbiory danych testowych (Fixtures)

| Typ | Opis | Ilość |
|-----|------|-------|
| **Organizacje** | A i B w jednym tenancie (różne ustawienia quota, retencji, wariantu), C w innym tenancie | 3 |
| **Użytkownicy** | admin i employee w A i B; U1–U3 z różnym dostępem do projektu i folderów; role własne z pojedynczym feature'em | 8+ |
| **Deale i kalkulacje** | wygrany z ofertą główną (wysłana wersja ze snapshotem), wygrany z `alternative`, wygrany bez wersji, otwarty, przegrany; dwie inwestycje | 6 |
| **Szablony** | dwa segmenty z różnymi etapami, kamieniami, drzewami folderów i ACL | 2 |
| **Pliki** | mały PDF, JPG skan, DWG, HTML, SVG ze skryptem, PDF z JS, plik S i L do pomiaru RAM (generowane w teście, nie w repo) | 9 |
| **ZIP** | e-Zamówienia poprawny (UTF-8 i CP852), ZIP S i L, bomb, traversal, symlink, zagnieżdżony, zaszyfrowany, uszkodzony | 9 |
| **Podstawione serwisy** | serwer HTTP udający e-Zamówienia (szybki i wolny), API TED z BT-15, Google Drive (v1) | 3 |
| **Storage** | emulator S3 w profilu zgodnym i „B2” + proxy logujące operacje; bucket testowy u dostawcy domyślnego (PoC, wersja testowa) i u zapasowego B2 (PoC) | 4 |
| **Parametry** | limit pliku, quota, tryb quota, progi alertów, limity ZIP, timeout, partSize, queueSize, ważność presigned URL, maksymalna ważność linku — małe wartości testowe | — |

---

## 26. Kryteria akceptacji

### Wejścia

- [ ] Specyfikacja i rejestr bez sprzeczności blokujących plan
- [ ] Specyfikacja modułu po uwzględnieniu wniosków z §27
- [ ] Moduł `storage_s3` włączony w środowisku testowym, emulator S3 w ephemeral

### Wyjścia / miary sukcesu

| Kryterium | Wymaganie | Status |
|-----------|-----------|--------|
| **Dostawca storage** | PoC OVHcloud (TC-PD-POC-001..003: warunkowy PUT, presigned PUT/GET, multipart i wznawianie) zaliczony; inaczej B2 z adapterem zaliczony (TC-PD-POC-004..006) i ustawiony jako domyślny | TBD |
| **Pokrycie P0** | 100% scenariuszy P0 etapu MVP przechodzi | TBD |
| **Pamięć** | Szczytowy RSS aplikacji i workera niezależny od rozmiaru pliku dla dwóch rozmiarów; worker ≤ partSize × queueSize + bufor dekompresji + narzut (TC-PD-PERF-001..002); pomiar na wersji testowej z ustalonymi wartościami dwóch parametrów presji RAM daje werdykt „brak presji RAM” (TC-PD-PERF-003; brak wartości = brak werdyktu, kryterium niespełnione) | TBD |
| **Dysk VPS** | Zero plików projektu i plików tymczasowych (TC-PD-STOR-005) | TBD |
| **Brak proxy aplikacji** | Treść pliku nie przechodzi przez proces aplikacji (TC-PD-STOR-001..003) | TBD |
| **Brak usunięć** | Zero DeleteObject bez potwierdzenia admina, zero z workerów (TC-PD-RET-003..005) | TBD |
| **Niemutowalność** | Rewizje i ich obiekty niezmienne (TC-PD-REV-001, -002) | TBD |
| **Projekt** | Tylko jawna komenda; drugi → 409 z ID (TC-PD-PRJ-002, -004) | TBD |
| **Izolacja** | 404 dla cudzych ID; klucze z prefiksem z sesji (TC-PD-TEN-*) | TBD |
| **Sekrety** | Zero sekretów w repo i ustawieniach (TC-PD-STOR-006) | TBD |
| **Pokrycie tras API** | Każda trasa modułu ma test Playwright w `__integration__` | TBD |

---

## 27. Wnioski do specyfikacji (luki i pytania techniczne)

Pytania techniczne do runnera speki i review (Kod/Cezar), nie do Marka.

### Priorytet 1 (przed kodem)

1. **Strumieniowy ZIP bez plików tymczasowych** (TC-PD-IMP-002, TC-PD-PERF-002): format ZIP ma katalog centralny na końcu. Parser z dostępem swobodnym (np. planowany `yauzl`) potrzebuje pliku albo czytnika zakresów; parser czysto strumieniowy nie radzi sobie z wpisami z „data descriptor”. Który wariant: (a) najpierw strumień ZIP do S3, potem odczyt wpisów przez GET z `Range`; (b) parser strumieniowy z obsługą błędów? W (a): czy surowy ZIP zostaje jako obiekt (quota, retencja), a jeśli nie — kto go usuwa, skoro worker nie może wywołać DeleteObject? **Nadal otwarte** (rejestr: `yauzl` i `@aws-sdk/lib-storage` tylko „ask first”, decyzja na etapie kodu).
2. ~~**Brak klas przechowywania na B2**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, 2026-10-23)**: archiwum = eksport albo zimna klasa u wybranego dostawcy (u OVHcloud klasy zależne od regionu); przy fallbacku B2 tylko eksport. Scenariusze: TC-PD-POC-003, TC-PD-POC-006, TC-PD-RET-006.
3. **Wersjonowanie bucketu B2** — **CZĘŚCIOWO**: dotyczy już tylko fallbacku B2 (TC-PD-POC-006); dostawca domyślny ma zapis warunkowy (TC-PD-POC-001). Dla fallbacku nadal otwarte: DeleteObject po kluczu ukrywa tylko najnowszą wersję. Co oznacza „fizyczne usunięcie po potwierdzeniu admina” — usunięcie wszystkich wersji? Czy quota liczy ukryte wersje (B2 je przechowuje i nalicza)? Czy włączyć Object Lock jako techniczną gwarancję niemutowalności?
4. **Sprzątanie bez DeleteObject** (TC-PD-STOR-008, TC-PD-RET-005): osierocone obiekty (presigned PUT bez zakończenia) i surowe ZIP-y — lista do decyzji admina czy reguła lifecycle? Reguła wygaszająca obiekty to automatyczne usunięcie bez admina (sprzeczne z zasadą retencji); dopuszczalne wydaje się tylko AbortIncompleteMultipartUpload.
5. **Quota per organizacja a quota załączników per tenant** (TC-PD-QUOTA-001): moduł `attachments` liczy quota per tenant (`OM_ATTACHMENT_TENANT_QUOTA_MB`). Czy dokumenty projektu korzystają z encji i quota `attachments`, czy z własnych tabel `pd_` z własnym licznikiem per organizacja? Od tego zależy, które limity „podnosimy”.
6. **Klucz unikalności projektu** (TC-PD-PRJ-002): częściowy indeks na (deal, wersja oferty, inwestycja) — co gdy inwestycja jest pusta (w Postgres NULL-e są różne, duplikaty przejdą bez `NULLS NOT DISTINCT`)? Czy „jeden projekt na zwycięską ofertę główną” nie wymaga raczej unikalności po samej wersji oferty albo samym dealu?
7. **Hash pliku bez czytania przez aplikację** (TC-PD-DOC-001, TC-PD-REV-002, TC-PD-IMP-005): sha256 liczy przeglądarka (niezweryfikowany), S3 (checksum przy uploadzie — czy dostawca domyślny i zapasowy B2 wspierają `x-amz-checksum-sha256` w presigned multipart?) czy worker strumieniowo? Deduplikacja przy imporcie wymaga wiarygodnego hasha.
8. **Trasa uploadu dla zwykłego użytkownika** (TC-PD-ACL-004): ogólny `signed-url` w `storage_s3` wymaga `storage_providers.manage` i ogranicza ważność; moduł potrzebuje własnych tras z ACL projektu/folderu. Potwierdzić w specu.

### Priorytet 2

9. **Źródło daty dla podpowiedzi retencji w MVP** (TC-PD-RET-002): encja gwarancji i rękojmi jest w v2, a podpowiedź „koniec gwarancji i rękojmi” w MVP. Czy MVP ma proste pola dat na projekcie?
10. **Tryb quota: dopłata czy blokada** (TC-PD-QUOTA-002, -003): parametr per organizacja, per plan czy globalny? Kto i gdzie rejestruje nadwyżkę do rozliczenia (moduł nie zna cennika)?
11. **Poświadczenia bucketu klienta** (TC-PD-EXT-003): zasada „bez sekretów w ustawieniach” — czy szyfrowany `credentialsService` integracji jest dopuszczalnym miejscem? Wariant B v2 tego wymaga.
12. **Kontrola regionu UE** (TC-PD-STOR-009): czy aplikacja ma odrzucać endpoint/region spoza UE, czy to tylko konfiguracja wdrożenia?
13. **Maksymalna ważność linku udostępniania i odświeżanie presigned GET** (TC-PD-SHARE-001, -002): presigned URL SigV4 ma górną granicę ważności; link powinien wydawać nowy URL przy każdym otwarciu. Maksimum ważności linku jako parametr?
14. **Częściowy import przy przekroczeniu limitu lub timeoucie** (TC-PD-WRK-003, -004) — rejestr wymaga timeoutu, wznowienia i abortu multipartu, ale nie rozstrzyga wyniku częściowego: wszystko albo nic, czy częściowy wynik z raportem? Przy „wszystko albo nic” wycofanie wymagałoby usunięcia obiektów (sprzeczne z zakazem DeleteObject w workerach).
15. **Wznowienie a abort multipartu po restarcie** (TC-PD-WRK-005): gdzie trzymany jest stan uploadId i części (DB czy dane zadania)? Wznowienie strumienia HTTP źródła wymaga `Range` u źródła; e-Zamówienia mogą go nie obsługiwać — wtedy tylko abort i ponowienie.
16. ~~**Współbieżność 1 a duże ZIP-y**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, commit 4f83bd4)**: współbieżność 1 na instancję dotyczy tylko kolejki importu i multipartu modułu; pozostałe kolejki w `queue worker --all` bez zmian (TC-PD-WRK-002, TC-PD-WRK-007).
17. **Podgląd PDF a CORS** (TC-PD-DOC-003): przeglądarka PDF w aplikacji (pdf.js) pobiera przez `fetch` — wymaga CORS GET na buckecie; `<iframe>`/natywny podgląd nie. Który wariant?
18. ~~**Status linków udostępniania**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, 2026-10-23)**: linki udostępniania w v1, lista MVP ich nie zawiera (TC-PD-SHARE-* mają etap v1).

### Priorytet 3

19. **Deal ponownie otwarty** (TC-PD-PRJ-008): projekt zostaje z oznaczeniem — potwierdzić w specu.
20. **Nazwy feature'ów** (TC-PD-ACL-005): macierz feature'ów i ról domyślnych do speki.

### Nowe wnioski (rev 2, po finalnym rejestrze)

21. ~~**„Mały bufor tymczasowy” na dysku VPS**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, commit 4f83bd4)**: bufor wyłącznie w RAM, ograniczony do partSize × queueSize (parametry), zero plików tymczasowych na dysku VPS, także w workerze. TC-PD-STOR-005 zostaje ostry; granica RAM w TC-PD-PERF-002.
22. ~~**Weryfikacja dostawcy domyślnego**~~ — ✅ **ROZSTRZYGNIĘTE (odbiór, 2026-10-23)**: zgodność OVHcloud potwierdza PoC na etapie kodu (warunkowy PUT, presigned PUT/GET, multipart i jego wznawianie) jako kryterium akceptacji; jeśli nie przejdzie — B2 z adapterem (TC-PD-POC-001..006). Kopia zapasowa przy regionie One Zone przeniesiona do wniosku 24 (otwarte).
23. ~~**Próg „presji RAM”**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, commit 4f83bd4)**: dwa parametry pomiaru bez wartości — szczytowy przyrost RSS procesu workera podczas importu i minimalna wolna pamięć hosta w trakcie pomiaru; wartości ustala Koordynator z Dawidem przed pomiarem, bez nich brak werdyktu (TC-PD-PERF-003).
24. **Kopia zapasowa przy regionie One Zone** (TC-PD-POC-003) — **P2, otwarte**: czy potrzebna kopia w innym regionie lub u innego dostawcy; jeśli tak — czy kopia liczy się do quota i podlega tym samym zasadom usuwania (tylko po potwierdzeniu admina).

---

## 28. Podsumowanie

**Dokument**: Niezależny plan testów — spec only
**Liczba scenariuszy**: 103 (MVP 81, v1 15, v2 7; etap liczony z pierwszej fazy scenariusza — TC-PD-STOR-007 obejmuje MVP, v1 i v2)
**Liczba wniosków do speki**: 24 (6 rozstrzygniętych: 2, 16, 18, 21, 22, 23; częściowo: 3, 14)
**Status**: SPEC ONLY — bez kodu, bez testów wykonywalnych

**Kolejne kroki**:
1. Na etapie kodu: PoC dostawcy domyślnego (kryterium akceptacji, fallback B2) i ustalenie wartości parametrów presji RAM przed pomiarem
2. Odpowiedzi na wnioski P1 z §27

---

## Załącznik: Traceability D → TC (macierz decyzji)

Źródło: `.ai/decisions.md` (wersja finalna 2026-10-23, sekcja „Decyzje D98–D115”), wszystkie 18 decyzji aktywne. Każda decyzja ma co najmniej jeden TC. Fazy w kolumnie TC wynikają z pola „Etap” scenariuszy.

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| **D98** | Trzy moduły; opcjonalne zależą od kalkulacji; brak importów między opcjonalnymi; współpraca przez rejestr DI w kalkulacji | TC-PD-DI-001, TC-PD-DI-002, TC-PD-DI-004, TC-PD-DI-005, TC-PD-NOSCHED-001 | MVP |
| **D99** | Projekt tylko jawną komendą z deala `won`, z szablonu; ID bez constraintu + snapshot; jeden na ofertę główną, drugi 409; n8n i subscriber nie tworzą | TC-PD-PRJ-001, TC-PD-PRJ-002, TC-PD-PRJ-003, TC-PD-PRJ-004, TC-PD-PRJ-005, TC-PD-PRJ-006, TC-PD-PRJ-008 | MVP; wniosek 6 (NULL w kluczu) |
| **D100** | Brak własnego Gantta; link/uruchomienie harmonogramu przez DI idempotentnie; działa bez harmonogramu; zero HTTP | TC-PD-PRJ-007, TC-PD-NOSCHED-001, TC-PD-NOSCHED-002, TC-PD-NOSCHED-003, TC-PD-NOSCHED-004, TC-PD-DI-002 | MVP bez harmonogramu; v1 link/uruchomienie |
| **D101** | Kamienie linkują pozycję/sekcję zwycięskiej wersji (ID + snapshot etykiety); billing % w v1 | TC-PD-MS-001, TC-PD-MS-002, TC-PD-MS-003, TC-PD-MS-004, TC-PD-FLOW-004, TC-PD-DI-003 | MVP link; v1 billing % |
| **D102** | Metadane w OM, pliki w S3 (`storage_s3`, partycja `projectDocs`), presigned upload, limity, quota per organizacja, nic na VPS | TC-PD-DOC-001, TC-PD-STOR-001, TC-PD-STOR-002, TC-PD-STOR-009, TC-PD-QUOTA-001, TC-PD-ACL-004 | MVP; wnioski 5, 8 |
| **D103** | Rewizja niemutowalna; do produkcji najnowsza zatwierdzona; MVP ręcznie, v1 ścieżka akceptacji | TC-PD-REV-001, TC-PD-REV-002, TC-PD-REV-003, TC-PD-REV-004, TC-PD-REV-005, TC-PD-POC-003, TC-PD-APR-002, TC-PD-FLOW-001 | MVP; v1 akceptacje |
| **D104** | Dziedziczenie z projektu + ACL folderów (MVP); linki z obowiązkowym wygaśnięciem — v1 (nie w MVP) | TC-PD-ACL-001, TC-PD-ACL-002, TC-PD-ACL-003, TC-PD-ACL-005, TC-PD-SHARE-001, TC-PD-SHARE-002, TC-PD-SHARE-003, TC-PD-SEC-004 | MVP; v1 linki (TC-PD-SHARE-* etap v1); wniosek 18 rozstrzygnięty |
| **D105** | Dyski klienta w trybie linku: Google Drive v1; SharePoint/OneDrive/Nextcloud v2 | TC-PD-EXT-001, TC-PD-EXT-002 | v1, v2 |
| **D106** | Zakres MVP: szablon, etapy, zadania, kamienie, foldery z ACL, rewizje na S3, podgląd PDF, ręczne pliki i linki, import e-Zamówień, TED metadane + link | TC-PD-PRJ-006, TC-PD-PRJ-007, TC-PD-DOC-002, TC-PD-DOC-003, TC-PD-DOC-005, TC-PD-SEC-001, TC-PD-IMP-001, TC-PD-IMP-002, TC-PD-IMP-003, TC-PD-IMP-004, TC-PD-IMP-005, TC-PD-SEC-003 | MVP |
| **D107** | Zakres v1: rejestr rysunków, akceptacje (silnik wg D114), transmittale, korespondencja/RFI, protokoły, Google Drive, alerty quota, kamienie z rozliczeniem | TC-PD-FLOW-001, TC-PD-FLOW-002, TC-PD-FLOW-003, TC-PD-FLOW-004, TC-PD-APR-001, TC-PD-APR-004, TC-PD-QUOTA-005, TC-PD-EXT-001, TC-PD-MS-004 | v1 |
| **D108** | Zakres v2: gwarancja/rękojmia, dokumenty jakości przy partiach, SharePoint/OneDrive/Nextcloud, bucket klienta, OCR, DWG, podpis kwalifikowany | TC-PD-ADV-001, TC-PD-ADV-002, TC-PD-ADV-003, TC-PD-EXT-002, TC-PD-EXT-003, TC-PD-DOC-004 | v2 (DOC-004: brak OCR w MVP) |
| **D109** | E-dziennik, rękojmia, zabezpieczenie, okresy przechowywania = ryzyka prawne, nie wymagania | TC-PD-LEGAL-001, TC-PD-RET-001 | bez funkcji; test negatywny |
| **D110** | Pliki nie na dysku VPS i nie przez RAM aplikacji; presigned (multipart); ZIP strumieniowo w istniejącym workerze kolejki, bez nowego kontenera; pamięć ograniczona; ścieżki buforujące `storage_s3` nieużywane | TC-PD-STOR-001, TC-PD-STOR-002, TC-PD-STOR-003, TC-PD-STOR-004, TC-PD-STOR-005, TC-PD-IMP-002, TC-PD-PERF-001, TC-PD-PERF-002, TC-PD-PERF-003, TC-PD-DOC-004, TC-PD-WRK-001 | MVP; bufor tylko w RAM, zero plików tymczasowych (wniosek 21 rozstrzygnięty); wnioski 1, 7 |
| **D111** | Storage w UE; domyślnie najtańszy w pełni kompatybilny dostawca UE (OVHcloud; zapis warunkowy `If-None-Match`, multipart); fallback B2 EU Central z adapterem bez `If-None-Match`; konfiguracja env/ustawienia bez sekretów | TC-PD-STOR-001, TC-PD-STOR-006, TC-PD-STOR-009, TC-PD-REV-002, TC-PD-POC-001, TC-PD-POC-002, TC-PD-POC-003, TC-PD-POC-004, TC-PD-POC-005, TC-PD-POC-006, TC-PD-POC-007 | MVP; PoC OVHcloud = kryterium akceptacji etapu kodu, fallback B2 (wniosek 22 rozstrzygnięty); wnioski 3, 12, 24 |
| **D112** | Wariant A (nasz bucket u dostawcy domyślnego, fallback B2; limit i dopłata) / B (storage klienta); limity i ceny jako parametry; MVP tylko A; v1 + Drive; v2 + bucket klienta, SharePoint/OneDrive/Nextcloud | TC-PD-STOR-007, TC-PD-QUOTA-001, TC-PD-QUOTA-002, TC-PD-QUOTA-003, TC-PD-QUOTA-004, TC-PD-EXT-001, TC-PD-EXT-003, TC-PD-TEN-002 | MVP A; v1, v2 B; wnioski 10, 11 |
| **D113** | Retencja per organizacja (podpowiedź: koniec gwarancji i rękojmi), potem archiwum = eksport albo zimna klasa u dostawcy (B2: tylko eksport); nigdy usunięcie bez admina; MVP pole + data na projekcie; v2 auto-archiwizacja | TC-PD-RET-001, TC-PD-RET-002, TC-PD-RET-003, TC-PD-RET-004, TC-PD-RET-005, TC-PD-RET-006, TC-PD-STOR-008, TC-PD-ADV-001, TC-PD-POC-003, TC-PD-POC-006 | MVP; v2; wniosek 2 rozstrzygnięty; wnioski 3, 4, 9 |
| **D114** | Akceptacje v1 (rewizje, transmittale, protokoły): własna walidacja progów (`pd_approval_tiers`, `pd_approval_reviews`) za `ApprovalEngine` w DI; `workflows` w v2 | TC-PD-APR-001, TC-PD-APR-002, TC-PD-APR-003, TC-PD-APR-004 | v1; v2 |
| **D115** | Import ZIP i multipart serwerowy przez istniejącą kolejkę OM (ProgressJob, `queue worker --all` w kontenerze `app`), bez nowego kontenera; strumieniowo; bufor tylko w RAM ≤ partSize × queueSize, zero plików tymczasowych; współbieżność 1 tylko dla kolejki modułu, inne kolejki bez zmian; limity per plik i per ZIP jako parametry; timeout, wznowienie, abort multipartu; presja RAM wg dwóch parametrów pomiaru (bez wartości → brak werdyktu) | TC-PD-WRK-001, TC-PD-WRK-002, TC-PD-WRK-003, TC-PD-WRK-004, TC-PD-WRK-005, TC-PD-WRK-006, TC-PD-WRK-007, TC-PD-IMP-002, TC-PD-SEC-002, TC-PD-STOR-005, TC-PD-PERF-002, TC-PD-PERF-003 | MVP; wnioski 16, 21, 23 rozstrzygnięte; otwarte 14, 15 |

**Decyzje kontekstowe (wcześniejsze, aktywne) użyte w scenariuszach:**

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| **D15** | Firma = organizacja OM | TC-PD-TEN-001, TC-PD-TEN-002, TC-PD-TEN-003 | izolacja |
| **D19** | Harmonogram opcjonalny per firma | TC-PD-NOSCHED-001 | |
| **D47** | Przełącznik harmonogramu per organizacja + globalny wyłącznik tenanta | TC-PD-NOSCHED-002 | |
| **D67** | Wyłączenie harmonogramu zostawia dane ukryte | TC-PD-NOSCHED-004 | |
| **D77** | Jeden harmonogram na inwestycję | TC-PD-NOSCHED-003 | |

---

## Changelog

### Rev 3 — 2026-10-23 (rejestr z commita 4f83bd4)

- Dopasowania do D114 i D115 (rev 2 i rev 3) wykonała ta sama niezależna sesja, która napisała plan (Grok Bot), wyłącznie na podstawie `.ai/decisions.md` (kopie: rejestr finalny, potem wersja z commita 4f83bd4), bez dostępu do specyfikacji modułu
- TC-PD-STOR-005 zostaje ostry: zero plików tymczasowych, także w workerze; bufor wyłącznie w RAM
- Nowy TC-PD-WRK-007 (P0): współbieżność 1 tylko dla kolejki importu i multipartu modułu, inne kolejki w `queue worker --all` działają równolegle; tytuł TC-PD-WRK-002 doprecyzowany
- TC-PD-PERF-003 przepisany: dwa parametry presji RAM (szczytowy przyrost RSS workera, minimalna wolna pamięć hosta), warunek wstępny „wartości ustalone”; bez wartości wynik „brak werdyktu”, nie PASS
- PoC (§17): OVHcloud jako kryterium akceptacji etapu kodu z fallbackiem na B2 z adapterem; TC-PD-POC-002 z krokiem wznawiania multipartu (ListParts); §1.3 i §26 zaktualizowane
- §27: wnioski 16, 21, 22, 23 rozstrzygnięte; nowy wniosek 24 (kopia zapasowa przy One Zone — otwarte)
- Załącznik: D110, D111, D115 zaktualizowane
- Liczba scenariuszy: 102 → 103 (TC-PD-WRK 6 → 7)

### Rev 2 — 2026-10-23 (finalny rejestr decyzji)

- Załącznik: zaślepki zamienione na D114 (akceptacje) i D115 (worker na kolejce OM); 18 decyzji D98–D115 pokrytych
- Dostawca storage: domyślny = najtańszy w pełni kompatybilny w UE (OVHcloud), zapasowy = B2 z adapterem bez `If-None-Match`; PoC rozdzielony: TC-PD-POC-001..003 dostawca domyślny, TC-PD-POC-004..006 B2, nowy TC-PD-POC-007 (przełączanie konfiguracją)
- TC-PD-REV-002: dostawca domyślny — drugi zapis na ten sam klucz → 412; adapter B2 — bez nagłówka, ochrona unikalnymi kluczami; TC-PD-STOR-001, TC-PD-STOR-009 zaktualizowane
- TC-PD-RET-006: archiwum = eksport albo zimna klasa u dostawcy domyślnego; przy B2 tylko eksport
- TC-PD-WRK-001: worker = proces `queue worker --all` w kontenerze `app`, `ProgressJob`; TC-PD-PERF-002/003: pomiar kontenera `app` (serwer + worker dzielą RAM), werdykt presji RAM
- Nowy TC-PD-APR-004 (akceptacja transmittala i protokołu przez `ApprovalEngine`); TC-PD-APR-001: tabele `pd_approval_tiers`, `pd_approval_reviews`
- Linki udostępniania: bez zmian etapu (już v1); załącznik i wniosek 18 zaktualizowane
- §27: wnioski 2 i 18 rozstrzygnięte, 3, 14, 16 częściowo; nowe 21–23
- Liczba scenariuszy: 100 → 102 (TC-PD-POC 6 → 7, TC-PD-APR 3 → 4)

### Rev 1 — 2026-10-23

- Pierwsza wersja: 100 scenariuszy w 22 grupach, załącznik D98–D113 + decyzje kontekstowe + zaślepki dla decyzji zapowiedzianych (akceptacje, worker, pomiar RAM)
- Grupy TC-PD-WRK, TC-PD-APR, TC-PD-PERF-003 dodane przed wpisaniem decyzji do rejestru (zapowiedź koordynatora)
