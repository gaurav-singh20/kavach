import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import P2PService, { P2PMessage, P2PDevice } from '../utils/p2p/P2PService';

export default function P2PMessagingScreen() {
  const [messages, setMessages] = useState<P2PMessage[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<P2PDevice[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Listen for messages and connection changes
  useFocusEffect(
    useCallback(() => {
      P2PService.addMessageListener(handleMessageReceived);
      P2PService.addConnectionListener(handleConnectionChanged);

      // Get current connected devices
      setConnectedDevices(P2PService.getConnectedDevices());

      return () => {
        P2PService.removeMessageListener(handleMessageReceived);
        P2PService.removeConnectionListener(handleConnectionChanged);
      };
    }, []),
  );

  const handleMessageReceived = useCallback((message: P2PMessage) => {
    setMessages(prev => [...prev, message]);

    // Scroll to bottom when new message arrives
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

        // Add system message about connection
        const systemMessage: P2PMessage = {
          id: Date.now().toString(),
          fromDevice: 'System',
          toDevice: 'local',
          message: `${device.deviceName} connected`,
          timestamp: Date.now(),
          type: 'system',
        };
        setMessages(prev => [...prev, systemMessage]);
      } else {
        setConnectedDevices(prev =>
          prev.filter(d => d.deviceAddress !== device.deviceAddress),
        );

        // Add system message about disconnection
        const systemMessage: P2PMessage = {
          id: Date.now().toString(),
          fromDevice: 'System',
          toDevice: 'local',
          message: `${device.deviceName} disconnected`,
          timestamp: Date.now(),
          type: 'system',
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    },
    [],
  );

  const sendMessage = async () => {
    if (!messageText.trim() || isSending) {
      return;
    }

    if (connectedDevices.length === 0) {
      Alert.alert(
        'No Connection',
        'Please connect to a device first to send messages.',
      );
      return;
    }

    try {
      setIsSending(true);
      const success = await P2PService.sendMessage(messageText.trim());

      if (success) {
        // Add sent message to local list
        const sentMessage: P2PMessage = {
          id: Date.now().toString(),
          fromDevice: 'You',
          toDevice: connectedDevices[0].deviceAddress,
          message: messageText.trim(),
          timestamp: Date.now(),
          type: 'chat',
        };

        setMessages(prev => [...prev, sentMessage]);
        setMessageText('');

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const sendVerificationData = async (verificationResult: any) => {
    if (connectedDevices.length === 0) {
      Alert.alert(
        'No Connection',
        'Please connect to a device first to share verification results.',
      );
      return;
    }

    try {
      const success = await P2PService.sendVerificationData(verificationResult);

      if (success) {
        // Add verification message to local list
        const verificationMessage: P2PMessage = {
          id: Date.now().toString(),
          fromDevice: 'You',
          toDevice: connectedDevices[0].deviceAddress,
          message: 'Shared verification result',
          timestamp: Date.now(),
          type: 'verification',
        };

        setMessages(prev => [...prev, verificationMessage]);

        // Alert.alert('Success', 'Verification result shared successfully');
      } else {
        Alert.alert('Error', 'Failed to share verification result');
      }
    } catch (error) {
      console.error('Failed to share verification:', error);
      Alert.alert('Error', 'Failed to share verification result');
    }
  };

  const renderMessage = ({ item }: { item: P2PMessage }) => {
    const isOwnMessage = item.fromDevice === 'You';
    const isSystemMessage = item.type === 'system';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
            item.type === 'verification' && styles.verificationBubble,
          ]}
        >
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.fromDevice}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.message}
          </Text>
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {item.type === 'verification' && (
            <Text style={styles.verificationLabel}>📋 Verification Data</Text>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Messages</Text>
      <Text style={styles.emptyStateText}>
        {connectedDevices.length === 0
          ? 'Connect to a device to start messaging'
          : 'Start a conversation!'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>P2P Messages</Text>
          {connectedDevices.length > 0 && (
            <Text style={styles.connectedInfo}>
              Connected to {connectedDevices.length} device(s)
            </Text>
          )}
        </View>

        {/* Connected Devices Info */}
        {connectedDevices.length > 0 && (
          <View style={styles.connectedDevicesBar}>
            {connectedDevices.map(device => (
              <View
                key={device.deviceAddress}
                style={styles.connectedDeviceChip}
              >
                <Text style={styles.connectedDeviceText}>
                  🟢 {device.deviceName}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        {/* Message Input */}
        {connectedDevices.length > 0 && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="#888888"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              editable={!isSending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || isSending}
            >
              <Text style={styles.sendButtonText}>
                {isSending ? '...' : '→'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        {connectedDevices.length > 0 && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => sendVerificationData({ test: 'verification' })}
            >
              <Text style={styles.quickActionText}>📋 Share Verification</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
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
  connectedInfo: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
  },
  connectedDevicesBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  connectedDeviceChip: {
    backgroundColor: '#007AFF20',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
  },
  connectedDeviceText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  messagesList: {
    flexGrow: 1,
    padding: 20,
  },
  messageContainer: {
    marginBottom: 15,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: '#333333',
  },
  verificationBubble: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  senderName: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  ownTimestamp: {
    color: '#ffffff88',
  },
  otherTimestamp: {
    color: '#888888',
  },
  verificationLabel: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 4,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333333',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
  },
  quickActionButton: {
    backgroundColor: '#333333',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  quickActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});
