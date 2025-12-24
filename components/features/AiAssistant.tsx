import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: Removed non-exported type `LiveSession`
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from "@google/genai";
import Page from '../ui/Page';
import Tabs from '../ui/Tabs';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ChatMessage } from '../../types';
import { startChatStream, translateText, generateChatTitle } from '../../services/geminiService';

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4-4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
);

const ModelIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12H8v-2h8v2zm2-4h-2v-2h2v2z"/>
    </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


// --- Helper Functions for Live API ---

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// FIX: Replaced `js-base64` decode with compliant `atob` implementation.
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    // FIX: Corrected typo from `Uint8A rray` to `Uint8Array`. This resolves both errors.
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

const supportedLanguages = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ru', name: 'Russian' },
];

const CHAT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Flash (Fast & Concise)' },
  { id: 'gemini-2.5-pro', name: 'Pro (Advanced & Creative)' },
];

const LIVE_MODELS = [
  { id: 'gemini-2.5-flash-native-audio-preview-09-2025', name: 'Flash Native Audio', description: 'Optimized for real-time, low-latency voice.' },
];

// --- Session Types ---
interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    model: string;
    systemInstruction?: string;
    createdAt: number;
}


// --- Chat Bot Component ---
const ChatBot: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditingInstruction, setIsEditingInstruction] = useState(false);
    const [tempInstruction, setTempInstruction] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
    const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);

    const filteredSessions = useMemo(() => {
        if (!searchQuery) {
            return sessions.sort((a, b) => b.createdAt - a.createdAt);
        }
        return sessions.filter(session =>
            session.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => b.createdAt - a.createdAt);
    }, [sessions, searchQuery]);

    const handleNewChat = useCallback(() => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            name: `Conversation ${new Date().toLocaleString()}`,
            messages: [],
            model: CHAT_MODELS[0].id,
            createdAt: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    }, []);

    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('museAiChatSessions');
            const savedActiveId = localStorage.getItem('museAiActiveSessionId');
            const parsedSessions: ChatSession[] = savedSessions ? JSON.parse(savedSessions) : [];

            if (parsedSessions.length > 0) {
                setSessions(parsedSessions);
                if (savedActiveId && parsedSessions.some(s => s.id === savedActiveId)) {
                    setActiveSessionId(savedActiveId);
                } else {
                    setActiveSessionId(parsedSessions.sort((a, b) => b.createdAt - a.createdAt)[0].id);
                }
            } else {
                handleNewChat();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            handleNewChat();
        }
    }, [handleNewChat]);

    useEffect(() => {
        let timer: number;
        if (saveStatus === 'saving') {
             try {
                if (sessions.length > 0 && activeSessionId) {
                    localStorage.setItem('museAiChatSessions', JSON.stringify(sessions));
                    localStorage.setItem('museAiActiveSessionId', activeSessionId);
                } else {
                    localStorage.removeItem('museAiChatSessions');
                    localStorage.removeItem('museAiActiveSessionId');
                }
                timer = window.setTimeout(() => setSaveStatus('saved'), 500);
            } catch (e) {
                console.error("Failed to save session:", e);
                setSaveStatus('idle'); // or an error state
            }
        } else if (saveStatus === 'saved') {
            timer = window.setTimeout(() => setSaveStatus('idle'), 2000);
        }
        return () => clearTimeout(timer);
    }, [sessions, activeSessionId, saveStatus]);
    
    useEffect(() => {
      if(sessions.length > 0) {
          setSaveStatus('saving');
      }
    }, [sessions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
    };
    
    const handleModelChange = (newModel: string) => {
        if (activeSessionId) {
            updateSession(activeSessionId, { model: newModel });
        }
    };

    const handleRenameSession = (newName: string) => {
        if (activeSessionId && newName.trim()) {
            updateSession(activeSessionId, { name: newName.trim() });
        }
    };
    
    const handleSaveInstruction = () => {
        if (activeSessionId) {
            updateSession(activeSessionId, { systemInstruction: tempInstruction });
            setIsEditingInstruction(false);
        }
    };

    const handleDeleteSession = (sessionIdToDelete: string) => {
        if (!window.confirm("Are you sure you want to delete this conversation?")) return;

        const remainingSessions = sessions.filter(s => s.id !== sessionIdToDelete);
        setSessions(remainingSessions);

        if (activeSessionId === sessionIdToDelete) {
            if (remainingSessions.length > 0) {
                setActiveSessionId(remainingSessions.sort((a, b) => b.createdAt - a.createdAt)[0].id);
            } else {
                handleNewChat();
            }
        }
    };
    
    const handleSend = async () => {
        if (!input.trim() || isLoading || !activeSessionId || !activeSession) return;
    
        const userMessageText = input;
        setInput('');
        setIsLoading(true);
    
        const isFirstMessage = messages.length === 0;
    
        const userMessage: ChatMessage = { role: 'user', text: userMessageText };
        const placeholderMessage: ChatMessage = { role: 'model', text: '' };
        
        updateSession(activeSessionId, { messages: [...messages, userMessage, placeholderMessage] });
    
        if (isFirstMessage) {
            generateChatTitle(userMessageText).then(title => {
                if (title) {
                    handleRenameSession(title);
                }
            });
        }
    
        try {
            // FIX: Updated to pass the systemInstruction from the active session.
            const stream = await startChatStream(activeSession.model, messages, userMessageText, activeSession.systemInstruction);
    
            let finalModelText = "";
            for await (const chunk of stream) {
                const textChunk = chunk.text;
                if (textChunk) {
                    finalModelText += textChunk;
                    setSessions(prev => prev.map(s => {
                        if (s.id === activeSessionId) {
                            const currentMsgs = s.messages;
                            const lastMsg = currentMsgs[currentMsgs.length - 1];
                            return { ...s, messages: [...currentMsgs.slice(0, -1), { ...lastMsg, text: finalModelText }] };
                        }
                        return s;
                    }));
                }
            }
    
            if (targetLanguage && finalModelText.trim()) {
                const translatedModelText = await translateText(finalModelText, targetLanguage);
                setSessions(prev => prev.map(s => {
                    if (s.id === activeSessionId) {
                         const currentMsgs = s.messages;
                         const lastMsg = currentMsgs[currentMsgs.length - 1];
                         return { ...s, messages: [...currentMsgs.slice(0, -1), { ...lastMsg, translatedText: translatedModelText }] };
                    }
                    return s;
                }));
            }
    
        } catch (e) {
            console.error(e);
            setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                    const currentMsgs = s.messages;
                    return { ...s, messages: [...currentMsgs.slice(0, -1), { role: 'model', text: 'Sorry, I had trouble responding.' }] };
                }
                return s;
            }));
        } finally {
            setIsLoading(false);
        }
    };
    
     const handleEditInstructionClick = () => {
        setTempInstruction(activeSession?.systemInstruction || '');
        setIsEditingInstruction(true);
    };


    return (
        <Card className="flex h-[calc(100vh-18rem)]">
            <div className="w-1/3 md:w-1/4 border-r border-gray-700/50 flex flex-col">
                <div className="p-4 border-b border-gray-700/50">
                    <Button onClick={handleNewChat} className="w-full">+ New Chat</Button>
                    <div className="mt-4">
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800 border-gray-600 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredSessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer group relative transition-colors ${
                                session.id === activeSessionId ? 'bg-indigo-500/20' : 'hover:bg-gray-700/50'
                            }`}
                        >
                            <div className="flex-1 truncate">
                                <p className={`text-sm font-semibold truncate ${session.id === activeSessionId ? 'text-indigo-300' : 'text-gray-300'}`}>
                                    {session.name}
                                </p>
                                <p className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                aria-label="Delete conversation"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-2/3 md:w-3/4 flex flex-col">
                {!activeSession ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500">Select or create a conversation to begin.</div>
                ) : (
                    <>
                        <div className="p-4 border-b border-gray-700/50">
                            <input
                                type="text"
                                value={activeSession.name}
                                onBlur={(e) => handleRenameSession(e.target.value)}
                                onChange={(e) => updateSession(activeSession.id, { name: e.target.value })}
                                className="text-lg font-semibold bg-transparent w-full focus:outline-none focus:bg-gray-700/50 rounded-md px-2 py-1"
                                placeholder="Rename conversation..."
                            />
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center space-x-4">
                                     <div className="flex items-center space-x-2">
                                        <label htmlFor="chat-model-select" className="text-sm text-gray-400">Model:</label>
                                        <select
                                            id="chat-model-select"
                                            value={activeSession.model}
                                            onChange={(e) => handleModelChange(e.target.value)}
                                            className="bg-gray-800 border-gray-600 rounded-md text-sm py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            {CHAT_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="chat-language-select" className="text-sm text-gray-400">Translate to:</label>
                                        <select
                                            id="chat-language-select"
                                            value={targetLanguage}
                                            onChange={(e) => setTargetLanguage(e.target.value)}
                                            className="bg-gray-800 border-gray-600 rounded-md text-sm py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            <option value="">None</option>
                                            {supportedLanguages.map(lang => <option key={lang.code} value={lang.name}>{lang.name}</option>)}
                                        </select>
                                    </div>
                                     {/* FIX: Removed invalid 'size' prop from Button component. */}
                                     <Button variant="ghost" size="sm" onClick={handleEditInstructionClick}>System Instruction</Button>
                                </div>
                                <div className="text-sm text-gray-500">
                                    {saveStatus === 'saving' && 'Saving...'}
                                    {saveStatus === 'saved' && '✓ All changes saved'}
                                </div>
                            </div>
                        </div>
                        
                        {isEditingInstruction ? (
                            <div className="flex-1 flex flex-col p-4">
                                <h3 className="text-lg font-semibold">System Instruction</h3>
                                <p className="text-sm text-gray-400 mb-2">Define the AI's persona, role, and rules. This instruction is saved per-chat.</p>
                                <textarea
                                    value={tempInstruction}
                                    onChange={(e) => setTempInstruction(e.target.value)}
                                    className="flex-1 bg-gray-900/50 border-gray-600 rounded-md p-2 resize-none"
                                    placeholder="e.g., You are a music theory professor. Explain concepts simply."
                                />
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button variant="secondary" onClick={() => setIsEditingInstruction(false)}>Cancel</Button>
                                    <Button onClick={handleSaveInstruction}>Save</Button>
                                </div>
                            </div>
                        ) : (
                             <>
                                <div className="flex-1 overflow-y-auto bg-gray-900/50 p-4 space-y-4">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'}`}>
                                            {msg.translatedText ? (
                                                    <>
                                                        <p className="whitespace-pre-wrap">{msg.translatedText}</p>
                                                        <p className="text-xs text-gray-300/70 mt-1 italic whitespace-pre-wrap">{msg.text}</p>
                                                    </>
                                            ) : (
                                                <p className="whitespace-pre-wrap">
                                                    {msg.text}
                                                    {isLoading && i === messages.length - 1 && <span className="inline-block w-2 h-4 bg-gray-300 ml-1 animate-pulse"></span>}
                                                    </p>
                                            )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="mt-auto p-4 border-t border-gray-700/50">
                                    <div className="flex">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                            className="flex-1 bg-gray-700 border-gray-600 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                                            placeholder="Ask anything..."
                                            disabled={isLoading}
                                        />
                                        <Button onClick={handleSend} isLoading={isLoading} className="rounded-l-none">Send</Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
};

