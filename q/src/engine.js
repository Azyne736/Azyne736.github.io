(function () {
  const CONTACT_RELATIONS = new Set(['CONSUMES', 'INFECTS', 'SWAPS']);
  const FORCE_RELATIONS = new Set(['ATTRACTS', 'REPELS', 'ORBITS', 'FREEZES']);

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const len = (x, y) => Math.hypot(x, y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function labelColor(name) {
    return (window.AXIOM_DATA.colors || {})[name] || '#cfd4d6';
  }

  function selectorMatches(o, selector) {
    if (!o || !o.alive) return false;
    const s = String(selector || 'ANY').toUpperCase();
    if (s === 'ANY') return !o.immovable;
    if (s === 'CIRCLE' || s === 'TRIANGLE' || s === 'SQUARE') return o.shape.toUpperCase() === s && !o.immovable;
    if (s === 'RED' || s === 'BLUE' || s === 'YELLOW') return o.color.toUpperCase() === s && !o.immovable;
    if (s === 'MOVING' || s === 'STILL') return o.state === s && !o.immovable;
    if (s === 'CORE' || s === 'CORE-A' || s === 'CORE-B') return String(o.tag || '').toUpperCase() === s;
    return false;
  }

  function invertRelation(base) {
    const table = {
      ATTRACTS: 'REPELS',
      REPELS: 'ATTRACTS',
      ORBITS: 'ATTRACTS',
      FREEZES: 'ORBITS',
      CONSUMES: 'SWAPS',
      INFECTS: 'SWAPS',
      SWAPS: 'SWAPS'
    };
    return table[base] || base;
  }

  class Engine {
    constructor(canvas, hooks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hooks = hooks;
      this.width = 960;
      this.height = 600;
      this.level = null;
      this.objects = [];
      this.zones = [];
      this.rules = [];
      this.time = 0;
      this.running = false;
      this.completed = false;
      this.goalHold = 0;
      this.acc = 0;
      this.lastStamp = 0;
      this.contactCooldown = new Map();
      this.trails = new Map();
      this.metaPulse = 0;
      this.raf = 0;
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }

    destroy() { cancelAnimationFrame(this.raf); }

    load(level, editedRules) {
      this.level = level;
      this.objects = clone(level.objects).map(o => {
        const initialSpeed = len(o.vx || 0, o.vy || 0);
        return { alive: true, r: 16, vx: 0, vy: 0, ...o, state: initialSpeed > 2 ? 'MOVING' : 'STILL', initialState: initialSpeed > 2 ? 'MOVING' : 'STILL' };
      });
      this.zones = clone(level.zones || []);
      this.rules = clone(editedRules || level.rules).map(r => ({
        ...r,
        _baseRelation: r.relation,
        _metaInverted: false,
        _fired: false,
        _lastBucket: 0
      }));
      this.time = 0;
      this.running = false;
      this.completed = false;
      this.goalHold = 0;
      this.acc = 0;
      this.contactCooldown.clear();
      this.trails.clear();
      this.metaPulse = 0;
      this.render();
    }

    start() {
      if (!this.level || this.completed) return;
      this.running = true;
    }

    pause() { this.running = false; }

    loop(stamp) {
      if (!this.lastStamp) this.lastStamp = stamp;
      const frameDt = Math.min(0.05, (stamp - this.lastStamp) / 1000);
      this.lastStamp = stamp;
      if (this.running && this.level) {
        this.acc += frameDt;
        const fixed = 1 / 60;
        let steps = 0;
        while (this.acc >= fixed && steps < 5) {
          this.step(fixed);
          this.acc -= fixed;
          steps++;
        }
      }
      this.metaPulse = Math.max(0, this.metaPulse - frameDt * 1.8);
      this.render();
      this.raf = requestAnimationFrame(this.loop);
    }

    step(dt) {
      if (this.completed) return;
      this.time += dt;
      this.updateCooldowns(dt);
      this.processMeta();
      this.applyWorldRules(dt);
      this.integrate(dt);
      this.resolveContacts();
      this.evaluateGoal(dt);

      if (this.time >= this.level.timeout && !this.completed) {
        this.running = false;
        if (this.hooks.onTimeout) this.hooks.onTimeout();
      }
      if (this.hooks.onTick) this.hooks.onTick(this.time);
    }

    updateCooldowns(dt) {
      for (const [k, v] of this.contactCooldown) {
        const n = v - dt;
        if (n <= 0) this.contactCooldown.delete(k); else this.contactCooldown.set(k, n);
      }
    }

    processMeta() {
      for (const meta of this.rules.filter(r => r.type === 'meta' && r.active !== false)) {
        const trig = String(meta.trigger || 'NEVER').toUpperCase();
        if (trig === 'NEVER') continue;
        let fire = false;
        const at = trig.match(/^AT\s+(\d+(?:\.\d+)?)S$/);
        const every = trig.match(/^EVERY\s+(\d+(?:\.\d+)?)S$/);
        if (at) {
          const t = Number(at[1]);
          if (!meta._fired && this.time >= t) { fire = true; meta._fired = true; }
        } else if (every) {
          const period = Number(every[1]);
          const bucket = Math.floor(this.time / period);
          if (bucket > 0 && bucket > meta._lastBucket) { fire = true; meta._lastBucket = bucket; }
        }
        if (!fire) continue;
        this.executeMeta(meta);
      }
    }

    executeMeta(meta) {
      const idx = Number(String(meta.target || '').replace(/\D/g, '')) - 1;
      const worldRules = this.rules.filter(r => r.type === 'world');
      const target = worldRules[idx];
      if (!target) return;
      if (meta.action === 'INVERTS') {
        target._metaInverted = !target._metaInverted;
        target.relation = target._metaInverted ? invertRelation(target._baseRelation) : target._baseRelation;
      }
      this.metaPulse = 1;
      if (this.hooks.onMeta) this.hooks.onMeta(meta, target);
    }

    targetsFor(subject, selector) {
      return this.objects.filter(o => o !== subject && selectorMatches(o, selector));
    }

    applyWorldRules(dt) {
      for (const rule of this.rules) {
        if (rule.type !== 'world' || rule.active === false || !FORCE_RELATIONS.has(rule.relation)) continue;
        const subjects = this.objects.filter(o => selectorMatches(o, rule.subject));
        for (const s of subjects) {
          if (s.immovable || !s.alive) continue;
          const targets = this.targetsFor(s, rule.object);
          if (!targets.length) continue;
          let target = targets[0], best = Infinity;
          for (const t of targets) {
            const d = (s.x - t.x) ** 2 + (s.y - t.y) ** 2;
            if (d < best) { best = d; target = t; }
          }
          const dx = target.x - s.x, dy = target.y - s.y;
          const d = Math.max(1, len(dx, dy));
          const nx = dx / d, ny = dy / d;

          if (rule.relation === 'ATTRACTS' || rule.relation === 'REPELS') {
            const sign = rule.relation === 'ATTRACTS' ? 1 : -1;
            const desiredX = nx * 118 * sign;
            const desiredY = ny * 118 * sign;
            const steering = 1.55;
            s.vx += (desiredX - s.vx) * steering * dt;
            s.vy += (desiredY - s.vy) * steering * dt;
          } else if (rule.relation === 'ORBITS') {
            const preferred = 132;
            const tangentX = -ny, tangentY = nx;
            const radial = clamp((d - preferred) * 1.4, -75, 75);
            const desiredX = tangentX * 92 + nx * radial;
            const desiredY = tangentY * 92 + ny * radial;
            s.vx += (desiredX - s.vx) * 2.0 * dt;
            s.vy += (desiredY - s.vy) * 2.0 * dt;
          } else if (rule.relation === 'FREEZES') {
            if (d < 78) {
              s.vx *= Math.max(0, 1 - 9 * dt);
              s.vy *= Math.max(0, 1 - 9 * dt);
              if (len(s.vx, s.vy) < 3) { s.vx = 0; s.vy = 0; s.state = 'STILL'; }
            }
          }
        }
      }
    }

    integrate(dt) {
      const pad = 28;
      for (const o of this.objects) {
        if (!o.alive || o.immovable) continue;
        o.vx *= 0.9993;
        o.vy *= 0.9993;
        const speed = len(o.vx, o.vy);
        if (speed > 185) { o.vx *= 185 / speed; o.vy *= 185 / speed; }
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.x - o.r < pad) { o.x = pad + o.r; o.vx = Math.abs(o.vx) * 0.86; }
        if (o.x + o.r > this.width - pad) { o.x = this.width - pad - o.r; o.vx = -Math.abs(o.vx) * 0.86; }
        if (o.y - o.r < pad) { o.y = pad + o.r; o.vy = Math.abs(o.vy) * 0.86; }
        if (o.y + o.r > this.height - pad) { o.y = this.height - pad - o.r; o.vy = -Math.abs(o.vy) * 0.86; }

        const tr = this.trails.get(o.id) || [];
        if (this.running && Math.floor(this.time * 20) % 2 === 0) {
          tr.push([o.x, o.y]);
          if (tr.length > 16) tr.shift();
          this.trails.set(o.id, tr);
        }
      }
    }

    resolveContacts() {
      const alive = this.objects.filter(o => o.alive);
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i], b = alive[j];
          if (!a.alive || !b.alive) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.max(0.001, len(dx, dy));
          const minD = a.r + b.r;
          if (d > minD) continue;

          let special = false;
          for (const r of this.rules) {
            if (r.type !== 'world' || r.active === false || !CONTACT_RELATIONS.has(r.relation)) continue;
            if (selectorMatches(a, r.subject) && selectorMatches(b, r.object)) special = this.applyContactRule(r, a, b) || special;
            if (selectorMatches(b, r.subject) && selectorMatches(a, r.object)) special = this.applyContactRule(r, b, a) || special;
          }

          if (!a.alive || !b.alive) continue;
          this.separateAndBounce(a, b, d, dx, dy, minD, special);
        }
      }
    }

    applyContactRule(rule, subject, target) {
      if (subject.immovable || target.immovable) return false;
      const key = `${rule.id}:${subject.id}>${target.id}`;
      if (this.contactCooldown.has(key)) return true;
      this.contactCooldown.set(key, 0.22);
      if (rule.relation === 'CONSUMES') {
        target.alive = false;
        subject.vx *= 0.72; subject.vy *= 0.72;
        if (this.hooks.onContact) this.hooks.onContact('consume', subject, target);
        return true;
      }
      if (rule.relation === 'INFECTS') {
        if (target.color !== subject.color) {
          target.color = subject.color;
          if (this.hooks.onContact) this.hooks.onContact('infect', subject, target);
        }
        return true;
      }
      if (rule.relation === 'SWAPS') {
        const vx = subject.vx, vy = subject.vy;
        subject.vx = target.vx; subject.vy = target.vy;
        target.vx = vx; target.vy = vy;
        if (this.hooks.onContact) this.hooks.onContact('swap', subject, target);
        return true;
      }
      return false;
    }

    separateAndBounce(a, b, d, dx, dy, minD, special) {
      const nx = dx / d, ny = dy / d;
      const overlap = minD - d;
      const aMov = !a.immovable, bMov = !b.immovable;
      if (aMov && bMov) {
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
      } else if (aMov) {
        a.x -= nx * overlap; a.y -= ny * overlap;
      } else if (bMov) {
        b.x += nx * overlap; b.y += ny * overlap;
      }
      if (special) return;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const sepVel = rvx * nx + rvy * ny;
      if (sepVel > 0) return;
      const restitution = 0.82;
      const invA = aMov ? 1 : 0, invB = bMov ? 1 : 0;
      const impulse = -(1 + restitution) * sepVel / Math.max(1, invA + invB);
      if (aMov) { a.vx -= impulse * nx; a.vy -= impulse * ny; }
      if (bMov) { b.vx += impulse * nx; b.vy += impulse * ny; }
    }

    zoneById(id) { return this.zones.find(z => z.id === id); }
    inZone(o, z) {
      if (!o || !z || !o.alive) return false;
      const d = len(o.x - z.x, o.y - z.y);
      if (z.ring) return d >= (z.inner || 0) && d <= z.radius;
      return d <= z.radius;
    }

    matching(selector) { return this.objects.filter(o => selectorMatches(o, selector)); }
    mobileObjects() { return this.objects.filter(o => o.alive && !o.immovable); }

    goalCondition() {
      const g = this.level.goal;
      if (!g) return false;
      if (g.type === 'allInZone') {
        const z = this.zoneById(g.zone), list = this.matching(g.selector);
        return list.length > 0 && list.every(o => this.inZone(o, z));
      }
      if (g.type === 'allOutsideZone') {
        const z = this.zoneById(g.zone), list = this.matching(g.selector);
        return list.length > 0 && list.every(o => !this.inZone(o, z));
      }
      if (g.type === 'allInRing') {
        const z = this.zoneById(g.zone), list = this.matching(g.selector);
        return list.length > 0 && list.every(o => this.inZone(o, z));
      }
      if (g.type === 'zoneOnlyColor') {
        const z = this.zoneById(g.zone);
        const required = this.matching(g.requiredSelector);
        const inside = this.mobileObjects().filter(o => this.inZone(o, z));
        return required.length > 0 && required.every(o => this.inZone(o, z)) && inside.every(o => o.color === g.color);
      }
      if (g.type === 'onlyColorAlive') {
        const alive = this.mobileObjects();
        return alive.length > 0 && alive.every(o => o.color === g.color);
      }
      if (g.type === 'allColor') {
        const alive = this.mobileObjects();
        return alive.length > 1 && alive.every(o => o.color === g.color);
      }
      if (g.type === 'allStopped') {
        if (this.time < (g.after || 0)) return false;
        const list = this.mobileObjects().filter(o => !g.excludeTag || o.tag !== g.excludeTag);
        return list.length > 0 && list.every(o => len(o.vx, o.vy) < 2.2);
      }
      if (g.type === 'zoneExact') {
        const z = this.zoneById(g.zone);
        const inside = this.mobileObjects().filter(o => this.inZone(o, z));
        const matchers = this.objects.filter(o => o.alive && !o.immovable && o.initialState === g.mustMatch);
        return inside.length === g.count && matchers.length === g.count && matchers.every(o => this.inZone(o, z));
      }
      if (g.type === 'movingOutsideStillInside') {
        const z = this.zoneById(g.zone);
        const moving = this.objects.filter(o => o.alive && !o.immovable && o.initialState === 'MOVING');
        const still = this.objects.filter(o => o.alive && !o.immovable && o.initialState === 'STILL');
        return moving.every(o => !this.inZone(o, z)) && still.every(o => this.inZone(o, z));
      }
      if (g.type === 'splitStateZones') {
        const mz = this.zoneById(g.movingZone), sz = this.zoneById(g.stillZone);
        const moving = this.objects.filter(o => o.alive && !o.immovable && o.initialState === 'MOVING');
        const still = this.objects.filter(o => o.alive && !o.immovable && o.initialState === 'STILL');
        return moving.every(o => this.inZone(o, mz)) && still.every(o => this.inZone(o, sz));
      }
      if (g.type === 'circlesInTrianglesOut') {
        const iz = this.zoneById(g.innerZone), oz = this.zoneById(g.outerZone);
        const circles = this.matching('CIRCLE'), triangles = this.matching('TRIANGLE');
        return circles.every(o => this.inZone(o, iz)) && triangles.every(o => !this.inZone(o, oz));
      }
      if (g.type === 'allOutsideAfter') {
        if (this.time < (g.after || 0)) return false;
        const z = this.zoneById(g.zone), list = this.matching(g.selector);
        return list.length > 0 && list.every(o => !this.inZone(o, z));
      }
      if (g.type === 'bossComposite') {
        const bz = this.zoneById(g.blueZone), rz = this.zoneById(g.redZone), tz = this.zoneById(g.triangleZone);
        const blue = this.matching('BLUE'), red = this.matching('RED'), triangles = this.matching('TRIANGLE');
        return blue.length && red.length && triangles.length && blue.every(o => this.inZone(o, bz)) && red.every(o => !this.inZone(o, rz)) && triangles.every(o => this.inZone(o, tz));
      }
      return false;
    }

    evaluateGoal(dt) {
      const ok = this.goalCondition();
      if (ok) this.goalHold += dt; else this.goalHold = 0;
      const need = this.level.goal.hold || 0.4;
      if (!this.completed && this.goalHold >= need) {
        this.completed = true;
        this.running = false;
        if (this.hooks.onComplete) this.hooks.onComplete(this.time);
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#0d0f10';
      ctx.fillRect(0, 0, this.width, this.height);
      this.drawGrid(ctx);
      for (const z of this.zones) this.drawZone(ctx, z);
      this.drawTrails(ctx);
      for (const o of this.objects) if (o.alive) this.drawObject(ctx, o);
      if (this.metaPulse > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(217,255,112,${this.metaPulse * .45})`;
        ctx.lineWidth = 2;
        const inset = 8 + (1 - this.metaPulse) * 18;
        ctx.strokeRect(inset, inset, this.width - inset * 2, this.height - inset * 2);
        ctx.restore();
      }
    }

    drawGrid(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.026)';
      ctx.lineWidth = 1;
      for (let x = 40; x < this.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
      for (let y = 40; y < this.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.055)';
      ctx.strokeRect(28.5, 28.5, this.width - 57, this.height - 57);
      ctx.restore();
    }

    drawZone(ctx, z) {
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = 'rgba(217,255,112,.30)';
      ctx.fillStyle = 'rgba(217,255,112,.027)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (z.ring && z.inner) {
        ctx.beginPath(); ctx.arc(0, 0, z.inner, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(217,255,112,.50)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(z.label || z.id, 0, -z.radius - 10);
      ctx.restore();
    }

    drawTrails(ctx) {
      ctx.save();
      ctx.lineWidth = 1;
      for (const o of this.objects) {
        const tr = this.trails.get(o.id);
        if (!o.alive || !tr || tr.length < 2) continue;
        ctx.strokeStyle = `${labelColor(o.color)}33`;
        ctx.beginPath();
        tr.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.stroke();
      }
      ctx.restore();
    }

    drawObject(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      const color = labelColor(o.color);
      ctx.shadowColor = `${color}55`;
      ctx.shadowBlur = o.immovable ? 0 : 13;
      ctx.fillStyle = o.immovable ? '#20252a' : color;
      ctx.strokeStyle = o.immovable ? '#8c949b' : 'rgba(255,255,255,.72)';
      ctx.lineWidth = o.immovable ? 1 : 1.2;
      ctx.beginPath();
      if (o.shape === 'circle') {
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
      } else if (o.shape === 'triangle') {
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
          const x = Math.cos(a) * o.r * 1.13, y = Math.sin(a) * o.r * 1.13;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.rect(-o.r, -o.r, o.r * 2, o.r * 2);
      }
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      if (o.immovable) {
        ctx.strokeStyle = 'rgba(255,255,255,.32)';
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
      } else {
        const sp = len(o.vx, o.vy);
        if (sp > 4) {
          const nx = o.vx / sp, ny = o.vy / sp;
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.beginPath(); ctx.moveTo(-nx * (o.r + 4), -ny * (o.r + 4)); ctx.lineTo(-nx * (o.r + 13), -ny * (o.r + 13)); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  window.AXIOM = window.AXIOM || {};
  window.AXIOM.Engine = Engine;
  window.AXIOM.selectorMatches = selectorMatches;
})();
