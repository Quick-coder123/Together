// Google Gemini call with retries: when a model is overloaded (503/429/500) or unavailable (404),
// waits a moment and tries again, then falls back to other free models.
const KEY = process.env.GEMINI_API_KEY;
const MODELS = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const geminiOn = () => !!KEY;
export async function geminiJson(payload, { timeout = 25000, budget = 45000 } = {}) {
  const started = Date.now();
  let lastErr;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - started > budget) break;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(timeout),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastErr = new Error(`${model} ${res.status}: ${data?.error?.message || ''}`);
          if (res.status === 404 || res.status === 400) break; // try next model
          if ([429, 500, 502, 503, 504].includes(res.status)) { await sleep(700 * (attempt + 1)); continue; }
          throw lastErr;
        }
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        const m = text.match(/\{[\s\S]*\}/);
        return JSON.parse(m ? m[0] : text);
      } catch (e) {
        lastErr = e;
        if (e.name === 'TimeoutError' || e.name === 'AbortError') break;
        if (e instanceof SyntaxError) continue;
      }
    }
  }
  console.error('gemini failed', lastErr?.message);
  throw lastErr || new Error('Gemini unavailable');
}
