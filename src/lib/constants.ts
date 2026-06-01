// WebRTC Configuration
export const ICE_SERVERS: RTCIceServer[] = [
    // Google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // -------- TURN Server Placeholders --------
    // For production, add your own TURN server credentials:
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
    //   credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
    // },
    // {
    //   urls: 'turns:your-turn-server.com:5349',
    //   username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
    //   credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
    // },
];

export const SIGNALING_POLL_INTERVAL = 800; // 0.8s idle
export const FAST_POLL_INTERVAL = 100; // 0.1s Turbo Mode
export const MAX_RECONNECT_ATTEMPTS = 10;
export const RECONNECT_DELAY = 1000; // ms

export type ConnectionStatus =
    | 'idle'
    | 'creating'
    | 'waiting'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed'
    | 'closed';

export type SignalMessage = {
    type: 'offer' | 'answer' | 'candidate';
    data: RTCSessionDescriptionInit | RTCIceCandidateInit;
    sender: 'sharer' | 'viewer';
    timestamp: number;
};

export type Session = {
    id: string;
    signals: SignalMessage[];
    createdAt: number;
    lastActivity: number;
    status: 'waiting' | 'connecting' | 'connected' | 'closed';
};
