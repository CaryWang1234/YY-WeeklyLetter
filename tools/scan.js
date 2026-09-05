#!/usr/bin/env node
// 扫描 reports/ 下的每期文件夹,重新生成 assets/issues.json
// 用法:node tools/scan.js
'use strict';

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const OUT_FILE = path.join(__dirname, '..', 'assets', 'issues.json');

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

const pad = (n) => String(n).padStart(2, '0');

// 文件夹名含义:年-月-当月第N期,如「耀阳周报26-9-1」= 2026年9月第1期
// 容错:年份可为 2 位或 4 位,分隔符支持 - _ . 年月期等中文后缀
function parseIssue(name) {
  const m = name.match(/(\d{2,4})\s*[-_.年月]\s*(\d{1,2})\s*[-_.月期]\s*(\d{1,2})/);
  if (!m) return null;
  let [, y, mo, n] = m;
  y = y.length === 2 ? '20' + y : y;
  const nY = Number(y), nM = Number(mo), nI = Number(n);
  if (!(nY >= 2000 && nY <= 2100 && nM >= 1 && nM <= 12 && nI >= 1 && nI <= 99)) return null;
  return { y: nY, m: nM, issue: nI };
}

// 自然排序:把「2.png」排在「10.png」前面
const naturalCmp = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' }).compare;

const OPT_DIR = path.join(__dirname, '..', 'optimized');

// 原图 reports/<folder>/x.png 对应压缩图 optimized/<folder>/x.webp
// 生成过就用压缩图(网页加载快),没有则回退原图
function pickView(rel) {
  const webp = rel.replace(/^reports\//, 'optimized/').replace(/\.[^.]+$/, '.webp');
  const abs = path.join(OPT_DIR, webp.replace(/^optimized[\\/]/, ''));
  return fs.existsSync(abs) ? webp : rel;
}

// 封面缩略图 optimized/<folder>/x.thumb.webp,同样带回退
function pickThumb(rel) {
  const m = rel.match(/^optimized[\\/](.+?)[\\/](.+)\.webp$/);
  if (!m) return rel;
  const thumb = `optimized/${m[1]}/${m[2]}.thumb.webp`;
  const abs = path.join(OPT_DIR, m[1], `${m[2]}.thumb.webp`);
  return fs.existsSync(abs) ? thumb : rel;
}

// 给图片 URL 加内容哈希版本号:覆盖同一期时文件名不变,但内容变了,
// 带上 ?v=<哈希> 后网址跟着变,浏览器才不会用旧缓存(封面/阅读页都适用)
function versioned(url) {
  if (!url) return url;
  let hash;
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', url));
    hash = require('crypto').createHash('sha1').update(buf).digest('hex').slice(0, 10);
  } catch {
    return url; // 文件缺失时保持原样,不阻塞收录
  }
  return `${url}?v=${hash}`;
}

function scan() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    console.log(`已创建空目录 ${REPORTS_DIR},放入周报文件夹后重新运行本脚本`);
    return [];
  }

  const issues = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const folder = e.name;
      const folderPath = path.join(REPORTS_DIR, folder);
      const pageSrcs = fs.readdirSync(folderPath)
        .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.'))
        .sort(naturalCmp)
        .map((f) => `reports/${folder}/${f}`);
      const pages = pageSrcs.map((src) => ({ src, view: pickView(src) }));
      const first = pages[0] || null;
      const cover = first
        ? { src: first.src, view: first.view, thumb: pickThumb(first.view) }
        : null;

      const parsed = parseIssue(folder);
      return {
        parsed,
        data: {
          id: parsed ? `${parsed.y}-${pad(parsed.m)}-${pad(parsed.issue)}` : folder,
          name: folder,
          folder,
          ...(parsed ? { year: parsed.y, month: parsed.m, issue: parsed.issue } : {}),
          cover: cover
            ? {
                src: versioned(cover.src),
                view: versioned(cover.view),
                thumb: versioned(cover.thumb),
              }
            : null,
          pages: pages.map((p) => ({
            src: versioned(p.src),
            view: versioned(p.view),
          })),
        },
      };
    })
    .filter((i) => i.data.pages.length > 0)
    // 可解析的按 年→月→当月期号 升序;无法解析的按名称排在其后
    .sort((a, b) => {
      if (a.parsed && b.parsed) {
        const ka = `${a.parsed.y}-${pad(a.parsed.m)}-${pad(a.parsed.issue)}`;
        const kb = `${b.parsed.y}-${pad(b.parsed.m)}-${pad(b.parsed.issue)}`;
        return ka < kb ? -1 : 1;
      }
      if (a.parsed) return -1;
      if (b.parsed) return 1;
      return naturalCmp(a.data.name, b.data.name);
    })
    .map((i) => i.data);

  return issues;
}

const issues = scan();

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const payload = {
  siteTitle: '耀阳周报',
  siteSubtitle: 'YaoYang Weekly Newsletter',
  issues,
};
// UTF-8 无 BOM,浏览器 fetch 按 UTF-8 解码
fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8' });

const labelOf = (i) => (i.year ? `${i.year}年${i.month}月 · 第${i.issue}期` : '期号未知');
if (issues.length === 0) {
  console.log('未发现任何期次,清单已重置。');
} else {
  console.log(`共发现 ${issues.length} 期:`);
  for (const i of issues) {
    console.log(`  ${labelOf(i)}  ${i.name}  (${i.pages.length} 张)`);
  }
}
console.log(`清单已写入 ${path.relative(process.cwd(), OUT_FILE)}`);
