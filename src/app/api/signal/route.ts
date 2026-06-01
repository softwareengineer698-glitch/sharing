import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: NextRequest) {
    try {
        const { sessionId, signal } = await request.json();
        if (!sessionId || !signal) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

        // Store signal with a short 2-minute expiration
        const signalKey = `signals:${sessionId}:${signal.sender}`;
        await kv.rpush(signalKey, JSON.stringify({ ...signal, timestamp: Date.now() }));
        await kv.expire(signalKey, 120);

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'KV Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const role = searchParams.get('role'); // who IS asking?
    if (!sessionId || !role) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    // If I am the sharer, I want signals from the viewer, and vice versa
    const targetRole = role === 'sharer' ? 'viewer' : 'sharer';
    const signalKey = `signals:${sessionId}:${targetRole}`;

    try {
        // Get and clear signals (Atomic read-and-delete behavior)
        const signals = await kv.lrange(signalKey, 0, -1);
        if (signals.length > 0) {
            await kv.del(signalKey);
        }

        return NextResponse.json({ signals: signals.map(s => typeof s === 'string' ? JSON.parse(s) : s) });
    } catch (err) {
        return NextResponse.json({ signals: [] });
    }
}
