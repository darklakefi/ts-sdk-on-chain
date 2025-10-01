# Darklake DEX TypeScript SDK

A TypeScript client SDK for interacting with Darklake AMM pools on Solana. This SDK provides a clean interface for trading, liquidity provision, and pool management on the Darklake DEX.

## Features

- **Trading**: Swap tokens with automatic SOL/WSOL handling
- **Liquidity Management**: Add and remove liquidity from pools
- **Pool Management**: Initialize new pools
- **Order Management**: Handle swap orders with settlement and cancellation
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
pnpm install @darklakefi/ts-sdk-on-chain
```

## Quick Start

### Basic Setup

```typescript
import { DarklakeSDK, BN } from '@darklakefi/ts-sdk-on-chain';

// Initialize the SDK
const sdk = new DarklakeSDK(
  'https://api.devnet.solana.com', // RPC endpoint
  CommitmentLevel.Confirmed, // Commitment level
  true, // isDevnet
  'my-app', // label (optional, max 10 chars)
  'ref123', // ref code (optional, max 20 chars)
);
```

## Transaction Functions (ending with 'tx')

These functions return complete `VersionedTransaction` objects ready to be signed and sent. They automatically handle SOL/WSOL wrapping and include all necessary instructions. This includes `loadPool` and `updateAccounts` calls internally.

### `swapTx(tokenIn, tokenOut, amountIn, minAmountOut, tokenOwner)`

Creates a complete swap transaction.

```typescript
const { tx, orderKey, minOut, salt } = await sdk.swapTx(
  tokenIn, // PublicKey - input token mint
  tokenOut, // PublicKey - output token mint
  amountIn, // BN - input amount
  minAmountOut, // BN - minimum output amount
  tokenOwner, // PublicKey - token owner
);
```

### `finalizeTx(orderKey, unwrapWsol, minOut, salt, settleSigner?)`

Finalizes a swap order by settling, canceling, or slashing it.

```typescript
const { tx } = await sdk.finalizeTx(
  orderKey, // PublicKey - order key from swapTx
  true, // boolean - unwrap WSOL to SOL
  minOut, // BN - minimum output amount
  salt, // Uint8Array - salt from swapTx
  settleSigner, // PublicKey - optional settle signer
);
```

### `addLiquidityTx(tokenX, tokenY, maxAmountX, maxAmountY, amountLp, user)`

Adds liquidity to a pool.

```typescript
const { tx } = await sdk.addLiquidityTx(
  tokenX, // PublicKey - first token mint
  tokenY, // PublicKey - second token mint
  maxAmountX, // BN - maximum amount of token X
  maxAmountY, // BN - maximum amount of token Y
  amountLp, // BN - LP tokens to mint
  user, // PublicKey - user public key
);
```

### `removeLiquidityTx(tokenX, tokenY, minAmountX, minAmountY, amountLp, user)`

Removes liquidity from a pool.

```typescript
const { tx } = await sdk.removeLiquidityTx(
  tokenX, // PublicKey - first token mint
  tokenY, // PublicKey - second token mint
  minAmountX, // BN - minimum amount of token X to receive
  minAmountY, // BN - minimum amount of token Y to receive
  amountLp, // BN - LP tokens to burn
  user, // PublicKey - user public key
);
```

### `initializePoolTx(tokenX, tokenY, amountX, amountY, user)`

Initializes a new liquidity pool.

```typescript
const { tx } = await sdk.initializePoolTx(
  tokenX, // PublicKey - first token mint
  tokenY, // PublicKey - second token mint
  amountX, // BN - initial amount of token X
  amountY, // BN - initial amount of token Y
  user, // PublicKey - user public key
);
```

## Instruction Functions (ending with 'ix')

These functions return `TransactionInstruction` objects for manual transaction building. **Important**: When using instruction functions, you are responsible for calling `loadPool` and `updateAccounts` before starting pool usage, and `updateAccounts` before each further call.

### Prerequisites for Instruction Functions

```typescript
// Before using any instruction function, you MUST:
// 1. Load the pool data
await sdk.loadPool(tokenMintX, tokenMintY);

