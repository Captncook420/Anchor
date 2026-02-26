import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the setPool function call.
 */
export type SetPool = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setMinter function call.
 */
export type SetMinter = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the pendingRewards function call.
 */
export type PendingRewards = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the consumePendingRewards function call.
 */
export type ConsumePendingRewards = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the injectSellPressure function call.
 */
export type InjectSellPressure = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isPool function call.
 */
export type IsPool = CallResult<
    {
        approved: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the flowInfo function call.
 */
export type FlowInfo = CallResult<
    {
        inFlow: bigint;
        outFlow: bigint;
        hwm: bigint;
        consumed: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ISellPressureToken
// ------------------------------------------------------------------
export interface ISellPressureToken extends IOP_NETContract {
    setPool(pool: Address, approved: boolean): Promise<SetPool>;
    setMinter(minter: Address, authorized: boolean): Promise<SetMinter>;
    pendingRewards(pool: Address): Promise<PendingRewards>;
    consumePendingRewards(pool: Address): Promise<ConsumePendingRewards>;
    mint(to: Address, amount: bigint): Promise<Mint>;
    injectSellPressure(pool: Address, amount: bigint): Promise<InjectSellPressure>;
    isPool(pool: Address): Promise<IsPool>;
    flowInfo(pool: Address): Promise<FlowInfo>;
}
