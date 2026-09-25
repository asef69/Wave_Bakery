# -*- coding: utf-8 -*-
"""
WaveKitchen Documentation PDF Generator
Generates updated, high-quality specification PDFs:
1. WaveKitchen_Gameplay_Detailed.pdf
2. WaveKitchen_System_Architecture.pdf
"""
import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.pdfgen import canvas

# Palette
C_PRIMARY = colors.HexColor('#0f172a')      # Slate 900
C_SECONDARY = colors.HexColor('#1e293b')    # Slate 800
C_ACCENT = colors.HexColor('#0284c7')       # Sky 600
C_TEAL = colors.HexColor('#0d9488')         # Teal 600
C_ORANGE = colors.HexColor('#ea580c')       # Orange 600
C_BG_LIGHT = colors.HexColor('#f8fafc')     # Slate 50
C_BORDER = colors.HexColor('#cbd5e1')       # Slate 300
C_TEXT = colors.HexColor('#334155')         # Slate 700
C_TEXT_MUTED = colors.HexColor('#64748b')   # Slate 500


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage() # type: ignore

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1: # type: ignore
            return  # Cover page
        self.saveState()
        self.setFont('Helvetica', 8)
        self.setFillColor(C_TEXT_MUTED)
        
        # Header
        self.drawString(54, 750, getattr(self, '_doc_title', 'WaveKitchen'))
        self.drawRightString(612 - 54, 750, getattr(self, '_doc_subtitle', 'Full-Stack DSP Game'))
        self.setStrokeColor(C_BORDER)
        self.setLineWidth(0.5)
        self.line(54, 742, 612 - 54, 742)
        
        # Footer
        self.line(54, 45, 612 - 54, 45)
        self.drawRightString(612 - 54, 32, f'Page {self._pageNumber} of {page_count}') # type: ignore
        self.drawString(54, 32, 'WaveKitchen · Full-Stack DSP Game Specification')
        self.restoreState()


def get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        'CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=32,
        leading=38,
        textColor=colors.white,
        alignment=1
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        fontName='Helvetica',
        fontSize=15,
        leading=20,
        textColor=colors.HexColor('#94a3b8'),
        alignment=1
    ))
    styles.add(ParagraphStyle(
        'CoverPill',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#38bdf8'),
        alignment=1
    ))
    styles.add(ParagraphStyle(
        'CoverMeta',
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    ))
    styles.add(ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=21,
        textColor=C_PRIMARY,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=C_ACCENT,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        'BodyBold',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=C_PRIMARY,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        'Callout',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor('#1e293b'),
    ))
    styles.add(ParagraphStyle(
        'TableHead',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=C_TEXT,
    ))
    styles.add(ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=C_PRIMARY,
    ))
    return styles


def make_callout(text, styles, border_color=C_ACCENT, bg_color=colors.HexColor('#f0f9ff')):
    p = Paragraph(text, styles['Callout'])
    t = Table([[p]], colWidths=[504])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('BOX', (0,0), (-1,-1), 1.0, border_color),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    return t


