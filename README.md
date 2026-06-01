# ScreenCast — Real-Time Screen Sharing

A modern, peer-to-peer screen sharing application built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **WebRTC**. Deployable on **Vercel** as a serverless application.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-green?style=flat-square)
![Vercel](https://img.shields.io/badge/Vercel-Ready-black?style=flat-square&logo=vercel)

---

## Features

- 🖥️ **Screen Sharing** — Share your entire screen, a window, or a browser tab
- 📱 **Mobile-Friendly Viewer** — View shared screens on any device (phones, tablets, desktops)
- 🔗 **Peer-to-Peer** — Direct WebRTC connection for low-latency streaming
- 🔑 **Session Codes** — Simple 8-character codes for easy sharing
- 🔄 **Auto Reconnection** — Handles connection drops gracefully
- ⚡ **Serverless** — No WebSocket servers needed; uses polling-based signaling
- 🚀 **Vercel Deployment** — One-click deploy with zero configuration
- 🎨 **Modern UI** — Beautiful dark theme with glassmorphism design

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Sharer     │     │  Vercel API      │     │   Viewer     │
│   Browser    │────▶│  (Signaling)     │◀────│   Browser    │
│              │     │                  │     │              │
│  getDisplay  │     │  POST /api/signal│     │  RTCPeer     │
│  Media()     │     │  GET  /api/signal│     │  Connection  │
│              │     │  POST /api/session│    │              │
│  RTCPeer     │     └──────────────────┘     │  <video>     │
│  Connection  │◀─────── WebRTC P2P ─────────▶│  element     │
└──────────────┘     (Direct media stream)    └──────────────┘
```

### How It Works

1. **Sharer** creates a session and starts screen capture via `getDisplayMedia()`
2. **Signaling** happens through Vercel API routes (polling-based)
3. **WebRTC** peer connection is established using ICE/STUN/TURN
4. **Media stream** flows directly between browsers (peer-to-peer)
5. **Viewer** receives the video track and displays it

## Project Structure

```
thagu69/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── session/
│   │   │   │   └── route.ts       # Session management API
│   │   │   └── signal/
│   │   │       └── route.ts       # WebRTC signaling API
│   │   ├── share/
│   │   │   └── page.tsx           # Screen sharing page
│   │   ├── view/
│   │   │   └── page.tsx           # Viewer page
│   │   ├── globals.css            # Global styles
│   │   ├── layout.tsx             # Root layout with metadata
│   │   └── page.tsx               # Landing page
│   ├── components/
│   │   └── StatusBadge.tsx        # Connection status indicator
│   ├── hooks/
│   │   └── useWebRTC.ts           # WebRTC hook (reusable)
│   └── lib/
│       ├── constants.ts           # Types, config, ICE servers
│       └── session-store.ts       # In-memory session storage
├── .env.example                   # Environment variables template
├── .env.local                     # Local environment variables
├── next.config.ts                 # Next.js configuration
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A modern browser (Chrome, Edge, or Safari)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd thagu69

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. Open the app and click **"Share Your Screen"**
2. Select which screen/window/tab to share (browser will show a permission dialog)
3. Copy the **8-character session code** or the direct link
4. Share the code/link with your viewer
5. The viewer opens **"View Screen"** and enters the session code
6. The screen is now streaming in real-time!

## Deployment on Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/thagu69)

### Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

### Environment Variables on Vercel

Set these in your Vercel project settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_TURN_URL` | Your TURN server URL | For production |
| `NEXT_PUBLIC_TURN_USERNAME` | TURN server username | For production |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | TURN server password | For production |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL | Optional |

## TURN/STUN Server Setup

### Why You Need TURN

STUN servers (included by default) handle most NAT traversal scenarios. However, ~10-15% of connections require a TURN server as a relay. For production, you should configure a TURN server.

### Recommended TURN Providers

1. **Metered TURN** — [metered.ca](https://www.metered.ca/stun-turn) (free tier available)
2. **Twilio** — [twilio.com](https://www.twilio.com/stun-turn) (pay-as-you-go)
3. **Xirsys** — [xirsys.com](https://xirsys.com) (free tier available)
4. **Self-hosted** — [coturn](https://github.com/coturn/coturn)

### Configuration

Update `src/lib/constants.ts` to include your TURN server:

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
  },
];
```

## Scaling Considerations

### Current Architecture (In-Memory Store)

The current implementation uses an in-memory session store, which works for:
- ✅ Single-instance deployments
- ✅ Low-traffic applications
- ✅ Development and testing

### For Production Scale

Replace the in-memory store with a distributed store:

1. **Vercel KV (Upstash Redis)** — Recommended for Vercel deployments
   ```bash
   npm install @vercel/kv
   ```

2. **Upstash Redis** — Serverless Redis
   ```bash
   npm install @upstash/redis
   ```

3. **WebSocket Service** — For real-time signaling instead of polling
   - [Pusher](https://pusher.com)
   - [Ably](https://ably.com)
   - [PartyKit](https://partykit.io) (works great with Vercel)

## Browser Compatibility

| Browser | Share Screen | View Screen |
|---------|-------------|-------------|
| Chrome (Desktop) | ✅ | ✅ |
| Edge (Desktop) | ✅ | ✅ |
| Safari (Desktop) | ✅ | ✅ |
| Firefox (Desktop) | ✅ | ✅ |
| Chrome (Android) | ❌* | ✅ |
| Safari (iOS) | ❌* | ✅ |

> *Screen sharing (`getDisplayMedia`) is not supported on mobile browsers. Mobile users can only **view** shared screens.

## Security Notes

- Screen sharing **always requires explicit user consent** — this is enforced by the browser and cannot be bypassed
- WebRTC connections are encrypted by default (DTLS-SRTP)
- Session IDs are randomly generated UUIDs
- Sessions auto-expire after 1 hour of inactivity
- No data is stored permanently

## License

MIT
