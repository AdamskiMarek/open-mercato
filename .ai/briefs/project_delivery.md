# Brief: projekty i dokumentacja realizacji (`project_delivery`)

**To nie jest speka (P14).** Zachowanie, model danych, kody błędów i testy są w specu `.ai/specs/2026-10-23-project-delivery-docs.md`, w planie `.ai/specs/2026-10-23-project-delivery-docs-test-plan.md` i w `.ai/decisions.md` (P12). Numery D bez zmian — tylko odesłania. Zakres D98–D169: 72 numery, 70 aktywnych; D99 → zastąpiona przez D116, D154 → zastąpiona przez D132.

## 1. Po co

Po wygranym przetargu firma prowadzi w OM projekt realizacji: etapy, zadania, kamienie milowe i całą dokumentację (rewizje, foldery z uprawnieniami, import z e-Zamówień), z plikami w S3 w UE, bez Excela i bez dysków udostępnianych mailem (D98, D102, D106).

## 2. Co ma umieć — obszary (każdy z warunkiem sukcesu)

| # | Obszar | Warunek sukcesu | D |
|---|---|---|---|
| A | Projekt i powiązania | Projekt powstaje tylko jawną komendą z deala `won`, także bez kalkulacji w OM; ofertę podpina się później; deal ponownie otwarty albo przegrany tylko oznacza projekt flagą; projekt bez harmonogramu działa, z harmonogramem (v1) dostaje fazę idempotentnie; jedna część postępowania = jeden deal, jedna inwestycja, jeden projekt. | D98, D100, D101, D116, D131, D132, D133, D134, D135, D140, D141, D161 |
| B | Zakres faz | MVP zawiera dokładnie listę z D106; v1 i v2 nie wchodzą do MVP. | D106, D107, D108 |
| C | Dokumenty i rewizje | Nowy plik = nowa niemutowalna rewizja; do produkcji idzie najnowsza zatwierdzona; dokument-link tylko `https:`; typ MIME ustala worker z zawartości; dyski zewnętrzne tylko jako link (v1/v2). | D102, D103, D105, D138, D151, D163 |
| D | Storage, upload i pobieranie | Pliki nie dotykają dysku VPS ani procesu HTTP aplikacji (presigned PUT/GET przez trasy modułu); storage w UE; klucz obiektu generuje serwer; limity rozmiaru, sesje uploadu, sha256 z workera i ochrona przed utratą działają wg rejestru. | D110, D111, D112, D117, D124, D125, D127, D129, D143, D144, D145, D146, D147, D149, D164 |
| E | Import ZIP z e-Zamówień | Import idzie przez kolejkę OM; jednostką atomową jest plik, nie paczka; oryginalny ZIP zostaje jako dowód; niebezpieczne ścieżki pomijane z powodem; limity paczki wg parametrów; pomiar RAM workera (KA-6) wg progów. | D115, D119, D120, D123, D139, D148, D150, D158 |
| F | Quota i ledger | Limit miękki per organizacja z alertami 80% i 100%; ledger liczy także wersje obiektów spoza aplikacji (rekoncyliacja). | D118, D126, D153 |
| G | Usuwanie, purge, retencja | Soft delete nie usuwa plików z S3; fizyczne usunięcie tylko purge po potwierdzeniu administratora i przez jedną strzeżoną funkcję; retencja per organizacja z datami gwarancji i rękojmi wpisywanymi ręcznie w MVP. | D113, D121, D122, D128, D136, D162, D166 |
| H | Uprawnienia i role | 14 feature'ów i domyślne granty wg D137/D165; role projektu `manager`/`member`/`viewer`; ACL folderów `read`/`write`/`manage` z dziedziczeniem; odebranie dostępu blokuje wydanie nowego URL. | D104, D137, D147, D159, D160, D165, D167, D168, D169 |
| I | v1: akceptacje i linki udostępniania | Akceptacje wielopoziomowe z własną walidacją progów (bez `workflows`), komentarz obowiązkowy przy odrzuceniu, transmittal blokowany bez akceptacji; link udostępniania tylko z datą wygaśnięcia. | D114, D142, D152, D155, D156, D157 |
| J | Prawo | e-dziennik, rękojmia, zabezpieczenie (Pzp) i okresy przechowywania to ryzyka do weryfikacji prawnej, nie wymagania. | D109 |
| K | Sekrety | Poświadczenia bucketu klienta (v2) tylko zaszyfrowane w bazie, nigdy jawnie w repo, logach ani eventach. | D130 |

## 3. Ograniczenia

- Moduł opcjonalny per firma; zależy od `project_costing`, nie od `project_schedule`; między modułami tylko DI i eventy, zero HTTP; bez FK do tabel innych modułów (D98, D100, D134).
- Bez zmian w `packages/core` (D45). Bez nowego kontenera — kolejka OM (D115).
- Tylko specyfikacja do „implementujemy” (nagłówek sekcji D98–D130, D98); bez estymat w dniach (P11).

## 4. Czego nie robimy

- Bez własnego Gantta (D100).
- Bez automatycznego tworzenia projektu przez n8n albo subscriber (D116).
- Bez usuwania plików z S3 poza purge (D121, D122); bez reguł lifecycle usuwających dokumenty (D129).
- Przed v1: akceptacje, transmittale, RFI, protokoły, Google Drive, linki udostępniania (D104, D107). Przed v2: gwarancja jako encja, OCR, DWG, podpis kwalifikowany, bucket klienta (D108, D112).

## 5. Po czym poznamy sukces

- Na instancji testowej: deal `won` → projekt → folder z ACL → upload i nowa rewizja → import ZIP z raportem pominięć → pobranie przez presigned URL; dowód wg P7.
- Spec-check bez flag: PASS, 0 FAIL; regresja `spec-check-pd` dla D98–D169: PASS; plan testów `project_delivery` pokrywa wszystkie aktywne D obszaru.
- Bramka gotowości (`.ai/process/readiness-gate.md`): PASS przed prośbą o „implementujemy”.
