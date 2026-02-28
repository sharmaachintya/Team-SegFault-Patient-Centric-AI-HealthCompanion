import React, { useState, useEffect } from 'react'
import { Save, Plus, X, Pill, AlertCircle, Heart, Edit3, Check } from 'lucide-react'
import { updateProfile } from '../api/client'

export default function HealthProfile({ patientId, profile, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    age: '',
    sex: '',
    medications: [],
    conditions: [],
    allergies: [],
    lifestyle_notes: '',
  })
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', start_date: '' })
  const [newCondition, setNewCondition] = useState('')
  const [newAllergy, setNewAllergy] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        age: profile.age || '',
        sex: profile.sex || '',
        medications: profile.medications || [],
        conditions: profile.conditions || [],
        allergies: profile.allergies || [],
        lifestyle_notes: profile.lifestyle_notes || '',
      })
    }
  }, [profile])

  function addMedication() {
    if (!newMed.name.trim()) return
    setForm(prev => ({
      ...prev,
      medications: [...prev.medications, { ...newMed }],
    }))
    setNewMed({ name: '', dosage: '', frequency: '', start_date: '' })
  }

  function removeMedication(idx) {
    setForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== idx),
    }))
  }

  function addCondition() {
    if (!newCondition.trim()) return
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition.trim()],
    }))
    setNewCondition('')
  }

  function addAllergy() {
    if (!newAllergy.trim()) return
    setForm(prev => ({
      ...prev,
      allergies: [...prev.allergies, newAllergy.trim()],
    }))
    setNewAllergy('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const data = {
        name: form.name || undefined,
        age: form.age ? parseInt(form.age) : undefined,
        sex: form.sex || undefined,
        medications: form.medications,
        conditions: form.conditions,
        allergies: form.allergies,
        lifestyle_notes: form.lifestyle_notes || undefined,
      }
      const saved = await updateProfile(patientId, data)
      onUpdate(saved)
      setEditing(false)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = !form.name && !form.age && form.medications.length === 0 && form.conditions.length === 0

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">Health Profile</h3>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            editing
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {editing ? (
            <>
              {saving ? 'Saving...' : <><Check className="w-3 h-3" /> Save</>}
            </>
          ) : (
            <>
              <Edit3 className="w-3 h-3" /> Edit
            </>
          )}
        </button>
      </div>

      {isEmpty && !editing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <Heart className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-blue-700 font-medium">Set up your health profile</p>
          <p className="text-xs text-blue-600 mt-1">Add your medications, conditions, and allergies for personalized guidance.</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700"
          >
            Get Started
          </button>
        </div>
      )}

      {/* Basic Info */}
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Age</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm(prev => ({ ...prev, age: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Age"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Sex</label>
              <select
                value={form.sex}
                onChange={(e) => setForm(prev => ({ ...prev, sex: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        form.name && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">{form.name}</span>
            {form.age && <span className="text-gray-500"> · {form.age}y</span>}
            {form.sex && <span className="text-gray-500"> · {form.sex}</span>}
          </div>
        )
      )}

      {/* Medications */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5" /> Medications ({form.medications.length})
        </h4>
        {form.medications.map((med, idx) => (
          <div key={idx} className="flex items-start justify-between bg-emerald-50 border border-emerald-100 rounded-lg p-2 mb-1.5">
            <div>
              <span className="text-sm font-medium text-emerald-800">{med.name}</span>
              {med.dosage && <span className="text-xs text-emerald-600 ml-1">({med.dosage})</span>}
              <div className="text-xs text-emerald-600">
                {med.frequency && <span>{med.frequency}</span>}
                {med.start_date && <span> · Started: {med.start_date}</span>}
              </div>
            </div>
            {editing && (
              <button onClick={() => removeMedication(idx)} className="p-1 hover:bg-emerald-100 rounded">
                <X className="w-3.5 h-3.5 text-emerald-500" />
              </button>
            )}
          </div>
        ))}
        {editing && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1.5">
            <input
              value={newMed.name}
              onChange={(e) => setNewMed(prev => ({ ...prev, name: e.target.value }))}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
              placeholder="Medication name"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={newMed.dosage}
                onChange={(e) => setNewMed(prev => ({ ...prev, dosage: e.target.value }))}
                className="text-xs border border-gray-300 rounded px-2 py-1.5"
                placeholder="Dosage (e.g., 10mg)"
              />
              <input
                value={newMed.frequency}
                onChange={(e) => setNewMed(prev => ({ ...prev, frequency: e.target.value }))}
                className="text-xs border border-gray-300 rounded px-2 py-1.5"
                placeholder="Frequency (e.g., daily)"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={newMed.start_date}
                onChange={(e) => setNewMed(prev => ({ ...prev, start_date: e.target.value }))}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
              />
              <button
                onClick={addMedication}
                disabled={!newMed.name.trim()}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conditions */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> Conditions ({form.conditions.length})
        </h4>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {form.conditions.map((c, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
              {c}
              {editing && (
                <button onClick={() => setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }))}>
                  <X className="w-3 h-3 text-orange-400" />
                </button>
              )}
            </span>
          ))}
        </div>
        {editing && (
          <div className="flex gap-1.5">
            <input
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCondition()}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
              placeholder="e.g., Type 2 Diabetes"
            />
            <button
              onClick={addCondition}
              disabled={!newCondition.trim()}
              className="px-2 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Allergies */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          ⚠️ Allergies ({form.allergies.length})
        </h4>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {form.allergies.map((a, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-red-50 border border-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
              {a}
              {editing && (
                <button onClick={() => setForm(prev => ({ ...prev, allergies: prev.allergies.filter((_, i) => i !== idx) }))}>
                  <X className="w-3 h-3 text-red-400" />
                </button>
              )}
            </span>
          ))}
        </div>
        {editing && (
          <div className="flex gap-1.5">
            <input
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
              placeholder="e.g., Penicillin"
            />
            <button
              onClick={addAllergy}
              disabled={!newAllergy.trim()}
              className="px-2 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Lifestyle Notes */}
      {editing && (
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Lifestyle Notes</label>
          <textarea
            value={form.lifestyle_notes}
            onChange={(e) => setForm(prev => ({ ...prev, lifestyle_notes: e.target.value }))}
            className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 h-16 resize-none"
            placeholder="Diet, exercise, sleep patterns, stress levels..."
          />
        </div>
      )}
      {!editing && form.lifestyle_notes && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Lifestyle</h4>
          <p className="text-xs text-gray-600">{form.lifestyle_notes}</p>
        </div>
      )}
    </div>
  )
}
