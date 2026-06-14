# XinOne

Phaser 3 と Tauri 2 で作られた、複数ゲーム対応のデスクトップゲームランチャーです。
現在は、難易度選択付きのマインスイーパー、Spot Hockey、Cosmic Breakoutを収録しています。

**Web 版（ブラウザでプレイ）**: [https://kavao.github.io/XinOne/](https://kavao.github.io/XinOne/)

**Windows 版（デスクトップ）**: [Releases からダウンロード](https://github.com/kavao/XinOne/releases/latest)

## スクリーンショット

### ランチャー

![XinOne ランチャー — 3つのゲームから選んでプレイ](images/shot04.webp)

星空を背景に、収録ゲームをカードから選んで起動します。

### マインスイーパー

![マインスイーパー — Beginner 難易度のプレイ画面](images/shot02.webp)

左クリックでセルを開き、右クリックで旗を立てて地雷原をクリアします。

### Spot Hockey

![Spot Hockey — CPU 対戦のプレイ画面](images/shot01.webp)

マウスでパドルを操作し、中央スポットでパックを加速させながら5点先取で勝利を目指します。

### Cosmic Breakout

![Cosmic Breakout — Stage 1 Liftoff のプレイ画面](images/shot03.webp)

全5ステージのブロックを崩し、ステージごとの宇宙船イラストとアイテムが登場します。

## 必要環境

- Node.js 20 以降
- npm 10 以降
- Rust と Cargo
- Tauri 2 が要求する OS 別のビルド依存関係

Windows では Microsoft C++ Build Tools と WebView2 が必要です。

## セットアップ

```powershell
npm install
```

## 起動

Tauri デスクトップアプリとして起動:

```powershell
npm run dev
```

Web ブラウザだけでフロントエンドを確認:

```powershell
npm run vite-dev
```

## 操作

- ランチャーのゲームカードをクリックするとゲームを開始します。
- マインスイーパーは左クリックでセルを開き、右クリックで旗を切り替えます。
- Spot Hockeyはマウス移動で左側の水色パドルを操作し、右側のCPUゴールを狙います。両パドルはゴール寄りのラインから開始し、中央スポットへパックを当てると2秒間だけ速度が倍になります。
- Spot HockeyはCPU難易度を3段階から選べます。先に5点取ると勝利です。
- Cosmic Breakoutはマウス移動でパドルを操作し、中央の正方形フィールドでブロックを崩します。全5ステージあり、4面ではアイテム（マルチボール・パドル拡大・貫通・レーザー）が出現します。
- ゲーム中は画面右端の `II` ボタンでポーズし、`>` ボタンで再開します。ポーズ中はゲーム進行とBGMが停止します。
- `Launcher` ボタンでランチャーへ戻ります。
- Tauriデスクトップ版では、`Fullscreen` または `Full` ボタンでフルスクリーンを切り替えます。Web版にはフルスクリーンボタンを表示しません。

## テストと型検査

```powershell
npm test
npm run typecheck
```

## コンパイル

Web フロントエンドのみ:

```powershell
npm run vite-build
```

Tauri デスクトップアプリ:

```powershell
npm run build
```

Windows のインストーラーなどは、ビルド成功後に
`apps/desktop/src-tauri/target/release/bundle/` 以下へ生成されます。

## GitHub Pages（Web 版）

Web フロントエンドは GitHub Pages で公開できます。Tauri 版と同じゲーム内容をブラウザでプレイできます。

- 公開 URL: [https://kavao.github.io/XinOne/](https://kavao.github.io/XinOne/)
- `main` への push で [Deploy GitHub Pages](.github/workflows/pages.yml) ワークフローが自動デプロイします。
- 初回のみ、GitHub リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定してください。
- 設定後に workflow が 404 で失敗した場合は、Actions から **Re-run all jobs** で再実行してください。

詳細は [docs/github-pages.md](docs/github-pages.md) を参照してください。

## GitHub Releases（Windows 版）

Windows 向けインストーラー（`.exe` / `.msi`）は GitHub Releases で配布します。

- ダウンロード: [Releases（最新版）](https://github.com/kavao/XinOne/releases/latest)
- `v*` タグを push するか、Actions から [Release Windows](.github/workflows/release-windows.yml) ワークフローを手動実行するとビルド・公開されます。

詳細は [docs/github-release.md](docs/github-release.md) を参照してください。

## 構成

```text
apps/desktop             Tauri シェルとゲームランチャー
packages/game-contracts  ゲームが実装する共通契約
packages/game-runtime    起動、終了、ポーズ、フルスクリーンなどの共通処理
games/minesweeper        独立したマインスイーパーゲーム
games/hockey             独立したマウス操作ホッケーゲーム
games/breakout           独立したブロック崩しゲーム(全5ステージ)
```

ゲーム追加手順は [docs/adding-a-game.md](docs/adding-a-game.md) を参照してください。
