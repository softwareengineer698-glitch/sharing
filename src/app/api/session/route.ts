import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/session-store';

// POST: Create a new session
export async function POST(request: NextRequest) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json(
                { error: 'Valid sessionId is required' },
                { status: 400 }
            );
        }

        // Check if session already exists
        const existing = await getSession(sessionId);
        if (existing) {
            return NextResponse.json(
                { error: 'Session already exists' },
                { status: 409 }
            );
        }

        const session = await createSession(sessionId);
        return NextResponse.json(
            { session: { id: session.id, status: session.status } },
            { status: 201 }
        );
    } catch {
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

// GET: Check if a session exists
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json(
            { error: 'sessionId query param required' },
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

    return NextResponse.json({
        session: { id: session.id, status: session.status },
    });
}
