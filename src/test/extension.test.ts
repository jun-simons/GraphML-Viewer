import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

suite('GraphML Viewer – minimal tests', () => {
  // Give VS Code a bit more time in CI
  suiteSetup(function () {
    this.timeout(15_000);
  });

  test('command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('graphmlViewer.open'),
      'graphmlViewer.open should be contributed'
    );
  });

  test('opens preview on a sample GraphML file without throwing', async function () {
    this.timeout(20_000);

    // 1) Make a temp .graphml file
    const tmpFile = vscode.Uri.file(path.join(os.tmpdir(), `sample-${Date.now()}.graphml`));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="n0"/>
    <node id="n1"/>
    <edge id="e0" source="n0" target="n1"/>
  </graph>
</graphml>`;
    await vscode.workspace.fs.writeFile(tmpFile, Buffer.from(xml, 'utf8'));

    // 2) Open the text document so VS Code has a resource to the left
    const doc = await vscode.workspace.openTextDocument(tmpFile);
    await vscode.window.showTextDocument(doc, { preview: true });

    // 3) Execute our command with the file URI
    // If the command throws, the test will fail.
    await vscode.commands.executeCommand('graphmlViewer.open', tmpFile);

    // 4) Sanity check: there should now be a webview panel open with our title
    const visible = vscode.window.tabGroups.all
      .flatMap(g => g.tabs)
      .some(t => (t.label || '').toLowerCase().includes('graphml'));
    assert.ok(visible, 'A GraphML preview tab should be visible');
  });
});
