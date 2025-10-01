import {
  DarklakeSDK,
  PublicKey,
  Commitment,
  SwapMode,
  SwapParamsIx,
  DEVNET_LOOKUP,
  BN,
  InitializePoolParamsIx,
  RemoveLiquidityParamsIx,
  AddLiquidityParamsIx,
  SOL_MINT,
} from '@darklake/ts-sdk-on-chain';
import {
  Keypair,
  Connection,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  createNewTokens,
  getAddressLookupTable,
  retryGetOrderAccount,
  createWsolAccountAndWrap,
  createWsolAccountIx,
  unwrapWsolAndCloseAccountIx,
} from './utils';
import { TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';

// Helper function to convert BN fields to readable numbers
function convertBNToReadable(obj: any): any {
  if (obj === null || obj === undefined || obj instanceof PublicKey) {
    return obj;
  }

  if (obj instanceof BN) {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBNToReadable);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBNToReadable(value);
    }
    return result;
  }

  return obj;
}

// Configuration
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const TOKEN_MINT_X = new PublicKey(
  'DdLxrGFs2sKYbbqVk76eVx9268ASUdTMAhrsqphqDuX',
);
const TOKEN_MINT_Y = new PublicKey(
  'HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY',
);

const tableAddress = DEVNET_LOOKUP;

// Function to load private key from user.json/settler.json
function loadPrivateKey(keyFileName: string): Keypair {
  try {
    const keyPath = path.join(__dirname, keyFileName);
    const keyData = fs.readFileSync(keyPath, 'utf8');
    const privateKeyBytes = JSON.parse(keyData);

    if (!Array.isArray(privateKeyBytes) || privateKeyBytes.length !== 64) {
      throw new Error('Invalid private key format. Expected 64 bytes array.');
    }

    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
    console.log(
      `🔑 Loaded private key for wallet: ${keypair.publicKey.toString()}`,
    );
    return keypair;
  } catch (error) {
    console.error('❌ Failed to load private key:', error);
    throw error;
  }
}

// Sleep utility function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// CLI argument parsing
function parseArgs(): { operation: string; mode: string } {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === 'quote') {
    return { operation: 'quote', mode: 'ix' }; // mode is ignored for quote
  }

  if (args.length < 2) {
    console.error('❌ Usage: npm start <operation> <mode>');
    console.error(
      '   Operations: settle, cancel, slash, addLiquidity, removeLiquidity, initializePool, all, quote',
    );
    console.error(
      '   SOL Operations: settleFromSol, settleToSol, addLiquiditySol, removeLiquiditySol, initializePoolSol',
    );
    console.error('   Modes: ix (instruction only), tx (full transaction)');
    console.error(
      '   Special: all mode runs all operations sequentially with 10s pauses',
    );
    process.exit(1);
  }

  const operation = args[0];
  const mode = args[1];

  const validOperations = [
    'settle',
    'cancel',
    'slash',
    'addLiquidity',
    'removeLiquidity',
    'initializePool',
    'all',
    'quote',
    'settleFromSol',
    'settleToSol',
    'addLiquiditySol',
    'removeLiquiditySol',
    'initializePoolSol',
  ];
  const validModes = ['ix', 'tx'];

  if (!validOperations.includes(operation)) {
    console.error(`❌ Invalid operation: ${operation}`);
    console.error(`   Valid operations: ${validOperations.join(', ')}`);
    process.exit(1);
  }

  if (!validModes.includes(mode)) {
    console.error(`❌ Invalid mode: ${mode}`);
    console.error(`   Valid modes: ${validModes.join(', ')}`);
    process.exit(1);
  }

  return { operation, mode };
}

// Initialize SDK helper
async function initializeSDK(): Promise<DarklakeSDK> {
  console.log('🚀 Initializing Darklake SDK...');

  // Initialize the SDK
  const sdk = new DarklakeSDK(
    RPC_ENDPOINT,
    'processed' as Commitment,
    true, // isDevnet
    'test-app', // label
    null, // refCode
  );

  console.log('✅ SDK initialized successfully');
  console.log(`📡 Connected to: ${RPC_ENDPOINT}`);
  console.log(`🏷️  SDK Label: test-app`);

  return sdk;
}

