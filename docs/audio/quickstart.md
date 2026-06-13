# クイックスタート

このガイドを読むと、OnGen 由来の音源生成ツールをセットアップし、プリセット効果音の生成、その場再生、MMLからのBGM生成までを一通り実行できます。

## 前提

- `uv` が利用できること（`uv run python ...` で実行する）
- プロジェクトルートで作業すること

## 1. 依存関係のインストール

`numpy` / `scipy` は `pyproject.toml` に登録済みです。初回実行時に `uv` が自動でインストールします。

```bash
uv sync
```

MP3 / OGG を出力する場合は [ffmpeg](https://ffmpeg.org/download.html) を別途インストールし、PATH に追加します。`--play` でその場再生する場合は `ffplay`（ffmpeg 同梱）も PATH に必要です。

```bash
ffmpeg -version
ffplay -version
```

## 2. プリセット効果音を生成する

内蔵プリセットからコイン取得音を WAV で生成します。

```bash
uv run python tools/sound/sfx_generator.py --preset coin -o output/quickstart/coin
```

実行後、`output/quickstart/coin.wav` が作成されます。コンソールに長さとイベント数が表示されれば成功です。

## 3. その場で再生する

`ffplay` が使える環境では、生成と同時に再生できます。

```bash
uv run python tools/sound/sfx_generator.py --preset coin --play
```

`--play` が使えない環境では、手順 2 の WAV をメディアプレーヤーで開いてください。

## 4. MML から BGM を生成する

MML 文字列を直接渡してチップチューン風メロディを生成します。

```bash
uv run python tools/sound/sfx_generator.py --input "O4 L4 T120 C D E G" --style square -o output/quickstart/melody
```

実行後、`output/quickstart/melody.wav` が作成されます。

## 5. 次に読むガイド

- プリセット一覧や効果音の調整は [効果音（SFX）](sfx.md) を参照してください。
- 楽譜（MML/ABC）や複数トラックは [BGMと楽譜](bgm-and-scores.md) を参照してください。
- ゲームへ組み込むときは [出力とゲーム統合](output-and-game-integration.md) を参照してください。
