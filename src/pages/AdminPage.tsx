import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Stream, StreamStatus, CATEGORIES } from "../constants";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Info, Calendar, Radio, Trash2, StopCircle, Video, Settings, Camera, Mic, MicOff, CameraOff, MonitorPlay, Activity, Globe, Users, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Peer from "peerjs";
import { cn } from "../lib/utils";

export default function AdminPage({ user }: { user: any }) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeStream, setActiveStream] = useState<Stream | null>(null);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startTime, setStartTime] = useState("");

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [broadcastingType, setBroadcastingType] = useState<"camera" | "screen">("camera");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Hardcoded Admin Check
    if (user.email !== "admin@geosport.ge") {
      navigate("/");
      return;
    }

    fetchStreams();
    return () => stopBroadcasting();
  }, [user]);

  async function fetchStreams() {
    setLoading(true);
    const { data } = await supabase
      .from('streams')
      .select('*')
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setStreams(data);
    setLoading(false);
  }

  async function handleCreateStream(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase
      .from('streams')
      .insert({
        title,
        description,
        category,
        start_time: startTime || new Date().toISOString(),
        status: StreamStatus.SCHEDULED,
        admin_id: user.id,
        viewers_count: 0
      })
      .select().single();

    if (data) {
      setStreams([data, ...streams]);
      setIsCreating(false);
      setTitle("");
      setDescription("");
    }
  }

  async function startBroadcasting(stream: Stream, type: "camera" | "screen" = "camera") {
    try {
      let mediaStream: MediaStream;
      
      if (type === "screen") {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
          audio: true,
          video: { cursor: "always" } as any
        });
        
        // If system audio is not shared, we might want to also get mic audio
        if (mediaStream.getAudioTracks().length === 0) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.getAudioTracks().forEach(track => mediaStream.addTrack(track));
          } catch(e) {
            console.log("Mic access denied or not available for screen share");
          }
        }
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      setBroadcastingType(type);
      streamRef.current = mediaStream;
      if (videoRef.current) videoRef.current.srcObject = mediaStream;

      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', async (id) => {
        await supabase.from('streams').update({ peer_id: id, status: StreamStatus.LIVE }).eq('id', stream.id);
        setActiveStream({ ...stream, status: StreamStatus.LIVE, peer_id: id });
        setIsBroadcasting(true);
        fetchStreams();
      });

      peer.on('call', (call) => call.answer(mediaStream));

      // Handle stream end (especially for screen share "Stop Sharing" button)
      mediaStream.getVideoTracks()[0].onended = () => {
        stopBroadcasting();
      };

    } catch (err) {
      alert("მოწყობილობაზე წვდომა ვერ მოხერხდა.");
      console.error(err);
    }
  }

  async function stopBroadcasting() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (activeStream) {
      await supabase.from('streams').update({ status: StreamStatus.ENDED }).eq('id', activeStream.id);
      setActiveStream(null);
    }
    setIsBroadcasting(false);
    fetchStreams();
  }

  return (
    <div className="max-w-screen-2xl mx-auto space-y-8 h-full flex flex-col">
      {/* Admin Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 text-blue-400 font-black uppercase text-[10px] tracking-widest">
            <Shield className="w-3 h-3" />
            <span>Administrator Control Logic</span>
          </div>
          <h1 className="text-4xl font-black italic uppercase tracking-tight">Main Console</h1>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic px-8 py-3 rounded text-xs transition-all shadow-xl shadow-red-950/20 tracking-tighter"
        >
          Initialize New Signal
        </button>
      </div>

      {isBroadcasting && activeStream ? (
        <div className="flex-1 grid grid-cols-12 gap-px bg-slate-800 border border-slate-800 rounded overflow-hidden shadow-2xl">
          {/* Main Preview Window */}
          <div className="col-span-12 lg:col-span-8 bg-[#0A0A0A] relative flex flex-col min-h-[400px]">
            <div className="absolute top-4 left-4 z-10 bg-black/60 px-2 py-1 text-[8px] border border-white/20 uppercase tracking-tighter font-black flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              PGM OUT: {broadcastingType === "screen" ? "SCREEN" : "LIVE FEED"}
            </div>
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 to-black">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover grayscale-[0.2]" />
              
              {/* Overlay Overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-red-950/50">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span>BROADCASTING</span>
                </div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button onClick={() => { if(streamRef.current) { streamRef.current.getAudioTracks()[0].enabled = !isMicOn; setIsMicOn(!isMicOn); }}} className={cn("p-3 rounded border border-white/10 backdrop-blur-md transition-all", isMicOn ? "bg-white/10" : "bg-red-600 text-white")}>
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                {broadcastingType === "camera" && (
                  <button onClick={() => { if(streamRef.current) { streamRef.current.getVideoTracks()[0].enabled = !isCamOn; setIsCamOn(!isCamOn); }}} className={cn("p-3 rounded border border-white/10 backdrop-blur-md transition-all", isCamOn ? "bg-white/10" : "bg-red-600 text-white")}>
                    {isCamOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  </button>
                )}
                {broadcastingType === "screen" && (
                  <div className="p-3 rounded border border-blue-500/50 bg-blue-500/20 text-blue-400 backdrop-blur-md">
                    <MonitorPlay className="w-5 h-5" />
                  </div>
                )}
                <button onClick={stopBroadcasting} className="bg-white text-black p-3 rounded hover:bg-red-600 hover:text-white transition-all shadow-xl">
                  <StopCircle className="w-7 h-7" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Stats & Moderation */}
          <div className="col-span-12 lg:col-span-4 bg-[#16191E] flex flex-col border-l border-slate-800">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#1A1D23]">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Stream Health & Analytics</h3>
              <span className="text-[9px] font-mono text-slate-400">ID: {activeStream.peer_id}</span>
            </div>
            
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div>
                <span className="text-[9px] font-black text-slate-600 uppercase mb-3 block">Performance</span>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500 uppercase">Input Latency</span>
                    <span className="text-green-400">0.08s</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[94%]" />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500 uppercase">Viewership Hub</span>
                    <span className="text-blue-400">{activeStream.viewers_count} Active</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-black text-slate-600 uppercase mb-3 block">Signal Details</span>
                <div className="bg-black/20 p-4 border border-slate-800 rounded font-mono text-[10px] space-y-2">
                  <div className="text-slate-400 uppercase tracking-tighter">Event: {activeStream.title}</div>
                  <div className="text-slate-400 uppercase tracking-tighter">Cat: {activeStream.category}</div>
                  <div className="text-slate-500 italic mt-2 line-clamp-3">{activeStream.description}</div>
                </div>
              </div>

              <div className="p-4 bg-red-900/10 border border-red-900/20 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-red-500" />
                  <span className="text-[9px] font-black text-red-500 uppercase">Critical Warnings</span>
                </div>
                <div className="text-[10px] text-red-100 font-medium">No signal drops detected in last 5 minutes.</div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0C0E12]">
              <div className="flex gap-2">
                 <div className="flex-1 px-3 py-2 bg-black/40 border border-slate-800 text-[10px] uppercase font-mono text-slate-500">
                    Broadcasting in Standard HD
                 </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
             [1,2,3,4].map(i => <div key={i} className="aspect-video bg-white/5 animate-pulse rounded border border-slate-800" />)
          ) : streams.map((stream) => (
            <div key={stream.id} className="bg-[#1A1D23] border border-slate-800 rounded p-5 flex flex-col group hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border",
                  stream.status === StreamStatus.LIVE ? "bg-red-600/20 text-red-500 border-red-500/30" : 
                  stream.status === StreamStatus.SCHEDULED ? "bg-blue-600/20 text-blue-500 border-blue-500/30" : "bg-slate-800 text-slate-500 border-slate-700"
                )}>
                  {stream.status}
                </div>
                <button className="text-slate-600 hover:text-slate-200"><Settings className="w-4 h-4" /></button>
              </div>
              <h3 className="text-sm font-black uppercase italic tracking-tight mb-4 group-hover:text-red-500 transition-colors line-clamp-1">{stream.title}</h3>
              <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between font-mono text-[9px] uppercase tracking-tighter text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(stream.start_time).toLocaleDateString()}</span>
                </div>
                {stream.status !== StreamStatus.ENDED && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => startBroadcasting(stream, "camera")}
                        className="bg-white text-black px-3 py-1 rounded text-[9px] font-black hover:bg-red-600 hover:text-white transition-all uppercase flex items-center gap-1"
                        title="Start Camera Stream"
                      >
                        <Camera className="w-3 h-3" />
                        Cam
                      </button>
                      <button 
                        onClick={() => startBroadcasting(stream, "screen")}
                        className="bg-slate-800 text-white px-3 py-1 rounded text-[9px] font-black hover:bg-blue-600 transition-all uppercase flex items-center gap-1"
                        title="Start Screen Share"
                      >
                        <MonitorPlay className="w-3 h-3" />
                        Screen
                      </button>
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initialize Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreating(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-[#16191E] border border-slate-700 rounded p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600" />
              <h2 className="text-xl font-black uppercase italic mb-8 tracking-tighter">Signal Initialization Form</h2>
              
              <form onSubmit={handleCreateStream} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Event Target Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="MATCH ID / TEAM NAMES" className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Data Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase appearance-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Target Epoch</label>
                    <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Metadata / Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase resize-none" placeholder="ADDITIONAL LOGS..." />
                </div>

                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase italic py-4 rounded transition-all shadow-xl shadow-red-950/20 text-xs tracking-[0.2em]">
                  Save Configuration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
