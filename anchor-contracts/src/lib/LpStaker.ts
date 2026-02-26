import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    OP_NET,
    Revert,
    SafeMath,
    AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';
import { CallResult } from '@btc-vision/btc-runtime/runtime/env/BlockchainEnvironment';
import { StoredU256 } from '@btc-vision/btc-runtime/runtime/storage/StoredU256';
import { StoredAddress } from '@btc-vision/btc-runtime/runtime/storage/StoredAddress';
import { EMPTY_POINTER } from '@btc-vision/btc-runtime/runtime/math/bytes';

// ── Constants ──
const REWARD_PER_BLOCK: u256 = u256.fromString('69444000000000000000000'); // 69,444 * 1e18
const PRECISION: u256 = u256.fromString('1000000000000'); // 1e12
const BPS_DENOM: u256 = u256.fromU32(10000);
const DEV_FEE_BPS: u256 = u256.fromU32(1000); // 10%
const BOOST_BPS: u256 = u256.fromU32(15000); // 150%
const MULTIPLIER_BLOCKS: u256 = u256.fromU32(1440); // ~10 days
const COOLDOWN_BLOCKS: u256 = u256.fromU32(1008); // ~7 days

// OP20 selectors for cross-contract calls
const OP20_TRANSFER: u32 = encodeSelector('transfer(address,uint256)');
const OP20_TRANSFER_FROM: u32 = encodeSelector('transferFrom(address,address,uint256)');

/**
 * Base MasterChef-style LP staking contract.
 * - Time multiplier: 0% → 100% linearly over 1440 blocks
 * - Cooldown: 1008 blocks after claim before unstake
 * - 10% dev fee, 150% boost for stakers
 * - Un-multiplied portion discarded permanently
 */
