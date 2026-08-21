(function () {
  if (window.__azlogPlayer) { window.__azlogPlayer.rebind(); return; }

  var TRACKS = [
    { file: 'blitz-kids-lost-generation.ogg', cover: 'blitz-kids-lost-generation.jpg', title: 'The Sound of a Lost Generation', artist: 'Blitz Kids', desc: '声音开大之后，好像什么都无所谓了。', len: '4:01' },
    { file: 'duster-me-and-the-birds.ogg', cover: 'duster-me-and-the-birds.jpg', title: 'Me And The Birds', artist: 'Duster', desc: '很慢，很轻，像凌晨没关的那盏灯。', len: '1:35' },
    { file: 'hers-harvey.ogg', cover: 'hers-harvey.jpg', title: 'Harvey', artist: "Her's", desc: '贝斯线一响，天就暗下来了（好的那种暗）。', len: '3:31' },
    { file: 'wallows-bad-dream.ogg', cover: 'wallows-bad-dream.jpg', title: 'Bad Dream', artist: 'Wallows', desc: '适合戴着耳机走夜路的一首。', len: '3:30' }
  ];
  var DEFAULT_IDX = 2;
  var BASE = new URL('assets/music/', new URL(rootOf() || '.', location.href)).href;
  var PKEY = 'azlog-player';
  var TKEY = 'azlog-track';
  var HB = 'azlog-heartbeat';

  function rootOf() {
    var s = document.querySelector('script[data-root]');
    return s ? s.getAttribute('data-root') : '';
  }
  function load(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var st = load(PKEY, null);
  var idx = st && TRACKS[st.i] ? st.i : DEFAULT_IDX;
  var wantPlay = st ? !!st.playing : true;
  var resumeAt = st && typeof st.t === 'number' ? st.t : 0;

  var solo = true;
  try {
    var hb = parseFloat(localStorage.getItem(HB));
    solo = !(isFinite(hb) && Date.now() - hb < 2600);
  } catch (e) {}
  setInterval(function () {
    try { if (!audio.paused) localStorage.setItem(HB, String(Date.now())); } catch (e) {}
  }, 1000);

  var audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = st && typeof st.vol === 'number' ? st.vol : 0.8;

  function fmt(s) {
    if (!isFinite(s)) return '--:--';
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  var pendingAutoplay = false;
  function tryPlay() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { pendingAutoplay = true; refresh(); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (pendingAutoplay) { pendingAutoplay = false; tryPlay(); }
    }, { capture: true });
  });

  var lastPersist = 0;
  function persist() {
    save(PKEY, { i: idx, t: audio.currentTime || 0, vol: audio.volume, playing: wantPlay });
    var tr = TRACKS[idx];
    save(TKEY, { i: idx, title: tr.title, artist: tr.artist, playing: wantPlay && !audio.paused });
    document.dispatchEvent(new CustomEvent('azlog:track'));
  }
  window.addEventListener('pagehide', persist);
  function persistThrottled() {
    var now = Date.now();
    if (now - lastPersist > 1000) { lastPersist = now; persist(); }
  }

  var pendingSeek = 0;
  function randNext() {
    var n = idx;
    while (n === idx && TRACKS.length > 1) n = Math.floor(Math.random() * TRACKS.length);
    return n;
  }
  function loadTrack(i, autoplay, seekTo) {
    idx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    audio.src = BASE + TRACKS[idx].file;
    if (autoplay) wantPlay = true;
    pendingSeek = seekTo || 0;
    refresh();
    persist();
    if (autoplay) tryPlay();
  }
  function toggle() {
    if (audio.paused) { wantPlay = true; if (!audio.src) loadTrack(idx, true, 0); else tryPlay(); }
    else { wantPlay = false; audio.pause(); }
  }

  audio.addEventListener('loadedmetadata', function () {
    if (pendingSeek > 0.2 && pendingSeek < (audio.duration || 1e9) - 1) {
      try { audio.currentTime = pendingSeek; } catch (e) {}
    }
    pendingSeek = 0;
    refresh();
  });
  audio.addEventListener('play', function () { wantPlay = true; refresh(); persist(); });
  audio.addEventListener('pause', function () { refresh(); persist(); });
  audio.addEventListener('ended', function () { loadTrack(randNext(), true, 0); });
  audio.addEventListener('timeupdate', function () {
    if (full && audio.duration) {
      fe['pl-seek'].value = (audio.currentTime / audio.duration) * 1000;
      fe['pl-cur'].textContent = fmt(audio.currentTime);
    }
    if (dockFill && audio.duration) dockFill.style.width = (audio.currentTime / audio.duration * 100).toFixed(2) + '%';
    persistThrottled();
  });

  var full = null;
  var fe = {};
  function bindFull() {
    full = document.getElementById('player');
    fe = {};
    if (!full) return;
    ['pl-play', 'pl-prev', 'pl-next', 'pl-seek', 'pl-vol', 'pl-cur', 'pl-dur',
     'pl-cover', 'pl-title', 'pl-artist', 'pl-desc', 'pl-list'].forEach(function (id) {
      fe[id] = document.getElementById(id);
    });
    fe['pl-list'].innerHTML = '';
    TRACKS.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'pl-item';
      li.innerHTML =
        '<span class="pl-idx">' + (i + 1) + '</span>' +
        '<img src="' + BASE + t.cover + '" alt="" loading="lazy">' +
        '<span class="pl-name">' + t.title + '<br><span class="pl-artist">' + t.artist + '</span></span>' +
        '<span class="pl-eq"><i style="height:40%"></i><i style="height:90%"></i><i style="height:60%"></i></span>' +
        '<span class="pl-len">' + t.len + '</span>';
      li.addEventListener('click', function () {
        if (i === idx && audio.src) toggle();
        else loadTrack(i, true, 0);
      });
      fe['pl-list'].appendChild(li);
    });
    fe['pl-play'].onclick = toggle;
    fe['pl-prev'].onclick = function () { loadTrack(idx - 1, !audio.paused, 0); };
    fe['pl-next'].onclick = function () { loadTrack(idx + 1, !audio.paused, 0); };
    fe['pl-seek'].oninput = function () {
      if (audio.duration) audio.currentTime = (fe['pl-seek'].value / 1000) * audio.duration;
    };
    fe['pl-vol'].oninput = function () { audio.volume = fe['pl-vol'].value / 100; persist(); };
    fe['pl-vol'].value = Math.round(audio.volume * 100);
  }

  var dock, dockPlay, dockTitle, dockFill;
  function buildDock() {
    dock = document.createElement('div');
    dock.className = 'dock';
    dock.innerHTML =
      '<button class="d-play" aria-label="播放/暂停">▶</button>' +
      '<div class="d-info"><span class="d-title"></span><div class="d-bar"><i></i></div></div>' +
      '<button class="d-prev" aria-label="上一首">⏮</button>' +
      '<button class="d-next" aria-label="下一首">⏭</button>';
    dockPlay = dock.querySelector('.d-play');
    dockTitle = dock.querySelector('.d-title');
    dockFill = dock.querySelector('.d-bar i');
    dockPlay.addEventListener('click', toggle);
    dock.querySelector('.d-prev').addEventListener('click', function () { loadTrack(idx - 1, !audio.paused, 0); });
    dock.querySelector('.d-next').addEventListener('click', function () { loadTrack(idx + 1, !audio.paused, 0); });
    document.body.appendChild(dock);
  }
  buildDock();

  function refresh() {
    var t = TRACKS[idx];
    dockTitle.textContent = t.title + ' — ' + t.artist;
    dockPlay.textContent = audio.paused ? '▶' : '❚❚';
    dock.classList.toggle('playing', !audio.paused);
    if (full) {
      fe['pl-cover'].src = BASE + t.cover;
      fe['pl-cover'].alt = t.title;
      fe['pl-title'].textContent = t.title;
      fe['pl-artist'].textContent = t.artist;
      fe['pl-desc'].textContent = t.desc;
      fe['pl-dur'].textContent = audio.duration ? fmt(audio.duration) : t.len;
      fe['pl-cur'].textContent = fmt(audio.currentTime);
      [].forEach.call(fe['pl-list'].children, function (li, n) {
        li.classList.toggle('playing', n === idx);
      });
      if (audio.paused) { fe['pl-play'].textContent = '▶'; full.classList.remove('playing'); }
      else { fe['pl-play'].textContent = '❚❚'; full.classList.add('playing'); }
    }
  }

  window.__azlogPlayer = { rebind: function () { bindFull(); refresh(); }, audio: audio };
  document.addEventListener('azlog:navigate', function () { bindFull(); refresh(); });

  bindFull();
  loadTrack(idx, false, resumeAt);
  refresh();
  if (wantPlay && solo) {
    if (audio.readyState >= 1) tryPlay();
    else audio.addEventListener('canplay', function () { if (wantPlay) tryPlay(); }, { once: true });
  }
})();
