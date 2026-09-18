// Every photo on one daily entry (older entries carry a single `photo`).
export function entryPhotos(s) {
  return s.photos?.length ? s.photos : s.photo ? [s.photo] : []
}

// The photos on an entry that may show publicly. The live API marks them per
// photo (`approvedPhotos`), since a day can hold approved photos and a newer
// pending one. Demo entries only have the whole-entry `photoApproved` flag.
export function approvedPhotos(s) {
  return s.approvedPhotos ?? (s.photoApproved ? entryPhotos(s) : [])
}

// The photos on an entry still waiting for an admin — what Approve publishes.
export function pendingPhotos(s) {
  const approved = approvedPhotos(s)
  return entryPhotos(s).filter((photo) => !approved.includes(photo))
}
