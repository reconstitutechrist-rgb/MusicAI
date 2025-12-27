/**
 * OpenAI DALL-E 3 Image Generation Service
 * High-quality image generation with excellent prompt accuracy
 *
 * Documentation: https://platform.openai.com/docs/guides/images
 */

import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 */
function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment.",
      );
    }
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });
  }
  return openaiClient;
}

/**
 * Check if OpenAI API is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}

/**
 * Map aspect ratio to DALL-E 3 size format
 */
function getSize(
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
): "1024x1024" | "1792x1024" | "1024x1792" {
  switch (aspectRatio) {
    case "16:9":
    case "4:3":
      return "1792x1024"; // Landscape
    case "9:16":
    case "3:4":
      return "1024x1792"; // Portrait
    case "1:1":
    default:
      return "1024x1024"; // Square
  }
}

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

/**
 * Generate an image using DALL-E 3
 * Returns base64 data URL
 */
export async function generateImage(
  options: ImageGenerationOptions,
): Promise<string> {
  const client = getClient();

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: options.prompt,
    n: 1,
    size: getSize(options.aspectRatio || "1:1"),
    quality: options.quality || "hd",
    style: options.style || "vivid",
    response_format: "b64_json",
  });

  const imageData = response.data[0]?.b64_json;
  if (!imageData) {
    throw new Error("Image generation failed: No image data returned.");
  }

  return `data:image/png;base64,${imageData}`;
}

/**
 * Generate an image with a simple prompt (convenience wrapper)
 * Matches the signature of the original geminiService.generateImage
 */
export async function generateImageSimple(
  prompt: string,
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" = "1:1",
): Promise<string> {
  return generateImage({
    prompt,
    aspectRatio,
    quality: "hd",
    style: "vivid",
  });
}

/**
 * Edit an existing image (not directly supported by DALL-E 3)
 * Falls back to generating a new image with edit instructions
 */
export async function editImage(
  prompt: string,
  _originalImageBase64: string,
  _mimeType: string,
): Promise<string> {
  // DALL-E 3 doesn't support direct image editing like DALL-E 2
  // We generate a new image based on the edit prompt
  // For proper editing, you would need DALL-E 2 with mask support
  console.warn(
    "DALL-E 3 does not support direct image editing. Generating new image based on prompt.",
  );
  return generateImage({
    prompt: `Create an image based on this description: ${prompt}`,
    quality: "hd",
    style: "vivid",
  });
}

/**
 * Estimate cost for image generation
 * Based on OpenAI pricing (as of 2024)
 */
export function estimateCost(
  quality: "standard" | "hd" = "hd",
  size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024",
): string {
  // DALL-E 3 pricing (approximate)
  if (quality === "hd") {
    if (size === "1024x1024") return "$0.080";
    return "$0.120"; // Larger sizes
  } else {
    if (size === "1024x1024") return "$0.040";
    return "$0.080"; // Larger sizes
  }
}
