import React, { useState, useCallback } from "react";
import { LibrarySong } from "../../../../types/timeline";
import { useTimeline } from "../TimelineEditorContext";

interface SongLibraryPanelProps {
  songs: LibrarySong[];
  onUploadSong?: (file: File) => Promise<LibrarySong>;
  className?: string;
}

/**
 * SongLibraryPanel - Song selection sidebar for adding clips to timeline
 * Shows available songs with analysis info and supports file upload
 */
export function SongLibraryPanel({
  songs,
  onUploadSong,
  className = "",
}: SongLibraryPanelProps) {
  const { state, actions } = useTimeline();
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Filter songs by search query
  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.style.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle adding song to timeline
  const handleAddSong = useCallback(
    async (song: LibrarySong) => {
      await actions.addClip(song);
    },
    [actions],
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onUploadSong) return;

      setIsUploading(true);
      try {
        const song = await onUploadSong(file);
        await actions.addClip(song);
      } catch (error) {
        console.error("Failed to upload song:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSong, actions],
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent, song: LibrarySong) => {
      e.dataTransfer.setData("application/json", JSON.stringify(song));
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex flex-col bg-gray-900/80 border-r border-white/10 ${className}`}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white mb-2">Song Library</h3>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {filteredSongs.length === 0 ? (
          <div className="p-4 text-center text-white/40 text-sm">
            {songs.length === 0
              ? "No songs available. Upload some to get started!"
              : "No songs match your search."}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSongs.map((song, index) => {
              // Check if song is already in timeline
              const isInTimeline = state.clips.some(
                (clip) => clip.songId === song.id,
              );

              return (
                <div
                  key={song.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, song)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => setDragOverIndex(null)}
                  className={`p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                    dragOverIndex === index
                      ? "bg-indigo-500/30 ring-2 ring-indigo-500"
                      : "bg-white/5 hover:bg-white/10"
                  } ${isInTimeline ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {/* Mini waveform or placeholder */}
                    <div className="w-12 h-8 bg-indigo-500/20 rounded flex items-center justify-center flex-shrink-0">
                      {song.thumbnailWaveform ? (
                        <svg
                          viewBox="0 0 48 32"
                          className="w-full h-full"
                          preserveAspectRatio="none"
                        >
                          {song.thumbnailWaveform.map((value, i) => (
                            <rect
                              key={i}
                              x={i * 2}
                              y={16 - value * 14}
                              width={1.5}
                              height={value * 28}
                              fill="#818cf8"
                            />
                          ))}
                        </svg>
                      ) : (
                        <span className="text-indigo-400 text-lg">♪</span>
                      )}
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {song.title}
                      </div>
                      <div className="text-xs text-white/50 truncate">
                        {song.style}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                        <span>{formatDuration(song.duration)}</span>
                        {song.analysis && (
                          <>
                            <span>•</span>
                            <span>{song.analysis.bpm} BPM</span>
                            <span>•</span>
                            <span>{song.analysis.key}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => handleAddSong(song)}
                      disabled={isInTimeline}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isInTimeline
                          ? "text-white/20 cursor-not-allowed"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                      title={
                        isInTimeline ? "Already in timeline" : "Add to timeline"
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="p-3 border-t border-white/10">
        <label
          className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-dashed border-white/20 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/40 transition-colors cursor-pointer ${
            isUploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="sr-only"
          />
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Uploading...</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm">Upload Song</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}

export default SongLibraryPanel;
