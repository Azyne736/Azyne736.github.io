(function () {
  var QUOTES = [
    '有些歌只适合在灯关掉以后听。',
    '凌晨的风把城市吹得很远。',
    '雨停了，窗户还记得它来过。',
    '有些消息写完以后，停在输入框里更合适。',
    '今天的天空像一张快要认不出来的旧照片。',
    '夜很长，耳机里至少还有下一首。',
    '偶尔只是想把自己从所有声音里调低一点。',
    'some things fade better in silence.',
    '明天总会来，只是凌晨的时候看起来很远。',
    '如果没有回音，就当作写给夜晚。',
    '不是每一次安静都需要解释。',
    '……'
  ];
  var SUB = '有些夜晚没有结尾，只是慢慢变亮。';
  var DUST = ['·', '˙', '∙', '·'];

  function pick(arr, not) {
    var pool = arr.filter(function (x) { return x !== not; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  if (!window.__azlogSpa) {
    window.__azlogSpa = true;

    var ROOT_URL = (function () {
      var s = document.querySelector('script[data-root]');
      var r = s ? s.getAttribute('data-root') : '';
      return new URL(r || '.', location.href);
    })();

    function rootOf() {
      var s = document.querySelector('script[data-root]');
      return s ? s.getAttribute('data-root') : '';
    }
    function isInternal(a) {
      if (a.target && a.target !== '_self') return false;
      if (a.protocol !== location.protocol || a.host !== location.host) return false;
      return /\.(html?|)$/i.test(a.pathname);
    }

    var pagesPromise = null;
    function ensurePages() {
      if (window.__azlogPages) return Promise.resolve();
      if (!pagesPromise) {
        pagesPromise = new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = new URL('assets/pages.js', ROOT_URL).href;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      return pagesPromise;
    }

    function relKey(href) {
      var u = new URL(href, location.href);
      var p = u.pathname;
      var base = ROOT_URL.pathname;
      var nb = base.replace(/\/+$/, '');
      if (base !== '/' && p.startsWith(base)) p = p.slice(base.length);
      else if (nb && (p === nb || p.startsWith(nb + '/'))) p = (p === nb ? '/index.html' : p.slice(nb.length));
      return p.replace(/^\/+/, '').replace(/\/+$/, '') || 'index.html';
    }

    function keyFromLink(a) {
      var href = a.getAttribute('href');
      var r = rootOf();
      if (r === '../') return href.indexOf('../') === 0 ? href.slice(3) : 'posts/' + href;
      return href;
    }

    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target.closest ? ev.target.closest('a') : null;
      if (!a || !isInternal(a)) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.startsWith('javascript:')) return;
      ev.preventDefault();
      navigate(keyFromLink(a), true);
    });

    window.addEventListener('popstate', function () {
      navigate(relKey(location.href), false);
    });

    function navigate(key, push) {
      ensurePages().then(function () {
        var html = window.__azlogPages[key];
        if (!html) { location.href = new URL(key, ROOT_URL).href; return; }
        swap(html, key, push);
        window.scrollTo(0, 0);
        injectMain();
      }).catch(function () { location.href = new URL(key, ROOT_URL).href; });
    }

    function swap(html, key, push) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var targetURL = new URL(key, ROOT_URL);

      /*
       * pages.js stores each page exactly as it exists on disk, so post pages
       * legitimately contain ../assets/... paths.  During an SPA swap the
       * browser may resolve those paths before pushState changes the address
       * bar (and file:// cannot pushState at all).  Freeze media URLs against
       * the page they belong to before inserting the nodes.
       */
      [].forEach.call(doc.body.querySelectorAll('[src]'), function (el) {
        var raw = el.getAttribute('src');
        if (!raw || /^(?:[a-z]+:|\/\/|data:|blob:|#)/i.test(raw)) return;
        try { el.setAttribute('src', new URL(raw, targetURL).href); } catch (e) {}
      });

      var dock = document.querySelector('.dock');
      if (dock) document.documentElement.appendChild(dock);
      document.title = doc.title;
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
      var nodes = [].slice.call(doc.body.childNodes);
      for (var i = 0; i < nodes.length; i++) document.body.appendChild(nodes[i]);
      if (dock) document.body.appendChild(dock);
      if (push) {
        try { history.pushState({}, '', new URL(key, ROOT_URL).href); }
        catch (e) { /* file:// 禁止 pushState：跳过，仅本次会话地址栏不更新 */ }
      }
    }

    function injectMain() {
      var r = rootOf();
      [].forEach.call(document.querySelectorAll('body script[src*="main.js"], body script[src*="player.js"]'), function (s) {
        s.parentNode.removeChild(s);
      });
      var s = document.createElement('script');
      s.src = r + 'assets/main.js';
      s.setAttribute('data-root', r);
      s.onload = function () {
        document.dispatchEvent(new CustomEvent('azlog:navigate'));
      };
      document.body.appendChild(s);
    }
  }

  (window.__azlogTimers = window.__azlogTimers || []).forEach(clearInterval);
  window.__azlogTimers = [];
  var token = (window.__azlogToken = (window.__azlogToken || 0) + 1);

  var typed = document.getElementById('typed');
  if (typed) {
    var i = 0;
    (function type() {
      if (token !== window.__azlogToken) return;
      if (i <= SUB.length) {
        typed.textContent = SUB.slice(0, i);
        i++;
        setTimeout(type, 95);
      } else {
        setTimeout(function () {
          if (token !== window.__azlogToken) return;
          typed.textContent = '';
          i = 0;
          type();
        }, 7000);
      }
    })();
  }

  var quoteEl = document.getElementById('quote');
  if (quoteEl) {
    quoteEl.textContent = pick(QUOTES);
    var reroll = document.getElementById('reroll');
    if (reroll) {
      reroll.addEventListener('click', function () {
        quoteEl.classList.add('out');
        setTimeout(function () {
          quoteEl.textContent = pick(QUOTES, quoteEl.textContent);
          quoteEl.classList.remove('out');
        }, 350);
      });
    }
  }

  var np = document.getElementById('np');
  if (np) {
    function refreshNp() {
      var cur = null;
      try {
        var t = JSON.parse(localStorage.getItem('azlog-track'));
        if (t && t.title) cur = t;
      } catch (e) {}
      np.textContent = '正在播放：' + (cur
        ? (cur.playing === false ? '暂停中：' : '') + cur.title + ' — ' + cur.artist
        : '不知道，随机到什么听什么');
    }
    refreshNp();
    document.addEventListener('azlog:track', refreshNp);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    /* Older/in-app browsers: never leave article cards permanently invisible. */
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  var floaters = document.querySelector('.floaters');
  function spawnDust() {
    if (token !== window.__azlogToken || !floaters || !floaters.isConnected) return;
    var n = document.createElement('span');
    n.className = 'note';
    n.textContent = DUST[Math.floor(Math.random() * DUST.length)];
    n.style.left = (Math.random() * 96 + 2) + 'vw';
    n.style.fontSize = (8 + Math.random() * 10) + 'px';
    n.style.animationDuration = (14 + Math.random() * 12) + 's';
    floaters.appendChild(n);
    setTimeout(function () { n.remove(); }, 27000);
  }
  for (var d = 0; d < 6; d++) setTimeout(spawnDust, d * 1800);
  window.__azlogTimers.push(setInterval(spawnDust, 3400));

  if (!window.__azlogPop) {
    window.__azlogPop = true;
    document.addEventListener('click', function (ev) {
      var p = document.createElement('span');
      p.className = 'pop';
      p.style.left = (ev.clientX - 2) + 'px';
      p.style.top = (ev.clientY - 2) + 'px';
      document.body.appendChild(p);
      setTimeout(function () { p.remove(); }, 1500);
    });
  }

  var gbForm = document.getElementById('gb-form');
  if (gbForm) {
    var KEY = 'azlog-guestbook';
    var list = document.getElementById('gb-list');
    var nameInput = document.getElementById('gb-name');
    var msgInput = document.getElementById('gb-msg');

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; }
      catch (e) { return []; }
    }
    function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function render() {
      var items = load();
      if (!items.length) {
        list.innerHTML = '<p class="gb-hint" style="text-align:center">还没有留言——这里安静得像凌晨三点的房间。</p>';
        return;
      }
      list.innerHTML = '';
      items.slice().reverse().forEach(function (it, idx) {
        var num = items.length - idx;
        var realIdx = items.length - num;
        var el = document.createElement('div');
        el.className = 'gb-item';
        el.innerHTML =
          '<div class="meta"><span>#' + num + ' · ' + esc(it.name) + ' · ' + esc(it.time) + '</span>' +
          '<button class="del">删除</button></div>' +
          '<p>' + esc(it.msg) + '</p>';
        el.querySelector('.del').addEventListener('click', function () {
          var arr = load();
          arr.splice(realIdx, 1);
          save(arr);
          render();
        });
        list.appendChild(el);
      });
    }
    gbForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = nameInput.value.trim() || '路过的猫';
      var msg = msgInput.value.trim();
      if (!msg) { msgInput.focus(); return; }
      var items = load();
      items.push({ name: name, msg: msg, time: new Date().toLocaleDateString('zh-CN') });
      save(items);
      msgInput.value = '';
      render();
    });
    render();
  }


  /* residual fragments / marginalia */
  (function installResidualFragments(){
    var FRAGMENTS = [
      '01:47 was written twice. only one of them was a time.',
      '03/00 // the archive refused this date.',
      '19 entries visible. something remembers being twentieth.',
      'fragment 05 // there is no fragment 05.',
      'the third line changes when nobody is looking. probably.',
      '/memo/00 was never saved, but the index still checks for it.',
      '00:61 is not a valid time. it appears anyway.',
      'do not count the dots. the number is different each time.',
      'one page has a shadow but no address.',
      'cache restored 0 of ? missing characters.',
      'the rain layer is decorative. probably.',
      'nothing is hidden behind the image.',
      'there is no key. there was never a lock.',
      'this fragment contradicts another fragment you may not have seen.',
      'if you found this, you found nothing.'
    ];
    var PAGE_NOTES = {
      'az.log | Azyne\'s little corner':'INDEX // 19 visible / 20 remembered',
      'About · az.log':'PROFILE // three fields were never written',
      'Now · az.log':'NOW // last update: --:--',
      'Archive · az.log':'ARCHIVE // checksum mismatch',
      'Music · az.log':'TRACK 00 // duration --:--',
      'Cats · az.log':'OBSERVATION 03 // not saved',
      'Memo · az.log':'MEMO 00 // empty',
      'Links · az.log':'OUTBOUND // no response',
      'Guestbook · az.log':'GUEST 0 // left before arrival',
      '404 · az.log':'404 // this is not the missing page'
    };

    function pickFragment(){ return FRAGMENTS[Math.floor(Math.random()*FRAGMENTS.length)]; }
    function unstableChecksum(){
      var chars='0123456789abcdef';
      function part(n){var s='';while(n--)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
      return part(2)+'-'+part(2)+'-?'+part(1)+'-'+part(2);
    }
    function toast(msg){
      var old=document.querySelector('.false-toast'); if(old) old.remove();
      var el=document.createElement('div'); el.className='false-toast'; el.textContent=msg;
      document.body.appendChild(el); requestAnimationFrame(function(){el.classList.add('on')});
      setTimeout(function(){el.classList.remove('on');setTimeout(function(){el.remove()},320)},2400);
    }
    function ensureVeil(){
      var veil=document.querySelector('.fragment-veil'); if(veil) return veil;
      veil=document.createElement('div'); veil.className='fragment-veil'; veil.setAttribute('aria-hidden','true');
      veil.innerHTML='<section class="fragment-box" role="dialog" aria-modal="true" aria-label="fragment">'+
        '<button class="fragment-close" aria-label="close">×</button>'+
        '<div class="fragment-kicker">residual fragment // 0?</div>'+
        '<div class="fragment-text"></div>'+
        '<div class="fragment-meta"></div></section>';
      document.body.appendChild(veil);
      function close(){veil.classList.remove('open');veil.setAttribute('aria-hidden','true')}
      veil.addEventListener('click',function(e){if(e.target===veil)close()});
      veil.querySelector('.fragment-close').addEventListener('click',close);
      return veil;
    }
    function openFragment(preferred){
      var veil=ensureVeil();
      veil.querySelector('.fragment-text').textContent=preferred||pickFragment();
      veil.querySelector('.fragment-meta').textContent='checksum '+unstableChecksum()+' // index unresolved // progress: ?';
      veil.classList.add('open');veil.setAttribute('aria-hidden','false');
    }

    var firstCard=document.querySelector('.main .card');
    if(firstCard && !firstCard.querySelector('.cipher-mark')){
      var mark=document.createElement('button'); mark.className='cipher-mark'; mark.type='button'; mark.textContent='⌁';
      mark.title=''; mark.setAttribute('aria-label','unindexed fragment');
      mark.addEventListener('click',function(){openFragment(PAGE_NOTES[document.title]||pickFragment())});
      firstCard.appendChild(mark);
    }

    var dot=document.querySelector('.site-title .dot');
    if(dot){
      dot.style.cursor='help'; dot.setAttribute('title','');
      dot.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openFragment()});
    }

    if(!document.querySelector('.signal-tab')){
      var sig=document.createElement('button');sig.className='signal-tab';sig.type='button';sig.textContent='⌁';
      sig.setAttribute('aria-label','weak signal');sig.addEventListener('click',function(){openFragment()});
      document.body.appendChild(sig);
    }

    var foot=document.querySelector('.site-foot');
    if(foot && !foot.querySelector('.checksum-line')){
      var c=document.createElement('p');c.className='checksum-line';
      c.innerHTML='cache // <span class="flick">'+unstableChecksum()+'</span> // fragment index: ? / ?';
      foot.appendChild(c);
    }

    if(document.title==='Archive · az.log'){
      var feb=[].slice.call(document.querySelectorAll('.archive-month')).find(function(x){return /^February\b/.test(x.textContent.trim())});
      if(feb){
        var list=feb.nextElementSibling;
        if(list && list.classList.contains('archive-list') && !list.querySelector('.ghost-entry')){
          var li=document.createElement('li');li.className='ghost-entry';
          li.innerHTML='<a href="#" class="ghost-link">[ untitled fragment ]</a><span class="d">03/00</span>';
          li.querySelector('a').addEventListener('click',function(e){e.preventDefault();openFragment('03/00 // entry present in index, absent from storage.')});
          list.insertBefore(li,list.firstChild);
        }
      }
    }

    if(document.title==='About · az.log'){
      var card=document.querySelector('.main .card');
      if(card && !card.querySelector('.redacted-note')){
        var r=document.createElement('p');r.className='redacted-note';
        r.innerHTML='cache field 04: <span class="redacted">████████████</span> / source unavailable';
        r.querySelector('.redacted').addEventListener('click',function(){toast('field 04 // empty after reconstruction')});
        card.appendChild(r);
      }
    }

    if(document.title==='404 · az.log'){
      var m=document.querySelector('.main .card');
      if(m && !m.querySelector('.anomaly-note')){
        var a=document.createElement('div');a.className='anomaly-note';
        a.textContent='reference found: /fragment/00 · address not present in this build · do not retry';
        m.appendChild(a);
      }
    }

    if(document.title==='Memo · az.log'){
      var mm=document.querySelector('.main .card');
      if(mm && !mm.querySelector('.anomaly-note')){
        var n=document.createElement('div');n.className='anomaly-note';
        n.textContent='memo #00 // 00:61 // [content was already empty]';
        n.addEventListener('click',function(){toast('memo #00 cannot be restored because it was never written')});
        mm.appendChild(n);
      }
    }

    /* A deliberately useless console trail for anyone who opens devtools. */
    try{
      console.log('%c[az.log] residual index','color:#667788','19 visible / 20 remembered');
      console.log('%c[fragment 05]','color:#566674','there is no fragment 05.');
      console.log('%c[checksum]','color:#485866',unstableChecksum(),'// mismatch');
    }catch(e){}
  })();

})();
