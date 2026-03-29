import AsyncStorage from '@react-native-async-storage/async-storage';
import { Signer, Encoder } from '../crypto';
import { Buffer } from 'buffer';

export const fetchAndStorePemFile = async (): Promise<string> => {
  try {
    const response = await fetch('https://kavach-s3.ba3a.tech/gov_pub.pem');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const pemContent = await response.text();

    await AsyncStorage.setItem('public_key_pem', pemContent);

    console.log('PEM file successfully stored in AsyncStorage');
    return pemContent;
  } catch (error) {
    console.error('Error fetching and storing PEM file:', error);
    throw error;
  }
};

export const getStoredPemFile = async (): Promise<string | null> => {
  try {
    const pemContent = await AsyncStorage.getItem('public_key_pem');
    return pemContent;
  } catch (error) {
    console.error('Error retrieving PEM file from AsyncStorage:', error);
    return null;
  }
};

export const clearStoredPemFile = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('public_key_pem');
    console.log('PEM file removed from AsyncStorage');
  } catch (error) {
    console.error('Error removing PEM file from AsyncStorage:', error);
    throw error;
  }
};

export const verifySignature = async (
  qrPayload: string,
): Promise<{ isValid: boolean; decodedData: any }> => {
  const qrBuffer = Buffer.from(qrPayload, 'base64');
  const pemContent = await AsyncStorage.getItem('public_key_pem');

  // First 64 bytes is signature, rest is data
  const qrSignature = qrBuffer.slice(0, 64);
  const qrData = qrBuffer.slice(64);

  // Verifying signature
  const isValid = Signer.verify(
    qrData.toString('base64'),
    new Uint8Array(qrSignature),
    pemContent || '',
  );
  console.log('Is signature valid?', isValid);

  // Finally decoding data from QRBuffer
  const encoder = new Encoder();
  const decodedData = encoder.decodeAadhaarData(new Uint8Array(qrData).buffer);
  console.log('Decoded data:', decodedData);

  return {
    isValid,
    decodedData,
  };
};
