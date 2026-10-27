# Wspólny czas — przełącznik muzyki

Wersja 0.1.0 • Foundry VTT 14 • interfejs polski • bez dodatkowych modułów.

To pierwsza wersja do prób w Foundry. Logika jest przetestowana automatycznie,
ale nie została uruchomiona w rzeczywistej instalacji Foundry ani WFRP4e.
Manifest celowo nie deklaruje numeru wersji „verified”.

## Co robi

Dodajesz kilka **pełnych nagrań** (do 20) i wybierasz jedno przyciskiem.
Jeśli A gra na 1:35, kliknięcie B uruchamia B w aktualnym momencie tej samej
osi czasu. Po kolejnych 20 sekundach powrót do A następuje około 1:55,
a nie w miejscu, gdzie A zostało wyłączone.

Jednocześnie słyszalny jest tylko jeden utwór. Przejście domyślnie trwa
120 ms: 60 ms wyciszenia starego, następnie 60 ms wejścia nowego.
Wspólny zegar biegnie podczas przejścia i wczytywania. Można ustawić 0–2000 ms.
To celowo NIE jest crossfade: unikamy nakładania podobnych melodii.

Pauza zatrzymuje wspólny zegar. Wybór innego utworu podczas pauzy nie
uruchamia muzyki. Stop zeruje zegar. Przewijanie ustawia wspólną pozycję.
Gracze otrzymują stan przez synchronizowane ustawienie świata Foundry;
dołączenie później zaczyna od aktualnego czasu. Różnice czasu są okresowo
korygowane. To synchronizacja użytkowa, nie studyjna synchronizacja próbek.

## Instalacja ręczna

1. Rozpakuj ZIP. Skopiuj cały folder `shared-timeline-audio` do folderu
   `Data/modules/` w **katalogu danych użytkownika Foundry**.
2. Poprawna ścieżka to `Data/modules/shared-timeline-audio/module.json`.
   Nie dodawaj drugiego zagnieżdżonego folderu o tej samej nazwie.
3. Uruchom ponownie Foundry. Otwórz świat → Zarządzaj modułami → włącz
   **Wspólny czas — przełącznik muzyki**. Przeładuj świat.
4. Panel otwierasz przyciskiem **♫** obok prawego dolnego obszaru ekranu
   albo skrótem **Ctrl+Shift+M** (można zmienić w przypisaniach klawiszy).

To lokalna paczka: nie ma publicznego URL manifestu ani automatycznych
aktualizacji. Hosting zarządzany musi pozwalać na instalowanie własnych modułów.

## Pierwsze uruchomienie

1. Zatrzymaj zwykłe playlisty i Adaptive Audio dla testowanej muzyki.
   Moduł nie wyłącza ich sam i nie wymaga Adaptive Audio.
2. Otwórz panel → **Pliki i ustawienia**.
3. Podaj nazwę (np. Eksploracja) i wybierz plik przez **Wybierz / wgraj**.
   To standardowy FilePicker Foundry: można wybrać istniejący plik lub wgrać
   nowy do folderu danych, o ile konto ma uprawnienie do wysyłania plików.
   Nie używaj ścieżek `C:\...` z własnego komputera.
4. Kliknij **Dodaj ścieżkę**. Powtórz dla kolejnych wersji, albo dodaj
   utwory z istniejącej playlisty. Ta operacja nie uruchamia samej playlisty.
5. Opcjonalnie kliknij **Wczytaj wszystkie pliki u połączonych graczy**.
   Informacja o wyniku wczytania jest lokalna, nie jest raportem wszystkich
   graczy. Każdy klient pokaże swój ewentualny błąd.
6. Wybierz utwór i kliknij **Odtwórz**. Klikaj kolejne wersje.

## Wspólna długość i zapętlanie

Domyślnie wspólna oś kończy się na końcu **najkrótszego** pliku.
Przykład: A = 4:00, B = 4:20 → oba warianty przechodzą do 0:00 po 4 minutach.
Końcowe 20 sekund B nie jest odtwarzane. Możesz ustawić krótszy wspólny koniec
w sekundach. Po wyłączeniu zapętlenia odtwarzanie kończy się na wspólnym końcu.

