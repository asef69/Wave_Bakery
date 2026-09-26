/** Percentage match colour for the playground labs' stats: green from 90 %, red below 60 %. */
export function matchTone(v: number): "good" | "bad" | "neutral" {
  return v >= 90 ? "good" : v < 60 ? "bad" : "neutral";
}
