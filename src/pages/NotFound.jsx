import { Button } from '../components/ui.jsx'
import { asset } from '../lib/asset.js'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <img src={asset('design/lulav-esrog.png')} alt="" width="38" height="150" className="mx-auto h-[150px] w-auto" />
      <h1 className="mt-6 font-display text-3xl font-extrabold uppercase text-navy sm:text-4xl">Page not found</h1>
      <p className="mt-2 text-muted">This mission doesn’t exist.</p>
      <Button to="/" className="mt-6" variant="gold">Back to campaigns</Button>
    </div>
  )
}
