'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns'

const SUPABASE_URL = 'https://lmrgzsfvzzdoatpddjvb.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtcmd6c2Z2enpkb2F0cGRkanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjI1MDYsImV4cCI6MjA4NTAzODUwNn0.9k60-UsVRyKVgsaecC2f_6XLzqMgEY7qCbiBzFhvk0A'

// OAuth authorize URLs per provider
const OAUTH_URLS: Record<string, (companyId: string) => string> = {
  quickbooks: (cid) =>
    `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_QB_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/oauth-callback?provider=quickbooks`)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=${cid}`,
  xero: (cid) =>
    `https://login.xero.com/identity/connect/authorize?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/oauth-callback?provider=xero`)}&response_type=code&scope=accounting.transactions+accounting.contacts+offline_access&state=${cid}`,
  dynamics365: (cid) =>
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_DYNAMICS_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/oauth-callback?provider=dynamics365`)}&response_type=code&scope=https%3A%2F%2Fapi.businesscentral.dynamics.com%2F.default+offline_access&state=${cid}`,
  freshbooks: (cid) =>
    `https://auth.freshbooks.com/oauth/authorize?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_FRESHBOOKS_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/oauth-callback?provider=freshbooks`)}&response_type=code&state=${cid}`,
}

interface Integration {
  id: string
  provider: string
  status: string
  external_company_name?: string
  last_synced_at?: string
  sync_error?: string
  plan_addon: boolean
}

const PROVIDERS = [
  {
    key: 'jonas_csv',
    name: 'Jonas Club Software',
    logo: 'ðŸŒï¸',
    description: 'The #1 management system for private golf & country clubs. Import purchase orders and vendor bills via CSV export from Jonas.',
    price: 149,
    tier: 'Golf & Country Clubs',
    connectType: 'csv',
    popular: true,
  },
  {
    key: 'quickbooks',
    name: 'QuickBooks Online',
    logo: 'ðŸŸ¢',
    description: 'Auto-sync vendor bills and purchase orders from QuickBooks. ShepherdSignals analyses every line item against live market prices.',
    price: 99,
    tier: 'Smallâ€“Mid Courses',
    connectType: 'oauth',
  },
  {
    key: 'xero',
    name: 'Xero',
    logo: 'ðŸ”µ',
    description: 'Connect Xero to automatically pull supplier invoices and bills for market price comparison.',
    price: 99,
    tier: 'Smallâ€“Mid Courses',
    connectType: 'oauth',
  },
  {
    key: 'netsuite',
    name: 'Oracle NetSuite',
    logo: 'ðŸŸ ',
    description: 'Enterprise-grade sync of vendor bills, purchase orders, and receipts from NetSuite ERP.',
    price: 249,
    tier: 'Enterprise / PGA Tour',
    connectType: 'apikey',
  },
  {
    key: 'dynamics365',
    name: 'Microsoft Dynamics 365',
    logo: 'ðŸ”·',
    description: 'Sync purchase invoices and vendor data from Dynamics 365 Business Central.',
    price: 249,
    tier: 'Enterprise / PGA Tour',
    connectType: 'oauth',
  },
  {
    key: 'wave',
    name: 'Wave Accounting',
    logo: 'ðŸŒŠ',
    description: 'Connect Wave to import supplier bills for automated price intelligence.',
    price: 99,
    tier: 'Small Courses',
    connectType: 'oauth',
  },
  {
    key: 'freshbooks',
    name: 'FreshBooks',
    logo: 'ðŸ“’',
    description: 'Pull vendor expenses and bills from FreshBooks into the ShepherdSignals pipeline.',
    price: 99,
    tier: 'Small Courses',
    connectType: 'oauth',
  },
  {
    key: 'sap_ariba',
    name: 'SAP Ariba / Coupa',
    logo: 'ðŸ¢',
    description: 'Enterprise procurement integration for tour-level operations managing complex vendor networks.',
    price: 349,
    tier: 'Enterprise / Tour Level',
    connectType: 'contact',
  },
]

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [uploadProvider, setUploadProvider] = useState<string | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single()
    if (!cu) return
    setCompanyId(cu.company_id)
    const { data } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('company_id', cu.company_id)
    setIntegrations(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    // Check for ?connected= or ?error= from OAuth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected')) load()
  }, [load])

  function getIntegration(key: string) {
    return integrations.find(i => i.provider === key)
  }

  async function handleConnect(provider: string, connectType: string) {
    if (!companyId) return
    if (connectType === 'oauth' && OAUTH_URLS[provider]) {
      window.location.href = OAUTH_URLS[provider](companyId)
    } else if (connectType === 'csv' || connectType === 'apikey') {
      setUploadProvider(provider)
    } else if (connectType === 'contact') {
      window.open('mailto:support@shepherdsignals.com?subject=Enterprise Integration Request', '_blank')
    }
  }

  async function handleSync(provider: string) {
    if (!companyId) return
    setSyncing(provider)
    try {
      const fnMap: Record<string, string> = {
        quickbooks: 'sync-quickbooks',
        xero: 'sync-xero',
        netsuite: 'sync-netsuite',
        dynamics365: 'sync-dynamics365',
        wave: 'sync-wave',
      }
      const fn = fnMap[provider]
      if (!fn) return
      await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ companyId }),
      })
      await load()
    } finally {
      setSyncing(null)
    }
  }

  async function handleDisconnect(provider: string) {
    if (!companyId) return
    await supabase.from('company_integrations').update({ status: 'disconnected' })
      .eq('company_id', companyId).eq('provider', provider)
    await load()
  }

  async function handleJonasCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !companyId) return

    const text = await file.text()
    const rows = text.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
    const headers = rows[0].map(h => h.toLowerCase())

    const descIdx = headers.findIndex(h => h.includes('description') || h.includes('item'))
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity'))
    const priceIdx = headers.findIndex(h => h.includes('unit') && h.includes('price') || h === 'price')
    const totalIdx = headers.findIndex(h => h.includes('total') || h.includes('amount'))
    const vendorIdx = headers.findIndex(h => h.includes('vendor') || h.includes('supplier'))
    const dateIdx = headers.findIndex(h => h.includes('date'))

    const lineItems = rows.slice(1).filter(r => r.length > 2 && r[descIdx]).map((r, i) => ({
      company_id: companyId,
      company_integration_id: null,
      external_id: `JONAS-CSV-${Date.now()}-${i}`,
      external_doc_number: 'Jonas Import',
      vendor_name: vendorIdx >= 0 ? r[vendorIdx] : 'Jonas Vendor',
      item_description: r[descIdx] ?? 'Item',
      quantity: parseFloat(r[qtyIdx] ?? '1') || 1,
      unit_price: parseFloat(r[priceIdx] ?? '0') || 0,
      total_price: parseFloat(r[totalIdx] ?? '0') || 0,
      currency: 'CAD',
      transaction_date: dateIdx >= 0 ? r[dateIdx] : null,
      category: null,
      processed: false,
    })).filter(r => r.unit_price > 0)

    if (lineItems.length > 0) {
      await supabase.from('integration_line_items').insert(lineItems)
      // Upsert integration record
      await supabase.from('company_integrations').upsert({
        company_id: companyId,
        provider: 'jonas_csv',
        status: 'connected',
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,provider' })
      // Trigger analysis
      await fetch(`${SUPABASE_URL}/functions/v1/analyze-integration-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ companyId }),
      })
      await load()
    }
    setUploadProvider(null)
    e.target.value = ''
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading integrations...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Accounting Integrations</h1>
        <p className="text-gray-400 mt-1">
          Connect your accounting software to automatically sync vendor invoices into ShepherdSignals for price intelligence.
          Each integration is an add-on to your plan.
        </p>
      </div>

      {/* Add-on pricing banner */}
      <div className="card mb-8 border-indigo-500/20 bg-indigo-500/5">
        <div className="flex items-start gap-4">
          <div className="text-2xl mt-0.5">ðŸ’¡</div>
          <div>
            <p className="text-white font-semibold">How integrations work</p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Connect your accounting software and ShepherdSignals automatically pulls your vendor bills and purchase orders.
              Every line item is checked against current market prices â€” same intelligence as uploading an invoice, but fully automatic.
              Integrations are <span className="text-indigo-400 font-medium">add-ons billed monthly</span> on top of your base plan.
            </p>
          </div>
        </div>
      </div>

      {/* Integration cards */}
      <div className="space-y-4">
        {PROVIDERS.map(p => {
          const integration = getIntegration(p.key)
          const isConnected = integration?.status === 'connected'
          const isSyncing = syncing === p.key

          return (
            <div key={p.key} className={`card relative ${isConnected ? 'border-green-500/20' : ''}`}>
              {p.popular && !isConnected && (
                <span className="absolute top-4 right-4 text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                  Most popular for golf clubs
                </span>
              )}

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
                  {p.logo}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-white font-semibold text-base">{p.name}</h3>
                    <span className="text-xs bg-white/5 text-gray-500 px-2 py-0.5 rounded">{p.tier}</span>
                    {isConnected && (
                      <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                        â— Connected
                      </span>
                    )}
                  </div>

                  <p className="text-gray-400 text-sm mt-1.5 leading-relaxed max-w-2xl">{p.description}</p>

                  {isConnected && integration && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {integration.external_company_name && (
                        <span>Connected to: <span className="text-gray-300">{integration.external_company_name}</span></span>
                      )}
                      {integration.last_synced_at && (
                        <span>Last sync: <span className="text-gray-300">{format(new Date(integration.last_synced_at), 'MMM d, h:mm a')}</span></span>
                      )}
                      {integration.sync_error && (
                        <span className="text-red-400">Error: {integration.sync_error}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-white font-bold text-lg tabular-nums">${p.price}<span className="text-gray-500 text-xs font-normal">/mo</span></p>
                    <p className="text-gray-600 text-xs">add-on</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!isConnected ? (
                      <button
                        onClick={() => handleConnect(p.key, p.connectType)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        {p.connectType === 'contact' ? 'Contact Sales' : p.connectType === 'csv' ? 'Import CSV' : 'Connect'}
                      </button>
                    ) : (
                      <>
                        {p.connectType !== 'csv' && p.connectType !== 'contact' && (
                          <button
                            onClick={() => handleSync(p.key)}
                            disabled={isSyncing}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-white/10 whitespace-nowrap disabled:opacity-50"
                          >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                        )}
                        {p.connectType === 'csv' && (
                          <label className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-white/10 cursor-pointer whitespace-nowrap text-center">
                            Import New CSV
                            <input type="file" accept=".csv" className="hidden" onChange={handleJonasCsvUpload} />
                          </label>
                        )}
                        <button
                          onClick={() => handleDisconnect(p.key)}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20 whitespace-nowrap"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Jonas CSV upload overlay */}
              {uploadProvider === p.key && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-sm text-gray-400 mb-3">
                    Export a purchase order or vendor bill report from Jonas as CSV, then upload it here.
                    ShepherdSignals will extract all line items and check them against current market prices.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Choose CSV File
                    <input type="file" accept=".csv" className="hidden" onChange={handleJonasCsvUpload} />
                  </label>
                  <button onClick={() => setUploadProvider(null)} className="ml-3 text-sm text-gray-500 hover:text-gray-300">Cancel</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bundle pricing callout */}
      <div className="card mt-8 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-4">
          <div className="text-2xl">âš¡</div>
          <div className="flex-1">
            <p className="text-white font-semibold">All Integrations Bundle â€” <span className="text-amber-400">$349/mo</span></p>
            <p className="text-gray-400 text-sm mt-1">
              Connect QuickBooks, Xero, Jonas, Wave, and FreshBooks for one flat rate. Save vs. individual add-ons.
              NetSuite, Dynamics 365, and SAP Ariba priced separately.
            </p>
          </div>
          <a href="mailto:support@shepherdsignals.com?subject=Bundle Integration Inquiry" className="shrink-0 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors border border-amber-500/30">
            Get Bundle â†’
          </a>
        </div>
      </div>
    </div>
  )
}