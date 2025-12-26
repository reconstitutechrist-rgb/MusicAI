import React, { useState, useRef, useEffect, useCallback } from "react";
import { TimelineSegment } from "../../types";

interface TimelineEditorProps {
  segments: TimelineSegment[];
  onSegmentsChange: (segments: TimelineSegment[]) => void;
  duration: number; // Total timeline duration in seconds
  currentTime: number;
  onSeek: (time: number) => void;
  pixelsPerSecond?: number;
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({
  segments,
  onSegmentsChange,
  duration,
  currentTime,
  onSeek,
  pixelsPerSecond = 50,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingSegment, setDraggingSegment] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const timelineWidth = duration * pixelsPerSecond;

  const handleSegmentMouseDown = (
    e: React.MouseEvent,
    segmentId: string,
    segmentStartTime: number,
  ) => {
    e.stopPropagation();
    setDraggingSegment(segmentId);
    setDragStartX(e.clientX);
    setDragStartTime(segmentStartTime);
    setSelectedSegment(segmentId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingSegment) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond;
    const newStartTime = Math.max(0, dragStartTime + deltaTime);

    const updatedSegments = segments.map((seg) =>
      seg.id === draggingSegment ? { ...seg, startTime: newStartTime } : seg,
    );

    onSegmentsChange(updatedSegments);
  }, [draggingSegment, dragStartX, dragStartTime, pixelsPerSecond, segments, onSegmentsChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingSegment(null);
  }, []);

  useEffect(() => {
    if (draggingSegment) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingSegment, handleMouseMove, handleMouseUp]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (draggingSegment) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const handleSegmentVolumeChange = (segmentId: string, volume: number) => {
    const updatedSegments = segments.map((seg) =>
      seg.id === segmentId ? { ...seg, volume } : seg,
    );
    onSegmentsChange(updatedSegments);
  };

  const handleSegmentFadeChange = (
    segmentId: string,
    fadeType: "fadeIn" | "fadeOut",
    value: number,
  ) => {
    const updatedSegments = segments.map((seg) =>
      seg.id === segmentId ? { ...seg, [fadeType]: value } : seg,
    );
    onSegmentsChange(updatedSegments);
  };

  const handleDeleteSegment = (segmentId: string) => {
    const updatedSegments = segments.filter((seg) => seg.id !== segmentId);
    onSegmentsChange(updatedSegments);
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
    }
  };

  const selectedSegmentData = segments.find((s) => s.id === selectedSegment);

  return (
    <div className="timeline-editor">
      {/* Timeline ruler */}
      <div className="relative bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Timeline</span>
          <span className="text-xs text-gray-500">
            {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
          </span>
        </div>

        {/* Time markers */}
        <div className="relative h-8 mb-2">
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(i / duration) * 100}%` }}
            >
              <div className="h-2 w-px bg-gray-600"></div>
              <span className="text-xs text-gray-500 mt-1">{i}s</span>
            </div>
          ))}
        </div>

        {/* Timeline track */}
        <div
          ref={timelineRef}
          className="relative bg-gray-900/50 rounded h-24 overflow-x-auto cursor-pointer"
          onClick={handleTimelineClick}
          style={{ minWidth: `${timelineWidth}px` }}
        >
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-20 pointer-events-none"
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
          >
            <div className="w-3 h-3 bg-indigo-500 rounded-full absolute -left-1 -top-1"></div>
          </div>

          {/* Segments */}
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={`absolute top-2 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded cursor-move border-2 transition-all ${
                selectedSegment === segment.id
                  ? "border-yellow-400 shadow-lg"
                  : "border-transparent hover:border-indigo-400"
              }`}
              style={{
                left: `${segment.startTime * pixelsPerSecond}px`,
                width: `${(segment.duration - segment.trimStart - segment.trimEnd) * pixelsPerSecond}px`,
                opacity: segment.volume,
              }}
              onMouseDown={(e) =>
                handleSegmentMouseDown(e, segment.id, segment.startTime)
              }
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSegment(segment.id);
              }}
            >
              <div className="p-2 h-full flex flex-col justify-between text-xs text-white">
                <div className="font-semibold truncate">{segment.title}</div>
                <div className="text-[10px] opacity-75">
                  {(segment.duration - segment.trimStart - segment.trimEnd).toFixed(
                    1,
                  )}
                  s
                </div>
              </div>

              {/* Fade indicators */}
              {segment.fadeIn > 0 && (
                <div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-transparent to-white/20 pointer-events-none"
                  style={{
                    width: `${segment.fadeIn * pixelsPerSecond}px`,
                  }}
                ></div>
              )}
              {segment.fadeOut > 0 && (
                <div
                  className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-transparent to-white/20 pointer-events-none"
                  style={{
                    width: `${segment.fadeOut * pixelsPerSecond}px`,
                  }}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Segment properties panel */}
      {selectedSegmentData && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-white">
              {selectedSegmentData.title}
            </h4>
            <button
              onClick={() => handleDeleteSegment(selectedSegmentData.id)}
              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Delete
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Volume: {Math.round(selectedSegmentData.volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedSegmentData.volume}
                onChange={(e) =>
                  handleSegmentVolumeChange(
                    selectedSegmentData.id,
                    parseFloat(e.target.value),
                  )
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Fade In: {selectedSegmentData.fadeIn.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={selectedSegmentData.fadeIn}
                onChange={(e) =>
                  handleSegmentFadeChange(
                    selectedSegmentData.id,
                    "fadeIn",
                    parseFloat(e.target.value),
                  )
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Fade Out: {selectedSegmentData.fadeOut.toFixed(1)}s
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={selectedSegmentData.fadeOut}
                onChange={(e) =>
                  handleSegmentFadeChange(
                    selectedSegmentData.id,
                    "fadeOut",
                    parseFloat(e.target.value),
                  )
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Position: {selectedSegmentData.startTime.toFixed(2)}s
              </label>
              <div className="text-xs text-gray-500">
                Drag to reposition on timeline
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .timeline-editor input[type="range"] {
          appearance: none;
          background: transparent;
          cursor: pointer;
        }

        .timeline-editor input[type="range"]::-webkit-slider-track {
          background: #374151;
          height: 4px;
          border-radius: 2px;
        }

        .timeline-editor input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          background: #6366f1;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          margin-top: -6px;
        }

        .timeline-editor input[type="range"]::-webkit-slider-thumb:hover {
          background: #818cf8;
        }

        .timeline-editor input[type="range"]::-moz-range-track {
          background: #374151;
          height: 4px;
          border-radius: 2px;
        }

        .timeline-editor input[type="range"]::-moz-range-thumb {
          background: #6366f1;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          border: none;
        }

        .timeline-editor input[type="range"]::-moz-range-thumb:hover {
          background: #818cf8;
        }
      `}</style>
    </div>
  );
};

export default TimelineEditor;
