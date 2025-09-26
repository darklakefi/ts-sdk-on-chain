import { PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';

export const MAX_PERCENTAGE = new BN(1000000); // 10^6 = 100%

// Program IDs
export const DARKLAKE_PROGRAM_ID = new PublicKey('darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1');
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111111');
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Fee vaults
export const DEVNET_CREATE_POOL_FEE_VAULT = new PublicKey('6vUjEKC5mkiDMdMhkxV8SYzPQAk39aPKbjGataVnkUss');
export const MAINNET_CREATE_POOL_FEE_VAULT = new PublicKey('HNQdnRgtnsgcx7E836nZ1JwrQstWBEJMnRVy8doY366A');

// Seeds
export const POOL_SEED = 'pool';
export const AMM_CONFIG_SEED = 'amm_config';
export const AUTHORITY_SEED = 'authority';
export const POOL_WSOL_RESERVE_SEED = 'pool_wsol_reserve';
export const ORDER_SEED = 'order';
export const LIQUIDITY_SEED = 'lp';
export const ORDER_WSOL_SEED = 'order_wsol';
export const METADATA_SEED = 'metadata';
export const POOL_RESERVE_SEED = 'pool_reserve';

// Address lookup tables
export const DEVNET_LOOKUP = new PublicKey('fUT5cRYT7RTS4kSq7ZpPwqaH7E68soubbutFxYHeNjo');
export const MAINNET_LOOKUP = new PublicKey('2h3Sz2G84TcrqWc3FAyRZjjf5aCExMKM5sG3fh1bBXSg');

// Derived addresses
export const AMM_CONFIG = PublicKey.findProgramAddressSync(
  [Buffer.from(AMM_CONFIG_SEED), Buffer.from([0, 0, 0, 0])],
  DARKLAKE_PROGRAM_ID
)[0];

export const AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from(AUTHORITY_SEED)],
  DARKLAKE_PROGRAM_ID
)[0];
