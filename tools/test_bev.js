'use strict';
// Settings > Vehicle: Electric car (layouts.js bevPieces, layout_common.electric): every layout, with the car's own
// bottom strip and without, shows no fuel, oil, coolant, gearbox or engine speed, and reads the battery instead.
//   node tools/test_bev.js
const assert = require('assert');
const path = require('path');
const APP = path.join(__dirname, '..', 'apps', 'cluster_layouts');
const { makeScene } = require('./scene');
const { LAYOUTS } = require(path.join(APP, 'layouts'));
const C = require(path.join(APP, 'layout_common'));

let ok = 0;
const d = { speed: 60, kw: 38, soc: 74, erange: 325, battTemp: 24, battMax: 25, battMin: 23, outside: 27, stage: 'D', gear: 1, rpm: 4200, engineOn: true };
LAYOUTS.forEach((L) => ['stock', 'layout'].forEach((bottomStrip) => ['info', 'map'].forEach((centre) => {
    const o = { speedUnit: 'kmh', tempUnit: 'c', centre, vehicle: 'bev', bottomStrip, redline: 7000, rpmMax: 8000 };
    const list = L.pieces(o), where = L.id + ' / ' + bottomStrip + ' / ' + centre;
    // (a text that needs the colours too, the drive mode's, is not one of these)
    const say = (p) => { try { return typeof p.text === 'function' ? p.text(d) : p.text; } catch (e) { return null; } };
    const texts = list.filter((p) => p.kind === 'text').map(say).filter((s) => typeof s === 'string');
    const bad = texts.filter((s) => /\b(OIL|COOLANT|GEARBOX|FUEL|RPM|INTAKE|BOOST|ENGINE|TORQUE|TIMING)\b/.test(s) || /^OFF$/.test(s.trim()));
    assert.deepStrictEqual(bad, [], where + ': an engine\'s words left: ' + JSON.stringify(bad));
    assert(!list.some((p) => /^stripFuel/.test(p.key)), where + ': no fuel gauge over the strip');
    // nothing left drawing from the fuel alone
    list.forEach((p) => ['value', 'text'].forEach((f) => {
        if (typeof p[f] !== 'function') return;
        const seen = [];
        try { p[f](new Proxy({}, { get: (t, k) => { if (typeof k === 'string') seen.push(k); return undefined; } })); } catch (e) { /* needs a reading */ }
        assert(!(seen.length && seen.every((k) => /^(fuelPct|fuelLevel|frange)$/.test(k))), where + ': ' + p.key + ' reads only the fuel');
    }));
    ok++;
})));
// the rev counter is the power gauge whatever the engine speed signal says, and Show: Engine doesn't apply
assert(C.electric({ vehicle: 'bev' }, { engineOn: true, driveMode: 'SPORT' }) && C.electric({ vehicle: 'bev', focus: 'engine' }, {}));
assert(!C.engineFocus({ vehicle: 'bev', focus: 'engine' }));
// a plug-in hybrid's and a petrol car's layouts are as they were: the same pieces, by key
LAYOUTS.forEach((L) => ['phev', 'ice'].forEach((vehicle) => {
    const o = { speedUnit: 'kmh', tempUnit: 'c', centre: 'info', vehicle, bottomStrip: 'stock', redline: 7000, rpmMax: 8000 };
    assert.deepStrictEqual(L.pieces(o).map((p) => p.key), L.shaped(o).map((p) => p.key), L.id + ' ' + vehicle);
}));
// the engine draws every layout as an electric car's (the scene the previews use)
LAYOUTS.forEach((L) => { const s = makeScene({ layout: L.id, options: { vehicle: 'bev', bottomStrip: 'stock', speedUnit: 'kmh' }, data: d }); assert(s.engine._pieces().length > 5, L.id); s.stop(); ok++; });
// Electric's large Waze map: only with the car's strip and the Waze centre; nothing but the arcs' rectangles and
// the backgrounds touch the window in 'wide'; 'overlay' puts its bar and readings over it, above the map (z)
{
    const E = LAYOUTS.find((l) => l.id === 'electric'), L2 = (o) => E.pieces(o), base = { speedUnit: 'kmh', tempUnit: 'c', centre: 'map', vehicle: 'bev', bottomStrip: 'stock', redline: 7000, rpmMax: 8000 };
    assert.strictEqual(E.mapWindowFor(Object.assign({}, base, { mapStyle: 'standard' })), null);
    assert.strictEqual(E.mapWindowFor(Object.assign({}, base, { mapStyle: 'wide', bottomStrip: 'layout' })), null, 'not without the strip');
    assert.strictEqual(E.mapWindowFor(Object.assign({}, base, { mapStyle: 'wide', stockCentre: true })), null, 'not for the stock centre');
    const W = E.mapWindowFor(Object.assign({}, base, { mapStyle: 'wide' })), O = E.mapWindowFor(Object.assign({}, base, { mapStyle: 'overlay' }));
    assert(W.w * W.h > 1088 * 480 * 1.2 && O.h > W.h && W.y + W.h <= 646 && O.y >= 128, JSON.stringify([W, O]));
    const hit = (r, w) => r.x < w.x + w.w && r.x + r.w > w.x && r.y < w.y + w.h && r.y + r.h > w.y;
    const wide = E.pieces(Object.assign({}, base, { mapStyle: 'wide' }));
    assert.deepStrictEqual(wide.filter((p) => hit(p, W) && p.kind !== 'band').map((p) => p.key), [], 'wide: nothing over the map');
    assert(['speedMap', 'kwMap', 'socMap', 'rangeMap', 'useMap'].every((k) => wide.some((p) => p.key === k)), 'the row of readings');
    const over = E.pieces(Object.assign({}, base, { mapStyle: 'overlay' })).filter((p) => hit(p, O) && p.kind !== 'band');
    assert(over.length === 6 && over.every((p) => p.z >= 890), 'overlay: the bar and five readings, above the map: ' + over.map((p) => p.key + ':' + p.z));
    // the map as the cluster: 'clean' draws nothing over its window and has no arcs; 'full' is wider still, its
    // cards and texts above the map
    const Cw = E.mapWindowFor(Object.assign({}, base, { mapStyle: 'clean' })), Fw = E.mapWindowFor(Object.assign({}, base, { mapStyle: 'full' }));
    const clean = E.pieces(Object.assign({}, base, { mapStyle: 'clean' })), full = E.pieces(Object.assign({}, base, { mapStyle: 'full' }));
    assert.deepStrictEqual(clean.filter((p) => hit(p, Cw)).map((p) => p.key), [], 'clean: nothing over the map');
    assert(!clean.some((p) => p.kind === 'band') && clean.some((p) => p.key === 'speedMap') && clean.some((p) => p.key === 'socMap'), 'clean: no arcs, the speed and the charge');
    assert(Fw.w > Cw.w && Cw.w * Cw.h > 1088 * 480 * 1.2, JSON.stringify([Cw, Fw]));
    assert(full.filter((p) => hit(p, Fw)).every((p) => p.z >= 890) && full.some((p) => p.key === 'rangeMap'), 'full: what is over the map is above it');
    // full view (no strip of the car's): the selector, range and charge in the bottom band beside the warning lights,
    // the time and temperatures above the map; nothing of 'clean' under the KOMBI's boxes or over its map
    ['clean', 'full'].forEach((mapStyle) => {
        const o = Object.assign({}, base, { mapStyle, bottomStrip: 'layout' }), w = E.mapWindowFor(o), list = L2(o);
        assert(w && w.y + w.h <= 652, mapStyle + ': a window in full view');
        ['selP', 'selR', 'selN', 'selD', 'rangeBand', 'socBand', 'clock', 'outside', 'battT'].forEach((k) => assert(list.some((p) => p.key === k), mapStyle + ': ' + k));
        const band = list.filter((p) => /^sel|Band$/.test(p.key));
        assert(band.every((p) => p.y >= w.y + w.h && !hit(p, C.TELLTALES)), mapStyle + ': the band clear of the map and the warning lights');
        const lit = (stage) => list.filter((p) => /^sel[PRND]$/.test(p.key) && p.colors({ text: '#ffffff', tick: '#333333', red: '#ff0000', glow: '#000000' }, { stage }).color[0] !== '#333333').map((p) => p.key);
        assert.deepStrictEqual([lit('D'), lit('R'), lit('P')], [['selD'], ['selR'], ['selP']], mapStyle + ': the engaged one lit');
        if (mapStyle === 'clean') {
            assert.deepStrictEqual(list.filter((p) => hit(p, w)).map((p) => p.key), [], 'clean, full view: nothing over the map');
            assert(!list.some((p) => p.kind === 'text' && (hit(p, C.GEARBOX_HOLE) || hit(p, C.EDRIVE_HOLE))), 'clean, full view: no reading under the KOMBI\'s boxes');
            assert(w.x + w.w <= C.GEARBOX_HOLE.x, 'clean, full view: the map ends left of the gear box');
        } else assert(list.some((p) => p.key === 'speedBand'), 'full: the speed in the band too');
    });
    ok++;
}
console.log(ok + ' passed');
process.exit(0);
