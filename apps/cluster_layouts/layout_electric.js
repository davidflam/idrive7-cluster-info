'use strict';
/**
 * layout_electric.js - "Electric": a layout for an electric car (made for an iX3 G08), on Modern wide's frame. Two
 * long segmented arcs frame the cluster: road speed up the left, the battery's power up the right, for good (0 a
 * quarter up, regeneration below it in green, each side to the battery's limit). The speed stands large in the
 * middle over the road ahead; a glass card on the left has the power, a centre-zero bar and its trend, one on the
 * right the charge, the use per 100 km (this drive's, as eDrive measures it), the battery's temperature and its
 * health; the range and the energy in the battery stand in the top corners. No engine speed, fuel, oil or coolant
 * anywhere. Use, health and energy are eDrive's (what it shares for the cluster apps); without it they read --.
 */
const C = require('./layout_common');
const carSprite = require('./car_sprite');

/* the arcs: short enough that their ends and numerals clear the glass's slanted top corners */
const R = 520, T = 28, CY = 380;
const LCX = 720, RCX = 1200;
const L_LAYER = { x: 100, y: 80, w: 420, h: 600 };
const R_LAYER = { x: 1400, y: 80, w: 420, h: 600 };

const PALETTES = {
    comfort: {
        bgTop: '#0b1018', bgBottom: '#020305', track: '#121a24', fill0: '#1a52c8', fill1: '#55b6ff', tip: '#b4e2ff',
        red: '#ff3b30', tick: '#3b4c5e', num: '#9fb3c8', text: '#f2f7ff', glow: '#3d8bff', dim: '#a6b0ba', rule: '#1c2a3a', ev: '#55b6ff',
        mode: 'COMFORT',
        cardTop: '#111b28', cardBottom: '#070b11', cardEdge: '#2a4058', regen: '#3ddc84', road: '#1d5f9e',
    },
    sport: {
        bgTop: '#140909', bgBottom: '#040202', track: '#241414', fill0: '#8a1a14', fill1: '#ff4a30', tip: '#ffb0a0',
        red: '#ffffff', tick: '#5e3b3b', num: '#d8a8a0', text: '#ffffff', glow: '#ff3b2f', dim: '#bca8a4', rule: '#3a1c1c', ev: '#4ab4ff',
        mode: 'SPORT',
        cardTop: '#1f1010', cardBottom: '#0a0505', cardEdge: '#5a2a26', regen: '#3ddc84', road: '#8a1a14',
    },
    efficient: {
        bgTop: '#06120f', bgBottom: '#010403', track: '#0f201c', fill0: '#127a5e', fill1: '#3cf0b8', tip: '#b0ffe6',
        red: '#ff3b30', tick: '#2f5048', num: '#9cc8bc', text: '#effffb', glow: '#22d3a0', dim: '#9eb6b0', rule: '#163a32', ev: '#22d3a0',
        mode: 'EFFICIENT',
        cardTop: '#0c1d19', cardBottom: '#040b09', cardEdge: '#1f4a40', regen: '#5ef2c4', road: '#127a5e',
    },
};
const bandColours = (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.tick, num: t.num });
const big = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.45] });
const txt = (t) => ({ color: [t.text, 1], glow: [t.glow, 0.15] });
const evTxt = (t) => ({ color: [t.ev, 1], glow: [t.ev, 0.3] });
const lbl = (t) => ({ color: [t.dim, 1], glow: [t.glow, 0] });
const bg = (key, x, y, w, h) => ({ key, kind: 'panel', x, y, w, h, params: { u_box: [0, 0, 0, 1] }, colors: (t) => ({ top: t.bgTop, bottom: t.bgBottom, border: t.bgBottom }) });

/* ---- the car's own bottom strip, readings in the centre: a new car's cluster ----
 * A textured background with a glow behind the top; the two arcs with a hairline outside each; the speed large
 * in the middle with the road ahead under it (its lane line running with the speed, on the cluster's clock);
 * the drive selector and mode on a chip left of the speed, the gear and engine speed on one right of it; a glass
 * card left with the battery's power, a centre-zero bar (regenerating left, drawing right) and its trend, and one
 * right with oil, coolant, the charge and the gearbox oil, each with its icon. */
