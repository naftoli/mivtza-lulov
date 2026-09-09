import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Renders a QR code for a URL as an <img>.
export default function QrCode({ value, size = 220, className = '' }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#2c3f20', light: '#ffffff' },
    }).then((d) => { if (alive) setSrc(d) }).catch(() => {})
    return () => { alive = false }
  }, [value, size])

  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded-lg bg-track ${className}`} />
  return <img src={src} width={size} height={size} alt="QR code" className={`rounded-lg ${className}`} />
}
