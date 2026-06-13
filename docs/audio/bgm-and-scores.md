# BGMと楽譜

このガイドを読むと、MML/ABC からの生成、収録曲の利用、複数トラックのミックスができます。

## MML から生成

MML 文字列を直接渡して生成します。

```bash
uv run python tools/sound/sfx_generator.py --input "O4 L4 T120 C D E G" --style square -o output/bgm/melody
```

## ABC から生成

ABC 記譜をファイルまたは文字列で渡します。独自の ABC ファイルを使う場合は、実在するパスへ置き換えてください（`score.abc` はプレースホルダー名です）。

```bash
uv run python tools/sound/sfx_generator.py --input-file path/to/your_score.abc --format abc -o output/bgm/from_file
```

## XinOne の楽譜

XinOne 用に作成した MML/ABC 楽譜は `scores/` に置きます。各BGM/SFXをどの楽譜・コマンドで生成したかは `licenses/audio/**/*.json` の `generation` フィールドに記録します。

## 複数トラック（PPMCK形式・CLI）

### MML 内トラック宣言（フェーズ3）

1つの `.mml` ファイルに `A`〜`E` のトラック宣言を書くと、自動でミックスされます。

```text
A @1 V12 O4 L4 T120
C4 E4 G4
B @2 V10 O4 L8
E8 G8 C8
C V8 O3 L2
C2 G2 E2
```

| PPMCKチャンネル | OnGen 波形 | 備考 |
|----------------|------------|------|
| A, B | square | `@0`〜`@3` でデューティ比（12.5% / 25% / 50% / 75%） |
| C | triangle | |
| D, E | noise | E（DPCM）はノイズ代替。サンプルは `W(...)` を使用 |

裸の `A C4 D4` や `C D E F` は従来どおり単一トラックの音符列として解釈します。複数トラックとして確実に認識させるには、異なるチャンネルを2つ以上宣言するか、`AB` の複数文字宣言、または `A @1 ...` のようにチャンネル設定を続けてください。

最初のトラック宣言より前に書いた `T120 L8` などのMML設定は、すべてのトラックへ共通適用されます。

### CLI の `--track` / `--track-file`

別ファイルや追加パートを重ねる場合は CLI フラグを使います。

```bash
uv run python tools/sound/sfx_generator.py --input-file path/to/melody.abc --format abc --track-file path/to/bass.abc --style sine -o output/bgm/duet
```

`--track-style` は、MML内トラックではなく `--track` / `--track-file` の順に波形（square/sawtooth/triangle/sine/noise）を上書きします。ADSR・FM・LFO は全トラック共通です。

## MML の書き方

コマンド一覧と PPMCK/MCK 互換は [MMLリファレンス](mml-reference.md) を参照してください。

## 正本の扱い

- 楽譜ファイル（MML/ABC）を正本として残してください。
- `output/` の音声だけを編集して完了にしないでください。再生成可能なコマンドまたは楽譜を記録してください。
