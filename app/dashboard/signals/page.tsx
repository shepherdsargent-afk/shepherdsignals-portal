import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default async function SignalsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: signals } = await supabase
    .from('market_signals')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(30)

  const impactColor: Record<string, string> = {
    high:   'text-red-400 bg-red-400/10 border-red-400/20',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    low:    'text-blue-400 bg-blue-400/10 border-blue-400/20',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Market Signals</h1>
        <p className="text-gray-400 mt-1">Economic and industry signals that may affect your pricing</p>
      </div>

      {signals && signals.length > 0 ? (
        <div className="space-y-4">
          {signals.map((signal: any) => (
            <div key={signal.id} className="card hover:border-white/10 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3 className="text-white font-semibold">{signal.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize shrink-0 ${impactColor[signal.impact_level] ?? ''}`}>
                      {signal.impact_level} impact
                    </span>
                  </div>
                  {signal.summary && (
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">{signal.summary}</p>
                  )}
                  {signal.affected_categories?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {signal.affected_categories.map((cat: string) => (
                        <span key={cat} className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded capitalize">{cat}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    {signal.published_at && (
                      <p className="text-gray-600 text-xs">{format(new Date(signal.published_at), 'MMM d, yyyy')}</p>
                    )}
                    {signal.source_url && (
                      <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="text-brand-light text-xs hover:underline">
                        Read source
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-white font-medium">No signals yet</p>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Shepherd will populate this section with relevant market and industry signals
          </p>
        </div>
      )}
    </div>
  )
}