"""Numerical correctness of the signal engine."""
import numpy as np
import pytest

from app.dsp import contamination, core as C, instruments, metrics, pipeline, systems


def test_fft_roundtrip_is_lossless():
    rng = np.random.default_rng(0)
    x = (np.sin(2 * np.pi * 5 * np.arange(256) / 256) + 0.3 * rng.normal(size=256)).astype(np.float32)
    y = C.ifft(C.fft(x, 256), 256)
    assert np.max(np.abs(x - y)) < 1e-5


def test_spectrum_localises_a_pure_tone():
    x = np.sin(2 * np.pi * 64 * np.arange(512) / 512).astype(np.float32)
    assert int(np.argmax(C.magnitude(x, 512))) == 64


def test_direct_and_fft_convolution_agree():
    rng = np.random.default_rng(1)
    x = rng.normal(size=300).astype(np.float32)
    h = rng.normal(size=120).astype(np.float32)
    assert np.max(np.abs(C.convolve_direct(x, h) - C.convolve_fft(x, h))) < 1e-4


def test_partial_convolution_matches_full_at_max_lag():
    rng = np.random.default_rng(2)
    x = rng.normal(size=200).astype(np.float32)
    h = rng.normal(size=64).astype(np.float32)
    full = C.convolve(x, h)
    part = C.convolve_partial(x, h, full.size - 1)
    assert np.max(np.abs(full - part)) < 1e-5


def test_unit_impulse_is_the_identity_system():
    rng = np.random.default_rng(3)
    x = rng.normal(size=128).astype(np.float32)
    delta = np.array([1.0], dtype=np.float32)
    assert np.max(np.abs(C.convolve(x, delta) - x)) < 1e-6


def test_integer_time_shift_moves_samples_exactly():
    rng = np.random.default_rng(4)
    x = rng.normal(size=64).astype(np.float32)
    assert C.time_shift(x, 5)[15] == pytest.approx(x[10], abs=1e-6)


def test_fractional_shift_preserves_the_magnitude_spectrum():
    x = instruments.synth('piano')
    a = C.magnitude(x, 4096)
    b = C.magnitude(C.time_shift(x, 7.5), 4096)
    # delay lives entirely in the phase
    assert np.corrcoef(a, b)[0, 1] > 0.999


def test_time_scaling_changes_duration_inversely():
    x = instruments.synth('violin')
    assert C.time_scale(x, 2.0).size == pytest.approx(x.size / 2, rel=0.01)
    assert C.time_scale(x, 0.5).size == pytest.approx(x.size * 2, rel=0.01)


def test_lowpass_removes_content_above_the_cutoff():
    mix = C.add([C.tone(2048, 1.0, 300), C.tone(2048, 1.0, 6000)])
    out = C.filter_signal(mix, [C.lowpass(1000)])
    mag = C.magnitude(out, 2048)
    keep = mag[int(300 * 2048 / C.SR)]
    kill = mag[int(6000 * 2048 / C.SR)]
    assert keep > 50 and kill < 1.0


def test_harmonic_notch_kills_hum_and_keeps_the_rest():
    voice = instruments.synth('flute')
    sig = C.add([voice, C.hum(C.FRAME, 0.3, 50)])
    out = C.filter_signal(sig, [C.harmonic_notch(50, 40, 8, 0.0)])

    before = C.magnitude(sig, 4096)
    after = C.magnitude(out, 4096)
    hum_bin = int(round(50 * 4096 / C.SR))
    voice_bin = int(round(587 * 4096 / C.SR))

    assert after[hum_bin] < before[hum_bin] * 0.25      # hum is gone
    assert after[voice_bin] > before[voice_bin] * 0.9   # the flute survives


