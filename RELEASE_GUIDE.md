# 📦 Publikacja Release na GitHub

## 🎯 Jak utworzyć Release dla użytkowników

### Krok 1: Przygotuj pliki

1. **Upewnij się, że masz aktualny plik VSIX:**

   ```bash
   npm run package
   ```

2. **Sprawdź czy wszystko jest committed:**

   ```bash
   git status
   git add .
   git commit -m "Release v0.0.1"
   ```

3. **Wypchnij na GitHub:**
   ```bash
   git push origin main
   ```

### Krok 2: Utwórz Release na GitHub

1. **Idź do swojego repozytorium na GitHub**
2. **Kliknij "Releases"** (po prawej stronie)
3. **Kliknij "Create a new release"**

### Krok 3: Wypełnij dane Release

```
Tag version: v0.0.1
Release title: Terminal Command Buttons v0.0.1 - Initial Release
```

**Opis Release:**

```markdown
# 🖥️ Terminal Command Buttons v0.0.1

Add configurable command buttons to your VS Code terminal!

## ✨ Features

- 🎯 **Quick Commands**: Execute your most-used commands with one click
- 📋 **Scrollable Panel**: Clean interface for all your commands
- ⚙️ **Easy Management**: Add, edit, delete buttons from UI
- 🎨 **Color Coding**: Organize commands with custom colors
- 💾 **Persistent Storage**: Buttons saved in workspace/user settings
- 🔗 **Terminal Integration**: Works with active terminal

## 🚀 Installation

1. Download the `terminal-command-buttons-0.0.1.vsix` file below
2. Open VS Code
3. Press `Ctrl+Shift+P` and type "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Look for the terminal icon in Activity Bar!

## 📋 Default Commands

- 📁 List Files (`ls -la`)
- 🟢 Node.js Version (`node --version`)
- 📦 NPM Version (`npm --version`)
- 🌿 Git Status (`git status`)
- 📍 Current Directory (`pwd`)

## 🛠️ Add Custom Commands

Click "+ Add" in the panel to create your own command buttons!

---

**🎉 Enjoy faster terminal workflows!**
```

### Krok 4: Dodaj plik VSIX

1. **W sekcji "Attach binaries":**

   - Przeciągnij plik `terminal-command-buttons-0.0.1.vsix`
   - Lub kliknij "choose your files" i wybierz plik

2. **Ustaw opcje:**

   - ✅ **Set as the latest release**
   - ❌ **Set as a pre-release** (dla stabilnej wersji)

3. **Kliknij "Publish release"**

## 🎯 Po publikacji

### Użytkownicy będą mogli:

1. **Iść na stronę Releases:**

   ```
   https://github.com/kacpermizera-dev/vscode-terminal-command-buttons/releases
   ```

2. **Pobrać plik VSIX** z najnowszego release

3. **Zainstalować bezpośrednio w VS Code**

### Aktualizacja README.md

Dodaj do README badge z najnowszą wersją:

```markdown
[![Latest Release](https://img.shields.io/github/v/release/kacpermizera-dev/vscode-terminal-command-buttons)](https://github.com/kacpermizera-dev/vscode-terminal-command-buttons/releases)
```

## 🔄 Następne wersje

### Dla nowych wersji:

1. **Zaktualizuj version w package.json:**

   ```json
   "version": "0.0.2"
   ```

2. **Zbuduj nowy pakiet:**

   ```bash
   npm run package
   ```

3. **Commit i push:**

   ```bash
   git add .
   git commit -m "Release v0.0.2"
   git push origin main
   ```

4. **Utwórz nowy Release** z tagiem `v0.0.2`

## 📊 Monitorowanie Downloads

GitHub automatycznie pokazuje:

- Liczbę downloads każdego release
- Statystyki ruchu w repository
- Stars i forks od użytkowników

---

**🚀 Gotowe! Użytkownicy mogą teraz łatwo pobrać i zainstalować Twoje rozszerzenie!**
