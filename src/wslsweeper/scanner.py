import asyncio
import os
import stat
import time
from concurrent.futures import ThreadPoolExecutor, wait

from wslsweeper.safety import is_protected_path

_executor = ThreadPoolExecutor(max_workers=4)
_size_executor = ThreadPoolExecutor(max_workers=8)

_DIR_SIZE_TIMEOUT = 15
_PSEUDO_FILESYSTEMS = frozenset({"/proc", "/sys", "/dev"})


def _calc_dir_size(path: str) -> int:
    if path in _PSEUDO_FILESYSTEMS:
        return 0
    total = 0
    try:
        root_dev = os.lstat(path).st_dev
    except (OSError, PermissionError):
        return 0

    try:
        for dirpath, dirnames, filenames in os.walk(path, followlinks=False):
            try:
                current_dev = os.lstat(dirpath).st_dev
                if current_dev != root_dev:
                    dirnames[:] = []
                    continue
            except (OSError, PermissionError):
                pass

            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except (OSError, PermissionError):
                    pass

            # prune mount points
            i = 0
            while i < len(dirnames):
                sub = os.path.join(dirpath, dirnames[i])
                try:
                    if os.lstat(sub).st_dev != root_dev:
                        dirnames.pop(i)
                        continue
                except (OSError, PermissionError):
                    pass
                i += 1
    except (OSError, PermissionError):
        pass
    return total


def _scan_skeleton(path: str) -> dict:
    children = []
    total_size = 0
    start = time.monotonic()

    try:
        entries = list(os.scandir(path))
    except PermissionError:
        return {"path": path, "total_size": 0, "total_recursive_size": 0,
                "children": [], "is_protected": is_protected_path(path),
                "scan_time_ms": 0, "error": "权限不足，无法扫描此目录"}
    except FileNotFoundError:
        return {"path": path, "total_size": 0, "total_recursive_size": 0,
                "children": [], "is_protected": False,
                "scan_time_ms": 0, "error": "目录不存在"}

    for entry in entries:
        try:
            st = entry.stat(follow_symlinks=False)
            is_dir = entry.is_dir(follow_symlinks=False)
            size = 0
            child_count = None

            if is_dir:
                try:
                    child_count = sum(1 for _ in os.scandir(entry.path))
                except (PermissionError, OSError):
                    child_count = 0
            else:
                size = st.st_size

            mod_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime))
            perm = stat.filemode(st.st_mode)

            children.append({
                "name": entry.name,
                "path": entry.path,
                "is_dir": is_dir,
                "size": size,
                "recursive_size": 0,
                "is_protected": is_protected_path(entry.path),
                "is_hidden": entry.name.startswith("."),
                "mod_time": mod_time,
                "permissions": perm,
                "child_count": child_count,
            })
            total_size += size
        except (PermissionError, OSError):
            continue

    children.sort(key=lambda x: (not x["is_dir"], -x["size"]))
    elapsed = (time.monotonic() - start) * 1000
    return {
        "path": path,
        "total_size": total_size,
        "total_recursive_size": 0,
        "children": children,
        "is_protected": is_protected_path(path),
        "scan_time_ms": round(elapsed, 1),
    }


async def scan_directory_progressive(path: str):
    """
    异步生成器，yield 扫描进度事件：
    - {"type": "skeleton", "data": ScanResponse}       骨架数据（毫秒级返回）
    - {"type": "update", "path": ..., "recursive_size": ..., "total_recursive_size": ...}  单个目录完成
    - {"type": "done"}                                    全部完成
    """
    skeleton = _scan_skeleton(path)
    yield {"type": "skeleton", "data": skeleton}

    dir_entries = [c for c in skeleton["children"] if c["is_dir"]]
    loop = asyncio.get_running_loop()

    for entry in dir_entries:
        rsize = await loop.run_in_executor(_size_executor, _calc_dir_size, entry["path"])
        entry["recursive_size"] = rsize
        total_recursive = sum(c["recursive_size"] for c in skeleton["children"])
        yield {
            "type": "update",
            "path": entry["path"],
            "name": entry["name"],
            "recursive_size": rsize,
            "total_recursive_size": total_recursive,
        }

    yield {"type": "done"}


def _sync_scan(path: str) -> dict:
    """阻塞式完整扫描（保留旧 API 兼容）。"""
    children = []
    total_size = 0
    start = time.monotonic()

    try:
        entries = list(os.scandir(path))
    except PermissionError:
        return {"path": path, "total_size": 0, "total_recursive_size": 0,
                "children": [], "is_protected": is_protected_path(path),
                "scan_time_ms": 0, "error": "权限不足，无法扫描此目录"}
    except FileNotFoundError:
        return {"path": path, "total_size": 0, "total_recursive_size": 0,
                "children": [], "is_protected": False,
                "scan_time_ms": 0, "error": "目录不存在"}

    for entry in entries:
        try:
            st = entry.stat(follow_symlinks=False)
            is_dir = entry.is_dir(follow_symlinks=False)
            size = 0
            child_count = None

            if is_dir:
                try:
                    child_count = sum(1 for _ in os.scandir(entry.path))
                except (PermissionError, OSError):
                    child_count = 0
            else:
                size = st.st_size

            mod_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime))
            perm = stat.filemode(st.st_mode)

            children.append({
                "name": entry.name,
                "path": entry.path,
                "is_dir": is_dir,
                "size": size,
                "recursive_size": 0,
                "is_protected": is_protected_path(entry.path),
                "is_hidden": entry.name.startswith("."),
                "mod_time": mod_time,
                "permissions": perm,
                "child_count": child_count,
            })
            total_size += size
        except (PermissionError, OSError):
            continue

    dir_children = [c for c in children if c["is_dir"]]
    if dir_children:
        futures = {_size_executor.submit(_calc_dir_size, c["path"]): c["path"]
                   for c in dir_children}
        done, pending = wait(futures, timeout=_DIR_SIZE_TIMEOUT)

        for future in done:
            dir_path = futures[future]
            try:
                rsize = future.result()
            except Exception:
                rsize = 0
            for c in children:
                if c["path"] == dir_path and c["is_dir"]:
                    c["recursive_size"] = rsize
                    break

        for future in pending:
            dir_path = futures[future]
            future.cancel()
            try:
                c["recursive_size"] = _calc_dir_size(dir_path)
            except Exception:
                pass

        for c in dir_children:
            if c["recursive_size"] == 0:
                try:
                    c["recursive_size"] = _calc_dir_size(c["path"])
                except Exception:
                    pass

    for c in children:
        if not c["is_dir"]:
            c["recursive_size"] = c["size"]

    total_recursive_size = sum(c["recursive_size"] for c in children)
    children.sort(key=lambda x: (not x["is_dir"], -x["recursive_size"]))

    elapsed = (time.monotonic() - start) * 1000
    return {
        "path": path,
        "total_size": total_size,
        "total_recursive_size": total_recursive_size,
        "children": children,
        "is_protected": is_protected_path(path),
        "scan_time_ms": round(elapsed, 1),
    }


async def scan_directory(path: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _sync_scan, path)
