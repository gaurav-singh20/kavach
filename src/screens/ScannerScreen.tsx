import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { verifySignature } from '../utils/keys';
import { RootStackParamList } from '../../App';
import { fetchAndStorePemFile, getStoredPemFile } from '../utils/keys';

type ScannerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Scanner'
>;

const ScannerScreen = () => {
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [pem, setPem] = useState(false);
  const [pemData, setPemData] = useState<string | null>(null);
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    };

    const checkPem = async () => {
      try {
        const data = await getStoredPemFile();
        if (!data) {
          setPem(false);
        } else {
          setPem(true);
          setPemData(data);
        }
      } catch (error) {
        console.error('Error checking PEM file:', error);
      }
    };

    getCameraPermissions();
    checkPem();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
    }, []),
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (!scanned && codes.length > 0 && codes[0].value) {
        handleBarCodeScanned(codes[0].value);
      }
    },
  });

  const handleBarCodeScanned = async (data: string) => {
    if (scanned) return;
    setScanned(true);

    try {
      const result = await verifySignature(data);
      navigation.navigate('VerificationResult', { result } as never);
    } catch (error) {
      console.error('Error verifying signature:', error);
      Alert.alert(
        'Verification Error ⚠️',
        'Failed to verify the QR code. Please try again.',
        [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    }
  };

  const handleFetchPEM = async () => {
    try {
      const data = await fetchAndStorePemFile();
      Alert.alert('Success', 'PEM file successfully fetched and stored.');
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch PEM file.');
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={goBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!pem) {
    return (
      <View style={styles.pemContainer}>
        <View style={styles.pemCard}>
          <Text style={styles.pemTitle}>Setup Required</Text>
          <Text style={styles.pemMessage}>
            No PEM file found. Please fetch the PEM file to start scanning.
          </Text>
          <TouchableOpacity style={styles.pemButton} onPress={handleFetchPEM}>
            <Text style={styles.pemButtonText}>Fetch PEM File</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={styles.subtitle}>Align QR code within the frame</Text>

        <View style={styles.scannerContainer}>
          {device && hasPermission && (
            <Camera
              key="scanner-camera"
              style={styles.camera}
              device={device}
              isActive={!scanned && hasPermission}
              codeScanner={codeScanner}
            />
          )}

          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <View style={styles.corners}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
        </View>

        <Text style={styles.statusText}>
          {scanned ? 'Processing...' : 'Ready to scan'}
        </Text>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Text style={styles.subtitle}>{pemData}</Text>
        <TouchableOpacity style={styles.refetchButton} onPress={handleFetchPEM}>
          <Text style={styles.refetchButtonText}>⟲ Refresh Keys</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3', // Primary beige background
  },

  // PEM Setup Screen
  pemContainer: {
    flex: 1,
    backgroundColor: '#f8f6f3', // Primary beige background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  pemTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c2419', // Dark brown text
    marginBottom: 12,
    textAlign: 'center',
  },
  pemMessage: {
    fontSize: 16,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  pemButton: {
    backgroundColor: '#d4c4a0', // Primary beige accent
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pemButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Header
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e3db',
  },
  backButtonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 20,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#2c2419', // Dark brown text
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Main Content
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '400',
  },

  // Scanner
  scannerContainer: {
    position: 'relative',
    width: 280,
    height: 280,
    marginBottom: 32,
  },
  camera: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  scanFrame: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#d4c4a0', // Primary beige accent
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  corners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#d4c4a0', // Primary beige accent
    borderWidth: 3,
  },
  topLeft: {
    top: 16,
    left: 16,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 16,
    right: 16,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 16,
    left: 16,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 16,
    right: 16,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 8,
  },

  // Status Text
  statusText: {
    fontSize: 16,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    fontWeight: '500',
  },

  // Bottom Actions
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  refetchButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e3db',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  refetchButtonText: {
    color: '#6b5e4f', // Medium brown text
    fontSize: 15,
    fontWeight: '500',
  },

  // Legacy styles for error states
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    fontSize: 16,
    color: '#2c2419', // Dark brown text
  },
  button: {
    backgroundColor: '#d4c4a0', // Primary beige accent
    padding: 15,
    borderRadius: 12,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: '#2c2419', // Dark brown text
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScannerScreen;
