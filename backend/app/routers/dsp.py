"""
Dedicated DSP Router for WaveKitchen (Server-Authoritative DSP Engine).
Performs pure signal synthesis, filtering, mixing, transformation, convolution
and customer taste diagnostics.
"""
from __future__ import annotations

import numpy as np
from scipy import signal as sp_signal
from fastapi import APIRouter, HTTPException, status

from .. import schemas
from ..dsp import core as C

router = APIRouter(prefix='/dsp', tags=['dsp-engine'])


# --------------------------------------------------------------------------
# 1. Signal Generation
# --------------------------------------------------------------------------
@router.post('/generate', response_model=schemas.GenerateSignalResponse)
def generate_signal(payload: schemas.GenerateSignalRequest):
    sr = payload.sample_rate
    dur = payload.duration_s
    n_samples = int(sr * dur)
    t = np.linspace(0, dur, n_samples, endpoint=False, dtype=np.float32)
    f0 = payload.frequency
    amp = payload.amplitude

    if payload.waveform == 'sine':
        sig = amp * np.sin(2.0 * np.pi * f0 * t)
    elif payload.waveform == 'square':
        sig = amp * sp_signal.square(2.0 * np.pi * f0 * t)
    elif payload.waveform == 'triangle':
        sig = amp * sp_signal.sawtooth(2.0 * np.pi * f0 * t, width=0.5)
    elif payload.waveform == 'noise':
        sig = amp * (np.random.uniform(-1.0, 1.0, n_samples).astype(np.float32))
    elif payload.waveform == 'complex_noisy':
        pure = amp * (0.6 * np.sin(2.0 * np.pi * f0 * t) + 0.3 * np.sin(4.0 * np.pi * f0 * t))
        noise = (payload.noise_level if payload.noise_level > 0 else 0.4) * np.random.normal(0, 1, n_samples)
        sig = pure + noise
    else:
        sig = amp * np.sin(2.0 * np.pi * f0 * t)

    # Add extra noise if specified
    if payload.noise_level > 0 and payload.waveform != 'noise' and payload.waveform != 'complex_noisy':
        sig += payload.noise_level * np.random.normal(0, 1, n_samples).astype(np.float32)

    # Compute FFT Spectrum (positive frequencies)
    n_fft = min(2048, n_samples)
    fft_vals = np.abs(np.fft.rfft(sig[:n_fft]))
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    spectrum_db = 20.0 * np.log10(np.maximum(1e-5, fft_vals / (np.max(fft_vals) + 1e-6)))

    rms = float(np.sqrt(np.mean(sig ** 2)))
    peak = float(np.max(np.abs(sig)))

    # Subsample for lightweight transport if large
    downsample_factor = max(1, n_samples // 400)
    plot_samples = sig[::downsample_factor].tolist()
    plot_time = t[::downsample_factor].tolist()

    return schemas.GenerateSignalResponse(
        waveform=payload.waveform,
        frequency=f0,
        amplitude=amp,
        samples=[round(float(s), 4) for s in plot_samples],
        time=[round(float(x), 5) for x in plot_time],
        spectrum_freqs=[round(float(f), 1) for f in freqs[::4]],
        spectrum_db=[round(float(d), 2) for d in spectrum_db[::4]],
        rms=round(rms, 4),
        peak=round(peak, 4),
    )


# --------------------------------------------------------------------------
# 2. Filtering
# --------------------------------------------------------------------------
@router.post('/filter', response_model=schemas.FilterSignalResponse)
def filter_signal(payload: schemas.FilterSignalRequest):
    sr = payload.sample_rate
    samples = np.array(payload.samples, dtype=np.float32)
    n = len(samples)
    if n < 4:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, 'Signal too short.')

    nyq = 0.5 * sr
    order = payload.order

    # Design Butterworth filter
    if payload.filter_type == 'lowpass':
        norm_cutoff = min(0.99, max(0.01, payload.cutoff / nyq))
        b, a = sp_signal.butter(order, norm_cutoff, btype='lowpass')
    elif payload.filter_type == 'highpass':
        norm_cutoff = min(0.99, max(0.01, payload.cutoff / nyq))
        b, a = sp_signal.butter(order, norm_cutoff, btype='highpass')
    elif payload.filter_type == 'bandpass':
        lo = max(0.01, (payload.cutoff - payload.bandwidth / 2.0) / nyq)
        hi = min(0.99, (payload.cutoff + payload.bandwidth / 2.0) / nyq)
        if lo >= hi:
            lo, hi = 0.1, 0.4
        b, a = sp_signal.butter(order, [lo, hi], btype='bandpass')
    elif payload.filter_type == 'notch':
        w0 = payload.cutoff / nyq
        bw = payload.bandwidth / nyq
        b, a = sp_signal.iirnotch(w0, w0 / max(0.01, bw))
    else:
        b, a = sp_signal.butter(order, 0.5, btype='lowpass')

    # Apply zero-phase forward-backward filter
    try:
        filtered = sp_signal.filtfilt(b, a, samples)
    except Exception:
        filtered = sp_signal.lfilter(b, a, samples)

    # Frequency response curve
    w, h = sp_signal.freqz(b, a, worN=128)
    response_freqs = (w * nyq / np.pi).tolist()
    response_curve = (np.abs(h)).tolist()

    # FFT comparison
    n_fft = min(1024, n)
    raw_fft = np.abs(np.fft.rfft(samples[:n_fft]))
    filt_fft = np.abs(np.fft.rfft(filtered[:n_fft]))
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)

    clean_db = (20.0 * np.log10(np.maximum(1e-4, raw_fft / (np.max(raw_fft) + 1e-6)))).tolist()
    filt_db = (20.0 * np.log10(np.maximum(1e-4, filt_fft / (np.max(filt_fft) + 1e-6)))).tolist()

    noise_before = np.var(samples - np.mean(samples))
    noise_after = np.var(filtered - np.mean(filtered))
    snr_impr = 10.0 * np.log10(max(1.0, float(noise_before) / max(1e-6, float(noise_after))))

    return schemas.FilterSignalResponse(
        filtered_samples=[round(float(x), 4) for x in filtered],
        clean_spectrum_db=[round(float(x), 2) for x in clean_db[::2]],
        filtered_spectrum_db=[round(float(x), 2) for x in filt_db[::2]],
        freqs=[round(float(f), 1) for f in freqs[::2]],
        response_curve=[round(float(x), 3) for x in response_curve],
        snr_improvement_db=round(snr_impr, 2),
    )


