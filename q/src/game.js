(function () {
  const { levels, chapters, colors } = window.AXIOM_DATA;
  const clone = x => JSON.parse(JSON.stringify(x));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const SAVE_KEY = 'axiom.save.v1';

  const ui = {
    menu: $('#menu'), game: $('#game'),
    continueBtn: $('#continueBtn'), continueMeta: $('#continueMeta'), chaptersBtn: $('#chaptersBtn'), endlessBtn: $('#endlessBtn'), howBtn: $('#howBtn'),
    soundBtn: $('#soundBtn'), resetSaveBtn: $('#resetSaveBtn'), backBtn: $('#backBtn'),
    chapterLabel: $('#chapterLabel'), levelTitle: $('#levelTitle'), goalText: $('#goalText'), editCounter: $('#editCounter'), timeCounter: $('#timeCounter'),
    canvas: $('#worldCanvas'), worldMessage: $('#worldMessage'), rulesList: $('#rulesList'), legend: $('#legendContent'),
    runBtn: $('#runBtn'), pauseBtn: $('#pauseBtn'), rewindBtn: $('#rewindBtn'), resetRulesBtn: $('#resetRulesBtn'), hintBtn: $('#hintBtn'),
    chaptersDialog: $('#chaptersDialog'), levelGrid: $('#levelGrid'), howDialog: $('#howDialog'),
    completeDialog: $('#completeDialog'), completeTitle: $('#completeTitle'), completeStats: $('#completeStats'), nextBtn: $('#nextBtn'), replayBtn: $('#replayBtn'), completeMenuBtn: $('#completeMenuBtn'),
    confirmDialog: $('#confirmDialog'), confirmResetBtn: $('#confirmResetBtn'), cancelResetBtn: $('#cancelResetBtn')
  };

  function defaultSave() { return { completed: {}, bestTime: {}, endlessWins: 0, sound: true, lastLevel: '01' }; }
  function loadSave() {
    try { return { ...defaultSave(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
    catch { return defaultSave(); }
  }
  let save = loadSave();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }

  let currentLevel = null;
  let currentRules = null;
  let mode = 'campaign';
  let endlessSerial = 0;
  let messageTimer = 0;

  class Sound {
    constructor() { this.ctx = null; }
    ensure() {
      if (!save.sound) return null;
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    tone(freq = 300, duration = .05, gain = .025, type = 'sine', delay = 0) {
      const ctx = this.ensure(); if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + .006);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + delay + duration);
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + duration + .02);
    }
    click() { this.tone(260, .035, .018, 'square'); }
    run() { this.tone(180, .08, .022, 'triangle'); this.tone(260, .08, .018, 'triangle', .04); }
    meta() { this.tone(520, .06, .022, 'square'); this.tone(390, .08, .015, 'square', .05); }
    contact(kind) {
      if (kind === 'consume') this.tone(115, .10, .03, 'sawtooth');
      else if (kind === 'infect') { this.tone(430, .05, .018, 'sine'); this.tone(590, .08, .014, 'sine', .035); }
      else this.tone(240, .04, .014, 'square');
    }
    success() {
      [330, 440, 660].forEach((f, i) => this.tone(f, .18, .025, 'sine', i * .07));
    }
  }
  const sound = new Sound();

  const engine = new window.AXIOM.Engine(ui.canvas, {
    onTick: t => { ui.timeCounter.textContent = t.toFixed(1); },
    onComplete: t => completeLevel(t),
    onTimeout: () => {
      syncControls();
      showMessage('GOAL NOT SATISFIED\nRewind the world and revise an axiom.', 0);
    },
    onMeta: () => { sound.meta(); renderRules(); },
    onContact: kind => sound.contact(kind)
  });

  function showScreen(name) {
    ui.menu.classList.toggle('active', name === 'menu');
    ui.game.classList.toggle('active', name === 'game');
  }

  function labelToken(v) { return String(v).replaceAll('-', ' '); }

  function countEdits() {
    if (!currentLevel || !currentRules) return 0;
    let n = 0;
    currentRules.forEach((r, i) => {
      const base = currentLevel.rules[i];
      for (const field of ['subject', 'relation', 'object', 'trigger', 'action', 'target']) {
        if (r.editable && r.editable[field] && r[field] !== base[field]) n++;
      }
    });
    return n;
  }

  function updateEditCounter() {
    const n = countEdits();
    ui.editCounter.textContent = `${n} / ${currentLevel ? currentLevel.editLimit : 0}`;
    ui.editCounter.style.color = n === currentLevel?.editLimit ? 'var(--accent)' : '';
  }

  function makeToken(rule, ruleIndex, field) {
    const editable = !!rule.editable?.[field];
    const value = rule[field];
    if (!editable) {
      const span = document.createElement('span');
      span.className = 'rule-token locked';
      span.textContent = labelToken(value);
      return span;
    }
    const select = document.createElement('select');
    select.className = 'rule-token';
    select.setAttribute('aria-label', `Rule ${ruleIndex + 1} ${field}`);
    const choices = rule.options?.[field] || [value];
    for (const v of choices) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = labelToken(v); opt.selected = v === value;
      select.appendChild(opt);
    }
    select.disabled = engine.running;
    select.addEventListener('change', () => {
      sound.click();
      const previous = currentRules[ruleIndex][field];
      currentRules[ruleIndex][field] = select.value;
      if (countEdits() > currentLevel.editLimit) {
        currentRules[ruleIndex][field] = previous;
        select.value = previous;
        showMessage(`EDIT LIMIT: ${currentLevel.editLimit}\nRestore another edited token before changing this one.`, 2600);
        return;
      }
      engine.load(currentLevel, currentRules);
      ui.timeCounter.textContent = '0.0';
      hideMessage();
      updateEditCounter();
      renderRules();
      syncControls();
    });
    return select;
  }

  function renderRules() {
    ui.rulesList.innerHTML = '';
    if (!currentRules) return;
    let worldNo = 0, metaNo = 0;
    currentRules.forEach((rule, i) => {
      if (rule.type === 'meta') metaNo++; else worldNo++;
      const card = document.createElement('div');
      card.className = 'rule-card' + (rule.active === false ? ' disabled-rule' : '');
      const head = document.createElement('div');
      head.className = 'rule-index';
      const left = document.createElement('span'); left.textContent = rule.type === 'meta' ? `META ${metaNo}` : `RULE ${worldNo}`;
      const right = document.createElement('span');
      const liveRule = engine.rules?.find(r => r.id === rule.id);
      if (liveRule && liveRule.type === 'world' && liveRule.relation !== rule.relation) {
        right.className = 'rule-live'; right.textContent = `LIVE: ${liveRule.relation}`;
      } else right.textContent = rule.type === 'meta' ? 'META' : 'WORLD';
      head.append(left, right);
      const sentence = document.createElement('div');
      sentence.className = 'rule-sentence' + (rule.type === 'meta' ? ' meta' : '');
      if (rule.type === 'meta') {
        sentence.append(makeToken(rule, i, 'trigger'), makeToken(rule, i, 'action'), makeToken(rule, i, 'target'));
      } else {
        sentence.append(makeToken(rule, i, 'subject'), makeToken(rule, i, 'relation'), makeToken(rule, i, 'object'));
      }
      card.append(head, sentence);
      if (rule.note) {
        const note = document.createElement('div'); note.className = 'rule-note'; note.textContent = rule.note; card.append(note);
      }
      ui.rulesList.append(card);
    });
  }

  function renderLegend() {
    ui.legend.innerHTML = '';
    const usedColors = [...new Set((currentLevel.objects || []).filter(o => !o.immovable).map(o => o.color))];
    for (const c of usedColors) {
      const item = document.createElement('span'); item.className = 'legend-item';
      const dot = document.createElement('i'); dot.className = 'legend-dot'; dot.style.background = colors[c] || '#aaa';
      item.append(dot, document.createTextNode(c.toUpperCase())); ui.legend.append(item);
    }
    const statesUsed = currentLevel.rules.some(r => ['MOVING', 'STILL'].includes(r.subject)) || currentLevel.rules.some(r => r.options?.subject?.some(v => ['MOVING', 'STILL'].includes(v)));
    if (statesUsed) {
      ['MOVING', 'STILL'].forEach(s => { const item = document.createElement('span'); item.className = 'legend-item'; item.textContent = s === 'MOVING' ? '→ MOVING STATE' : '· STILL STATE'; ui.legend.append(item); });
    }
  }

  function syncControls() {
    const running = engine.running;
    ui.runBtn.disabled = running;
    ui.pauseBtn.disabled = !running;
    ui.rewindBtn.disabled = running;
    ui.resetRulesBtn.disabled = running;
    ui.hintBtn.disabled = running;
    renderRules();
  }

  function loadLevel(level, newMode = 'campaign') {
    mode = newMode;
    currentLevel = clone(level);
    currentRules = clone(currentLevel.rules);
    save.lastLevel = mode === 'campaign' ? currentLevel.id : save.lastLevel;
    persist();
    ui.chapterLabel.textContent = mode === 'endless' ? 'ENDLESS · GENERATED' : `CHAPTER ${roman(currentLevel.chapter)} · ${currentLevel.chapterName}`;
    ui.levelTitle.textContent = currentLevel.title;
    ui.goalText.textContent = currentLevel.goalText;
    ui.timeCounter.textContent = '0.0';
    updateEditCounter();
    engine.load(currentLevel, currentRules);
    renderRules(); renderLegend(); syncControls(); hideMessage();
    showScreen('game');
  }

  function roman(n) { return ['I', 'II', 'III', 'IV', 'V'][n - 1] || String(n); }

  function rewind() {
    sound.click();
    engine.load(currentLevel, currentRules);
    ui.timeCounter.textContent = '0.0'; hideMessage(); syncControls();
  }

  function resetRules() {
    sound.click();
    currentRules = clone(currentLevel.rules);
    engine.load(currentLevel, currentRules);
    ui.timeCounter.textContent = '0.0'; hideMessage(); updateEditCounter(); renderRules(); syncControls();
  }

  function runWorld() {
    hideMessage(); sound.run(); engine.start(); syncControls();
  }

  function pauseWorld() { sound.click(); engine.pause(); syncControls(); }

  function completeLevel(time) {
    sound.success();
    const edits = countEdits();
    if (mode === 'campaign') {
      const old = save.completed[currentLevel.id];
      save.completed[currentLevel.id] = old == null ? edits : Math.min(old, edits);
      const oldTime = save.bestTime[currentLevel.id];
      save.bestTime[currentLevel.id] = oldTime == null ? Number(time.toFixed(2)) : Math.min(oldTime, Number(time.toFixed(2)));
    } else {
      save.endlessWins = (save.endlessWins || 0) + 1;
    }
    persist(); updateMenu();
    ui.completeTitle.textContent = mode === 'campaign' ? `${currentLevel.id} · ${currentLevel.title}` : `Endless ${currentLevel.id}`;
    ui.completeStats.textContent = `${edits} edit${edits === 1 ? '' : 's'} · ${time.toFixed(1)} seconds${mode === 'endless' ? ` · ${save.endlessWins} endless solved` : ''}`;
    ui.nextBtn.textContent = mode === 'endless' ? 'NEXT WORLD' : (currentLevel.id === levels[levels.length - 1].id ? 'END CAMPAIGN' : 'NEXT WORLD');
    setTimeout(() => ui.completeDialog.showModal(), 280);
    syncControls();
  }

  function nextWorld() {
    ui.completeDialog.close();
    if (mode === 'endless') { loadLevel(generateEndless(), 'endless'); return; }
    const i = levels.findIndex(l => l.id === currentLevel.id);
    if (i >= levels.length - 1) { showScreen('menu'); updateMenu(); return; }
    loadLevel(levels[i + 1], 'campaign');
  }

  function showMessage(text, duration = 0) {
    clearTimeout(messageTimer);
    ui.worldMessage.textContent = text;
    ui.worldMessage.classList.remove('hidden');
    if (duration) messageTimer = setTimeout(hideMessage, duration);
  }
  function hideMessage() { clearTimeout(messageTimer); ui.worldMessage.classList.add('hidden'); }

  function firstIncompleteIndex() {
    for (let i = 0; i < levels.length; i++) if (!save.completed[levels[i].id]) return i;
    return levels.length - 1;
  }
  function isUnlocked(i) { return i === 0 || !!save.completed[levels[i - 1].id]; }

  function updateMenu() {
    const idx = firstIncompleteIndex();
    const l = levels[idx];
    const allDone = Object.keys(save.completed).length >= levels.length;
    ui.continueMeta.textContent = allDone ? 'CAMPAIGN COMPLETE' : `LEVEL ${l.id} · ${l.chapterName}`;
    ui.soundBtn.textContent = `SOUND: ${save.sound ? 'ON' : 'OFF'}`;
  }

  function renderLevelGrid() {
    ui.levelGrid.innerHTML = '';
    let lastChapter = 0;
    levels.forEach((l, i) => {
      if (l.chapter !== lastChapter) {
        lastChapter = l.chapter;
        const ch = chapters.find(c => c.id === l.chapter);
        const strip = document.createElement('div'); strip.className = 'chapter-strip'; strip.textContent = `CHAPTER ${roman(ch.id)} · ${ch.name} — ${ch.subtitle}`; ui.levelGrid.append(strip);
      }
      const b = document.createElement('button'); b.className = 'level-card'; b.disabled = !isUnlocked(i);
      const best = save.completed[l.id];
      b.innerHTML = `<span class="num">${l.id}</span>${best != null ? '<span class="done">✓</span>' : ''}<h4>${l.title}</h4><p>${b.disabled ? 'LOCKED' : best != null ? `BEST · ${best} EDIT${best === 1 ? '' : 'S'}` : `${l.editLimit} EDIT LIMIT`}</p>`;
      b.addEventListener('click', () => { sound.click(); ui.chaptersDialog.close(); loadLevel(l, 'campaign'); });
      ui.levelGrid.append(b);
    });
  }

  function generateEndless() {
    endlessSerial++;
    const seed = (Date.now() ^ (endlessSerial * 2654435761)) >>> 0;
    let x = seed;
    const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(rand() * a.length)];
    const shapes = ['circle', 'triangle', 'square'];
    const colorNames = ['red', 'blue', 'yellow'];
    const shape = pick(shapes), color = pick(colorNames);
    const selector = shape.toUpperCase();
    const pattern = Math.floor(rand() * 4);
    const id = `E${String((save.endlessWins || 0) + 1).padStart(3, '0')}`;
    const base = { id, chapter: 0, chapterName: 'ENDLESS', editLimit: 1, timeout: 9, zones: [], rules: [] };

    const O = (id2, sh, col, px, py, vx = 0, vy = 0) => ({ id: id2, shape: sh, color: col, x: px, y: py, vx, vy, r: 16 });
    const K = { id: 'k', x: 480, y: 300, vx: 0, vy: 0, shape: 'square', color: 'neutral', tag: 'CORE', immovable: true, r: 20 };
    const Z = { id: 'z', x: 480, y: 300, radius: 105, inner: 0, label: 'TARGET FIELD', ring: false };
    const R = (id2, sub, rel, object, editable = {}, options = {}, note = '') => ({ id: id2, type: 'world', subject: sub, relation: rel, object, editable, options, note, active: true });

    if (pattern === 0) {
      return { ...base, title: 'Generated Attraction', goalText: `Bring every ${shape} into the target field.`, hint: 'Change the direction of the force.', objects: [K, O('a', shape, color, 185, 190), O('b', shape, color, 770, 405), O('d', pick(shapes), pick(colorNames), 170, 450)], zones: [Z], rules: [R('r1', selector, 'REPELS', 'CORE', { relation: true }, { relation: ['REPELS', 'ATTRACTS'] })], goal: { type: 'allInZone', selector, zone: 'z', hold: .6 } };
    }
    if (pattern === 1) {
      return { ...base, title: 'Generated Exclusion', goalText: `Push every ${color} object outside the field.`, hint: 'Change attraction into disagreement.', objects: [K, O('a', pick(shapes), color, 430, 240), O('b', pick(shapes), color, 525, 350), O('d', pick(shapes), pick(colorNames.filter(c => c !== color)), 720, 160)], zones: [{ ...Z, radius: 205, label: 'EXCLUSION' }], rules: [R('r1', color.toUpperCase(), 'ATTRACTS', 'CORE', { relation: true }, { relation: ['ATTRACTS', 'REPELS'] })], goal: { type: 'allOutsideZone', selector: color.toUpperCase(), zone: 'z', hold: .6 } };
    }
    const other = pick(colorNames.filter(c => c !== color));
    if (pattern === 2) {
      return { ...base, title: 'Generated Consumption', goalText: `Leave only ${color} objects alive.`, hint: 'Change the contact verb, not the chase.', objects: [O('a', shape, color, 170, 300, 22, 0), O('b', pick(shapes), other, 470, 200), O('c', pick(shapes), other, 730, 390)], rules: [R('r1', color.toUpperCase(), 'ATTRACTS', other.toUpperCase()), R('r2', color.toUpperCase(), 'SWAPS', other.toUpperCase(), { relation: true }, { relation: ['SWAPS', 'CONSUMES', 'INFECTS'] })], goal: { type: 'onlyColorAlive', color, hold: .35 } };
    }
    return { ...base, title: 'Generated Contagion', goalText: `Turn every object ${color}.`, hint: 'Identity can propagate without destruction.', objects: [O('a', shape, color, 170, 300, 28, 0), O('b', pick(shapes), other, 400, 170), O('c', pick(shapes), other, 560, 310), O('d', pick(shapes), other, 760, 430)], rules: [R('r1', color.toUpperCase(), 'ATTRACTS', other.toUpperCase()), R('r2', color.toUpperCase(), 'SWAPS', other.toUpperCase(), { relation: true }, { relation: ['SWAPS', 'CONSUMES', 'INFECTS'] })], goal: { type: 'allColor', color, hold: .6 } };
  }

  ui.continueBtn.addEventListener('click', () => { sound.click(); loadLevel(levels[firstIncompleteIndex()], 'campaign'); });
  ui.chaptersBtn.addEventListener('click', () => { sound.click(); renderLevelGrid(); ui.chaptersDialog.showModal(); });
  ui.endlessBtn.addEventListener('click', () => { sound.click(); loadLevel(generateEndless(), 'endless'); });
  ui.howBtn.addEventListener('click', () => { sound.click(); ui.howDialog.showModal(); });
  ui.soundBtn.addEventListener('click', () => { save.sound = !save.sound; persist(); updateMenu(); if (save.sound) sound.click(); });
  ui.resetSaveBtn.addEventListener('click', () => ui.confirmDialog.showModal());
  ui.confirmResetBtn.addEventListener('click', () => { save = defaultSave(); persist(); ui.confirmDialog.close(); updateMenu(); renderLevelGrid(); });
  ui.cancelResetBtn.addEventListener('click', () => ui.confirmDialog.close());
  ui.backBtn.addEventListener('click', () => { sound.click(); engine.pause(); showScreen('menu'); updateMenu(); });
  ui.runBtn.addEventListener('click', runWorld);
  ui.pauseBtn.addEventListener('click', pauseWorld);
  ui.rewindBtn.addEventListener('click', rewind);
  ui.resetRulesBtn.addEventListener('click', resetRules);
  ui.hintBtn.addEventListener('click', () => { sound.click(); showMessage(`HINT\n${currentLevel.hint}`, 4500); });
  ui.worldMessage.addEventListener('click', hideMessage);
  ui.nextBtn.addEventListener('click', nextWorld);
  ui.replayBtn.addEventListener('click', () => { ui.completeDialog.close(); resetRules(); });
  ui.completeMenuBtn.addEventListener('click', () => { ui.completeDialog.close(); showScreen('menu'); updateMenu(); });
  $$('.modal-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  [ui.chaptersDialog, ui.howDialog].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  updateMenu();

  window.__AXIOM_TEST__ = {
    loadLevel: i => loadLevel(levels[i], 'campaign'),
    levelCount: levels.length,
    generateEndless,
    engine,
    getRules: () => clone(currentRules),
    setRule: (i, field, value) => { currentRules[i][field] = value; engine.load(currentLevel, currentRules); renderRules(); updateEditCounter(); },
    run: () => engine.start(),
    save: () => clone(save)
  };
})();
