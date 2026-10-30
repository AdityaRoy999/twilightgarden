import type { SupabaseClient } from "@supabase/supabase-js";
import {
  configurePrivateData,
  readPrivateRows,
  savePrivateRow,
  preparePrivateRecord,
  savePrivateBatch,
  decryptRecord,
  invalidatePrivateRecords,
  privateDataReady,
} from "./privateData";
import { unlockedVault } from "./vaultRuntime";
import { parseDateKey, localDateKey } from "./dates";
const protectedTables = new Set(["profiles", "daily_logs", "user_settings"]);
type Row = Record<string, any>;
class PrivateQuery implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private owner: string | undefined;
  private mode = "read";
  private values: Row[] = [];
  private start = 0;
  private size = Number.MAX_SAFE_INTEGER;
  private ordering: { key: string; ascending: boolean }[] = [];
  private one = false;
  private maybe = false;
  private head = false;
  private signal?: AbortSignal;
  constructor(
    private raw: SupabaseClient<any>,
    private table: string,
  ) {}
  select(_columns?: string, options?: { head?: boolean; count?: string }) {
    this.head = options?.head === true;
    return this;
  }
  eq(key: string, value: any) {
    if (key === (this.table === "profiles" ? "id" : "user_id"))
      this.owner = value;
    this.filters.push((r) => r[key] === value);
    return this;
  }
  neq(key: string, value: any) {
    this.filters.push((r) => r[key] !== value);
    return this;
  }
  lt(key: string, value: any) {
    this.filters.push((r) => r[key] < value);
    return this;
  }
  lte(key: string, value: any) {
    this.filters.push((r) => r[key] <= value);
    return this;
  }
  gt(key: string, value: any) {
    this.filters.push((r) => r[key] > value);
    return this;
  }
  gte(key: string, value: any) {
    this.filters.push((r) => r[key] >= value);
    return this;
  }
  in(key: string, values: any[]) {
    this.filters.push((r) => values.includes(r[key]));
    return this;
  }
  is(key: string, value: any) {
    return this.eq(key, value);
  }
  order(key: string, { ascending = true } = {}) {
    this.ordering.push({ key, ascending });
    return this;
  }
  limit(size: number) {
    this.size = size;
    return this;
  }
  range(start: number, end: number) {
    this.start = start;
    this.size = end - start + 1;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    this.maybe = true;
    return this;
  }
  abortSignal(signal: AbortSignal) {
    this.signal = signal;
    return this;
  }
  insert(value: Row | Row[]) {
    this.mode = "insert";
    this.values = Array.isArray(value) ? value : [value];
    return this;
  }
  upsert(value: Row | Row[]) {
    this.mode = "upsert";
    this.values = Array.isArray(value) ? value : [value];
    return this;
  }
  update(value: Row) {
    this.mode = "update";
    this.values = [value];
    return this;
  }
  async rows(owner: string): Promise<Row[]> {
    if (this.table === "profiles") {
      const [metadata, privateRows, prefs] = await Promise.all([
        this.raw
          .from("profiles")
          .select("id,role,email,created_at")
          .eq("id", owner),
        readPrivateRows(owner, "profile"),
        owner === unlockedVault().userId
          ? readPrivateRows(owner, "preferences")
          : Promise.resolve([]),
      ]);
      if (metadata.error) throw metadata.error;
      return (metadata.data || []).map((row) => ({
        ...row,
        ...privateRows[0],
        ...(prefs[0]?.partner_nickname !== undefined
          ? { partner_nickname: prefs[0].partner_nickname }
          : {}),
      }));
    }
    if (this.table === "user_settings") {
      const [health, prefs] = await Promise.all([
        readPrivateRows(owner, "health_settings"),
        owner === unlockedVault().userId
          ? readPrivateRows(owner, "preferences")
          : Promise.resolve([]),
      ]);
      return health.length || prefs.length
        ? [{ user_id: owner, ...health[0], ...prefs[0] }]
        : [];
    }
    return readPrivateRows(owner, "daily_logs");
  }
  private async run() {
    try {
      this.signal?.throwIfAborted();
      const own = unlockedVault().userId,
        owner =
          this.owner || this.values[0]?.user_id || this.values[0]?.id || own;
      if (owner !== own && this.mode !== "read")
        throw new Error("Only the owner can edit private records.");
      let rows = await this.rows(owner);
      this.signal?.throwIfAborted();
      if (this.mode !== "read") {
        if (this.table === "daily_logs")
          throw new Error(
            "Save health logs through the encrypted log transaction.",
          );
        const updates = this.values.map((value) => ({ ...rows[0], ...value }));
        for (const value of updates) {
          if (this.table === "profiles") {
            const { full_name, bio, status, avatar_url, partner_nickname } =
              value;
            await savePrivateRow("profile", "profile", {
              id: own,
              full_name,
              bio,
              status,
              avatar_url,
            });
            if (partner_nickname !== undefined) {
              const old = (await readPrivateRows(own, "preferences"))[0] || {};
              await savePrivateRow("preferences", "preferences", {
                ...old,
                user_id: own,
                partner_nickname,
              });
            }
          } else {
            const {
              notifications_enabled,
              period_notifications,
              reminder_notifications,
              time_zone,
            } = value;
            await savePrivateRow("preferences", "preferences", {
              user_id: own,
              notifications_enabled,
              period_notifications,
              reminder_notifications,
              time_zone,
            });
          }
        }
        rows = updates;
      }
      rows = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const { key, ascending } of [...this.ordering].reverse())
        rows.sort(
          (a, b) =>
            (a[key] === b[key] ? 0 : a[key] > b[key] ? 1 : -1) *
            (ascending ? 1 : -1),
        );
      const count = rows.length;
      rows = rows.slice(this.start, this.start + this.size);
      if (this.one && rows.length !== 1 && !this.maybe)
        return {
          data: null,
          error: { code: "PGRST116", message: "Private record not found." },
          count,
        };
      return {
        data: this.head ? null : this.one ? rows[0] || null : rows,
        error: null,
        count,
      };
    } catch (error) {
      return { data: null, error, count: null };
    }
  }
  then<TResult1 = any, TResult2 = never>(
    resolve?: ((v: any) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((r: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(resolve, reject);
  }
}
const defaults = {
  avg_cycle_length: 28,
  avg_period_length: 5,
  last_period_start: null,
  onboarding_completed: false,
  irregular_cycle: false,
};
async function healthTransaction(
  raw: SupabaseClient<any>,
  name: string,
  args: Row,
) {
  const owner = unlockedVault().userId;
  for (let attempt = 0; attempt < 3; attempt++) {
    const [records, current] = await Promise.all([
      readPrivateRows(owner, "daily_logs"),
      readPrivateRows(owner, "health_settings"),
    ]);
    const settings = { user_id: owner, ...defaults, ...current[0] };
    let log: Row | undefined;
    const changes = [];
    if (name === "save_daily_log") {
      const date = args.p_date;
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parseDateKey(date).getTime()) ||
        localDateKey(parseDateKey(date)) !== date ||
        date > localDateKey()
      )
        throw new Error("Choose a valid date, up to today.");
      const values = args.p_values || {};
      if (
        (values.notes?.length || 0) > 500 ||
        !["", null, undefined, "spotting", "light", "medium", "heavy"].includes(
          values.flow,
        ) ||
        (values.sleep_hours != null &&
          (values.sleep_hours < 0 || values.sleep_hours > 24))
      )
        throw new Error("Invalid health log.");
      const previous = records.find((r) => r.date === date);
      log = {
        ...previous,
        ...values,
        date,
        user_id: owner,
        id: previous?.id || crypto.randomUUID(),
        is_period_start: !!args.p_period_start,
        created_at: previous?.created_at || new Date().toISOString(),
      };
      const starts = [
        ...records
          .filter((r) => r.date !== date && r.is_period_start)
          .map((r) => r.date),
        ...(log.is_period_start ? [date] : []),
      ].sort();
      if (log.is_period_start || previous?.is_period_start)
        settings.last_period_start = starts.at(-1) || null;
      changes.push(await preparePrivateRecord("daily_logs", date, log));
    } else {
      Object.assign(settings, args.p_values);
      if (
        !Number.isInteger(settings.avg_cycle_length) ||
        !Number.isInteger(settings.avg_period_length) ||
        settings.avg_cycle_length < 20 ||
        settings.avg_cycle_length > 90 ||
        settings.avg_period_length < 1 ||
        settings.avg_period_length >= settings.avg_cycle_length ||
        settings.avg_period_length > 20 ||
        settings.last_period_start > localDateKey() ||
        (settings.last_period_start &&
          localDateKey(parseDateKey(settings.last_period_start)) !==
            settings.last_period_start)
      )
        throw new Error("Invalid cycle settings.");
      if (settings.last_period_start) {
        const previous = records.find(
          (r) => r.date === settings.last_period_start,
        );
        changes.push(
          await preparePrivateRecord("daily_logs", settings.last_period_start, {
            ...previous,
            id: previous?.id || crypto.randomUUID(),
            date: settings.last_period_start,
            user_id: owner,
            is_period_start: true,
            created_at: previous?.created_at || new Date().toISOString(),
          }),
        );
      }
    }
    changes.push(
      await preparePrivateRecord(
        "health_settings",
        "health_settings",
        settings,
      ),
    );
    try {
      await savePrivateBatch(changes);
      return {
        data: name === "save_daily_log" ? { log, settings } : settings,
        error: null,
      };
    } catch (error: any) {
      if (error.code !== "40001" || attempt === 2) throw error;
    }
  }
  throw new Error("Your data changed on another device. Please retry.");
}
export function privateClient<T extends SupabaseClient<any>>(raw: T): T {
  configurePrivateData(raw);
  return new Proxy(raw, {
    get(target, property) {
      if (property === "privateContentVersion") return 1;
      if (property === "from")
        return (table: string) =>
          protectedTables.has(table)
            ? new PrivateQuery(raw, table)
            : target.from(table);
      if (property === "rpc")
        return (name: string, args: Row, options?: any) =>
          ["save_daily_log", "save_cycle_settings"].includes(name)
            ? healthTransaction(raw, name, args).catch((error) => ({
                data: null,
                error,
              }))
            : target.rpc(name, args, options);
      if (property === "channel")
        return (...args: any[]) => {
          const channel = (target.channel as any)(...args),
            original = channel.on.bind(channel);
          channel.on = (event: string, filter: any, callback: any) => {
            if (
              event === "postgres_changes" &&
              ["profiles", "daily_logs", "user_settings"].includes(filter.table)
            ) {
              const table = filter.table,
                owner = filter.filter?.split("=eq.")[1];
              return original(
                event,
                {
                  ...filter,
                  event: "*",
                  table: "private_records",
                  filter: owner ? `owner_id=eq.${owner}` : undefined,
                },
                async (payload: any) => {
                  const record = payload.new;
                  if (record?.owner_id && record?.kind)
                    invalidatePrivateRecords(record.owner_id, record.kind);
                  if (!privateDataReady() || !record?.kind) return;
                  if (
                    !(table === "user_settings"
                      ? record.kind === "health_settings"
                      : record.kind ===
                        (table === "profiles" ? "profile" : table))
                  )
                    return;
                  try {
                    const value = await decryptRecord(record);
                    callback({
                      ...payload,
                      eventType: "UPDATE",
                      new: value,
                      old: payload.old,
                    });
                  } catch {
                    /* Fail closed; never forward ciphertext as a readable row. */
                  }
                },
              );
            }
            return original(event, filter, callback);
          };
          return channel;
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
