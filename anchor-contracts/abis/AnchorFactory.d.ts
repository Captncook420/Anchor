import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the deployChildToken function call.
 */
export type DeployChildToken = CallResult<
    {
        tokenAddress: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the finalizeChild function call.
 */
export type FinalizeChild = CallResult<
    {
        stakerAddress: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setAnchorAddresses function call.
 */
export type SetAnchorAddresses = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setTemplates function call.
 */
export type SetTemplates = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getChildToken function call.
 */
export type GetChildToken = CallResult<
    {
        token: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getStakerFor function call.
 */
export type GetStakerFor = CallResult<
    {
        staker: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getCreator function call.
 */
export type GetCreator = CallResult<
    {
        creator: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getChildTokenCount function call.
 */
export type GetChildTokenCount = CallResult<
    {
        count: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getAnchorToken function call.
 */
export type GetAnchorToken = CallResult<
    {
        token: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getAnchorStaker function call.
 */
export type GetAnchorStaker = CallResult<
    {
        staker: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isRegisteredToken function call.
 */
export type IsRegisteredToken = CallResult<
    {
        registered: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isPendingToken function call.
 */
export type IsPendingToken = CallResult<
    {
        isPending: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IAnchorFactory
// ------------------------------------------------------------------
export interface IAnchorFactory extends IOP_NETContract {
    deployChildToken(name: string, symbol: string): Promise<DeployChildToken>;
    finalizeChild(childToken: Address, lpPair: Address): Promise<FinalizeChild>;
    setAnchorAddresses(token: Address, staker: Address, lpPool: Address): Promise<SetAnchorAddresses>;
    setTemplates(tokenTemplate: Address, stakerTemplate: Address): Promise<SetTemplates>;
    getChildToken(index: bigint): Promise<GetChildToken>;
    getStakerFor(childToken: Address): Promise<GetStakerFor>;
    getCreator(childToken: Address): Promise<GetCreator>;
    getChildTokenCount(): Promise<GetChildTokenCount>;
    getAnchorToken(): Promise<GetAnchorToken>;
    getAnchorStaker(): Promise<GetAnchorStaker>;
    isRegisteredToken(token: Address): Promise<IsRegisteredToken>;
    isPendingToken(token: Address): Promise<IsPendingToken>;
}
