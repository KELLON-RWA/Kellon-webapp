# Integration prompt for Codex

Add a product-overview section immediately after the completed Kellon hero. Preserve the hero and unrelated sections. Use the three supplied v2 PNG previews as supporting artwork, not whole-card screenshots. Follow the existing site's typography, dark navy surfaces, pink accents, spacing, and component conventions.

These PNGs were revised from the v1 originals using the built-in image-generation tool in edit mode. The originals remain unchanged in the sibling `kellon-feature-assets-v1` directory. Use the v2 files for this integration.

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

All headings, descriptions, and the risk note must be HTML, never baked into an image. The preview controls are decorative artwork; do not overlay fake clickable hotspots. These PNGs are illustrative UI previews, not current-product screenshots; verify depicted features and available payment methods before publication.

The v2 artwork has exactly **two structural card frames**: one outer backing panel and one inner main UI panel. Do not add a website card border, shadow, background panel, or decorative wrapper that visually creates a third structural layer. Use unframed layout containers. Preserve existing UI rows, controls, and text inside the artwork.

Keep transparent backgrounds, equal artwork layout areas, image aspect ratios, and no cropping or distortion. Use object-fit: contain. Check each completed PNG's actual dimensions before setting explicit image width/height; do not assume v1 dimensions. Use the site's image optimization pipeline for alpha-preserving WebP/AVIF derivatives and retain the source PNGs. Only images below the first viewport should be lazy-loaded.

Desktop: three equal-width cards side by side, with aligned artwork and text. Let the artwork's two panels provide its own visual framing.

Mobile: manual horizontal swipe carousel. Show roughly one card plus a small peek of the next. Use CSS scroll snapping, three compact pink indicators, and keyboard-accessible previous/next controls or equivalent accessible carousel controls. No autoplay or infinite looping. Keep the heading and subheading outside the carousel. No page-wide horizontal overflow. Preserve native vertical page scrolling and support reduced motion.

Verify at 375px and 390px mobile widths and a typical desktop width. Check text wrapping, image legibility, touch swiping, keyboard navigation, focus states, contrast, risk-note visibility, exactly two structural artwork frames without extra wrapper framing, and that the completed hero is unchanged. Do not invent rates, prices, or promised returns.
