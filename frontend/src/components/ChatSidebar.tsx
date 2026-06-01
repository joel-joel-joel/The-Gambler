import { useRef, useEffect, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isConnected, isWaiting } = useChatStore();
  const { sendMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 bg-gold text-stone-900 rounded-full flex items-center justify-center shadow-glow hover:bg-gold-400 transition-colors duration-200 md:hidden cursor-pointer font-semibold text-xs"
      >
        {isOpen ? "X" : "Chat"}
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-surface-deep border-l border-surface-raised flex flex-col z-30
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:h-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-surface-raised">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gold">Coach</h2>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-stone-400 hover:text-stone-200 md:hidden cursor-pointer transition-colors duration-200"
          >
            X
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
          {messages.length === 0 && (
            <p className="text-xs text-stone-500 text-center mt-4">
              Ask your poker coach anything, or describe game actions to update the board.
            </p>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isWaiting && (
            <div className="text-xs text-stone-400 animate-pulse">Thinking...</div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </>
  );
}
