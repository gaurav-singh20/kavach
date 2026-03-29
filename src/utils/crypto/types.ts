// I had two options here, either ArrayBuffer or just plain string of 0s and 1s
// ArrayBuffer would be more efficient for large data sets, but string is easier to work with
// I chose string for simplicity and ease of use
// But we will shift to ArrayBuffer later
// And anyway it doesnt matter because the end product would be a QR code
type Bit = '0' | '1';
export type EncodedChar = `${Bit}${Bit}${Bit}${Bit}${Bit}`;
export type EncodedGender = `${Bit}${Bit}`;
export type EncodedVersion = `${Bit}${Bit}${Bit}`;
export type EncodedAadhaar = Bit[];
export type EncodedDOB = Bit[];
export type EncodedPAN = Bit[];
export type EncodedSignature = Bit[];

export type DecodedGender = 'Male' | 'Female' | 'Other' | 'Unknown';
export type DecodedDOB = { day: number; month: number; year: number };
export type DecodedAadhaar = Number;
export type DecodedVersion = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type DecodedPAN = string;
export type DecodedSignature = ArrayBuffer;

// CA types
export type AadhaarCSRData = {
  name: string;
  lastFourAadhaar: string;
};

export type PanCSRData = {
  name: string;
  pan: string;
};

export type AadhaarCertificateRaw = {
  name: string;
  lastFourAadhaar: string;
  serial: string; // sha256 of CSR + timestamp
  issuer: string; // sha256 of gov public key
  validFrom: string; // ISO string
  validTo: string; // ISO string
  publicKey: string; // base64 encoded public key
  signature: string; // base64 encoded signature of the above fields using gov private key
};

export type PanCertificateRaw = {
  name: string;
  pan: string;
  serial: string; // sha256 of CSR + timestamp
  issuer: string; // sha256 of gov public key
  validFrom: string; // ISO string
  validTo: string; // ISO string
  publicKey: string; // base64 encoded public key
  signature: string; // base64 encoded signature of the above fields using gov private key
};
