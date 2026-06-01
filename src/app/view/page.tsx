'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectionStatus } from '@/lib/constants';
import { StatusBadge } from '@/components/StatusBadge';

function ViewerContent() {
    const searchParams = useSearchParams();
    const rawSession = searchParams.get('session') || '';
    // Sanitize: remove whitespace and trailing backslashes
    const initialSession = rawSession.trim().replace(/\\+$/, '').toUpperCase();

    const [sessionId, setSessionId] = useState<string>(initialSession);
    const [inputValue, setInputValue] = useState<string>(initialSession);
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isViewing, setIsViewing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-join if session param provided
    useEffect(() => {
        if (initialSession && !isViewing) {
            handleJoinSession(initialSession);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSession]);

    const handleJoinSession = useCallback(async (sid?: string) => {
        const targetSessionId = sid || inputValue.trim().toUpperCase();
        if (!targetSessionId) {
            setError('Please enter a session code');
            return;
        }

        setSessionId(targetSessionId);
        setError(null);
        setStatus('connecting');
        setIsViewing(true);

        try {
            // Check if session exists
            const sessionRes = await fetch(`/api/session?sessionId=${targetSessionId}`);
            if (!sessionRes.ok) {
                throw new Error('Session not found. Please check the code and try again.');
            }

            // Create peer connection
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ],
            });

            pc.ontrack = (event) => {
                console.log('Track received:', event.track.kind);
                if (videoRef.current && event.streams[0]) {
                    videoRef.current.srcObject = event.streams[0];
                }
            };

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    await fetch('/api/signal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: targetSessionId,
                            signal: {
                                type: 'candidate',
                                data: event.candidate.toJSON(),
                                sender: 'viewer',
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
                        setError('Connection lost. The sharer may have stopped sharing.');
                        break;
                    case 'failed':
                        setStatus('failed');
                        setError('Connection failed. Please try again.');
                        break;
                }
            };

            // Poll for offer from sharer
            let offerProcessed = false;
            const pollInterval = setInterval(async () => {
                try {
                    const pollRes = await fetch(
                        `/api/signal?sessionId=${targetSessionId}&since=0&role=viewer`
                    );
                    if (!pollRes.ok) return;

                    const pollData = await pollRes.json();
                    if (pollData.signals) {
                        for (const signal of pollData.signals) {
                            if (signal.type === 'offer' && !offerProcessed) {
                                offerProcessed = true;
                                await pc.setRemoteDescription(
                                    new RTCSessionDescription(signal.data)
                                );
                                const answer = await pc.createAnswer();
                                await pc.setLocalDescription(answer);

                                await fetch('/api/signal', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        sessionId: targetSessionId,
                                        signal: {
                                            type: 'answer',
                                            data: answer,
                                            sender: 'viewer',
                                            timestamp: Date.now(),
                                        },
                                    }),
                                });
                            } else if (signal.type === 'candidate') {
                                try {
                                    await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                                } catch {
                                    // May fail if remote description not set yet
                                }
                            }
                        }
                    }
                } catch {
                    // Polling error, continue
                }
            }, 1500);

            // Store cleanup
            (window as { __viewCleanup?: () => void }).__viewCleanup = () => {
                clearInterval(pollInterval);
                pc.close();
            };
        } catch (err) {
            console.error('Join error:', err);
            setError(
                err instanceof Error ? err.message : 'Failed to join session'
            );
            setStatus('failed');
            setIsViewing(false);
        }
    }, [inputValue]);

    const handleDisconnect = useCallback(() => {
        const cleanup = (window as { __viewCleanup?: () => void }).__viewCleanup;
        if (cleanup) cleanup();
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsViewing(false);
        setStatus('closed');
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () =>
            document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
            {/* Decorative background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-12">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <a href="/" className="inline-block group">
                        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                            View Screen
                        </h1>
                    </a>
                    <p className="mt-3 text-zinc-400 text-sm sm:text-base">
                        Enter a session code to view a shared screen
                    </p>
                </div>

                {/* Status */}
                <div className="flex justify-center mb-8">
                    <div className="bg-zinc-800/60 backdrop-blur-xl border border-zinc-700/50 rounded-full px-5 py-2.5">
                        <StatusBadge status={status} />
                    </div>
                </div>

                {!isViewing ? (
                    /* Join Form */
                    <div className="max-w-md mx-auto">
                        <div className="bg-zinc-800/40 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-zinc-700/50 flex items-center justify-center mb-4">
                                    <svg
                                        className="w-8 h-8 text-cyan-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-zinc-100 mb-2">
                                    Join a Session
                                </h2>
                                <p className="text-zinc-400 text-sm">
                                    Enter the session code shared with you
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="session-code"
                                        className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2"
                                    >
                                        Session Code
                                    </label>
                                    <input
                                        id="session-code"
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) =>
                                            setInputValue(e.target.value.toUpperCase())
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleJoinSession();
                                        }}
                                        placeholder="Enter code (e.g. A1B2C3D4)"
                                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.2em] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                                        maxLength={8}
                                        autoComplete="off"
                                    />
                                </div>

                                <button
                                    onClick={() => handleJoinSession()}
                                    disabled={!inputValue.trim()}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    Join Session
                                </button>
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5">
                                    <svg
                                        className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"
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
                    </div>
                ) : (
                    /* Viewing */
                    <div className="space-y-4">
                        {/* Video Container */}
                        <div
                            ref={containerRef}
                            className="relative bg-black rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl"
                        >
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full aspect-video object-contain"
                            />

                            {/* Overlay Controls */}
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                                <div className="bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1">
                                    <StatusBadge status={status} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-zinc-400 font-mono">
                                        {sessionId}
                                    </span>
                                    <button
                                        onClick={toggleFullscreen}
                                        className="bg-zinc-900/80 backdrop-blur-sm hover:bg-zinc-800/80 rounded-full p-2 transition-colors"
                                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                                    >
                                        {isFullscreen ? (
                                            <svg
                                                className="w-4 h-4 text-zinc-300"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-4 h-4 text-zinc-300"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Connecting overlay */}
                            {status !== 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
                                    <div className="text-center">
                                        {status === 'connecting' ? (
                                            <>
                                                <div className="w-12 h-12 mx-auto mb-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                                                <p className="text-zinc-400 text-sm">
                                                    Connecting to shared screen...
                                                </p>
                                            </>
                                        ) : status === 'failed' ? (
                                            <>
                                                <svg
                                                    className="w-12 h-12 mx-auto mb-4 text-red-500"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={1.5}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                                                    />
                                                </svg>
                                                <p className="text-red-400 text-sm">
                                                    Connection failed
                                                </p>
                                            </>
                                        ) : status === 'disconnected' ? (
                                            <>
                                                <svg
                                                    className="w-12 h-12 mx-auto mb-4 text-orange-500"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={1.5}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
                                                    />
                                                </svg>
                                                <p className="text-orange-400 text-sm">
                                                    Disconnected
                                                </p>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={handleDisconnect}
                                className="inline-flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 font-medium px-6 py-2.5 rounded-xl transition-all duration-200"
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
                                        d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
                                    />
                                </svg>
                                Disconnect
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
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
                )}
            </div>
        </div>
    );
}

export default function ViewPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                </div>
            }
        >
            <ViewerContent />
        </Suspense>
    );
}