const ICON = { thermo: 0, oil: 1, turbo: 5, battery: 6, car: 10 };
const card = (key, x, y, w, h) => ({ key, kind: 'panel', x, y, w, h, params: { u_box: [22, 1.5, 0.7, 0.92] }, colors: (t) => ({ top: t.cardTop, bottom: t.cardBottom, border: t.cardEdge }) });
const icon = (key, x, y, size, id, colour) => ({ key, kind: 'icon', x, y, w: size, h: size, params: { u_icon: [id], u_line: [0] }, colors: (t, d) => ({ color: [typeof colour === 'function' ? colour(t, d) : t[colour], 1] }) });
/** A straight bar (the band shader's bar mode), from the left or from the right. */
const hbar = (key, x, y, w, h, value, colours, fromRight, segments) => ({ key, kind: 'band', x, y, w, h,
    params: { u_geo: [Math.max(6, h / 2), h / 2, 0, Math.max(4, h * 0.6)], u_span: [fromRight ? -1 : 0, 0, segments || 0, 0.25], u_marks: [0, 0, 0, 0], u_red: [2] },
    colors: colours, value, max: 1, sweep: true });
const kwOf = (d) => (C.isNum(d.kw) ? d.kw : 0);
/** The battery's power on the tach's arc: its top rounded up to 30 kW, so its three marks above the 0 are round. */
const kwN = (d) => { const r = C.kwRange(d); return { out: Math.ceil(r.out / 30) * 30, in: r.in }; };
/* ---- an electric car's readings ---- */
const pct = (v) => (C.isNum(v) ? Math.round(v) + '%' : '--');
/** The use per distance: kWh per 100 km, or miles per kWh (speed unit mph). */
const useText = (o) => (d) => (!C.isNum(d.use) || d.use <= 0 ? '--' : o.speedUnit === 'kmh' ? d.use.toFixed(1) : (100 / d.use / 1.609344).toFixed(1));
const useLabel = (o) => (o.speedUnit === 'kmh' ? 'kWh / 100 km' : 'mi / kWh');
/** The energy in the battery: eDrive's, kWh. */
const energyText = (d) => (C.isNum(d.energy) ? d.energy.toFixed(1) + ' kWh' : '');
const rangeText = (o) => (d) => C.erangeText(o, d);
/* the driving assistant's state as the road shader's uniforms: a distance d metres ahead at depth 1/(1 + d/16) */
const depth = (x) => (typeof x === 'number' && x > 0 ? 1 / (1 + x / 16) : 0);
function roadState(D) {
    if (!D) return { u_dap: [0, 0, 0, 0], u_ldw: [0, 0] };
    return {
        u_dap: [1, D.assist ? 1 : 0, D.acc && D.acc.on ? 1 : 0, D.acc && D.acc.on && D.acc.gap ? D.acc.gap : 0],
        u_ldw: [D.ldw && D.ldw.left ? 1 : 0, D.ldw && D.ldw.right ? 1 : 0],
    };
}
/*
 * The road's motion, every frame (engine.js frame): the distance driven from the speed (the lane dashes go by
 * with the car, standing still when it does), and the cars eased towards where the assistant last put them (its
 * object list comes ~10 times a second: they glide between its updates instead of jumping), in and out of view
 * as they come and go.
 */
function roadMotion() {
    let run = 0;
    const cars = { lead: { d: 0, y: 0, a: 0 }, left: { d: 0, a: 0 }, right: { d: 0, a: 0 } };
    const ease = (c, want, k) => {
        if (want) { c.d = c.a > 0.01 ? c.d + (depth(want.x) - c.d) * k : depth(want.x); if (want.y !== undefined) c.y += ((typeof want.y === 'number' ? want.y / 3.6 : 0) - c.y) * k; }
        c.a += ((want ? 1 : 0) - c.a) * k;
        return c.a > 0.02 ? c.d : 0;
    };
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return (d, dt) => {
        const D = d.dap, kmh = C.isNum(d.speed) ? Math.max(0, d.speed) : 0;
        run = (run + kmh / 3.6 * dt / 1000) % 1200;
        const k = 1 - Math.exp(-dt / 90);
        const L = ease(cars.lead, D && D.lead, k), l = ease(cars.left, D && D.left, k), r = ease(cars.right, D && D.right, k);
        return {
            u_run: [Math.round(run * 100) / 100],
            u_lead: [L > 0 ? 1 : 0, r3(L), r3(cars.lead.y), D && D.lead && D.lead.brake ? 1 : 0],
            u_side: [r3(l), r3(r), D && D.lcw && D.lcw.left ? 1 : 0, D && D.lcw && D.lcw.right ? 1 : 0],
        };
    };
}   // the tach as a power gauge, and the small gauge inside it: kW of battery draw

