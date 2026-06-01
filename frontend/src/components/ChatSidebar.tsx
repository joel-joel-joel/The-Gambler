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
        className="fixed bottom-4 right-4 z-40 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 md:hidden"
      >
        <span className="text-lg">{isOpen ? "X" : "Chat"}</span>
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700 flex flex-col z-30
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:h-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Coach</h2>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white md:hidden"
          >
            X
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
          {messages.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Ask your poker coach anything, or describe game actions to update the board.
            </p>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isWaiting && (
            <div className="text-xs text-gray-400 animate-pulse">Thinking...</div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={!isConnected} />
      </div>
    </>
  );
}
