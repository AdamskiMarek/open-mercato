# Brief: nocne szkice follow-upów (`crm_followups`, v2)

**To nie jest speka (P14).** Speka i decyzje tego modułu są w otwartym draft PR #33 (gałąź `spec/v2-nightly-followup-drafts`, stan przeczytany przy `e05e12b`, speka rev 3): `.ai/specs/2026-10-31-crm-followup-drafts.md` i wiersze D170–D184 w `.ai/decisions.md` tej gałęzi. **D170+ w PR #33, czeka na Q-FU** — na `develop_OM_CRM` tych numerów jeszcze nie ma; brief tylko się do nich odsyła i nie jest przekazywany do spec-check. Źródło prawdy: rejestr (P12).

## 1. Po co

Handlowiec nie gubi przetargów, leadów i kontaktów, które ucichły: co noc system przygotowuje w OM szkice follow-upów (mail, zadanie, przypomnienie o terminie), a człowiek każdy szkic zatwierdza albo odrzuca. Nic nie wychodzi automatycznie (D170 — decyzja biznesowa Marka; D170+ w PR #33, czeka na Q-FU).

## 2. Co ma umieć (każda pozycja z warunkiem sukcesu)

Wszystkie odesłania: D170+ w PR #33, czeka na Q-FU.

| # | Zdolność | Warunek sukcesu | D (PR #33) |
|---|---|---|---|
| F1 | Wykrywanie bezczynności. | Obiekt dostaje szkic tylko, gdy od jego ostatniej aktywności minął próg N organizacji (domyślnie 14); aktywność liczona ze wszystkich źródeł z D172; dla deala aktywność jego osób i firm liczy się tylko bez `deal_id` albo z `deal_id` tego deala (aktywność bez `deal_id` liczy się dla wszystkich otwartych deali osoby lub firmy — Q-FU-7 zamknięte technicznie). Kontakt z otwartym szkicem deala nie dostaje osobnego szkicu. | D170, D172, D173 |
| F2 | Rodzaj i treść szkicu. | Rodzaj (przypomnienie / mail / zadanie) wynika z reguły D177; termin przypomnienia z `expected_close_at` albo pola `cf_deadline` (termin składania ofert z pushu n8n); treść z szablonów pl/en nadpisywalnych per firma; wariant LLM tylko po decyzji Marka. | D177, D184 |
| F3 | Idempotencja i rekoncyliacja. | Najwyżej jeden otwarty szkic na obiekt; jeden predykat dla eventu i rekoncyliacji: szkic zamykany jako `superseded`, gdy obiekt teraz się nie kwalifikuje (stary mail dołączony wstecz go nie zamyka); każdy przebieg zaczyna od rekoncyliacji. | D174 |
| F4 | Decyzja człowieka. | Odrzucenie wycisza obiekt na `mute_days`; zatwierdzenie zadania/przypomnienia tworzy interakcję komendą `customers`, zatwierdzenie maila tylko przekazuje szkic do zwykłej wysyłki; decyzje tylko z sesji zalogowanego użytkownika — każdy klucz API (także klucze sesji `ai_assistant`) → 403, sprawdzane w trasach i komendach. | D175, D176 |
| F5 | Wyzwalacze i notka. | Przebieg uruchamia `scheduler` (domyślnie 03:00 w strefie organizacji), `POST /api/crm-followups/runs` z `Idempotency-Key` albo CLI; jeden przebieg na organizację naraz (wznowienie po `heartbeat_at`, równoległy → `skipped`); ponowne włączenie przywraca job z godziną administratora; po przebiegu notka z licznikami i powiadomienie in-app. | D170, D180, D182 |
| F6 | Uprawnienia. | Pięć feature'ów ACL; szkic widzi i rozstrzyga właściciel obiektu (bez właściciela — administratorzy); klucz API n8n ma tylko `crm_followups.run`. | D179 |
| F7 | Ustawienia i izolacja firm. | Włącznik i parametry per organizacja w `org:{id}:settings`; każdy rekord `fu_*` i zapytanie filtrowane po organizacji i tenancie. | D178, D181 |
| F8 | Audyt. | Komendy zapisują `action_logs` bez treści maili; dane wrażliwe w mapie szyfrowania. | D183 |

## 3. Ograniczenia

- Nowy opcjonalny moduł aplikacji `crm_followups` (prefiks `fu_`), tylko dwie nowe tabele: `fu_drafts` i `fu_runs`; szkiców nie trzymamy w `customer_interactions` (D171; D170+ w PR #33, czeka na Q-FU). Bez zmian w `packages/core` (D45).
- Warunek wstępny etapu kodu: włączenie modułu `scheduler` w buildzie i wybór `QUEUE_STRATEGY` — tylko za zgodą Marka, po „implementujemy” (D94, D180; droga zastępcza do tego czasu: n8n → `POST /api/crm-followups/runs`).
- Faza v2; tylko specyfikacja (P3); bez estymat w dniach (P11).

## 4. Czego nie robimy

- Żadnej automatycznej wysyłki maila ani zmiany danych bez decyzji człowieka (D170, D176).
- Bez własnej tabeli audytu (D183) i bez nowych zależności dla szablonów (D184).
- Bez LLM, dopóki Marek nie odpowie na Q-FU-1 (D184).

## 5. Pytania otwarte (Q-FU, do Marka przez Koordynatora)

Q-FU-1 treść szkicu (szablony / LLM / szablon + LLM na żądanie); Q-FU-2 które kontakty; Q-FU-3 które etapy lejka „Przetargi”; Q-FU-4 kto widzi szkice; Q-FU-5 przetarg z częściami i limit szkiców na osobę na noc; Q-FU-6 przypomnienie o terminie tylko dla bezczynnych czy niezależnie. Q-FU-7 (aktywność osoby lub firmy bez `deal_id` a jej otwarte deale) — zamknięte technicznie przez Cezara w D172, nie czeka na Marka. Do odpowiedzi D173/D177/D184 mają wartości tymczasowe.

## 6. Po czym poznamy sukces

- Po merge PR #33 i odpowiedziach na Q-FU: spec-check bez flag na plikach @head z D170+ w rejestrze: PASS, 0 FAIL; bramka gotowości (`.ai/process/readiness-gate.md`): PASS.
- Na instancji testowej: nocny przebieg tworzy szkice tylko dla obiektów bezczynnych, drugi przebieg nie dubluje, odrzucenie wycisza, zatwierdzenie tworzy interakcję, a notka pokazuje liczniki; dowód wg P7.
