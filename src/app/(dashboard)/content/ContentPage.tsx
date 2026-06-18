'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles, RefreshCw, Copy, Check, Trash2,
  ChevronDown, ChevronUp, History, PenSquare,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type GenerateResult = { instagram: string; tiktok: string; whatsapp: string; hashtags: string[] }
type RawHistoryItem = { id: string; created_at: string; prompt: string; response: string | null }
type HistoryItem = {
  id: string; created_at: string
  type: string; mood: string; context: string
  result: GenerateResult | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  { id: 'caption_foto',  emoji: '📸', label: 'Caption Foto Kelas',    desc: 'Untuk foto saat kelas berlangsung' },
  { id: 'caption_video', emoji: '🎬', label: 'Caption Video / Reels', desc: 'Hook kuat untuk video pendek'      },
  { id: 'quote',         emoji: '✨', label: 'Quote Motivasi',         desc: 'Quotes inspiratif fitness'         },
  { id: 'promosi_event', emoji: '⚡', label: 'Promosi Event',          desc: 'Umumkan event mendatang'           },
]

const MOODS = [
  { id: 'semangat',   emoji: '💪', label: 'Semangat'   },
  { id: 'hangat',     emoji: '😊', label: 'Hangat'     },
  { id: 'inspiratif', emoji: '✨', label: 'Inspiratif' },
  { id: 'santai',     emoji: '😄', label: 'Santai'     },
]

const LOADING_TEXTS = [
  'Lagi mikirin caption yang bagus...',
  'Nyari kata-kata yang tepat...',
  'Hampir selesai! ✨',
]

const RESULT_CARDS = [
  { key: 'instagram', emoji: '📸', label: 'Instagram Feed',  from: '#7C3AED', to: '#6D28D9' },
  { key: 'tiktok',    emoji: '🎬', label: 'TikTok / Reels', from: '#E11D48', to: '#BE123C' },
  { key: 'whatsapp',  emoji: '💬', label: 'WhatsApp Story', from: '#059669', to: '#047857' },
]

const TYPE_LABELS: Record<string, string> = {
  caption_foto:  'Caption Foto',
  caption_video: 'Caption Video',
  quote:         'Quote Motivasi',
  promosi_event: 'Promosi Event',
}

