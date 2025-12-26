# Song Merger Feature Documentation

## Overview

The Song Merger feature allows users to combine multiple songs on a visual timeline editor and use AI-powered assistance to create seamless transitions and professional mixes.

## Key Features

### 1. Timeline Editor
- **Visual Timeline**: Drag-and-drop interface for arranging multiple audio files
- **Segment Properties**: Adjust volume, fade in/out, and position for each segment
- **Real-time Preview**: Play and preview your merged composition before export
- **Interactive Controls**: Click segments to edit, drag to reposition

### 2. Audio Segment Management
- **Multi-file Upload**: Upload multiple audio files at once
- **Automatic Positioning**: New segments are automatically placed after existing ones
- **Trimming Support**: Adjust start and end trim points for each segment
- **Volume Control**: Individual volume adjustment for each segment (0-100%)
- **Fade Effects**: Configurable fade in/out duration (0-5 seconds)

### 3. AI-Powered Merge Assistant

#### Merge Strategies
- **Crossfade**: Smooth volume transitions between songs
- **Beat-Match**: Synchronize beats for DJ-style transitions
- **Smooth Transition**: Natural, flowing transitions
- **Medley**: Arrange songs in a continuous performance
- **Mashup**: Creative combination of multiple songs
- **Custom (AI-Guided)**: Let AI suggest the best approach based on your description

#### AI Suggestions
The AI assistant can:
- Analyze song compatibility (tempo, key, mood)
- Suggest optimal transition points
- Recommend tempo adjustments for better flow
- Identify key/harmonic relationships
- Provide detailed transition recommendations
- Generate step-by-step merge instructions

### 4. Export Functionality
- **WAV Export**: High-quality audio export
- **Offline Rendering**: Professional audio rendering with all effects applied
- **Preserves Quality**: Maintains original audio quality with proper mixing

## How to Use

### Basic Workflow

1. **Upload Songs**
   - Click "Upload Audio Files" button
   - Select multiple audio files (MP3, WAV, etc.)
   - Files will appear on the timeline

2. **Arrange on Timeline**
   - Drag segments to reposition them
   - Click a segment to view/edit properties
   - Adjust volume, fades, and position
   - Delete unwanted segments

3. **Get AI Assistance**
   - Select a merge strategy from dropdown
   - (Optional) Add custom instructions describing your vision
   - Click "Get AI Suggestions" for a merge plan
   - Click "Analyze Merge Details" for technical recommendations

4. **Preview Your Mix**
   - Click "Play" to preview the merged audio
   - Use "Stop" to reset playback
   - Seek to different positions by clicking the timeline

5. **Export**
   - Click "Export Merged Song" when satisfied
   - Downloads a WAV file with your merged composition

### Tips for Best Results

#### For Professional Transitions:
- Use fade in/out effects (0.5-2 seconds typically works well)
- Adjust volumes to balance different tracks
- Let AI suggest tempo and key adjustments
- Preview frequently to check transitions

#### For Custom Merge Instructions:
Be specific about your goals:
- ✅ "Create a high-energy mashup with beat-matched transitions between dance tracks"
- ✅ "Make a smooth medley that tells an emotional story, starting upbeat and ending mellow"
- ✅ "DJ-style mix with quick cuts and echo effects between hip-hop tracks"
- ❌ "Make it sound good" (too vague)

#### Understanding AI Analysis:

**Suggested Transitions**: AI recommends specific transition types (crossfade, echo-fade, etc.) with durations and explanations

**Tempo Adjustments**: If songs have different BPMs, AI suggests which tracks to speed up/slow down

**Key Adjustments**: For harmonic compatibility, AI may suggest pitch shifting certain segments by semitones

**Overall Flow**: AI describes the narrative arc and emotional journey of your merged piece

## Technical Details

### Supported Audio Formats
- MP3
- WAV
- FLAC
- AAC
- OGG
- M4A
- And other formats supported by the Web Audio API

### Audio Processing
- **Client-side Processing**: All audio mixing happens in your browser
- **Web Audio API**: Uses native browser audio capabilities for professional results
- **Offline Rendering**: Ensures glitch-free export even for long compositions
- **High Quality**: Maintains original sample rates and bit depths

### AI Integration
- **Gemini AI Models**: Uses Google's Gemini Pro for analysis and suggestions
- **Context-Aware**: Considers song metadata, user instructions, and musical theory
- **Intelligent Recommendations**: Analyzes tempo, key, genre, and mood

## Limitations

- **Browser Audio API**: Relies on browser support for Web Audio API
- **File Size**: Very large audio files (>100MB) may take longer to process
- **AI Analysis**: Currently text-based analysis; actual audio analysis coming in future updates
- **Real-time Effects**: Complex effects are applied during export, not in real-time preview

## Future Enhancements

Planned features:
- [ ] Beat detection and auto-alignment
- [ ] Key detection and auto-tuning
- [ ] More transition effect types
- [ ] Collaborative mixing sessions
- [ ] Cloud storage integration
- [ ] Mobile touch optimization
- [ ] Waveform visualization
- [ ] Spectral analysis overlay
- [ ] Undo/Redo functionality
- [ ] Save/Load project files

## Troubleshooting

### Issue: Audio won't play
- **Solution**: Check that your audio files are valid and not corrupted
- **Solution**: Try a different browser (Chrome/Edge recommended)
- **Solution**: Ensure your browser's audio isn't muted

### Issue: Export takes too long
- **Solution**: Reduce the number of segments or total duration
- **Solution**: Close other tabs to free up browser resources

### Issue: AI suggestions seem generic
- **Solution**: Provide more detailed custom instructions
- **Solution**: Upload songs with similar genres/tempos for better analysis

### Issue: Transitions sound abrupt
- **Solution**: Increase fade in/out durations
- **Solution**: Adjust segment positioning for better overlap
- **Solution**: Use AI analysis to find optimal transition points

## API Reference

### Types

```typescript
interface TimelineSegment {
  id: string;
  audioUrl: string;
  audioBuffer?: AudioBuffer;
  title: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Duration of the segment in seconds
  trimStart: number; // How much of the start is trimmed
  trimEnd: number; // How much of the end is trimmed
  volume: number; // 0 to 1
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
}

type MergeStrategy =
  | "crossfade"
  | "beat-match"
  | "smooth-transition"
  | "medley"
  | "mashup"
  | "custom";
```

### Service Functions

```typescript
// Get AI merge suggestions
analyzeSongMerge(
  segments: Array<{ id, title, duration, audioBase64 }>,
  mergeInstructions: string
): Promise<MergeAnalysisResult>

// Generate step-by-step instructions
generateMergeInstructions(
  segments: Array<{ title, duration }>,
  userGoal: string
): Promise<string>
```

## Accessibility

- Keyboard navigation supported for timeline controls
- Screen reader friendly labels
- High contrast mode compatible
- Responsive design for different screen sizes

## Credits

Built using:
- **React**: UI framework
- **TypeScript**: Type safety
- **Web Audio API**: Audio processing
- **Gemini AI**: Intelligent merge assistance
- **Tailwind CSS**: Styling
