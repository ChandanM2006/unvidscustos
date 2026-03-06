'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, IndianRupee, CheckCircle, AlertCircle,
    Loader2, X, CreditCard, Shield, Clock, Receipt,
    ChevronDown, ChevronRight, Sparkles
} from 'lucide-react'

declare global {
    interface Window {
        Razorpay: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
}

interface FeeSlot {
    fee_slot_id: string
    name: string
    amount: number
    description: string
    is_mandatory: boolean
}

interface FeeStructure {
    fee_structure_id: string
    name: string
    description: string
    academic_year: string
    class_id: string
    is_active: boolean
    fee_slots: FeeSlot[]
    classes: { name: string; grade_level: number }
}

interface Payment {
    payment_id: string
    fee_structure_id: string
    total_amount: number
    status: string
    paid_at: string
    created_at: string
    receipt_number: string
    slots_paid: { name: string; amount: number }[]
    fee_structures: { name: string; academic_year: string }
}

interface Child {
    user_id: string
    full_name: string
    class_id: string
    section_id: string
}

export default function ParentFeesPage() {
    const { goBack } = useSmartBack('/dashboard/parent')

    const [loading, setLoading] = useState(true)
    const [paying, setPaying] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [schoolId, setSchoolId] = useState('')
    const [schoolName, setSchoolName] = useState('')
    const [children, setChildren] = useState<Child[]>([])
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [structures, setStructures] = useState<FeeStructure[]>([])
    const [payments, setPayments] = useState<Payment[]>([])
    const [selectedSlots, setSelectedSlots] = useState<Record<string, boolean>>({})
    const [expandedStructure, setExpandedStructure] = useState<string | null>(null)

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        document.body.appendChild(script)
        return () => { document.body.removeChild(script) }
    }, [])

    // Fetch children linked to parent
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Get parent user
            const { data: parentUser } = await supabase
                .from('users')
                .select('user_id, school_id')
                .eq('email', session.user.email)
                .single()

            if (!parentUser) return
            setSchoolId(parentUser.school_id)

            // Get school name
            const { data: school } = await supabase
                .from('schools')
                .select('name')
                .eq('school_id', parentUser.school_id)
                .single()

            setSchoolName(school?.name || 'School')

            // Get linked children
            const { data: links } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', parentUser.user_id)

            if (links && links.length > 0) {
                const studentIds = links.map(l => l.student_id)
                const { data: students } = await supabase
                    .from('users')
                    .select('user_id, full_name, class_id, section_id')
                    .in('user_id', studentIds)

                setChildren(students || [])
                if (students && students.length > 0) {
                    setSelectedChild(students[0])
                }
            }
        } catch (err) {
            console.error('Error:', err)
            setError('Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Fetch fee structures for selected child's class
    useEffect(() => {
        if (!selectedChild || !schoolId) return

        const fetchFees = async () => {
            try {
                // Get fee structures for the child's class
                const res = await fetch(
                    `/api/fees/structures?school_id=${schoolId}&class_id=${selectedChild.class_id}`
                )
                const json = await res.json()
                const activeStructures = (json.data || []).filter((s: FeeStructure) => s.is_active)
                setStructures(activeStructures)

                // Get payment history for this child
                const payRes = await fetch(`/api/fees/payments?student_id=${selectedChild.user_id}`)
                const payJson = await payRes.json()
                setPayments(payJson.data || [])

                // Pre-select mandatory slots
                const mandatorySlots: Record<string, boolean> = {}
                activeStructures.forEach((s: FeeStructure) => {
                    s.fee_slots.forEach(slot => {
                        if (slot.is_mandatory) {
                            mandatorySlots[slot.fee_slot_id] = true
                        }
                    })
                })
                setSelectedSlots(mandatorySlots)
            } catch (err) {
                console.error('Error fetching fees:', err)
            }
        }

        fetchFees()
    }, [selectedChild, schoolId])

    const toggleSlot = (slotId: string, isMandatory: boolean) => {
        if (isMandatory) return // Can't deselect mandatory
        setSelectedSlots(prev => ({
            ...prev,
            [slotId]: !prev[slotId],
        }))
    }

    const getSelectedTotal = (structure: FeeStructure) => {
        return structure.fee_slots
            .filter(s => selectedSlots[s.fee_slot_id])
            .reduce((sum, s) => sum + Number(s.amount), 0)
    }


    const handlePayNow = async (structure: FeeStructure) => {
        if (!selectedChild || !window.Razorpay) {
            setError('Payment system not ready. Please refresh the page.')
            return
        }

        const slotsToPayFor = structure.fee_slots.filter(s => selectedSlots[s.fee_slot_id])
        if (slotsToPayFor.length === 0) {
            setError('Please select at least one fee category to pay')
            return
        }

        setPaying(true)
        setError('')

        try {
            // Create order
            const orderRes = await fetch('/api/fees/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: selectedChild.user_id,
                    fee_structure_id: structure.fee_structure_id,
                    school_id: schoolId,
                    slots: slotsToPayFor.map(s => ({
                        fee_slot_id: s.fee_slot_id,
                        name: s.name,
                        amount: Number(s.amount),
                    })),
                }),
            })

            const orderData = await orderRes.json()
            if (!orderRes.ok) throw new Error(orderData.error)

            // Open Razorpay checkout
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: schoolName,
                description: `Fee Payment - ${structure.name}`,
                order_id: orderData.order_id,
                handler: async function (response: {
                    razorpay_order_id: string
                    razorpay_payment_id: string
                    razorpay_signature: string
                }) {
                    // Verify payment
                    try {
                        const verifyRes = await fetch('/api/fees/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                payment_id: orderData.payment_id,
                            }),
                        })

                        const verifyData = await verifyRes.json()
                        if (verifyData.success) {
                            setSuccess('🎉 Payment successful! Receipt has been generated.')
                            // Refresh payments
                            const payRes = await fetch(`/api/fees/payments?student_id=${selectedChild!.user_id}`)
                            const payJson = await payRes.json()
                            setPayments(payJson.data || [])
                        } else {
                            setError('Payment verification failed. Please contact school admin.')
                        }
                    } catch {
                        setError('Error verifying payment. Please contact school admin.')
                    }
                    setPaying(false)
                },
                prefill: {
                    name: selectedChild.full_name,
                },
                theme: {
                    color: '#4f46e5',
                },
                modal: {
                    ondismiss: function () {
                        setPaying(false)
                    },
                },
            }

            const razorpay = new window.Razorpay(options)
            razorpay.on('payment.failed', function () {
                setError('Payment failed. Please try again.')
                setPaying(false)
            })
            razorpay.open()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to initiate payment')
            setPaying(false)
        }
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'paid':
                return { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: <CheckCircle className="w-4 h-4" />, label: 'PAID' }
            case 'created':
                return { bg: 'bg-amber-100', text: 'text-amber-800', icon: <Clock className="w-4 h-4" />, label: 'PENDING' }
            case 'failed':
                return { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="w-4 h-4" />, label: 'FAILED' }
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Clock className="w-4 h-4" />, label: status.toUpperCase() }
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <p className="text-indigo-300">Loading fee details...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
            {/* Header */}
            <header className="bg-slate-900/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={goBack}
                            className="flex items-center space-x-2 text-indigo-300 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-400" />
                            Fee Payment
                        </h1>
                        <div className="w-20"></div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Alerts */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300 backdrop-blur-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                    </div>
                )}
                {success && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 backdrop-blur-sm">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <span>{success}</span>
                        <button onClick={() => setSuccess('')} className="ml-auto text-emerald-400 hover:text-emerald-300"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Test Mode Banner */}
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 backdrop-blur-sm">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-300">🧪 Test Mode</p>
                        <p className="text-amber-200/80 text-sm">Use test card <code className="bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">4111 1111 1111 1111</code> • Any future expiry • Any CVV</p>
                    </div>
                </div>

                {/* Child Selector */}
                {children.length > 1 && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-indigo-300 mb-2">Select Child</label>
                        <div className="flex gap-3">
                            {children.map(child => (
                                <button
                                    key={child.user_id}
                                    onClick={() => setSelectedChild(child)}
                                    className={`px-5 py-3 rounded-xl border transition-all font-medium ${selectedChild?.user_id === child.user_id
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {child.full_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {children.length === 0 ? (
                    <div className="text-center py-16">
                        <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">No Children Linked</h3>
                        <p className="text-gray-500">Please contact the school to link your children to your account</p>
                    </div>
                ) : structures.length === 0 ? (
                    <div className="text-center py-16">
                        <Receipt className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">No Fee Structures</h3>
                        <p className="text-gray-500">The school has not set up fees for this class yet</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Fee Structures */}
                        {structures.map(structure => {
                            const total = getSelectedTotal(structure)
                            const isExpanded = expandedStructure === structure.fee_structure_id
                            const alreadyPaid = payments.some(p => p.status === 'paid' && p.fee_structure_id === structure.fee_structure_id)

                            return (
                                <div
                                    key={structure.fee_structure_id}
                                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
                                >
                                    {/* Header */}
                                    <div
                                        className="p-6 cursor-pointer"
                                        onClick={() => setExpandedStructure(isExpanded ? null : structure.fee_structure_id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                                    <IndianRupee className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white text-lg">{structure.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md">
                                                            {structure.classes?.name}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{structure.academic_year}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {alreadyPaid && (
                                                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/30">
                                                        ✅ PAID
                                                    </span>
                                                )}
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">Total</p>
                                                    <p className="text-xl font-bold text-white">
                                                        ₹{structure.fee_slots.reduce((s, slot) => s + Number(slot.amount), 0).toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                {isExpanded
                                                    ? <ChevronDown className="w-5 h-5 text-gray-500" />
                                                    : <ChevronRight className="w-5 h-5 text-gray-500" />
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Slots */}
                                    {isExpanded && (
                                        <div className="border-t border-white/10 px-6 pb-6">
                                            <div className="mt-4 space-y-2">
                                                {structure.fee_slots.map(slot => {
                                                    const isSelected = selectedSlots[slot.fee_slot_id]
                                                    return (
                                                        <div
                                                            key={slot.fee_slot_id}
                                                            onClick={() => toggleSlot(slot.fee_slot_id, slot.is_mandatory)}
                                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                                                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                                                : 'bg-white/5 border-white/5 hover:border-white/20'
                                                                } ${slot.is_mandatory ? 'cursor-default' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                                                                    ? 'bg-indigo-600 border-indigo-600'
                                                                    : 'border-gray-600'
                                                                    }`}>
                                                                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-white">{slot.name}</span>
                                                                    {slot.is_mandatory && (
                                                                        <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                                                                            Mandatory
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="font-semibold text-white">
                                                                ₹{Number(slot.amount).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Selected Total + Pay Button */}
                                            {alreadyPaid ? (
                                                <div className="mt-6 p-5 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl text-center">
                                                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                                                    <p className="text-lg font-bold text-emerald-300">✅ All Fees Paid</p>
                                                    <p className="text-sm text-emerald-200/60 mt-1">This fee has been paid successfully. See payment history below.</p>
                                                </div>
                                            ) : (
                                                <div className="mt-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-indigo-300 font-medium">Amount to Pay</span>
                                                        <span className="text-3xl font-bold text-white">
                                                            ₹{total.toLocaleString('en-IN')}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handlePayNow(structure)}
                                                        disabled={paying || total <= 0}
                                                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 flex items-center justify-center gap-3"
                                                    >
                                                        {paying ? (
                                                            <>
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                                Processing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-5 h-5" />
                                                                Pay ₹{total.toLocaleString('en-IN')} Now
                                                            </>
                                                        )}
                                                    </button>

                                                    <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Shield className="w-3.5 h-3.5" />
                                                            Secured by Razorpay
                                                        </span>
                                                        <span>•</span>
                                                        <span>UPI, Cards, Net Banking</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Payment History */}
                        {payments.length > 0 && (
                            <div className="mt-10">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Receipt className="w-5 h-5 text-indigo-400" />
                                    Payment History
                                </h2>
                                <div className="space-y-3">
                                    {payments.map(payment => {
                                        const status = getStatusConfig(payment.status)
                                        return (
                                            <div
                                                key={payment.payment_id}
                                                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-semibold text-white">
                                                            {payment.fee_structures?.name || 'Fee Payment'}
                                                        </h4>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {payment.paid_at
                                                                ? new Date(payment.paid_at).toLocaleDateString('en-IN', {
                                                                    day: 'numeric', month: 'long', year: 'numeric'
                                                                })
                                                                : new Date(payment.created_at).toLocaleDateString('en-IN', {
                                                                    day: 'numeric', month: 'long', year: 'numeric'
                                                                })
                                                            }
                                                        </p>
                                                        {payment.receipt_number && (
                                                            <p className="text-xs text-gray-600 mt-0.5">
                                                                Receipt: {payment.receipt_number}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-white">
                                                            ₹{Number(payment.total_amount).toLocaleString('en-IN')}
                                                        </p>
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
                                                            {status.icon}
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Paid slots breakdown */}
                                                {payment.slots_paid && Array.isArray(payment.slots_paid) && payment.slots_paid.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-white/5">
                                                        <div className="flex flex-wrap gap-2">
                                                            {payment.slots_paid.map((slot: { name: string; amount: number }, idx: number) => (
                                                                <span key={idx} className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-lg">
                                                                    {slot.name}: ₹{Number(slot.amount).toLocaleString('en-IN')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
