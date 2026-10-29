# Muzyka w zwykłych playlistach — 0.4.2

## Korzystanie

1. Otwórz zakładkę Muzyka / Playlisty (także Ctrl+Shift+M). Utwory dodajesz i edytujesz standardowymi narzędziami Foundry.
2. Jako główny aktywny MG kliknij ikonę **łańcucha** w nagłówku playlisty. Moduł wczyta jej pliki i włączy Synchro. Włączenie zatrzymuje zwykłe odtwarzanie tylko tej playlisty.
3. Kliknij zwykłe **▶ przy utworze**. Kolejne ▶ przełącza nagranie bez zerowania wspólnego czasu: A 13:12 → B 13:12, po 10 sekundach A 13:22. ▶ podczas pauzy wznawia muzykę na wybranym utworze.
4. Aktualny utwór pojawia się w kompaktowym wierszu opartym na natywnym wierszu playlisty. MG ma pauzę/wznawianie, stop, suwak, −10 s / +10 s i pole czasu. Wpisz `13:12`, `1:13:12` lub sekundy i zatwierdź Enter / Przejdź.
5. Gracz widzi nazwę, czas i tylko dodatkowy przycisk **Synchronizuj u mnie**. Natywne ustawienia głośności użytkownika nadal działają. Nie ma dodatkowych suwaków głośności.
6. Ponowne kliknięcie łańcucha wyłącza Synchro i zatrzymuje jego odtwarzanie. Standardowe przyciski wracają do zwykłego działania.

Jedna playlista może mieć aktywne Synchro. Inne playlisty, ich wygląd, kontrolki i dźwięki pozostają niezależne. Zmiana nazwy/ścieżki utworu, dodanie lub usunięcie utworu w aktywnej playliście wyłącza Synchro; włącz je ponownie po zakończeniu edycji. Usunięcie playlisty również zatrzymuje Synchro.

## Czas i dźwięk

- Pozycja jest wspólna dla wszystkich wariantów i graczy. Pauza zatrzymuje zegar, Stop go zeruje. Przewijanie podczas pauzy nie uruchamia dźwięku.
- Najkrótsze nagranie określa wspólny koniec pętli. Dłuższe końcówki innych plików nie są odtwarzane. Moduł nie dopasowuje tempa, tonacji ani fraz Suno.
- Przy zmianie utworu najpierw wyciszamy i zatrzymujemy stary, potem uruchamiamy nowy. Domyślnie trwa to 120 ms, bez nakładania nagrań.
- Suwak Muzyka Foundry steruje głośnością odbiorcy. Głośność utworu jest pobierana z jego natywnych ustawień przy uruchamianiu. Zmiana powtarzania aktualnego utworu zmienia zapętlanie wspólnej osi.
- Przeglądarka może wymagać kliknięcia strony, aby odblokować audio. Synchronizuj u mnie ponawia lokalne odtwarzanie od aktualnej wspólnej pozycji.
- Limit 20 plików. Nagrania dekodujemy do pamięci (5 minut stereo / 48 kHz ≈ 110 MiB na utwór). Zacznij od kilku wariantów.
- Stan zapisuje się w świecie. Przed zakończeniem sesji użyj Stop lub Pauza.

## Aktualizacja z 0.4.1

Podmień folder `Data/modules/wfrp4e-fan-tools` i uruchom ponownie Foundry. Stary rozbudowany panel znika. Włącz łańcuch przy swojej zwykłej playliście; nie trzeba kopiować ani ponownie wgrywać plików. Dawny zestaw bez przypisanej playlisty nie odtwarza się niewidocznie.

## API

```js
const audio = game.modules.get('wfrp4e-fan-tools').api.audio;
audio.open();
await audio.togglePlaylist('PLAYLIST_ID');
await audio.play();
await audio.seek(792);
await audio.pause();
await audio.select('PLAYLIST_SOUND_ID'); // zmienia wariant, zachowuje pauzę
await audio.play();
await audio.stop();
```

## Próba przed sesją

W świecie V14 jako MG i gracz: włącz Synchro, uruchom pierwszy utwór, przewiń, przełącz na drugi, sprawdź wspólny czas i brak dublowania. Sprawdź pauzę/wznowienie, stop, synchronizację gracza, późne dołączenie, odłączony panel playlist i ponowne otwarcie zakładki. Wyłącz Synchro i sprawdź zwykłe odtwarzanie. Sprawdź wygląd w swoim motywie. Testy automatyczne nie zastępują tej próby.
