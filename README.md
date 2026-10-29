# WFRP4e Fan — Narzędzia

Jeden moduł dla Foundry VTT 14 / WFRP4e, ID `wfrp4e-fan-tools`, wersja 0.4.2:

- Plansza i tracker pościgu oraz prośby o testy, wraz z dotychczasowym kompendium makr.
- Muzyka: ręczne przełączanie pełnych utworów przy zachowaniu wspólnego czasu, bez ich nakładania. A 13:12 → B 13:12; po 10 sekundach powrót do A 13:22.
- Pauza, stop, przewijanie, wspólna pętla, lokalna głośność i synchronizacja graczy.

Muzyka korzysta bezpośrednio ze zwykłych playlist Foundry. W nagłówku playlisty MG klika małą ikonę łańcucha (Synchro), a następnie zwykłe ▶ obok utworu. Nie ma osobnego panelu ani kopii listy utworów. Gracz widzi aktualny utwór, czas i przycisk synchronizacji; MG ma też przewijanie i pauzę/stop.

## Instalacja i przejście ze starego ID

1. Wykonaj kopię świata przed migracją. Zachowaj starą paczkę jako kopię.
2. Wyłącz w świecie `wfrp4e-pod-bronia-poscigi` oraz `shared-timeline-audio`, jeżeli był zainstalowany.
3. Rozpakuj ZIP do katalogu danych Foundry: `Data/modules/wfrp4e-fan-tools/module.json`.
4. Uruchom ponownie Foundry i włącz **WFRP4e Fan — Narzędzia** w świecie.
5. Wejdź jako MG. Główny aktywny MG kopiuje stary tracker i konfigurację odtwarzacza, jeżeli nowe ustawienia jeszcze nie istnieją. Stare dane pozostają zapisane. Importowana muzyka zostaje wstrzymana.
6. Sprawdź planszę, tracker i prośbę o rzut. Otwórz zakładkę Muzyka / Playlisty. Kliknij ikonę łańcucha w nagłówku istniejącej playlisty, a następnie jej zwykły przycisk ▶ przy utworze. Sprawdź przełączanie oraz przewijanie z połączonym graczem.

Zmiana ID nie jest zwykłą aktualizacją w miejscu: nowy moduł trzeba włączyć w każdym świecie.
Migracja naprawia standardową ścieżkę tła istniejących plansz pościgu. Zachowuje `game.wfrpChase`, więc dołączone i wcześniej zaimportowane makra nadal używają tego samego API. Stare flagi próśb o rzut pozostają czytelne.

Kompendium ma teraz UUID zaczynające się od `Compendium.wfrp4e-fan-tools.macros`.
Własne linki z prefiksem `Compendium.wfrp4e-pod-bronia-poscigi.macros` trzeba poprawić ręcznie; moduł nie przepisuje treści dzienników ani własnych skryptów użytkownika. Zmodyfikowane przez użytkownika kompendium starego modułu należy wcześniej wyeksportować — paczka zawiera wersję repozytorium.

Manifest aktualizacji wskazuje na bieżącą gałąź `master`, a paczka wydania jest
publikowana w GitHub Releases. Nie deklarujemy `verified`, dopóki moduł nie
zostanie sprawdzony w rzeczywistym Foundry VTT 14 z MG i graczem.

## Obsługa i API

[Pełna instrukcja muzyki](docs/AUDIO.md).

```js
game.modules.get('wfrp4e-fan-tools').api.audio.open();
game.modules.get('wfrp4e-fan-tools').api.chase.openTracker();
// Zachowana zgodność dotychczasowych makr:
game.wfrpChase.openRollRequestDialog();
```

Najkrótszy plik określa wspólną długość pętli. Moduł nie wyrównuje tempa i fraz różnych aranżacji Suno. Na czas testu zatrzymaj inne playlisty i Adaptive Audio, aby nie odtwarzały równolegle tej samej muzyki.

## Budowanie i testy

`npm test` — 21 testów automatycznych; najpierw `npm ci` (LinkeDOM służy tylko testom DOM, nie jest zależnością modułu w Foundry).

`python3 tools/package-module.py` — wspólna paczka `dist/wfrp4e-fan-tools-v0.4.2.zip` z pościgami, muzyką, planszą i kompendium. GitHub Actions również buduje ZIP jako artefakt.

Test integracyjny uruchamia główny skrypt modułu i obie funkcjonalności w symulowanych klientach MG/gracza. Osobne testy sprawdzają migrację, uprawnienia, zachowanie nowych danych i wspólną oś czasu. To nie jest test prawdziwego Foundry ani jakości dźwięku. Przed sesją wymagane jest sprawdzenie V14 z graczem; patrz [raport testów](docs/TEST_REPORT.md).