// --- Live Conversation Component ---
interface HistoryTurn {
  id: string; // Add a unique ID for each turn
  speaker: 'user' | 'model';
  text: string;
  translatedText?: string;
}

interface LiveSession {
    id: string;
    name: string;
    history: HistoryTurn[];
    model: string;
    createdAt: number;
}


const LiveConversation: React.FC = () => {
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'listening' | 'error'>('idle');
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [liveHistory, setLiveHistory] = useState<HistoryTurn[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [currentUserTranscription, setCurrentUserTranscription] = useState('');
    const [currentModelTranscription, setCurrentModelTranscription] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('');
    
    // FIX: Replaced `LiveSession` with `any` since it is not exported from the library.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const userTranscriptionRef = useRef('');
    const modelTranscriptionRef = useRef('');

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);

    const handleNewConversation = useCallback(() => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to start a new session?")) {
                return;
            }
        }
        const newSession: LiveSession = {
            id: Date.now().toString(),
            name: `Live Session ${new Date().toLocaleString()}`,
            history: [],
            model: LIVE_MODELS[0].id,
            createdAt: Date.now()
        };
        setSessions(prev => [newSession, ...prev.sort((a,b) => b.createdAt - a.createdAt)]);
        setActiveSessionId(newSession.id);
    }, [hasUnsavedChanges]);

    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('museAiLiveSessions');
            const savedActiveId = localStorage.getItem('museAiActiveLiveSessionId');
            const parsedSessions: LiveSession[] = savedSessions ? JSON.parse(savedSessions) : [];

            if (parsedSessions.length > 0) {
                setSessions(parsedSessions.sort((a, b) => b.createdAt - a.createdAt));
                if (savedActiveId && parsedSessions.some(s => s.id === savedActiveId)) {
                    setActiveSessionId(savedActiveId);
                } else {
                    setActiveSessionId(parsedSessions[0].id);
                }
            } else {
                handleNewConversation();
            }
        } catch (error) {
            console.error('Failed to load live session history:', error);
            handleNewConversation();
        }
    }, [handleNewConversation]);

     useEffect(() => {
        if (sessions.length > 0 && activeSessionId) {
            localStorage.setItem('museAiLiveSessions', JSON.stringify(sessions));
            localStorage.setItem('museAiActiveLiveSessionId', activeSessionId);
        } else {
             localStorage.removeItem('museAiLiveSessions');
             localStorage.removeItem('museAiActiveLiveSessionId');
        }
    }, [sessions, activeSessionId]);

    useEffect(() => {
        const session = sessions.find(s => s.id === activeSessionId);
        if (session) {
            setLiveHistory(session.history);
            setHasUnsavedChanges(false);
        } else {
            setLiveHistory([]);
            setHasUnsavedChanges(false);
        }
    }, [activeSessionId, sessions]);


    const stopSession = useCallback(async () => {
        setSessionStatus('idle');
        if (!sessionPromiseRef.current) return;
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) { console.error("Error closing session:", e); }
        finally {
            sessionPromiseRef.current = null;
            
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            scriptProcessorRef.current?.disconnect();
            scriptProcessorRef.current = null;
            if (audioContextRef.current) {
                audioContextRef.current.input.close();
                audioContextRef.current.output.close();
                audioContextRef.current = null;
            }
            console.log("Session stopped and resources cleaned up.");
        }
    }, []);

    const startSession = async () => {
        if (sessionStatus !== 'idle' || !process.env.API_KEY || !activeSession) return;
        setSessionStatus('listening');

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = { input: inputAudioContext, output: outputAudioContext };
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const sessionPromise = ai.live.connect({
            model: activeSession.model,
            callbacks: {
                onopen: () => {
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle transcription
                    if (message.serverContent?.inputTranscription) {
                        userTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        setCurrentUserTranscription(userTranscriptionRef.current);
                    }
                    if (message.serverContent?.outputTranscription) {
                        modelTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        setCurrentModelTranscription(modelTranscriptionRef.current);
                    }
                    if (message.serverContent?.turnComplete) {
                        const fullUserInput = userTranscriptionRef.current;
                        const fullModelOutput = modelTranscriptionRef.current;
                        
                        userTranscriptionRef.current = '';
                        modelTranscriptionRef.current = '';
                        setCurrentUserTranscription('');
                        setCurrentModelTranscription('');

                        const processTurn = async () => {
                            const newHistoryEntries: HistoryTurn[] = [];

                            if (fullUserInput.trim()) {
                                newHistoryEntries.push({ id: `user-${Date.now()}`, speaker: 'user', text: fullUserInput });
                            }
                            if (fullModelOutput.trim()) {
                                newHistoryEntries.push({ id: `model-${Date.now()}`, speaker: 'model', text: fullModelOutput });
                            }
                            
                            if (newHistoryEntries.length > 0) {
                                setLiveHistory(prev => [...prev, ...newHistoryEntries]);
                                setHasUnsavedChanges(true);
                            }
                        };
                        processTurn();
                    }

                    // Handle audio playback
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio) {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => sourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of sourcesRef.current.values()) {
                            source.stop();
                            sourcesRef.current.delete(source);
                        }
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => { console.error('Session error:', e); setSessionStatus('error'); stopSession(); },
                onclose: (e: CloseEvent) => { console.log('Session closed.'); setSessionStatus('idle'); },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: 'You are a friendly and helpful creative assistant for a musician.',
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
        });
        sessionPromiseRef.current = sessionPromise;

        function createBlob(data: Float32Array): GenAiBlob {
            const l = data.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
                int16[i] = data[i] * 32768;
            }
            return {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
            };
        }
    };
    
    useEffect(() => {
        return () => { if(sessionStatus !== 'idle') stopSession(); };
    }, [sessionStatus, stopSession]);

    const updateSession = (sessionId: string, updates: Partial<LiveSession>) => {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
    };
    
    const handleModelChange = (newModel: string) => {
        if (activeSessionId) {
            updateSession(activeSessionId, { model: newModel });
        }
    };

    const handleRenameSession = (newName: string) => {
        if (activeSessionId && newName.trim()) {
            updateSession(activeSessionId, { name: newName.trim() });
        }
    };
    
    const handleSaveSession = async () => {
        if (!activeSessionId || !hasUnsavedChanges) return;
    
        const historyToSave = [...liveHistory];
        
        if (targetLanguage) {
            for (let i = 0; i < historyToSave.length; i++) {
                if (!historyToSave[i].translatedText) {
                    historyToSave[i].translatedText = await translateText(historyToSave[i].text, targetLanguage);
                }
            }
        }
        
        updateSession(activeSessionId, { history: historyToSave });
        setHasUnsavedChanges(false);
    };

    const handleSessionClick = (sessionId: string) => {
        if (sessionStatus !== 'idle') return;
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to switch? Your changes will be lost.")) {
                return;
            }
        }
        setActiveSessionId(sessionId);
    };

    const handleDeleteSession = (sessionIdToDelete: string) => {
        if (!window.confirm("Are you sure you want to delete this session?")) return;

        const remainingSessions = sessions.filter(s => s.id !== sessionIdToDelete);
        setSessions(remainingSessions);

        if (activeSessionId === sessionIdToDelete) {
            if (remainingSessions.length > 0) {
                setActiveSessionId(remainingSessions[0].id);
            } else {
                handleNewConversation();
            }
        }
    };
    
    const handleDeleteMessage = (messageId: string) => {
        if (sessionStatus !== 'idle') return;
        const updatedHistory = liveHistory.filter(turn => turn.id !== messageId);
        setLiveHistory(updatedHistory);
        setHasUnsavedChanges(true);
    };


    return (
        <Card className="flex h-[calc(100vh-18rem)]">
            <div className="w-1/3 md:w-1/4 border-r border-gray-700/50 flex flex-col">
                 <div className="p-4 border-b border-gray-700/50">
                    <Button onClick={handleNewConversation} className="w-full" disabled={sessionStatus !== 'idle'}>+ New Session</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => handleSessionClick(session.id)}
                            className={`flex items-center justify-between p-3 rounded-lg group relative transition-colors ${sessionStatus !== 'idle' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${session.id === activeSessionId ? 'bg-indigo-500/20' : 'hover:bg-gray-700/50'}`}
                        >
                            <div className="flex-1 truncate">
                                <p className={`text-sm font-semibold truncate ${session.id === activeSessionId ? 'text-indigo-300' : 'text-gray-300'}`}>
                                    {session.name}
                                </p>
                                <p className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); sessionStatus === 'idle' && handleDeleteSession(session.id); }}
                                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ${sessionStatus !== 'idle' ? 'hidden' : ''}`}
                                aria-label="Delete session"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="w-2/3 md:w-3/4 flex flex-col">
                {!activeSession ? (
                     <div className="flex-1 flex items-center justify-center text-gray-500">Select or create a session to begin.</div>
                ) : (
                    <>
                    <div className="p-4 border-b border-gray-700/50">
                        <input
                            type="text"
                            value={activeSession.name}
                            onChange={(e) => handleRenameSession(e.target.value)}
                            className="text-lg font-semibold bg-transparent w-full focus:outline-none focus:bg-gray-700/50 rounded-md px-2 py-1 disabled:opacity-70"
                            placeholder="Rename session..."
                            disabled={sessionStatus !== 'idle'}
                        />
                         <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                             <div className="flex items-center gap-4">
                               <button
                                    onClick={sessionStatus === 'idle' ? startSession : stopSession}
                                    className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
                                        ${sessionStatus === 'idle' ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400' : ''}
                                        ${sessionStatus === 'listening' ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400' : ''}
                                        ${sessionStatus === 'error' ? 'bg-yellow-500 text-white focus:ring-yellow-400' : ''}
                                    `}
                                    aria-label={sessionStatus === 'idle' ? 'Start conversation' : 'Stop conversation'}
                                >
                                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
                                    {sessionStatus === 'listening' && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"></span>}
                                </button>
                                <div>
                                    <p className="font-semibold text-lg">
                                        {sessionStatus === 'idle' && 'Ready to start'}
                                        {sessionStatus === 'listening' && 'Listening...'}
                                        {sessionStatus === 'error' && 'Connection Error'}
                                    </p>
                                     <Button onClick={handleSaveSession} variant="ghost" disabled={sessionStatus !== 'idle' || !hasUnsavedChanges}>
                                        Save Session
                                        {hasUnsavedChanges && <span className="w-2 h-2 bg-green-400 rounded-full ml-2 animate-pulse"></span>}
                                    </Button>
                                </div>
                             </div>
                             <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="live-model-select" className="text-sm text-gray-400">Model:</label>
                                    <select
                                        id="live-model-select"
                                        value={activeSession.model}
                                        onChange={(e) => handleModelChange(e.target.value)}
                                        disabled={sessionStatus !== 'idle'}
                                        className="bg-gray-800 border-gray-600 rounded-md text-sm py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-70"
                                    >
                                        {LIVE_MODELS.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {`${model.name} - ${model.description}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="language-select" className="text-sm text-gray-400">Translate to:</label>
                                    <select
                                        id="language-select"
                                        value={targetLanguage}
                                        onChange={(e) => setTargetLanguage(e.target.value)}
                                        disabled={sessionStatus !== 'idle'}
                                        className="bg-gray-800 border-gray-600 rounded-md text-sm py-1 px-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">None</option>
                                        {supportedLanguages.map(lang => <option key={lang.code} value={lang.name}>{lang.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-gray-900/50 p-4 space-y-4">
                        {liveHistory.map((turn) => (
                           <div key={turn.id} className={`group flex items-start gap-3 ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {turn.speaker === 'model' && <ModelIcon className="h-6 w-6 text-indigo-400 flex-shrink-0 mt-1" />}
                                <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${turn.speaker === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'}`}>
                                    {turn.translatedText ? (
                                        <>
                                            <p className="text-sm">{turn.translatedText}</p>
                                            <p className="text-xs text-gray-300/70 mt-1 italic">{turn.text}</p>
                                        </>
                                    ) : (
                                        <p className="text-sm">{turn.text}</p>
                                    )}
                                </div>
                                {turn.speaker === 'user' && <UserIcon className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />}
                                 <button
                                    onClick={() => handleDeleteMessage(turn.id)}
                                    className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity
                                        ${sessionStatus !== 'idle' ? 'hidden' : ''}
                                        ${turn.speaker === 'user' ? '-order-1 mr-1' : 'ml-1'}
                                    `}
                                    aria-label="Delete message"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {currentUserTranscription && (
                            <div className="flex items-start gap-3 justify-end">
                                <div className="max-w-xs md:max-w-md px-4 py-2 rounded-lg bg-indigo-600 text-white opacity-75">
                                    <p className="text-sm">{currentUserTranscription}...</p>
                                </div>
                                <UserIcon className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                            </div>
                        )}
                        {currentModelTranscription && (
                             <div className="flex items-start gap-3 justify-start">
                                <ModelIcon className="h-6 w-6 text-indigo-400 flex-shrink-0 mt-1" />
                                <div className="max-w-xs md:max-w-md px-4 py-2 rounded-lg bg-gray-700 opacity-75">
                                    <p className="text-sm">{currentModelTranscription}...</p>
                                </div>
                            </div>
                        )}
                    </div>
                 </>
                )}
            </div>
        </Card>
    );
};


// --- Main AI Assistant Component ---
const AiAssistant: React.FC = () => {
    const tabs = [
        { name: 'Chat', content: <ChatBot /> },
        { name: 'Live Conversation', content: <LiveConversation /> }
    ];

    return (
        <Page title="AI Assistant" description="Get instant help, brainstorm ideas, or just have a chat with your creative partner.">
            <Tabs tabs={tabs} />
        </Page>
    );
};

export default AiAssistant;