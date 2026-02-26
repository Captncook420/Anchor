/** MotoSwap and MOTO addresses per network. */

// Testnet (OPNet Signet fork)
export const MOTO_TOKEN = '0xfd4473840751d58d9f8b73bdd57d6c5260453d5518bd7cd02d0a4cf3df9bf4dd';
export const MOTOSWAP_ROUTER = '0x0e6ff1f2d7db7556cb37729e3738f4dae82659b984b2621fab08e1111b1b937a';
export const MOTOSWAP_FACTORY = '0xa02aa5ca4c307107484d5fb690d811df1cf526f8de204d24528653dcae369a0f';

// Deployment cost defaults
export const DEFAULT_FEE_RATE = 10;
export const DEFAULT_PRIORITY_FEE = 50_000n;
export const DEFAULT_GAS_SAT_FEE = 50_000n;
export const MAX_SAT_SPEND = 100_000n;

// Child token supply: 1B with 18 decimals
export const CHILD_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const CHILD_LP_AMOUNT = (CHILD_TOTAL_SUPPLY * 95n) / 100n; // 95%
export const CHILD_CREATOR_AMOUNT = (CHILD_TOTAL_SUPPLY * 5n) / 100n; // 5%
