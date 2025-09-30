# Darklake SDK Examples

This directory contains practical examples demonstrating how to use the Darklake SDK for on-chain operations.

## Understanding SDK Function Modes

The Darklake SDK provides two types of functions for each operation:

### Transaction Functions (ending with 'tx')

- **Purpose**: Return complete `VersionedTransaction` objects ready to be signed and sent
- **Features**:
  - Automatically handle SOL/WSOL wrapping
  - Include all necessary instructions
  - Automatically call `loadPool` and `updateAccounts` internally
  - No manual state management required
- **Use Case**: When you want a complete, ready-to-execute transaction

### Instruction Functions (ending with 'ix')

- **Purpose**: Return `TransactionInstruction` objects for manual transaction building
- **Features**:
  - More granular control over transaction construction
  - Require manual state management
  - Must call `loadPool` before starting pool usage
  - Must call `updateAccounts` before each instruction call
- **Use Case**: When you need fine-grained control or want to combine with other instructions

**Important**: When using instruction functions, you are responsible for calling `loadPool` and `updateAccounts` before starting pool usage, and `updateAccounts` before each further call.

## Available Scripts

### Core Operations

#### Order Flow

- **`settle:ix`** / **`settle:tx`** - Settle an existing order
- **`cancel:ix`** / **`cancel:tx`** - Cancel an existing order
- **`slash:ix`** / **`slash:tx`** - Slash an expired order

#### Liquidity Management

- **`addLiquidity:ix`** / **`addLiquidity:tx`** - Add liquidity to a pool
- **`removeLiquidity:ix`** / **`removeLiquidity:tx`** - Remove liquidity from a pool
- **`initializePool:ix`** / **`initializePool:tx`** - Initialize a new pool

### Operations with SOL

#### SOL Order Flow

- **`settleFromSol:ix`** / **`settleFromSol:tx`** - Settle an order from SOL
- **`settleToSol:ix`** / **`settleToSol:tx`** - Settle an order to SOL

#### SOL Liquidity Management

- **`addLiquiditySol:ix`** / **`addLiquiditySol:tx`** - Add liquidity with SOL
- **`removeLiquiditySol:ix`** / **`removeLiquiditySol:tx`** - Remove liquidity to SOL
- **`initializePoolSol:ix`** / **`initializePoolSol:tx`** - Initialize pool with SOL

### Utility Operations

- **`quote`** - Get a price quote for a swap (no mode required)
- **`all:ix`** / **`all:tx`** - Run all operations sequentially with 10s pauses

## Usage Examples

### Basic Usage

```bash
# Generate instruction only (no transaction execution)
npm run settle:ix
npm run addLiquidity:ix
npm run initializePoolSol:ix

# Execute full transaction
npm run settle:tx
npm run addLiquidity:tx
npm run initializePoolSol:tx

# Get a quote
npm run quote
```

### SOL Operations

```bash
# SOL-specific operations
npm run settleFromSol:tx
npm run addLiquiditySol:ix
npm run removeLiquiditySol:tx
```

### Batch Operations

```bash
# Run all operations in instruction mode
npm run all:ix

# Run all operations in transaction mode
npm run all:tx
```

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

3. Run any script:

```bash
npm run <script-name>
```

## Configuration

The examples use the following default configuration:

- **RPC Endpoint**: `https://api.devnet.solana.com` (Solana Devnet)
- **Token Mint X**: `DdLxrGFs2sKYbbqVk76eVx9268ASUdTMAhrsqphqDuX`
- **Token Mint Y**: `HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY`

You can modify these values in the example files as needed.

## Transaction Flow

### For Transaction Functions (tx mode):

1. Initialize SDK with RPC endpoint and configuration
2. Load the trading pool for the specified token pair (automatic)
3. Get a quote for the desired operation
4. Generate the complete transaction with all necessary instructions
5. Return transaction details ready for signing and sending

### For Instruction Functions (ix mode):

1. Initialize SDK with RPC endpoint and configuration
2. **Manually** load the pool data: `await sdk.loadPool(tokenMintX, tokenMintY)`
3. **Manually** update accounts: `await sdk.updateAccounts()`
4. Generate the instruction with proper parameters
5. Construct a versioned transaction
6. Sign and send

Note. **Before any subsequent ...ix() call if pool does not change**: `await sdk.updateAccounts()`

## Script Categories

### Order Management Scripts

These scripts handle swap order lifecycle:

- `settle:ix/tx` - Complete a swap order
- `cancel:ix/tx` - Cancel a pending order
- `slash:ix/tx` - Slash an expired order
- `settleFromSol:ix/tx` - Settle order from SOL
- `settleToSol:ix/tx` - Settle order to SOL

### Liquidity Management Scripts

These scripts handle pool liquidity:

- `addLiquidity:ix/tx` - Add liquidity to existing pool
- `removeLiquidity:ix/tx` - Remove liquidity from pool
- `initializePool:ix/tx` - Create new liquidity pool
- `addLiquiditySol:ix/tx` - Add liquidity with SOL
- `removeLiquiditySol:ix/tx` - Remove liquidity to SOL
- `initializePoolSol:ix/tx` - Initialize pool with SOL

### Utility Scripts

- `quote` - Get price quotes without executing transactions
- `all:ix/tx` - Run all operations in sequence for testing

## Notes

- The examples use mock wallet addresses for demonstration purposes
- In production, you would use real wallet keypairs for signing transactions
- The examples include detailed logging to help understand the process
- Error handling is comprehensive to help with debugging
- Instruction functions require manual state management
- Transaction functions handle state management automatically

## Next Steps

After running the examples:

1. **Sign Transactions**: Use a real wallet to sign the generated transactions
2. **Send Transactions**: Submit signed transactions to the Solana network
3. **Monitor Status**: Track transaction and order status using the returned order key
4. **Handle Results**: Process successful operations or handle failures appropriately
5. **Integrate**: Use the patterns shown in your own applications

## Understanding the Difference

- **Use `ix` mode** when you need more transaction control:
  - Combine multiple instructions in a single transaction
  - Have fine-grained control over transaction construction
  - Integrate with other Solana programs
  - Build custom transaction flows

- **Use `tx` mode** when you want simplified flow:
  - Execute operations easily
  - Let the SDK handle all the complexity of pool management
  - Focus on business logic rather than transaction construction
  - Sign and send
