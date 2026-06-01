# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** The Gambler
**Updated:** 2026-06-01
**Category:** Poker Analytics Dashboard (Dark + Gold)

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind Token |
|------|-----|----------------|
| Background (deep) | `#1C1917` | `bg-surface-deep` / `stone-900` |
| Surface (panels) | `#292524` | `bg-surface` / `stone-800` |
| Borders / raised | `#44403C` | `border-surface-raised` / `stone-700` |
| Hover surface | `#57534E` | `bg-surface-hover` / `stone-600` |
| Primary / CTA | `#CA8A04` | `bg-gold` / `text-gold` |
| Gold hover | `#EAB308` | `bg-gold-400` |
| Gold dark | `#854D0E` | `bg-gold-700` |
| Text primary | `#E7E5E4` | `text-stone-200` |
| Text muted | `#A8A29E` | `text-stone-400` |
| Text dim | `#78716C` | `text-stone-500` |
| Positive EV | `#4ADE80` | `text-emerald-400` |
| Negative EV | `#F87171` | `text-red-400` |
| Hole cards bg | `#854D0E` | `bg-gold-700` |
| Community cards bg | emerald-900 | `bg-emerald-900` |

**Color Notes:** Warm dark (stone) + rich gold accents. Casino VIP lounge feel.

### Typography

- **Heading / UI Font:** Fira Sans (300–700)
- **Data / Numbers Font:** Fira Code (monospace, 400–700)
- **Usage:** All numeric values (equity, EV, pot odds, stack sizes) use `font-mono` for alignment
- **Google Fonts:** [Fira Code + Fira Sans](https://fonts.google.com/share?selection.family=Fira+Code:wght@400;500;600;700|Fira+Sans:wght@300;400;500;600;700)

**Tailwind Config:**
```js
fontFamily: {
  sans: ['Fira Sans', 'system-ui', 'sans-serif'],
  mono: ['Fira Code', 'monospace'],
}
```

### Effects

| Effect | Value | Usage |
|--------|-------|-------|
| Glow | `0 0 15px rgba(202, 138, 4, 0.3)` | Recommendation banner, undo banner |
| Glow (small) | `0 0 8px rgba(202, 138, 4, 0.2)` | Selected hole cards |
| Transitions | `duration-200` | All hover/focus state changes |
| Focus ring | `focus:border-gold` | Input fields on focus |

### Card Suits

| Suit | Color |
|------|-------|
| Spades | `text-stone-200` |
| Hearts | `text-red-400` |
| Diamonds | `text-sky-400` |
| Clubs | `text-emerald-400` |

---

## Component Specs

### Buttons (Primary — Gold)

```
bg-gold text-stone-900 font-semibold rounded
hover:bg-gold-400 transition-colors duration-200 cursor-pointer
```

### Buttons (Secondary — Stone)

```
bg-surface-raised text-stone-300 rounded
hover:bg-surface-hover transition-colors duration-200 cursor-pointer
```

### Active State (Position buttons, selected cards)

```
bg-gold text-stone-900 font-semibold   (active)
bg-surface-raised text-stone-300       (inactive)
```

### Metric Cards

```
bg-surface rounded-lg p-3
Label: text-xs text-stone-400
Value: text-lg font-bold font-mono text-stone-100
```

### Inputs

```
bg-surface border border-surface-raised rounded
text-sm font-mono
focus:outline-none focus:border-gold transition-colors duration-200
```

### Recommendation Banner

```
RAISE: bg-emerald-700 shadow-glow
CALL:  bg-amber-700 shadow-glow
FOLD:  bg-red-800
text-3xl font-black tracking-wide
```

### Chat Messages

```
User:      bg-gold-700 text-stone-100
Assistant: bg-surface text-stone-200
```

---

## Anti-Patterns (Do NOT Use)

- Light mode default
- `bg-gray-*` (use `stone-*` and `surface-*` tokens instead)
- `bg-blue-600` for primary actions (use `bg-gold` instead)
- Emojis as icons (use SVG: Heroicons, Lucide)
- Missing `cursor-pointer` on clickable elements
- Layout-shifting hovers (avoid scale transforms)
- Instant state changes (always use `transition-colors duration-200`)
- `text-white` for body text (use `text-stone-200`)

---

## Pre-Delivery Checklist

- [ ] All colors use stone/surface/gold tokens, not raw gray/blue
- [ ] All numeric data uses `font-mono` (Fira Code)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with `transition-colors duration-200`
- [ ] Focus states use `focus:border-gold`
- [ ] No emojis used as icons
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
