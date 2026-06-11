# tools（dna_kernel）

自己発展型ルールガバナンスを「実働」させるためのツールです。
`kernel/` にコアツールと拡張例を収めてあります。

## コア（どのプロジェクトにも移植できる）

プロジェクトの種類に関わらず使えるツールです。

- **追記ログ（auditability）**
  - `kernel/workspace_audit_log.py`
  - 追記先: `_workingspace/log/YYYYMM.md`, `_workingspace/diary/YYYYMM.md`
  - 依存: なし（標準ライブラリのみ）
- **重み付き乱数選択（weighted-pick）**
  - `kernel/json_weighted_pick.py`
  - 依存: なし（標準ライブラリのみ）

## 拡張例（小説プロジェクト向けの pre-work-check 実装）

`pre-work-check` パターン（作業前に必須ファイル・ディレクトリを機械確認する）を、
小説プロジェクト向けに実装した例です。

新プロジェクトでは `REQUIRED_FILES` / `REQUIRED_DIRS` を書き換えるか、
独自のチェックスクリプトを作成して同じパターンを適用してください（→ `skills/pre-work-check/SKILL.md`）。

- `kernel/novel_project_check.py` — 作品フォルダの必須ファイル確認（エントリポイント）
  - 依存（import）: `kernel/novel_code_allocate.py`、`kernel/novel_image_layout.py`

## 依存の注意

- `novel_project_check.py` は `novel_code_allocate.py` と `novel_image_layout.py` を import します（3ファイルはセット）。
- `kernel/workspace_audit_log.py` と `kernel/json_weighted_pick.py` は単独で動きます。

