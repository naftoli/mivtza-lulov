import { Button } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-6xl">🌿</div>
      <h1 className="mt-4 font-display text-3xl font-medium text-navy">Page not found</h1>
      <p className="mt-2 text-muted">This mission doesn’t exist.</p>
      <Button to="/" className="mt-6" variant="navy">Back to campaigns</Button>
    </div>
  )
}
