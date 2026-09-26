/**
 * System Delivery lab: the recipe station's delivery cart on any signal. A
 * road tone is added at the true delivery rate, the vibration sensor reports
 * it at its own rate (aliased when slow), and the cart's H(z) — chosen on the
 * z-plane with the station's own plotter — filters dish + road.
 */
import { useMemo, useState } from "react";

import { SystemResponsePlotter } from "@/components/system/SystemResponsePlotter";
import { DELIVERY_FS } from "@/lib/delivery";
import { deliverOnPlaygroundCart, sourceSamples } from "@/lib/playground";
import type { SystemPresetType } from "@/lib/z-system";

import { LabHeading, LabSlider, Stat, type PlaygroundLabProps } from "./LabKit";
import { matchTone } from "./tone";

export function DeliveryLab({ source, signalId, onPlayAudio, playingClip }: PlaygroundLabProps) {
  const dish = useMemo(() => sourceSamples(source), [source]);
  const [preset, setPreset] = useState<SystemPresetType>("lowpass1");
  const [poleRadius, setPoleRadius] = useState(0.5);
  const [frequency, setFrequency] = useState(Math.PI / 2);
  const [sensorFs, setSensorFs] = useState(DELIVERY_FS);
  const [roadHz, setRoadHz] = useState(2600);
  const [roadAmp, setRoadAmp] = useState(0.8);

  const cart = useMemo(
    () =>
      deliverOnPlaygroundCart(dish, {
        preset,
        poleRadius,
        omega: frequency,
        roadHz,
        roadAmp,
        sensorFs,
      }),
    [dish, preset, poleRadius, frequency, roadHz, roadAmp, sensorFs],
  );

  const beforeId = `cart-before-${signalId}`;
  const afterId = `cart-after-${signalId}`;
  const isPlaying = playingClip === beforeId || playingClip === afterId;

  return (
    <div className="space-y-5">
      <section className="kitchen-card grid gap-5 p-6 lg:grid-cols-[1fr_1fr_1.2fr]">
        <LabHeading
          eyebrow="Station 07 · System Delivery"
          title="Road Vibration & H(z)"
          note={`y[n] = Σ b·x[n−k] − Σ a·y[n−k] at ${DELIVERY_FS} Hz on ${source.name}`}
        />
        <div className="space-y-2">
          <LabSlider
            label="Road vibration"
            value={roadHz}
            min={500}
            max={3900}
            step={100}
            readout={`${roadHz} Hz · ω = ${cart.roadOmega.toFixed(2)} rad`}
            onChange={setRoadHz}
          />
          <LabSlider
            label="Road strength"
            value={roadAmp}
            min={0}
            max={1.2}
            step={0.05}
            readout={`× ${roadAmp.toFixed(2)} of the peak`}
            onChange={setRoadAmp}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="|H| at the road"
            value={`× ${cart.roadGain.toFixed(2)}`}
            tone={cart.roadGain < 0.2 ? "good" : cart.roadGain > 1 ? "bad" : "neutral"}
          />
          <Stat
            label="|H| at DC (dish)"
            value={`× ${cart.dishGain.toFixed(2)}`}
            tone={Math.abs(cart.dishGain - 1) < 0.1 ? "good" : "neutral"}
          />
          <Stat
            label="Sensor reads"
            value={`${cart.sensedOmega.toFixed(2)} rad`}
            tone={Math.abs(cart.sensedOmega - cart.roadOmega) < 1e-6 ? "good" : "bad"}
          />
          <Stat
            label="Served vs dish"
            value={`${cart.accuracy}%`}
            tone={cart.stable ? matchTone(cart.accuracy) : "bad"}
          />
        </div>
      </section>

      <SystemResponsePlotter
        preset={preset}
        poleRadius={poleRadius}
        frequency={frequency}
        samplingRateHz={sensorFs}
        onPresetChange={setPreset}
        onPoleRadiusChange={setPoleRadius}
        onFrequencyChange={setFrequency}
        onSamplingRateChange={setSensorFs}
        dishSignal={cart.input}
        equalizedSignal={cart.served}
        vibrationOmega={cart.sensedOmega}
        roadGain={cart.roadGain}
        dishGain={cart.dishGain}
        accuracy={cart.accuracy}
        roadHz={roadHz}
        recipeName={source.name}
        onToggleAudio={() => onPlayAudio(afterId, cart.served, source.freq)}
        onPlayBeforeAudio={() => onPlayAudio(beforeId, cart.input, source.freq)}
        onPlayAfterAudio={() => onPlayAudio(afterId, cart.served, source.freq)}
        audioMode={playingClip === beforeId ? "before" : "after"}
        isPlaying={isPlaying}
      />
    </div>
  );
}
