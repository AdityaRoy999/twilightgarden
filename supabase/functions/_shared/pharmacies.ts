// Public OSM endpoints are best-effort community services. Keep requests bounded,
// cache only public place data, and never infer inventory or live opening status.
type SearchResult = {
  places: unknown[];
  origin: [number, number];
  source: string;
  fetchedAt: string;
};
const cache = new Map<string, { expires: number; value: SearchResult }>();
const pending = new Map<string, Promise<SearchResult>>();
const headers = {
  "User-Agent":
    "TwilightGarden/1.0 (https://twilight-mocha.vercel.app; nearby pharmacies)",
};
export async function findPharmacies(
  lat?: number,
  lon?: number,
  area?: string,
): Promise<SearchResult> {
  const key =
    lat !== undefined && lon !== undefined
      ? `${lat.toFixed(3)},${lon.toFixed(3)}`
      : area?.trim().toLowerCase() || "";
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const running = pending.get(key);
  if (running) return running;
  const work = (async () => {
    let origin: [number, number];
    if (lat !== undefined && lon !== undefined) origin = [lat, lon];
    else {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", area || "");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("Area lookup is unavailable");
      const result = await response.json();
      const point = result.features?.[0]?.geometry?.coordinates;
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))
        throw new Error("Area not found. Try a nearby city.");
      origin = [point[1], point[0]];
    }
    const [latitude, longitude] = origin;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
      throw new Error("Invalid location");
    // Photon indexes OSM pharmacies directly. Its reverse endpoint returns real
    // nearby POIs, rather than text matches for shops literally named Pharmacy.
    let features: any[] | undefined;
    for (const path of ["/reverse", "/reverse/"]) {
      try {
        const url = new URL(`https://photon.komoot.io${path}`);
        for (const [key, value] of Object.entries({
          lat: String(latitude),
          lon: String(longitude),
          radius: "5",
          limit: "30",
          osm_tag: "amenity:pharmacy",
        }))
          url.searchParams.set(key, value);
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error("Places unavailable");
        const data = await response.json();
        if (!Array.isArray(data.features))
          throw new Error("Invalid places response");
        features = data.features;
        break;
      } catch {
        /* One bounded retry; no automatic requests while typing. */
      }
    }
    if (!features)
      throw new Error(
        "The community map service is busy. Please retry shortly.",
      );
    const places = features
      .filter(
        (feature) =>
          feature.properties?.osm_key === "amenity" &&
          feature.properties?.osm_value === "pharmacy",
      )
      .map((feature) => {
        const p = feature.properties,
          coordinates = feature.geometry?.coordinates;
        return {
          id: p.osm_id,
          type:
            p.osm_type === "W"
              ? "way"
              : p.osm_type === "R"
                ? "relation"
                : "node",
          lat: coordinates?.[1],
          lon: coordinates?.[0],
          tags: {
            name: p.name,
            "addr:street": p.street,
            "addr:housenumber": p.housenumber,
            "addr:city": p.city,
            ...p.extra,
          },
        };
      });
    const value: SearchResult = {
      places,
      origin,
      source: "OpenStreetMap",
      fetchedAt: new Date().toISOString(),
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 600000, value });
    return value;
  })();
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
