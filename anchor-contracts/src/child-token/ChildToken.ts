import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    Calldata,
    OP20InitParameters,
    SafeMath,
} from '@btc-vision/btc-runtime/runtime';
import { SellPressureToken } from '../lib/SellPressureToken';

const INITIAL_SUPPLY: u256 = u256.fromString('1000000000000000000000000000'); // 1B * 1e18
const DECIMALS: u8 = 18;
const CREATOR_BPS: u256 = u256.fromU32(500); // 5%
const BPS_DENOM: u256 = u256.fromU32(10000);

/**
 * ChildToken: Template token deployed per child.
 * Identical sell-pressure tracking to AnchorToken.
 * 5% to creator, 95% to deployer (paired with MOTO for LP).
 */
@final
export class ChildToken extends SellPressureToken {
    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const name: string = calldata.readStringWithLength();
        const symbol: string = calldata.readStringWithLength();
        const creator: Address = calldata.readAddress();

        this.instantiate(new OP20InitParameters(u256.Max, DECIMALS, name, symbol));

        const creatorAmount: u256 = SafeMath.div(
            SafeMath.mul(INITIAL_SUPPLY, CREATOR_BPS),
            BPS_DENOM,
        );
        const lpAmount: u256 = SafeMath.sub(INITIAL_SUPPLY, creatorAmount);

        this._mint(creator, creatorAmount);
        this._mint(Blockchain.tx.origin, lpAmount);
    }
}
