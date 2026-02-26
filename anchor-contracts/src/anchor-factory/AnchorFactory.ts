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
    StoredMapU256,
    AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';
import { StoredU256 } from '@btc-vision/btc-runtime/runtime/storage/StoredU256';
import { StoredAddress } from '@btc-vision/btc-runtime/runtime/storage/StoredAddress';
import { EMPTY_POINTER } from '@btc-vision/btc-runtime/runtime/math/bytes';
import { CallResult } from '@btc-vision/btc-runtime/runtime/env/BlockchainEnvironment';

/**
 * AnchorFactory: On-chain factory for deploying child token + staker pairs.
 *
 * Uses Blockchain.deployContractFromExisting() to clone pre-deployed
 * template contracts (ChildToken, ChildStaker) with unique salts.
 *
 * Two-call flow:
 *   1. deployChildToken(name, symbol) → deploys token, user gets 100% supply
 *   2. [user adds LP on MotoSwap from frontend]
 *   3. finalizeChild(childToken, lpPair) → deploys staker, configures, registers
 */
@final
export class AnchorFactory extends OP_NET {
    // ── Template addresses (set in onDeployment) ──
    private readonly childTokenTemplate: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly childStakerTemplate: StoredAddress = new StoredAddress(Blockchain.nextPointer);

    // ── ANCHOR protocol addresses ──
    private readonly anchorToken: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly anchorStaker: StoredAddress = new StoredAddress(Blockchain.nextPointer);
    private readonly anchorLpPool: StoredAddress = new StoredAddress(Blockchain.nextPointer);

