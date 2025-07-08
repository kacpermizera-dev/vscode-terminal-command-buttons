# 🖥️ Terminal Command Buttons

A VS Code extension that adds configurable command buttons to your terminal interface. Execute your most-used commands with a single click!

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **🎯 Quick Commands**: Add custom command buttons for instant execution
- **📋 Scrollable Panel**: View and manage all your commands in a clean interface
- **⚙️ Easy Configuration**: Add, edit, and delete buttons directly from the UI
- **🎨 Color Coding**: Assign custom colors to organize your commands
- **💾 Persistent Storage**: Your buttons are saved in workspace/user settings
- **🔗 Terminal Integration**: Commands execute in your active terminal

## 🚀 Quick Start

### Installation

1. Install the extension in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"Terminal Command Buttons: Open Terminal Command Buttons"**
4. The panel will appear in the Explorer sidebar

### Adding Your First Button

1. Click the **"+ Add"** button in the Terminal Commands panel
2. Enter:
   - **Button Name**: Display name (e.g., "List Files")
   - **Command**: Command to execute (e.g., `ls -la`)
   - **Color**: Choose a color for visual organization
3. Click **"Save"**
4. Click your new button to execute the command!

## 🎯 Usage

### Pre-configured Buttons

The extension comes with useful default buttons:
- 📁 **List Files** - `ls -la`
- 🟢 **Node.js Version** - `node --version`
- 📦 **NPM Version** - `npm --version`
- 🌿 **Git Status** - `git status`
- 📍 **Current Directory** - `pwd`

### Custom Commands

Add any command you use frequently:
- `npm install` - Install dependencies
- `npm start` - Start development server
- `git pull` - Pull latest changes
- `docker ps` - List Docker containers
- `python --version` - Check Python version

### Managing Buttons

- **Execute**: Click any button to run its command
- **Delete**: Click the "×" button on any command button
- **Add New**: Use the "+ Add" button or Command Palette
- **Organize**: Use different colors to group related commands

## ⚙️ Configuration

The extension stores button configurations in VS Code settings:

```json
{
  "terminalCommandButtons.buttons": [
    {
      "id": "unique-id",
      "name": "My Command",
      "command": "echo 'Hello World'",
      "color": "#007acc"
    }
  ]
}
```

## 🔧 Commands

Access these commands via the Command Palette:

- **Terminal Command Buttons: Open Terminal Command Buttons** - Open the buttons panel
- **Terminal Command Buttons: Add New Command Button** - Add a button via input prompts

## 📋 Requirements

- VS Code 1.101.0 or higher
- Terminal access in your workspace

## 🏗️ Development

### Building from Source

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new Extension Development Host window

### Project Structure

```
src/
├── extension.ts          # Main extension logic
└── test/
    └── extension.test.ts # Extension tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 Changelog

### 0.0.1

- ✅ Initial release
- ✅ Configurable command buttons
- ✅ Terminal integration
- ✅ Color-coded organization
- ✅ Persistent storage

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- VS Code Extension API documentation
- VS Code community for inspiration and feedback

---

**Made with ❤️ for VS Code developers**
