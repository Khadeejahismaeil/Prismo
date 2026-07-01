import type { HistoryEntry, Source } from "./types";
import { supabase, REVIEWS_TABLE } from "./supabase";

/**
 * Review history. Backed by Supabase when configured; falls back to
 * localStorage otherwise (local dev, or offline). The public API stays the same
 * three functions, now async.
 */

const KEY = "prismo:history:v1";
const LIMIT = 30;

/* ---------------- Supabase row <-> HistoryEntry ---------------- */
type Row = {
  id: string;
  name: string | null;
  design_type: string;
  score: number;
  source_kind: Source["kind"];
  source_payload: string;
  analysis: HistoryEntry["analysis"];
  choices: HistoryEntry["choices"] | null;
  created_at: string;
};

function rowToEntry(r: Row): HistoryEntry {
  const source: Source = { kind: r.source_kind, payload: r.source_payload };
  return {
    id: r.id,
    name: r.name ?? "",
    designType: r.design_type as HistoryEntry["designType"],
    score: r.score,
    date: r.created_at,
    source,
    ...(r.source_kind === "raster" ? { image: r.source_payload } : {}),
    analysis: r.analysis,
    choices: r.choices ?? undefined,
  };
}

function entryToRow(e: HistoryEntry): Row {
  return {
    id: e.id,
    name: e.name || null,
    design_type: e.designType,
    score: e.score,
    source_kind: e.source.kind,
    source_payload: e.source.payload,
    analysis: e.analysis,
    choices: e.choices ?? null,
    created_at: e.date,
  };
}

/* ---------------- localStorage fallback ---------------- */
function localGet(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    // Migrate legacy entries that only stored `image`.
    return list.map((e) =>
      e.source ? e : { ...e, source: { kind: "raster", payload: e.image ?? "" } as Source },
    );
  } catch {
    return [];
  }
}

function localSet(list: HistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
    } catch {
      /* give up silently */
    }
  }
}

/* ---------------- public API ---------------- */
export async function getHistory(): Promise<HistoryEntry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from(REVIEWS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (!error && data) return (data as Row[]).map(rowToEntry);
    // fall through to local on error
  }
  return localGet();
}

export async function addHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  if (supabase) {
    const { error } = await supabase.from(REVIEWS_TABLE).insert(entryToRow(entry));
    if (!error) return getHistory();
    // fall through to local on error
  }
  const next = [entry, ...localGet()].slice(0, LIMIT);
  localSet(next);
  return next;
}

export async function clearHistory(): Promise<HistoryEntry[]> {
  if (supabase) {
    // delete all rows (RLS-scoped); the neq guard satisfies the "need a filter" API.
    const { error } = await supabase.from(REVIEWS_TABLE).delete().neq("id", "");
    if (!error) return [];
    // fall through to local on error
  }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  return [];
}
