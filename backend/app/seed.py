"""Seed the catalogue: ingredients, appliances and the starting recipe book."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from .models import Appliance, Ingredient, Recipe

INGREDIENTS = [
    # Produce / Washables
    dict(id='lettuce', name='Lettuce', emoji='🥬', voice='lettuce', f0=440.0, color='#5eb35e',
         signature='Band-limited noise with sustained series', washable=True, ideal_cutoff=380.0,
         kind='lettuce', category='Produce'),
    dict(id='tomato', name='Tomato', emoji='🍅', voice='tomato', f0=262.0, color='#e0483a',
         signature='A tall stack of harmonics that decay at different rates', washable=True, ideal_cutoff=520.0,
         kind='tomato', category='Produce'),
    dict(id='onion', name='Onion', emoji='🧅', voice='onion', f0=587.0, color='#c79ad6',
         signature='A near-pure tone plus band-limited breath noise', washable=True, ideal_cutoff=640.0,
         kind='onion', category='Produce'),
    dict(id='cucumber', name='Cucumber', emoji='🥒', voice='cucumber', f0=450.0, color='#48c774',
         signature='High-register agile woodwind tone with crisp flutter', washable=True, ideal_cutoff=450.0,
         kind='cucumber', category='Produce'),
    dict(id='carrot', name='Carrot', emoji='🥕', voice='carrot', f0=500.0, color='#ff8c00',
         signature='Hollow woodwind spectrum dominated by odd harmonics', washable=True, ideal_cutoff=500.0,
         kind='carrot', category='Produce'),

    # Bakery & Grains
    dict(id='bun', name='Bun', emoji='🍞', voice='bun', f0=160.0, color='#d2b48c',
         signature='Warm resonant wooden bar strike with fast attack', washable=False, ideal_cutoff=None,
         kind='bun', category='Bakery'),
    dict(id='bread', name='Bread', emoji='🍞', voice='bread', f0=160.0, color='#d2b48c',
         signature='Tuned woody harmonic bar resonance', washable=False, ideal_cutoff=None,
         kind='bread', category='Bakery'),
    dict(id='noodles', name='Noodles', emoji='🍜', voice='noodles', f0=220.0, color='#f5deb3',
         signature='Cascading plucked string harmonics', washable=False, ideal_cutoff=None,
         kind='noodles', category='Bakery'),
    dict(id='flour', name='Flour', emoji='🌾', voice='flour', f0=130.0, color='#f5f5dc',
         signature='Multi-rank harmonic pipe organ tone', washable=False, ideal_cutoff=None,
         kind='flour', category='Bakery'),

    # Proteins & Dairy
    dict(id='patty', name='Beef Patty', emoji='🥩', voice='patty', f0=90.0, color='#c0553f',
         signature='One fat low-frequency lobe with a broadband click at attack', washable=False, ideal_cutoff=None,
         kind='patty', category='Protein'),
    dict(id='meat', name='Meat', emoji='🥩', voice='patty', f0=90.0, color='#c0553f',
         signature='One fat low-frequency lobe with a broadband click at attack', washable=False, ideal_cutoff=None,
         kind='patty', category='Protein'),
    dict(id='chicken', name='Chicken', emoji='🍗', voice='chicken', f0=110.0, color='#e3a857',
         signature='Punchy low-mid drum transient', washable=False, ideal_cutoff=None,
         kind='chicken', category='Protein'),
    dict(id='cheese', name='Cheese', emoji='🧀', voice='cheese', f0=330.0, color='#e8b73a',
         signature='A plucked string and flute tone with odd harmonics', washable=False, ideal_cutoff=None,
         kind='cheese', category='Dairy'),
    dict(id='egg', name='Egg', emoji='🥚', voice='egg', f0=260.0, color='#ffebcd',
         signature='Resonant plucked metallic tone', washable=True, ideal_cutoff=460.0,
         kind='egg', category='Protein'),
    dict(id='milk', name='Milk', emoji='🥛', voice='milk', f0=300.0, color='#f8f8ff',
         signature='Smooth sustained woodwind tone', washable=False, ideal_cutoff=None,
         kind='milk', category='Dairy'),
    dict(id='butter', name='Butter', emoji='🧈', voice='butter', f0=180.0, color='#ffe4b5',
         signature='Warm reedy low double-reed harmonics', washable=False, ideal_cutoff=None,
         kind='butter', category='Dairy'),

    # Pantry
    dict(id='sugar', name='Sugar', emoji='🍬', voice='sugar', f0=700.0, color='#ffb6c1',
         signature='Bright crystalline bell chime', washable=False, ideal_cutoff=None,
         kind='sugar', category='Pantry'),
    dict(id='salt', name='Salt', emoji='🧂', voice='salt', f0=800.0, color='#e6e6fa',
         signature='High ringing metallic sustain', washable=False, ideal_cutoff=None,
         kind='salt', category='Pantry'),
    dict(id='sauce', name='Sauce', emoji='🥫', voice='sauce', f0=240.0, color='#dc143c',
         signature='Rich odd-harmonic woodwind resonance', washable=False, ideal_cutoff=None,
         kind='sauce', category='Pantry'),
    dict(id='garlic', name='Garlic', emoji='🧄', voice='bell', f0=520.0, color='#e9e2cf',
         signature='Inharmonic partials at 1, 2.76, 5.40, 8.93 and 13.3 times f0', washable=False, ideal_cutoff=None,
         kind='generic', category='Pantry'),
    dict(id='mushroom', name='Mushroom', emoji='🍄', voice='pad', f0=147.0, color='#a8734f',
         signature='Three detuned saw stacks; warm and crowded in the low-mids', washable=False, ideal_cutoff=None,
         kind='generic', category='Produce'),
    dict(id='pepper', name='Pepper', emoji='🌶️', voice='shaker', f0=0.0, color='#d63b3b',
         signature='Band-limited noise from 4 to 9 kHz with no fundamental', washable=False, ideal_cutoff=None,
         kind='generic', category='Pantry'),
]

APPLIANCES = [
    dict(id='grill', name='Grill', emoji='🔥', character='Comb / periodic notches',
         blurb='A comb of discrete echoes 90 samples apart — hollow, ringing colouration.'),
    dict(id='fry', name='Fry', emoji='🍳', character='Bright short reverb',
         blurb='A short bright exponential decay; crisp, and the highs survive.'),
    dict(id='bake', name='Bake', emoji='🍞', character='Dark long reverb (low-pass)',
         blurb='A long dark decay — a warm oven rolls the top end away.'),
    dict(id='boil', name='Boil', emoji='🍲', character='Resonant band-pass',
         blurb='A damped 320 Hz sinusoid; the pot rings at its own resonance.'),
    dict(id='simmer', name='Simmer', emoji='♨️', character='Moving average (low-pass)',
         blurb='A 48-tap moving average — the textbook smoothing filter.'),
    dict(id='sear', name='Flash Sear', emoji='⚡', character='Differencer (high-pass)',
         blurb='The first difference h = [1, -1]; every edge is sharpened.'),
    dict(id='smoke', name='Smoke', emoji='💨', character='Diffuse comb tail',
         blurb='A sparse comb convolved with a decay tail — diffuse and smoky.'),
    dict(id='steam', name='Steam', emoji='🫧', character='Dual resonance',
         blurb='Two resonators at 480 Hz and 1150 Hz — a double-peaked response.'),
]

RECIPES = [
    # 1. Master Frontend Recipes
    dict(id='burger', name='BURGER', emoji='🍔', tier=1, difficulty='Easy',
         tagline='Stack the layers, stack the signals.', page_number=1,
         prep_time='5 mins', servings='1 hearty burger',
         story='Stack the layers, stack the signals in the bowl and convolve on the grill.',
         ingredients=['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'salt'],
         washable_ingredients=['lettuce', 'tomato'],
         appliances=['grill'], cooking_method='grill',
         seasoning=1.5, blend=0.8, marinate=1.25,
         noise_difficulty=0.9, tolerance=1.1,
         teaches=['Signal Generation', 'Frequency Filtering', 'Superposition Mixing', 'Amplitude & Frequency Scaling', 'Time Scaling', 'Grill Convolution']),
    dict(id='sandwich', name='SANDWICH', emoji='🥪', tier=1, difficulty='Easy',
         tagline='A crisp mix with a clean spectrum.', page_number=2,
         prep_time='3 mins', servings='1 deli sandwich',
         story='A crisp mix with a clean spectrum. Toast lightly on the grill.',
         ingredients=['bread', 'chicken', 'cheese', 'lettuce', 'tomato', 'salt', 'sauce'],
         washable_ingredients=['lettuce', 'tomato'],
         appliances=['grill'], cooking_method='grill',
         seasoning=1.2, blend=1.1, marinate=0.85,
         noise_difficulty=0.8, tolerance=1.15,
         teaches=['Frequency Filtering', 'Superposition', 'Amplitude / Frequency Tuning', 'Time Compression', 'Grill Convolution']),
    dict(id='cake', name='CAKE', emoji='🧁', tier=2, difficulty='Medium',
         tagline='Fold the harmonics gently.', page_number=3,
         prep_time='12 mins', servings='1 whole sponge cake',
         story='Fold the harmonics gently. Whip the batter directly into the bowl and bake in the oven.',
         ingredients=['flour', 'egg', 'butter', 'sugar', 'milk'],
         washable_ingredients=[],
         appliances=['bake'], cooking_method='bake',
         seasoning=1.8, blend=0.6, marinate=1.5,
         noise_difficulty=0.7, tolerance=1.05,
         teaches=['Superposition without filtering', 'Harmonic sweetening', 'Time stretch rising', 'Bake Convolution']),
    dict(id='noodles', name='NOODLES', emoji='🍜', tier=2, difficulty='Medium',
         tagline='Stretch the time axis, not the noodles.', page_number=4,
         prep_time='8 mins', servings='1 steaming bowl',
         story='Stretch the time axis, not the noodles. Rinse scallions & onions, mix broth and boil.',
         ingredients=['noodles', 'egg', 'chicken', 'onion', 'salt'],
         washable_ingredients=['onion', 'egg'],
         appliances=['boil'], cooking_method='boil',
         seasoning=1.3, blend=1.2, marinate=1.75,
         noise_difficulty=1.0, tolerance=1.0,
         teaches=['Aromatic Filtering', 'Broth Superposition', 'Harmonic Time Stretch', 'Boil Resonator Convolution']),
    dict(id='chicken-fry', name='CHICKEN FRY', emoji='🍗', tier=3, difficulty='Hard',
         tagline='Crunch is just high-frequency content.', page_number=5,
         prep_time='10 mins', servings='1 basket',
         story='Crunch is just high-frequency content. Coat chicken in seasoned batter and deep fry.',
         ingredients=['chicken', 'flour', 'egg', 'salt', 'butter'],
         washable_ingredients=[],
         appliances=['fry'], cooking_method='fry',
         seasoning=2.0, blend=1.4, marinate=1.4,
         noise_difficulty=1.2, tolerance=0.9,
         teaches=['Multi-ingredient Coating', 'High Frequency Scaling', 'Brining Time Expansion', 'Dense Fry Convolution']),

    # 2. Tutorial & Advanced Progression Dishes
    dict(id='toast', name='Golden Toast', emoji='🍞', tier=1, difficulty='Easy',
         tagline='Your first shift. One ingredient, one oven.', page_number=6,
         prep_time='2 mins', servings='1 slice',
         story='Your first shift. One ingredient, one oven, one lesson: filtering.',
         ingredients=['cheese'], washable_ingredients=[],
         appliances=['bake'], cooking_method='bake',
         seasoning=1.0, blend=1.0, marinate=1.0,
         noise_difficulty=0.6, tolerance=1.25,
         teaches=['FFT', 'Frequency-domain filtering', 'Inverse FFT', 'Convolution']),
    dict(id='soup', name='Velvet Soup', emoji='🍲', tier=2, difficulty='Medium',
         tagline='Blend it smooth, then let it ring in the pot.', page_number=7,
         prep_time='6 mins', servings='1 bowl',
         story='Blend it smooth, then let it ring in the pot.',
         ingredients=['onion', 'salt', 'butter'], washable_ingredients=['onion'],
         appliances=['boil'], cooking_method='boil',
         seasoning=0.65, blend=0.7, marinate=1.05,
         noise_difficulty=1.1, tolerance=1.0,
         teaches=['Time scaling', 'Resonant systems', 'Moving-average smoothing']),
    dict(id='salad', name='Crisp Salad', emoji='🥗', tier=2, difficulty='Medium',
         tagline='No heat, all texture. Chop carefully.', page_number=8,
         prep_time='4 mins', servings='1 bowl',
         story='No heat, all texture. Chop carefully — the Nyquist inspector is watching.',
         ingredients=['lettuce', 'tomato', 'cucumber'], washable_ingredients=['lettuce', 'tomato', 'cucumber'],
         appliances=['grill'], cooking_method='grill',
         seasoning=0.9, blend=1.0, marinate=1.02,
         noise_difficulty=1.2, tolerance=1.0,
         teaches=['Sampling & decimation', 'Aliasing / Nyquist', 'High-pass differencing']),
    dict(id='stirfry', name='Sizzling Stir-Fry', emoji='🍜', tier=3, difficulty='Hard',
         tagline='Fast wok work: compress the signal.', page_number=9,
         prep_time='7 mins', servings='1 plate',
         story='Fast wok work: compress the signal, fry it hot, finish with smoke.',
         ingredients=['meat', 'pepper', 'onion', 'mushroom'], washable_ingredients=['onion'],
         appliances=['fry', 'smoke'], cooking_method='fry',
         seasoning=1.15, blend=1.4, marinate=0.12,
         noise_difficulty=1.5, tolerance=0.9,
         teaches=['Time compression', 'Multi-ingredient superposition', 'Diffuse comb systems']),
    dict(id='creme', name='Crème Brûlée', emoji='🍮', tier=3, difficulty='Hard',
         tagline='Steam the custard, then caramelise with AM.', page_number=10,
         prep_time='15 mins', servings='1 ramekin',
         story='Steam the custard, then caramelise the top with amplitude modulation.',
         ingredients=['egg', 'sugar', 'milk', 'butter'], washable_ingredients=['egg'],
         appliances=['bake'], cooking_method='bake',
         seasoning=0.75, blend=0.85, marinate=1.16,
         noise_difficulty=1.6, tolerance=0.85,
         teaches=['Amplitude modulation', 'Sideband generation', 'Dual-resonance systems']),
    dict(id='feast', name="Chef's Grand Feast", emoji='👑', tier=4, difficulty='Masterchef',
         tagline='Everything you know, at once.', page_number=11,
         prep_time='20 mins', servings='1 grand banquet',
         story='Everything you know, at once. Five ingredients, three appliances, no hints.',
         ingredients=['patty', 'cheese', 'tomato', 'lettuce', 'bun'], washable_ingredients=['lettuce', 'tomato'],
         appliances=['grill'], cooking_method='grill',
         seasoning=0.95, blend=1.25, marinate=1.2,
         noise_difficulty=1.9, tolerance=0.75,
         teaches=['Full pipeline', 'System cascading', 'Modulation + sampling combined']),
]


def seed(db: Session, force: bool = False) -> dict:
    counts = {'ingredients': 0, 'appliances': 0, 'recipes': 0}

    for row in INGREDIENTS:
        db.merge(Ingredient(**row))
        counts['ingredients'] += 1
    for row in APPLIANCES:
        db.merge(Appliance(**row))
        counts['appliances'] += 1
    for row in RECIPES:
        db.merge(Recipe(**row))
        counts['recipes'] += 1

    db.commit()
    return counts


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        print('seeded:', seed(db, force=True))
    finally:
        db.close()


if __name__ == '__main__':
    main()
