import { AccountMeta, PublicKey } from "@solana/web3.js";

interface DarklakeAmmSwapAccounts {
    user: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintWsol: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    ammConfig: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountWsol: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    poolWsolReserve: PublicKey;
    order: PublicKey;
    associatedTokenProgram: PublicKey;
    systemProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmSwapAccounts = (accounts: DarklakeAmmSwapAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.user,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintWsol,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolWsolReserve,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.order,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}

interface DarklakeAmmSettleAccounts {
    caller: PublicKey;
    orderOwner: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintWsol: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    poolWsolReserve: PublicKey;
    ammConfig: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountWsol: PublicKey;
    callerTokenAccountWsol: PublicKey;
    order: PublicKey;
    orderTokenAccountWsol: PublicKey;
    systemProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmSettleAccounts = (accounts: DarklakeAmmSettleAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.caller,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.orderOwner,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintWsol,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolWsolReserve,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.callerTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.order,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.orderTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}


interface DarklakeAmmCancelAccounts {
    caller: PublicKey;
    orderOwner: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintWsol: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    poolWsolReserve: PublicKey;
    ammConfig: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountWsol: PublicKey;
    callerTokenAccountWsol: PublicKey;
    order: PublicKey;
    systemProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmCancelAccounts = (accounts: DarklakeAmmCancelAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.caller,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.orderOwner,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintWsol,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolWsolReserve,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.callerTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.order,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}


interface DarklakeAmmSlashAccounts {
    caller: PublicKey;
    orderOwner: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintWsol: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    poolWsolReserve: PublicKey;
    ammConfig: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    callerTokenAccountWsol: PublicKey;
    order: PublicKey;
    systemProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmSlashAccounts = (accounts: DarklakeAmmSlashAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.caller,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.orderOwner,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintWsol,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolWsolReserve,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.callerTokenAccountWsol,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.order,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}

interface DarklakeAmmAddLiquidityAccounts {
    user: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintLp: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    ammConfig: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountLp: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    associatedTokenProgram: PublicKey;
    systemProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmAddLiquidityAccounts = (accounts: DarklakeAmmAddLiquidityAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.user,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}

interface DarklakeAmmRemoveLiquidityAccounts {
    user: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    ammConfig: PublicKey;
    tokenMintLp: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountLp: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    associatedTokenProgram: PublicKey;
    systemProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmRemoveLiquidityAccounts = (accounts: DarklakeAmmRemoveLiquidityAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.user,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}


interface DarklakeAmmInitializePoolAccounts {
    user: PublicKey;
    pool: PublicKey;
    authority: PublicKey;
    ammConfig: PublicKey;
    tokenMintX: PublicKey;
    tokenMintY: PublicKey;
    tokenMintLp: PublicKey;
    tokenMintWsol: PublicKey;
    metadataAccount: PublicKey;
    metadataAccountX: PublicKey;
    metadataAccountY: PublicKey;
    userTokenAccountX: PublicKey;
    userTokenAccountY: PublicKey;
    userTokenAccountLp: PublicKey;
    poolTokenReserveX: PublicKey;
    poolTokenReserveY: PublicKey;
    poolWsolReserve: PublicKey;
    createPoolFeeVault: PublicKey;
    mplProgram: PublicKey;
    systemProgram: PublicKey;
    rent: PublicKey;
    associatedTokenProgram: PublicKey;
    tokenMintXProgram: PublicKey;
    tokenMintYProgram: PublicKey;
    tokenProgram: PublicKey;
}

export const getDarklakeAmmInitializePoolAccounts = (accounts: DarklakeAmmInitializePoolAccounts): Array<AccountMeta> => {
    return [
        {
            pubkey: accounts.user,
            isSigner: true,
            isWritable: true
        },
        {
            pubkey: accounts.pool,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.authority,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.ammConfig,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintWsol,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.metadataAccount,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.metadataAccountX,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.metadataAccountY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.userTokenAccountX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.userTokenAccountLp,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveX,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolTokenReserveY,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.poolWsolReserve,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.createPoolFeeVault,
            isSigner: false,
            isWritable: true
        },
        {
            pubkey: accounts.mplProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.systemProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.rent,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.associatedTokenProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintXProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenMintYProgram,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: accounts.tokenProgram,
            isSigner: false,
            isWritable: false
        }
    ]
}