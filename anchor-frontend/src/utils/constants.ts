export const BLOCKS_PER_DAY = 144;
export const MULTIPLIER_BLOCKS = 1440;
export const COOLDOWN_BLOCKS = 1008;
export const BASE_EMISSION_PER_BLOCK = 69_444;
export const TOTAL_SUPPLY = 1_000_000_000;
export const DECIMALS = 18;
export const DEV_FEE_PERCENT = 10;
export const STAKER_BOOST = 1.5;
export const PLATFORM_FEE_PERCENT = 1;
export const CREATOR_ALLOCATION_PERCENT = 5;
export const LP_ALLOCATION_PERCENT = 95;

export const DISCLAIMER_KEY = 'anchor-disclaimer-accepted';

export const NAV_LINKS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Stake', path: '/stake' },
  { label: 'Factory', path: '/factory' },
  { label: 'Admin', path: '/admin' },
] as const;
