'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';
import PusherJS from 'pusher-js';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<string>('Ready');
    const [debug, setDebug] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);

    const log = (msg: string) => setDebug(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);

    const handleStartSharing = useCallback(async () => {
        log('Requesting screen capture...');
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (err) {
            log('Capture denied');
            return;
        }

        const newSessionId = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(newSessionId);
        setIsSharing(true);
        setStatus('Waiting for Viewer...');
        log(`Session created: ${newSessionId}`);

        if (previewRef.current) previewRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        log('Connecting to signaling network...');
        const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
        const channel = pusher.subscribe(`session-${newSessionId}`);

        channel.bind('signal', async (data: any) => {
            if (data.sender === 'viewer') {
                log(`Received ${data.type} from viewer`);
                if (data.type === 'join') {
                    setStatus('Handshaking...');
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: newSessionId, signal: { type: 'offer', data: offer, sender: 'sharer' } }),
                    });
                    log('Offer sent to viewer');
                } else if (data.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                    setStatus('Streaming!');
                    log('Connection established');
                } else if (data.type === 'candidate') {
                    try { await pc.addIceCandidate(new RTCIceCandidate(data.data)); } catch (e) { log('ICE error'); }
                }
            }
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: newSessionId, signal: { type: 'candidate', data: event.candidate, sender: 'sharer' } }),
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            log(`ICE: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'connected') setStatus('Connected');
        };

    }, []);

    return (
        <div className="min-h-screen bg-black text-white p-6 font-sans">
            <div className="max-w-xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-center">ScreenShare Pro</h1>
                <div className="bg-zinc-900 p-4 rounded-lg flex items-center justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <span className="font-bold text-cyan-400">{status}</span>
                </div>

                {!isSharing ? (
                    <button onClick={handleStartSharing} className="w-full bg-blue-600 py-4 rounded-xl font-bold text-lg hover:bg-blue-500">START SHARING</button>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-zinc-800 p-3 rounded text-center font-mono text-xl tracking-widest">{sessionId}</div>
                        <video ref={previewRef} autoPlay playsInline muted className="w-full rounded-lg border border-zinc-700 aspect-video bg-zinc-950" />
                    </div>
                )}

                <div className="bg-zinc-900/50 p-3 rounded text-xs font-mono space-y-1 border border-zinc-800">
                    <p className="text-zinc-500 uppercase mb-1">Diagnostics:</p>
                    {debug.map((d, i) => <p key={i}>{d}</p>)}
                </div>
            </div>
        </div>
    );
}
