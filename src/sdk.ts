import {
  AccountInfo,
  Commitment,
  Connection,
  KeyedAccountInfo,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { DarklakeAmm } from './darklake-amm';
import {
  convertStringToBytesArray,
  generateRandomSalt,
  getAddressLookupTable,
  getCloseWsolInstructions,
  getWrapSolToWsolInstructions,
  uint8ArrayToBigInt,
} from './utils';
import {
  AccountData,
  AddLiquidityParams,
  AddLiquidityParamsIx,
  CancelParams,
  FinalizeParamsIx,
  GeneratedProof,
  InitializePoolParams,
  InitializePoolParamsIx,
  Order,
  Quote,
  RemoveLiquidityParams,
  RemoveLiquidityParamsIx,
  SettleParams,
  SlashParams,
  SwapMode,
  SwapParams,
  SwapParamsIx,
} from './types';
import { SOL_MINT } from './constants';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from '@solana/spl-token';
import { Darklake } from './darklake-type';
import { AnchorProvider, Program, Wallet, web3 } from '@coral-xyz/anchor';
import idl from './darklake-idl.json';
import BN from 'bn.js';
import { generateProof } from './zk/proof';
import { toBigInt } from './zk/utils';
import { DarklakeError, createErrorContext } from './errors';

export class DarklakeSDK {
  private connection: Connection;
  private commitment: Commitment;
  public isDevnet: boolean;
  public label: Uint8Array;
  public refCode: Uint8Array | null;
  private darklakeAmm: DarklakeAmm;
  public program: Program<Darklake>;

  constructor(
    rpcEndpoint: string,
    commitmentLevel: Commitment,
    isDevnet: boolean,
    label: string | null,
    refCode: string | null,
  ) {
    this.connection = new Connection(rpcEndpoint, commitmentLevel);
    this.commitment = commitmentLevel;
    this.isDevnet = isDevnet;

    // label
    const sdkLabelPrefix = 'jcv0.2.0';

    // sanity check for in-case we exceed prefix length
    if (sdkLabelPrefix.length > 10) {
      throw DarklakeError.fromValidationError(
        'SDK label prefix is too long, must be equal or less than 10 bytes',
        createErrorContext('constructor', {
          sdkLabelPrefix,
          length: sdkLabelPrefix.length,
        }),
      );
    }

    let fullLabel: Uint8Array;
    if (label !== null) {
      if (label.length > 10) {
        throw DarklakeError.fromValidationError(
          'Label is too long, must be equal or less than 10 characters',
          createErrorContext('constructor', { label, length: label.length }),
        );
      }

      const joinedLabel = [sdkLabelPrefix, label].join(',');
      fullLabel = convertStringToBytesArray(joinedLabel, 21);
    } else {
      fullLabel = convertStringToBytesArray(sdkLabelPrefix, 21);
    }

    // ref code
    let refCodeBytes: Uint8Array | null = null;
    if (refCode !== null) {
      refCodeBytes = convertStringToBytesArray(refCode, 20);
    }

    this.darklakeAmm = new DarklakeAmm();
    this.label = fullLabel;
    this.refCode = refCodeBytes;
    const provider = new AnchorProvider(
      this.connection,
      new Wallet(new Keypair()),
      { commitment: this.commitment },
    );
    this.program = new Program(idl as Darklake, provider);
  }

  public async quote(
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amountIn: BN,
  ): Promise<Quote> {
    try {
      const isFromSol = tokenIn.equals(SOL_MINT);
      const isToSol = tokenOut.equals(SOL_MINT);

      const tokenIn_ = isFromSol ? NATIVE_MINT : tokenIn;
      const tokenOut_ = isToSol ? NATIVE_MINT : tokenOut;

      const [poolKey, tokenMintX, tokenMintY] = this.getPoolAddress(
        tokenIn_,
        tokenOut_,
      );

      if (this.darklakeAmm.key !== poolKey) {
        await this.loadPool(tokenMintX, tokenMintY);
      }

      await this.updateAccounts();

      return this.darklakeAmm.quote({
        swapMode: SwapMode.ExactIn,
        inputMint: tokenIn_,
        amount: amountIn,
        epoch: new BN((await this.connection.getEpochInfo()).epoch),
      });
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('quote', {
            tokenIn: tokenIn.toString(),
            tokenOut: tokenOut.toString(),
            amountIn: amountIn.toString(),
          }),
        ),
      );
    }
  }

  public async swapTx(
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amountIn: BN,
    minAmountOut: BN,
    tokenOwner: PublicKey,
  ): Promise<{
    tx: VersionedTransaction;
    orderKey: PublicKey;
    minOut: BN;
    salt: Uint8Array;
  }> {
    try {
      const isFromSol = tokenIn.equals(SOL_MINT);
      const isToSol = tokenOut.equals(SOL_MINT);

      const tokenIn_ = isFromSol ? NATIVE_MINT : tokenIn;
      const tokenOut_ = isToSol ? NATIVE_MINT : tokenOut;

      const [poolKey, tokenMintX, tokenMintY] = this.getPoolAddress(
        tokenIn_,
        tokenOut_,
      );

      if (this.darklakeAmm.key !== poolKey) {
        await this.loadPool(tokenMintX, tokenMintY);
      }

      await this.updateAccounts();

      const salt = generateRandomSalt();

      const swapParamsIx: SwapParamsIx = {
        sourceMint: tokenIn_,
        destinationMint: tokenOut_,
        tokenTransferAuthority: tokenOwner,
        inAmount: amountIn,
        swapMode: SwapMode.ExactIn,
        minOut: minAmountOut,
        salt: salt,
      };

      const swapInstruction = await this.swapIx(swapParamsIx);

      const computeBudgetIx = web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000,
      });

      let allInstructions = [computeBudgetIx];

      const addressLookupTableAccount = await getAddressLookupTable(
        this.connection,
        this.isDevnet,
      );

      if (isFromSol) {
        const solToWsolInstructions = await getWrapSolToWsolInstructions(
          tokenOwner,
          new BN(amountIn),
        );
        allInstructions = allInstructions.concat(solToWsolInstructions);
      }

      allInstructions.push(swapInstruction);

      const recentBlockhash = await this.connection.getLatestBlockhash();

      const message = new TransactionMessage({
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allInstructions,
        payerKey: tokenOwner,
      }).compileToV0Message([addressLookupTableAccount]);

      const orderKey = await this.darklakeAmm.getOrderPubkey(tokenOwner);

      return {
        tx: new VersionedTransaction(message),
        orderKey: orderKey,
        minOut: minAmountOut,
        salt: salt,
      };
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('swapTx', {
            tokenIn: tokenIn.toString(),
            tokenOut: tokenOut.toString(),
            amountIn: amountIn.toString(),
            minAmountOut: minAmountOut.toString(),
            tokenOwner: tokenOwner.toString(),
          }),
        ),
      );
    }
  }

  public async finalizeTx(
    orderKey: PublicKey,
    unwrapWsol: boolean,
    minOut: BN,
    salt: Uint8Array,
    settleSigner?: PublicKey,
  ): Promise<{
    tx: VersionedTransaction;
  }> {
    try {
      const orderAccount = await this.retryGetOrderAccount(orderKey);
      if (!orderAccount) {
        return Promise.reject(
          DarklakeError.fromValidationError(
            'Order account not found',
            createErrorContext('finalizeTx', { orderKey: orderKey.toString() }),
          ),
        );
      }

      const order = this.darklakeAmm.parseOrderData(orderAccount.data);

      await this.updateAccounts();

      const settler = settleSigner || order.trader;

      const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        settler,
      );
      const createWsolAtaIx =
        await createAssociatedTokenAccountIdempotentInstruction(
          settler,
          associatedTokenAccount,
          settler,
          NATIVE_MINT,
        );

      const finalizeParamsIx: FinalizeParamsIx = {
        settleSigner: settler,
        orderOwner: order.trader,
        unwrapWsol: unwrapWsol,
        minOut: minOut,
        salt: salt,
        output: order.dOut,
        commitment: order.cMin,
        deadline: order.deadline,
        currentSlot: new BN(await this.connection.getSlot('processed')),
      };

      const finalizeInstruction = await this.finalizeIx(finalizeParamsIx);

      const computeBudgetIx = web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 500000,
      });

      const allInstructions = [
        computeBudgetIx,
        createWsolAtaIx,
        finalizeInstruction,
      ];

      const addressLookupTableAccount = await getAddressLookupTable(
        this.connection,
        this.isDevnet,
      );

      const recentBlockhash = await this.connection.getLatestBlockhash();

      const message = new TransactionMessage({
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allInstructions,
        payerKey: settler,
      }).compileToV0Message([addressLookupTableAccount]);

      return {
        tx: new VersionedTransaction(message),
      };
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('finalizeTx', {
            orderKey: orderKey.toString(),
            unwrapWsol,
            minOut: minOut.toString(),
            salt: salt.toString(),
          }),
        ),
      );
    }
  }

  public async addLiquidityTx(
    tokenX: PublicKey,
    tokenY: PublicKey,
    maxAmountX: BN,
    maxAmountY: BN,
    amountLp: BN,
    user: PublicKey,
  ): Promise<{
    tx: VersionedTransaction;
  }> {
    try {
      const isXSol = tokenX.equals(SOL_MINT);
      const isYSol = tokenY.equals(SOL_MINT);

      const tokenXPostSol = isXSol ? NATIVE_MINT : tokenX;
      const tokenYPostSol = isYSol ? NATIVE_MINT : tokenY;

      const [poolKey, tokenMintX, tokenMintY] = this.getPoolAddress(
        tokenXPostSol,
        tokenYPostSol,
      );

      if (!tokenMintX.equals(tokenXPostSol)) {
        const temp = maxAmountX;
        maxAmountX = maxAmountY;
        maxAmountY = temp;
      }

      if (this.darklakeAmm.key !== poolKey) {
        await this.loadPool(tokenMintX, tokenMintY);
      }

      await this.updateAccounts();

      const addLiquidityParamsIx: AddLiquidityParamsIx = {
        user: user,
        amountLp: amountLp,
        maxAmountX: maxAmountX,
        maxAmountY: maxAmountY,
      };

      const addLiquidityInstruction =
        await this.addLiquidityIx(addLiquidityParamsIx);

      let allInstructions: TransactionInstruction[] = [];

      if (isXSol) {
        const solToWsolInstructions = await getWrapSolToWsolInstructions(
          user,
          new BN(maxAmountX),
        );
        allInstructions = allInstructions.concat(solToWsolInstructions);

        // Cant be both
      } else if (isYSol) {
        const solToWsolInstructions = await getWrapSolToWsolInstructions(
          user,
          new BN(maxAmountY),
        );
        allInstructions = allInstructions.concat(solToWsolInstructions);
      }

      allInstructions.push(addLiquidityInstruction);

      const addressLookupTableAccount = await getAddressLookupTable(
        this.connection,
        this.isDevnet,
      );

      const recentBlockhash = await this.connection.getLatestBlockhash();

      const message = new TransactionMessage({
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allInstructions,
        payerKey: user,
      }).compileToV0Message([addressLookupTableAccount]);

      return {
        tx: new VersionedTransaction(message),
      };
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('addLiquidityTx', {
            tokenX: tokenX.toString(),
            tokenY: tokenY.toString(),
            maxAmountX: maxAmountX.toString(),
            maxAmountY: maxAmountY.toString(),
            amountLp: amountLp.toString(),
            user: user.toString(),
          }),
        ),
      );
    }
  }

  public async removeLiquidityTx(
    tokenX: PublicKey,
    tokenY: PublicKey,
    minAmountX: BN,
    minAmountY: BN,
    amountLp: BN,
    user: PublicKey,
  ): Promise<{
    tx: VersionedTransaction;
  }> {
    try {
      const isXSol = tokenX.equals(SOL_MINT);
      const isYSol = tokenY.equals(SOL_MINT);

      const tokenXPostSol = isXSol ? NATIVE_MINT : tokenX;
      const tokenYPostSol = isYSol ? NATIVE_MINT : tokenY;

      const [poolKey, tokenMintX, tokenMintY] = this.getPoolAddress(
        tokenXPostSol,
        tokenYPostSol,
      );

      if (!tokenMintX.equals(tokenXPostSol)) {
        const temp = minAmountX;
        minAmountX = minAmountY;
        minAmountY = temp;
      }

      if (this.darklakeAmm.key !== poolKey) {
        await this.loadPool(tokenMintX, tokenMintY);
      }

      await this.updateAccounts();

      const removeLiquidityParamsIx: RemoveLiquidityParamsIx = {
        user: user,
        amountLp: amountLp,
        minAmountX: minAmountX,
        minAmountY: minAmountY,
      };

      const [tokenXOwner, tokenYOwner] = this.darklakeAmm.getTokenOwners();

      const associatedTokenX = await getAssociatedTokenAddress(
        tokenMintX,
        user,
        false,
        tokenXOwner,
      );
      const associatedTokenY = await getAssociatedTokenAddress(
        tokenMintY,
        user,
        false,
        tokenYOwner,
      );

      const createTokenXAtaIx =
        await createAssociatedTokenAccountIdempotentInstruction(
          user,
          associatedTokenX,
          user,
          tokenMintX,
          tokenXOwner,
        );

      const createTokenYAtaIx =
        await createAssociatedTokenAccountIdempotentInstruction(
          user,
          associatedTokenY,
          user,
          tokenMintY,
          tokenYOwner,
        );

      const removeLiquidityInstruction = await this.removeLiquidityIx(
        removeLiquidityParamsIx,
      );

      let allInstructions: TransactionInstruction[] = [
        createTokenXAtaIx,
        createTokenYAtaIx,
        removeLiquidityInstruction,
      ];

      if (isXSol || isYSol) {
        const closeWsolInstructions = await getCloseWsolInstructions(user);
        allInstructions = allInstructions.concat(closeWsolInstructions);
      }

      const addressLookupTableAccount = await getAddressLookupTable(
        this.connection,
        this.isDevnet,
      );

      const recentBlockhash = await this.connection.getLatestBlockhash();

      const message = new TransactionMessage({
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allInstructions,
        payerKey: user,
      }).compileToV0Message([addressLookupTableAccount]);

      return {
        tx: new VersionedTransaction(message),
      };
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('removeLiquidityTx', {
            tokenX: tokenX.toString(),
            tokenY: tokenY.toString(),
            minAmountX: minAmountX.toString(),
            minAmountY: minAmountY.toString(),
            amountLp: amountLp.toString(),
            user: user.toString(),
          }),
        ),
      );
    }
  }

  public async initializePoolTx(
    tokenX: PublicKey,
    tokenY: PublicKey,
    amountX: BN,
    amountY: BN,
    user: PublicKey,
  ): Promise<{
    tx: VersionedTransaction;
  }> {
    try {
      const isXSol = tokenX.equals(SOL_MINT);
      const isYSol = tokenY.equals(SOL_MINT);

      const tokenXPostSol = isXSol ? NATIVE_MINT : tokenX;
      const tokenYPostSol = isYSol ? NATIVE_MINT : tokenY;

      const [, tokenMintX, tokenMintY] = this.getPoolAddress(
        tokenXPostSol,
        tokenYPostSol,
      );

      if (!tokenMintX.equals(tokenXPostSol)) {
        const temp = amountX;
        amountX = amountY;
        amountY = temp;
      }

      const tokenXAccount = await this.connection.getAccountInfo(tokenMintX);
      const tokenYAccount = await this.connection.getAccountInfo(tokenMintY);

      if (!tokenXAccount) {
        return Promise.reject(
          DarklakeError.fromValidationError(
            'Token X account not found',
            createErrorContext('initializePoolTx', {
              tokenX: tokenMintX.toString(),
            }),
          ),
        );
      }
      if (!tokenYAccount) {
        return Promise.reject(
          DarklakeError.fromValidationError(
            'Token Y account not found',
            createErrorContext('initializePoolTx', {
              tokenY: tokenMintY.toString(),
            }),
          ),
        );
      }

      const initializePoolParamsIx: InitializePoolParamsIx = {
        user: user,
        amountX,
        amountY,
        tokenX: tokenMintX,
        tokenXProgram: tokenXAccount.owner,
        tokenY: tokenMintY,
        tokenYProgram: tokenYAccount.owner,
      };

      const initializePoolInstruction = await this.initializePoolIx(
        initializePoolParamsIx,
      );

      const computeBudgetIx = web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 500000,
      });

      let allInstructions: TransactionInstruction[] = [computeBudgetIx];

      if (isXSol) {
        const solToWsolInstructions = await getWrapSolToWsolInstructions(
          user,
          new BN(amountX),
        );
        allInstructions = allInstructions.concat(solToWsolInstructions);

        // Cant be both
      } else if (isYSol) {
        const solToWsolInstructions = await getWrapSolToWsolInstructions(
          user,
          new BN(amountY),
        );
        allInstructions = allInstructions.concat(solToWsolInstructions);
      }

      allInstructions.push(initializePoolInstruction);

      const addressLookupTableAccount = await getAddressLookupTable(
        this.connection,
        this.isDevnet,
      );

      const recentBlockhash = await this.connection.getLatestBlockhash();

      const message = new TransactionMessage({
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allInstructions,
        payerKey: user,
      }).compileToV0Message([addressLookupTableAccount]);

      return {
        tx: new VersionedTransaction(message),
      };
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('initializePoolTx', {
            tokenX: tokenX.toString(),
            tokenY: tokenY.toString(),
            amountX: amountX.toString(),
            amountY: amountY.toString(),
            user: user.toString(),
          }),
        ),
      );
    }
  }

  public async loadPool(
    tokenMintX: PublicKey,
    tokenMintY: PublicKey,
  ): Promise<[PublicKey, PublicKey, PublicKey]> {
    const [poolKey, orderedTokenMintX, orderedTokenMintY] = this.getPoolAddress(
      tokenMintX,
      tokenMintY,
    );

    const poolAccountData = await this.connection.getAccountInfo(poolKey);

    if (!poolAccountData) {
      return Promise.reject(
        DarklakeError.fromValidationError(
          'Pool not found',
          createErrorContext('loadPool', {
            poolKey: poolKey.toString(),
            tokenMintX: tokenMintX.toString(),
            tokenMintY: tokenMintY.toString(),
          }),
        ),
      );
    }

    const poolKeyAndAccount: KeyedAccountInfo = {
      accountId: poolKey,
      accountInfo: poolAccountData,
    };

    this.darklakeAmm = DarklakeAmm.loadPool(poolKeyAndAccount);
    return [poolKey, orderedTokenMintX, orderedTokenMintY];
  }

  public async updateAccounts(): Promise<void> {
    const accountsToUpdate = this.darklakeAmm.getAccountsToUpdate();
    const accountMap = new Map<PublicKey, AccountData>();

    for (const account of accountsToUpdate) {
      const accountData = await this.connection.getAccountInfo(account);
      if (!accountData) {
        return Promise.reject(
          DarklakeError.fromValidationError(
            `Account not found: ${account.toString()}`,
            createErrorContext('updateAccounts', {
              account: account.toString(),
            }),
          ),
        );
      }
      accountMap.set(account, accountData as any);
    }

    this.darklakeAmm.update(accountMap);
  }

  // INSTRUCTION METHODS (PRONE TO CHANGE)

  public async swapIx(
    swapParamsIx: SwapParamsIx,
  ): Promise<TransactionInstruction> {
    const swapParams: SwapParams = {
      ...swapParamsIx,
      label: this.label,
    };

    const swapAndAccountMetas =
      await this.darklakeAmm.getSwapAndAccountMetas(swapParams);

    return new TransactionInstruction({
      programId: this.program.programId,
      keys: swapAndAccountMetas.accountMetas,
      data: Buffer.from(swapAndAccountMetas.data),
    });
  }

  public async finalizeIx(
    finalizeParamsIx: FinalizeParamsIx,
  ): Promise<TransactionInstruction> {
    try {
      const deadline = new BN(finalizeParamsIx.deadline);
      const currentSlot = new BN(finalizeParamsIx.currentSlot);
      const minOut = new BN(finalizeParamsIx.minOut);
      const output = new BN(finalizeParamsIx.output);

      const isSettle = minOut.lte(output);
      const isSlash = currentSlot.gt(deadline);

      if (isSlash) {
        const slashParams: SlashParams = {
          settleSigner: finalizeParamsIx.settleSigner,
          orderOwner: finalizeParamsIx.orderOwner,
          deadline: finalizeParamsIx.deadline,
          currentSlot: finalizeParamsIx.currentSlot,
          label: this.label,
        };
        const slashAndAccountMetas =
          await this.darklakeAmm.getSlashAndAccountMetas(slashParams);
        return new TransactionInstruction({
          programId: this.program.programId,
          keys: slashAndAccountMetas.accountMetas,
          data: Buffer.from(slashAndAccountMetas.data),
        });
      }

      const privateInputs = {
        minOut: minOut.toString(),
        salt: uint8ArrayToBigInt(finalizeParamsIx.salt).toString(),
      };
      const publicInputs = {
        realOut: finalizeParamsIx.output.toString(),
        commitment: toBigInt(finalizeParamsIx.commitment).toString(),
      };

      const { proofA, proofB, proofC, publicSignals } = await generateProof(
        privateInputs,
        publicInputs,
        !isSettle,
      );

      const proofParams: GeneratedProof = {
        proofA: proofA,
        proofB: proofB,
        proofC: proofC,
        publicSignals: publicSignals,
      };

      if (isSettle) {
        const settleParams: SettleParams = {
          settleSigner: finalizeParamsIx.settleSigner,
          orderOwner: finalizeParamsIx.orderOwner,
          unwrapWsol: finalizeParamsIx.unwrapWsol,
          minOut: finalizeParamsIx.minOut,
          salt: finalizeParamsIx.salt,
          output: finalizeParamsIx.output,
          commitment: finalizeParamsIx.commitment,
          deadline: finalizeParamsIx.deadline,
          currentSlot: finalizeParamsIx.currentSlot,
          label: this.label,
        };
        const settleAndAccountMetas =
          await this.darklakeAmm.getSettleAndAccountMetas(
            settleParams,
            proofParams,
          );
        return new TransactionInstruction({
          programId: this.program.programId,
          keys: settleAndAccountMetas.accountMetas,
          data: Buffer.from(settleAndAccountMetas.data),
        });
      }

      const cancelParams: CancelParams = {
        settleSigner: finalizeParamsIx.settleSigner,
        orderOwner: finalizeParamsIx.orderOwner,
        minOut: finalizeParamsIx.minOut,
        salt: finalizeParamsIx.salt,
        output: finalizeParamsIx.output,
        commitment: finalizeParamsIx.commitment,
        deadline: finalizeParamsIx.deadline,
        currentSlot: finalizeParamsIx.currentSlot,
        label: this.label,
      };

      const cancelAndAccountMetas =
        await this.darklakeAmm.getCancelAndAccountMetas(
          cancelParams,
          proofParams,
        );

      return new TransactionInstruction({
        programId: this.program.programId,
        keys: cancelAndAccountMetas.accountMetas,
        data: Buffer.from(cancelAndAccountMetas.data),
      });
    } catch (error) {
      if (error instanceof DarklakeError) {
        return Promise.reject(error);
      }
      return Promise.reject(
        DarklakeError.fromNetworkError(
          error as Error,
          createErrorContext('finalizeIx', {
            settleSigner: finalizeParamsIx.settleSigner.toString(),
            orderOwner: finalizeParamsIx.orderOwner.toString(),
            minOut: finalizeParamsIx.minOut.toString(),
          }),
        ),
      );
    }
  }

  public async addLiquidityIx(
    addLiquidityParamsIx: AddLiquidityParamsIx,
  ): Promise<TransactionInstruction> {
    const addLiquidityParams: AddLiquidityParams = {
      user: addLiquidityParamsIx.user,
      amountLp: addLiquidityParamsIx.amountLp,
      maxAmountX: addLiquidityParamsIx.maxAmountX,
      maxAmountY: addLiquidityParamsIx.maxAmountY,
      label: this.label,
      refCode: this.refCode || new Uint8Array(0),
    };

    const addLiquidityAndAccountMetas =
      await this.darklakeAmm.getAddLiquidityAndAccountMetas(addLiquidityParams);

    return new TransactionInstruction({
      programId: this.program.programId,
      keys: addLiquidityAndAccountMetas.accountMetas,
      data: Buffer.from(addLiquidityAndAccountMetas.data),
    });
  }

  public async removeLiquidityIx(
    removeLiquidityParamsIx: RemoveLiquidityParamsIx,
  ): Promise<TransactionInstruction> {
    const removeLiquidityParams: RemoveLiquidityParams = {
      user: removeLiquidityParamsIx.user,
      amountLp: removeLiquidityParamsIx.amountLp,
      minAmountX: removeLiquidityParamsIx.minAmountX,
      minAmountY: removeLiquidityParamsIx.minAmountY,
      label: this.label,
    };

    const removeLiquidityAndAccountMetas =
      await this.darklakeAmm.getRemoveLiquidityAndAccountMetas(
        removeLiquidityParams,
      );

    return new TransactionInstruction({
      programId: this.program.programId,
      keys: removeLiquidityAndAccountMetas.accountMetas,
      data: Buffer.from(removeLiquidityAndAccountMetas.data),
    });
  }

  public async initializePoolIx(
    initializePoolParamsIx: InitializePoolParamsIx,
  ): Promise<TransactionInstruction> {
    const initializePoolParams: InitializePoolParams = {
      user: initializePoolParamsIx.user,
      amountX: initializePoolParamsIx.amountX,
      amountY: initializePoolParamsIx.amountY,
      tokenX: initializePoolParamsIx.tokenX,
      tokenXProgram: initializePoolParamsIx.tokenXProgram,
      tokenY: initializePoolParamsIx.tokenY,
      tokenYProgram: initializePoolParamsIx.tokenYProgram,
      label: this.label,
    };

    const addLiquidityAndAccountMetas =
      await this.darklakeAmm.getInitializePoolAndAccountMetas(
        initializePoolParams,
        this.isDevnet,
      );

    return new TransactionInstruction({
      programId: this.program.programId,
      keys: addLiquidityAndAccountMetas.accountMetas,
      data: Buffer.from(addLiquidityAndAccountMetas.data),
    });
  }

  /**
   * Get order account data with retry logic
   * Retries 5 times with 5 second intervals before failing
   */
  private async retryGetOrderAccount(
    orderKey: PublicKey,
  ): Promise<AccountInfo<Buffer> | null> {
    const maxRetries = 5;
    const retryDelay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const accountData = await this.connection.getAccountInfo(orderKey);

        if (accountData) {
          return accountData;
        }
      } catch (error) {
        return Promise.reject(
          DarklakeError.fromNetworkError(
            error as Error,
            createErrorContext('retryGetOrderAccount', {
              orderKey: orderKey.toString(),
              attempt,
            }),
          ),
        );
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return null;
  }

  public async getOrder(orderOwner: PublicKey): Promise<Order | null> {
    const orderKey = this.darklakeAmm.getOrderPubkey(orderOwner);
    const orderAccount = await this.connection.getAccountInfo(orderKey);
    if (!orderAccount) {
      return null;
    }
    return this.darklakeAmm.parseOrderData(orderAccount.data);
  }

  private getPoolAddress(
    tokenMintX: PublicKey,
    tokenMintY: PublicKey,
  ): [PublicKey, PublicKey, PublicKey] {
    const [tokenMintX_, tokenMintY_] = this.sortTokens(tokenMintX, tokenMintY);

    const poolKey = DarklakeAmm.getPoolAddress(tokenMintX_, tokenMintY_);

    return [poolKey, tokenMintX_, tokenMintY_];
  }

  public sortTokens(
    tokenMintX: PublicKey,
    tokenMintY: PublicKey,
  ): [PublicKey, PublicKey] {
    if (tokenMintX.toBuffer().compare(tokenMintY.toBuffer()) > 0) {
      return [tokenMintY, tokenMintX];
    }
    return [tokenMintX, tokenMintY];
  }
}
