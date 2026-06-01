'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from '@/hooks/useWebRTC';
import { ConnectionStatus } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';

export default function SharePage() {
    const [sessionId, setSessionId] = useState<string>('');
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const previewRef = useRef<HTMLVideoElement>(null);

    const actualSessionId = sessionId || 'pending';

    const { startSharing, stop: stopSharing } = useWebRTC({
        sessionId: actualSessionId,
        role: 'sharer',
        onStatusChange: setStatus,
        onError: setError,
        onStream: (stream) => {
            if (previewRef.current) {
                previewRef.current.srcObject = stream;
            }
        },
    });

    const handleStartSharing = useCallback(async () => {
        const newSessionId = uuidv4().slice(0, 8).toUpperCase();
        setSessionId(newSessionId);
        setIsSharing(true);
        setError(null);

        // Small delay to ensure sessionId state is set before starting
        setTimeout(async () => {
            // We need to create the hook fresh with the proper sessionId
            // For now, we directly create session and start
            try {
                // Create session first
                const res = await fetch('/api/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: newSessionId }),
                });

                if (!res.ok && res.status !== 409) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to create session');
                }

                // Request screen capture
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30, max: 60 },
                    },
                    audio: true,
                });

                if (previewRef.current) {
                    previewRef.current.srcObject = stream;
                }

                setStatus('waiting');

                // Set up WebRTC peer connection
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

                // Handle ICE candidates
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
                    switch (pc.iceConnectionState) {
                        case 'connected':
                        case 'completed':
                            setStatus('connected');
                            break;
                        case 'disconnected':
                            setStatus('disconnected');
                            break;
                        case 'failed':
                            setStatus('failed');
                            setError('Connection failed');
                            break;
                    }
                };

                // Create and send offer
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

                // Poll for answer and ICE candidates from viewer
                const pollInterval = setInterval(async () => {
                    try {
                        const pollRes = await fetch(
                            `/api/signal?sessionId=${newSessionId}&since=0&role=sharer`
                        );
                        if (!pollRes.ok) return;

                        const pollData = await pollRes.json();
                        if (pollData.signals) {
                            for (const signal of pollData.signals) {
                                if (signal.type === 'answer') {
                                    await pc.setRemoteDescription(
                                        new RTCSessionDescription(signal.data)
                                    );
                                } else if (signal.type === 'candidate') {
                                    await pc.addIceCandidate(
                                        new RTCIceCandidate(signal.data)
                                    );
                                }
                            }
                        }
                    } catch {
                        // Polling error, continue
                    }
                }, 1500);

                // Store cleanup for later
                (window as { __shareCleanup?: () => void }).__shareCleanup = () => {
                    clearInterval(pollInterval);
                    stream.getTracks().forEach((t) => t.stop());
                    pc.close();
                };
            } catch (err) {
                console.error('Start sharing error:', err);
                if (err instanceof DOMException) {
                    if (err.name === 'NotAllowedError') {
                        setError(
                            'Screen sharing permission was denied. Please allow screen sharing.'
                        );
                    } else {
                        setError(`Error: ${err.message}`);
                    }
                } else {
                    setError('Failed to start screen sharing');
                }
                setStatus('failed');
                setIsSharing(false);
            }
        }, 100);
    }, []);

    const handleStopSharing = useCallback(() => {
        const cleanup = (window as { __shareCleanup?: () => void }).__shareCleanup;
        if (cleanup) cleanup();
        stopSharing();
        setIsSharing(false);
        setStatus('closed');
        if (previewRef.current) {
            previewRef.current.srcObject = null;
        }
    }, [stopSharing]);

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
            {/* Decorative background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <a href="/" className="inline-block group">
                        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                            Share Your Screen
                        </h1>
                    </a>
                    <p className="mt-3 text-zinc-400 text-sm sm:text-base">
                        Share your screen with anyone using a simple session code
                    </p>
                </div>

                {/* Status */}
                <div className="flex justify-center mb-8">
                    <div className="bg-zinc-800/60 backdrop-blur-xl border border-zinc-700/50 rounded-full px-5 py-2.5">
                        <StatusBadge status={status} />
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-zinc-800/40 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                    {!isSharing ? (
                        /* Start Sharing */
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-zinc-700/50 flex items-center justify-center">
                                <svg
                                    className="w-10 h-10 text-violet-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25"
                                    />
                                </svg>
                            </div>

                            <div>
                                <h2 className="text-xl font-semibold text-zinc-100 mb-2">
                                    Ready to Share
                                </h2>
                                <p className="text-zinc-400 text-sm max-w-md mx-auto">
                                    Click the button below to start sharing your screen. You&apos;ll
                                    receive a session code to share with your viewer.
                                </p>
                            </div>

                            <button
                                onClick={handleStartSharing}
                                className="group relative inline-flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                                    />
                                </svg>
                                Start Sharing
                                <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </button>
                        </div>
                    ) : (
                        /* Sharing Active */
                        <div className="space-y-6">
                            {/* Session Info */}
                            <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-5">
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="flex-1 text-center sm:text-left">
                                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">
                                            Session Code
                                        </p>
                                        <p className="text-3xl font-mono font-bold tracking-[0.3em] bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                                            {sessionId}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyId}
                                            className="flex items-center gap-2 bg-zinc-700/50 hover:bg-zinc-700 border border-zinc-600/50 text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-all duration-200"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                                                />
                                            </svg>
                                            {copied ? 'Copied!' : 'Copy Code'}
                                        </button>
                                        <button
                                            onClick={handleCopyLink}
                                            className="flex items-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:text-violet-200 px-4 py-2 rounded-lg text-sm transition-all duration-200"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                                                />
                                            </svg>
                                            Copy Link
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="relative bg-black rounded-xl overflow-hidden border border-zinc-700/50 aspect-video">
                                <video
                                    ref={previewRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                                {status !== 'connected' && status !== 'connecting' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                                        <p className="text-zinc-500 text-sm">Screen preview</p>
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1">
                                        <StatusBadge status={status} />
                                    </div>
                                </div>
                            </div>

                            {/* Stop Button */}
                            <div className="text-center">
                                <button
                                    onClick={handleStopSharing}
                                    className="inline-flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 font-medium px-6 py-2.5 rounded-xl transition-all duration-200"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <rect x="6" y="6" width="12" height="12" rx="1" />
                                    </svg>
                                    Stop Sharing
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                                />
                            </svg>
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 text-center">
                    <p className="text-zinc-600 text-xs">
                        Share the session code with your viewer. They can join at{' '}
                        <a href="/view" className="text-violet-500 hover:text-violet-400 transition-colors">
                            /view
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
