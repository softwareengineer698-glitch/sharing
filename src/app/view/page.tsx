'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ViewerContent() {
    const searchParams = useSearchParams();
    const sessionId = (searchParams.get('session') || '').trim().toUpperCase();
    const [status, setStatus] = useState('Starting...');
    const [isViewing, setIsViewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const join = useCallback(async () => {
        if (!sessionId) return;
        setIsViewing(true);
        setStatus('Searching for Stream...');

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]
        });

        pc.ontrack = (e) => {
            if (videoRef.current) {
                videoRef.current.srcObject = e.streams[0];
                videoRef.current.play().catch(() => { });
            }
            setStatus('LIVE');
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, signal: { type: 'candidate', data: e.candidate, sender: 'viewer' } }),
                });
            }
        };

        // Robust Join Signal: Try to notify sharer multiple times to ensure they see us
        const joinInterval = setInterval(() => {
            fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, signal: { type: 'join', sender: 'viewer' } }),
            });
        }, 2000);

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?sessionId=${sessionId}&role=viewer`);
                const { signals } = await res.json();
                for (const s of signals) {
                    if (s.type === 'offer') {
                        clearInterval(joinInterval); // Stop trying to join once we get an offer
                        setStatus('Connecting...');
                        await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId, signal: { type: 'answer', data: answer, sender: 'viewer' } }),
                        });
                    } else if (s.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch { }
                    }
                }
            } catch { }
        }, 500);

        return () => {
            clearInterval(joinInterval);
            clearInterval(pollInterval);
            pc.close();
        };
    }, [sessionId]);

    useEffect(() => {
        if (sessionId) join();
    }, [sessionId, join]);

    return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl space-y-6">
                <h1 className="text-3xl font-black text-blue-500 text-center tracking-tighter uppercase">Viewer</h1>
                <div className="flex justify-center"><div className="bg-zinc-900 px-4 py-1 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{status}</div></div>

                {isViewing ? (
                    <div className="relative aspect-video rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
                        {status !== 'LIVE' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Awaiting Video...</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center p-20 border-2 border-dashed border-zinc-800 rounded-3xl">
                        <p className="text-zinc-500">Redirecting to live stream...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
