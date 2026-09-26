/**
 * Tasting lab: how the game judges a dish. The active signal is the target;
 * the candidate is it (or another ingredient) with a level change, a delay,
 * noise and a burnt overtone. Both of the game's comparisons are shown: the
 * live in-lab match (lib/dsp.ts) and the server's dish score
 * (backend/app/dsp/metrics.py), with every part and weight.
 */
import { useMemo, useState } from "react";

import { MiniWave } from "@/components/game/MiniWave";
import { addBurntOvertone, overtoneBetweenHarmonics } from "@/lib/delivery";
import { sourceSamples, tasteCompare, type PlaygroundSource } from "@/lib/playground";
import { ALL_AVAILABLE_INGREDIENTS } from "@/lib/recipes";

import { LabHeading, LabSlider, PlayButton, Stat, type PlaygroundLabProps } from "./LabKit";
import { matchTone } from "./tone";

/** Deterministic white noise in [-1, 1] (same every render). */
function noiseAt(i: number): number {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return 2 * (s - Math.floor(s)) - 1;
}

/** Circular delay of a one-period dish by `seconds` of its 1-second window. */
function delayed(x: number[], seconds: number): number[] {
  const period = x.length - 1;
  const k = Math.round(seconds * period);
  if (k === 0) return [...x];
  const out = x.slice(0, period).map((_, i) => x[(((i - k) % period) + period) % period]!);
  out.push(out[0]!);
  return out;
}

const SAME = "__same__";

export function TastingLab({ source, signalId, onPlayAudio, playingClip }: PlaygroundLabProps) {
  const target = useMemo(() => sourceSamples(source), [source]);
  const [otherName, setOtherName] = useState(SAME);
  const [gain, setGain] = useState(1);
  const [delay, setDelay] = useState(0);
  const [noise, setNoise] = useState(0);
  const [overtone, setOvertone] = useState(0);

  const base = useMemo(() => {
    if (otherName === SAME) return target;
    const ing = ALL_AVAILABLE_INGREDIENTS.find((i) => i.name === otherName);
    if (!ing) return target;
    const other: PlaygroundSource = {
      category: "ingredient",
      name: ing.name,
      freq: ing.freq ?? 4,
    };
    return sourceSamples(other);
  }, [otherName, target]);

  const overtoneHz = useMemo(() => overtoneBetweenHarmonics(target), [target]);
  const candidate = useMemo(() => {
    const peak = target.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
    let c = delayed(base, delay).map((v, i) => gain * v + noise * peak * noiseAt(i));
    if (overtone > 0) c = addBurntOvertone(c, overtoneHz, overtone);
    return c;
  }, [base, delay, gain, noise, overtone, overtoneHz, target]);

  const t = useMemo(() => tasteCompare(target, candidate), [target, candidate]);

  const reset = () => {
    setOtherName(SAME);
    setGain(1);
    setDelay(0);
    setNoise(0);
    setOvertone(0);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="kitchen-card space-y-4 p-6">
        <LabHeading
          eyebrow="Check Dish · Scoring"
          title="Tasting & Comparison"
          note={`Target: ${source.name} · change the candidate and watch every metric`}
        />

        <label className="block space-y-1.5">
          <span className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Candidate dish
          </span>
          <select
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 font-mono text-xs text-foreground"
          >
            <option value={SAME}>Same as target ({source.name})</option>
            {ALL_AVAILABLE_INGREDIENTS.map((i) => (
              <option key={i.name} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
        </label>

        <LabSlider
          label="Level (seasoning)"
          value={gain}
          min={0}
          max={2}
          step={0.05}
          readout={`× ${gain.toFixed(2)}`}
          onChange={setGain}
        />
        <LabSlider
          label="Delay (marinating)"
          value={delay}
          min={0}
          max={0.5}
          step={0.01}
          readout={`${delay.toFixed(2)} s`}
          onChange={setDelay}
        />
        <LabSlider
          label="Noise (unwashed)"
          value={noise}
          min={0}
          max={1}
          step={0.05}
          readout={`${Math.round(noise * 100)}% of the peak`}
          onChange={setNoise}
        />
        <LabSlider
          label={`Burnt overtone (${overtoneHz} Hz)`}
          value={overtone}
          min={0}
          max={1.2}
          step={0.05}
          readout={`× ${overtone.toFixed(2)}`}
          onChange={setOvertone}
        />

        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-4">
          <PlayButton
            clipId={`taste-target-${signalId}`}
            label="Target"
            playingLabel="Playing target..."
            samples={target}
            freq={source.freq}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
          />
          <PlayButton
            clipId={`taste-candidate-${signalId}`}
            label="Candidate"
            playingLabel="Playing candidate..."
            samples={candidate}
            freq={source.freq}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
            primary
          />
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] font-bold text-muted-foreground uppercase underline-offset-2 hover:text-foreground hover:underline"
          >
            Reset candidate
          </button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="lab-panel p-4">
          <p className="font-mono text-[9px] tracking-[0.2em] text-primary uppercase">
            Target vs candidate
          </p>
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={target}
            color="var(--primary)"
            label={`Target · ${source.name}`}
          />
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={candidate}
            color="var(--signal)"
            label="Candidate"
          />
        </div>

        <div className="kitchen-card space-y-3 p-5">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            In-lab match (the % every station shows)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Match" value={`${t.match.toFixed(1)}%`} tone={matchTone(t.match)} />
            <Stat label="Shape r" value={t.pearson.toFixed(3)} />
            <Stat label="Level (NRMSE)" value={`${(t.levelMatch * 100).toFixed(1)}%`} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            match = 50 % · max(0, r) + 50 % · NRMSE score. r is the correlation at zero lag, so a
            delay hurts it; NRMSE compares levels, so seasoning too much or too little hurts it.
          </p>
        </div>

        <div className="kitchen-card space-y-3 p-5">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Server dish score (how the final dish is judged)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Dish score" value={t.dishScore.toFixed(1)} tone={matchTone(t.dishScore)} />
            <Stat label="Spectral" value={t.spectral.toFixed(3)} />
            <Stat label="Correlation" value={t.correlation.toFixed(3)} />
            <Stat label="SNR" value={`${t.snrDb >= 100 ? "∞" : t.snrDb.toFixed(1)} dB`} />
          </div>
          <ScoreBar label="40 % spectral" part={t.parts.spectral} weight={0.4} />
          <ScoreBar label="35 % correlation" part={t.parts.correlation} weight={0.35} />
          <ScoreBar label="25 % SNR" part={t.parts.snr} weight={0.25} />
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            spectral: cosine of the dB spectra over the 40 dB below the target&apos;s peak, mapped
            0.60 → 0.98. correlation: the best lag of the cross-correlation, so a delay barely costs
            here. SNR: target energy over error energy, mapped −5 dB → 25 dB. The run&apos;s score
            then weighs prep: raw = dish · (0.72 + 0.28 · prep / 100).
          </p>
        </div>
      </section>
    </div>
  );
}

function ScoreBar({ label, part, weight }: { label: string; part: number; weight: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-[10px] uppercase">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold text-foreground">
          {(part * 100).toFixed(0)}% → {(part * weight * 100).toFixed(1)} pts
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[image:var(--gradient-warm)]"
          style={{ width: `${Math.round(part * 100)}%` }}
        />
      </div>
    </div>
  );
}
