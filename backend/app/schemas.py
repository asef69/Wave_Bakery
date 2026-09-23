"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------
# catalogue
# --------------------------------------------------------------------------
class IngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    emoji: str
    voice: str
    f0: float
    color: str
    signature: str
    washable: bool = False
    ideal_cutoff: float | None = None
    kind: str = "generic"
    category: str = "Produce"


class ApplianceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    emoji: str
    blurb: str
    character: str


class ApplianceDetail(ApplianceOut):
    impulse_response: list[float]
    response_freqs: list[float]
    response_db: list[float]


class RecipeBase(BaseModel):
    name: str
    emoji: str = ''
    tagline: str = ''
    difficulty: str = 'Easy'
    tier: int = Field(1, ge=1, le=6)
    story: str = ''
    prep_time: str = '5 mins'
    servings: str = '1 serving'
    page_number: int = 1
    ingredients: list[str]
    washable_ingredients: list[str] = []
    appliances: list[str] = []
    cooking_method: str = 'grill'
    seasoning: float = Field(1.0, ge=0, le=2.5)
    blend: float = Field(1.0, ge=0.2, le=3.0)
    marinate: float = Field(0.0, ge=0, le=3.0)
    caramelize_carrier: float | None = None
    caramelize_depth: float | None = None
    chop_factor: int | None = Field(None, ge=1, le=8)
    noise_difficulty: float = Field(1.0, ge=0, le=3)
    tolerance: float = Field(1.0, gt=0.3, le=2.0)
    teaches: list[str] = []
    steps: list[dict] = []


class RecipeCreate(RecipeBase):
    id: str = Field(..., pattern=r'^[a-z0-9_-]{2,32}$')


class RecipeUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None
    tagline: str | None = None
    difficulty: str | None = None
    tier: int | None = None
    story: str | None = None
    prep_time: str | None = None
    servings: str | None = None
    page_number: int | None = None
    ingredients: list[str] | None = None
    washable_ingredients: list[str] | None = None
    appliances: list[str] | None = None
    cooking_method: str | None = None
    seasoning: float | None = None
    blend: float | None = None
    marinate: float | None = None
    caramelize_carrier: float | None = None
    caramelize_depth: float | None = None
    chop_factor: int | None = None
    noise_difficulty: float | None = None
    tolerance: float | None = None
    teaches: list[str] | None = None
    steps: list[dict] | None = None
    is_active: bool | None = None


