import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { LyricLine } from "../types";

/**
 * Service for processing and merging video with audio and lyrics
 * Uses FFmpeg.wasm for client-side video processing
 */

let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;

/**
 * Initialize FFmpeg.wasm (loads ~30MB of WASM files)
 * Call this once at app startup or when user navigates to video section
 */
export const initFFmpeg = async (
  onProgress?: (progress: number) => void,
): Promise<void> => {
  if (isFFmpegLoaded && ffmpegInstance) {
    return;
  }

  const ffmpeg = new FFmpeg();

  // Set up progress logging
  ffmpeg.on("log", ({ message }) => {
    console.log("[FFmpeg]:", message);
  });

  // Monitor progress for long operations
  ffmpeg.on("progress", ({ progress }) => {
    if (onProgress) {
      onProgress(Math.round(progress * 100));
    }
  });

  try {
    // Load FFmpeg from CDN
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    ffmpegInstance = ffmpeg;
    isFFmpegLoaded = true;
    console.log("FFmpeg loaded successfully");
  } catch (error) {
    console.error("Failed to load FFmpeg:", error);
    throw new Error(
      "Failed to initialize video processor. Please refresh and try again.",
    );
  }
};

/**
 * Get FFmpeg instance (throws if not initialized)
 */
const getFFmpeg = (): FFmpeg => {
  if (!ffmpegInstance || !isFFmpegLoaded) {
    throw new Error(
      "FFmpeg not initialized. Call initFFmpeg() first before using video processing features.",
    );
  }
  return ffmpegInstance;
};

/**
 * Merge video file with audio track
 * @param videoUrl - URL or blob URL of the video file
 * @param audioUrl - URL or blob URL of the audio file (WAV, MP3, etc.)
 * @param outputFormat - Output format (default: mp4)
 * @returns Blob URL of the merged video
 */
export const mergeVideoWithAudio = async (
  videoUrl: string,
  audioUrl: string,
  outputFormat: "mp4" | "webm" = "mp4",
  onProgress?: (status: string) => void,
): Promise<string> => {
  const ffmpeg = getFFmpeg();

  onProgress?.("Preparing video and audio files...");

  // Load input files into FFmpeg's virtual filesystem
  const videoData = await fetchFile(videoUrl);
  const audioData = await fetchFile(audioUrl);

  await ffmpeg.writeFile("input_video.mp4", videoData);
  await ffmpeg.writeFile("input_audio.wav", audioData);

  onProgress?.("Merging video and audio...");

  // FFmpeg command to merge video + audio
  // -i input_video.mp4: Input video
  // -i input_audio.wav: Input audio
  // -c:v copy: Copy video codec (no re-encoding for speed)
  // -c:a aac: Encode audio to AAC
  // -shortest: End video when shortest stream ends
  await ffmpeg.exec([
    "-i",
    "input_video.mp4",
    "-i",
    "input_audio.wav",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    `output.${outputFormat}`,
  ]);

  onProgress?.("Reading output file...");

  // Read the output file
  const data = await ffmpeg.readFile(`output.${outputFormat}`);
  const blob = new Blob([data], {
    type: outputFormat === "mp4" ? "video/mp4" : "video/webm",
  });
  const blobUrl = URL.createObjectURL(blob);

  // Clean up virtual filesystem
  await ffmpeg.deleteFile("input_video.mp4");
  await ffmpeg.deleteFile("input_audio.wav");
  await ffmpeg.deleteFile(`output.${outputFormat}`);

  onProgress?.("Complete!");

  return blobUrl;
};

/**
 * Create a video with lyric overlays using Canvas API
 * This renders lyrics frame-by-frame onto the video
 * @param videoUrl - Source video URL
 * @param audioUrl - Audio track URL
 * @param lyricLines - Timed lyric data
 * @param options - Styling options for lyrics
 */
