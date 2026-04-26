import pytest
import os
import tempfile

from wslsweeper.scanner import scan_directory


@pytest.mark.asyncio
async def test_scan_empty_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        result = await scan_directory(tmpdir)
        assert result["path"] == tmpdir
        assert result["total_size"] == 0
        assert result["children"] == []


@pytest.mark.asyncio
async def test_scan_with_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        for name, size in [("a.txt", 100), ("b.txt", 200)]:
            path = os.path.join(tmpdir, name)
            with open(path, "wb") as f:
                f.write(b"x" * size)
        result = await scan_directory(tmpdir)
        assert len(result["children"]) == 2
        sizes = {c["name"]: c["size"] for c in result["children"]}
        assert sizes["a.txt"] == 100
        assert sizes["b.txt"] == 200


@pytest.mark.asyncio
async def test_scan_with_subdirectories():
    with tempfile.TemporaryDirectory() as tmpdir:
        subdir = os.path.join(tmpdir, "subdir")
        os.makedirs(subdir)
        with open(os.path.join(subdir, "file.txt"), "w") as f:
            f.write("hello")
        result = await scan_directory(tmpdir)
        children = {c["name"]: c for c in result["children"]}
        assert children["subdir"]["is_dir"] is True
        assert children["file.txt"]["is_dir"] is False


@pytest.mark.asyncio
async def test_scan_nonexistent_path():
    result = await scan_directory("/nonexistent/path/12345")
    assert result["error"] == "目录不存在"


@pytest.mark.asyncio
async def test_hidden_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        open(os.path.join(tmpdir, ".hidden"), "w").close()
        open(os.path.join(tmpdir, "visible"), "w").close()
        result = await scan_directory(tmpdir)
        children = {c["name"]: c for c in result["children"]}
        assert children[".hidden"]["is_hidden"] is True
        assert children["visible"]["is_hidden"] is False