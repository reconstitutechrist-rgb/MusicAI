import {
  GoogleGenAI,
  GenerateContentResponse,
  Chat,
  Type,
  Modality,
  GenerateVideosOperation,
} from "@google/genai";
import {
  LyricsAndConcept,
  SocialMarketingPackage,
  ChatMessage,
  SongData,
  StructureSection,
  AudioAnalysisResult,
  LyricsTimingResponse,
} from "../types";

let ai: GoogleGenAI;

// Type-safe helper to get API key from environment
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error(
      "VITE_GEMINI_API_KEY environment variable not set. Please add it to your .env file.",
    );
  }
  return apiKey;
};

// Safe JSON parse helper with proper error handling
const safeJsonParse = <T>(text: string, errorContext: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const parseError =
      error instanceof Error ? error.message : "Unknown parse error";
    throw new Error(
      `Failed to parse AI response for ${errorContext}: ${parseError}. Response text: ${text.substring(0, 200)}...`,
    );
  }
};

const getAi = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return ai;
};

// Type definitions for video generation payloads
interface VideoGenerationConfig {
  numberOfVideos: number;
  resolution: "720p" | "1080p";
  aspectRatio: "16:9" | "9:16" | "1:1";
}

interface VideoGenerationPayload {
  model: string;
  prompt: string;
  config: VideoGenerationConfig;
  image?: {
    imageBytes: string;
    mimeType: string;
  };
  video?: unknown;
}

interface ContentPart {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    inlineData?: { data: string; mimeType: string };
  }>;
}

export interface SongGenerationResponse {
  conversationalResponse: string;
  songData: SongData;
}

export const generateOrRefineSong = async (
  history: ChatMessage[],
): Promise<SongGenerationResponse> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      conversationalResponse: {
        type: Type.STRING,
        description:
          "Your friendly, conversational reply to the user, explaining what you've done or asking clarifying questions. Acknowledge their last message and describe the changes you made.",
      },
      songData: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The title of the song." },
          style: {
            type: Type.STRING,
            description:
              "A detailed description of the musical style, genre, instruments, tempo, and emotional delivery.",
          },
          lyrics: {
            type: Type.STRING,
            description:
              "The full, structured song lyrics with tags like [Intro], [Verse 1], [Chorus], [Bridge], etc.",
          },
        },
        required: ["title", "style", "lyrics"],
      },
    },
    required: ["conversationalResponse", "songData"],
  };

  const systemInstruction = `You are Song Maker GPT, an expert AI songwriter. Your goal is to collaborate with the user to create a complete song. 
- Start with their initial idea and iteratively refine it based on their feedback.
- Maintain the full context of the conversation.
- When you provide an updated song, you MUST format your response as a single JSON object containing 'conversationalResponse' and 'songData'.
- The 'conversationalResponse' is your friendly chat text to the user.
- The 'songData' object must contain the complete, most up-to-date 'title', 'style', and 'lyrics'.
- The lyrics must be fully written out and structured with tags like [Verse], [Chorus], etc.`;

  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  const text = result.text.trim();
  return safeJsonParse<SongGenerationResponse>(text, "song generation");
};

export const generateLyricsAndConcept = async (
  prompt: string,
): Promise<LyricsAndConcept> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      lyrics: {
        type: Type.STRING,
        description:
          "Full song lyrics, clearly structured with tags like [Verse 1], [Chorus], [Bridge], etc.",
      },
      concept: {
        type: Type.STRING,
        description:
          "A short, one-paragraph concept for the song, describing its mood, story, and style.",
      },
      chordProgression: {
        type: Type.STRING,
        description:
          "A suggested chord progression for the song, formatted like 'Verse: Am-G-C-F, Chorus: C-G-Am-F'.",
      },
    },
    required: ["lyrics", "concept", "chordProgression"],
  };

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Based on the following user prompt, generate song lyrics, a concept, and a chord progression. The lyrics must be structured with tags like [Verse], [Chorus]. The chord progression should be appropriate for the song's mood. Prompt: "${prompt}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  const text = result.text.trim();
  return safeJsonParse<LyricsAndConcept>(text, "lyrics and concept generation");
};

