"use client";

import { useEffect, useState } from "react";
import type { Analysis, DesignType, HistoryEntry } from "@/lib/types";
import { analyze } from "@/lib/mock";
import { addHistory, clearHistory, getHistory } from "@/lib/history";
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

export default function PrismoApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [name, setName] = useState("");
  const [designType, setDesignType] = useState<DesignType>("Mobile app");
  const [image, setImage] = useState<string>("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const startAnalyze = (type: DesignType, img: string) => {
    setDesignType(type);
    setImage(img);
    setAnalysis(null);
    setScreen("analyzing");
  };

  const finishAnalyze = () => {
    const seed = (image.length + Date.now()) % 1000;
    const result = analyze(designType, seed);
    setAnalysis(result);

    const entry: HistoryEntry = {
      id: `h${Date.now()}`,
      name,
      designType,
      score: result.score,
      date: new Date().toISOString(),
      image,
      analysis: result,
    };
    setHistory(addHistory(entry));
    setScreen("results");
  };

  const openEntry = (e: HistoryEntry) => {
    setDesignType(e.designType);
    setImage(e.image);
    setAnalysis(e.analysis);
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
        <Analyzing image={image} onComplete={finishAnalyze} />
      )}

      {screen === "results" && analysis && (
        <Results
          name={name}
          image={image}
          analysis={analysis}
          onImprove={() => setScreen("improve")}
          onNew={() => setScreen("upload")}
          onHistory={() => setScreen("history")}
        />
      )}

      {screen === "improve" && (
        <Improve
          image={image}
          onBack={() => setScreen("results")}
          onDone={() => setScreen("history")}
        />
      )}

      {screen === "history" && (
        <History
          entries={history}
          onOpen={openEntry}
          onNew={() => setScreen("upload")}
          onClear={() => setHistory(clearHistory())}
        />
      )}
    </PhoneFrame>
  );
}