function newCar(o, arcs, gearC, rpmTxt) {
    const engine = false, sc = C.speedScale(o);
    const hair = arcs.filter((a) => a.key !== 'pwrArc').map((a) => Object.assign({}, a, {
        key: a.key + 'Hair', z: -1, dyn: undefined,
        params: Object.assign({}, a.params, { u_geo: [a.params.u_geo[0], a.params.u_geo[1], a.params.u_geo[2] + 30, 3], u_span: [a.params.u_span[0], a.params.u_span[1], 0, 0], u_marks: [0, 0, 0, 0], u_red: [2] }),
        colors: (t) => ({ track: t.rule, fill0: t.fill1, fill1: t.tip, redc: t.red, tip: t.tip, tick: t.tick, num: t.num }),
    }));
    const L = { x: 330, y: 340, w: 300, h: 262 }, R = { x: 1290, y: 340, w: 300, h: 262 };
    const cell = (i, id, ic, value, label, colour) => {
        const cx = R.x + 12 + (i % 2) * 144, cy = R.y + 14 + Math.floor(i / 2) * 124;
        return [icon(id + 'Ic', cx + 6, cy + 6, 30, ic, 'glow'),
            C.text(id, cx, cy + 40, 132, 46, value, colour || txt, { align: 0 }),
            C.text(id + 'Lbl', cx + 2, cy + 90, 132, 16, label, lbl, { align: 0, tracking: 0.14 })];
    };
    return [
        { key: 'bgTex', kind: 'bg', x: 0, y: 0, w: 1920, h: 720, params: { u_look: [1, 0.55, 0.75, 24], u_feather: [0] }, colors: (t) => ({ top: t.bgTop, bottom: t.bgBottom, accent: t.glow }) },
        // the road ahead as the driving assistant sees it (dap.js: d.dap; without it, the lanes and the car alone)
        { key: 'road', kind: 'road', x: 650, y: 346, w: 620, h: 296, value: (d) => (C.isNum(d.speed) ? Math.min(1, C.speedIn(o, d.speed) / sc.max) : 0), max: 1,
            colors: (t) => ({ line: t.tip, glow: t.glow, surface: t.road, assist: t.regen, acc: t.glow, warn: '#ff9f0a', car: '#8d9aa8', ego: '#dfe7ef' }),
            dyn: (d) => roadState(d.dap), frame: roadMotion(), textures: { u_cars: carSprite }, params: { u_anchor: [carSprite().anchor.cx, carSprite().anchor.bottom, carSprite().anchor.width, 0] } },
        // the cruise control's set speed and the steering assist, at the top of the road while they're on
        C.text('accSet', 660, 350, 200, 26, (d) => (d.dap && d.dap.acc && d.dap.acc.on && C.isNum(d.dap.acc.set) ? 'SET ' + d.dap.acc.set : ''), (t) => ({ color: [t.glow, 1], glow: [t.glow, 0.5] }), { align: 0 }),
        C.text('assistOn', 1060, 350, 200, 26, (d) => (d.dap && d.dap.assist ? 'ASSIST' : ''), (t) => ({ color: [t.regen, 1], glow: [t.regen, 0.5] }), { align: 1, tracking: 0.14 }),
    ].concat(hair, arcs, [
        // the top: the time and the outside temperature, inside the glass's slanted corners
        C.text('rangeTop', 330, 136, 300, 42, rangeText(o), evTxt, { align: 0 }),
        C.text('rangeTopLbl', 332, 182, 300, 16, 'RANGE', lbl, { align: 0, tracking: 0.2 }),
        // (the right: the engine speed, or ENGINE OFF; the gear and the drive mode are the car's own strip's)
        C.text('energyTop', 1290, 136, 300, 42, energyText, txt, { align: 1 }),
        C.text('energyTopLbl', 1290, 182, 298, 16, (d) => (C.isNum(d.energy) ? 'IN THE BATTERY' : ''), lbl, { align: 1, tracking: 0.2 }),
        // the speed, large, in the middle
        C.text('speedDigits', 700, 140, 520, 176, (d) => C.speedText(o, d), big),
        C.text('speedUnit', 700, 314, 520, 24, C.speedUnit(o), lbl, { tracking: 0.3 }),
        // left card: the battery's power (or the engine's torque), a centre-zero bar and its trend
        card('powerCard', L.x, L.y, L.w, L.h),
        C.text('kwLbl', L.x + 20, L.y + 16, L.w - 40, 18, 'BATTERY POWER', lbl, { align: 0, tracking: 0.14 }),
        C.text('kwNow', L.x + 18, L.y + 40, L.w - 36, 58, C.kwText,
            engine ? txt : (t, d) => ({ color: [kwOf(d) < -0.3 ? t.regen : t.text, 1], glow: [kwOf(d) < -0.3 ? t.regen : t.glow, 0.3] }), { align: 0 }),
    ], engine ? [hbar('pwrBar', L.x + 20, L.y + 112, L.w - 40, 14, C.focus.torqueFrac, (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.dim, num: t.num }), false, 24)] : [
        // as the other power gauges: 0 a quarter along, regenerating fills left of it, drawing right, each to the
        // battery's limit (eDrive Live's: layout_common.kwRange)
        hbar('regenBar', L.x + 20, L.y + 112, (L.w - 44) / 4, 14, (d) => Math.max(0, Math.min(1, -kwOf(d) / C.kwRange(d).in)), (t) => ({ track: t.track, fill0: t.regen, fill1: t.regen, redc: t.red, tip: t.regen, tick: t.dim, num: t.num }), true, 4),
        hbar('drawBar', L.x + 24 + (L.w - 44) / 4, L.y + 112, (L.w - 44) * 3 / 4, 14, (d) => Math.max(0, Math.min(1, kwOf(d) / C.kwRange(d).out)), (t) => ({ track: t.track, fill0: t.fill0, fill1: t.fill1, redc: t.red, tip: t.tip, tick: t.dim, num: t.num }), false, 15),
        C.flat('pwrZero', L.x + 21 + (L.w - 44) / 4, L.y + 106, 2, 26, 'tip'),
    ], [
        { key: 'pwrTrend', kind: 'spark', x: L.x + 16, y: L.y + 146, w: L.w - 32, h: 96, every: 2000,
            sample: engine ? (d) => (C.isNum(d.torque) ? Math.max(0, Math.min(1, d.torque / 450)) : -1) : (d) => (C.isNum(d.kw) ? C.kwFrac(d.kw, C.kwRange(d)) : -1),
            colors: (t) => ({ line: t.fill1, fill: t.fill0 }) },
        // right card: oil, coolant, the charge (or boost) and the gearbox oil
        card('infoCard', R.x, R.y, R.w, R.h),
        C.flat('infoRuleV', R.x + R.w / 2, R.y + 18, 1, R.h - 36, 'cardEdge'),
        C.flat('infoRuleH', R.x + 18, R.y + R.h / 2, R.w - 36, 1, 'cardEdge'),
    ],
    cell(0, 'soc', ICON.battery, C.socText, 'CHARGE', evTxt),
    cell(1, 'use', ICON.car, useText(o), useLabel(o)),
    cell(2, 'battT', ICON.thermo, (d) => C.tempText(o, d.battTemp), 'BATTERY'),
    cell(3, 'soh', ICON.battery, (d) => pct(d.soh), 'HEALTH'));
}

