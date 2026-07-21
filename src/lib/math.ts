export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Coerces a finite numeric input before clamping; invalid values resolve to `min`. */
export function clampFiniteNumber(value: unknown, min: number, max: number): number {
  const numericValue = Number(value);
  return clamp(Number.isFinite(numericValue) ? numericValue : min, min, max);
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function finiteNumberOrUndefined(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

export function finiteNumberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}
