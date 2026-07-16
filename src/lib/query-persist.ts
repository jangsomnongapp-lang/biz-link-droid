import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

// IndexedDB-backed persister (survives reloads and works offline).
// Only whitelisted queries are persisted (see dehydrateOptions in __root.tsx).
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: "buildhub-query-cache-v1",
  throttleTime: 1000,
});

// Which query keys should be cached to disk for offline browsing.
const OFFLINE_KEYS = new Set(["home:feed", "home:stories", "home:profile"]);

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && OFFLINE_KEYS.has(root);
}
