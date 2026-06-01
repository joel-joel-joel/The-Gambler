import { useState } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const { isListening, isSupported, transcript, error, startListening, stopListening } =
    useSpeechToText((finalTranscript) => {
      onSend(finalTranscript);
    });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="border-t border-surface-raised p-3 space-y-1">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={isListening ? transcript : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask your coach..."}
          disabled={disabled || isListening}
          className="flex-1 bg-surface border border-surface-raised rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gold disabled:opacity-50 transition-colors duration-200"
        />
        {isSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={disabled}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors duration-200 cursor-pointer ${
              isListening
                ? "bg-red-600 text-white animate-pulse"
                : "bg-surface-raised text-stone-300 hover:bg-surface-hover hover:text-gold"
            } disabled:opacity-50`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? (
              <StopIcon className="w-4 h-4" />
            ) : (
              <MicIcon className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !input.trim() || isListening}
          className="px-3 py-1.5 bg-gold text-stone-900 rounded text-sm font-semibold hover:bg-gold-400 disabled:opacity-50 disabled:hover:bg-gold transition-colors duration-200 cursor-pointer"
        >
          Send
        </button>
      </form>
      {error && (
        <div className="text-[10px] text-red-400">{error}</div>
      )}
    </div>
  );
}
