/* Headless deterministic campaign verification. No npm dependencies required. */
global.window = global;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
const noop = () => {};
const ctx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => (t[p] = v, true) });
const canvas = { getContext: () => ctx };

require('../src/levels.js');
require('../src/engine.js');

const solutions = {
  '01': [[0, 'relation', 'ATTRACTS']],
  '02': [[0, 'relation', 'REPELS']],
  '03': [[0, 'relation', 'ORBITS']],
  '04': [[0, 'subject', 'BLUE']],
  '05': [[1, 'relation', 'CONSUMES']],
  '06': [[1, 'subject', 'BLUE']],
  '07': [[1, 'relation', 'INFECTS']],
  '08': [[1, 'relation', 'FREEZES']],
  '09': [[0, 'subject', 'MOVING']],
  '10': [[0, 'subject', 'MOVING']],
  '11': [[1, 'subject', 'MOVING']],
  '12': [[0, 'subject', 'MOVING'], [1, 'subject', 'STILL']],
  '13': [[1, 'trigger', 'NEVER']],
  '14': [[3, 'target', 'RULE 3']],
  '15': [[1, 'trigger', 'AT 2S']],
  '16': [[4, 'target', 'RULE 4'], [5, 'target', 'RULE 4'], [6, 'target', 'RULE 4']]
};

function simulate(level, rules) {
  let completeAt = null;
  const engine = new AXIOM.Engine(canvas, { onComplete: t => { completeAt = t; } });
  engine.load(level, rules);
  for (let i = 0; i < Math.ceil(level.timeout * 60) && completeAt == null; i++) engine.step(1 / 60);
  return completeAt;
}

let failed = false;
for (const level of AXIOM_DATA.levels) {
  const unedited = simulate(level, level.rules);
  if (unedited != null) {
    failed = true;
    console.error(`FAIL ${level.id}: unedited world solves at ${unedited.toFixed(2)}s`);
    continue;
  }
  const rules = JSON.parse(JSON.stringify(level.rules));
  for (const [index, field, value] of solutions[level.id]) rules[index][field] = value;
  const solved = simulate(level, rules);
  if (solved == null) {
    failed = true;
    console.error(`FAIL ${level.id}: intended solution did not solve`);
  } else {
    console.log(`PASS ${level.id}  ${solved.toFixed(2)}s`);
  }
}

if (failed) process.exit(1);
console.log(`\nVerified ${AXIOM_DATA.levels.length}/${AXIOM_DATA.levels.length} campaign levels.`);
