"use client";

import { useRef, useState } from "react";
import type { DesignType } from "@/lib/types";
import { loadSampleDataUrl } from "@/lib/sample";
import { Chip, GlassButton, IconButton } from "../ui";

const TYPES: { label: DesignType; icon: string }[] = [
  { label: "Mobile app", icon: "📱" },
  { label: "Website", icon: "🖥️" },
  { label: "Dashboard", icon: "📊" },
  { label: "Slide", icon: "📑" },
  { label: "Pitch deck", icon: "🚀" },
];

export default function Upload({
  name,
  onAnalyze,
  onHistory,
}: {
  name: string;
  onAnalyze: (type: DesignType, image: string) => void;
  onHistory: () => void;
}) {
  const [type, setType] = useState<DesignType>("Mobile app");
  const [image, setImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
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

      {/* dropzone */}
      <div className="mt-5 flex-1">
        <button
          onClick={() => inputRef.current?.click()}
          className="press glass sheen group relative flex h-full min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] p-6 text-center"
        >
          {image ? (
            <img
              src={image}
              alt="Your upload"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <div
                className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
                style={{ backgroundImage: "var(--grad-cool)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V5m0 0L8 9m4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="mt-4 text-lg font-semibold text-[var(--ink)]">
                Upload a screenshot
              </p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Tap to choose · PNG, JPG up to 5MB
              </p>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {image ? (
          <button
            onClick={() => setImage(null)}
            className="press mx-auto mt-3 block text-sm font-semibold text-[var(--ink-soft)] underline-offset-2 hover:underline"
          >
            Choose a different image
          </button>
        ) : (
          <button
            onClick={async () => setImage(await loadSampleDataUrl())}
            className="press mx-auto mt-3 block text-sm font-semibold text-[var(--ink-soft)]"
          >
            ✨ or try a sample screen
          </button>
        )}
      </div>

      <GlassButton
        className="mt-5 w-full"
        disabled={!image}
        onClick={() => image && onAnalyze(type, image)}
      >
        Analyze my design
      </GlassButton>
    </div>
  );
}
