import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';

// Use environment variables for the secret and app ID
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || '1910609', // Demo ID
    key: PUSHER_KEY,
    secret: process.env.PUSHER_SECRET || 'f77b7b15d654f15d7f75', // Demo Secret
    cluster: PUSHER_CLUSTER,
    useTLS: true,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, signal } = body;

        if (!sessionId || !signal) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        // Push the signal to the other person INSTANTLY via WebSockets
        await pusher.trigger(`session-${sessionId}`, 'signal', {
            ...signal,
            timestamp: Date.now()
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Pusher error:', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