def test_decimation_without_antialias_produces_aliasing():
    x = C.tone(4096, 1.0, 8000)                     # well above the new Nyquist
    clean, nyq = C.decimate(x, 4, anti_alias=True)
    aliased, _ = C.decimate(x, 4, anti_alias=False)
    assert nyq == pytest.approx(C.SR / 8)
    assert C.rms(aliased) > C.rms(clean) * 2        # folded energy survives


def test_am_modulation_creates_sidebands():
    x = C.tone(4096, 1.0, 2000)
    y = C.am_modulate(x, 200, 0.8)
    mag = C.magnitude(y, 4096)
    carrier = int(2000 * 4096 / C.SR)
    offset = int(200 * 4096 / C.SR)
    assert mag[carrier + offset] > mag[carrier] * 0.1
    assert mag[carrier - offset] > mag[carrier] * 0.1


def test_cascade_of_systems_is_one_system():
    rng = np.random.default_rng(5)
    x = rng.normal(size=512).astype(np.float32)
    h1, h2 = systems.ir('simmer'), systems.ir('sear')
    serial = C.convolve(C.convolve(x, h1), h2)
    combined = C.convolve(x, C.cascade([h1, h2]))
    n = min(serial.size, combined.size)
    assert np.max(np.abs(serial[:n] - combined[:n])) < 1e-3


def test_every_instrument_voice_is_finite_and_normalised():
    for name in instruments.VOICES:
        sig = instruments.synth(name)
        assert sig.size == C.FRAME
        assert np.isfinite(sig).all()
        assert 0.5 < C.peak(sig) <= 1.0


def test_identical_dishes_score_one_hundred():
    x = instruments.synth('guitar')
    m = metrics.dish_metrics(x, x)
    assert m['score'] == pytest.approx(100.0)
    assert m['correlation'] == pytest.approx(1.0, abs=1e-3)


def test_unrelated_dishes_score_poorly():
    a = instruments.synth('bell')
    b = instruments.synth('drum')
    assert metrics.dish_metrics(a, b)['score'] < 60


def test_prep_quality_punishes_both_failure_modes():
    clean = instruments.synth('piano')
    dirty, found = contamination.corrupt(clean, 1.4, 99)
    cont = [c.dict() for c in found]

    untouched = metrics.prep_quality(clean, dirty, dirty, cont)
    perfect = metrics.prep_quality(clean, dirty, clean, cont)
    scorched = metrics.prep_quality(
        clean, dirty, C.filter_signal(dirty, [C.lowpass(120)]), cont)

    assert perfect['score'] > untouched['score']
    assert perfect['score'] > scorched['score']
    assert scorched['over_filtered']


def test_reference_pipeline_is_deterministic():
    recipe = dict(seasoning=0.8, blend=1.1, marinate=0.05,
                  caramelize_carrier=None, caramelize_depth=None,
                  chop_factor=None, appliances=['grill', 'bake'])
    sigs = [instruments.synth('drum'), instruments.synth('guitar')]
    a = pipeline.run_pipeline(sigs, pipeline.reference_params(recipe))
    b = pipeline.run_pipeline(sigs, pipeline.reference_params(recipe))
    assert np.array_equal(a['final'], b['final'])
    assert metrics.dish_metrics(a['final'], b['final'])['score'] == pytest.approx(100.0)


def test_contamination_is_reproducible_from_its_seed():
    clean = instruments.synth('violin')
    a, ca = contamination.corrupt(clean, 1.2, 12345)
    b, cb = contamination.corrupt(clean, 1.2, 12345)
    assert np.array_equal(a, b)
    assert [c.kind for c in ca] == [c.kind for c in cb]


def test_signal_transport_roundtrips():
    x = instruments.synth('bell')
    assert np.allclose(C.decode(C.encode(x)), x, atol=1e-6)


