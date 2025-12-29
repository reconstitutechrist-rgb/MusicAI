import React, { useState, useEffect, useCallback, useRef } from "react";
import Page from "../ui/Page";
import Tabs from "../ui/Tabs";
import Card from "../ui/Card";
import Button from "../ui/Button";
import {
  generateImage,
  editImage,
  analyzeImage,
  generateVideo,
  pollVideoOperation,
  extendVideo,
  generateChatResponse,
  summarizeConversationForVideo,
} from "../../services/geminiService";
import {
  initFFmpeg,
  isFFmpegReady,
  mergeVideoWithAudio,
  trimVideo,
  convertVideoFormat,
  concatenateVideos,
} from "../../services/videoProcessingService";
import { ChatMessage } from "../../types";
import { useUndoRedo } from "./MusicCreation";
import CompleteMusicVideo from "./CompleteMusicVideo";

interface VideoCreationProps {
  lyrics: string;
  songConcept: string;
  songStyle?: string;
  instrumentalUrl?: string;
  vocalUrl?: string;
  songDuration?: number;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = (error) => reject(error);
  });

const PaperClipIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
    />
  </svg>
);

interface ImageStudioProps {
  currentImage: { url: string; base64: string; mimeType: string } | null;
  setCurrentImage: React.Dispatch<
    React.SetStateAction<{
      url: string;
      base64: string;
      mimeType: string;
    } | null>
  >;
}

const imageStyles = [
  "Cinematic",
  "Anime",
  "Watercolor",
  "Photorealistic",
  "Vintage",
  "Minimalist",
];

