import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AgoraRTC from "agora-rtc-sdk-ng";
import AuthPage from "./components/AuthPage.jsx";
import LandingPage from "./components/LandingPage.jsx";
import logoImg from "./assets/logo.png";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;

const GFONTS = `@import url('https://fonts.cdnfonts.com/css/pricedown');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');`;

/* ─── RANK TIERS ────────────────────────────────────────── */
// Points-based rank system: earn points through activity
const TIERS = [
  { name:"Unranked", min:0,  max:24,  color:"#555",    bg:"#1a1a1a", border:"#2a2a2a", icon:"—" },
  { name:"Bronze",   min:25, max:39,  color:"#CD7F32", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Silver",   min:40, max:74,  color:"#C0C0C0", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Gold",     min:75, max:99,  color:"#f59e0b", bg:"#1a1a1a", border:"#2a2a2a", icon:"⬡" },
  { name:"Diamond",  min:100,max:Infinity, color:"#a78bfa", bg:"#1a1a1a", border:"#2a2a2a", icon:"◆" },
];
// Points earned per action:
// Create group: 5pts | Join lobby: 3pts | Send chat message: 1pt
// Add friend: 2pts  | Record a time: 3pts | Report a win: 5pts
const getTier = (pts) => TIERS.find(t => pts >= t.min && pts <= t.max) || TIERS[0];

const FORMAT = [
  {key:"h2h",  label:"Roll Races",     short:"Roll",    icon:"🏁"},
  {key:"group",label:"Drag",           short:"Drag",    icon:"⚡"},
  {key:"trial",label:"Time Trial",     short:"Trial",   icon:"◎", comingSoon: true},
  {key:"drag", label:"Lobbies Joined", short:"Lobbies", icon:"📡", isLobbies: true},
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

const MOD_CATEGORIES = [
  { label:"Engine",        mods:["Cold Air Intake","Short Ram Intake","Turbo Kit","Supercharger","Bigger Turbo","Intercooler Upgrade","Fuel Injectors","Fuel Pump Upgrade","Tune / ECU Flash","Headers","High Flow Cats","Throttle Body Upgrade","Intake Manifold","Camshaft Upgrade","Forged Internals","Nitrous Kit","Methanol Injection","Oil Catch Can","Port & Polish"] },
  { label:"Exhaust",       mods:["Cat-Back Exhaust","Axle-Back Exhaust","Downpipe","Midpipe","Test Pipes / Decat","Muffler Delete","X-Pipe","H-Pipe","Valved Exhaust","Custom Exhaust"] },
  { label:"Forced Induction", mods:["Blow-Off Valve","Wastegate","Boost Controller","Charge Pipe Upgrade","Intercooler Piping","Sequential Turbos"] },
  { label:"Suspension",    mods:["Coilovers","Lowering Springs","Air Suspension","Adjustable Dampers","Front Sway Bar","Rear Sway Bar","Strut Tower Brace","Control Arms","Camber Kit","Toe Links","Subframe Brace"] },
  { label:"Brakes",        mods:["Big Brake Kit","Slotted Rotors","Drilled Rotors","Performance Brake Pads","Stainless Brake Lines","Upgraded Brake Fluid","Brake Duct Kit"] },
  { label:"Wheels & Tires",mods:["Aftermarket Wheels","Performance Tires","Track Tires","Wheel Spacers","Wider Wheels","Stretched Fitment","Lug Nut Upgrade"] },
  { label:"Exterior",      mods:["Front Splitter / Lip","Rear Diffuser","Side Skirts","Wing / Spoiler","Carbon Fiber Hood","Carbon Fiber Trunk","Widebody Kit","Body Kit","Fender Flares","Full Wrap","Custom Paint","Tinted Windows","Clear Bra / PPF","Painted Calipers","Headlight Tint"] },
  { label:"Interior",      mods:["Racing Seats","Roll Cage","Harness Bar","5-Point Harness","Racing Steering Wheel","Short Shifter","Shift Knob","Carbon Fiber Trim","Alcantara","Gauges / A-Pillar Pod","Fire Suppression","Stripped Interior","Racing Pedals"] },
  { label:"Electronics",   mods:["Aftermarket Head Unit","Subwoofer","Amplifier","Upgraded Speakers","Dashcam","Launch Control","Traction Control Delete","ABS Delete","Data Logger","Standalone ECU"] },
  { label:"Cooling",       mods:["Upgraded Radiator","Oil Cooler","Transmission Cooler","Fan Upgrade","Thermal Wrap","Heat Shield"] },
];

// Car-specific popular mods. Key = "make|model" (lowercase, trimmed).
const CAR_POPULAR_MODS = {
  // ── HONDA ────────────────────────────────────────────────────────────────
  "honda|civic":        ["K-Swap (K20/K24)","B-Swap (B16/B18)","Hondata FlashPro","Hondata K-Pro","K20C1 Type R Swap","Skunk2 Intake Manifold","DC Sports Headers","Toda Racing Camshafts","ITB Conversion","LSD Upgrade (Helical/Plated)","Mugen Exhaust","RPF1 Wheels","Buddy Club Coilovers","Hardrace Suspension","Spoon Sports Parts","Type R Front Conversion"],
  "honda|s2000":        ["Kraftwerks Supercharger","Rotrex Supercharger","F22 Head Swap","ITB Conversion","Toda Racing Camshafts","Skunk2 Parts","Wilwood Big Brake Kit","Fortune Auto Coilovers","Hard Dog Roll Bar","AP2 → AP1 Conversion","Mugen Parts","HKS Hi-Power Exhaust","Comptech Supercharger"],
  "honda|integra":      ["B18C Type R Engine","K-Swap (K20)","DC2 ITR Conversion","Hondata S300","LSD (Helical/Plated)","Skunk2 Stage 2 Cam","DC Sports Headers","Mugen Wing","Spoon Monoball Kit","Type R Suspension"],
  "honda|accord":       ["H22A Swap","K24 Upgrade","J37 V6 Swap","Hondata FlashPro","Mugen Parts","Spoon N1 Damper","Skunk2 Coilovers"],
  "honda|nsx":          ["C30A → C32B Upgrade","ITB Conversion","Supercharger (Comptech)","Big Brake Kit","Tein Coilovers","Enkei / BBS Wheels","Spoon Sports Parts"],
  "honda|crx":          ["B16A Swap","B18C Swap","VTEC Conversion","Mugen Parts","Solo Werks Coilovers","DC Sports Headers"],
  "honda|fit":          ["L15 Turbo Kit","Hondata FlashPro","Mugen Parts","Skunk2 Intake","Tein Coilovers"],
  // ── ACURA ────────────────────────────────────────────────────────────────
  "acura|integra":      ["B18C Type R Engine","K-Swap (K20)","Hondata S300","LSD Upgrade","DC Sports Headers","Skunk2 Cam","Mugen Wing"],
  "acura|rsx":          ["K20A2 Upgrade","K24 Stroke Kit","Type S → Type R Cam","Hondata K-Pro","Mugen Parts","DC Sports Exhaust"],
  "acura|nsx":          ["C32B Upgrade","ITB Conversion","Supercharger","Willwood Brakes","Spoon Parts","Tein Coilovers"],
  "acura|tl":           ["J37 Swap","Forced Induction Kit","SH-AWD Tune","Tein Coilovers"],
  // ── SUBARU ────────────────────────────────────────────────────────────────
  "subaru|wrx":         ["Cobb AccessPort Tune","FMIC Upgrade","Perrin Intake","External Wastegate (Tial)","STI Engine Swap","Process West TMIC","Tomei Headers","Grimmspeed Parts","Killer B Oil Pickup","E85 Conversion","Blouch Dominator Turbo","APS Twin Scroll Turbo","Cosworth Pistons"],
  "subaru|sti":         ["Cobb AccessPort Tune","Closed Deck Block (Darton)","External Wastegate","Precision / Garrett Turbo","Built EJ Motor","Process West Intake","Tomei Expreme Headers","Grimmspeed Turbo Inlet","Killer B Oil Pickup","E85 Tune","STI S206/S207 Parts","Port & Polish Head"],
  "subaru|brz":         ["Vortech Supercharger","Rotrex Supercharger","Jackson Racing Supercharger","FA24 Engine Swap","KAAZ LSD","Tomei Exhaust","GReddy Exhaust","Cusco Parts","Perrin Exhaust","MFactory LSD","Radium Fuel Rail","SSD Front Sway Bar"],
  "subaru|impreza":     ["Cobb AccessPort","Perrin Intake","FMIC Upgrade","Turbo Upgrade","Grimmspeed Parts","Tein Coilovers"],
  "subaru|forester":    ["Cobb AccessPort Tune","FMIC Upgrade","Grimmspeed Parts","Perrin Intake","Lift Spacers","STI Parts"],
  "subaru|outback":     ["Cobb AccessPort Tune","Perrin Parts","Injen Intake","Rally Suspension Lift"],
  // ── MITSUBISHI ────────────────────────────────────────────────────────────
  "mitsubishi|lancer evolution": ["EcuFlash / Tactrix Tune","HKS GT2835 Turbo","AMS Intake","Full Engine Build (Wiseco/Eagle)","Tomei Expreme Ti Exhaust","Buschur Racing Parts","ETS Intercooler","Evo IX → VIII Parts","Evo X SST Tune","Perrin Exhaust"],
  "mitsubishi|eclipse": ["4G63T Swap (2G)","DSM Link Tune","HKS Turbo","Mach V Intake","Full-Race Manifold","3SX Performance Parts"],
  "mitsubishi|galant":  ["VR4 Swap","4G63T Swap","Full-Race Parts"],
  // ── TOYOTA ────────────────────────────────────────────────────────────────
  "toyota|supra":       ["Single Turbo (Precision / Garrett)","Built 2JZ","E85 Tune","2JZ-GTE Swap (NA)","Getrag → T56 Swap","Haltech / AEM ECU","Tomei Poncam Cams","HKS GT1000 Turbo","Divided Manifold / Boost Creep Fix","Supra TT IC Upgrade","Full Exhaust (Greddy/Tomei)","Greddy Radiator"],
  "toyota|gr86":        ["Vortech Supercharger","Edelbrock Supercharger","FA24 Engine Swap","KAAZ LSD","TRD Performance Parts","GReddy Exhaust","Tomei Exhaust","Tein Coilovers","Cusco Sway Bars","MFactory LSD"],
  "toyota|86":          ["Vortech Supercharger","Jackson Racing Supercharger","FA24 Swap","KAAZ LSD","Tomei Exhaust","Cusco Parts","Tein Coilovers"],
  "toyota|ae86":        ["4A-GE 20v Blacktop Swap","4A-GE Bigport Upgrade","ITB Conversion","K-Swap","SR20 Swap","Toda Racing Parts","Cusco Coilovers","TRD Parts"],
  "toyota|mr2":         ["3S-GTE Swap","Turbo Conversion (NA)","MR2Heaven Parts","Tein Coilovers","Brake Upgrade"],
  "toyota|celica":      ["3S-GTE Swap","2ZZ-GE Swap","Supercharger Kit","TRD Parts","Tein Coilovers","Full Race Suspension"],
  "toyota|corolla":     ["2ZZ Swap","1ZZ Turbo Kit","TRD Sway Bars","Full Race Suspension","Blitz Coilovers"],
  "toyota|camry":       ["2GR-FE Supercharger","V6 Swap","Cold Air Intake","Tein Coilovers"],
  "toyota|gr corolla":  ["OEM+ Tune (Ecutek)","Intake Upgrade","Exhaust Upgrade","TRD Parts","Circuit Tires","KAAZ LSD","Cusco Strut Brace"],
  "toyota|gr supra":    ["BM3 / Ecutek Tune","MMP Turbo Upgrade","Charge Pipe Upgrade","Eventuri Intake","Akrapovic Exhaust","Milltek Exhaust","KW Coilovers V3","Pure Turbos Upgrade","Intercooler Upgrade","Wagner IC"],
  // ── NISSAN ────────────────────────────────────────────────────────────────
  "nissan|240sx":       ["SR20DET Swap","KA-T (KA24 Turbo)","1JZ Swap","2JZ Swap","RB26DETT Swap","LS Swap","S15 Front Conversion","Tein / BC Racing Coilovers","Work / Enkei Wheels","Tomei LSD","ARC Intercooler","Circuit Sports Parts"],
  "nissan|silvia":      ["SR20DET Upgrade","Tomei Poncam Cams","Trust T517Z Turbo","HKS Step 2 Kit","GReddy Manifold","Cusco Coilovers","Nismo Parts","Work Meister Wheels","LS Swap"],
  "nissan|skyline":     ["RB26DETT Upgrade","Single Turbo Conversion","HKS GT2835 Twin Turbo","Tomei RB Parts","Nismo Parts","NISMO 400R Parts","Haltech ECU","Splitfire Coil Packs","Koyo Radiator","GTR Brakes"],
  "nissan|gt-r":        ["AMS / Alpha Performance Tune","Upgraded High-Flow Turbos","AMS Intake Manifold","Full Bolt-On Package","Built Motor (Cosworth)","E85 Conversion","ETS Intake","Dodson Transmission Parts","Nismo Parts","Boost Logic Parts","HKS Twin Turbos"],
  "nissan|370z":        ["Stillen Supercharger","JWT Cams","Z1 Motorsports Parts","Injen Intake","Meisterschaft Exhaust","Agency Power Parts","Stillen Sway Bars","Nismo Parts","Motordyne Exhaust"],
  "nissan|350z":        ["Stillen Supercharger","Turbo Kit (Greddy / Fast Intentions)","JWT Cams","Motordyne Plenum","Z1 Motorsports Parts","NISMO Parts","Injen Intake","Greddy Exhaust"],
  "nissan|180sx":       ["SR20DET Upgrade","Trust / HKS Turbo","Tomei Cams","GReddy Manifold","Cusco Coilovers"],
  "nissan|sentra":      ["SR20 Swap","JWT Cams","Injen Intake","Tein Coilovers"],
  // ── MAZDA ────────────────────────────────────────────────────────────────
  "mazda|rx-7":         ["Single Turbo Conversion","LS Swap (LS1/LS3)","20B Triple Rotor Swap","Peripheral Port","Bridge Port","Rebuilt Rotary Engine","RE-Amemiya Parts","Greddy / Trust Turbo","Trust Exhaust","Koyo Radiator","Mishimoto Radiator","Braille Battery"],
  "mazda|rx-8":         ["1JZ Swap","LS Swap","Engine Rebuild (High Compression)","Port Job","Mazdaspeed Parts","Tein Coilovers","Bridgestone RE71RS"],
  "mazda|mx-5":         ["Jackson Racing Supercharger","Rotrex Supercharger","LS Swap (V8 Roadster)","Flyin' Miata Parts","Hard Dog Roll Bar","Koni Yellow Shocks","Bilstein B6 Shocks","Racing Beat Exhaust","Torsen LSD Upgrade","Vorshlag Camber Plates"],
  "mazda|miata":        ["Jackson Racing Supercharger","Rotrex Supercharger","LS Swap","Flyin' Miata Parts","Hard Dog Roll Bar","Racing Beat Parts","Koni Shocks","Torsen LSD","Braille Battery"],
  "mazda|speed3":       ["CP-E Intake","Cobb AccessPort Tune","FMIC Upgrade","BOV Upgrade","Downpipe Upgrade","Agency Power Parts","Street Unit Parts"],
  "mazda|3":            ["Cobb AccessPort (Speed3)","CP-E Intake","FMIC Upgrade","Injen Intake","Tein Coilovers"],
  "mazda|6":            ["Intake Upgrade","Exhaust Upgrade","Eibach Springs","Injen Intake"],
  // ── FORD ─────────────────────────────────────────────────────────────────
  "ford|mustang":       ["Roush / Whipple Supercharger","ProCharger","Paxton Supercharger","Coyote 5.0 Swap (SN95)","JLT Cold Air Intake","Ford Performance Parts","Brembo Big Brake Kit","Borla ATAK Exhaust","BMR Suspension","Steeda Suspension","MGW Short Shifter","Shelby Parts","Saleen Parts","Long Tube Headers (Kooks/Stainless Works)","Lethal Performance Parts"],
  "ford|focus":         ["Cobb AccessPort (RS)","APR Stage 1/2 Tune (ST)","Mountune Parts","Turbosmart BOV","Milltek Exhaust","ETS Intercooler (RS)","Full-Race Turboback (RS)","Injen Intake","Steeda Suspension"],
  "ford|fiesta":        ["Mountune MP215","Cobb AccessPort Tune","Mishimoto IC","Injen Intake","Milltek Exhaust","Eibach Springs","Forge BOV"],
  "ford|gt":            ["Ford GT Track Package","Akrapovic Exhaust","Carbon Upgrades"],
  "ford|f-150":         ["Whipple Supercharger (Raptor/5.0)","Banks Power Tune","Magnaflow Exhaust","Cold Air Intake","Leveling Kit","Bilstein 5100 Shocks"],
  // ── CHEVROLET ────────────────────────────────────────────────────────────
  "chevrolet|camaro":   ["Magnuson Supercharger","ProCharger","LSA → LT4 Swap","Corsa Exhaust","SLP Exhaust","BMR Suspension","Roto-Fab Intake","Eibach Sway Bars","Lingenfelter Stage Kits","Pfadt Suspension","Long Tube Headers (Kooks)","Brembo Brake Upgrade"],
  "chevrolet|corvette": ["Magnuson / Whipple Supercharger","Camshaft Upgrade (LS3/LT1)","Long Tube Headers (Kooks/Stainless Works)","FAST / Holley Intake Manifold","Brembo Big Brake Kit","Coilover Upgrade (MagneRide Delete)","Z06 Parts on Base","Lingenfelter Stage Kits","Borla Exhaust","Billy Boat Exhaust","Braille Battery"],
  "chevrolet|silverado":["Whipple Supercharger","AFE Intake","Magnaflow Exhaust","Bilstein Shocks","Leveling Kit","Banks Power Tune"],
  "chevrolet|cobalt":   ["GM LSJ Supercharger","Injen Intake","Tein Coilovers","Full Exhaust"],
  // ── DODGE / MOPAR ────────────────────────────────────────────────────────
  "dodge|challenger":   ["Hellcat Engine Swap","Demon Parts Upgrade","Mopar Stage 1/2/3 Kit","Corsa Exhaust","Cold Air Innovations Intake","Eibach Springs","American Racing Headers","SRT Hellcat Redeye Parts","Kooks Long Tube Headers"],
  "dodge|charger":      ["Hellcat Engine Swap","Mopar Performance Parts","Corsa Exhaust","BBK Cold Air Intake","Eibach Pro Kit","American Racing Headers","Kooks Headers","SRT Widebody Parts"],
  "dodge|viper":        ["Corsa Exhaust","Borla Exhaust","Upgraded Brakes","Coilover Upgrade","Race Alignment","Carbon Fiber Parts"],
  "dodge|neon":         ["SRT-4 Swap","Boost Upgrade (SRT-4)","Injen Intake","Full Exhaust","Mopar Parts"],
  // ── BMW ───────────────────────────────────────────────────────────────────
  "bmw|m3":             ["Bootmod3 Tune","MHD Tune","JB4 Piggyback","Burger Motorsports (BMS) Intake","Eventuri Carbon Intake","Active Autowerke Exhaust","Akrapovic Exhaust","Wagner Intercooler","KW Coilovers V3","Dinan Parts","Vorsteiner Aero","ESS Supercharger","CSL Parts Swap"],
  "bmw|m4":             ["Bootmod3 Tune","MHD Tune","JB4 Piggyback","BMS Intake","Eventuri Intake","Akrapovic Exhaust","Active Autowerke Exhaust","Wagner Intercooler","KW Coilovers","Dinan Parts","Vorsteiner Carbon"],
  "bmw|m5":             ["Bootmod3 Tune","JB4 + MHD Tune","Akrapovic Exhaust","Dinan Parts","KW Coilovers","BMS Intake","Evolve Automotive Parts","Wagner Intercooler"],
  "bmw|m2":             ["MHD Tune","JB4 Piggyback","BMS Intake","Active Autowerke Exhaust","Akrapovic Exhaust","KW Coilovers","S55 Engine Swap (M2 Competition)","Dinan Parts"],
  "bmw|e36":            ["S54 Engine Swap","M50 → M52 Swap","Supercharger (Active Autowerke)","ITB Conversion","LS Swap","Ground Control Coilovers","Bilstein PSS10","Subframe Reinforcement","Race Prep"],
  "bmw|e46":            ["S54 Swap (M3 Engine)","Supercharger (Active Autowerke)","Stroker Kit","Subframe Reinforcement","LS Swap","Rogue Engineering Parts","Bimmerworld Parts","UUC Motorswerks Shifter"],
  "bmw|e92":            ["JB4 Tune","Dinan Parts","Active Autowerke Supercharger","KW Coilovers","BMS Intake","Eisenmann Exhaust"],
  "bmw|335i":           ["JB4 Tune","MHD Tune","BMS Intake","VRSF Intercooler","Active Autowerke Exhaust","KW Coilovers","Upgraded Charge Pipes","Burger Motorsports BOV"],
  "bmw|135i":           ["JB4 Tune","MHD Tune","BMS Intake","VRSF Intercooler","Upgraded Charge Pipes","KW Coilovers","Active Autowerke Exhaust"],
  // ── VOLKSWAGEN ────────────────────────────────────────────────────────────
  "volkswagen|gti":     ["APR Stage 1/2/3 Tune","Unitronic Tune","COBB Tune","EQT Tune","IS38 Turbo Upgrade","Golf R Swap Parts","Integrated Engineering Intake","Forge Diverter Valve","034 Motorsport Parts","Bilstein B8 Coilovers","Neuspeed Parts","Milltek Exhaust","Eibach Pro Kit"],
  "volkswagen|golf r":  ["APR Stage 1/2 Tune","034 Motorsport Parts","EQT Tune","Unitronic Stage 2+","Integrated Engineering Intake","Milltek Exhaust","KW Coilovers V3","Eibach Springs","Forge BOV"],
  "volkswagen|jetta":   ["APR Stage 1 Tune","034 Motorsport Parts","Neuspeed Parts","Milltek Exhaust","Eibach Lowering Springs","Forge BOV"],
  "volkswagen|golf":    ["APR Tune","IE Intake","Milltek Exhaust","Eibach Springs","034 Parts"],
  // ── AUDI ─────────────────────────────────────────────────────────────────
  "audi|s3":            ["APR Stage 1/2/3 Tune","034 Motorsport Parts","Unitronic Tune","COBB Tune","Integrated Engineering Intake","Milltek Exhaust","KW Coilovers","Forge Motorsport Parts","Wagner Intercooler","IS38 Turbo"],
  "audi|rs3":           ["APR Tune","034 Motorsport Parts","Milltek Exhaust","Wagner Intercooler","KW Coilovers","Eventuri Intake"],
  "audi|tt":            ["APR Stage 1/2 Tune","034 Motorsport Parts","Milltek Exhaust","KW Coilovers","Forge Motorsport BOV","IS38 Swap (TTRS)"],
  "audi|s4":            ["APR Tune","Unitronic Tune","034 Motorsport Intake","Milltek Exhaust","KW Coilovers","Forge BOV","Supercharger Pulley Upgrade"],
  "audi|rs4":           ["APR Tune","034 Motorsport Parts","Milltek Exhaust","KW Coilovers","Eventuri Intake","Racechip Tune"],
  "audi|r8":            ["APR Tune","Akrapovic Exhaust","Eventuri Intake","034 Motorsport Parts","KW Coilovers","Race Exhaust"],
  // ── PORSCHE ───────────────────────────────────────────────────────────────
  "porsche|911":        ["Sharkwerks Exhaust","Akrapovic Exhaust","Manthey Racing Parts","Porsche Motorsport Parts","Öhlins Coilovers","PASM Lowering Springs","Cup Car Parts","PDK Tune","HJS Sport Cat","Eventuri Intake"],
  "porsche|cayman":     ["Porsche Motorsport Parts","Akrapovic Exhaust","Öhlins Coilovers","Cup Car Conversion","Renntech Parts","Sport Exhaust"],
  "porsche|boxster":    ["Akrapovic Exhaust","Öhlins Coilovers","Porsche Sport Exhaust","Cup Car Parts"],
  "porsche|cayenne":    ["Techart Parts","Akrapovic Exhaust","Bilstein B6 Suspension","APR Tune"],
  // ── MERCEDES-BENZ ────────────────────────────────────────────────────────
  "mercedes-benz|amg c63": ["Renntech Tune","Kleinmann Supercharger","Brabus Parts","Akrapovic Exhaust","KW Coilovers","BMS Intake","Evolve Parts"],
  "mercedes-benz|amg a45": ["Renntech Tune","Weistec Parts","Akrapovic Exhaust","Milltek Exhaust","KW Coilovers","Eventuri Intake","ETS Intercooler"],
  "mercedes-benz|amg gt": ["Renntech Tune","Brabus Parts","Akrapovic Exhaust","Öhlins Coilovers","Carbon Fiber Parts"],
  "mercedes-benz|c63":  ["Renntech Tune","Akrapovic Exhaust","KW Coilovers","BMS Intake"],
  // ── LEXUS ────────────────────────────────────────────────────────────────
  "lexus|is":           ["TRD Parts","2JZ Swap","1JZ Swap","Injen Intake","Tein Coilovers","Tomei Exhaust","BC Racing Coilovers"],
  "lexus|gs":           ["2JZ Swap","Supercharger (Magnuson)","Tein Coilovers","Injen Intake"],
  "lexus|lfa":          ["Akrapovic Exhaust","Track Prep","Öhlins Coilovers"],
  "lexus|rc":           ["TRD Parts","Injen Intake","Tein Coilovers","Exhaust Upgrade"],
  // ── GENESIS / HYUNDAI ────────────────────────────────────────────────────
  "hyundai|veloster":   ["Agency Power Parts","Cobb AccessPort (N)","Intake Upgrade","Milltek Exhaust","Eibach Springs","EQT Tune (N)"],
  "hyundai|elantra":    ["Cobb AccessPort (N)","EQT Tune (N)","IE Intake","Milltek Exhaust","Bilstein B8 Coilovers"],
  "genesis|g70":        ["Agency Power Parts","Injen Intake","Exhaust Upgrade","Bilstein Coilovers"],
  // ── INFINITI ─────────────────────────────────────────────────────────────
  "infiniti|g35":       ["JWT Cams","Stillen Supercharger","Nismo Parts","Z1 Motorsports Parts","Motordyne Plenum","Injen Intake","Meisterschaft Exhaust"],
  "infiniti|g37":       ["JWT Cams","Stillen Supercharger","Z1 Motorsports Parts","Injen Intake","Meisterschaft Exhaust","Nismo Parts"],
  // ── CADILLAC ─────────────────────────────────────────────────────────────
  "cadillac|cts-v":     ["Magnuson Supercharger","Lingenfelter Parts","Corsa Exhaust","Eibach Springs","KW Coilovers","Brembo Upgrade"],
  "cadillac|ats-v":     ["Magnuson Supercharger","Lingenfelter Parts","Corsa Exhaust","KW Coilovers"],
  // ── ALFA ROMEO ───────────────────────────────────────────────────────────
  "alfa romeo|giulia":  ["Ragazzon Exhaust","Akrapovic Exhaust","Novitec Parts","KW Coilovers","Intake Upgrade"],
  "alfa romeo|4c":      ["Akrapovic Exhaust","Intercooler Upgrade","Intake Upgrade","Öhlins Coilovers"],
};

// Fallback popular mods by make only
const MAKE_POPULAR_MODS = {
  "honda":         ["VTEC Conversion","K-Swap","B-Swap","Hondata Tune","Mugen Parts","Skunk2 Parts","DC Sports Headers","ITB Conversion"],
  "acura":         ["K-Swap","Hondata Tune","LSD Upgrade","DC Sports Headers","Mugen Parts","Skunk2 Parts"],
  "subaru":        ["Cobb AccessPort Tune","FMIC Upgrade","Perrin Parts","Tomei Parts","Grimmspeed Parts","E85 Conversion"],
  "mitsubishi":    ["EcuFlash Tune","HKS Turbo Upgrade","Brembo Upgrade","Tomei Parts","AMS Intake"],
  "toyota":        ["TRD Performance Parts","Tomei Parts","GReddy Parts","Tein Coilovers","KAAZ LSD"],
  "lexus":         ["TRD Parts","Tein Coilovers","Tomei Exhaust","Injen Intake","2JZ / 1JZ Swap"],
  "nissan":        ["JWT Tune","Nismo Parts","Z1 Motorsports Parts","Greddy Parts","Tomei Parts"],
  "infiniti":      ["JWT Cams","Z1 Motorsports Parts","Stillen Parts","Motordyne Parts","Nismo Parts"],
  "mazda":         ["Mazdaspeed Parts","Racing Beat Parts","Tein Coilovers","Trust / GReddy Parts","Flyin' Miata Parts"],
  "ford":          ["Ford Performance Parts","Steeda Parts","ProCharger","Borla Exhaust","Kooks Headers"],
  "chevrolet":     ["Lingenfelter Parts","Magnuson Supercharger","Corsa Exhaust","BMR Suspension","Kooks Headers"],
  "dodge":         ["Mopar Performance Parts","Corsa Exhaust","American Racing Headers","Kooks Headers"],
  "bmw":           ["MHD / Bootmod3 Tune","Dinan Parts","KW Coilovers","Akrapovic Exhaust","BMS Intake"],
  "volkswagen":    ["APR Tune","034 Motorsport","Neuspeed Parts","Milltek Exhaust","Forge BOV"],
  "audi":          ["APR Tune","034 Motorsport","Milltek Exhaust","KW Coilovers","Eventuri Intake"],
  "porsche":       ["Sharkwerks Exhaust","Öhlins Coilovers","Manthey Racing Parts","Akrapovic Exhaust"],
  "mercedes-benz": ["Renntech Parts","Akrapovic Exhaust","Brabus Parts","KW Coilovers","Weistec Parts"],
  "hyundai":       ["EQT Tune","Agency Power Parts","Milltek Exhaust","Bilstein B8 Coilovers"],
  "genesis":       ["Agency Power Parts","Injen Intake","Exhaust Upgrade","Bilstein Coilovers"],
  "cadillac":      ["Magnuson Supercharger","Lingenfelter Parts","Corsa Exhaust","KW Coilovers"],
};

function getModCategories(make, model) {
  const mk = (make||"").trim().toLowerCase();
  const md = (model||"").trim().toLowerCase();
  const exactKey = `${mk}|${md}`;
  if (CAR_POPULAR_MODS[exactKey]) {
    return [{ label:`⭐ Popular · ${make} ${model}`, mods: CAR_POPULAR_MODS[exactKey] }, ...MOD_CATEGORIES];
  }
  // Partial match — handles "Civic Type R" matching "civic", etc.
  const partialKey = Object.keys(CAR_POPULAR_MODS).find(k => {
    const [km, kmd] = k.split("|");
    return km === mk && (md.includes(kmd) || kmd.includes(md.split(" ")[0]));
  });
  if (partialKey) {
    return [{ label:`⭐ Popular · ${make} ${model}`, mods: CAR_POPULAR_MODS[partialKey] }, ...MOD_CATEGORIES];
  }
  if (MAKE_POPULAR_MODS[mk]) {
    return [{ label:`⭐ Popular · ${make}`, mods: MAKE_POPULAR_MODS[mk] }, ...MOD_CATEGORIES];
  }
  return MOD_CATEGORIES;
}

const BLANK_PROFILE = {
  id: null, username: "", displayName: "", showRealName: false,
  avatar: "", avatarUrl: "", city: "", car: "", year: "",
  wins:  {h2h:0, group:0, trial:0, drag:0},
  races: {h2h:0, group:0, trial:0, drag:0},
  times: {half_mile:"", quarter_mile:"", zero_sixty:"", zero_120:""},
  nightLobbies: 0, nightWins: 0, nightMiles: 0,
  socials: {instagram:"", twitter:"", youtube:""},
  instagram: "", lat: null, lng: null, mapVisible: true, bannerUrl: "",
  points: 0, hasAccess: false,
};

const GROUP_THEMES = ["#e61a1a","#0066ff","#00c060","#f59e0b","#a855f7","#ec4899","#06b6d4","#ffffff"];

const BLANK_CAR = {
  id: null, make: "", model: "", year: "", trim: "", mods: "", photoUrl: "", buildStage: "stock",
};

// Night Mode — 10pm (22:00) to 4am (04:00) local time
function isNightTime() {
  const h = new Date().getHours();
  return h >= 22 || h < 4;
}

const NIGHT_BADGES = [
  { key:"night_owl",      label:"Night Owl",      icon:"🦉", threshold:10,  desc:"10 night lobbies" },
  { key:"midnight_racer", label:"Midnight Racer",  icon:"🌙", threshold:25,  desc:"25 night lobbies" },
  { key:"ghost",          label:"Ghost",           icon:"👻", threshold:50,  desc:"50 night lobbies" },
  { key:"phantom",        label:"Phantom",         icon:"💀", threshold:100, desc:"100 night lobbies" },
];

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
  return all.map(p=>({id:p.id, points:p.points||0}))
    .sort((a,b)=>b.points-a.points)
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
    avatarUrl: row.avatar_url||"",
    city: row.city||"",
    instagram: row.instagram||"",
    socials: {instagram:row.instagram||"", twitter:"", youtube:""},
    lat: row.lat??null, lng: row.lng??null,
    mapVisible: row.map_visible??true,
    bannerUrl: row.banner_url||"",
    hasAccess: row.has_access??false,
    points: row.points??0,
    wins:  row.wins  || {h2h:0, group:0, trial:0, drag:0},
    races: row.races || {h2h:0, group:0, trial:0, drag:0},
    nightLobbies: row.night_lobbies??0,
    nightWins:    row.night_wins??0,
    nightMiles:   row.night_miles??0,
    times: {
      zero_sixty:    row.zero_sixty    ? String(row.zero_sixty)    : "",
      zero_120:      row.zero_120      ? String(row.zero_120)      : "",
      quarter_mile:  row.quarter_mile  ? String(row.quarter_mile)  : "",
      half_mile:     row.half_mile     ? String(row.half_mile)     : "",
    },
  };
}

function carFromRow(row) {
  return {
    id: row.id, make: row.make||"", model: row.model||"",
    year: row.year?.toString()||"", trim: row.trim||"",
    mods: row.mods||"", photoUrl: row.photos?.[0]||"",
    buildStage: row.build_stage||"stock", isPrimary: row.is_primary||false,
    times: row.times||{},
    wins:  row.wins ||{h2h:0,group:0,trial:0,drag:0},
    races: row.races||{h2h:0,group:0,trial:0,drag:0},
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
.av{border-radius:50%;background:var(--s3);color:var(--text);font-family:var(--font-mono);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;border:1px solid var(--border2);overflow:hidden}
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

/* DIRECTIONS */
.dir-step-active{background:rgba(230,26,26,.08)!important}
.dir-step-past{opacity:.4}

/* ROUTES */
.route-meta{font-size:10px;color:var(--muted2);display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono)}
.route-map-wrap{width:100%;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);position:relative;background:var(--s3)}
.rsvp-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)}
.rsvp-row:last-child{border-bottom:none}
.wp-chip{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--s3);border-radius:8px;border:1px solid var(--border);margin-bottom:6px}
.wp-num{width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wp-num.last{background:var(--green)}
.wp-num.first{background:var(--accent)}

/* NIGHT LEADERBOARD TAB */
.lb-mode-tabs{display:flex;gap:6px;padding:0 16px;margin-bottom:10px}
.lb-mode-tab{font-size:12px;font-weight:700;padding:7px 16px;border-radius:var(--radius-full);border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;white-space:nowrap;display:flex;align-items:center;gap:5px}
.lb-mode-tab.on{background:var(--s2);color:var(--text);border-color:var(--border3)}
.lb-mode-tab.night-on{background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(59,130,246,.2));color:#a78bfa;border-color:rgba(139,92,246,.5);box-shadow:0 0 12px rgba(139,92,246,.25)}

/* NIGHT LOBBY CARD */
.card.night-lobby{background:linear-gradient(145deg,rgba(10,5,20,.95),rgba(12,8,25,.95));border-color:rgba(139,92,246,.35);box-shadow:0 0 0 1px rgba(59,130,246,.15),0 4px 20px rgba(139,92,246,.12)}
.card.night-lobby:active{background:rgba(15,10,30,.98)}
.night-glow{animation:night-pulse 2.5s ease-in-out infinite}
@keyframes night-pulse{0%,100%{opacity:.8}50%{opacity:1}}
.night-type-pill{background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(59,130,246,.2));color:#a78bfa;border:1px solid rgba(139,92,246,.4);font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--radius-full);letter-spacing:.5px;text-transform:uppercase;display:inline-flex;align-items:center;gap:4px}
.moon-badge{font-size:13px;filter:drop-shadow(0 0 4px rgba(139,92,246,.8))}
.night-name{background:linear-gradient(90deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* REPLAYS */
.replay-card{background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:0 16px 10px;cursor:pointer;transition:all .15s}
.replay-card:active{background:var(--s3)}
.replay-controls{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s2);border-top:1px solid var(--border);flex-shrink:0}
.replay-speed-btn{padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;transition:all .15s}
.replay-speed-btn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.replay-scrubber{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:var(--border3);border-radius:2px;outline:none;cursor:pointer}
.replay-scrubber::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--accent);cursor:pointer;box-shadow:0 0 6px rgba(230,26,26,.5)}
.replay-leaderboard{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.75);border-radius:10px;padding:8px 12px;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.08);min-width:160px;max-width:200px;z-index:10}
.replay-speedo{position:absolute;bottom:170px;left:14px;background:rgba(0,0,0,.75);border-radius:10px;padding:8px 12px;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.08);z-index:10}

