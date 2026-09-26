"""Regression tests for the critical security fixes."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app, spa_file


def test_spa_never_serves_files_outside_dist(tmp_path: Path):
    dist = (tmp_path / 'frontend' / 'dist')
    dist.mkdir(parents=True)
    (dist / 'index.html').write_text('INDEX')
    (dist / 'app.js').write_text('JS')
    (tmp_path / 'secret.db').write_text('TOKENS')
    root = dist.resolve()

    assert spa_file(root, 'app.js') == root / 'app.js'
    for evil in ('../../secret.db', r'..\..\secret.db', str(tmp_path / 'secret.db')):
        assert spa_file(root, evil) == root / 'index.html'


def test_cors_has_no_wildcard():
    assert '*' not in config.CORS_ORIGINS


@pytest.fixture(scope='module')
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize('path, body', [
    ('/api/dsp/generate', {'sample_rate': 0}),
    ('/api/dsp/generate', {'sample_rate': -5}),
    ('/api/dsp/generate', {'sample_rate': 10 ** 9}),
    ('/api/dsp/filter', {'samples': [0.1] * 100, 'sample_rate': 0}),
    ('/api/dsp/filter', {'samples': [0.0] * 200_001}),
])
def test_bad_dsp_input_is_rejected_not_crashing(client, path, body):
    assert client.post(path, json=body).status_code == 422


def test_valid_dsp_input_still_works(client):
    assert client.post('/api/dsp/generate', json={'sample_rate': 22050}).status_code == 200
