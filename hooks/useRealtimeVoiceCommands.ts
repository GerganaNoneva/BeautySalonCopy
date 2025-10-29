import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { ExpoWebSpeechRecognition } from 'expo-speech-recognition';
import { parseVoiceCommand, ParsedVoiceCommand } from '@/utils/voiceCommandParser';

interface UseRealtimeVoiceCommandsOptions {
  onCommand: (command: ParsedVoiceCommand) => void;
  openAiApiKey: string;
  language?: string;
  continuous?: boolean;
}

interface UseRealtimeVoiceCommandsReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
  isProcessing: boolean;
}

export function useRealtimeVoiceCommands({
  onCommand,
  openAiApiKey,
  language = 'bg-BG',
  continuous = true,
}: UseRealtimeVoiceCommandsOptions): UseRealtimeVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true); // expo-speech-recognition работи навсякъде
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<ExpoWebSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const parseCommandRef = useRef<((text: string) => Promise<void>) | null>(null);

  // Обработка на резултатите - само показваме на живо
  const handleTranscript = useCallback((transcriptResult: string) => {
    setTranscript(transcriptResult);
    finalTranscriptRef.current = transcriptResult; // Запазваме последния текст
  }, []);

  // Парсиране на командата след STOP
  const parseCommand = useCallback(async (text: string) => {
    if (!text || text.trim().length < 5) {
      setError('Твърде кратка команда');
      return;
    }

    try {
      setIsProcessing(true);

      // Използваме AI за парсиране на командата
      const parsedCommand = await parseVoiceCommand(text, openAiApiKey);

      // Ако командата е разпозната с достатъчна увереност
      if (parsedCommand.type !== 'unknown' && parsedCommand.confidence > 0.7) {
        // Извикваме callback-а с командата
        onCommand(parsedCommand);
        setError(null);
      } else {
        setError('Командата не беше разпозната. Опитайте отново.');
      }
    } catch (error) {
      console.error('Error parsing command:', error);
      setError('Грешка при обработка на командата');
    } finally {
      setIsProcessing(false);
    }
  }, [openAiApiKey, onCommand]);

  // Запазваме parseCommand в ref за достъп от recognition handlers
  useEffect(() => {
    parseCommandRef.current = parseCommand;
  }, [parseCommand]);

  // Инициализация на Speech Recognition
  useEffect(() => {
    const recognition = new ExpoWebSpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      if (results && results.length > 0) {
        const result = results[results.length - 1];
        if (result && result.length > 0) {
          const transcriptResult = result[0].transcript;
          handleTranscript(transcriptResult);
        }
      }
    };

    recognition.onerror = (event: any) => {
      const errorMsg = event.error || 'unknown';

      if (errorMsg === 'no-speech') {
        setError('Няма разпознат глас');
      } else if (errorMsg === 'audio-capture') {
        setError('Няма достъп до микрофон');
      } else if (errorMsg === 'not-allowed') {
        setError('Разрешението за микрофон е отказано');
      } else {
        setError(`Грешка: ${errorMsg}`);
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      // След приключване, парсваме командата от финалния текст
      const finalText = finalTranscriptRef.current;
      if (finalText && finalText.trim().length > 0 && parseCommandRef.current) {
        parseCommandRef.current(finalText);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [continuous, language, handleTranscript]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Гласовото разпознаване не е поддържано на това устройство');
      return;
    }

    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('');
        setError(null);
        setIsProcessing(false);
        finalTranscriptRef.current = '';
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setError('Грешка при стартиране на разпознаването');
      }
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        // parseCommand ще се извика автоматично в recognition.onend
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    error,
    isProcessing,
  };
}
