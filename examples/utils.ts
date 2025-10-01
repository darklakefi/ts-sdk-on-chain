import { DarklakeSDK, Order } from '@darklake/ts-sdk-on-chain';
import {
  AccountInfo,
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from '@solana/spl-token';

export async function getAddressLookupTable(
  tableAddress: PublicKey,
  connection: Connection,
): Promise<AddressLookupTableAccount> {
  const altAccount = await connection.getAccountInfo(tableAddress);
  if (!altAccount) {
    throw new Error('Failed to get address lookup table');
  }

  const state = AddressLookupTableAccount.deserialize(altAccount.data);
  return new AddressLookupTableAccount({
    key: tableAddress,
    state,
  });
}

export async function retryGetOrderAccount(
  sdk: DarklakeSDK,
  user: PublicKey,
): Promise<Order | null> {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const order = await sdk.getOrder(user);

      if (order) {
        return order;
      }
    } catch (error) {
      throw new Error('Failed to get order account: ' + error);
    }

    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return null;
}

/**
 * Creates two new tokens and mints the specified amount to the provided keypair
 * @param connection - Solana connection
 * @param payer - Keypair to use for paying transaction fees and as the mint authority
 * @param amount - Amount to mint to the keypair (in token units, not lamports)
 * @returns Object containing the mint addresses of both tokens
 */
export async function createNewTokens(
  connection: Connection,
  payer: Keypair,
  amount: number,
): Promise<{ tokenMintX: PublicKey; tokenMintY: PublicKey }> {
  try {
    console.log(
      `🪙 Creating two new tokens and minting ${amount} to ${payer.publicKey.toString()}`,
    );

    // Create first token mint
    const tokenMintX = await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      9, // decimals
    );

    // Create second token mint
    const tokenMintY = await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      9, // decimals
    );

    console.log(`✅ Created token mint X: ${tokenMintX.toString()}`);
    console.log(`✅ Created token mint Y: ${tokenMintY.toString()}`);

    // Create associated token accounts for both tokens
    const tokenAccountX = await createAssociatedTokenAccount(
      connection,
      payer,
      tokenMintX,
      payer.publicKey,
    );

    const tokenAccountY = await createAssociatedTokenAccount(
      connection,
      payer,
      tokenMintY,
      payer.publicKey,
    );

    console.log(`✅ Created token account X: ${tokenAccountX.toString()}`);
    console.log(`✅ Created token account Y: ${tokenAccountY.toString()}`);

    // Mint tokens to the accounts
    const mintAmount = amount * Math.pow(10, 9); // Convert to token units (9 decimals)

    await mintTo(
      connection,
      payer,
      tokenMintX,
      tokenAccountX,
      payer,
      mintAmount,
    );

    await mintTo(
      connection,
      payer,
      tokenMintY,
      tokenAccountY,
      payer,
      mintAmount,
    );

    console.log(
      `✅ Minted ${amount} tokens of each type to ${payer.publicKey.toString()}`,
    );

    return {
      tokenMintX,
      tokenMintY,
    };
  } catch (error) {
    console.error('❌ Failed to create tokens:', error);
    throw error;
  }
}

/**
 * Creates a WSOL Associated Token Account and wraps the specified amount of SOL to WSOL
 * @param connection - Solana connection
 * @param payer - Keypair to use for paying transaction fees and as the owner
 * @param amount - Amount of SOL to wrap (in lamports)
 * @returns Object containing the WSOL ATA address and the instructions for creation and wrapping
 */
export async function createWsolAccountAndWrap(
  payer: Keypair,
  amount: number,
): Promise<{
  wsolAccount: PublicKey;
  createWsolAtaIx: any;
  transferSolIx: any;
  syncNativeIx: any;
}> {
  try {
    console.log(
      `🔄 Creating WSOL ATA and wrapping ${amount} lamports of SOL to WSOL...`,
    );

    // Get the WSOL Associated Token Account address
    const { wsolAccount, createWsolAtaIx } = await createWsolAccountIx(payer);

    // Transfer SOL to the WSOL ATA (this creates the native SOL balance in the ATA)
    const transferSolIx = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: wsolAccount,
      lamports: amount,
    });

    // Sync the native SOL balance to the token account (this wraps SOL to WSOL)
    const syncNativeIx = createSyncNativeInstruction(wsolAccount);

    console.log(`✅ WSOL ATA created at: ${wsolAccount.toString()}`);
    console.log(
      `✅ Instructions prepared for wrapping ${amount} lamports of SOL to WSOL`,
    );

    return {
      wsolAccount,
      createWsolAtaIx,
      transferSolIx,
      syncNativeIx,
    };
  } catch (error) {
    console.error('❌ Failed to create WSOL account and wrap SOL:', error);
    throw error;
  }
}

/**
 * Creates a WSOL Associated Token Account for remove liquidity operations
 * @param payer - Keypair to use for paying transaction fees and as the owner
 * @returns Object containing the WSOL ATA address and the instruction for creation
 */
export async function createWsolAccountIx(
  payer: Keypair,
): Promise<{ wsolAccount: PublicKey; createWsolAtaIx: any }> {
  try {
    console.log(`🔄 Creating WSOL ATA for remove liquidity operation...`);

    // Get the WSOL Associated Token Account address
    const wsolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      payer.publicKey,
    );

    // Create the WSOL ATA instruction (idempotent - won't fail if it already exists)
    const createWsolAtaIx =
      await createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        wsolAccount,
        payer.publicKey,
        NATIVE_MINT,
      );

    console.log(`✅ WSOL ATA created at: ${wsolAccount.toString()}`);

    return {
      wsolAccount,
      createWsolAtaIx,
    };
  } catch (error) {
    console.error(
      '❌ Failed to create WSOL account for remove liquidity:',
      error,
    );
    throw error;
  }
}

/**
 * Unwraps WSOL and closes the ATA account after remove liquidity operations
 * @param payer - Keypair to use for paying transaction fees and as the owner
 * @returns Object containing the instructions for unwrapping and closing
 */
export async function unwrapWsolAndCloseAccountIx(
  payer: Keypair,
): Promise<{ syncNativeIx: any; closeAccountIx: any }> {
  try {
    console.log(`🔄 Unwrapping WSOL and closing ATA account...`);

    // Get the WSOL Associated Token Account address
    const wsolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      payer.publicKey,
    );

    // Sync the native SOL balance to the token account (this unwraps WSOL to SOL)
    const syncNativeIx = createSyncNativeInstruction(wsolAccount);

    // Close the WSOL token account
    const closeAccountIx = createCloseAccountInstruction(
      wsolAccount, // account
      payer.publicKey, // destination
      payer.publicKey, // owner
      [], // multisig signers
    );

    console.log(
      `✅ Instructions prepared for unwrapping WSOL and closing ATA account`,
    );

    return {
      syncNativeIx,
      closeAccountIx,
    };
  } catch (error) {
    console.error('❌ Failed to unwrap WSOL and close account:', error);
    throw error;
  }
}
