'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PROVIDERS = [
  {
    id: 'jonas',
    name: 'Jonas Club Software',
    desc: 'Upload your Jonas CSV export to sync purchase orders and invoices automatically.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=jonassoftware.com',
    short: 'J',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    type: 'csv',
    category: 'accounting',
    loginUrl: '',
    signupUrl: '',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    desc: 'Connect your QuickBooks account to sync invoices, vendors, and spend data in real time.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=quickbooks.intuit.com',
    short: 'QB',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400',
    type: 'oauth',
    loginUrl: 'https://accounts.intuit.com/app/sign-in?app_group=quickbooks',
    signupUrl: 'https://quickbooks.intuit.com/global/pricing/',
    category: 'accounting',
  },
  {
    id: 'xero',
    name: 'Xero',
    desc: 'Connect Xero to pull purchase orders, bills, and supplier data into your ShepherdSignals dashboard.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=xero.com',
    short: 'X',
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-400',
    type: 'oauth',
    loginUrl: 'https://login.xero.com/',
    signupUrl: 'https://www.xero.com/signup/',
    category: 'accounting',
  },
  {
    id: 'wave',
    name: 'Wave Accounting',
    desc: 'Free accounting software. Connect Wave to track vendor payments and flag price anomalies.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=waveapps.com',
    short: 'WV',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    type: 'oauth',
    loginUrl: 'https://my.waveapps.com/login/',
    signupUrl: 'https://www.waveapps.com/',
    category: 'accounting',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    desc: 'Connect FreshBooks to sync expense reports and supplier invoices with your price monitoring.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=freshbooks.com',
    short: 'FB',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    type: 'oauth',
    loginUrl: 'https://my.freshbooks.com/#/login',
    signupUrl: 'https://www.freshbooks.com/signup',
    category: 'accounting',
  },
]

const ENTERPRISE_PROVIDERS = [
  {
    id: 'netsuite',
    name: 'NetSuite',
    desc: 'Enterprise ERP with full procurement module. Available on our Enterprise plan.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=netsuite.com',
    short: 'NS',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
  },
  {
    id: 'dynamics365',
    name: 'Dynamics 365',
    desc: 'Microsoft enterprise ERP. Connect your Dynamics environment for full procurement data sync.',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=microsoft.com',
    short: 'D',
    iconBg: 'bg-blue-600/10',
    iconColor: 'text-blue-400',
  },
]

type Provider = typeof PROVIDERS[0]