/* SPEED TRAPS */
.trap-card{background:var(--s2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:0 16px 10px;cursor:pointer;transition:all .15s}
.trap-card:active{background:var(--s3)}
.trap-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9999;background:#0d0d0d;border:1px solid #f59e0b;border-radius:14px;padding:14px 18px;min-width:260px;max-width:320px;box-shadow:0 4px 24px rgba(0,0,0,.6);animation:trap-pop .2s ease}
@keyframes trap-pop{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.trap-lb-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border)}
.trap-lb-row:last-child{border-bottom:none}

/* SESSION SUMMARY */
.session-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:3000;display:flex;align-items:flex-end;justify-content:center;animation:fadein .2s ease}
.session-modal{background:#0d0d0d;border:1px solid var(--border3);border-radius:20px 20px 0 0;width:100%;max-width:500px;padding:20px 20px 32px;overflow:hidden}
.session-stat-box{flex:1;min-width:0;background:var(--s2);border-radius:12px;border:1px solid var(--border);padding:12px 10px;text-align:center}
.session-stat-val{font-size:24px;font-weight:900;line-height:1;font-family:var(--font-mono);color:var(--text);letter-spacing:-1px}
.session-stat-lbl{font-size:9px;color:var(--muted2);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-top:4px}

/* PROFILE DRIVE STATS */
.drive-bar-chart{display:flex;align-items:flex-end;gap:6px;height:80px;padding:0 2px}
.drive-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.drive-bar{width:100%;border-radius:4px 4px 0 0;background:var(--accent);min-height:3px;transition:height .4s}
.drive-bar-day{font-size:9px;color:var(--muted2);font-weight:600}
.session-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border)}
.session-row:last-child{border-bottom:none}

/* NIGHT FILTER PILL */
.pill.night-on{background:linear-gradient(135deg,rgba(139,92,246,.3),rgba(59,130,246,.2));color:#a78bfa;border-color:rgba(139,92,246,.5);box-shadow:0 0 8px rgba(139,92,246,.2)}

/* NIGHT MODAL */
.night-toggle-card{background:linear-gradient(145deg,rgba(10,5,20,.95),rgba(15,8,30,.9));border:1px solid rgba(139,92,246,.4);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;box-shadow:0 0 16px rgba(139,92,246,.15)}
.night-toggle-disabled{background:var(--s2);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;opacity:.55}

/* NIGHT BADGE */
.night-badge-chip{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(59,130,246,.15));border:1px solid rgba(139,92,246,.4);border-radius:var(--radius-sm);padding:4px 10px;font-size:11px;font-weight:600;color:#a78bfa}

/* NIGHT STATS GRID */
.night-stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 16px;margin-bottom:8px}
.night-stat-box{background:linear-gradient(145deg,rgba(10,5,20,.9),rgba(15,8,30,.85));border:1px solid rgba(139,92,246,.3);border-radius:var(--radius-md);padding:12px 8px;text-align:center;box-shadow:0 0 8px rgba(139,92,246,.1)}

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
@keyframes goFlash{0%{opacity:1}100%{opacity:0}}
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
  html,body{overflow-x:hidden;height:100%}
  body{display:flex;flex-direction:column}
  .app{max-width:100%;flex-direction:row;align-items:stretch;min-height:100vh;flex:1}
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
  .main-area{flex:1;min-width:0;overflow-y:auto;height:100vh;display:flex;flex-direction:column;max-width:none;padding:0}
  .content{flex:1;max-width:760px;margin:0 auto;width:100%;padding:0 0 60px}
  .pg-hdr{padding:28px 20px 16px}
  .pg-title{font-size:28px}
  .map-wrap{height:420px}
  .desktop-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px;margin-bottom:8px}
  .desktop-2col .card{margin:0}
  /* Modals centered on desktop */
  .modal-overlay{align-items:center}
  .modal-sheet{border-radius:20px;border:1px solid var(--border2);max-height:85vh;max-width:460px}
}

@media(min-width:1100px){
  .sidebar{width:240px}
  .content{max-width:860px}
}
`;

/* ─── LOGO COMPONENT ─────────────────────────────────────── */
function Logo({ sidebarVariant = false }) {
  const h = sidebarVariant ? 36 : 44;
  return (
    <img src={logoImg} alt="0x" style={{height:h, width:"auto", display:"block", flexShrink:0, mixBlendMode:"screen"}} />
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
    case "Routes":
      return <svg {...p}><path d="M3 12h18"/><path d="M3 6l4 6-4 6"/><path d="M21 6l-4 6 4 6"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>;
    case "Replays":
      return <svg {...p}><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21"/></svg>;
    case "Traps":
      return <svg {...p}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
    default: return null;
  }
}

/* ─── TIER BADGE ─────────────────────────────────────────── */
function TierBadge({ points = 0 }) {
  const t = getTier(points);
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

/* ─── ROUTE HELPERS ──────────────────────────────────────── */
const DIFFICULTIES = ["Chill","Moderate","Spirited"];
const DIFF_COLORS  = {Chill:"#00c060", Moderate:"#f59e0b", Spirited:"#e61a1a"};
const DIFF_ICONS   = {Chill:"😎", Moderate:"🔥", Spirited:"⚡"};

function DifficultyBadge({ difficulty }) {
  const c = DIFF_COLORS[difficulty]||"var(--muted2)";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:6,background:c+"22",color:c,border:`1px solid ${c}44`,letterSpacing:.5,textTransform:"uppercase",whiteSpace:"nowrap",flexShrink:0}}>
      {DIFF_ICONS[difficulty]||"•"} {difficulty}
    </span>
  );
}

function routeFromRow(row) {
  return {
    id: row.id, name: row.name||"", description: row.description||"",
    waypoints: row.waypoints||[], distance: row.distance||null,
    difficulty: row.difficulty||"Chill", groupId: row.group_id||null,
    createdBy: row.created_by, createdAt: row.created_at,
    creatorUsername: row.profiles?.username||"?",
    creatorAvatar: row.profiles?.avatar_initials||"?",
    creatorAvatarUrl: row.profiles?.avatar_url||"",
  };
}

function ghostFromRow(row) {
  return {
    id: row.id, routeId: row.route_id, userId: row.user_id,
    pathData: row.path_data||[], totalTimeSeconds: row.total_time_seconds,
    createdAt: row.created_at,
    username: row.profiles?.username||"?",
    avatarInitials: row.profiles?.avatar_initials||"?",
    avatarUrl: row.profiles?.avatar_url||"",
    carMake: row.car_make||"", carModel: row.car_model||"", carYear: row.car_year||"",
  };
}

const REPLAY_COLORS = ["#e61a1a","#3b82f6","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#f97316"];

function computeMilesFromPath(path) {
  let miles = 0;
  for (let i = 1; i < path.length; i++) {
    const d = haversine(path[i-1].lat, path[i-1].lng, path[i].lat, path[i].lng);
    if (d > 0 && d < 0.5) miles += d; // skip GPS jumps > 0.5mi per 2s sample
  }
  return miles;
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function interpolatePos(pathData, t) {
  if (!pathData || pathData.length === 0) return null;
  if (pathData.length === 1) return pathData[0];
  if (t <= pathData[0].t) return pathData[0];
  if (t >= pathData[pathData.length-1].t) return pathData[pathData.length-1];
  for (let i = 0; i < pathData.length - 1; i++) {
    const p0 = pathData[i], p1 = pathData[i+1];
    if (t >= p0.t && t <= p1.t) {
      const frac = p1.t > p0.t ? (t - p0.t) / (p1.t - p0.t) : 0;
      return {
        lat: p0.lat + (p1.lat - p0.lat) * frac,
        lng: p0.lng + (p1.lng - p0.lng) * frac,
        speed: Math.round(p0.speed + (p1.speed - p0.speed) * frac),
      };
    }
  }
  return pathData[pathData.length-1];
}

function fmtGhostTime(seconds) {
  if (!seconds && seconds !== 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 10);
  if (m > 0) return `${m}:${String(s).padStart(2,"0")}.${ms}`;
  return `${s}.${ms}s`;
}

/* ─── SESSION SUMMARY MODAL ──────────────────────────────── */
function SessionSummaryModal({ summary, onDone }) {
  const [copied, setCopied] = useState(false);

  const shareText = `🏁 0xrace Session${summary.lobbyName ? ` — ${summary.lobbyName}` : ""}\n📏 ${summary.miles.toFixed(2)} mi driven\n⚡ ${summary.topSpeed} mph top speed\n📊 ${summary.avgSpeed} mph avg\n⏱ ${fmtDuration(summary.durationSec)}\n\n0xrace.com`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "0xrace Session", text: shareText }); return; } catch(_){}
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch(_){}
  };

  const stats = [
    { val: summary.miles.toFixed(2), lbl: "MILES", color: "var(--accent)" },
    { val: summary.topSpeed || 0, lbl: "TOP MPH", color: "#f59e0b" },
    { val: summary.avgSpeed || 0, lbl: "AVG MPH", color: "#3b82f6" },
    { val: fmtDuration(summary.durationSec), lbl: "TIME", color: "#10b981" },
  ];

  return (
    <div className="session-modal-overlay" onClick={e=>e.target===e.currentTarget&&onDone()}>
      <div className="session-modal fade">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:"var(--accent)",fontWeight:700,letterSpacing:1,marginBottom:2}}>SESSION COMPLETE</div>
            <div style={{fontSize:17,fontWeight:800,lineHeight:1.2}}>{summary.lobbyName||"Drive Session"}</div>
          </div>
          <div style={{fontSize:22}}>🏁</div>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {stats.map(s => (
            <div key={s.lbl} className="session-stat-box">
              <div className="session-stat-val" style={{color:s.color}}>{s.val}</div>
              <div className="session-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {summary.startedAt && (
          <div style={{fontSize:11,color:"var(--muted2)",marginBottom:16,textAlign:"center"}}>
            {new Date(summary.startedAt).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}
            {" · "}
            {new Date(summary.startedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary" style={{flex:1,borderRadius:12,padding:12}} onClick={handleShare}>
            {copied ? "✓ Copied!" : "Share"}
          </button>
          <button className="btn btn-primary" style={{flex:2,borderRadius:12,padding:12,fontWeight:700}} onClick={onDone}>
            Done →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── LIVE TIMER ─────────────────────────────────────────── */
function LiveTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  const ms = Math.floor((elapsed % 1) * 10);
  return (
    <span style={{fontFamily:"var(--font-mono)",fontWeight:900,fontSize:"inherit",color:"inherit"}}>
      {m > 0 ? `${m}:${String(s).padStart(2,"0")}.${ms}` : `${s}.${ms}s`}
    </span>
  );
}

/* ─── GHOST RACE ─────────────────────────────────────────── */
function GhostRace({ route: r, ghost, myProfile, myCar, onClose }) {
  // phases: "ready" | "countdown" | "racing" | "done"
  const [phase, setPhase] = useState("ready");
  const [countdownNum, setCountdownNum] = useState(3);
  const [raceStartTime, setRaceStartTime] = useState(null);
  const [raceEndTime, setRaceEndTime] = useState(null);
  const [userPath, setUserPath] = useState([]); // [{lat,lng,speed,timestamp}]
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const ghostMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const animFrameRef = useRef(null);
  const animateGhostRef = useRef(null);
  const raceStartRef = useRef(null);
  const userPathRef = useRef([]);
  const phaseRef = useRef("ready");

  const endWp = r.waypoints[r.waypoints.length - 1];
  const ghostPath = ghost?.pathData || [];
  const ghostDuration = ghost?.totalTimeSeconds || null;

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const first = r.waypoints[0];
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [first.lng, first.lat], zoom: 14,
    });

    mapRef.current.on("load", () => {
      // Draw route line
      if (r.waypoints.length >= 2) {
        const coords = r.waypoints.slice(0,25).map(wp=>`${wp.lng},${wp.lat}`).join(";");
        fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full`)
          .then(res=>res.json())
          .then(data => {
            const geom = data.routes?.[0]?.geometry;
            if (geom && mapRef.current) {
              mapRef.current.addSource("gr-route",{type:"geojson",data:geom});
              mapRef.current.addLayer({id:"gr-route-casing",type:"line",source:"gr-route",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#000","line-width":7,"line-opacity":.3}});
              mapRef.current.addLayer({id:"gr-route",type:"line",source:"gr-route",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#e61a1a","line-width":4,"line-opacity":.8}});
            }
          }).catch(()=>{});
      }

      // Start/End markers
      r.waypoints.forEach((wp,i)=>{
        const isFirst = i===0, isLast = i===r.waypoints.length-1;
        if (!isFirst && !isLast) return;
        const el = document.createElement("div");
        el.style.cssText=`width:26px;height:26px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.5);background:${isFirst?"#e61a1a":"#00c060"};`;
        el.textContent = isFirst?"S":"E";
        new mapboxgl.Marker({element:el}).setLngLat([wp.lng,wp.lat]).addTo(mapRef.current);
      });

      // Ghost marker
      if (ghostPath.length > 0) {
        const ghostEl = document.createElement("div");
        ghostEl.style.cssText="width:32px;height:32px;border-radius:50%;background:rgba(150,150,255,.15);border:2.5px solid rgba(180,180,255,.7);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 12px rgba(150,150,255,.4);";
        ghostEl.textContent="👻";
        ghostMarkerRef.current = new mapboxgl.Marker({element:ghostEl})
          .setLngLat([ghostPath[0].lng, ghostPath[0].lat])
          .addTo(mapRef.current);
      }

      // User marker
      const userEl = document.createElement("div");
      userEl.style.cssText="width:34px;height:34px;border-radius:50%;background:rgba(230,26,26,.15);border:3px solid #e61a1a;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 14px rgba(230,26,26,.5);";
      userEl.textContent="🚗";
      const firstPos = r.waypoints[0];
      userMarkerRef.current = new mapboxgl.Marker({element:userEl})
        .setLngLat([firstPos.lng, firstPos.lat])
        .addTo(mapRef.current);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Ghost animation loop
  animateGhostRef.current = useCallback(() => {
    if (!ghostMarkerRef.current || !raceStartRef.current || ghostPath.length < 2) return;
    const elapsed = (Date.now() - raceStartRef.current) / 1000;
    // Find position in ghost path based on elapsed time
    let pos = null;
    for (let i = 0; i < ghostPath.length - 1; i++) {
      const p0 = ghostPath[i], p1 = ghostPath[i+1];
      const t0 = p0.timestamp, t1 = p1.timestamp;
      if (elapsed >= t0 && elapsed <= t1) {
        const frac = t1 > t0 ? (elapsed - t0) / (t1 - t0) : 0;
        pos = {
          lng: p0.lng + (p1.lng - p0.lng) * frac,
          lat: p0.lat + (p1.lat - p0.lat) * frac,
        };
        break;
      }
    }
    if (!pos) {
      const last = ghostPath[ghostPath.length-1];
      pos = { lng: last.lng, lat: last.lat };
    }
    ghostMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    if (phaseRef.current === "racing") {
      animFrameRef.current = requestAnimationFrame(() => animateGhostRef.current());
    }
  }, [ghostPath]);

  const startCountdown = () => {
    setPhase("countdown");
    phaseRef.current = "countdown";
    setCountdownNum(3);
    let n = 3;
    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        const now = Date.now();
        setRaceStartTime(now);
        raceStartRef.current = now;
        setPhase("racing");
        phaseRef.current = "racing";
        // Start ghost animation
        if (ghostPath.length > 0) {
          animFrameRef.current = requestAnimationFrame(() => animateGhostRef.current());
        }
        // Start GPS
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(pos => {
            const { latitude: lat, longitude: lng, speed } = pos.coords;
            setUserLat(lat); setUserLng(lng);
            const ts = (Date.now() - raceStartRef.current) / 1000;
            const pt = { lat, lng, speed: speed || 0, timestamp: ts };
            userPathRef.current = [...userPathRef.current, pt];
            setUserPath(p => [...p, pt]);
            if (userMarkerRef.current) userMarkerRef.current.setLngLat([lng, lat]);
            // Check finish — within 80m of end waypoint
            if (endWp && phaseRef.current === "racing") {
              const dist = haversine(lat, lng, endWp.lat, endWp.lng) * 1609.34;
              if (dist < 80) {
                const finishTime = (Date.now() - raceStartRef.current) / 1000;
                setRaceEndTime(finishTime);
                setPhase("done");
                phaseRef.current = "done";
                navigator.geolocation.clearWatch(watchIdRef.current);
                cancelAnimationFrame(animFrameRef.current);
              }
            }
          }, () => {}, { enableHighAccuracy: true, maximumAge: 0 });
        }
      } else {
        setCountdownNum(n);
      }
    }, 1000);
  };

  const saveGhost = async () => {
    if (!raceEndTime || saving || saved) return;
    setSaving(true);
    try {
      await supabase.from("ghost_runs").insert({
        route_id: r.id,
        user_id: myProfile.id,
        path_data: userPathRef.current,
        total_time_seconds: raceEndTime,
        car_make: myCar?.make || null,
        car_model: myCar?.model || null,
        car_year: myCar?.year || null,
      });
      setSaved(true);
    } catch(e) { console.error("save ghost error", e); }
    setSaving(false);
  };

  const userTime = raceEndTime;
  const isNewRecord = userTime && ghostDuration && userTime < ghostDuration;
  const timeDiff = userTime && ghostDuration ? Math.abs(userTime - ghostDuration) : null;

  return (
    <div style={{position:"fixed",inset:0,background:"#0a0a0a",zIndex:2000,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"12px 16px 8px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13,padding:"4px 8px 4px 0"}}>
          ✕ Exit Race
        </button>
        <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>{r.name}</div>
        <div style={{width:60}}/>
      </div>

      {/* Map */}
      <div ref={mapContainer} style={{flex:1,minHeight:0}}/>

      {/* Ghost legend */}
      {phase === "racing" && ghost && (
        <div style={{position:"absolute",top:52,left:12,background:"rgba(0,0,0,.7)",borderRadius:8,padding:"6px 10px",backdropFilter:"blur(4px)",border:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{fontSize:10,color:"rgba(180,180,255,.9)",fontWeight:700,marginBottom:2}}>👻 GHOST — @{ghost.username}</div>
          <div style={{fontSize:11,color:"rgba(180,180,255,.7)"}}>Best: {fmtGhostTime(ghostDuration)}</div>
        </div>
      )}
      {phase === "racing" && (
        <div style={{position:"absolute",top:52,right:12,background:"rgba(0,0,0,.7)",borderRadius:8,padding:"6px 10px",backdropFilter:"blur(4px)",border:"1px solid rgba(230,26,26,.3)"}}>
          <div style={{fontSize:10,color:"var(--accent)",fontWeight:700,marginBottom:2}}>🚗 YOU</div>
          <div style={{fontSize:16,color:"#fff",fontWeight:900}}><LiveTimer startTime={raceStartTime}/></div>
        </div>
      )}

      {/* Bottom panel */}
      <div style={{background:"var(--s2)",borderTop:"1px solid var(--border)",padding:"16px",flexShrink:0}}>

        {phase === "ready" && (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:6}}>
              {ghost ? <>Ghost to beat: <span style={{color:"rgba(180,180,255,.9)",fontWeight:700}}>{fmtGhostTime(ghostDuration)}</span> by <span style={{color:"var(--text)"}}>@{ghost.username}</span></> : "No ghost yet — be the first!"}
            </div>
            <div style={{fontSize:12,color:"var(--muted2)",marginBottom:14}}>Drive to the start point, then tap Go</div>
            <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,fontSize:15,fontWeight:800,letterSpacing:1}} onClick={startCountdown}>
              GO →
            </button>
          </div>
        )}

        {phase === "countdown" && (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:64,fontWeight:900,color:"#e61a1a",lineHeight:1,marginBottom:4}}>{countdownNum}</div>
            <div style={{fontSize:13,color:"var(--muted)"}}>Get ready…</div>
          </div>
        )}

        {phase === "racing" && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,letterSpacing:1,marginBottom:2}}>YOUR TIME</div>
              <div style={{fontSize:24,fontWeight:900,color:"#e61a1a"}}><LiveTimer startTime={raceStartTime}/></div>
            </div>
            {ghost && (
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"rgba(180,180,255,.7)",fontWeight:700,letterSpacing:1,marginBottom:2}}>GHOST</div>
                <div style={{fontSize:18,fontWeight:700,color:"rgba(180,180,255,.9)"}}>{fmtGhostTime(ghostDuration)}</div>
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:32,marginBottom:4}}>{isNewRecord ? "🏆" : "👻"}</div>
              <div style={{fontSize:18,fontWeight:900,color:isNewRecord?"#f59e0b":"var(--text)",marginBottom:4}}>
                {isNewRecord ? "NEW RECORD!" : ghostDuration ? "Nice Run" : "Run Complete!"}
              </div>
              <div style={{fontSize:22,fontWeight:800,color:"var(--text)",marginBottom:8}}>{fmtGhostTime(userTime)}</div>
              {timeDiff !== null && (
                <div style={{fontSize:13,color:isNewRecord?"#00c060":"#e61a1a",fontWeight:700}}>
                  {isNewRecord ? `⚡ ${fmtGhostTime(timeDiff)} faster than ghost` : `${fmtGhostTime(timeDiff)} behind ghost`}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              {(isNewRecord || !ghost) && !saved && (
                <button className="btn btn-primary" style={{flex:1,borderRadius:10,padding:12,fontWeight:800}} disabled={saving} onClick={saveGhost}>
                  {saving ? "Saving…" : isNewRecord ? "👻 Set as New Ghost" : "👻 Set Ghost"}
                </button>
              )}
              {saved && <div style={{flex:1,padding:12,textAlign:"center",fontSize:13,color:"#00c060",fontWeight:700}}>✓ Ghost saved!</div>}
              <button className="btn btn-secondary" style={{flex:saved?1:0,borderRadius:10,padding:12}} onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CREATE LOBBY MODAL ─────────────────────────────────── */
/* ─── IMAGE CROP MODAL ───────────────────────────────────── */
// aspect: e.g. {w:1,h:1} | {w:16,h:9} | {w:3,h:1}
// shape: "circle" | "rect"
function CropModal({ src, aspect = {w:1,h:1}, shape = "rect", onCancel, onCrop }) {
  const FRAME = 280; // crop frame size (px) — square base
  const frameW = FRAME;
  const frameH = Math.round(FRAME * (aspect.h / aspect.w));

  const [offset, setOffset] = useState({x:0, y:0});
  const [scale, setScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState({w:1,h:1});
  const imgRef = useRef();
  const dragRef = useRef(null);

  const onImgLoad = () => {
    const img = imgRef.current;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    setNaturalSize({w:nw,h:nh});
    // Auto-fit: fill the crop frame
    const fitScale = Math.max(frameW/nw, frameH/nh);
    setScale(fitScale);
    setOffset({x:0,y:0});
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {startX:e.clientX-offset.x, startY:e.clientY-offset.y};
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset({x:e.clientX-dragRef.current.startX, y:e.clientY-dragRef.current.startY});
  };
  const onPointerUp = () => { dragRef.current = null; };

  const applyCrop = () => {
    const canvas = document.createElement("canvas");
    canvas.width = frameW; canvas.height = frameH;
    const ctx = canvas.getContext("2d");
    if (shape==="circle") {
      ctx.beginPath(); ctx.arc(frameW/2,frameH/2,Math.min(frameW,frameH)/2,0,Math.PI*2); ctx.clip();
    }
    const dispW = naturalSize.w * scale;
    const dispH = naturalSize.h * scale;
    const imgX = (frameW - dispW) / 2 + offset.x;
    const imgY = (frameH - dispH) / 2 + offset.y;
    ctx.drawImage(imgRef.current, imgX, imgY, dispW, dispH);
    canvas.toBlob(blob => { if(blob) onCrop(blob, URL.createObjectURL(blob)); }, "image/jpeg", 0.92);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:600,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:4}}>Drag to reposition · Slider to zoom</div>

      {/* Crop viewport */}
      <div style={{position:"relative",width:frameW,height:frameH,overflow:"hidden",borderRadius:shape==="circle"?"50%":"12px",border:"2px solid var(--accent)",cursor:"grab",flexShrink:0,background:"#111"}}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <img ref={imgRef} src={src} onLoad={onImgLoad} draggable={false}
          style={{position:"absolute",left:"50%",top:"50%",transform:`translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,transformOrigin:"center",maxWidth:"none",userSelect:"none",pointerEvents:"none"}}/>
      </div>

      {/* Zoom slider */}
      <div style={{display:"flex",alignItems:"center",gap:10,width:frameW}}>
        <span style={{fontSize:11,color:"var(--muted)"}}>−</span>
        <input type="range" min={0.3} max={3} step={0.01} value={scale}
          onChange={e=>setScale(parseFloat(e.target.value))}
          style={{flex:1,accentColor:"var(--accent)"}}/>
        <span style={{fontSize:11,color:"var(--muted)"}}>+</span>
      </div>

      <div style={{display:"flex",gap:10,width:frameW}}>
        <button className="btn btn-secondary btn-full" style={{borderRadius:10}} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-full" style={{borderRadius:10}} onClick={applyCrop}>Use Photo</button>
      </div>
    </div>
  );
}

function CreateLobbyModal({ myProfile, groups, onClose, onCreate }) {
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const nightAvailable = isNightTime();
  const [form, setForm] = useState({
    name: "", type: "Cruising", isOpen: true,
    groupId: "", destination: "", destLat: null, destLng: null, micActive: false,
    isNight: nightAvailable, // auto-flag if created during night hours
  });
  const [saving, setSaving] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const destDebounce = useRef(null);
  const [livePos, setLivePos] = useState(null);

  // Get fresh GPS on mount for proximity-biased search
  useEffect(()=>{
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos=>setLivePos({lat:pos.coords.latitude,lng:pos.coords.longitude}),
      ()=>{},
      {timeout:5000,maximumAge:30000}
    );
  },[]);

  const getProximity = () => {
    const lat = livePos?.lat || myProfile.lat;
    const lng = livePos?.lng || myProfile.lng;
    return lat&&lng ? `&proximity=${lng},${lat}` : "";
  };

  // Show nearby POIs when search field is focused and empty
  const handleDestFocus = async () => {
    if (form.destination || destSuggestions.length) return;
    const lat = livePos?.lat || myProfile.lat;
    const lng = livePos?.lng || myProfile.lng;
    if (!lat||!lng) return;
    try {
      // Reverse geocode to get nearby places/POIs
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=poi,neighborhood,place&access_token=${MAPBOX_TOKEN}&limit=5`);
      const data = await res.json();
      setDestSuggestions((data.features||[]).map(f=>({
        name: f.place_name, short: f.text,
        lat: f.center?.[1]??null, lng: f.center?.[0]??null,
        nearby: true,
      })));
    } catch(_){}
  };

  const handleDestInput = (val) => {
    setForm(f=>({...f, destination:val, destLat:null, destLng:null}));
    setDestSuggestions([]);
    if (destDebounce.current) clearTimeout(destDebounce.current);
    if (!val.trim()||val.length<1) return;
    destDebounce.current = setTimeout(async()=>{
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5${getProximity()}`);
        const data = await res.json();
        setDestSuggestions((data.features||[]).map(f=>({
          name: f.place_name, short: f.text,
          lat: f.center?.[1]??null, lng: f.center?.[0]??null,
        })));
      } catch(_){}
    }, 300);
  };

  const handleGroupChange = (gid) => {
    const g = myGroups.find(x=>x.id===gid);
    setForm(f=>({...f, groupId:gid, name: g ? g.name : f.name}));
  };

  const submit = async () => {
    const finalForm = form.name.trim() ? form : {...form, name: `${myProfile.displayName||"New"}'s Lobby`};
    setSaving(true);
    await onCreate(finalForm);
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

        <div style={{marginBottom:16,position:"relative"}}>
          <label className="inp-label">Planned Destination <span style={{fontWeight:400,color:"var(--muted2)",textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
          <input className="inp" value={form.destination}
            onChange={e=>handleDestInput(e.target.value)}
            onFocus={handleDestFocus}
            onBlur={()=>setTimeout(()=>setDestSuggestions([]),200)}
            placeholder="Search a place…" autoComplete="off"/>
          {destSuggestions.length>0&&(
            <div style={{position:"absolute",left:0,right:0,background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,marginTop:4,zIndex:999,overflow:"hidden"}}>
              {destSuggestions[0]?.nearby&&(
                <div style={{padding:"6px 14px 2px",fontSize:10,color:"var(--muted2)",fontWeight:700,letterSpacing:.5}}>NEARBY</div>
              )}
              {destSuggestions.map((s,i)=>(
                <div key={i} onClick={()=>{setForm(f=>({...f,destination:s.short||s.name,destLat:s.lat,destLng:s.lng}));setDestSuggestions([]);}}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<destSuggestions.length-1?"1px solid var(--border)":undefined,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:15,flexShrink:0}}>{s.nearby?"📍":"🔍"}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{s.short}</div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Night Lobby Toggle */}
        {nightAvailable ? (
          <div className="night-toggle-card" style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:16}}>🌙</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>Night Lobby</span>
                </div>
                <div style={{fontSize:11,color:"rgba(167,139,250,.7)"}}>Active 10pm–4am · exclusive neon skin + Night Leaderboard</div>
              </div>
              <button onClick={()=>setForm(f=>({...f,isNight:!f.isNight}))}
                style={{background:form.isNight?"linear-gradient(135deg,#7c3aed,#2563eb)":"var(--s3)",border:"none",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:700,color:form.isNight?"#fff":"var(--muted)",cursor:"pointer",transition:"all .15s",boxShadow:form.isNight?"0 0 12px rgba(139,92,246,.4)":"none"}}>
                {form.isNight?"ON":"OFF"}
              </button>
            </div>
          </div>
        ) : (
          <div className="night-toggle-disabled" style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:15}}>🌙</span>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--muted)"}}>Night Lobby</div>
                <div style={{fontSize:11,color:"var(--muted2)"}}>Available after 10pm</div>
              </div>
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8,background:form.isNight?"linear-gradient(135deg,#7c3aed,#2563eb)":undefined,boxShadow:form.isNight?"0 0 20px rgba(139,92,246,.4)":undefined}}
          disabled={saving} onClick={submit}>
          {saving?"Creating…":form.isNight?"🌙 Go Live (Night)":"Go Live"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ─── CREATE GROUP MODAL ─────────────────────────────────── */
function CreateGroupModal({ myProfile, existingGroups, onClose, onCreateDB }) {
  const [form, setForm] = useState({ name:"", desc:"", type:"open", max:"50", tags:"", theme:"#e61a1a", instagram:"", facebook:"" });
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

        <div style={{marginBottom:12}}>
          <label className="inp-label">Instagram (optional)</label>
          <input className="inp" value={form.instagram} onChange={e=>setForm({...form,instagram:e.target.value})} placeholder="@grouphandle"/>
        </div>

        <div style={{marginBottom:12}}>
          <label className="inp-label">Facebook Page (optional)</label>
          <input className="inp" value={form.facebook} onChange={e=>setForm({...form,facebook:e.target.value})} placeholder="facebook.com/yourpage or page name"/>
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
            <img src={logoImg} alt="0xRace" style={{height:48,width:"auto",marginBottom:16,mixBlendMode:"screen"}}/>
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
  const [dmUserId, setDmUserId] = useState(null); // open DM thread with this userId
  const [lobbyDetailId, setLobbyDetailId] = useState(null);
  const [groupDetailId, setGroupDetailId] = useState(null);
  const [myProfile, setMyProfile] = useState({...BLANK_PROFILE});
  const [editingProfile, setEditingProfile] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createLobbyOpen, setCreateLobbyOpen] = useState(false);
  const [myCar, setMyCar] = useState({...BLANK_CAR});
  const [myCars, setMyCars] = useState([]);
  const [approvalToast, setApprovalToast] = useState(null); // {lobbyId, lobbyName}
  const [speedTraps, setSpeedTraps] = useState([]);

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

  // Global realtime: watch lobby_members for THIS user — detect when a request is approved
  useEffect(() => {
    const myId = session?.user?.id;
    if (!myId) return;
    const ch = supabase.channel(`my-lobby-status-${myId}`)
      .on("postgres_changes", {event:"UPDATE", schema:"public", table:"lobby_members", filter:`user_id=eq.${myId}`}, (payload) => {
        const row = payload.new;
        if (row.status === "active") {
          // We were approved — update local state
          setLobbyReqs(r => r.filter(id => id !== row.lobby_id));
          setLobbies(ls => ls.map(l => l.id === row.lobby_id
            ? { ...l, memberIds: [...new Set([...l.memberIds, myId])], pendingRequests: l.pendingRequests.filter(id => id !== myId) }
            : l
          ));
          // Show toast and auto-open the lobby
          const lobbyName = lobbies.find(l => l.id === row.lobby_id)?.name || "lobby";
          setApprovalToast({ lobbyId: row.lobby_id, lobbyName });
          setTimeout(() => setApprovalToast(null), 5000);
        }
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [session?.user?.id]);

  const loadData = async (userId) => {
    // Reset user-specific state before loading new user's data
    setMyProfile({...BLANK_PROFILE});
    setMyCars([]);
    setMyCar({...BLANK_CAR});
    setFriends([]);
    try {
      const [profileRes, usersRes, groupsRes, myCarRes, allCarsRes, friendsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*").neq("id", userId),
        supabase.from("groups").select("*, group_members(user_id, role, status)"),
        supabase.from("user_cars").select("*").eq("user_id", userId).order("is_primary", {ascending:false}),
        supabase.from("user_cars").select("user_id,year,make,model").eq("is_primary", true),
        supabase.from("friends").select("user_id,friend_id").or(`user_id.eq.${userId},friend_id.eq.${userId}`).eq("status","accepted").then(r=>r).catch(()=>({data:[]})),
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
          instagram: g.instagram||"", facebook: g.facebook||"",
        })));
      }
      if (myCarRes.data?.length) {
        const allCars = myCarRes.data.map(carFromRow);
        setMyCars(allCars);
        const primary = allCars.find(c=>c.isPrimary)||allCars[0];
        if (primary) setMyCar(primary);
      }

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
            destination: l.destination||null, destLat: l.dest_lat??null, destLng: l.dest_lng??null,
            createdBy: l.created_by, lat: l.lat??null, lng: l.lng??null,
            memberIds: (l.lobby_members||[]).filter(m=>m.status==="active").map(m=>m.user_id),
            pendingRequests: (l.lobby_members||[]).filter(m=>m.status==="pending").map(m=>m.user_id),
            micUsers: (l.lobby_members||[]).filter(m=>m.mic_active).map(m=>m.user_id),
            createdAt: l.created_at, isNight: l.is_night??false,
          })));
        }
      } catch (_) { /* lobbies table not yet created */ }

      // Load speed traps
      try {
        const { data: trapData } = await supabase.from("speed_traps")
          .select("*").order("created_at", {ascending: false});
        if (trapData) setSpeedTraps(trapData.map(t => ({
          id: t.id, name: t.name,
          startLat: t.start_lat, startLng: t.start_lng,
          endLat: t.end_lat, endLng: t.end_lng,
          distanceMeters: t.distance_meters,
          createdBy: t.created_by, createdAt: t.created_at,
        })));
      } catch (_) { /* speed_traps table not yet created */ }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut({ scope: "local" }); };

  const handleCreateGroupDB = async (form) => {
    const myId = session?.user?.id;
    const { data: grp, error } = await supabase.from("groups").insert({
      name: form.name.trim(), description: form.desc.trim()||null,
      is_private: form.type==="private", max_members: parseInt(form.max)||50,
      tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      created_by: myId, theme_color: form.theme||"#e61a1a",
      instagram: form.instagram?.trim()||null, facebook: form.facebook?.trim()||null,
    }).select().single();
    if (error||!grp) { console.error("Create group error:", error); return; }
    const{error:memErr}=await supabase.from("group_members").insert({ group_id:grp.id, user_id:myId, role:"owner", status:"active" });
    if(memErr) console.error("group_members insert error:",memErr);
    setGroups(gs=>[...gs, {
      id:grp.id, name:grp.name, desc:grp.description||"",
      type:grp.is_private?"private":"open", max:grp.max_members,
      tags:grp.tags||[], memberIds:[myId], admin:myId,
      theme: form.theme||"#e61a1a", bannerUrl:"",
      instagram: form.instagram?.trim()||"", facebook: form.facebook?.trim()||"",
      lastActive:"just now", messages:[], pendingRequests:[],
    }]);
    awardPoints(myId, 5); // creating a group = 5pts
  };

  const awardPoints = async (userId, pts) => {
    const newPts = (myProfile.points||0) + pts;
    setMyProfile(p=>({...p, points: newPts}));
    await supabase.from("profiles").update({points: newPts}).eq("id", userId);
  };

  const handleLogWin = async (format, result, carId) => {
    const myId = session?.user?.id;
    if (!myId) return;
    const isWin = result === "win";
    // Update profile-level totals
    const newWins = {...(myProfile.wins||{h2h:0,group:0,trial:0,drag:0})};
    const newRaces = {...(myProfile.races||{h2h:0,group:0,trial:0,drag:0})};
    if (isWin) newWins[format] = (newWins[format]||0) + 1;
    newRaces[format] = (newRaces[format]||0) + 1;
    setMyProfile(p=>({...p, wins:newWins, races:newRaces}));
    await supabase.from("profiles").update({wins:newWins, races:newRaces}).eq("id", myId);
    // Update per-car stats
    if (carId) {
      const car = myCars.find(c=>c.id===carId);
      if (car) {
        const cWins = {...(car.wins||{h2h:0,group:0,trial:0,drag:0})};
        const cRaces = {...(car.races||{h2h:0,group:0,trial:0,drag:0})};
        if (isWin) cWins[format] = (cWins[format]||0) + 1;
        cRaces[format] = (cRaces[format]||0) + 1;
        setMyCars(cs=>cs.map(c=>c.id===carId?{...c,wins:cWins,races:cRaces}:c));
        await supabase.from("user_cars").update({wins:cWins, races:cRaces}).eq("id", carId);
      }
    }
    if (isWin) awardPoints(myId, 5); // win = 5pts
  };

  const handleCreateLobby = async (form) => {
    const myId = session?.user?.id;
    // Block pending members from creating lobbies for private groups
    if (form.groupId) {
      const grp = groups.find(g => g.id === form.groupId);
      if (grp && grp.type === "private" && !grp.memberIds.includes(myId)) return;
    }
    const isNight = !!form.isNight;
    const lobbyData = {
      id: `local-${Date.now()}`, name: form.name.trim(),
      type: form.type, isOpen: form.isOpen, groupId: form.groupId||null,
      destination: form.destination||null, destLat: form.destLat||null, destLng: form.destLng||null,
      createdBy: myId, lat: myProfile.lat, lng: myProfile.lng,
      memberIds: [myId], pendingRequests: [], micUsers: [],
      createdAt: new Date().toISOString(),
      isNight,
    };
    // Try to persist to DB
    try {
      const { data: dbLobby } = await supabase.from("lobbies").insert({
        name: lobbyData.name, type: lobbyData.type, is_open: lobbyData.isOpen,
        group_id: lobbyData.groupId||null, destination: lobbyData.destination||null,
        dest_lat: lobbyData.destLat, dest_lng: lobbyData.destLng,
        created_by: myId, lat: myProfile.lat, lng: myProfile.lng, is_active: true,
        is_night: isNight,
      }).select().single();
      if (dbLobby) {
        await supabase.from("lobby_members").insert({ lobby_id:dbLobby.id, user_id:myId, status:"active" });
        lobbyData.id = dbLobby.id;
      }
    } catch (_) { /* table doesn't exist, use local state */ }
    setLobbies(ls=>[...ls, lobbyData]);
    setLobbyDetailId(lobbyData.id);
    // Update night stats on profile if this is a night lobby
    if (isNight) {
      const nightLobbies = (myProfile.nightLobbies||0) + 1;
      setMyProfile(p=>({...p, nightLobbies}));
      try {
        await supabase.from("profiles").update({ night_lobbies: nightLobbies }).eq("id", myId);
      } catch(_) {}
    }
  };

  if (authLoading) {
    return (<><style>{CSS}</style><div className="app" style={{alignItems:"center",justifyContent:"center"}}><div style={{color:"var(--muted)",fontSize:13}}>Loading…</div></div></>);
  }

  if (!session) {
    if (!showAuth) return <LandingPage onSignUp={()=>{setAuthMode("signup");setShowAuth(true);}} onLogin={()=>{setAuthMode("login");setShowAuth(true);}}/>;
    return <AuthPage initialMode={authMode}/>;
  }

  // Paywall disabled — all registered users get full access

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
  const reqGroup = async (gid) => {
    if (sentGR(gid)) return;
    setGroupReqs(r=>[...r,gid]);
    setGroups(gs=>gs.map(g=>g.id===gid?{...g,pendingRequests:[...(g.pendingRequests||[]),myId]}:g));
    const{error}=await supabase.from("group_members").upsert({group_id:gid,user_id:myId,role:"member",status:"pending"},{onConflict:"group_id,user_id"});
    if(error) console.error("reqGroup error:",error);
  };
  const leaveGroup = async (gid) => {
    setGroups(gs=>gs.map(g=>g.id===gid?{...g,memberIds:g.memberIds.filter(id=>id!==myId)}:g));
    setGroupReqs(r=>r.filter(id=>id!==gid));
    await supabase.from("group_members").delete().eq("group_id",gid).eq("user_id",myId);
  };
  const isInLobby = lid => lobbies.find(l=>l.id===lid)?.memberIds.includes(myId);
  const myActiveLobbyId = lobbies.find(l=>l.memberIds.includes(myId))?.id || null;
  const sentLR = lid => lobbyReqs.includes(lid);

  const leaveLobby = async (lid) => {
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,memberIds:l.memberIds.filter(id=>id!==myId)}:l));
    setLobbyReqs(r=>r.filter(id=>id!==lid));
    await supabase.from("lobby_members").delete().eq("lobby_id",lid).eq("user_id",myId);
  };

  const joinLobby = async (lid) => {
    // Leave any existing lobby first
    if (myActiveLobbyId && myActiveLobbyId !== lid) await leaveLobby(myActiveLobbyId);
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,memberIds:[...l.memberIds,myId]}:l));
    const{error}=await supabase.from("lobby_members").upsert({lobby_id:lid,user_id:myId,status:"active"},{onConflict:"lobby_id,user_id"});
    if(error) console.error("joinLobby error:",error);
    awardPoints(myId, 3);
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
  const kickLobby = async (lid, uid) => {
    setLobbies(ls=>ls.map(l=>l.id===lid?{...l,memberIds:l.memberIds.filter(id=>id!==uid)}:l));
    const{error}=await supabase.from("lobby_members").delete().eq("lobby_id",lid).eq("user_id",uid);
    if(error) console.error("kickLobby error:",error);
  };

  const pendingCount = groups.reduce((a,g)=>a+(g.pendingRequests?.length||0),0)
    + lobbies.reduce((a,l)=>a+(l.pendingRequests?.length||0),0);
  const showNav = !playerView && !chatGroupId && !dmUserId && !lobbyDetailId && !groupDetailId && !editingProfile;

  const TABS = [
    {name:"Lobbies"}, {name:"Groups"}, {name:"Search"}, {name:"Map"}, {name:"Routes"}, {name:"Traps"}, {name:"Replays"}, {name:"Ranks"}, {name:"Profile"},
  ];
  const activeTab = showNav ? tab : null;
  const goTab = (name) => { setTab(name); setPlayerView(null); setChatGroupId(null); setDmUserId(null); setLobbyDetailId(null); setGroupDetailId(null); setEditingProfile(false); };

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
              <Av user={myProfile} size={32} isMe/>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">@{myProfile.username}</div>
                <TierBadge points={myProfile.points||0} />
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
          <div className="content fade" key={tab+playerView+chatGroupId+dmUserId+lobbyDetailId+groupDetailId+editingProfile}>
            {editingProfile ? (
              <EditProfile myProfile={myProfile} setMyProfile={setMyProfile} myCars={myCars} setMyCars={setMyCars} setMyCar={setMyCar} userId={session.user.id} onBack={()=>setEditingProfile(false)}/>
            ) : playerView ? (
              <UserProfile userId={playerView} onBack={()=>setPlayerView(null)}
                isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                groups={groups} isInGroup={isInGroup} sentGR={sentGR}
                joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile}
                openDM={(uid)=>{setPlayerView(null);setDmUserId(uid);}}/>
            ) : chatGroupId ? (
              <ChatView groupId={chatGroupId} groups={groups}
                onBack={()=>setChatGroupId(null)} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers}/>
            ) : dmUserId ? (
              <DMView otherUserId={dmUserId} onBack={()=>setDmUserId(null)}
                myProfile={myProfile} allUsers={allUsers}/>
            ) : lobbyDetailId ? (
              <LobbyDetail lobbyId={lobbyDetailId} lobbies={lobbies} setLobbies={setLobbies}
                onBack={()=>setLobbyDetailId(null)} openPlayer={setPlayerView}
                myProfile={myProfile} allUsers={allUsers} myCar={myCar} myCars={myCars}
                groups={groups} isInLobby={isInLobby} sentLR={sentLR} joinLobby={joinLobby}
                reqLobby={reqLobby} approveLobby={approveLobby} denyLobby={denyLobby} kickLobby={kickLobby}
                leaveLobby={leaveLobby} myActiveLobbyId={myActiveLobbyId} speedTraps={speedTraps}/>
            ) : groupDetailId ? (
              <GroupDetail groupId={groupDetailId} groups={groups} setGroups={setGroups}
                onBack={()=>setGroupDetailId(null)} openPlayer={setPlayerView}
                openChat={setChatGroupId} myProfile={myProfile} allUsers={allUsers}
                isInGroup={isInGroup} sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup} leaveGroup={leaveGroup}
                onCreateLobby={(gid)=>{setGroupDetailId(null);setCreateLobbyOpen(true);}}
                lobbies={lobbies} onCreateLobbyForGroup={(g)=>{
                  setGroupDetailId(null);
                  setCreateLobbyOpen(true);
                }}/>
            ) : tab==="Lobbies" ? (
              <LobbiesView lobbies={lobbies} setLobbies={setLobbies} myProfile={myProfile}
                allUsers={allUsers} groups={groups} isInLobby={isInLobby} sentLR={sentLR}
                joinLobby={joinLobby} reqLobby={reqLobby} leaveLobby={leaveLobby}
                myActiveLobbyId={myActiveLobbyId}
                openLobby={setLobbyDetailId} onCreateLobby={()=>setCreateLobbyOpen(true)}
                pendingCount={pendingCount} approveLobby={approveLobby} denyLobby={denyLobby}/>
            ) : tab==="Groups" ? (
              <GroupsView groups={groups} setGroups={setGroups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup} leaveGroup={leaveGroup}
                openChat={setChatGroupId} pendingCount={pendingCount}
                allUsers={allUsers} myProfile={myProfile} onCreateGroup={()=>setCreateGroupOpen(true)}
                openGroupDetail={setGroupDetailId}/>
            ) : tab==="Map" ? (
              <MapView groups={groups} openPlayer={setPlayerView}
                myProfile={myProfile} setMyProfile={setMyProfile} allUsers={allUsers} lobbies={lobbies}
                openGroupDetail={setGroupDetailId} speedTraps={speedTraps}/>
            ) : tab==="Search" ? (
              <SearchView isFriend={isFriend} sentFR={sentFR} addFR={addFR}
                openPlayer={setPlayerView} groups={groups} isInGroup={isInGroup}
                sentGR={sentGR} joinGroup={joinGroup} reqGroup={reqGroup}
                allUsers={allUsers} myProfile={myProfile} lobbies={lobbies}
                openLobby={setLobbyDetailId}/>
            ) : tab==="Routes" ? (
              <RoutesView myProfile={myProfile} allUsers={allUsers} groups={groups} myCar={myCar}/>
            ) : tab==="Traps" ? (
              <SpeedTrapsView myProfile={myProfile} allUsers={allUsers} myCar={myCar} speedTraps={speedTraps} setSpeedTraps={setSpeedTraps}/>
            ) : tab==="Replays" ? (
              <ReplaysView myProfile={myProfile} allUsers={allUsers}/>
            ) : tab==="Ranks" ? (
              <RanksView openPlayer={setPlayerView} myProfile={myProfile} allUsers={allUsers} myCar={myCar}/>
            ) : (
              <ProfileView myProfile={myProfile} friends={friends} groups={groups}
                openPlayer={setPlayerView} onEdit={()=>setEditingProfile(true)}
                onCreateGroup={()=>setCreateGroupOpen(true)}
                myCar={myCar} myCars={myCars} allUsers={allUsers} onLogWin={handleLogWin}
                openDM={setDmUserId}/>
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

      {/* Lobby approval toast */}
      {approvalToast && (
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"var(--green)",color:"#fff",borderRadius:12,padding:"12px 18px",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.4)",display:"flex",alignItems:"center",gap:10,maxWidth:320,width:"calc(100% - 40px)"}}>
          <span style={{fontSize:18}}>✅</span>
          <div style={{flex:1}}>
            <div>You're in — {approvalToast.lobbyName}</div>
            <div style={{fontSize:11,fontWeight:400,opacity:.85,marginTop:2}}>Tap to open the lobby</div>
          </div>
          <button style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",fontSize:12,cursor:"pointer"}}
            onClick={()=>{setLobbyDetailId(approvalToast.lobbyId);setTab("Lobbies");setApprovalToast(null);}}>
            Open
          </button>
        </div>
      )}
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
        <Av user={myProfile} size={32} isMe/>
        <div style={{flex:1}}>
          <div className="me-username">@{myProfile.username}</div>
          <div className="me-car">{myProfile.year} {myProfile.car}</div>
        </div>
        <TierBadge points={myProfile.points||0} />
      </div>
    </div>
  );
}