export const generateSongStructure = async (
  lyrics: string,
  style: string,
): Promise<StructureSection[]> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Section name (e.g. Intro, Verse 1, Chorus)",
            },
            description: {
              type: Type.STRING,
              description: "Brief production notes and mood for this section",
            },
            bars: {
              type: Type.INTEGER,
              description: "Estimated number of bars",
            },
          },
          required: ["name", "description", "bars"],
        },
      },
    },
    required: ["sections"],
  };

  const prompt = `Analyze these lyrics and the musical style to create a detailed song structure plan.
    Style: ${style}
    Lyrics: ${lyrics}
    
    Output a list of sections in sequential order. For each section, provide the section name (Intro, Verse, etc), a brief production description (instruments, energy), and the estimated number of bars.`;

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  const text = result.text.trim();
  const parsed = safeJsonParse<{ sections: StructureSection[] }>(
    text,
    "song structure generation",
  );
  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid song structure response: missing sections array");
  }
  return parsed.sections;
};

// Internal function for actual audio generation
const _internalGenerateAudio = async (
  detailedPrompt: string,
): Promise<string> => {
  const ai = getAi();

  // We use the Native Audio model ('gemini-2.5-flash-native-audio-preview-09-2025') instead of the standard TTS model.
  // By providing a system instruction to act as a "musical synthesizer", we can trick the model
  // into producing high-quality beatboxing, vocal bass, and humming that mimics instruments
  // far better than a standard text-reader.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    contents: [{ parts: [{ text: detailedPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      // This system instruction is the key "sophisticated technique" to switch the model mode from talking to performing.
      systemInstruction:
        "You are a professional musical synthesizer and vocal instrument. You do NOT speak words. You ONLY produce rhythmic, melodic, and harmonic sounds. Perform the requested musical arrangement using advanced vocal percussion, bass humming, and tonal synthesis.",
      speechConfig: {
        voiceConfig: {
          // 'Fenrir' typically has a deeper, more resonant quality suitable for bass and percussion emulation.
          prebuiltVoiceConfig: { voiceName: "Fenrir" },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData,
  );
  if (part && part.inlineData) {
    return part.inlineData.data;
  }
  throw new Error("The AI model did not return valid audio data.");
};

// Orchestrator function that uses a text model to create a better prompt for the audio model
export const generateInstrumentalTrack = async (
  songStyle: string,
  referenceAudio?: { base64: string; mimeType: string },
): Promise<string> => {
  const ai = getAi();

  // Step 1: Use a powerful text model to create a "Musical Blueprint" / Phonetic Script.
  // We explicitly ask for phonetics that sound like instruments.
  let producerPrompt = `Act as a music producer. Create a "Phonetic Audio Script" that a vocal synthesizer can read to mimic a full instrumental track for the style: "${songStyle}".
    
    Guidelines:
    - Use complex phonetics for drums (e.g., "Buh", "Kuh", "Tss", "Pfft", "K-tsh").
    - Use sustained vowels and humming for melody/chords (e.g., "Laaa", "Dooo", "Vumm", "Hmmmm").
    - Combine them into a layered rhythmic sequence.
    - Provide a sequence that lasts about 10-15 seconds.
    - Do NOT include any parenthetical instructions like "(drums start)" or "(piano enters)". ONLY output the performable sounds themselves.
    
    Example Output for Hip Hop: "Buh - Tss - Buh - Buh - Tss... (Vummmmmm)... Ki-ka-buh... Laaa-da-da..."

    Output the script now.`;

  const contents: ContentPart[] = [
    { role: "user", parts: [{ text: producerPrompt }] },
  ];

  // If reference audio is provided, we feed it to the Pro model so it can analyze the vibe and structure.
  if (referenceAudio) {
    contents[0].parts.unshift({
      inlineData: {
        data: referenceAudio.base64,
        mimeType: referenceAudio.mimeType,
      },
    });
    producerPrompt += `\n\nAlso, analyze the attached audio reference. Incorporate similar rhythmic patterns and energy into your phonetic script.`;
    const textPart = contents[0].parts[1];
    if (textPart && "text" in textPart) {
      textPart.text = producerPrompt;
    }
  }

  const detailedPromptResponse = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: contents,
  });

  const detailedPrompt = detailedPromptResponse.text.trim();
  console.log("Orchestrator Generated Script:", detailedPrompt);

  // Step 2: Use the Native Audio model to "perform" this script.
  return await _internalGenerateAudio(detailedPrompt);
};

