const {test} = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
for (const file of ['course-v1', 'course-models', 'course-guides', 'course-extension',
  'course-editorial', 'course-editorial-a', 'course-editorial-b', 'course-editorial-c']) {
  require('../learning/' + file);
}
for (const file of ['learning-indicators', 'academy-market-indicators',
  'academy-studio-indicators', 'academy-reading-indicators']) require('../js/' + file);

test('each indicator reading opens three distinct authored stages for its subject', () => {
  const guides = window.TD_MARKET_INDICATOR_GUIDES;
  const readings = window.TD_READING_LESSONS;
  assert.equal(Object.keys(readings).length, 28);
  assert.deepEqual(Object.keys(readings).sort(), Object.keys(guides).sort());
  for (const [id, lesson] of Object.entries(readings)) {
    const indices = lesson.steps.map(step => step.modelStep);
    assert.equal(indices.length, 3, id);
    assert.equal(new Set(indices).size, 3, id);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b), id);
    for (const step of lesson.steps) {
      assert.ok(guides[id].stages[step.modelStep], id);
      assert.ok(step.look && step.body && step.title, id);
    }
    assert.ok(lesson.examplePrompt && lesson.practicePrompt && new URL(lesson.source.url), id);
  }
});

test('the RSI context lesson describes the same historical zone it draws', () => {
  const id = '13.3';
  const api = window.TD_STUDIO_INDICATORS;
  const guide = window.TD_MARKET_INDICATOR_GUIDES[id];
  const states = [0, 1, 2, 3, 4].map(step => ({step})).concat({practice: true, step: 3});
  for (const state of states) {
    const scene = guide.build(state);
    const {bars} = api.inspect(id, state);
    const high = Math.max(...bars.slice(24, 48).map(bar => bar.h));
    const [zone] = scene.price.zones;
    assert.equal(scene.price.zones.length, 1);
    assert.deepEqual([zone.low, zone.high, zone.from], [high - 1.5, high, 47]);
    const approach = bars.findLastIndex((bar, i) =>
      i >= 48 && bar.l <= zone.high && bar.h >= zone.low);
    if (approach >= 0) assert.doesNotMatch(scene.explanation, /посещения в доступном фрагменте пока нет/);
    const host = {clientWidth: 600, innerHTML: '', querySelector: () => null};
    window.TD_STUDIO_LESSONS[id].render(host, state);
    assert.doesNotMatch(host.innerHTML, /первым 20 свечам|первых 20 свечей/);
    if (!state.practice) assert.match(host.innerHTML, /Границы старой области/);
  }
});

test('unanswered practice supplies the inputs and restores teaching after the attempt', () => {
  const calls = [];
  window.TDTerminalChart = {mount(host, config) { calls.push(config); return () => {}; }};
  try {
    for (const id of window.TD_STUDIO_INDICATORS.keys) {
      const entry = window.TD_STUDIO_LESSONS[id];
      const host = {clientWidth: 600, innerHTML: '', closest: () => ({}),
        querySelector: selector => selector.startsWith('[data-as-indicator-') ? {} : null};
      calls.length = 0;
      const cleanup = entry.render(host, {practice: true});
      assert.doesNotMatch(host.innerHTML, /as-indicator-(meaning|checklist|formula|reading)|as-market-facts/, id);
      assert.ok(calls.every(chart => chart.bars.length === 80 && !chart.markers?.length), id);
      if (id === '13.3') assert.equal(calls[0].zones.length, 1);
      if (id === '4.2') {
        const series = calls.flatMap(chart => chart.series || []).find(line => line.label === 'SMA(3)');
        assert.equal(series.values[79], null);
        assert.ok(Number.isFinite(series.values[78]));
        assert.match(host.innerHTML, /Исходные Close свечей 78–80/);
        assert.match(host.innerHTML, /вычисли самостоятельно/);
      }
      if (id === '11.5') assert.doesNotMatch(host.innerHTML, /2 справа|t\+2/);
      if (id === '11.9') {
        assert.doesNotMatch(host.innerHTML, /C\/C|× 100/);
        assert.doesNotMatch(entry.practice.question, /C\/C/);
      }
      cleanup();
      entry.render(host, {practice: true, revealed: true});
      assert.match(host.innerHTML, /as-indicator-formula/, id);
      assert.ok(host.innerHTML.indexOf('as-indicator-meaning') > host.innerHTML.indexOf('data-as-indicator-overlay'), id);
    }
  } finally {
    delete window.TDTerminalChart;
  }
});

test('parameter switches emit a reading for the selected method and actual last visible interval', () => {
  for (const [id, parameter] of [['4.3','ema'], ['11.4','ema'], ['11.13','short'], ['11.16','short']]) {
    const control = {}, descriptions = [];
    const host = {clientWidth: 600, innerHTML: '', querySelector: s => s === '.as-indicator-parameter' ? control : null};
    window.TD_STUDIO_LESSONS[id].render(host, {step: 1, onDescription: d => descriptions.push(d)});
    control.value = parameter;
    control.onchange();
    const d = window.TD_STUDIO_INDICATORS.inspect(id, {step: 1}, parameter);
    const note = descriptions.at(-1);
    assert.equal(note.parameter, parameter, id);
    assert.ok(note.body.includes('свече '+d.count), id);
    for (const panel of d.panels) for (const line of panel.lines) {
      assert.ok(note.body.includes(line.label), id);
      assert.ok(note.body.includes(line.values.at(-1).toLocaleString('ru-RU',{maximumFractionDigits:2})), id);
    }
    control.value = 'default';
    control.onchange();
    assert.equal(descriptions.at(-1).parameter, 'default');
  }
});
