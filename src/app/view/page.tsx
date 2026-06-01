'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ViewerContent() {
    const searchParams = useSearchParams();
    const sid = (searchParams.get('session') || '').trim().toUpperCase();
    const [status, setStatus] = useState('Idle');
    const [isViewing, setIsViewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const join = useCallback(async (targetId: string) => {
        if (!targetId) return;
        setIsViewing(true);
        setStatus('Joining...');

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]
        });

        pc.ontrack = (e) => {
            if (videoRef.current) videoRef.current.srcObject = e.streams[0];
            setStatus('Connected!');
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: targetId, signal: { type: 'candidate', data: e.candidate, sender: 'viewer' } }),
                });
            }
        };

        // Tell sharer we've joined
        await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: targetId, signal: { type: 'join', sender: 'viewer' } }),
        });

        // Polling loop
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?sessionId=${targetId}&role=viewer`);
                const { signals } = await res.json();
                for (const s of signals) {
                    if (s.type === 'offer') {
                        setStatus('Negotiating...');
                        await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: targetId, signal: { type: 'answer', data: answer, sender: 'viewer' } }),
                        });
                    } else if (s.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch { }
                    }
                }
            } catch { }
        }, 400);

        return () => {
            clearInterval(interval);
            pc.close();
        };
    }, []);

    useEffect(() => {
        if (sid) join(sid);
    }, [sid, join]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-4xl font-black text-center text-blue-500 uppercase">View Stream</h1>
                <div className="flex justify-center"><div className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-full font-bold">{status}</div></div>
                {isViewing && (
                    <video ref={videoRef} autoPlay playsInline className="w-full aspect-video bg-black rounded-2xl border border-zinc-800 shadow-2xl" />
                )}
                {!sid && <p className="text-center text-zinc-500">Please open the link shared by the host.</p>}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