// New generic function to process audio (for Pitch Correction, Harmony, etc.)
export const processAudioTrack = async (
  audioBase64: string,
  prompt: string,
): Promise<string> => {
  const ai = getAi();
  // Use the native audio model for audio-to-audio processing
  // It can accept audio input and instructions, and return processed audio
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: audioBase64, mimeType: "audio/wav" } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData,
  );
  if (part && part.inlineData) {
    return part.inlineData.data;
  }
  throw new Error("The AI model did not return processed audio.");
};

export const generateSpeech = async (
  text: string,
  voiceName: string = "Kore",
): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [
      {
        parts: [
          { text: `Sing these lyrics in a clear, melodic tone: ${text}` },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const base64Audio =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio.");
  }
  return base64Audio;
};

// --- Lyric Lab Services ---

export const analyzeRhymeAndMeter = async (
  line: string,
  context: string,
): Promise<string> => {
  const ai = getAi();
  const prompt = `Analyze the rhyme scheme, meter, and syllable count of the following line in the context of these lyrics. Identify any issues with rhythm or flow.
    Context: "${context}"
    Target Line: "${line}"
    Keep it concise.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text;
};

export const generateLineAlternatives = async (
  line: string,
  type: string,
): Promise<string[]> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      alternatives: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["alternatives"],
  };

  const prompt = `Generate 5 alternative versions of this lyric line.
    Line: "${line}"
    Goal: ${type} (e.g., make it rhyme better, more emotional, simpler, abstract).
    Output JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });
  const parsed = safeJsonParse<{ alternatives: string[] }>(
    response.text.trim(),
    "line alternatives generation",
  );
  if (!parsed.alternatives || !Array.isArray(parsed.alternatives)) {
    throw new Error(
      "Invalid alternatives response: missing alternatives array",
    );
  }
  return parsed.alternatives;
};

// --- Audio Analyzer Services ---

export const analyzeAudioTrack = async (
  audioBase64: string,
  mimeType: string,
): Promise<AudioAnalysisResult> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      bpm: { type: Type.STRING },
      key: { type: Type.STRING },
      genre: { type: Type.STRING },
      chords: { type: Type.ARRAY, items: { type: Type.STRING } },
      productionFeedback: { type: Type.STRING },
      mood: { type: Type.STRING },
    },
    required: ["bpm", "key", "genre", "chords", "productionFeedback", "mood"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { data: audioBase64, mimeType: mimeType } },
        {
          text: "Analyze this audio track. Identify the BPM, Key, Genre, Chord Progression, and Mood. Provide specific production feedback on the mix and arrangement.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  return safeJsonParse<AudioAnalysisResult>(
    response.text.trim(),
    "audio track analysis",
  );
};

// --- Remix Studio Services ---
// Reuses processAudioTrack but with a specialized prompt wrapper
export const remixAudioTrack = async (
  audioBase64: string,
  remixInstruction: string,
): Promise<string> => {
  return processAudioTrack(
    audioBase64,
    `Creative Remix Task: ${remixInstruction}. Transform the input audio while keeping the core rhythm or melody as appropriate.`,
  );
};

export const masterAudio = async (
  audioBase64: string,
  mimeType: string,
): Promise<string> => {
  // This feature is not supported by current models. The UI will prevent this from being called.
  // This function remains as a safeguard.
  throw new Error(
    "Audio Mastering is not supported by the available AI models.",
  );
};

export const separateAudioStem = async (
  audioBase64: string,
  mimeType: string,
  stemToExtract: "vocals" | "instrumental",
): Promise<string> => {
  // This feature is not supported by current models. The UI will prevent this from being called.
  // This function remains as a safeguard.
  throw new Error(
    "Stem Separation is not supported by the available AI models.",
  );
};

export const generateImage = async (
  prompt: string,
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: "image/jpeg",
      aspectRatio: aspectRatio,
    },
  });

  const generatedImage = response.generatedImages?.[0];
  if (!generatedImage?.image?.imageBytes) {
    throw new Error(
      "Image generation failed: No image data returned from the AI model.",
    );
  }
  return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
};

export const editImage = async (
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType: mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData,
  );
  if (part && part.inlineData) {
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("Failed to edit image.");
};

export const analyzeImage = async (
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> => {
  const ai = getAi();
  const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, textPart] },
  });

  return response.text;
};

