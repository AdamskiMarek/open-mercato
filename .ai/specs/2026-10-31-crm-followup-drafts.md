# Spec: Nocne szkice follow-upów CRM (`crm_followups`) — v2

<!-- Source doc: .ai/specs/2026-10-31-crm-followup-drafts.md -->

| Pole | Wartość |
|------|---------|
| **Status** | draft |
| **Data** | 2026-10-31 |
| **Rewizja** | 2026-10-31 (rev 2 — poprawki po review PR #33: B2–B5, N1–N16; decyzje D170–D184 zaktualizowane) |
| **Faza** | v2 |
| **Moduł** | `crm_followups` (`apps/mercato/src/modules/crm_followups`; prefiks tabel `fu_`), opcjonalny per organizacja (D47) |
| **Zależności upstream** | `customers` (deale, interakcje, komentarze, ustawienia), `configs` (ModuleConfigService), `audit_logs`, `notifications`, `@open-mercato/queue`, `auth`/`directory` (scope), opcjonalnie `@open-mercato/scheduler` (wyzwalacz cron, D180) |
| **Wyłączone upstream** | `inbox_ops` (tylko wzorzec UX propozycji, nie magazyn — D171), `workflows` (nie jest włączony w forku), automatyczna wysyłka e-mail (D170, D176) |
| **Kod bazowy rozpoznania** | `develop_OM_CRM` @ `41549820a198aea08a0ab9f36271a704439889cd` (linki w §1 to permalinki do tego SHA); gałąź speki od `3924f83d` — między tymi SHA zmieniły się tylko dokumenty `.ai/` (PR #32), kod bez zmian |
| **Etap** | tylko specyfikacja; bez kodu, dopóki Marek nie powie „implementujemy” |

---

## TLDR

- **Co (D170, decyzja Marka 2026-10-31):** worker raz na przebieg wyszukuje przetargi w lejku, leady i kontakty bez aktywności od N dni (N per firma, domyślnie N = 14) i dla każdego tworzy w OM **szkic** follow-upu: mail, zadanie albo przypomnienie o terminie.
- **Nic nie wychodzi samo (D176):** użytkownik przegląda szkice i każdy zatwierdza albo odrzuca. Zatwierdzenie zadania i przypomnienia tworzy interakcję komendą `customers.interactions.create`. Zatwierdzenie maila otwiera zwykłe okno wysyłki CRM z treścią szkicu; wysyła użytkownik. Decyzje o szkicach tylko z sesji użytkownika — klucz API (n8n, agent) może jedynie uruchomić przebieg.
- **Wyzwalacz z zewnątrz (D180):** cron (moduł `scheduler`, domyślnie 03:00 Europe/Warsaw, godzina konfigurowalna), webhook albo inny agent. Worker nie jest schedulerem. Każdy przebieg ma klucz idempotencji.
- **Notka z przebiegu (D182):** rekord `fu_runs` (liczba szkiców, ile pominięto, gdzie są) i powiadomienie in-app do właścicieli szkiców z linkiem do listy.
- **Samonaprawa (D174):** każdy przebieg zaczyna od rekoncyliacji — otwarte szkice obiektów z nowszą aktywnością zamyka jako `superseded`, dopiero potem liczy kandydatów.
- **Najpierw istniejące moduły (D171):** liczenie bezczynności na wzór `stuckDeals.ts`, zapis zadań przez komendy `customers`, powiadomienia przez `notifications`, audyt przez `audit_logs`, ustawienia przez ModuleConfigService. Nowe są tylko dwie tabele: `fu_drafts` i `fu_runs`.
- **Treść szkicu (D184):** domyślnie szablony (bez nowych zależności). Wariant LLM to pytanie biznesowe do Marka (Q-FU-1, §13).

## Streszczenie

Handlowcy Klin gubią follow-upy: przetarg stoi w lejku, lead nie dostał telefonu, kontakt nie był ruszany od tygodni. OM już wie, kiedy deal „utknął” na etapie (`stuck_threshold_days`), ale nic z tym nie robi. Ten moduł raz na noc przygotowuje propozycje następnego kroku jako szkice do decyzji człowieka. Zakres jest wąski: wykrycie bezczynności, szkic, decyzja, notka. Bez autowysyłki, bez własnego harmonogramu, bez zmian w `packages/core`.

## 0. Architecture (Architektura)

### 0.1 Moduły i kierunek zależności (D171)

```
scheduler (cron) ─┐
webhook / agent ──┼─► POST /api/crm-followups/runs ─► kolejka `crm-followups-scan` ─► worker scan
CLI ──────────────┘                                                               │
                                                                                   ▼
                customers (odczyt: deale, interakcje, komentarze, przejścia etapów, ustawienia)
                                                                                   │
                                                          komenda crm_followups.drafts.create
                                                                                   ▼
                                                fu_drafts  ◄── UI listy szkiców (zatwierdź / odrzuć)
                                                                                   │
                         zatwierdzenie: customers.interactions.create (zadanie, przypomnienie)
                                        okno wysyłki CRM (mail; wysyła użytkownik)
```

- `crm_followups` zależy od `customers`; `customers` nie wie o `crm_followups`. Komunikacja przez komendy (CommandBus), eventy i widget/enricher; zero HTTP między modułami.
- Odczyt danych `customers` wyłącznie do wyliczeń; zapis do tabel `customers` tylko komendami `customers` (np. `customers.interactions.create`, wzorzec: `lib/legacyActivityBridge.ts`).
- Brak zapisów do cudzych tabel; dane własne w `fu_drafts` i `fu_runs`.

### 0.2 Komendy (write path, wszystkie z audytem; D183)

| Komenda | Kto | Efekt |
|---|---|---|
| `crm_followups.runs.start` | worker / endpoint / CLI | tworzy `fu_runs` z `run_key` (idempotentnie, D180) |
| `crm_followups.runs.finish` | worker | zapisuje liczniki i notkę (D182) |
| `crm_followups.drafts.create` | worker (kontekst systemowy przebiegu) | tworzy szkic; konflikt na częściowym unikalnym indeksie = pominięcie (D174) |
| `crm_followups.drafts.approve` | użytkownik (tylko sesja) | zadanie/przypomnienie → `customers.interactions.create`; mail → status `handed_off` i otwarcie okna wysyłki (D176) |
| `crm_followups.drafts.reject` | użytkownik (tylko sesja) | status `rejected`, wyciszenie (D175), powód w metadanych komendy |
| `crm_followups.drafts.update` | użytkownik (tylko sesja) | edycja treści otwartego szkicu (`PATCH`) |
| `crm_followups.drafts.supersede` | subscriber / worker (rekoncyliacja) | zamyka otwarty szkic, gdy na obiekcie pojawiła się aktywność albo obiekt przestał się kwalifikować (D174) |
| `crm_followups.drafts.reassign` | administrator (tylko sesja) | zmiana `assignee_user_id` |
| `crm_followups.settings.update` | administrator (tylko sesja) | zapis ustawień §8; przy przełączeniu `followups.enabled` zakłada/usuwa job schedulera, przy zmianie `followups.timezone` aktualizuje strefę joba (D180, D181) |

Undo: `approve` dla zadania/przypomnienia cofa się przez undo komendy `customers.interactions.create` i powrót szkicu do `open`; `reject` cofa wyciszenie. Mail po `handed_off` nie ma undo wysyłki (wysyłka jest poza modułem).

### 0.3 Zdarzenia i subskrypcje

- Emitowane (tylko ID, bez treści szkicu): `crm_followups.run.finished`, `crm_followups.draft.created`, `crm_followups.draft.approved`, `crm_followups.draft.rejected`.
- Subskrypcje (`persistent: true`): `customers.interaction.created`, `customers.interaction.completed`, `customers.email.linked` (maile przychodzące i wychodzące — handler zapisuje interakcję `email` per osoba i nie emituje `interaction.created`), `customers.comment.created`, `customers.todo.created`, `customers.activity.created`, `customers.deal.updated` (tylko zmiana etapu), `customers.deal.won`, `customers.deal.lost`, `customers.deal.deleted`, `customers.person.deleted`, `customers.company.deleted` → komenda `crm_followups.drafts.supersede` dla otwartego szkicu obiektu (D174). Zdarzenie na osobie lub firmie zamyka też otwarte szkice deali, z którymi jest powiązana (`customer_deal_people`, `customer_deal_companies`; D172).
- Eventy są przyspieszeniem, nie jedynym mechanizmem: rekoncyliacja na początku przebiegu (§4.3) zamyka szkice, których event zginął.

### 0.4 Włączanie per organizacja (D47, D178)

Moduł włącza build (`apps/mercato/src/modules.ts`). W organizacji działa po ustawieniu `followups.enabled = true` (ModuleConfigService, `org:{id}:settings`, D69). `feature_toggles` tylko jako globalny wyłącznik per tenant.

`setup.ts` **nie** zakłada joba schedulera. Job `scheduled_jobs` organizacji zakłada komenda `crm_followups.settings.update` przy przełączeniu `followups.enabled` na `true`, a usuwa (soft delete) przy przełączeniu na `false` — wyłączona organizacja nie dostaje nocnych przebiegów.

**Przebieg przy `followups.enabled = false` (wybrany wariant, N16):** wyzwalacz spoza schedulera (webhook, agent, CLI) albo spóźniony job dostaje wpis `fu_runs` ze statusem `skipped` i `skip_reason = 'disabled'`, bez szkiców i bez powiadomień; endpoint zwraca ten `runId`. Powód: wywołujący (n8n, agent) widzi ślad i przyczynę, a ten sam `run_key` jest idempotentny. Menu i trasy szkiców przy wyłączonym module są zablokowane.

## 1. Rozpoznanie forka (read-only, `develop_OM_CRM` @ 41549820)

Zasada: najpierw istniejące moduły, nowe encje tylko tam, gdzie czegoś brakuje.

### 1.1 Co jest i czego używamy

| Obszar | Plik (permalink @41549820) | Wniosek |
|---|---|---|
| Deale | [`customers/data/entities.ts` l.301](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L301) (`customer_deals`: `status` `open`, `pipeline_id`, `pipeline_stage_id`, `owner_user_id` l.349, `closure_outcome` l.355, `deleted_at`) | przetarg w lejku = deal `open` bez `closure_outcome` w lejku „Przetargi” (D33) |
| Przejścia etapów | [`customer_deal_stage_transitions` l.389](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L389) (`transitioned_at` onCreate, `@Unique(deal, stageId)` l.392) | zmiana etapu liczy się jako aktywność (D172); powrót na odwiedzony etap nie tworzy wiersza (R-FU-10) |
| Interakcje (kanoniczne) | [`customer_interactions` l.540](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L540) (`status` domyślnie `planned` l.634, `scheduled_at` l.637, `occurred_at` l.640, `owner_user_id` l.649, `deal_id` l.661, `reminder_minutes` l.682) | źródło aktywności; zatwierdzone zadanie/przypomnienie zapisujemy tu komendą |
| Aktywności (legacy) | [`customer_activities` l.490](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L490) (`occurred_at` l.515) | liczymy jako aktywność, dopóki dane legacy istnieją |
| Todo | [`customer_todo_links` l.1021](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L1021), `commands/todos.ts`, `lib/todoCompatibility.ts` (warstwa zgodności nad interakcjami `task`); event `customers.todo.created` | todo = interakcja `task`: liczy się jako aktywność (§3.2), zaplanowane todo pomija obiekt; zatwierdzone zadanie to interakcja `interaction_type = 'task'`, widoczna w widżecie todo (D171) |
| Maile powiązane z CRM | [`lib/link-channel-message-handler.ts` l.240–248, l.573](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/lib/link-channel-message-handler.ts#L240) | mail wysłany/odebrany = interakcja `email` **per osoba, bez `deal_id`**; event `customers.email.linked`, nie `interaction.created` → subskrypcja (§0.3) i liczenie przez osoby deala (§3.2) |
| Komentarze | [`customer_comments` l.722](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L722) | notatka handlowca = aktywność |
| Kontakty | [`customer_entities` l.8](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L8) (`owner_user_id` l.51, `lifecycle_stage` l.63, `next_interaction_at` l.75); powiązania deal↔osoba/firma l.439, l.470 (`customer_deal_people`, `customer_deal_companies`, `created_at`) | kontakt = osoba albo firma; adresat maila z `customer_deal_people`; aktywność osób i firm deala liczy się dla deala od daty powiązania (D172) |
| Próg „utknięcia” | [`customer_settings.stuck_threshold_days` l.848](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/entities.ts#L848), [`lib/stuckDeals.ts` l.9, l.41](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/lib/stuckDeals.ts#L9) (`STUCK_DEFAULT_THRESHOLD_DAYS = 14`, `fetchStuckDealIds`) | bezpośredni precedens liczenia bezczynności per organizacja; ta sama wartość domyślna |
| Statusy interakcji | [`lib/interactionStatus.ts` l.16](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/lib/interactionStatus.ts#L16) | nieznany status = otwarty; dlatego szkiców **nie** trzymamy jako interakcji ze statusem `draft` (zaśmieciłyby licznik otwartych aktywności z [`data/enrichers.ts` l.64](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/data/enrichers.ts#L64) i `next_interaction_at`) |
| Zapis interakcji | [`lib/legacyActivityBridge.ts`](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/lib/legacyActivityBridge.ts) (komenda `customers.interactions.create`) | wzorzec zapisu zadania po zatwierdzeniu |
| Wysyłka maila przez użytkownika | [`api/people/[id]/emails/route.ts` l.23, l.27, l.122](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/api/people/%5Bid%5D/emails/route.ts#L23) (`customers.email.compose`, schemat bez dodatkowych pól, `sendAsUserService`) | zatwierdzony mail trafia do tego okna; wysyła użytkownik ze swojej skrzynki |
| ACL `customers` | [`customers/acl.ts` l.17, l.28, l.35, l.69, l.83](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/acl.ts#L69) | zatwierdzenie wymaga też uprawnień celu (D179) |
| Eventy `customers` | [`customers/events.ts` l.39, l.55, l.72, l.74](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/events.ts#L72) | subskrypcje „pojawiła się aktywność” (§0.3) |
| Worker | [`customers/workers/deals-bulk-update-owner.ts`](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/workers/deals-bulk-update-owner.ts) | wzorzec `WorkerMeta` + kolejka |
| Scheduler | [`scheduler/data/entities.ts` l.3, l.18, l.33, l.36](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/scheduler/src/modules/scheduler/data/entities.ts#L3) (`scope_type`, `timezone`, `target_type` queue/command); [`workers/execute-schedule.worker.ts` l.247](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/scheduler/src/modules/scheduler/workers/execute-schedule.worker.ts#L247) i [`lib/queueTargetPayload.ts` l.35](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/scheduler/src/modules/scheduler/lib/queueTargetPayload.ts#L35) (klucz idempotencji przebiegu); [`lib/safeQueueTargets.ts` l.198](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/scheduler/src/modules/scheduler/lib/safeQueueTargets.ts#L198) i [`queue/src/types.ts` l.316–321](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/queue/src/types.ts#L316) (`schedulerSafe`, `schedulerRequiredFeatures`) | cron = istniejący moduł, nie własny harmonogram |
| Włączone moduły | [`apps/mercato/src/modules.ts` l.71–102](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/apps/mercato/src/modules.ts#L71) | **`scheduler`, `workflows`, `inbox_ops` nie są włączone** (zgodnie z D94); `notifications` l.94, `progress` l.95, `messages` l.97, `communication_channels` l.101, `ai_assistant` l.102, `audit_logs` l.82 są |
| Propozycje do akceptacji | [`inbox_ops/data/entities.ts` l.216, l.227, l.295](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/inbox_ops/data/entities.ts#L216) (`inbox_proposals`, wymagane `inbox_email_id`; akcja `draft_reply` l.57) | dobry wzorzec UX zatwierdź/odrzuć; jako magazyn się nie nadaje (wiązanie z mailem przychodzącym, moduł wyłączony) |
| Powiadomienia | [`notifications/lib/notificationService.ts` l.236, l.239](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/notifications/lib/notificationService.ts#L236) (`create`, `createForFeature`) | notka z przebiegu do użytkowników (D182) |
| Postęp zadań | [`progress/data/entities.ts` l.8, l.54](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/progress/data/entities.ts#L8) (`result_summary`) | rozważony jako miejsce notki; odrzucony (§2.3) |
| LLM | [`ai_assistant/lib/model-factory.ts` l.587](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/ai-assistant/src/modules/ai_assistant/lib/model-factory.ts#L587) (`createModelFactory`, `OM_AI_PROVIDER`, SDK `ai` już w repo); [`inbox_ops/lib/llmProvider.ts` l.58](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/inbox_ops/lib/llmProvider.ts#L58) to ścieżka legacy w wyłączonym module — nie importujemy | wariant LLM nie wymaga nowej paczki, ale wymaga klucza dostawcy i wysyła dane CRM na zewnątrz → pytanie do Marka (Q-FU-1) |
| Szyfrowanie danych | [`customers/encryption.ts` l.20, l.30](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/customers/encryption.ts#L20) (`customer_entity.display_name`, `customer_deal.title`) | `target_label_snapshot`, `payload` i adres odbiorcy szkicu w mapie szyfrowania modułu (D183) |
| Strategia kolejki | [`docker-compose.fullapp.yml` l.245](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/docker-compose.fullapp.yml#L245) (`QUEUE_STRATEGY` domyślnie `local`) | `local` = polling Postgresa, jedna instancja; `async` = Redis/BullMQ — wybór na open-mercato.pl to warunek etapu kodu (D180, R-FU-2) |
| Ustawienia | [`configs/lib/module-config-service.ts`](https://github.com/AdamskiMarek/open-mercato/blob/41549820a198aea08a0ab9f36271a704439889cd/packages/core/src/modules/configs/lib/module-config-service.ts) | ustawienia firmy jak w costingu (D69) |

### 1.2 Czego brakuje (dlatego nowe tabele)

- Brak bytu „szkic follow-upu” z decyzją człowieka niezwiązanego z mailem przychodzącym → `fu_drafts`.
- Brak rejestru przebiegów z kluczem idempotencji dla wyzwalaczy spoza schedulera → `fu_runs`.
- Brak encji leada w forku (spec `.ai/specs/2026-04-03-customers-lead-funnel.md` nie jest wdrożony). Lead w Klin = deal na etapie `result_lead` lejka „Przetargi” (D33, D34); zakres kontaktów i leadów = pytania Q-FU-2, Q-FU-3.

## 2. Model danych

### 2.1 Konwencje

Każda tabela: `id uuid`, `organization_id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete). Zero twardo wpisanych UUID. Wszystkie zapytania filtrują po `organization_id` i `tenant_id` (D178).

### 2.2 `fu_drafts` — szkic follow-upu

| Kolumna | Typ | Uwagi |
|---|---|---|
| `run_id` | uuid FK `fu_runs` | przebieg, który utworzył szkic |
| `target_type` | text CHECK `deal \| person \| company` | obiekt CRM |
| `target_id` | uuid | ID obiektu (bez FK między modułami) |
| `target_label_snapshot` | text (szyfrowany) | nazwa obiektu w chwili utworzenia (D183) |
| `kind` | text CHECK `email \| task \| reminder` | D177 |
| `status` | text CHECK `open \| approved \| handed_off \| rejected \| superseded` | D174–D176 |
| `assignee_user_id` | uuid NULL | właściciel obiektu (`owner_user_id`); brak albo właściciel nieaktywny/usunięty → NULL = kolejka administratorów (D179) |
| `last_activity_at` | timestamptz | snapshot wyliczenia D172 |
| `inactivity_threshold` | int | N użyte w przebiegu |
| `content_source` | text CHECK `template \| llm` | D184 |
| `template_key` | text NULL | |
| `payload` | jsonb (szyfrowany) | mail: `toEntityId`, `toAddress`, `subject`, `body`; zadanie: `title`, `body`, `scheduledAt`; przypomnienie: `title`, `scheduledAt`, `reminderMinutes`, `termSource` |
| `decided_at`, `decided_by_user_id` | NULL | ustawiane przy `approved`, `handed_off`, `rejected`; nie przy `superseded` |
| `superseded_reason` | text NULL CHECK `activity \| not_eligible \| reconciled` | event czy rekoncyliacja (D174) |
| `muted_until` | timestamptz NULL | ustawiane przy odrzuceniu (D175) |
| `result_interaction_id` | uuid NULL | interakcja z zatwierdzenia (D176) |

Indeksy: częściowy unikalny `(organization_id, target_type, target_id) WHERE status = 'open' AND deleted_at IS NULL` (D174); `(organization_id, assignee_user_id, status)`; `(organization_id, run_id)`.

Szkic zawiera dane osobowe (RODO): `payload` (w tym adres odbiorcy) i `target_label_snapshot` są w mapie szyfrowania modułu, tak jak `customer_entity.display_name` i `customer_deal.title` w `customers`; poza `query_index` i wyszukiwaniem; w eventach i snapshotach komend tylko ID. Logger workera i komend zapisuje tylko ID, statusy i liczniki — nigdy treści, adresów ani nazw obiektów (D183).

### 2.3 `fu_runs` — przebieg i notka (D180, D182)

| Kolumna | Typ | Uwagi |
|---|---|---|
| `run_key` | text | unikalny `(organization_id, run_key)` |
| `trigger_source` | text CHECK `scheduler \| webhook \| agent \| cli` | |
| `status` | text CHECK `running \| finished \| failed \| skipped` | |
| `skip_reason` | text NULL CHECK `disabled \| concurrent` | przy `skipped` (D180, §0.4) |
| `started_at`, `finished_at` | timestamptz | |
| `counters` | jsonb | `scanned`, `created` per `kind` i `target_type`, `superseded_reconciled`, `skipped_open_draft`, `skipped_muted`, `skipped_planned`, `skipped_contact_has_deal_draft`, `skipped_limit`, `errors` |
| `note` | text | krótka notka (D182) |

Indeksy: unikalny `(organization_id, run_key)`; częściowy unikalny `(organization_id) WHERE status = 'running' AND deleted_at IS NULL` — jeden przebieg na organizację naraz (D180).

Dlaczego nie `progress_jobs.result_summary`: ProgressJob opisuje zadanie uruchomione przez użytkownika i znika z widoku po zakończeniu; przebieg nocny nie ma użytkownika, a `run_key` musi być unikalny per organizacja w bazie. Dlaczego nie interakcje ze statusem `draft`: §1.1 (statusy interakcji).

## 3. Wykrywanie bezczynności (D172, D173)

### 3.1 Obiekty (D173)

| Typ | Warunek bazowy | Parametr |
|---|---|---|
| Przetarg w lejku | `customer_deals.status = 'open'`, `closure_outcome IS NULL`, `deleted_at IS NULL`, lejek z `followups.deal_pipeline_ids`, etap z `followups.deal_stage_keys` | domyślne etapy = Q-FU-3 |
| Lead | deal na etapie `result_lead` lejka „Przetargi” (D33), o ile etap jest na liście `followups.deal_stage_keys` (to zwykły deal z wiersza wyżej) | Q-FU-3 |
| Kontakt | `customer_entities` (osoba/firma), `deleted_at IS NULL`, wg `followups.contact_scope` i opcjonalnie `followups.contact_lifecycle_stages` (`lifecycle_stage`) | Q-FU-2 |

**Przetarg z częściami i nakładanie się deal/kontakt — wariant tymczasowy do odpowiedzi na Q-FU-5 (D173):**

- Każda część to osobny deal (D31, D132), więc dostaje osobny szkic. Bez grupowania po `tender_notice_number` — wymagałoby zależności od `project_costing` (`pc_investments`), sprzecznej z kierunkiem zależności.
- Przebieg najpierw tworzy szkice deali, potem kontaktów. Szkic kontaktu (osoby) jest pomijany (`skipped_contact_has_deal_draft`), jeśli ta osoba ma już w tym przebiegu szkic deala: jest w `customer_deal_people` deala, który dostał szkic, albo jest adresatem jego maila. Firma analogicznie przez `customer_deal_companies`.
- Jedna osoba może w tym wariancie dostać kilka szkiców deali jednej nocy (po jednym na część). Limit na osobę to pytanie Q-FU-5.

### 3.2 Definicja aktywności (D172)

`last_activity_at` obiektu = maksimum z:

1. `customer_interactions` powiązanych z obiektem (deal: `deal_id`; kontakt: `entity_id`), bez usuniętych: `occurred_at` dla zakończonych, `created_at` dla pozostałych (obejmuje maile przychodzące i wychodzące zapisane jako interakcje `email` oraz todo — interakcje `task`);
1a. **dla deala także** interakcje (w tym maile, które handler zapisuje per osoba bez `deal_id`) i komentarze osób z `customer_deal_people` oraz firm z `customer_deal_companies` tego deala, liczone od `created_at` powiązania (wcześniejsza korespondencja z tą osobą nie dotyczy deala);
2. `customer_activities` (legacy): `occurred_at`, a gdy brak — `created_at`;
3. `customer_comments` obiektu: `created_at`;
4. dla deala: ostatnie `customer_deal_stage_transitions.transitioned_at` (jak `stuckDeals.ts`); uwaga: `@Unique(deal, stageId)` — powrót na wcześniej odwiedzony etap nie tworzy wiersza i nie odświeża daty (R-FU-10);
5. data utworzenia obiektu (gdy brak 1–4);
6. ostatnia decyzja o szkicu tego obiektu (`fu_drafts.decided_at`) — odrzucenie, zatwierdzenie i przekazanie maila do wysyłki (`handed_off`) resetują licznik (D175, §5.2).

**Nie** liczymy `updated_at` deala ani kontaktu: push z n8n i automatyczne zmiany pól (D34) aktualizują rekord bez kontaktu z klientem.

Obiekt kwalifikuje się, gdy `now − last_activity_at ≥ N` (N = `followups.inactivity_days`, dni kalendarzowe w strefie `followups.timezone`, liczone jak w `lib/localDay.ts`) **i** nie ma zaplanowanej przyszłej interakcji w statusie nieterminalnym (todo, spotkanie, telefon z `scheduled_at ≥ now`; dla deala także na osobach i firmach deala). Zaplanowana przyszła interakcja liczy się jako aktywność — następny krok już jest, więc obiekt jest pomijany (`skipped_planned`).

### 3.3 Kolejność i limity

Kolejność kroków przebiegu: (1) rekoncyliacja otwartych szkiców (§4.3); (2) deale; (3) kontakty z pominięciem osób/firm ze szkicem deala w tym przebiegu (§3.1). W obrębie typu obiekty sortowane rosnąco po `last_activity_at` (najdłużej zaniedbane najpierw). Limit `followups.max_drafts_per_run` (domyślnie 200 na przebieg na firmę) i twardy limit instancji (§8.1); obiekty ponad limit liczone w `skipped_limit` i podane w notce (§9), dostaną szkic w kolejnym przebiegu. Przetwarzanie partiami (`OM_CRM_FOLLOWUPS_SCAN_BATCH_SIZE`), zapytania z indeksami po `organization_id`.

## 4. Szkice (D174, D177, D184)

### 4.1 Rodzaj szkicu (D177)

Reguła domyślna, w kolejności:

1. **przypomnienie o terminie** — gdy deal ma termin w horyzoncie `followups.reminder_horizon` (domyślnie 7, w dniach kalendarzowych): `expected_close_at` albo termin składania ofert z pola własnego deala o kluczu `followups.reminder_term_field_key` (domyślnie `cf_offer_deadline`; definicja pola rozwiązywana po kluczu, bez UUID; brak pola → tylko `expected_close_at`); szkic interakcji z `scheduled_at` przed terminem i `reminder_minutes`;
2. **mail** — gdy obiekt ma osobę kontaktową z adresem e-mail (osoba bezpośrednio, dla deala z `customer_deal_people`, dla firmy osoba powiązana) **i** właściciel ma podłączoną skrzynkę (`communication_channels`);
3. **zadanie** — w każdym innym przypadku („zadzwoń / sprawdź status”).

Kolejność rodzajów zostaje (Cezar 2026-10-31). Lista dozwolonych rodzajów per firma: `followups.kinds`. Przypomnienie powstaje dziś tylko dla obiektu bezczynnego; czy ma działać niezależnie od bezczynności (aktywny deal z terminem jutro) — Q-FU-6.

### 4.2 Treść (D184)

Szablony per `kind` × `target_type`, i18n pl/en w kodzie modułu, nadpisywalne w ustawieniach firmy (`followups.templates`). Zmienne: nazwa obiektu, kontakt, etap, liczba dni bez aktywności, termin, właściciel. Bez nowych zależności. Wariant LLM tylko po decyzji Marka (Q-FU-1); technicznie przez współdzieloną fabrykę modeli `ai_assistant` (`createModelFactory`, `OM_AI_PROVIDER`), z fallbackiem na szablon. Bez importu z `inbox_ops/lib/llmProvider.ts` — moduł wyłączony, a import łamałby kierunek zależności. **D184 zależy od Q-FU-1.**

### 4.3 Idempotencja szkiców (D174)

- Najwyżej jeden otwarty szkic na obiekt: częściowy unikalny indeks (§2.2). Kolejny przebieg pomija obiekt z otwartym szkicem (`skipped_open_draft`).
- Pojawienie się aktywności (§0.3, w tym `customers.email.linked`, `customers.comment.created`, `customers.todo.created`) zamyka otwarty szkic jako `superseded` (`superseded_reason = 'activity'`) — szkic przestał być potrzebny.
- **Rekoncyliacja na początku każdego przebiegu:** zanim worker policzy kandydatów, zamyka jako `superseded` każdy otwarty szkic organizacji, którego obiekt ma aktywność (§3.2) nowszą niż `created_at` szkicu (`reconciled`) albo przestał się kwalifikować — deal zamknięty lub usunięty, obiekt poza zakresem ustawień (`not_eligible`). Zgubiony event nie zostawia wiszącego szkicu, a częściowy unikalny indeks nie blokuje nowego. Licznik `superseded_reconciled`.
- Powtórzenie tego samego przebiegu (`run_key`) nie tworzy nic nowego (D180).

## 5. Decyzja użytkownika (D175, D176)

### 5.1 Lista szkiców

Strona `/backend/crm-followups` (DataTable z `packages/ui`): filtry status, rodzaj, typ obiektu, przebieg; domyślnie „moje otwarte”. Widget na karcie deala/kontaktu przez spot zakładek `customers` pokazuje otwarty szkic obiektu. Edycja treści przed zatwierdzeniem dozwolona (komenda `crm_followups.drafts.update`, tylko sesja użytkownika).

### 5.2 Zatwierdzenie (D176)

- **Zadanie / przypomnienie:** komenda `crm_followups.drafts.approve` wywołuje przez CommandBus `customers.interactions.create` (`interaction_type = 'task'` dla zadania, status `planned`, `scheduled_at`, `reminder_minutes`, powiązanie z dealem/kontaktem). `owner_user_id` = właściciel obiektu; autor (aktor komendy, audyt) = zatwierdzający. Obiekt bez właściciela albo z właścicielem nieaktywnym/usuniętym → `owner_user_id` = zatwierdzający. Szkic → `approved`, `result_interaction_id`.
- **Mail:** szkic → `handed_off`; UI otwiera istniejące okno wysyłki CRM dla osoby (trasa `POST /api/customers/people/[id]/emails`) z wypełnionym tematem i treścią. Wysyła użytkownik, ze swojej skrzynki i ze swoim uprawnieniem `customers.email.compose`. Moduł `crm_followups` nie ma dostępu do `sendAsUserService` ani innej ścieżki wysyłki. Zapis wysłanego maila jako interakcji resetuje licznik (D172). `handed_off` ≠ wysłane: jeśli użytkownik porzuci okno wysyłki, mail nie wychodzi, a obiekt i tak milczy przez N od decyzji (`decided_at`, §3.2 pkt 6) — świadomie: decyzja „zajmę się tym” należała do człowieka. Notka i liczniki mówią „przekazano do wysyłki”, nigdy „wysłano” (D182).
- **Tylko sesja użytkownika:** approve, reject, `PATCH` i reassign wymagają sesji zalogowanego użytkownika; wywołanie kluczem API (n8n, agent) → 403 niezależnie od przypisanych uprawnień. Klucz API dostaje wyłącznie `crm_followups.run` — w szczególności **nie** `customers.email.compose`, więc nie wyśle maila także istniejącą trasą osoby (D179).
- Brak autowysyłki obejmuje też powiadomienia: typ powiadomienia modułu ma tylko kanał in-app (bez strategii e-mail).

### 5.3 Odrzucenie i wyciszenie (D175)

Odrzucenie: status `rejected`, powód opcjonalny (metadane komendy), `muted_until = decided_at + followups.mute_days`. `mute_days` to parametr firmy: domyślnie = N (14), minimum 1 (Cezar 2026-10-31). Obiekt wraca do kolejki, gdy minie `muted_until` **i** od ostatniej aktywności (z decyzją włącznie, §3.2 pkt 6) upłynie N. Nowa aktywność po odrzuceniu zeruje licznik, więc kolejny szkic pojawi się najwcześniej po N od tej aktywności. Ponieważ decyzja liczy się jako aktywność, przy `mute_days ≤ N` decyduje N; `mute_days > N` wydłuża ciszę po odrzuceniu (np. firma chce dłużej nie wracać do odrzuconego przetargu).

## 6. Uprawnienia (ACL) (D179)

| Feature | employee | admin | Opis |
|---|---|---|---|
| `crm_followups.view` | tak | tak | lista szkiców przypisanych do mnie |
| `crm_followups.drafts.decide` | tak | tak | zatwierdzanie/odrzucanie moich szkiców |
| `crm_followups.drafts.manage_all` | — | tak | wszystkie szkice organizacji, szkice bez właściciela, przepisanie |
| `crm_followups.settings.manage` | — | tak | ustawienia §8 |
| `crm_followups.run` | — | tak | ręczne uruchomienie przebiegu, klucz API dla n8n/agenta, `schedulerRequiredFeatures` |

Zatwierdzenie wymaga dodatkowo uprawnień celu: zadanie/przypomnienie — `customers.interactions.manage`; mail — `customers.email.compose`; widok obiektu — `customers.deals.view` albo `customers.people.view` / `customers.companies.view`. Granty domyślne w `setup.ts`. Role tylko OM (superadmin/admin/employee). Czy handlowiec widzi szkice cudzych obiektów — Q-FU-4.

- **Obiekt bez właściciela** (lub właściciel nieaktywny/usunięty): szkic dla administratorów (`assignee_user_id = NULL`, widok przez `manage_all`); D179 bez zmian, widoczność dla innych zależy od Q-FU-4.
- **Klucze API (n8n, agent):** wyłącznie `crm_followups.run`. Bez `crm_followups.drafts.*`, bez `crm_followups.settings.manage` i bez `customers.email.compose`. Trasy decyzji odrzucają klucz API (403) niezależnie od uprawnień (§5.2).
- **404 vs 403 (jak D147):** szkic cudzy bez `crm_followups.drafts.manage_all` → 404, tak jak szkic nieistniejący i szkic innej organizacji (odpowiedź nie ujawnia istnienia). Brak feature'a modułu → 403.

## 7. API i wyzwalacze (D180)

| Metoda i ścieżka | Feature | Opis |
|---|---|---|
| `POST /api/crm-followups/runs` | `crm_followups.run` | uruchomienie przebiegu dla organizacji z kontekstu; nagłówek `Idempotency-Key` wymagany (→ `run_key`); ten sam klucz zwraca istniejący przebieg; kolejkuje pracę i od razu zwraca `runId` |
| `GET /api/crm-followups/runs` | `crm_followups.view` | lista przebiegów z notką |
| `GET /api/crm-followups/drafts` | `crm_followups.view` | `makeCrudRoute`, filtry §5.1, scope wg D179 |
| `PATCH /api/crm-followups/drafts/:id` | `crm_followups.drafts.decide`, tylko sesja | edycja treści otwartego szkicu; klucz API → 403 |
| `POST /api/crm-followups/drafts/:id/approve` | `crm_followups.drafts.decide` + cel, tylko sesja | D176; klucz API → 403 |
| `POST /api/crm-followups/drafts/:id/reject` | `crm_followups.drafts.decide`, tylko sesja | D175; klucz API → 403 |
| `POST /api/crm-followups/drafts/:id/reassign` | `crm_followups.drafts.manage_all`, tylko sesja | zmiana adresata szkicu |
| `GET/PATCH /api/crm-followups/settings` | `crm_followups.settings.manage`, `PATCH` tylko sesja | §8 |

Wszystkie trasy z `openApi`, zod i mutation guards. Szkic cudzy bez `manage_all` → 404, brak feature'a → 403 (§6).

Wyzwalacze (wszystkie kończą w tej samej kolejce `crm-followups-scan`):

1. **Cron:** moduł `scheduler`, `scheduled_jobs` z `scope_type = organization`, `target_type = queue`, `target_queue = crm-followups-scan`, `schedule_value = 0 3 * * *`, `timezone` = `followups.timezone` (domyślnie `Europe/Warsaw`; encja ma domyślnie `UTC`, więc strefę zawsze ustawia komenda). Job zakłada i usuwa komenda `crm_followups.settings.update` przy przełączeniu `followups.enabled` (§0.4); godzinę zmienia administrator w schedulerze — jedyne źródło godziny. Worker ma `schedulerSafe: true` i `schedulerRequiredFeatures: ['crm_followups.run']`. `run_key` = klucz idempotencji schedulera (`_idempotencyKey`). Warunek wstępny etapu kodu: włączenie `scheduler` w `apps/mercato/src/modules.ts` (moduł jest w repo; dziś wyłączony, D94) — za zgodą Marka; to samo włączenie obsłuży job dzienny kursów z D89. Do tego wybór strategii na open-mercato.pl: `QUEUE_STRATEGY=local` (domyślnie w compose l.245; polling Postgresa, przeznaczony do developmentu, jedna instancja) albo `async` (Redis/BullMQ).
2. **Webhook / inny agent / n8n:** `POST /api/crm-followups/runs` z kluczem API (moduł `api_keys` jest włączony; klucz tylko z `crm_followups.run`) i `Idempotency-Key`. Bez schedulera to jest droga zastępcza dla crona (n8n o 03:00).
3. **CLI:** `mercato crm_followups run --org <id> --key <run_key>` dla administratora instancji.

Worker nie planuje sam kolejnych uruchomień.

**Współbieżność i ponowienia (D180):**

- Jeden przebieg na organizację naraz przez częściowy unikalny indeks `fu_runs (organization_id) WHERE status = 'running'` (§2.3), a nie blokadę doradczą — działa przy puli połączeń i przeżywa restart procesu.
- Równoległy wyzwalacz z innym `run_key` zapisuje wiersz `skipped` z `skip_reason = 'concurrent'` i kończy.
- Ten sam `run_key`: `finished` albo `skipped` → zwrot istniejącego przebiegu bez pracy; `failed` → wznowienie tego samego wiersza (status `running`); `running` starszy niż `OM_CRM_FOLLOWUPS_RUN_STALE_MINUTES` → oznaczenie `failed` i wznowienie; świeży `running` → zwrot istniejącego. Wznowienie jest bezpieczne: rekoncyliacja + częściowy unikalny indeks szkiców nie dopuszczą duplikatów.

## 8. Ustawienia firmy (ModuleConfigService, `org:{id}:settings`, D69, D181)

| Klucz | Typ | Domyślnie | Uwagi |
|---|---|---|---|
| `followups.enabled` | bool | `false` | włącznik per organizacja (§0.4) |
| `followups.inactivity_days` | int ≥ 1 | 14 | N (D170); ta sama wartość domyślna co `customer_settings.stuck_threshold_days` |
| `followups.mute_days` | int ≥ 1 | = N (14) | okres wyciszenia po odrzuceniu; działa, gdy > N (D175) |
| `followups.timezone` | text | `Europe/Warsaw` | jedno źródło strefy: liczenie dni, treść i `scheduled_jobs.timezone` joba (komenda ustawień synchronizuje) |
| `followups.target_types` | `deal \| person \| company`[] | wszystkie | D173 |
| `followups.deal_pipeline_ids` | uuid[] | lejek „Przetargi” rozwiązany po kluczu przy `setup` | bez twardych UUID |
| `followups.deal_stage_keys` | text[] | Q-FU-3 | |
| `followups.contact_scope` | enum | Q-FU-2 | |
| `followups.contact_lifecycle_stages` | text[] | Q-FU-2 | |
| `followups.kinds` | `email \| task \| reminder`[] | wszystkie | D177 |
| `followups.reminder_horizon` | int ≥ 1 | 7 | horyzont terminu dla przypomnień, w dniach kalendarzowych (D177) |
| `followups.reminder_term_field_key` | text NULL | `cf_offer_deadline` | klucz pola własnego deala z terminem składania ofert; rozwiązywany po kluczu, brak pola → tylko `expected_close_at` |
| `followups.max_drafts_per_run` | int ≥ 1 | 200 | na przebieg na firmę; nadmiar w `skipped_limit` i w notce (§9) |
| `followups.content_mode` | `template \| llm` | `template` | `llm` zablokowane do decyzji Q-FU-1 |
| `followups.templates` | json | szablony w kodzie | nadpisania treści |

Godzina crona nie jest ustawieniem firmy w `module_configs`: żyje w `scheduled_jobs` (D180), żeby nie mieć dwóch źródeł. Strefa ma jedno źródło: `followups.timezone`; komenda ustawień przepisuje ją do joba. Ustawienia nie dublują RBAC. Brak sekretów w ustawieniach.

### 8.1 Parametry instancji (env)

Ustawia administrator instancji (env serwera, Dokploy), nie organizacja; nie trafiają do `module_configs`.

| Parametr | Typ | Domyślnie | Uwagi |
|---|---|---|---|
| `OM_CRM_FOLLOWUPS_ENABLED` | bool | `true` | globalny wyłącznik workera na instancji |
| `OM_CRM_FOLLOWUPS_SCAN_BATCH_SIZE` | int | 500 | rozmiar partii odczytu obiektów |
| `OM_CRM_FOLLOWUPS_MAX_DRAFTS_PER_RUN` | int | 1000 | twardy limit instancji; wygrywa z ustawieniem firmy |
| `OM_CRM_FOLLOWUPS_WORKER_CONCURRENCY` | int | 1 | współbieżność workera w procesie `queue worker --all` (D115) |
| `OM_CRM_FOLLOWUPS_RUN_STALE_MINUTES` | int | 60 | po tylu minutach przebieg `running` uznany za porzucony i wznawiany (D180) |
| `OM_AI_PROVIDER` (+ klucz dostawcy) | istniejące | — | używane tylko, jeśli Q-FU-1 = LLM; klucz wyłącznie w env, nigdy w repo, logach ani ustawieniach |

## 9. Notka z przebiegu (D182)

Po każdym przebiegu komenda `crm_followups.runs.finish` zapisuje w `fu_runs.note` np. „Utworzono 12 szkiców (5 maili do przejrzenia, 6 zadań, 1 przypomnienie). Zamknięto 3 nieaktualne szkice. Pominięto: 30 z otwartym szkicem, 4 wyciszone, 2 kontakty ze szkicem deala, 15 ponad limit 200 (będą w kolejnym przebiegu). Lista: /backend/crm-followups?runId=…”. Słownictwo: szkic maila jest „do przejrzenia”, a zatwierdzony — „przekazany do wysyłki”; notka nigdy nie mówi „wysłano” (`handed_off` ≠ wysłane, §5.2). Następnie `notificationService.create` wysyła powiadomienie in-app do każdego `assignee_user_id` z liczbą jego szkiców i linkiem, a `createForFeature` (`crm_followups.drafts.manage_all`) — do administratorów, gdy są szkice bez właściciela. Przebieg z zerem szkiców: notka w `fu_runs`, bez powiadomień. Przebieg `skipped` (§0.4, §7): notka z powodem, bez powiadomień. Lista przebiegów jest w module (`/backend/crm-followups/runs`).

## 10. Audyt (D183)

Wszystkie zapisy przez komendy → `action_logs` (`audit_logs`); bez własnej tabeli audytu. Komendy systemowe przebiegu oznaczone `trigger_source` i `run_id` w metadanych. W snapshotach komend i payloadach eventów tylko ID i statusy, bez treści maili. Wywołanie `POST /api/crm-followups/runs` kluczem API ma w audycie `keyId`. Logger (worker, komendy) tylko ID, statusy i liczniki — bez treści, adresów i nazw obiektów (§2.2).

## 11. Fazy (bez estymat, P11)

- **v2 (całość tej speki):** moduł, wykrywanie, szkice szablonowe, decyzje, wyzwalacze, notka, ACL, audyt.
- **Po decyzji Q-FU-1:** wariant LLM za `followups.content_mode`.

## 12. Risks (Ryzyka — z ryzykiem rezydualnym)

| # | Ryzyko | Skutek | Środek | Ryzyko rezydualne |
|---|---|---|---|---|
| R-FU-1 | Zalew szkiców przy pierwszym przebiegu (wiele starych przetargów z n8n) | użytkownik ignoruje listę | limity §8 i §8.1, sortowanie po zaniedbaniu, domyślne etapy wg Q-FU-3 | niskie |
| R-FU-2 | `scheduler` wyłączony w forku; strategia `local` to polling jednej instancji | brak crona albo zawodny cron | warunek wstępny etapu kodu za zgodą Marka (D94, D89); wybór `QUEUE_STRATEGY` (`async` = Redis); droga zastępcza: n8n → endpoint | niskie |
| R-FU-3 | Fałszywa aktywność (automatyczne zmiany deala) blokuje szkice | brak follow-upu | `updated_at` nie liczy się (D172) | niskie |
| R-FU-4 | Mail wysłany albo szkic zatwierdzony bez decyzji człowieka (w tym automat z kluczem API: n8n, agent) | naruszenie D170 | moduł nie ma ścieżki wysyłki; powiadomienia tylko in-app; approve/reject/`PATCH`/reassign tylko z sesji użytkownika; klucz API ma wyłącznie `crm_followups.run`, bez `customers.email.compose`; testy negatywne w planie: (1) brak ścieżki wysyłki w module, (2) approve, reject i `PATCH` kluczem API → 403 i szkic bez zmian, (3) klucz API na `POST /api/customers/people/[id]/emails` → 403 | bardzo niskie |
| R-FU-5 | Wyciek danych między organizacjami | naruszenie izolacji | filtr org/tenant w każdym zapytaniu, przebieg per organizacja, scope z zaufanego payloadu schedulera | niskie |
| R-FU-6 | Wariant LLM wysyła dane osobowe do zewnętrznego dostawcy | RODO, koszt | domyślnie szablony; LLM tylko po decyzji Marka | zależne od Q-FU-1 |
| R-FU-7 | Dane legacy `customer_activities` i nowe interakcje liczone podwójnie | brak (maksimum, nie suma) | `max` z obu źródeł | brak |
| R-FU-8 | Obciążenie kontenera `app` (worker dzieli RAM, D115) | spowolnienie nocą | partie, współbieżność 1, pora nocna | niskie |
| R-FU-9 | Zgubiony event (restart, błąd subscribera) zostawia otwarty szkic mimo aktywności | szkic nieaktualny, indeks blokuje nowy | rekoncyliacja na początku każdego przebiegu (§4.3) | niskie |
| R-FU-10 | Powrót deala na wcześniej odwiedzony etap nie tworzy przejścia (`@Unique(deal, stageId)`) | sama zmiana etapu wstecz nie resetuje licznika | zwykle towarzyszy jej interakcja lub komentarz; akceptujemy (bez zmian w `customers`) | niskie |
| R-FU-11 | Osoba w kilku dealach: jej mail resetuje licznik wszystkich tych deali (§3.2 pkt 1a) | pominięty szkic deala, którego mail nie dotyczył | liczenie od daty powiązania; akceptujemy zamiast fałszywych szkiców przy bieżącej korespondencji | niskie |
| R-FU-12 | Kilka szkiców dla jednej osoby jednej nocy (przetarg z częściami) | szum dla handlowca | wariant tymczasowy §3.1; decyzja Q-FU-5 | zależne od Q-FU-5 |

## 13. Otwarte — pytania biznesowe do Marka

- **Q-FU-1 (treść szkicu):** (a) tylko szablony — bez kosztów i bez wysyłania danych na zewnątrz [rekomendacja techniczna na start]; (b) LLM — lepsza treść, koszt API i dane klientów u dostawcy AI; (c) szablon domyślnie, LLM na przycisk „popraw” przy szkicu.
- **Q-FU-2 (które kontakty):** (a) tylko osoby/firmy powiązane z otwartym dealem; (b) wszystkie kontakty z właścicielem; (c) kontakty z wybranym etapem cyklu życia (`lifecycle_stage`, np. lead/prospekt).
- **Q-FU-3 (które etapy lejka „Przetargi”):** (a) wszystkie otwarte, także `new`; (b) od `result_lead` w górę; (c) tylko `qualify`, `contact`, `offer`.
- **Q-FU-4 (kto widzi szkice):** (a) tylko właściciel obiektu + administrator; (b) wszyscy handlowcy w firmie.
- **Q-FU-5 (przetarg z częściami, nowe po review #33):** (a) szkic na każdą część (deal) — wariant tymczasowy w D173; (b) jeden szkic na postępowanie (wymaga sposobu grupowania części bez zależności od `project_costing`). Oraz: ile szkiców może dostać jedna osoba jednej nocy — (a) bez limitu (po jednym na deal); (b) najwyżej jeden, pozostałe pominięte do kolejnego przebiegu; (c) jeden szkic zbiorczy dla osoby.
- **Q-FU-6 (przypomnienie o terminie, nowe po review #33):** (a) tylko dla obiektów bezczynnych (stan D177); (b) niezależnie od bezczynności — aktywny deal z terminem w horyzoncie też dostaje szkic przypomnienia.

Pytania idą do Marka przez Koordynatora. Do odpowiedzi obowiązują warianty oznaczone w D173 (tymczasowy, Q-FU-5), D177 (Q-FU-6) i D184 (szablony, Q-FU-1).

Rozstrzygnięcia techniczne po review #33 (Cezar 2026-10-31 (techniczne)): `mute_days` = N, min 1; limit 200 szkiców na przebieg na firmę z liczbą pominiętych w notce; obiekt bez właściciela → administratorzy; właściciel zatwierdzonego zadania = właściciel obiektu, autor = zatwierdzający; zaplanowana przyszła interakcja = aktywność; kolejność rodzajów z D177 bez zmian; przebieg przy wyłączonym module = wpis `skipped`. Pytania techniczne: brak otwartych; źródła D171–D184 — Cezar 2026-10-31 (techniczne), D184 zależy od Q-FU-1.

## 14. Uwagi dla planu testów (niezależny plan, osobna sesja)

Plan testów pisze osobna sesja wyłącznie z decyzji (B1 z review #33 — poza tym PR). Szczególnie: rekoncyliacja i nowe eventy (D174), maile osób deala (D172), testy negatywne z kluczem API (D176, D179, R-FU-4), 404/403 (D179), wariant części (D173), `skipped` przy wyłączonym module i ponowienia `run_key` (D180). Pokrycia TC wymagają: D170, D172, D173, D174, D175, D176, D177, D178, D179, D180, D181, D182, D183, D184. D171 (architektura, wybór magazynu) — weryfikacja przeglądem kodu i checklistą, TC opcjonalny.

## 15. Migracje i backward compatibility

Nowe tabele `fu_*` tylko. Zero zmian w `packages/core` i w tabelach `customers`. Włączenie `scheduler` w buildzie to zmiana konfiguracji (moduł w repo), za zgodą Marka po „implementujemy”. Wyłączenie modułu nie zmienia danych CRM; szkice zostają w `fu_drafts`.

## 16. Szkielet plików modułu

```
apps/mercato/src/modules/crm_followups/
  index.ts  acl.ts  setup.ts  events.ts  di.ts  cli.ts
  data/entities.ts  data/validators.ts
  lib/inactivity.ts        # D172 (czysta funkcja + zapytania, wzór stuckDeals.ts)
  lib/draftKind.ts         # D177
  lib/templates.ts         # D184
  commands/runs.ts  commands/drafts.ts
  workers/scan.worker.ts   # schedulerSafe
  lib/reconcile.ts         # D174 (rekoncyliacja na starcie przebiegu)
  subscribers/supersede-on-activity.ts
  api/runs/route.ts  api/drafts/route.ts  api/drafts/[id]/approve/route.ts  api/drafts/[id]/reject/route.ts  api/drafts/[id]/reassign/route.ts  api/settings/route.ts
  backend/crm-followups/page.tsx  backend/crm-followups/runs/page.tsx
  widgets/injection/…      # zakładka/karta na deal i kontakt
  i18n/pl.json  i18n/en.json
  __tests__/  __integration__/
```

## 17. Final Compliance Report (vs `AGENTS.md`)

| Reguła | Stan |
|---|---|
| Moduł w `apps/mercato/src/modules`, bez zmian w `packages/core` | spełnione (§15) |
| Komunikacja między modułami przez DI, komendy, eventy, widgety; bez HTTP | spełnione (§0.1) |
| Zapisy komendami z undo, audyt `audit_logs` | spełnione (§0.2, §10) |
| `makeCrudRoute`, `openApi`, zod, mutation guards | spełnione (§7) |
| ACL w `acl.ts`, granty w `setup.ts`, role OM | spełnione (§6) |
| Ustawienia przez ModuleConfigService | spełnione (§8, D69) |
| Soft delete, scope org/tenant, bez twardych UUID | spełnione (§2) |
| Nowe zależności produkcyjne | brak; LLM bez nowej paczki, ale jako decyzja biznesowa (Q-FU-1) |
| Ciężka praca w workerze kolejki | spełnione (§7) |
| i18n pl/en | spełnione (§4.2, §16) |
| Testy: Jest `__tests__`, Playwright `__integration__` | do niezależnego planu (§14) |

## 18. Checklist compliance (`om-architecture-checklist.md`, stan 2026-10-31)

| Punkt | Wynik |
|---|---|
| Komunikacja przez DI/eventy, zero HTTP | ✅ §0.1 |
| Zależność jednokierunkowa | ✅ `crm_followups` → `customers` |
| Brak zapisów do cudzych tabel | ✅ zapis do `customers` tylko komendą `customers.interactions.create` |
| Zero twardych UUID | ✅ lejek rozwiązywany po kluczu |
| Jednoznaczne reguły w bazie (partial unique) | ✅ jeden otwarty szkic na obiekt; `run_key` unikalny; jeden `running` na organizację |
| Jedno pojęcie na byt | ✅ szkic ≠ interakcja |
| RBAC tylko w `acl.ts`, role OM | ✅ §6 |
| Ustawienia nie dublują RBAC | ✅ §8 |
| Ukryte dane szczelnie | ✅ treść szkicu i nazwa obiektu szyfrowane, poza indeksem, eventami, snapshotami i logami |
| Zapisy przez komendy, audyt | ✅ §0.2, §10 |
| `makeCrudRoute`, `openApi`, guards | ✅ §7 |
| Zapis minimalny / benchmark | n/d (brak sum i linii) |
| Soft delete | ✅ §2.1 |
| ModuleConfigService | ✅ §8 |
| Włączanie per organizacja + kill-switch | ✅ §0.4 |
| Firma = organizacja | ✅ D178 |
| Statusy deala zgodne z OM | ✅ `open` + `closure_outcome`, subskrypcje `won/lost` `persistent: true` |
| Zadania ciężkie w workerze | ✅ worker kolejki |
| Import XLSX/CSV | n/d |
| Nowe zależności „ask first” | ✅ brak; LLM jako pytanie Q-FU-1 |
| Najpierw to, co w repo | ✅ §1 |
| Numeracja, walidacje stawek, hierarchia, algorytmy harmonogramu | n/d |
| Narzut OM w wycenie | ✅ bez estymat (P11); wymagania w §7, §16 |
| Testy w `__tests__` / `__integration__` | ✅ §14, §16 |
| MVP po wartości | ✅ §11 |
| Sekcje TLDR, Architecture, Risks, Final Compliance Report | ✅ |

## 19. Decision traceability (śledzenie decyzji)

| D | Treść skrócona | Sekcje |
|---|---|---|
| D170 | funkcja: nocne szkice, N per firma, nic nie wychodzi samo, wyzwalacz z zewnątrz, notka | TLDR, §3, §5, §7, §9 |
| D171 | nowy moduł `crm_followups`, tabele `fu_*`, bez `inbox_ops` i bez interakcji `draft` | §0.1, §1, §2 |
| D172 | definicja aktywności (z osobami i firmami deala) | §3.2 |
| D173 | zakres obiektów; tymczasowa reguła części (Q-FU-5) | §3.1, §3.3 |
| D174 | idempotencja szkiców, `superseded`, rekoncyliacja | §0.3, §2.2, §4.3 |
| D175 | odrzucenie wycisza | §5.3 |
| D176 | zatwierdzenie bez autowysyłki, tylko sesja | §5.2, §7 |
| D177 | rodzaj szkicu | §4.1 |
| D178 | zakres org/tenant | §0.4, §2.1 |
| D179 | ACL, klucz API tylko `run`, 404/403 | §6 |
| D180 | wyzwalacze, `run_key`, współbieżność, job przy włączeniu | §0.4, §7 |
| D181 | parametry firmy i instancji | §8, §8.1 |
| D182 | notka z przebiegu | §9 |
| D183 | audyt | §10 |
| D184 | treść: szablony, LLM po decyzji Marka (zależy od Q-FU-1) | §4.2 |

Powiązane wcześniejsze: D33, D34 (lejek „Przetargi”), D47 (włączanie per organizacja), D69 (klucz ustawień), D31, D132 (przetarg z częściami), D89 (job dzienny), D94 (`scheduler` opcjonalny, wyłączony w forku), D115 (workery w kontenerze `app`), D147 (404/403).

## Changelog

- 2026-10-31 rev 1 — pierwsza wersja (v2): rozpoznanie forka @41549820, D170–D184, pytania Q-FU-1…Q-FU-4.
- 2026-10-31 rev 2 — review PR #33 (Cezar): B2 rekoncyliacja + eventy `email.linked`/`comment.created`/`todo.created`; B3 maile i interakcje osób deala; B4 decyzje tylko z sesji, klucz API tylko `run`, R-FU-4; B5 tymczasowa reguła części (Q-FU-5); N1–N16; rozstrzygnięcia techniczne; Q-FU-5, Q-FU-6. Zaktualizowane D171–D177, D179–D184.