const MOOD_EMOJIS: Record<string, string> = {
  semangat: '💪', hangat: '😊', inspiratif: '✨', santai: '😄',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseHistory(raw: RawHistoryItem[]): HistoryItem[] {
  return raw.map(item => {
    let parsed = { type: '', mood: '', context: '' }
    let result: GenerateResult | null = null
    try { parsed = JSON.parse(item.prompt)          } catch { /* ignore */ }
    try { if (item.response) result = JSON.parse(item.response) } catch { /* ignore */ }
    return { id: item.id, created_at: item.created_at, ...parsed, result }
  })
}

function formatHashtag(tag: string) {
  return tag.startsWith('#') ? tag : `#${tag}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ContentPage({ initialHistory }: { initialHistory: RawHistoryItem[] }) {
  const [tab,          setTab         ] = useState<'generate' | 'history'>('generate')
  const [selType,      setSelType     ] = useState<string | null>(null)
  const [selMood,      setSelMood     ] = useState<string | null>(null)
  const [context,      setContext     ] = useState('')
  const [loading,      setLoading     ] = useState(false)
  const [loadingText,  setLoadingText ] = useState(LOADING_TEXTS[0])
  const [result,       setResult      ] = useState<GenerateResult | null>(null)
  const [rawHistory,   setRawHistory  ] = useState<RawHistoryItem[]>(initialHistory)
  const [copied,       setCopied      ] = useState<Record<string, boolean>>({})
  const [expandedId,   setExpandedId  ] = useState<string | null>(null)

  const history = parseHistory(rawHistory)

  // Cycle loading text while generating
  useEffect(() => {
    if (!loading) return
    let idx = 0
    const timer = setInterval(() => {
      idx = (idx + 1) % LOADING_TEXTS.length
      setLoadingText(LOADING_TEXTS[idx])
    }, 1500)
    return () => clearInterval(timer)
  }, [loading])

  function handleCopy(key: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(p => ({ ...p, [key]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000)
  }

  function handleCopyHashtags(hashtags: string[], prefix = '') {
    handleCopy(`${prefix}hashtags`, hashtags.map(formatHashtag).join(' '))
  }

  async function generate() {
    if (!selType || !selMood || loading) return
    setLoading(true)
    setResult(null)
    setLoadingText(LOADING_TEXTS[0])
    try {
      const res  = await fetch('/api/ai/generate-content', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: selType, mood: selMood, context }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
      if (data.historyItem) setRawHistory(p => [data.historyItem, ...p.slice(0, 9)])
    } catch (err: unknown) {
      alert('Gagal generate: ' + (err instanceof Error ? err.message : 'Coba lagi'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(id: string) {
    await fetch(`/api/ai/generate-content?id=${id}`, { method: 'DELETE' })
    setRawHistory(p => p.filter(h => h.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const canGenerate = Boolean(selType && selMood && !loading)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Buat Konten</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Generate caption untuk semua platform dalam sekali klik ✨
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
        {([
          { id: 'generate', icon: PenSquare, label: 'Buat Baru' },
          { id: 'history',  icon: History,   label: 'Riwayat'   },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {id === 'history' && history.length > 0 && (
              <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {history.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── GENERATE TAB ───────────────────────────────────────────────────── */}
      {tab === 'generate' && (
        <div className="space-y-6">

          {/* Step 1 - jenis konten */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Step 1 - Pilih jenis konten
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => { setSelType(ct.id); setResult(null) }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all hover:border-violet-300 ${
                    selType === ct.id
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-gray-100 bg-white shadow-sm'
                  }`}
                >
                  <div className="text-2xl mb-2">{ct.emoji}</div>
                  <div className={`text-sm font-semibold leading-tight mb-1 ${
                    selType === ct.id ? 'text-violet-700' : 'text-gray-800'
                  }`}>{ct.label}</div>
                  <div className="text-xs text-gray-400 leading-snug">{ct.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 - mood (muncul setelah step 1) */}
          {selType && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Step 2 - Pilih mood
              </p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelMood(m.id); setResult(null) }}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      selMood === m.id
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200'
                        : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 bg-white'
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 - konteks opsional (muncul setelah step 2) */}
          {selMood && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Step 3 - Ceritain sedikit{' '}
                <span className="normal-case font-normal text-gray-300">(opsional)</span>
              </p>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={3}
                placeholder={
                  'Contoh: kelas barre tadi 15 orang, ada member baru, ' +
                  'semua semangat banget... atau kosongkan saja!'
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Step 4 - generate button (muncul setelah step 2) */}
          {selMood && (
            <div>
              <button
                onClick={generate}
                disabled={!canGenerate}
                className={`w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                  canGenerate
                    ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-700 hover:to-violet-600 shadow-lg shadow-violet-200 active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                Generate Sekarang
              </button>
              <p className="text-center text-xs text-gray-300 mt-2">
                Menggunakan AI Claude · ~5 detik
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 text-center">{loadingText}</p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Hasil Generate ✨
              </p>

              {/* Platform cards */}
              {RESULT_CARDS.map(card => {
                const text    = result[card.key as keyof GenerateResult] as string
                const copyKey = `res-${card.key}`
                return (
                  <div key={card.key} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <div
                      className="px-5 py-3 flex items-center gap-2"
                      style={{ background: `linear-gradient(to right, ${card.from}, ${card.to})` }}
                    >
                      <span className="text-lg">{card.emoji}</span>
                      <span className="text-sm font-bold text-white">{card.label}</span>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-[1.8]">{text}</p>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                        <span className="text-xs text-gray-300">{text.length} karakter</span>
                        <button
                          onClick={() => handleCopy(copyKey, text)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            copied[copyKey]
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-gray-50 text-gray-500 hover:bg-violet-50 hover:text-violet-600'
                          }`}
                        >
                          {copied[copyKey] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied[copyKey] ? 'Tersalin! ✓' : 'Salin'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Hashtag card */}
              {result.hashtags?.length > 0 && (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="px-5 py-3 bg-indigo-600 flex items-center gap-2">
                    <span className="text-lg">#️⃣</span>
                    <span className="text-sm font-bold text-white">Hashtag (salin semuanya)</span>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap gap-1.5">
                      {result.hashtags.map((tag, i) => (
                        <span key={i} className="text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {formatHashtag(tag)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => handleCopyHashtags(result.hashtags)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          copied['hashtags']
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                      >
                        {copied['hashtags'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied['hashtags'] ? 'Tersalin! ✓' : 'Salin Semua Hashtag'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Regenerate */}
              <button
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Generate Ulang
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-300">
              <History className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm text-gray-400 mb-1">Belum ada riwayat generate konten.</p>
              <button
                onClick={() => setTab('generate')}
                className="text-violet-600 text-sm font-medium hover:underline"
              >
                Buat konten pertama kamu →
              </button>
            </div>
          ) : (
            history.map(item => {
              const isExp     = expandedId === item.id
              const preview   = item.result?.instagram
                ? item.result.instagram.split('\n').filter(Boolean).slice(0, 2).join(' ')
                : '-'
              const typeLabel = TYPE_LABELS[item.type] ?? item.type
              const moodEmoji = MOOD_EMOJIS[item.mood] ?? ''
              const date      = new Date(item.created_at).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Row */}
                  <div className="px-4 py-3.5 flex items-start gap-3">
                    <button
                      onClick={() => setExpandedId(isExp ? null : item.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                          {typeLabel}
                        </span>
                        <span className="text-[11px] text-gray-400">{moodEmoji} {item.mood}</span>
                        <span className="text-[11px] text-gray-300">{date}</span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 leading-snug">{preview}</p>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExp ? null : item.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 transition-all"
                      >
                        {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExp && item.result && (
                    <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-2.5">
                      {RESULT_CARDS.map(card => {
                        const text    = item.result![card.key as keyof GenerateResult] as string
                        const copyKey = `hist-${item.id}-${card.key}`
                        return (
                          <div key={card.key} className="rounded-xl overflow-hidden border border-gray-100">
                            <div
                              className="px-4 py-2 flex items-center justify-between"
                              style={{ background: `linear-gradient(to right, ${card.from}, ${card.to})` }}
                            >
                              <span className="text-xs font-bold text-white">{card.emoji} {card.label}</span>
                              <button
                                onClick={() => handleCopy(copyKey, text)}
                                className="flex items-center gap-1 text-white/80 hover:text-white text-xs font-medium transition-colors"
                              >
                                {copied[copyKey] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied[copyKey] ? 'Tersalin!' : 'Salin'}
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 p-3 whitespace-pre-wrap leading-relaxed">{text}</p>
                          </div>
                        )
                      })}

                      {item.result.hashtags?.length > 0 && (
                        <div className="p-3 bg-indigo-50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-indigo-700">#️⃣ Hashtag</span>
                            <button
                              onClick={() => handleCopyHashtags(item.result!.hashtags, `hist-${item.id}-`)}
                              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                                copied[`hist-${item.id}-hashtags`] ? 'text-emerald-600' : 'text-indigo-600'
                              }`}
                            >
                              {copied[`hist-${item.id}-hashtags`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              Salin semua
                            </button>
                          </div>
                          <p className="text-xs text-indigo-600 leading-relaxed">
                            {item.result.hashtags.map(formatHashtag).join(' ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
