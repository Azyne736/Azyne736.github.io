import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "站点信息.md"
text = SRC.read_text(encoding="utf-8")

SITE = "azlog.living"
BROWSER_TITLE = "az.log | Azyne's little corner"
STATUS = "status: awake, somewhere after midnight"

NAV = [
    ("☁", "首页", "index.html"),
    ("📖", "About", "about.html"),
    ("🌙", "Now", "now.html"),
    ("🗂", "Archive", "archive.html"),
    ("🎧", "Music", "music.html"),
    ("🐈", "Cats", "cats.html"),
    ("✏", "Memo", "memo.html"),
    ("🔗", "Links", "links.html"),
    ("✉", "留言板", "guestbook.html"),
]

TAGS = ["#碎碎念", "#音乐", "#猫", "#天空", "#日常", "#半夜不睡觉", "#暑假", "#上学好累", "#没有营养"]

SLUGS = {
    "2025-10-03": "test-post",
    "2025-10-17": "first-post",
    "2025-11-02": "about-waking-up",
    "2025-11-16": "recently",
    "2025-12-06": "winter-is-coming",
    "2025-12-24": "christmas-playlist",
    "2026-01-01": "new-year-2026",
    "2026-02-14": "not-valentines",
    "2026-03-21": "cat-diary-01",
    "2026-04-12": "rainy-day",
    "2026-05-18": "headphones-save-the-world",
    "2026-06-07": "small-things",
    "2026-06-28": "finally-over",
    "2026-07-09": "cat-diary-02",
    "2026-07-24": "summer-night-walk",
    "2026-08-03": "on-repeat",
    "2026-08-09": "at-0147",
    "2026-08-15": "todays-clouds",
    "2026-08-20": "school-approaching",
}

POST_TAGS = {
    "2025-10-03": ["#碎碎念", "#没有营养"],
    "2025-10-17": ["#碎碎念", "#日常"],
    "2025-11-02": ["#日常", "#上学好累"],
    "2025-11-16": ["#日常", "#天空"],
    "2025-12-06": ["#日常", "#音乐"],
    "2025-12-24": ["#音乐"],
    "2026-01-01": ["#碎碎念"],
    "2026-02-14": ["#日常", "#碎碎念"],
    "2026-03-21": ["#猫"],
    "2026-04-12": ["#日常", "#音乐"],
    "2026-05-18": ["#音乐", "#日常"],
    "2026-06-07": ["#碎碎念", "#没有营养"],
    "2026-06-28": ["#暑假"],
    "2026-07-09": ["#猫"],
    "2026-07-24": ["#日常", "#音乐"],
    "2026-08-03": ["#音乐"],
    "2026-08-09": ["#音乐", "#半夜不睡觉"],
    "2026-08-15": ["#天空"],
    "2026-08-20": ["#上学好累", "#暑假"],
}

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def section(start, end):
    i = text.index(start)
    j = text.index(end)
    return text[i:j]


def parse_posts():
    raw = section("# 六、博客正文", "# 七、音乐页面")
    blocks = []
    cur = []
    for line in raw.splitlines():
        if line.strip() == "---":
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(line)
    if cur:
        blocks.append(cur)
    posts = []
    for b in blocks:
        date = title = None
        body = []
        for line in b:
            if line.startswith("## ") and re.match(r"## \d{4}-\d{2}-\d{2}", line):
                date = line[3:].strip()
            elif line.startswith("### "):
                title = line[4:].strip()
            else:
                body.append(line)
        if not date or not title:
            continue
        posts.append({"date": date, "title": title, "body": body})
    posts.sort(key=lambda p: p["date"])
    return posts


def render_body(lines):
    out = []
    for line in lines:
        t = line.strip()
        if not t:
            continue
        if re.fullmatch(r"\*\*.+\*\*", t):
            out.append('<p class="em">' + inline(t) + "</p>")
        elif "█" in t and re.fullmatch(r"[\s█%0-9a-zA-Z]*", t):
            out.append('<p><span class="meter">' + esc(t) + "</span></p>")
        else:
            out.append("<p>" + inline(t) + "</p>")
    return "\n      ".join(out)


def tags_html(tags, root):
    links = "".join(
        '<li><a href="{r}archive.html">{t}</a></li>'.format(r=root, t=esc(t)) for t in tags
    )
    return '<ul class="tags">' + links + "</ul>"


