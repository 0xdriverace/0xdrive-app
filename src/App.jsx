import { useState, useRef, useEffect } from "react";

const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap');`;

/* ─── RANK TIERS ─────────────────────────────────────────────────── */
const TIERS = [
  { name:"Unranked",  min:0,   max:2,   color:"#555",    bg:"#1a1a1a", border:"#333",    icon:"—"  },
  { name:"Bronze",    min:3,   max:9,   color:"#CD7F32", bg:"#1e150a", border:"#6b3d10", icon:"⬡"  },
  { name:"Silver",    min:10,  max:24,  color:"#C0C0C0", bg:"#141414", border:"#555",    icon:"⬡"  },
  { name:"Gold",      min:25,  max:49,  color:"#FFD700", bg:"#1a1500", border:"#7a6000", icon:"⬡"  },
  { name:"Platinum",  min:50,  max:99,  color:"#60EFFF", bg:"#001a1f", border:"#0a5060", icon:"⬡"  },
  { name:"Diamond",   min:100, max:Infinity, color:"#B9F2FF", bg:"#0a001f", border:"#4a00aa", icon:"◆" },
];
const getTier = (wins) => TIERS.find(t => wins >= t.min && wins <= t.max) || TIERS[0];

/* ─── DATA ───────────────────────────────────────────────────────── */
const ME = {
  id:"u1", name:"Alex Reyes", car:"BMW M3 Competition", year:2022,
  avatar:"AR", tier:"Tier 2", city:"Portland, OR",
  wins:{h2h:9,group:3,trial:2,drag:0}, races:{h2h:14,group:5,trial:4,drag:2},
  lat:45.5231, lng:-122.6765,
};

const ALL_PLAYERS = [
  { id:"u2",  name:"Carlos M.",   car:"Audi RS6 ABT",          year:2023, avatar:"CM", city:"Portland, OR",      wins:{h2h:14,group:5,trial:2,drag:1}, races:{h2h:18,group:8,trial:4,drag:3},  lat:45.5290, lng:-122.6850, groups:["g1","g2"] },
  { id:"u3",  name:"Mia Torres",  car:"AMG C63 S",             year:2021, avatar:"MT", city:"Beaverton, OR",     wins:{h2h:10,group:4,trial:3,drag:0}, races:{h2h:14,group:6,trial:5,drag:1},  lat:45.4871, lng:-122.8037, groups:["g1"] },
  { id:"u4",  name:"Diego V.",    car:"BMW M4 CSL",            year:2023, avatar:"DV", city:"Lake Oswego, OR",   wins:{h2h:5, group:2,trial:2,drag:0}, races:{h2h:10,group:4,trial:4,drag:2},  lat:45.4129, lng:-122.7004, groups:["g1"] },
  { id:"u5",  name:"Sofia R.",    car:"Lamborghini Huracán",   year:2022, avatar:"SR", city:"Portland, OR",      wins:{h2h:28,group:8,trial:4,drag:5}, races:{h2h:32,group:10,trial:5,drag:6},  lat:45.5189, lng:-122.6584, groups:["g3"] },
  { id:"u6",  name:"Kenji H.",    car:"Nissan GT-R R35",       year:2020, avatar:"KH", city:"Hillsboro, OR",     wins:{h2h:8, group:3,trial:1,drag:1}, races:{h2h:13,group:5,trial:3,drag:3},  lat:45.5229, lng:-122.9898, groups:["g4"] },
  { id:"u7",  name:"Jay K.",      car:"Toyota Supra A90",      year:2023, avatar:"JK", city:"Gresham, OR",       wins:{h2h:5, group:1,trial:1,drag:1}, races:{h2h:9, group:3,trial:3,drag:4},   lat:45.5023, lng:-122.4303, groups:["g2","g4"] },
  { id:"u8",  name:"Luis F.",     car:"Porsche 911 GT3",       year:2023, avatar:"LF", city:"Tigard, OR",        wins:{h2h:4, group:2,trial:1,drag:0}, races:{h2h:8, group:4,trial:3,drag:1},   lat:45.4312, lng:-122.7714, groups:["g3"] },
  { id:"u9",  name:"Priya N.",    car:"Tesla Model S Plaid",   year:2023, avatar:"PN", city:"Tualatin, OR",      wins:{h2h:3, group:1,trial:2,drag:2}, races:{h2h:8, group:3,trial:4,drag:4},   lat:45.3840, lng:-122.7634, groups:["g2"] },
  { id:"u10", name:"Marcus W.",   car:"Dodge Hellcat Redeye",  year:2022, avatar:"MW", city:"Milwaukie, OR",     wins:{h2h:2, group:1,trial:0,drag:4}, races:{h2h:6, group:2,trial:1,drag:8},   lat:45.4468, lng:-122.6418, groups:["g4"] },
  { id:"u11", name:"Taylor S.",   car:"Subaru WRX STI",        year:2021, avatar:"TS", city:"Portland, OR",      wins:{h2h:1, group:0,trial:1,drag:0}, races:{h2h:3, group:1,trial:2,drag:1},   lat:45.5428, lng:-122.6544, groups:["g4"] },
  { id:"u12", name:"Rachel K.",   car:"Ford Mustang GT500",    year:2023, avatar:"RK", city:"Vancouver, WA",     wins:{h2h:0, group:0,trial:0,drag:2}, races:{h2h:1, group:0,trial:0,drag:4},   lat:45.6387, lng:-122.6615, groups:["g2"] },
];

