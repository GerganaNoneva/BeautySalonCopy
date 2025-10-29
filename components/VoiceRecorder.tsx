import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Square, Loader } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type RecordingState = 'idle' | 'recording' | 'processing';

interface VoiceRecorderProps {
  onTranscriptionComplete: (data: {
    text: string;
    parsed: {
      customerName: string;
      phone: string | null;
      service: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string | null;
    };
  }) => void;
}

export function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Недостъпно на Web', 'Изисква мобилно устройство.');
        return;
      }

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Грешка', 'Необходимо е разрешение за микрофон.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(created.recording);
      setRecordingState('recording');
      setDuration(0);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      durationInterval.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Грешка', 'Неуспешно стартиране.');
      setRecordingState('idle');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) {
        Alert.alert('Грешка', 'Няма активен запис.');
        return;
      }

      setRecordingState('processing');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Грешка', 'Неуспешно извличане на файл.');
        setRecordingState('idle');
        return;
      }

      const blob = await fetch(uri).then((r) => r.blob());
      const file = new File([await blob.arrayBuffer()], 'audio.wav', { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('parse-reservation', { body: formData });
      if (error) {
        console.error('Supabase parse-reservation error:', error);
        Alert.alert('Грешка', 'Гласовата обработка се провали.');
      } else if (data?.parsed) {
        console.log('Parsed reservation:', data.parsed);
        (window as any).__setVoiceDataToReservationModal2?.(data.parsed);
        if (onTranscriptionComplete) onTranscriptionComplete(data);
        Alert.alert('✅ Успешно', 'Резервацията бе разпозната.');
      } else {
        Alert.alert('⚠️', 'Няма разпознати данни от OpenAI.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Грешка', 'Проблем при спиране на записа.');
    } finally {
      setRecordingState('idle');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    console.log('handlePress called, recordingState:', recordingState);
    if (recordingState === 'idle') {
      console.log('Starting recording...');
      startRecording();
    } else if (recordingState === 'recording') {
      console.log('Stopping recording...');
      stopRecording();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          recordingState === 'recording' && styles.buttonRecording,
        ]}
        onPress={handlePress}
        disabled={recordingState === 'processing'}
        activeOpacity={0.7}
        testID="voice-recorder-button"
      >
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: recordingState === 'recording' ? pulseAnim : 1 }] },
          ]}
        >
          {recordingState === 'idle' && (
            <Mic size={24} color={theme.colors.primary} />
          )}
          {recordingState === 'recording' && (
            <Square size={20} color={theme.colors.error} fill={theme.colors.error} />
          )}
          {recordingState === 'processing' && (
            <Loader size={24} color={theme.colors.primary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {recordingState === 'recording' && (
        <View style={styles.durationContainer}>
          <View style={styles.recordingDot} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      )}

      {recordingState === 'processing' && (
        <Text style={styles.statusText}>Обработка...</Text>
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
  buttonRecording: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  durationText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});
