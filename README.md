# GraphML Viewer

*Preview and explore `.graphml` files directly inside VS Code.*

GraphML Viewer lets you open a side-by-side, interactive graph view with layouts, search, click-to-source, and PNG export.

## Get started

1) Install **GraphML Viewer** from the VS Code Marketplace  
2) Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS) to open the Command Palette  
3) Select **“GraphML: Open Preview”**
   - With a `.graphml` or `.xml` file active, it previews that file
   - Otherwise, it prompts you to pick a file

You can also right-click a `.graphml` file in the Explorer and choose **GraphML: Open Preview**.

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

### 0.0.2
- **GraphML: Open Preview** is now always available in the Command Palette
- Running it from an unrelated file prompts for a file instead of previewing the active one
- `.graphml` / `.xml` extensions are matched case-insensitively

### 0.0.1
- Initial release: preview panel, multiple layouts, search, click-to-source, directed/undirected arrows, PNG export, live reload, error banner

**Enjoy!**