// 2. Update accounts with latest chain data
await sdk.updateAccounts();

// 3. For each subsequent ix calls, update accounts again
await sdk.updateAccounts();
```

### `swapIx(swapParamsIx)`

Creates a swap instruction.

```typescript
const swapParamsIx: SwapParamsIx = {
  sourceMint: tokenIn, // PublicKey
  destinationMint: tokenOut, // PublicKey
  tokenTransferAuthority: user, // PublicKey
  inAmount: amountIn, // BN
  swapMode: SwapMode.ExactIn, // SwapMode
  minOut: minAmountOut, // BN
  salt: generateRandomSalt(), // Uint8Array
};

const swapInstruction = await sdk.swapIx(swapParamsIx);
```

### `finalizeIx(finalizeParamsIx)`

Creates a finalize instruction (settle, cancel, or slash).

```typescript
const finalizeParamsIx: FinalizeParamsIx = {
  settleSigner: settleSigner, // PublicKey
  orderOwner: orderOwner, // PublicKey
  unwrapWsol: true, // boolean
  minOut: minOut, // BN
  salt: salt, // Uint8Array
  output: output, // BN
  commitment: commitment, // BN
  deadline: deadline, // BN
  currentSlot: currentSlot, // BN
};

const finalizeInstruction = await sdk.finalizeIx(finalizeParamsIx);
```

### `addLiquidityIx(addLiquidityParamsIx)`

Creates an add liquidity instruction.

```typescript
const addLiquidityParamsIx: AddLiquidityParamsIx = {
  user: user, // PublicKey
  amountLp: amountLp, // BN
  maxAmountX: maxAmountX, // BN
  maxAmountY: maxAmountY, // BN
};

const addLiquidityInstruction = await sdk.addLiquidityIx(addLiquidityParamsIx);
```

### `removeLiquidityIx(removeLiquidityParamsIx)`

Creates a remove liquidity instruction.

```typescript
const removeLiquidityParamsIx: RemoveLiquidityParamsIx = {
  user: user, // PublicKey
  amountLp: amountLp, // BN
  minAmountX: minAmountX, // BN
  minAmountY: minAmountY, // BN
};

const removeLiquidityInstruction = await sdk.removeLiquidityIx(
  removeLiquidityParamsIx,
);
```

### `initializePoolIx(initializePoolParamsIx)`

Creates an initialize pool instruction.

```typescript
const initializePoolParamsIx: InitializePoolParamsIx = {
  user: user, // PublicKey
  amountX: amountX, // BN
  amountY: amountY, // BN
  tokenX: tokenX, // PublicKey
  tokenXProgram: tokenXProgram, // PublicKey
  tokenY: tokenY, // PublicKey
  tokenYProgram: tokenYProgram, // PublicKey
};

const initializePoolInstruction = await sdk.initializePoolIx(
  initializePoolParamsIx,
);
```

## Utility Functions

### `getOrder(orderOwner)`

Gets a parsed order or null if not found. This function does not use internal state and pings directly the on-chain data.

```typescript
const order: Order | null = await sdk.getOrder(orderOwner);
if (order) {
  console.log('Order found:', order);
} else {
  console.log('No order found for this user');
}
```

### `sortTokens(tokenMintX, tokenMintY)`

Gets the order of tokens used by the DEX. Returns tokens in the correct order for pool operations.

```typescript
const [orderedTokenX, orderedTokenY] = sdk.sortTokens(tokenMintX, tokenMintY);
```

## State Management Functions

### `loadPool(tokenMintX, tokenMintY)`

Loads pool data for internal state tracking. **Required** before using instruction functions call when using `...ix()` functions.

```typescript
const [poolKey, orderedTokenMintX, orderedTokenMintY] = await sdk.loadPool(
  tokenMintX,
  tokenMintY,
);
```

### `updateAccounts()`

Updates internal state with latest chain data. **Required** before each instruction function call when using `...ix()` functions.

```typescript
await sdk.updateAccounts();
```

## Complete Trading Example

```typescript
import { DarklakeSDK, PublicKey, BN } from '@darklakefi/ts-sdk-on-chain';
import { Connection, Keypair } from '@solana/web3.js';

