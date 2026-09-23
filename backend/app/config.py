"""Application settings."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv('WK_DATABASE_URL', f'sqlite:///{BASE_DIR / "wavekitchen.db"}')
CORS_ORIGINS = os.getenv(
    'WK_CORS_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,*'
).split(',')

API_PREFIX = '/api'
APP_NAME = 'WaveKitchen API'
APP_VERSION = '1.0.0'

# gameplay tuning that lives on the server, not in the client
PREP_ACCEPT_THRESHOLD = 45.0     # a dirtier ingredient cannot enter the bowl
TIER_UNLOCK_SCORE = 60.0         # score needed to count towards unlocking
TIER_UNLOCK_COUNT = 2            # dishes cleared in a tier before the next opens
PLOT_POINTS = 900                # resolution of plot payloads
