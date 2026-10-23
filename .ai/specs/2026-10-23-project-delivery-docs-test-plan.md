# Niezależny plan testów — Realizacja projektu i dokumentacja (`project_delivery`)

**Dokument**: SPEC ONLY (plan testów niezależny od specyfikacji modułu, brak kodu)
**Docelowa ścieżka w repo**: `.ai/specs/2026-10-23-project-delivery-docs-test-plan.md`
**Data**: 2026-10-23
**Autor**: Grok Bot (runner planu testów; specyfikacji modułu nie czytał); rev 4 — niezależna sesja testerska, wyłącznie na podstawie `.ai/decisions.md` z commita 865714e, bez dostępu do spek
**Rewizja**: rev 4 (2026-10-23) — dopasowanie do D116–D132 (rejestr z commita 865714e, po merge #20): projekt bez oferty i podpięcie oferty, jeden projekt na deal i na inwestycję, limit miękki quota z alertami 80/100% i blokadą od 110%, oryginał ZIP jako dowód, strzeżona funkcja usuwania i purge po potwierdzeniu, wpis atomowy importu, worker checksum, progi pomiaru RAM, faza projektu w harmonogramie; postępowania z częściami — warunkowo; poprzednio rev 3 — rejestr z commita 4f83bd4: bufor tylko w RAM (partSize × queueSize), zero plików tymczasowych także w workerze, współbieżność 1 tylko dla kolejki modułu, dwa parametry presji RAM; PoC dostawcy domyślnego jako kryterium akceptacji etapu kodu z fallbackiem na B2; poprzednio rev 2 — rejestr finalny (akceptacje, worker, linki, dostawca storage, warianty, retencja)
**Podstawa**: rejestr decyzji (`.ai/decisions.md` z commita 865714e, sekcja modułu `project_delivery` D98–D132 oraz decyzje kontekstowe), research `om-project-docs-research.md`, `odoo-project-docs.md`, `om-overlap-audit.md`, dokumentacja Backblaze B2 S3-Compatible API (stan na X 2026; dotyczy dostawcy zapasowego). Numery decyzji występują w załączniku pokrycia, w changelogu oraz w adnotacjach scenariuszy warunkowych (TC-PD-PRJ-011, TC-PD-PRJ-012).
**Dostawca storage**: „dostawca domyślny” = najtańszy w UE dostawca w pełni kompatybilny z `storage_s3` i multipartem (wg rejestru: OVHcloud Object Storage, region i klasa jako parametry wdrożenia); „dostawca zapasowy” = Backblaze B2 EU Central z adapterem bez `If-None-Match` (wyłącznie unikalne klucze). Scenariusze storage przechodzą dla obu; różnice opisane w scenariuszu.

---

## Liczniki scenariuszy

| Obszar | Liczba scenariuszy |
|--------|-------------------|
| Projekt z wygranego przetargu (TC-PD-PRJ) | 12 |
| Kamienie milowe (TC-PD-MS) | 4 |
| Dokumenty i foldery (TC-PD-DOC) | 5 |
| Rewizje dokumentów (TC-PD-REV) | 6 |
| Przepływ plików i storage (TC-PD-STOR) | 10 |
| Quota (TC-PD-QUOTA) | 9 |
| Retencja i usuwanie (TC-PD-RET) | 8 |
| Import e-Zamówienia / TED (TC-PD-IMP) | 6 |
| Worker importu (TC-PD-WRK) | 8 |
| Pamięć i wydajność (TC-PD-PERF) | 3 |
| Uprawnienia i ACL (TC-PD-ACL) | 6 |
| Linki udostępniania (TC-PD-SHARE) | 3 |
| Bez modułu harmonogramu i faza projektu w harmonogramie (TC-PD-NOSCHED) | 5 |
| Kontrakty DI między modułami (TC-PD-DI) | 5 |
| PoC storage (kryterium akceptacji etapu kodu): dostawca domyślny i zapasowy B2 (TC-PD-POC) | 7 |
| Dyski i bucket klienta (TC-PD-EXT) | 3 |
| Akceptacje (TC-PD-APR) | 4 |
| Zakres v1: rysunki, transmittale, korespondencja, protokoły (TC-PD-FLOW) | 4 |
| Zakres v2 (TC-PD-ADV) | 3 |
| Ryzyka prawne — brak funkcji (TC-PD-LEGAL) | 1 |
| Izolacja multi-tenant (TC-PD-TEN) | 3 |
| Bezpieczeństwo plików (TC-PD-SEC) | 4 |
| **Razem** | **119** (w tym 1 warunkowy poza werdyktem: TC-PD-PRJ-012) |

---

## 1. Zakres i priorytety (macierz ryzyka)

### 1.1. Ryzyka i ich mapowanie

| # | Ryzyko | Prawdopodobieństwo | Wpływ | Priorytet | Obszar | Scenariusze |
|----|--------|-------------------|-------|-----------|--------|-------------|
| R1 | Wyczerpanie RAM lub dysku VPS przez duże pliki (plik w pamięci procesu, plik tymczasowy, plik przez proxy aplikacji) | Wysoki | Krytyczny | P0 | Storage, import, worker | TC-PD-STOR-001..005, TC-PD-IMP-002, TC-PD-WRK-*, TC-PD-PERF-* |
| R2 | Utrata lub nadpisanie dokumentu (rewizja zmieniona, automatyczne usunięcie, DeleteObject na kluczu rewizji poza purge po potwierdzeniu, niepełny purge na buckecie wersjonowanym) | Średni | Krytyczny | P0 | Rewizje, retencja, usuwanie | TC-PD-REV-*, TC-PD-RET-*, TC-PD-STOR-008, TC-PD-STOR-010, TC-PD-POC-001, TC-PD-POC-003, TC-PD-POC-005, TC-PD-POC-006 |
| R3 | Produkcja ze starej rewizji rysunku | Średni | Krytyczny | P0 | Rewizje, v1 | TC-PD-REV-003, TC-PD-FLOW-001, TC-PD-APR-002 |
| R4 | Wyciek dokumentów (ACL, cudzy tenant, presigned URL, link bez wygaśnięcia) | Średni | Krytyczny | P0 | ACL, share, tenant | TC-PD-ACL-*, TC-PD-SHARE-*, TC-PD-TEN-*, TC-PD-SEC-004 |
| R5 | Duplikat projektu (per deal albo per inwestycja) albo projekt utworzony automatycznie | Średni | Wysoki | P0 | Projekt | TC-PD-PRJ-002, TC-PD-PRJ-004, TC-PD-PRJ-009, TC-PD-PRJ-010, TC-PD-PRJ-011 |
| R6 | Niekontrolowany koszt storage (quota, wersje obiektów, osierocone obiekty, niedokończone multiparty, staging) | Średni | Wysoki | P1 | Quota, worker | TC-PD-QUOTA-*, TC-PD-WRK-006, TC-PD-STOR-008, TC-PD-STOR-010, TC-PD-RET-007 |
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
| **MVP** | Projekt jawną komendą z wygranej oferty i szablonu; etapy, zadania, kamienie milowe z linkiem do pozycji kalkulacji; foldery z ACL i dziedziczeniem; dokumenty z niemutowalnymi rewizjami na S3 (presigned PUT/GET, multipart); ręczne zatwierdzenie rewizji; podgląd PDF; ręczne pliki i linki; import plików publicznych e-Zamówień (w tym ZIP strumieniowo w workerze, oryginał ZIP jako rewizja-dowód), TED tylko metadane i link; wariant storage A z quota jako limitem miękkim (alerty 80% i 100%, blokada nowych bajtów od 110%, szczyt zużycia w okresie); wersjonowanie bucketu u dostawcy domyślnego; retencja w ustawieniach i ręczne daty gwarancji/rękojmi na projekcie; usuwanie poza purge tylko strzeżoną funkcją, purge tylko po potwierdzeniu admina; projekt bez oferty i późniejsze podpięcie oferty; działanie bez modułu harmonogramu; kontrakty DI | wszystkie poza wymienionymi niżej |
| **v1** | Billing % kamieni; link i uruchomienie harmonogramu; linki udostępniania z wygaśnięciem; rejestr rysunków; akceptacje (własna walidacja progów za `ApprovalEngine`); transmittale; korespondencja i RFI; protokoły; Google Drive w trybie linku (wariant B); faza projektu w harmonogramie inwestycji; nocna kopia obiektów do B2; identyfikator części postępowania (warunkowo) | TC-PD-MS-004, TC-PD-NOSCHED-003, -004, -005, TC-PD-SHARE-*, TC-PD-APR-001, -002, -004, TC-PD-FLOW-*, TC-PD-EXT-001, TC-PD-STOR-007 (część v1), TC-PD-QUOTA-009 (część v1), TC-PD-RET-008 (część v1), TC-PD-PRJ-012 (część v1) |
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
- Role: `superadmin`, `admin`, `employee` i role własne z `createRoleFixture`. Feature'y nazwane w rejestrze używane dosłownie (`project_delivery.storage.purge`, `project_delivery.projects.manage`, `documents.upload`, `view`); pozostałe opisane funkcjonalnie („feature tworzenia projektu”, „feature administracji dokumentami”).
- Ruch do S3 w testach Integration idzie do emulatora; przeglądarka Playwright wysyła pliki bezpośrednio na adres emulatora. Asercja „bez proxy aplikacji” = brak żądań z treścią pliku do hosta aplikacji (nasłuch `page.on('request')` + liczniki bajtów procesu aplikacji).
- Proxy logujące S3 (cienki proxy HTTP przed emulatorem, tylko w testach) zapisuje metodę i operację każdego żądania; służy do asercji „zero DeleteObject na kluczach rewizji poza workerem purge po potwierdzeniu admina; każde usunięcie stagingu i obiektu osieroconej sesji zalogowane”, „`If-None-Match: *` przy zapisie u dostawcy domyślnego / brak nagłówka w adapterze B2”, „brak GetObject z procesu serwera HTTP (w workerze wyłącznie checksum i import)”. Proxy rozróżnia proces źródłowy (serwer HTTP, worker checksum, worker importu, worker purge, sweeper). Emulator uruchamiany w dwóch profilach: zgodny (warunkowy zapis obsługiwany, bucket z włączonym wersjonowaniem jak u dostawcy domyślnego) i „B2” (nagłówek odrzucany z 501, bucket wersjonowany).
- Limity (rozmiar pliku, `storage.quota_bytes`, rozmiar ZIP, `import.timeout_ms`, współczynnik kompresji) są parametrami ustawianymi w fixture na małe wartości testowe; plan nie przyjmuje wartości produkcyjnych. Stałe z rejestru: progi alertów 80% i 100% oraz próg blokady 110% `storage.quota_bytes`; progi pomiaru RAM z TC-PD-PERF-003. Parametry `storage.overage_allowed`, `storage.hard_cap_bytes` i `storage.alert_thresholds_pct` nie istnieją i nie występują w danych testowych.
- Asercje komunikatów UI na locale `pl`, klucze i18n z tłumaczeniem `en`.

---
## 3. Scenariusze testowe: Projekt z wygranego przetargu (TC-PD-PRJ) — 12 TC

#### TC-PD-PRJ-001: Utworzenie projektu jawną komendą z wygranej oferty głównej

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + E2E/UI + `pg`
- **Warunki wstępne**: Deal D-A z `closure_outcome = 'won'`; inwestycja I1 (`pc_investments`); wysłana wersja kalkulacji V1 ze snapshotem oferty, rola oferty `primary`; szablon segmentu „prefabrykacja” (3 etapy, 2 kamienie milowe, drzewo folderów z folderem przetargowym); użytkownik z feature'em tworzenia projektu
- **Kroki**:
  1. Na dealu kliknij „Wygrany przetarg → realizacja”, wybierz szablon segmentu, potwierdź
  2. Odczytaj projekt przez API i `pg`
  3. Zmień nazwę deala i dane wersji źródłowej (nowa rewizja kalkulacji), odczytaj projekt ponownie
- **Oczekiwane wyniki**:
  - Krok 1: 201, projekt z ID; przekierowanie na projekt
  - Krok 2: zapisane `deal_id`, `winning_offer_version_id` = V1, `winning_offer_snapshot_id` (snapshot oferty V1), `offer_snapshot` i `investment_id` = I1 — trzy kolumny oferty ustawione razem; `deal_snapshot` (nazwa deala, `value_amount`, `value_currency`); `segment_code` z kalkulacji; etapy, kamienie i foldery skopiowane z szablonu; tenant i organizacja z kontekstu
  - Krok 3: snapshot bez zmian; ID nadal wskazują na pierwotne rekordy
  - Wpis w `audit_logs` (komenda), zdarzenie utworzenia projektu w zakresie organizacji

#### TC-PD-PRJ-002: Jeden projekt na deal i jeden na inwestycję → 409 `PROJECT_EXISTS` z ID istniejącego

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Jak TC-PD-PRJ-001, projekt P1 już istnieje dla deala D-A (oferta V1, inwestycja I1); deal D-B wygrany z ofertą główną V2 na inwestycji I2 bez projektu; deal D-C wygrany z ofertą V3 na I1, która po utworzeniu P1 została wskazana jako główna na I1 (przełączenie roli `primary`); dwa wygrane deale D-E, D-F bez kalkulacji
- **Kroki**:
  1. API: wywołaj komendę dla D-A ponownie (UI i API)
  2. API: wyślij równolegle dwa żądania komendy dla D-B
  3. API: wywołaj komendę dla D-C (inny deal, inwestycja I1 ma już projekt); osobno dwa równoległe żądania dla D-C
  4. API: utwórz projekty bez oferty dla D-E i D-F (z `segmentCode`); potem drugi raz dla D-E
  5. `pg`: policz projekty per deal i per inwestycja; odczytaj definicje indeksów
- **Oczekiwane wyniki**:
  - Krok 1: 409 `PROJECT_EXISTS`, w treści ID P1; P1 bez zmian; w UI komunikat z linkiem do P1
  - Krok 2: jedno żądanie 201, drugie 409 `PROJECT_EXISTS` z ID projektu utworzonego przez pierwsze (wyścig `23505` mapowany na 409, nie 500)
  - Krok 3: 409 `PROJECT_EXISTS` z ID P1 (konflikt inwestycji, także w wyścigu); brak projektu dla D-C
  - Krok 4: D-E i D-F dostają po projekcie z `investment_id` NULL — puste inwestycje nie kolidują ze sobą (podlegają tylko regule per deal); drugi raz dla D-E → 409 `PROJECT_EXISTS` z ID projektu D-E
  - Krok 5: dokładnie jeden aktywny projekt na deal i na inwestycję; istnieją indeksy częściowe unikalne `pd_projects_one_per_deal` `(organization_id, tenant_id, deal_id) WHERE deleted_at IS NULL` i `pd_projects_one_per_investment` `(organization_id, tenant_id, investment_id) WHERE deleted_at IS NULL AND investment_id IS NOT NULL`; brak `NULLS NOT DISTINCT` i brak unikalności per wersja oferty

#### TC-PD-PRJ-003: Komenda odrzucona dla deala niewygranego i oferty niegłównej

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Unit (walidator)
- **Warunki wstępne**: Deal otwarty, deal przegrany, deal wygrany z ofertą `alternative`, deal wygrany z wersją roboczą bez snapshotu
- **Kroki**:
  1. Wywołaj komendę dla każdego przypadku
- **Oczekiwane wyniki**:
  - Deal otwarty i przegrany: 422 z kodem błędu i czytelnym komunikatem `pl`
  - Oferta `alternative`: 422 `OFFER_NOT_PRIMARY`
  - Wersja robocza bez snapshotu: nie powstaje projekt z ofertą wskazującą tę wersję (rejestr nie ustala, czy wynik to 422, czy projekt bez oferty — luka, §27 wniosek 25)
  - W każdym odrzuconym przypadku: brak rekordu projektu, brak folderów i obiektów w S3
  - Przycisk komendy w UI niewidoczny albo nieaktywny z podpowiedzią przyczyny
  - Deal wygrany bez kalkulacji nie jest tu przypadkiem odrzucenia — patrz TC-PD-PRJ-009

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
  - Krok 1: brak kluczy obcych z `pd_*` do tabel deali, kalkulacji i inwestycji (uwaga: reguła „ID bez constraintu DB” była zapisana w zastąpionej decyzji; obecny rejestr jej nie powtarza dla `pd_projects` — luka, §27 wniosek 26)
  - Krok 2–3: P1 otwiera się; dane z `deal_snapshot` i `offer_snapshot`; oznaczenie „rekord źródłowy niedostępny” zamiast błędu 500

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
  - Krok 2: 409 `PROJECT_EXISTS` z ID P1 (jak TC-PD-PRJ-002)
  - Oznaczenie projektu po ponownym otwarciu deala — rejestr ustala tylko flagę w harmonogramie (TC-PD-NOSCHED-005); oznaczenie w samym projekcie nadal otwarte (§27 wniosek 19)

#### TC-PD-PRJ-009: Wygrany deal bez kalkulacji → projekt bez oferty

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg` + Unit (CHECK)
- **Warunki wstępne**: Deal D-E z `closure_outcome = 'won'`, wartość i waluta deala ustawione, bez kalkulacji w OM (oferta złożona poza OM); szablony segmentów S1 i S2
- **Kroki**:
  1. API: komenda „wygrany przetarg → realizacja” dla D-E bez `segmentCode`
  2. API: ta sama komenda z `segmentCode` = S2
  3. `pg`: odczytaj projekt; spróbuj bezpośrednim `UPDATE` ustawić tylko jedną z kolumn oferty (`winning_offer_version_id`) albo dwie z trzech
  4. Odczytaj kamienie milowe projektu
- **Oczekiwane wyniki**:
  - Krok 1: 422 `SEGMENT_REQUIRED`; brak projektu
  - Krok 2: 201; `winning_offer_version_id`, `winning_offer_snapshot_id`, `offer_snapshot` i `investment_id` = NULL; wartość i waluta projektu z deala (`value_amount`, `value_currency` w `deal_snapshot`); `segment_code` = S2 i struktura z szablonu S2
  - Krok 3: naruszenie CHECK — trzy kolumny oferty są razem NULL albo razem ustawione
  - Krok 4: kamienie milowe bez linków do pozycji i sekcji oferty (nie ma czego linkować)
  - Projekt powstaje wyłącznie jawną komendą (jak TC-PD-PRJ-004)

#### TC-PD-PRJ-010: Późniejsze podpięcie oferty do projektu bez oferty

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Projekt P-E z TC-PD-PRJ-009 (bez oferty, deal D-E); w D-E kalkulacja z wersją ze snapshotem: oferta O1 `primary` na inwestycji I3 bez projektu, oferta O2 `alternative`; projekt P1 (z ofertą, inwestycja I1); projekt P-F bez oferty dla deala D-F, którego oferta `primary` jest na inwestycji I1
- **Kroki**:
  1. `POST /api/project-delivery/projects/:id/winning-offer` dla P-E z O2
  2. To samo z O1
  3. To samo ponownie dla P-E (projekt ma już ofertę); to samo dla P1
  4. Podpięcie dla P-F (inwestycja I1 ma już projekt P1); osobno dwa równoległe podpięcia dwóch projektów bez oferty do ofert na tej samej inwestycji bez projektu
  5. Użytkownik bez uprawnienia do zarządzania projektem wywołuje podpięcie
- **Oczekiwane wyniki**:
  - Krok 1: 422 `OFFER_NOT_PRIMARY`; P-E bez zmian
  - Krok 2: 200; trzy kolumny oferty ustawione razem, `investment_id` = I3; wpis w `audit_logs` (komenda `projects.link_winning_offer`)
  - Krok 3: 409 `OFFER_ALREADY_LINKED`
  - Krok 4: 409 `PROJECT_EXISTS` z ID P1; w wyścigu jedno podpięcie się udaje, drugie 409 `PROJECT_EXISTS` z ID zwycięzcy (`23505` → 409)
  - Krok 5: 403 (nazwa feature'a dla tej komendy nie jest w rejestrze — luka, §27 wniosek 27)

#### TC-PD-PRJ-011: Kontrolny — jedno postępowanie = jeden deal; kolejne ogłoszenia aktualizują deal

> **Adnotacja (konflikt D31 ↔ D132)**: scenariusz sprawdza regułę obowiązującą do decyzji Marka w sprawie D31: jedno postępowanie (`tender_id`) = jeden deal, kolejne ogłoszenia aktualizują deal i dodają interakcję. Dla postępowań bez części reguła obowiązuje niezależnie od tej decyzji. Krok 3 (postępowanie z częściami) zostanie zastąpiony przez TC-PD-PRJ-012, jeśli Marek przyjmie D132.

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Push n8n postępowania T1 (bez części) i postępowania T2 z dwiema częściami; deal T1 wygrany, projekt P-T1 utworzony
- **Kroki**:
  1. Wyślij kolejne ogłoszenie T1 (zmiana treści, ogłoszenie o wyniku)
  2. Wywołaj komendę „wygrany przetarg → realizacja” dla deala T1 ponownie
  3. Wyślij ogłoszenia T2 (obie części); oznacz deal T2 jako wygrany; wywołaj komendę dwa razy (z różnym wyborem części w UI, jeśli UI na to pozwala)
- **Oczekiwane wyniki**:
  - Krok 1: ten sam deal zaktualizowany (bez nowego deala), nowa interakcja na dealu; projekt P-T1 bez zmian
  - Krok 2: 409 `PROJECT_EXISTS` z ID P-T1
  - Krok 3: jeden deal dla T2; najwyżej jeden projekt (drugie wywołanie → 409 `PROJECT_EXISTS`); liczby inwestycji rejestr dla tego wariantu nie ustala — TC jej nie sprawdza

#### TC-PD-PRJ-012: WARUNKOWY — części postępowania jako osobne inwestycje, deale i projekty

> **WARUNKOWY (D132; zależy od decyzji Marka w sprawie D31)**: obowiązuje dopiero po decyzji Marka rozstrzygającej konflikt z D31. Do tej decyzji obowiązuje TC-PD-PRJ-011, a ten scenariusz **nie wchodzi do werdyktu** (§26) i nie jest wykonywany jako kryterium akceptacji.

- **Priorytet**: P1 | **Etap**: MVP (osobna inwestycja i deal na część, `tender_notice_number`), v1 (identyfikator części) | **Poziom**: Integration + API + `pg`
- **Warunki wstępne**: Import z e-Zamówień postępowania z numerem ogłoszenia N i dwiema częściami (1, 2); handlowiec zakłada inwestycje z danych importu
- **Kroki**:
  1. Załóż inwestycje dla części 1 i 2 z danych importu; odczytaj `pc_investments.tender_notice_number`; spróbuj go zmienić
  2. Każda część ma własny deal i własną ofertę `primary` na swojej inwestycji; oznacz oba deale jako wygrane; wywołaj komendę dla obu
  3. Filtruj inwestycje po numerze ogłoszenia N
  4. v1: odczytaj identyfikatory dopasowania w `pc_investment_identifiers`; spróbuj dodać drugi identyfikator o tej samej parze `(source, value)`
- **Oczekiwane wyniki**:
  - Krok 1: dwie inwestycje ze wspólnym `tender_notice_number` = N (bez unikalności — oba zapisy przechodzą); po założeniu pole tylko do odczytu (zmiana odrzucona, wartość bez zmian)
  - Krok 2: dwa deale, dwa projekty, każdy na swojej inwestycji; brak 422 `OFFER_NOT_PRIMARY` (każda część ma własną `primary`, zasady primary per inwestycja)
  - Krok 3: obie inwestycje na liście; numer nie bierze udziału w dopasowaniu
  - Krok 4 (v1): `source = 'bzp_notice_part'`, `value = 'N#1'` i `'N#2'`; brak identyfikatora `bzp_notice_number` z samym N; duplikat `(source, value)` odrzucony

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
  - Metadane: projekt, folder, typ dokumentu, nazwa, rozmiar, MIME, autor, data, klucz obiektu, partycja `projectDocs`; `sha256` = NULL zaraz po `complete` (przeglądarka go nie deklaruje), ustawiany później przez worker checksum (TC-PD-REV-006)
  - Obiekt istnieje w buckecie pod kluczem z prefiksem tenanta, organizacji i projektu; bucket i obiekt prywatne (anonimowy GET → 403)
  - Rozmiar w metadanych = rozmiar z HeadObject (nie z deklaracji przeglądarki)

#### TC-PD-DOC-002: Dokument-link (ręczny link zewnętrzny)

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Dodaj dokument jako link `https://…` z nazwą i typem
  2. Spróbuj dodać link `javascript:`, `file:`, `http://localhost`, adres z sieci prywatnej
- **Oczekiwane wyniki**:
  - Krok 1: dokument typu link, brak obiektu w S3, brak wpływu na quota; otwarcie w nowej karcie z `rel="noopener noreferrer"`
  - Krok 2: 422 dla schematów innych niż `https` (i `http`, jeśli speka dopuści — brak reguły w rejestrze, §27 wniosek 35); link nie jest pobierany przez serwer

#### TC-PD-DOC-003: Podgląd PDF przez presigned GET

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: E2E/UI + proxy S3
- **Kroki**:
  1. Otwórz podgląd PDF; otwórz dokument DWG
  2. Rejestruj żądania przeglądarki i proxy S3
- **Oczekiwane wyniki**:
  - PDF wyświetlony w przeglądarce z presigned GET wydanym przez `/revisions/:id/preview-url` (inline, `Content-Type: application/pdf`); żadne żądanie z treścią pliku nie trafia do hosta aplikacji; proces serwera HTTP nie wykonuje GetObject
  - DWG: tylko „Pobierz” (attachment), bez podglądu

#### TC-PD-DOC-004: Brak OCR, miniatur i ekstrakcji treści po stronie serwera w MVP

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Wgraj PDF i skan JPG do `projectDocs`; `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Brak zadań OCR, miniatur i ekstrakcji tekstu dla partycji
  - Brak GetObject z procesu serwera HTTP; w workerach wyłącznie GetObject workera checksum (strumieniowo, stała pamięć, TC-PD-REV-006) i workera importu — żadnego innego zadania czytającego treść
  - JPG bez zmniejszania rozdzielczości (sha256 policzony przez worker checksum = sha256 pliku źródłowego)

#### TC-PD-DOC-005: Foldery — drzewo, przenoszenie, nazwy

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Kroki**:
  1. Utwórz podfolder, przenieś do niego dokument, zmień nazwę folderu (polskie znaki, `/`, bardzo długa nazwa)
- **Oczekiwane wyniki**:
  - Przeniesienie i zmiana nazwy zmieniają tylko metadane; klucze obiektów w S3 bez zmian (brak CopyObject i DeleteObject)
  - Niedozwolone znaki i za długa nazwa → 422

---

## 6. Scenariusze testowe: Rewizje dokumentów (TC-PD-REV) — 6 TC

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
  3. Zakończ upload (`POST /uploads/:id/complete`), gdy rozmiar obiektu z HeadObject różni się od zadeklarowanego `sizeBytes` ponad tolerancję (parametr); osobno: dołącz do żądania pole sha256
  4. Profil zgodny: wyślij drugi raz presigned PUT na klucz już zapisanej rewizji (ten sam URL)
- **Oczekiwane wyniki**:
  - Krok 1: klucze generuje serwer, unikalne, z losowym składnikiem
  - Krok 2: klucz z żądania ignorowany albo 422
  - Krok 3: 422 `UPLOAD_SIZE_MISMATCH`; rewizja nie powstaje; rezerwacja quota zwolniona (ledger, TC-PD-QUOTA-004); obiekt traktowany jak osierocony — usuwa go sweeper przez strzeżoną funkcję (TC-PD-STOR-008, TC-PD-RET-007), z wpisem w logu. Przeglądarka nie deklaruje sha256 w MVP: pole ignorowane albo odrzucone, `sha256` rewizji liczy wyłącznie worker
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

#### TC-PD-REV-006: Worker checksum — sha256 rewizji z uploadu przeglądarki

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3 + Performance (RSS)
- **Warunki wstępne**: Kolejka `project_delivery:checksum` (niski priorytet); pliki S i L (L wielokrotnie większy)
- **Kroki**:
  1. Wgraj z przeglądarki S i L; odczytaj `sha256` rewizji przed przetworzeniem kolejki
  2. `drainIntegrationQueue`; odczytaj `sha256`; mierz RSS workera checksum dla S i L
  3. Zakolejkuj kilka rewizji naraz; rejestruj przedziały wykonania zadań checksum
  4. Spróbuj zmienić `sha256` ustawionej rewizji (API i ponowne zadanie checksum dla tej rewizji)
  5. Zaimportuj plik z e-Zamówień
- **Oczekiwane wyniki**:
  - Krok 1: `sha256` = NULL
  - Krok 2: `sha256` = sha256 pliku źródłowego; odczyt przez jeden strumieniowy GetObject po `complete` (proxy S3: proces = worker checksum); przyrost RSS dla L ≈ dla S (stała pamięć); zero plików tymczasowych
  - Krok 3: współbieżność 1 — przedziały się nie nakładają
  - Krok 4: wartość bez zmian (ustawiana raz, potem niezmienna)
  - Krok 5: rewizja z importu ma sha256 policzony w locie przez worker importu; brak zadania checksum i brak dodatkowego GetObject dla tej rewizji

---
## 7. Scenariusze testowe: Przepływ plików i storage (TC-PD-STOR) — 10 TC

#### TC-PD-STOR-001: Mały plik — presigned PUT z przeglądarki bezpośrednio do S3

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + proxy S3
- **Kroki**:
  1. Wgraj plik poniżej progu multipart; rejestruj żądania przeglądarki (`page.on('request')`), proxy S3 i liczniki bajtów odebranych przez proces aplikacji
- **Oczekiwane wyniki**:
  - Przeglądarka: żądanie do API aplikacji po URL (bez treści pliku), PUT treści na host S3, żądanie zakończenia do API (bez treści)
  - Bajty odebrane przez proces aplikacji ≪ rozmiar pliku (tylko JSON metadanych)
  - Presigned PUT ma krótką ważność, podpisany `Content-Type` i (jeśli dostawca pozwala) długość; PUT z innym `Content-Type` → 403
  - Dostawca domyślny: presigned PUT podpisany z `If-None-Match: *`; adapter B2: bez tego nagłówka
  - Upload wyłącznie presigned PUT przez trasę modułu `/api/project-delivery/uploads…`; presigned POST nie jest wydawany (TC-PD-ACL-006)

#### TC-PD-STOR-002: Duży plik — multipart z przeglądarki przez presigned URL części

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: E2E/UI + Integration + proxy S3
- **Warunki wstępne**: Plik testowy powyżej progu multipart (próg i rozmiar części to parametry); CORS bucketu z `ExposeHeaders: ETag`
- **Kroki**:
  1. Rozpocznij upload: API tworzy multipart i zwraca presigned URL części
  2. Wyślij połowę części; przerwij (zamknij kartę); otwórz ponownie i wznów
  3. Zakończ upload
  4. Rozpocznij drugi upload i anuluj go w UI
- **Oczekiwane wyniki**:
  - Krok 1–3: części wysyłane przez przeglądarkę na host S3; wznowienie korzysta z listy wysłanych części (ListParts), nie wysyła ich ponownie; CompleteMultipartUpload z ETagami części; jeden obiekt, sha256 (po workerze checksum) zgodny z plikiem
  - Krok 4: AbortMultipartUpload; brak obiektu i niedokończonego uploadu w ListMultipartUploads
  - Proces aplikacji nie odbiera treści części; brak żądań z treścią do hosta aplikacji

#### TC-PD-STOR-003: Pobranie przez presigned GET

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI + proxy S3
- **Kroki**:
  1. Pobierz plik o nazwie z polskimi znakami i spacją („Protokół odbioru – część 1.pdf”)
  2. Użyj tego samego URL po upływie ważności
  3. Zmień w URL parametr `response-content-disposition` lub klucz
- **Oczekiwane wyniki**:
  - Krok 1: `/revisions/:id/download` odpowiada 302 na presigned GET (wydany per żądanie po sprawdzeniu ACL); plik pobrany prosto z S3 z `Content-Disposition: attachment; filename*=UTF-8''…` i poprawną nazwą
  - Krok 2: 403 z S3
  - Krok 3: 403 (podpis nieważny)
  - Proces serwera HTTP nie wykonuje GetObject (proxy S3)

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
  3. Odczytaj ustawienia organizacji przez API i `pg`; spróbuj zapisać w ustawieniach pole wyglądające na klucz dostępowy albo sekret
  4. Uruchom bez kluczy dostępowych
- **Oczekiwane wyniki**:
  - Krok 1: zero sekretów; zero zakodowanych endpointów i nazw bucketów w kodzie modułu
  - Krok 2: zapis i odczyt działają z każdą konfiguracją bez zmian kodu (dowolny dostawca zgodny z S3)
  - Krok 3: ustawienia zawierają najwyżej endpoint, region, bucket i wariant; brak access key i secret w odpowiedzi i w `module_configs`; próba zapisu pola wyglądającego na klucz → 422; poświadczenia wariantu A wyłącznie ze zmiennych środowiskowych wdrożenia (`credentialsEnvPrefix`)
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

#### TC-PD-STOR-008: Sweeper — wygasłe sesje uploadu, obiekty osierocone i wyścig z `complete`

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3
- **Warunki wstępne**: Ważność sesji uploadu jako parametr (mała wartość testowa); zegar testowy
- **Kroki**:
  1. Wykonaj presigned PUT bez wywołania `complete` (obiekt istnieje, sesja `reserved`); rozpocznij multipart i porzuć go
  2. Odczytaj zużycie i rezerwacje organizacji
  3. Przesuń zegar za ważność sesji; uruchom sweeper
  4. Wyścig: sesja z zakończonym PUT; równolegle `complete` i sweeper (powtórz wielokrotnie, oba porządki)
  5. Sesja zakończona `complete` (rewizja wskazuje klucz), potem przesunięcie zegara i sweeper
- **Oczekiwane wyniki**:
  - Krok 2: zużycie = rewizje do potwierdzonego purge; limit sprawdzany na `used + reserved`, gdzie `reserved` = rezerwacje sesji w stanie `reserved`
  - Krok 3: przejście sesji `reserved → expired` pod advisory lockiem per organizacja; rezerwacja zwolniona; obiekt osieroconej sesji `expired` bez rewizji usunięty strzeżoną funkcją (na buckecie wersjonowanym: ListObjectVersions + DeleteObject z `VersionId` dla każdej wersji i markera); każde usunięcie w logu; porzucony multipart przerwany AbortMultipartUpload (to nie jest usunięcie dokumentu)
  - Krok 4: jeśli sweeper był pierwszy — `complete` odrzucony (sesja nie jest w stanie `reserved`; kod błędu rejestr nie ustala — §27 wniosek 28), brak rewizji; jeśli `complete` był pierwszy — sesja nie przechodzi w `expired`, obiekt nietknięty; w żadnym przebiegu obiekt rewizji nie jest usunięty
  - Krok 5: zero DeleteObject na kluczu rewizji (sprawdzenie braku rewizji w tej samej transakcji co przejście stanu)

#### TC-PD-STOR-009: Limit rozmiaru, dostawca domyślny i zapasowy jako parametry

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + Unit
- **Kroki**:
  1. Ustaw w fixture limit rozmiaru pliku L; zażądaj presign dla pliku o deklarowanym rozmiarze L+1
  2. Zadeklaruj rozmiar mniejszy niż faktyczny i wyślij większy plik
  3. Odczytaj domyślną konfigurację storage (bez nadpisań)
- **Oczekiwane wyniki**:
  - Krok 1: 413 albo 422 przed wydaniem URL; brak multipartu w S3
  - Krok 2: S3 odrzuca nadmiarowe dane (podpisana długość części) albo `complete` porównuje rozmiar z HeadObject z deklaracją → 422 `UPLOAD_SIZE_MISMATCH`, rewizja nie powstaje, rezerwacja zwolniona (TC-PD-REV-002)
  - Krok 3: domyślny dostawca z konfiguracji wdrożenia (OVHcloud, region UE i klasa jako parametry); przełączenie na zapasowy B2 włącza adapter bez `If-None-Match`; limit nie ma wartości zakodowanej w module (pochodzi z konfiguracji)

#### TC-PD-STOR-010: Reguły cyklu życia bucketu plików projektu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static (konfiguracja wdrożenia) + Integration (emulator, oba profile) + PoC
- **Kroki**:
  1. Static: odczytaj konfigurację lifecycle bucketu z procedury wdrożenia (dostawca domyślny i B2)
  2. Integration: w emulatorze wygaś prefiks `staging/` (zegar testowy), zostaw niedokończony multipart, wgraj rewizje dokumentów w kilku folderach
- **Oczekiwane wyniki**:
  - Krok 1: na prefiksie dokumentów zero reguł usuwania (Expiration, NoncurrentVersionExpiration) i zero reguł zmiany klasy (Transition); dozwolone wyłącznie: `AbortIncompleteMultipartUpload` (na B2 `daysFromStartingToCancelingUnfinishedLargeFiles`) i wygaszanie prefiksu `staging/`
  - Na buckecie wersjonowanym wygaszanie `staging/` obejmuje także wersje niebieżące i markery usunięcia
  - Krok 2: obiekty i wersje rewizji nietknięte; staging wygaszony; multipart przerwany; reguły działają tylko jako zapas za sweeperem (sweeper sprząta pierwszy, TC-PD-STOR-008)

---

## 8. Scenariusze testowe: Quota (TC-PD-QUOTA) — 9 TC

#### TC-PD-QUOTA-001: Zużycie liczone per organizacja z rozmiaru obiektu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Wgraj trzy pliki (w tym multipart) i dwa linki; wgraj nową rewizję jednego pliku
  2. Soft delete jednego dokumentu, jednego folderu z dokumentem i projektu testowego
  3. Odczytaj zużycie organizacji (API i ustawienia)
- **Oczekiwane wyniki**:
  - `used` = suma `size_bytes` wszystkich rewizji (rozmiar z HeadObject) do potwierdzonego purge; linki = 0
  - Krok 2: zużycie bez zmian — soft delete dokumentu, folderu albo projektu nie zmniejsza `used`
  - Zużycie per organizacja, nie per tenant (TC-PD-QUOTA-006)

#### TC-PD-QUOTA-002: Limit miękki — upload ponad 100% przechodzi, brak konfiguracji quota → 422

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Integration + Static
- **Warunki wstępne**: Wariant A, `storage.quota_bytes` = Q (parametr planu, mała wartość testowa); `used` = 0,95 × Q; organizacja Z bez `storage.quota_bytes`
- **Kroki**:
  1. Zażądaj presign i zakończ upload pliku, po którym `used` = 1,05 × Q
  2. Dodaj link; pobierz i podejrzyj istniejący plik; zatwierdź rewizję
  3. Uruchom wszystkie zadania okresowe modułu
  4. W organizacji Z zażądaj presign
  5. Static: wyszukaj w kodzie, seedzie i danych testowych parametry `storage.overage_allowed`, `storage.hard_cap_bytes`, `storage.alert_thresholds_pct` oraz wartości limitu i stawek
- **Oczekiwane wyniki**:
  - Krok 1: 201 — limit miękki, brak trybów „blokada/dopłata”; nadwyżka ponad 100% rozliczana w okresie (TC-PD-QUOTA-007)
  - Krok 2: działa
  - Krok 3: brak automatycznego usuwania czegokolwiek (zero DeleteObject na kluczach rewizji)
  - Krok 4: 422 `STORAGE_QUOTA_NOT_CONFIGURED`; brak URL
  - Krok 5: zero trafień (parametry nie istnieją; wartości tylko w konfiguracji planu)

#### TC-PD-QUOTA-003: Blokada nowych bajtów od 110% — 413 `STORAGE_QUOTA_EXCEEDED`

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + Integration + E2E/UI + proxy S3
- **Warunki wstępne**: Wariant A, `storage.quota_bytes` = Q; `used` = 1,05 × Q; subskrybent eventów modułu
- **Kroki**:
  1. Zażądaj presign dla pliku o rozmiarze, przy którym `used + reserved + sizeBytes` > 1,1 × Q
  2. Zażądaj presign dla pliku, przy którym suma = dokładnie 1,1 × Q
  3. Dodaj link; pobierz i podejrzyj istniejący plik
  4. Import ZIP z wpisem, który przekroczyłby 1,1 × Q, i wpisami mieszczącymi się
- **Oczekiwane wyniki**:
  - Krok 1: 413 `STORAGE_QUOTA_EXCEEDED` z `usedBytes`, `limitBytes`, `requestedBytes`; bez URL; proxy S3: brak obiektu i multipartu; komunikat `pl`; brak eventu (eventu `quota_exceeded` nie ma)
  - Krok 2: przechodzi (blokada dopiero powyżej 1,1 × Q)
  - Krok 3: działa — odczyt, pobieranie, podgląd i dokumenty-linki nie są blokowane
  - Krok 4: wpis przekraczający pominięty z powodem `quota`, pozostałe zaimportowane; status importu `partial`

#### TC-PD-QUOTA-004: Równoległe rezerwacje na progu blokady 110%

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Kroki**:
  1. Dwóch użytkowników jednocześnie żąda presign (multipart); każdy mieści się osobno poniżej 1,1 × Q, razem nie
  2. Pierwszy anuluje upload; drugi ponawia żądanie
  3. Zakończ upload, którego obiekt (HeadObject) jest większy od rezerwacji ponad tolerancję
- **Oczekiwane wyniki**:
  - Krok 1: rezerwacja przy wydaniu URL pod advisory lockiem per organizacja: jeden 201, drugi 413 `STORAGE_QUOTA_EXCEEDED`; suma rezerwacji nigdy nie przekracza progu po cichu
  - Krok 2: abort zwalnia rezerwację; ponowione żądanie przechodzi
  - Krok 3: 422 `UPLOAD_SIZE_MISMATCH`, bez rewizji, rezerwacja zwolniona (TC-PD-REV-002)

#### TC-PD-QUOTA-005: Alerty 80% i 100% — event `project_delivery.storage.quota_threshold_reached`

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Warunki wstępne**: `storage.quota_bytes` = Q; subskrybent eventów; admin organizacji
- **Kroki**:
  1. Zatwierdź zużycie (complete uploadu) z `used` 0,79 × Q → 0,81 × Q; potem kolejny upload w tym samym przedziale
  2. Przy dużej rezerwacji niezakończonej (`reserved` > 0,2 × Q) sprawdź, czy próg liczy rezerwacje
  3. Jedno zatwierdzenie z 0,7 × Q → 1,02 × Q (przez oba progi); osobno z rewizją z importu i z kopią oryginału ZIP
  4. Purge (TC-PD-RET-008) obniża `used` poniżej 0,8 × Q; ponowne przekroczenie 80%
- **Oczekiwane wyniki**:
  - Krok 1: jeden event z ID organizacji i progiem 80 oraz powiadomienie admina; kolejny upload w przedziale — brak eventu
  - Krok 2: próg liczony od `used` (rezerwacje się nie liczą) — brak eventu z samej rezerwacji
  - Krok 3: dwa eventy (80 i 100) z jednego zatwierdzenia; każdy rodzaj zatwierdzenia wyzwala ocenę progu
  - Krok 4: próg uzbrojony ponownie po spadku; nowe przejście → nowy event; brak osobnego stanu „alert wysłany” w `pg`
  - Payload eventu bez danych plików i URL

#### TC-PD-QUOTA-006: Ledger per organizacja; tenant tylko jako raport

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg`
- **Warunki wstępne**: Organizacje A i B w jednym tenancie z różnym `storage.quota_bytes`; `OM_ATTACHMENT_TENANT_QUOTA_MB` ustawione na małą wartość
- **Kroki**:
  1. Wgraj pliki w A do progu blokady; w B wgraj pliki
  2. Odczytaj raport zużycia tenanta
  3. Wgraj w A plik projektu o rozmiarze większym niż `OM_ATTACHMENT_TENANT_QUOTA_MB` (poniżej quota A); uruchom `reconcileTenantS3Objects`
- **Oczekiwane wyniki**:
  - Krok 1: A zablokowana (413), B działa — niezależne quota i rezerwacje (`pd_upload_sessions`)
  - Krok 2: zużycie tenanta = suma ledgerów A i B, wyłącznie raport (bez limitu i blokady na poziomie tenanta)
  - Krok 3: limit `attachments` nie dotyczy plików projektu; reconcile nie widzi bucketu `projectDocs`

#### TC-PD-QUOTA-007: Szczyt zużycia w okresie rozliczeniowym i nadwyżka

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Integration + `pg` + Static
- **Warunki wstępne**: Okres rozliczeniowy ustawiony w fixture (długość okresu i `storage.overage_rate` to parametry cennika bez wartości); `storage.quota_bytes` = Q
- **Kroki**:
  1. W okresie O1: `used` rośnie do 1,08 × Q, potem purge obniża do 0,9 × Q
  2. Okres O2: `used` stale poniżej Q
  3. Odczytaj `pd_storage_usage_periods` dla organizacji A i B
  4. Static: brak stawki i długości okresu zakodowanych w module; brak generowania faktur w module
- **Oczekiwane wyniki**:
  - Krok 3: O1 — szczyt = 1,08 × Q, nadwyżka = max(0, szczyt − Q) = 0,08 × Q; O2 — nadwyżka 0; zapis per organizacja i okres
  - Kwota nadwyżki nie jest liczona w teście (brak wartości stawki — brak werdyktu kwotowego); fakturowanie poza modułem
  - Krok 4: zero trafień

#### TC-PD-QUOTA-008: „Archiwum dowodowe” w widoku zużycia

- **Priorytet**: P2 | **Etap**: MVP | **Poziom**: Integration + E2E/UI
- **Kroki**:
  1. Dwa importy ZIP w dwóch projektach (oryginały zachowane jako rewizje, TC-PD-IMP-002); ręczne pliki
  2. Otwórz widok zużycia organizacji
- **Oczekiwane wyniki**:
  - Pozycja „archiwum dowodowe” = suma rozmiarów oryginałów ZIP (`pd_imports.original_revision_id`); oryginały wliczone do `used` bez wyjątków; suma pozycji widoku = `used`

#### TC-PD-QUOTA-009: Wersje obiektów w quota; nocna kopia B2 poza quota klienta

- **Priorytet**: P1 | **Etap**: MVP (wersje), v1 (kopia B2) | **Poziom**: Integration (emulator wersjonowany) + `pg`
- **Kroki**:
  1. MVP: na buckecie wersjonowanym emulatora zapisz bezpośrednio (poza aplikacją, profil bez warunkowego zapisu) drugą wersję pod kluczem rewizji testowej; odczytaj zużycie przed i po purge
  2. v1: włącz `storage.backup_copy`; uruchom nocną kopię do B2; odczytaj zużycie
- **Oczekiwane wyniki**:
  - Krok 1: quota liczy wszystkie wersje obiektu do potwierdzonego purge (pusty ListObjectVersions); po purge zużycie spada
  - Krok 2: zużycie klienta bez zmian po kopii (kopia B2 to koszt operacyjny planu); purge obejmuje też kopię (TC-PD-RET-008)

---

## 9. Scenariusze testowe: Retencja i usuwanie (TC-PD-RET) — 8 TC

#### TC-PD-RET-001: Ustawienie retencji w organizacji z podpowiedzią „koniec gwarancji i rękojmi”

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: API + E2E/UI
- **Kroki**:
  1. Admin otwiera ustawienia modułu, sekcja retencji
  2. Zapisuje regułę domyślną; employee próbuje ją zmienić
- **Oczekiwane wyniki**:
  - Domyślnie zaznaczona podpowiedź „do końca gwarancji i rękojmi”, potem archiwum; opis zaznacza, że okresy wymagają weryfikacji prawnej
  - Employee: 403
  - Ustawienie per organizacja (TC-PD-TEN-002)

#### TC-PD-RET-002: Ręczne daty gwarancji i rękojmi na projekcie

- **Priorytet**: P1 | **Etap**: MVP | **Poziom**: Unit + Integration + E2E/UI
- **Kroki**:
  1. Użytkownik z `project_delivery.projects.manage` wpisuje na karcie projektu `warranty_end_date` i `rekojmia_end_date`; odczytaj podpowiedź `retention_until`
  2. Zmień daty ręcznie
  3. Użytkownik bez `project_delivery.projects.manage` próbuje wpisać daty
  4. Projekt bez dat; lista projektów
- **Oczekiwane wyniki**:
  - Krok 1: daty zapisane tak, jak wpisano — moduł ich nie wylicza (brak dat wyliczonych z deala, umowy ani przepisów); podpowiedź retencji wg reguły organizacji, wpis w `audit_logs`
  - Krok 2: zmiana zapisana w `audit_logs`
  - Krok 3: 403
  - Krok 4: brak podpowiedzi `retention_until`; lista pokazuje „retencja nieustalona”; brak błędu

#### TC-PD-RET-003: Upływ daty retencji niczego nie usuwa

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Ustaw datę końca retencji w przeszłości (zegar testowy); uruchom wszystkie zadania okresowe modułu (w tym sweeper); `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Zero DeleteObject na kluczach rewizji (wszystkich wersji); metadane bez zmian; projekt najwyżej oznaczony „po retencji — do decyzji admina”
  - Jedyne DeleteObject w przebiegu (jeśli są) dotyczą kluczy `staging/` i obiektów osieroconych sesji `expired`, przez strzeżoną funkcję, każde zalogowane

#### TC-PD-RET-004: Soft delete i żądanie purge — uprawnienie i potwierdzenie

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: API + E2E/UI + proxy S3
- **Kroki**:
  1. Employee i admin usuwają dokument, folder i projekt (soft delete); przywróć dokument
  2. Employee (bez `project_delivery.storage.purge`) wywołuje `POST /api/project-delivery/storage/purge`
  3. Admin wywołuje purge bez potwierdzenia, z błędnym kodem projektu, z poprawnym kodem projektu
  4. Sprawdź role domyślne
- **Oczekiwane wyniki**:
  - Krok 1: dokument ukryty, obiekt i wszystkie wersje w S3, rewizje dalej w quota; przywrócenie działa. Kto może wykonać soft delete (employee czy tylko admin) — rejestr nie ustala (§27 wniosek 29)
  - Krok 2: 403; zero DeleteObject
  - Krok 3: bez potwierdzenia i z błędnym kodem → 422 `PURGE_CONFIRMATION_REQUIRED`, zero DeleteObject; z poprawnym kodem → żądanie przyjęte do kolejki purge, żadnego DeleteObject w procesie serwera HTTP (usuwa worker, TC-PD-RET-008)
  - Krok 4: `project_delivery.storage.purge` poza `defaultRoleFeatures` pracownika; ma go administrator

#### TC-PD-RET-005: Zero DeleteObject na kluczach rewizji poza workerem purge

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static + Integration + proxy S3
- **Kroki**:
  1. Static: wyszukaj w kodzie modułu wszystkie wywołania DeleteObject/DeleteObjects (reguła lint albo test grafu wywołań)
  2. Integration: import zakończony statusem `completed`, `partial`, `failed` (błąd i timeout) i `cancelled`; sweeper; reguły lifecycle (TC-PD-STOR-010); subscribery modułu
- **Oczekiwane wyniki**:
  - Krok 1: jedyne miejsca wywołania DeleteObject to strzeżona funkcja (TC-PD-RET-007) i worker purge (TC-PD-RET-008); zero DeleteObjects
  - Krok 2: proxy S3 rejestruje zero DeleteObject na kluczach rewizji (w tym rewizji oryginału ZIP w „00 Przetarg”); DeleteObject wyłącznie na kluczach `staging/{importId}/` własnego importu i obiektach osieroconych sesji `expired`, przez strzeżoną funkcję, każde w logu; AbortMultipartUpload dozwolony

#### TC-PD-RET-006: Auto-archiwizacja po retencji

- **Priorytet**: P2 | **Etap**: v2 | **Poziom**: Integration
- **Kroki**:
  1. Projekt po dacie retencji; uruchom proces archiwizacji
- **Oczekiwane wyniki**:
  - Dostawca domyślny: archiwum = eksport albo zimna klasa przechowywania dostępna w regionie (parametr; TC-PD-POC-003)
  - Zapasowy B2 (jedna klasa): archiwum = wyłącznie eksport; opcja klasy niedostępna w UI i API (422)
  - Archiwizacja tylko po potwierdzeniu admina; nigdy usunięcie; projekt tylko do odczytu
  - Zmiana klasy nie jest realizowana regułą lifecycle na prefiksie dokumentów (TC-PD-STOR-010)

#### TC-PD-RET-007: Strzeżona funkcja usuwania — dozwolone wyłącznie staging i osierocone sesje

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Unit + Integration + proxy S3 + `pg`
- **Warunki wstępne**: Organizacje A i B; import I-A (A) i I-B (B) z obiektami w `staging/`; sesja S-exp (`expired`, bez rewizji); sesja S-ref (`expired`, ale klucz wskazany przez rewizję); sesja S-res (`reserved`); rewizja R0
- **Kroki**:
  1. Wywołaj funkcję strażnika (kontekst A) z kluczami: `staging/{I-A}/…`, `storage_key` S-exp
  2. Wywołaj ją z: kluczem R0, `staging/{I-B}/…` (import innej organizacji), kluczem spoza `staging/` niebędącym kluczem sesji, `storage_key` S-ref, `storage_key` S-res, prefiksem `staging/` bez `importId`
  3. Bucket wersjonowany: usuń klucz z kroku 1, który ma dwie wersje i marker
- **Oczekiwane wyniki**:
  - Krok 1: usunięte; każde usunięcie w logu (klucz, organizacja, powód)
  - Krok 2: wyjątek w każdym przypadku; proxy S3: zero DeleteObject; brak wpisu „usunięto”
  - Krok 3: ListObjectVersions + DeleteObject z `VersionId` dla każdej wersji i markera; ponowny ListObjectVersions pusty
  - Worker importu wywołuje funkcję po `completed`, `partial`, `failed` i `cancelled` (TC-PD-WRK-008); oryginał ZIP jest wcześniej zachowany jako rewizja (TC-PD-IMP-002)

#### TC-PD-RET-008: Worker purge — usunięcie wszystkich wersji, quota dopiero po pustej liście

- **Priorytet**: P0 | **Etap**: MVP (v1: kopia B2) | **Poziom**: Integration + `pg` + proxy S3 (bucket wersjonowany)
- **Warunki wstępne**: Projekt soft-deleted z rewizjami (część z wieloma wersjami i markerem usunięcia); żądanie purge przyjęte (TC-PD-RET-004); subskrybent eventów
- **Kroki**:
  1. `drainIntegrationQueue` (kolejka purge modułu); rejestruj żądania S3
  2. Odczytaj rewizje, zużycie, `audit_logs`, eventy
  3. Purge z wstrzykniętym błędem `DeleteObject` dla jednej wersji (albo Object Lock w emulatorze)
  4. Dwa żądania purge naraz
  5. v1: purge przy włączonym `storage.backup_copy`
- **Oczekiwane wyniki**:
  - Krok 1: dla każdego klucza rewizji: ListObjectVersions z prefiksem = klucz, DeleteObject z `VersionId` dla każdej wersji i każdego markera, ponowny ListObjectVersions; DeleteObject bez `VersionId` nie jest liczony jako usunięcie
  - Krok 2: pusta lista → `purged_at` ustawione, `purge_status = purged`; dopiero wtedy `used` maleje (próg alertu uzbraja się ponownie, TC-PD-QUOTA-005); audyt: kto, kiedy, projekt, liczba obiektów, bajty; event `project_delivery.storage.purged` wyłącznie z ID (bez kluczy, nazw, URL)
  - Krok 3: niepusta lista → `purge_status = purge_failed`, rewizja dalej w quota, raport dla admina
  - Krok 4: współbieżność 1 — purge wykonywane kolejno
  - Krok 5 (v1): purge usuwa też wszystkie wersje i markery w kopii B2

---

## 10. Scenariusze testowe: Import e-Zamówienia / TED (TC-PD-IMP) — 6 TC

#### TC-PD-IMP-001: Import publicznych plików postępowania pojedynczo

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration (serwer e-Zamówień podstawiony w teście)
- **Kroki**:
  1. W projekcie uruchom import dla postępowania (ID ocds) z listą trzech plików publicznych
  2. `drainIntegrationQueue`
- **Oczekiwane wyniki**:
  - Zadanie w workerze (postęp w `progress`); każdy plik strumieniowo z HTTP do S3 (multipart dla dużych); dokumenty w folderze przetargowym ze źródłem (URL, ID postępowania, data pobrania)
  - Brak plików tymczasowych (TC-PD-STOR-005); proces serwera HTTP nie pobiera plików; sha256 każdej rewizji policzony w locie przez worker importu

#### TC-PD-IMP-002: Duży ZIP z e-Zamówień importowany strumieniowo w workerze

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + Performance + proxy S3
- **Warunki wstępne**: ZIP „pobierz wszystkie” z kilkudziesięcioma wpisami (PDF, DOCX, XLSX, katalogi, nazwy z polskimi znakami w UTF-8 i w CP852); dwa warianty źródła: pobranie z e-Zamówień i ZIP wgrany przez użytkownika do `staging/`; quota z zapasem
- **Kroki**:
  1. Uruchom import ZIP; obserwuj RSS workera (TC-PD-PERF-002), inotify (TC-PD-STOR-005) i proxy S3 (kolejność operacji)
  2. Odczytaj folder „00 Przetarg”, `pd_imports`, zużycie
  3. Spróbuj zmienić albo usunąć (soft delete + bez purge) rewizję oryginału
- **Oczekiwane wyniki**:
  - Oryginał ZIP: e-Zamówienia — pobrany do `staging/` z sha256 liczonym w locie; ZIP użytkownika — sha256 z jednego strumieniowego GetObject ze `staging/` przed kopią
  - Przed kopią rezerwacja quota na rozmiar ZIP; potem kopia po stronie S3 (`CopyObject`/`UploadPartCopy`, bez transferu treści przez worker) jako niemutowalna rewizja w „00 Przetarg”; dopiero potem rozpakowanie (proxy: kopia przed pierwszym odczytem wpisu)
  - Rozpakowanie zakresami: GetObject z `Range` — najpierw katalog centralny z końca pliku, potem każdy wpis; bez pobierania całego archiwum
  - Każdy wpis = dokument z rewizją w folderze odpowiadającym ścieżce w ZIP; nazwy poprawnie zdekodowane; wpisy multipartem do S3; RSS ograniczony; zero plików tymczasowych
  - Krok 2: `pd_imports.original_revision_id` wskazuje rewizję oryginału; oryginał liczony do `used` bez wyjątków i pokazany jako „archiwum dowodowe” (TC-PD-QUOTA-008)
  - Po zakończeniu staging usunięty strzeżoną funkcją (na buckecie wersjonowanym ze wszystkimi wersjami); rewizja oryginału nietknięta
  - Krok 3: rewizja niemutowalna; usunąć ją może tylko purge admina (TC-PD-RET-008)
  - Raport importu: liczba wpisów, utworzone rewizje, pominięte z powodem (TC-PD-WRK-008)

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
  - Drugi import tego samego `ref`: pliki z identycznym sha256 w tym samym folderze pominięte z powodem `duplicate` (raport „pominięte: duplikat”); kopia oryginału ZIP pominięta jako duplikat, jeśli w „00 Przetarg” jest rewizja z tym samym sha256 — rozpakowanie idzie dalej
  - Trzeci: zmieniony plik jako nowa rewizja istniejącego dokumentu; poprzednia rewizja nietknięta; nowy oryginał ZIP (inny sha256) jako nowa rewizja w „00 Przetarg”

#### TC-PD-IMP-006: Oryginał ZIP przy braku quota — import `failed` bez kopii i rozpakowania

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3
- **Warunki wstępne**: `storage.quota_bytes` = Q; `used` tak blisko 1,1 × Q, że `used + reserved + rozmiar ZIP` > 1,1 × Q
- **Kroki**:
  1. Uruchom import ZIP (oba warianty źródła)
  2. Odczytaj `pd_imports`, folder „00 Przetarg”, zużycie, log usunięć
- **Oczekiwane wyniki**:
  - Status `failed` z powodem `quota`; brak `CopyObject`/`UploadPartCopy`; brak odczytu wpisów; zero rewizji
  - Rezerwacja zwolniona; staging usunięty strzeżoną funkcją (zalogowane); zero DeleteObject na kluczach rewizji

---

## 11. Scenariusze testowe: Worker importu (TC-PD-WRK) — 8 TC

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
  - Kontrola po liczniku bajtów w strumieniu, nie po deklaracji z nagłówka ZIP
  - ZIP ponad limit per ZIP: `failed` przed pierwszym wpisem, z nazwą limitu w raporcie
  - Wpis ponad limit per plik: wpis pominięty z powodem `too_large`, jego multipart przerwany (AbortMultipartUpload); import idzie dalej i kończy się `partial`
  - Limity spoza rejestru (suma po rozpakowaniu, liczba wpisów, współczynnik kompresji): wpis pominięty z powodem z zamkniętej listy (`quota`, `too_large`, `encrypted`, `unsupported_method`, `duplicate`, `error`); który powód i czy import przerwać — rejestr nie ustala (§27 wniosek 30)
  - Rewizje utworzone przed pominięciem zostają; zero DeleteObject na kluczach rewizji
  - Wartości limitów pochodzą z konfiguracji (Static: brak liczb zakodowanych w module)

#### TC-PD-WRK-004: Timeout zadania

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + proxy S3
- **Kroki**:
  1. Ustaw `import.timeout_ms` na małą wartość; podstaw źródło HTTP, które wysyła dane bardzo wolno (część wpisów zdąży się zakończyć)
- **Oczekiwane wyniki**:
  - Po przekroczeniu `import.timeout_ms`: status `failed`; AbortMultipartUpload dla otwartych uploadów
  - Rewizje utworzone przed timeoutem zostają; zero DeleteObject na kluczach rewizji; staging usunięty strzeżoną funkcją (zalogowane)
  - Worker przyjmuje kolejne zadanie (brak zawieszenia)

#### TC-PD-WRK-005: Wznawianie albo abort multipartu po restarcie workera

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3
- **Kroki**:
  1. W trakcie importu dużego wpisu zabij proces workera (SIGKILL); uruchom ponownie
- **Oczekiwane wyniki**:
  - Import wznawia się od ostatniego pełnego wpisu (stan w `pd_imports` + ListParts); pełne wpisy nie są wysyłane ponownie (proxy S3: brak ponownych UploadPart dla nich)
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
#### TC-PD-WRK-008: Wpis jako jednostka atomowa; statusy importu; anulowanie

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Integration + `pg` + proxy S3
- **Warunki wstępne**: ZIP-y: poprawny; z wpisem zaszyfrowanym, wpisem z nieobsługiwaną metodą kompresji, wpisem ponad limit, duplikatem, uszkodzonym wpisem; ZIP z błędem przed pierwszym wpisem (uszkodzony katalog centralny)
- **Kroki**:
  1. Zaimportuj każdy ZIP; odczytaj status i raport
  2. Długi import: anuluj w trakcie
  3. Odczytaj rewizje, multiparty (ListMultipartUploads), staging i log usunięć po każdym przebiegu
- **Oczekiwane wyniki**:
  - Każdy wpis kończy się rewizją (`add_revision` po CompleteMultipartUpload) albo pominięciem z powodem: `encrypted`, `unsupported_method`, `too_large`, `duplicate`, `error`, `quota`; niedokończony multipart wpisu przerwany
  - Status: poprawny ZIP → `completed`; z pominięciami z powodu błędu albo limitu → `partial`; błąd przed pierwszym wpisem → `failed`; anulowanie → `cancelled`. ZIP, w którym jedyne pominięcia to `duplicate`: rejestr niejednoznaczny (`completed` „bez pominięć z błędu” vs `partial` „część pominięta”) — TC akceptuje tylko jeden z tych dwóch statusów i zapisuje go w raporcie (§27 wniosek 31)
  - Rewizje utworzone przed pominięciem, błędem i anulowaniem zostają w każdym statusie (usunąć je może tylko purge)
  - Po `failed` i `cancelled` (a także po zakończeniu) staging usunięty strzeżoną funkcją; zero DeleteObject na kluczach rewizji

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

#### TC-PD-PERF-003: Pomiar presji RAM na wersji testowej — import ZIP 250 MB, progi stałe

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Performance (instancja testowa open-mercato.pl)
- **Warunki wstępne**:
  - Wersja testowa z włączonym `storage_s3`, bucketem testowym u dostawcy domyślnego (albo B2 z adapterem, jeśli PoC dostawcy domyślnego nie przeszedł), limitem pamięci kontenera `app` jak na produkcji
  - ZIP testowy 250 MB (rozmiar testowy, nie limit)
  - Progi: `measure.worker_rss_peak_delta_bytes` = 256 MB, `measure.host_min_free_bytes` = 300 MB, `measure.host_swap_growth_bytes` = 512 MB
- **Kroki**:
  1. Zapisz bazowy RSS procesu workera, `MemAvailable` i użycie swapu hosta, liczniki restartów kontenera `app` i procesu workera
  2. Uruchom import ZIP 250 MB, równolegle zwykły ruch UI; powtórz TC-PD-PERF-001 i TC-PD-PERF-002 na wersji testowej
  3. Próbkuj przez cały pomiar: `VmHWM`/`VmRSS` workera, `MemAvailable` z `/proc/meminfo`, swap, `docker stats` kontenera `app`, dziennik jądra (OOM)
- **Oczekiwane wyniki**:
  - PASS tylko gdy jednocześnie: szczytowy przyrost RSS workera ≤ 256 MB; `MemAvailable` ≥ 300 MB przez cały pomiar; zero zabić OOM; zero restartów kontenera `app` i procesu workera; przyrost swapu hosta ≤ 512 MB
  - Przekroczenie dowolnego progu = FAIL → wniosek o osobny kontener workera z limitem pamięci
  - Kryteria z TC-PD-PERF-001/002 spełnione; brak wzrostu użycia dysku hosta
  - Raport z progami, pomiarami i werdyktem dołączony do PR jako dowód „gotowe”

---

## 13. Scenariusze testowe: Uprawnienia i ACL (TC-PD-ACL) — 6 TC

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
  - Każda operacja wymaga swojego feature'a; ustawienia i purge tylko admin (`project_delivery.storage.purge` poza `defaultRoleFeatures` pracownika); daty gwarancji i rękojmi — `project_delivery.projects.manage`; upload — `documents.upload`; pobranie i podgląd — `view`
  - Pozostałe nazwy feature'ów (utworzenie projektu, zatwierdzenie rewizji, ACL folderu, podpięcie oferty) i ich przypisanie do ról domyślnych rejestr nie ustala — macierz zapisana w raporcie testu (§27 wniosek 20)

#### TC-PD-ACL-006: Upload, pobranie i podgląd wyłącznie przez trasy modułu

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: Static + API + `pg` + proxy S3
- **Kroki**:
  1. U1 (feature `documents.upload` i `view`, ACL folderu: editor) wgrywa przez `/api/project-delivery/uploads…`, pobiera przez `/revisions/:id/download`, podgląda przez `/revisions/:id/preview-url`
  2. U2 bez `documents.upload`; U3 z feature'ami, ale bez dostępu do folderu w ACL — te same trasy
  3. Dwa kolejne żądania pobrania tej samej rewizji; odczytaj `pg` (wszystkie tabele modułu i `audit_logs`)
  4. Zażądaj presigned POST (formularz) dla uploadu
  5. Static: użycia tras `storage_s3` (`signed-url`, `signed-upload`, `download`) i metod drivera `store`, `read`, `putObject`, `toLocalPath` w kodzie modułu
- **Oczekiwane wyniki**:
  - Krok 1: upload — presigned PUT; pobranie — 302 na presigned GET; podgląd — presigned GET inline
  - Krok 2: U2 → 403 na upload; U3 → 403/404 (bez wydanego URL)
  - Krok 3: każde żądanie dostaje nowy presigned URL z krótkim TTL (parametr), podpisany przez moduł po sprawdzeniu ACL; URL nigdzie nie zapisany (zero `X-Amz-Signature` w `pg`)
  - Krok 4: brak takiej możliwości (404/422) — tylko presigned PUT
  - Krok 5: zero użyć dla plików projektu

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
  - Link do dokumentu daje dostęp tylko do rewizji określonej w specu (brak reguły w rejestrze, §27 wniosek 35; najnowsza zatwierdzona albo wskazana); reszta 404
  - Link do folderu respektuje ACL podfolderów (wg speki — brak reguły w rejestrze, §27 wniosek 35); tenant i organizacja z linku, nie z parametrów żądania

---

## 15. Scenariusze testowe: Bez modułu harmonogramu i faza projektu w harmonogramie (TC-PD-NOSCHED) — 5 TC

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
  - Krok 1: dokładnie jeden harmonogram dla I1; drugie i równoległe wywołanie zwraca istniejący rekord bez błędu (`ensureExecution` idempotentne per inwestycja, szczegóły w TC-PD-NOSCHED-005)
  - Krok 2: link do istniejącego rekordu, brak kopii
  - Brak żądań HTTP między modułami (TC-PD-DI-002)

#### TC-PD-NOSCHED-004: Wyłączenie harmonogramu po podlinkowaniu

- **Priorytet**: P1 | **Etap**: v1 | **Poziom**: Integration
- **Kroki**:
  1. Projekt z linkiem do harmonogramu; wyłącz harmonogram w organizacji; włącz ponownie
- **Oczekiwane wyniki**:
  - Po wyłączeniu: projekt działa, link ukryty; dane harmonogramu i link zachowane
  - Po włączeniu: link znów widoczny, bez zmian danych

#### TC-PD-NOSCHED-005: `ensureExecution` — faza projektu w harmonogramie inwestycji, idempotentnie

- **Priorytet**: P0 | **Etap**: v1 | **Poziom**: Integration + `pg` + Unit (kontrakt `ExecutionScheduleProvider`)
- **Warunki wstępne**: Harmonogram włączony; inwestycja I1 bez rekordu harmonogramu; I2 z rekordem w fazie `offer`; I3 z rekordem w fazie `execution` i `execution_deal_id` = NULL; projekty P1 (I1), P2 (I2), P3 (I3); projekt P-E bez oferty (bez inwestycji); drugi projekt P-X (inny `projectId`)
- **Kroki**:
  1. `ensureExecution({ investmentId: I1, dealId, projectId: P1, projectLabel })`; potem drugi raz z tym samym `projectId`; potem dwa wywołania równolegle
  2. `ensureExecution` dla I1 z `projectId` = P-X
  3. `ensureExecution` dla I2 i dla I3
  4. `findForInvestment` dla I1, I2, I3 i dla inwestycji bez rekordu
  5. P-E: spróbuj uruchomić fazę; potem podepnij ofertę (TC-PD-PRJ-010) i uruchom
  6. Otwórz ponownie deal I1 (`closure_outcome` → NULL); osobno deal inwestycji z rekordem bez fazy projektu (moduł projektów nieobecny albo harmonogram uruchomiony bez projektu)
  7. `pg`: odczytaj `ps_schedule_tasks`
- **Oczekiwane wyniki**:
  - Krok 1: pierwsze — rekord inwestycji, faza `execution` i zadanie-podsumowanie WBS z `execution_project_id` = P1, `created` = true; drugie — to samo `scheduleId` i `phaseTaskId`, `created` = false; wyścig (`23505`) → istniejące ID jako sukces
  - Krok 2: 409 `PROJECT_PHASE_EXISTS`
  - Krok 3: I2 — faza `execution` przez `create_execution` z `dealId`; I3 — faza bez zmian, `execution_deal_id` ustawione (było NULL); wywołanie dla rekordu z już ustawionym `execution_deal_id` go nie zmienia
  - Krok 4: `{ scheduleId, phase, phaseTaskId, executionProjectId }` albo `null`
  - Krok 5: brak fazy, dopóki projekt nie ma inwestycji; po podpięciu oferty faza powstaje
  - Krok 6: `reopened_at` ustawione na zadaniu fazy projektu rekordu, którego faza `execution` została włączona z tym dealem (`execution_deal_id`), nie na rekordzie; rekord bez fazy projektu — flaga na rekordzie; bez usuwania i archiwizacji danych. Czyszczenie flagi po ponownym `won` — rejestr nie ustala (§27 wniosek 32)
  - Krok 7: unikalność `(schedule_id) WHERE execution_project_id IS NOT NULL` — jedno zadanie fazy projektu na rekord; `execution_project_id` bez FK między modułami
  - Zero HTTP między modułami (TC-PD-DI-002)

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

Wykonywane na etapie kodu skryptem poza repo (poświadczenia ze zmiennych środowiska), na bucketach testowych u dostawcy domyślnego (OVHcloud Object Storage, region UE — parametr; **wersjonowanie bucketu włączone**, jak w MVP) i u dostawcy zapasowego (Backblaze B2 EU Central, bucket zawsze wersjonowany). Wymóg „wersjonowanie wyłączone” nie obowiązuje. TC-PD-POC-001..003 są kryterium akceptacji: zgodność OVHcloud (warunkowy PUT, presigned PUT/GET, multipart i jego wznawianie) potwierdza PoC, nie sama dokumentacja. Jeśli którykolwiek z nich nie przejdzie, domyślnym dostawcą zostaje B2 z adapterem; wtedy TC-PD-POC-004..006 muszą przejść, a raport dokumentuje przełączenie. Wynik: raport z odpowiedziami HTTP.

#### TC-PD-POC-001: Dostawca domyślny — operacje `storage_s3`, zapis warunkowy i usuwanie wersji na buckecie wersjonowanym

- **Priorytet**: P0 | **Etap**: MVP | **Poziom**: PoC
- **Warunki wstępne**: Bucket testowy OVHcloud z włączonym wersjonowaniem
- **Kroki**:
  1. PutObject z `If-None-Match: *` na nowy klucz, potem na ten sam klucz
  2. Presigned PUT podpisany z `If-None-Match: *`: wyślij plik z `curl` i z przeglądarki (CORS); wyślij drugi raz na ten sam klucz
  3. GetObject, ListObjectsV2, presigned GET, presigned GET po wygaśnięciu
  4. Obiekt testowy skryptu z kilkoma wersjami i markerem usunięcia (DeleteObject bez `VersionId`): ListObjectVersions, DeleteObject z `VersionId` dla każdej wersji i markera, ponowny ListObjectVersions
- **Oczekiwane wyniki**:
  - Krok 1–2: na buckecie wersjonowanym pierwszy zapis 200, drugi 412; obiekt bez zmian, brak nowej wersji
  - Krok 3: operacje zgodne z S3; GET po wygaśnięciu 403; sha256 zgodny
  - Krok 4: DeleteObject bez `VersionId` tworzy tylko marker (wersje zostają); po usunięciu każdej wersji i markera ListObjectVersions pusty — wejście dla purge (TC-PD-RET-008); quota liczy wszystkie wersje do pustej listy
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
  2. Sprawdź klasy przechowywania dostępne w wybranym regionie (zimne klasy do archiwum) i sposób zmiany klasy obiektu (operacja jawna, nie reguła lifecycle)
  3. Ustaw lifecycle: AbortIncompleteMultipartUpload oraz wygaszanie prefiksu `staging/` obejmujące wersje niebieżące i markery usunięcia
- **Oczekiwane wyniki**:
  - Krok 1: nagłówki odpowiedzi zgodne z parametrami
  - Krok 2: lista klas dostępnych w regionie w raporcie (wejście dla archiwizacji v2, TC-PD-RET-006)
  - Krok 3: obie reguły przyjęte; na prefiksie dokumentów żadnej reguły usuwania ani zmiany klasy (TC-PD-STOR-010); obiekty i wersje poza `staging/` nietknięte

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
  2. Zapisz obiekt dwa razy pod tym samym kluczem; DeleteObject po kluczu (obiekt testowy); ListObjectVersions; potem DeleteObject z `VersionId` dla każdej wersji i markera; ponowny ListObjectVersions
  3. Lifecycle B2: `daysFromStartingToCancelingUnfinishedLargeFiles` i wygaszanie prefiksu `staging/` (z wersjami niebieżącymi i markerami); osobno próba reguły Transition
- **Oczekiwane wyniki**:
  - Krok 1: nagłówki zgodne; jeśli B2 ich nie respektuje — zapis do speki i alternatywa (metadane `Content-Disposition` przy uploadzie)
  - Krok 2: usunięcie po kluczu ukrywa najnowszą wersję (marker); po usunięciu wszystkich wersji z `VersionId` lista pusta — purge przy fallbacku działa jak u dostawcy domyślnego; quota liczy wszystkie wersje do pustej listy
  - Krok 3: reguły przerywania multipartów i wygaszania `staging/` przyjęte; Transition odrzucone albo niedostępne (jedna klasa) — przy fallbacku archiwum tylko jako eksport

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
  1. Skonfiguruj partycję organizacji na bucket klienta; wgraj plik
  2. Druga organizacja wgrywa plik
  3. `pg`, logi aplikacji, eventy i repo: wyszukaj poświadczenia klienta
- **Oczekiwane wyniki**:
  - Plik organizacji 1 w buckecie klienta, organizacji 2 w naszym
  - Poświadczenia w bazie wyłącznie zaszyfrowane mechanizmem szyfrowania danych OM (mechanizm wybierany w v2), poza `module_configs`; w API tylko maska; zero wystąpień jawnych w logach, eventach i repo
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
  1. Dwie organizacje w jednym tenancie: różne `storage.quota_bytes`, reguła retencji; upload w obu
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
  - Niezgodność rozszerzenia i typu oznaczona albo odrzucona (wg speki — brak reguły w rejestrze, §27 wniosek 35)

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
| **Deale i kalkulacje** | wygrany z ofertą główną (wysłana wersja ze snapshotem), wygrany z `alternative`, wygrany bez kalkulacji (dwa), wygrany z wersją roboczą, otwarty, przegrany, deal z przełączoną rolą `primary` na zajętej inwestycji; postępowanie bez części i z dwiema częściami (TC-PD-PRJ-011, warunkowo TC-PD-PRJ-012); kilka inwestycji | 12 |
| **Szablony** | dwa segmenty z różnymi etapami, kamieniami, drzewami folderów i ACL | 2 |
| **Pliki** | mały PDF, JPG skan, DWG, HTML, SVG ze skryptem, PDF z JS, plik S i L do pomiaru RAM, ZIP 250 MB do pomiaru na wersji testowej (generowane w teście, nie w repo) | 10 |
| **ZIP** | e-Zamówienia poprawny (UTF-8 i CP852), ZIP S i L, bomb, traversal, symlink, zagnieżdżony, zaszyfrowany, z nieobsługiwaną metodą kompresji, z wpisem ponad limit, uszkodzony (katalog centralny i pojedynczy wpis) | 11 |
| **Podstawione serwisy** | serwer HTTP udający e-Zamówienia (szybki i wolny), API TED z BT-15, Google Drive (v1) | 3 |
| **Storage** | emulator S3 w profilu zgodnym i „B2” (oba wersjonowane) + proxy logujące operacje i proces źródłowy; bucket testowy u dostawcy domyślnego z włączonym wersjonowaniem (PoC, wersja testowa) i u zapasowego B2 (PoC) | 4 |
| **Parametry** | limit pliku, `storage.quota_bytes`, limity ZIP, `import.timeout_ms`, partSize, queueSize, ważność presigned URL i sesji uploadu, tolerancja rozmiaru, okres rozliczeniowy, maksymalna ważność linku — małe wartości testowe; stałe z rejestru: alerty 80%/100%, blokada 110%, progi pomiaru RAM (TC-PD-PERF-003); bez `storage.overage_allowed`, `storage.hard_cap_bytes`, `storage.alert_thresholds_pct` | — |

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
| **Pokrycie P0** | 100% scenariuszy P0 etapu MVP przechodzi (scenariusze warunkowe poza werdyktem) | TBD |
| **Scenariusze warunkowe** | TC-PD-PRJ-012 nie wchodzi do werdyktu, dopóki Marek nie rozstrzygnie konfliktu D31 ↔ D132; do tego czasu obowiązuje kontrolny TC-PD-PRJ-011 | TBD |
| **Pamięć** | Szczytowy RSS aplikacji i workera niezależny od rozmiaru pliku dla dwóch rozmiarów; worker ≤ partSize × queueSize + bufor dekompresji + narzut (TC-PD-PERF-001..002); pomiar na wersji testowej z importem ZIP 250 MB: przyrost RSS workera ≤ 256 MB, `MemAvailable` ≥ 300 MB, zero OOM, zero restartów, przyrost swapu ≤ 512 MB; dowolne przekroczenie = FAIL i osobny kontener workera (TC-PD-PERF-003) | TBD |
| **Dysk VPS** | Zero plików projektu i plików tymczasowych (TC-PD-STOR-005) | TBD |
| **Brak proxy aplikacji** | Treść pliku nie przechodzi przez proces aplikacji (TC-PD-STOR-001..003) | TBD |
| **Usuwanie** | Zero DeleteObject na kluczach rewizji poza workerem purge po potwierdzeniu admina; każde usunięcie stagingu i obiektu osieroconej sesji wyłącznie strzeżoną funkcją i zalogowane; purge = pusty ListObjectVersions, quota maleje dopiero wtedy (TC-PD-RET-003..008, TC-PD-STOR-008, TC-PD-STOR-010) | TBD |
| **Quota** | Limit miękki: alerty 80%/100% od `used`, blokada nowych bajtów od 110% (413), odczyt bez blokady, brak auto-usuwania, ledger per organizacja (TC-PD-QUOTA-001..007) | TBD |
| **Niemutowalność** | Rewizje i ich obiekty niezmienne (TC-PD-REV-001, -002) | TBD |
| **Projekt** | Tylko jawna komenda; jeden projekt na deal i na inwestycję, drugi → 409 `PROJECT_EXISTS` z ID; projekt bez oferty i późniejsze podpięcie (TC-PD-PRJ-002, -004, -009, -010) | TBD |
| **Izolacja** | 404 dla cudzych ID; klucze z prefiksem z sesji (TC-PD-TEN-*) | TBD |
| **Sekrety** | Zero sekretów w repo i ustawieniach (TC-PD-STOR-006) | TBD |
| **Pokrycie tras API** | Każda trasa modułu ma test Playwright w `__integration__` | TBD |

---

## 27. Wnioski do specyfikacji (luki i pytania techniczne)

Pytania techniczne do runnera speki i review (Kod/Cezar), nie do Marka — poza wnioskiem 34 (decyzja biznesowa Marka). Rozstrzygnięcia rev 4 wyłącznie na podstawie rejestru z commita 865714e.

### Priorytet 1 (przed kodem)

1. ~~**Strumieniowy ZIP bez plików tymczasowych**~~ — ✅ **ROZSTRZYGNIĘTE (D124, D119, D121)**: wariant (a) — ZIP w `staging/`, odczyt zakresami (GetObject z `Range`: katalog centralny z końca, potem wpisy); oryginał zachowany jako niemutowalna rewizja w „00 Przetarg” (kopia po stronie S3, liczony do quota), staging usuwany strzeżoną funkcją. Zależności `yauzl` i `@aws-sdk/lib-storage` nadal „ask first” na etapie kodu. Scenariusze: TC-PD-IMP-002, TC-PD-IMP-006, TC-PD-RET-007.
2. ~~**Brak klas przechowywania na B2**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, 2026-10-23)**: archiwum = eksport albo zimna klasa u wybranego dostawcy (u OVHcloud klasy zależne od regionu); przy fallbacku B2 tylko eksport. Scenariusze: TC-PD-POC-003, TC-PD-POC-006, TC-PD-RET-006.
3. ~~**Wersjonowanie bucketu**~~ — ✅ **ROZSTRZYGNIĘTE (D117, D121, D122)**: wersjonowanie u OVHcloud włączone, B2 zawsze wersjonowany; każde usunięcie = DeleteObject z `VersionId` dla każdej wersji i markera aż do pustego ListObjectVersions; quota liczy wszystkie wersje do potwierdzonego purge; Object Lock lub błąd → `purge_failed`. Włączenie Object Lock jako gwarancji niemutowalności rejestr nie przewiduje (bez TC). Scenariusze: TC-PD-POC-001, TC-PD-POC-006, TC-PD-RET-008, TC-PD-QUOTA-009.
4. ~~**Sprzątanie bez DeleteObject**~~ — ✅ **ROZSTRZYGNIĘTE (D121, D125, D129)**: osierocone obiekty sesji `expired` i staging usuwa sweeper/worker wyłącznie strzeżoną funkcją (z logiem); lifecycle tylko jako zapas (abort multipartów, wygaszanie `staging/`). Scenariusze: TC-PD-STOR-008, TC-PD-STOR-010, TC-PD-RET-005, TC-PD-RET-007.
5. ~~**Quota per organizacja a quota załączników per tenant**~~ — ✅ **ROZSTRZYGNIĘTE (D126)**: własny ledger modułu per organizacja; limit `attachments` nie dotyczy plików projektu; tenant = suma, tylko raport. Scenariusze: TC-PD-QUOTA-001, TC-PD-QUOTA-006.
6. ~~**Klucz unikalności projektu**~~ — ✅ **ROZSTRZYGNIĘTE (D116)**: jeden projekt na deal i jeden na inwestycję (indeksy częściowe, `investment_id IS NOT NULL`), bez `NULLS NOT DISTINCT` i bez unikalności per wersja oferty. Scenariusze: TC-PD-PRJ-002, TC-PD-PRJ-010.
7. ~~**Hash pliku bez czytania przez aplikację**~~ — ✅ **ROZSTRZYGNIĘTE (D124)**: przeglądarka nie liczy sha256 w MVP; worker checksum (współbieżność 1, strumieniowo, stała pamięć) po `complete`; import liczy w locie. Scenariusze: TC-PD-REV-006, TC-PD-DOC-001, TC-PD-IMP-002.
8. ~~**Trasa uploadu dla zwykłego użytkownika**~~ — ✅ **ROZSTRZYGNIĘTE (D127)**: własne trasy modułu z feature'ami i ACL folderu, presigned PUT (bez POST), pobranie 302 na presigned GET, trasy `storage_s3` nieużywane. Scenariusze: TC-PD-ACL-006, TC-PD-ACL-004.

### Priorytet 2

9. ~~**Źródło daty dla podpowiedzi retencji w MVP**~~ — ✅ **ROZSTRZYGNIĘTE (D128)**: daty gwarancji i rękojmi wpisywane ręcznie (`project_delivery.projects.manage`); bez dat „retencja nieustalona”. Scenariusz: TC-PD-RET-002.
10. ~~**Tryb quota: dopłata czy blokada**~~ — ✅ **ROZSTRZYGNIĘTE (D118)**: limit miękki, alerty 80%/100%, blokada od 110%, szczyt zużycia per organizacja i okres, fakturowanie poza modułem. Scenariusze: TC-PD-QUOTA-002..005, TC-PD-QUOTA-007.
11. ~~**Poświadczenia bucketu klienta**~~ — ✅ **ROZSTRZYGNIĘTE (D130)**: wyłącznie zaszyfrowane mechanizmem OM, poza `module_configs`, maska w API; wariant A tylko env. Wybór konkretnego mechanizmu — v2. Scenariusze: TC-PD-EXT-003, TC-PD-STOR-006.
12. **Kontrola regionu UE** (TC-PD-STOR-009): czy aplikacja ma odrzucać endpoint/region spoza UE, czy to tylko konfiguracja wdrożenia? **Otwarte.**
13. **Maksymalna ważność linku udostępniania i odświeżanie presigned GET** (TC-PD-SHARE-001, -002): maksimum ważności linku jako parametr? **Otwarte** (v1).
14. ~~**Częściowy import przy przekroczeniu limitu lub timeoucie**~~ — ✅ **ROZSTRZYGNIĘTE (D123)**: wpis atomowy, pominięcia z powodem, statusy `completed|partial|failed|cancelled`, utworzone rewizje zostają. Scenariusze: TC-PD-WRK-003, -004, -008.
15. ~~**Wznowienie a abort multipartu po restarcie**~~ — ✅ **ROZSTRZYGNIĘTE (D123)**: wznowienie od ostatniego pełnego wpisu (`pd_imports` + ListParts). Scenariusz: TC-PD-WRK-005.
16. ~~**Współbieżność 1 a duże ZIP-y**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, commit 4f83bd4)**: współbieżność 1 na instancję dotyczy tylko kolejki importu i multipartu modułu; pozostałe kolejki w `queue worker --all` bez zmian (TC-PD-WRK-002, TC-PD-WRK-007).
17. **Podgląd PDF a CORS** (TC-PD-DOC-003): pdf.js przez `fetch` wymaga CORS GET na buckecie; `<iframe>`/natywny podgląd nie. **Otwarte.**
18. ~~**Status linków udostępniania**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, 2026-10-23)**: linki udostępniania w v1, lista MVP ich nie zawiera (TC-PD-SHARE-* mają etap v1).

### Priorytet 3

19. **Deal ponownie otwarty** (TC-PD-PRJ-008): rejestr ustala flagę w harmonogramie (TC-PD-NOSCHED-005); oznaczenie w samym projekcie — **otwarte**.
20. **Nazwy feature'ów** (TC-PD-ACL-005) — **CZĘŚCIOWO**: rejestr nazywa `project_delivery.storage.purge`, `project_delivery.projects.manage`, `documents.upload`, `view`; reszta macierzy i role domyślne otwarte.

### Wnioski rev 2–3

21. ~~**„Mały bufor tymczasowy” na dysku VPS**~~ — ✅ **ROZSTRZYGNIĘTE (rejestr, commit 4f83bd4)**: bufor wyłącznie w RAM, ograniczony do partSize × queueSize, zero plików tymczasowych, także w workerze.
22. ~~**Weryfikacja dostawcy domyślnego**~~ — ✅ **ROZSTRZYGNIĘTE (odbiór, 2026-10-23)**: zgodność OVHcloud potwierdza PoC na etapie kodu (teraz na buckecie wersjonowanym); jeśli nie przejdzie — B2 z adapterem (TC-PD-POC-001..006).
23. ~~**Próg „presji RAM”**~~ — ✅ **ROZSTRZYGNIĘTE (D120)**: progi stałe dla ZIP 250 MB (RSS ≤ 256 MB, `MemAvailable` ≥ 300 MB, zero OOM i restartów, swap ≤ 512 MB); przekroczenie = FAIL (TC-PD-PERF-003). Stan „brak werdyktu” przestaje istnieć.
24. ~~**Kopia zapasowa przy regionie One Zone / klasa przechowywania**~~ — ✅ **ROZSTRZYGNIĘTE (D117, D129)**: MVP — wersjonowanie OVHcloud + kopia bazy OM; v1 — nocna kopia do B2 poza quota klienta, purge obejmuje kopię; zero reguł zmiany klasy na prefiksie dokumentów. Scenariusze: TC-PD-QUOTA-009, TC-PD-RET-008, TC-PD-STOR-010.

### Luki rev 4 (reguł brak w rejestrze @865714e — nie zgadywano)

25. **Wygrany deal z wersją roboczą bez snapshotu** (TC-PD-PRJ-003): 422 czy projekt bez oferty? Rejestr opisuje tylko brak kalkulacji (`getWinningOffer` → `null`) i ofertę nie-`primary`. Kod błędu dla deala niewygranego też nie jest nazwany.
26. **Brak FK DB w `pd_projects`** (TC-PD-PRJ-005): reguła „FK-id bez constraintu DB + snapshot” była w decyzji zastąpionej; decyzja zastępująca jej nie powtarza (jest tylko dla `execution_project_id` w harmonogramie).
27. **Feature komendy podpięcia oferty** (TC-PD-PRJ-010): rejestr nazywa komendę `projects.link_winning_offer` i trasę, ale nie feature (lista poprawek podaje `projects.manage` — w rejestrze brak).
28. **Kod błędu `complete` po `expired`** (TC-PD-STOR-008): rejestr wymaga stanu `reserved`, nie podaje kodu.
29. **Kto może wykonać soft delete** (TC-PD-RET-004): rejestr reguluje tylko purge.
30. **Limity ZIP spoza rejestru** (TC-PD-WRK-003, TC-PD-SEC-002): suma po rozpakowaniu, liczba wpisów, współczynnik kompresji — powód pominięcia i czy przerwać import.
31. **Status przy samych pominięciach `duplicate`** (TC-PD-WRK-008): `completed` („bez pominięć z błędu”) czy `partial` („część pominięta”).
32. **Czyszczenie `reopened_at` po ponownym `won`** (TC-PD-NOSCHED-005): lista poprawek to zakłada, rejestr nie (ustala tylko ustawienie flagi).
33. **Liczba inwestycji dla postępowania z częściami w wariancie „jedno postępowanie = jeden deal”** (TC-PD-PRJ-011): rejestr ustala tylko jeden deal i najwyżej jeden projekt.
34. **Konflikt D31 ↔ D132 — decyzja Marka** (TC-PD-PRJ-011, TC-PD-PRJ-012): do decyzji obowiązuje D31; TC-PD-PRJ-012 poza werdyktem.
35. **Pozostałe „wg speki” bez reguły w rejestrze**: TC-PD-DOC-002 (dopuszczalność `http`), TC-PD-SEC-001 (niezgodność rozszerzenia i typu — oznaczyć czy odrzucić), TC-PD-SHARE-003 (zakres linku, v1).

---

## 28. Podsumowanie

**Dokument**: Niezależny plan testów — spec only
**Liczba scenariuszy**: 119 (MVP 97, v1 15, v2 7; etap liczony z pierwszej fazy scenariusza — TC-PD-STOR-007 obejmuje MVP, v1 i v2); w tym 1 warunkowy poza werdyktem (TC-PD-PRJ-012)
**Liczba wniosków do speki**: 35 (rozstrzygnięte: 1–11, 14–16, 18, 21–24; częściowo: 20; otwarte: 12, 13, 17, 19; luki rev 4: 25–33, 35; decyzja Marka: 34)
**Status**: SPEC ONLY — bez kodu, bez testów wykonywalnych

**Kolejne kroki**:
1. Na etapie kodu: PoC dostawcy domyślnego na buckecie wersjonowanym (kryterium akceptacji, fallback B2) i pomiar RAM z progami z TC-PD-PERF-003
2. Decyzja Marka w sprawie D31 ↔ D132 (włącza albo usuwa TC-PD-PRJ-012)
3. Odpowiedzi na luki 25–33 i 35 z §27

---

## Załącznik: Traceability D → TC (macierz decyzji)

Źródło: `.ai/decisions.md` z commita 865714e (po merge #20), sekcja „Decyzje D98–D130” rozszerzona o D131–D132: 35 decyzji, 34 aktywne (D99 zastąpiona przez D116; D132 aktywna warunkowo — konflikt z D31, czeka na decyzję Marka). Każda aktywna decyzja ma co najmniej jeden TC. Fazy w kolumnie TC wynikają z pola „Etap” scenariuszy.

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| **D98** | Trzy moduły; opcjonalne zależą od kalkulacji; brak importów między opcjonalnymi; współpraca przez rejestr DI w kalkulacji | TC-PD-DI-001, TC-PD-DI-002, TC-PD-DI-004, TC-PD-DI-005, TC-PD-NOSCHED-001 | MVP |
| **D99** | zastąpiona przez D116 — dawny zapis: projekt jawną komendą, jeden na zwycięską ofertę główną (klucz: deal, wersja oferty, inwestycja) | — (pokrycie przeniesione do wiersza D116) | superseded; wniosek 6 rozstrzygnięty przez D116 |
| **D100** | Brak własnego Gantta; link/uruchomienie harmonogramu przez DI idempotentnie; działa bez harmonogramu; zero HTTP; doprecyzowana przez D131 (jedna faza projektu na harmonogram inwestycji) | TC-PD-PRJ-007, TC-PD-NOSCHED-001, TC-PD-NOSCHED-002, TC-PD-NOSCHED-003, TC-PD-NOSCHED-004, TC-PD-NOSCHED-005, TC-PD-DI-002 | MVP bez harmonogramu; v1 link/uruchomienie |
| **D101** | Kamienie linkują pozycję/sekcję zwycięskiej wersji (ID + snapshot etykiety); billing % w v1; projekt bez oferty — kamienie bez linków (D116) | TC-PD-MS-001, TC-PD-MS-002, TC-PD-MS-003, TC-PD-MS-004, TC-PD-FLOW-004, TC-PD-DI-003, TC-PD-PRJ-009 | MVP link; v1 billing % |
| **D102** | Metadane w OM, pliki w S3 (`storage_s3`, partycja `projectDocs`), presigned upload, limity, quota per organizacja, nic na VPS | TC-PD-DOC-001, TC-PD-STOR-001, TC-PD-STOR-002, TC-PD-STOR-009, TC-PD-QUOTA-001, TC-PD-QUOTA-006, TC-PD-ACL-004, TC-PD-ACL-006 | MVP; wnioski 5, 8 rozstrzygnięte (D126, D127) |
| **D103** | Rewizja niemutowalna; do produkcji najnowsza zatwierdzona; MVP ręcznie, v1 ścieżka akceptacji | TC-PD-REV-001, TC-PD-REV-002, TC-PD-REV-003, TC-PD-REV-004, TC-PD-REV-005, TC-PD-POC-003, TC-PD-APR-002, TC-PD-FLOW-001 | MVP; v1 akceptacje |
| **D104** | Dziedziczenie z projektu + ACL folderów (MVP); linki z obowiązkowym wygaśnięciem — v1 (nie w MVP) | TC-PD-ACL-001, TC-PD-ACL-002, TC-PD-ACL-003, TC-PD-ACL-005, TC-PD-ACL-006, TC-PD-SHARE-001, TC-PD-SHARE-002, TC-PD-SHARE-003, TC-PD-SEC-004 | MVP; v1 linki (TC-PD-SHARE-* etap v1); wniosek 18 rozstrzygnięty |
| **D105** | Dyski klienta w trybie linku: Google Drive v1; SharePoint/OneDrive/Nextcloud v2 | TC-PD-EXT-001, TC-PD-EXT-002 | v1, v2 |
| **D106** | Zakres MVP: szablon, etapy, zadania, kamienie, foldery z ACL, rewizje na S3, podgląd PDF, ręczne pliki i linki, import e-Zamówień, TED metadane + link | TC-PD-PRJ-006, TC-PD-PRJ-007, TC-PD-DOC-002, TC-PD-DOC-003, TC-PD-DOC-005, TC-PD-SEC-001, TC-PD-IMP-001, TC-PD-IMP-002, TC-PD-IMP-003, TC-PD-IMP-004, TC-PD-IMP-005, TC-PD-SEC-003 | MVP |
| **D107** | Zakres v1: rejestr rysunków, akceptacje (silnik wg D114), transmittale, korespondencja/RFI, protokoły, Google Drive, kamienie z rozliczeniem; alerty quota przeniesione do MVP (D118) | TC-PD-FLOW-001, TC-PD-FLOW-002, TC-PD-FLOW-003, TC-PD-FLOW-004, TC-PD-APR-001, TC-PD-APR-004, TC-PD-EXT-001, TC-PD-MS-004, TC-PD-QUOTA-005 | v1; TC-PD-QUOTA-005 ma etap MVP |
| **D108** | Zakres v2: gwarancja/rękojmia, dokumenty jakości przy partiach, SharePoint/OneDrive/Nextcloud, bucket klienta, OCR, DWG, podpis kwalifikowany | TC-PD-ADV-001, TC-PD-ADV-002, TC-PD-ADV-003, TC-PD-EXT-002, TC-PD-EXT-003, TC-PD-DOC-004 | v2 (DOC-004: brak OCR w MVP) |
| **D109** | E-dziennik, rękojmia, zabezpieczenie, okresy przechowywania = ryzyka prawne, nie wymagania | TC-PD-LEGAL-001, TC-PD-RET-001 | bez funkcji; test negatywny |
| **D110** | Pliki nie na dysku VPS i nie przez proces serwera HTTP; presigned (multipart); ZIP strumieniowo w istniejącym workerze kolejki, bez nowego kontenera; pamięć ograniczona; ścieżki buforujące `storage_s3` nieużywane | TC-PD-STOR-001, TC-PD-STOR-002, TC-PD-STOR-003, TC-PD-STOR-004, TC-PD-STOR-005, TC-PD-IMP-002, TC-PD-PERF-001, TC-PD-PERF-002, TC-PD-PERF-003, TC-PD-DOC-003, TC-PD-DOC-004, TC-PD-REV-006, TC-PD-WRK-001 | MVP; bufor tylko w RAM, zero plików tymczasowych (wniosek 21); GetObject tylko w workerach checksum i importu (D124); wnioski 1, 7 rozstrzygnięte |
| **D111** | Storage w UE; domyślnie najtańszy w pełni kompatybilny dostawca UE (OVHcloud; zapis warunkowy `If-None-Match`, multipart); fallback B2 EU Central z adapterem bez `If-None-Match`; konfiguracja env/ustawienia bez sekretów | TC-PD-STOR-001, TC-PD-STOR-006, TC-PD-STOR-009, TC-PD-REV-002, TC-PD-POC-001, TC-PD-POC-002, TC-PD-POC-003, TC-PD-POC-004, TC-PD-POC-005, TC-PD-POC-006, TC-PD-POC-007 | MVP; PoC OVHcloud = kryterium akceptacji etapu kodu, fallback B2 (wniosek 22 rozstrzygnięty); wnioski 3, 12, 24 |
| **D112** | Wariant A (nasz bucket u dostawcy domyślnego, fallback B2; limit i dopłata — doprecyzowane przez D118) / B (storage klienta); limity i ceny jako parametry; MVP tylko A; v1 + Drive; v2 + bucket klienta, SharePoint/OneDrive/Nextcloud | TC-PD-STOR-007, TC-PD-QUOTA-001, TC-PD-QUOTA-002, TC-PD-QUOTA-003, TC-PD-QUOTA-004, TC-PD-QUOTA-007, TC-PD-EXT-001, TC-PD-EXT-003, TC-PD-TEN-002 | MVP A; v1, v2 B; wnioski 10, 11 rozstrzygnięte (D118, D130) |
| **D113** | Retencja per organizacja (podpowiedź: koniec gwarancji i rękojmi), potem archiwum = eksport albo zimna klasa u dostawcy (B2: tylko eksport); nigdy usunięcie bez admina; MVP pole + data na projekcie; v2 auto-archiwizacja | TC-PD-RET-001, TC-PD-RET-002, TC-PD-RET-003, TC-PD-RET-004, TC-PD-RET-005, TC-PD-RET-006, TC-PD-RET-007, TC-PD-RET-008, TC-PD-STOR-008, TC-PD-STOR-010, TC-PD-ADV-001, TC-PD-POC-003, TC-PD-POC-006 | MVP; v2; strażnik usuwania (TC-PD-RET-007, D121) i purge po potwierdzeniu (TC-PD-RET-008, D122); wnioski 2, 3, 4, 9 rozstrzygnięte |
| **D114** | Akceptacje v1 (rewizje, transmittale, protokoły): własna walidacja progów (`pd_approval_tiers`, `pd_approval_reviews`) za `ApprovalEngine` w DI; `workflows` w v2 | TC-PD-APR-001, TC-PD-APR-002, TC-PD-APR-003, TC-PD-APR-004 | v1; v2 |
| **D115** | Import ZIP i multipart serwerowy przez istniejącą kolejkę OM (ProgressJob, `queue worker --all` w kontenerze `app`), bez nowego kontenera; strumieniowo; bufor tylko w RAM ≤ partSize × queueSize, zero plików tymczasowych; współbieżność 1 tylko dla kolejki modułu, inne kolejki bez zmian; limity per plik i per ZIP jako parametry; timeout, wznowienie, abort multipartu; progi presji RAM — D120 | TC-PD-WRK-001, TC-PD-WRK-002, TC-PD-WRK-003, TC-PD-WRK-004, TC-PD-WRK-005, TC-PD-WRK-006, TC-PD-WRK-007, TC-PD-WRK-008, TC-PD-IMP-002, TC-PD-SEC-002, TC-PD-STOR-005, TC-PD-PERF-002, TC-PD-PERF-003 | MVP; wnioski 14, 15, 16, 21, 23 rozstrzygnięte |
| **D116** | Wygrany deal bez kalkulacji → projekt bez oferty (kolumny oferty razem NULL, CHECK; wartość i waluta z deala; `segmentCode` albo 422 `SEGMENT_REQUIRED`); podpięcie oferty później (`POST …/winning-offer`, 422 `OFFER_NOT_PRIMARY`, 409 `OFFER_ALREADY_LINKED`); jeden projekt na deal i na inwestycję, drugi → 409 `PROJECT_EXISTS` (także wyścig); tylko jawna komenda (D99 zastąpiona przez D116) | TC-PD-PRJ-001, TC-PD-PRJ-002, TC-PD-PRJ-003, TC-PD-PRJ-004, TC-PD-PRJ-005, TC-PD-PRJ-006, TC-PD-PRJ-008, TC-PD-PRJ-009, TC-PD-PRJ-010, TC-PD-PRJ-011 | MVP; wniosek 6 rozstrzygnięty; luki 25, 26, 27 |
| **D117** | Wersjonowanie OVHcloud włączone + kopia bazy OM (MVP); nocna kopia B2 (v1) poza quota klienta; usunięcie = wszystkie wersje i markery (także w kopii B2); quota liczy wszystkie wersje; PoC na buckecie wersjonowanym | TC-PD-POC-001, TC-PD-POC-003, TC-PD-POC-006, TC-PD-QUOTA-009, TC-PD-RET-008, TC-PD-STOR-008 | MVP; v1; kopia bazy OM — procedura wdrożenia, bez TC w tym planie; wnioski 3, 24 rozstrzygnięte |
| **D118** | Quota jako limit miękki: alerty 80%/100% od `used` (event `project_delivery.storage.quota_threshold_reached`, ponowne uzbrojenie po spadku); szczyt `used` per okres, nadwyżka = max(0, szczyt − quota); od 110% 413 `STORAGE_QUOTA_EXCEEDED` bez eventu; odczyt działa; brak auto-usuwania; usunięte parametry trybów; brak quota → 422 `STORAGE_QUOTA_NOT_CONFIGURED` | TC-PD-QUOTA-002, TC-PD-QUOTA-003, TC-PD-QUOTA-004, TC-PD-QUOTA-005, TC-PD-QUOTA-007, TC-PD-IMP-006 | MVP; wniosek 10 rozstrzygnięty |
| **D119** | Oryginał ZIP = dowód: kopia po stronie S3 jako niemutowalna rewizja w „00 Przetarg” przed rozpakowaniem; w quota („archiwum dowodowe”); sha256 w locie; duplikat → kopia pominięta; brak quota (110%) → `failed`/`quota` bez kopii i rozpakowania; staging usuwany strzeżoną funkcją | TC-PD-IMP-002, TC-PD-IMP-005, TC-PD-IMP-006, TC-PD-QUOTA-008, TC-PD-RET-005 | MVP; wniosek 1 rozstrzygnięty |
| **D120** | Progi pomiaru RAM dla ZIP 250 MB: RSS workera ≤ 256 MB, `MemAvailable` ≥ 300 MB, zero OOM i restartów, swap ≤ 512 MB; przekroczenie = FAIL → osobny kontener | TC-PD-PERF-003 | etap kodu; wniosek 23 rozstrzygnięty |
| **D121** | Usuwanie poza purge wyłącznie strzeżoną funkcją (staging własnego importu, klucz sesji `expired` bez rewizji; inne → wyjątek); sweeper i `reserved → expired` pod advisory lockiem; log każdego usunięcia; wersjonowany bucket — wszystkie wersje; nic nie usuwa rewizji | TC-PD-RET-003, TC-PD-RET-005, TC-PD-RET-007, TC-PD-STOR-008, TC-PD-WRK-004, TC-PD-WRK-008, TC-PD-IMP-002, TC-PD-IMP-006 | MVP; wniosek 4 rozstrzygnięty; luka 28 |
| **D122** | Purge tylko po potwierdzeniu: feature `project_delivery.storage.purge` (bez → 403), kod projektu (bez → 422 `PURGE_CONFIRMATION_REQUIRED`); worker purge (współbieżność 1): wszystkie wersje i markery, pusta lista = `purged`, dopiero wtedy poza quota; niepełne → `purge_failed`; audyt + event `project_delivery.storage.purged` z ID | TC-PD-RET-004, TC-PD-RET-008, TC-PD-QUOTA-005, TC-PD-ACL-005 | MVP; wniosek 3 rozstrzygnięty; luka 29 |
| **D123** | Import: wpis atomowy (rewizja albo pominięcie z powodem `quota`/`too_large`/`encrypted`/`unsupported_method`/`duplicate`/`error`); statusy `completed`/`partial`/`failed`/`cancelled`; rewizje zostają; duplikat sha256 w folderze pominięty; wznowienie od ostatniego pełnego wpisu | TC-PD-WRK-003, TC-PD-WRK-004, TC-PD-WRK-005, TC-PD-WRK-008, TC-PD-IMP-005, TC-PD-QUOTA-003 | MVP; wnioski 14, 15 rozstrzygnięte; luki 30, 31 |
| **D124** | sha256: przeglądarka nie liczy (MVP); worker checksum (`project_delivery:checksum`, współbieżność 1, strumieniowo) — NULL do czasu ustawienia, potem niezmienny; import w locie; ZIP czytany zakresami (`Range`) | TC-PD-REV-006, TC-PD-DOC-001, TC-PD-DOC-004, TC-PD-IMP-001, TC-PD-IMP-002 | MVP; wnioski 1, 7 rozstrzygnięte |
| **D125** | `complete`: rozmiar z HeadObject; rozbieżność ponad tolerancję → 422 `UPLOAD_SIZE_MISMATCH`, bez rewizji, rezerwacja zwolniona, obiekt usuwa sweeper | TC-PD-REV-002, TC-PD-STOR-009, TC-PD-QUOTA-004 | MVP |
| **D126** | Ledger quota per organizacja (`pd_upload_sessions` + rewizje): rezerwacja pod advisory lockiem, zwolnienie przy abort/wygaśnięciu/`UPLOAD_SIZE_MISMATCH`; rewizje liczone do purge także po soft delete; limit `attachments` nie dotyczy; tenant = suma, tylko raport | TC-PD-QUOTA-001, TC-PD-QUOTA-004, TC-PD-QUOTA-006, TC-PD-STOR-008, TC-PD-TEN-002 | MVP; wniosek 5 rozstrzygnięty |
| **D127** | Upload/pobranie/podgląd przez trasy modułu z feature'ami (`documents.upload`, `view`) i ACL folderu; presigned z krótkim TTL per żądanie, nigdy zapisany; tylko presigned PUT; pobranie 302; trasy i metody `storage_s3` nieużywane | TC-PD-ACL-006, TC-PD-ACL-004, TC-PD-STOR-001, TC-PD-STOR-003, TC-PD-DOC-003 | MVP; wniosek 8 rozstrzygnięty |
| **D128** | Daty gwarancji i rękojmi ręcznie (`project_delivery.projects.manage`), moduł nie wylicza; bez dat brak `retention_until`, „retencja nieustalona”; v2 z `pd_warranty_terms` | TC-PD-RET-002, TC-PD-ACL-005, TC-PD-ADV-001 | MVP; v2; wniosek 9 rozstrzygnięty |
| **D129** | Lifecycle: na prefiksie dokumentów zero usuwania i zmiany klasy; wyłącznie abort multipartów i wygaszanie `staging/` (z wersjami niebieżącymi i markerami) jako zapas za sweeperem; AbortMultipartUpload ≠ usunięcie dokumentu | TC-PD-STOR-010, TC-PD-POC-003, TC-PD-POC-006, TC-PD-WRK-006, TC-PD-RET-006 | MVP; wniosek 24 rozstrzygnięty |
| **D130** | Poświadczenia wariantu B (v2) tylko zaszyfrowane mechanizmem OM, poza `module_configs`, maska w API, nigdy w logach/eventach/repo; wariant A — env (`credentialsEnvPrefix`); pole wyglądające na klucz w ustawieniach → 422 | TC-PD-STOR-006, TC-PD-EXT-003 | MVP A; v2 B; wniosek 11 rozstrzygnięty |
| **D131** | Faza projektu w harmonogramie inwestycji: zadanie-podsumowanie z `execution_project_id` (jedno na rekord); `findForInvestment`, `ensureExecution` idempotentne per inwestycja, inne `projectId` → 409 `PROJECT_PHASE_EXISTS`, wyścig → istniejące ID; flaga ponownego otwarcia na zadaniu fazy | TC-PD-NOSCHED-003, TC-PD-NOSCHED-005 | v1; luka 32 |
| **D132** | **WARUNKOWE** — części postępowania: osobna inwestycja i deal na część, `tender_notice_number` (tylko do odczytu, bez unikalności); v1 identyfikator `bzp_notice_part` `{numer}#{część}`; primary per część | TC-PD-PRJ-012 (warunkowy) | konflikt z D31 — czeka na decyzję Marka; TC poza werdyktem; kontrolny TC-PD-PRJ-011 pod D31; wniosek 34 |

**Decyzje kontekstowe (wcześniejsze, aktywne) użyte w scenariuszach:**

| D | Treść skrócona | TC | Uwagi |
|---|---|---|---|
| **D15** | Firma = organizacja OM | TC-PD-TEN-001, TC-PD-TEN-002, TC-PD-TEN-003 | izolacja |
| **D19** | Harmonogram opcjonalny per firma | TC-PD-NOSCHED-001 | |
| **D47** | Przełącznik harmonogramu per organizacja + globalny wyłącznik tenanta | TC-PD-NOSCHED-002 | |
| **D67** | Wyłączenie harmonogramu zostawia dane ukryte | TC-PD-NOSCHED-004 | |
| **D77** | Jeden harmonogram na inwestycję | TC-PD-NOSCHED-003, TC-PD-NOSCHED-005 | |
| **D31** | Jedno postępowanie (`tender_id`) = jeden deal; kolejne ogłoszenia aktualizują deal i dodają interakcję | TC-PD-PRJ-011 | konflikt z D132 — czeka na decyzję Marka; do decyzji obowiązuje |
| **D72** | Ponowne otwarcie deala: `reopened_at` bez usuwania danych; doprecyzowana przez D131 (flaga na zadaniu fazy projektu) | TC-PD-NOSCHED-005 | v1 |
| **D5** | Jedna oferta `primary` na inwestycję | TC-PD-PRJ-002, TC-PD-PRJ-012 | per część tylko przy D132 |
| **D63** | Inwestycje zakłada handlowiec (`pc_investments`) | TC-PD-PRJ-012 | |

---

## Changelog

### Rev 4 — 2026-10-23 (rejestr z commita 865714e, po merge #20; poprawki PR #19)

- Poprawkę wykonała **niezależna sesja testerska** wyłącznie na podstawie `.ai/decisions.md` z commita 865714e i listy poprawek recenzenta, **bez dostępu do spek** (ani speki modułu, ani lokalnych kopii)
- Decyzje, na których oparto zmiany: D5, D31, D63, D72, D77, D99 zastąpiona przez D116 (tylko adnotacja w załączniku), D100, D101, D102, D104, D107, D110, D112, D113, D115, D116, D117, D118, D119, D120, D121, D122, D123, D124, D125, D126, D127, D128, D129, D130, D131, D132
- B1–B7 (TC sprzeczne z decyzjami): TC-PD-RET-005 (zero DeleteObject na kluczach rewizji poza purge; statycznie tylko strażnik + purge), TC-PD-STOR-008 (sweeper, `reserved → expired`, wyścig z `complete`), TC-PD-REV-002 krok 3 (`UPLOAD_SIZE_MISMATCH`, bez sha256 z przeglądarki), TC-PD-DOC-001 i TC-PD-DOC-004 (sha256 NULL do workera checksum; brak GetObject z serwera HTTP), TC-PD-WRK-003/004/005 (wpis atomowy, `failed` po timeoucie, wznowienie od pełnego wpisu), TC-PD-RET-004 (purge: 403 bez feature'a, 422 bez potwierdzenia, asynchronicznie), TC-PD-RET-003 i asercje globalne (§2, R2, §26)
- F1: nowy TC-PD-RET-007 (strażnik usuwania); F4: §27 — wnioski 1, 3–11, 14, 15, 23, 24 oznaczone ROZSTRZYGNIĘTE z numerami D, „wg speki” zastąpione zachowaniem z rejestru tam, gdzie reguła istnieje (pozostałe — luka 35); F5: załącznik — D113 uzupełniona o strażnika i purge, wiersze D116–D132
- F2 i F3 nie wykonane — nieaktualne (zastąpione przez G3 i G5)
- G1: TC-PD-PRJ-001..003 (jeden projekt na deal i na inwestycję, `PROJECT_EXISTS`, puste inwestycje); G2: TC-PD-QUOTA-002..005 przepisane (limit miękki, 413 od 110%, alerty 80/100% w MVP, `STORAGE_QUOTA_NOT_CONFIGURED`, usunięte parametry trybów); G3: TC-PD-POC-001/003/006 (bucket wersjonowany, usuwanie wersji, lifecycle tylko abort i `staging/`); G4: TC-PD-IMP-002/005 + nowy TC-PD-IMP-006 (oryginał ZIP jako rewizja-dowód); G5: TC-PD-PERF-003 z progami stałymi (stan „brak werdyktu” usunięty)
- T1–T18 — nowe TC: TC-PD-PRJ-009 (projekt bez oferty), TC-PD-PRJ-010 (podpięcie oferty), TC-PD-QUOTA-009 (wersje w quota, kopia B2 poza quota), TC-PD-QUOTA-007 (szczyt w okresie), TC-PD-QUOTA-008 („archiwum dowodowe”), TC-PD-RET-008 (worker purge), TC-PD-WRK-008 (statusy importu), TC-PD-REV-006 (worker checksum), TC-PD-QUOTA-006 (ledger per organizacja), TC-PD-ACL-006 (trasy modułu), TC-PD-STOR-010 (lifecycle), TC-PD-NOSCHED-005 (`ensureExecution`); zmienione: TC-PD-RET-002 (ręczne daty), TC-PD-STOR-006 i TC-PD-EXT-003 (poświadczenia), TC-PD-NOSCHED-003; T18 — TC-PD-PRJ-012 **warunkowy** (D132, zależny od decyzji Marka w sprawie D31, poza werdyktem) + kontrolny TC-PD-PRJ-011 pod D31 z adnotacją o konflikcie
- T3: wiersz załącznika oznaczony jako „D99 zastąpiona przez D116” (dawny zapis „jeden na ofertę główną”)
- §27: nowe luki 25–35 (reguły, których brak w rejestrze — nie zgadywano)
- Nity N10–N12 (dopiski „warunkowe” poza #19) — nie wykonane, zostają na później
- Liczba scenariuszy: 103 → 119 (PRJ 8 → 12, REV 5 → 6, STOR 9 → 10, QUOTA 5 → 9, RET 6 → 8, IMP 5 → 6, WRK 7 → 8, ACL 5 → 6, NOSCHED 4 → 5)

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
