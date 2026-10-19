# 🚀 Instalacja rozszerzenia Terminal Command Buttons

## � Dla użytkowników pobierających z GitHub

### Opcja 1: Pobierz Release (Najprostsza)

1. **Idź do GitHub repository:**

   ```
   https://github.com/kacpermizera-dev/vscode-terminal-command-buttons
   ```

2. **Pobierz najnowszy release:**

   - Kliknij **"Releases"** po prawej stronie
   - Pobierz plik `terminal-command-buttons-X.X.X.vsix`

3. **Zainstaluj w VS Code:**
   - Otwórz VS Code
   - `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
   - Wybierz pobrany plik `.vsix`

### Opcja 2: Zbuduj ze źródeł (Dla programistów)

1. **Sklonuj repozytorium:**

   ```bash
   git clone https://github.com/kacpermizera-dev/vscode-terminal-command-buttons.git
   cd vscode-terminal-command-buttons
   ```

2. **Zainstaluj zależności:**

   ```bash
   npm install
   ```

3. **Zbuduj rozszerzenie:**

   ```bash
   npm run package
   ```

4. **Zainstaluj lokalnie:**
   ```bash
   code --install-extension terminal-command-buttons-0.1.0.vsix
   ```

## 📦 Instalacja z pliku VSIX (Po pobraniu)

### Krok 1: Zainstaluj rozszerzenie

```bash
# Otwórz Command Palette w VS Code
Ctrl+Shift+P (Windows/Linux) lub Cmd+Shift+P (Mac)

# Wpisz i wybierz:
Extensions: Install from VSIX...

# Wybierz plik:
terminal-command-buttons-0.1.0.vsix
```

### Krok 2: Alternatywnie przez terminal

```bash
code --install-extension "C:\Users\kacpermi\Desktop\dev\vscode-terminal-extension\terminal-command-buttons-0.1.0.vsix"
```

## ✅ Weryfikacja instalacji

1. **Sprawdź czy rozszerzenie jest zainstalowane:**

   - `Ctrl+Shift+X` → Wpisz "Terminal Command Buttons"
   - Powinno pokazać się jako zainstalowane

2. **Sprawdź ikonę w Activity Bar:**

   - Po lewej stronie powinien pojawić się **terminal icon**
   - Kliknij na niego, żeby otworzyć panel

3. **Test funkcjonalności:**
   - Otwórz dowolny projekt w VS Code
   - Kliknij ikonę terminala w Activity Bar
   - Zobaczysz panel "Terminal Commands" z przyciskami

## 🎯 Używanie rozszerzenia

### Domyślne przyciski:

- 📁 **List Files** (`ls -la`)
- 🟢 **Node.js Version** (`node --version`)
- 📦 **NPM Version** (`npm --version`)
- 🌿 **Git Status** (`git status`)
- 📍 **Current Directory** (`pwd`)

### Dodawanie własnych przycisków:

1. Kliknij **"+ Add"** w panelu
2. Wypełnij formularz:
   - **Button Name**: np. "Build Project"
   - **Command**: np. "npm run build"
   - **Color**: wybierz kolor
3. Kliknij **"Save"**

### Wykonywanie komend:

- Kliknij dowolny przycisk w panelu
- Komenda wykona się w aktywnym terminalu
- Jeśli nie ma terminala, zostanie utworzony nowy

## 🔧 Ustawienia

Twoje przyciski są zapisywane w:

- **Workspace settings**: `.vscode/settings.json` (dla konkretnego projektu)
- **Global settings**: VS Code User Settings (dla wszystkich projektów)

### Dostęp przez Command Palette:

- `Ctrl+Shift+P` → "Terminal Command Buttons: Open Terminal Command Buttons"
- `Ctrl+Shift+P` → "Terminal Command Buttons: Add New Command Button"

## 🆘 Rozwiązywanie problemów

### Problem: Nie widzę ikony terminala w Activity Bar

**Rozwiązanie:**

- Sprawdź czy rozszerzenie jest włączone: `Ctrl+Shift+X` → "Terminal Command Buttons"
- Restart VS Code

### Problem: Przyciski się nie zapisują

**Rozwiązanie:**

- Sprawdź logi: Output → "Log (Extension Host)"
- Upewnij się, że VS Code ma uprawnienia do zapisu

### Problem: Komendy się nie wykonują

**Rozwiązanie:**

- Upewnij się, że terminal jest aktywny
- Sprawdź czy ścieżka do komend jest poprawna

## 🎨 Przykłady użytecznych komend

```json
{
  "name": "Install Dependencies",
  "command": "npm install",
  "color": "#e74c3c"
}

{
  "name": "Start Dev Server",
  "command": "npm run dev",
  "color": "#2ecc71"
}

{
  "name": "Run Tests",
  "command": "npm test",
  "color": "#f39c12"
}

{
  "name": "Git Push",
  "command": "git push origin main",
  "color": "#9b59b6"
}

{
  "name": "Docker Build",
  "command": "docker build -t myapp .",
  "color": "#3498db"
}
```

---

**🎉 Po instalacji rozszerzenie będzie dostępne we wszystkich projektach VS Code!**
