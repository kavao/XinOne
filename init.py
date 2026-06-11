from pathlib import Path

WORKSPACE_DIRS = [
    "_workingspace/log",
    "_workingspace/diary",
    "_workingspace/plans",
]


def init() -> None:
    print("dna_kernel — 初期セットアップ")
    print()

    print("_workingspace/ ディレクトリを確認します...")
    for d in WORKSPACE_DIRS:
        path = Path(d)
        if not path.exists():
            path.mkdir(parents=True)
            (path / ".gitkeep").touch()
            print(f"  作成: {d}/")
        else:
            print(f"  確認: {d}/ (存在)")

    print()
    print("セットアップ完了。以下のツールが使えます:")
    print("  uv run python tools/kernel/workspace_audit_log.py append '本文'")
    print("  uv run python tools/kernel/json_weighted_pick.py <file.json> -p <path>")
    print()
    print("ルールを各 LLM ツールへ反映するには:")
    print("  npx rulesync generate")


if __name__ == "__main__":
    init()
