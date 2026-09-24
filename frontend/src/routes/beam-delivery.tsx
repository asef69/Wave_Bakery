import { createFileRoute } from "@tanstack/react-router";
import { SystemDeliveryLab } from "@/routes/system-delivery";

export const Route = createFileRoute("/beam-delivery")({
  head: () => ({
    meta: [
      { title: "System Delivery Lab — WaveBakery" },
      {
        name: "description",
        content:
          "Equalize dish signals using z-plane poles and zeros, Radix-2 FFT spectrum analysis, and Nyquist sampling before serving.",
      },
      { property: "og:title", content: "System Delivery Lab — WaveBakery" },
      {
        property: "og:description",
        content:
          "z-Plane unit circle poles & zeros, Radix-2 FFT, and Nyquist sampling rate calibration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemDeliveryLab,
});
