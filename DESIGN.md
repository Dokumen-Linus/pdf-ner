# Design System Inspired by Tesla

## 1. Visual Theme & Atmosphere

Tesla's website is radical subtraction: a digital showroom where the product dominates and the interface nearly disappears. Pages open with full-viewport cinematic vehicle photography: three cars on polished concrete against a hazy cityscape sky, with a single translucent-white model name above. There are no decorative borders, gradients, patterns, or shadows. The UI provides only enough structure to navigate, then gets out of the way. Every non-image pixel is white space; that restraint is the system's strongest statement.

The palette is intentionally ascetic: one blue (`#3E6AE1`) for primary CTAs, three dark grays for text hierarchy, and white everywhere else. Photography carries the emotion through landscape shots, studio-lit profiles, and atmospheric edge-to-edge compositions. UI chrome dissolves into imagery. The nav floats over the hero with no visible background, border, or shadow; the TESLA wordmark and five labels rely on the image beneath for contrast.

Typography has moved from Gotham to Universal Sans, split into Display for headlines and Text for body/UI. This unifies website, app, and in-car software. Display renders hero titles at 40px/500; Text covers nav (14px/500) and body (14px/400). Its geometric precision and slightly humanist terminals feel engineered, matching Tesla's technology-first identity. No text shadows, gradients, or decorative type treatments appear; clarity is the treatment.

**Key Characteristics**
- Full-viewport hero sections (`100vh`) dominated by cinematic car photography and minimal overlay UI.
- Near-zero decoration: no shadows, gradients, borders, or patterns.
- Single accent: Electric Blue (`#3E6AE1`) only for primary CTA buttons.
- Universal Sans Display/Text across web, app, and in-car interfaces.
- Photography-first presentation; product imagery carries emotional weight.
- Frosted-glass navigation concept: transparent/white nav floating over hero content.
- Universal interactive timing: `0.33s cubic-bezier` transitions.
- Carousel hero with dots and edge arrows for multiple vehicle showcases.
- Persistent bottom "Ask a Question" chatbot bar.

## 2. Color Palette & Roles

### Primary
- **Electric Blue** (`#3E6AE1`): Primary CTA background, rgb(62, 106, 225). The only chromatic interface color; used for "Order Now" and other primary actions.
- **Pure White** (`#FFFFFF`): Dominant surface, panel, nav, secondary-button, and page background; the canvas for photography.

### Secondary & Accent
- **Promo Blue** (`#3E6AE1`): Same blue used for promotional hero text such as "0% APR Available," visually linking incentive messaging to action.
- No secondary accent colors. The system avoids color variety to preserve discipline.

### Surface & Background
- **White Canvas** (`#FFFFFF`): Page background, nav panel, dropdowns, and containers.
- **Light Ash** (`#F4F4F4`): Subtle alternate surface, rgb(244, 244, 244).
- **Carbon Dark** (`#171A20`): Dark surface and hero text overlay color, rgb(23, 26, 32); warm near-black with blue undertone.
- **Frosted Glass** (`rgba(255,255,255,0.75)`): Semi-transparent white for scrolled nav backdrop-filter effects.

### Neutrals & Text
- **Carbon Dark** (`#171A20`): Primary headings, model names, nav labels, and hero titles on light backgrounds.
- **Graphite** (`#393C41`): Body and secondary text, rgb(57, 60, 65).
- **Pewter** (`#5C5E62`): Tertiary text and links such as "Learn" and "Order," rgb(92, 94, 98).
- **Silver Fog** (`#8E8E8E`): Input placeholders and disabled states, rgb(142, 142, 142).
- **Cloud Gray** (`#EEEEEE`): Light borders/dividers, rgb(238, 238, 238).
- **Pale Silver** (`#D0D1D2`): Subtle borders and delineation, rgb(208, 209, 210).

### Semantic & Gradient Use
- Marketing pages avoid semantic color coding; form error/success/warning states use browser defaults.
- Blue (`#3E6AE1`) is the only interactive color signal.
- No gradients are used. Depth comes from photography, whitespace, and contrast between full-bleed imagery and white surfaces.
- Navigation layers through opacity/frosted glass, not gradients or shadows.

## 3. Typography Rules

