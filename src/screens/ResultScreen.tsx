import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated
} from 'react-native';
import * as Speech from 'expo-speech';
import { useTheme } from '../context/ThemeContext';

export default function ResultScreen({ navigation }: any) {
  const { theme } = useTheme();

  const detectedWord = "SORRY";
  const [language, setLanguage] = useState("en");
  const [sentence, setSentence] = useState<string[]>([]);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    setSentence((prev) => [...prev, detectedWord]);
  }, []);

  const speakText = () => {
    const text =
      language === "ml" ? "ക്ഷമിക്കണം" : sentence.join(" ");

    Speech.speak(text, {
      language: language === "ml" ? "ml-IN" : "en-US",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      <Text style={[styles.title, { color: theme.colors.accent }]}>
        Detection Result
      </Text>

      <Animated.Text
        style={[
          styles.word,
          {
            color: theme.colors.text,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {language === "ml" ? "ക്ഷമിക്കണം" : detectedWord}
      </Animated.Text>

      <View style={{ marginVertical: 15 }}>
        <Text style={{ color: theme.colors.text }}>Sentence:</Text>
        <Text style={{ color: theme.colors.accent }}>
          {sentence.join(" ")}
        </Text>
      </View>

      {/* Language Toggle */}
      <View style={styles.languageRow}>
        <TouchableOpacity onPress={() => setLanguage("en")}>
          <Text style={{ color: theme.colors.text }}>English</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setLanguage("ml")}>
          <Text style={{ color: theme.colors.text }}>Malayalam</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.speakButton}
          onPress={speakText}
        >
          <Text style={styles.buttonText}>Speak</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setSentence([])}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate("Camera")}
      >
        <Text style={styles.buttonText}>New Capture</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },

  title: { fontSize: 22, textAlign: 'center', marginBottom: 20 },

  word: { fontSize: 40, fontWeight: 'bold', textAlign: 'center' },

  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  speakButton: {
    backgroundColor: '#00F5D4',
    padding: 15,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },

  clearButton: {
    backgroundColor: '#FF4D4D',
    padding: 15,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },

  backButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: { color: '#000', fontWeight: 'bold' },
});
