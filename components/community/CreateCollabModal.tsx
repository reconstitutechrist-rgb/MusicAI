import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import {
  Genre,
  Mood,
  CollabType,
  CreateCollabFormData,
  CollabPart,
  GENRES,
  MOODS,
  COLLAB_TYPES,
} from "../../types/community";
import { createCollaboration, uploadAudio } from "../../services/communityService";

interface CreateCollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCollabModal: React.FC<CreateCollabModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);

  const [formData, setFormData] = useState<Partial<CreateCollabFormData>>({
    title: "",
    description: "",
    genre: "pop",
    mood: "energetic",
    collabType: "single_singer",
    lyrics: "",
    bpm: undefined,
    songKey: "",
    maxSubmissions: 10,
    partsNeeded: [],
  });

  const [parts, setParts] = useState<CollabPart[]>([]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        title: "",
        description: "",
        genre: "pop",
        mood: "energetic",
        collabType: "single_singer",
        lyrics: "",
        bpm: undefined,
        songKey: "",
        maxSubmissions: 10,
        partsNeeded: [],
      });
      setParts([]);
      setInstrumentalFile(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "bpm" || name === "maxSubmissions" ? Number(value) || undefined : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInstrumentalFile(file);
    }
  };

  const addPart = () => {
    setParts((prev) => [...prev, { part: "", description: "" }]);
  };

  const updatePart = (index: number, field: keyof CollabPart, value: string) => {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const removePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
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

    if (!instrumentalFile) {
      setError("Instrumental track is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload instrumental
      const instrumentalPath = `collabs/${user.id}/${Date.now()}_instrumental.webm`;
      const uploadResult = await uploadAudio(instrumentalFile, instrumentalPath);

      if (uploadResult.error || !uploadResult.url) {
        setError(uploadResult.error || "Failed to upload file");
        setIsSubmitting(false);
        return;
      }

      // Create collaboration
      const collabData: CreateCollabFormData = {
        title: formData.title!,
        description: formData.description || "",
        genre: formData.genre as Genre,
        mood: formData.mood as Mood,
        collabType: formData.collabType as CollabType,
        instrumentalUrl: uploadResult.url,
        lyrics: formData.lyrics,
        bpm: formData.bpm,
        songKey: formData.songKey,
        maxSubmissions: formData.maxSubmissions,
        partsNeeded: formData.collabType === "multi_part" ? parts : undefined,
      };

      const result = await createCollaboration(collabData, user.id);

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
            <h2 className="text-xl font-bold text-white">
              Create Collaboration
            </h2>
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
              placeholder="Give your collaboration a name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
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
              placeholder="Describe what you're looking for..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 resize-none"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Collaboration Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Collaboration Type
            </label>
            <select
              name="collabType"
              value={formData.collabType}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              {COLLAB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} - {t.description}
                </option>
              ))}
            </select>
          </div>

          {/* Parts for multi-part */}
          {formData.collabType === "multi_part" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Parts Needed
              </label>
              <div className="space-y-2">
                {parts.map((part, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={part.part}
                      onChange={(e) => updatePart(index, "part", e.target.value)}
                      placeholder="Part name (e.g., Verse 1)"
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={part.description}
                      onChange={(e) => updatePart(index, "description", e.target.value)}
                      placeholder="Description"
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      className="px-3 py-2 text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPart}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  + Add Part
                </button>
              </div>
            </div>
          )}

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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
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
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Instrumental File */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Instrumental Track *
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
            />
            {instrumentalFile && (
              <p className="text-sm text-gray-400 mt-1">{instrumentalFile.name}</p>
            )}
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
              placeholder="Paste or type lyrics here..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Collaboration"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateCollabModal;