/*
 * ---- the Waze map, large (Settings > Electric: Waze map; with the car's own bottom strip) ----
 * Waze on cluster draws its map where the layout says (map_window.js), so this layout gives it nearly the whole
 * panel between the arcs instead of the native map area (1088 x 480):
 *   wide     1408 x 464, from under a row of readings (speed, power, charge, range, use) down to the car's strip
 *   overlay  1408 x 512, from the camera's cowl down to the strip, the same readings on a darkened bar over the
 *            map's bottom edge. Waze draws over the layout, so the bar and its texts ask for a place above it (z);
 *            whether the renderer gives it is not yet seen on a car: experimental.
 * Not without the strip (the KOMBI's gear box and warning lights sit in that area), nor for the stock centre.
 */
// (x 256-1664: inside the arcs' ends, which curve in to about x 250 at the top and bottom)
const WIDE = { x: 256, y: 176, w: 1408, h: 464 }, OVER = { x: 256, y: 128, w: 1408, h: 512 };
/*
 * ---- the map as the whole cluster: no dials, the map, the speed on a dark card ----
 *   clean    the map between two dark columns: the speed, large, and the power on the left, the charge, the energy in
 *            the battery and the use on the right. Nothing is drawn over the map.
 *   full     the map 1728 x 512, edge to edge; the speed card and a range-and-charge chip sit over it (above the
 *            map by z, as 'overlay': experimental, not yet seen on a car)
 * With the car's own bottom strip or full view (Settings > Bottom strip). Full view: the layout has the bottom band
 * too, left and right of the stock warning lights (layout_common.TELLTALES): the gear selector P R N D and the speed
 * on the left, the range and the charge on the right - there whatever the map covers. Above the map, left and right
 * of the camera's cowl: the time and the outside temperature, the battery's temperature and its energy. In full view
 * the KOMBI's own dark boxes (layout_common.GEARBOX_HOLE, EDRIVE_HOLE) sit over the map's right side: 'clean' ends
 * its map left of them and puts its right column round them.
 */
