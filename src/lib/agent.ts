import { FEATURE_KEYS, type MarketFeatures } from "./features";
import type { ClosedTrade } from "./sim";

/**
 * Apprentice agent: a tiny logistic-regression policy trained in the browser.
 *
 * Each closed trade is one labeled example: given the market features at entry,
 * which direction paid off? (A winning long and a losing short both say "long".)
 * Examples are weighted by the size of the move, so decisive outcomes teach more.
 */
export interface AgentModel {
  weights: number[];
  bias: number;
  mean: number[];
  std: number[];
  samples: number;
  accuracy: number; // in-sample
}

export const MIN_SAMPLES = 3;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const vec = (f: MarketFeatures) => FEATURE_KEYS.map((k) => f[k]);

export function labelOf(t: ClosedTrade): number {
  const moveUp = t.exitPx > t.entryPx;
  return moveUp ? 1 : 0;
}

export function trainAgent(trades: ClosedTrade[]): AgentModel | null {
  const data = trades.filter((t) => t.entryFeatures && t.exitPx !== t.entryPx);
  if (data.length < MIN_SAMPLES) return null;

  const X = data.map((t) => vec(t.entryFeatures!));
  const y = data.map(labelOf);
  const w8 = data.map((t) => 1 + Math.min(Math.abs(t.exitPx / t.entryPx - 1) * 100, 4));

  const d = FEATURE_KEYS.length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((a, r) => a + r[j], 0) / X.length);
  const std = Array.from({ length: d }, (_, j) => {
    const s = Math.sqrt(X.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / X.length);
    return s > 1e-12 ? s : 1;
  });
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / std[j]));

  const weights = new Array(d).fill(0);
  let bias = 0;
  const lr = 0.15;
  const l2 = 0.05;
  const W = w8.reduce((a, b) => a + b, 0);
  for (let epoch = 0; epoch < 400; epoch++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < Z.length; i++) {
      const p = sigmoid(Z[i].reduce((a, v, j) => a + v * weights[j], bias));
      const err = (p - y[i]) * w8[i];
      for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) weights[j] -= lr * (gw[j] / W + l2 * weights[j]);
    bias -= lr * (gb / W);
  }

  const model: AgentModel = { weights, bias, mean, std, samples: data.length, accuracy: 0 };
  const correct = data.filter((t, i) => (predict(model, t.entryFeatures!, false) > 0.5 ? 1 : 0) === y[i]).length;
  model.accuracy = correct / data.length;
  return model;
}

/**
 * Probability the agent assigns to "long" in the given conditions.
 * Shrunk toward 50% while the agent has few examples, so it doesn't overclaim.
 */
export function predict(m: AgentModel, f: MarketFeatures, shrink = true): number {
  const z = vec(f).reduce((a, v, j) => a + ((v - m.mean[j]) / m.std[j]) * m.weights[j], m.bias);
  const p = sigmoid(z);
  if (!shrink) return p;
  const trust = m.samples / (m.samples + 20);
  return 0.5 + (p - 0.5) * trust;
}
