import { defineEventHandler, readBody, createError } from 'h3'

type PanEntry = { url?: string; password?: string; note?: string; datetime?: string; source?: string }

// PanSou does not expose structured file metadata. Best-effort hints from link notes
// must be treated as unverified filename/title claims, not verified file properties.
const metadataFromNote = (note: string) => {
  const s = note.slice(0, 400)
  const match = s.match(/(?:^|[^\d])((?:\d+(?:\.\d+)?)\s*(?:TiB|GiB|MiB|TB|GB|MB))(?![a-z])/i)
  const resolution = /(?:^|\W)(?:8k|4320p)(?=\W|$)/i.test(s) ? '8k'
    : /(?:^|\W)(?:4k|2160p|UHD)(?=\W|$)/i.test(s) ? '4k'
    : /(?:^|\W)1080p(?=\W|$)/i.test(s) ? '1080p'
    : /(?:^|\W)1080i(?=\W|$)/i.test(s) ? '1080i'
    : /(?:^|\W)720p(?=\W|$)/i.test(s) ? '720p' : ''
  const videoCodec = /(?:^|[^a-z0-9])(?:h[.\- ]?265|x265|hevc)(?=[^a-z0-9]|$)/i.test(s) ? 'h265'
    : /(?:^|[^a-z0-9])(?:h[.\- ]?264|x264|avc)(?=[^a-z0-9]|$)/i.test(s) ? 'h264'
    : /(?:^|[^a-z0-9])av1(?=[^a-z0-9]|$)/i.test(s) ? 'av1' : ''
  const audioCodec = /(?:^|[^a-z0-9])dts[.\- ]?hd(?=[^a-z0-9]|$)/i.test(s) ? 'dtshd'
    : /(?:^|[^a-z0-9])dts(?=[^a-z0-9]|$)/i.test(s) ? 'dts'
    : /(?:^|[^a-z0-9])(?:e[.\- ]?ac3|ddp)(?=[^a-z0-9]|$)/i.test(s) ? 'eac3'
    : /(?:^|[^a-z0-9])(?:ac3|dd)(?=[^a-z0-9]|$)/i.test(s) ? 'ac3'
    : /(?:^|[^a-z0-9])aac(?=[^a-z0-9]|$)/i.test(s) ? 'aac'
    : /(?:^|[^a-z0-9])truehd(?=[^a-z0-9]|$)/i.test(s) ? 'truehd' : ''
  return { fileSize: match?.[1]?.replace(/\s+/g, '') || '', resolution, videoCodec, audioCodec }
}

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
      const inferred = metadataFromNote(String(raw.note || ''))
      resources.push({
        id: -(resources.length + 1), mediaId: Number(body.mediaId) || 0,
        resourceType: 'original', cloudDriveCode,
        driveLink: url, ...inferred, metadataSource: 'title_inferred',
        submitterId: 'pansou', status: 'approved', rating: null, ratingCount: null,
        createdAt: date, updatedAt: date, type: body.type === 'tv' ? 'tv' : 'movie',
        title: raw.note || title, source: raw.source || '', password: raw.password || ''
      })
    }
  }
  return { resources }
})
