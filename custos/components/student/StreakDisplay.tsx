'use client'

import { Flame } from 'lucide-react'

interface StreakDisplayProps {
    streak: number
    longestStreak?: number
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
    animate?: boolean
}

export default function StreakDisplay({
    streak,
    longestStreak,
    size = 'md',
    showLabel = true,
    animate = true,
}: StreakDisplayProps) {
    const sizeConfig = {
        sm: { icon: 'w-5 h-5', text: 'text-lg', container: 'gap-1', label: 'text-[10px]' },
        md: { icon: 'w-8 h-8', text: 'text-2xl', container: 'gap-2', label: 'text-xs' },
        lg: { icon: 'w-12 h-12', text: 'text-4xl', container: 'gap-3', label: 'text-sm' },
    }

    const cfg = sizeConfig[size]

    // Streak milestone check
    const isMilestone = streak > 0 && (streak % 7 === 0 || streak % 30 === 0)

    return (
        <div className={`flex flex-col items-center ${cfg.container}`}>
            <div className="relative">
                <Flame
                    className={`${cfg.icon} ${streak > 0
                            ? streak >= 14
                                ? 'text-orange-500'
                                : streak >= 7
                                    ? 'text-orange-400'
                                    : 'text-yellow-500'
                            : 'text-gray-300'
                        } ${animate && streak > 0 ? 'animate-pulse' : ''}`}
                />
                {isMilestone && (
                    <span className="absolute -top-1 -right-1 text-xs">✨</span>
                )}
            </div>
            <span className={`${cfg.text} font-bold ${streak > 0 ? 'text-white' : 'text-gray-400'}`}>
                {streak}
            </span>
            {showLabel && (
                <span className={`${cfg.label} ${streak > 0 ? 'text-purple-300/70' : 'text-gray-400'}`}>
                    {streak === 1 ? 'Day Streak' : 'Day Streak'}
                </span>
            )}
            {longestStreak !== undefined && longestStreak > streak && (
                <span className={`${cfg.label} text-purple-400/50 mt-0.5`}>
                    Best: {longestStreak}
                </span>
            )}
        </div>
    )
}
