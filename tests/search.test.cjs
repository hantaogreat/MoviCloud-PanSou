const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript')
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function server(fetch) {
  let now = 1000
  const source = fs.readFileSync('server/api/pansou/search.post.ts', 'utf8').replace(/import .* from 'h3'/, '')
  const context = { exports: {}, process: { env: {} }, console: { error() {} }, Date: class extends Date { static now() { return now } },
    defineEventHandler: f => f, readBody: async e => e, createError: Object.assign.bind(null, new Error()), $fetch: fetch }
  vm.runInNewContext(compile(source), context)
  return { call: context.exports.default, advance: ms => { now += ms } }
}
const body = { title: '测试电影', mediaId: 1, type: 'movie' }
test('returns immediately, deduplicates in-flight requests, filters bad links and caches for 30 minutes', async () => {
  let finish, calls = 0
  const gate = new Promise(resolve => { finish = resolve })
  const app = server(async url => {
    calls++
    if (url.endsWith('/search')) { await gate; return { merged_by_type: { quark: [{ url: 'https://pan.quark.cn/s/ok' }, { url: 'https://pan.quark.cn/s/bad' }, { url: 'https://pan.quark.cn/s/ok' }] } } }
    return { results: [{ url: 'https://pan.quark.cn/s/ok', state: 'ok' }, { url: 'https://pan.quark.cn/s/bad', state: 'bad' }] }
  })
  assert.equal((await app.call(body)).status, 'searching')
  await app.call(body); assert.equal(calls, 1)
  finish(); await flush()
  let result = await app.call(body)
  assert.equal(result.status, 'done'); assert.equal(result.resources.length, 1)
  app.advance(30 * 60 * 1000 - 1); await app.call(body); assert.equal(calls, 2)
  app.advance(2); await app.call(body); assert.equal(calls, 3)
})
test('isolates movie, TV, media ID and season queries; empty results are cached', async () => {
  let calls = 0
  const app = server(async () => { calls++; return { merged_by_type: {} } })
  for (const query of [body, { ...body, type: 'tv' }, { ...body, mediaId: 2 }, { ...body, title: '测试电影 第1季' }]) { await app.call(query); await flush(); assert.equal((await app.call(query)).status, 'done') }
  assert.equal(calls, 4)
  assert.equal((await app.call(body)).resources.length, 0)
})
test('validation failure is explicit, never exposes unchecked links, and retries after short backoff', async () => {
  let calls = 0
  const app = server(async url => {
    calls++
    if (url.endsWith('/search')) return { merged_by_type: { uc: [{ url: 'https://drive.uc.cn/s/test' }] } }
    throw Error('checker unavailable')
  })
  await app.call(body); await flush()
  const result = await app.call(body)
  assert.equal(result.status, 'error'); assert.equal(result.resources.length, 0)
  await app.call(body); assert.equal(calls, 2)
  app.advance(5001); await app.call(body); assert.equal(calls, 3)
})
test('checks batches of 40 with at most four workers and publishes completed batches', async () => {
  let active = 0, peak = 0
  const gates = []
  const app = server(async (url, options) => {
    if (url.endsWith('/search')) return { merged_by_type: { quark: Array.from({ length: 201 }, (_, n) => ({ url: `https://pan.quark.cn/s/${n}` })) } }
    assert.ok(options.body.items.length <= 40)
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => gates.push(resolve)); active--
    return { results: options.body.items.map(item => ({ ...item, state: 'ok' })) }
  })
  await app.call(body); await flush(); assert.equal(peak, 4)
  gates.shift()(); await flush()
  const partial = await app.call(body)
  assert.equal(partial.status, 'checking'); assert.equal(partial.resources.length, 40)
  while (gates.length) { gates.shift()(); await flush() }
  assert.equal((await app.call(body)).resources.length, 201)
})
test('download opens before network completion, reuses prefetch and cache, ignores stale season response and stops on unmount', async () => {
  const page = fs.readFileSync('pages/[type]/[id].vue', 'utf8')
  const block = page.slice(page.indexOf('let resourceRequest'), page.indexOf('// 页面加载时获取数据'))
  const pending = [], timers = []
  let unmount
  const context = { exports: {}, Date, Map, title: { value: '测试电影' }, id: 1, type: 'tv',
    resourceList: { value: [] }, resourceLoading: { value: false }, resourceError: { value: '' }, showDownloadModal: { value: false },
    onUnmounted: fn => { unmount = fn }, setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout() {},
    $fetch: () => new Promise(resolve => pending.push(resolve)) }
  vm.runInNewContext(compile(block + '\nexports.api = { fetchResources, handleMovieDownload, downloadSeason }'), context)
  const api = context.exports.api
  api.fetchResources(); api.handleMovieDownload()
  assert.equal(context.showDownloadModal.value, true); assert.equal(pending.length, 1)
  pending.shift()({ status: 'done', resources: [{ id: 1 }], expiresAt: Date.now() + 1800000 }); await flush()
  api.handleMovieDownload(); assert.equal(pending.length, 0); assert.equal(context.resourceList.value[0].id, 1)
  api.downloadSeason(1); api.downloadSeason(2)
  pending.shift()({ status: 'done', resources: [{ id: 2 }], expiresAt: Date.now() + 1800000 }); await flush()
  assert.equal(context.resourceList.value.length, 0)
  pending.shift()({ status: 'checking', resources: [{ id: 3 }] }); await flush()
  assert.equal(context.resourceList.value[0].id, 3)
  unmount(); await timers[0]();
  // A cleared timer is not invoked by the browser; any late network response is ignored.
  if (pending.length) { pending.shift()({ status: 'done', resources: [{ id: 9 }] }); await flush() }
  assert.equal(context.resourceList.value[0].id, 3)
})
