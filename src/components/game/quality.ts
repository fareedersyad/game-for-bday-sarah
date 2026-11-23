import { createContext, useContext } from 'react';
import type { QualityTier } from '../../utils/device';

export interface QualityProfile {
  tier: QualityTier;
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  /** Multiplier applied to particle counts. */
  particles: number;
  /** Multiplier applied to decorative instance counts (flowers, grass). */
  detail: number;
  antialias: boolean;
}

export const QUALITY: Record<QualityTier, QualityProfile> = {
  low: { tier: 'low', dpr: [0.75, 1], shadows: false, shadowMapSize: 512, particles: 0.35, detail: 0.45, antialias: false },
  medium: { tier: 'medium', dpr: [1, 1.5], shadows: true, shadowMapSize: 1024, particles: 0.65, detail: 0.75, antialias: true },
  high: { tier: 'high', dpr: [1, 2], shadows: true, shadowMapSize: 2048, particles: 1, detail: 1, antialias: true },
};

export const QualityContext = createContext<QualityProfile>(QUALITY.medium);
export const useQuality = () => useContext(QualityContext);
