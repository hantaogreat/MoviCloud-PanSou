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
type Job = { resources: any[]; status: 'searching' | 'checking' | 'done' | 'partial' | 'error'; expires: number; error?: string; summary?: { total: number; checked: number; invalid: number; uncertain: number; failed: number } }
const jobs = new Map<string, Job>()
const ttl = 30 * 60 * 1000
// Bound checker traffic across all films, rather than four new workers per page.
let activeChecks = 0
const checkQueue: Array<() => void> = []
const withCheckSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeChecks >= 4) await new Promise<void>(resolve => checkQueue.push(resolve))
  else activeChecks++
  try { return await task() } finally {
    const next = checkQueue.shift()
    if (next) next()
    else activeChecks--
  }
}
const run = async (body: any, title: string, job: Job) => {
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
  job.status = 'checking'
  job.summary = { total: resources.length, checked: 0, invalid: 0, uncertain: 0, failed: 0 }
  // Only confirmed-valid share links are shown. The PanSou check API is required:
  // unsupported/locked/uncertain links are not treated as valid.
  const batchSize = 8
  const batches: any[][] = []
  for (let i = 0; i < resources.length; i += batchSize) batches.push(resources.slice(i, i + batchSize))

  // Slow links can legitimately take 15 seconds. Do not let one failed batch
  // cancel unrelated results, and do not turn unchecked links into valid ones.
  const validUrls = new Set<string>()
  let nextBatch = 0
  const deadline = Date.now() + 120000
  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++]
      try {
        const report: any = await withCheckSlot(async () => {
          if (Date.now() >= deadline) throw new Error('Link check budget exceeded')
          return await $fetch(`${base}/api/check/links`, {
            method: 'POST',
            timeout: Math.min(45000, deadline - Date.now()),
            retry: 0,
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.PANSOU_API_TOKEN ? { Authorization: `Bearer ${process.env.PANSOU_API_TOKEN}` } : {})
            },
            body: {
              items: batch.map(item => ({
                disk_type: item.cloudDriveCode,
                url: item.driveLink,
                password: item.password || ''
              }))
            }
          })
        })
        const results = report?.results || report?.data?.results
        if (!Array.isArray(results)) throw new Error('Invalid PanSou link-check response')
        const reported = new Set<string>()
        for (const item of results) {
          const original = batch.find(resource => resource.driveLink === item?.url)
          if (!original || reported.has(original.driveLink)) continue
          reported.add(original.driveLink)
          if (item.state === 'ok') validUrls.add(original.driveLink)
          else if (item.state === 'bad') job.summary!.invalid++
          else job.summary!.uncertain++
        }
        job.summary!.checked += reported.size
        job.summary!.uncertain += batch.length - reported.size
        job.resources = resources.filter(item => validUrls.has(item.driveLink))
      } catch (error) {
        job.summary!.failed += batch.length
        const cause: any = error
        console.error('PanSou link batch failed:', { count: batch.length, status: cause?.statusCode || 0, cause: cause?.cause?.name || cause?.name || 'Error' })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, batches.length) }, () => worker()))
  if (job.summary.failed) {
    job.error = validUrls.size
      ? '部分链接验证超时或失败，已显示确认有效的结果；可稍后重试'
      : '资源搜索已完成，但链接验证超时或失败，尚未确认有效资源，请稍后重试'
  }
  return resources.filter(item => validUrls.has(item.driveLink))
}
export default defineEventHandler(async (event) => {
  const body = await readBody<{ title?: string; mediaId?: number; type?: 'movie'|'tv' }>(event)
  const title = String(body?.title || '').trim().slice(0, 120)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  const key = JSON.stringify([body.type === 'tv' ? 'tv' : 'movie', Number(body.mediaId) || 0, title])
  const now = Date.now()
  for (const [k, j] of jobs) if (j.expires <= now) jobs.delete(k)
  let job = jobs.get(key)
  if (!job) {
    if (jobs.size >= 100) throw createError({ statusCode: 503, statusMessage: 'Search cache busy' })
    job = { resources: [], status: 'searching', expires: now + ttl }
    jobs.set(key, job)
    const current = job
    // Retain the job before starting work, so concurrent prefetch/clicks share it.
    void run(body, title, current).then(resources => {
      current.resources = resources
      current.status = current.summary?.failed ? (resources.length ? 'partial' : 'error') : 'done'
      current.expires = Date.now() + (current.summary?.failed ? 5000 : current.summary?.uncertain ? 60000 : ttl)
    }).catch(() => {
      current.status = 'error'
      current.error = '资源搜索服务请求失败或超时，请稍后重试'
      current.expires = Date.now() + 5000
    })
  }
  return { resources: job.resources, status: job.status, error: job.error, expiresAt: job.expires, summary: job.summary }
})
