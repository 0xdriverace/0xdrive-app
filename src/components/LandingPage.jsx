import logoImg from "../assets/logo-transparent.png";

const LANDING_CSS = `
@import url('https://fonts.cdnfonts.com/css/pricedown');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080808;
  --s1:#0d0d0d;
  --s2:#111111;
  --s3:#181818;
  --border:#1e1e1e;
  --border2:#262626;
  --text:#ffffff;
  --text2:#c8c8c8;
  --muted:#666666;
  --muted2:#3a3a3a;
  --accent:#e61a1a;
  --accent-hover:#c01515;
  --accent-glow:rgba(230,26,26,0.18);
  --accent-glow-sm:rgba(230,26,26,0.10);
  --green:#00c060;
  --font-sans:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;
  --font-display:"Pricedown Bl","Pricedown",var(--font-sans);
  --font-mono:"JetBrains Mono","SF Mono",monospace;
  --radius-sm:6px;
  --radius-md:10px;
  --radius-lg:16px;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}

/* ── NAV ── */
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;background:rgba(8,8,8,0.90);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.04)}
.lp-logo{display:flex;align-items:center;gap:8px}
.lp-logo-icon{background:var(--accent);border-radius:5px;padding:3px 7px;display:inline-flex;align-items:center;justify-content:center}
.lp-logo-icon-text{font-family:var(--font-display);font-size:13px;font-weight:900;color:#fff;letter-spacing:.5px;line-height:1.1}
.lp-logo-text{font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text);letter-spacing:1px;line-height:1}
.lp-nav-actions{display:flex;gap:10px;align-items:center}
.lp-nav-login{background:transparent;border:1px solid var(--border2);border-radius:8px;padding:8px 16px;font-family:var(--font-sans);font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;transition:border-color .15s,color .15s}
.lp-nav-login:hover{border-color:var(--accent);color:var(--text)}
.lp-nav-signup{background:var(--accent);border:none;border-radius:8px;padding:8px 18px;font-family:var(--font-sans);font-size:13px;font-weight:700;color:#fff;cursor:pointer;transition:background .15s,box-shadow .15s}
.lp-nav-signup:hover{background:var(--accent-hover);box-shadow:0 0 20px var(--accent-glow)}

/* ── HERO ── */
.lp-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden}
.lp-hero-glow{position:absolute;top:-10%;left:50%;transform:translateX(-50%);width:900px;height:600px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.12) 0%,transparent 70%);pointer-events:none}
.lp-hero-glow2{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:600px;height:300px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.05) 0%,transparent 70%);pointer-events:none}
.lp-hero-eyebrow{font-family:var(--font-mono);font-size:11px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:20px;opacity:.9}
.lp-hero-title{font-family:var(--font-display);font-size:clamp(52px,10vw,110px);line-height:.95;letter-spacing:2px;color:var(--text);text-transform:uppercase;margin-bottom:28px;max-width:900px}
.lp-hero-title span{color:var(--accent);text-shadow:0 0 60px rgba(230,26,26,0.4)}
.lp-hero-sub{font-size:clamp(15px,2vw,19px);color:var(--text2);line-height:1.65;max-width:540px;margin-bottom:48px;font-weight:400}
.lp-hero-sub strong{color:var(--text);font-weight:600}
.lp-hero-cta{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap}
.lp-btn-primary{background:var(--accent);border:none;border-radius:10px;padding:16px 36px;font-family:var(--font-sans);font-size:15px;font-weight:700;color:#fff;cursor:pointer;transition:background .15s,box-shadow .2s,transform .15s;letter-spacing:.2px}
.lp-btn-primary:hover{background:var(--accent-hover);box-shadow:0 0 40px var(--accent-glow);transform:translateY(-1px)}
.lp-btn-primary:active{transform:translateY(0)}
.lp-btn-secondary{background:transparent;border:1px solid var(--border2);border-radius:10px;padding:15px 28px;font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--text2);cursor:pointer;transition:border-color .15s,color .15s,transform .15s;text-decoration:none;display:inline-block;letter-spacing:.2px}
.lp-btn-secondary:hover{border-color:var(--accent);color:var(--text);transform:translateY(-1px)}
.lp-hero-stats{display:flex;gap:40px;margin-top:72px;flex-wrap:wrap;justify-content:center}
.lp-stat{text-align:center}
.lp-stat-num{font-family:var(--font-display);font-size:36px;color:var(--text);letter-spacing:1px;line-height:1}
.lp-stat-num span{color:var(--accent)}
.lp-stat-lbl{font-size:11px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:5px}

/* ── DIVIDER ── */
.lp-divider{height:1px;background:linear-gradient(90deg,transparent,var(--border2) 20%,var(--border2) 80%,transparent);margin:0 24px}

/* ── FEATURES ── */
.lp-features{padding:96px 24px;max-width:1100px;margin:0 auto}
.lp-section-label{font-family:var(--font-mono);font-size:11px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:14px;text-align:center}
.lp-section-title{font-family:var(--font-display);font-size:clamp(32px,5vw,52px);text-align:center;letter-spacing:1px;margin-bottom:56px;line-height:1}
.lp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.lp-card{background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px 28px;position:relative;overflow:hidden;transition:border-color .2s,transform .2s}
.lp-card::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent-glow-sm),transparent);opacity:0;transition:opacity .3s}
.lp-card:hover{border-color:var(--border2);transform:translateY(-3px)}
.lp-card:hover::before{opacity:1}
.lp-card-glow{position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;opacity:.04;background:var(--accent)}
.lp-card-icon{width:44px;height:44px;background:var(--s3);border:1px solid var(--border2);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.lp-card-tag{display:inline-block;font-family:var(--font-mono);font-size:9px;letter-spacing:2px;color:var(--accent);text-transform:uppercase;background:rgba(230,26,26,.08);border:1px solid rgba(230,26,26,.18);border-radius:4px;padding:3px 8px;margin-bottom:14px}
.lp-card-title{font-size:19px;font-weight:700;letter-spacing:-.3px;margin-bottom:10px;color:var(--text)}
.lp-card-body{font-size:14px;color:var(--text2);line-height:1.65}
.lp-card-examples{margin-top:16px;display:flex;flex-direction:column;gap:5px}
.lp-card-ex{font-family:var(--font-mono);font-size:11px;color:var(--muted);display:flex;align-items:center;gap:7px}
.lp-card-ex::before{content:"→";color:var(--accent);opacity:.6}

/* ── HOW IT WORKS ── */
.lp-how{padding:80px 24px;background:linear-gradient(180deg,var(--bg) 0%,var(--s1) 50%,var(--bg) 100%)}
.lp-how-inner{max-width:800px;margin:0 auto;text-align:center}
.lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:48px;position:relative}
.lp-steps::before{content:"";position:absolute;top:22px;left:16.67%;right:16.67%;height:1px;background:linear-gradient(90deg,var(--border2),var(--accent-glow-sm),var(--border2))}
.lp-step{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 16px}
.lp-step-num{width:44px;height:44px;border-radius:50%;background:var(--s2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--accent);margin-bottom:16px;position:relative;z-index:1}
.lp-step-title{font-size:14px;font-weight:700;margin-bottom:6px;color:var(--text)}
.lp-step-body{font-size:12px;color:var(--muted);line-height:1.6}

/* ── CTA BANNER ── */
.lp-cta-banner{padding:96px 24px;text-align:center;position:relative;overflow:hidden}
.lp-cta-banner-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.1) 0%,transparent 70%);pointer-events:none}
.lp-cta-title{font-family:var(--font-display);font-size:clamp(36px,6vw,64px);letter-spacing:1.5px;margin-bottom:16px}
.lp-cta-sub{font-size:16px;color:var(--text2);margin-bottom:40px;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.6}

/* ── FOOTER ── */
.lp-footer{border-top:1px solid var(--border);padding:40px 24px 32px;max-width:1100px;margin:0 auto}
.lp-footer-inner{display:flex;align-items:flex-start;justify-content:space-between;gap:40px;flex-wrap:wrap;margin-bottom:32px}
.lp-footer-brand p{font-size:12px;color:var(--muted);max-width:240px;line-height:1.6;margin-top:6px}
.lp-footer-links{display:flex;gap:48px;flex-wrap:wrap}
.lp-footer-col h4{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:12px}
.lp-footer-col a{display:block;font-size:13px;color:var(--text2);text-decoration:none;margin-bottom:8px;transition:color .15s}
.lp-footer-col a:hover{color:var(--accent)}
.lp-footer-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:24px;border-top:1px solid var(--border)}
.lp-footer-bottom p{font-size:11px;color:var(--muted)}
.lp-footer-bottom a{font-size:11px;color:var(--muted);text-decoration:none;transition:color .15s}
.lp-footer-bottom a:hover{color:var(--text2)}

/* ── RESPONSIVE ── */
@media(max-width:768px){
  .lp-cards{grid-template-columns:1fr}
  .lp-steps{grid-template-columns:1fr;gap:32px}
  .lp-steps::before{display:none}
  .lp-hero-stats{gap:28px}
  .lp-footer-links{gap:28px}
  .lp-footer-inner{flex-direction:column;gap:28px}
  .lp-footer-bottom{flex-direction:column;text-align:center}
  .lp-nav{padding:0 16px}
  .lp-features{padding:72px 16px}
  .lp-hero{padding:100px 16px 64px}
}
@media(min-width:769px) and (max-width:1024px){
  .lp-cards{grid-template-columns:1fr 1fr}
}
`;

