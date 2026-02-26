import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain, Calldata, OP20InitParameters } from '@btc-vision/btc-runtime/runtime';
import { SellPressureToken } from '../lib/SellPressureToken';

const INITIAL_SUPPLY: u256 = u256.fromString('1000000000000000000000000000'); // 1B * 1e18
const DECIMALS: u8 = 18;
const NAME: string = 'TESTER';
const SYMBOL: string = 'TESTER';

@final
export class TesterToken extends SellPressureToken {
    public constructor() {
        super();
    }

    public override onDeployment(_calldata: Calldata): void {
        this.instantiate(new OP20InitParameters(u256.Max, DECIMALS, NAME, SYMBOL));
        this._mint(Blockchain.tx.origin, INITIAL_SUPPLY);
    }
}
