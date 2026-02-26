import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the stake function call.
 */
export type Stake = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the unstake function call.
 */
export type Unstake = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the claim function call.
 */
export type Claim = CallResult<
    {
        amount: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the compound function call.
 */
export type Compound = CallResult<
    {
        distributed: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the pendingReward function call.
 */
export type PendingReward = CallResult<
    {
        rawPending: bigint;
        multiplierBps: bigint;
        afterMultiplier: bigint;
        afterFeeAndBoost: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the positionInfo function call.
 */
export type PositionInfo = CallResult<
    {
        staked: bigint;
        multiplierBps: bigint;
        multiplierStart: bigint;
        lastClaimBlock: bigint;
        cooldownRemaining: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the poolInfo function call.
 */
export type PoolInfo = CallResult<
    {
        totalStaked: bigint;
        accRewardPerShare: bigint;
        lastRewardBlock: bigint;
        rewardPerBlock: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the emergencyUnstake function call.
 */
export type EmergencyUnstake = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the setDevAddress function call.
 */
export type SetDevAddress = CallResult<
    {
        success: boolean;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// ILpStaker
// ------------------------------------------------------------------
export interface ILpStaker extends IOP_NETContract {
    stake(amount: bigint): Promise<Stake>;
    unstake(amount: bigint): Promise<Unstake>;
    claim(): Promise<Claim>;
    compound(amount: bigint): Promise<Compound>;
    pendingReward(user: Address): Promise<PendingReward>;
    positionInfo(user: Address): Promise<PositionInfo>;
    poolInfo(): Promise<PoolInfo>;
    emergencyUnstake(amount: bigint): Promise<EmergencyUnstake>;
    setDevAddress(newDev: Address): Promise<SetDevAddress>;
}
