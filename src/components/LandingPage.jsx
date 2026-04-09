import logoImg from "../assets/logo-transparent.png";

const CAR_PHOTO = "/g80.JPG";

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
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;background:rgba(8,8,8,0.85);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,0.05)}
.lp-logo{display:flex;align-items:center}
.lp-nav-actions{display:flex;gap:10px;align-items:center}
.lp-nav-login{background:transparent;border:1px solid var(--border2);border-radius:8px;padding:8px 18px;font-family:var(--font-sans);font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;transition:border-color .15s,color .15s}
.lp-nav-login:hover{border-color:var(--accent);color:var(--text)}
.lp-nav-signup{background:var(--accent);border:none;border-radius:8px;padding:9px 20px;font-family:var(--font-sans);font-size:13px;font-weight:700;color:#fff;cursor:pointer;transition:background .15s,box-shadow .15s,transform .12s}
.lp-nav-signup:hover{background:var(--accent-hover);box-shadow:0 0 20px var(--accent-glow)}
.lp-nav-signup:active{transform:scale(0.97)}

/* ── HERO ── */
.lp-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden}
.lp-hero-glow{position:absolute;top:-10%;left:50%;transform:translateX(-50%);width:1000px;height:700px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.1) 0%,transparent 65%);pointer-events:none}
.lp-hero-glow2{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:600px;height:300px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.05) 0%,transparent 70%);pointer-events:none}
.lp-hero-eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:24px;background:rgba(230,26,26,0.08);border:1px solid rgba(230,26,26,0.2);border-radius:100px;padding:6px 16px}
.lp-hero-title{font-family:var(--font-display);font-size:clamp(48px,9vw,108px);line-height:.95;letter-spacing:2px;color:var(--text);text-transform:uppercase;margin-bottom:28px;max-width:960px}
.lp-hero-title span{color:var(--accent);text-shadow:0 0 80px rgba(230,26,26,0.35)}
.lp-hero-sub{font-size:clamp(15px,2vw,18px);color:var(--text2);line-height:1.7;max-width:520px;margin-bottom:48px;font-weight:400}
.lp-hero-sub strong{color:var(--text);font-weight:600}
.lp-hero-cta{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.lp-hero-member-note{font-size:12px;color:var(--muted);letter-spacing:.02em}
.lp-hero-member-note a{color:var(--text2);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.lp-btn-primary{background:var(--accent);border:none;border-radius:10px;padding:16px 38px;font-family:var(--font-sans);font-size:15px;font-weight:700;color:#fff;cursor:pointer;transition:background .15s,box-shadow .2s,transform .12s;letter-spacing:.2px}
.lp-btn-primary:hover{background:var(--accent-hover);box-shadow:0 0 40px var(--accent-glow);transform:translateY(-1px)}
.lp-btn-primary:active{transform:scale(0.97)}
.lp-btn-secondary{background:transparent;border:1px solid var(--border2);border-radius:10px;padding:15px 28px;font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--text2);cursor:pointer;transition:border-color .15s,color .15s,transform .12s;text-decoration:none;display:inline-block;letter-spacing:.2px}
.lp-btn-secondary:hover{border-color:var(--border2);background:var(--s2);color:var(--text);transform:translateY(-1px)}
.lp-hero-stats{display:flex;gap:48px;margin-top:80px;flex-wrap:wrap;justify-content:center}
.lp-stat{text-align:center}
.lp-stat-num{font-family:var(--font-display);font-size:38px;color:var(--text);letter-spacing:1px;line-height:1}
.lp-stat-num span{color:var(--accent)}
.lp-stat-lbl{font-size:11px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:5px}

/* ── DIVIDER ── */
.lp-divider{height:1px;background:linear-gradient(90deg,transparent,var(--border2) 20%,var(--border2) 80%,transparent);margin:0 32px}

/* ── CAR PHOTO ── */
.lp-car-section{position:relative;height:500px;overflow:hidden;margin:0}
.lp-car-img{width:100%;height:100%;object-fit:cover;object-position:center center;display:block;filter:brightness(0.6)}
.lp-car-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;background:linear-gradient(to bottom,transparent 0%,rgba(8,8,8,0.3) 60%,var(--bg) 100%)}
.lp-car-quote{font-family:var(--font-display);font-size:clamp(28px,4vw,52px);color:#fff;letter-spacing:2px;text-transform:uppercase;text-align:center;text-shadow:0 2px 40px rgba(0,0,0,0.8);max-width:700px;line-height:1.1}
.lp-car-quote span{color:var(--accent)}

/* ── FEATURES ── */
.lp-features{padding:96px 32px;max-width:1140px;margin:0 auto}
.lp-section-label{font-family:var(--font-mono);font-size:10px;letter-spacing:3px;color:var(--accent);text-transform:uppercase;margin-bottom:12px;text-align:center}
.lp-section-title{font-family:var(--font-display);font-size:clamp(30px,5vw,50px);text-align:center;letter-spacing:1px;margin-bottom:56px;line-height:1}
.lp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.lp-card{background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:32px 28px;position:relative;overflow:hidden;transition:border-color .25s,transform .25s,box-shadow .25s}
.lp-card::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent-glow-sm),transparent);opacity:0;transition:opacity .3s}
.lp-card:hover{border-color:var(--border2);transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.lp-card:hover::before{opacity:1}
.lp-card-glow{position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;opacity:.05;background:var(--accent)}
.lp-card-icon{width:46px;height:46px;background:var(--s3);border:1px solid var(--border2);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.lp-card-tag{display:inline-block;font-family:var(--font-mono);font-size:9px;letter-spacing:2px;color:var(--accent);text-transform:uppercase;background:rgba(230,26,26,.08);border:1px solid rgba(230,26,26,.18);border-radius:4px;padding:3px 8px;margin-bottom:14px}
.lp-card-title{font-size:18px;font-weight:700;letter-spacing:-.3px;margin-bottom:10px;color:var(--text)}
.lp-card-body{font-size:14px;color:var(--text2);line-height:1.7}
.lp-card-examples{margin-top:18px;display:flex;flex-direction:column;gap:6px}
.lp-card-ex{font-family:var(--font-mono);font-size:11px;color:var(--muted);display:flex;align-items:center;gap:7px}
.lp-card-ex::before{content:"→";color:var(--accent);opacity:.6}

/* ── MEMBERSHIP ── */
.lp-membership{padding:96px 32px;background:linear-gradient(180deg,var(--bg) 0%,var(--s1) 50%,var(--bg) 100%)}
.lp-membership-inner{max-width:860px;margin:0 auto;text-align:center}
.lp-pricing-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:48px;text-align:left}
.lp-pricing-card{background:var(--s2);border:1px solid var(--border);border-radius:18px;padding:32px 28px;position:relative;overflow:hidden}
.lp-pricing-card.featured{border-color:var(--accent);background:rgba(230,26,26,0.05)}
.lp-pricing-card.featured::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent)}
.lp-pricing-badge{display:inline-block;font-family:var(--font-mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:4px 10px;border-radius:4px;margin-bottom:20px;font-weight:700}
.lp-pricing-badge.member{background:rgba(230,26,26,.12);color:var(--accent);border:1px solid rgba(230,26,26,.25)}
.lp-pricing-badge.access{background:var(--s3);color:var(--muted);border:1px solid var(--border2)}
.lp-pricing-price{font-family:var(--font-display);font-size:52px;color:var(--text);letter-spacing:-1px;line-height:1;margin-bottom:6px}
.lp-pricing-price span{font-size:20px;color:var(--muted);font-family:var(--font-sans);font-weight:400;letter-spacing:0}
.lp-pricing-title{font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px}
.lp-pricing-sub{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:20px}
.lp-pricing-features{display:flex;flex-direction:column;gap:8px}
.lp-pricing-feature{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)}
.lp-pricing-feature::before{content:"✓";color:var(--green);font-weight:700;font-size:12px;flex-shrink:0}