Moduł nie tworzy bezszwowych pętli i nie dopasowuje BPM, tonacji ani fraz.
Ten sam timestamp dwóch remiksów Suno może odpowiadać innemu miejscu melodii.
To rozwiązanie problemu sterowania odtwarzaniem, nie synchronizacji aranżacji.

## Uprawnienia, pamięć i trwałość

- Światowy transport kontroluje główny aktywny MG wybrany przez Foundry
  (`game.users.activeGM`). Pozostali GM i gracze słuchają; każdy ma własną
  lokalną głośność. To unika wyścigu sprzecznych poleceń od kilku MG.
- Lista plików i stan transportu są zapisane w ustawieniach świata.
  Jeżeli opuścisz świat w trakcie grania, po powrocie zegar uwzględni czas,
  który upłynął. Przed zakończeniem sesji użyj Stop albo Pauza.
- Muzyka korzysta z kontekstu muzycznego Foundry oraz lokalnego suwaka panelu.
  Odtwarzacz nie pojawia się jako zwykły aktywny PlaylistSound w bocznym panelu.
- Przeglądarka może wymagać kliknięcia na stronie przed odtwarzaniem audio.
  Po odblokowaniu muzyka dołączy do aktualnej pozycji, nie do początku.
- Dla dokładnego wspólnego zapętlania pliki są dekodowane do AudioBuffer.
  5 minut stereo / 48 kHz zajmuje około 110 MiB RAM po dekodowaniu,
  niezależnie od kompresji pliku. 20 długich utworów może zużyć dużo pamięci.
  Zacznij od 2–4 plików. Wczytywanie całego zestawu jest opcjonalne.
- Zdalny adres HTTP(S) musi pozwalać przeglądarkom graczy na pobieranie
  i dekodowanie (w tym CORS). Najprościej używać plików hostowanych przez Foundry.
- Dla wolno wczytującego się nowego utworu poprzedni pozostaje słyszalny
  do zakończenia wczytywania, potem następuje przełączenie na aktualny czas.
  Po błędzie pliku lokalne odtwarzanie jest zatrzymywane; popraw ścieżkę
  albo użyj **Synchronizuj u mnie**, by spróbować ponownie.

## Makra (typ Script)

Otwórz panel:

```js
game.modules.get("shared-timeline-audio").api.open();
```

Odtwórz / pauza / stop:

```js
await game.modules.get("shared-timeline-audio").api.play();
// .pause() albo .stop()
```

Wybór po nazwie bez resetowania czasu:

```js
const audio = game.modules.get("shared-timeline-audio").api;
const track = audio.getState().tracks.find(t => t.name === "Slaanesh");
if (track) await audio.select(track.id);
else ui.notifications.warn("Nie znaleziono ścieżki Slaanesh.");
```

## Próba w Twoim Foundry

1. Otwórz MG oraz gracza w drugim profilu przeglądarki.
2. Dodaj dwa krótkie pliki, uruchom A i przewiń do 1:35.
3. Kliknij B: zegar ma kontynuować, muzyka ma się zmienić u obu użytkowników.
4. Odczekaj 20 sekund i wróć do A: oczekiwane około 1:55.
5. Sprawdź pauzę, zmianę wersji podczas pauzy, wznowienie i Stop.
6. Dołącz nowego gracza w trakcie odtwarzania, kliknij na jego stronie.
7. Sprawdź przejście przez koniec wspólnej pętli.

W razie błędu dołącz wersję Foundry, przeglądarkę, czynność i komunikat
z konsoli F12. Wersja 0.1.0 nie była testowana na serwerze Foundry.

## Testy i kod

Źródła są w `scripts/`, style w `styles/`. `npm test` uruchamia testy Node.js
bez instalowania zależności. Dokumentacja API wykorzystana przy implementacji:

- https://foundryvtt.com/api/v14/classes/foundry.audio.Sound.html
- https://foundryvtt.com/api/v14/interfaces/foundry.audio.SoundPlaybackOptions.html
- https://foundryvtt.com/api/v14/classes/foundry.helpers.GameTime.html
- https://foundryvtt.com/api/v14/classes/foundry.helpers.ClientSettings.html
- https://foundryvtt.com/api/v14/classes/foundry.applications.apps.FilePicker.html

Szczegóły wykonanych testów są w `TEST_REPORT.md`.
