export interface PositionSizingInput {
  tradingCapital: number;
  maxRiskPct: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  brokerage: number;
  lotSize?: number;
}

export interface PositionSizingResult {
  maxRiskRupees: number;
  riskPerUnit: number;
  rawQuantity: number;
  quantity: number;
  lots: number;
  positionValue: number;
  potentialLoss: number;
  potentialProfit: number;
  riskReward: number;
  capitalUtilization: number;
  capitalUtilizationPct: number;
  warning?: string;
}

export function calculatePositionSizing(input: PositionSizingInput): PositionSizingResult {
  const maxRiskRupees = (input.tradingCapital * input.maxRiskPct) / 100;
  const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);
  const rewardPerUnit = Math.abs(input.targetPrice - input.entryPrice);

  if (riskPerUnit === 0) {
    return { maxRiskRupees, riskPerUnit: 0, rawQuantity: 0, quantity: 0, lots: 0, positionValue: 0, potentialLoss: 0, potentialProfit: 0, riskReward: 0, capitalUtilization: 0, capitalUtilizationPct: 0, warning: 'Entry price and stop loss are the same. Risk per unit is zero.' };
  }

  const rawQuantity = Math.floor(maxRiskRupees / riskPerUnit);
  const lotSize = input.lotSize ?? 1;
  const lots = Math.floor(rawQuantity / lotSize);
  const quantity = lots * lotSize;
  const positionValue = quantity * input.entryPrice;
  const potentialLoss = quantity * riskPerUnit + input.brokerage;
  const potentialProfit = quantity * rewardPerUnit - input.brokerage;
  const riskReward = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
  const capitalUtilizationPct = (positionValue / input.tradingCapital) * 100;

  let warning: string | undefined;
  if (quantity === 0) warning = `Position size is 0. Risk per unit exceeds max risk. Increase risk % or widen stop loss.`;
  else if (potentialLoss > maxRiskRupees) warning = `Potential loss exceeds your max risk limit of ₹${maxRiskRupees.toFixed(0)}.`;
  else if (capitalUtilizationPct > 50) warning = `This position uses ${capitalUtilizationPct.toFixed(1)}% of your capital. Consider reducing size.`;

  return { maxRiskRupees, riskPerUnit, rawQuantity, quantity, lots, positionValue, potentialLoss, potentialProfit, riskReward, capitalUtilization: positionValue, capitalUtilizationPct, warning };
}
