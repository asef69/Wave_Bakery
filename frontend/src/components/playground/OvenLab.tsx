/**
 * Precision Oven lab: the recipe station's finishing stage on any signal.
 * A burnt overtone is added between the signal's harmonics, the oven samples
 * it at fs, shows the spectrum (bin k = k·fs/N Hz), applies its band gains,
 * browning cutoff and charred notch, and rebuilds the dish (IFFT).
 */
import { useMemo, useState } from "react";

import { MiniWave } from "@/components/game/MiniWave";
import { overtoneBetweenHarmonics } from "@/lib/delivery";
import { computeSignalSimilarity } from "@/lib/dsp";
import { bakeInOven, sourceSamples } from "@/lib/playground";
import type { SpectrumBin } from "@/lib/precision-oven-dsp";

import {
  LabHeading,
  LabSlider,
  LabToggle,
  PlayButton,
  Stat,
  type PlaygroundLabProps,
} from "./LabKit";
import { matchTone } from "./tone";

/** The oven's sampler range (MAX_OVEN_FS of the Precision Oven station). */
const MAX_OVEN_FS = 64;

/** Where a tone of `hz` appears after sampling at `fs` (folded into [0, fs/2]). */
function foldedHz(hz: number, fs: number): number {
  const a = hz % fs;
  return a > fs / 2 ? fs - a : a;
}

export function OvenLab({ source, signalId, onPlayAudio, playingClip }: PlaygroundLabProps) {
  const dish = useMemo(() => sourceSamples(source), [source]);
  const [overtoneHz, setOvertoneHz] = useState(() => overtoneBetweenHarmonics(dish));
  const [overtoneAmp, setOvertoneAmp] = useState(0.8);
  const [fs, setFs] = useState(MAX_OVEN_FS);
  const [lowGain, setLowGain] = useState(1);
  const [midGain, setMidGain] = useState(1);
  const [highGain, setHighGain] = useState(1);
  const [cutoffHz, setCutoffHz] = useState(32);
  const [notchActive, setNotchActive] = useState(false);
  const [notchHz, setNotchHz] = useState(22);

  const nyq = fs / 2;
  const cutoffMax = Math.min(32, Math.max(10, Math.round(nyq)));
  const notchMax = Math.min(28, Math.max(12, Math.round(nyq)));
  const cutoff = Math.min(cutoffHz, cutoffMax);
  const notch = Math.min(notchHz, notchMax);

  const oven = useMemo(
    () =>
      bakeInOven(dish, overtoneHz, overtoneAmp, {
        fs,
        lowGain,
        midGain,
        highGain,
        cutoffHz: cutoff,
        notchActive,
        notchHz: notch,
      }),
    [dish, overtoneHz, overtoneAmp, fs, lowGain, midGain, highGain, cutoff, notchActive, notch],
  );
  const beforeMatch = computeSignalSimilarity(oven.served, dish);
  const afterMatch = computeSignalSimilarity(oven.output, dish);
  const minSafeFs = Math.ceil(oven.nyquistRate);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="kitchen-card space-y-5 p-6">
        <LabHeading
          eyebrow="Station 06 · Precision Oven"
          title="Sampling, FFT & Equaliser"
          note={`X[k] → H[k]·X[k] → IFFT on ${source.name}`}
        />

        <div className="space-y-2">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            1 · The burnt overtone
          </p>
          <LabSlider
            label="Overtone frequency"
            value={overtoneHz}
            min={10}
            max={28}
            step={1}
            readout={`${overtoneHz} Hz`}
            onChange={setOvertoneHz}
          />
          <LabSlider
            label="Overtone strength"
            value={overtoneAmp}
            min={0}
            max={1.2}
            step={0.05}
            readout={`× ${overtoneAmp.toFixed(2)} of the peak`}
            onChange={setOvertoneAmp}
          />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            2 · Sampling (Nyquist: fs ≥ 2·fmax = {minSafeFs} Hz)
          </p>
          <LabSlider
            label="Oven sampling rate fs"
            value={fs}
            min={4}
            max={MAX_OVEN_FS}
            step={1}
            readout={`${fs} Hz · Nyquist ${nyq.toFixed(1)} Hz`}
            onChange={setFs}
          />
          <p
            className={
              oven.aliased
                ? "font-mono text-[11px] font-bold text-rose-500"
                : "font-mono text-[11px] text-emerald-500"
            }
          >
            {oven.aliased
              ? `⚠ fs < 2·fmax (${oven.fmax} Hz): content above ${nyq.toFixed(1)} Hz folds back as false frequencies (aliasing).`
              : `✓ fs ≥ 2·fmax (${oven.fmax} Hz): sampling is lossless.`}
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            3 · Equaliser H[k]
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <LabSlider
              label="Base 0–6 Hz"
              value={lowGain}
              min={0.2}
              max={2.5}
              step={0.05}
              readout={`× ${lowGain.toFixed(2)}`}
              onChange={setLowGain}
            />
            <LabSlider
              label="Crumb 6–16 Hz"
              value={midGain}
              min={0.2}
              max={2.5}
              step={0.05}
              readout={`× ${midGain.toFixed(2)}`}
              onChange={setMidGain}
            />
            <LabSlider
              label="Crisp 16–32 Hz"
              value={highGain}
              min={0.2}
              max={2.5}
              step={0.05}
              readout={`× ${highGain.toFixed(2)}`}
              onChange={setHighGain}
              disabled={nyq < 16}
            />
          </div>
          <LabSlider
            label="Browning cutoff (low-pass)"
            value={cutoff}
            min={8}
            max={cutoffMax}
            step={1}
            readout={`${cutoff} Hz`}
            onChange={setCutoffHz}
          />
          <LabToggle
            label="Charred notch"
            hint="98 % rejection at its centre"
            checked={notchActive}
            onChange={setNotchActive}
          />
          <LabSlider
            label="Notch frequency"
            value={notch}
            min={10}
            max={notchMax}
            step={1}
            readout={`${notch} Hz`}
            onChange={setNotchHz}
            disabled={!notchActive}
          />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-4">
          <PlayButton
            clipId={`oven-dish-${signalId}`}
            label="Clean dish"
            playingLabel="Playing dish..."
            samples={dish}
            freq={source.freq}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
          />
          <PlayButton
            clipId={`oven-burnt-${signalId}`}
            label="Burnt dish"
            playingLabel="Playing burnt..."
            samples={oven.served}
            freq={source.freq}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
          />
          <PlayButton
            clipId={`oven-out-${signalId}`}
            label="Oven output"
            playingLabel="Playing output..."
            samples={oven.output}
            freq={source.freq}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
            primary
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="fmax" value={`${oven.fmax} Hz`} />
          <Stat
            label="Nyquist rate"
            value={`${minSafeFs} Hz`}
            tone={oven.aliased ? "bad" : "good"}
          />
          <Stat label="Burnt vs dish" value={`${beforeMatch}%`} tone={matchTone(beforeMatch)} />
          <Stat label="Oven vs dish" value={`${afterMatch}%`} tone={matchTone(afterMatch)} />
        </div>

        <div className="lab-panel p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              Spectrum |X[k]| (0 – {nyq.toFixed(1)} Hz)
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              grey: sampled · colour: after H[k]
            </span>
          </div>
          <SpectrumPlot
            original={oven.spectrum.bins}
            tuned={oven.tuned.tunedBins}
            nyquist={nyq}
            overtoneHz={overtoneAmp > 0 ? foldedHz(overtoneHz, fs) : null}
            overtoneFolded={overtoneAmp > 0 && overtoneHz > nyq}
            notchHz={notchActive ? notch : null}
            cutoffHz={cutoff < nyq ? cutoff : null}
          />
        </div>

        <div className="lab-panel p-4">
          <p className="font-mono text-[9px] tracking-[0.2em] text-signal/70 uppercase">
            Burnt dish (dish + overtone {overtoneHz} Hz)
          </p>
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={oven.served}
            color="var(--signal-alt)"
            label="Into the oven"
          />
        </div>
        <div className="lab-panel p-4">
          <p className="font-mono text-[9px] tracking-[0.2em] text-signal uppercase">
            Oven output (IFFT of H[k]·X[k])
          </p>
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={oven.output}
            color="var(--signal)"
            label={`Out of the oven · ${afterMatch}% like the clean dish`}
          />
        </div>
      </section>
    </div>
  );
}

