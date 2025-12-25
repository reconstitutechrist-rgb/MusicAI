
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Page from '../ui/Page';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generateSpeech, processAudioTrack, generateInstrumentalTrack, analyzeAudioTrack } from '../../services/geminiService';
import WaveformPlayer from '../ui/WaveformPlayer';
import VuMeter from '../ui/VuMeter';
import ParametricEQ, { DEFAULT_EQ_BANDS, type EQBand } from '../ui/ParametricEQ';
import SpectrumAnalyzer from '../ui/SpectrumAnalyzer';
import LufsMeter, { type LufsPreset } from '../ui/LufsMeter';
import StereoFieldVisualizer from '../ui/StereoFieldVisualizer';
import MultibandCompressor, { DEFAULT_MULTIBAND_SETTINGS, type MultibandCompressorSettings } from '../ui/MultibandCompressor';
import MasteringAssistant, { type MasteringSuggestions } from '../ui/MasteringAssistant';
import ChordSuggestions from '../ui/ChordSuggestions';
import StemSeparator from '../ui/StemSeparator';
import { AudioAnalysisResult, AutomationLaneData, AutomatableParameter } from '../../types';
import AutomationLane, { getValueAtTime, denormalizeValue } from '../ui/AutomationLane';
import {
  bufferToBlob,
  downloadBlob,
  renderMixOffline,
  renderStemOffline,
  fetchAudioBuffer,
  AUDIO_FORMATS,
  type TrackConfig,
  type AudioFormat
} from '../../utils/audioExport';
import {
  createMultibandCompressor,
  updateMultibandCompressor,
  getGainReductions,
  createLimiter,
  calculateDelayTime,
  createSidechainCompressor,
  calculateSidechainGainReduction,
  DEFAULT_SIDECHAIN_SETTINGS,
  type MultibandCompressorNodes,
  type LimiterNodes,
  type SidechainCompressorNodes,
  type SidechainSettings
} from '../../utils/audioProcessing';

interface AudioProductionProps {
  lyrics: string;
  instrumentalUrl?: string;
  initialVocalUrl?: string;
}

interface TrackFX {
    eqLow: number;  // -10 to 10
    eqMid: number;  // -10 to 10
    eqHigh: number; // -10 to 10
    reverb: number; // 0 to 1
    delay: number;  // 0 to 1
}

const defaultFX: TrackFX = {
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    reverb: 0,
    delay: 0
};

// --- Audio Helpers ---

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]);
    }
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const bufferToWave = (abuffer: AudioBuffer) => {
    const numOfChan = abuffer.numberOfChannels,
          len = abuffer.length * numOfChan * 2 + 44;
    let buffer = new ArrayBuffer(len),
        view = new DataView(buffer),
        channels = [],
        i, sample,
        offset = 0,
        pos = 0;

    setUint32(0x46464952); setUint32(len - 8); setUint32(0x45564157); 
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan); 
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); 
    setUint32(len - pos - 4); 

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    let frameIndex = 0;
    while(pos < len && frameIndex < abuffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][frameIndex]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        frameIndex++;
    }
    return new Blob([buffer], {type: "audio/wav"});
    function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
}

// Generate a simple impulse response for reverb
const createImpulseResponse = (ctx: AudioContext, duration: number, decay: number) => {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = length - i;
        const fade = Math.pow(n / length, decay);
        left[i] = (Math.random() * 2 - 1) * fade;
        right[i] = (Math.random() * 2 - 1) * fade;
    }
    return impulse;
};


const AVAILABLE_VOICES = [
    { name: 'Kore', gender: 'Female', description: 'Calm, soothing' },
    { name: 'Puck', gender: 'Male', description: 'Energetic, bright' },
    { name: 'Charon', gender: 'Male', description: 'Deep, resonant' },
    { name: 'Fenrir', gender: 'Male', description: 'Intense, clear' },
    { name: 'Zephyr', gender: 'Female', description: 'Gentle, light' },
];

const KEYS = ['Auto', 'C Major', 'A Minor', 'G Major', 'E Minor', 'F Major', 'D Minor'];
const HARMONY_TYPES = ['High 3rd', 'Low 3rd', 'High 5th', 'Low 5th', 'Octave Up', 'Octave Down', 'Full Choir'];

// Effect Presets
interface FXPreset {
  id: string;
  name: string;
  vocalFX: TrackFX;
  harmonyFX: TrackFX;
  volumes: { inst: number; vocal: number; harmony: number };
  isBuiltIn?: boolean;
}

// Mixer State Snapshot for Undo/Redo
interface MixerStateSnapshot {
  instVolume: number;
  vocalVolume: number;
  harmonyVolume: number;
  vocalSettings: TrackFX;
  harmonySettings: TrackFX;
  vocalEQBands: EQBand[];
  harmonyEQBands: EQBand[];
  delayBpm: number;
  delayNoteValue: '1/4' | '1/8' | '1/8d' | '1/16';
  delayFeedback: number;
  delayMix: number;
  limiterEnabled: boolean;
  limiterCeiling: number;
  multibandSettings: MultibandCompressorSettings;
  multibandBypass: boolean;
}

const BUILT_IN_PRESETS: FXPreset[] = [
  {
    id: 'flat',
    name: 'Flat (Default)',
    vocalFX: { eqLow: 0, eqMid: 0, eqHigh: 0, reverb: 0, delay: 0 },
    harmonyFX: { eqLow: 0, eqMid: 0, eqHigh: 0, reverb: 0, delay: 0 },
    volumes: { inst: 0.8, vocal: 1.0, harmony: 0.6 },
    isBuiltIn: true
  },
  {
    id: 'radio-ready',
    name: 'Radio Ready',
    vocalFX: { eqLow: -2, eqMid: 3, eqHigh: 4, reverb: 0.15, delay: 0.1 },
    harmonyFX: { eqLow: -3, eqMid: 2, eqHigh: 3, reverb: 0.2, delay: 0.05 },
    volumes: { inst: 0.75, vocal: 1.0, harmony: 0.45 },
    isBuiltIn: true
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    vocalFX: { eqLow: 3, eqMid: -2, eqHigh: -6, reverb: 0.3, delay: 0.15 },
    harmonyFX: { eqLow: 4, eqMid: -3, eqHigh: -7, reverb: 0.35, delay: 0.1 },
    volumes: { inst: 0.85, vocal: 0.9, harmony: 0.5 },
    isBuiltIn: true
  },
  {
    id: 'live-room',
    name: 'Live Room',
    vocalFX: { eqLow: 1, eqMid: 0, eqHigh: 2, reverb: 0.5, delay: 0.2 },
    harmonyFX: { eqLow: 0, eqMid: 1, eqHigh: 2, reverb: 0.55, delay: 0.15 },
    volumes: { inst: 0.7, vocal: 1.0, harmony: 0.7 },
    isBuiltIn: true
  },
  {
    id: 'intimate',
    name: 'Intimate',
    vocalFX: { eqLow: 2, eqMid: 4, eqHigh: 1, reverb: 0.08, delay: 0 },
    harmonyFX: { eqLow: 1, eqMid: 3, eqHigh: 0, reverb: 0.1, delay: 0 },
    volumes: { inst: 0.5, vocal: 1.0, harmony: 0.4 },
    isBuiltIn: true
  },
  {
    id: 'stadium',
    name: 'Stadium',
    vocalFX: { eqLow: 4, eqMid: 2, eqHigh: 5, reverb: 0.75, delay: 0.35 },
    harmonyFX: { eqLow: 3, eqMid: 3, eqHigh: 4, reverb: 0.8, delay: 0.3 },
    volumes: { inst: 0.85, vocal: 1.0, harmony: 0.8 },
    isBuiltIn: true
  }
];

