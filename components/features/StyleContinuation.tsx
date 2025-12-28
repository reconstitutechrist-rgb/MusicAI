import React, { useState, useRef, useCallback } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import WaveformPlayer from "../ui/WaveformPlayer";
import {
  createStyleContinuation,
  cleanupContinuationResult,
  isStyleContinuationAvailable,
  TARGET_GENRES,
  type ContinuationRequest,
  type ContinuationResult,
  type ContinuationProgress,
  type ContinuationAnalysis,
} from "../../services/styleContinuationService";
import { isCyaniteConfigured } from "../../services/cyaniteService";
import { isStemSeparationConfigured } from "../../services/stemSeparationService";

interface StyleContinuationProps {
  onSendToTimeline?: (song: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
  }) => void;
}

const StyleContinuation: React.FC<StyleContinuationProps> = ({
  onSendToTimeline,
}) => {
  // Input state
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [introDuration, setIntroDuration] = useState<number>(0);

  // Configuration state
  const [targetGenre, setTargetGenre] = useState<string>("rock");
  const [continuationDuration, setContinuationDuration] = useState<number>(15);
  const [extractMelody, setExtractMelody] = useState<boolean>(true);
  const [crossfadePreference, setCrossfadePreference] = useState<
    "auto" | "short" | "medium" | "long"
  >("auto");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // Analysis state
  const [analysis, setAnalysis] = useState<ContinuationAnalysis | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<ContinuationProgress | null>(null);
  const [error, setError] = useState<string>("");

  // Result state
  const [result, setResult] = useState<ContinuationResult | null>(null);
  const [activePreview, setActivePreview] = useState<
    "intro" | "continuation" | "merged"
  >("merged");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousResultRef = useRef<ContinuationResult | null>(null);

  // Check service availability
  const serviceStatus = isStyleContinuationAvailable();
  const hasCyanite = isCyaniteConfigured();
  const hasStemSeparation = isStemSeparationConfigured();

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("audio/")) {
        setError("Please upload an audio file (MP3, WAV, M4A, etc.)");
        return;
      }

      // Clean up previous result
      if (previousResultRef.current) {
        cleanupContinuationResult(previousResultRef.current);
        previousResultRef.current = null;
      }

      setIntroFile(file);
      const url = URL.createObjectURL(file);
      setIntroUrl(url);
      setResult(null);
      setAnalysis(null);
      setError("");

      // Get audio duration
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setIntroDuration(audio.duration);

        // Warn if too long
        if (audio.duration > 30) {
          setError(
            "Note: Only the first 30 seconds will be used for style analysis."
          );
        }
      };
    },
    []
  );

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (fileInputRef.current) {
          fileInputRef.current.files = dataTransfer.files;
          handleFileUpload({
            target: { files: dataTransfer.files },
          } as React.ChangeEvent<HTMLInputElement>);
        }
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Generate continuation
  const handleGenerate = async () => {
    if (!introFile || !targetGenre) return;

    setIsProcessing(true);
    setError("");
    setProgress(null);

    try {
      const request: ContinuationRequest = {
        introAudioFile: introFile,
        introAudioUrl: introUrl || undefined,
        targetGenre,
        continuationDuration,
        extractMelody: extractMelody && hasStemSeparation,
        crossfadePreference,
        customPromptAdditions: customPrompt || undefined,
      };

      const newResult = await createStyleContinuation(request, setProgress);

      // Clean up previous result
      if (previousResultRef.current) {
        cleanupContinuationResult(previousResultRef.current);
      }
      previousResultRef.current = newResult;

      setResult(newResult);
      setAnalysis(newResult.analysis);
      setActivePreview("merged");
    } catch (e) {
      console.error("Style continuation failed:", e);
      setError(
        e instanceof Error ? e.message : "Style continuation failed. Please try again."
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Download result
  const handleDownload = (type: "continuation" | "merged") => {
    if (!result) return;

    const blob = type === "merged" ? result.mergedBlob : result.continuationBlob;
    const filename =
      type === "merged"
        ? `${introFile?.name.replace(/\.[^/.]+$/, "")}_${targetGenre}_merged.wav`
        : `${targetGenre}_continuation.wav`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Send to timeline
  const handleSendToTimeline = () => {
    if (!result || !onSendToTimeline) return;

    onSendToTimeline({
      id: `continuation-${Date.now()}`,
      title: `${introFile?.name || "Intro"} → ${targetGenre}`,
      audioUrl: result.mergedAudioUrl,
      duration: introDuration + continuationDuration - result.crossfadeDuration,
    });
  };

  // Get current preview URL
  const getPreviewUrl = () => {
    if (!result) return introUrl;
    switch (activePreview) {
      case "intro":
        return result.introAudioUrl;
      case "continuation":
        return result.continuationAudioUrl;
      case "merged":
        return result.mergedAudioUrl;
    }
  };

  // Progress bar component
  const ProgressBar = () => {
    if (!progress) return null;

    const stageLabels: Record<string, string> = {
      analyzing: "Analyzing",
      "extracting-melody": "Extracting Melody",
      "building-prompt": "Building Prompt",
      generating: "Generating",
      stitching: "Stitching",
      complete: "Complete",
    };

    return (
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{stageLabels[progress.stage] || progress.stage}</span>
          <span>{Math.round(progress.progress)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
        {progress.substage && (
          <p className="text-xs text-gray-600">{progress.substage}</p>
        )}
      </div>
    );
  };

  // Service unavailable message
  if (!serviceStatus.available) {
    return (
      <Page
        title="Style Morph"
        description="Transform your intro into a different genre with AI-powered continuation"
      >
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-xl font-semibold mb-2">Setup Required</h3>
            <p className="text-gray-400 mb-4">{serviceStatus.message}</p>
            <p className="text-sm text-gray-500">
              Add your Replicate API key to the environment variables to enable
              AI music generation.
            </p>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Style Morph"
      description="Upload an intro in one style, generate a continuation in another. Gospel to rock, jazz to electronic, and more."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Input & Configuration */}
        <div className="space-y-6">
          {/* Upload Section */}
          <Card>
            <h3 className="text-xl font-semibold mb-4">1. Upload Your Intro</h3>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                introFile
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-gray-600 hover:border-gray-500"
              }`}
            >
              {introFile ? (
                <div>
                  <div className="text-3xl mb-2">🎵</div>
                  <p className="font-medium">{introFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {introDuration.toFixed(1)}s duration
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📁</div>
                  <p className="text-gray-400 mb-2">
                    Drag & drop your intro audio here
                  </p>
                  <p className="text-xs text-gray-500">
                    MP3, WAV, M4A (max 30 seconds recommended)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4"
              >
                {introFile ? "Change File" : "Browse Files"}
              </Button>
            </div>

            {introUrl && (
              <div className="mt-4 bg-gray-900/50 p-4 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Intro Preview</p>
                <WaveformPlayer audioUrl={introUrl} />
              </div>
            )}
          </Card>

          {/* Analysis Display */}
          {analysis && (
            <Card>
              <h3 className="text-lg font-semibold mb-3">Intro Analysis</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-gray-400 text-xs">BPM</p>
                  <p className="text-xl font-bold">{Math.round(analysis.bpm)}</p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-gray-400 text-xs">Key</p>
                  <p className="text-xl font-bold">{analysis.key}</p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-gray-400 text-xs">Detected Genre</p>
                  <p className="font-medium">
                    {analysis.genres[0]?.name || "Unknown"}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-gray-400 text-xs">Mood</p>
                  <p className="font-medium">
                    {analysis.moods[0]?.name || "Neutral"}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Configuration */}
          <Card>
            <h3 className="text-xl font-semibold mb-4">2. Configure Continuation</h3>

            {/* Target Genre */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Genre
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TARGET_GENRES.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => setTargetGenre(genre.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      targetGenre === genre.id
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    }`}
                    title={genre.description}
                  >
                    {genre.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Continuation Duration: {continuationDuration}s
              </label>
              <input
                type="range"
                min={5}
                max={30}
                value={continuationDuration}
                onChange={(e) => setContinuationDuration(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5s</span>
                <span>30s</span>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4 mb-6">
              {hasStemSeparation && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extractMelody}
                    onChange={(e) => setExtractMelody(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Extract melody for conditioning
                    </span>
                    <p className="text-xs text-gray-500">
                      Uses stem separation to extract the melody for better
                      musical coherence
                    </p>
                  </div>
                </label>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Crossfade
                </label>
                <div className="flex gap-2">
                  {(["auto", "short", "medium", "long"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setCrossfadePreference(opt)}
                      className={`px-3 py-1 rounded text-sm capitalize ${
                        crossfadePreference === opt
                          ? "bg-purple-500 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Custom Style Notes (optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add specific style instructions, e.g., 'heavy distorted guitars, fast tempo'"
                className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 text-sm focus:ring-purple-500 focus:border-purple-500"
                rows={2}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!introFile || isProcessing}
              className="w-full"
              variant="primary"
            >
              {isProcessing ? "Generating..." : "Generate Continuation"}
            </Button>

            {/* Service status indicators */}
            <div className="mt-4 flex gap-4 text-xs">
              <span
                className={`flex items-center gap-1 ${hasCyanite ? "text-green-400" : "text-gray-500"}`}
              >
                <span className={`w-2 h-2 rounded-full ${hasCyanite ? "bg-green-400" : "bg-gray-600"}`} />
                Analysis {hasCyanite ? "enabled" : "basic"}
              </span>
              <span
                className={`flex items-center gap-1 ${hasStemSeparation ? "text-green-400" : "text-gray-500"}`}
              >
                <span className={`w-2 h-2 rounded-full ${hasStemSeparation ? "bg-green-400" : "bg-gray-600"}`} />
                Melody extraction {hasStemSeparation ? "enabled" : "disabled"}
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column - Progress & Results */}
        <div className="space-y-6">
          {/* Progress */}
          {isProcessing && (
            <Card>
              <h3 className="text-xl font-semibold mb-4">Processing</h3>
              <ProgressBar />
              <div className="text-center text-gray-400 text-sm">
                <p>This may take 1-3 minutes depending on duration.</p>
                <p className="text-xs mt-1">
                  Please keep this tab open while processing.
                </p>
              </div>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Card>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card>
              <h3 className="text-xl font-semibold mb-4">Result</h3>

              {/* Preview Tabs */}
              <div className="flex gap-2 mb-4">
                {(["intro", "continuation", "merged"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivePreview(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activePreview === tab
                        ? "bg-purple-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {tab === "intro"
                      ? "Intro"
                      : tab === "continuation"
                        ? "Continuation"
                        : "Full Track"}
                  </button>
                ))}
              </div>

              {/* Waveform Player */}
              <div className="bg-gray-900/50 p-4 rounded-lg mb-4">
                <WaveformPlayer audioUrl={getPreviewUrl() || ""} />
              </div>

              {/* Info */}
              <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                <div className="bg-gray-900/50 p-3 rounded text-center">
                  <p className="text-gray-400 text-xs">Genre Transition</p>
                  <p className="font-medium">
                    {analysis?.genres[0]?.name || "?"} → {targetGenre}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded text-center">
                  <p className="text-gray-400 text-xs">Crossfade</p>
                  <p className="font-medium">{result.crossfadeDuration.toFixed(1)}s</p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded text-center">
                  <p className="text-gray-400 text-xs">Total Duration</p>
                  <p className="font-medium">
                    {(
                      introDuration +
                      continuationDuration -
                      result.crossfadeDuration
                    ).toFixed(1)}
                    s
                  </p>
                </div>
              </div>

              {/* Generated Prompt */}
              <div className="mb-6">
                <p className="text-xs text-gray-400 mb-1">Generated Prompt:</p>
                <p className="text-sm text-gray-300 bg-gray-900/50 p-2 rounded italic">
                  "{result.prompt}"
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => handleDownload("merged")}
                >
                  Download Full Track
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleDownload("continuation")}
                >
                  Download Continuation Only
                </Button>
                {onSendToTimeline && (
                  <Button variant="secondary" onClick={handleSendToTimeline}>
                    Send to Timeline
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Tips */}
          {!result && !isProcessing && (
            <Card>
              <h3 className="text-lg font-semibold mb-3">Tips for Best Results</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex gap-2">
                  <span>🎵</span>
                  <span>
                    Use a clear, well-recorded intro (15-30 seconds works best)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>🎸</span>
                  <span>
                    The AI will try to match the BPM and key of your intro
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>🎹</span>
                  <span>
                    Enable melody extraction for better musical coherence
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>🎚️</span>
                  <span>
                    Use custom style notes to fine-tune the generated sound
                  </span>
                </li>
                <li className="flex gap-2">
                  <span>⚡</span>
                  <span>
                    Choose contrasting genres for dramatic transitions (gospel →
                    metal)
                  </span>
                </li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
};

export default StyleContinuation;
