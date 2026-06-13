# 音源生成ガイド

XinOne のゲーム向け効果音・BGM を [OnGen](https://github.com/kavao/OnGen) (`tools/sound/sfx_generator.py`)
で生成するときの人間向けマニュアルです。MML/ABC の記法、音色設計、ゲームへの出力までを目的別に案内します。

## ガイド一覧

| ページ | いつ読むか |
|--------|-----------|
| [クイックスタート](quickstart.md) | 初めて音を出すとき |
| [効果音（SFX）](sfx.md) | プリセットやドラム風の短い音を作るとき |
| [BGMと楽譜](bgm-and-scores.md) | 楽譜ファイルや複数トラックで曲を鳴らすとき |
| [MMLリファレンス](mml-reference.md) | MML の書き方や PPMCK/MCK 互換を確認するとき |
| [音色合成](synthesis.md) | FM、LFO、ノイズ、ADSR、サンプル混在を使うとき |
| [出力とゲーム統合](output-and-game-integration.md) | WAV/MP3/OGG やゲームアセットへの配置を検討するとき |

## 実装と正本

- 音源生成の実装正本は `tools/sound/sfx_generator.py` です（[OnGen](https://github.com/kavao/OnGen) より MIT License で取り込み）。
- 再生成可能な楽譜は `scores/` に置きます。
- 生成した音声は `output/` に保存します（Git 管理外）。各ゲームのアセットへ反映する際は `packages/shared-assets/assets/audio/` や `games/*/assets/audio/` へコピーします。

LLM エージェント向けの作業手順は [audio-generation スキル](../../.rulesync/skills/audio-generation/SKILL.md) が正本です。人間向けの操作説明はこの `docs/audio/` 配下を参照してください。
