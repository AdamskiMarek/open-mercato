# Lista kontrolna architektury OM — przed specą i przed PR

**Stan na:** 2026-10-20
**Źródło:** przegląd Kod PR #10 (rev 7) i PR #11, `/workspace/om-spec-review-pr10-11.md` (odwołania „Kod pN” = punkt przeglądu).
**Użycie:** każdy punkt odhaczamy przed oddaniem speki do przeglądu i przed otwarciem PR. Punkt niespełniony = uzasadnienie w sekcji Risks speki. Listę rozszerzamy o każdy nowy błąd znaleziony w przeglądzie.

## Moduły i zależności
- [ ] Moduły komunikują się tylko przez serwisy/interfejsy z DI (eventy, widget+enricher, FK-id+snapshot); zero HTTP między modułami. (Kod p1)
- [ ] Zależność jednokierunkowa: moduł bazowy (`project_costing`) nie importuje modułu opcjonalnego; opcjonalny (`project_schedule`) rejestruje swój provider w rejestrze DI bazowego. (Kod p1)
- [ ] Brak zapisów do tabel/pól innych modułów; dane własne w encji-rozszerzeniu + `data/extensions.ts` (np. `offer_role` w encji costingu, nie EAV na dealu). (Kod p2)
- [ ] Zero hardkodowanych UUID definicji pól, słowników ani encji — nie istnieją w innym tenancie. (Kod p2)
- [ ] Jednoznaczne reguły w bazie: np. partial unique `WHERE offer_role='primary'`, zmiana w jednej transakcji. (Kod p2)
- [ ] Jedno pojęcie na jeden byt (np. inwestycja: `pc_investments` albo `klin:project`, nie oba); zakładka na dealu przez spot `detail:customers.deal:tabs`. (Kod p11)

## Uprawnienia i widoczność
- [ ] RBAC tylko w `acl.ts`; role OM to superadmin/admin/employee — nie zakładamy ról manager/sales, chyba że tworzy je `setup.ts`. (Kod p4)
- [ ] Ustawienia nie dublują RBAC (brak `*_visible_features` w ustawieniach). (Kod p4)
- [ ] Ukryte dane (marża) ukryte szczelnie: ukryta marża = ukryty koszt dla danej roli. (Kod p3)
- [ ] Ukryte pola wykluczone z `query_index`, wyszukiwania, snapshotów komend (`action_logs`), payloadów eventów (tylko ID) i endpointów typu `/compare`. (Kod p3)

## Zapis, audyt, CRUD
- [ ] Zapisy przez komendy (z undo); akcje typu mark-sent/unlock/recalc/apply-to-deal jako komendy. (Kod p6)
- [ ] Audyt przez `audit_logs`, bez własnych tabel audytu; powód akcji w metadanych komendy. (Kod p6)
- [ ] Endpointy CRUD przez `makeCrudRoute` + indexer, `openApi` na trasach, mutation guards. (Kod p6)
- [ ] Zapis minimalny: inputy + sumy w nagłówku jedną komendą, lock na nagłówku, pochodne liczone czystą funkcją (klient = serwer) i zamrażane w snapshocie; benchmark dla dużych danych (np. 5000 linii). (Kod p8)
- [ ] Encje mają `deleted_at` (soft delete). (Kod p20)

## Konfiguracja i włączanie modułów
- [ ] Ustawienia modułu przez `ModuleConfigService` (`module_configs`), nie własna tabela ustawień. (Kod p7)
- [ ] Włączanie modułu per organizacja przez `module_configs` (ModuleConfigService) + feature'y ACL + blokada menu, widgetów i API; `feature_toggles` tylko jako globalny kill-switch modułu per tenant; moduły włącza build, nie rejestr w runtime. (Kod p7, D47)
- [ ] Spec definiuje zakres „firmy” (decyzja: firma = organizacja OM) i dobiera do niego mechanizm: per organizacja `module_configs`, per tenant tylko kill-switch `feature_toggles`. (Kod p7, D47)

## Dane z CRM (deale)
- [ ] Statusy deala zgodne z OM: `open` + `closure_outcome`, eventy `customers.deal.won/lost`, archiwum = `deleted_at`; subscriber `persistent: true`; snapshot statusu w naszej encji. (Kod p5)

## Zadania ciężkie
- [ ] Import (XLSX/CSV) i generowanie PDF przez `ProgressJob` + worker kolejki (`@open-mercato/queue`), nie synchronicznie. (Kod p9)
- [ ] Import obsługuje: formuły bez zapisanej wartości, scalone komórki, wiele arkuszy, format „1 234,56”, jednostki ze słownika. (Kod p9)

## Zależności
- [ ] Każda nowa zależność produkcyjna = „ask first”: lista do jawnej akceptacji Marka, z datą ostatniego wydania i statusem (beta?). (Kod p10)
- [ ] Najpierw to, co już jest w repo (np. PDF na `pdf-lib`, grid na komponentach `packages/ui`). (Kod p10)

## Reguły obliczeń
- [ ] Numeracja przez sekwencje Postgresa (wzór `SalesDocumentNumberGenerator`), per organizacja; bez wyścigu i przepełnienia. (Kod p18)
- [ ] Walidacje brzegowe w bazie i serwisie: CHECK na stawkach (np. `target_margin_rate < 1`), qty 0, blokada ujemnych cen przy mark-sent. (Kod p19)
- [ ] Hierarchia ograniczona do tego, co sumy obsługują (MVP: sekcja → pozycje, bez `subtotal`). (Kod p13)
- [ ] Algorytmy harmonogramu: max po wszystkich poprzednikach, milestone o zerowym czasie, konwencja daty końca, naruszenia przypiętych zadań zwracane jawnie, walidacja pętli i summary; jeden event `schedule.rescheduled` z debounce. (Kod p12)

## Wycena i testy
- [ ] Wycena zawiera narzut OM: testy integracyjne każdej trasy API w tej samej zmianie, zod per encja, komendy z undo, `openApi`, CrudForm, i18n pl/en, granty w `setup.ts`. (Kod p16)
- [ ] Testy: Jest unit w `__tests__`, Playwright w `__integration__` modułu; żadnych wykonywalnych `.spec.ts` pod `.ai/qa/tests`; bez narzędzi, których nie ma w repo (`createTestDb`, Supertest). (Kod p17)
- [ ] MVP pocięty po wartości (to, co klient dostaje), nie po warstwach technicznych. (Kod p15)

## Forma speki
- [ ] Spec ma sekcje TLDR, Architecture, Risks (z ryzykiem rezydualnym) i Final Compliance Report (`.ai/specs/AGENTS.md`). (Kod p20)
