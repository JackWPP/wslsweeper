from pydantic import BaseModel


class ScanEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    recursive_size: int = 0
    is_protected: bool
    is_hidden: bool
    mod_time: str
    permissions: str
    child_count: int | None = None


class ScanResponse(BaseModel):
    path: str
    total_size: int
    total_recursive_size: int = 0
    children: list[ScanEntry]
    is_protected: bool
    scan_time_ms: float
    error: str | None = None


class ScanUpdate(BaseModel):
    type: str
    path: str | None = None
    name: str | None = None
    recursive_size: int | None = None
    total_recursive_size: int | None = None
    data: ScanResponse | None = None


class DiskInfo(BaseModel):
    total: int
    used: int
    available: int
    percent: float
    mount_point: str


class MountInfo(BaseModel):
    mount_point: str
    total: int
    used: int
    available: int
    percent: float
    filesystem: str = ""


class DeleteRequest(BaseModel):
    path: str
    confirm_token: str


class DeleteResponse(BaseModel):
    success: bool
    freed_bytes: int
    message: str


class ValidateResponse(BaseModel):
    path: str
    exists: bool
    is_protected: bool
    is_deletable: bool
    confirm_token: str | None = None
    warning: str | None = None
