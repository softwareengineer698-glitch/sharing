'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ConnectionStatus,
    ICE_SERVERS,
    SignalMessage,
    SIGNALING_POLL_INTERVAL,
    MAX_RECONNECT_ATTEMPTS,
    RECONNECT_DELAY,
} from '@/lib/constants';

type UseWebRTCOptions = {
    sessionId: string;
    role: 'sharer' | 'viewer';
    onStream?: (stream: MediaStream) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
    onError?: (error: string) => void;
};

export function useWebRTC({
    sessionId,
    role,
    onStream,
    onStatusChange,
    onError,
}: UseWebRTCOptions) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const lastPollTimeRef = useRef<number>(0);
    const reconnectAttemptsRef = useRef<number>(0);
    const isCleanedUpRef = useRef(false);

    const updateStatus = useCallback(
        (newStatus: ConnectionStatus) => {
            setStatus(newStatus);
            onStatusChange?.(newStatus);
        },
        [onStatusChange]
    );

    const handleError = useCallback(
        (message: string) => {
            setError(message);
            onError?.(message);
        },
        [onError]
    );

    // Send signal to the server
    const sendSignal = useCallback(
        async (signal: Omit<SignalMessage, 'timestamp'>) => {
            try {
                const response = await fetch('/api/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        signal: { ...signal, timestamp: Date.now() },
                    }),
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to send signal');
                }
            } catch (err) {
                console.error('Signal send error:', err);
                handleError('Failed to send signaling message');
            }
        },
        [sessionId, handleError]
    );

    // Process incoming signals
    const processSignal = useCallback(
        async (signal: SignalMessage) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;

            try {
                if (signal.type === 'offer' && role === 'viewer') {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
                    );
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await sendSignal({
                        type: 'answer',
                        data: answer,
                        sender: 'viewer',
                    });
                } else if (signal.type === 'answer' && role === 'sharer') {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
                    );
                } else if (signal.type === 'candidate') {
                    await pc.addIceCandidate(
                        new RTCIceCandidate(signal.data as RTCIceCandidateInit)
                    );
                }
            } catch (err) {
                console.error('Signal processing error:', err);
                handleError('Failed to process signaling message');
            }
        },
        [role, sendSignal, handleError]
    );

    // Poll for signals
    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            if (isCleanedUpRef.current) return;

            try {
                const response = await fetch(
                    `/api/signal?sessionId=${sessionId}&since=${lastPollTimeRef.current}&role=${role}`
                );
                if (!response.ok) return;

                const data = await response.json();
                if (data.signals && data.signals.length > 0) {
                    for (const signal of data.signals) {
                        await processSignal(signal);
                        if (signal.timestamp > lastPollTimeRef.current) {
                            lastPollTimeRef.current = signal.timestamp;
                        }
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, SIGNALING_POLL_INTERVAL);
    }, [sessionId, role, processSignal]);

    // Create peer connection
    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'candidate',
                    data: event.candidate.toJSON(),
                    sender: role,
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState);
            switch (pc.iceConnectionState) {
                case 'connected':
                case 'completed':
                    updateStatus('connected');
                    reconnectAttemptsRef.current = 0;
                    break;
                case 'disconnected':
                    updateStatus('disconnected');
                    // Attempt reconnection
                    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttemptsRef.current++;
                        setTimeout(() => {
                            if (peerConnectionRef.current?.iceConnectionState === 'disconnected') {
                                handleError('Connection lost. Attempting to reconnect...');
                            }
                        }, RECONNECT_DELAY);
                    }
                    break;
                case 'failed':
                    updateStatus('failed');
                    handleError('Connection failed. Please try again.');
                    break;
                case 'closed':
                    updateStatus('closed');
                    break;
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
        };

        if (role === 'viewer') {
            pc.ontrack = (event) => {
                console.log('Track received:', event.track.kind);
                if (event.streams[0]) {
                    onStream?.(event.streams[0]);
                }
            };
        }

        peerConnectionRef.current = pc;
        return pc;
    }, [role, sendSignal, updateStatus, handleError, onStream]);

    // Start sharing screen (sharer role)
    const startSharing = useCallback(async () => {
        try {
            setError(null);
            updateStatus('creating');

            // Create session on server
            const sessionRes = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            if (!sessionRes.ok) {
                const data = await sessionRes.json();
                if (sessionRes.status === 409) {
                    // Session already exists, that's ok for reconnection
                } else {
                    throw new Error(data.error || 'Failed to create session');
                }
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

            localStreamRef.current = stream;

            // Handle stream ending (user stops sharing via browser UI)
            stream.getTracks().forEach((track) => {
                track.onended = () => {
                    cleanup();
                    updateStatus('closed');
                };
            });

            const pc = createPeerConnection();

            // Add tracks to peer connection
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            updateStatus('waiting');

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await sendSignal({
                type: 'offer',
                data: offer,
                sender: 'sharer',
            });

            // Start polling for answer/candidates
            startPolling();
            updateStatus('connecting');
        } catch (err) {
            console.error('Start sharing error:', err);
            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError') {
                    handleError('Screen sharing permission denied. Please allow screen sharing to continue.');
                } else if (err.name === 'NotFoundError') {
                    handleError('No screen sharing source found.');
                } else if (err.name === 'NotReadableError') {
                    handleError('Screen capture is not available on this device.');
                } else {
                    handleError(`Screen sharing error: ${err.message}`);
                }
            } else {
                handleError('Failed to start screen sharing');
            }
            updateStatus('failed');
        }
    }, [sessionId, createPeerConnection, sendSignal, startPolling, updateStatus, handleError]);

    // Join as viewer
    const joinSession = useCallback(async () => {
        try {
            setError(null);
            updateStatus('connecting');

            // Check if session exists
            const sessionRes = await fetch(`/api/session?sessionId=${sessionId}`);
            if (!sessionRes.ok) {
                throw new Error('Session not found. Please check the ID.');
            }

            createPeerConnection();

            // Start polling for offer/candidates
            startPolling();
        } catch (err) {
            console.error('Join session error:', err);
            handleError(
                err instanceof Error ? err.message : 'Failed to join session'
            );
            updateStatus('failed');
        }
    }, [sessionId, createPeerConnection, startPolling, updateStatus, handleError]);

    // Cleanup function
    const cleanup = useCallback(() => {
        isCleanedUpRef.current = true;

        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
    }, []);

    // Stop sharing / leave session
    const stop = useCallback(() => {
        cleanup();
        updateStatus('closed');
    }, [cleanup, updateStatus]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        status,
        error,
        startSharing,
        joinSession,
        stop,
    };
}
