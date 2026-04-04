const EARTH_RADIUS_M = 6371000

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinGeofence(
  lat: number,
  lon: number,
  site: { latitude: number; longitude: number; geofence_radius_metres: number | null }
): { within: boolean; distance_metres: number } {
  if (site.geofence_radius_metres == null) {
    return { within: true, distance_metres: 0 }
  }
  const distance = haversineDistance(lat, lon, site.latitude, site.longitude)
  return {
    within: distance <= site.geofence_radius_metres,
    distance_metres: Math.round(distance),
  }
}
