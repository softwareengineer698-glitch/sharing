export const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export const SIGNALING_POLL_INTERVAL = 500;
export const MAX_RECONNECT_ATTEMPTS = 5;
export const RECONNECT_DELAY = 2000;
export const CLEANUP_INTERVAL = 60000;

export type ConnectionStatus =
    | 'idle'
    | 'creating'
    | 'waiting'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed'
    | 'closed';

export interface SignalMessage {
    type: 'offer' | 'answer' | 'candidate' | 'join';
    data: any;
    sender: 'sharer' | 'viewer';
    timestamp: number;
}

export interface Session {
    id: string;
    signals: SignalMessage[];
    createdAt: number;
    lastActivity: number;
    status: ConnectionStatus;
}
