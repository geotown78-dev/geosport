import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Radio, Mail, Lock, ArrowRight } from "lucide-react";
import { APP_NAME } from "../constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      alert("შეამოწმეთ ელ-ფოსტა ვერიფიკაციის ლინკისთვის!");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-600/20">
          <Radio className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase italic">{APP_NAME}</h1>
        <p className="text-white/50">ადმინისტრატორის პანელზე წვდომისთვის გაიარეთ ავტორიზაცია</p>
      </div>

      <form className="space-y-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/40 ml-1">ელ-ფოსტა</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-white/10"
              placeholder="admin@geosport.ge"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/40 ml-1">პაროლი</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-white/10"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          disabled={loading}
          onClick={handleLogin}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span>შესვლა</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          disabled={loading}
          onClick={handleSignUp}
          className="w-full bg-transparent hover:bg-white/5 text-white/60 font-medium py-3 rounded-xl transition-all border border-white/5 text-sm"
        >
          რეგისტრაცია
        </button>
      </form>
    </div>
  );
}