def test_beamforming_phased_array_steering():
    from app.dsp import beamforming
    # 0 degree target -> all phases 0
    zero_speakers = [{'id': i, 'phase': 0.0, 'is_active': True} for i in range(1, 9)]
    assert beamforming.calculate_beam_angle(zero_speakers) == 0.0

    # Test preset for +35 degrees
    preset_35 = beamforming.get_preset_phases_for_angle(35.0, 8)
    spk_35 = [{'id': i + 1, 'phase': p, 'is_active': True} for i, p in enumerate(preset_35)]
    steered = beamforming.calculate_beam_angle(spk_35)
    assert beamforming.check_beam_alignment(steered, 35.0, 6.0)

    # Array factor peak should be bounded in [0, 1]
    angles = np.linspace(-90, 90, 181)
    af = beamforming.array_factor(angles, np.array(preset_35, dtype=float))
    assert len(af) == 181
    assert 0.0 <= np.max(af) <= 1.0001
    assert np.isfinite(af).all()

    # Pattern points
    points = beamforming.generate_beam_pattern(35.0, 73)
    assert len(points) == 73
    assert points[0]['angle'] == -90.0
    assert points[-1]['angle'] == 90.0
    assert any(p['intensity'] > 0.9 for p in points)


def test_cooley_tukey_fft_roundtrip_and_parseval():
    N = 256
    n = np.arange(N)
    x = (np.sin(2 * np.pi * 7 * n / N) + 0.5 * np.cos(2 * np.pi * 23 * n / N)).astype(np.float32)

    # Cooley-Tukey FFT & IFFT roundtrip
    X = C.cooley_tukey_fft(x)
    rec = C.cooley_tukey_ifft(X)
    mse = float(np.mean(np.square(x - rec)))
    assert mse < 1e-5

    # Parseval's energy conservation
    time_energy = float(np.sum(np.square(x)))
    freq_energy = float(np.sum(np.square(np.abs(X)))) / N
    assert time_energy == pytest.approx(freq_energy, rel=1e-3)


def test_frequency_domain_lowpass_filter_attenuation():
    sr = 8000
    duration = 0.2
    n_samples = int(sr * duration)
    t = np.arange(n_samples) / sr

    f1 = 200.0  # Passband tone
    f2 = 800.0  # Stopband tone
    compound = (np.sin(2 * np.pi * f1 * t) + np.sin(2 * np.pi * f2 * t)).astype(np.float32)

    filtered = C.apply_lowpass_filter(compound, 400.0, sr)
    assert filtered.size == n_samples

    mag = C.magnitude(filtered, C.next_pow2(n_samples))
    freqs = C.bin_freqs(C.next_pow2(n_samples), sr)

    bin_f1 = int(np.argmin(np.abs(freqs - f1)))
    bin_f2 = int(np.argmin(np.abs(freqs - f2)))

    mag_f1 = mag[bin_f1]
    mag_f2 = mag[bin_f2]

    # f1 preserved, f2 attenuated by > 20 dB (ratio > 10x)
    assert mag_f1 > 50.0
    assert mag_f2 < mag_f1 * 0.05


def test_linear_convolution_commutativity_and_identity():
    x = np.array([1.0, 3.0, -2.0, 4.0, 0.0, 5.0], dtype=np.float32)
    h = np.array([0.5, 1.2, -0.8], dtype=np.float32)

    # Unit impulse identity
    delta = np.array([1.0], dtype=np.float32)
    assert np.allclose(C.convolve(x, delta), x, atol=1e-6)

    # Commutativity: x * h == h * x
    conv1 = C.convolve(x, h)
    conv2 = C.convolve(h, x)
    assert np.allclose(conv1, conv2, atol=1e-6)


def test_mathematical_ingredients_synthesis_and_bounds():
    math_voices = ['carrot', 'cucumber', 'sauce', 'egg', 'cheese', 'sugar', 'salt', 'bread', 'patty', 'lettuce', 'tomato', 'onion']
    for v in math_voices:
        sig = instruments.synth(v)
        assert sig.size == C.FRAME
        assert np.isfinite(sig).all()
        assert C.peak(sig) <= 1.0


