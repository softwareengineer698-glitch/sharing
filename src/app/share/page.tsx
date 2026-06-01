'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionStatus, PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';
import PusherJS from 'pusher-js';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);

    const handleStartSharing = useCallback(async () => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } },
                audio: true,
            });
        } catch (err) {
            if (err instanceof Error && err.name === 'NotAllowedError') setError('Permission denied.');
            else setError('Could not start capture.');
            return;
        }

        const newSessionId = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(newSessionId);
        setIsSharing(true);
        setStatus('creating');

        try {
            if (previewRef.current) previewRef.current.srcObject = stream;

            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: newSessionId }),
            });

            if (!res.ok && res.status !== 409) throw new Error('Signaling server unavailable');
            setStatus('waiting');

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
            });

            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
                track.onended = () => { pc.close(); setStatus('closed'); setIsSharing(false); };
            });

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: newSessionId,
                            signal: { type: 'candidate', data: event.candidate.toJSON(), sender: 'sharer' },
                        }),
                    });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setStatus('connected');
                else if (pc.iceConnectionState === 'failed') { setStatus('failed'); setError('Connection failed.'); }
            };

            // Real-time Push Signaling (INSTANT)
            const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
            const channel = pusher.subscribe(`session-${newSessionId}`);

            channel.bind('signal', async (data: any) => {
                if (data.sender === 'viewer') {
                    if (data.type === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                    else if (data.type === 'candidate') await pc.addIceCandidate(new RTCIceCandidate(data.data));
                }
            });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: newSessionId,
                    signal: { type: 'offer', data: offer, sender: 'sharer' },
                }),
            });

            setStatus('connecting');

            (window as any).__shareCleanup = () => {
                pusher.unsubscribe(`session-${newSessionId}`);
                pusher.disconnect();
                stream.getTracks().forEach((t) => t.stop());
                pc.close();
            };
        } catch (err) {
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
            <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <a href="/"><h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">Share Screen</h1></a>
                </div>
                <div className="flex justify-center mb-8"><StatusBadge status={status} /></div>
                <div className="bg-zinc-800/40 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-8 shadow-2xl">
                    {!isSharing ? (
                        <div className="text-center space-y-6">
                            <button onClick={handleStartSharing} className="bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3.5 rounded-xl font-bold text-lg">Start Sharing</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-zinc-900/50 p-5 rounded-xl flex items-center gap-4">
                                <div className="flex-1 font-mono text-2xl text-violet-400">{sessionId}</div>
                                <button onClick={handleCopyId} className="bg-zinc-700/50 px-4 py-2 rounded-lg text-sm">{copied ? 'Copied!' : 'Copy Code'}</button>
                                <button onClick={handleCopyLink} className="bg-violet-600/20 px-4 py-2 rounded-lg text-sm text-violet-300">Copy Link</button>
                            </div>
                            <video ref={previewRef} autoPlay playsInline muted className="w-full rounded-xl border border-zinc-700/50 aspect-video bg-black" />
                            <div className="text-center"><button onClick={handleStopSharing} className="text-red-400 px-6 py-2.5 bg-red-600/10 rounded-xl border border-red-500/20">Stop Sharing</button></div>
                        </div>
                    )}
                    {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">{error}</div>}
                </div>
            </div>
        </div>
    );
}
