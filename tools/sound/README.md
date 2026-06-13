# 音源生成ツール (OnGen)

`tools/sound/sfx_generator.py` は [kavao/OnGen](https://github.com/kavao/OnGen)
（MIT License）から取り込んだ音源生成の実装正本です。NumPy と SciPy のみに依存する
単一ファイルで、効果音・BGMをプリセットやMML/ABC楽譜から再現可能に生成します。

## 最短コマンド

```bash
uv run python tools/sound/sfx_generator.py --list-presets
uv run python tools/sound/sfx_generator.py --preset coin -o output/coin
```

## 詳細ドキュメント

- [クイックスタート](../../docs/audio/quickstart.md)
- [効果音（SFX）](../../docs/audio/sfx.md)
- [BGMと楽譜](../../docs/audio/bgm-and-scores.md)
- [MML記法](../../docs/audio/mml-reference.md)
- [音源合成の仕組み](../../docs/audio/synthesis.md)
- [出力とゲーム統合](../../docs/audio/output-and-game-integration.md)

LLM エージェント向け手順は
[audio-generation スキル](../../.rulesync/skills/audio-generation/SKILL.md) が正本です。

## 楽譜・出典

XinOne 向けに作成した MML/ABC 楽譜は `tools/sound/scores/` に置きます。
生成したアセットの出典・ライセンスは `licenses/audio/` を参照してください。

## ライセンス

`sfx_generator.py` 自体のライセンス表記は [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)
および [licenses/third_party/OnGen-LICENSE.txt](../../licenses/third_party/OnGen-LICENSE.txt)
を参照してください。