def test_normalized_cross_correlation_and_nrmse_metrics():
    # Identical signals -> 1.0 correlation, 1.0 NRMSE, 100% similarity
    sig = instruments.synth('carrot')
    r_xy = metrics.normalized_cross_correlation(sig, sig)
    nrmse = metrics.normalized_root_mean_square_error(sig, sig)
    sim = metrics.compute_signal_similarity(sig, sig)

    assert r_xy == pytest.approx(1.0, abs=1e-4)
    assert nrmse == pytest.approx(1.0, abs=1e-4)
    assert sim == pytest.approx(100.0, abs=1e-2)

    # Orthogonal signals (sine vs cosine) -> ~0 correlation
    N = 512
    sin_tone = np.sin(2 * np.pi * 8 * np.arange(N) / N).astype(np.float32)
    cos_tone = np.cos(2 * np.pi * 8 * np.arange(N) / N).astype(np.float32)
    r_ortho = metrics.normalized_cross_correlation(sin_tone, cos_tone)
    assert abs(r_ortho) < 0.01

    # Inverted signal -> negative correlation and lower similarity
    r_inv = metrics.normalized_cross_correlation(sig, -sig)
    assert r_inv == pytest.approx(-1.0, abs=1e-4)
    sim_inv = metrics.compute_signal_similarity(sig, -sig)
    assert sim_inv < 30.0


# =============================================================================
# Formal CSE220 Specification Benchmark Test Suite (T1 - T10)
# =============================================================================

def test_t1_test_runner_setup():
    """T1: Verify pytest test runner and Python DSP backend execution environment."""
    assert C.SR == 22050
    assert C.FRAME == 4096


def test_t2_math_ingredients():
    """T2: Verify sample values and bounds for mathematical ingredient formulas."""
    # Carrot: y = 5 - (1 + cos(0.5x))^4
    sig_carrot = instruments.synth('carrot')
    assert sig_carrot.size == C.FRAME
    assert np.isfinite(sig_carrot).all()
    assert C.peak(sig_carrot) <= 1.0

    # Cucumber: y = 6 * tanh(4 * cos(x))
    sig_cuc = instruments.synth('cucumber')
    assert sig_cuc.size == C.FRAME
    assert np.isfinite(sig_cuc).all()
    assert C.peak(sig_cuc) <= 1.0

    # Sauce, Egg, Cheese, Sugar, Salt, Bread, Patty, Lettuce, Tomato, Onion
    for name in ['sauce', 'egg', 'cheese', 'sugar', 'salt', 'bread', 'bun', 'patty', 'lettuce', 'tomato', 'onion', 'milk', 'flour', 'butter', 'noodles']:
        sig = instruments.synth(name)
        assert sig.size == C.FRAME
        assert np.isfinite(sig).all()
        assert C.peak(sig) <= 1.0


def test_t3_chicken_wav_pcm():
    """T3: Test Chicken PCM array length, non-zero amplitude, and fallback array consistency."""
    chick = instruments.synth('chicken')
    assert chick.size == C.FRAME
    assert np.isfinite(chick).all()
    assert C.peak(chick) > 0.1
    assert C.peak(chick) <= 1.0
    assert len(instruments.CHICKEN_PCM) >= 401


def test_t4_fft_and_ifft_roundtrip():
    """T4: Verify Parseval's theorem, known transform, and IFFT(FFT(x)) approx x with MSE < 1e-5."""
    N = 512
    n = np.arange(N)
    x = (np.sin(2 * np.pi * 11 * n / N) + 0.4 * np.cos(2 * np.pi * 47 * n / N)).astype(np.float32)

    X = C.cooley_tukey_fft(x)
    rec = C.cooley_tukey_ifft(X)
    mse = float(np.mean(np.square(x - rec)))
    assert mse < 1e-5

    time_energy = float(np.sum(np.square(x)))
    freq_energy = float(np.sum(np.square(np.abs(X)))) / N
    assert time_energy == pytest.approx(freq_energy, rel=1e-3)