### Font Family
- **Display**: `Universal Sans Display`, -apple-system, Arial, sans-serif. Used for hero titles and large model names; geometric, precisely proportioned, and the Gotham replacement for Tesla's unified digital ecosystem.
- **Text/UI**: `Universal Sans Text`, -apple-system, Arial, sans-serif. Used for nav, body, buttons, and all UI text; optimized for small-size legibility with slightly wider proportions.
- No OpenType features or italic variants are observed on the marketing site.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Hero Title | 40px (2.50rem) | 500 | 48px (1.20) | normal | Universal Sans Display, white on dark hero imagery |
| Product Name | 17px (1.06rem) | 500 | 20px (1.18) | normal | Universal Sans Text, model names in nav panel/cards |
| Nav Item | 14px (0.88rem) | 500 | 16.8px (1.20) | normal | Universal Sans Text, primary nav labels |
| Body Text | 14px (0.88rem) | 400 | 20px (1.43) | normal | Universal Sans Text, paragraphs/descriptions |
| Button Label | 14px (0.88rem) | 500 | 16.8px (1.20) | normal | Universal Sans Text, CTA labels |
| Sub-link | 14px (0.88rem) | 400 | 20px (1.43) | normal | Tertiary links: Learn, Order, Experience |
| Promo Text | 22px (1.38rem) | 400 | 20px (0.91) | normal | White hero promo text, e.g. "0% APR Available" |
| Category Label | 16px (est.) | 500 | - | normal | White card labels such as "Sport Sedan" |

### Principles
- **Normal letter-spacing everywhere**: Tesla does not use negative tracking; the typeface speaks without manipulation.
- **Weight restraint**: Only 500 for headings/UI and 400 for body. No 700 bold, 300 light, or typographic drama.
- **Unified sizing**: Most UI text is 14px; only hero titles (40px) and promo text (22px) break the pattern.
- **Display/Text split**: Display handles hero scale; Text handles UI. The optical correction is subtle and stylistically continuous.
- **No text transforms**: Main nav and CTAs avoid uppercase transforms; understated casing reinforces calm confidence.

## 4. Component Stylings

### Buttons
All buttons use barely rounded rectangles (`4px` radius), creating a sharp technical feel that mirrors vehicle precision.

**Primary CTA**
- Default: bg `#3E6AE1`, text `#FFFFFF`, font 14px/500, padding 4px with centered content, radius 4px, min-height 40px, width 200px.
- Border: `3px solid transparent`, reserving focus/active border space.
- Box shadow: `rgba(0,0,0,0) 0 0 0 2px inset`, invisible at rest and animated on focus.
- Transition: `border-color 0.33s, background-color 0.33s, color 0.33s, box-shadow 0.25s`.
- Hover: subtle blue darkening.
- Use: "Order Now" and other primary actions.

**Secondary CTA**
- Default: bg `#FFFFFF`, text `#393C41`, same dimensions and border pattern as primary.
- Transition: same `0.33s` timing.
- Use: "View Inventory" beside the primary CTA.

**Nav Button**
- Default: transparent bg, `#171A20` text, 14px/500, radius 4px, padding `4px 16px`, min-height 32px.
- Transition: `color 0.33s, background-color 0.33s`.
- Active/expanded: subtle background highlight.
- Use: Vehicles, Energy, Charging, Discover, Shop.

**Text Link**
- Default: `#5C5E62`, 14px/400, no bg or border.
- Hover: underline via box-shadow transition.
- Transition: `box-shadow 0.33s cubic-bezier(0.5,0,0,0.75), color 0.33s`.
- Use: Learn, Order, Experience, New, Pre-Owned.

### Cards & Containers

**Vehicle Card (Navigation Panel)**
- Transparent background on white panel; no border or shadow.
- Content: transparent PNG vehicle image, centered model name, and two text links below.
- Layout: 3-column grid in dropdown.
- Interaction lives in the text links; the card itself has no hover animation.

**Category Card (Homepage Lower Section)**
- Full-bleed landscape photography with ~12px radius and `overflow: hidden`.
- White top-left label such as "Sport Sedan" or "Midsize SUV".
- Large ~2:1 aspect ratio.
- No shadow, border, or overlay gradient; text contrast depends on image darkness.

