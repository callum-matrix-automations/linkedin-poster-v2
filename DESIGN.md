<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Elevateo Posts
description: Elevateo Co. internal tool for crafting authentic LinkedIn posts with AI coaching
colors:
  chrome: "oklch(16% 0.008 80)"
  chrome-light: "oklch(21% 0.009 80)"
  chrome-border: "oklch(30% 0.01 80)"
  chrome-text: "oklch(68% 0.012 80)"
  chrome-text-strong: "oklch(93% 0.015 85)"
  accent-gold: "oklch(80% 0.13 86)"
  accent-gold-hover: "oklch(74% 0.14 84)"
  accent-deep: "oklch(62% 0.11 78)"
  accent-bright: "oklch(90% 0.09 92)"
---

# Design System: Elevateo Posts

## 1. Overview

**Creative North Star: "The Gilded Desk"**

An Elevateo Co. product. A tool that feels like sitting down at a clean, well-appointed desk with exactly what you need and nothing else. The interface is the absence of friction: warm charcoal chrome that recedes, gold reserved for the one thing that matters on each screen, and interactions that complete before you notice them starting. The gold-on-near-black palette is lifted directly from the Elevateo brand: premium, confident, restrained.

This is not a content mill. It does not look like Jasper, Copy.ai, or any tool that treats writing as a commodity. It does not look like Buffer or Hootsuite, cluttered with calendars and analytics competing for attention. It does not look like a ChatGPT-style blank prompt, which abandons the user in an empty room. It does not look like a generic SaaS dashboard with blue accents and a sidebar full of features nobody asked for.

It looks like something built by someone who respects your time, understands LinkedIn, and has opinions about what you should do next.

**Key Characteristics:**
- Warm charcoal chrome with an accurate LinkedIn preview surface
- One task per screen, no multi-panel layouts
- Speed as a design value: instant transitions, smart defaults, minimal clicks
- Coaching presence without patronizing UI
- Restrained gold: the Elevateo accent used sparingly, never decoratively

## 2. Colors

A restrained gold-on-charcoal palette taken from the Elevateo Co. brand. The warm near-black chrome provides authority; gold marks the single most important action or state on each screen.

### Primary
- **Elevateo Gold** (`oklch(80% 0.13 86)`): the one color that means "act now." Primary CTAs, active nav, progress fills, focus borders, streaming cursor. Buttons filled with gold use near-black text (`oklch(20% 0.02 80)`), never white. A deep bronze (`oklch(62% 0.11 78)`) and a bright champagne (`oklch(90% 0.09 92)`) bracket the gold for the brand gradient.

### Neutral
- **Charcoal Chrome** (`oklch(16% 0.008 80)`): the application shell, sidebar, and content surfaces. Warm near-black, hue 80, never pure black.
- **Chrome Light** (`oklch(21% 0.009 80)`): raised panels, cards, inputs, filter trays.
- **Chrome Border** (`oklch(30% 0.01 80)`): borders, dividers, line guides.
- **Light Surface** (`oklch(97.5% 0.003 80)`): warm off-white, only where a light surface is genuinely needed.

### Named Rules
**The One Gold Rule.** Gold appears on 10% or less of any screen. Its rarity is the point. Reserve it for the single action that matters most. The LinkedIn preview pane is the one exception: it stays LinkedIn-accurate (white card, LinkedIn blue) because it shows how the post will actually look.

**The Gold Gradient Rule.** The bronze-to-champagne gold gradient (`--gold-gradient`) is reserved for the Elevateo wordmark and logo only. It is the brand signature, not a decorative fill. Do not gradient buttons or cards.

## 3. Typography

**Display Font:** [technical sans-serif, to be chosen at implementation]
**Body Font:** [same family or complementary technical sans]

Candidates in the right lane: Inter, Geist, SF Pro, IBM Plex Sans. The pairing should feel precise and engineered, not warm or playful. Weight contrast does the heavy lifting: light display, medium body, semibold labels.

**Character:** Clean, technical, no-nonsense. The type should read like well-formatted code documentation crossed with a premium financial report. Hierarchy through scale and weight, never through decoration.

### Hierarchy
- **Display** (light, [clamp to be resolved], tight leading): onboarding headlines, empty states. Used sparingly.
- **Headline** (medium, [to be resolved]): screen titles, card titles in the suggestion view.
- **Title** (semibold, [to be resolved]): section labels, step indicators.
- **Body** (regular, [to be resolved], max 65-75ch): post content, editor text, onboarding descriptions.
- **Label** (medium, [to be resolved], slight letter-spacing): buttons, tags, metadata, chip text.

### Named Rules
**The Weight Ladder Rule.** Hierarchy is expressed through weight and scale only. No underlines, no color-coded headings, no decorative type treatments. If two elements look the same weight and size, one of them is wrong.

## 4. Elevation

Flat by default. Depth is conveyed through tonal layering (lighter surfaces sit above darker ones), not through shadows. The dual-tone architecture (dark chrome / light editor) inherently creates spatial separation without any shadow work.

Shadows are permitted only as subtle feedback on interactive elements: a faint lift on hover for cards in the suggestion view, a slight glow on the focused input. Never ambient, never decorative, never on static surfaces.

### Named Rules
**The Tonal Depth Rule.** Lighter surfaces are closer to the user. The dark shell is the back wall; the light editor is the desk. Shadows are feedback, not architecture.

## 5. Components

[To be defined during implementation. No components exist yet.]

## 6. Do's and Don'ts

### Do:
- **Do** use the charcoal chrome for the app shell; keep the LinkedIn preview pane accurate to the real platform.
- **Do** default to the smart choice. If the system can infer the answer, don't ask the question.
- **Do** write UI copy like a sharp colleague, not like enterprise software. "What makes you different?" not "Please enter your unique value propositions."
- **Do** make transitions feel instant. Responsive motion energy: feedback and state changes, no choreographed entrances or scroll-driven sequences.
- **Do** use Elevateo gold for the single most important action per screen. Everything else is neutral. Gold-filled buttons take near-black text.

### Don't:
- **Don't** make it look like a content mill (Jasper, Copy.ai). No "generate 10 variations" buttons, no template grids, no factory-floor aesthetic.
- **Don't** make it look like a social media scheduler (Buffer, Hootsuite). No calendars, no multi-platform toggles, no analytics dashboards competing for space.
- **Don't** make it look like a generic SaaS dashboard. No blue accent + sidebar + card grid formula. No icon-heading-text card repeating six times.
- **Don't** make it look like an AI chat interface (ChatGPT). No blank prompt box as the primary interaction. Guide the user, don't abandon them.
- **Don't** use border-left or border-right greater than 1px as colored accent stripes.
- **Don't** use gradient text anywhere except the Elevateo wordmark, or glassmorphism.
- **Don't** put white text on a gold button. Gold is light; it takes near-black text.
- **Don't** use em dashes in any UI copy.
- **Don't** nest cards inside cards.
- **Don't** animate CSS layout properties. Transitions on transform and opacity only.
