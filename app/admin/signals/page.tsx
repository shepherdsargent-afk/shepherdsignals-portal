'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminSignalsPage() {
  const [form, setForm] = useState({
    title: '', summary: '', source_url: '', category: '',
    impact_level: 'medium', affected_categories: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const affected = form.affected_categories
      ? form.affected_categories.split(',').map(s => s.trim()).filter(Boolean)
      : []
    await supabase.from('market_signals').insert({
      title: form.title,
      summary: form.summary,
      source_url: form.source_url || null,
      category: form.category || null,
      impact_level: form.impact_level,
      affected_categories: affected,
      published_at: new Date().toISOString(),
    })
    setSaved(true)
    setForm({ title: '', summary: '', source_url: '', category: '', impact_level: 'medium', affected_categories: '' })
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Add Market Signal</h1>
        <p className="text-gray-400 mt-1">Publish a market signal to all client portals</p>
      </div>

      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title *</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Diesel prices expected to rise 8% in Q4"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-light" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Summary</label>
            <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
              rows={3} placeholder="Brief explanation of the signal and what it means for golf clubs..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-light resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Source URL</label>
              <input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. fuel, food, labour"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Impact Level</label>
              <select value={form.impact_level} onChange={e => setForm({ ...form, impact_level: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none">
                <option value="low">🔵 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Affected Categories (comma-separated)</label>
              <input value={form.affected_categories} onChange={e => setForm({ ...form, affected_categories: e.target.value })}
                placeholder="food, chemicals, fuel"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 disabled:opacity-50">
              {saving ? 'Publishing...' : 'Publish Signal'}
            </button>
            {saved && <p className="text-green-400 text-sm">✅ Signal published to all client portals</p>}
          </div>
        </form>
      </div>
    </div>
  )
}
