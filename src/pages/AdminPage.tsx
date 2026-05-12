import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Stream, StreamStatus, CATEGORIES } from "../constants";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Info, Calendar, Radio, Trash2, StopCircle, Video, Settings, Camera, Mic, MicOff, CameraOff, MonitorPlay, Activity, Globe, Users, Shield, Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, Track, createLocalVideoTrack, createLocalAudioTrack } from "livekit-client";
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
  const roomRef = useRef<Room | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [broadcastingType, setBroadcastingType] = useState<"camera" | "screen">("screen");
  const [selectedSource, setSelectedSource] = useState<"camera" | "screen">("screen");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    const adminEmails = ["admin@geosport.ge", "geotowng@gmail.com"];
    if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
      navigate("/");
      return;
    }

    fetchStreams();
    return () => {
      stopBroadcasting();
    };
  }, [user]);

  async function fetchStreams() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setStreams(data);
    } catch (e) {
      console.error("Fetch streams failed:", e);
    }
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

  async function switchSource(type: "camera" | "screen") {
    if (!isBroadcasting || !roomRef.current) return;
    
    try {
      if (type === "screen") {
        await roomRef.current.localParticipant.setCameraEnabled(false);
        await roomRef.current.localParticipant.setScreenShareEnabled(true, { audio: true });
      } else {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
        await roomRef.current.localParticipant.setCameraEnabled(true);
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      }

      setBroadcastingType(type);
      setSelectedSource(type);

      // Re-attach preview
      if (videoRef.current) {
        const videoTrack = Array.from(roomRef.current.localParticipant.videoTrackPublications.values())[0]?.videoTrack as LocalVideoTrack;
        if (videoTrack) {
          videoTrack.attach(videoRef.current);
        }
      }
    } catch (err) {
      console.error("Source switch failed:", err);
    }
  }

  async function startBroadcasting(stream: Stream, type: "camera" | "screen" = "camera") {
    try {
      const roomName = `stream-${stream.id}`;
      const participantName = `broadcaster-${user.id}`;

      // 1. Get token
      const tokenResponse = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName, isBroadcaster: true }),
      });
      
      const { token } = await tokenResponse.json();
      if (!token) throw new Error("Failed to get token");

      // 2. Connect to Room
      const room = new Room();
      roomRef.current = room;
      
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) throw new Error("VITE_LIVEKIT_URL not configured");

      await room.connect(livekitUrl, token);
      console.log("Connected to LiveKit room:", room.name);

      // 3. Enable tracks
      if (type === "screen") {
        await room.localParticipant.setScreenShareEnabled(true, { audio: true });
      } else {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      // 4. Update UI
      setBroadcastingType(type);
      setSelectedSource(type);
      setIsBroadcasting(true);
      
      // Update DB
      const { data: updatedData } = await supabase.from('streams').update({ 
        status: StreamStatus.LIVE,
        updated_at: new Date().toISOString()
      }).eq('id', stream.id).select().single();
      
      if (updatedData) {
        setActiveStream(updatedData);
        fetchStreams();
      }

      // Preview locally
      if (videoRef.current) {
        // Wait a bit for tracks to be published
        setTimeout(() => {
          const videoTrack = Array.from(room.localParticipant.videoTrackPublications.values())[0]?.videoTrack as LocalVideoTrack;
          if (videoTrack) {
            videoTrack.attach(videoRef.current!);
          }
        }, 500);
      }

    } catch (err) {
      alert("LiveKit Connection Failed. Check console for details.");
      console.error(err);
      stopBroadcasting();
    }
  }

  async function stopBroadcasting() {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (activeStream) {
      await supabase.from('streams').update({ status: StreamStatus.ENDED }).eq('id', activeStream.id);
      setActiveStream(null);
    }
    setIsBroadcasting(false);
    fetchStreams();
  }

  async function handleQuickLive(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    
    try {
      const { data, error } = await supabase
        .from('streams')
        .insert({
          title,
          description: `Quick transmission via ${selectedSource}`,
          category: CATEGORIES[0],
          start_time: new Date().toISOString(),
          status: StreamStatus.SCHEDULED,
          admin_id: user.id,
          viewers_count: 0
        })
        .select().single();

      if (error) throw error;

      if (data) {
        setStreams(prev => [data, ...prev]);
        // Immediately start broadcasting with the selected source
        setTimeout(() => {
          startBroadcasting(data, selectedSource);
        }, 100);
        setTitle("");
      }
    } catch (error: any) {
      console.error("Live start error:", error);
      if (error.message?.includes("cache")) {
        alert("მონაცემთა ბაზა ახლდება. გთხოვთ დაარეფრეშოთ გვერდი და სცადოთ ხელახლა.");
      } else {
        alert("შეცდომა: " + error.message);
      }
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto space-y-8 h-full flex flex-col">
      {!isBroadcasting && (
        <div className="space-y-6">
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
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase italic px-6 py-3 rounded text-[10px] transition-all border border-slate-700 tracking-tighter"
            >
              Advanced Setup
            </button>
          </div>

          {/* Quick Start Panel: Mission Control Style */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-[#111418] border border-white/5 rounded-2xl overflow-hidden">
              {/* Technical Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-[#16191E] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Telemetry: Ready</span>
                  </div>
                  <div className="h-4 w-px bg-white/10" />
                  <div className="flex items-center gap-2">
                    <Database className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Hub_Link: Active</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 bg-black/40 border border-white/5 rounded text-[9px] font-mono text-slate-500 uppercase italic">
                    Lat: 0.00ms
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row items-end gap-6 relative z-10">
                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Transmission Identity</label>
                      <span className="text-[9px] font-mono text-slate-600 uppercase">Auto-Generated UUID [REQ]</span>
                    </div>
                    <div className="relative group-input">
                      <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="ENTER EVENT TITLE (E.G. CHAMPIONS LEAGUE FINAL)" 
                        className="w-full bg-black/60 border border-white/10 rounded-xl py-5 px-8 text-white font-mono text-sm uppercase focus:outline-none focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all placeholder:text-slate-700"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-white/5 border border-white/5 rounded">
                        <Activity className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleQuickLive}
                    disabled={!title}
                    className="group/btn relative overflow-hidden bg-red-600 hover:bg-red-700 disabled:opacity-20 disabled:grayscale text-white font-black uppercase italic px-12 py-5 rounded-xl text-xs transition-all shadow-2xl shadow-red-950/40 tracking-tighter flex items-center gap-4 whitespace-nowrap active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                    <Radio className="w-5 h-5 animate-pulse" />
                    <span>Initialize Field Signal & Go Live</span>
                    <Plus className="w-4 h-4 opacity-40 group-hover/btn:rotate-90 transition-transform" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button 
                    type="button"
                    onClick={() => setSelectedSource("screen")}
                    className={cn(
                      "p-4 border rounded-lg flex items-center gap-4 group/item transition-all text-left",
                      selectedSource === "screen" ? "bg-red-600/10 border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.15)]" : "bg-black/40 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-lg transition-colors",
                      selectedSource === "screen" ? "bg-red-600/20" : "bg-white/5 group-hover/item:bg-white/10"
                    )}>
                      <MonitorPlay className={cn("w-5 h-5", selectedSource === "screen" ? "text-red-500" : "text-slate-400")} />
                    </div>
                    <div>
                      <h4 className={cn("text-[10px] font-black uppercase", selectedSource === "screen" ? "text-white" : "text-slate-400")}>Desktop Capture</h4>
                      <p className="text-[9px] font-mono text-slate-600">Primary Source</p>
                    </div>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedSource("camera")}
                    className={cn(
                      "p-4 border rounded-lg flex items-center gap-4 group/item transition-all text-left",
                      selectedSource === "camera" ? "bg-blue-600/10 border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.15)]" : "bg-black/40 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-lg transition-colors",
                      selectedSource === "camera" ? "bg-blue-600/20" : "bg-white/5 group-hover/item:bg-white/10"
                    )}>
                      <Camera className={cn("w-5 h-5", selectedSource === "camera" ? "text-blue-500" : "text-slate-400")} />
                    </div>
                    <div>
                      <h4 className={cn("text-[10px] font-black uppercase", selectedSource === "camera" ? "text-white" : "text-slate-400")}>Global Relay</h4>
                      <p className="text-[9px] font-mono text-slate-600">Camera Feed</p>
                    </div>
                  </button>
                  <div className="p-4 bg-black/20 border border-white/5 border-dashed rounded-lg flex items-center gap-4 opacity-50 cursor-not-allowed">
                     <div className="p-3 bg-slate-800 rounded-lg">
                        <Settings className="w-5 h-5 text-slate-500" />
                     </div>
                     <div>
                        <h4 className="text-[10px] font-black uppercase text-slate-500">Auto-Moderation</h4>
                        <p className="text-[9px] font-mono text-slate-700">Enterprise Only</p>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBroadcasting && activeStream ? (
        <div className="flex-1 grid grid-cols-12 gap-px bg-slate-800 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[600px]">
          <div className="col-span-12 lg:col-span-8 bg-[#0A0A0A] relative flex flex-col">
            <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
              <div className="bg-black/80 backdrop-blur-xl px-4 py-2 border border-white/10 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                  SIGNAL LIVE: {broadcastingType === "screen" ? "DESKTOP_CAPTURE" : "CAM_FEED_01"}
                </span>
                <div className="h-3 w-px bg-white/20 mx-1" />
                <span className="text-[10px] font-mono text-slate-400">FPS: 60 / 1080p</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-black/80 backdrop-blur-xl px-4 py-2 border border-white/10 rounded-full flex items-center gap-2">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black text-white">{activeStream.viewers_count}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-950 via-black to-slate-900">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
                <div className="bg-black/60 backdrop-blur-3xl border border-white/10 p-2 rounded-2xl flex items-center justify-between shadow-2xl">
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    <button 
                      onClick={() => switchSource("camera")}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2",
                        broadcastingType === "camera" ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                      )}
                    >
                      <Camera className="w-4 h-4" />
                      <span>CAM</span>
                    </button>
                    <button 
                      onClick={() => switchSource("screen")}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2",
                        broadcastingType === "screen" ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                      )}
                    >
                      <MonitorPlay className="w-4 h-4" />
                      <span>SCREEN</span>
                    </button>
                  </div>
                  <div className="h-10 w-px bg-white/10 mx-2" />
                  <div className="flex items-center gap-4 px-4">
                    <button 
                      onClick={() => { 
                        if(roomRef.current) { 
                          const enabled = !isMicOn;
                          roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
                          setIsMicOn(enabled); 
                        } 
                      }} 
                      className={cn("p-3 rounded-full transition-all", isMicOn ? "text-slate-400 hover:text-white hover:bg-white/10" : "bg-red-600 text-white shadow-lg shadow-red-900/40")}
                    >
                      {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>
                    <button onClick={stopBroadcasting} className="bg-red-600 text-white p-4 rounded-full hover:bg-black hover:text-red-500 transition-all shadow-xl shadow-red-950/40 group">
                      <StopCircle className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-[#16191E] flex flex-col border-l border-slate-800">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#1A1D23]">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Stream Health</h3>
              <span className="text-[9px] font-mono text-slate-400">ID: {activeStream.peer_id?.slice(0,8)}</span>
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
                </div>
              </div>
              <div className="bg-black/20 p-4 border border-slate-800 rounded font-mono text-[10px] space-y-2">
                <div className="text-slate-400 uppercase tracking-tighter">Event: {activeStream.title}</div>
                <div className="text-slate-500 italic mt-2 line-clamp-3">{activeStream.description}</div>
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
              </div>
              <h3 className="text-sm font-black uppercase italic tracking-tight mb-4 group-hover:text-red-500 transition-colors line-clamp-1">{stream.title}</h3>
              <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between font-mono text-[9px] uppercase tracking-tighter text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(stream.start_time).toLocaleDateString()}</span>
                </div>
                {stream.status !== StreamStatus.ENDED && (
                    <div className="flex gap-2">
                      <button onClick={() => startBroadcasting(stream, "camera")} className="bg-white text-black px-3 py-1 rounded text-[9px] font-black hover:bg-red-600 hover:text-white transition-all uppercase flex items-center gap-1">
                        <Camera className="w-3 h-3" /> CAM
                      </button>
                      <button onClick={() => startBroadcasting(stream, "screen")} className="bg-slate-800 text-white px-3 py-1 rounded text-[9px] font-black hover:bg-blue-600 transition-all uppercase flex items-center gap-1">
                        <MonitorPlay className="w-3 h-3" /> SCREEN
                      </button>
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreating(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-[#16191E] border border-slate-700 rounded p-8 shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600" />
              <h2 className="text-xl font-black uppercase italic mb-8 tracking-tighter">Signal Initialization</h2>
              <form onSubmit={handleCreateStream} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="MATCH ID" className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase appearance-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Start Time</label>
                    <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 ml-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-black/40 border border-slate-800 rounded py-3 px-4 focus:outline-none focus:border-red-600 text-xs font-mono uppercase resize-none" />
                </div>
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase italic py-4 rounded transition-all shadow-xl shadow-red-950/20 text-xs">
                  Save Signal
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