/* ── CTA BANNER ── */
.lp-cta-banner{padding:100px 24px;text-align:center;position:relative;overflow:hidden}
.lp-cta-banner-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;background:radial-gradient(ellipse at center,rgba(230,26,26,0.09) 0%,transparent 70%);pointer-events:none}
.lp-cta-title{font-family:var(--font-display);font-size:clamp(34px,6vw,64px);letter-spacing:1.5px;margin-bottom:16px}
.lp-cta-sub{font-size:16px;color:var(--text2);margin-bottom:40px;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.65}

/* ── FOOTER ── */
.lp-footer{border-top:1px solid var(--border);padding:48px 32px 32px;max-width:1140px;margin:0 auto}
.lp-footer-inner{display:flex;align-items:flex-start;justify-content:space-between;gap:40px;flex-wrap:wrap;margin-bottom:40px}
.lp-footer-brand p{font-size:12px;color:var(--muted);max-width:220px;line-height:1.7;margin-top:10px}
.lp-footer-links{display:flex;gap:56px;flex-wrap:wrap}
.lp-footer-col h4{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted2);font-weight:600;margin-bottom:14px}
.lp-footer-col a{display:block;font-size:13px;color:var(--muted);text-decoration:none;margin-bottom:9px;transition:color .15s}
.lp-footer-col a:hover{color:var(--text)}
.lp-footer-bottom{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:24px;border-top:1px solid var(--border)}
.lp-footer-bottom p{font-size:11px;color:var(--muted2)}
.lp-footer-bottom a{font-size:11px;color:var(--muted2);text-decoration:none;transition:color .15s}
.lp-footer-bottom a:hover{color:var(--muted)}

