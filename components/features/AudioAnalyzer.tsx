import React, { useState } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { analyzeAudioTrack } from "../../services/geminiService";
import { AudioAnalysisResult } from "../../types";
import WaveformPlayer from "../ui/WaveformPlayer";

const AudioAnalyzer: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioUrl(URL.createObjectURL(file));
    setMimeType(file.type);
    setAnalysis(null);
    setError("");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setAudioBase64((reader.result as string).split(",")[1]);
    };
  };

  const handleAnalyze = async () => {
    if (!audioBase64) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const result = await analyzeAudioTrack(audioBase64, mimeType);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      setError(
        "Failed to analyze audio. Please try a shorter clip or different format.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Page
      title="AI Audio Critic"
      description="Get professional feedback, technical analysis, and genre classification for your tracks."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <h3 className="text-xl font-semibold mb-4">Upload Track</h3>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center bg-gray-800/50 hover:bg-gray-800 transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                id="audio-upload"
              />
              <label htmlFor="audio-upload" className="cursor-pointer block">
                <p className="text-gray-400 mb-2">Click to upload audio file</p>
                <p className="text-xs text-gray-500">MP3, WAV, M4A supported</p>
              </label>
            </div>
            {audioUrl && (
              <div className="mt-4">
                <WaveformPlayer audioUrl={audioUrl} />
                <Button
                  onClick={handleAnalyze}
                  isLoading={isAnalyzing}
                  className="w-full mt-4"
                >
                  Analyze Track
                </Button>
              </div>
            )}
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
          </Card>
        </div>

        <div className="md:col-span-2">
          {analysis ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center py-4 bg-indigo-900/20 border-indigo-500/30">
                  <p className="text-xs text-indigo-300 uppercase font-bold">
                    BPM
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {analysis.bpm}
                  </p>
                </Card>
                <Card className="text-center py-4 bg-purple-900/20 border-purple-500/30">
                  <p className="text-xs text-purple-300 uppercase font-bold">
                    Key
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {analysis.key}
                  </p>
                </Card>
                <Card className="text-center py-4 bg-pink-900/20 border-pink-500/30">
                  <p className="text-xs text-pink-300 uppercase font-bold">
                    Genre
                  </p>
                  <p className="text-lg font-bold text-white">
                    {analysis.genre}
                  </p>
                </Card>
                <Card className="text-center py-4 bg-blue-900/20 border-blue-500/30">
                  <p className="text-xs text-blue-300 uppercase font-bold">
                    Mood
                  </p>
                  <p className="text-lg font-bold text-white">
                    {analysis.mood}
                  </p>
                </Card>
              </div>

              <Card>
                <h3 className="text-xl font-semibold mb-4 text-indigo-300">
                  Production Feedback
                </h3>
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {analysis.productionFeedback}
                </p>
              </Card>

              <Card>
                <h3 className="text-xl font-semibold mb-4">Detected Chords</h3>
                <div className="flex flex-wrap gap-3">
                  {analysis.chords.map((chord, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-gray-700 rounded-lg font-mono font-bold text-indigo-200 border border-gray-600"
                    >
                      {chord}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700 min-h-[400px]">
              <p className="text-gray-500">
                Upload a track and click Analyze to see AI insights.
              </p>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};

export default AudioAnalyzer;
