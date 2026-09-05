(function () {
  const C = {
    red: '#ef6b6b',
    blue: '#6da7ff',
    yellow: '#f2cf66',
    neutral: '#8c949b'
  };

  const core = (id, x, y, tag = 'CORE') => ({ id, x, y, vx: 0, vy: 0, shape: 'square', color: 'neutral', tag, immovable: true, r: 20 });
  const obj = (id, shape, color, x, y, vx = 0, vy = 0, r = 16) => ({ id, shape, color, x, y, vx, vy, r });
  const zone = (id, x, y, radius, label, ring = false, inner = 0) => ({ id, x, y, radius, inner, label, ring });

  const forceRule = (id, subject, relation, object, editable = {}, options = {}, note = '', extra = {}) => ({
    id, type: 'world', subject, relation, object, editable, options, note, active: true, ...extra
  });

  const metaRule = (id, trigger, action, target, editable = {}, options = {}, note = '') => ({
    id, type: 'meta', trigger, action, target, editable, options, note, active: true
  });

  const levels = [
    {
      id: '01', chapter: 1, chapterName: 'FORCE', title: 'A Small Attraction',
      goalText: 'Bring both circles into the core field.', hint: 'Distance is not the problem. The direction of the force is.', editLimit: 1, timeout: 8,
      objects: [core('k', 480, 300), obj('a', 'circle', 'blue', 220, 220), obj('b', 'circle', 'blue', 740, 380)],
      zones: [zone('corefield', 480, 300, 96, 'CORE FIELD')],
      rules: [forceRule('r1', 'CIRCLE', 'REPELS', 'CORE', { relation: true }, { relation: ['ATTRACTS', 'REPELS'] }, 'Forces continuously accelerate matching objects.')],
      goal: { type: 'allInZone', selector: 'CIRCLE', zone: 'corefield', hold: 0.55 }
    },
    {
      id: '02', chapter: 1, chapterName: 'FORCE', title: 'Make Room',
      goalText: 'Push every red object outside the exclusion field.', hint: 'The core does not need to move. Make the red objects disagree with it.', editLimit: 1, timeout: 8,
      objects: [core('k', 480, 300), obj('a', 'circle', 'red', 420, 250), obj('b', 'triangle', 'red', 525, 245), obj('c', 'circle', 'red', 490, 360)],
      zones: [zone('exclusion', 480, 300, 205, 'EXCLUSION FIELD')],
      rules: [forceRule('r1', 'RED', 'ATTRACTS', 'CORE', { relation: true }, { relation: ['ATTRACTS', 'REPELS'] }, 'A repulsive rule pushes the subject away from the nearest target.')],
      goal: { type: 'allOutsideZone', selector: 'RED', zone: 'exclusion', hold: 0.6 }
    },
    {
      id: '03', chapter: 1, chapterName: 'FORCE', title: 'A Stable Argument',
      goalText: 'Hold every triangle inside the orbital band.', hint: 'Neither attraction nor repulsion wants a fixed distance.', editLimit: 1, timeout: 9,
      objects: [core('k', 480, 300), obj('a', 'triangle', 'yellow', 210, 300, 0, -18), obj('b', 'triangle', 'yellow', 690, 205, 15, 0), obj('c', 'triangle', 'yellow', 675, 425, -12, 0)],
      zones: [zone('orbit', 480, 300, 158, 'ORBITAL BAND', true, 105)],
      rules: [forceRule('r1', 'TRIANGLE', 'ATTRACTS', 'CORE', { relation: true }, { relation: ['ATTRACTS', 'REPELS', 'ORBITS'] }, 'Orbit combines tangential motion with a preferred distance.')],
      goal: { type: 'allInRing', selector: 'TRIANGLE', zone: 'orbit', hold: 1.1 }
    },
    {
      id: '04', chapter: 1, chapterName: 'FORCE', title: 'Choose the Subject',
      goalText: 'Put every blue circle in the core field. Keep red circles out.', hint: 'The verb already does what you need. Ask which objects should obey it.', editLimit: 1, timeout: 8,
      objects: [core('k', 480, 300), obj('b1', 'circle', 'blue', 225, 190), obj('b2', 'circle', 'blue', 730, 405), obj('r1', 'circle', 'red', 250, 420), obj('r2', 'circle', 'red', 720, 185)],
      zones: [zone('corefield', 480, 300, 100, 'CORE FIELD')],
      rules: [forceRule('r1', 'RED', 'ATTRACTS', 'CORE', { subject: true }, { subject: ['RED', 'BLUE'] }, 'Selectors decide which objects a rule can act on.')],
      goal: { type: 'zoneOnlyColor', color: 'blue', requiredSelector: 'BLUE', zone: 'corefield', hold: 0.7 }
    },

    {
      id: '05', chapter: 2, chapterName: 'CONTACT', title: 'Consumption',
      goalText: 'Leave only red objects alive.', hint: 'The chase is already correct. Change what contact means.', editLimit: 1, timeout: 9,
      objects: [obj('r', 'circle', 'red', 175, 300, 20, 0, 18), obj('b1', 'circle', 'blue', 430, 215, 0, 0), obj('b2', 'triangle', 'blue', 690, 350, 0, 0)],
      zones: [],
      rules: [
        forceRule('r1', 'RED', 'ATTRACTS', 'BLUE', {}, {}, 'Locked rule.'),
        forceRule('r2', 'RED', 'SWAPS', 'BLUE', { relation: true }, { relation: ['SWAPS', 'CONSUMES', 'INFECTS'] }, 'Contact verbs trigger when two matching objects touch.')
      ],
      goal: { type: 'onlyColorAlive', color: 'red', hold: 0.35 }
    },
    {
      id: '06', chapter: 2, chapterName: 'CONTACT', title: 'Reverse the Predator',
      goalText: 'Leave only blue objects alive.', hint: 'The collision verb is already lethal. The wrong side owns it.', editLimit: 1, timeout: 9,
      objects: [obj('b', 'circle', 'blue', 480, 300, 0, 0, 19), obj('r1', 'triangle', 'red', 225, 190), obj('r2', 'circle', 'red', 725, 410)],
      zones: [],
      rules: [
        forceRule('r1', 'BLUE', 'ATTRACTS', 'RED', {}, {}, 'Locked rule.'),
        forceRule('r2', 'RED', 'CONSUMES', 'RED', { subject: true }, { subject: ['RED', 'BLUE'] }, 'The subject performs the contact action on the object.')
      ],
      goal: { type: 'onlyColorAlive', color: 'blue', hold: 0.35 }
    },
    {
      id: '07', chapter: 2, chapterName: 'CONTACT', title: 'Contagion',
      goalText: 'Turn every surviving object blue.', hint: 'Nothing needs to die. Let contact copy an identity instead.', editLimit: 1, timeout: 10,
      objects: [obj('b', 'circle', 'blue', 180, 300, 25, 0), obj('r1', 'circle', 'red', 390, 170), obj('r2', 'triangle', 'red', 550, 300), obj('r3', 'square', 'red', 760, 420)],
      zones: [],
      rules: [
        forceRule('r1', 'BLUE', 'ATTRACTS', 'RED', {}, {}, 'Every newly infected blue object joins the chase.'),
        forceRule('r2', 'BLUE', 'SWAPS', 'RED', { relation: true }, { relation: ['SWAPS', 'CONSUMES', 'INFECTS'] }, 'INFECTS copies the subject color to the contacted target.')
      ],
      goal: { type: 'allColor', color: 'blue', hold: 0.6 }
    },
    {
      id: '08', chapter: 2, chapterName: 'CONTACT', title: 'Rest State',
      goalText: 'Bring every mobile object to rest.', hint: 'They already approach the core. Decide what happens when they get close.', editLimit: 1, timeout: 9,
      objects: [core('k', 480, 300), obj('a', 'circle', 'yellow', 170, 170, 35, 0), obj('b', 'triangle', 'blue', 780, 200, -25, 10), obj('c', 'circle', 'red', 730, 470, -15, -20), obj('d', 'square', 'yellow', 230, 450, 20, -15)],
      zones: [zone('corefield', 480, 300, 82, 'REST FIELD')],
      rules: [
        forceRule('r1', 'ANY', 'ATTRACTS', 'CORE', {}, {}, 'Locked rule.'),
        forceRule('r2', 'ANY', 'ORBITS', 'CORE', { relation: true }, { relation: ['ORBITS', 'FREEZES'] }, 'FREEZES zeros the subject velocity near its target.')
      ],
      goal: { type: 'allStopped', excludeTag: 'CORE', hold: 1.0, after: 1.2 }
    },

    {
      id: '09', chapter: 3, chapterName: 'STATE', title: 'Only What Moves',
      goalText: 'Put exactly the two moving objects into the core field.', hint: 'Color and shape are distractions. Select by state.', editLimit: 1, timeout: 8,
      objects: [core('k', 480, 300), obj('a', 'circle', 'red', 180, 210, 36, 12), obj('b', 'triangle', 'blue', 760, 395, -30, -10), obj('c', 'circle', 'yellow', 190, 440, 0, 0), obj('d', 'square', 'red', 760, 160, 0, 0)],
      zones: [zone('corefield', 480, 300, 105, 'CORE FIELD')],
      rules: [forceRule('r1', 'RED', 'ATTRACTS', 'CORE', { subject: true }, { subject: ['RED', 'MOVING', 'STILL'] }, 'MOVING and STILL are evaluated continuously from current speed.')],
      goal: { type: 'zoneExact', zone: 'corefield', count: 2, mustMatch: 'MOVING', hold: 0.6 }
    },
    {
      id: '10', chapter: 3, chapterName: 'STATE', title: 'Evacuation',
      goalText: 'Push every moving object outside the exclusion field. Leave still objects untouched.', hint: 'Do not select by appearance. Select by activity.', editLimit: 1, timeout: 8,
      objects: [core('k', 480, 300), obj('a', 'circle', 'red', 425, 245, 20, -8), obj('b', 'triangle', 'blue', 535, 350, -18, 11), obj('c', 'circle', 'yellow', 460, 380, 0, 0), obj('d', 'square', 'red', 525, 220, 0, 0)],
      zones: [zone('exclusion', 480, 300, 200, 'EXCLUSION FIELD')],
      rules: [forceRule('r1', 'ANY', 'REPELS', 'CORE', { subject: true }, { subject: ['ANY', 'MOVING', 'STILL'] }, 'Only the selected state should feel the force.')],
      goal: { type: 'movingOutsideStillInside', zone: 'exclusion', hold: 0.7 }
    },
    {
      id: '11', chapter: 3, chapterName: 'STATE', title: 'Carrier',
      goalText: 'Turn every object blue using the single moving carrier.', hint: 'The carrier is defined by motion, not by its current color.', editLimit: 1, timeout: 11.5,
      objects: [obj('b', 'circle', 'blue', 170, 300, 36, 0), obj('r1', 'triangle', 'red', 380, 160), obj('r2', 'circle', 'red', 500, 310), obj('r3', 'square', 'red', 700, 185), obj('r4', 'circle', 'red', 760, 440)],
      zones: [],
      rules: [
        forceRule('r1', 'MOVING', 'ATTRACTS', 'RED', {}, {}, 'The carrier keeps seeking red targets.'),
        forceRule('r2', 'STILL', 'INFECTS', 'RED', { subject: true }, { subject: ['BLUE', 'MOVING', 'STILL'] }, 'If identity changes, state selectors can preserve a carrier role that color selectors cannot.')
      ],
      goal: { type: 'allColor', color: 'blue', hold: 0.6 }
    },
    {
      id: '12', chapter: 3, chapterName: 'STATE', title: 'Two Destinations',
      goalText: 'Send moving objects left and still objects right.', hint: 'The two rules have their subjects crossed.', editLimit: 2, timeout: 10,
      objects: [core('ka', 250, 300, 'CORE-A'), core('kb', 710, 300, 'CORE-B'), obj('m1', 'circle', 'blue', 480, 160, 28, 0), obj('m2', 'triangle', 'red', 480, 440, -28, 0), obj('s1', 'circle', 'yellow', 430, 300, 0, 0), obj('s2', 'square', 'red', 530, 300, 0, 0)],
      zones: [zone('left', 250, 300, 100, 'MOVING'), zone('right', 710, 300, 100, 'STILL')],
      rules: [
        forceRule('r1', 'STILL', 'ATTRACTS', 'CORE-A', { subject: true }, { subject: ['MOVING', 'STILL'] }, 'Left destination.'),
        forceRule('r2', 'MOVING', 'ATTRACTS', 'CORE-B', { subject: true }, { subject: ['MOVING', 'STILL'] }, 'Right destination.')
      ],
      goal: { type: 'splitStateZones', movingZone: 'left', stillZone: 'right', hold: 0.7 }
    },

    {
      id: '13', chapter: 4, chapterName: 'META', title: 'Rule About a Rule',
      goalText: 'Bring every circle into the core field despite the meta-rule.', hint: 'You do not have to repair Rule 1. Stop Rule M from changing it.', editLimit: 1, timeout: 9,
      objects: [core('k', 480, 300), obj('a', 'circle', 'blue', 190, 210), obj('b', 'circle', 'yellow', 760, 390)],
      zones: [zone('corefield', 480, 300, 100, 'CORE FIELD')],
      rules: [
        forceRule('r1', 'CIRCLE', 'ATTRACTS', 'CORE', {}, {}, 'Rule 1 can be inverted by a meta-rule.'),
        metaRule('m1', 'EVERY 2S', 'INVERTS', 'RULE 1', { trigger: true }, { trigger: ['EVERY 2S', 'NEVER'] }, 'Meta-rules execute while the world is running.')
      ],
      goal: { type: 'allInZone', selector: 'CIRCLE', zone: 'corefield', hold: 0.65 }
    },
    {
      id: '14', chapter: 4, chapterName: 'META', title: 'Redirect the Damage',
      goalText: 'Keep circles near the core and triangles outside.', hint: 'The meta-rule must still fire. Point it at the harmless rule.', editLimit: 1, timeout: 10,
      objects: [core('k', 480, 300), obj('c1', 'circle', 'blue', 180, 230), obj('c2', 'circle', 'blue', 770, 370), obj('t1', 'triangle', 'red', 410, 265), obj('t2', 'triangle', 'red', 550, 340)],
      zones: [zone('inner', 480, 300, 105, 'INNER'), zone('outer', 480, 300, 210, 'EXCLUSION')],
      rules: [
        forceRule('r1', 'CIRCLE', 'ATTRACTS', 'CORE', {}, {}, 'Rule 1.'),
        forceRule('r2', 'TRIANGLE', 'REPELS', 'CORE', {}, {}, 'Rule 2.'),
        forceRule('r3', 'SQUARE', 'ATTRACTS', 'CORE', {}, {}, 'Rule 3 has no mobile subjects in this world.'),
        metaRule('m1', 'EVERY 2S', 'INVERTS', 'RULE 1', { target: true }, { target: ['RULE 1', 'RULE 2', 'RULE 3'] }, 'Redirecting a meta-rule can be safer than disabling it.')
      ],
      goal: { type: 'circlesInTrianglesOut', innerZone: 'inner', outerZone: 'outer', hold: 0.8 }
    },
    {
      id: '15', chapter: 4, chapterName: 'META', title: 'One Reversal',
      goalText: 'Let the circles approach, then force them beyond the exclusion field.', hint: 'A single timed inversion is useful. Repeating it is not.', editLimit: 1, timeout: 9,
      objects: [core('k', 480, 300), obj('a', 'circle', 'yellow', 190, 220, 0, 0), obj('b', 'circle', 'yellow', 760, 390, 0, 0)],
      zones: [zone('exclusion', 480, 300, 215, 'EXCLUSION')],
      rules: [
        forceRule('r1', 'CIRCLE', 'ATTRACTS', 'CORE', {}, {}, 'Rule 1.'),
        metaRule('m1', 'NEVER', 'INVERTS', 'RULE 1', { trigger: true }, { trigger: ['NEVER', 'AT 2S', 'EVERY 2S'] }, 'AT 2S fires once. EVERY 2S keeps firing.')
      ],
      goal: { type: 'allOutsideAfter', selector: 'CIRCLE', zone: 'exclusion', after: 5.0, hold: 0.65 }
    },
    {
      id: '16', chapter: 4, chapterName: 'META', title: 'The System Watches Itself',
      goalText: 'Stabilize all three behaviors: blue inside, red outside, triangles in orbit.', hint: 'Each sabotage rule can be redirected to Rule 4, which has no subject.', editLimit: 3, timeout: 12,
      objects: [
        core('k', 480, 300),
        obj('b1', 'circle', 'blue', 170, 180), obj('b2', 'circle', 'blue', 790, 420),
        obj('r1', 'square', 'red', 430, 250), obj('r2', 'square', 'red', 540, 360),
        obj('t1', 'triangle', 'yellow', 220, 410, 0, -15), obj('t2', 'triangle', 'yellow', 735, 180, 0, 15)
      ],
      zones: [zone('inner', 480, 300, 100, 'BLUE FIELD'), zone('outer', 480, 300, 205, 'RED EXCLUSION'), zone('orbit', 480, 300, 165, 'TRIANGLE ORBIT', true, 105)],
      rules: [
        forceRule('r1', 'BLUE', 'ATTRACTS', 'CORE', {}, {}, 'Blue behavior.'),
        forceRule('r2', 'RED', 'REPELS', 'CORE', {}, {}, 'Red behavior.'),
        forceRule('r3', 'TRIANGLE', 'ORBITS', 'CORE', {}, {}, 'Triangle behavior.'),
        forceRule('r4', 'STILL', 'SWAPS', 'CORE', {}, {}, 'Harmless sink: cores cannot participate in contact.'),
        metaRule('m1', 'AT 1S', 'INVERTS', 'RULE 1', { target: true }, { target: ['RULE 1', 'RULE 4'] }, 'Sabotage A.'),
        metaRule('m2', 'AT 2S', 'INVERTS', 'RULE 2', { target: true }, { target: ['RULE 2', 'RULE 4'] }, 'Sabotage B.'),
        metaRule('m3', 'AT 3S', 'INVERTS', 'RULE 3', { target: true }, { target: ['RULE 3', 'RULE 4'] }, 'Sabotage C.')
      ],
      goal: { type: 'bossComposite', blueZone: 'inner', redZone: 'outer', triangleZone: 'orbit', hold: 1.0 }
    }
  ];

  const chapters = [
    { id: 1, name: 'FORCE', subtitle: 'Direction and distance' },
    { id: 2, name: 'CONTACT', subtitle: 'What touching means' },
    { id: 3, name: 'STATE', subtitle: 'Select by behavior' },
    { id: 4, name: 'META', subtitle: 'Rules that alter rules' }
  ];

  window.AXIOM_DATA = { colors: C, levels, chapters };
})();
