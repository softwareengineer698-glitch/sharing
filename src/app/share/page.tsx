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
    const previewRef = useRef<HTMLVideoElement>(null);
    const [copied, setCopied] = useState(false);

    const handleStartSharing = useCallback(async () => {
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
                audio: true,
            });
        } catch (err) {
            setError('Permission denied');
            return;
        }

        const newSessionId = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(newSessionId);
        setIsSharing(true);
        setStatus('waiting');

        try {
            if (previewRef.current) previewRef.current.srcObject = stream;

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
            });

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
            const channel = pusher.subscribe(`session-${newSessionId}`);

            // SEND OFFER helper
            const sendOffer = async () => {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: newSessionId, signal: { type: 'offer', data: offer, sender: 'sharer' } }),
                });
                setStatus('connecting');
            };

            channel.bind('signal', async (data: any) => {
                if (data.sender === 'viewer') {
                    if (data.type === 'join') {
                        // Viewer just joined! Now send the offer.
                        await sendOffer();
                    } else if (data.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                        setStatus('connected');
                    } else if (data.type === 'candidate') {
                        try { await pc.addIceCandidate(new RTCIceCandidate(data.data)); } catch { }
                    }
                }
            });

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: newSessionId, signal: { type: 'candidate', data: event.candidate, sender: 'sharer' } }),
                    });
                }
            };

            (window as any).__shareCleanup = () => {
                pusher.unsubscribe(`session-${newSessionId}`);
                pusher.disconnect();
                stream.getTracks().forEach(t => t.stop());
                pc.close();
            };
        } catch (err) {
            setError('Setup failed');
            setStatus('failed');
            setIsSharing(false);
        }
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(sessionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8">
            <div className="max-w-4xl mx-auto text-center">
                <h1 className="text-4xl font-bold mb-8">Share Screen</h1>
                <div className="mb-8"><StatusBadge status={status} /></div>
                {!isSharing ? (
                    <button onClick={handleStartSharing} className="bg-violet-600 px-8 py-3 rounded-xl font-bold">Start Sharing</button>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-zinc-900 p-4 rounded-xl inline-flex items-center gap-4">
                            <span className="font-mono text-xl">{sessionId}</span>
                            <button onClick={handleCopy} className="text-sm bg-zinc-800 px-3 py-1 rounded">{copied ? 'Copied' : 'Copy'}</button>
                        </div>
                        <video ref={previewRef} autoPlay playsInline muted className="w-full aspect-video bg-black rounded-xl border border-zinc-800" />
                        <button onClick={() => window.location.reload()} className="text-red-400">Stop</button>
                    </div>
                )}
            </div>
        </div>
    );
}
