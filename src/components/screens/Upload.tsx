"use client";

import { useRef, useState } from "react";
import type { DesignType, Source } from "@/lib/types";
import { loadSampleDataUrl } from "@/lib/sample";
import { cssToHtml } from "@/lib/render/htmlIR";
import { detectSourceKind } from "@/lib/adapters";
import { Chip, GlassButton, IconButton } from "../ui";

// Kept intentionally small so the choice isn't overwhelming.
const TYPES: { label: DesignType; icon: string }[] = [
  { label: "Mobile App", icon: "📱" },
  { label: "Website", icon: "🖥️" },
];

const KIND_LABEL: Record<Source["kind"], string> = {
  raster: "Image",
  html: "HTML / CSS",
  figma: "Figma JSON",
};

export default function Upload({
  name,
  onAnalyze,
  onHistory,
}: {
  name: string;
  onAnalyze: (type: DesignType, source: Source) => void;
  onHistory: () => void;
}) {
  const [type, setType] = useState<DesignType>("Mobile App");
  const [source, setSource] = useState<Source | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    const fname = file.name.toLowerCase();
    if (file.type.startsWith("image/")) {
      reader.onload = () => setSource({ kind: "raster", payload: reader.result as string });
      reader.readAsDataURL(file);
      return;
    }
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (fname.endsWith(".css")) setSource({ kind: "html", payload: cssToHtml(text) });
      else if (fname.endsWith(".json")) setSource({ kind: detectSourceKind(text), payload: text });
      else setSource({ kind: "html", payload: text });
    };
    reader.readAsText(file);
  };

  return (
    <div className="screen-enter flex min-h-full flex-col px-6 pb-8 pt-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--ink-soft)]">Hey {name} 👋</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
            What are we reviewing?
          </h2>
        </div>
        <IconButton label="History" onClick={onHistory}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.5 9a9 9 0 1 1-.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 5v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </div>

      {/* type chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Chip
            key={t.label}
            label={t.label}
            icon={t.icon}
            selected={type === t.label}
            onClick={() => setType(t.label)}
          />
        ))}
      </div>

      {/* dropzone / preview */}
      <div className="mt-5 flex-1">
        {source ? (
          <div className="glass relative flex h-full min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] p-4 text-center">
            {source.kind === "raster" ? (
              <img src={source.payload} alt="Your upload" className="absolute inset-0 h-full w-full object-cover" />
            ) : source.kind === "html" ? (
              <iframe title="Preview" srcDoc={source.payload} sandbox="" className="absolute inset-0 h-full w-full border-0 bg-white" />
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-4xl">🎨</span>
                <p className="mt-2 font-semibold text-[var(--ink)]">Figma file ready</p>
              </div>
            )}
            <span className="absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              {KIND_LABEL[source.kind]}
            </span>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="press glass sheen group relative flex h-full min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] p-6 text-center"
          >
            <div
              className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
              style={{ backgroundImage: "var(--grad-cool)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V5m0 0L8 9m4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-[var(--ink)]">Upload a design</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              PNG / JPG, HTML, CSS, or Figma JSON
            </p>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.html,.htm,.css,.json,text/html,text/css,application/json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {source ? (
          <button
            onClick={() => setSource(null)}
            className="press mx-auto mt-3 block text-sm font-semibold text-[var(--ink-soft)] underline-offset-2 hover:underline"
          >
            Choose a different file
          </button>
        ) : (
          <button
            onClick={async () => setSource({ kind: "raster", payload: await loadSampleDataUrl() })}
            className="press mx-auto mt-3 block text-sm font-semibold text-[var(--ink-soft)]"
          >
            ✨ or try a sample screen
          </button>
        )}
      </div>

      <GlassButton
        className="mt-5 w-full"
        disabled={!source}
        onClick={() => source && onAnalyze(type, source)}
      >
        Analyze my design
      </GlassButton>
    </div>
  );
}
