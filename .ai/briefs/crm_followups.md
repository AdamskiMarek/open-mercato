# Brief: nocne szkice follow-upów (`crm_followups`, v2)

**To nie jest speka (P14).** Speka i decyzje tego modułu są w otwartym draft PR #33 (gałąź `spec/v2-nightly-followup-drafts`, stan po merge `develop_OM_CRM` @2faa964, speka rev 4b): `.ai/specs/2026-10-31-crm-followup-drafts.md` i wiersze D170–D184 w `.ai/decisions.md` tej gałęzi. **D170+ w PR #33, Q-FU rozstrzygnięte, czeka na merge** — na `develop_OM_CRM` tych numerów jeszcze nie ma; brief tylko się do nich odsyła i nie jest przekazywany do spec-check. Źródło prawdy: rejestr (P12).

## 1. Po co

Handlowiec nie gubi przetargów, leadów i kontaktów, które ucichły: co noc system przygotowuje w OM szkice follow-upów (mail, zadanie, przypomnienie o terminie), a człowiek każdy szkic zatwierdza albo odrzuca. Nic nie wychodzi automatycznie (D170 — decyzja biznesowa Marka; D170+ w PR #33, Q-FU rozstrzygnięte, czeka na merge).

## 2. Co ma umieć (każda pozycja z warunkiem sukcesu)

Wszystkie odesłania: D170+ w PR #33, Q-FU rozstrzygnięte, czeka na merge.

| # | Zdolność | Warunek sukcesu | D (PR #33) |
|---|---|---|---|
| F1 | Wykrywanie bezczynności. | Obiekt dostaje szkic tylko, gdy od jego ostatniej aktywności minął próg N organizacji (domyślnie 14); aktywność liczona ze wszystkich źródeł z D172; dla deala aktywność jego osób i firm liczy się tylko bez `deal_id` albo z `deal_id` tego deala (aktywność bez `deal_id` liczy się dla wszystkich otwartych deali osoby lub firmy — Q-FU-7 zamknięte technicznie). Zakres: deale od etapu `result_lead` w górę bez zamkniętych (Q-FU-3) i kontakty tylko powiązane z otwartym dealem (Q-FU-2). Jeden szkic na postępowanie (części grupowane po kluczu postępowania z D189, bez części), najwyżej jeden szkic na osobę kontaktową na dobę, przy kolizji najbliższy termin, potem najdłuższa nieaktywność; pominięte w notce (Q-FU-5). Kontakt z otwartym szkicem deala nie dostaje osobnego szkicu. | D170, D172, D173, D182 |
| F2 | Rodzaj i treść szkicu. | Mail albo zadanie wg reguły D177; przypomnienie o terminie zawsze, gdy do `cf_deadline` (termin składania ofert z pushu n8n) zostało najwyżej `reminder_days_before` (domyślnie 3, strefa firmy, domyślnie Europe/Warsaw), niezależnie od aktywności i wyciszenia, jedno na postępowanie na wartość terminu (Q-FU-6, D177); treść tylko z szablonów pl/en nadpisywalnych per firma, bez LLM (Q-FU-1). | D174, D175, D177, D184 |
| F3 | Idempotencja i rekoncyliacja. | Najwyżej jeden otwarty szkic follow-upu na obiekt i na postępowanie; jeden predykat dla eventu i rekoncyliacji: szkic zamykany jako `superseded`, gdy obiekt teraz się nie kwalifikuje (stary mail dołączony wstecz go nie zamyka); każdy przebieg zaczyna od rekoncyliacji. | D174 |
| F4 | Decyzja człowieka. | Odrzucenie wycisza obiekt na `mute_days`; zatwierdzenie zadania/przypomnienia tworzy interakcję komendą `customers`, zatwierdzenie maila tylko przekazuje szkic do zwykłej wysyłki; decyzje tylko z sesji zalogowanego użytkownika — każdy klucz API (także klucze sesji `ai_assistant`) → `403 FORBIDDEN`, sprawdzane w trasach i komendach. | D175, D176 |
| F5 | Wyzwalacze i notka. | Przebieg uruchamia `scheduler` (domyślnie 03:00 w strefie organizacji), `POST /api/crm-followups/runs` z `Idempotency-Key` albo CLI; jeden przebieg na organizację naraz (wznowienie po `heartbeat_at`, równoległy → `skipped`); ponowne włączenie przywraca job z godziną administratora; po przebiegu notka z licznikami i powiadomienie in-app. | D170, D180, D182 |
| F6 | Uprawnienia. | Pięć feature'ów ACL; szkic widzi i rozstrzyga opiekun obiektu i administrator, handlowcy nie widzą cudzych (Q-FU-4); bez opiekuna — administratorzy; opiekun deala z n8n wg D193; klucz API n8n ma tylko `crm_followups.run`. | D179 |
| F7 | Ustawienia i izolacja firm. | Włącznik i parametry per organizacja w `org:{id}:settings`; każdy rekord `fu_*` i zapytanie filtrowane po organizacji i tenancie. | D178, D181 |
| F8 | Audyt. | Komendy zapisują `action_logs` bez treści maili; dane wrażliwe w mapie szyfrowania. | D183 |

## 3. Ograniczenia

- Nowy opcjonalny moduł aplikacji `crm_followups` (prefiks `fu_`), tylko dwie nowe tabele: `fu_drafts` i `fu_runs`; szkiców nie trzymamy w `customer_interactions` (D171; D170+ w PR #33, Q-FU rozstrzygnięte, czeka na merge). Bez zmian w `packages/core` (D45).
- Warunek wstępny etapu kodu: włączenie modułu `scheduler` w buildzie i wybór `QUEUE_STRATEGY` — tylko za zgodą Marka, po „implementujemy” (D94, D180; droga zastępcza do tego czasu: n8n → `POST /api/crm-followups/runs`).
- Faza v2; tylko specyfikacja (P3); bez estymat w dniach (P11).

## 4. Czego nie robimy

- Żadnej automatycznej wysyłki maila ani zmiany danych bez decyzji człowieka (D170, D176).
- Bez własnej tabeli audytu (D183) i bez nowych zależności dla szablonów (D184).
- Bez LLM — treść tylko z szablonów (Q-FU-1, D184).

## 5. Pytania Q-FU — rozstrzygnięte 2026-10-31

Odpowiedzi Marka (via Koordynator, 2026-10-31): Q-FU-1 tylko szablony PL/EN, bez LLM (D184); Q-FU-2 tylko kontakty z otwartym dealem (D173); Q-FU-3 etapy od `result_lead` w górę, bez zamkniętych (D173); Q-FU-4 opiekun i administrator, bez opiekuna — administratorzy (D179); Q-FU-5 jeden szkic na postępowanie, jeden na osobę na dobę, reguła kolizji (D173, D182); Q-FU-6 przypomnienie zawsze przed `cf_deadline` (D177). Q-FU-7 zamknięte technicznie przez Cezara w D172. Rozstrzygnięcia Cezara 2026-10-31 (techniczne), rev 4b: części grupowane po kluczu D189 bez części (`ezamowienia:<tender_id>`), nie po `cf_notice_number`; jedno przypomnienie na postępowanie i termin (D177). Otwarte do potwierdzenia przez Enkę: pole deala z kluczem D189 (`cf_source` + `cf_external_id` z pushu n8n; rejestr go nie wskazuje).

## 6. Po czym poznamy sukces

- Po merge PR #33 i TC dla D170–D184, D192, D193 w planie testów: spec-check bez flag na plikach @head z D170+ w rejestrze: PASS, 0 FAIL; bramka gotowości (`.ai/process/readiness-gate.md`): PASS.
- Na instancji testowej: nocny przebieg tworzy szkice tylko dla obiektów bezczynnych, drugi przebieg nie dubluje, odrzucenie wycisza, zatwierdzenie tworzy interakcję, a notka pokazuje liczniki; dowód wg P7.
