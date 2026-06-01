import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";
import { ChatSidebar } from "./components/ChatSidebar";
import { UndoBanner } from "./components/UndoBanner";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">The Gambler</h1>
      </header>
      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto p-4 space-y-6">
          <QuickEntryBar />
          <CardSelector />
          <GameInputs />
          <ResultsPanel />
          <CheatSheet />
        </main>
        <aside className="hidden md:block w-80 flex-shrink-0">
          <ChatSidebar />
        </aside>
      </div>
      <UndoBanner />
      <div className="md:hidden">
        <ChatSidebar />
      </div>
    </div>
  );
}
