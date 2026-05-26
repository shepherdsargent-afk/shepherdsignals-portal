'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', slug: '', contact_name: '', contact_email: '', contact_phone: '',
    city: '', state: '', plan: 'weekly', status: 'active', notes: '',
  })
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('vendors').select('*').order('name'),
    ])
    setCompanies(c ?? [])
    setVendors(v ?? [])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { error } = await supabase.from('companies').insert({ ...form, slug })
    if (!error) {
      setShowForm(false)
      setForm({ name: '', slug: '', contact_name: '', contact_email: '', contact_phone: '', city: '', state: '', plan: 'weekly', status: 'active', notes: '' })
      load()
    }
    setSaving(false)
  }

  const statusColor: Record<string, string> = {
    active: 'text-green-400',
    trial: 'text-yellow-400',
    inactive: 'text-gray-500',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-gray-400 mt-1">Manage golf club clients</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary px-5 py-2.5">
          {showForm ? 'Cancel' : '+ Add Company'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-white font-semibold mb-4">New Company</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Club Name', required: true },
              { key: 'slug', label: 'Slug (auto if blank)' },
              { key: 'contact_name', label: 'Contact Name' },
              { key: 'contact_email', label: 'Contact Email' },
              { key: 'contact_phone', label: 'Contact Phone' },
              { key: 'city', label: 'City' },
              { key: 'state', label: 'Province/State' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={(form as any)[field.key]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  required={field.required}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-light"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plan</label>
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                <option value="daily">Daily Signals</option>
                <option value="weekly">Weekly Audit</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none" />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Company'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Company List */}
      <div className="space-y-3">
        {companies.map((c: any) => (
          <div key={c.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-semibold">{c.name}</h3>
                  <span className={`text-xs capitalize ${statusColor[c.status]}`}>● {c.status}</span>
                  <span className="text-xs text-gray-500">{c.plan}</span>
                </div>
                {c.contact_name && <p className="text-gray-400 text-sm mt-1">{c.contact_name} {c.contact_email ? `· ${c.contact_email}` : ''}</p>}
                {c.city && <p className="text-gray-600 text-xs mt-0.5">{c.city}{c.state ? `, ${c.state}` : ''}</p>}
                {c.notes && <p className="text-gray-600 text-xs mt-1 italic">{c.notes}</p>}
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{c.slug}</p>
              </div>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="card text-center py-12 text-gray-600">No companies yet — add your first client above</div>
        )}
      </div>
    </div>
  )
}
