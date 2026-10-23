# Spec: Moduł Projekty i dokumentacja realizacji (`project_delivery`)

<!-- Source doc: .ai/specs/2026-10-23-project-delivery-docs.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-23 |
| **Rewizja** | 2026-10-23 (rev 5d — PR 21: reguły speki przeniesione do rejestru (D133–D148) i rozstrzygnięcia techniczne (D149–D157), odwołania w specu, kody §7; rev 5c — D132 warunkowe (decyzja Marka w sprawie D31), zadanie Enki w costing §10.2; rev 5b — odbiór #20 runda 2 (P20-B2, wariant B): każda wygrana część przetargu to osobna inwestycja (D132), jeden projekt na deal i na inwestycję (D116), jedna faza projektu w harmonogramie inwestycji i flaga D72 na fazie (D131); rev 5a — odbiór #20: §0.4 zdarzenia quota zgodne z D118, jeden projekt na deal bez unikalności per inwestycja i faza projektu w harmonogramie inwestycji (D116, D131), dopłata za nadwyżkę (D118), oryginał ZIP jako archiwum dowodowe (D119), kopia B2 poza quota (D117); rev 5 — PR D: decyzje Koordynatora D116–D120 (zamykają O1, O11, O13, O14; ZIP przetargu jako dowód) i reguły speki przeniesione do rejestru jako D121–D130; odwołania w specu; rev 4a — D110: proces serwera HTTP zamiast „RAM aplikacji”, bufor RAM tylko w workerze; rev 4 — odbiór #18: bufor tylko w RAM, współbieżność 1 tylko dla kolejek `project_delivery`, parametry presji RAM (O13), PoC OVHcloud (R22, KA-7), kopia zapasowa przy jednej strefie (O14); rev 3 — uwagi z niezależnego planu testów (PR C), rozstrzygnięcia techniczne §5.12; rev 2 — D114 akceptacje, D115 worker na istniejącej kolejce, domyślny dostawca S3 wg tabeli §5.11; rev 1 — decyzje D98–D113, stan VPS na 23.10, warianty storage A/B, retencja, kryteria akceptacji) |
| **Moduł** | `project_delivery` (`apps/mercato/src/modules/project_delivery`; nazwa i prefiks tabel `pd_`, D98) |
| **Zależności upstream** | **`project_costing` (moduł bazowy)**, `customers`, `directory`, `auth`, `configs` (ModuleConfigService), `audit_logs`, `query_index`, `progress` (ProgressJob), `notifications`, `feature_toggles`, **`@open-mercato/storage-s3`** (klient S3, preset env, `endpoint-safety`; moduł `storage_s3` za `OM_ENABLE_STORAGE_S3`), `@open-mercato/queue` |
| **Moduły powiązane** | `project_costing` (spec `.ai/specs/2026-10-19-project-costing-offer-calculator.md`) — baza, właściciel kontraktów DI; `project_schedule` (spec `.ai/specs/2026-10-19-project-schedule.md`) — opcjonalny dostawca harmonogramu wykonawczego, rejestruje się w rejestrze costingu; `project_delivery` nie importuje `project_schedule` i odwrotnie (D98, D100) |
| **Kierunek zależności** | `project_delivery` (opcjonalny) **zależy od** `project_costing`; costing nigdy nie importuje `project_delivery` (wzór: Kod P0-1, D98) |
| **Wyłączone upstream** | `workflows` (MVP i v1; w v2 jako implementacja `ApprovalEngine` — D93, D114, §9), `sales`, `catalog` (D90), lokalny driver `attachments` dla plików projektu (D102, D110) |
| **Etap** | tylko specyfikacja; bez kodu, dopóki Marek nie powie „implementujemy” |

---

## TLDR

- **Co:** trzeci moduł Klin #1 (D98). Po wygranym przetargu handlowiec jawną komendą „wygrany przetarg → realizacja” zakłada **projekt realizacji** z szablonu segmentu (D116; także dla deala bez kalkulacji w OM). Projekt ma etapy, zadania, kamienie milowe, foldery z ACL i dokumenty z rewizjami (D106).
- **Powiązania:** projekt wskazuje deal (`closure_outcome = 'won'`), zwycięską wersję oferty (kalkulacja + snapshot) i inwestycję (`pc_investments`), o ile kalkulacja jest w OM; bez kalkulacji wartość i walutę bierze z deala, a kalkulację można podpiąć później. Jeden projekt na wygrany deal i na inwestycję; każda wygrana część przetargu to osobna inwestycja i osobny deal (D116, D132 — warunkowe, zależy od decyzji Marka w sprawie D31; D99 — zastąpiona przez D116).
- **Bez własnego Gantta (D100):** harmonogram wykonawczy to `project_schedule` (jeden rekord na inwestycję, D77, z jedną fazą projektu, D131). Projekt go linkuje albo uruchamia (v1) przez rejestr DI w costingu. Bez harmonogramu projekt działa normalnie (D19, D47, D67). Kamienie milowe linkują pozycje i sekcje kalkulacji (D101).
- **Dokumenty (D102–D105):** metadane w OM, pliki w storage zgodnym z S3 w UE. Domyślny dostawca = najtańszy w UE w pełni kompatybilny z `storage-s3` (z `If-None-Match`): wg tabeli §5.11 OVHcloud Object Storage; fallback Backblaze B2 EU Central z adapterem (D111). **Żadnych plików na VPS i żadnych plików w procesie serwera HTTP aplikacji (D110):** upload i pobieranie tylko przez presigned URL (multipart dla dużych plików); import ZIP strumieniowo w istniejącym workerze kolejki OM, bez nowego kontenera (D115). Rewizje są niemutowalne, do produkcji idzie najnowsza zatwierdzona (D103).
- **Storage per organizacja (D112):** wariant A (nasz bucket u domyślnego dostawcy z D111, limit GB w abonamencie jako limit miękki: ostrzeżenia przy 80% i 100%, zużycie ponad 100% płatne jako dopłata za nadwyżkę w okresie rozliczeniowym, blokada nowych plików powyżej 110%, bez automatycznego usuwania — D118) albo B (storage klienta). MVP: tylko A z quota per organizacja; wersjonowanie bucketu OVHcloud włączone i kopia bazy, v1 nocna kopia do B2, poza quota klienta (D117).
- **Retencja (D113):** pole w ustawieniach i data końca retencji na projekcie (podpowiedź: koniec gwarancji i rękojmi). **Nigdy** automatycznego usunięcia bez potwierdzenia administratora.
- **Fazy:** MVP — projekt, struktura, dokumenty na S3, podgląd PDF, import e-Zamówień, TED tylko metadane i link. v1 — rejestr rysunków, akceptacje (własna walidacja progów za `ApprovalEngine`, D114, §9), transmittale, RFI, protokoły, Google Drive (link), billing % kamieni (D107); alerty quota w MVP (D118). v2 — gwarancja/rękojmia, jakość per partia, inne dyski, bucket klienta, OCR, DWG, podpis kwalifikowany (D108).
- **Prawo (D109):** e-dziennik budowy, rękojmia, zabezpieczenie Pzp i retencja to ryzyka do weryfikacji prawnej (§12), nie wymagania.

## Streszczenie

Costing kończy się na wysłanej i wygranej ofercie, a schedule planuje produkcję. Brakuje miejsca na realizację kontraktu: kto co robi, jakie są etapy i odbiory, gdzie leży dokumentacja przetargowa, projektowa i wykonawcza oraz która rewizja rysunku jest obowiązująca. `project_delivery` to zamyka, wzorując się na modelach Odoo (Project, Task, Milestone, Documents, tier validation; źródło: `odoo-project-docs.md`). Używa przy tym wyłącznie mechanizmów OM (komendy, `makeCrudRoute`, ProgressJob, ModuleConfigService, ACL).

Największe ryzyko techniczne to pamięć i dysk VPS. Pliki budowlane to setki MB, a dzisiejszy upload `storage_s3` buforuje cały plik w RAM aplikacji (§5.9). Dlatego moduł ma własną, wąską ścieżkę presigned + multipart i strumieniowy worker ZIP. Plan testów (PR C) musi to udowodnić pomiarem pamięci (§14).

---

## 0. Architecture (Architektura)

### 0.1 Moduły i kierunek zależności (D98)

```
customers  directory  auth  configs  audit_logs  query_index  progress  notifications  feature_toggles
    ^   (FK-id + snapshot; eventy customers.deal.*; odczyt przez query engine / DI; zero HTTP)
    |
project_costing (BAZA, zawsze w buildzie)
    |  posiada: calculationLookupService (+ getWinningOffer, listStructure — zmiana D116/D101; D99 — zastąpiona przez D116),
    |           executionScheduleRegistry (NOWY rejestr — zmiana D100), scheduleSourceRegistry,
    |           elementTypeService, projectCostingSettings, eventy project_costing.*
    ^                                   ^
    | zależy od                         | zależy od
project_schedule (OPCJONALNY)      project_delivery (OPCJONALNY, NOWY)
  rejestruje:                        używa: calculationLookupService, executionScheduleRegistry
   InternalScheduleSource,           subskrybuje: customers.deal.*, project_costing.calculation.deleted,
   InternalExecutionScheduleProvider              project_costing.offer_role.changed
                                     storage: @open-mercato/storage-s3 (klient S3 + preset env) ──> S3 w UE (D111)
```

Reguły (`packages/core/AGENTS.md` § Cross-Module Coupling; checklista Kod p1):
- `project_costing` nie importuje, nie resolve'uje i nie wymaga `project_delivery`. Nie zna jego eventów, tras ani tabel. Hostuje tylko generyczny rejestr `executionScheduleRegistry`, który sam nie wie, kto się w nim rejestruje.
- `project_delivery` ↔ `project_schedule`: **zero importów w obie strony**. Delivery pyta rejestr costingu („czy jest harmonogram wykonawczy inwestycji X, a jeśli nie, uruchom go”), a schedule rejestruje tam swojego providera. Gdy schedule jest nieobecny lub wyłączony w organizacji, rejestr zwraca `isAvailable = false` (D19, D47, D67).
- Zero HTTP między modułami. Odczyt cudzych danych: serwisy DI (`tryResolve` dla opcjonalnych), query engine, enricher. Zapis cudzych encji: tylko jawna komenda właściciela. Jedyny przypadek to uruchomienie harmonogramu wykonawczego komendą `project_schedule` wywołaną przez providera w rejestrze (v1).
- Brak relacji ORM i constraintów DB do `pc_*`, `ps_*`, `customers_*`. Pola `deal_id`, `investment_id`, `winning_offer_version_id`, `winning_offer_snapshot_id` i `calculation_line_id` to FK-id + snapshot (D134).

### 0.2 Kontrakty DI

**Zużywane z `project_costing` (istniejące):**

| Token DI | Użycie w `project_delivery` |
|---|---|
| `calculationLookupService.getById` / `listByInvestment` | walidacja wersji oferty, lista ofert inwestycji (ID + pola niewrażliwe, bez kosztów i marży) |
| `projectCostingSettings` | odczyt segmentów i domyślnych ustawień organizacji (tylko odczyt) |
| `elementTypeService` | etykiety typów elementów przy linkach kamieni do pozycji |

**Nowe w `project_costing` — zmiana na potrzeby `project_delivery` (D116, D100, D101; D99 — zastąpiona przez D116); wpisane w costing §0.2:**

| Token / metoda | Kontrakt (propozycja) | Kto rejestruje | Kto używa |
|---|---|---|---|
| `calculationLookupService.getWinningOffer(dealId, ctx)` | `{ calculationId, snapshotId, investmentId, offerRole, calculationStatus, closureOutcome, segmentCode, currency } \| null`. Wersja = kalkulacja deala w statusie `sent`/`accepted` z istniejącym `pc_offer_snapshots`; rola z `pc_deal_offer_roles`. Bez kwot kosztu i marży. `null` = deal bez kalkulacji w OM → projekt bez oferty (D116) | `project_costing` | `project_delivery` (komenda tworzenia projektu i podpięcia oferty, §3) |
| `calculationLookupService.listStructure(calculationId, ctx)` | sekcje i pozycje wersji: `{ lineId, parentLineId, lineType, label, sortOrder, unit, quantity }`, bez cen, kosztów i marży (checklista p3) | `project_costing` | `project_delivery` (linki kamieni, D101) |
| `calculationLookupService.getSnapshotSectionPriceTotals(snapshotId, ctx)` — **v1** | sumy cen sprzedaży sekcji ze snapshotu (bez kosztu i marży) do billing % | `project_costing` | `project_delivery` v1 (D101) |
| `executionScheduleRegistry` | `register(provider)`, `get(ctx)`. `ExecutionScheduleProvider`: `isAvailable(ctx)`, `findForInvestment(investmentId, ctx) → { scheduleId, phase, phaseTaskId, executionProjectId } \| null`, `ensureExecution({ investmentId, dealId, projectId, projectLabel }, ctx) → { scheduleId, phaseTaskId, created }` (idempotentne per inwestycja, D131) | `project_costing/di.ts` (pusty rejestr) | `project_schedule/di.ts` rejestruje providera; `project_delivery` czyta |

Costing nie woła `executionScheduleRegistry` sam. To czysty punkt styku, wzorem `scheduleSourceRegistry`. Gdy żaden provider nie jest zarejestrowany, `get()` zwraca `null`.

**Eksportowane przez `project_delivery` (dla przyszłych konsumentów, nie dla costingu/schedule):**

| Token DI | Typ |
|---|---|
| `projectDeliveryLookupService` | read-only: `getProjectForDeal(dealId)`, `getProjectForInvestment(investmentId)` (ID + status) |
| `projectDocsStorageService` | wewnętrzny: presign PUT/GET, multipart, HeadObject, strumień ranged GET dla workera (§5) |

### 0.3 Komendy (write path)

Wszystkie zapisy idą przez komendy (`commandBus.execute`, undo, `audit_logs`), a CRUD przez `makeCrudRoute` + indexer + `openApi`.

| Komenda | Opis | Undo |
|---|---|---|
| `project_delivery.projects.create_from_won_deal` | §3; tworzy projekt + strukturę z szablonu w jednej transakcji | soft delete projektu, gdy nie ma dokumentów; inaczej 409 `UNDO_CONFLICT` |
| `project_delivery.projects.link_winning_offer` | §3; podpina kalkulację (oferta `primary` ze snapshotem) do projektu założonego bez oferty (D116) | tak (odpięcie, gdy kamienie nie mają linków; inaczej 409 `UNDO_CONFLICT`) |
| `project_delivery.projects.update` / `close` / `reopen_flag_clear` | dane projektu, zamknięcie, zdjęcie flagi „deal ponownie otwarty” | tak |
| `project_delivery.projects.set_retention` | data końca retencji + podstawa (§5.8, D113) | tak |
| `project_delivery.stages.*`, `tasks.*`, `milestones.*` | CRUD + `milestones.reach` | tak |
| `project_delivery.milestones.link_calculation_lines` | linki do sekcji i pozycji (D101) | tak |
| `project_delivery.folders.*`, `folders.set_acl` | foldery i ACL (D104) | tak |
| `project_delivery.documents.create` / `create_link` | dokument-plik albo dokument-link (D105) | soft delete |
| `project_delivery.documents.add_revision` | po `complete` uploadu albo z workera importu; tworzy niemutowalną rewizję (D103) | soft delete rewizji, tylko gdy nie była zatwierdzona |
| `project_delivery.documents.approve_revision` | MVP: ręczne zatwierdzenie (feature `documents.approve`); ustawia `released_revision_id` na najnowszą zatwierdzoną | tak (przywraca poprzednią) |
| `project_delivery.documents.delete` | soft delete metadanych; **obiekt w S3 zostaje** (§5.8) | tak |
| `project_delivery.storage.purge` | fizyczne usunięcie obiektów — tylko administrator, jawne potwierdzenie (§5.8, D113) | **brak** (operacja nieodwracalna; wymaga potwierdzenia) |
| `project_delivery.storage.archive` | v2 — archiwum/eksport po retencji, za potwierdzeniem administratora | n/d |
| `project_delivery.uploads.reserve` / `complete` / `abort` | sesja uploadu i ledger quota (§5.3, §5.5) | n/d (stan sesji) |
| `project_delivery.imports.start` | start importu e-Zamówień / ZIP / TED (zwraca `progressJobId`) | n/d |
| `project_delivery.settings.update` | ustawienia organizacji (§8) | tak |

### 0.4 Zdarzenia modułu

```
project_delivery.project.created        (clientBroadcast: true)
project_delivery.project.updated
project_delivery.project.closed
project_delivery.project.deal_reopened  (flaga, bez usuwania danych — analogia D72)
project_delivery.milestone.reached      (clientBroadcast: true)
project_delivery.document.created
project_delivery.document.revision_created   (clientBroadcast: true)
project_delivery.document.revision_approved  (clientBroadcast: true)
project_delivery.document.deleted
project_delivery.import.completed       (clientBroadcast: true)
project_delivery.storage.quota_threshold_reached   (MVP, D118: progi 80% i 100% liczone od `used`, raz na przejście progu; payload z ID i progiem)
project_delivery.storage.purged
```

Payload = ID: `{ id, organizationId, tenantId, projectId?, dealId?, investmentId? }`. Bez nazw plików, bez kwot. Blokada powyżej 110% (D118) nie ma eventu: to tylko odpowiedź 413 `STORAGE_QUOTA_EXCEEDED`; event `quota_exceeded` nie istnieje. `clientBroadcast` tylko z ID.

### 0.5 Subskrypcje (wszystkie `persistent: true`)

| Event | Reakcja w `project_delivery` |
|---|---|
| `customers.deal.updated` | odśwież `deal_snapshot`; gdy `closure_outcome` wraca z `won` do NULL → `deal_reopened_at = now()` + event `project.deal_reopened`; **bez usuwania** (analogia D72; D141) |
| `customers.deal.deleted` | snapshot `deleted: true`, banner na projekcie; bez usuwania |
| `customers.deal.lost` | jak `deal_reopened` (flaga), bez usuwania |
| `project_costing.offer_role.changed` | gdy oferta deala projektu przestała być `primary` → flaga `offer_role_mismatch_at`; projekt zostaje (decyzja użytkownika) |
| `project_costing.calculation.deleted` | gdy dotyczy `winning_offer_version_id` (projekt z podpiętą ofertą, D116) → flaga; snapshot oferty w projekcie zostaje |

`project_delivery` nie subskrybuje eventów `project_schedule`. Stan harmonogramu czyta przy odczycie przez `executionScheduleRegistry` (§4.1).

### 0.6 Włączanie modułu per organizacja (D47, D67)

- Build: moduł w `apps/mercato/src/modules.ts` (moduł aplikacji, bez zmian w `packages/core` — D45).
- Per organizacja: `delivery.enabled` w ModuleConfigService (`org:{id}:settings`, D69) + feature'y ACL. Guard `isDeliveryEnabled` na każdej trasie (→ 404 `MODULE_DISABLED`), w menu, widgetach i zakładce deala.
- `feature_toggles` to tylko globalny kill-switch per tenant (D47).
- Wyłączenie ukrywa dane (D67): projekty i dokumenty znikają z UI i API. **Nic nie jest usuwane**, a obiekty w S3 zostają (D113). Ponowne włączenie przywraca widok.
- Wymaganie środowiskowe: `storage_s3` włączony (`OM_ENABLE_STORAGE_S3`, `apps/mercato/src/modules.ts` l.117–118) i skonfigurowany bucket `projectDocs` (§5.1). Gdy konfiguracji brak, moduł działa bez dokumentów-plików (linki i metadane działają), a upload zwraca 422 `STORAGE_NOT_CONFIGURED` (D143).

---

## 1. Cel i zakres

### 1.1 Cel

Prowadzenie realizacji wygranego kontraktu w tym samym systemie co przetarg, kalkulacja i harmonogram: struktura projektu, odpowiedzialności, kamienie milowe powiązane z ofertą oraz jedno źródło prawdy dla dokumentacji (rewizje, akceptacje od v1, kontrola dostępu).

### 1.2 Stan VPS (stan na 23.10)

Źródło: Dawid (agent Dokploy) przez Koordynatora, 2026-10-23. To stan, nie wymaganie.

| Zasób | Stan na 23.10 |
|---|---|
| Dysk | 115 GB, zajęte 28 GB, wolne ok. 87 GB |
| Baza OM | 433 MB; `attachments` puste |
| RAM | 3,8 GB, dostępne ok. 0,9 GB |
| Swap | ok. 2,3 GB w użyciu |

Wniosek (D110): jeden import dokumentacji budowlanej (setki MB) buforowany w RAM wywołałby swap albo OOM całej instancji OM. Dysk VPS nie może być magazynem plików projektów. Stąd wymagania:
1. Pliki nie trafiają na dysk VPS: brak drivera `local` dla `projectDocs` i brak plików tymczasowych w workerze (ZIP czytany zakresami z S3, §5.6).
2. Pliki nie przechodzą przez proces serwera HTTP aplikacji: upload i pobranie przez presigned URL bezpośrednio przeglądarka ↔ S3. Serwer podpisuje i zapisuje metadane. Bufor RAM istnieje tylko w procesie workera (proces potomny `queue worker --all` w kontenerze `app`), jest ograniczony do `partSize × queueSize` i dzieli limit pamięci kontenera `app` (D110, D115).
3. Jedyny proces, który dotyka bajtów pliku, to worker importu (§5.6) — istniejący proces workerów OM w kontenerze aplikacji (D115). Działa strumieniowo, z buforem wyłącznie w RAM ograniczonym do `partSize × queueSize` (parametry bez wartości) i z zerem plików tymczasowych na dysku VPS. Współbieżność 1 dotyczy tylko kolejek importu i multipartu `project_delivery` (D115).
4. Plan testów (PR C) mierzy pamięć na dużym pliku i dużym ZIP (§14).

### 1.3 Granice modułu

| Obszar | Właściciel | `project_delivery` |
|---|---|---|
| Oferta, wersje, snapshot, inwestycja, rola oferty | `project_costing` | czyta przez DI, trzyma FK-id + snapshot |
| Harmonogram wykonawczy, Gantt, partie produkcji | `project_schedule` (v1) | link/uruchomienie przez rejestr DI; bez własnego Gantta (D100) |
| Deal, firma, osoby | `customers` | czyta, nie zapisuje |
| Pliki projektu | S3 w UE (D111) przez `projectDocsStorageService` | metadane, ledger quota, ACL |
| Załączniki OM (`attachments`) | core | **nie** używane dla plików projektu (driver in-memory, quota per tenant — §5.9) |

---

## 2. Model danych

### 2.1 Konwencje

- Prefiks `pd_` (zatwierdzony, D98). Każda tabela ma `organization_id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete) i `version` (optimistic locking) na encjach edytowalnych.
- FK-id do innych modułów bez constraintu DB + snapshot potrzebnych pól. FK wewnątrz modułu normalne.
- Unikalności jako partial unique `WHERE deleted_at IS NULL`. Konflikt `23505` mapowany na 409 z ID istniejącego rekordu.
- Numeracja projektów przez sekwencję Postgresa per organizacja (`pd_document_sequences`, wzór `SalesDocumentNumberGenerator`, jak `pc_document_sequences`). Format `PRJ-YYYY-NNNNNN` (propozycja).
- Brak hardkodowanych UUID. Szablony i słowniki identyfikowane kodem (`segment_code`, `template_code`).

### 2.2 Tabele — MVP

#### `pd_projects` — projekt realizacji

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` NOT NULL | numer z sekwencji |
| `name` | `text` NOT NULL | domyślnie z tytułu deala |
| `status` | `text` NOT NULL DEFAULT `'active'` | `active` \| `on_hold` \| `completed` \| `cancelled`; CHECK |
| `segment_code` | `text` NOT NULL | segment szablonu (wielosegmentowość, D2); z oferty, a bez oferty z parametru `segmentCode` żądania (D116) |
| `template_id` | `uuid` NULL | FK → `pd_project_templates` |
| `deal_id` | `uuid` NOT NULL | FK-id → deal (`customers`) |
| `winning_offer_version_id` | `uuid` NULL | FK-id → `pc_calculations.id` (wersja zwycięskiej oferty); NULL = deal bez kalkulacji w OM, do podpięcia komendą `link_winning_offer` (D116) |
| `winning_offer_snapshot_id` | `uuid` NULL | FK-id → `pc_offer_snapshots.id` (zamrożona oferta); NULL razem z `winning_offer_version_id` (CHECK `pd_projects_offer_all_or_none`, D116) |
| `investment_id` | `uuid` NULL | FK-id → `pc_investments.id`; z oferty, NULL bez oferty (D116) |
| `deal_snapshot` | `jsonb` NOT NULL | `title`, `closure_outcome`, `owner_user_id`, `customer` (nazwa, NIP), `value_amount`, `value_currency` (wartość i waluta projektu bez oferty, D116), `deleted` |
| `offer_snapshot` | `jsonb` NULL | NULL bez oferty (D116); `calculation_number`, `version_no`, `currency`, `sent_at`, `offer_role` — bez kosztów i marży |
| `manager_user_id` | `uuid` NULL | kierownik projektu |
| `planned_start_date`, `planned_end_date` | `date` NULL | dane informacyjne; plan wykonawczy jest w schedule (D100) |
| `warranty_end_date`, `rekojmia_end_date` | `date` NULL | wpisywane ręcznie w MVP; źródło podpowiedzi retencji (D113); encja gwarancji — v2 (D108) |
| `retention_until` | `date` NULL | data końca retencji (D113) |
| `retention_basis` | `text` NULL | `warranty_end` \| `rekojmia_end` \| `later_of_both` \| `manual`; CHECK |
| `deal_reopened_at`, `offer_role_mismatch_at`, `offer_deleted_at` | `timestamptz` NULL | flagi (§0.5, D141); bez usuwania danych |
| `closed_at` | `timestamptz` NULL | |

Indeksy (D116; D99 — zastąpiona przez D116):

```sql
CREATE UNIQUE INDEX pd_projects_one_per_deal
  ON pd_projects (organization_id, tenant_id, deal_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX pd_projects_one_per_investment
  ON pd_projects (organization_id, tenant_id, investment_id)
  WHERE deleted_at IS NULL AND investment_id IS NOT NULL;   -- projekt bez oferty (investment_id NULL) poza tym indeksem (D116)
ALTER TABLE pd_projects ADD CONSTRAINT pd_projects_offer_all_or_none CHECK (
  (winning_offer_version_id IS NULL) = (winning_offer_snapshot_id IS NULL)
  AND (winning_offer_version_id IS NULL) = (offer_snapshot IS NULL)
);
```

Unikalność: jeden projekt na wygrany deal (`deal_id` NOT NULL, `pd_projects_one_per_deal`) i jeden projekt na inwestycję (`pd_projects_one_per_investment`, tylko `investment_id` NOT NULL). Projekt może powstać bez oferty i bez inwestycji (D116), więc `winning_offer_version_id`, `winning_offer_snapshot_id`, `offer_snapshot` i `investment_id` są nullable; trzy kolumny oferty są NULL razem albo razem ustawione (`pd_projects_offer_all_or_none`). Projekt bez oferty podlega tylko unikalności per deal; unikalność per inwestycja sprawdza się przy podpięciu oferty. Indeksu per wersja oferty nie ma: wersja oferty należy do deala, a deal ma najwyżej jeden projekt. Każda wygrana część przetargu to osobna inwestycja i osobny deal (D132), więc dwa projekty w jednej inwestycji nie występują. Drugi projekt dla tego samego deala albo dla inwestycji, która ma już projekt (przy tworzeniu i przy podpięciu oferty) → 409 `PROJECT_EXISTS`. Nie używamy `NULLS NOT DISTINCT`: wymaga Postgresa 15+, a obie reguły dotyczą tylko kolumn NOT NULL (partial index; §5.12 pkt 6).

Projekt inwestycji ma w harmonogramie inwestycji (D77) jedną fazę projektu (zadanie-podsumowanie WBS, D131). Split inwestycji (D83, v1): projekt zostaje przy inwestycji, do której trafił deal projektu. Komenda split jest w costingu, a delivery odświeża `investment_id` subscriberem `project_costing.investment.updated` (v1).

#### `pd_project_templates` + `pd_project_template_items`

Szablon per `segment_code` (np. `prefab`), z kodem `template_code`. Pozycje: `item_type` (`stage` | `task` | `milestone` | `folder`), `parent_key`, `name`, `sort_order`, `default_acl` (dla folderu), `offset_hint` (opcjonalna podpowiedź kolejności, nie data). Seed szablonu `prefab` w `setup.ts` (`seedDefaults`): etapy (Przygotowanie, Projekt warsztatowy, Produkcja, Dostawy i montaż, Odbiory, Rozliczenie) oraz foldery (`00 Przetarg`, `01 Umowa`, `02 Projekt`, `03 Rysunki warsztatowe`, `04 Produkcja i jakość`, `05 Dostawy`, `06 Odbiory i protokoły`, `07 Korespondencja`). Nazwy to propozycja; szablon edytuje administrator.

#### `pd_project_stages`, `pd_tasks`, `pd_milestones`

- `pd_project_stages`: `project_id`, `name`, `sort_order`, `status` (`planned` | `in_progress` | `done`).
- `pd_tasks`: `project_id`, `stage_id` NULL, `title`, `description`, `assignee_user_id` NULL, `due_date` NULL, `status` (`todo` | `in_progress` | `blocked` | `done`), `priority`. Lista zadań (DataTable, kanban z `packages/ui`, jeśli jest) — **bez zależności i bez Gantta** (D100).
- `pd_milestones`: `project_id`, `stage_id` NULL, `name`, `due_date` NULL, `status` (`planned` | `reached` | `accepted`), `reached_at`, `accepted_at`, `billing_pct` `numeric(5,2)` NULL (**v1**, D101; CHECK 0–100; suma per projekt ≤ 100 walidowana w serwisie).

#### `pd_milestone_calc_links` (D101)

| Kolumna | Typ | Opis |
|---|---|---|
| `milestone_id` | `uuid` NOT NULL | FK → `pd_milestones` |
| `calculation_id` | `uuid` NOT NULL | FK-id → `pc_calculations.id` (= `winning_offer_version_id` projektu; walidowane). Projekt bez podpiętej kalkulacji nie ma linków (D116) |
| `calculation_line_id` | `uuid` NOT NULL | FK-id → `pc_calculation_lines.id` (sekcja albo pozycja) |
| `line_kind` | `text` NOT NULL | `section` \| `item` |
| `label_snapshot` | `text` NOT NULL | etykieta z `listStructure` w chwili linkowania |

Unique `(milestone_id, calculation_line_id) WHERE deleted_at IS NULL`. Link do sekcji obejmuje jej pozycje. Ta sama pozycja może być w wielu kamieniach (np. częściowe dostawy). Sumę billing % per pozycja waliduje serwis (v1).

#### `pd_project_members` (D104)

`project_id`, `user_id`, `role` (`manager` | `member` | `viewer`). Unique `(project_id, user_id)`. Role projektu **nie** zastępują RBAC: feature'y z `acl.ts` decydują, co użytkownik może robić w module, a członkostwo — w którym projekcie (§6).

#### `pd_folders` + `pd_folder_acl` (D104)

- `pd_folders`: `project_id`, `parent_id` NULL, `name`, `sort_order`, `acl_mode` (`inherit` | `restricted`). Unique `(project_id, parent_id, lower(name))`.
- `pd_folder_acl`: `folder_id`, `principal_type` (`user` | `project_role`), `principal_ref` (ID użytkownika albo kod roli projektu), `access` (`read` | `write` | `manage`). Folder `restricted` dziedziczy tylko wpisy ACL. Dziedziczenie z projektu działa dla `inherit`.

#### `pd_documents` (D102, D105)

| Kolumna | Typ | Opis |
|---|---|---|
| `project_id`, `folder_id` | `uuid` NOT NULL | |
| `number` | `text` NULL | numer dokumentu/rysunku (rejestr rysunków — v1) |
| `title` | `text` NOT NULL | |
| `kind` | `text` NOT NULL | `file` \| `link`; CHECK |
| `link_url` | `text` NULL | dla `link`: URL (tylko `https:`, inny schemat → 422 — D138; brak pobierania treści — D105) |
| `link_provider` | `text` NULL | `generic` \| `ezamowienia` \| `ted` \| `gdrive` (v1) \| `sharepoint`/`onedrive`/`nextcloud` (v2) |
| `source` | `text` NOT NULL | `manual` \| `ezamowienia` \| `ted` \| `zip_import` |
| `source_ref` | `text` NULL | np. identyfikator postępowania i numer dokumentu |
| `latest_revision_id` | `uuid` NULL | najnowsza rewizja (dowolny status) |
| `released_revision_id` | `uuid` NULL | najnowsza **zatwierdzona** — jedyna „do produkcji” (D103) |

#### `pd_document_revisions` — niemutowalna (D103)

| Kolumna | Typ | Opis |
|---|---|---|
| `document_id` | `uuid` NOT NULL | |
| `seq` | `int` NOT NULL | 1, 2, 3… per dokument; unique `(document_id, seq)` |
| `rev_label` | `text` NULL | oznaczenie z rysunku (np. „A”, „B”) |
| `storage_config_ref` | `text` NOT NULL | który bucket/konfiguracja (§5.1) — umożliwia zmianę dostawcy bez przenoszenia starych plików |
| `storage_key` | `text` NOT NULL | klucz obiektu (losowy, §5.3) |
| `size_bytes` | `bigint` NOT NULL | z `HeadObject` po uploadzie, nie z deklaracji klienta |
| `content_type` | `text` NOT NULL | |
| `original_filename` | `text` NOT NULL | |
| `sha256` | `text` NULL | liczone strumieniowo przez worker `checksum` z `GetObject` (§5.3, §5.12 pkt 7); przy imporcie liczone w locie przez worker importu; NULL do czasu policzenia |
| `etag` | `text` NULL | z S3 |
| `purged_at`, `purge_status` | `timestamptz` NULL, `text` NULL | purge po potwierdzeniu administratora (§5.8): `purged` \| `purge_failed`; treść rewizji bez zmian |
| `review_status` | `text` NOT NULL DEFAULT `'draft'` | `draft` \| `in_review` (v1) \| `approved` \| `rejected` \| `superseded`; CHECK |
| `approved_by`, `approved_at` | | |
| `uploaded_by`, `created_at` | | |

Niemutowalność: komendy nie aktualizują kolumn treści (`storage_key`, `size_bytes`, `content_type`, `original_filename`, `sha256` po ustawieniu, `etag`). Zmienia się tylko `review_status`, `approved_*` i `deleted_at`. Serwis odrzuca taką próbę z 409 `REVISION_IMMUTABLE`, a test integracyjny w PR C to sprawdza. Nowy plik = nowa rewizja. Klucz S3 jest losowy, więc nadpisanie obiektu nie jest możliwe przez API modułu.

Zatwierdzenie rewizji N ustawia `released_revision_id = N`, gdy N ma najwyższe `seq` wśród zatwierdzonych. Wcześniejsze zatwierdzone dostają `superseded`. Zatwierdzenie starszej rewizji niż już wydana → 409 `NEWER_REVISION_RELEASED`.

#### `pd_upload_sessions` — sesje uploadu i ledger quota (D102, D112)

| Kolumna | Typ | Opis |
|---|---|---|
| `project_id`, `document_id` | `uuid` | cel uploadu |
| `storage_config_ref`, `storage_key` | `text` | |
| `mode` | `text` | `single` \| `multipart` |
| `s3_upload_id` | `text` NULL | dla multipart |
| `declared_bytes` | `bigint` NOT NULL | rezerwacja quota |
| `status` | `text` | `reserved` \| `completed` \| `aborted` \| `expired` |
| `expires_at` | `timestamptz` NOT NULL | po tym czasie sweeper zwalnia rezerwację i wysyła `AbortMultipartUpload` |
| `purpose` | `text` | `document` \| `import_staging` |

Zużycie organizacji = suma `pd_document_revisions.size_bytes` (bez usuniętych fizycznie, czyli do potwierdzenia purge — §5.8) + suma `declared_bytes` sesji `reserved`. Liczone pod advisory lockiem per organizacja (wzór `quota-service.ts` l.146–163, ale per **organizacja**, nie per tenant).

#### `pd_imports` (§5.6)

`project_id`, `source` (`ezamowienia` | `ted` | `zip_upload`), `source_ref`, `progress_job_id`, `status`, `original_revision_id` (`uuid` NULL; rewizja oryginału ZIP w `00 Przetarg`, D119 — podstawa pozycji „archiwum dowodowe” w widoku zużycia), `report` (`jsonb`: liczba plików, pominięte z powodem, linki zewnętrzne, bajty). Raport bez treści plików.

#### `pd_storage_usage_periods` (§5.5, D118)

`organization_id`, `tenant_id`, `period_start`, `period_end`, `peak_used_bytes` (`bigint`; szczytowe `used` w okresie), `quota_bytes` (limit obowiązujący w okresie); unique `(organization_id, period_start)`. Aktualizowane przy zatwierdzeniu zużycia pod advisory lockiem per organizacja. Nadwyżka okresu = `max(0, peak_used_bytes − quota_bytes)`; stawka i okres z cennika. Bez kwot pieniężnych w tabeli.

#### `pd_document_sequences`

Sekwencje numeracji projektów (i od v1 transmittali, RFI, protokołów) per organizacja.

### 2.3 Tabele — v1 i v2 (zakres, bez szczegółów kolumn)

| Faza | Tabela | Zakres |
|---|---|---|
| v1 | `pd_approval_tiers`, `pd_approval_reviews` | lekka tier-validation (§9) |
| v1 | `pd_share_links` | `target_type` (`folder` \| `document` \| `revision`), `token_hash`, `expires_at` NOT NULL (D104), `revoked_at`, `created_by`, licznik pobrań; reguły i kody: D142, D152 |
| v1 | `pd_transmittals` + `pd_transmittal_items` | wysłanie zestawu rewizji do odbiorcy (link udostępniania z datą wygaśnięcia), potwierdzenie odbioru; lista pozycji niezmienna po wysłaniu (409 `TRANSMITTAL_SENT`, D155); wysłanie zablokowane, gdy dokumenty z wymaganą akceptacją jej nie mają (409 `APPROVAL_PENDING`, D157) |
| v1 | `pd_correspondence` (typ `letter` \| `rfi`) | numer, nadawca/odbiorca, termin odpowiedzi, powiązane dokumenty |
| v1 | `pd_protocols` + `pd_protocol_defects` | protokoły odbioru (częściowe i końcowy), usterki; odbiór → `milestones.accept` |
| v1 | `pd_external_drive_links` | Google Drive w trybie linku (D105, D112) |
| v2 | `pd_warranty_terms` | gwarancja/rękojmia (D108); zasila `warranty_end_date`, `rekojmia_end_date` |
| v2 | `pd_quality_documents` | dokumenty jakości przypięte do partii produkcji (FK-id do partii schedule/costing, przez DI) |
| v2 | `pd_storage_targets` | bucket klienta (wariant B, D112) |

---

## 3. Tworzenie projektu — „wygrany przetarg → realizacja” (D116; D99 — zastąpiona przez D116)

**Wejście:** przycisk na zakładce deala (`detail:customers.deal:tabs`, widoczny tylko dla `closure_outcome = 'won'`) albo `POST /api/project-delivery/projects/from-won-deal` `{ dealId, templateCode?, segmentCode?, name?, managerUserId? }` (`segmentCode` wymagany tylko bez oferty; brak → 422 `SEGMENT_REQUIRED`).

**Walidacje w komendzie `create_from_won_deal` (jedna transakcja):**
1. Moduł włączony w organizacji (§0.6), feature `project_delivery.projects.create`.
2. Deal istnieje, `deleted_at IS NULL`, `closure_outcome = 'won'` → inaczej 422 `DEAL_NOT_WON` (D133).
3. `calculationLookupService.getWinningOffer(dealId)`: gdy zwraca ofertę, musi to być oferta z rolą `primary` (D51, D65) ze snapshotem → inaczej 422 `OFFER_NOT_PRIMARY`; projekt dostaje ofertę, snapshot oferty i inwestycję. Gdy zwraca `null` (deal bez kalkulacji w OM), projekt powstaje bez oferty i bez inwestycji (bez `segmentCode` → 422 `SEGMENT_REQUIRED`), a wartość i walutę bierze z deala (`deal_snapshot.value_amount`, `value_currency`); kamienie milowe nie mają linków do oferty (D116).
4. Brak aktywnego projektu dla deala (partial unique `pd_projects_one_per_deal`) i — gdy jest oferta — dla jej inwestycji (partial unique `pd_projects_one_per_investment`, D116). Istniejący projekt deala albo inwestycji, albo wyścig (`23505` na którymkolwiek indeksie) → 409 `PROJECT_EXISTS` z `existingProjectId`.
5. Szablon: `templateCode` albo domyślny dla `segment_code` oferty (bez oferty: `segmentCode` z żądania). Brak szablonu → projekt z jednym etapem i folderem `00 Przetarg` (bez błędu).

**Efekt:** projekt + etapy, zadania, kamienie milowe i foldery z szablonu. Snapshot deala i oferty, właściciel/kierownik, event `project_delivery.project.created`. Z UI opcjonalnie: start importu dokumentacji przetargowej (§5.6) i (v1) uruchomienie harmonogramu wykonawczego (§4.1).

**Podpięcie kalkulacji później (D116):** `POST /api/project-delivery/projects/:id/winning-offer` `{ calculationId }` → komenda `link_winning_offer` (feature `project_delivery.projects.manage`, bez niego 403 — D135; audyt). Projekt, który ma już ofertę → 409 `OFFER_ALREADY_LINKED` (zmiana podpiętej oferty nie jest w zakresie; undo komendy wg reguły wyżej). Wersja oferty musi należeć do deala projektu, mieć rolę `primary` i snapshot → inaczej 422 `OFFER_NOT_PRIMARY`. Gdy inwestycja tej oferty ma już inny projekt → 409 `PROJECT_EXISTS` z `existingProjectId` (`pd_projects_one_per_investment`, D116; wyścig `23505` tak samo). Po podpięciu działają linki kamieni (D101) i faza projektu w harmonogramie inwestycji (D131, v1).

**Nie robimy:** automatycznego tworzenia projektu przez subscriber `customers.deal.won` ani przez n8n (D116; wizja: n8n nie tworzy projektów). Projekt to świadoma decyzja handlowca.

**Deal ponownie otwarty / przegrany po wygranej:** flaga i banner, projekt zostaje (§0.5). Zamknięcie albo anulowanie projektu to decyzja użytkownika (`projects.close` ze statusem `cancelled`), bez usuwania dokumentów (D113).

---

## 4. Harmonogram i kamienie milowe

### 4.1 Harmonogram wykonawczy (D100; v1)

- `project_delivery` nie ma Gantta, zależności zadań ani auto-planowania. Harmonogram wykonawczy to rekord `ps_schedules` inwestycji w fazie `execution` (D77). Inwestycja ma najwyżej jeden projekt (D116; wygrana część przetargu to osobna inwestycja, D132); projekt ma w tym rekordzie jedną fazę: zadanie-podsumowanie WBS z `execution_project_id` = ID projektu (D131). Flaga „deal ponownie otwarty” (D72) jest na tej fazie. Po wygraniu deala schedule sam zmienia fazę oferty na wykonawczą (D24, subscriber `dealWon.ts` w schedule).
- Zakładka „Harmonogram” na projekcie: `executionScheduleRegistry.get(ctx)`:
  - `null` albo `isAvailable() = false` (moduł nieobecny, wyłączony w organizacji, D19/D47/D67) → komunikat „Harmonogram nie jest używany w tej firmie”, bez błędu;
  - projekt bez inwestycji (bez oferty, D116) → komunikat „Harmonogram dostępny po podpięciu oferty”, bez przycisku;
  - `findForInvestment(investmentId)` zwraca rekord z `executionProjectId` = ID projektu → link do widoku Gantta inwestycji w schedule (`/project-schedule/investments/:investmentId/gantt`, schedule §6.1) z zaznaczoną fazą projektu (i badge „deal ponownie otwarty”, gdy faza ma flagę D72);
  - brak fazy projektu → przycisk „Uruchom harmonogram wykonawczy” (feature `project_delivery.projects.manage` **oraz** feature schedule wymagany przez jego komendę) → `ensureExecution({ investmentId, dealId, projectId, projectLabel })` → rekord inwestycji, komenda schedule `create-execution` (idempotentna; schedule §6.1, D77) i faza projektu (komenda `ensure_project_phase`, idempotentna per inwestycja; faza innego projektu → 409 `PROJECT_PHASE_EXISTS`, D131).
- Brak przechowywanego `schedule_id` ani ID fazy w `pd_projects`: link rozwiązywany przy odczycie, więc nie ma rozjazdu po zmianach w schedule.
- MVP: zakładka ukryta. Schedule nie wchodzi do MVP (costing §14 „Zakres zbiorczy”), a projekt działa bez harmonogramu.

### 4.2 Kamienie milowe ↔ kalkulacja (D101)

- MVP: kamień milowy linkuje sekcje i pozycje zwycięskiej wersji (`listStructure`). Widok projektu pokazuje, które pozycje oferty są objęte kamieniami, a które nie.
- v1: `billing_pct` per kamień. Wartość kamienia = `billing_pct` × suma cen sprzedaży ze snapshotu (`getSnapshotSectionPriceTotals`). Liczona przy odczycie, bez kosztów i marży. Zaokrąglenie half-up do 2 miejsc (D16, D62). Odbiór częściowy (protokół v1) → `milestones.accept` → event dla przyszłego fakturowania (poza zakresem).
- Kamienie milowe projektu nie są synchronizowane z kamieniami Gantta w schedule. Ewentualne powiązanie to v2 (Otwarte).

---

## 5. Dokumenty i storage

### 5.1 Konfiguracja storage (D111)

- **Dostawca (D111):** dowolny zgodny z S3, w kraju UE. **Domyślnie najtańszy dostawca w UE w pełni kompatybilny z pakietem `storage-s3` (z `If-None-Match`) i z multipartem speki — wg tabeli §5.11 OVHcloud Object Storage** (endpoint `https://s3.<region>.io.cloud.ovh.net`; region UE, np. `waw`, `de`, `gra`, `sbg` (1-AZ) albo `eu-west-par` (3-AZ) — parametr wdrożenia, dokumentacja OVHcloud „Endpoints and Object Storage geoavailability”). **Fallback: Backblaze B2 EU Central (Amsterdam) z adapterem** (endpoint `https://s3.eu-central-003.backblazeb2.com`, region `eu-central-003`, region konta niezmienny; adapter: bez `If-None-Match`, tylko unikalne klucze). Endpoint i region potwierdzamy w panelu dostawcy po założeniu konta.
- **Konfiguracja bez sekretów w repo i w ustawieniach:**
  - parametry niesekretne (endpoint, region, bucket, `forcePathStyle`, prefiks klucza) — env albo ustawienia organizacji/instancji;
  - sekrety (klucz aplikacji) — tylko env na serwerze (Dokploy).
  - Propozycja: osobny prefiks env dla plików projektów, czytany mechanizmem `credentialsEnvPrefix` drivera S3 (`s3-driver.ts` l.42, l.102–108 czyta `${prefix}_ACCESS_KEY_ID`, `${prefix}_SECRET_ACCESS_KEY`, `${prefix}_SESSION_TOKEN`). Nazwy (bez wartości): `OM_PROJECT_DOCS_S3_ENDPOINT`, `OM_PROJECT_DOCS_S3_REGION`, `OM_PROJECT_DOCS_S3_BUCKET`, `OM_PROJECT_DOCS_S3_FORCE_PATH_STYLE`, `OM_PROJECT_DOCS_S3_CONDITIONAL_WRITES` (`true` u dostawcy domyślnego; `false` = adapter B2), `OM_PROJECT_DOCS_S3_ACCESS_KEY_ID`, `OM_PROJECT_DOCS_S3_SECRET_ACCESS_KEY`.
  - Fallback: preset `storage_s3` (`OM_INTEGRATION_STORAGE_S3_*`, `preset.ts` l.46–50, l.72–73) — tylko gdy bucket jest **osobny** (R6).
- **Osobny bucket na pliki projektów (propozycja, Otwarte O4):** nie współdzielimy bucketu ani prefiksu z driverem `storage_s3` dla `attachments`. Powód: `reconcileTenantS3Objects` listuje wszystkie obiekty pod prefiksem drivera i wlicza je do quota tenanta core (`quota-accounting.ts` l.14, l.23–28), więc pliki projektów zjadałyby quota załączników tenanta (R6).
- **Klient S3:** `@aws-sdk/client-s3` i `@aws-sdk/s3-request-presigner` (już zależności `@open-mercato/storage-s3`, `package.json`: `^3.1085.0`) + `createSafeS3RequestHandler` / `assertStaticallySafeS3Endpoint` z `storage_s3/lib/endpoint-safety.ts` (ochrona SSRF). Ustawienia klienta: `requestChecksumCalculation: 'WHEN_REQUIRED'`, `responseChecksumValidation: 'WHEN_REQUIRED'`. Dzięki temu presigned URL dla przeglądarki nie zawiera parametrów sum kontrolnych, których przeglądarka nie policzy (R7). Klucze zawsze losowe i unikalne; `IfNoneMatch: '*'` wysyłany tylko przy `CONDITIONAL_WRITES = true` (dostawca domyślny), adapter B2 go nie wysyła (R2).
- **Bucket:** prywatny, w klasie standardowej dostawcy. CORS: `AllowedOrigin` = domena OM, `AllowedMethod` `PUT`, `GET`, `HEAD`; `ExposeHeaders` `ETag` (wymagane do multipart w przeglądarce). Reguły cyklu życia: **żadnej reguły usuwania ani przejścia klasy** dla prefiksu dokumentów (D113). Dozwolone wyłącznie: przerywanie niedokończonych multipartów (`AbortIncompleteMultipartUpload`; na B2 `daysFromStartingToCancelingUnfinishedLargeFiles`) i wygaszanie prefiksu `staging/` — oba jako zabezpieczenie zapasowe za sweeperem (§5.12 pkt 1 i 4; D129). Na buckecie wersjonowanym reguła dla `staging/` obejmuje także wersje niebieżące i markery usunięcia. **Wersjonowanie bucketu u OVHcloud włączone (D117)**; warunkowy zapis `If-None-Match: *` działa także przy wersjonowaniu (warunki liczone względem bieżącej wersji, docs OVHcloud s3-conditional-writes, odczyt 2026-10-23). B2 wersjonuje zawsze. Na obu każde usunięcie (purge, sweeper) usuwa wszystkie wersje z `VersionId` (§5.8, D121, D122). Do tego kopia zapasowa bazy OM w MVP i nocna kopia obiektów do B2 w v1 (parametr planu `storage.backup_copy`, D117).
- `storage_config_ref` w rewizji wskazuje konfigurację, w której leży obiekt. Zmiana dostawcy dotyczy nowych plików. Migracja starych to osobna, jawna operacja administratora (v2, Otwarte O4).

### 5.2 Wariant storage per organizacja (D112)

| Wariant | Opis | Faza |
|---|---|---|
| **A** | nasz bucket u domyślnego dostawcy (§5.1, D111; fallback B2 z adapterem). Limit GB w abonamencie jako limit miękki (ostrzeżenia 80% i 100%, blokada powyżej 110%, D118). Quota per organizacja (§5.5) | **MVP (jedyny dostępny)** |
| **B — Google Drive** | dysk klienta w trybie linku: OM trzyma metadane i link, plik zostaje u klienta (D105) | v1 |
| **B — bucket klienta** | S3 klienta (endpoint, bucket, region w ustawieniach); poświadczenia bucketu klienta (v2): w bazie wyłącznie zaszyfrowane mechanizmem szyfrowania danych OM, poza `module_configs`, nigdy jawnie, w repo, logach ani eventach; w API tylko maska; mechanizm wybierany w v2 (O10, D130) | v2 |
| **B — SharePoint/OneDrive/Nextcloud** | tryb linku | v2 |

Reguły:
- Wybór w ustawieniach organizacji (`storage.variant`), feature `project_delivery.settings.manage` (administrator).
- MVP przyjmuje tylko `A`. Zapis `B` → 422 `STORAGE_VARIANT_NOT_AVAILABLE` z informacją o fazie. UI pokazuje B jako niedostępny („od v1/v2”).
- Zmiana wariantu nie przenosi i nie usuwa istniejących plików. Pliki w A zostają i liczą się do quota, aż administrator je zarchiwizuje lub usunie (§5.8).
- W wariancie B (link) pliki nie zużywają quota A. Linki działają we wszystkich wariantach (ręczny link, MVP).
- Limity i ceny to **parametry konfiguracji bez wartości** (należą do cennika): `storage.quota_bytes` (limit miękki, D118), `storage.overage_rate` (stawka dopłaty za nadwyżkę ponad 100%, rozliczanej w okresie rozliczeniowym, D118, D112) i `storage.backup_copy` (v1, D117; kopia B2 nie liczy się do quota klienta — koszt operacyjny w cenie). Spec nie podaje wartości.

### 5.3 Upload z przeglądarki — presigned PUT i multipart (D102, D110)

Serwer nie widzi bajtów pliku. Moduł ma **własne trasy i własne feature'y** (`/api/project-delivery/uploads…`, `/revisions/:id/download`, `/revisions/:id/preview-url`; §6, §7) i sam podpisuje URL przez `@aws-sdk/s3-request-presigner` (D127). Nie używa trasy `storage_s3` `POST /api/storage-providers/s3/signed-url`, bo ta wymaga `storage_providers.manage` (§5.9, `signed-url.ts` l.16) i zwraca URL aplikacji zamiast S3 (§5.12 pkt 8). Kroki:

1. **Rezerwacja** — `POST /api/project-delivery/uploads` `{ projectId, folderId, documentId?, fileName, sizeBytes, contentType }`:
   - ACL: zapis do folderu (§6);
   - limit rozmiaru pliku: `docs.max_file_bytes` (parametr; podniesiony względem `attachments`, którego domyślny limit to 25 MB — `upload-limits.ts` l.1);
   - quota (§5.5) → rezerwacja w `pd_upload_sessions` pod advisory lockiem;
   - klucz: `{prefix}/org_{orgId}/proj_{projectId}/{random}` (losowy, bez nazwy pliku; nazwa w metadanych). Klucz generuje wyłącznie serwer; pole klucza albo `sha256` w body rezerwacji → 422 `FIELD_NOT_ALLOWED` (D144, D146). Segmenty jak w `key-scope.ts`;
   - `sizeBytes ≤ docs.multipart_threshold_bytes` → `mode: 'single'`: jeden presigned `PutObject` z `ContentType` i `ContentLength`, krótki TTL (parametr), z `If-None-Match: *` w podpisie tylko przy `CONDITIONAL_WRITES = true` (adapter B2: bez);
   - powyżej → `mode: 'multipart'`: serwer wywołuje `CreateMultipartUpload` (małe żądanie XML) i zwraca `uploadId` + partię presigned URL do `UploadPart` (pierwsze N części). Rozmiar części `docs.multipart_part_bytes` (parametr; minimum S3 5 MiB poza ostatnią, maksymalnie 10 000 części, więc rozmiar części dobierany do rozmiaru pliku).
2. **Wysyłka** — przeglądarka wysyła bezpośrednio do S3 (tylko PUT, bez presigned POST — wspólny mianownik dostawców, R8; trasy presigned POST nie ma → 404, D145), części równolegle z ograniczeniem (np. 3–4), z retry części. `POST /uploads/:id/parts` dokłada kolejne URL części (wygasają).
3. **Zakończenie** — `POST /uploads/:id/complete` `{ parts: [{ partNumber, etag }] }`:
   - multipart: `CompleteMultipartUpload` (lista ETag, bez danych);
   - `HeadObject` → `size_bytes` z S3. Rozbieżność z deklaracją ponad tolerancję → 422 `UPLOAD_SIZE_MISMATCH`, rezerwacja zwolniona, obiekt traktowany jak osierocony i usuwany przez sweeper (D125, D121);
   - komenda `documents.add_revision` (niemutowalna rewizja), sesja `completed`, rezerwacja zamieniona na zużycie;
   - sesja w stanie `expired` → 409 `UPLOAD_SESSION_EXPIRED`, bez rewizji (D149).
4. **Przerwanie** — `POST /uploads/:id/abort` → `AbortMultipartUpload`, zwolnienie rezerwacji. Sweeper (worker, cyklicznie) robi to samo dla sesji po `expires_at`. Sweeper usuwa wyłącznie niedokończone uploady i obiekty osierocone (definicja i warunki: §5.12 pkt 4), **nigdy** obiektów rewizji (D113, D121).
5. **Suma kontrolna** — worker `project_delivery:checksum` (kolejka niskiego priorytetu, concurrency 1) czyta obiekt strumieniem `GetObject` (bez buforowania), liczy sha256 i zapisuje go komendą. Pamięć jest stała, niezależna od rozmiaru pliku. Odczyt idzie z S3 do workera (egress u dostawcy — u OVHcloud bezpłatny, §5.11). Przeglądarka nie liczy sha256 w MVP; ewentualnie w v1 jako dodatkowa kontrola przy uploadzie (O7 zamknięte w §5.12 pkt 7; D124).

**Wyłączone dla plików projektu:** OCR (D108 v2), miniatury i podglądy serwerowe. Wszystkie te ścieżki w OM czytają plik przez `driver.read()` do bufora (§5.9).

### 5.4 Pobieranie i podgląd PDF

- `GET /api/project-delivery/revisions/:id/download` → ACL → **302** na presigned `GetObject` (krótki TTL, parametr) z `response-content-disposition=attachment; filename*=…`. Bajty idą z S3 do przeglądarki.
- Podgląd PDF (MVP): `GET /revisions/:id/preview-url` → presigned `GetObject` z `inline` i `response-content-type=application/pdf`. Przeglądarka otwiera go we własnym czytniku PDF (iframe/nowa karta) — bez nowej zależności. pdf.js tylko jeśli UX tego wymaga (ask-first, Otwarte O8). CORS `GET` + `Range` na buckecie.
- Obsługa nadpisań nagłówków odpowiedzi (`response-content-disposition`, `response-content-type`) w presigned GET: oficjalna dokumentacja żadnego z porównanych dostawców tego nie potwierdza wprost (§5.11; B2 dokumentuje `response-content-type`, ale nie `response-content-disposition`) → do potwierdzenia w PoC u wybranego dostawcy (R8). Fallback bez zależności od tej funkcji: `Content-Disposition` i `Content-Type` ustawiane w metadanych obiektu przy uploadzie (presigned PUT / `CreateMultipartUpload`).
- Typ MIME z zawartości pliku (przy niezgodności z rozszerzeniem wygrywa zawartość); HTML, SVG i XML zawsze jako `attachment` z `X-Content-Type-Options: nosniff`, nigdy inline (D151).
- Trasa `storage_s3` `GET /api/storage-providers/s3/download` (`download.ts` l.54 `driver.read`) **nie jest używana** — buforuje cały obiekt.

### 5.5 Quota per organizacja (D102, D112)

- Quota core `attachments` jest **per tenant** i ma jeden limit z env (`quota-service.ts` l.148–163: suma per `tenant_id`, porównanie z `resolveAttachmentTenantQuotaBytes()`; domyślnie 512 MB, `upload-limits.ts` l.2). Nie pasuje do „quota per organizacja” ani do wariantu A z limitem miękkim (D118). Dlatego moduł ma własny ledger (`pd_upload_sessions` + suma rewizji, §2.2), wzorowany na `attachment_quota_reservations` (rezerwacja przy presign, zatwierdzenie przy complete, zwolnienie przy abort/expiry).
- **Jednostka quota = organizacja (D15, D112), nie tenant.** Limit tenanta `attachments` (env `OM_ATTACHMENT_TENANT_QUOTA_MB` przez `resolveAttachmentTenantQuotaBytes()`) nie dotyczy plików projektów: leżą w osobnym buckecie (R6), poza `attachments`, i nie trafiają do `reconcileTenantS3Objects`. Zużycie tenanta z wieloma organizacjami = suma ledgerów organizacji (tylko raport, bez osobnego limitu w MVP). Quota liczy rewizje do potwierdzonego purge (§5.8), także po soft delete (D126). Quota liczy wszystkie wersje obiektu do potwierdzonego purge (D117); wersje niebieżące (B2, OVHcloud z wersjonowaniem) nie istnieją w normalnym przebiegu, bo klucze są losowe i zapisywane raz; po purge ledger zmniejsza się dopiero po potwierdzeniu, że nie została żadna wersja (§5.12 pkt 3 i 5).
- Sprawdzenie przy rezerwacji (pod advisory lockiem per organizacja): `used + reserved + sizeBytes` względem `storage.quota_bytes` (limit miękki, D118):
  - do 110% limitu → OK. Zużycie ponad 100% jest płatne: dopłata za nadwyżkę rozliczana w okresie rozliczeniowym (D118, D112; stawka `storage.overage_rate`, parametr cennika bez wartości);
  - powyżej 110% limitu (`> 1,1 × storage.quota_bytes`) → **413** `STORAGE_QUOTA_EXCEEDED` z `usedBytes`, `limitBytes`, `requestedBytes`; bez URL, bez obiektu w S3. Odczyt, pobieranie, podgląd i dokumenty-linki działają dalej; nic nie jest usuwane automatycznie.
- **Alerty 80% i 100% (D118):** próg liczony od `used` = suma `size_bytes` rewizji do potwierdzonego purge (zużycie zatwierdzone, bez rezerwacji `reserved`, bo rezerwacja może zostać zwolniona). Sprawdzenie przy każdym zatwierdzeniu zużycia (`uploads.complete`, rewizja z importu, kopia oryginału ZIP) pod tym samym advisory lockiem: dla progu p ∈ {80%, 100%} event `project_delivery.storage.quota_threshold_reached` (ID organizacji i próg) i ostrzeżenie dla administratora organizacji powstają, gdy `used_przed < p × storage.quota_bytes ≤ used_po`. Jedno zatwierdzenie przez oba progi → dwa eventy. Ponowne uzbrojenie: gdy `used` spadnie poniżej progu (tylko po potwierdzonym purge, D122), kolejne przejście w górę daje nowy event. Bez osobnego stanu „alert wysłany”.
- **Dopłata za nadwyżkę (D118):** moduł zapisuje szczytowe `used` organizacji w okresie rozliczeniowym (`pd_storage_usage_periods`: organizacja, okres, `peak_used_bytes`, `quota_bytes`; aktualizacja przy zatwierdzeniu pod tym samym lockiem). Nadwyżka okresu = `max(0, peak_used_bytes − quota_bytes)`; stawka i okres to parametry cennika bez wartości; fakturowanie jest poza modułem. Kopia B2 (v1, D117) nie wchodzi do `used`.
- Wersje obiektów zapisane poza aplikacją wyłapuje rekoncyliacja w sweeperze (`ListObjectVersions`) i liczą się do quota (D153).
- `storage.quota_bytes` nieustawiony (brak wartości z cennika) → upload zablokowany (fail-closed) z 422 `STORAGE_QUOTA_NOT_CONFIGURED` i komunikatem dla administratora. Linki i metadane działają.
- Widok zużycia: ustawienia organizacji (zajęte/limit/rezerwacje, top projekty, nadwyżka bieżącego okresu); oryginały ZIP przetargów (`pd_imports.original_revision_id`, D119) wliczają się do quota bez wyjątków i są pokazane osobno jako pozycja „archiwum dowodowe”.

### 5.6 Import dokumentacji przetargowej — e-Zamówienia i ZIP (D106, D110)

**Proces:** worker `project_delivery:tender-import` na kolejce `project-delivery-import` (`@open-mercato/queue`, concurrency 1). Działa w istniejącym procesie workerów OM, bez nowego kontenera (D115). W forku nie ma osobnego serwisu workera w żadnym compose (`docker-compose.yml`, `docker-compose.fullapp.yml`, `.ghcr`, `.traefik`, `docker-compose.preview.yml`): serwis `app` (`docker-compose.fullapp.yml` l.156) ma `command` `yarn start` (l.184; `Dockerfile` l.438 `CMD yarn start`), `apps/mercato/package.json` l.13 `"start": "yarn mercato server start"`, a `server start` przy domyślnym `OM_AUTO_SPAWN_WORKERS` (`packages/cli/src/lib/auto-spawn-workers.ts` l.11–16: domyślnie `true`) uruchamia proces potomny `node mercato queue worker --all` (`packages/cli/src/mercato.ts` l.2262, l.2354; tryb leniwy l.2320). Worker dzieli więc RAM kontenera aplikacji (`NODE_OPTIONS --max-old-space-size=3072`, `docker-compose.fullapp.yml` l.207). Konfiguracja Dokploy na VPS nie była weryfikowana w tym PR. Start: `POST /api/project-delivery/projects/:id/imports` `{ source: 'ezamowienia' | 'zip_upload' | 'ted', ref }` → **202** `{ progressJobId }` (ProgressJob: `startJob`, `updateProgress`/heartbeat, `completeJob`/`failJob`, anulowanie przez `isCancellationRequested`; zapisy przez `commandBus.execute`; payload z `tenantId`, `organizationId`, `userId` — `packages/core/src/modules/progress/AGENTS.md`).

**Wejście:**
- `ezamowienia`: identyfikator postępowania albo URL (podpowiedź z identyfikatora inwestycji/deala, D6). Pliki publiczne pobierane bez logowania: `GET https://ezamowienia.gov.pl/mp-readmodels/api/Tender/DownloadDocument/{ocds-id}/{ocds-id}_{n}`. Lista dokumentów z read-modelu platformy — endpoint nieudokumentowany (R3). Limit 250 MB dla dokumentów postępowania **nie jest potwierdzony w oficjalnej dokumentacji** (regulamin platformy i instrukcja użytkownika „Postępowania 5.2” nie podają limitu MB dla dokumentów zamówienia; oficjalny wzór UZP https://media.ezamowienia.gov.pl/pod/2023/07/Zapisy-do-SWZ-komunikacja_skladanie_ofert2.pdf podaje 250 MB jako łączny rozmiar plików oferty lub wniosku; odczyt 2026-10-23). 250 MB to rozmiar testowy KA-6 (D120). Większe dokumentacje zamawiający może publikować jako linki zewnętrzne (instrukcja: opcja linku). **Linki zewnętrzne zapisujemy tylko jako `kind = 'link'`** (D106), bez pobierania.
- `zip_upload`: ZIP wgrany przez użytkownika (presigned multipart do `staging/`, §5.3, `purpose = import_staging`).
- `ted`: tylko metadane ogłoszenia i link BT-15 (`procurement-documents`) jako dokument-link (D106). Bez pobierania plików.

**Twarde reguły (D115):** tylko strumieniowo (pobranie → rozpakowanie per wpis → części prosto do S3); bez buforowania całego pliku; bufor **wyłącznie w RAM**, ograniczony do `partSize × queueSize` (`import.part_size_bytes`, `import.queue_size` — parametry bez wartości); na dysku VPS **zero plików tymczasowych** (D110); współbieżność 1 na instancję **tylko dla kolejek `project_delivery`** (import i multipart serwerowy) — pozostałe kolejki obsługiwane przez `queue worker --all` zachowują swoją konfigurację; limity `import.max_file_bytes` (per plik) i `import.max_zip_bytes` (per ZIP) jako parametry bez wartości; `import.timeout_ms` (parametr) — po przekroczeniu job `failed`, abort otwartych multipartów; wznowienie: stan importu (`pd_imports`: przetworzone wpisy, `uploadId` i numery części) pozwala wznowić od ostatniego pełnego wpisu po restarcie procesu, a `ListParts` odtwarza listę wysłanych części; abort multipartu przy anulowaniu, błędzie i timeout, sweeper dla porzuconych. Osobny kontener z limitem pamięci tylko po pomiarze (KA-6).

**Strumień (pamięć ograniczona, bez dysku):**
1. Pobranie pliku z e-Zamówień: `fetch` → `ReadableStream` → `Upload` z `@aws-sdk/lib-storage` (multipart, `partSize` i `queueSize` ograniczone parametrami; pamięć ≈ `partSize × queueSize`) do `staging/{importId}/…`. Bez `Buffer.concat`, bez pliku tymczasowego. Fallback bez nowej zależności: ręczny multipart komendami `client-s3` z tym samym ograniczeniem.
2. Plik nie-ZIP → `CopyObject`/`UploadPartCopy` (po stronie S3, bez transferu przez worker) albo bezpośrednio docelowy klucz → `documents.add_revision` w folderze `00 Przetarg`.
3. ZIP (najpierw w całości w `staging/`, bo katalog centralny jest na końcu pliku — uzasadnienie i alternatywa strumieniowa: §5.12 pkt 1) → oryginał ZIP kopiowany po stronie S3 (`CopyObject`/`UploadPartCopy`) jako niemutowalna rewizja dokumentu w folderze `00 Przetarg` (dowód; liczy się do quota bez wyjątków, w widoku zużycia jako „archiwum dowodowe”; retencja; purge tylko administrator — D119). Przed kopią: rezerwacja quota na rozmiar ZIP; gdy `used + reserved + rozmiar ZIP > 1,1 × storage.quota_bytes` (próg blokady 110%, D118) → import `failed` z powodem `quota`, bez kopii i bez rozpakowania. sha256 oryginału liczy worker importu w locie, zgodnie z D124: dla `ezamowienia` przy pobieraniu do `staging/` (pkt 1), dla `zip_upload` jednym strumieniowym `GetObject` ze `staging/` przed kopią. Rewizja oryginału z identycznym sha256 w `00 Przetarg` już istnieje → kopia pominięta (raport „pominięte: duplikat”, D123), rozpakowanie idzie dalej → czytanie katalogu centralnego i wpisów **zakresami** (`GetObject` z `Range`) przez `yauzl.fromRandomAccessReader` (losowy dostęp bez pobierania całości). Każdy wpis: `openReadStream` → sha256 w locie → `Upload` (multipart) do klucza docelowego → komenda `add_revision` z zachowaniem ścieżki katalogów jako folderów (zagnieżdżone foldery tworzone komendą). Odczyt zakresami, sha256 w locie: D124.
4. Ochrony ZIP (parametry): maksymalna liczba wpisów, maksymalny łączny rozmiar po rozpakowaniu, maksymalny współczynnik kompresji (zip bomb), odrzucenie ścieżek `..`/absolutnych/symlinków, normalizacja nazw (UTF-8 i CP852/CP437 w polskich archiwach), zagnieżdżony ZIP zapisany jako plik (bez rozpakowywania), wpisy szyfrowane pominięte z powodem w raporcie (D139). Niebezpieczna ścieżka → wpis pominięty z powodem `unsafe_path` (D148). Przekroczenie sumy po rozpakowaniu, liczby wpisów albo współczynnika kompresji → import `failed` z powodem `zip_limit_exceeded` i nazwą limitu, bez zapisu dalszych wpisów (D150).
5. Quota: przed każdym wpisem rezerwacja (§5.5). Przekroczenie progu blokady (D118) → wpis pominięty z powodem `quota`, import kończy się statusem `partial`. Brak cichego przekroczenia.
6. Po zakończeniu: usunięcie obiektów `staging/{importId}/` strzeżoną funkcją, na buckecie wersjonowanym ze wszystkimi wersjami (to nie są dokumenty; oryginał ZIP jest już zachowany jako dokument wg pkt 3; zakres usuwania: §5.12 pkt 1, D121, D119), raport w `pd_imports.report`, event `import.completed`. Anulowanie → abort multipartów, sprzątanie stagingu, rewizje już utworzone zostają.
7. Idempotencja: ponowny import tego samego `ref` pomija pliki z identycznym `sha256` w tym samym folderze (raport „pominięte: duplikat”; D123).
8. **Semantyka częściowego importu (bez „wszystko albo nic”):** jednostką atomową jest **wpis** (plik), nie import. Wpis kończy się albo rewizją (komenda `add_revision` po `CompleteMultipartUpload`), albo pominięciem z powodem w raporcie (`quota`, `too_large`, `encrypted`, `unsupported_method`, `duplicate`, `unsafe_path` — D148, `error`), a jego niedokończony multipart jest przerywany (`AbortMultipartUpload`). Status importu: `completed` (wszystkie wpisy przetworzone bez pominięć z błędu), `partial` (część pominięta), `failed` (błąd przed pierwszym wpisem, timeout albo przekroczenie limitów ZIP — `zip_limit_exceeded`, D150), `cancelled`; import z samymi duplikatami → `completed` z licznikiem `skipped_duplicates` (D150). Utworzone rewizje są dokumentami i zostają w każdym statusie; usunąć je może tylko administrator przez purge (D113). Ponowny import uzupełnia brakujące wpisy (idempotencja z pkt 7). Dzięki temu worker nigdy nie potrzebuje `DeleteObject` na kluczach dokumentów (§5.12 pkt 10; D123).

Nowe zależności `@aws-sdk/lib-storage` i `yauzl` = „ask first” (D74, Otwarte O3); decyzja na etapie kodu. Alternatywy bez nowych zależności (sprawdzone w `yarn.lock` @0f0c6aa):
- **Multipart bez `lib-storage`:** komendy `@aws-sdk/client-s3` — `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload` (oraz `ListParts` przy wznowieniu) — i presigned `UploadPart` przez `@aws-sdk/s3-request-presigner`. Oba pakiety już są zależnościami `@open-mercato/storage-s3` (`yarn.lock` l.579 `@aws-sdk/client-s3@^3.1085.0`, l.941 `@aws-sdk/s3-request-presigner@^3.1085.0`, l.9383–9384). Worker sam tnie strumień na części stałego rozmiaru (bufor = jedna część), co daje ten sam limit pamięci co `Upload` z `lib-storage`.
- **Biblioteki ZIP w repo:** brak strumieniowego czytnika ZIP. `jszip` (`yarn.lock` l.26507; zależność `@open-mercato/documents` l.9136 i `mammoth` l.27538) ładuje całe archiwum do pamięci — nie nadaje się (R1). `archiver`/`zip-stream` (przez `testcontainers`, dev; l.35433, l.35456) tylko tworzą ZIP. `yauzl` występuje wyłącznie jako opcjonalny `peerDependency` `@puppeteer/browsers` (l.11178, l.11182) i nie jest zainstalowany. `pako` (przechodnio) daje sam inflate, bez parsera.
- **Rozpakowanie w czystym Node:** możliwe — `zlib.createInflateRaw()` (metoda 8, deflate) i kopiowanie bez zmian (metoda 0) plus własny parser nagłówków ZIP: katalog centralny czytany zakresem (`GetObject` z `Range`) z końca pliku, potem każdy wpis zakresem od lokalnego nagłówka. Ryzyka (R15): ZIP64 (rozmiary i offsety > 4 GiB, rekord i lokator EOCD64), bit 3 „data descriptor” (rozmiary po danych — trzeba brać je z katalogu centralnego), katalog centralny na końcu pliku (EOCD z komentarzem do 64 KiB — szukanie sygnatury od końca), kodowanie nazw (flaga UTF-8 vs CP437/CP852), wpisy szyfrowane i metody inne niż 0/8 (pomijane z powodem). Wymaga testów na archiwach z polskich platform.

### 5.7 Dokument-link (MVP) i dyski zewnętrzne (D105)

- MVP: ręczny link (`kind = 'link'`, `link_provider = 'generic'`), link e-Zamówień/innych platform z importu, link TED. OM nie pobiera treści linku (brak SSRF, brak transferu).
- v1: Google Drive w trybie linku. Wybór pliku przez Google Picker, zapis `fileId` + `webViewLink`, uprawnienia zostają u klienta. Bez kopiowania pliku do S3, bez quota A.
- v2: SharePoint/OneDrive/Nextcloud — ten sam model.

### 5.8 Retencja, archiwum i usuwanie (D113)

- Ustawienie organizacji `retention.policy`: `later_of_both` — późniejsza z dat końca gwarancji i rękojmi (**domyślna podpowiedź**) \| `warranty_end` \| `rekojmia_end` \| `manual`. Do tego `retention.after_action`: `archive` \| `export` (co po terminie; w MVP tylko informacja).
- Projekt: `retention_until` + `retention_basis`. Przy zapisie dat gwarancji/rękojmi UI podpowiada `retention_until` wg polityki. Użytkownik z `project_delivery.projects.manage` może ją zmienić (komenda `set_retention`, audyt z poprzednią i nową datą).
- **Źródło dat w MVP (§5.12 pkt 9):** `warranty_end_date` i `rekojmia_end_date` wpisuje ręcznie użytkownik z `projects.manage` na karcie projektu (z umowy). MVP nie wylicza ich z przepisów ani z encji gwarancji. Bez dat podpowiedź się nie pojawia, a lista pokazuje „retencja nieustalona” (KA-3; D128). Od v2 te pola zasila `pd_warranty_terms` (D108), z zachowaniem ręcznej korekty.
- MVP **nie wykonuje żadnej akcji** po upływie `retention_until`: tylko oznaczenie „po terminie retencji” na liście projektów i raport dla administratora.
- **Usuwanie:**
  - `documents.delete` / `projects.delete` → soft delete metadanych; obiekty S3 zostają i liczą się do quota;
  - fizyczne usunięcie obiektów tylko komendą `storage.purge`: feature `project_delivery.storage.purge` (tylko administrator, nie w `defaultRoleFeatures` pracownika), jawne potwierdzenie (wpisanie kodu projektu), audyt (kto, kiedy, ile obiektów i bajtów, bez nazw plików w payloadzie eventu);
  - **definicja „fizycznego usunięcia po potwierdzeniu administratora”:** po potwierdzeniu worker purge (kolejka modułu, concurrency 1) dla każdego klucza rewizji: (1) `ListObjectVersions` z prefiksem równym kluczowi; (2) `DeleteObject` z `VersionId` dla **każdej** wersji i każdego markera usunięcia/ukrycia; (3) ponowny `ListObjectVersions` — pusty wynik = usunięte fizycznie, wtedy rewizja dostaje `purged_at` i znika z ledgera quota. `DeleteObject` bez `VersionId` nie jest uznawany za usunięcie: na B2 (wersjonowanie zawsze włączone) tylko ukrywa plik, a na OVHcloud z włączonym wersjonowaniem (D117) tylko dodaje marker usunięcia; ukryte wersje dalej zajmują miejsce i są płatne (u OVHcloud każda wersja jak pełny obiekt). Ta sama procedura obejmuje kopię w B2, gdy jest włączona (v1, D117). Wynik niepełny (błąd, Object Lock) → rewizja `purge_failed`, nadal liczona w quota, raport dla administratora. Obsługa `ListObjectVersions` i `DeleteObject` z `VersionId` przez wybranego dostawcę i przez B2 — do potwierdzenia w PoC (R21; D122);
  - **żaden worker, subscriber, sweeper ani reguła cyklu życia bucketu nie usuwa obiektów rewizji** (jedyny wyjątek to worker purge po potwierdzeniu administratora). Sweeper usuwa tylko niedokończone multiparty, `staging/` i obiekty osierocone (§5.12 pkt 4; D121). Wyłączenie modułu (D67) i usunięcie deala nie usuwają plików.
- Archiwum (v2, D113): po `retention_until` administrator może zlecić archiwizację — **eksport** (ZIP strumieniowo do bucketu eksportu albo link) albo **zimna klasa u wybranego dostawcy**. U OVHcloud: Infrequent Access (wszystkie regiony), Active Archive (`eu-west-par`, `eu-south-mil`), Cold Archive (`eu-west-par`) — minimalny okres i opłata za odczyt wg cennika §5.11. Przy fallbacku B2 archiwum = tylko eksport: B2 ma jedną klasę przechowywania, a jego reguły cyklu życia znają tylko ukrywanie, usuwanie wersji i anulowanie niedokończonych dużych plików, bez przejścia do innej klasy (Transition), więc „zimna klasa” jest tam niewykonalna (R10). Auto-archiwizacja bez potwierdzenia = ryzyko prawne (R12), poza MVP.

### 5.9 Weryfikacja `@open-mercato/storage-s3` (plik i linia; `develop_OM_CRM` @0f0c6aa)

| Miejsce | Ustalenie | Wniosek |
|---|---|---|
| `packages/storage-s3/src/modules/storage_s3/lib/s3-driver.ts` l.66–73 | `streamToBuffer` — `Buffer.concat` całego strumienia | buforowanie w RAM |
| `s3-driver.ts` l.188 (`read()`, l.178) | `await streamToBuffer(response.Body)` — **cały obiekt w RAM** | nie używać dla `projectDocs` |
| `s3-driver.ts` l.209–228 (`toLocalPath`) | idzie przez `read()` (bufor) + plik lokalny | nie używać (RAM + dysk VPS) |
| `s3-driver.ts` l.159–176 (`store()`), l.171 | `PutObject` z `Body: payload.buffer` + `IfNoneMatch: '*'` | bufor (D110); nagłówek nieobsługiwany przez fallback B2 (R2) |
| `s3-driver.ts` l.233–246 (`putObject`), l.243 | jw. `IfNoneMatch: '*'` | jw. |
| `s3-driver.ts` l.288–333 (`getSignedUrl`), l.327 | presigned PUT/GET; `IfNoneMatch` tylko przy `createOnly`; domyślnie TTL 3600 s | wzór dla naszego presign (bez `createOnly`) |
| `s3-driver.ts` l.122–128 | `new S3Client` bez `requestChecksumCalculation` | nasz klient ustawia `WHEN_REQUIRED` (R7) |
| `s3-driver.ts` l.5–12 | importy `Put/Get/Delete/ListObjectsV2Command`, `getSignedUrl`; **brak multipart** | multipart po naszej stronie |
| `api/post/storage-providers/s3/signed-url.ts` l.16 | `requireFeatures: ['storage_providers.manage']` | feature administracyjny — nie dla użytkowników projektu |
| `signed-url.ts` l.71–131, l.116 | gałąź upload zwraca URL **aplikacji** `/api/storage-providers/s3/signed-upload/{token}`, nie S3 | to nie jest bezpośredni upload |
| `api/put/storage-providers/s3/signed-upload/[token].ts` l.25–45, l.76, l.118 | `readBoundedBody` buforuje całe ciało żądania, potem `driver.putObject(buffer)` | **upload przechodzi przez RAM aplikacji** — nie używać |
| `api/get/storage-providers/s3/download.ts` l.54 | `driver.read('', key)` | pobranie przez RAM — nie używać |
| `lib/storage-service.ts` l.174 | `driver.read('', key)` | jw. |
| `lib/quota-accounting.ts` l.14, l.23–28 | `listObjects('', 1000, …)` całego prefiksu → `reconcileStandaloneObjects` | osobny bucket/prefiks (R6) |
| `packages/core/src/modules/attachments/lib/drivers/types.ts` | `StorageDriver.store({ buffer })` / `read() → { buffer }` | interfejs in-memory z założenia |
| `packages/core/src/modules/attachments/lib/quota-service.ts` l.146, l.148–159, l.162–163 | advisory lock i suma per **tenant**, jeden limit env | własny ledger per organizacja (§5.5) |
| `packages/core/src/modules/attachments/lib/upload-limits.ts` l.1–2 | 25 MB upload, 512 MB quota tenanta (domyślne) | nie dotyczy `projectDocs` |
| `apps/mercato/src/modules.ts` l.117–118 | `storage_s3` tylko przy `OM_ENABLE_STORAGE_S3=true` (domyślnie wyłączony) | warunek wstępny etapu kodu (zgoda Marka) |
| `storage_s3/lib/endpoint-safety.ts` (l.155 `createSafeS3RequestHandler`, l.172) | ochrona SSRF endpointu | reużyć |

Wniosek: z `storage-s3` bierzemy konfigurację (preset/`credentialsEnvPrefix`), klienta SDK i ochronę endpointu. Nie bierzemy ścieżek `store`/`read`/`signed-upload`/`download`. Zmian w `packages/storage-s3` i `packages/core` nie robimy (D45).

### 5.10 Sprawdzenie Backblaze B2 — fallback (D111)

Źródła: dokumentacja Backblaze „S3-Compatible API” i „Call the S3-Compatible API” (stan na 2026-10-23), „Data Regions”, „Enable CORS with the S3-Compatible API”, zgłoszenia zewnętrzne wskazane przy pozycjach.

| Funkcja | B2 | Skutek |
|---|---|---|
| Presigned URL — upload (PUT) i download (GET), SigV4 | **obsługiwane** (dokumentacja) | ścieżka §5.3/§5.4 zgodna |
| Multipart: `CreateMultipartUpload`, `UploadPart`, `UploadPartCopy`, `CompleteMultipartUpload`, `AbortMultipartUpload`, `ListParts`, `ListMultipartUploads` | **obsługiwane** (dokumentacja); presigned `UploadPart` działa (zgłoszenie dev-rel Backblaze, 2024) | multipart z przeglądarki i w workerze zgodny; PoC potwierdza (R8) |
| Upload POST z formularza (presigned POST) | **nieobsługiwane** | tylko PUT (R8) |
| `If-None-Match` przy `PutObject` | **nieobsługiwane — 501 Not Implemented** (zgłoszenia: Proxmox 2025-07, ZeroFS 2025-09 na `eu-central-003`, 2025-12); dokumentacja nie wymienia warunkowych zapisów | nie wysyłamy; `storage_s3.store()`/`putObject()` (l.171, l.243) na B2 zawiodą (R2) |
| ACL obiektów, tagowanie obiektów (`x-amz-tagging`), role IAM, hosting stron | nieobsługiwane | dostęp tylko przez nasze ACL i presign; brak tagów w modelu |
| Domyślne sumy kontrolne AWS SDK ≥ 3.729 (CRC32) | Backblaze dodał obsługę (2025) | i tak `WHEN_REQUIRED` dla presign przeglądarki (R7) |
| SSE-B2 / SSE-C | obsługiwane | przy fallbacku: SSE-B2 włączone na buckecie (propozycja) |
| Object Lock / legal hold | obsługiwane | kandydat v2 (archiwum, D113) |
| Klasy przechowywania | jedna klasa; reguły cyklu życia bez przejścia klasy (tylko ukrywanie, usuwanie wersji, anulowanie niedokończonych dużych plików; ustawiane w konsoli lub Native API) | przy fallbacku archiwum = tylko eksport (R10) |
| Wersjonowanie | bucket zawsze wersjonowany; usunięcie po samej nazwie zostawia starsze wersje, a pliki ukryte liczą się do przechowywania | purge = usunięcie każdej wersji z `VersionId` (§5.8, R21) |
| CORS (S3 API) | obsługiwane; `MaxAgeSeconds` 0–86400, XML ≤ 100 KB | konfiguracja bucketu §5.1 |
| Region EU Central | Amsterdam (NL), `eu-central-003`; region konta niezmienny | fallback zgodny z wymogiem UE |

### 5.11 Porównanie dostawców S3 w UE i wybór domyślnego (D111)

Źródła: wyłącznie oficjalna dokumentacja i cenniki dostawców, odczyt **2026-10-23**. Stawki przepisane tak, jak są opublikowane (waluta, jednostka, netto). **Bez liczenia kosztów.** „niepotwierdzone” = oficjalna dokumentacja tego nie potwierdza wprost (nie znaczy „nie działa”).

**Kompatybilność** (operacje używane przez `storage-s3`: `PutObject` z `If-None-Match: *`, presigned PUT/GET, `GetObject`, `DeleteObject`, `ListObjectsV2`; oraz multipart speki):

| Funkcja | Cloudflare R2 (jurysdykcja EU) | OVHcloud Object Storage | Hetzner Object Storage | Scaleway Object Storage | Backblaze B2 (EU Central) — porównanie |
|---|---|---|---|---|---|
| `If-None-Match: *` przy `PutObject` | ✅ (atomowo, 412) | ✅ `PutObject` i `CompleteMultipartUpload`, tylko wartość `*` | niepotwierdzone (wyjątek dokumentacji: brak warunkowych PUT/DELETE na bucketach z wersjonowaniem; dla zwykłych — brak wprost) | ✅ `If-None-Match` i `If-Match` | ❌ nieudokumentowane; zgłoszenia zewnętrzne: 501 |
| Presigned PUT / GET | ✅ GET, HEAD, PUT, DELETE (ważność od 1 s do 604 800 s, bez POST) | ✅ GET, PUT, HEAD, DELETE (+ POST) | niepotwierdzone | niepotwierdzone wprost (strona „presigned URL errors” zakłada ich użycie) | ✅ upload i download |
| Multipart: Create / UploadPart / Complete / Abort | ✅ | ✅ | niepotwierdzone wprost („basic compatibility”) | ✅ | ✅ |
| `ListParts` | ✅ | ✅ | niepotwierdzone | ✅ (przewodnik multipart, `list-parts`) | ✅ |
| Presigned `UploadPart` | niepotwierdzone (lista operacji presigned: GET/HEAD/PUT/DELETE) | niepotwierdzone (presigned PUT ✅, `UploadPart` wprost nie) | niepotwierdzone | niepotwierdzone | niepotwierdzone w dokumentacji |
| `response-content-*` w GET | niepotwierdzone | niepotwierdzone | niepotwierdzone | niepotwierdzone | `response-content-type` ✅; `response-content-disposition` niepotwierdzone |
| Region / jurysdykcja w UE | jurysdykcja `eu` (endpoint `<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`; nie do zmiany po utworzeniu bucketu) | GRA, RBX, SBG (FR), DE (Frankfurt), WAW (Warszawa) — 1-AZ; `eu-west-par` (Paryż), `eu-south-mil` (Mediolan) — 3-AZ | FSN1, NBG1 (DE), HEL1 (FI) | PAR, AMS, WAW | `eu-central-003` (Amsterdam) |
| Zimna klasa (archiwum, D113) | Infrequent Access | Infrequent Access; Active Archive; Cold Archive (zależnie od regionu) | brak w dokumentacji | One Zone, Glacier | ❌ brak: jedna klasa, lifecycle bez Transition — archiwum tylko jako eksport |
| Wersjonowanie bucketu | niepotwierdzone | obsługiwane; `If-None-Match` liczony względem bieżącej wersji także przy wersjonowaniu; każda wersja płatna jak pełny obiekt — **włączone w MVP (D117)** | niepotwierdzone | niepotwierdzone (domyślny stan) | zawsze włączone; usunięcie po nazwie ukrywa, wersje zostają i są płatne |
| **W pełni kompatybilny z `storage-s3` (potwierdzone w dokumentacji)** | **tak** | **tak** | **nie (niepotwierdzone)** | **nie (presigned niepotwierdzone wprost)** | **nie (brak `If-None-Match`)** |

Presigned `UploadPart` i `response-content-*` nie są używane przez `storage-s3`. Nie potwierdza ich wprost żaden dostawca, więc spec ich nie wymaga: worker robi multipart przez SDK (§5.6), a dla przeglądarki presigned `UploadPart` i nadpisanie nagłówków sprawdza PoC u wybranego dostawcy. Fallback to presigned PUT do progu multipart i `Content-Disposition` w metadanych (§5.3, §5.4, R8).

Źródła B2 dla wersjonowania i reguł cyklu życia (odczyt 2026-10-23): https://www.backblaze.com/docs/cloud-storage-s3-compatible-api-bucket-versions, https://www.backblaze.com/docs/cloud-storage-lifecycle-rules.

**Cenniki (stawki jak opublikowane, netto):**

| Dostawca | Przechowywanie | Egress | Operacje API | Inne | Cennik |
|---|---|---|---|---|---|
| Cloudflare R2 | Standard $0.015 / GB-miesiąc; Infrequent Access $0.01 / GB-miesiąc | bezpłatny | Class A $4.50 / mln (IA $9.00); Class B $0.36 / mln (IA $0.90); Delete i Abort bez opłat | darmowy próg 10 GB-miesiąc, 1 mln Class A, 10 mln Class B; IA: odczyt $0.01 / GB, minimum 30 dni; stawek osobnych dla jurysdykcji EU cennik nie podaje | https://developers.cloudflare.com/r2/pricing/ |
| OVHcloud (cennik `en-ie`, EUR) | Multi-Zone Standard ~€0.0139941 / GiB-miesiąc (pierwsze 50 TiB); One Zone Standard ~€0.0070956 / GiB-miesiąc; Infrequent Access ~€0.0094973 (Multi-Zone) / ~€0.0040004 (One Zone); Active Archive ~€0.0045041; Cold Archive ~€0.0016644 | bezpłatny („Ingoing/Outgoing external traffic: Free”) | bezpłatne („API Requests: Free”) | odczyt: IA €0.004 / GiB, Active Archive €0.018 / GiB, Cold Archive €0.009 / GiB; minimum 30 / 90 / 180 dni dla klas zimnych | https://www.ovhcloud.com/en-ie/public-cloud/prices/ |
| Hetzner | €6.49 / miesiąc w cenie 1 TB przechowywania i 1 TB egressu; ponad pulę €0.0087 za TB-godzinę (zapis cennika) | ponad pulę €1.00 / TB | bezpłatne (PUT/GET/DELETE) | minimalny rozmiar rozliczeniowy obiektu 64 KB; ruch przychodzący i wewnętrzny bezpłatny | https://www.hetzner.com/storage/object-storage/ |
| Scaleway | Standard Multi-AZ €0.000022 / GB / h (ok. €0.01606 / GB-miesiąc); Standard One Zone €0.000011 / GB / h (ok. €0.00803); Glacier €0.0000035 / GB / h (ok. €0.00254) | 75 GB / miesiąc bezpłatnie, potem €0.01 / GB | wliczone („Request: Included”) | przywrócenie z Glacier €0.009 / GB | https://www.scaleway.com/en/pricing/storage/ |
| Backblaze B2 (porównanie / fallback) | $6.95 / TB-miesiąc, pierwsze 10 GB bezpłatnie | bezpłatny do 3× średniego przechowywania, potem $0.01 / GB | Class A, B, C bezpłatne (pay-as-you-go); Class D $0.004 / 10 000, 2 500 / dzień bezpłatnie | jedna klasa przechowywania | https://www.backblaze.com/cloud-storage/pricing |

Dokumentacja kompatybilności: Cloudflare R2 https://developers.cloudflare.com/r2/api/s3/api/, https://developers.cloudflare.com/r2/api/s3/presigned-urls/, https://developers.cloudflare.com/r2/reference/data-location/ · OVHcloud https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-s3-compliancy, https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-conditional-writes, https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-location · Hetzner https://docs.hetzner.com/storage/object-storage/supported-actions/ · Scaleway https://www.scaleway.com/en/docs/object-storage/api-cli/using-api-call-list/, https://www.scaleway.com/en/docs/object-storage/api-cli/using-conditional-writes/, https://www.scaleway.com/en/docs/object-storage/api-cli/multipart-uploads/ · Backblaze https://www.backblaze.com/docs/cloud-storage-s3-compatible-api, https://www.backblaze.com/apidocs/s3-put-object, https://www.backblaze.com/apidocs/s3-get-object.

**Wybór domyślnego (D111):** w pełni kompatybilni i potwierdzeni w dokumentacji są Cloudflare R2 i OVHcloud. Porównanie „najtańszy” wprost na stawkach nie jest jednoznaczne: różne waluty (USD/EUR) i jednostki (GB/GiB), darmowe progi Cloudflare R2 i Scaleway, stała opłata bazowa Hetznera. Dlatego kryterium:
1. Opublikowane opłaty za operacje API i za egress równe zero.
2. Najniższa opublikowana stawka za przechowywanie w porównywalnej klasie.

Krok 1 spełnia tylko OVHcloud: Cloudflare R2 ma płatne operacje Class A/B, Scaleway ma płatny egress ponad 75 GB, a Hetzner i Scaleway nie przechodzą progu kompatybilności. **Domyślny: OVHcloud Object Storage w regionie UE.** Region i klasa (One Zone vs Multi-Zone, czyli trwałość kontra stawka) to parametr wdrożenia, nie decyzja speki; kopia zapasowa: wersjonowanie bucketu i kopia bazy w MVP, nocna kopia do B2 w v1 (D117, zamyka O14). Źródła wersjonowania OVHcloud (odczyt 2026-10-23): https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-versioning, https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-conditional-writes. Zgodność potwierdza PoC na etapie kodu (KA-7, R22). **Fallback: Backblaze B2 z adapterem.** Gdyby PoC u OVHcloud nie potwierdził `If-None-Match` przy presigned PUT, dostawcą zostaje B2 z adapterem, zgodnie z regułą D111.

---

### 5.12 Rozstrzygnięcia techniczne po niezależnym planie testów (PR C)

Rozstrzygnięcia runnera z rev 3 (wtedy bez nowych D). W rev 5 (odbiór Cezara 2026-10-23) twarde reguły z tej tabeli przeniesiono do rejestru jako samodzielne decyzje D121–D130 (numery w kolumnie „Gdzie”); pkt 3 i 6 doprecyzowały D117 i D116. Przy rozbieżności obowiązuje rejestr.

| # | Pytanie z PR C | Rozstrzygnięcie | Gdzie |
|---|---|---|---|
| 1 | Surowy ZIP w S3 czytany zakresami — kto go usuwa, skoro worker nie woła `DeleteObject`? | Zakaz z D113 dotyczy **obiektów dokumentów** (kluczy rewizji), nie wszystkich obiektów. Surowy ZIP leży pod osobnym prefiksem `staging/{importId}/`, poza prefiksem dokumentów (`{prefix}/org_…/proj_…`), i nie jest dokumentem. Worker importu usuwa go po zakończeniu, anulowaniu albo `failed`, a sweeper usuwa staging porzuconych importów. `DeleteObject` przechodzi przez jedną funkcję z twardym strażnikiem: klucz musi zaczynać się od `staging/` i należeć do importu tej organizacji, inaczej wyjątek (test w PR C). Zapas: reguła cyklu życia wygaszająca tylko `staging/` (u B2 przez konsolę, `daysFromUploadingToHiding` + `daysFromHidingToDeleting`). Staging jest potrzebny, bo katalog centralny jest na końcu pliku. Alternatywa bez stagingu, czyli czytanie strumieniem po lokalnych nagłówkach, jest odrzucona dla MVP: przy bicie 3 (data descriptor) rozmiar wpisu jest znany dopiero po danych, przy ZIP64 rozmiary są w polu rozszerzonym, a lokalne nagłówki mogą się różnić od katalogu centralnego. | §5.6 pkt 3 i 6, §5.1, R20; D121, D124 |
| 2 | B2 nie ma klas przechowywania (lifecycle bez Transition) | „Zimna klasa” na B2 jest niewykonalna; przy fallbacku archiwum = tylko eksport. Tabela §5.10/§5.11 i R10 to mówią wprost. | §5.8, §5.10, §5.11, R10 |
| 3 | B2 wersjonuje, `DeleteObject` tylko ukrywa — co to „fizyczne usunięcie”, czy quota liczy ukryte wersje? | Fizyczne usunięcie = usunięcie każdej wersji (z `VersionId`) i każdego markera, potwierdzone pustym `ListObjectVersions`. Dopiero wtedy rewizja wychodzi z quota. Quota liczy rewizję do potwierdzonego purge, czyli także czas, w którym u dostawcy byłaby wersją ukrytą. Innych ukrytych wersji nie ma, bo klucze są losowe i zapisywane raz. OVHcloud ma wersjonowanie włączone (D117), więc procedura obowiązuje tak samo jak na B2. | §5.8, §5.5, §5.10, R21; D122, D117 |
| 4 | Obiekty osierocone (przerwany upload) bez `DeleteObject` | `AbortMultipartUpload` (sweeper i jawne `abort`) jest dozwolony: nie usuwa żadnego obiektu, a jedynie niedokończone części, więc nie jest usunięciem dokumentu. Reguła cyklu życia dla niedokończonych multipartów jest dozwolona jako zapas (§5.1). **Obiekt osierocony** to obiekt z zakończonym `PUT`/`Complete`, dla którego sesja nie doszła do `complete`, więc nie ma rewizji. Nie jest dokumentem i sweeper może go usunąć `DeleteObject` tylko wtedy, gdy: sesja jest `expired` (przejście ze stanu `reserved` pod advisory lockiem; `complete` wymaga `reserved`, więc później już się nie uda), żadna rewizja nie wskazuje tego klucza (sprawdzenie w tej samej transakcji) i klucz pasuje do `storage_key` sesji. Każde takie usunięcie trafia do logu sweepera. Obiekt z `UPLOAD_SIZE_MISMATCH` jest traktowany tak samo. | §5.3 pkt 4, §2.2, R20; D121, D125, D129 |
| 5 | Quota `attachments` per tenant vs D112 per organizacja | Jednostka = organizacja (D15, D112), własny ledger. `OM_ATTACHMENT_TENANT_QUOTA_MB` nie dotyczy plików projektów (osobny bucket, R6). Zużycie tenanta = suma organizacji, tylko raport. | §5.5, KA-1 pkt 7; D126 |
| 6 | Unikalny klucz projektu przy pustej inwestycji (NULL) | O1 zamknięte przez D116: projekt może nie mieć oferty ani inwestycji, więc kolumny są nullable. Unikalność: jeden projekt na wygrany deal i jeden na inwestycję (partial unique, tylko `investment_id` NOT NULL — projekt bez oferty poza tym indeksem), bez `NULLS NOT DISTINCT`; bez indeksu per wersja oferty. | §2.2 `pd_projects`; D116, D132 |
| 7 | Kto liczy sha256, skoro plik nie przechodzi przez aplikację? | Worker `checksum` strumieniem `GetObject` po `complete` (pamięć stała). Przy imporcie liczy go w locie worker importu. Przeglądarka nie liczy w MVP. Zamyka O7. | §5.3 pkt 5, §2.2; D124 |
| 8 | Trasa `signed-url` w `storage_s3` wymaga `storage_providers.manage` | Moduł ma własne trasy z własnymi feature'ami (`documents.upload`, `view` + ACL folderu) i sam podpisuje URL. Trasa `storage_s3` nie jest używana. | §5.3, §5.9, §6, §7; D127 |
| 9 | Podpowiedź retencji w MVP, encja gwarancji dopiero w v2 | W MVP daty końca gwarancji i rękojmi wpisuje ręcznie użytkownik z `projects.manage`. Bez dat nie ma podpowiedzi („retencja nieustalona”). Od v2 dane z `pd_warranty_terms`. | §2.2, §5.8, KA-3; D128 |
| 10 | „Wszystko albo nic” wymagałoby usuwania przez worker | Brak „wszystko albo nic”: wpis jest atomowy, import może skończyć się `partial`, utworzone rewizje zostają, a niedokończone części są przerywane. | §5.6 pkt 8, KA-1 pkt 5; D123 |
| 11 | Poświadczenia bucketu klienta a „bez sekretów” | Reguła „bez sekretów” dotyczy repozytorium, specyfikacji, env w repo, logów, eventów i payloadów audytu. Poświadczenia bucketu klienta (v2): w bazie wyłącznie zaszyfrowane mechanizmem szyfrowania danych OM, poza `module_configs`, nigdy jawnie, w repo, logach ani eventach; w API tylko maska; mechanizm wybierany w v2 (O10, D130). Konkretny mechanizm OM (np. serwis poświadczeń, jeśli istnieje; w tym PR niepotwierdzone) wybierzemy na etapie v2. Nasz bucket (wariant A) używa wyłącznie zmiennych środowiskowych wdrożenia (`credentialsEnvPrefix`), poza repo. | O10, R13; D130 |
| 12 | Linki udostępniania „propozycja” w rejestrze vs O9 | Ujednolicone: linki udostępniania to **v1**. Lista MVP w D106 ich nie zawiera, a D104 nie ustala fazy, więc v1 wynika z D106. O9 zamknięte, „propozycja” usunięta z D104 i ze speki. | D104, §6, §11 v1, §13 |

B2 nie obsługuje presigned POST, dlatego upload idzie wyłącznie przez PUT (§5.3, R8).

## 6. Uprawnienia (ACL) (D104)

Feature'y w `acl.ts`, granty w `setup.ts` (`defaultRoleFeatures`). Role OM: superadmin/admin/employee — nie tworzymy ról manager/sales.

| Feature | admin | employee | Opis |
|---|---|---|---|
| `project_delivery.view` | ✅ | ✅ | dostęp do modułu (projekty, w których jest członkiem) |
| `project_delivery.projects.view_all` | ✅ | — | wszystkie projekty organizacji, bez członkostwa |
| `project_delivery.projects.create` | ✅ | ✅ | komenda „wygrany przetarg → realizacja” |
| `project_delivery.projects.manage` | ✅ | — | edycja projektu, członków, retencji, zamknięcie; kierownik projektu dostaje to w obrębie projektu przez rolę `manager` |
| `project_delivery.documents.upload` | ✅ | ✅ | upload, linki, nowe rewizje (w folderach z prawem `write`) |
| `project_delivery.documents.approve` | ✅ | — | MVP: ręczne zatwierdzenie rewizji (D103) |
| `project_delivery.documents.delete` | ✅ | — | soft delete metadanych (D136) |
| `project_delivery.imports.run` | ✅ | ✅ | import e-Zamówień/ZIP/TED |
| `project_delivery.templates.manage` | ✅ | — | szablony per segment |
| `project_delivery.settings.manage` | ✅ | — | wariant storage, quota, retencja (§8) |
| `project_delivery.storage.purge` | ✅ | — | **fizyczne usunięcie plików** (D113); poza `defaultRoleFeatures` pracownika |
| `project_delivery.share_links.manage` (v1) | ✅ | — | linki udostępniania |
| `project_delivery.approvals.review` (v1) | ✅ | ✅ | udział w ścieżce akceptacji jako recenzent |

Efektywny dostęp do dokumentu = feature modułu **i** (członkostwo w projekcie albo `view_all`) **i** ACL folderu (`inherit`: z roli w projekcie — `viewer` → read, `member` → write, `manager` → manage; `restricted`: tylko wpisy `pd_folder_acl`). Sprawdzanie po stronie serwera w każdym endpoincie i przy wydaniu presigned URL. Presigned URL jest krótki i wydawany per żądanie, nigdy zapisywany. Macierz feature'ów i granty: D137 (brak feature'a → 403). Brak dostępu w ACL do istniejącego zasobu → 404 jak dla zasobu nieistniejącego, bez ujawniania istnienia; po odebraniu dostępu nowy URL nie jest wydawany (D147).

Linki udostępniania (v1, D104): token losowy (w bazie tylko hash), **obowiązkowe `expires_at`** (brak → 422 `SHARE_LINK_EXPIRY_REQUIRED`; maksimum z ustawień, parametr), odwołanie (`revoked_at`), licznik pobrań. Endpoint publiczny tokenu zwraca 302 na krótki presigned GET. Dostęp tylko do wskazanego celu, bez listowania folderów nadrzędnych (D142). Data w przeszłości → 422 `SHARE_LINK_EXPIRY_IN_PAST`, powyżej maksimum → 422 `SHARE_LINK_EXPIRY_TOO_LONG`; link wygasły → 410 `SHARE_LINK_EXPIRED`, odwołany → 410 `SHARE_LINK_REVOKED`, nieznany token → 404; link do dokumentu wskazuje rewizję aktualną w chwili pobrania; link do folderu respektuje ACL podfolderów i nie rozszerza dostępu (D152).

Widoczność danych oferty: projekt pokazuje tylko pola niewrażliwe (numer, wersja, waluta, struktura). Koszt i marża nie trafiają do `pd_*`, indeksu, eventów ani audytu (checklista p3). Wartości billing % (v1) liczone z cen sprzedaży ze snapshotu, widoczne dla `project_delivery.projects.manage`.

---

## 7. API

Prefiks `/api/project-delivery/`. Każda trasa: guard `isDeliveryEnabled` (→ 404 `MODULE_DISABLED`), `openApi`, zod, CRUD przez `makeCrudRoute` + indexer, zapisy przez komendy, optimistic locking.

```
POST      /projects/from-won-deal                     (D116, §3; D99 — zastąpiona przez D116)
POST      /projects/:id/winning-offer                 (podpięcie kalkulacji, D116, §3)
GET/PATCH /projects, /projects/:id                    (lista, szczegóły, edycja)
POST      /projects/:id/close | /projects/:id/retention
GET/POST  /projects/:id/stages | /tasks | /milestones
POST      /milestones/:id/reach | /milestones/:id/calc-links
GET       /projects/:id/offer-structure               (listStructure przez DI; bez kwot)
GET       /projects/:id/execution-schedule            (v1; registry; 200 { available, scheduleId?, phase? })
POST      /projects/:id/execution-schedule/ensure     (v1; idempotentne)
GET/POST  /projects/:id/folders | PATCH /folders/:id | PUT /folders/:id/acl
GET/POST  /projects/:id/documents | PATCH/DELETE /documents/:id
POST      /documents/:id/links                        (dokument-link)
GET       /documents/:id/revisions
POST      /revisions/:id/approve                      (MVP ręcznie; v1 przez ścieżkę akceptacji)
GET       /revisions/:id/download                     (302 → presigned GET)
GET       /revisions/:id/preview-url
POST      /uploads | /uploads/:id/parts | /uploads/:id/complete | /uploads/:id/abort
POST      /projects/:id/imports                       (202 { progressJobId })
GET       /imports/:id
GET/PUT   /settings                                   (§8; settings.manage)
GET       /storage/usage
POST      /storage/purge                              (admin; potwierdzenie; §5.8)
GET/POST  /templates                                  (templates.manage)
— v1: /share-links, /share/:token (publiczny, 302), /transmittals, /correspondence, /protocols, /approval-tiers
```

Kody błędów (propozycje, do review): `MODULE_DISABLED`, `DEAL_NOT_WON`, `OFFER_NOT_PRIMARY`, `SEGMENT_REQUIRED` (422), `PROJECT_EXISTS` (409, per deal i per inwestycja), `PROJECT_PHASE_EXISTS` (409, schedule), `OFFER_ALREADY_LINKED` (409), `REVISION_IMMUTABLE` (409), `NEWER_REVISION_RELEASED` (409), `STORAGE_NOT_CONFIGURED`, `STORAGE_QUOTA_NOT_CONFIGURED`, `STORAGE_QUOTA_EXCEEDED` (413), `STORAGE_VARIANT_NOT_AVAILABLE`, `UPLOAD_SIZE_MISMATCH`, `FILE_TOO_LARGE` (413), `PURGE_CONFIRMATION_REQUIRED`, `SHARE_LINK_EXPIRY_REQUIRED` (v1), `UPLOAD_SESSION_EXPIRED` (409, D149), `FIELD_NOT_ALLOWED` (422, D144, D146), `SHARE_LINK_EXPIRY_IN_PAST` i `SHARE_LINK_EXPIRY_TOO_LONG` (422, v1, D152), `SHARE_LINK_EXPIRED` i `SHARE_LINK_REVOKED` (410, v1, D152), `APPROVAL_LEVEL_OUT_OF_ORDER` i `TRANSMITTAL_SENT` (409, v1, D155), `REJECTION_COMMENT_REQUIRED` (422, v1, D156), `APPROVAL_PENDING` (409, v1, D157). Brak dostępu w ACL → 404 (D147); presigned POST → 404, trasy nie ma (D145). Import ZIP: powody w raporcie, nie kody HTTP — `unsafe_path` (D148), `zip_limit_exceeded` (D150).

---

## 8. Ustawienia organizacji (ModuleConfigService, `org:{id}:settings`, D69)

| Klucz | Typ | Domyślnie | Uwagi |
|---|---|---|---|
| `delivery.enabled` | bool | `false` | włącznik per organizacja (§0.6) |
| `storage.variant` | `'A' \| 'B'` | `'A'` | MVP przyjmuje tylko `A` (D112) |
| `storage.b_target` | `'gdrive' \| 'client_bucket' \| 'sharepoint' \| 'onedrive' \| 'nextcloud'` | — | v1/v2 |
| `storage.quota_bytes` | int | **brak wartości** (cennik) | limit miękki: ostrzeżenia 80% i 100%, blokada powyżej 110% (D118); brak → upload zablokowany (§5.5) |
| `storage.overage_rate` | decimal | **brak wartości** (cennik) | stawka dopłaty za nadwyżkę ponad 100% w okresie rozliczeniowym (D118) |
| `storage.backup_copy` | bool | **brak wartości** (plan) | v1: nocna kopia obiektów do B2 (D117); nie liczy się do quota klienta |
| `docs.max_file_bytes`, `docs.multipart_threshold_bytes`, `docs.multipart_part_bytes` | int | parametry techniczne (env/instancja) | bez wartości w specu |
| `docs.presign_ttl_seconds` | int | parametr | krótki TTL |
| `import.zip_max_entries`, `import.zip_max_uncompressed_bytes`, `import.zip_max_ratio` | int | parametry | ochrona ZIP |
| `retention.policy` | enum | `later_of_both` | podpowiedź (D113) |
| `retention.after_action` | `'archive' \| 'export'` | `'export'` | MVP tylko informacja |
| `share_links.max_expiry_seconds` | int | parametr | v1 |

Ustawienia nie dublują RBAC (checklista p4). Brak sekretów w ustawieniach (próba zapisu pola wyglądającego na klucz → 422, D130). Poświadczenia bucketu klienta (v2): w bazie wyłącznie zaszyfrowane mechanizmem szyfrowania danych OM, poza `module_configs`, nigdy jawnie, w repo, logach ani eventach; w API tylko maska; mechanizm wybierany w v2 (O10, D130).

---

## 9. Akceptacje v1 — silnik (D107, D114)

**Decyzja (D114, odbiór Cezara 2026-10-23): własna walidacja progów w `project_delivery`** (`pd_approval_tiers`, `pd_approval_reviews`; wzór OCA `base_tier_validation` z analizy Odoo) za interfejsem `ApprovalEngine`. Moduł `workflows` OM wchodzi w v2 jako kolejna implementacja `ApprovalEngine`, zgodnie z D93.

Model: poziom = (typ obiektu: `revision` | `transmittal` | `protocol`, kolejność, warunek: folder/dyscyplina/typ dokumentu, recenzent: użytkownik albo rola projektu, `required`). Przejście `draft → in_review → approved/rejected` przez komendy. Każda decyzja recenzenta to komenda z powodem w metadanych (audyt `audit_logs`, bez własnej tabeli audytu poza stanem recenzji). Ostatni poziom zatwierdza → `approve_revision` (D103).

Reguły v1: decyzja na poziomie przed rozstrzygnięciem poziomów o niższej kolejności → 409 `APPROVAL_LEVEL_OUT_OF_ORDER` (D155); komentarz obowiązkowy tylko przy odrzuceniu (422 `REJECTION_COMMENT_REQUIRED`), przy akceptacji opcjonalny (D156); brak akceptacji blokuje wysłanie transmittala z dokumentami z wymaganą akceptacją (409 `APPROVAL_PENDING` z listą oczekujących dokumentów), a nie blokuje zamknięcia protokołu, który pokazuje listę dokumentów bez akceptacji (D157).

Uzasadnienie:
1. **Spójność z D93:** `workflows` nie jest włączony w forku, a decyzja dla costingu już odkłada go do v2. Włączenie go tylko dla dokumentów oznaczałoby nowy moduł z wieloma tabelami, silnik i UI do utrzymania.
2. **Potrzeba jest liniowa:** akceptacje dokumentów budowlanych to sekwencja poziomów (sprawdzający → kierownik → klient). Nie ma rozgałęzień, timerów ani pętli, do których potrzebny jest silnik workflow.
3. **Audyt i undo z OM:** komendy dają `audit_logs` i undo bez dodatkowego mechanizmu, zgodnie z checklistą p6.
4. **Ścieżka migracji:** interfejs `ApprovalEngine` (DI w `project_delivery`) z jedną implementacją `TierApprovalEngine`. W v2, jeśli `workflows` wejdzie dla costingu (D93), można dodać `WorkflowsApprovalEngine` bez zmiany modelu rewizji.

Ryzyko: dublowanie funkcji z `workflows` w v2 (R14).

---

## 10. Kryteria akceptacji

Kryteria są wymaganiem speki. Przypadki testowe pisze plan testów (PR C), bez numerów TC w tej specyfikacji.

### KA-1 — przekroczenie quota (D102, D112, D118, D126)
1. Gdy `used + reserved + sizeBytes > 1,1 × storage.quota_bytes` (powyżej 110% limitu, D118), `POST /uploads` zwraca 413 `STORAGE_QUOTA_EXCEEDED` z `usedBytes`, `limitBytes` i `requestedBytes`. Nie powstaje URL, sesja ani obiekt w S3. UI pokazuje komunikat z zajętością i informacją dla administratora.
2. Do 110% limitu upload przechodzi. Przy przejściu `used` (zużycie zatwierdzone, bez rezerwacji) przez 80% i przez 100% powstaje dokładnie jeden event `project_delivery.storage.quota_threshold_reached` (ID organizacji i próg) i powiadomienie administratora organizacji; po spadku `used` poniżej progu (purge) kolejne przejście daje nowy event (D118). Zużycie ponad 100% trafia do nadwyżki okresu rozliczeniowego (`pd_storage_usage_periods`). Odczyt, pobieranie i podgląd działają także powyżej 110%; nic nie jest usuwane automatycznie.
3. Dwie równoległe rezerwacje, które razem przekraczają próg blokady (110%): przechodzi najwyżej tyle, ile mieści próg (advisory lock per organizacja). Nigdy nie dochodzi do cichego przekroczenia.
4. Abort, wygaśnięcie sesji i `UPLOAD_SIZE_MISMATCH` zwalniają rezerwację. Zużycie po operacji jest równe zużyciu przed nią.
5. Import ZIP przy braku miejsca pomija wpisy ponad próg blokady (110%, D118) z powodem `quota` w raporcie i kończy się statusem `partial`. Rewizje utworzone przed przekroczeniem zostają.
6. Brak `storage.quota_bytes` → 422 `STORAGE_QUOTA_NOT_CONFIGURED`. Linki i metadane działają.
7. Quota liczona per **organizacja**. Pliki projektów nie wpływają na quota `attachments` tenanta.

### KA-2 — wybór wariantu A albo B (D112)
1. Wariant zmienia tylko użytkownik z `project_delivery.settings.manage`. Inni dostają 403.
2. MVP: zapis `storage.variant = 'B'` → 422 `STORAGE_VARIANT_NOT_AVAILABLE`, bez zmiany ustawień. UI pokazuje B jako niedostępny z fazą.
3. v1: `B` + `gdrive` → nowe dokumenty-pliki dodawane jako linki Google Drive, bez obiektów w S3 i bez zużycia quota A. v2: bucket klienta i pozostałe dyski.
4. Zmiana wariantu nie przenosi i nie usuwa istniejących plików. Pliki w A pozostają dostępne i liczone w quota. Każda zmiana jest w audycie (poprzednia/nowa wartość).
5. Ustawienia nie zawierają sekretów. Próba zapisu pola wyglądającego na klucz → 422.

### KA-3 — retencja i data na projekcie (D113)
1. Organizacja ma ustawienie `retention.policy` z domyślną podpowiedzią `later_of_both` (późniejsza z dat końca gwarancji i rękojmi).
2. Po wpisaniu `warranty_end_date`/`rekojmia_end_date` UI proponuje `retention_until` wg polityki. Zapis wymaga akcji użytkownika z `projects.manage` (brak cichego ustawiania). `retention_basis` odpowiada wybranej podstawie albo `manual` po ręcznej zmianie.
3. Zmiana `retention_until` to komenda z audytem (poprzednia i nowa data, użytkownik) i undo.
4. Po upływie `retention_until` projekt jest oznaczony „po terminie retencji” na liście i w raporcie administratora. **Nie zachodzi żadna zmiana danych ani plików.**
5. Projekt bez dat gwarancji i rękojmi może nie mieć `retention_until`. Lista pokazuje „retencja nieustalona”.
6. W MVP daty gwarancji i rękojmi pochodzą wyłącznie z ręcznego wpisu na projekcie; moduł ich nie wylicza (§5.8).

### KA-4 — brak usunięcia bez administratora (D113, D121, D122, D129)
1. Soft delete dokumentu, folderu albo projektu nie usuwa obiektów S3. Obiekty pozostają i są liczone w quota.
2. Fizyczne usunięcie jest możliwe wyłącznie przez `POST /storage/purge` z feature `project_delivery.storage.purge` i jawnym potwierdzeniem (kod projektu). Bez potwierdzenia → 422 `PURGE_CONFIRMATION_REQUIRED`. Bez feature → 403.
3. Żaden worker, subscriber, sweeper ani job nie wywołuje `DeleteObject` na kluczach rewizji (wyjątek: worker purge po potwierdzeniu administratora). Sweeper usuwa tylko niedokończone multiparty, `staging/` i obiekty osierocone (§5.12 pkt 4; D121). Test sprawdza listę wywołań S3 w workerach.
4. Wyłączenie modułu w organizacji (D67), usunięcie deala, ponowne otwarcie deala i upływ retencji nie usuwają plików.
5. Purge zapisuje audyt (kto, kiedy, projekt, liczba obiektów, bajty) i event `project_delivery.storage.purged` z samymi ID.
6. Konfiguracja bucketu nie ma reguły cyklu życia usuwającej obiekty dokumentów ani zmieniającej ich klasę (checklista wdrożenia).
7. Purge usuwa każdą wersję klucza z `VersionId`; rewizja wychodzi z quota dopiero po pustym `ListObjectVersions`. Częściowe usunięcie → `purge_failed` i dalej w quota (§5.8, D122). Dotyczy B2 i OVHcloud z włączonym wersjonowaniem (D117), a w v1 także kopii w B2.
8. `DeleteObject` w workerach i sweeperze przyjmuje wyłącznie klucze `staging/` albo klucze osieroconych sesji `expired` bez rewizji (§5.12 pkt 1 i 4, D121); na buckecie wersjonowanym usuwa wszystkie wersje tych kluczy. Próba na kluczu rewizji → wyjątek (test).

### KA-5 — pamięć i VPS (D110, D115)
1. Upload i pobranie pliku dowolnego rozmiaru nie przesyłają bajtów pliku przez proces aplikacji. Serwer obsługuje tylko JSON i przekierowania.
2. Import dużego pliku i dużego ZIP nie powoduje wzrostu pamięci procesu workera proporcjonalnego do rozmiaru pliku. Bufor danych pliku jest wyłącznie w RAM i ograniczony do `partSize × queueSize` (okno dekompresji ma stały rozmiar, niezależny od pliku). Na dysku VPS nie powstaje żaden plik tymczasowy (sprawdzenie katalogów tymczasowych kontenera przed importem i po nim).
3. Kolejki importu i multipartu `project_delivery` mają współbieżność 1 na instancję (inne kolejki bez zmian). Import przerywa się po `import.timeout_ms` z abortem otwartych multipartów i daje się wznowić po restarcie procesu bez ponownego wysyłania pełnych wpisów (D115).

### KA-6 — pomiar RAM workera na wersji testowej (D115, D120, etap kodu)
1. Na wersji testowej (ta sama konfiguracja kontenera `app` co na produkcji) wykonuje się import dużego pliku i ZIP 250 MB (D120). Mierzy się szczytowe RSS procesu `queue worker` i całego kontenera `app` oraz użycie swapu hosta przed importem i w trakcie.
2. Progi (D120): szczytowy przyrost RSS procesu workera względem stanu przed importem ≤ 256 MB (`measure.worker_rss_peak_delta_bytes`); `MemAvailable` hosta ≥ 300 MB przez cały pomiar (`measure.host_min_free_bytes`); zero zabić OOM i zero restartów kontenera `app` i procesu workera; przyrost użycia swapu hosta ≤ 512 MB (`measure.host_swap_growth_bytes`). Przekroczenie dowolnego progu = werdykt FAIL (presja RAM).
3. Wynik pomiaru (wszystkie parametry, progi i werdykt) jest zapisany w PR etapu kodu. Osobny kontener workera z limitem pamięci jest dodawany **tylko wtedy**, gdy werdykt to FAIL (D120, D115).
4. Bez takiego pomiaru nie zmienia się topologii kontenerów (D115).

### KA-7 — PoC zgodności dostawcy S3 (D111, etap kodu, R22)
1. Przed kodem modułu PoC u OVHcloud (bucket testowy w regionie UE) potwierdza: warunkowy `PutObject` z `If-None-Match: *` (drugi zapis → 412), presigned PUT i presigned GET (w tym `response-content-disposition`), multipart (`Create`/`UploadPart`/`Complete`/`Abort`) i jego wznowienie (`ListParts` po przerwaniu, dokończenie bez ponownego wysyłania części).
2. Wynik (operacja → wynik) jest zapisany w PR etapu kodu i jest kryterium akceptacji etapu kodu.
3. Jeśli którakolwiek operacja nie przejdzie, domyślnym dostawcą zostaje B2 z adapterem (D111, §5.10), a PoC powtarza się dla B2.
4. PoC wykonuje się na buckecie z **włączonym wersjonowaniem** (D117): warunkowy `PutObject` z `If-None-Match: *` na istniejącym kluczu → 412; `ListObjectVersions` + `DeleteObject` z `VersionId` usuwa każdą wersję i marker, a ponowny `ListObjectVersions` jest pusty (D121, D122).

---

## 11. Fazy (MVP / v1 / v2) — zakres funkcji i encji (bez estymat, P11)

### MVP (D106)
- Komenda „wygrany przetarg → realizacja” (D116; także deal bez kalkulacji, podpięcie oferty później), szablony per segment (seed `prefab`).
- Etapy, zadania (lista, bez Gantta), kamienie milowe z linkami do sekcji i pozycji oferty (D101).
- Członkowie projektu, foldery z ACL (D104).
- Dokumenty-pliki z niemutowalnymi rewizjami na S3 w UE (domyślny dostawca wg D111), ręczne zatwierdzenie i „wydana” rewizja (D103).
- Upload presigned + multipart, pobranie i podgląd PDF przez presigned GET (D110).
- Dokumenty-linki (ręczne).
- Import e-Zamówień (pliki publiczne; linki zewnętrzne tylko jako link) i ZIP z uploadu. TED: metadane i link BT-15.
- Quota per organizacja (wariant A) jako limit miękki: ostrzeżenia 80% i 100%, dopłata za nadwyżkę ponad 100% w okresie rozliczeniowym, blokada nowych plików powyżej 110% (D118); wersjonowanie bucketu OVHcloud i kopia bazy (D117); oryginał ZIP przetargu jako dokument (D119); ustawienia wariantu (tylko A), retencja: ustawienie + data na projekcie (D112, D113), purge tylko administrator.
- Encje: `pd_projects`, `pd_project_templates`, `pd_project_template_items`, `pd_project_stages`, `pd_tasks`, `pd_milestones`, `pd_milestone_calc_links`, `pd_project_members`, `pd_folders`, `pd_folder_acl`, `pd_documents`, `pd_document_revisions`, `pd_upload_sessions`, `pd_imports`, `pd_document_sequences`.

### v1 (D107)
- Rejestr rysunków (numer, dyscyplina, rewizje, status wydania).
- Akceptacje (§9), transmittale, korespondencja/RFI, protokoły odbioru z usterkami.
- Linki udostępniania z obowiązkową datą wygaśnięcia (D104).
- Google Drive w trybie linku (D105, wariant B).
- Nocna kopia obiektów do B2 (`storage.backup_copy`, D117), poza quota klienta.
- Billing % kamieni i odbiory częściowe (D101).
- Link/uruchomienie harmonogramu wykonawczego przez `executionScheduleRegistry` (D100), gdy schedule jest używany; jedna faza projektu w harmonogramie inwestycji, flaga D72 na fazie (D131).
- Encje: `pd_approval_tiers`, `pd_approval_reviews`, `pd_share_links`, `pd_transmittals`, `pd_transmittal_items`, `pd_correspondence`, `pd_protocols`, `pd_protocol_defects`, `pd_external_drive_links`.

### v2 (D108)
- Gwarancja/rękojmia (`pd_warranty_terms`), dokumenty jakości przypięte do partii produkcji.
- SharePoint/OneDrive/Nextcloud (link), bucket klienta (wariant B).
- OCR (worker strumieniowy, poza RAM aplikacji), podgląd DWG, podpis kwalifikowany.
- Archiwizacja po retencji za potwierdzeniem administratora (R12). Ocena `workflows` jako silnika akceptacji (D93).
- Encje: `pd_warranty_terms`, `pd_quality_documents`, `pd_storage_targets`.

### Narzut OM (wymagania, bez estymaty)
Migracje i snapshot, zod per encja, komendy z undo i `audit_logs`, `makeCrudRoute` + `openApi` + indexer, granty w `setup.ts`, i18n pl/en, `CrudForm`/`DataTable`, testy integracyjne każdej trasy API w tej samej zmianie (Playwright w `__integration__`), Jest w `__tests__`, test odsprzęgnięcia modułów (wzór `module-decoupling.test.ts`): costing działa bez delivery, a delivery bez schedule.

### Zakres zbiorczy (trzy moduły)

| Moduł | MVP | v1 | v2 |
|---|---|---|---|
| `project_costing` | costing §14 MVP | costing §14 v1 | costing §14 v2 |
| `project_schedule` | — (moduł nie wchodzi do MVP) | schedule §12 v1 | schedule §12 v2 |
| `project_delivery` | §11 MVP (bez harmonogramu) | §11 v1 (+ link/uruchomienie harmonogramu) | §11 v2 |

Tabela identyczna jak w costing §14 i schedule §13.

---

## 12. Risks (Ryzyka — z ryzykiem rezydualnym)

| # | Ryzyko | Mitygacja | Ryzyko rezydualne |
|---|---|---|---|
| R1 | **Pamięć i dysk VPS (stan na 23.10: RAM 3,8 GB, ok. 0,9 GB dostępne, swap ok. 2,3 GB w użyciu; dysk ok. 87 GB wolne).** Duży plik albo ZIP buforowany w procesie OM → swap/OOM całej instancji. Istniejące ścieżki buforują: `s3-driver.ts` l.188, `signed-upload/[token].ts` l.25–45/l.118, `download.ts` l.54; `jszip` ładuje całe archiwum | presigned PUT/GET i multipart bezpośrednio przeglądarka ↔ S3 (§5.3–5.4); jedyny proces dotykający bajtów to worker importu, strumieniowo, concurrency 1, pamięć ≈ `partSize × queueSize`; zakaz `driver.read/store/toLocalPath` dla `projectDocs` (test/lint w PR C); brak plików tymczasowych; scenariusz pamięci w planie testów (§14) | średnie do czasu pomiaru w PR C; potem niskie. Worker dzieli RAM z kontenerem aplikacji (D115, R19) |
| R2 | **Fallback B2 zwraca 501 na `If-None-Match` przy `PutObject`** (zgłoszenia zewnętrzne; brak w dokumentacji). Driver `storage_s3` wysyła go zawsze w `store()` (l.171) i `putObject()` (l.243) | driver `storage_s3` używany tylko w zakresie opisanym w specu: konfiguracja (preset/`credentialsEnvPrefix`), klient SDK i `endpoint-safety`; nigdy `store()`/`read()`/`putObject()` (bufor, D110). Na B2 (adapter, `CONDITIONAL_WRITES = false`) nie wywołujemy `store()` ani `putObject()` i nie wysyłamy `IfNoneMatch`; klucze losowe i unikalne. U dostawcy domyślnego (OVHcloud, `If-None-Match` potwierdzony) nagłówek wysyłamy przy presigned PUT; PoC przed kodem | niskie dla `project_delivery`; przy fallbacku B2 wysokie dla ewentualnego użycia `storage_s3` jako drivera `attachments` (poza zakresem, D45) |
| R3 | Endpoint e-Zamówień do listy dokumentów jest nieudokumentowany i może się zmienić; limit 250 MB dla dokumentów postępowania niepotwierdzony w oficjalnej dokumentacji (250 MB = rozmiar testowy KA-6, D120; §5.6); inne platformy (np. platformazakupowa.pl) tylko jako link | import odporny na błędy (raport, status `partial`), retry z backoff, fallback: ręczny ZIP z „pobierz wszystkie” (§5.6); linki zawsze zapisane | średnie (zależność od zewnętrznego API bez kontraktu) |
| R4 | Zip bomb, path traversal, nazwy w CP852, ZIP szyfrowany/uszkodzony | limity wpisów, rozmiaru i współczynnika; odrzucenie `..`/absolutnych/symlinków; normalizacja nazw; zagnieżdżone ZIP bez rozpakowania; wpisy szyfrowane pominięte z raportem | niskie |
| R5 | Wyciek przez presigned URL albo link udostępniania (v1) | krótki TTL presign, wydawany per żądanie po ACL, nigdy zapisany; linki z obowiązkowym `expires_at`, hash tokenu, odwołanie, licznik; brak listowania nadrzędnych folderów | niskie (URL ważny do wygaśnięcia, jeśli wycieknie) |
| R6 | Kolizja z quota core: `reconcileTenantS3Objects` (`quota-accounting.ts` l.14, l.23–28) wlicza wszystkie obiekty prefiksu drivera do quota tenanta | osobny bucket na pliki projektów (O4); własny ledger per organizacja | niskie przy osobnym buckecie; średnie przy wspólnym |
| R7 | Domyślne sumy kontrolne AWS SDK (≥ 3.729) w presigned URL dla przeglądarki → odrzucenie uploadu; replikacja/kopiowanie nie zachowuje sum | `requestChecksumCalculation`/`responseChecksumValidation` = `WHEN_REQUIRED` w naszym kliencie; sha256 liczony przez worker; PoC | niskie |
| R8 | Różnice dostawców vs S3: presigned POST nie wszędzie (B2 i Cloudflare R2 bez), presigned `UploadPart` i `response-content-*` niepotwierdzone w dokumentacji żadnego dostawcy (§5.11), CORS (`ETag` w `ExposeHeaders`) | tylko PUT; PoC uploadu multipart z przeglądarki i pobrania z `content-disposition`; fallback: metadane `Content-Disposition` przy uploadzie | niskie po PoC |
| R9 | Wyścig quota i niespójność ledgera (sesje porzucone, różnica deklaracji i `HeadObject`) | advisory lock per organizacja; rozmiar z `HeadObject`; sweeper wygasłych sesji; okresowa rekonsyliacja ledgera z `ListObjectsV2` własnego bucketu (raport, bez usuwania) | niskie |
| R10 | Archiwum (D113) zależy od wybranego dostawcy: zimne klasy OVHcloud mają minimalny okres przechowywania i opłatę za odczyt wg cennika (§5.11); Cold Archive tylko w `eu-west-par`; przy fallbacku B2 zimna klasa jest niewykonalna: jedna klasa przechowywania, a reguły cyklu życia B2 nie mają przejścia klasy (Transition) | archiwum = eksport albo zimna klasa u wybranego dostawcy (v2), zawsze za potwierdzeniem administratora; klasa i region bucketu dobrane przy wdrożeniu; przy B2 tylko eksport (ZIP strumieniowo do bucketu eksportu), bez reguł lifecycle na dokumentach | niskie (decyzja kosztowa w v2) |
| R11 | **Prawne (D109): e-dziennik budowy** (EDB, Prawo budowlane) — moduł nie jest dziennikiem budowy i nie może być tak przedstawiany | brak funkcji EDB; w UI brak nazwy „dziennik budowy”; weryfikacja prawna przed v2 | do oceny prawnej |
| R12 | **Prawne: rękojmia, gwarancja, zabezpieczenie należytego wykonania (Pzp), okresy przechowywania dokumentów i danych osobowych (RODO), auto-archiwizacja w v2** | daty i retencja tylko jako dane i podpowiedzi; nic nie dzieje się automatycznie (D113); terminy i zwrot zabezpieczenia poza zakresem; weryfikacja prawna przed v2 | do oceny prawnej |
| R13 | Dane w UE — umowa powierzenia (DPA) i podmiot dostawcy: OVHcloud (FR) dla domyślnego; przy fallbacku Backblaze, Inc. (USA) z regionem UE — transfery | region UE (D111); dostawca konfigurowalny (dowolny zgodny z S3 w UE); DPA przy zakładaniu konta (zgoda Marka) | niskie (OVHcloud); niskie–średnie przy fallbacku B2 (ocena prawna/DPA) |
| R14 | Własne akceptacje v1 vs `workflows` w v2 — dublowanie | D114: interfejs `ApprovalEngine` od v1; `workflows` w v2 jako druga implementacja bez zmiany modelu rewizji (D93) | niskie |
| R15 | Nowe zależności `@aws-sdk/lib-storage`, `yauzl` (ask first, D74; decyzja na etapie kodu) albo własny parser ZIP w czystym Node | bez zgody: multipart komendami `client-s3` + presigner (już w repo, §5.6); ZIP przez `zlib.createInflateRaw` i własny parser katalogu centralnego czytanego zakresami. Ryzyka parsera: ZIP64, data descriptor (bit 3), katalog centralny na końcu pliku (EOCD z komentarzem), kodowanie nazw. Mitygacja: testy na archiwach z polskich platform, odrzucanie nieobsługiwanych metod z raportem | niskie (z zależnościami); średnie (własny parser) |
| R16 | Rozjazd projektu z dealem/ofertą (ponowne otwarcie, zmiana roli `primary`, usunięcie kalkulacji, split inwestycji) | flagi i bannery, snapshot oferty w projekcie, brak usuwania; decyzja użytkownika (analogia D72); subscriber `investment.updated` (v1) | niskie |
| R17 | Wyłączony `storage_s3` w buildzie (`OM_ENABLE_STORAGE_S3` domyślnie `false`) albo brak bucketu | moduł działa na linkach i metadanych; upload → 422 `STORAGE_NOT_CONFIGURED`; włączenie = warunek etapu kodu (zgoda Marka, O10) | niskie |
| R18 | Rejestr `executionScheduleRegistry` w costingu rozszerza bazę o kontrakt dla dwóch modułów opcjonalnych | rejestr generyczny, bez wiedzy o konsumentach (wzór `scheduleSourceRegistry`); alternatywa w O2 | niskie |
| R19 | Worker importu dzieli RAM z kontenerem aplikacji (D115; brak osobnego kontenera workera w compose, `docker-compose.fullapp.yml` l.156/l.184/l.207) | strumieniowo, współbieżność 1 tylko dla kolejek `project_delivery`, limity per plik i per ZIP, timeout; pomiar na wersji testowej (KA-6, progi D120) decyduje o osobnym kontenerze z limitem pamięci | średnie do pomiaru KA-6; potem niskie |
| R20 | Usuwanie poza dokumentami (staging ZIP, obiekty osierocone) mogłoby trafić w klucz rewizji (błąd prefiksu, wyścig `complete` ↔ sweeper) | jedna funkcja `DeleteObject` ze strażnikiem (D121; na buckecie wersjonowanym ze wszystkimi wersjami): tylko `staging/{importId}/` danej organizacji albo `storage_key` sesji `expired` bez rewizji; przejście `reserved → expired` pod advisory lockiem, `complete` wymaga `reserved`; log każdego usunięcia; lifecycle tylko dla `staging/` i niedokończonych multipartów; test listy wywołań (KA-4 pkt 8) | niskie |
| R21 | Purge na B2 (wersjonowanie zawsze włączone) albo na OVHcloud z włączonym wersjonowaniem (D117): `DeleteObject` po samej nazwie zostawia wersje, które dalej są płatne, a quota by spadła | purge = `ListObjectVersions` + `DeleteObject` z `VersionId` dla każdej wersji i markera, potwierdzenie pustą listą; quota zmniejszana dopiero po potwierdzeniu; `purge_failed` przy Object Lock lub błędzie; obsługa tych operacji do potwierdzenia w PoC (D122, KA-7 pkt 4) | niskie po PoC; średnie bez PoC na B2 |
| R22 | Zgodność OVHcloud z wymaganymi operacjami potwierdzona tylko dokumentacją, nie testem: warunkowy PUT (`If-None-Match`), presigned PUT/GET, multipart i jego wznawianie | PoC na etapie kodu jako kryterium akceptacji (KA-7); jeśli nie przejdzie, wchodzi B2 z adapterem (D111). Kopia zapasowa: wersjonowanie OVHcloud i kopia bazy w MVP, nocna kopia do B2 w v1 (D117, zamyka O14) | średnie do PoC; potem niskie |

---

## 13. Otwarte (pytania techniczne — propozycje runnera, do review Kod/Cezara)

Pytania biznesowe (a), (b), (c) są zamknięte przez D111, D112, D113. O5 zamknięte przez D114 (akceptacje), O6 przez D115 (worker na istniejącej kolejce). O7 (sha256 — worker) i O9 (linki udostępniania — v1, z D106) zamknięte w §5.12 pkt 7 i 12. W rev 5 zamknięte: O1 przez D116 (projekt bez kalkulacji, podpięcie później), O11 przez D118 (limit miękki), O13 przez D120 (progi KA-6), O14 przez D117 (wersjonowanie i kopia do B2).

- **O2 — Miejsce rejestru harmonogramu wykonawczego.** Propozycja: `executionScheduleRegistry` w costingu (baza; brak importu schedule ↔ delivery). Alternatywa: token rejestrowany przez schedule i `tryResolve` w delivery — wymaga współdzielonego typu bez importu modułu.
- **O3 — Nowe zależności (ask first, D74; decyzja na etapie kodu):** `@aws-sdk/lib-storage` (strumieniowy multipart w workerze) i `yauzl` (odczyt ZIP z losowym dostępem). Alternatywy bez nowych zależności: multipart komendami `@aws-sdk/client-s3` + presigned `UploadPart` przez `@aws-sdk/s3-request-presigner` (oba już w repo); w repo nie ma strumieniowej biblioteki ZIP (`jszip` ładuje całość), więc ZIP bez `yauzl` = czysty Node (`zlib.createInflateRaw` + parser nagłówków) z ryzykami ZIP64, data descriptor i katalogu centralnego na końcu pliku (§5.6, R15).
- **O4 — Osobny bucket vs prefiks** we wspólnym buckecie `storage_s3`. Propozycja: osobny bucket (R6). Do tego migracja plików przy zmianie dostawcy (v2).
- **O8 — Podgląd PDF:** natywny czytnik przeglądarki (MVP, bez zależności) vs pdf.js (ask first).
- **O10 — Warunki etapu kodu (zgoda Marka):** włączenie `OM_ENABLE_STORAGE_S3`, konto i bucket u domyślnego dostawcy (D111, §5.11; fallback B2), DPA, miejsce przechowywania poświadczeń bucketu klienta: w bazie wyłącznie zaszyfrowane mechanizmem szyfrowania danych OM, poza `module_configs`, nigdy jawnie, w repo, logach ani eventach; w API tylko maska; mechanizm wybierany w v2 (§5.12 pkt 11, D130).
- **O12 — Kamienie milowe projektu vs kamienie Gantta w schedule:** brak synchronizacji (propozycja); ewentualne powiązanie — v2.

---

## 14. Uwagi dla planu testów (PR C)

- Plan testów musi zawierać scenariusz **dużego pliku** (upload multipart z przeglądarki i pobranie) oraz **dużego ZIP** (import w workerze), w którym pamięć procesu aplikacji i workera **nie rośnie proporcjonalnie do rozmiaru pliku**. Pomiar szczytowego RSS przy dwóch różnych rozmiarach plików, ten sam limit ze stałego bufora; brak plików tymczasowych na dysku.
- Scenariusze dla KA-1 do KA-7 (§10): przekroczenie quota (ostrzeżenia 80% i 100%, blokada powyżej 110%, wyścig, zwolnienie rezerwacji, import `partial`), wybór wariantu A/B, retencja i data na projekcie, brak usunięcia bez administratora (w tym brak `DeleteObject` z workerów).
- Kontrakty DI między trzema modułami: costing bez delivery i schedule; delivery bez schedule (zakładka ukryta, brak błędów); delivery + schedule (link, `ensureExecution` idempotentne per inwestycja, jedna faza projektu, D131).
- PoC u wybranego dostawcy (R2, R7, R8; §5.11) jako warunek przed kodem: presigned PUT z `If-None-Match: *`, multipart z przeglądarki (presigned `UploadPart`), `ListParts` i abort, CORS z `ETag`, presigned GET z `response-content-disposition`. Ten sam zestaw na fallbacku B2 z adapterem (bez `If-None-Match`).
- Pomiar RAM workera na wersji testowej (KA-6, D115) jako kryterium etapu kodu: dwa parametry (przyrost RSS workera, minimalna wolna pamięć hosta), progi z D120 (w tym OOM, restarty i przyrost swapu); brak plików tymczasowych na dysku; współbieżność 1 tylko dla kolejek `project_delivery`.
- PoC zgodności OVHcloud (KA-7, R22): warunkowy PUT, presigned PUT/GET, multipart i wznowienie; przy porażce ścieżka B2 z adapterem.
- Rozstrzygnięcia z §5.12 (uwagi PR C, pkt 1–12) do pokrycia scenariuszami: strażnik `DeleteObject` (tylko `staging/` i osierocone sesje `expired` bez rewizji, R20), wyścig `complete` ↔ sweeper, purge przez wszystkie wersje z potwierdzeniem pustym `ListObjectVersions` (R21, także na B2 w PoC), lifecycle tylko dla `staging/` i niedokończonych multipartów, import `partial` bez usuwania rewizji, daty gwarancji i rękojmi z ręcznego wpisu, własne trasy presign bez `storage_providers.manage`.
- Pokrycie decyzji D98–D132 w planie testów — do dopisania (dziś brak, zgodnie z planem); D116–D132 są samodzielne w rejestrze, więc scenariusze pisze się z `decisions.md`.
- D133–D157 (PR 21: reguły speki przeniesione do rejestru i rozstrzygnięcia techniczne) — TC doda niezależna sesja w osobnej rundzie, z `decisions.md`.

---

## 15. Migracje i backward compatibility

- Nowy moduł: tylko nowe tabele `pd_*`. Brak zmian w tabelach `pc_*`, `ps_*`, `customers_*` i w `packages/*` (D45).
- Zmiany w costingu (nowe metody `calculationLookupService`, rejestr `executionScheduleRegistry`) są addytywne. Brak providera = zachowanie bez zmian.
- Zmiana w schedule (rejestracja providera) jest addytywna. Bez `project_delivery` nikt nie woła providera.
- Dane w S3 są niezależne od bazy. Rollback modułu nie usuwa plików (D113). Ponowne włączenie odtwarza dostęp przez `storage_key`.

## 16. Szkielet plików modułu

```
apps/mercato/src/modules/project_delivery/
  index.ts  acl.ts  setup.ts  di.ts  events.ts  ce.ts
  data/entities.ts  data/validators.ts  migrations/
  commands/ projects.ts stages.ts tasks.ts milestones.ts folders.ts documents.ts uploads.ts imports.ts storage.ts settings.ts
  lib/ storage/projectDocsStorageService.ts storage/s3Client.ts quota/orgQuotaLedger.ts import/ezamowienia.ts import/zipStream.ts
       retention.ts permissions.ts deliveryGuard.ts
  subscribers/ dealUpdated.ts dealDeleted.ts dealLost.ts offerRoleChanged.ts calculationDeleted.ts
  workers/ tender-import.ts checksum.ts upload-sweeper.ts
  api/ (trasy §7, każda z openApi)
  backend/ projects/… documents/… settings/…
  widgets/ deal-tab (detail:customers.deal:tabs)
  i18n/ pl.json en.json
  __tests__/  __integration__/
```

---

## 17. Final Compliance Report (vs `AGENTS.md`)

| Reguła | Źródło | Status |
|---|---|---|
| Sekcje TLDR, Architecture, Data Models, API, Risks (z ryzykiem rezydualnym), Final Compliance Report, Changelog | `.ai/specs/AGENTS.md` | ✅ TLDR, §0, §2, §7, §12, §17, Changelog |
| Brak relacji ORM między modułami; FK-id + snapshot | `packages/core/AGENTS.md` § Never | ✅ §0.1, §2.1 |
| Kierunek zależności: baza nie importuje opcjonalnych; opcjonalne nie importują się nawzajem | `packages/core/AGENTS.md` § Cross-Module Coupling | ✅ §0.1, §0.2 (rejestr w costingu) |
| Zapisy przez komendy; `makeCrudRoute` + indexer; `openApi`; mutation guard | `packages/core/AGENTS.md` § Always | ✅ §0.3, §7 |
| Feature'y w `acl.ts`, granty w `setup.ts` | `packages/core/AGENTS.md` § ACL | ✅ §6 |
| `deleted_at`, `updated_at`, optimistic locking | `packages/core/AGENTS.md` § Database Entities | ✅ §2.1 |
| Ustawienia przez ModuleConfigService | `packages/core/AGENTS.md` § Module Config | ✅ §8 (D69) |
| ProgressJob + worker dla importu (202 + `progressJobId`, heartbeat, anulowanie) | `packages/core/src/modules/progress/AGENTS.md` | ✅ §5.6 |
| Testy integracyjne każdej trasy w tej samej zmianie | root `AGENTS.md` | ✅ §11 „Narzut OM”; plan testów PR C |
| Nowe zależności = ask first | root `AGENTS.md` | ✅ O3, R15 — na etapie speki nic nie instalujemy |
| Bez zmian w `packages/core` i `packages/storage-s3` | D45 | ✅ §5.9, §15 |
| Brak sekretów w repo i ustawieniach | D111 | ✅ §5.1, §8 |

## 18. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-23)

| # | Punkt listy (Kod pN) | Wynik |
|---|---|---|
| 1 | Komunikacja przez DI/eventy/widget/FK-id; zero HTTP (p1) | ✅ §0.1–0.5 |
| 2 | Zależność jednokierunkowa; provider w rejestrze DI bazy (p1) | ✅ §0.2 (`executionScheduleRegistry` w costingu; delivery i schedule bez wzajemnych importów) |
| 3 | Brak zapisów do cudzych tabel (p2) | ✅ jedyny zapis cudzej encji: komenda schedule `create-execution` przez providera (v1) |
| 4 | Zero hardkodowanych UUID (p2) | ✅ szablony po kodzie |
| 5 | Partial unique, zmiana w jednej transakcji (p2) | ✅ §2.2 (`pd_projects_one_per_deal`, CHECK `pd_projects_offer_all_or_none`), §3 |
| 6 | Jedno pojęcie na byt; zakładka przez `detail:customers.deal:tabs` (p11) | ✅ inwestycja = `pc_investments` (D63); harmonogram = schedule (D100) |
| 7 | RBAC tylko w `acl.ts`; role admin/employee (p4) | ✅ §6 |
| 8 | Ustawienia nie dublują RBAC (p4) | ✅ §8 |
| 9 | Ukryta marża = ukryty koszt (p3) | ✅ §0.2, §6 — delivery nie dostaje kosztów ani marży |
| 10 | Pola ukryte poza index/search/audit/eventami (p3) | ✅ §0.4 (payload = ID), §2.2 (`offer_snapshot` bez kwot) |
| 11 | Zapisy przez komendy (p6) | ✅ §0.3 |
| 12 | Audyt przez `audit_logs` (p6) | ✅ §0.3, §9 |
| 13 | `makeCrudRoute` + indexer, `openApi`, guards (p6) | ✅ §7 |
| 14 | Zapis minimalny, benchmark dużych danych (p8) | ✅ duże dane = pliki: §10 KA-5, §14 (pomiar pamięci) |
| 15 | `deleted_at` (p20) | ✅ §2.1 |
| 16 | ModuleConfigService (p7) | ✅ §8 |
| 17 | Włączanie per organizacja + kill-switch (p7) | ✅ §0.6 |
| 18 | Firma = organizacja (p7) | ✅ D15; quota i ustawienia per organizacja |
| 19 | Statusy deala zgodne z OM (p5) | ✅ §0.5, §3 (`closure_outcome`, `deleted_at`, subscribery persistent) |
| 20 | Import przez ProgressJob + worker (p9) | ✅ §5.6 |
| 21 | Edge case'y importu (p9) | ✅ dla importu dokumentów: §5.6 pkt 4 (ZIP), R3, R4; punkty XLSX (formuły, scalone komórki) n/d — moduł nie importuje XLSX |
| 22 | Nowe zależności = ask first (p10) | ✅ O3 |
| 23 | Najpierw to, co jest w repo (p10) | ✅ `client-s3`, `s3-request-presigner`, `endpoint-safety`; `jszip` odrzucony z uzasadnieniem (R1) |
| 24 | Numeracja przez sekwencje PG (p18) | ✅ §2.1 |
| 25 | Walidacje brzegowe (p19) | ✅ CHECK statusów, `billing_pct` 0–100, rozmiary |
| 26 | Hierarchia ograniczona (p13) | n/d (linki do sekcji/pozycji jednego poziomu, jak costing) |
| 27 | Algorytmy harmonogramu (p12) | n/d — brak własnego Gantta (D100) |
| 28 | Narzut OM w fazach (p16) | ✅ §11 |
| 29 | Testy Jest/Playwright (p17) | ✅ §11, §14 |
| 30 | MVP pocięty po wartości (p15) | ✅ §11 |
| 31 | Forma speki (p20) | ✅ |

Brak punktów ⚠️. Ryzyka rezydualne: §12 (R1 do czasu pomiaru, R3, R11–R13 do oceny prawnej).

---

## 19. Decision traceability (śledzenie decyzji)

| Decyzja | Gdzie w specu | Uwagi |
|---|---|---|
| **D1** | TLDR, §1.1 | Klin #1 — CRM budowlany na OM; delivery domyka cykl przetarg → realizacja |
| **D2** | §2.2 (szablony per segment, seed `prefab`) | wielosegmentowość |
| **D5** | §3 (`OFFER_NOT_PRIMARY`), §0.5 | projekt tylko z oferty `primary` |
| **D6** | §5.6 (podpowiedź identyfikatora e-Zamówień z kodu inwestycji) | |
| **D15** | §5.5, §8, §18 | firma = organizacja; quota i ustawienia per organizacja |
| **D16** | §4.2 | half-up przy billing % (v1) |
| **D19** | §0.1, §4.1 | schedule opcjonalny; delivery działa bez niego |
| **D23** | §4.1 | jeden Gantt na inwestycję — delivery go nie dubluje |
| **D24** | §4.1 | przejście ofertowy → wykonawczy robi schedule (`dealWon`) |
| **D44** | §1.2, R1 | ograniczone zasoby VPS |
| **D45** | §5.9, §15, §17 | bez zmian w `packages/core` i `packages/storage-s3` |
| **D47** | §0.6 | włączanie per organizacja + kill-switch |
| **D51** | §3 | analogiczny komunikat konfliktu roli oferty |
| **D53** | §4.1 | jeden rekord harmonogramu na inwestycję |
| **D62** | §4.2 | zaokrąglanie half-up (v1 billing %) |
| **D63** | §0.1, §2.2, §18 | inwestycja = `pc_investments` |
| **D65** | §3 | pierwsza oferta = primary (źródło zwycięskiej oferty) |
| **D67** | §0.6, §5.8, KA-4 | wyłączenie ukrywa dane, niczego nie usuwa |
| **D69** | §8 | klucz `org:{id}:settings` |
| **D72** | §0.5, R16 | ponowne otwarcie deala = flaga, decyzja użytkownika |
| **D74** | §5.6, O3, R15 | nowe zależności ask first |
| **D77** | §4.1 | `create-execution` idempotentne |
| **D83** | R16 | split inwestycji (v1) — flaga na projekcie |
| **D90** | nagłówek, §0.1 | bez `sales`/`catalog` |
| **D93** | §9, R14 | `workflows` dopiero jako kandydat v2 |
| **D98** | §0.1, §0.2, §11 „Zakres zbiorczy” | trzy moduły, kierunek zależności, rejestr w costingu |
| **D99** (zastąpiona przez D116) | §3, §0.3 | komenda „wygrany przetarg → realizacja” |
| **D100** | TLDR, §4.1, §0.2 | brak własnego Gantta; link/uruchomienie przez registry (v1), jedna faza projektu (D131) |
| **D101** | §4.2, §2.2 | kamienie ↔ sekcje/pozycje oferty; billing % v1 |
| **D102** | §5.1, §5.3, §5.5 | metadane w OM, pliki w S3, presigned, quota per organizacja |
| **D103** | §2.2, §6, §9 | niemutowalna rewizja; najnowsza zatwierdzona do produkcji |
| **D104** | §6, §5.12 pkt 12 | dziedziczenie, ACL folderu, linki z obowiązkowym wygaśnięciem (v1, bo lista MVP w D106 ich nie zawiera) |
| **D105** | §5.7, §5.2 | dyski w trybie linku |
| **D106** | §11 MVP | |
| **D107** | §11 v1, §9 | zakres v1; silnik akceptacji — D114 |
| **D108** | §11 v2 | |
| **D109** | R11, R12 | regulacje jako ryzyka do oceny prawnej |
| **D110** | §1.2, §5.3, §5.4, §5.6, §5.9, R1, KA-5, §14 | brak plików na VPS i w procesie serwera HTTP aplikacji; bufor RAM tylko w workerze, ≤ `partSize × queueSize`, w limicie pamięci kontenera `app` |
| **D111** | §5.1, §5.10, §5.11, R2, R8, R13 | storage w UE; domyślny = najtańszy w pełni kompatybilny (OVHcloud wg §5.11); fallback B2 z adapterem; bez sekretów |
| **D112** | §5.2, §5.5, §8, KA-1, KA-2 | wariant A (MVP) / B (v1/v2), quota jako limit miękki (doprecyzowanie D118) |
| **D113** | §5.8, §5.11, §5.12, §8, KA-3, KA-4, R10, R12, R20, R21 | retencja; archiwum = eksport albo zimna klasa u wybranego dostawcy; brak usuwania bez administratora |
| **D114** | §9, §11 v1, R14 | akceptacje v1: `pd_approval_tiers`, `pd_approval_reviews` za `ApprovalEngine`; `workflows` w v2 |
| **D115** | §1.2, §5.6, KA-5, KA-6, R1, R19, O13 (zamknięte przez D120), §14 | worker na istniejącej kolejce OM w kontenerze aplikacji; bez nowego kontenera do pomiaru |
| **D116** | TLDR, §0.2, §0.3, §2.2, §3, §4.1, §5.12 pkt 6, §7, §11 MVP | deal bez kalkulacji → projekt bez oferty; podpięcie później; jeden projekt na wygrany deal i na inwestycję (D99 — zastąpiona przez D116; zamyka O1) |
| **D117** | TLDR, §5.1, §5.2, §5.5 (kopia B2 poza quota), §5.8, §5.11, §5.12 pkt 3, §8, §11, R21, R22, KA-7 | wersjonowanie OVHcloud + kopia bazy (MVP), kopia do B2 (v1); usuwanie wszystkich wersji (zamyka O14) |
| **D118** | TLDR, §0.4, §5.2, §5.5, §5.6 pkt 3 i 5, §8, §11, KA-1, §14 | quota jako limit miękki: 80/100% ostrzeżenia od `used`, nadwyżka ponad 100% płatna w okresie rozliczeniowym, >110% blokada 413 bez eventu (zamyka O11) |
| **D119** | §2.2 `pd_imports`, §5.5, §5.6 pkt 3 i 6, §11 MVP | oryginał ZIP przetargu jako dokument w `00 Przetarg`; w quota bez wyjątków, osobno jako „archiwum dowodowe” |
| **D120** | §5.6, KA-6, R3, R19, §14 | progi KA-6 dla ZIP 250 MB; 250 MB niepotwierdzone (zamyka O13) |
| **D121** | §5.1, §5.3 pkt 4, §5.6 pkt 6, §5.8, §5.12 pkt 1 i 4, KA-4, R20 | strzeżona funkcja `DeleteObject` (staging, osierocone) |
| **D122** | §5.8, §5.12 pkt 3, KA-4, R21 | purge po potwierdzeniu administratora, wszystkie wersje |
| **D123** | §5.6 pkt 7 i 8, §5.12 pkt 10 | import per wpis, statusy, idempotencja, wznowienie |
| **D124** | §5.3 pkt 5, §5.6 pkt 3, §5.12 pkt 1 i 7 | sha256 przez worker, odczyt ZIP zakresami |
| **D125** | §5.3 pkt 3, §5.12 pkt 4 | `UPLOAD_SIZE_MISMATCH` |
| **D126** | §5.5, §5.12 pkt 5, KA-1 | ledger quota per organizacja |
| **D127** | §5.3, §5.12 pkt 8 | własne trasy presign modułu |
| **D128** | §5.8, §5.12 pkt 9, KA-3 | daty gwarancji i rękojmi w MVP ręcznie |
| **D129** | §5.1, §5.12 pkt 4, KA-4 | dozwolone reguły cyklu życia bucketu |
| **D130** | §5.2, §5.12 pkt 11, §8, §13 O10 | poświadczenia bucketu klienta i brak sekretów w ustawieniach |
| **D131** | §0.2, §4.1, §11 v1, §14 | jedna faza projektu (zadanie-podsumowanie WBS) w harmonogramie inwestycji, flaga D72 na fazie; `ensureExecution` idempotentne per inwestycja |
| **D132** | TLDR, §2.2, §4.1, §5.12 pkt 6 | wygrana część przetargu = osobna inwestycja i osobny deal; wspólny numer ogłoszenia (costing §2.2); warunkowe — zależy od decyzji Marka w sprawie D31; kontrakt push per część — zadanie Enki (costing §10.2) |
| **D133** | §3 pkt 2–3 | `DEAL_NOT_WON`, `OFFER_NOT_PRIMARY` bez fallbacku |
| **D134** | §0.1, §2.1 | brak relacji ORM i FK do tabel innych modułów |
| **D135** | §3 | `link_winning_offer` wymaga `projects.manage`, inaczej 403 |
| **D136** | §5.8, §6 | soft delete dokumentu tylko z `documents.delete`; obiekty S3 w quota |
| **D137** | §6 | macierz feature'ów i granty |
| **D138** | §2.2 `link_url` | dokument-link tylko `https:` |
| **D139** | §5.6 pkt 4, §8 | parametry ochrony ZIP, zagnieżdżony ZIP, `encrypted` |
| **D140** | §4.1 (schedule §2.2, R15) | `reopened_at` czyszczona przy ponownym `won` |
| **D141** | §0.5, §2.2 | flaga `deal_reopened_at`, event, `reopen_flag_clear` |
| **D142** | §2.3, §6, §8 | link udostępniania: `expires_at` obowiązkowe, cel, bez listowania (v1) |
| **D143** | §0.6, R17 | `STORAGE_NOT_CONFIGURED` |
| **D144** | §5.3 pkt 1, §7 | klucz tylko z serwera; `FIELD_NOT_ALLOWED` |
| **D145** | §5.3 pkt 2, §7 | brak presigned POST → 404 |
| **D146** | §5.3 pkt 1, §7 | sha256 klienta → `FIELD_NOT_ALLOWED` |
| **D147** | §6, §7 | brak dostępu w ACL → 404 |
| **D148** | §5.6 pkt 4 i 8 | `unsafe_path` |
| **D149** | §5.3 pkt 3, §7 | `UPLOAD_SESSION_EXPIRED` |
| **D150** | §5.6 pkt 4 i 8 | `zip_limit_exceeded`, `too_large`, `skipped_duplicates` |
| **D151** | §5.4 | MIME z zawartości; HTML/SVG/XML jako `attachment` + `nosniff` |
| **D152** | §2.3, §6, §7 | kody linków udostępniania (v1) |
| **D153** | §5.5 | rekoncyliacja wersji spoza aplikacji |
| **D154** | §19 (costing §2.2) | warunkowe: przy D31 część = ta sama inwestycja |
| **D155** | §2.3, §7, §9 | `APPROVAL_LEVEL_OUT_OF_ORDER`, `TRANSMITTAL_SENT` (v1) |
| **D156** | §7, §9 | komentarz obowiązkowy przy odrzuceniu (v1) |
| **D157** | §2.3, §7, §9 | `APPROVAL_PENDING` blokuje transmittal, nie protokół (v1) |

---

## Changelog

| Data | Zmiana |
|---|---|
| 2026-10-23 | **rev 1** — pierwsza wersja speki `project_delivery` (PR B, tylko specyfikacja): trzy moduły i kontrakty DI/eventów (D98), komenda „wygrany przetarg → realizacja” (D99 — zastąpiona przez D116 w rev 5), brak własnego Gantta + rejestr `executionScheduleRegistry` (D100), kamienie ↔ oferta (D101), dokumenty na S3 z presigned i multipart, quota per organizacja (D102, D110), rewizje i ACL (D103, D104), dyski w trybie linku (D105), zakres MVP/v1/v2 (D106–D108), regulacje jako ryzyka (D109), stan VPS na 23.10 i weryfikacja `storage-s3` z plikiem i linią (D110), storage w UE z domyślnym B2 Amsterdam i sprawdzeniem B2 (D111), wariant A/B (D112), retencja i purge tylko przez administratora (D113), kryteria akceptacji KA-1 do KA-5, wybór silnika akceptacji v1 (§9), uwagi dla PR C (§14). |
| 2026-10-23 | **rev 2** — odbiór Cezara i uwagi Koordynatora: D114 (akceptacje v1: własna walidacja progów za `ApprovalEngine`, `workflows` w v2; zamyka O5), D115 (import ZIP i multipart w istniejącym workerze kolejki OM w kontenerze `app`, bez nowego kontenera, twarde reguły strumieniowe, pomiar KA-6; zamyka O6), prefiks `pd_` i nazwa modułu zatwierdzone, O3 z alternatywami bez nowych zależności i wynikiem sprawdzenia bibliotek ZIP w `yarn.lock`, tabela dostawców S3 w UE z dokumentacją i cennikami (§5.11, odczyt 2026-10-23), domyślny dostawca wg reguły D111 (OVHcloud; fallback B2 z adapterem), archiwum = eksport albo zimna klasa (D113, R10), R2 z zakresem użycia drivera `storage_s3`, nowe R19. |
| 2026-10-23 | **rev 3** — uwagi z niezależnego planu testów (PR C), rozstrzygnięte w §5.12 bez nowych D: zakres `DeleteObject` (tylko `staging/` i obiekty osierocone, strażnik, R20); B2 bez klas i bez Transition (§5.10, §5.11, R10); purge przez wszystkie wersje z `VersionId` i quota do potwierdzenia (§5.8, R21); `AbortMultipartUpload` i lifecycle niedokończonych multipartów dozwolone; quota per organizacja vs tenant (§5.5); unikalność bez NULL-i (§2.2); sha256 przez worker (O7 zamknięte); własne trasy presign (§5.3); daty gwarancji i rękojmi w MVP ręcznie (§5.8, KA-3); semantyka częściowego importu (§5.6 pkt 8); poświadczenia bucketu klienta tylko zaszyfrowane w bazie (O10); linki udostępniania v1 (O9 zamknięte, D104). |
| 2026-10-23 | **rev 4** — odbiór #18 (Cezar): D115 i spec — bufor wyłącznie w RAM ograniczony do `partSize × queueSize` (parametry bez wartości), zero plików tymczasowych na dysku VPS (spójnie z D110, dopisane też w D110); współbieżność 1 na instancję tylko dla kolejek importu i multipartu `project_delivery`, inne kolejki `queue worker --all` bez zmian; KA-6: dwa parametry presji RAM (szczytowy przyrost RSS workera, minimalna wolna pamięć hosta) bez wartości, progi w O13 (Koordynator z Dawidem przed pomiarem; bez nich brak werdyktu); R22 + KA-7: PoC zgodności OVHcloud na etapie kodu, przy porażce B2 z adapterem; O14: kopia zapasowa przy regionie One Zone — do decyzji. |
| 2026-10-23 | **rev 4a** — odbiór #18 (Cezar): D110 — „nie przechodzą przez RAM aplikacji” zamienione na „nie przechodzą przez proces serwera HTTP aplikacji” oraz dopisane zdanie: bufor RAM istnieje tylko w procesie workera (proces potomny `queue worker --all` w kontenerze `app`), jest ograniczony do `partSize × queueSize` i dzieli limit pamięci kontenera `app`. Spójnie w TLDR, §1.2 pkt 2 i w macierzy śledzenia. |
| 2026-10-23 | **rev 5** — PR D (tylko dokumentacja): decyzje Koordynatora D116 (projekt bez kalkulacji, podpięcie `link_winning_offer`, jeden projekt na deal; D99 — zastąpiona przez D116; zamyka O1), D117 (wersjonowanie OVHcloud + kopia bazy w MVP, kopia do B2 w v1; zamyka O14), D118 (quota jako limit miękki 80/100/110%; zamyka O11; usunięte `overage_allowed`, `hard_cap_bytes`, `alert_thresholds_pct`), D119 (oryginał ZIP jako dokument), D120 (progi KA-6; zamyka O13; 250 MB niepotwierdzone). Twarde reguły §5.12, §5.6 pkt 6–8, R20 i R21 przeniesione do rejestru jako D121–D130 (bez nowych treści) z odwołaniami w specu. §5.6: odwołanie R9 → R3 (błąd), lista ponumerowana po kolei; R19: współbieżność 1 tylko dla kolejek `project_delivery`; jedno brzmienie poświadczeń bucketu klienta (§5.2, §5.12 pkt 11, §8, O10); §11 v2: encje. |
| 2026-10-23 | **rev 5a** — odbiór #20 (Cezar) i dopisek Koordynatora: §0.4 `quota_threshold_reached` w MVP (D118), `quota_exceeded` usunięty (blokada > 110% = tylko 413); D118: alert od `used`, raz na przejście progu z ponownym uzbrojeniem po spadku, nadwyżka ponad 100% płatna w okresie rozliczeniowym (`storage.overage_rate`, `pd_storage_usage_periods`); D116: jedyna unikalność per wygrany deal, inwestycja może mieć wiele projektów (indeks `pd_projects_by_investment` bez UNIQUE), CHECK `pd_projects_offer_all_or_none` w SQL, kody 422 `SEGMENT_REQUIRED` i 409 `OFFER_ALREADY_LINKED`; D131: faza projektu w harmonogramie inwestycji, `findProjectPhase`, `ensureExecution` per projekt i faza; D119: próg 110%, sha256 oryginału w locie (D124), dedup oryginału (D123), „archiwum dowodowe” w widoku zużycia (`pd_imports.original_revision_id`); D117: kopia B2 poza quota klienta; KA-1 pkt 2 i 5. |
| 2026-10-23 | **rev 5b** — odbiór #20 runda 2 (P20-B2, wariant B; Koordynator 2026-10-23 (bez potwierdzenia Marka)): każda wygrana część przetargu to osobna inwestycja i osobny deal (nowa D132; numer ogłoszenia wspólny dla części w costingu); D116: jeden projekt na deal i na inwestycję — nowy partial unique `pd_projects_one_per_investment` zamiast zwykłego indeksu, 409 `PROJECT_EXISTS` także przy podpięciu oferty do inwestycji z projektem (§2.2, §3, §7, §5.12 pkt 6); D131 uproszczona: jedna faza projektu w harmonogramie inwestycji, `findProjectPhase` usunięte (`findForInvestment` zwraca fazę), 409 `PROJECT_PHASE_EXISTS`, flaga D72 na fazie (§0.2, §4.1, §11, §14); usunięte wzmianki o wielu projektach i wielu fazach w jednej inwestycji (TLDR, §2.2, §3, §4.1, §14). Planów testów bez zmian. |
| 2026-10-23 | **rev 5c** — Koordynator 2026-10-23: D132 oznaczone jako warunkowe (zależy od decyzji Marka w sprawie D31; D31 z adnotacją konfliktu, treść bez zmian) — TLDR, §19; zadanie Enki (n8n) na etap kodu — kontrakt push e-Zamówienia na deal per część razem ze zmianą kontraktu z D81 — wpisane w costing §10.2 (rev 8m), start po „implementujemy” i decyzji w sprawie D31. |
| 2026-10-23 | **rev 5d** — PR 21 (tylko dokumentacja): reguły speki przeniesione do rejestru jako D133–D148 (odbiór #19 runda 2 i 3, Cezar) i rozstrzygnięcia techniczne D149–D155 (Cezar 2026-10-23, techniczne) oraz D156–D157 (B7, B8; Koordynator 2026-10-23, bez potwierdzenia Marka); odwołania w §0.1, §0.5, §0.6, §2.2, §2.3, §3, §5.3, §5.4, §5.5, §5.6 (powód `unsafe_path`, `zip_limit_exceeded`, `skipped_duplicates`), §6, §7 (nowe kody), §9, §14, §19. TC dla D133–D157 doda niezależna sesja w osobnej rundzie. |
