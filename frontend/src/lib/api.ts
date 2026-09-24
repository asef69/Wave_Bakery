/**
 * WaveKitchen Backend API Client
 *
 * Connects the frontend with the FastAPI backend running on port 8000.
 * Server owns DSP calculations, state, spectrograms, convolutions,
 * dish judging, score evaluations, and phased array beamforming.
 */

const API_BASE =
  typeof window !== "undefined" &&
  (window.location.port === "5173" || window.location.port === "3000")
    ? "http://127.0.0.1:8000/api"
    : "/api";

const TOKEN_KEY = "wavekitchen_player_token";

export interface SignalPayload {
  sample_rate: number;
  length: number;
  duration_s?: number;
  rms?: number;
  peak?: number;
  plot: number[];
  audio?: string | null; // base64 little-endian float32
}

export interface SpectrumPayload {
  freqs: number[];
  db: number[];
  sample_rate?: number;
  nfft?: number;
}

export interface IngredientOut {
  id: string;
  name: string;
  emoji: string;
  voice: string;
  f0: number;
  color: string;
  signature?: string;
  washable: boolean;
  ideal_cutoff?: number;
  kind?: string;
  category?: string;
}

export interface RecipeOut {
  id: string;
  name: string;
  emoji: string;
  tier: number;
  story?: string;
  tagline?: string;
  ingredients: string[];
  appliances?: string[];
  cooking_method?: string;
  difficulty?: string;
  prep_time?: string;
  servings?: string;
  page_number?: number;
  washable_ingredients?: string[];
  is_active?: boolean;
}

export interface SessionItemOut {
  slot: number;
  ingredient_id: string;
  name: string;
  emoji: string;
  color: string;
  voice: string;
  f0: number;
  components: Array<{ freq: number; amp: number }>;
  contaminants: Array<{ kind: string; amp: number; band_lo: number; band_hi: number; freq?: number }>;
  prep_score: number;
  accepted: boolean;
  dirty: SignalPayload;
  clean_preview: SignalPayload;
}

export interface GameSessionOut {
  id: string;
  recipe: RecipeOut;
  seed: number;
  status: "in_prep" | "cooked" | "served" | "abandoned";
  params: Record<string, unknown>;
  items: SessionItemOut[];
  requires_caramelize: boolean;
  requires_chop: boolean;
}

export interface FilterBand {
  f_lo: number;
  f_hi: number;
  gain_db: number;
}

export interface FilterTool {
  kind: "lowpass" | "highpass" | "bandpass" | "notch" | "dehum";
  cutoff?: number;
  f0?: number;
  f_lo?: number;
  f_hi?: number;
  bandwidth?: number;
  depth?: number;
}

export interface FilterRequest {
  bands?: FilterBand[];
  tools?: FilterTool[];
  want_spectrogram?: boolean;
}

export interface FilterResponse {
  slot: number;
  prep: {
    score: number;
    removed_db: number;
    preserved_ratio: number;
    clean_enough: boolean;
    over_filtered: boolean;
    still_dirty: boolean;
  };
  signal: SignalPayload;
  spectrum: SpectrumPayload;
  clean_spectrum: SpectrumPayload;
  filter_freqs: number[];
  filter_curve: number[];
  spectrogram?: {
    times: number[];
    freqs: number[];
    db: number[][];
  } | null;
  accepted: boolean;
}

export interface StagesOut {
  mixed: SignalPayload;
  seasoned: SignalPayload;
  blended: SignalPayload;
  marinated: SignalPayload;
  modulated: SignalPayload;
  chopped: SignalPayload;
  cooked: SignalPayload;
  final: SignalPayload;
  nyquist: number;
  mix_spectrum: SpectrumPayload;
  blend_spectrum: SpectrumPayload;
  finish_spectrum: SpectrumPayload;
  cascade_ir: number[];
  cascade_response_freqs: number[];
  cascade_response_db: number[];
  aliasing_detected: boolean;
}

export interface ConvolutionOut {
  x: number[];
  h: number[];
  y: number[];
  lag: number;
  max_lag: number;
  running_sum: number;
}

