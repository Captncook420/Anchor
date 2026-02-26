import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    SafeMath,
    AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';
import { CallResult } from '@btc-vision/btc-runtime/runtime/env/BlockchainEnvironment';
import { StoredU256 } from '@btc-vision/btc-runtime/runtime/storage/StoredU256';
import { StoredAddress } from '@btc-vision/btc-runtime/runtime/storage/StoredAddress';
import { EMPTY_POINTER } from '@btc-vision/btc-runtime/runtime/math/bytes';
import { LpStaker } from '../lib/LpStaker';

const SP_PRECISION: u256 = u256.fromString('1000000000000'); // 1e12
const BPS: u256 = u256.fromU32(10000);
const DEV_BPS: u256 = u256.fromU32(1000);
const BOOST: u256 = u256.fromU32(15000);

/**
 * ANCHOR Staker: MasterChef LP staking for ANCHOR/MOTO pair.
 * Adds sell-pressure bonus rewards on top of base emission.
 */
@final
export class AnchorStaker extends LpStaker {
    // Sell-pressure tracking
    private readonly spPool: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly accSpPerShare: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    private readonly userSpDebt: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);

    public constructor() {
        super();
    }

    /**
     * Deployment calldata: rewardToken (Address), lpToken (Address), dev (Address).
     * Also pre-sets the sell-pressure pool to the LP token address.
     */
    public override onDeployment(calldata: Calldata): void {
        this.rewardTokenAddr.value = calldata.readAddress();
        const lp: Address = calldata.readAddress();
        this.lpTokenAddr.value = lp;
        this.devAddr.value = calldata.readAddress();
        this.lastRewardBlock.value = Blockchain.block.numberU256;

        // Pre-set sell-pressure pool to the LP pair
        this.spPool.value = lp;
    }

    @method({ name: 'pool', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setSellPressurePool(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        this.spPool.value = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    @view
    @method()
    @returns(
        { name: 'pool', type: ABIDataTypes.ADDRESS },
        { name: 'accSpPerShare', type: ABIDataTypes.UINT256 },
    )
    public sellPressureInfo(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(64);
        w.writeAddress(this.spPool.value);
        w.writeU256(this.accSpPerShare.value);
        return w;
    }

    // Sync SP debt on every stake change (prevents retroactive SP rewards)
    protected override _onUserStakeChanged(user: Address, newStake: u256): void {
        this.userSpDebt.set(
            user,
            SafeMath.div(SafeMath.mul(newStake, this.accSpPerShare.value), SP_PRECISION),
        );
    }

    // Override to consume sell-pressure rewards during pool update
    protected override _updatePool(): void {
        super._updatePool();
        this._consumeSP();
    }

    // Override to add sell-pressure bonus to reward distribution
    protected override _distributeReward(user: Address, rawPending: u256): u256 {
        const base: u256 = super._distributeReward(user, rawPending);

        // Add sell-pressure bonus
        const staked: u256 = this.userStaked.get(user);
        if (staked > u256.Zero) {
            const spAcc: u256 = SafeMath.div(
                SafeMath.mul(staked, this.accSpPerShare.value),
                SP_PRECISION,
            );
            const spDebt: u256 = this.userSpDebt.get(user);

            if (spAcc > spDebt) {
                const bonus: u256 = SafeMath.sub(spAcc, spDebt);
                const mul: u256 = this._getMultiplier(user);
                const afterMul: u256 = SafeMath.div(SafeMath.mul(bonus, mul), BPS);

                if (afterMul > u256.Zero) {
                    const devFee: u256 = SafeMath.div(SafeMath.mul(afterMul, DEV_BPS), BPS);
                    const afterDev: u256 = SafeMath.sub(afterMul, devFee);
                    const boosted: u256 = SafeMath.div(SafeMath.mul(afterDev, BOOST), BPS);

                    if (devFee > u256.Zero) {
                        this._mintRewardToken(this.devAddr.value, devFee);
                    }
                    if (boosted > u256.Zero) {
                        this._mintRewardToken(user, boosted);
                    }
                }
            }

            this.userSpDebt.set(user, spAcc);
        }

        return base;
    }

    // Consume sell-pressure rewards from AnchorToken
    private _consumeSP(): void {
        if (this.spPool.isDead()) return;

        const total: u256 = this.totalStaked.value;
        if (total.isZero()) return;

        const cd: BytesWriter = new BytesWriter(36);
        cd.writeSelector(encodeSelector('consumePendingRewards(address)'));
        cd.writeAddress(this.spPool.value);

        const result: CallResult = Blockchain.call(this.rewardTokenAddr.value, cd, false);
        if (result.success) {
            const consumed: u256 = result.data.readU256();
            if (consumed > u256.Zero) {
                this.accSpPerShare.value = SafeMath.add(
                    this.accSpPerShare.value,
                    SafeMath.div(SafeMath.mul(consumed, SP_PRECISION), total),
                );
            }
        }
    }
}