const INIT_GROUPS = [
  { id:"g1", name:"PDX Euro Collective", type:"private", memberIds:["u1","u2","u3","u4"], max:20, admin:"u2", tags:["Euro","Track Days","Portland"], lastActive:"2h ago", desc:"Portland's premier European performance collective. Vetted members only.", messages:[{uid:"u2",text:"PIR Saturday morning — who's running?",time:"2h ago"},{uid:"u3",text:"I'm in. Fresh tune on the AMG 🔥",time:"1h ago"},{uid:"u4",text:"Count me in. Weather looks perfect.",time:"40m ago"}] },
  { id:"g2", name:"Cascade Turbo Club", type:"open",    memberIds:["u2","u7","u9","u12"], max:50, admin:"u7", tags:["Forced Induction","All Makes","Weekly"], lastActive:"5h ago", desc:"Boosted cars only. Weekly group runs through the Columbia River Gorge.", messages:[] },
  { id:"g3", name:"Oregon Exotics",     type:"private", memberIds:["u5","u8"],            max:10, admin:"u5", tags:["Exotic","Vetted","Collectors"], lastActive:"1d ago", desc:"Curated group for exotic and ultra-performance vehicles. Application required.", messages:[] },
  { id:"g4", name:"PNW JDM Squad",      type:"open",    memberIds:["u6","u7","u10","u11"],max:100,admin:"u6", tags:["JDM","Drift","Time Attack"], lastActive:"30m ago", desc:"All JDM everything. Drifts, time attacks, mountain runs.", messages:[] },
];

const FORMAT = [
  {key:"h2h",  label:"Head to Head", short:"H2H",   icon:"⚔"},
  {key:"group",label:"Group Race",   short:"Group",  icon:"◈"},
  {key:"trial",label:"Time Trial",   short:"Trial",  icon:"◎"},
  {key:"drag", label:"Drag",         short:"Drag",   icon:"↑"},
];

const tw   = w => Object.values(w).reduce((a,b)=>a+b,0);
const wr   = (w,r) => { const t=tw(r); return t>0?Math.round((tw(w)/t)*100)+"%":"—"; };
const getP = id => id==="u1"?{...ME,rank:computeRanks().find(x=>x.id==="u1")?.rank??4}:(() => { const p=ALL_PLAYERS.find(x=>x.id===id); if(!p)return null; return {...p,rank:computeRanks().find(x=>x.id===id)?.rank??99}; })();

function computeRanks() {
  const all = [{id:"u1",...ME},...ALL_PLAYERS];
  return all.map(p=>({id:p.id,totalWins:tw(p.wins)})).sort((a,b)=>b.totalWins-a.totalWins).map((x,i)=>({...x,rank:i+1}));
}

/* Portland area map bounds for dot positioning */
const PDX_BOUNDS = { minLat:45.35, maxLat:45.66, minLng:-123.05, maxLng:-122.35 };
const latLngToXY = (lat,lng) => ({
  x: ((lng - PDX_BOUNDS.minLng) / (PDX_BOUNDS.maxLng - PDX_BOUNDS.minLng)) * 100,
  y: ((PDX_BOUNDS.maxLat - lat) / (PDX_BOUNDS.maxLat - PDX_BOUNDS.minLat)) * 100,
});

const DOT_COLORS = {
  u1:"#F5C518",u2:"#e0e0e0",u3:"#9d78e8",u4:"#5cc97a",
  u5:"#F5C518",u6:"#e0e0e0",u7:"#5cc97a",u8:"#9d78e8",
  u9:"#e07070",u10:"#70c4e0",u11:"#e0a070",u12:"#c0c0c0",
};

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
${GFONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0b;
  --s1:#111113;
  --s2:#161618;
  --s3:#1c1c1f;
  --border:#242428;
  --border2:#2e2e34;
  --text:#f0f0f2;
  --muted:#6a6a72;
  --muted2:#4a4a52;
  --accent:#F5C518;
  --accent-dim:#3a2e04;
  --red:#e05555;
  --green:#4caf7d;
  --purple:#9d78e8;
}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}

/* HEADER */
.hdr{background:var(--s1);border-bottom:1px solid var(--border);padding:16px 18px 14px;position:sticky;top:0;z-index:100}
.logo{font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;letter-spacing:4px;color:var(--text);line-height:1}
.logo span{color:var(--accent)}
.logo-sub{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:3px;color:var(--muted);margin-top:3px;text-transform:uppercase}
.me-row{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.me-name-text{font-size:14px;font-weight:600;letter-spacing:.5px;line-height:1.2}
.me-car-text{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px}

/* AVATAR */
.av{border-radius:50%;background:var(--s3);color:var(--text);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:500;border:1px solid var(--border2)}
.av.s24{width:24px;height:24px;font-size:8px}
.av.s32{width:32px;height:32px;font-size:10px}
.av.s40{width:40px;height:40px;font-size:12px}
.av.s56{width:56px;height:56px;font-size:16px}
.av.me{border-color:var(--accent);color:var(--accent)}

/* TIER BADGE */
.tier-badge{display:inline-flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1px;padding:3px 8px;border-radius:3px;font-weight:500}

/* NAV */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:var(--s1);border-top:1px solid var(--border);display:flex;z-index:200}
.ni{flex:1;padding:10px 4px 12px;text-align:center;cursor:pointer;color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;border-top:2px solid transparent;transition:all .15s;line-height:1}
.ni.on{color:var(--accent);border-top-color:var(--accent)}
.ni-icon{font-size:16px;display:block;margin-bottom:3px}

/* CONTENT */
.content{flex:1;overflow-y:auto;padding:18px;padding-bottom:86px}

/* PAGE TITLES */
.pg-title{font-size:28px;font-weight:700;letter-spacing:1px;line-height:1;margin-bottom:2px}
.pg-sub{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:20px}
.sec-lbl{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;margin-top:2px}

