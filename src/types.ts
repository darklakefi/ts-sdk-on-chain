import { AccountMeta, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Core types matching Rust structs
export interface Quote {
  inAmount: BN;
  outAmount: BN;
  feeAmount: BN;
  feeMint: PublicKey;
  feePct: BN;
}

export interface Order {
  trader: PublicKey;
  tokenMintX: PublicKey;
  tokenMintY: PublicKey;
  actualIn: BN;
  exchangeIn: BN;
  actualOut: BN;
  fromToLock: BN;
  dIn: BN;
  dOut: BN;
  deadline: BN;
  protocolFee: BN;
  wsolDeposit: BN;
  cMin: Uint8Array;
  isXToY: boolean;
  bump: number;
  padding: BN[];
}

export interface RawOrder {
  trader: PublicKey;
  token_mint_x: PublicKey;
  token_mint_y: PublicKey;
  actual_in: BN;
  exchange_in: BN;
  actual_out: BN;
  from_to_lock: BN;
  d_in: BN;
  d_out: BN;
  deadline: BN;
  protocol_fee: BN;
  wsol_deposit: BN;
  c_min: Uint8Array;
  is_x_to_y: boolean;
  bump: number;
  padding: BN[];
}

export interface Pool {
  creator: PublicKey;
  ammConfig: PublicKey;
  tokenMintX: PublicKey;
  tokenMintY: PublicKey;
  reserveX: PublicKey;
  reserveY: PublicKey;
  tokenLpSupply: BN;
  protocolFeeX: BN;
  protocolFeeY: BN;
  lockedX: BN;
  lockedY: BN;
  userLockedX: BN;
  userLockedY: BN;
  bump: number;
  padding: BN[];
}

export interface RawPool {
  creator: PublicKey;
  amm_config: PublicKey;
  token_mint_x: PublicKey;
  token_mint_y: PublicKey;
  reserve_x: PublicKey;
  reserve_y: PublicKey;
  token_lp_supply: BN;
  protocol_fee_x: BN;
  protocol_fee_y: BN;
  locked_x: BN;
  locked_y: BN;
  user_locked_x: BN;
  user_locked_y: BN;
  bump: number;
  padding: BN[];
}

export interface AmmConfig {
  tradeFeeRate: BN;
  createPoolFee: BN;
  protocolFeeRate: BN;
  wsolTradeDeposit: BN;
  deadlineSlotDuration: BN;
  ratioChangeToleranceRate: BN;
  bump: number;
  halted: boolean;
  padding: BN[];
}

export interface RawAmmConfig {
  trade_fee_rate: BN;
  create_pool_fee: BN;
  protocol_fee_rate: BN;
  ratio_change_tolerance_rate: BN;
  wsol_trade_deposit: BN;
  deadline_slot_duration: BN;
  bump: number;
  halted: boolean;
  padding: BN[];
}

export interface AccountData {
  data: Uint8Array;
  owner: PublicKey;
  space: number;
  executable: boolean;
  lamports: number;
}

// Swap mode enum
export enum SwapMode {
  ExactIn = 'ExactIn'
}

// Parameter interfaces for instruction functions
export interface SwapParamsIx {
  sourceMint: PublicKey;
  destinationMint: PublicKey;
  tokenTransferAuthority: PublicKey;
  inAmount: BN;
  swapMode: SwapMode;
  minOut: BN;
  salt: Uint8Array;
}

export interface FinalizeParamsIx {
  settleSigner: PublicKey;
  orderOwner: PublicKey;
  unwrapWsol: boolean;
  minOut: BN;
  salt: Uint8Array;
  output: BN;
  commitment: Uint8Array;
  deadline: BN;
  currentSlot: BN;
}

export interface AddLiquidityParamsIx {
  user: PublicKey;
  amountLp: BN;
  maxAmountX: BN;
  maxAmountY: BN;
}

export interface RemoveLiquidityParamsIx {
  user: PublicKey;
  amountLp: BN;
  minAmountX: BN;
  minAmountY: BN;
}

export interface InitializePoolParamsIx {
  user: PublicKey;
  tokenX: PublicKey;
  tokenXProgram: PublicKey;
  tokenY: PublicKey;
  tokenYProgram: PublicKey;
  amountX: BN;
  amountY: BN;
}

// Internal parameter interfaces
export interface SwapParams extends SwapParamsIx {
  label?: Uint8Array;
}

export interface FinalizeParams {
  settleSigner: PublicKey;
  orderOwner: PublicKey;
  unwrapWsol: boolean;
  minOut: BN;
  salt: Uint8Array;
  output: BN;
  commitment: Uint8Array;
  deadline: BN;
  currentSlot: BN;
  refCode?: Uint8Array;
  label?: Uint8Array;
}

export interface AddLiquidityParams {
  user: PublicKey;
  amountLp: BN;
  maxAmountX: BN;
  maxAmountY: BN;
  refCode?: Uint8Array;
  label?: Uint8Array;
}

export interface RemoveLiquidityParams {
  user: PublicKey;
  amountLp: BN;
  minAmountX: BN;
  minAmountY: BN;
  label?: Uint8Array;
}

export interface InitializePoolParams {
  user: PublicKey;
  tokenX: PublicKey;
  tokenXProgram: PublicKey;
  tokenY: PublicKey;
  tokenYProgram: PublicKey;
  amountX: BN;
  amountY: BN;
  label?: Uint8Array;
}

export interface SettleParams {
  settleSigner: PublicKey;
  orderOwner: PublicKey;
  unwrapWsol: boolean;
  minOut: BN;
  salt: Uint8Array;
  output: BN;
  commitment: Uint8Array;
  deadline: BN;
  currentSlot: BN;
  refCode?: Uint8Array;
  label?: Uint8Array;
}

export interface CancelParams {
  settleSigner: PublicKey;
  orderOwner: PublicKey;
  minOut: BN;
  salt: Uint8Array;
  output: BN;
  commitment: Uint8Array;
  deadline: BN;
  currentSlot: BN;
  label?: Uint8Array;
}

export interface SlashParams {
  settleSigner: PublicKey;
  orderOwner: PublicKey;
  deadline: BN;
  currentSlot: BN;
  label?: Uint8Array;
}

export interface QuoteParams {
  inputMint: PublicKey;
  amount: BN;
  swapMode: SwapMode;
  epoch: BN;
}

// Proof-related types
export interface ProofCircuitPaths {
  wasmPath: string;
  zkeyPath: string;
  r1csPath: string;
}

export interface GeneratedProof {
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
  publicSignals: Uint8Array[];
}

export interface PrivateProofInputs {
  minOut: BN;
  salt: BN;
}

export interface PublicProofInputs {
  realOut: BN;
  commitment: Uint8Array;
}

// Account metadata types
export interface SwapAndAccountMetas {
  discriminator: Uint8Array;
  swap: DarklakeAmmSwapParams;
  data: Uint8Array;
  accountMetas: Array<AccountMeta>;
}

export interface SettleAndAccountMetas {
  discriminator: Uint8Array;
  settle: DarklakeAmmSettleParams;
  data: Uint8Array;
  accountMetas: any[];
}

export interface CancelAndAccountMetas {
  discriminator: Uint8Array;
  cancel: DarklakeAmmCancelParams;
  data: Uint8Array;
  accountMetas: any[];
}

export interface SlashAndAccountMetas {
  discriminator: Uint8Array;
  slash: DarklakeAmmSlashParams;
  data: Uint8Array;
  accountMetas: any[];
}

export interface AddLiquidityAndAccountMetas {
  discriminator: Uint8Array;
  addLiquidity: DarklakeAmmAddLiquidityParams;
  data: Uint8Array;
  accountMetas: any[];
}

export interface RemoveLiquidityAndAccountMetas {
  discriminator: Uint8Array;
  removeLiquidity: DarklakeAmmRemoveLiquidityParams;
  data: Uint8Array;
  accountMetas: any[];
}

export interface InitializePoolAndAccountMetas {
  discriminator: Uint8Array;
  initializePool: DarklakeAmmInitializePoolParams;
  data: Uint8Array;
  accountMetas: any[];
}

// Darklake AMM specific parameter types
export interface DarklakeAmmSwapParams {
  amountIn: BN;
  isSwapXToY: boolean;
  cMin: Uint8Array;
  label?: Uint8Array;
}

export interface DarklakeAmmSettleParams {
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
  publicSignals: Uint8Array[];
  unwrapWsol: boolean;
  refCode?: Uint8Array;
  label?: Uint8Array;
}

export interface DarklakeAmmCancelParams {
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
  publicSignals: Uint8Array[];
  label?: Uint8Array;
}

export interface DarklakeAmmSlashParams {
  label?: Uint8Array;
}

export interface DarklakeAmmAddLiquidityParams {
  amountLp: BN;
  maxAmountX: BN;
  maxAmountY: BN;
  refCode?: Uint8Array;
  label?: Uint8Array;
}

export interface DarklakeAmmRemoveLiquidityParams {
  amountLp: BN;
  minAmountX: BN;
  minAmountY: BN;
  label?: Uint8Array;
}

export interface DarklakeAmmInitializePoolParams {
  amountX: BN;
  amountY: BN;
  label?: Uint8Array;
}

// Transfer fee config
export interface TransferFeeConfig {
  epoch: BN;
  maximumFee: BN;
  transferFeeBasisPoints: number;
}

export interface ProofResult {
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
  publicSignals: Uint8Array[];
} 