const FULL = { x: 96, y: 128, w: 1728, h: 512 };
const cleanWin = (o) => (C.strip(o) ? { x: 440, y: 128, w: 1264, h: 512 } : { x: 440, y: 128, w: 956, h: 512 });
const isClean = (o) => o.mapStyle === 'clean' || o.mapStyle === 'full';
// (the forms with the arcs only over the car's strip: full view, the KOMBI's boxes sit where their readings are)
const bigMap = (o) => !!o && o.centre === 'map' && !o.stockCentre && (isClean(o) || (C.strip(o) && (o.mapStyle === 'wide' || o.mapStyle === 'overlay')));
const mapWindowFor = (o) => (!bigMap(o) ? null : o.mapStyle === 'full' ? FULL : o.mapStyle === 'clean' ? cleanWin(o) : o.mapStyle === 'overlay' ? OVER : WIDE);
function cleanForm(o) {
    const W = mapWindowFor(o), full = o.mapStyle === 'full', strip = C.strip(o), Z = full ? { z: 900 } : {};
    const around = [{ x: 0, y: 0, w: 1920, h: W.y }, { x: 0, y: W.y + W.h, w: 1920, h: 720 - W.y - W.h },
        { x: 0, y: W.y, w: W.x, h: W.h }, { x: W.x + W.w, y: W.y, w: 1920 - W.x - W.w, h: W.h }];
    const kwC = (t, d) => ({ color: [kwOf(d) < -0.3 ? t.regen : t.dim, 1], glow: [kwOf(d) < -0.3 ? t.regen : t.glow, 0.2] });
    const dark = (key, x, y, w, h, a) => ({ key, kind: 'panel', x, y, w, h, z: full ? 890 : undefined, params: { u_box: [26, full ? 1 : 0, 0.7, a] },
        colors: (t) => ({ top: '#06090d', bottom: '#020304', border: t.cardEdge }) });
    const T = (key, x, y, w, h, value, colours, extra) => C.text(key, x, y, w, h, value, colours, Object.assign({}, extra, Z));
    // the speed card: in the left column, or over the map's left side
    const cx = full ? 150 : 118, cw = 300;
    let list = around.map((b, i) => bg('bg' + i, b.x, b.y, b.w, b.h)).concat([
        dark('speedCard', cx, 230, cw, 300, full ? 0.8 : 0),
        T('speedMap', cx, 256, cw, 150, (d) => C.speedText(o, d), big),
        T('speedMapUnit', cx, 408, cw, 24, C.speedUnit(o), lbl, { tracking: 0.2 }),
        T('kwMap', cx, 452, cw, 44, C.kwText, kwC),
        // above the map, beside the cowl: the time and outside temperature, the battery's temperature and energy
        C.text('clock', 330, 86, 150, 34, C.clock, txt, { align: 0 }),
        C.text('outside', 490, 86, 220, 34, (d) => C.outsideText(o, d.outside), lbl, { align: 0 }),
        C.text('battT', 1210, 86, 200, 34, (d) => 'BATT ' + C.tempText(o, d.battTemp), lbl, { align: 1 }),
        C.text('energyTop', 1420, 86, 170, 34, energyText, txt, { align: 1 }),
    ]);
    if (!strip) {
        // full view, the bottom band: the selector and the speed left of the warning lights, range and charge right
        const lit = (ch) => (t, d) => (C.selectorLit(d) === ch ? { color: [ch === 'R' ? t.red : t.text, 1], glow: [t.glow, 0.8] } : { color: [t.tick, 1], glow: [t.glow, 0] });
        // (the speed here too only where its card is over the map: there whether or not the card shows)
        list = list.concat(['P', 'R', 'N', 'D'].map((ch, i) => C.text('sel' + ch, 116 + i * 54, 660, 50, 44, ch, lit(ch))), full ? [
            C.text('speedBand', 350, 660, 190, 44, (d) => C.speedText(o, d) + ' ' + C.speedUnit(o), txt, { align: 0.5 }),
        ] : [], [
            C.text('rangeBand', 1536, 660, 170, 44, rangeText(o), txt, { align: 1 }),
            C.text('socBand', 1716, 660, 110, 44, C.socText, evTxt, { align: 0.5 }),
        ]);
    }
    if (full) {
        // over the strip (which has no charge): the range and the charge on one chip over the map's bottom right
        return strip ? list.concat([
            dark('rangeChip', 1436, 560, 360, 60, 0.8),
            T('rangeMap', 1448, 572, 190, 36, rangeText(o), txt, { align: 1 }),
            T('socMap', 1650, 572, 134, 36, C.socText, evTxt, { align: 0.5 }),
        ]) : list;
    }
    // the right column: the charge, the energy in the battery, the use
    if (strip) {
        const rx = 1716, rw = 170;
        return list.concat(
            C.reading('socMap', rx, 236, rw, 56, C.socText, 'CHARGE', evTxt, lbl),
            C.reading('energyMap', rx, 356, rw, 38, (d) => (C.isNum(d.energy) ? d.energy.toFixed(1) : '--'), 'kWh', txt, lbl),
            C.reading('useMap', rx, 456, rw, 38, useText(o), useLabel(o).replace(/ /g, ''), txt, lbl));
    }
    // (full view: above and below the KOMBI's gear box, left of its eDrive box)
    return list.concat(
        C.reading('socMap', 1410, 150, 340, 56, C.socText, 'CHARGE', evTxt, lbl),
        C.reading('energyMap', 1410, 478, 200, 40, (d) => (C.isNum(d.energy) ? d.energy.toFixed(1) : '--'), 'kWh', txt, lbl),
        C.reading('useMap', 1620, 478, 200, 40, useText(o), useLabel(o).replace(/ /g, ''), txt, lbl));
}

