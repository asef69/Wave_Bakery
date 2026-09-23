import type { PipelineStep } from "@/lib/recipes";

/** Vertical HUD-style pipeline of the signal operations a recipe needs. */
export function SignalPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="flex flex-col items-stretch gap-0">
      {steps.map((step, i) => (
        <li key={step + i} className="flex flex-col items-center">
          <div className="lab-panel flex w-full items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[10px] text-signal/60">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-display text-sm font-bold tracking-[0.14em] text-signal uppercase">
              {step}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span className="my-1 font-mono text-base text-primary/70" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
