# 🚀 Publishing VS Code Terminal Command Buttons Extension to GitHub

## Step-by-step instructions to create GitHub repository

### 1. Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in repository details:
   - **Repository name**: `vscode-terminal-command-buttons`
   - **Description**: `VS Code extension that adds configurable command buttons to terminal interface`
   - **Visibility**: Choose Public or Private
   - ❌ **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

### 2. Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/vscode-terminal-command-buttons.git

# Rename main branch (if needed)
git branch -M main

# Push code to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### 3. Verify Upload

1. Refresh your GitHub repository page
2. You should see all project files
3. Check that README.md displays properly

## 📋 Repository Structure

Your GitHub repository will contain:

```
vscode-terminal-command-buttons/
├── .github/
│   └── copilot-instructions.md     # Development guidelines
├── .vscode/                        # VS Code workspace settings
├── src/
│   ├── extension.ts               # Main extension code
│   └── test/                      # Test files
├── package.json                   # Extension manifest
├── README.md                      # Project documentation
├── LICENSE                        # MIT License
├── DEBUGGING.md                   # Debugging instructions
├── tsconfig.json                  # TypeScript configuration
├── webpack.config.js              # Build configuration
└── other config files...
```

## 🎯 Next Steps After Publishing

### 1. Enable GitHub Pages (Optional)

- Go to repository **Settings** → **Pages**
- Select source: **Deploy from a branch**
- Choose **main** branch and **/ (root)** folder

### 2. Add Repository Topics

- Go to repository main page
- Click the ⚙️ gear icon next to "About"
- Add topics: `vscode-extension`, `terminal`, `productivity`, `typescript`

### 3. Create Releases

- Go to **Releases** → **Create a new release**
- Tag version: `v0.0.1`
- Release title: `Initial Release - Terminal Command Buttons`
- Describe the features

### 4. Set Up GitHub Actions (Optional)

Consider adding CI/CD workflows for:

- Automated testing
- Building extension packages
- Publishing to VS Code Marketplace

## 🔗 Useful Links

- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/vscode)
- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [GitHub Repository Settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features)

## 🛡️ Security Notes

- Repository contains no sensitive information
- All API keys/tokens should be in environment variables (none needed for this extension)
- Consider enabling branch protection rules for main branch

---

**Ready to push to GitHub? Copy the commands from step 2 above! 🚀**
