import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const open = vscode.commands.registerCommand('graphmlViewer.open', async (uri?: vscode.Uri) => {
    const resource =
      uri ??
      vscode.window.activeTextEditor?.document.uri ??
      (await promptForGraphML());
    if (!resource) { return; }

    // Read file
    const xmlBytes = await vscode.workspace.fs.readFile(resource);
    const xml = new TextDecoder('utf-8').decode(xmlBytes);

    // Create panel
    const panel = vscode.window.createWebviewPanel(
      'graphmlViewer',
      `GraphML: ${resource.path.split('/').pop()}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Send initial HTML with inline script (no external libs)
    panel.webview.html = getHtml(panel.webview, context, xml, resource.toString());

    // Live reload on save
    const watcher = vscode.workspace.createFileSystemWatcher(resource.fsPath);
    watcher.onDidChange(async () => {
      const fresh = await vscode.workspace.fs.readFile(resource);
      const freshXml = new TextDecoder('utf-8').decode(fresh);
      panel.webview.postMessage({ type: 'reload', xml: freshXml });
    });
    panel.onDidDispose(() => watcher.dispose());

    // Handle messages from webview (e.g., reveal in editor TODO)
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === 'log') {
        console.log('[webview]', msg.payload);
      }
    });
  });

  context.subscriptions.push(open);
}

async function promptForGraphML(): Promise<vscode.Uri | undefined> {
  const picks = await vscode.window.showOpenDialog({
    openLabel: 'Open GraphML',
    canSelectMany: false,
    filters: { GraphML: ['graphml', 'xml'], All: ['*'] }
  });
  return picks?.[0];
}

function getHtml(webview: vscode.Webview, _ctx: vscode.ExtensionContext, xml: string, src: string) {
  // NOTE: no external scripts or styles to keep CSP simple.
  // parse XML in-browser and count nodes/edges as a smoke test.
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};"
/>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GraphML Preview</title>
<style>
  html, body { height: 100%; padding: 0; margin: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
  .toolbar { display:flex; gap:.5rem; align-items:center; padding:.5rem .75rem; border-bottom: 1px solid rgba(0,0,0,.1); }
  .content { padding: .75rem; }
  .badge { display:inline-block; padding:.15rem .5rem; border-radius:.5rem; background:#eee; margin-right:.5rem; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
  #preview { height: calc(100vh - 64px); border: 1px dashed rgba(0,0,0,.1); border-radius: .5rem; display:flex; align-items:center; justify-content:center; color: rgba(0,0,0,.6);}
</style>
</head>
<body>
  <div class="toolbar">
    <strong>Source:</strong> <span class="mono" title="${esc(src)}">${esc(src)}</span>
    <span id="counts"></span>
    <button id="fitBtn">Fit</button>
    <button id="exportBtn">Export PNG</button>
  </div>
  <div class="content">
    <div id="preview">Graph renderer coming next — for now we parse & count.</div>
    <details style="margin-top:.75rem;">
      <summary>Raw XML (truncated)</summary>
      <pre class="mono" id="raw"></pre>
    </details>
  </div>

<script>
(() => {
  const vscode = acquireVsCodeApi();
  let currentXml = \`${xml.replace(/`/g, '\\`')}\`;

  const raw = document.getElementById('raw');
  raw.textContent = (currentXml.length > 5000) ? currentXml.slice(0,5000) + '\\n…(truncated)…' : currentXml;

  function parseAndCount(xml) {
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const parserErr = doc.querySelector('parsererror');
      if (parserErr) { throw new Error(parserErr.textContent || 'XML parse error'); }
      const nodes = doc.getElementsByTagName('node').length;
      const edges = doc.getElementsByTagName('edge').length;
      const directedDefault = doc.querySelector('graph')?.getAttribute('edgedefault') || 'undirected';
      document.getElementById('counts').innerHTML =
        '<span class="badge">nodes: ' + nodes + '</span>' +
        '<span class="badge">edges: ' + edges + '</span>' +
        '<span class="badge">default: ' + directedDefault + '</span>';
      document.getElementById('preview').textContent =
        'Parsed OK. Nodes: ' + nodes + ', Edges: ' + edges + ' (' + directedDefault + ')';
    } catch (e) {
      document.getElementById('preview').textContent = 'Failed to parse XML: ' + e.message;
    }
  }

  parseAndCount(currentXml);

  window.addEventListener('message', (event) => {
    const { type, xml } = event.data || {};
    if (type === 'reload') {
      currentXml = xml;
      raw.textContent = (currentXml.length > 5000) ? currentXml.slice(0,5000) + '\\n…(truncated)…' : currentXml;
      parseAndCount(currentXml);
    }
  });

  document.getElementById('fitBtn').onclick = () => {
    vscode.postMessage({ type: 'log', payload: 'Fit clicked (placeholder)' });
  };
  document.getElementById('exportBtn').onclick = () => {
    vscode.postMessage({ type: 'log', payload: 'Export clicked (placeholder)' });
  };
})();
</script>
</body>
</html>`;
}

export function deactivate() {}
