import React, { useState, useId } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../hooks/useModal";
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

  // Generate unique IDs for form fields
  const formId = useId();
  const titleId = `${formId}-title`;
  const descriptionId = `${formId}-description`;
  const genreId = `${formId}-genre`;
  const moodId = `${formId}-mood`;
  const audioId = `${formId}-audio`;
  const coverId = `${formId}-cover`;
  const bpmId = `${formId}-bpm`;
  const keyId = `${formId}-key`;
  const styleId = `${formId}-style`;
  const lyricsId = `${formId}-lyrics`;
  const errorId = `${formId}-error`;

  // Use modal accessibility hook
  const { modalRef, overlayProps, contentProps, closeButtonProps, titleProps } = useModal({
    isOpen,
    onClose,
    descriptionId: error ? errorId : undefined,
  });

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
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"
      {...overlayProps}
    >
      <Card className="w-full max-w-2xl my-8">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          ref={modalRef as React.RefObject<HTMLFormElement>}
          {...contentProps}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 {...titleProps} className="text-xl font-bold text-white">
              Share AI Music
            </h2>
            <button
              {...closeButtonProps}
              className="text-gray-400 hover:text-white p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm"
            >
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
                  <span className="text-4xl" role="img" aria-label="Music note">🎵</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label htmlFor={coverId} className="block text-sm font-medium text-gray-300 mb-1">
                Cover Image (optional)
              </label>
              <input
                id={coverId}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-purple-500 file:text-white hover:file:bg-purple-600"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor={titleId} className="block text-sm font-medium text-gray-300 mb-1">
              Title *
            </label>
            <input
              id={titleId}
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Give your track a name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={descriptionId} className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id={descriptionId}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Tell us about this track..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
            />
          </div>

          {/* Genre and Mood */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={genreId} className="block text-sm font-medium text-gray-300 mb-1">
                Genre *
              </label>
              <select
                id={genreId}
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={moodId} className="block text-sm font-medium text-gray-300 mb-1">
                Mood *
              </label>
              <select
                id={moodId}
                name="mood"
                value={formData.mood}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
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
            <label htmlFor={audioId} className="block text-sm font-medium text-gray-300 mb-1">
              Audio Track *
            </label>
            {initialAudioUrl && !audioFile ? (
              <div
                id={audioId}
                role="group"
                aria-label="Audio track selection"
                className="flex items-center gap-3 bg-gray-800 rounded-lg p-3"
              >
                <span className="text-green-400 text-sm" aria-live="polite">Using generated audio</span>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, audioUrl: "" }))}
                  className="text-xs text-gray-400 hover:text-white focus:outline-none focus:underline"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <input
                id={audioId}
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
              <label htmlFor={bpmId} className="block text-sm font-medium text-gray-300 mb-1">
                BPM
              </label>
              <input
                id={bpmId}
                type="number"
                name="bpm"
                value={formData.bpm || ""}
                onChange={handleInputChange}
                placeholder="120"
                min={60}
                max={200}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                aria-describedby={`${bpmId}-hint`}
              />
              <p id={`${bpmId}-hint`} className="text-xs text-gray-500 mt-1">
                Range: 60-200
              </p>
            </div>
            <div>
              <label htmlFor={keyId} className="block text-sm font-medium text-gray-300 mb-1">
                Key
              </label>
              <input
                id={keyId}
                type="text"
                name="songKey"
                value={formData.songKey}
                onChange={handleInputChange}
                placeholder="C Major"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Style Description */}
          <div>
            <label htmlFor={styleId} className="block text-sm font-medium text-gray-300 mb-1">
              Style / Prompt Used
            </label>
            <input
              id={styleId}
              type="text"
              name="styleDescription"
              value={formData.styleDescription}
              onChange={handleInputChange}
              placeholder="e.g., Lo-fi hip hop with chill vibes"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Lyrics */}
          <div>
            <label htmlFor={lyricsId} className="block text-sm font-medium text-gray-300 mb-1">
              Lyrics
            </label>
            <textarea
              id={lyricsId}
              name="lyrics"
              value={formData.lyrics}
              onChange={handleInputChange}
              placeholder="Paste lyrics here if applicable..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} loadingText="Uploading...">
              Share Track
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateShowcaseModal;