// Quote operation
async function runQuote(sdk: DarklakeSDK): Promise<void> {
  console.log('\n🔄 Running quote operation...');

  const quote = await sdk.quote(TOKEN_MINT_X, TOKEN_MINT_Y, new BN(1000));
  console.log('✅ Quote generated successfully!');

  console.log('Quote:', convertBNToReadable(quote));
}

// Settle operation
async function runSettle(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running settle operation...');

  // For settle, we need an existing order - this is a simplified example
  // In practice, you'd need to provide an order key or get it from a previous swap

  if (mode === 'ix') {
    await sdk.loadPool(TOKEN_MINT_X, TOKEN_MINT_Y);
    await sdk.updateAccounts();

    const swapParamsIx: SwapParamsIx = {
      sourceMint: TOKEN_MINT_X,
      destinationMint: TOKEN_MINT_Y,
      tokenTransferAuthority: keypair.publicKey,
      inAmount: new BN(1000),
      swapMode: SwapMode.ExactIn,
      minOut: new BN(10),
      salt: new Uint8Array(32),
    };
    const swapResult = await sdk.swapIx(swapParamsIx);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });
    const allSwapInstructions = [computeBudgetIx, swapResult];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSwapInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const swapVersionedTransaction = new VersionedTransaction(swapMessage);
    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(
      swapVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    await sdk.updateAccounts();

    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    // Generate settle instruction only - the key difference is minOut <= output triggers settle
    const settleInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut: swapParamsIx.minOut,
      salt: swapParamsIx.salt,
      output: new BN(order.dOut.toString()),
      commitment: order.cMin,
      deadline: new BN(order.deadline.toString()),
      currentSlot: new BN(await connection.getSlot('processed')),
    });

    const settleComputeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const allSettleInstructions = [settleComputeBudgetIx, settleInstruction];

    const settleMessage = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: allSettleInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const settleVersionedTransaction = new VersionedTransaction(settleMessage);
    settleVersionedTransaction.sign([keypair]);
    const settleSignature = await connection.sendTransaction(
      settleVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Settle transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${settleSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Swap -> settle using the tx method...');

    const minOut = new BN(10);
    const inputAmount = new BN(1000);
    const swapResult = await sdk.swapTx(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
      inputAmount,
      minOut,
      keypair.publicKey,
    );

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    console.log('Generating settle transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      false, // unwrapWsol
      minOut, // minOut - should be from actual order
      swapResult.salt, // salt - should be from actual order
      keypair.publicKey,
    );
    console.log('✅ Settle transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(
      finalizeResult.tx,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Cancel operation
async function runCancel(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running cancel operation...');

  if (mode === 'ix') {
    await sdk.loadPool(TOKEN_MINT_X, TOKEN_MINT_Y);
    await sdk.updateAccounts();

    const swapParamsIx: SwapParamsIx = {
      sourceMint: TOKEN_MINT_X,
      destinationMint: TOKEN_MINT_Y,
      tokenTransferAuthority: keypair.publicKey,
      inAmount: new BN(1000),
      swapMode: SwapMode.ExactIn,
      minOut: new BN(1000000),
      salt: new Uint8Array(32),
    };
    const swapResult = await sdk.swapIx(swapParamsIx);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });
    const allSwapInstructions = [computeBudgetIx, swapResult];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSwapInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const swapVersionedTransaction = new VersionedTransaction(swapMessage);
    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(
      swapVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    await sdk.updateAccounts();

    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    // Generate cancel instruction only
    const cancelInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut: swapParamsIx.minOut,
      salt: swapParamsIx.salt,
      output: new BN(order.dOut.toString()),
      commitment: order.cMin,
      deadline: new BN(order.deadline.toString()),
      currentSlot: new BN(await connection.getSlot('processed')),
    });

    const cancelComputeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const allCancelInstructions = [cancelComputeBudgetIx, cancelInstruction];

    const cancelMessage = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: allCancelInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const cancelVersionedTransaction = new VersionedTransaction(cancelMessage);
    cancelVersionedTransaction.sign([keypair]);
    const cancelSignature = await connection.sendTransaction(
      cancelVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Cancel transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${cancelSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Swap -> cancel using the tx method...');

    const minOut = new BN(100000);
    const inputAmount = new BN(1000);
    const swapResult = await sdk.swapTx(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
      inputAmount,
      minOut,
      keypair.publicKey,
    );

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    console.log('Generating cancel transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      false, // unwrapWsol
      minOut, // minOut - should be from actual order
      swapResult.salt, // salt - should be from actual order
      keypair.publicKey,
    );
    console.log('✅ Cancel transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(
      finalizeResult.tx,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Slash operation
async function runSlash(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running slash operation...');

  if (mode === 'ix') {
    const minOut = new BN(10);
    const salt = new Uint8Array(1);
    const inputAmount = new BN(1000);
    const swapParamsIx: SwapParamsIx = {
      sourceMint: TOKEN_MINT_X,
      destinationMint: TOKEN_MINT_Y,
      tokenTransferAuthority: keypair.publicKey,
      inAmount: inputAmount,
      swapMode: SwapMode.ExactIn,
      minOut,
      salt,
    };

    await sdk.loadPool(TOKEN_MINT_X, TOKEN_MINT_Y);
    await sdk.updateAccounts();

    const swapInstruction = await sdk.swapIx(swapParamsIx);
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    let allSwapInstructions = [computeBudgetIx, swapInstruction];

    const addressLookupTableAccount = await getAddressLookupTable(
      tableAddress,
      connection,
    );

    let recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSwapInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const swapVersionedTransaction = new VersionedTransaction(swapMessage);

    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(
      swapVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    await sdk.updateAccounts();

    let currentSlot = await connection.getSlot('processed');
    while (order.deadline.gte(new BN(currentSlot + 1))) {
      currentSlot = await connection.getSlot('processed');
      console.log('Waiting for order to expire...');
      console.log('Current slot:', currentSlot);
      console.log('Order deadline:', order.deadline.toString());
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Generate slash instruction only
    const slashInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut,
      salt,
      output: new BN(order.dOut.toString()),
      commitment: order.cMin,
      deadline: new BN(order.deadline.toString()), // Past deadline to trigger slash
      currentSlot: new BN((currentSlot + 1).toString()),
    });

    const allSlashInstructions = [slashInstruction];

    recentBlockhash = await connection.getLatestBlockhash();
    const slashMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSlashInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const slashVersionedTransaction = new VersionedTransaction(slashMessage);
    slashVersionedTransaction.sign([keypair]);
    const slashSignature = await connection.sendTransaction(
      slashVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Slash transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${slashSignature}?cluster=devnet`,
    );

    console.log('✅ Slash instruction generated successfully!');
  } else if (mode === 'tx') {
    // Generate and execute slash transaction
    const minOut = new BN(100000);
    const inputAmount = new BN(1000);
    const swapResult = await sdk.swapTx(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
      inputAmount,
      minOut,
      keypair.publicKey,
    );

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    // Force slash by waiting for order to expire
    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    let currentSlot = await connection.getSlot('processed');
    while (order.deadline.gte(new BN(currentSlot + 2))) {
      currentSlot = await connection.getSlot('processed');
      console.log('Waiting for order to expire...');
      console.log('Current slot:', currentSlot);
      console.log('Order deadline:', order.deadline.toString());
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('Generating slash transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      false, // unwrapWsol
      minOut, // minOut - should be from actual order
      swapResult.salt, // salt - should be from actual order
      keypair.publicKey,
    );
    console.log('✅ Slash transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(
      finalizeResult.tx,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Add liquidity operation
async function runAddLiquidity(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running add liquidity operation...');

  if (mode === 'ix') {
    console.log('\n📊 Loading pool...');
    const [poolKey, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
    );
    await sdk.updateAccounts();

    const maxAmountX = new BN(100);
    const maxAmountY = new BN(200);
    const amountLp = new BN(10);

    const addLiquidityParamsIx: AddLiquidityParamsIx = {
      user: keypair.publicKey,
      amountLp,
      maxAmountX,
      maxAmountY,
    };

    const addLiquidityInstruction =
      await sdk.addLiquidityIx(addLiquidityParamsIx);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [computeBudgetIx, addLiquidityInstruction];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const addLiquidityMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const addLiquidityVersionedTransaction = new VersionedTransaction(
      addLiquidityMessage,
    );
    addLiquidityVersionedTransaction.sign([keypair]);

    const addLiquiditySignature = await connection.sendTransaction(
      addLiquidityVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Add liquidity using the tx method...');

    const maxAmountX = new BN(100);
    const maxAmountY = new BN(200);
    const amountLp = new BN(10);
    const addLiquidityResult = await sdk.addLiquidityTx(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
      maxAmountX,
      maxAmountY,
      amountLp,
      keypair.publicKey,
    );

    const tx = addLiquidityResult.tx;
    tx.sign([keypair]);
    const addLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Remove liquidity operation
async function runRemoveLiquidity(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running remove liquidity operation...');

  if (mode === 'ix') {
    console.log('\n📊 Loading pool...');
    const [poolKey, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
    );
    await sdk.updateAccounts();

    const minAmountX = new BN(10);
    const minAmountY = new BN(20);
    const amountLp = new BN(1000);

    const removeLiquidityParamsIx: RemoveLiquidityParamsIx = {
      user: keypair.publicKey,
      amountLp,
      minAmountX,
      minAmountY,
    };

    const removeLiquidityInstruction = await sdk.removeLiquidityIx(
      removeLiquidityParamsIx,
    );

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [computeBudgetIx, removeLiquidityInstruction];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const removeLiquidityMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const removeLiquidityVersionedTransaction = new VersionedTransaction(
      removeLiquidityMessage,
    );
    removeLiquidityVersionedTransaction.sign([keypair]);

    const removeLiquiditySignature = await connection.sendTransaction(
      removeLiquidityVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Remove liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${removeLiquiditySignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Remove liquidity using the tx method...');

    const minAmountX = new BN(10);
    const minAmountY = new BN(20);
    const amountLp = new BN(1000);
    const removeLiquidityResult = await sdk.removeLiquidityTx(
      TOKEN_MINT_X,
      TOKEN_MINT_Y,
      minAmountX,
      minAmountY,
      amountLp,
      keypair.publicKey,
    );

    const tx = removeLiquidityResult.tx;
    tx.sign([keypair]);
    const removeLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Remove liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${removeLiquiditySignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Initialize pool operation
async function runInitializePool(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running initialize pool operation...');
  console.log(
    '⚠️  Note: Initialize pool functionality is not fully implemented in the current SDK',
  );

  const { tokenMintX: tokenMintX_, tokenMintY: tokenMintY_ } =
    await createNewTokens(connection, keypair, 1000000);

  const amountX = new BN(10000);
  const amountY = new BN(20000);

  const [tokenMintX, tokenMintY] = sdk.sortTokens(tokenMintX_, tokenMintY_);

  if (mode === 'ix') {
    const initializePoolParamsIx: InitializePoolParamsIx = {
      user: keypair.publicKey,
      amountX,
      amountY,
      tokenX: tokenMintX,
      tokenXProgram: TOKEN_PROGRAM_ID,
      tokenY: tokenMintY,
      tokenYProgram: TOKEN_PROGRAM_ID,
    };
    const initializePoolInstruction = await sdk.initializePoolIx(
      initializePoolParamsIx,
    );

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [computeBudgetIx, initializePoolInstruction];
    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const initializePoolMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const initializePoolVersionedTransaction = new VersionedTransaction(
      initializePoolMessage,
    );
    initializePoolVersionedTransaction.sign([keypair]);

    const initializePoolSignature = await connection.sendTransaction(
      initializePoolVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Initialize pool transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${initializePoolSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Add liquidity using the tx method...');

    const initializePoolResult = await sdk.initializePoolTx(
      tokenMintX,
      tokenMintY,
      amountX,
      amountY,
      keypair.publicKey,
    );

    const tx = initializePoolResult.tx;
    tx.sign([keypair]);
    const addLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Settle from SOL operation
async function runSettleFromSol(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running settle from SOL operation...');

  if (mode === 'ix') {
    // Dex does not support SOL as the source mint directly, so we need to use NATIVE_MINT (WSOL)
    await sdk.loadPool(NATIVE_MINT, TOKEN_MINT_X);
    await sdk.updateAccounts();

    const swapParamsIx: SwapParamsIx = {
      sourceMint: NATIVE_MINT, // Use NATIVE_MINT for WSOL in ix mode
      destinationMint: TOKEN_MINT_X,
      tokenTransferAuthority: keypair.publicKey,
      inAmount: new BN(1000),
      swapMode: SwapMode.ExactIn,
      minOut: new BN(10),
      salt: new Uint8Array(32),
    };
    const swapResult = await sdk.swapIx(swapParamsIx);

    // Create WSOL ATA and wrap SOL to WSOL
    const { createWsolAtaIx, transferSolIx, syncNativeIx } =
      await createWsolAccountAndWrap(keypair, swapParamsIx.inAmount.toNumber());

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });
    const allSwapInstructions = [
      computeBudgetIx,
      createWsolAtaIx,
      transferSolIx,
      syncNativeIx,
      swapResult,
    ];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSwapInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const swapVersionedTransaction = new VersionedTransaction(swapMessage);
    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(
      swapVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    await sdk.updateAccounts();

    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    // Generate settle instruction only
    const settleInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut: swapParamsIx.minOut,
      salt: swapParamsIx.salt,
      output: new BN(order.dOut.toString()),
      commitment: order.cMin,
      deadline: new BN(order.deadline.toString()),
      currentSlot: new BN(await connection.getSlot('processed')),
    });

    const settleComputeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const allSettleInstructions = [settleComputeBudgetIx, settleInstruction];

    const settleMessage = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: allSettleInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const settleVersionedTransaction = new VersionedTransaction(settleMessage);
    settleVersionedTransaction.sign([keypair]);
    const settleSignature = await connection.sendTransaction(
      settleVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Settle transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${settleSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Swap from SOL -> settle using the tx method...');

    const minOut = new BN(10);
    const inputAmount = new BN(1000);
    const swapResult = await sdk.swapTx(
      SOL_MINT,
      TOKEN_MINT_X,
      inputAmount,
      minOut,
      keypair.publicKey,
    );

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    console.log('Generating settle transaction...');
    // unwrapping can also be done manually using instrunctions
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      true, // unwrapWsol - unwrap WSOL back to SOL
      minOut,
      swapResult.salt,
      keypair.publicKey,
    );
    console.log('✅ Settle transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(
      finalizeResult.tx,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Settle to SOL operation
async function runSettleToSol(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running settle to SOL operation...');

  if (mode === 'ix') {
    await sdk.loadPool(TOKEN_MINT_X, NATIVE_MINT);
    await sdk.updateAccounts();

    const swapParamsIx: SwapParamsIx = {
      sourceMint: TOKEN_MINT_X,
      destinationMint: NATIVE_MINT, // Use NATIVE_MINT for WSOL in ix mode
      tokenTransferAuthority: keypair.publicKey,
      inAmount: new BN(1000),
      swapMode: SwapMode.ExactIn,
      minOut: new BN(10),
      salt: new Uint8Array(32),
    };
    const swapResult = await sdk.swapIx(swapParamsIx);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });
    const allSwapInstructions = [computeBudgetIx, swapResult];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allSwapInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const swapVersionedTransaction = new VersionedTransaction(swapMessage);
    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(
      swapVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    await sdk.updateAccounts();

    const order = await retryGetOrderAccount(sdk, keypair.publicKey);
    if (!order) {
      throw new Error('Order not found');
    }

    // Generate settle instruction only
    const settleInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: true, // Unwrap WSOL back to SOL
      minOut: swapParamsIx.minOut,
      salt: swapParamsIx.salt,
      output: new BN(order.dOut.toString()),
      commitment: order.cMin,
      deadline: new BN(order.deadline.toString()),
      currentSlot: new BN(await connection.getSlot('processed')),
    });

    const settleComputeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const allSettleInstructions = [settleComputeBudgetIx, settleInstruction];

    const settleMessage = new TransactionMessage({
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: allSettleInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);
    const settleVersionedTransaction = new VersionedTransaction(settleMessage);
    settleVersionedTransaction.sign([keypair]);
    const settleSignature = await connection.sendTransaction(
      settleVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );
    console.log(`✅ Settle transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${settleSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Swap to SOL -> settle using the tx method...');

    const minOut = new BN(10);
    const inputAmount = new BN(1000);
    const swapResult = await sdk.swapTx(
      TOKEN_MINT_X,
      SOL_MINT,
      inputAmount,
      minOut,
      keypair.publicKey,
    );

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`,
    );

    console.log('Generating settle transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      true, // unwrapWsol - unwrap WSOL back to SOL
      minOut,
      swapResult.salt,
      keypair.publicKey,
    );
    console.log('✅ Settle transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(
      finalizeResult.tx,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Add liquidity with SOL operation
async function runAddLiquiditySol(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running add liquidity with SOL operation...');

  if (mode === 'ix') {
    console.log('\n📊 Loading pool...');
    const [, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(
      NATIVE_MINT,
      TOKEN_MINT_X,
    );
    await sdk.updateAccounts();

    const solAmount = new BN(100);
    const tokenXAmount = new BN(200);

    // need to match the x/y to the returned orderedTokenMintX/Y
    const maxAmountX = TOKEN_MINT_X.equals(orderedTokenMintX)
      ? tokenXAmount
      : solAmount; // Token X amount
    const maxAmountY = NATIVE_MINT.equals(orderedTokenMintY)
      ? solAmount
      : tokenXAmount; // SOL amount
    const amountLp = new BN(10);

    const addLiquidityParamsIx: AddLiquidityParamsIx = {
      user: keypair.publicKey,
      amountLp,
      maxAmountX,
      maxAmountY,
    };

    const { createWsolAtaIx, transferSolIx, syncNativeIx } =
      await createWsolAccountAndWrap(keypair, solAmount.toNumber());

    const addLiquidityInstruction =
      await sdk.addLiquidityIx(addLiquidityParamsIx);

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [
      computeBudgetIx,
      createWsolAtaIx,
      transferSolIx,
      syncNativeIx,
      addLiquidityInstruction,
    ];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const addLiquidityMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const addLiquidityVersionedTransaction = new VersionedTransaction(
      addLiquidityMessage,
    );
    addLiquidityVersionedTransaction.sign([keypair]);

    const addLiquiditySignature = await connection.sendTransaction(
      addLiquidityVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Add liquidity with SOL using the tx method...');

    const maxSolAmount = new BN(100); // SOL amount
    const maxTokenXAmount = new BN(200); // Token X amount
    const amountLp = new BN(10);
    const addLiquidityResult = await sdk.addLiquidityTx(
      SOL_MINT,
      TOKEN_MINT_X,
      maxSolAmount,
      maxTokenXAmount,
      amountLp,
      keypair.publicKey,
    );

    const tx = addLiquidityResult.tx;
    tx.sign([keypair]);
    const addLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Remove liquidity with SOL operation
async function runRemoveLiquiditySol(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running remove liquidity with SOL operation...');

  if (mode === 'ix') {
    console.log('\n📊 Loading pool...');
    const [, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(
      NATIVE_MINT,
      TOKEN_MINT_X,
    );
    await sdk.updateAccounts();

    const minSolAmount = new BN(100);
    const minTokenXAmount = new BN(200);

    const minAmountX = NATIVE_MINT.equals(orderedTokenMintX)
      ? minSolAmount
      : minTokenXAmount; // SOL amount
    const minAmountY = TOKEN_MINT_X.equals(orderedTokenMintY)
      ? minTokenXAmount
      : minSolAmount; // Token X amount
    const amountLp = new BN(1000);

    const removeLiquidityParamsIx: RemoveLiquidityParamsIx = {
      user: keypair.publicKey,
      amountLp,
      minAmountX,
      minAmountY,
    };

    // Create WSOL ATA account before remove liquidity
    const { createWsolAtaIx } = await createWsolAccountIx(keypair);
    // Unwrap WSOL and close account after remove liquidity
    const { syncNativeIx, closeAccountIx } =
      await unwrapWsolAndCloseAccountIx(keypair);
    const removeLiquidityInstruction = await sdk.removeLiquidityIx(
      removeLiquidityParamsIx,
    );

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [
      computeBudgetIx,
      createWsolAtaIx,
      removeLiquidityInstruction,
      syncNativeIx,
      closeAccountIx,
    ];

    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const removeLiquidityMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const removeLiquidityVersionedTransaction = new VersionedTransaction(
      removeLiquidityMessage,
    );
    removeLiquidityVersionedTransaction.sign([keypair]);

    const removeLiquiditySignature = await connection.sendTransaction(
      removeLiquidityVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Remove liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${removeLiquiditySignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Remove liquidity with SOL using the tx method...');

    const minSolAmountX = new BN(10); // SOL amount
    const minTokenXAmount = new BN(20); // Token Y amount
    const amountLp = new BN(1000);
    const removeLiquidityResult = await sdk.removeLiquidityTx(
      SOL_MINT,
      TOKEN_MINT_X,
      minSolAmountX,
      minTokenXAmount,
      amountLp,
      keypair.publicKey,
    );

    const tx = removeLiquidityResult.tx;
    tx.sign([keypair]);
    const removeLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Remove liquidity transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${removeLiquiditySignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

// Initialize pool with SOL operation
async function runInitializePoolSol(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log('\n🔄 Running initialize pool with SOL operation...');
  console.log(
    '⚠️  Note: Initialize pool functionality is not fully implemented in the current SDK',
  );

  const { tokenMintX: tokenMintX_, tokenMintY: _ } = await createNewTokens(
    connection,
    keypair,
    1000000,
  );

  const solAmount = new BN(10000); // SOL amount
  const tokenAmount = new BN(20000); // Token X amount

  if (mode === 'ix') {
    const [tokenMintX, tokenMintY] = sdk.sortTokens(NATIVE_MINT, tokenMintX_);

    const initializePoolParamsIx: InitializePoolParamsIx = {
      user: keypair.publicKey,
      amountX: tokenMintX.equals(NATIVE_MINT) ? solAmount : tokenAmount,
      amountY: tokenMintX.equals(NATIVE_MINT) ? tokenAmount : solAmount,
      tokenX: tokenMintX,
      tokenXProgram: TOKEN_PROGRAM_ID,
      tokenY: tokenMintY,
      tokenYProgram: TOKEN_PROGRAM_ID,
    };

    const { createWsolAtaIx, transferSolIx, syncNativeIx } =
      await createWsolAccountAndWrap(keypair, solAmount.toNumber());

    const initializePoolInstruction = await sdk.initializePoolIx(
      initializePoolParamsIx,
    );

    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500000,
    });
    const allInstructions = [
      computeBudgetIx,
      createWsolAtaIx,
      transferSolIx,
      syncNativeIx,
      initializePoolInstruction,
    ];
    const addressLookupTableAccount = await getAddressLookupTable(
      DEVNET_LOOKUP,
      connection,
    );
    const recentBlockhash = await connection.getLatestBlockhash();
    const initializePoolMessage = new TransactionMessage({
      recentBlockhash: recentBlockhash.blockhash,
      instructions: allInstructions,
      payerKey: keypair.publicKey,
    }).compileToV0Message([addressLookupTableAccount]);

    const initializePoolVersionedTransaction = new VersionedTransaction(
      initializePoolMessage,
    );
    initializePoolVersionedTransaction.sign([keypair]);

    const initializePoolSignature = await connection.sendTransaction(
      initializePoolVersionedTransaction,
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    console.log(`✅ Initialize pool transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${initializePoolSignature}?cluster=devnet`,
    );
  } else if (mode === 'tx') {
    console.log('Initialize pool with SOL using the tx method...');

    const initializePoolResult = await sdk.initializePoolTx(
      SOL_MINT,
      tokenMintX_,
      solAmount,
      tokenAmount,
      keypair.publicKey,
    );

    const tx = initializePoolResult.tx;
    tx.sign([keypair]);
    const initializePoolSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    console.log(`✅ Initialize pool transaction sent successfully!`);
    console.log(
      `🔗 View on Solscan: https://solscan.io/tx/${initializePoolSignature}?cluster=devnet`,
    );
  } else {
    throw new Error('Mode not implemented');
  }
}

type OperationFunction = (
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) => Promise<void>;
type ShortOperationFunction = (sdk: DarklakeSDK) => Promise<void>;

// All operation - runs all operations sequentially with 10s pauses
async function runAll(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string,
) {
  console.log(
    '\n🎬 Starting ALL mode - running all operations sequentially with 10s pauses...',
  );
  console.log(
    '⚠️  This will take approximately 2-3 minutes to complete all operations',
  );

  const operations: {
    name: string;
    fn: OperationFunction | ShortOperationFunction;
  }[] = [
    { name: 'Quote', fn: runQuote },
    { name: 'Initialize Pool', fn: runInitializePool },
    { name: 'Add Liquidity', fn: runAddLiquidity },
    { name: 'Settle', fn: runSettle },
    { name: 'Cancel', fn: runCancel },
    { name: 'Slash', fn: runSlash },
    { name: 'Remove Liquidity', fn: runRemoveLiquidity },
    { name: 'Settle From SOL', fn: runSettleFromSol },
    { name: 'Settle To SOL', fn: runSettleToSol },
    { name: 'Add Liquidity SOL', fn: runAddLiquiditySol },
    { name: 'Remove Liquidity SOL', fn: runRemoveLiquiditySol },
    { name: 'Initialize Pool SOL', fn: runInitializePoolSol },
  ];

  for (let i = 0; i < operations.length; i++) {
    const { name, fn } = operations[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 Running operation ${i + 1}/${operations.length}: ${name}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Check if function only accepts one parameter (ShortOperationFunction)
      if (fn.length === 1) {
        await (fn as ShortOperationFunction)(sdk);
      } else {
        await fn(sdk, connection, keypair, mode);
      }
      console.log(`✅ ${name} completed successfully!`);
    } catch (error) {
      console.error(`❌ ${name} failed:`, error);
      console.log(`⚠️  Continuing with next operation...`);
    }

    // Add 10-second pause between operations (except for the last one)
    if (i < operations.length - 1) {
      console.log(`\n⏳ Waiting 10 seconds before next operation...`);
      await sleep(10000);
    }
  }

  console.log(
    `\n🎉 ALL completed! All ${operations.length} operations have been executed.`,
  );
}

async function main() {
  try {
    // Parse CLI arguments
    const { operation, mode } = parseArgs();

    console.log(`🎯 Operation: ${operation}`);
    console.log(`🎯 Mode: ${mode}`);

    const connection = new Connection(RPC_ENDPOINT, 'processed' as Commitment);
    // Initialize SDK
    const sdk = await initializeSDK();
    const userKeypair = loadPrivateKey('user.json');
    const settlerKeypair = loadPrivateKey('settler.json');

    console.log('operation', operation);
    console.log('mode', mode);

    // Route to appropriate function based on operation
    switch (operation) {
      case 'quote':
        await runQuote(sdk);
        break;
      case 'settle':
        await runSettle(sdk, connection, userKeypair, mode);
        break;
      case 'cancel':
        await runCancel(sdk, connection, userKeypair, mode);
        break;
      case 'slash':
        await runSlash(sdk, connection, userKeypair, mode);
        break;
      case 'addLiquidity':
        await runAddLiquidity(sdk, connection, userKeypair, mode);
        break;
      case 'removeLiquidity':
        await runRemoveLiquidity(sdk, connection, userKeypair, mode);
        break;
      case 'initializePool':
        await runInitializePool(sdk, connection, userKeypair, mode);
        break;
      case 'settleFromSol':
        await runSettleFromSol(sdk, connection, userKeypair, mode);
        break;
      case 'settleToSol':
        await runSettleToSol(sdk, connection, userKeypair, mode);
        break;
      case 'addLiquiditySol':
        await runAddLiquiditySol(sdk, connection, userKeypair, mode);
        break;
      case 'removeLiquiditySol':
        await runRemoveLiquiditySol(sdk, connection, userKeypair, mode);
        break;
      case 'initializePoolSol':
        await runInitializePoolSol(sdk, connection, userKeypair, mode);
        break;
      case 'all':
        await runAll(sdk, connection, userKeypair, mode);
        break;
      default:
        console.error(`❌ Unknown operation: ${operation}`);
        process.exit(1);
    }

    console.log('\n🎉 Operation completed successfully!');
  } catch (error) {
    console.error('❌ Error occurred:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