# --------------------------------------------------------------------------
# 3. Superposition / Mixing
# --------------------------------------------------------------------------
@router.post('/mix', response_model=schemas.MixSignalsResponse)
def mix_signals(payload: schemas.MixSignalsRequest):
    tracks = payload.tracks
    if not tracks:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, 'No tracks provided.')

    max_len = max(len(t) for t in tracks)
    weights = payload.weights or [1.0] * len(tracks)

    mixed = np.zeros(max_len, dtype=np.float32)
    for t_idx, track in enumerate(tracks):
        w = weights[t_idx] if t_idx < len(weights) else 1.0
        arr = np.pad(track, (0, max_len - len(track)), mode='constant')
        mixed += w * arr

    if payload.normalize and np.max(np.abs(mixed)) > 1e-4:
        mixed = mixed / np.max(np.abs(mixed))

    # Detect harmonic peaks via simple threshold
    fft_mag = np.abs(np.fft.rfft(mixed))
    peaks_indices, _ = sp_signal.find_peaks(fft_mag, height=np.max(fft_mag) * 0.15)
    harmonic_peaks = [round(float(p), 1) for p in peaks_indices[:6]]

    return schemas.MixSignalsResponse(
        mixed_samples=[round(float(x), 4) for x in mixed],
        rms=round(float(np.sqrt(np.mean(mixed ** 2))), 4),
        peak=round(float(np.max(np.abs(mixed))), 4),
        harmonic_peaks=harmonic_peaks,
    )


# --------------------------------------------------------------------------
# 4. Transformation (Seasoning / Marinating)
# --------------------------------------------------------------------------
@router.post('/transform', response_model=schemas.TransformSignalResponse)
def transform_signal(payload: schemas.TransformSignalRequest):
    samples = np.array(payload.samples, dtype=np.float32)
    if len(samples) == 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, 'Empty samples.')

    # Amplitude scaling (Seasoning)
    transformed = samples * payload.amplitude_scale

    # Time scaling (Marinating) via resampling
    if payload.time_scale != 1.0:
        new_len = max(4, int(len(transformed) * payload.time_scale))
        transformed = sp_signal.resample(transformed, new_len)

    dur = len(transformed) / payload.sample_rate

    return schemas.TransformSignalResponse(
        transformed_samples=[round(float(x), 4) for x in transformed],
        duration_s=round(dur, 3),
        rms=round(float(np.sqrt(np.mean(transformed ** 2))), 4),
        peak=round(float(np.max(np.abs(transformed))), 4),
    )


