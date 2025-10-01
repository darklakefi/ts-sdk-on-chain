export function to32ByteBuffer(bigInt: bigint): Uint8Array {
  const hexString = bigInt.toString(16).padStart(64, '0');
  return new Uint8Array(Buffer.from(hexString, 'hex'));
}

export function toBigInt(bytes: Uint8Array): bigint {
  const hexString = Buffer.from(bytes).toString('hex');
  return BigInt('0x' + hexString);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function g1Uncompressed(curve: any, p1Raw: any): Uint8Array {
  const p1 = curve.G1.fromObject(p1Raw);
  const buff = new Uint8Array(64);
  curve.G1.toRprUncompressed(buff, 0, p1);
  return buff;
}

export async function negateAndSerializeG1(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  curve: any,
  p1Uncompressed: Uint8Array,
): Promise<Uint8Array> {
  const p1 = curve.G1.toAffine(curve.G1.fromRprUncompressed(p1Uncompressed, 0));
  const negatedP1 = curve.G1.neg(p1);
  const serializedNegatedP1 = new Uint8Array(64);
  curve.G1.toRprUncompressed(serializedNegatedP1, 0, negatedP1);
  return serializedNegatedP1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function g2Uncompressed(curve: any, p2Raw: any): Uint8Array {
  const p2 = curve.G2.fromObject(p2Raw);
  const buff = new Uint8Array(128);
  curve.G2.toRprUncompressed(buff, 0, p2);
  return buff;
}
