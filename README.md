# Shuttle — product website

A static, dependency-free marketing site for Shuttle, a native macOS media
offloading application.

```
website/
├── index.html        # the homepage (hero → final CTA)
├── css/site.css      # design tokens, typography, layout, sections, motion
├── css/app.css       # the Shuttle app UI, rendered in HTML for crisp product imagery
├── js/site.js        # progressive enhancement: reveals, transfer simulation, scroll-linked workflow line
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

- **Colour**: `#080808` background, `#0D0D0D` surfaces, `#F4F2ED` / `#8E8E8E` text,
  hairline borders at 5–14% white. The macOS system blue (`#0A84FF`) is reserved for
  product state (progress, active indicators) and the workflow progress line.
- **Type**: Inter Variable with optical sizing (Inter Display cuts kick in on large
  headlines). Geist Mono is used only for technical values — throughput, hashes,
  timecodes, states.
- **Product imagery** is real HTML/CSS rather than bitmaps, so it stays sharp on every
  display and can change state on the page: the hero window plays a transfer from
  Copying → Verifying → Complete with numbers that agree with each other (the clock
  follows the bytes).
- **Motion** is functional and one-shot (nothing loops except the pulse on an active
  state dot and the read stream in the architecture diagram). Everything respects
  `prefers-reduced-motion` and renders a complete static state with JavaScript disabled.

## Placeholders to confirm before launch

- Download links (`#download`) — point at the DMG / App Store listing.
- Supported hash algorithms line ("XXH3 by default · MD5 and SHA-256 when required").
- Footer links (Release notes, Support, Privacy).
