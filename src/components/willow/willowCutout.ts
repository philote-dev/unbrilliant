/**
 * Runtime "cutout" of a mastery-willow frame: removes the baked light paper and
 * brightens the watercolor so the tree can sit directly on the dark theme instead
 * of inside a light plate.
 *
 * The art is pale, translucent watercolor painted for a light ground, so cutting
 * it onto near-black is a deliberate trade: it gains contrast (no light box) but
 * loses some of the airy paper glow. See the gallery's "Dark mode: two options".
 *
 * Each of the seven frames is static, so a keyed result is cached per src and
 * computed at most once per session. Browser-only (uses <canvas>).
 */

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/**
 * Resolve a transparent, brightened PNG data URL for one willow frame. The key:
 * a pixel is "paper" when it is light and low-chroma, so alpha is driven by
 * darkness (the trunk) or chroma (the colored leaves); the near-white floor is
 * removed so the paper drops out cleanly, then the remaining art is lifted toward
 * white so the pale canopy still reads on near-black.
 */
export function keyWillowFrame(src: string): Promise<string> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  const inflight = pending.get(src)
  if (inflight) return inflight

  const job = new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("2d canvas context unavailable")
        ctx.drawImage(img, 0, 0)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d = frame.data
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255
          const g = d[i + 1] / 255
          const b = d[i + 2] / 255
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const lightness = (max + min) / 2
          const chroma = max - min
          let alpha = Math.max((1 - lightness) * 1.9, chroma * 4.2)
          alpha = Math.min(1, Math.max(0, (alpha - 0.14) / 0.86))
          d[i + 3] = Math.round(alpha * 255)
          d[i] = Math.min(255, d[i] * 1.05 + 26)
          d[i + 1] = Math.min(255, d[i + 1] * 1.05 + 26)
          d[i + 2] = Math.min(255, d[i + 2] * 1.05 + 26)
        }
        ctx.putImageData(frame, 0, 0)
        const url = canvas.toDataURL("image/png")
        cache.set(src, url)
        pending.delete(src)
        resolve(url)
      } catch (err) {
        pending.delete(src)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => {
      pending.delete(src)
      reject(new Error(`failed to load willow frame: ${src}`))
    }
    img.src = src
  })

  pending.set(src, job)
  return job
}
