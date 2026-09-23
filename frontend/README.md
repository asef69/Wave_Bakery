# WaveKitchen Labs

Create the frontend prototype for a game called "WaveKitchen".

WaveKitchen is an educational cooking game based on Signals and Linear Systems. The player cooks recipes by performing interactive signal-processing operations such as FFT-based filtering, signal mixing, amplitude scaling, time scaling, time shifting, and convolution.

This is ONLY a frontend/UI prototype for now. Do not implement real signal-processing mathematics, FFT algorithms, audio processing, or backend functionality. Use realistic visual placeholders for waveforms and signal graphs where needed.

VISUAL IDENTITY:

The game combines two visual worlds:

1. WARM KITCHEN:

- Cozy, colorful, playful cooking-game atmosphere.

- Warm kitchen surfaces, food, cooking equipment and friendly visuals.

- Rounded UI elements.

- Cheerful but not childish.

2. FUTURISTIC SIGNAL LABORATORY:

- Clean technical interface.

- Darker panels with glowing signal visualizations.

- Grid lines, waveform displays, frequency-spectrum style graphics.

- Scientific but still visually consistent with the kitchen.

The transition between these two styles should feel intentional.

GAME STRUCTURE:

The main navigation should eventually support:

- Loading screen

- Main Menu

- How to Play / Tutorial

- Recipe Book

- Recipe Briefing

- Kitchen Hub

- Signal Processing Labs

- Final Comparison / Score

- Recipe Completion

For now, create the application foundation and routing structure for these screens, but only fully design the Loading Screen and Main Menu. The other routes can contain simple placeholder screens indicating their purpose.

MAIN MENU:

Create a polished main menu with:

- Large "WAVEKITCHEN" title

- Subtitle: "Cook. Process. Create."

- Warm futuristic kitchen background

- A friendly robot chef named "Chef Fourier"

- Primary button: "START COOKING"

- Secondary buttons: "RECIPE BOOK", "HOW TO PLAY", and "SETTINGS"

CHEF FOURIER:

Chef Fourier is the player's robot chef guide throughout the game.

For now, show him prominently on the main menu with a speech bubble:

"Ready to cook something... scientifically?"

Create the character area so that a custom illustration can later replace the placeholder.

LOADING SCREEN:

Create a short loading/splash screen for WaveKitchen.

Show:

- WaveKitchen logo/title

- A subtle animated waveform

- Loading indicator

- Text such as "Calibrating the kitchen..."

- Chef Fourier

DESIGN SYSTEM:

Use a consistent rounded-card UI style.

Use warm kitchen colors combined with futuristic signal-lab accents.

Do not make the interface look like a generic SaaS dashboard.

It should feel like an interactive educational game.

Make the layout desktop-first because this will be a localhost PC web application.

Keep the code/components organized and reusable because this prototype will later serve as the frontend reference for a real React implementation.

## Development

To run WaveBakery locally:

```sh
npm install
npm run dev
```
