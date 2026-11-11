# Integration prompt for Codex

Add a product-overview section immediately after the completed Kellon hero. Preserve the hero and unrelated sections. Use the three supplied PNG previews as supporting artwork, not whole-card screenshots. Follow the existing site's typography, dark navy surfaces, pink accents, spacing, and component conventions.

Section heading: "One wallet. More ways to use your money."
Subheading: "Start with your local currency—or bring the stablecoins you already own."

Use these three cards in this order:

1. Artwork: `01-buy-deposit.png`
   Heading: "Buy or deposit stablecoins"
   Description: "Buy USDC or USDT, or transfer them into your Kellon wallet."
   Alt: "Kellon funding preview with buy and deposit options."

2. Artwork: `02-send-withdraw.png`
   Heading: "Send and withdraw"
   Description: "Send stablecoins to another wallet or withdraw to a supported bank account."
   Alt: "Kellon preview showing send and bank withdrawal options."

3. Artwork: `03-invest-yield.png`
   Heading: "Invest and explore yield"
   Description: "Use your stablecoins to buy tokenized stocks or explore yield opportunities."
   Alt: "Kellon preview showing tokenized stocks and variable-rate yield opportunities."

Show "Returns vary. Investing involves risk." as live text directly below the third card's description, so it remains visible with the investment card on mobile.

All headings, descriptions, and the risk note must be HTML, never baked into an image. The preview controls are decorative artwork; do not overlay fake clickable hotspots. Keep transparent backgrounds, equal artwork frames, image aspect ratios, and no cropping or distortion. Use the site's image optimization pipeline for alpha-preserving WebP/AVIF derivatives and retain the source PNGs.

Desktop: three equal-width cards side by side, with aligned artwork and text. Avoid redundant nested outer borders; let the artwork's panel provide its own visual frame.

Mobile: manual horizontal swipe carousel. Show roughly one card plus a small peek of the next. Use CSS scroll snapping, three compact pink indicators, and keyboard-accessible previous/next controls or equivalent accessible carousel controls. No autoplay or infinite looping. Keep the heading and subheading outside the carousel. No page-wide horizontal overflow. Preserve native vertical page scrolling and support reduced motion.

Verify at 375px and 390px mobile widths and a typical desktop width. Check text wrapping, image legibility, touch swiping, keyboard navigation, focus states, contrast, risk-note visibility, and that the completed hero is unchanged. Do not invent rates, prices, or promised returns.
