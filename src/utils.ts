import { 
  PublicKey, 
  Connection, 
  AddressLookupTableAccount,
  SystemProgram,
  TransactionInstruction
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  ExtensionType,
  Mint,
  TransferFeeConfig,
  TransferFeeConfigLayout,
  createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import BN from 'bn.js';
import { DEVNET_LOOKUP, MAINNET_LOOKUP } from './constants';

/**
 * Generate a random 8-byte salt for order uniqueness
 */
export function generateRandomSalt(): Uint8Array {
  const salt = new Uint8Array(8);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Convert string to bytes array with specified length
 */
export function convertStringToBytesArray(s: string, length: number): Uint8Array {
  if (s.length > length) {
    throw new Error(`String length must be less than or equal to ${length}.`);
  }
  
  const bytes = new Uint8Array(length);
  const stringBytes = new TextEncoder().encode(s);
  bytes.set(stringBytes);
  return bytes;
}

/**
 * Get address lookup table account
 */
export async function getAddressLookupTable(
  connection: Connection,
  isDevnet: boolean
): Promise<AddressLookupTableAccount> {
  const altPubkey = isDevnet ? DEVNET_LOOKUP : MAINNET_LOOKUP;
  
  const altAccount = await connection.getAccountInfo(altPubkey);
  if (!altAccount) {
    throw new Error('Failed to get address lookup table');
  }
  
   const state = AddressLookupTableAccount.deserialize(altAccount.data);
   return new AddressLookupTableAccount({
    key: altPubkey,
    state
   });
}

/**
 * Get wrap SOL to WSOL instructions
 */
export async function getWrapSolToWsolInstructions(
  payer: PublicKey,
  amountInLamports: BN
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  
  // 1. Create associated token account for WSOL (idempotent)
  const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, payer);
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer, // payer
    wsolAta, // ata
    payer, // owner
    NATIVE_MINT // mint
  );
  
  // 2. Transfer SOL to the ATA
  const transferSolIx = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: wsolAta,
    lamports: amountInLamports.toNumber()
  });
  
  // 3. Sync the ATA to mark it as wrapped
  const syncNativeIx = createSyncNativeInstruction(wsolAta);
  
  instructions.push(createAtaIx);
  instructions.push(transferSolIx);
  instructions.push(syncNativeIx);
  
  return instructions;
}

/**
 * Get close WSOL instructions
 */
export async function getCloseWsolInstructions(payer: PublicKey): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  
  const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, payer);
  
  // 1. Sync the ATA to ensure all lamports are accounted for
  const syncNativeIx = createSyncNativeInstruction(wsolAta);
  
  // 2. Close the WSOL token account
  const closeAccountIx = createCloseAccountInstruction(
    wsolAta, // account
    payer, // destination
    payer, // owner
    [] // multisig signers
  );
  
  instructions.push(syncNativeIx);
  instructions.push(closeAccountIx);
  
  return instructions;
}

/**
 * Calculate transfer fee for Token2022 tokens
 */
export function calculateTransferFee(
  transferFeeConfig: any,
  preFeeAmount: BN
): BN {
  if (!transferFeeConfig) {
    return new BN(0);
  }
  
  // This is a simplified implementation
  // In practice, you'd need to implement the full Token2022 transfer fee calculation
  const feeRate = transferFeeConfig.transferFeeBasisPoints || 0;
  const fee = preFeeAmount.muln(feeRate).divn(10000);
  return fee;
}

/**
 * Convert BN to Uint8Array (little endian)
 */
export function bnToUint8Array(value: BN, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const valueBytes = value.toArray('le', length);
  bytes.set(valueBytes);
  return bytes;
}

/**
 * Convert Uint8Array to BN (little endian)
 */
export function uint8ArrayToBigInt(bytes: Uint8Array): bigint {
  return BigInt(new BN(bytes, 'le').toString());
}
/**
 * Convert string to PublicKey, handling base58 and array formats
 */
export function toPublicKey(value: string | PublicKey | Uint8Array): PublicKey {
  if (value instanceof PublicKey) {
    return value;
  }
  
  if (typeof value === 'string') {
    return new PublicKey(value);
  }
  
  if (value instanceof Uint8Array) {
    return new PublicKey(value);
  }
  
  throw new Error('Invalid public key format');
}

/**
 * Sleep utility function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) {
        throw lastError;
      }
      await sleep(delayMs);
    }
  }
  
  throw lastError!;
}

export const TYPE_SIZE = 2
export const LENGTH_SIZE = 2

export function getExtensionData(extension: ExtensionType, tlvData: Buffer): Buffer | null {
  let extensionTypeIndex = 0
  while (extensionTypeIndex + TYPE_SIZE + LENGTH_SIZE <= tlvData.length) {
    const entryType = tlvData.readUInt16LE(extensionTypeIndex)
    const entryLength = tlvData.readUInt16LE(extensionTypeIndex + TYPE_SIZE)
    const typeIndex = extensionTypeIndex + TYPE_SIZE + LENGTH_SIZE
    if (entryType == extension) {
      return tlvData.slice(typeIndex, typeIndex + entryLength)
    }
    extensionTypeIndex = typeIndex + entryLength
  }
  return null
}

export function getTransferFeeConfig(mint: Mint): TransferFeeConfig | null {
  const extensionData = getExtensionData(ExtensionType.TransferFeeConfig, mint.tlvData)
  if (extensionData !== null) {
    return TransferFeeConfigLayout.decode(extensionData)
  } else {
    return null
  }
}