'use strict';

(() => {
  const MANIFEST_URL = './assets/issues.json';
  const $ = (sel, root = document) => root.querySelector(sel);

  const viewHome = $('#view-home');
  const viewIssue = $('#view-issue');
  const issueGrid = $('#issue-grid');
  const mastCount = $('#mast-count');
  const footerNote = $('#footer-note');

  const issueTitle = $('#issue-title');
  const issueSub = $('#issue-sub');
  const readerIntro = $('#reader-intro');
  const readerPages = $('#reader-pages');
  const issueNav = $('#issue-nav');
  const prevIssueBtn = $('#prev-issue-btn');
  const nextIssueBtn = $('#next-issue-btn');

  let data = null;       // 清单原文
  let issues = [];       // 按 年→月→当月期号 升序
  let currentIdx = -1;   // 阅读中第几期

  const pad2 = (n) => String(n).padStart(2, '0');
  // 期号含义:年-月-当月第 n 期(如 2026-09-01 = 2026年9月第1期)
  const periodOf = (issue) =>
    issue.year ? `${issue.year}年${issue.month}月 · 第 ${issue.issue} 期` : '期号未知';
  const monthOf = (issue) =>
    issue.year ? `${issue.year} 年 ${issue.month} 月` : '';
  const issueKey = (issue) =>
    issue.year ? `${issue.year}-${pad2(issue.month)}-${pad2(issue.issue)}` : '';

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  /* ---------- 路由 ---------- */
  const parseHash = () => {
    const h = location.hash.replace(/^#\/?/, '');
    if (!h) return { view: 'home' };
    if (h.startsWith('issue/')) return { view: 'issue', id: decodeURIComponent(h.slice(6)) };
    return { view: 'home' };
  };

  function navigate() {
    const route = parseHash();
    if (route.view === 'issue') showIssue(route.id, { push: false });
    else showHome();
  }

  /* ---------- 主页 ---------- */
  function showHome() {
    currentIdx = -1;
    document.title = data ? `${data.siteTitle} · 往期存档` : '耀阳周报 · 往期存档';
    viewIssue.classList.remove('active');
    viewHome.classList.add('active');
    renderHome();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderHome() {
    if (!data) return;
    const total = issues.length;
    const pageCount = issues.reduce((n, i) => n + i.pages.length, 0);
    mastCount.textContent = `共 ${total} 期 · ${pageCount} 页,最新在前`;
    footerNote.textContent = '把新一期的文件夹放进 reports/ 并运行 node tools/scan.js,即可自动收录。';

    // 最新在前
    const order = [...issues].reverse();
    issueGrid.textContent = '';

    order.forEach((issue, cardIdx) => {
      const li = document.createElement('li');
      li.className = 'issue-item';

      const a = document.createElement('a');
      a.className = 'issue-card';
      a.href = `#/issue/${encodeURIComponent(issue.id)}`;

      // 兼容旧清单(cover 为字符串)与新清单(cover 为 {src,view,thumb} 对象)
      const coverSrc = !issue.cover ? null
        : (typeof issue.cover === 'string' ? issue.cover
          : (issue.cover.thumb || issue.cover.view || issue.cover.src));
      if (coverSrc) {
        const img = document.createElement('img');
        img.className = 'card-cover';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = `${issue.name} 封面`;
        img.width = 420;
        img.height = 747;
        img.src = coverSrc;
        a.appendChild(img);
      }

      const tape = document.createElement('i');
      tape.className = 'tape';
      tape.setAttribute('aria-hidden', 'true');
      a.appendChild(tape);

      const meta = document.createElement('span');
      meta.className = 'card-meta';
      meta.innerHTML =
        `<span class="card-ord">${esc(issue.issue ? `${issue.month}月 · 第${issue.issue}期` : '期号未知')}</span>` +
        `<span class="card-name">${esc(issue.name)}</span>` +
        (monthOf(issue) ? `<span class="card-date">${esc(monthOf(issue))}</span>` : '');
      a.appendChild(meta);

      li.appendChild(a);
      issueGrid.appendChild(li);
      // 交错入场 + 错落的“手贴”倾斜
      li.style.setProperty('--i', String(Math.min(cardIdx, 12)));
      li.style.setProperty('--tilt', cardIdx % 2 ? '-0.8deg' : '0.8deg');
    });
  }

  /* ---------- 阅读页 ---------- */
  function showIssue(id, { push = true } = {}) {
    if (!data) return;
    const idx = issues.findIndex((i) => i.id === id);
    if (idx === -1) { showHome(); return; }

    if (push && location.hash !== `#/issue/${encodeURIComponent(id)}`) {
      location.hash = `#/issue/${encodeURIComponent(id)}`;
    }

    currentIdx = idx;
    const issue = issues[idx];
    document.title = `${issue.name} · ${data.siteTitle}`;

    viewHome.classList.remove('active');
    viewIssue.classList.add('active');

    issueTitle.textContent = issue.name;
    issueSub.textContent = `${periodOf(issue)} · 共 ${issue.pages.length} 张,向下翻阅`;

    // 顶部导读
    readerIntro.textContent = '';
    const intro = document.createElement('p');
    intro.className = 'reader-hint';
    intro.textContent = '↓ 向下滑动,逐页阅读本期周报';
    readerIntro.appendChild(intro);

    // 页面
    readerPages.textContent = '';
    issue.pages.forEach((page, pi) => {
      const src = page.src || page;
      const view = page.view || src;
      const fig = document.createElement('figure');
      fig.className = 'page';

      const img = document.createElement('img');
      img.loading = pi === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.alt = `${issue.name} 第 ${pi + 1} 页 / 共 ${issue.pages.length} 页`;
      img.width = 540;
      img.height = 960;
      img.src = view;
      fig.appendChild(img);

      if (src && src !== view) {
        const orig = document.createElement('a');
        orig.className = 'page-original';
        orig.href = src;
        orig.target = '_blank';
        orig.rel = 'noopener';
        orig.textContent = '查看原图';
        fig.appendChild(orig);
      }
      readerPages.appendChild(fig);
    });

    renderIssueNav(idx);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderIssueNav(idx) {
    const issue = issues[idx];
    issueNav.textContent = '';

    const prev = issues[idx - 1];
    const next = issues[idx + 1];

    if (!prev && !next) {
      const note = document.createElement('p');
      note.className = 'issue-nav-solo';
      note.textContent = '这是目前唯一的一期,新一期发布后会自动出现在这里。';
      issueNav.appendChild(note);
      prevIssueBtn.disabled = true;
      nextIssueBtn.disabled = true;
      return;
    }

    const mkBtn = (label, dir, target) => {
      const b = document.createElement('a');
      b.className = `issue-nav-btn ${dir}`;
      b.href = target ? `#/issue/${encodeURIComponent(target.id)}` : '#/';
      b.setAttribute('aria-label', target ? `${label} ${target.name}` : '');
      b.innerHTML =
        `<span class="issue-nav-arrow">${dir === 'prev' ? '‹' : '›'}</span>` +
        `<span class="issue-nav-body">` +
        `<span class="issue-nav-label">${esc(label)}</span>` +
        `<span class="issue-nav-name">${target ? esc(target.name) : '—'}</span>` +
        `</span>`;
      return b;
    };

    const wrap = document.createElement('div');
    wrap.className = 'issue-nav-row';

    const prevLink = mkBtn('上一期', 'prev', prev);
    const nextLink = mkBtn('下一期', 'next', next);
    if (!prev) prevLink.classList.add('is-empty');
    if (!next) nextLink.classList.add('is-empty');
    wrap.appendChild(prevLink);
    wrap.appendChild(nextLink);
    issueNav.appendChild(wrap);

    prevIssueBtn.disabled = !prev;
    nextIssueBtn.disabled = !next;
    prevIssueBtn.title = prev ? `上一期:${prev.name}` : '已经是最早一期';
    nextIssueBtn.title = next ? `下一期:${next.name}` : '已经是最新一期';
  }

  /* ---------- 交互 ---------- */
  function wireEvents() {
    prevIssueBtn.addEventListener('click', () => {
      if (currentIdx > 0) location.hash = `#/issue/${encodeURIComponent(issues[currentIdx - 1].id)}`;
    });
    nextIssueBtn.addEventListener('click', () => {
      if (currentIdx > -1 && currentIdx < issues.length - 1) {
        location.hash = `#/issue/${encodeURIComponent(issues[currentIdx + 1].id)}`;
      }
    });

    window.addEventListener('hashchange', navigate);

    document.addEventListener('keydown', (e) => {
      const inIssue = viewIssue.classList.contains('active') && currentIdx > -1;
      if (!inIssue) return;
      if (e.key === 'ArrowLeft' && currentIdx > 0) {
        location.hash = `#/issue/${encodeURIComponent(issues[currentIdx - 1].id)}`;
      } else if (e.key === 'ArrowRight' && currentIdx < issues.length - 1) {
        location.hash = `#/issue/${encodeURIComponent(issues[currentIdx + 1].id)}`;
      } else if (e.key === 'Escape') {
        location.hash = '#/';
      }
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    wireEvents();
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        data = json;
        // 按期号升序:年→月→当月期号;无法解析的排在末尾
        issues = (json.issues || [])
          .slice()
          .sort((a, b) => {
            const ka = issueKey(a);
            const kb = issueKey(b);
            if (ka && kb) return ka < kb ? -1 : 1;
            if (ka) return -1;
            if (kb) return 1;
            return 0;
          });
        if (issues.length === 0) {
          issueGrid.textContent = '';
          mastCount.textContent = '还没有收录任何一期,添加后会自动显示。';
        }
        navigate();
      })
      .catch(() => {
        mastCount.textContent = '清单加载失败。';
        footerNote.textContent = '请确认 assets/issues.json 存在,并通过本地 http 服务或 GitHub Pages 访问本站。';
        issueGrid.innerHTML = `<li class="issue-error">读取往期清单失败:assets/issues.json 无法访问。<br>本地预览请用 <code>python -m http.server</code> 后访问,而不是直接双击 HTML。</li>`;
      });
  }

  boot();
})();
