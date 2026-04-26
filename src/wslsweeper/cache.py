import time
from collections import OrderedDict

_CACHE: OrderedDict[str, tuple[dict, float]] = OrderedDict()
_CACHE_MAX_SIZE = 64
_CACHE_TTL = 300  # 5 minutes


def get_cached(path: str) -> dict | None:
    if path not in _CACHE:
        return None
    data, ts = _CACHE[path]
    if time.time() - ts > _CACHE_TTL:
        del _CACHE[path]
        return None
    _CACHE.move_to_end(path)
    return data


def set_cached(path: str, data: dict) -> None:
    _CACHE[path] = (data, time.time())
    _CACHE.move_to_end(path)
    if len(_CACHE) > _CACHE_MAX_SIZE:
        _CACHE.popitem(last=False)


def invalidate(path: str) -> None:
    keys = list(_CACHE.keys())
    for k in keys:
        if k == path or k.startswith(path + "/"):
            del _CACHE[k]