### Inputs & Forms
- Transparent background, Carbon Dark text, Silver Fog placeholders.
- Minimal border, usually browser default.
- Universal Sans Text at 14px.
- The bottom "Ask a Question" chatbot input uses a clean white background and subtle border.

### Navigation
- **Desktop**: TESLA wordmark left, five centered category buttons, three right icon buttons for help, globe/language, and account.
- **Background**: Starts transparent over dark hero, transitions to opaque white on scroll via `tds-site-header--white-background`.
- **Dropdown**: Full-width white panel with 3-column vehicle grid plus right sidebar text links; no shadow or border.
- **Sticky behavior**: `sticky-without-slide`; remains at top without slide-in animation.
- **Mobile**: Hamburger collapse.
- **Separator**: none; nav blends into hero/content.

### Image Treatment
- **Hero**: Full-viewport (`100vh`), edge-to-edge, no padding or margin.
- **Vehicle images**: Studio-quality transparent PNGs on white dropdown background, usually 3/4 angle.
- **Category cards**: Landscape photos, ~2:1 ratio, ~12px radius.
- **Carousel**: Auto-advancing with three dots and edge arrows.
- **Lazy loading**: Below-fold sections render blank white until scrolled into view.

### Persistent Chat Bar
- Fixed to viewport bottom across sections.
- White background with subtle border.
- Contains chat icon, "Ask a Question" label, placeholder "What's Dog Mode?", send icon, and "Schedule a Drive Today" secondary CTA.
- Schedule CTA includes a teal/blue icon accent.

## 5. Layout Principles

### Spacing System
- **Base unit**: 8px.
- **Common values**: 8px (0.5rem), 16px (1rem), 21.44px (1.34rem).
- **Button padding**: 4px outer with flex centering; nav items use `4px 16px`.
- **Section padding**: Full-viewport sections with vertically centered content.
- **Card gap**: ~16px between category cards.

### Grid & Container
- **Max width**: ~1383px; most content uses full viewport width.
- **Hero**: Full-bleed, edge-to-edge, `100vh`.
- **Nav panel**: 3-column vehicle grid with right text sidebar, roughly 70/30 split.
- **Category cards**: 2-up layout: large left card plus smaller right card.

### Whitespace Philosophy
Whitespace is a luxury signal. Each full-height section shows one message at a time: one car, one model name, one CTA pair. Scrolling feels gallery-like rather than feed-like. White space frames the vehicle as an art object instead of filling every available area.

### Border Radius Scale
| Value | Context |
|-------|---------|
| 0px | Default sharp edges for most elements |
| 4px | Primary, secondary, and nav buttons |
| ~12px | Larger category cards |
| 50% | Carousel dot indicators |

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Level 0 (Flat) | No shadow, no border | Default cards, panels, and resting buttons |
| Level 1 (Frost) | `rgba(255,255,255,0.75)` backdrop | Scrolled navigation frosted glass |
| Level 2 (Overlay) | `rgba(128,128,128,0.65)` | Modal overlays and region/cookie popups |
| Level 3 (Subtle) | `rgba(0,0,0,0.05)` | Rare minimal hover shadow hints |

### Shadow Philosophy
Elevation is essentially absent. The site avoids box shadows in the primary UI and communicates depth through:
1. **Z-index layering**: Sticky nav sits above hero content through positioning.
2. **Opacity**: Frosted nav and modal overlays use transparent backgrounds.
3. **Photography**: Perspective, lighting, and composition provide depth, making UI shadows redundant.

### Decorative Depth
- No UI gradients, glows, or atmospheric effects.
- Hero imagery supplies richness: sunset skies, reflected light, and studio ground shadows.
- Carousel arrows use semi-transparent white backgrounds to float above imagery without disruption.

## 7. Do's and Don'ts

### Do
- Let photography dominate; the product is the design.
- Use Electric Blue (`#3E6AE1`) only for primary CTAs.
- Keep major content in viewport-height sections: one message per screen.
- Use weights 400-500 only.
- Use 4px radius for interactive elements.
- Treat whitespace as luxury; do not fill space just because it exists.
- Keep transitions at `0.33s`.
- Use transparent PNG vehicle imagery on white backgrounds.
- Center CTAs below model names in the rhythm: model -> subtitle -> buttons.
- Preserve the Display/Text split: Display for hero scale, Text for everything else.

