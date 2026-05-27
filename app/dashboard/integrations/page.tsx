'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const SUPABASE_URL = 'https://lmrgzsfvzzdoatpddjvb.supabase.co'

const PROVIDERS = [
  {
    id: 'jonas',
    name: 'Jonas Club Software',
    domain: 'jonassoftware.com',
    short: 'J',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    desc: 'Import purchase orders and vendor invoices via CSV export',
    type: 'csv',
    price: 'Included',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    domain: 'quickbooks.intuit.com',
    short: 'QB',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400',
    desc: 'Sync vendor bills and purchase orders automatically',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_QB_CLIENT_ID',
    authUrl: 'https://appcenter.intuit.com/connect/oauth2',
    scope: 'com.intuit.quickbooks.accounting',
    price: 'Included',
  },
  {
    id: 'xero',
    name: 'Xero',
    domain: 'xero.com',
    short: 'X',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    desc: 'Connect accounts payable invoices from Xero',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_XERO_CLIENT_ID',
    authUrl: 'https://login.xero.com/identity/connect/authorize',
    scope: 'accounting.transactions.read',
    price: 'Included',
  },
  {
    id: 'wave',
    name: 'Wave Accounting',
    domain: 'waveapps.com',
    short: 'WV',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    desc: 'Import supplier bills from Wave accounting',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_WAVE_CLIENT_ID',
    authUrl: 'https://api.waveapps.com/oauth2/authorize/',
    scope: 'account:* business:read transactions:read',
    price: 'Included',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    domain: 'freshbooks.com',
    short: 'FB',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    desc: 'Connect vendor expenses and bills from FreshBooks',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_FRESHBOOKS_CLIENT_ID',
    authUrl: 'https://auth.freshbooks.com/service/auth/oauth/authorize',
    scope: 'user:profile:read user:bill_vendors:read user:bills:read',
    price: 'Included',
  },
  {
    id: 'netsuite',
    name: 'NetSuite',
    domain: 'netsuite.com',
    short: 'NS',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    desc: 'Enterprise ERP vendor bill synchronization',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_NETSUITE_CLIENT_ID',
    authUrl: '',
    scope: '',
    price: '$249/mo add-on',
    enterprise: true,
  },
  {
    id: 'dynamics365',
    name: 'Dynamics 365',
    domain: 'microsoft.com',
    short: 'D365',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-300',
    desc: 'Microsoft Business Central purchase invoice sync',
    type: 'oauth',
    envKey: 'NEXT_PUBLIC_DYNAMICS_CLIENT_ID',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scope: 'https://api.businesscentral.dynamics.com/.default',
    price: '$249/mo add-on',
    enterprise: true,
  },
  {
    id: 'sap',
    name: 'SAP Ariba / Coupa',
    domain: 'sap.com',
    short: 'SAP',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    desc: 'Enterprise procurement and spend management sync',
    type: 'enterprise',
    price: '$349/mo add-on',
    enterprise: true,
  },
]

