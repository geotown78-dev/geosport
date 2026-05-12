import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Stream, StreamStatus } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import { Users, Radio, Info, MessageSquare, Heart, Share2, Play, AlertCircle, ChevronLeft, Calendar, Database, ShieldCheck, Zap, Mic, MicOff } from "lucide-react";
import { Room, RoomEvent, RemoteTrack, RemoteParticipant, Track } from "livekit-client";
import { cn } from "../lib/utils";

export default function WatchPage() {
  const { id } = useParams();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStream();
      incrementViewers();

      const channel = supabase
        .channel(`stream-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${id}` }, (payload) => {
          console.log("Stream update received:", payload.new);
          setStream(payload.new as Stream);
        })
        .subscribe();

      return () => {
        decrementViewers();
        supabase.removeChannel(channel);
        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }
      };
    }
  }, [id]);

  useEffect(() => {
    if (stream?.status === StreamStatus.LIVE) {
      console.log("Attempting to connect to LiveKit room for stream:", stream.id);
      connectToBroadcaster(stream.id);
    } else if (stream?.status === StreamStatus.ENDED) {
      setConnectionStatus("disconnected");
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    }
  }, [stream?.status, id]);

  async function fetchStream() {
    try {
      const { data, error } = await supabase.from('streams').select('*').eq('id', id).single();
      if (error) setError("Signal lost or stream does not exist");
      else setStream(data);
    } catch (e) {
      console.error("Fetch stream error:", e);
      setError("Failed to connect to data source");
    }
    setLoading(false);
  }

  async function incrementViewers() { 
    if (id) {
      try {
        await supabase.rpc('increment_viewer_count', { stream_id: id });
      } catch (e) {
        console.warn("Viewer increment failed (RPC likely missing):", e);
      }
    }
  }
  async function decrementViewers() { 
    if (id) {
      try {
        await supabase.rpc('decrement_viewer_count', { stream_id: id });
      } catch (e) {
        console.warn("Viewer decrement failed (RPC likely missing):", e);
      }
    }
  }

  async function connectToBroadcaster(streamId: string) {
    if (connectionStatus === "connected" && roomRef.current) return;
    
    // Explicit cleanup
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setConnectionStatus("connecting");
    
    try {
      const roomName = `stream-${streamId}`;
      const participantName = `viewer-${Math.random().toString(36).substring(7)}`;

      // 1. Get token
      const tokenResponse = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName, isBroadcaster: false }),
      });
      
      const { token } = await tokenResponse.json();
      if (!token) throw new Error("Failed to get viewer token");

      // 2. Connect to Room
      const room = new Room();
      roomRef.current = room;

      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) throw new Error("VITE_LIVEKIT_URL not configured");

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
            setConnectionStatus("connected");
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
        })
        .on(RoomEvent.Disconnected, () => {
          setConnectionStatus("disconnected");
        });

      await room.connect(livekitUrl, token);
      console.log("Connected to LiveKit as viewer");

      // Check if tracks are already available
      room.remoteParticipants.forEach((p) => {
        p.videoTrackPublications.forEach((pub) => {
          if (pub.isSubscribed && pub.videoTrack && videoRef.current) {
            pub.videoTrack.attach(videoRef.current);
            setConnectionStatus("connected");
          }
        });
      });

    } catch (err) {
      console.error("LiveKit Viewer Error:", err);
      setConnectionStatus("error");
    }
  }

  if (loading) return (
    <div className="max-w-screen-2xl mx-auto space-y-4 animate-pulse h-[80vh]">
      <div className="aspect-video bg-white/5 rounded border border-slate-800" />
      <div className="h-4 bg-white/5 w-1/4 rounded" />
    </div>
  );

  if (error || !stream) return (
    <div className="max-w-screen-2xl mx-auto px-4 py-24 text-center bg-[#14161B] border border-slate-800 rounded">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h1 className="text-xl font-black uppercase tracking-tighter mb-4">{error}</h1>
      <Link to="/" className="text-red-500 text-xs font-black uppercase hover:underline">Signal Recovery / Home</Link>
    </div>
  );

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Dense Breadcrumb */}
      <div className="flex items-center gap-4 mb-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
        <Link to="/" className="hover:text-white transition-colors">Broadcasts</Link>
        <span>/</span>
        <span className="text-slate-300">{stream.title}</span>
      </div>

      <div className="grid grid-cols-12 gap-px bg-slate-800 border border-slate-800 rounded shadow-2xl overflow-hidden">
        {/* Main Content: Player Area */}
        <div className="col-span-12 lg:col-span-9 bg-[#0A0A0A] flex flex-col relative">
          <div className="relative aspect-video bg-black/80 overflow-hidden group">
            {stream.status === StreamStatus.LIVE ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted={isMuted}
                  className="w-full h-full object-cover grayscale-[0.1]" 
                />
                
                {/* HUD Overlays */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase shadow-lg shadow-red-950/40 animate-pulse">
                    <div className="w-1 h-1 bg-white rounded-full" />
                    <span>Real-Time Feed</span>
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-sm text-[8px] font-black uppercase border border-white/10 tracking-widest text-slate-300">
                    Source: GEO_LOCAL_RELAY
                  </div>
                </div>

                {/* Control Bar */}
                <div className="absolute bottom-6 right-6 flex items-center gap-3">
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full hover:bg-red-600/20 transition-all group"
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                    ) : (
                      <Mic className="w-4 h-4 text-blue-400" />
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {connectionStatus !== "connected" && (
                    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0A0A0A]/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                       {connectionStatus === "error" ? (
                         <>
                           <AlertCircle className="w-10 h-10 text-red-600" />
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Signal Interrupted</p>
                           <button 
                             onClick={() => stream?.peer_id && connectToBroadcaster(stream.peer_id)}
                             className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded mt-4 hover:bg-red-700 transition-colors"
                           >
                             Retry Connection
                           </button>
                           <button 
                             onClick={() => fetchStream()}
                             className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors mt-2"
                           >
                             Refresh Metadata [F5]
                           </button>
                         </>
                       ) : (
                         <>
                           <Zap className="w-10 h-10 text-red-600 animate-bounce" />
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Establishing Signal Link...</p>
                         </>
                       )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : stream.status === StreamStatus.SCHEDULED ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-900 to-black">
                <Calendar className="w-16 h-16 text-slate-800 mb-6" />
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Transmissions Pending</h2>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Target: {new Date(stream.start_time).toLocaleString('ka-GE')}</p>
                <button className="mt-8 px-6 py-2 border border-slate-700 hover:border-red-600 text-[10px] font-black uppercase transition-all">Enable Notification Log</button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-black">
                <AlertCircle className="w-12 h-12 text-slate-800 mb-4" />
                <h2 className="text-lg font-black uppercase italic text-slate-500">Transmission Terminated</h2>
                <Link to="/" className="mt-4 text-[9px] font-black uppercase bg-slate-800 px-4 py-2 rounded-sm">Exit Terminal</Link>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#16191E] border-t border-slate-800">
             <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-black uppercase bg-red-900/20 text-red-500 px-1.5 py-0.5 border border-red-900/40">{stream.category}</span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">SIG_ID: {stream.id.slice(0,8)}</span>
                  </div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-4">{stream.title}</h1>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-3xl">
                    {stream.description || "NO METADATA AVAILABLE FOR THIS TRANSMISSION."}
                  </p>
                </div>
                <div className="flex flex-row md:flex-col lg:flex-row gap-2 shrink-0">
                   <button className="p-3 bg-slate-800 rounded-sm hover:bg-red-900/40 transition-all border border-slate-700"><Heart className="w-4 h-4" /></button>
                   <button className="p-3 bg-slate-800 rounded-sm hover:bg-blue-900/40 transition-all border border-slate-700"><Share2 className="w-4 h-4" /></button>
                </div>
             </div>
          </div>
        </div>

        {/* Dense Side Panel: Hub Info & Chat */}
        <div className="col-span-12 lg:col-span-3 bg-[#1A1D23] flex flex-col h-[700px] lg:h-auto border-l border-slate-800">
          <div className="p-4 border-b border-slate-800 bg-[#16191E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Live Grid Hub</span>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800 grid grid-cols-2 gap-2">
             <div className="p-3 bg-black/40 border border-slate-800">
                <div className="text-[8px] font-black text-slate-600 uppercase mb-1">Active Links</div>
                <div className="text-lg font-mono text-blue-400">{stream.viewers_count}</div>
             </div>
             <div className="p-3 bg-black/40 border border-slate-800">
                <div className="text-[8px] font-black text-slate-600 uppercase mb-1">Link Security</div>
                <div className="text-lg font-mono text-green-500 flex items-center gap-1">
                   <ShieldCheck className="w-3.5 h-3.5" />
                   ENC
                </div>
             </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600">
             <MessageSquare className="w-8 h-8 opacity-10 mb-4" />
             <p className="text-[10px] font-black uppercase italic tracking-[0.2em]">Signal encryption active. Communication channel locked in preview.</p>
          </div>

          <div className="p-4 bg-[#0C0E12] border-t border-slate-800">
             <div className="p-4 bg-red-900/5 border border-red-900/10 rounded">
                <h4 className="text-[10px] font-black uppercase text-red-500 mb-2 italic">Upgrade Broadcast Access</h4>
                <p className="text-[9px] text-slate-500 leading-normal mb-3">Access 4K Ultra-Low Latency feeds and exclusive tactical camera views.</p>
                <button className="w-full bg-slate-800 hover:bg-slate-700 text-[8px] font-black uppercase tracking-widest py-2 transition-all border border-slate-700">Initialize Premium Link</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
