'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [isSharing, setIsSharing] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    useEffect(() => {
        let savedId = localStorage.getItem('my_permanent_session_id');
        if (!savedId) {
            savedId = Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem('my_permanent_session_id', savedId);
        }
        setSessionId(savedId);
    }, []);

    const startSharing = useCallback(async () => {
        if (!sessionId) return;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch { return; }

        setIsSharing(true);
        setStatus('LIVE / Waiting for Viewer...');
        if (previewRef.current) previewRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]
        });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, signal: { type: 'candidate', data: e.candidate, sender: 'sharer' } }),
                });
            }
        };

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?sessionId=${sessionId}&role=sharer`);
                const { signals } = await res.json();
                for (const s of signals) {
                    if (s.type === 'join') {
                        setStatus('Connecting...');
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        await fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId, signal: { type: 'offer', data: offer, sender: 'sharer' } }),
                        });
                    } else if (s.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        setStatus('STREAMING ACTIVE');
                    } else if (s.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch { }
                    }
                }
            } catch { }
        }, 500);

        return () => {
            clearInterval(interval);
            stream.getTracks().forEach(t => t.stop());
            pc.close();
        };
    }, [sessionId]);

    const copyLink = () => {
        const link = `${window.location.origin}/view?session=${sessionId}`;
        navigator.clipboard.writeText(link);
        alert('Link Copied!');
    };

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-3xl mx-auto space-y-6 text-center">
                <h1 className="text-4xl font-black text-cyan-500 uppercase tracking-tighter">Broadcast Studio</h1>
                <div className="inline-block px-4 py-1 bg-zinc-900 border border-zinc-800 rounded text-cyan-400 font-mono text-xs font-bold uppercase">{status}</div>

                {!isSharing ? (
                    <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 space-y-6">
                        <div className="bg-black p-4 rounded-xl border border-zinc-800 text-sm font-mono text-zinc-500 break-all">
                            {typeof window !== 'undefined' ? `${window.location.origin}/view?session=${sessionId}` : '...'}
                        </div>
                        <button onClick={startSharing} className="w-full bg-cyan-600 py-6 rounded-2xl font-black text-2xl shadow-2xl hover:bg-cyan-500 transition-colors">GO LIVE INSTANTLY</button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-cyan-500/50 shadow-2xl">
                            <video ref={previewRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                            <div className="absolute top-4 left-4 bg-red-500 px-3 py-1 rounded text-[10px] font-bold animate-pulse">LIVE BROADCAST</div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={copyLink} className="flex-1 bg-zinc-800 py-4 rounded-2xl font-bold">COPY LINK</button>
                            <button onClick={() => window.location.reload()} className="flex-1 bg-zinc-900 text-zinc-500 py-4 rounded-2xl">EXIT</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
