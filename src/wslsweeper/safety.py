import hashlib
import hmac
import os
import secrets
import time

PROTECTED_PATHS = frozenset({
    "/usr", "/etc", "/bin", "/sbin", "/lib", "/lib32", "/lib64",
    "/boot", "/proc", "/sys", "/dev", "/snap",
})

_SERVER_SECRET: str | None = None
_TOKEN_MAX_AGE = 300  # 5 minutes


def _get_server_secret() -> str:
    global _SERVER_SECRET
    if _SERVER_SECRET is None:
        _SERVER_SECRET = secrets.token_hex(32)
    return _SERVER_SECRET


def is_protected_path(path: str) -> bool:
    resolved = os.path.realpath(path)
    for protected in PROTECTED_PATHS:
        if resolved == protected or resolved.startswith(protected + "/"):
            return True
    return False


def needs_sudo_for_path(path: str) -> bool:
    if os.geteuid() == 0:
        return False
    real = os.path.realpath(path)
    parent = os.path.dirname(real)
    return not os.access(parent, os.W_OK)


def generate_confirm_token(path: str) -> str:
    secret = _get_server_secret()
    timestamp = str(int(time.time()))
    payload = f"{path}:{timestamp}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{timestamp}:{sig}"


def verify_confirm_token(path: str, token: str) -> bool:
    parts = token.split(":", 1)
    if len(parts) != 2:
        return False
    timestamp_str, received_sig = parts
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False
    if abs(time.time() - timestamp) > _TOKEN_MAX_AGE:
        return False
    secret = _get_server_secret()
    payload = f"{path}:{timestamp_str}"
    expected_sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, received_sig)


def validate_deletion(path: str) -> tuple[bool, str | None, str | None, bool]:
    """Returns (is_deletable, warning_message, confirm_token, needs_sudo)."""
    if not os.path.exists(path):
        return False, f"路径 {path} 不存在", None, False
    if is_protected_path(path):
        return False, f"路径 {path} 受系统保护，无法删除", None, False
    needs_sudo = needs_sudo_for_path(path)
    token = generate_confirm_token(path)
    return True, f"即将删除: {path}。此操作不可撤销。", token, needs_sudo
