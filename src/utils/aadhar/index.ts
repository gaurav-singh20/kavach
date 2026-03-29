import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AadharUser {
  id: number;
  name: string;
  aadhaar: string;
  gender: string;
  dob: {
    day: number;
    month: number;
    year: number;
  };
  createdAt: string;
  status: string;
  signatureWithEncodedData: number[];
  pemCertificate: string;
  userPrivateKey: string;
  userPublicKey: string;
}

// Validate Aadhaar number format
export const validateAadhaarNumber = (aadhaarNumber: string): boolean => {
  // Remove spaces and check if it's exactly 12 digits
  const cleanNumber = aadhaarNumber.replace(/\s/g, '');
  return /^\d{12}$/.test(cleanNumber);
};

export const getAadharData = async (
  aadhaarNumber: string,
): Promise<AadharUser> => {
  // Validate Aadhaar number format first
  if (!validateAadhaarNumber(aadhaarNumber)) {
    throw new Error(
      'Invalid Aadhaar number format. Please enter a 12-digit number.',
    );
  }

  try {
    const cleanNumber = aadhaarNumber.replace(/\s/g, '');
    const response = await fetch(
      `https://sih-aadhar.vercel.app/api/people?aadhaar=${cleanNumber}`,
    );

    // Check if the response is successful
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Aadhaar number not found in database');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Validate the data structure to ensure it's a valid AadharUser
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }

    // Check if the response contains an error message
    if (data.error || data.message) {
      throw new Error(data.error || data.message || 'Aadhaar number not found');
    }

    // Validate required fields
    if (!data.name || !data.aadhaar || !data.gender || !data.dob) {
      throw new Error('Incomplete Aadhaar data received');
    }

    // Only store data if it's valid
    await AsyncStorage.setItem('aadhar', JSON.stringify(data));
    console.log('Valid Aadhaar data fetched and stored:', data.name);

    return data;
  } catch (error) {
    console.error('Error fetching Aadhaar data:', error);
    // Don't store invalid data
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch Aadhaar data. Please check the number and try again.',
    );
  }
};

export const getStoredAadharData = async (): Promise<AadharUser | null> => {
  try {
    const data = await AsyncStorage.getItem('aadhar');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving Aadhaar data from storage:', error);
    return null;
  }
};

export const storeAadharData = async (userData: AadharUser): Promise<void> => {
  try {
    await AsyncStorage.setItem('aadhar', JSON.stringify(userData));
    console.log('Aadhaar data stored successfully');
  } catch (error) {
    console.error('Error storing Aadhaar data:', error);
    throw error;
  }
};

export const clearStoredAadharData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('aadhar');
    console.log('Aadhaar data removed from storage');
  } catch (error) {
    console.error('Error removing Aadhaar data from storage:', error);
    throw error;
  }
};

// Utility functions for specific data access
export const getStoredPrivateKey = async (): Promise<string | null> => {
  try {
    const data = await getStoredAadharData();
    return data?.userPrivateKey || null;
  } catch (error) {
    console.error('Error retrieving private key:', error);
    return null;
  }
};

export const getStoredPublicKey = async (): Promise<string | null> => {
  try {
    const data = await getStoredAadharData();
    return data?.userPublicKey || null;
  } catch (error) {
    console.error('Error retrieving public key:', error);
    return null;
  }
};

export const getStoredCertificate = async (): Promise<string | null> => {
  try {
    const data = await getStoredAadharData();
    return data?.pemCertificate || null;
  } catch (error) {
    console.error('Error retrieving certificate:', error);
    return null;
  }
};

export const getStoredSignature = async (): Promise<number[] | null> => {
  try {
    const data = await getStoredAadharData();
    return data?.signatureWithEncodedData || null;
  } catch (error) {
    console.error('Error retrieving signature:', error);
    return null;
  }
};

export const getUserBasicInfo = async (): Promise<{
  name: string;
  aadhaar: string;
  gender: string;
  dob: { day: number; month: number; year: number };
} | null> => {
  try {
    const data = await getStoredAadharData();
    if (!data) return null;

    return {
      name: data.name,
      aadhaar: data.aadhaar,
      gender: data.gender,
      dob: data.dob,
    };
  } catch (error) {
    console.error('Error retrieving user basic info:', error);
    return null;
  }
};
// Verify stored data integrity
export const verifyStoredData = async (): Promise<boolean> => {
  try {
    const data = await getStoredAadharData();
    if (!data) {
      console.log('No data stored');
      return false;
    }

    // Check if stored data is valid
    if (!data.name || !data.aadhaar || !data.gender || !data.dob) {
      console.warn('Invalid data found in storage, clearing...');
      await clearStoredAadharData();
      return false;
    }

    console.log('Stored Aadhaar Data:');
    console.log('Name:', data.name);
    console.log('Aadhaar:', data.aadhaar);
    console.log('Gender:', data.gender);
    console.log('DOB:', `${data.dob.day}/${data.dob.month}/${data.dob.year}`);
    console.log('Status:', data.status);
    console.log('Has Private Key:', !!data.userPrivateKey);
    console.log('Has Public Key:', !!data.userPublicKey);
    console.log('Has Certificate:', !!data.pemCertificate);
    console.log(
      'Signature Length:',
      data.signatureWithEncodedData?.length || 0,
    );

    return true;
  } catch (error) {
    console.error('Error verifying stored data:', error);
    // Clear corrupted data
    await clearStoredAadharData();
    return false;
  }
};
