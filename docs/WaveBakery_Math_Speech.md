# WaveBakery — the mathematics inside, a second speech (about 6 minutes)

Two speakers, same slides as the main deck. Each block is the spoken text; the line under it is the equation to point at while saying it. Every equation is the one the code runs (`backend/app/dsp/core.py`, `pipeline.py`, `metrics.py`, `delivery.py`, `gameplay.py`).

## Kazi Asef Kabir

**Slide 1–2 · A dish is a signal**

Assalamu alaikum. We are Kazi Asef Kabir and Tajrian Shams Sneha, and this talk shows the mathematics inside each WaveBakery station. Every ingredient is a discrete-time signal, 401 samples over one normalised second. Every station is a system, and the dish is the whole chain applied in order.

> x[n], n = 0 … 400, t = n / 400  y = T₈(T₇( … T₁(x)))

**Slide 3 · The reference**

The reference dish is the same chain run on clean ingredients with the recipe's ideal settings, so a perfect player can match it exactly.

> y_ref = T(x_clean; θ*)

**Slide 4 · Generate, wash, mix**

A square wave is a sum of odd harmonics falling as one over n; a triangle wave's fall as one over n squared, so it sounds softer. Washing uses the discrete Fourier transform. We multiply the spectrum by a mask that is one in the passband and zero in the stopband, joined by a raised cosine so there is no sharp edge to cause ringing, then take the inverse transform. Mixing is superposition, divided by root K, because the powers of K independent ingredients add and this keeps the loudness constant.

> square = (4/π) Σ sin((2k+1)ωt)/(2k+1)  X[k] = Σ x[n] e^(−j2πkn/N)
> H(f) = ½ + ½ cos(π(f − f_c)/w) on the edge  y = (1/√K) Σ xᵢ

**Slide 5 · Season, marinate, cook**

Seasoning computes A times x of alpha n. When alpha n falls between two samples, linear interpolation blends the two neighbours. Alpha greater than one compresses time and raises every frequency by alpha. Marinating is a delay of n-zero samples. For a fractional delay, the shift theorem turns the delay into a linear phase ramp in the spectrum, so we can delay by less than a sample. Cooking is convolution with the appliance's impulse response. We compute it with FFTs, because convolution in time is multiplication in frequency: N log N work instead of N times M. Tajrian?

> y[n] = A·x(αn), x(m + f) ≈ x[m] + f(x[m+1] − x[m])  Y[k] = X[k]·e^(−j2πk·n₀/N)
> y[n] = Σ h[k] x[n − k] ⇔ Y = H·X

## Tajrian Shams Sneha

**Slide 6 · Precision Oven**

Thank you. First the oven finds f-max, the frequency below which 95 percent of the energy lies. By Nyquist, the sampling rate must be at least two f-max; slower, and a tone folds down to a false, aliased frequency. A radix-2 Cooley–Tukey FFT splits the samples into even and odd halves and joins them with twiddle factors, cutting N-squared work to N log N. The equaliser multiplies band gains by a Gaussian roll-off above the cutoff and by a notch that removes 98 percent at the burnt overtone. The inverse FFT rebuilds the dish.

> Σ_{k ≤ k_max} |X[k]|² = 0.95 Σ |X[k]|²  f_s ≥ 2 f_max  f_alias = |f − m·f_s|
> X[k] = E[k] + Wᵏ O[k], X[k + N/2] = E[k] − Wᵏ O[k], W = e^(−j2π/N)
> G(f) = g_band · e^(−((f − f_c)/4)²) · (1 − 0.98 / (1 + (Δf/1.5)²))

**Slide 7 · System Delivery**

The delivery cart adds a road vibration to the finished dish: a cosine at 2600 hertz for the burger, defined at a sampling rate of 8 kilohertz. In digital frequency that is omega-zero equals two pi times 2600 over 8000, which is 0.65 pi, about 2.04 radians per sample.

> x_road[n] = x[n] + 0.8·peak(x)·cos(ω₀n)  ω₀ = 2π·f_road / f_s = 2π·2600/8000 = 0.65π ≈ 2.04 rad

The cart is a filter we design on the z-plane, by placing poles and zeros. The notch puts two zeros exactly on the unit circle, at e to the plus and minus j omega-zero. Two poles sit on the same angles at radius 0.85, and a gain g sets the response to one away from the notch.

> H(z) = g · (z − e^(jω₀))(z − e^(−jω₀)) / ((z − 0.85e^(jω₀))(z − 0.85e^(−jω₀)))  g ≈ 0.858

To read the response at a frequency omega, we stand at e to the j omega on the unit circle. The gain is the product of the distances to the zeros divided by the product of the distances to the poles. At the road frequency a zero distance is zero, so the gain is exactly zero. Just 0.3 radians away, each pole sits almost as close as its zero, so the gain is already 0.88, and at DC, where the dish lives, it is exactly one. That is why the poles matter: they make the notch narrow.

> |H(e^(jω))| = g · Π|e^(jω) − zᵢ| / Π|e^(jω) − pᵢ|  |H| = 0 at ω₀, 0.53 at ω₀ + 0.1, 0.88 at ω₀ + 0.3, 1 at ω = 0

Multiplying out the two factors gives the coefficients, and the inverse z-transform turns them into a second-order difference equation, which the server runs sample by sample; its last feedback coefficient is 0.85 squared, 0.7225.

> y[n] = 0.858x[n] + 0.779x[n−1] + 0.858x[n−2] − 0.772y[n−1] − 0.7225y[n−2]

Every pole has radius 0.85, inside the unit circle, so the filter is BIBO stable. Its start-up transient dies like 0.85 to the n: below one percent after 29 samples. A pole dragged onto or outside the circle makes the output grow without bound. A resonator aimed at the road does the opposite of a notch and amplifies it almost six times.

> |pᵢ| < 1 ⇒ BIBO stable  transient ∝ 0.85ⁿ < 0.01 for n ≥ 29  resonator (r = 0.9) at ω₀: |H| ≈ 5.9

Last, the sensor. A 3 kilohertz sensor is slower than twice 2600, so it folds the road tone down to 3000 minus 2600, 400 hertz. A notch aimed at that reading misses the real vibration and leaves 99 percent of it. The cart is then scored against the reference dish on a common scale, so any leftover vibration costs points.

> f_s = 3000 < 2·2600 ⇒ f_alias = |2600 − 3000| = 400 Hz  notch at 400 Hz leaves |H(e^(jω₀))| ≈ 0.99 of the road

**Slide 8 · The browser plays, the server judges**

The browser runs these equations for instant feedback; the server replays them in NumPy from the same seed, so scores cannot be faked.

**Slide 9 · Scoring**

The score is 40 percent spectral similarity, 35 percent correlation and 25 percent signal-to-noise ratio. SNR is the reference energy over the error energy in decibels, mapped from minus 5 to 25 decibels. Correlation is the cross-correlation peak divided by the root of both energies, so a pure time lag is forgiven. Spectral similarity is the cosine of the angle between the two decibel spectra. Washing quality then scales the score, and the recipe's tolerance curve raises it to a power gamma.

> S = 100(0.40 S_spec + 0.35 S_corr + 0.25 S_snr)  SNR = 10 log₁₀(Σr² / Σ(r − y)²)
> ρ = maxₗ R_xy[l] / √(E_x E_y)  S_spec = A·B / (‖A‖‖B‖)  final = 100 (S(0.72 + 0.28 p)/100)^γ

**Slide 10 · Results**

With the notch on, a perfect finish scores 93 to 98. Without it, 17 to 36: two zeros on the unit circle make all that difference. Thank you; we welcome your questions.
