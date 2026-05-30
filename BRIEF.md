## Design Brief: LinkedIn Poster Full UI

### 1. Feature Summary

A three-phase LinkedIn post creation tool for a team of ~16 non-writers (sales, CEO, mixed roles). Phase 1: guided onboarding that coaches users to discover their unique LinkedIn voice (5-6 steps). Phase 2: AI-enriched search queries find inspiration posts, then generate 4-6 post idea cards. Phase 3: split-view editor where the user refines the AI-generated draft alongside a live LinkedIn preview.

### 2. Primary User Action

Pick a post idea and get a polished draft out the door. Everything before that is coaching; everything after is publishing.

### 3. Design Direction

- **Color strategy:** Restrained. Tinted neutrals + one accent at 10% or less.
- **Theme scene:** A salesperson at their desk between meetings, laptop open, 10 minutes before their next call. Office lighting, slightly rushed but focused. They want to post something good, not spend an hour on it. This forces: dark chrome for the shell (feels fast, premium, focused), light surface for the editor (warm, inviting writing space).
- **Anchor references:** Linear (speed, precision, dark chrome), Notion (clean writing surface, block-based), Superhuman (guided workflow, premium feel, opinionated defaults).

### 4. Scope

- **Fidelity:** Production-ready
- **Breadth:** Full flow (onboarding + discovery/cards + editor)
- **Interactivity:** Shipped-quality components with real state management
- **Time intent:** Build to ship, iterate from there

### 5. Layout Strategy

**Onboarding** (`/onboarding`): Centered single-column, one question per screen, large type, progress indicator. Dark background. Each step has a clear question, an input, and a "next" action. No sidebar, no chrome beyond a progress bar.

**Create flow** (`/create`, single-page):
- **Discovery phase:** centered layout showing AI-generated search queries with the ability to adjust. Transitions smoothly into results.
- **Card selection:** 2-column or 3-column grid of suggestion cards. Each card: title (the post concept) + subheader (the angle/hook). One accent-colored CTA on hover/select.
- **Editor:** Split view. Left: the writing surface (light background, full-width text area, toolbar). Right: LinkedIn post preview (mocked LinkedIn card showing how it'll look). The split ratio favors the editor (~60/40).

**Profile edit:** Accessible from a settings icon. Reuses the onboarding step components in an editable form.

### 6. Key States

| State | What the user sees |
|---|---|
| First visit (no profile) | Redirect to onboarding |
| Onboarding in progress | Current step highlighted, progress bar, back/next |
| Onboarding complete | Transition to `/create` |
| Discovery/search | AI generating queries, subtle loading state |
| Cards loaded | 4-6 suggestion cards, one CTA per card |
| Card selected | Smooth transition to split editor with draft generating |
| Editor active | Draft in editor, preview updating in real-time |
| Editor empty | Clean prompt: "Pick a card to start writing" |
| Error (API) | Inline message, retry action, no modal |

### 7. Interaction Model

- **Onboarding:** Step through with next/back. Each step has one focused input (text field, multi-select, or guided prompt). AI may respond inline to help the user think ("That's interesting, tell me more about X").
- **Discovery:** User reviews AI-suggested search queries, can edit or regenerate. Clicking "Find posts" triggers the API.
- **Cards:** Click to select. Selected card expands or transitions to the editor. No drag-and-drop.
- **Editor:** Type to edit. Select text for inline AI toolbar (deferred for later). Real-time preview updates on the right. "Copy" and "Post to LinkedIn" (deferred) actions at the top.

### 8. Content Requirements

- **Onboarding copy:** Conversational, coaching tone. Questions like "What do you know that most people in your industry don't?" not "Enter your unique value proposition."
- **Card titles:** AI-generated post concepts (e.g., "Why I stopped chasing promotions")
- **Card subheaders:** The angle or hook explanation (e.g., "Use your unconventional path from teaching to tech sales as the hook")
- **Editor:** Pre-filled AI draft, editable. Character count. LinkedIn formatting preview.
- **Empty states:** Encouraging, not clinical. "Let's figure out what makes your perspective worth following" not "No profile found."

### 9. Recommended References

Given the flow-based nature with onboarding coaching and split editor, no additional impeccable references beyond the loaded product register are needed for this phase.

### 10. Open Questions

None. All inputs are confirmed. Ready to build.
