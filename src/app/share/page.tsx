'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ICE_SERVERS } from '@/lib/constants';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<string>('IDLE');
    const [logs, setLogs] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const previewRef = useRef<HTMLVideoElement>(null);

    const addLog = (msg: string) => {
        console.log(`[SHARER] ${msg}`);
        setLogs(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 5));
    };

    useEffect(() => {
        const savedId = localStorage.getItem('perm_sid') || Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('perm_sid', savedId);
        setSessionId(savedId);
        return () => {
            if (pcRef.current) pcRef.current.close();
        }
    }, []);

    const startBroadcast = useCallback(async () => {
        addLog('Initializing Media Capture...');
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always', frameRate: 30 } as any,
                audio: true
            });
            streamRef.current = stream;
            setIsSharing(true);
            setStatus('READY: BROADCASTING');

            if (previewRef.current) previewRef.current.srcObject = stream;

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.oniceconnectionstatechange = () => {
                addLog(`ICE Connection State: ${pc.iceConnectionState}`);
                if (pc.iceConnectionState === 'connected') setStatus('CONNECTED');
                if (pc.iceConnectionState === 'failed') setStatus('ICE FAILED - Check Network');
            };

            pc.onicegatheringstatechange = () => addLog(`ICE Gathering: ${pc.iceGatheringState}`);
            pc.onsignalingstatechange = () => addLog(`Signaling State: ${pc.signalingState}`);

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    fetch('/api/signal', {
                        method: 'POST',
                        body: JSON.stringify({ sessionId, signal: { type: 'candidate', data: e.candidate, sender: 'sharer' } })
                    });
                }
            };

            const poll = setInterval(async () => {
                try {
                    const res = await fetch(`/api/signal?sessionId=${sessionId}&role=sharer`);
                    const { signals } = await res.json();
                    for (const s of signals) {
                        addLog(`Received signal: ${s.type}`);
                        if (s.type === 'join') {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            await fetch('/api/signal', {
                                method: 'POST',
                                body: JSON.stringify({ sessionId, signal: { type: 'offer', data: offer, sender: 'sharer' } })
                            });
                        } else if (s.type === 'answer') {
                            await pc.setRemoteDescription(new RTCSessionDescription(s.data));
                        } else if (s.type === 'candidate') {
                            try { await pc.addIceCandidate(new RTCIceCandidate(s.data)); } catch (err) { addLog('Candidate Error'); }
                        }
                    }
                } catch { }
            }, 500);

            (window as any).stopSignal = () => clearInterval(poll);

        } catch (err) {
            addLog(`Error: ${err}`);
            setIsSharing(false);
        }
    }, [sessionId]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-4 font-mono">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <h1 className="text-xl font-bold text-cyan-500">WEBRTC PRO / SHARER</h1>
                    <div className="text-xs px-3 py-1 bg-zinc-800 rounded">{status}</div>
                </div>

                {!isSharing ? (
                    <button onClick={startBroadcast} className="w-full bg-cyan-600 py-10 rounded-2xl text-3xl font-black shadow-2xl">GO LIVE</button>
                ) : (
                    <div className="space-y-4">
                        <div className="aspect-video bg-black rounded-3xl border-4 border-cyan-500 overflow-hidden shadow-2xl">
                            <video ref={previewRef} autoPlay playsInline muted className="w-full h-full object-contain" />
                        </div>
                        <div className="bg-zinc-900 p-4 rounded-xl text-center">
                            <p className="text-zinc-500 text-[10px] mb-1">YOUR PERMANENT LINK</p>
                            <input readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/view?session=${sessionId}` : ''} className="w-full bg-black border border-zinc-800 p-2 text-center text-xs" />
                        </div>
                    </div>
                )}

                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-[10px] space-y-1">
                    <p className="text-zinc-500 mb-2 underline tracking-widest">SYSTEM LOGS</p>
                    {logs.map((l, i) => <p key={i} className={l.includes('Error') ? 'text-red-500' : 'text-zinc-400'}>{l}</p>)}
                </div>
            </div>
        </div>
    );
}
