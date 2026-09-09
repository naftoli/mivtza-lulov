import confetti from 'canvas-confetti'

export function celebrate(power = 1) {
  const count = 120 * power
  const colors = ['#e6b422', '#5c7f3a', '#375024', '#f7d774', '#ffffff']
  confetti({ particleCount: count * 0.4, spread: 70, origin: { y: 0.6 }, colors })
  confetti({ particleCount: count * 0.3, spread: 100, startVelocity: 45, origin: { y: 0.6 }, colors })
  setTimeout(() => {
    confetti({ particleCount: count * 0.3, angle: 60, spread: 80, origin: { x: 0, y: 0.7 }, colors })
    confetti({ particleCount: count * 0.3, angle: 120, spread: 80, origin: { x: 1, y: 0.7 }, colors })
  }, 200)
}
