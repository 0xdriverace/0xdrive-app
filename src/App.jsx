import { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AuthPage from "./components/AuthPage.jsx";
import LandingPage from "./components/LandingPage.jsx";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const GFONTS = `@import url('https://fonts.cdnfonts.com/css/pricedown');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

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

const LEADERBOARD_CATS = [
  { key:"0-60",         label:"0-60",   sub:"mph" },
  { key:"0-120",        label:"0-120",  sub:"mph" },
  { key:"quarter_mile", label:"¼ Mile", sub:"sec" },
  { key:"half_mile",    label:"½ Mile", sub:"sec" },
];

const CAR_CLASSES = ["All","JDM","Euro","American","Muscle","Truck","Other"];

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
  instagram: "",
  lat: null,
  lng: null,
  mapVisible: true,
};

const BLANK_CAR = {
  id: null,
  make: "",
  model: "",
  year: "",
  trim: "",
  mods: "",
  photoUrl: "",
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
    instagram: row.instagram || "",
    socials: { instagram: row.instagram || "", twitter: "", youtube: "" },
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapVisible: row.map_visible ?? true,
  };
}

function carFromRow(row) {
  return {
    id: row.id,
    make: row.make || "",
    model: row.model || "",
    year: row.year?.toString() || "",
    trim: row.trim || "",
    mods: row.mods || "",
    photoUrl: row.photos?.[0] || "",
  };
}

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
${GFONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0a;
  --s1:#0d0d0d;
  --s2:#141414;
  --s3:#1c1c1c;
  --border:#1e1e1e;
  --border2:#242424;
  --border3:#2e2e2e;
  --text:#ffffff;
  --text2:#a0a0a0;
  --muted:#a0a0a0;
  --muted2:#555555;
  --green:#00c060;
  --orange:#0066ff;
  --red:#ff3b30;
  --blue:#0066ff;
  --accent:#0066ff;
  --accent-hover:#0052cc;
  --font-sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --font-display:"Pricedown Bl","Pricedown",var(--font-sans);
  --font-mono:"JetBrains Mono","SF Mono",monospace;
  --radius-sm:4px;
  --radius-md:8px;
  --radius-lg:12px;
  --radius-xl:20px;
  --radius-full:9999px;
  --shadow-sm:0 1px 3px rgba(0,0,0,.6);
  --shadow-md:0 4px 16px rgba(0,0,0,.6);
  --shadow-lg:0 12px 40px rgba(0,0,0,.8);
  --transition-fast:.12s cubic-bezier(.4,0,.2,1);
  --transition-base:.22s cubic-bezier(.4,0,.2,1);
}
body{background:var(--bg);color:var(--text);font-family:var(--font-sans);min-height:100vh;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-size:14px;letter-spacing:-.01em}
.app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
::-webkit-scrollbar-track{background:transparent}

/* HEADER */
.hdr{background:rgba(10,10,10,.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:14px 20px 10px;position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border)}
.logo-wrap{display:flex;align-items:center}
.logo-mark{font-size:26px;font-weight:800;letter-spacing:-1px;color:var(--text);line-height:1;font-family:var(--font-display);flex:1}
.logo-mark span{color:var(--blue)}
.logo-sub{display:none}
.me-pill{display:flex;align-items:center;gap:10px;margin-top:10px;background:var(--s2);border-radius:var(--radius-md);padding:9px 12px;border:1px solid var(--border)}
.me-username{font-size:12px;font-weight:600;color:var(--text)}
.me-car{font-size:11px;color:var(--muted);margin-top:1px}

/* AVATAR */
.av{border-radius:50%;background:var(--s3);color:var(--text);font-family:var(--font-mono);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;border:1px solid var(--border2)}
.av.s24{width:24px;height:24px;font-size:8px}
.av.s32{width:32px;height:32px;font-size:10px}
.av.s40{width:40px;height:40px;font-size:12px}
.av.s56{width:56px;height:56px;font-size:16px}
.av.me{border-color:var(--blue);color:var(--blue)}
.av.green{border-color:var(--green);color:var(--green)}

/* TIER BADGE */
.tier-badge{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:9px;letter-spacing:.5px;padding:3px 8px;border-radius:var(--radius-sm);font-weight:500;border:1px solid var(--border2);background:var(--s2);color:var(--muted)}

/* NAV */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(10,10,10,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:1px solid var(--border);display:flex;z-index:200;padding-bottom:env(safe-area-inset-bottom)}
.ni{flex:1;padding:10px 4px 11px;text-align:center;cursor:pointer;color:var(--muted2);font-size:10px;font-weight:500;border:none;background:none;transition:color .12s;display:flex;flex-direction:column;align-items:center;gap:3px;letter-spacing:.03em}
.ni.on{color:var(--text)}
.ni-icon{line-height:1;display:flex;align-items:center;justify-content:center}
.ni-dot{width:3px;height:3px;border-radius:50%;background:var(--blue);margin:0 auto;margin-top:1px}

/* CONTENT */
.content{flex:1;overflow-y:auto;padding:0 0 86px}

/* PAGE HEADER */
.pg-hdr{padding:24px 20px 14px}
.pg-title{font-size:26px;font-weight:700;color:var(--text);line-height:1;margin-bottom:3px;font-family:var(--font-display);letter-spacing:.5px}
.pg-sub{font-size:11px;color:var(--muted);font-weight:400;letter-spacing:.01em}
.sec-lbl{font-size:10px;font-weight:600;letter-spacing:1.8px;color:var(--muted2);text-transform:uppercase;padding:0 20px;margin-bottom:8px;margin-top:4px}

/* CARDS */
.card{background:var(--s2);border-radius:var(--radius-lg);padding:16px;margin:0 16px 8px;border:1px solid var(--border)}
.card.click{cursor:pointer;transition:background var(--transition-fast)}
.card.click:active{background:var(--s3)}
.list-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border);overflow:hidden}
.list-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition-fast)}
.list-item:last-child{border-bottom:none}
.list-item:active{background:var(--s3)}
.list-item-icon{width:34px;height:34px;border-radius:var(--radius-md);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.list-item-info{flex:1;min-width:0}
.list-item-title{font-size:13px;font-weight:500;color:var(--text)}
.list-item-sub{font-size:11px;color:var(--muted);margin-top:1px}
.chevron{color:var(--muted2);font-size:12px}

/* BUTTONS */
.btn{font-family:var(--font-sans);font-size:13px;font-weight:600;padding:10px 18px;border-radius:var(--radius-md);border:none;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap;display:inline-flex;align-items:center;gap:6px;letter-spacing:-.01em}
.btn-primary{background:var(--blue);color:#fff}
.btn-primary:hover{background:var(--accent-hover)}
.btn-secondary{background:transparent;color:var(--text);border:1px solid var(--border2)}
.btn-secondary:hover{background:var(--s2);border-color:var(--border3)}
.btn-green{background:rgba(0,192,96,.1);color:var(--green);border:1px solid rgba(0,192,96,.25)}
.btn-orange{background:rgba(0,102,255,.1);color:var(--blue);border:1px solid rgba(0,102,255,.25)}
.btn-red{background:rgba(255,59,48,.1);color:var(--red);border:1px solid rgba(255,59,48,.25)}
.btn-sm{padding:5px 11px;font-size:11px;border-radius:6px}
.btn:disabled{opacity:.3;cursor:default}
.btn-full{width:100%;justify-content:center}

/* SEARCH */
.srch-wrap{position:relative;margin:0 16px 12px}
.srch-inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 16px 11px 40px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.srch-inp::placeholder{color:var(--muted2)}
.srch-inp:focus{border-color:var(--border3)}
.srch-x{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted2);cursor:pointer;font-size:16px;background:none;border:none;line-height:1}
.srch-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted2);pointer-events:none;display:flex;align-items:center}

/* FILTER PILLS */
.pills{display:flex;gap:6px;padding:0 16px;margin-bottom:12px;overflow-x:auto}
.pills::-webkit-scrollbar{display:none}
.pill{font-size:11px;font-weight:500;padding:5px 13px;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .12s;white-space:nowrap;letter-spacing:.01em}
.pill.on{background:var(--blue);color:#fff;border-color:var(--blue)}

/* STAT BOXES */
.stat-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.stat-box{background:var(--s2);border-radius:var(--radius-md);padding:14px;border:1px solid var(--border)}
.stat-n{font-size:30px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1.5px}
.stat-n.green{color:var(--green)}
.stat-n.orange{color:var(--blue)}
.stat-l{font-size:10px;color:var(--muted);font-weight:500;margin-top:4px;letter-spacing:.8px;text-transform:uppercase}

/* GROUP CARD */
.gc-type-pill{font-size:9px;font-weight:600;padding:3px 9px;border-radius:var(--radius-full);letter-spacing:.8px;text-transform:uppercase}
.gc-type-pill.open{background:rgba(0,192,96,.1);color:var(--green);border:1px solid rgba(0,192,96,.2)}
.gc-type-pill.private{background:rgba(0,102,255,.1);color:var(--blue);border:1px solid rgba(0,102,255,.2)}
.gc-name{font-size:17px;font-weight:700;color:var(--text);margin:8px 0 4px;letter-spacing:-.3px}
.gc-desc{font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:10px}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
.tag{font-size:10px;font-weight:500;color:var(--muted2);background:var(--s3);padding:3px 9px;border-radius:var(--radius-sm);border:1px solid var(--border)}
.gc-meta{font-size:11px;color:var(--muted)}

/* USER ROW */
.user-row{display:flex;align-items:center;gap:12px;padding:13px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 6px;border:1px solid var(--border);cursor:pointer;transition:background var(--transition-fast)}
.user-row:active{background:var(--s3)}
.user-name{font-size:13px;font-weight:600;color:var(--text)}
.user-username{font-size:12px;color:var(--blue);font-weight:500;margin-top:1px}
.user-car{font-size:11px;color:var(--muted);margin-top:1px}

/* MAP */
.map-wrap{margin:0 16px 12px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border);background:var(--s2);position:relative;height:280px}
.mapboxgl-popup-content{background:var(--s2)!important;border:1px solid var(--border2)!important;border-radius:6px!important;padding:6px 10px!important;color:var(--text)!important;font-family:var(--font-sans)!important;box-shadow:var(--shadow-md)!important}
.mapboxgl-popup-tip{display:none}
.mapboxgl-ctrl-group{background:var(--s2)!important;border:1px solid var(--border)!important;border-radius:8px!important}
.mapboxgl-ctrl-group button{background:transparent!important;border:none!important}
.mapboxgl-ctrl-group button:hover{background:var(--s3)!important}
.mapboxgl-ctrl-icon{filter:invert(1)}
.map-controls{display:flex;align-items:center;gap:8px;padding:0 16px 10px;flex-wrap:wrap}
.map-loc-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--radius-md);background:var(--accent);color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:background var(--transition-fast);flex-shrink:0}
.map-loc-btn:hover{background:var(--accent-hover)}
.map-loc-btn:disabled{opacity:.5;cursor:default}
.map-vis-toggle{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);font-weight:500;cursor:pointer;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:7px 12px;flex-shrink:0}
.map-vis-toggle .tog{width:32px;height:18px;border-radius:9px;background:var(--s3);border:1px solid var(--border2);position:relative;transition:background .2s;flex-shrink:0}
.map-vis-toggle .tog.on{background:var(--accent);border-color:var(--accent)}
.map-vis-toggle .tog::after{content:"";position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;top:2px;left:2px;transition:left .2s}
.map-vis-toggle .tog.on::after{left:16px}
.map-loc-status{font-size:11px;color:var(--muted);margin-left:2px}
.map-group-legend{display:flex;align-items:center;gap:12px;padding:0 16px 8px;flex-wrap:wrap}
.map-legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)}
.map-legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}

/* GROUP CARDS — enhanced */
.gc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.gc-member-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);font-weight:500;background:var(--s3);padding:3px 9px;border-radius:var(--radius-full);border:1px solid var(--border)}
.gc-actions{display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.gc-last-active{font-size:10px;color:var(--muted2);flex:1}

/* CHAT */
.chat-msgs{display:flex;flex-direction:column;gap:10px;padding:0 16px 8px;overflow-y:auto;max-height:50vh;min-height:180px}
.msg-row{display:flex;gap:8px;align-items:flex-end}
.msg-row.mine{flex-direction:row-reverse}
.msg-bubble{background:var(--s2);border:1px solid var(--border);border-radius:12px 12px 12px 3px;padding:9px 12px;max-width:82%}
.msg-bubble.mine{background:rgba(0,102,255,.12);border-color:rgba(0,102,255,.25);border-radius:12px 12px 3px 12px}
.msg-meta{display:flex;align-items:center;gap:5px;margin-bottom:3px;flex-wrap:wrap}
.msg-who{font-size:11px;font-weight:600;color:var(--blue)}
.msg-car{font-size:9px;color:var(--muted2);font-family:var(--font-mono)}
.msg-text{font-size:13px;line-height:1.5;color:var(--text)}
.msg-time{font-size:9px;color:var(--muted2);margin-top:3px}
.chat-input-bar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--border);padding:10px 16px 12px;display:flex;gap:8px;align-items:center}
.av.s28{width:28px;height:28px;font-size:8px}

/* LEADERBOARD */
.lb-row{display:flex;align-items:center;gap:12px;padding:13px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 6px;border:1px solid var(--border);cursor:pointer;transition:background var(--transition-fast)}
.lb-row:active{background:var(--s3)}
.lb-row.mine{border-left:2px solid var(--blue)}
.lb-rank{font-size:13px;font-weight:700;color:var(--muted2);width:22px;text-align:center;flex-shrink:0;font-variant-numeric:tabular-nums}
.lb-rank.top{color:var(--text)}
.lb-info{flex:1;min-width:0}
.lb-name{font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lb-sub{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-times-row{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px}
.lb-time{background:var(--s3);border-radius:4px;padding:5px;text-align:center;border:1px solid var(--border)}
.lb-time-val{font-family:var(--font-mono);font-size:10px;font-weight:500;color:var(--text);line-height:1}
.lb-time-lbl{font-size:8px;color:var(--muted2);margin-top:2px;letter-spacing:.3px}
.lb-wins{text-align:right;flex-shrink:0}
.lb-wins-n{font-size:20px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.lb-wins-l{font-size:9px;color:var(--muted2);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
.you-tag{font-size:9px;font-weight:600;color:var(--blue);background:rgba(0,102,255,.12);border:1px solid rgba(0,102,255,.25);padding:2px 6px;border-radius:4px;letter-spacing:.3px}

/* VOICE */
.voice-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border);padding:14px}
.voice-status-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.voice-dot{width:6px;height:6px;border-radius:50%;background:var(--muted2)}
.voice-dot.on{background:var(--green);animation:vpulse 1.5s infinite}
@keyframes vpulse{0%,100%{opacity:1}50%{opacity:.3}}
.voice-users{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.voice-user{display:flex;flex-direction:column;align-items:center;gap:4px}
.voice-av{width:38px;height:38px;border-radius:50%;background:var(--s3);border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;transition:border-color .2s}
.voice-av.speaking{border-color:var(--green)}
.voice-av.muted{opacity:.35}
.voice-name{font-size:9px;color:var(--muted);font-weight:500;letter-spacing:.3px}

/* CHAT */
.chat-msgs{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:260px;overflow-y:auto;padding:0 16px}
.msg-row{display:flex;gap:8px}
.msg-bubble{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:9px 12px;max-width:84%}
.msg-bubble.mine{background:rgba(0,102,255,.08);border-color:rgba(0,102,255,.2)}
.msg-who{font-size:11px;font-weight:600;margin-bottom:3px;color:var(--blue)}
.msg-text{font-size:13px;line-height:1.5;color:var(--text2)}
.msg-time{font-size:9px;color:var(--muted2);margin-top:3px}
.chat-inp-row{display:flex;gap:8px;padding:0 16px}
.chat-inp{flex:1;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 14px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.chat-inp:focus{border-color:var(--blue)}
.chat-inp::placeholder{color:var(--muted2)}

/* PROFILE TIMES */
.times-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 16px 8px}
.time-box{background:var(--s2);border-radius:var(--radius-md);padding:14px;border:1px solid var(--border)}
.time-lbl{font-size:9px;color:var(--muted2);font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}
.time-val{font-size:24px;font-weight:700;color:var(--green);line-height:1;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.time-unit{font-size:10px;color:var(--muted);margin-top:2px}

/* SOCIAL */
.social-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)}
.social-item:last-child{border-bottom:none}
.social-icon{width:32px;height:32px;border-radius:var(--radius-md);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.social-platform{font-size:10px;color:var(--muted2);font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.social-handle{font-size:12px;color:var(--text);font-weight:500;margin-top:1px}

/* INPUT */
.inp-group{margin:0 16px 10px}
.inp-label{font-size:10px;font-weight:600;letter-spacing:1.2px;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px}
.inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 14px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.inp:focus{border-color:var(--blue)}
.inp::placeholder{color:var(--muted2)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border)}
.toggle-info{}
.toggle-title{font-size:13px;font-weight:500;color:var(--text)}
.toggle-sub{font-size:11px;color:var(--muted);margin-top:2px}
.toggle{width:42px;height:24px;border-radius:12px;background:var(--s3);border:1px solid var(--border2);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--blue);border-color:transparent}
.toggle-knob{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.toggle.on .toggle-knob{left:20px}

/* MISC */
.rule{height:1px;background:var(--border);margin:12px 16px}
.back-btn{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;padding:14px 20px 6px;background:none;border:none;letter-spacing:.02em}
.back-btn:hover{color:var(--text)}
.empty{font-size:12px;color:var(--muted2);text-align:center;padding:28px 20px;font-weight:400}
.fade{animation:fu .18s ease both}
@keyframes fu{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.notif-dot{width:6px;height:6px;border-radius:50%;background:var(--red);display:inline-block;margin-left:3px;vertical-align:middle}
.section-divider{height:8px;background:var(--bg)}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:400;display:flex;align-items:flex-end;justify-content:center}
.modal-sheet{background:var(--s1);border-radius:var(--radius-xl) var(--radius-xl) 0 0;border:1px solid var(--border2);border-bottom:none;padding:20px 20px 40px;width:100%;max-width:100%;max-height:88vh;overflow-y:auto}
@media(min-width:480px){.modal-sheet{max-width:430px}}
.modal-handle{width:32px;height:3px;background:var(--border3);border-radius:2px;margin:0 auto 20px}
.modal-title{font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px;font-family:var(--font-display);letter-spacing:.5px}
.modal-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
.seg{display:flex;background:var(--s3);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden;margin-bottom:10px}
.seg-opt{flex:1;padding:9px;text-align:center;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;transition:all .12s;border:none;background:none;font-family:var(--font-sans)}
.seg-opt.on{background:var(--blue);color:#fff}

/* LEADERBOARD */
.lb-cat-tabs{display:grid;grid-template-columns:repeat(4,1fr);margin:0 16px 12px;background:var(--s2);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden}
.lb-cat-tab{font-family:var(--font-sans);font-size:11px;font-weight:600;padding:11px 4px;text-align:center;cursor:pointer;border:none;background:transparent;color:var(--muted);transition:all .12s;letter-spacing:.02em;line-height:1.2}
.lb-cat-tab.on{background:var(--blue);color:#fff}
.lb-cat-tab:not(:last-child){border-right:1px solid var(--border)}
.lb-cat-tab-sub{font-size:9px;font-weight:400;display:block;opacity:.7;margin-top:2px}
.car-class-badge{display:inline-flex;align-items:center;font-size:9px;font-weight:600;letter-spacing:.5px;padding:2px 7px;border-radius:4px;background:rgba(0,102,255,.1);color:var(--blue);border:1px solid rgba(0,102,255,.2);text-transform:uppercase;white-space:nowrap}
.lb-time-val{font-family:var(--font-mono);font-size:19px;font-weight:700;line-height:1;letter-spacing:-0.5px;font-variant-numeric:tabular-nums}
.lb-time-unit{font-size:11px;font-weight:400;color:var(--muted)}
.my-best-bar{margin:0 16px 8px;padding:11px 14px;background:rgba(0,102,255,.06);border:1px solid rgba(0,102,255,.2);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between}
.proof-link{font-size:10px;color:var(--blue);text-decoration:none;letter-spacing:.01em;display:inline-block;margin-top:3px}
.proof-link:hover{text-decoration:underline}

/* CAR SHOWCASE */
.car-showcase{margin:0 16px 10px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);background:var(--s2)}
.car-photo-wrap{width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--s3);position:relative;cursor:pointer}
.car-photo-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease}
.car-photo-wrap:hover img{transform:scale(1.02)}
.car-photo-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--muted2);cursor:pointer;transition:background .15s}
.car-photo-empty:hover{background:var(--s2)}
.car-photo-label{font-size:11px;letter-spacing:.5px;font-weight:500}
.car-info-block{padding:16px 18px 18px}
.car-year-badge{display:inline-flex;align-items:center;font-family:var(--font-mono);font-size:11px;font-weight:500;color:var(--blue);background:rgba(0,102,255,.1);border:1px solid rgba(0,102,255,.2);padding:3px 10px;border-radius:var(--radius-sm);margin-bottom:10px;letter-spacing:.5px}
.car-make-model{font-size:28px;font-weight:700;color:var(--text);line-height:1.1;font-family:var(--font-display);letter-spacing:.5px;word-break:break-word}
.car-trim{font-size:12px;color:var(--muted);margin-top:5px;font-weight:500;letter-spacing:.01em}
.car-mods-section{margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
.car-mods-label{font-size:9px;font-weight:600;letter-spacing:1.8px;color:var(--muted2);text-transform:uppercase;margin-bottom:8px}
.car-mods-text{font-size:12px;color:var(--text2);line-height:1.7;font-family:var(--font-mono)}
.car-empty-state{padding:24px 18px;text-align:center}
.car-empty-icon{color:var(--muted2);margin-bottom:10px}
.car-empty-text{font-size:13px;color:var(--muted);margin-bottom:14px}

/* PHOTO UPLOAD */
.photo-upload-wrap{width:100%;aspect-ratio:16/9;border-radius:var(--radius-md);overflow:hidden;background:var(--s3);border:1px solid var(--border);position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--muted2);margin-bottom:10px;transition:border-color .15s}
.photo-upload-wrap:hover{border-color:var(--blue)}
.photo-upload-wrap img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.photo-upload-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;opacity:0;transition:opacity .15s}
.photo-upload-wrap:hover .photo-upload-overlay{opacity:1}
.photo-upload-hint{font-size:11px;color:#fff;letter-spacing:.3px}

/* ── SIDEBAR (desktop only) ───────────────────────── */
.sidebar{display:none}
.main-area{flex:1;min-width:0;display:flex;flex-direction:column}

@media(min-width:768px){
  html,body{overflow-x:hidden}
  .app{max-width:100%;flex-direction:row;align-items:flex-start;min-height:100vh}

  /* Sidebar */
  .sidebar{
    display:flex;flex-direction:column;width:220px;height:100vh;
    position:sticky;top:0;flex-shrink:0;
    background:var(--s1);border-right:1px solid var(--border);
    overflow:hidden;z-index:150;
  }
  .sidebar-top{
    padding:22px 20px 16px;border-bottom:1px solid var(--border);flex-shrink:0;
  }
  .sidebar-logo-mark{
    font-size:22px;font-weight:800;letter-spacing:-1px;
    color:var(--text);line-height:1;font-family:var(--font-display);margin-bottom:2px;
  }
  .sidebar-logo-mark span{color:var(--blue)}
  .sidebar-logo-sub{
    font-family:var(--font-mono);font-size:7px;letter-spacing:2.5px;
    color:var(--muted2);text-transform:uppercase;margin-bottom:16px;
  }
  .sidebar-profile{
    display:flex;align-items:center;gap:10px;
    background:var(--s2);border-radius:var(--radius-md);
    padding:10px 12px;border:1px solid var(--border);
  }
  .sidebar-profile-info{flex:1;min-width:0}
  .sidebar-profile-name{font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Sidebar nav */
  .sidebar-nav{flex:1;padding:6px 0;overflow-y:auto}
  .sidebar-ni{
    display:flex;align-items:center;gap:12px;
    padding:10px 20px;font-size:12px;font-weight:500;
    color:var(--muted);cursor:pointer;border:none;background:none;
    width:100%;text-align:left;transition:all var(--transition-fast);
    font-family:var(--font-sans);letter-spacing:-.01em;
  }
  .sidebar-ni:hover{color:var(--text)}
  .sidebar-ni.on{color:var(--text);background:var(--s2);border-right:2px solid var(--blue)}
  .sidebar-ni-icon{width:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .sidebar-notif{
    margin-left:auto;min-width:16px;height:16px;border-radius:8px;
    background:var(--red);color:#fff;font-size:9px;font-weight:700;
    display:flex;align-items:center;justify-content:center;padding:0 4px;
  }
  .sidebar-bottom{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}

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
  .desktop-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px;margin-bottom:8px}
  .desktop-2col .card{margin:0}
}

@media(min-width:1100px){
  .sidebar{width:240px}
  .main-area{max-width:800px}
}
`;

/* ─── NAV ICONS ──────────────────────────────────────────────────── */
function NavIcon({ name, size = 20 }) {
  const s = size;
  const props = { width:s, height:s, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
  switch (name) {
    case "Groups":
      return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "Search":
      return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
    case "Map":
      return <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case "Ranks":
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case "Profile":
      return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    default:
      return null;
  }
}

/* ─── CREATE GROUP MODAL ─────────────────────────────────────────── */
function CreateGroupModal({ myProfile, onClose, onCreateDB }) {
  const [form, setForm] = useState({ name:"", desc:"", type:"open", max:"20", tags:"" });
  const [saving, setSaving] = useState(false);
  const canSubmit = form.name.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await onCreateDB(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade">
        <div className="modal-handle"/>
        <div className="modal-title">Create Group</div>
        <div className="modal-sub">Start a new crew for your buddies</div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Group Name</label>
          <input className="inp" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. PDX Street Kings"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Description</label>
          <input className="inp" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="What's this group about?"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Type</label>
          <div className="seg">
            <button className={`seg-opt ${form.type==="open"?"on":""}`} onClick={()=>setForm({...form,type:"open"})}>Open</button>
            <button className={`seg-opt ${form.type==="private"?"on":""}`} onClick={()=>setForm({...form,type:"private"})}>Private</button>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Max Members</label>
          <input className="inp" type="number" value={form.max} onChange={e=>setForm({...form,max:e.target.value})} placeholder="20" min="2" max="100"/>
        </div>

        <div style={{marginBottom:20}}>
          <label className="inp-label">Tags (comma-separated)</label>
          <input className="inp" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="e.g. street, honda, pdx"/>
        </div>

        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:"14px",marginBottom:10}} disabled={!canSubmit} onClick={submit}>
          {saving ? "Creating…" : "Create Group"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:"12px"}} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

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

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

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
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [myCar, setMyCar] = useState({...BLANK_CAR});

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
      const [profileRes, usersRes, groupsRes, myCarRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*").neq("id", userId),
        supabase.from("groups").select("*, group_members(user_id, role, status)"),
        supabase.from("user_cars").select("*").eq("user_id", userId).eq("is_primary", true).maybeSingle(),
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
          lat: g.lat ?? null,
          lng: g.lng ?? null,
        })));
      }

      if (myCarRes.data) {
        setMyCar(carFromRow(myCarRes.data));
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

  const handleCreateGroup = (newGroup) => {
    setGroups(gs => [...gs, newGroup]);
  };

  const handleCreateGroupDB = async (form) => {
    const { data: grp, error } = await supabase.from("groups").insert({
      name: form.name.trim(),
      description: form.desc.trim() || null,
      is_private: form.type === "private",
      max_members: parseInt(form.max) || 20,
      tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      created_by: myId,
    }).select().single();
    if (error || !grp) { console.error("Create group error:", error); return; }
    await supabase.from("group_members").insert({ group_id:grp.id, user_id:myId, role:"owner", status:"active" });
    setGroups(gs => [...gs, {
      id: grp.id,
      name: grp.name,
      desc: grp.description || "",
      type: grp.is_private ? "private" : "open",
      max: grp.max_members,
      tags: grp.tags || [],
      memberIds: [myId],
      admin: myId,
      lastActive: "just now",
      messages: [],
      pendingRequests: [],
    }]);
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

  if (!session) {
    if (!showAuth) return (
      <LandingPage
        onSignUp={() => { setAuthMode("signup"); setShowAuth(true); }}
        onLogin={() => { setAuthMode("login"); setShowAuth(true); }}
      />
    );
    return <AuthPage initialMode={authMode} />;
  }

  const myId = session.user.id;
  const isFriend = id => friends.includes(id);
  const sentFR   = id => friendReqs.includes(id);
  const addFR    = id => { if (!sentFR(id)) setFriendReqs(r=>[...r,id]); };

  const isInGroup = gid => groups.find(g=>g.id===gid)?.memberIds.includes(myId);
  const sentGR    = gid => groupReqs.includes(gid);
  const joinGroup = async (gid) => {
    const already = groups.find(g=>g.id===gid)?.memberIds.includes(myId);
    if (already) return;
    setGroups(gs=>gs.map(g=>g.id===gid?{...g,memberIds:[...g.memberIds,myId]}:g));
    await supabase.from("group_members").upsert({ group_id:gid, user_id:myId, role:"member", status:"active" }, { onConflict:"group_id,user_id" });
  };
  const reqGroup = gid => { if (!sentGR(gid)) setGroupReqs(r=>[...r,gid]); };

  const pendingCount = groups.reduce((a,g)=>a+(g.pendingRequests?.length||0),0);
  const showNav = !playerView && !chatGroupId && !editingProfile;

  const TABS = [
    {name:"Groups"},
    {name:"Search"},
    {name:"Map"},
    {name:"Ranks"},
    {name:"Profile"},
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
            <div className="sidebar-logo-sub">Powered by 0xotics</div>
            <div className="sidebar-profile">
              <div className="av s32 me">{myProfile.avatar}</div>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">@{myProfile.username}</div>
                <TierBadge wins={tw(myProfile.wins)} />
              </div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {TABS.map(({name})=>(
              <button key={name} className={`sidebar-ni ${activeTab===name?"on":""}`} onClick={()=>goTab(name)}>
                <span className="sidebar-ni-icon"><NavIcon name={name} size={18}/></span>
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
              <EditProfile myProfile={myProfile} setMyProfile={setMyProfile}
              myCar={myCar} setMyCar={setMyCar} onBack={()=>setEditingProfile(false)} />
            ) : playerView ? (
              <UserProfile userId={playerView} onBack={()=>setPlayerView(null)}
                isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                groups={groups} isInGroup={isInGroup} sentGR={sentGR}
                joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile} />
            ) : chatGroupId ? (
              <ChatView groupId={chatGroupId} groups={groups}
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
                myProfile={myProfile} setMyProfile={setMyProfile} allUsers={allUsers} />
            ) : tab==="Ranks" ? (
              <RanksView openPlayer={setPlayerView} myProfile={myProfile} allUsers={allUsers} myCar={myCar} />
            ) : (
              <ProfileView myProfile={myProfile} friends={friends} groups={groups}
                openPlayer={setPlayerView} onEdit={()=>setEditingProfile(true)}
                onCreateGroup={()=>setCreateGroupOpen(true)}
                myCar={myCar} allUsers={allUsers} />
            )}
            {createGroupOpen && (
              <CreateGroupModal
                myProfile={myProfile}
                onClose={()=>setCreateGroupOpen(false)}
                onCreateDB={handleCreateGroupDB}
              />
            )}
          </div>

          {/* Mobile bottom nav */}
          {showNav && (
            <nav className="nav">
              {TABS.map(({name})=>(
                <button key={name} className={`ni ${tab===name?"on":""}`} onClick={()=>setTab(name)}>
                  <span className="ni-icon"><NavIcon name={name} size={22}/></span>
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
          <div className="logo-sub">Powered by 0xotics</div>
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
        <div className="card" style={{borderColor:"rgba(0,102,255,.4)",cursor:"pointer",marginBottom:12}} onClick={()=>setShowPending(!showPending)}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:14,fontWeight:600}}>Join Requests <span style={{background:"rgba(0,102,255,.15)",color:"var(--blue)",fontSize:11,padding:"2px 7px",borderRadius:10,marginLeft:4}}>{pendingCount}</span></div>
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
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Open"}</span>
              {isInGroup(g.id)&&<span style={{fontSize:10,color:"var(--accent)",fontWeight:600,letterSpacing:.5}}>JOINED</span>}
            </div>
            <span className="gc-member-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {g.memberIds.length}/{g.max}
            </span>
          </div>
          <div className="gc-name">{g.name}</div>
          {g.desc&&<div className="gc-desc">{g.desc}</div>}
          {g.tags?.length>0&&<div className="tags">{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
          <div className="gc-actions">
            {isInGroup(g.id)&&<button className="btn btn-secondary btn-sm" onClick={()=>openChat(g.id)}>Open Chat →</button>}
            {!isInGroup(g.id)&&!sentGR(g.id)&&(
              <button className="btn btn-primary btn-sm" onClick={()=>{
                if (g.type==="open") joinGroup(g.id);
                else {
                  setGroups(gs=>gs.map(x=>x.id===g.id?{...x,pendingRequests:[...(x.pendingRequests||[]),myProfile.id]}:x));
                  reqGroup(g.id);
                }
              }}>{g.type==="open"?"Join Group":"Request to Join"}</button>
            )}
            {!isInGroup(g.id)&&sentGR(g.id)&&<button className="btn btn-secondary btn-sm" disabled>Pending…</button>}
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
        <span className="srch-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
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
  const [userCar, setUserCar] = useState(null);

  useEffect(() => {
    supabase.from("user_cars").select("*")
      .eq("user_id", userId).eq("is_primary", true).maybeSingle()
      .then(({ data }) => { if (data) setUserCar(carFromRow(data)); });
  }, [userId]);

  if (!p) return null;
  const isMe = userId === myProfile.id;
  const totalW = tw(p.wins);
  const userGroups = groups.filter(g=>g.memberIds.includes(userId));
  const hasTimes = p.times&&Object.values(p.times).some(v=>v);
  const ig = p.instagram || p.socials?.instagram || "";
  const hasCar = userCar && userCar.make && userCar.model;

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Identity header */}
      <div style={{padding:"0 16px 14px"}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
          <div className={`av s56 ${isMe?"me":""}`}>{p.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--blue)",fontWeight:600,marginBottom:2}}>@{p.username}</div>
            {p.showRealName&&<div style={{fontSize:21,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{p.displayName}</div>}
            {p.city&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📍 {p.city}</div>}
            {ig&&(
              <a href={`https://instagram.com/${ig.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,fontSize:12,color:"var(--blue)",textDecoration:"none",fontWeight:500}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                @{ig.replace("@","")}
              </a>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontSize:11,color:"var(--muted)"}}>#{computeRanks(allUsers,myProfile).find(x=>x.id===userId)?.rank??"-"} · {totalW}W</span>
            </div>
          </div>
        </div>
        {!isMe&&(
          <div style={{display:"flex",gap:8}}>
            {!isFriend(userId)&&!sentFR(userId)&&<button className="btn btn-primary btn-sm" onClick={()=>addFR(userId)}>+ Add Friend</button>}
            {!isFriend(userId)&&sentFR(userId)&&<button className="btn btn-secondary btn-sm" disabled>Request Sent</button>}
            {isFriend(userId)&&<span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ Friends</span>}
          </div>
        )}
      </div>

      {/* ── Car showcase ── */}
      {(hasCar || userCar === null) && (
        <>
          <div className="sec-lbl">{hasCar ? `${userCar.year} ${userCar.make} ${userCar.model}` : "Car"}</div>
          <div className="car-showcase">
            <div className="car-photo-wrap" style={{cursor:"default"}}>
              {userCar?.photoUrl
                ? <img src={userCar.photoUrl} alt="car"/>
                : (
                  <div className="car-photo-empty" style={{cursor:"default"}}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                      <rect x="9" y="11" width="14" height="10" rx="2"/>
                      <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    </svg>
                    <span className="car-photo-label" style={{color:"var(--muted2)"}}>No photo</span>
                  </div>
                )
              }
            </div>
            {hasCar && (
              <div className="car-info-block">
                <div className="car-year-badge">{userCar.year || "—"}</div>
                <div className="car-make-model">{userCar.make} {userCar.model}</div>
                {userCar.trim && <div className="car-trim">{userCar.trim}</div>}
                {userCar.mods && (
                  <div className="car-mods-section">
                    <div className="car-mods-label">Modifications</div>
                    <div className="car-mods-text">{userCar.mods}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Race Stats */}
      <div className="sec-lbl">Race Stats</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",marginBottom:8}}>
        {FORMAT.map(f=>(
          <div key={f.key} style={{background:"var(--s2)",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
            <div style={{fontSize:20,fontWeight:700,lineHeight:1}}>{p.wins[f.key]??0}</div>
            <div style={{fontSize:9,color:"var(--muted2)",marginTop:3,letterSpacing:.5,textTransform:"uppercase"}}>{f.short}</div>
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

      {/* Groups */}
      {userGroups.length>0&&!isMe&&(<>
        <div className="sec-lbl">Groups</div>
        {userGroups.map(g=>(
          <div key={g.id} className="card" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600}}>{g.name}</div>
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
      <div style={{height:20}}/>
    </div>
  );
}

/* ─── CHAT VIEW ──────────────────────────────────────────────────── */
function ChatView({ groupId, groups, onBack, openPlayer, myProfile, allUsers }) {
  const g = groups.find(x=>x.id===groupId);
  const [messages, setMessages] = useState([]);
  const [memberCars, setMemberCars] = useState({}); // userId -> "year make model"
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const knownIds = useRef(new Set());

  // Format timestamp
  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString([],{month:"short",day:"numeric"});
  };

  // Load message history
  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    knownIds.current = new Set();
    setMessages([]);

    supabase.from("group_messages")
      .select("*, profiles(username, avatar_initials)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          data.forEach(m => knownIds.current.add(m.id));
          setMessages(data.map(m => ({
            id: m.id,
            uid: m.user_id,
            username: m.profiles?.username || "?",
            avatar: m.profiles?.avatar_initials || "?",
            text: m.content,
            ts: m.created_at,
          })));
        }
        setLoading(false);
      });

    // Load member cars
    if (g?.memberIds?.length) {
      supabase.from("user_cars").select("user_id,year,make,model,trim")
        .in("user_id", g.memberIds).eq("is_primary", true)
        .then(({ data }) => {
          if (!data) return;
          const map = {};
          data.forEach(c => { map[c.user_id] = `${c.year} ${c.make} ${c.model}${c.trim?" "+c.trim:""}`; });
          setMemberCars(map);
        });
    }

    // Subscribe to realtime
    const channel = supabase.channel(`chat:${groupId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const row = payload.new;
        if (knownIds.current.has(row.id)) return;
        knownIds.current.add(row.id);
        // Fetch sender profile if not already known
        let username = "?", avatar = "?";
        const known = allUsers.find(u => u.id === row.user_id);
        if (known) { username = known.username; avatar = known.avatar; }
        else if (row.user_id === myProfile.id) { username = myProfile.username; avatar = myProfile.avatar; }
        else {
          const { data: prof } = await supabase.from("profiles").select("username,avatar_initials").eq("id", row.user_id).single();
          if (prof) { username = prof.username; avatar = prof.avatar_initials || "?"; }
        }
        setMessages(prev => [...prev, {
          id: row.id, uid: row.user_id,
          username, avatar,
          text: row.content, ts: row.created_at,
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await supabase.from("group_messages").insert({
      group_id: groupId,
      user_id: myProfile.id,
      content: text,
    });
  };

  if (!g) return null;
  const members = g.memberIds.map(id => getU(id, allUsers, myProfile)).filter(Boolean);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Groups</button>

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">{g.name}</div>
        <div className="pg-sub">{g.type} · {g.memberIds.length} members</div>
        {g.desc&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{g.desc}</div>}
        {g.tags?.length>0&&<div className="tags" style={{marginTop:8}}>{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
      </div>

      {/* Members */}
      <div className="sec-lbl">Members ({g.memberIds.length})</div>
      <div className="list-card" style={{margin:"0 16px 14px"}}>
        {members.map(m=>(
          <div key={m.id} className="list-item" onClick={()=>m.id!==myProfile.id&&openPlayer(m.id)}>
            <div className={`av s32 ${m.id===myProfile.id?"me":""}`}>{m.avatar}</div>
            <div className="list-item-info">
              <div className="list-item-title">
                @{m.username||m.avatar}
                {m.id===myProfile.id&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6,fontWeight:600}}>YOU</span>}
              </div>
              {memberCars[m.id]&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{memberCars[m.id]}</div>}
            </div>
            <TierBadge wins={tw(m.wins)} />
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="sec-lbl">Group Chat</div>
      <div className="chat-msgs">
        {loading&&<div className="empty">Loading messages…</div>}
        {!loading&&messages.length===0&&<div className="empty">No messages yet. Start the conversation.</div>}
        {messages.map((msg)=>{
          const mine = msg.uid===myProfile.id;
          const car = memberCars[msg.uid];
          return (
            <div key={msg.id} className={`msg-row ${mine?"mine":""}`}>
              {!mine&&<div className="av s28">{msg.avatar}</div>}
              <div>
                <div className="msg-meta">
                  {!mine&&<span className="msg-who">@{msg.username}</span>}
                  {car&&<span className="msg-car">{car}</span>}
                  <span style={{color:"var(--muted2)",fontSize:10}}>{fmt(msg.ts)}</span>
                </div>
                <div className={`msg-bubble ${mine?"mine":""}`}>
                  <div className="msg-text">{msg.text}</div>
                </div>
              </div>
              {mine&&<div className="av s28 me">{msg.avatar||myProfile.avatar}</div>}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div className="chat-input-bar">
        <input className="chat-inp" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message…"/>
        <button className="btn btn-primary" style={{borderRadius:12,padding:"12px 16px"}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

/* ─── MAP VIEW ───────────────────────────────────────────────────── */
function MapView({ groups, openPlayer, myProfile, setMyProfile, allUsers }) {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const userMarkersRef  = useRef([]);
  const groupMarkersRef = useRef([]);

  const [filter, setFilter]       = useState("All");
  const [memberCars, setMemberCars] = useState({});   // userId -> "year make model"
  const [locating, setLocating]   = useState(false);
  const [locErr, setLocErr]       = useState(null);
  const [mapVisible, setMapVisible] = useState(myProfile.mapVisible ?? true);

  const myId     = myProfile.id;
  const myGroups = groups.filter(g => g.memberIds.includes(myId));

  // Which users are shown (exclude hidden, filter by group if selected)
  const allWithMe = myProfile.lat != null ? [myProfile, ...allUsers] : allUsers;
  const visibleUsers = allWithMe.filter(p => {
    if (p.lat == null || p.lng == null) return false;
    if (!p.mapVisible && p.id !== myId) return false;   // respect others' privacy
    if (filter !== "All" && !groups.find(g => g.id === filter)?.memberIds.includes(p.id)) return false;
    return true;
  });

  // Group pins to show (groups that have a location set)
  const visibleGroups = (filter === "All" ? myGroups : myGroups.filter(g => g.id === filter))
    .filter(g => g.lat != null && g.lng != null);

  // Load primary cars for all known users once on mount
  useEffect(() => {
    const allIds = allUsers.map(u => u.id);
    if (myId) allIds.push(myId);
    if (!allIds.length) return;
    supabase
      .from("user_cars")
      .select("user_id, year, make, model, trim")
      .in("user_id", allIds)
      .eq("is_primary", true)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(c => {
          map[c.user_id] = `${c.year} ${c.make} ${c.model}${c.trim ? " " + c.trim : ""}`;
        });
        setMemberCars(map);
      });
  }, [myId, allUsers]);

  // Init Mapbox once
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-122.67, 45.52],
      zoom: 11,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Sync user markers
  useEffect(() => {
    if (!mapRef.current) return;
    userMarkersRef.current.forEach(m => m.remove());
    userMarkersRef.current = [];

    visibleUsers.forEach(p => {
      const isMe = p.id === myId;
      const car  = memberCars[p.id];

      const el = document.createElement("div");
      el.style.cssText = [
        `width:${isMe ? 16 : 11}px`,
        `height:${isMe ? 16 : 11}px`,
        "border-radius:50%",
        `background:${isMe ? "#0066ff" : "#ffffff"}`,
        `border:2px solid ${isMe ? "#0066ff" : "#2a2a2a"}`,
        "cursor:pointer",
        "transition:transform .15s",
        `box-shadow:${isMe ? "0 0 12px rgba(0,102,255,0.6)" : "0 1px 4px rgba(0,0,0,.8)"}`,
      ].join(";");
      el.onmouseenter = () => { el.style.transform = "scale(1.4)"; };
      el.onmouseleave = () => { el.style.transform = "scale(1)"; };
      el.addEventListener("click", () => openPlayer(p.id));

      const popupHtml = `
        <div style="min-width:120px">
          <div style="font-size:12px;font-weight:700;color:#0066ff;margin-bottom:${car ? 3 : 0}px">@${p.username}${isMe ? " <span style='color:#888;font-size:10px'>(you)</span>" : ""}</div>
          ${car ? `<div style="font-size:11px;color:#ccc;font-family:'JetBrains Mono',monospace">${car}</div>` : ""}
        </div>`;

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, closeOnClick: false })
        .setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      userMarkersRef.current.push(marker);
    });
  }, [visibleUsers, memberCars, myId]);

  // Sync group markers
  useEffect(() => {
    if (!mapRef.current) return;
    groupMarkersRef.current.forEach(m => m.remove());
    groupMarkersRef.current = [];

    visibleGroups.forEach(g => {
      const el = document.createElement("div");
      el.style.cssText = [
        "width:13px", "height:13px", "border-radius:3px",
        "background:#00c060",
        "border:2px solid #007a3d",
        "cursor:pointer",
        "box-shadow:0 0 8px rgba(0,192,96,0.4)",
        "transform:rotate(45deg)",
        "transition:transform .15s",
      ].join(";");
      el.onmouseenter = () => { el.style.transform = "rotate(45deg) scale(1.4)"; };
      el.onmouseleave = () => { el.style.transform = "rotate(45deg) scale(1)"; };

      const popupHtml = `
        <div style="min-width:110px">
          <div style="font-size:11px;font-weight:700;color:#00c060;margin-bottom:3px">${g.name}</div>
          <div style="font-size:10px;color:#888">${g.memberIds.length} member${g.memberIds.length !== 1 ? "s" : ""}</div>
          ${g.tags?.length ? `<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">${g.tags.map(t=>`<span style="font-size:9px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:3px;padding:1px 5px;color:#aaa">${t}</span>`).join("")}</div>` : ""}
        </div>`;

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, closeOnClick: false })
        .setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([g.lng, g.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      groupMarkersRef.current.push(marker);
    });
  }, [visibleGroups]);

  const handleSetLocation = () => {
    if (!navigator.geolocation) { setLocErr("Geolocation not supported"); return; }
    setLocating(true);
    setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        await supabase.from("profiles").update({ lat, lng }).eq("id", myId);
        setMyProfile(p => ({ ...p, lat, lng }));
        if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 13 });
        setLocating(false);
      },
      (err) => {
        setLocErr("Location access denied");
        setLocating(false);
        console.warn("Geolocation error:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleVisible = async () => {
    const next = !mapVisible;
    setMapVisible(next);
    setMyProfile(p => ({ ...p, mapVisible: next }));
    await supabase.from("profiles").update({ map_visible: next }).eq("id", myId);
  };

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Live Map</div>
        <div className="pg-sub">Portland metro · {visibleUsers.length} visible</div>
      </div>

      {/* Filter pills */}
      <div className="pills">
        <button className={`pill ${filter === "All" ? "on" : ""}`} onClick={() => setFilter("All")}>All</button>
        {myGroups.map(g => (
          <button key={g.id} className={`pill ${filter === g.id ? "on" : ""}`} onClick={() => setFilter(g.id)}>
            {g.name.split(" ").slice(0, 2).join(" ")}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="map-controls">
        <button className="map-loc-btn" onClick={handleSetLocation} disabled={locating}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          {locating ? "Locating…" : myProfile.lat != null ? "Update Location" : "Set My Location"}
        </button>
        <div className="map-vis-toggle" onClick={handleToggleVisible}>
          <div className={`tog ${mapVisible ? "on" : ""}`} />
          <span>{mapVisible ? "Visible on map" : "Hidden from map"}</span>
        </div>
        {locErr && <span className="map-loc-status" style={{color:"var(--red)"}}>{locErr}</span>}
        {!locErr && myProfile.lat != null && <span className="map-loc-status">📍 Location set</span>}
      </div>

      {/* Map */}
      <div className="map-wrap">
        <div ref={mapContainer} style={{width:"100%",height:"100%"}} />
      </div>

      {/* Legend */}
      <div className="map-group-legend">
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{background:"#0066ff",boxShadow:"0 0 6px rgba(0,102,255,.5)"}}/>
          <span>You</span>
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{background:"#ffffff",border:"1px solid #444"}}/>
          <span>Members</span>
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{width:9,height:9,background:"#00c060",borderRadius:2,transform:"rotate(45deg)",boxShadow:"0 0 5px rgba(0,192,96,.4)"}}/>
          <span>Groups</span>
        </div>
      </div>

      {/* Member list */}
      <div className="sec-lbl">{visibleUsers.length} {visibleUsers.length === 1 ? "Member" : "Members"} on Map</div>
      {visibleUsers.length === 0 && <div className="empty">No members with location data.</div>}
      {visibleUsers.map(p => {
        const isMe = p.id === myId;
        const car  = memberCars[p.id];
        return (
          <div key={p.id} className="user-row" onClick={() => openPlayer(p.id)}>
            <div style={{width:9,height:9,borderRadius:"50%",background:isMe?"#0066ff":"#555",flexShrink:0,boxShadow:isMe?"0 0 6px rgba(0,102,255,.5)":"none"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">
                @{p.username}
                {isMe && <span style={{fontSize:10,color:"var(--blue)",marginLeft:6}}>YOU</span>}
              </div>
              {car && <div className="user-car" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{car}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── RANKS VIEW ─────────────────────────────────────────────────── */
function RanksView({ openPlayer, myProfile, myCar }) {
  const [cat, setCat]           = useState("0-60");
  const [classFilter, setClass] = useState("All");
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadKey, setLoadKey]   = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      let q = supabase
        .from("race_times")
        .select("*, profiles(username, avatar_initials), user_cars(year, make, model, trim)")
        .eq("category", cat)
        .order("time_seconds", { ascending: true })
        .limit(300);
      if (classFilter !== "All") q = q.eq("car_class", classFilter);

      const { data } = await q;
      if (cancelled || !data) return;

      // Best time per user
      const best = {};
      data.forEach(e => {
        if (!best[e.user_id] || e.time_seconds < best[e.user_id].time_seconds)
          best[e.user_id] = e;
      });
      setEntries(Object.values(best).sort((a,b) => a.time_seconds - b.time_seconds));
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [cat, classFilter, loadKey]);

  const myIdx   = entries.findIndex(e => e.user_id === myProfile.id);
  const myEntry = myIdx >= 0 ? entries[myIdx] : null;

  const RANK_COLOR = (i) =>
    i === 0 ? "#f59e0b" : i === 1 ? "#a0a0a0" : i === 2 ? "#cd7f32" : "var(--muted2)";

  return (
    <div>
      {/* Header */}
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Leaderboard</div>
          <div className="pg-sub">Fastest times · all classes</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4}} onClick={()=>setSubmitOpen(true)}>
          + Submit
        </button>
      </div>

      {/* Category tabs */}
      <div className="lb-cat-tabs">
        {LEADERBOARD_CATS.map(c=>(
          <button key={c.key} className={`lb-cat-tab ${cat===c.key?"on":""}`} onClick={()=>setCat(c.key)}>
            {c.label}
            <span className="lb-cat-tab-sub">{c.sub}</span>
          </button>
        ))}
      </div>

      {/* Class filter */}
      <div className="pills">
        {CAR_CLASSES.map(cls=>(
          <button key={cls} className={`pill ${classFilter===cls?"on":""}`} onClick={()=>setClass(cls)}>
            {cls}
          </button>
        ))}
      </div>

      {/* My best (if outside top visible) */}
      {myEntry && myIdx > 9 && (
        <div className="my-best-bar">
          <div>
            <div style={{fontSize:10,color:"var(--blue)",fontWeight:600,letterSpacing:1.2,textTransform:"uppercase",marginBottom:2}}>Your Best</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>
              #{myIdx+1} · {myEntry.car_class && <span className="car-class-badge" style={{marginRight:4}}>{myEntry.car_class}</span>}
              {[myEntry.user_cars?.year,myEntry.user_cars?.make,myEntry.user_cars?.model].filter(Boolean).join(" ")||"No car"}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <span className="lb-time-val" style={{color:"var(--blue)"}}>{Number(myEntry.time_seconds).toFixed(3)}</span>
            <span className="lb-time-unit">s</span>
          </div>
        </div>
      )}

      {loading && (
        <div style={{padding:"32px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>
          Loading…
        </div>
      )}

      {!loading && entries.length===0 && (
        <div style={{padding:"40px 20px",textAlign:"center"}}>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>
            No times submitted yet for this category.<br/>Be the first on the board.
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setSubmitOpen(true)}>+ Submit Time</button>
        </div>
      )}

      {!loading && entries.map((entry,i)=>{
        const isMe   = entry.user_id === myProfile.id;
        const car    = entry.user_cars;
        const prof   = entry.profiles;
        const carStr = car ? [car.year,car.make,car.model].filter(Boolean).join(" ") : "";
        const rc     = RANK_COLOR(i);
        return (
          <div key={entry.id} className={`lb-row ${isMe?"mine":""}`} onClick={()=>openPlayer(entry.user_id)}>
            {/* Rank */}
            <div className="lb-rank" style={{color:rc,fontSize:i<3?15:12,width:20}}>
              {i+1}
            </div>
            {/* Avatar */}
            <div className={`av s32 ${isMe?"me":""}`}>{prof?.avatar_initials||"?"}</div>
            {/* Info */}
            <div className="lb-info">
              <div className="lb-name">
                <span style={{color:"var(--blue)",fontWeight:600}}>@{prof?.username||"?"}</span>
                {isMe&&<span className="you-tag">YOU</span>}
                {entry.car_class&&<span className="car-class-badge">{entry.car_class}</span>}
              </div>
              {carStr&&<div className="lb-sub">{carStr}{car?.trim?` · ${car.trim}`:""}</div>}
            </div>
            {/* Time + proof */}
            <div style={{textAlign:"right",flexShrink:0}}>
              <div>
                <span className="lb-time-val" style={{color:rc}}>{Number(entry.time_seconds).toFixed(3)}</span>
                <span className="lb-time-unit">s</span>
              </div>
              {entry.proof_url&&(
                <a className="proof-link" href={entry.proof_url} target="_blank"
                  rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>
                  proof ↗
                </a>
              )}
            </div>
          </div>
        );
      })}

      {submitOpen&&(
        <SubmitTimeModal
          myProfile={myProfile}
          myCar={myCar}
          initialCat={cat}
          onClose={()=>setSubmitOpen(false)}
          onSubmitted={()=>{ setSubmitOpen(false); setLoadKey(k=>k+1); }}
        />
      )}
    </div>
  );
}

/* ─── SUBMIT TIME MODAL ──────────────────────────────────────────── */
function SubmitTimeModal({ myProfile, myCar, initialCat, onClose, onSubmitted }) {
  const [cat,        setCat]        = useState(initialCat);
  const [timeVal,    setTimeVal]    = useState("");
  const [carClass,   setCarClass]   = useState("");
  const [proofUrl,   setProofUrl]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const hasCar  = myCar.make && myCar.model;
  const carLabel = hasCar
    ? [myCar.year, myCar.make, myCar.model].filter(Boolean).join(" ")
    : null;

  const parsed   = parseFloat(timeVal);
  const timeOk   = timeVal !== "" && !isNaN(parsed) && parsed > 0;
  const canSubmit = timeOk && carClass !== "" && myProfile.id;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const { error: err } = await supabase.from("race_times").insert({
        user_id:      myProfile.id,
        car_id:       myCar.id || null,
        category:     cat,
        time_seconds: parsed,
        car_class:    carClass,
        proof_url:    proofUrl.trim() || null,
        verified:     false,
      });
      if (err) throw err;
      onSubmitted();
    } catch (e) {
      setError(e.message || "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade">
        <div className="modal-handle"/>
        <div className="modal-title">Submit Time</div>
        <div className="modal-sub">Your best run for the leaderboard</div>

        {/* Category */}
        <label className="inp-label" style={{marginBottom:8}}>Category</label>
        <div className="lb-cat-tabs" style={{marginBottom:16}}>
          {LEADERBOARD_CATS.map(c=>(
            <button key={c.key} className={`lb-cat-tab ${cat===c.key?"on":""}`} onClick={()=>setCat(c.key)}>
              {c.label}
              <span className="lb-cat-tab-sub">{c.sub}</span>
            </button>
          ))}
        </div>

        {/* Car */}
        <label className="inp-label" style={{marginBottom:6}}>Car</label>
        <div style={{background:"var(--s3)",border:"1px solid var(--border)",borderRadius:8,padding:"11px 14px",marginBottom:14}}>
          {hasCar
            ? <span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{carLabel}</span>
            : <span style={{fontSize:12,color:"var(--muted2)"}}>No car on profile — add one in Edit Profile</span>
          }
        </div>

        {/* Car class */}
        <label className="inp-label" style={{marginBottom:8}}>Class</label>
        <div className="pills" style={{padding:0,flexWrap:"wrap",marginBottom:16,gap:6}}>
          {CAR_CLASSES.filter(c=>c!=="All").map(cls=>(
            <button key={cls} className={`pill ${carClass===cls?"on":""}`} onClick={()=>setCarClass(cls)}>
              {cls}
            </button>
          ))}
        </div>

        {/* Time */}
        <label className="inp-label" style={{marginBottom:6}}>Time (seconds)</label>
        <input className="inp" type="number" step="0.001" min="0.001"
          style={{fontFamily:"var(--font-mono)",fontSize:28,fontWeight:700,letterSpacing:"-1px",
                  padding:"12px 16px",marginBottom:4,textAlign:"center"}}
          placeholder="0.000"
          value={timeVal} onChange={e=>setTimeVal(e.target.value)}/>
        <div style={{fontSize:10,color:"var(--muted2)",marginBottom:14,textAlign:"center",letterSpacing:.3}}>
          Enter to 3 decimal places, e.g. 3.820
        </div>

        {/* Proof */}
        <label className="inp-label" style={{marginBottom:6}}>
          Proof URL&nbsp;<span style={{color:"var(--muted2)",fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>optional</span>
        </label>
        <input className="inp" type="url" placeholder="https://youtube.com/watch?v=..."
          value={proofUrl} onChange={e=>setProofUrl(e.target.value)} style={{marginBottom:16}}/>

        {error&&(
          <div style={{marginBottom:12,padding:"10px 14px",background:"rgba(255,59,48,.1)",
            border:"1px solid rgba(255,59,48,.2)",borderRadius:8,fontSize:12,color:"var(--red)"}}>
            {error}
          </div>
        )}

        <button className="btn btn-primary btn-full" style={{borderRadius:10,padding:"14px",marginBottom:8}}
          disabled={!canSubmit||submitting} onClick={handleSubmit}>
          {submitting ? "Submitting…" : "Submit to Leaderboard"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:10}} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── PROFILE VIEW ───────────────────────────────────────────────── */
function ProfileView({ myProfile, friends, groups, openPlayer, onEdit, onCreateGroup, myCar, allUsers }) {
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const myFriends = allUsers.filter(p=>friends.includes(p.id));
  const totalW = tw(myProfile.wins);
  const totalR = Object.values(myProfile.races).reduce((a,b)=>a+b,0);
  const tier = getTier(totalW);
  const nextTier = TIERS[TIERS.indexOf(tier)+1];
  const progress = nextTier?((totalW-tier.min)/(nextTier.min-tier.min))*100:100;
  const hasTimes = myProfile.times&&Object.values(myProfile.times).some(v=>v);
  const myRank = computeRanks(allUsers, myProfile).find(x=>x.id===myProfile.id)?.rank??"-";
  const hasCar = myCar.make && myCar.model;
  const ig = myProfile.instagram || myProfile.socials?.instagram || "";

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Profile</div>
          <div className="pg-sub">Your driver record</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{marginTop:4}}>Edit</button>
      </div>

      {/* ── CAR SHOWCASE — centerpiece ── */}
      <div className="car-showcase">
        <div className="car-photo-wrap" onClick={onEdit}>
          {myCar.photoUrl
            ? <img src={myCar.photoUrl} alt="car"/>
            : (
              <div className="car-photo-empty">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                  <rect x="9" y="11" width="14" height="10" rx="2"/>
                  <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                </svg>
                <span className="car-photo-label">{hasCar ? "Add photo" : "Set up your car"}</span>
              </div>
            )
          }
        </div>

        {hasCar ? (
          <div className="car-info-block">
            <div className="car-year-badge">{myCar.year || "—"}</div>
            <div className="car-make-model">{myCar.make} {myCar.model}</div>
            {myCar.trim && <div className="car-trim">{myCar.trim}</div>}
            {myCar.mods && (
              <div className="car-mods-section">
                <div className="car-mods-label">Modifications</div>
                <div className="car-mods-text">{myCar.mods}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="car-empty-state">
            <div className="car-empty-text">Add your build to your profile</div>
            <button className="btn btn-primary btn-sm" onClick={onEdit}>+ Add Car</button>
          </div>
        )}
      </div>

      {/* Hero identity card */}
      <div className="card" style={{marginBottom:8}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
          <div className="av s56 me">{myProfile.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--blue)",fontWeight:600,marginBottom:2}}>@{myProfile.username}</div>
            {myProfile.showRealName&&<div style={{fontSize:19,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{myProfile.displayName}</div>}
            {myProfile.city&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📍 {myProfile.city}</div>}
            {ig && (
              <a href={`https://instagram.com/${ig.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,fontSize:12,color:"var(--blue)",textDecoration:"none",fontWeight:500}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                @{ig.replace("@","")}
              </a>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontSize:11,color:"var(--muted)"}}>Rank #{myRank} Global</span>
            </div>
          </div>
        </div>
        <div style={{marginBottom:4,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:10,color:tier.color,fontWeight:600,letterSpacing:.5}}>{tier.name.toUpperCase()} · {totalW} WINS</span>
          {nextTier&&<span style={{fontSize:10,color:"var(--muted)"}}>→ {nextTier.name} at {nextTier.min}W</span>}
        </div>
        <div style={{height:3,background:"var(--s3)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(progress,100)}%`,background:tier.color,borderRadius:2,transition:"width .5s"}}/>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",marginBottom:8}}>
        {[
          {n:totalW,    l:"Wins",  c:"var(--text)"},
          {n:totalR,    l:"Races", c:"var(--text)"},
          {n:`${totalR>0?Math.round((totalW/totalR)*100):0}%`, l:"Rate", c:"var(--green)"},
          {n:`#${myRank}`, l:"Rank", c:"var(--blue)"},
        ].map(({n,l,c})=>(
          <div key={l} style={{background:"var(--s2)",borderRadius:10,padding:"11px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
            <div style={{fontSize:22,fontWeight:700,lineHeight:1,color:c,letterSpacing:"-0.5px"}}>{n}</div>
            <div style={{fontSize:9,color:"var(--muted2)",marginTop:4,letterSpacing:.8,textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Format breakdown */}
      <div className="sec-lbl">By Format</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:8}}>
        {FORMAT.map(f=>(
          <div key={f.key} style={{background:"var(--s2)",borderRadius:10,padding:"12px",border:"1px solid var(--border)"}}>
            <div style={{fontSize:11,marginBottom:6,color:"var(--muted2)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{f.label}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontSize:22,fontWeight:700,lineHeight:1}}>{myProfile.wins[f.key]??0}</span>
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

      {/* Friends */}
      <div className="sec-lbl" style={{marginTop:6}}>Friends ({myFriends.length})</div>
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 16px 8px"}}>
        <span className="sec-lbl" style={{marginTop:0,marginBottom:0,padding:0}}>My Groups ({myGroups.length})</span>
        <button className="btn btn-secondary btn-sm" onClick={onCreateGroup} style={{fontSize:12,gap:4}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Group
        </button>
      </div>
      {myGroups.length===0&&<div className="empty" style={{textAlign:"left",padding:"10px 16px"}}>No groups yet.</div>}
      {myGroups.map(g=>(
        <div key={g.id} style={{background:"var(--s2)",borderRadius:12,margin:"0 16px 6px",border:"1px solid var(--border)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
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
function EditProfile({ myProfile, setMyProfile, myCar, setMyCar, onBack }) {
  const [form, setForm] = useState({...myProfile});
  const [carForm, setCarForm] = useState({...myCar});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(myCar.photoUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const setF = (k, v) => setForm(f=>({...f,[k]:v}));
  const setC = (k, v) => setCarForm(c=>({...c,[k]:v}));

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Upload car photo if a new one was selected
      let photoUrl = carForm.photoUrl;
      if (photoFile && myProfile.id) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${myProfile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("car-photos").upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage
          .from("car-photos").getPublicUrl(path);
        photoUrl = publicUrl;
      }

      // 2. Update profile row
      if (myProfile.id) {
        await supabase.from("profiles").update({
          display_name: form.displayName,
          show_real_name: form.showRealName,
          city: form.city,
          instagram: form.instagram,
          avatar_initials: form.avatar,
        }).eq("id", myProfile.id);
      }

      // 3. Upsert car (only if at least make+model are filled)
      let newCarId = carForm.id;
      if (carForm.make.trim() && carForm.model.trim() && myProfile.id) {
        const carPayload = {
          user_id: myProfile.id,
          make: carForm.make.trim(),
          model: carForm.model.trim(),
          year: parseInt(carForm.year) || null,
          trim: carForm.trim.trim() || null,
          mods: carForm.mods.trim() || null,
          photos: photoUrl ? [photoUrl] : (carForm.photoUrl ? [carForm.photoUrl] : []),
          is_primary: true,
        };
        if (carForm.id) {
          await supabase.from("user_cars").update(carPayload).eq("id", carForm.id);
        } else {
          const { data: inserted } = await supabase.from("user_cars")
            .insert(carPayload).select("id").single();
          newCarId = inserted?.id || null;
        }
      }

      // 4. Update local state
      const updatedProfile = { ...form, instagram: form.instagram,
        socials: { ...form.socials, instagram: form.instagram } };
      const updatedCar = { ...carForm, id: newCarId, photoUrl };
      setMyProfile(updatedProfile);
      setMyCar(updatedCar);
      onBack();
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Profile</button>
      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">Edit Profile</div>
        <div className="pg-sub">Update your information</div>
      </div>

      {/* ── Car section ── */}
      <div className="sec-lbl">My Car</div>
      <div className="card" style={{marginBottom:8}}>
        {/* Photo upload */}
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoSelect}/>
        <div className="photo-upload-wrap" onClick={()=>fileRef.current?.click()}>
          {photoPreview && <img src={photoPreview} alt="car preview"/>}
          <div className="photo-upload-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span className="photo-upload-hint">{photoPreview ? "Change photo" : "Add photo"}</span>
          </div>
          {!photoPreview && (
            <>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span style={{fontSize:11,color:"var(--muted2)"}}>Tap to add car photo</span>
            </>
          )}
        </div>

        {/* Car fields */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div>
            <label className="inp-label">Make</label>
            <input className="inp" value={carForm.make} onChange={e=>setC("make",e.target.value)} placeholder="Honda"/>
          </div>
          <div>
            <label className="inp-label">Model</label>
            <input className="inp" value={carForm.model} onChange={e=>setC("model",e.target.value)} placeholder="Civic"/>
          </div>
          <div>
            <label className="inp-label">Year</label>
            <input className="inp" value={carForm.year} onChange={e=>setC("year",e.target.value)} placeholder="2020" type="number"/>
          </div>
          <div>
            <label className="inp-label">Trim</label>
            <input className="inp" value={carForm.trim} onChange={e=>setC("trim",e.target.value)} placeholder="Type R"/>
          </div>
        </div>

        <div>
          <label className="inp-label">Modifications</label>
          <textarea className="inp" rows={4}
            style={{resize:"vertical",lineHeight:1.6,fontFamily:"var(--font-mono)",fontSize:12}}
            value={carForm.mods} onChange={e=>setC("mods",e.target.value)}
            placeholder={"Cold air intake\nCoilover suspension\nMagnaflow catback\n..."}/>
        </div>
      </div>

      {/* ── Identity ── */}
      <div className="sec-lbl">Identity</div>
      <div className="list-card" style={{margin:"0 16px 8px"}}>
        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-title">Show Real Name</div>
            <div className="toggle-sub">Display your name publicly</div>
          </div>
          <div className={`toggle ${form.showRealName?"on":""}`} onClick={()=>setF("showRealName",!form.showRealName)}>
            <div className="toggle-knob"/>
          </div>
        </div>
      </div>
      <div className="card" style={{display:"flex",flexDirection:"column",gap:10,marginBottom:8}}>
        {[["Display Name","displayName","Your real name"],["City","city","City, State"]].map(([label,key,ph])=>(
          <div key={key}>
            <label className="inp-label">{label}</label>
            <input className="inp" value={form[key]||""} onChange={e=>setF(key,e.target.value)} placeholder={ph}/>
          </div>
        ))}
      </div>

      {/* ── Instagram ── */}
      <div className="sec-lbl">Instagram</div>
      <div className="card" style={{marginBottom:8}}>
        <label className="inp-label">Handle</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--muted2)",display:"flex",alignItems:"center"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </span>
          <input className="inp" style={{paddingLeft:36}} value={form.instagram||""} onChange={e=>setF("instagram",e.target.value)} placeholder="@yourhandle"/>
        </div>
        {form.instagram && (
          <a href={`https://instagram.com/${(form.instagram||"").replace("@","")}`}
            target="_blank" rel="noopener noreferrer"
            style={{display:"inline-block",marginTop:8,fontSize:12,color:"var(--blue)"}}>
            instagram.com/{(form.instagram||"").replace("@","")} ↗
          </a>
        )}
      </div>

      {/* ── Race Times ── */}
      <div className="sec-lbl">Recorded Times</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:8}}>
        {RACE_TIMES.map(t=>(
          <div key={t.key} style={{background:"var(--s2)",borderRadius:10,padding:"12px",border:"1px solid var(--border)"}}>
            <label className="inp-label" style={{padding:0,marginBottom:6}}>{t.label} ({t.unit})</label>
            <input className="inp" style={{padding:"8px 10px",fontSize:13}} value={form.times?.[t.key]||""} onChange={e=>setF("times",{...form.times,[t.key]:e.target.value})} placeholder="e.g. 3.8"/>
          </div>
        ))}
      </div>

      {error && <div style={{margin:"0 16px 10px",padding:"10px 14px",background:"rgba(255,59,48,.1)",border:"1px solid rgba(255,59,48,.25)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{error}</div>}

      <div style={{padding:"4px 16px 32px"}}>
        <button className="btn btn-primary btn-full" style={{borderRadius:10,padding:"14px"}}
          onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