def sidebar(root):
    tag_lis = "".join(
        '<li><a href="{r}archive.html">{t}</a></li>'.format(r=root, t=t) for t in TAGS
    )
    return """<aside class="side">
      <div class="card profile reveal">
        <img class="avatar" src="{r}assets/avatar.jpg" alt="Azyne 的头像">
        <h3>Azyne</h3>
        <p class="aka">az / 白穗 · 深圳</p>
        <p class="bio">在深夜、耳机与雨之间，偶尔留下几句话。</p>
        <p class="sig">“Only your kiss could stop the loneliness from sinking in.”</p>
      </div>
      <div class="card reveal">
        <h4>· fragments</h4>
        <p id="quote"></p>
        <button class="btn" id="reroll">换一句</button>
      </div>
      <div class="card reveal">
        <h4>♫ now playing</h4>
        <div class="eq"><i></i><i></i><i></i><i></i><i></i></div>
        <p id="np"></p>
      </div>
      <div class="card reveal">
        <h4># fragments</h4>
        <ul class="tags">{tags}</ul>
      </div>
    </aside>""".format(r=root, tags=tag_lis)


def nav_html(active, root):
    items = []
    for ico, label, fname in NAV:
        cls = ' class="on"' if fname == active else ""
        items.append(
            '<a{cls} href="{r}{f}"><span class="ico">{i}</span>{l}</a>'.format(
                cls=cls, r=root, f=fname, i=ico, l=label
            )
        )
    return '<nav class="nav">' + "".join(items) + "</nav>"


def layout(active, title, main_html, root=""):
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="icon" href="{r}assets/avatar.jpg">
<link rel="stylesheet" href="{r}assets/style.css">
<noscript><style>.reveal{{opacity:1;transform:none}}</style></noscript>
</head>
<body>
<div class="sky" aria-hidden="true">
  <div class="fog f1"></div><div class="fog f2"></div><div class="fog f3"></div>
  <div class="star s1"></div><div class="star s2"></div><div class="star s3"></div><div class="star s4"></div>
</div>
<div class="rain" aria-hidden="true"></div>
<div class="loadbar" aria-hidden="true"><i></i></div>
<div class="wrap">
  <header class="site-head">
    <a class="site-title" href="{r}index.html">azlog<span class="dot">.</span>living</a>
    <p class="site-sub"><span id="typed"></span><span class="caret">▌</span></p>
    <p class="site-status"><span class="status-dot"></span>{status}</p>
    {nav}
  </header>
  <div class="cols">
    <main class="main">
{main}
    </main>
{side}
  </div>
  <footer class="site-foot">
    <div class="foot-paws" aria-hidden="true"><span>🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾🐾</span></div>
    <p class="codespan"><code>© 2025–2026 Azyne</code></p>
    <p class="codespan"><code>written somewhere between rain, static and sleepless nights.</code></p>
    <p><strong>本站没有什么重要内容。</strong>所以请放心地浪费时间。</p>
  </footer>
