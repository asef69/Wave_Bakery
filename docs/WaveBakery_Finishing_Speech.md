# WaveBakery — from the Precision Oven to the final score (about 5 minutes)

Speaker: Tajrian Shams Sneha. Picks up after the Cooking Lab (slides 6–10). Each block names the concept, says it in plain words, and gives the one line to point at on screen. Every number is what the code uses, shown for the burger.

---

**Slide 6 · Precision Oven — the problem**
*Concept: a signal as a sum of frequencies*

Thank you. When we cook, the dish comes out slightly burnt. In signal terms, cooking leaves an unwanted tone, a burnt overtone, at 18 hertz for the burger. It sits in the gap between two of the dish's real harmonics. Our job in the oven is to find that one frequency and remove it without touching the rest of the dish.

> dish + burnt overtone = x[n] + 0.8·peak·sin(2π·18·t)

**Step 1 · Sampling lock**
*Concept: Nyquist sampling and aliasing*

The oven can only work on what it samples, so first we choose a sampling rate. We measure f-max, the frequency below which 95 percent of the dish's energy lies. The Nyquist theorem says we must sample at least twice that fast. For the burger that means at least 38 samples per second. If we sample slower, high frequencies fold down and pretend to be low ones. That is aliasing, and the screen shows those fake peaks in red.

> f_s ≥ 2·f_max   too slow ⇒ f_alias = |f − m·f_s|

**Steps 2 and 3 · Unlock and the FFT Lab**
*Concept: the Fourier transform*

Once the rate is safe, the Fourier transform turns the dish from a wave in time into a list of frequencies: how much of each one the dish contains. We use the radix-2 Cooley–Tukey FFT. It splits the samples into even and odd halves again and again, which is why it is fast: N log N steps instead of N squared. Now the burnt overtone is easy to see, as a single spike where the target dish has nothing.

> X[k] = Σ x[n]·e^(−j2πkn/N)   X[k] = E[k] + Wᵏ·O[k]

**The equaliser**
*Concept: filtering by multiplying the spectrum*

Filtering in the frequency domain is simple: multiply every frequency by a gain. The oven has three band sliders, a browning cutoff that gently rolls off the highest frequencies, and a notch. The notch is a very narrow eraser. Placed on 18 hertz, it removes 98 percent of the overtone and leaves the neighbouring harmonics almost untouched. The dish only needs the notch, so the band sliders should stay at one.

> Y[k] = H[k]·X[k]   H_notch = 1 − 0.98 / (1 + (Δf/1.5)²)

**Steps 4 and 5 · IFFT and final check**
*Concept: reconstruction*

The inverse FFT turns the cleaned spectrum back into a wave. Periodic-sinc interpolation joins the samples into a smooth dish, and the final check compares it with the target.

> x[n] = (1/N) Σ Y[k]·e^(j2πkn/N)

---

**Slide 7 · System Delivery**
*Concept: z-plane design, poles and zeros*

On the way to the customer, the cart shakes: the road adds a 2600 hertz vibration, measured at 8 kilohertz. In digital frequency that is omega-zero, 0.65 pi radians per sample. The cart is a filter we design on the z-plane. A zero pulls the response down near its frequency; a pole pushes it up. We put two zeros exactly on the unit circle at omega-zero, so the vibration is cancelled completely. Two poles sit just inside, at radius 0.85, so the notch stays narrow and the dish passes at full strength.

> ω₀ = 2π·2600/8000 = 0.65π   H(z) = g·(z − e^(jω₀))(z − e^(−jω₀)) / ((z − 0.85e^(jω₀))(z − 0.85e^(−jω₀)))

*Concept: difference equation and stability*

Multiplying out H of z gives a difference equation: each output sample is built from the last three inputs and the last two outputs. Because every pole is inside the unit circle, the filter is BIBO stable: a bounded input gives a bounded output. Drag a pole outside and the output explodes. Aim a resonator at the road instead of a notch and it amplifies the shake almost six times.

> y[n] = b₀x[n] + b₁x[n−1] + b₂x[n−2] − a₁y[n−1] − a₂y[n−2]   |p| = 0.85 < 1

*Concept: aliasing again*

The sensor matters too. A 3 kilohertz sensor is slower than twice 2600, so it reports the vibration at 400 hertz. A notch aimed at 400 hertz misses the real shake. Sampling correctly comes first.

---

**Slide 8 · The browser plays, the server judges**
*Concept: reproducible signal processing*

The browser runs every station instantly, but it sends only the settings, never the audio. Our FastAPI server regenerates the ingredients from the same seed and rebuilds the dish with NumPy and SciPy. So the score cannot be faked. It runs on Vercel, with a Supabase PostgreSQL database for the leaderboard.

**Slide 9 · Scoring**
*Concept: measuring similarity between signals*

The server compares the served dish with the reference in three ways. Spectral similarity, 40 percent, asks: do they contain the same frequencies? Correlation, 35 percent, asks: do they have the same shape, even if shifted in time? Signal-to-noise ratio, 25 percent, asks: how big is the error compared with the dish? Washing quality then scales the result, and the recipe's tolerance sets how strict the curve is. The points are the dish score times ten, times the difficulty multiplier, plus two points for every second left.

> S = 40%·spectral + 35%·correlation + 25%·SNR   SNR = 10·log₁₀(Σr² / Σ(r − y)²)
> points = S × 10 × difficulty + min(2 × seconds left, 300) × difficulty

**Slide 10 · Results**
*Concept: why the notch matters*

A perfect run matches the reference on every recipe. With the notch on, the finish scores 93 to 98; leave it off and it drops to 17 to 36. One well-placed zero makes that difference. WaveBakery has 295 automated tests and is live at wavekitchen dot vercel dot app. Thank you; we welcome your questions.
