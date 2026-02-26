import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    Revert,
    SafeMath,
    AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';

/**
 * Base class for ANCHOR and child tokens.
 * Provides sell-pressure flow tracking on approved pools:
 *   - Tokens INTO a pool = sell (flowIn increments)
 *   - Tokens OUT of a pool = buy (flowOut increments)
 *   - When flowIn > flowOut, the delta accumulates as claimable staking rewards
 *   - High-water mark ensures rewards never shrink
 */
export class SellPressureToken extends OP20 {
    // ── Storage (pointers auto-allocated after OP20 internals) ──
    protected readonly approvedPools: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );
    protected readonly flowIn: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);
    protected readonly flowOut: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);
    protected readonly highWaterMark: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );
    protected readonly consumedRewards: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );
    protected readonly authorizedMinters: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );

    public constructor() {
        super();
    }

    // ── Transfer overrides: track sell-pressure flows ──

    public override transfer(calldata: Calldata): BytesWriter {
        const to: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const from: Address = Blockchain.tx.sender;

        this._trackFlow(from, to, amount);
        this._transfer(from, to, amount);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    public override transferFrom(calldata: Calldata): BytesWriter {
        const from: Address = calldata.readAddress();
        const to: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const spender: Address = Blockchain.tx.sender;

        this._spendAllowance(from, spender, amount);
        this._trackFlow(from, to, amount);
        this._transfer(from, to, amount);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── Admin: setPool (deployer only) ──

    @method(
        { name: 'pool', type: ABIDataTypes.ADDRESS },
        { name: 'approved', type: ABIDataTypes.BOOL },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setPool(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const pool: Address = calldata.readAddress();
        const approved: bool = calldata.readBoolean();
        this.approvedPools.set(pool, approved ? u256.One : u256.Zero);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── Admin: setMinter (deployer only) ──

    @method(
        { name: 'minter', type: ABIDataTypes.ADDRESS },
        { name: 'authorized', type: ABIDataTypes.BOOL },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setMinter(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const minter: Address = calldata.readAddress();
        const authorized: bool = calldata.readBoolean();
        this.authorizedMinters.set(minter, authorized ? u256.One : u256.Zero);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── View: pending sell-pressure rewards for a pool ──

    @view
    @method({ name: 'pool', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public pendingRewards(calldata: Calldata): BytesWriter {
        const pool: Address = calldata.readAddress();
        const pending: u256 = this._pendingRewards(pool);

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(pending);
        return writer;
    }

    // ── Minter: consume pending rewards (mints to caller) ──

    @method({ name: 'pool', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'amount', type: ABIDataTypes.UINT256 })
    public consumePendingRewards(calldata: Calldata): BytesWriter {
        this._requireMinter();

        const pool: Address = calldata.readAddress();
        const pending: u256 = this._pendingRewards(pool);

        if (pending > u256.Zero) {
            const currentConsumed: u256 = this.consumedRewards.get(pool);
            this.consumedRewards.set(pool, SafeMath.add(currentConsumed, pending));
            this._mint(Blockchain.tx.sender, pending);
        }

        const writer: BytesWriter = new BytesWriter(32);
        writer.writeU256(pending);
        return writer;
    }

    // ── Minter: mint tokens ──

    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public mint(calldata: Calldata): BytesWriter {
        this._requireMinter();

        const to: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        this._mint(to, amount);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── Minter: inject virtual sell-pressure (no actual transfer) ──

    @method(
        { name: 'pool', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public injectSellPressure(calldata: Calldata): BytesWriter {
        this._requireMinter();

        const pool: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        if (this.approvedPools.get(pool).isZero()) {
            throw new Revert('Pool not approved');
        }

        if (amount.isZero()) {
            throw new Revert('Zero amount');
        }

        const current: u256 = this.flowIn.get(pool);
        this.flowIn.set(pool, SafeMath.add(current, amount));
        this._updateHighWaterMark(pool);

        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ── View: isPool ──

    @view
    @method({ name: 'pool', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'approved', type: ABIDataTypes.BOOL })
    public isPool(calldata: Calldata): BytesWriter {
        const pool: Address = calldata.readAddress();
        const writer: BytesWriter = new BytesWriter(1);
        writer.writeBoolean(!this.approvedPools.get(pool).isZero());
        return writer;
    }

    // ── View: flow info for a pool ──

    @view
    @method({ name: 'pool', type: ABIDataTypes.ADDRESS })
    @returns(
        { name: 'inFlow', type: ABIDataTypes.UINT256 },
        { name: 'outFlow', type: ABIDataTypes.UINT256 },
        { name: 'hwm', type: ABIDataTypes.UINT256 },
        { name: 'consumed', type: ABIDataTypes.UINT256 },
    )
    public flowInfo(calldata: Calldata): BytesWriter {
        const pool: Address = calldata.readAddress();
        const writer: BytesWriter = new BytesWriter(128);
        writer.writeU256(this.flowIn.get(pool));
        writer.writeU256(this.flowOut.get(pool));
        writer.writeU256(this.highWaterMark.get(pool));
        writer.writeU256(this.consumedRewards.get(pool));
        return writer;
    }

    // ── Internal: track flow for sell-pressure ──

    protected _trackFlow(from: Address, to: Address, amount: u256): void {
        // Tokens INTO pool = sell (flowIn)
        if (!this.approvedPools.get(to).isZero()) {
            const current: u256 = this.flowIn.get(to);
            this.flowIn.set(to, SafeMath.add(current, amount));
            this._updateHighWaterMark(to);
        }

        // Tokens FROM pool = buy (flowOut)
        if (!this.approvedPools.get(from).isZero()) {
            const current: u256 = this.flowOut.get(from);
            this.flowOut.set(from, SafeMath.add(current, amount));
        }
    }

    protected _updateHighWaterMark(pool: Address): void {
        const inVal: u256 = this.flowIn.get(pool);
        const outVal: u256 = this.flowOut.get(pool);

        if (inVal > outVal) {
            const netPressure: u256 = SafeMath.sub(inVal, outVal);
            const currentHWM: u256 = this.highWaterMark.get(pool);
            if (netPressure > currentHWM) {
                this.highWaterMark.set(pool, netPressure);
            }
        }
    }

    protected _pendingRewards(pool: Address): u256 {
        const hwm: u256 = this.highWaterMark.get(pool);
        const consumed: u256 = this.consumedRewards.get(pool);
        if (hwm > consumed) {
            return SafeMath.sub(hwm, consumed);
        }
        return u256.Zero;
    }

    protected _requireMinter(): void {
        if (this.authorizedMinters.get(Blockchain.tx.sender).isZero()) {
            throw new Revert('Not authorized minter');
        }
    }
}
