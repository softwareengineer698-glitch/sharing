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
 * Hybrid Store: Uses Vercel KV if configured, otherwise falls back to memory.
 * This ensures the app "just works" locally and on Vercel even without setup.
 */

const SESSION_TTL = 3600; // 1 hour

// Memory Fallback
const memoryStore = globalThis as typeof globalThis & {
    __sessions?: Map<string, Session>;
};
if (!memoryStore.__sessions) {
    memoryStore.__sessions = new Map<string, Session>();
}
const sessions = memoryStore.__sessions;

// Helper to check if KV is actually configured
const isKVEnabled = () => !!process.env.KV_REST_API_URL;

export async function createSession(id: string): Promise<Session> {
    const session: Session = {
        id,
        signals: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'waiting',
    };

    if (isKVEnabled()) {
        try {
            await kv.set(`session:${id}`, session, { ex: SESSION_TTL });
            return session;
        } catch (e) {
            console.warn("KV Storage failed, falling back to memory:", e);
        }
    }

    sessions.set(id, session);
    return session;
}

export async function getSession(id: string): Promise<Session | null> {
    if (isKVEnabled()) {
        try {
            const data = await kv.get<Session>(`session:${id}`);
            if (data) return data;
        } catch (e) {
            console.warn("KV Retrieval failed:", e);
        }
    }
    return sessions.get(id) || null;
}

export async function addSignal(sessionId: string, signal: SignalMessage): Promise<boolean> {
    const session = await getSession(sessionId);
    if (!session) return false;

    session.signals.push(signal);
    session.lastActivity = Date.now();

    if (isKVEnabled()) {
        try {
            await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
            return true;
        } catch { /* fallback to memory below */ }
    }

    sessions.set(sessionId, session);
    return true;
}

export async function getSignals(
    sessionId: string,
    since: number,
    sender: 'sharer' | 'viewer'
): Promise<SignalMessage[]> {
    const session = await getSession(sessionId);
    if (!session) return [];

    session.lastActivity = Date.now();

    if (isKVEnabled()) {
        try {
            await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
        } catch { /* ignore and continue */ }
    } else {
        sessions.set(sessionId, session);
    }

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

    if (isKVEnabled()) {
        try {
            await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
            return true;
        } catch { }
    }

    sessions.set(sessionId, session);
    return true;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
    if (isKVEnabled()) {
        try {
            await kv.del(`session:${sessionId}`);
        } catch { }
    }
    return sessions.delete(sessionId);
}
