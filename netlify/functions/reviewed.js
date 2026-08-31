// Renders a simple, unlisted HTML page showing every "good pick" saved so
// far, newest first — for periodically reviewing patterns and refining the
// prompt. Not password-protected: relying on the URL being unlisted rather
// than shared publicly. Fine for a small private beta, not for wider use.
const { getStore } = require('@netlify/blobs');

exports.handler = async function () {
  try {
    const store = getStore({ name: 'add-vantage-feedback' });
    const { blobs } = await store.list();

    const entries = [];
    for (const b of blobs) {
      const data = await store.get(b.key, { type: 'json' });
      if (data) entries.push(data);
    }
    entries.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

    const cards = entries.map(e => `
      <div class="card">
        <img src="data:image/jpeg;base64,${e.imageBase64}" alt="${escapeHtml(e.title)}">
        <div class="body">
          <div class="meta">${escapeHtml(e.mode)} · ${escapeHtml((e.savedAt || '').replace('T', ' ').slice(0, 16))}</div>
          <div class="title">${escapeHtml(e.title)}</div>
          <div class="reason">${escapeHtml(e.reason)}</div>
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Add Vantage — liked snippets</title>
<style>
  body{background:#121212;color:#f5f3ee;font-family:-apple-system,sans-serif;margin:0;padding:24px;}
  h1{font-size:20px;margin:0 0 4px;}
  .count{color:#a39d92;font-size:13px;margin-bottom:24px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;}
  .card{background:#1b1b1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;}
  .card img{width:100%;display:block;background:#232322;}
  .body{padding:12px 14px;}
  .meta{font-size:11px;color:#6f6a61;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;}
  .title{font-size:15px;font-weight:600;margin-bottom:4px;}
  .reason{font-size:13px;color:#a39d92;line-height:1.4;}
  .empty{color:#6f6a61;padding:40px 0;text-align:center;}
</style></head>
<body>
  <h1>Liked snippets</h1>
  <div class="count">${entries.length} saved</div>
  <div class="grid">${cards || '<div class="empty">No feedback saved yet.</div>'}</div>
</body></html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Could not load feedback: ' + (err && err.message ? err.message : String(err))
    };
  }
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
