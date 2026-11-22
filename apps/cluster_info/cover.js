'use strict';
/**
 * cover.js - the album picture, from the car's HmiMediaState.coverArt (iX3 G08, Nov 22 2026):
 *   { sink, menuEntry, trackId, coverArt: [bytes], coverArtId, totalSize, offset }
 * The picture comes in pieces: each notification carries the bytes from offset, of totalSize in all (seen with
 * CarPlay: totalSize 0, no bytes, so no picture for that song). The pieces are put together here; a whole
 * picture is told by its first bytes (PNG, JPEG) and a PNG is decoded (zlib, the five filters) and made small
 * (SIZE x SIZE) for the HUD. JPEG is only recognised for now.
 */
const zlib = require('zlib');

const SIZE = 44;            // the picture on the HUD, square
const MAX_BYTES = 2 << 20;  // a picture larger than this is not put together

/** The bytes in a coverArt value: an array of numbers, a { type: 'Buffer', data } or a base64 string. */
function bytesOf(x) {
    if (!x) return null;
    if (Buffer.isBuffer(x)) return x;
    if (Array.isArray(x)) return Buffer.from(x);
    if (x instanceof Uint8Array) return Buffer.from(x);
    if (typeof x === 'object' && Array.isArray(x.data)) return Buffer.from(x.data);
    if (typeof x === 'string' && x.length) { try { return Buffer.from(x, 'base64'); } catch (e) { return null; } }
    return null;
}
const kindOf = (b) => (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 ? 'PNG'
    : b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 ? 'JPEG' : 'unknown (' + b.slice(0, 4).toString('hex') + ')');

/** A PNG (8 bit; grey, grey+alpha, RGB, RGBA, palette) to { w, h, rgba }; throws on anything else. */
function decodePng(buf) {
    let p = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, pal = null, trns = null;
    const idat = [];
    while (p + 8 <= buf.length) {
        const len = buf.readUInt32BE(p), name = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
        if (name === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
        else if (name === 'PLTE') pal = d;
        else if (name === 'tRNS') trns = d;
        else if (name === 'IDAT') idat.push(d);
        else if (name === 'IEND') break;
        p += 12 + len;
    }
    if (depth !== 8 || interlace) throw new Error('PNG ' + depth + ' bit' + (interlace ? ', interlaced' : '') + ': not supported');
    const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
    if (!ch || !w || !h || w * h > 4e6) throw new Error('PNG type ' + type + ' ' + w + 'x' + h + ': not supported');
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride;
        for (let i = 0; i < stride; i++) {
            const a = i >= ch ? px[o + i - ch] : 0, b = y ? px[o - stride + i] : 0, c = y && i >= ch ? px[o - stride + i - ch] : 0;
            let v = raw[src + i];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            px[o + i] = v & 255;
        }
    }
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        let r, g, bl, al = 255;
        if (type === 0) { r = g = bl = px[i]; if (trns && trns.length >= 2 && px[i] === trns[1]) al = 0; }
        else if (type === 4) { r = g = bl = px[i * 2]; al = px[i * 2 + 1]; }
        else if (type === 2) { r = px[i * 3]; g = px[i * 3 + 1]; bl = px[i * 3 + 2]; }
        else if (type === 6) { r = px[i * 4]; g = px[i * 4 + 1]; bl = px[i * 4 + 2]; al = px[i * 4 + 3]; }
        else { const k = px[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; bl = pal[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
        rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = bl; rgba[i * 4 + 3] = al;
    }
    return { w, h, rgba };
}

/** img made s x s (the middle square, each pixel the average of the pixels it covers). */
function square(img, s) {
    const side = Math.min(img.w, img.h), ox = (img.w - side) >> 1, oy = (img.h - side) >> 1, out = Buffer.alloc(s * s * 4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const x0 = ox + Math.floor(x * side / s), x1 = Math.max(x0 + 1, ox + Math.floor((x + 1) * side / s));
        const y0 = oy + Math.floor(y * side / s), y1 = Math.max(y0 + 1, oy + Math.floor((y + 1) * side / s));
        const sum = [0, 0, 0, 0];
        let n = 0;
        for (let yy = y0; yy < y1; yy += Math.max(1, (y1 - y0) >> 2)) for (let xx = x0; xx < x1; xx += Math.max(1, (x1 - x0) >> 2)) {
            const i = (yy * img.w + xx) * 4;
            for (let k = 0; k < 4; k++) sum[k] += img.rgba[i + k];
            n++;
        }
        for (let k = 0; k < 4; k++) out[(y * s + x) * 4 + k] = Math.round(sum[k] / n);
    }
    return { w: s, h: s, rgba: out };
}

/** The pieces put together: put(value) for each notification; picture() the small picture or null. */
function Cover(opts) {
    const size = (opts && opts.size) || SIZE;
    let id = null, total = 0, buf = null, got = 0, pic = null, state = 'nothing received', pieces = 0;
    const find = (v, d) => {
        if (!v || typeof v !== 'object' || d > 4) return null;
        if ('totalSize' in v || 'coverArt' in v) return v;
        for (const k of Object.keys(v)) { const r = find(v[k], d + 1); if (r) return r; }
        return null;
    };
    return {
        put(v) {
            const c = find(v, 0);
            if (!c) { state = 'no coverArt member'; return; }
            const t = Number(c.totalSize) || 0, off = Number(c.offset) || 0, key = String(c.coverArtId) + '/' + c.trackId + '/' + t;
            const b = bytesOf(c.coverArt);
            if (key !== id) { id = key; total = t; got = 0; pieces = 0; buf = t > 0 && t <= MAX_BYTES ? Buffer.alloc(t) : null; pic = null; }
            if (!t) { state = 'no picture for this song (totalSize 0)'; return; }
            if (!buf) { state = 'picture too large (' + t + ' bytes)'; return; }
            if (b && b.length) {
                pieces++;
                b.copy(buf, off, 0, Math.min(b.length, t - off));
                got = Math.min(t, Math.max(got, off + b.length));
            }
            state = got + ' of ' + t + ' bytes in ' + pieces + ' piece' + (pieces === 1 ? '' : 's');
            if (got >= t && !pic) {
                const kind = kindOf(buf);
                if (kind === 'PNG') {
                    try { const img = decodePng(buf); pic = square(img, size); state = 'PNG ' + img.w + 'x' + img.h + ', shown'; } catch (e) { state = String(e.message || e); }
                } else state = kind + ', ' + t + ' bytes: not drawn yet (' + (kind === 'JPEG' ? 'a JPEG decoder is needed' : 'unknown format') + ')';
            }
        },
        picture: () => pic,
        state: () => state,
        id: () => id,
    };
}

module.exports = { Cover, decodePng, square, bytesOf, kindOf, SIZE };
