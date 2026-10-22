import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="n0"/>
    <node id="n1"/>
    <edge id="e0" source="n0" target="n1"/>
  </graph>
</graphml>`;

async function writeTmp(name: string, contents = xml): Promise<vscode.Uri> {
  const uri = vscode.Uri.file(path.join(os.tmpdir(), `${Date.now()}-${name}`));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(contents, 'utf8'));
  return uri;
}

async function openInEditor(uri: vscode.Uri) {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

function previewTabs(): string[] {
  return vscode.window.tabGroups.all
    .flatMap(g => g.tabs)
    .filter(t => t.input instanceof vscode.TabInputWebview && t.label.startsWith('GraphML: '))
    .map(t => t.label);
}

// Tab state reaches the extension host asynchronously, so poll briefly
async function waitForPreviewTabs(count: number, timeoutMs = 5_000): Promise<string[]> {
  const start = Date.now();
  while (previewTabs().length < count && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 50));
  }
  return previewTabs();
}

suite('GraphML Viewer – minimal tests', () => {
  const window = vscode.window as any;
  const realShowOpenDialog = window.showOpenDialog;
  const realShowErrorMessage = window.showErrorMessage;
  let pickerCalls: number;
  let pickerResult: vscode.Uri[] | undefined;
  let errors: string[];

  // Give VS Code a bit more time in CI
  suiteSetup(async function () {
    this.timeout(15_000);
    await vscode.extensions.getExtension('JunSimons.graphml-viewer')?.activate();
  });

  setup(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    pickerCalls = 0;
    pickerResult = undefined;
    errors = [];
    window.showOpenDialog = async () => {
      pickerCalls++;
      return pickerResult;
    };
    window.showErrorMessage = async (msg: string) => {
      errors.push(msg);
      return undefined;
    };
  });

  teardown(() => {
    window.showOpenDialog = realShowOpenDialog;
    window.showErrorMessage = realShowErrorMessage;
  });

  test('command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('graphmlViewer.open'),
      'graphmlViewer.open should be contributed'
    );
  });

  test('command palette entry has no when-clause', () => {
    const ext = vscode.extensions.all.find(e => e.packageJSON?.name === 'graphml-viewer');
    assert.ok(ext, 'extension should be installed');
    const entries = ext.packageJSON.contributes.menus.commandPalette;
    const entry = entries.find((m: any) => m.command === 'graphmlViewer.open');
    assert.ok(entry, 'commandPalette entry should exist');
    assert.strictEqual(entry.when, undefined);
  });

  test('opens preview on a sample GraphML file without throwing', async function () {
    this.timeout(20_000);
    const tmpFile = await writeTmp('sample.graphml');
    await openInEditor(tmpFile);

    await vscode.commands.executeCommand('graphmlViewer.open', tmpFile);

    assert.strictEqual((await waitForPreviewTabs(1)).length, 1, 'A GraphML preview tab should be visible');
    assert.strictEqual(pickerCalls, 0);
  });

  test('no editor open: shows the picker and previews the picked file', async function () {
    this.timeout(20_000);
    const picked = await writeTmp('picked.graphml');
    pickerResult = [picked];

    await vscode.commands.executeCommand('graphmlViewer.open');

    assert.strictEqual(pickerCalls, 1);
    assert.deepStrictEqual(await waitForPreviewTabs(1), [`GraphML: ${path.basename(picked.path)}`]);
  });

  test('unrelated file active: shows the picker instead of reading it', async function () {
    this.timeout(20_000);
    const unrelated = await writeTmp('notes.ts', 'export const x = 1;\n');
    await openInEditor(unrelated);

    await vscode.commands.executeCommand('graphmlViewer.open');

    assert.strictEqual(pickerCalls, 1);
    assert.deepStrictEqual(previewTabs(), [], 'cancelled picker should not open a preview');
    assert.deepStrictEqual(errors, []);
  });

  for (const name of ['active.graphml', 'active.xml', 'ACTIVE.GRAPHML']) {
    test(`${name} active: previews the active file`, async function () {
      this.timeout(20_000);
      const file = await writeTmp(name);
      await openInEditor(file);

      await vscode.commands.executeCommand('graphmlViewer.open');

      assert.strictEqual(pickerCalls, 0);
      assert.deepStrictEqual(await waitForPreviewTabs(1), [`GraphML: ${path.basename(file.path)}`]);
    });
  }

  test('picker cancelled: exits cleanly', async function () {
    this.timeout(20_000);
    pickerResult = undefined;

    await vscode.commands.executeCommand('graphmlViewer.open');

    assert.strictEqual(pickerCalls, 1);
    assert.deepStrictEqual(previewTabs(), []);
    assert.deepStrictEqual(errors, []);
  });

  test('explicit URI (Explorer) takes precedence over the active file', async function () {
    this.timeout(20_000);
    const active = await writeTmp('active.graphml');
    const clicked = await writeTmp('clicked.graphml');
    await openInEditor(active);

    await vscode.commands.executeCommand('graphmlViewer.open', clicked);

    assert.strictEqual(pickerCalls, 0);
    assert.deepStrictEqual(await waitForPreviewTabs(1), [`GraphML: ${path.basename(clicked.path)}`]);
  });
});