function mapForm(o, arcs) {
    const W = mapWindowFor(o), over = o.mapStyle === 'overlay', Z = over ? { z: 900 } : {};
    const around = [{ x: 0, y: 0, w: 1920, h: W.y }, { x: 0, y: W.y + W.h, w: 1920, h: 720 - W.y - W.h },
        { x: 0, y: W.y, w: W.x, h: W.h }, { x: W.x + W.w, y: W.y, w: 1920 - W.x - W.w, h: W.h }];
    const kwC = (t, d) => ({ color: [kwOf(d) < -0.3 ? t.regen : t.text, 1], glow: [kwOf(d) < -0.3 ? t.regen : t.glow, 0.3] });
    // five readings in a row: above the map, or on the bar over its bottom edge
    const y = over ? W.y + W.h - 58 : 132, h = 36, x0 = W.x + 24, step = (W.w - 48) / 5;
    const col = (i, key, value, colours) => C.text(key, Math.round(x0 + i * step), y, Math.round(step) - 12, h, value, colours, Object.assign({ align: 0.5 }, Z));
    const row = [
        col(0, 'speedMap', (d) => C.speedText(o, d) + ' ' + C.speedUnit(o), big),
        col(1, 'kwMap', C.kwText, kwC),
        col(2, 'socMap', C.socText, evTxt),
        col(3, 'rangeMap', rangeText(o), txt),
        col(4, 'useMap', (d) => (useText(o)(d) === '--' ? '' : useText(o)(d) + ' ' + useLabel(o).replace(/ /g, '')), txt),
    ];
    const bar = over ? [{ key: 'mapBar', kind: 'panel', x: W.x + 12, y: y - 10, w: W.w - 24, h: h + 20, z: 890, params: { u_box: [16, 1, 0.7, 0.74] },
        colors: (t) => ({ top: '#05080c', bottom: '#020304', border: t.cardEdge }) }] : [];
    return around.map((b, i) => bg('bg' + i, b.x, b.y, b.w, b.h)).concat(arcs, bar, row);
}

