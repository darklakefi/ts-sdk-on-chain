import BN from 'bn.js';
import { MAX_PERCENTAGE } from './constants';
import { ErrorCode, DarklakeError, createErrorContext } from './errors';
import { TransferFee } from '@solana/spl-token';
import Decimal from 'decimal.js';

// Structs/Interfaces
export interface QuoteAmmConfig {
  tradeFeeRate: BN; // 10^6 = 100%
  protocolFeeRate: BN; // 10^6 = 100% (percentage of trade fee)
  ratioChangeToleranceRate: BN; // 10^6 = 100%
}

export interface SwapResultWithFromToLock {
  fromAmount: BN;
  toAmount: BN;
  tradeFee: BN;
  protocolFee: BN;
  fromToLock: BN;
}

export interface QuoteOutput {
  // post trade fees
  fromAmount: BN;
  toAmount: BN;
  tradeFee: BN;
  protocolFee: BN;
  fromToLock: BN;
}

export interface RebalanceResult {
  fromToLock: BN;
  isRateToleranceExceeded: boolean;
}

export interface SwapResult {
  /// Amount of source token swapped
  fromAmount: BN;
  /// Amount of destination token swapped
  toAmount: BN;
  tradeFee: BN;
  protocolFee: BN;
}

// Utility functions
export function checkedSub(a: BN, b: BN): BN {
  if (a.lt(b)) {
    throw DarklakeError.fromValidationError(
      'Mathematical underflow in subtraction',
      createErrorContext('checkedSub', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.sub(b);
}

export function checkedMul128(a: BN, b: BN): BN {
  if (a.mul(b).gt(new BN(2).pow(new BN(128)))) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('checkedMul128', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.mul(b);
}

export function checkedMul(a: BN, b: BN): BN {
  if (a.mul(b).gt(new BN(2).pow(new BN(64)))) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('checkedMul', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.mul(b);
}

export function checkedDiv(a: BN, b: BN): BN {
  if (b.eq(new BN(0))) {
    throw DarklakeError.fromValidationError(
      'Division by zero',
      createErrorContext('checkedDiv', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.div(b);
}

export function checkedAdd128(a: BN, b: BN): BN {
  if (a.add(b).gt(new BN(2).pow(new BN(128)))) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('checkedAdd128', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.add(b);
}

export function checkedAdd(a: BN, b: BN): BN {
  if (a.add(b).gt(new BN(2).pow(new BN(64)))) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('checkedAdd', { a: a.toString(), b: b.toString() }),
    );
  }
  return a.add(b);
}

export function check64Bit(a: BN): BN {
  if (a.gt(new BN(2).pow(new BN(64)))) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('check64Bit', { value: a.toString() }),
    );
  }
  return a;
}

function ceilDiv128(tokenAmount: BN, feeNumerator: BN, feeDenominator: BN): BN {
  try {
    const numerator = checkedMul128(tokenAmount, feeNumerator);
    const denominator = checkedSub(
      checkedAdd128(numerator, feeDenominator),
      new BN(1),
    );
    return checkedDiv(denominator, feeDenominator);
  } catch (e: any) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('ceilDiv128', {
        tokenAmount: tokenAmount.toString(),
        feeNumerator: feeNumerator.toString(),
        feeDenominator: feeDenominator.toString(),
        originalError: e.message,
      }),
    );
  }
}

export function floorDiv128(
  tokenAmount: BN,
  feeNumerator: BN,
  feeDenominator: BN,
): BN {
  try {
    return checkedDiv(checkedMul128(tokenAmount, feeNumerator), feeDenominator);
  } catch (e: any) {
    throw DarklakeError.fromMathError(
      ErrorCode.MathLibMathOverflow,
      createErrorContext('floorDiv128', {
        tokenAmount: tokenAmount.toString(),
        feeNumerator: feeNumerator.toString(),
        feeDenominator: feeDenominator.toString(),
        originalError: e.message,
      }),
    );
  }
}
// amount 128 bit, tradeFeeRate 64 bit -> convert to 128 bit
export function getTradeFee(amount: BN, tradeFeeRate: BN): BN {
  return ceilDiv128(amount, tradeFeeRate, MAX_PERCENTAGE);
}

// both 128 bit and return 128 bit
export function getProtocolFee(amount: BN, protocolFeeRate: BN): BN {
  return floorDiv128(amount, protocolFeeRate, MAX_PERCENTAGE);
}

// all 128 bit and return 128 bit
export function swapBaseInputWithoutFees(
  sourceAmount: BN,
  swapSourceAmount: BN,
  swapDestinationAmount: BN,
): BN {
  // (x + delta_x) * (y - delta_y) = x * y
  // delta_y = (delta_x * y) / (x + delta_x)
  const numerator = checkedMul128(sourceAmount, swapDestinationAmount);
  const denominator = checkedAdd128(swapSourceAmount, sourceAmount);
  return checkedDiv(numerator, denominator);
}

/// This is guaranteed to work for all values such that:
///  - 1 <= swap_source_amount * swap_destination_amount <= u128::MAX
///  - 1 <= source_amount <= u64::MAX
/// dev: invariant is increased due to ceil_div
/// dev: because of ceil_div the destination_amount_swapped is rounded down
export function swap(
  sourceAmount: BN, // 128bit
  poolSourceAmount: BN, // 128bit
  poolDestinationAmount: BN, // 128bit
  tradeFeeRate: BN, // 64bit
  protocolFeeRate: BN, // 64bit
): SwapResult {
  let sourceAmountPostFees: BN;
  let tradeFee: BN;
  let protocolFee: BN;
  let destinationAmountSwapped: BN;

  // all returns 128 bit
  tradeFee = getTradeFee(sourceAmount, tradeFeeRate);
  protocolFee = getProtocolFee(tradeFee, protocolFeeRate);
  sourceAmountPostFees = checkedSub(sourceAmount, tradeFee);
  destinationAmountSwapped = swapBaseInputWithoutFees(
    sourceAmountPostFees,
    poolSourceAmount,
    poolDestinationAmount,
  );

  return {
    fromAmount: check64Bit(sourceAmountPostFees),
    toAmount: check64Bit(destinationAmountSwapped),
    tradeFee: check64Bit(tradeFee),
    protocolFee: check64Bit(protocolFee),
  };
}

export function rebalancePoolRatio(
  toAmountSwapped: BN, // 64bit
  currentSourceAmount: BN, // 64bit
  currentDestinationAmount: BN, // 64bit
  originalSourceAmount: BN, // 64bit
  originalDestinationAmount: BN, // 64bit
  ratioChangeToleranceRate: BN, // 64bit
): RebalanceResult {
  if (
    toAmountSwapped.gte(currentDestinationAmount) ||
    currentSourceAmount.eq(new BN(0)) ||
    currentDestinationAmount.eq(new BN(0))
  ) {
    // Should never happen, but just in case
    return {
      fromToLock: new BN(0),
      isRateToleranceExceeded: true,
    };
  }

  // Calculate the remaining destination amount after swap
  const remainingDestination = checkedSub(
    currentDestinationAmount,
    toAmountSwapped,
  );
  if (!remainingDestination) {
    return {
      fromToLock: new BN(0),
      isRateToleranceExceeded: true,
    };
  }

  // f64
  const originalRatio = new Decimal(originalSourceAmount.toString()).div(
    new Decimal(originalDestinationAmount.toString()),
  );

  // Calculate the exact floating-point value that would give us the perfect ratio
  // f64
  const exactFromToLock = new Decimal(currentSourceAmount.toString()).sub(
    new Decimal(remainingDestination.toString()).mul(originalRatio),
  );

  // Find the optimal integer from_to_lock by testing values around the exact value
  // u64
  let bestFromToLock = new BN(0);
  // f64
  let bestRatioDiff = new Decimal(Infinity);

  // Test a range of values around the exact value
  // u64
  const startVal = new BN(
    Decimal.max(0, exactFromToLock.sub(new Decimal(1))).toFixed(0),
  );
  // u64
  const endVal = new BN(
    Decimal.min(
      new Decimal(currentSourceAmount.toString()),
      Decimal.ceil(exactFromToLock.add(new Decimal(1))),
    ).toFixed(0),
  );

  for (
    let testFromToLock = startVal;
    testFromToLock <= endVal;
    testFromToLock = testFromToLock.add(new BN(1))
  ) {
    if (testFromToLock.gt(currentSourceAmount)) {
      continue;
    }

    const testFromToLockBN = new BN(testFromToLock);
    // u64
    const newSource = checkedSub(currentSourceAmount, testFromToLockBN);

    // f64
    const newRatio = new Decimal(newSource.toString()).div(
      new Decimal(remainingDestination.toString()),
    );
    // f64
    const ratioDiff = newRatio.sub(originalRatio).abs();

    if (ratioDiff.lt(bestRatioDiff) && !newRatio.isZero()) {
      bestRatioDiff = ratioDiff;
      bestFromToLock = testFromToLockBN;
    }
  }

  const fromToLock = bestFromToLock;
  const newSourceAmount = checkedSub(currentSourceAmount, fromToLock);
  const newRatio = new Decimal(newSourceAmount.toString()).div(
    new Decimal(remainingDestination.toString()),
  );

  // Calculate percentage change
  const percentageChange = newRatio
    .sub(originalRatio)
    .div(originalRatio.mul(new Decimal(100)))
    .abs();

  const tolerancePercentage = new Decimal(ratioChangeToleranceRate.toString())
    .div(new Decimal(MAX_PERCENTAGE.toString()))
    .mul(new Decimal(100));
  const isRateToleranceExceeded = percentageChange.gt(tolerancePercentage);

  return {
    fromToLock,
    isRateToleranceExceeded,
  };
}

/// Quote the output amount for a given input amount
///
/// # Arguments
/// * `exchangeIn` - The amount of input tokens after transfer fees
/// * `isSwapXToY` - Whether to swap X to Y
/// * `ammConfig` - The configuration of the AMM
/// * `protocolFeeX` - The accumulated protocol fee balance for X
/// * `protocolFeeY` - The accumulated protocol fee balance for Y
/// * `userLockedX` - The amount of X user funds locked in the pool
/// * `userLockedY` - The amount of Y user funds locked in the pool
/// * `lockedX` - The amount of X pool funds locked in the pool
/// * `lockedY` - The amount of Y pool funds locked in the pool
/// * `reserveXBalance` - The total balance of X in the pool
/// * `reserveYBalance` - The total balance of Y in the pool
export function quote(
  exchangeIn: BN,
  isSwapXToY: boolean,
  ammConfig: QuoteAmmConfig,
  protocolFeeX: BN,
  protocolFeeY: BN,
  userLockedX: BN,
  userLockedY: BN,
  lockedX: BN,
  lockedY: BN,
  reserveXBalance: BN,
  reserveYBalance: BN,
): QuoteOutput | ErrorCode {
  // exclude protocol fees / locked pool reserves / user pending orders

  let totalTokenXAmount: BN;
  let totalTokenYAmount: BN;
  let availableTokenXAmount: BN;
  let availableTokenYAmount: BN;

  try {
    totalTokenXAmount = checkedSub(
      checkedSub(reserveXBalance, userLockedX),
      protocolFeeX,
    );
    totalTokenYAmount = checkedSub(
      checkedSub(reserveYBalance, userLockedY),
      protocolFeeY,
    );

    availableTokenXAmount = checkedSub(totalTokenXAmount, lockedX);
    availableTokenYAmount = checkedSub(totalTokenYAmount, lockedY);
  } catch (error) {
    return ErrorCode.MathLibMathOverflow;
  }

  // the amount we receive excluding any outside transfer fees
  if (exchangeIn.eq(new BN(0))) {
    return ErrorCode.MathLibInputAmountTooSmall;
  }

  // Calculate the output amount using the constant product formula
  let resultAmounts: SwapResultWithFromToLock;

  if (isSwapXToY) {
    // Swap X to Y
    const swapResult = swap(
      exchangeIn,
      availableTokenXAmount,
      availableTokenYAmount,
      ammConfig.tradeFeeRate,
      ammConfig.protocolFeeRate,
    );

    const rebalanceResult = rebalancePoolRatio(
      swapResult.toAmount,
      availableTokenXAmount,
      availableTokenYAmount,
      totalTokenXAmount,
      totalTokenYAmount,
      ammConfig.ratioChangeToleranceRate,
    );

    if (rebalanceResult.isRateToleranceExceeded) {
      return ErrorCode.MathLibTradeTooBig;
    }

    // can't reserve to 0 or negative
    if (rebalanceResult.fromToLock.gte(availableTokenXAmount)) {
      return ErrorCode.MathLibInsufficientPoolTokenXBalance;
    }

    resultAmounts = {
      fromAmount: swapResult.fromAmount, // applied trade fee + transfer fee
      toAmount: swapResult.toAmount, // nothing applied
      fromToLock: rebalanceResult.fromToLock,
      tradeFee: swapResult.tradeFee,
      protocolFee: swapResult.protocolFee,
    };
  } else {
    // Swap Y to X
    const swapResult = swap(
      exchangeIn,
      availableTokenYAmount,
      availableTokenXAmount,
      ammConfig.tradeFeeRate,
      ammConfig.protocolFeeRate,
    );

    if (!swapResult) {
      return ErrorCode.MathLibMathOverflow;
    }

    const rebalanceResult = rebalancePoolRatio(
      swapResult.toAmount,
      availableTokenYAmount,
      availableTokenXAmount,
      totalTokenYAmount,
      totalTokenXAmount,
      ammConfig.ratioChangeToleranceRate,
    );

    if (!rebalanceResult) {
      return ErrorCode.MathLibMathOverflow;
    }

    if (rebalanceResult.isRateToleranceExceeded) {
      return ErrorCode.MathLibTradeTooBig;
    }

    // can't reserve to 0 or negative
    if (rebalanceResult.fromToLock.gt(availableTokenYAmount)) {
      return ErrorCode.MathLibInsufficientPoolTokenYBalance;
    }

    resultAmounts = {
      fromAmount: swapResult.fromAmount, // applied trade fee + transfer fee
      toAmount: swapResult.toAmount, // nothing applied
      fromToLock: rebalanceResult.fromToLock,
      tradeFee: swapResult.tradeFee,
      protocolFee: swapResult.protocolFee,
    };
  }

  return {
    fromAmount: resultAmounts.fromAmount,
    toAmount: resultAmounts.toAmount,
    tradeFee: resultAmounts.tradeFee,
    protocolFee: resultAmounts.protocolFee,
    fromToLock: resultAmounts.fromToLock,
  };
}

export function calculateTransferFee(
  amount: bigint,
  transferFee: TransferFee,
): { fee: bigint; net: bigint } {
  const { transferFeeBasisPoints: bps, maximumFee: maxFee } = transferFee;
  const feeFromRate = (amount * BigInt(bps)) / BigInt(10_000);
  const fee = feeFromRate > maxFee ? maxFee : feeFromRate;
  const net = amount - fee;
  return { fee, net };
}