const AudioProduction: React.FC<AudioProductionProps> = ({ lyrics, instrumentalUrl, initialVocalUrl }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [vocalAudioUrl, setVocalAudioUrl] = useState<string | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');

  const [currentInstrumentalUrl, setCurrentInstrumentalUrl] = useState<string | undefined>(instrumentalUrl);
  const [refinedVocalUrl, setRefinedVocalUrl] = useState<string | null>(null);
  const [harmonyAudioUrl, setHarmonyAudioUrl] = useState<string | null>(null);
  
  const [pitchCorrectionLevel, setPitchCorrectionLevel] = useState(50);
  const [selectedKey, setSelectedKey] = useState('Auto');
  const [isRefining, setIsRefining] = useState(false);
  const [refiningError, setRefiningError] = useState('');

  const [selectedHarmony, setSelectedHarmony] = useState('High 3rd');
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [harmonyError, setHarmonyError] = useState('');

  // Mixer State
  const [isPlayingMix, setIsPlayingMix] = useState(false);
  const [instVolume, setInstVolume] = useState(0.8);
  const [vocalVolume, setVocalVolume] = useState(1.0);
  const [harmonyVolume, setHarmonyVolume] = useState(0.6);
  const [useRefinedVocal, setUseRefinedVocal] = useState(false);

  // Advanced FX State
  const [vocalSettings, setVocalSettings] = useState<TrackFX>(defaultFX);
  const [harmonySettings, setHarmonySettings] = useState<TrackFX>(defaultFX);
  const [showVocalFX, setShowVocalFX] = useState(false);
  const [showHarmonyFX, setShowHarmonyFX] = useState(false);

  // Parametric EQ State
  const [useAdvancedEQ, setUseAdvancedEQ] = useState(false);
  const [vocalEQBands, setVocalEQBands] = useState<EQBand[]>(DEFAULT_EQ_BANDS);
  const [harmonyEQBands, setHarmonyEQBands] = useState<EQBand[]>(DEFAULT_EQ_BANDS);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<AudioFormat>('wav-16');
  const [exportOptions, setExportOptions] = useState({
    includeInstrumental: true,
    includeVocal: true,
    includeHarmony: true,
    applyFXToStems: true
  });

  // A/B Comparison State
  const [bypassAllFX, setBypassAllFX] = useState(false);

  // VU Meter State
  const [showMeters, setShowMeters] = useState(true);
  const [vocalAnalyser, setVocalAnalyser] = useState<AnalyserNode | null>(null);
  const [harmonyAnalyser, setHarmonyAnalyser] = useState<AnalyserNode | null>(null);

  // Pro Metering State
  const [showProMetering, setShowProMetering] = useState(false);
  const [showSpectrumAnalyzer, setShowSpectrumAnalyzer] = useState(true);
  const [showLufsMeter, setShowLufsMeter] = useState(true);
  const [showStereoField, setShowStereoField] = useState(true);
  const [showMultibandCompressor, setShowMultibandCompressor] = useState(false);
  const [spectrumMode, setSpectrumMode] = useState<'bars' | 'line' | 'filled'>('bars');
  const [lufsPreset, setLufsPreset] = useState<LufsPreset>('spotify');
  const [multibandSettings, setMultibandSettings] = useState<MultibandCompressorSettings>(DEFAULT_MULTIBAND_SETTINGS);
  const [multibandBypass, setMultibandBypass] = useState(true);
  const [multibandGainReductions, setMultibandGainReductions] = useState<number[]>([0, 0, 0, 0]);

  // Tempo-synced delay state
  const [delayBpm, setDelayBpm] = useState(120);
  const [delayNoteValue, setDelayNoteValue] = useState<'1/4' | '1/8' | '1/8d' | '1/16'>('1/8');
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [delayMix, setDelayMix] = useState(0.3);

  // Master limiter state
  const [limiterEnabled, setLimiterEnabled] = useState(false);
  const [limiterCeiling, setLimiterCeiling] = useState(-0.3);
  const [limiterGainReduction, setLimiterGainReduction] = useState(0);

  // Sidechain compression state
  const [sidechainEnabled, setSidechainEnabled] = useState(false);
  const [sidechainSource, setSidechainSource] = useState<'inst' | 'vocal' | 'harmony'>('inst');
  const [sidechainTarget, setSidechainTarget] = useState<'vocal' | 'harmony'>('vocal');
  const [sidechainGainReduction, setSidechainGainReduction] = useState(0);
  const [showSidechain, setShowSidechain] = useState(false);
  const [sidechainSettings, setSidechainSettings] = useState<SidechainSettings>(DEFAULT_SIDECHAIN_SETTINGS);
  const sidechainNodesRef = useRef<SidechainCompressorNodes | null>(null);
  const sidechainAnimationRef = useRef<number>(0);
  const sidechainGainRef = useRef<number>(1);

  // Master Analyser State
  const [masterAnalyser, setMasterAnalyser] = useState<AnalyserNode | null>(null);
  const [masterAnalyserL, setMasterAnalyserL] = useState<AnalyserNode | null>(null);
  const [masterAnalyserR, setMasterAnalyserR] = useState<AnalyserNode | null>(null);

  // Preset State
  const [currentPresetId, setCurrentPresetId] = useState<string | null>('flat');
  const [customPresets, setCustomPresets] = useState<FXPreset[]>(() => {
    try {
      const saved = localStorage.getItem('museAiFxPresets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [presetToRename, setPresetToRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const presetImportRef = useRef<HTMLInputElement>(null);

  // Undo/Redo State
  const [historyPast, setHistoryPast] = useState<MixerStateSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<MixerStateSnapshot[]>([]);
  const isUndoRedoAction = useRef(false);
  const lastSnapshotTime = useRef(0);
  const lastSnapshotRef = useRef<string>(''); // For duplicate detection without stale closure

  // Lyrics Editing State
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState(lyrics);

  // Instrumental Swap State
  const [showInstrumentalSwapModal, setShowInstrumentalSwapModal] = useState(false);
  const [isGeneratingInstrumental, setIsGeneratingInstrumental] = useState(false);
  const [instrumentalStyle, setInstrumentalStyle] = useState('');
  const [instrumentalError, setInstrumentalError] = useState('');

  // AI Tools State
  const [showAITools, setShowAITools] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [showMasteringAssistant, setShowMasteringAssistant] = useState(true);
  const [showChordSuggestions, setShowChordSuggestions] = useState(true);
  const [showStemSeparator, setShowStemSeparator] = useState(false);

  // Reference Track State
  const [referenceTrackUrl, setReferenceTrackUrl] = useState<string | null>(null);
  const [referenceTrackName, setReferenceTrackName] = useState<string>('');
  const [referenceTrackPlaying, setReferenceTrackPlaying] = useState(false);
  const [referenceTrackVolume, setReferenceTrackVolume] = useState(1);
  const [showReferenceTrack, setShowReferenceTrack] = useState(false);
  const [listeningToReference, setListeningToReference] = useState(false);
  const [referenceAnalyser, setReferenceAnalyser] = useState<AnalyserNode | null>(null);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const referenceSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const referenceGainRef = useRef<GainNode | null>(null);

  // Automation State
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationLanes, setAutomationLanes] = useState<AutomationLaneData[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(180); // Default 3 minutes
  const animationFrameRef = useRef<number>(0);

  // Refs for Audio Elements and Web Audio Graph
  const instrumentalRef = useRef<HTMLAudioElement>(null);
  const vocalRef = useRef<HTMLAudioElement>(null);
  const harmonyRef = useRef<HTMLAudioElement>(null);

  // Audio Buffer refs for export
  const instrumentalBufferRef = useRef<AudioBuffer | null>(null);
  const vocalBufferRef = useRef<AudioBuffer | null>(null);
  const harmonyBufferRef = useRef<AudioBuffer | null>(null);

  // Web Audio Nodes Refs (to update params without re-creating graph)
  const graphRefs = useRef<{
    instrumental: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      analyser?: AnalyserNode;
    };
    vocal: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      eqLow?: BiquadFilterNode;
      eqMid?: BiquadFilterNode;
      eqHigh?: BiquadFilterNode;
      // 5-band parametric EQ nodes
      parametricEQ?: BiquadFilterNode[];
      reverbGain?: GainNode;
      delayNode?: DelayNode;
      delayFeedback?: GainNode;
      delayGain?: GainNode;
      analyser?: AnalyserNode;
    };
    harmony: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      eqLow?: BiquadFilterNode;
      eqMid?: BiquadFilterNode;
      eqHigh?: BiquadFilterNode;
      // 5-band parametric EQ nodes
      parametricEQ?: BiquadFilterNode[];
      reverbGain?: GainNode;
      delayNode?: DelayNode;
      delayFeedback?: GainNode;
      delayGain?: GainNode;
      analyser?: AnalyserNode;
    };
    master?: {
      analyser?: AnalyserNode;
      splitter?: ChannelSplitterNode;
      analyserL?: AnalyserNode;
      analyserR?: AnalyserNode;
      multibandCompressor?: MultibandCompressorNodes;
      limiter?: LimiterNodes;
      masterGain?: GainNode;
    };
    reverbBuffer?: AudioBuffer;
  }>({ instrumental: {}, vocal: {}, harmony: {}, master: {} });

  // Animation frame ref for gain reduction metering
  const gainReductionAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioContext) {
      // Use 44100Hz for better quality (CD quality) - compatible with ElevenLabs output
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      setAudioContext(context);
      // Generate Impulse Response once
      graphRefs.current.reverbBuffer = createImpulseResponse(context, 2.5, 2.0);
    }
    return () => { audioContext?.close(); }
  }, []);
  
  useEffect(() => {
      if (instrumentalUrl) setCurrentInstrumentalUrl(instrumentalUrl);
  }, [instrumentalUrl]);
  
  // Use initial vocal if provided
  useEffect(() => {
      if (initialVocalUrl) {
          setVocalAudioUrl(initialVocalUrl);
      }
  }, [initialVocalUrl]);

  useEffect(() => {
      if (refinedVocalUrl) setUseRefinedVocal(true);
  }, [refinedVocalUrl]);

  // Sync edited lyrics with incoming lyrics prop
  useEffect(() => {
      if (lyrics && !isEditingLyrics) {
          setEditedLyrics(lyrics);
      }
  }, [lyrics, isEditingLyrics]);

  // Keyboard shortcut for A/B comparison toggle (press 'B')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        setBypassAllFX(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reference Track Handlers
  const handleReferenceTrackUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      console.warn('Invalid file type. Please upload an audio file.');
      return;
    }

    // Revoke previous URL if exists
    if (referenceTrackUrl) {
      URL.revokeObjectURL(referenceTrackUrl);
    }

    const url = URL.createObjectURL(file);
    setReferenceTrackUrl(url);
    setReferenceTrackName(file.name);
    setShowReferenceTrack(true);
  }, [referenceTrackUrl]);

  const setupReferenceAudioGraph = useCallback((audioElement: HTMLAudioElement) => {
    if (!audioContext) return;

    // Create source node if not already created
    if (!referenceSourceRef.current) {
      const source = audioContext.createMediaElementSource(audioElement);
      referenceSourceRef.current = source;

      // Create gain node for volume control
      const gain = audioContext.createGain();
      gain.gain.value = referenceTrackVolume;
      referenceGainRef.current = gain;

      // Create analyser for spectrum comparison
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      setReferenceAnalyser(analyser);

      // Connect: source -> gain -> analyser -> destination
      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioContext.destination);
    }
  }, [audioContext, referenceTrackVolume]);

  // Toggle between main mix and reference track
  const toggleReferenceListening = useCallback(() => {
    if (listeningToReference) {
      // Switch back to main mix
      setListeningToReference(false);
      referenceAudioRef.current?.pause();
      setReferenceTrackPlaying(false);
      // Resume main tracks if they were playing
      if (isPlayingMix) {
        instrumentalRef.current?.play();
        vocalRef.current?.play();
        harmonyRef.current?.play();
      }
    } else {
      // Switch to reference track
      setListeningToReference(true);
      // Pause main tracks
      instrumentalRef.current?.pause();
      vocalRef.current?.pause();
      harmonyRef.current?.pause();
      // Play reference
      if (referenceAudioRef.current && referenceTrackUrl) {
        referenceAudioRef.current.play();
        setReferenceTrackPlaying(true);
      }
    }
  }, [listeningToReference, isPlayingMix, referenceTrackUrl]);

  // Update reference track volume
  useEffect(() => {
    if (referenceGainRef.current) {
      referenceGainRef.current.gain.setTargetAtTime(
        referenceTrackVolume,
        audioContext?.currentTime || 0,
        0.02
      );
    }
  }, [referenceTrackVolume, audioContext]);

  // Cleanup reference track URL on unmount
  useEffect(() => {
    return () => {
      if (referenceTrackUrl) {
        URL.revokeObjectURL(referenceTrackUrl);
      }
    };
  }, [referenceTrackUrl]);

  // --- Audio Graph Setup ---
  
  const setupTrackGraph = useCallback((
    trackType: 'vocal' | 'harmony',
    element: HTMLAudioElement,
    settings: TrackFX,
    volume: number
  ) => {
    if (!audioContext || !element || !graphRefs.current.reverbBuffer) return;
    const ctx = audioContext;
    const refs = graphRefs.current[trackType];

    // 1. Create Source (Only once per element)
    if (!refs.source) {
        refs.source = ctx.createMediaElementSource(element);
    }

    // 2. Create Nodes if they don't exist
    if (!refs.gain) {
        refs.gain = ctx.createGain();

        // Legacy 3-band EQ (kept for compatibility)
        refs.eqLow = ctx.createBiquadFilter();
        refs.eqLow.type = 'lowshelf';
        refs.eqLow.frequency.value = 320;

        refs.eqMid = ctx.createBiquadFilter();
        refs.eqMid.type = 'peaking';
        refs.eqMid.frequency.value = 1000;
        refs.eqMid.Q.value = 1;

        refs.eqHigh = ctx.createBiquadFilter();
        refs.eqHigh.type = 'highshelf';
        refs.eqHigh.frequency.value = 3200;

        // 5-band parametric EQ (for advanced mode)
        refs.parametricEQ = [];
        for (let i = 0; i < 5; i++) {
          const filter = ctx.createBiquadFilter();
          // Default settings matching DEFAULT_EQ_BANDS
          const defaults = [
            { freq: 80, type: 'lowshelf' as BiquadFilterType, q: 0.7 },
            { freq: 250, type: 'peaking' as BiquadFilterType, q: 1.4 },
            { freq: 1000, type: 'peaking' as BiquadFilterType, q: 1.4 },
            { freq: 4000, type: 'peaking' as BiquadFilterType, q: 1.4 },
            { freq: 12000, type: 'highshelf' as BiquadFilterType, q: 0.7 }
          ];
          filter.type = defaults[i].type;
          filter.frequency.value = defaults[i].freq;
          filter.Q.value = defaults[i].q;
          filter.gain.value = 0;
          refs.parametricEQ.push(filter);
        }

        // Effects Chain (Parallel)
        const reverbNode = ctx.createConvolver();
        reverbNode.buffer = graphRefs.current.reverbBuffer!;
        refs.reverbGain = ctx.createGain();

        // Store delay nodes for tempo sync
        refs.delayNode = ctx.createDelay(2); // Max 2 seconds delay
        refs.delayNode.delayTime.value = 0.3; // Default 300ms delay
        refs.delayFeedback = ctx.createGain();
        refs.delayFeedback.gain.value = 0.4;
        refs.delayGain = ctx.createGain();

        // Determine output destination - use master bus if available
        const outputNode = graphRefs.current.master?.masterGain || ctx.destination;

        // Routing with both 3-band and 5-band EQ in series:
        // Source -> 3-band EQ -> 5-band EQ -> Gain -> Master/Destination
        refs.source.connect(refs.eqLow);
        refs.eqLow.connect(refs.eqMid);
        refs.eqMid.connect(refs.eqHigh);

        // Connect 3-band to 5-band chain
        let prevNode: AudioNode = refs.eqHigh;
        for (const filter of refs.parametricEQ) {
          prevNode.connect(filter);
          prevNode = filter;
        }
        prevNode.connect(refs.gain);
        refs.gain.connect(outputNode);

        // Sends:
        // Source -> Reverb -> ReverbGain -> Master/Destination
        refs.source.connect(reverbNode);
        reverbNode.connect(refs.reverbGain);
        refs.reverbGain.connect(outputNode);

        // Source -> Delay -> Feedback -> Delay
        // Source -> Delay -> DelayGain -> Master/Destination
        refs.source.connect(refs.delayNode);
        refs.delayNode.connect(refs.delayFeedback);
        refs.delayFeedback.connect(refs.delayNode);
        refs.delayNode.connect(refs.delayGain);
        refs.delayGain.connect(outputNode);
    }

    // 3. Create Analyser Node if not exists
    if (!refs.analyser) {
      refs.analyser = ctx.createAnalyser();
      refs.analyser.fftSize = 2048;
      refs.analyser.smoothingTimeConstant = 0.8;
      refs.gain.connect(refs.analyser);

      // Update state with analyser reference
      if (trackType === 'vocal') {
        setVocalAnalyser(refs.analyser);
      } else {
        setHarmonyAnalyser(refs.analyser);
      }
    }

    // 4. Update Parameters
    if (refs.gain) refs.gain.gain.value = volume;
    if (refs.eqLow) refs.eqLow.gain.value = settings.eqLow;
    if (refs.eqMid) refs.eqMid.gain.value = settings.eqMid;
    if (refs.eqHigh) refs.eqHigh.gain.value = settings.eqHigh;
    if (refs.reverbGain) refs.reverbGain.gain.value = settings.reverb * 0.8; // Scale down a bit
    if (refs.delayGain) refs.delayGain.gain.value = settings.delay * delayMix;

  }, [audioContext, delayMix]);

  // Setup instrumental track in Web Audio graph (simpler - no EQ/FX, just volume and routing to master)
  const setupInstrumentalGraph = useCallback((element: HTMLAudioElement, volume: number) => {
    if (!audioContext || !element) return;
    const ctx = audioContext;
    const refs = graphRefs.current.instrumental;

    // 1. Create Source (Only once per element)
    if (!refs.source) {
      refs.source = ctx.createMediaElementSource(element);
    }

    // 2. Create Gain Node if it doesn't exist
    if (!refs.gain) {
      refs.gain = ctx.createGain();
      refs.gain.gain.value = volume;

      // Create analyser for instrumental
      refs.analyser = ctx.createAnalyser();
      refs.analyser.fftSize = 2048;
      refs.analyser.smoothingTimeConstant = 0.8;

      // Determine output destination - use master bus if available
      const outputNode = graphRefs.current.master?.masterGain || ctx.destination;

      // Simple chain: Source -> Gain -> Analyser -> Master/Destination
      refs.source.connect(refs.gain);
      refs.gain.connect(refs.analyser);
      refs.analyser.connect(outputNode);
    }

    // Update volume
    if (refs.gain) refs.gain.gain.value = volume;
  }, [audioContext]);

  // Update tempo-synced delay time
  useEffect(() => {
    if (!audioContext) return;
    const delayTime = calculateDelayTime(delayBpm, delayNoteValue);
    const rampTime = 0.05;  // 50ms ramp

    // Update both vocal and harmony delay nodes
    const vocalDelay = graphRefs.current.vocal.delayNode;
    const harmonyDelay = graphRefs.current.harmony.delayNode;
    const vocalFeedback = graphRefs.current.vocal.delayFeedback;
    const harmonyFeedback = graphRefs.current.harmony.delayFeedback;

    if (vocalDelay) {
      vocalDelay.delayTime.setTargetAtTime(delayTime, audioContext.currentTime, rampTime);
    }
    if (harmonyDelay) {
      harmonyDelay.delayTime.setTargetAtTime(delayTime, audioContext.currentTime, rampTime);
    }
    if (vocalFeedback) {
      vocalFeedback.gain.setTargetAtTime(delayFeedback, audioContext.currentTime, rampTime);
    }
    if (harmonyFeedback) {
      harmonyFeedback.gain.setTargetAtTime(delayFeedback, audioContext.currentTime, rampTime);
    }
  }, [audioContext, delayBpm, delayNoteValue, delayFeedback]);

  // Setup Master Bus with Multiband Compressor and Limiter
  const setupMasterBus = useCallback(() => {
    if (!audioContext) return;
    const ctx = audioContext;
    const master = graphRefs.current.master!;

    if (!master.masterGain) {
      // Create master gain node (all tracks connect here)
      master.masterGain = ctx.createGain();
      master.masterGain.gain.value = 1;

      // Create multiband compressor
      master.multibandCompressor = createMultibandCompressor(ctx, multibandSettings);

      // Create limiter
      master.limiter = createLimiter(ctx, limiterCeiling, 0);

      // Create main FFT analyser for spectrum and LUFS
      master.analyser = ctx.createAnalyser();
      master.analyser.fftSize = 4096;
      master.analyser.smoothingTimeConstant = 0.8;
      master.analyser.minDecibels = -90;
      master.analyser.maxDecibels = -10;

      // Create channel splitter for stereo analysis
      master.splitter = ctx.createChannelSplitter(2);

      // Create L/R analysers
      master.analyserL = ctx.createAnalyser();
      master.analyserL.fftSize = 2048;
      master.analyserL.smoothingTimeConstant = 0.8;

      master.analyserR = ctx.createAnalyser();
      master.analyserR.fftSize = 2048;
      master.analyserR.smoothingTimeConstant = 0.8;

      // Connect splitter to L/R analysers
      master.splitter.connect(master.analyserL, 0);
      master.splitter.connect(master.analyserR, 1);

      // Signal chain: masterGain -> multiband -> limiter -> destination
      // Also branch to analysers
      master.masterGain.connect(master.multibandCompressor.inputGain);
      master.multibandCompressor.outputGain.connect(master.limiter.inputGain);
      master.limiter.outputGain.connect(ctx.destination);

      // Connect to analysers (post-limiter)
      master.limiter.outputGain.connect(master.analyser);
      master.limiter.outputGain.connect(master.splitter);

      setMasterAnalyser(master.analyser);
      setMasterAnalyserL(master.analyserL);
      setMasterAnalyserR(master.analyserR);
    }
  }, [audioContext, multibandSettings, limiterCeiling]);

  // Initialize master bus when audio context is ready (always, not just when Pro Metering is shown)
  // This ensures all audio goes through the master bus for consistent processing
  useEffect(() => {
    if (audioContext) {
      setupMasterBus();
    }
  }, [audioContext, setupMasterBus]);

  // Update multiband compressor settings (also respects A/B bypass)
  useEffect(() => {
    const master = graphRefs.current.master;
    if (master?.multibandCompressor && audioContext) {
      // Bypass multiband when either explicitly bypassed OR when A/B bypass is active
      const effectiveBypass = multibandBypass || bypassAllFX;
      updateMultibandCompressor(
        master.multibandCompressor,
        { ...multibandSettings, bypass: effectiveBypass },
        audioContext.currentTime
      );
    }
  }, [multibandSettings, multibandBypass, bypassAllFX, audioContext]);

  // Update limiter settings (also respects A/B bypass)
  useEffect(() => {
    const master = graphRefs.current.master;
    if (master?.limiter && audioContext) {
      const rampTime = 0.02;
      // Enable limiter only when enabled AND A/B bypass is not active
      const effectiveEnabled = limiterEnabled && !bypassAllFX;
      if (effectiveEnabled) {
        // Set threshold at ceiling level
        master.limiter.compressor.threshold.setTargetAtTime(
          limiterCeiling,
          audioContext.currentTime,
          rampTime
        );
      } else {
        // Set threshold very high to effectively bypass
        master.limiter.compressor.threshold.setTargetAtTime(
          0,
          audioContext.currentTime,
          rampTime
        );
      }
    }
  }, [limiterEnabled, limiterCeiling, bypassAllFX, audioContext]);

  // Gain reduction metering animation loop
  useEffect(() => {
    const updateGainReductions = () => {
      const master = graphRefs.current.master;

      // Update multiband gain reductions
      if (master?.multibandCompressor && !multibandBypass) {
        const reductions = getGainReductions(master.multibandCompressor);
        setMultibandGainReductions(reductions);
      }

      // Update limiter gain reduction
      if (master?.limiter && limiterEnabled) {
        setLimiterGainReduction(master.limiter.compressor.reduction);
      }

      gainReductionAnimationRef.current = requestAnimationFrame(updateGainReductions);
    };

    if (showProMetering && (showMultibandCompressor || limiterEnabled)) {
      gainReductionAnimationRef.current = requestAnimationFrame(updateGainReductions);
    }

    return () => {
      if (gainReductionAnimationRef.current) {
        cancelAnimationFrame(gainReductionAnimationRef.current);
      }
    };
  }, [showProMetering, showMultibandCompressor, multibandBypass, limiterEnabled]);

  // Sidechain compression processing
  useEffect(() => {
    if (!audioContext || !sidechainEnabled) {
      // Stop animation and reset when disabled
      if (sidechainAnimationRef.current) {
        cancelAnimationFrame(sidechainAnimationRef.current);
        sidechainAnimationRef.current = 0;
      }
      setSidechainGainReduction(0);
      return;
    }

    // Get source and target nodes
    const sourceTrack = sidechainSource === 'inst' ? 'instrumental' : sidechainSource;
    const targetTrack = sidechainTarget;
    const sourceGain = graphRefs.current[sourceTrack]?.gain;
    const targetGain = graphRefs.current[targetTrack]?.gain;

    if (!sourceGain || !targetGain) {
      return;
    }

    // Create sidechain nodes if needed
    if (!sidechainNodesRef.current) {
      sidechainNodesRef.current = createSidechainCompressor(audioContext, sidechainSettings);
    }

    const scNodes = sidechainNodesRef.current;

    // Connect source to analyser for detection (disconnect first to avoid duplicates)
    try {
      sourceGain.disconnect(scNodes.analyser);
    } catch {
      // Not connected, that's fine
    }
    sourceGain.connect(scNodes.analyser);

    // Sidechain animation loop - applies gain reduction based on source level
    const processSidechain = () => {
      if (!sidechainEnabled) return;

      const { gainMultiplier, reductionDb } = calculateSidechainGainReduction(
        scNodes.analyser,
        sidechainSettings
      );

      // Apply smoothed gain reduction to target with attack/release
      const targetGainValue = sidechainGainRef.current;
      const attackCoeff = 1 - Math.exp(-1 / (audioContext.sampleRate * sidechainSettings.attack));
      const releaseCoeff = 1 - Math.exp(-1 / (audioContext.sampleRate * sidechainSettings.release));

      // Use attack for decreasing gain, release for increasing
      const coeff = gainMultiplier < targetGainValue ? attackCoeff : releaseCoeff;
      const newGain = targetGainValue + (gainMultiplier - targetGainValue) * coeff;
      sidechainGainRef.current = newGain;

      // Apply gain reduction to target track
      const currentTime = audioContext.currentTime;
      const rampTime = 0.01;
      const targetRefs = graphRefs.current[targetTrack];
      if (targetRefs?.gain) {
        // Apply sidechain gain reduction by modifying the existing track volume
        // We need to preserve the original volume setting while applying reduction
        const trackVolume = targetTrack === 'vocal' ? vocalVolume : harmonyVolume;
        const adjustedVolume = trackVolume * newGain;
        targetRefs.gain.gain.setTargetAtTime(adjustedVolume, currentTime, rampTime);
      }

      // Update UI meter
      setSidechainGainReduction(reductionDb);

      sidechainAnimationRef.current = requestAnimationFrame(processSidechain);
    };

    sidechainAnimationRef.current = requestAnimationFrame(processSidechain);

    return () => {
      // Cleanup: stop animation
      if (sidechainAnimationRef.current) {
        cancelAnimationFrame(sidechainAnimationRef.current);
        sidechainAnimationRef.current = 0;
      }

      // Reset target gain to original volume
      const targetRefs = graphRefs.current[targetTrack];
      if (targetRefs?.gain && audioContext) {
        const trackVolume = targetTrack === 'vocal' ? vocalVolume : harmonyVolume;
        targetRefs.gain.gain.setTargetAtTime(trackVolume, audioContext.currentTime, 0.02);
      }
    };
  }, [audioContext, sidechainEnabled, sidechainSource, sidechainTarget, sidechainSettings, vocalVolume, harmonyVolume]);

  // Helper to convert 5-band EQ to 3-band approximation
  const getEffectiveEQSettings = useCallback((
    settings: TrackFX,
    eqBands: EQBand[],
    useAdvanced: boolean
  ): TrackFX => {
    if (!useAdvanced) return settings;

    // Convert 5-band parametric EQ to 3-band approximation
    // Bands: 0=80Hz(low), 1=320Hz(low-mid), 2=1kHz(mid), 3=3.2kHz(mid-high), 4=10kHz(high)
    const enabledBands = eqBands.filter(b => b.enabled);
    const lowBands = enabledBands.filter(b => b.frequency < 500);
    const midBands = enabledBands.filter(b => b.frequency >= 500 && b.frequency < 2000);
    const highBands = enabledBands.filter(b => b.frequency >= 2000);

    const avgGain = (bands: EQBand[]) =>
      bands.length > 0 ? bands.reduce((sum, b) => sum + b.gain, 0) / bands.length : 0;

    return {
      ...settings,
      eqLow: avgGain(lowBands),
      eqMid: avgGain(midBands),
      eqHigh: avgGain(highBands)
    };
  }, []);

  // Update Graph when Settings or Volume Change (respecting A/B bypass)
  useEffect(() => {
      if (vocalRef.current) {
        let effectiveSettings = bypassAllFX ? defaultFX : vocalSettings;
        effectiveSettings = getEffectiveEQSettings(effectiveSettings, vocalEQBands, useAdvancedEQ && !bypassAllFX);
        setupTrackGraph('vocal', vocalRef.current, effectiveSettings, vocalVolume);
      }
  }, [vocalSettings, vocalVolume, setupTrackGraph, vocalAudioUrl, refinedVocalUrl, useRefinedVocal, bypassAllFX, vocalEQBands, useAdvancedEQ, getEffectiveEQSettings]);

  useEffect(() => {
      if (harmonyRef.current) {
        let effectiveSettings = bypassAllFX ? defaultFX : harmonySettings;
        effectiveSettings = getEffectiveEQSettings(effectiveSettings, harmonyEQBands, useAdvancedEQ && !bypassAllFX);
        setupTrackGraph('harmony', harmonyRef.current, effectiveSettings, harmonyVolume);
      }
  }, [harmonySettings, harmonyVolume, setupTrackGraph, harmonyAudioUrl, bypassAllFX, harmonyEQBands, useAdvancedEQ, getEffectiveEQSettings]);

  // Update instrumental volume when it changes
  useEffect(() => {
    const refs = graphRefs.current.instrumental;
    if (refs.gain) {
      refs.gain.gain.value = instVolume;
    }
  }, [instVolume]);

  // Update 5-band parametric EQ filters directly (when advanced mode is active)
  useEffect(() => {
    if (!audioContext) return;
    const rampTime = 0.02;  // 20ms ramp for smooth transitions

    // Helper to update a track's parametric EQ
    const updateParametricEQ = (
      trackRefs: typeof graphRefs.current.vocal,
      eqBands: EQBand[],
      useAdvanced: boolean,
      bypass: boolean
    ) => {
      const filters = trackRefs.parametricEQ;
      if (!filters || filters.length !== 5) return;

      if (bypass) {
        // Bypass all processing
        filters.forEach((filter) => {
          filter.gain.setTargetAtTime(0, audioContext.currentTime, rampTime);
        });
        return;
      }

      if (useAdvanced) {
        // Apply 5-band parametric EQ settings directly
        eqBands.forEach((band, i) => {
          const filter = filters[i];
          // Update filter type (can be changed at runtime)
          if (filter.type !== band.type) {
            filter.type = band.type;
          }
          filter.frequency.setTargetAtTime(band.frequency, audioContext.currentTime, rampTime);
          filter.Q.setTargetAtTime(band.q, audioContext.currentTime, rampTime);
          filter.gain.setTargetAtTime(band.enabled ? band.gain : 0, audioContext.currentTime, rampTime);
        });
        // Zero out the 3-band EQ when using advanced mode
        if (trackRefs.eqLow) trackRefs.eqLow.gain.setTargetAtTime(0, audioContext.currentTime, rampTime);
        if (trackRefs.eqMid) trackRefs.eqMid.gain.setTargetAtTime(0, audioContext.currentTime, rampTime);
        if (trackRefs.eqHigh) trackRefs.eqHigh.gain.setTargetAtTime(0, audioContext.currentTime, rampTime);
      } else {
        // Zero out the 5-band EQ when using simple mode (3-band EQ is active)
        filters.forEach((filter) => {
          filter.gain.setTargetAtTime(0, audioContext.currentTime, rampTime);
        });
      }
    };

    // Update vocal track's parametric EQ
    updateParametricEQ(graphRefs.current.vocal, vocalEQBands, useAdvancedEQ, bypassAllFX);

    // Update harmony track's parametric EQ
    updateParametricEQ(graphRefs.current.harmony, harmonyEQBands, useAdvancedEQ, bypassAllFX);

  }, [audioContext, vocalEQBands, harmonyEQBands, useAdvancedEQ, bypassAllFX]);

  // Helper to handle simple playback toggling
  const toggleMixPlayback = async () => {
      if (audioContext?.state === 'suspended') {
          await audioContext.resume();
      }

      const inst = instrumentalRef.current;
      const voc = vocalRef.current;
      const harm = harmonyRef.current;

      if (isPlayingMix) {
          inst?.pause();
          voc?.pause();
          harm?.pause();
          setIsPlayingMix(false);
      } else {
          // Sync start
          if (inst) inst.currentTime = 0;
          if (voc) voc.currentTime = 0;
          if (harm) harm.currentTime = 0;
          
          inst?.play();
          voc?.play();
          harm?.play();
          setIsPlayingMix(true);
      }
  };

  const handleGenerateVocal = useCallback(async () => {
    if (!lyrics || !audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();
    setIsLoading(true);
    setError('');
    setVocalAudioUrl(null);
    setRefinedVocalUrl(null);
    setHarmonyAudioUrl(null);
    try {
      const base64Audio = await generateSpeech(lyrics, selectedVoice);
      const audioBytes = decode(base64Audio);
      if(!audioBytes) throw new Error("Could not decode audio");
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      const wavBlob = bufferToWave(audioBuffer);
      setVocalAudioUrl(URL.createObjectURL(wavBlob));
    } catch (e) {
      setError('Failed to generate vocal track.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [lyrics, audioContext, selectedVoice]);

  // Handler for regenerating vocals with edited lyrics (keeps instrumental)
  const handleRegenerateWithNewLyrics = useCallback(async () => {
    if (!editedLyrics || !audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();

    setIsLoading(true);
    setError('');

    // Clear vocal tracks but KEEP instrumental unchanged
    setVocalAudioUrl(null);
    setRefinedVocalUrl(null);
    setHarmonyAudioUrl(null);

    try {
      const base64Audio = await generateSpeech(editedLyrics, selectedVoice);
      const audioBytes = decode(base64Audio);
      if (!audioBytes) throw new Error("Could not decode audio");
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      const wavBlob = bufferToWave(audioBuffer);
      setVocalAudioUrl(URL.createObjectURL(wavBlob));
      setIsEditingLyrics(false);
    } catch (e) {
      setError('Failed to regenerate vocal track with new lyrics.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [editedLyrics, audioContext, selectedVoice]);

  // Handler for generating new instrumental (keeps vocals)
  const handleGenerateNewInstrumental = useCallback(async () => {
    if (!instrumentalStyle.trim() || !audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();

    setIsGeneratingInstrumental(true);
    setInstrumentalError('');

    try {
      const base64Audio = await generateInstrumentalTrack(instrumentalStyle);
      const audioBytes = decode(base64Audio);
      if (!audioBytes) throw new Error("Could not decode audio");
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      const wavBlob = bufferToWave(audioBuffer);
      setCurrentInstrumentalUrl(URL.createObjectURL(wavBlob));
      setShowInstrumentalSwapModal(false);
      setInstrumentalStyle('');
    } catch (e) {
      setInstrumentalError('Failed to generate instrumental. Please try again.');
      console.error(e);
    } finally {
      setIsGeneratingInstrumental(false);
    }
  }, [instrumentalStyle, audioContext]);

  const handleRefineVocal = async () => {
      if (!vocalAudioUrl || !audioContext) return;
      if (audioContext.state === 'suspended') await audioContext.resume();
      setIsRefining(true);
      setRefiningError('');
      try {
          const base64Input = await urlToBase64(vocalAudioUrl);
          const prompt = `Act as an audio engineer. Apply pitch correction to this vocal track. Target Key: ${selectedKey}. Correction Strength: ${pitchCorrectionLevel}%. Return ONLY the processed audio.`;
          const processedBase64 = await processAudioTrack(base64Input, prompt);
          const audioBytes = decode(processedBase64);
          const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
          const wavBlob = bufferToWave(audioBuffer);
          setRefinedVocalUrl(URL.createObjectURL(wavBlob));
      } catch (e) {
          console.error(e);
          setRefiningError('Failed to refine vocals.');
      } finally {
          setIsRefining(false);
      }
  };

  const handleGenerateHarmony = async () => {
      const sourceUrl = refinedVocalUrl || vocalAudioUrl;
      if (!sourceUrl || !audioContext) return;
      if (audioContext.state === 'suspended') await audioContext.resume();
      setIsHarmonizing(true);
      setHarmonyError('');
      try {
          const base64Input = await urlToBase64(sourceUrl);
          const prompt = `Generate a ${selectedHarmony} vocal harmony layer for this audio. The output must be an ISOLATED harmony track containing ONLY the harmony voices. Maintain perfect synchronization.`;
          const processedBase64 = await processAudioTrack(base64Input, prompt);
          const audioBytes = decode(processedBase64);
          const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
          const wavBlob = bufferToWave(audioBuffer);
          setHarmonyAudioUrl(URL.createObjectURL(wavBlob));
      } catch (e) {
          console.error(e);
          setHarmonyError('Failed to generate harmony.');
      } finally {
          setIsHarmonizing(false);
      }
  };

  const handleInstrumentalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setCurrentInstrumentalUrl(URL.createObjectURL(file));
  };

  // AI Analysis Handler
  const handleAnalyzeAudio = async () => {
    const audioUrl = currentInstrumentalUrl || vocalAudioUrl;
    if (!audioUrl) return;

    setIsAnalyzingAudio(true);
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();

      // Convert blob to base64 using Promise
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Failed to read audio file'));
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type || 'audio/wav';
      const analysis = await analyzeAudioTrack(base64, mimeType);
      setAudioAnalysis(analysis);
    } catch (error) {
      console.error('Audio analysis failed:', error);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // Apply Mastering Suggestions Handler
  const handleApplyMasteringSuggestions = (suggestions: MasteringSuggestions) => {
    // Apply EQ settings to vocal track
    setVocalSettings(prev => ({
      ...prev,
      eqLow: suggestions.eq.lowShelf.gain,
      eqMid: suggestions.eq.highMid.gain,
      eqHigh: suggestions.eq.highShelf.gain,
      reverb: prev.reverb, // Keep current reverb
      delay: prev.delay // Keep current delay
    }));

    // Apply EQ settings to harmony track
    setHarmonySettings(prev => ({
      ...prev,
      eqLow: suggestions.eq.lowShelf.gain * 0.8,
      eqMid: suggestions.eq.highMid.gain * 0.8,
      eqHigh: suggestions.eq.highShelf.gain * 0.8,
      reverb: prev.reverb,
      delay: prev.delay
    }));

    // Set multiband compressor preset
    const presetMap: Record<string, MultibandCompressorSettings> = {
      'gentle': DEFAULT_MULTIBAND_SETTINGS,
      'punch': { ...DEFAULT_MULTIBAND_SETTINGS, bands: DEFAULT_MULTIBAND_SETTINGS.bands.map(b => ({ ...b, threshold: b.threshold - 4, ratio: b.ratio + 1 })) },
      'broadcast': { ...DEFAULT_MULTIBAND_SETTINGS, bands: DEFAULT_MULTIBAND_SETTINGS.bands.map(b => ({ ...b, threshold: b.threshold - 6, ratio: b.ratio + 2 })) },
      'vocal': { ...DEFAULT_MULTIBAND_SETTINGS, bands: DEFAULT_MULTIBAND_SETTINGS.bands.map((b, i) => i === 2 ? { ...b, threshold: b.threshold - 3, makeupGain: b.makeupGain + 2 } : b) }
    };

    if (presetMap[suggestions.multibandPreset]) {
      setMultibandSettings(presetMap[suggestions.multibandPreset]);
      setMultibandBypass(false);
    }

    // Set LUFS target
    if (suggestions.targetLufs === -14) setLufsPreset('spotify');
    else if (suggestions.targetLufs === -13) setLufsPreset('youtube');
    else if (suggestions.targetLufs === -16) setLufsPreset('apple');
    else if (suggestions.targetLufs <= -20) setLufsPreset('broadcast');
  };

  // Load audio buffers for export when URLs change
  useEffect(() => {
    const loadBuffer = async (url: string | null | undefined, ref: React.MutableRefObject<AudioBuffer | null>) => {
      if (!url || !audioContext) {
        ref.current = null;
        return;
      }
      try {
        const buffer = await fetchAudioBuffer(url, audioContext);
        ref.current = buffer;
      } catch (e) {
        console.error('Failed to load audio buffer:', e);
        ref.current = null;
      }
    };

    loadBuffer(currentInstrumentalUrl, instrumentalBufferRef);
  }, [currentInstrumentalUrl, audioContext]);

  useEffect(() => {
    const loadBuffer = async (url: string | null | undefined, ref: React.MutableRefObject<AudioBuffer | null>) => {
      if (!url || !audioContext) {
        ref.current = null;
        return;
      }
      try {
        const buffer = await fetchAudioBuffer(url, audioContext);
        ref.current = buffer;
      } catch (e) {
        console.error('Failed to load audio buffer:', e);
        ref.current = null;
      }
    };

    const vocalUrl = useRefinedVocal && refinedVocalUrl ? refinedVocalUrl : vocalAudioUrl;
    loadBuffer(vocalUrl, vocalBufferRef);
  }, [vocalAudioUrl, refinedVocalUrl, useRefinedVocal, audioContext]);

  useEffect(() => {
    const loadBuffer = async (url: string | null | undefined, ref: React.MutableRefObject<AudioBuffer | null>) => {
      if (!url || !audioContext) {
        ref.current = null;
        return;
      }
      try {
        const buffer = await fetchAudioBuffer(url, audioContext);
        ref.current = buffer;
      } catch (e) {
        console.error('Failed to load audio buffer:', e);
        ref.current = null;
      }
    };

    loadBuffer(harmonyAudioUrl, harmonyBufferRef);
  }, [harmonyAudioUrl, audioContext]);

  // Export Mix Handler
  const handleExportMix = async () => {
    if (!audioContext) return;

    setIsExporting(true);
    setExportProgress(0);
    setShowExportModal(false);

    try {
      const tracks: TrackConfig[] = [];

      // Add instrumental track (no FX applied to instrumental)
      if (exportOptions.includeInstrumental && instrumentalBufferRef.current) {
        tracks.push({
          buffer: instrumentalBufferRef.current,
          volume: instVolume,
          eqLow: 0,
          eqMid: 0,
          eqHigh: 0,
          reverb: 0,
          delay: 0
        });
      }

      // Add vocal track with FX (respecting advanced EQ mode)
      if (exportOptions.includeVocal && vocalBufferRef.current) {
        const effectiveVocalFX = bypassAllFX
          ? defaultFX
          : getEffectiveEQSettings(vocalSettings, vocalEQBands, useAdvancedEQ);
        tracks.push({
          buffer: vocalBufferRef.current,
          volume: vocalVolume,
          eqLow: effectiveVocalFX.eqLow,
          eqMid: effectiveVocalFX.eqMid,
          eqHigh: effectiveVocalFX.eqHigh,
          reverb: effectiveVocalFX.reverb,
          delay: effectiveVocalFX.delay
        });
      }

      // Add harmony track with FX (respecting advanced EQ mode)
      if (exportOptions.includeHarmony && harmonyBufferRef.current) {
        const effectiveHarmonyFX = bypassAllFX
          ? defaultFX
          : getEffectiveEQSettings(harmonySettings, harmonyEQBands, useAdvancedEQ);
        tracks.push({
          buffer: harmonyBufferRef.current,
          volume: harmonyVolume,
          eqLow: effectiveHarmonyFX.eqLow,
          eqMid: effectiveHarmonyFX.eqMid,
          eqHigh: effectiveHarmonyFX.eqHigh,
          reverb: effectiveHarmonyFX.reverb,
          delay: effectiveHarmonyFX.delay
        });
      }

      if (tracks.length === 0) {
        throw new Error('No tracks selected for export');
      }

      const renderedBuffer = await renderMixOffline(tracks, 44100, (progress) => {
        setExportProgress(progress * 0.9); // Reserve 10% for encoding
      });

      const formatConfig = AUDIO_FORMATS[exportFormat];
      const blob = await bufferToBlob(renderedBuffer, exportFormat);
      downloadBlob(blob, `muse-ai-mix.${formatConfig.extension}`);

      setExportProgress(100);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Stems Handler
  const handleExportStems = async () => {
    if (!audioContext) return;

    setIsExporting(true);
    setExportProgress(0);
    setShowExportModal(false);

    try {
      const stems: { name: string; buffer: AudioBuffer; settings: TrackFX; volume: number }[] = [];

      if (exportOptions.includeInstrumental && instrumentalBufferRef.current) {
        stems.push({
          name: 'instrumental',
          buffer: instrumentalBufferRef.current,
          settings: defaultFX,
          volume: instVolume
        });
      }

      if (exportOptions.includeVocal && vocalBufferRef.current) {
        const effectiveVocalFX = getEffectiveEQSettings(vocalSettings, vocalEQBands, useAdvancedEQ);
        stems.push({
          name: 'vocal',
          buffer: vocalBufferRef.current,
          settings: effectiveVocalFX,
          volume: vocalVolume
        });
      }

      if (exportOptions.includeHarmony && harmonyBufferRef.current) {
        const effectiveHarmonyFX = getEffectiveEQSettings(harmonySettings, harmonyEQBands, useAdvancedEQ);
        stems.push({
          name: 'harmony',
          buffer: harmonyBufferRef.current,
          settings: effectiveHarmonyFX,
          volume: harmonyVolume
        });
      }

      const formatConfig = AUDIO_FORMATS[exportFormat];

      for (let i = 0; i < stems.length; i++) {
        const { name, buffer, settings, volume } = stems[i];
        const trackConfig: TrackConfig = {
          buffer,
          volume: exportOptions.applyFXToStems ? volume : 1.0,
          eqLow: exportOptions.applyFXToStems ? settings.eqLow : 0,
          eqMid: exportOptions.applyFXToStems ? settings.eqMid : 0,
          eqHigh: exportOptions.applyFXToStems ? settings.eqHigh : 0,
          reverb: exportOptions.applyFXToStems ? settings.reverb : 0,
          delay: exportOptions.applyFXToStems ? settings.delay : 0
        };

        const renderedBuffer = await renderStemOffline(trackConfig, exportOptions.applyFXToStems, 44100);
        const blob = await bufferToBlob(renderedBuffer, exportFormat);
        downloadBlob(blob, `muse-ai-${name}.${formatConfig.extension}`);

        setExportProgress(((i + 1) / stems.length) * 100);
      }
    } catch (e) {
      console.error('Stem export failed:', e);
      alert('Stem export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Preset Handlers
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  const loadPreset = (presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (preset) {
      setVocalSettings(preset.vocalFX);
      setHarmonySettings(preset.harmonyFX);
      setInstVolume(preset.volumes.inst);
      setVocalVolume(preset.volumes.vocal);
      setHarmonyVolume(preset.volumes.harmony);
      setCurrentPresetId(presetId);
    }
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: FXPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      vocalFX: { ...vocalSettings },
      harmonyFX: { ...harmonySettings },
      volumes: { inst: instVolume, vocal: vocalVolume, harmony: harmonyVolume },
      isBuiltIn: false
    };

    const updatedPresets = [...customPresets, newPreset];
    setCustomPresets(updatedPresets);
    localStorage.setItem('museAiFxPresets', JSON.stringify(updatedPresets));
    setCurrentPresetId(newPreset.id);
    setNewPresetName('');
    setShowSavePresetModal(false);
  };

  const deletePreset = (presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset || preset.isBuiltIn) return;

    const updatedPresets = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updatedPresets);
    localStorage.setItem('museAiFxPresets', JSON.stringify(updatedPresets));

    if (currentPresetId === presetId) {
      setCurrentPresetId('flat');
      loadPreset('flat');
    }
  };

  const updateExistingPreset = (presetId: string) => {
    const preset = customPresets.find(p => p.id === presetId);
    if (!preset || preset.isBuiltIn) return;

    const updatedPreset: FXPreset = {
      ...preset,
      vocalFX: { ...vocalSettings },
      harmonyFX: { ...harmonySettings },
      volumes: { inst: instVolume, vocal: vocalVolume, harmony: harmonyVolume }
    };

    const updatedPresets = customPresets.map(p => p.id === presetId ? updatedPreset : p);
    setCustomPresets(updatedPresets);
    localStorage.setItem('museAiFxPresets', JSON.stringify(updatedPresets));
    setCurrentPresetId(presetId);
  };

  const duplicatePreset = (presetId: string) => {
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return;

    const duplicatedPreset: FXPreset = {
      id: `custom-${Date.now()}`,
      name: `${preset.name} (Copy)`,
      vocalFX: { ...preset.vocalFX },
      harmonyFX: { ...preset.harmonyFX },
      volumes: { ...preset.volumes },
      isBuiltIn: false
    };

    const updatedPresets = [...customPresets, duplicatedPreset];
    setCustomPresets(updatedPresets);
    localStorage.setItem('museAiFxPresets', JSON.stringify(updatedPresets));
    setCurrentPresetId(duplicatedPreset.id);
  };

  const renamePreset = (presetId: string, newName: string) => {
    if (!newName.trim()) return;
    const preset = customPresets.find(p => p.id === presetId);
    if (!preset || preset.isBuiltIn) return;

    const updatedPresets = customPresets.map(p =>
      p.id === presetId ? { ...p, name: newName.trim() } : p
    );
    setCustomPresets(updatedPresets);
    localStorage.setItem('museAiFxPresets', JSON.stringify(updatedPresets));
    setPresetToRename(null);
    setRenameValue('');
  };

  const exportPresets = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      presets: customPresets
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muse-ai-presets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.presets || !Array.isArray(data.presets)) {
          alert('Invalid preset file format');
          return;
        }

        // Validate and import presets
        const importedPresets: FXPreset[] = data.presets
          .filter((p: FXPreset) => p.id && p.name && p.vocalFX && p.harmonyFX && p.volumes)
          .map((p: FXPreset) => ({
            ...p,
            id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            isBuiltIn: false
          }));

        if (importedPresets.length === 0) {
          alert('No valid presets found in file');
          return;
        }

        const mergedPresets = [...customPresets, ...importedPresets];
        setCustomPresets(mergedPresets);
        localStorage.setItem('museAiFxPresets', JSON.stringify(mergedPresets));
        alert(`Successfully imported ${importedPresets.length} preset(s)`);
      } catch {
        alert('Failed to parse preset file. Make sure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (presetImportRef.current) {
      presetImportRef.current.value = '';
    }
  };

  // Undo/Redo Helper Functions
  const getCurrentSnapshot = useCallback((): MixerStateSnapshot => ({
    instVolume,
    vocalVolume,
    harmonyVolume,
    vocalSettings: { ...vocalSettings },
    harmonySettings: { ...harmonySettings },
    vocalEQBands: vocalEQBands.map(b => ({ ...b })),
    harmonyEQBands: harmonyEQBands.map(b => ({ ...b })),
    delayBpm,
    delayNoteValue,
    delayFeedback,
    delayMix,
    limiterEnabled,
    limiterCeiling,
    multibandSettings: {
      ...multibandSettings,
      bands: multibandSettings.bands.map(b => ({ ...b }))
    },
    multibandBypass
  }), [instVolume, vocalVolume, harmonyVolume, vocalSettings, harmonySettings, vocalEQBands, harmonyEQBands, delayBpm, delayNoteValue, delayFeedback, delayMix, limiterEnabled, limiterCeiling, multibandSettings, multibandBypass]);

  const restoreSnapshot = useCallback((snapshot: MixerStateSnapshot) => {
    isUndoRedoAction.current = true;
    // Update ref to prevent duplicate detection from re-recording this state
    lastSnapshotRef.current = JSON.stringify(snapshot);
    setInstVolume(snapshot.instVolume);
    setVocalVolume(snapshot.vocalVolume);
    setHarmonyVolume(snapshot.harmonyVolume);
    setVocalSettings(snapshot.vocalSettings);
    setHarmonySettings(snapshot.harmonySettings);
    setVocalEQBands(snapshot.vocalEQBands);
    setHarmonyEQBands(snapshot.harmonyEQBands);
    setDelayBpm(snapshot.delayBpm);
    setDelayNoteValue(snapshot.delayNoteValue);
    setDelayFeedback(snapshot.delayFeedback);
    setDelayMix(snapshot.delayMix);
    setLimiterEnabled(snapshot.limiterEnabled);
    setLimiterCeiling(snapshot.limiterCeiling);
    setMultibandSettings(snapshot.multibandSettings);
    setMultibandBypass(snapshot.multibandBypass);
    setTimeout(() => { isUndoRedoAction.current = false; }, 50);
  }, []);

  const undo = useCallback(() => {
    if (historyPast.length === 0) return;
    const newPast = [...historyPast];
    const previous = newPast.pop()!;
    setHistoryPast(newPast);
    setHistoryFuture([getCurrentSnapshot(), ...historyFuture]);
    restoreSnapshot(previous);
  }, [historyPast, historyFuture, getCurrentSnapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const newFuture = [...historyFuture];
    const next = newFuture.shift()!;
    setHistoryFuture(newFuture);
    setHistoryPast([...historyPast, getCurrentSnapshot()]);
    restoreSnapshot(next);
  }, [historyPast, historyFuture, getCurrentSnapshot, restoreSnapshot]);

  // Track mixer state changes for undo/redo
  useEffect(() => {
    if (isUndoRedoAction.current) return;

    // Debounce: only record if at least 500ms since last snapshot
    const now = Date.now();
    if (now - lastSnapshotTime.current < 500) return;

    const snapshot = getCurrentSnapshot();
    const snapshotStr = JSON.stringify(snapshot);

    // Don't record if same as last snapshot (use ref to avoid stale closure)
    if (snapshotStr === lastSnapshotRef.current) return;

    lastSnapshotTime.current = now;
    lastSnapshotRef.current = snapshotStr;

    setHistoryPast(prev => {
      const newPast = [...prev, snapshot];
      // Limit history to 50 entries
      return newPast.slice(-50);
    });
    setHistoryFuture([]);
  }, [instVolume, vocalVolume, harmonyVolume, vocalSettings, harmonySettings, vocalEQBands, harmonyEQBands, delayBpm, delayNoteValue, delayFeedback, delayMix, limiterEnabled, limiterCeiling, multibandSettings, multibandBypass, getCurrentSnapshot]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Mark preset as modified when settings change
  useEffect(() => {
    if (currentPresetId) {
      const presets = [...BUILT_IN_PRESETS, ...customPresets];
      const preset = presets.find(p => p.id === currentPresetId);
      if (preset) {
        const settingsMatch =
          JSON.stringify(vocalSettings) === JSON.stringify(preset.vocalFX) &&
          JSON.stringify(harmonySettings) === JSON.stringify(preset.harmonyFX) &&
          instVolume === preset.volumes.inst &&
          vocalVolume === preset.volumes.vocal &&
          harmonyVolume === preset.volumes.harmony;

        if (!settingsMatch) {
          setCurrentPresetId(null); // Mark as modified/custom
        }
      }
    }
  }, [vocalSettings, harmonySettings, instVolume, vocalVolume, harmonyVolume, currentPresetId, customPresets]);

  // Automation Helpers
  const AUTOMATABLE_PARAMS: { id: AutomatableParameter; label: string; min: number; max: number; color: string }[] = [
    { id: 'inst-volume', label: 'Instrumental Volume', min: 0, max: 1, color: '#6366f1' },
    { id: 'vocal-volume', label: 'Vocal Volume', min: 0, max: 1, color: '#ec4899' },
    { id: 'harmony-volume', label: 'Harmony Volume', min: 0, max: 1, color: '#8b5cf6' },
    { id: 'vocal-reverb', label: 'Vocal Reverb', min: 0, max: 1, color: '#14b8a6' },
    { id: 'harmony-reverb', label: 'Harmony Reverb', min: 0, max: 1, color: '#f59e0b' },
    { id: 'vocal-delay', label: 'Vocal Delay', min: 0, max: 1, color: '#10b981' },
    { id: 'harmony-delay', label: 'Harmony Delay', min: 0, max: 1, color: '#ef4444' },
  ];

  const addAutomationLane = useCallback((parameter: AutomatableParameter) => {
    const paramConfig = AUTOMATABLE_PARAMS.find(p => p.id === parameter);
    if (!paramConfig) return;

    // Check if lane already exists
    if (automationLanes.some(l => l.parameter === parameter)) return;

    const newLane: AutomationLaneData = {
      id: Math.random().toString(36).substring(2, 9),
      parameter,
      points: [],
      enabled: true,
      minValue: paramConfig.min,
      maxValue: paramConfig.max
    };

    setAutomationLanes(prev => [...prev, newLane]);
  }, [automationLanes]);

  const updateAutomationLane = useCallback((updatedLane: AutomationLaneData) => {
    setAutomationLanes(prev =>
      prev.map(lane => lane.id === updatedLane.id ? updatedLane : lane)
    );
  }, []);

  const deleteAutomationLane = useCallback((laneId: string) => {
    setAutomationLanes(prev => prev.filter(lane => lane.id !== laneId));
  }, []);

  // Update track duration when audio loads
  useEffect(() => {
    const updateDuration = () => {
      const inst = instrumentalRef.current;
      if (inst && inst.duration && isFinite(inst.duration)) {
        setTrackDuration(inst.duration);
      }
    };

    const inst = instrumentalRef.current;
    if (inst) {
      inst.addEventListener('loadedmetadata', updateDuration);
      if (inst.duration && isFinite(inst.duration)) {
        setTrackDuration(inst.duration);
      }
    }

    return () => {
      if (inst) inst.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [currentInstrumentalUrl]);

  // Sync playback time for automation
  useEffect(() => {
    if (!isPlayingMix) {
      cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const updateTime = () => {
      const inst = instrumentalRef.current;
      if (inst) {
        setCurrentPlaybackTime(inst.currentTime);
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlayingMix]);

  // Apply automation values during playback
  useEffect(() => {
    if (!automationEnabled || !isPlayingMix || automationLanes.length === 0) return;

    automationLanes.forEach(lane => {
      if (!lane.enabled || lane.points.length === 0) return;

      const normalizedValue = getValueAtTime(lane, currentPlaybackTime);
      const value = denormalizeValue(normalizedValue, lane.minValue, lane.maxValue);

      switch (lane.parameter) {
        case 'inst-volume':
          if (Math.abs(instVolume - value) > 0.01) setInstVolume(value);
          break;
        case 'vocal-volume':
          if (Math.abs(vocalVolume - value) > 0.01) setVocalVolume(value);
          break;
        case 'harmony-volume':
          if (Math.abs(harmonyVolume - value) > 0.01) setHarmonyVolume(value);
          break;
        case 'vocal-reverb':
          if (Math.abs(vocalSettings.reverb - value) > 0.01) {
            setVocalSettings(prev => ({ ...prev, reverb: value }));
          }
          break;
        case 'harmony-reverb':
          if (Math.abs(harmonySettings.reverb - value) > 0.01) {
            setHarmonySettings(prev => ({ ...prev, reverb: value }));
          }
          break;
        case 'vocal-delay':
          if (Math.abs(vocalSettings.delay - value) > 0.01) {
            setVocalSettings(prev => ({ ...prev, delay: value }));
          }
          break;
        case 'harmony-delay':
          if (Math.abs(harmonySettings.delay - value) > 0.01) {
            setHarmonySettings(prev => ({ ...prev, delay: value }));
          }
          break;
      }
    });
  }, [currentPlaybackTime, automationEnabled, automationLanes, isPlayingMix, instVolume, vocalVolume, harmonyVolume, vocalSettings, harmonySettings]);

  // FX Controls Component
  const FXControls = ({
    settings,
    setSettings,
    eqBands,
    setEQBands,
    trackName
  }: {
    settings: TrackFX,
    setSettings: (s: TrackFX) => void,
    eqBands: EQBand[],
    setEQBands: (bands: EQBand[]) => void,
    trackName: string
  }) => (
      <div className="bg-gray-800 p-4 rounded-md mt-2 space-y-4 border border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* EQ Mode Toggle */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Equalizer</span>
            <button
              onClick={() => setUseAdvancedEQ(!useAdvancedEQ)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                useAdvancedEQ
                  ? 'bg-purple-600/30 text-purple-400 border border-purple-500/50'
                  : 'bg-gray-700 text-gray-400 border border-gray-600'
              }`}
            >
              {useAdvancedEQ ? 'Advanced (5-band)' : 'Simple (3-band)'}
            </button>
          </div>

          {useAdvancedEQ ? (
            <ParametricEQ
              bands={eqBands}
              onChange={setEQBands}
              height={140}
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Low (EQ)</label>
                    <input type="range" min="-10" max="10" value={settings.eqLow} onChange={(e) => setSettings({...settings, eqLow: Number(e.target.value)})} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    <div className="text-center text-xs text-gray-500">{settings.eqLow}dB</div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Mid (EQ)</label>
                    <input type="range" min="-10" max="10" value={settings.eqMid} onChange={(e) => setSettings({...settings, eqMid: Number(e.target.value)})} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    <div className="text-center text-xs text-gray-500">{settings.eqMid}dB</div>
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">High (EQ)</label>
                    <input type="range" min="-10" max="10" value={settings.eqHigh} onChange={(e) => setSettings({...settings, eqHigh: Number(e.target.value)})} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    <div className="text-center text-xs text-gray-500">{settings.eqHigh}dB</div>
                </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-t border-gray-700 pt-3">
              <div>
                   <label className="text-xs text-indigo-300 block mb-1 font-bold">Reverb Mix</label>
                   <input type="range" min="0" max="1" step="0.05" value={settings.reverb} onChange={(e) => setSettings({...settings, reverb: Number(e.target.value)})} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                   <div className="text-center text-xs text-gray-500">{(settings.reverb * 100).toFixed(0)}%</div>
              </div>
              <div>
                   <label className="text-xs text-indigo-300 block mb-1 font-bold">Delay Mix</label>
                   <input type="range" min="0" max="1" step="0.05" value={settings.delay} onChange={(e) => setSettings({...settings, delay: Number(e.target.value)})} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                   <div className="text-center text-xs text-gray-500">{(settings.delay * 100).toFixed(0)}%</div>
              </div>
          </div>
      </div>
  );

  return (
    <Page title="Audio Production" description="Bring your lyrics to life by generating vocal tracks and polishing your final mix with AI mastering.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Lyrics</h3>
              {editedLyrics && (
                <button
                  onClick={() => {
                    if (isEditingLyrics) {
                      setEditedLyrics(lyrics);
                    }
                    setIsEditingLyrics(!isEditingLyrics);
                  }}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    isEditingLyrics
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                      : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600/30'
                  }`}
                >
                  {isEditingLyrics ? 'Cancel' : 'Edit Lyrics'}
                </button>
              )}
            </div>

            {isEditingLyrics ? (
              <div className="space-y-3">
                <textarea
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  className="w-full h-80 bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your lyrics..."
                />
                <div className="space-y-2">
                  <Button
                    onClick={handleRegenerateWithNewLyrics}
                    isLoading={isLoading}
                    disabled={!editedLyrics.trim() || editedLyrics === lyrics}
                    className="w-full"
                  >
                    Save & Regenerate Vocals
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Instrumental will be preserved. Only vocals will be regenerated.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 whitespace-pre-wrap h-96 overflow-y-auto">
                {editedLyrics || "No lyrics generated yet. Go to the 'Create' tab first."}
              </p>
            )}
          </Card>
        </div>
        <div className="md:col-span-2 space-y-8">
            
          {/* New Studio Mixer Card */}
          {vocalAudioUrl ? (
              <Card className="border-indigo-500/50">
                  <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-indigo-300">Studio Mixer</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowInstrumentalSwapModal(true)}
                            className="text-xs px-3 py-1 rounded-full transition-colors bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600/30"
                          >
                            Swap Instrumental
                          </button>
                          <button
                            onClick={() => setShowMeters(!showMeters)}
                            className={`text-xs px-3 py-1 rounded-full transition-colors ${
                              showMeters
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'bg-gray-700 text-gray-400 border border-gray-600'
                            }`}
                          >
                            {showMeters ? 'Meters ON' : 'Meters OFF'}
                          </button>
                        </div>
                      </div>

                      {/* Preset Selector */}
                      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-800/50 rounded-lg">
                        <label className="text-xs text-gray-400 font-medium">Preset:</label>
                        <select
                          value={currentPresetId || ''}
                          onChange={(e) => e.target.value && loadPreset(e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-600 rounded-md text-sm py-1.5 px-2 text-gray-200"
                        >
                          {!currentPresetId && <option value="">Custom Settings</option>}
                          <optgroup label="Built-in Presets">
                            {BUILT_IN_PRESETS.map(preset => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </optgroup>
                          {customPresets.length > 0 && (
                            <optgroup label="Custom Presets">
                              {customPresets.map(preset => (
                                <option key={preset.id} value={preset.id}>{preset.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <button
                          onClick={() => setShowSavePresetModal(true)}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                          title="Save current settings as preset"
                        >
                          Save
                        </button>
                        {currentPresetId && !allPresets.find(p => p.id === currentPresetId)?.isBuiltIn && (
                          <button
                            onClick={() => updateExistingPreset(currentPresetId)}
                            className="px-3 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-md transition-colors border border-green-600/50"
                            title="Update current preset with current settings"
                          >
                            Update
                          </button>
                        )}
                        <button
                          onClick={() => setShowPresetManager(true)}
                          className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
                          title="Manage presets"
                        >
                          Manage
                        </button>
                        <div className="border-l border-gray-600 h-6 mx-1" />
                        <button
                          onClick={undo}
                          disabled={historyPast.length === 0}
                          className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Undo (Ctrl+Z)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                        <button
                          onClick={redo}
                          disabled={historyFuture.length === 0}
                          className="px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Redo (Ctrl+Y)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                          </svg>
                        </button>
                        {(historyPast.length > 0 || historyFuture.length > 0) && (
                          <span className="text-xs text-gray-500 ml-1">
                            {historyPast.length}/{historyPast.length + historyFuture.length}
                          </span>
                        )}
                      </div>
                  
                  {!currentInstrumentalUrl && (
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-dashed border-gray-600 mb-4 text-center">
                          <p className="text-gray-400 text-sm mb-2">No instrumental track found. Upload one to start mixing.</p>
                          <input type="file" accept="audio/*" onChange={handleInstrumentalUpload} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-indigo-600 file:text-white file:border-none hover:file:bg-indigo-700 cursor-pointer" />
                      </div>
                  )}

                  <div className="flex flex-col gap-4">
                      {/* Instrumental Track */}
                      <div className="bg-gray-900/50 p-3 rounded-lg">
                           <div className="flex items-center gap-4">
                                <div className="w-24 text-sm font-bold text-gray-400">Instrumental</div>
                                {currentInstrumentalUrl ? (
                                    <input type="range" min="0" max="1" step="0.05" value={instVolume} onChange={(e) => setInstVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                                ) : <div className="flex-1 text-xs text-gray-500 italic">No track loaded</div>}
                           </div>
                      </div>
                      
                      {/* Lead Vocal Track */}
                      <div className="bg-gray-900/50 p-3 rounded-lg">
                           <div className="flex items-center gap-4">
                               <div className="w-24 text-sm font-bold text-gray-400">Lead Vocal</div>
                               <input type="range" min="0" max="1" step="0.05" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="flex-1 accent-pink-500" />
                               {showMeters && (
                                 <VuMeter
                                   analyser={vocalAnalyser}
                                   orientation="horizontal"
                                   width={80}
                                   height={16}
                                   showDb={false}
                                 />
                               )}
                               <button onClick={() => setShowVocalFX(!showVocalFX)} className={`text-xs px-2 py-1 rounded border ${showVocalFX ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-600 text-gray-400'}`}>FX</button>
                           </div>
                           
                           {refinedVocalUrl && (
                               <div className="flex items-center gap-2 ml-28 mt-2">
                                   <label className="inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={useRefinedVocal} onChange={(e) => setUseRefinedVocal(e.target.checked)} className="sr-only peer" />
                                        <div className="relative w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        <span className="ms-3 text-xs font-medium text-gray-300">{useRefinedVocal ? 'Using Refined' : 'Using Original'}</span>
                                    </label>
                               </div>
                           )}

                           {showVocalFX && <FXControls settings={vocalSettings} setSettings={setVocalSettings} eqBands={vocalEQBands} setEQBands={setVocalEQBands} trackName="Vocal" />}
                      </div>

                      {/* Harmony Track */}
                       <div className="bg-gray-900/50 p-3 rounded-lg">
                           <div className="flex items-center gap-4">
                               <div className="w-24 text-sm font-bold text-gray-400">Harmony</div>
                               {harmonyAudioUrl ? (
                                   <>
                                    <input type="range" min="0" max="1" step="0.05" value={harmonyVolume} onChange={(e) => setHarmonyVolume(parseFloat(e.target.value))} className="flex-1 accent-purple-500" />
                                    {showMeters && (
                                      <VuMeter
                                        analyser={harmonyAnalyser}
                                        orientation="horizontal"
                                        width={80}
                                        height={16}
                                        showDb={false}
                                      />
                                    )}
                                    <button onClick={() => setShowHarmonyFX(!showHarmonyFX)} className={`text-xs px-2 py-1 rounded border ${showHarmonyFX ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-600 text-gray-400'}`}>FX</button>
                                   </>
                               ) : <div className="flex-1 text-xs text-gray-500 italic">No harmony generated</div>}
                           </div>
                           {harmonyAudioUrl && showHarmonyFX && <FXControls settings={harmonySettings} setSettings={setHarmonySettings} eqBands={harmonyEQBands} setEQBands={setHarmonyEQBands} trackName="Harmony" />}
                      </div>
                      
                      {/* Hidden Audio Elements for Mixing */}
                      {/* Note: crossorigin="anonymous" is needed if instrumentalUrl is external to use Web Audio API, but triggers CORS issues if not configured on server. We assume local blobs or CORS-safe headers. */}
                      {currentInstrumentalUrl && <audio ref={instrumentalRef} src={currentInstrumentalUrl} crossOrigin="anonymous" preload="auto" onEnded={() => setIsPlayingMix(false)} onPlay={() => { if(audioContext?.state === 'suspended') audioContext.resume(); }} onLoadedMetadata={(e) => setupInstrumentalGraph(e.currentTarget, instVolume)} />}
                      <audio ref={vocalRef} src={useRefinedVocal && refinedVocalUrl ? refinedVocalUrl : vocalAudioUrl} crossOrigin="anonymous" preload="auto" />
                      {harmonyAudioUrl && <audio ref={harmonyRef} src={harmonyAudioUrl} crossOrigin="anonymous" preload="auto" />}

                      <div className="flex gap-2 mt-2">
                        <Button onClick={toggleMixPlayback} className="flex-1" disabled={!currentInstrumentalUrl && !vocalAudioUrl}>
                          {isPlayingMix ? 'Pause Mix' : 'Play Full Mix'}
                        </Button>
                        <Button
                          onClick={() => setShowExportModal(true)}
                          variant="secondary"
                          className="flex-1"
                          disabled={!vocalAudioUrl && !currentInstrumentalUrl}
                        >
                          Export
                        </Button>
                      </div>

                      {/* A/B Comparison Toggle */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <button
                          onClick={() => setBypassAllFX(!bypassAllFX)}
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            bypassAllFX
                              ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                          title="Press 'B' to toggle"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          {bypassAllFX ? 'A (Original - FX Bypassed)' : 'B (Processed - FX Active)'}
                          <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-gray-700 rounded">B</kbd>
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">Compare original vs. processed sound</p>
                      </div>

                      {/* Pro Metering Section */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <button
                          onClick={() => setShowProMetering(!showProMetering)}
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            showProMetering
                              ? 'bg-indigo-500/20 border border-indigo-500 text-indigo-300'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          {showProMetering ? 'Hide Pro Metering' : 'Show Pro Metering'}
                        </button>
                      </div>

                      {/* Automation Section */}
                      <div className="mt-3">
                        <button
                          onClick={() => setShowAutomation(!showAutomation)}
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            showAutomation
                              ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                          </svg>
                          {showAutomation ? 'Hide Automation' : 'Show Automation'}
                          {automationLanes.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-600 text-white rounded-full">
                              {automationLanes.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Automation Panel */}
                      {showAutomation && (
                        <div className="mt-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Parameter Automation</h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setAutomationEnabled(!automationEnabled)}
                                className={`px-2 py-1 text-xs rounded ${
                                  automationEnabled ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'
                                }`}
                              >
                                {automationEnabled ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          </div>

                          {/* Add Lane Dropdown */}
                          <div className="flex items-center gap-2">
                            <select
                              className="flex-1 bg-gray-800 border border-gray-600 rounded-md py-1.5 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              onChange={(e) => {
                                if (e.target.value) {
                                  addAutomationLane(e.target.value as AutomatableParameter);
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>Add automation lane...</option>
                              {AUTOMATABLE_PARAMS
                                .filter(p => !automationLanes.some(l => l.parameter === p.id))
                                .map(param => (
                                  <option key={param.id} value={param.id}>{param.label}</option>
                                ))
                              }
                            </select>
                          </div>

                          {/* Automation Lanes */}
                          <div className="space-y-3">
                            {automationLanes.length === 0 ? (
                              <div className="text-center py-6 text-gray-500 text-sm">
                                <p>No automation lanes added yet.</p>
                                <p className="text-xs mt-1">Select a parameter above to add an automation lane.</p>
                              </div>
                            ) : (
                              automationLanes.map(lane => {
                                const paramConfig = AUTOMATABLE_PARAMS.find(p => p.id === lane.parameter);
                                return (
                                  <AutomationLane
                                    key={lane.id}
                                    lane={lane}
                                    duration={trackDuration}
                                    currentTime={currentPlaybackTime}
                                    onUpdate={updateAutomationLane}
                                    onDelete={() => deleteAutomationLane(lane.id)}
                                    parameterLabel={paramConfig?.label || lane.parameter}
                                    color={paramConfig?.color}
                                  />
                                );
                              })
                            )}
                          </div>

                          {/* Playback Info */}
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
                            <span>Time: {currentPlaybackTime.toFixed(1)}s / {trackDuration.toFixed(1)}s</span>
                            <span>{isPlayingMix ? 'Playing' : 'Stopped'}</span>
                          </div>
                        </div>
                      )}

                      {/* Sidechain Section */}
                      <div className="mt-3">
                        <button
                          onClick={() => setShowSidechain(!showSidechain)}
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            showSidechain
                              ? 'bg-orange-500/20 border border-orange-500 text-orange-300'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {showSidechain ? 'Hide Sidechain' : 'Show Sidechain'}
                          {sidechainEnabled && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-600 text-white rounded-full">ON</span>
                          )}
                        </button>
                      </div>

                      {/* Sidechain Panel */}
                      {showSidechain && (
                        <div className="mt-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-orange-300 uppercase tracking-wider">Sidechain Compression</h4>
                            <button
                              onClick={() => setSidechainEnabled(!sidechainEnabled)}
                              className={`px-2 py-1 text-xs rounded ${
                                sidechainEnabled ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {sidechainEnabled ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          {/* Source & Target Selection */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Sidechain Source</label>
                              <select
                                value={sidechainSource}
                                onChange={(e) => setSidechainSource(e.target.value as 'inst' | 'vocal' | 'harmony')}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md py-1.5 px-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                              >
                                <option value="inst">Instrumental</option>
                                <option value="vocal">Vocal</option>
                                <option value="harmony">Harmony</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Duck Target</label>
                              <select
                                value={sidechainTarget}
                                onChange={(e) => setSidechainTarget(e.target.value as 'vocal' | 'harmony')}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md py-1.5 px-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                              >
                                <option value="vocal">Vocal</option>
                                <option value="harmony">Harmony</option>
                              </select>
                            </div>
                          </div>

                          {/* Gain Reduction Meter */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">Gain Reduction</span>
                              <span className="text-xs font-mono text-orange-400">{sidechainGainReduction.toFixed(1)} dB</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-75"
                                style={{ width: `${Math.min(100, Math.abs(sidechainGainReduction) * 5)}%` }}
                              />
                            </div>
                          </div>

                          {/* Threshold Control */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Threshold</span>
                              <span className="text-gray-300 font-mono">{sidechainSettings.threshold.toFixed(1)} dB</span>
                            </div>
                            <input
                              type="range"
                              min="-60"
                              max="0"
                              step="1"
                              value={sidechainSettings.threshold}
                              onChange={(e) => setSidechainSettings(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                          </div>

                          {/* Ratio Control */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Ratio</span>
                              <span className="text-gray-300 font-mono">{sidechainSettings.ratio.toFixed(1)}:1</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="20"
                              step="0.5"
                              value={sidechainSettings.ratio}
                              onChange={(e) => setSidechainSettings(prev => ({ ...prev, ratio: parseFloat(e.target.value) }))}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                          </div>

                          {/* Attack/Release Controls */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Attack</span>
                                <span className="text-gray-300 font-mono">{(sidechainSettings.attack * 1000).toFixed(0)}ms</span>
                              </div>
                              <input
                                type="range"
                                min="0.001"
                                max="0.1"
                                step="0.001"
                                value={sidechainSettings.attack}
                                onChange={(e) => setSidechainSettings(prev => ({ ...prev, attack: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Release</span>
                                <span className="text-gray-300 font-mono">{(sidechainSettings.release * 1000).toFixed(0)}ms</span>
                              </div>
                              <input
                                type="range"
                                min="0.01"
                                max="1"
                                step="0.01"
                                value={sidechainSettings.release}
                                onChange={(e) => setSidechainSettings(prev => ({ ...prev, release: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                              />
                            </div>
                          </div>

                          {/* Presets */}
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Presets</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => setSidechainSettings({ threshold: -30, ratio: 2, attack: 0.01, release: 0.3, makeupGain: 0 })}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                              >
                                Subtle
                              </button>
                              <button
                                onClick={() => setSidechainSettings({ threshold: -20, ratio: 8, attack: 0.001, release: 0.15, makeupGain: 2 })}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                              >
                                Pumping
                              </button>
                              <button
                                onClick={() => setSidechainSettings({ threshold: -24, ratio: 4, attack: 0.005, release: 0.4, makeupGain: 0 })}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                              >
                                Vocal Duck
                              </button>
                              <button
                                onClick={() => setSidechainSettings({ threshold: -15, ratio: 12, attack: 0.001, release: 0.1, makeupGain: 3 })}
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                              >
                                Aggressive
                              </button>
                            </div>
                          </div>

                          {/* Info */}
                          <p className="text-xs text-gray-500">
                            Sidechain compression ducks the target track when the source track plays.
                            Common use: duck vocals/harmonies when the instrumental beat hits.
                          </p>
                        </div>
                      )}

                      {/* Pro Metering Panel */}
                      {showProMetering && (
                        <div className="mt-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Pro Metering</h4>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setShowSpectrumAnalyzer(!showSpectrumAnalyzer)}
                                className={`px-2 py-1 text-xs rounded ${showSpectrumAnalyzer ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Spectrum
                              </button>
                              <button
                                onClick={() => setShowLufsMeter(!showLufsMeter)}
                                className={`px-2 py-1 text-xs rounded ${showLufsMeter ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                LUFS
                              </button>
                              <button
                                onClick={() => setShowStereoField(!showStereoField)}
                                className={`px-2 py-1 text-xs rounded ${showStereoField ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Stereo
                              </button>
                              <button
                                onClick={() => setShowMultibandCompressor(!showMultibandCompressor)}
                                className={`px-2 py-1 text-xs rounded ${showMultibandCompressor ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Multiband
                              </button>
                              <button
                                onClick={() => setShowReferenceTrack(!showReferenceTrack)}
                                className={`px-2 py-1 text-xs rounded ${showReferenceTrack ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Reference
                              </button>
                            </div>
                          </div>

                          {/* Reference Track Panel */}
                          {showReferenceTrack && (
                            <div className="p-3 bg-gray-800/50 rounded-lg border border-purple-900/50">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-purple-300 font-bold uppercase tracking-wider">
                                  Reference Track
                                </span>
                                {listeningToReference && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-full animate-pulse">
                                    Listening
                                  </span>
                                )}
                              </div>

                              {!referenceTrackUrl ? (
                                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition-colors">
                                  <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  <span className="text-xs text-gray-400">Upload reference track</span>
                                  <span className="text-[10px] text-gray-500 mt-1">MP3, WAV, FLAC</span>
                                  <input
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleReferenceTrackUpload}
                                    className="hidden"
                                  />
                                </label>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 truncate">
                                      <span className="text-xs text-gray-400">{referenceTrackName}</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (referenceTrackUrl) URL.revokeObjectURL(referenceTrackUrl);
                                        setReferenceTrackUrl(null);
                                        setReferenceTrackName('');
                                        setListeningToReference(false);
                                        referenceAudioRef.current?.pause();
                                      }}
                                      className="text-xs text-red-400 hover:text-red-300"
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  {/* Reference audio element */}
                                  <audio
                                    ref={referenceAudioRef}
                                    src={referenceTrackUrl}
                                    onLoadedMetadata={(e) => setupReferenceAudioGraph(e.currentTarget)}
                                    onEnded={() => {
                                      setReferenceTrackPlaying(false);
                                      setListeningToReference(false);
                                    }}
                                  />

                                  {/* A/B Toggle */}
                                  <button
                                    onClick={toggleReferenceListening}
                                    className={`w-full py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                      listeningToReference
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                                  >
                                    {listeningToReference ? '▶ Reference' : '◀ Your Mix'}
                                  </button>

                                  {/* Volume Control */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 w-12">Volume</span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.01"
                                      value={referenceTrackVolume}
                                      onChange={(e) => setReferenceTrackVolume(parseFloat(e.target.value))}
                                      className="flex-1 h-1 accent-purple-500"
                                    />
                                    <span className="text-[10px] text-gray-500 w-8 text-right">
                                      {Math.round(referenceTrackVolume * 100)}%
                                    </span>
                                  </div>

                                  <p className="text-[10px] text-gray-500 text-center">
                                    Press to toggle between your mix and reference
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Spectrum Analyzer */}
                          {showSpectrumAnalyzer && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <select
                                  value={spectrumMode}
                                  onChange={(e) => setSpectrumMode(e.target.value as 'bars' | 'line' | 'filled')}
                                  className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
                                >
                                  <option value="bars">Bars</option>
                                  <option value="line">Line</option>
                                  <option value="filled">Filled</option>
                                </select>
                              </div>
                              <SpectrumAnalyzer
                                analyser={vocalAnalyser || masterAnalyser}
                                width={380}
                                height={100}
                                mode={spectrumMode}
                                showPeakHold={true}
                              />
                            </div>
                          )}

                          {/* LUFS Meter */}
                          {showLufsMeter && (
                            <LufsMeter
                              analyser={vocalAnalyser || masterAnalyser}
                              audioContext={audioContext}
                              audioSource={graphRefs.current.master?.masterGain}
                              width={380}
                              height={180}
                              targetPreset={lufsPreset}
                              onPresetChange={setLufsPreset}
                            />
                          )}

                          {/* Stereo Field Visualizer */}
                          {showStereoField && (
                            <StereoFieldVisualizer
                              analyserL={masterAnalyserL || vocalAnalyser}
                              analyserR={masterAnalyserR || vocalAnalyser}
                              width={380}
                              height={180}
                              mode="combined"
                              showBalance={true}
                            />
                          )}

                          {/* Multiband Compressor */}
                          {showMultibandCompressor && (
                            <MultibandCompressor
                              audioContext={audioContext}
                              settings={multibandSettings}
                              onChange={setMultibandSettings}
                              bypass={multibandBypass}
                              onBypassChange={setMultibandBypass}
                              gainReductions={multibandGainReductions}
                            />
                          )}

                          {/* Master Limiter */}
                          <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
                                Master Limiter
                              </span>
                              <button
                                onClick={() => setLimiterEnabled(!limiterEnabled)}
                                className={`text-xs px-3 py-1 rounded font-medium ${
                                  limiterEnabled
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-600 text-gray-400'
                                }`}
                              >
                                {limiterEnabled ? 'Active' : 'Bypassed'}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                  <span>Ceiling</span>
                                  <span className="font-mono">{limiterCeiling.toFixed(1)} dB</span>
                                </label>
                                <input
                                  type="range"
                                  min="-6"
                                  max="0"
                                  step="0.1"
                                  value={limiterCeiling}
                                  onChange={(e) => setLimiterCeiling(parseFloat(e.target.value))}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-xs text-gray-500 mr-2">GR:</span>
                                <span className={`text-lg font-mono ${limiterGainReduction < -0.5 ? 'text-orange-400' : 'text-green-400'}`}>
                                  {limiterGainReduction.toFixed(1)} dB
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Tempo-Synced Delay */}
                          <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                            <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
                              Tempo-Synced Delay
                            </span>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              <div className="col-span-2">
                                <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                  <span>BPM</span>
                                  <span className="font-mono">{delayBpm}</span>
                                </label>
                                <input
                                  type="range"
                                  min="60"
                                  max="200"
                                  step="1"
                                  value={delayBpm}
                                  onChange={(e) => setDelayBpm(parseInt(e.target.value))}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-gray-400 mb-1 block">Note</label>
                                <select
                                  value={delayNoteValue}
                                  onChange={(e) => setDelayNoteValue(e.target.value as '1/4' | '1/8' | '1/8d' | '1/16')}
                                  className="w-full text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
                                >
                                  <option value="1/4">1/4</option>
                                  <option value="1/8">1/8</option>
                                  <option value="1/8d">1/8 Dotted</option>
                                  <option value="1/16">1/16</option>
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                  <span>Feedback</span>
                                  <span className="font-mono">{Math.round(delayFeedback * 100)}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="0.95"
                                  step="0.05"
                                  value={delayFeedback}
                                  onChange={(e) => setDelayFeedback(parseFloat(e.target.value))}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                  <span>Mix</span>
                                  <span className="font-mono">{Math.round(delayMix * 100)}%</span>
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={delayMix}
                                  onChange={(e) => setDelayMix(parseFloat(e.target.value))}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="text-center mt-2 text-xs text-gray-500">
                              Delay Time: {(calculateDelayTime(delayBpm, delayNoteValue) * 1000).toFixed(0)}ms
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Tools Section */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <button
                          onClick={() => setShowAITools(!showAITools)}
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            showAITools
                              ? 'bg-purple-500/20 border border-purple-500 text-purple-300'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {showAITools ? 'Hide AI Tools' : 'Show AI Tools'}
                        </button>
                      </div>

                      {/* AI Tools Panel */}
                      {showAITools && (
                        <div className="mt-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-purple-300 uppercase tracking-wider">AI Production Tools</h4>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setShowMasteringAssistant(!showMasteringAssistant)}
                                className={`px-2 py-1 text-xs rounded ${showMasteringAssistant ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Mastering
                              </button>
                              <button
                                onClick={() => setShowChordSuggestions(!showChordSuggestions)}
                                className={`px-2 py-1 text-xs rounded ${showChordSuggestions ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Chords
                              </button>
                              <button
                                onClick={() => setShowStemSeparator(!showStemSeparator)}
                                className={`px-2 py-1 text-xs rounded ${showStemSeparator ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                              >
                                Stems
                              </button>
                            </div>
                          </div>

                          {/* Analyze Button */}
                          {!audioAnalysis && (showMasteringAssistant || showChordSuggestions) && (
                            <button
                              onClick={handleAnalyzeAudio}
                              disabled={isAnalyzingAudio || (!currentInstrumentalUrl && !vocalAudioUrl)}
                              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
                            >
                              {isAnalyzingAudio ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Analyzing Audio...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  Analyze Audio with AI
                                </>
                              )}
                            </button>
                          )}

                          {/* Analysis Results Summary */}
                          {audioAnalysis && (
                            <div className="p-3 bg-gray-800/50 rounded-lg border border-purple-500/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">Analysis Complete</span>
                                <button
                                  onClick={() => setAudioAnalysis(null)}
                                  className="text-xs text-gray-500 hover:text-gray-300"
                                >
                                  Re-analyze
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-gray-900/50 rounded">
                                  <p className="text-xs text-gray-500">BPM</p>
                                  <p className="text-lg font-bold text-white">{audioAnalysis.bpm}</p>
                                </div>
                                <div className="p-2 bg-gray-900/50 rounded">
                                  <p className="text-xs text-gray-500">Key</p>
                                  <p className="text-lg font-bold text-blue-400">{audioAnalysis.key}</p>
                                </div>
                                <div className="p-2 bg-gray-900/50 rounded">
                                  <p className="text-xs text-gray-500">Genre</p>
                                  <p className="text-sm font-bold text-purple-400 truncate">{audioAnalysis.genre}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* AI Mastering Assistant */}
                          {showMasteringAssistant && (
                            <MasteringAssistant
                              audioAnalysis={audioAnalysis}
                              onApplySettings={handleApplyMasteringSuggestions}
                              isAnalyzing={isAnalyzingAudio}
                            />
                          )}

                          {/* Chord Suggestions */}
                          {showChordSuggestions && (
                            <ChordSuggestions
                              audioAnalysis={audioAnalysis}
                              onChordSelect={(chord) => {
                                console.log('Selected chord:', chord);
                                // Could copy to clipboard or integrate with other features
                                navigator.clipboard?.writeText(chord);
                              }}
                            />
                          )}

                          {/* Stem Separator */}
                          {showStemSeparator && (
                            <StemSeparator
                              audioContext={audioContext}
                              onStemsExtracted={(stems) => {
                                console.log('Extracted stems:', stems);
                                // Could integrate with mixer or export
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Export Progress Indicator */}
                      {isExporting && (
                        <div className="mt-3 p-3 bg-indigo-900/30 rounded-lg border border-indigo-500/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-indigo-300">Exporting...</span>
                            <span className="text-sm text-indigo-400">{Math.round(exportProgress)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${exportProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Export Modal */}
                  {showExportModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowExportModal(false)}>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Export Audio</h3>

                        {/* Track Selection */}
                        <div className="space-y-3 mb-6">
                          <p className="text-sm text-gray-400 mb-2">Select tracks to include:</p>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exportOptions.includeInstrumental}
                              onChange={(e) => setExportOptions({...exportOptions, includeInstrumental: e.target.checked})}
                              className="w-4 h-4 accent-indigo-500"
                              disabled={!currentInstrumentalUrl}
                            />
                            <span className={`text-sm ${currentInstrumentalUrl ? 'text-gray-200' : 'text-gray-500'}`}>
                              Instrumental {!currentInstrumentalUrl && '(not loaded)'}
                            </span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exportOptions.includeVocal}
                              onChange={(e) => setExportOptions({...exportOptions, includeVocal: e.target.checked})}
                              className="w-4 h-4 accent-pink-500"
                              disabled={!vocalAudioUrl}
                            />
                            <span className={`text-sm ${vocalAudioUrl ? 'text-gray-200' : 'text-gray-500'}`}>
                              Vocal {useRefinedVocal ? '(Refined)' : '(Original)'} {!vocalAudioUrl && '(not generated)'}
                            </span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exportOptions.includeHarmony}
                              onChange={(e) => setExportOptions({...exportOptions, includeHarmony: e.target.checked})}
                              className="w-4 h-4 accent-purple-500"
                              disabled={!harmonyAudioUrl}
                            />
                            <span className={`text-sm ${harmonyAudioUrl ? 'text-gray-200' : 'text-gray-500'}`}>
                              Harmony {!harmonyAudioUrl && '(not generated)'}
                            </span>
                          </label>
                        </div>

                        {/* Export Format Selection */}
                        <div className="mb-4">
                          <p className="text-sm text-gray-400 mb-2">Export format:</p>
                          <select
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value as AudioFormat)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <optgroup label="WAV (Lossless)">
                              <option value="wav-16">{AUDIO_FORMATS['wav-16'].name} - {AUDIO_FORMATS['wav-16'].description}</option>
                              <option value="wav-24">{AUDIO_FORMATS['wav-24'].name} - {AUDIO_FORMATS['wav-24'].description}</option>
                              <option value="wav-32">{AUDIO_FORMATS['wav-32'].name} - {AUDIO_FORMATS['wav-32'].description}</option>
                            </optgroup>
                            <optgroup label="Compressed">
                              <option value="mp3-128">{AUDIO_FORMATS['mp3-128'].name} - {AUDIO_FORMATS['mp3-128'].description}</option>
                              <option value="mp3-192">{AUDIO_FORMATS['mp3-192'].name} - {AUDIO_FORMATS['mp3-192'].description}</option>
                              <option value="mp3-256">{AUDIO_FORMATS['mp3-256'].name} - {AUDIO_FORMATS['mp3-256'].description}</option>
                              <option value="mp3-320">{AUDIO_FORMATS['mp3-320'].name} - {AUDIO_FORMATS['mp3-320'].description}</option>
                            </optgroup>
                          </select>
                        </div>

                        {/* FX Option for Stems */}
                        <div className="mb-6 p-3 bg-gray-800 rounded-lg">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exportOptions.applyFXToStems}
                              onChange={(e) => setExportOptions({...exportOptions, applyFXToStems: e.target.checked})}
                              className="w-4 h-4 accent-indigo-500"
                            />
                            <span className="text-sm text-gray-200">Apply effects to stem exports</span>
                          </label>
                          <p className="text-xs text-gray-500 mt-1 ml-7">When disabled, stems export dry (no EQ/reverb/delay)</p>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex gap-3">
                          <Button
                            onClick={handleExportMix}
                            className="flex-1"
                            disabled={!exportOptions.includeInstrumental && !exportOptions.includeVocal && !exportOptions.includeHarmony}
                          >
                            Export Mix
                          </Button>
                          <Button
                            onClick={handleExportStems}
                            variant="secondary"
                            className="flex-1"
                            disabled={!exportOptions.includeInstrumental && !exportOptions.includeVocal && !exportOptions.includeHarmony}
                          >
                            Export Stems
                          </Button>
                        </div>

                        <button
                          onClick={() => setShowExportModal(false)}
                          className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save Preset Modal */}
                  {showSavePresetModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowSavePresetModal(false)}>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">Save Preset</h3>
                        <p className="text-sm text-gray-400 mb-4">Save your current mixer settings as a preset for quick recall.</p>

                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Preset name..."
                          className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-200 placeholder-gray-500 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveCurrentAsPreset()}
                        />

                        <div className="flex gap-3">
                          <Button
                            onClick={saveCurrentAsPreset}
                            className="flex-1"
                            disabled={!newPresetName.trim()}
                          >
                            Save Preset
                          </Button>
                          <button
                            onClick={() => {
                              setShowSavePresetModal(false);
                              setNewPresetName('');
                            }}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preset Manager Modal */}
                  {showPresetManager && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPresetManager(false)}>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">Preset Manager</h3>
                          <button
                            onClick={() => setShowPresetManager(false)}
                            className="text-gray-400 hover:text-white text-xl"
                          >
                            ×
                          </button>
                        </div>

                        {/* Import/Export Section */}
                        <div className="flex gap-2 mb-4 p-3 bg-gray-800/50 rounded-lg">
                          <input
                            type="file"
                            ref={presetImportRef}
                            accept=".json"
                            onChange={importPresets}
                            className="hidden"
                          />
                          <button
                            onClick={() => presetImportRef.current?.click()}
                            className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import
                          </button>
                          <button
                            onClick={exportPresets}
                            disabled={customPresets.length === 0}
                            className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export ({customPresets.length})
                          </button>
                        </div>

                        {/* Built-in Presets */}
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Built-in Presets</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {BUILT_IN_PRESETS.map(preset => (
                              <div key={preset.id} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-md">
                                <span className="flex-1 text-sm text-gray-300">{preset.name}</span>
                                <button
                                  onClick={() => loadPreset(preset.id)}
                                  className="px-2 py-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded transition-colors"
                                >
                                  Load
                                </button>
                                <button
                                  onClick={() => duplicatePreset(preset.id)}
                                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                                  title="Duplicate as custom preset"
                                >
                                  Copy
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Custom Presets */}
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Custom Presets ({customPresets.length})</h4>
                          {customPresets.length === 0 ? (
                            <p className="text-sm text-gray-500 italic p-4 text-center bg-gray-800/30 rounded-lg">
                              No custom presets yet. Save your mixer settings or import presets.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {customPresets.map(preset => (
                                <div key={preset.id} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-md group">
                                  {presetToRename === preset.id ? (
                                    <input
                                      type="text"
                                      value={renameValue}
                                      onChange={(e) => setRenameValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') renamePreset(preset.id, renameValue);
                                        if (e.key === 'Escape') { setPresetToRename(null); setRenameValue(''); }
                                      }}
                                      onBlur={() => {
                                        // Save if value changed and is valid, otherwise discard
                                        if (renameValue.trim() && renameValue.trim() !== preset.name) {
                                          renamePreset(preset.id, renameValue);
                                        } else {
                                          setPresetToRename(null);
                                          setRenameValue('');
                                        }
                                      }}
                                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="flex-1 text-sm text-gray-300 cursor-pointer hover:text-white"
                                      onDoubleClick={() => { setPresetToRename(preset.id); setRenameValue(preset.name); }}
                                      title="Double-click to rename"
                                    >
                                      {preset.name}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => loadPreset(preset.id)}
                                    className="px-2 py-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded transition-colors"
                                  >
                                    Load
                                  </button>
                                  <button
                                    onClick={() => duplicatePreset(preset.id)}
                                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                                    title="Duplicate"
                                  >
                                    Copy
                                  </button>
                                  <button
                                    onClick={() => deletePreset(preset.id)}
                                    className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setShowPresetManager(false)}
                          className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white transition-colors border-t border-gray-700 pt-4"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Instrumental Swap Modal */}
                  {showInstrumentalSwapModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInstrumentalSwapModal(false)}>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-2">Swap Instrumental</h3>
                        <p className="text-sm text-gray-400 mb-4">
                          Your vocals, refined vocals, and harmony tracks will be preserved.
                        </p>

                        {/* Upload Option */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Upload New Instrumental
                          </label>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              handleInstrumentalUpload(e);
                              setShowInstrumentalSwapModal(false);
                            }}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-indigo-600 file:text-white file:border-none hover:file:bg-indigo-700 cursor-pointer"
                          />
                        </div>

                        {/* Generate Option */}
                        <div className="border-t border-gray-700 pt-4 mt-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Or Generate New Instrumental
                          </label>
                          <input
                            type="text"
                            placeholder="Describe the style (e.g., 'upbeat pop', 'lo-fi hip hop')"
                            value={instrumentalStyle}
                            onChange={(e) => setInstrumentalStyle(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-gray-200 placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <Button
                            onClick={handleGenerateNewInstrumental}
                            isLoading={isGeneratingInstrumental}
                            variant="secondary"
                            className="w-full"
                            disabled={!instrumentalStyle.trim()}
                          >
                            Generate Instrumental
                          </Button>
                          {instrumentalError && (
                            <p className="text-red-400 text-sm mt-2">{instrumentalError}</p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setShowInstrumentalSwapModal(false);
                            setInstrumentalStyle('');
                            setInstrumentalError('');
                          }}
                          className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
              </Card>
          ) : (
             <Card>
                <div className="text-center py-8">
                     <p className="text-gray-400">Generate a vocal track below to unlock the Studio Mixer.</p>
                </div>
             </Card>
          )}

          <Card>
            <h3 className="text-xl font-semibold mb-4">Vocal Generator (TTS)</h3>
            <p className="text-gray-400 mb-4">Select a voice and generate a base vocal performance.</p>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Voice Model</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AVAILABLE_VOICES.map((voice) => (
                        <button
                            key={voice.name}
                            onClick={() => setSelectedVoice(voice.name)}
                            className={`flex flex-col items-start p-2 border rounded-md transition-colors ${
                                selectedVoice === voice.name 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            <span className="font-bold text-sm">{voice.name}</span>
                            <span className="text-xs opacity-75">{voice.gender}, {voice.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            <Button onClick={handleGenerateVocal} isLoading={isLoading} disabled={!lyrics}>
              {vocalAudioUrl ? 'Regenerate Vocal Track' : 'Generate Vocal Track'}
            </Button>
            {error && <p className="text-red-400 mt-4">{error}</p>}
            
            {vocalAudioUrl && (
              <div className="mt-6 border-t border-gray-700 pt-4">
                <h4 className="font-semibold mb-2 text-sm text-gray-300">Raw Vocal Output:</h4>
                <WaveformPlayer audioUrl={vocalAudioUrl} />
              </div>
            )}
          </Card>
          
          {/* Vocal Refinement Section */}
          <Card>
             <h3 className="text-xl font-semibold mb-4">Vocal Tuning & Refinement</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                     <label className="block text-sm font-medium text-gray-300 mb-1">Target Key</label>
                     <select 
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="block w-full bg-gray-900 border-gray-600 rounded-md text-sm py-2 px-3"
                        disabled={!vocalAudioUrl || isRefining}
                     >
                         {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                     </select>
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-gray-300 mb-1">Correction Strength ({pitchCorrectionLevel}%)</label>
                     <input 
                        type="range"
                        min="0" max="100"
                        value={pitchCorrectionLevel}
                        onChange={(e) => setPitchCorrectionLevel(parseInt(e.target.value))}
                        className="w-full accent-indigo-500 mt-2"
                        disabled={!vocalAudioUrl || isRefining}
                     />
                 </div>
             </div>
             
             <Button onClick={handleRefineVocal} disabled={!vocalAudioUrl || isRefining} isLoading={isRefining} variant="secondary" className="mt-4 w-full">
                 Apply Pitch Correction
             </Button>
             
             {refiningError && <p className="text-red-400 mt-2 text-sm">{refiningError}</p>}
             {refinedVocalUrl && !isRefining && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <h4 className="font-semibold mb-2 text-sm text-indigo-300">Refined Vocal Track:</h4>
                    <WaveformPlayer audioUrl={refinedVocalUrl} />
                    <p className="text-xs text-gray-500 mt-1 italic">Enabled in mixer by default.</p>
                  </div>
             )}
          </Card>

          {/* Harmony Generator Section */}
          <Card>
              <h3 className="text-xl font-semibold mb-4">AI Harmony Generator</h3>
              <p className="text-gray-400 text-sm mb-4">Create a harmony layer based on your lead vocal track.</p>
              
              <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Harmony Type</label>
                   <select 
                        value={selectedHarmony}
                        onChange={(e) => setSelectedHarmony(e.target.value)}
                        className="block w-full bg-gray-900 border-gray-600 rounded-md text-sm py-2 px-3"
                        disabled={!vocalAudioUrl || isHarmonizing}
                     >
                         {HARMONY_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                     </select>
              </div>

               <Button onClick={handleGenerateHarmony} disabled={!vocalAudioUrl || isHarmonizing} isLoading={isHarmonizing} variant="secondary" className="w-full">
                 Generate Harmony Track
             </Button>
             
              {harmonyError && <p className="text-red-400 mt-2 text-sm">{harmonyError}</p>}
              {harmonyAudioUrl && !isHarmonizing && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <h4 className="font-semibold mb-2 text-sm text-purple-300">Generated Harmony:</h4>
                    <WaveformPlayer audioUrl={harmonyAudioUrl} />
                  </div>
             )}
          </Card>
        </div>
      </div>
    </Page>
  );
};

export default AudioProduction;