export const generateVideo = async (
  prompt: string,
  aspectRatio: "16:9" | "9:16" | "1:1",
  resolution: "720p" | "1080p",
  image?: { base64: string; mimeType: string },
) => {
  // A new instance must be created to use the latest API key from the selection dialog.
  const aiWithUserKey = new GoogleGenAI({ apiKey: getApiKey() });

  const requestPayload: VideoGenerationPayload = {
    model: "veo-3.1-fast-generate-preview",
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: resolution,
      aspectRatio: aspectRatio,
    },
  };

  if (image) {
    requestPayload.image = {
      imageBytes: image.base64,
      mimeType: image.mimeType,
    };
  }

  return await aiWithUserKey.models.generateVideos(requestPayload);
};

export const extendVideo = async (
  prompt: string,
  previousOperation: GenerateVideosOperation,
  aspectRatio: "16:9" | "9:16" | "1:1",
) => {
  const aiWithUserKey = new GoogleGenAI({ apiKey: getApiKey() });
  const previousVideo = previousOperation.response?.generatedVideos?.[0]?.video;
  if (!previousVideo) {
    throw new Error("No previous video found in the operation to extend.");
  }

  const requestPayload: VideoGenerationPayload = {
    model: "veo-3.1-generate-preview", // This model is required for extension
    prompt: prompt,
    video: previousVideo,
    config: {
      numberOfVideos: 1,
      resolution: "720p", // Extension only supports 720p
      aspectRatio: aspectRatio,
    },
  };

  return await aiWithUserKey.models.generateVideos(requestPayload);
};

export const pollVideoOperation = async (
  operation: GenerateVideosOperation,
) => {
  // A new instance must be created to use the latest API key from the selection dialog.
  const aiWithUserKey = new GoogleGenAI({ apiKey: getApiKey() });
  return await aiWithUserKey.operations.getVideosOperation({
    operation: operation,
  });
};

export const generateMarketingPackage = async (
  lyrics: string,
  concept: string,
  targetAudience: string,
  previousPackage?: SocialMarketingPackage | null,
): Promise<SocialMarketingPackage> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      hashtags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "A list of 10 relevant hashtags.",
      },
      description: {
        type: Type.STRING,
        description: "A one-paragraph promotional description for the song.",
      },
      captions: {
        type: Type.ARRAY,
        description: "Captions for Instagram, TikTok, and Twitter/X.",
        items: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING },
            variations: {
              type: Type.ARRAY,
              description:
                "3 distinct variations of the caption for A/B testing.",
              items: { type: Type.STRING },
            },
          },
          required: ["platform", "variations"],
        },
      },
      imagePrompt: {
        type: Type.STRING,
        description:
          "A director-level, evocative prompt for a professional AI image generator (like Imagen). It MUST specify: 1) Artistic medium (e.g. moody oil painting, vaporwave digital art, sharp 35mm film photography), 2) A precise color palette (e.g. deep teals and burnt orange, pastel neons, monochrome with crimson accents), 3) Specific lighting (e.g. volumetric god-rays, harsh noir shadows, soft ethereal backlight), 4) Composition and perspective (e.g. extreme close-up, Dutch angle, bird's eye view), and 5) The emotional weight/atmosphere that matches the song's concept.",
      },
      artistBio: {
        type: Type.STRING,
        description:
          "A short, compelling 100-word artist bio suitable for a press kit, inspired by the song's themes.",
      },
      pressRelease: {
        type: Type.STRING,
        description:
          "A professional 250-word press release announcing the new single, including a headline, introduction, a quote from the artist, and details about the release.",
      },
      interviewPoints: {
        type: Type.ARRAY,
        description:
          "A list of 5 interesting talking points for an interview about the song.",
        items: { type: Type.STRING },
      },
      releaseTimeline: {
        type: Type.ARRAY,
        description:
          "A 7-day promotional release timeline with actions for each day.",
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.INTEGER },
            platform: { type: Type.STRING },
            action: { type: Type.STRING },
          },
          required: ["day", "platform", "action"],
        },
      },
      videoPrompts: {
        type: Type.ARRAY,
        description:
          "A list of 3 distinct, highly visual prompts for generating 5-10 second teaser videos for social media. Each prompt MUST include: 1) A specific camera angle or movement (e.g. 'Slow cinematic zoom on the artist\'s hands'), 2) A transition style (e.g. 'Fast jump cut' or 'Smooth light leak dissolve'), and 3) Clear text-on-screen copy (e.g. 'TEXT OVERLAY: New Single Out Now').",
        items: { type: Type.STRING },
      },
    },
    required: [
      "hashtags",
      "description",
      "captions",
      "imagePrompt",
      "artistBio",
      "pressRelease",
      "interviewPoints",
      "releaseTimeline",
      "videoPrompts",
    ],
  };

  let prompt = `Create a comprehensive social media and press marketing package for a new song.
    The package should be tailored for the following target audience: "${targetAudience}".

    Song Concept: ${concept}
    
    Lyrics: ${lyrics}
    
    IMPORTANT: 
    1) For the 'videoPrompts', provide extremely detailed, director-level descriptions. Specify the lighting, the exact camera motion, any stylized transitions, and the precise text that should be overlaid on the video to maximize engagement.
    2) For the 'imagePrompt', act as a high-end creative director. Design a visual that doesn't just represent the lyrics but evokes the *soul* of the song. Use evocative, sensory language. Instead of 'a blue sky', use 'a vast, bruised indigo twilight'. Focus on artistic medium, color palette, mood, and composition to create a strong visual hook that stops the scroll and ensures the resulting image is professional and striking.`;

  if (previousPackage) {
    prompt += `\n\nCONSTRAINT: The user wants fresh ideas. Ensure the new content is DISTINCTLY DIFFERENT from the previous generation:
        - Avoid these specific video concepts: ${JSON.stringify(previousPackage.videoPrompts)}
        - Avoid this exact image prompt: "${previousPackage.imagePrompt}"
        - Try different hashtags than: ${JSON.stringify(previousPackage.hashtags)}
        - Explore a different angle for the captions and description.`;
  }

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });
  const text = result.text.trim();
  return safeJsonParse<SocialMarketingPackage>(
    text,
    "marketing package generation",
  );
};