    // ── Registry ──
    private readonly childCount: StoredU256 = new StoredU256(Blockchain.nextPointer, EMPTY_POINTER);
    private readonly childByIndex: StoredMapU256 = new StoredMapU256(Blockchain.nextPointer);
    private readonly stakerFor: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);
    private readonly creatorOf: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);
    private readonly registered: AddressMemoryMap = new AddressMemoryMap(Blockchain.nextPointer);

    // ── Pending deployments (token → creator, awaiting finalization) ──
    private readonly pendingCreator: AddressMemoryMap = new AddressMemoryMap(
        Blockchain.nextPointer,
    );

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const tokenTemplate: Address = calldata.readAddress();
        const stakerTemplate: Address = calldata.readAddress();

        this.childTokenTemplate.value = tokenTemplate;
        this.childStakerTemplate.value = stakerTemplate;
    }

    // ── Step 1: Deploy a child token from template ──

    @method(
        { name: 'name', type: ABIDataTypes.STRING },
        { name: 'symbol', type: ABIDataTypes.STRING },
    )
    @returns({ name: 'tokenAddress', type: ABIDataTypes.ADDRESS })
    public deployChildToken(calldata: Calldata): BytesWriter {
        const name: string = calldata.readStringWithLength();
        const symbol: string = calldata.readStringWithLength();

        if (name.length == 0) throw new Revert('Empty name');
        if (symbol.length == 0) throw new Revert('Empty symbol');

        // Generate unique salt from childCount
        const idx: u256 = this.childCount.value;
        const saltData: BytesWriter = new BytesWriter(32);
        saltData.writeU256(idx);
        const salt: u256 = u256.fromUint8ArrayBE(
            Blockchain.sha256(Uint8Array.wrap(saltData.getBuffer().buffer)),
        );

        // Build calldata for ChildToken.onDeployment(name, symbol, creator)
        const tokenCalldata: BytesWriter = new BytesWriter(128);
        tokenCalldata.writeStringWithLength(name);
        tokenCalldata.writeStringWithLength(symbol);
        tokenCalldata.writeAddress(Blockchain.tx.origin);

        // Deploy from template
        const tokenAddr: Address = Blockchain.deployContractFromExisting(
            this.childTokenTemplate.value,
            salt,
            tokenCalldata,
        );

        // Track pending deployment
        this.pendingCreator.set(tokenAddr, u256.fromUint8ArrayBE(Blockchain.tx.origin));

        // Increment count for next salt
        this.childCount.value = SafeMath.add(idx, u256.One);

        const w: BytesWriter = new BytesWriter(32);
        w.writeAddress(tokenAddr);
        return w;
    }

    // ── Step 2: Finalize child (after user adds LP) ──

    @method(
        { name: 'childToken', type: ABIDataTypes.ADDRESS },
        { name: 'lpPair', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'stakerAddress', type: ABIDataTypes.ADDRESS })
    public finalizeChild(calldata: Calldata): BytesWriter {
        const childToken: Address = calldata.readAddress();
        const lpPair: Address = calldata.readAddress();

        // Verify caller is the token's creator
        const creatorU256: u256 = this.pendingCreator.get(childToken);
        if (creatorU256.isZero()) throw new Revert('Token not pending');

        const creator: Address = Blockchain.tx.origin;
        if (u256.fromUint8ArrayBE(creator) !== creatorU256) {
            throw new Revert('Not creator');
        }

        // Already registered check
        if (!this.registered.get(childToken).isZero()) {
            throw new Revert('Already finalized');
        }

        // Generate staker salt from child token address
        const stakerSaltData: BytesWriter = new BytesWriter(64);
        stakerSaltData.writeAddress(childToken);
        stakerSaltData.writeAddress(lpPair);
        const stakerSalt: u256 = u256.fromUint8ArrayBE(
            Blockchain.sha256(Uint8Array.wrap(stakerSaltData.getBuffer().buffer)),
        );

        // Build calldata for ChildStaker.onDeployment:
        //   LpStaker base: rewardToken, lpToken, dev
        //   ChildStaker ext: creator, anchorToken, factory, anchorLpPool
        const stakerCalldata: BytesWriter = new BytesWriter(256);
        stakerCalldata.writeAddress(childToken);                    // rewardToken
        stakerCalldata.writeAddress(lpPair);                        // lpToken
        stakerCalldata.writeAddress(creator);                       // dev
        stakerCalldata.writeAddress(creator);                       // creator
        stakerCalldata.writeAddress(this.anchorToken.value);        // anchorToken
        stakerCalldata.writeAddress(Blockchain.contractAddress);    // factory = this contract
        stakerCalldata.writeAddress(this.anchorLpPool.value);       // anchorLpPool

        // Deploy staker from template
        const stakerAddr: Address = Blockchain.deployContractFromExisting(
            this.childStakerTemplate.value,
            stakerSalt,
            stakerCalldata,
        );

        // ── Configure child token (factory is deployer, so onlyDeployer passes) ──

        // setMinter(staker, true) — allow staker to mint reward tokens
        this._callSetMinter(childToken, stakerAddr, true);

        // setPool(lpPair, true) — enable sell-pressure tracking on LP
        this._callSetPool(childToken, lpPair, true);

        // ── Configure child staker ──

        // setSellPressurePool(lpPair) — for SP consumption
        this._callSetSellPressurePool(stakerAddr, lpPair);

        // ── Authorize staker as minter on ANCHOR token ──
        this._callAuthorizeChildStaker(stakerAddr);

        // ── Register in factory ──
        const idx: u256 = SafeMath.sub(this.childCount.value, u256.One);
        this.childByIndex.set(idx, u256.fromUint8ArrayBE(childToken));
        this.stakerFor.set(childToken, u256.fromUint8ArrayBE(stakerAddr));
        this.creatorOf.set(childToken, creatorU256);
        this.registered.set(childToken, u256.One);

        // Clear pending
        this.pendingCreator.set(childToken, u256.Zero);

        const w: BytesWriter = new BytesWriter(32);
        w.writeAddress(stakerAddr);
        return w;
    }

    // ── Admin: set ANCHOR protocol addresses ──

    @method(
        { name: 'token', type: ABIDataTypes.ADDRESS },
        { name: 'staker', type: ABIDataTypes.ADDRESS },
        { name: 'lpPool', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setAnchorAddresses(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        this.anchorToken.value = calldata.readAddress();
        this.anchorStaker.value = calldata.readAddress();
        this.anchorLpPool.value = calldata.readAddress();

        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── Admin: update template addresses ──

    @method(
        { name: 'tokenTemplate', type: ABIDataTypes.ADDRESS },
        { name: 'stakerTemplate', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public setTemplates(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        this.childTokenTemplate.value = calldata.readAddress();
        this.childStakerTemplate.value = calldata.readAddress();

        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    // ── View methods ──

    @view
    @method({ name: 'index', type: ABIDataTypes.UINT256 })
    @returns({ name: 'token', type: ABIDataTypes.ADDRESS })
    public getChildToken(calldata: Calldata): BytesWriter {
        const idx: u256 = calldata.readU256();
        const count: u256 = this.childCount.value;
        if (idx >= count) throw new Revert('Out of bounds');

        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(this.childByIndex.get(idx));
        return w;
    }

    @view
    @method({ name: 'childToken', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'staker', type: ABIDataTypes.ADDRESS })
    public getStakerFor(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(this.stakerFor.get(token));
        return w;
    }

    @view
    @method({ name: 'childToken', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'creator', type: ABIDataTypes.ADDRESS })
    public getCreator(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(this.creatorOf.get(token));
        return w;
    }

    @view
    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getChildTokenCount(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(32);
        w.writeU256(this.childCount.value);
        return w;
    }

    @view
    @method()
    @returns({ name: 'token', type: ABIDataTypes.ADDRESS })
    public getAnchorToken(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(32);
        w.writeAddress(this.anchorToken.value);
        return w;
    }

    @view
    @method()
    @returns({ name: 'staker', type: ABIDataTypes.ADDRESS })
    public getAnchorStaker(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(32);
        w.writeAddress(this.anchorStaker.value);
        return w;
    }

    @view
    @method({ name: 'token', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'registered', type: ABIDataTypes.BOOL })
    public isRegisteredToken(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(!this.registered.get(token).isZero());
        return w;
    }

    @view
    @method({ name: 'token', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'isPending', type: ABIDataTypes.BOOL })
    public isPendingToken(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(!this.pendingCreator.get(token).isZero());
        return w;
    }

    // ── Internal cross-contract calls ──

    private _callSetMinter(token: Address, minter: Address, enabled: boolean): void {
        const cd: BytesWriter = new BytesWriter(37); // 4 + 32 + 1
        cd.writeSelector(encodeSelector('setMinter(address,bool)'));
        cd.writeAddress(minter);
        cd.writeBoolean(enabled);

        const result: CallResult = Blockchain.call(token, cd, false);
        if (!result.success) throw new Revert('setMinter failed');
    }

    private _callSetPool(token: Address, pool: Address, approved: boolean): void {
        const cd: BytesWriter = new BytesWriter(37); // 4 + 32 + 1
        cd.writeSelector(encodeSelector('setPool(address,bool)'));
        cd.writeAddress(pool);
        cd.writeBoolean(approved);

        const result: CallResult = Blockchain.call(token, cd, false);
        if (!result.success) throw new Revert('setPool failed');
    }

    private _callSetSellPressurePool(staker: Address, pool: Address): void {
        const cd: BytesWriter = new BytesWriter(36); // 4 + 32
        cd.writeSelector(encodeSelector('setSellPressurePool(address)'));
        cd.writeAddress(pool);

        const result: CallResult = Blockchain.call(staker, cd, false);
        if (!result.success) throw new Revert('setSellPressurePool failed');
    }

    private _callAuthorizeChildStaker(staker: Address): void {
        const anchorTkn: Address = this.anchorToken.value;
        if (anchorTkn.length == 0) return; // No anchor token configured yet

        const cd: BytesWriter = new BytesWriter(36); // 4 + 32
        cd.writeSelector(encodeSelector('authorizeChildStaker(address)'));
        cd.writeAddress(staker);

        const result: CallResult = Blockchain.call(anchorTkn, cd, false);
        if (!result.success) throw new Revert('authorizeChildStaker failed');
    }
}
