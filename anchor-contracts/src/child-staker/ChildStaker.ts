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

const PLATFORM_FEE_BPS: u256 = u256.fromU32(100); // 1%
const SP_PRECISION: u256 = u256.fromString('1000000000000');
const BPS: u256 = u256.fromU32(10000);
const DEV_BPS: u256 = u256.fromU32(1000);
const BOOST: u256 = u256.fromU32(15000);

/**
 * ChildStaker: LP staking for child token/MOTO pairs.
 * Same as AnchorStaker PLUS 1% platform fee that feeds ANCHOR flywheel:
 *   1% of emissions → mint child → swap to MOTO → half to ANCHOR → LP → burn
 * Dev fee goes to token creator (not ANCHOR deployer).
 */
@final
export class ChildStaker extends LpStaker {
    private readonly creatorAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly anchorTokenAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly factoryAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly pendingPlatformFee: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    private readonly anchorLpPool: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly spPool: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly accSpPerShare: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    private readonly userSpDebt: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        // Parent reads: rewardToken, lpToken, dev
        super.onDeployment(calldata);

        const creator: Address = calldata.readAddress();
        const anchorTkn: Address = calldata.readAddress();
        const factory: Address = calldata.readAddress();
        const anchorLp: Address = calldata.readAddress();

        this.creatorAddr.value = creator;
        this.anchorTokenAddr.value = anchorTkn;
        this.factoryAddr.value = factory;
        this.anchorLpPool.value = anchorLp;

        // Dev fee goes to creator for child stakers
        this.devAddr.value = creator;
    }

    @view
    @method()
    @returns(
        { name: 'pendingFee', type: ABIDataTypes.UINT256 },
        { name: 'creator', type: ABIDataTypes.ADDRESS },
        { name: 'anchorToken', type: ABIDataTypes.ADDRESS },
    )
    public platformFeeInfo(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(96);
        w.writeU256(this.pendingPlatformFee.value);
        w.writeAddress(this.creatorAddr.value);
        w.writeAddress(this.anchorTokenAddr.value);
        return w;
    }

    @method({ name: 'newCreator', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setCreator(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        const nc: Address = calldata.readAddress();
        this.creatorAddr.value = nc;
        this.devAddr.value = nc;
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
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

    @method()
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public harvestFees(_calldata: Calldata): BytesWriter {
        const fee: u256 = this.pendingPlatformFee.value;
        if (fee > u256.Zero) {
            this.pendingPlatformFee.value = u256.Zero;
            this._mintRewardToken(Blockchain.tx.sender, fee);

            // Inject 2x fee as virtual sell-pressure on ANCHOR LP pool
            // This ensures harvest ANCHOR buys are treated as sell pressure
            if (!this.anchorLpPool.isDead()) {
                const injectionAmount: u256 = SafeMath.mul(fee, u256.fromU32(2));
                const cd: BytesWriter = new BytesWriter(68);
                cd.writeSelector(encodeSelector('injectSellPressure(address,uint256)'));
                cd.writeAddress(this.anchorLpPool.value);
                cd.writeU256(injectionAmount);
                Blockchain.call(this.anchorTokenAddr.value, cd, false);
            }
        }
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(fee);
        return w;
    }

    // Sync SP debt on every stake change (prevents retroactive SP rewards)
    protected override _onUserStakeChanged(user: Address, newStake: u256): void {
        this.userSpDebt.set(
            user,
            SafeMath.div(SafeMath.mul(newStake, this.accSpPerShare.value), SP_PRECISION),
        );
    }

    // Override: consume sell-pressure + platform fee accounting
    protected override _updatePool(): void {
        super._updatePool();
        this._consumeSP();
    }

    // Override: take 1% platform fee before distribution
    protected override _distributeReward(user: Address, rawPending: u256): u256 {
        // 1% platform fee taken first
        const fee: u256 = SafeMath.div(SafeMath.mul(rawPending, PLATFORM_FEE_BPS), BPS);
        const afterFee: u256 = SafeMath.sub(rawPending, fee);

        if (fee > u256.Zero) {
            this.pendingPlatformFee.value = SafeMath.add(this.pendingPlatformFee.value, fee);
        }

        // Base distribution (multiplier, dev fee to creator, boost)
        const distributed: u256 = super._distributeReward(user, afterFee);

        // Sell-pressure bonus
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
                        this._mintRewardToken(this.creatorAddr.value, devFee);
                    }
                    if (boosted > u256.Zero) {
                        this._mintRewardToken(user, boosted);
                    }
                }
            }

            this.userSpDebt.set(user, spAcc);
        }

        return distributed;
    }

    // Consume sell-pressure rewards from child token
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
