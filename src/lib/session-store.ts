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

// Using a global variable to persist across hot reloads in development
const globalStore = globalThis as typeof globalThis & {
    __sessions?: Map<string, Session>;
};

if (!globalStore.__sessions) {
    globalStore.__sessions = new Map<string, Session>();
}

const sessions = globalStore.__sessions;

// Clean up stale sessions (older than 1 hour)
const STALE_TIMEOUT = 60 * 60 * 1000;

function cleanupStaleSessions() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - session.lastActivity > STALE_TIMEOUT) {
            sessions.delete(id);
        }
    }
}

export function createSession(id: string): Session {
    cleanupStaleSessions();
    const session: Session = {
        id,
        signals: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'waiting',
    };
    sessions.set(id, session);
    return session;
}

export function getSession(id: string): Session | undefined {
    return sessions.get(id);
}

export function addSignal(sessionId: string, signal: SignalMessage): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;
    session.signals.push(signal);
    session.lastActivity = Date.now();
    return true;
}

export function getSignals(
    sessionId: string,
    since: number,
    sender: 'sharer' | 'viewer'
): SignalMessage[] {
    const session = sessions.get(sessionId);
    if (!session) return [];
    session.lastActivity = Date.now();
    // Return signals from the OTHER sender that are newer than 'since'
    return session.signals.filter(
        (s) => s.sender !== sender && s.timestamp > since
    );
}

export function updateSessionStatus(
    sessionId: string,
    status: Session['status']
): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;
    session.status = status;
    session.lastActivity = Date.now();
    return true;
}

export function deleteSession(sessionId: string): boolean {
    return sessions.delete(sessionId);
}