/* CARDS */
.card{background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:8px;transition:border-color .15s}
.card.click{cursor:pointer}
.card.click:hover{border-color:var(--border2)}

/* BUTTONS */
.btn{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;padding:8px 16px;border-radius:4px;border:none;cursor:pointer;transition:all .15s;white-space:nowrap;text-transform:uppercase;display:inline-flex;align-items:center;gap:5px}
.btn-accent{background:var(--accent);color:#000}
.btn-accent:hover{background:#e6b800}
.btn-outline{background:transparent;border:1px solid var(--border2);color:var(--muted)}
.btn-outline:hover{border-color:var(--text);color:var(--text)}
.btn-ghost{background:var(--s3);color:var(--text);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--border2)}
.btn-green{background:rgba(76,175,125,.12);color:var(--green);border:1px solid rgba(76,175,125,.3)}
.btn-purple{background:rgba(157,120,232,.12);color:var(--purple);border:1px solid rgba(157,120,232,.3)}
.btn-sm{padding:5px 12px;font-size:11px}
.btn:disabled{opacity:.4;cursor:default}

/* SEARCH */
.srch-wrap{position:relative;margin-bottom:14px}
.srch-inp{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:11px 36px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:500;color:var(--text);outline:none;transition:border-color .2s;letter-spacing:.5px}
.srch-inp::placeholder{color:var(--muted2)}
.srch-inp:focus{border-color:var(--border2)}
.srch-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none}
.srch-x{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--muted);cursor:pointer;font-size:18px;background:none;border:none;line-height:1}

/* FILTERS */
.filters{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.fbtn{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1px;padding:5px 12px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;text-transform:uppercase}
.fbtn.on{background:var(--accent);color:#000;border-color:var(--accent)}

/* GROUP CARD */
.gc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px}
.gc-name{font-size:20px;font-weight:700;letter-spacing:.5px;line-height:1.1}
.gc-type{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1px;padding:3px 8px;border-radius:2px;flex-shrink:0;margin-top:3px;text-transform:uppercase}
.gc-type.open{background:rgba(76,175,125,.1);color:var(--green);border:1px solid rgba(76,175,125,.25)}
.gc-type.private{background:rgba(157,120,232,.1);color:var(--purple);border:1px solid rgba(157,120,232,.25)}
.gc-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px;font-weight:400}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
.tag{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.5px;color:var(--muted);background:var(--s3);padding:3px 7px;border-radius:2px;border:1px solid var(--border)}
.gc-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.gc-meta{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted2)}
.gc-meta strong{color:var(--muted)}

/* PLAYER CARD */
.pc-top{display:flex;gap:12px;align-items:flex-start;margin-bottom:11px}
.pc-name{font-size:16px;font-weight:700;letter-spacing:.5px;line-height:1.2}
.pc-car{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px}
.pc-city{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted2);margin-top:2px}
.pc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:11px}
.pc-stat{background:var(--s2);border:1px solid var(--border);border-radius:4px;padding:7px 4px;text-align:center}
.pc-stat-icon{font-size:9px;color:var(--muted);margin-bottom:2px}
.pc-stat-n{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:500;line-height:1;color:var(--text)}
.pc-stat-l{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:.5px;color:var(--muted2);margin-top:2px}
.pc-actions{display:flex;gap:6px;flex-wrap:wrap}

/* MAP */
.map-outer{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px;position:relative;background:var(--s1)}
.map-inner{position:relative;width:100%;height:280px}
.map-bg{position:absolute;inset:0;background:var(--s1)}
/* Road lines */
.map-roads{position:absolute;inset:0}
/* Dot */
.mdot{position:absolute;cursor:pointer;transform:translate(-50%,-50%);z-index:10}
.mdot-ring{width:12px;height:12px;border-radius:50%;position:relative;display:flex;align-items:center;justify-content:center}
.mdot-ring::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:1.5px solid currentColor;opacity:.25;animation:mping 2.5s ease-in-out infinite}
.mdot-core{width:8px;height:8px;border-radius:50%}
.mdot-label{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);background:var(--s2);border:1px solid var(--border2);color:var(--text);font-family:'JetBrains Mono',monospace;font-size:8px;padding:4px 8px;border-radius:3px;white-space:nowrap;z-index:20;pointer-events:none}
@keyframes mping{0%,100%{transform:scale(1);opacity:.25}50%{transform:scale(1.6);opacity:.08}}
.map-pdx-label{position:absolute;bottom:8px;left:10px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;color:var(--muted2);text-transform:uppercase;pointer-events:none}

/* LEADERBOARD */
.lb-row{display:flex;align-items:center;gap:10px;background:var(--s1);border:1px solid var(--border);border-radius:6px;padding:11px 13px;margin-bottom:6px;cursor:pointer;transition:border-color .15s}
.lb-row:hover{border-color:var(--border2)}
.lb-row.mine{border-color:var(--accent);background:rgba(245,197,24,.03)}
.lb-rank-n{font-family:'JetBrains Mono',monospace;font-size:18px;color:var(--muted2);width:26px;text-align:center;flex-shrink:0;line-height:1;font-weight:500}
.lb-rank-n.top{color:var(--accent)}
.lb-info{flex:1;min-width:0}
.lb-name{font-size:14px;font-weight:700;letter-spacing:.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lb-car{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-wins{text-align:right;flex-shrink:0}
.lb-wins-n{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:500;color:var(--text);line-height:1}
.lb-wins-l{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1px;color:var(--muted2);margin-top:2px}
.you-chip{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1px;color:var(--accent);border:1px solid rgba(245,197,24,.3);padding:1px 5px;border-radius:2px;background:rgba(245,197,24,.08)}

/* PROFILE */
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px}
.stat-box{background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:12px}
.stat-n{font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:500;color:var(--text);line-height:1}
.stat-l{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-top:4px}
.fmt-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}
.fmt-box{background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:11px}
.fmt-icon{font-size:12px;color:var(--muted);margin-bottom:4px}
.fmt-label{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px}
.fmt-wins-n{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:500;line-height:1}
.fmt-of{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted2)}

