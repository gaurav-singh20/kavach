package com.kavach.p2p;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.p2p.WifiP2pConfig;
import android.net.wifi.p2p.WifiP2pDevice;
import android.net.wifi.p2p.WifiP2pDeviceList;
import android.net.wifi.p2p.WifiP2pInfo;
import android.net.wifi.p2p.WifiP2pManager;
import android.net.wifi.WpsInfo;
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo;
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class WifiP2pModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "WifiP2pModule";
    private static final int SERVER_PORT = 8888;
    
    private final ReactApplicationContext reactContext;
    private WifiP2pManager manager;
    private WifiP2pManager.Channel channel;
    private BroadcastReceiver receiver;
    private IntentFilter intentFilter;
    
    private ServerSocket serverSocket;
    private Socket clientSocket; // For client connections to server
    private Socket serverConnectionSocket; // For server-side accepted connections
    private boolean isGroupOwner = false;
    private String groupOwnerAddress;
    
    private final List<WifiP2pDevice> peers = new ArrayList<>();

    public WifiP2pModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void initialize(Promise promise) {
        try {
            manager = (WifiP2pManager) reactContext.getSystemService(Context.WIFI_P2P_SERVICE);
            channel = manager.initialize(reactContext, reactContext.getMainLooper(), null);
            
            setupBroadcastReceiver();
            reactContext.registerReceiver(receiver, intentFilter);
            
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("INIT_ERROR", "Failed to initialize WiFi P2P", e);
        }
    }

    @ReactMethod
    public void startPeerDiscovery(Promise promise) {
        if (manager != null && channel != null) {
            manager.discoverPeers(channel, new WifiP2pManager.ActionListener() {
                @Override
                public void onSuccess() {
                    promise.resolve(true);
                }

                @Override
                public void onFailure(int reasonCode) {
                    promise.reject("DISCOVERY_ERROR", "Failed to start peer discovery: " + reasonCode);
                }
            });
        } else {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
        }
    }

    @ReactMethod
    public void stopPeerDiscovery(Promise promise) {
        if (manager != null && channel != null) {
            manager.stopPeerDiscovery(channel, new WifiP2pManager.ActionListener() {
                @Override
                public void onSuccess() {
                    promise.resolve(true);
                }

                @Override
                public void onFailure(int reasonCode) {
                    promise.reject("STOP_DISCOVERY_ERROR", "Failed to stop peer discovery: " + reasonCode);
                }
            });
        } else {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
        }
    }

    @ReactMethod
    public void connect(String deviceAddress, Promise promise) {
        if (manager == null || channel == null) {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
            return;
        }

        WifiP2pConfig config = new WifiP2pConfig();
        config.deviceAddress = deviceAddress;
        
        // Set connection preferences for better reliability
        config.wps.setup = WpsInfo.PBC; // Push button configuration
        config.groupOwnerIntent = 15; // High intent to become group owner

        android.util.Log.d("WifiP2pModule", "Attempting connection to: " + deviceAddress);

        manager.connect(channel, config, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                android.util.Log.d("WifiP2pModule", "Connection initiated successfully");
                promise.resolve(true);
            }

            @Override
            public void onFailure(int reasonCode) {
                String errorMsg = getConnectionErrorMessage(reasonCode);
                android.util.Log.e("WifiP2pModule", "Connection failed: " + errorMsg + " (code: " + reasonCode + ")");
                promise.reject("CONNECT_ERROR", "Failed to connect: " + errorMsg + " (code: " + reasonCode + ")");
            }
        });
    }
    
    private String getConnectionErrorMessage(int reasonCode) {
        switch (reasonCode) {
            case WifiP2pManager.ERROR:
                return "Generic error";
            case WifiP2pManager.P2P_UNSUPPORTED:
                return "WiFi P2P not supported on this device";
            case WifiP2pManager.BUSY:
                return "WiFi P2P busy, try again later";
            default:
                return "Unknown error";
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        if (manager != null && channel != null) {
            manager.removeGroup(channel, new WifiP2pManager.ActionListener() {
                @Override
                public void onSuccess() {
                    closeConnections();
                    promise.resolve(true);
                }

                @Override
                public void onFailure(int reasonCode) {
                    promise.reject("DISCONNECT_ERROR", "Failed to disconnect: " + reasonCode);
                }
            });
        } else {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
        }
    }

    @ReactMethod
    public void sendMessage(String message, Promise promise) {
        new Thread(() -> {
            try {
                android.util.Log.d("WifiP2pModule", "Sending message: " + message + " (isGroupOwner: " + isGroupOwner + ")");
                
                if (isGroupOwner) {
                    // Group owner sends to connected client
                    if (serverConnectionSocket != null && serverConnectionSocket.isConnected()) {
                        sendMessageToClient(message);
                        promise.resolve(true);
                    } else {
                        android.util.Log.e("WifiP2pModule", "No client connected to server. serverConnectionSocket: " + 
                            (serverConnectionSocket != null ? "exists but not connected" : "null"));
                        promise.reject("NO_CLIENT", "No client connected. Wait for a device to connect.");
                    }
                } else {
                    // Client sends to group owner
                    if (clientSocket != null && clientSocket.isConnected()) {
                        sendMessageToServer(message);
                        promise.resolve(true);
                    } else {
                        android.util.Log.e("WifiP2pModule", "Not connected to server. clientSocket: " + 
                            (clientSocket != null ? "exists but not connected" : "null"));
                        promise.reject("NO_CONNECTION", "Not connected to group owner server");
                    }
                }
            } catch (Exception e) {
                android.util.Log.e("WifiP2pModule", "Send message error: " + e.getMessage());
                promise.reject("SEND_ERROR", "Failed to send message: " + e.getMessage(), e);
            }
        }).start();
    }

    @ReactMethod
    public void checkPermissions(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();
            
            // Check location permissions
            boolean fineLocation = checkSelfPermission("android.permission.ACCESS_FINE_LOCATION");
            boolean coarseLocation = checkSelfPermission("android.permission.ACCESS_COARSE_LOCATION");
            
            result.putBoolean("fineLocation", fineLocation);
            result.putBoolean("coarseLocation", coarseLocation);
            
            // Check location services enabled
            android.location.LocationManager locationManager = (android.location.LocationManager) 
                reactContext.getSystemService(Context.LOCATION_SERVICE);
            boolean locationEnabled = locationManager.isLocationEnabled();
            result.putBoolean("locationServicesEnabled", locationEnabled);
            
            // Check WiFi state
            android.net.wifi.WifiManager wifiManager = (android.net.wifi.WifiManager) 
                reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            boolean wifiEnabled = wifiManager.isWifiEnabled();
            result.putBoolean("wifiEnabled", wifiEnabled);
            
            android.util.Log.d("WifiP2pModule", "Permission check - Fine Location: " + fineLocation + 
                ", Coarse Location: " + coarseLocation + ", Location Services: " + locationEnabled + 
                ", WiFi: " + wifiEnabled);
                
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("PERMISSION_CHECK_ERROR", "Failed to check permissions", e);
        }
    }
    
    private boolean checkSelfPermission(String permission) {
        return reactContext.checkSelfPermission(permission) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    @ReactMethod
    public void forceClientConnection(String serverAddress, Promise promise) {
        android.util.Log.d("WifiP2pModule", "Force connecting to server: " + serverAddress);
        connectToServer(serverAddress);
        promise.resolve(true);
    }
    
    @ReactMethod
    public void requestConnectionInfo(Promise promise) {
        if (manager != null && channel != null) {
            android.util.Log.d("WifiP2pModule", "Manually requesting connection info...");
            manager.requestConnectionInfo(channel, new WifiP2pManager.ConnectionInfoListener() {
                @Override
                public void onConnectionInfoAvailable(WifiP2pInfo info) {
                    android.util.Log.d("WifiP2pModule", "Manual connection info - Group formed: " + info.groupFormed + 
                        ", Is Group Owner: " + info.isGroupOwner + ", Address: " + 
                        (info.groupOwnerAddress != null ? info.groupOwnerAddress.getHostAddress() : "null"));
                    
                    WritableMap result = Arguments.createMap();
                    result.putBoolean("groupFormed", info.groupFormed);
                    result.putBoolean("isGroupOwner", info.isGroupOwner);
                    if (info.groupOwnerAddress != null) {
                        result.putString("groupOwnerAddress", info.groupOwnerAddress.getHostAddress());
                    }
                    promise.resolve(result);
                }
            });
        } else {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
        }
    }
    
    @ReactMethod
    public void getDeviceName(Promise promise) {
        if (manager != null && channel != null) {
            manager.requestDeviceInfo(channel, new WifiP2pManager.DeviceInfoListener() {
                @Override
                public void onDeviceInfoAvailable(WifiP2pDevice device) {
                    promise.resolve(device.deviceName);
                }
            });
        } else {
            promise.reject("NOT_INITIALIZED", "WiFi P2P not initialized");
        }
    }
    
    @ReactMethod
    public void getConnectionStatus(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();
            result.putBoolean("isGroupOwner", isGroupOwner);
            result.putString("groupOwnerAddress", groupOwnerAddress);
            
            if (isGroupOwner) {
                boolean hasClient = serverConnectionSocket != null && serverConnectionSocket.isConnected();
                result.putBoolean("hasConnectedClient", hasClient);
                result.putBoolean("serverRunning", serverSocket != null && !serverSocket.isClosed());
            } else {
                boolean connectedToServer = clientSocket != null && clientSocket.isConnected();
                result.putBoolean("connectedToServer", connectedToServer);
            }
            
            android.util.Log.d("WifiP2pModule", "Connection status - isGroupOwner: " + isGroupOwner + 
                ", clientSocket connected: " + (clientSocket != null && clientSocket.isConnected()) +
                ", serverConnectionSocket connected: " + (serverConnectionSocket != null && serverConnectionSocket.isConnected()) +
                ", serverSocket open: " + (serverSocket != null && !serverSocket.isClosed()));
            
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("CONNECTION_STATUS_ERROR", "Failed to get connection status", e);
        }
    }

    private void setupBroadcastReceiver() {
        intentFilter = new IntentFilter();
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);
        intentFilter.addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION);

        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                android.util.Log.d("WifiP2pModule", "Broadcast received: " + action);

                try {
                    if (WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)) {
                        int state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1);
                        android.util.Log.d("WifiP2pModule", "WiFi P2P State: " + state);
                        WritableMap params = Arguments.createMap();
                        params.putBoolean("isEnabled", state == WifiP2pManager.WIFI_P2P_STATE_ENABLED);
                        sendEvent("WIFI_P2P_STATE_CHANGED", params);
                        
                    } else if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action)) {
                        android.util.Log.d("WifiP2pModule", "Peers changed - requesting peer list");
                        if (manager != null) {
                            manager.requestPeers(channel, peerListListener);
                        } else {
                            android.util.Log.e("WifiP2pModule", "Manager is null when peers changed");
                        }
                        
                    } else if (WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action)) {
                        android.util.Log.d("WifiP2pModule", "Connection changed - requesting connection info");
                        
                        // Also log the connection info from the intent
                        WifiP2pInfo p2pInfo = intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO);
                        if (p2pInfo != null) {
                            android.util.Log.d("WifiP2pModule", "P2P Info from intent - Group formed: " + p2pInfo.groupFormed + 
                                ", Group owner: " + p2pInfo.isGroupOwner + ", Address: " + 
                                (p2pInfo.groupOwnerAddress != null ? p2pInfo.groupOwnerAddress.getHostAddress() : "null"));
                        }
                        
                        if (manager != null) {
                            manager.requestConnectionInfo(channel, connectionInfoListener);
                        } else {
                            android.util.Log.e("WifiP2pModule", "Manager is null when connection changed");
                        }
                    }
                } catch (SecurityException e) {
                    android.util.Log.e("WifiP2pModule", "Security exception in broadcast receiver: " + e.getMessage());
                    android.util.Log.e("WifiP2pModule", "This usually indicates missing location permissions or AppOps denial");
                    
                    // Notify React Native about permission issues
                    WritableMap params = Arguments.createMap();
                    params.putString("error", "PERMISSION_DENIED");
                    params.putString("message", "Location permission required for WiFi Direct. Please check app settings.");
                    sendEvent("WIFI_P2P_ERROR", params);
                } catch (Exception e) {
                    android.util.Log.e("WifiP2pModule", "Unexpected error in broadcast receiver: " + e.getMessage());
                }
            }
        };
    }

    private final WifiP2pManager.PeerListListener peerListListener = new WifiP2pManager.PeerListListener() {
        @Override
        public void onPeersAvailable(WifiP2pDeviceList peerList) {
            Collection<WifiP2pDevice> refreshedPeers = peerList.getDeviceList();
            
            peers.clear();
            peers.addAll(refreshedPeers);
            
            WritableArray deviceArray = Arguments.createArray();
            for (WifiP2pDevice device : peers) {
                WritableMap deviceMap = Arguments.createMap();
                deviceMap.putString("deviceName", device.deviceName);
                deviceMap.putString("deviceAddress", device.deviceAddress);
                deviceMap.putString("status", getDeviceStatus(device.status));
                deviceArray.pushMap(deviceMap);
            }
            
            WritableMap params = Arguments.createMap();
            params.putArray("devices", deviceArray);
            sendEvent("WIFI_P2P_PEERS_CHANGED", params);
        }
    };

    private final WifiP2pManager.ConnectionInfoListener connectionInfoListener = new WifiP2pManager.ConnectionInfoListener() {
        @Override
        public void onConnectionInfoAvailable(WifiP2pInfo info) {
            isGroupOwner = info.isGroupOwner;
            
            if (info.groupOwnerAddress != null) {
                groupOwnerAddress = info.groupOwnerAddress.getHostAddress();
            } else {
                groupOwnerAddress = null;
            }
            
            android.util.Log.d("WifiP2pModule", "Connection info - Group formed: " + info.groupFormed + 
                ", Is Group Owner: " + isGroupOwner + ", Group Owner Address: " + groupOwnerAddress);
            
            WritableMap params = Arguments.createMap();
            params.putBoolean("isConnected", info.groupFormed);
            params.putBoolean("isGroupOwner", isGroupOwner);
            if (groupOwnerAddress != null) {
                params.putString("groupOwnerAddress", groupOwnerAddress);
            }
            
            // Add actual connected device info from peers list
            if (info.groupFormed) {
                // Find the connected device from the peers list
                WritableMap deviceInfo = null;
                for (WifiP2pDevice peer : peers) {
                    if (peer.status == WifiP2pDevice.CONNECTED) {
                        deviceInfo = Arguments.createMap();
                        deviceInfo.putString("deviceName", peer.deviceName);
                        deviceInfo.putString("deviceAddress", peer.deviceAddress);
                        deviceInfo.putString("status", getDeviceStatus(peer.status));
                        break;
                    }
                }
                
                // If we found a connected device, add it to params
                if (deviceInfo != null) {
                    params.putMap("device", deviceInfo);
                    // Find the connected peer again for logging (can't read from WritableMap)
                    for (WifiP2pDevice peer : peers) {
                        if (peer.status == WifiP2pDevice.CONNECTED) {
                            android.util.Log.d("WifiP2pModule", "Connected to device: " + peer.deviceName + 
                                " (" + peer.deviceAddress + ")");
                            break;
                        }
                    }
                }
                
                if (isGroupOwner) {
                    android.util.Log.d("WifiP2pModule", "Starting server as group owner");
                    startServer();
                } else {
                    android.util.Log.d("WifiP2pModule", "Connected as client to group owner: " + groupOwnerAddress);
                    // Automatically connect to the group owner's server
                    connectToServer(groupOwnerAddress);
                }
            } else {
                android.util.Log.d("WifiP2pModule", "Group not formed or connection lost");
                closeConnections();
            }
            
            sendEvent("WIFI_P2P_CONNECTION_CHANGED", params);
        }
    };

    private void startServer() {
        new Thread(() -> {
            try {
                if (serverSocket != null && !serverSocket.isClosed()) {
                    serverSocket.close();
                }
                
                android.util.Log.d("WifiP2pModule", "Starting server on port " + SERVER_PORT);
                serverSocket = new ServerSocket(SERVER_PORT);
                
                android.util.Log.d("WifiP2pModule", "Server started successfully, waiting for client connection...");
                
                // Accept client connections in a loop
                while (serverSocket != null && !serverSocket.isClosed()) {
                    try {
                        Socket client = serverSocket.accept();
                        android.util.Log.d("WifiP2pModule", "Client connected: " + client.getRemoteSocketAddress());
                        
                        // Store the client socket for sending messages (use separate variable for server connections)
                        serverConnectionSocket = client;
                        
                        // Handle incoming messages from this client
                        handleClientMessages(client);
                        
                    } catch (java.net.SocketTimeoutException e) {
                        // Timeout is normal, just continue listening
                        android.util.Log.d("WifiP2pModule", "Server accept timeout, continuing to listen...");
                    } catch (Exception e) {
                        android.util.Log.e("WifiP2pModule", "Error accepting client connection: " + e.getMessage());
                        break;
                    }
                }
                
            } catch (Exception e) {
                android.util.Log.e("WifiP2pModule", "Server error: " + e.getMessage());
            }
        }).start();
    }
    
    private void connectToServer(String serverAddress) {
        new Thread(() -> {
            try {
                android.util.Log.d("WifiP2pModule", "Connecting to server at: " + serverAddress + ":" + SERVER_PORT);
                
                // Close existing client socket if any
                if (clientSocket != null && !clientSocket.isClosed()) {
                    clientSocket.close();
                }
                
                clientSocket = new Socket();
                clientSocket.connect(new java.net.InetSocketAddress(serverAddress, SERVER_PORT), 10000); // 10s timeout
                
                android.util.Log.d("WifiP2pModule", "Successfully connected to server");
                
                // Listen for incoming messages from server
                handleServerMessages(clientSocket);
                
            } catch (Exception e) {
                android.util.Log.e("WifiP2pModule", "Failed to connect to server: " + e.getMessage());
                clientSocket = null;
            }
        }).start();
    }
    
    private void handleServerMessages(Socket socket) {
        new Thread(() -> {
            try {
                InputStream inputStream = socket.getInputStream();
                byte[] buffer = new byte[1024];
                int bytes;
                
                while ((bytes = inputStream.read(buffer)) != -1) {
                    String message = new String(buffer, 0, bytes);
                    android.util.Log.d("WifiP2pModule", "Client received message: " + message);
                    
                    WritableMap params = Arguments.createMap();
                    params.putString("message", message);
                    sendEvent("WIFI_P2P_MESSAGE_RECEIVED", params);
                }
            } catch (Exception e) {
                android.util.Log.e("WifiP2pModule", "Error reading from server: " + e.getMessage());
            }
        }).start();
    }
    
    private void handleClientMessages(Socket client) {
        new Thread(() -> {
            try {
                InputStream inputStream = client.getInputStream();
                byte[] buffer = new byte[1024];
                int bytes;
                
                while ((bytes = inputStream.read(buffer)) != -1) {
                    String message = new String(buffer, 0, bytes);
                    android.util.Log.d("WifiP2pModule", "Server received message: " + message);
                    
                    WritableMap params = Arguments.createMap();
                    params.putString("message", message);
                    sendEvent("WIFI_P2P_MESSAGE_RECEIVED", params);
                }
            } catch (java.net.SocketTimeoutException e) {
                android.util.Log.w("WifiP2pModule", "Server socket timeout - no client connected");
            } catch (IOException e) {
                android.util.Log.e("WifiP2pModule", "Server error: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();
    }



    private void sendMessageToServer(String message) throws IOException {
        if (clientSocket != null && clientSocket.isConnected()) {
            android.util.Log.d("WifiP2pModule", "Sending message to server: " + message);
            OutputStream outputStream = clientSocket.getOutputStream();
            outputStream.write(message.getBytes());
            outputStream.flush();
            android.util.Log.d("WifiP2pModule", "Message sent to server successfully");
        } else {
            throw new IOException("Not connected to server");
        }
    }

    private void sendMessageToClient(String message) throws IOException {
        // Send to connected client (serverConnectionSocket contains the accepted client connection)
        if (serverConnectionSocket != null && serverConnectionSocket.isConnected()) {
            android.util.Log.d("WifiP2pModule", "Sending message to client: " + message);
            OutputStream outputStream = serverConnectionSocket.getOutputStream();
            outputStream.write(message.getBytes());
            outputStream.flush();
            android.util.Log.d("WifiP2pModule", "Message sent to client successfully");
        } else {
            throw new IOException("No client connected to send message to");
        }
    }

    private void closeConnections() {
        try {
            if (clientSocket != null) {
                clientSocket.close();
                clientSocket = null;
            }
            if (serverConnectionSocket != null) {
                serverConnectionSocket.close();
                serverConnectionSocket = null;
            }
            if (serverSocket != null) {
                serverSocket.close();
                serverSocket = null;
            }
        } catch (IOException e) {
            android.util.Log.e("WifiP2pModule", "Error closing connections: " + e.getMessage());
        }
    }

    private String getDeviceStatus(int status) {
        switch (status) {
            case WifiP2pDevice.AVAILABLE:
                return "AVAILABLE";
            case WifiP2pDevice.CONNECTED:
                return "CONNECTED";
            case WifiP2pDevice.FAILED:
                return "FAILED";
            case WifiP2pDevice.INVITED:
                return "INVITED";
            case WifiP2pDevice.UNAVAILABLE:
                return "UNAVAILABLE";
            default:
                return "UNKNOWN";
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        if (receiver != null) {
            try {
                reactContext.unregisterReceiver(receiver);
            } catch (Exception e) {
                // Receiver might not be registered
            }
        }
        closeConnections();
    }
}