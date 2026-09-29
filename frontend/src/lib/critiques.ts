/**
 * Dynamic Culinary & DSP Diagnostic System (WaveBakery)
 * Evaluates dish parameters across filtering, mixing, transformation, convolution and delivery,
 * generating authentic eater critiques and actionable signal-engineering guidance.
 */

export interface CustomerCritique {
  eaterName: string;
  eaterTitle: string;
  avatarEmoji: string;
  reaction: "ecstatic" | "satisfied" | "critical" | "disappointed";
  headline: string;
  quote: string;
  diagnostics: {
    station: string;
    status: "pass" | "warn" | "fail";
    culinaryNote: string;
    dspDiagnosis: string;
  }[];
}

interface DishMetrics {
  recipeId: string;
  similarity: number;
  filteringAccuracy: number;
  mixingAccuracy: number;
  seasoningAccuracy: number;
  marinatingAccuracy: number;
  cookingAccuracy: number;
  deliveryAccuracy: number | null;
}

const EATER_PROFILES: Record<string, { name: string; title: string; avatar: string }> = {
  burger: {
    name: "Speedy Diner #1",
    title: "Fast-Casual Gourmet Connoisseur",
    avatar: "🍔",
  },
  noodles: {
    name: "Hungry Noodle Fan #2",
    title: "Master Broth Critic",
    avatar: "🍜",
  },
  cake: {
    name: "VIP Party Host #5",
    title: "Celebration Gala Host",
    avatar: "🧁",
  },
  sandwich: {
    name: "Lunch Patron #3",
    title: "Sunlit Terrace Regular",
    avatar: "🥪",
  },
};

export function generateCustomerCritique(metrics: DishMetrics): CustomerCritique {
  const profile = EATER_PROFILES[metrics.recipeId] ?? {
    name: "Gourmet Critic #4",
    title: "Michelin Wave Inspector",
    avatar: "🍽️",
  };

  const diagnostics: CustomerCritique["diagnostics"] = [];

  // 1. Filtering / Washing Diagnostic
  if (metrics.filteringAccuracy >= 90) {
    diagnostics.push({
      station: "Washing / Filtering",
      status: "pass",
      culinaryNote: "Produce was perfectly washed; zero sand or grit detected.",
      dspDiagnosis:
        "Cutoff frequency precisely suppressed out-of-band high-frequency noise (SNR > 24 dB).",
    });
  } else if (metrics.filteringAccuracy >= 70) {
    diagnostics.push({
      station: "Washing / Filtering",
      status: "warn",
      culinaryNote: "Slight granular grit in the texture.",
      dspDiagnosis:
        "Low-pass filter cutoff was slightly too wide; minor high-frequency chatter persisted.",
    });
  } else {
    diagnostics.push({
      station: "Washing / Filtering",
      status: "fail",
      culinaryNote: "Gritty and unwashed vegetables overpowered the palate!",
      dspDiagnosis:
        "Excessive noise spectral density remained. Tune filter cutoff closer to fundamental band.",
    });
  }

  // 2. Mixing / Superposition Diagnostic
  if (metrics.mixingAccuracy >= 90) {
    diagnostics.push({
      station: "Mixing / Superposition",
      status: "pass",
      culinaryNote: "All ingredient layers combined into a rich, harmonious chord.",
      dspDiagnosis: "Linear superposition x₁(t) + x₂(t) preserved harmonic phase coherence.",
    });
  } else {
    diagnostics.push({
      station: "Mixing / Superposition",
      status: "warn",
      culinaryNote: "Flavor profile was missing harmonic depth.",
      dspDiagnosis: "Ingredient channel superposition was incomplete or unbalanced in the bowl.",
    });
  }

  // 3. Seasoning / Amplitude Scaling Diagnostic
  if (metrics.seasoningAccuracy >= 88) {
    diagnostics.push({
      station: "Seasoning / Gain",
      status: "pass",
      culinaryNote: "Seasoning and spice intensity were balanced to perfection.",
      dspDiagnosis: "Amplitude gain factor A matched target envelope within ±2%.",
    });
  } else {
    diagnostics.push({
      station: "Seasoning / Gain",
      status: "warn",
      culinaryNote:
        metrics.seasoningAccuracy < 70
          ? "Severely under-seasoned / bland!"
          : "Seasoning balance was slightly off.",
      dspDiagnosis: "Amplitude scaling factor A diverged from master recipe peak amplitude.",
    });
  }

  // 4. Cooking / LTI Convolution Diagnostic
  if (metrics.cookingAccuracy >= 90) {
    diagnostics.push({
      station: "Cooking / Convolution",
      status: "pass",
      culinaryNote: "Flawless golden crust and tender interior texture.",
      dspDiagnosis: "Full LTI convolution with oven impulse response h(t) completed seamlessly.",
    });
  } else {
    diagnostics.push({
      station: "Cooking / Convolution",
      status: "warn",
      culinaryNote: "The dish felt partially raw or unevenly heated.",
      dspDiagnosis:
        "Convolution slider was not swept to 100% depth, leaving impulse response under-integrated.",
    });
  }

  // 5. Precision Oven diagnostic (if attempted)
  if (metrics.deliveryAccuracy !== null) {
    if (metrics.deliveryAccuracy >= 85) {
      diagnostics.push({
        station: "Precision Oven",
        status: "pass",
        culinaryNote: "No trace of burning: the crust tastes exactly as intended!",
        dspDiagnosis: `Sampled above Nyquist and notched the burnt overtone out (${metrics.deliveryAccuracy}% finish).`,
      });
    } else {
      diagnostics.push({
        station: "Precision Oven",
        status: "warn",
        culinaryNote: "A faint burnt aftertaste came through.",
        dspDiagnosis:
          "Part of the burnt overtone survived: aim the notch on it, sample at fs ≥ 2·fmax, and keep the band sliders at 1.0.",
      });
    }
  }

  // Overall reaction classification
  let reaction: CustomerCritique["reaction"] = "satisfied";
  let headline = "A Solid Culinary Signal Performance";
  let quote = "A delightful dish with clear harmonic flavor notes. A job well done!";

  if (metrics.similarity >= 92) {
    reaction = "ecstatic";
    headline = "★ ★ ★ Master Fourier Perfection!";
    quote = `"Sensational! The harmonic purity and acoustic texture of this dish are a true scientific marvel. Chef Fourier would be proud!"`;
  } else if (metrics.similarity >= 80) {
    reaction = "satisfied";
    headline = "★ ★ ☆ Delicious & Well-Tuned Dish";
    quote = `"Very tasty! The flavors came together cleanly. With a touch more precision on filtering and seasoning, this will be three-star perfection."`;
  } else if (metrics.similarity >= 60) {
    reaction = "critical";
    headline = "★ ☆ ☆ Decent Effort, Needs Signal Calibration";
    quote = `"The core flavor is there, but there was noticeable high-frequency grit and the seasoning balance was uneven. Keep practicing at the stations!"`;
  } else {
    reaction = "disappointed";
    headline = "☆ ☆ ☆ Needs Kitchen Recalibration";
    quote = `"Oh dear... The dish was distorted and noisy. Let's review the recipe briefing and clean our ingredient signals more carefully!"`;
  }

  return {
    eaterName: profile.name,
    eaterTitle: profile.title,
    avatarEmoji: profile.avatar,
    reaction,
    headline,
    quote,
    diagnostics,
  };
}
