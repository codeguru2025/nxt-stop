'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet's default marker icons broken by webpack
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Props = {
  lat: number
  lng: number
  venueName: string
  address?: string
}

export default function VenueMap({ lat, lng, venueName, address }: Props) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2a2a]">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '280px', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>
            <strong>{venueName}</strong>
            {address && <><br />{address}</>}
          </Popup>
        </Marker>
      </MapContainer>
      <div className="bg-[#111] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">{venueName}</p>
          {address && <p className="text-gray-500 text-xs">{address}</p>}
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium shrink-0 ml-4"
        >
          Get Directions →
        </a>
      </div>
    </div>
  )
}
