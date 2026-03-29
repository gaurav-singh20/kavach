import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeModules, Platform } from 'react-native';
import P2PService from '../utils/p2p/P2PService';

const { WifiP2pModule } = NativeModules;

export default function P2PTestScreen() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp}: ${message}`]);
  };

  const testNativeModule = () => {
    addLog(`Platform: ${Platform.OS}`);
    addLog(`WifiP2pModule available: ${WifiP2pModule ? 'YES' : 'NO'}`);

    if (WifiP2pModule) {
      const methods = Object.keys(WifiP2pModule);
      addLog(`Module methods: ${methods.join(', ')}`);
    } else {
      addLog('Native module not found - check if app was built correctly');
    }

    const allModules = Object.keys(NativeModules);
    addLog(`Total native modules: ${allModules.length}`);
    addLog(`Some modules: ${allModules.slice(0, 5).join(', ')}`);
  };

  const testInitialize = async () => {
    if (!WifiP2pModule) {
      Alert.alert('Error', 'WifiP2pModule not available - rebuild the app');
      return;
    }

    try {
      addLog('Testing native module initialize...');
      await WifiP2pModule.initialize();
      addLog('✅ Native module initialized successfully');
      Alert.alert('Success', 'Native module initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Initialization failed: ${errorMsg}`);
      Alert.alert('Error', `Initialization failed: ${errorMsg}`);
    }
  };

  const testP2PService = async () => {
    try {
      addLog('Testing P2P Service initialization...');
      const result = await P2PService.initialize();
      addLog(`P2P Service init result: ${result}`);

      if (result) {
        addLog('Attempting to start discovery via P2P Service...');
        await P2PService.startDiscovery();
        addLog('✅ Discovery started successfully via P2P Service');

        setTimeout(async () => {
          try {
            await P2PService.stopDiscovery();
            addLog('✅ Discovery stopped successfully');
          } catch (error) {
            addLog(
              `❌ Failed to stop discovery: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }, 3000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ P2P Service test failed: ${errorMsg}`);
    }
  };

  const clearLog = () => {
    setLog([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>P2P Module Debug</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testNativeModule}>
          <Text style={styles.buttonText}>Check Native Module</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testInitialize}>
          <Text style={styles.buttonText}>Test Native Initialize</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testP2PService}>
          <Text style={styles.buttonText}>Test P2P Service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearLog}
        >
          <Text style={styles.buttonText}>Clear Log</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>Debug Log:</Text>
        {log.map((entry, index) => (
          <Text key={index} style={styles.logEntry}>
            {entry}
          </Text>
        ))}
        {log.length === 0 && (
          <Text style={styles.emptyLog}>
            No logs yet. Run a test to see output.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#666666',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 15,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  logEntry: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 4,
  },
  emptyLog: {
    color: '#888888',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 50,
  },
});
