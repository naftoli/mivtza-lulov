import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modal behaviour for an overlay dialog: Escape closes it, focus moves into it
// on open and back to whatever opened it on close, and Tab / Shift+Tab stay
// inside it. `ref` is the dialog element — give it tabIndex={-1} so it can take
// focus itself when it has nothing focusable. `onClose` is read through a ref, so
// an inline arrow doesn't re-run the effect (and yank focus back) on every render.
export function useDialog(ref, onClose, open = true) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return undefined
    const opener = document.activeElement
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)]
    ;(focusables()[0] || dialog).focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) { e.preventDefault(); dialog.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const outside = !dialog.contains(document.activeElement)
      if (e.shiftKey && (outside || document.activeElement === first)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (outside || document.activeElement === last)) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, [open, ref])
}
