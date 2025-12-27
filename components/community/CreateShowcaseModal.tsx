import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import {
  Genre,
  Mood,
  CreateShowcaseFormData,
  GENRES,
  MOODS,
} from "../../types/community";
import { createShowcase, uploadAudio, uploadImage } from "../../services/communityService";

interface CreateShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAudioUrl?: string;
  initialTitle?: string;
  initialLyrics?: string;
}

const CreateShowcaseModal: React.FC<CreateShowcaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialAudioUrl,
  initialTitle,
  initialLyrics,
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<CreateShowcaseFormData>>({
    title: initialTitle || "",
    description: "",
    genre: "pop",
    mood: "energetic",
    audioUrl: initialAudioUrl || "",
    lyrics: initialLyrics || "",
    bpm: undefined,
    songKey: "",
    styleDescription: "",
  });

  // Reset form when modal opens with new initial values
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        title: initialTitle || "",
        description: "",
        genre: "pop",
        mood: "energetic",
        audioUrl: initialAudioUrl || "",
        lyrics: initialLyrics || "",
        bpm: undefined,
        songKey: "",
        styleDescription: "",
      });
      setAudioFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setError(null);
    }
  }, [isOpen, initialAudioUrl, initialTitle, initialLyrics]);

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "bpm" ? Number(value) || undefined : value,
    }));
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      // Clear initial URL if user selects a new file
      setFormData((prev) => ({ ...prev, audioUrl: "" }));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be signed in");
      return;
    }

    if (!formData.title?.trim()) {
      setError("Title is required");
      return;
    }

    if (!audioFile && !formData.audioUrl) {
      setError("Audio track is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let audioUrl = formData.audioUrl;
      let coverImageUrl: string | undefined;

      // Upload audio if file provided
      if (audioFile) {
        const audioPath = `showcase/${user.id}/${Date.now()}_audio.webm`;
        const uploadResult = await uploadAudio(audioFile, audioPath);

        if (uploadResult.error || !uploadResult.url) {
          setError(uploadResult.error || "Failed to upload audio");
          setIsSubmitting(false);
          return;
        }
        audioUrl = uploadResult.url;
      }

      // Upload cover if provided
      if (coverFile) {
        const coverPath = `showcase/${user.id}/${Date.now()}_cover.jpg`;
        const uploadResult = await uploadImage(coverFile, coverPath);

        if (!uploadResult.error && uploadResult.url) {
          coverImageUrl = uploadResult.url;
        }
      }

      // Create showcase
      const showcaseData: CreateShowcaseFormData = {
        title: formData.title!,
        description: formData.description,
        genre: formData.genre as Genre,
        mood: formData.mood as Mood,
        audioUrl: audioUrl!,
        coverImageUrl,
        lyrics: formData.lyrics,
        bpm: formData.bpm,
        songKey: formData.songKey,
        styleDescription: formData.styleDescription,
      };

      const result = await createShowcase(showcaseData, user.id);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Share AI Music</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Cover Image */}
          <div className="flex gap-4">
            <div className="w-32 h-32 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex-shrink-0">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Cover Image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-purple-500 file:text-white hover:file:bg-purple-600"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Give your track a name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell us about this track..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Genre and Mood */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Genre *
              </label>
              <select
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Mood *
              </label>
              <select
                name="mood"
                value={formData.mood}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audio File */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Audio Track *
            </label>
            {initialAudioUrl && !audioFile ? (
              <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                <span className="text-green-400 text-sm">Using generated audio</span>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, audioUrl: "" }))}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-purple-500 file:text-white hover:file:bg-purple-600"
              />
            )}
            {audioFile && (
              <p className="text-sm text-gray-400 mt-1">{audioFile.name}</p>
            )}
          </div>

          {/* BPM and Key */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                BPM
              </label>
              <input
                type="number"
                name="bpm"
                value={formData.bpm || ""}
                onChange={handleInputChange}
                placeholder="120"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Key
              </label>
              <input
                type="text"
                name="songKey"
                value={formData.songKey}
                onChange={handleInputChange}
                placeholder="C Major"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Style Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Style / Prompt Used
            </label>
            <input
              type="text"
              name="styleDescription"
              value={formData.styleDescription}
              onChange={handleInputChange}
              placeholder="e.g., Lo-fi hip hop with chill vibes"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Lyrics */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Lyrics
            </label>
            <textarea
              name="lyrics"
              value={formData.lyrics}
              onChange={handleInputChange}
              placeholder="Paste lyrics here if applicable..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Uploading..." : "Share Track"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateShowcaseModal;
