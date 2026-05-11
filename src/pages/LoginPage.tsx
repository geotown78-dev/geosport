import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Radio, Mail, Lock, ArrowRight, User } from "lucide-react";
import { APP_NAME } from "../constants";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        navigate("/admin");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        alert("რეგისტრაცია წარმატებით დასრულდა! შეამოწმეთ ელ-ფოსტა ვერიფიკაციისთვის.");
        setMode("login");
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-600/20">
          <Radio className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase italic text-slate-200">
          {APP_NAME} <span className="text-red-500 font-black">LOGIN</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">
          {mode === "login" ? "ავტორიზაცია ადმინისტრატორისთვის" : "ახალი ანგარიშის შექმნა"}
        </p>
      </div>

      <div className="bg-[#1A1D23] border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase">
              {error}
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">სრული სახელი</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-700 text-sm"
                  placeholder="თქვენი სახელი"
                  required={mode === "signup"}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">ელ-ფოსტა</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-700 text-sm"
                placeholder="admin@geosport.ge"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">პაროლი</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-red-500 transition-all placeholder:text-slate-700 text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase italic py-4 rounded-xl transition-all shadow-xl shadow-red-950/20 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{mode === "login" ? "შესვლა" : "რეგისტრაცია"}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors"
          >
            {mode === "login" ? "არ გაქვთ ანგარიში? დარეგისტრირდით" : "უკვე გაქვთ ანგარიში? შესვლა"}
          </button>
        </div>
      </div>
    </div>
  );
}
