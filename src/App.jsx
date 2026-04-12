import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase.js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AuthPage from "./components/AuthPage.jsx";
import LandingPage from "./components/LandingPage.jsx";
import logoImg from "./assets/logo.png";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const GFONTS = `@import url('https://fonts.cdnfonts.com/css/pricedown');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

/* ─── RANK TIERS ────────────────────────────────────────── */
const TIERS = [
  { name:"Unranked", min:0,   max:2,   color:"#555",    bg:"#1a1a1a", border:"#2a2a2a", icon:"—" },
  { name:"Bronze",   min:3,   max:9,   color:"#CD7F32", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Silver",   min:10,  max:24,  color:"#C0C0C0", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Gold",     min:25,  max:49,  color:"#f59e0b", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Platinum", min:50,  max:99,  color:"#22c55e", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Diamond",  min:100, max:Infinity, color:"#ef4444", bg:"#1a1a1a", border:"#2a2a2a", icon:"◆" },
];
const getTier = (wins) => TIERS.find(t => wins >= t.min && wins <= t.max) || TIERS[0];

const FORMAT = [
  {key:"h2h",  label:"Head to Head", short:"H2H",   icon:"⚔"},
  {key:"group",label:"Group Race",   short:"Group",  icon:"◈"},
  {key:"trial",label:"Time Trial",   short:"Trial",  icon:"◎"},
  {key:"drag", label:"Drag",         short:"Drag",   icon:"↑"},
];

const RACE_TIMES = [
  {key:"zero_sixty",   label:"0-60",   unit:"sec"},
  {key:"zero_120",     label:"0-120",  unit:"sec"},
  {key:"quarter_mile", label:"¼ Mile", unit:"sec"},
  {key:"half_mile",    label:"½ Mile", unit:"sec"},
];

const LEADERBOARD_CATS = [
  { key:"0-60",         label:"0-60",   sub:"sec" },
  { key:"0-120",        label:"0-120",  sub:"sec" },
  { key:"quarter_mile", label:"¼ Mile", sub:"sec" },
  { key:"half_mile",    label:"½ Mile", sub:"sec" },
];

const CAR_CLASSES = ["All","JDM","German","American","Muscle","Supercars","Exotics","Truck","Other"];

const LOBBY_TYPES = ["Cruising","Drifting","Roll Racing","Drag Racing","Meets","JDM","German","American","Supercars","Exotics"];

const BUILD_STAGES = [
  { key:"stock",  label:"Stock",       color:"#555555", bg:"rgba(85,85,85,.1)" },
  { key:"stage1", label:"Stage 1",     color:"#f59e0b", bg:"rgba(245,158,11,.1)" },
  { key:"stage2", label:"Stage 2",     color:"#e61a1a", bg:"rgba(230,26,26,.1)" },
  { key:"built",  label:"Fully Built", color:"#a855f7", bg:"rgba(168,85,247,.1)" },
];

const BLANK_PROFILE = {
  id: null, username: "", displayName: "", showRealName: false,
  avatar: "", city: "", car: "", year: "",
  wins:  {h2h:0, group:0, trial:0, drag:0},
  races: {h2h:0, group:0, trial:0, drag:0},
  times: {half_mile:"", quarter_mile:"", zero_sixty:"", zero_120:""},
  socials: {instagram:"", twitter:"", youtube:""},
  instagram: "", lat: null, lng: null, mapVisible: true, bannerUrl: "",
};

const GROUP_THEMES = ["#e61a1a","#0066ff","#00c060","#f59e0b","#a855f7","#ec4899","#06b6d4","#ffffff"];

const BLANK_CAR = {
  id: null, make: "", model: "", year: "", trim: "", mods: "", photoUrl: "", buildStage: "stock",
};

const tw = w => Object.values(w||{}).reduce((a,b)=>a+b,0);

function haversine(lat1, lon1, lat2, lon2) {
  if (!lat1||!lon1||!lat2||!lon2) return Infinity;
  const R = 3958.8;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fuzzyCoords(lat, lng) {
  if (!lat||!lng) return {lat:null,lng:null};
  return { lat: Math.round(lat*100)/100, lng: Math.round(lng*100)/100 };
}

function getU(id, allUsers, myProfile) {
  if (id === myProfile?.id) return myProfile;
  return allUsers.find(x => x.id === id) || null;
}

function computeRanks(allUsers, myProfile) {
  const all = myProfile?.id ? [myProfile, ...allUsers] : allUsers;
  return all.map(p=>({id:p.id, totalWins:tw(p.wins)}))
    .sort((a,b)=>b.totalWins-a.totalWins)
    .map((x,i)=>({...x,rank:i+1}));
}

function profileFromRow(row) {
  const initials = (row.display_name||row.username||"?")
    .split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  return {
    ...BLANK_PROFILE,
    id: row.id,
    username: row.username||"",
    displayName: row.display_name||row.username||"",
    showRealName: row.show_real_name??false,
    avatar: row.avatar_initials||initials,
    city: row.city||"",
    instagram: row.instagram||"",
    socials: {instagram:row.instagram||"", twitter:"", youtube:""},
    lat: row.lat??null, lng: row.lng??null,
    mapVisible: row.map_visible??true,
    bannerUrl: row.banner_url||"",
    hasAccess: row.has_access??false,
  };
}

function carFromRow(row) {
  return {
    id: row.id, make: row.make||"", model: row.model||"",
    year: row.year?.toString()||"", trim: row.trim||"",
    mods: row.mods||"", photoUrl: row.photos?.[0]||"",
    buildStage: row.build_stage||"stock",
  };
}

/* ─── CSS ────────────────────────────────────────────────── */
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
  --orange:#f59e0b;
  --red:#ff3b30;
  --accent:#e61a1a;
  --accent-hover:#c01515;
  --accent-glow:rgba(230,26,26,0.2);
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

/* LOGO */
.logo-lockup{display:flex;align-items:center;gap:7px;line-height:1;text-decoration:none}
.logo-icon-wrap{background:var(--accent);border-radius:5px;padding:3px 7px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-icon-text{font-family:var(--font-display);font-size:13px;font-weight:900;color:#fff;letter-spacing:.5px;line-height:1.1}
.logo-race-text{font-family:var(--font-display);font-size:22px;font-weight:800;color:var(--text);letter-spacing:1px;line-height:1}
.logo-sub{display:none}

/* HEADER */
.hdr{background:rgba(10,10,10,.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:14px 20px 10px;position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border)}
.hdr-row{display:flex;align-items:center;justify-content:space-between}
.me-pill{display:flex;align-items:center;gap:10px;margin-top:10px;background:var(--s2);border-radius:var(--radius-lg);padding:10px 14px;border:1px solid var(--border)}
.me-username{font-size:12px;font-weight:600;color:var(--text)}
.me-car{font-size:11px;color:var(--muted);margin-top:1px}

/* AVATAR */
.av{border-radius:50%;background:var(--s3);color:var(--text);font-family:var(--font-mono);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;border:1px solid var(--border2)}
.av.s24{width:24px;height:24px;font-size:8px}
.av.s28{width:28px;height:28px;font-size:8px}
.av.s32{width:32px;height:32px;font-size:10px}
.av.s40{width:40px;height:40px;font-size:12px}
.av.s56{width:56px;height:56px;font-size:16px}
.av.me{border-color:var(--accent);color:var(--accent)}
.av.green{border-color:var(--green);color:var(--green)}

/* TIER BADGE */
.tier-badge{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:9px;letter-spacing:.5px;padding:3px 8px;border-radius:var(--radius-sm);font-weight:500;border:1px solid var(--border2);background:var(--s2);color:var(--muted)}

/* BUILD BADGE */
.build-badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:var(--radius-sm);letter-spacing:.5px;text-transform:uppercase;border:1px solid;white-space:nowrap}

/* NAV */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(10,10,10,.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:1px solid var(--border);display:flex;z-index:200;padding-bottom:env(safe-area-inset-bottom)}
.ni{flex:1;padding:10px 4px 11px;text-align:center;cursor:pointer;color:var(--muted2);font-size:10px;font-weight:500;border:none;background:none;transition:color .12s;display:flex;flex-direction:column;align-items:center;gap:3px;letter-spacing:.03em}
.ni.on{color:var(--text)}
.ni-icon{line-height:1;display:flex;align-items:center;justify-content:center}
.ni-dot{width:3px;height:3px;border-radius:50%;background:var(--accent);margin:0 auto;margin-top:1px}

/* CONTENT */
.content{flex:1;overflow-y:auto;padding:0 0 86px}

/* PAGE HEADER */
.pg-hdr{padding:24px 20px 14px}
.pg-title{font-size:26px;font-weight:700;color:var(--text);line-height:1;margin-bottom:3px;font-family:var(--font-display);letter-spacing:.5px}
.pg-sub{font-size:11px;color:var(--muted);font-weight:400;letter-spacing:.01em}
.sec-lbl{font-size:10px;font-weight:600;letter-spacing:1.8px;color:var(--muted2);text-transform:uppercase;padding:0 20px;margin-bottom:8px;margin-top:4px}

/* CARDS */
.card{background:var(--s2);border-radius:var(--radius-lg);padding:16px;margin:0 16px 8px;border:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.card.click{cursor:pointer;transition:all var(--transition-fast)}
.card.click:active{background:var(--s3);transform:scale(0.985)}
.list-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border);overflow:hidden}
.list-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:all var(--transition-fast)}
.list-item:last-child{border-bottom:none}
.list-item:active{background:var(--s3);padding-left:18px}
.list-item-icon{width:34px;height:34px;border-radius:var(--radius-md);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.list-item-info{flex:1;min-width:0}
.list-item-title{font-size:13px;font-weight:500;color:var(--text)}
.list-item-sub{font-size:11px;color:var(--muted);margin-top:1px}
.chevron{color:var(--muted2);font-size:12px}

/* BUTTONS */
.btn{font-family:var(--font-sans);font-size:13px;font-weight:600;padding:10px 18px;border-radius:var(--radius-md);border:none;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap;display:inline-flex;align-items:center;gap:6px;letter-spacing:-.01em}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-hover)}
.btn-secondary{background:transparent;color:var(--text);border:1px solid var(--border2)}
.btn-secondary:hover{background:var(--s2);border-color:var(--border3)}
.btn-green{background:rgba(0,192,96,.1);color:var(--green);border:1px solid rgba(0,192,96,.25)}
.btn-orange{background:rgba(230,26,26,.1);color:var(--accent);border:1px solid rgba(230,26,26,.25)}
.btn-red{background:rgba(255,59,48,.1);color:var(--red);border:1px solid rgba(255,59,48,.25)}
.btn-sm{padding:5px 11px;font-size:11px;border-radius:6px}
.btn:active:not(:disabled){transform:scale(0.96)}.btn:disabled{opacity:.3;cursor:default}
.btn-full{width:100%;justify-content:center}

/* SEARCH */
.srch-wrap{position:relative;margin:0 16px 12px}
.srch-inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 16px 11px 40px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.srch-inp::placeholder{color:var(--muted2)}
.srch-inp:focus{border-color:var(--border3);box-shadow:0 0 0 2px rgba(255,255,255,.03)}
.srch-x{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted2);cursor:pointer;font-size:16px;background:none;border:none;line-height:1}
.srch-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted2);pointer-events:none;display:flex;align-items:center}

/* FILTER PILLS */
.pills{display:flex;gap:6px;padding:0 16px;margin-bottom:12px;overflow-x:auto}
.pills::-webkit-scrollbar{display:none}
.pill{font-size:11px;font-weight:500;padding:5px 13px;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .12s;white-space:nowrap;letter-spacing:.01em}
.pill.on{background:var(--accent);color:#fff;border-color:var(--accent)}

/* STAT BOXES */
.stat-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.stat-box{background:var(--s2);border-radius:var(--radius-md);padding:14px;border:1px solid var(--border)}
.stat-n{font-size:30px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1.5px}
.stat-n.green{color:var(--green)}
.stat-n.red{color:var(--accent)}
.stat-l{font-size:10px;color:var(--muted);font-weight:500;margin-top:4px;letter-spacing:.8px;text-transform:uppercase}

/* GROUP / LOBBY CARD */
.gc-type-pill{font-size:9px;font-weight:600;padding:3px 9px;border-radius:var(--radius-full);letter-spacing:.8px;text-transform:uppercase}
.gc-type-pill.open{background:rgba(0,192,96,.1);color:var(--green);border:1px solid rgba(0,192,96,.2)}
.gc-type-pill.private{background:rgba(230,26,26,.1);color:var(--accent);border:1px solid rgba(230,26,26,.2)}
.gc-name{font-size:17px;font-weight:700;color:var(--text);margin:8px 0 4px;letter-spacing:-.3px}
.gc-desc{font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:10px}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
.tag{font-size:10px;font-weight:500;color:var(--muted2);background:var(--s3);padding:3px 9px;border-radius:var(--radius-sm);border:1px solid var(--border)}
.gc-meta{font-size:11px;color:var(--muted)}
.gc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.gc-user-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);font-weight:500;background:var(--s3);padding:3px 9px;border-radius:var(--radius-full);border:1px solid var(--border)}
.gc-actions{display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.gc-last-active{font-size:10px;color:var(--muted2);flex:1}

/* LOBBY SPECIFIC */
.lobby-type-pill{font-size:9px;font-weight:700;padding:3px 9px;border-radius:var(--radius-full);letter-spacing:.8px;text-transform:uppercase;background:rgba(230,26,26,.1);color:var(--accent);border:1px solid rgba(230,26,26,.25)}
.lobby-cars{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}
.lobby-car-chip{font-family:var(--font-mono);font-size:10px;color:var(--muted);background:var(--s3);border:1px solid var(--border);padding:2px 8px;border-radius:var(--radius-sm);white-space:nowrap}
.lobby-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}
.lobby-meta-item{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted2)}
.mic-on{color:var(--green)}
.mic-off{color:var(--muted2)}
.dist-pill{font-family:var(--font-mono);font-size:9px;color:var(--muted2);background:var(--s3);padding:2px 7px;border-radius:var(--radius-sm);border:1px solid var(--border)}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block;animation:livepulse 1.5s infinite;flex-shrink:0}
@keyframes livepulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.lobby-user-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border)}
.lobby-user-row:last-child{border-bottom:none}

/* USER ROW */
.user-row{display:flex;align-items:center;gap:12px;padding:13px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 6px;border:1px solid var(--border);cursor:pointer;transition:all var(--transition-fast);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.user-row:active{background:var(--s3);transform:scale(0.985)}
.user-name{font-size:13px;font-weight:600;color:var(--text)}
.user-username{font-size:12px;color:var(--accent);font-weight:500;margin-top:1px}
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

/* CHAT */
.chat-msgs{display:flex;flex-direction:column;gap:10px;padding:0 16px 8px;overflow-y:auto;max-height:50vh;min-height:180px}
.msg-row{display:flex;gap:8px;align-items:flex-end}
.msg-row.mine{flex-direction:row-reverse}
.msg-bubble{background:var(--s2);border:1px solid var(--border);border-radius:12px 12px 12px 3px;padding:9px 12px;max-width:82%}
.msg-bubble.mine{background:rgba(230,26,26,.1);border-color:rgba(230,26,26,.2);border-radius:12px 12px 3px 12px}
.msg-meta{display:flex;align-items:center;gap:5px;margin-bottom:3px;flex-wrap:wrap}
.msg-who{font-size:11px;font-weight:600;color:var(--accent)}
.msg-car{font-size:9px;color:var(--muted2);font-family:var(--font-mono)}
.msg-text{font-size:13px;line-height:1.5;color:var(--text)}
.msg-time{font-size:9px;color:var(--muted2);margin-top:3px}
.chat-input-bar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--border);padding:10px 16px 12px;display:flex;gap:8px;align-items:center}

/* LEADERBOARD */
.lb-row{display:flex;align-items:center;gap:12px;padding:13px 16px;background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 6px;border:1px solid var(--border);cursor:pointer;transition:all var(--transition-fast);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.lb-row:active{background:var(--s3);transform:scale(0.985)}
.lb-row.mine{border-left:2px solid var(--accent)}
.lb-rank{font-size:13px;font-weight:700;color:var(--muted2);width:22px;text-align:center;flex-shrink:0;font-variant-numeric:tabular-nums}
.lb-rank.top{color:var(--text)}
.lb-info{flex:1;min-width:0}
.lb-name{font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lb-sub{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-wins{text-align:right;flex-shrink:0}
.lb-wins-n{font-size:20px;font-weight:700;color:var(--text);line-height:1;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.lb-wins-l{font-size:9px;color:var(--muted2);margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
.you-tag{font-size:9px;font-weight:600;color:var(--accent);background:rgba(230,26,26,.12);border:1px solid rgba(230,26,26,.25);padding:2px 6px;border-radius:4px;letter-spacing:.3px}
.lb-cat-tabs{display:grid;grid-template-columns:repeat(4,1fr);margin:0 16px 12px;background:var(--s2);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden}
.lb-cat-tab{font-family:var(--font-sans);font-size:11px;font-weight:600;padding:11px 4px;text-align:center;cursor:pointer;border:none;background:transparent;color:var(--muted);transition:all .12s;letter-spacing:.02em;line-height:1.2}
.lb-cat-tab.on{background:var(--accent);color:#fff}
.lb-cat-tab:not(:last-child){border-right:1px solid var(--border)}
.lb-cat-tab-sub{font-size:9px;font-weight:400;display:block;opacity:.7;margin-top:2px}
.car-class-badge{display:inline-flex;align-items:center;font-size:9px;font-weight:600;letter-spacing:.5px;padding:2px 7px;border-radius:4px;background:rgba(230,26,26,.1);color:var(--accent);border:1px solid rgba(230,26,26,.2);text-transform:uppercase;white-space:nowrap}
.lb-time-val{font-family:var(--font-mono);font-size:19px;font-weight:700;line-height:1;letter-spacing:-0.5px;font-variant-numeric:tabular-nums}
.lb-time-unit{font-size:11px;font-weight:400;color:var(--muted)}
.my-best-bar{margin:0 16px 8px;padding:11px 14px;background:rgba(230,26,26,.06);border:1px solid rgba(230,26,26,.2);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between}
.proof-link{font-size:10px;color:var(--accent);text-decoration:none;letter-spacing:.01em;display:inline-block;margin-top:3px}
.proof-link:hover{text-decoration:underline}
.lb-loc-tabs{display:flex;gap:6px;padding:0 16px;margin-bottom:10px}
.lb-loc-tab{font-size:11px;font-weight:600;padding:6px 14px;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .12s;white-space:nowrap}
.lb-loc-tab.on{background:var(--s2);color:var(--text);border-color:var(--border3)}

/* CAR SHOWCASE */
.car-showcase{margin:0 16px 10px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);background:var(--s2)}
.car-photo-wrap{width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--s3);position:relative;cursor:pointer}
.car-photo-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease}
.car-photo-wrap:hover img{transform:scale(1.02)}
.car-photo-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--muted2);cursor:pointer;transition:background .15s}
.car-photo-empty:hover{background:var(--s2)}
.car-photo-label{font-size:11px;letter-spacing:.5px;font-weight:500}
.car-info-block{padding:16px 18px 18px}
.car-year-badge{display:inline-flex;align-items:center;font-family:var(--font-mono);font-size:11px;font-weight:500;color:var(--accent);background:rgba(230,26,26,.1);border:1px solid rgba(230,26,26,.2);padding:3px 10px;border-radius:var(--radius-sm);margin-bottom:10px;letter-spacing:.5px}
.car-make-model{font-size:28px;font-weight:700;color:var(--text);line-height:1.1;font-family:var(--font-display);letter-spacing:.5px;word-break:break-word}
.car-trim{font-size:12px;color:var(--muted);margin-top:5px;font-weight:500;letter-spacing:.01em}
.car-mods-section{margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
.car-mods-label{font-size:9px;font-weight:600;letter-spacing:1.8px;color:var(--muted2);text-transform:uppercase;margin-bottom:8px}
.car-mods-text{font-size:12px;color:var(--text2);line-height:1.7;font-family:var(--font-mono)}
.car-empty-state{padding:24px 18px;text-align:center}
.car-empty-text{font-size:13px;color:var(--muted);margin-bottom:14px}

/* PHOTO UPLOAD */
.photo-upload-wrap{width:100%;aspect-ratio:16/9;border-radius:var(--radius-md);overflow:hidden;background:var(--s3);border:1px solid var(--border);position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--muted2);margin-bottom:10px;transition:border-color .15s}
.photo-upload-wrap:hover{border-color:var(--accent)}
.photo-upload-wrap img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.photo-upload-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;opacity:0;transition:opacity .15s}
.photo-upload-wrap:hover .photo-upload-overlay{opacity:1}
.photo-upload-hint{font-size:11px;color:#fff;letter-spacing:.3px}

/* PROFILE TIMES */
.times-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 16px 8px}
.time-box{background:var(--s2);border-radius:var(--radius-md);padding:14px;border:1px solid var(--border)}
.time-lbl{font-size:9px;color:var(--muted2);font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}
.time-val{font-size:24px;font-weight:700;color:var(--green);line-height:1;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.time-unit{font-size:10px;color:var(--muted);margin-top:2px}

/* INPUT */
.inp-group{margin:0 16px 10px}
.inp-label{font-size:10px;font-weight:600;letter-spacing:1.2px;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:6px}
.inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 14px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.inp:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(230,26,26,.08)}
.inp::placeholder{color:var(--muted2)}
.chat-inp{flex:1;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:11px 14px;font-family:var(--font-sans);font-size:13px;color:var(--text);outline:none;transition:border-color var(--transition-fast)}
.chat-inp:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(230,26,26,.08)}
.chat-inp::placeholder{color:var(--muted2)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border)}
.toggle-title{font-size:13px;font-weight:500;color:var(--text)}
.toggle-sub{font-size:11px;color:var(--muted);margin-top:2px}
.toggle{width:42px;height:24px;border-radius:12px;background:var(--s3);border:1px solid var(--border2);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--accent);border-color:transparent}
.toggle-knob{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.toggle.on .toggle-knob{left:20px}

/* MISC */
.rule{height:1px;background:var(--border);margin:12px 16px}
.back-btn{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;padding:14px 20px 6px;background:none;border:none;letter-spacing:.02em;transition:color var(--transition-fast),gap var(--transition-fast)}
.back-btn:hover{color:var(--text);gap:9px}
.empty{font-size:12px;color:var(--muted2);text-align:center;padding:28px 20px;font-weight:400}
.fade{animation:fu .22s cubic-bezier(.25,.46,.45,.94) both}
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.notif-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block;margin-left:3px;vertical-align:middle}
.section-divider{height:8px;background:var(--bg)}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:400;display:flex;align-items:flex-end;justify-content:center}
.modal-sheet{background:var(--s1);border-radius:var(--radius-xl) var(--radius-xl) 0 0;border:1px solid var(--border2);border-bottom:none;padding:20px 20px 40px;width:100%;max-width:100%;max-height:88vh;overflow-y:auto}
@media(min-width:480px){.modal-sheet{max-width:430px}}
.modal-handle{width:36px;height:4px;background:var(--border3);border-radius:4px;margin:0 auto 20px}
.modal-title{font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px;font-family:var(--font-display);letter-spacing:.5px}
.modal-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
.seg{display:flex;background:var(--s3);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden;margin-bottom:10px}
.seg-opt{flex:1;padding:9px;text-align:center;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;transition:all .12s;border:none;background:none;font-family:var(--font-sans)}
.seg-opt.on{background:var(--accent);color:#fff}

/* SOCIAL */
.social-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)}
.social-item:last-child{border-bottom:none}
.social-icon{width:32px;height:32px;border-radius:var(--radius-md);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.social-platform{font-size:10px;color:var(--muted2);font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.social-handle{font-size:12px;color:var(--text);font-weight:500;margin-top:1px}

/* FRIENDS ACTIVE */
.friend-active-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;box-shadow:0 0 5px rgba(0,192,96,.6)}
.friend-inactive-dot{width:8px;height:8px;border-radius:50%;background:var(--border3);flex-shrink:0}

/* MPH DISPLAY */
.mph-bar{margin:0 16px 10px;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px}
.mph-row{display:flex;align-items:center;justify-content:space-between}
.mph-num{font-family:var(--font-mono);font-size:36px;font-weight:700;line-height:1;letter-spacing:-2px;color:var(--accent)}
.mph-unit{font-size:11px;color:var(--muted);font-weight:500;margin-top:6px}
.mph-label{font-size:10px;font-weight:600;letter-spacing:1.5px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px}
.mph-member{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.mph-member:last-child{border-bottom:none}
.mph-member-speed{font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--accent)}

/* GROUP DETAIL */
.group-banner{width:100%;aspect-ratio:3/1;object-fit:cover;display:block;background:var(--s3)}
.group-banner-empty{width:100%;height:80px;background:var(--s3);display:flex;align-items:center;justify-content:center;color:var(--muted2);font-size:11px;cursor:pointer;transition:background .15s;border-radius:var(--radius-lg) var(--radius-lg) 0 0}
.group-banner-empty:hover{background:var(--s2)}
.group-theme-dot{width:20px;height:20px;border-radius:50%;cursor:pointer;transition:transform .12s;flex-shrink:0}
.group-theme-dot:hover{transform:scale(1.2)}
.group-theme-dot.sel{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--accent)}
.post-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border);padding:14px}
.post-author{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.post-text{font-size:13px;color:var(--text2);line-height:1.6}
.post-time{font-size:10px;color:var(--muted2);margin-top:6px}
.event-card{background:var(--s2);border-radius:var(--radius-lg);margin:0 16px 8px;border:1px solid var(--border);padding:14px;display:flex;align-items:center;gap:12px}
.event-date{width:44px;height:44px;border-radius:var(--radius-md);background:rgba(230,26,26,.1);border:1px solid rgba(230,26,26,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.event-date-day{font-size:18px;font-weight:700;color:var(--accent);line-height:1;font-family:var(--font-display)}
.event-date-mon{font-size:8px;color:var(--muted2);letter-spacing:1px;text-transform:uppercase}
.event-info{flex:1;min-width:0}
.event-title{font-size:13px;font-weight:600;color:var(--text)}
.event-sub{font-size:11px;color:var(--muted);margin-top:2px}
.event-priv{font-size:9px;padding:2px 6px;border-radius:3px;font-weight:600;letter-spacing:.5px}

/* PROFILE BANNER */
.profile-banner{width:100%;height:110px;object-fit:cover;display:block;background:var(--s3);position:relative}
.profile-banner-empty{width:100%;height:110px;background:linear-gradient(135deg,var(--s3) 0%,var(--s2) 100%);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted2);font-size:11px;gap:6px}

/* FOLLOW ME */
.follow-me-btn{display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(0,192,96,.08);border:1px solid rgba(0,192,96,.2);border-radius:var(--radius-md);color:var(--green);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;width:100%;justify-content:center}
.follow-me-btn.active{background:rgba(0,192,96,.18);border-color:rgba(0,192,96,.4)}

/* SIDEBAR (desktop only) */
.sidebar{display:none}
.main-area{flex:1;min-width:0;display:flex;flex-direction:column}

@media(min-width:768px){
  html,body{overflow-x:hidden}
  .app{max-width:100%;flex-direction:row;align-items:flex-start;min-height:100vh}
  .sidebar{
    display:flex;flex-direction:column;width:220px;height:100vh;
    position:sticky;top:0;flex-shrink:0;
    background:var(--s1);border-right:1px solid var(--border);
    overflow:hidden;z-index:150;
  }
  .sidebar-top{padding:22px 20px 16px;border-bottom:1px solid var(--border);flex-shrink:0}
  .sidebar-logo-sub{font-family:var(--font-mono);font-size:7px;letter-spacing:2.5px;color:var(--muted2);text-transform:uppercase;margin-bottom:16px}
  .sidebar-profile{display:flex;align-items:center;gap:10px;background:var(--s2);border-radius:var(--radius-md);padding:10px 12px;border:1px solid var(--border)}
  .sidebar-profile-info{flex:1;min-width:0}
  .sidebar-profile-name{font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sidebar-nav{flex:1;padding:6px 0;overflow-y:auto}
  .sidebar-ni{
    display:flex;align-items:center;gap:12px;
    padding:10px 20px;font-size:12px;font-weight:500;
    color:var(--muted);cursor:pointer;border:none;background:none;
    width:100%;text-align:left;transition:all var(--transition-fast);
    font-family:var(--font-sans);letter-spacing:-.01em;
  }
  .sidebar-ni:hover{color:var(--text)}
  .sidebar-ni.on{color:var(--text);background:var(--s2);border-right:2px solid var(--accent)}
  .sidebar-ni-icon{width:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .sidebar-notif{margin-left:auto;min-width:16px;height:16px;border-radius:8px;background:var(--accent);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px}
  .sidebar-bottom{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}
  .hdr{display:none}
  .nav{display:none!important}
  .main-area{max-width:720px;margin:0 auto;width:100%;padding:0 8px}
  .content{padding:0 0 48px}
  .pg-hdr{padding:28px 20px 16px}
  .pg-title{font-size:28px}
  .map-wrap{height:420px}
  .desktop-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px;margin-bottom:8px}
  .desktop-2col .card{margin:0}
}

@media(min-width:1100px){
  .sidebar{width:240px}
  .main-area{max-width:800px}
}
`;