export const startChatStream = async (
  model: string,
  history: ChatMessage[],
  newMessage: string,
  systemInstruction?: string,
) => {
  const ai = getAi();

  const apiHistory = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const chat = ai.chats.create({
    model: model,
    history: apiHistory,
    config: {
      systemInstruction:
        systemInstruction ||
        "You are MUSE AI, a creative partner and technical expert for musicians, artists, and songwriters. Your purpose is to provide inspiring creative advice and clear, actionable technical support. Engage users in a friendly, encouraging tone. Help them with songwriting, music theory, production techniques, marketing ideas, and overcoming creative blocks. Be their ultimate collaborator.",
    },
  });

  return await chat.sendMessageStream({ message: newMessage });
};

export const translateText = async (
  text: string,
  targetLanguage: string,
): Promise<string> => {
  if (!text.trim()) {
    return "";
  }
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}. Return only the translated text, without any introductory phrases or explanations. Text: "${text}"`,
      config: {
        temperature: 0,
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Return original text on failure
  }
};

export const generateChatResponse = async (
  history: ChatMessage[],
  newMessage: string,
  systemInstruction: string,
): Promise<string> => {
  const ai = getAi();

  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));
  contents.push({ role: "user", parts: [{ text: newMessage }] });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return response.text;
};

export const summarizeConversationForVideo = async (
  history: ChatMessage[],
): Promise<string[]> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      scenes: {
        type: Type.ARRAY,
        description:
          "An array of strings, where each string is a detailed visual prompt for a 7-second video scene.",
        items: { type: Type.STRING },
      },
    },
    required: ["scenes"],
  };

  const finalPrompt =
    "Based on our entire conversation, summarize the final music video concept into a JSON object with a 'scenes' key. The value should be an array of strings. Each string must be a detailed, standalone prompt for an AI video generator to create a 7-second scene. Ensure the scenes flow together to create a cohesive video for the full song. Only return the JSON object, with no other text or explanation.";

  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));
  contents.push({ role: "user", parts: [{ text: finalPrompt }] });

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      systemInstruction:
        "You are an AI assistant that helps summarize conversations into structured JSON.",
    },
  });

  try {
    const parsed = safeJsonParse<{ scenes: unknown[] }>(
      result.text.trim(),
      "video scene summarization",
    );
    if (
      Array.isArray(parsed.scenes) &&
      parsed.scenes.every((s: unknown) => typeof s === "string") &&
      parsed.scenes.length > 0
    ) {
      return parsed.scenes as string[];
    }
    throw new Error(
      "The AI returned an invalid or empty list of scene prompts.",
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("Failed to parse")) {
      throw e; // Re-throw safeJsonParse errors
    }
    console.error("Failed to parse scene prompts JSON:", result.text);
    throw new Error("The AI returned an invalid format for the scene prompts.");
  }
};

export const generateChatTitle = async (
  firstMessage: string,
): Promise<string> => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a very short, concise title (4-5 words max) for a chat conversation that starts with this message: "${firstMessage}". Only return the title, with no extra text or quotation marks.`,
      config: {
        temperature: 0.2,
        stopSequences: ["\n"],
      },
    });
    return response.text.trim().replace(/^["']|["']$/g, "");
  } catch (error) {
    console.error("Title generation failed:", error);
    return `Conversation started...`;
  }
};

