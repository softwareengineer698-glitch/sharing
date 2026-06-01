'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectionStatus } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';

function ViewerContent() {
    const searchParams = useSearchParams();
    const rawSession = searchParams.get('session') || '';
    const initialSession = rawSession.trim().replace(/\\+$/, '').toUpperCase();

    const [sessionId, setSessionId] = useState<string>(initialSession);
    const [inputValue, setInputValue] = useState<string>(initialSession);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isViewing, setIsViewing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleJoinSession = useCallback(async (sid?: string) => {
        const targetSessionId = sid || inputValue.trim().toUpperCase();
        if (!targetSessionId) {
            setError('Please enter a session code');
            return;
        }

        setSessionId(targetSessionId);
        setError(null);
        setStatus('connecting');
        setIsViewing(true);

        try {
            const sessionRes = await fetch(`/api/session?sessionId=${targetSessionId}`);
            if (!sessionRes.ok) {
                throw new Error('Session not found');
            }

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            });

            pc.ontrack = (event) => {
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                    // Safari fix: explicitly call play
                    videoRef.current.play().catch(e => console.warn('Autoplay blocked:', e));
                }
            };

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: targetSessionId,
                            signal: { type: 'candidate', data: event.candidate.toJSON(), sender: 'viewer', timestamp: Date.now() },
                        }),
                    });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setStatus('connected');
                if (pc.iceConnectionState === 'disconnected') setStatus('disconnected');
                if (pc.iceConnectionState === 'failed') setStatus('failed');
            };

            let offerProcessed = false;
            const pollForSignals = async () => {
                try {
                    const pollRes = await fetch(`/api/signal?sessionId=${targetSessionId}&since=0&role=viewer`);
                    if (!pollRes.ok) return;
                    const data = await pollRes.json();
                    if (data.signals) {
                        for (const signal of data.signals) {
                            if (signal.type === 'offer' && !offerProcessed) {
                                offerProcessed = true;
                                await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                                const answer = await pc.createAnswer();
                                await pc.setLocalDescription(answer);
                                await fetch('/api/signal', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ sessionId: targetSessionId, signal: { type: 'answer', data: answer, sender: 'viewer', timestamp: Date.now() } }),
                                });
                            } else if (signal.type === 'candidate') {
                                try { await pc.addIceCandidate(new RTCIceCandidate(signal.data)); } catch { }
                            }
                        }
                    }
                } catch { }
            };

            // Check immediately, then every 400ms
            pollForSignals();
            const pollInterval = setInterval(pollForSignals, 400);

            (window as any).__viewCleanup = () => {
                clearInterval(pollInterval);
                pc.close();
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join');
            setStatus('failed');
            setIsViewing(false);
        }
    }, [inputValue]);

    useEffect(() => {
        if (initialSession && !isViewing) handleJoinSession(initialSession);
    }, [initialSession, handleJoinSession, isViewing]);

    const handleDisconnect = useCallback(() => {
        if ((window as any).__viewCleanup) (window as any).__viewCleanup();
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsViewing(false);
        setStatus('closed');
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <a href="/"><h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">View Screen</h1></a>
                </div>

                <div className="flex justify-center mb-8">
                    <div className="bg-zinc-800/60 backdrop-blur-xl border border-zinc-700/50 rounded-full px-5 py-2.5">
                        <StatusBadge status={status} />
                    </div>
                </div>

                {!isViewing ? (
                    <div className="max-w-md mx-auto bg-zinc-800/40 p-8 rounded-2xl border border-zinc-700/50 shadow-2xl">
                        <h2 className="text-xl font-semibold mb-6 text-center">Join a Session</h2>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                            placeholder="Enter Code"
                            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest mb-4 outline-none focus:border-cyan-500"
                        />
                        <button onClick={() => handleJoinSession()} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 py-3 rounded-xl font-bold">Join Session</button>
                        {error && <p className="mt-4 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/10 rounded-lg">{error}</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div ref={containerRef} className="relative bg-black rounded-2xl overflow-hidden border border-zinc-700/50 aspect-video shadow-2xl">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
                            {status !== 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
                                    <div className="text-center">
                                        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-zinc-400 text-sm">Connecting...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <button onClick={handleDisconnect} className="bg-red-600/10 text-red-300 border border-red-500/20 px-6 py-2.5 rounded-xl">Disconnect</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}><ViewerContent /></Suspense>;
}
