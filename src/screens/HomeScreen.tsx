import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import ScannerScreen from './ScannerScreen';
import KYCDashboardScreen from './KYCDashboardScreen';
import ShowAadhaarDataScreen from './ShowAadhaarDataScreen';

const HomeScreen = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'kyc' | 'scanner'>(
    'home',
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <ShowAadhaarDataScreen />;
      case 'kyc':
        return <KYCDashboardScreen />;
      case 'scanner':
        return <ScannerScreen />;
      default:
        return <ShowAadhaarDataScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f6f3" />

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'home' && styles.activeTab]}
          onPress={() => setActiveTab('home')}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'home' && styles.activeTabText,
            ]}
          >
            Identity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'kyc' && styles.activeTab]}
          onPress={() => setActiveTab('kyc')}
        >
          <Text style={styles.tabIcon}>📋</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'kyc' && styles.activeTabText,
            ]}
          >
            KYC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'scanner' && styles.activeTab]}
          onPress={() => setActiveTab('scanner')}
        >
          <Text style={styles.tabIcon}>🔍</Text>
          <Text
            style={[
              styles.tabText,
              activeTab === 'scanner' && styles.activeTabText,
            ]}
          >
            Scanner
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3', // Primary beige background
  },
  // Header Styles
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e3db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c2419', // Dark brown text
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
    fontWeight: '500',
  },
  // Content Styles
  content: {
    flex: 1,
    backgroundColor: '#f8f6f3', // Primary beige background
  },
  // Bottom Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8e3db',
    paddingBottom: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  activeTab: {
    backgroundColor: '#f0eae0', // Light beige highlight
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 4,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b5e4f', // Medium brown text
    textAlign: 'center',
  },
  activeTabText: {
    color: '#8b4513', // Darker brown for active state
    fontWeight: '600',
  },
  // Legacy styles for compatibility
  tabContent: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
    color: '#2c2419',
  },
  scanButton: {
    backgroundColor: '#d4c4a0', // Primary beige accent
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonText: {
    color: '#2c2419',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#d4c4a0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2c2419',
  },
  value: {
    fontSize: 14,
    color: '#6b5e4f',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  scannerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanDescription: {
    fontSize: 16,
    color: '#6b5e4f',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: '#f0eae0',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#d4c4a0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8b4513',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#6b5e4f',
    marginBottom: 5,
    paddingLeft: 10,
  },
  cameraFrame: {
    position: 'relative',
    width: 250,
    height: 250,
    marginVertical: 20,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0eae0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cameraText: {
    fontSize: 48,
    marginBottom: 10,
  },
  cameraLabel: {
    fontSize: 14,
    color: '#6b5e4f',
    fontWeight: '500',
  },
  scanFrameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#d4c4a0',
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#d4c4a0',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#d4c4a0',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#d4c4a0',
  },
  p2pSection: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c2419',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b5e4f',
    marginBottom: 20,
    lineHeight: 20,
  },
  p2pButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e3db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  p2pButtonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  p2pButtonContent: {
    flex: 1,
  },
  p2pButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c2419',
    marginBottom: 2,
  },
  p2pButtonDescription: {
    fontSize: 12,
    color: '#6b5e4f',
  },
});

export default HomeScreen;
