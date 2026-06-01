import { useState, useRef, useCallback } from "react";

interface SpeechToTextState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
}

interface UseSpeechToTextReturn extends SpeechToTextState {
  startListening: () => void;
  stopListening: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function useSpeechToText(
  onResult: (transcript: string) => void
): UseSpeechToTextReturn {
  const SpeechRecognition = getSpeechRecognition();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [state, setState] = useState<SpeechToTextState>({
    isListening: false,
    isSupported: SpeechRecognition !== null,
    transcript: "",
    error: null,
  });

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setState((s) => ({
        ...s,
        error: "Speech input works best in Chrome, Edge, or Safari.",
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      setState((s) => ({ ...s, transcript }));

      if (event.results[last].isFinal) {
        onResult(transcript);
        setState((s) => ({ ...s, isListening: false, transcript: "" }));
      }
    };

    recognition.onerror = (event: { error: string }) => {
      setState((s) => ({
        ...s,
        isListening: false,
        error: `Speech error: ${event.error}`,
      }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState((s) => ({ ...s, isListening: true, error: null }));
  }, [SpeechRecognition, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setState((s) => ({ ...s, isListening: false }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
  };
}
