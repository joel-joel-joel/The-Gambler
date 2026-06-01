import { useState } from "react";

export function CheatSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-surface-raised rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm text-stone-400 hover:text-stone-200 transition-colors duration-200 cursor-pointer"
      >
        <span className="font-medium">Mental Math Cheat Sheet</span>
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>&#9660;</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 text-xs text-stone-300">
          <section>
            <h4 className="font-bold text-gold mb-1">Equity from Outs</h4>
            <ul className="space-y-0.5">
              <li>Flop → River: Outs × 4</li>
              <li>Turn → River: Outs × 2</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gold mb-1">Common Outs</h4>
            <ul className="space-y-0.5">
              <li>Flush draw: <span className="font-mono">9</span> | OESD: <span className="font-mono">8</span> | Gutshot: <span className="font-mono">4</span> | Overcards: <span className="font-mono">6</span></li>
              <li>Flush + OESD: <span className="font-mono">15</span> (monster draw ~54% on flop)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gold mb-1">Pot Odds Shortcut</h4>
            <ul className="space-y-0.5 font-mono">
              <li>1/3 pot bet → need 25% equity</li>
              <li>1/2 pot bet → need 25% equity</li>
              <li>2/3 pot bet → need 28.5% equity</li>
              <li>3/4 pot bet → need 30% equity</li>
              <li>Pot-size bet → need 33% equity</li>
              <li>2× pot bet → need 40% equity</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gold mb-1">SPR Guide</h4>
            <ul className="space-y-0.5">
              <li>{"SPR < 3: Go with top pair+. Stack-off territory."}</li>
              <li>SPR 3–6: Top pair is good. Be cautious with marginal.</li>
              <li>SPR 7–13: Need two pair+ or strong draws.</li>
              <li>{"> 13: Deep stacked. Speculative hands gain value."}</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gold mb-1">Combos</h4>
            <ul className="space-y-0.5">
              <li>Pocket pair: <span className="font-mono">6</span> | Suited: <span className="font-mono">4</span> | Offsuit: <span className="font-mono">12</span></li>
              <li>Total AK: <span className="font-mono">16</span> combos (4 suited + 12 offsuit)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-gold mb-1">Bluff Math</h4>
            <p className="font-mono">Break-even % = Bluff Size ÷ (Pot + Bluff Size)</p>
          </section>
        </div>
      )}
    </div>
  );
}
