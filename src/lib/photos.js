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

// The pending photos with the id the API gave each one, so a moderator can act
// on a single photo. Demo entries carry no ids, so `id` is null there and the
// per-photo controls stay hidden.
export function pendingPhotoItems(s) {
  const approved = approvedPhotos(s)
  return entryPhotos(s)
    .map((photo, i) => ({ photo, id: s.photoIds?.[i] ?? null }))
    .filter((item) => !approved.includes(item.photo))
}
