// Stores "good pick" feedback using Netlify Blobs — a zero-setup key/value
// store built into Netlify, no external database needed.
const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { title, reason, imageBase64, mode, liked } = payload;

    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing image data' }) };
    }

    const store = getStore({ name: 'add-vantage-feedback' });
    const key = new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 8);

    await store.setJSON(key, {
      title: title || 'Untitled',
      reason: reason || '',
      mode: mode || 'unknown',
      liked: liked !== false, // default true for any old/malformed payloads
      imageBase64,
      savedAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not save feedback: ' + (err && err.message ? err.message : String(err)) })
    };
  }
};
