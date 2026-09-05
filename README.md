# LemGendary AI Studio GUI

Modern cross-platform desktop user interface for the LemGendary AI ecosystem, built with Tauri v2, React 18, TypeScript, and Vite.

## Architectural Overview

LemGendary AI Studio communicates with the Python backend (`lemgendary-env-manager`) via:
1. **REST APIs**: Querying hardware capabilities (`GET /api/hardware`), project health audits (`GET /api/health`), and triggering the Smart Clean Install Pipeline (`POST /api/pipeline/run`).
2. **WebSockets**: Streaming real-time telemetry and validation progress (`WS /ws/log`).
3. **Tauri Native Shell**: Direct process management, window styling, and native operating system integration.

## Design Aesthetics

- **Curated Palette**: Deep slate background (`#0a0d14`), subtle border contrast (`#243252`), cyan (`#06b6d4`) and purple (`#8b5cf6`) accents.
- **Micro-Animations & Smooth Transitions**: Polished hover effects and active state styling.
- **Real-Time Monospace Logs**: High-throughput terminal viewer with color-coded telemetry badges.
- **Strict Zero-Emoji Policy**: Clean, text-only, enterprise-grade interface.

## Development Setup

```bash
# Install NPM dependencies
npm install

# Run Vite development server
npm run dev

# Run Tauri desktop application in development mode
npm run tauri dev

# Build production bundle
npm run build
```
