import { useState } from "react";
import { supabase } from "../lib/supabase.js";

const AUTH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0a;--s1:#141414;--s2:#1a1a1a;--s3:#222222;
  --border:#2a2a2a;--border2:#333333;
  --text:#ffffff;--text2:#e0e0e0;--muted:#666666;--muted2:#444444;
  --green:#22c55e;--orange:#f59e0b;--red:#ef4444;--blue:#3b82f6;
}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.auth-wrap{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px 20px 48px;background:var(--bg)}
.auth-logo{text-align:center;margin-bottom:40px}
.auth-logo-mark{font-size:36px;font-weight:800;letter-spacing:-1px;color:var(--text);line-height:1;font-family:'DM Sans',sans-serif}
.auth-logo-mark span{color:var(--orange)}
.auth-logo-sub{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;color:var(--muted);margin-top:4px;text-transform:uppercase}
.auth-tabs{display:flex;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:28px;gap:4px}
.auth-tab{flex:1;padding:9px;border-radius:9px;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
.auth-tab.on{background:var(--s3);color:var(--text);border:1px solid var(--border2)}
.auth-field{margin-bottom:14px}
.auth-label{display:block;font-size:11px;font-weight:600;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:6px}
.auth-inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:13px 14px;font-family:'DM Sans',sans-serif;font-size:15px;color:var(--text);outline:none;transition:border-color .2s}
.auth-inp:focus{border-color:var(--border2)}
.auth-inp::placeholder{color:var(--muted2)}
.auth-inp.err{border-color:rgba(239,68,68,.5)}
.auth-hint{font-size:11px;color:var(--muted);margin-top:5px}
.auth-btn{width:100%;padding:14px;border-radius:12px;border:none;background:var(--text);color:var(--bg);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;transition:opacity .15s}
.auth-btn:hover{opacity:.9}
.auth-btn:disabled{opacity:.4;cursor:default}
.auth-err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--red);margin-bottom:14px;line-height:1.5}
.auth-ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--green);margin-bottom:14px;line-height:1.5}
.auth-divider{text-align:center;font-size:12px;color:var(--muted);margin:20px 0 0}
`;

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      // Auth state change in App.jsx will handle redirect
    } catch (err) {
      setError(err.message || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    const username = signupUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!username) { setError("Username is required."); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (signupPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      // Pre-check username availability for good UX
      // (DB unique constraint + trigger are the real enforcement)
      const { data: existing } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();
      if (existing) {
        setError("That username is already taken. Choose another.");
        setLoading(false);
        return;
      }

      const initials = (signupDisplayName.trim() || username)
        .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

      // Pass user data as metadata — a DB trigger (handle_new_user) will
      // insert the profiles row server-side using SECURITY DEFINER,
      // which bypasses RLS and avoids auth-timing issues entirely.
      const { data, error: signupError } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          data: {
            username,
            display_name: signupDisplayName.trim() || "",
            avatar_initials: initials,
            show_real_name: !!signupDisplayName.trim(),
          },
        },
      });
      if (signupError) throw signupError;

      // If email confirmation is required, Supabase won't auto-login
      if (!data.session) {
        setSuccess("Check your email to confirm your account, then log in.");
        setMode("login");
      }
      // If auto-confirmed, onAuthStateChange in App.jsx handles the redirect
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{AUTH_CSS}</style>
      <div className="auth-wrap">
        <div className="auth-logo">
          <div className="auth-logo-mark">0X<span>RACE</span></div>
          <div className="auth-logo-sub">Powered by 0xDrive</div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "on" : ""}`} onClick={() => switchMode("login")}>
            Log In
          </button>
          <button className={`auth-tab ${mode === "signup" ? "on" : ""}`} onClick={() => switchMode("signup")}>
            Sign Up
          </button>
        </div>

        {error && <div className="auth-err">{error}</div>}
        {success && <div className="auth-ok">{success}</div>}

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-inp"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-inp"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Logging in…" : "Log In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="auth-field">
              <label className="auth-label">Username</label>
              <input
                className="auth-inp"
                type="text"
                placeholder="e.g. 0xmeyn"
                value={signupUsername}
                onChange={e => setSignupUsername(e.target.value)}
                required
                autoComplete="username"
                maxLength={30}
              />
              <div className="auth-hint">Lowercase letters, numbers, underscores only. Cannot be changed later.</div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Display Name <span style={{color:"var(--muted2)",fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
              <input
                className="auth-inp"
                type="text"
                placeholder="Your real name"
                value={signupDisplayName}
                onChange={e => setSignupDisplayName(e.target.value)}
                autoComplete="name"
                maxLength={60}
              />
              <div className="auth-hint">Shown publicly if set. You can toggle this later.</div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-inp"
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-inp"
                type="password"
                placeholder="Min 6 characters"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}

        <div className="auth-divider">
          {mode === "login" ? "New to 0xRace?" : "Already have an account?"}{" "}
          <span
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            style={{color:"var(--orange)",fontWeight:600,cursor:"pointer"}}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </div>
      </div>
    </>
  );
}
