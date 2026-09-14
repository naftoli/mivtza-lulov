// Resolve a file from public/ under the deploy sub-path.
// The site is served at /mivtzoim/lulav/ (vite.config.js `base`), so nothing
// may hard-code a root-absolute path like "/th-logo.svg" — always go through
// asset('th-logo.svg') / asset('design/hero-city.jpg').
// import.meta.env.BASE_URL always ends with "/", so a leading slash is dropped.
export const asset = (name) => import.meta.env.BASE_URL + String(name).replace(/^\/+/, '')
