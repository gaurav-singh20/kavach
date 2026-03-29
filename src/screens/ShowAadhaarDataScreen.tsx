import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import P2PService from '../utils/p2p/P2PService';
import type { P2PDevice, P2PMessage } from '../utils/p2p/P2PService';
// import { Signer } from '@ba3a-g/kavach';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { Buffer } from 'buffer';
import {
  getStoredAadharData,
  getAadharData,
  storeAadharData,
  validateAadhaarNumber,
  type AadharUser,
} from '../utils/aadhar';

const ShowAadhaarDataScreen = () => {
  const navigation = useNavigation();
  const [isP2PActive, setIsP2PActive] = useState(false);
  const [receivedConsent, setReceivedConsent] = useState<string>('');
  const [senderDevice, setSenderDevice] = useState<string>('');
  const [connectionStatus, setConnectionStatus] =
    useState<string>('Not Connected');
  const [isP2PInitialized, setIsP2PInitialized] = useState(false);
  const [isInitializingP2P, setIsInitializingP2P] = useState(false);

  // Aadhaar data state
  const [aadharData, setAadharData] = useState<AadharUser | null>(null);
  const [isLoadingAadhar, setIsLoadingAadhar] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [signatureQrData, setSignatureQrData] = useState<string>('');

  useEffect(() => {
    // Load stored Aadhaar data on mount
    loadAadharData();

    // Listen for incoming messages
    const handleMessage = (message: P2PMessage) => {
      console.log('ShowAadhaar - Received message:', {
        type: message.type,
        fromDevice: message.fromDevice,
        messageLength: message.message.length,
        messagePreview: message.message.substring(0, 100),
      });

      if (message.type === 'consent') {
        try {
          const consentData = JSON.parse(message.message);
          console.log('ShowAadhaar - Parsed consent data:', consentData);
          setReceivedConsent(consentData.consentText || message.message);
          setSenderDevice(message.fromDevice);
          setConnectionStatus('Consent Received');

          // Show alert to user
          Alert.alert(
            'Consent Received',
            `Received consent request from ${message.fromDevice}. Please review and process it.`,
          );
        } catch (error) {
          console.log('ShowAadhaar - Treating as plain text consent');
          // If not JSON, treat as plain text
          setReceivedConsent(message.message);
          setSenderDevice(message.fromDevice);
          setConnectionStatus('Consent Received');

          Alert.alert(
            'Consent Received',
            `Received consent request from ${message.fromDevice}. Please review and process it.`,
          );
        }
      } else if (message.type === 'chat') {
        // Also handle chat messages as potential consent (fallback)
        console.log(
          'ShowAadhaar - Received chat message, treating as potential consent',
        );
        setReceivedConsent(message.message);
        setSenderDevice(message.fromDevice);
        setConnectionStatus('Message Received');

        Alert.alert(
          'Message Received',
          `Received message from ${
            message.fromDevice
          }: ${message.message.substring(0, 50)}...`,
        );
      } else {
        console.log('ShowAadhaar - Ignoring message with type:', message.type);
      }
    };

    const handleConnection = (device: P2PDevice, connected: boolean) => {
      console.log('ShowAadhaar - Connection change:', {
        device: device.deviceName,
        connected,
      });
      if (connected) {
        setConnectionStatus(`Connected to ${device.deviceName}`);
        Alert.alert('Connected', `${device.deviceName} connected`);
      } else {
        setConnectionStatus('Disconnected');
        Alert.alert('Disconnected', `${device.deviceName} disconnected`);
      }
    };

    P2PService.addMessageListener(handleMessage);
    P2PService.addConnectionListener(handleConnection);

    return () => {
      P2PService.removeMessageListener(handleMessage);
      P2PService.removeConnectionListener(handleConnection);
    };
  }, []);

  const initializeP2P = async () => {
    try {
      if (isInitializingP2P) {
        return false;
      }

      setIsInitializingP2P(true);
      setConnectionStatus('Initializing P2P...');

      // Check if already initialized
      if (!P2PService.isServiceInitialized()) {
        const initialized = await P2PService.initialize();
        if (!initialized) {
          Alert.alert(
            'Error',
            'Failed to initialize P2P service. Please check permissions and make sure you are on Android.',
          );
          setConnectionStatus('P2P Initialization Failed');
          return false;
        }
      }

      setIsP2PInitialized(true);
      setConnectionStatus('P2P Initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize P2P:', error);
      Alert.alert(
        'Error',
        `Failed to initialize P2P service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setConnectionStatus('P2P Initialization Failed');
      return false;
    } finally {
      setIsInitializingP2P(false);
    }
  };

  const handleSignConsent = async () => {
    try {
      // Initialize P2P if not already done
      if (!isP2PInitialized) {
        const initialized = await initializeP2P();
        if (!initialized) {
          return;
        }
      }

      setConnectionStatus('Starting discovery...');

      // Start discovery to make this device discoverable
      await P2PService.startDiscovery();
      setIsP2PActive(true);

      // Wait a moment for discovery to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      setConnectionStatus('Ready to receive consent (Discoverable)');

      console.log(
        'ShowAadhaar - Device is now discoverable and ready to receive consent',
      );

      Alert.alert(
        'Ready',
        'This device is now discoverable as a Kavach device. Waiting for consent requests from KYC dashboard devices.',
      );
    } catch (error) {
      console.error('Failed to start P2P:', error);
      Alert.alert('Error', 'Failed to start P2P service');
      setConnectionStatus('Error starting P2P');
    }
  };

  const handleStopP2P = async () => {
    try {
      await P2PService.stopDiscovery();
      setIsP2PActive(false);
      setConnectionStatus('Not Connected');
      Alert.alert('Stopped', 'P2P service stopped');
    } catch (error) {
      console.error('Failed to stop P2P:', error);
    }
  };

  const generateSignatureQR = (signatureWithEncodedData: number[]) => {
    try {
      // Convert number array to Buffer and then to base64
      const buffer = Buffer.from(signatureWithEncodedData);
      const base64String = buffer.toString('base64');
      setSignatureQrData(base64String);
      console.log(
        'Generated QR data for signature:',
        base64String.substring(0, 50) + '...',
      );
    } catch (error) {
      console.error('Failed to generate signature QR:', error);
      setSignatureQrData('');
    }
  };

  const loadAadharData = async () => {
    try {
      setIsLoadingAadhar(true);
      const storedData = await getStoredAadharData();
      if (storedData) {
        // Validate stored data - check if essential fields exist
        if (
          !storedData.name ||
          !storedData.aadhaar ||
          !storedData.userPrivateKey
        ) {
          console.log('Invalid Aadhaar data found in storage, clearing...');
          // Clear invalid data from storage
          await AsyncStorage.removeItem('aadhar');
          console.log('Cleared invalid Aadhaar data from storage');
          setAadharData(null);
          return;
        }

        setAadharData(storedData);
        console.log(
          'Private key loaded:',
          storedData.userPrivateKey.substring(0, 10) + '...',
        );
        // Generate QR code for signature
        if (storedData.signatureWithEncodedData) {
          generateSignatureQR(storedData.signatureWithEncodedData);
        }
        console.log('Loaded Aadhaar data from storage:', storedData.name);
      } else {
        console.log('No Aadhaar data found in storage');
      }
    } catch (error) {
      console.error('Failed to load Aadhaar data:', error);
      // If there's an error parsing stored data, clear it
      try {
        await AsyncStorage.removeItem('aadhar');
        console.log('Cleared corrupted Aadhaar data from storage');
      } catch (clearError) {
        console.error('Failed to clear corrupted data:', clearError);
      }
    } finally {
      setIsLoadingAadhar(false);
    }
  };

  const fetchAadharData = async () => {
    if (!aadhaarInput.trim()) {
      Alert.alert('Error', 'Please enter Aadhaar number');
      return;
    }

    // Use the validation function from utils
    if (!validateAadhaarNumber(aadhaarInput.trim())) {
      Alert.alert(
        'Error',
        'Invalid Aadhaar number format. Please enter a 12-digit number.',
      );
      return;
    }

    try {
      setIsLoadingAadhar(true);
      const fetchedData = await getAadharData(aadhaarInput.trim());
      setAadharData(fetchedData);
      // Generate QR code for signature
      if (fetchedData.signatureWithEncodedData) {
        generateSignatureQR(fetchedData.signatureWithEncodedData);
      }
      setAadhaarInput('');
      Alert.alert(
        'Success',
        `Aadhaar data for ${fetchedData.name} fetched and stored successfully`,
      );
    } catch (error) {
      console.error('Failed to fetch Aadhaar data:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoadingAadhar(false);
    }
  };

  const handleProcessConsent = async () => {
    if (!receivedConsent) {
      Alert.alert('No Consent', 'No consent data received yet');
      return;
    }

    if (!aadharData || !aadharData.userPrivateKey) {
      Alert.alert(
        'Error',
        'No private key available. Please load Aadhaar data first.',
      );
      return;
    }

    try {
      // Check P2P service state
      if (!isP2PInitialized) {
        Alert.alert('Error', 'P2P service not initialized');
        return;
      }

      // Simulate processing consent and generating certificate
      setConnectionStatus('Processing consent...');
      const private_key = aadharData.userPrivateKey;
      const cert = aadharData.pemCertificate;

      // Retry logic for sending certificate
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        attempts++;
        console.log(`Sending certificate attempt ${attempts}/${maxAttempts}`);
        setConnectionStatus(
          `Sending certificate (${attempts}/${maxAttempts})...`,
        );

        try {
          success = await P2PService.sendMessage(
            JSON.stringify({ key: private_key, cert: cert }),
            undefined, // Send to connected device
            'verification',
          );

          if (!success && attempts < maxAttempts) {
            console.log(`Send failed, waiting before retry ${attempts + 1}...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        } catch (sendError) {
          console.error(`Send attempt ${attempts} failed:`, sendError);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (success) {
        setConnectionStatus('Certificate sent successfully');
        Alert.alert(
          'Certificate Sent',
          `Certificate successfully sent to ${senderDevice}`,
        );

        // Reset the received consent after processing
        setReceivedConsent('');
        setSenderDevice('');
      } else {
        setConnectionStatus('Failed to send certificate');
        Alert.alert(
          'Error',
          `Failed to send certificate after ${maxAttempts} attempts. Please check connection and try again.`,
        );
      }
    } catch (error) {
      console.error('Failed to process consent:', error);
      setConnectionStatus('Failed to process consent');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to process consent: ${errorMessage}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      Alert.alert(
        'Disconnect',
        'This will stop P2P service and disconnect from all devices. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                // Stop P2P discovery and cleanup
                await P2PService.stopDiscovery();
                await P2PService.disconnect();

                setIsP2PActive(false);
                setIsP2PInitialized(false);
                setReceivedConsent('');
                setSenderDevice('');
                setConnectionStatus('Disconnected');

                Alert.alert('Success', 'All P2P connections have been reset');
              } catch (error) {
                console.error('Failed to disconnect:', error);
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred';
                Alert.alert('Error', `Failed to disconnect: ${errorMessage}`);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Show Aadhaar Data</Text>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connection Status</Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isP2PActive ? '#10b981' : '#ef4444' },
              ]}
            />
            <Text style={styles.statusText}>{connectionStatus}</Text>
          </View>
        </View>

        {/* Aadhaar Data Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aadhaar Information</Text>

          {!aadharData ? (
            <View>
              <Text style={styles.cardDescription}>
                Enter your Aadhaar number to fetch and display your information:
              </Text>

              <TextInput
                style={styles.aadhaarInput}
                placeholder="Enter 12-digit Aadhaar number"
                value={aadhaarInput}
                onChangeText={setAadhaarInput}
                keyboardType="numeric"
                maxLength={12}
              />

              <TouchableOpacity
                style={[
                  styles.fetchButton,
                  isLoadingAadhar && styles.fetchButtonDisabled,
                ]}
                onPress={fetchAadharData}
                disabled={isLoadingAadhar}
              >
                <Text style={styles.fetchButtonText}>
                  {isLoadingAadhar ? 'Fetching...' : 'Fetch Aadhaar Data'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Name:</Text>
                <Text style={styles.dataValue}>
                  {aadharData.name || 'Not available'}
                </Text>
              </View>

              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Gender:</Text>
                <Text style={styles.dataValue}>
                  {aadharData.gender || 'Not available'}
                </Text>
              </View>

              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Aadhaar:</Text>
                <Text style={styles.dataValue}>
                  {aadharData.aadhaar
                    ? aadharData.aadhaar.replace(
                        /(\d{4})(\d{4})(\d{4})/,
                        '$1 $2 $3',
                      )
                    : 'Not available'}
                </Text>
              </View>

              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Date of Birth:</Text>
                <Text style={styles.dataValue}>
                  {aadharData.dob &&
                  aadharData.dob.day &&
                  aadharData.dob.month &&
                  aadharData.dob.year
                    ? `${aadharData.dob.day}/${aadharData.dob.month}/${aadharData.dob.year}`
                    : 'Not available'}
                </Text>
              </View>

              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Public Key:</Text>
                <Text style={styles.dataValueSmall} numberOfLines={2}>
                  {aadharData.userPublicKey || 'Not available'}
                </Text>
              </View>

              <View style={styles.dataColumn}>
                <Text style={styles.dataLabel}>PEM Certificate:</Text>
                <ScrollView
                  style={styles.certificateContainer}
                  horizontal={true}
                >
                  <Text style={styles.certificateText}>
                    {aadharData.pemCertificate || 'Not available'}
                  </Text>
                </ScrollView>
              </View>

              <View style={styles.dataColumn}>
                <Text style={styles.dataLabel}>Digital Signature QR:</Text>
                <View style={styles.qrContainer}>
                  {signatureQrData ? (
                    <QRCode
                      value={signatureQrData}
                      size={200}
                      color="black"
                      backgroundColor="white"
                    />
                  ) : (
                    <Text style={styles.qrPlaceholder}>
                      No signature data available
                    </Text>
                  )}
                </View>
                <Text style={styles.qrDescription}>
                  Scan this QR code to verify the digital signature
                </Text>
              </View>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setAadharData(null);
                  setAadhaarInput('');
                  setSignatureQrData('');
                }}
              >
                <Text style={styles.clearButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign Consent Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aadhaar KYC</Text>
          <Text style={styles.cardDescription}>
            Click "Sign Consent" to make this device available for receiving
            consent requests from recognised authorities.
          </Text>

          {!isP2PActive ? (
            <TouchableOpacity
              style={[
                styles.signButton,
                isInitializingP2P && styles.signButtonDisabled,
              ]}
              onPress={handleSignConsent}
              disabled={isInitializingP2P}
            >
              <Text style={styles.signButtonText}>
                {isInitializingP2P ? '⏳ Initializing...' : '🔐 Sign Consent'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopButton} onPress={handleStopP2P}>
              <Text style={styles.stopButtonText}>Stop P2P Service</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Received Consent Card */}
        {receivedConsent ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Received Consent</Text>
            <Text style={styles.senderInfo}>From: {senderDevice}</Text>

            <View style={styles.consentContainer}>
              <Text style={styles.consentLabel}>Consent Data:</Text>
              <Text style={styles.consentText}>{receivedConsent}</Text>
            </View>

            <TouchableOpacity
              style={styles.processButton}
              onPress={handleProcessConsent}
            >
              <Text style={styles.processButtonText}>
                Process Consent & Generate Certificate
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Waiting for Consent</Text>
            <Text style={styles.waitingText}>
              {isP2PActive
                ? 'Device is discoverable. Waiting for consent requests...'
                : 'Start P2P service to receive consent requests'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3', // Primary beige background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#d4c4a0', // Primary beige accent
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#2c2419', // Dark brown text
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c2419', // Dark brown text
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    marginBottom: 16,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
  },
  signButton: {
    backgroundColor: '#d4c4a0', // Primary beige accent
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  signButtonDisabled: {
    backgroundColor: '#e8e3db', // Light beige for disabled state
    opacity: 0.6,
  },
  signButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#c49a6c', // Darker beige for warning/stop actions
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '600',
  },
  senderInfo: {
    fontSize: 12,
    color: '#6b5e4f', // Medium brown text
    marginBottom: 12,
    fontStyle: 'italic',
  },
  consentContainer: {
    backgroundColor: '#f0eae0', // Light beige highlight
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#d4c4a0', // Primary beige accent
    marginBottom: 16,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
    marginBottom: 8,
  },
  consentText: {
    fontSize: 14,
    color: '#2c2419', // Dark brown text
    lineHeight: 20,
  },
  processButton: {
    backgroundColor: '#8b4513', // Darker brown for primary actions
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  processButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  waitingText: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#2c2419', // Dark brown text
    lineHeight: 22,
  },
  disconnectButton: {
    backgroundColor: '#c49a6c', // Darker beige for warning actions
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 14,
    fontWeight: '600',
  },
  aadhaarInput: {
    borderWidth: 1,
    borderColor: '#e8e3db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    color: '#2c2419', // Dark brown text
  },
  fetchButton: {
    backgroundColor: '#d4c4a0', // Primary beige accent
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  fetchButtonDisabled: {
    backgroundColor: '#b8a584', // Muted beige for disabled state
  },
  fetchButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  dataColumn: {
    marginBottom: 16,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
    minWidth: 100,
    marginRight: 12,
  },
  dataValue: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    flex: 1,
  },
  dataValueSmall: {
    fontSize: 12,
    color: '#6b5e4f', // Medium brown text
    flex: 1,
    fontFamily: 'monospace',
  },
  certificateContainer: {
    maxHeight: 100,
    backgroundColor: '#f0eae0', // Light beige highlight
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  certificateText: {
    fontSize: 11,
    color: '#6b5e4f', // Medium brown text
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  clearButton: {
    backgroundColor: '#c49a6c', // Darker beige for warning actions
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16,
  },
  clearButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  qrPlaceholder: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 32,
  },
  qrDescription: {
    fontSize: 12,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default ShowAadhaarDataScreen;