// Initialize SDK
const sdk = new DarklakeSDK(
  'https://api.devnet.solana.com',
  'confirmed',
  true,
  'my-app',
  'ref123',
);

// Setup
const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate();
const tokenIn = new PublicKey('So11111111111111111111111111111111111111111'); // SOL
const tokenOut = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
const amountIn = new BN(1000000000); // 1 SOL

// Get quote
const quote = await sdk.quote(tokenIn, tokenOut, amountIn);
console.log(`Expected output: ${quote.outAmount.toString()}`);

// Create swap transaction
const { tx, orderKey, minOut, salt } = await sdk.swapTx(
  tokenIn,
  tokenOut,
  amountIn,
  new BN(quote.outAmount.muln(0.95)), // 5% slippage
  wallet.publicKey,
);

// Sign and send
const signedTx = await wallet.signTransaction(tx);
const signature = await connection.sendTransaction(signedTx);
console.log('Swap transaction sent:', signature);

// Wait for confirmation, then finalize
await connection.confirmTransaction(signature);

const { tx: finalizeTx } = await sdk.finalizeTx(
  orderKey,
  true, // unwrap WSOL
  minOut,
  salt,
);

const signedFinalizeTx = await wallet.signTransaction(finalizeTx);
const finalizeSignature = await connection.sendTransaction(signedFinalizeTx);
console.log('Finalize transaction sent:', finalizeSignature);
```

## Important Notes

### Quote Return Structure

The `quote()` function returns a `Quote` object with the following structure:

```typescript
interface Quote {
  inAmount: BN; // Amount that the exchange will use to trade, calculated by subtracting ALL fees from the user input. So it's NOT the user input value.
  outAmount: BN; // The output amount from the exchange EXCLUDING any transfer fees imposed by the token itself (if it does so)
  feeAmount: BN; // The total amount of fees deducted by the exchange NOT including any fees imposed by tokens
  feeMint: PublicKey; // Pubkey address of a token in which the fees are charged
  feePct: BN; // The current total fee rate of the trade in percentage. Max value 1000000 = 100%
}
```

**Key Points:**

- `inAmount` is the actual amount used for trading after all exchange fees are deducted (both dex and token transfer fees if any)
- `outAmount` dex output, excludes any token-level transfer fees (e.g., USDC transfer fees)
- `feeAmount` only includes exchange fees, not token transfer fees
- `feePct` same feeAmount in basis points where 1000000 = 100%

### State Management Responsibility

When using instruction functions (ending with 'ix'), you are responsible for:

1. **Before starting pool usage**: Call `loadPool(tokenMintX, tokenMintY)`
2. **Before each instruction call**: Call `updateAccounts()`

This ensures the SDK has the latest pool and account data for accurate calculations.

### SOL/WSOL Handling

The Darklake DEX does not support direct SOL pairs - only WSOL (Wrapped SOL) pairs are supported:

- **Transaction Functions**: Automatically handle SOL/WSOL conversion
- **Instruction Functions**: Require manual handling of SOL/WSOL wrapping

### Versioned Transactions

The SDK uses Versioned Transactions by default for better performance and reduced transaction size.

### Address Lookup Tables

The SDK includes pre-configured address lookup tables for devnet and mainnet usage to optimize transaction size.

## Error Handling

The SDK throws descriptive errors for common issues:

```typescript
try {
  const quote = await sdk.quote(tokenIn, tokenOut, amountIn);
} catch (error) {
  if (error.message.includes('Pool not found')) {
    // Handle pool not found
  } else if (error.message.includes('Order not found')) {
    // Handle order not found
  }
  // Handle other errors
}
```

## Development

### Building

```bash
pnpm run build
```

### Linting

```bash
pnpm run lint
```

### Formatting

```bash
pnpm run format
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

- Check the examples in the repository
- Review the SDK source code
- Open an issue on the repository

---

**Note**: This SDK is for interacting with the Darklake DEX on Solana. Always test thoroughly on devnet before using on mainnet.
