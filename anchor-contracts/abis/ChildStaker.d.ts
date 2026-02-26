import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the platformFeeInfo function call.
 */
export type PlatformFeeInfo = CallResult<
    {
        pendingFee: bigint;
        creator: Address;
        anchorToken: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setCreator function call.
 */
export type SetCreator = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setSellPressurePool function call.
 */
export type SetSellPressurePool = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the harvestFees function call.
 */
export type HarvestFees = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IChildStaker
// ------------------------------------------------------------------
export interface IChildStaker extends IOP_NETContract {
    platformFeeInfo(): Promise<PlatformFeeInfo>;
    setCreator(newCreator: Address): Promise<SetCreator>;
    setSellPressurePool(pool: Address): Promise<SetSellPressurePool>;
    harvestFees(): Promise<HarvestFees>;
}
