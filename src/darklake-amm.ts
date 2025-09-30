import { KeyedAccountInfo, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { BorshCoder } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { 
  Pool, 
  AmmConfig, 
  Order, 
  AccountData, 
  Quote,
  QuoteParams,
  SwapParams,
  SwapAndAccountMetas,
  SettleParams,
  SettleAndAccountMetas,
  CancelParams,
  CancelAndAccountMetas,
  SlashParams,
  AddLiquidityParams,
  AddLiquidityAndAccountMetas,
  RemoveLiquidityParams,
  RemoveLiquidityAndAccountMetas,
  InitializePoolParams,
  InitializePoolAndAccountMetas,
  GeneratedProof,
  SwapMode,
  RawPool,
  RawAmmConfig,
  RawOrder,
  SlashAndAccountMetas,
} from './types';
import { 
  DARKLAKE_PROGRAM_ID, 
  AMM_CONFIG, 
  AUTHORITY,
  POOL_SEED,
  ORDER_SEED,
  ORDER_WSOL_SEED,
  LIQUIDITY_SEED,
  POOL_RESERVE_SEED,
  POOL_WSOL_RESERVE_SEED,
  METADATA_SEED,
  METADATA_PROGRAM_ID,
  DEVNET_CREATE_POOL_FEE_VAULT,
  MAINNET_CREATE_POOL_FEE_VAULT
} from './constants';
import { TOKEN_2022_PROGRAM_ID, AccountLayout, getTransferFeeConfig, MintLayout, Mint, unpackMint, TransferFeeConfig, getTransferFeeAmount, getEpochFee, TransferFee, calculateEpochFee, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import idl from './darklake-idl.json';
import { Darklake } from './darklake-type';
import { checkedSub, quote, QuoteAmmConfig, QuoteOutput } from './math';
import { ErrorCode, DarklakeError, createErrorContext } from './errors';
import { generatePoseidonCommitment } from './zk/proof';
import { bnToUint8Array, uint8ArrayToBigInt } from './utils';
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system';
import { getDarklakeAmmAddLiquidityAccounts, getDarklakeAmmCancelAccounts, getDarklakeAmmInitializePoolAccounts, getDarklakeAmmRemoveLiquidityAccounts, getDarklakeAmmSettleAccounts, getDarklakeAmmSlashAccounts, getDarklakeAmmSwapAccounts } from './accounts';
import { to32ByteBuffer } from './zk/utils';

export class DarklakeAmm {
  public key: PublicKey;
  public pool: Pool;
  public ammConfig: AmmConfig;
  public reserveXBalance: BN;
  public reserveYBalance: BN;
  public tokenXOwner: PublicKey;
  public tokenYOwner: PublicKey;
  public tokenXTransferFeeConfig: TransferFeeConfig | null;
  public tokenYTransferFeeConfig: TransferFeeConfig | null;
  public borshCoder: BorshCoder;

  constructor() {
    this.key = PublicKey.default;
    this.pool = this.getDefaultPool();
    this.ammConfig = this.getDefaultAmmConfig();
    this.reserveXBalance = new BN(0);
    this.reserveYBalance = new BN(0);
    this.tokenXOwner = PublicKey.default;
    this.tokenYOwner = PublicKey.default;
    this.borshCoder = new BorshCoder(idl as Darklake);
    this.tokenXTransferFeeConfig = null;
    this.tokenYTransferFeeConfig = null;
  }

  private getDefaultPool(): Pool {
    return {
      creator: PublicKey.default,
      ammConfig: AMM_CONFIG,
      tokenMintX: PublicKey.default,
      tokenMintY: PublicKey.default,
      reserveX: PublicKey.default,
      reserveY: PublicKey.default,
      tokenLpSupply: new BN(0),
      protocolFeeX: new BN(0),
      protocolFeeY: new BN(0),
      lockedX: new BN(0),
      lockedY: new BN(0),
      userLockedX: new BN(0),
      userLockedY: new BN(0),
      bump: 0,
      padding: [new BN(0), new BN(0), new BN(0), new BN(0)]
    };
  }

  private getDefaultAmmConfig(): AmmConfig {
    return {
      tradeFeeRate: new BN(0),
      createPoolFee: new BN(0),
      protocolFeeRate: new BN(0),
      wsolTradeDeposit: new BN(0),
      deadlineSlotDuration: new BN(0),
      ratioChangeToleranceRate: new BN(0),
      bump: 0,
      halted: false,
      padding: new Array(16).fill(new BN(0))
    };
  }

  private mapDataToPool(rawPool: RawPool): Pool {
    return {  
      creator: rawPool.creator,
      ammConfig: rawPool.amm_config,
      tokenMintX: rawPool.token_mint_x,
      tokenMintY: rawPool.token_mint_y,
      reserveX: rawPool.reserve_x,
      reserveY: rawPool.reserve_y,
      tokenLpSupply: rawPool.token_lp_supply,
      protocolFeeX: rawPool.protocol_fee_x,
      protocolFeeY: rawPool.protocol_fee_y,
      lockedX: rawPool.locked_x,
      lockedY: rawPool.locked_y,
      userLockedX: rawPool.user_locked_x,
      userLockedY: rawPool.user_locked_y,
      bump: rawPool.bump,
      padding: rawPool.padding,
    };
  }

  private mapDataToAmmConfig(rawAmmConfig: RawAmmConfig): AmmConfig {
    return {
      tradeFeeRate: rawAmmConfig.trade_fee_rate,
      createPoolFee: rawAmmConfig.create_pool_fee,
      wsolTradeDeposit: rawAmmConfig.wsol_trade_deposit,
      deadlineSlotDuration: rawAmmConfig.deadline_slot_duration,
      bump: rawAmmConfig.bump,
      halted: rawAmmConfig.halted,
      padding: rawAmmConfig.padding,
      protocolFeeRate: rawAmmConfig.protocol_fee_rate,
      ratioChangeToleranceRate: rawAmmConfig.ratio_change_tolerance_rate,
    };
  }

  private mapDataToOrder(rawOrder: RawOrder): Order {
    return {
      trader: rawOrder.trader,
      tokenMintX: rawOrder.token_mint_x,
      tokenMintY: rawOrder.token_mint_y,
      actualIn: rawOrder.actual_in,
      exchangeIn: rawOrder.exchange_in,
      actualOut: rawOrder.actual_out,
      fromToLock: rawOrder.from_to_lock,
      dIn: rawOrder.d_in,
      dOut: rawOrder.d_out,
      deadline: rawOrder.deadline,
      protocolFee: rawOrder.protocol_fee,
      wsolDeposit: rawOrder.wsol_deposit,
      cMin: rawOrder.c_min,
      isXToY: rawOrder.is_x_to_y,
      bump: rawOrder.bump,
      padding: rawOrder.padding,
    };
  }

  private serializeOptionalArray(array: Uint8Array): Uint8Array {
    if (array.length === 0) {
      return new Uint8Array(0);
    }
    return new Uint8Array([1, ...array]);
  }

  /**
   * Load pool data from account
   */
  static loadPool(pool: KeyedAccountInfo): DarklakeAmm {
    const amm = new DarklakeAmm();
    amm.key = pool.accountId;

    amm.pool = amm.mapDataToPool(amm.borshCoder.accounts.decode('Pool', Buffer.from(pool.accountInfo.data)));
    
    return amm;
  }

  /**
   * Get program ID
   */
  programId(): PublicKey {
    return DARKLAKE_PROGRAM_ID;
  }

  /**
   * Get pool key
   */
  getKey(): PublicKey {
    return this.key;
  }

  /**
   * Get reserve mints
   */
  getReserveMints(): PublicKey[] {
    return [this.pool.tokenMintX, this.pool.tokenMintY];
  }

  /**
   * Get accounts that need to be updated
   */
  getAccountsToUpdate(): PublicKey[] {
    return [
      this.key,
      this.pool.tokenMintX,
      this.pool.tokenMintY,
      this.pool.reserveX,
      this.pool.reserveY,
      this.pool.ammConfig
    ];
  }

  /**
   * Update AMM state from account data
   */
  public update(accountMap: Map<PublicKey, AccountData>): void {
    const account = accountMap.get(this.key);
    if (!account) {
      throw DarklakeError.fromValidationError(
        'Darklake pool account not found',
        createErrorContext('update', { poolKey: this.key.toString() })
      );
    }

    // Parse pool data (simplified)
    // In practice, you'd deserialize the actual account data
    
    const ammConfigData = accountMap.get(this.pool.ammConfig);
    if (!ammConfigData) {
      throw DarklakeError.fromValidationError(
        'Amm config data not found',
        createErrorContext('update', { ammConfig: this.pool.ammConfig.toString() })
      );
    }

    this.ammConfig = this.mapDataToAmmConfig(this.borshCoder.accounts.decode('AmmConfig', Buffer.from(ammConfigData.data)));

    const reserveXData = accountMap.get(this.pool.reserveX);
    if (!reserveXData) {
      throw DarklakeError.fromValidationError(
        'Reserve X data not found',
        createErrorContext('update', { reserveX: this.pool.reserveX.toString() })
      );
    }

    const reserveYData = accountMap.get(this.pool.reserveY);
    if (!reserveYData) {
      throw DarklakeError.fromValidationError(
        'Reserve Y data not found',
        createErrorContext('update', { reserveY: this.pool.reserveY.toString() })
      );
    }
    
    this.reserveXBalance = this.parseTokenAccountBalance(reserveXData.data, reserveXData.owner);
    this.tokenXOwner = reserveXData.owner;
  
    this.reserveYBalance = this.parseTokenAccountBalance(reserveYData.data, reserveYData.owner);
    this.tokenYOwner = reserveYData.owner;

    const tokenXData = accountMap.get(this.pool.tokenMintX);
    if (!tokenXData) {
      throw DarklakeError.fromValidationError(
        'Token X data not found',
        createErrorContext('update', { tokenMintX: this.pool.tokenMintX.toString() })
      );
    }

    const tokenYData = accountMap.get(this.pool.tokenMintY);
    if (!tokenYData) {
      throw DarklakeError.fromValidationError(
        'Token Y data not found',
        createErrorContext('update', { tokenMintY: this.pool.tokenMintY.toString() })
      );
    }
    const tokenXProgram = tokenXData.owner;
    const tokenYProgram = tokenYData.owner;

    const dummyXTokenAccount = {
      executable: tokenXData.executable,
      data: Buffer.from(tokenXData.data),
      space: tokenXData.space,
      lamports: tokenXData.lamports,
      owner: tokenXProgram
    };

    const dummyYTokenAccount = {
      data: Buffer.from(tokenYData.data),
      space: tokenYData.space,
      executable: tokenYData.executable,
      lamports: tokenYData.lamports,
      owner: tokenYProgram,
    };

    const parsedMintX = unpackMint(this.pool.tokenMintX, dummyXTokenAccount, reserveXData.owner);
    const parsedMintY = unpackMint(this.pool.tokenMintY, dummyYTokenAccount, reserveYData.owner);

    this.tokenXTransferFeeConfig = getTransferFeeConfig(parsedMintX);
    this.tokenYTransferFeeConfig = getTransferFeeConfig(parsedMintY);

    this.tokenXOwner = reserveXData.owner;
    this.tokenYOwner = reserveYData.owner;
  }

  /**
   * Check if exact out swaps are supported
   */
  supportsExactOut(): boolean {
    return false;
  }

  /**
   * Get quote for swap
   */
  quote(quoteParams: QuoteParams): Quote {
    if (quoteParams.swapMode !== SwapMode.ExactIn) {
      throw DarklakeError.fromUnsupportedOperation(
        'Exact out swap mode',
        createErrorContext('quote', { swapMode: quoteParams.swapMode })
      );
    }

    const isSwapXToY = quoteParams.inputMint.equals(this.pool.tokenMintX);
    
    const ammConfig: QuoteAmmConfig = {
      tradeFeeRate: this.ammConfig.tradeFeeRate,
      protocolFeeRate: this.ammConfig.protocolFeeRate,
      ratioChangeToleranceRate: this.ammConfig.ratioChangeToleranceRate
    };

    let inputTransferFee = 0n;
    if (isSwapXToY) { 
      if (this.tokenXTransferFeeConfig) {
        inputTransferFee = calculateEpochFee(this.tokenXTransferFeeConfig, BigInt(quoteParams.epoch.toString()), BigInt(quoteParams.amount.toString()));
      }
    } else {
      if (this.tokenYTransferFeeConfig) {
        inputTransferFee = calculateEpochFee(this.tokenYTransferFeeConfig, BigInt(quoteParams.epoch.toString()), BigInt(quoteParams.amount.toString()));
      }
    }

    const inputAmount = new BN(quoteParams.amount);

    const exchangeIn = checkedSub(inputAmount, new BN(inputTransferFee));

    const result = quote(
      new BN(exchangeIn),
      isSwapXToY,
      ammConfig,
      this.pool.protocolFeeX,
      this.pool.protocolFeeY,
      this.pool.userLockedX,
      this.pool.userLockedY,
      this.pool.lockedX,
      this.pool.lockedY,
      this.reserveXBalance,
      this.reserveYBalance,
    );

    if (Object.values(ErrorCode).includes(result as ErrorCode)) {
      throw DarklakeError.fromMathError(
        result as ErrorCode,
        createErrorContext('quote', {
          inputMint: quoteParams.inputMint.toString(),
          amount: quoteParams.amount.toString(),
          swapMode: quoteParams.swapMode
        })
      );
    }

    const quoteOutput = result as QuoteOutput;

    let outputTransferFee = 0n;
    if (isSwapXToY) { 
      if (this.tokenXTransferFeeConfig) {
        outputTransferFee = calculateEpochFee(this.tokenXTransferFeeConfig, BigInt(quoteParams.epoch.toString()), BigInt(quoteParams.amount.toString()));
      }
    } else {
      if (this.tokenYTransferFeeConfig) {
        outputTransferFee = calculateEpochFee(this.tokenYTransferFeeConfig, BigInt(quoteParams.epoch.toString()), BigInt(quoteParams.amount.toString()));
      }
    }

    const outputAmount = checkedSub(quoteOutput.toAmount, new BN(outputTransferFee));

    if (outputAmount.lt(new BN(0))) {
      throw DarklakeError.fromValidationError(
        'Output amount is negative',
        createErrorContext('quote', { outputAmount: outputAmount.toString() })
      );
    } 

    // Simplified quote calculation
    // In practice, you'd implement the full DEX math
    return {
      inAmount: quoteOutput.fromAmount,
      outAmount: outputAmount,
      feeAmount: quoteOutput.tradeFee,
      feeMint: isSwapXToY ? this.pool.tokenMintX : this.pool.tokenMintY,
      feePct: this.ammConfig.tradeFeeRate
    };
  }

  /**
   * Get swap instruction and account metadata
   */
  async getSwapAndAccountMetas(swapParams: SwapParams): Promise<SwapAndAccountMetas> {

    const { tokenTransferAuthority, salt, minOut, label, inAmount } = swapParams;
    
    const isSwapXToY = swapParams.sourceMint.equals(this.pool.tokenMintX);
    
    const userTokenAccountWsol = DarklakeAmm.getUserTokenAccount(tokenTransferAuthority, NATIVE_MINT, TOKEN_PROGRAM_ID);

    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(tokenTransferAuthority, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(tokenTransferAuthority, this.pool.tokenMintY, this.tokenYOwner);

    const poolWsolReserve = DarklakeAmm.getPoolWsolReserve(this.key);
    const order = this.getOrder(tokenTransferAuthority);

    
    const saltBn = uint8ArrayToBigInt(salt);
    const commitment = await generatePoseidonCommitment(BigInt(minOut.toString()), saltBn);

    const discriminator = new Uint8Array([248, 198, 158, 145, 225, 117, 135, 200]);

    let serializedLabel = this.serializeOptionalArray(label || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...bnToUint8Array(new BN(inAmount), 8),
      isSwapXToY ? 1 : 0,
      ...to32ByteBuffer(commitment),
      ...serializedLabel
    ]);

    return {
      discriminator,
      swap: {
        amountIn: swapParams.inAmount,
        isSwapXToY,
        cMin: to32ByteBuffer(commitment),
        label: swapParams.label
      },
      data,
      accountMetas: getDarklakeAmmSwapAccounts({
        user: tokenTransferAuthority,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintWsol: NATIVE_MINT,
        pool: this.key,
        authority: AUTHORITY,
        ammConfig: this.pool.ammConfig,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountWsol: userTokenAccountWsol,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        poolWsolReserve: poolWsolReserve,
        order,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
    };
  }

  /**
   * Get settle instruction and account metadata
   */
  getSettleAndAccountMetas(settleParams: SettleParams, proofParams: GeneratedProof): SettleAndAccountMetas {
    const currentSlot = new BN(settleParams.currentSlot);
    const deadline = new BN(settleParams.deadline);
    const minOut = new BN(settleParams.minOut);
    const output = new BN(settleParams.output);

    if (currentSlot.gt(deadline)) {
      throw DarklakeError.fromValidationError(
        'Order has expired',
        createErrorContext('canSettle', { currentSlot: currentSlot.toString(), deadline: deadline.toString() })
      );
    }

    if (minOut.gt(output)) {
      throw DarklakeError.fromValidationError(
        "Can't settle this order, min_out > output",
        createErrorContext('canSettle', { minOut: minOut.toString(), output: output.toString() })
      );
    }

    const userTokenAccountWsol = DarklakeAmm.getUserTokenAccount(settleParams.orderOwner, NATIVE_MINT, TOKEN_PROGRAM_ID);

    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(settleParams.orderOwner, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(settleParams.orderOwner, this.pool.tokenMintY, this.tokenYOwner);

    const poolWsolReserve = DarklakeAmm.getPoolWsolReserve(this.key);
    const order = this.getOrder(settleParams.orderOwner);
    const orderTokenAccountWsol = this.getOrderTokenAccountWsol(settleParams.orderOwner);

    const callerTokenAccountWsol = DarklakeAmm.getUserTokenAccount(settleParams.settleSigner, NATIVE_MINT, TOKEN_PROGRAM_ID);


    const discriminator = new Uint8Array([175, 42, 185, 87, 144, 131, 102, 212]);
    
    const serializedRefCode = this.serializeOptionalArray(settleParams.refCode || new Uint8Array(0));
    const serializedLabel = this.serializeOptionalArray(settleParams.label || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...proofParams.proofA,
      ...proofParams.proofB,
      ...proofParams.proofC,
      ...proofParams.publicSignals[0],
      ...proofParams.publicSignals[1],
      settleParams.unwrapWsol ? 1 : 0,
      ...serializedRefCode,
      ...serializedLabel
    ]);

    return {
      discriminator,
      settle: {
        proofA: proofParams.proofA,
        proofB: proofParams.proofB,
        proofC: proofParams.proofC,
        publicSignals: proofParams.publicSignals,
        unwrapWsol: settleParams.unwrapWsol,
        refCode: settleParams.refCode,
        label: settleParams.label
      },
      data,
      accountMetas: getDarklakeAmmSettleAccounts({
        caller: settleParams.settleSigner,
        orderOwner: settleParams.orderOwner,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintWsol: NATIVE_MINT,
        pool: this.key,
        authority: AUTHORITY,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        poolWsolReserve: poolWsolReserve,
        callerTokenAccountWsol: callerTokenAccountWsol,
        orderTokenAccountWsol: orderTokenAccountWsol,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
        ammConfig: this.pool.ammConfig,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountWsol: userTokenAccountWsol,
        order: order,
      })
    };
  }

  /**
   * Get cancel instruction and account metadata
   */
  getCancelAndAccountMetas(cancelParams: CancelParams, proofParams: GeneratedProof): CancelAndAccountMetas {
    const currentSlot = new BN(cancelParams.currentSlot);
    const deadline = new BN(cancelParams.deadline);
    const minOut = new BN(cancelParams.minOut);
    const output = new BN(cancelParams.output);

    if (currentSlot.gt(deadline)) {
      throw DarklakeError.fromValidationError(
        'Order has expired',
        createErrorContext('canCancel', { currentSlot: currentSlot.toString(), deadline: deadline.toString() })
      );
    }

    if (minOut.lte(output)) {
      throw DarklakeError.fromValidationError(
        "Can't cancel this order, min_out <= output",
        createErrorContext('canCancel', { minOut: minOut.toString(), output: output.toString() })
      );
    }

    const userTokenAccountWsol = DarklakeAmm.getUserTokenAccount(cancelParams.orderOwner, NATIVE_MINT, TOKEN_PROGRAM_ID);

    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(cancelParams.orderOwner, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(cancelParams.orderOwner, this.pool.tokenMintY, this.tokenYOwner);

    const poolWsolReserve = DarklakeAmm.getPoolWsolReserve(this.key);
    const order = this.getOrder(cancelParams.orderOwner);

    const callerTokenAccountWsol = DarklakeAmm.getUserTokenAccount(cancelParams.settleSigner, NATIVE_MINT, TOKEN_PROGRAM_ID);


    const discriminator = new Uint8Array([232, 219, 223, 41, 219, 236, 220, 190]);
    
    const serializedLabel = this.serializeOptionalArray(cancelParams.label || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...proofParams.proofA,
      ...proofParams.proofB,
      ...proofParams.proofC,
      ...proofParams.publicSignals[0],
      ...proofParams.publicSignals[1],
      ...serializedLabel
    ]);


    return {
      discriminator,
      cancel: {
        proofA: proofParams.proofA,
        proofB: proofParams.proofB,
        proofC: proofParams.proofC,
        publicSignals: proofParams.publicSignals,
        label: cancelParams.label
      },
      data,
      accountMetas: getDarklakeAmmCancelAccounts({
        caller: cancelParams.settleSigner,
        orderOwner: cancelParams.orderOwner,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintWsol: NATIVE_MINT,
        pool: this.key,
        authority: AUTHORITY,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        poolWsolReserve: poolWsolReserve,
        callerTokenAccountWsol: callerTokenAccountWsol,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
        ammConfig: this.pool.ammConfig,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountWsol: userTokenAccountWsol,
        order: order,
      })
    };
  }
   /**
   * Get slash instruction and account metadata
   */
   getSlashAndAccountMetas(slashParams: SlashParams): SlashAndAccountMetas {

    const currentSlot = new BN(slashParams.currentSlot);
    const deadline = new BN(slashParams.deadline);

    if (currentSlot.lte(deadline)) {
      throw DarklakeError.fromValidationError(
        'Order has not expired',
        createErrorContext('canSlash', { currentSlot: currentSlot.toString(), deadline: deadline.toString() })
      );
    }
    const poolWsolReserve = DarklakeAmm.getPoolWsolReserve(this.key);

    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(slashParams.orderOwner, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(slashParams.orderOwner, this.pool.tokenMintY, this.tokenYOwner);

    const callerTokenAccountWsol = DarklakeAmm.getUserTokenAccount(slashParams.settleSigner, NATIVE_MINT, TOKEN_PROGRAM_ID);
    
    const order = this.getOrder(slashParams.orderOwner);

    const discriminator = new Uint8Array([204, 141, 18, 161, 8, 177, 92, 142]);
    
    const serializedLabel = this.serializeOptionalArray(slashParams.label || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...serializedLabel
    ]);

    return {
      discriminator,
      slash: {
        label: slashParams.label
      },
      data,
      accountMetas: getDarklakeAmmSlashAccounts({
        caller: slashParams.settleSigner,
        orderOwner: slashParams.orderOwner,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintWsol: NATIVE_MINT,
        pool: this.key,
        authority: AUTHORITY,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        poolWsolReserve: poolWsolReserve,
        callerTokenAccountWsol: callerTokenAccountWsol,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
        ammConfig: this.pool.ammConfig,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        order: order,
      })
    };
  }


  /**
   * Get add liquidity instruction and account metadata
   */
  getAddLiquidityAndAccountMetas(addLiquidityParams: AddLiquidityParams): AddLiquidityAndAccountMetas {

    const tokenMintLp = DarklakeAmm.getTokenMintLp(this.key);
    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(addLiquidityParams.user, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(addLiquidityParams.user, this.pool.tokenMintY, this.tokenYOwner);
    const userTokenAccountLp = DarklakeAmm.getUserTokenAccount(addLiquidityParams.user, tokenMintLp, TOKEN_PROGRAM_ID);

    const discriminator = new Uint8Array([181, 157, 89, 67, 143, 182, 52, 72]);
    
    const serializedLabel = this.serializeOptionalArray(addLiquidityParams.label || new Uint8Array(0));
    const serializedRefCode = this.serializeOptionalArray(addLiquidityParams.refCode || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...bnToUint8Array(new BN(addLiquidityParams.amountLp), 8),
      ...bnToUint8Array(new BN(addLiquidityParams.maxAmountX), 8),
      ...bnToUint8Array(new BN(addLiquidityParams.maxAmountY), 8),
      ...serializedRefCode,
      ...serializedLabel
    ]);

    return {
      discriminator,
      addLiquidity: {
        amountLp: new BN(addLiquidityParams.amountLp),
        maxAmountX: new BN(addLiquidityParams.maxAmountX),
        maxAmountY: new BN(addLiquidityParams.maxAmountY),
        label: addLiquidityParams.label,
        refCode: addLiquidityParams.refCode,
      },
      data,
      accountMetas: getDarklakeAmmAddLiquidityAccounts({
        user: addLiquidityParams.user,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintLp,
        pool: this.key,
        ammConfig: this.pool.ammConfig,
        authority: AUTHORITY,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountLp: userTokenAccountLp,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
    };
  }


  /**
   * Get remove liquidity instruction and account metadata
   */
  getRemoveLiquidityAndAccountMetas(removeLiquidityParams: RemoveLiquidityParams): RemoveLiquidityAndAccountMetas {

    const tokenMintLp = DarklakeAmm.getTokenMintLp(this.key);
    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(removeLiquidityParams.user, this.pool.tokenMintX, this.tokenXOwner);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(removeLiquidityParams.user, this.pool.tokenMintY, this.tokenYOwner);
    const userTokenAccountLp = DarklakeAmm.getUserTokenAccount(removeLiquidityParams.user, tokenMintLp, TOKEN_PROGRAM_ID);

    const discriminator = new Uint8Array([80, 85, 209, 72, 24, 206, 177, 108]);
    
    const serializedLabel = this.serializeOptionalArray(removeLiquidityParams.label || new Uint8Array(0));

    const data = new Uint8Array([
      ...discriminator,
      ...bnToUint8Array(new BN(removeLiquidityParams.amountLp), 8),
      ...bnToUint8Array(new BN(removeLiquidityParams.minAmountX), 8),
      ...bnToUint8Array(new BN(removeLiquidityParams.minAmountY), 8),
      ...serializedLabel
    ]);

    return {
      discriminator,
      removeLiquidity: {
        amountLp: new BN(removeLiquidityParams.amountLp),
        minAmountX: new BN(removeLiquidityParams.minAmountX),
        minAmountY: new BN(removeLiquidityParams.minAmountY),
        label: removeLiquidityParams.label,
      },
      data,
      accountMetas: getDarklakeAmmRemoveLiquidityAccounts({
        user: removeLiquidityParams.user,
        tokenMintX: this.pool.tokenMintX,
        tokenMintY: this.pool.tokenMintY,
        tokenMintLp,
        pool: this.key,
        ammConfig: this.pool.ammConfig,
        authority: AUTHORITY,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountLp: userTokenAccountLp,
        poolTokenReserveX: this.pool.reserveX,
        poolTokenReserveY: this.pool.reserveY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: this.tokenXOwner,
        tokenMintYProgram: this.tokenYOwner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
    };
  }

  /**
   * Get initialize pool instruction and account metadata
   */
  getInitializePoolAndAccountMetas(initializePoolParams: InitializePoolParams, isDevnet: boolean): InitializePoolAndAccountMetas {
    const discriminator = new Uint8Array([95, 180, 10, 172, 84, 174, 232, 40]);
    
    const poolKey = DarklakeAmm.getPoolAddress(initializePoolParams.tokenX, initializePoolParams.tokenY);

    const serializedLabel = this.serializeOptionalArray(initializePoolParams.label || new Uint8Array(0));

    const tokenMintLp = DarklakeAmm.getTokenMintLp(poolKey);
    const userTokenAccountX = DarklakeAmm.getUserTokenAccount(initializePoolParams.user, initializePoolParams.tokenX, initializePoolParams.tokenXProgram);
    const userTokenAccountY = DarklakeAmm.getUserTokenAccount(initializePoolParams.user, initializePoolParams.tokenY, initializePoolParams.tokenYProgram);
    const userTokenAccountLp = DarklakeAmm.getUserTokenAccount(initializePoolParams.user, tokenMintLp, TOKEN_PROGRAM_ID);

    const metadataAccount = DarklakeAmm.getTokenMetadata(tokenMintLp);
    const metadataAccountX = DarklakeAmm.getTokenMetadata(initializePoolParams.tokenX);
    const metadataAccountY = DarklakeAmm.getTokenMetadata(initializePoolParams.tokenY);

    const createPoolFeeVault = isDevnet ? DEVNET_CREATE_POOL_FEE_VAULT : MAINNET_CREATE_POOL_FEE_VAULT;

    const poolWsolReserve = DarklakeAmm.getPoolWsolReserve(poolKey);
    const poolTokenReserveX = DarklakeAmm.getPoolReserve(poolKey, initializePoolParams.tokenX);
    const poolTokenReserveY = DarklakeAmm.getPoolReserve(poolKey, initializePoolParams.tokenY);

    const data = new Uint8Array([
      ...discriminator,
      ...bnToUint8Array(new BN(initializePoolParams.amountX), 8),
      ...bnToUint8Array(new BN(initializePoolParams.amountY), 8),
      ...serializedLabel
    ]);

    return {
      discriminator,
      initializePool: {
        amountX: new BN(initializePoolParams.amountX),
        amountY: new BN(initializePoolParams.amountY),
        label: initializePoolParams.label
      },
      data,
      accountMetas: getDarklakeAmmInitializePoolAccounts({
        user: initializePoolParams.user,
        pool: poolKey,
        authority: AUTHORITY,
        ammConfig: AMM_CONFIG,
        tokenMintX: initializePoolParams.tokenX,
        tokenMintY: initializePoolParams.tokenY,
        tokenMintWsol: NATIVE_MINT,
        tokenMintLp: tokenMintLp,
        metadataAccount: metadataAccount,
        metadataAccountX: metadataAccountX,
        metadataAccountY: metadataAccountY,
        userTokenAccountX: userTokenAccountX,
        userTokenAccountY: userTokenAccountY,
        userTokenAccountLp: userTokenAccountLp,
        poolTokenReserveX: poolTokenReserveX,
        poolTokenReserveY: poolTokenReserveY,
        poolWsolReserve: poolWsolReserve,
        createPoolFeeVault: createPoolFeeVault,
        mplProgram: METADATA_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenMintXProgram: initializePoolParams.tokenXProgram,
        tokenMintYProgram: initializePoolParams.tokenYProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      }) // Simplified
    };
  }

  /**
   * Get order pubkey for user
   */
  getOrderPubkey(user: PublicKey): PublicKey {
    if (this.key.equals(PublicKey.default)) {
      throw DarklakeError.fromValidationError(
        'Darklake pool is not initialized',
        createErrorContext('getOrderPubkey', { poolKey: this.key.toString() })
      );
    }
    return this.getOrder(user);
  }

  getOrderTokenAccountWsol(user: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(ORDER_WSOL_SEED), this.key.toBuffer(), user.toBuffer()],
      this.programId()
    )[0];
  }

  /**
   * Parse order data
   */
  parseOrderData(orderData: Uint8Array): Order {
    const rawOrder = this.borshCoder.accounts.decode('Order', Buffer.from(orderData));
    return this.mapDataToOrder(rawOrder);
  }

  /**
   * Check if order is expired
   */
  isOrderExpired(orderData: Uint8Array, currentSlot: BN): boolean {
    const order = this.parseOrderData(orderData);
    return order.deadline.lt(currentSlot);
  }

  /**
   * Get token owners
   */
  getTokenOwners(): [PublicKey, PublicKey] {
    return [this.tokenXOwner, this.tokenYOwner];
  }

  // Helper methods
  private getOrder(user: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(ORDER_SEED), this.key.toBuffer(), user.toBuffer()],
      this.programId()
    )[0];
  }

  private parseTokenAccountBalance(accountData: Uint8Array, accountOwner: PublicKey): BN {
    if (accountOwner.equals(TOKEN_PROGRAM_ID)) {
      // Deserialize legacy SPL token account
      try {
        const tokenAccount = AccountLayout.decode(accountData);
        return new BN(tokenAccount.amount.toString());
      } catch (error) {
        throw DarklakeError.fromValidationError(
          `Failed to deserialize legacy SPL token account: ${error}`,
          createErrorContext('getTokenBalance', { account: accountData.toString(), program: 'legacy' }),
          error as Error
        );
      }
    }

    if (accountOwner.equals(TOKEN_2022_PROGRAM_ID)) {
      // For Token-2022, we need to handle the extended account layout
      // This is a simplified implementation - in practice you'd need to handle
      // the extended metadata and transfer fee configurations
      try {
        // Token-2022 accounts have the same base layout as legacy SPL tokens
        // but with additional metadata at the end
        const baseAccountData = accountData.slice(0, AccountLayout.span);
        const tokenAccount = AccountLayout.decode(baseAccountData);
        return new BN(tokenAccount.amount.toString());
      } catch (error) {
        throw DarklakeError.fromValidationError(
          `Failed to deserialize Token-2022 account: ${error}`,
          createErrorContext('getTokenBalance', { account: accountData.toString(), program: 'token-2022' }),
          error as Error
        );
      }
    }

    throw DarklakeError.fromValidationError(
      'Invalid token program',
      createErrorContext('getTokenBalance', { account: accountData.toString(), owner: accountOwner.toString() })
    );
  }

  // Static helper methods
  static getPoolAddress(tokenMintX: PublicKey, tokenMintY: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(POOL_SEED),
        AMM_CONFIG.toBuffer(),
        tokenMintX.toBuffer(),
        tokenMintY.toBuffer()
      ],
      DARKLAKE_PROGRAM_ID
    )[0];
  }

  static getUserTokenAccount(user: PublicKey, tokenMint: PublicKey, tokenProgram: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [user.toBuffer(), tokenProgram.toBuffer(), tokenMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
  }

  static getPoolWsolReserve(pool: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_WSOL_RESERVE_SEED), pool.toBuffer()],
      DARKLAKE_PROGRAM_ID
    )[0];
  }

  static getTokenMintLp(pool: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LIQUIDITY_SEED), pool.toBuffer()],
      DARKLAKE_PROGRAM_ID
    )[0];
  }

  static getTokenMetadata(tokenMint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        METADATA_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer()
      ],
      METADATA_PROGRAM_ID
    )[0];
  }

  static getPoolReserve(pool: PublicKey, tokenMint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_RESERVE_SEED), pool.toBuffer(), tokenMint.toBuffer()],
      DARKLAKE_PROGRAM_ID
    )[0];
  }
}
