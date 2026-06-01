import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-surface-raised">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask your coach..."
        disabled={disabled}
        className="flex-1 bg-surface border border-surface-raised rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gold disabled:opacity-50 transition-colors duration-200"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="px-3 py-1.5 bg-gold text-stone-900 rounded text-sm font-semibold hover:bg-gold-400 disabled:opacity-50 disabled:hover:bg-gold transition-colors duration-200 cursor-pointer"
      >
        Send
      </button>
    </form>
  );
}
