'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const [status, setStatus] = useState<'loading' | 'done'>('loading')

  useEffect(() => {
    const timer = setTimeout(() => setStatus('done'), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {status === 'loading' ? (
          <>
            <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Setting up your account...</h1>
            <p className="text-gray-400">This takes just a moment.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="text-amber-400 font-semibold text-sm mb-3 tracking-wider">PAYMENT CONFIRMED</div>
            <h1 className="text-2xl font-bold text-white mb-3">Welcome to ShepherdSignals</h1>
            <p className="text-gray-400 mb-8">
              Check your inbox &mdash; we just sent you a secure login link.
              Click it to access your procurement portal. No password needed.
            </p>

            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-8 text-left">
              <p className="text-xs text-gray-500 mb-3 font-semibold tracking-wider">WHAT HAPPENS NEXT</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-amber-400 font-bold mt-0.5 shrink-0">1.</span>
                  <span>Check your email for your secure portal link and click it to log in</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-amber-400 font-bold mt-0.5 shrink-0">2.</span>
                  <span>Set up invoice forwarding or connect your accounting software &mdash; takes 15 minutes</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-amber-400 font-bold mt-0.5 shrink-0">3.</span>
                  <span>The moment an invoice lands, it is processed automatically &mdash; no waiting</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-amber-400 font-bold mt-0.5 shrink-0">4.</span>
                  <span>Your first weekly digest lands Monday morning with every price increase flagged</span>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Go to My Portal
            </Link>

            <p className="text-gray-600 text-xs mt-6">
              Questions? <a href="mailto:shepherdsargent@shepherdsignals.com" className="text-gray-500 hover:text-gray-400">shepherdsargent@shepherdsignals.com</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a]" />}>
      <SuccessContent />
    </Suspense>
  )
}