# Mivtza Lulav — visual redesign spec (from "Mivtza Lulav Homepage_1" PSD)

Source of truth: REFERENCE-homepage.png (the flattened PSD composite, 1920x1824). Match it closely on the Home page; extend the same system to every other page while keeping their existing layouts and behavior.

## Palette (sampled from the PSD)
- navy (headings, numbers, body on light):      #001c4c
- green-deep (brand green: nav text, eyebrows, CTA fill, "total shakes"): #094b26
- green-mid (progress fills, active pills):       #51a05f  ->  #64bc78 / #68c07b (gradient light end)
- gold (highlight line in hero, eyebrow on dark): #ffde49  (button gold #f7dc4c)
- sky (header bar, cards):                        #c3ecff
- mint (page background below the hero):          #deedda
- track (progress/bar tracks):                    #9eddf9
- blue-accent (rank numerals 4, 5):               #1a4896
- race bar palette (one per school, in this order): #68c07b green, #fbcc4a yellow, #4873b3 blue, #eb635d red, #11a294 teal
- hero glass panel: green-deep at ~80% opacity over the city photo, large radius (~40px), subtle blur (backdrop-filter)
- buttons: "I'm a Soldier — Log Shakes" = green gradient (#094b26 -> #2f8a4d), text white; "See the Campaigns" = gold->green gradient (#f7dc4c -> #51a05f), text green-deep. Both pill-shaped (fully rounded), condensed caps.
- nav: text green-deep condensed caps; active item = green pill (#68c07b -> #51a05f) with green-deep text.
- toggle (% of goal / Total shakes): green pill, active segment darker (#549182 vs #69c07c), condensed caps.

## Typography
- Family "Exo" (Google Fonts: Exo, weights 300i,400,600,700,700i,800,900). Load: https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,400;0,600;0,700;0,800;0,900;1,300;1,700&family=Bebas+Neue&display=swap
- "Duke Fill" (commercial) is used for condensed caps: wordmark line "TZIVOS HASHEM", nav, buttons, toggle. Substitute: "Bebas Neue" (Google). If a licensed Duke Fill file is provided later, swap it in via @font-face — keep a single CSS variable --font-cond so the swap is one line.
- Fallback stacks: Exo -> system-ui, sans-serif; Bebas Neue -> "Arial Narrow", Impact, sans-serif.
- Scale (PSD px at 1920 wide; use as CSS px at desktop, fluidly reduce on phones):
  - Wordmark: "MIVTZA LULAV" Exo Bold 24px green-deep uppercase; "TZIVOS HASHEM" condensed 11px green-deep, letter-spacing .06em.
  - Nav items: condensed 30px green-deep uppercase.
  - Hero eyebrow: Exo SemiBold 18px gold uppercase, letter-spacing .1em.
  - Hero heading: Exo Black 36px white uppercase, line-height 1.15; third line "ONE GIANT MISSION." in gold.
  - Hero body: Exo Regular 24px white, max ~30ch.
  - Hero buttons: condensed 24px, pill, ~44px tall.
  - Card eyebrow ("ONE GIANT MISSION · NATIONWIDE", "THE RACE"): Exo ExtraBold 18px green-deep uppercase, with the small lulav icon / flag icon before it.
  - Small labels ("GOAL", "TOTAL SHAKES", tile labels): Exo SemiBold 18-24px navy uppercase.
  - Big numbers: Exo Black 36px — goal in navy, total shakes in green-deep, "92%" in green-deep.
  - Stat tiles: number Exo Black 36px navy; label Exo SemiBold 24px navy uppercase; 3D icon at left (~80px).
  - Race heading: Exo Bold Italic 24px navy ("Schools going head to head"). School names Exo SemiBold 20px navy. Percent Exo Bold 16px green-deep. Ranks 4/5 Exo Bold Italic 24px blue-accent. Footnote Exo Light Italic 14px navy.

## Layout — Home (match the reference)
1. Header: sky (#c3ecff) bar ~100px tall; TH shield logo + two-line wordmark left; nav right; "Soldier Login" (or "My Missions" when logged in) as the green pill.
2. Hero: full-bleed city photo (hero-city.jpg) ~620px tall on desktop, object-fit cover. Left: the green glass panel (padding ~40px, radius ~40px) containing eyebrow, heading, body, two pill buttons. Right: hero-boy.png cutout, bottom-aligned, overlapping the hero's bottom edge slightly, right of center. On phones: panel full-width over the photo, boy hidden or reduced (keep it readable — the panel is the priority).
3. Page background below the hero: mint (#deedda).
4. Nationwide card: sky card, radius ~40px, wide (max ~1400px), overlapping the hero bottom by ~20px. Row 1 eyebrow. Row 2: GOAL / TOTAL SHAKES labels, then the two big numbers; "92%" right-aligned. Row 3: progress bar — rounded track (#9eddf9) ~24px tall, green gradient fill, the lulav-esrog.png render standing on the fill's end as the marker. Row 4: three stat tiles (icon-soldier-hat, icon-school, icon-camera + number + label) in a row; stack on phones.
5. Race card: sky card. Eyebrow with flag.png + "THE RACE"; heading italic; the toggle pill right. Rows: medal-gold/silver/bronze renders for 1-3 then italic blue numerals; school logo (existing SchoolLogo component); name; bar (track #9eddf9, per-school gradient fill from the race palette by rank order); percent right. Footnote italic.
6. School campaign grid below stays, restyled as sky cards on mint.

## Other pages (extend the system, keep layouts)
- Layout header/footer everywhere as above; footer green-deep with white/gold text.
- School campaign page: hero band becomes the same green-deep panel treatment (or the city photo dimmed) with the school logo; the wide GoalMeter keeps its current composition and positions EXACTLY (client-tuned) but reskinned: arrow gradient gold->green, numbers navy/green, panel sky; buttons become the new pills.
- Kid dashboard, Succos report, login pages, admin, how-to: sky cards on mint, Exo type, navy/green text, pill buttons, condensed caps for button labels and nav only (not for body copy).
- Keep every existing responsive fix from the blocker work (mobile menu, stacked tiles, race rows, wide-meter phone branch).
- Replace the theme tokens in src/index.css (@theme) rather than sprinkling hex values; update .btn variants there.

## Assets (staged in design-assets/; copy into public/design/ in the repo)
hero-city.jpg (1919x624), hero-boy.png (461x624 cutout), hero-boy-filtered.png (alt), icon-soldier-hat.png, icon-school.png, icon-camera.png, medal-gold.png, medal-silver.png, medal-bronze.png, lulav-esrog.png (38x150 marker), lulav-esrog-small.png, lulav-icon.png (eyebrow icon), flag.png, th-logo-color.png. All icon renders are small (50-105px) — display them at 1x size or up to 1.5x; do not upscale further.
Reference: REFERENCE-homepage.png.

## Non-negotiables
- No content or behavior changes; this is a reskin + Home hero/card layout match.
- Do not touch the roster data file, dist/, or anything the blocker fixes changed functionally.
- Contrast: body text on sky/mint must be navy or green-deep (both pass); gold only on green-deep or over the dark glass panel.

## Client decisions (2026-09-14 00:10)
- Condensed face: use Bebas Neue now (--font-cond); Duke Fill may be supplied later — keep the swap to one @font-face + one variable.
- School campaign page: KEEP the wide GoalMeter arrow composition and every overlay position exactly as-is; only reskin (colors, fonts, pill buttons, sky panel). Do NOT replace it with the horizontal bar.
- Nationwide (Home) card: match the comp — horizontal bar with the lulav-esrog marker replaces the arrow there.
- Sequencing: the redesign is built ON TOP of the 12 blocker-fix commits; preserve all of their responsive/mobile branches and behavior.
