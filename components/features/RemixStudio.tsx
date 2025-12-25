import React, { useState, useRef } from "react";
import Page from "../ui/Page";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { remixAudioTrack } from "../../services/geminiService";
import WaveformPlayer from "../ui/WaveformPlayer";

const RemixStudio: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () =>
      setAudioBase64((reader.result as string).split(",")[1]);
    setResultUrl(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () =>
          setAudioBase64((reader.result as string).split(",")[1]);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleRemix = async () => {
    if (!audioBase64 || !remixPrompt.trim()) return;
    setIsProcessing(true);
    setError("");
    try {
      const resultBase64 = await remixAudioTrack(audioBase64, remixPrompt);
      const binaryString = atob(resultBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
      setError("Remix failed. Please try a different prompt or shorter audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const PRESETS = [
    "Convert this beatbox to a realistic drum kit",
    "Make this melody sound like an 8-bit synthesizer",
    "Add a cinematic reverb and slow it down slightly",
    "Transform this into a lo-fi hip hop sample",
  ];

  return (
    <Page
      title="Remix Studio"
      description="Transform your audio with AI style transfer. Convert beatboxing to drums, hums to violins, and more."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <h3 className="text-xl font-semibold mb-4">1. Input Source</h3>
          <div className="flex gap-4 mb-6">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "secondary" : "primary"}
              className={
                isRecording ? "bg-red-600 hover:bg-red-700 text-white" : ""
              }
            >
              {isRecording ? "Stop Recording" : "Record Microphone"}
            </Button>
            <div className="relative overflow-hidden inline-block">
              <Button variant="secondary">Upload File</Button>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {audioUrl && (
            <div className="bg-gray-900/50 p-4 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">Input Preview</p>
              <WaveformPlayer audioUrl={audioUrl} />
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-xl font-semibold mb-4">2. Transformation</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prompt
              </label>
              <textarea
                value={remixPrompt}
                onChange={(e) => setRemixPrompt(e.target.value)}
                className="w-full bg-gray-900 border-gray-600 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                placeholder="Describe how you want to transform the audio..."
              />
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">Presets:</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setRemixPrompt(p)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleRemix}
              disabled={!audioBase64 || !remixPrompt || isProcessing}
              isLoading={isProcessing}
              className="w-full"
            >
              Generate Remix
            </Button>
          </div>
        </Card>

        {resultUrl && (
          <Card className="lg:col-span-2 border-indigo-500/50">
            <h3 className="text-xl font-semibold mb-4 text-indigo-300">
              Remix Result
            </h3>
            <WaveformPlayer audioUrl={resultUrl} />
            <div className="mt-4 flex justify-end">
              <a
                href={resultUrl}
                download={`MUSE_REMIX_${Date.now()}.wav`}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Download Result
              </a>
            </div>
          </Card>
        )}
        {error && (
          <p className="text-red-400 lg:col-span-2 text-center">{error}</p>
        )}
      </div>
    </Page>
  );
};

export default RemixStudio;
