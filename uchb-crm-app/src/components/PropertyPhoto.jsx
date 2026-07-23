import { useEffect, useState } from 'react'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Street View when Google has coverage (an actual photo of the house from
// the road) — falls back to a satellite view for addresses with no
// coverage, which is common on rural roads. Both are free at this
// business's usage level; no button, no per-pull cost, same treatment as
// the always-visible Zillow link.
export default function PropertyPhoto({ address }) {
  const [imageUrl, setImageUrl] = useState(null)

  useEffect(() => {
    if (!API_KEY || !address) {
      setImageUrl(null)
      return
    }

    let active = true
    const encoded = encodeURIComponent(address)

    fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${encoded}&key=${API_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        const url =
          data.status === 'OK'
            ? `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${encoded}&key=${API_KEY}`
            : `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=19&size=640x400&maptype=satellite&key=${API_KEY}`
        setImageUrl(url)
      })
      .catch(() => {
        if (active) setImageUrl(null)
      })

    return () => {
      active = false
    }
  }, [address])

  if (!imageUrl) return null

  return (
    <img
      src={imageUrl}
      alt={address}
      className="w-full rounded-2xl object-cover"
      style={{ aspectRatio: '16 / 10' }}
    />
  )
}
