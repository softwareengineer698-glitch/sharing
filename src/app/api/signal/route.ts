import { NextRequest, NextResponse } from 'next/server';
import { addSignal, getSignals, getSession } from '@/lib/session-store';
import { SignalMessage } from '@/lib/constants';

// POST: Send a signal message
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, signal } = body as {
            sessionId: string;
            signal: SignalMessage;
        };

        if (!sessionId || !signal) {
            return NextResponse.json(
                { error: 'sessionId and signal are required' },
                { status: 400 }
            );
        }

        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        signal.timestamp = Date.now();
        const success = await addSignal(sessionId, signal);

        if (!success) {
            return NextResponse.json(
                { error: 'Failed to add signal' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: 'Failed to process signal' },
            { status: 500 }
        );
    }
}

// GET: Poll for new signals
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const since = searchParams.get('since');
    const role = searchParams.get('role') as 'sharer' | 'viewer';

    if (!sessionId || !role) {
        return NextResponse.json(
            { error: 'sessionId and role query params required' },
            { status: 400 }
        );
    }

    const session = await getSession(sessionId);
    if (!session) {
        return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
        );
    }

    const signals = await getSignals(sessionId, Number(since || 0), role);

    return NextResponse.json({
        signals,
        sessionStatus: session.status,
    });
}
