import asyncio
import json
import os
import shutil
import subprocess

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from wslsweeper.api.schemas import (
    CleanupSuggestion,
    DeleteRequest,
    DeleteResponse,
    DiskInfo,
    MountInfo,
    ScanResponse,
    ValidateResponse,
)
from wslsweeper.cache import invalidate
from wslsweeper.safety import (
    is_protected_path,
    needs_sudo_for_path,
    validate_deletion,
    verify_confirm_token,
)
from wslsweeper.scanner import scan_directory, scan_directory_progressive

router = APIRouter()


@router.get("/scan", response_model=ScanResponse)
async def scan(path: str):
    result = await scan_directory(path)
    return result


async def _scan_sse_generator(path: str):
    try:
        async for event in scan_directory_progressive(path):
            yield f"data: {json.dumps(event)}\n\n"
    except asyncio.CancelledError:
        pass


@router.get("/scan-progress")
async def scan_progress(path: str):
    return StreamingResponse(
        _scan_sse_generator(path),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _get_disk_usage(mount_point: str) -> DiskInfo:
    usage = os.statvfs(mount_point)
    total = usage.f_blocks * usage.f_frsize
    available = usage.f_bavail * usage.f_frsize
    used = total - available
    percent = (used / total * 100) if total > 0 else 0
    return DiskInfo(
        total=total,
        used=used,
        available=available,
        percent=round(percent, 1),
        mount_point=mount_point,
    )


@router.get("/disk", response_model=DiskInfo)
async def disk():
    return _get_disk_usage("/")


@router.get("/mounts", response_model=list[MountInfo])
async def mounts():
    result = []
    seen_devices = set()
    try:
        with open("/proc/mounts", "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 2:
                    continue
                device, mount_point = parts[0], parts[1]
                if device in seen_devices:
                    continue
                if mount_point.startswith("/mnt"):
                    continue
                if mount_point != "/":
                    continue
                seen_devices.add(device)
                try:
                    usage = os.statvfs(mount_point)
                    total = usage.f_blocks * usage.f_frsize
                    available = usage.f_bavail * usage.f_frsize
                    used = total - available
                    percent = (used / total * 100) if total > 0 else 0
                    result.append(MountInfo(
                        mount_point=mount_point,
                        total=total,
                        used=used,
                        available=available,
                        percent=round(percent, 1),
                        filesystem=device,
                    ))
                except (OSError, PermissionError):
                    continue
    except (OSError, IOError):
        pass
    if not any(m.mount_point == "/" for m in result):
        root_usage = _get_disk_usage("/")
        result.insert(0, MountInfo(
            mount_point="/",
            total=root_usage.total,
            used=root_usage.used,
            available=root_usage.available,
            percent=root_usage.percent,
            filesystem="",
        ))
    result.sort(key=lambda m: (m.mount_point != "/", m.mount_point))
    return result


@router.get("/validate", response_model=ValidateResponse)
async def validate(path: str):
    exists = os.path.exists(path)
    protected = is_protected_path(path) if exists else False

    if not exists:
        return ValidateResponse(
            path=path, exists=False, is_protected=False,
            is_deletable=False, warning="路径不存在",
        )
    if protected:
        return ValidateResponse(
            path=path, exists=True, is_protected=True,
            is_deletable=False, warning=f"路径 {path} 受系统保护，无法删除",
        )

    is_dir = os.path.isdir(path)
    size = 0
    if is_dir:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    size += os.path.getsize(fp)
                except OSError:
                    pass
    else:
        try:
            size = os.path.getsize(path)
        except OSError:
            pass

    is_deletable, warning, token, needs_sudo = validate_deletion(path)
    return ValidateResponse(
        path=path, exists=True, is_protected=False,
        is_deletable=is_deletable, needs_sudo=needs_sudo,
        confirm_token=token, warning=warning,
    )


@router.post("/delete", response_model=DeleteResponse)
async def delete(req: DeleteRequest):
    if not os.path.exists(req.path):
        raise HTTPException(status_code=404, detail="路径不存在")
    if is_protected_path(req.path):
        raise HTTPException(status_code=403, detail="受保护路径，无法删除")
    if not verify_confirm_token(req.path, req.confirm_token):
        raise HTTPException(status_code=409, detail="确认令牌无效或已过期")

    is_dir = os.path.isdir(req.path)
    size = 0
    if is_dir:
        for dirpath, dirnames, filenames in os.walk(req.path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    size += os.path.getsize(fp)
                except OSError:
                    pass
    else:
        try:
            size = os.path.getsize(req.path)
        except OSError:
            pass

    try:
        if is_dir:
            shutil.rmtree(req.path)
        else:
            os.remove(req.path)
    except PermissionError:
        if req.sudo_password:
            try:
                proc = subprocess.run(
                    ["sudo", "-S", "rm", "-rf", req.path],
                    input=req.sudo_password + "\n",
                    text=True,
                    capture_output=True,
                    timeout=30,
                )
                if proc.returncode == 0:
                    invalidate(os.path.dirname(req.path))
                    return DeleteResponse(
                        success=True,
                        freed_bytes=size,
                        message=f"已成功删除: {req.path}",
                    )
                else:
                    raise HTTPException(status_code=403, detail="sudo 密码错误或权限不足")
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=500, detail="sudo 操作超时")
        else:
            raise HTTPException(status_code=403, detail="权限不足，需要管理员权限")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")

    invalidate(os.path.dirname(req.path))
    return DeleteResponse(
        success=True,
        freed_bytes=size,
        message=f"已成功删除 {'目录' if is_dir else '文件'}: {req.path}",
    )


@router.get("/cleanup-suggestions", response_model=list[CleanupSuggestion])
async def cleanup_suggestions():
    from wslsweeper.cleanup import find_cleanup_suggestions
    return find_cleanup_suggestions()


@router.get("/context-cleanup", response_model=list[CleanupSuggestion])
async def context_cleanup(path: str):
    from wslsweeper.cleanup import find_context_cleanup_suggestions
    return find_context_cleanup_suggestions(path)
