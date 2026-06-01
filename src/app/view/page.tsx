'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ICE_SERVERS } from '@/lib/constants';

function ViewerContent() {
    const searchParams = useSearchParams();
    const sessionId = (searchParams.get('session') || '').trim().toUpperCase();
    const [status, setStatus] = useState('IDLE');
    const [logs, setLogs] = useState<string[]>([]);
    const [isViewing, setIsViewing] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

    const addLog = (msg: string) => {
        console.log(`[VIEWER] ${msg}`);
        setLogs(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 5));
    };

    const connect = useCallback(async () => {
        if (!sessionId) return;
        addLog(`Joining Session: ${sessionId}`);
        setIsViewing(true);
        setStatus('SIGNALING...');

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        pc.ontrack = (e) => {
            addLog(`Track Received: ${e.track.kind}`);
            if (videoRef.current) {
                videoRef.current.srcObject = e.streams[0];
                videoRef.current.play().catch(err => addLog(`Autoplay Blocked: ${err.message}`));
            }
            setStatus('CONNECTED');
        };

        pc.oniceconnectionstatechange = () => addLog(`ICE State: ${pc.iceConnectionState}`);
        pc.onsignalingstatechange = () => addLog(`Signaling State: ${pc.signalingState}`);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                fetch('/api/signal', {
                    method: 'POST',
                    body: JSON.stringify({ sessionId, signal: { type: 'candidate', data: e.candidate, sender: 'viewer' } })
                });
            }
        };

        // Heartbeat Join
        const joinInterval = setInterval(() => {
            if (pc.signalingState === 'stable') {
                fetch('/api/signal', {
                    method: 'POST',
                    body: JSON.stringify({ sessionId, signal: { type: 'join', sender: 'viewer' } })
                });
            }
        }, 2000);

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?sessionId=${sessionId}&role=viewer`);
                const { signals } = await res.json();
                for (const s of signals) {
                    addLog(`New Signal: ${s.type}`);
                    if (s.type === 'offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        addLog('Remote Description Set');

                        // Process queued candidates
                        while (candidateQueue.current.length > 0) {
                            const cand = candidateQueue.current.shift();
                            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                        }

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        fetch('/api/signal', {
                            method: 'POST',
                            body: JSON.stringify({ sessionId, signal: { type: 'answer', data: answer, sender: 'viewer' } })
                        });
                    } else if (s.type === 'candidate') {
                        if (pc.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(s.data));
                        } else {
                            addLog('Queuing candidate (RemoteDesc not ready)');
                            candidateQueue.current.push(s.data);
                        }
                    }
                }
            } catch (err) { }
        }, 500);

        return () => {
            clearInterval(joinInterval);
            clearInterval(pollInterval);
            pc.close();
        };
    }, [sessionId]);

    useEffect(() => {
        if (sessionId) connect();
    }, [sessionId, connect]);

    return (
        <div className="min-h-screen bg-black text-white p-4 font-mono">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <h1 className="text-xl font-bold text-blue-500 uppercase">WEBRTC PRO / VIEWER</h1>
                    <div className="text-xs px-3 py-1 bg-zinc-800 rounded">{status}</div>
                </div>

                <div className="aspect-video bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex items-center justify-center relative">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
                    {status !== 'CONNECTED' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{status}</p>
                        </div>
                    )}
                </div>

                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-[10px] space-y-1">
                    <p className="text-zinc-500 mb-2 underline tracking-widest uppercase">Debug Stream</p>
                    {logs.map((l, i) => <p key={i} className="text-zinc-400">{l}</p>)}
                </div>
            </div>
        </div>
    );
}

export default function ViewPage() {
    return <Suspense><ViewerContent /></Suspense>;
}
