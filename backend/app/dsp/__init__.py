"""WaveKitchen server-side signal processing package."""
from . import core, contamination, instruments, metrics, pipeline, systems  # noqa: F401

SR = core.SR
FRAME = core.FRAME

__all__ = ['core', 'contamination', 'instruments', 'metrics', 'pipeline',
           'systems', 'SR', 'FRAME']
