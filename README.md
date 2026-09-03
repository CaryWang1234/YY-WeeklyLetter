# 耀阳周报 · 线上存档

「耀阳周报」往期展示网站,纯静态、零依赖,可直接部署到 GitHub Pages。每期若干张 1080×1920 竖版 PNG 以竖向连排的方式浏览,主页即往期归档(最新在前)。

## 目录结构

```
├─ index.html            # 单页应用(归档 + 阅读,hash 路由)
├─ assets/
│  ├─ css/style.css
│  ├─ js/app.js
│  ├─ logo.png           # 站点 logo
│  └─ issues.json        # 期次清单(自动生成,提交到仓库)
├─ tools/
│  ├─ build_images.py    # 生成 optimized/ 压缩图,并自动刷新清单
│  └─ scan.js            # 扫描 reports/,重新生成 issues.json
├─ reports/              # 每一期一个文件夹,原图按 1.png、2.png… 命名
│  └─ 耀阳周报26-9-1/
│     ├─ 1.png
│     └─ 2.png
├─ optimized/            # 由 build_images.py 自动生成的 WebP 压缩图
│  └─ 耀阳周报26-9-1/
│     ├─ 1.webp
│     ├─ 1.thumb.webp    # 归档封面缩略图
│     └─ 2.webp
```

## 每期如何添加(只需两步)

1. 把新一期的文件夹(如 `耀阳周报26-9-2`)整个复制到 `reports/` 下,文件夹内图片按阅读顺序命名(`1.png`、`2.png`…)。
2. 运行 `python tools/build_images.py`(需安装 Pillow:`pip install Pillow`)。它会:
   - 把每张原图压成最宽 1080 的 WebP 放到 `optimized/`(约缩小 5~10 倍,网页加载更快);
   - 为封面生成小尺寸缩略图;
   - 自动刷新 `assets/issues.json`,让网页指向压缩图。

> 文件夹名格式为 `耀阳周报YY-M-N`,含义是 **YY年 M月 第N期**(如 `耀阳周报26-9-1` = 2026年9月第1期,9月第2期就是 `耀阳周报26-9-2`,10月第1期为 `耀阳周报26-10-1`)。清单按「年 → 月 → 当月期号」排序;期号无法解析的文件夹会排在末尾。支持 `png / jpg / jpeg / webp / gif`。

## 本地预览

```bash
python -m http.server 8080
# 或
npx serve .
```

然后访问 <http://localhost:8080>。注意不要直接双击 `index.html`(浏览器会因跨域限制读不到清单)。

## 部署到 GitHub Pages(推荐:GitHub Actions 自动部署)

仓库已内置 `.github/workflows/deploy-pages.yml`:每次推送到 `main` 都会自动构建并发布,无需手动再部署。

1. 把本仓库推送到 GitHub(仓库需为公开,或使用 Pro 及以上套餐的私有仓库 Pages)。
2. 打开仓库 **Settings → Pages**:
   - Source 选 **GitHub Actions**(保留默认的 Actions 工作流即可);
   - 点 **Save**。
3. 首次推送(或手动运行 Actions 里的 **Deploy to GitHub Pages**)后,一两分钟即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问。以后每次推送新一期,网站会自动更新。

> 如果不想用 Actions,也可以改为:Settings → Pages → Source 选 **Deploy from a branch**,Branch 选 `main`、目录选 `/ (root)`。

## 技术说明

- 所有资源均使用相对路径,仓库作为用户名主页(`*.github.io`)或项目子路径部署都无需改动。
- 页面通过 `assets/issues.json` 获取期次清单(纯静态站点无法在服务端扫描目录,因此清单需要先由脚本生成并提交)。
- 图片默认只加载 `optimized/` 里的 WebP 压缩图(归档封面用更小的缩略图),并懒加载;需要原图时点每页的「查看原图」才会加载 PNG。
- 站点不依赖任何外部 CDN / 字体,可离线使用。
