'use client';

import { ConnectionStatus } from '../lib/constants';

const STATUS_CONFIG: Record<
    ConnectionStatus,
    { label: string; color: string; pulse: boolean; icon: string }
> = {
    idle: {
        label: 'Ready',
        color: 'bg-zinc-500',
        pulse: false,
        icon: '○',
    },
    creating: {
        label: 'Creating Session...',
        color: 'bg-amber-500',
        pulse: true,
        icon: '◎',
    },
    waiting: {
        label: 'Waiting for Viewer',
        color: 'bg-blue-500',
        pulse: true,
        icon: '◉',
    },
    connecting: {
        label: 'Connecting...',
        color: 'bg-amber-500',
        pulse: true,
        icon: '◎',
    },
    connected: {
        label: 'Connected',
        color: 'bg-emerald-500',
        pulse: false,
        icon: '●',
    },
    disconnected: {
        label: 'Disconnected',
        color: 'bg-orange-500',
        pulse: true,
        icon: '◌',
    },
    failed: {
        label: 'Failed',
        color: 'bg-red-500',
        pulse: false,
        icon: '✕',
    },
    closed: {
        label: 'Session Ended',
        color: 'bg-zinc-600',
        pulse: false,
        icon: '■',
    },
};

export function StatusBadge({ status }: { status: ConnectionStatus }) {
    const config = STATUS_CONFIG[status];

    return (
        <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
                {config.pulse && (
                    <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.color}`}
                    />
                )}
                <span
                    className={`relative inline-flex h-3 w-3 rounded-full ${config.color}`}
                />
            </span>
            <span className="text-sm font-medium text-zinc-300">
                {config.icon} {config.label}
            </span>
        </div>
    );
}
