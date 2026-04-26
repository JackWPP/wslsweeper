import glob
import os
import time

from wslsweeper.scanner import _calc_dir_size
from wslsweeper.safety import is_protected_path

_CLEANUP_PATTERNS = {
    "pip_cache": ["/root/.cache/pip", "/home/*/.cache/pip"],
    "npm_cache": ["/root/.npm", "/home/*/.npm"],
    "apt_cache": ["/var/cache/apt/archives"],
    "vscode_server": ["/root/.vscode-server", "/home/*/.vscode-server"],
    "qoder_server": ["/root/.qoder-server", "/home/*/.qoder-server"],
    "cache_dir": ["/root/.cache", "/home/*/.cache"],
    "yarn_cache": ["/root/.yarn/cache", "/home/*/.yarn/cache"],
    "conda_cache": ["/root/.conda/pkgs", "/home/*/.conda/pkgs"],
    "docker": ["/var/lib/docker"],
}

# 4 months in seconds
_STALE_THRESHOLD = 4 * 30 * 24 * 3600

_LABEL_NAMES = {
    "pip_cache": "pip 缓存",
    "npm_cache": "npm 缓存",
    "apt_cache": "apt 缓存",
    "vscode_server": "VS Code Server",
    "qoder_server": "Qoder Server",
    "cache_dir": "用户缓存",
    "yarn_cache": "yarn 缓存",
    "conda_cache": "conda 缓存",
    "docker": "Docker 数据",
    "node_modules": "node_modules",
}

_LABEL_ICONS = {
    "pip_cache": "🐍",
    "npm_cache": "📦",
    "apt_cache": "📦",
    "vscode_server": "💻",
    "qoder_server": "🤖",
    "cache_dir": "🗑️",
    "yarn_cache": "📦",
    "conda_cache": "🐍",
    "docker": "🐳",
    "node_modules": "📦",
}


_CACHE_DIR_NAMES = {"node_modules", ".cache", ".npm", ".yarn", ".conda", ".vscode-server", ".qoder-server"}


def _add_suggestion(suggestions: list, seen: set, path: str, label: str, size: int, mtime: float) -> None:
    if path in seen:
        return
    seen.add(path)
    age_days = (time.time() - mtime) / 86400
    is_stale = time.time() - mtime > _STALE_THRESHOLD
    reason = "可安全清理的缓存" if not is_stale else "超过 4 个月未使用"
    suggestions.append({
        "path": path,
        "label": label,
        "name": _LABEL_NAMES.get(label, label),
        "icon": _LABEL_ICONS.get(label, "📁"),
        "size": size,
        "age_days": round(age_days, 1),
        "reason": reason,
    })


def find_cleanup_suggestions() -> list[dict]:
    suggestions = []
    seen = set()

    # 固定模式路径（全局扫描所有用户）
    for label, patterns in _CLEANUP_PATTERNS.items():
        for pattern in patterns:
            for expanded in glob.glob(pattern):
                if not os.path.exists(expanded):
                    continue
                try:
                    size = _calc_dir_size(expanded)
                    mtime = os.path.getmtime(expanded)
                except (OSError, PermissionError):
                    continue
                if size > 100 * 1024 * 1024:
                    _add_suggestion(suggestions, seen, expanded, label, size, mtime)
                elif time.time() - mtime > _STALE_THRESHOLD and size > 10 * 1024 * 1024:
                    _add_suggestion(suggestions, seen, expanded, label, size, mtime)

    # 全局扫描 node_modules（所有 home 目录）
    for home_pattern in ["/root", "/home/*"]:
        for home in glob.glob(home_pattern):
            if not os.path.isdir(home):
                continue
            for root, dirs, files in os.walk(home):
                if "node_modules" in dirs:
                    nm = os.path.join(root, "node_modules")
                    try:
                        size = _calc_dir_size(nm)
                        mtime = os.path.getmtime(nm)
                    except (OSError, PermissionError):
                        dirs.remove("node_modules")
                        continue
                    if size > 50 * 1024 * 1024:
                        is_stale = time.time() - mtime > _STALE_THRESHOLD
                        reason = "超过 4 个月未使用" if is_stale else "大型依赖目录"
                        _add_suggestion(suggestions, seen, nm, "node_modules", size, mtime)
                    dirs.remove("node_modules")
                if root.count(os.sep) - home.count(os.sep) > 4:
                    dirs[:] = []

    suggestions.sort(key=lambda x: -x["size"])
    return suggestions[:50]


def find_context_cleanup_suggestions(path: str) -> list[dict]:
    """基于当前浏览路径的上下文清理推荐。"""
    suggestions = []
    seen = set()

    if not os.path.isdir(path):
        return suggestions
    if is_protected_path(path):
        return suggestions

    try:
        entries = list(os.scandir(path))
    except (OSError, PermissionError):
        return suggestions

    for entry in entries:
        if not entry.is_dir(follow_symlinks=False):
            continue
        if entry.path.startswith("/mnt"):
            continue
        if is_protected_path(entry.path):
            continue

        try:
            size = _calc_dir_size(entry.path)
            mtime = os.path.getmtime(entry.path)
        except (OSError, PermissionError):
            continue

        age_days = (time.time() - mtime) / 86400
        is_stale = time.time() - mtime > _STALE_THRESHOLD

        # 识别已知缓存目录名
        label = None
        if entry.name == "node_modules":
            label = "node_modules"
        elif entry.name == ".cache":
            label = "cache_dir"
        elif entry.name == ".npm":
            label = "npm_cache"
        elif entry.name == ".vscode-server":
            label = "vscode_server"
        elif entry.name == ".qoder-server":
            label = "qoder_server"
        elif entry.name == ".yarn":
            label = "yarn_cache"
        elif entry.name == ".conda":
            label = "conda_cache"
        elif entry.name == ".pip":
            label = "pip_cache"
        else:
            label = "large_dir"

        # 只推荐有意义的大目录
        if size > 100 * 1024 * 1024:
            if label == "large_dir":
                reason = "超过 4 个月未使用" if is_stale else "占用空间较大"
            else:
                reason = "超过 4 个月未使用" if is_stale else "可安全清理的缓存"
            _add_suggestion(suggestions, seen, entry.path, label, size, mtime)
        elif is_stale and size > 50 * 1024 * 1024:
            reason = "超过 4 个月未使用"
            _add_suggestion(suggestions, seen, entry.path, label, size, mtime)

    suggestions.sort(key=lambda x: -x["size"])
    return suggestions[:20]
