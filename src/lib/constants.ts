export const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export const SIGNAL_POLL_INTERVAL = 500;
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