/* ── RESPONSIVE ── */
@media(max-width:768px){
  .lp-nav{padding:0 16px;height:56px}
  .lp-hero{padding:100px 20px 64px}
  .lp-features{padding:72px 20px}
  .lp-cards{grid-template-columns:1fr}
  .lp-car-section{height:320px}
  .lp-membership{padding:72px 20px}
  .lp-pricing-cards{grid-template-columns:1fr}
  .lp-hero-stats{gap:28px}
  .lp-footer{padding:40px 20px 28px}
  .lp-footer-links{gap:28px}
  .lp-footer-inner{flex-direction:column;gap:28px}
  .lp-footer-bottom{flex-direction:column;text-align:center}
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
          <img src={logoImg} alt="0x" style={{height:38,width:"auto",display:"block"}} />
        </div>
        <div className="lp-nav-actions">
          <button className="lp-nav-login" onClick={onLogin}>Log In</button>
          <button className="lp-nav-signup" onClick={onSignUp}>Get Access</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="home">
        <div className="lp-hero-glow"/>
        <div className="lp-hero-glow2"/>
        <div className="lp-hero-eyebrow">
          <span>●</span> Exclusive to 0xdrive Members
        </div>
        <h1 className="lp-hero-title">
          Find your crew.<br/><span>Hit the streets.</span>
        </h1>
        <p className="lp-hero-sub">
          Drop into a live lobby, see who's near you, and link up with your crew in seconds. <strong>Built for enthusiasts who actually drive.</strong>
        </p>
        <div className="lp-hero-cta">
          <button className="lp-btn-primary" onClick={onSignUp}>Join the Scene</button>
          <a className="lp-btn-secondary" href="#features">See What's Inside</a>
        </div>
        <p className="lp-hero-member-note">
          Included with 0xdrive Tier 2 &nbsp;·&nbsp; $45 one-time for everyone else
        </p>
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

      {/* CAR PHOTO */}
      <section className="lp-car-section">
        <img src={CAR_PHOTO} className="lp-car-img" alt="BMW M3" />
        <div className="lp-car-overlay">
          <p className="lp-car-quote">Built for the ones who <span>live for the drive.</span></p>
        </div>
      </section>

      <div className="lp-divider" style={{margin:"0"}}/>

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
              Create or join a live lobby, see who's in it, what they drive, and where they're at. Sorted by distance from you.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex">Cruising · Drifting · Drag Racing</div>
              <div className="lp-card-ex">Open or request-to-join lobbies</div>
              <div className="lp-card-ex">Live GPS tracking inside lobbies</div>
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
            <div className="lp-card-title">Find your local scene</div>
            <div className="lp-card-body">
              Permanent communities for your crew. Group chat, events, and private lobbies — all in one place.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex" style={{color:"#00c060"}}>PDX JDM · PDX Euro · PDX G8X</div>
              <div className="lp-card-ex" style={{color:"#00c060"}}>Private group lobbies</div>
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
              Public map shows the general area. Inside a lobby, get precise live tracking for everyone in it. Privacy-first by design.
            </div>
            <div className="lp-card-examples">
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Precise tracking inside lobbies</div>
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Fuzzy public map — stay safe</div>
              <div className="lp-card-ex" style={{color:"#f59e0b"}}>Set destinations for the crew</div>
            </div>
          </div>

        </div>
      </section>

      <div className="lp-divider"/>

      {/* MEMBERSHIP */}
      <section className="lp-membership" id="membership">
        <div className="lp-membership-inner">
          <div className="lp-section-label">Access</div>
          <h2 className="lp-section-title">Made for 0xdrive members</h2>
          <p style={{fontSize:15,color:"var(--muted)",maxWidth:520,margin:"0 auto",lineHeight:1.7}}>
            0xRace is built for the 0xdrive community. If you're a Tier 2 member, you're already in. Everyone else gets full access for a one-time $45 fee.
          </p>
          <div className="lp-pricing-cards">
            <div className="lp-pricing-card featured">
              <div className="lp-pricing-badge member">0xdrive Tier 2</div>
              <div className="lp-pricing-price">$0</div>
              <div className="lp-pricing-title">Included with Tier 2</div>
              <div className="lp-pricing-sub">Already an 0xdrive Tier 2 member? 0xRace is part of your membership. Just log in and go.</div>
              <div className="lp-pricing-features">
                <div className="lp-pricing-feature">All live lobbies</div>
                <div className="lp-pricing-feature">Groups & crew chat</div>
                <div className="lp-pricing-feature">Live GPS tracking</div>
                <div className="lp-pricing-feature">Leaderboards</div>
                <div className="lp-pricing-feature">Full profile & car showcase</div>
              </div>
            </div>
            <div className="lp-pricing-card">
              <div className="lp-pricing-badge access">Standard Access</div>
              <div className="lp-pricing-price">$45<span style={{fontSize:18,fontFamily:"var(--font-sans)",fontWeight:400,color:"var(--muted)",letterSpacing:0}}> one-time</span></div>
              <div className="lp-pricing-title">One-time access</div>
              <div className="lp-pricing-sub">Not on 0xdrive yet? Pay once and get full access to everything 0xRace has to offer.</div>
              <div className="lp-pricing-features">
                <div className="lp-pricing-feature">All live lobbies</div>
                <div className="lp-pricing-feature">Groups & crew chat</div>
                <div className="lp-pricing-feature">Live GPS tracking</div>
                <div className="lp-pricing-feature">Leaderboards</div>
                <div className="lp-pricing-feature">Full profile & car showcase</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="lp-cta-banner">
        <div className="lp-cta-banner-glow"/>
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:"3px",color:"var(--accent)",textTransform:"uppercase",marginBottom:16,opacity:.9}}>Ready to roll?</div>
        <h2 className="lp-cta-title">Your lobby is waiting.</h2>
        <p className="lp-cta-sub">Grab your keys. Your crew is already out there.</p>
        <button className="lp-btn-primary" onClick={onSignUp} style={{fontSize:16,padding:"17px 48px"}}>
          Get Access
        </button>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <div style={{marginBottom:10}}>
                <img src={logoImg} alt="0x" style={{height:34,width:"auto",display:"block"}} />
              </div>
              <p>A live driving community for 0xdrive members. Find your crew, pick a lobby, make every drive count.</p>
            </div>
            <div className="lp-footer-links">
              <div className="lp-footer-col">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#membership">Membership</a>
                <a href="#" onClick={e=>{e.preventDefault();onSignUp();}}>Get Access</a>
                <a href="#" onClick={e=>{e.preventDefault();onLogin();}}>Log In</a>
              </div>
              <div className="lp-footer-col">
                <h4>Ecosystem</h4>
                <a href="https://0xotics.com" target="_blank" rel="noopener noreferrer">0xotics.com</a>
                <a href="#" style={{cursor:"default",opacity:.35}}>0xdrive</a>
                <a href="#" style={{cursor:"default",opacity:.35}}>Press Kit</a>
              </div>
              <div className="lp-footer-col">
                <h4>Social</h4>
                <a href="#" style={{cursor:"default",opacity:.35}}>Instagram</a>
                <a href="#" style={{cursor:"default",opacity:.35}}>Twitter / X</a>
                <a href="#" style={{cursor:"default",opacity:.35}}>TikTok</a>
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
