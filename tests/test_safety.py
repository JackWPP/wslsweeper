import pytest

from wslsweeper.safety import (
    is_protected_path,
    generate_confirm_token,
    verify_confirm_token,
    validate_deletion,
)


def test_protected_paths():
    protected = ["/usr", "/etc", "/bin", "/sbin", "/lib", "/boot", "/proc", "/sys", "/dev", "/root"]
    for path in protected:
        assert is_protected_path(path) is True, f"{path} should be protected"


def test_protected_subpaths():
    assert is_protected_path("/usr/lib/python3") is True
    assert is_protected_path("/etc/systemd") is True


def test_unprotected_paths():
    assert is_protected_path("/home/user/tmp") is False
    assert is_protected_path("/tmp/wslsweeper") is False


def test_token_generation_and_verification():
    path = "/tmp/testfile"
    token = generate_confirm_token(path)
    assert verify_confirm_token(path, token) is True


def test_token_wrong_path():
    token = generate_confirm_token("/tmp/testfile")
    assert verify_confirm_token("/tmp/otherfile", token) is False


def test_token_malformed():
    assert verify_confirm_token("/tmp/test", "invalid") is False
    assert verify_confirm_token("/tmp/test", "12345:abc") is False


def test_validate_deletion_unprotected():
    import tempfile
    import os
    with tempfile.NamedTemporaryFile(delete=False) as f:
        path = f.name
    try:
        deletable, warning, token = validate_deletion(path)
        assert deletable is True
        assert token is not None
    finally:
        os.unlink(path)


def test_validate_deletion_protected():
    deletable, warning, token = validate_deletion("/usr")
    assert deletable is False
    assert token is None