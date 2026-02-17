import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useTheme } from '../context/ThemeContext';

export default function CameraScreen({ navigation }: any) {
  const { theme } = useTheme();

  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'back');

  const [hasPermission, setHasPermission] = useState(false);
  const [history] = useState(["Hello", "Thank You", "Sorry"]);

  useEffect(() => {
    const requestPermission = async () => {
      const permission = await Camera.requestCameraPermission();
      setHasPermission(permission === 'granted');
    };
    requestPermission();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: theme.colors.accent }]}>
            ← Back
          </Text>
        </TouchableOpacity>

        <View style={styles.liveContainer}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: theme.colors.text }]}>
            LIVE
          </Text>
        </View>
      </View>

      {/* Camera Area */}
      <View style={styles.cameraWrapper}>
        {device != null && hasPermission ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={false}
            video={false}
            audio={false}
          />
        ) : (
          <Text style={{ color: theme.colors.text }}>
            Loading Camera...
          </Text>
        )}

        {/* Frame Overlay */}
        <View style={styles.overlayFrame} />
      </View>

      {/* Gesture History */}
      <View style={styles.historyContainer}>
        <Text style={[styles.historyTitle, { color: theme.colors.text }]}>
          Recent Gestures
        </Text>

        {history.map((item, index) => (
          <Text
            key={index}
            style={[styles.historyItem, { color: theme.colors.accent }]}
          >
            • {item}
          </Text>
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.stopButton]}
          onPress={() => navigation.navigate("Result")}
        >
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.retryButton]}
          onPress={() => navigation.replace("Camera")}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  back: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00FF00',
    marginRight: 6,
  },

  liveText: {
    fontWeight: 'bold',
  },

  cameraWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
  },

  overlayFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00F5D4',
    width: '70%',
    height: '50%',
    alignSelf: 'center',
    top: '25%',
    borderRadius: 20,
  },

  historyContainer: {
    marginBottom: 15,
  },

  historyTitle: {
    fontSize: 14,
    marginBottom: 5,
  },

  historyItem: {
    fontSize: 14,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  stopButton: {
    backgroundColor: '#FF4D4D',
    padding: 15,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },

  retryButton: {
    backgroundColor: '#00F5D4',
    padding: 15,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },

  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});
