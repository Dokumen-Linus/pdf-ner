# Design

## Direction

- Preserve the Tesla-inspired direction: radical subtraction, product/document focus, and minimal interface chrome.
- Let real content and imagery carry emotion. Avoid decorative UI filling empty space.
- Prefer calm, engineered surfaces over expressive decoration.

## What CSS Owns

- Global palette, typography defaults, border radius, focus rings, common surfaces, button timing, page shells, public navigation/footer, chatbot chrome, PDF toolbar chrome, status panels, and sticky action bars belong in `web/src/styles.css`.
- Before adding repeated Tailwind utilities to JSX, check whether a reusable class belongs in `styles.css`.
- Keep JSX classes for layout that is unique to one component, state-driven variants, or dynamic data.

## What Agents Still Decide

- Choose strong real or generated imagery for marketing/public pages when visual context matters.
- Use full-bleed, image-led composition for landing-style sections.
- Keep operational/private app screens denser, quieter, and optimized for scanning.
- Keep each viewport focused: one primary idea, one or two actions, no decorative clutter.
- Use whitespace as a luxury signal; do not fill space just because it exists.

## Imagery

- Prefer actual product, document, workflow, or generated bitmap imagery over abstract SVG decoration.
- Hero imagery should be edge-to-edge and inspectable, not dark, blurred, cropped, or generic stock-like when users need to understand the product.
- Category or feature imagery should stay simple and content-revealing.

## Interaction

- Interactions should be restrained: color, opacity, and focus changes first.
- Avoid scale/translate hover effects except for small floating affordances where already established.
- Keep visible focus states accessible.

## Do

- Use Electric Blue only for primary actions and key interactive emphasis.
- Keep content hierarchy simple and readable.
- Prefer Lucide icons for controls.
- Keep button counts low in marketing sections.
- Use CSS classes from `styles.css` for repeated presentation.

## Don't

- Add gradients, patterns, glows, or decorative blobs.
- Add shadows to primary UI unless the component is explicitly an overlay.
- Use large radii for standard controls.
- Add uppercase transforms broadly.
- Create one-off color/radius/type systems inside components.
