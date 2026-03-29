/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import VerificationResultScreen from './src/screens/VerificationResultScreen';
import DeviceDiscoveryScreen from './src/screens/DeviceDiscoveryScreen';
import P2PMessagingScreen from './src/screens/P2PMessagingScreen';
import P2PTestScreen from './src/screens/P2PTestScreen';
import KYCDashboardScreen from './src/screens/KYCDashboardScreen';
import ShowAadhaarDataScreen from './src/screens/ShowAadhaarDataScreen';

// Define the navigation types
export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  VerificationResult: {
    verificationResult: any;
  };
  DeviceDiscovery: undefined;
  P2PMessaging: undefined;
  P2PTest: undefined;
  KYCDashboard: undefined;
  ShowAadhaarData: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>(); 

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
          <Stack.Screen
            name="VerificationResult"
            component={VerificationResultScreen}
          />
          <Stack.Screen
            name="DeviceDiscovery"
            component={DeviceDiscoveryScreen}
          />
          <Stack.Screen name="P2PMessaging" component={P2PMessagingScreen} /> 
          <Stack.Screen name="P2PTest" component={P2PTestScreen} />
          <Stack.Screen name="KYCDashboard" component={KYCDashboardScreen} />
          <Stack.Screen
            name="ShowAadhaarData"
            component={ShowAadhaarDataScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
