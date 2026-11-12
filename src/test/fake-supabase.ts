/**
 * Cliente de Supabase falso para pruebas unitarias. Cada `from()` o `rpc()`
 * registra la cadena de llamadas que recibe y, al esperarse (o con
 * `single`/`maybeSingle`), resuelve con lo que devuelva `resolve(call)`.
 */
export type Call = { table: string; ops: [string, unknown[]][] };
export type Result = { data?: unknown; error?: unknown; count?: number | null };

/** Argumentos de la primera llamada `name` de la cadena. */
export const op = (call: Call | undefined, name: string) =>
  call?.ops.find(([n]) => n === name)?.[1];
export const has = (call: Call, name: string) =>
  call.ops.some(([n]) => n === name);

export function fakeSupabase(resolve: (call: Call) => Result = () => ({})) {
  const calls: Call[] = [];
  const chain = (call: Call): unknown => {
    const finish = () =>
      Promise.resolve({ data: null, error: null, ...resolve(call) });
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then")
            return (
              ok: (value: unknown) => unknown,
              fail?: (reason: unknown) => unknown,
            ) => finish().then(ok, fail);
          if (prop === "single" || prop === "maybeSingle")
            return () => {
              call.ops.push([prop, []]);
              return finish();
            };
          return (...args: unknown[]) => {
            call.ops.push([String(prop), args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      return chain(call);
    },
    rpc(name: string, args?: unknown) {
      const call: Call = { table: `rpc:${name}`, ops: [["rpc", [args]]] };
      calls.push(call);
      return chain(call);
    },
  };
  /** Llamadas a una tabla (o `rpc:nombre`). */
  const to = (table: string) => calls.filter((c) => c.table === table);
  return { client, calls, to };
}

export function formData(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of [value].flat()) data.append(key, item);
  return data;
}

export const ids = {
  group: "10000000-0000-4000-8000-000000000001",
  event: "20000000-0000-4000-8000-000000000002",
  item: "30000000-0000-4000-8000-000000000003",
  ana: "00000000-0000-4000-8000-0000000000a1",
  luis: "00000000-0000-4000-8000-0000000000b2",
  sofia: "00000000-0000-4000-8000-0000000000c3",
};
