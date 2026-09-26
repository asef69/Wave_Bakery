"""Tests for the direct DSP FastAPI router (/api/dsp)."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_generate_signal():
    res = client.post('/api/dsp/generate', json={
        'waveform': 'sine',
        'frequency': 440.0,
        'amplitude': 1.0,
        'duration_s': 0.1,
        'sample_rate': 22050,
    })
    assert res.status_code == 200
    data = res.json()
    assert data['waveform'] == 'sine'
    assert data['frequency'] == 440.0
    assert len(data['samples']) > 0
    assert len(data['spectrum_db']) > 0
    assert data['peak'] > 0.5


def test_generate_complex_noisy():
    res = client.post('/api/dsp/generate', json={
        'waveform': 'complex_noisy',
        'frequency': 220.0,
        'noise_level': 0.3,
        'duration_s': 0.1,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data['samples']) > 0


def test_filter_signal():
    # Generate noisy sine first
    gen_res = client.post('/api/dsp/generate', json={
        'waveform': 'complex_noisy',
        'frequency': 220.0,
        'duration_s': 0.05,
    })
    samples = gen_res.json()['samples']

    res = client.post('/api/dsp/filter', json={
        'samples': samples,
        'filter_type': 'lowpass',
        'cutoff': 400.0,
        'order': 4,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data['filtered_samples']) == len(samples)
    assert len(data['response_curve']) > 0


def test_mix_signals():
    t1 = [1.0, 0.5, -0.5, -1.0] * 20
    t2 = [0.2, 0.4, 0.6, 0.8] * 20
    res = client.post('/api/dsp/mix', json={
        'tracks': [t1, t2],
        'weights': [1.0, 0.5],
        'normalize': True,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data['mixed_samples']) == len(t1)
    assert data['peak'] <= 1.05


def test_transform_signal():
    samples = [1.0, 0.5, 0.0, -0.5, -1.0] * 10
    res = client.post('/api/dsp/transform', json={
        'samples': samples,
        'amplitude_scale': 1.5,
        'time_scale': 1.2,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data['transformed_samples']) > len(samples)


def test_convolve_signal():
    samples = [1.0, 0.0, -1.0, 0.0] * 10
    res = client.post('/api/dsp/convolve', json={
        'input_samples': samples,
        'impulse_type': 'oven',
        'convolution_depth': 1.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data['convolved_samples']) == len(samples)
    assert len(data['impulse_samples']) > 0


def test_critique_evaluation():
    res = client.post('/api/dsp/critique', json={
        'recipe_id': 'burger',
        'similarity': 94.5,
        'filtering_accuracy': 95.0,
        'mixing_accuracy': 92.0,
        'seasoning_accuracy': 90.0,
        'marinating_accuracy': 90.0,
        'cooking_accuracy': 96.0,
        'delivery_accuracy': 98.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data['reaction'] == 'ecstatic'
    assert len(data['diagnostics']) >= 5