def draw_cover_bg(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(C_PRIMARY)
    canvas_obj.rect(0, 0, 612, 792, fill=1, stroke=0)
    canvas_obj.restoreState()


def draw_normal_bg(canvas_obj, doc):
    pass


def build_gameplay_pdf(output_path):
    styles = get_styles()
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54
    )
    story = []

    # Cover Elements
    story.append(Spacer(1, 120))
    story.append(Paragraph('WaveKitchen', styles['CoverTitle']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('A Signal Processing Cooking Game', styles['CoverSubtitle']))
    story.append(Spacer(1, 28))
    story.append(Paragraph('GAMEPLAY OVERVIEW & EXPERIMENTAL LAB MANUAL · v2.1', styles['CoverPill']))
    story.append(Spacer(1, 40))
    story.append(Paragraph(
        'FFT · Frequency-Domain Filtering · Superposition · Amplitude & Frequency Tuning<br/>'
        'Time Scaling · Time Shifting · AM Modulation · Decimation / Nyquist<br/>'
        'LTI Convolution · 4-Part Metric Scoring · Phased Array Acoustic Beam Delivery',
        styles['CoverMeta']
    ))
    story.append(PageBreak())

    # Section 1
    story.append(Paragraph('1. What This Game Is', styles['H1']))
    story.append(Paragraph(
        'In <b>WaveKitchen</b>, food is sound. Every ingredient you pick up is an <b>audio signal</b>, '
        'and every action you take in the kitchen is an authentic, authoritative <b>signal processing operation</b>. '
        'You do not click a generic button and watch a progress bar. You inspect the ingredient frequency spectrum, '
        'discriminate between contaminant noise and harmonic flavor, filter the interference using linear phase tools, '
        'combine ingredient waveforms in the mixing bowl, transform amplitude and time scales, and convolve the dish with '
        'appliance impulse responses.',
        styles['Body']
    ))
    story.append(Paragraph(
        'Every station is <b>audible</b> and <b>interactive</b>. You listen to the difference between time scaling and time shifting, '
        'watch constructive interference steer phased acoustic beams, and receive objective score breakdowns calculated server-side.',
        styles['Body']
    ))

    story.append(make_callout(
        '<b>The Golden Rule of WaveKitchen:</b><br/>'
        'The reference dish is produced by evaluating the canonical DSP pipeline on pristine ingredient waveforms '
        'using the target parameters. The player dish is evaluated through the exact same mathematical engine. '
        'Achieving a high score means matching the underlying mathematics — results cannot be forged client-side.',
        styles
    ))
    story.append(Spacer(1, 6))

    flow_data = [
        [Paragraph('<b>Station</b>', styles['TableHead']),
         Paragraph('<b>Kitchen Action</b>', styles['TableHead']),
         Paragraph('<b>Signal Processing Domain Concept</b>', styles['TableHead'])],
        [Paragraph('01. The Pantry', styles['TableCellBold']), Paragraph('Ingredient Selection & Delivery', styles['TableCell']), Paragraph('Harmonic Synthesis & Stochastic Noise Contamination', styles['TableCell'])],
        [Paragraph('02. Filtering Lab', styles['TableCellBold']), Paragraph('Washing Fresh Produce', styles['TableCell']), Paragraph('FFT, Spectral Masking, Frequency-Domain Low/Bandpass, IFFT', styles['TableCell'])],
        [Paragraph('03. Mixing Bowl', styles['TableCellBold']), Paragraph('Combining Ingredients', styles['TableCell']), Paragraph('Linear Superposition: m[n] = (1/√K) Σ x_k[n]', styles['TableCell'])],
        [Paragraph('04. Seasoning Lab', styles['TableCellBold']), Paragraph('Spicing & Flavor Balancing', styles['TableCell']), Paragraph('Amplitude Scaling (A·x) & Frequency Scaling (f·t)', styles['TableCell'])],
        [Paragraph('05. Marinating Lab', styles['TableCellBold']), Paragraph('Resting & Brining', styles['TableCell']), Paragraph('Time Scaling (y(t) = x(αt)) & Time Shifting (Linear Phase Delay)', styles['TableCell'])],
        [Paragraph('06. Cooking Lab', styles['TableCellBold']), Paragraph('Grilling, Frying, Baking, Boiling', styles['TableCell']), Paragraph('LTI Convolution: y[n] = x[n] ∗ h[n] with Cascaded Systems', styles['TableCell'])],
        [Paragraph('07. Final Comparison', styles['TableCellBold']), Paragraph('Tasting & Evaluation', styles['TableCell']), Paragraph('MSE, SNR (dB), Cross-Correlation, Spectral Cosine Similarity', styles['TableCell'])],
        [Paragraph('08. Beam Delivery', styles['TableCellBold']), Paragraph('Phased Array Serving', styles['TableCell']), Paragraph('Acoustic Phased Array Steering, Array Factor AF(θ), Constructive Beam', styles['TableCell'])],
    ]
    t_flow = Table(flow_data, colWidths=[105, 145, 254])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_flow)
    story.append(PageBreak())

    # Section 2: 18 Ingredients
    story.append(Paragraph('2. Ingredient Catalogue & Harmonic Models', styles['H1']))
    story.append(Paragraph(
        'WaveKitchen features <b>18 ingredients</b> across 5 culinary categories. Produce items arrive washable with high-frequency '
        'stochastic noise, whereas bakery, protein, dairy, and pantry items arrive in clean studio conditions.',
        styles['Body']
    ))

    ing_data = [
        [Paragraph('<b>Ingredient</b>', styles['TableHead']),
         Paragraph('<b>Category</b>', styles['TableHead']),
         Paragraph('<b>Voice / Instrument</b>', styles['TableHead']),
         Paragraph('<b>f₀ (Hz)</b>', styles['TableHead']),
         Paragraph('<b>Washable?</b>', styles['TableHead']),
         Paragraph('<b>Spectral Signature & Harmonics</b>', styles['TableHead'])],
        [Paragraph('Lettuce 🥬', styles['TableCellBold']), Paragraph('Produce', styles['TableCell']), Paragraph('Shaker', styles['TableCell']), Paragraph('440', styles['TableCell']), Paragraph('Yes (380 Hz)', styles['TableCell']), Paragraph('Band-limited noise with sustained series', styles['TableCell'])],
        [Paragraph('Tomato 🍅', styles['TableCellBold']), Paragraph('Produce', styles['TableCell']), Paragraph('Kalimba', styles['TableCell']), Paragraph('262', styles['TableCell']), Paragraph('Yes (520 Hz)', styles['TableCell']), Paragraph('Tall harmonic stack decaying at progressive rates', styles['TableCell'])],
        [Paragraph('Onion 🧅', styles['TableCellBold']), Paragraph('Produce', styles['TableCell']), Paragraph('Oboe', styles['TableCell']), Paragraph('587', styles['TableCell']), Paragraph('Yes (640 Hz)', styles['TableCell']), Paragraph('Bright nasal double-reed upper harmonic spectrum', styles['TableCell'])],
        [Paragraph('Cucumber 🥒', styles['TableCellBold']), Paragraph('Produce', styles['TableCell']), Paragraph('Piccolo', styles['TableCell']), Paragraph('450', styles['TableCell']), Paragraph('Yes (450 Hz)', styles['TableCell']), Paragraph('High-register agile woodwind tone with flutter', styles['TableCell'])],
        [Paragraph('Carrot 🥕', styles['TableCellBold']), Paragraph('Produce', styles['TableCell']), Paragraph('Clarinet', styles['TableCell']), Paragraph('500', styles['TableCell']), Paragraph('Yes (500 Hz)', styles['TableCell']), Paragraph('Odd-harmonic dominated cylindrical bore response', styles['TableCell'])],
        [Paragraph('Bun 🍞', styles['TableCellBold']), Paragraph('Bakery', styles['TableCell']), Paragraph('Marimba', styles['TableCell']), Paragraph('160', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Resonant wooden bar strike with fast transient decay', styles['TableCell'])],
        [Paragraph('Bread 🍞', styles['TableCellBold']), Paragraph('Bakery', styles['TableCell']), Paragraph('Marimba', styles['TableCell']), Paragraph('160', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Tuned woody harmonic bar resonance', styles['TableCell'])],
        [Paragraph('Noodles 🍜', styles['TableCellBold']), Paragraph('Bakery', styles['TableCell']), Paragraph('Harp', styles['TableCell']), Paragraph('220', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Cascading plucked nylon string harmonics', styles['TableCell'])],
        [Paragraph('Flour 🌾', styles['TableCellBold']), Paragraph('Bakery', styles['TableCell']), Paragraph('Organ', styles['TableCell']), Paragraph('130', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Multi-rank pipe organ steady harmonic series', styles['TableCell'])],
        [Paragraph('Beef Patty 🥩', styles['TableCellBold']), Paragraph('Protein', styles['TableCell']), Paragraph('Bass Drum', styles['TableCell']), Paragraph('90', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Fat low-frequency fundamental with click attack', styles['TableCell'])],
        [Paragraph('Chicken 🍗', styles['TableCellBold']), Paragraph('Protein', styles['TableCell']), Paragraph('Bass Drum', styles['TableCell']), Paragraph('110', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Punchy low-mid drum transient', styles['TableCell'])],
        [Paragraph('Cheese 🧀', styles['TableCellBold']), Paragraph('Dairy', styles['TableCell']), Paragraph('Flute', styles['TableCell']), Paragraph('330', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Pure woodwind tone with soft breath sideband', styles['TableCell'])],
        [Paragraph('Egg 🥚', styles['TableCellBold']), Paragraph('Protein', styles['TableCell']), Paragraph('Kalimba', styles['TableCell']), Paragraph('260', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Plucked metallic tine decay', styles['TableCell'])],
        [Paragraph('Milk 🥛', styles['TableCellBold']), Paragraph('Dairy', styles['TableCell']), Paragraph('Flute', styles['TableCell']), Paragraph('300', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Smooth sustained acoustic woodwind envelope', styles['TableCell'])],
        [Paragraph('Butter 🧈', styles['TableCellBold']), Paragraph('Dairy', styles['TableCell']), Paragraph('Bassoon', styles['TableCell']), Paragraph('180', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Warm reedy low double-reed harmonics', styles['TableCell'])],
        [Paragraph('Sugar 🍬', styles['TableCellBold']), Paragraph('Pantry', styles['TableCell']), Paragraph('Glockenspiel', styles['TableCell']), Paragraph('700', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Bright crystalline high metallic bell chime', styles['TableCell'])],
        [Paragraph('Salt 🧂', styles['TableCellBold']), Paragraph('Pantry', styles['TableCell']), Paragraph('Triangle', styles['TableCell']), Paragraph('800', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('High ringing crystalline steel sustain', styles['TableCell'])],
        [Paragraph('Sauce 🥫', styles['TableCellBold']), Paragraph('Pantry', styles['TableCell']), Paragraph('Clarinet', styles['TableCell']), Paragraph('240', styles['TableCell']), Paragraph('No', styles['TableCell']), Paragraph('Rich odd-harmonic woodwind resonance', styles['TableCell'])],
    ]
    t_ing = Table(ing_data, colWidths=[80, 50, 75, 40, 70, 189])
    t_ing.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_ing)
    story.append(PageBreak())

    # Section 3: Stations
    story.append(Paragraph('3. Kitchen Stations & Signal Transformations', styles['H1']))
    
    story.append(Paragraph('Station 02 · The Fourier Filtering Machine', styles['H2']))
    story.append(Paragraph(
        'Fresh produce gathers stochastic contamination on delivery (white noise, mains hum, high-frequency hiss, burst crackle, stray tones). '
        'The player sculpts the frequency spectrum using an 8-band graphic equalizer and parametric tools (low-pass, high-pass, band-pass, notch, de-hum). '
        'The cleanliness score balances noise removal against flavor preservation: '
        '<b>Cleanliness = 100 × (0.55 × Removal + 0.45 × Preservation)</b>.',
        styles['Body']
    ))

    story.append(Paragraph('Station 03 · Superposition Mixing Bowl', styles['H2']))
    story.append(Paragraph(
        'Cleaned ingredient signals enter the bowl, undergoing sample-by-sample linear superposition normalized by the square root of the ingredient count: '
        '<b>m[n] = (1 / √K) Σ x_k[n]</b>. The mixed spectrum displays harmonic interleaving.',
        styles['Body']
    ))

    story.append(Paragraph('Station 04 · Seasoning Lab (Amplitude & Frequency Scaling)', styles['H2']))
    story.append(Paragraph(
        'Adjusts signal amplitude (scaling volume/magnitude: <b>s[n] = A · m[n]</b>) and frequency characteristics '
        '(harmonic distribution tuning) to match the target recipe waveform profile.',
        styles['Body']
    ))

    story.append(Paragraph('Station 05 · Marinating Lab (Time Scaling & Time Shifting)', styles['H2']))
    story.append(Paragraph(
        'Implements duration expansion/compression <b>y(t) = x(αt)</b>. Faster speeds (α > 1) compress duration and stretch spectrum; '
        'slower speeds (α < 1) lengthen duration and compress bandwidth. Fractional time delay <b>y(t) = x(t - t₀)</b> is applied as a linear phase ramp in frequency domain.',
        styles['Body']
    ))

    story.append(Paragraph('Station 06 · Cooking Lab (LTI System Convolution)', styles['H2']))
    story.append(Paragraph(
        'Every appliance is an LTI system defined by its impulse response h[n]: <b>y[n] = x[n] ∗ h[n]</b>.<br/>'
        '• <b>Grill:</b> Comb filter with 90-sample discrete echoes (sharp spiky taps).<br/>'
        '• <b>Fry:</b> Damped exponential noise decay (crackle bursts).<br/>'
        '• <b>Bake:</b> 2600-tap dark low-passed decay (smooth warming tail).<br/>'
        '• <b>Boil:</b> Damped 320 Hz resonant bandpass (slow rolling bubbles).',
        styles['Body']
    ))

    story.append(Paragraph('Station 07 · Final Comparison & Score Breakdown', styles['H2']))
    story.append(Paragraph(
        'The cooked dish is scored against the reference dish using four objective metrics: '
        'Mean Squared Error (MSE), Signal-to-Noise Ratio (SNR dB), Normalised Cross-Correlation (r_xy), and Log-Spectral Cosine Similarity. '
        'The screen presents a 4-part grade breakdown: <b>Filtering</b>, <b>Mixing</b>, <b>Transformation</b>, and <b>Cooking</b>.',
        styles['Body']
    ))

    story.append(Paragraph('Station 08 · Phased Array Acoustic Beam Delivery (NEW)', styles['H2']))
    story.append(Paragraph(
        'An 8-element linear speaker array delivers the cooked soundwave to diner tables across the dining hall. '
        'By applying progressive phase shifts Δφ across array elements, constructive interference steers the acoustic main lobe to the target radial angle θ: '
        '<b>Δφ = -2π (d/λ) sin(θ)</b>.<br/>'
        'The server evaluates array factor radiation patterns <b>AF(θ)</b> and confirms alignment within ±6° tolerance.',
        styles['Body']
    ))
    story.append(Spacer(1, 8))

    # Section 4: Master Recipes
    story.append(Paragraph('4. Master Recipe Book', styles['H1']))
    recipe_data = [
        [Paragraph('<b>Recipe</b>', styles['TableHead']),
         Paragraph('<b>Tier / Difficulty</b>', styles['TableHead']),
         Paragraph('<b>Ingredients</b>', styles['TableHead']),
         Paragraph('<b>Appliance</b>', styles['TableHead']),
         Paragraph('<b>Seasoning (Amp, Freq)</b>', styles['TableHead']),
         Paragraph('<b>Marinate (Scale)</b>', styles['TableHead'])],
        [Paragraph('Burger 🍔', styles['TableCellBold']), Paragraph('Tier 1 / Easy', styles['TableCell']), Paragraph('Bun, Patty, Cheese, Lettuce, Tomato, Salt', styles['TableCell']), Paragraph('Grill', styles['TableCell']), Paragraph('A = 1.5, f = 0.8', styles['TableCell']), Paragraph('1.25×', styles['TableCell'])],
        [Paragraph('Sandwich 🥪', styles['TableCellBold']), Paragraph('Tier 1 / Easy', styles['TableCell']), Paragraph('Bread, Chicken, Cheese, Lettuce, Tomato, Salt, Sauce', styles['TableCell']), Paragraph('Grill', styles['TableCell']), Paragraph('A = 1.2, f = 1.1', styles['TableCell']), Paragraph('0.85×', styles['TableCell'])],
        [Paragraph('Cake 🧁', styles['TableCellBold']), Paragraph('Tier 2 / Medium', styles['TableCell']), Paragraph('Flour, Egg, Butter, Sugar, Milk', styles['TableCell']), Paragraph('Bake', styles['TableCell']), Paragraph('A = 1.8, f = 0.6', styles['TableCell']), Paragraph('1.50×', styles['TableCell'])],
        [Paragraph('Noodles 🍜', styles['TableCellBold']), Paragraph('Tier 2 / Medium', styles['TableCell']), Paragraph('Noodles, Egg, Chicken, Onion, Salt', styles['TableCell']), Paragraph('Boil', styles['TableCell']), Paragraph('A = 1.3, f = 1.2', styles['TableCell']), Paragraph('1.75×', styles['TableCell'])],
        [Paragraph('Chicken Fry 🍗', styles['TableCellBold']), Paragraph('Tier 3 / Hard', styles['TableCell']), Paragraph('Chicken, Flour, Egg, Salt, Butter', styles['TableCell']), Paragraph('Fry', styles['TableCell']), Paragraph('A = 2.0, f = 1.4', styles['TableCell']), Paragraph('1.40×', styles['TableCell'])],
    ]
    t_rec = Table(recipe_data, colWidths=[85, 75, 160, 55, 79, 50])
    t_rec.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_rec)

    doc.build(story, canvasmaker=NumberedCanvas, onFirstPage=draw_cover_bg, onLaterPages=draw_normal_bg)
    print(f'Generated {output_path}')


def build_architecture_pdf(output_path):
    styles = get_styles()
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54
    )
    story = []

    # Cover Elements
    story.append(Spacer(1, 120))
    story.append(Paragraph('WaveKitchen', styles['CoverTitle']))
    story.append(Spacer(1, 10))
    story.append(Paragraph('A Signal Processing Cooking Game', styles['CoverSubtitle']))
    story.append(Spacer(1, 28))
    story.append(Paragraph('FULL-STACK SYSTEM ARCHITECTURE SPECIFICATION · v2.1', styles['CoverPill']))
    story.append(Spacer(1, 40))
    story.append(Paragraph(
        'React 18 + Vite · FastAPI (Python 3) · SQLAlchemy 2.0 · SQLite / PostgreSQL<br/>'
        'Server-Side Authoritative DSP (NumPy / SciPy) · 49 Automated Tests<br/>'
        'Phased Array Acoustic Beamforming · Block-Based Signal Pipelines',
        styles['CoverMeta']
    ))
    story.append(PageBreak())

    # Section 1
    story.append(Paragraph('1. Architectural Principles & Tier Model', styles['H1']))
    story.append(Paragraph(
        'WaveKitchen employs a three-tier architecture with a strict server-authoritative trust boundary. '
        'The presentation tier (React 18 SPA) renders waveforms, plots, and interactive controls; the application tier (FastAPI) '
        'executes all mathematical transforms, impulse response convolutions, phased array beamforming, and scoring; '
        'the data tier (SQLite / PostgreSQL) stores player state, recipes, and sessions.',
        styles['Body']
    ))

    arch_table_data = [
        [Paragraph('<b>Field</b>', styles['TableHead']), Paragraph('<b>Specification Detail</b>', styles['TableHead'])],
        [Paragraph('Architecture Pattern', styles['TableCellBold']), Paragraph('Three-tier client-server with authoritative backend DSP engine', styles['TableCell'])],
        [Paragraph('Frontend Stack', styles['TableCellBold']), Paragraph('React 18, Vite 5, TanStack React Router, Tailwind CSS, Canvas 2D, Web Audio API', styles['TableCell'])],
        [Paragraph('Backend Stack', styles['TableCellBold']), Paragraph('Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0, NumPy, SciPy', styles['TableCell'])],
        [Paragraph('Database', styles['TableCellBold']), Paragraph('SQLite (zero-configuration local file) / PostgreSQL via WK_DATABASE_URL', styles['TableCell'])],
        [Paragraph('Transport Format', styles['TableCellBold']), Paragraph('JSON over HTTP; audio signals encoded as base64 little-endian float32 arrays', styles['TableCell'])],
        [Paragraph('Sample Rate & Frame', styles['TableCellBold']), Paragraph('SR = 22,050 Hz canonical sample rate; FRAME = 4096 samples (~186 ms block length)', styles['TableCell'])],
        [Paragraph('Automated Verification', styles['TableCellBold']), Paragraph('49 automated tests (19 mathematical DSP assertions, 30 API integration tests)', styles['TableCell'])],
    ]
    t_arch = Table(arch_table_data, colWidths=[130, 374])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 8))

    story.append(Paragraph('2. Why DSP Lives on the Server', styles['H1']))
    story.append(Paragraph(
        '1. <b>Security & Integrity:</b> Clients never send audio signals or scores; they send only parameter and filter specifications.<br/>'
        '2. <b>Reproducibility:</b> A session stores a random seed. The server regenerates identical contaminated waveforms on demand.<br/>'
        '3. <b>Numerical Fidelity:</b> Double-precision 64-bit accumulations and optimized SciPy FFT / convolution routines prevent browser floating-point drift.<br/>'
        '4. <b>Singular Reference Truth:</b> The reference dish and player dish are evaluated through the exact same Python function.',
        styles['Body']
    ))
    story.append(Spacer(1, 6))

    # Section 3: Modules
    story.append(Paragraph('3. Backend Module Inventory', styles['H1']))
    mod_data = [
        [Paragraph('<b>Module Path</b>', styles['TableHead']),
         Paragraph('<b>Core Responsibility</b>', styles['TableHead']),
         Paragraph('<b>Key Exports & Functions</b>', styles['TableHead'])],
        [Paragraph('app/dsp/core.py', styles['TableCellBold']), Paragraph('Fundamental DSP math primitives', styles['TableCell']), Paragraph('fft, ifft, stft_magnitude, lowpass, notch, convolve, time_scale, time_shift, am_modulate, decimate, encode', styles['TableCell'])],
        [Paragraph('app/dsp/instruments.py', styles['TableCellBold']), Paragraph('Acoustic harmonic synthesizers (18 ingredients)', styles['TableCell']), Paragraph('synth, VOICES (marimba, drum, flute, shaker, kalimba, triangle, clarinet, organ, bassoon, glockenspiel, harp, oboe, piccolo)', styles['TableCell'])],
        [Paragraph('app/dsp/contamination.py', styles['TableCellBold']), Paragraph('Seeded stochastic noise generators', styles['TableCell']), Paragraph('corrupt, Contaminant (white, hum, hiss, burst, tone, pink)', styles['TableCell'])],
        [Paragraph('app/dsp/systems.py', styles['TableCellBold']), Paragraph('LTI appliance impulse responses', styles['TableCell']), Paragraph('ir, cascade_ir, ir_comb, ir_decay, ir_resonator (grill, fry, bake, boil, simmer, sear, smoke, steam)', styles['TableCell'])],
        [Paragraph('app/dsp/beamforming.py', styles['TableCellBold']), Paragraph('Phased array acoustic beam delivery', styles['TableCell']), Paragraph('calculate_beam_angle, array_factor, generate_beam_pattern, check_beam_alignment, get_preset_phases_for_angle', styles['TableCell'])],
        [Paragraph('app/dsp/pipeline.py', styles['TableCellBold']), Paragraph('Canonical 6-stage transformation pipeline', styles['TableCell']), Paragraph('run_pipeline, apply_filter_chain, reference_params, default_bands', styles['TableCell'])],
        [Paragraph('app/dsp/metrics.py', styles['TableCellBold']), Paragraph('Objective similarity & quality metrics', styles['TableCell']), Paragraph('dish_metrics, prep_quality, stars, snr_db, spectral_cosine_similarity', styles['TableCell'])],
        [Paragraph('app/gameplay.py', styles['TableCellBold']), Paragraph('Gameplay service layer & dish judging', styles['TableCell']), Paragraph('clean_signal, dirty_signal, compute_stages, judge, award, maybe_unlock', styles['TableCell'])],
        [Paragraph('app/models.py', styles['TableCellBold']), Paragraph('SQLAlchemy ORM database models', styles['TableCell']), Paragraph('Player, Recipe, GameSession, SessionIngredient, Attempt, Ingredient, Appliance', styles['TableCell'])],
        [Paragraph('app/schemas.py', styles['TableCellBold']), Paragraph('Pydantic v2 API request/response contracts', styles['TableCell']), Paragraph('SessionOut, SubmitResult, FilterResponse, BeamDeliveryRequest, BeamDeliveryResponse', styles['TableCell'])],
        [Paragraph('app/routers/sessions.py', styles['TableCellBold']), Paragraph('Session lifecycle & station endpoints', styles['TableCell']), Paragraph('start_session, apply_filters, accept_ingredient, set_params, convolution, submit, beam_delivery', styles['TableCell'])],
    ]
    t_mod = Table(mod_data, colWidths=[120, 155, 229])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_mod)
    story.append(PageBreak())

    # Section 4: REST API
    story.append(Paragraph('4. REST API Endpoint Specification', styles['H1']))
    api_data = [
        [Paragraph('<b>Method & Path</b>', styles['TableHead']),
         Paragraph('<b>Purpose</b>', styles['TableHead']),
         Paragraph('<b>Auth</b>', styles['TableHead'])],
        [Paragraph('GET /api/health', styles['TableCellBold']), Paragraph('System health, sample rate (22050 Hz), frame size (4096)', styles['TableCell']), Paragraph('None', styles['TableCell'])],
        [Paragraph('POST /api/players', styles['TableCellBold']), Paragraph('Register chef handle, receive bearer token', styles['TableCell']), Paragraph('None', styles['TableCell'])],
        [Paragraph('GET /api/players/me', styles['TableCellBold']), Paragraph('Profile, career points, tier rank, best scores', styles['TableCell']), Paragraph('Token', styles['TableCell'])],
        [Paragraph('GET /api/recipes', styles['TableCellBold']), Paragraph('Recipe book catalogue (targets withheld for gameplay)', styles['TableCell']), Paragraph('Optional', styles['TableCell'])],
        [Paragraph('GET /api/recipes/{id}', styles['TableCellBold']), Paragraph('Full recipe details including target values', styles['TableCell']), Paragraph('None', styles['TableCell'])],
        [Paragraph('GET /api/ingredients', styles['TableCellBold']), Paragraph('Catalogue of 18 ingredients with spectral signatures', styles['TableCell']), Paragraph('None', styles['TableCell'])],
        [Paragraph('GET /api/appliances/{id}', styles['TableCellBold']), Paragraph('Impulse response array h[n] and |H(f)| frequency curve', styles['TableCell']), Paragraph('None', styles['TableCell'])],
        [Paragraph('POST /api/sessions', styles['TableCellBold']), Paragraph('Start new service, generate deterministic seed, contaminate produce', styles['TableCell']), Paragraph('Token', styles['TableCell'])],
        [Paragraph('POST /api/sessions/{id}/ingredients/{s}/filter', styles['TableCellBold']), Paragraph('Apply graphic EQ + filter tools, return reconstructed waveform & FFT', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('POST /api/sessions/{id}/ingredients/{s}/accept', styles['TableCellBold']), Paragraph('Cleanliness counter check (409 if still dirty or over-filtered)', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('PUT /api/sessions/{id}/params', styles['TableCellBold']), Paragraph('Update cooking parameters, re-run pipeline, return all stages', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('GET /api/sessions/{id}/convolution?lag=m', styles['TableCellBold']), Paragraph('Interactive sliding convolution partial sum at lag m', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('POST /api/sessions/{id}/submit', styles['TableCellBold']), Paragraph('Server-side judging, 4-part score breakdown, star awards, tier unlock', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('POST /api/sessions/{id}/beam-delivery', styles['TableCellBold']), Paragraph('Phased array acoustic beam delivery steering & alignment check', styles['TableCell']), Paragraph('Owner', styles['TableCell'])],
        [Paragraph('GET /api/leaderboard', styles['TableCellBold']), Paragraph('Global & per-recipe leaderboards and rankings', styles['TableCell']), Paragraph('None', styles['TableCell'])],
    ]
    t_api = Table(api_data, colWidths=[180, 260, 64])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, C_BG_LIGHT]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t_api)
    story.append(Spacer(1, 8))

    # Section 5: Verification
    story.append(Paragraph('5. Automated Verification & Quality Assurance', styles['H1']))
    story.append(Paragraph(
        'The test suite contains <b>49 automated tests</b> that assert exact mathematical identities and full API flows:<br/>'
        '• <b>FFT Lossless Inversion:</b> max |x - IFFT(FFT(x))| < 1e-5.<br/>'
        '• <b>LTI Cascading:</b> Direct vs FFT convolution agreement (< 1e-4) and system associativity.<br/>'
        '• <b>Time Scaling & Delay:</b> Inverted duration changes and linear phase preservation.<br/>'
        '• <b>Phased Array Beamforming:</b> Array factor magnitude normalization and steering angle alignment within ±6°.<br/>'
        '• <b>End-to-End API Suite:</b> All 18 ingredients, 5 master recipes, dirty/clean delivery separation, filtering acceptance thresholds, and score breakdowns.',
        styles['Body']
    ))

    doc.build(story, canvasmaker=NumberedCanvas, onFirstPage=draw_cover_bg, onLaterPages=draw_normal_bg)
    print(f'Generated {output_path}')


if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    
    pdf1 = os.path.join(base_dir, 'WaveKitchen_Gameplay_Detailed.pdf')
    pdf2 = os.path.join(base_dir, 'WaveKitchen_System_Architecture.pdf')
    
    build_gameplay_pdf(pdf1)
    build_architecture_pdf(pdf2)
    
    # Also update in academic folder if present
    acad_dir = 'C:/Users/Lenovo/OneDrive/Desktop/Academics/2-2/CSE 220/Wavekitchen'
    if os.path.isdir(acad_dir):
        build_gameplay_pdf(os.path.join(acad_dir, 'WaveKitchen_Gameplay_Detailed.pdf'))
        build_architecture_pdf(os.path.join(acad_dir, 'WaveKitchen_System_Architecture.pdf'))
    
    print('All PDFs generated successfully.')