function SpectrumPlot({
  original,
  tuned,
  nyquist,
  overtoneHz,
  overtoneFolded,
  notchHz,
  cutoffHz,
}: {
  original: SpectrumBin[];
  tuned: SpectrumBin[];
  nyquist: number;
  overtoneHz: number | null;
  overtoneFolded: boolean;
  notchHz: number | null;
  cutoffHz: number | null;
}) {
  const W = 400;
  const H = 150;
  const base = H - 18;
  const peak = Math.max(
    1e-9,
    ...original.map((b) => b.magnitude),
    ...tuned.map((b) => b.magnitude),
  );
  const x = (f: number) => (nyquist > 0 ? (f / nyquist) * W : 0);
  const y = (m: number) => base - (m / peak) * (base - 8);
  const barW = Math.max(1.5, (W / Math.max(1, original.length)) * 0.7);
  const marker = (f: number, color: string, label: string, dashed = true) => (
    <g key={label}>
      <line
        x1={x(f)}
        x2={x(f)}
        y1={4}
        y2={base}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={Math.min(W - 4, x(f) + 3)} y={12} fontSize={9} fill={color} className="font-mono">
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-44 w-full" role="img" aria-label="Spectrum">
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border)" />
      {original.map((b) => (
        <rect
          key={`o-${b.binIndex}`}
          x={x(b.frequency) - barW / 2}
          y={y(b.magnitude)}
          width={barW}
          height={base - y(b.magnitude)}
          fill="var(--muted-foreground)"
          opacity={0.35}
        />
      ))}
      {tuned.map((b) => (
        <rect
          key={`t-${b.binIndex}`}
          x={x(b.frequency) - barW / 4}
          y={y(b.magnitude)}
          width={barW / 2}
          height={base - y(b.magnitude)}
          fill="var(--signal)"
        />
      ))}
      {cutoffHz !== null && marker(cutoffHz, "var(--primary)", `cutoff ${cutoffHz}`, false)}
      {notchHz !== null && notchHz <= nyquist && marker(notchHz, "#10b981", `notch ${notchHz}`)}
      {overtoneHz !== null &&
        marker(
          overtoneHz,
          "#f43f5e",
          overtoneFolded ? `overtone (aliased to ${overtoneHz.toFixed(1)})` : "overtone",
        )}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text
          key={t}
          x={Math.min(W - 16, t * W)}
          y={H - 4}
          fontSize={9}
          fill="var(--muted-foreground)"
          className="font-mono"
        >
          {(t * nyquist).toFixed(t === 0 ? 0 : 1)}
        </text>
      ))}
    </svg>
  );
}
