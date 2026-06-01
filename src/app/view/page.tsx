'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PUSHER_KEY, PUSHER_CLUSTER } from '@/lib/constants';
import PusherJS from 'pusher-js';

function ViewerContent() {
    const searchParams = useSearchParams();
    const initialSession = (searchParams.get('session') || '').trim().toUpperCase();
    const [inputValue, setInputValue] = useState(initialSession);
    const [status, setStatus] = useState('Idle');
    const [debug, setDebug] = useState<string[]>([]);
    const [isViewing, setIsViewing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const log = (msg: string) => setDebug(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);

    const handleJoin = useCallback(async (sid?: string) => {
        const targetId = sid || inputValue;
        if (!targetId) return;

        setIsViewing(true);
        setStatus('Joining...');
        log(`Attempting join: ${targetId}`);

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        pc.ontrack = (e) => {
            log('Stream track received');
            if (videoRef.current) {
                videoRef.current.srcObject = e.streams[0];
                videoRef.current.play().catch(() => log('Play blocked'));
            }
            setStatus('Sharing Active');
        };

        const pusher = new PusherJS(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
        const channel = pusher.subscribe(`session-${targetId}`);
        log('Signaling channel ready');

        channel.bind('signal', async (data: any) => {
            if (data.sender === 'sharer') {
                log(`Received ${data.type}`);
                if (data.type === 'offer') {
                    setStatus('Connecting...');
                    await pc.setRemoteDescription(new RTCSessionDescription(data.data));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: targetId, signal: { type: 'answer', data: answer, sender: 'viewer' } }),
                    });
                    log('Answer sent');
                } else if (data.type === 'candidate') {
                    try { await pc.addIceCandidate(new RTCIceCandidate(data.data)); } catch (e) { }
                }
            }
        });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: targetId, signal: { type: 'candidate', data: e.candidate, sender: 'viewer' } }),
                });
            }
        };

        pc.oniceconnectionstatechange = () => log(`ICE: ${pc.iceConnectionState}`);

        // Send Join signal
        setTimeout(() => {
            log('Sending join signal...');
            fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: targetId, signal: { type: 'join', sender: 'viewer' } }),
            });
        }, 1000);

    }, [inputValue]);

    useEffect(() => {
        if (initialSession) handleJoin(initialSession);
    }, [initialSession, handleJoin]);

    return (
        <div className="min-h-screen bg-black text-white p-6 font-sans">
            <div className="max-w-xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-center">Viewer</h1>
                <div className="bg-zinc-900 p-4 rounded-lg flex items-center justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <span className="font-bold text-blue-400">{status}</span>
                </div>

                {!isViewing ? (
                    <div className="space-y-4">
                        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value.toUpperCase())} className="w-full bg-zinc-900 border border-zinc-800 p-3 text-center text-xl font-mono" placeholder="CODE" />
                        <button onClick={() => handleJoin()} className="w-full bg-blue-600 py-3 rounded-xl font-bold">JOIN SESSION</button>
                    </div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline className="w-full bg-black rounded-lg border border-zinc-800 aspect-video" />
                )}

                <div className="bg-zinc-900/50 p-3 rounded text-xs font-mono space-y-1 border border-zinc-800">
                    <p className="text-zinc-500 uppercase mb-1">Diagnostics:</p>
                    {debug.map((d, i) => <p key={i}>{d}</p>)}
                </div>
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
