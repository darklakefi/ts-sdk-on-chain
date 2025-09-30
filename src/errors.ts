
// SDK-specific error codes
export enum ErrorCode {
  // Math library errors
  MathLibInputAmountTooSmall = 'MathLibInputAmountTooSmall',
  MathLibMathOverflow = 'MathLibMathOverflow',
  MathLibTradeTooBig = 'MathLibTradeTooBig',
  MathLibInsufficientPoolTokenXBalance = 'MathLibInsufficientPoolTokenXBalance',
  MathLibInsufficientPoolTokenYBalance = 'MathLibInsufficientPoolTokenYBalance',
  
  // SDK errors
  NetworkError = 'NetworkError',
  ValidationError = 'ValidationError',
  UnsupportedOperation = 'UnsupportedOperation',
}

// Custom error classes
export class DarklakeError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'DarklakeError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
  }

  static fromMathError(code: ErrorCode, context?: Record<string, any>): DarklakeError {
    const message = getErrorMessage(code);
    return new DarklakeError(code, message, context);
  }

  static fromNetworkError(error: Error, context?: Record<string, any>): DarklakeError {
    return new DarklakeError(ErrorCode.NetworkError, `Network error: ${error.message}`, context, error);
  }

  static fromValidationError(message: string, context?: Record<string, any>, originalError?: Error): DarklakeError {
    return new DarklakeError(ErrorCode.ValidationError, message, context, originalError);
  }

  static fromUnsupportedOperation(operation: string, context?: Record<string, any>): DarklakeError {
    return new DarklakeError(ErrorCode.UnsupportedOperation, `Operation not supported: ${operation}`, context);
  }
}

// Error message mapping
function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.MathLibInputAmountTooSmall]: 'Input amount is too small',
    [ErrorCode.MathLibMathOverflow]: 'Mathematical overflow occurred',
    [ErrorCode.MathLibTradeTooBig]: 'Trade amount is too large',
    [ErrorCode.MathLibInsufficientPoolTokenXBalance]: 'Insufficient pool token X balance',
    [ErrorCode.MathLibInsufficientPoolTokenYBalance]: 'Insufficient pool token Y balance',
    [ErrorCode.NetworkError]: 'Network error occurred',
    [ErrorCode.ValidationError]: 'Validation error',
    [ErrorCode.UnsupportedOperation]: 'Operation not supported',
  };
  
  return messages[code] || 'Unknown error';
}

// Helper function to check if an error is a DarklakeError
export function isDarklakeError(error: any): error is DarklakeError {
  return error instanceof DarklakeError;
}

// Helper function to create context for errors
export function createErrorContext(operation: string, params?: Record<string, any>): Record<string, any> {
  return {
    operation,
    timestamp: new Date().toISOString(),
    ...params,
  };
}
  