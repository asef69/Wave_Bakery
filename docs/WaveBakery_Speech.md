# WaveBakery — presentation speech (about 4 minutes)

Two speakers. Each block is said while the named slide is on screen; it names what that phase does and which signal-processing algorithm it uses. The same text is in the speaker notes of the web deck and the PowerPoint.

## Kazi Asef Kabir

**Slide 1 · WaveBakery**

Assalamu alaikum. I am Kazi Asef Kabir, and with Tajrian Shams Sneha I built WaveBakery: a cooking game in which every kitchen action is a real signal-processing operation that you can see, hear and get scored on.

**Slide 2 · Equations you can see, hear and score**

In WaveBakery every ingredient is a discrete-time signal, every station is a system that transforms it, and the finished dish is the output of the whole chain. The player's goal is to make that output match a hidden reference signal.

**Slide 3 · One dish, one signal chain**

A run has eight stations in order: generate, wash, mix, season, marinate, cook, then the Precision Oven and the delivery cart. The reference dish is the same chain applied to clean ingredients with the recipe's ideal parameters, so a perfect player can reproduce it exactly.

**Slide 4 · Generate, wash, mix**

Generation synthesizes each ingredient from its equation, for example square and triangle waves, whose Fourier series contain only odd harmonics, and samples it at 401 points over one normalized second. Washing is frequency-domain filtering: we compute the FFT, multiply it by a raised-cosine low-pass mask, and take the inverse FFT. Mixing is superposition: the ingredient signals are added and scaled by one over root K.

**Slide 5 · Season, marinate, cook**

Seasoning is amplitude scaling and time scaling, A times x of alpha t, computed by resampling with linear interpolation. Marinating is a time shift; the server delays by fractional samples using the shift theorem, a linear phase in the FFT. Cooking is convolution: the dish is convolved with the appliance's 96-tap impulse response using the circular convolution sum. Now Tajrian will explain the finishing stations.

## Tajrian Shams Sneha

**Slide 6 · Precision Oven**

Thank you. Cooking leaves a burnt overtone between two harmonics. In the Precision Oven we find f max as the frequency holding 95 percent of the energy, and the player must sample at the Nyquist rate, two f max, or the dish aliases. A radix-2 Cooley-Tukey FFT gives the spectrum; the equaliser applies band gains, a Gaussian low-pass and a notch with 98 percent rejection; and an inverse FFT with periodic-sinc interpolation rebuilds the dish.

**Slide 7 · System Delivery**

The delivery cart adds a road vibration. The cart is an IIR filter designed on the z-plane: its poles and zeros are expanded into coefficients and the difference equation runs to steady state. A notch puts zeros on the unit circle at the road frequency and poles at radius 0.85, and every pole must stay inside the circle for BIBO stability. A slow sensor aliases the frequency, so a notch aimed there misses.

**Slide 8 · The browser plays, the server judges**

The browser runs every station instantly, but it sends only the player's settings. The FastAPI server regenerates the ingredients from a seed, rebuilds the dish with NumPy and SciPy, and scores it, so scores cannot be faked. It runs on Vercel with a Supabase PostgreSQL database.

**Slide 9 · How a dish becomes a score**

The server compares the served dish with the reference using signal-to-noise ratio in decibels, the peak of the normalized cross-correlation, and the cosine similarity of the decibel spectra, weighted 40, 35 and 25 percent. Washing quality scales that score, then a tolerance curve, the difficulty multiplier and a time bonus are applied.

**Slide 10 · Results and thank you**

Perfect play matches the reference on every recipe; a perfect finish scores 93 to 98 on the server, and leaving the notch off drops it to 17 to 36. The project has 295 automated tests and is live at wavekitchen dot vercel dot app. Thank you; we welcome your questions.

---

Total: 548 words, about 3 minutes 50 seconds at a relaxed pace.
