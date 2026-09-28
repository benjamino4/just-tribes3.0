// =====================================================================
// Admin emoji CRUD + file upload. Mounted at /api/admin/emoji.
// =====================================================================
import express from 'express';
import { q } from '../db.js';
import { requireAdmin } from '../admin.js';
import {
  sanitizeSvg, isValidKey, slugifyKey, isRaster, isSvg,
} from '../lib/sanitizeSvg.js';

const router = express.Router();
router.use(requireAdmin);

/* ---------- tiny multipart parser (no new deps) ---------- */
function parseMultipart(buf, boundary) {
  const out = [];
  const b = '--' + boundary;
  const parts = buf.split(Buffer.from('\r\n' + b));
  for (const raw of parts) {
    if (!raw.length) continue;
    const headerEnd = raw.indexOf('\r\n\r\n');
    if (headerEnd < 0) continue;
    const headerText = raw.slice(0, headerEnd).toString('utf8');
    const body = raw.slice(headerEnd + 4);
    let bodyBuf = body;
    if (bodyBuf.length >= 2 && bodyBuf[bodyBuf.length - 2] === 0x0d && bodyBuf[bodyBuf.length - 1] === 0x0a) {
      bodyBuf = bodyBuf.slice(0, bodyBuf.length - 2);
    }
    const nameM  = /name="([^"]+)"/.exec(headerText);
    const fileM  = /filename="([^"]*)"/.exec(headerText);
    const ctypeM = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
    out.push({
      field: nameM ? nameM[1] : null,
      filename: fileM ? fileM[1] : null,
      contentType: ctypeM ? ctypeM[1].trim() : null,
      data: bodyBuf,
    });
  }
  return out;
}

