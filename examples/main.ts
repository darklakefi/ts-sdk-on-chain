import { DarklakeSDK, PublicKey, Commitment, SwapMode, SwapParamsIx, DEVNET_LOOKUP, BN } from '@darklake/ts-sdk-on-chain';
import { Keypair, Connection, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { createNewTokens, getAddressLookupTable, retryGetOrderAccount } from './utils';

// Configuration
const RPC_ENDPOINT = "https://api.devnet.solana.com";
const TOKEN_MINT_X = "DdLxrGFs2sKYbbqVk76eVx9268ASUdTMAhrsqphqDuX";
const TOKEN_MINT_Y = "HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY";

const tokenMintX = new PublicKey(TOKEN_MINT_X);
const tokenMintY = new PublicKey(TOKEN_MINT_Y);

// Create a separate connection using RPC_ENDPOINT
const connection = new Connection(RPC_ENDPOINT, 'processed' as Commitment);
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
    console.log(`🔑 Loaded private key for wallet: ${keypair.publicKey.toString()}`);
    return keypair;
  } catch (error) {
    console.error('❌ Failed to load private key:', error);
    throw error;
  }
}

// CLI argument parsing
function parseArgs(): { operation: string; mode: string } {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Usage: npm start <operation> <mode>');
    console.error('   Operations: settle, cancel, slash, addLiquidity, removeLiquidity, initializePool');
    console.error('   Modes: ix (instruction only), tx (full transaction)');
    process.exit(1);
  }

  const operation = args[0];
  const mode = args[1];

  const validOperations = ['settle', 'cancel', 'slash', 'addLiquidity', 'removeLiquidity', 'initializePool'];
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
    null // refCode
  );

  console.log('✅ SDK initialized successfully');
  console.log(`📡 Connected to: ${RPC_ENDPOINT}`);
  console.log(`🏷️  SDK Label: test-app`);

  return sdk;
}