class RecipeOut(RecipeBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_active: bool = True


class RecipeCard(BaseModel):
    """What the recipe book shows: the brief, without the answer key."""
    id: str
    name: str
    emoji: str
    tagline: str = ''
    difficulty: str = 'Easy'
    tier: int
    story: str
    prep_time: str = '5 mins'
    servings: str = '1 serving'
    page_number: int = 1
    ingredients: list[str]
    washable_ingredients: list[str] = []
    cooking_method: str = 'grill'
    teaches: list[str]
    unlocked: bool
    best_score: float | None = None
    plays: int = 0


# --------------------------------------------------------------------------
# players
# --------------------------------------------------------------------------
class PlayerCreate(BaseModel):
    handle: str = Field(..., min_length=2, max_length=24, pattern=r'^[\w .\-]+$')


class PlayerLogin(BaseModel):
    handle: str = Field(..., min_length=2, max_length=24, pattern=r'^[\w .\-]+$')


class PlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    handle: str
    points: int
    unlocked_tier: int
    created_at: datetime


class PlayerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    handle: str
    points: int
    unlocked_tier: int
    rank_title: str
    rank_emoji: str
    dishes_served: int
    created_at: datetime


class PlayerRegistered(PlayerOut):
    token: str
    rank_title: str
    rank_emoji: str


class PlayerProfile(PlayerOut):
    rank_title: str
    rank_emoji: str
    next_rank: str | None
    points_to_next: int | None
    dishes_served: int
    best_scores: dict[str, float]


# --------------------------------------------------------------------------
# signals
# --------------------------------------------------------------------------
class SignalPayload(BaseModel):
    """A signal in both plot form (small) and audio form (base64 float32)."""
    length: int
    sample_rate: int
    plot: list[float]
    audio: str | None = None


class SpectrumPayload(BaseModel):
    freqs: list[float]
    db: list[float]
    sample_rate: int
    nfft: int


class SpectrogramPayload(BaseModel):
    freqs: list[float]
    times: list[float]
    db: list[list[float]]


# --------------------------------------------------------------------------
# filters
# --------------------------------------------------------------------------
class EqBand(BaseModel):
    f_lo: float
    f_hi: float
    gain_db: float = Field(0.0, ge=-60, le=12)


class FilterTool(BaseModel):
    kind: Literal['lowpass', 'highpass', 'bandpass', 'notch', 'dehum']
    cutoff: float | None = None
    low: float | None = None
    high: float | None = None
    center: float | None = None
    bandwidth: float | None = None
    f0: float | None = None


class FilterRequest(BaseModel):
    bands: list[EqBand] = []
    tools: list[FilterTool] = []
    want_spectrogram: bool = False


class PrepResult(BaseModel):
    score: float
    removal: float
    preservation: float
    over_filtered: bool
    still_dirty: bool


class FilterResponse(BaseModel):
    slot: int
    prep: PrepResult
    signal: SignalPayload
    spectrum: SpectrumPayload
    clean_spectrum: SpectrumPayload
    filter_curve: list[float]
    filter_freqs: list[float]
    spectrogram: SpectrogramPayload | None = None
    accepted: bool


# --------------------------------------------------------------------------
# sessions
# --------------------------------------------------------------------------
class SessionCreate(BaseModel):
    recipe_id: str


class ContaminantOut(BaseModel):
    kind: str
    amp: float
    band_lo: float
    band_hi: float
    freq: float | None = None


class SessionItemOut(BaseModel):
    slot: int
    ingredient_id: str
    name: str
    emoji: str
    color: str
    voice: str
    f0: float
    components: list[dict] = []
    contaminants: list[ContaminantOut]
    bands: list[EqBand]
    tools: list[FilterTool]
    prep_score: float | None
    accepted: bool
    dirty: SignalPayload
    clean_preview: SignalPayload


class CookParams(BaseModel):
    seasoning: float = Field(0.4, ge=0, le=3.0)
    blend: float = Field(1.0, ge=0.1, le=3.0)
    frequency: float = Field(1.0, ge=0.1, le=3.0)
    marinate: float = Field(0.0, ge=0, le=3.0)
    carrier: float | None = Field(None, ge=20, le=2000)
    depth: float | None = Field(None, ge=0, le=1)
    chop_factor: int | None = Field(None, ge=1, le=8)
    anti_alias: bool = True
    appliances: list[str] = []
    cooking_method: str | None = None


class SessionOut(BaseModel):
    id: str
    recipe: RecipeCard
    seed: int
    status: str
    params: CookParams
    items: list[SessionItemOut]
    requires_caramelize: bool
    requires_chop: bool


class StagesOut(BaseModel):
    """Every intermediate signal, so any station can plot or play its stage."""
    mixed: SignalPayload
    seasoned: SignalPayload
    blended: SignalPayload
    marinated: SignalPayload
    modulated: SignalPayload
    chopped: SignalPayload
    cooked: SignalPayload
    final: SignalPayload
    nyquist: float
    mix_spectrum: SpectrumPayload
    blend_spectrum: SpectrumPayload
    finish_spectrum: SpectrumPayload
    cascade_ir: list[float]
    cascade_response_freqs: list[float]
    cascade_response_db: list[float]
    aliasing_detected: bool


class ConvolutionOut(BaseModel):
    x: list[float]
    h: list[float]
    y: list[float]
    lag: int
    max_lag: int
    running_sum: float


class SubmitResult(BaseModel):
    attempt_id: str
    score: float
    stars: int
    prep_score: float
    filtering_score: float | None = None
    mixing_score: float | None = None
    transform_score: float | None = None
    cooking_score: float | None = None
    snr_db: float
    mse: float
    correlation: float
    spectral_similarity: float
    points_awarded: int
    total_points: int
    unlocked_tier: int
    rank_title: str
    notes: list[str]
    target: SignalPayload
    player_dish: SignalPayload
    target_spectrum: SpectrumPayload
    player_spectrum: SpectrumPayload


# --------------------------------------------------------------------------
# beam delivery / phased array
# --------------------------------------------------------------------------
class SpeakerStateSchema(BaseModel):
    id: int
    phase: float = Field(0.0, ge=-180.0, le=180.0)
    amplitude: float = Field(1.0, ge=0.0, le=1.0)
    is_active: bool = True


class BeamPointSchema(BaseModel):
    angle: float
    intensity: float


class BeamDeliveryRequest(BaseModel):
    speakers: list[SpeakerStateSchema] = []
    target_angle: float = Field(35.0, ge=-80.0, le=80.0)


class BeamDeliveryResponse(BaseModel):
    steered_angle: float
    target_angle: float
    is_aligned: bool
    tolerance_degrees: float
    beam_pattern: list[BeamPointSchema]
    accuracy: float
    message: str


# --------------------------------------------------------------------------
# leaderboard and stats
# --------------------------------------------------------------------------
class LeaderboardRow(BaseModel):
    rank: int
    player_id: str
    handle: str
    score: float
    stars: int
    recipe_id: str
    recipe_name: str
    created_at: datetime


class GlobalRankRow(BaseModel):
    rank: int
    player_id: str
    handle: str
    points: int
    rank_title: str
    dishes_served: int
    best_score: float


class RecipeStats(BaseModel):
    recipe_id: str
    recipe_name: str
    tier: int
    plays: int
    average_score: float
    best_score: float
    five_star_rate: float


class GlobalStats(BaseModel):
    players: int
    sessions_started: int
    dishes_served: int
    average_score: float
    hardest_recipe: str | None
    easiest_recipe: str | None
    recipes: list[RecipeStats]


class PlayerHistoryRow(BaseModel):
    attempt_id: str
    recipe_id: str
    recipe_name: str
    score: float
    stars: int
    points_awarded: int
    created_at: datetime


# --------------------------------------------------------------------------
# direct DSP service schemas (Server-authoritative DSP)
# --------------------------------------------------------------------------
class GenerateSignalRequest(BaseModel):
    waveform: Literal['sine', 'square', 'triangle', 'noise', 'complex_noisy'] = 'sine'
    frequency: float = Field(220.0, ge=1.0, le=4000.0)
    amplitude: float = Field(1.0, ge=0.0, le=2.0)
    noise_level: float = Field(0.0, ge=0.0, le=1.0)
    duration_s: float = Field(0.5, ge=0.05, le=5.0)
    sample_rate: int = 22050


class GenerateSignalResponse(BaseModel):
    waveform: str
    frequency: float
    amplitude: float
    samples: list[float]
    time: list[float]
    spectrum_freqs: list[float]
    spectrum_db: list[float]
    rms: float
    peak: float


class FilterSignalRequest(BaseModel):
    samples: list[float]
    sample_rate: int = 22050
    filter_type: Literal['lowpass', 'highpass', 'bandpass', 'notch'] = 'lowpass'
    cutoff: float = Field(500.0, ge=10.0, le=10000.0)
    bandwidth: float = Field(100.0, ge=10.0, le=5000.0)
    order: int = Field(4, ge=1, le=10)


class FilterSignalResponse(BaseModel):
    filtered_samples: list[float]
    clean_spectrum_db: list[float]
    filtered_spectrum_db: list[float]
    freqs: list[float]
    response_curve: list[float]
    snr_improvement_db: float


class MixSignalsRequest(BaseModel):
    tracks: list[list[float]]
    weights: list[float] | None = None
    normalize: bool = True


class MixSignalsResponse(BaseModel):
    mixed_samples: list[float]
    rms: float
    peak: float
    harmonic_peaks: list[float]


class TransformSignalRequest(BaseModel):
    samples: list[float]
    amplitude_scale: float = Field(1.0, ge=0.0, le=3.0)
    time_scale: float = Field(1.0, ge=0.25, le=4.0)
    frequency_shift_hz: float = Field(0.0, ge=-500.0, le=500.0)
    sample_rate: int = 22050


class TransformSignalResponse(BaseModel):
    transformed_samples: list[float]
    duration_s: float
    rms: float
    peak: float


class ConvolveSignalRequest(BaseModel):
    input_samples: list[float]
    impulse_type: Literal['oven', 'grill', 'skillet', 'steamer', 'custom'] = 'oven'
    custom_impulse: list[float] | None = None
    convolution_depth: float = Field(1.0, ge=0.0, le=1.0)


class ConvolveSignalResponse(BaseModel):
    convolved_samples: list[float]
    impulse_samples: list[float]
    peak: float
    rms: float


class PhasedArrayCalcRequest(BaseModel):
    speakers: list[SpeakerStateSchema]
    target_angle: float = Field(0.0, ge=-80.0, le=80.0)
    window_type: Literal['uniform', 'hamming', 'hann', 'blackman'] = 'uniform'
    d_over_lambda: float = 0.5


class TableSpilloverOut(BaseModel):
    table_id: int
    table_name: str
    spillover_intensity_pct: float


class PhasedArrayCalcResponse(BaseModel):
    steered_angle: float
    target_angle: float
    is_aligned: bool
    transmission_efficiency_pct: float
    peak_sidelobe_level_db: float
    window_weights: list[float]
    beam_pattern: list[BeamPointSchema]
    table_spillovers: list[TableSpilloverOut]


class DiagnosticItem(BaseModel):
    station: str
    status: Literal['pass', 'warn', 'fail']
    culinary_note: str
    dsp_diagnosis: str


class CustomerCritiqueResponse(BaseModel):
    eater_name: str
    eater_title: str
    avatar_emoji: str
    reaction: Literal['ecstatic', 'satisfied', 'critical', 'disappointed']
    headline: str
    quote: str
    diagnostics: list[DiagnosticItem]

