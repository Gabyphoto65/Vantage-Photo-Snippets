// Renders a simple, unlisted HTML page showing every piece of feedback
// saved so far, split into liked and rejected snippets, newest first —
// for periodically reviewing patterns and refining the prompt. Not
// password-protected: relying on the URL being unlisted rather than
// shared publicly. Fine for a small private beta, not for wider use.
const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async function (event) {
  // Same Lambda-compatibility-mode fix as feedback.js — without this,
  // getStore() below throws MissingBlobsEnvironmentError in production.
  connectLambda(event);

  try {
    const store = getStore({ name: 'add-vantage-feedback' });
    const { blobs } = await store.list();

    const entries = [];
    for (const b of blobs) {
      const data = await store.get(b.key, { type: 'json' });
      if (data) entries.push(data);
    }
    entries.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

    const liked = entries.filter(e => e.liked !== false);
    const rejected = entries.filter(e => e.liked === false);

    function cardsFor(list) {
      return list.map(e => `
        <div class="card">
          <img src="data:image/jpeg;base64,${e.imageBase64}" alt="${escapeHtml(e.title)}">
          <div class="body">
            <div class="meta">${escapeHtml(e.mode)} · ${escapeHtml((e.savedAt || '').replace('T', ' ').slice(0, 16))}</div>
            <div class="title">${escapeHtml(e.title)}</div>
            <div class="reason">${escapeHtml(e.reason)}</div>
          </div>
        </div>
      `).join('');
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Add Vantage — feedback review</title>
<style>
  body{background:#121212;color:#f5f3ee;font-family:-apple-system,sans-serif;margin:0;padding:24px;}
  h1{font-size:20px;margin:32px 0 4px;}
  h1:first-of-type{margin-top:0;}
  .count{color:#a39d92;font-size:13px;margin-bottom:16px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;}
  .card{background:#1b1b1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;}
  .card img{width:100%;display:block;background:#232322;}
  .body{padding:12px 14px;}
  .meta{font-size:11px;color:#6f6a61;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;}
  .title{font-size:15px;font-weight:600;margin-bottom:4px;}
  .reason{font-size:13px;color:#a39d92;line-height:1.4;}
  .empty{color:#6f6a61;padding:24px 0;text-align:center;}
  .liked h1{color:#e8a23d;}
  .rejected h1{color:#c96a5a;}
</style></head>
<body>
  <div class="liked">
    <h1>Good picks</h1>
    <div class="count">${liked.length} saved</div>
    <div class="grid">${cardsFor(liked) || '<div class="empty">None yet.</div>'}</div>
  </div>
  <div class="rejected">
    <h1>Not good picks</h1>
    <div class="count">${rejected.length} saved</div>
    <div class="grid">${cardsFor(rejected) || '<div class="empty">None yet.</div>'}</div>
  </div>
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
