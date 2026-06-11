# ゲーム追加手順

## 概要

ゲームは `games/<game-id>/` に置く独立した npm workspace として追加します。
ランチャーや他ゲームの実装を直接 import せず、`@xinone/game-contracts` の公開契約だけを使用します。

## 必須構成

```text
games/example/
  package.json
  src/
    index.ts
    scenes/
```

`src/index.ts` から `GameDefinition` を公開します。

```ts
import type { GameDefinition } from '@xinone/game-contracts';

export const exampleDefinition: GameDefinition = {
  id: 'example',
  title: 'Example',
  description: 'Example game',
  accentColor: 0x65d8ff,
  startScene: 'example:start',
  scenes: [ExampleScene],
};
```

シーンキーとアセットキーにはゲーム ID を接頭辞として付け、他ゲームとの衝突を防いでください。

## ランチャーへの登録

`apps/desktop/src/registry.ts` で定義を import し、`gameDefinitions` 配列へ追加します。

## 共通ランタイム

ゲーム開始時のシーンデータには `runtime` が渡されます。

- `runtime.returnToLauncher()` でゲームを終了してランチャーへ戻る
- `runtime.toggleFullscreen()` でフルスクリーンを切り替える

ゲームから Tauri API やランチャー内部を直接呼び出さないでください。

## 確認

```powershell
npm test
npm run typecheck
npm run vite-build
```