</div>
<div class="floaters" aria-hidden="true"></div>
<script src="{r}assets/player.js" data-root="{r}"></script>
<script src="{r}assets/main.js"></script>
</body>
</html>""".format(
        title=esc(title), r=root, status=esc(STATUS), nav=nav_html(active, root), main=main_html, side=sidebar(root)
    )


def postlist_html(posts, root):
    lis = "".join(
        '<li><a href="{r}posts/{slug}.html">{t}</a><span class="d">{d}</span></li>'.format(
            r=root, slug=SLUGS[p["date"]], t=esc(p["title"]), d=p["date"]
        )
        for p in posts
    )
    return '<ul class="postlist">' + lis + "</ul>"


def page_index(posts, root=""):
    recent = list(reversed(posts))[:5]
    main = """<div class="card taped reveal">
      <h2>welcome！</h2>
      <p>你好呀——这里是 Azyne 的小破站。</p>
      <p>大概会放一些：</p>
      <ul class="welcome-list">
        <li>听歌时候突然冒出来的想法</li>
        <li>随手拍到的天空</li>
        <li>猫猫</li>
        <li>半夜不睡觉产生的废话</li>
        <li>偶尔一点学习牢骚</li>
        <li>以及完全没有意义的东西 www</li>
      </ul>
      <p>更新频率非常随机。可能一天三篇，也可能半个月装死。</p>
      <p>所以如果这里长草了……</p>
      <p class="em"><strong>不是失踪，只是懒。</strong></p>
      <div class="sleepbox">
        <p class="zzz">(¦3[▓▓] <span class="z">z</span><span class="z z2">z</span><span class="z z3">z</span></p>
      </div>
    </div>
    <div class="card reveal">
      <h2>最近写了什么</h2>
      {postlist}
      <a class="morelink" href="{r}archive.html">→ 全部文章在归档页</a>
    </div>""".format(postlist=postlist_html(recent, root), r=root)
    return layout("index.html", BROWSER_TITLE, main, root)


def page_about(root=""):
    main = """<div class="card taped reveal">
      <h2>About me</h2>
      <dl class="profile-dl">
        <dt>Name</dt><dd>Azyne</dd>
        <dt>Location</dt><dd>Shenzhen</dd>
        <dt>MBTI</dt><dd>不知道，而且感觉每次测都不一样（）</dd>
        <dt>喜欢的颜色</dt><dd>淡蓝、白色</dd>
        <dt>喜欢的季节</dt><dd>秋天</dd>
        <dt>喜欢的动物</dt><dd><strong>猫！！！！</strong></dd>
        <dt>饮料</dt><dd>果茶 &gt; 奶茶</dd>
        <dt>喜欢</dt><dd>耳机、夜晚、天空、下雨但不用出门的时候</dd>
        <dt>讨厌</dt><dd>很苦的东西、早起、闹钟</dd>
        <dt>游戏</dt><dd>偶尔玩，不算很认真</dd>
        <dt>音乐</dt><dd>英文歌比较多，听到什么好听的就存什么</dd>
        <dt>社交</dt><dd>网上话很多，现实里可能直接进入省电模式</dd>
      </dl>
      <h3>有时候会用：</h3>
      <div class="chips">
        <span class="chip">www</span><span class="chip">qwq</span><span class="chip">（？）</span>
        <span class="chip">草</span><span class="chip">救命</span><span class="chip">喵</span>
      </div>
      <p>这不是系统故障。</p>
    </div>
    <div class="card reveal">
      <h2>为什么叫 Azyne</h2>
      <p>没有特别伟大的原因。</p>
      <p>一开始只是觉得这几个字母排起来很好看。</p>
      <p>然后用了很久之后就懒得换了。</p>
      <p>所以如果一定要问含义：</p>
      <p class="em"><strong>没有含义就是最大的含义（？）</strong></p>
    </div>"""
    return layout("about.html", "About · az.log", main, root)


def page_now(root=""):
    main = """<div class="card taped reveal">
      <h2>/now</h2>
      <p>最近：</p>
      <ul class="now-list">
        <li><span class="ico">🎧</span>在疯狂听歌</li>
        <li><span class="ico">🌙</span>睡眠时间一塌糊涂</li>
        <li><span class="ico">📚</span>已经开始感受到开学的压迫感</li>
        <li><span class="ico">🐈</span>看到猫还是会停下来</li>
        <li><span class="ico">🥤</span>最近比较想喝柠檬茶</li>
        <li><span class="ico">☁️</span>相册里天空照片越来越多</li>
      </ul>
      <div class="statusbox">
        <p><strong>目前状态：</strong></p>
        <p><code>暑假余额不足.jpg</code></p>
      </div>
    </div>"""
    return layout("now.html", "Now · az.log", main, root)


def page_archive(posts, root=""):
    by_year = {}
    for p in reversed(posts):
        y, m, _ = p["date"].split("-")
        by_year.setdefault(y, []).append((int(m), p))
    years_html = []
    for y in sorted(by_year, reverse=True):
        items = by_year[y]
        n = len(items)
        months = []
        cur_m = None
        lis = []
        for m, p in items:
            if m != cur_m:
                if cur_m is not None:
                    months.append('<p class="archive-month">{} <span class="mnote">/ {:02d}</span></p><ul class="archive-list">{}</ul>'.format(MONTHS[cur_m - 1], cur_m, "".join(lis)))
                cur_m = m
                lis = []
            lis.append(
                '<li><a href="{r}posts/{slug}.html">{t}</a><span class="d">{d}</span></li>'.format(
                    r=root, slug=SLUGS[p["date"]], t=esc(p["title"]), d=p["date"][5:].replace("-", "/")
                )
            )
        months.append('<p class="archive-month">{} <span class="mnote">/ {:02d}</span></p><ul class="archive-list">{}</ul>'.format(MONTHS[cur_m - 1], cur_m, "".join(lis)))
        years_html.append(
            '<div class="card reveal"><p class="archive-year">{} <span style="font-size:.7rem;color:var(--muted)">{} 篇</span></p>{}</div>'.format(y, n, "".join(months))
        )
    main = """<div class="card taped reveal">
      <h2>Archive</h2>
      <p>从第一次 test post 到现在。</p>
      <p style="color:var(--muted);font-size:.88rem">一共 {} 篇 —— 想到什么写什么。</p>
    </div>{}""".format(len(posts), "\n".join(years_html))
    return layout("archive.html", "Archive · az.log", main, root)


def page_music(root=""):
    main = """<div class="card taped reveal">
      <h2>Music</h2>
      <p>一些最近喜欢的歌。</p>
      <p>不是排行榜。想到什么放什么。这次是真的能放出来——</p>
      <div id="player">
        <div class="p-coverwrap"><img class="p-cover" id="pl-cover" src="{r}assets/music/blitz-kids-lost-generation.jpg" alt=""></div>
        <div class="p-info">
          <p class="p-title" id="pl-title"></p>
          <p class="p-artist" id="pl-artist"></p>
          <p class="p-desc" id="pl-desc"></p>
          <div class="p-seekrow">
            <span class="p-time" id="pl-cur">0:00</span>
            <input type="range" id="pl-seek" min="0" max="1000" value="0" aria-label="进度">
            <span class="p-time" id="pl-dur">--:--</span>
          </div>
          <div class="p-volrow">
            <span>vol</span>
            <input type="range" id="pl-vol" min="0" max="100" value="80" aria-label="音量">
          </div>
        </div>
        <div class="p-controls">
          <button id="pl-prev" aria-label="上一首">⏮</button>
          <button class="p-play" id="pl-play" aria-label="播放/暂停">▶</button>
          <button id="pl-next" aria-label="下一首">⏭</button>
        </div>
      </div>
      <h3>playlist</h3>
      <ul id="pl-list"></ul>
      <p class="gb-hint" style="margin-top:10px">※ 歌都在仓库里，页面刷新不会断……好吧会断。静态站的宿命。</p>
    </div>
    <div class="card reveal">
      <h2>关于分类</h2>
      <p>其他歌会随机增加。</p>
      <p>因为我的音乐品味没有分类系统。</p>
      <p>只有两个分类：</p>
      <div class="chips"><span class="chip"><strong>好听</strong></span><span class="chip">还没听过。</span></div>
    </div>""".format(r=root)
    return layout("music.html", "Music · az.log", main, root)


def page_cats(root=""):
    main = """<div class="card taped reveal">
      <h2>Cats</h2>
      <p>为什么博客要专门放一个猫猫页面？</p>
      <p>因为：猫。</p>
      <p>不需要理由。</p>
      <h3>猫猫等级制度</h3>
      <div class="reveal">
        <ul class="cats-list">
          <li><span class="lbl">看到猫</span><span class="starbar">★★★★★★★★★★<span class="fill" style="--n:calc(1 * (1.02em + 3px))">★★★★★★★★★★</span></span></li>
          <li><span class="lbl">猫看我</span><span class="starbar">★★★★★★★★★★<span class="fill" style="--n:calc(2 * (1.02em + 3px))">★★★★★★★★★★</span></span></li>
          <li><span class="lbl">猫走过来</span><span class="starbar">★★★★★★★★★★<span class="fill" style="--n:calc(4 * (1.02em + 3px))">★★★★★★★★★★</span></span></li>
          <li><span class="lbl">猫让我摸</span><span class="starbar">★★★★★★★★★★<span class="fill" style="--n:calc(10 * (1.02em + 3px))">★★★★★★★★★★</span></span></li>
          <li><span class="lbl">猫主动蹭我</span><span class="full-badge">人生圆满。</span></li>
        </ul>
      </div>
      <div class="paws" aria-hidden="true">🐾🐾🐾🐾🐾</div>
    </div>"""
    return layout("cats.html", "Cats · az.log", main, root)


def page_memo(root=""):
    entries = [
        ("2026-08-18", "为什么晚上十二点以后什么都想做。白天：不知道。不想动。"),
        ("2026-08-13", "今天喝到一个酸得我眼睛都快睁不开的柠檬茶。但是喝完了。人类行为。"),
        ("2026-08-06", "猫猫表情包库存：持续增加。手机空间：持续减少。"),
        ("2026-07-30", "我宣布床是世界上最伟大的家具。没有之一。"),
        ("2026-07-18", "今天本来准备早点睡。现在：00:53。好。明天一定。"),
        ("2026-07-05", "暑假时间流速是不是和正常时间不一样。怎么一天一下就没了。"),
        ("2026-06-19", "突然特别想吃烧烤。为什么人在晚上总是想吃东西。"),
        ("2026-05-30", "有时候不知道回什么，所以发表情包。表情包：一种伟大的语言。"),
    ]
    items = "".join(
        '<div class="tl-item reveal"><p class="tl-date">{d}</p><p>{t}</p></div>'.format(d=d, t=esc(t))
        for d, t in entries
    )
    main = """<div class="card taped reveal">
      <h2>/memo</h2>
      <p>一些不值得单独写成文章的东西。</p>
      <div class="timeline">
        {items}
      </div>
    </div>""".format(items=items)
    return layout("memo.html", "Memo · az.log", main, root)


def page_links(root=""):
    main = """<div class="card taped reveal">
      <h2>Links</h2>
      <p>这里以后也许会放朋友的网站。</p>
      <p>目前：</p>
      <div class="emptybox">
        <span class="cat">🐈</span>
        <p class="big">空空如也。</p>
        <p>如果你也有自己的小站，可以交换友链呀——</p>
        <p style="color:var(--muted);font-size:.88rem">不过我可能很久才看到留言 www</p>
      </div>
    </div>"""
    return layout("links.html", "Links · az.log", main, root)


def page_guestbook(root=""):
    main = """<div class="card taped reveal">
      <h2>Guestbook</h2>
      <p>欢迎留言！</p>
      <div class="gb-rules">
        <div class="ok">
          <h3>可以：</h3>
          <ul>
            <li>推荐歌</li>
            <li>发猫</li>
            <li>说废话</li>
            <li>留一句今天发生的事情</li>
          </ul>
        </div>
        <div class="no">
          <h3>禁止：</h3>
          <ul>
            <li>广告</li>
            <li>奇怪链接</li>
            <li>问真实住址</li>
            <li>问学校</li>
            <li>人肉</li>
          </ul>
        </div>
      </div>
      <p>这里就是个普通小博客啦。不要查户口喂。(；´∀｀)</p>
      <form class="gb-form" id="gb-form">
        <input type="text" id="gb-name" maxlength="20" placeholder="名字（可以乱编）">
        <input type="text" id="gb-msg" maxlength="140" placeholder="说点什么……" required>
        <button type="submit">🐾 留下爪印</button>
      </form>
      <p class="gb-hint">※ 纯静态站点：留言保存在你自己的浏览器（localStorage）里，只有你自己看得到。</p>
      <div id="gb-list"></div>
    </div>"""
    return layout("guestbook.html", "留言板 · az.log", main, root)


def page_post(p, prev_p, next_p, root="../"):
    tags = POST_TAGS.get(p["date"], [])
    nav_parts = []
    if prev_p:
        nav_parts.append(
            '<a href="{slug}.html">← {t}</a>'.format(slug=SLUGS[prev_p["date"]], t=esc(prev_p["title"]))
        )
    else:
        nav_parts.append('<span class="mid">·</span>')
    nav_parts.append('<a class="mid" href="{r}archive.html">回归档</a>'.format(r=root))
    if next_p:
        nav_parts.append(
            '<a href="{slug}.html">{t} →</a>'.format(slug=SLUGS[next_p["date"]], t=esc(next_p["title"]))
        )
    else:
        nav_parts.append('<span class="mid">最新一篇了。</span>')
    main = """<article class="post card taped reveal">
      <div class="post-head">
        <p class="post-date">{date}</p>
        <h1 class="post-title">{title}</h1>
        {tags}
      </div>
      <div class="post-body">
        {body}
      </div>
      <nav class="post-nav">{nav}</nav>
    </article>""".format(
        date=p["date"], title=esc(p["title"]), tags=tags_html(tags, root), body=render_body(p["body"]), nav="".join(nav_parts)
    )
    return layout(None, "{} · az.log".format(p["title"]), main, root)


def page_404():
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · az.log</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#a8b4bf;background:radial-gradient(1100px 520px at 78% -12%,#1b232c 0%,transparent 62%),#14181d;min-height:100vh}
body::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.4'/></svg>")}
.p404{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;position:relative;z-index:2}
.p404 .code{font-family:Georgia,serif;font-size:6rem;color:#7d90a4;animation:wobble 5s ease-in-out infinite;margin:0;text-shadow:0 0 30px rgba(142,164,186,.12)}
.p404 .cat{font-size:3rem;margin:18px 0;animation:bob 4.5s infinite;display:inline-block;filter:grayscale(1) brightness(.85)}
.p404 h1{font-size:1.2rem;font-weight:500;margin:10px 0;color:#b3bdc7}
.p404 ul{list-style:none;padding:0;color:#717d89;font-size:.95rem;line-height:2}
.p404 a{display:inline-block;margin-top:22px;color:#93a5b7;border:1px dashed rgba(142,164,186,.35);border-radius:999px;padding:6px 26px;text-decoration:none;background:rgba(28,34,42,.5);backdrop-filter:blur(8px);transition:all .3s}
.p404 a:hover{color:#d5dfe9;transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,.45)}
@keyframes wobble{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) translateY(-6px)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
</style>
</head>
<body>
<div class="p404">
  <p class="code">404</p>
  <h1>你走到不存在的地方啦。</h1>
  <span class="cat">ฅ^•ﻌ•^ฅ</span>
  <p>可能是：</p>
  <ul>
    <li>链接写错了</li>
    <li>页面被我删了</li>
    <li>我自己把网站搞坏了</li>
  </ul>
  <p>都有可能。</p>
  <p>以及既然来了：送你一只猫。</p>
  <a id="back" href="/index.html">← 回首页</a>
</div>
<script>
var s=location.pathname.replace(/\\/+$/,'').split('/');
s.pop();
var base=s.length?s.join('/')+'/':'/';
document.getElementById('back').href=base+'index.html';
</script>
</body>
</html>"""


def main():
    posts = parse_posts()
    assert len(posts) == 19, "expected 19 posts, got {}".format(len(posts))
    for p in posts:
        assert p["date"] in SLUGS, "no slug for " + p["date"]

    (ROOT / "posts").mkdir(exist_ok=True)
    (ROOT / ".nojekyll").write_bytes(b"")

    pages = {
        "index.html": page_index(posts),
        "about.html": page_about(),
        "now.html": page_now(),
        "archive.html": page_archive(posts),
        "music.html": page_music(),
        "cats.html": page_cats(),
        "memo.html": page_memo(),
        "links.html": page_links(),
        "guestbook.html": page_guestbook(),
        "404.html": page_404(),
    }
    for name, html in pages.items():
        (ROOT / name).write_text(html, encoding="utf-8")

    for i, p in enumerate(posts):
        prev_p = posts[i - 1] if i > 0 else None
        next_p = posts[i + 1] if i < len(posts) - 1 else None
        out = ROOT / "posts" / (SLUGS[p["date"]] + ".html")
        out.write_text(page_post(p, prev_p, next_p), encoding="utf-8")

    for jpg in (ROOT / "assets").glob("*.jpg"):
        if jpg.name != "avatar.jpg":
            shutil.copyfile(jpg, ROOT / "assets" / "avatar.jpg")

    import json
    pages_map = dict(pages)
    pages_map.pop("404.html", None)
    for p in posts:
        key = "posts/" + SLUGS[p["date"]] + ".html"
        pages_map[key] = (ROOT / key).read_text(encoding="utf-8")
    (ROOT / "assets" / "pages.js").write_text(
        "window.__azlogPages=" + json.dumps(pages_map, ensure_ascii=False, separators=(",", ":")) + ";",
        encoding="utf-8",
    )

    print("posts:", len(posts))
    print("pages:", len(pages))
    print("pages.js:", len(pages_map), "entries")
    print("done")


if __name__ == "__main__":
    main()
