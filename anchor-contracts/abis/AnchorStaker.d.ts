import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

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
 * @description Represents the result of the sellPressureInfo function call.
 */
export type SellPressureInfo = CallResult<
    {
        pool: Address;
        accSpPerShare: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IAnchorStaker
// ------------------------------------------------------------------
export interface IAnchorStaker extends IOP_NETContract {
    setSellPressurePool(pool: Address): Promise<SetSellPressurePool>;
    sellPressureInfo(): Promise<SellPressureInfo>;
}
