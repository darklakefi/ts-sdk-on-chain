// Global type declarations for packages without types

declare module 'snarkjs' {
  export * from 'snarkjs';
  export const groth16: {
    fullProve: (input: any, wasmPath: string, zkeyPath: string) => Promise<any>;
  };
}

declare module 'ffjavascript' {
  export interface BigInt {
    toString(): string;
    toJSON(): string;
  }

  export function buildBn128(): Promise<any>;
  export const utils: {
    unstringifyBigInts: (obj: any) => any;
    stringifyBigInts: (obj: any) => any;
  };
}

declare module 'circomlibjs' {
  export function poseidon(inputs: (bigint | string | number)[]): bigint;
  export function poseidonHash(inputs: (bigint | string | number)[]): bigint;
  export function buildPoseidon(): Promise<any>;
}
