export interface PharmacyPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  phoneNumber?: string;
  distanceKm?: number;
  openingHours?: string;
  sourceUrl?: string;
}
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const rad = Math.PI / 180,
    dlat = (lat2 - lat1) * rad,
    dlon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function normalizePharmacies(
  input: unknown,
  origin?: [number, number],
): PharmacyPlace[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const rawLat = row.latitude ?? row.lat ?? row.center?.lat,
        rawLon = row.longitude ?? row.lng ?? row.lon ?? row.center?.lon;
      if (
        rawLat === undefined ||
        rawLon === undefined ||
        rawLat === null ||
        rawLon === null ||
        rawLat === "" ||
        rawLon === "" ||
        typeof rawLat === "boolean" ||
        typeof rawLon === "boolean"
      )
        return [];
      const lat = Number(rawLat),
        lon = Number(rawLon);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      )
        return [];
      const id = String(
        row.cid ||
          (row.type && row.id
            ? `${row.type}/${row.id}`
            : `${lat.toFixed(6)},${lon.toFixed(6)}`),
      );
      if (seen.has(id)) return [];
      seen.add(id);
      const km = origin ? distanceKm(...origin, lat, lon) : undefined;
      if (km !== undefined && km > 25) return [];
      return [
        {
          id,
          name:
            typeof (row.title ?? row.tags?.name) === "string"
              ? (row.title ?? row.tags.name)
              : "Pharmacy",
          lat,
          lon,
          address:
            typeof row.address === "string"
              ? row.address
              : [
                  row.tags?.["addr:housenumber"],
                  row.tags?.["addr:street"],
                  row.tags?.["addr:suburb"],
                  row.tags?.["addr:city"],
                ]
                  .filter(Boolean)
                  .join(", ") || "Address not supplied",
          phoneNumber:
            typeof (
              row.phoneNumber ??
              row.tags?.phone ??
              row.tags?.["contact:phone"]
            ) === "string"
              ? (row.phoneNumber ??
                row.tags?.phone ??
                row.tags?.["contact:phone"])
              : undefined,
          openingHours: row.tags?.opening_hours,
          sourceUrl:
            row.type && row.id
              ? `https://www.openstreetmap.org/${row.type}/${row.id}`
              : undefined,
          distanceKm: km,
        },
      ];
    })
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
export function pharmacyDirections(
  place: PharmacyPlace,
  mode: "walking" | "driving" = "walking",
) {
  const url = new URL("https://www.openstreetmap.org/directions");
  url.searchParams.set("to", `${place.lat},${place.lon}`);
  url.searchParams.set(
    "engine",
    mode === "walking" ? "fossgis_osrm_foot" : "fossgis_osrm_car",
  );
  return url.toString();
}
