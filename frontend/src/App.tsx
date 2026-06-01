import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";
import { RoundHistory } from "./components/RoundHistory";
import { ChatSidebar } from "./components/ChatSidebar";
import { UndoBanner } from "./components/UndoBanner";
import { SessionBar } from "./components/SessionBar";

export default function App() {
  return (
    <div className="min-h-screen bg-surface-deep text-stone-200">
      <header className="p-4 border-b border-surface-raised flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide text-gold">The Gambler</h1>
        <SessionBar />
      </header>
      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto p-4 space-y-6">
          <QuickEntryBar />
          <CardSelector />
          <GameInputs />
          <ResultsPanel />
          <CheatSheet />
          <RoundHistory />
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
