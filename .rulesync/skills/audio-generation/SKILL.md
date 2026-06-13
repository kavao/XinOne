---
name: audio-generation
description: "tools/sound/sfx_generator.py (OnGen由来) を使い、XinOneのゲーム向け効果音・BGMを生成する"
targets: ["*"]
---

## Purpose

[OnGen](https://github.com/kavao/OnGen) (MIT License) から取り込んだ音源生成ツールを使い、
XinOneの各ゲーム・ランチャー向けの効果音・BGMを再現可能なコマンドとして生成する。
実装正本は `tools/sound/sfx_generator.py`（単一ファイル、依存は numpy/scipy のみ）。

## Pre-work check

作業開始前に次を確認する。

1. `tools/sound/sfx_generator.py` が存在するか。
2. `uv run python tools/sound/sfx_generator.py --list-presets` が実行できるか（`numpy`/`scipy` は `pyproject.toml` 管理）。
3. MP3 / OGG が必要なら `ffmpeg` が PATH にあるか。
4. `--play` でその場再生する場合は `ffplay` が PATH にあるか。
5. 対象ゲームのアセット保存先・命名・`licenses/audio/` の既存エントリを確認する。

## Required files

- `tools/sound/sfx_generator.py`
- Python依存: `numpy`, `scipy`（`uv run` で自動解決）
- MP3 / OGGも必要な場合: `ffmpeg`
- `--play` でその場再生する場合: `ffplay`

## Game asset conventions

XinOne の既存配置に従う。

| 種別 | 配置先 | 命名 |
|------|-------|------|
| 共有SFX/BGM | `packages/shared-assets/assets/audio/{sfx,bgm}/` | `audio-manifest.ts` のキーに対応する名前 |
| ゲーム個別SFX | `games/<game>/assets/audio/sfx/` | `games/<game>/src/audio-manifest.ts` のキーに対応する名前 |
| 楽譜（MML/ABC） | `scores/` | アセット名と対応が分かる名前（例: `ui-click.mml`） |
| 出典・ライセンス | `licenses/audio/<group>/<asset>.json` | 既存形式に合わせる |
| 検証用 | `output/`（Git管理外） | 本番アセットと分離 |

生成音声は派生成果物とする。正本は楽譜（`scores/*.mml` 等）または再実行可能な
`sfx_generator.py` コマンドとし、`licenses/audio/**/*.json` の `generation` フィールドに記録する。

## Workflow

### SFX（効果音）

1. 用途を確認する（UI、ヒット、ジャンプ、ジングルなど）。
2. `--list-presets` で既存プリセットを確認し、近いものがあれば再利用する。
3. プリセットをベースに調整する場合、または独自MMLの場合は `scores/` に楽譜を保存する。
4. 生成後に長さ、ピーク、クリッピング、立ち上がりノイズを確認する。
5. 既存ファイルと同じ仕様（サンプルレート/モノラル/16bit WAV）で配置先に書き出す。

### BGM（ループ・複数トラック）

1. 曲の長さ、テンポ、キー、パート構成を確認する。
2. MML/ABC を `scores/` に保存する。
3. 複数トラックは `--track-file` で分離し、再生成可能に保つ。
4. 生成後に音程・音価・ループ境界・ミックスのヘッドルームを確認する。

## Common commands

```bash
uv run python tools/sound/sfx_generator.py --list-presets
uv run python tools/sound/sfx_generator.py --preset coin -o output/coin
uv run python tools/sound/sfx_generator.py --preset coin --play
uv run python tools/sound/sfx_generator.py --input "O4 L4 T120 C D E G" --style square -o output/melody
uv run python tools/sound/sfx_generator.py --input-file scores/<score>.mml -o output/<name>
uv run python tools/sound/sfx_generator.py --input-file path/to/melody.abc --format abc --track-file path/to/bass.abc -o output/duet
uv run python -m unittest discover -s tests -v
```

## Verification

生成後は最低限次を確認する。

- 長さが意図どおりか
- ピークが 0.99 未満でクリッピングしていないか
- 冒頭に立ち上がりノイズがないか（既定の `--fade-in` を確認）
- ループ素材の場合は境界の継ぎ目

`tools/sound/sfx_generator.py` や楽譜・プリセット定義を変更した場合は
`uv run python -m unittest discover -s tests -v` を実行し、終了コード 0 を確認する。
ゲーム側のアセット参照を変更した場合は `npm test` / `npm run typecheck` も実行する。

## Guardrails

- `output/` やゲームアセットの生成物だけを直して完了にしない。正本の楽譜または生成コマンドを
  `licenses/audio/**/*.json` の `generation` に残す（概念正本: `rules/concepts.md` の「正本と副本」）。
- MMLの音符直後の数字は音長（PPMCK / MCK流）。オクターブは `O` コマンドと相対オクターブ変更
  `>` / `<` で指定する。詳細は `docs/audio/mml-reference.md` を確認する。
- Rulesync生成物（`.agents/skills/audio-generation/` 等）は直接編集しない。正本は
  `.rulesync/skills/audio-generation/SKILL.md` を更新してから `rulesync generate` する。
