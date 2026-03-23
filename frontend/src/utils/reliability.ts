export type ReliabilityLevel = 'high' | 'moderate' | 'low';

export interface Reliability {
  level: ReliabilityLevel;
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
}

export function getReliability(
  p_value: number | null | undefined,
  sample_size: number | null | undefined
): Reliability {
  const p = p_value ?? null;
  const n = sample_size ?? null;

  if (p !== null && p < 0.05 && n !== null && n > 200) {
    return {
      level: 'high',
      label: 'High Reliability',
      colorClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }

  if ((p !== null && p < 0.05) || (n !== null && n > 100)) {
    return {
      level: 'moderate',
      label: 'Moderate Reliability',
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-50 border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }

  return {
    level: 'low',
    label: 'Low Reliability',
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-100 border-slate-200',
    dotClass: 'bg-slate-400',
  };
}
