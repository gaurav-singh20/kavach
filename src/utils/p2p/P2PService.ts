import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import {
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
  Permission,
} from 'react-native-permissions';

const { WifiP2pModule } = NativeModules;

// Debug logging
console.log('Available NativeModules:', Object.keys(NativeModules));
console.log('WifiP2pModule available:', !!WifiP2pModule);
if (WifiP2pModule) {
  console.log('WifiP2pModule methods:', Object.keys(WifiP2pModule));
}

// Check if the native module is available
if (!WifiP2pModule) {
  console.warn(
    'WifiP2pModule is not available. Make sure the native module is properly linked.',
  );
}

export interface P2PDevice {
  deviceName: string;
  deviceAddress: string;
  isGroupOwner?: boolean;
  status?: 'CONNECTED' | 'INVITED' | 'FAILED' | 'AVAILABLE' | 'UNAVAILABLE';
}

export interface P2PMessage {
  id: string;
  fromDevice: string;
  toDevice: string;
  message: string;
  timestamp: number;
  type: 'verification' | 'chat' | 'system' | 'consent';
}

class P2PService {
  private isInitialized = false;
  private discoveredDevices: P2PDevice[] = [];
  private connectedDevices: P2PDevice[] = [];
  private messageListeners: ((message: P2PMessage) => void)[] = [];
  private deviceListeners: ((devices: P2PDevice[]) => void)[] = [];
  private connectionListeners: ((
    device: P2PDevice,
    connected: boolean,
  ) => void)[] = [];

  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isConnecting = false;

  constructor() {
    this.setupEventListeners();
  }

