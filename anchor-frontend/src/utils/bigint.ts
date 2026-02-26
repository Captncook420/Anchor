const DEFAULT_DECIMALS = 18n;

export function bigintToNumber(value: bigint, decimals: bigint = DEFAULT_DECIMALS): number {
  const factor = 10n ** decimals;
  const whole = value / factor;
  const remainder = value % factor;
  return Number(whole) + Number(remainder) / Number(factor);
}

export function numberToBigint(value: number, decimals: bigint = DEFAULT_DECIMALS): bigint {
  const factor = 10n ** decimals;
  return BigInt(Math.floor(value * Number(factor)));
}
