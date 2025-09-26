# Darklake SDK Examples

This directory contains practical examples demonstrating how to use the Darklake SDK for on-chain operations.

## Examples

### Main Example (`main.ts`)

A comprehensive CLI tool that demonstrates various Darklake SDK operations with different execution modes.

**Usage:**
```bash
npm start <operation> <mode>
```

**Operations:**
- `settle` - Settle an existing order
- `cancel` - Cancel an existing order  
- `slash` - Slash an expired order
- `addLiquidity` - Add liquidity to a pool (placeholder)
- `removeLiquidity` - Remove liquidity from a pool (placeholder)
- `initializePool` - Initialize a new pool (placeholder)

**Modes:**
- `ix` - Generate instruction only (no transaction execution)
- `tx` - Generate and execute full transaction

**Examples:**
```bash
# Generate settle instruction only
npm run settle:ix

# Execute settle transaction
npm run settle:tx

# Generate cancel instruction only  
npm run cancel:ix

# Execute cancel transaction
npm run cancel:tx

# Generate slash instruction only
npm run slash:ix

# Execute slash transaction
npm run slash:tx
```

### Swap Example (`swap-example.ts`)

Demonstrates how to:
- Initialize the Darklake SDK
- Load a trading pool
- Get a quote for a swap
- Generate a swap transaction
- Handle transaction parameters and metadata

## Setup

1. Install dependencies:
```bash
cd examples
npm install
```

2. Build the examples:
```bash
npm run build
```

3. Run the swap example:
```bash
npm run example:swap
```

Or run directly with ts-node:
```bash
npx ts-node swap-example.ts
```

## Configuration

The examples use the following default configuration:

- **RPC Endpoint**: `https://api.devnet.solana.com` (Solana Devnet)
- **Token Mint X**: `DdLxrGFs2sKYbbqVk76eVx9268ASUdTMAhrsqphqDuX`
- **Token Mint Y**: `HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY`

You can modify these values in the example files as needed.

## Key Features Demonstrated

1. **SDK Initialization**: Shows how to create a new DarklakeSDK instance
2. **Pool Loading**: Demonstrates loading a trading pool by token mints
3. **Quote Generation**: Shows how to get price quotes before swapping
4. **Transaction Building**: Illustrates building swap transactions with proper parameters
5. **Error Handling**: Includes comprehensive error handling and logging

## Transaction Flow

1. Initialize SDK with RPC endpoint and configuration
2. Load the trading pool for the specified token pair
3. Get a quote for the desired swap amount
4. Calculate minimum output amount with slippage tolerance
5. Generate the swap transaction with all necessary instructions
6. Return transaction details including order key and metadata

## Notes

- The examples use mock wallet addresses for demonstration purposes
- In production, you would use real wallet keypairs for signing transactions
- The examples include detailed logging to help understand the process
- Error handling is comprehensive to help with debugging

## Next Steps

After running the examples:

1. **Sign Transactions**: Use a real wallet to sign the generated transactions
2. **Send Transactions**: Submit signed transactions to the Solana network
3. **Monitor Status**: Track transaction and order status using the returned order key
4. **Handle Results**: Process successful swaps or handle failures appropriately
