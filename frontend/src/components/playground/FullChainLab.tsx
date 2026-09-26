/**
 * Full Chain lab: a whole recipe run on clean ingredients, every station
 * with its own function (mix → season → marinate → cook → burnt overtone →
 * Precision Oven → delivery cart), compared with the recipe's reference
 * dish. With the recipe's own dials (oven and cart on) it reproduces the
 * reference; move any dial to hear and see what that station costs.
 */
import { useMemo, useState } from "react";

import { MiniWave } from "@/components/game/MiniWave";
import { computeSignalSimilarity } from "@/lib/dsp";
import {
  runFullChain,
  targetDials,
  type CookingMethod,
  type FullChainDials,
} from "@/lib/playground";
import { recipes } from "@/lib/recipes";
import { cn } from "@/lib/utils";

import {
  LabHeading,
  LabSlider,
  LabToggle,
  PlayButton,
  Stat,
  type PlaygroundLabProps,
} from "./LabKit";
import { matchTone } from "./tone";

const METHODS: Array<{ id: CookingMethod; label: string; icon: string }> = [
  { id: "grill", label: "Grill", icon: "🔥" },
  { id: "bake", label: "Bake", icon: "🧁" },
  { id: "boil", label: "Boil", icon: "♨️" },
  { id: "fry", label: "Fry", icon: "🍳" },
];

export function FullChainLab({
  onPlayAudio,
  playingClip,
}: Pick<PlaygroundLabProps, "onPlayAudio" | "playingClip">) {
  const [recipeId, setRecipeId] = useState(recipes[0]!.id);
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0]!;
  const [dials, setDials] = useState<FullChainDials>(() => targetDials(recipe));
  const set = <K extends keyof FullChainDials>(k: K, v: FullChainDials[K]) =>
    setDials((d) => ({ ...d, [k]: v }));

  const chain = useMemo(() => runFullChain(recipe, dials), [recipe, dials]);
  const ideal = targetDials(recipe);
  const stages: Array<{ label: string; samples: number[]; note: string }> = [
    { label: "1 · Mixed (clean ingredients)", samples: chain.mixed.samples, note: "Σ g·x / √K" },
    {
      label: "2 · Seasoned",
      samples: chain.seasoned.samples,
      note: `A = ${dials.amplitude.toFixed(2)}, α = ${dials.alpha.toFixed(2)}`,
    },
    {
      label: "3 · Marinated",
      samples: chain.marinated.samples,
      note: `t₀ = ${dials.marinate.toFixed(2)} s`,
    },
    {
      label: "4 · Cooked",
      samples: chain.cooked.samples,
      note: `${dials.method} ✱ h, depth ${dials.depth}%`,
    },
    { label: "5 · Burnt (overtone added)", samples: chain.burnt, note: "leaves the stove" },
    {
      label: "6 · Precision Oven",
      samples: chain.baked,
      note: dials.oven ? "notch on the overtone" : "skipped",
    },
  ];
  const stageMatch = (x: number[]) => computeSignalSimilarity(x, chain.target.samples);

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="kitchen-card space-y-4 p-6">
        <LabHeading
          eyebrow="Whole game · one recipe"
          title="Full Chain"
          note="Every station in order, on the recipe's clean ingredients"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {recipes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRecipeId(r.id);
                setDials(targetDials(r));
              }}
              className={cn(
                "rounded-xl border-2 px-2.5 py-2 font-display text-xs font-extrabold uppercase transition-all",
                r.id === recipe.id
                  ? "border-primary bg-secondary text-foreground shadow-sm"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
              )}
            >
              {r.name}
            </button>
          ))}
        </div>

        <LabSlider
          label={`Seasoning A (recipe ${ideal.amplitude})`}
          value={dials.amplitude}
          min={0.2}
          max={3}
          step={0.05}
          readout={`× ${dials.amplitude.toFixed(2)}`}
          onChange={(v) => set("amplitude", v)}
        />
        <LabSlider
          label={`Seasoning α (recipe ${ideal.alpha})`}
          value={dials.alpha}
          min={0.2}
          max={3}
          step={0.05}
          readout={`× ${dials.alpha.toFixed(2)}`}
          onChange={(v) => set("alpha", v)}
        />
        <LabSlider
          label={`Marinate t₀ (recipe ${ideal.marinate} s)`}
          value={dials.marinate}
          min={0}
          max={2.5}
          step={0.05}
          readout={`${dials.marinate.toFixed(2)} s`}
          onChange={(v) => set("marinate", v)}
        />
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
            Cooking method (recipe: {ideal.method})
          </p>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => set("method", m.id)}
                className={cn(
                  "rounded-xl border-2 px-2 py-2 text-center font-display text-[11px] font-extrabold uppercase transition-all",
                  dials.method === m.id
                    ? "border-primary bg-secondary text-foreground shadow-sm"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                <span className="block text-lg">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <LabSlider
          label="Convolution depth"
          value={dials.depth}
          min={0}
          max={100}
          step={1}
          readout={`${dials.depth}%`}
          onChange={(v) => set("depth", v)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <LabToggle
            label="Precision Oven"
            hint="notch the burnt overtone"
            checked={dials.oven}
            onChange={(v) => set("oven", v)}
          />
          <LabToggle
            label="Delivery cart"
            hint="notch the road vibration"
            checked={dials.cart}
            onChange={(v) => set("cart", v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
          <PlayButton
            clipId={`chain-target-${recipe.id}`}
            label="Reference dish"
            playingLabel="Playing reference..."
            samples={chain.target.samples}
            freq={chain.target.frequency}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
          />
          <PlayButton
            clipId={`chain-served-${recipe.id}`}
            label="Served dish"
            playingLabel="Playing served..."
            samples={chain.served}
            freq={chain.target.frequency}
            onPlayAudio={onPlayAudio}
            playingClip={playingClip}
            primary
          />
          <button
            type="button"
            onClick={() => setDials(targetDials(recipe))}
            className="font-mono text-[10px] font-bold text-muted-foreground uppercase underline-offset-2 hover:text-foreground hover:underline"
          >
            Reset to the recipe&apos;s dials
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Served vs reference"
            value={`${chain.match.toFixed(1)}%`}
            tone={matchTone(chain.match)}
          />
          <Stat label="Recipe" value={recipe.name} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {stages.map((s) => (
            <div key={s.label} className="lab-panel p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[9px] tracking-[0.16em] text-signal/80 uppercase">
                  {s.label}
                </p>
                <span className="font-mono text-[9px] text-muted-foreground">{s.note}</span>
              </div>
              <MiniWave
                className="mt-1 border-0 p-0 rounded-none"
                samples={s.samples}
                height={70}
                color="var(--signal-alt)"
                label={`${stageMatch(s.samples).toFixed(0)}% like the reference`}
              />
            </div>
          ))}
        </div>

        <div className="lab-panel p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.24em] text-signal uppercase">
              7 · Served (after the cart) vs reference
            </p>
            <span className="font-mono text-[9px] text-muted-foreground uppercase">
              {dials.cart ? "cart notch on the road" : "no cart: the road shakes the dish"}
            </span>
          </div>
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={chain.target.samples}
            color="var(--primary)"
            label="Reference dish"
          />
          <MiniWave
            className="mt-2 border-0 p-0 rounded-none"
            samples={chain.served}
            color="var(--signal)"
            label={`Served · ${chain.match.toFixed(1)}% match`}
          />
        </div>
      </section>
    </div>
  );
}
