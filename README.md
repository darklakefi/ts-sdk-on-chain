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
npm install @darklake/sdk-on-chain
```

## Quick Start

### Basic Setup

```typescript
import { DarklakeSDK, CommitmentLevel, PublicKey, BN } from '@darklake/ts-sdk-on-chain';

// Initialize the SDK
const sdk = new DarklakeSDK(
  'https://api.devnet.solana.com', // RPC endpoint
  CommitmentLevel.Confirmed,        // Commitment level
  true,                            // isDevnet
  'my-app',                        // label (optional, max 10 chars)
  'ref123'                         // ref code (optional, max 20 chars)
);
```

### Trading (Swap)

```typescript
import { PublicKey, BN } from '@solana/web3.js';

// Get a quote
const tokenIn = new PublicKey('So11111111111111111111111111111111111111111'); // SOL
const tokenOut = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
const amountIn = new BN(1000000000); // 1 SOL in lamports

const quote = await sdk.quote(tokenIn, tokenOut, amountIn);
console.log(`Expected output: ${quote.outAmount.toString()} USDC`);

// Create swap transaction
const [swapTx, orderKey, minOut, salt] = await sdk.swapTx(
  tokenIn,
  tokenOut,
  amountIn,
  new BN(quote.outAmount.muln(0.95)), // 5% slippage tolerance
  userPublicKey
);

// Sign and send transaction
const signedTx = await wallet.signTransaction(swapTx);
const signature = await connection.sendTransaction(signedTx);
```

### Finalizing Swaps

```typescript
// Finalize the swap (settle or cancel)
const finalizeTx = await sdk.finalizeTx(
  orderKey,
  true,  // unwrap WSOL to SOL
  minOut,
  salt
);

const signedFinalizeTx = await wallet.signTransaction(finalizeTx);
const finalizeSignature = await connection.sendTransaction(signedFinalizeTx);
```

### Liquidity Management

```typescript
// Add liquidity to a pool
const addLiquidityTx = await sdk.addLiquidityTx(
  tokenX,
  tokenY,
  new BN(1000000000), // max amount X
  new BN(2000000000), // max amount Y
  new BN(1000000),    // LP tokens to mint
  userPublicKey
);

// Remove liquidity from a pool
const removeLiquidityTx = await sdk.removeLiquidityTx(
  tokenX,
  tokenY,
  new BN(500000000),  // min amount X
  new BN(1000000000), // min amount Y
  new BN(500000),     // LP tokens to burn
  userPublicKey
);
```

### Pool Initialization

```typescript
// Initialize a new pool
const initializePoolTx = await sdk.initializePoolTx(
  tokenX,
  tokenY,
  new BN(1000000000), // initial amount X
  new BN(2000000000), // initial amount Y
  userPublicKey
);
```

### Using Instructions Directly

For more control, you can use the instruction functions directly:

```typescript
// Load pool data
await sdk.loadPool(tokenX, tokenY);

// Update accounts
await sdk.updateAccounts();

// Create swap instruction
const swapParams = {
  sourceMint: tokenIn,
  destinationMint: tokenOut,
  tokenTransferAuthority: userPublicKey,
  inAmount: amountIn,
  swapMode: SwapMode.ExactIn,
  minOut: minAmountOut,
  salt: generateRandomSalt()
};

const swapInstruction = await sdk.swapIx(swapParams);

// Add to your custom transaction
const transaction = new Transaction().add(swapInstruction);
```

## API Reference

### DarklakeSDK Constructor

```typescript
new DarklakeSDK(
  rpcEndpoint: string,
  commitmentLevel: CommitmentLevel,
  isDevnet: boolean,
  label?: string,
  refCode?: string
)
```

**Parameters:**
- `rpcEndpoint`: Solana RPC endpoint URL
- `commitmentLevel`: Commitment level for RPC calls
- `isDevnet`: Whether using devnet (currently only devnet/mainnet supported)
- `label`: Optional application label (max 10 characters)
- `refCode`: Optional referral code (max 20 characters)

### Transaction Functions

#### `quote(tokenIn, tokenOut, amountIn): Promise<Quote>`
Get a quote for a swap operation.

#### `swapTx(tokenIn, tokenOut, amountIn, minAmountOut, tokenOwner): Promise<[VersionedTransaction, PublicKey, BN, Uint8Array]>`
Create a complete swap transaction. Returns the transaction, order key, minimum output amount, and salt.

#### `finalizeTx(orderKey, unwrapWsol, minOut, salt, settleSigner?): Promise<VersionedTransaction>`
Finalize a swap order by settling, canceling, or slashing it.

#### `addLiquidityTx(tokenX, tokenY, maxAmountX, maxAmountY, amountLp, user): Promise<VersionedTransaction>`
Add liquidity to a pool.

#### `removeLiquidityTx(tokenX, tokenY, minAmountX, minAmountY, amountLp, user): Promise<VersionedTransaction>`
Remove liquidity from a pool.

#### `initializePoolTx(tokenX, tokenY, amountX, amountY, user): Promise<VersionedTransaction>`
Initialize a new liquidity pool.

### Instruction Functions

#### `swapIx(swapParams): Promise<TransactionInstruction>`
Create a swap instruction.

#### `finalizeIx(finalizeParams): Promise<TransactionInstruction>`
Create a finalize instruction.

#### `addLiquidityIx(addLiquidityParams): Promise<TransactionInstruction>`
Create an add liquidity instruction.

#### `removeLiquidityIx(removeLiquidityParams): Promise<TransactionInstruction>`
Create a remove liquidity instruction.

#### `initializePoolIx(initializePoolParams): Promise<TransactionInstruction>`
Create an initialize pool instruction.

### State Management Functions

#### `loadPool(tokenX, tokenY): Promise<[PublicKey, PublicKey, PublicKey]>`
Load pool data for internal state tracking.

#### `updateAccounts(): Promise<void>`
Update internal state with latest chain data.

#### `getOrder(user, commitmentLevel): Promise<Order>`
Get order data for a user (bypasses internal cache).

## Important Notes

### SOL/WSOL Handling

The Darklake DEX does not support direct SOL pairs - only WSOL (Wrapped SOL) pairs are supported. The SDK automatically handles SOL/WSOL conversion:

- **Transaction Functions**: Automatically add wrap/unwrap instructions
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
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
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
