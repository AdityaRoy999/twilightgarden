type Rendition = { url: string; mp4?: string; webp?: string; width?: string; height?: string };
export type GiphyGif = { id: string; title: string; images: Record<string, Rendition> };
export async function searchGiphy(query: string, key: string, signal: AbortSignal): Promise<GiphyGif[]> {
  if (!key) throw new Error('GIF search is not configured yet.');
  const url = new URL(`https://api.giphy.com/v1/gifs/${query.trim() ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key); url.searchParams.set('limit', '18'); url.searchParams.set('rating', 'pg-13');
  if (query.trim()) url.searchParams.set('q', query);
  // GIPHY requires direct client requests and prohibits caching its responses.
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 429 ? 'GIF search is busy. Please try again shortly.' : 'Could not load GIFs. Please retry.');
  const data = await response.json();
  if (!Array.isArray(data.data)) throw new Error('Could not load GIFs. Please retry.');
  return data.data;
}
