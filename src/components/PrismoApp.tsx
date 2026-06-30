"use client";

import { useEffect, useState } from "react";
import type { Analysis, Choices, DesignType, HistoryEntry } from "@/lib/types";
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

/** Default each issue to its first (recommended) solution. */
function defaultChoices(analysis: Analysis): Choices {
  return Object.fromEntries(analysis.issues.map((i) => [i.id, i.solutions[0].id]));
}

export default function PrismoApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [name, setName] = useState("");
  const [designType, setDesignType] = useState<DesignType>("Mobile app");
  const [image, setImage] = useState<string>("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [choices, setChoices] = useState<Choices>({});
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
    const defaults = defaultChoices(result);
    setAnalysis(result);
    setChoices(defaults);

    const entry: HistoryEntry = {
      id: `h${Date.now()}`,
      name,
      designType,
      score: result.score,
      date: new Date().toISOString(),
      image,
      analysis: result,
      choices: defaults,
    };
    setHistory(addHistory(entry));
    setScreen("results");
  };

  const openEntry = (e: HistoryEntry) => {
    setDesignType(e.designType);
    setImage(e.image);
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
          image={image}
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

      {screen === "improve" && analysis && (
        <Improve
          image={image}
          analysis={analysis}
          choices={choices}
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
