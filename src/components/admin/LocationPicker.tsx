'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

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
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
}

function ClickHandler({ onChange }: { onChange: (lat: string, lng: string) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6))
    },
  })
  return null
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)
  const hasPin = !isNaN(parsedLat) && !isNaN(parsedLng)

  // Default center: Bulawayo, Zimbabwe
  const center: [number, number] = hasPin ? [parsedLat, parsedLng] : [-20.15, 28.59]

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-[#2a2a2a] mb-2">
        <MapContainer
          key={`${center[0]},${center[1]}`}
          center={center}
          zoom={hasPin ? 15 : 13}
          style={{ height: '260px', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onChange={onChange} />
          {hasPin && <Marker position={[parsedLat, parsedLng]} icon={icon} />}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500 mb-2">Click the map to pin the venue location.</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={e => onChange(e.target.value, lng)}
            placeholder="-20.149700"
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Longitude</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={e => onChange(lat, e.target.value)}
            placeholder="28.588800"
            className="text-sm"
          />
        </div>
      </div>
    </div>
  )
}