/* LIST ROW */
.list-row{display:flex;align-items:center;gap:10px;background:var(--s1);border:1px solid var(--border);border-radius:6px;padding:10px 13px;margin-bottom:6px;cursor:pointer;transition:border-color .15s}
.list-row:hover{border-color:var(--border2)}
.list-row-info{flex:1;min-width:0}
.list-row-name{font-size:14px;font-weight:600;letter-spacing:.3px}
.list-row-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* CHAT */
.chat-msgs{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;max-height:240px;overflow-y:auto;padding-right:2px}
.msg-row{display:flex;gap:8px}
.msg-bubble{background:var(--s2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;max-width:84%}
.msg-bubble.mine{background:var(--s3);border-color:var(--border2)}
.msg-who{font-size:11px;font-weight:700;letter-spacing:.3px;margin-bottom:3px}
.msg-text{font-size:13px;font-weight:400;line-height:1.5;color:#ccc}
.msg-time{font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--muted2);margin-top:3px}
.chat-inp-row{display:flex;gap:8px}
.chat-inp{flex:1;background:var(--s2);border:1px solid var(--border);border-radius:5px;padding:10px 12px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:500;color:var(--text);outline:none;transition:border-color .2s;letter-spacing:.3px}
.chat-inp:focus{border-color:var(--border2)}
.chat-inp::placeholder{color:var(--muted2)}

/* MISC */
.rule{height:1px;background:var(--border);margin:14px 0}
.back-btn{display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--muted);cursor:pointer;margin-bottom:16px;text-transform:uppercase;background:none;border:none}
.back-btn:hover{color:var(--text)}
.empty-state{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--muted2);padding:24px 0;text-align:center}
.fade{animation:fu .2s ease both}
@keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.sheet{background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:10px}
`;

/* ─── TIER BADGE COMPONENT ────────────────────────────────────────── */
function TierBadge({ wins, size="sm" }) {
  const t = getTier(wins);
  const small = size==="sm";
  return (
    <span className="tier-badge" style={{
      background: t.bg, color: t.color, border:`1px solid ${t.border}`,
      fontSize: small?8:10, padding: small?"2px 7px":"3px 10px"
    }}>
      <span>{t.icon}</span> {t.name.toUpperCase()}
    </span>
  );
}

/* ─── APP ────────────────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState("Groups");
  const [groups, setGroups] = useState(INIT_GROUPS);
  const [friends, setFriends] = useState(["u2","u3"]);
  const [friendReqs, setFriendReqs] = useState([]);
  const [groupReqs, setGroupReqs] = useState([]);
  const [playerView, setPlayerView] = useState(null);
  const [chatGroupId, setChatGroupId] = useState(null);

  const isFriend = id => friends.includes(id);
  const sentFR   = id => friendReqs.includes(id);
  const addFR    = id => { if (!sentFR(id)) setFriendReqs(r=>[...r,id]); };

  const isInGroup = gid => groups.find(g=>g.id===gid)?.memberIds.includes("u1");
  const sentGR    = gid => groupReqs.includes(gid);
  const joinGroup = gid => setGroups(gs=>gs.map(g=>g.id===gid&&!g.memberIds.includes("u1")?{...g,memberIds:[...g.memberIds,"u1"]}:g));
  const reqGroup  = gid => { if (!sentGR(gid)) setGroupReqs(r=>[...r,gid]); };

  const openPlayer = id => { setPlayerView(id); };
  const closePlayer = () => setPlayerView(null);

  const showNav = !playerView && !chatGroupId;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Header />
        <div className="content fade" key={tab+playerView+chatGroupId}>
          {playerView ? (
            <PlayerProfileView playerId={playerView} onBack={closePlayer}
              isFriend={isFriend} sentFR={sentFR} addFR={addFR}
              groups={groups} isInGroup={isInGroup} sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup} openPlayer={openPlayer} />
          ) : chatGroupId ? (
            <ChatView groupId={chatGroupId} groups={groups} setGroups={setGroups} onBack={()=>setChatGroupId(null)} openPlayer={openPlayer} />
          ) : tab==="Groups" ? (
            <GroupsView groups={groups} isInGroup={isInGroup} sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup} openChat={setChatGroupId} />
          ) : tab==="Search" ? (
            <SearchView isFriend={isFriend} sentFR={sentFR} addFR={addFR} openPlayer={openPlayer}
              groups={groups} isInGroup={isInGroup} sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup} />
          ) : tab==="Map" ? (
            <MapView groups={groups} openPlayer={openPlayer} />
          ) : tab==="Ranks" ? (
            <RanksView openPlayer={openPlayer} />
          ) : (
            <ProfileView friends={friends} groups={groups} openPlayer={openPlayer} />
          )}
        </div>
        {showNav && (
          <nav className="nav">
            {[["Groups","◈"],["Search","⊕"],["Map","◎"],["Ranks","↑"],["Profile","◉"]].map(([name,icon])=>(
              <div key={name} className={`ni ${tab===name?"on":""}`} onClick={()=>setTab(name)}>
                <span className="ni-icon">{icon}</span>{name}
              </div>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}

/* ─── HEADER ─────────────────────────────────────────────────────── */
function Header() {
  const myWins = tw(ME.wins);
  return (
    <div className="hdr">
      <div className="logo">0X<span>RACE</span></div>
      <div className="logo-sub">Powered by 0xDrive</div>
      <div className="me-row">
        <div className="av s32 me">{ME.avatar}</div>
        <div style={{flex:1}}>
          <div className="me-name-text">{ME.name}</div>
          <div className="me-car-text">{ME.year} {ME.car}</div>
        </div>
        <TierBadge wins={myWins} />
      </div>
    </div>
  );
}

/* ─── GROUPS ─────────────────────────────────────────────────────── */
function GroupsView({ groups, isInGroup, sentGR, joinGroup, reqGroup, openChat }) {
  return (
    <div>
      <div className="pg-title">Groups</div>
      <div className="pg-sub">Find your crew · Portland, OR</div>
      {groups.map(g=>(
        <GroupCard key={g.id} g={g} isIn={isInGroup(g.id)} sentReq={sentGR(g.id)}
          onJoin={()=>g.type==="open"?joinGroup(g.id):reqGroup(g.id)}
          onChat={()=>openChat(g.id)} />
      ))}
    </div>
  );
}

function GroupCard({ g, isIn, sentReq, onJoin, onChat }) {
  return (
    <div className="card">
      <div className="gc-head">
        <div className="gc-name">{g.name}</div>
        <div className={`gc-type ${g.type}`}>{g.type==="private"?"Private":"Open"}</div>
      </div>
      <div className="gc-desc">{g.desc}</div>
      <div className="tags">{g.tags.map(t=><span key={t} className="tag">{t}</span>)}</div>
      <div className="gc-foot">
        <div className="gc-meta"><strong>{g.memberIds.length}</strong>/{g.max} members · {g.lastActive}</div>
        <div style={{display:"flex",gap:6}}>
          {isIn && <button className="btn btn-ghost btn-sm" onClick={onChat}>Chat →</button>}
          {!isIn && !sentReq && <button className="btn btn-accent btn-sm" onClick={onJoin}>{g.type==="open"?"Join":"Request"}</button>}
          {!isIn && sentReq && <button className="btn btn-purple btn-sm" disabled>{g.type==="open"?"Joined":"Pending"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ─── SEARCH ─────────────────────────────────────────────────────── */
function SearchView({ isFriend, sentFR, addFR, openPlayer, groups, isInGroup, sentGR, joinGroup, reqGroup }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("Players");

  const players = ALL_PLAYERS.filter(p=>!q ||
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.car.toLowerCase().includes(q.toLowerCase()) ||
    p.city.toLowerCase().includes(q.toLowerCase())
  );

  const filteredGroups = groups.filter(g=>!q ||
    g.name.toLowerCase().includes(q.toLowerCase()) ||
    g.tags.some(t=>t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <div className="pg-title">Search</div>
      <div className="pg-sub">Find players & groups</div>

      <div className="srch-wrap">
        <span className="srch-icon">⊕</span>
        <input className="srch-inp" placeholder={mode==="Players"?"Search name, car, city…":"Search groups…"}
          value={q} onChange={e=>setQ(e.target.value)} />
        {q&&<button className="srch-x" onClick={()=>setQ("")}>×</button>}
      </div>

      <div className="filters">
        {["Players","Groups"].map(m=>(
          <button key={m} className={`fbtn ${mode===m?"on":""}`} onClick={()=>setMode(m)}>{m}</button>
        ))}
      </div>

      {mode==="Players" && (
        players.length===0
          ? <div className="empty-state">No players found</div>
          : players.map(p=>(
            <PlayerCard key={p.id} player={p} isFriend={isFriend(p.id)} sentFR={sentFR(p.id)}
              onFriend={e=>{e.stopPropagation();addFR(p.id);}} onView={()=>openPlayer(p.id)} />
          ))
      )}

      {mode==="Groups" && (
        filteredGroups.length===0
          ? <div className="empty-state">No groups found</div>
          : filteredGroups.map(g=>(
            <GroupCard key={g.id} g={g} isIn={isInGroup(g.id)} sentReq={sentGR(g.id)}
              onJoin={()=>g.type==="open"?joinGroup(g.id):reqGroup(g.id)} onChat={()=>{}} />
          ))
      )}
    </div>
  );
}

function PlayerCard({ player, isFriend, sentFR, onFriend, onView }) {
  const totalW = tw(player.wins);
  const ranks = computeRanks();
  const rank = ranks.find(r=>r.id===player.id)?.rank??99;
  return (
    <div className="card click" onClick={onView}>
      <div className="pc-top">
        <div className="av s40">{player.avatar}</div>
        <div style={{flex:1}}>
          <div className="pc-name">{player.name}</div>
          <div className="pc-car">{player.year} {player.car}</div>
          <div className="pc-city">📍 {player.city}</div>
          <div style={{marginTop:5,display:"flex",gap:6,alignItems:"center"}}>
            <TierBadge wins={totalW} />
            <span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:"var(--muted)"}}>#{rank} GLOBAL</span>
          </div>
        </div>
      </div>
      <div className="pc-stats">
        {FORMAT.map(f=>(
          <div key={f.key} className="pc-stat">
            <div className="pc-stat-icon">{f.icon}</div>
            <div className="pc-stat-n">{player.wins[f.key]}</div>
            <div className="pc-stat-l">{f.short}</div>
          </div>
        ))}
      </div>
      <div className="pc-actions" onClick={e=>e.stopPropagation()}>
        {!isFriend&&!sentFR&&<button className="btn btn-accent btn-sm" onClick={onFriend}>+ Friend</button>}
        {!isFriend&&sentFR&&<button className="btn btn-ghost btn-sm" disabled>Sent</button>}
        {isFriend&&<span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ Friends</span>}
        <button className="btn btn-outline btn-sm" onClick={onView}>Profile →</button>
      </div>
    </div>
  );
}

/* ─── PLAYER PROFILE ─────────────────────────────────────────────── */
function PlayerProfileView({ playerId, onBack, isFriend, sentFR, addFR, groups, isInGroup, sentGR, joinGroup, reqGroup }) {
  const p = getP(playerId);
  if (!p) return null;
  const isMe = playerId==="u1";
  const totalW = tw(p.wins);
  const playerGroups = groups.filter(g=>g.memberIds.includes(playerId));

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="sheet">
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16}}>
          <div className={`av s56 ${isMe?"me":""}`}>{p.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:24,fontWeight:700,letterSpacing:1,lineHeight:1}}>{p.name}</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"var(--muted)",marginTop:4}}>{p.year} {p.car}</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"var(--muted2)",marginTop:3}}>📍 {p.city}</div>
            <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:"var(--muted)"}}>#{p.rank} GLOBAL · {totalW}W</span>
            </div>
          </div>
        </div>

        {!isMe&&(
          <div style={{display:"flex",gap:7,marginBottom:14}}>
            {!isFriend(playerId)&&!sentFR(playerId)&&<button className="btn btn-accent" onClick={()=>addFR(playerId)}>+ Add Friend</button>}
            {!isFriend(playerId)&&sentFR(playerId)&&<button className="btn btn-ghost" disabled>Request Sent</button>}
            {isFriend(playerId)&&<span className="btn btn-green" style={{cursor:"default"}}>✓ Friends</span>}
          </div>
        )}

        <div className="rule"/>
        <div className="sec-lbl">Race Stats</div>
        <div className="fmt-grid" style={{marginBottom:0}}>
          {FORMAT.map(f=>(
            <div key={f.key} className="fmt-box">
              <div className="fmt-icon">{f.icon}</div>
              <div className="fmt-label">{f.label}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                <div className="fmt-wins-n">{p.wins[f.key]}</div>
                <div className="fmt-of">/ {p.races[f.key]}</div>
              </div>
            </div>
          ))}
        </div>

        {playerGroups.length>0&&(<>
          <div className="rule"/>
          <div className="sec-lbl">Groups ({playerGroups.length})</div>
          {playerGroups.map(g=>(
            <div key={g.id} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:6,padding:"10px 13px",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,letterSpacing:.5}}>{g.name}</div>
                <div className={`gc-type ${g.type}`} style={{marginTop:4,display:"inline-block"}}>{g.type}</div>
              </div>
              {!isMe&&(
                isInGroup(g.id)
                  ? <span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ In</span>
                  : sentGR(g.id)
                    ? <span className="btn btn-purple btn-sm" style={{cursor:"default"}}>Pending</span>
                    : <button className="btn btn-accent btn-sm" onClick={()=>g.type==="open"?joinGroup(g.id):reqGroup(g.id)}>{g.type==="open"?"Join":"Request"}</button>
              )}
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}

/* ─── CHAT ────────────────────────────────────────────────────────── */
function ChatView({ groupId, groups, setGroups, onBack, openPlayer }) {
  const g = groups.find(x=>x.id===groupId);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[g?.messages.length]);

  const send = () => {
    if (!input.trim()) return;
    setGroups(gs=>gs.map(x=>x.id===groupId?{...x,messages:[...x.messages,{uid:"u1",text:input.trim(),time:"just now"}]}:x));
    setInput("");
  };

  if (!g) return null;
  const members = g.memberIds.map(id=>getP(id)).filter(Boolean);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Groups</button>
      <div style={{fontSize:22,fontWeight:700,letterSpacing:1,marginBottom:2}}>{g.name}</div>
      <div className="pg-sub" style={{marginBottom:16}}>{g.type.toUpperCase()} · {g.memberIds.length} MEMBERS</div>

      <div className="sec-lbl">Members</div>
      {members.map(m=>(
        <div key={m.id} className="list-row" onClick={()=>openPlayer(m.id)}>
          <div className={`av s32 ${m.id==="u1"?"me":""}`}>{m.avatar}</div>
          <div className="list-row-info">
            <div className="list-row-name">{m.name}{m.id==="u1"&&<span style={{fontFamily:"JetBrains Mono",fontSize:7,letterSpacing:1,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
            <div className="list-row-sub">{m.car} · {tw(m.wins)} wins</div>
          </div>
          <TierBadge wins={tw(m.wins)} />
        </div>
      ))}

      <div className="rule"/>
      <div className="sec-lbl">Group Chat</div>
      <div className="chat-msgs">
        {g.messages.length===0&&<div className="empty-state">No messages yet.</div>}
        {g.messages.map((msg,i)=>{
          const sender=getP(msg.uid);
          const mine=msg.uid==="u1";
          return (
            <div key={i} className="msg-row">
              <div className={`av s24 ${mine?"me":""}`}>{sender?.avatar}</div>
              <div className={`msg-bubble ${mine?"mine":""}`}>
                <div className="msg-who">{sender?.name}</div>
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
        <button className="btn btn-accent" onClick={send}>Send</button>
      </div>
    </div>
  );
}

/* ─── MAP ─────────────────────────────────────────────────────────── */
function MapView({ groups, openPlayer }) {
  const [hov, setHov] = useState(null);
  const myGroups = groups.filter(g=>g.memberIds.includes("u1"));
  const visibleIds = [...new Set(myGroups.flatMap(g=>g.memberIds))];
  const allPlayersWithMe = [{...ME,id:"u1",lat:ME.lat,lng:ME.lng},...ALL_PLAYERS];
  const dots = allPlayersWithMe.filter(p=>visibleIds.includes(p.id));

  return (
    <div>
      <div className="pg-title">Live Map</div>
      <div className="pg-sub">Group member locations · Portland metro</div>

      <div className="map-outer">
        <div className="map-inner">
          <div className="map-bg"/>
          {/* SVG road grid representing Portland */}
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.18}} viewBox="0 0 400 280" preserveAspectRatio="none">
            {/* Major roads */}
            <line x1="0" y1="140" x2="400" y2="140" stroke="#888" strokeWidth="2"/>
            <line x1="200" y1="0" x2="200" y2="280" stroke="#888" strokeWidth="2"/>
            <line x1="0" y1="70" x2="400" y2="70" stroke="#666" strokeWidth="1.5"/>
            <line x1="0" y1="210" x2="400" y2="210" stroke="#666" strokeWidth="1.5"/>
            <line x1="100" y1="0" x2="100" y2="280" stroke="#666" strokeWidth="1.5"/>
            <line x1="300" y1="0" x2="300" y2="280" stroke="#666" strokeWidth="1.5"/>
            {/* Diagonals / freeways */}
            <line x1="0" y1="280" x2="400" y2="0" stroke="#aaa" strokeWidth="2.5"/>
            <line x1="0" y1="0" x2="280" y2="280" stroke="#999" strokeWidth="1.5"/>
            <line x1="140" y1="0" x2="400" y2="200" stroke="#777" strokeWidth="1"/>
            {/* Small streets */}
            {[35,105,175,245,315].map(y=>(
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#555" strokeWidth=".5"/>
            ))}
            {[50,150,250,350].map(x=>(
              <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="#555" strokeWidth=".5"/>
            ))}
            {/* Willamette River */}
            <path d="M 210 0 C 220 70, 195 140, 215 210, 205 280" stroke="#1a4a6a" strokeWidth="6" fill="none" opacity="2"/>
          </svg>

          {dots.map(p=>{
            const pos = latLngToXY(p.lat, p.lng);
            const color = DOT_COLORS[p.id] || "#888";
            const isMe = p.id==="u1";
            return (
              <div key={p.id} className="mdot"
                style={{left:`${pos.x}%`, top:`${pos.y}%`, color}}
                onMouseEnter={()=>setHov(p.id)} onMouseLeave={()=>setHov(null)}
                onClick={()=>openPlayer(p.id)}>
                <div className="mdot-ring" style={{color}}>
                  <div className="mdot-core" style={{background:color, outline: isMe?`2px solid ${color}`:undefined, outlineOffset:isMe?2:undefined}}/>
                </div>
                {hov===p.id&&(
                  <div className="mdot-label">{p.name} · {p.car}</div>
                )}
              </div>
            );
          })}

          <div className="map-pdx-label">Portland Metro · OR</div>
        </div>
      </div>

      {dots.length===0 ? (
        <div className="empty-state">Join a group to see member locations</div>
      ) : (
        <>
          <div className="sec-lbl">{dots.length} Members Visible</div>
          {dots.map((p,i)=>{
            const isMe = p.id==="u1";
            const dist = isMe ? null : (0.8+i*1.7).toFixed(1);
            return (
              <div key={p.id} className="list-row" onClick={()=>openPlayer(p.id)}>
                <div style={{width:8,height:8,borderRadius:"50%",background:DOT_COLORS[p.id]||"#888",flexShrink:0}}/>
                <div className="list-row-info">
                  <div className="list-row-name">{p.name}{isMe&&<span style={{fontFamily:"JetBrains Mono",fontSize:7,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
                  <div className="list-row-sub">{p.car} · {p.city}</div>
                </div>
                <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"var(--muted)",flexShrink:0}}>
                  {isMe?"📍 You":`${dist}mi`}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ─── RANKS ───────────────────────────────────────────────────────── */
function RanksView({ openPlayer }) {
  const [period, setPeriod] = useState("All Time");
  const [fmt, setFmt] = useState("Total");

  const getW = p => {
    if (fmt==="Total") return tw(p.wins);
    const k = fmt==="H2H"?"h2h":fmt==="Group"?"group":fmt==="Trial"?"trial":"drag";
    return p.wins[k]??0;
  };

  const allPlayers = [{...ME,id:"u1"},...ALL_PLAYERS];
  const sorted = allPlayers.map(p=>({p,w:getW(p),isMe:p.id==="u1"})).sort((a,b)=>b.w-a.w);

  // Tier breakdown counts
  const tierCounts = TIERS.map(t=>({
    ...t, count: allPlayers.filter(p=>tw(p.wins)>=t.min&&tw(p.wins)<=t.max).length
  })).filter(t=>t.count>0);

  return (
    <div>
      <div className="pg-title">Rankings</div>
      <div className="pg-sub">Global leaderboard · all players</div>

      {/* Tier legend */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
        {TIERS.slice(1).map(t=>(
          <div key={t.name} style={{display:"flex",alignItems:"center",gap:5,background:"var(--s2)",border:`1px solid ${t.border}`,borderRadius:4,padding:"4px 9px"}}>
            <span style={{color:t.color,fontSize:10}}>{t.icon}</span>
            <span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:t.color,textTransform:"uppercase"}}>{t.name}</span>
            <span style={{fontFamily:"JetBrains Mono",fontSize:7,color:"var(--muted2)"}}>≥{t.min}W</span>
          </div>
        ))}
      </div>

      <div className="filters">
        {["All Time","Monthly","Weekly"].map(v=>(
          <button key={v} className={`fbtn ${period===v?"on":""}`} onClick={()=>setPeriod(v)}>{v}</button>
        ))}
      </div>
      <div className="filters">
        {["Total","H2H","Group","Trial","Drag"].map(v=>(
          <button key={v} className={`fbtn ${fmt===v?"on":""}`} onClick={()=>setFmt(v)}>{v}</button>
        ))}
      </div>

      {sorted.map((entry,i)=>{
        const tier = getTier(tw(entry.p.wins));
        return (
          <div key={entry.p.id} className={`lb-row ${entry.isMe?"mine":""}`} onClick={()=>openPlayer(entry.p.id)}>
            <div className={`lb-rank-n ${i<3?"top":""}`}>{i+1}</div>
            <div className={`av s32 ${entry.isMe?"me":""}`}>{entry.p.avatar}</div>
            <div className="lb-info">
              <div className="lb-name">
                {entry.p.name}
                {entry.isMe&&<span className="you-chip">YOU</span>}
                <span style={{fontFamily:"JetBrains Mono",fontSize:8,color:tier.color,letterSpacing:1}}>{tier.name.toUpperCase()}</span>
              </div>
              <div className="lb-car">{entry.p.car} · {entry.p.city}</div>
            </div>
            <div className="lb-wins">
              <div className="lb-wins-n" style={{color: i<3?tier.color:"var(--text)"}}>{entry.w}</div>
              <div className="lb-wins-l">{fmt==="Total"?"WINS":"WINS"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PROFILE ─────────────────────────────────────────────────────── */
function ProfileView({ friends, groups, openPlayer }) {
  const myGroups = groups.filter(g=>g.memberIds.includes("u1"));
  const myFriends = ALL_PLAYERS.filter(p=>friends.includes(p.id));
  const totalW = tw(ME.wins);
  const totalR = tw(ME.races);
  const tier = getTier(totalW);
  const nextTier = TIERS[TIERS.indexOf(tier)+1];
  const progress = nextTier ? ((totalW-tier.min)/(nextTier.min-tier.min))*100 : 100;

  return (
    <div>
      <div className="pg-title">Profile</div>
      <div className="pg-sub">Your driver record</div>

      <div className="sheet">
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16}}>
          <div className="av s56 me">{ME.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:700,letterSpacing:1,lineHeight:1}}>{ME.name}</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"var(--muted)",marginTop:4}}>{ME.year} {ME.car}</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:9,color:"var(--muted2)",marginTop:2}}>📍 {ME.city}</div>
            <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <TierBadge wins={totalW} />
              <span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:"var(--muted)"}}>RANK #4 GLOBAL</span>
            </div>
          </div>
        </div>

        {/* Tier progress bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:tier.color}}>{tier.name.toUpperCase()} — {totalW} WINS</span>
            {nextTier&&<span style={{fontFamily:"JetBrains Mono",fontSize:8,letterSpacing:1,color:"var(--muted2)"}}>→ {nextTier.name.toUpperCase()} at {nextTier.min}W</span>}
          </div>
          <div style={{height:3,background:"var(--s3)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(progress,100)}%`,background:tier.color,borderRadius:2,transition:"width .5s ease"}}/>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-box"><div className="stat-n">{totalW}</div><div className="stat-l">Total Wins</div></div>
          <div className="stat-box"><div className="stat-n">{totalR}</div><div className="stat-l">Races</div></div>
          <div className="stat-box"><div className="stat-n">{wr(ME.wins,ME.races)}</div><div className="stat-l">Win Rate</div></div>
          <div className="stat-box"><div className="stat-n">#4</div><div className="stat-l">Global Rank</div></div>
        </div>
      </div>

      <div className="sec-lbl" style={{marginTop:4}}>By Format</div>
      <div className="fmt-grid">
        {FORMAT.map(f=>(
          <div key={f.key} className="fmt-box">
            <div className="fmt-icon">{f.icon}</div>
            <div className="fmt-label">{f.label}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <div className="fmt-wins-n">{ME.wins[f.key]}</div>
              <div className="fmt-of">/ {ME.races[f.key]}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rule"/>
      <div className="sec-lbl">Friends ({myFriends.length})</div>
      {myFriends.length===0&&<div className="empty-state" style={{textAlign:"left",padding:"10px 0"}}>No friends yet — use Search to find players.</div>}
      {myFriends.map(p=>(
        <div key={p.id} className="list-row" onClick={()=>openPlayer(p.id)}>
          <div className="av s32">{p.avatar}</div>
          <div className="list-row-info">
            <div className="list-row-name">{p.name}</div>
            <div className="list-row-sub">{p.car} · {tw(p.wins)}W</div>
          </div>
          <TierBadge wins={tw(p.wins)} />
        </div>
      ))}

      <div className="rule"/>
      <div className="sec-lbl">My Groups ({myGroups.length})</div>
      {myGroups.length===0&&<div className="empty-state" style={{textAlign:"left",padding:"10px 0"}}>No groups joined yet.</div>}
      {myGroups.map(g=>(
        <div key={g.id} style={{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:6,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,letterSpacing:.5}}>{g.name}</div>
            <div style={{fontFamily:"JetBrains Mono",fontSize:8,color:"var(--muted)",marginTop:3}}>{g.memberIds.length}/{g.max} members · {g.lastActive}</div>
          </div>
          <div className={`gc-type ${g.type}`}>{g.type}</div>
        </div>
      ))}
    </div>
  );
}