# --------------------------------------------------------------------------
# 5. Convolution (Cooking)
# --------------------------------------------------------------------------
@router.post('/convolve', response_model=schemas.ConvolveSignalResponse)
def convolve_signal(payload: schemas.ConvolveSignalRequest):
    x = np.array(payload.input_samples, dtype=np.float32)
    if len(x) == 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, 'Empty input signal.')

    # Cooking impulse response kernels
    if payload.impulse_type == 'oven':
        # Gentle exponential decay chamber
        t_ir = np.linspace(0, 1, 32, endpoint=False)
        h = np.exp(-4.0 * t_ir) * np.cos(2.0 * np.pi * 3.0 * t_ir)
    elif payload.impulse_type == 'grill':
        # Sharp sear spikes
        h = np.array([1.0, -0.4, 0.6, -0.2, 0.3, 0.1, 0.05], dtype=np.float32)
    elif payload.impulse_type == 'skillet':
        # Warm sizzling comb
        h = np.array([0.8, 0.5, 0.3, 0.2, 0.1], dtype=np.float32)
    elif payload.impulse_type == 'steamer':
        # Soft diffuse Gaussian
        t_ir = np.linspace(-2, 2, 24)
        h = np.exp(-t_ir ** 2)
    else:
        h = np.array(payload.custom_impulse or [1.0, 0.5, 0.25], dtype=np.float32)

    # Normalize impulse
    h = h / (np.sum(np.abs(h)) + 1e-6)

    # Full convolution
    y_full = np.convolve(x, h, mode='same')

    # Blend based on convolution depth (slider progress)
    depth = payload.convolution_depth
    y = (1.0 - depth) * x + depth * y_full

    return schemas.ConvolveSignalResponse(
        convolved_samples=[round(float(val), 4) for val in y],
        impulse_samples=[round(float(val), 4) for val in h],
        peak=round(float(np.max(np.abs(y))), 4),
        rms=round(float(np.sqrt(np.mean(y ** 2))), 4),
    )


# --------------------------------------------------------------------------
# 6. Customer Taste Critique & Diagnostic Evaluation
# --------------------------------------------------------------------------
class CritiqueInput(schemas.BaseModel):
    recipe_id: str
    similarity: float
    filtering_accuracy: float = 90.0
    mixing_accuracy: float = 90.0
    seasoning_accuracy: float = 90.0
    marinating_accuracy: float = 90.0
    cooking_accuracy: float = 90.0
    delivery_accuracy: float | None = None


