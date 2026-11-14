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
// Electric with the Waze map: the map as the cluster, edge to edge, in full view and over the car's strip
{
    const E = LAYOUTS.find((l) => l.id === 'electric'), W = E.mapWindow;
    const base = { speedUnit: 'kmh', tempUnit: 'c', centre: 'map', vehicle: 'bev', redline: 7000, rpmMax: 8000 };
    const hit = (r, w) => r.x < w.x + w.w && r.x + r.w > w.x && r.y < w.y + w.h && r.y + r.h > w.y;
    assert(W && W.w * W.h > 1088 * 480 * 1.5 && W.y >= 128 && W.y + W.h <= 646, JSON.stringify(W));
    const d2 = { speed: 84, kw: -22, soc: 85, erange: 490, battTemp: 24, outside: 27, use: 18.4, energy: 61.9, stage: 'D' };
    ['layout', 'stock'].forEach((bottomStrip) => {
        const list = E.pieces(Object.assign({}, base, { bottomStrip })), where = 'electric map / ' + bottomStrip;
        assert(!list.some((p) => p.kind === 'band'), where + ': no dials');
        // what is over the map asks for a place above it
        assert(list.filter((p) => hit(p, W)).every((p) => p.z >= 890), where + ': over the map only above it');
        const say = (k) => { const p = list.find((q) => q.key === k); return p ? (typeof p.text === 'function' ? p.text(d2) : p.text) : undefined; };
        assert.strictEqual(say('speedMap'), '84', where);
        assert.strictEqual(say('useCard'), '18.4 kWh/100km', where + ': the use on the card');
        assert.strictEqual(say('useTop'), '18.4 kWh/100km', where + ': and above the map');
        assert.strictEqual(say('battT'), 'BATT 24°', where + ': Celsius');
        assert.strictEqual(say('energyTop'), '61.9 kWh', where);
        if (bottomStrip === 'stock') { assert.strictEqual(say('rangeMap'), '490 km', where); return; }
        // full view: the selector, the speed, the range and the charge in the band beside the warning lights; the
        // time, the date and the outside temperature above the map
        assert.strictEqual(say('outside'), '27°C', where);
        assert(/^\d\d\/\d\d\/\d{4}$/.test(say('date')), where + ': the date as day/month/year: ' + say('date'));
        assert.deepStrictEqual([say('speedBand'), say('rangeBand'), say('socBand')], ['84 km/h', '490 km', '85%'], where);
        const band = list.filter((p) => /^sel|Band$/.test(p.key));
        assert(band.length === 7 && band.every((p) => p.y >= W.y + W.h && !hit(p, C.TELLTALES)), where + ': the band clear of the map and the warning lights');
        const lit = (stage) => list.filter((p) => /^sel[PRND]$/.test(p.key) && p.colors({ text: '#ffffff', tick: '#333333', red: '#ff0000', glow: '#000000' }, { stage }).color[0] !== '#333333').map((p) => p.key);
        assert.deepStrictEqual([lit('D'), lit('R'), lit('P')], [['selD'], ['selR'], ['selP']], where + ': the engaged one lit');
    });
    // the clock: 24-hour, Brasília's time, the date as written in Brazil
    const ck = require(path.join(APP, 'clock'));
    ck.setZone('utc-3'); ck.setTwelve(false);
    assert.deepStrictEqual([ck.hm(Date.UTC(2026, 10, 14, 18, 5)), ck.dmy(Date.UTC(2026, 10, 14, 18, 5)), ck.dmy(Date.UTC(2026, 10, 15, 1, 30))], ['15:05', '14/11/2026', '14/11/2026']);
    ok++;
}
console.log(ok + ' passed');
process.exit(0);
