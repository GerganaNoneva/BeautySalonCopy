import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Mic, Square, AlertCircle, Loader } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { useRealtimeVoiceCommands } from '@/hooks/useRealtimeVoiceCommands';
import { ParsedVoiceCommand } from '@/utils/voiceCommandParser';
import { useRef, useEffect } from 'react';

interface RealtimeVoiceRecorderProps {
  onCommand: (command: ParsedVoiceCommand) => void;
  openAiApiKey: string;
}

export function RealtimeVoiceRecorder({
  onCommand,
  openAiApiKey,
}: RealtimeVoiceRecorderProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
    isProcessing,
  } = useRealtimeVoiceCommands({
    onCommand,
    openAiApiKey,
    language: 'bg-BG',
    continuous: true,
  });

  // Анимация при слушане
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const handlePress = () => {
    if (!isSupported) {
      Alert.alert(
        'Не се поддържа',
        'Гласовото разпознаване не е поддържано на това устройство.'
      );
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isListening && styles.buttonListening,
          !isSupported && styles.buttonDisabled,
          isProcessing && styles.buttonProcessing,
        ]}
        onPress={handlePress}
        disabled={!isSupported || isProcessing}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: isListening ? pulseAnim : 1 }] },
          ]}
        >
          {isProcessing ? (
            <Loader size={24} color={theme.colors.primary} />
          ) : isListening ? (
            <Square size={20} color={theme.colors.error} fill={theme.colors.error} />
          ) : !isSupported ? (
            <AlertCircle size={24} color={theme.colors.textMuted} />
          ) : (
            <Mic size={24} color={theme.colors.primary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {isListening && transcript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}

      {isListening && !transcript && (
        <View style={styles.statusContainer}>
          <View style={styles.listeningDot} />
          <Text style={styles.statusText}>Слушам...</Text>
        </View>
      )}

      {isProcessing && (
        <Text style={styles.processingText}>Обработвам командата...</Text>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!isSupported && (
        <Text style={styles.notSupportedText}>
          Не се поддържа на това устройство
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  buttonListening: {
    borderColor: theme.colors.error,
    backgroundColor: '#FFE5E5',
  },
  buttonDisabled: {
    borderColor: theme.colors.textMuted,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  buttonProcessing: {
    borderColor: theme.colors.champagne,
    backgroundColor: theme.colors.cream,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    maxWidth: 300,
  },
  transcriptText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: '#FFE5E5',
    borderRadius: theme.borderRadius.full,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
  },
  processingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  errorContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: '#FFE5E5',
    borderRadius: theme.borderRadius.md,
    maxWidth: 300,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.error,
    textAlign: 'center',
  },
  notSupportedText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