@router.post('/critique', response_model=schemas.CustomerCritiqueResponse)
def evaluate_critique(payload: CritiqueInput):
    recipe_id = payload.recipe_id
    sim = payload.similarity

    eater_map = {
        'burger': ('Speedy Diner #1', 'Fast-Casual Gourmet Connoisseur', '🍔'),
        'noodles': ('Hungry Noodle Fan #2', 'Master Broth Critic', '🍜'),
        'cake': ('VIP Party Host #5', 'Celebration Gala Host', '🧁'),
        'sandwich': ('Lunch Patron #3', 'Sunlit Terrace Regular', '🥪'),
    }
    eater_name, eater_title, avatar = eater_map.get(recipe_id, ('Gourmet Critic #4', 'Michelin Wave Inspector', '🍽️'))

    diagnostics: list[schemas.DiagnosticItem] = []

    # Filtering diagnostic
    if payload.filtering_accuracy >= 90:
        diagnostics.append(schemas.DiagnosticItem(
            station='Washing / Filtering',
            status='pass',
            culinary_note='Produce was perfectly washed; zero sand or grit detected.',
            dsp_diagnosis='Cutoff frequency precisely suppressed out-of-band noise (SNR > 24 dB).',
        ))
    elif payload.filtering_accuracy >= 70:
        diagnostics.append(schemas.DiagnosticItem(
            station='Washing / Filtering',
            status='warn',
            culinary_note='Slight granular grit in the texture.',
            dsp_diagnosis='Low-pass filter cutoff was slightly too wide; minor noise persisted.',
        ))
    else:
        diagnostics.append(schemas.DiagnosticItem(
            station='Washing / Filtering',
            status='fail',
            culinary_note='Gritty and unwashed vegetables overpowered the palate!',
            dsp_diagnosis='Excessive noise spectral density remained. Tune filter cutoff closer to fundamental band.',
        ))

    # Mixing diagnostic
    if payload.mixing_accuracy >= 90:
        diagnostics.append(schemas.DiagnosticItem(
            station='Mixing / Superposition',
            status='pass',
            culinary_note='All ingredient layers combined into a rich, harmonious chord.',
            dsp_diagnosis='Linear superposition x1(t) + x2(t) preserved harmonic phase coherence.',
        ))
    else:
        diagnostics.append(schemas.DiagnosticItem(
            station='Mixing / Superposition',
            status='warn',
            culinary_note='Flavor profile was missing harmonic depth.',
            dsp_diagnosis='Ingredient channel superposition was incomplete in the bowl.',
        ))

    # Seasoning diagnostic
    if payload.seasoning_accuracy >= 88:
        diagnostics.append(schemas.DiagnosticItem(
            station='Seasoning / Gain',
            status='pass',
            culinary_note='Seasoning and spice intensity were balanced to perfection.',
            dsp_diagnosis='Amplitude gain factor A matched target envelope within ±2%.',
        ))
    else:
        diagnostics.append(schemas.DiagnosticItem(
            station='Seasoning / Gain',
            status='warn',
            culinary_note='Seasoning balance was off.',
            dsp_diagnosis='Amplitude scaling factor A diverged from master recipe peak amplitude.',
        ))

    # Cooking diagnostic
    if payload.cooking_accuracy >= 90:
        diagnostics.append(schemas.DiagnosticItem(
            station='Cooking / Convolution',
            status='pass',
            culinary_note='Flawless golden crust and tender interior texture.',
            dsp_diagnosis='Full LTI convolution with oven impulse response h(t) completed.',
        ))
    else:
        diagnostics.append(schemas.DiagnosticItem(
            station='Cooking / Convolution',
            status='warn',
            culinary_note='The dish felt partially raw or unevenly heated.',
            dsp_diagnosis='Convolution slider was not swept to 100% depth.',
        ))

    # Beam delivery diagnostic
    if payload.delivery_accuracy is not None:
        if payload.delivery_accuracy >= 85:
            diagnostics.append(schemas.DiagnosticItem(
                station='Beam Delivery',
                status='pass',
                culinary_note='Dish arrived piping hot directly at the center of the table!',
                dsp_diagnosis=f'Phased array main lobe steered directly to target angle ({payload.delivery_accuracy}% focus).',
            ))
        else:
            diagnostics.append(schemas.DiagnosticItem(
                station='Beam Delivery',
                status='warn',
                culinary_note='Dish was slightly lukewarm due to acoustic dispersion.',
                dsp_diagnosis='Array factor main lobe deviated from table angle; secondary sidelobes caused dissipation.',
            ))

    if sim >= 92:
        reaction = 'ecstatic'
        headline = '★ ★ ★ Master Fourier Perfection!'
        quote = '"Sensational! The harmonic purity and acoustic texture of this dish are a true scientific marvel. Chef Fourier would be proud!"'
    elif sim >= 80:
        reaction = 'satisfied'
        headline = '★ ★ ☆ Delicious & Well-Tuned Dish'
        quote = '"Very tasty! The flavors came together cleanly. With a touch more precision on filtering and seasoning, this will be three-star perfection."'
    elif sim >= 60:
        reaction = 'critical'
        headline = '★ ☆ ☆ Decent Effort, Needs Signal Calibration'
        quote = '"The core flavor is there, but there was noticeable noise and the seasoning balance was uneven. Keep practicing at the stations!"'
    else:
        reaction = 'disappointed'
        headline = '☆ ☆ ☆ Needs Kitchen Recalibration'
        quote = '"Oh dear... The dish was distorted and noisy. Let\'s review the recipe briefing and clean our ingredient signals more carefully!"'

    return schemas.CustomerCritiqueResponse(
        eater_name=eater_name,
        eater_title=eater_title,
        avatar_emoji=avatar,
        reaction=reaction,
        headline=headline,
        quote=quote,
        diagnostics=diagnostics,
    )
