import type { Json } from './database.types';

/** Serialize a typed application object at the database JSON boundary. */
export function toJson(value: object): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
