import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Stream, StreamStatus } from "../constants";
import { Link } from "react-router-dom";
import { Play, Calendar, Users, Radio, Search, Filter, MonitorPlay } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export default function HomePage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "scheduled">("all");

  useEffect(() => {
    fetchStreams();

    const channel = supabase
      .channel('streams-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, (payload) => {
        fetchStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchStreams() {
    setLoading(true);
    const { data } = await supabase
      .from('streams')
      .select('*')
      .order('status', { ascending: false })
      .order('start_time', { ascending: true });

    if (data) setStreams(data);
    setLoading(false);
  }

  const filteredStreams = streams.filter(s => {
    if (filter === "all") return s.status !== StreamStatus.ENDED;
    if (filter === "live") return s.status === StreamStatus.LIVE;
    if (filter === "scheduled") return s.status === StreamStatus.SCHEDULED;
    return true;
  });

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Dense Hero Section */}
      <section className="mb-8 p-6 bg-[#1A1D23] border border-slate-800 rounded flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-red-600 w-2 h-2 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase text-slate-500 font-black tracking-[0.2em]">{filter === "live" ? "Live Broadcasts" : "Live Streaming Core"}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase italic leading-none">
            GeoSport <span className="text-red-500 underline underline-offset-8 decoration-4">Broadcast</span> Center
          </h1>
          <p className="text-slate-400 text-sm max-w-xl font-medium leading-relaxed">
            პროფესიონალური სპორტული ტრანსლაციების პლატფორმა. 
            თვალი ადევნეთ საყვარელ გუნდებს პირდაპირ ეთერში, მაღალი ხარისხით.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4">
           <div className="p-4 border border-slate-800 bg-black/20 rounded">
              <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Active Streams</div>
              <div className="text-2xl font-mono text-blue-500">{streams.filter(s => s.status === StreamStatus.LIVE).length}</div>
           </div>
           <div className="p-4 border border-slate-800 bg-black/20 rounded">
              <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Up Next</div>
              <div className="text-2xl font-mono text-slate-300">{streams.filter(s => s.status === StreamStatus.SCHEDULED).length}</div>
           </div>
        </div>
      </section>

      {/* Filters & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center bg-black/40 p-1 rounded border border-slate-800">
          {[
            { id: "all", label: "All Events" },
            { id: "live", label: "Live Now", icon: true },
            { id: "scheduled", label: "Scheduled" }
          ].map((btn) => (
            <button 
              key={btn.id}
              onClick={() => setFilter(btn.id as any)}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                filter === btn.id ? "bg-slate-700 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {btn.icon && <div className={cn("w-1.5 h-1.5 rounded-full", filter === "live" ? "bg-red-500 animate-pulse" : "bg-red-900")} />}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="relative group max-w-xs w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-red-500 transition-colors" />
          <input 
            type="text" 
            placeholder="FILTER BY TITLE / TEAM..." 
            className="w-full bg-black/40 border border-slate-800 rounded py-2 pl-10 pr-4 focus:outline-none focus:border-red-500 transition-all text-[10px] font-mono tracking-widest uppercase"
          />
        </div>
      </div>

      {/* High Density Stream Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="aspect-video bg-white/5 animate-pulse border border-slate-800 rounded" />
          ))}
        </div>
      ) : filteredStreams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredStreams.map((stream, idx) => (
            <motion.div 
              key={stream.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.02 }}
              className="group flex flex-col bg-[#1A1D23] border border-slate-800 rounded overflow-hidden"
            >
              <Link to={`/watch/${stream.id}`} className="block relative aspect-video bg-black/60 overflow-hidden">
                {stream.thumbnail_url ? (
                  <img src={stream.thumbnail_url} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-300" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#0C0E12] group-hover:bg-red-900/10 transition-colors">
                    <MonitorPlay className="w-8 h-8 text-slate-700 group-hover:text-red-500 transition-colors mb-2" />
                    <span className="text-[8px] font-black uppercase text-slate-700 tracking-[0.3em]">Signal Offline</span>
                  </div>
                )}
                
                {stream.status === StreamStatus.LIVE && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-tighter shadow-lg">
                    <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-black uppercase bg-black/60 px-1.5 py-0.5 rounded-sm border border-slate-800">
                      {stream.category}
                    </span>
                  </div>
                  {stream.status === StreamStatus.LIVE && (
                    <div className="flex items-center gap-1 text-[8px] font-bold bg-black/60 px-1.5 py-0.5 rounded-sm border border-slate-800">
                      <Users className="w-3 h-3 text-red-500" />
                      <span>{stream.viewers_count}</span>
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-4 bg-[#14161B] border-t border-slate-800">
                <h3 className="text-xs font-black mb-2 uppercase tracking-tight line-clamp-1 group-hover:text-red-500 transition-colors leading-tight">
                  {stream.title}
                </h3>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[9px] font-black uppercase italic">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(stream.start_time).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <Link to={`/watch/${stream.id}`} className="text-[8px] font-black uppercase bg-slate-800 hover:bg-red-600 px-2 py-1 rounded-sm transition-all border border-slate-700 hover:border-red-500">
                    Enter
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-[#14161B] border border-dashed border-slate-800 rounded">
          <MonitorPlay className="w-12 h-12 text-slate-800 mx-auto mb-4" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">No active signals found</h2>
        </div>
      )}
    </div>
  );
}
