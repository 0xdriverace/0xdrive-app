import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AuthPage from "./components/AuthPage.jsx";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const GFONTS = `@import url('https://fonts.cdnfonts.com/css/pricedown');
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

/* ─── RANK TIERS ─────────────────────────────────────────────────── */
const TIERS = [
  { name:"Unranked",  min:0,   max:2,   color:"#555",    bg:"#1a1a1a", border:"#2a2a2a", icon:"—"  },
  { name:"Bronze",    min:3,   max:9,   color:"#CD7F32", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡"  },
  { name:"Silver",    min:10,  max:24,  color:"#C0C0C0", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡"  },
  { name:"Gold",      min:25,  max:49,  color:"#f59e0b", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡"  },
  { name:"Platinum",  min:50,  max:99,  color:"#22c55e", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡"  },
  { name:"Diamond",   min:100, max:Infinity, color:"#ef4444", bg:"#1a1a1a", border:"#2a2a2a", icon:"◆" },
];
const getTier = (wins) => TIERS.find(t => wins >= t.min && wins <= t.max) || TIERS[0];

const FORMAT = [
  {key:"h2h",  label:"Head to Head", short:"H2H",  icon:"⚔"},
  {key:"group",label:"Group Race",   short:"Group", icon:"◈"},
  {key:"trial",label:"Time Trial",   short:"Trial", icon:"◎"},
  {key:"drag", label:"Drag",         short:"Drag",  icon:"↑"},
];

const RACE_TIMES = [
  {key:"zero_sixty",   label:"0-60",  unit:"sec"},
  {key:"zero_120",     label:"0-120", unit:"sec"},
  {key:"quarter_mile", label:"¼ Mile",unit:"sec"},
  {key:"half_mile",    label:"½ Mile",unit:"sec"},
];

const BLANK_PROFILE = {
  id: null,
  username: "",
  displayName: "",
  showRealName: false,
  avatar: "",
  city: "",
  car: "",
  year: "",
  wins:  {h2h:0, group:0, trial:0, drag:0},
  races: {h2h:0, group:0, trial:0, drag:0},
  times: {half_mile:"", quarter_mile:"", zero_sixty:"", zero_120:""},
  socials: {instagram:"", twitter:"", youtube:""},
  lat: null,
  lng: null,
};

const tw = w => Object.values(w).reduce((a,b)=>a+b,0);

function getU(id, allUsers, myProfile) {
  if (id === myProfile?.id) return myProfile;
  return allUsers.find(x => x.id === id) || null;
}

function computeRanks(allUsers, myProfile) {
  const all = myProfile?.id ? [myProfile, ...allUsers] : allUsers;
  return all
    .map(p => ({id:p.id, totalWins:tw(p.wins||{})}))
    .sort((a,b) => b.totalWins - a.totalWins)
    .map((x,i) => ({...x, rank:i+1}));
}

function profileFromRow(row) {
  const initials = (row.display_name || row.username || "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  return {
    ...BLANK_PROFILE,
    id: row.id,
    username: row.username || "",
    displayName: row.display_name || row.username || "",
    showRealName: row.show_real_name ?? false,
    avatar: row.avatar_initials || initials,
    city: row.city || "",
    lat: row.lat ?? null,
    lng: row.lng ?? null,
  };
}

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
${GFONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#09090b;
  --s1:#131316;
  --s2:#18181b;
  --s3:#222225;
  --border:rgba(255,255,255,.06);
  --border2:rgba(255,255,255,.1);
  --border3:rgba(255,255,255,.18);
  --text:#f5f5f5;
  --text2:#a3a3a3;
  --muted:#a3a3a3;
  --muted2:#6b6b6b;
  --green:#22c55e;
  --orange:#f59e0b;
  --red:#ef4444;
  --blue:#3b82f6;
  --accent:#e4e4e7;
  --font-sans:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --font-display:"Pricedown Bl","Pricedown",var(--font-sans);
  --font-mono:"JetBrains Mono","SF Mono",monospace;
  --radius-sm:6px;
  --radius-md:10px;
  --radius-lg:16px;
  --radius-xl:24px;
  --radius-full:9999px;
  --shadow-sm:0 1px 2px rgba(0,0,0,.3);
  --shadow-md:0 4px 12px rgba(0,0,0,.4);
  --shadow-lg:0 8px 32px rgba(0,0,0,.5);
  --transition-fast:.15s cubic-bezier(.4,0,.2,1);
  --transition-base:.25s cubic-bezier(.4,0,.2,1);
}
body{background:var(--bg);color:var(--text);font-family:var(--font-sans);min-height:100vh;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
.app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:var(--border3);border-radius:3px}
::-webkit-scrollbar-track{background:transparent}

/* HEADER */
.hdr{background:rgba(9,9,11,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);padding:16px 20px 12px;position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border)}
.logo-wrap{display:flex;align-items:center;gap:10px}
.logo-mark{font-size:28px;font-weight:800;letter-spacing:-1px;color:var(--text);line-height:1;font-family:var(--font-display)}
.logo-mark span{color:var(--orange)}
.logo-sub{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;color:var(--muted);margin-top:1px;text-transform:uppercase}
.me-pill{display:flex;align-items:center;gap:10px;margin-top:12px;background:var(--s2);border-radius:var(--radius-md);padding:10px 12px;border:1px solid var(--border2)}
.me-username{font-size:13px;font-weight:600;color:var(--text)}
.me-car{font-size:11px;color:var(--muted);margin-top:1px}

/* AVATAR */
.av{border-radius:50%;background:var(--s3);color:var(--text);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;border:1.5px solid var(--border2)}
.av.s24{width:24px;height:24px;font-size:8px}
.av.s32{width:32px;height:32px;font-size:10px}
.av.s40{width:40px;height:40px;font-size:13px}
.av.s56{width:56px;height:56px;font-size:17px}
.av.me{border-color:var(--orange);color:var(--orange)}
.av.green{border-color:var(--green);color:var(--green)}

/* TIER BADGE */
.tier-badge{display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.5px;padding:3px 8px;border-radius:20px;font-weight:500;border:1px solid var(--border2);background:var(--s2);color:var(--muted)}

/* NAV */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(19,19,22,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--border);display:flex;z-index:200;padding-bottom:env(safe-area-inset-bottom)}
.ni{flex:1;padding:10px 4px 12px;text-align:center;cursor:pointer;color:var(--muted);font-size:10px;font-weight:500;border:none;background:none;transition:color .15s;display:flex;flex-direction:column;align-items:center;gap:4px}
.ni.on{color:var(--text)}
.ni-icon{font-size:20px;line-height:1}
.ni-dot{width:4px;height:4px;border-radius:50%;background:var(--orange);margin:0 auto;margin-top:2px}

/* CONTENT */
.content{flex:1;overflow-y:auto;padding:0 0 86px}

/* PAGE HEADER */
.pg-hdr{padding:20px 20px 12px}
.pg-title{font-size:24px;font-weight:700;color:var(--text);line-height:1;margin-bottom:2px;font-family:var(--font-display);letter-spacing:.5px}
.pg-sub{font-size:11px;color:var(--muted);font-weight:400}
.sec-lbl{font-size:11px;font-weight:600;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding:0 20px;margin-bottom:8px;margin-top:4px}

/* CARDS */
.card{background:var(--s2);border-radius:var(--radius-lg);padding:16px;margin:0 16px 10px;border:1px solid var(--border2);box-shadow:var(--shadow-sm)}
.card.click{cursor:pointer;transition:background var(--transition-fast)}
.card.click:active{background:var(--s3)}
.list-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border2);overflow:hidden;box-shadow:var(--shadow-sm)}
.list-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition-fast)}
.list-item:last-child{border-bottom:none}
.list-item:active{background:var(--s3)}
.list-item-icon{width:36px;height:36px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.list-item-info{flex:1;min-width:0}
.list-item-title{font-size:14px;font-weight:500;color:var(--text)}
.list-item-sub{font-size:12px;color:var(--muted);margin-top:1px}
.chevron{color:var(--muted2);font-size:14px}

/* BUTTONS */
.btn{font-family:var(--font-sans);font-size:13px;font-weight:600;padding:10px 18px;border-radius:var(--radius-md);border:none;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:var(--accent);color:#0a0a0a}
.btn-primary:hover{background:var(--accent-hover,#fff)}
.btn-secondary{background:var(--s3);color:var(--text);border:1px solid var(--border2)}
.btn-secondary:hover{background:var(--s3);border-color:var(--border3)}
.btn-green{background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3)}
.btn-orange{background:rgba(245,158,11,.15);color:var(--orange);border:1px solid rgba(245,158,11,.3)}
.btn-red{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3)}
.btn-sm{padding:6px 12px;font-size:12px;border-radius:8px}
.btn:disabled{opacity:.4;cursor:default}
.btn-full{width:100%;justify-content:center}

/* SEARCH */
.srch-wrap{position:relative;margin:0 16px 14px}
.srch-inp{width:100%;background:var(--s2);border:1px solid var(--border2);border-radius:var(--radius-md);padding:12px 16px 12px 42px;font-family:var(--font-sans);font-size:14px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.srch-inp::placeholder{color:var(--muted2)}
.srch-inp:focus{border-color:var(--border3)}
.srch-x{position:absolute;right:26px;top:50%;transform:translateY(-50%);color:var(--muted);cursor:pointer;font-size:18px;background:none;border:none;line-height:1}
.srch-icon{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:16px;pointer-events:none}

/* FILTER PILLS */
.pills{display:flex;gap:8px;padding:0 16px;margin-bottom:14px;overflow-x:auto}
.pills::-webkit-scrollbar{display:none}
.pill{font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;white-space:nowrap}
.pill.on{background:var(--text);color:var(--bg);border-color:var(--text)}

/* STAT BOXES */
.stat-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.stat-box{background:var(--s2);border-radius:14px;padding:14px;border:1px solid var(--border)}
.stat-n{font-size:32px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1px}
.stat-n.green{color:var(--green)}
.stat-n.orange{color:var(--orange)}
.stat-l{font-size:11px;color:var(--muted);font-weight:500;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}

/* GROUP CARD */
.gc-type-pill{font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:.5px}
.gc-type-pill.open{background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.25)}
.gc-type-pill.private{background:rgba(245,158,11,.15);color:var(--orange);border:1px solid rgba(245,158,11,.25)}
.gc-name{font-size:18px;font-weight:700;color:var(--text);margin:8px 0 4px;letter-spacing:-.3px}
.gc-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.tag{font-size:11px;font-weight:500;color:var(--muted);background:var(--s3);padding:4px 10px;border-radius:8px;border:1px solid var(--border)}
.gc-meta{font-size:12px;color:var(--muted)}

/* USER ROW */
.user-row{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border2);cursor:pointer;transition:background var(--transition-fast);box-shadow:var(--shadow-sm)}
.user-row:active{background:var(--s3)}
.user-name{font-size:14px;font-weight:600;color:var(--text)}
.user-username{font-size:12px;color:var(--orange);font-weight:500;margin-top:1px}
.user-car{font-size:11px;color:var(--muted);margin-top:1px}

/* MAP */
.map-wrap{margin:0 16px 14px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);background:var(--s2);position:relative;height:280px;box-shadow:var(--shadow-md)}
.mapboxgl-popup-content{background:var(--s1)!important;border:1px solid var(--border2)!important;border-radius:8px!important;padding:6px 10px!important;color:var(--text)!important;font-family:'DM Sans',sans-serif!important;box-shadow:none!important}
.mapboxgl-popup-tip{display:none}
.mapboxgl-ctrl-group{background:var(--s2)!important;border:1px solid var(--border)!important;border-radius:8px!important}
.mapboxgl-ctrl-group button{background:transparent!important;border:none!important}
.mapboxgl-ctrl-group button:hover{background:var(--s3)!important}
.mapboxgl-ctrl-icon{filter:invert(1)}

/* LEADERBOARD */
.lb-row{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border2);cursor:pointer;transition:background var(--transition-fast);box-shadow:var(--shadow-sm)}
.lb-row:active{background:var(--s3)}
.lb-row.mine{border-color:var(--orange)}
.lb-rank{font-size:14px;font-weight:700;color:var(--muted);width:24px;text-align:center;flex-shrink:0}
.lb-rank.top{color:var(--orange)}
.lb-info{flex:1;min-width:0}
.lb-name{font-size:14px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lb-sub{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-times-row{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px}
.lb-time{background:var(--s3);border-radius:6px;padding:5px;text-align:center;border:1px solid var(--border)}
.lb-time-val{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;color:var(--text);line-height:1}
.lb-time-lbl{font-size:8px;color:var(--muted);margin-top:2px;letter-spacing:.3px}
.lb-wins{text-align:right;flex-shrink:0}
.lb-wins-n{font-size:22px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1px}
.lb-wins-l{font-size:9px;color:var(--muted);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
.you-tag{font-size:9px;font-weight:600;color:var(--orange);background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);padding:2px 6px;border-radius:6px;letter-spacing:.3px}

/* VOICE */
.voice-card{background:var(--s2);border-radius:14px;margin:0 16px 10px;border:1px solid var(--border);padding:14px}
.voice-status-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.voice-dot{width:7px;height:7px;border-radius:50%;background:var(--muted2)}
.voice-dot.on{background:var(--green);animation:vpulse 1.5s infinite}
@keyframes vpulse{0%,100%{opacity:1}50%{opacity:.3}}
.voice-users{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.voice-user{display:flex;flex-direction:column;align-items:center;gap:4px}
.voice-av{width:40px;height:40px;border-radius:50%;background:var(--s3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;transition:border-color .2s}
.voice-av.speaking{border-color:var(--green)}
.voice-av.muted{opacity:.4}
.voice-name{font-size:9px;color:var(--muted);font-weight:500;letter-spacing:.3px}

/* CHAT */
.chat-msgs{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;max-height:260px;overflow-y:auto;padding:0 16px}
.msg-row{display:flex;gap:8px}
.msg-bubble{background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:10px 13px;max-width:84%}
.msg-bubble.mine{background:var(--s3);border-color:var(--border2)}
.msg-who{font-size:11px;font-weight:700;margin-bottom:3px;color:var(--orange)}
.msg-text{font-size:13px;line-height:1.5;color:var(--text2)}
.msg-time{font-size:10px;color:var(--muted);margin-top:3px}
.chat-inp-row{display:flex;gap:8px;padding:0 16px}
.chat-inp{flex:1;background:var(--s2);border:1px solid var(--border2);border-radius:var(--radius-md);padding:12px 14px;font-family:var(--font-sans);font-size:14px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.chat-inp:focus{border-color:var(--border3)}
.chat-inp::placeholder{color:var(--muted)}

/* PROFILE TIMES */
.times-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 16px 10px}
.time-box{background:var(--s2);border-radius:14px;padding:14px;border:1px solid var(--border)}
.time-lbl{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.time-val{font-size:26px;font-weight:700;color:var(--green);line-height:1;letter-spacing:-1px}
.time-unit{font-size:11px;color:var(--muted);margin-top:2px}

/* SOCIAL */
.social-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border)}
.social-item:last-child{border-bottom:none}
.social-icon{width:34px;height:34px;border-radius:10px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.social-platform{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.social-handle{font-size:13px;color:var(--text);font-weight:500;margin-top:1px}

/* INPUT */
.inp-group{margin:0 16px 10px}
.inp-label{font-size:11px;font-weight:600;letter-spacing:1px;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px}
.inp{width:100%;background:var(--s2);border:1px solid var(--border2);border-radius:var(--radius-md);padding:12px 14px;font-family:var(--font-sans);font-size:14px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.inp:focus{border-color:var(--border3)}
.inp::placeholder{color:var(--muted2)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)}
.toggle-info{}
.toggle-title{font-size:14px;font-weight:500;color:var(--text)}
.toggle-sub{font-size:12px;color:var(--muted);margin-top:2px}
.toggle{width:44px;height:26px;border-radius:13px;background:var(--s3);border:1px solid var(--border2);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--green)}
.toggle-knob{width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.toggle.on .toggle-knob{left:20px}

/* MISC */
.rule{height:1px;background:var(--border);margin:14px 16px}
.back-btn{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--muted);cursor:pointer;padding:16px 20px 8px;background:none;border:none}
.back-btn:hover{color:var(--text)}
.empty{font-size:13px;color:var(--muted);text-align:center;padding:32px 20px;font-weight:400}
.fade{animation:fu .2s ease both}
@keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.notif-dot{width:8px;height:8px;border-radius:50%;background:var(--red);display:inline-block;margin-left:3px;vertical-align:middle}
.section-divider{height:8px;background:var(--bg)}

/* ── SIDEBAR (desktop only) ───────────────────────── */
.sidebar{display:none}
.main-area{flex:1;min-width:0;display:flex;flex-direction:column}

@media(min-width:768px){
  html,body{overflow-x:hidden}
  .app{max-width:100%;flex-direction:row;align-items:flex-start;min-height:100vh}

  /* Sidebar */
  .sidebar{
    display:flex;flex-direction:column;width:240px;height:100vh;
    position:sticky;top:0;flex-shrink:0;
    background:var(--s1);border-right:1px solid var(--border2);
    overflow:hidden;z-index:150;
  }
  .sidebar-top{
    padding:24px 20px 16px;border-bottom:1px solid var(--border);flex-shrink:0;
  }
  .sidebar-logo-mark{
    font-size:24px;font-weight:800;letter-spacing:-1px;
    color:var(--text);line-height:1;font-family:var(--font-display);margin-bottom:2px;
  }
  .sidebar-logo-mark span{color:var(--orange)}
  .sidebar-logo-sub{
    font-family:var(--font-mono);font-size:7px;letter-spacing:2px;
    color:var(--muted2);text-transform:uppercase;margin-bottom:16px;
  }
  .sidebar-profile{
    display:flex;align-items:center;gap:10px;
    background:var(--s2);border-radius:var(--radius-md);
    padding:10px 12px;border:1px solid var(--border2);
  }
  .sidebar-profile-info{flex:1;min-width:0}
  .sidebar-profile-name{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Sidebar nav */
  .sidebar-nav{flex:1;padding:8px 0;overflow-y:auto}
  .sidebar-ni{
    display:flex;align-items:center;gap:12px;
    padding:11px 20px;font-size:13px;font-weight:500;
    color:var(--muted);cursor:pointer;border:none;background:none;
    width:100%;text-align:left;transition:all var(--transition-fast);
    font-family:var(--font-sans);
  }
  .sidebar-ni:hover{background:var(--s2);color:var(--text)}
  .sidebar-ni.on{color:var(--text);background:var(--s2);border-right:2px solid var(--orange)}
  .sidebar-ni-icon{font-size:18px;width:22px;text-align:center;flex-shrink:0}
  .sidebar-notif{
    margin-left:auto;min-width:18px;height:18px;border-radius:9px;
    background:var(--red);color:#fff;font-size:10px;font-weight:700;
    display:flex;align-items:center;justify-content:center;padding:0 4px;
  }
  .sidebar-bottom{padding:16px 20px;border-top:1px solid var(--border);flex-shrink:0}

  /* Hide mobile-only elements */
  .hdr{display:none}
  .nav{display:none!important}

  /* Main area */
  .main-area{max-width:720px;margin:0 auto;width:100%;padding:0 8px}
  .content{padding:0 0 48px}
  .pg-hdr{padding:28px 20px 16px}
  .pg-title{font-size:28px}

  /* Wider map on desktop */
  .map-wrap{height:420px}

  /* Cards side-by-side on desktop */
  .desktop-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px;margin-bottom:10px}
  .desktop-2col .card{margin:0}
}

@media(min-width:1100px){
  .sidebar{width:260px}
  .main-area{max-width:800px}
}
`;