export interface SubmitResult {
  attempt_id: string;
  score: number;
  stars: number;
  prep_score: number;
  filtering_score?: number;
  mixing_score?: number;
  transform_score?: number;
  cooking_score?: number;
  snr_db: number;
  mse: number;
  correlation: number;
  spectral_similarity: number;
  points_awarded: number;
  total_points: number;
  unlocked_tier: number;
  rank_title: string;
  notes: string[];
  target: SignalPayload;
  player_dish: SignalPayload;
  target_spectrum: SpectrumPayload;
  player_spectrum: SpectrumPayload;
}

export interface SpeakerState {
  id: number;
  phase: number;
  amplitude?: number;
  is_active?: boolean;
}

export interface BeamDeliveryRequest {
  speakers: SpeakerState[];
  target_angle: number;
}

export interface BeamDeliveryResponse {
  steered_angle: number;
  target_angle: number;
  is_aligned: boolean;
  tolerance_degrees: number;
  beam_pattern: Array<{ angle: number; intensity: number }>;
  accuracy: number;
  message: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== "undefined") {
      this.token = window.localStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    const token = this.getToken();
    if (token) {
      headers.set("X-Player-Token", token);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorMsg;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  }

  // Auth & Players
  async ensureAuthenticated(handle = "Chef Fourier"): Promise<string> {
    const existing = this.getToken();
    if (existing) {
      try {
        await this.getPlayerMe();
        return existing;
      } catch {
        // Token invalid or expired on server, re-authenticate below
      }
    }
    const res = await this.authOrRegisterPlayer(handle);
    return res.token;
  }

  async registerPlayer(handle: string) {
    const res = await this.request<{
      token: string;
      id: string;
      handle: string;
      points: number;
      unlocked_tier: number;
      rank_title: string;
      rank_emoji: string;
    }>("/players", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
    this.setToken(res.token);
    return res;
  }

  async loginPlayer(handle: string) {
    const res = await this.request<{
      token: string;
      id: string;
      handle: string;
      points: number;
      unlocked_tier: number;
      rank_title: string;
      rank_emoji: string;
    }>("/players/login", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
    this.setToken(res.token);
    return res;
  }

  async authOrRegisterPlayer(handle: string) {
    const res = await this.request<{
      token: string;
      id: string;
      handle: string;
      points: number;
      unlocked_tier: number;
      rank_title: string;
      rank_emoji: string;
    }>("/players/auth-or-register", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
    this.setToken(res.token);
    return res;
  }

  async listChefs(limit = 50) {
    return this.request<
      Array<{
        id: string;
        handle: string;
        points: number;
        unlocked_tier: number;
        rank_title: string;
        rank_emoji: string;
        dishes_served: number;
        created_at: string;
      }>
    >(`/players?limit=${limit}`);
  }

  logoutPlayer() {
    this.setToken(null);
  }

  async getPlayerMe() {
    return this.request<{
      id: string;
      handle: string;
      points: number;
      unlocked_tier: number;
      rank_title: string;
      rank_emoji?: string;
      next_rank?: string;
      points_to_next?: number;
      dishes_served: number;
      best_scores: Record<string, number>;
    }>("/players/me");
  }

  // Catalogue
  async getRecipes(): Promise<RecipeOut[]> {
    return this.request<RecipeOut[]>("/recipes");
  }

  async getRecipe(id: string): Promise<RecipeOut> {
    return this.request<RecipeOut>(`/recipes/${id}`);
  }

  async getIngredients(): Promise<IngredientOut[]> {
    return this.request<IngredientOut[]>("/ingredients");
  }

  async getAppliances(): Promise<any[]> {
    return this.request<any[]>("/appliances");
  }

  // Sessions
  async createSession(recipeId: string): Promise<GameSessionOut> {
    return this.request<GameSessionOut>("/sessions", {
      method: "POST",
      body: JSON.stringify({ recipe_id: recipeId }),
    });
  }

  async getSession(sessionId: string): Promise<GameSessionOut> {
    return this.request<GameSessionOut>(`/sessions/${sessionId}`);
  }

  async filterIngredient(sessionId: string, slot: number, payload: FilterRequest): Promise<FilterResponse> {
    return this.request<FilterResponse>(`/sessions/${sessionId}/ingredients/${slot}/filter`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async acceptIngredient(sessionId: string, slot: number): Promise<{ status: string; prep_score: number }> {
    return this.request<{ status: string; prep_score: number }>(`/sessions/${sessionId}/ingredients/${slot}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async setParams(sessionId: string, params: Record<string, unknown>): Promise<StagesOut> {
    return this.request<StagesOut>(`/sessions/${sessionId}/params`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  }

  async getStages(sessionId: string): Promise<StagesOut> {
    return this.request<StagesOut>(`/sessions/${sessionId}/stages`);
  }

  async getConvolution(sessionId: string, lag: number): Promise<ConvolutionOut> {
    return this.request<ConvolutionOut>(`/sessions/${sessionId}/convolution?lag=${lag}`);
  }

  async submitSession(sessionId: string): Promise<SubmitResult> {
    return this.request<SubmitResult>(`/sessions/${sessionId}/submit`, {
      method: "POST",
    });
  }

  async beamDelivery(sessionId: string, payload: BeamDeliveryRequest): Promise<BeamDeliveryResponse> {
    return this.request<BeamDeliveryResponse>(`/sessions/${sessionId}/beam-delivery`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Leaderboard
  async getLeaderboard(recipeId?: string) {
    const q = recipeId ? `?recipe_id=${recipeId}` : "";
    return this.request<any[]>(`/leaderboard${q}`);
  }

  // Authoritative Direct DSP Services
  async generateSignal(payload: {
    waveform?: string;
    frequency?: number;
    amplitude?: number;
    noise_level?: number;
    duration_s?: number;
  }) {
    return this.request<{
      waveform: string;
      frequency: number;
      amplitude: number;
      samples: number[];
      time: number[];
      spectrum_freqs: number[];
      spectrum_db: number[];
      rms: number;
      peak: number;
    }>("/dsp/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async filterSignal(payload: {
    samples: number[];
    filter_type?: string;
    cutoff?: number;
    bandwidth?: number;
    order?: number;
  }) {
    return this.request<{
      filtered_samples: number[];
      clean_spectrum_db: number[];
      filtered_spectrum_db: number[];
      freqs: number[];
      response_curve: number[];
      snr_improvement_db: number;
    }>("/dsp/filter", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async mixSignals(payload: { tracks: number[][]; weights?: number[]; normalize?: boolean }) {
    return this.request<{
      mixed_samples: number[];
      rms: number;
      peak: number;
      harmonic_peaks: number[];
    }>("/dsp/mix", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async transformSignal(payload: {
    samples: number[];
    amplitude_scale?: number;
    time_scale?: number;
    frequency_shift_hz?: number;
  }) {
    return this.request<{
      transformed_samples: number[];
      duration_s: number;
      rms: number;
      peak: number;
    }>("/dsp/transform", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async convolveSignal(payload: {
    input_samples: number[];
    impulse_type?: string;
    custom_impulse?: number[];
    convolution_depth?: number;
  }) {
    return this.request<{
      convolved_samples: number[];
      impulse_samples: number[];
      peak: number;
      rms: number;
    }>("/dsp/convolve", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async calculateBeamforming(payload: {
    speakers: Array<{ id: number; phase: number; amplitude?: number; is_active?: boolean }>;
    target_angle?: number;
    window_type?: string;
  }) {
    return this.request<{
      steered_angle: number;
      target_angle: number;
      is_aligned: boolean;
      transmission_efficiency_pct: number;
      peak_sidelobe_level_db: number;
      window_weights: number[];
      beam_pattern: Array<{ angle: number; intensity: number }>;
      table_spillovers: Array<{ table_id: number; table_name: string; spillover_intensity_pct: number }>;
    }>("/dsp/beamforming", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async evaluateCritique(payload: {
    recipe_id: string;
    similarity: number;
    filtering_accuracy?: number;
    mixing_accuracy?: number;
    seasoning_accuracy?: number;
    marinating_accuracy?: number;
    cooking_accuracy?: number;
    delivery_accuracy?: number | null;
  }) {
    return this.request<{
      eater_name: string;
      eater_title: string;
      avatar_emoji: string;
      reaction: "ecstatic" | "satisfied" | "critical" | "disappointed";
      headline: string;
      quote: string;
      diagnostics: Array<{
        station: string;
        status: "pass" | "warn" | "fail";
        culinary_note: string;
        dsp_diagnosis: string;
      }>;
    }>("/dsp/critique", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; version: string; sample_rate: number; frame: number }>("/health");
  }
}

export const api = new ApiClient();
