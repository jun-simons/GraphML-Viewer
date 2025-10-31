# GraphML Viewer

*Preview and explore `.graphml` files directly inside VS Code.*

GraphML Viewer lets you open a side-by-side, interactive graph view with layouts, search, click-to-source, and PNG export.

## Get started

1) Install **GraphML Viewer** from the VS Code Marketplace  
2) Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS) to open the Command Palette  
3) Run **“GraphML: Open Preview”**  
4) Open a `.graphml` file (or run the command from an open `.graphml` tab)

## Features

- **Instant preview** of `.graphml` in an interactive panel
- **Layouts:** cose (force), grid, concentric, breadth-first
- **Search nodes** by id; auto-selects and centers matches
- **Click a node → jump to XML** in the editor
- **PNG export** of current view
- **Live reload on save** 

## Usage tips

- Use the toolbar to switch layouts, fit the view, search by id, and export PNG  
- Large graphs: start with **grid** or **breadth-first**, then try force layout  
- Note: The viewer falls back to node `id` when `label` is absent

## Requirements

- Visual Studio Code **1.96.0** or newer

## Release notes

### 0.0.1
- Initial release: preview panel, multiple layouts, search, click-to-source, directed/undirected arrows, PNG export, live reload, error banner

**Enjoy!**
