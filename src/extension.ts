import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand('graphmlViewer.open', async (uri?: vscode.Uri) => {
    try {
      const resource =
        uri ??
        vscode.window.activeTextEditor?.document.uri ??
        (await pickGraphML());
      if (!resource) return;

      const xml = new TextDecoder('utf-8')
        .decode(await vscode.workspace.fs.readFile(resource));

      const panel = vscode.window.createWebviewPanel(
        'graphmlViewer',
        `GraphML: ${resource.path.split('/').pop()}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      panel.webview.html = getHtml(panel.webview, context, xml, resource);

      // Live reload on save
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
        vscode.Uri.file(resource.fsPath).with({ query: '', fragment: '' }).fsPath, '*'
      ));
      watcher.onDidChange(async () => {
        const freshXml = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(resource));
        panel.webview.postMessage({ type: 'reload', xml: freshXml });
      });
      panel.onDidDispose(() => watcher.dispose());

      // Reveal in source (when user clicks a node)
      panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === 'reveal' && typeof msg.id === 'string') {
          await revealByNodeId(resource, msg.id);
        }
      });
    } catch (e: any) {
      vscode.window.showErrorMessage(`GraphML Viewer error: ${e.message || e}`);
      console.error(e);
    }
  });

  context.subscriptions.push(cmd);
}

async function pickGraphML(): Promise<vscode.Uri | undefined> {
  const picks = await vscode.window.showOpenDialog({
    openLabel: 'Open GraphML',
    canSelectMany: false,
    filters: { GraphML: ['graphml', 'xml'], All: ['*'] }
  });
  return picks?.[0];
}

// Naive reveal: find first line containing id="theId"
async function revealByNodeId(resource: vscode.Uri, id: string) {
  const doc = await vscode.workspace.openTextDocument(resource);
  const editor = await vscode.window.showTextDocument(doc, { preview: false });

  const text = doc.getText();
  const needle = `id="${id}"`;
  const idx = text.indexOf(needle);
  if (idx >= 0) {
    const before = text.slice(0, idx);
    const line = (before.match(/\n/g) || []).length;
    const col = idx - (before.lastIndexOf('\n') + 1);
    const pos = new vscode.Position(line, col);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(pos, pos);
  } else {
    vscode.window.showInformationMessage(`Could not find id="${id}" in source`);
  }
}

function getHtml(webview: vscode.Webview, ctx: vscode.ExtensionContext, xml: string, src: vscode.Uri) {
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const media = vscode.Uri.joinPath(ctx.extensionUri, 'media');
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(media, 'cytoscape.min.js'));
  const viewerJsUri  = webview.asWebviewUri(vscode.Uri.joinPath(media, 'viewer.js'));

  const b64 = Buffer.from(xml, 'utf8').toString('base64');

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`
  ].join('; ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>GraphML Preview</title>
<!-- initial XML payload (base64) -->
<meta id="initial-xml" data-b64="${b64}">
<style>
  :root { --chrome:#f6f6f7; --border:#e3e3e4; --text:#111; --muted:#666; }
  html,body { height:100%; margin:0; font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; color:var(--text); }
  .toolbar { display:flex; gap:.5rem; align-items:center; padding:.5rem .75rem; border-bottom:1px solid var(--border); background:var(--chrome); position:sticky; top:0; z-index:10; }
  .toolbar .mono { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; color: var(--muted); }
  .toolbar input, .toolbar select, .toolbar button { font:inherit; padding:4px 8px; }
  .badges { margin-left:auto; color:var(--muted); }
  #cy { height: calc(100vh - 48px); }
  .hint { position:absolute; bottom:10px; left:10px; background:rgba(255,255,255,.9); border:1px solid var(--border); border-radius:8px; padding:4px 8px; }
</style>
</head>
<body>
  <div class="toolbar">
    <strong>Source:</strong> <span class="mono" title="${esc(src.toString())}">${esc(src.path.split('/').pop() || src.toString())}</span>
    <input id="search" placeholder="Search node id…" />
    <select id="layout">
      <option value="cose">Force (cose)</option>
      <option value="grid">Grid</option>
      <option value="concentric">Concentric</option>
      <option value="breadthfirst">Layered (breadthfirst)</option>
    </select>
    <button id="fit">Fit</button>
    <button id="png">Export PNG</button>
    <span class="badges" id="counts"></span>
  </div>
  <div id="cy"></div>
  <div class="hint" id="hint" style="display:none;">Click a node to reveal in source</div>

  <script src="${cytoscapeUri}"></script>
  <script src="${viewerJsUri}"></script>
</body>
</html>`;
}


export function deactivate() {}
