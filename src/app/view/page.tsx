'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectionStatus, PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';
import PusherJS from 'pusher-js';

function ViewerContent() {
    const searchParams = useSearchParams();
    const rawSession = searchParams.get('session') || '';
    const initialSession = rawSession.trim().replace(/\\+$/, '').toUpperCase();

    const [sessionId, setSessionId] = useState<string>(initialSession);
    const [inputValue, setInputValue] = useState<string>(initialSession);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isViewing, setIsViewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleJoinSession = useCallback(async (sid?: string) => {
        const targetSessionId = sid || inputValue.trim().toUpperCase();
        if (!targetSessionId) return setError('Enter Code');

        setSessionId(targetSessionId);
        setStatus('connecting');
        setIsViewing(true);

        try {
            const sessionRes = await fetch(`/api/session?sessionId=${targetSessionId}`);
            if (!sessionRes.ok) throw new Error('Session not found');

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
            });

            pc.ontrack = (event) => {
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                    videoRef.current.play().catch(() => { });
                }
            };

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: targetSessionId, signal: { type: 'candidate', data: event.candidate.toJSON(), sender: 'viewer' } }),
                    });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected') setStatus('connected');
                else if (pc.iceConnectionState === 'failed') setStatus('failed');
            };

            // Real-time Push Signaling (INSTANT)
            const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
            const channel = pusher.subscribe(`session-${targetSessionId}`);
            let offerProcessed = false;

            channel.bind('signal', async (data: any) => {
                if (data.sender === 'sharer') {
                    if (data.type === 'offer' && !offerProcessed) {
                        offerProcessed = true;
                        await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: targetSessionId, signal: { type: 'answer', data: answer, sender: 'viewer' } }),
                        });
                    } else if (data.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(data.data)); } catch { }
                    }
                }
            });

            (window as any).__viewCleanup = () => {
                channel.unbind_all();
                pusher.unsubscribe(`session-${targetSessionId}`);
                pusher.disconnect();
                pc.close();
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
            setStatus('failed');
            setIsViewing(false);
        }
    }, [inputValue]);

    useEffect(() => {
        if (initialSession && !isViewing) handleJoinSession(initialSession);
    }, [initialSession, handleJoinSession, isViewing]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-12">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-center mb-8">View Screen</h1>
                <div className="flex justify-center mb-8"><StatusBadge status={status} /></div>
                {!isViewing ? (
                    <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
                        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-center mb-4" />
                        <button onClick={() => handleJoinSession()} className="w-full bg-cyan-600 py-3 rounded-xl">Join</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <video ref={videoRef} autoPlay playsInline className="w-full bg-black rounded-xl aspect-video" />
                        <button onClick={() => setIsViewing(false)} className="block mx-auto text-red-400">Disconnect</button>
                    </div>
                )}
                {error && <p className="text-center text-red-500 mt-4">{error}</p>}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
