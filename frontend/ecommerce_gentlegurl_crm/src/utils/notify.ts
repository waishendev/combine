export type NotifyIcon = 'success' | 'error' | 'warning' | 'info'

export function swalWithComfirmButton(title: string, message: string, _icon?: NotifyIcon) {
  if (typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`)
  }
}
