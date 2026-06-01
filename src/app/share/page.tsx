'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionStatus } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);

    const handleStartSharing = useCallback(async () => {
        // 1. MUST trigger getDisplayMedia IMMEDIATELY in the click handler for Safari/Chrome compatibility
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30, max: 60 },
                },
                audio: true,
            });
        } catch (err) {
            console.error('Permission error:', err);
            if (err instanceof Error && err.name === 'NotAllowedError') {
                setError('Permission denied. Please allow screen sharing.');
            } else {
                setError('Could not start screen capture.');
            }
            return;
        }

        // 2. Now that we have the stream, we can do the async session setup
        const newSessionId = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(newSessionId);
        setIsSharing(true);
        setStatus('creating');

        try {
            if (previewRef.current) {
                previewRef.current.srcObject = stream;
            }

            // Create session on server
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: newSessionId }),
            });

            if (!res.ok && res.status !== 409) {
                throw new Error('Signaling server unavailable');
            }

            setStatus('waiting');

            // Set up WebRTC
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            });

            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
                track.onended = () => {
                    pc.close();
                    setStatus('closed');
                    setIsSharing(false);
                };
            });

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: newSessionId,
                            signal: {
                                type: 'candidate',
                                data: event.candidate.toJSON(),
                                sender: 'sharer',
                                timestamp: Date.now(),
                            },
                        }),
                    });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    setStatus('connected');
                } else if (pc.iceConnectionState === 'disconnected') {
                    setStatus('disconnected');
                } else if (pc.iceConnectionState === 'failed') {
                    setStatus('failed');
                    setError('Connection failed. Retrying...');
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: newSessionId,
                    signal: {
                        type: 'offer',
                        data: offer,
                        sender: 'sharer',
                        timestamp: Date.now(),
                    },
                }),
            });

            setStatus('connecting');

            // Signaling Polling
            const pollInterval = setInterval(async () => {
                try {
                    const pollRes = await fetch(`/api/signal?sessionId=${newSessionId}&since=0&role=sharer`);
                    if (!pollRes.ok) return;
                    const data = await pollRes.json();
                    if (data.signals) {
                        for (const signal of data.signals) {
                            if (signal.type === 'answer') {
                                await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                            } else if (signal.type === 'candidate') {
                                await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                            }
                        }
                    }
                } catch { }
            }, 1500);

            (window as any).__shareCleanup = () => {
                clearInterval(pollInterval);
                stream.getTracks().forEach((t) => t.stop());
                pc.close();
            };

        } catch (err) {
            console.error('Setup error:', err);
            setError('Connection setup failed.');
            setStatus('failed');
            stream.getTracks().forEach(t => t.stop());
            setIsSharing(false);
        }
    }, []);

    const handleStopSharing = useCallback(() => {
        if ((window as any).__shareCleanup) (window as any).__shareCleanup();
        setIsSharing(false);
        setStatus('closed');
        if (previewRef.current) previewRef.current.srcObject = null;
    }, []);

    const handleCopyId = useCallback(() => {
        navigator.clipboard.writeText(sessionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [sessionId]);

    const handleCopyLink = useCallback(() => {
        const link = `${window.location.origin}/view?session=${sessionId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [sessionId]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
                <div className="text-center mb-12">
                    <a href="/" className="inline-block"><h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">Share Screen</h1></a>
                </div>

                <div className="flex justify-center mb-8">
                    <div className="bg-zinc-800/60 backdrop-blur-xl border border-zinc-700/50 rounded-full px-5 py-2.5">
                        <StatusBadge status={status} />
                    </div>
                </div>

                <div className="bg-zinc-800/40 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    {!isSharing ? (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-zinc-700/50 flex items-center justify-center">
                                <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <button onClick={handleStartSharing} className="bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3.5 rounded-xl font-bold hover:scale-[1.02] transition-transform">Start Sharing</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex-1 font-mono text-2xl tracking-widest text-violet-400">{sessionId}</div>
                                <div className="flex gap-2">
                                    <button onClick={handleCopyId} className="bg-zinc-700/50 px-4 py-2 rounded-lg text-sm">{copied ? 'Copied!' : 'Copy Code'}</button>
                                    <button onClick={handleCopyLink} className="bg-violet-600/20 px-4 py-2 rounded-lg text-sm text-violet-300">Copy Link</button>
                                </div>
                            </div>
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-zinc-700/50">
                                <video ref={previewRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <button onClick={handleStopSharing} className="text-red-400 bg-red-600/10 px-6 py-2.5 rounded-xl border border-red-500/20">Stop Sharing</button>
                            </div>
                        </div>
                    )}
                    {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">{error}</div>}
                </div>
            </div>
        </div>
    );
}
