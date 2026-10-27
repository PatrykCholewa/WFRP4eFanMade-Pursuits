# WFRP4eFanMade-Pursuits

Własne dodatki do Foundry VTT. Repozytorium zawiera dwa niezależne moduły:

| Moduł | Źródła | Instalacja |
| --- | --- | --- |
| **WFRP4e Fan – Pościgi** | `module.json`, `scripts/`, `styles/`, `packs/` w katalogu głównym | Dotychczasowy manifest i wydania `v0.3.x` |
| **Wspólny czas — przełącznik muzyki** | [`modules/shared-timeline-audio/`](modules/shared-timeline-audio/) | Osobny ZIP, Foundry VTT 14 |

## Wspólny czas — muzyka

Wybierasz jedną z kilku pełnych ścieżek; nowy utwór przejmuje bieżący czas.
Przykład: A na 1:35 → B na 1:35 → po 20 sekundach A na 1:55.
Jest pauza, przewijanie, wspólne zapętlenie, lokalna głośność i synchronizacja
stanu między MG a graczami. Nie wymaga Adaptive Audio ani WFRP4e.

### Instalacja

1. Pobierz artefakt `shared-timeline-audio` z udanego przebiegu workflow
   **Shared Timeline Audio** w zakładce Actions. Pobranie artefaktów GitHub
   może wymagać zalogowania. Rozpakuj pobrany artefakt, aby uzyskać ZIP modułu.
2. Alternatywnie zbuduj go lokalnie:

   ```sh
   python3 tools/package-shared-timeline-audio.py
   ```

3. Rozpakuj `dist/shared-timeline-audio-v0.1.0.zip` do katalogu danych Foundry
   `Data/modules/`. Wynikiem ma być `Data/modules/shared-timeline-audio/module.json`.
4. Uruchom ponownie Foundry, włącz **Wspólny czas — przełącznik muzyki** w świecie.
5. Otwórz panel przyciskiem **♫** albo **Ctrl+Shift+M**.

Nie podawaj głównego manifestu pościgów przy instalowaniu odtwarzacza.
Odtwarzacz nie ma jeszcze publicznego manifestu z automatycznym pobieraniem;
workflow tworzy artefakt testowy, nie publikuje wydania i nie aktualizuje pościgów.

[Instrukcja odtwarzacza](modules/shared-timeline-audio/README.md) ·
[Wyniki i ograniczenia testów](modules/shared-timeline-audio/TEST_REPORT.md)

### Sprawdzenie kodu

```sh
npm --prefix modules/shared-timeline-audio test
python3 tools/package-shared-timeline-audio.py
```

Testy wykorzystują Node.js 22+ i nie potrzebują pakietów npm.
Wersja 0.1.0 jest przeznaczona do prób: testy logiki i symulowanych klientów
nie zastępują uruchomienia w rzeczywistym świecie Foundry V14.
