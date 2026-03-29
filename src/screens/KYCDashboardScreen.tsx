import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import P2PService from '../utils/p2p/P2PService';
import type { P2PDevice, P2PMessage } from '../utils/p2p/P2PService';

const KYCDashboardScreen = () => {
  const navigation = useNavigation();
  const [consentText, setConsentText] = useState('');
  const [isConsentSubmitted, setIsConsentSubmitted] = useState(false);
  const [consentHistory, setConsentHistory] = useState<
    Array<{
      id: string;
      text: string;
      timestamp: Date;
      response?: string;
      deviceName?: string;
    }>
  >([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<P2PDevice[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [currentConsent, setCurrentConsent] = useState<string>('');
  const [isP2PInitialized, setIsP2PInitialized] = useState(false);
  const [isInitializingP2P, setIsInitializingP2P] = useState(false);

  useEffect(() => {
    // Listen for device discovery
    const handleDevicesChanged = (devices: P2PDevice[]) => {
      setDiscoveredDevices(devices);
    };

    // Listen for incoming messages (certificate responses)
    const handleMessage = (message: P2PMessage) => {
      console.log('Received response in KYC Dashboard:', message);

      if (message.type === 'verification' || message.type === 'consent') {
        // Find the matching consent and add the response to history
        const consentToUpdate = currentConsent;
        if (consentToUpdate) {
          const newHistoryItem = {
            id: Date.now().toString(),
            text: consentToUpdate,
            timestamp: new Date(),
            response: message.message,
            deviceName: message.fromDevice,
          };

          setConsentHistory(prev => [newHistoryItem, ...prev]);
          setCurrentConsent(''); // Clear current consent
          setIsDiscovering(false); // Stop discovering

          Alert.alert(
            'Response Received',
            `Certificate received from ${message.fromDevice}`,
          );
        }
      }
    };

    P2PService.addDeviceListener(handleDevicesChanged);
    P2PService.addMessageListener(handleMessage);

    return () => {
      P2PService.removeDeviceListener(handleDevicesChanged);
      P2PService.removeMessageListener(handleMessage);
    };
  }, [currentConsent]);

  const handleConsentSubmission = async () => {
    if (!consentText.trim()) {
      Alert.alert('Error', 'Please enter consent text before submitting.');
      return;
    }

    setCurrentConsent(consentText.trim());
    setConsentText('');

    // Start P2P discovery to show devices immediately
    startDeviceDiscovery();
  };

  const initializeP2P = async () => {
    try {
      if (isInitializingP2P) {
        return false;
      }

      setIsInitializingP2P(true);

      // Check if already initialized
      if (!P2PService.isServiceInitialized()) {
        const initialized = await P2PService.initialize();
        if (!initialized) {
          Alert.alert(
            'Error',
            'Failed to initialize P2P service. Please check permissions and make sure you are on Android.',
          );
          return false;
        }
      }

      setIsP2PInitialized(true);
      return true;
    } catch (error) {
      console.error('Failed to initialize P2P:', error);
      Alert.alert(
        'Error',
        `Failed to initialize P2P service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    } finally {
      setIsInitializingP2P(false);
    }
  };

  const startDeviceDiscovery = async () => {
    try {
      // Initialize P2P if not already done
      if (!isP2PInitialized) {
        const initialized = await initializeP2P();
        if (!initialized) {
          return;
        }
      }

      setIsDiscovering(true);

      // Start discovery
      await P2PService.startDiscovery();

      Alert.alert(
        'Discovering Devices',
        'Searching for Kavach devices to send consent for verification...',
      );
    } catch (error) {
      console.error('Failed to start device discovery:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to start device discovery: ${errorMessage}`);
      setIsDiscovering(false);
    }
  };

  const resetConsent = () => {
    setConsentText('');
    setIsConsentSubmitted(false);
    setCurrentConsent('');
    setIsDiscovering(false);
    setDiscoveredDevices([]);
  };

  const handleDisconnectAll = async () => {
    try {
      Alert.alert(
        'Disconnect All',
        'This will disconnect from all devices and reset the P2P service. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                // Stop discovery and disconnect from P2P
                await P2PService.stopDiscovery();
                await P2PService.disconnect();

                // Reset all state
                setDiscoveredDevices([]);
                setIsDiscovering(false);
                setCurrentConsent('');
                setIsConsentSubmitted(false);
                setIsP2PInitialized(false);

                Alert.alert(
                  'Success',
                  'Disconnected from all devices and reset P2P service',
                );
              } catch (error) {
                console.error('Failed to disconnect:', error);
                const errorMessage =
                  error instanceof Error ? error.message : 'Unknown error occurred';
                Alert.alert('Error', `Failed to disconnect from devices: ${errorMessage}`);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  };

  const handleDeviceSelection = async (device: P2PDevice) => {
    if (!currentConsent) {
      Alert.alert('Error', 'No consent data to send');
      return;
    }

    try {
      // Connect to the selected device
      console.log('KYCDashboard - Attempting to connect to device:', {
        name: device.deviceName,
        address: device.deviceAddress,
        status: device.status,
      });
      
      const connectionResult = await P2PService.connectToDevice(device);
      console.log('KYCDashboard - Connection result:', connectionResult);

      if (!connectionResult) {
        Alert.alert('Connection Failed', `Could not connect to ${device.deviceName}`);
        return;
      }

      // Wait a moment for socket connection to stabilize
      console.log('KYCDashboard - Connection established, waiting for socket to be ready...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for stability

      // Verify connection is established
      const connectedDevices = P2PService.getConnectedDevices();
      console.log('KYCDashboard - Currently connected devices:', connectedDevices);
      
      const isConnected = connectedDevices.some(d => d.deviceAddress === device.deviceAddress);
      if (!isConnected) {
        console.error('KYCDashboard - Device not in connected list after connection attempt');
        Alert.alert('Connection Issue', `Connection to ${device.deviceName} not stable. Please try again.`);
        return;
      }

      // Send consent data
      const consentData = {
        consentText: currentConsent,
        timestamp: new Date().toISOString(),
        kycId: Date.now().toString(),
      };

      console.log('KYCDashboard - Preparing to send consent data:', {
        dataLength: JSON.stringify(consentData).length,
        targetDevice: device.deviceName,
        consentPreview: currentConsent.substring(0, 50) + '...',
      });

      // Try sending with retry logic
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        attempts++;
        console.log(`KYCDashboard - Sending attempt ${attempts}/${maxAttempts}`);

        try {
          // Check if we're still connected before sending
          const stillConnected = P2PService.getConnectedDevices().some(
            d => d.deviceAddress === device.deviceAddress
          );
          console.log(`KYCDashboard - Device still connected: ${stillConnected}`);

          success = await P2PService.sendMessage(
            JSON.stringify(consentData),
            undefined, // Let it broadcast to connected devices
            'consent',
          );

          console.log(`KYCDashboard - Send attempt ${attempts} result: ${success}`);

          if (!success && attempts < maxAttempts) {
            console.log(`KYCDashboard - Send failed, waiting before retry ${attempts + 1}...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          }
        } catch (sendError) {
          console.error(`KYCDashboard - Send attempt ${attempts} failed:`, sendError);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (success) {
        console.log('KYCDashboard - Consent sent successfully');
        Alert.alert(
          'Consent Sent',
          `Consent has been sent to ${device.deviceName} for verification. Waiting for certificate response...`,
        );
      } else {
        console.error('KYCDashboard - All send attempts failed');
        Alert.alert(
          'Error',
          `Failed to send consent after ${maxAttempts} attempts. Please check connection and try again.`,
        );
      }
    } catch (error) {
      console.error('KYCDashboard - Failed to send consent:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to connect and send consent: ${errorMessage}`);
    }
  };

  const formatTimestamp = (date: Date) => {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2563eb" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>KYC Dashboard</Text>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnectAll}
        >
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Consent Declaration Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consent Declaration</Text>
          <Text style={styles.cardDescription}>
            Please provide the consent to digitally verify your customer:
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Consent Statement *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="State your consent here..."
              value={consentText}
              onChangeText={setConsentText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.submitButton,
                (isInitializingP2P || isDiscovering) && styles.submitButtonDisabled,
              ]}
              onPress={handleConsentSubmission}
              disabled={isInitializingP2P || isDiscovering}
            >
              <Text style={styles.submitButtonText}>
                {isInitializingP2P ? 'Initializing P2P...' : 
                 isDiscovering ? 'Discovering...' : 'Declare'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={resetConsent}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {isConsentSubmitted && (
            <View style={styles.successMessage}>
              <Text style={styles.successText}>
                ✓ Consent submitted successfully
              </Text>
            </View>
          )}
        </View>

        {/* Device Discovery */}
        {isDiscovering && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Available Kavach Devices</Text>
            <Text style={styles.cardDescription}>
              Select a device to send your consent for verification:
            </Text>

            {discoveredDevices.length === 0 ? (
              <Text style={styles.noDevicesText}>
                Searching for Kavach devices... Make sure the target device has
                "Sign Consent" activated.
              </Text>
            ) : (
              <FlatList
                data={discoveredDevices}
                keyExtractor={item => item.deviceAddress}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => handleDeviceSelection(item)}
                  >
                    <Text style={styles.deviceName}>{item.deviceName}</Text>
                    <Text style={styles.deviceAddress}>
                      {item.deviceAddress}
                    </Text>
                    <Text style={styles.deviceStatus}>
                      Status: {item.status}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* Consent History */}
        {consentHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Consent History</Text>
            {consentHistory.map((consent, index) => (
              <View key={consent.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyIndex}>#{index + 1}</Text>
                  <Text style={styles.historyTimestamp}>
                    {formatTimestamp(consent.timestamp)}
                  </Text>
                </View>
                <Text style={styles.historyText}>{consent.text}</Text>
                {consent.deviceName && (
                  <Text style={styles.deviceInfo}>
                    Verified by: {consent.deviceName}
                  </Text>
                )}
                {consent.response && (
                  <View style={styles.responseContainer}>
                    <Text style={styles.responseLabel}>
                      Certificate Response:
                    </Text>
                    <Text style={styles.responseText}>{consent.response}</Text>
                  </View>
                )}
              </View>
            ))}
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
  disconnectButton: {
    backgroundColor: '#c49a6c', // Darker beige for warning actions
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 12,
    fontWeight: '600',
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
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e8e3db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2c2419', // Dark brown text
    backgroundColor: '#ffffff',
    minHeight: 120,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#8b4513', // Darker brown for primary actions
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  submitButtonDisabled: {
    backgroundColor: '#c49a6c', // Lighter brown for disabled state
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#f0eae0', // Light beige highlight
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  resetButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '500',
  },
  successMessage: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0eae0', // Light beige highlight
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#d4c4a0', // Primary beige accent
  },
  successText: {
    color: '#8b4513', // Darker brown for success text
    fontSize: 14,
    fontWeight: '500',
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e3db',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b4513', // Darker brown for accents
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#6b5e4f', // Medium brown text
  },
  historyText: {
    fontSize: 14,
    color: '#2c2419', // Dark brown text
    lineHeight: 20,
  },
  noDevicesText: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  deviceItem: {
    backgroundColor: '#f0eae0', // Light beige highlight
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: 12,
    color: '#6b5e4f', // Medium brown text
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 12,
    color: '#8b4513', // Darker brown for status
    fontWeight: '500',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusPending: {
    backgroundColor: '#f5e6d3', // Light beige for pending
    color: '#8b4513', // Darker brown text
  },
  statusSent: {
    backgroundColor: '#e8e3db', // Neutral beige for sent
    color: '#6b5e4f', // Medium brown text
  },
  statusVerified: {
    backgroundColor: '#f0eae0', // Light beige for verified
    color: '#8b4513', // Darker brown text
  },
  deviceInfo: {
    fontSize: 12,
    color: '#8b4513', // Darker brown for info
    fontWeight: '500',
    marginTop: 8,
    fontStyle: 'italic',
  },
  responseContainer: {
    backgroundColor: '#f0eae0', // Light beige highlight
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#d4c4a0', // Primary beige accent
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b4513', // Darker brown for labels
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    color: '#2c2419', // Dark brown text
    lineHeight: 18,
  },
});

export default KYCDashboardScreen;