export const createLyricVideo = async (
  videoUrl: string,
  audioUrl: string,
  lyricLines: LyricLine[],
  options: {
    fontSize?: number;
    fontFamily?: string;
    textColor?: string;
    backgroundColor?: string;
    position?: "top" | "center" | "bottom";
    highlightColor?: string;
  } = {},
  onProgress?: (status: string, percent: number) => void,
): Promise<string> => {
  const {
    fontSize = 48,
    fontFamily = "Arial, sans-serif",
    textColor = "#FFFFFF",
    backgroundColor = "rgba(0, 0, 0, 0.7)",
    position = "bottom",
    highlightColor = "#FFD700",
  } = options;

  onProgress?.("Loading video and audio...", 0);

  // Create video and audio elements
  const video = document.createElement("video");
  const audio = document.createElement("audio");

  video.src = videoUrl;
  audio.src = audioUrl;
  video.muted = true;

  await Promise.all([
    new Promise((resolve) => {
      video.onloadedmetadata = resolve;
      video.load();
    }),
    new Promise((resolve) => {
      audio.onloadedmetadata = resolve;
      audio.load();
    }),
  ]);

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = Math.min(video.duration, audio.duration);
  const fps = 30; // Target frame rate

  onProgress?.("Setting up canvas renderer...", 5);

  // Create canvas for rendering
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Set up MediaRecorder to capture canvas
  const stream = canvas.captureStream(fps);
  const audioStream = audio.captureStream
    ? audio.captureStream()
    : new MediaStream();
  if (audioStream.getAudioTracks().length > 0) {
    stream.addTrack(audioStream.getAudioTracks()[0]);
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 5000000, // 5 Mbps
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Helper to get current lyric at time t
  const getCurrentLyric = (time: number): LyricLine | null => {
    return (
      lyricLines.find((line) => time >= line.startTime && time <= line.endTime) ||
      null
    );
  };

  // Helper to draw lyrics on canvas
  const drawLyrics = (lyric: LyricLine | null, currentTime: number) => {
    if (!lyric) return;

    ctx.save();

    // Configure text style
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate position
    let y: number;
    switch (position) {
      case "top":
        y = fontSize + 20;
        break;
      case "center":
        y = height / 2;
        break;
      case "bottom":
        y = height - fontSize - 40;
        break;
    }

    const x = width / 2;

    // Measure text for background
    const metrics = ctx.measureText(lyric.text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    const padding = 20;

    // Draw background box
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(
      x - textWidth / 2 - padding,
      y - textHeight / 2 - padding / 2,
      textWidth + padding * 2,
      textHeight + padding,
    );

    // Calculate highlight progress (karaoke effect)
    const progress =
      (currentTime - lyric.startTime) / (lyric.endTime - lyric.startTime);
    const highlightWidth = textWidth * Math.min(1, Math.max(0, progress));

    // Draw text with gradient highlight effect
    const gradient = ctx.createLinearGradient(
      x - textWidth / 2,
      y,
      x + textWidth / 2,
      y,
    );
    gradient.addColorStop(0, highlightColor);
    gradient.addColorStop(highlightWidth / textWidth, highlightColor);
    gradient.addColorStop(highlightWidth / textWidth, textColor);
    gradient.addColorStop(1, textColor);

    ctx.fillStyle = gradient;
    ctx.fillText(lyric.text, x, y);

    // Add text stroke for better readability
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(lyric.text, x, y);

    ctx.restore();
  };

  // Render frames
  return new Promise((resolve, reject) => {
    let currentFrame = 0;
    const totalFrames = Math.floor(duration * fps);

    const renderFrame = async () => {
      if (currentFrame >= totalFrames) {
        // Rendering complete
        recorder.stop();
        return;
      }

      const currentTime = currentFrame / fps;
      video.currentTime = currentTime;

      await new Promise((resolveSeek) => {
        video.onseeked = resolveSeek;
      });

      // Draw video frame
      ctx.drawImage(video, 0, 0, width, height);

      // Overlay lyrics
      const currentLyric = getCurrentLyric(currentTime);
      drawLyrics(currentLyric, currentTime);

      currentFrame++;
      const percent = Math.round((currentFrame / totalFrames) * 100);
      onProgress?.(
        `Rendering lyrics (${currentFrame}/${totalFrames} frames)...`,
        percent,
      );

      // Continue to next frame
      requestAnimationFrame(renderFrame);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const blobUrl = URL.createObjectURL(blob);
      onProgress?.("Converting to MP4...", 95);

      // Convert WebM to MP4 using FFmpeg
      convertVideoFormat(blobUrl, "webm", "mp4")
        .then((finalUrl) => {
          onProgress?.("Complete!", 100);
          resolve(finalUrl);
        })
        .catch(reject);
    };

    // Start recording and rendering
    recorder.start();
    audio.play();
    renderFrame();
  });
};

/**
 * Convert video from one format to another
 * @param videoUrl - Input video URL
 * @param inputFormat - Input format
 * @param outputFormat - Output format
 */
export const convertVideoFormat = async (
  videoUrl: string,
  inputFormat: string,
  outputFormat: string,
): Promise<string> => {
  const ffmpeg = getFFmpeg();

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile(`input.${inputFormat}`, videoData);

  await ffmpeg.exec([
    "-i",
    `input.${inputFormat}`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    `output.${outputFormat}`,
  ]);

  const data = await ffmpeg.readFile(`output.${outputFormat}`);
  const blob = new Blob([data], { type: `video/${outputFormat}` });
  const blobUrl = URL.createObjectURL(blob);

  // Clean up
  await ffmpeg.deleteFile(`input.${inputFormat}`);
  await ffmpeg.deleteFile(`output.${outputFormat}`);

  return blobUrl;
};

/**
 * Combine multiple video clips into one continuous video
 * @param videoUrls - Array of video URLs to concatenate
 * @param outputFormat - Output format
 */
export const concatenateVideos = async (
  videoUrls: string[],
  outputFormat: "mp4" | "webm" = "mp4",
  onProgress?: (status: string) => void,
): Promise<string> => {
  const ffmpeg = getFFmpeg();

  onProgress?.("Loading video clips...");

  // Write all input files
  const inputFiles: string[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const videoData = await fetchFile(videoUrls[i]);
    const filename = `input_${i}.mp4`;
    await ffmpeg.writeFile(filename, videoData);
    inputFiles.push(filename);
  }

  onProgress?.("Concatenating videos...");

  // Create concat list file
  const concatList = inputFiles.map((f) => `file '${f}'`).join("\n");
  await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(concatList));

  // Concatenate using concat demuxer (fastest method)
  await ffmpeg.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "concat_list.txt",
    "-c",
    "copy",
    `output.${outputFormat}`,
  ]);

  onProgress?.("Reading output...");

  const data = await ffmpeg.readFile(`output.${outputFormat}`);
  const blob = new Blob([data], {
    type: outputFormat === "mp4" ? "video/mp4" : "video/webm",
  });
  const blobUrl = URL.createObjectURL(blob);

  // Clean up
  for (const file of inputFiles) {
    await ffmpeg.deleteFile(file);
  }
  await ffmpeg.deleteFile("concat_list.txt");
  await ffmpeg.deleteFile(`output.${outputFormat}`);

  onProgress?.("Complete!");

  return blobUrl;
};

/**
 * Trim video to specific duration
 * @param videoUrl - Input video URL
 * @param startTime - Start time in seconds
 * @param duration - Duration in seconds
 */
export const trimVideo = async (
  videoUrl: string,
  startTime: number,
  duration: number,
): Promise<string> => {
  const ffmpeg = getFFmpeg();

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);

  await ffmpeg.exec([
    "-i",
    "input.mp4",
    "-ss",
    startTime.toString(),
    "-t",
    duration.toString(),
    "-c",
    "copy",
    "output.mp4",
  ]);

  const data = await ffmpeg.readFile("output.mp4");
  const blob = new Blob([data], { type: "video/mp4" });
  const blobUrl = URL.createObjectURL(blob);

  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  return blobUrl;
};

/**
 * Check if FFmpeg is ready to use
 */
export const isFFmpegReady = (): boolean => {
  return isFFmpegLoaded && ffmpegInstance !== null;
};
