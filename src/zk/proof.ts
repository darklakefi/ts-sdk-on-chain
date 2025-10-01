import * as snarkjs from 'snarkjs';
import * as path from 'path';
import { buildBn128, utils } from 'ffjavascript';
const { unstringifyBigInts } = utils;
import {
  g1Uncompressed,
  negateAndSerializeG1,
  g2Uncompressed,
  to32ByteBuffer,
} from './utils';
import * as circomlibjs from 'circomlibjs';
import { ProofResult } from '../types';

export async function generateProof(
  privateInputs: { minOut: string; salt: string },
  publicInputs: {
    realOut: string;
    commitment: string;
  },
  isCancel: boolean = false,
): Promise<ProofResult> {
  const filePrefix = isCancel ? 'cancel' : 'settle';

  const wasmPath = path.join(__dirname, `./circuits`, `${filePrefix}.wasm`);
  const zkeyPath = path.join(
    __dirname,
    `./circuits`,
    `${filePrefix}_final.zkey`,
  );
  const input = {
    minOut: privateInputs.minOut,
    salt: privateInputs.salt,
    realOut: publicInputs.realOut,
    commitment: publicInputs.commitment,
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );
  const curve = await buildBn128();
  const proofProc = unstringifyBigInts(proof);
  const publicSignalsUnstrigified = unstringifyBigInts(publicSignals);
  let proofA = g1Uncompressed(curve, proofProc.pi_a);
  proofA = await negateAndSerializeG1(curve, proofA);
  const proofB = g2Uncompressed(curve, proofProc.pi_b);
  const proofC = g1Uncompressed(curve, proofProc.pi_c);
  await curve.terminate();
  const formattedPublicSignals = publicSignalsUnstrigified.map((signal) => {
    return to32ByteBuffer(BigInt(signal));
  });

  return {
    proofA: new Uint8Array(proofA),
    proofB: new Uint8Array(proofB),
    proofC: new Uint8Array(proofC),
    publicSignals: formattedPublicSignals,
  };
}

export async function generatePoseidonCommitment(
  minOut: bigint,
  salt: bigint,
): Promise<bigint> {
  const poseidon = await circomlibjs.buildPoseidon();

  // Poseidon expects inputs as BigInts
  const inputs = [minOut, salt];

  // Generate the Poseidon commitment
  const hash = poseidon(inputs);

  // Convert the result to a field element compatible with Circom
  return poseidon.F.toObject(hash);
}
