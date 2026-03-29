import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import P2PService, { P2PDevice } from '../utils/p2p/P2PService';

const getStatusStyle = (status?: string) => {
  switch (status) {
    case 'AVAILABLE':
      return { backgroundColor: '#22c55e20' };
    case 'CONNECTED':
      return { backgroundColor: '#007AFF20' };
    case 'INVITED':
      return { backgroundColor: '#f59e0b20' };
    case 'FAILED':
      return { backgroundColor: '#ef444420' };
    case 'UNAVAILABLE':
      return { backgroundColor: '#64748b20' };
    default:
      return { backgroundColor: '#64748b20' };
  }
};

export default function DeviceDiscoveryScreen() {
  const [devices, setDevices] = useState<P2PDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<P2PDevice[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize P2P service when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      initializeP2P();

      return () => {
        // Cleanup when screen loses focus
        P2PService.stopDiscovery();
        P2PService.removeDeviceListener(handleDevicesChanged);
        P2PService.removeConnectionListener(handleConnectionChanged);
      };
    }, []),
  );

  const initializeP2P = async () => {
    try {
      if (!P2PService.isServiceInitialized()) {
        const initialized = await P2PService.initialize();
        if (!initialized) {
          Alert.alert(
            'Error',
            'Failed to initialize P2P service. Please check permissions and make sure you are on Android.',
          );
          return;
        }
      }

      setIsInitialized(true);

      // Add listeners
      P2PService.addDeviceListener(handleDevicesChanged);
      P2PService.addConnectionListener(handleConnectionChanged);

      // Start discovery automatically
      startDiscovery();
    } catch (error) {
      console.error('Failed to initialize P2P:', error);
      Alert.alert(
        'Error',
        `Failed to initialize P2P service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const handleDevicesChanged = useCallback((discoveredDevices: P2PDevice[]) => {
    setDevices(discoveredDevices);
  }, []);

  const handleConnectionChanged = useCallback(
    (device: P2PDevice, connected: boolean) => {
      if (connected) {
        setConnectedDevices(prev => {
          if (!prev.find(d => d.deviceAddress === device.deviceAddress)) {
            return [...prev, device];
          }
          return prev;
        });
        Alert.alert('Connected', `Connected to ${device.deviceName}`);
      } else {
        setConnectedDevices(prev =>
          prev.filter(d => d.deviceAddress !== device.deviceAddress),
        );
        Alert.alert('Disconnected', `Disconnected from ${device.deviceName}`);
      }
    },
    [],
  );

  const startDiscovery = async () => {
    try {
      setIsDiscovering(true);
      await P2PService.startDiscovery();
    } catch (error) {
      console.error('Failed to start discovery:', error);
      Alert.alert(
        'Error',
        `Failed to start device discovery: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const connectToDevice = async (device: P2PDevice) => {
    try {
      const success = await P2PService.connectToDevice(device);
      if (!success) {
        Alert.alert('Error', `Failed to connect to ${device.deviceName}`);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      Alert.alert('Error', `Failed to connect to ${device.deviceName}`);
    }
  };

  const disconnectFromDevice = async (device: P2PDevice) => {
    try {
      const success = await P2PService.disconnectFromDevice(device);
      if (!success) {
        Alert.alert('Error', `Failed to disconnect from ${device.deviceName}`);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      Alert.alert('Error', `Failed to disconnect from ${device.deviceName}`);
    }
  };

  const renderDevice = ({ item }: { item: P2PDevice }) => {
    const isConnected = connectedDevices.some(
      d => d.deviceAddress === item.deviceAddress,
    );

    return (
      <View style={styles.deviceCard}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {item.deviceName || 'Unknown Device'}
          </Text>
          <Text style={styles.deviceAddress}>{item.deviceAddress}</Text>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{item.status || 'UNKNOWN'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            isConnected ? styles.disconnectButton : styles.connectButton,
          ]}
          onPress={() =>
            isConnected ? disconnectFromDevice(item) : connectToDevice(item)
          }
          disabled={item.status === 'UNAVAILABLE'}
        >
          <Text style={styles.actionButtonText}>
            {isConnected ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Devices Found</Text>
      <Text style={styles.emptyStateText}>
        {isDiscovering
          ? 'Searching for nearby Kavach devices...'
          : 'Pull down to refresh and search for devices'}
      </Text>
      {isDiscovering && (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      )}
    </View>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing P2P Service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Devices</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={startDiscovery}
          disabled={isDiscovering}
        >
          <Text style={styles.refreshButtonText}>
            {isDiscovering ? 'Discovering...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {connectedDevices.length > 0 && (
        <View style={styles.connectedSection}>
          <Text style={styles.sectionTitle}>Connected Devices</Text>
          {connectedDevices.map(device => (
            <View
              key={device.deviceAddress}
              style={[styles.deviceCard, styles.connectedDevice]}
            >
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.deviceName}</Text>
                <Text style={styles.deviceAddress}>{device.deviceAddress}</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, styles.disconnectButton]}
                onPress={() => disconnectFromDevice(device)}
              >
                <Text style={styles.actionButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={item => item.deviceAddress}
        renderItem={renderDevice}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isDiscovering}
            onRefresh={startDiscovery}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={styles.deviceList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  refreshButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  connectedSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  deviceList: {
    padding: 20,
  },
  deviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333333',
  },
  connectedDevice: {
    borderColor: '#007AFF',
    backgroundColor: '#001122',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusAVAILABLE: {
    backgroundColor: '#22c55e20',
  },
  statusCONNECTED: {
    backgroundColor: '#007AFF20',
  },
  statusINVITED: {
    backgroundColor: '#f59e0b20',
  },
  statusFAILED: {
    backgroundColor: '#ef444420',
  },
  statusUNAVAILABLE: {
    backgroundColor: '#64748b20',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#007AFF',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  loader: {
    marginTop: 20,
  },
});