// --- Karaoke Services ---

/**
 * Generates synchronized timing data for lyrics based on song duration and style
 * @param lyrics - Full lyrics text with structure tags like [Verse], [Chorus]
 * @param duration - Total song duration in seconds
 * @param style - Musical style for tempo estimation
 */
export const generateLyricsTiming = async (
  lyrics: string,
  duration: number,
  style: string,
): Promise<LyricsTimingResponse> => {
  const ai = getAi();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      lyricLines: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The lyric line text" },
            startTime: {
              type: Type.NUMBER,
              description: "Start time in seconds",
            },
            endTime: { type: Type.NUMBER, description: "End time in seconds" },
            sectionTag: {
              type: Type.STRING,
              description:
                "Section tag like [Verse 1] if this line starts a new section",
            },
          },
          required: ["text", "startTime", "endTime"],
        },
      },
      estimatedBpm: {
        type: Type.NUMBER,
        description: "Estimated BPM based on style",
      },
      estimatedKey: {
        type: Type.STRING,
        description: "Estimated musical key",
      },
    },
    required: ["lyricLines"],
  };

  const prompt = `Analyze these song lyrics and generate precise timing data for karaoke display.

Song Style: ${style}
Total Duration: ${duration} seconds
Lyrics:
${lyrics}

Guidelines:
1. Parse structure tags like [Intro], [Verse], [Chorus], [Bridge], [Outro]
2. Account for instrumental intros (typically 8-16 seconds) before first lyrics
3. Estimate BPM from the style (e.g., ballad=60-80, pop=100-130, hip-hop=80-115, rock=110-140)
4. Space lines according to natural singing pace for the genre
5. Add breathing room between sections (1-2 seconds)
6. Ensure endTime of each line <= startTime of next line
7. Last line endTime should not exceed total duration
8. For each section tag found, include it in the sectionTag field of the FIRST line of that section

Return timing data for each lyric line with start/end times in seconds.`;

  const result = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  return safeJsonParse<LyricsTimingResponse>(
    result.text.trim(),
    "lyrics timing generation",
  );
};

/**
 * Enhances recorded karaoke vocals with auto-tune and reverb
 * @param audioBase64 - Base64 encoded audio data
 * @param options - Enhancement options (autoTune, reverb, key)
 */
export const enhanceKaraokeVocal = async (
  audioBase64: string,
  options: { autoTune: boolean; reverb: boolean; key?: string },
): Promise<string> => {
  const enhancements: string[] = [];

  if (options.autoTune) {
    enhancements.push(
      options.key
        ? `gentle pitch correction tuned to the key of ${options.key}`
        : "gentle pitch correction to the nearest note",
    );
  }

  if (options.reverb) {
    enhancements.push("subtle studio reverb for warmth and depth");
  }

  if (enhancements.length === 0) {
    // No enhancements requested, return original
    return audioBase64;
  }

  const prompt = `Enhance this vocal recording for karaoke. Apply: ${enhancements.join(", ")}.

IMPORTANT GUIDELINES:
- Keep the natural character and emotion of the voice
- Improve pitch accuracy subtly without making it sound robotic
- Add professional polish while preserving the original performance feel
- Do NOT change the tempo or timing
- Do NOT alter the volume drastically
- The result should sound like a polished studio recording`;

  return processAudioTrack(audioBase64, prompt);
};
