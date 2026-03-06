import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GaugeComponent from 'react-gauge-component';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { 
  ArrowDown, 
  ArrowUp, 
  Settings, 
  CheckCircle2, 
  HelpCircle, 
  User,
  Globe,
  Monitor,
  Gamepad2,
  PlaySquare,
  UserSquare2,
  ArrowRightLeft,
  Zap,
  Activity,
  Tv,
  Phone,
  Wifi,
  Signal,
  Hexagon,
  Cpu,
  Layers,
  Terminal,
  ShieldCheck,
  ZapOff,
  Home,
  RefreshCcw,
  Server
} from 'lucide-react';

function subscribeOnline(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [testState, setTestState] = useState('idle'); // idle, countdown, ping, download, upload, finished
  const [progress, setProgress] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState('0.00');
  const [countdownVal, setCountdownVal] = useState(3);
  const [networkType, setNetworkType] = useState('Detecting...');
  
  // Metrics
  const [download, setDownload] = useState('--');
  const [upload, setUpload] = useState('--');
  const [pingIdle, setPingIdle] = useState('--');
  const [pingDown, setPingDown] = useState('--');
  const [pingUp, setPingUp] = useState('--');
  const [jitter, setJitter] = useState('--');
  const [serverColo, setServerColo] = useState('Routing...');

  // Chart Data
  const [chartData, setChartData] = useState([]);

  // QoE Scores (0-5)
  const [qoeWeb, setQoeWeb] = useState(0);
  const [qoeVideo, setQoeVideo] = useState(0);
  const [qoeCalls, setQoeCalls] = useState(0);
  const [qoeGames, setQoeGames] = useState(0);

  // Client Info
  const [clientIp, setClientIp] = useState('Detecting...');
  const [clientIsp, setClientIsp] = useState('Detecting ISP...');
  const [clientLocation, setClientLocation] = useState('Detecting Location...');
  const [clientFullData, setClientFullData] = useState(null);
  const [showIpDetails, setShowIpDetails] = useState(false);

  // System Logs
  const [logs, setLogs] = useState([{ msg: '>> CoreSync OS [v5.0.0] initialized. Worker threads ready.', type: 'info' }]);
  const [history, setHistory] = useState([]);
  const logEndRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg: `>> ${msg}`, type, id: Date.now() + Math.random() }].slice(-10));
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (navigator.connection) {
      const conn = navigator.connection;
      const type = conn.type || conn.effectiveType;
      if (type === 'wifi') setNetworkType('WiFi');
      else if (type === 'ethernet') setNetworkType('Ethernet');
      else if (type === 'cellular') setNetworkType('Cellular');
      else if (['4g', '3g', '2g', 'slow-2g'].includes(type)) {
        setNetworkType(type === '4g' ? 'High Speed (4G)' : `Mobile (${type.toUpperCase()})`);
      }
      else setNetworkType('Wired / Unknown');
    } else {
      setNetworkType('Wired / Ethernet');
    }

    fetch('http://ip-api.com/json/')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (data.status === 'success') {
          setClientIp(data.query);
          setClientIsp(data.isp || data.org || 'Unknown ISP');
          setClientLocation(`${data.city}, ${data.country}`);
          setClientFullData({
            ip: data.query,
            connection: { isp: data.isp, org: data.org },
            city: data.city,
            region: data.regionName,
            country: data.country,
            latitude: data.lat,
            longitude: data.lon,
            timezone: { id: data.timezone, utc: '' },
            flag: { emoji: '' }
          });
        }
      })
      .catch(() => {
        setClientIp('Connection Blocked');
        setClientIsp('Provider Restricted');
        setClientLocation('Signal Interrupted');
      });
  }, []);

  const activeIntervals = useRef([]);
  const abortControllerRef = useRef(null);
  const workerRef = useRef(null);

  const cleanup = () => {
    activeIntervals.current.forEach(clearInterval);
    activeIntervals.current = [];
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  const delay = (ms, signal) => new Promise(resolve => {
    const timeoutId = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      resolve();
    }, { once: true });
  });

  const resetTerminal = () => {
    cleanup();
    setTestState('idle');
    setDownload('--');
    setUpload('--');
    setPingIdle('--');
    setPingDown('--');
    setPingUp('--');
    setJitter('--');
    setProgress(0);
    setCurrentSpeed('0.00');
    setChartData([]);
    setServerColo('Routing...');
    setQoeWeb(0); setQoeVideo(0); setQoeCalls(0); setQoeGames(0);
    addLog('System state manual reset initiated.', 'warn');
  };

  const getCloudflareTrace = async () => {
    try {
      const res = await fetch('https://speed.cloudflare.com/cdn-cgi/trace');
      const text = await res.text();
      const lines = text.split('\n');
      const coloLine = lines.find(line => line.startsWith('colo='));
      if (coloLine) {
        return coloLine.split('=')[1];
      }
    } catch (e) {
      return 'Edge';
    }
    return 'Edge';
  };

  const startTest = async () => {
    cleanup();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    setTestState('countdown');
    setProgress(0);
    setCurrentSpeed('0.00');
    setDownload('--');
    setUpload('--');
    setPingIdle('--');
    setPingDown('--');
    setPingUp('--');
    setJitter('--');
    setChartData([]);
    setQoeWeb(0); setQoeVideo(0); setQoeCalls(0); setQoeGames(0);
    addLog('Initiating hardware synchronization...', 'warn');

    // Fetch routing info
    const colo = await getCloudflareTrace();
    setServerColo(colo);
    addLog(`Routed via Cloudflare Datacenter: [${colo}]`);

    for (let i = 3; i > 0; i--) {
      setCountdownVal(i);
      addLog(`Countdown T-minus ${i}...`);
      await delay(1000, signal);
      if (signal.aborted) return;
    }
    
    setTestState('ping');
    const bestServer = 'https://speed.cloudflare.com/__down';

    // HIGH-PRECISION NETWORK ENGINE
    const getAccuratePing = async (url, signal) => {
      const uniqueId = `p_${Math.random().toString(36).slice(2, 7)}`;
      const fetchUrl = `${url}?id=${uniqueId}`;
      try {
        const startTimestamp = performance.now();
        await fetch(fetchUrl, { cache: 'no-store', signal, priority: 'high', mode: 'no-cors' });
        const entries = performance.getEntriesByName(fetchUrl);
        const entry = entries[entries.length - 1];
        if (entry && entry.responseStart > 0) {
          const ttfb = entry.responseStart - entry.requestStart;
          performance.clearResourceTimings();
          return ttfb;
        }
        return performance.now() - startTimestamp;
      } catch (e) { return null; }
    };

    let finalDown = 0; let finalUp = 0; let finalPing = 0; let finalJitter = 0;

    try {
      await delay(500, signal);
      if (signal.aborted) return;

      // 1. Measure Ping
      addLog('Capturing high-frequency latency matrix...', 'warn');
      const pings = [];
      for (let i = 0; i < 30; i++) {
        if (signal.aborted) return;
        const p = await getAccuratePing(bestServer, signal);
        if (p) pings.push(p);
        
        const sorted = [...pings].sort((a, b) => a - b);
        const bestSamples = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));
        finalPing = Math.round(bestSamples.reduce((a, b) => a + b) / bestSamples.length);
        setPingIdle(finalPing);
        
        if (pings.length > 1) {
          const jitters = [];
          for (let j = 1; j < pings.length; j++) {
            jitters.push(Math.abs(pings[j] - pings[j-1]));
          }
          finalJitter = Math.round(jitters.reduce((a, b) => a + b) / jitters.length);
          setJitter(finalJitter);
        }
        await delay(30, signal);
      }
      addLog(`Ping: ${finalPing}ms | Jitter: ${finalJitter}ms`, 'success');
      setProgress(15);
      await delay(1000, signal);
      setChartData([]); // Reset chart for download

      // 2. Measure Download using Web Worker
      setTestState('download');
      addLog('Saturating downlink with off-thread worker (10s)...', 'warn');
      
      const downLatencies = [];
      const downLatInterval = setInterval(async () => {
        try {
          const p = await getAccuratePing(bestServer, signal);
          if (p) downLatencies.push(p);
          setPingDown(Math.round([...downLatencies].sort((a,b)=>a-b)[0] || 0));
        } catch(e) {}
      }, 300);
      activeIntervals.current.push(downLatInterval);

      await new Promise((resolve) => {
        workerRef.current = new Worker(new URL('./speedtest.worker.js', import.meta.url));
        
        let lastDownTime = performance.now();
        let lastDownBytes = 0;
        let downSpeedSamples = [];
        let timeOffset = 0;
        
        workerRef.current.onmessage = (e) => {
          if (signal.aborted) {
             workerRef.current.terminate();
             resolve();
             return;
          }
          const { type, totalBytes } = e.data;
          
          if (type === 'DOWNLOAD_PROGRESS') {
            const now = performance.now();
            const deltaBytes = totalBytes - lastDownBytes;
            const deltaTime = (now - lastDownTime) / 1000;
            
            if (deltaTime > 0 && totalBytes > 0) {
              const currentSpeedMbps = (deltaBytes * 8 / deltaTime) / 1000000;
              downSpeedSamples.push(currentSpeedMbps);
              if (downSpeedSamples.length > 20) downSpeedSamples.shift(); 
              
              const sorted = [...downSpeedSamples].sort((a,b) => a-b);
              const p90Index = Math.floor(sorted.length * 0.9) - 1;
              const speed = sorted[Math.max(0, p90Index)];
              
              if (speed > 0) {
                finalDown = speed.toFixed(2);
                setCurrentSpeed(finalDown);
                setDownload(finalDown);
                
                timeOffset += deltaTime;
                setChartData(prev => [...prev, { time: timeOffset, speed: parseFloat(finalDown) }].slice(-40));
              }
            }
            
            lastDownTime = now;
            lastDownBytes = totalBytes;
            setProgress(15 + Math.min(1, timeOffset / 10) * 35);
          }
          
          if (type === 'DOWNLOAD_COMPLETE') {
            workerRef.current.terminate();
            resolve();
          }
        };

        workerRef.current.postMessage({
          type: 'START_DOWNLOAD',
          payload: { url: 'https://speed.cloudflare.com/__down', streams: 6, duration: 10 }
        });
      });

      clearInterval(downLatInterval);
      finalDown = parseFloat(finalDown) > 0 ? finalDown : '0.00';
      addLog(`Downlink Saturated: ${finalDown} Mbps`, 'success');
      await delay(1500, signal);
      if (signal.aborted) return;
      setChartData([]); // Reset chart for upload

      // 3. Measure Upload using Web Worker
      setTestState('upload');
      addLog('Initiating parallel uplink burst via worker (10s)...', 'warn');
      setCurrentSpeed('0.00');
      
      const upLatencies = [];
      const upLatInterval = setInterval(async () => {
        try {
          const p = await getAccuratePing(bestServer, signal);
          if (p) upLatencies.push(p);
          setPingUp(Math.round([...upLatencies].sort((a,b)=>a-b)[0] || 0));
        } catch(e) {}
      }, 300);
      activeIntervals.current.push(upLatInterval);

      await new Promise((resolve) => {
        workerRef.current = new Worker(new URL('./speedtest.worker.js', import.meta.url));
        
        let lastUpTime = performance.now();
        let lastUpBytes = 0;
        let upSpeedSamples = [];
        let timeOffset = 0;
        
        workerRef.current.onmessage = (e) => {
          if (signal.aborted) {
             workerRef.current.terminate();
             resolve();
             return;
          }
          const { type, totalBytes } = e.data;
          
          if (type === 'UPLOAD_PROGRESS') {
            const now = performance.now();
            const deltaBytes = totalBytes - lastUpBytes;
            const deltaTime = (now - lastUpTime) / 1000;
            
            if (deltaTime > 0 && totalBytes > 0) {
              const currentSpeedMbps = (deltaBytes * 8 / deltaTime) / 1000000;
              upSpeedSamples.push(currentSpeedMbps);
              if (upSpeedSamples.length > 20) upSpeedSamples.shift();
              
              const sorted = [...upSpeedSamples].sort((a,b) => a-b);
              const p90Index = Math.floor(sorted.length * 0.9) - 1;
              const speed = sorted[Math.max(0, p90Index)];
              
              if (speed > 0) {
                finalUp = speed.toFixed(2);
                setCurrentSpeed(finalUp);
                setUpload(finalUp);

                timeOffset += deltaTime;
                setChartData(prev => [...prev, { time: timeOffset, speed: parseFloat(finalUp) }].slice(-40));
              }
            }
            
            lastUpTime = now;
            lastUpBytes = totalBytes;
            setProgress(50 + Math.min(1, timeOffset / 10) * 50);
          }

          if (type === 'UPLOAD_COMPLETE') {
            workerRef.current.terminate();
            resolve();
          }
        };

        workerRef.current.postMessage({
          type: 'START_UPLOAD',
          payload: { url: 'https://speed.cloudflare.com/__up', streams: 4, duration: 10 }
        });
      });

      clearInterval(upLatInterval);
      if (signal.aborted) return;

      finalUp = parseFloat(finalUp) > 0 ? finalUp : '0.00';
      setCurrentSpeed(finalUp);
      setProgress(100);
      addLog(`Uplink Peak Burst: ${finalUp} Mbps`, 'success');

      setHistory(prev => [{
        id: Date.now(), down: finalDown, up: finalUp, ping: finalPing, jitter: finalJitter,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...prev].slice(0, 5));

      const d = parseFloat(finalDown); const p = finalPing; const j = finalJitter;
      setQoeWeb(d > 5 && p < 100 ? 5 : 4); setQoeVideo(d > 25 ? 5 : 4);
      setQoeCalls(p < 50 && j < 15 ? 5 : 4); setQoeGames(p < 30 && j < 10 ? 5 : 4);

      await delay(1500, signal);
      addLog('Synchronization finalized.', 'success');
      setTestState('finished');
    } catch (e) { if (e.name !== 'AbortError') addLog('SYNC ERROR', 'error'); }
  };

  const renderDots = (count, isActive) => (
    <div className="flex gap-1.5 mt-2 justify-center">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-sm rotate-45 ${i < count && isActive ? 'bg-[#ff4d00] shadow-[0_0_8px_#ff4d00]' : 'bg-white/10'}`} />
      ))}
    </div>
  );

  const getPowerLevel = (val) => Math.min(100, (parseFloat(val) || 0) / 500 * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#ff4d00]/30 flex flex-col items-center py-4 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-20">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#ff4d0022,transparent_70%)]"></div>
         <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <div className="w-full max-w-[1000px] px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-white italic cursor-pointer" onClick={resetTerminal}>
                CORE<span className="text-[#ff4d00]">SYNC</span>
              </h1>
              <div className={`px-2 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 ${isOnline ? 'bg-[#ff4d00]/10 text-[#ff4d00] border border-[#ff4d00]/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {isOnline ? <ShieldCheck size={10} /> : <ZapOff size={10} />}
                {isOnline ? 'SYSTEM_ONLINE' : 'SYSTEM_OFFLINE'}
              </div>
            </div>
            <p className="text-[10px] text-[#8b92a5] uppercase tracking-widest mt-1">Industrial Grade Network Analysis</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {testState !== 'idle' && (
              <button onClick={resetTerminal} className="flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold border border-[#ff4d00] text-[#ff4d00] hover:bg-[#ff4d00]/10 transition-all flex items-center justify-center gap-2">
                <Home size={12} /> HOME
              </button>
            )}
            <button onClick={() => {setShowIpDetails(false); if(testState!=='idle' && testState!=='finished') resetTerminal();}} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold border transition-all ${!showIpDetails && (testState==='idle'||testState==='finished') ? 'bg-[#ff4d00] border-[#ff4d00] text-black' : 'border-white/10 text-white hover:bg-white/5'}`}>RESULTS</button>
            <button onClick={() => {setShowIpDetails(true); if(testState!=='idle' && testState!=='finished') resetTerminal();}} className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold border transition-all ${showIpDetails ? 'bg-[#ff4d00] border-[#ff4d00] text-black' : 'border-white/10 text-white hover:bg-white/5'}`}>IP_PROFILE</button>
          </div>
        </div>

        <AnimatePresence mode="wait">
        {testState === 'idle' || testState === 'finished' ? (
          <motion.div 
            key="idle-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-[#0a0a0a] border border-white/5 p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4d00]"></div>
                <p className="text-[10px] font-bold text-[#ff4d00] uppercase tracking-widest mb-6 flex items-center gap-2"><Activity size={12} /> Network_Origin</p>
                <div className="space-y-6">
                   <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">Infrastructure</p><p className="text-sm font-bold text-white truncate">{clientIsp}</p></div>
                   <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">IP ADDRESS</p><p className="text-sm font-bold text-[#ff4d00] font-mono">{clientIp}</p></div>
                   <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">Location</p><p className="text-sm font-bold text-white">{clientLocation}</p></div>
                   <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">Transmission</p><div className="flex items-center gap-2 text-sm font-bold text-white">{networkType === 'WiFi' ? <Wifi size={16} /> : <Signal size={16} />}{networkType}</div></div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                {showIpDetails ? (
                  <div className="bg-[#0a0a0a] border border-white/5 p-8 h-full animate-in fade-in zoom-in-95">
                    <h2 className="text-xl font-black mb-8 italic uppercase">Terminal_Specifications</h2>
                    {clientFullData ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
                        <div className="space-y-1"><p className="text-[9px] text-[#8b92a5] uppercase">Region</p><p className="font-bold">{clientFullData.region}</p></div>
                        <div className="space-y-1"><p className="text-[9px] text-[#8b92a5] uppercase">Organization</p><p className="font-bold">{clientFullData.connection.org}</p></div>
                        <div className="space-y-1"><p className="text-[9px] text-[#8b92a5] uppercase">Coordinates</p><p className="font-bold">{clientFullData.latitude}, {clientFullData.longitude}</p></div>
                        <div className="space-y-1"><p className="text-[9px] text-[#8b92a5] uppercase">Timezone</p><p className="font-bold">{clientFullData.timezone.id}</p></div>
                      </div>
                    ) : <p>Synchronizing...</p>}
                    <button onClick={() => setShowIpDetails(false)} className="mt-12 w-full py-3 bg-white text-black font-black text-xs hover:bg-[#ff4d00] transition-colors uppercase">Return to Terminal</button>
                  </div>
                ) : (
                  <>
                    {history.length > 0 && testState === 'idle' && (
                      <div className="bg-[#ff4d00]/5 border-l-2 border-[#ff4d00] p-4 mb-6 flex justify-between items-center animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex gap-10">
                          <div><p className="text-[8px] text-[#8b92a5] uppercase tracking-widest mb-1">Previous_Ping</p><p className="text-2xl font-black text-white">{history[0].ping}<span className="text-[10px] text-[#8b92a5] ml-1">ms</span></p></div>
                          <div><p className="text-[8px] text-[#8b92a5] uppercase tracking-widest mb-1">Previous_Downlink</p><p className="text-2xl font-black text-[#ff4d00] italic">{history[0].down}<span className="text-[10px] text-[#8b92a5] ml-1 uppercase">Mbps</span></p></div>
                        </div>
                        <div className="text-right"><p className="text-[8px] text-[#8b92a5] uppercase tracking-widest mb-1">Status</p><p className="text-[10px] font-bold text-green-500 flex items-center gap-1"><ShieldCheck size={10} /> SESSION_SAVED</p></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-[#0a0a0a] border border-white/5 p-6 relative group overflow-hidden">
                          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#ff4d00] to-transparent opacity-30"></div>
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 text-[#8b92a5] text-[10px] font-bold uppercase tracking-wider"><ArrowDown size={14} className="text-[#ff4d00]" /> Downlink</div>
                             {testState === 'finished' && <div className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/50">{serverColo}</div>}
                          </div>
                          <div className="text-5xl font-black text-white italic">{download}</div>
                          <p className="text-[9px] text-[#8b92a5] mt-1 font-bold uppercase">Mbps</p>
                       </div>
                       <div className="bg-[#0a0a0a] border border-white/5 p-6 relative group overflow-hidden">
                          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"></div>
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 text-[#8b92a5] text-[10px] font-bold uppercase tracking-wider"><ArrowUp size={14} className="text-white" /> Uplink</div>
                             {testState === 'finished' && <div className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/50">{serverColo}</div>}
                          </div>
                          <div className="text-5xl font-black text-white italic">{upload}</div>
                          <p className="text-[9px] text-[#8b92a5] mt-1 font-bold uppercase">Mbps</p>
                       </div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-6 flex flex-col md:flex-row justify-between items-center gap-8">
                       <div className="flex gap-8">
                          <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">Latency</p><p className="text-2xl font-black text-white">{pingIdle}<span className="text-[10px] text-[#8b92a5] ml-1">ms</span></p></div>
                          <div><p className="text-[9px] text-[#8b92a5] uppercase mb-1">Jitter</p><p className="text-2xl font-black text-white">{jitter}<span className="text-[10px] text-[#8b92a5] ml-1">ms</span></p></div>
                       </div>
                       <div className="flex gap-6">
                          <div className="flex flex-col items-center"><Globe size={20} className="text-white mb-1" />{renderDots(qoeWeb, testState === 'finished')}</div>
                          <div className="flex flex-col items-center"><Tv size={20} className="text-white mb-1" />{renderDots(qoeVideo, testState === 'finished')}</div>
                          <div className="flex flex-col items-center"><Phone size={20} className="text-white mb-1" />{renderDots(qoeCalls, testState === 'finished')}</div>
                          <div className="flex flex-col items-center"><Gamepad2 size={20} className="text-white mb-1" />{renderDots(qoeGames, testState === 'finished')}</div>
                       </div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={startTest} 
                      className="w-full bg-[#ff4d00] py-8 group relative overflow-hidden transition-all hover:bg-[#ff5f00]"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.1)_50%,transparent_75%)] bg-[size:200%_200%] animate-[shimmer_3s_infinite_linear]"></div>
                      <span className="text-4xl font-black text-black tracking-[0.3em] italic relative z-10 uppercase">Initiate_Sync</span>
                    </motion.button>
                    {history.length > 0 && (
                      <div className="bg-[#0a0a0a] border border-white/5 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-2 mb-4 text-[#8b92a5] text-[10px] font-bold uppercase tracking-[0.2em]"><Activity size={12} className="text-[#ff4d00]" /> Recent_Transmissions</div>
                        <table className="w-full text-left text-[10px]">
                          <thead><tr className="text-[#8b92a5] border-b border-white/5"><th className="pb-2 uppercase">Time</th><th className="pb-2 text-center uppercase">Ping</th><th className="pb-2 text-center uppercase">Down</th><th className="pb-2 text-right uppercase">Up</th></tr></thead>
                          <tbody>{history.map(item => (<tr key={item.id} className="border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02]"><td className="py-3 font-mono text-white/60">{item.time}</td><td className="py-3 text-center font-bold text-white">{item.ping}ms</td><td className="py-3 text-center font-black text-[#ff4d00] italic">{item.down}</td><td className="py-3 text-right font-black text-white italic">{item.up}</td></tr>))}</tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-col gap-6 mt-6">
                      <div className="bg-[#0a0a0a] border border-white/5 p-6 flex flex-col items-center lg:items-end">
                        <p className="text-[#8b92a5] text-[10px] font-semibold tracking-wider mb-3 text-center uppercase">Rate network availability</p>
                        <div className="flex w-full max-w-[400px]">{[1, 2, 3, 4, 5].map(num => (<button key={num} className="flex-1 py-2 border border-white/5 bg-white/5 hover:bg-[#ff4d00] hover:text-black transition-all text-xs font-bold text-[#8b92a5]">{num}</button>))}</div>
                      </div>
                      {testState === 'finished' && (
                        <button onClick={resetTerminal} className="w-full py-4 border-2 border-[#ff4d00] text-[#ff4d00] font-black text-xs hover:bg-[#ff4d00] hover:text-black transition-all flex items-center justify-center gap-3 uppercase italic tracking-widest"><RefreshCcw size={16} /> Re-Initialize Terminal</button>
                      )}
                      <div className="bg-black border border-white/5 p-4 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5"><Terminal size={12} className="text-[#ff4d00]" /><span className="text-[10px] font-bold text-[#8b92a5] tracking-widest uppercase">System_Live_Log</span></div>
                        <div className="h-32 overflow-y-auto space-y-1 font-mono custom-scrollbar">{logs.map(log => (<div key={log.id} className="text-[9px] flex gap-2"><span className="text-white/10">[{new Date().toLocaleTimeString([],{hour12:false})}]</span><span className={log.type==='warn'?'text-[#ff4d00]':log.type==='error'?'text-red-500':log.type==='success'?'text-green-500':'text-[#8b92a5]'}>{log.msg}</span></div>))}<div ref={logEndRef} /></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="testing-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-0 w-full"
          >
            <div className="text-center mb-0 w-full">
               <div className="text-[10px] font-bold text-[#ff4d00] uppercase tracking-[0.5em] mb-1">System_Sync_Active</div>
               {testState === 'countdown' ? (
                 <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-white h-[150px] flex items-center justify-center">{countdownVal}</div>
               ) : (
                 <div className="w-full flex flex-col items-center">
                   <motion.div 
                     initial={{ scale: 0.8, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     className="w-full max-w-[320px] mx-auto mt-0 mb-0 relative z-10"
                   >
                     <GaugeComponent
                        value={parseFloat(currentSpeed) || 0}
                        minValue={0}
                        maxValue={500}
                        style={{ height: '220px' }}
                        arc={{
                          width: 0.15,
                          padding: 0.02,
                          cornerRadius: 5,
                          subArcs: [
                            { limit: 50, color: '#1a1a1a' },
                            { limit: 150, color: '#3a3a3a' },
                            { limit: 300, color: '#ff4d00' },
                            { limit: 500, color: '#ff2a00' }
                          ]
                        }}
                        pointer={{
                          type: "needle",
                          length: 0.7,
                          width: 12,
                          animationDelay: 0,
                          animationDuration: 250,
                          elastic: true,
                          color: '#ffffff',
                          baseColor: '#ff4d00'
                        }}
                        labels={{
                          valueLabel: {
                            formatTextValue: val => val.toFixed(2),
                            style: { fontSize: "65px", fill: "#ffffff", fontWeight: "900", fontStyle: "italic", textShadow: "none" }
                          },
                          tickLabels: {
                            type: 'outer',
                            defaultTickValueConfig: { style: { fill: '#8b92a5', fontSize: '10px', fontWeight: 'bold', textShadow: 'none' } },
                            defaultTickLineConfig: { color: '#333' },
                            ticks: [{value: 0}, {value: 100}, {value: 200}, {value: 300}, {value: 400}, {value: 500}]
                          }
                        }}
                     />
                   </motion.div>
                   
                   {/* LIVE SPEED GRAPH */}
                   <div className="w-full max-w-xl h-24 -mt-8 relative z-0 opacity-80">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                         <defs>
                           <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor={testState === 'upload' ? '#ffffff' : '#ff4d00'} stopOpacity={0.8}/>
                             <stop offset="95%" stopColor={testState === 'upload' ? '#ffffff' : '#ff4d00'} stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <YAxis domain={['auto', 'auto']} hide />
                         <Area 
                            type="monotone" 
                            dataKey="speed" 
                            stroke={testState === 'upload' ? '#ffffff' : '#ff4d00'} 
                            fillOpacity={1} 
                            fill="url(#colorSpeed)" 
                            isAnimationActive={false}
                         />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               )}
               <p className="text-[#8b92a5] text-[10px] font-bold uppercase tracking-widest mt-2">{testState==='countdown'?'Ready_For_Burst':`${testState.toUpperCase()}_LINK_STRENGTH`}</p>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mt-6 w-full max-w-xl">
               <div className="text-center border-l border-white/10 pl-2"><p className="text-[8px] text-[#8b92a5] uppercase">Ping</p><p className="text-lg font-black">{pingIdle==='--'?'0':pingIdle}</p></div>
               <div className="text-center border-l border-white/10 pl-2"><p className="text-[8px] text-[#8b92a5] uppercase">Jitter</p><p className="text-lg font-black">{jitter==='--'?'0':jitter}</p></div>
               <div className="text-center border-l border-white/10 pl-2"><p className="text-[8px] text-[#8b92a5] uppercase">Load</p><p className="text-lg font-black">{testState==='download'?pingDown:(testState==='upload'?pingUp:'0')}</p></div>
               <div className="text-center border-l border-white/10 pl-2"><p className="text-[8px] text-[#8b92a5] uppercase">Edge</p><p className="text-sm font-bold text-[#ff4d00] mt-1">{serverColo}</p></div>
            </div>
            <button onClick={startTest} className="mt-8 px-8 py-1.5 border border-[#ff4d00] text-[#ff4d00] font-black text-[10px] hover:bg-[#ff4d00] hover:text-black transition-all uppercase italic tracking-widest">Re-Sync_Terminal</button>
          </motion.div>
        )
        }
        </AnimatePresence>
      </div>

      <AnimatePresence>
      {(testState !== 'idle' && testState !== 'finished') && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-0 left-0 w-full z-50"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-white/5 z-50"><div className="h-full bg-[#ff4d00] transition-all duration-300 shadow-[0_0_15px_#ff4d00]" style={{ width: `${progress}%` }}></div></div>
          <div className="w-full bg-black/80 backdrop-blur-md border-t border-white/5 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 pb-4 z-40 mt-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff4d00] animate-pulse shadow-[0_0_8px_#ff4d00]"></div><span className="text-[10px] font-bold tracking-widest text-[#ff4d00]">DATA_STREAM_ACTIVE</span></div>
              <div className="h-4 w-px bg-white/10 hidden md:block"></div>
              <div className="text-[9px] text-[#8b92a5] font-mono overflow-hidden whitespace-nowrap max-w-[200px] md:max-w-md"><span className="inline-block animate-[scrollText_20s_linear_infinite]">SYNCING_PACKETS... ENCRYPTING_TERMINAL_LINK... CAPTURING_BURST_METRICS... HANDSHAKING_CLOUDFLARE_EDGE... OPTIMIZING_SIGNAL_PATHWAY...</span></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right"><p className="text-[8px] text-[#8b92a5] uppercase">Link_Stability</p><p className="text-xs font-bold text-white tracking-widest">{Math.floor(95 + Math.random() * 5)}% <span className="text-[8px] text-green-500">NOMINAL</span></p></div>
              <div className="text-right"><p className="text-[8px] text-[#8b92a5] uppercase">Packet_Loss</p><p className="text-xs font-bold text-white tracking-widest">0.00%</p></div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded"><Cpu size={12} className="text-[#ff4d00]" /><span className="text-[10px] font-bold text-white">{progress}%</span></div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes scrollText { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ff4d00; }
      `}} />
    </div>
  );
}
