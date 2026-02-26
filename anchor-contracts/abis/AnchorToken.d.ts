import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the authorizeChildStaker function call.
 */
export type AuthorizeChildStaker = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getFactory function call.
 */
export type GetFactory = CallResult<
    {
        factory: Address;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IAnchorToken
// ------------------------------------------------------------------
export interface IAnchorToken extends IOP_NETContract {
    authorizeChildStaker(staker: Address): Promise<AuthorizeChildStaker>;
    getFactory(): Promise<GetFactory>;
}