  // Initialize P2P service
  async initialize(): Promise<boolean> {
    try {
      console.log('Starting P2P initialization...');

      // Check if native module is available
      if (!WifiP2pModule) {
        console.error('WifiP2pModule not found in NativeModules');
        throw new Error(
          'WiFi P2P native module not available. Make sure the app is rebuilt after adding the module.',
        );
      }

      console.log('WifiP2pModule found, requesting permissions...');

      // Request necessary permissions
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error(
          'Required permissions not granted. Please enable location permissions for WiFi Direct to work.',
        );
      }

      console.log('Permissions granted, initializing WiFi P2P...');

      // Initialize WiFi P2P
      await WifiP2pModule.initialize();

      // Set device name to identify as Kavach app
      try {
        const deviceName = await this.generateDeviceName();
        await WifiP2pModule.setDeviceName(deviceName);
        console.log('Device name set to:', `Kavach-${deviceName}`);
      } catch (error) {
        console.warn('Could not set device name:', error);
        // Continue initialization even if device name setting fails
      }

      this.isInitialized = true;

      console.log('P2P Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize P2P Service:', error);
      return false;
    }
  }

  // Request necessary permissions for WiFi Direct
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true; // iOS permissions handled differently
      }

      const permissions: Permission[] = [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ];

      // Check for Android 13+ permissions
      if (Platform.Version >= 33) {
        permissions.push(PERMISSIONS.ANDROID.NEARBY_WIFI_DEVICES);
      }

      console.log('Requesting permissions:', permissions);

      // Request permissions one by one for better debugging
      const results: Record<string, any> = {};
      for (const permission of permissions) {
        try {
          console.log(`Requesting permission: ${permission}`);
          results[permission] = await request(permission);
          console.log(
            `Permission ${permission} result: ${results[permission]}`,
          );

          if (results[permission] === RESULTS.DENIED) {
            console.error(`Critical permission denied: ${permission}`);
            console.error(
              'Please go to Settings > Apps > Kavach > Permissions and enable Location permissions',
            );
            return false;
          }

          if (results[permission] === RESULTS.BLOCKED) {
            console.error(
              `Permission blocked (never ask again): ${permission}`,
            );
            console.error(
              'Please go to Settings > Apps > Kavach > Permissions and manually enable Location permissions',
            );
            return false;
          }
        } catch (permError) {
          console.error(
            `Error requesting permission ${permission}:`,
            permError,
          );
          return false;
        }
      }

      console.log('All permission results:', results);

      const allGranted = Object.values(results).every(
        result => result === RESULTS.GRANTED,
      );

      if (!allGranted) {
        console.error(
          'Not all permissions granted. WiFi Direct requires precise location access.',
        );
        console.error('Please ensure:');
        console.error('1. Location services are enabled system-wide');
        console.error(
          '2. App has "Precise location" permission (not just "Approximate")',
        );
        console.error(
          '3. Location permission is set to "Allow all the time" or "Allow only while using app"',
        );
      }

      console.log('All permissions granted:', allGranted);
      return allGranted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  // Setup event listeners for P2P events
  private setupEventListeners() {
    // Device discovery events
    DeviceEventEmitter.addListener('WIFI_P2P_PEERS_CHANGED', event => {
      this.handlePeersChanged(event.devices);
    });

    // Connection state changes
    DeviceEventEmitter.addListener('WIFI_P2P_CONNECTION_CHANGED', event => {
      this.handleConnectionChanged(event);
    });

    // Incoming messages
    DeviceEventEmitter.addListener('WIFI_P2P_MESSAGE_RECEIVED', event => {
      this.handleMessageReceived(event);
    });

    // Error events
    DeviceEventEmitter.addListener('WIFI_P2P_ERROR', event => {
      console.error('WiFi P2P Error:', event);
      if (event.error === 'PERMISSION_DENIED') {
        console.error('CRITICAL: Location permission denied at system level!');
        console.error('Solution: Go to Settings > Apps > Kavach > Permissions');
        console.error('1. Enable Location permission');
        console.error('2. Set to "Precise" location (not Approximate)');
        console.error('3. Ensure Location Services are enabled system-wide');
      }
    });

    // Device state changes
    DeviceEventEmitter.addListener('WIFI_P2P_STATE_CHANGED', event => {
      console.log('WiFi P2P State Changed:', event.isEnabled);
    });
  }

  // Start discovering nearby devices
  async startDiscovery(): Promise<void> {
    console.log('Starting device discovery for Kavach devices...');

    if (!this.isInitialized) {
      throw new Error('P2P Service not initialized. Please initialize first.');
    }

    if (!WifiP2pModule) {
      throw new Error('WiFi P2P native module not available');
    }

    try {
      console.log(
        'Calling WifiP2pModule.startPeerDiscovery (filtering for Kavach devices)...',
      );
      await WifiP2pModule.startPeerDiscovery();
      console.log(
        'Started peer discovery successfully - only Kavach devices will be shown',
      );
    } catch (error) {
      console.error('Failed to start discovery:', error);

      // Check if it's a permission error (error code 0 usually means permission denied)
      if (error && (error as any).code === '0') {
        throw new Error(
          'Permission denied. Please ensure location services are enabled and location permission is granted.',
        );
      }

      throw error;
    }
  }

  // Stop discovering devices
  async stopDiscovery(): Promise<void> {
    try {
      await WifiP2pModule.stopPeerDiscovery();
      console.log('Stopped peer discovery');
    } catch (error) {
      console.error('Failed to stop discovery:', error);
    }
  }

  // Check if all required permissions are currently granted
  async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const permissions: Permission[] = [
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ];

      if (Platform.Version >= 33) {
        permissions.push(PERMISSIONS.ANDROID.NEARBY_WIFI_DEVICES);
      }

      const results = await requestMultiple(permissions);
      const allGranted = Object.values(results).every(
        result => result === RESULTS.GRANTED,
      );

      if (!allGranted) {
        console.error('Permissions not granted:', results);
      }

      return allGranted;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  // Manually establish socket connection (useful for debugging)
  async establishSocketConnection(): Promise<boolean> {
    try {
      console.log('Manually establishing socket connection...');
      await this.checkAndEstablishSocketConnection();
      return true;
    } catch (error) {
      console.error('Failed to establish socket connection:', error);
      return false;
    }
  }

  // Retry connection to a device (useful when initial connection fails)
  async retryConnection(device: P2PDevice): Promise<boolean> {
    try {
      console.log('Retrying connection to device:', device.deviceAddress);

      // First disconnect any existing connections
      if (WifiP2pModule.disconnect) {
        try {
          await WifiP2pModule.disconnect();
          console.log('Disconnected previous connection');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        } catch (disconnectError) {
          console.log('No previous connection to disconnect');
        }
      }

      // Reset connection state
      this.isConnecting = false;

      // Try connecting again
      return await this.connectToDevice(device);
    } catch (error) {
      console.error('Retry connection failed:', error);
      return false;
    }
  }

  // Comprehensive diagnostic check
  async runDiagnostics(): Promise<any> {
    try {
      console.log('Running P2P diagnostics...');

      // Check React Native permissions
      const rnPermissions = await this.checkPermissions();
      console.log('RN Permissions granted:', rnPermissions);

      // Check native permissions and system state
      if (WifiP2pModule && WifiP2pModule.checkPermissions) {
        const nativeCheck = await WifiP2pModule.checkPermissions();
        console.log('Native permission check:', nativeCheck);

        // Also check connection info
        let connectionInfo = null;
        if (WifiP2pModule.requestConnectionInfo) {
          try {
            connectionInfo = await WifiP2pModule.requestConnectionInfo();
            console.log('Current connection info:', connectionInfo);
          } catch (connError) {
            console.error('Failed to get connection info:', connError);
          }
        }

        const diagnostics = {
          rnPermissions,
          nativePermissions: nativeCheck,
          connectionInfo,
          isInitialized: this.isInitialized,
          moduleAvailable: !!WifiP2pModule,
          connectedDevices: this.connectedDevices.length,
          discoveredDevices: this.discoveredDevices.length,
        };

        console.log('Full diagnostics:', diagnostics);
        return diagnostics;
      } else {
        console.error('Native checkPermissions method not available');
        return {
          rnPermissions,
          nativePermissions: null,
          isInitialized: this.isInitialized,
          moduleAvailable: !!WifiP2pModule,
          error: 'Native module not properly linked',
        };
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitialized: this.isInitialized,
        moduleAvailable: !!WifiP2pModule,
      };
    }
  }

  // Connect to a discovered device
  async connectToDevice(device: P2PDevice): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('P2P Service not initialized');
      }

      // Check permissions before attempting connection
      console.log('Checking permissions before connection...');
      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.error('Missing required permissions for connection');
        console.error(
          'Please go to Settings > Apps > Kavach > Permissions and ensure:',
        );
        console.error(
          '1. Location is set to "Allow all the time" or "Allow only while using app"',
        );
        console.error(
          '2. Location accuracy is set to "Precise" (not Approximate)',
        );
        console.error('3. Nearby devices permission is granted (Android 13+)');
        throw new Error(
          'Missing required permissions. Please enable precise location access in app settings.',
        );
      }

      if (this.isConnecting) {
        console.log('Connection already in progress, ignoring new request');
        return false;
      }

      this.isConnecting = true;
      console.log('Connecting to device:', device.deviceAddress);

      // Clear any existing timeout for this device
      const existingTimeout = this.connectionTimeouts.get(device.deviceAddress);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.connectionTimeouts.delete(device.deviceAddress);
      }

      // Create a promise that resolves when the connection is fully established
      return new Promise<boolean>((resolve, reject) => {
        let connectionEstablished = false;
        let timeoutCleared = false;

        // Set connection timeout
        const timeoutId = setTimeout(async () => {
          if (connectionEstablished || timeoutCleared) return;

          console.log('Connection timeout for device:', device.deviceAddress);
          timeoutCleared = true;

          // Check if connection actually succeeded despite timeout
          console.log('Checking connection status after timeout...');
          try {
            if (WifiP2pModule.requestConnectionInfo) {
              const connectionInfo =
                await WifiP2pModule.requestConnectionInfo();
              if (connectionInfo && connectionInfo.groupFormed) {
                console.log(
                  'Connection actually succeeded, establishing socket connection...',
                );
                await this.checkAndEstablishSocketConnection();
                connectionEstablished = true;
                this.isConnecting = false;
                this.connectionTimeouts.delete(device.deviceAddress);
                resolve(true);
                return;
              }
            }
          } catch (error) {
            console.error('Error checking connection after timeout:', error);
          }

          this.isConnecting = false;
          this.connectionTimeouts.delete(device.deviceAddress);

          // Notify listeners of connection failure
          this.connectionListeners.forEach(listener => {
            try {
              listener(device, false);
            } catch (error) {
              console.error('Error in connection listener:', error);
            }
          });

          reject(new Error('Connection timeout'));
        }, 30000); // 30 second timeout

        this.connectionTimeouts.set(device.deviceAddress, timeoutId);

        // Start the connection process
        WifiP2pModule.connect(device.deviceAddress)
          .then((result: any) => {
            if (!result) {
              if (!timeoutCleared) {
                clearTimeout(timeoutId);
                this.connectionTimeouts.delete(device.deviceAddress);
              }
              this.isConnecting = false;
              reject(new Error('Failed to initiate connection'));
              return;
            }

            console.log(
              'WiFi Direct connection initiated, waiting for group formation...',
            );

            // Check connection status with proper promise resolution
            const checkConnection = async (attempt: number, delay: number) => {
              if (connectionEstablished || timeoutCleared) return;

              setTimeout(async () => {
                if (connectionEstablished || timeoutCleared) return;

                try {
                  console.log(`Connection check attempt ${attempt}...`);
                  if (WifiP2pModule.requestConnectionInfo) {
                    const connectionInfo =
                      await WifiP2pModule.requestConnectionInfo();
                    console.log(
                      `Connection info (attempt ${attempt}):`,
                      connectionInfo,
                    );

                    if (connectionInfo && connectionInfo.groupFormed) {
                      connectionEstablished = true;
                      console.log(
                        'WiFi Direct connection established successfully!',
                      );

                      // Clear timeout since connection succeeded
                      if (!timeoutCleared) {
                        clearTimeout(timeoutId);
                        this.connectionTimeouts.delete(device.deviceAddress);
                        timeoutCleared = true;
                      }

                      try {
                        await this.checkAndEstablishSocketConnection();
                        this.isConnecting = false;

                        // Notify listeners of successful connection
                        this.connectionListeners.forEach(listener => {
                          try {
                            listener(device, true);
                          } catch (error) {
                            console.error(
                              'Error in connection listener:',
                              error,
                            );
                          }
                        });

                        resolve(true);
                      } catch (socketError) {
                        console.error('Socket connection failed:', socketError);
                        this.isConnecting = false;
                        reject(new Error('Socket connection failed'));
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `Connection check attempt ${attempt} failed:`,
                    error,
                  );
                }
              }, delay);
            };

            // Check connection status at intervals: 2s, 5s, 10s, 15s, 20s, 25s
            checkConnection(1, 2000);
            checkConnection(2, 5000);
            checkConnection(3, 10000);
            checkConnection(4, 15000);
            checkConnection(5, 20000);
            checkConnection(6, 25000);
          })
          .catch((error: any) => {
            if (!timeoutCleared) {
              clearTimeout(timeoutId);
              this.connectionTimeouts.delete(device.deviceAddress);
            }
            this.isConnecting = false;
            reject(error);
          });
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to connect to device:', error);

      // Clear timeout on error
      const timeout = this.connectionTimeouts.get(device.deviceAddress);
      if (timeout) {
        clearTimeout(timeout);
        this.connectionTimeouts.delete(device.deviceAddress);
      }

      throw error;
    }
  }

  // Check connection status and establish socket connection if needed
  private async checkAndEstablishSocketConnection(): Promise<void> {
    try {
      console.log(
        'Checking connection status and establishing socket connection...',
      );

      if (WifiP2pModule.requestConnectionInfo) {
        const connectionInfo = await WifiP2pModule.requestConnectionInfo();
        console.log('Connection info:', connectionInfo);

        if (connectionInfo.groupFormed) {
          console.log('Group formed successfully');

          if (
            !connectionInfo.isGroupOwner &&
            connectionInfo.groupOwnerAddress
          ) {
            // We're the client, force connect to server
            console.log(
              'Forcing client connection to server:',
              connectionInfo.groupOwnerAddress,
            );

            const maxRetries = 3;
            let retryCount = 0;

            const attemptConnection = async (): Promise<void> => {
              try {
                await WifiP2pModule.forceClientConnection(
                  connectionInfo.groupOwnerAddress,
                );
                console.log('Socket connection established successfully');
              } catch (socketError) {
                retryCount++;
                console.error(
                  `Socket connection attempt ${retryCount} failed:`,
                  socketError,
                );

                if (retryCount < maxRetries) {
                  console.log(
                    `Retrying socket connection in 2 seconds (attempt ${
                      retryCount + 1
                    }/${maxRetries})...`,
                  );
                  setTimeout(attemptConnection, 2000);
                } else {
                  console.error('All socket connection attempts failed');
                }
              }
            };

            await attemptConnection();
          } else if (connectionInfo.isGroupOwner) {
            console.log('We are the group owner, server should be running');
            console.log('Waiting for client to connect to our server...');
          }
        } else {
          console.log('Group not formed yet, retrying in 2 seconds...');
          setTimeout(() => this.checkAndEstablishSocketConnection(), 2000);
        }
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  }

  // Disconnect from all devices and reset P2P service
  async disconnect(): Promise<boolean> {
    try {
      console.log(
        'Disconnecting from all devices and resetting P2P service...',
      );

      // Stop discovery first
      if (WifiP2pModule.stopDiscovery) {
        try {
          await WifiP2pModule.stopDiscovery();
          console.log('Discovery stopped');
        } catch (error) {
          console.log('Error stopping discovery:', error);
        }
      }

      // Disconnect from WiFi P2P
      const success = await WifiP2pModule.disconnect();

      if (success) {
        console.log('Disconnected from WiFi P2P successfully');
      } else {
        console.log(
          'WiFi P2P disconnect failed or no connection to disconnect',
        );
      }

      // Clear all state
      this.connectedDevices = [];
      this.discoveredDevices = [];
      this.isConnecting = false;

      // Clear any pending timeouts
      this.connectionTimeouts.forEach((timeout, address) => {
        clearTimeout(timeout);
      });
      this.connectionTimeouts.clear();

      console.log('P2P service state reset');
      return success;
    } catch (error) {
      console.error('Failed to disconnect and reset P2P service:', error);
      return false;
    }
  }

  // Disconnect from a device
  async disconnectFromDevice(device: P2PDevice): Promise<boolean> {
    try {
      console.log(`Attempting to disconnect from device: ${device.deviceName}`);

      const success = await WifiP2pModule.disconnect();

      if (success) {
        console.log(
          `Disconnect initiated successfully from: ${device.deviceName}`,
        );

        // Remove from connected devices immediately (will be confirmed by event)
        this.connectedDevices = this.connectedDevices.filter(
          d => d.deviceAddress !== device.deviceAddress,
        );

        // Restart discovery after disconnect
        setTimeout(() => this.startDiscovery(), 1000);
      } else {
        console.log(`Disconnect failed from: ${device.deviceName}`);
      }

      return success;
    } catch (error) {
      console.error('Failed to disconnect from device:', error);
      return false;
    }
  }

  // Send message to connected device
  async sendMessage(
    message: string,
    targetDevice?: P2PDevice,
    messageType: 'chat' | 'consent' | 'verification' | 'system' = 'chat',
  ): Promise<boolean> {
    try {
      const p2pMessage: P2PMessage = {
        id: Date.now().toString(),
        fromDevice: await this.getDeviceName(),
        toDevice: targetDevice?.deviceAddress || 'broadcast',
        message,
        timestamp: Date.now(),
        type: messageType,
      };

      const success = await WifiP2pModule.sendMessage(
        JSON.stringify(p2pMessage),
      );
      return success;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  // Send verification data to connected device
  async sendVerificationData(
    verificationData: any,
    targetDevice?: P2PDevice,
  ): Promise<boolean> {
    try {
      const p2pMessage: P2PMessage = {
        id: Date.now().toString(),
        fromDevice: await this.getDeviceName(),
        toDevice: targetDevice?.deviceAddress || 'broadcast',
        message: JSON.stringify(verificationData),
        timestamp: Date.now(),
        type: 'verification',
      };

      const success = await WifiP2pModule.sendMessage(
        JSON.stringify(p2pMessage),
      );
      return success;
    } catch (error) {
      console.error('Failed to send verification data:', error);
      return false;
    }
  }

  // Get current device name
  private async getDeviceName(): Promise<string> {
    try {
      return await WifiP2pModule.getDeviceName();
    } catch (error) {
      return 'Unknown Device';
    }
  }

  // Get connection status for debugging
  async getConnectionStatus(): Promise<any> {
    try {
      return await WifiP2pModule.getConnectionStatus();
    } catch (error) {
      console.error('Failed to get connection status:', error);
      return null;
    }
  }

  // Generate a unique device name for this app instance
  private async generateDeviceName(): Promise<string> {
    try {
      // Try to get existing device name first
      const existingName = await this.getDeviceName();

      // If it already has our prefix, extract the base name
      if (existingName && existingName.startsWith('Kavach-')) {
        return existingName.substring(7); // Remove 'Kavach-' prefix
      }

      // Generate a new name based on device info
      const deviceId = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `Device-${deviceId}`;
    } catch (error) {
      console.warn('Could not generate device name:', error);
      // Fallback to a simple random name
      const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `KVH-${randomId}`;
    }
  }

  // Handle peers changed event
  private handlePeersChanged(devices: any[]) {
    this.discoveredDevices = devices.map(device => ({
      deviceName: device.deviceName || 'Unknown Device',
      deviceAddress: device.deviceAddress,
      status: device.status || 'AVAILABLE',
    }));

    // Notify listeners
    this.deviceListeners.forEach(listener => listener(this.discoveredDevices));
  }

  // Handle connection changed event
  private handleConnectionChanged(event: any) {
    console.log('Connection changed event:', event);

    const { isConnected, device, isGroupOwner, groupOwnerAddress } = event;

    if (isConnected && device && device.deviceAddress) {
      // Only process if we have a valid device with a proper device address
      const connectedDevice: P2PDevice = {
        deviceName: device.deviceName || 'Unknown Device',
        deviceAddress: device.deviceAddress, // Use only the actual device address, not IP
        status: 'CONNECTED',
        isGroupOwner,
      };

      console.log(
        `Device connected: ${connectedDevice.deviceName} (${
          connectedDevice.deviceAddress
        }) ${isGroupOwner ? 'as Group Owner' : 'as Client'}`,
      );

      // Clear connection timeout
      const timeoutId = this.connectionTimeouts.get(
        connectedDevice.deviceAddress,
      );
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.connectionTimeouts.delete(connectedDevice.deviceAddress);
      }
      this.isConnecting = false;

      // Update or add to connected devices (avoid duplicates)
      const existingIndex = this.connectedDevices.findIndex(
        d => d.deviceAddress === connectedDevice.deviceAddress,
      );

      if (existingIndex >= 0) {
        this.connectedDevices[existingIndex] = connectedDevice;
      } else {
        this.connectedDevices.push(connectedDevice);
      }

      // Update device status in discovered devices
      this.discoveredDevices = this.discoveredDevices.map(d =>
        d.deviceAddress === connectedDevice.deviceAddress
          ? { ...d, status: 'CONNECTED' }
          : d,
      );

      // Notify listeners
      this.connectionListeners.forEach(listener =>
        listener(connectedDevice, true),
      );

      // Update device list listeners
      this.deviceListeners.forEach(listener =>
        listener(this.discoveredDevices),
      );

      // Automatically establish socket connection
      console.log(
        'WiFi Direct connection established, setting up socket connection...',
      );
      setTimeout(() => {
        this.checkAndEstablishSocketConnection();
      }, 1000); // Wait 1 second for the connection to fully establish
    } else if (isConnected) {
      // Connection established but no valid device info - just log for debugging
      console.log(
        'Connection established but no valid device information provided',
      );
      console.log('Event details:', {
        isConnected,
        device,
        isGroupOwner,
        groupOwnerAddress,
      });
    } else {
      console.log('Device disconnected or connection failed');

      // Handle disconnection
      if (device && device.deviceAddress) {
        const disconnectedDevice: P2PDevice = {
          deviceName: device.deviceName || 'Disconnected Device',
          deviceAddress: device.deviceAddress,
          status: 'AVAILABLE',
        };

        this.connectedDevices = this.connectedDevices.filter(
          d => d.deviceAddress !== device.deviceAddress,
        );

        // Update device status in discovered devices
        this.discoveredDevices = this.discoveredDevices.map(d =>
          d.deviceAddress === disconnectedDevice.deviceAddress
            ? { ...d, status: 'AVAILABLE' }
            : d,
        );

        // Notify listeners
        this.connectionListeners.forEach(listener =>
          listener(disconnectedDevice, false),
        );

        // Update device list listeners
        this.deviceListeners.forEach(listener =>
          listener(this.discoveredDevices),
        );
      } else {
        // General disconnection - clear all connections
        console.log('Clearing all connections due to general disconnection');
        const wasConnected = this.connectedDevices.length > 0;

        if (wasConnected) {
          // Notify about all disconnections
          this.connectedDevices.forEach(device => {
            this.connectionListeners.forEach(listener =>
              listener({ ...device, status: 'AVAILABLE' }, false),
            );
          });
        }

        this.connectedDevices = [];

        // Reset all device statuses
        this.discoveredDevices = this.discoveredDevices.map(d => ({
          ...d,
          status: 'AVAILABLE',
        }));

        // Update device list listeners
        this.deviceListeners.forEach(listener =>
          listener(this.discoveredDevices),
        );
      }
    }
  }

  // Handle incoming message
  private handleMessageReceived(event: any) {
    try {
      const message: P2PMessage = JSON.parse(event.message);
      console.log('Received P2P message:', message);

      // Notify message listeners
      this.messageListeners.forEach(listener => listener(message));
    } catch (error) {
      console.error('Failed to parse received message:', error);
    }
  }

  // Add message listener
  addMessageListener(listener: (message: P2PMessage) => void) {
    this.messageListeners.push(listener);
  }

  // Remove message listener
  removeMessageListener(listener: (message: P2PMessage) => void) {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  // Add device discovery listener
  addDeviceListener(listener: (devices: P2PDevice[]) => void) {
    this.deviceListeners.push(listener);
  }

  // Remove device discovery listener
  removeDeviceListener(listener: (devices: P2PDevice[]) => void) {
    this.deviceListeners = this.deviceListeners.filter(l => l !== listener);
  }

  // Add connection listener
  addConnectionListener(
    listener: (device: P2PDevice, connected: boolean) => void,
  ) {
    this.connectionListeners.push(listener);
  }

  // Remove connection listener
  removeConnectionListener(
    listener: (device: P2PDevice, connected: boolean) => void,
  ) {
    this.connectionListeners = this.connectionListeners.filter(
      l => l !== listener,
    );
  }

  // Get discovered devices
  getDiscoveredDevices(): P2PDevice[] {
    return this.discoveredDevices;
  }

  // Get connected devices
  getConnectedDevices(): P2PDevice[] {
    return this.connectedDevices;
  }

  // Check if service is initialized
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  // Cleanup service
  cleanup() {
    this.stopDiscovery();
    this.messageListeners = [];
    this.deviceListeners = [];
    this.connectionListeners = [];
    this.discoveredDevices = [];
    this.connectedDevices = [];
    this.isInitialized = false;
  }
}

// Export singleton instance
export default new P2PService();
