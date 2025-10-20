/* global cytoscape, acquireVsCodeApi */
(() => {
  const vscode = acquireVsCodeApi();

  function decodeInitialXML() {
    const tag = document.getElementById('initial-xml');
    if (!tag) return '';
    const b64 = tag.getAttribute('data-b64') || '';
    try { return atob(b64); } catch { return ''; }
  }

  let currentXml = decodeInitialXML();

  function parseGraphML(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(err.textContent || 'XML parse error');

    const graph = doc.querySelector('graph');
    const directed = (graph && graph.getAttribute('edgedefault') || 'undirected') === 'directed';

    const keyMap = {};
    doc.querySelectorAll('key').forEach(k => {
      const id = k.getAttribute('id');
      const name = k.getAttribute('attrname') || id;
      keyMap[id] = name;
    });

    const nodes = Array.from(doc.getElementsByTagName('node')).map(n => {
      const id = n.getAttribute('id') || '';
      const data = {};
      n.querySelectorAll(':scope > data').forEach(d => {
        const key = keyMap[d.getAttribute('key')] || d.getAttribute('key');
        data[key] = d.textContent || '';
      });
      return { id, data };
    });

    const edges = Array.from(doc.getElementsByTagName('edge')).map(e => {
        const source = e.getAttribute('source') || '';
        const target = e.getAttribute('target') || '';
        const dirAttr = e.getAttribute('directed');              // optional per edge
        const isDirected = (dirAttr != null) ? (dirAttr === 'true') : directed;
        const data = {};
        e.querySelectorAll(':scope > data').forEach(d => {
            const key = keyMap[d.getAttribute('key')] || d.getAttribute('key');
            data[key] = d.textContent || '';
        });
        return { source, target, _arrow: (isDirected ? 'triangle' : 'none'), data };
    });

    return { nodes, edges, directed };
  }

  let cy = null;

  function layout(name) {
    try { cy.layout({ name }).run(); }
    catch { cy.layout({ name: 'grid' }).run(); }
    cy.fit();
  }

  function showError(msg) {
    const s = document.getElementById('status');
    if (s) { s.textContent = String(msg); s.style.display = 'block'; }
    }
    function clearError() {
    const s = document.getElementById('status');
    if (s) { s.textContent = ''; s.style.display = 'none'; }
    }


  function render(graph) {
    const elems = []
    .concat(graph.nodes.map(n => ({ data: { id: n.id, label: n.data.label || n.id, ...n.data } })))
    .concat(graph.edges.map(e => ({ data: { source: e.source, target: e.target, _arrow: e._arrow, ...e.data } })));


    if (!cy) {
      cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elems,
        style: [
          { selector: 'node', style: {
            'label': 'data(label)',
            'width': 24, 'height': 24,
            'background-color': '#888',
            'color': '#111',
            'font-size': 10,
            'text-wrap': 'wrap',
            'text-max-width': 100,
            'text-valign': 'center',
            'text-halign': 'center',
            'border-width': 1, 'border-color': '#333'
          }},
          { selector: 'edge', style: {
            'curve-style': 'bezier',
            'line-color': '#bbb',
            'target-arrow-color': '#bbb',
            'target-arrow-shape': 'data(_arrow)' // update based on key
          }},
          { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#0a84ff' } }
        ]
      });

      cy.on('tap', 'node', (evt) => {
        const id = evt.target.id();
        vscode.postMessage({ type: 'reveal', id });
      });
    } else {
      cy.elements().remove();
      cy.add(elems);
    }

    const layoutSelect = document.getElementById('layout');
    layout(layoutSelect ? layoutSelect.value : 'cose');

    const counts = document.getElementById('counts');
    if (counts) {
      counts.textContent = 'nodes: ' + graph.nodes.length +
        '  edges: ' + graph.edges.length +
        '  default: ' + (graph.directed ? 'directed' : 'undirected');
    }

    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'block';
  }

  // UI wiring
  document.getElementById('layout')?.addEventListener('change', e => layout(e.target.value));
  document.getElementById('fit')?.addEventListener('click', () => cy && cy.fit());
  document.getElementById('png')?.addEventListener('click', () => {
    if (!cy) return;
    const uri = cy.png({ full: true });
    const a = document.createElement('a'); a.href = uri; a.download = 'graph.png'; a.click();
  });
  document.getElementById('search')?.addEventListener('input', (e) => {
    if (!cy) return;
    const q = String(e.target.value || '').trim();
    cy.$('node').unselect();
    if (!q) return;
    const found = cy.$('node[id *= "' + q.replace(/"/g, '\\"') + '"]');
    if (found.length) { found.select(); cy.center(found[0]); }
  });

  // Initial render
try {
  render(parseGraphML(currentXml));
  clearError();               // <—
} catch (e) {
  // If a graph exists, clear it but DO NOT touch #cy innerHTML
  if (cy) cy.elements().remove();
  showError('Parse error: ' + (e && e.message || e));
}

// Live reload
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'reload') {
    currentXml = event.data.xml;
    try {
      render(parseGraphML(currentXml));
      clearError();           // <—
    } catch (e) {
      if (cy) cy.elements().remove();
      showError('Parse error: ' + (e && e.message || e));
    }
  }
});

})();
