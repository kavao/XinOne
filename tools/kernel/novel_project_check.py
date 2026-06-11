#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
作品フォルダの機械検証ツール。

novels/<作品>/ 配下に必要なファイルとディレクトリが揃っているかを確認し、
config.md の novel_ID とフォルダ名の整合も検証する。
終了コード 0 は全 OK、1 は問題ありを意味する。

使い方:
  python novel_project_check.py novels/001_作品名
  python novel_project_check.py novels/001_作品名 --require-tag --require-manga-dir
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# kernel/ と同じディレクトリから import（dna_kernel 内で完結させる）
_TOOLS_DIR = Path(__file__).resolve().parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

import novel_code_allocate as nca  # noqa: E402
import novel_image_layout as nil  # noqa: E402


DEFAULT_REQUIRED_FILES = (
    "proposal.md",
    "design_specification.md",
    "config.md",
    "character.md",
    "world.md",
    "_meta.md",
)

DEFAULT_REQUIRED_DIRS = (
    "_novel_text",
    "_reader",
)


def _file_status(path: Path, min_bytes: int) -> dict[str, Any]:
    if not path.is_file():
        return {"path": str(path), "ok": False, "reason": "missing"}
    size = path.stat().st_size
    if size < min_bytes:
        return {
            "path": str(path),
            "ok": False,
            "reason": f"too_small ({size} < {min_bytes} bytes)",
            "size": size,
        }
    return {"path": str(path), "ok": True, "size": size}


def _dir_status(path: Path) -> dict[str, Any]:
    if not path.is_dir():
        return {"path": str(path), "ok": False, "reason": "missing"}
    return {"path": str(path), "ok": True}


def check_novel_project(
    work: Path,
    *,
    min_file_bytes: int,
    require_tag_md: bool,
    require_manga_dir: bool,
) -> dict[str, Any]:
    work = work.resolve()
    out: dict[str, Any] = {
        "work_dir": str(work),
        "ok": True,
        "novel_code_verify": None,
        "required_files": [],
        "required_dirs": [],
        "optional": {},
        "issues": [],
    }

    if not work.is_dir():
        out["ok"] = False
        out["issues"].append(f"ディレクトリがありません: {work}")
        return out

    v = nca.verify_work_dir(work)
    out["novel_code_verify"] = v
    if not v.get("ok"):
        out["ok"] = False
        for i in v.get("issues") or []:
            out["issues"].append(f"novel_ID/フォルダ名: {i}")

    for name in DEFAULT_REQUIRED_FILES:
        p = work / name
        st = _file_status(p, min_file_bytes)
        out["required_files"].append({"name": name, **st})
        if not st["ok"]:
            out["ok"] = False
            out["issues"].append(f"必須ファイル: {name} — {st.get('reason', 'bad')}")

    for name in DEFAULT_REQUIRED_DIRS:
        p = work / name
        st = _dir_status(p)
        out["required_dirs"].append({"name": name, **st})
        if not st["ok"]:
            out["ok"] = False
            out["issues"].append(f"必須ディレクトリ: {name} — {st.get('reason')}")

    tag_dir = work / "tag"
    tag_mds = sorted(tag_dir.glob("*.md")) if tag_dir.is_dir() else []
    out["optional"]["tag_md_count"] = len(tag_mds)
    out["optional"]["tag_files"] = [t.name for t in tag_mds]

    if require_tag_md:
        if not tag_mds:
            out["ok"] = False
            out["issues"].append("tag/*.md が1件もありません（--require-tag 指定）")

    missing_romaji_dirs: list[str] = []
    for md in tag_mds:
        stem = md.stem
        sub = tag_dir / stem
        if not sub.is_dir():
            missing_romaji_dirs.append(stem)
    out["optional"]["tag_romaji_dirs_missing"] = missing_romaji_dirs

    manga_dir = work / "manga"
    out["optional"]["manga_dir_exists"] = manga_dir.is_dir()
    if require_manga_dir and not manga_dir.is_dir():
        out["ok"] = False
        out["issues"].append("manga/ がありません（--require-manga-dir 指定）")

    return out


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    p = argparse.ArgumentParser(
        description="作品フォルダの執筆前・資料準備チェック（必須ファイル/ディレクトリ）"
    )
    p.add_argument(
        "work_dir",
        type=Path,
        help="novels/NNN_作品名",
    )
    p.add_argument(
        "--min-file-bytes",
        type=int,
        default=48,
        help="必須 .md の最小バイト数（空ファイル検出。既定: 48）",
    )
    p.add_argument(
        "--require-tag",
        action="store_true",
        help="tag/*.md が少なくとも1つ必要（Tag Mode 済みを必須にする）",
    )
    p.add_argument(
        "--require-manga-dir",
        action="store_true",
        help="manga/ ディレクトリが存在することを必須にする",
    )
    p.add_argument("--json", action="store_true", help="JSON で出力")
    p.add_argument(
        "--check-image-layout",
        action="store_true",
        help="novel_image_layout.py と連携して tag/<romaji>/ と manga/_assets/ の完全性を検証",
    )
    args = p.parse_args(argv)

    result = check_novel_project(
        args.work_dir,
        min_file_bytes=args.min_file_bytes,
        require_tag_md=args.require_tag,
        require_manga_dir=args.require_manga_dir,
    )

    if args.check_image_layout:
        try:
            created = nil.scaffold_tag_dirs(Path(args.work_dir)) + nil.scaffold_manga_dirs(Path(args.work_dir), 4)
            result["optional"]["image_layout_checked"] = True
            result["optional"]["image_dirs_created_count"] = len(created)
        except Exception as e:
            result["optional"]["image_layout_error"] = str(e)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1

    wd = result["work_dir"]
    print(f"作品: {wd}")
    nv = result.get("novel_code_verify") or {}
    if nv.get("ok"):
        print(f"  novel_ID / フォルダ番号: {nv.get('novel_id_from_config')} (一致)")
    else:
        for i in nv.get("issues") or []:
            print(f"  NG [採番]: {i}")

    print("  必須ファイル:")
    for it in result["required_files"]:
        sym = "OK" if it["ok"] else "NG"
        sz = it.get("size", "-")
        print(f"    [{sym}] {it['name']}  ({sz} bytes)")

    print("  必須ディレクトリ:")
    for it in result["required_dirs"]:
        sym = "OK" if it["ok"] else "NG"
        print(f"    [{sym}] {it['name']}/")

    opt = result.get("optional") or {}
    print("  任意（参考）:")
    print(f"    tag/*.md: {opt.get('tag_md_count', 0)} 件")
    if opt.get("tag_romaji_dirs_missing"):
        print("    WARN: tag/<romaji>/ 未作成のタグ: " + ", ".join(opt["tag_romaji_dirs_missing"]))
    print(f"    manga/: {'あり' if opt.get('manga_dir_exists') else 'なし'}")

    if result["ok"] and not result.get("issues"):
        print("\n=== 結果: OK ===")
        print("執筆前の必須資料・ディレクトリは揃っています。")
        if args.check_image_layout:
            print(f"画像レイアウトチェック: {opt.get('image_dirs_created_count', 0)} 個の保存フォルダを確認済み")
        return 0

    print("\n=== 結果: NG ===")
    print("以下の問題を修正してから執筆してください:")
    for line in result.get("issues") or []:
        print(f"  • {line}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

