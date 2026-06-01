import { CardSelector } from "./components/CardSelector";
import { GameInputs } from "./components/GameInputs";
import { QuickEntryBar } from "./components/QuickEntryBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { CheatSheet } from "./components/CheatSheet";
import { RoundHistory } from "./components/RoundHistory";
import { ChatSidebar } from "./components/ChatSidebar";
import { UndoBanner } from "./components/UndoBanner";
import { SessionBar } from "./components/SessionBar";
import { PlayersPage } from "./pages/PlayersPage";
import { MyGamePage } from "./pages/MyGamePage";
import { TrainingPage } from "./pages/TrainingPage";
import { useNavigationStore } from "./store/navigationStore";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string }[] = [
  { id: "calculator", label: "Calculator" },
  { id: "players", label: "Players" },
  { id: "myGame", label: "My Game" },
  { id: "training", label: "Training" },
];

function TabNav() {
  const { activeTab, setActiveTab } = useNavigationStore();
  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 cursor-pointer ${
            activeTab === tab.id
              ? "text-gold border-b-2 border-gold"
              : "text-stone-400 hover:text-stone-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function MainContent() {
  const { activeTab } = useNavigationStore();
  switch (activeTab) {
    case "calculator":
      return (
        <div className="space-y-6">
          <QuickEntryBar />
          <CardSelector />
          <GameInputs />
          <ResultsPanel />
          <CheatSheet />
          <RoundHistory />
        </div>
      );
    case "players":
      return <PlayersPage />;
    case "myGame":
      return <MyGamePage />;
    case "training":
      return <TrainingPage />;
  }
}

export default function App() {
  return (
    <div className="min-h-screen bg-surface-deep text-stone-200">
      <header className="p-4 border-b border-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-wide text-gold">The Gambler</h1>
          <TabNav />
        </div>
        <SessionBar />
      </header>
      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto p-4">
          <MainContent />
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