// New Unified Image Studio Component
const ImageStudio: React.FC<ImageStudioProps> = ({
  currentImage,
  setCurrentImage,
}) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Hello! Let's create some visuals. Describe an image, or upload one to start.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [aspectRatio, setAspectRatio] = useState<
    "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
  >("1:1");
  const [selectedStyle, setSelectedStyle] = useState<string>("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsLoading(true);
      try {
        const base64 = await fileToBase64(file);
        setCurrentImage({
          url: URL.createObjectURL(file),
          base64: base64,
          mimeType: file.type,
        });
        setChatMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: `Uploaded ${file.name}. What would you like to do? You can describe an edit, or type '/analyze' followed by a question.`,
          },
        ]);
      } catch (err) {
        setError("Failed to load image.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userInput = chatInput;
    const userMessage: ChatMessage = { role: "user", text: userInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setIsLoading(true);
    setError("");

    try {
      // Analysis flow
      if (userInput.trim().startsWith("/analyze")) {
        if (!currentImage) {
          throw new Error(
            "Please upload or generate an image before using /analyze.",
          );
        }
        const analysisPrompt = userInput.replace("/analyze", "").trim();
        const analysisResult = await analyzeImage(
          analysisPrompt,
          currentImage.base64,
          currentImage.mimeType,
        );
        const modelMessage: ChatMessage = {
          role: "model",
          text: analysisResult,
        };
        setChatMessages([...newMessages, modelMessage]);
      }
      // Editing flow
      else if (currentImage) {
        const editPrompt = userInput;
        const newImageUrl = await editImage(
          editPrompt,
          currentImage.base64,
          currentImage.mimeType,
        );
        const newMimeType = newImageUrl.split(";")[0].split(":")[1];
        const newBase64 = newImageUrl.split(",")[1];
        setCurrentImage({
          url: newImageUrl,
          base64: newBase64,
          mimeType: newMimeType,
        });
        const modelMessage: ChatMessage = {
          role: "model",
          text: "Here's the edited image. What's next?",
        };
        setChatMessages([...newMessages, modelMessage]);
      }
      // Generation flow
      else {
        const generationPrompt = selectedStyle
          ? `${selectedStyle} style, ${userInput}`
          : userInput;
        const newImageUrl = await generateImage(generationPrompt, aspectRatio);
        const newMimeType = newImageUrl.split(";")[0].split(":")[1];
        const newBase64 = newImageUrl.split(",")[1];
        setCurrentImage({
          url: newImageUrl,
          base64: newBase64,
          mimeType: newMimeType,
        });
        const modelMessage: ChatMessage = {
          role: "model",
          text: "I've created this image for you. You can now ask me to edit it.",
        };
        setChatMessages([...newMessages, modelMessage]);
      }
    } catch (e: any) {
      const errorMessage = e.message || "An error occurred. Please try again.";
      setError(errorMessage);
      const errorModelMessage: ChatMessage = {
        role: "model",
        text: `Sorry, I ran into an issue: ${errorMessage}`,
      };
      setChatMessages([...newMessages, errorModelMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-15rem)]">
      {/* Left Side: Chat */}
      <div className="lg:col-span-1 h-full">
        <Card className="h-full flex flex-col">
          <h3 className="text-xl font-semibold mb-4">
            Image Studio Conversation
          </h3>
          <div className="flex-1 h-96 overflow-y-auto bg-gray-900/50 rounded-lg p-4 space-y-4">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-700"}`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-4">
            <div className="flex">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="ghost"
                className="rounded-r-none border-r-0 border-gray-600"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                aria-label="Attach image"
              >
                <PaperClipIcon className="h-5 w-5" />
              </Button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleChatSend()}
                className="flex-1 bg-gray-700 border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 rounded-none"
                placeholder={
                  currentImage
                    ? "Describe an edit, or type '/analyze...'"
                    : "Describe the image you want to create..."
                }
                disabled={isLoading}
              />
              <Button
                onClick={handleChatSend}
                isLoading={isLoading}
                className="rounded-l-none"
              >
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {/* Right Side: Image */}
      <div className="lg:col-span-1 h-full">
        <Card className="h-full flex flex-col">
          <h3 className="text-xl font-semibold mb-4">Generated Image</h3>

          {!currentImage && (
            <div className="mb-4 space-y-4">
              <div>
                <label
                  htmlFor="aspect-ratio-select"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Aspect Ratio
                </label>
                <select
                  id="aspect-ratio-select"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as any)}
                  className="block w-full bg-gray-900 border-gray-600 rounded-md text-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="16:9">Landscape (16:9)</option>
                  <option value="9:16">Portrait (9:16)</option>
                  <option value="4:3">Standard (4:3)</option>
                  <option value="3:4">Tall (3:4)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Artistic Style
                </label>
                <div className="flex flex-wrap gap-2">
                  {imageStyles.map((style) => (
                    <Button
                      key={style}
                      size="sm"
                      variant={
                        selectedStyle === style ? "primary" : "secondary"
                      }
                      onClick={() =>
                        setSelectedStyle(style === selectedStyle ? "" : style)
                      }
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center bg-gray-900/50 rounded-lg p-4 min-h-0">
            {isLoading && !currentImage && (
              <p className="text-gray-400">Generating your image...</p>
            )}
            {!isLoading && !currentImage && (
              <p className="text-gray-400">Your image will appear here.</p>
            )}
            {currentImage && (
              <img
                src={currentImage.url}
                alt="Generated or uploaded visual"
                className="rounded-lg max-w-full max-h-full object-contain"
              />
            )}
          </div>
          {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
          {currentImage && !isLoading && (
            <a
              href={currentImage.url}
              download={`MUSE_AI_IMAGE_${Date.now()}.jpg`}
              className="inline-flex items-center justify-center w-full px-4 py-2 mt-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Download Image
            </a>
          )}
        </Card>
      </div>
    </div>
  );
};

interface MusicVideoGeneratorProps extends VideoCreationProps {
  imageFromStudio: { url: string; base64: string; mimeType: string } | null;
}

// Music Video Generator Component
const MusicVideoGenerator: React.FC<MusicVideoGeneratorProps> = ({
  lyrics,
  songConcept,
  imageFromStudio,
}) => {
  const {
    state: chatMessages,
    set: setChatMessages,
    undo: undoChat,
    redo: redoChat,
    reset: resetChat,
    canUndo: canUndoChat,
    canRedo: canRedoChat,
  } = useUndoRedo<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);

  const [generationState, setGenerationState] = useState<
    "concept" | "generating" | "refining"
  >("concept");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">(
    "16:9",
  );
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [useStudioImage, setUseStudioImage] = useState(false);

  const [apiKeySelected, setApiKeySelected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const checkApiKey = useCallback(async () => {
    if (typeof (window as any).aistudio === "undefined") {
      setApiKeySelected(true);
      return;
    }
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    setApiKeySelected(hasKey);
  }, []);

  useEffect(() => {
    checkApiKey();
    resetChat([
      {
        role: "model",
        text: `Let's create a music video! I see the song concept is: "${songConcept || "Not specified"}".\n\nTell me about the visual style, mood, and story you envision. We'll build the concept together.`,
      },
    ]);
  }, [checkApiKey, songConcept, resetChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSelectKey = async () => {
    await (window as any).aistudio.openSelectKey();
    setApiKeySelected(true);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isAiTyping) return;

    const newUserMessage: ChatMessage = { role: "user", text: chatInput };
    const currentInput = chatInput;
    setChatInput("");

    const messagesWithUser = [...chatMessages, newUserMessage];
    setChatMessages(messagesWithUser);

    setIsAiTyping(true);
    setError("");

    try {
      const systemInstruction = `You are a creative director for music videos. Your goal is to help the user develop a detailed concept for their song based on its lyrics and concept. Ask clarifying questions about visual themes, color palettes, scene transitions, and narrative. Song concept: "${songConcept}". Lyrics: "${lyrics}"`;
      const responseText = await generateChatResponse(
        chatMessages,
        currentInput,
        systemInstruction,
      );
      // FIX: Explicitly type modelMessage as ChatMessage to satisfy TypeScript's stricter type checking for the 'role' property.
      const modelMessage: ChatMessage = { role: "model", text: responseText };
      setChatMessages([...messagesWithUser, modelMessage]);
    } catch (e) {
      console.error(e);
      // FIX: Explicitly type errorMessage as ChatMessage to satisfy TypeScript's stricter type checking for the 'role' property.
      const errorMessage: ChatMessage = {
        role: "model",
        text: "Sorry, I encountered an error. Please try again.",
      };
      setChatMessages([...messagesWithUser, errorMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const runAutomatedGeneration = async (scenePrompts: string[]) => {
    setIsLoading(true);
    setVideoUrl("");
    setError(""); // Clear previous errors
    let lastOperation: any = null;
    let success = true;

    for (let i = 0; i < scenePrompts.length; i++) {
      try {
        const prompt = scenePrompts[i];
        let currentOperation;

        if (i === 0) {
          setLoadingMessage(
            `Generating scene 1 of ${scenePrompts.length}: ${prompt}`,
          );
          const imagePayload =
            useStudioImage && imageFromStudio
              ? {
                  base64: imageFromStudio.base64,
                  mimeType: imageFromStudio.mimeType,
                }
              : undefined;
          currentOperation = await generateVideo(
            prompt,
            aspectRatio,
            resolution,
            imagePayload,
          );
        } else {
          if (
            !lastOperation ||
            !lastOperation.response?.generatedVideos?.[0]?.video
          ) {
            throw new Error(
              "Cannot extend video because the previous scene failed or is missing.",
            );
          }
          setLoadingMessage(
            `Extending with scene ${i + 1} of ${scenePrompts.length}: ${prompt}`,
          );
          currentOperation = await extendVideo(
            prompt,
            lastOperation,
            aspectRatio,
          );
        }

        let pollCount = 0;
        while (!currentOperation.done) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          currentOperation = await pollVideoOperation(currentOperation);
          const progress = pollCount++ * 10;
          setLoadingMessage(`Scene ${i + 1} is processing... (${progress}s)`);
        }

        if (currentOperation.error) {
          throw new Error(
            currentOperation.error.message || "The video operation failed.",
          );
        }

        lastOperation = currentOperation;
        const downloadLink =
          lastOperation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
          const videoResponse = await fetch(
            `${downloadLink}&key=${process.env.API_KEY}`,
          );
          if (!videoResponse.ok)
            throw new Error(
              `Failed to fetch video for scene ${i + 1} (HTTP ${videoResponse.status})`,
            );
          const videoBlob = await videoResponse.blob();
          setVideoUrl(URL.createObjectURL(videoBlob));
        } else {
          throw new Error(
            `No video URL found after generating scene ${i + 1}.`,
          );
        }
      } catch (e: any) {
        let errorMessage = `Failed to generate scene ${i + 1}.`;
        if (
          typeof e?.message === "string" &&
          e.message.includes("Requested entity was not found")
        ) {
          errorMessage = "API Key error. Please re-select your API key.";
          setApiKeySelected(false);
        } else if (e?.message) {
          errorMessage = `Scene ${i + 1} failed: ${e.message}`;
        }
        setError(
          errorMessage +
            " The video generated so far is shown. You can refine the concept and try again.",
        );
        console.error(e);
        success = false;
        break;
      }
    }

    if (success) {
      setGenerationState("refining");
      const finalMessage: ChatMessage = {
        role: "model",
        text: "I've generated the full video based on our concept. Take a look! You can continue our conversation to refine the prompts and regenerate it if you'd like.",
      };
      setChatMessages([...chatMessages, finalMessage]);
    } else {
      setGenerationState("refining");
    }

    setIsLoading(false);
    setLoadingMessage("");
  };

  const handleFinalizeConcept = async () => {
    setIsLoading(true);
    setError("");
    setLoadingMessage("Finalizing concept and preparing scenes...");
    setGenerationState("generating");
    try {
      const scenePrompts = await summarizeConversationForVideo(chatMessages);
      await runAutomatedGeneration(scenePrompts);
    } catch (e: any) {
      setError(
        e.message ||
          "Could not finalize the video concept. Please try refining your idea and try again.",
      );
      setGenerationState("concept");
      setIsLoading(false);
    }
  };

  if (!apiKeySelected) {
    return (
      <Card className="text-center">
        <h3 className="text-xl font-semibold mb-4">
          API Key Required for Video Generation
        </h3>
        <p className="text-gray-400 mb-6">
          Veo video generation requires you to select an API key. Please ensure
          you have billing enabled.
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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 h-[75vh] flex flex-col">
        <Card className="h-full flex flex-col">
          <h3 className="text-xl font-semibold mb-4">
            1. Develop Your Video Concept
          </h3>
          <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg p-4 space-y-4">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-700"}`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            {isAiTyping && (
              <div className="flex justify-start">
                <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-700">
                  <p className="whitespace-pre-wrap text-sm italic text-gray-400">
                    ...
                  </p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-4">
            <div className="flex">
              <textarea
                value={chatInput}
                rows={2}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), handleChatSend())
                }
                className="flex-1 bg-gray-700 border-gray-600 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 resize-none"
                placeholder={
                  generationState === "generating"
                    ? "AI is generating..."
                    : "Describe your vision..."
                }
                disabled={isAiTyping || generationState === "generating"}
              />
              <Button
                onClick={handleChatSend}
                isLoading={isAiTyping}
                className="rounded-l-none"
                disabled={generationState === "generating"}
              >
                Send
              </Button>
            </div>
            <div className="flex items-center justify-end mt-2 space-x-2">
              <Button
                onClick={undoChat}
                disabled={!canUndoChat}
                variant="ghost"
                className="px-3 py-1 text-sm font-medium"
              >
                Undo
              </Button>
              <Button
                onClick={redoChat}
                disabled={!canRedoChat}
                variant="ghost"
                className="px-3 py-1 text-sm font-medium"
              >
                Redo
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <div className="lg:col-span-2 h-[75vh] flex flex-col">
        <Card className="h-full flex flex-col">
          <h3 className="text-xl font-semibold mb-4">2. Video Preview</h3>
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-900/50 rounded-lg p-4">
            {isLoading && (
              <div className="text-center">
                <svg
                  className="animate-spin mx-auto h-10 w-10 text-indigo-400"
                  xmlns="http://www.w3.org/2000/svg"
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
                <p className="mt-4 text-indigo-300 animate-pulse">
                  {loadingMessage}
                </p>
              </div>
            )}
            {!isLoading && videoUrl && (
              <video
                controls
                key={videoUrl}
                autoPlay
                loop
                className="rounded-lg w-full max-h-full"
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
            {!isLoading && !videoUrl && (
              <div className="text-center text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2">Your generated video will appear here.</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {error && <p className="text-red-400 text-center">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <select
                value={aspectRatio}
                onChange={(e) =>
                  setAspectRatio(e.target.value as "16:9" | "9:16" | "1:1")
                }
                className="block w-full bg-gray-700 border-gray-600 rounded-md"
                disabled={generationState === "generating"}
              >
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
                <option value="1:1">Square (1:1)</option>
              </select>
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as "720p" | "1080p")
                }
                className="block w-full bg-gray-700 border-gray-600 rounded-md"
                disabled={generationState === "generating"}
              >
                <option value="720p">HD (720p)</option>
                <option value="1080p">Full HD (1080p)</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 p-2 bg-gray-700/50 rounded-md">
              <input
                id="use-studio-image"
                type="checkbox"
                checked={useStudioImage}
                onChange={(e) => setUseStudioImage(e.target.checked)}
                disabled={!imageFromStudio}
                className="h-4 w-4 rounded border-gray-500 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <label
                htmlFor="use-studio-image"
                className={`text-sm ${!imageFromStudio ? "text-gray-500" : "text-gray-300"}`}
              >
                Use image from Studio as video start
              </label>
              {imageFromStudio && (
                <img
                  src={imageFromStudio.url}
                  className="h-8 w-8 rounded object-cover ml-auto"
                  alt="Thumbnail from image studio"
                />
              )}
            </div>
            <Button
              onClick={handleFinalizeConcept}
              isLoading={isLoading}
              disabled={isAiTyping || chatMessages.length <= 1}
              className="w-full"
            >
              {generationState === "refining"
                ? "Regenerate with Updated Concept"
                : "Finalize & Generate Video"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Video Tools Component - FFmpeg-powered video editing
const VideoTools: React.FC = () => {
  const [ffmpegReady, setFfmpegReady] = useState(isFFmpegReady());
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Video file state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Multiple videos for concatenation
  const [videoClips, setVideoClips] = useState<{ file: File; url: string }[]>([]);

  // Trim settings
  const [trimStart, setTrimStart] = useState(0);
  const [trimDuration, setTrimDuration] = useState(30);

  // Export format
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm">("mp4");

  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const clipsInputRef = useRef<HTMLInputElement>(null);

  const handleInitFFmpeg = async () => {
    setFfmpegLoading(true);
    try {
      await initFFmpeg((progress) => setFfmpegProgress(progress));
      setFfmpegReady(true);
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
    } finally {
      setFfmpegLoading(false);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(file));
      setOutputUrl(null);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const handleMergeVideoAudio = async () => {
    if (!videoUrl || !audioUrl) return;
    setIsProcessing(true);
    try {
      const result = await mergeVideoWithAudio(videoUrl, audioUrl, exportFormat, setProcessingStatus);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(result);
      setProcessingStatus("Merge complete!");
    } catch (error) {
      console.error("Merge failed:", error);
      setProcessingStatus("Merge failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrimVideo = async () => {
    if (!videoUrl) return;
    setIsProcessing(true);
    setProcessingStatus("Trimming video...");
    try {
      const result = await trimVideo(videoUrl, trimStart, trimDuration);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(result);
      setProcessingStatus("Trim complete!");
    } catch (error) {
      console.error("Trim failed:", error);
      setProcessingStatus("Trim failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertFormat = async () => {
    if (!videoUrl) return;
    setIsProcessing(true);
    setProcessingStatus("Converting format...");
    try {
      const inputFormat = videoFile?.name.split(".").pop() || "mp4";
      const result = await convertVideoFormat(videoUrl, inputFormat, exportFormat);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(result);
      setProcessingStatus("Conversion complete!");
    } catch (error) {
      console.error("Conversion failed:", error);
      setProcessingStatus("Conversion failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClipsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newClips = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setVideoClips((prev) => [...prev, ...newClips]);
  };

  const handleRemoveClip = (index: number) => {
    setVideoClips((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleConcatenateVideos = async () => {
    if (videoClips.length < 2) return;
    setIsProcessing(true);
    try {
      const clipUrls = videoClips.map((c) => c.url);
      const result = await concatenateVideos(clipUrls, exportFormat, setProcessingStatus);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(result);
      setProcessingStatus("Concatenation complete!");
    } catch (error) {
      console.error("Concatenation failed:", error);
      setProcessingStatus("Concatenation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = `processed-video.${exportFormat}`;
    a.click();
  };

  if (!ffmpegReady) {
    return (
      <Card>
        <div className="text-center py-8">
          <h3 className="text-xl font-bold text-white mb-4">Video Processing Tools</h3>
          <p className="text-gray-400 mb-4">
            These tools use FFmpeg for client-side video processing.
            This requires loading ~30MB of processing libraries.
          </p>
          <Button
            onClick={handleInitFFmpeg}
            disabled={ffmpegLoading}
            variant="primary"
          >
            {ffmpegLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading FFmpeg ({ffmpegProgress}%)
              </span>
            ) : (
              "Load Video Tools"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Upload Files</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Video Upload */}
          <div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
            <Button
              onClick={() => videoInputRef.current?.click()}
              variant="secondary"
              className="w-full"
            >
              {videoFile ? `📹 ${videoFile.name}` : "Upload Video"}
            </Button>
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                className="mt-2 w-full rounded-lg max-h-48 object-contain bg-black"
              />
            )}
          </div>

          {/* Audio Upload */}
          <div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
            <Button
              onClick={() => audioInputRef.current?.click()}
              variant="secondary"
              className="w-full"
            >
              {audioFile ? `🎵 ${audioFile.name}` : "Upload Audio (for merge)"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Processing Tools</h3>

        {/* Merge Video + Audio */}
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Merge Video with Audio</h4>
          <p className="text-xs text-gray-500 mb-3">Replace or add audio track to video</p>
          <Button
            onClick={handleMergeVideoAudio}
            disabled={!videoUrl || !audioUrl || isProcessing}
            variant="primary"
            size="sm"
          >
            Merge Audio + Video
          </Button>
        </div>

        {/* Trim Video */}
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Trim Video</h4>
          <div className="flex gap-4 mb-3">
            <div>
              <label className="text-xs text-gray-500">Start (sec)</label>
              <input
                type="number"
                min={0}
                value={trimStart}
                onChange={(e) => setTrimStart(Number(e.target.value))}
                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Duration (sec)</label>
              <input
                type="number"
                min={1}
                value={trimDuration}
                onChange={(e) => setTrimDuration(Number(e.target.value))}
                className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>
          <Button
            onClick={handleTrimVideo}
            disabled={!videoUrl || isProcessing}
            variant="primary"
            size="sm"
          >
            Trim Video
          </Button>
        </div>

        {/* Convert Format */}
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Convert Format</h4>
          <div className="flex gap-4 mb-3 items-center">
            <label className="text-xs text-gray-500">Output Format:</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "mp4" | "webm")}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </div>
          <Button
            onClick={handleConvertFormat}
            disabled={!videoUrl || isProcessing}
            variant="primary"
            size="sm"
          >
            Convert Format
          </Button>
        </div>

        {/* Concatenate Videos */}
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Combine Video Clips</h4>
          <p className="text-xs text-gray-500 mb-3">Join multiple video clips into one continuous video</p>
          <input
            ref={clipsInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleClipsUpload}
            className="hidden"
          />
          <Button
            onClick={() => clipsInputRef.current?.click()}
            variant="secondary"
            size="sm"
            className="mb-3"
          >
            Add Video Clips
          </Button>
          {videoClips.length > 0 && (
            <div className="space-y-2 mb-3">
              {videoClips.map((clip, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-700/50 rounded px-3 py-2">
                  <span className="text-sm text-gray-300">{i + 1}. {clip.file.name}</span>
                  <button
                    onClick={() => handleRemoveClip(i)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={handleConcatenateVideos}
            disabled={videoClips.length < 2 || isProcessing}
            variant="primary"
            size="sm"
          >
            Combine {videoClips.length} Clips
          </Button>
        </div>

        {/* Processing Status */}
        {processingStatus && (
          <div className={`mt-4 p-3 rounded-lg ${
            processingStatus.includes("complete")
              ? "bg-green-900/30 border border-green-500/30 text-green-400"
              : processingStatus.includes("failed")
              ? "bg-red-900/30 border border-red-500/30 text-red-400"
              : "bg-blue-900/30 border border-blue-500/30 text-blue-400"
          }`}>
            {isProcessing && (
              <svg className="animate-spin h-4 w-4 inline mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {processingStatus}
          </div>
        )}
      </Card>

      {/* Output Preview */}
      {outputUrl && (
        <Card>
          <h3 className="text-lg font-bold text-white mb-4">Result</h3>
          <video
            src={outputUrl}
            controls
            className="w-full rounded-lg max-h-96 object-contain bg-black mb-4"
          />
          <Button onClick={handleDownload} variant="primary">
            Download Processed Video
          </Button>
        </Card>
      )}
    </div>
  );
};

// Main VideoCreation component
const VideoCreation: React.FC<VideoCreationProps> = (props) => {
  const [currentImage, setCurrentImage] = useState<{
    url: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const tabs = [
    {
      name: "⚡ Complete Music Video",
      content: <CompleteMusicVideo {...props} />,
    },
    {
      name: "Custom Video",
      content: (
        <MusicVideoGenerator {...props} imageFromStudio={currentImage} />
      ),
    },
    {
      name: "Image Studio",
      content: (
        <ImageStudio
          currentImage={currentImage}
          setCurrentImage={setCurrentImage}
        />
      ),
    },
    {
      name: "Video Tools",
      content: <VideoTools />,
    },
  ];

  return (
    <Page
      title="Visual Content Creation"
      description="Generate stunning visuals for your music, from full music videos to album art."
    >
      <Tabs tabs={tabs} />
    </Page>
  );
};

export default VideoCreation;
