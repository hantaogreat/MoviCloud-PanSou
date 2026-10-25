<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from '../volt/Dialog.vue'
import type { CloudDriveAccountInfo } from '../composables/useCloudDriveAccounts'
import type { CloudDriveAccount } from '../composables/useCloudFileManagement'
import { useCloudFileManagement } from '../composables/useCloudFileManagement'

const props = defineProps<{
  visible: boolean
  shareUrl: string
  driveCode: string
  accounts: CloudDriveAccountInfo[]
}>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()
const api = useCloudFileManagement()
const accounts = computed(() => props.accounts.filter(x => x.isValid && !!x.cookie))
const accountIndex = ref(0)
const files = ref<any[]>([])
const error = ref('')
const busy = ref(false)
const ready = ref(false)
const pwdID = ref('')
const stoken = ref('')
const folderTrail = ref<{ id: string; name: string }[]>([{ id: '0', name: '根目录' }])
const filename = (f: any) => String(f.file_name || f.name || '未命名文件')
const isFolder = (f: any) => f.dir === true || f.dir === 1 || f.dir === '1' || f.file_type === 'folder'
const sizeText = (f: any) => {
  if (isFolder(f)) return '文件夹'
  const n = Number(f.size)
  if (!Number.isFinite(n) || n < 0 || f.size == null) return '大小未知'
  return n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB'
    : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB'
    : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B'
}
const asAccount = (a: CloudDriveAccountInfo): CloudDriveAccount => ({
  id: a.driveCode, name: a.name, cookie: a.cookie || '', driveCode: a.driveCode
})
let generation = 0
watch(() => props.visible, v => {
  generation++
  if (v) {
    accountIndex.value = 0
    files.value = []
    ready.value = false
    error.value = ''
    busy.value = false
    pwdID.value = ''
    stoken.value = ''
    folderTrail.value = [{ id: '0', name: '根目录' }]
  }
})
const close = () => emit('update:visible', false)
const loadFolder = async (id: string, trail: { id: string; name: string }[]) => {
  const a = accounts.value[accountIndex.value]
  if (!a || !pwdID.value || !stoken.value) return
  const generationAtStart = generation
  busy.value = true
  error.value = ''
  try {
    const result = await api.getShareList(asAccount(a), pwdID.value, stoken.value, id, 1, 100)
    if (generationAtStart !== generation) return
    if (!result.success) throw new Error(result.message || '无法读取文件列表')
    files.value = Array.isArray(result.data?.list) ? result.data.list : []
    folderTrail.value = trail
    ready.value = true
  } catch (e: any) {
    if (generationAtStart === generation) error.value = e?.message || '读取文件列表失败'
  } finally {
    if (generationAtStart === generation) busy.value = false
  }
}
const inspect = async () => {
  const a = accounts.value[accountIndex.value]
  if (!a) { error.value = '需要先登录对应的夸克或 UC 网盘账号'; return }
  const generationAtStart = ++generation
  files.value = []
  ready.value = false
  error.value = ''
  busy.value = true
  try {
    const info = await api.getShareInfo(props.driveCode, props.shareUrl)
    if (!info.success || !info.data?.pwd_id) throw new Error(info.message || '无法解析分享链接')
    const token = await api.getShareStoken(asAccount(a), info.data.pwd_id, info.data.passcode || '')
    if (!token.success || !token.data?.stoken) throw new Error(token.message || '无法获取分享访问令牌')
    if (generationAtStart !== generation) return
    pwdID.value = info.data.pwd_id
    stoken.value = token.data.stoken
    await loadFolder('0', [{ id: '0', name: '根目录' }])
  } catch (e: any) {
    if (generationAtStart === generation) error.value = e?.message || '获取分享详情失败'
  } finally {
    if (generationAtStart === generation && !ready.value) busy.value = false
  }
}
const openFolder = async (file: any) => {
  if (!isFolder(file) || !file.fid || busy.value) return
  await loadFolder(String(file.fid), [...folderTrail.value, { id: String(file.fid), name: filename(file) }])
}
const back = async () => {
  if (folderTrail.value.length < 2 || busy.value) return
  const next = folderTrail.value.slice(0, -1)
  await loadFolder(next[next.length - 1].id, next)
}
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)"
    header="分享文件详情（夸克 / UC）" modal class="w-11/12 md:w-[660px]">
    <div class="space-y-3">
      <p class="text-sm text-gray-500">文件名、大小来自分享目录接口；画质和编码仍需依据文件名或实际媒体检测判断。</p>
      <div v-if="!accounts.length" class="text-amber-600">尚无可用网盘账号，请先在网盘管理中登录对应账号。</div>
      <div v-else class="flex flex-wrap items-center gap-2">
        <select v-model.number="accountIndex" class="rounded border px-2 py-2">
          <option v-for="(account, i) in accounts" :key="i" :value="i">{{ account.name }} {{ account.nickname || '' }}</option>
        </select>
        <button type="button" class="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          :disabled="busy" @click="inspect">{{ busy ? '正在读取…' : '读取真实文件列表' }}</button>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div v-if="ready">
        <div class="flex items-center gap-2 text-sm">
          <button v-if="folderTrail.length > 1" type="button" class="text-blue-600" :disabled="busy" @click="back">返回上级</button>
          <span class="truncate">{{ folderTrail.map(x => x.name).join(' / ') }}</span>
        </div>
        <div v-if="!files.length" class="py-4 text-gray-500">此层没有返回文件。</div>
        <div v-for="file in files" :key="String(file.fid || file.file_name)"
          class="flex items-center justify-between gap-3 border-b py-2">
          <button type="button" class="min-w-0 flex-1 truncate text-left"
            :class="isFolder(file) ? 'text-blue-600' : ''"
            :disabled="!isFolder(file) || busy" @click="openFolder(file)">
            {{ isFolder(file) ? '📁 ' : '📄 ' }}{{ filename(file) }}
          </button>
          <span class="shrink-0 text-xs text-gray-500">{{ sizeText(file) }}</span>
        </div>
        <p class="text-xs text-gray-500">每层最多显示 100 项；仅按需查询，不自动下载媒体文件。</p>
      </div>
      <div class="flex justify-end">
        <button type="button" class="rounded border px-3 py-2" @click="close">关闭</button>
      </div>
    </div>
  </Dialog>
</template>
