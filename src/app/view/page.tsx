'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectionStatus, PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';
import PusherJS from 'pusher-js';

function ViewerContent() {
    const searchParams = useSearchParams();
    const initialSession = (searchParams.get('session') || '').trim().toUpperCase();
    const [inputValue, setInputValue] = useState(initialSession);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isViewing, setIsViewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleJoin = useCallback(async (sid?: string) => {
        const targetId = sid || inputValue;
        if (!targetId) return;

        setStatus('connecting');
        setIsViewing(true);

        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
            });

            pc.ontrack = (e) => {
                if (videoRef.current) videoRef.current.srcObject = e.streams[0];
                setStatus('connected');
            };

            const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
            const channel = pusher.subscribe(`session-${targetId}`);

            channel.bind('signal', async (data: any) => {
                if (data.sender === 'sharer') {
                    if (data.type === 'offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: targetId, signal: { type: 'answer', data: answer, sender: 'viewer' } }),
                        });
                    } else if (data.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(data.data)); } catch { }
                    }
                }
            });

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: targetId, signal: { type: 'candidate', data: e.candidate, sender: 'viewer' } }),
                    });
                }
            };

            // CRITICAL: Notify the Sharer that we have joined and are listening!
            setTimeout(async () => {
                await fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: targetId, signal: { type: 'join', sender: 'viewer' } }),
                });
            }, 500);

            (window as any).__viewCleanup = () => {
                pusher.unsubscribe(`session-${targetId}`);
                pusher.disconnect();
                pc.close();
            };
        } catch (err) {
            setStatus('failed');
            setIsViewing(false);
        }
    }, [inputValue]);

    useEffect(() => {
        if (initialSession) handleJoin(initialSession);
    }, [initialSession, handleJoin]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8">
            <div className="max-w-4xl mx-auto text-center">
                <h1 className="text-4xl font-bold mb-8">View Screen</h1>
                <div className="mb-8"><StatusBadge status={status} /></div>
                {!isViewing ? (
                    <div className="max-w-md mx-auto space-y-4">
                        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 p-3 text-center" placeholder="CODE" />
                        <button onClick={() => handleJoin()} className="w-full bg-cyan-600 py-3 rounded-xl font-bold">Join Session</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <video ref={videoRef} autoPlay playsInline className="w-full aspect-video bg-black rounded-xl border border-zinc-800" />
                        <button onClick={() => window.location.reload()} className="text-zinc-500">Disconnect</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
