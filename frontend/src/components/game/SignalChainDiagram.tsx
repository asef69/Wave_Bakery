import { useState } from "react";
import {
  Sparkles,
  Waves,
  Filter,
  Layers,
  Sliders,
  Flame,
  Radio,
  Building2,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStageBlock {
  id: string;
  name: string;
  technicalLabel: string;
  mathFormula: string;
  impulseOrTransfer: string;
  domain: "Time" | "Frequency" | "Spatial";
  icon: typeof Sparkles;
  description: string;
}

export const PIPELINE_BLOCKS: PipelineStageBlock[] = [
  {
    id: "synthesis",
    name: "Ingredient Sources",
    technicalLabel: "Elementary Signal Generation",
    mathFormula: "x_k(t) = A_k \\sin(2\\pi f_k t) + n_k(t)",
    impulseOrTransfer: "x[n] ∈ ℝ^N",
    domain: "Time",
    icon: Sparkles,
    description: "Raw deterministic harmonic waveforms with parametric noise models for produce.",
  },
  {
    id: "filter",
    name: "Washing Station",
    technicalLabel: "Fourier Spectral Filtering",
    mathFormula: "Y(f) = X(f) \\cdot H_{\\text{wash}}(f)",
    impulseOrTransfer: "H(f) \\text{ (Butterworth Lowpass)}",
    domain: "Frequency",
    icon: Filter,
    description:
      "Forward Real FFT, spectral masking of out-of-band contaminants, and inverse IFFT.",
  },
  {
    id: "mixing",
    name: "Mixing Bowl",
    technicalLabel: "Linear Superposition",
    mathFormula: "x_{\\text{mix}}[n] = \\frac{1}{\\sqrt{K}} \\sum_{k=1}^K x_k[n]",
    impulseOrTransfer: "\\text{Superposition Principle}",
    domain: "Time",
    icon: Layers,
    description: "Coherent linear combination of clean ingredient channels in the time domain.",
  },
  {
    id: "transform",
    name: "Season & Marinate",
    technicalLabel: "Variable Scaling & Shifting",
    mathFormula: "x_{\\text{trans}}(t) = A \\cdot x_{\\text{mix}}(\\alpha t - t_0)",
    impulseOrTransfer: "y(t) = x(at + b)",
    domain: "Time",
    icon: Sliders,
    description: "Amplitude scaling for spice strength, time dilation for simmer/marinate time.",
  },
  {
    id: "cooking",
    name: "Appliance Convolve",
    technicalLabel: "LTI Discrete Convolution",
    mathFormula: "x_{\\text{cooked}}[n] = (x_{\\text{trans}} * h_{\\text{oven}})[n]",
    impulseOrTransfer: "h_{\\text{oven}}[n] \\text{ (Oven IR)}",
    domain: "Time",
    icon: Flame,
    description: "LTI system response modeling appliance cavity resonant acoustics.",
  },
  {
    id: "phased_array",
    name: "Phased Array Beam",
    technicalLabel: "Spatial FIR Directivity",
    mathFormula: "AF(\\theta) = \\sum_{m=0}^{7} w_m e^{j (m k d \\sin\\theta + \\phi_m)}",
    impulseOrTransfer: "w[n] \\text{ (Taper Window)}",
    domain: "Spatial",
    icon: Radio,
    description: "Constructive acoustic wave interference steered toward table angle θ_0.",
  },
  {
    id: "room_acoustics",
    name: "Room Acoustics",
    technicalLabel: "LTI Room Impulse Response",
    mathFormula: "y_{\\text{eater}}[n] = (x_{\\text{cooked}} * h_{\\text{room}})[n]",
    impulseOrTransfer: "h_{\\text{room}}[n] = \\delta[n] + \\sum \\alpha_i \\delta[n-d_i]",
    domain: "Time",
    icon: Building2,
    description: "Multipath acoustic reflection and distance attenuation in the dining room.",
  },
];

interface SignalChainDiagramProps {
  activeBlockId?: string;
  onSelectBlock?: (id: string) => void;
  className?: string;
}

export function SignalChainDiagram({
  activeBlockId,
  onSelectBlock,
  className,
}: SignalChainDiagramProps) {
  const [selectedId, setSelectedId] = useState<string>(activeBlockId || "cooking");
  const currentId = activeBlockId || selectedId;
  const currentBlock = PIPELINE_BLOCKS.find((b) => b.id === currentId) || PIPELINE_BLOCKS[0]!;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (onSelectBlock) onSelectBlock(id);
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-border/80 bg-card/90 p-6 shadow-sm backdrop-blur-xs",
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <Waves className="h-3.5 w-3.5" />
            </span>
            <p className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-primary uppercase">
              End-to-End System Block Diagram
            </p>
          </div>
          <h3 className="mt-1 font-display text-2xl font-extrabold text-foreground uppercase">
            Complete Cascaded LTI Architecture
          </h3>
        </div>

        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold text-primary uppercase">
          Associative: (x * h_1) * h_2 = x * (h_1 * h_2)
        </span>
      </div>

      {/* Horizontal Flow Blocks */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-4 pt-1">
        {PIPELINE_BLOCKS.map((block, idx) => {
          const isSelected = block.id === currentId;
          const Icon = block.icon;
          const isLast = idx === PIPELINE_BLOCKS.length - 1;

          return (
            <div key={block.id} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSelect(block.id)}
                className={cn(
                  "flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-150 cursor-pointer min-w-[140px]",
                  isSelected
                    ? "border-primary bg-primary/15 text-foreground shadow-md ring-2 ring-primary/40 scale-105"
                    : "border-border/80 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:border-primary/40",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-muted-foreground">
                    {block.domain}
                  </span>
                </div>

                <p className="mt-2 font-display text-xs font-extrabold text-foreground uppercase leading-tight">
                  {block.name}
                </p>
                <p className="mt-0.5 font-mono text-[8px] text-muted-foreground line-clamp-1">
                  {block.technicalLabel}
                </p>
              </button>

              {!isLast && <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Selected Block Math Detail Box */}
      <div className="mt-4 rounded-2xl border border-primary/30 bg-secondary/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <currentBlock.icon className="h-4 w-4" />
            </span>
            <div>
              <span className="font-mono text-[9px] font-bold text-primary uppercase">
                Stage {PIPELINE_BLOCKS.findIndex((b) => b.id === currentBlock.id) + 1} of{" "}
                {PIPELINE_BLOCKS.length} · {currentBlock.domain} Domain
              </span>
              <h4 className="font-display text-base font-extrabold text-foreground uppercase">
                {currentBlock.name} — {currentBlock.technicalLabel}
              </h4>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card px-3 py-1 font-mono text-xs font-bold text-foreground">
            Operator: {currentBlock.impulseOrTransfer}
          </div>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentBlock.description}
            </p>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border/80 bg-black/30 p-2.5 font-mono text-xs font-bold text-primary">
              <span className="text-muted-foreground">Formula:</span>
              <span>{currentBlock.mathFormula}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-3 font-mono text-[10px] text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1 text-foreground font-bold uppercase">
              <Info className="h-3 w-3 text-primary" />
              <span>LTI Cascade Proof:</span>
            </div>
            <p>
              Linearity and time-invariance ensure the entire recipe can be represented as a single
              composite convolution impulse response: {"h_total[n] = (h_wash * h_oven * h_room)[n]"}
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
