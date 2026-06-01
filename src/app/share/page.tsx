'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [isSharing, setIsSharing] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let savedId = localStorage.getItem('my_permanent_session_id');
        if (!savedId) {
            savedId = Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem('my_permanent_session_id', savedId);
        }
        setSessionId(savedId);
    }, []);

    const startSharing = useCallback(async () => {
        let stream: MediaStream;
        try {
            // 1. Capture screen IMMEDIATELY
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: true
            });

            // 2. Show the user their own live screen IMMEDIATELY
            setIsSharing(true);
            setStatus('LIVE & BROADCASTING');

            // We must wait a tiny bit for the video element to mount after setIsSharing(true)
            setTimeout(() => {
                if (previewRef.current) {
                    previewRef.current.srcObject = stream;
                }
            }, 50);

            // 3. Start the background signaling (WebRTC)
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]
            });

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: sessionId, signal: { type: 'candidate', data: e.candidate, sender: 'sharer' } }),
                    });
                }
            };

            const interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/signal?sessionId=${sessionId}&role=sharer`);
                    const { signals } = await res.json();
                    for (const s of signals) {
                        if (s.type === 'join') {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            fetch('/api/signal', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId: sessionId, signal: { type: 'offer', data: offer, sender: 'sharer' } }),
                            });
                        } else if (s.type === 'answer') {
                            await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        } else if (s.type === 'candidate') {
                            try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch { }
                        }
                    }
                } catch { }
            }, 400);

            (window as any).__cleanup = () => {
                clearInterval(interval);
                stream.getTracks().forEach(t => t.stop());
                pc.close();
            };

        } catch (e) {
            console.error(e);
            alert('Failed to share screen. Make sure you clicked "Allow".');
        }
    }, [sessionId]);

    const copyLink = () => {
        const link = `${window.location.origin}/view?session=${sessionId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-10 font-sans selection:bg-cyan-500/30">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800 pb-8">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter">SCREEN <span className="text-cyan-500">LIVE</span></h1>
                        <p className="text-zinc-500 text-sm">Your permanent personal broadcasting room</p>
                    </div>
                    {isSharing && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-500 font-bold text-xs uppercase tracking-widest">Live Now</span>
                        </div>
                    )}
                </header>

                {!isSharing ? (
                    <main className="grid md:grid-cols-2 gap-8 items-center pt-10">
                        <div className="space-y-6">
                            <h2 className="text-5xl font-bold leading-tight">Ready to broadcast to your team?</h2>
                            <p className="text-zinc-400">One click to go live. Your personal link stays the same forever. No setup, no waiting.</p>
                            <button
                                onClick={startSharing}
                                className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white px-12 py-5 rounded-2xl font-black text-2xl shadow-2xl shadow-cyan-900/20 transition-all hover:-translate-y-1 active:scale-95"
                            >
                                GO LIVE INSTANTLY
                            </button>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6">
                            <div>
                                <p className="text-zinc-500 text-xs font-bold uppercase mb-2">Your Permanent Address</p>
                                <div className="bg-black p-4 rounded-xl border border-zinc-800 font-mono text-cyan-400 break-all text-sm">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/view?session=${sessionId}` : '...'}
                                </div>
                            </div>
                            <button onClick={copyLink} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors">
                                {copied ? '✅ COPIED' : 'COPY PERMANENT LINK'}
                            </button>
                        </div>
                    </main>
                ) : (
                    <main className="space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-cyan-500 bg-black shadow-2xl group">
                            <video ref={previewRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                            <div className="absolute top-6 left-6 flex gap-2">
                                <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-zinc-300 border border-white/10">HD PREVIEW</div>
                                <div className="bg-cyan-500 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-black">ACTIVE</div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Session Active</p>
                                    <p className="font-mono text-xl">{sessionId}</p>
                                </div>
                                <button onClick={copyLink} className="text-cyan-500 font-bold hover:underline">COPY LINK</button>
                            </div>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 px-10 py-6 rounded-2xl font-bold transition-all"
                            >
                                STOP BROADCAST
                            </button>
                        </div>
                    </main>
                )}
            </div>
        </div>
    );
}
