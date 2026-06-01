export const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // PRODUCTION TIP: In a real app, inject your TURN credentials here
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-user',
    //   credential: 'your-password'
    // }
];

export const SIGNAL_POLL_INTERVAL = 500;
export const CLEANUP_INTERVAL = 60000; // 1 minute