export class LpStaker extends OP_NET {
    // ── Address storage ──
    protected readonly rewardTokenAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    protected readonly lpTokenAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    protected readonly devAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);

    // ── Value storage ──
    protected readonly totalStaked: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    protected readonly accRewardPerShare: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    protected readonly lastRewardBlock: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );
    protected readonly pendingPool: StoredU256 = new StoredU256(
        Blockchain.nextPointer,
        EMPTY_POINTER,
    );

    // ── Per-user maps ──
    protected readonly userStaked: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);
    protected readonly userRewardDebt: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );
    protected readonly userMultStart: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );
    protected readonly userLastClaim: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );

    // Reentrancy guard
    private locked: bool = false;

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const rewardToken: Address = calldata.readAddress();
        const lpToken: Address = calldata.readAddress();
        const dev: Address = calldata.readAddress();

        this.rewardTokenAddr.value = rewardToken;
        this.lpTokenAddr.value = lpToken;
        this.devAddr.value = dev;

        this.lastRewardBlock.value = Blockchain.block.numberU256;
    }

    // ── Stake LP tokens ──

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public stake(calldata: Calldata): BytesWriter {
        this._nonReentrant();

        const amount: u256 = calldata.readU256();
        if (amount.isZero()) throw new Revert('Cannot stake zero');

        const sender: Address = Blockchain.tx.sender;
        this._updatePool();

        const currentStake: u256 = this.userStaked.get(sender);

        // Harvest pending if already staking
        if (currentStake > u256.Zero) {
            const pending: u256 = this._calcPending(sender, currentStake);
            if (pending > u256.Zero) {
                this._distributeReward(sender, pending);
            }
        }

        // Update state before external calls
        const newStake: u256 = SafeMath.add(currentStake, amount);
        this.userStaked.set(sender, newStake);
        this.userRewardDebt.set(
            sender,
            SafeMath.div(SafeMath.mul(newStake, this.accRewardPerShare.value), PRECISION),
        );
        this.totalStaked.value = SafeMath.add(this.totalStaked.value, amount);

        // First stake sets multiplier start
        if (currentStake.isZero()) {
            this.userMultStart.set(sender, Blockchain.block.numberU256);
        }

        this._onUserStakeChanged(sender, newStake);

        // External: transfer LP from user to this contract
        this._lpTransferFrom(sender, Blockchain.contractAddress, amount);

        this.locked = false;
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── Unstake LP tokens ──

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public unstake(calldata: Calldata): BytesWriter {
        this._nonReentrant();

        const amount: u256 = calldata.readU256();
        const sender: Address = Blockchain.tx.sender;
        const currentStake: u256 = this.userStaked.get(sender);

        if (amount.isZero() || amount > currentStake) throw new Revert('Invalid amount');

        // Cooldown check
        const lastClaim: u256 = this.userLastClaim.get(sender);
        if (!lastClaim.isZero()) {
            const now: u256 = Blockchain.block.numberU256;
            if (now < SafeMath.add(lastClaim, COOLDOWN_BLOCKS)) {
                throw new Revert('Cooldown active');
            }
        }

        this._updatePool();

        // Harvest
        const pending: u256 = this._calcPending(sender, currentStake);
        if (pending > u256.Zero) {
            this._distributeReward(sender, pending);
        }

        // Update state before external calls
        const newStake: u256 = SafeMath.sub(currentStake, amount);
        this.userStaked.set(sender, newStake);
        this.userRewardDebt.set(
            sender,
            SafeMath.div(SafeMath.mul(newStake, this.accRewardPerShare.value), PRECISION),
        );
        this.totalStaked.value = SafeMath.sub(this.totalStaked.value, amount);

        this._onUserStakeChanged(sender, newStake);

        // External: transfer LP back
        this._lpTransfer(sender, amount);

        this.locked = false;
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── Claim rewards (resets multiplier, starts cooldown) ──

    @method()
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public claim(_calldata: Calldata): BytesWriter {
        this._nonReentrant();

        const sender: Address = Blockchain.tx.sender;
        const staked: u256 = this.userStaked.get(sender);
        if (staked.isZero()) throw new Revert('Nothing staked');

        this._updatePool();

        const pending: u256 = this._calcPending(sender, staked);
        if (pending.isZero()) throw new Revert('No rewards');

        // Update state
        this.userRewardDebt.set(
            sender,
            SafeMath.div(SafeMath.mul(staked, this.accRewardPerShare.value), PRECISION),
        );
        const now: u256 = Blockchain.block.numberU256;
        this.userLastClaim.set(sender, now);
        this.userMultStart.set(sender, now); // Claim RESETS multiplier

        const distributed: u256 = this._distributeReward(sender, pending);

        this.locked = false;
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(distributed);
        return w;
    }

    // ── Compound (preserves multiplier, partial amount) ──
    // Mints reward tokens to caller. Multiplier NOT reset (advantage over claim).
    // Caller specifies how much of pending rewards to compound; remainder stays pending.
    // Frontend then handles: swap half to MOTO → addLiquidity → stake LP.

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'distributed', type: ABIDataTypes.UINT256 })
    public compound(calldata: Calldata): BytesWriter {
        this._nonReentrant();

        const sender: Address = Blockchain.tx.sender;
        const staked: u256 = this.userStaked.get(sender);
        if (staked.isZero()) throw new Revert('Nothing staked');

        const amount: u256 = calldata.readU256();

        this._updatePool();

        const pending: u256 = this._calcPending(sender, staked);
        if (pending.isZero()) throw new Revert('No rewards');

        // Cap to available pending
        const toCompound: u256 = amount > pending ? pending : amount;

        // Partially consume rewards — increase debt by compounded amount only
        const currentDebt: u256 = this.userRewardDebt.get(sender);
        this.userRewardDebt.set(sender, SafeMath.add(currentDebt, toCompound));

        // Mint reward tokens to caller (applies multiplier, dev fee, boost)
        const distributed: u256 = this._distributeReward(sender, toCompound);

        // Compound does NOT reset multiplier or cooldown
        this._onUserStakeChanged(sender, staked);

        this.locked = false;
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(distributed);
        return w;
    }

    // ── View: pending rewards ──

    @view
    @method({ name: 'user', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'rawPending', type: ABIDataTypes.UINT256 },
        { name: 'multiplierBps', type: ABIDataTypes.UINT256 },
        { name: 'afterMultiplier', type: ABIDataTypes.UINT256 },
        { name: 'afterFeeAndBoost', type: ABIDataTypes.UINT256 },
    )
    public pendingReward(calldata: Calldata): BytesWriter {
        const user: Address = calldata.readAddress();
        const staked: u256 = this.userStaked.get(user);

        let rawP: u256 = u256.Zero;
        let mul: u256 = u256.Zero;
        let afterMul: u256 = u256.Zero;
        let afterFB: u256 = u256.Zero;

        if (staked > u256.Zero) {
            // Simulate pool update
            let simAcc: u256 = this.accRewardPerShare.value;
            const now: u256 = Blockchain.block.numberU256;
            const last: u256 = this.lastRewardBlock.value;
            const total: u256 = this.totalStaked.value;

            if (now > last && total > u256.Zero) {
                const blocks: u256 = SafeMath.sub(now, last);
                const reward: u256 = SafeMath.mul(blocks, REWARD_PER_BLOCK);
                simAcc = SafeMath.add(simAcc, SafeMath.div(SafeMath.mul(reward, PRECISION), total));
            }

            const accumulated: u256 = SafeMath.div(SafeMath.mul(staked, simAcc), PRECISION);
            const debt: u256 = this.userRewardDebt.get(user);
            if (accumulated > debt) {
                rawP = SafeMath.sub(accumulated, debt);
            }
            mul = this._getMultiplier(user);
            afterMul = SafeMath.div(SafeMath.mul(rawP, mul), BPS_DENOM);
            const devFee: u256 = SafeMath.div(SafeMath.mul(afterMul, DEV_FEE_BPS), BPS_DENOM);
            afterFB = SafeMath.div(
                SafeMath.mul(SafeMath.sub(afterMul, devFee), BOOST_BPS),
                BPS_DENOM,
            );
        }

        const w: BytesWriter = new BytesWriter(128);
        w.writeU256(rawP);
        w.writeU256(mul);
        w.writeU256(afterMul);
        w.writeU256(afterFB);
        return w;
    }

    // ── View: position info ──

    @view
    @method({ name: 'user', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'staked', type: ABIDataTypes.UINT256 },
        { name: 'multiplierBps', type: ABIDataTypes.UINT256 },
        { name: 'multiplierStart', type: ABIDataTypes.UINT256 },
        { name: 'lastClaimBlock', type: ABIDataTypes.UINT256 },
        { name: 'cooldownRemaining', type: ABIDataTypes.UINT256 },
    )
    public positionInfo(calldata: Calldata): BytesWriter {
        const user: Address = calldata.readAddress();
        const now: u256 = Blockchain.block.numberU256;
        const staked: u256 = this.userStaked.get(user);
        const mulBps: u256 = this._getMultiplier(user);
        const mulStart: u256 = this.userMultStart.get(user);
        const lastClaim: u256 = this.userLastClaim.get(user);

        let cooldown: u256 = u256.Zero;
        if (!lastClaim.isZero()) {
            const end: u256 = SafeMath.add(lastClaim, COOLDOWN_BLOCKS);
            if (now < end) cooldown = SafeMath.sub(end, now);
        }

        const w: BytesWriter = new BytesWriter(160);
        w.writeU256(staked);
        w.writeU256(mulBps);
        w.writeU256(mulStart);
        w.writeU256(lastClaim);
        w.writeU256(cooldown);
        return w;
    }

    // ── View: pool info ──

    @view
    @method()
    @returns(
        { name: 'totalStaked', type: ABIDataTypes.UINT256 },
        { name: 'accRewardPerShare', type: ABIDataTypes.UINT256 },
        { name: 'lastRewardBlock', type: ABIDataTypes.UINT256 },
        { name: 'rewardPerBlock', type: ABIDataTypes.UINT256 },
    )
    public poolInfo(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(128);
        w.writeU256(this.totalStaked.value);
        w.writeU256(this.accRewardPerShare.value);
        w.writeU256(this.lastRewardBlock.value);
        w.writeU256(REWARD_PER_BLOCK);
        return w;
    }

    // ── Emergency unstake (skips rewards, prevents fund lock if mint fails) ──

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public emergencyUnstake(calldata: Calldata): BytesWriter {
        this._nonReentrant();

        const amount: u256 = calldata.readU256();
        const sender: Address = Blockchain.tx.sender;
        const currentStake: u256 = this.userStaked.get(sender);

        if (amount.isZero() || amount > currentStake) throw new Revert('Invalid amount');

        const newStake: u256 = SafeMath.sub(currentStake, amount);
        this.userStaked.set(sender, newStake);
        this.userRewardDebt.set(
            sender,
            SafeMath.div(SafeMath.mul(newStake, this.accRewardPerShare.value), PRECISION),
        );
        this.totalStaked.value = SafeMath.sub(this.totalStaked.value, amount);

        this._onUserStakeChanged(sender, newStake);

        this._lpTransfer(sender, amount);

        this.locked = false;
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── Admin: set dev address ──

    @method({ name: 'newDev', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setDevAddress(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        this.devAddr.value = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── Internal: update pool accumulator ──

    protected _updatePool(): void {
        const now: u256 = Blockchain.block.numberU256;
        const last: u256 = this.lastRewardBlock.value;
        if (now <= last) return;

        const total: u256 = this.totalStaked.value;
        if (total.isZero()) {
            this.lastRewardBlock.value = now;
            return;
        }

        const blocks: u256 = SafeMath.sub(now, last);
        const reward: u256 = SafeMath.mul(blocks, REWARD_PER_BLOCK);
        this.accRewardPerShare.value = SafeMath.add(
            this.accRewardPerShare.value,
            SafeMath.div(SafeMath.mul(reward, PRECISION), total),
        );
        this.lastRewardBlock.value = now;
    }

    // ── Internal: calculate raw pending ──

    protected _calcPending(user: Address, staked: u256): u256 {
        const accumulated: u256 = SafeMath.div(
            SafeMath.mul(staked, this.accRewardPerShare.value),
            PRECISION,
        );
        const debt: u256 = this.userRewardDebt.get(user);
        if (accumulated > debt) return SafeMath.sub(accumulated, debt);
        return u256.Zero;
    }

    // ── Internal: get time multiplier (0-10000 bps) ──

    protected _getMultiplier(user: Address): u256 {
        const start: u256 = this.userMultStart.get(user);
        if (start.isZero()) return u256.Zero;

        const now: u256 = Blockchain.block.numberU256;
        if (now <= start) return u256.Zero;

        const elapsed: u256 = SafeMath.sub(now, start);
        const raw: u256 = SafeMath.div(SafeMath.mul(elapsed, BPS_DENOM), MULTIPLIER_BLOCKS);
        return raw > BPS_DENOM ? BPS_DENOM : raw;
    }

    // ── Internal: distribute reward with multiplier, dev fee, boost ──

    protected _distributeReward(user: Address, rawPending: u256): u256 {
        const mul: u256 = this._getMultiplier(user);
        const afterMul: u256 = SafeMath.div(SafeMath.mul(rawPending, mul), BPS_DENOM);
        if (afterMul.isZero()) return u256.Zero;

        // 10% dev fee
        const devFee: u256 = SafeMath.div(SafeMath.mul(afterMul, DEV_FEE_BPS), BPS_DENOM);
        // 150% boost on remainder
        const afterDev: u256 = SafeMath.sub(afterMul, devFee);
        const boosted: u256 = SafeMath.div(SafeMath.mul(afterDev, BOOST_BPS), BPS_DENOM);

        if (devFee > u256.Zero) this._mintRewardToken(this.devAddr.value, devFee);
        if (boosted > u256.Zero) this._mintRewardToken(user, boosted);

        return boosted;
    }

    // ── Internal: cross-contract mint ──

    protected _mintRewardToken(to: Address, amount: u256): void {
        const cd: BytesWriter = new BytesWriter(68);
        cd.writeSelector(encodeSelector('mint(address,uint256)'));
        cd.writeAddress(to);
        cd.writeU256(amount);

        const result: CallResult = Blockchain.call(this.rewardTokenAddr.value, cd, true);
        if (!result.success) throw new Revert('Mint failed');
    }

    // ── Internal: LP token transfers ──

    protected _lpTransferFrom(from: Address, to: Address, amount: u256): void {
        const cd: BytesWriter = new BytesWriter(100);
        cd.writeSelector(OP20_TRANSFER_FROM);
        cd.writeAddress(from);
        cd.writeAddress(to);
        cd.writeU256(amount);

        const result: CallResult = Blockchain.call(this.lpTokenAddr.value, cd, true);
        if (!result.success) throw new Revert('LP transferFrom failed');
    }

    protected _lpTransfer(to: Address, amount: u256): void {
        const cd: BytesWriter = new BytesWriter(68);
        cd.writeSelector(OP20_TRANSFER);
        cd.writeAddress(to);
        cd.writeU256(amount);

        const result: CallResult = Blockchain.call(this.lpTokenAddr.value, cd, true);
        if (!result.success) throw new Revert('LP transfer failed');
    }

    // ── Hook: called after user stake changes (override in subclasses for SP debt) ──

    protected _onUserStakeChanged(_user: Address, _newStake: u256): void {
        // No-op in base. Subclasses update SP debt here.
    }

    // ── Reentrancy guard ──

    protected _nonReentrant(): void {
        if (this.locked) throw new Revert('Reentrant call');
        this.locked = true;
    }
}
