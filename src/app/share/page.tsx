'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StatusBadge } from '@/components/StatusBadge';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [isSharing, setIsSharing] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const startSharing = useCallback(async () => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch { return; }

        const sid = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(sid);
        setIsSharing(true);
        setStatus('Waiting for Viewer...');

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
                    body: JSON.stringify({ sessionId: sid, signal: { type: 'candidate', data: e.candidate, sender: 'sharer' } }),
                });
            }
        };

        // Polling Loop (High Frequency)
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?sessionId=${sid}&role=sharer`);
                const { signals } = await res.json();
                for (const s of signals) {
                    if (s.type === 'join') {
                        setStatus('Connecting...');
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        fetch('/api/signal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: sid, signal: { type: 'offer', data: offer, sender: 'sharer' } }),
                        });
                    } else if (s.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        setStatus('Streaming!');
                    } else if (s.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch { }
                    }
                }
            } catch { }
        }, 400);

        return () => {
            clearInterval(interval);
            stream.getTracks().forEach(t => t.stop());
            pc.close();
        };
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
            <div className="max-w-2xl mx-auto space-y-8">
                <h1 className="text-4xl font-black text-center text-cyan-500">SHARE SCREEN</h1>
                <div className="flex justify-center"><div className="bg-zinc-900 px-6 py-2 rounded-full border border-zinc-800 text-lg font-bold">{status}</div></div>
                {!isSharing ? (
                    <button onClick={startSharing} className="w-full bg-cyan-600 hover:bg-cyan-500 py-6 rounded-2xl font-black text-2xl shadow-xl transition-all active:scale-95">START</button>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-center">
                            <p className="text-zinc-500 text-sm uppercase mb-2">Join Code</p>
                            <h2 className="text-5xl font-mono font-bold tracking-tighter">{sessionId}</h2>
                        </div>
                        <video ref={previewRef} autoPlay playsInline muted className="w-full rounded-2xl border border-zinc-800 aspect-video bg-black shadow-2xl" />
                    </div>
                )}
            </div>
        </div>
    );
}
