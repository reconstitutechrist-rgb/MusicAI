
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Page from '../ui/Page';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { generateSpeech, processAudioTrack } from '../../services/geminiService';
import WaveformPlayer from '../ui/WaveformPlayer';

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

  // Refs for Audio Elements and Web Audio Graph
  const instrumentalRef = useRef<HTMLAudioElement>(null);
  const vocalRef = useRef<HTMLAudioElement>(null);
  const harmonyRef = useRef<HTMLAudioElement>(null);

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
    };
    harmony: {
      source?: MediaElementAudioSourceNode;
      gain?: GainNode;
      eqLow?: BiquadFilterNode;
      eqMid?: BiquadFilterNode;
      eqHigh?: BiquadFilterNode;
      reverbGain?: GainNode;
      delayGain?: GainNode;
    };
    reverbBuffer?: AudioBuffer;
  }>({ vocal: {}, harmony: {} });

  useEffect(() => {
    if (!audioContext) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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

    // 3. Update Parameters
    if (refs.gain) refs.gain.gain.value = volume;
    if (refs.eqLow) refs.eqLow.gain.value = settings.eqLow;
    if (refs.eqMid) refs.eqMid.gain.value = settings.eqMid;
    if (refs.eqHigh) refs.eqHigh.gain.value = settings.eqHigh;
    if (refs.reverbGain) refs.reverbGain.gain.value = settings.reverb * 0.8; // Scale down a bit
    if (refs.delayGain) refs.delayGain.gain.value = settings.delay * 0.6;

  }, [audioContext]);

  // Update Graph when Settings or Volume Change
  useEffect(() => {
      if (vocalRef.current) setupTrackGraph('vocal', vocalRef.current, vocalSettings, vocalVolume);
  }, [vocalSettings, vocalVolume, setupTrackGraph, vocalAudioUrl, refinedVocalUrl, useRefinedVocal]);

  useEffect(() => {
      if (harmonyRef.current) setupTrackGraph('harmony', harmonyRef.current, harmonySettings, harmonyVolume);
  }, [harmonySettings, harmonyVolume, setupTrackGraph, harmonyAudioUrl]);

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

  // FX Controls Component
  const FXControls = ({ settings, setSettings }: { settings: TrackFX, setSettings: (s: TrackFX) => void }) => (
      <div className="bg-gray-800 p-4 rounded-md mt-2 space-y-4 border border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
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
            <h3 className="text-xl font-semibold mb-4">Lyrics</h3>
            <p className="text-gray-400 whitespace-pre-wrap h-96 overflow-y-auto">{lyrics || "No lyrics generated yet. Go to the 'Create' tab first."}</p>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-8">
            
          {/* New Studio Mixer Card */}
          {vocalAudioUrl ? (
              <Card className="border-indigo-500/50">
                  <h3 className="text-xl font-semibold mb-4 text-indigo-300">Studio Mixer</h3>
                  
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

                           {showVocalFX && <FXControls settings={vocalSettings} setSettings={setVocalSettings} />}
                      </div>

                      {/* Harmony Track */}
                       <div className="bg-gray-900/50 p-3 rounded-lg">
                           <div className="flex items-center gap-4">
                               <div className="w-24 text-sm font-bold text-gray-400">Harmony</div>
                               {harmonyAudioUrl ? (
                                   <>
                                    <input type="range" min="0" max="1" step="0.05" value={harmonyVolume} onChange={(e) => setHarmonyVolume(parseFloat(e.target.value))} className="flex-1 accent-purple-500" />
                                    <button onClick={() => setShowHarmonyFX(!showHarmonyFX)} className={`text-xs px-2 py-1 rounded border ${showHarmonyFX ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-600 text-gray-400'}`}>FX</button>
                                   </>
                               ) : <div className="flex-1 text-xs text-gray-500 italic">No harmony generated</div>}
                           </div>
                           {harmonyAudioUrl && showHarmonyFX && <FXControls settings={harmonySettings} setSettings={setHarmonySettings} />}
                      </div>
                      
                      {/* Hidden Audio Elements for Mixing */}
                      {/* Note: crossorigin="anonymous" is needed if instrumentalUrl is external to use Web Audio API, but triggers CORS issues if not configured on server. We assume local blobs or CORS-safe headers. */}
                      {currentInstrumentalUrl && <audio ref={instrumentalRef} src={currentInstrumentalUrl} crossOrigin="anonymous" preload="auto" onEnded={() => setIsPlayingMix(false)} onPlay={() => { if(audioContext?.state === 'suspended') audioContext.resume(); }} />}
                      <audio ref={vocalRef} src={useRefinedVocal && refinedVocalUrl ? refinedVocalUrl : vocalAudioUrl} crossOrigin="anonymous" preload="auto" />
                      {harmonyAudioUrl && <audio ref={harmonyRef} src={harmonyAudioUrl} crossOrigin="anonymous" preload="auto" />}

                      <Button onClick={toggleMixPlayback} className="w-full mt-2" disabled={!currentInstrumentalUrl && !vocalAudioUrl}>
                          {isPlayingMix ? 'Pause Mix' : 'Play Full Mix'}
                      </Button>
                  </div>
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
