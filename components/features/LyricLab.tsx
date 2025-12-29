import React, { useState, useEffect, useCallback } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import ErrorDisplay from "../ui/ErrorDisplay";
import {
  analyzeRhymeAndMeter,
  generateLineAlternatives,
} from "../../services/geminiService";
import { useUndoRedoWithKeyboard } from "../../hooks/useUndoRedo";
import { useToast, useTheme } from "../../context/AppContext";

interface LyricLabProps {
  initialLyrics: string;
  onUpdateLyrics: (newLyrics: string) => void;
}

const LyricLab: React.FC<LyricLabProps> = ({
  initialLyrics,
  onUpdateLyrics,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Use undo/redo for lyrics with keyboard shortcuts
  const {
    state: lines,
    set: setLines,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useUndoRedoWithKeyboard<string[]>(
    initialLyrics ? initialLyrics.split("\n") : [],
    { maxHistory: 50, debounceMs: 500 }
  );

  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<unknown>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isGeneratingAlts, setIsGeneratingAlts] = useState(false);
  const [alternativesError, setAlternativesError] = useState<unknown>(null);
  const [rewriteGoal, setRewriteGoal] = useState("Improve Rhyme");

  const { addToast } = useToast();

  // Sync with parent when lines change
  useEffect(() => {
    onUpdateLyrics(lines.join("\n"));
  }, [lines, onUpdateLyrics]);

  // Reset history when initialLyrics changes externally
  useEffect(() => {
    if (initialLyrics) {
      const newLines = initialLyrics.split("\n");
      // Only reset if significantly different (not just from our own updates)
      if (JSON.stringify(newLines) !== JSON.stringify(lines)) {
        resetHistory(newLines);
      }
    }
  }, [initialLyrics]); // Intentionally not including lines/resetHistory to avoid loops

  const handleLineClick = useCallback(async (index: number) => {
    setSelectedLineIndex(index);
    setAnalysis("");
    setAlternatives([]);
    setAnalysisError(null);

    setIsAnalyzing(true);
    try {
      const result = await analyzeRhymeAndMeter(lines[index], lines.join("\n"));
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      setAnalysisError(e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [lines]);

  const handleGenerateAlternatives = useCallback(async () => {
    if (selectedLineIndex === null) return;
    setIsGeneratingAlts(true);
    setAlternativesError(null);
    try {
      const alts = await generateLineAlternatives(
        lines[selectedLineIndex],
        rewriteGoal,
      );
      setAlternatives(alts);
    } catch (e) {
      console.error(e);
      setAlternativesError(e);
    } finally {
      setIsGeneratingAlts(false);
    }
  }, [selectedLineIndex, lines, rewriteGoal]);

  const handleApplyAlternative = useCallback((alt: string) => {
    if (selectedLineIndex === null) return;
    const newLines = [...lines];
    newLines[selectedLineIndex] = alt;
    setLines(newLines);
    setAlternatives([]);
    addToast({
      type: "success",
      title: "Line Updated",
      message: "Press Ctrl+Z to undo",
      duration: 3000,
    });
  }, [selectedLineIndex, lines, setLines, addToast]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLines(text.split("\n"));
  }, [setLines]);

  const handleUndo = useCallback(() => {
    undo();
    addToast({ type: "info", title: "Undone", duration: 2000 });
  }, [undo, addToast]);

  const handleRedo = useCallback(() => {
    redo();
    addToast({ type: "info", title: "Redone", duration: 2000 });
  }, [redo, addToast]);

  return (
    <Page
      title="Lyric Lab"
      description="Fine-tune your lyrics with AI-powered rhyme analysis and magic rewrites."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[75vh]">
        <Card className="flex flex-col h-full">
          {/* Header with undo/redo buttons */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Editor</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <span className={`text-xs ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Ctrl+Z / Ctrl+Shift+Z</span>
            </div>
          </div>
          <div className={`flex-1 overflow-y-auto rounded-lg p-4 font-mono text-lg leading-relaxed ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
            {lines.map((line, i) => (
              <div
                key={i}
                onClick={() => handleLineClick(i)}
                className={`p-2 rounded cursor-pointer transition-colors ${selectedLineIndex === i ? "bg-indigo-500/30 ring-1 ring-indigo-500" : isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-200"} ${!line.trim() ? "h-8" : ""}`}
              >
                {line || (
                  <span className={`italic text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    -- Empty Line --
                  </span>
                )}
              </div>
            ))}
          </div>
          <textarea
            className={`mt-4 w-full rounded-md p-2 text-sm ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
            rows={3}
            placeholder="Edit raw text here..."
            value={lines.join("\n")}
            onChange={handleTextChange}
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <h3 className="text-xl font-semibold mb-2">Analysis</h3>
            {selectedLineIndex !== null ? (
              isAnalyzing ? (
                <p className={`animate-pulse ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Analyzing meter and rhyme...
                </p>
              ) : analysisError ? (
                <ErrorDisplay
                  error={analysisError}
                  context="analyze the selected line"
                  onRetry={() => handleLineClick(selectedLineIndex)}
                  onDismiss={() => setAnalysisError(null)}
                />
              ) : (
                <div className={`prose prose-sm ${isDark ? 'prose-invert' : ''}`}>
                  <p className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {analysis}
                  </p>
                </div>
              )
            ) : (
              <p className={`italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Select a line to see analysis.
              </p>
            )}
          </Card>

          <Card className="flex-1 flex flex-col">
            <h3 className="text-xl font-semibold mb-4">Magic Rewrite</h3>
            <div className="flex gap-2 mb-4">
              <select
                value={rewriteGoal}
                onChange={(e) => setRewriteGoal(e.target.value)}
                className={`flex-1 rounded-md text-sm py-2 px-3 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
              >
                <option value="Improve Rhyme">Improve Rhyme</option>
                <option value="Fix Meter/Rhythm">Fix Meter/Rhythm</option>
                <option value="Make it Sadder">Make it Sadder</option>
                <option value="Make it More Abstract">
                  Make it More Abstract
                </option>
                <option value="Make it Punchier">Make it Punchier</option>
              </select>
              <Button
                onClick={handleGenerateAlternatives}
                disabled={selectedLineIndex === null || isGeneratingAlts}
                isLoading={isGeneratingAlts}
              >
                Rewrite
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {alternativesError && (
                <ErrorDisplay
                  error={alternativesError}
                  context="generate alternative lines"
                  onRetry={handleGenerateAlternatives}
                  onDismiss={() => setAlternativesError(null)}
                  className="mb-4"
                />
              )}
              {alternatives.map((alt, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center p-3 rounded-lg group ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}
                >
                  <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{alt}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApplyAlternative(alt)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    Apply
                  </Button>
                </div>
              ))}
              {alternatives.length === 0 && !isGeneratingAlts && !alternativesError && (
                <p className={`italic text-center mt-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Select a line and goal to generate options.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
};

export default LyricLab;
