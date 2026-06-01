/**
 * In-memory session store for serverless signaling.
 *
 * ⚠️ IMPORTANT: This in-memory store works for single-instance deployments.
 * For production at scale, replace with Redis, Upstash, or a database.
 *
 * On Vercel serverless, each function invocation may run on a different instance,
 * so we use polling-based signaling where clients exchange messages through API routes.
 * For a more robust solution, consider using Vercel KV (Upstash Redis) or a
 * third-party WebSocket service.
 */

import { Session, SignalMessage } from './constants';
import { kv } from '@vercel/kv';

/**
 * Persists session data to Vercel KV (Redis).
 * This allows multiple serverless instances to share the same session data.
 */

const SESSION_TTL = 3600; // 1 hour in seconds

export async function createSession(id: string): Promise<Session> {
    const session: Session = {
        id,
        signals: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'waiting',
    };

    await kv.set(`session:${id}`, session, { ex: SESSION_TTL });
    return session;
}

export async function getSession(id: string): Promise<Session | null> {
    return await kv.get<Session>(`session:${id}`);
}

export async function addSignal(sessionId: string, signal: SignalMessage): Promise<boolean> {
    const session = await getSession(sessionId);
    if (!session) return false;

    session.signals.push(signal);
    session.lastActivity = Date.now();

    await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
    return true;
}

export async function getSignals(
    sessionId: string,
    since: number,
    sender: 'sharer' | 'viewer'
): Promise<SignalMessage[]> {
    const session = await getSession(sessionId);
    if (!session) return [];

    // Update activity timestamp
    session.lastActivity = Date.now();
    await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });

    // Return signals from the OTHER sender that are newer than 'since'
    return session.signals.filter(
        (s) => s.sender !== sender && s.timestamp > since
    );
}

export async function updateSessionStatus(
    sessionId: string,
    status: Session['status']
): Promise<boolean> {
    const session = await getSession(sessionId);
    if (!session) return false;

    session.status = status;
    session.lastActivity = Date.now();

    await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
    return true;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
    const deleted = await kv.del(`session:${sessionId}`);
    return deleted > 0;
}
