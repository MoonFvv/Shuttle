# Shuttle — product website

A static, dependency-free marketing site for Shuttle, a native macOS media
offloading application.

```
website/
├── index.html        # the homepage (hero → final CTA)
├── css/site.css      # Precision Canvas layout, type, sections, Transfer Rail motif
├── css/app.css       # the Shuttle macOS-style product UI, rendered in HTML
├── js/site.js        # progressive enhancement: reveals and product-state simulations
├── fonts/            # self-hosted Inter Variable + Geist Mono Variable (SIL OFL 1.1)
└── assets/           # favicon
```

## Run locally

Any static file server works — there is no build step:

```sh
cd website
python3 -m http.server 8080
# → http://localhost:8080
```

## Design notes

The site is built around **Precision Canvas**: large quiet spaces, strong type,
minimal surfaces, hairline separators and the product UI as the main visual object.
The only recurring motif is a subtle **Transfer Rail** — thin lines and measured
motion that imply source → destinations, copy → verify → complete, and checkpointed
recovery without becoming a flowchart.

- **Colour**: `#050505` background, near-black product surfaces, `#F3F1EC` text,
  `#8C8C8C` secondary text, neutral hairlines. A single warm off-white performance
  section (`#F3F1EB`) creates rhythm without alternating sections.
- **Accent**: macOS-like blue (`#0A84FF`) appears only as product state and rail
  progress. No large accent gradients or glowing borders.
- **Type**: Inter Variable for the site and UI; Geist Mono only for technical values,
  status labels, bytes, time and verification details.
- **Product imagery**: the Shuttle interface is drawn in HTML/CSS rather than bitmaps,
  so it stays sharp and can animate through Copying → Verifying → Complete, one-read
  fan-out, destination isolation and checkpoint resume.
- **Motion**: restrained, product-driven and one-shot. The page respects
  `prefers-reduced-motion` and renders a complete static state with JavaScript disabled.

## Placeholders to confirm before launch

- Download links (`#download`) — point at the DMG / App Store listing.
- Hash algorithm line (`XXH3 · Full`) and verification terminology.
- Footer links (Release notes, Support, Privacy).
