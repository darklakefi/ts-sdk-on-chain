import { DarklakeSDK, Order } from "@darklake/ts-sdk-on-chain";
import { AccountInfo, AddressLookupTableAccount, Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, createAssociatedTokenAccount, mintTo, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

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
      state
     });
  }

  export async function retryGetOrderAccount(sdk: DarklakeSDK, user: PublicKey): Promise<Order | null> {
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
        await new Promise(resolve => setTimeout(resolve, retryDelay));
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
    amount: number
  ): Promise<{ tokenMintX: PublicKey; tokenMintY: PublicKey }> {
    try {
      console.log(`🪙 Creating two new tokens and minting ${amount} to ${payer.publicKey.toString()}`);

      // Create first token mint
      const tokenMintX = await createMint(
        connection,
        payer,
        payer.publicKey, // mint authority
        payer.publicKey, // freeze authority
        9 // decimals
      );

      // Create second token mint
      const tokenMintY = await createMint(
        connection,
        payer,
        payer.publicKey, // mint authority
        payer.publicKey, // freeze authority
        9 // decimals
      );

      console.log(`✅ Created token mint X: ${tokenMintX.toString()}`);
      console.log(`✅ Created token mint Y: ${tokenMintY.toString()}`);

      // Create associated token accounts for both tokens
      const tokenAccountX = await createAssociatedTokenAccount(
        connection,
        payer,
        tokenMintX,
        payer.publicKey
      );

      const tokenAccountY = await createAssociatedTokenAccount(
        connection,
        payer,
        tokenMintY,
        payer.publicKey
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
        mintAmount
      );

      await mintTo(
        connection,
        payer,
        tokenMintY,
        tokenAccountY,
        payer,
        mintAmount
      );

      console.log(`✅ Minted ${amount} tokens of each type to ${payer.publicKey.toString()}`);

      return {
        tokenMintX,
        tokenMintY
      };

    } catch (error) {
      console.error('❌ Failed to create tokens:', error);
      throw error;
    }
  }