async function readRawBody(req, limitBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limitBytes) return reject(new Error('body too large'));
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---------- list ---------- */
router.get('/', async (_req, res) => {
  try {
    const [defs, sets] = await Promise.all([
      q(`SELECT id, key, name, svg, image_url, set_slug, price_stars,
                sort_order, builtin, active, created_at
           FROM emoji_defs ORDER BY sort_order, id`),
      q(`SELECT id, slug, name, description, price_stars, emoji_keys, sort_order, active
           FROM emoji_sets ORDER BY sort_order, id`),
    ]);
    res.json({ ok: true, defs: defs.rows, sets: sets.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/* ---------- create ---------- */
router.post('/', async (req, res) => {
  try {
    const { key, name, svg, image_url, set_slug = null, price_stars = 0, sort_order = 100 } = req.body || {};
    if (!isValidKey(key)) return res.status(400).json({ ok: false, error: 'invalid key' });
    let cleanSvg = null;
    if (svg) {
      cleanSvg = sanitizeSvg(svg);
      if (!cleanSvg) return res.status(400).json({ ok: false, error: 'invalid svg' });
    }
    if (!cleanSvg && !image_url) return res.status(400).json({ ok: false, error: 'svg or image_url required' });
    const r = await q(
      `INSERT INTO emoji_defs (key, name, svg, image_url, set_slug, price_stars, sort_order, builtin, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,true,$8)
       RETURNING id`,
      [key, name || key, cleanSvg, image_url || null, set_slug, price_stars | 0, sort_order | 0, req.adminId || null]
    );
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    if (String(e.message).includes('duplicate')) return res.status(409).json({ ok: false, error: 'key already exists' });
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/* ---------- update ---------- */
router.post('/update', async (req, res) => {
  try {
    const { id, name, svg, image_url, set_slug, price_stars, sort_order, active } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const current = await q('SELECT id, builtin FROM emoji_defs WHERE id = $1', [id]);
    if (!current.rowCount) return res.status(404).json({ ok: false, error: 'not found' });
    const isBuiltin = current.rows[0].builtin;

    const sets = [];
    const vals = [];
    if (name !== undefined)       { sets.push(`name = $${vals.length + 1}`);          vals.push(name); }
    if (sort_order !== undefined) { sets.push(`sort_order = $${vals.length + 1}`);    vals.push(sort_order | 0); }
    if (active !== undefined)     { sets.push(`active = $${vals.length + 1}`);        vals.push(!!active); }
    if (!isBuiltin) {
      if (svg !== undefined) {
        const c = sanitizeSvg(svg);
        if (!c) return res.status(400).json({ ok: false, error: 'invalid svg' });
        sets.push(`svg = $${vals.length + 1}`); vals.push(c);
      }
      if (image_url !== undefined)  { sets.push(`image_url = $${vals.length + 1}`);   vals.push(image_url || null); }
      if (set_slug !== undefined)   { sets.push(`set_slug = $${vals.length + 1}`);    vals.push(set_slug || null); }
      if (price_stars !== undefined){ sets.push(`price_stars = $${vals.length + 1}`); vals.push(price_stars | 0); }
    }
    if (!sets.length) return res.json({ ok: true, unchanged: true });
    sets.push('updated_at = now()');
    vals.push(id);
    await q(`UPDATE emoji_defs SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/* ---------- delete ---------- */
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const r = await q('DELETE FROM emoji_defs WHERE id = $1 AND builtin = false RETURNING id', [id]);
    if (!r.rowCount) return res.status(403).json({ ok: false, error: 'builtin cannot be deleted, or not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/* ---------- upload ---------- */
router.post('/upload', async (req, res) => {
  try {
    const ct = req.get('content-type') || '';
    const boundaryM = /boundary=(.+)$/i.exec(ct);
    if (!boundaryM) return res.status(400).json({ ok: false, error: 'multipart required' });
    const boundary = boundaryM[1].replace(/^"|"$/g, '');

    const raw = await readRawBody(req);
    const parts = parseMultipart(raw, boundary);

    const prefix    = String((req.query.prefix || '').trim()).slice(0, 20);
    const set_slug  = (req.query.set_slug || '').trim() || null;
    const price     = Number(req.query.price_stars || 0) | 0;
    const sortOrder = Number(req.query.sort_order || 100) | 0;

    const created = [];
    const failed  = [];

    for (const p of parts) {
      if (!p.filename) continue;
      try {
        const isSvgFile = isSvg(p.contentType, p.filename);
        const isRasterFile = isRaster(p.contentType) || /\.(png|jpe?g|webp)$/i.test(p.filename);
        if (!isSvgFile && !isRasterFile) { failed.push({ file: p.filename, reason: 'unsupported type' }); continue; }

        const base = slugifyKey(p.filename);
        if (!base) { failed.push({ file: p.filename, reason: 'invalid filename' }); continue; }
        const key = prefix && !base.startsWith(prefix) ? `${prefix}-${base}` : base;
        if (!isValidKey(key)) { failed.push({ file: p.filename, reason: 'invalid key: ' + key }); continue; }

        let cleanSvg = null;
        let imageUrl = null;
        if (isSvgFile) {
          cleanSvg = sanitizeSvg(p.data.toString('utf8'));
          if (!cleanSvg) { failed.push({ file: p.filename, reason: 'invalid svg' }); continue; }
        } else {
          if (p.data.length > 400_000) { failed.push({ file: p.filename, reason: 'raster > 400 KB' }); continue; }
          const mime = p.contentType || 'image/png';
          imageUrl = `data:${mime};base64,${p.data.toString('base64')}`;
        }

        const name = base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);

        await q(
          `INSERT INTO emoji_defs (key, name, svg, image_url, set_slug, price_stars, sort_order, builtin, active, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,false,true,$8)
           ON CONFLICT (key) DO UPDATE SET
             svg = EXCLUDED.svg,
             image_url = EXCLUDED.image_url,
             name = COALESCE(EXCLUDED.name, emoji_defs.name),
             set_slug = COALESCE(EXCLUDED.set_slug, emoji_defs.set_slug),
             price_stars = EXCLUDED.price_stars,
             updated_at = now()`,
          [key, name, cleanSvg, imageUrl, set_slug, price, sortOrder, req.adminId || null]
        );
        created.push(key);
      } catch (err) {
        failed.push({ file: p.filename, reason: String(err.message || err) });
      }
    }

    res.json({ ok: true, created, failed });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

/* ---------- seed built-ins ---------- */
router.post('/seed-builtins', async (req, res) => {
  try {
    const { BUILTIN_SEED } = await import('../lib/builtinEmojis.js');
    let inserted = 0;
    for (const e of BUILTIN_SEED) {
      if (!isValidKey(e.key)) continue;
      const r = await q(
        `INSERT INTO emoji_defs (key, name, svg, set_slug, price_stars, sort_order, builtin, active)
         VALUES ($1,$2,$3,$4,$5,$6,true,true)
         ON CONFLICT (key) DO NOTHING
         RETURNING id`,
        [e.key, e.name, e.svg, e.set_slug || null, e.price_stars || 0, e.sort_order || 100]
      );
      if (r.rowCount) inserted++;
    }
    res.json({ ok: true, inserted, total: BUILTIN_SEED.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

export const adminEmojiRouter = router;