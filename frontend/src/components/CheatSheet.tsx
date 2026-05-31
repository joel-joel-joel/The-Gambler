import { useState } from "react";

export function CheatSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm text-gray-300 hover:text-white"
      >
        <span className="font-medium">Mental Math Cheat Sheet</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 text-xs text-gray-300">
          <section>
            <h4 className="font-bold text-white mb-1">Equity from Outs</h4>
            <ul className="space-y-0.5">
              <li>Flop → River: Outs × 4</li>
              <li>Turn → River: Outs × 2</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Common Outs</h4>
            <ul className="space-y-0.5">
              <li>Flush draw: 9 | OESD: 8 | Gutshot: 4 | Overcards: 6</li>
              <li>Flush + OESD: 15 (monster draw ~54% on flop)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Pot Odds Shortcut</h4>
            <ul className="space-y-0.5">
              <li>1/3 pot bet → need 25% equity</li>
              <li>1/2 pot bet → need 25% equity</li>
              <li>2/3 pot bet → need 28.5% equity</li>
              <li>3/4 pot bet → need 30% equity</li>
              <li>Pot-size bet → need 33% equity</li>
              <li>2× pot bet → need 40% equity</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">SPR Guide</h4>
            <ul className="space-y-0.5">
              <li>{"SPR < 3: Go with top pair+. Stack-off territory."}</li>
              <li>SPR 3–6: Top pair is good. Be cautious with marginal.</li>
              <li>SPR 7–13: Need two pair+ or strong draws.</li>
              <li>{"> 13: Deep stacked. Speculative hands gain value."}</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Combos</h4>
            <ul className="space-y-0.5">
              <li>Pocket pair: 6 | Suited: 4 | Offsuit: 12</li>
              <li>Total AK: 16 combos (4 suited + 12 offsuit)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-1">Bluff Math</h4>
            <p>Break-even % = Bluff Size ÷ (Pot + Bluff Size)</p>
          </section>
        </div>
      )}
    </div>
  );
}
