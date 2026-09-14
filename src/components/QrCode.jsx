import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// QR modules in brand navy (mirrors --color-navy in src/index.css).
function navy() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-navy').trim() || '#001c4c'
  } catch {
    return '#001c4c'
  }
}

// Renders a QR code for a URL as an <img>.
export default function QrCode({ value, size = 220, className = '' }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: navy(), light: '#ffffff' },
    }).then((d) => { if (alive) setSrc(d) }).catch(() => {})
    return () => { alive = false }
  }, [value, size])

  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-track ${className}`} />
  return <img src={src} width={size} height={size} alt="QR code" className={`rounded-xl ${className}`} />
}
