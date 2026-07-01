"use client";

import { useCallback, useEffect, useState } from "react";
import type { Analysis, Choices, DesignType, HistoryEntry, Source } from "@/lib/types";
import { requestAnalysis } from "@/lib/analyzeClient";
import { addHistory, clearHistory, getHistory } from "@/lib/history";
import { DEMO_SOURCE, DEMO_ANALYSIS, DEMO_AFTER_HTML } from "@/lib/demo";
import PhoneFrame from "./PhoneFrame";
import Welcome from "./screens/Welcome";
import Upload from "./screens/Upload";
import Analyzing from "./screens/Analyzing";
import Results from "./screens/Results";
import Improve from "./screens/Improve";
import History from "./screens/History";

type Screen =
  | "welcome"
  | "upload"
  | "analyzing"
  | "results"
  | "improve"
  | "history";

/** Default each issue to its first (recommended) solution. */
function defaultChoices(analysis: Analysis): Choices {
  return Object.fromEntries(analysis.issues.map((i) => [i.id, i.solutions[0].id]));
}

export default function PrismoApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [name, setName] = useState("");
  const [designType, setDesignType] = useState<DesignType>("Mobile App");
  const [source, setSource] = useState<Source | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [choices, setChoices] = useState<Choices>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const h = await getHistory();
      if (live) setHistory(h);
    })();
    return () => {
      live = false;
    };
  }, []);

  const runAnalyze = useCallback(
    async (type: DesignType, src: Source) => {
      setAnalyzeError(null);
      try {
        // Keep the pickle on screen for a beat even if the model is quick.
        const minWait = new Promise((r) => setTimeout(r, 3000));
        const result = await requestAnalysis(src, type);
        await minWait;

        const defaults = defaultChoices(result);
        setAnalysis(result);
        setChoices(defaults);

        const entry: HistoryEntry = {
          id: `h${Date.now()}`,
          name,
          designType: type,
          score: result.score,
          date: new Date().toISOString(),
          source: src,
          ...(src.kind === "raster" ? { image: src.payload } : {}),
          analysis: result,
          choices: defaults,
        };
        setHistory(await addHistory(entry));
        setScreen("results");
      } catch (e) {
        setAnalyzeError(e instanceof Error ? e.message : "Something went wrong.");
      }
    },
    [name],
  );

  /** Scripted, API-free analysis: fake loading → preset results. The glow-up
   *  then uses the preset "after" (blue) in Improve. */
  const runDemoAnalysis = () => {
    setDemo(true);
    setAnalysis(null);
    setAnalyzeError(null);
    setScreen("analyzing");
    setTimeout(() => {
      setAnalysis(DEMO_ANALYSIS);
      setChoices(defaultChoices(DEMO_ANALYSIS));
      setScreen("results");
    }, 2600);
  };

  const startAnalyze = (type: DesignType, src: Source) => {
    setDesignType(type);
    setSource(src);
    // The sample screen (the green "Send money" design) runs the deterministic
    // demo path so its glow-up is always the exact blue redesign.
    if (src.kind === "html" && src.payload === DEMO_SOURCE.payload) {
      runDemoAnalysis();
      return;
    }
    setDemo(false);
    setAnalysis(null);
    setAnalyzeError(null);
    setScreen("analyzing");
    runAnalyze(type, src);
  };

  /** "Watch a quick demo" — same preset before/after, straight from Welcome. */
  const startDemo = () => {
    if (!name.trim()) setName("there");
    setDesignType("Mobile App");
    setSource(DEMO_SOURCE);
    runDemoAnalysis();
  };

  const openEntry = (e: HistoryEntry) => {
    setDemo(false);
    setDesignType(e.designType);
    // Legacy entries stored only `image`; synthesize a raster source for them.
    setSource(e.source ?? { kind: "raster", payload: e.image ?? "" });
    setAnalysis(e.analysis);
    setChoices(e.choices ?? defaultChoices(e.analysis));
    setScreen("results");
  };

  return (
    <PhoneFrame>
      {screen === "welcome" && (
        <Welcome
          initialName={name}
          onContinue={(n) => {
            setName(n);
            setScreen("upload");
          }}
          onDemo={startDemo}
        />
      )}

      {screen === "upload" && (
        <Upload
          name={name}
          onAnalyze={startAnalyze}
          onHistory={() => setScreen("history")}
        />
      )}

      {screen === "analyzing" && (
        <Analyzing
          source={source}
          error={analyzeError}
          onRetry={() => source && runAnalyze(designType, source)}
          onCancel={() => {
            setAnalyzeError(null);
            setScreen("upload");
          }}
        />
      )}

      {screen === "results" && analysis && source && (
        <Results
          source={source}
          analysis={analysis}
          choices={choices}
          onChoose={(issueId, value) =>
            setChoices((c) => ({ ...c, [issueId]: value }))
          }
          onImprove={() => setScreen("improve")}
          onNew={() => setScreen("upload")}
          onDone={() => setScreen("history")}
          onHistory={() => setScreen("history")}
        />
      )}

      {screen === "improve" && analysis && source && (
        <Improve
          source={source}
          designType={designType}
          analysis={analysis}
          choices={choices}
          onBack={() => setScreen("results")}
          onDone={() => setScreen("history")}
          demoAfterHtml={demo ? DEMO_AFTER_HTML : undefined}
        />
      )}

      {screen === "history" && (
        <History
          entries={history}
          onOpen={openEntry}
          onNew={() => setScreen("upload")}
          onClear={async () => setHistory(await clearHistory())}
        />
      )}
    </PhoneFrame>
  );
}
