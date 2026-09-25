/**
 * Discrete-time systems for the System Delivery (z-plane) station.
 * One definition of each preset's poles, zeros and gain, used both to draw
 * the z-plane / frequency response and to actually filter the dish.
 */

export type SystemPresetType = "lowpass1" | "resonator2" | "moving_avg" | "notch";

export interface ZPoint {
  re: number;
  im: number;
}

export interface ZSystem {
  poles: ZPoint[];
  zeros: ZPoint[];
  /** Overall gain constant g in H(z) = g·Π(z − zᵢ)/Π(z − pⱼ). */
  gain: number;
}

export function systemPolesZeros(
  preset: SystemPresetType,
  poleRadius: number,
  omega0: number,
): ZSystem {
  const r = poleRadius;
  const c = Math.cos(omega0);
  const s = Math.sin(omega0);
  switch (preset) {
    case "lowpass1":
      // y[n] = (1 − r)x[n] + r·y[n−1]  →  H(z) = (1 − r)z / (z − r)
      return { poles: [{ re: r, im: 0 }], zeros: [{ re: 0, im: 0 }], gain: 1 - r };
    case "resonator2":
      // y[n] = x[n] + 2r·cos(ω0)y[n−1] − r²y[n−2]  →  z² / (z − re^{jω0})(z − re^{−jω0})
      return {
        poles: [
          { re: r * c, im: r * s },
          { re: r * c, im: -r * s },
        ],
        zeros: [
          { re: 0, im: 0 },
          { re: 0, im: 0 },
        ],
        gain: 1,
      };
    case "moving_avg": {
      // (1/6)(1 − z⁻⁶)/(1 − z⁻¹) = (1/6)(z⁵ + … + 1)/z⁵
      const zeros: ZPoint[] = [];
      for (let k = 1; k < 6; k++) {
        const a = (2 * Math.PI * k) / 6;
        zeros.push({ re: Math.cos(a), im: Math.sin(a) });
      }
      const poles = Array.from({ length: 5 }, () => ({ re: 0, im: 0 }));
      return { poles, zeros, gain: 1 / 6 };
    }
    case "notch":
      return {
        zeros: [
          { re: c, im: s },
          { re: c, im: -s },
        ],
        poles: [
          { re: 0.85 * c, im: 0.85 * s },
          { re: 0.85 * c, im: -0.85 * s },
        ],
        gain: 1,
      };
  }
}

/** Real coefficients of Π(z − rootᵢ), highest power first (roots come in conjugate pairs). */
function expandRoots(roots: ZPoint[]): number[] {
  let re = [1];
  let im = [0];
  for (const root of roots) {
    const nre = new Array<number>(re.length + 1).fill(0);
    const nim = new Array<number>(re.length + 1).fill(0);
    for (let k = 0; k < re.length; k++) {
      nre[k]! += re[k]!;
      nim[k]! += im[k]!;
      // − root · coef
      nre[k + 1]! -= root.re * re[k]! - root.im * im[k]!;
      nim[k + 1]! -= root.re * im[k]! + root.im * re[k]!;
    }
    re = nre;
    im = nim;
  }
  return re;
}

/**
 * Runs x through the system's difference equation
 *   Σ a_k y[n−k] = g·Σ b_k x[n−k]  (a_0 = 1)
 * obtained from its poles and zeros. Unstable systems (|p| ≥ 1) really do
 * grow without bound; the caller decides how to present that.
 */
export function applySystem(x: number[], sys: ZSystem): number[] {
  const a = expandRoots(sys.poles);
  const bRaw = expandRoots(sys.zeros).map((v) => v * sys.gain);
  // Divide numerator and denominator by z^{#poles} to get powers of z⁻¹.
  const lead = Math.max(0, sys.poles.length - sys.zeros.length);
  const b = [...new Array<number>(lead).fill(0), ...bRaw];
  const y = new Array<number>(x.length).fill(0);
  for (let n = 0; n < x.length; n++) {
    let acc = 0;
    for (let k = 0; k < b.length && k <= n; k++) acc += b[k]! * x[n - k]!;
    for (let k = 1; k < a.length && k <= n; k++) acc -= a[k]! * y[n - k]!;
    y[n] = Number.isFinite(acc) ? acc : 0;
  }
  return y;
}

/** Sampling rate below which the station's wobble sensor aliases. */
export const SYSTEM_ALIAS_FREE_FS = 4000;

/**
 * Station accuracy: the cart must be stable (all poles inside |z| = 1) and
 * the sensor alias-free. Stability dominates; aliasing costs 40%.
 */
export function systemAccuracy(sys: ZSystem, samplingRateHz: number): number {
  const maxPole = Math.max(0, ...sys.poles.map((p) => Math.hypot(p.re, p.im)));
  const stability = maxPole < 1 ? 100 : 15;
  const aliasFactor = samplingRateHz >= SYSTEM_ALIAS_FREE_FS ? 1 : 0.6;
  return Math.round(stability * aliasFactor);
}
