import React, { useState, useEffect } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import {
  analyzeRhymeAndMeter,
  generateLineAlternatives,
} from "../../services/geminiService";

interface LyricLabProps {
  initialLyrics: string;
  onUpdateLyrics: (newLyrics: string) => void;
}

const LyricLab: React.FC<LyricLabProps> = ({
  initialLyrics,
  onUpdateLyrics,
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isGeneratingAlts, setIsGeneratingAlts] = useState(false);
  const [rewriteGoal, setRewriteGoal] = useState("Improve Rhyme");

  useEffect(() => {
    if (initialLyrics) {
      setLines(initialLyrics.split("\n"));
    }
  }, [initialLyrics]);

  const handleLineClick = async (index: number) => {
    setSelectedLineIndex(index);
    setAnalysis("");
    setAlternatives([]);

    setIsAnalyzing(true);
    try {
      const result = await analyzeRhymeAndMeter(lines[index], initialLyrics);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      setAnalysis("Failed to analyze line.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateAlternatives = async () => {
    if (selectedLineIndex === null) return;
    setIsGeneratingAlts(true);
    try {
      const alts = await generateLineAlternatives(
        lines[selectedLineIndex],
        rewriteGoal,
      );
      setAlternatives(alts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAlts(false);
    }
  };

  const handleApplyAlternative = (alt: string) => {
    if (selectedLineIndex === null) return;
    const newLines = [...lines];
    newLines[selectedLineIndex] = alt;
    setLines(newLines);
    onUpdateLyrics(newLines.join("\n"));
    setAlternatives([]); // Clear options
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLines(text.split("\n"));
    onUpdateLyrics(text);
  };

  return (
    <Page
      title="Lyric Lab"
      description="Fine-tune your lyrics with AI-powered rhyme analysis and magic rewrites."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[75vh]">
        <Card className="flex flex-col h-full">
          <h3 className="text-xl font-semibold mb-4">Editor</h3>
          <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg p-4 font-mono text-lg leading-relaxed">
            {lines.map((line, i) => (
              <div
                key={i}
                onClick={() => handleLineClick(i)}
                className={`p-2 rounded cursor-pointer transition-colors ${selectedLineIndex === i ? "bg-indigo-500/30 ring-1 ring-indigo-500" : "hover:bg-gray-700/50"} ${!line.trim() ? "h-8" : ""}`}
              >
                {line || (
                  <span className="text-gray-600 italic text-sm">
                    -- Empty Line --
                  </span>
                )}
              </div>
            ))}
          </div>
          <textarea
            className="mt-4 w-full bg-gray-800 border-gray-600 rounded-md p-2 text-sm"
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
                <p className="text-gray-400 animate-pulse">
                  Analyzing meter and rhyme...
                </p>
              ) : (
                <div className="prose prose-invert prose-sm">
                  <p className="text-gray-300 whitespace-pre-wrap">
                    {analysis}
                  </p>
                </div>
              )
            ) : (
              <p className="text-gray-500 italic">
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
                className="flex-1 bg-gray-700 border-gray-600 rounded-md text-sm py-2 px-3"
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
              {alternatives.map((alt, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg group"
                >
                  <p className="text-sm text-gray-200">{alt}</p>
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
              {alternatives.length === 0 && !isGeneratingAlts && (
                <p className="text-gray-500 italic text-center mt-8">
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
