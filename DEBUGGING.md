# Debugowanie problemów z zapisywaniem przycisków

## Jak przetestować poprawkę

1. **Kompilacja rozszerzenia:**

   ```bash
   npm run compile
   ```

2. **Uruchomienie w trybie debugowania:**

   - Naciśnij `F5` lub `Ctrl+F5` w VS Code
   - Zostanie otwarte nowe okno VS Code z rozszerzeniem

3. **Otworzenie panelu przycisków:**

   - W nowym oknie VS Code, otwórz Command Palette (`Ctrl+Shift+P`)
   - Wpisz "Terminal Command Buttons" i wybierz "Open Terminal Command Buttons"
   - Lub kliknij ikonę terminala w Activity Bar po lewej stronie

4. **Testowanie dodawania przycisku:**

   - Kliknij przycisk "+ Add" w panelu
   - Wypełnij formularz:
     - **Button Name**: np. "Test Command"
     - **Command**: np. "echo Hello World"
     - **Color**: wybierz dowolny kolor
   - Kliknij "Save"

5. **Sprawdzenie logów:**
   - W oknie debugowania, otwórz Developer Tools dla webview:
     - `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"
   - W zakładce Console sprawdź logi webview
   - W zakładce Output (na dole) wybierz "Log (Extension Host)" i sprawdź logi rozszerzenia

## Oczekiwane logi

### W webview console:

```
Saving button: {name: "Test Command", command: "echo Hello World", color: "#007acc"}
Sending addButton message to extension with data: {name: "Test Command", command: "echo Hello World", color: "#007acc"}
Message sent, hiding form
Webview received message: {type: "buttonsUpdate", buttons: [...]}
Updating buttons with: [...]
Rendering buttons: [...]
```

### W Extension Host output:

```
Received message from webview: {type: "addButton", button: {...}}
Processing addButton message
Adding button: {name: "Test Command", command: "echo Hello World", color: "#007acc"}
All buttons after adding: [...]
Button saved to workspace config (lub global config)
Configuration found: {...}
Buttons from config: [...]
Sending buttons to webview: [...]
```

## Możliwe problemy i rozwiązania

### 1. Brak uprawnień do workspace

Jeśli pojawi się błąd zapisywania do workspace, rozszerzenie automatycznie spróbuje zapisać do ustawień globalnych.

### 2. Webview nie otrzymuje wiadomości

Sprawdź czy webview jest poprawnie załadowany i czy nie ma błędów JavaScript.

### 3. Konfiguracja nie zapisuje się

Rozszerzenie teraz ma lepszą obsługę błędów i wyświetli powiadomienie o problemie.

## Sprawdzenie zapisanych ustawień

1. **Workspace settings:**

   - Otwórz `.vscode/settings.json` w workspace
   - Sprawdź czy jest sekcja `terminalCommandButtons.buttons`

2. **Global settings:**
   - `Ctrl+Shift+P` → "Preferences: Open Settings (JSON)"
   - Sprawdź czy jest sekcja `terminalCommandButtons.buttons`

## Dodatkowe debugowanie

Jeśli problem nadal występuje, sprawdź:

1. Czy VS Code ma uprawnienia do zapisu w folderze workspace
2. Czy nie ma konfliktów z innymi rozszerzeniami
3. Czy wersja VS Code jest kompatybilna (minimalna: 1.101.0)
