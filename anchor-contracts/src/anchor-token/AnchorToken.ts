import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP20InitParameters,
    Revert,
} from '@btc-vision/btc-runtime/runtime';
import { StoredAddress } from '@btc-vision/btc-runtime/runtime/storage/StoredAddress';
import { SellPressureToken } from '../lib/SellPressureToken';

const INITIAL_SUPPLY: u256 = u256.fromString('1000000000000000000000000000'); // 1B * 1e18
const DECIMALS: u8 = 18;
const NAME: string = 'ANCHOR';
const SYMBOL: string = 'ANCHOR';

/**
 * AnchorToken: The core ANCHOR protocol token.
 * Extends SellPressureToken with factory authorization so the
 * AnchorFactory can authorize new child stakers as minters.
 */
@final
export class AnchorToken extends SellPressureToken {
    private readonly factoryAddr: StoredAddress = new StoredAddress(Blockchain.nextPointer);

    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const factory: Address = calldata.readAddress();
        this.factoryAddr.value = factory;

        this.instantiate(new OP20InitParameters(u256.Max, DECIMALS, NAME, SYMBOL));
        this._mint(Blockchain.tx.origin, INITIAL_SUPPLY);
    }

    /**
     * Factory can authorize child stakers as minters on ANCHOR token.
     * Called by AnchorFactory.finalizeChild() during child token launch.
     */
    @method({ name: 'staker', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public authorizeChildStaker(calldata: Calldata): BytesWriter {
        const sender: Address = Blockchain.tx.sender;
        if (this.factoryAddr.value !== sender) {
            throw new Revert('Only factory');
        }

        const staker: Address = calldata.readAddress();
        this.authorizedMinters.set(staker, u256.One);

        const w: BytesWriter = new BytesWriter(1);
        w.writeBoolean(true);
        return w;
    }

    @view
    @method()
    @returns({ name: 'factory', type: ABIDataTypes.ADDRESS })
    public getFactory(_calldata: Calldata): BytesWriter {
        const w: BytesWriter = new BytesWriter(32);
        w.writeAddress(this.factoryAddr.value);
        return w;
    }
}
