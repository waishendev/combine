import { createPortal, type ReactNode } from 'react-dom'

export function getPosBodyModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector('[data-pos-body-modals]')
}

export function renderPosBodyModalPortal(node: ReactNode, root?: HTMLElement | null) {
  if (!node || typeof document === 'undefined') return null
  const target = root ?? getPosBodyModalRoot() ?? document.body
  return createPortal(node, target)
}