function ProviderIcon({ provider }: { provider: typeof PROVIDERS[0] }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`w-12 h-12 rounded-xl ${failed ? provider.iconBg : 'bg-white'} border border-white/10 flex items-center justify-center shrink-0 overflow-hidden p-1.5`}>
      {failed ? (
        <span className={`${provider.iconColor} text-xs font-bold`}>{provider.short}</span>
      ) : (
        <img
          src={`https://logo.clearbit.com/${provider.domain}`}
          alt={provider.name}
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [jonasParsing, setJonasParsing] = useState(false)
  const [jonasCols, setJonasCols] = useState<string[]>([])
  const [jonasRows, setJonasRows] = useState<any[]>([])
  const [jonasMap, setJonasMap] = useState<Record<string, string>>({})
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [connected, setConnected] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
      if (!cu) return
      setCompanyId(cu.company_id)
      const { data } = await supabase.from('company_integrations').select('*').eq('company_id', cu.company_id)
      setIntegrations(data ?? [])
      const params = new URLSearchParams(window.location.search)
      const conn = params.get('connected')
      if (conn) { setConnected(conn); window.history.replaceState({}, '', window.location.pathname) }
    }
    load()
  }, [])

  function isConnected(providerId: string) {
    return integrations.some(i => i.provider === providerId && i.status === 'active')
  }

  function buildOAuthUrl(provider: typeof PROVIDERS[0]) {
    if (provider.type !== 'oauth' || !provider.authUrl) return null
    const clientId = process.env[provider.envKey ?? ''] ?? ''
    if (!clientId) return null
    const redirect = `${SUPABASE_URL}/functions/v1/oauth-callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: provider.scope ?? '',
      state: `${provider.id}:${companyId}`,
    })
    return `${provider.authUrl}?${params.toString()}`
  }

  async function handleSync(providerId: string) {
    if (!companyId) return
    setSyncing(providerId)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/sync-${providerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
    } finally { setSyncing(null) }
  }

  function handleJonasFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setJonasParsing(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setJonasParsing(false); return }
      const cols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(cols.map((c, i) => [c, vals[i] ?? '']))
      })
      setJonasCols(cols)
      setJonasRows(rows)
      const guessCol = (hints: string[]) => cols.find(c => hints.some(h => c.toLowerCase().includes(h))) ?? ''
      setJonasMap({
        description: guessCol(['desc', 'item', 'product', 'name']),
        quantity:    guessCol(['qty', 'quan']),
        unit_price:  guessCol(['price', 'unit', 'cost', 'rate']),
        vendor_name: guessCol(['vendor', 'supplier']),
        date:        guessCol(['date', 'posted']),
      })
      setJonasParsing(false)
    }
    reader.readAsText(file)
  }

  async function submitJonasImport() {
    if (!companyId || !jonasRows.length) return
    setSyncing('jonas')
    const items = jonasRows.map(row => ({
      description: row[jonasMap.description] ?? '',
      quantity:    parseFloat(row[jonasMap.quantity]) || 1,
      unit_price:  parseFloat(row[jonasMap.unit_price]) || 0,
      vendor_name: row[jonasMap.vendor_name] ?? 'Jonas Import',
      date:        row[jonasMap.date] ?? new Date().toISOString(),
    })).filter(i => i.description && i.unit_price > 0)
    await fetch(`${SUPABASE_URL}/functions/v1/process-jonas-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, items }),
    })
    setSyncing(null)
    setJonasRows([])
    setJonasCols([])
  }

  const steps = [
    { step: '1', title: 'Connect', desc: 'Link your accounting software with one click. We read purchase orders and vendor bills only &mdash; nothing else.' },
    { step: '2', title: 'Analyse', desc: 'Every line item is checked against current market prices, automatically, with the same intelligence as uploading an invoice.' },
    { step: '3', title: 'Save', desc: 'Get alerted to every savings opportunity. Prices refresh daily so you always have current data.' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-gray-400 mt-1">Connect your accounting software to automatically analyse every purchase order</p>
      </div>

      {connected && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="text-sm font-medium">{connected} connected successfully</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {PROVIDERS.map(provider => {
          const active = isConnected(provider.id)
          const oauthUrl = buildOAuthUrl(provider)

          return (
            <div key={provider.id} className={`card flex flex-col gap-4 ${provider.enterprise ? 'border-amber-500/10' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ProviderIcon provider={provider} />
                  <div>
                    <p className="text-white font-semibold text-sm">{provider.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{provider.desc}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded border shrink-0 whitespace-nowrap ${
                  provider.enterprise
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {provider.price}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-auto">
                {active ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      Connected
                    </span>
                    <button
                      onClick={() => handleSync(provider.id)}
                      disabled={syncing === provider.id}
                      className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {syncing === provider.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </>
                ) : provider.type === 'csv' ? (
                  <>
                    <input type="file" accept=".csv" ref={fileRef} className="hidden" onChange={handleJonasFile} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={jonasParsing}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
                    >
                      {jonasParsing ? 'Parsing...' : 'Import CSV'}
                    </button>
                  </>
                ) : provider.type === 'enterprise' ? (
                  <a
                    href="mailto:shepherdsargent@shepherdsignals.com?subject=Enterprise Integration Enquiry"
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                  >
                    Contact Sales
                  </a>
                ) : oauthUrl ? (
                  <a
                    href={oauthUrl}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                  >
                    Connect
                  </a>
                ) : (
                  <span className="text-xs text-gray-600">Setup required &mdash; contact support</span>
                )}
              </div>

              {provider.id === 'jonas' && jonasRows.length > 0 && (
                <div className="mt-2 pt-4 border-t border-white/5">
                  <p className="text-gray-400 text-xs mb-3">{jonasRows.length} rows found &mdash; map columns:</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(['description', 'quantity', 'unit_price', 'vendor_name'] as const).map(field => (
                      <div key={field}>
                        <label className="text-gray-600 text-xs capitalize">{field.replace('_', ' ')}</label>
                        <select
                          value={jonasMap[field] ?? ''}
                          onChange={e => setJonasMap(prev => ({ ...prev, [field]: e.target.value }))}
                          className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 text-xs"
                        >
                          <option value="">-- select --</option>
                          {jonasCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={submitJonasImport}
                    disabled={syncing === 'jonas'}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
                  >
                    {syncing === 'jonas' ? 'Analysing...' : 'Analyse Prices'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* How it works */}
      <div className="card bg-amber-500/5 border-amber-500/10">
        <h2 className="text-white font-semibold mb-4">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-amber-400 text-xs font-bold">{s.step}</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{s.title}</p>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.desc }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}