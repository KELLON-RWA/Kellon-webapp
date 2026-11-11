# Exact edit prompts — two-layer revision

Mode: built-in image generation, one edit call per image. transparent_background: true. Each v1 PNG was its corresponding edit target; originals preserved.

## Edit prompt used for all three assets

Use case: precise-object-edit. Input Image 1 is the EDIT TARGET, an approved Kellon website feature preview with THREE nested large rounded rectangular card frames. Make ONLY this structural change: reduce those THREE large card layers to exactly TWO. Remove the middle decorative rounded rectangular frame entirely. The final structure must show (1) the outermost backing card with its subtle purple-pink edge, then (2) ONE inner main content card containing the UI. There must be only TWO large nested panel perimeters around the entire interface, not three. Fill the former middle frame area smoothly with the backing card surface; retain a clean gap between the outer backing card and the one inner content card. Do not introduce any replacement outline, inset ring, bevel line, ghost frame, or third decorative perimeter. UI rows, token pills, segmented controls, icon tiles and other actual controls INSIDE the content card remain unchanged and do not count as large structural card layers.
Preserve all original text exactly, all logos and icons, the positions and spacing of the content, navy surfaces, pink accents, original square composition, overall scale, rounded corners, transparency, and transparent outer margins. Do not redesign, add, remove or change UI content. Preserve genuine alpha transparency outside the outer backing card; no solid background. Keep a crisp, high-resolution PNG look. The only change is deleting the middle large decorative frame to leave two structural layers.

## Input mapping

- 01-buy-deposit.png: ../kellon-feature-assets-v1/01-buy-deposit.png
- 02-send-withdraw.png: ../kellon-feature-assets-v1/02-send-withdraw.png
- 03-invest-yield.png: ../kellon-feature-assets-v1/03-invest-yield.png
