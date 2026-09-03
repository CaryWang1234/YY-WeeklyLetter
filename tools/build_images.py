#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 reports/ 里的原图压成 WebP,输出到 optimized/ 供网页加载。

- 每张原图 → optimized/<期文件夹>/<名>.webp(最宽 1080,网页阅读用)
- 每期第一张额外生成 <名>.thumb.webp(封面缩略图,宽 420)
- 处理完自动运行 node tools/scan.js,让清单指向这些压缩图

用法:python tools/build_images.py
依赖:Pillow(如缺: pip install Pillow)
"""
import os
import re
import subprocess
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

# Windows 控制台默认 GBK,强制 UTF-8 避免打印特殊符号报错
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS = os.path.join(ROOT, "reports")
OPT = os.path.join(ROOT, "optimized")
DISPLAY_W = 1080   # 阅读图最宽像素
COVER_W = 420      # 封面缩略图宽
QUALITY = 80
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def open_rgb(src):
    im = Image.open(src)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        return im.convert("RGBA")
    return im.convert("RGB")


def resize_to(im, target_w):
    if im.width <= target_w:
        return im
    h = round(im.height * target_w / im.width)
    return im.resize((target_w, h), Image.LANCZOS)


def save_webp(im, dst, quality):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=6)


def main():
    if not os.path.isdir(REPORTS):
        print(f"未找到目录 {REPORTS},请先把周报文件夹放到 reports/ 下。")
        sys.exit(1)

    total_src = total_dst = 0
    reports = sorted(os.listdir(REPORTS))
    any_issue = False

    for folder in reports:
        folder_path = os.path.join(REPORTS, folder)
        if not os.path.isdir(folder_path) or folder.startswith("."):
            continue
        files = sorted(
            (f for f in os.listdir(folder_path) if f.lower().endswith(IMAGE_EXTS)),
            key=natural_key,
        )
        if not files:
            continue
        any_issue = True
        print(f"▸ {folder}")

        for idx, name in enumerate(files):
            src = os.path.join(folder_path, name)
            base = os.path.splitext(name)[0]
            dst = os.path.join(OPT, folder, base + ".webp")
            im = open_rgb(src)
            view = resize_to(im, DISPLAY_W)
            save_webp(view, dst, QUALITY)
            src_size = os.path.getsize(src)
            dst_size = os.path.getsize(dst)
            total_src += src_size
            total_dst += dst_size
            print(
                f"    {name:14s} {src_size/1024:8.0f} KB → "
                f"{dst_size/1024:6.0f} KB"
            )
            # 每期第一张额外做封面缩略图
            if idx == 0:
                thumb = os.path.join(OPT, folder, base + ".thumb.webp")
                save_webp(resize_to(im, COVER_W), thumb, QUALITY)
                print(f"    cover缩略图        → {os.path.getsize(thumb)/1024:6.0f} KB")
            im.close()

    if not any_issue:
        print("reports/ 下没有任何周报文件夹。")
        sys.exit(1)

    print(
        f"\n合计:原图 {total_src/1024/1024:.2f} MB → WebP "
        f"{total_dst/1024/1024:.2f} MB(约 {max(1, round(total_src/max(total_dst,1)))} 倍缩小)"
    )

    # 自动刷新清单,让网页指向压缩图
    scan = os.path.join(ROOT, "tools", "scan.js")
    if os.path.exists(scan):
        print("正在刷新 assets/issues.json …")
        subprocess.run(["node", scan], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
