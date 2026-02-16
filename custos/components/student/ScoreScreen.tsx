'use client'

import { useEffect, useState, useRef } from 'react'
import { Trophy, CheckCircle, XCircle, Flame, Zap, ArrowLeft, Share2 } from 'lucide-react'

interface ScoreScreenProps {
    totalCorrect: number
    totalQuestions: number
    streak: number
    pointsEarned: number
    message?: string
    onBack: () => void
}

// Simple confetti particle
function ConfettiCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const colors = ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

        interface Particle {
            x: number; y: number; vx: number; vy: number
            color: string; size: number; rotation: number; spin: number
            shape: 'rect' | 'circle'
        }

        const particles: Particle[] = []
        for (let i = 0; i < 120; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 3 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                spin: (Math.random() - 0.5) * 8,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
            })
        }

        let animFrame: number
        function animate() {
            if (!ctx || !canvas) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            let active = false
            for (const p of particles) {
                p.x += p.vx
                p.y += p.vy
                p.vy += 0.05
                p.rotation += p.spin

                if (p.y < canvas.height + 20) active = true

                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate((p.rotation * Math.PI) / 180)
                ctx.fillStyle = p.color
                ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height)

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
                } else {
                    ctx.beginPath()
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.restore()
            }

            if (active) {
                animFrame = requestAnimationFrame(animate)
            }
        }

        animate()
        return () => cancelAnimationFrame(animFrame)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50"
        />
    )
}

export default function ScoreScreen({
    totalCorrect,
    totalQuestions,
    streak,
    pointsEarned,
    message,
    onBack,
}: ScoreScreenProps) {
    const [showConfetti, setShowConfetti] = useState(false)
    const scorePercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    const isPerfect = totalCorrect === totalQuestions && totalQuestions > 0

    useEffect(() => {
        if (isPerfect || scorePercent >= 80) {
            setShowConfetti(true)
            // Haptic for celebration
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([100, 50, 100, 50, 200])
            }
            // Stop confetti after 4s
            const timer = setTimeout(() => setShowConfetti(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [isPerfect, scorePercent])

    const scoreColor = scorePercent >= 80 ? '#22c55e' : scorePercent >= 50 ? '#eab308' : '#ef4444'

    const autoMessage =
        scorePercent >= 90
            ? "🌟 Outstanding! You're mastering these topics!"
            : scorePercent >= 70
                ? '💪 Great work! Keep practising to get even better!'
                : scorePercent >= 50
                    ? '📈 Good progress! Focus on weak topics tomorrow.'
                    : '🧠 Every attempt makes you stronger. Try again tomorrow!'

    return (
        <>
            {showConfetti && <ConfettiCanvas />}

            <div className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Trophy */}
                <div className="relative mb-6">
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl ${isPerfect
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-yellow-500/30'
                            : scorePercent >= 50
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
                                : 'bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/30'
                        }`}>
                        <Trophy className="w-12 h-12 text-white" />
                    </div>
                    {isPerfect && <span className="absolute -top-2 -right-2 text-2xl">⭐</span>}
                </div>

                <h1 className="text-3xl font-bold text-white mb-1">
                    {isPerfect ? 'Perfect Score! 🎉' : 'Practice Complete!'}
                </h1>
                <p className="text-purple-300/70 mb-8">
                    {isPerfect ? "You nailed every single question!" : "Great effort! Keep it going 🔥"}
                </p>

                {/* Score Circle */}
                <div className="relative w-32 h-32 mb-8">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                        <circle
                            cx="60" cy="60" r="52" fill="none"
                            stroke={scoreColor}
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${scorePercent * 3.267} 326.7`}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-white">{scorePercent}%</span>
                        <span className="text-xs text-purple-300/60">Score</span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-white">{totalCorrect}/{totalQuestions}</p>
                        <p className="text-xs text-purple-300/60">Correct</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <Flame className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-white">{streak}</p>
                        <p className="text-xs text-purple-300/60">Day Streak</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-white">+{pointsEarned}</p>
                        <p className="text-xs text-purple-300/60">Points</p>
                    </div>
                </div>

                {/* Message */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-sm w-full mb-8 text-center">
                    <p className="text-purple-200 text-sm">{message || autoMessage}</p>
                </div>

                {/* Actions */}
                <div className="w-full max-w-sm space-y-3">
                    <button
                        onClick={onBack}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </>
    )
}