/* ─── TIER BADGE ─────────────────────────────────────────────────── */
function TierBadge({ wins }) {
  const t = getTier(wins);
  return (
    <span className="tier-badge" style={{color:t.color,borderColor:t.color+"44"}}>
      {t.icon} {t.name}
    </span>
  );
}

/* ─── APP ────────────────────────────────────────────────────────── */
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState("Groups");
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendReqs, setFriendReqs] = useState([]);
  const [groupReqs, setGroupReqs] = useState([]);
  const [playerView, setPlayerView] = useState(null);
  const [chatGroupId, setChatGroupId] = useState(null);
  const [myProfile, setMyProfile] = useState({...BLANK_PROFILE});
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadData(session.user.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadData(session.user.id);
      else {
        setMyProfile({...BLANK_PROFILE});
        setAllUsers([]);
        setGroups([]);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId) => {
    try {
      const [profileRes, usersRes, groupsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*").neq("id", userId),
        supabase.from("groups").select("*, group_members(user_id, role, status)"),
      ]);

      if (profileRes.data) {
        setMyProfile(profileFromRow(profileRes.data));
      }

      if (usersRes.data) {
        setAllUsers(usersRes.data.map(profileFromRow));
      }

      if (groupsRes.data) {
        setGroups(groupsRes.data.map(g => ({
          id: g.id,
          name: g.name,
          desc: g.description || "",
          type: g.is_private ? "private" : "open",
          max: g.max_members,
          tags: g.tags || [],
          memberIds: (g.group_members || [])
            .filter(m => m.status === "active")
            .map(m => m.user_id),
          admin: g.created_by,
          lastActive: "recently",
          messages: [],
          pendingRequests: [],
        })));
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="app" style={{alignItems:"center",justifyContent:"center"}}>
          <div style={{color:"var(--muted)",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Loading…</div>
        </div>
      </>
    );
  }

  if (!session) return <AuthPage />;

  const myId = session.user.id;
  const isFriend = id => friends.includes(id);
  const sentFR   = id => friendReqs.includes(id);
  const addFR    = id => { if (!sentFR(id)) setFriendReqs(r=>[...r,id]); };

  const isInGroup = gid => groups.find(g=>g.id===gid)?.memberIds.includes(myId);
  const sentGR    = gid => groupReqs.includes(gid);
  const joinGroup = gid => setGroups(gs=>gs.map(g=>
    g.id===gid && !g.memberIds.includes(myId) ? {...g, memberIds:[...g.memberIds, myId]} : g
  ));
  const reqGroup = gid => { if (!sentGR(gid)) setGroupReqs(r=>[...r,gid]); };

  const pendingCount = groups.reduce((a,g)=>a+(g.pendingRequests?.length||0),0);
  const showNav = !playerView && !chatGroupId && !editingProfile;

  const TABS = [
    {name:"Groups", icon:"👥"},
    {name:"Search", icon:"🔍"},
    {name:"Map",    icon:"📍"},
    {name:"Ranks",  icon:"🏆"},
    {name:"Profile",icon:"👤"},
  ];

  const activeTab = !playerView && !chatGroupId && !editingProfile ? tab : null;

  const goTab = (name) => {
    setTab(name);
    setPlayerView(null);
    setChatGroupId(null);
    setEditingProfile(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ── Desktop sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-logo-mark">0X<span>RACE</span></div>
            <div className="sidebar-logo-sub">Powered by 0xDrive</div>
            <div className="sidebar-profile">
              <div className="av s32 me">{myProfile.avatar}</div>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">@{myProfile.username}</div>
                <TierBadge wins={tw(myProfile.wins)} />
              </div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {TABS.map(({name,icon})=>(
              <button key={name} className={`sidebar-ni ${activeTab===name?"on":""}`} onClick={()=>goTab(name)}>
                <span className="sidebar-ni-icon">{icon}</span>
                <span>{name}</span>
                {name==="Groups"&&pendingCount>0&&<span className="sidebar-notif">{pendingCount}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="btn btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="main-area">
          <Header myProfile={myProfile} onLogout={handleLogout} />
          <div className="content fade" key={tab+playerView+chatGroupId+editingProfile}>
            {editingProfile ? (
              <EditProfile myProfile={myProfile} setMyProfile={setMyProfile} onBack={()=>setEditingProfile(false)} />
            ) : playerView ? (
              <UserProfile userId={playerView} onBack={()=>setPlayerView(null)}
                isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                groups={groups} isInGroup={isInGroup} sentGR={sentGR}
                joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile} />
            ) : chatGroupId ? (
              <ChatView groupId={chatGroupId} groups={groups} setGroups={setGroups}
                onBack={()=>setChatGroupId(null)} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers} />
            ) : tab==="Groups" ? (
              <GroupsView groups={groups} setGroups={setGroups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup}
                openChat={setChatGroupId} pendingCount={pendingCount}
                allUsers={allUsers} myProfile={myProfile} />
            ) : tab==="Search" ? (
              <SearchView isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                openPlayer={setPlayerView} groups={groups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile} />
            ) : tab==="Map" ? (
              <MapView groups={groups} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers} />
            ) : tab==="Ranks" ? (
              <RanksView openPlayer={setPlayerView} myProfile={myProfile} allUsers={allUsers} />
            ) : (
              <ProfileView myProfile={myProfile} friends={friends} groups={groups}
                openPlayer={setPlayerView} onEdit={()=>setEditingProfile(true)}
                allUsers={allUsers} />
            )}
          </div>

          {/* Mobile bottom nav */}
          {showNav && (
            <nav className="nav">
              {TABS.map(({name,icon})=>(
                <button key={name} className={`ni ${tab===name?"on":""}`} onClick={()=>setTab(name)}>
                  <span className="ni-icon">{icon}</span>
                  <span>{name}</span>
                  {tab===name && <div className="ni-dot"/>}
                  {name==="Groups"&&pendingCount>0&&<span className="notif-dot"/>}
                </button>
              ))}
            </nav>
          )}
        </div>

      </div>
    </>
  );
}

/* ─── HEADER ─────────────────────────────────────────────────────── */
function Header({ myProfile, onLogout }) {
  return (
    <div className="hdr">
      <div className="logo-wrap">
        <div style={{flex:1}}>
          <div className="logo-mark">0X<span>RACE</span></div>
          <div className="logo-sub">Powered by 0xDrive</div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onLogout}
          style={{fontSize:11,padding:"5px 10px"}}
        >
          Sign Out
        </button>
      </div>
      <div className="me-pill">
        <div className="av s32 me">{myProfile.avatar}</div>
        <div style={{flex:1}}>
          <div className="me-username">@{myProfile.username}</div>
          <div className="me-car">{myProfile.year} {myProfile.car}</div>
        </div>
        <TierBadge wins={tw(myProfile.wins)} />
      </div>
    </div>
  );
}

/* ─── GROUPS ─────────────────────────────────────────────────────── */
function GroupsView({ groups, setGroups, isInGroup, sentGR, joinGroup, reqGroup, openChat, pendingCount, allUsers, myProfile }) {
  const [showPending, setShowPending] = useState(false);

  const approve = (gid, uid) => setGroups(gs=>gs.map(g=>g.id===gid?{...g,memberIds:[...g.memberIds,uid],pendingRequests:g.pendingRequests.filter(r=>r!==uid)}:g));
  const deny    = (gid, uid) => setGroups(gs=>gs.map(g=>g.id===gid?{...g,pendingRequests:g.pendingRequests.filter(r=>r!==uid)}:g));

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Groups</div>
        <div className="pg-sub">Portland, OR · Find your crew</div>
      </div>

      {pendingCount>0&&(
        <div className="card" style={{borderColor:"rgba(245,158,11,.4)",cursor:"pointer",marginBottom:12}} onClick={()=>setShowPending(!showPending)}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:14,fontWeight:600}}>Join Requests <span style={{background:"rgba(245,158,11,.2)",color:"var(--orange)",fontSize:11,padding:"2px 7px",borderRadius:10,marginLeft:4}}>{pendingCount}</span></div>
            <span style={{color:"var(--muted)",fontSize:12}}>{showPending?"▲":"▼"}</span>
          </div>
          {showPending&&groups.filter(g=>g.pendingRequests?.length>0).map(g=>(
            <div key={g.id} style={{marginTop:12}}>
              <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,fontWeight:600,textTransform:"uppercase",marginBottom:8}}>{g.name}</div>
              {g.pendingRequests.map(uid=>{
                const u = getU(uid, allUsers, myProfile);
                return u?(
                  <div key={uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div className="av s32">{u.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>@{u.username}</div>
                    </div>
                    <button className="btn btn-green btn-sm" onClick={e=>{e.stopPropagation();approve(g.id,uid);}}>Accept</button>
                    <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();deny(g.id,uid);}}>Deny</button>
                  </div>
                ):null;
              })}
            </div>
          ))}
        </div>
      )}

      {groups.length===0&&<div className="empty">No groups yet.</div>}

      {groups.map(g=>(
        <div key={g.id} className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Open"}</span>
            <span style={{fontSize:11,color:"var(--muted)"}}>{g.memberIds.length}/{g.max} members</span>
          </div>
          <div className="gc-name">{g.name}</div>
          {g.desc&&<div className="gc-desc">{g.desc}</div>}
          {g.tags.length>0&&<div className="tags">{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"var(--muted)"}}>Active {g.lastActive}</span>
            <div style={{display:"flex",gap:8}}>
              {isInGroup(g.id)&&<button className="btn btn-secondary btn-sm" onClick={()=>openChat(g.id)}>Chat →</button>}
              {!isInGroup(g.id)&&!sentGR(g.id)&&(
                <button className="btn btn-primary btn-sm" onClick={()=>{
                  if (g.type==="open") joinGroup(g.id);
                  else {
                    setGroups(gs=>gs.map(x=>x.id===g.id?{...x,pendingRequests:[...(x.pendingRequests||[]),myProfile.id]}:x));
                    reqGroup(g.id);
                  }
                }}>{g.type==="open"?"Join":"Request to Join"}</button>
              )}
              {!isInGroup(g.id)&&sentGR(g.id)&&<button className="btn btn-orange btn-sm" disabled>Pending</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── SEARCH ─────────────────────────────────────────────────────── */
function SearchView({ isFriend, sentFR, addFR, openPlayer, groups, isInGroup, sentGR, joinGroup, reqGroup, allUsers, myProfile }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("Users");

  const users = allUsers.filter(p=>!q||
    p.username.toLowerCase().includes(q.toLowerCase())||
    p.displayName.toLowerCase().includes(q.toLowerCase())||
    (p.car||"").toLowerCase().includes(q.toLowerCase())||
    (p.city||"").toLowerCase().includes(q.toLowerCase())
  );

  const filteredGroups = groups.filter(g=>!q||
    g.name.toLowerCase().includes(q.toLowerCase())||
    g.tags.some(t=>t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Search</div>
        <div className="pg-sub">Find users & groups</div>
      </div>

      <div className="srch-wrap">
        <span className="srch-icon">🔍</span>
        <input className="srch-inp" placeholder={mode==="Users"?"Search username, car, city…":"Search groups…"}
          value={q} onChange={e=>setQ(e.target.value)} />
        {q&&<button className="srch-x" onClick={()=>setQ("")}>×</button>}
      </div>

      <div className="pills">
        {["Users","Groups"].map(m=>(
          <button key={m} className={`pill ${mode===m?"on":""}`} onClick={()=>setMode(m)}>{m}</button>
        ))}
      </div>

      {mode==="Users"&&(
        users.length===0
          ? <div className="empty">{allUsers.length===0?"No other users yet.":"No users found"}</div>
          : users.map(p=>{
            const rank = computeRanks(allUsers, myProfile).find(r=>r.id===p.id)?.rank??99;
            return (
              <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
                <div className="av s40">{p.avatar}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="user-username">@{p.username}</div>
                  {p.showRealName&&<div className="user-name">{p.displayName}</div>}
                  {p.car&&<div className="user-car">{p.year} {p.car}</div>}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <TierBadge wins={tw(p.wins)} />
                    <span style={{fontSize:10,color:"var(--muted)"}}>#{rank}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  {!isFriend(p.id)&&!sentFR(p.id)&&<button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();addFR(p.id);}}>+ Add</button>}
                  {!isFriend(p.id)&&sentFR(p.id)&&<button className="btn btn-secondary btn-sm" disabled>Sent</button>}
                  {isFriend(p.id)&&<span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓</span>}
                </div>
              </div>
            );
          })
      )}

      {mode==="Groups"&&(
        filteredGroups.length===0
          ? <div className="empty">{groups.length===0?"No groups yet.":"No groups found"}</div>
          : filteredGroups.map(g=>(
            <div key={g.id} className="card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Open"}</span>
                <span style={{fontSize:11,color:"var(--muted)"}}>{g.memberIds.length}/{g.max}</span>
              </div>
              <div className="gc-name">{g.name}</div>
              {g.desc&&<div className="gc-desc">{g.desc}</div>}
              {g.tags.length>0&&<div className="tags">{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                {isInGroup(g.id)
                  ? <button className="btn btn-secondary btn-sm">In Group ✓</button>
                  : sentGR(g.id)
                    ? <button className="btn btn-orange btn-sm" disabled>Pending</button>
                    : <button className="btn btn-primary btn-sm" onClick={()=>g.type==="open"?joinGroup(g.id):reqGroup(g.id)}>{g.type==="open"?"Join":"Request"}</button>
                }
              </div>
            </div>
          ))
      )}
    </div>
  );
}

/* ─── USER PROFILE ───────────────────────────────────────────────── */
function UserProfile({ userId, onBack, isFriend, sentFR, addFR, groups, isInGroup, sentGR, joinGroup, reqGroup, allUsers, myProfile }) {
  const p = getU(userId, allUsers, myProfile);
  if (!p) return null;
  const isMe = userId === myProfile.id;
  const totalW = tw(p.wins);
  const userGroups = groups.filter(g=>g.memberIds.includes(userId));
  const socials = Object.entries(p.socials||{}).filter(([,v])=>v);
  const hasTimes = p.times&&Object.values(p.times).some(v=>v);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div style={{padding:"0 16px 16px"}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16}}>
          <div className={`av s56 ${isMe?"me":""}`}>{p.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--orange)",fontWeight:600,marginBottom:2}}>@{p.username}</div>
            {p.showRealName&&<div style={{fontSize:22,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{p.displayName}</div>}
            {p.car&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{p.year} {p.car}</div>}
            {p.city&&<div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>📍 {p.city}</div>}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontSize:11,color:"var(--muted)"}}>#{computeRanks(allUsers,myProfile).find(x=>x.id===userId)?.rank??"-"} Global · {totalW} wins</span>
            </div>
          </div>
        </div>

        {!isMe&&(
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {!isFriend(userId)&&!sentFR(userId)&&<button className="btn btn-primary" onClick={()=>addFR(userId)}>+ Add Friend</button>}
            {!isFriend(userId)&&sentFR(userId)&&<button className="btn btn-secondary" disabled>Request Sent</button>}
            {isFriend(userId)&&<span className="btn btn-green" style={{cursor:"default"}}>✓ Friends</span>}
          </div>
        )}
      </div>

      {/* Race Stats */}
      <div className="sec-lbl">Race Stats</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",marginBottom:10}}>
        {FORMAT.map(f=>(
          <div key={f.key} style={{background:"var(--s2)",borderRadius:12,padding:"10px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
            <div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{f.icon}</div>
            <div style={{fontSize:20,fontWeight:700,lineHeight:1}}>{p.wins[f.key]??0}</div>
            <div style={{fontSize:9,color:"var(--muted)",marginTop:3,letterSpacing:.5}}>{f.short}</div>
          </div>
        ))}
      </div>

      {/* Recorded Times */}
      {hasTimes&&(<>
        <div className="sec-lbl">Recorded Times</div>
        <div className="times-grid">
          {RACE_TIMES.map(t=>(
            <div key={t.key} className="time-box">
              <div className="time-lbl">{t.label}</div>
              <div className="time-val">{p.times[t.key]||"—"}</div>
              {p.times[t.key]&&<div className="time-unit">{t.unit}</div>}
            </div>
          ))}
        </div>
      </>)}

      {/* Socials */}
      {socials.length>0&&(<>
        <div className="sec-lbl">Socials</div>
        <div className="list-card" style={{margin:"0 16px 10px"}}>
          {socials.map(([platform,handle])=>(
            <div key={platform} className="social-item">
              <div className="social-icon">{platform==="instagram"?"📸":platform==="twitter"?"𝕏":"▶️"}</div>
              <div>
                <div className="social-platform">{platform}</div>
                <div className="social-handle">{handle}</div>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* Groups */}
      {userGroups.length>0&&!isMe&&(<>
        <div className="sec-lbl">Groups</div>
        {userGroups.map(g=>(
          <div key={g.id} className="card" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:15,fontWeight:600}}>{g.name}</div>
              <span className={`gc-type-pill ${g.type}`} style={{marginTop:4,display:"inline-block"}}>{g.type}</span>
            </div>
            {isInGroup(g.id)
              ? <span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ In</span>
              : sentGR(g.id)
                ? <span className="btn btn-orange btn-sm" style={{cursor:"default"}}>Pending</span>
                : <button className="btn btn-primary btn-sm" onClick={()=>g.type==="open"?joinGroup(g.id):reqGroup(g.id)}>{g.type==="open"?"Join":"Request"}</button>
            }
          </div>
        ))}
      </>)}
    </div>
  );
}

/* ─── CHAT VIEW ──────────────────────────────────────────────────── */
function ChatView({ groupId, groups, setGroups, onBack, openPlayer, myProfile, allUsers }) {
  const g = groups.find(x=>x.id===groupId);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const endRef = useRef(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[g?.messages.length]);

  const send = () => {
    if (!input.trim()) return;
    setGroups(gs=>gs.map(x=>x.id===groupId?{...x,messages:[...x.messages,{uid:myProfile.id,text:input.trim(),time:"just now"}]}:x));
    setInput("");
  };

  if (!g) return null;
  const members = g.memberIds.map(id => getU(id, allUsers, myProfile)).filter(Boolean);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Groups</button>

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">{g.name}</div>
        <div className="pg-sub">{g.type} · {g.memberIds.length} members</div>
      </div>

      {/* Voice */}
      <div className="voice-card">
        <div className="voice-status-row">
          <div className={`voice-dot ${voiceOn?"on":""}`}/>
          <span style={{fontSize:12,fontWeight:600,color:voiceOn?"var(--green)":"var(--muted)",letterSpacing:.5}}>
            {voiceOn?"Voice Active":"Voice Channel"}
          </span>
        </div>
        {voiceOn&&(
          <div className="voice-users">
            {members.slice(0,6).map(m=>(
              <div key={m.id} className="voice-user">
                <div className={`voice-av ${m.id===myProfile.id&&muted?"muted":""}`}>
                  {m.avatar}
                </div>
                <div className="voice-name">@{m.username||m.avatar}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button className={`btn btn-sm ${voiceOn?"btn-red":"btn-green"}`} onClick={()=>setVoiceOn(!voiceOn)}>
            {voiceOn?"Leave":"Join Voice"}
          </button>
          {voiceOn&&<button className={`btn btn-sm ${muted?"btn-orange":"btn-secondary"}`} onClick={()=>setMuted(!muted)}>
            {muted?"🔇 Muted":"🎙 Live"}
          </button>}
        </div>
      </div>

      {/* Members */}
      <div className="sec-lbl">Members</div>
      <div className="list-card" style={{margin:"0 16px 14px"}}>
        {members.map(m=>(
          <div key={m.id} className="list-item" onClick={()=>m.id!==myProfile.id&&openPlayer(m.id)}>
            <div className={`av s32 ${m.id===myProfile.id?"me":""}`}>{m.avatar}</div>
            <div className="list-item-info">
              <div className="list-item-title">
                @{m.username||m.avatar}
                {m.id===myProfile.id&&<span style={{fontSize:10,color:"var(--orange)",marginLeft:6,fontWeight:600}}>YOU</span>}
              </div>
              <div className="list-item-sub">{tw(m.wins)} wins</div>
            </div>
            <TierBadge wins={tw(m.wins)} />
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="sec-lbl">Group Chat</div>
      <div className="chat-msgs">
        {g.messages.length===0&&<div className="empty">No messages yet. Start the conversation.</div>}
        {g.messages.map((msg,i)=>{
          const sender = getU(msg.uid, allUsers, myProfile);
          const mine = msg.uid===myProfile.id;
          return (
            <div key={i} className="msg-row">
              <div className={`av s24 ${mine?"me":""}`}>{sender?.avatar}</div>
              <div className={`msg-bubble ${mine?"mine":""}`}>
                <div className="msg-who">@{sender?.username||"?"}</div>
                <div className="msg-text">{msg.text}</div>
                <div className="msg-time">{msg.time}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div className="chat-inp-row">
        <input className="chat-inp" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message…"/>
        <button className="btn btn-primary" style={{borderRadius:12,padding:"12px 16px"}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

/* ─── MAP VIEW ───────────────────────────────────────────────────── */
function MapView({ groups, openPlayer, myProfile, allUsers }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [filter, setFilter] = useState("All");

  const myId = myProfile.id;
  const myGroups = groups.filter(g=>g.memberIds.includes(myId));
  const allWithMe = myProfile.lat != null ? [myProfile, ...allUsers] : allUsers;

  const visibleUsers = allWithMe.filter(p => {
    if (p.lat == null || p.lng == null) return false;
    if (filter==="All") return true;
    return groups.find(g=>g.id===filter)?.memberIds.includes(p.id);
  });

  // Init map once
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-122.6765, 45.5231],
      zoom: 11,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update markers when visible users or filter changes
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    visibleUsers.forEach(p => {
      const isMe = p.id === myId;
      const el = document.createElement("div");
      el.style.cssText = [
        `width:${isMe?14:10}px`,
        `height:${isMe?14:10}px`,
        "border-radius:50%",
        `background:${isMe?"#f59e0b":"#ffffff"}`,
        `border:2px solid ${isMe?"#f59e0b":"#444"}`,
        "cursor:pointer",
        `box-shadow:${isMe?"0 0 8px rgba(245,158,11,0.5)":"none"}`,
      ].join(";");
      el.addEventListener("click", () => openPlayer(p.id));

      const popup = new mapboxgl.Popup({ offset:14, closeButton:false, closeOnClick:false })
        .setHTML(`<span style="font-size:12px;font-weight:600">@${p.username}</span>${p.city?`<br><span style="font-size:10px;opacity:.7">${p.city}</span>`:""}`);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [visibleUsers, myId]);

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Live Map</div>
        <div className="pg-sub">Portland metro · Group members</div>
      </div>

      <div className="pills">
        <button className={`pill ${filter==="All"?"on":""}`} onClick={()=>setFilter("All")}>All</button>
        {myGroups.map(g=>(
          <button key={g.id} className={`pill ${filter===g.id?"on":""}`} onClick={()=>setFilter(g.id)}>
            {g.name.split(" ").slice(0,2).join(" ")}
          </button>
        ))}
      </div>

      <div className="map-wrap">
        <div ref={mapContainer} style={{width:"100%",height:"100%"}} />
      </div>

      <div className="sec-lbl">{visibleUsers.length} {visibleUsers.length===1?"User":"Users"} on Map</div>
      {visibleUsers.length===0&&<div className="empty">No members with location data.</div>}
      {visibleUsers.map(p=>{
        const isMe = p.id===myId;
        return (
          <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
            <div style={{width:9,height:9,borderRadius:"50%",background:isMe?"#f59e0b":"#fff",flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">
                @{p.username}
                {isMe&&<span style={{fontSize:10,color:"var(--orange)",marginLeft:6}}>YOU</span>}
              </div>
              {p.city&&<div className="user-car">{p.city}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── RANKS VIEW ─────────────────────────────────────────────────── */
function RanksView({ openPlayer, myProfile, allUsers }) {
  const [period, setPeriod] = useState("All Time");
  const [fmt, setFmt] = useState("Total");
  const [showTimes, setShowTimes] = useState(false);

  const getW = p => {
    if (fmt==="Total") return tw(p.wins||{});
    const k={H2H:"h2h",Group:"group",Trial:"trial",Drag:"drag"}[fmt]||"h2h";
    return (p.wins||{})[k]??0;
  };

  const allForRanks = myProfile.id ? [myProfile, ...allUsers] : allUsers;
  const sorted = allForRanks.map(p=>({p,w:getW(p),isMe:p.id===myProfile.id})).sort((a,b)=>b.w-a.w);

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Rankings</div>
        <div className="pg-sub">Global leaderboard · all users</div>
      </div>

      {/* Tier legend */}
      <div style={{display:"flex",gap:6,padding:"0 16px",marginBottom:14,flexWrap:"wrap"}}>
        {TIERS.slice(1).map(t=>(
          <span key={t.name} style={{fontSize:10,fontWeight:600,color:t.color,background:"var(--s2)",border:`1px solid ${t.color}33`,padding:"4px 10px",borderRadius:20}}>
            {t.icon} {t.name} ≥{t.min}W
          </span>
        ))}
      </div>

      <div className="pills">
        {["All Time","Monthly","Weekly"].map(v=>(
          <button key={v} className={`pill ${period===v?"on":""}`} onClick={()=>setPeriod(v)}>{v}</button>
        ))}
      </div>
      <div className="pills">
        {["Total","H2H","Group","Trial","Drag"].map(v=>(
          <button key={v} className={`pill ${fmt===v?"on":""}`} onClick={()=>setFmt(v)}>{v}</button>
        ))}
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",marginBottom:10}}>
        <span style={{fontSize:11,color:"var(--muted)",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Race Times</span>
        <button className={`pill ${showTimes?"on":""}`} style={{fontSize:11,padding:"4px 12px"}} onClick={()=>setShowTimes(!showTimes)}>
          {showTimes?"Hide":"Show"}
        </button>
      </div>

      {sorted.length===0&&<div className="empty">No users yet.</div>}

      {sorted.map((entry,i)=>{
        const tier = getTier(tw(entry.p.wins||{}));
        const hasTimes = entry.p.times&&Object.values(entry.p.times).some(v=>v);
        return (
          <div key={entry.p.id} className={`lb-row ${entry.isMe?"mine":""}`} onClick={()=>openPlayer(entry.p.id)}>
            <div className={`lb-rank ${i<3?"top":""}`}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <div className={`av s32 ${entry.isMe?"me":""}`}>{entry.p.avatar}</div>
            <div className="lb-info">
              <div className="lb-name">
                <span style={{color:"var(--orange)",fontWeight:600}}>@{entry.p.username}</span>
                {entry.isMe&&<span className="you-tag">YOU</span>}
                <span style={{fontSize:10,color:tier.color,fontWeight:600}}>{tier.name}</span>
              </div>
              {entry.p.showRealName&&<div style={{fontSize:11,color:"var(--muted)"}}>{entry.p.displayName}</div>}
              {(entry.p.car||entry.p.city)&&<div className="lb-sub">{[entry.p.car,entry.p.city].filter(Boolean).join(" · ")}</div>}
              {showTimes&&hasTimes&&(
                <div className="lb-times-row">
                  {RACE_TIMES.map(t=>(
                    <div key={t.key} className="lb-time">
                      <div className="lb-time-val">{entry.p.times[t.key]||"—"}</div>
                      <div className="lb-time-lbl">{t.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="lb-wins">
              <div className="lb-wins-n" style={{color:i<3?tier.color:"var(--text)"}}>{entry.w}</div>
              <div className="lb-wins-l">wins</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PROFILE VIEW ───────────────────────────────────────────────── */
function ProfileView({ myProfile, friends, groups, openPlayer, onEdit, allUsers }) {
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const myFriends = allUsers.filter(p=>friends.includes(p.id));
  const totalW = tw(myProfile.wins);
  const totalR = Object.values(myProfile.races).reduce((a,b)=>a+b,0);
  const tier = getTier(totalW);
  const nextTier = TIERS[TIERS.indexOf(tier)+1];
  const progress = nextTier?((totalW-tier.min)/(nextTier.min-tier.min))*100:100;
  const socials = Object.entries(myProfile.socials||{}).filter(([,v])=>v);
  const hasTimes = myProfile.times&&Object.values(myProfile.times).some(v=>v);
  const myRank = computeRanks(allUsers, myProfile).find(x=>x.id===myProfile.id)?.rank??"-";

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Profile</div>
          <div className="pg-sub">Your driver record</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{marginTop:4}}>Edit</button>
      </div>

      {/* Hero card */}
      <div className="card" style={{marginBottom:10}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
          <div className="av s56 me">{myProfile.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--orange)",fontWeight:600,marginBottom:2}}>@{myProfile.username}</div>
            {myProfile.showRealName&&<div style={{fontSize:20,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{myProfile.displayName}</div>}
            {myProfile.car&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{myProfile.year} {myProfile.car}</div>}
            {myProfile.city&&<div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>📍 {myProfile.city}</div>}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontSize:11,color:"var(--muted)"}}>Rank #{myRank} Global</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{marginBottom:4,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:10,color:tier.color,fontWeight:600,letterSpacing:.5}}>{tier.name.toUpperCase()} · {totalW} WINS</span>
          {nextTier&&<span style={{fontSize:10,color:"var(--muted)"}}>→ {nextTier.name} at {nextTier.min}W</span>}
        </div>
        <div style={{height:4,background:"var(--s3)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(progress,100)}%`,background:tier.color,borderRadius:2,transition:"width .5s"}}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",marginBottom:10}}>
        <div style={{background:"var(--s2)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
          <div style={{fontSize:26,fontWeight:700,lineHeight:1,color:"var(--text)"}}>{totalW}</div>
          <div style={{fontSize:9,color:"var(--muted)",marginTop:4,letterSpacing:.5,textTransform:"uppercase"}}>Wins</div>
        </div>
        <div style={{background:"var(--s2)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
          <div style={{fontSize:26,fontWeight:700,lineHeight:1}}>{totalR}</div>
          <div style={{fontSize:9,color:"var(--muted)",marginTop:4,letterSpacing:.5,textTransform:"uppercase"}}>Races</div>
        </div>
        <div style={{background:"var(--s2)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
          <div style={{fontSize:26,fontWeight:700,lineHeight:1,color:"var(--green)"}}>{totalR>0?Math.round((totalW/totalR)*100):0}%</div>
          <div style={{fontSize:9,color:"var(--muted)",marginTop:4,letterSpacing:.5,textTransform:"uppercase"}}>Rate</div>
        </div>
        <div style={{background:"var(--s2)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
          <div style={{fontSize:26,fontWeight:700,lineHeight:1,color:"var(--orange)"}}>#{myRank}</div>
          <div style={{fontSize:9,color:"var(--muted)",marginTop:4,letterSpacing:.5,textTransform:"uppercase"}}>Rank</div>
        </div>
      </div>

      {/* Format breakdown */}
      <div className="sec-lbl">By Format</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:10}}>
        {FORMAT.map(f=>(
          <div key={f.key} style={{background:"var(--s2)",borderRadius:12,padding:"12px",border:"1px solid var(--border)"}}>
            <div style={{fontSize:13,marginBottom:4}}>{f.icon} <span style={{fontSize:11,color:"var(--muted)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{f.label}</span></div>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontSize:24,fontWeight:700,lineHeight:1}}>{myProfile.wins[f.key]??0}</span>
              <span style={{fontSize:11,color:"var(--muted)"}}>/ {myProfile.races[f.key]??0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Times */}
      {hasTimes&&(<>
        <div className="sec-lbl">Recorded Times</div>
        <div className="times-grid">
          {RACE_TIMES.map(t=>(
            <div key={t.key} className="time-box">
              <div className="time-lbl">{t.label}</div>
              <div className="time-val">{myProfile.times?.[t.key]||"—"}</div>
              {myProfile.times?.[t.key]&&<div className="time-unit">{t.unit}</div>}
            </div>
          ))}
        </div>
      </>)}

      {/* Socials */}
      {socials.length>0&&(<>
        <div className="sec-lbl">Socials</div>
        <div className="list-card" style={{margin:"0 16px 10px"}}>
          {socials.map(([platform,handle])=>(
            <div key={platform} className="social-item">
              <div className="social-icon">{platform==="instagram"?"📸":platform==="twitter"?"𝕏":"▶️"}</div>
              <div>
                <div className="social-platform">{platform}</div>
                <div className="social-handle">{handle}</div>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* Friends */}
      <div className="sec-lbl">Friends ({myFriends.length})</div>
      {myFriends.length===0&&<div className="empty" style={{textAlign:"left",padding:"10px 16px"}}>No friends yet — use Search.</div>}
      {myFriends.map(p=>(
        <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
          <div className="av s32">{p.avatar}</div>
          <div style={{flex:1}}>
            <div className="user-name">@{p.username}</div>
            <div className="user-car">{tw(p.wins)}W</div>
          </div>
          <TierBadge wins={tw(p.wins)} />
        </div>
      ))}

      {/* Groups */}
      <div className="sec-lbl" style={{marginTop:6}}>My Groups ({myGroups.length})</div>
      {myGroups.length===0&&<div className="empty" style={{textAlign:"left",padding:"10px 16px"}}>No groups yet.</div>}
      {myGroups.map(g=>(
        <div key={g.id} style={{background:"var(--s2)",borderRadius:14,margin:"0 16px 8px",border:"1px solid var(--border)",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600}}>{g.name}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{g.memberIds.length}/{g.max} members · {g.lastActive}</div>
          </div>
          <span className={`gc-type-pill ${g.type}`}>{g.type}</span>
        </div>
      ))}
      <div style={{height:20}}/>
    </div>
  );
}

/* ─── EDIT PROFILE ───────────────────────────────────────────────── */
function EditProfile({ myProfile, setMyProfile, onBack }) {
  const [form, setForm] = useState({...myProfile});

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Profile</button>
      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">Edit Profile</div>
        <div className="pg-sub">Update your information</div>
      </div>

      <div className="list-card" style={{margin:"0 16px 10px"}}>
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-title">Show Real Name</div>
            <div className="toggle-sub">Display your name publicly</div>
          </div>
          <div className={`toggle ${form.showRealName?"on":""}`} onClick={()=>setForm({...form,showRealName:!form.showRealName})}>
            <div className="toggle-knob"/>
          </div>
        </div>
      </div>

      <div className="sec-lbl">Identity</div>
      <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
        {[["Username","username","@username"],["Display Name","displayName","Your real name"],["Car","car","Your car"],["Year","year","Year"],["City","city","City, State"]].map(([label,key,ph])=>(
          <div key={key}>
            <label className="inp-label">{label}</label>
            <input className="inp" value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={ph}/>
          </div>
        ))}
      </div>

      <div className="sec-lbl">Recorded Times</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:10}}>
        {RACE_TIMES.map(t=>(
          <div key={t.key} style={{background:"var(--s2)",borderRadius:12,padding:"12px",border:"1px solid var(--border)"}}>
            <label className="inp-label" style={{padding:0,marginBottom:6}}>{t.label} ({t.unit})</label>
            <input className="inp" style={{marginBottom:0,padding:"8px 10px",fontSize:13}} value={form.times?.[t.key]||""} onChange={e=>setForm({...form,times:{...form.times,[t.key]:e.target.value}})} placeholder="e.g. 3.8"/>
          </div>
        ))}
      </div>

      <div className="sec-lbl">Social Media</div>
      <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
        {[["📸 Instagram","instagram","@handle"],["𝕏 Twitter","twitter","@handle"],["▶️ YouTube","youtube","@channel"]].map(([label,key,ph])=>(
          <div key={key}>
            <label className="inp-label">{label}</label>
            <input className="inp" value={form.socials?.[key]||""} onChange={e=>setForm({...form,socials:{...form.socials,[key]:e.target.value}})} placeholder={ph}/>
          </div>
        ))}
      </div>

      <div style={{padding:"10px 16px 30px"}}>
        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:"14px"}} onClick={()=>{setMyProfile(form);onBack();}}>
          Save Changes
        </button>
      </div>
    </div>
  );
}
