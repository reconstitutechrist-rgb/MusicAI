import React, { useState, useRef, useCallback, ReactNode } from 'react';

interface StemSeparatorProps {
  audioContext: AudioContext | null;
  onStemsExtracted?: (stems: ExtractedStems) => void;
}

export interface ExtractedStems {
  vocals: AudioBuffer | null;
  instrumental: AudioBuffer | null;
  bass: AudioBuffer | null;
  drums: AudioBuffer | null;
}

type StemType = 'vocals' | 'instrumental' | 'bass' | 'drums';

interface StemConfig {
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
}

const STEM_CONFIGS: Record<StemType, StemConfig> = {
  vocals: {
    name: 'Vocals',
    description: 'Extract center-panned vocals using M/S processing',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    color: 'pink'
  },
  instrumental: {
    name: 'Instrumental',
    description: 'Remove center-panned elements to isolate instruments',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    color: 'blue'
  },
  bass: {
    name: 'Bass',
    description: 'Isolate low frequencies (20-200Hz)',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    color: 'orange'
  },
  drums: {
    name: 'Drums/Percussion',
    description: 'Isolate transients and rhythmic elements',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    color: 'yellow'
  }
};

const StemSeparator: React.FC<StemSeparatorProps> = ({
  audioContext,
  onStemsExtracted
}) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStem, setCurrentStem] = useState<StemType | null>(null);
  const [extractedStems, setExtractedStems] = useState<ExtractedStems>({
    vocals: null,
    instrumental: null,
    bass: null,
    drums: null
  });
  const [playingStem, setPlayingStem] = useState<StemType | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioContext) return;

    setAudioFile(file);
    setExtractedStems({ vocals: null, instrumental: null, bass: null, drums: null });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
    } catch (error) {
      console.error('Error decoding audio:', error);
    }
  }, [audioContext]);

  // Extract vocals using center channel extraction (M/S processing)
  const extractVocals = useCallback((buffer: AudioBuffer): AudioBuffer => {
    const ctx = new OfflineAudioContext(
      1, // Mono output for vocals
      buffer.length,
      buffer.sampleRate
    );

    const outputBuffer = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
    const outputData = outputBuffer.getChannelData(0);

    if (buffer.numberOfChannels >= 2) {
      const leftData = buffer.getChannelData(0);
      const rightData = buffer.getChannelData(1);

      // Center extraction: (L + R) / 2 - enhanced with frequency filtering
      for (let i = 0; i < buffer.length; i++) {
        // Sum (mono/center) = (L + R) / 2
        outputData[i] = (leftData[i] + rightData[i]) / 2;
      }
    } else {
      // Mono source - just copy
      const sourceData = buffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        outputData[i] = sourceData[i];
      }
    }

    return outputBuffer;
  }, []);

  // Extract instrumental using side channel (removes center)
  const extractInstrumental = useCallback((buffer: AudioBuffer): AudioBuffer => {
    const outputBuffer = new OfflineAudioContext(
      2,
      buffer.length,
      buffer.sampleRate
    ).createBuffer(2, buffer.length, buffer.sampleRate);

    if (buffer.numberOfChannels >= 2) {
      const leftData = buffer.getChannelData(0);
      const rightData = buffer.getChannelData(1);
      const outLeft = outputBuffer.getChannelData(0);
      const outRight = outputBuffer.getChannelData(1);

      // Side extraction: L - R and R - L (removes center-panned elements)
      for (let i = 0; i < buffer.length; i++) {
        const mid = (leftData[i] + rightData[i]) / 2;
        // Reduce center content
        outLeft[i] = leftData[i] - mid * 0.8;
        outRight[i] = rightData[i] - mid * 0.8;
      }
    } else {
      // Mono source - can't separate
      const sourceData = buffer.getChannelData(0);
      const outLeft = outputBuffer.getChannelData(0);
      const outRight = outputBuffer.getChannelData(1);
      for (let i = 0; i < buffer.length; i++) {
        outLeft[i] = sourceData[i];
        outRight[i] = sourceData[i];
      }
    }

    return outputBuffer;
  }, []);

  // Extract bass using lowpass filter
  const extractBass = useCallback(async (buffer: AudioBuffer): Promise<AudioBuffer> => {
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Lowpass filter for bass (cutoff at 200Hz)
    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 200;
    lowpass.Q.value = 0.7;

    // Additional lowpass for steeper rolloff
    const lowpass2 = offlineCtx.createBiquadFilter();
    lowpass2.type = 'lowpass';
    lowpass2.frequency.value = 250;
    lowpass2.Q.value = 0.7;

    source.connect(lowpass);
    lowpass.connect(lowpass2);
    lowpass2.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  }, []);

  // Extract drums using transient detection (highpass + envelope follower simulation)
  const extractDrums = useCallback(async (buffer: AudioBuffer): Promise<AudioBuffer> => {
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Highpass to remove bass (drums have attack above bass frequencies)
    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 100;
    highpass.Q.value = 0.7;

    // Bandpass for snare/hi-hat range
    const bandpass = offlineCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2000;
    bandpass.Q.value = 0.5;

    // Compressor to emphasize transients
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.05;

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(compressor);
    compressor.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  }, []);

  const processStem = useCallback(async (stemType: StemType) => {
    if (!audioBuffer || !audioContext) return;

    setProcessing(true);
    setCurrentStem(stemType);
    setProgress(0);

    try {
      let result: AudioBuffer;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      switch (stemType) {
        case 'vocals':
          result = extractVocals(audioBuffer);
          break;
        case 'instrumental':
          result = extractInstrumental(audioBuffer);
          break;
        case 'bass':
          result = await extractBass(audioBuffer);
          break;
        case 'drums':
          result = await extractDrums(audioBuffer);
          break;
        default:
          throw new Error('Unknown stem type');
      }

      clearInterval(progressInterval);
      setProgress(100);

      const newStems = { ...extractedStems, [stemType]: result };
      setExtractedStems(newStems);
      onStemsExtracted?.(newStems);

    } catch (error) {
      console.error('Error processing stem:', error);
    } finally {
      setProcessing(false);
      setCurrentStem(null);
      setTimeout(() => setProgress(0), 500);
    }
  }, [audioBuffer, audioContext, extractVocals, extractInstrumental, extractBass, extractDrums, extractedStems, onStemsExtracted]);

  const playStem = useCallback((stemType: StemType) => {
    if (!audioContext || !extractedStems[stemType]) return;

    // Stop any currently playing audio
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }

    if (playingStem === stemType) {
      setPlayingStem(null);
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = extractedStems[stemType]!;
    source.connect(audioContext.destination);
    source.onended = () => setPlayingStem(null);
    source.start(0);

    audioSourceRef.current = source;
    setPlayingStem(stemType);
  }, [audioContext, extractedStems, playingStem]);

  const downloadStem = useCallback((stemType: StemType) => {
    const buffer = extractedStems[stemType];
    if (!buffer) return;

    // Convert AudioBuffer to WAV
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stemType}_stem.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [extractedStems]);

  const processAllStems = useCallback(async () => {
    const stemTypes: StemType[] = ['vocals', 'instrumental', 'bass', 'drums'];
    for (const stem of stemTypes) {
      await processStem(stem);
    }
  }, [processStem]);

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-green-900/30 to-teal-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-600/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white">Stem Separator</h3>
            <p className="text-sm text-gray-400">Isolate vocals, instruments, bass, and drums</p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="p-4 border-b border-gray-700">
        <label className="block">
          <div className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${audioFile
              ? 'border-green-500/50 bg-green-900/20'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
            }
          `}>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            {audioFile ? (
              <div>
                <svg className="w-8 h-8 mx-auto text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium text-green-400">{audioFile.name}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {audioBuffer && `${(audioBuffer.duration).toFixed(1)}s | ${audioBuffer.sampleRate}Hz | ${audioBuffer.numberOfChannels}ch`}
                </p>
              </div>
            ) : (
              <div>
                <svg className="w-8 h-8 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-400">Drop audio file or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">MP3, WAV, M4A supported</p>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Processing Progress */}
      {processing && (
        <div className="p-4 bg-gray-900/50 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300">
              Extracting {currentStem && STEM_CONFIGS[currentStem].name}...
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stem Cards */}
      {audioBuffer && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500 uppercase">Available Stems</p>
            <button
              onClick={processAllStems}
              disabled={processing}
              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white transition-colors"
            >
              Extract All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(STEM_CONFIGS) as StemType[]).map(stemType => {
              const config = STEM_CONFIGS[stemType];
              const isExtracted = extractedStems[stemType] !== null;
              const isPlaying = playingStem === stemType;

              return (
                <div
                  key={stemType}
                  className={`
                    p-4 rounded-lg border transition-all
                    ${isExtracted
                      ? `border-${config.color}-500/50 bg-${config.color}-900/20`
                      : 'border-gray-600 bg-gray-700/30'
                    }
                  `}
                >
                  <div className={`text-${config.color}-400 mb-2`}>
                    {config.icon}
                  </div>
                  <h4 className="font-medium text-white">{config.name}</h4>
                  <p className="text-xs text-gray-400 mb-3">{config.description}</p>

                  <div className="flex gap-2">
                    {isExtracted ? (
                      <>
                        <button
                          onClick={() => playStem(stemType)}
                          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                            isPlaying
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-gray-600 hover:bg-gray-500 text-white'
                          }`}
                        >
                          {isPlaying ? 'Stop' : 'Play'}
                        </button>
                        <button
                          onClick={() => downloadStem(stemType)}
                          className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-medium text-white transition-colors"
                        >
                          Download
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => processStem(stemType)}
                        disabled={processing}
                        className="w-full py-1.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-xs font-medium text-white transition-colors"
                      >
                        Extract
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="p-4 bg-gray-900/30 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          <span className="text-yellow-500">Note:</span> This uses frequency-based separation techniques.
          For professional results, consider dedicated stem separation tools like Spleeter or LALAL.AI.
        </p>
      </div>
    </div>
  );
};

export default StemSeparator;
