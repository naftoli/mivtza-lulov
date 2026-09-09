// Tiny Web-Audio "chime" for logging feedback — no audio files needed.
// Respects a per-viewer mute flag.
let ctx

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  }
  return ctx
}

export function isMuted() {
  try { return localStorage.getItem('ml_sound_muted') === '1' } catch { return false }
}
export function setMuted(v) {
  try { localStorage.setItem('ml_sound_muted', v ? '1' : '0') } catch { /* ignore */ }
}

// A happy rising 3-note sparkle.
export function playShake() {
  if (isMuted()) return
  try {
    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') c.resume()
    const now = c.currentTime
    ;[[660, 0], [880, 0.08], [1320, 0.16]].forEach(([freq, t]) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + t)
      gain.gain.exponentialRampToValueAtTime(0.16, now + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22)
      osc.connect(gain).connect(c.destination)
      osc.start(now + t)
      osc.stop(now + t + 0.24)
    })
  } catch { /* audio not available */ }
}
