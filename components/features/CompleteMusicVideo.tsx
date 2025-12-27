import React, { useState, useEffect, useCallback } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import {
  generateAutoVideoScenes,
  generateVideo,
  extendVideo,
  pollVideoOperation,
  generateLyricsTiming,
} from "../../services/geminiService";
import {
  initFFmpeg,
  isFFmpegReady,
  mergeVideoWithAudio,
  createLyricVideo,
} from "../../services/videoProcessingService";
import { LyricLine } from "../../types";
import { GenerateVideosOperation } from "@google/genai";

interface CompleteMusicVideoProps {
  lyrics: string;
  songConcept: string;
  songStyle?: string;
  instrumentalUrl?: string;
  vocalUrl?: string;
  songDuration?: number;
}

type VideoStyle = "lyric-video" | "visual-only" | "performance";
type VideoType = "auto" | "manual";

const CompleteMusicVideo: React.FC<CompleteMusicVideoProps> = ({
  lyrics,
  songConcept,
  songStyle = "Pop",
  instrumentalUrl,
  vocalUrl,
  songDuration = 180,
}) => {
  const [videoType, setVideoType] = useState<VideoType>("auto");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("visual-only");
  const [selectedAudio, setSelectedAudio] = useState<
    "instrumental" | "vocal" | "none"
  >("instrumental");

  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">(
    "16:9",
  );
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const [generatedScenes, setGeneratedScenes] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [finalVideoUrl, setFinalVideoUrl] = useState("");

  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [apiKeySelected, setApiKeySelected] = useState(false);

  // Check API key and initialize FFmpeg
  useEffect(() => {
    const init = async () => {
      // Check API key
      if (typeof (window as any).aistudio === "undefined") {
        setApiKeySelected(true);
      } else {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }

      // Initialize FFmpeg
      if (!isFFmpegReady()) {
        try {
          await initFFmpeg((progress) => {
            console.log(`FFmpeg loading: ${progress}%`);
          });
          setFfmpegReady(true);
        } catch (err) {
          console.error("FFmpeg initialization failed:", err);
          setFfmpegReady(false);
        }
      } else {
        setFfmpegReady(true);
      }
    };

    init();
  }, []);

  const handleSelectKey = async () => {
    await (window as any).aistudio.openSelectKey();
    setApiKeySelected(true);
  };

  const generateCompleteVideo = async () => {
    if (!lyrics || !songConcept) {
      setError("Please create a song first before generating a music video.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setProgress(0);
    setVideoUrl("");
    setFinalVideoUrl("");

    try {
      // Step 1: Auto-generate scene prompts
      setCurrentStep("Analyzing song structure and generating scene concepts...");
      setProgress(5);

      const scenePrompts = await generateAutoVideoScenes(
        lyrics,
        songConcept,
        songStyle,
        songDuration,
      );

      setGeneratedScenes(scenePrompts);
      setProgress(15);

      // Step 2: Generate video scenes
      setCurrentStep(`Generating ${scenePrompts.length} video scenes...`);

      let lastOperation: GenerateVideosOperation | null = null;
      const totalScenes = scenePrompts.length;

      for (let i = 0; i < scenePrompts.length; i++) {
        const sceneProgress = 15 + ((i / totalScenes) * 40);
        setProgress(sceneProgress);
        setCurrentStep(
          `Generating scene ${i + 1} of ${totalScenes}: "${scenePrompts[i].substring(0, 60)}..."`,
        );

        let currentOperation: GenerateVideosOperation;

        if (i === 0) {
          // First scene - generate from scratch
          currentOperation = await generateVideo(
            scenePrompts[i],
            aspectRatio,
            resolution,
          );
        } else {
          // Extend from previous scene
          if (!lastOperation) {
            throw new Error("Cannot extend: previous operation is missing");
          }
          currentOperation = await extendVideo(
            scenePrompts[i],
            lastOperation,
            aspectRatio,
          );
        }

        // Poll until complete
        let pollCount = 0;
        while (!currentOperation.done) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          currentOperation = await pollVideoOperation(currentOperation);
          pollCount++;
          setCurrentStep(
            `Scene ${i + 1} processing... (${pollCount * 10} seconds)`,
          );
        }

        if (currentOperation.error) {
          const errorMessage = typeof currentOperation.error === 'object' &&
            currentOperation.error !== null &&
            'message' in currentOperation.error
              ? String((currentOperation.error as { message: unknown }).message)
              : "Video generation failed";
          throw new Error(errorMessage);
        }

        lastOperation = currentOperation;
      }

      // Get final video URL
      setProgress(55);
      setCurrentStep("Downloading generated video...");

      const downloadLink =
        lastOperation?.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error("No video URL in response");
      }

      const videoResponse = await fetch(
        `${downloadLink}&key=${import.meta.env.VITE_GEMINI_API_KEY}`,
      );
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();
      const tempVideoUrl = URL.createObjectURL(videoBlob);
      setVideoUrl(tempVideoUrl);
      setProgress(65);

      // Step 3: Process with audio and/or lyrics
      const audioUrl =
        selectedAudio === "instrumental"
          ? instrumentalUrl
          : selectedAudio === "vocal"
            ? vocalUrl
            : null;

      if (videoStyle === "lyric-video" && audioUrl) {
        // Generate lyric video with synchronized text overlays
        setCurrentStep("Generating lyric timing data...");
        setProgress(70);

        const timingData = await generateLyricsTiming(
          lyrics,
          songDuration,
          songStyle,
        );

        const lyricLines: LyricLine[] = timingData.lyricLines.map(
          (line, idx) => ({
            id: `line-${idx}`,
            text: line.text,
            startTime: line.startTime,
            endTime: line.endTime,
            sectionTag: line.sectionTag,
          }),
        );

        setCurrentStep("Rendering lyrics onto video...");
        setProgress(75);

        const lyricVideoUrl = await createLyricVideo(
          tempVideoUrl,
          audioUrl,
          lyricLines,
          {
            fontSize: 52,
            fontFamily: "Arial, sans-serif",
            textColor: "#FFFFFF",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            position: "bottom",
            highlightColor: "#FFD700",
          },
          (status, percent) => {
            setCurrentStep(status);
            setProgress(75 + (percent / 100) * 20);
          },
        );

        setFinalVideoUrl(lyricVideoUrl);
        setProgress(100);
        setCurrentStep("Complete! Your lyric video is ready.");
      } else if (audioUrl) {
        // Merge video with audio (no lyrics)
        setCurrentStep("Merging video with audio track...");
        setProgress(80);

        const mergedUrl = await mergeVideoWithAudio(
          tempVideoUrl,
          audioUrl,
          "mp4",
          (status) => {
            setCurrentStep(status);
          },
        );

        setFinalVideoUrl(mergedUrl);
        setProgress(100);
        setCurrentStep("Complete! Your music video is ready.");
      } else {
        // No audio - just use the generated video
        setFinalVideoUrl(tempVideoUrl);
        setProgress(100);
        setCurrentStep("Complete! Your video is ready.");
      }
    } catch (err: any) {
      console.error("Music video generation error:", err);
      setError(
        err.message || "Failed to generate music video. Please try again.",
      );
      setCurrentStep("");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!apiKeySelected) {
    return (
      <Card className="text-center">
        <h3 className="text-xl font-semibold mb-4">
          API Key Required for Video Generation
        </h3>
        <p className="text-gray-400 mb-6">
          Complete music video generation requires a Google AI API key with
          billing enabled.
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline ml-2"
          >
            Learn more about billing.
          </a>
        </p>
        <Button onClick={handleSelectKey}>Select API Key</Button>
      </Card>
    );
  }

  if (!lyrics) {
    return (
      <Card>
        <p className="text-center text-gray-400">
          Please generate a song in the "Create" tab before making a music
          video.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <h3 className="text-xl font-semibold mb-4">
          ⚡ Complete Music Video Generator
        </h3>
        <p className="text-gray-400 mb-6">
          Automatically generate a full music video with synchronized audio and
          optional lyric overlays.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Video Style */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Style
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                <input
                  type="radio"
                  name="videoStyle"
                  value="visual-only"
                  checked={videoStyle === "visual-only"}
                  onChange={(e) =>
                    setVideoStyle(e.target.value as VideoStyle)
                  }
                  className="h-4 w-4 text-indigo-600"
                />
                <div>
                  <div className="font-medium">Visual Music Video</div>
                  <div className="text-xs text-gray-400">
                    Cinematic scenes with audio, no text overlays
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                <input
                  type="radio"
                  name="videoStyle"
                  value="lyric-video"
                  checked={videoStyle === "lyric-video"}
                  onChange={(e) =>
                    setVideoStyle(e.target.value as VideoStyle)
                  }
                  className="h-4 w-4 text-indigo-600"
                  disabled={!ffmpegReady}
                />
                <div>
                  <div className="font-medium">
                    Lyric Video{" "}
                    {!ffmpegReady && (
                      <span className="text-xs text-yellow-400">
                        (Loading video processor...)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    Synchronized lyrics displayed karaoke-style
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Audio Track */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Audio Track
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                <input
                  type="radio"
                  name="audioTrack"
                  value="instrumental"
                  checked={selectedAudio === "instrumental"}
                  onChange={(e) =>
                    setSelectedAudio(
                      e.target.value as "instrumental" | "vocal" | "none",
                    )
                  }
                  disabled={!instrumentalUrl}
                  className="h-4 w-4 text-indigo-600"
                />
                <div>
                  <div className="font-medium">
                    Instrumental{" "}
                    {!instrumentalUrl && (
                      <span className="text-xs text-gray-500">
                        (Not available)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    Use generated instrumental track
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                <input
                  type="radio"
                  name="audioTrack"
                  value="vocal"
                  checked={selectedAudio === "vocal"}
                  onChange={(e) =>
                    setSelectedAudio(
                      e.target.value as "instrumental" | "vocal" | "none",
                    )
                  }
                  disabled={!vocalUrl}
                  className="h-4 w-4 text-indigo-600"
                />
                <div>
                  <div className="font-medium">
                    With Vocals{" "}
                    {!vocalUrl && (
                      <span className="text-xs text-gray-500">
                        (Not available)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    Use vocal track from production
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                <input
                  type="radio"
                  name="audioTrack"
                  value="none"
                  checked={selectedAudio === "none"}
                  onChange={(e) =>
                    setSelectedAudio(
                      e.target.value as "instrumental" | "vocal" | "none",
                    )
                  }
                  className="h-4 w-4 text-indigo-600"
                />
                <div>
                  <div className="font-medium">Silent Video</div>
                  <div className="text-xs text-gray-400">
                    No audio (for editing)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Video Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) =>
                setAspectRatio(e.target.value as "16:9" | "9:16" | "1:1")
              }
              disabled={isGenerating}
              className="block w-full bg-gray-700 border-gray-600 rounded-md"
            >
              <option value="16:9">Landscape (16:9) - YouTube</option>
              <option value="9:16">Portrait (9:16) - TikTok/Reels</option>
              <option value="1:1">Square (1:1) - Instagram</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quality
            </label>
            <select
              value={resolution}
              onChange={(e) =>
                setResolution(e.target.value as "720p" | "1080p")
              }
              disabled={isGenerating}
              className="block w-full bg-gray-700 border-gray-600 rounded-md"
            >
              <option value="720p">HD (720p) - Faster</option>
              <option value="1080p">Full HD (1080p) - Best Quality</option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-6">
          <Button
            onClick={generateCompleteVideo}
            isLoading={isGenerating}
            disabled={
              !lyrics ||
              !songConcept ||
              (videoStyle === "lyric-video" && !ffmpegReady) ||
              (selectedAudio !== "none" && !instrumentalUrl && !vocalUrl)
            }
            className="w-full"
          >
            {isGenerating ? "Generating..." : "🎬 Generate Complete Music Video"}
          </Button>

          {!instrumentalUrl && !vocalUrl && (
            <p className="text-sm text-yellow-400 mt-2 text-center">
              ⚠️ No audio tracks available. Generate audio in the Production
              tab first, or create a silent video.
            </p>
          )}
        </div>
      </Card>

      {/* Progress Panel */}
      {isGenerating && (
        <Card>
          <h4 className="text-lg font-semibold mb-4">Generation Progress</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{currentStep}</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-500/50">
          <div className="text-red-400">
            <h4 className="font-semibold mb-2">❌ Error</h4>
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Video Preview */}
      {(videoUrl || finalVideoUrl) && (
        <Card>
          <h4 className="text-lg font-semibold mb-4">
            {finalVideoUrl ? "✨ Final Music Video" : "🎬 Generated Video"}
          </h4>

          <div className="bg-black rounded-lg overflow-hidden">
            <video
              key={finalVideoUrl || videoUrl}
              controls
              autoPlay
              loop
              className="w-full"
            >
              <source src={finalVideoUrl || videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="mt-4 flex gap-4">
            <a
              href={finalVideoUrl || videoUrl}
              download={`MUSE_AI_MusicVideo_${Date.now()}.mp4`}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              📥 Download Video
            </a>

            {generatedScenes.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  const scenesText = generatedScenes
                    .map((scene, i) => `Scene ${i + 1}: ${scene}`)
                    .join("\n\n");
                  navigator.clipboard.writeText(scenesText);
                  alert("Scene prompts copied to clipboard!");
                }}
              >
                📋 Copy Scene Prompts
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Info Panel */}
      <Card className="bg-gray-800/30">
        <h4 className="text-sm font-semibold mb-2 text-gray-400">
          💡 How It Works
        </h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>
            • AI analyzes your song structure and generates {Math.ceil(songDuration / 7)} cinematic scenes
          </li>
          <li>
            • Each scene is 7 seconds, automatically stitched into a complete
            video
          </li>
          <li>
            • Lyric videos use karaoke-style synchronized text overlays
          </li>
          <li>
            • All processing happens in your browser (video processing uses
            ~30MB)
          </li>
          <li>
            • Generation time: ~{Math.ceil(songDuration / 7)} minutes for a {Math.floor(songDuration / 60)}-minute song
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default CompleteMusicVideo;
