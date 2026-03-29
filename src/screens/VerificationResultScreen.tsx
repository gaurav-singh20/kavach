import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type VerificationResultScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'VerificationResult'
>;

type VerificationResultScreenRouteProp = RouteProp<
  RootStackParamList,
  'VerificationResult'
>;

const VerificationResultScreen = () => {
  const navigation = useNavigation<VerificationResultScreenNavigationProp>();
  const route = useRoute<VerificationResultScreenRouteProp>();
  const { verificationResult: result } = route.params;
  const insets = useSafeAreaInsets();

  const handleDone = () => {
    navigation.goBack();
  };

  const { isValid, decodedData } = result;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              isValid ? styles.validBadge : styles.invalidBadge,
            ]}
          >
            <View
              style={[
                styles.statusIconContainer,
                isValid ? styles.validIconBg : styles.invalidIconBg,
              ]}
            >
              <Text style={styles.statusIcon}>{isValid ? '✓' : '✕'}</Text>
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                {isValid ? 'Verified' : 'Failed'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isValid
                  ? 'Document is authentic'
                  : 'Document could not be verified'}
              </Text>
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>👤 Name</Text>
              <Text style={styles.infoValue}>{decodedData.name}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>🆔 Aadhaar</Text>
              <Text style={styles.infoValue}>{decodedData.aadhaar}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>⚧ Gender</Text>
              <Text style={styles.infoValue}>{decodedData.gender}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>📅 Date of Birth</Text>
              <Text style={styles.infoValue}>
                {decodedData.dob.day}/{decodedData.dob.month}/
                {decodedData.dob.year}
              </Text>
            </View>
          </View>
        </View>

        {/* Verification Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Details</Text>
          <View style={styles.verificationCard}>
            <Text style={styles.verificationTitle}>Digital Signature</Text>
            <Text
              style={[
                styles.verificationStatus,
                isValid ? styles.validText : styles.invalidText,
              ]}
            >
              {isValid ? 'Valid Signature' : 'Invalid Signature'}
            </Text>
            <Text style={styles.verificationDescription}>
              {isValid
                ? 'The digital signature has been verified successfully. This document is authentic and has not been tampered with.'
                : 'The digital signature verification failed. This document may have been tampered with or is not authentic.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View
        style={[
          styles.bottomActions,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },

  // Status Badge
  statusContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 280,
  },
  validBadge: {
    borderWidth: 2,
    borderColor: '#30d158',
  },
  invalidBadge: {
    borderWidth: 2,
    borderColor: '#ff453a',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  validIconBg: {
    backgroundColor: '#30d158',
  },
  invalidIconBg: {
    backgroundColor: '#ff453a',
  },
  statusIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#a0a0a3',
    fontWeight: '500',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  // Info Grid
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007aff',
  },
  infoLabel: {
    fontSize: 14,
    color: '#a0a0a3',
    marginBottom: 6,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // Verification Card
  verificationCard: {
    backgroundColor: '#1c1c1e',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2c2c2e',
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  verificationStatus: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  validText: {
    color: '#30d158',
  },
  invalidText: {
    color: '#ff453a',
  },
  verificationDescription: {
    fontSize: 14,
    color: '#a0a0a3',
    lineHeight: 20,
    fontWeight: '400',
  },

  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1c1c1e',
  },
  doneButton: {
    backgroundColor: '#007aff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerificationResultScreen;
