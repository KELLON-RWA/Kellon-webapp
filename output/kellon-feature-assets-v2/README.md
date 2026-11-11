# Kellon homepage feature assets — v2

Three individual transparent PNG product illustrations for the section below the completed hero. This revision uses the built-in image-generation tool in **edit mode**, with the v1 PNGs as references. The v1 assets and documents remain unchanged in the sibling `kellon-feature-assets-v1` directory.

The artwork has exactly **two structural card frames**: one outer backing panel and one inner main UI panel. The intermediate decorative frame has been removed. UI rows, controls, and text are preserved; individual UI controls do not count as additional structural frames. Do not add a bordered, shadowed, or filled website wrapper that makes the illustration appear to have three card layers again.

These are illustrative UI previews, not captures of the current product. The send amount is example data; the artwork does not promise rates or settlement times.

## Files

- `01-buy-deposit.png`: Buy or deposit stablecoins.
- `02-send-withdraw.png`: Send and withdraw.
- `03-invest-yield.png`: Invest and explore yield.
- `PROMPTS.md`: Exact image-edit prompts and references.
- `INTEGRATION-PROMPT.md`: Copy-paste implementation prompt for Codex.

## Recommended use

Keep all website headings, descriptions, navigation, and the risk note as live HTML. Use the PNGs only as supporting artwork. Preserve transparency and aspect ratios; use equal, unframed artwork layout containers with object-fit: contain. Never crop the panel or stretch an image. The visible controls inside the images are illustrative, not interactive.

Real product screenshots or coded UI previews are preferable when exact interface fidelity is required. Before publishing, verify that the depicted features and available payment methods match the actual supported product and markets.

For production, create optimized WebP/AVIF derivatives that retain alpha, using the existing site's image pipeline. Retain these PNG sources. Add explicit width/height based on each final PNG's measured dimensions and concise alt text. Only images below the first viewport should be lazy-loaded. Final dimensions must be checked against the completed exported files; do not assume the v1 dimensions.

## Layout and acceptance checks

- Desktop: three equal-width cards, with aligned artwork areas and live text. Keep the layout wrappers visually unframed so the artwork retains exactly two structural card layers.
- Mobile: a manual horizontal swipe carousel with a small next-card peek, scroll snapping, three compact pink indicators, and accessible keyboard controls. No autoplay or infinite looping.
- Keep the section heading and subheading outside the carousel. Keep the risk note with the third card so it remains visible while that card is displayed on mobile.
- Verify 375px and 390px mobile widths and a typical desktop width: legibility, text wrapping, swiping, keyboard navigation, focus states, contrast, reduced motion, no page-wide horizontal overflow, and an unchanged hero.
- Check the final PNG dimensions, alpha transparency, aspect ratios, panel edges, and exactly two structural frames before integration. Inspect for unintended changes to the UI rows, labels, or example data after the image edits.

No website source was modified by creating this asset pack.