function ProviderIcon({ provider }: { provider: { logoUrl: string; short: string; iconBg: string; iconColor: string; name: string } }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${failed ? provider.iconBg + ' border border-white/10' : 'bg-white p-1.5'}`}>
      {failed ? (
        <span className={`${provider.iconColor} text-xs font-bold`}>{provider.short}</span>
      ) : (
        <img src={provider.logoUrl} alt={provider.name} className="w-full h-full object-contain" onError={() => setFailed(true)} />
      )}
    </div>
  )
}

function ConnectModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <ProviderIcon provider={provider} />
          <div>
            <h3 className="font-semibold text-white">{provider.name}</h3>
            <p className="text-xs text-gray-400">Connect your account</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          Sign in to your {provider.name} account to authorize ShepherdSignals to read your invoices and vendor data.
        </p>
        <div className="flex flex-col gap-2">
          <a href={provider.loginUrl} target="_blank" rel="noopener noreferrer"
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-xl text-sm text-center transition-colors">
            Sign in to {provider.name}
          </a>
          <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer"
            className="w-full bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-2.5 rounded-xl text-sm text-center transition-colors border border-white/10">
            Create {provider.name} account
          </a>
          <button onClick={onClose} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-4 text-center">After signing in, return here to complete the connection.</p>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [company, setCompany] = useState<any>(null)
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [activeModal, setActiveModal] = useState<Provider | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
      if (!cu) return
      const { data: co } = await supabase.from('companies').select('*').eq('id', cu.company_id).single()
      setCompany(co)
      const { data: integrations } = await supabase.from('integrations').select('provider, status').eq('company_id', cu.company_id)
      if (integrations) {
        const map: Record<string, boolean> = {}
        integrations.forEach((i: any) => { if (i.status === 'active') map[i.provider] = true })
        setConnected(map)
      }
    }
    load()
  }, [])

  async function handleJonasUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !company) return
    setUploading(true)
    setUploadMsg('')
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase())
      let imported = 0
      for (let i = 1; i < Math.min(lines.length, 201); i++) {
        const vals = lines[i].split(',')
        const row: Record<string, string> = {}
        headers.forEach((h: string, idx: number) => { row[h] = (vals[idx] || '').trim() })
        if (row['item'] || row['description'] || row['product']) {
          await supabase.from('price_records').insert({
            company_id: company.id,
            product_name: row['item'] || row['description'] || row['product'] || 'Unknown',
            vendor_name: row['vendor'] || row['supplier'] || 'Jonas Import',
            unit_price: parseFloat(row['price'] || row['unit price'] || row['amount'] || '0') || 0,
            quantity: parseFloat(row['qty'] || row['quantity'] || '1') || 1,
            recorded_at: row['date'] || new Date().toISOString(),
            source: 'jonas_csv',
          })
          imported++
        }
      }
      setUploadMsg(`Successfully imported ${imported} records from Jonas.`)
    } catch {
      setUploadMsg('Error reading file. Please check the CSV format.')
    }
    setUploading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {activeModal && <ConnectModal provider={activeModal} onClose={() => setActiveModal(null)} />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
        <p className="text-gray-400 text-sm">Connect your accounting software so ShepherdSignals can automatically read your invoices and monitor pricing.</p>
      </div>

      <div className="space-y-3 mb-10">
        {PROVIDERS.map(provider => (
          <div key={provider.id} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 flex items-center gap-4">
            <ProviderIcon provider={provider} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-white text-sm">{provider.name}</span>
                {connected[provider.id] && (
                  <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Connected</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{provider.desc}</p>
              {provider.id === 'jonas' && uploadMsg && <p className="text-xs text-amber-400 mt-1">{uploadMsg}</p>}
            </div>
            <div className="shrink-0">
              {connected[provider.id] ? (
                <button className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-white/10 px-3 py-1.5 rounded-lg">Disconnect</button>
              ) : provider.type === 'csv' ? (
                <label className={`cursor-pointer bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${uploading ? 'opacity-50' : ''}`}>
                  {uploading ? 'Importing...' : 'Upload CSV'}
                  <input type="file" accept=".csv" className="hidden" onChange={handleJonasUpload} disabled={uploading} />
                </label>
              ) : (
                <button onClick={() => setActiveModal(provider)}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-sm font-semibold text-white">Enterprise Integrations</h2>
          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Add-on</span>
        </div>
        <p className="text-xs text-gray-500">For larger club groups, resorts, and multi-property operations. Contact us to enable.</p>
      </div>

      <div className="space-y-3">
        {ENTERPRISE_PROVIDERS.map(provider => (
          <div key={provider.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4 opacity-75">
            <ProviderIcon provider={provider} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-gray-300 text-sm">{provider.name}</span>
                <span className="text-xs bg-white/5 text-gray-500 border border-white/10 px-2 py-0.5 rounded-full">Enterprise</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{provider.desc}</p>
            </div>
            <div className="shrink-0">
              <a href="mailto:shepherdsargent@shepherdsignals.com?subject=Enterprise Integration Inquiry"
                className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-4 py-2 rounded-xl transition-colors">
                Contact Us
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-1">How It Works</h3>
        <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
          <li>Click Connect and sign in to your accounting software</li>
          <li>Authorize ShepherdSignals to read your invoices and vendor data</li>
          <li>Your purchase history syncs automatically to your dashboard</li>
          <li>ShepherdSignals monitors every invoice and alerts you to price spikes</li>
        </ol>
      </div>
    </div>
  )
}