// Settle operation
async function runSettle(
  sdk: DarklakeSDK,
  connection: Connection,
  keypair: Keypair,
  mode: string
) {
  console.log('\n🔄 Running settle operation...');
  
  // For settle, we need an existing order - this is a simplified example
  // In practice, you'd need to provide an order key or get it from a previous swap
  
  if (mode === 'ix') {
    console.log('\n📊 Loading pool...');
    const [poolKey, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(tokenMintX, tokenMintY);
    await sdk.updateAccounts();

    // Generate settle instruction only
    const settleInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut: BigInt(10),
      salt: new Uint8Array(32), // This should be the actual salt from the order
      output: BigInt(100), // This should be the actual output from the order
      commitment: new Uint8Array(32), // This should be the actual commitment from the order
      deadline: BigInt(0), // This should be the actual deadline from the order
      currentSlot: BigInt(await connection.getSlot('processed')),
    });
    
    console.log('✅ Settle instruction generated successfully!');
  } else if (mode === 'tx') {
    console.log('Swap -> settle using the tx method...');

    const minOut = 10n;
    const inputAmount = 1000n;
    const swapResult = await sdk.swapTx(tokenMintX, tokenMintY, inputAmount, minOut, keypair.publicKey);

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`);
    
    console.log('Generating settle transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      false, // unwrapWsol
      minOut, // minOut - should be from actual order
      swapResult.salt, // salt - should be from actual order
      keypair.publicKey
    );
    console.log('✅ Settle transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(finalizeResult.tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
}

// Cancel operation
async function runCancel(sdk: DarklakeSDK, connection: Connection, keypair: Keypair, mode: string) {
  console.log('\n🔄 Running cancel operation...');
  
  if (mode === 'ix') {



    // Generate cancel instruction only
    const cancelInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut: BigInt(100), // Higher than output to trigger cancel
      salt: new Uint8Array(32),
      output: BigInt(10),
      commitment: new Uint8Array(32),
      deadline: BigInt(0),
      currentSlot: BigInt(await connection.getSlot('processed')),
    });
    
    console.log('✅ Cancel instruction generated successfully!');
    console.log(`📋 Instruction Program ID: ${cancelInstruction.programId.toString()}`);
    console.log(`📋 Instruction Data Length: ${cancelInstruction.data.length} bytes`);
    console.log(`📋 Instruction Keys: ${cancelInstruction.keys.length} accounts`);
  } else if (mode === 'tx') {
    console.log('Swap -> cancel using the tx method...');

    const minOut = 100000n;
    const inputAmount = 1000n;
    const swapResult = await sdk.swapTx(tokenMintX, tokenMintY, inputAmount, minOut, keypair.publicKey);

    const tx = swapResult.tx;
    tx.sign([keypair]);
    const swapSignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`);
    
    console.log('Generating cancel transaction...');
    const finalizeResult = await sdk.finalizeTx(
      swapResult.orderKey,
      false, // unwrapWsol
      minOut, // minOut - should be from actual order
      swapResult.salt, // salt - should be from actual order
      keypair.publicKey
    );
    console.log('✅ Cancel transaction generated successfully!');

    finalizeResult.tx.sign([keypair]);

    const finalizeSignature = await connection.sendTransaction(finalizeResult.tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`✅ Finalize transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${finalizeSignature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
}

// Slash operation
async function runSlash(sdk: DarklakeSDK, connection: Connection, keypair: Keypair, mode: string) {
  console.log('\n🔄 Running slash operation...');
  
  if (mode === 'ix') {

    const minOut = 10n;
    const salt = new Uint8Array(1);
    const inputAmount = 1000n;
    const swapParamsIx: SwapParamsIx = {
      sourceMint: tokenMintX,
      destinationMint: tokenMintY,
      tokenTransferAuthority: keypair.publicKey,
      inAmount: inputAmount,
      swapMode: SwapMode.ExactIn,
      minOut,
      salt,
    }

    await sdk.loadPool(tokenMintX, tokenMintY);
    await sdk.updateAccounts();

    const swapInstruction = await sdk.swapIx(swapParamsIx);
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 });

    let allSwapInstructions = [
      computeBudgetIx,
      swapInstruction,
    ];

    const addressLookupTableAccount = await getAddressLookupTable(tableAddress, connection);

    let recentBlockhash = await connection.getLatestBlockhash();
    const swapMessage = new TransactionMessage(
      {
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allSwapInstructions,
        payerKey: keypair.publicKey,
      }
    ).compileToV0Message([addressLookupTableAccount]);
    
    const swapVersionedTransaction = new VersionedTransaction(swapMessage);

    swapVersionedTransaction.sign([keypair]);
    const swapSignature = await connection.sendTransaction(swapVersionedTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Swap transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${swapSignature}?cluster=devnet`);


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
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate slash instruction only
    const slashInstruction = await sdk.finalizeIx({
      settleSigner: keypair.publicKey,
      orderOwner: keypair.publicKey,
      unwrapWsol: false,
      minOut,
      salt,
      output: BigInt(order.dOut.toString()),
      commitment: order.cMin,
      deadline: BigInt(order.deadline.toString()), // Past deadline to trigger slash
      currentSlot: BigInt((currentSlot + 1).toString()),
    });
    
    const allSlashInstructions = [
      slashInstruction,
    ];

    recentBlockhash = await connection.getLatestBlockhash();
    const slashMessage = new TransactionMessage(
      {
        recentBlockhash: recentBlockhash.blockhash,
        instructions: allSlashInstructions,
        payerKey: keypair.publicKey,
      }
    ).compileToV0Message([addressLookupTableAccount]);

    const slashVersionedTransaction = new VersionedTransaction(slashMessage);
    slashVersionedTransaction.sign([keypair]);
    const slashSignature = await connection.sendTransaction(slashVersionedTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Slash transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${slashSignature}?cluster=devnet`);

    console.log('✅ Slash instruction generated successfully!');

    
  } else if (mode === 'tx') {
    // Generate and execute slash transaction
    const finalizeResult = await sdk.finalizeTx(
      PublicKey.default,
      false,
      BigInt(10),
      new Uint8Array(32),
      keypair.publicKey
    );

    console.log('✅ Slash transaction generated successfully!');
    console.log(`📋 Transaction Version: ${finalizeResult.tx.version}`);

    // Sign and send transaction
    console.log('\n✍️  Signing transaction...');
    finalizeResult.tx.sign([keypair]);
    console.log('✅ Transaction signed successfully!');

    console.log('\n📤 Sending transaction to network...');
    const signature = await connection.sendTransaction(finalizeResult.tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`✅ Transaction sent successfully!`);
    console.log(`📝 Transaction Signature: ${signature}`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
}

// Add liquidity operation
async function runAddLiquidity(sdk: DarklakeSDK, connection: Connection, keypair: Keypair, mode: string) {
  console.log('\n🔄 Running add liquidity operation...');
  console.log('⚠️  Note: Add liquidity functionality is not fully implemented in the current SDK');
  
  if (mode === 'ix') {
    console.log('📋 Add liquidity instruction generation would go here');
    console.log('   This requires implementing the addLiquidityIx method in the SDK');
  } else if (mode === 'tx')     {
    console.log('Add liquidity using the tx method...');

    const maxAmountX = 100n;
    const maxAmountY = 200n;
    const amountLp = 10n;
    const addLiquidityResult = await sdk.addLiquidityTx(tokenMintX, tokenMintY, maxAmountX, maxAmountY, amountLp, keypair.publicKey);

    const tx = addLiquidityResult.tx;
    tx.sign([keypair]);
    const addLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
}

// Remove liquidity operation
async function runRemoveLiquidity(sdk: DarklakeSDK, connection: Connection, keypair: Keypair, mode: string) {
  console.log('\n🔄 Running remove liquidity operation...');
  console.log('⚠️  Note: Remove liquidity functionality is not fully implemented in the current SDK');
  
  if (mode === 'ix') {
    console.log('📋 Remove liquidity instruction generation would go here');
    console.log('   This requires implementing the removeLiquidityIx method in the SDK');
  } else if (mode === 'tx') {
    console.log('Remove liquidity using the tx method...');

    const minAmountX = 10n;
    const minAmountY = 20n;
    const amountLp = 1000n;
    const removeLiquidityResult = await sdk.removeLiquidityTx(tokenMintX, tokenMintY, minAmountX, minAmountY, amountLp, keypair.publicKey);

    const tx = removeLiquidityResult.tx;
    tx.sign([keypair]);
    const removeLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Remove liquidity transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${removeLiquiditySignature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
}

// Initialize pool operation
async function runInitializePool(sdk: DarklakeSDK, connection: Connection, keypair: Keypair, mode: string) {
  console.log('\n🔄 Running initialize pool operation...');
  console.log('⚠️  Note: Initialize pool functionality is not fully implemented in the current SDK');
  
  if (mode === 'ix') {
    console.log('📋 Initialize pool instruction generation would go here');
    console.log('   This requires implementing the initializePoolIx method in the SDK');
  } else if (mode === 'tx') {
    console.log('Add liquidity using the tx method...');

    const { tokenMintX, tokenMintY } = await createNewTokens(connection, keypair, 1000000);

    const amountX = 10000n;
    const amountY = 20000n;
    const initializePoolResult = await sdk.initializePoolTx(tokenMintX, tokenMintY, amountX, amountY, keypair.publicKey);

    const tx = initializePoolResult.tx;
    tx.sign([keypair]);
    const addLiquiditySignature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log(`✅ Add liquidity transaction sent successfully!`);
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${addLiquiditySignature}?cluster=devnet`);
  } else {
    throw new Error('Mode not implemented');
  }
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
