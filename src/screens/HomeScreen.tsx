import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function HomeScreen({ navigation }: any) {
  const { theme, toggleTheme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}
    >

      {/* Top Right Toggle */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={[
          styles.themeToggle,
          { backgroundColor: theme.colors.secondary }
        ]}
      >
        <Text style={{ fontSize: 18 }}>
          {theme.darkMode ? '☀️' : '🌙'}
        </Text>
      </TouchableOpacity>

      {/* Logo */}
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />

      {/* App Name */}
      <Text
        style={[
          styles.logoText,
          { color: theme.colors.accent }
        ]}
      >
        SignBridge
      </Text>

      {/* Tagline */}
      <Text
        style={[
          styles.tagline,
          { color: theme.colors.text }
        ]}
      >
        Bridging Silence with Intelligence
      </Text>

      {/* Start Button */}
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: theme.colors.accent }
        ]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Camera')}
      >
        <Text style={styles.buttonText}>
          Start Capture
        </Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text
        style={[
          styles.footer,
          { color: theme.darkMode ? '#555' : '#888' }
        ]}
      >
        Powered by AI
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  themeToggle: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 45,
    height: 45,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  logoImage: {
    width: 130,
    height: 130,
    marginBottom: 20,
  },

  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  tagline: {
    fontSize: 16,
    marginVertical: 20,
    textAlign: 'center',
  },

  button: {
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 10,
  },

  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },

  footer: {
    position: 'absolute',
    bottom: 30,
    fontSize: 12,
  },
});
