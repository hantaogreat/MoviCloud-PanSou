import { defineEventHandler, readBody, createError } from 'h3'

type PanEntry = { url?: string; password?: string; note?: string; datetime?: string; source?: string }
const driveCodes = new Set(['115', '123', 'uc', 'quark', 'xunlei'])
export default defineEventHandler(async (event) => {
  const body = await readBody<{ title?: string; mediaId?: number; type?: 'movie'|'tv' }>(event)
  const title = String(body?.title || '').trim().slice(0, 120)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  const base = (process.env.PANSOU_API_URL || 'http://127.0.0.1:8088').replace(/\/$/, '')
  // PanSou is configured by the NAS owner; never accept an arbitrary API URL from a browser.
  let response: any
  try {
    response = await $fetch(`${base}/api/search`, {
      method: 'POST', timeout: 45000,
      headers: { 'Content-Type': 'application/json', ...(process.env.PANSOU_API_TOKEN ? { Authorization: `Bearer ${process.env.PANSOU_API_TOKEN}` } : {}) },
      body: { kw: title, res: 'merge' }
    })
  } catch (error) {
    console.error('PanSou request failed:', error)
    throw createError({ statusCode: 502, statusMessage: 'PanSou search failed' })
  }
  const groups = response?.data?.merged_by_type || response?.merged_by_type || {}
  const resources: any[] = []
  const seen = new Set<string>()
  for (const [cloudDriveCode, entries] of Object.entries(groups)) {
    if (!Array.isArray(entries) || !driveCodes.has(cloudDriveCode)) continue
    for (const [index, raw] of (entries as PanEntry[]).entries()) {
      if (!raw?.url || !/^https?:\/\//i.test(raw.url)) continue
      const url = raw.url
      if (seen.has(url)) continue
      seen.add(url)
      const date = raw.datetime || new Date().toISOString()
      resources.push({
        id: -(resources.length + 1), mediaId: Number(body.mediaId) || 0,
        resourceType: 'original', cloudDriveCode,
        driveLink: url, resolution: '', fileSize: '', videoCodec: '', audioCodec: '',
        submitterId: 'pansou', status: 'approved', rating: 0, ratingCount: 0,
        createdAt: date, updatedAt: date, type: body.type === 'tv' ? 'tv' : 'movie',
        title: raw.note || title, source: raw.source || '', password: raw.password || ''
      })
    }
  }
  return { resources }
})
