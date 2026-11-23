import { nextTick, onUnmounted, toValue, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const activeDialogStack = []

/**
 * Collect visible, keyboard-focusable elements inside a dialog container.
 */
export function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false
    if (el.getClientRects().length === 0) return false
    return window.getComputedStyle(el).visibility !== 'hidden'
  })
}

/**
 * Trap Tab and Shift+Tab navigation strictly inside the given dialog container.
 */
export function trapFocusKeydown(e, container) {
  if (e.key !== 'Tab' || !container) return
  const focusables = getFocusableElements(container)
  if (focusables.length === 0) {
    e.preventDefault()
    if (document.activeElement !== container) container.focus()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  const isInside = container.contains(active)

  if (e.shiftKey) {
    if (!isInside || active === first || active === container) {
      e.preventDefault()
      last.focus()
    }
  } else if (!isInside || active === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Manage initial focus, nested-safe focus trapping, and focus restoration for dialogs.
 */
export function useDialogFocus(isOpenSource, containerRef) {
  let previousFocus = null

  function focusContainerFirst() {
    const container = containerRef.value
    if (!container) return
    const focusables = getFocusableElements(container)
    ;(focusables[0] || container).focus()
  }

  const entry = {
    focusFallback: focusContainerFirst,
    handleKeyDown(e) {
      if (activeDialogStack[activeDialogStack.length - 1] !== entry) return
      trapFocusKeydown(e, containerRef.value)
    }
  }

  async function activate() {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!activeDialogStack.includes(entry)) activeDialogStack.push(entry)
    document.addEventListener('keydown', entry.handleKeyDown, true)
    await nextTick()
    if (!activeDialogStack.includes(entry)) return
    focusContainerFirst()
  }

  async function deactivate({ restore = true } = {}) {
    const idx = activeDialogStack.indexOf(entry)
    if (idx !== -1) activeDialogStack.splice(idx, 1)
    document.removeEventListener('keydown', entry.handleKeyDown, true)
    const target = previousFocus
    previousFocus = null
    if (!restore) return
    await nextTick()
    if (toValue(isOpenSource)) return
    if (target && target.isConnected && typeof target.focus === 'function') {
      target.focus()
    } else {
      activeDialogStack[activeDialogStack.length - 1]?.focusFallback?.()
    }
  }

  watch(isOpenSource, (open, prevOpen) => {
    if (open && !prevOpen) activate()
    else if (!open && prevOpen) deactivate({ restore: true })
  }, { immediate: true })

  onUnmounted(() => deactivate({ restore: false }))
}
