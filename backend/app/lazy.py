"""Import a heavy module on first use instead of at startup."""
from __future__ import annotations

import importlib
from types import ModuleType


class LazyModule:
    """Stands in for a module until one of its attributes is used.

    SciPy takes over a second to import. Only the DSP needs it, so a server
    that starts cold for a leaderboard or sign-in request does not wait for it.
    """

    def __init__(self, name: str) -> None:
        self._name = name
        self._module: ModuleType | None = None

    def __getattr__(self, attr: str):
        if self._module is None:
            self._module = importlib.import_module(self._name)
        return getattr(self._module, attr)
