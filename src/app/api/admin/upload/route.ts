import { requireAdmin, requireCapability, type AdminCapability } from '@/lib/auth'
import { forbidden, ok, error, serverError } from '@/lib/api'
import { uploadFile, type UploadFolder } from '@/lib/storage'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const FOLDER_MAP: Record<string, UploadFolder> = {
  events:   'events',
  founders: 'founders',
  products: 'products',
  rewards:  'rewards',
  gallery:  'gallery',
  artists:  'artists',
}

// Which admin capability a given upload folder falls under — 'artists' photos are
// uploaded from within the Events editor (lineup management), so they gate on 'events' too.
const FOLDER_CAPABILITY: Record<string, AdminCapability> = {
  events:   'events',
  artists:  'events',
  founders: 'founders',
  products: 'store',
  rewards:  'rewards',
  gallery:  'gallery',
}

export async function POST(req: Request) {
  try {
    // Cheap reject before doing any body-parsing work — the specific folder (and therefore
    // the exact capability required) only becomes known after parsing the multipart body,
    // so this first check just rules out non-admins before we spend CPU/memory on that.
    const adminSession = await requireAdmin().catch(() => null)
    if (!adminSession) return forbidden()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderParam = (formData.get('folder') as string | null) ?? 'events'

    const capability = FOLDER_CAPABILITY[folderParam] ?? 'events'
    const session = await requireCapability(capability).catch(() => null)
    if (!session) return forbidden()

    if (!file) return error('file is required')
    if (!ALLOWED_TYPES.includes(file.type)) {
      return error(`Unsupported file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
    }
    if (file.size > MAX_SIZE_BYTES) {
      return error('File too large — maximum size is 10 MB')
    }

    const folder: UploadFolder = FOLDER_MAP[folderParam] ?? 'events'
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadFile(buffer, filename, folder, file.type)

    return ok({ url })
  } catch (e) {
    return serverError(e)
  }
}
