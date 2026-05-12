/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Play, Shield, Globe, Menu, X, Radio, Home, LogOut, LayoutGrid } from "lucide-react";
import { APP_NAME } from "./constants";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import WatchPage from "./pages/WatchPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { supabase } from "./lib/supabase";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="flex flex-col h-screen bg-[#0F1115] text-slate-200 font-sans overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-[#1A1D23] border-b border-slate-800 flex items-center justify-between px-6 flex-none">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center group-hover:rotate-6 transition-transform">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-bold text-lg tracking-tight uppercase italic">{APP_NAME} <span className="text-red-500 font-black">ADM</span></h1>
            </Link>
            <div className="h-4 w-[1px] bg-slate-700 mx-2 hidden md:block"></div>
            <div className="hidden md:flex items-center gap-2 bg-black/40 px-3 py-1 rounded border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Status</span>
              <span className="text-xs font-bold text-green-400">ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest text-right">Server</span>
              <span className="text-xs font-mono">EU-MAIN-01</span>
            </div>

            {user && ["admin@geosport.ge", "geotowng@gmail.com"].includes(user.email?.toLowerCase() || "") && (
              <Link 
                to="/admin" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
              >
                <LayoutGrid className="w-3 h-3" />
                Admin Panel
              </Link>
            )}
            
            {user ? (
              <button 
                onClick={() => supabase.auth.signOut()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-700"
              >
                Sign Out
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-700">
                  Login
                </Link>
                <Link to="/signup" className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">
                  Signup
                </Link>
              </div>
            )}
            
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5 text-slate-400" /> : <Menu className="w-5 h-5 text-slate-400" />}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <nav className="w-16 high-density-sidebar hidden md:flex flex-col items-center py-6 gap-8 flex-none">
            <Link to="/" className="p-2 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded transition-all">
              <Home className="w-6 h-6" />
            </Link>
            {user?.email && ["admin@geosport.ge", "geotowng@gmail.com"].includes(user.email.toLowerCase()) && (
              <Link to="/admin" className="p-2 text-blue-500 bg-blue-500/10 rounded-lg shadow-sm group relative" title="Admin Dashboard">
                <LayoutGrid className="w-6 h-6" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap uppercase">Admin Panel</span>
              </Link>
            )}
            <Link to="/login" className="p-2 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded mt-auto">
              <Shield className="w-6 h-6" />
            </Link>
          </nav>

          {/* Mobile Overlay Menu */}
          {isMenuOpen && (
            <div className="md:hidden absolute inset-0 z-40 bg-black/95 flex flex-col p-8 pt-20 gap-6">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold border-b border-slate-800 pb-4">Home</Link>
              {user?.email && ["admin@geosport.ge", "geotowng@gmail.com"].includes(user.email.toLowerCase()) && (
                <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold border-b border-slate-800 pb-4 text-blue-500">Admin Dashboard</Link>
              )}
              {user ? (
                <button onClick={() => { supabase.auth.signOut(); setIsMenuOpen(false); }} className="text-2xl font-bold text-red-500 text-left">Logout</button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold text-red-500 border-b border-slate-800 pb-4">Login</Link>
                  <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="text-2xl font-bold text-red-500">Signup</Link>
                </>
              )}
            </div>
          )}

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto bg-[#0A0C10] p-4 md:p-8 custom-scrollbar">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/admin" element={<AdminPage user={user} />} />
              <Route path="/watch/:id" element={<WatchPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Routes>
          </main>
        </div>

        {/* Footer */}
        <footer className="h-10 high-density-footer px-6 flex items-center justify-between flex-none text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          <div>&copy; {new Date().getFullYear()} {APP_NAME} <span className="text-slate-700 ml-2">// STRMCORE V1.0</span></div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
               <span>Streaming Engine Active</span>
             </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
