import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { Signer } from './signer';
import type {
  AadhaarCSRData,
  PanCSRData,
  AadhaarCertificateRaw,
  PanCertificateRaw,
} from './types';

export class CA {
  private publicKeyBytes: Uint8Array;
  private privateKeyBytes: Uint8Array;

  constructor(privateKeyString: string) {
    this.privateKeyBytes = Signer.parsePrivateKeyPEM(privateKeyString);
    this.publicKeyBytes = ed25519.getPublicKey(this.privateKeyBytes);
  }

  public generateAadhaarCertificate(
    csrData: AadhaarCSRData,
    userPublicKeyBytes: Uint8Array,
  ): AadhaarCertificateRaw {
    const serial = sha256(
      new Uint8Array([
        ...Buffer.from(JSON.stringify(csrData)),
        ...Buffer.from(randomBytes(8)),
      ]),
    ).toBase64();
    const issuer = sha256(new Uint8Array(this.publicKeyBytes)).toBase64();
    const validFrom = String(Date.now());
    const validTo = String(validFrom + 180 * 24 * 60 * 60 * 1000); // 180 days validity
    const publicKey = Buffer.from(userPublicKeyBytes).toString('base64');

    // Create ordered certificate data to ensure consistent JSON serialization
    const certificateData = {
      name: csrData.name,
      lastFourAadhaar: csrData.lastFourAadhaar,
      serial,
      issuer,
      validFrom,
      validTo,
      publicKey,
    };

    // Sign the certificate data with the exact same ordering
    const signature = Buffer.from(
      ed25519.sign(
        new Uint8Array(Buffer.from(JSON.stringify(certificateData))),
        this.privateKeyBytes,
      ),
    ).toString('base64');

    // Return the certificate with properties in the same order as used for signing
    return {
      name: csrData.name,
      lastFourAadhaar: csrData.lastFourAadhaar,
      serial,
      issuer,
      validFrom,
      validTo,
      publicKey,
      signature,
    };
  }

  public static verifyAadhaarCertificate(
    certificate: AadhaarCertificateRaw,
    govPublicKey: string,
  ): boolean {
    // Extract signature and sort the remaining certificate data properties
    const { signature, ...certDataObj } = certificate;

    // Create ordered certificate data to ensure consistent JSON serialization
    const orderedCertData = {
      name: certDataObj.name,
      lastFourAadhaar: certDataObj.lastFourAadhaar,
      serial: certDataObj.serial,
      issuer: certDataObj.issuer,
      validFrom: certDataObj.validFrom,
      validTo: certDataObj.validTo,
      publicKey: certDataObj.publicKey,
    };

    console.log('Verifying certificate data:', orderedCertData);
    const certDataString = JSON.stringify(orderedCertData);
    let signatureRaw: Uint8Array;
    try {
      signatureRaw = new Uint8Array(Buffer.from(signature, 'base64'));
    } catch (e) {
      throw new Error('Invalid base64 signature');
    }

    return ed25519.verify(
      signatureRaw,
      new Uint8Array(Buffer.from(certDataString)),
      Signer.parsePublicKeyPEM(govPublicKey),
    );
  }

  public encodeAadhaarCertificateToPEM(
    certificate: AadhaarCertificateRaw,
  ): string {
    const certString = JSON.stringify(certificate);
    const base64Cert = Buffer.from(certString).toString('base64');
    return [
      '-----BEGIN AADHAAR CERTIFICATE-----',
      ...Signer.splitIntoLines(base64Cert, 64),
      '-----END AADHAAR CERTIFICATE-----',
    ].join('\n');
  }

  public decodeAadhaarCertificateFromPEM(
    pemString: string,
  ): AadhaarCertificateRaw {
    const base64String = pemString
      .replace(/-----BEGIN AADHAAR CERTIFICATE-----/g, '')
      .replace(/-----END AADHAAR CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
    const certBuffer = Buffer.from(base64String, 'base64');
    return JSON.parse(certBuffer.toString('utf-8')) as AadhaarCertificateRaw;
  }
}
