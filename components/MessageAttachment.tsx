import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform, Modal, Linking } from 'react-native';
import { FileText, Download, Play, Pause, X } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { theme } from '@/constants/theme';

type Props = {
  type: 'image' | 'file' | 'audio';
  url: string;
  name: string;
  size: number;
  duration?: number;
};

export default function MessageAttachment({ type, url, name, size, duration }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [imageZoomed, setImageZoomed] = useState(false);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const downloadFile = async () => {
    try {
      // Open the file URL directly in the browser/default handler
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Грешка', 'Не може да се отвори файла');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Грешка', 'Неуспешно отваряне на файла');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setAudioPosition(status.positionMillis / 1000);
              setAudioDuration(status.durationMillis ? status.durationMillis / 1000 : duration || 0);

              if (status.didJustFinish) {
                setIsPlaying(false);
                setAudioPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  if (type === 'image') {
    return (
      <>
        <TouchableOpacity
          onPress={() => setImageZoomed(true)}
          onLongPress={downloadFile}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <View style={styles.imageContainer}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          </View>
        </TouchableOpacity>

        <Modal
          visible={imageZoomed}
          transparent
          animationType="fade"
          onRequestClose={() => setImageZoomed(false)}
        >
          <TouchableOpacity
            style={styles.imageZoomModal}
            activeOpacity={1}
            onPress={() => setImageZoomed(false)}
          >
            <TouchableOpacity style={styles.imageZoomClose} onPress={() => setImageZoomed(false)}>
              <X size={24} color={theme.colors.surface} />
            </TouchableOpacity>
            <Image
              source={{ uri: url }}
              style={styles.imageZoomed}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  if (type === 'audio') {
    const progress = audioDuration > 0 ? audioPosition / audioDuration : 0;

    return (
      <View style={styles.audioContainer}>
        <TouchableOpacity style={styles.audioPlayButton} onPress={playAudio}>
          {isPlaying ? (
            <Pause size={16} color={theme.colors.primary} fill={theme.colors.primary} />
          ) : (
            <Play size={16} color={theme.colors.primary} fill={theme.colors.primary} />
          )}
        </TouchableOpacity>
        <View style={styles.audioWaveformContainer}>
          <View style={styles.waveformBackground}>
            <View style={[styles.waveformProgress, { width: `${progress * 100}%` }]} />
          </View>
          {/* Waveform bars - reduced count for shorter width */}
          <View style={styles.waveformBars}>
            {[3, 8, 5, 10, 7, 12, 6, 9, 4, 11].map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: height,
                    backgroundColor: progress * 10 > index ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.audioTime}>{formatTime(isPlaying ? audioPosition : audioDuration)}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={downloadFile}
      onLongPress={downloadFile}
      delayLongPress={500}
      activeOpacity={0.8}
    >
      <View style={styles.fileContainer}>
        <View style={styles.fileIcon}>
          <FileText size={28} color={theme.colors.primary} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
          <View style={styles.fileDetails}>
            <Text style={styles.fileSize}>{formatBytes(size)}</Text>
            <Download size={14} color={theme.colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.md,
  },
  imageZoomModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageZoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageZoomed: {
    width: '100%',
    height: '100%',
  },
  imageName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    maxWidth: 180,
  },
  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioWaveformContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  waveformBackground: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: theme.colors.border,
    borderRadius: 1,
  },
  waveformProgress: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 2,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
  },
  audioTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    minWidth: 32,
    textAlign: 'right',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.xs,
  },
  fileName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  fileSize: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});