/* ─── LOBBIES VIEW ───────────────────────────────────────── */
function LobbiesView({ lobbies, setLobbies, myProfile, allUsers, groups, isInLobby, sentLR, joinLobby, reqLobby, leaveLobby, myActiveLobbyId, openLobby, onCreateLobby, pendingCount, approveLobby, denyLobby }) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [nightFilter, setNightFilter] = useState(false);
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
      .filter(l => !nightFilter || l.isNight)
      .sort((a,b) => {
        const da = haversine(myProfile.lat, myProfile.lng, a.lat, a.lng);
        const db = haversine(myProfile.lat, myProfile.lng, b.lat, b.lng);
        return da - db;
      });
  }, [lobbies, typeFilter, nightFilter, myProfile.lat, myProfile.lng]);

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
                    <Av user={u} size={32}/>
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

      {/* Night filter */}
      <div style={{padding:"0 16px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
        <button className={`pill ${nightFilter?"night-on":""}`} onClick={()=>setNightFilter(!nightFilter)}
          style={{display:"flex",alignItems:"center",gap:5}}>
          🌙 Night Only
        </button>
        {nightFilter && <span style={{fontSize:11,color:"rgba(167,139,250,.8)",letterSpacing:.3}}>Showing night lobbies only</span>}
      </div>

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
        // Block non-members from joining private group lobbies
        const groupLocked = group&&group.type==="private"&&!group.memberIds.includes(myProfile.id);

        return (
          <div key={l.id} className={`card click${l.isNight?" night-lobby":""}`} onClick={()=>openLobby(l.id)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span className="live-dot"/>
                {l.isNight
                  ? <span className="night-type-pill"><span className="night-glow">🌙</span>{l.type}</span>
                  : <span className="lobby-type-pill">{l.type}</span>
                }
                {!l.isOpen && <span style={{fontSize:9,color:"var(--muted2)",letterSpacing:.5}}>🔒 REQUEST</span>}
                {l.isNight && <span className="moon-badge">🌙</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {dist && <span className="dist-pill">{dist}</span>}
              </div>
            </div>

            <div className={`gc-name${l.isNight?" night-name":""}`} style={{marginTop:6}}>{l.name}</div>
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
              {inLobby && l.createdBy!==myProfile.id && (
                <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();leaveLobby(l.id);}}>Leave</button>
              )}
              {!inLobby && groupLocked && <span style={{fontSize:11,color:"var(--muted2)"}}>🔒 Members only</span>}
              {!inLobby && !pending && !groupLocked && (
                <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation(); l.isOpen?joinLobby(l.id):reqLobby(l.id);}}>
                  {myActiveLobbyId&&myActiveLobbyId!==l.id?"Switch Lobby":l.isOpen?"Join Lobby":"Request to Join"}
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

function fmtEta(date) {
  if (!date) return null;
  return date.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
}

function turnIcon(type, modifier) {
  if (type==="arrive") return "🏁";
  if (type==="depart") return "🚗";
  if (type==="roundabout"||type==="rotary") return "🔄";
  if (type==="merge") return "↗";
  if (type==="fork") return modifier?.includes("left")?"↖":"↗";
  if (type==="end of road") return modifier?.includes("left")?"←":"→";
  if (type==="continue"||type==="new name") return "⬆";
  if (!modifier) return "⬆";
  if (modifier==="left") return "←";
  if (modifier==="right") return "→";
  if (modifier==="slight left") return "↖";
  if (modifier==="slight right") return "↗";
  if (modifier==="sharp left") return "↩";
  if (modifier==="sharp right") return "↪";
  if (modifier==="uturn") return "↩↪";
  if (modifier==="straight") return "⬆";
  return "⬆";
}

/* ─── LOBBY DETAIL ───────────────────────────────────────── */
function LobbyDetail({ lobbyId, lobbies, setLobbies, onBack, openPlayer, myProfile, allUsers, myCar, myCars, groups, isInLobby, sentLR, joinLobby, reqLobby, approveLobby, denyLobby, kickLobby, leaveLobby, myActiveLobbyId, speedTraps }) {
  const l = lobbies.find(x=>x.id===lobbyId);
  const [memberCars, setMemberCars] = useState({});
  const [memberSpeeds, setMemberSpeeds] = useState({});
  const [memberLocations, setMemberLocations] = useState({});
  const [mySpeed, setMySpeed] = useState(null);
  const [followMe, setFollowMe] = useState(false);
  const [directions, setDirections] = useState(null); // {steps, distanceMi, durationMin, eta}
  const [currentStep, setCurrentStep] = useState(0);
  const [dirPanelOpen, setDirPanelOpen] = useState(true);
  const [memberEtas, setMemberEtas] = useState({}); // {userId: {distanceMi, durationMin, eta: Date}}
  const [navRefresh, setNavRefresh] = useState(0); // increments when user moves >0.1mi to re-fetch route
  const [changingDest, setChangingDest] = useState(false);
  const [destInput, setDestInput] = useState("");
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [savingDest, setSavingDest] = useState(false);
  const destDebounceRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState("");
  // Voice message recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  // Sub-rooms
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null); // room object
  const [roomMessages, setRoomMessages] = useState([]);
  const [roomInput, setRoomInput] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomMembers, setNewRoomMembers] = useState([]);
  const roomEndRef = useRef(null);
  const [gpsError, setGpsError] = useState("");
  const [permPrompt, setPermPrompt] = useState(false); // show permissions explainer on first join
  // Race mode
  const [raceState, setRaceState] = useState("idle"); // idle | countdown | racing | finished
  const [raceCountdown, setRaceCountdown] = useState(3);
  const [raceFormat, setRaceFormat] = useState("quarter_mile");
  const [rollFrom, setRollFrom] = useState(30);
  const [rollTo, setRollTo] = useState(130);
  const [rollCustomFrom, setRollCustomFrom] = useState("");
  const [rollCustomTo, setRollCustomTo] = useState("");
  const [rollShowCustom, setRollShowCustom] = useState(false);
  const rollFromRef = useRef(30);
  const rollToRef = useRef(130);
  useEffect(()=>{ rollFromRef.current = rollFrom; rollToRef.current = rollTo; }, [rollFrom, rollTo]);
  // Keep refs in sync so GPS callback never reads stale state
  useEffect(()=>{ raceFormatRef.current = raceFormat; }, [raceFormat]);
  useEffect(()=>{ directionsRef.current = directions; }, [directions]);
  useEffect(()=>{ currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(()=>{ navRefreshRef.current = navRefresh; }, [navRefresh]);
  const [raceResults, setRaceResults] = useState({}); // {userId: {ms, position}}
  const [myRaceMs, setMyRaceMs] = useState(null);
  const [raceChallenge, setRaceChallenge] = useState(null); // {fromId, fromUsername, format} incoming challenge
  const [raceChallengeOut, setRaceChallengeOut] = useState(null); // {toId, toUsername} sent challenge
  const raceStartTimeRef = useRef(null);
  const raceStartPosRef = useRef(null);
  const raceDistRef = useRef(0); // accumulated miles
  const raceFinishedRef = useRef(false);
  const raceSessionIdRef = useRef(null);
  const raceFormatRef = useRef("quarter_mile"); // ref so GPS callback always sees current value
  const raceContainerRef = useRef(null);
  const [raceFullscreen, setRaceFullscreen] = useState(false);
  const directionsRef = useRef(null);   // ref so GPS callback always sees current directions
  const currentStepRef = useRef(0);     // ref so GPS callback always sees current step
  const agoraClientRef = useRef(null);
  const agoraTrackRef = useRef(null);
  const chatEndRef = useRef(null);
  const knownMsgIds = useRef(new Set());
  const watchIdRef = useRef(null);
  const speedChannelRef = useRef(null);
  const recordingPathRef = useRef([]); // [{lat,lng,speed,timestamp}] accumulated during lobby
  const currentRecordingPosRef = useRef(null); // latest position for interval sampling
  const sessionSavedRef = useRef(false); // prevent double-save of session
  const [sessionSummary, setSessionSummary] = useState(null);
  const speedTrapsRef = useRef(speedTraps||[]);
  const activeTrapRef = useRef(null); // {trapId, startTime, topSpeed}
  const [trapResult, setTrapResult] = useState(null); // {name, time, topSpeed, isPersonalBest}
  useEffect(()=>{ speedTrapsRef.current = speedTraps||[]; }, [speedTraps]);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const memberMarkersRef = useRef({});
  const lastPosRef = useRef(null);
  const lastFetchPosRef = useRef(null); // last position used for route fetch — triggers re-fetch when user moves >0.1mi
  const etaFetchTimers = useRef({}); // debounce timers per userId for member ETA fetches
  const navRefreshRef = useRef(0); // mirror of navRefresh state for use in GPS callback

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
      style: l.isNight ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/dark-v11",
      center: [l.lng||(-122.67), l.lat||45.52],
      zoom: 13,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");
    return ()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  }, [inLobby, lobbyId]);

  // Fetch + draw MY directions when lobby has a destination
  const myLiveLat = memberLocations[myProfile.id]?.lat;
  const myLiveLng = memberLocations[myProfile.id]?.lng;
  useEffect(()=>{
    if (!inLobby||!l?.destLat||!l?.destLng) return;
    const myLat = myLiveLat || myProfile.lat;
    const myLng = myLiveLng || myProfile.lng;
    // If we don't have coords yet, try a one-shot getCurrentPosition to unblock the initial fetch
    if (!myLat||!myLng) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos=>setMemberLocations(prev=>({...prev,[myProfile.id]:{lat:pos.coords.latitude,lng:pos.coords.longitude}})),
          ()=>{}, {timeout:8000,maximumAge:30000}
        );
      }
      return;
    }
    // Record fetch position so GPS callback can trigger re-fetch after 0.1 miles
    if (!lastFetchPosRef.current) lastFetchPosRef.current = {lat:myLat, lng:myLng};
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${myLng},${myLat};${l.destLng},${l.destLat}?steps=true&geometries=geojson&banner_instructions=true&access_token=${MAPBOX_TOKEN}`)
      .then(r=>r.json())
      .then(data=>{
        const route = data.routes?.[0];
        if (!route) return;
        const durationSec = route.duration;
        const eta = new Date(Date.now() + durationSec * 1000);
        const steps = route.legs?.[0]?.steps?.map(s=>({
          instruction: s.maneuver?.instruction||"",
          distanceMi: (s.distance*0.000621371).toFixed(2),
          distanceFt: s.distance < 300 ? `${Math.round(s.distance*3.28084)} ft` : null,
          location: s.maneuver?.location,
          type: s.maneuver?.type||"",
          modifier: s.maneuver?.modifier||"",
        }))||[];
        setDirections(prev=>{
          // Don't reset currentStep if we already have steps (live re-route)
          if (!prev) { setCurrentStep(0); currentStepRef.current=0; }
          return { steps, distanceMi:(route.distance*0.000621371).toFixed(1), durationMin:Math.round(durationSec/60), eta, geometry:route.geometry };
        });
        lastFetchPosRef.current = {lat:myLat, lng:myLng};
        // Draw/update route on map
        const drawRoute = () => {
          if (!mapRef.current) return;
          if (mapRef.current.getSource("route")) {
            mapRef.current.getSource("route").setData(route.geometry);
            return;
          }
          mapRef.current.addSource("route",{type:"geojson",data:route.geometry});
          mapRef.current.addLayer({
            id:"route-casing",type:"line",source:"route",
            layout:{"line-join":"round","line-cap":"round"},
            paint:{"line-color":"#000","line-width":7,"line-opacity":0.4},
          });
          mapRef.current.addLayer({
            id:"route",type:"line",source:"route",
            layout:{"line-join":"round","line-cap":"round"},
            paint:{"line-color":"#e61a1a","line-width":4.5,"line-opacity":0.92},
          });
          // Destination marker
          const el = document.createElement("div");
          el.style.cssText="width:26px;height:26px;background:#e61a1a;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(230,26,26,.3),0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:12px;";
          el.textContent="🏁";
          new mapboxgl.Marker({element:el}).setLngLat([l.destLng,l.destLat]).addTo(mapRef.current);
          // Fit map to route
          const coords = route.geometry.coordinates;
          const bounds = coords.reduce((b,[lng,lat])=>b.extend([lng,lat]),new mapboxgl.LngLatBounds(coords[0],coords[0]));
          mapRef.current.fitBounds(bounds,{padding:50});
        };
        if (mapRef.current?.isStyleLoaded()) drawRoute();
        else mapRef.current?.on("load", drawRoute);
      }).catch(()=>{});
  // Re-fetch when: first GPS fix arrives, destination changes, or user moves >0.1mi (navRefresh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inLobby, lobbyId, l?.destLat, l?.destLng, l?.destination, !!myLiveLat, !!myProfile.lat, navRefresh]);

  // Fetch per-member ETAs for host view (debounced, fires when member locations update)
  useEffect(()=>{
    if (!l?.destLat||!l?.destLng||!inLobby) return;
    Object.entries(memberLocations).forEach(([uid, loc])=>{
      if (!loc?.lat||!loc?.lng) return;
      if (uid===myProfile.id) return; // my ETA comes from directions state
      // Debounce per member — don't hammer API
      clearTimeout(etaFetchTimers.current[uid]);
      etaFetchTimers.current[uid] = setTimeout(()=>{
        fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${loc.lng},${loc.lat};${l.destLng},${l.destLat}?overview=false&access_token=${MAPBOX_TOKEN}`)
          .then(r=>r.json())
          .then(data=>{
            const route = data.routes?.[0];
            if (!route) return;
            setMemberEtas(prev=>({...prev,[uid]:{
              distanceMi:(route.distance*0.000621371).toFixed(1),
              durationMin:Math.round(route.duration/60),
              eta: new Date(Date.now()+route.duration*1000),
            }}));
          }).catch(()=>{});
      }, 2000); // 2s debounce
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberLocations, l?.destLat, l?.destLng, inLobby]);

  // Step auto-advance is handled in the watchPosition GPS callback via directionsRef/currentStepRef

  // Update member markers on map when locations change
  useEffect(()=>{
    if (!mapRef.current||!inLobby) return;
    Object.entries(memberLocations).forEach(([uid,loc])=>{
      if (!loc?.lat||!loc?.lng) return;
      const user = members.find(m=>m.id===uid)||( uid===myProfile.id?myProfile:null);
      if (memberMarkersRef.current[uid]) {
        memberMarkersRef.current[uid].setLngLat([loc.lng,loc.lat]);
      } else {
        const el = document.createElement("div");
        const isMe = uid===myProfile.id;
        el.style.cssText = `width:36px;height:36px;border-radius:50%;border:2.5px solid ${isMe?"#e61a1a":"#fff"};overflow:hidden;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${isMe?"#e61a1a":"#fff"};box-shadow:${isMe?"0 0 0 3px rgba(230,26,26,0.35),0 2px 10px rgba(0,0,0,.7)":"0 2px 8px rgba(0,0,0,.7)"};flex-shrink:0;`;
        if (user?.avatarUrl) {
          const img=document.createElement("img");
          img.src=user.avatarUrl; img.style.cssText="width:100%;height:100%;object-fit:cover;display:block;";
          img.onerror=()=>{ img.remove(); el.textContent=user?.avatar||"?"; };
          el.appendChild(img);
        } else {
          el.textContent = user?.avatar||"?";
        }
        const marker = new mapboxgl.Marker({element:el}).setLngLat([loc.lng,loc.lat]).addTo(mapRef.current);
        memberMarkersRef.current[uid] = marker;
      }
    });
    // Remove markers for users no longer in lobby
    Object.keys(memberMarkersRef.current).forEach(uid=>{
      if (!memberLocations[uid]) { memberMarkersRef.current[uid].remove(); delete memberMarkersRef.current[uid]; }
    });
  }, [memberLocations, inLobby]);

  // Live GPS + speed + location broadcast while in lobby
  useEffect(()=>{
    if (!inLobby||!myProfile?.id) return;
    setGpsError("");
    const channelName = `lobby-speed-${lobbyId}`;
    const ch = supabase.channel(channelName,{config:{broadcast:{self:false}}});
    speedChannelRef.current = ch;
    ch.on("broadcast",{event:"speed"},(payload)=>{
      const p = payload.payload;
      if (p?.userId && p.userId!==myProfile.id) {
        setMemberSpeeds(prev=>({...prev,[p.userId]:p.mph}));
        if (p.lat!=null && p.lng!=null) {
          setMemberLocations(prev=>({...prev,[p.userId]:{lat:p.lat,lng:p.lng}}));
        }
      }
    })
    .on("broadcast",{event:"dest_update"},(payload)=>{
      const p = payload.payload;
      setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{...lo,destination:p.destination||null,destLat:p.destLat||null,destLng:p.destLng||null}:lo));
      // Clear directions + fetch pos so new route is fetched immediately
      setDirections(null);
      lastFetchPosRef.current = null;
    })
    .on("broadcast",{event:"race_start"},(payload)=>{
      const p = payload.payload;
      // Everyone in lobby receives the race start signal
      setRaceFormat(p.format||"quarter_mile");
      if (p.rollFrom != null) { setRollFrom(p.rollFrom); rollFromRef.current = p.rollFrom; }
      if (p.rollTo != null)   { setRollTo(p.rollTo);   rollToRef.current = p.rollTo; }
      setRaceResults({});
      setMyRaceMs(null);
      raceFinishedRef.current = false;
      raceDistRef.current = 0;
      raceStartPosRef.current = null;
      raceSessionIdRef.current = p.sessionId||null;
      // Start countdown
      setRaceState("countdown");
      setRaceCountdown(3);
      let c = 3;
      const iv = setInterval(()=>{
        c--;
        setRaceCountdown(c);
        if (c <= 0) {
          clearInterval(iv);
          setTimeout(()=>{
            raceStartTimeRef.current = (p.format||"quarter_mile")==="roll" ? 0 : Date.now();
            raceStartPosRef.current = lastPosRef.current;
            setRaceState("racing");
          }, 700);
        }
      }, 1000);
    })
    .on("broadcast",{event:"race_finish"},(payload)=>{
      const p = payload.payload;
      if (p.userId !== myProfile.id) {
        setRaceResults(prev=>({...prev,[p.userId]:{ms:p.ms,position:p.position}}));
      }
    })
    .on("broadcast",{event:"race_cancel"},(()=>{
      setRaceState("idle"); setRaceResults({}); setMyRaceMs(null);
      raceFinishedRef.current=false; raceDistRef.current=0; raceStartTimeRef.current=null;
    }))
    .on("broadcast",{event:"race_challenge"},(payload)=>{
      const p = payload.payload;
      if (p?.toId === myProfile.id) {
        setRaceChallenge({fromId:p.fromId, fromUsername:p.fromUsername, format:p.format||"quarter_mile"});
        setTimeout(()=>setRaceChallenge(c=>c?.fromId===p.fromId?null:c), 30000);
      }
    })
    .on("broadcast",{event:"race_accept"},(payload)=>{
      const p = payload.payload;
      if (p?.toId === myProfile.id) {
        setRaceChallengeOut(null);
        // Host starts race automatically when opponent accepts
        startRace(p.format||"quarter_mile");
      }
    })
    .subscribe((status)=>{
      if (status==="CHANNEL_ERROR") setGpsError("Live connection error. Reload to reconnect.");
    });

    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos)=>{
        setGpsError("");
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const ts = pos.timestamp;
        // Use coords.speed if available, otherwise compute from consecutive positions
        let mph = 0;
        if (pos.coords.speed!=null && pos.coords.speed>=0) {
          mph = Math.round(pos.coords.speed*2.237);
        } else if (lastPosRef.current) {
          const prev = lastPosRef.current;
          const dt = (ts - prev.ts) / 1000; // seconds
          if (dt > 0) {
            const dist = haversine(prev.lat, prev.lng, lat, lng); // miles
            mph = Math.round((dist / dt) * 3600);
          }
        }
        mph = Math.max(0, Math.min(mph, 200)); // sanity cap
        lastPosRef.current = {lat, lng, ts};
        currentRecordingPosRef.current = {lat, lng, speed: mph};
        setMySpeed(mph);

        // ── Speed trap detection ─────────────────────────────────
        const traps = speedTrapsRef.current;
        if (traps.length > 0) {
          if (!activeTrapRef.current) {
            // Check if near any trap start
            for (const trap of traps) {
              const distToStart = haversine(lat, lng, trap.startLat, trap.startLng) * 1609.34;
              if (distToStart < 30) {
                activeTrapRef.current = {trapId: trap.id, startTime: Date.now(), topSpeed: mph};
                break;
              }
            }
          } else {
            const trap = traps.find(t => t.id === activeTrapRef.current.trapId);
            if (trap) {
              // Update top speed
              if (mph > activeTrapRef.current.topSpeed) activeTrapRef.current.topSpeed = mph;
              // Check if reached end
              const distToEnd = haversine(lat, lng, trap.endLat, trap.endLng) * 1609.34;
              if (distToEnd < 30) {
                const elapsed = (Date.now() - activeTrapRef.current.startTime) / 1000;
                if (elapsed > 1) { // sanity: at least 1 second
                  const carInfo = myCar?.make && myCar?.model ? `${myCar.year||""} ${myCar.make} ${myCar.model}`.trim() : null;
                  supabase.from("speed_trap_times").insert({
                    trap_id: trap.id, user_id: myProfile.id,
                    time_seconds: elapsed, top_speed_mph: activeTrapRef.current.topSpeed,
                    car_info: carInfo,
                  }).catch(()=>{});
                  setTrapResult({name: trap.name, time: elapsed, topSpeed: activeTrapRef.current.topSpeed});
                  setTimeout(()=>setTrapResult(null), 6000);
                }
                activeTrapRef.current = null;
              }
              // Abort if moved too far from both start and end (went off course)
              const distToStart = haversine(lat, lng, trap.startLat, trap.startLng) * 1609.34;
              if (distToStart > 5000 && distToEnd > 5000) activeTrapRef.current = null;
            } else {
              activeTrapRef.current = null;
            }
          }
        }
        setMemberSpeeds(prev=>({...prev,[myProfile.id]:mph}));
        setMemberLocations(prev=>({...prev,[myProfile.id]:{lat,lng}}));
        ch.send({type:"broadcast",event:"speed",payload:{userId:myProfile.id,mph,lat,lng}});

        // ── Race tracking ──────────────────────────────────────
        if (raceStartTimeRef.current && !raceFinishedRef.current) {
          const acc = pos.coords.accuracy;
          // Skip bad GPS fixes (>20m accuracy)
          if (acc <= 20 && raceStartPosRef.current) {
            const prev = raceStartPosRef.current;
            const incr = haversine(prev.lat, prev.lng, lat, lng); // miles
            // Cap per-update increment at 0.05mi to filter GPS jumps
            if (incr > 0 && incr < 0.05) {
              raceDistRef.current += incr;
            }
          }
          // Update start pos for next delta even if we skipped
          if (!raceStartPosRef.current) raceStartPosRef.current = {lat, lng};

          // Determine target distance in miles
          const fmt = raceFormatRef.current;
          const targets = {quarter_mile:0.25, half_mile:0.5};
          const target = targets[fmt];

          // Roll race: timer starts when speed hits rollFrom, stops when speed hits rollTo
          if (fmt==="roll") {
            const from = rollFromRef.current;
            const to   = rollToRef.current;
            // If we haven't started timing yet and just hit the entry speed, mark start
            if (raceStartTimeRef.current===0 && mph >= from) {
              raceStartTimeRef.current = Date.now();
            }
            if (raceStartTimeRef.current && raceStartTimeRef.current!==0 && mph >= to) {
              const elapsedMs = Date.now() - raceStartTimeRef.current;
              raceFinishedRef.current = true;
              setMyRaceMs(elapsedMs);
              setRaceState("finished");
              ch.send({type:"broadcast",event:"race_finish",payload:{userId:myProfile.id,ms:elapsedMs,position:1}});
              if (raceSessionIdRef.current) {
                supabase.from("race_participants").upsert({
                  race_id: raceSessionIdRef.current, user_id: myProfile.id,
                  car_id: myCar?.id||null, elapsed_ms: elapsedMs,
                  finished_at: new Date().toISOString(),
                },{onConflict:"race_id,user_id"}).catch(()=>{});
              }
            }
            return; // skip the normal distance/speed logic below
          }

          const elapsedMs = Date.now() - raceStartTimeRef.current;

          // Speed threshold races: 0-60 and 0-120
          const hitSpeed = (fmt==="zero_sixty"&&mph>=60) || (fmt==="zero_120"&&mph>=120);
          const hitDist = target && raceDistRef.current >= target;

          if (hitSpeed || hitDist) {
            raceFinishedRef.current = true;
            setMyRaceMs(elapsedMs);
            setRaceState("finished");
            // Broadcast my finish to lobby
            ch.send({type:"broadcast",event:"race_finish",payload:{userId:myProfile.id,ms:elapsedMs,position:1}});
            // Save to DB
            if (raceSessionIdRef.current) {
              supabase.from("race_participants").upsert({
                race_id: raceSessionIdRef.current, user_id: myProfile.id,
                car_id: myCar?.id||null, elapsed_ms: elapsedMs,
                finished_at: new Date().toISOString(),
              },{onConflict:"race_id,user_id"}).catch(()=>{});
            }
          }
        }

        // ── Nav re-fetch trigger: re-route when user moves >0.1 miles ─
        if (lastFetchPosRef.current) {
          const distFromLastFetch = haversine(lastFetchPosRef.current.lat, lastFetchPosRef.current.lng, lat, lng);
          if (distFromLastFetch > 0.1) {
            lastFetchPosRef.current = {lat, lng};
            setNavRefresh(n => n + 1);
          }
        }

        // ── Navigation step auto-advance ──────────────────────────
        const dir = directionsRef.current;
        if (dir?.steps?.length && !raceStartTimeRef.current) {
          const step = currentStepRef.current;
          if (step < dir.steps.length - 1) {
            const nextLoc = dir.steps[step + 1]?.location; // [lng, lat]
            if (nextLoc) {
              const distToNext = haversine(lat, lng, nextLoc[1], nextLoc[0]) * 1609.34; // meters
              if (distToNext < 60) {
                const next = step + 1;
                currentStepRef.current = next;
                setCurrentStep(next);
              }
            }
          }
        }
      },
      (err)=>{
        if (err.code===1) setGpsError("GPS permission denied. Allow location access to broadcast your speed.");
        else if (err.code===2) setGpsError("GPS signal unavailable. Move to an open area.");
        else setGpsError("GPS timed out. Retrying…");
      },
      {enableHighAccuracy:true,maximumAge:2000,timeout:15000}
    );

    // Record GPS position every 2 seconds
    recordingPathRef.current = [];
    currentRecordingPosRef.current = null;
    const recordInterval = setInterval(() => {
      const pos = currentRecordingPosRef.current;
      if (pos) {
        recordingPathRef.current = [...recordingPathRef.current, {...pos, timestamp: Date.now()}];
      }
    }, 2000);

    return ()=>{
      if (watchIdRef.current!=null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(recordInterval);
      supabase.removeChannel(ch);
      speedChannelRef.current = null;
      lastPosRef.current = null;
      // Auto-save recording if enough points
      const path = recordingPathRef.current;
      const capturedLobbyId = lobbyId;
      const capturedUserId = myProfile?.id;
      if (path.length >= 3 && capturedLobbyId && capturedUserId) {
        supabase.from("lobby_recordings").upsert({
          lobby_id: capturedLobbyId,
          user_id: capturedUserId,
          path_data: path,
        }, {onConflict: "lobby_id,user_id"}).catch(()=>{});
      }
      // Silently save session stats if not already saved via modal
      if (!sessionSavedRef.current && path.length >= 5 && capturedUserId) {
        sessionSavedRef.current = true;
        const miles = computeMilesFromPath(path);
        const speeds = path.map(p=>p.speed||0).filter(s=>s>0);
        const topSpeed = speeds.length ? Math.max(...speeds) : 0;
        const avgSpeed = speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0;
        const dur = path.length >= 2 ? Math.round((path[path.length-1].timestamp - path[0].timestamp) / 1000) : 0;
        supabase.from("sessions").insert({
          user_id: capturedUserId, session_type: "lobby",
          miles_driven: parseFloat(miles.toFixed(3)),
          top_speed_mph: topSpeed, avg_speed_mph: avgSpeed,
          duration_seconds: dur,
          started_at: new Date(path[0].timestamp).toISOString(),
          ended_at: new Date().toISOString(),
        }).catch(()=>{});
      }
      recordingPathRef.current = [];
      currentRecordingPosRef.current = null;
      sessionSavedRef.current = false;
    };
  }, [inLobby, lobbyId, myProfile?.id]);

  // Load lobby chat + realtime
  useEffect(()=>{
    if (!lobbyId) return;
    setChatLoading(true); knownMsgIds.current=new Set(); setChatMessages([]);
    supabase.from("lobby_messages").select("*, profiles(username,avatar_initials,avatar_url)")
      .eq("lobby_id",lobbyId).order("created_at",{ascending:true}).limit(100)
      .then(({data})=>{
        if(data){
          data.forEach(m=>knownMsgIds.current.add(m.id));
          setChatMessages(data.map(m=>({id:m.id,uid:m.user_id,username:m.profiles?.username||"?",avatar:m.profiles?.avatar_initials||"?",avatarUrl:m.profiles?.avatar_url||"",text:m.content,ts:m.created_at,messageType:m.message_type||"text",voiceUrl:m.voice_url,voiceDuration:m.voice_duration})));
        }
        setChatLoading(false);
      });
    const ch = supabase.channel(`lobby-chat-${lobbyId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"lobby_messages",filter:`lobby_id=eq.${lobbyId}`},async(payload)=>{
        const row=payload.new;
        if(knownMsgIds.current.has(row.id)) return;
        knownMsgIds.current.add(row.id);
        const known=allUsers.find(u=>u.id===row.user_id)||( row.user_id===myProfile.id?myProfile:null);
        const username=known?.username||"?", avatar=known?.avatar||"?", avatarUrl=known?.avatarUrl||"";
        setChatMessages(prev=>[...prev,{id:row.id,uid:row.user_id,username,avatar,avatarUrl,text:row.content,ts:row.created_at,messageType:row.message_type||"text",voiceUrl:row.voice_url,voiceDuration:row.voice_duration}]);
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  }, [lobbyId]);

  // Realtime lobby_members — host sees requests, requester sees approval
  useEffect(()=>{
    if (!lobbyId) return;
    // Initial refresh to catch any state changes that happened while we were away
    supabase.from("lobby_members").select("user_id,status,mic_active").eq("lobby_id",lobbyId).then(({data})=>{
      if(!data) return;
      setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{
        ...lo,
        memberIds:data.filter(m=>m.status==="active").map(m=>m.user_id),
        pendingRequests:data.filter(m=>m.status==="pending").map(m=>m.user_id),
        micUsers:data.filter(m=>m.mic_active).map(m=>m.user_id),
      }:lo));
    });
    const ch = supabase.channel(`lobby-members-${lobbyId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"lobby_members",filter:`lobby_id=eq.${lobbyId}`},async()=>{
        const{data}=await supabase.from("lobby_members").select("user_id,status,mic_active").eq("lobby_id",lobbyId);
        if(!data) return;
        setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{
          ...lo,
          memberIds:data.filter(m=>m.status==="active").map(m=>m.user_id),
          pendingRequests:data.filter(m=>m.status==="pending").map(m=>m.user_id),
          micUsers:data.filter(m=>m.mic_active).map(m=>m.user_id),
        }:lo));
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  }, [lobbyId]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMessages.length]);

  const sendChat = async () => {
    const text=chatInput.trim(); if(!text) return;
    setChatInput("");
    await supabase.from("lobby_messages").insert({lobby_id:lobbyId,user_id:myProfile.id,content:text,message_type:"text"});
    const newPts = (myProfile.points||0) + 1;
    supabase.from("profiles").update({points:newPts}).eq("id",myProfile.id);
  };

  // ── Voice message recording ──────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder = new MediaRecorder(stream, {mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"});
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => { if(e.data.size>0) recordingChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(recordingChunksRef.current, {type: recorder.mimeType});
        if (blob.size < 1000) return; // too short
        const duration = recordingTime;
        const ext = recorder.mimeType.includes("webm") ? "webm" : "m4a";
        const path = `lobby/${lobbyId}/${myProfile.id}_${Date.now()}.${ext}`;
        const {error:upErr} = await supabase.storage.from("voice-messages").upload(path, blob, {contentType:recorder.mimeType});
        if (upErr) { console.error("Voice upload error:", upErr); return; }
        const {data:{publicUrl}} = supabase.storage.from("voice-messages").getPublicUrl(path);
        await supabase.from("lobby_messages").insert({
          lobby_id:lobbyId, user_id:myProfile.id, content:"🎤 Voice message",
          message_type:"voice", voice_url:publicUrl, voice_duration:duration,
        });
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(()=>setRecordingTime(t=>t+1), 1000);
    } catch(err) {
      console.error("Recording error:", err);
      setMicError("Could not access microphone for recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t=>t.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    clearInterval(recordingTimerRef.current);
    recordingChunksRef.current = [];
  };

  // ── Sub-rooms: load rooms for this lobby ──────────────────────
  useEffect(()=>{
    if (!lobbyId || !inLobby) return;
    supabase.from("lobby_rooms").select("*,lobby_room_members(user_id)").eq("lobby_id",lobbyId)
      .then(({data})=>{
        if (data) setRooms(data.map(r=>({...r,memberIds:r.lobby_room_members?.map(m=>m.user_id)||[]})));
      });
    const ch = supabase.channel(`lobby-rooms-${lobbyId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"lobby_rooms",filter:`lobby_id=eq.${lobbyId}`},async()=>{
        const{data}=await supabase.from("lobby_rooms").select("*,lobby_room_members(user_id)").eq("lobby_id",lobbyId);
        if(data) setRooms(data.map(r=>({...r,memberIds:r.lobby_room_members?.map(m=>m.user_id)||[]})));
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[lobbyId, inLobby]);

  // Load room messages when activeRoom changes
  useEffect(()=>{
    if (!activeRoom) { setRoomMessages([]); return; }
    supabase.from("lobby_room_messages").select("*,profiles(username,avatar_initials,avatar_url)")
      .eq("room_id",activeRoom.id).order("created_at",{ascending:true}).limit(100)
      .then(({data})=>{
        if(data) setRoomMessages(data.map(m=>({id:m.id,uid:m.user_id,username:m.profiles?.username||"?",avatar:m.profiles?.avatar_initials||"?",avatarUrl:m.profiles?.avatar_url||"",text:m.content,ts:m.created_at,messageType:m.message_type||"text",voiceUrl:m.voice_url,voiceDuration:m.voice_duration})));
      });
    const ch = supabase.channel(`room-chat-${activeRoom.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"lobby_room_messages",filter:`room_id=eq.${activeRoom.id}`},async(payload)=>{
        const row=payload.new;
        const known=allUsers.find(u=>u.id===row.user_id)||(row.user_id===myProfile.id?myProfile:null);
        setRoomMessages(prev=>[...prev,{id:row.id,uid:row.user_id,username:known?.username||"?",avatar:known?.avatar||"?",avatarUrl:known?.avatarUrl||"",text:row.content,ts:row.created_at,messageType:row.message_type||"text",voiceUrl:row.voice_url,voiceDuration:row.voice_duration}]);
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[activeRoom?.id]);

  useEffect(()=>{roomEndRef.current?.scrollIntoView({behavior:"smooth"});},[roomMessages.length]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const {data,error} = await supabase.from("lobby_rooms").insert({lobby_id:lobbyId,name:newRoomName.trim(),created_by:myProfile.id}).select().single();
    if (error||!data) return;
    // Add creator + selected members
    const memberInserts = [myProfile.id, ...newRoomMembers].map(uid=>({room_id:data.id,user_id:uid}));
    await supabase.from("lobby_room_members").insert(memberInserts);
    setShowCreateRoom(false); setNewRoomName(""); setNewRoomMembers([]);
  };

  const sendRoomMessage = async () => {
    const text=roomInput.trim(); if(!text||!activeRoom) return;
    setRoomInput("");
    await supabase.from("lobby_room_messages").insert({room_id:activeRoom.id,user_id:myProfile.id,content:text,message_type:"text"});
  };

  // Voice message in sub-room
  const sendRoomVoice = async (blob, duration) => {
    if (!activeRoom) return;
    const ext = blob.type.includes("webm") ? "webm" : "m4a";
    const path = `rooms/${activeRoom.id}/${myProfile.id}_${Date.now()}.${ext}`;
    const {error:upErr} = await supabase.storage.from("voice-messages").upload(path, blob, {contentType:blob.type});
    if (upErr) return;
    const {data:{publicUrl}} = supabase.storage.from("voice-messages").getPublicUrl(path);
    await supabase.from("lobby_room_messages").insert({
      room_id:activeRoom.id, user_id:myProfile.id, content:"🎤 Voice message",
      message_type:"voice", voice_url:publicUrl, voice_duration:duration,
    });
  };

  // ── Race control functions ──────────────────────────────────
  const startRace = async (format) => {
    if (!speedChannelRef.current) return;
    setRaceFormat(format);
    // Create race session in DB
    let sessionId = null;
    try {
      const {data} = await supabase.from("race_sessions").insert({
        lobby_id: lobbyId, format, created_by: myProfile.id,
      }).select().single();
      sessionId = data?.id||null;
      raceSessionIdRef.current = sessionId;
    } catch(_){}
    // Broadcast start to all lobby members
    speedChannelRef.current.send({type:"broadcast",event:"race_start",payload:{format,sessionId,rollFrom:rollFromRef.current,rollTo:rollToRef.current}});
    // Also trigger locally (self:false so we need to handle ourselves)
    setRaceResults({});
    setMyRaceMs(null);
    raceFinishedRef.current = false;
    raceDistRef.current = 0;
    raceStartPosRef.current = lastPosRef.current;
    setRaceState("countdown");
    setRaceCountdown(3);
    let c = 3;
    const iv = setInterval(()=>{
      c--;
      setRaceCountdown(c);
      if (c <= 0) {
        clearInterval(iv);
        setTimeout(()=>{
          // Roll race: timer starts when speed hits rollFrom (set ref to 0 as sentinel)
          raceStartTimeRef.current = raceFormatRef.current==="roll" ? 0 : Date.now();
          raceStartPosRef.current = lastPosRef.current;
          setRaceState("racing");
        }, 700);
      }
    }, 1000);
  };

  const cancelRace = () => {
    if (speedChannelRef.current) speedChannelRef.current.send({type:"broadcast",event:"race_cancel",payload:{}});
    setRaceState("idle"); setRaceResults({}); setMyRaceMs(null);
    raceFinishedRef.current=false; raceDistRef.current=0; raceStartTimeRef.current=null;
  };

  // Resolve winner when results come in
  const allResults = myRaceMs!=null
    ? {...raceResults,[myProfile.id]:{ms:myRaceMs}}
    : raceResults;
  const sortedRacers = Object.entries(allResults).sort((a,b)=>a[1].ms-b[1].ms);
  const winnerId = sortedRacers[0]?.[0]||null;

  // Auto-save winner stats when race finishes and all known members have results
  useEffect(()=>{
    if (raceState!=="finished"||!myRaceMs||!raceSessionIdRef.current) return;
    const membersInRace = Object.keys(allResults);
    if (membersInRace.length < 2) return; // wait for at least 2 results
    const winner = sortedRacers[0]?.[0];
    const myPos = sortedRacers.findIndex(([id])=>id===myProfile.id)+1;
    // Update positions in DB
    sortedRacers.forEach(([uid,],i)=>{
      supabase.from("race_participants").update({position:i+1}).eq("race_id",raceSessionIdRef.current).eq("user_id",uid).catch(()=>{});
    });
    // Finish the session
    supabase.from("race_sessions").update({status:"finished",finished_at:new Date().toISOString()}).eq("id",raceSessionIdRef.current).catch(()=>{});
    // Award win/race to current user via existing handler
    if (myPos===1) {
      supabase.from("profiles").update({
        wins: {...(myProfile.wins||{}), h2h: ((myProfile.wins?.h2h||0)+1)},
        races: {...(myProfile.races||{}), h2h: ((myProfile.races?.h2h||0)+1)},
        points: (myProfile.points||0)+5,
      }).eq("id",myProfile.id).catch(()=>{});
    } else {
      supabase.from("profiles").update({
        races: {...(myProfile.races||{}), h2h: ((myProfile.races?.h2h||0)+1)},
      }).eq("id",myProfile.id).catch(()=>{});
    }
    // Save best time to race_times table if better than existing
    const secs = parseFloat((myRaceMs/1000).toFixed(3));
    const timeKey = {quarter_mile:"quarter_mile",half_mile:"half_mile",zero_sixty:"zero_sixty",zero_120:"zero_120"}[raceFormatRef.current];
    if (timeKey) {
      supabase.from("race_times").upsert({
        user_id: myProfile.id, car_id: myCar?.id||null,
        [timeKey]: secs,
      },{onConflict:"user_id,car_id"}).catch(()=>{});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceState, Object.keys(allResults).length]);

  // Keep audio context alive when app goes to background (mobile workaround)
  // Plays a silent loop so iOS/Android don't suspend the audio context
  const silentAudioRef = useRef(null);
  useEffect(()=>{
    if (!micOn) return;
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const buf = ctx.createBuffer(1,1,22050);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      src.connect(ctx.destination); src.start(0);
      silentAudioRef.current = { ctx, src };
      const resume = () => ctx.state==="suspended" && ctx.resume();
      document.addEventListener("visibilitychange", resume);
      return ()=>{
        document.removeEventListener("visibilitychange", resume);
        src.stop(); ctx.close();
        silentAudioRef.current = null;
      };
    } catch(_){}
  }, [micOn]);

  // Clean up Agora on unmount
  useEffect(()=>{
    return ()=>{
      if (agoraTrackRef.current) { agoraTrackRef.current.close(); agoraTrackRef.current=null; }
      if (agoraClientRef.current) { agoraClientRef.current.leave().catch(()=>{}); agoraClientRef.current=null; }
    };
  }, [lobbyId]);

  const toggleMic = async () => {
    setMicError("");
    if (!micOn) {
      // Turn mic ON — join Agora channel
      try {
        const client = AgoraRTC.createClient({ mode:"rtc", codec:"vp8" });
        agoraClientRef.current = client;

        // Subscribe to other users' audio when they publish
        client.on("user-published", async(user, mediaType)=>{
          await client.subscribe(user, mediaType);
          if (mediaType==="audio") user.audioTrack?.play();
        });
        client.on("user-unpublished", async(user)=>{
          await client.unsubscribe(user);
        });

        // Use a numeric UID derived from the user's UUID
        const uid = Math.abs(myProfile.id.split("-").join("").slice(0,8).split("").reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0)) % 100000;
        await client.join(AGORA_APP_ID, lobbyId, null, uid);

        const track = await AgoraRTC.createMicrophoneAudioTrack();
        agoraTrackRef.current = track;
        await client.publish(track);

        setMicOn(true);
        await supabase.from("lobby_members").update({mic_active:true}).eq("lobby_id",lobbyId).eq("user_id",myProfile.id);
        setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{...lo,micUsers:[...new Set([...lo.micUsers,myProfile.id])]}:lo));
      } catch(err) {
        console.error("Agora mic error:", err);
        const msg = err?.message||"";
        if (msg.includes("Permission")||msg.includes("NotAllowed")||err?.name==="NotAllowedError") {
          setMicError("Microphone permission denied. Tap the lock icon in your browser address bar and allow microphone access, then try again.");
        } else if (!AGORA_APP_ID) {
          setMicError("Voice chat is not configured. Contact support.");
        } else if (msg.includes("INVALID_VENDOR_KEY")||msg.includes("vendor")) {
          setMicError("Voice chat App ID is invalid. Contact support.");
        } else {
          setMicError(`Could not start microphone: ${msg||"unknown error"}. Check your browser settings and try again.`);
        }
        if (agoraClientRef.current) { agoraClientRef.current.leave().catch(()=>{}); agoraClientRef.current=null; }
      }
    } else {
      // Turn mic OFF
      if (agoraTrackRef.current) { agoraTrackRef.current.close(); agoraTrackRef.current=null; }
      if (agoraClientRef.current) { await agoraClientRef.current.leave().catch(()=>{}); agoraClientRef.current=null; }
      setMicOn(false);
      await supabase.from("lobby_members").update({mic_active:false}).eq("lobby_id",lobbyId).eq("user_id",myProfile.id);
      setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{...lo,micUsers:lo.micUsers.filter(id=>id!==myProfile.id)}:lo));
    }
  };

  const handleDestInput = (val) => {
    setDestInput(val);
    setDestSuggestions([]);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    if (!val.trim()) return;
    destDebounceRef.current = setTimeout(async()=>{
      const prox = (myLiveLat||myProfile.lat)&&(myLiveLng||myProfile.lng)
        ? `&proximity=${myLiveLng||myProfile.lng},${myLiveLat||myProfile.lat}` : "";
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5${prox}`);
        const data = await res.json();
        setDestSuggestions((data.features||[]).map(f=>({name:f.place_name,short:f.text,lat:f.center?.[1]??null,lng:f.center?.[0]??null})));
      } catch(_){}
    }, 300);
  };

  const handleSetDest = async (name, lat, lng) => {
    setSavingDest(true);
    setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{...lo,destination:name,destLat:lat,destLng:lng}:lo));
    try { await supabase.from("lobbies").update({destination:name,dest_lat:lat,dest_lng:lng}).eq("id",lobbyId); } catch(_){}
    speedChannelRef.current?.send({type:"broadcast",event:"dest_update",payload:{destination:name,destLat:lat,destLng:lng}});
    setDirections(null); lastFetchPosRef.current = null;
    setChangingDest(false); setDestInput(""); setDestSuggestions([]);
    setSavingDest(false);
  };

  const handleClearDest = async () => {
    setLobbies(ls=>ls.map(lo=>lo.id===lobbyId?{...lo,destination:null,destLat:null,destLng:null}:lo));
    try { await supabase.from("lobbies").update({destination:null,dest_lat:null,dest_lng:null}).eq("id",lobbyId); } catch(_){}
    speedChannelRef.current?.send({type:"broadcast",event:"dest_update",payload:{destination:null,destLat:null,destLng:null}});
    setDirections(null); lastFetchPosRef.current = null;
    setChangingDest(false); setDestInput(""); setDestSuggestions([]);
  };

  if (!l) return null;
  const members = l.memberIds.map(id=>getU(id,allUsers,myProfile)).filter(Boolean);
  const pending = l.pendingRequests?.map(id=>getU(id,allUsers,myProfile)).filter(Boolean)||[];
  const isMyLobby = l.createdBy===myProfile.id;
  const lobbyGroup = l.groupId ? (groups||[]).find(g=>g.id===l.groupId) : null;
  const groupLocked = lobbyGroup&&lobbyGroup.type==="private"&&!lobbyGroup.memberIds.includes(myProfile.id);

  const buildSessionSummary = () => {
    const path = recordingPathRef.current;
    if (path.length < 5 || sessionSavedRef.current) return null;
    const miles = computeMilesFromPath(path);
    const speeds = path.map(p=>p.speed||0).filter(s=>s>0);
    const topSpeed = speeds.length ? Math.max(...speeds) : 0;
    const avgSpeed = speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0;
    const dur = path.length >= 2 ? Math.round((path[path.length-1].timestamp - path[0].timestamp) / 1000) : 0;
    return { miles, topSpeed, avgSpeed, durationSec: dur, startedAt: new Date(path[0].timestamp), lobbyName: l?.name };
  };

  const saveAndShowSession = (onAfter) => {
    const summary = buildSessionSummary();
    if (!summary) { onAfter(); return; }
    sessionSavedRef.current = true;
    supabase.from("sessions").insert({
      user_id: myProfile.id, session_type: "lobby",
      miles_driven: parseFloat(summary.miles.toFixed(3)),
      top_speed_mph: summary.topSpeed, avg_speed_mph: summary.avgSpeed,
      duration_seconds: summary.durationSec,
      started_at: summary.startedAt.toISOString(),
      ended_at: new Date().toISOString(),
    }).catch(()=>{});
    setSessionSummary({...summary, onDone: onAfter});
  };

  const handleBack = () => saveAndShowSession(onBack);
  const handleLeaveSession = async () => {
    await leaveLobby(lobbyId);
    saveAndShowSession(onBack);
  };

  return (
    <div className="fade">
      <button className="back-btn" onClick={handleBack}>← Lobbies</button>
      {sessionSummary && <SessionSummaryModal summary={sessionSummary} onDone={()=>{ setSessionSummary(null); sessionSummary.onDone?.(); }}/>}

      {/* Speed trap result toast */}
      {trapResult && (
        <div className="trap-toast">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{fontSize:22}}>⚡</span>
            <div>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,letterSpacing:1}}>SPEED TRAP</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{trapResult.name}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:16}}>
            <div>
              <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.5}}>TIME</div>
              <div style={{fontSize:18,fontWeight:900,color:"#f59e0b",fontFamily:"var(--font-mono)"}}>{fmtGhostTime(trapResult.time)}</div>
            </div>
            <div>
              <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.5}}>TOP SPEED</div>
              <div style={{fontSize:18,fontWeight:900,color:"var(--accent)",fontFamily:"var(--font-mono)"}}>{trapResult.topSpeed}<span style={{fontSize:11,fontWeight:400,color:"var(--muted2)"}}> mph</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span className="live-dot"/>
          <span className="lobby-type-pill">{l.type}</span>
          {!l.isOpen && <span style={{fontSize:9,color:"var(--muted2)"}}>🔒 REQUEST ONLY</span>}
        </div>
        <div className="pg-title">{l.name}</div>

        {/* Destination row */}
        {!changingDest ? (
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
            {l.destination
              ? <span style={{fontSize:12,color:"var(--muted)",flex:1}}>→ {l.destination}</span>
              : <span style={{fontSize:12,color:"var(--muted2)"}}>No destination set</span>
            }
            {(isMyLobby||inLobby) && (
              <button onClick={()=>{setChangingDest(true);setDestInput(l.destination||"");}}
                style={{fontSize:11,fontWeight:600,color:"var(--accent)",background:"rgba(230,26,26,.1)",border:"1px solid rgba(230,26,26,.25)",borderRadius:6,padding:"3px 9px",cursor:"pointer"}}>
                {l.destination?"Change":"Set Destination"}
              </button>
            )}
            {l.destination&&isMyLobby&&(
              <button onClick={handleClearDest}
                style={{fontSize:11,color:"var(--muted2)",background:"transparent",border:"1px solid var(--border)",borderRadius:6,padding:"3px 9px",cursor:"pointer"}}>
                ✕ Clear
              </button>
            )}
          </div>
        ) : (
          <div style={{marginTop:8,position:"relative"}}>
            <div style={{display:"flex",gap:6}}>
              <input autoFocus className="inp" style={{flex:1,fontSize:13,padding:"9px 12px"}}
                value={destInput} onChange={e=>handleDestInput(e.target.value)}
                onBlur={()=>setTimeout(()=>setDestSuggestions([]),200)}
                placeholder="Search a destination…"/>
              <button onClick={()=>{setChangingDest(false);setDestInput("");setDestSuggestions([]);}}
                style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,padding:"0 12px",color:"var(--muted)",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
            {destSuggestions.length>0&&(
              <div style={{position:"absolute",left:0,right:0,top:"100%",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,marginTop:4,zIndex:200,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>
                {destSuggestions.map((s,i)=>(
                  <div key={i} onMouseDown={()=>handleSetDest(s.short||s.name, s.lat, s.lng)}
                    style={{padding:"11px 14px",cursor:"pointer",borderBottom:i<destSuggestions.length-1?"1px solid var(--border)":undefined,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:14,flexShrink:0}}>📍</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{s.short}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{s.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky navigation banner — shown when lobby has a destination and directions loaded */}
      {directions && raceState==="idle" && (
        <div style={{position:"sticky",top:0,zIndex:50,background:"#111",borderBottom:"2px solid var(--accent)",boxShadow:"0 2px 16px rgba(0,0,0,.6)"}}>
          {/* Main instruction row */}
          <div style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{
              width:44,height:44,borderRadius:12,
              background:"var(--accent)",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:currentStep>=directions.steps.length-1?18:22,fontWeight:900,color:"#fff",
              boxShadow:"0 0 0 3px rgba(230,26,26,.25)",
            }}>
              {currentStep>=directions.steps.length-1?"🏁":turnIcon(directions.steps[currentStep]?.type,directions.steps[currentStep]?.modifier)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text)",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {currentStep>=directions.steps.length-1
                  ? `Arrive at ${l.destination}`
                  : directions.steps[currentStep]?.instruction||"Head to destination"}
              </div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
                {currentStep<directions.steps.length-1&&(directions.steps[currentStep]?.distanceFt||directions.steps[currentStep]?.distanceMi) && (
                  <span style={{color:"var(--accent)",fontWeight:600}}>
                    in {directions.steps[currentStep].distanceFt||`${directions.steps[currentStep].distanceMi} mi`}
                  </span>
                )}
                <span>{directions.distanceMi} mi · {directions.durationMin} min</span>
                {directions.eta&&<span style={{color:"var(--green)",fontWeight:600}}>ETA {fmtEta(directions.eta)}</span>}
              </div>
            </div>
            <button onClick={()=>setDirPanelOpen(v=>!v)}
              style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",color:"var(--muted)",fontSize:11,cursor:"pointer",flexShrink:0,fontWeight:600}}>
              {dirPanelOpen?"Hide":"Steps"}
            </button>
          </div>
          {/* Progress strip */}
          {directions.steps.length>1&&(
            <div style={{height:3,background:"var(--s3)",margin:"0 16px 8px"}}>
              <div style={{height:"100%",width:`${Math.round((currentStep/(directions.steps.length-1))*100)}%`,background:"var(--accent)",borderRadius:2,transition:"width .4s"}}/>
            </div>
          )}
        </div>
      )}

      {/* Permissions prompt overlay */}
      {permPrompt && (
        <div style={{margin:"0 16px 12px",background:"var(--s2)",border:"1px solid var(--accent)",borderRadius:12,padding:"16px"}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>📍 Allow Location & Microphone</div>
          <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6,marginBottom:12}}>
            0xrace needs two permissions to work inside a lobby:<br/>
            <strong style={{color:"var(--text)"}}>📍 Location</strong> — broadcasts your live position and speed on the map.<br/>
            <strong style={{color:"var(--text)"}}>🎙 Microphone</strong> — lets you talk with your crew via voice chat.<br/><br/>
            Your browser will ask. If you accidentally blocked either one, tap the <strong style={{color:"var(--text)"}}>lock icon 🔒</strong> in your address bar → Site settings → Allow both.
          </div>
          <button className="btn btn-primary btn-full" style={{borderRadius:10}} onClick={()=>setPermPrompt(false)}>Got it</button>
        </div>
      )}

      {/* Join controls */}
      {!inLobby && (
        <div style={{padding:"0 16px 14px",display:"flex",flexDirection:"column",gap:8}}>
          {groupLocked ? (
            <div style={{textAlign:"center",fontSize:12,color:"var(--muted)",padding:"10px 0"}}>🔒 This lobby is for {lobbyGroup.name} members only</div>
          ) : myActiveLobbyId && myActiveLobbyId !== lobbyId ? (
            <div>
              <div style={{fontSize:12,color:"var(--muted)",marginBottom:8,textAlign:"center"}}>You're already in another lobby. Leave it to join this one.</div>
              <button className="btn btn-primary btn-full" style={{borderRadius:10}} onClick={()=>{ joinLobby(lobbyId); setPermPrompt(true); }}>
                Leave current lobby &amp; Join
              </button>
            </div>
          ) : !sentLR(lobbyId) ? (
            <button className="btn btn-primary btn-full" style={{borderRadius:10}} onClick={()=>{ l.isOpen?joinLobby(lobbyId):reqLobby(lobbyId); if(l.isOpen) setPermPrompt(true); }}>
              {l.isOpen?"Join Lobby":"Request to Join"}
            </button>
          ) : (
            <button className="btn btn-secondary btn-full" disabled style={{borderRadius:10}}>Request Sent — Awaiting Approval</button>
          )}
        </div>
      )}

      {/* Leave lobby button (members only, not host) */}
      {inLobby && !isMyLobby && (
        <div style={{padding:"0 16px 8px"}}>
          <button className="btn btn-secondary btn-full" style={{borderRadius:10,fontSize:13}}
            onClick={handleLeaveSession}>
            Leave Lobby
          </button>
        </div>
      )}

      {/* MPH + Follow Me (only for members) */}
      {inLobby && (
        <>
          {/* Car selector */}
          {myCars&&myCars.length>1&&(
            <div style={{padding:"0 16px 8px"}}>
              <label className="inp-label">Your Car</label>
              <select className="inp" style={{appearance:"none",cursor:"pointer"}} defaultValue={myCar?.id||""}
                onChange={e=>{
                  const car = myCars.find(c=>c.id===e.target.value);
                  if (car) {
                    supabase.from("user_cars").update({is_primary:false}).eq("user_id",myProfile.id);
                    supabase.from("user_cars").update({is_primary:true}).eq("id",car.id);
                  }
                }}>
                {myCars.map(c=>(
                  <option key={c.id} value={c.id}>{[c.year,c.make,c.model].filter(Boolean).join(" ")}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prompt host to set destination if none exists */}
          {!l.destination && isMyLobby && !changingDest && (
            <div style={{margin:"0 16px 8px",padding:"12px 14px",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>📍</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>No destination set</div>
                <div style={{fontSize:11,color:"var(--muted)"}}>Set one so your crew gets turn-by-turn directions</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={()=>setChangingDest(true)}>Set</button>
            </div>
          )}

          {gpsError&&<div style={{margin:"0 16px 8px",padding:"10px 14px",background:"rgba(255,59,48,.1)",border:"1px solid rgba(255,59,48,.25)",borderRadius:8,fontSize:12,color:"var(--red)"}}>{gpsError}</div>}

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

          <div className="sec-lbl">Live Speeds {l.destination&&<span style={{fontSize:10,color:"var(--muted2)",fontWeight:400,marginLeft:4}}>→ {l.destination}</span>}</div>
          <div className="card" style={{marginBottom:8}}>
            {[...members].sort((a,b)=>{
              // Sort by ETA when destination set, else by speed
              if (l.destination) {
                const etaA = a.id===myProfile.id ? directions?.durationMin : memberEtas[a.id]?.durationMin;
                const etaB = b.id===myProfile.id ? directions?.durationMin : memberEtas[b.id]?.durationMin;
                if (etaA!=null&&etaB!=null) return etaA-etaB;
                if (etaA!=null) return -1;
                if (etaB!=null) return 1;
              }
              return (memberSpeeds[b.id]??-1)-(memberSpeeds[a.id]??-1);
            }).map((m,i)=>{
              const isMe = m.id===myProfile.id;
              const eta = isMe ? (directions ? {durationMin:directions.durationMin, distanceMi:directions.distanceMi, eta:directions.eta} : null) : memberEtas[m.id];
              return (
                <div key={m.id} className="mph-member">
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--muted2)",width:16,textAlign:"right"}}>{i+1}</span>
                    <Av user={m} size={28} isMe={isMe}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600}}>@{m.username}{isMe&&<span style={{fontSize:9,color:"var(--accent)",marginLeft:5}}>YOU</span>}</div>
                      {memberCars[m.id]&&<div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{memberCars[m.id].str}</div>}
                      {l.destination&&eta&&(
                        <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"var(--green)",fontWeight:600}}>{eta.durationMin} min away</span>
                          <span style={{fontSize:10,color:"var(--muted2)"}}>·</span>
                          <span style={{fontSize:10,color:"var(--muted)"}}>{eta.distanceMi} mi</span>
                          {eta.eta&&<span style={{fontSize:10,color:"var(--muted)"}}>· ETA {fmtEta(eta.eta)}</span>}
                        </div>
                      )}
                      {l.destination&&!eta&&memberLocations[m.id]&&(
                        <div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>Calculating…</div>
                      )}
                      {l.destination&&!memberLocations[m.id]&&(
                        <div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>No GPS yet</div>
                      )}
                    </div>
                  </div>
                  {!isMe&&raceState==="idle"&&(
                    <button onClick={()=>{
                      const fmt = "quarter_mile";
                      setRaceChallengeOut({toId:m.id,toUsername:m.username});
                      speedChannelRef.current?.send({type:"broadcast",event:"race_challenge",payload:{fromId:myProfile.id,fromUsername:myProfile.username,toId:m.id,format:fmt}});
                      setTimeout(()=>setRaceChallengeOut(o=>o?.toId===m.id?null:o), 30000);
                    }} style={{background:"rgba(230,26,26,.15)",border:"1px solid rgba(230,26,26,.3)",borderRadius:7,padding:"4px 8px",fontSize:12,color:"var(--accent)",cursor:"pointer",flexShrink:0,fontWeight:700}}>
                      ⚡ Race
                    </button>
                  )}
                  <span className="mph-member-speed" style={{color:memberSpeeds[m.id]!=null?"var(--text)":"var(--muted2)",fontSize:memberSpeeds[m.id]!=null?undefined:11}}>
                    {memberSpeeds[m.id]!=null?`${memberSpeeds[m.id]} mph`:"—"}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Sent challenge toast */}
          {raceChallengeOut&&(
            <div style={{margin:"0 16px 8px",padding:"10px 14px",background:"rgba(230,26,26,.1)",border:"1px solid rgba(230,26,26,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,color:"var(--accent)"}}>⚡ Challenge sent to @{raceChallengeOut.toUsername}…</span>
              <button onClick={()=>setRaceChallengeOut(null)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
          )}
          {/* Incoming challenge toast */}
          {raceChallenge&&(
            <div style={{margin:"0 16px 8px",padding:"12px 14px",background:"rgba(230,26,26,.12)",border:"2px solid var(--accent)",borderRadius:12,animation:"fu .2s ease"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--accent)",marginBottom:6}}>⚡ Race Challenge from @{raceChallenge.fromUsername}!</div>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:10}}>{raceChallenge.format.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary btn-sm" onClick={()=>{
                  speedChannelRef.current?.send({type:"broadcast",event:"race_accept",payload:{toId:raceChallenge.fromId,format:raceChallenge.format}});
                  setRaceChallenge(null);
                  // Non-host just waits for race_start signal from host
                }}>Accept</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>setRaceChallenge(null)}>Decline</button>
              </div>
            </div>
          )}

          {/* Directions panel — collapsible */}
          {directions && dirPanelOpen && (
            <>
              <div className="sec-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:16}}>
                <span>Turn-by-Turn · {directions.steps.length-1} steps</span>
                <span style={{fontSize:11,color:"var(--muted)",fontWeight:400}}>{directions.distanceMi} mi · {directions.durationMin} min{directions.eta?` · ETA ${fmtEta(directions.eta)}`:""}</span>
              </div>
              <div style={{margin:"0 16px 8px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
                {directions.steps.slice(0,-1).map((s,i)=>{
                  const isPast = i<currentStep;
                  const isCurrent = i===currentStep;
                  return (
                    <div key={i} onClick={()=>{setCurrentStep(i);currentStepRef.current=i;}}
                      style={{
                        padding:"10px 14px",
                        borderBottom:i<directions.steps.length-2?"1px solid var(--border)":undefined,
                        display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                        background:isCurrent?"rgba(230,26,26,.08)":isPast?"rgba(255,255,255,.02)":undefined,
                        opacity:isPast?0.45:1,
                        transition:"background .15s,opacity .15s",
                      }}>
                      {/* Turn icon */}
                      <div style={{
                        width:34,height:34,borderRadius:8,flexShrink:0,
                        background:isCurrent?"var(--accent)":isPast?"var(--s3)":"var(--s3)",
                        border:`1px solid ${isCurrent?"var(--accent)":"var(--border)"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:16,transition:"background .15s",
                      }}>
                        {isPast?"✓":turnIcon(s.type,s.modifier)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:isCurrent?"var(--text)":"var(--text2)",fontWeight:isCurrent?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.instruction}</div>
                        <div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>
                          {s.distanceFt||`${s.distanceMi} mi`}
                        </div>
                      </div>
                      {isCurrent&&<div style={{fontSize:10,color:"var(--accent)",fontWeight:700,flexShrink:0,background:"rgba(230,26,26,.12)",padding:"3px 7px",borderRadius:6}}>NOW</div>}
                    </div>
                  );
                })}
                {/* Destination row */}
                <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:12,background:"rgba(0,192,96,.05)"}}>
                  <div style={{width:34,height:34,borderRadius:8,flexShrink:0,background:"rgba(0,192,96,.15)",border:"1px solid rgba(0,192,96,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏁</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--green)"}}>Arrive at {l.destination}</div>
                    {directions.eta&&<div style={{fontSize:10,color:"rgba(0,192,96,.7)",marginTop:2}}>ETA {fmtEta(directions.eta)}</div>}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="sec-lbl">Live Map</div>
          <div className="map-wrap" style={{height:220}}>
            <div ref={mapContainer} style={{width:"100%",height:"100%"}}/>
          </div>

          {/* Race Mode */}
          <div className="sec-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:16}}>
            <span>Race Mode</span>
            {raceState!=="idle"&&isMyLobby&&<button className="btn btn-secondary btn-sm" style={{fontSize:10}} onClick={cancelRace}>Cancel</button>}
          </div>

          {raceState==="idle" && (
            <div style={{margin:"0 16px 10px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",padding:"14px"}}>
              <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>Both phones need GPS active. Host taps a format to start a synced countdown for everyone in the lobby.</div>

              {/* ── Roll Race (top) ───────────────────────────── */}
              <div style={{marginBottom:10,background:"var(--s3)",borderRadius:10,border:"1px solid var(--border)",padding:"12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{fontSize:20}}>🌀</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>Roll Race</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>Timer starts at entry speed, stops at exit speed</div>
                  </div>
                </div>
                {/* Preset speed ranges */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {[[20,80],[30,130],[40,140],[50,160],[60,160]].map(([f,t])=>(
                    <button key={`${f}-${t}`}
                      onClick={()=>{setRollFrom(f);setRollTo(t);rollFromRef.current=f;rollToRef.current=t;setRollShowCustom(false);}}
                      style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",border:`1px solid ${rollFrom===f&&rollTo===t&&!rollShowCustom?"var(--accent)":"var(--border)"}`,background:rollFrom===f&&rollTo===t&&!rollShowCustom?"rgba(230,26,26,.15)":"transparent",color:rollFrom===f&&rollTo===t&&!rollShowCustom?"var(--accent)":"var(--muted2)"}}>
                      {f}–{t}
                    </button>
                  ))}
                  <button onClick={()=>setRollShowCustom(v=>!v)}
                    style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",border:`1px solid ${rollShowCustom?"var(--accent)":"var(--border)"}`,background:rollShowCustom?"rgba(230,26,26,.15)":"transparent",color:rollShowCustom?"var(--accent)":"var(--muted2)"}}>
                    Custom
                  </button>
                </div>
                {/* Custom range inputs */}
                {rollShowCustom&&(
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                    <input type="number" min={1} max={299} value={rollCustomFrom}
                      onChange={e=>{const v=Math.min(299,Math.max(1,+e.target.value||1));setRollCustomFrom(e.target.value);setRollFrom(v);rollFromRef.current=v;}}
                      placeholder="From mph" className="inp" style={{flex:1,padding:"8px 10px",fontSize:13,textAlign:"center"}}/>
                    <span style={{color:"var(--muted)",fontWeight:700}}>→</span>
                    <input type="number" min={2} max={300} value={rollCustomTo}
                      onChange={e=>{const v=Math.min(300,Math.max(2,+e.target.value||2));setRollCustomTo(e.target.value);setRollTo(v);rollToRef.current=v;}}
                      placeholder="To mph" className="inp" style={{flex:1,padding:"8px 10px",fontSize:13,textAlign:"center"}}/>
                  </div>
                )}
                <div style={{fontSize:12,color:"var(--muted2)",marginBottom:8,textAlign:"center"}}>
                  Selected: <span style={{color:"var(--accent)",fontWeight:700}}>{rollFrom}–{rollTo} mph</span>
                </div>
                <button disabled={!isMyLobby} onClick={()=>startRace("roll")}
                  style={{width:"100%",padding:"11px 12px",background:isMyLobby?"var(--accent)":"var(--s2)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:isMyLobby?"pointer":"default",opacity:isMyLobby?1:0.5}}>
                  {isMyLobby?"START ROLL RACE →":"Waiting for host…"}
                </button>
              </div>

              {/* ── Other formats ──────────────────────────────── */}
              {[
                {key:"quarter_mile", label:"¼ Mile", desc:"0.25 mi drag", icon:"🏁"},
                {key:"half_mile",    label:"½ Mile", desc:"0.5 mi run",   icon:"🛣"},
                {key:"zero_sixty",   label:"0–60",   desc:"0 to 60 mph",  icon:"⚡"},
                {key:"zero_120",     label:"0–120",  desc:"0 to 120 mph", icon:"🚀"},
              ].map(f=>(
                <button key={f.key} disabled={!isMyLobby}
                  onClick={()=>startRace(f.key)}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 12px",marginBottom:6,background:"var(--s3)",border:"1px solid var(--border)",borderRadius:10,cursor:isMyLobby?"pointer":"default",color:"var(--text)",opacity:isMyLobby?1:0.5,textAlign:"left"}}>
                  <span style={{fontSize:20}}>{f.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700}}>{f.label}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{f.desc}</div>
                  </div>
                  {isMyLobby&&<span style={{fontSize:11,color:"var(--accent)",fontWeight:600}}>START →</span>}
                </button>
              ))}
              {!isMyLobby&&<div style={{fontSize:11,color:"var(--muted2)",textAlign:"center",marginTop:4}}>Waiting for host to start a race…</div>}
            </div>
          )}

          {(raceState==="countdown"||raceState==="racing") && (
            <div ref={raceContainerRef} style={{margin:raceFullscreen?"0":"0 16px 10px",background:raceFullscreen?"#000":"var(--s2)",borderRadius:raceFullscreen?0:12,border:`2px solid ${raceState==="racing"?"var(--green)":raceCountdown===3?"#ff3333":raceCountdown===0?"#00ff55":"#ffcc00"}`,padding:"24px 16px",textAlign:"center",transition:"border-color .2s",position:raceFullscreen?"fixed":"relative",inset:raceFullscreen?"0":undefined,zIndex:raceFullscreen?9999:undefined,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
              {/* GO flash overlay */}
              {raceState==="countdown"&&raceCountdown===0&&(
                <div style={{position:"absolute",inset:0,background:"rgba(0,255,80,0.35)",pointerEvents:"none",zIndex:1,animation:"goFlash .7s ease-out forwards"}}/>
              )}
              <button onClick={()=>{
                if (!raceFullscreen) { raceContainerRef.current?.requestFullscreen?.().catch(()=>{}); setRaceFullscreen(true); }
                else { document.exitFullscreen?.().catch(()=>{}); setRaceFullscreen(false); }
              }} style={{position:"absolute",top:10,right:10,background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,color:"var(--muted)",cursor:"pointer",zIndex:2}}>
                {raceFullscreen?"⛶ Exit":"⛶ Full"}
              </button>
              {raceState==="countdown" ? (
                <>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,marginBottom:14}}>
                    <div style={{
                      width:raceFullscreen?80:52,height:raceFullscreen?80:52,borderRadius:"50%",
                      background:raceCountdown===3?"#ff3333":"#1a0000",
                      boxShadow:raceCountdown===3?"0 0 28px #ff3333, 0 0 60px #ff3333cc":"none",
                      transition:"background .15s,box-shadow .15s"
                    }}/>
                    <div style={{
                      width:raceFullscreen?80:52,height:raceFullscreen?80:52,borderRadius:"50%",
                      background:(raceCountdown===2||raceCountdown===1)?"#ffcc00":"#1a1100",
                      boxShadow:(raceCountdown===2||raceCountdown===1)?"0 0 28px #ffcc00, 0 0 60px #ffcc00cc":"none",
                      transition:"background .15s,box-shadow .15s"
                    }}/>
                    <div style={{
                      width:raceFullscreen?80:52,height:raceFullscreen?80:52,borderRadius:"50%",
                      background:raceCountdown===0?"#00ff55":"#001a0a",
                      boxShadow:raceCountdown===0?"0 0 40px #00ff55, 0 0 80px #00ff55ee, 0 0 120px #00ff5566":"none",
                      transition:"background .15s,box-shadow .15s"
                    }}/>
                  </div>
                  <div style={{fontSize:raceFullscreen?120:64,fontWeight:900,fontFamily:"var(--font-display)",lineHeight:1,color:raceCountdown===3?"#ff3333":raceCountdown===0?"#00ff55":"#ffcc00",transition:"color .15s",textShadow:raceCountdown===0?"0 0 40px #00ff55, 0 0 80px #00ff5588":"none"}}>
                    {raceCountdown===0?"GO!":raceCountdown}
                  </div>
                  <div style={{fontSize:raceFullscreen?18:13,color:"var(--muted)",marginTop:8}}>{raceCountdown===0?"FLOOR IT!":"Get ready…"}</div>
                </>
              ) : (
                <>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--green)",marginBottom:8}}>
                    🟢 {raceFormat==="roll"?`ROLL RACE ${rollFrom}–${rollTo} mph`:raceFormat.replace(/_/g," ").toUpperCase()}
                    {raceFormat==="roll"&&raceStartTimeRef.current===0&&<span style={{fontSize:11,color:"var(--accent)",marginLeft:8}}>Waiting for {rollFrom} mph…</span>}
                  </div>
                  {members.map(m=>{
                    const res = allResults[m.id];
                    const pct = raceFormat==="quarter_mile"||raceFormat==="half_mile"
                      ? Math.min(100, m.id===myProfile.id ? (raceDistRef.current/(raceFormat==="half_mile"?0.5:0.25))*100 : (res?100:0))
                      : raceFormat==="roll"
                      ? (res ? 100 : m.id===myProfile.id ? Math.min(100,((Math.max(0,(memberSpeeds[m.id]||0)-rollFrom))/(rollTo-rollFrom))*100) : 0)
                      : m.id===myProfile.id ? Math.min(100,((memberSpeeds[m.id]||0)/(raceFormat==="zero_sixty"?60:120))*100) : (res?100:0);
                    return (
                      <div key={m.id} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,fontWeight:600}}>@{m.username}</span>
                          <span style={{fontSize:11,color:"var(--muted)"}}>{res?`${(res.ms/1000).toFixed(3)}s`:"racing…"}</span>
                        </div>
                        <div style={{height:8,background:"var(--s3)",borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:res?"var(--green)":"var(--accent)",borderRadius:4,transition:"width .3s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {raceState==="finished" && (
            <div style={{margin:"0 16px 10px",background:"var(--s2)",borderRadius:12,border:"2px solid var(--green)",padding:"16px"}}>
              <div style={{fontSize:14,fontWeight:700,color:"var(--green)",marginBottom:10,textAlign:"center"}}>🏁 Race Complete</div>
              {sortedRacers.map(([uid, res], i)=>{
                const u = getU(uid, allUsers, myProfile);
                const isWinner = i===0;
                return (
                  <div key={uid} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",marginBottom:6,background:isWinner?"rgba(0,192,96,.08)":"var(--s3)",borderRadius:10,border:`1px solid ${isWinner?"rgba(0,192,96,.3)":"var(--border)"}`}}>
                    <span style={{fontSize:18,fontWeight:900,color:isWinner?"var(--green)":"var(--muted2)",width:24,textAlign:"center"}}>{i+1}</span>
                    <Av user={u} size={28} isMe={uid===myProfile.id}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700}}>@{u?.username||"?"}{uid===myProfile.id&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
                      {memberCars[uid]&&<div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{memberCars[uid].str}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,fontWeight:800,fontFamily:"var(--font-mono)",color:isWinner?"var(--green)":"var(--text)"}}>{(res.ms/1000).toFixed(3)}s</div>
                      {isWinner&&<div style={{fontSize:10,color:"var(--green)",fontWeight:600}}>+5 pts</div>}
                    </div>
                  </div>
                );
              })}
              {Object.keys(allResults).length < members.length && (
                <div style={{fontSize:11,color:"var(--muted)",textAlign:"center",marginTop:6}}>Waiting for other racers…</div>
              )}
              <button className="btn btn-secondary btn-full" style={{marginTop:10,borderRadius:10}} onClick={()=>{setRaceState("idle");setRaceResults({});setMyRaceMs(null);}}>Race Again</button>
            </div>
          )}
        </>
      )}

      {/* Pending requests (host only) */}
      {isMyLobby && pending.length>0 && (
        <>
          <div className="sec-lbl">Join Requests ({pending.length})</div>
          <div className="card" style={{marginBottom:8}}>
            {pending.map(u=>(
              <div key={u.id} className="lobby-user-row">
                <Av user={u} size={32} style={{cursor:"pointer"}} onClick={()=>openPlayer(u.id)}/>
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
      <div className="list-card" style={{margin:"0 16px 8px"}}>
        {members.map(m=>{
          const car = memberCars[m.id];
          const isMicOn = l.micUsers?.includes(m.id);
          const isMe = m.id===myProfile.id;
          return (
            <div key={m.id} className="list-item">
              <div style={{cursor:isMe?undefined:"pointer"}} onClick={()=>!isMe&&openPlayer(m.id)}>
                <Av user={m} size={32} isMe={isMe}/>
              </div>
              <div className="list-item-info" style={{cursor:isMe?undefined:"pointer"}} onClick={()=>!isMe&&openPlayer(m.id)}>
                <div className="list-item-title">
                  @{m.username}
                  {isMe&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}
                  {m.id===l.createdBy&&<span style={{fontSize:9,color:"var(--muted2)",marginLeft:4,background:"var(--s3)",padding:"1px 5px",borderRadius:3,border:"1px solid var(--border)"}}>HOST</span>}
                </div>
                {car&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10,display:"flex",alignItems:"center",gap:5}}>
                  {car.str}{car.buildStage&&car.buildStage!=="stock"&&<BuildBadge stage={car.buildStage}/>}
                </div>}
                {inLobby&&memberSpeeds[m.id]!=null&&<div style={{fontSize:10,color:"var(--accent)",marginTop:2}}>{memberSpeeds[m.id]} mph</div>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {isMicOn
                  ? <span className="mic-on" title="Mic on"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg></span>
                  : null}
                {isMyLobby&&!isMe&&<button className="btn btn-secondary btn-sm" style={{fontSize:10,padding:"2px 8px"}} onClick={()=>kickLobby(lobbyId,m.id)}>Kick</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mic toggle (members only) */}
      {inLobby&&(
        <div style={{padding:"0 16px 10px"}}>
          <button
            className={`btn btn-full ${micOn?"btn-primary":"btn-secondary"}`}
            style={{borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}
            onClick={toggleMic}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {micOn
                ? <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></>
                : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></>
              }
            </svg>
            {micOn ? "Mic On — Tap to Mute" : "Tap to Unmute Mic"}
          </button>
          {micError&&<div style={{fontSize:11,color:"var(--red)",marginTop:6,lineHeight:1.4}}>{micError}</div>}
        </div>
      )}

      {/* Lobby Chat */}
      {inLobby&&(
        <>
          <div className="sec-lbl">Lobby Chat</div>
          <div style={{margin:"0 16px 6px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",maxHeight:260,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
            {chatLoading&&<div style={{fontSize:12,color:"var(--muted)",textAlign:"center"}}>Loading…</div>}
            {!chatLoading&&chatMessages.length===0&&<div style={{fontSize:12,color:"var(--muted)",textAlign:"center"}}>No messages yet. Say something!</div>}
            {chatMessages.map(msg=>(
              <div key={msg.id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <Av user={{avatar:msg.avatar,avatarUrl:msg.avatarUrl}} size={24} isMe={msg.uid===myProfile.id}/>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:11,fontWeight:600,color:msg.uid===myProfile.id?"var(--accent)":"var(--text)"}}>{msg.username} </span>
                  {msg.messageType==="voice"&&msg.voiceUrl ? (
                    <div style={{marginTop:4,display:"flex",alignItems:"center",gap:8,background:"var(--s3)",borderRadius:10,padding:"8px 12px",border:"1px solid var(--border)"}}>
                      <button onClick={(e)=>{const a=e.currentTarget.nextElementSibling;if(a.paused)a.play();else a.pause();}} style={{background:"var(--accent)",border:"none",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
                      </button>
                      <audio src={msg.voiceUrl} preload="metadata" style={{display:"none"}}/>
                      <div style={{flex:1}}>
                        <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{width:"0%",height:"100%",background:"var(--accent)",borderRadius:2,transition:"width .1s"}}/>
                        </div>
                      </div>
                      <span style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)",flexShrink:0}}>{msg.voiceDuration?`${msg.voiceDuration}s`:""}</span>
                    </div>
                  ) : (
                    <span style={{fontSize:12,color:"var(--text2)",wordBreak:"break-word"}}>{msg.text}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          {/* Chat input + voice record */}
          <div style={{margin:"0 16px 6px",display:"flex",gap:6,alignItems:"center"}}>
            {isRecording ? (
              <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"rgba(230,26,26,.08)",border:"1px solid rgba(230,26,26,.3)",borderRadius:10,padding:"8px 12px"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"var(--accent)",animation:"pulse 1s infinite"}}/>
                <span style={{fontSize:12,fontWeight:600,color:"var(--accent)",fontFamily:"var(--font-mono)"}}>{recordingTime}s</span>
                <div style={{flex:1}}/>
                <button onClick={cancelRecording} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:12,padding:"2px 6px"}}>Cancel</button>
                <button onClick={stopRecording} className="btn btn-primary btn-sm" style={{borderRadius:8}}>Send</button>
              </div>
            ) : (
              <>
                <input className="inp" placeholder="Say something…" value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendChat()}
                  style={{flex:1,padding:"10px 12px"}}/>
                <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={!chatInput.trim()}>Send</button>
                <button onClick={startRecording} title="Record voice message"
                  style={{background:"var(--s3)",border:"1px solid var(--border)",borderRadius:10,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Sub-Rooms */}
      {inLobby&&(
        <>
          <div className="sec-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:16}}>
            Chat Rooms
            <button onClick={()=>setShowCreateRoom(true)} style={{background:"none",border:"none",color:"var(--accent)",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ New Room</button>
          </div>

          {/* Create room modal */}
          {showCreateRoom&&(
            <div style={{margin:"0 16px 10px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",padding:"14px 16px"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Create Chat Room</div>
              <input className="inp" placeholder="Room name…" value={newRoomName} onChange={e=>setNewRoomName(e.target.value)} style={{marginBottom:8}}/>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Add members:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10,maxHeight:100,overflowY:"auto"}}>
                {members.filter(m=>m.id!==myProfile.id).map(m=>(
                  <button key={m.id} onClick={()=>setNewRoomMembers(prev=>prev.includes(m.id)?prev.filter(x=>x!==m.id):[...prev,m.id])}
                    style={{fontSize:11,padding:"4px 10px",borderRadius:8,cursor:"pointer",border:"1px solid",
                      background:newRoomMembers.includes(m.id)?"rgba(230,26,26,.1)":"var(--s3)",
                      borderColor:newRoomMembers.includes(m.id)?"var(--accent)":"var(--border)",
                      color:newRoomMembers.includes(m.id)?"var(--accent)":"var(--text)"}}>
                    @{m.username}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-primary btn-sm" onClick={createRoom} disabled={!newRoomName.trim()}>Create</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setShowCreateRoom(false);setNewRoomName("");setNewRoomMembers([]);}}>Cancel</button>
              </div>
            </div>
          )}

          {/* Room list */}
          {rooms.length===0&&!showCreateRoom&&(
            <div style={{margin:"0 16px 8px",fontSize:12,color:"var(--muted)",textAlign:"center"}}>No chat rooms yet. Create one to chat privately.</div>
          )}
          {rooms.length>0&&!activeRoom&&(
            <div className="list-card" style={{margin:"0 16px 8px"}}>
              {rooms.map(r=>{
                const isMember = r.memberIds?.includes(myProfile.id);
                const creator = allUsers.find(u=>u.id===r.created_by)||myProfile;
                return (
                  <div key={r.id} className="list-item" style={{cursor:isMember?"pointer":"default"}} onClick={()=>isMember&&setActiveRoom(r)}>
                    <div style={{width:32,height:32,borderRadius:8,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,border:"1px solid var(--border)"}}>💬</div>
                    <div className="list-item-info">
                      <div className="list-item-title">{r.name}</div>
                      <div className="list-item-sub">{r.memberIds?.length||0} members · by @{creator.username}</div>
                    </div>
                    {isMember ? (
                      <span style={{fontSize:10,color:"var(--green)",fontWeight:600}}>Joined</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{fontSize:10}} onClick={async(e)=>{
                        e.stopPropagation();
                        await supabase.from("lobby_room_members").insert({room_id:r.id,user_id:myProfile.id});
                        setRooms(rs=>rs.map(x=>x.id===r.id?{...x,memberIds:[...x.memberIds,myProfile.id]}:x));
                      }}>Join</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active room chat */}
          {activeRoom&&(
            <div style={{margin:"0 16px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <button onClick={()=>setActiveRoom(null)} style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:12,fontWeight:600}}>← Back</button>
                <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{activeRoom.name}</span>
                <span style={{fontSize:10,color:"var(--muted)"}}>{activeRoom.memberIds?.length||0} members</span>
              </div>
              <div style={{background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",maxHeight:220,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8,marginBottom:6}}>
                {roomMessages.length===0&&<div style={{fontSize:12,color:"var(--muted)",textAlign:"center"}}>No messages yet.</div>}
                {roomMessages.map(msg=>(
                  <div key={msg.id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <Av user={{avatar:msg.avatar,avatarUrl:msg.avatarUrl}} size={22} isMe={msg.uid===myProfile.id}/>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:11,fontWeight:600,color:msg.uid===myProfile.id?"var(--accent)":"var(--text)"}}>{msg.username} </span>
                      {msg.messageType==="voice"&&msg.voiceUrl ? (
                        <div style={{marginTop:3,display:"flex",alignItems:"center",gap:6,background:"var(--s3)",borderRadius:8,padding:"6px 10px",border:"1px solid var(--border)"}}>
                          <button onClick={(e)=>{const a=e.currentTarget.nextElementSibling;if(a.paused)a.play();else a.pause();}} style={{background:"var(--accent)",border:"none",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
                          </button>
                          <audio src={msg.voiceUrl} preload="metadata" style={{display:"none"}}/>
                          <span style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{msg.voiceDuration?`${msg.voiceDuration}s`:""}</span>
                        </div>
                      ) : (
                        <span style={{fontSize:12,color:"var(--text2)",wordBreak:"break-word"}}>{msg.text}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={roomEndRef}/>
              </div>
              <div style={{display:"flex",gap:6}}>
                <input className="inp" placeholder="Message…" value={roomInput}
                  onChange={e=>setRoomInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendRoomMessage()}
                  style={{flex:1,padding:"9px 12px"}}/>
                <button className="btn btn-primary btn-sm" onClick={sendRoomMessage} disabled={!roomInput.trim()}>Send</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── GROUPS VIEW ────────────────────────────────────────── */
function GroupsView({ groups, setGroups, isInGroup, sentGR, joinGroup, reqGroup, leaveGroup, openChat, pendingCount, allUsers, myProfile, onCreateGroup, openGroupDetail }) {
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
                    <Av user={u} size={32}/>
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
            {isInGroup(g.id)&&(
              <button className="btn btn-secondary btn-sm" onClick={()=>leaveGroup(g.id)}>Leave</button>
            )}
            {!isInGroup(g.id)&&!sentGR(g.id)&&(
              <button className="btn btn-primary btn-sm" onClick={()=>{
                if (g.type==="open") joinGroup(g.id);
                else { reqGroup(g.id); }
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
                <Av user={p} size={40}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="user-username">@{p.username}</div>
                  {p.showRealName&&<div className="user-name">{p.displayName}</div>}
                  {p.car&&<div className="user-car">{p.year} {p.car}</div>}
                  {p.city&&<div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>📍 {p.city}</div>}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <TierBadge points={p.points||0}/>
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
              <Av user={p} size={40}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{p.year} {p.car}</div>
                <div className="user-username">@{p.username}</div>
                {p.city&&<div style={{fontSize:10,color:"var(--muted2)"}}>📍 {p.city}</div>}
              </div>
              <TierBadge points={p.points||0}/>
            </div>
          ))
      )}
    </div>
  );
}

/* ─── USER PROFILE ───────────────────────────────────────── */
function UserProfile({ userId, onBack, isFriend, sentFR, addFR, groups, isInGroup, sentGR, joinGroup, reqGroup, allUsers, myProfile, openDM }) {
  const cached = getU(userId, allUsers, myProfile);
  const [p, setP] = useState(cached);
  const [userCar, setUserCar] = useState(null);

  useEffect(()=>{
    // Fetch fresh profile to get latest banner, avatar etc.
    supabase.from("profiles").select("*").eq("id",userId).single()
      .then(({data})=>{ if(data) setP(profileFromRow(data)); });
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

      {/* Banner */}
      {p.bannerUrl
        ? <img src={p.bannerUrl} alt="banner" className="profile-banner" style={{marginBottom:0}}/>
        : <div style={{height:60,background:"var(--s2)",borderBottom:"1px solid var(--border)"}}/>
      }

      <div style={{padding:"0 16px 14px"}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12,marginTop:12}}>
          <Av user={p} size={56} isMe={isMe}/>
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
              <TierBadge points={p.points||0}/>
              <span style={{fontSize:11,color:"var(--muted)"}}>#{computeRanks(allUsers,myProfile).find(x=>x.id===userId)?.rank??"-"} · {p.points||0} pts</span>
            </div>
          </div>
        </div>
        {!isMe&&(
          <div style={{display:"flex",gap:8}}>
            {!isFriend(userId)&&!sentFR(userId)&&<button className="btn btn-primary btn-sm" onClick={()=>addFR(userId)}>+ Add Friend</button>}
            {!isFriend(userId)&&sentFR(userId)&&<button className="btn btn-secondary btn-sm" disabled>Request Sent</button>}
            {isFriend(userId)&&<span className="btn btn-green btn-sm" style={{cursor:"default"}}>✓ Friends</span>}
            {openDM&&<button className="btn btn-secondary btn-sm" onClick={()=>openDM(userId)}>💬 Message</button>}
          </div>
        )}
      </div>

      {/* Car showcase */}
      {(hasCar||userCar===null)&&(
        <>
          <div className="sec-lbl">Ride</div>
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
                <div style={{fontSize:17,fontWeight:700,lineHeight:1.2,marginBottom:6,letterSpacing:-.3}}>
                  {[userCar.year,userCar.make,userCar.model].filter(Boolean).join(" ")}
                </div>
                {userCar.buildStage&&userCar.buildStage!=="stock"&&<div style={{marginBottom:6}}><BuildBadge stage={userCar.buildStage}/></div>}
                {userCar.trim&&<div className="car-trim">{userCar.trim}</div>}
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

      {/* Stats */}
      <div className="sec-lbl">Stats</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:8}}>
        {FORMAT.map(f=>(
          <div key={f.key} style={{background:"var(--s2)",borderRadius:10,padding:"12px",border:"1px solid var(--border)",opacity:f.comingSoon?0.5:1}}>
            <div style={{fontSize:11,marginBottom:6,color:"var(--muted2)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{f.label}</div>
            {f.comingSoon
              ? <div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>Coming Soon</div>
              : <div style={{fontSize:22,fontWeight:700,lineHeight:1}}>{p.wins[f.key]??0}</div>
            }
          </div>
        ))}
      </div>

      {hasTimes&&(<>
        <div className="sec-lbl">Best Times</div>
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
function GroupDetail({ groupId, groups, setGroups, onBack, openPlayer, openChat, myProfile, allUsers, isInGroup, sentGR, joinGroup, reqGroup, leaveGroup, lobbies, onCreateLobbyForGroup }) {
  const g = groups.find(x=>x.id===groupId);
  const [subTab, setSubTab] = useState("Posts");
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventForm, setEventForm] = useState({title:"",date:"",location:"",isPublic:true,description:"",capacity:"",rules:"",category:"General",requireRsvp:false,endTime:"",coverUrl:""});
  const [memberCars, setMemberCars] = useState({});
  const [eventRsvps, setEventRsvps] = useState({}); // {eventId: [{id,userId,status}]}
  const [expandedEvent, setExpandedEvent] = useState(null);
  const coverRef = useRef(null);
  const EVENT_CATEGORIES = ["General","Meet & Greet","Show & Shine","Track Day","Cruise","Drag Night","Drift Session","Time Attack","Rally","Charity Run"];
  const bannerRef = useRef(null);
  const [bannerPreview, setBannerPreview] = useState(g?.bannerUrl||"");
  const [editSocials, setEditSocials] = useState(false);
  const [socialForm, setSocialForm] = useState({instagram:g?.instagram||"", facebook:g?.facebook||""});

  useEffect(()=>{
    if (!g?.memberIds?.length) return;
    supabase.from("user_cars").select("user_id,year,make,model").in("user_id",g.memberIds).eq("is_primary",true)
      .then(({data})=>{if(!data)return;const m={};data.forEach(c=>{m[c.user_id]=`${c.year} ${c.make} ${c.model}`;});setMemberCars(m);});
    // Load posts
    supabase.from("group_posts").select("*,profiles(username,avatar_initials,avatar_url)").eq("group_id",groupId).order("created_at",{ascending:false}).limit(50)
      .then(({data})=>{ if(data) setPosts(data); }).catch(()=>{});
    // Load events + RSVPs
    supabase.from("group_events").select("*").eq("group_id",groupId).order("event_date",{ascending:true})
      .then(async({data})=>{
        if(data) {
          setEvents(data);
          // Load RSVPs for all events
          const eventIds = data.map(e=>e.id).filter(id=>!id.startsWith("local-"));
          if (eventIds.length) {
            const {data:rsvpData} = await supabase.from("event_rsvps").select("*").in("event_id",eventIds);
            if (rsvpData) {
              const grouped = {};
              rsvpData.forEach(r=>{ if(!grouped[r.event_id]) grouped[r.event_id]=[]; grouped[r.event_id].push(r); });
              setEventRsvps(grouped);
            }
          }
        }
      }).catch(()=>{});
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

  const saveSocials = async() => {
    await supabase.from("groups").update({instagram:socialForm.instagram.trim()||null, facebook:socialForm.facebook.trim()||null}).eq("id",groupId).catch(()=>{});
    setGroups(gs=>gs.map(x=>x.id===groupId?{...x,instagram:socialForm.instagram.trim(),facebook:socialForm.facebook.trim()}:x));
    setEditSocials(false);
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
    const ev={id:`local-${Date.now()}`,group_id:groupId,title:eventForm.title,event_date:eventForm.date,location:eventForm.location,is_public:eventForm.isPublic,created_at:new Date().toISOString(),description:eventForm.description,capacity:eventForm.capacity?parseInt(eventForm.capacity):null,rules:eventForm.rules,category:eventForm.category,require_rsvp:eventForm.requireRsvp,end_time:eventForm.endTime||null,cover_url:eventForm.coverUrl,created_by:myProfile.id};
    setEvents(e=>[...e,ev]); setShowNewEvent(false); setEventForm({title:"",date:"",location:"",isPublic:true,description:"",capacity:"",rules:"",category:"General",requireRsvp:false,endTime:"",coverUrl:""});
    const{error:evErr}=await supabase.from("group_events").insert({group_id:groupId,title:ev.title,event_date:ev.event_date,location:ev.location,is_public:ev.is_public,description:ev.description||null,capacity:ev.capacity,rules:ev.rules||null,category:ev.category,require_rsvp:ev.require_rsvp,end_time:ev.end_time,cover_url:ev.cover_url||null,created_by:myProfile.id});
    if(evErr) console.error("submitEvent error:",evErr);
  };

  const handleCoverUpload = async(e) => {
    const file=e.target.files?.[0]; if(!file) return;
    const compressed = await compressImage(file,1200);
    const path=`events/${groupId}/${Date.now()}.jpg`;
    const{error:upErr}=await supabase.storage.from("car-photos").upload(path,compressed,{upsert:true,contentType:"image/jpeg"});
    if(upErr) return;
    const{data:{publicUrl}}=supabase.storage.from("car-photos").getPublicUrl(path);
    setEventForm(f=>({...f,coverUrl:publicUrl}));
  };

  const rsvpToEvent = async(eventId) => {
    await supabase.from("event_rsvps").insert({event_id:eventId,user_id:myProfile.id,status:"pending"});
    setEventRsvps(prev=>({...prev,[eventId]:[...(prev[eventId]||[]),{event_id:eventId,user_id:myProfile.id,status:"pending"}]}));
  };

  const approveRsvp = async(eventId,userId) => {
    await supabase.from("event_rsvps").update({status:"approved"}).eq("event_id",eventId).eq("user_id",userId);
    setEventRsvps(prev=>({...prev,[eventId]:(prev[eventId]||[]).map(r=>r.user_id===userId?{...r,status:"approved"}:r)}));
  };

  const denyRsvp = async(eventId,userId) => {
    await supabase.from("event_rsvps").update({status:"denied"}).eq("event_id",eventId).eq("user_id",userId);
    setEventRsvps(prev=>({...prev,[eventId]:(prev[eventId]||[]).map(r=>r.user_id===userId?{...r,status:"denied"}:r)}));
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
        {(g.instagram||g.facebook)&&!editSocials&&(
          <div style={{display:"flex",gap:8,paddingLeft:10,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            {g.instagram&&<a href={`https://instagram.com/${g.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--muted)",textDecoration:"none",background:"var(--s3)",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px"}}>
              <span style={{fontSize:13}}>📸</span> @{g.instagram.replace("@","")}
            </a>}
            {g.facebook&&<a href={g.facebook.startsWith("http")?g.facebook:`https://facebook.com/${g.facebook}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--muted)",textDecoration:"none",background:"var(--s3)",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px"}}>
              <span style={{fontSize:13}}>👥</span> {g.facebook.replace(/https?:\/\/(www\.)?facebook\.com\//,"")}
            </a>}
            {isAdmin&&<button onClick={()=>{setSocialForm({instagram:g.instagram||"",facebook:g.facebook||""});setEditSocials(true);}} style={{fontSize:10,color:"var(--muted)",background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"3px 7px",cursor:"pointer"}}>Edit</button>}
          </div>
        )}
        {isAdmin&&!g.instagram&&!g.facebook&&!editSocials&&(
          <div style={{paddingLeft:10,marginBottom:8}}>
            <button onClick={()=>setEditSocials(true)} style={{fontSize:11,color:"var(--muted)",background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>+ Add social links</button>
          </div>
        )}
        {isAdmin&&editSocials&&(
          <div style={{paddingLeft:10,marginBottom:10,display:"flex",flexDirection:"column",gap:6}}>
            <input className="inp" value={socialForm.instagram} onChange={e=>setSocialForm(f=>({...f,instagram:e.target.value}))} placeholder="Instagram @handle"/>
            <input className="inp" value={socialForm.facebook} onChange={e=>setSocialForm(f=>({...f,facebook:e.target.value}))} placeholder="Facebook page URL or name"/>
            <div style={{display:"flex",gap:6}}>
              <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={saveSocials}>Save</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setEditSocials(false)}>Cancel</button>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8,paddingLeft:10}}>
          {inGroup&&<button className="btn btn-secondary btn-sm" onClick={()=>openChat(groupId)}>💬 Chat</button>}
          {inGroup&&<button className="btn btn-primary btn-sm" style={{background:theme,borderColor:theme}} onClick={onCreateLobbyForGroup}>📡 Start Lobby</button>}
          {inGroup&&(
            <button className="btn btn-secondary btn-sm" onClick={async()=>{ await leaveGroup(groupId); onBack(); }}>Leave Group</button>
          )}
          {!inGroup&&!sentGR(groupId)&&(
            <button className="btn btn-primary btn-sm" style={{background:theme}}
              onClick={()=>g.type==="private"?reqGroup(groupId):joinGroup(groupId)}>
              {g.type==="private"?"Request to Join":"Join Group"}
            </button>
          )}
          {!inGroup&&sentGR(groupId)&&(
            <button className="btn btn-secondary btn-sm" disabled>Request Sent</button>
          )}
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
            <Av user={myProfile} size={32} isMe/>
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
              <Av user={{avatar:p.profiles?.avatar_initials||"?",avatarUrl:p.profiles?.avatar_url||""}} size={28}/>
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
        {inGroup&&!showNewEvent&&(
          <div style={{padding:"0 16px 10px"}}>
            <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={()=>setShowNewEvent(true)}>+ Create Event</button>
          </div>
        )}
        {showNewEvent&&(
          <div className="card" style={{marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Host an Event</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {/* Cover image */}
              <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleCoverUpload}/>
              <div onClick={()=>coverRef.current?.click()} style={{cursor:"pointer",borderRadius:10,overflow:"hidden",border:"1px dashed var(--border)",height:eventForm.coverUrl?120:60,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--s3)"}}>
                {eventForm.coverUrl
                  ? <img src={eventForm.coverUrl} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontSize:12,color:"var(--muted)"}}>+ Add cover image</span>
                }
              </div>

              <input className="inp" placeholder="Event title *" value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/>
              <textarea className="inp" placeholder="Description — what's this event about?" value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})} rows={3} style={{resize:"vertical",fontFamily:"inherit"}}/>

              {/* Category */}
              <div>
                <label style={{fontSize:11,color:"var(--muted)",fontWeight:600,marginBottom:4,display:"block"}}>Category</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {EVENT_CATEGORIES.map(c=>(
                    <button key={c} onClick={()=>setEventForm({...eventForm,category:c})}
                      style={{fontSize:11,padding:"4px 10px",borderRadius:8,cursor:"pointer",border:"1px solid",
                        background:eventForm.category===c?`${theme}18`:"var(--s3)",
                        borderColor:eventForm.category===c?theme:"var(--border)",
                        color:eventForm.category===c?theme:"var(--text)"}}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,color:"var(--muted)",fontWeight:600,marginBottom:4,display:"block"}}>Start *</label>
                  <input className="inp" type="datetime-local" value={eventForm.date} onChange={e=>setEventForm({...eventForm,date:e.target.value})}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,color:"var(--muted)",fontWeight:600,marginBottom:4,display:"block"}}>End (optional)</label>
                  <input className="inp" type="datetime-local" value={eventForm.endTime} onChange={e=>setEventForm({...eventForm,endTime:e.target.value})}/>
                </div>
              </div>

              <input className="inp" placeholder="Location (optional)" value={eventForm.location} onChange={e=>setEventForm({...eventForm,location:e.target.value})}/>

              {/* Capacity */}
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,color:"var(--muted)",fontWeight:600,marginBottom:4,display:"block"}}>Capacity (optional)</label>
                  <input className="inp" type="number" placeholder="No limit" value={eventForm.capacity} onChange={e=>setEventForm({...eventForm,capacity:e.target.value})}/>
                </div>
              </div>

              {/* Rules */}
              <textarea className="inp" placeholder="Rules / guidelines (optional)" value={eventForm.rules} onChange={e=>setEventForm({...eventForm,rules:e.target.value})} rows={2} style={{resize:"vertical",fontFamily:"inherit"}}/>

              {/* Visibility */}
              <div className="seg">
                <button className={`seg-opt ${eventForm.isPublic?"on":""}`} onClick={()=>setEventForm({...eventForm,isPublic:true})}>Public</button>
                <button className={`seg-opt ${!eventForm.isPublic?"on":""}`} onClick={()=>setEventForm({...eventForm,isPublic:false})}>Private</button>
              </div>

              {/* RSVP Required */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>Require RSVP</div>
                  <div style={{fontSize:10,color:"var(--muted)"}}>Vet and approve who can attend</div>
                </div>
                <button onClick={()=>setEventForm({...eventForm,requireRsvp:!eventForm.requireRsvp})}
                  style={{background:eventForm.requireRsvp?theme:"var(--s3)",border:`1px solid ${eventForm.requireRsvp?theme:"var(--border)"}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:700,color:eventForm.requireRsvp?"#fff":"var(--muted)",cursor:"pointer"}}>
                  {eventForm.requireRsvp?"ON":"OFF"}
                </button>
              </div>

              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={submitEvent}>Create Event</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setShowNewEvent(false);setEventForm({title:"",date:"",location:"",isPublic:true,description:"",capacity:"",rules:"",category:"General",requireRsvp:false,endTime:"",coverUrl:""});}}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {events.length===0&&!showNewEvent&&<div className="empty">No events scheduled.</div>}
        {events.map(ev=>{
          const{day,mon}=fmtDate(ev.event_date);
          const rsvps = eventRsvps[ev.id]||[];
          const myRsvp = rsvps.find(r=>r.user_id===myProfile.id);
          const approved = rsvps.filter(r=>r.status==="approved");
          const pendingRsvps = rsvps.filter(r=>r.status==="pending");
          const isEventCreator = ev.created_by===myProfile.id || isAdmin;
          const isExpanded = expandedEvent===ev.id;
          const isFull = ev.capacity && approved.length >= ev.capacity;
          return (
            <div key={ev.id} style={{margin:"0 16px 8px"}}>
              {/* Event card */}
              <div className="event-card" style={{cursor:"pointer",marginBottom:0}} onClick={()=>setExpandedEvent(isExpanded?null:ev.id)}>
                {ev.cover_url&&(
                  <img src={ev.cover_url} alt="" style={{width:"100%",height:80,objectFit:"cover",borderRadius:"8px 8px 0 0",marginBottom:6}}/>
                )}
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div className="event-date" style={{background:`${theme}18`,borderColor:`${theme}44`}}>
                    <div className="event-date-day" style={{color:theme}}>{day}</div>
                    <div className="event-date-mon">{mon}</div>
                  </div>
                  <div className="event-info" style={{flex:1}}>
                    <div className="event-title">{ev.title}</div>
                    {ev.category&&ev.category!=="General"&&<div style={{fontSize:10,color:theme,fontWeight:600,marginTop:1}}>{ev.category}</div>}
                    {ev.location&&<div className="event-sub">📍 {ev.location}</div>}
                    {ev.require_rsvp&&<div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>
                      {approved.length} attending{ev.capacity?` / ${ev.capacity} spots`:""}
                      {pendingRsvps.length>0&&isEventCreator&&<span style={{color:"var(--accent)",marginLeft:6}}>{pendingRsvps.length} pending</span>}
                    </div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span className="event-priv" style={{background:ev.is_public?"rgba(0,192,96,.1)":"rgba(230,26,26,.1)",color:ev.is_public?"var(--green)":theme,border:`1px solid ${ev.is_public?"rgba(0,192,96,.2)":theme+"44"}`}}>
                      {ev.is_public?"Public":"Private"}
                    </span>
                    {ev.require_rsvp&&<span style={{fontSize:9,color:"var(--muted2)",background:"var(--s3)",padding:"2px 6px",borderRadius:4,border:"1px solid var(--border)"}}>RSVP</span>}
                  </div>
                </div>
              </div>

              {/* Expanded event detail */}
              {isExpanded&&(
                <div style={{background:"var(--s2)",border:"1px solid var(--border)",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"12px 14px"}}>
                  {ev.description&&<div style={{fontSize:12,color:"var(--text2)",marginBottom:8,lineHeight:1.5}}>{ev.description}</div>}
                  {ev.rules&&(
                    <div style={{marginBottom:8,padding:"8px 10px",background:"var(--s3)",borderRadius:8,border:"1px solid var(--border)"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",letterSpacing:.5,marginBottom:4}}>RULES</div>
                      <div style={{fontSize:11,color:"var(--text2)",whiteSpace:"pre-wrap"}}>{ev.rules}</div>
                    </div>
                  )}
                  {ev.end_time&&<div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Ends: {new Date(ev.end_time).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>}

                  {/* RSVP button */}
                  {ev.require_rsvp&&inGroup&&!isEventCreator&&(
                    <div style={{marginBottom:8}}>
                      {!myRsvp&&!isFull&&(
                        <button className="btn btn-primary btn-sm" style={{background:theme}} onClick={()=>rsvpToEvent(ev.id)}>RSVP to Attend</button>
                      )}
                      {!myRsvp&&isFull&&(
                        <div style={{fontSize:11,color:"var(--muted)"}}>This event is full.</div>
                      )}
                      {myRsvp?.status==="pending"&&<div style={{fontSize:11,color:"var(--muted)",display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b"}}/>Your RSVP is pending approval</div>}
                      {myRsvp?.status==="approved"&&<div style={{fontSize:11,color:"var(--green)",display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--green)"}}/>You're approved to attend</div>}
                      {myRsvp?.status==="denied"&&<div style={{fontSize:11,color:"var(--red)",display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--red)"}}/>Your RSVP was declined</div>}
                    </div>
                  )}

                  {/* Host: pending RSVP approvals */}
                  {ev.require_rsvp&&isEventCreator&&pendingRsvps.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:.5,marginBottom:6}}>PENDING RSVPS ({pendingRsvps.length})</div>
                      {pendingRsvps.map(r=>{
                        const u = allUsers.find(x=>x.id===r.user_id)||{username:"?"};
                        return (
                          <div key={r.user_id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                            <Av user={u} size={24}/>
                            <div style={{flex:1,fontSize:12,fontWeight:600}}>@{u.username}</div>
                            <button className="btn btn-green btn-sm" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>approveRsvp(ev.id,r.user_id)}>Accept</button>
                            <button className="btn btn-secondary btn-sm" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>denyRsvp(ev.id,r.user_id)}>Deny</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Approved attendees */}
                  {ev.require_rsvp&&approved.length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:.5,marginBottom:4}}>ATTENDING ({approved.length})</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {approved.map(r=>{
                          const u = allUsers.find(x=>x.id===r.user_id)||{username:"?"};
                          return <span key={r.user_id} style={{fontSize:11,padding:"3px 8px",borderRadius:6,background:"var(--s3)",border:"1px solid var(--border)",color:"var(--text)"}}>@{u.username}</span>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </>)}

      {/* MEMBERS */}
      {subTab==="Members"&&(
        <div className="list-card" style={{margin:"0 16px 14px"}}>
          {members.map(m=>(
            <div key={m.id} className="list-item" onClick={()=>m.id!==myProfile.id&&openPlayer(m.id)}>
              <Av user={m} size={32} isMe={m.id===myProfile.id}/>
              <div className="list-item-info">
                <div className="list-item-title">@{m.username}{m.id===myProfile.id&&<span style={{fontSize:10,color:theme,marginLeft:6}}>YOU</span>}{m.id===g.admin&&<span style={{fontSize:9,color:"var(--muted2)",marginLeft:4,background:"var(--s3)",padding:"1px 5px",borderRadius:3}}>ADMIN</span>}</div>
                {memberCars[m.id]&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{memberCars[m.id]}</div>}
              </div>
              <TierBadge points={m.points||0}/>
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
    supabase.from("group_messages").select("*, profiles(username, avatar_initials, avatar_url)")
      .eq("group_id",groupId).order("created_at",{ascending:true}).limit(100)
      .then(({data})=>{
        if (data) {
          data.forEach(m=>knownIds.current.add(m.id));
          setMessages(data.map(m=>({id:m.id,uid:m.user_id,username:m.profiles?.username||"?",avatar:m.profiles?.avatar_initials||"?",avatarUrl:m.profiles?.avatar_url||"",text:m.content,ts:m.created_at})));
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
        let username="?",avatar="?",avatarUrl="";
        const known=allUsers.find(u=>u.id===row.user_id);
        if (known){username=known.username;avatar=known.avatar;avatarUrl=known.avatarUrl||"";}
        else if(row.user_id===myProfile.id){username=myProfile.username;avatar=myProfile.avatar;avatarUrl=myProfile.avatarUrl||"";}
        else{const{data:prof}=await supabase.from("profiles").select("username,avatar_initials,avatar_url").eq("id",row.user_id).single();if(prof){username=prof.username;avatar=prof.avatar_initials||"?";avatarUrl=prof.avatar_url||"";}}
        setMessages(prev=>[...prev,{id:row.id,uid:row.user_id,username,avatar,avatarUrl,text:row.content,ts:row.created_at}]);
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
            <Av user={m} size={32} isMe={m.id===myProfile.id}/>
            <div className="list-item-info">
              <div className="list-item-title">@{m.username||m.avatar}{m.id===myProfile.id&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>YOU</span>}</div>
              {memberCars[m.id]&&<div className="list-item-sub" style={{fontFamily:"var(--font-mono)",fontSize:10}}>{memberCars[m.id]}</div>}
            </div>
            <TierBadge points={m.points||0}/>
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
              {!mine&&<Av user={msg} size={28}/>}
              <div>
                <div className="msg-meta">
                  {!mine&&<span className="msg-who">@{msg.username}</span>}
                  {car&&<span className="msg-car">{car}</span>}
                  <span style={{color:"var(--muted2)",fontSize:10}}>{fmt(msg.ts)}</span>
                </div>
                <div className={`msg-bubble ${mine?"mine":""}`}><div className="msg-text">{msg.text}</div></div>
              </div>
              {mine&&<Av user={{...myProfile,avatar:msg.avatar||myProfile.avatar}} size={28} isMe/>}
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

/* ─── DM INBOX (used inside Profile > Messages tab) ─────── */
function DMInboxView({ myProfile, allUsers, openDM }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (!myProfile?.id) return;
    supabase.from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${myProfile.id},recipient_id.eq.${myProfile.id}`)
      .order("created_at",{ascending:false})
      .limit(200)
      .then(({data})=>{
        if (!data) { setLoading(false); return; }
        // Group by thread_key, keep latest message per thread
        const map = {};
        data.forEach(m=>{
          if (!map[m.thread_key]) map[m.thread_key] = m;
        });
        setThreads(Object.values(map).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
        setLoading(false);
      }).catch(()=>setLoading(false));
  }, [myProfile?.id]);

  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date(), diff = now-d;
    if (diff<60000) return "just now";
    if (diff<3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff<86400000) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString([],{month:"short",day:"numeric"});
  };

  if (loading) return <div className="empty">Loading…</div>;
  if (threads.length===0) return (
    <div className="empty">No direct messages yet.<br/><span style={{fontSize:11,color:"var(--muted)"}}>Visit someone's profile and tap 💬 Message</span></div>
  );

  return (
    <div className="list-card" style={{margin:"0 16px 14px"}}>
      {threads.map(t=>{
        const otherId = t.sender_id===myProfile.id ? t.recipient_id : t.sender_id;
        const other = allUsers.find(u=>u.id===otherId)||{id:otherId,username:"User",avatar:"?"};
        return (
          <div key={t.thread_key} className="list-item" style={{cursor:"pointer"}} onClick={()=>openDM&&openDM(otherId)}>
            <Av user={other} size={36}/>
            <div className="list-item-info">
              <div className="list-item-title">@{other.username}</div>
              <div className="list-item-sub" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>
                {t.sender_id===myProfile.id?"You: ":""}{t.content}
              </div>
            </div>
            <div style={{fontSize:10,color:"var(--muted2)",flexShrink:0}}>{fmt(t.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── DIRECT MESSAGES ───────────────────────────────────── */
function DMView({ otherUserId, onBack, myProfile, allUsers }) {
  const other = allUsers.find(u=>u.id===otherUserId)||{id:otherUserId,username:"User",avatar:"?"};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const knownIds = useRef(new Set());

  const myId = myProfile.id;
  // Canonical thread key: smaller id first
  const threadKey = [myId, otherUserId].sort().join(":");

  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date(), diff = now-d;
    if (diff<60000) return "just now";
    if (diff<3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff<86400000) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString([],{month:"short",day:"numeric"});
  };

  useEffect(()=>{
    setLoading(true); knownIds.current=new Set(); setMessages([]);
    supabase.from("direct_messages")
      .select("*")
      .eq("thread_key", threadKey)
      .order("created_at", {ascending:true})
      .limit(100)
      .then(({data, error})=>{
        if (error) console.error("DM load error:", error);
        if (data) {
          data.forEach(m=>knownIds.current.add(m.id));
          setMessages(data.map(m=>({id:m.id,uid:m.sender_id,text:m.content,ts:m.created_at})));
        }
        setLoading(false);
      }).catch((e)=>{ console.error("DM fetch catch:", e); setLoading(false); });

    const channel = supabase.channel(`dm:${threadKey}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"direct_messages",filter:`thread_key=eq.${threadKey}`},(payload)=>{
        const row=payload.new;
        if (knownIds.current.has(row.id)) return;
        knownIds.current.add(row.id);
        setMessages(prev=>[...prev,{id:row.id,uid:row.sender_id,text:row.content,ts:row.created_at}]);
      }).subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  }, [threadKey]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages.length]);

  const send = async () => {
    const text=input.trim(); if(!text) return;
    setInput("");
    const {error} = await supabase.from("direct_messages").insert({
      thread_key: threadKey, sender_id: myId, recipient_id: otherUserId, content: text
    });
    if (error) { console.error("DM send error:", error); alert("Send failed: "+error.message); }
  };

  return (
    <div className="fade" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 60px)"}}>
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pg-hdr" style={{paddingTop:0,paddingBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Av user={other} size={36}/>
          <div>
            <div className="pg-title" style={{fontSize:17,marginBottom:0}}>@{other.username}</div>
            <div className="pg-sub" style={{marginTop:0}}>Direct Message</div>
          </div>
        </div>
      </div>
      <div className="chat-msgs" style={{flex:1,overflowY:"auto"}}>
        {loading&&<div className="empty">Loading…</div>}
        {!loading&&messages.length===0&&<div className="empty">No messages yet. Say hello!</div>}
        {messages.map(msg=>{
          const mine=msg.uid===myId;
          const sender = mine ? myProfile : other;
          return (
            <div key={msg.id} className={`msg-row ${mine?"mine":""}`}>
              {!mine&&<Av user={sender} size={28}/>}
              <div>
                <div className="msg-meta">
                  <span style={{color:"var(--muted2)",fontSize:10}}>{fmt(msg.ts)}</span>
                </div>
                <div className={`msg-bubble ${mine?"mine":""}`}><div className="msg-text">{msg.text}</div></div>
              </div>
              {mine&&<Av user={myProfile} size={28} isMe/>}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div className="chat-input-bar">
        <input className="chat-inp" value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()} placeholder={`Message @${other.username}…`}/>
        <button className="btn btn-primary" style={{borderRadius:12,padding:"12px 16px"}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

/* ─── MAP VIEW ───────────────────────────────────────────── */
function MapView({ groups, openPlayer, myProfile, setMyProfile, allUsers, lobbies, openGroupDetail, speedTraps }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const userMarkersRef = useRef([]);
  const groupMarkersRef = useRef([]);
  const trapMarkersRef = useRef([]);

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
      const size=isMe?40:34;
      el.style.cssText=[`width:${size}px`,`height:${size}px`,"border-radius:50%",`border:2.5px solid ${isMe?"#e61a1a":"#fff"}`,"overflow:hidden","background:#1a1a1a","cursor:pointer","transition:transform .15s",`box-shadow:${isMe?"0 0 0 3px rgba(230,26,26,0.35),0 2px 10px rgba(0,0,0,.7)":"0 2px 8px rgba(0,0,0,.7)"}`,"display:flex","align-items:center","justify-content:center","flex-shrink:0"].join(";");
      if (p.avatarUrl) {
        const img=document.createElement("img");
        img.src=p.avatarUrl; img.style.cssText="width:100%;height:100%;object-fit:cover;display:block;";
        img.onerror=()=>{ img.remove(); el.textContent=p.avatar||"?"; el.style.fontSize="16px"; el.style.color=isMe?"#e61a1a":"#fff"; el.style.fontWeight="700"; };
        el.appendChild(img);
      } else {
        el.style.fontSize="16px"; el.style.color=isMe?"#e61a1a":"#fff"; el.style.fontWeight="700";
        el.textContent=p.avatar||"?";
      }
      el.onmouseenter=()=>{el.style.transform="scale(1.15)";}; el.onmouseleave=()=>{el.style.transform="scale(1)";};
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
      const theme=g.theme||"#e61a1a";
      const el=document.createElement("div");
      el.style.cssText="position:relative;width:52px;height:42px;cursor:pointer;transition:transform .15s;";
      // Banner card
      const card=document.createElement("div");
      card.style.cssText=`width:50px;height:34px;border-radius:8px;border:2.5px solid ${theme};overflow:hidden;background:${theme};box-shadow:0 2px 10px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;`;
      if (g.bannerUrl) {
        const img=document.createElement("img");
        img.src=g.bannerUrl; img.style.cssText="width:100%;height:100%;object-fit:cover;display:block;";
        img.onerror=()=>{ img.remove(); card.textContent=g.name.charAt(0).toUpperCase(); card.style.fontSize="16px"; card.style.fontWeight="800"; card.style.color="#fff"; };
        card.appendChild(img);
      } else {
        card.style.fontSize="16px"; card.style.fontWeight="800"; card.style.color="#fff";
        card.textContent=g.name.charAt(0).toUpperCase();
      }
      el.appendChild(card);
      // People badge (bottom-right corner)
      const badge=document.createElement("div");
      badge.style.cssText=`position:absolute;bottom:0;right:0;width:18px;height:18px;border-radius:50%;background:#111;border:2px solid ${theme};display:flex;align-items:center;justify-content:center;`;
      badge.innerHTML=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${theme}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      el.appendChild(badge);
      el.title=`${g.name} · ${g.memberIds.length} member${g.memberIds.length!==1?"s":""}`;
      el.onmouseenter=()=>{el.style.transform="scale(1.1)";}; el.onmouseleave=()=>{el.style.transform="scale(1)";};
      el.addEventListener("click",()=>openGroupDetail(g.id));
      const marker=new mapboxgl.Marker({element:el}).setLngLat([g.lng,g.lat]).addTo(mapRef.current);
      groupMarkersRef.current.push(marker);
    });
  }, [visibleGroups]);

  // Speed trap markers (orange)
  useEffect(()=>{
    if (!mapRef.current) return;
    trapMarkersRef.current.forEach(m=>m.remove()); trapMarkersRef.current=[];
    (speedTraps||[]).forEach(trap=>{
      [[trap.startLat, trap.startLng, "S"],[trap.endLat, trap.endLng, "E"]].forEach(([lat,lng,label])=>{
        if (!lat||!lng) return;
        const el=document.createElement("div");
        el.style.cssText="width:26px;height:26px;border-radius:50%;background:rgba(245,158,11,.15);border:2.5px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,.4);cursor:pointer;";
        el.textContent=label;
        const popup=new mapboxgl.Popup({offset:14,closeButton:false,closeOnClick:false})
          .setHTML(`<div style="font-size:11px;font-weight:700;color:#f59e0b">⚡ ${trap.name}</div><div style="font-size:10px;color:#ccc;margin-top:2px">${label==="S"?"Start":"End"} · ${trap.distanceMeters?Math.round(trap.distanceMeters)+"m":""}</div>`);
        const m=new mapboxgl.Marker({element:el}).setLngLat([lng,lat]).setPopup(popup).addTo(mapRef.current);
        trapMarkersRef.current.push(m);
      });
    });
  }, [speedTraps, mapRef.current]);

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
      (err)=>{
        const msg = err.code === 1
          ? "Location blocked — go to your browser settings, allow location for this site, then try again."
          : "Could not get location. Check your connection and try again.";
        setLocErr(msg); setLocating(false);
      },
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
        {locErr&&<span className="map-loc-status" style={{color:"var(--red)",lineHeight:1.4,display:"block",marginTop:6}}>{locErr}</span>}
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
  const [lbMode, setLbMode] = useState("Standard"); // "Standard" | "Night"
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
      let q=supabase.from("race_times").select("*, profiles(username,avatar_initials,avatar_url,city), user_cars(year,make,model,trim,build_stage)")
        .eq("category",cat).order("time_seconds",{ascending:true}).limit(300);
      if (classFilter!=="All") q=q.eq("car_class",classFilter);
      if (lbMode==="Night") { try { q=q.eq("is_night",true); } catch(_){} }
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
  }, [cat,classFilter,locScope,loadKey,lbMode]);

  const myIdx=entries.findIndex(e=>e.user_id===myProfile.id);
  const myEntry=myIdx>=0?entries[myIdx]:null;
  const RANK_COLOR=(i)=>i===0?"#f59e0b":i===1?"#a0a0a0":i===2?"#cd7f32":"var(--muted2)";

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">{lbMode==="Night"?"🌙 Night Board":"Leaderboard"}</div>
          <div className="pg-sub">{lbMode==="Night"?"Times from night lobbies only":"Fastest times per car per profile"}</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4,background:lbMode==="Night"?"linear-gradient(135deg,#7c3aed,#2563eb)":undefined}} onClick={()=>setSubmitOpen(true)}>+ Submit</button>
      </div>

      {/* Standard / Night mode tabs */}
      <div className="lb-mode-tabs">
        <button className={`lb-mode-tab ${lbMode==="Standard"?"on":""}`} onClick={()=>setLbMode("Standard")}>
          🏁 Standard
        </button>
        <button className={`lb-mode-tab ${lbMode==="Night"?"night-on":""}`} onClick={()=>setLbMode("Night")}>
          🌙 Night
        </button>
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
        const rc=lbMode==="Night"?(i===0?"#a78bfa":i===1?"#60a5fa":i===2?"#818cf8":"rgba(167,139,250,.5)"):RANK_COLOR(i);
        return (
          <div key={entry.id} className={`lb-row ${isMe?"mine":""}`}
            style={lbMode==="Night"?{background:"linear-gradient(145deg,rgba(10,5,20,.9),rgba(15,8,30,.85))",borderColor:"rgba(139,92,246,.3)",boxShadow:"0 0 8px rgba(139,92,246,.1)"}:undefined}
            onClick={()=>openPlayer(entry.user_id)}>
            <div className="lb-rank" style={{color:rc,fontSize:i<3?15:12,width:20}}>{i+1}</div>
            <Av user={{avatar:prof?.avatar_initials||"?",avatarUrl:prof?.avatar_url||""}} size={32} isMe={isMe}/>
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
        is_night: isNightTime(),
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

/* ─── ROUTES VIEW ───────────────────────────────────────── */
function RoutesView({ myProfile, allUsers, groups, myCar }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeDetailId, setRouteDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [diffFilter, setDiffFilter] = useState("All");
  const [ghostSummaries, setGhostSummaries] = useState({}); // {routeId: ghostFromRow}

  useEffect(()=>{
    setLoading(true);
    supabase.from("routes")
      .select("*, profiles(username,avatar_initials,avatar_url)")
      .order("created_at",{ascending:false}).limit(100)
      .then(({data})=>{
        if(data) {
          setRoutes(data.map(routeFromRow));
          // Load best ghost for each route
          const ids = data.map(r=>r.id);
          if (ids.length > 0) {
            supabase.from("ghost_runs")
              .select("*, profiles(username,avatar_initials,avatar_url)")
              .in("route_id", ids)
              .order("total_time_seconds",{ascending:true})
              .then(({data:gdata})=>{
                if(gdata) {
                  const best = {};
                  gdata.forEach(row=>{
                    if (!best[row.route_id]) best[row.route_id] = ghostFromRow(row);
                  });
                  setGhostSummaries(best);
                }
              }).catch(()=>{});
          }
        }
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[]);

  const handleCreate = async (form) => {
    try {
      const {data} = await supabase.from("routes").insert({
        name:form.name, description:form.description||null,
        waypoints:form.waypoints, distance:form.distance?parseFloat(form.distance):null,
        difficulty:form.difficulty, group_id:form.groupId||null, created_by:myProfile.id,
      }).select("*, profiles(username,avatar_initials,avatar_url)").single();
      if(data) setRoutes(rs=>[routeFromRow(data),...rs]);
    } catch(e){ console.error("create route error",e); }
  };

  const filteredRoutes = diffFilter==="All" ? routes : routes.filter(r=>r.difficulty===diffFilter);

  if (routeDetailId) {
    const r = routes.find(x=>x.id===routeDetailId);
    if (r) return <RouteDetail route={r} onBack={()=>setRouteDetailId(null)} myProfile={myProfile} allUsers={allUsers} groups={groups} myCar={myCar} ghostSummary={ghostSummaries[r.id]||null}/>;
  }

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Routes</div>
          <div className="pg-sub">{routes.length} saved route{routes.length!==1?"s":""}</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4}} onClick={()=>setCreateOpen(true)}>+ New Route</button>
      </div>

      <div className="pills">
        {["All",...DIFFICULTIES].map(d=>(
          <button key={d} className={`pill ${diffFilter===d?"on":""}`} onClick={()=>setDiffFilter(d)}>
            {d!=="All"&&DIFF_ICONS[d]+" "}{d}
          </button>
        ))}
      </div>

      {loading&&<div style={{padding:"32px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading routes…</div>}
      {!loading&&filteredRoutes.length===0&&(
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:32,marginBottom:12}}>🗺️</div>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>No routes yet.<br/>Create one for your crew.</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setCreateOpen(true)}>+ Create Route</button>
        </div>
      )}

      {filteredRoutes.map(r=>{
        const g = ghostSummaries[r.id];
        return (
          <div key={r.id} className="card click" onClick={()=>setRouteDetailId(r.id)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:4,lineHeight:1.3}}>{r.name}</div>
                {r.description&&<div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{r.description}</div>}
              </div>
              <DifficultyBadge difficulty={r.difficulty}/>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:g?8:10}}>
              {r.distance&&<span className="route-meta">📏 {r.distance} mi</span>}
              <span className="route-meta">📍 {r.waypoints?.length||0} waypoints</span>
              <span className="route-meta">👤 @{r.creatorUsername}</span>
            </div>
            {g && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"7px 10px",background:"rgba(150,150,255,.07)",borderRadius:8,border:"1px solid rgba(150,150,255,.15)"}}>
                <span style={{fontSize:13}}>👻</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,color:"rgba(180,180,255,.7)",fontWeight:700,letterSpacing:0.5,marginBottom:1}}>GHOST RECORD</div>
                  <div style={{fontSize:11,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    @{g.username}{g.carMake&&g.carModel?` · ${g.carYear?g.carYear+" ":""}${g.carMake} ${g.carModel}`:""}
                  </div>
                </div>
                <div style={{fontSize:15,fontWeight:900,color:"rgba(180,180,255,.9)",fontFamily:"var(--font-mono)",flexShrink:0}}>{fmtGhostTime(g.totalTimeSeconds)}</div>
              </div>
            )}
            <div className="gc-actions">
              <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();setRouteDetailId(r.id);}}>Drive This Route →</button>
              {g && <button className="btn btn-secondary btn-sm" style={{borderColor:"rgba(150,150,255,.3)",color:"rgba(180,180,255,.9)"}} onClick={e=>{e.stopPropagation();setRouteDetailId(r.id);}}>👻 Race Ghost</button>}
              {!g && <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();setRouteDetailId(r.id);}}>RSVP</button>}
            </div>
          </div>
        );
      })}

      {createOpen&&<CreateRouteModal myProfile={myProfile} groups={groups} onClose={()=>setCreateOpen(false)} onCreate={handleCreate}/>}
    </div>
  );
}

/* ─── ROUTE DETAIL ───────────────────────────────────────── */
function RouteDetail({ route: r, onBack, myProfile, allUsers, groups, myCar, ghostSummary }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [rsvps, setRsvps] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(true);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [rsvpDate, setRsvpDate] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [ghostRacing, setGhostRacing] = useState(false);
  const [fullGhost, setFullGhost] = useState(null);
  const [loadingGhost, setLoadingGhost] = useState(false);
  const myRsvp = rsvps.find(x=>x.userId===myProfile.id);
  const group = r.groupId ? groups.find(g=>g.id===r.groupId) : null;
  const diffColor = DIFF_COLORS[r.difficulty]||"var(--muted2)";

  // Load RSVPs
  useEffect(()=>{
    setRsvpLoading(true);
    supabase.from("route_rsvps")
      .select("*, profiles(username,avatar_initials,avatar_url)")
      .eq("route_id",r.id).order("scheduled_at",{ascending:true})
      .then(({data})=>{
        if(data) setRsvps(data.map(row=>({
          id:row.id, userId:row.user_id, scheduledAt:row.scheduled_at, note:row.note||"",
          username:row.profiles?.username||"?", avatar:row.profiles?.avatar_initials||"?",
          avatarUrl:row.profiles?.avatar_url||"",
        })));
        setRsvpLoading(false);
      }).catch(()=>setRsvpLoading(false));
  },[r.id]);

  // Init map
  useEffect(()=>{
    if (!mapContainer.current||mapRef.current||!r.waypoints?.length) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const first = r.waypoints[0];
    mapRef.current = new mapboxgl.Map({
      container:mapContainer.current,
      style:"mapbox://styles/mapbox/dark-v11",
      center:[first.lng, first.lat], zoom:11,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");

    const drawRoute = async () => {
      if (!mapRef.current) return;
      // Add waypoint markers
      r.waypoints.forEach((wp,i)=>{
        const el = document.createElement("div");
        const isFirst = i===0, isLast = i===r.waypoints.length-1;
        el.style.cssText=`width:28px;height:28px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.5);background:${isFirst?"#e61a1a":isLast?"#00c060":"#f59e0b"};`;
        el.textContent = isFirst?"S":isLast?"E":i;
        new mapboxgl.Marker({element:el}).setLngLat([wp.lng,wp.lat]).addTo(mapRef.current);
      });

      // Fetch actual road route via Directions API (up to 25 waypoints)
      if (r.waypoints.length>=2) {
        const coords = r.waypoints.slice(0,25).map(wp=>`${wp.lng},${wp.lat}`).join(";");
        try {
          const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full`);
          const data = await res.json();
          const geometry = data.routes?.[0]?.geometry;
          if (geometry && mapRef.current) {
            mapRef.current.addSource("route",{type:"geojson",data:geometry});
            mapRef.current.addLayer({id:"route-casing",type:"line",source:"route",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#000","line-width":8,"line-opacity":.35}});
            mapRef.current.addLayer({id:"route",type:"line",source:"route",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":diffColor,"line-width":5,"line-opacity":.9}});
            // Fit to route
            const pts = geometry.coordinates;
            const bounds = pts.reduce((b,[lng,lat])=>b.extend([lng,lat]),new mapboxgl.LngLatBounds(pts[0],pts[0]));
            mapRef.current.fitBounds(bounds,{padding:40});
          }
        } catch(_){
          // Fallback: straight-line polyline
          const geom = {type:"LineString",coordinates:r.waypoints.map(wp=>[wp.lng,wp.lat])};
          if (mapRef.current?.isStyleLoaded()) {
            mapRef.current.addSource("route",{type:"geojson",data:geom});
            mapRef.current.addLayer({id:"route",type:"line",source:"route",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":diffColor,"line-width":4,"line-opacity":.8,"line-dasharray":[2,2]}});
          }
        }
      }
      // Fit to waypoints if no route drawn
      if (r.waypoints.length===1) mapRef.current.flyTo({center:[r.waypoints[0].lng,r.waypoints[0].lat],zoom:13});
    };

    if (mapRef.current.isStyleLoaded()) drawRoute();
    else mapRef.current.on("load",drawRoute);
    return()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  },[r.id]);

  const submitRsvp = async () => {
    if (!rsvpDate) return;
    setSubmittingRsvp(true);
    try {
      const {data} = await supabase.from("route_rsvps").upsert({
        route_id:r.id, user_id:myProfile.id,
        scheduled_at:new Date(rsvpDate).toISOString(),
        note:rsvpNote.trim()||null,
      },{onConflict:"route_id,user_id"}).select("*, profiles(username,avatar_initials,avatar_url)").single();
      if(data) {
        const entry = {id:data.id,userId:data.user_id,scheduledAt:data.scheduled_at,note:data.note||"",
          username:data.profiles?.username||"?",avatar:data.profiles?.avatar_initials||"?",avatarUrl:data.profiles?.avatar_url||""};
        setRsvps(rs=>[...rs.filter(x=>x.userId!==myProfile.id),entry].sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt)));
      }
    } catch(e){ console.error(e); }
    setSubmittingRsvp(false);
    setShowRsvpForm(false);
    setRsvpDate(""); setRsvpNote("");
  };

  const cancelRsvp = async () => {
    await supabase.from("route_rsvps").delete().eq("route_id",r.id).eq("user_id",myProfile.id).catch(()=>{});
    setRsvps(rs=>rs.filter(x=>x.userId!==myProfile.id));
  };

  const startGhostRace = async () => {
    if (loadingGhost) return;
    // Load full ghost with path_data
    if (ghostSummary) {
      setLoadingGhost(true);
      try {
        const {data} = await supabase.from("ghost_runs")
          .select("*, profiles(username,avatar_initials,avatar_url)")
          .eq("id", ghostSummary.id).single();
        if (data) setFullGhost(ghostFromRow(data));
      } catch(e) { console.error(e); }
      setLoadingGhost(false);
    }
    setGhostRacing(true);
  };

  if (ghostRacing) {
    return <GhostRace route={r} ghost={fullGhost||ghostSummary} myProfile={myProfile} myCar={myCar} onClose={()=>{setGhostRacing(false);setFullGhost(null);}}/>;
  }

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Routes</button>

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
          <DifficultyBadge difficulty={r.difficulty}/>
          {group&&<span style={{fontSize:11,color:"var(--muted)"}}>via {group.name}</span>}
        </div>
        <div className="pg-title" style={{fontSize:20}}>{r.name}</div>
        {r.description&&<div style={{fontSize:13,color:"var(--muted)",marginTop:6,lineHeight:1.6}}>{r.description}</div>}
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
          {r.distance&&<span className="route-meta">📏 {r.distance} mi</span>}
          <span className="route-meta">📍 {r.waypoints?.length||0} waypoints</span>
          <span className="route-meta">👤 @{r.creatorUsername}</span>
        </div>
      </div>

      {/* Ghost record banner */}
      {ghostSummary && (
        <div style={{margin:"0 16px 12px",padding:"10px 14px",background:"rgba(150,150,255,.07)",borderRadius:12,border:"1px solid rgba(150,150,255,.2)",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>👻</span>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"rgba(180,180,255,.7)",fontWeight:700,letterSpacing:0.5,marginBottom:2}}>GHOST RECORD</div>
            <div style={{fontSize:12,color:"var(--text)",marginBottom:2}}>@{ghostSummary.username}{ghostSummary.carMake&&ghostSummary.carModel?` · ${ghostSummary.carYear?ghostSummary.carYear+" ":""}${ghostSummary.carMake} ${ghostSummary.carModel}`:""}</div>
            <div style={{fontSize:18,fontWeight:900,color:"rgba(180,180,255,.9)",fontFamily:"var(--font-mono)"}}>{fmtGhostTime(ghostSummary.totalTimeSeconds)}</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{background:"rgba(150,150,255,.15)",borderColor:"rgba(150,150,255,.4)",color:"rgba(200,200,255,.95)",flexShrink:0}} disabled={loadingGhost} onClick={startGhostRace}>
            {loadingGhost?"Loading…":"Race Ghost →"}
          </button>
        </div>
      )}
      {!ghostSummary && (
        <div style={{margin:"0 16px 12px",padding:"10px 14px",background:"var(--s2)",borderRadius:12,border:"1px dashed var(--border)",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>👻</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:"var(--muted)"}}>No ghost yet</div>
            <div style={{fontSize:11,color:"var(--muted2)"}}>Complete this route to set the first ghost record</div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{flexShrink:0}} onClick={startGhostRace}>
            Drive & Set Ghost
          </button>
        </div>
      )}

      {/* Route Map */}
      <div style={{margin:"0 16px 12px"}}>
        <div className="route-map-wrap" style={{height:280}} ref={mapContainer}/>
        {r.waypoints?.length>0&&(
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            {r.waypoints.map((wp,i)=>(
              <div key={i} className="wp-chip" style={{flex:"0 0 auto",padding:"5px 10px",gap:6}}>
                <div className={`wp-num${i===0?" first":i===r.waypoints.length-1?" last":""}`} style={{width:18,height:18,fontSize:9}}>
                  {i===0?"S":i===r.waypoints.length-1?"E":i}
                </div>
                <span style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{wp.lat.toFixed(3)}, {wp.lng.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RSVP Section */}
      <div className="sec-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:16}}>
        <span>Scheduled Runs ({rsvps.length})</span>
        {!myRsvp&&!showRsvpForm&&<button className="btn btn-primary btn-sm" style={{fontSize:11}} onClick={()=>setShowRsvpForm(true)}>+ RSVP</button>}
        {myRsvp&&<button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={cancelRsvp}>Cancel RSVP</button>}
      </div>

      {showRsvpForm&&(
        <div style={{margin:"0 16px 12px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",padding:"14px 16px"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Schedule Your Run</div>
          <label className="inp-label">Date & Time</label>
          <input className="inp" type="datetime-local" value={rsvpDate} onChange={e=>setRsvpDate(e.target.value)} style={{marginBottom:10}}/>
          <label className="inp-label">Note <span style={{fontWeight:400,color:"var(--muted2)",textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
          <input className="inp" placeholder="e.g. Bringing 3 cars, meeting at Shell on Hwy 26" value={rsvpNote} onChange={e=>setRsvpNote(e.target.value)} style={{marginBottom:12}}/>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-primary" style={{flex:1,borderRadius:10}} disabled={!rsvpDate||submittingRsvp} onClick={submitRsvp}>
              {submittingRsvp?"Saving…":"Confirm RSVP"}
            </button>
            <button className="btn btn-secondary" style={{borderRadius:10}} onClick={()=>{setShowRsvpForm(false);setRsvpDate("");setRsvpNote("");}}>Cancel</button>
          </div>
        </div>
      )}

      {rsvpLoading&&<div style={{padding:"16px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading…</div>}
      {!rsvpLoading&&rsvps.length===0&&!showRsvpForm&&(
        <div style={{margin:"0 16px 12px",padding:"20px",textAlign:"center",background:"var(--s2)",borderRadius:10,border:"1px solid var(--border)"}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>No runs scheduled yet. Be the first to RSVP.</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowRsvpForm(true)}>+ RSVP for a Run</button>
        </div>
      )}

      {rsvps.length>0&&(
        <div style={{margin:"0 16px 12px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
          {rsvps.map((rv,i)=>{
            const isMe = rv.userId===myProfile.id;
            const dt = new Date(rv.scheduledAt);
            const dateStr = dt.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
            const timeStr = dt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
            return (
              <div key={rv.id} className="rsvp-row" style={{background:isMe?"rgba(230,26,26,.04)":undefined}}>
                <Av user={{avatar:rv.avatar,avatarUrl:rv.avatarUrl}} size={32} isMe={isMe}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:isMe?"var(--accent)":"var(--text)"}}>@{rv.username}</span>
                    {isMe&&<span style={{fontSize:9,color:"var(--accent)",fontWeight:700}}>YOU</span>}
                  </div>
                  {rv.note&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{rv.note}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{dateStr}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>{timeStr}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── REPLAYS VIEW ───────────────────────────────────────── */
function ReplaysView({ myProfile, allUsers }) {
  const [replayGroups, setReplayGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingLobbyId, setViewingLobbyId] = useState(null);

  useEffect(() => {
    setLoading(true);
    supabase.from("lobby_recordings")
      .select("lobby_id, user_id, created_at, profiles(username,avatar_initials,avatar_url), lobbies(name,created_at)")
      .order("created_at", {ascending: false})
      .limit(300)
      .then(({data}) => {
        if (data) {
          const groups = {};
          data.forEach(row => {
            if (!groups[row.lobby_id]) {
              groups[row.lobby_id] = {
                lobbyId: row.lobby_id,
                lobbyName: row.lobbies?.name || "Lobby",
                lobbyDate: row.lobbies?.created_at || row.created_at,
                participants: [],
              };
            }
            const already = groups[row.lobby_id].participants.find(p => p.userId === row.user_id);
            if (!already) {
              groups[row.lobby_id].participants.push({
                userId: row.user_id,
                username: row.profiles?.username || "?",
                avatar: row.profiles?.avatar_initials || "?",
                avatarUrl: row.profiles?.avatar_url || "",
              });
            }
          });
          setReplayGroups(Object.values(groups).sort((a,b) => new Date(b.lobbyDate) - new Date(a.lobbyDate)));
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  if (viewingLobbyId) {
    const g = replayGroups.find(r => r.lobbyId === viewingLobbyId);
    return <ReplayViewer lobbyId={viewingLobbyId} lobbyName={g?.lobbyName || "Lobby"} participants={g?.participants || []} onBack={() => setViewingLobbyId(null)} myProfile={myProfile}/>;
  }

  return (
    <div>
      <div className="pg-hdr">
        <div className="pg-title">Replays</div>
        <div className="pg-sub">{replayGroups.length} recorded session{replayGroups.length !== 1 ? "s" : ""}</div>
      </div>
      {loading && <div style={{padding:"32px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading replays…</div>}
      {!loading && replayGroups.length === 0 && (
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:32,marginBottom:12}}>📽️</div>
          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>No replays yet.<br/>Join a lobby and drive to record your first replay.</div>
        </div>
      )}
      {replayGroups.map(g => {
        const dt = new Date(g.lobbyDate);
        const dateStr = dt.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
        const timeStr = dt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
        return (
          <div key={g.lobbyId} className="replay-card" onClick={() => setViewingLobbyId(g.lobbyId)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:3,lineHeight:1.3}}>{g.lobbyName}</div>
                <div style={{fontSize:11,color:"var(--muted2)"}}>{dateStr} · {timeStr}</div>
              </div>
              <div style={{fontSize:10,color:"var(--accent)",fontWeight:700,padding:"3px 8px",border:"1px solid rgba(230,26,26,.3)",borderRadius:6,whiteSpace:"nowrap"}}>📽️ REPLAY</div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {g.participants.slice(0,6).map((p,idx) => (
                <div key={p.userId} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"var(--muted)"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:REPLAY_COLORS[idx%REPLAY_COLORS.length]+"33",border:`1.5px solid ${REPLAY_COLORS[idx%REPLAY_COLORS.length]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:REPLAY_COLORS[idx%REPLAY_COLORS.length],flexShrink:0}}>
                    {p.avatar?.[0]?.toUpperCase()||"?"}
                  </div>
                  @{p.username}
                </div>
              ))}
              {g.participants.length > 6 && <span style={{fontSize:11,color:"var(--muted2)"}}>+{g.participants.length-6} more</span>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();setViewingLobbyId(g.lobbyId);}}>
              ▶ Watch Replay
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── REPLAY VIEWER ──────────────────────────────────────── */
function ReplayViewer({ lobbyId, lobbyName, participants, onBack, myProfile }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [liveSpeeds, setLiveSpeeds] = useState({}); // {userId: speed}

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const rafRef = useRef(null);
  const lastRafTimeRef = useRef(null);
  const currentTimeRef = useRef(0);
  const playingRef = useRef(false);
  const playbackSpeedRef = useRef(1);
  const durRef = useRef(0);
  const recordingsRef = useRef([]);
  const animFnRef = useRef(null);

  // Animation function — defined as ref so it always has latest state
  animFnRef.current = () => {
    if (!playingRef.current) return;
    const now = performance.now();
    if (lastRafTimeRef.current != null) {
      const delta = (now - lastRafTimeRef.current) / 1000 * playbackSpeedRef.current;
      const newTime = Math.min(currentTimeRef.current + delta, durRef.current);
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);

      // Update marker positions and live speeds
      const speeds = {};
      recordingsRef.current.forEach(rec => {
        const pos = interpolatePos(rec.pathData, newTime);
        if (pos) {
          if (markersRef.current[rec.userId]) {
            markersRef.current[rec.userId].setLngLat([pos.lng, pos.lat]);
          }
          speeds[rec.userId] = pos.speed || 0;
        }
      });
      setLiveSpeeds(speeds);

      if (newTime >= durRef.current) {
        playingRef.current = false;
        setPlaying(false);
        lastRafTimeRef.current = null;
        return;
      }
    }
    lastRafTimeRef.current = now;
    rafRef.current = requestAnimationFrame(() => animFnRef.current());
  };

  // Load full path_data
  useEffect(() => {
    setLoading(true);
    supabase.from("lobby_recordings")
      .select("*, profiles(username,avatar_initials,avatar_url)")
      .eq("lobby_id", lobbyId)
      .then(({data}) => {
        if (data && data.length > 0) {
          const recs = data.map(row => ({
            userId: row.user_id,
            username: row.profiles?.username || "?",
            avatar: row.profiles?.avatar_initials || "?",
            avatarUrl: row.profiles?.avatar_url || "",
            pathData: (row.path_data || []).map(p => ({...p})),
          }));
          // Normalize timestamps → seconds from global start
          let minTs = Infinity;
          recs.forEach(r => r.pathData.forEach(p => { if ((p.timestamp||0) < minTs) minTs = p.timestamp; }));
          recs.forEach(r => r.pathData.forEach(p => { p.t = ((p.timestamp||minTs) - minTs) / 1000; }));
          let maxT = 0;
          recs.forEach(r => r.pathData.forEach(p => { if (p.t > maxT) maxT = p.t; }));
          setRecordings(recs);
          recordingsRef.current = recs;
          setDuration(maxT);
          durRef.current = maxT;
          // Init speeds
          const initSpeeds = {};
          recs.forEach(r => { initSpeeds[r.userId] = r.pathData[0]?.speed || 0; });
          setLiveSpeeds(initSpeeds);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [lobbyId]);

  // Init map after recordings load
  useEffect(() => {
    if (!recordings.length || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const allPts = recordings.flatMap(r => r.pathData);
    if (!allPts.length) return;
    const centerPt = allPts[Math.floor(allPts.length/2)];
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [centerPt.lng, centerPt.lat], zoom: 13,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      // Draw path lines
      recordings.forEach((rec, idx) => {
        if (rec.pathData.length < 2) return;
        const color = REPLAY_COLORS[idx % REPLAY_COLORS.length];
        const geom = {type:"LineString", coordinates: rec.pathData.map(p=>[p.lng,p.lat])};
        mapRef.current.addSource(`rpath-${rec.userId}`, {type:"geojson", data: geom});
        mapRef.current.addLayer({id:`rpath-casing-${rec.userId}`,type:"line",source:`rpath-${rec.userId}`,layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#000","line-width":6,"line-opacity":.25}});
        mapRef.current.addLayer({id:`rpath-${rec.userId}`,type:"line",source:`rpath-${rec.userId}`,layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":color,"line-width":3,"line-opacity":.5}});
      });

      // Create markers
      recordings.forEach((rec, idx) => {
        const color = REPLAY_COLORS[idx % REPLAY_COLORS.length];
        const el = document.createElement("div");
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:${color}22;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 10px ${color}88;transition:none;`;
        el.textContent = "🚗";
        const firstPt = rec.pathData[0] || {lat:0,lng:0};
        markersRef.current[rec.userId] = new mapboxgl.Marker({element:el})
          .setLngLat([firstPt.lng, firstPt.lat])
          .addTo(mapRef.current);
      });

      // Fit bounds
      if (allPts.length > 1) {
        const lngLats = allPts.map(p=>[p.lng,p.lat]);
        const bounds = lngLats.reduce((b,pt) => b.extend(pt), new mapboxgl.LngLatBounds(lngLats[0],lngLats[0]));
        mapRef.current.fitBounds(bounds, {padding:60,maxZoom:15});
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [recordings.length]);

  const togglePlay = () => {
    if (currentTimeRef.current >= durRef.current) {
      // Restart
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    if (next) {
      lastRafTimeRef.current = null;
      rafRef.current = requestAnimationFrame(() => animFnRef.current());
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  };

  const handleScrub = (e) => {
    const t = parseFloat(e.target.value);
    currentTimeRef.current = t;
    setCurrentTime(t);
    // Snap markers to scrubbed position
    const speeds = {};
    recordingsRef.current.forEach(rec => {
      const pos = interpolatePos(rec.pathData, t);
      if (pos && markersRef.current[rec.userId]) {
        markersRef.current[rec.userId].setLngLat([pos.lng, pos.lat]);
        speeds[rec.userId] = pos.speed || 0;
      }
    });
    setLiveSpeeds(speeds);
  };

  const setSpeed = (s) => {
    playbackSpeedRef.current = s;
    setPlaybackSpeed(s);
  };

  const fmtTime = (s) => {
    const m = Math.floor(s/60);
    const sec = Math.floor(s%60);
    return `${m}:${String(sec).padStart(2,"0")}`;
  };

  // Leaderboard: sort participants by current speed desc
  const leaderboard = recordings.map((rec, idx) => ({
    ...rec,
    color: REPLAY_COLORS[idx % REPLAY_COLORS.length],
    speed: liveSpeeds[rec.userId] || 0,
  })).sort((a,b) => b.speed - a.speed);

  return (
    <div style={{position:"fixed",inset:0,background:"#0a0a0a",zIndex:2000,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 16px 8px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13,padding:"4px 8px 4px 0",flexShrink:0}}>✕</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lobbyName}</div>
          <div style={{fontSize:10,color:"var(--muted2)",letterSpacing:.5}}>REPLAY · {recordings.length} driver{recordings.length!==1?"s":""}</div>
        </div>
      </div>

      {/* Map area */}
      <div style={{flex:1,position:"relative",minHeight:0}}>
        {loading && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0a",zIndex:5}}>
            <div style={{fontSize:13,color:"var(--muted)"}}>Loading replay…</div>
          </div>
        )}
        <div ref={mapContainer} style={{width:"100%",height:"100%"}}/>

        {/* Leaderboard overlay */}
        {!loading && leaderboard.length > 0 && (
          <div className="replay-leaderboard">
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:1,marginBottom:6}}>LEADERBOARD</div>
            {leaderboard.map((rec, rank) => (
              <div key={rec.userId} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{fontSize:10,color:"var(--muted2)",width:12,textAlign:"right",flexShrink:0}}>{rank+1}</div>
                <div style={{width:8,height:8,borderRadius:"50%",background:rec.color,flexShrink:0}}/>
                <div style={{fontSize:11,color:"var(--text)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{rec.username}</div>
                <div style={{fontSize:11,fontWeight:700,color:rec.color,fontFamily:"var(--font-mono)",flexShrink:0}}>{rec.speed}<span style={{fontSize:9,color:"var(--muted2)",fontWeight:400}}> mph</span></div>
              </div>
            ))}
          </div>
        )}

        {/* Speedometer overlay */}
        {!loading && recordings.length > 0 && (
          <div className="replay-speedo">
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:1,marginBottom:4}}>SPEED</div>
            {recordings.map((rec, idx) => {
              const color = REPLAY_COLORS[idx % REPLAY_COLORS.length];
              const spd = liveSpeeds[rec.userId] || 0;
              return (
                <div key={rec.userId} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
                  <div style={{fontSize:10,color:"var(--muted)",flex:1,whiteSpace:"nowrap"}}>@{rec.username}</div>
                  <div style={{fontSize:12,fontWeight:900,color:color,fontFamily:"var(--font-mono)"}}>{spd}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Playback controls */}
      {!loading && (
        <div style={{background:"var(--s2)",borderTop:"1px solid var(--border)",padding:"10px 14px 12px",flexShrink:0}}>
          {/* Timeline */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:10,color:"var(--muted2)",fontFamily:"var(--font-mono)",flexShrink:0}}>{fmtTime(currentTime)}</span>
            <input type="range" className="replay-scrubber" min={0} max={duration||1} step={0.5}
              value={currentTime} onChange={handleScrub} style={{flex:1}}/>
            <span style={{fontSize:10,color:"var(--muted2)",fontFamily:"var(--font-mono)",flexShrink:0}}>{fmtTime(duration)}</span>
          </div>
          {/* Controls row */}
          <div className="replay-controls">
            <button onClick={togglePlay} style={{width:40,height:40,borderRadius:20,background:"var(--accent)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {playing ? "⏸" : "▶"}
            </button>
            <div style={{flex:1}}/>
            <div style={{display:"flex",gap:4}}>
              {[1,2,4,8].map(s=>(
                <button key={s} className={`replay-speed-btn${playbackSpeed===s?" on":""}`} onClick={()=>setSpeed(s)}>{s}×</button>
              ))}
            </div>
          </div>
          {/* Color legend */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}}>
            {recordings.map((rec,idx)=>(
              <div key={rec.userId} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11}}>
                <div style={{width:10,height:4,borderRadius:2,background:REPLAY_COLORS[idx%REPLAY_COLORS.length]}}/>
                <span style={{color:"var(--muted)"}}>@{rec.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SPEED TRAPS VIEW ───────────────────────────────────── */
function SpeedTrapsView({ myProfile, allUsers, myCar, speedTraps, setSpeedTraps }) {
  const [selectedTrapId, setSelectedTrapId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [myLat, setMyLat] = useState(null);
  const [myLng, setMyLng] = useState(null);
  const [nearestFirst, setNearestFirst] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setMyLat(pos.coords.latitude); setMyLng(pos.coords.longitude);
      }, ()=>{}, {timeout:6000, maximumAge:60000});
    }
  }, []);

  const sorted = [...speedTraps];
  if (nearestFirst && myLat && myLng) {
    sorted.sort((a,b) => {
      const dA = haversine(myLat, myLng, a.startLat, a.startLng);
      const dB = haversine(myLat, myLng, b.startLat, b.startLng);
      return dA - dB;
    });
  }

  const handleCreate = async (form) => {
    try {
      const { data } = await supabase.from("speed_traps").insert({
        name: form.name, start_lat: form.startLat, start_lng: form.startLng,
        end_lat: form.endLat, end_lng: form.endLng,
        distance_meters: form.distanceMeters, created_by: myProfile.id,
      }).select().single();
      if (data) setSpeedTraps(ts => [{
        id: data.id, name: data.name,
        startLat: data.start_lat, startLng: data.start_lng,
        endLat: data.end_lat, endLng: data.end_lng,
        distanceMeters: data.distance_meters,
        createdBy: data.created_by, createdAt: data.created_at,
      }, ...ts]);
    } catch(e) { console.error("create trap error", e); }
  };

  const handleDelete = async (trapId) => {
    await supabase.from("speed_traps").delete().eq("id", trapId).catch(()=>{});
    setSpeedTraps(ts => ts.filter(t => t.id !== trapId));
    if (selectedTrapId === trapId) setSelectedTrapId(null);
  };

  if (selectedTrapId) {
    const trap = speedTraps.find(t => t.id === selectedTrapId);
    if (trap) return <TrapDetail trap={trap} onBack={()=>setSelectedTrapId(null)} myProfile={myProfile} onDelete={()=>handleDelete(trap.id)} allUsers={allUsers}/>;
  }

  return (
    <div>
      <div className="pg-hdr" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="pg-title">Speed Traps</div>
          <div className="pg-sub">{speedTraps.length} trap{speedTraps.length!==1?"s":""}</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{marginTop:4}} onClick={()=>setCreateOpen(true)}>+ New Trap</button>
      </div>

      <div className="pills" style={{paddingBottom:0}}>
        <button className={`pill ${!nearestFirst?"on":""}`} onClick={()=>setNearestFirst(false)}>Recent</button>
        <button className={`pill ${nearestFirst?"on":""}`} onClick={()=>setNearestFirst(true)}>📍 Nearest</button>
      </div>

      {speedTraps.length === 0 && (
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:32,marginBottom:12}}>⚡</div>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>No speed traps yet.<br/>Create one to start tracking segment times.</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setCreateOpen(true)}>+ Create Trap</button>
        </div>
      )}

      {sorted.map(trap => {
        const distMi = trap.distanceMeters ? (trap.distanceMeters / 1609.34).toFixed(2) : null;
        const nearDist = (nearestFirst && myLat && myLng) ? (haversine(myLat, myLng, trap.startLat, trap.startLng)).toFixed(1) : null;
        return (
          <div key={trap.id} className="trap-card" onClick={()=>setSelectedTrapId(trap.id)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:3}}>{trap.name}</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {distMi&&<span className="route-meta">📏 {distMi} mi</span>}
                  {nearDist&&<span className="route-meta">📍 {nearDist} mi away</span>}
                </div>
              </div>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,padding:"3px 8px",border:"1px solid rgba(245,158,11,.3)",borderRadius:6,flexShrink:0}}>⚡ TRAP</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={e=>{e.stopPropagation();setSelectedTrapId(trap.id);}}>View Leaderboard →</button>
            </div>
          </div>
        );
      })}

      {createOpen && <CreateTrapModal myProfile={myProfile} onClose={()=>setCreateOpen(false)} onCreate={handleCreate}/>}
    </div>
  );
}

/* ─── TRAP DETAIL ────────────────────────────────────────── */
function TrapDetail({ trap, onBack, myProfile, onDelete, allUsers }) {
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const distMi = trap.distanceMeters ? (trap.distanceMeters / 1609.34).toFixed(2) : null;

  useEffect(() => {
    setLoading(true);
    supabase.from("speed_trap_times")
      .select("*, profiles(username,avatar_initials,avatar_url)")
      .eq("trap_id", trap.id)
      .order("time_seconds", {ascending: true})
      .limit(50)
      .then(({data}) => {
        if (data) setTimes(data.map(row => ({
          id: row.id, userId: row.user_id, timeSec: row.time_seconds,
          topSpeed: row.top_speed_mph, carInfo: row.car_info||"",
          createdAt: row.created_at,
          username: row.profiles?.username||"?",
          avatar: row.profiles?.avatar_initials||"?",
          avatarUrl: row.profiles?.avatar_url||"",
        })));
        setLoading(false);
      }).catch(()=>setLoading(false));
  }, [trap.id]);

  // Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const centerLat = (trap.startLat + trap.endLat) / 2;
    const centerLng = (trap.startLng + trap.endLng) / 2;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [centerLng, centerLat], zoom: 13,
    });
    mapRef.current.on("load", () => {
      // Start marker (green)
      const startEl = document.createElement("div");
      startEl.style.cssText="width:28px;height:28px;border-radius:50%;background:rgba(0,192,96,.15);border:2.5px solid #00c060;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#00c060;";
      startEl.textContent="S";
      new mapboxgl.Marker({element:startEl}).setLngLat([trap.startLng, trap.startLat]).addTo(mapRef.current);
      // End marker (orange)
      const endEl = document.createElement("div");
      endEl.style.cssText="width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,.15);border:2.5px solid #f59e0b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#f59e0b;";
      endEl.textContent="E";
      new mapboxgl.Marker({element:endEl}).setLngLat([trap.endLng, trap.endLat]).addTo(mapRef.current);
      // Line
      const geom = {type:"LineString", coordinates:[[trap.startLng,trap.startLat],[trap.endLng,trap.endLat]]};
      mapRef.current.addSource("trap-line",{type:"geojson",data:geom});
      mapRef.current.addLayer({id:"trap-line",type:"line",source:"trap-line",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#f59e0b","line-width":3,"line-opacity":.8,"line-dasharray":[3,2]}});
      // 30m radius circles (visual proximity hint)
      [[[trap.startLng, trap.startLat], "start-radius"], [[trap.endLng, trap.endLat], "end-radius"]].forEach(([coords, id]) => {
        mapRef.current.addSource(id, {type:"geojson", data:{type:"Feature", geometry:{type:"Point", coordinates:coords}}});
        mapRef.current.addLayer({id, type:"circle", source:id, paint:{"circle-radius":["interpolate",["exponential",2],["zoom"],10,3,20,30],"circle-color":"#f59e0b","circle-opacity":.12,"circle-stroke-width":1,"circle-stroke-color":"#f59e0b","circle-stroke-opacity":.4}});
      });
      // Fit to both points
      const bounds = new mapboxgl.LngLatBounds([trap.startLng,trap.startLat],[trap.endLng,trap.endLat]);
      mapRef.current.fitBounds(bounds, {padding:60, maxZoom:16});
    });
    return () => { if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  }, [trap.id]);

  const myBest = times.find(t => t.userId === myProfile.id);

  return (
    <div className="fade">
      <button className="back-btn" onClick={onBack}>← Traps</button>

      <div className="pg-hdr" style={{paddingTop:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:11,color:"#f59e0b",fontWeight:700,padding:"2px 8px",border:"1px solid rgba(245,158,11,.3)",borderRadius:6}}>⚡ SPEED TRAP</span>
        </div>
        <div className="pg-title" style={{fontSize:20}}>{trap.name}</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:6}}>
          {distMi && <span className="route-meta">📏 {distMi} mi</span>}
          <span className="route-meta">🟢 Start → 🟠 End</span>
          <span className="route-meta">⚡ {times.length} run{times.length!==1?"s":""}</span>
        </div>
      </div>

      {/* Map */}
      <div style={{margin:"0 16px 12px",borderRadius:12,overflow:"hidden",border:"1px solid var(--border)"}}>
        <div ref={mapContainer} style={{height:200}}/>
      </div>

      {/* My best */}
      {myBest && (
        <div style={{margin:"0 16px 12px",padding:"10px 14px",background:"rgba(230,26,26,.06)",borderRadius:10,border:"1px solid rgba(230,26,26,.2)",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"var(--accent)",fontWeight:700,letterSpacing:.5,marginBottom:2}}>YOUR BEST</div>
            <div style={{fontSize:18,fontWeight:900,color:"var(--text)",fontFamily:"var(--font-mono)"}}>{fmtGhostTime(myBest.timeSec)}</div>
            {myBest.topSpeed && <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Top speed: {myBest.topSpeed} mph</div>}
          </div>
          <div style={{fontSize:20}}>{times.findIndex(t=>t.userId===myProfile.id)===0?"🏆":"🎽"}</div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="sec-lbl">Leaderboard</div>
      {loading && <div style={{padding:"16px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading…</div>}
      {!loading && times.length === 0 && (
        <div style={{margin:"0 16px 12px",padding:"24px",textAlign:"center",background:"var(--s2)",borderRadius:10,border:"1px solid var(--border)"}}>
          <div style={{fontSize:13,color:"var(--muted)"}}>No times yet. Drive through this trap with location sharing on.</div>
        </div>
      )}
      {times.length > 0 && (
        <div style={{margin:"0 16px 12px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
          {times.map((t, i) => {
            const isMe = t.userId === myProfile.id;
            const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
            return (
              <div key={t.id} className="trap-lb-row" style={{background:isMe?"rgba(230,26,26,.04)":undefined}}>
                <div style={{fontSize:13,color:"var(--muted2)",width:20,textAlign:"center",flexShrink:0}}>{medal||`${i+1}`}</div>
                <Av user={{avatar:t.avatar,avatarUrl:t.avatarUrl}} size={30} isMe={isMe}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:13,fontWeight:600,color:isMe?"var(--accent)":"var(--text)"}}>@{t.username}</span>
                    {isMe&&<span style={{fontSize:9,color:"var(--accent)",fontWeight:700}}>YOU</span>}
                  </div>
                  {t.carInfo && <div style={{fontSize:11,color:"var(--muted)",marginTop:1,fontFamily:"var(--font-mono)"}}>{t.carInfo}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:900,color:i===0?"#f59e0b":"var(--text)",fontFamily:"var(--font-mono)"}}>{fmtGhostTime(t.timeSec)}</div>
                  {t.topSpeed && <div style={{fontSize:10,color:"var(--muted)"}}>{t.topSpeed} mph top</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {trap.createdBy === myProfile.id && (
        <div style={{margin:"0 16px 16px"}}>
          <button className="btn btn-secondary btn-full" style={{borderRadius:10,padding:11,color:"var(--red)",borderColor:"rgba(255,59,48,.3)"}} onClick={onDelete}>
            Delete Trap
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── CREATE TRAP MODAL ──────────────────────────────────── */
function CreateTrapModal({ myProfile, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [pins, setPins] = useState([]); // [{lat, lng}] — first = start, second = end
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const distanceMeters = pins.length === 2 ? haversine(pins[0].lat, pins[0].lng, pins[1].lat, pins[1].lng) * 1609.34 : null;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-122.67, 45.52], zoom: 11,
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        mapRef.current?.flyTo({center:[pos.coords.longitude,pos.coords.latitude],zoom:14});
      }, ()=>{}, {timeout:5000, maximumAge:60000});
    }
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");
    mapRef.current.on("load",()=>setMapReady(true));
    return () => { if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  }, []);

  // Click to drop pins
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const onClick = (e) => {
      const {lat, lng} = e.lngLat;
      setPins(p => p.length >= 2 ? [{lat,lng}] : [...p, {lat,lng}]);
    };
    mapRef.current.on("click", onClick);
    return () => mapRef.current?.off("click", onClick);
  }, [mapReady]);

  // Update markers + line
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    markersRef.current.forEach(m=>m.remove()); markersRef.current=[];
    pins.forEach((p,i) => {
      const isStart = i === 0;
      const el = document.createElement("div");
      el.style.cssText=`width:28px;height:28px;border-radius:50%;border:2.5px solid ${isStart?"#00c060":"#f59e0b"};background:${isStart?"rgba(0,192,96,.15)":"rgba(245,158,11,.15)"};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${isStart?"#00c060":"#f59e0b"};box-shadow:0 2px 8px rgba(0,0,0,.5);`;
      el.textContent = isStart ? "S" : "E";
      const m = new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(mapRef.current);
      markersRef.current.push(m);
    });
    // Line between pins
    if (mapRef.current.getSource("trap-preview")) {
      mapRef.current.getSource("trap-preview").setData({type:"LineString",coordinates:pins.map(p=>[p.lng,p.lat])});
    } else if (pins.length === 2) {
      mapRef.current.addSource("trap-preview",{type:"geojson",data:{type:"LineString",coordinates:pins.map(p=>[p.lng,p.lat])}});
      mapRef.current.addLayer({id:"trap-preview",type:"line",source:"trap-preview",layout:{"line-join":"round","line-cap":"round"},paint:{"line-color":"#f59e0b","line-width":3,"line-opacity":.75,"line-dasharray":[3,2]}});
    }
  }, [pins, mapReady]);

  const submit = async () => {
    if (!name.trim() || pins.length < 2) return;
    setSaving(true);
    await onCreate({name:name.trim(), startLat:pins[0].lat, startLng:pins[0].lng, endLat:pins[1].lat, endLng:pins[1].lng, distanceMeters});
    setSaving(false);
    onClose();
  };

  const canSubmit = name.trim() && pins.length === 2;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade" style={{maxHeight:"92vh",overflowY:"auto",paddingBottom:0}}>
        <div className="modal-handle"/>
        <div className="modal-title">Create Speed Trap</div>
        <div className="modal-sub">Tap map to place start (S) then end (E) pin</div>

        <div style={{margin:"0 -4px 12px",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
          <div ref={mapContainer} style={{width:"100%",height:240}}/>
        </div>

        {/* Pin status */}
        <div style={{marginBottom:12,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid #00c060",background:"rgba(0,192,96,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#00c060"}}>S</div>
            <span style={{color:pins.length>=1?"#00c060":"var(--muted2)",fontWeight:pins.length>=1?600:400}}>{pins.length>=1?`${pins[0].lat.toFixed(4)}, ${pins[0].lng.toFixed(4)}`:"Tap map for start"}</span>
          </div>
          <span style={{color:"var(--muted2)"}}>→</span>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid #f59e0b",background:"rgba(245,158,11,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#f59e0b"}}>E</div>
            <span style={{color:pins.length>=2?"#f59e0b":"var(--muted2)",fontWeight:pins.length>=2?600:400}}>{pins.length>=2?`${pins[1].lat.toFixed(4)}, ${pins[1].lng.toFixed(4)}`:"Tap map for end"}</span>
          </div>
          {distanceMeters && (
            <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto",fontFamily:"var(--font-mono)"}}>
              {distanceMeters >= 1000 ? `${(distanceMeters/1000).toFixed(2)} km` : `${Math.round(distanceMeters)} m`}
              {" · "}{(distanceMeters/1609.34).toFixed(2)} mi
            </span>
          )}
        </div>
        {pins.length === 2 && (
          <div style={{fontSize:11,color:"var(--muted2)",marginBottom:12}}>Tap map again to reset start pin</div>
        )}

        <div style={{marginBottom:12}}>
          <label className="inp-label">Trap Name *</label>
          <input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 82nd Ave Quarter Mile"/>
        </div>

        <div style={{position:"sticky",bottom:0,background:"var(--s2)",padding:"12px 0 16px",marginTop:4}}>
          <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8}} disabled={!canSubmit||saving} onClick={submit}>
            {saving?"Saving…":!name.trim()?"Enter a name":pins.length<2?"Drop both pins":"Save Speed Trap"}
          </button>
          <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── CREATE ROUTE MODAL ─────────────────────────────────── */
function CreateRouteModal({ myProfile, groups, onClose, onCreate }) {
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const [form, setForm] = useState({name:"",description:"",distance:"",difficulty:"Moderate",groupId:""});
  const [waypoints, setWaypoints] = useState([]); // [{lat, lng}]
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const lineRef = useRef(null);

  // Init map
  useEffect(()=>{
    if (!mapContainer.current||mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container:mapContainer.current,
      style:"mapbox://styles/mapbox/dark-v11",
      center:[-122.67,45.52], zoom:10,
    });
    // Try to center on user's GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos=>{
        mapRef.current?.flyTo({center:[pos.coords.longitude,pos.coords.latitude],zoom:11});
      },()=>{},{timeout:5000,maximumAge:60000});
    }
    mapRef.current.on("load",()=>{ setMapReady(true); });
    mapRef.current.addControl(new mapboxgl.NavigationControl(),"top-right");
    return()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  },[]);

  // Click handler
  useEffect(()=>{
    if (!mapRef.current||!mapReady) return;
    const onClick = (e) => {
      const {lat,lng} = e.lngLat;
      setWaypoints(pts=>[...pts,{lat,lng}]);
    };
    mapRef.current.on("click",onClick);
    return()=>mapRef.current?.off("click",onClick);
  },[mapReady]);

  // Update markers + line when waypoints change
  useEffect(()=>{
    if (!mapRef.current||!mapReady) return;
    // Remove old markers
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    // Add new markers
    waypoints.forEach((wp,i)=>{
      const el=document.createElement("div");
      const isFirst=i===0, isLast=i===waypoints.length-1;
      el.style.cssText=`width:26px;height:26px;border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);background:${isFirst?"#e61a1a":isLast&&waypoints.length>1?"#00c060":"#f59e0b"};`;
      el.textContent=isFirst?"S":isLast&&waypoints.length>1?"E":i;
      el.title="Double-click to remove";
      el.addEventListener("dblclick",(e)=>{e.stopPropagation();setWaypoints(pts=>pts.filter((_,idx)=>idx!==i));});
      const m=new mapboxgl.Marker({element:el}).setLngLat([wp.lng,wp.lat]).addTo(mapRef.current);
      markersRef.current.push(m);
    });
    // Update line
    const geom={type:"LineString",coordinates:waypoints.map(wp=>[wp.lng,wp.lat])};
    if (mapRef.current.getSource("preview-line")) {
      mapRef.current.getSource("preview-line").setData(geom);
    } else if (waypoints.length>=2) {
      mapRef.current.addSource("preview-line",{type:"geojson",data:geom});
      mapRef.current.addLayer({id:"preview-line",type:"line",source:"preview-line",
        layout:{"line-join":"round","line-cap":"round"},
        paint:{"line-color":"#e61a1a","line-width":3,"line-opacity":.7,"line-dasharray":[2,1.5]}});
    }
  },[waypoints,mapReady]);

  const submit = async () => {
    if (!form.name.trim()||waypoints.length<2) return;
    setSaving(true);
    await onCreate({...form, waypoints});
    setSaving(false);
    onClose();
  };

  const canSubmit = form.name.trim()&&waypoints.length>=2;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade" style={{maxHeight:"92vh",overflowY:"auto",paddingBottom:0}}>
        <div className="modal-handle"/>
        <div className="modal-title">Create Route</div>
        <div className="modal-sub">Click the map to drop waypoints</div>

        {/* Map */}
        <div style={{margin:"0 -4px 12px",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
          <div ref={mapContainer} style={{width:"100%",height:240}}/>
        </div>

        {/* Waypoint count + hint */}
        <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:waypoints.length>=2?"var(--green)":"var(--muted)",fontWeight:600}}>
              {waypoints.length===0?"Tap map to add start point"
               :waypoints.length===1?"Add at least one more point"
               :`${waypoints.length} waypoints`}
            </span>
            {waypoints.length>0&&(
              <span style={{fontSize:11,color:"var(--muted2)"}}>· double-tap marker to remove</span>
            )}
          </div>
          {waypoints.length>0&&<button onClick={()=>setWaypoints([])} style={{fontSize:11,color:"var(--accent)",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Clear all</button>}
        </div>

        {/* Waypoint chips */}
        {waypoints.length>0&&(
          <div style={{marginBottom:12,display:"flex",gap:6,flexWrap:"wrap"}}>
            {waypoints.map((wp,i)=>(
              <div key={i} style={{display:"inline-flex",alignItems:"center",gap:5,background:"var(--s3)",borderRadius:6,border:"1px solid var(--border)",padding:"4px 8px"}}>
                <div className={`wp-num${i===0?" first":i===waypoints.length-1?" last":""}`} style={{width:16,height:16,fontSize:8}}>
                  {i===0?"S":i===waypoints.length-1?"E":i}
                </div>
                <span style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>{wp.lat.toFixed(3)},{wp.lng.toFixed(3)}</span>
                <button onClick={()=>setWaypoints(pts=>pts.filter((_,idx)=>idx!==i))} style={{background:"none",border:"none",color:"var(--muted2)",cursor:"pointer",fontSize:12,lineHeight:1,padding:"0 2px"}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div style={{marginBottom:12}}>
          <label className="inp-label">Route Name *</label>
          <input className="inp" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. PDX Canyon Run — Hwy 26 to Coast"/>
        </div>
        <div style={{marginBottom:12}}>
          <label className="inp-label">Description</label>
          <textarea className="inp" rows={2} style={{resize:"none",lineHeight:1.5}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What makes this route great? Any notes for drivers?"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <label className="inp-label">Est. Distance (mi)</label>
            <input className="inp" type="number" min="0" step="0.1" value={form.distance} onChange={e=>setForm(f=>({...f,distance:e.target.value}))} placeholder="0.0"/>
          </div>
          <div>
            <label className="inp-label">Difficulty</label>
            <div style={{display:"flex",gap:4,marginTop:4}}>
              {DIFFICULTIES.map(d=>(
                <button key={d} onClick={()=>setForm(f=>({...f,difficulty:d}))}
                  style={{flex:1,padding:"8px 4px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",border:`1px solid ${form.difficulty===d?DIFF_COLORS[d]:"var(--border)"}`,background:form.difficulty===d?DIFF_COLORS[d]+"22":"transparent",color:form.difficulty===d?DIFF_COLORS[d]:"var(--muted)"}}>
                  {DIFF_ICONS[d]}
                </button>
              ))}
            </div>
            <div style={{fontSize:10,color:DIFF_COLORS[form.difficulty],textAlign:"center",marginTop:4,fontWeight:600}}>{form.difficulty}</div>
          </div>
        </div>

        {myGroups.length>0&&(
          <div style={{marginBottom:12}}>
            <label className="inp-label">Link to Group <span style={{fontWeight:400,color:"var(--muted2)",textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
            <select className="inp" value={form.groupId} onChange={e=>setForm(f=>({...f,groupId:e.target.value}))} style={{appearance:"none",cursor:"pointer"}}>
              <option value="">None</option>
              {myGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        <div style={{position:"sticky",bottom:0,background:"var(--s2)",padding:"12px 0 16px",marginTop:4}}>
          <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8}} disabled={!canSubmit||saving} onClick={submit}>
            {saving?"Saving…":!form.name.trim()?"Enter a route name":waypoints.length<2?"Drop at least 2 waypoints":"Save Route"}
          </button>
          <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── SESSION STATS VIEW ─────────────────────────────────── */
function SessionStatsView({ userId, myCar }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("sessions").select("*")
      .eq("user_id", userId).order("started_at", {ascending: false}).limit(300)
      .then(({data}) => { if(data) setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={{padding:"32px 20px",textAlign:"center",color:"var(--muted2)",fontSize:12}}>Loading drive stats…</div>;

  if (sessions.length === 0) return (
    <div style={{textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:32,marginBottom:12}}>🏁</div>
      <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>No sessions yet.<br/>Join a lobby and start driving to track your stats.</div>
    </div>
  );

  // Lifetime totals
  const totalMiles = sessions.reduce((s,r) => s+(r.miles_driven||0), 0);
  const totalSessions = sessions.length;
  const topSpeedEver = Math.max(...sessions.map(r=>r.top_speed_mph||0));
  const totalSeconds = sessions.reduce((s,r) => s+(r.duration_seconds||0), 0);
  const avgSpeedAll = Math.round(sessions.filter(r=>r.avg_speed_mph>0).reduce((s,r,_,a)=>s+(r.avg_speed_mph/a.length),0));

  // Weekly bar chart — last 7 days
  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const now = new Date();
  const weekData = Array.from({length:7},(_,i) => {
    const d = new Date(now); d.setDate(d.getDate()-(6-i));
    const dayMiles = sessions.filter(r => {
      const sd = new Date(r.started_at);
      return sd.getFullYear()===d.getFullYear()&&sd.getMonth()===d.getMonth()&&sd.getDate()===d.getDate();
    }).reduce((s,r)=>s+(r.miles_driven||0),0);
    return { day: DAY_NAMES[d.getDay()], miles: dayMiles, isToday: i===6 };
  });
  const maxBarMiles = Math.max(...weekData.map(d=>d.miles), 0.1);

  // Monthly sessions count (last 4 weeks)
  const monthSessions = sessions.filter(r => {
    const d = new Date(r.started_at);
    return (now - d) < 28*24*60*60*1000;
  }).length;

  // Most active day of week (lifetime)
  const byDay = Array(7).fill(0);
  sessions.forEach(r => { const d=new Date(r.started_at); byDay[d.getDay()]+=r.miles_driven||0; });
  const mostActiveDay = DAY_NAMES[byDay.indexOf(Math.max(...byDay))];

  // Personal records
  const bestMilesSession = sessions.reduce((best,r)=>(r.miles_driven||0)>(best.miles_driven||0)?r:best, sessions[0]);
  const bestTopSpeed = sessions.reduce((best,r)=>(r.top_speed_mph||0)>(best.top_speed_mph||0)?r:best, sessions[0]);
  const longestSession = sessions.reduce((best,r)=>(r.duration_seconds||0)>(best.duration_seconds||0)?r:best, sessions[0]);
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString([],{month:"short",day:"numeric"}) : "";

  return (
    <div>
      {/* Lifetime stat boxes */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,padding:"0 16px",marginBottom:8}}>
        {[
          {n:totalMiles.toFixed(1),u:"mi",l:"Total Miles",c:"var(--accent)"},
          {n:totalSessions,u:"",l:"Sessions",c:"var(--text)"},
          {n:topSpeedEver,u:"mph",l:"Top Speed",c:"#f59e0b"},
          {n:fmtDuration(totalSeconds),u:"",l:"Total Drive Time",c:"#3b82f6"},
        ].map(({n,u,l,c})=>(
          <div key={l} style={{background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",padding:"14px 12px"}}>
            <div style={{fontSize:22,fontWeight:900,lineHeight:1,color:c,fontFamily:"var(--font-mono)",letterSpacing:"-1px"}}>{n}<span style={{fontSize:12,fontWeight:400,color:"var(--muted2)",marginLeft:3}}>{u}</span></div>
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginTop:5}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Weekly bar chart */}
      <div className="sec-lbl">This Week</div>
      <div style={{margin:"0 16px 12px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",padding:"16px 14px"}}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",height:80,gap:6,marginBottom:8}}>
          {weekData.map(d => {
            const barH = maxBarMiles > 0 ? Math.max((d.miles/maxBarMiles)*72, d.miles>0?4:2) : 2;
            return (
              <div key={d.day} className="drive-bar-wrap">
                <div className="drive-bar" style={{height:barH,background:d.isToday?"var(--accent)":d.miles>0?"rgba(230,26,26,.5)":"var(--s3)"}}/>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",gap:6}}>
          {weekData.map(d=>(
            <div key={d.day} style={{flex:1,textAlign:"center",fontSize:9,color:d.isToday?"var(--accent)":"var(--muted2)",fontWeight:d.isToday?700:400}}>{d.day}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:20,marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
          <div>
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:2}}>This Week</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-mono)"}}>{weekData.reduce((s,d)=>s+d.miles,0).toFixed(1)} mi</div>
          </div>
          <div>
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:2}}>Month Sessions</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"var(--font-mono)"}}>{monthSessions}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:"var(--muted2)",fontWeight:700,letterSpacing:.5,textTransform:"uppercase",marginBottom:2}}>Most Active</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{mostActiveDay}</div>
          </div>
        </div>
      </div>

      {/* Personal Records */}
      <div className="sec-lbl">Personal Records</div>
      <div style={{margin:"0 16px 12px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
        {[
          {icon:"📏",label:"Most Miles in One Session",val:`${(bestMilesSession.miles_driven||0).toFixed(2)} mi`,date:fmtDate(bestMilesSession.started_at)},
          {icon:"⚡",label:"Top Speed Ever",val:`${bestTopSpeed.top_speed_mph||0} mph`,date:fmtDate(bestTopSpeed.started_at)},
          {icon:"⏱",label:"Longest Session",val:fmtDuration(longestSession.duration_seconds||0),date:fmtDate(longestSession.started_at)},
        ].map((r,i)=>(
          <div key={r.label} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<2?"1px solid var(--border)":undefined}}>
            <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:"var(--muted)",fontWeight:600}}>{r.label}</div>
              <div style={{fontSize:15,fontWeight:900,color:"var(--text)",fontFamily:"var(--font-mono)",marginTop:1}}>{r.val}</div>
            </div>
            <div style={{fontSize:10,color:"var(--muted2)",flexShrink:0}}>{r.date}</div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div className="sec-lbl">Recent Sessions</div>
      <div style={{margin:"0 16px 16px",background:"var(--s2)",borderRadius:12,border:"1px solid var(--border)",overflow:"hidden"}}>
        {sessions.slice(0,10).map((s,i) => {
          const dt = new Date(s.started_at);
          const typeIcon = s.session_type==="lobby"?"🏁":s.session_type==="route"?"🗺️":"🚗";
          return (
            <div key={s.id} className="session-row">
              <span style={{fontSize:14,flexShrink:0}}>{typeIcon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:1}}>{(s.miles_driven||0).toFixed(2)} mi · {fmtDuration(s.duration_seconds||0)}</div>
                <div style={{fontSize:10,color:"var(--muted)"}}>{dt.toLocaleDateString([],{month:"short",day:"numeric"})} · {dt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",fontFamily:"var(--font-mono)"}}>{s.top_speed_mph||0} mph</div>
                <div style={{fontSize:9,color:"var(--muted2)"}}>top speed</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PROFILE VIEW ───────────────────────────────────────── */
function ProfileView({ myProfile, friends, groups, openPlayer, onEdit, onCreateGroup, myCar, myCars, allUsers, onLogWin, openDM }) {
  const [activeSubTab, setActiveSubTab] = useState("Stats");
  const [logWinModal, setLogWinModal] = useState(false);
  const [carStatsIdx, setCarStatsIdx] = useState(null); // which car's stats are expanded
  const myGroups = groups.filter(g=>g.memberIds.includes(myProfile.id));
  const myFriends = allUsers.filter(p=>friends.includes(p.id));
  const totalW = tw(myProfile.wins);
  const totalR = Object.values(myProfile.races).reduce((a,b)=>a+b,0);
  const myPts = myProfile.points||0;
  const tier = getTier(myPts);
  const nextTier = TIERS[TIERS.indexOf(tier)+1];
  const progress = nextTier?((myPts-tier.min)/(nextTier.min-tier.min))*100:100;
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
            <div style={{fontSize:17,fontWeight:700,lineHeight:1.2,marginBottom:6,letterSpacing:-.3}}>
              {[myCar.year,myCar.make,myCar.model].filter(Boolean).join(" ")}
            </div>
            {myCar.buildStage&&myCar.buildStage!=="stock"&&<div style={{marginBottom:6}}><BuildBadge stage={myCar.buildStage}/></div>}
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
          <Av user={myProfile} size={56} isMe/>
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
              <TierBadge points={myProfile.points||0}/>
              <span style={{fontSize:11,color:"var(--muted)"}}>Rank #{myRank} Global</span>
            </div>
          </div>
        </div>
        <div style={{marginBottom:4,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:10,color:tier.color,fontWeight:600,letterSpacing:.5}}>{tier.name.toUpperCase()} · {myPts} PTS</span>
          {nextTier&&<span style={{fontSize:10,color:"var(--muted)"}}>→ {nextTier.name} at {nextTier.min}pts</span>}
        </div>
        <div style={{height:3,background:"var(--s3)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(progress,100)}%`,background:tier.color,borderRadius:2,transition:"width .5s"}}/>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="pills" style={{marginBottom:8}}>
        {["Stats","Drive","Night","Messages","Friends","Groups"].map(t=>(
          <button key={t} className={`pill ${activeSubTab===t?"on":""}`}
            style={t==="Night"&&activeSubTab===t?{background:"linear-gradient(135deg,rgba(139,92,246,.3),rgba(59,130,246,.2))",color:"#a78bfa",borderColor:"rgba(139,92,246,.5)"}:undefined}
            onClick={()=>setActiveSubTab(t)}>
            {t==="Night"?"🌙 Night":t==="Messages"?"💬 DMs":t}
            {t==="Friends"&&activeFriends.length>0&&<span style={{marginLeft:4,background:"var(--green)",width:6,height:6,borderRadius:"50%",display:"inline-block"}}/>}
          </button>
        ))}
      </div>

      {activeSubTab==="Drive"&&<SessionStatsView userId={myProfile.id} myCar={myCar}/>}

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

        <div className="sec-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:16}}>
          <span>Wins</span>
          <button className="btn btn-primary btn-sm" style={{fontSize:11,padding:"3px 10px"}} onClick={()=>setLogWinModal(true)}>+ Log Win</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px",marginBottom:8}}>
          {FORMAT.map(f=>(
            <div key={f.key} style={{background:"var(--s2)",borderRadius:10,padding:"12px",border:"1px solid var(--border)",opacity:f.comingSoon?0.5:1}}>
              <div style={{fontSize:11,marginBottom:6,color:"var(--muted2)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{f.label}</div>
              {f.comingSoon
                ? <div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>Coming Soon</div>
                : f.isLobbies
                  ? <div style={{fontSize:22,fontWeight:700,lineHeight:1}}>{myProfile.wins[f.key]??0}</div>
                  : <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                      <span style={{fontSize:22,fontWeight:700,lineHeight:1}}>{myProfile.wins[f.key]??0}</span>
                      <span style={{fontSize:11,color:"var(--muted)"}}>/ {myProfile.races[f.key]??0} races</span>
                    </div>
              }
            </div>
          ))}
        </div>

        {hasTimes&&(<>
          <div className="sec-lbl">Best Times (Overall)</div>
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


        {/* Per-car stats */}
        {myCars&&myCars.filter(c=>c.make&&c.model).length>0&&(<>
          <div className="sec-lbl">Stats by Car</div>
          {myCars.filter(c=>c.make&&c.model).map((car,i)=>{
            const label = [car.year,car.make,car.model].filter(Boolean).join(" ");
            const carW = tw(car.wins||{});
            const carR = Object.values(car.races||{}).reduce((a,b)=>a+b,0);
            const hasCTimes = car.times&&Object.values(car.times).some(v=>v);
            const open = carStatsIdx===i;
            return (
              <div key={car.id||i} style={{margin:"0 16px 6px",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
                <button onClick={()=>setCarStatsIdx(open?null:i)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"var(--s2)",border:"none",cursor:"pointer",color:"var(--text)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:13,fontWeight:700}}>{label}</div>
                    {car.buildStage&&car.buildStage!=="stock"&&<BuildBadge stage={car.buildStage}/>}
                    {car.isPrimary&&<span style={{fontSize:9,color:"var(--accent)",fontWeight:700,letterSpacing:.5}}>PRIMARY</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,color:"var(--muted)"}}>{carW}W · {carR}R</span>
                    <span style={{fontSize:10,color:"var(--muted2)",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                  </div>
                </button>
                {open&&(
                  <div style={{padding:"12px 14px",background:"var(--bg)",borderTop:"1px solid var(--border)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:hasCTimes?10:0}}>
                      {FORMAT.filter(f=>!f.comingSoon&&!f.isLobbies).map(f=>(
                        <div key={f.key} style={{background:"var(--s2)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border)"}}>
                          <div style={{fontSize:10,color:"var(--muted2)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase",marginBottom:4}}>{f.label}</div>
                          <span style={{fontSize:18,fontWeight:700}}>{(car.wins||{})[f.key]??0}</span>
                          <span style={{fontSize:10,color:"var(--muted)",marginLeft:4}}>/ {(car.races||{})[f.key]??0} races</span>
                        </div>
                      ))}
                    </div>
                    {hasCTimes&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {RACE_TIMES.map(t=>(
                          <div key={t.key} style={{background:"var(--s2)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border)"}}>
                            <div style={{fontSize:10,color:"var(--muted2)",fontWeight:600,letterSpacing:.5,textTransform:"uppercase",marginBottom:4}}>{t.label}</div>
                            <div style={{fontSize:16,fontWeight:700,lineHeight:1}}>{car.times[t.key]||"—"}</div>
                            {car.times[t.key]&&<div style={{fontSize:9,color:"var(--muted2)",marginTop:2}}>{t.unit}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasCTimes&&<div style={{fontSize:11,color:"var(--muted)",textAlign:"center",paddingTop:4}}>No times recorded for this car yet.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </>)}
      </>)}

      {activeSubTab==="Night"&&(<>
        <div style={{margin:"0 16px 12px",background:"linear-gradient(145deg,rgba(10,5,20,.95),rgba(15,8,30,.9))",border:"1px solid rgba(139,92,246,.4)",borderRadius:12,padding:"16px",boxShadow:"0 0 20px rgba(139,92,246,.12)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:20}}>🌙</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,background:"linear-gradient(90deg,#a78bfa,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Night Mode Profile</div>
              <div style={{fontSize:11,color:"rgba(167,139,250,.7)"}}>Active 10pm–4am local time</div>
            </div>
          </div>
          <div className="night-stats-grid" style={{marginBottom:12}}>
            {[
              {n:myProfile.nightLobbies||0, l:"Lobbies",  c:"#a78bfa"},
              {n:myProfile.nightWins||0,    l:"Wins",     c:"#60a5fa"},
              {n:myProfile.nightMiles>0?(myProfile.nightMiles.toFixed(1)+"mi"):"—", l:"Miles", c:"#818cf8"},
            ].map(({n,l,c})=>(
              <div key={l} className="night-stat-box">
                <div style={{fontSize:20,fontWeight:700,lineHeight:1,color:c,letterSpacing:"-0.5px"}}>{n}</div>
                <div style={{fontSize:9,color:"rgba(167,139,250,.7)",marginTop:4,letterSpacing:.8,textTransform:"uppercase"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {activeSubTab==="Messages"&&(
        <DMInboxView myProfile={myProfile} allUsers={allUsers} openDM={openDM}/>
      )}

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
                <TierBadge points={p.points||0}/>
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
      {logWinModal&&(
        <LogWinModal onClose={()=>setLogWinModal(false)} onSave={onLogWin} myCars={myCars}/>
      )}
    </div>
  );
}

/* ─── LOG WIN MODAL ──────────────────────────────────────── */
function LogWinModal({ onClose, onSave, myCars }) {
  const raceable = FORMAT.filter(f=>!f.comingSoon&&!f.isLobbies);
  const [format, setFormat] = useState(raceable[0]?.key||"h2h");
  const [result, setResult] = useState("win");
  const [carId, setCarId] = useState(myCars?.find(c=>c.isPrimary)?.id||myCars?.[0]?.id||null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onSave(format, result, carId);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet fade">
        <div className="modal-handle"/>
        <div className="modal-title">Log a Race</div>
        <div className="modal-sub">Record a result to your stats</div>
        {myCars&&myCars.filter(c=>c.make&&c.model).length>1&&(
          <div style={{marginBottom:14}}>
            <label className="inp-label">Car</label>
            <select className="inp" style={{appearance:"none",cursor:"pointer"}} value={carId||""} onChange={e=>setCarId(e.target.value)}>
              {myCars.filter(c=>c.make&&c.model).map(c=>(
                <option key={c.id} value={c.id}>{[c.year,c.make,c.model].filter(Boolean).join(" ")}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <label className="inp-label">Race Type</label>
          <div className="seg">
            {raceable.map(f=>(
              <button key={f.key} className={`seg-opt ${format===f.key?"on":""}`} onClick={()=>setFormat(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:20}}>
          <label className="inp-label">Result</label>
          <div className="seg">
            <button className={`seg-opt ${result==="win"?"on":""}`} onClick={()=>setResult("win")}>Win</button>
            <button className={`seg-opt ${result==="loss"?"on":""}`} onClick={()=>setResult("loss")}>Loss</button>
          </div>
        </div>
        <button className="btn btn-primary btn-full" style={{borderRadius:12,padding:14,marginBottom:8}} disabled={saving} onClick={submit}>
          {saving?"Saving…":"Save Result"}
        </button>
        <button className="btn btn-secondary btn-full" style={{borderRadius:12,padding:12}} onClick={onClose}>Cancel</button>
      </div>
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

function Av({user, size=32, isMe=false, onClick, style}) {
  const cls=`av s${size}${isMe?" me":""}`;
  return (
    <div className={cls} onClick={onClick} style={style}>
      {user?.avatarUrl
        ?<img src={user.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt=""/>
        :(user?.avatar||"?")}
    </div>
  );
}

function EditProfile({ myProfile, setMyProfile, myCars, setMyCars, setMyCar, userId, onBack }) {
  const [form, setForm] = useState({
    displayName: myProfile.displayName||"", showRealName: myProfile.showRealName||false,
    city: myProfile.city||"", instagram: myProfile.instagram||"",
    avatar: myProfile.avatar||"", times: myProfile.times||{},
  });
  const initCars = myCars.length > 0
    ? myCars.map(c=>({...c, _photoFile:null, _photoPreview:c.photoUrl||"", _mods:(c.mods||"").split(",").map(s=>s.trim()).filter(Boolean), _deleted:false, _times:{...( c.times||{})}}))
    : [{...BLANK_CAR, isPrimary:true, _photoFile:null, _photoPreview:"", _mods:[], _deleted:false, _times:{}}];
  const [cars, setCars] = useState(initCars);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(myProfile.bannerUrl||"");
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(myProfile.avatarUrl||"");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modsOpenIdx, setModsOpenIdx] = useState(null);
  const [customModInput, setCustomModInput] = useState("");
  const [cropState, setCropState] = useState(null); // {src, aspect, shape, onCrop}
  const bannerRef = useRef(null);
  const profilePhotoRef = useRef(null);
  const fileRefs = useRef({});

  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setC=(idx,k,v)=>setCars(cs=>cs.map((c,i)=>i===idx?{...c,[k]:v}:c));
  const toggleMod=(idx,mod)=>setCars(cs=>cs.map((c,i)=>{
    if(i!==idx) return c;
    const has=c._mods.includes(mod);
    return {...c,_mods:has?c._mods.filter(m=>m!==mod):[...c._mods,mod]};
  }));

  const addCar=()=>setCars(cs=>[...cs,{...BLANK_CAR,isPrimary:false,_photoFile:null,_photoPreview:"",_mods:[],_deleted:false}]);
  const removeCar=(idx)=>{
    setCars(cs=>{
      const updated=cs.map((c,i)=>i===idx?{...c,_deleted:true}:c);
      // If we just deleted the primary, make first non-deleted car primary
      if(cs[idx].isPrimary){
        const first=updated.findIndex(c=>!c._deleted);
        if(first>=0) return updated.map((c,i)=>({...c,isPrimary:i===first}));
      }
      return updated;
    });
  };
  const setPrimary=(idx)=>setCars(cs=>cs.map((c,i)=>({...c,isPrimary:i===idx})));

  const blobToFile=(blob,name)=>new File([blob],name,{type:blob.type});

  const handleBannerSelect=(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    e.target.value="";
    setCropState({src:URL.createObjectURL(file),aspect:{w:3,h:1},shape:"rect",
      onCrop:(blob,url)=>{ setBannerFile(blobToFile(blob,"banner.jpg")); setBannerPreview(url); setCropState(null); }
    });
  };
  const handleProfilePhotoSelect=(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    e.target.value="";
    setCropState({src:URL.createObjectURL(file),aspect:{w:1,h:1},shape:"circle",
      onCrop:(blob,url)=>{ setProfilePhotoFile(blobToFile(blob,"avatar.jpg")); setProfilePhotoPreview(url); setCropState(null); }
    });
  };
  const handlePhotoSelect=(idx,e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    e.target.value="";
    setCropState({src:URL.createObjectURL(file),aspect:{w:4,h:3},shape:"rect",
      onCrop:(blob,url)=>{ setC(idx,"_photoFile",blobToFile(blob,"car.jpg")); setC(idx,"_photoPreview",url); setCropState(null); }
    });
  };

  const handleSave=async()=>{
    if(!userId){setError("Not logged in.");return;}
    setSaving(true); setError("");
    try{
      let bannerUrl=myProfile.bannerUrl||"";
      if(bannerFile){
        const comp=await compressImage(bannerFile,1800);
        const path=`${userId}/banner-${Date.now()}.jpg`;
        const{error:e}=await supabase.storage.from("car-photos").upload(path,comp,{upsert:true,contentType:"image/jpeg"});
        if(e) throw e;
        bannerUrl=supabase.storage.from("car-photos").getPublicUrl(path).data.publicUrl;
      }
      let avatarUrl=myProfile.avatarUrl||"";
      if(profilePhotoFile){
        const comp=await compressImage(profilePhotoFile,400,0.9);
        const path=`${userId}/avatar-${Date.now()}.jpg`;
        const{error:e}=await supabase.storage.from("car-photos").upload(path,comp,{upsert:true,contentType:"image/jpeg"});
        if(e) throw e;
        avatarUrl=supabase.storage.from("car-photos").getPublicUrl(path).data.publicUrl;
      }
      const times=form.times||{};
      const{data:profUpdated,error:profErr}=await supabase.from("profiles").update({
        display_name:form.displayName, show_real_name:form.showRealName,
        city:form.city, instagram:form.instagram, avatar_initials:form.avatar,
        banner_url:bannerUrl||null, avatar_url:avatarUrl||null,
        zero_sixty:    times.zero_sixty    ? parseFloat(times.zero_sixty)    : null,
        zero_120:      times.zero_120      ? parseFloat(times.zero_120)      : null,
        quarter_mile:  times.quarter_mile  ? parseFloat(times.quarter_mile)  : null,
        half_mile:     times.half_mile     ? parseFloat(times.half_mile)     : null,
      }).eq("id",userId).select();
      if(profErr) throw profErr;
      console.log("[handleSave] profiles update result:", profUpdated);
      if(!profUpdated?.length) throw new Error("Profile save was blocked — check Supabase RLS policies (profiles table needs an UPDATE policy for authenticated users).");

      const savedCars=[];
      for(const [i,car] of cars.entries()){
        if(car._deleted){
          if(car.id){const{error:e}=await supabase.from("user_cars").delete().eq("id",car.id);if(e)console.error("delete car err",e);}
          continue;
        }
        if(!car.make.trim()||!car.model.trim()) continue;
        let photoUrl=car.photoUrl;
        if(car._photoFile){
          const comp=await compressImage(car._photoFile,1400);
          const path=`${userId}/car-${Date.now()}-${i}.jpg`;
          const{error:e}=await supabase.storage.from("car-photos").upload(path,comp,{upsert:true,contentType:"image/jpeg"});
          if(e) throw e;
          photoUrl=supabase.storage.from("car-photos").getPublicUrl(path).data.publicUrl;
        }
        const payload={
          user_id:userId, make:car.make.trim(), model:car.model.trim(),
          year:parseInt(car.year)||null, trim:car.trim.trim()||null,
          mods:car._mods.join(", ")||null, build_stage:car.buildStage||"stock",
          photos:photoUrl?[photoUrl]:(car.photoUrl?[car.photoUrl]:[]),
          is_primary:car.isPrimary||false,
          times: car._times||{},
        };
        if(car.id){
          const{data:carUpdated,error:e}=await supabase.from("user_cars").update(payload).eq("id",car.id).select();
          if(e) throw e;
          if(!carUpdated?.length) throw new Error("Car save was blocked — check Supabase RLS policies (user_cars table needs an UPDATE policy for authenticated users).");
          savedCars.push({...carFromRow({...payload,id:car.id,photos:payload.photos,is_primary:payload.is_primary}),isPrimary:car.isPrimary});
        } else {
          const{data:ins,error:e}=await supabase.from("user_cars").insert(payload).select("id").single();
          if(e) throw e;
          savedCars.push({...carFromRow({...payload,id:ins?.id,photos:payload.photos,is_primary:payload.is_primary}),isPrimary:car.isPrimary});
        }
      }
      setMyProfile(p=>({...p,displayName:form.displayName,showRealName:form.showRealName,city:form.city,instagram:form.instagram,avatar:form.avatar,avatarUrl,socials:{...p.socials,instagram:form.instagram},bannerUrl,times:form.times||p.times}));
      setMyCars(savedCars);
      const primary=savedCars.find(c=>c.isPrimary)||savedCars[0];
      if(primary) setMyCar(primary);
      onBack();
    }catch(err){console.error("Save error:",err);setError(err?.message||"Failed to save.");}
    finally{setSaving(false);}
  };

  const activeCars=cars.filter(c=>!c._deleted);

  return (
    <div className="fade">
      {cropState && <CropModal src={cropState.src} aspect={cropState.aspect} shape={cropState.shape} onCancel={()=>setCropState(null)} onCrop={cropState.onCrop}/>}
      <button className="back-btn" onClick={onBack}>← Profile</button>
      <div className="pg-hdr" style={{paddingTop:0}}>
        <div className="pg-title">Edit Profile</div>
        <div className="pg-sub">Update your information</div>
      </div>

      {/* Profile photo */}
      <div className="sec-lbl">Profile Photo</div>
      <div style={{display:"flex",alignItems:"center",gap:14,margin:"0 16px 16px"}}>
        <input ref={profilePhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleProfilePhotoSelect}/>
        <div onClick={()=>profilePhotoRef.current?.click()} style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",border:"2px solid var(--accent)",cursor:"pointer",flexShrink:0,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"var(--accent)"}}>
          {profilePhotoPreview
            ?<img src={profilePhotoPreview} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
            :<span>{form.avatar||"?"}</span>}
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Profile Picture</div>
          <button onClick={()=>profilePhotoRef.current?.click()} style={{padding:"6px 14px",borderRadius:7,border:"1px solid var(--border)",background:"var(--s2)",color:"var(--muted2)",fontSize:12,cursor:"pointer"}}>
            {profilePhotoPreview?"Change Photo":"Upload Photo"}
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="sec-lbl">Profile Banner</div>
      <div style={{margin:"0 16px 8px",borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>bannerRef.current?.click()}>
        <input ref={bannerRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBannerSelect}/>
        {bannerPreview
          ?<img src={bannerPreview} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} alt="banner"/>
          :<div className="profile-banner-empty" style={{height:70,borderRadius:"var(--radius-lg)",fontSize:12}}><span style={{fontSize:16}}>🖼</span> Tap to add a profile banner</div>}
        {bannerPreview&&<div style={{textAlign:"center",padding:"6px 0",fontSize:11,color:"var(--muted2)",background:"var(--s2)"}}>Tap to change banner</div>}
      </div>

      {/* Cars */}
      <div className="sec-lbl">My Garage</div>
      {activeCars.map((car,visIdx)=>{
        const realIdx=cars.indexOf(car);
        return(
          <div key={realIdx} className="card" style={{marginBottom:8,position:"relative"}}>
            {/* Primary badge + controls */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <button onClick={()=>setPrimary(realIdx)} style={{
                padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",
                background:car.isPrimary?"var(--accent)":"var(--s3)",color:car.isPrimary?"#fff":"var(--muted2)",
              }}>{car.isPrimary?"★ Primary":"Set Primary"}</button>
              {activeCars.length>1&&<button onClick={()=>removeCar(realIdx)} style={{padding:"3px 10px",borderRadius:6,fontSize:11,cursor:"pointer",border:"1px solid rgba(255,59,48,.3)",background:"transparent",color:"var(--red)"}}>Remove</button>}
            </div>

            {/* Photo */}
            <input ref={el=>fileRefs.current[realIdx]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handlePhotoSelect(realIdx,e)}/>
            <div className="photo-upload-wrap" onClick={()=>fileRefs.current[realIdx]?.click()} style={{marginBottom:10}}>
              {car._photoPreview&&<img src={car._photoPreview} alt="car"/>}
              <div className="photo-upload-overlay">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span className="photo-upload-hint">{car._photoPreview?"Change photo":"Add photo"}</span>
              </div>
              {!car._photoPreview&&(<><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span style={{fontSize:11,color:"var(--muted2)"}}>Tap to add car photo</span></>)}
            </div>

            {/* Fields */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              {[["Make","make","Honda"],["Model","model","Civic"],["Year","year","2020"],["Trim","trim","Type R"]].map(([label,key,ph])=>(
                <div key={key}>
                  <label className="inp-label">{label}</label>
                  <input className="inp" value={car[key]||""} onChange={e=>setC(realIdx,key,e.target.value)} placeholder={ph} type={key==="year"?"number":"text"}/>
                </div>
              ))}
            </div>

            {/* Build Stage */}
            <div style={{marginBottom:10}}>
              <label className="inp-label">Build Stage</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {BUILD_STAGES.map(s=>(
                  <button key={s.key} onClick={()=>setC(realIdx,"buildStage",s.key)} style={{
                    padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:.3,transition:"all .12s",
                    border:`1px solid ${car.buildStage===s.key?s.color:s.color+"44"}`,
                    background:car.buildStage===s.key?s.bg:"transparent",
                    color:car.buildStage===s.key?s.color:"var(--muted2)",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Mods picker */}
            <div>
              <button onClick={()=>setModsOpenIdx(modsOpenIdx===realIdx?null:realIdx)} style={{
                width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"9px 12px",borderRadius:8,border:"1px solid var(--border)",
                background:"var(--s2)",cursor:"pointer",color:"var(--fg)",fontSize:13,
              }}>
                <span>{car._mods.length>0?`${car._mods.length} mod${car._mods.length>1?"s":""} selected`:"Select Modifications"}</span>
                <span style={{fontSize:10,color:"var(--muted2)",transform:modsOpenIdx===realIdx?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
              </button>
              {car._mods.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                {car._mods.map(m=>(
                  <span key={m} style={{padding:"2px 8px",borderRadius:4,background:"rgba(230,26,26,.12)",color:"var(--accent)",fontSize:11,fontWeight:500}}>{m}</span>
                ))}
              </div>}
              {modsOpenIdx===realIdx&&(
                <div style={{marginTop:8,border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                  {getModCategories(car.make, car.model).map((cat,ci,arr)=>(
                    <div key={cat.label} style={{borderBottom:ci<arr.length-1?"1px solid var(--border)":"none"}}>
                      <div style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:cat.label.startsWith("⭐")?"var(--accent)":"var(--muted2)",letterSpacing:.5,background:"var(--s2)",textTransform:cat.label.startsWith("⭐")?"none":"uppercase"}}>{cat.label}</div>
                      <div style={{padding:"8px 10px",display:"flex",flexWrap:"wrap",gap:6}}>
                        {cat.mods.map(mod=>{
                          const on=car._mods.includes(mod);
                          return(
                            <button key={mod} onClick={()=>toggleMod(realIdx,mod)} style={{
                              padding:"4px 10px",borderRadius:6,fontSize:12,cursor:"pointer",transition:"all .12s",
                              border:`1px solid ${on?"var(--accent)":"var(--border)"}`,
                              background:on?"rgba(230,26,26,.12)":"transparent",
                              color:on?"var(--accent)":"var(--muted2)",fontWeight:on?600:400,
                            }}>{mod}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Custom mod input */}
                  <div style={{borderTop:"1px solid var(--border)",padding:"10px 10px",background:"var(--s2)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--muted2)",letterSpacing:.5,marginBottom:6,textTransform:"uppercase"}}>Custom</div>
                    <div style={{display:"flex",gap:6}}>
                      <input
                        className="inp" placeholder="Type a custom mod…"
                        value={customModInput}
                        onChange={e=>setCustomModInput(e.target.value)}
                        onKeyDown={e=>{
                          if(e.key==="Enter"&&customModInput.trim()&&!car._mods.includes(customModInput.trim())){
                            toggleMod(realIdx,customModInput.trim()); setCustomModInput("");
                          }
                        }}
                        style={{flex:1,padding:"6px 10px",fontSize:12,borderRadius:6}}
                      />
                      <button onClick={()=>{
                        if(customModInput.trim()&&!car._mods.includes(customModInput.trim())){
                          toggleMod(realIdx,customModInput.trim()); setCustomModInput("");
                        }
                      }} style={{padding:"6px 12px",borderRadius:6,background:"var(--accent)",color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>+ Add</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Per-car best times */}
            <div style={{marginTop:10}}>
              <label className="inp-label">Best Times for this Car</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {RACE_TIMES.map(t=>(
                  <div key={t.key} style={{background:"var(--s3)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border)"}}>
                    <label className="inp-label" style={{padding:0,marginBottom:6}}>{t.label} ({t.unit})</label>
                    <input className="inp" style={{padding:"8px 10px",fontSize:13}}
                      value={car._times?.[t.key]||""}
                      onChange={e=>setCars(cs=>cs.map((c,idx)=>idx===realIdx?{...c,_times:{...(c._times||{}),[t.key]:e.target.value}}:c))}
                      placeholder="e.g. 3.8"/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{padding:"0 16px",marginBottom:16}}>
        <button onClick={addCar} style={{width:"100%",padding:"11px",borderRadius:10,border:"1px dashed var(--border)",background:"transparent",color:"var(--muted2)",fontSize:13,cursor:"pointer"}}>
          + Add Another Vehicle
        </button>
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
      <div className="sec-lbl">Best Times</div>
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
