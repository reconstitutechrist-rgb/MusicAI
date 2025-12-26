import React, { useState, useRef, useCallback, useEffect } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import TimelineEditor from "../ui/TimelineEditor";
import { TimelineSegment, MergeConfiguration, MergeStrategy } from "../../types";
import {
  analyzeSongMerge,
  generateMergeInstructions,
} from "../../services/geminiService";

const SongMerger: React.FC = () => {
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("crossfade");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [error, setError] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainNodesRef = useRef<GainNode[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const stopPlayback = useCallback(() => {
    sourceNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (e) {
        // Node might already be stopped
      }
    });
    sourceNodesRef.current = [];
    gainNodesRef.current = [];

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsPlaying(false);
  }, []);

  // Initialize Audio Context
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    return () => {
      stopPlayback();
      audioContextRef.current?.close();
    };
  }, [stopPlayback]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");

    try {
      const newSegments: TimelineSegment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(
          arrayBuffer,
        );

        // Calculate position for new segment (place after existing segments)
        const lastSegmentEnd =
          segments.length > 0
            ? Math.max(
                ...segments.map((s) => s.startTime + s.duration - s.trimEnd),
              )
            : 0;

        const segment: TimelineSegment = {
          id: generateId(),
          audioUrl: URL.createObjectURL(file),
          audioBuffer: audioBuffer,
          title: file.name.replace(/\.[^/.]+$/, ""),
          startTime: lastSegmentEnd,
          duration: audioBuffer.duration,
          trimStart: 0,
          trimEnd: 0,
          volume: 1,
          fadeIn: 0.5,
          fadeOut: 0.5,
        };

        newSegments.push(segment);
      }

      setSegments([...segments, ...newSegments]);
    } catch (err) {
      console.error(err);
      setError("Failed to load audio files. Please ensure they are valid audio files.");
    }
  };

  const getTotalDuration = () => {
    if (segments.length === 0) return 30;
    return Math.max(
      ...segments.map((s) => s.startTime + s.duration - s.trimEnd),
      30,
    );
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (isPlaying) {
      stopPlayback();
      startPlayback(time);
    }
  };

  const startPlayback = (startTime: number = 0) => {
    if (!audioContextRef.current || segments.length === 0) return;

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    // Clear previous sources
    sourceNodesRef.current.forEach((node) => node.stop());
    sourceNodesRef.current = [];
    gainNodesRef.current = [];

    setCurrentTime(startTime);
    const startTimeRef = now - startTime;

    segments.forEach((segment) => {
      if (!segment.audioBuffer) return;

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = segment.audioBuffer;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Calculate when this segment should start
      const segmentStart = segment.startTime;
      const segmentEnd = segment.startTime + segment.duration - segment.trimEnd;

      if (startTime >= segmentEnd) return; // Skip segments that have already ended

      const offset = Math.max(0, startTime - segmentStart) + segment.trimStart;
      const playTime = Math.max(now, startTimeRef + segmentStart);

      // Set initial volume
      gainNode.gain.setValueAtTime(0, playTime);

      // Apply fade in
      if (segment.fadeIn > 0 && offset < segment.fadeIn) {
        const fadeInEnd = playTime + (segment.fadeIn - offset);
        gainNode.gain.linearRampToValueAtTime(segment.volume, fadeInEnd);
      } else {
        gainNode.gain.setValueAtTime(segment.volume, playTime);
      }

      // Apply fade out
      if (segment.fadeOut > 0) {
        const fadeOutStart =
          playTime + (segment.duration - offset - segment.fadeOut);
        const fadeOutEnd = playTime + (segment.duration - offset);
        gainNode.gain.setValueAtTime(segment.volume, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, fadeOutEnd);
      }

      source.start(playTime, offset);
      source.stop(playTime + (segment.duration - offset));

      sourceNodesRef.current.push(source);
      gainNodesRef.current.push(gainNode);
    });

    // Update time display
    const updateTime = () => {
      const elapsed = ctx.currentTime - startTimeRef;
      setCurrentTime(elapsed);

      if (elapsed < getTotalDuration()) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } else {
        stopPlayback();
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);
    setIsPlaying(true);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(currentTime);
    }
  };

  const handleGetAiSuggestions = async () => {
    if (segments.length < 2) {
      setError("Please add at least 2 songs to get AI suggestions.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      const segmentInfo = segments.map((s) => ({
        title: s.title,
        duration: s.duration,
      }));

      const instructions = await generateMergeInstructions(
        segmentInfo,
        customInstructions || "Create a smooth, professional mashup",
      );

      setAiSuggestions(instructions);
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI suggestions. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeMerge = async () => {
    if (segments.length < 2) {
      setError("Please add at least 2 songs to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    try {
      // Convert audio buffers to base64 for analysis (sample first 10 seconds)
      const segmentData = segments.map((s) => ({
        id: s.id,
        title: s.title,
        duration: s.duration,
        audioBase64: "", // In a full implementation, you'd encode audio here
      }));

      const result = await analyzeSongMerge(
        segmentData,
        customInstructions || "Analyze how to best merge these songs",
      );

      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze merge. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (segments.length === 0) {
      setError("No segments to export.");
      return;
    }

    if (!audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const totalDuration = getTotalDuration();

      // Create offline context for rendering
      const offlineCtx = new OfflineAudioContext(
        2,
        Math.ceil(totalDuration * ctx.sampleRate),
        ctx.sampleRate,
      );

      segments.forEach((segment) => {
        if (!segment.audioBuffer) return;

        const source = offlineCtx.createBufferSource();
        const gainNode = offlineCtx.createGain();

        source.buffer = segment.audioBuffer;
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const startTime = segment.startTime;

        // Apply volume and fades
        gainNode.gain.setValueAtTime(0, startTime);

        if (segment.fadeIn > 0) {
          gainNode.gain.linearRampToValueAtTime(
            segment.volume,
            startTime + segment.fadeIn,
          );
        } else {
          gainNode.gain.setValueAtTime(segment.volume, startTime);
        }

        if (segment.fadeOut > 0) {
          const fadeOutStart =
            startTime + segment.duration - segment.fadeOut - segment.trimEnd;
          gainNode.gain.setValueAtTime(segment.volume, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(
            0,
            startTime + segment.duration - segment.trimEnd,
          );
        }

        source.start(startTime, segment.trimStart);
        source.stop(startTime + segment.duration - segment.trimEnd);
      });

      const renderedBuffer = await offlineCtx.startRendering();

      // Convert to WAV
      const wav = audioBufferToWav(renderedBuffer);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement("a");
      a.href = url;
      a.download = `merged-song-${Date.now()}.wav`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to export merged song. Please try again.");
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(buffer.numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // avg. bytes/sec
    setUint16(buffer.numberOfChannels * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return arrayBuffer;
  };

  const mergeStrategies: { value: MergeStrategy; label: string }[] = [
    { value: "crossfade", label: "Crossfade" },
    { value: "beat-match", label: "Beat Match" },
    { value: "smooth-transition", label: "Smooth Transition" },
    { value: "medley", label: "Medley" },
    { value: "mashup", label: "Mashup" },
    { value: "custom", label: "Custom (AI-Guided)" },
  ];

  return (
    <Page
      title="Song Merger"
      description="Combine multiple songs on a timeline and let AI help you create seamless transitions and professional mixes."
    >
      <div className="space-y-6">
        {/* Upload and Controls */}
        <Card>
          <h3 className="text-xl font-semibold mb-4">1. Add Songs to Timeline</h3>
          <div className="flex flex-wrap gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="primary">
                <svg
                  className="w-5 h-5 mr-2 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Audio Files
              </Button>
            </label>

            <Button
              onClick={handlePlayPause}
              variant={isPlaying ? "secondary" : "primary"}
              disabled={segments.length === 0}
            >
              {isPlaying ? (
                <>
                  <svg
                    className="w-5 h-5 mr-2 inline"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2 inline"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                stopPlayback();
                setCurrentTime(0);
              }}
              variant="secondary"
              disabled={segments.length === 0}
            >
              <svg
                className="w-5 h-5 mr-2 inline"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 6h12v12H6z" />
              </svg>
              Stop
            </Button>

            <Button
              onClick={handleExport}
              variant="primary"
              disabled={segments.length === 0}
            >
              <svg
                className="w-5 h-5 mr-2 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export Merged Song
            </Button>
          </div>

          {segments.length > 0 && (
            <div className="mt-4 text-sm text-gray-400">
              {segments.length} song{segments.length !== 1 ? "s" : ""} loaded •
              Total duration: {getTotalDuration().toFixed(1)}s
            </div>
          )}
        </Card>

        {/* Timeline */}
        {segments.length > 0 && (
          <Card>
            <h3 className="text-xl font-semibold mb-4">2. Arrange on Timeline</h3>
            <TimelineEditor
              segments={segments}
              onSegmentsChange={setSegments}
              duration={getTotalDuration()}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </Card>
        )}

        {/* AI Merge Assistant */}
        <Card>
          <h3 className="text-xl font-semibold mb-4">
            3. AI Merge Assistant
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Merge Strategy
              </label>
              <select
                value={mergeStrategy}
                onChange={(e) => setMergeStrategy(e.target.value as MergeStrategy)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                {mergeStrategies.map((strategy) => (
                  <option key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Describe how you want the songs merged... e.g., 'Create a high-energy mashup with beat-matched transitions' or 'Make a smooth medley that tells a story'"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 min-h-[100px]"
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleGetAiSuggestions}
                disabled={isAnalyzing || segments.length < 2}
                variant="primary"
              >
                {isAnalyzing ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Get AI Suggestions
                  </>
                )}
              </Button>

              <Button
                onClick={handleAnalyzeMerge}
                disabled={isAnalyzing || segments.length < 2}
                variant="secondary"
              >
                Analyze Merge Details
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {aiSuggestions && (
              <div className="p-4 bg-indigo-900/20 border border-indigo-700 rounded-lg">
                <h4 className="text-sm font-semibold text-indigo-400 mb-2">
                  AI Suggestions:
                </h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {aiSuggestions}
                </p>
              </div>
            )}

            {analysisResult && (
              <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg space-y-4">
                <h4 className="text-sm font-semibold text-purple-400">
                  Detailed Analysis:
                </h4>

                <div>
                  <h5 className="text-xs font-semibold text-gray-400 mb-2">
                    Overall Flow:
                  </h5>
                  <p className="text-sm text-gray-300">
                    {analysisResult.overallFlow}
                  </p>
                </div>

                {analysisResult.suggestedTransitions?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-400 mb-2">
                      Suggested Transitions:
                    </h5>
                    <ul className="space-y-2">
                      {analysisResult.suggestedTransitions.map(
                        (t: any, i: number) => (
                          <li key={i} className="text-sm text-gray-300">
                            <span className="text-indigo-400">
                              {t.transitionType}
                            </span>{" "}
                            ({t.transitionDuration}s): {t.reasoning}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                How to Use the Song Merger
              </h4>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Upload multiple audio files using the "Upload Audio Files" button</li>
                <li>Drag segments on the timeline to reposition them</li>
                <li>Click a segment to adjust volume, fades, and other properties</li>
                <li>Use the AI Assistant to get professional merge suggestions</li>
                <li>Preview your mix with the Play button</li>
                <li>Export the final merged song when you're satisfied</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
};

export default SongMerger;
