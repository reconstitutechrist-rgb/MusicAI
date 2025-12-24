
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Page from '../ui/Page';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generateSpeech, processAudioTrack, generateInstrumentalTrack } from '../../services/geminiService';
import WaveformPlayer from '../ui/WaveformPlayer';
import VuMeter from '../ui/VuMeter';
import ParametricEQ, { DEFAULT_EQ_BANDS, type EQBand } from '../ui/ParametricEQ';
import {
  bufferToWavBlob,
  downloadBlob,
  renderMixOffline,
  renderStemOffline,
  fetchAudioBuffer,
  type TrackConfig
} from '../../utils/audioExport';

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

  // Lyrics Editing State
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState(lyrics);

  // Instrumental Swap State
  const [showInstrumentalSwapModal, setShowInstrumentalSwapModal] = useState(false);
  const [isGeneratingInstrumental, setIsGeneratingInstrumental] = useState(false);
  const [instrumentalStyle, setInstrumentalStyle] = useState('');
  const [instrumentalError, setInstrumentalError] = useState('');

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
    vocal: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      eqLow?: BiquadFilterNode;
      eqMid?: BiquadFilterNode;
      eqHigh?: BiquadFilterNode;
      reverbGain?: GainNode;
      delayGain?: GainNode;
      analyser?: AnalyserNode;
    };
    harmony: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      eqLow?: BiquadFilterNode;
      eqMid?: BiquadFilterNode;
      eqHigh?: BiquadFilterNode;
      reverbGain?: GainNode;
      delayGain?: GainNode;
      analyser?: AnalyserNode;
    };
    reverbBuffer?: AudioBuffer;
  }>({ vocal: {}, harmony: {} });

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

        // Effects Chain (Parallel)
        const reverbNode = ctx.createConvolver();
        reverbNode.buffer = graphRefs.current.reverbBuffer!;
        refs.reverbGain = ctx.createGain();

        const delayNode = ctx.createDelay();
        delayNode.delayTime.value = 0.3; // 300ms delay
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.4;
        refs.delayGain = ctx.createGain();

        // Routing:
        // Source -> Low -> Mid -> High -> Gain -> Destination
        refs.source.connect(refs.eqLow);
        refs.eqLow.connect(refs.eqMid);
        refs.eqMid.connect(refs.eqHigh);
        refs.eqHigh.connect(refs.gain);
        refs.gain.connect(ctx.destination);

        // Sends:
        // Source -> Reverb -> ReverbGain -> Destination
        refs.source.connect(reverbNode);
        reverbNode.connect(refs.reverbGain);
        refs.reverbGain.connect(ctx.destination);

        // Source -> Delay -> Feedback -> Delay
        // Source -> Delay -> DelayGain -> Destination
        refs.source.connect(delayNode);
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayNode.connect(refs.delayGain);
        refs.delayGain.connect(ctx.destination);
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
    if (refs.delayGain) refs.delayGain.gain.value = settings.delay * 0.6;

  }, [audioContext]);

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
        setExportProgress(progress);
      });

      const wavBlob = bufferToWavBlob(renderedBuffer);
      downloadBlob(wavBlob, 'muse-ai-mix.wav');

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
        const wavBlob = bufferToWavBlob(renderedBuffer);
        downloadBlob(wavBlob, `muse-ai-${name}.wav`);

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
                        >
                          Save
                        </button>
                        {currentPresetId && !allPresets.find(p => p.id === currentPresetId)?.isBuiltIn && (
                          <button
                            onClick={() => currentPresetId && deletePreset(currentPresetId)}
                            className="px-2 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md transition-colors border border-red-600/50"
                            title="Delete preset"
                          >
                            ×
                          </button>
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
                      {currentInstrumentalUrl && <audio ref={instrumentalRef} src={currentInstrumentalUrl} crossOrigin="anonymous" preload="auto" onEnded={() => setIsPlayingMix(false)} onPlay={() => { if(audioContext?.state === 'suspended') audioContext.resume(); }} />}
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
                          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            bypassAllFX
                              ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                              : 'bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {bypassAllFX ? 'A (Original - FX Bypassed)' : 'B (Processed - FX Active)'}
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">Compare original vs. processed sound</p>
                      </div>

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
