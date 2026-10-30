/** Short-lived, bounded, ciphertext-only memory cache. Never persisted. */
export class CiphertextCache<T> {
  private entries = new Map<
    string,
    { value: T; expires: number; bytes: number }
  >();
  private bytes = 0;
  constructor(
    private ttl = 5000,
    private maxBytes = 2 * 1024 * 1024,
    private now = () => Date.now(),
  ) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key: string, value: T) {
    this.delete(key);
    const bytes = JSON.stringify(value).length * 2;
    if (bytes > this.maxBytes) return;
    while (this.bytes + bytes > this.maxBytes && this.entries.size)
      this.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: this.now() + this.ttl, bytes });
    this.bytes += bytes;
  }
  delete(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
}