export default function LandingPage({ onSignUp, onLogin }) {
  return (
    <>
      <style>{LANDING_CSS}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-logo">
          <img src={logoImg} alt="0x" style={{height:40,width:"auto",display:"block"}} />
        </div>
        <div className="lp-nav-actions">
          <button className="lp-nav-login" onClick={onLogin}>Log In</button>
          <button className="lp-nav-signup" onClick={onSignUp}>Join Free</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="home">
        <div className="lp-hero-glow"/>
        <div className="lp-hero-glow2"/>
        <div className="lp-hero-eyebrow">Live driving community · US wide</div>
        <h1 className="lp-hero-title">
          Pick a lobby.<br/><span>Prove</span> your speed.
        </h1>
        <p className="lp-hero-sub">
          0xRace makes driving feel like a <strong>video game</strong>. Find your crew, join a live lobby, track locations in real-time, and climb the leaderboard.
        </p>
        <div className="lp-hero-cta">
          <button className="lp-btn-primary" onClick={onSignUp}>Join 0xRace — It's Free</button>
          <a className="lp-btn-secondary" href="#features">See How It Works</a>
        </div>
        <div className="lp-hero-stats">
          <div className="lp-stat">
            <div className="lp-stat-num"><span>Live</span></div>
            <div className="lp-stat-lbl">Active Lobbies</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-num"><span>10+</span></div>
            <div className="lp-stat-lbl">Lobby Types</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-num">Real</div>
            <div className="lp-stat-lbl">GPS Tracking</div>
          </div>
        </div>
      </section>

      <div className="lp-divider"/>

      {/* FEATURES */}
      <section className="lp-features" id="features">
        <div className="lp-section-label">What you get</div>
        <h2 className="lp-section-title">Built for real drivers</h2>
        <div className="lp-cards">

          {/* Lobbies */}
          <div className="lp-card">
            <div className="lp-card-glow"/>
            <div className="lp-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e61a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/>
              </svg>
            </div>
            <div className="lp-card-tag">Live Lobbies</div>
            <div className="lp-card-title">Go live with your crew</div>
            <div className="lp-card-body">
              Create or join a live lobby, see who's in it, what they drive, and where they're at. Sort by closest distance from your location.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex">Cruising · Drifting · Drag Racing</div>
              <div className="lp-card-ex">Request-to-join or open lobbies</div>
              <div className="lp-card-ex">Live GPS in-lobby tracking</div>
            </div>
          </div>

          {/* Groups */}
          <div className="lp-card">
            <div className="lp-card-glow" style={{background:"#00c060"}}/>
            <div className="lp-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="lp-card-tag" style={{color:"#00c060",background:"rgba(0,192,96,.08)",borderColor:"rgba(0,192,96,.2)"}}>Groups</div>
            <div className="lp-card-title">Join your local scene</div>
            <div className="lp-card-body">
              Permanent communities for your crew. Public or private groups, group chat, events, and the ability to spin up a private lobby.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex" style={{color:"#00c060"}}>PDX JDM · PDX Euro · PDX G8X</div>
              <div className="lp-card-ex" style={{color:"#00c060"}}>Private lobbies from groups</div>
              <div className="lp-card-ex" style={{color:"#00c060"}}>Real-time group chat</div>
            </div>
          </div>

          {/* Live Map */}
          <div className="lp-card">
            <div className="lp-card-glow" style={{background:"#f59e0b"}}/>
            <div className="lp-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="lp-card-tag" style={{color:"#f59e0b",background:"rgba(245,158,11,.08)",borderColor:"rgba(245,158,11,.2)"}}>Live Map</div>
            <div className="lp-card-title">See who's moving</div>
            <div className="lp-card-body">
              General vicinity on the public map. Join a lobby to unlock precise live tracking for everyone inside. Privacy-first by design.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Precise location inside lobbies</div>
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Fuzzy public map — stay safe</div>
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Set destinations for your crew</div>
            </div>
          </div>

        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-how" id="how">
        <div className="lp-how-inner">
          <div className="lp-section-label">Getting started</div>
          <h2 className="lp-section-title">Three steps to the scene</h2>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-step-num">01</div>
              <div className="lp-step-title">Create your profile</div>
              <div className="lp-step-body">Sign up in seconds. Add your username, your build, and your best times.</div>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">02</div>
              <div className="lp-step-title">Join a group or lobby</div>
              <div className="lp-step-body">Find your local crew or jump straight into a live lobby near you.</div>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">03</div>
              <div className="lp-step-title">Hit the streets</div>
              <div className="lp-step-body">Track your runs, climb the leaderboard — city, state, and national rankings.</div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="lp-cta-banner">
        <div className="lp-cta-banner-glow"/>
        <div className="lp-hero-eyebrow" style={{marginBottom:16}}>Ready to run?</div>
        <h2 className="lp-cta-title">Your lobby is waiting.</h2>
        <p className="lp-cta-sub">Free to join. No entry fee. Just you, your car, and the streets.</p>
        <button className="lp-btn-primary" onClick={onSignUp} style={{fontSize:16,padding:"17px 44px"}}>
          Create Your Account
        </button>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <div style={{marginBottom:8}}>
                <img src={logoImg} alt="0x" style={{height:34,width:"auto",display:"block"}} />
              </div>
              <p>A live driving community app. Find your crew, pick a lobby, make the streets feel like a game.</p>
            </div>
            <div className="lp-footer-links">
              <div className="lp-footer-col">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#how">How It Works</a>
                <a href="#" onClick={e=>{e.preventDefault();onSignUp();}}>Sign Up</a>
                <a href="#" onClick={e=>{e.preventDefault();onLogin();}}>Log In</a>
              </div>
              <div className="lp-footer-col">
                <h4>Ecosystem</h4>
                <a href="https://0xotics.com" target="_blank" rel="noopener noreferrer">0xotics.com</a>
                <a href="#" style={{cursor:"default",opacity:.4}}>0xRace API</a>
                <a href="#" style={{cursor:"default",opacity:.4}}>Press Kit</a>
              </div>
              <div className="lp-footer-col">
                <h4>Social</h4>
                <a href="#" style={{cursor:"default",opacity:.4}}>Instagram</a>
                <a href="#" style={{cursor:"default",opacity:.4}}>Twitter / X</a>
                <a href="#" style={{cursor:"default",opacity:.4}}>TikTok</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p>© 2026 0xRace · Powered by 0xotics</p>
            <div style={{display:"flex",gap:20}}>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
