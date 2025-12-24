import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const Configuration = () => {
    const [apiKeyStatus, setApiKeyStatus] = useState<'IDLE' | 'LINKED' | 'VERIFYING'>('VERIFYING');
    
    // Authentication State (Simulated Security Layer)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authInput, setAuthInput] = useState({ username: '', password: '' });
    const [authError, setAuthError] = useState(false);

    // JSON Service Account State
    const [serviceAccount, setServiceAccount] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setApiKeyStatus(hasKey ? 'LINKED' : 'IDLE');
        } else {
            setApiKeyStatus('IDLE');
        }
    };

    const handleLinkApi = async () => {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            await checkStatus();
        }
    };

    const handleLogin = () => {
        // Simple mock auth for the "Enterprise" feel
        if (authInput.username === 'jucaalgo' && authInput.password === '13470811') {
            setIsAuthenticated(true);
            setAuthError(false);
        } else {
            setAuthError(true);
            setAuthInput(prev => ({ ...prev, password: '' })); 
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    setServiceAccount(json);
                } catch (err) {
                    console.error("Invalid JSON", err);
                    alert("INVALID KEY FILE: CORRUPTED JSON STRUCTURE");
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-white overflow-hidden h-screen flex flex-col">
            <header className="flex-none px-8 py-6 border-b border-border-dark bg-[#111722] z-10 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="p-2 -ml-2 rounded hover:bg-white/10 transition-colors">
                            <span className="material-symbols-outlined text-text-secondary hover:text-white">arrow_back</span>
                        </Link>
                        <h2 className="text-2xl font-bold tracking-tight text-white">System Infrastructure</h2>
                    </div>
                    <p className="text-text-secondary text-sm font-mono pl-10">
                        CLOUD API VAULT & CREDENTIAL MANAGEMENT
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-900/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">dns</span>
                    Google Cloud Vertex AI
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#05070a] flex items-center justify-center">
                <div className="w-full max-w-4xl">
                    
                    {!isAuthenticated ? (
                        // LOCKED STATE
                        <div className="bg-[#0b0f17] border border-[#232f48] rounded-xl p-16 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
                            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(239,68,68,0.03)_10px,rgba(239,68,68,0.03)_20px)] pointer-events-none"></div>
                            
                            <div className="w-full max-w-md bg-[#111722] border border-[#232f48] p-8 rounded-lg shadow-2xl relative z-10 flex flex-col gap-6">
                                <div className="flex flex-col items-center gap-2 mb-4">
                                    <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-2">
                                        <span className="material-symbols-outlined text-4xl">lock</span>
                                    </div>
                                    <h4 className="text-white font-bold tracking-widest uppercase text-lg">Restricted Access</h4>
                                    <p className="text-[#64748b] text-xs font-mono">ENTERPRISE CREDENTIALS REQUIRED</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative group">
                                        <span className="absolute left-3 top-3 text-[#64748b] material-symbols-outlined text-lg">person</span>
                                        <input 
                                            type="text" 
                                            placeholder="IDENTITY" 
                                            className="w-full bg-[#05070a] border border-[#232f48] text-white text-sm pl-10 pr-4 py-3 rounded font-mono focus:border-red-500 focus:outline-none transition-colors uppercase placeholder:text-[#323b49]"
                                            value={authInput.username}
                                            onChange={(e) => setAuthInput({...authInput, username: e.target.value})}
                                            onKeyDown={handleKeyDown}
                                        />
                                    </div>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-3 text-[#64748b] material-symbols-outlined text-lg">key</span>
                                        <input 
                                            type="password" 
                                            placeholder="PASSPHRASE" 
                                            className="w-full bg-[#05070a] border border-[#232f48] text-white text-sm pl-10 pr-4 py-3 rounded font-mono focus:border-red-500 focus:outline-none transition-colors placeholder:text-[#323b49]"
                                            value={authInput.password}
                                            onChange={(e) => setAuthInput({...authInput, password: e.target.value})}
                                            onKeyDown={handleKeyDown}
                                        />
                                    </div>

                                    {authError && (
                                        <div className="text-red-500 text-[10px] font-mono text-center bg-red-500/10 py-2 rounded border border-red-500/20">
                                            ACCESS DENIED: INVALID CREDENTIALS
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleLogin}
                                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-widest py-3 rounded shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 mt-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">fingerprint</span>
                                        Authenticate
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // AUTHENTICATED STATE
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
                            
                            {/* LEFT: JSON UPLOAD ZONE */}
                            <div className="bg-[#111722] border border-[#232f48] rounded-xl overflow-hidden shadow-2xl flex flex-col">
                                <div className="bg-[#161b22] px-6 py-4 border-b border-[#232f48] flex justify-between items-center">
                                    <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-500">description</span>
                                        Service Account Key
                                    </h3>
                                    <span className="text-[10px] bg-[#05070a] border border-[#232f48] px-2 py-1 rounded text-[#92a4c9] font-mono">JSON / GCP</span>
                                </div>
                                
                                <div className="p-6 flex-1 flex flex-col">
                                    {serviceAccount ? (
                                        <div className="flex-1 bg-[#05070a] rounded border border-emerald-500/30 p-4 font-mono text-xs relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <span className="material-symbols-outlined text-6xl text-emerald-500">verified_user</span>
                                            </div>
                                            <div className="space-y-3 relative z-10">
                                                <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-emerald-500/20 pb-2">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    VALID CREDENTIALS
                                                </div>
                                                <div className="grid grid-cols-[80px_1fr] gap-2 text-[#92a4c9]">
                                                    <span className="text-[#64748b]">TYPE:</span>
                                                    <span className="text-white">{serviceAccount.type}</span>
                                                    
                                                    <span className="text-[#64748b]">PROJECT:</span>
                                                    <span className="text-white">{serviceAccount.project_id}</span>
                                                    
                                                    <span className="text-[#64748b]">EMAIL:</span>
                                                    <span className="text-white truncate">{serviceAccount.client_email}</span>
                                                    
                                                    <span className="text-[#64748b]">KEY ID:</span>
                                                    <span className="text-white font-mono">{serviceAccount.private_key_id?.substring(0, 8)}...</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setServiceAccount(null)}
                                                className="absolute bottom-4 right-4 text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest flex items-center gap-1 bg-[#1a2333] px-2 py-1 rounded border border-[#232f48]"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 border-2 border-dashed border-[#232f48] hover:border-emerald-500/50 hover:bg-[#1a2333] rounded transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group min-h-[200px]"
                                        >
                                            <div className="size-16 rounded-full bg-[#05070a] border border-[#232f48] flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                                <span className="material-symbols-outlined text-3xl text-[#64748b] group-hover:text-emerald-500">upload_file</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-white font-bold text-sm tracking-wide">CLICK TO LOAD JSON</p>
                                                <p className="text-[#64748b] text-xs mt-1">Vertex AI Service Account</p>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: API KEY & STATUS */}
                            <div className="flex flex-col gap-8">
                                <div className="bg-[#111722] border border-[#232f48] rounded-xl overflow-hidden shadow-2xl">
                                    <div className="bg-[#161b22] px-6 py-4 border-b border-[#232f48] flex justify-between items-center">
                                        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-500">vpn_key</span>
                                            API Authorization
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-6">
                                        <p className="text-xs text-[#92a4c9] leading-relaxed">
                                            Connect your Google AI Studio API key for immediate access to Gemini 2.0 Flash models. 
                                            Requires billing enabled for High-Res processing.
                                        </p>
                                        
                                        <div className="bg-[#05070a] p-4 rounded border border-[#232f48] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`size-3 rounded-full ${apiKeyStatus === 'LINKED' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 animate-pulse'}`}></div>
                                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                                    {apiKeyStatus === 'LINKED' ? 'Connection Active' : 'Disconnected'}
                                                </span>
                                            </div>
                                            {apiKeyStatus === 'LINKED' && <span className="text-[10px] text-[#64748b] font-mono">ENCRYPTED</span>}
                                        </div>

                                        <button 
                                            onClick={handleLinkApi}
                                            className="w-full py-4 rounded bg-[#1a2333] border border-[#232f48] hover:border-blue-500 hover:text-white text-[#92a4c9] font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">link</span>
                                            {apiKeyStatus === 'LINKED' ? 'Reconnect API Key' : 'Authorize Connection'}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-[#111722] border border-[#232f48] rounded-xl p-6 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-white font-bold text-xs uppercase tracking-wider">Session Security</h4>
                                        <p className="text-[#64748b] text-[10px] mt-1">AUTO-LOGOUT DISABLED</p>
                                    </div>
                                    <button 
                                        onClick={() => { setIsAuthenticated(false); setServiceAccount(null); }}
                                        className="text-red-500 hover:text-white hover:bg-red-500 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors border border-red-500/30"
                                    >
                                        Lock Vault
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Configuration;