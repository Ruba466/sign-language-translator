import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

export default function CameraView() {
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');

  if (!device) {
    return <Text>Loading camera...</Text>;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>SignBridge Camera Live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
    borderRadius: 12,
  },
  text: { color: '#fff', fontSize: 18 },
});
