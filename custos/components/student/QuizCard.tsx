'use client'

import { useState } from 'react'

interface QuizCardProps {
    questionNumber: number
    totalQuestions: number
    questionText: string
    options: string[]
    difficulty: string
    selectedAnswer: string | null
    isAnswered: boolean
    correctAnswer?: string
    onSelectAnswer: (answer: string) => void
    disabled?: boolean
}

export default function QuizCard({
    questionNumber,
    totalQuestions,
    questionText,
    options,
    difficulty,
    selectedAnswer,
    isAnswered,
    correctAnswer,
    onSelectAnswer,
    disabled = false,
}: QuizCardProps) {
    const difficultyColors: Record<string, string> = {
        easy: 'bg-green-500/20 text-green-400',
        medium: 'bg-yellow-500/20 text-yellow-400',
        hard: 'bg-red-500/20 text-red-400',
    }

    const getOptionStyle = (option: string, idx: number) => {
        const letter = String.fromCharCode(65 + idx)
        const optionValue = option.startsWith(`${letter})`) ? letter : option

        if (!isAnswered) {
            if (selectedAnswer === optionValue) {
                return 'bg-indigo-600/40 border-indigo-400 text-white shadow-lg shadow-indigo-500/10'
            }
            return 'bg-white/5 border-transparent hover:border-white/20 text-purple-200 hover:text-white'
        }

        // After answer submitted
        if (optionValue === correctAnswer) {
            return 'bg-green-500/20 border-green-500 text-green-300'
        }
        if (selectedAnswer === optionValue && optionValue !== correctAnswer) {
            return 'bg-red-500/20 border-red-500 text-red-300'
        }
        return 'bg-white/5 border-transparent text-purple-200/40'
    }

    const getLetterStyle = (option: string, idx: number) => {
        const letter = String.fromCharCode(65 + idx)
        const optionValue = option.startsWith(`${letter})`) ? letter : option

        if (!isAnswered) {
            if (selectedAnswer === optionValue) {
                return 'bg-indigo-500 text-white'
            }
            return 'bg-white/10 text-purple-300'
        }

        if (optionValue === correctAnswer) {
            return 'bg-green-500 text-white'
        }
        if (selectedAnswer === optionValue && optionValue !== correctAnswer) {
            return 'bg-red-500 text-white'
        }
        return 'bg-white/5 text-purple-300/40'
    }

    // Haptic feedback
    const vibrate = (pattern: number[]) => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(pattern)
        }
    }

    const handleSelect = (option: string, idx: number) => {
        if (disabled || isAnswered) return
        const letter = String.fromCharCode(65 + idx)
        const optionValue = option.startsWith(`${letter})`) ? letter : option
        vibrate([30])
        onSelectAnswer(optionValue)
    }

    return (
        <div className="flex flex-col">
            {/* Question Card */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6 mb-5">
                <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${difficultyColors[difficulty] || difficultyColors.medium
                        }`}>
                        {difficulty?.toUpperCase() || 'MEDIUM'}
                    </span>
                    <span className="text-xs text-purple-400/50 ml-auto">
                        Q{questionNumber}/{totalQuestions}
                    </span>
                </div>
                <h2 className="text-base md:text-lg font-semibold text-white leading-relaxed">
                    {questionText}
                </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
                {options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx)
                    return (
                        <button
                            key={idx}
                            onClick={() => handleSelect(option, idx)}
                            disabled={disabled || isAnswered}
                            className={`w-full min-h-[56px] md:min-h-[60px] p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4 border-2 ${getOptionStyle(option, idx)
                                } ${disabled || isAnswered ? 'cursor-default' : 'active:scale-[0.98]'}`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${getLetterStyle(option, idx)
                                }`}>
                                {letter}
                            </div>
                            <span className="text-sm md:text-base flex-1">{option.replace(/^[A-D]\)\s*/, '')}</span>
                            {isAnswered && correctAnswer === (option.startsWith(`${letter})`) ? letter : option) && (
                                <span className="text-green-400 text-sm font-semibold shrink-0">✓</span>
                            )}
                            {isAnswered && selectedAnswer === (option.startsWith(`${letter})`) ? letter : option) &&
                                correctAnswer !== (option.startsWith(`${letter})`) ? letter : option) && (
                                    <span className="text-red-400 text-sm font-semibold shrink-0">✗</span>
                                )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
