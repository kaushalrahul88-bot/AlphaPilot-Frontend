import type { FnoScanResponse } from '@/lib/alphaPilotApi';

export const DEFAULT_MIN_RR = 1.5;
export const LONG_ALPHA_MIN = 65;
export const SHORT_ALPHA_MAX = 35;

export type ExecutionQualification = {
  pass: boolean;
  reason?: string;
  direction: 'LONG' | 'SHORT';
  action: 'BUY CE' | 'BUY PE';
  alpha: number;
  alpha_strength: number;
  underlying_rr: number;
  option_rr: number;
};

export function directionOf(result: FnoScanResponse): 'LONG' | 'SHORT' {
  const raw = String(result.technical?.direction ?? result.recommended_option?.direction ?? '').toUpperCase();
  return raw.includes('SHORT') ? 'SHORT' : 'LONG';
}

export function actionOf(result: FnoScanResponse): 'BUY CE' | 'BUY PE' {
  return directionOf(result) === 'SHORT' ? 'BUY PE' : 'BUY CE';
}

/**
 * Directional Alpha is a polarity score, not a universal quality score:
 * 0 = strongly bearish, 50 = neutral, 100 = strongly bullish.
 */
export function finalAlpha(result: FnoScanResponse): number {
  const alpha = Number(result.overall_alpha_score ?? 50);
  return Number.isFinite(alpha) ? alpha : 50;
}

export const directionalAlpha = finalAlpha;

/**
 * Convert directional Alpha into direction-agnostic setup strength.
 * LONG strength = Alpha; SHORT strength = 100 - Alpha.
 */
export function alphaStrength(result: FnoScanResponse): number {
  const alpha = finalAlpha(result);
  return directionOf(result) === 'SHORT' ? 100 - alpha : alpha;
}

export function optionRiskReward(result: FnoScanResponse): number {
  const option = result.recommended_option ?? {};
  const direct = Number(option.option_risk_reward);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const entry = Number(option.option_entry ?? option.premium);
  const stop = Number(option.option_stop_loss);
  const target = Number(option.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  return [entry, stop, target, risk, reward].every(Number.isFinite) && risk > 0 && reward > 0 ? reward / risk : 0;
}

export function underlyingRiskReward(result: FnoScanResponse): number {
  const rr = Number(result.technical?.risk_reward ?? 0);
  return Number.isFinite(rr) ? rr : 0;
}

export function executionQualification(result: FnoScanResponse, minRR = DEFAULT_MIN_RR): ExecutionQualification {
  const direction = directionOf(result);
  const action = actionOf(result);
  const alpha = finalAlpha(result);
  const underlying_rr = underlyingRiskReward(result);
  const option_rr = optionRiskReward(result);
  const alphaPass = direction === 'SHORT' ? alpha <= SHORT_ALPHA_MAX : alpha >= LONG_ALPHA_MIN;

  if (!alphaPass) {
    return {
      pass: false,
      reason: direction === 'SHORT'
        ? `Directional Alpha ${alpha.toFixed(1)} is above the BUY PE bearish limit of ${SHORT_ALPHA_MAX}.`
        : `Directional Alpha ${alpha.toFixed(1)} is below the BUY CE bullish threshold of ${LONG_ALPHA_MIN}.`,
      direction,
      action,
      alpha,
      alpha_strength: alphaStrength(result),
      underlying_rr,
      option_rr,
    };
  }

  if (underlying_rr < minRR) {
    return {
      pass: false,
      reason: `Underlying R:R ${underlying_rr.toFixed(2)} is below the required ${minRR.toFixed(2)}.`,
      direction,
      action,
      alpha,
      alpha_strength: alphaStrength(result),
      underlying_rr,
      option_rr,
    };
  }

  if (result.execution_ready !== true) {
    return {
      pass: false,
      reason: String(result.execution_quality?.primary_blocker ?? 'Backend execution gate is not ready.'),
      direction,
      action,
      alpha,
      alpha_strength: alphaStrength(result),
      underlying_rr,
      option_rr,
    };
  }

  if (result.execution_quality?.ready !== true) {
    return {
      pass: false,
      reason: String(result.execution_quality?.primary_blocker ?? 'Execution quality checks are incomplete.'),
      direction,
      action,
      alpha,
      alpha_strength: alphaStrength(result),
      underlying_rr,
      option_rr,
    };
  }

  return {
    pass: true,
    direction,
    action,
    alpha,
    alpha_strength: alphaStrength(result),
    underlying_rr,
    option_rr,
  };
}

/**
 * Authoritative BEST TRADE ordering.
 *
 * Rank only after hard execution gates pass. Directional strength is used so
 * a bearish Alpha of 27 becomes 73 strength, exactly mirroring a bullish Alpha
 * of 73, without treating low bearish Alpha as low setup quality.
 */
export function rankScore(result: FnoScanResponse): number {
  return alphaStrength(result);
}

export function rankQualifiedResults(results: FnoScanResponse[], minRR = DEFAULT_MIN_RR): FnoScanResponse[] {
  return [...results]
    .filter(result => executionQualification(result, minRR).pass)
    .sort((a, b) => rankScore(b) - rankScore(a));
}