### Don't
- Add shadows; they contradict the flat gallery aesthetic.
- Use more than one chromatic color beyond the blue CTA.
- Add gradients, patterns, or decorative surface backgrounds.
- Use web text larger than 40px.
- Add borders to cards or containers; use spacing for separation.
- Use uppercase transforms; keep the calm lowercase tone.
- Use pill buttons or large radii; 4px is deliberate.
- Replace Universal Sans; cross-platform consistency matters.
- Add scale/translate hover animations; interactions are color-only.
- Clutter a viewport with more than two action buttons.

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <768px | Single column, hamburger nav, hero text ~28px, stacked CTAs, full-width category cards |
| Tablet | 768-1024px | 2-column nav panel, full-height hero, side-by-side CTAs, reduced horizontal padding |
| Desktop | 1024-1440px | Full nav, 3-column dropdown vehicle grid, 40px hero title, side-by-side CTAs at 200px/160px |
| Large Desktop | >1440px | Centered content, hero photography fills wider viewports, max-width nav-panel content |

### Touch Targets
- Primary CTAs: 200px x 40px minimum, exceeding the 44x44px WCAG target area.
- Nav buttons: minimum 32px height with `4px 16px` padding.
- Carousel arrows: ~44px square, semi-transparent white, at viewport edges.
- Text links: 14px text with sufficient line-height spacing.

### Collapsing Strategy
- **Navigation**: Desktop category buttons collapse to mobile hamburger/drawer.
- **Hero CTA pair**: Side-by-side desktop buttons stack on mobile.
- **Category cards**: 2-up desktop layout becomes single-column full-width.
- **Vehicle grid**: 3 columns on desktop, 2 on tablet, 1 on mobile.
- **Spacing**: Vertical generosity remains; horizontal padding reduces.

### Image Behavior
- Hero images fill the viewport at every breakpoint.
- Carousel images use `object-fit: cover` to keep cinematic composition.
- Transparent PNG nav vehicles scale proportionally inside grid cells.
- Category images keep landscape ratio and clip with `overflow: hidden` plus radius.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: Electric Blue (`#3E6AE1`)
- Background: Pure White (`#FFFFFF`)
- Heading text: Carbon Dark (`#171A20`)
- Body text: Graphite (`#393C41`)
- Tertiary text: Pewter (`#5C5E62`)
- Placeholder: Silver Fog (`#8E8E8E`)
- Alternate surface: Light Ash (`#F4F4F4`)
- Dark surface: Carbon Dark (`#171A20`)

### Example Component Prompts
- "Create a hero section with a full-viewport background image, centered 'Model Y' title in Universal Sans Display at 40px weight 500 in white, a subtitle line below, and two side-by-side buttons: Electric Blue (#3E6AE1) 'Order Now' and white 'View Inventory', both 4px radius and 40px high."
- "Design a nav bar with a spaced-letter wordmark on the left, five centered text buttons (14px, weight 500, Carbon Dark #171A20), and three right icon buttons, all on white with no shadow or border."
- "Build a 3-column vehicle card grid: each card shows a transparent-background car image above a 17px/500 Carbon Dark model name and two 14px/400 Pewter links, 'Learn' and 'Order', on pure white with no borders or shadows."
- "Create a category card with full-bleed landscape photography, 12px radius, hidden overflow, and a white 'Sport Sedan' label in the top-left corner with no overlay gradient."
- "Design a persistent bottom bar with an 'Ask a Question' chat input, send icon, and 'Schedule a Drive Today' secondary CTA with a teal icon, fixed to the viewport bottom on white."

### Iteration Guide
When refining screens generated with this system:
1. Focus on one component at a time; minimal systems expose every pixel.
2. Reference exact color names and hex values; the palette has only 6-7 colors.
3. Use natural language for intent, not just CSS values: "barely rounded corners" over "border-radius: 4px."
4. Pair measurements with feel: "gallery-like silence between sections" conveys whitespace better than "margin-bottom: 100vh."
5. Verify photography carries the emotion. If the UI feels "designed," it is too much.