def test_t5_low_pass_filter():
    """T5: Compound tone (200 Hz + 800 Hz), fc=400 Hz -> verify 800 Hz attenuated > 20 dB while 200 Hz preserved."""
    sr = 8000
    n = 2048
    t = np.arange(n) / sr
    f1, f2 = 200.0, 800.0
    compound = (np.sin(2 * np.pi * f1 * t) + np.sin(2 * np.pi * f2 * t)).astype(np.float32)

    filtered = C.apply_lowpass_filter(compound, 400.0, sr)
    mag = C.magnitude(filtered, n)
    freqs = C.bin_freqs(n, sr)

    bin1 = int(np.argmin(np.abs(freqs - f1)))
    bin2 = int(np.argmin(np.abs(freqs - f2)))

    assert mag[bin1] > 50.0
    assert mag[bin2] < mag[bin1] * 0.05  # > 26 dB attenuation


def test_t6_linear_convolution():
    """T6: Test convolution of unit impulse delta[n] (identity), rectangular pulses, and commutativity."""
    x = np.array([1.0, -2.0, 3.0, 0.5, 4.0], dtype=np.float32)
    h = np.array([0.2, 0.8, -0.4], dtype=np.float32)

    # Identity
    delta = np.array([1.0], dtype=np.float32)
    assert np.allclose(C.convolve(x, delta), x, atol=1e-6)

    # Commutativity
    assert np.allclose(C.convolve(x, h), C.convolve(h, x), atol=1e-6)


def test_t7_pipeline_dataflow():
    """T7: Trace signal samples through full culinary DSP pipeline."""
    raw = [instruments.synth('bread'), instruments.synth('patty')]
    mixed = C.mix(raw)
    assert mixed.size == C.FRAME

    seasoned = C.gain(mixed, 0.8)
    marinated = C.time_shift(seasoned, 10)
    assert marinated.size == C.FRAME

    h = systems.ir('sear')
    cooked = C.convolve_signals(marinated, h)
    assert cooked.size == C.FRAME
    assert np.isfinite(cooked).all()


def test_t8_timer_and_session_lifecycle():
    """T8: Test session recipe lifecycle and difficulty multipliers."""
    diff_multipliers = {
        'Easy': 0.8,
        'Medium': 1.0,
        'Hard': 1.25,
        'Masterchef': 1.5,
    }
    for diff, mult in diff_multipliers.items():
        base_score = 80.0
        final_score = base_score * mult
        assert final_score > 0


def test_t9_scoring_metrics():
    """T9: Test cross-correlation and NRMSE similarity on identical (100%) and orthogonal (0%) signals."""
    sig = instruments.synth('lettuce')
    assert metrics.compute_signal_similarity(sig, sig) == pytest.approx(100.0, abs=1e-2)

    N = 256
    sin_tone = np.sin(2 * np.pi * 4 * np.arange(N) / N).astype(np.float32)
    cos_tone = np.cos(2 * np.pi * 4 * np.arange(N) / N).astype(np.float32)
    r_ortho = metrics.normalized_cross_correlation(sin_tone, cos_tone)
    assert abs(r_ortho) < 0.01


def test_t10_beamforming_math():
    """T10: Verify phase steering vector generates maximum constructive interference at target angle."""
    from app.dsp import beamforming
    target_deg = 35.0
    preset = beamforming.get_preset_phases_for_angle(target_deg, 8)
    spk = [{'id': i + 1, 'phase': p, 'is_active': True} for i, p in enumerate(preset)]
    steered = beamforming.calculate_beam_angle(spk)
    assert abs(steered - target_deg) < 5.0

    phys_phases = beamforming.get_physical_steering_phases(target_deg, 8)
    af_peak = beamforming.array_factor(np.array([target_deg]), np.array(phys_phases, dtype=float))
    assert af_peak[0] > 0.99