/* ─── LOGO COMPONENT ─────────────────────────────────────── */
function Logo({ sidebarVariant = false }) {
  const h = sidebarVariant ? 36 : 44;
  return (
    <img src={logoImg} alt="0x" style={{height:h, width:"auto", display:"block", flexShrink:0}} />
  );
}

/* ─── NAV ICONS ──────────────────────────────────────────── */
function NavIcon({ name, size = 20 }) {
  const s = size;
  const p = { width:s, height:s, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
  switch (name) {
    case "Lobbies":
      return <svg {...p}><circle cx="12" cy="12" r="2"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/></svg>;
    case "Groups":
      return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "Search":
      return <svg {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
    case "Map":
      return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case "Ranks":
      return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case "Profile":
      return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    default: return null;
  }
}

/* ─── TIER BADGE ─────────────────────────────────────────── */
function TierBadge({ wins }) {
  const t = getTier(wins);
  return (
    <span className="tier-badge" style={{color:t.color,borderColor:t.color+"44"}}>
      {t.icon} {t.name}
    </span>
  );
}

/* ─── BUILD BADGE ────────────────────────────────────────── */
function BuildBadge({ stage }) {
  const s = BUILD_STAGES.find(b=>b.key===stage) || BUILD_STAGES[0];
  if (s.key === "stock") return null;
  return (
    <span className="build-badge" style={{color:s.color,borderColor:s.color+"55",background:s.bg}}>
      {s.key==="built"?"🔧":s.key==="stage2"?"⚡":"🔩"} {s.label}
    </span>
  );
}

/* ─── CREATE LOBBY MODAL ─────────────────────────────────── */
function CreateLobbyModal({ myProfile, groups, onClose, onCreate }) {
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const [form, setForm] = useState({
    name: "", type: "Cruising", isOpen: true,
    groupId: "", destination: "", micActive: false,
  });
  const [saving, setSaving] = useState(false);

  const handleGroupChange = (gid) => {
    const g = myGroups.find(x=>x.id===gid);
    setForm(f=>({...f, groupId:gid, name: g ? g.name : f.name}));
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade">
        <div className="modal-handle"/>
        <div className="modal-title">Create Lobby</div>
        <div className="modal-sub">Start a live session for your crew</div>

        {myGroups.length > 0 && (
          <div style={{marginBottom:12}}>
            <label className="inp-label">Link to Group (optional)</label>
            <select className="inp" value={form.groupId} onChange={e=>handleGroupChange(e.target.value)}
              style={{appearance:"none",cursor:"pointer"}}>
              <option value="">None — independent lobby</option>
              {myGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {form.groupId && <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Lobby name set to group name</div>}
          </div>
        )}

        <div style={{marginBottom:12}}>
          <label className="inp-label">Lobby Name</label>
          <input className="inp" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. PDX Street Kings"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Type</label>
          <div className="pills" style={{padding:0,flexWrap:"wrap",gap:6,marginBottom:0}}>
            {LOBBY_TYPES.map(t=>(
              <button key={t} className={`pill ${form.type===t?"on":""}`} onClick={()=>setForm({...form,type:t})}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Join Type</label>
          <div className="seg">
            <button className={`seg-opt ${form.isOpen?"on":""}`} onClick={()=>setForm({...form,isOpen:true})}>Open — anyone can join</button>
            <button className={`seg-opt ${!form.isOpen?"on":""}`} onClick={()=>setForm({...form,isOpen:false})}>Request to Join</button>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label className="inp-label">Planned Destination <span style={{fontWeight:400,color:"var(--muted2)",textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
          <input className="inp" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder="e.g. Vista House, Crown Point"/>
        </div>

        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8}}
          disabled={!form.name.trim()||saving} onClick={submit}>
          {saving?"Creating…":"Go Live"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── CREATE GROUP MODAL ─────────────────────────────────── */
function CreateGroupModal({ myProfile, existingGroups, onClose, onCreateDB }) {
  const [form, setForm] = useState({ name:"", desc:"", type:"open", max:"50", tags:"", theme:"#e61a1a" });
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState("");

  const checkName = (val) => {
    setForm(f=>({...f,name:val}));
    if (!val.trim()) { setNameErr(""); return; }
    const dup = existingGroups?.some(g=>g.name.toLowerCase()===val.trim().toLowerCase());
    setNameErr(dup?"That group name is already taken.":"");
  };

  const submit = async () => {
    if (!form.name.trim() || saving || nameErr) return;
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
        <div className="modal-sub">Build a community for your crew</div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Group Name</label>
          <input className="inp" value={form.name} onChange={e=>checkName(e.target.value)} placeholder="e.g. PDX Street Kings"
            style={nameErr?{borderColor:"var(--red)"}:{}}/>
          {nameErr&&<div style={{fontSize:11,color:"var(--red)",marginTop:4}}>{nameErr}</div>}
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Description</label>
          <input className="inp" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="What's this group about?"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Privacy</label>
          <div className="seg">
            <button className={`seg-opt ${form.type==="open"?"on":""}`} onClick={()=>setForm({...form,type:"open"})}>Public</button>
            <button className={`seg-opt ${form.type==="private"?"on":""}`} onClick={()=>setForm({...form,type:"private"})}>Private</button>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Max Users</label>
          <input className="inp" type="number" value={form.max} onChange={e=>setForm({...form,max:e.target.value})} placeholder="50" min="2" max="500"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Tags (comma-separated)</label>
          <input className="inp" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="e.g. jdm, portland, honda"/>
        </div>

        <div style={{marginBottom:20}}>
          <label className="inp-label">Group Color Theme</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
            {GROUP_THEMES.map(c=>(
              <div key={c} className={`group-theme-dot ${form.theme===c?"sel":""}`}
                style={{background:c,border:c==="#ffffff"?"1px solid var(--border2)":"none"}}
                onClick={()=>setForm({...form,theme:c})}/>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8}}
          disabled={!form.name.trim()||saving||!!nameErr} onClick={submit}>
          {saving?"Creating…":"Create Group"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── APP ────────────────────────────────────────────────── */
/* ─── PAYWALL SCREEN ─────────────────────────────────────── */
function PaywallScreen({ session, onAccessGranted, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setLoading(true); setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("stripe-checkout", {
        body: { origin: window.location.origin },
      });
      if (fnErr) throw fnErr;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Could not start checkout. Try again.");
      setLoading(false);
    }
  };

  // Poll for access after returning from Stripe (handles ?payment=success)
  const checkAccess = async () => {
    setChecking(true); setError("");
    try {
      const { data } = await supabase
        .from("profiles")
        .select("has_access")
        .eq("id", session.user.id)
        .single();
      if (data?.has_access) {
        onAccessGranted();
      } else {
        setError("Payment not confirmed yet. It may take a moment — try again.");
      }
    } catch (err) {
      setError("Could not verify payment. Check your connection.");
    } finally {
      setChecking(false);
    }
  };

  // Auto-check on mount if returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      // Give Stripe webhook a moment to fire
      setTimeout(checkAccess, 1500);
    }
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="app" style={{alignItems:"center",justifyContent:"center",padding:"0 20px",textAlign:"center"}}>
        <div style={{maxWidth:360,width:"100%"}}>
          <div style={{marginBottom:28}}>
            <img src={logoImg} alt="0xRace" style={{height:48,width:"auto",marginBottom:16}}/>
            <div style={{fontSize:24,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-display)",letterSpacing:1,marginBottom:8}}>
              Unlock 0xRace
            </div>
            <div style={{fontSize:14,color:"var(--muted)",lineHeight:1.7}}>
              Get full access to live lobbies, GPS tracking, groups, and leaderboards — one time, no subscription.
            </div>
          </div>

          <div style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:16,padding:"24px 20px",marginBottom:20}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:48,color:"var(--text)",letterSpacing:-1,marginBottom:4}}>$45</div>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:20}}>One-time · Lifetime access</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20,textAlign:"left"}}>
              {["All live lobbies","Groups & crew chat","Live GPS tracking","Leaderboards","Full profile & car showcase"].map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--text2)"}}>
                  <span style={{color:"var(--green)",fontWeight:700,fontSize:12}}>✓</span>{f}
                </div>
              ))}
            </div>
            {error && <div style={{background:"rgba(255,59,48,.1)",border:"1px solid rgba(255,59,48,.3)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--red)",marginBottom:12,lineHeight:1.5}}>{error}</div>}
            <button className="btn btn-primary btn-full" style={{borderRadius:10,padding:14,fontSize:14,marginBottom:8}}
              onClick={handlePay} disabled={loading||checking}>
              {loading ? "Redirecting to checkout…" : "Pay $45 — Get Access"}
            </button>
            <button className="btn btn-secondary btn-full" style={{borderRadius:10,padding:12,fontSize:13}}
              onClick={checkAccess} disabled={loading||checking}>
              {checking ? "Checking…" : "I already paid — verify access"}
            </button>
          </div>

          <div style={{fontSize:11,color:"var(--muted2)",marginBottom:20,lineHeight:1.6}}>
            Already an 0xdrive Tier 2 member? Contact us to get access linked.
          </div>
          <button onClick={onLogout} style={{background:"none",border:"none",color:"var(--muted2)",fontSize:12,cursor:"pointer"}}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [tab, setTab] = useState("Lobbies");
  const [groups, setGroups] = useState([]);
  const [lobbies, setLobbies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendReqs, setFriendReqs] = useState([]);
  const [groupReqs, setGroupReqs] = useState([]);
  const [lobbyReqs, setLobbyReqs] = useState([]);
  const [playerView, setPlayerView] = useState(null);
  const [chatGroupId, setChatGroupId] = useState(null);
  const [lobbyDetailId, setLobbyDetailId] = useState(null);
  const [groupDetailId, setGroupDetailId] = useState(null);
  const [myProfile, setMyProfile] = useState({...BLANK_PROFILE});
  const [editingProfile, setEditingProfile] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createLobbyOpen, setCreateLobbyOpen] = useState(false);
  const [myCar, setMyCar] = useState({...BLANK_CAR});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadData(session.user.id);
      else setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN') loadData(session.user.id);
      else if (event === 'SIGNED_OUT') { setMyProfile({...BLANK_PROFILE}); setAllUsers([]); setGroups([]); setLobbies([]); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async (userId) => {
    try {
      const [profileRes, usersRes, groupsRes, myCarRes, allCarsRes, friendsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*").neq("id", userId),
        supabase.from("groups").select("*, group_members(user_id, role, status)"),
        supabase.from("user_cars").select("*").eq("user_id", userId).eq("is_primary", true).maybeSingle(),
        supabase.from("user_cars").select("user_id,year,make,model").eq("is_primary", true),
        supabase.from("friends").select("user_id,friend_id").or(`user_id.eq.${userId},friend_id.eq.${userId}`).eq("status","accepted").catch(()=>({data:[]})),
      ]);

      if (profileRes.data) setMyProfile(profileFromRow(profileRes.data));

      // Build car map for enriching user profiles
      const carMap = {};
      if (allCarsRes.data) allCarsRes.data.forEach(c=>{ carMap[c.user_id]=c; });

      if (usersRes.data) setAllUsers(usersRes.data.map(row => {
        const p = profileFromRow(row);
        const c = carMap[row.id];
        if (c) { p.car = `${c.make} ${c.model}`; p.year = c.year?.toString()||""; }
        return p;
      }));

      // Load accepted friends
      if (friendsRes.data?.length) {
        const friendIds = friendsRes.data.map(f => f.user_id===userId ? f.friend_id : f.user_id);
        setFriends(friendIds);
      }

      if (groupsRes.data) {
        setGroups(groupsRes.data.map(g => ({
          id: g.id, name: g.name, desc: g.description||"",
          type: g.is_private?"private":"open", max: g.max_members,
          tags: g.tags||[],
          memberIds: (g.group_members||[]).filter(m=>m.status==="active").map(m=>m.user_id),
          admin: g.created_by, lastActive:"recently", messages:[],
          pendingRequests:[], lat:g.lat??null, lng:g.lng??null,
          theme: g.theme_color||"#e61a1a", bannerUrl: g.banner_url||"",
        })));
      }
      if (myCarRes.data) setMyCar(carFromRow(myCarRes.data));

      // Load lobbies (graceful fallback if table doesn't exist)
      try {
        const { data: lobbyData } = await supabase
          .from("lobbies")
          .select("*, lobby_members(user_id, status, mic_active)")
          .eq("is_active", true);
        if (lobbyData) {
          setLobbies(lobbyData.map(l => ({
            id: l.id, name: l.name, type: l.type||"Cruising",
            isOpen: l.is_open??true, groupId: l.group_id||null,
            destination: l.destination||null, createdBy: l.created_by,
            lat: l.lat??null, lng: l.lng??null,
            memberIds: (l.lobby_members||[]).filter(m=>m.status==="active").map(m=>m.user_id),
            pendingRequests: (l.lobby_members||[]).filter(m=>m.status==="pending").map(m=>m.user_id),
            micUsers: (l.lobby_members||[]).filter(m=>m.mic_active).map(m=>m.user_id),
            createdAt: l.created_at,
          })));
        }
      } catch (_) { /* lobbies table not yet created */ }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleCreateGroupDB = async (form) => {
    const myId = session?.user?.id;
    const { data: grp, error } = await supabase.from("groups").insert({
      name: form.name.trim(), description: form.desc.trim()||null,
      is_private: form.type==="private", max_members: parseInt(form.max)||50,
      tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      created_by: myId, theme_color: form.theme||"#e61a1a",
    }).select().single();
    if (error||!grp) { console.error("Create group error:", error); return; }
    const{error:memErr}=await supabase.from("group_members").insert({ group_id:grp.id, user_id:myId, role:"owner", status:"active" });
    if(memErr) console.error("group_members insert error:",memErr);
    setGroups(gs=>[...gs, {
      id:grp.id, name:grp.name, desc:grp.description||"",
      type:grp.is_private?"private":"open", max:grp.max_members,
      tags:grp.tags||[], memberIds:[myId], admin:myId,
      theme: form.theme||"#e61a1a", bannerUrl:"",
      lastActive:"just now", messages:[], pendingRequests:[],
    }]);
  };

  const handleCreateLobby = async (form) => {
    const myId = session?.user?.id;
    const lobbyData = {
      id: `local-${Date.now()}`, name: form.name.trim(),
      type: form.type, isOpen: form.isOpen, groupId: form.groupId||null,
      destination: form.destination||null, createdBy: myId,
      lat: myProfile.lat, lng: myProfile.lng,
      memberIds: [myId], pendingRequests: [], micUsers: [],
      createdAt: new Date().toISOString(),
    };
    // Try to persist to DB
    try {
      const { data: dbLobby } = await supabase.from("lobbies").insert({
        name: lobbyData.name, type: lobbyData.type, is_open: lobbyData.isOpen,
        group_id: lobbyData.groupId||null, destination: lobbyData.destination||null,
        created_by: myId, lat: myProfile.lat, lng: myProfile.lng, is_active: true,
      }).select().single();
      if (dbLobby) {
        await supabase.from("lobby_members").insert({ lobby_id:dbLobby.id, user_id:myId, status:"active" });
        lobbyData.id = dbLobby.id;
      }
    } catch (_) { /* table doesn't exist, use local state */ }
    setLobbies(ls=>[...ls, lobbyData]);
    setLobbyDetailId(lobbyData.id);
  };

  if (authLoading) {
    return (<><style>{CSS}</style><div className="app" style={{alignItems:"center",justifyContent:"center"}}><div style={{color:"var(--muted)",fontSize:13}}>Loading…</div></div></>);
  }

  if (!session) {
    if (!showAuth) return <LandingPage onSignUp={()=>{setAuthMode("signup");setShowAuth(true);}} onLogin={()=>{setAuthMode("login");setShowAuth(true);}}/>;
    return <AuthPage initialMode={authMode}/>;
  }

  // Paywall — show unless user has been granted access
  if (!myProfile.hasAccess && myProfile.id) {
    return (
      <PaywallScreen
        session={session}
        onAccessGranted={() => loadData(session.user.id)}
        onLogout={handleLogout}
      />
    );
  }

  const myId = session.user.id;
  const isFriend = id => friends.includes(id);
  const sentFR = id => friendReqs.includes(id);
  const addFR = async (id) => {
    if (sentFR(id)) return;
    setFriendReqs(r=>[...r,id]);
    const{error}=await supabase.from("friends").upsert({user_id:myId,friend_id:id,status:"accepted"},{onConflict:"user_id,friend_id"});
    if(error) console.error("addFR error:",error);
  };
  const isInGroup = gid => groups.find(g=>g.id===gid)?.memberIds.includes(myId);
  const sentGR = gid => groupReqs.includes(gid);
  const joinGroup = async (gid) => {
    if (groups.find(g=>g.id===gid)?.memberIds.includes(myId)) return;
    setGroups(gs=>gs.map(g=>g.id===gid?{...g,memberIds:[...g.memberIds,myId]}:g));
    const{error}=await supabase.from("group_members").upsert({group_id:gid,user_id:myId,role:"member",status:"active"},{onConflict:"group_id,user_id"});
    if(error) console.error("joinGroup error:",error);
  };
  const reqGroup = gid => { if (!sentGR(gid)) setGroupReqs(r=>[...r,gid]); };
  const isInLobby = lid => lobbies.find(l=>l.id===lid)?.memberIds.includes(myId);
  const sentLR = lid => lobbyReqs.includes(lid);
  const joinLobby = async (lid) => {
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,memberIds:[...l.memberIds,myId]}:l));
    const{error}=await supabase.from("lobby_members").upsert({lobby_id:lid,user_id:myId,status:"active"},{onConflict:"lobby_id,user_id"});
    if(error) console.error("joinLobby error:",error);
  };
  const reqLobby = async (lid) => {
    if (sentLR(lid)) return;
    setLobbyReqs(r=>[...r,lid]);
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,pendingRequests:[...(l.pendingRequests||[]),myId]}:l));
    const{error}=await supabase.from("lobby_members").upsert({lobby_id:lid,user_id:myId,status:"pending"},{onConflict:"lobby_id,user_id"});
    if(error) console.error("reqLobby error:",error);
  };
  const approveLobby = async (lid, uid) => {
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,memberIds:[...l.memberIds,uid],pendingRequests:l.pendingRequests.filter(r=>r!==uid)}:l));
    const{error}=await supabase.from("lobby_members").update({status:"active"}).eq("lobby_id",lid).eq("user_id",uid);
    if(error) console.error("approveLobby error:",error);
  };
  const denyLobby = async (lid, uid) => {
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,pendingRequests:l.pendingRequests.filter(r=>r!==uid)}:l));
    const{error}=await supabase.from("lobby_members").delete().eq("lobby_id",lid).eq("user_id",uid);
    if(error) console.error("denyLobby error:",error);
  };

  const pendingCount = groups.reduce((a,g)=>a+(g.pendingRequests?.length||0),0)
    + lobbies.reduce((a,l)=>a+(l.pendingRequests?.length||0),0);
  const showNav = !playerView && !chatGroupId && !lobbyDetailId && !groupDetailId && !editingProfile;

  const TABS = [
    {name:"Lobbies"}, {name:"Groups"}, {name:"Search"}, {name:"Map"}, {name:"Ranks"}, {name:"Profile"},
  ];
  const activeTab = showNav ? tab : null;
  const goTab = (name) => { setTab(name); setPlayerView(null); setChatGroupId(null); setLobbyDetailId(null); setGroupDetailId(null); setEditingProfile(false); };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Desktop sidebar */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <Logo sidebarVariant />
            <div className="sidebar-logo-sub" style={{marginTop:6}}>Powered by 0xotics</div>
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
                {(name==="Lobbies"||name==="Groups")&&pendingCount>0&&<span className="sidebar-notif">{pendingCount}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="btn btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={handleLogout}>Sign Out</button>
          </div>
        </aside>

        {/* Main area */}
        <div className="main-area">
          <Header myProfile={myProfile} onLogout={handleLogout} />
          <div className="content fade" key={tab+playerView+chatGroupId+lobbyDetailId+groupDetailId+editingProfile}>
            {editingProfile ? (
              <EditProfile myProfile={myProfile} setMyProfile={setMyProfile} myCar={myCar} setMyCar={setMyCar} userId={session.user.id} onBack={()=>setEditingProfile(false)}/>
            ) : playerView ? (
              <UserProfile userId={playerView} onBack={()=>setPlayerView(null)}
                isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                groups={groups} isInGroup={isInGroup} sentGR={sentGR}
                joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile}/>
            ) : chatGroupId ? (
              <ChatView groupId={chatGroupId} groups={groups}
                onBack={()=>setChatGroupId(null)} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers}/>
            ) : lobbyDetailId ? (
              <LobbyDetail lobbyId={lobbyDetailId} lobbies={lobbies} setLobbies={setLobbies}
                onBack={()=>setLobbyDetailId(null)} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers} myCar={myCar}
                isInLobby={isInLobby} sentLR={sentLR} joinLobby={joinLobby}
                reqLobby={reqLobby} approveLobby={approveLobby} denyLobby={denyLobby}/>
            ) : groupDetailId ? (
              <GroupDetail groupId={groupDetailId} groups={groups} setGroups={setGroups}
                onBack={()=>setGroupDetailId(null)} openPlayer={setPlayerView}
                openChat={setChatGroupId} myProfile={myProfile} allUsers={allUsers}
                isInGroup={isInGroup} onCreateLobby={(gid)=>{setGroupDetailId(null);setCreateLobbyOpen(true);}}
                lobbies={lobbies} onCreateLobbyForGroup={(g)=>{
                  setGroupDetailId(null);
                  setCreateLobbyOpen(true);
                }}/>
            ) : tab==="Lobbies" ? (
              <LobbiesView lobbies={lobbies} setLobbies={setLobbies} myProfile={myProfile}
                allUsers={allUsers} groups={groups} isInLobby={isInLobby} sentLR={sentLR}
                joinLobby={joinLobby} reqLobby={reqLobby}
                openLobby={setLobbyDetailId} onCreateLobby={()=>setCreateLobbyOpen(true)}
                pendingCount={pendingCount} approveLobby={approveLobby} denyLobby={denyLobby}/>
            ) : tab==="Groups" ? (
              <GroupsView groups={groups} setGroups={setGroups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup}
                openChat={setChatGroupId} pendingCount={pendingCount}
                allUsers={allUsers} myProfile={myProfile} onCreateGroup={()=>setCreateGroupOpen(true)}
                openGroupDetail={setGroupDetailId}/>
            ) : tab==="Map" ? (
              <MapView groups={groups} openPlayer={setPlayerView}
                myProfile={myProfile} setMyProfile={setMyProfile} allUsers={allUsers} lobbies={lobbies}/>
            ) : tab==="Search" ? (
              <SearchView isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                openPlayer={setPlayerView} groups={groups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile} lobbies={lobbies}
                openLobby={setLobbyDetailId}/>
            ) : tab==="Ranks" ? (
              <RanksView openPlayer={setPlayerView} myProfile={myProfile} allUsers={allUsers} myCar={myCar}/>
            ) : (
              <ProfileView myProfile={myProfile} friends={friends} groups={groups}
                openPlayer={setPlayerView} onEdit={()=>setEditingProfile(true)}
                onCreateGroup={()=>setCreateGroupOpen(true)}
                myCar={myCar} allUsers={allUsers}/>
            )}
            {createGroupOpen && <CreateGroupModal myProfile={myProfile} existingGroups={groups} onClose={()=>setCreateGroupOpen(false)} onCreateDB={handleCreateGroupDB}/>}
            {createLobbyOpen && <CreateLobbyModal myProfile={myProfile} groups={groups} onClose={()=>setCreateLobbyOpen(false)} onCreate={handleCreateLobby}/>}
          </div>

          {showNav && (
            <nav className="nav">
              {TABS.map(({name})=>(
                <button key={name} className={`ni ${tab===name?"on":""}`} onClick={()=>goTab(name)}>
                  <span className="ni-icon"><NavIcon name={name} size={22}/></span>
                  <span>{name}</span>
                  {tab===name && <div className="ni-dot"/>}
                  {(name==="Lobbies"||name==="Groups")&&pendingCount>0&&<span className="notif-dot"/>}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── HEADER ─────────────────────────────────────────────── */
function Header({ myProfile, onLogout }) {
  return (
    <div className="hdr">
      <div className="hdr-row">
        <Logo />
        <button className="btn btn-secondary btn-sm" onClick={onLogout} style={{fontSize:11,padding:"5px 10px"}}>Sign Out</button>
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

/* ─── LOBBIES VIEW ───────────────────────────────────────── */
function LobbiesView({ lobbies, setLobbies, myProfile, allUsers, groups, isInLobby, sentLR, joinLobby, reqLobby, openLobby, onCreateLobby, pendingCount, approveLobby, denyLobby }) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [showPending, setShowPending] = useState(false);
  const [memberCars, setMemberCars] = useState({});

  useEffect(() => {
    const ids = [...new Set(lobbies.flatMap(l=>l.memberIds))];
    if (!ids.length) return;
    supabase.from("user_cars").select("user_id,year,make,model").in("user_id",ids).eq("is_primary",true)
      .then(({data})=>{
        if (!data) return;
        const m = {};
        data.forEach(c=>{ m[c.user_id]=`${c.year} ${c.make} ${c.model}`; });
        setMemberCars(m);
      });
  }, [lobbies]);

  const myPendingLobbies = lobbies.filter(l=>
    l.pendingRequests?.length>0 && l.createdBy===myProfile.id
  );

  const sorted = useMemo(() => {
    return [...lobbies]
      .filter(l => typeFilter==="All" || l.type===typeFilter)
      .sort((a,b) => {
        const da = haversine(myProfile.lat, myProfile.lng, a.lat, a.lng);
        const db = haversine(myProfile.lat, myProfile.lng, b.lat, b.lng);
        return da - db;
      });
  }, [lobbies, typeFilter, myProfile.lat, myProfile.lng]);

  const fmtDist = (l) => {
    const d = haversine(myProfile.lat, myProfile.lng, l.lat, l.lng);
    if (d === Infinity) return null;
    return d < 1 ? `${Math.round(d*5280)} ft` : `${d.toFixed(1)} mi`;
  };

  const fmtArea = (lat, lng) => {
    if (!lat||!lng) return null;
    const f = fuzzyCoords(lat, lng);
    return `~${Math.abs(f.lat).toFixed(2)}°N, ${Math.abs(f.lng).toFixed(2)}°W`;
  };

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Lobbies</div>
          <div className="pg-sub">{lobbies.length} active near you</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4}} onClick={onCreateLobby}>
          + Go Live
        </button>
      </div>

      {/* Pending join requests */}
      {myPendingLobbies.length>0 && (
        <div className="card" style={{borderColor:"rgba(230,26,26,.4)",cursor:"pointer",marginBottom:12}} onClick={()=>setShowPending(!showPending)}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:14,fontWeight:600}}>
              Lobby Requests
              <span style={{background:"rgba(230,26,26,.15)",color:"var(--accent)",fontSize:11,padding:"2px 7px",borderRadius:10,marginLeft:6}}>
                {myPendingLobbies.reduce((a,l)=>a+l.pendingRequests.length,0)}
              </span>
            </div>
            <span style={{color:"var(--muted)",fontSize:12}}>{showPending?"▲":"▼"}</span>
          </div>
          {showPending && myPendingLobbies.map(l=>(
            <div key={l.id} style={{marginTop:12}}>
              <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,fontWeight:600,textTransform:"uppercase",marginBottom:8}}>{l.name}</div>
              {l.pendingRequests.map(uid=>{
                const u = getU(uid, allUsers, myProfile);
                return u ? (
                  <div key={uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div className="av s32">{u.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>@{u.username}</div>
                      {u.city&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {u.city}</div>}
                    </div>
                    <button className="btn btn-green btn-sm" onClick={e=>{e.stopPropagation();approveLobby(l.id,uid);}}>Accept</button>
                    <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();denyLobby(l.id,uid);}}>Deny</button>
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}

      {/* Type filter */}
      <div className="pills">
        <button className={`pill ${typeFilter==="All"?"on":""}`} onClick={()=>setTypeFilter("All")}>All</button>
        {LOBBY_TYPES.map(t=>(
          <button key={t} className={`pill ${typeFilter===t?"on":""}`} onClick={()=>setTypeFilter(t)}>{t}</button>
        ))}
      </div>

      {sorted.length===0 && (
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>No active lobbies right now.<br/>Be the first to go live.</div>
          <button className="btn btn-primary btn-sm" onClick={onCreateLobby}>+ Create Lobby</button>
        </div>
      )}

      {sorted.map(l => {
        const inLobby = isInLobby(l.id);
        const pending = sentLR(l.id);
        const cars = l.memberIds.map(id=>memberCars[id]).filter(Boolean);
        const dist = fmtDist(l);
        const area = fmtArea(l.lat, l.lng);
        const group = l.groupId ? groups.find(g=>g.id===l.groupId) : null;
        const micCount = l.micUsers?.length || 0;

        return (
          <div key={l.id} className="card click" onClick={()=>openLobby(l.id)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span className="live-dot"/>
                <span className="lobby-type-pill">{l.type}</span>
                {!l.isOpen && <span style={{fontSize:9,color:"var(--muted2)",letterSpacing:.5}}>🔒 REQUEST</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {dist && <span className="dist-pill">{dist}</span>}
              </div>
            </div>

            <div className="gc-name" style={{marginTop:6}}>{l.name}</div>
            {group && <div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>via {group.name}</div>}

            {cars.length>0 && (
              <div className="lobby-cars">
                {cars.slice(0,4).map((c,i)=><span key={i} className="lobby-car-chip">{c}</span>)}
                {cars.length>4 && <span className="lobby-car-chip">+{cars.length-4}</span>}
              </div>
            )}

            <div className="lobby-meta">
              <span className="lobby-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {l.memberIds.length} users
              </span>
              {micCount>0 ? (
                <span className="lobby-meta-item mic-on">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  {micCount} on mic
                </span>
              ) : (
                <span className="lobby-meta-item mic-off">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  No mic
                </span>
              )}
              {area && <span className="lobby-meta-item">📍 {area}</span>}
              {l.destination && <span className="lobby-meta-item">→ {l.destination}</span>}
            </div>

            <div className="gc-actions">
              {inLobby && <button className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ In Lobby</button>}
              {!inLobby && !pending && (
                <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation(); l.isOpen?joinLobby(l.id):reqLobby(l.id);}}>
                  {l.isOpen?"Join Lobby":"Request to Join"}
                </button>
              )}
              {!inLobby && pending && <button className="btn btn-secondary btn-sm" disabled>Pending…</button>}
              <button className="btn btn-secondary btn-sm" style={{marginLeft:"auto"}} onClick={e=>{e.stopPropagation();openLobby(l.id);}}>View →</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── LOBBY DETAIL ───────────────────────────────────────── */
function LobbyDetail({ lobbyId, lobbies, setLobbies, onBack, openPlayer, myProfile, allUsers, myCar, isInLobby, sentLR, joinLobby, reqLobby, approveLobby, denyLobby }) {
  const l = lobbies.find(x=>x.id===lobbyId);
  const [memberCars, setMemberCars] = useState({});
  const [memberSpeeds, setMemberSpeeds] = useState({});
  const [mySpeed, setMySpeed] = useState(null);
  const [followMe, setFollowMe] = useState(false);
  const watchIdRef = useRef(null);
  const speedChannelRef = useRef(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(()=>{
    if (!l?.memberIds?.length) return;
    supabase.from("user_cars").select("user_id,year,make,model,trim,photos,build_stage")
      .in("user_id",l.memberIds).eq("is_primary",true)
      .then(({data})=>{
        if (!data) return;
        const m = {};
        data.forEach(c=>{ m[c.user_id]={str:`${c.year} ${c.make} ${c.model}${c.trim?" "+c.trim:""}`,buildStage:c.build_stage||"stock",photo:c.photos?.[0]||null}; });
        setMemberCars(m);
      });
  }, [lobbyId, l?.memberIds?.length]);

  // Init lobby map if user is a member
  const inLobby = isInLobby(lobbyId);
  useEffect(()=>{
    if (!inLobby||!mapContainer.current||mapRef.current||!l) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [l.lng||(-122.67), l.lat||45.52],
      zoom: 13,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");
    return ()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  }, [inLobby, lobbyId]);

  // Live GPS + speed broadcast while in lobby
  useEffect(()=>{
    if (!inLobby||!myProfile?.id) return;
    const channelName = `lobby-speed-${lobbyId}`;
    const ch = supabase.channel(channelName,{config:{broadcast:{self:false}}});
    speedChannelRef.current = ch;
    ch.on("broadcast",{event:"speed"},(payload)=>{
      if (payload.payload?.userId && payload.payload.userId!==myProfile.id) {
        setMemberSpeeds(prev=>({...prev,[payload.payload.userId]:payload.payload.mph}));
      }
    }).subscribe();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos)=>{
        const rawMph = pos.coords.speed!=null ? Math.round(pos.coords.speed*2.237) : 0;
        const mph = Math.max(0, rawMph);
        setMySpeed(mph);
        setMemberSpeeds(prev=>({...prev,[myProfile.id]:mph}));
        ch.send({type:"broadcast",event:"speed",payload:{userId:myProfile.id,mph}});
      },
      ()=>{},
      {enableHighAccuracy:true,maximumAge:1000,timeout:10000}
    );

    return ()=>{
      if (watchIdRef.current!=null) navigator.geolocation.clearWatch(watchIdRef.current);
      supabase.removeChannel(ch);
      speedChannelRef.current = null;
    };
  }, [inLobby, lobbyId, myProfile?.id]);

  if (!l) return null;
  const members = l.memberIds.map(id=>getU(id,allUsers,myProfile)).filter(Boolean);
  const pending = l.pendingRequests?.map(id=>getU(id,allUsers,myProfile)).filter(Boolean)||[];
  const isMyLobby = l.createdBy===myProfile.id;

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Lobbies</button>

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span className="live-dot"/>
          <span className="lobby-type-pill">{l.type}</span>
          {!l.isOpen && <span style={{fontSize:9,color:"var(--muted2)"}}>🔒 REQUEST ONLY</span>}
        </div>
        <div className="pg-title">{l.name}</div>
        {l.destination && <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>→ Destination: {l.destination}</div>}
      </div>

      {/* Join controls */}
      {!inLobby && (
        <div style={{padding:"0 16px 14px"}}>
          {!sentLR(lobbyId) ? (
            <button className="btn btn-primary btn-full" style={{borderRadius:10}} onClick={()=>l.isOpen?joinLobby(lobbyId):reqLobby(lobbyId)}>
              {l.isOpen?"Join Lobby":"Request to Join"}
            </button>
          ) : (
            <button className="btn btn-secondary btn-full" disabled style={{borderRadius:10}}>Request Sent — Awaiting Approval</button>
          )}
        </div>
      )}

      {/* MPH + Follow Me (only for members) */}
      {inLobby && (
        <>
          <div className="mph-bar">
            <div className="mph-label">Your Speed</div>
            <div className="mph-row">
              <div>
                <span className="mph-num">{mySpeed!=null?mySpeed:"—"}</span>
                <div className="mph-unit">MPH</div>
              </div>
              <button
                className={`follow-me-btn${followMe?" active":""}`}
                style={{width:"auto",padding:"8px 18px"}}
                onClick={()=>setFollowMe(f=>!f)}
              >
                {followMe?"🟢 Following — No Destination":"📍 Just Follow Me"}
              </button>
            </div>
            {followMe&&<div style={{fontSize:11,color:"var(--green)",marginTop:6,opacity:.8}}>Broadcasting live — no destination set</div>}
          </div>

          <div className="sec-lbl">Live Speeds</div>
          <div className="card" style={{marginBottom:8}}>
            {[...members].sort((a,b)=>(memberSpeeds[b.id]??-1)-(memberSpeeds[a.id]??-1)).map((m,i)=>(
              <div key={m.id} className="mph-member">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--muted2)",width:16,textAlign:"right"}}>{i+1}</span>
                  <div className={`av s28 ${m.id===myProfile.id?"me":""}`}>{m.avatar}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600}}>@{m.username}</div>
                    {memberCars[m.id]&&<div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{memberCars[m.id].str}</div>}
                  </div>
                </div>
                <span className="mph-member-speed">{memberSpeeds[m.id]!=null?`${memberSpeeds[m.id]} mph`:"—"}</span>
              </div>
            ))}
          </div>

          <div className="sec-lbl">Live Map</div>
          <div className="map-wrap" style={{height:220}}>
            <div ref={mapContainer} style={{width:"100%",height:"100%"}}/>
          </div>
        </>
      )}

      {/* Pending requests (for lobby creator) */}
      {isMyLobby && pending.length>0 && (
        <>
          <div className="sec-lbl">Join Requests ({pending.length})</div>
          <div className="card" style={{marginBottom:8}}>
            {pending.map(u=>(
              <div key={u.id} className="lobby-user-row">
                <div className="av s32" style={{cursor:"pointer"}} onClick={()=>openPlayer(u.id)}>{u.avatar}</div>
                <div style={{flex:1,cursor:"pointer"}} onClick={()=>openPlayer(u.id)}>
                  <div style={{fontSize:13,fontWeight:600}}>@{u.username}</div>
                  {u.city&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {u.city}</div>}
                </div>
                <button className="btn btn-green btn-sm" onClick={()=>approveLobby(lobbyId,u.id)}>Accept</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>denyLobby(lobbyId,u.id)}>Deny</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Members */}
      <div className="sec-lbl">Users ({members.length})</div>
      <div className="list-card" style={{margin:"0 16px 14px"}}>
        {members.map(m=>{
          const car = memberCars[m.id];
          const isMicOn = l.micUsers?.includes(m.id);
          const isMe = m.id===myProfile.id;
          return (
            <div key={m.id} className="list-item" onClick={()=>!isMe&&openPlayer(m.id)}>
              <div className={`av s32 ${isMe?"me":""}`}>{m.avatar}</div>
              <div className="list-item-info">
                <div className="list-item-title">
                  @{m.username}
                  {isMe&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}
                  {m.id===l.createdBy&&<span style={{fontSize:9,color:"var(--muted2)",marginLeft:4,background:"var(--s3)",padding:"1px 5px",borderRadius:3,border:"1px solid var(--border)"}}>HOST</span>}
                </div>
                {car&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10,display:"flex",alignItems:"center",gap:5}}>
                  {car.str}
                  {car.buildStage&&car.buildStage!=="stock"&&<BuildBadge stage={car.buildStage}/>}
                </div>}
                {/* Show precise location only if in same lobby */}
                {inLobby && m.lat && (
                  <div style={{fontSize:10,color:"var(--green)",marginTop:2,fontFamily:"var(--font-mono)"}}>
                    📍 {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                    {memberSpeeds[m.id]!=null&&<span style={{marginLeft:8,color:"var(--accent)"}}>{memberSpeeds[m.id]} mph</span>}
                  </div>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {isMicOn
                  ? <span className="mic-on" title="On mic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg></span>
                  : <span className="mic-off"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg></span>
                }
                <TierBadge wins={tw(m.wins)}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── GROUPS VIEW ────────────────────────────────────────── */
function GroupsView({ groups, setGroups, isInGroup, sentGR, joinGroup, reqGroup, openChat, pendingCount, allUsers, myProfile, onCreateGroup, openGroupDetail }) {
  const [showPending, setShowPending] = useState(false);
  const [q, setQ] = useState("");

  const approve = (gid,uid) => setGroups(gs=>gs.map(g=>g.id===gid?{...g,memberIds:[...g.memberIds,uid],pendingRequests:g.pendingRequests.filter(r=>r!==uid)}:g));
  const deny    = (gid,uid) => setGroups(gs=>gs.map(g=>g.id===gid?{...g,pendingRequests:g.pendingRequests.filter(r=>r!==uid)}:g));

  const filtered = groups.filter(g=>!q||g.name.toLowerCase().includes(q.toLowerCase())||g.tags.some(t=>t.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Groups</div>
          <div className="pg-sub">Active communities</div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{marginTop:4}} onClick={onCreateGroup}>+ Create</button>
      </div>

      <div className="srch-wrap">
        <span className="srch-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
        <input className="srch-inp" placeholder="Search groups…" value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<button className="srch-x" onClick={()=>setQ("")}>×</button>}
      </div>

      {pendingCount>0&&(
        <div className="card" style={{borderColor:"rgba(230,26,26,.4)",cursor:"pointer",marginBottom:12}} onClick={()=>setShowPending(!showPending)}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:14,fontWeight:600}}>Join Requests <span style={{background:"rgba(230,26,26,.15)",color:"var(--accent)",fontSize:11,padding:"2px 7px",borderRadius:10,marginLeft:4}}>{pendingCount}</span></div>
            <span style={{color:"var(--muted)",fontSize:12}}>{showPending?"▲":"▼"}</span>
          </div>
          {showPending&&groups.filter(g=>g.pendingRequests?.length>0).map(g=>(
            <div key={g.id} style={{marginTop:12}}>
              <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,fontWeight:600,textTransform:"uppercase",marginBottom:8}}>{g.name}</div>
              {g.pendingRequests.map(uid=>{
                const u = getU(uid,allUsers,myProfile);
                return u?(
                  <div key={uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div className="av s32">{u.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>@{u.username}</div>
                      {u.city&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {u.city}</div>}
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

      {filtered.length===0&&<div className="empty">No groups yet.</div>}

      {filtered.map(g=>(
        <div key={g.id} className="card" style={{cursor:"pointer",borderLeft:`3px solid ${g.theme||"#e61a1a"}`}} onClick={()=>openGroupDetail(g.id)}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Public"}</span>
              {isInGroup(g.id)&&<span style={{fontSize:10,color:"var(--accent)",fontWeight:600,letterSpacing:.5}}>MEMBER</span>}
            </div>
            <span className="gc-user-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {g.memberIds.length}/{g.max} users
            </span>
          </div>
          <div className="gc-name">{g.name}</div>
          {g.desc&&<div className="gc-desc">{g.desc}</div>}
          {g.tags?.length>0&&<div className="tags">{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
          <div className="gc-actions" onClick={e=>e.stopPropagation()}>
            {isInGroup(g.id)&&<button className="btn btn-secondary btn-sm" onClick={()=>openChat(g.id)}>Chat →</button>}
            {!isInGroup(g.id)&&!sentGR(g.id)&&(
              <button className="btn btn-primary btn-sm" onClick={()=>{
                if (g.type==="open") joinGroup(g.id);
                else { setGroups(gs=>gs.map(x=>x.id===g.id?{...x,pendingRequests:[...(x.pendingRequests||[]),myProfile.id]}:x)); reqGroup(g.id); }
              }}>{g.type==="open"?"Join Group":"Request to Join"}</button>
            )}
            {!isInGroup(g.id)&&sentGR(g.id)&&<button className="btn btn-secondary btn-sm" disabled>Pending…</button>}
            <span className="gc-last-active">{g.lastActive}</span>
            <button className="btn btn-secondary btn-sm" style={{marginLeft:"auto"}} onClick={()=>openGroupDetail(g.id)}>View →</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── SEARCH VIEW ────────────────────────────────────────── */
function SearchView({ isFriend, sentFR, addFR, openPlayer, groups, isInGroup, sentGR, joinGroup, reqGroup, allUsers, myProfile, lobbies, openLobby }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("Users");

  const MODES = ["Users","Groups","Lobbies","Cars"];

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

  const filteredLobbies = (lobbies||[]).filter(l=>!q||
    l.name.toLowerCase().includes(q.toLowerCase())||
    l.type.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Search</div>
        <div className="pg-sub">Users · Groups · Lobbies · Cars</div>
      </div>

      <div className="srch-wrap">
        <span className="srch-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
        <input className="srch-inp"
          placeholder={mode==="Users"?"Search username, city…":mode==="Groups"?"Search groups…":mode==="Lobbies"?"Search lobbies…":"Search by car make/model…"}
          value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<button className="srch-x" onClick={()=>setQ("")}>×</button>}
      </div>

      <div className="pills">
        {MODES.map(m=><button key={m} className={`pill ${mode===m?"on":""}`} onClick={()=>setMode(m)}>{m}</button>)}
      </div>

      {mode==="Users"&&(
        users.length===0
          ? <div className="empty">{allUsers.length===0?"No other users yet.":"No users found"}</div>
          : users.map(p=>{
            const rank = computeRanks(allUsers,myProfile).find(r=>r.id===p.id)?.rank??99;
            return (
              <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
                <div className="av s40">{p.avatar}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="user-username">@{p.username}</div>
                  {p.showRealName&&<div className="user-name">{p.displayName}</div>}
                  {p.car&&<div className="user-car">{p.year} {p.car}</div>}
                  {p.city&&<div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>📍 {p.city}</div>}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <TierBadge wins={tw(p.wins)}/>
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
                <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Public"}</span>
                <span style={{fontSize:11,color:"var(--muted)"}}>{g.memberIds.length}/{g.max} users</span>
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

      {mode==="Lobbies"&&(
        filteredLobbies.length===0
          ? <div className="empty">No active lobbies found.</div>
          : filteredLobbies.map(l=>(
            <div key={l.id} className="card click" onClick={()=>openLobby&&openLobby(l.id)}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span className="live-dot"/>
                <span className="lobby-type-pill">{l.type}</span>
              </div>
              <div className="gc-name" style={{marginTop:4}}>{l.name}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{l.memberIds.length} users · {l.isOpen?"Open":"Request Only"}</div>
            </div>
          ))
      )}

      {mode==="Cars"&&(
        users.filter(p=>p.car&&p.car.toLowerCase().includes((q||"").toLowerCase())).length===0
          ? <div className="empty">Search for a car make or model above.</div>
          : users.filter(p=>p.car&&(!q||p.car.toLowerCase().includes(q.toLowerCase()))).map(p=>(
            <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
              <div className="av s40">{p.avatar}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{p.year} {p.car}</div>
                <div className="user-username">@{p.username}</div>
                {p.city&&<div style={{fontSize:10,color:"var(--muted2)"}}>📍 {p.city}</div>}
              </div>
              <TierBadge wins={tw(p.wins)}/>
            </div>
          ))
      )}
    </div>
  );
}

/* ─── USER PROFILE ───────────────────────────────────────── */
function UserProfile({ userId, onBack, isFriend, sentFR, addFR, groups, isInGroup, sentGR, joinGroup, reqGroup, allUsers, myProfile }) {
  const p = getU(userId, allUsers, myProfile);
  const [userCar, setUserCar] = useState(null);

  useEffect(()=>{
    supabase.from("user_cars").select("*").eq("user_id",userId).eq("is_primary",true).maybeSingle()
      .then(({data})=>{ if(data) setUserCar(carFromRow(data)); });
  }, [userId]);

  if (!p) return null;
  const isMe = userId===myProfile.id;
  const totalW = tw(p.wins);
  const userGroups = groups.filter(g=>g.memberIds.includes(userId));
  const hasTimes = p.times&&Object.values(p.times).some(v=>v);
  const ig = p.instagram||p.socials?.instagram||"";
  const hasCar = userCar&&userCar.make&&userCar.model;
  const fuzzy = p.lat ? fuzzyCoords(p.lat, p.lng) : null;

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div style={{padding:"0 16px 14px"}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
          <div className={`av s56 ${isMe?"me":""}`}>{p.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--accent)",fontWeight:600,marginBottom:2}}>@{p.username}</div>
            {p.showRealName&&<div style={{fontSize:21,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{p.displayName}</div>}
            {/* Show general vicinity only, not precise */}
            {fuzzy&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📍 ~{Math.abs(fuzzy.lat).toFixed(2)}°N · General area</div>}
            {!fuzzy&&p.city&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📍 {p.city}</div>}
            {ig&&(
              <a href={`https://instagram.com/${ig.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,fontSize:12,color:"var(--accent)",textDecoration:"none",fontWeight:500}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                @{ig.replace("@","")}
              </a>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW}/>
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

      {/* Car showcase */}
      {(hasCar||userCar===null)&&(
        <>
          <div className="sec-lbl">
            {hasCar?`${userCar.year} ${userCar.make} ${userCar.model}`:"Car"}
            {hasCar&&userCar.buildStage&&<span style={{marginLeft:8}}><BuildBadge stage={userCar.buildStage}/></span>}
          </div>
          <div className="car-showcase">
            <div className="car-photo-wrap" style={{cursor:"default"}}>
              {userCar?.photoUrl
                ? <img src={userCar.photoUrl} alt="car"/>
                : <div className="car-photo-empty" style={{cursor:"default"}}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
                    <span className="car-photo-label" style={{color:"var(--muted2)"}}>No photo</span>
                  </div>
              }
            </div>
            {hasCar&&(
              <div className="car-info-block">
                <div className="car-year-badge">{userCar.year||"—"}</div>
                <div className="car-make-model">{userCar.make} {userCar.model}</div>
                {userCar.trim&&<div className="car-trim">{userCar.trim}</div>}
                {userCar.buildStage&&userCar.buildStage!=="stock"&&<div style={{marginTop:8}}><BuildBadge stage={userCar.buildStage}/></div>}
                {userCar.mods&&(
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

/* ─── GROUP DETAIL ───────────────────────────────────────── */
function GroupDetail({ groupId, groups, setGroups, onBack, openPlayer, openChat, myProfile, allUsers, isInGroup, lobbies, onCreateLobbyForGroup }) {
  const g = groups.find(x=>x.id===groupId);
  const [subTab, setSubTab] = useState("Posts");
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventForm, setEventForm] = useState({title:"",date:"",location:"",isPublic:true});
  const [memberCars, setMemberCars] = useState({});
  const bannerRef = useRef(null);
  const [bannerPreview, setBannerPreview] = useState(g?.bannerUrl||"");

  useEffect(()=>{
    if (!g?.memberIds?.length) return;
    supabase.from("user_cars").select("user_id,year,make,model").in("user_id",g.memberIds).eq("is_primary",true)
      .then(({data})=>{if(!data)return;const m={};data.forEach(c=>{m[c.user_id]=`${c.year} ${c.make} ${c.model}`;});setMemberCars(m);});
    // Load posts
    supabase.from("group_posts").select("*,profiles(username,avatar_initials)").eq("group_id",groupId).order("created_at",{ascending:false}).limit(50)
      .then(({data})=>{ if(data) setPosts(data); }).catch(()=>{});
    // Load events
    supabase.from("group_events").select("*").eq("group_id",groupId).order("event_date",{ascending:true})
      .then(({data})=>{ if(data) setEvents(data); }).catch(()=>{});
  },[groupId]);

  if (!g) return null;
  const inGroup = isInGroup(groupId);
  const isAdmin = g.admin===myProfile.id;
  const theme = g.theme||"#e61a1a";
  const members = g.memberIds.map(id=>getU(id,allUsers,myProfile)).filter(Boolean);
  const activeLobbies = lobbies.filter(l=>l.groupId===groupId);

  const handleBannerSelect = async(e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const preview=URL.createObjectURL(file); setBannerPreview(preview);
    const compressed=await compressImage(file,1800);
    const path=`groups/${groupId}/${Date.now()}.jpg`;
    const{error:upErr}=await supabase.storage.from("car-photos").upload(path,compressed,{upsert:true,contentType:"image/jpeg"});
    if(upErr){console.error("Banner upload failed",upErr);return;}
    const{data:{publicUrl}}=supabase.storage.from("car-photos").getPublicUrl(path);
    const{error:dbErr}=await supabase.from("groups").update({banner_url:publicUrl}).eq("id",groupId);
    if(dbErr) console.error("Group banner update error:",dbErr);
    setGroups(gs=>gs.map(x=>x.id===groupId?{...x,bannerUrl:publicUrl}:x));
  };

  const submitPost = async() => {
    if (!newPost.trim()) return;
    const post={id:`local-${Date.now()}`,group_id:groupId,user_id:myProfile.id,content:newPost.trim(),created_at:new Date().toISOString(),profiles:{username:myProfile.username,avatar_initials:myProfile.avatar}};
    setPosts(p=>[post,...p]); setNewPost("");
    const{error:postErr}=await supabase.from("group_posts").insert({group_id:groupId,user_id:myProfile.id,content:post.content});
    if(postErr) console.error("submitPost error:",postErr);
  };

  const submitEvent = async() => {
    if (!eventForm.title.trim()||!eventForm.date) return;
    const ev={id:`local-${Date.now()}`,group_id:groupId,title:eventForm.title,event_date:eventForm.date,location:eventForm.location,is_public:eventForm.isPublic,created_at:new Date().toISOString()};
    setEvents(e=>[...e,ev]); setShowNewEvent(false); setEventForm({title:"",date:"",location:"",isPublic:true});
    const{error:evErr}=await supabase.from("group_events").insert({group_id:groupId,title:ev.title,event_date:ev.event_date,location:ev.location,is_public:ev.is_public});
    if(evErr) console.error("submitEvent error:",evErr);
  };

  const fmt=(ts)=>{if(!ts)return"";const d=new Date(ts),now=new Date(),diff=now-d;if(diff<60000)return"just now";if(diff<3600000)return`${Math.floor(diff/60000)}m ago`;if(diff<86400000)return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return d.toLocaleDateString([],{month:"short",day:"numeric"});};
  const fmtDate=(ds)=>{if(!ds)return{day:"?",mon:"?"};const d=new Date(ds);return{day:d.getDate(),mon:d.toLocaleString("default",{month:"short"}).toUpperCase()};};

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Groups</button>

      {/* Banner */}
      <div style={{margin:"0 16px 0",borderRadius:"var(--radius-lg) var(--radius-lg) 0 0",overflow:"hidden",border:"1px solid var(--border)",borderBottom:"none"}}>
        <input ref={bannerRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBannerSelect}/>
        {bannerPreview
          ? <img src={bannerPreview} className="group-banner" alt="banner" onClick={()=>isAdmin&&bannerRef.current?.click()} style={{cursor:isAdmin?"pointer":"default"}}/>
          : <div className="group-banner-empty" style={{borderRadius:"var(--radius-lg) var(--radius-lg) 0 0"}} onClick={()=>isAdmin&&bannerRef.current?.click()}>
              {isAdmin ? <>📷 Add group banner</> : <>&nbsp;</>}
            </div>
        }
      </div>

      {/* Group header */}
      <div style={{margin:"0 16px",background:"var(--s2)",borderRadius:"0 0 var(--radius-lg) var(--radius-lg)",border:"1px solid var(--border)",borderTop:"none",padding:"14px 16px 12px",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-display)",letterSpacing:.5,borderLeft:`3px solid ${theme}`,paddingLeft:10}}>
              {g.name}
            </div>
            {g.desc&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4,paddingLeft:10}}>{g.desc}</div>}
          </div>
          <span className={`gc-type-pill ${g.type}`}>{g.type==="private"?"Private":"Public"}</span>
        </div>
        {g.tags?.length>0&&<div className="tags" style={{marginBottom:8,paddingLeft:10}}>{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
        <div style={{display:"flex",gap:8,paddingLeft:10}}>
          {inGroup&&<button className="btn btn-secondary btn-sm" onClick={()=>openChat(groupId)}>💬 Chat</button>}
          {inGroup&&isAdmin&&<button className="btn btn-primary btn-sm" style={{background:theme,borderColor:theme}} onClick={onCreateLobbyForGroup}>📡 Start Lobby</button>}
          {!inGroup&&<button className="btn btn-primary btn-sm" style={{background:theme}}>Join Group</button>}
        </div>
      </div>

      {/* Active lobbies for this group */}
      {activeLobbies.length>0&&(
        <div style={{margin:"0 16px 8px",padding:"10px 12px",background:"rgba(230,26,26,.06)",border:"1px solid rgba(230,26,26,.2)",borderRadius:"var(--radius-md)",display:"flex",alignItems:"center",gap:8}}>
          <span className="live-dot"/>
          <span style={{fontSize:12,fontWeight:600,color:theme}}>{activeLobbies.length} active {activeLobbies.length===1?"lobby":"lobbies"} running</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="pills" style={{marginBottom:8}}>
        {["Posts","Events","Members"].map(t=>(
          <button key={t} className={`pill ${subTab===t?"on":""}`}
            style={subTab===t?{background:theme,borderColor:theme}:{}}
            onClick={()=>setSubTab(t)}>{t}</button>
        ))}
      </div>

      {/* POSTS */}
      {subTab==="Posts"&&(<>
        {inGroup&&(
          <div style={{margin:"0 16px 10px",display:"flex",gap:8}}>
            <div className="av s32 me">{myProfile.avatar}</div>
            <div style={{flex:1,display:"flex",gap:6}}>
              <input className="inp" placeholder="Post something to the group…" value={newPost} onChange={e=>setNewPost(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&submitPost()} style={{flex:1}}/>
              <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={submitPost}>Post</button>
            </div>
          </div>
        )}
        {posts.length===0&&<div className="empty">No posts yet. Be the first to post.</div>}
        {posts.map(p=>(
          <div key={p.id} className="post-card">
            <div className="post-author">
              <div className="av s28">{p.profiles?.avatar_initials||"?"}</div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:theme}}>@{p.profiles?.username||"?"}</div>
                <div style={{fontSize:10,color:"var(--muted2)"}}>{fmt(p.created_at)}</div>
              </div>
            </div>
            <div className="post-text">{p.content}</div>
          </div>
        ))}
      </>)}

      {/* EVENTS */}
      {subTab==="Events"&&(<>
        {isAdmin&&!showNewEvent&&(
          <div style={{padding:"0 16px 10px"}}>
            <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={()=>setShowNewEvent(true)}>+ Create Event</button>
          </div>
        )}
        {showNewEvent&&(
          <div className="card" style={{marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>New Event</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <input className="inp" placeholder="Event title" value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/>
              <input className="inp" type="datetime-local" value={eventForm.date} onChange={e=>setEventForm({...eventForm,date:e.target.value})}/>
              <input className="inp" placeholder="Location (optional)" value={eventForm.location} onChange={e=>setEventForm({...eventForm,location:e.target.value})}/>
              <div className="seg">
                <button className={`seg-opt ${eventForm.isPublic?"on":""}`} onClick={()=>setEventForm({...eventForm,isPublic:true})}>Public</button>
                <button className={`seg-opt ${!eventForm.isPublic?"on":""}`} onClick={()=>setEventForm({...eventForm,isPublic:false})}>Private</button>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={submitEvent}>Create</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setShowNewEvent(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {events.length===0&&<div className="empty">No events scheduled.</div>}
        {events.map(ev=>{
          const{day,mon}=fmtDate(ev.event_date);
          return (
            <div key={ev.id} className="event-card">
              <div className="event-date" style={{background:`${theme}18`,borderColor:`${theme}44`}}>
                <div className="event-date-day" style={{color:theme}}>{day}</div>
                <div className="event-date-mon">{mon}</div>
              </div>
              <div className="event-info">
                <div className="event-title">{ev.title}</div>
                {ev.location&&<div className="event-sub">📍 {ev.location}</div>}
              </div>
              <span className="event-priv" style={{background:ev.is_public?"rgba(0,192,96,.1)":"rgba(230,26,26,.1)",color:ev.is_public?"var(--green)":theme,border:`1px solid ${ev.is_public?"rgba(0,192,96,.2)":theme+"44"}`}}>
                {ev.is_public?"Public":"Private"}
              </span>
            </div>
          );
        })}
      </>)}

      {/* MEMBERS */}
      {subTab==="Members"&&(
        <div className="list-card" style={{margin:"0 16px 14px"}}>
          {members.map(m=>(
            <div key={m.id} className="list-item" onClick={()=>m.id!==myProfile.id&&openPlayer(m.id)}>
              <div className={`av s32 ${m.id===myProfile.id?"me":""}`}>{m.avatar}</div>
              <div className="list-item-info">
                <div className="list-item-title">@{m.username}{m.id===myProfile.id&&<span style={{fontSize:10,color:theme,marginLeft:6}}>YOU</span>}{m.id===g.admin&&<span style={{fontSize:9,color:"var(--muted2)",marginLeft:4,background:"var(--s3)",padding:"1px 5px",borderRadius:3}}>ADMIN</span>}</div>
                {memberCars[m.id]&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{memberCars[m.id]}</div>}
              </div>
              <TierBadge wins={tw(m.wins)}/>
            </div>
          ))}
        </div>
      )}
      <div style={{height:20}}/>
    </div>
  );
}

/* ─── CHAT VIEW ──────────────────────────────────────────── */
function ChatView({ groupId, groups, onBack, openPlayer, myProfile, allUsers }) {
  const g = groups.find(x=>x.id===groupId);
  const [messages, setMessages] = useState([]);
  const [memberCars, setMemberCars] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const knownIds = useRef(new Set());

  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date(), diff = now-d;
    if (diff<60000) return "just now";
    if (diff<3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff<86400000) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString([],{month:"short",day:"numeric"});
  };

  useEffect(()=>{
    if (!groupId) return;
    setLoading(true); knownIds.current=new Set(); setMessages([]);
    supabase.from("group_messages").select("*, profiles(username, avatar_initials)")
      .eq("group_id",groupId).order("created_at",{ascending:true}).limit(100)
      .then(({data})=>{
        if (data) {
          data.forEach(m=>knownIds.current.add(m.id));
          setMessages(data.map(m=>({id:m.id,uid:m.user_id,username:m.profiles?.username||"?",avatar:m.profiles?.avatar_initials||"?",text:m.content,ts:m.created_at})));
        }
        setLoading(false);
      });
    if (g?.memberIds?.length) {
      supabase.from("user_cars").select("user_id,year,make,model,trim").in("user_id",g.memberIds).eq("is_primary",true)
        .then(({data})=>{ if(!data) return; const m={}; data.forEach(c=>{m[c.user_id]=`${c.year} ${c.make} ${c.model}${c.trim?" "+c.trim:""}`;}); setMemberCars(m); });
    }
    const channel = supabase.channel(`chat:${groupId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"group_messages",filter:`group_id=eq.${groupId}`},async(payload)=>{
        const row=payload.new;
        if (knownIds.current.has(row.id)) return;
        knownIds.current.add(row.id);
        let username="?",avatar="?";
        const known=allUsers.find(u=>u.id===row.user_id);
        if (known){username=known.username;avatar=known.avatar;}
        else if(row.user_id===myProfile.id){username=myProfile.username;avatar=myProfile.avatar;}
        else{const{data:prof}=await supabase.from("profiles").select("username,avatar_initials").eq("id",row.user_id).single();if(prof){username=prof.username;avatar=prof.avatar_initials||"?";}}
        setMessages(prev=>[...prev,{id:row.id,uid:row.user_id,username,avatar,text:row.content,ts:row.created_at}]);
      }).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  }, [groupId]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages.length]);

  const send = async () => {
    const text=input.trim(); if(!text) return;
    setInput("");
    const{error}=await supabase.from("group_messages").insert({group_id:groupId,user_id:myProfile.id,content:text});
    if(error) console.error("send message error:",error);
  };

  if (!g) return null;
  const members = g.memberIds.map(id=>getU(id,allUsers,myProfile)).filter(Boolean);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Groups</button>
      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">{g.name}</div>
        <div className="pg-sub">{g.type} · {g.memberIds.length} users</div>
        {g.desc&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>{g.desc}</div>}
        {g.tags?.length>0&&<div className="tags" style={{marginTop:8}}>{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>}
      </div>

      <div className="sec-lbl">Users ({g.memberIds.length})</div>
      <div className="list-card" style={{margin:"0 16px 14px"}}>
        {members.map(m=>(
          <div key={m.id} className="list-item" onClick={()=>m.id!==myProfile.id&&openPlayer(m.id)}>
            <div className={`av s32 ${m.id===myProfile.id?"me":""}`}>{m.avatar}</div>
            <div className="list-item-info">
              <div className="list-item-title">@{m.username||m.avatar}{m.id===myProfile.id&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
              {memberCars[m.id]&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{memberCars[m.id]}</div>}
            </div>
            <TierBadge wins={tw(m.wins)}/>
          </div>
        ))}
      </div>

      <div className="sec-lbl">Group Chat</div>
      <div className="chat-msgs">
        {loading&&<div className="empty">Loading messages…</div>}
        {!loading&&messages.length===0&&<div className="empty">No messages yet.</div>}
        {messages.map(msg=>{
          const mine=msg.uid===myProfile.id;
          const car=memberCars[msg.uid];
          return (
            <div key={msg.id} className={`msg-row ${mine?"mine":""}`}>
              {!mine&&<div className="av s28">{msg.avatar}</div>}
              <div>
                <div className="msg-meta">
                  {!mine&&<span className="msg-who">@{msg.username}</span>}
                  {car&&<span className="msg-car">{car}</span>}
                  <span style={{color:"var(--muted2)",fontSize:10}}>{fmt(msg.ts)}</span>
                </div>
                <div className={`msg-bubble ${mine?"mine":""}`}><div className="msg-text">{msg.text}</div></div>
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

/* ─── MAP VIEW ───────────────────────────────────────────── */
function MapView({ groups, openPlayer, myProfile, setMyProfile, allUsers, lobbies }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const userMarkersRef = useRef([]);
  const groupMarkersRef = useRef([]);

  const [filter, setFilter] = useState("All");
  const [memberCars, setMemberCars] = useState({});
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState(null);
  const [mapVisible, setMapVisible] = useState(myProfile.mapVisible??true);

  const myId = myProfile.id;
  const myGroups = groups.filter(g=>g.memberIds.includes(myId));

  const allWithMe = myProfile.lat!=null ? [myProfile,...allUsers] : allUsers;
  const visibleUsers = allWithMe.filter(p=>{
    if (p.lat==null||p.lng==null) return false;
    if (!p.mapVisible&&p.id!==myId) return false;
    if (filter!=="All"&&!groups.find(g=>g.id===filter)?.memberIds.includes(p.id)) return false;
    return true;
  });

  const visibleGroups = (filter==="All"?myGroups:myGroups.filter(g=>g.id===filter))
    .filter(g=>g.lat!=null&&g.lng!=null);

  useEffect(()=>{
    const allIds=[...allUsers.map(u=>u.id),...(myId?[myId]:[])];
    if (!allIds.length) return;
    supabase.from("user_cars").select("user_id,year,make,model,trim").in("user_id",allIds).eq("is_primary",true)
      .then(({data})=>{ if(!data) return; const m={}; data.forEach(c=>{m[c.user_id]=`${c.year} ${c.make} ${c.model}${c.trim?" "+c.trim:""}`;}); setMemberCars(m); });
  }, [myId, allUsers]);

  useEffect(()=>{
    if (mapRef.current||!mapContainer.current) return;
    mapboxgl.accessToken=MAPBOX_TOKEN;
    mapRef.current=new mapboxgl.Map({container:mapContainer.current,style:"mapbox://styles/mapbox/dark-v11",center:[-122.67,45.52],zoom:11});
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");
    return ()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
  }, []);

  useEffect(()=>{
    if (!mapRef.current) return;
    userMarkersRef.current.forEach(m=>m.remove()); userMarkersRef.current=[];
    visibleUsers.forEach(p=>{
      const isMe=p.id===myId;
      const car=memberCars[p.id];
      // Show fuzzy location for non-precise markers
      const el=document.createElement("div");
      el.style.cssText=[`width:${isMe?16:11}px`,`height:${isMe?16:11}px`,"border-radius:50%",`background:${isMe?"#e61a1a":"#ffffff"}`,`border:2px solid ${isMe?"#e61a1a":"#2a2a2a"}`,"cursor:pointer","transition:transform .15s",`box-shadow:${isMe?"0 0 12px rgba(230,26,26,0.6)":"0 1px 4px rgba(0,0,0,.8)"}`].join(";");
      el.onmouseenter=()=>{el.style.transform="scale(1.4)";}; el.onmouseleave=()=>{el.style.transform="scale(1)";};
      el.addEventListener("click",()=>openPlayer(p.id));
      const popupHtml=`<div style="min-width:120px"><div style="font-size:12px;font-weight:700;color:#e61a1a;margin-bottom:${car?3:0}px">@${p.username}${isMe?" <span style='color:#888;font-size:10px'>(you)</span>":""}</div>${car?`<div style="font-size:11px;color:#ccc;font-family:'JetBrains Mono',monospace">${car}</div>`:""}</div>`;
      const popup=new mapboxgl.Popup({offset:16,closeButton:false,closeOnClick:false}).setHTML(popupHtml);
      const marker=new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).setPopup(popup).addTo(mapRef.current);
      userMarkersRef.current.push(marker);
    });
  }, [visibleUsers,memberCars,myId]);

  useEffect(()=>{
    if (!mapRef.current) return;
    groupMarkersRef.current.forEach(m=>m.remove()); groupMarkersRef.current=[];
    visibleGroups.forEach(g=>{
      const el=document.createElement("div");
      el.style.cssText=["width:13px","height:13px","border-radius:3px","background:#00c060","border:2px solid #007a3d","cursor:pointer","box-shadow:0 0 8px rgba(0,192,96,0.4)","transform:rotate(45deg)","transition:transform .15s"].join(";");
      el.onmouseenter=()=>{el.style.transform="rotate(45deg) scale(1.4)";}; el.onmouseleave=()=>{el.style.transform="rotate(45deg) scale(1)";};
      const popupHtml=`<div style="min-width:110px"><div style="font-size:11px;font-weight:700;color:#00c060;margin-bottom:3px">${g.name}</div><div style="font-size:10px;color:#888">${g.memberIds.length} user${g.memberIds.length!==1?"s":""}</div>${g.tags?.length?`<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">${g.tags.map(t=>`<span style="font-size:9px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:3px;padding:1px 5px;color:#aaa">${t}</span>`).join("")}</div>`:""}</div>`;
      const popup=new mapboxgl.Popup({offset:16,closeButton:false,closeOnClick:false}).setHTML(popupHtml);
      const marker=new mapboxgl.Marker({element:el}).setLngLat([g.lng,g.lat]).setPopup(popup).addTo(mapRef.current);
      groupMarkersRef.current.push(marker);
    });
  }, [visibleGroups]);

  const handleSetLocation = () => {
    if (!navigator.geolocation){setLocErr("Geolocation not supported");return;}
    setLocating(true); setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      async(pos)=>{
        const{latitude:lat,longitude:lng}=pos.coords;
        const{error:locErr}=await supabase.from("profiles").update({lat,lng}).eq("id",myId);
        if(locErr) console.error("Set location error:",locErr);
        setMyProfile(p=>({...p,lat,lng}));
        if(mapRef.current) mapRef.current.flyTo({center:[lng,lat],zoom:13});
        setLocating(false);
      },
      (err)=>{setLocErr("Location access denied");setLocating(false);},
      {enableHighAccuracy:true,timeout:10000}
    );
  };

  const handleToggleVisible = async () => {
    const next=!mapVisible; setMapVisible(next);
    setMyProfile(p=>({...p,mapVisible:next}));
    const{error}=await supabase.from("profiles").update({map_visible:next}).eq("id",myId);
    if(error) console.error("Toggle visible error:",error);
  };

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Live Map</div>
        <div className="pg-sub">{visibleUsers.length} users visible · general vicinity shown</div>
      </div>

      <div className="pills">
        <button className={`pill ${filter==="All"?"on":""}`} onClick={()=>setFilter("All")}>All</button>
        {myGroups.map(g=>(
          <button key={g.id} className={`pill ${filter===g.id?"on":""}`} onClick={()=>setFilter(g.id)}>
            {g.name.split(" ").slice(0,2).join(" ")}
          </button>
        ))}
      </div>

      <div className="map-controls">
        <button className="map-loc-btn" onClick={handleSetLocation} disabled={locating}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          {locating?"Locating…":myProfile.lat!=null?"Update Location":"Set My Location"}
        </button>
        <div className="map-vis-toggle" onClick={handleToggleVisible}>
          <div className={`tog ${mapVisible?"on":""}`}/>
          <span>{mapVisible?"Visible on map":"Hidden from map"}</span>
        </div>
        {locErr&&<span className="map-loc-status" style={{color:"var(--red)"}}>{locErr}</span>}
        {!locErr&&myProfile.lat!=null&&<span className="map-loc-status">📍 Location set</span>}
      </div>

      <div className="map-wrap">
        <div ref={mapContainer} style={{width:"100%",height:"100%"}}/>
      </div>

      <div className="map-group-legend">
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{background:"#e61a1a",boxShadow:"0 0 6px rgba(230,26,26,.5)"}}/>
          <span>You</span>
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{background:"#ffffff",border:"1px solid #444"}}/>
          <span>Users</span>
        </div>
        <div className="map-legend-item">
          <div className="map-legend-dot" style={{width:9,height:9,background:"#00c060",borderRadius:2,transform:"rotate(45deg)",boxShadow:"0 0 5px rgba(0,192,96,.4)"}}/>
          <span>Groups</span>
        </div>
      </div>

      <div className="sec-lbl">{visibleUsers.length} {visibleUsers.length===1?"User":"Users"} on Map</div>
      {visibleUsers.length===0&&<div className="empty">No users with location data.</div>}
      {visibleUsers.map(p=>{
        const isMe=p.id===myId;
        const car=memberCars[p.id];
        return (
          <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
            <div style={{width:9,height:9,borderRadius:"50%",background:isMe?"#e61a1a":"#555",flexShrink:0,boxShadow:isMe?"0 0 6px rgba(230,26,26,.5)":"none"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">@{p.username}{isMe&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
              {car&&<div className="user-car" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{car}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── RANKS VIEW ─────────────────────────────────────────── */
function RanksView({ openPlayer, myProfile, allUsers, myCar }) {
  const [cat, setCat] = useState("0-60");
  const [classFilter, setClass] = useState("All");
  const [locScope, setLocScope] = useState("National");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(()=>{
    let cancelled=false; setLoading(true);
    const run=async()=>{
      let q=supabase.from("race_times").select("*, profiles(username,avatar_initials,city), user_cars(year,make,model,trim,build_stage)")
        .eq("category",cat).order("time_seconds",{ascending:true}).limit(300);
      if (classFilter!=="All") q=q.eq("car_class",classFilter);
      if (locScope==="By City"&&myProfile.city) q=q.ilike("profiles.city",`%${myProfile.city.split(",")[0].trim()}%`);
      if (locScope==="By State"&&myProfile.city) {
        const parts=myProfile.city.split(","); const state=(parts[1]||"").trim().split(" ")[0];
        if (state) q=q.ilike("profiles.city",`%, ${state}%`);
      }
      const{data}=await q;
      if (cancelled||!data) return;
      const best={};
      data.forEach(e=>{ if(!best[e.user_id]||e.time_seconds<best[e.user_id].time_seconds) best[e.user_id]=e; });
      setEntries(Object.values(best).sort((a,b)=>a.time_seconds-b.time_seconds));
      setLoading(false);
    };
    run();
    return()=>{cancelled=true;};
  }, [cat,classFilter,locScope,loadKey]);

  const myIdx=entries.findIndex(e=>e.user_id===myProfile.id);
  const myEntry=myIdx>=0?entries[myIdx]:null;
  const RANK_COLOR=(i)=>i===0?"#f59e0b":i===1?"#a0a0a0":i===2?"#cd7f32":"var(--muted2)";

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Leaderboard</div>
          <div className="pg-sub">Fastest times per car per profile</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4}} onClick={()=>setSubmitOpen(true)}>+ Submit</button>
      </div>

      {/* Location scope */}
      <div className="lb-loc-tabs">
        {["National","By State","By City"].map(s=>(
          <button key={s} className={`lb-loc-tab ${locScope===s?"on":""}`} onClick={()=>setLocScope(s)}>{s}</button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="lb-cat-tabs">
        {LEADERBOARD_CATS.map(c=>(
          <button key={c.key} className={`lb-cat-tab ${cat===c.key?"on":""}`} onClick={()=>setCat(c.key)}>
            {c.label}<span className="lb-cat-tab-sub">{c.sub}</span>
          </button>
        ))}
      </div>

      {/* Class filter */}
      <div className="pills">
        {CAR_CLASSES.map(cls=>(
          <button key={cls} className={`pill ${classFilter===cls?"on":""}`} onClick={()=>setClass(cls)}>{cls}</button>
        ))}
      </div>

      {myEntry&&myIdx>9&&(
        <div className="my-best-bar">
          <div>
            <div style={{fontSize:10,color:"var(--accent)",fontWeight:600,letterSpacing:1.2,textTransform:"uppercase",marginBottom:2}}>Your Best</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>#{myIdx+1} · {myEntry.car_class&&<span className="car-class-badge" style={{marginRight:4}}>{myEntry.car_class}</span>}{[myEntry.user_cars?.year,myEntry.user_cars?.make,myEntry.user_cars?.model].filter(Boolean).join(" ")||"No car"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <span className="lb-time-val" style={{color:"var(--accent)"}}>{Number(myEntry.time_seconds).toFixed(3)}</span>
            <span className="lb-time-unit">s</span>
          </div>
        </div>
      )}

      {loading&&<div style={{padding:"32px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading…</div>}
      {!loading&&entries.length===0&&(
        <div style={{padding:"40px 20px",textAlign:"center"}}>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>No times submitted yet.<br/>Be the first on the board.</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setSubmitOpen(true)}>+ Submit Time</button>
        </div>
      )}

      {!loading&&entries.map((entry,i)=>{
        const isMe=entry.user_id===myProfile.id;
        const car=entry.user_cars;
        const prof=entry.profiles;
        const carStr=car?[car.year,car.make,car.model].filter(Boolean).join(" "):"";
        const rc=RANK_COLOR(i);
        return (
          <div key={entry.id} className={`lb-row ${isMe?"mine":""}`} onClick={()=>openPlayer(entry.user_id)}>
            <div className="lb-rank" style={{color:rc,fontSize:i<3?15:12,width:20}}>{i+1}</div>
            <div className={`av s32 ${isMe?"me":""}`}>{prof?.avatar_initials||"?"}</div>
            <div className="lb-info">
              <div className="lb-name">
                <span style={{color:"var(--accent)",fontWeight:600}}>@{prof?.username||"?"}</span>
                {isMe&&<span className="you-tag">YOU</span>}
                {entry.car_class&&<span className="car-class-badge">{entry.car_class}</span>}
                {car?.build_stage&&car.build_stage!=="stock"&&<BuildBadge stage={car.build_stage}/>}
              </div>
              {carStr&&<div className="lb-sub">{carStr}{car?.trim?` · ${car.trim}`:""}</div>}
              {prof?.city&&locScope!=="National"&&<div style={{fontSize:10,color:"var(--muted2)",marginTop:1}}>📍 {prof.city}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div>
                <span className="lb-time-val" style={{color:rc}}>{Number(entry.time_seconds).toFixed(3)}</span>
                <span className="lb-time-unit">s</span>
              </div>
              {entry.proof_url&&<a className="proof-link" href={entry.proof_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>proof ↗</a>}
            </div>
          </div>
        );
      })}

      {submitOpen&&<SubmitTimeModal myProfile={myProfile} myCar={myCar} initialCat={cat} onClose={()=>setSubmitOpen(false)} onSubmitted={()=>{setSubmitOpen(false);setLoadKey(k=>k+1);}}/>}
    </div>
  );
}

/* ─── SUBMIT TIME MODAL ──────────────────────────────────── */
function SubmitTimeModal({ myProfile, myCar, initialCat, onClose, onSubmitted }) {
  const [cat, setCat] = useState(initialCat);
  const [timeVal, setTimeVal] = useState("");
  const [carClass, setCarClass] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasCar=myCar.make&&myCar.model;
  const carLabel=hasCar?[myCar.year,myCar.make,myCar.model].filter(Boolean).join(" "):null;
  const parsed=parseFloat(timeVal);
  const timeOk=timeVal!==""&&!isNaN(parsed)&&parsed>0;
  const canSubmit=timeOk&&carClass!==""&&myProfile.id;

  const handleSubmit=async()=>{
    if(!canSubmit) return;
    setSubmitting(true); setError("");
    try {
      const{error:err}=await supabase.from("race_times").insert({
        user_id:myProfile.id, car_id:myCar.id||null, category:cat,
        time_seconds:parsed, car_class:carClass, proof_url:proofUrl.trim()||null, verified:false,
      });
      if(err) throw err;
      onSubmitted();
    } catch(e){ setError(e.message||"Submission failed."); } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade">
        <div className="modal-handle"/>
        <div className="modal-title">Submit Time</div>
        <div className="modal-sub">Your best run for the leaderboard</div>

        <label className="inp-label" style={{marginBottom:8}}>Category</label>
        <div className="lb-cat-tabs" style={{marginBottom:16}}>
          {LEADERBOARD_CATS.map(c=>(
            <button key={c.key} className={`lb-cat-tab ${cat===c.key?"on":""}`} onClick={()=>setCat(c.key)}>
              {c.label}<span className="lb-cat-tab-sub">{c.sub}</span>
            </button>
          ))}
        </div>

        <label className="inp-label" style={{marginBottom:6}}>Car</label>
        <div style={{background:"var(--s3)",border:"1px solid var(--border)",borderRadius:8,padding:"11px 14px",marginBottom:14}}>
          {hasCar?<span style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{carLabel}</span>:<span style={{fontSize:12,color:"var(--muted2)"}}>No car on profile — add one in Edit Profile</span>}
        </div>

        <label className="inp-label" style={{marginBottom:8}}>Class</label>
        <div className="pills" style={{padding:0,flexWrap:"wrap",marginBottom:16,gap:6}}>
          {CAR_CLASSES.filter(c=>c!=="All").map(cls=>(
            <button key={cls} className={`pill ${carClass===cls?"on":""}`} onClick={()=>setCarClass(cls)}>{cls}</button>
          ))}
        </div>

        <label className="inp-label" style={{marginBottom:6}}>Time (seconds)</label>
        <input className="inp" type="number" step="0.001" min="0.001"
          style={{fontFamily:"var(--font-mono)",fontSize:28,fontWeight:700,letterSpacing:"-1px",padding:"12px 16px",marginBottom:4,textAlign:"center"}}
          placeholder="0.000" value={timeVal} onChange={e=>setTimeVal(e.target.value)}/>
        <div style={{fontSize:10,color:"var(--muted2)",marginBottom:14,textAlign:"center",letterSpacing:.3}}>Enter to 3 decimal places, e.g. 3.820</div>

        <label className="inp-label" style={{marginBottom:6}}>Proof URL <span style={{color:"var(--muted2)",fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>optional</span></label>
        <input className="inp" type="url" placeholder="https://youtube.com/watch?v=..." value={proofUrl} onChange={e=>setProofUrl(e.target.value)} style={{marginBottom:16}}/>

        {error&&<div style={{marginBottom:12,padding:"10px 14px",background:"rgba(255,59,48,.1)",border:"1px solid rgba(255,59,48,.2)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{error}</div>}

        <button className="btn btn-primary btn-full" style={{borderRadius:10,padding:14,marginBottom:8}} disabled={!canSubmit||submitting} onClick={handleSubmit}>
          {submitting?"Submitting…":"Submit to Leaderboard"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:10}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── PROFILE VIEW ───────────────────────────────────────── */
function ProfileView({ myProfile, friends, groups, openPlayer, onEdit, onCreateGroup, myCar, allUsers }) {
  const [activeSubTab, setActiveSubTab] = useState("Stats");
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const myFriends = allUsers.filter(p=>friends.includes(p.id));
  const totalW = tw(myProfile.wins);
  const totalR = Object.values(myProfile.races).reduce((a,b)=>a+b,0);
  const tier = getTier(totalW);
  const nextTier = TIERS[TIERS.indexOf(tier)+1];
  const progress = nextTier?((totalW-tier.min)/(nextTier.min-tier.min))*100:100;
  const hasTimes = myProfile.times&&Object.values(myProfile.times).some(v=>v);
  const myRank = computeRanks(allUsers,myProfile).find(x=>x.id===myProfile.id)?.rank??"-";
  const hasCar = myCar.make&&myCar.model;
  const ig = myProfile.instagram||myProfile.socials?.instagram||"";
  const activeFriends = myFriends.filter(f=>f.mapVisible&&f.lat!=null);

  return (
    <div>
      {/* Profile banner */}
      {myProfile.bannerUrl
        ? <img src={myProfile.bannerUrl} alt="banner" className="profile-banner"/>
        : <div className="profile-banner-empty" onClick={onEdit}><span style={{fontSize:16}}>🖼</span> Add profile banner</div>
      }

      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Profile</div>
          <div className="pg-sub">Your driver record</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{marginTop:4}}>Edit</button>
      </div>

      {/* Car showcase */}
      <div className="car-showcase">
        <div className="car-photo-wrap" onClick={onEdit}>
          {myCar.photoUrl
            ? <img src={myCar.photoUrl} alt="car"/>
            : <div className="car-photo-empty">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
                <span className="car-photo-label">{hasCar?"Add photo":"Set up your car"}</span>
              </div>
          }
        </div>
        {hasCar?(
          <div className="car-info-block">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div className="car-year-badge">{myCar.year||"—"}</div>
              {myCar.buildStage&&myCar.buildStage!=="stock"&&<BuildBadge stage={myCar.buildStage}/>}
            </div>
            <div className="car-make-model">{myCar.make} {myCar.model}</div>
            {myCar.trim&&<div className="car-trim">{myCar.trim}</div>}
            {myCar.mods&&<div className="car-mods-section"><div className="car-mods-label">Modifications</div><div className="car-mods-text">{myCar.mods}</div></div>}
          </div>
        ):(
          <div className="car-empty-state">
            <div className="car-empty-text">Add your build to your profile</div>
            <button className="btn btn-primary btn-sm" onClick={onEdit}>+ Add Car</button>
          </div>
        )}
      </div>

      {/* Identity card */}
      <div className="card" style={{marginBottom:8}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
          <div className="av s56 me">{myProfile.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:"var(--accent)",fontWeight:600,marginBottom:2}}>@{myProfile.username}</div>
            {myProfile.showRealName&&<div style={{fontSize:19,fontWeight:700,letterSpacing:-.5,lineHeight:1.1}}>{myProfile.displayName}</div>}
            {myProfile.city&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📍 {myProfile.city}</div>}
            {ig&&(
              <a href={`https://instagram.com/${ig.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,fontSize:12,color:"var(--accent)",textDecoration:"none",fontWeight:500}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                @{ig.replace("@","")}
              </a>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
              <TierBadge wins={totalW}/>
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

      {/* Sub-tabs */}
      <div className="pills" style={{marginBottom:8}}>
        {["Stats","Friends","Groups"].map(t=>(
          <button key={t} className={`pill ${activeSubTab===t?"on":""}`} onClick={()=>setActiveSubTab(t)}>
            {t}{t==="Friends"&&activeFriends.length>0&&<span style={{marginLeft:4,background:"var(--green)",width:6,height:6,borderRadius:"50%",display:"inline-block"}}/>}
          </button>
        ))}
      </div>

      {activeSubTab==="Stats"&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px",marginBottom:8}}>
          {[
            {n:totalW,l:"Wins",c:"var(--text)"},
            {n:totalR,l:"Races",c:"var(--text)"},
            {n:`${totalR>0?Math.round((totalW/totalR)*100):0}%`,l:"Rate",c:"var(--green)"},
            {n:`#${myRank}`,l:"Rank",c:"var(--accent)"},
          ].map(({n,l,c})=>(
            <div key={l} style={{background:"var(--s2)",borderRadius:10,padding:"11px 8px",textAlign:"center",border:"1px solid var(--border)"}}>
              <div style={{fontSize:22,fontWeight:700,lineHeight:1,color:c,letterSpacing:"-0.5px"}}>{n}</div>
              <div style={{fontSize:9,color:"var(--muted2)",marginTop:4,letterSpacing:.8,textTransform:"uppercase"}}>{l}</div>
            </div>
          ))}
        </div>

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
      </>)}

      {activeSubTab==="Friends"&&(<>
        <div style={{padding:"0 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:"var(--muted)"}}>{myFriends.length} friends · {activeFriends.length} active now</span>
        </div>
        {myFriends.length===0&&<div className="empty">No friends yet — use Search to find people.</div>}
        {myFriends.map(p=>{
          const isActive = p.mapVisible&&p.lat!=null;
          return (
            <div key={p.id} className="user-row" onClick={()=>openPlayer(p.id)}>
              <div className={isActive?"friend-active-dot":"friend-inactive-dot"}/>
              <div className="av s32">{p.avatar}</div>
              <div style={{flex:1}}>
                <div className="user-name">@{p.username}</div>
                <div className="user-car">{tw(p.wins)}W</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <TierBadge wins={tw(p.wins)}/>
                {isActive&&<span style={{fontSize:9,color:"var(--green)",fontWeight:600,letterSpacing:.3}}>ACTIVE</span>}
              </div>
            </div>
          );
        })}
      </>)}

      {activeSubTab==="Groups"&&(<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 16px 8px"}}>
          <span className="sec-lbl" style={{margin:0,padding:0}}>My Groups ({myGroups.length})</span>
          <button className="btn btn-secondary btn-sm" onClick={onCreateGroup} style={{fontSize:12,gap:4}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Group
          </button>
        </div>
        {myGroups.length===0&&<div className="empty">No groups yet.</div>}
        {myGroups.map(g=>(
          <div key={g.id} style={{background:"var(--s2)",borderRadius:12,margin:"0 16px 6px",border:"1px solid var(--border)",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600}}>{g.name}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{g.memberIds.length}/{g.max} users · {g.lastActive}</div>
            </div>
            <span className={`gc-type-pill ${g.type}`}>{g.type}</span>
          </div>
        ))}
      </>)}
      <div style={{height:20}}/>
    </div>
  );
}

/* ─── EDIT PROFILE ───────────────────────────────────────── */
function compressImage(file, maxPx=1400, quality=0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let {width:w, height:h} = img;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {type:"image/jpeg"})), "image/jpeg", quality);
    };
    img.src = url;
  });
}

function EditProfile({ myProfile, setMyProfile, myCar, setMyCar, userId, onBack }) {
  const [form, setForm] = useState({...myProfile});
  const [carForm, setCarForm] = useState({...myCar});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(myCar.photoUrl||"");
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(myProfile.bannerUrl||"");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const bannerRef = useRef(null);

  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setC=(k,v)=>setCarForm(c=>({...c,[k]:v}));

  const handlePhotoSelect=(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file));
  };

  const handleBannerSelect=(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setBannerFile(file); setBannerPreview(URL.createObjectURL(file));
  };

  const handleSave=async()=>{
    if (!userId) { setError("Not logged in."); return; }
    setSaving(true); setError("");
    try {
      let photoUrl=carForm.photoUrl;
      if (photoFile) {
        const compressed=await compressImage(photoFile,1400);
        const path=`${userId}/${Date.now()}.jpg`;
        const{error:upErr}=await supabase.storage.from("car-photos").upload(path,compressed,{upsert:true,contentType:"image/jpeg"});
        if(upErr) throw upErr;
        const{data:{publicUrl}}=supabase.storage.from("car-photos").getPublicUrl(path);
        photoUrl=publicUrl;
      }
      let bannerUrl=myProfile.bannerUrl||"";
      if (bannerFile) {
        const compressed=await compressImage(bannerFile,1800);
        const path=`${userId}/banner-${Date.now()}.jpg`;
        const{error:upErr}=await supabase.storage.from("car-photos").upload(path,compressed,{upsert:true,contentType:"image/jpeg"});
        if(upErr) throw upErr;
        const{data:{publicUrl}}=supabase.storage.from("car-photos").getPublicUrl(path);
        bannerUrl=publicUrl;
      }
      const{error:profErr}=await supabase.from("profiles").update({
        display_name:form.displayName, show_real_name:form.showRealName,
        city:form.city, instagram:form.instagram, avatar_initials:form.avatar,
        banner_url:bannerUrl||null,
      }).eq("id",userId);
      if(profErr) throw profErr;
      let newCarId=carForm.id;
      if (carForm.make.trim()&&carForm.model.trim()) {
        const carPayload={
          user_id:userId, make:carForm.make.trim(), model:carForm.model.trim(),
          year:parseInt(carForm.year)||null, trim:carForm.trim.trim()||null,
          mods:carForm.mods.trim()||null, build_stage:carForm.buildStage||"stock",
          photos:photoUrl?[photoUrl]:(carForm.photoUrl?[carForm.photoUrl]:[]), is_primary:true,
        };
        if (carForm.id) {
          const{error:carErr}=await supabase.from("user_cars").update(carPayload).eq("id",carForm.id);
          if(carErr) throw carErr;
        } else {
          const{data:inserted,error:insErr}=await supabase.from("user_cars").insert(carPayload).select("id").single();
          if(insErr) throw insErr;
          newCarId=inserted?.id||null;
        }
      }
      setMyProfile(p=>({...p,...form,id:userId,instagram:form.instagram,socials:{...form.socials,instagram:form.instagram},bannerUrl}));
      setMyCar({...carForm,id:newCarId,photoUrl});
      onBack();
    } catch(err){ console.error("Save error:",err); setError(err?.message||"Failed to save. Check your connection."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Profile</button>
      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">Edit Profile</div>
        <div className="pg-sub">Update your information</div>
      </div>

      {/* Profile banner */}
      <div className="sec-lbl">Profile Banner</div>
      <div style={{margin:"0 16px 8px",borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>bannerRef.current?.click()}>
        <input ref={bannerRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBannerSelect}/>
        {bannerPreview
          ? <img src={bannerPreview} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} alt="banner"/>
          : <div className="profile-banner-empty" style={{height:70,borderRadius:"var(--radius-lg)",fontSize:12}}><span style={{fontSize:16}}>🖼</span> Tap to add a profile banner</div>
        }
        {bannerPreview&&<div style={{textAlign:"center",padding:"6px 0",fontSize:11,color:"var(--muted2)",background:"var(--s2)"}}>Tap to change banner</div>}
      </div>

      {/* Car section */}
      <div className="sec-lbl">My Car</div>
      <div className="card" style={{marginBottom:8}}>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoSelect}/>
        <div className="photo-upload-wrap" onClick={()=>fileRef.current?.click()}>
          {photoPreview&&<img src={photoPreview} alt="car preview"/>}
          <div className="photo-upload-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span className="photo-upload-hint">{photoPreview?"Change photo":"Add photo"}</span>
          </div>
          {!photoPreview&&(<>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{fontSize:11,color:"var(--muted2)"}}>Tap to add car photo</span>
          </>)}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          {[["Make","make","Honda"],["Model","model","Civic"],["Year","year","2020"],["Trim","trim","Type R"]].map(([label,key,ph])=>(
            <div key={key}>
              <label className="inp-label">{label}</label>
              <input className="inp" value={carForm[key]||""} onChange={e=>setC(key,e.target.value)} placeholder={ph} type={key==="year"?"number":"text"}/>
            </div>
          ))}
        </div>

        {/* Build Stage */}
        <div style={{marginBottom:8}}>
          <label className="inp-label">Build Stage</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {BUILD_STAGES.map(s=>(
              <button key={s.key}
                onClick={()=>setC("buildStage",s.key)}
                style={{
                  padding:"5px 12px",borderRadius:6,border:`1px solid ${carForm.buildStage===s.key?s.color:s.color+"44"}`,
                  background:carForm.buildStage===s.key?s.bg:"transparent",
                  color:carForm.buildStage===s.key?s.color:"var(--muted2)",
                  fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:.3,transition:"all .12s",
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="inp-label">Modifications</label>
          <textarea className="inp" rows={4} style={{resize:"vertical",lineHeight:1.6,fontFamily:"var(--font-mono)",fontSize:12}}
            value={carForm.mods||""} onChange={e=>setC("mods",e.target.value)}
            placeholder={"Cold air intake\nCoilover suspension\nMagnaflow catback\n..."}/>
        </div>
      </div>

      {/* Identity */}
      <div className="sec-lbl">Identity</div>
      <div className="list-card" style={{margin:"0 16px 8px"}}>
        <div className="toggle-row">
          <div>
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

      {/* Instagram */}
      <div className="sec-lbl">Instagram</div>
      <div className="card" style={{marginBottom:8}}>
        <label className="inp-label">Handle</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--muted2)",display:"flex",alignItems:"center"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </span>
          <input className="inp" style={{paddingLeft:36}} value={form.instagram||""} onChange={e=>setF("instagram",e.target.value)} placeholder="@yourhandle"/>
        </div>
        {form.instagram&&<a href={`https://instagram.com/${(form.instagram||"").replace("@","")}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:8,fontSize:12,color:"var(--accent)"}}>instagram.com/{(form.instagram||"").replace("@","")} ↗</a>}
      </div>

      {/* Race Times */}
      <div className="sec-lbl">Recorded Times</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:8}}>
        {RACE_TIMES.map(t=>(
          <div key={t.key} style={{background:"var(--s2)",borderRadius:10,padding:"12px",border:"1px solid var(--border)"}}>
            <label className="inp-label" style={{padding:0,marginBottom:6}}>{t.label} ({t.unit})</label>
            <input className="inp" style={{padding:"8px 10px",fontSize:13}} value={form.times?.[t.key]||""} onChange={e=>setF("times",{...form.times,[t.key]:e.target.value})} placeholder="e.g. 3.8"/>
          </div>
        ))}
      </div>

      {error&&<div style={{margin:"0 16px 10px",padding:"10px 14px",background:"rgba(255,59,48,.1)",border:"1px solid rgba(255,59,48,.25)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{error}</div>}

      <div style={{padding:"4px 16px 32px"}}>
        <button className="btn btn-primary btn-full" style={{borderRadius:10,padding:14}} onClick={handleSave} disabled={saving}>
          {saving?"Saving…":"Save Changes"}
        </button>
      </div>
    </div>
  );
}