module.exports = {
    id: 'electric',
    title: 'Electric',
    dap: true,          // (its road: the driving assistant's view, dap.js)
    palette: (lookId) => PALETTES[lookId] || PALETTES.comfort,
    gearText: C.gearText,
    mapWindowFor,       // (its own, larger map window for Waze on cluster: main.js)

    pieces(o) {
        const s = C.speedScale(o), r = C.rpmScale(o);
        // a plug-in hybrid (Show: eDrive): the tach turns into the battery's power gauge while the engine is off
        // (in an electric eDrive mode, layout_common.electric; the tach and a small power gauge in the others)
        // (the right arc is the power gauge whatever the car: this layout has no rev counter)
        const ev = false, evOff = () => true;
        // with the car's own bottom strip the arcs end higher, clear of it and of the fuel and charge gauges
        // above its ranges (their low ends 6 degrees shorter, their circle 20 px higher)
        const strip = C.strip(o), cy = strip ? CY - 20 : CY, lo = strip ? 112 : 118;
        const arcs = [
            {
                // road speed: up the left, the circle's centre to the right of the layer
                key: 'speedArc', kind: 'band', x: L_LAYER.x, y: L_LAYER.y, w: L_LAYER.w, h: L_LAYER.h,
                params: { u_geo: [LCX - L_LAYER.x, cy - L_LAYER.y, R, T], u_span: [-lo, -62, 44, 0.3], u_marks: [s.max / s.major, s.major, 22, 44], u_red: [2] },
                colors: bandColours, value: (d) => (C.isNum(d.speed) ? C.speedIn(o, d.speed) / s.max : 0), max: 1, sweep: true,
            },
            {
                // engine speed up the right; on a plug-in hybrid with the engine off, the battery's power instead
                // as the other power gauges (0 a quarter up, regeneration below it in green, each side to the
                // battery's limit: kwRange; its numerals and colour changed by dyn), the engine speed back as soon
                // as it runs
                key: 'rpmArc', kind: 'band', x: R_LAYER.x, y: R_LAYER.y, w: R_LAYER.w, h: R_LAYER.h,
                params: { u_geo: [RCX - R_LAYER.x, cy - R_LAYER.y, R, T], u_span: [lo, 62, 44, 0.3], u_marks: [r.max, 1, 22, 44], u_red: [r.red / r.max], u_zero: [0] },
                colors: (t, d) => (evOff(d) ? Object.assign(bandColours(t), { fill0: t.road, fill1: t.ev, tip: kwOf(d) < -0.3 ? t.regen : t.tip, neg: t.regen }) : Object.assign(bandColours(t), { neg: t.regen })),
                value: (d) => (evOff(d) ? C.kwFrac(d.kw, kwN(d)) : C.isNum(d.rpm) ? d.rpm / 1000 / r.max : 0), max: 1, sweep: true,
                dyn: (d) => (evOff(d) ? { u_marks: [3, kwN(d).out / 3, 22, 44], u_red: [2], u_zero: [C.KW_ZERO] } : { u_marks: [r.max, 1, 22, 44], u_red: [r.red / r.max], u_zero: [0] }),
            },
        ];
        // inside the tach, a small power gauge while the engine runs (the battery's draw, and its recuperation in
        // green); gone with the engine off, the tach itself then reading the power
        if (ev && strip) arcs.push({   // (full screen it would reach into the KOMBI's gear box)
            key: 'pwrArc', kind: 'band', x: R_LAYER.x, y: R_LAYER.y, w: R_LAYER.w, h: R_LAYER.h,
            // (as the other power gauges: 0 a quarter up, regeneration below it in green)
            params: { u_geo: [RCX - R_LAYER.x, cy - R_LAYER.y, R - 52, 10], u_span: [lo, 62, 30, 0.3], u_marks: [0, 0, 0, 0], u_red: [2], u_zero: [C.KW_ZERO] },
            colors: (t, d) => ({ track: t.track, fill0: t.road, fill1: t.ev, redc: t.red, tip: kwOf(d) < -0.3 ? t.regen : t.tip, tick: t.tick, num: t.num, neg: t.regen }),
            value: (d) => C.kwFrac(d.kw, C.kwRange(d)), max: 1, sweep: true,
            visible: (d) => !evOff(d),   // (gone while the arc itself reads the battery's power)
        });
        const gearC = (t, d) => ({ color: [C.gearText(d) === 'R' ? '#ff3b30' : t.text, 1], glow: [t.glow, 0.45] });
        const rpmTxt = (d) => 'RANGE ' + C.erangeText(o, d);
        const hotC = (k, lim) => (t, d) => ({ color: [C.isNum(d[k]) && d[k] >= lim ? '#ff3b30' : t.text, 1], glow: [t.glow, 0] });
        if (bigMap(o)) return o.mapStyle === 'clean' || o.mapStyle === 'full' ? cleanForm(o) : mapForm(o, arcs);
        if (o.centre === 'map') {
            // the arcs bulge out to x ~200 / ~1720; the speed and gear sit between them and the map
            const bot = C.MAP.y + C.MAP.h;
            return C.aroundMap().map((b, i) => bg('bg' + i, b.x, b.y, b.w, b.h)).concat(arcs, [
                // (the gear above the dark box the KOMBI leaves right of centre, its rpm and mode below it)
                C.text('speedDigits', 228, 160, 186, 110, (d) => C.speedText(o, d), big),
                C.text('speedUnit', 228, 280, 186, 20, C.speedUnit(o), lbl, { tracking: 0.2 }),
                C.text('clock', 228, 440, 186, 30, C.clock, txt),
                C.text('outside', 228, 480, 186, 30, (d) => C.outsideText(o, d.outside), txt),
                C.text('gear', 1506, 158, 186, 100, C.gearText, gearC),
                C.text('rpmDigits', 1506, 460, 186, 20, rpmTxt, lbl, { tracking: 0.1 }),
                C.text('mode', 1506, 482, 186, 18, C.modeText, (t) => ({ color: [t.glow, 1], glow: [t.glow, 0.6] }), { tracking: 0.25 }),
            ],
            C.readingUp('kwMap', 440, bot + 2, 220, 30, C.kwText, 'BATTERY POWER', txt, lbl),
            C.readingUp('socMap', 670, bot + 2, 220, 30, C.socText, 'CHARGE', evTxt, lbl),
            C.readingUp('battMap', 900, bot + 2, 160, 30, (d) => C.tempText(o, d.battTemp), 'BATTERY', hotC('battTemp', 45), lbl),
            C.readingUp('useMap', 1070, bot + 2, 160, 30, useText(o), useLabel(o), txt, lbl));
        }
        const list = [bg('bg', 0, 0, 1920, 720)].concat(arcs, [
            // the gear stays left of the dark box the KOMBI leaves where its own gear readout was
            C.text('speedDigits', 470, 270, 300, 140, (d) => C.speedText(o, d), big),
            C.text('speedUnit', 470, 420, 300, 22, C.speedUnit(o), lbl, { tracking: 0.2 }),
            C.text('gear', 1150, 270, 260, 140, C.gearText, gearC),
            C.text('rpmDigits', 1150, 420, 260, 22, rpmTxt, lbl, { tracking: 0.12 }),
        ]);
        if (strip && (o.centre || 'info') === 'info') return newCar(o, arcs, gearC, rpmTxt);
        if (o.centre === 'stock') {
            list[0] = bg('bg', 0, 0, 760, 720);
            list.splice(1, 0, bg('bgR', 1160, 0, 760, 720));
            return list;
        }
        return list.concat([
            // below the camera's cowl, which covers the top middle
            C.text('clock', 790, 140, 170, 38, C.clock, txt),
            C.text('outside', 960, 140, 170, 38, (d) => C.outsideText(o, d.outside), txt),
            C.text('mode', 780, 190, 360, 18, C.modeText, (t) => ({ color: [t.glow, 1], glow: [t.glow, 0.6] }), { tracking: 0.3 }),
            C.flat('rule1', 860, 222, 200, 2, 'rule'),
        ],
        // (the keys Modern wide's readings have here, so an M car's moves are the same: layouts.js M_MOVES)
        C.reading('fuel', 780, 240, 180, 44, rangeText(o), 'RANGE', evTxt, lbl),
        C.reading('elec', 960, 240, 180, 44, (d) => energyText(d) || pct(d.soh), (d) => (C.isNum(d.energy) ? 'IN THE BATTERY' : 'HEALTH'), txt, lbl),
        [C.bar('soc', 800, 340, 320, 22, (d) => (C.isNum(d.soc) ? d.soc / 100 : 0), (t) => ({ track: t.track, fill0: t.ev, fill1: t.ev, redc: t.red, tip: t.tip, tick: t.dim, num: t.num }), 24)],
        C.reading('soc', 800, 376, 160, 36, C.socText, 'CHARGE', evTxt, lbl),
        C.reading('kw', 960, 376, 160, 36, C.kwText, 'POWER', txt, lbl),
        [C.flat('rule2', 800, 474, 320, 2, 'rule')],
        C.reading('oil', 790, 494, 160, 44, (d) => C.tempText(o, d.battTemp), 'BATTERY', hotC('battTemp', 45), lbl),
        C.reading('coolant', 970, 494, 160, 44, useText(o), useLabel(o), txt, lbl));
    },
};
