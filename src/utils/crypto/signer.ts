import { ed25519 } from '@noble/curves/ed25519.js';

export class Signer {
  private privateKeyBytes: Uint8Array;
  private publicKeyBytes: Uint8Array;

  constructor(privateKeyString: string) {
    this.privateKeyBytes = Signer.parsePrivateKeyPEM(privateKeyString);
    this.publicKeyBytes = ed25519.getPublicKey(this.privateKeyBytes);

    // check if there is crypto module available, if not, throw error
    try {
      require('crypto');
    } catch (e) {
      console.log('Possibly in React Native: ', e);
      require('react-native-get-random-values');
    }
  }

  public static parsePrivateKeyPEM(pemString: string): Uint8Array {
    const base64String = pemString
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');

    // Decode base64 to get DER bytes
    const derBytes = this.base64ToUint8Array(base64String);

    // Extract Ed25519 private key from PKCS#8 DER structure
    return this.extractEd25519PrivateKey(derBytes);
  }

  public static base64ToUint8Array(base64: string): Uint8Array {
    // For React Native/browser environments
    if (typeof atob !== 'undefined') {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // For Node.js environments
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }

    throw new Error('No base64 decoder available');
  }

  public static extractEd25519PrivateKey(derBytes: Uint8Array): Uint8Array {
    const ed25519OID = new Uint8Array([0x2b, 0x65, 0x70]);
    let oidFound = false;

    for (let i = 0; i < derBytes.length - 3; i++) {
      if (
        derBytes[i] === ed25519OID[0] &&
        derBytes[i + 1] === ed25519OID[1] &&
        derBytes[i + 2] === ed25519OID[2]
      ) {
        oidFound = true;
        break;
      }
    }

    if (!oidFound) {
      throw new Error('Not an Ed25519 private key');
    }

    // we are assuming standard PKCS#8 structure here
    // Private key usually starts at byte 16 and is 32 bytes long
    // Baad me fix karunga isko
    const privateKeyStart = 16;
    const privateKeyLength = 32;

    if (derBytes.length < privateKeyStart + privateKeyLength) {
      throw new Error('Invalid Ed25519 private key format');
    }

    return derBytes.slice(privateKeyStart, privateKeyStart + privateKeyLength);
  }

  public getPublicKey(): Uint8Array {
    return this.publicKeyBytes;
  }

  public getPublicKeyPEM(): string {
    // Create SPKI (SubjectPublicKeyInfo) structure for Ed25519 public key
    const publicKeyDER = this.createPublicKeyDER(this.publicKeyBytes);
    const base64 = this.uint8ArrayToBase64(publicKeyDER);

    return [
      '-----BEGIN PUBLIC KEY-----',
      ...Signer.splitIntoLines(base64, 64),
      '-----END PUBLIC KEY-----',
    ].join('\n');
  }

  private createPublicKeyDER(publicKeyBytes: Uint8Array): Uint8Array {
    // SPKI structure for Ed25519:
    // SEQUENCE {
    //   SEQUENCE {
    //     OBJECT IDENTIFIER 1.3.101.112 (Ed25519)
    //   }
    //   BIT STRING (public key)
    // }

    const algorithmSequence = new Uint8Array([
      0x30,
      0x05, // SEQUENCE, length 5
      0x06,
      0x03, // OID, length 3
      0x2b,
      0x65,
      0x70, // Ed25519 OID (1.3.101.112)
    ]);

    const publicKeyBitString = new Uint8Array([
      0x03, // BIT STRING tag
      0x21, // Length: 33 bytes (32 + 1 for unused bits)
      0x00, // Unused bits: 0
      ...publicKeyBytes, // 32 bytes of public key
    ]);

    const totalLength = algorithmSequence.length + publicKeyBitString.length;
    const result = new Uint8Array([
      0x30, // SEQUENCE tag
      totalLength, // Total length
      ...algorithmSequence,
      ...publicKeyBitString,
    ]);

    return result;
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    // For React Native/browser environments
    if (typeof btoa !== 'undefined') {
      const binaryString = String.fromCharCode(...bytes);
      return btoa(binaryString);
    }

    // For Node.js environments
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }

    throw new Error('No base64 encoder available');
  }

  public static splitIntoLines(str: string, lineLength: number): string[] {
    const lines = [];
    for (let i = 0; i < str.length; i += lineLength) {
      lines.push(str.substr(i, lineLength));
    }
    return lines;
  }

  public static parsePublicKeyPEM(pemString: string): Uint8Array {
    // Remove PEM headers and whitespace
    const base64String = pemString
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s/g, '');

    // Decode base64 to get DER bytes
    const derBytes = Signer.base64ToUint8ArrayStatic(base64String);

    // Extract Ed25519 public key from SPKI DER structure
    // For Ed25519 SPKI, the public key is typically the last 32 bytes
    return derBytes.slice(-32);
  }

  private static base64ToUint8ArrayStatic(base64: string): Uint8Array {
    // For React Native/browser environments
    if (typeof atob !== 'undefined') {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // For Node.js environments
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }

    throw new Error('No base64 decoder available');
  }

  public static verify(
    data: string | Uint8Array,
    signature: Uint8Array,
    publicKeyString: string,
  ): boolean {
    const message =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const publicKeyBytes = Signer.parsePublicKeyPEM(publicKeyString);

    return ed25519.verify(signature, message, publicKeyBytes);
  }

  public sign(data: string | Uint8Array): Uint8Array {
    const message =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return ed25519.sign(message, this.privateKeyBytes);
  }
}
