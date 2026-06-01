import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-gold-700 text-stone-100"
            : "bg-surface text-stone-200"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.boardUpdate && (
          <div className="mt-1 pt-1 border-t border-stone-600 text-xs text-emerald-400">
            Board updated
          </div>
        )}
      </div>
    </div>
  );
}
