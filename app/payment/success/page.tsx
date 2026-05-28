'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
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
            <div className="text-amber-400 font-semibold text-sm mb-3">PAYMENT CONFIRMED</div>
            <h1 className="text-2xl font-bold text-white mb-3">Welcome to ShepherdSignals</h1>
            <p className="text-gray-400 mb-8">
              Check your inbox â€” we just sent you a secure login link. Click it to access your procurement portal. No password needed.
            </p>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-8 text-left">
              <p className="text-xs text-gray-500 mb-2">WHAT HAPPENS NEXT</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-amber-400">1.</span> Check your email for your portal link
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-amber-400">2.</span> Your first invoice scan begins within 24 hrs
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-amber-400">3.</span> Price alerts go out automatically from there
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Go to My Portal
            </Link>
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