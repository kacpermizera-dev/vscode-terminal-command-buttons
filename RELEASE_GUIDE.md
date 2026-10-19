# Wydanie nowej wersji

Każda wersja trafia w dwa miejsca: **GitHub Releases** (plik `.vsix`) i **VS Code Marketplace**. Komendy są dla PowerShella, uruchamiane z katalogu projektu.

## 1. Przygotowanie

1. Podbij `version` w `package.json` (np. `1.0.1`) i zsynchronizuj `package-lock.json`:

   ```powershell
   npm install --package-lock-only --ignore-scripts
   ```

2. W `CHANGELOG.md` dodaj sekcję `## [X.Y.Z] - RRRR-MM-DD`.
3. Przygotuj notatki do release'u w osobnym pliku `.md` (np. sekcja z CHANGELOG plus „Install”). Notatki zawsze podawaj przez `--notes-file`: wklejone do edytora na GitHubie albo w cudzysłowie w PowerShellu psują się (ukośniki, `${...}`).

## 2. Testy i paczka

```powershell
# Przykładowe przyciski w test-workspace zmieniają się przy testach migracji
git checkout test-workspace

npm test
npx @vscode/vsce package
```

Powstaje `terminal-command-buttons-X.Y.Z.vsix` (pliki `.vsix` są w `.gitignore`).

## 3. Commit, tag, GitHub Release

```powershell
git add -A
git status
git commit -m "Release X.Y.Z: krótki opis"
git push origin master
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin vX.Y.Z

gh release create vX.Y.Z terminal-command-buttons-X.Y.Z.vsix --title "Terminal Command Buttons vX.Y.Z" --notes-file "ścieżka\do\notatek.md" --latest
```

## 4. Marketplace

Wydawca: **kacpermizera-dev** (https://marketplace.visualstudio.com/manage).

### Bez tokena: przez stronę

1. https://marketplace.visualstudio.com/manage → wydawca `kacpermizera-dev`.
2. Pierwsza publikacja: **+ New extension → Visual Studio Code** i przeciągnij plik `.vsix`.
3. Kolejne wersje: przy rozszerzeniu **⋯ → Update** i przeciągnij nowy `.vsix`.

Weryfikacja trwa zwykle kilka minut, potem rozszerzenie jest w wyszukiwarce VS Code.

### Z tokenem: z terminala

Token (Personal Access Token) tworzy się w Azure DevOps (https://dev.azure.com, to samo konto Microsoft):
**User settings → Personal access tokens → New Token**, Organization: **All accessible organizations**, Scopes: **Custom defined → Show all scopes → Marketplace → Manage**.

```powershell
npx @vscode/vsce login kacpermizera-dev   # jednorazowo, wkleja się token
npx @vscode/vsce publish --packagePath terminal-command-buttons-X.Y.Z.vsix
```

### Open VSX (opcjonalnie: Cursor, VSCodium)

Konto i token na https://open-vsx.org, potem:

```powershell
npx ovsx publish terminal-command-buttons-X.Y.Z.vsix -p <token>
```

## 5. Po publikacji

```powershell
code --install-extension terminal-command-buttons-X.Y.Z.vsix --force
```

Zainstalowana wersja z VSIX i ta z Marketplace to to samo rozszerzenie (`kacpermizera-dev.terminal-command-buttons`), więc VS Code będzie je dalej aktualizował z Marketplace.

## CI

`.github/workflows/ci.yml` przy każdym pushu na `master` i przy PR buduje rozszerzenie, uruchamia lint i testy, i zostawia gotowy `.vsix` jako artefakt (zakładka **Actions** → wybrany run → **Artifacts**).
