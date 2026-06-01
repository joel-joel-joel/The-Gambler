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
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-gray-700">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask your coach..."
        disabled={disabled}
        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="px-3 py-1.5 bg-blue-600 rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
      >
        Send
      </button>
    </form>
  );
}
