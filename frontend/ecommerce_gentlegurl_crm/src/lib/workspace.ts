export type Workspace = 'ecommerce' | 'booking'

const WORKSPACE_KEY = 'crm_workspace'
const DEFAULT_WORKSPACE: Workspace = 'ecommerce'

const isWorkspace = (value: string | null | undefined): value is Workspace =>
  value === 'ecommerce' || value === 'booking'

const readWorkspaceCookie = (): Workspace | null => {
  if (typeof document === 'undefined') return null

  const cookieValue = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WORKSPACE_KEY}=`))
    ?.split('=')[1]

  if (!cookieValue) return null

  try {
    const decoded = decodeURIComponent(cookieValue)
    return isWorkspace(decoded) ? decoded : null
  } catch {
    return null
  }
}

const dispatchWorkspaceChanged = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('crm_workspace_changed'))
}

export function getWorkspace(): Workspace {
  if (typeof window === 'undefined') {
    return DEFAULT_WORKSPACE
  }

  const cookieWorkspace = readWorkspaceCookie()
  if (cookieWorkspace) {
    return cookieWorkspace
  }

  const storageWorkspace = window.localStorage.getItem(WORKSPACE_KEY)
  if (isWorkspace(storageWorkspace)) {
    return storageWorkspace
  }

  return DEFAULT_WORKSPACE
}

export function setWorkspace(ws: Workspace): void {
  if (typeof window === 'undefined') return

  const encoded = encodeURIComponent(ws)
  document.cookie = `${WORKSPACE_KEY}=${encoded}; path=/; max-age=31536000`
  window.localStorage.setItem(WORKSPACE_KEY, ws)
  dispatchWorkspaceChanged()
}

export function getWorkspaceLanding(ws: Workspace): string {
  if (ws === 'booking') {
    return '/booking/reports'
  }

  return '/dashboard'
}
