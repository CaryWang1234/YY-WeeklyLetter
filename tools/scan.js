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
      const pages = fs.readdirSync(folderPath)
        .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.'))
        .sort(naturalCmp)
        .map((f) => `reports/${folder}/${f}`);

      const parsed = parseIssue(folder);
      return {
        parsed,
        data: {
          id: parsed ? `${parsed.y}-${pad(parsed.m)}-${pad(parsed.issue)}` : folder,
          name: folder,
          folder,
          ...(parsed ? { year: parsed.y, month: parsed.m, issue: parsed.issue } : {}),
          cover: pages[0] || null,
          pages,
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
