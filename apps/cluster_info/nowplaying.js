'use strict';
/**
 * nowplaying.js - what the car is playing now, for one line on the HUD, from the car's own media signals
 * (found with the Media signals page, iX3 G08 catalog, Nov 22 2026):
 *
 *   hmi      HmiMediaState.playerMetadata: what the car's own media screen shows for any source (radio, USB,
 *            Bluetooth, phone apps): firstLineText / secondLineText (with firstLineType / secondLineType),
 *            threeRowText. The first choice.
 *   menu     HmiMediaState.mainMenuMetadata: the same for the main menu's media tile (firstLineText,
 *            secondLineText, thirdLineText).
 *   aa       AndroidAutoProjectedMediaPlayer.currentItemMetadata: songName, artistName (Android Auto).
 *   player   MediaPlayer.currentItemMetadata: the head unit's own player (a single value of its own shape:
 *            any member named like a title or artist is taken).
 *
 * The values' exact shapes are not known before the car sends them, so every reader looks for its member names
 * anywhere inside what came (structs, arrays, maps of key / value pairs). The raw values are kept for the
 * app's page, to be photographed if the line stays empty.
 */

/** Every value under key name(s) inside v, depth first: [values]. */
function all(v, re, out, depth) {
    out = out || [];
    if (!v || typeof v !== 'object' || (depth || 0) > 6) return out;
    // { key: 'title', value: 'x' } pairs (maps sent as arrays)
    if (typeof v.key === 'string' && re.test(v.key) && v.value !== undefined) out.push(v.value);
    for (const k of Object.keys(v)) {
        if (re.test(k) && (typeof v[k] === 'string' || typeof v[k] === 'number')) out.push(v[k]);
        else all(v[k], re, out, (depth || 0) + 1);
    }
    return out;
}
const str = (x) => (typeof x === 'string' ? x.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() : '');
const first = (v, re) => all(v, re).map(str).find((s) => s) || '';

/** HmiMediaState.playerMetadata / mainMenuMetadata: { title, artist } from its first and second lines. */
function fromHmi(v) {
    if (typeof v === 'string') return { title: str(v), artist: '' };
    // an array of entries (one per sink / menu entry): the first with text
    if (Array.isArray(v)) { for (const e of v) { const r = fromHmi(e); if (r.title || r.artist) return r; } return { title: '', artist: '' }; }
    const l1 = first(v, /^firstLineText$/i), l2 = first(v, /^secondLineText$/i);
    const l3 = first(v, /^(thirdLineText|threeRowText)$/i);
    // the line types, where they say which line is the artist (else the first line is the title)
    const t1 = String(first(v, /^firstLineType$/i) || all(v, /^firstLineType$/i)[0] || ''), t2 = String(first(v, /^secondLineType$/i) || all(v, /^secondLineType$/i)[0] || '');
    if (/artist|interpret/i.test(t1) && !/artist|interpret/i.test(t2)) return { title: l2 || l3, artist: l1 };
    return { title: l1 || l2 || l3, artist: l1 ? l2 : '' };
}
/** Android Auto's currentItemMetadata. */
const fromAA = (v) => ({ title: first(v, /^songName$/i), artist: first(v, /^artistName$/i) });
/** Anything else: members named like a title and an artist. */
const fromGeneric = (v) => (typeof v === 'string' ? { title: str(v), artist: '' }
    : { title: first(v, /^(title|songName|song|trackName|name)$/i), artist: first(v, /^(artist|artistName|interpret|performer)$/i) });

const READERS = { hmi: fromHmi, menu: fromHmi, aa: fromAA, player: fromGeneric };
const ORDER = ['hmi', 'aa', 'player', 'menu'];

/** One line: "Artist - Title", or the one there is; at most max characters (an ellipsis at the end). */
function line(np, max) {
    if (!np) return '';
    const a = str(np.artist), ti = str(np.title);
    let s = a && ti && a !== ti ? a + ' - ' + ti : ti || a;
    max = max || 48;
    if (s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
    return s;
}

/** The sources' last values; now() is the line to show (the first source in ORDER with text). */
function NowPlaying(opts) {
    const o = opts || {};
    const clock = o.now || Date.now;
    const src = {};
    return {
        /** A value from a source (hmi, menu, aa, player). */
        put(name, v) {
            let r;
            try { r = (READERS[name] || fromGeneric)(v); } catch (e) { r = { title: '', artist: '' }; }
            let raw;
            try { raw = JSON.stringify(v); } catch (e) { raw = String(v); }
            src[name] = { title: r.title, artist: r.artist, t: clock(), raw: raw === undefined ? String(v) : raw };
            return src[name];
        },
        /** { title, artist, from } or null. */
        now() {
            for (const k of ORDER) { const s = src[k]; if (s && (s.title || s.artist)) return { title: s.title, artist: s.artist, from: k }; }
            return null;
        },
        line(max) { return line(this.now(), max); },
        sources: () => Object.assign({}, src),
    };
}

module.exports = { NowPlaying, fromHmi, fromAA, fromGeneric, line, all };
