import { useState, useEffect, useRef, useCallback } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, addDoc,
  query, orderBy, limit, onSnapshot, updateDoc, deleteDoc, getDocs, where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ── CONSTANTS ────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || "admin@saitan.mn";

const MONEY_LADDER = [
  { level:1,  amount:1000,    safe:false },
  { level:2,  amount:2000,    safe:false },
  { level:3,  amount:3000,    safe:false },
  { level:4,  amount:5000,    safe:false },
  { level:5,  amount:10000,   safe:true  },
  { level:6,  amount:20000,   safe:false },
  { level:7,  amount:30000,   safe:false },
  { level:8,  amount:50000,   safe:false },
  { level:9,  amount:75000,   safe:false },
  { level:10, amount:100000,  safe:true  },
  { level:11, amount:150000,  safe:false },
  { level:12, amount:200000,  safe:false },
  { level:13, amount:300000,  safe:false },
  { level:14, amount:500000,  safe:false },
  { level:15, amount:1000000, safe:true  },
];

const fmt = n => {
  if (n >= 1000000) return (n/1000000).toFixed(n%1000000===0?0:1)+"сая₮";
  if (n >= 1000)    return (n/1000)+"мянга₮";
  return n+"₮";
};

const DIFF_LABEL = { 1:"Хялбар", 2:"Дунд", 3:"Хэцүү" };
const DIFF_BY_LEVEL = l => l<=5?1:l<=10?2:3;
const TIME_LIMITS   = { 1:30, 2:25, 3:20 };
const MEDALS = ["🥇","🥈","🥉"];

// ── DEFAULT QUESTIONS (fallback if Firestore empty) ──────────
const DEFAULT_QUESTIONS = [
  { q:"Монгол улсын нийслэл хот аль вэ?", opts:["Дархан","Эрдэнэт","Улаанбаатар","Чойбалсан"], a:2, diff:1, cat:"Газарзүй" },
  { q:"Усны химийн томьёо юу вэ?", opts:["CO2","H2O","NaCl","O2"], a:1, diff:1, cat:"Шинжлэх ухаан" },
  { q:"Дэлхийн хамгийн том тив аль вэ?", opts:["Африк","Америк","Ази","Европ"], a:2, diff:1, cat:"Газарзүй" },
  { q:"Олимпийн бэлгэдэлд хэдэн цагираг байдаг вэ?", opts:["4","5","6","7"], a:1, diff:1, cat:"Спорт" },
  { q:"1 долоо хоногт хэдэн өдөр байдаг вэ?", opts:["5","6","7","8"], a:2, diff:1, cat:"Ерөнхий" },
  { q:"Дэлхийн хамгийн өндөр уул аль вэ?", opts:["K2","Канченжанга","Эверест","Лхоцзе"], a:2, diff:1, cat:"Газарзүй" },
  { q:"Нарнаас хамгийн ойр гараг аль вэ?", opts:["Сугар","Дэлхий","Буд","Ангараг"], a:2, diff:1, cat:"Шинжлэх ухаан" },
  { q:"WWW гэж юуны товчлол вэ?", opts:["World Wide Web","World War Web","Wide World Web","Web Wide Word"], a:0, diff:1, cat:"Технологи" },
  { q:"Говийн цөл аль улсуудад байдаг вэ?", opts:["Монгол,Хятад","Казахстан,Орос","Энэтхэг,Пакистан","Иран,Ирак"], a:0, diff:1, cat:"Газарзүй" },
  { q:"Мона Лизаг хэн зурсан бэ?", opts:["Микеланжело","Рафаэль","Леонардо да Винчи","Ван Гог"], a:2, diff:1, cat:"Урлаг" },
  { q:"Чингис хааны бодит нэр юу вэ?", opts:["Хасар","Тэмүжин","Жамуха","Өгөдэй"], a:1, diff:2, cat:"Түүх" },
  { q:"π (пи)-ийн ойролцоо утга юу вэ?", opts:["3.14159","2.71828","1.61803","1.41421"], a:0, diff:2, cat:"Математик" },
  { q:"Дэлхийн хамгийн урт гол аль вэ?", opts:["Амазон","Нил","Янцзы","Миссисипи"], a:1, diff:2, cat:"Газарзүй" },
  { q:"Python хэлийг хэн бүтээсэн бэ?", opts:["Линус Торвалд","Гвидо ван Россум","Деннис Ричи","Бьярн Страуструп"], a:1, diff:2, cat:"Технологи" },
  { q:"Байгал нуур хаана байдаг вэ?", opts:["Монгол","Казахстан","Орос","Хятад"], a:2, diff:2, cat:"Газарзүй" },
  { q:"Монгол бөхийн хамгийн дээд цол аль вэ?", opts:["Арслан","Заан","Дааган","Аварга"], a:3, diff:2, cat:"Спорт" },
  { q:"2 зэрэг 10 хэд вэ?", opts:["512","1024","2048","256"], a:1, diff:2, cat:"Математик" },
  { q:"Шекспирийг хаана төрсөн вэ?", opts:["Лондон","Стратфорд-он-Эйвон","Оксфорд","Бирмингем"], a:1, diff:2, cat:"Соёл" },
  { q:"1 байт хэдэн битийн байдаг вэ?", opts:["4","8","16","32"], a:1, diff:2, cat:"Технологи" },
  { q:"Бетховен хэдэн симфони бичсэн бэ?", opts:["7","8","9","10"], a:2, diff:2, cat:"Урлаг" },
  { q:"Монгол эзэнт гүрэн хамгийн өргөн тархсан нь ямар он байсан бэ?", opts:["1206","1227","1279","1368"], a:2, diff:3, cat:"Түүх" },
  { q:"Гэрлийн хурд секундэд ойролцоогоор хэд км явдаг вэ?", opts:["150,000","300,000","500,000","1,000,000"], a:1, diff:3, cat:"Шинжлэх ухаан" },
  { q:"ДНХ-ийн бүрэн нэр юу вэ?", opts:["Динитро харбон","Дезоксирибонуклейн хүчил","Диагностик нейрон хүчил","Дидезоксирибоза"], a:1, diff:3, cat:"Шинжлэх ухаан" },
  { q:"Атомын цөмийг нь эхлэн нээсэн эрдэмтэн хэн вэ?", opts:["Эйнштейн","Кюри","Резерфорд","Бор"], a:2, diff:3, cat:"Шинжлэх ухаан" },
  { q:"JavaScript-ийг анх ямар нэрээр нэрлэсэн бэ?", opts:["LiveScript","WebScript","NetScript","ScriptWeb"], a:0, diff:3, cat:"Технологи" },
  { q:"Алтан харьцаа ойролцоогоор хэд вэ?", opts:["1.414","1.618","2.718","3.141"], a:1, diff:3, cat:"Математик" },
  { q:"0! (0 факториал) хэд вэ?", opts:["0","1","Тодорхойгүй","∞"], a:1, diff:3, cat:"Математик" },
  { q:"Дэлхийн хамгийн гүн далай аль вэ?", opts:["Атлант","Энэтхэг","Номхон","Хойд мөсөн"], a:2, diff:3, cat:"Газарзүй" },
  { q:"Пагва бичиг-ийг хэн үүсгэсэн бэ?", opts:["Чингис хаан","Хубилай хаан","Пагва лам","Зая Пандит"], a:2, diff:3, cat:"Түүх" },
  { q:"Нейронт сүлжээний суурь нэгжийг юу гэдэг вэ?", opts:["Алгоритм","Перцептрон","Матриц","Градиент"], a:1, diff:3, cat:"Технологи" },
];

// ── HELPERS ──────────────────────────────────────────────────
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function getQuestionSet(allQuestions) {
  const easy   = shuffle(allQuestions.filter(q=>q.diff===1)).slice(0,5);
  const medium = shuffle(allQuestions.filter(q=>q.diff===2)).slice(0,5);
  const hard   = shuffle(allQuestions.filter(q=>q.diff===3)).slice(0,5);
  return [...easy,...medium,...hard];
}

// ── STYLES ───────────────────────────────────────────────────
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#02040e;--bg2:#050a1a;--surf:#080f22;--card:#0b1328;
  --bdr:#162040;--bdr2:#1e2d55;
  --gold:#f59e0b;--gold2:#fcd34d;--gold3:#92650a;
  --cyan:#06b6d4;--purple:#7c3aed;--purple2:#a78bfa;
  --green:#10b981;--red:#ef4444;--orange:#f97316;
  --txt:#f0f6ff;--txt2:#8ba3cc;--txt3:#4a6390;
  --safe:#10b981;
}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--txt);font-family:'Sora',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% 0%,rgba(245,158,11,.06) 0%,transparent 50%),radial-gradient(ellipse at 0% 100%,rgba(124,58,237,.06) 0%,transparent 50%);}
*{position:relative;z-index:1;}
button{cursor:pointer;font-family:'Sora',sans-serif;}
input,textarea,select{font-family:'Sora',sans-serif;}
::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:var(--bg);} ::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px;}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
@keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(245,158,11,.15)}50%{box-shadow:0 0 50px rgba(245,158,11,.4),0 0 100px rgba(245,158,11,.1)}}
@keyframes moneyRise{from{opacity:0;transform:translateY(10px) scale(.9);}to{opacity:1;transform:translateY(0) scale(1);}}
@keyframes correctFlash{0%{background:rgba(16,185,129,.1)}50%{background:rgba(16,185,129,.35)}100%{background:rgba(16,185,129,.1)}}
@keyframes slideIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}

/* LOADING */
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:20px;}
.loading-logo{font-size:52px;font-weight:800;letter-spacing:-2px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;animation:fadeIn 1s .3s both;}
.loading-bar{width:160px;height:2px;background:var(--bdr);border-radius:2px;overflow:hidden;}
.loading-bar::after{content:'';display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));animation:pulse 1.2s infinite;}
.spin{width:22px;height:22px;border:3px solid var(--bdr);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite;}

/* AUTH */
.auth-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 20%,rgba(245,158,11,.07),transparent 60%),var(--bg);}
.auth-box{background:var(--card);border:1px solid var(--bdr);border-radius:20px;padding:36px 28px;width:100%;max-width:420px;box-shadow:0 32px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.03) inset;animation:fadeUp .5s ease;}
@media(min-width:480px){.auth-box{padding:44px 40px;}}
.auth-logo{text-align:center;margin-bottom:32px;}
.auth-logo-main{font-size:clamp(36px,8vw,52px);font-weight:800;letter-spacing:-2px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;display:block;line-height:1;}
.auth-logo-sub{font-size:11px;color:var(--txt3);letter-spacing:3px;text-transform:uppercase;margin-top:6px;display:block;}
.auth-tabs{display:flex;background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:3px;gap:3px;margin-bottom:22px;}
.auth-tab{flex:1;padding:9px;border:none;background:transparent;color:var(--txt3);font-size:13px;font-weight:600;border-radius:8px;transition:all .2s;}
.auth-tab.on{background:var(--surf);color:var(--gold);box-shadow:0 2px 8px rgba(0,0,0,.4);}
.fg{margin-bottom:13px;}
.fg label{display:block;font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;}
.fg input,.fg select,.fg textarea{width:100%;background:var(--bg2);border:1px solid var(--bdr);border-radius:9px;padding:11px 14px;color:var(--txt);font-size:14px;outline:none;transition:all .2s;}
.fg textarea{resize:vertical;min-height:80px;}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(245,158,11,.12);}
.fg select option{background:var(--bg2);}
.btn-gold{width:100%;background:linear-gradient(135deg,#b45309,#d97706,#f59e0b);color:#0a0600;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;letter-spacing:.3px;transition:all .25s;margin-top:8px;overflow:hidden;position:relative;}
.btn-gold::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 30%,rgba(255,255,255,.2) 50%,transparent 70%);transform:translateX(-100%);transition:.4s;}
.btn-gold:hover::before{transform:translateX(100%);}
.btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,.35);}
.btn-gold:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.btn-outline-gold{background:transparent;border:1.5px solid var(--gold);color:var(--gold);border-radius:10px;padding:11px 20px;font-size:13px;font-weight:700;transition:all .2s;}
.btn-outline-gold:hover{background:rgba(245,158,11,.08);}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#fca5a5;padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:12px;}
.suc{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:#6ee7b7;padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:12px;}

/* NAVBAR */
.navbar{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(2,4,14,.9);backdrop-filter:blur(16px);border-bottom:1px solid var(--bdr);height:58px;display:flex;align-items:center;padding:0 20px;justify-content:space-between;}
@media(min-width:640px){.navbar{padding:0 32px;}}
.nav-logo{font-size:22px;font-weight:800;letter-spacing:-1px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;cursor:pointer;}
.nav-right{display:flex;align-items:center;gap:8px;}
.nav-tabs{display:flex;gap:4px;}
.nav-tab{background:none;border:none;color:var(--txt3);font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;transition:all .2s;}
.nav-tab.on{color:var(--gold);background:rgba(245,158,11,.08);}
.nav-tab.admin-tab{color:var(--purple2);}
.nav-tab.admin-tab.on{background:rgba(124,58,237,.1);}
.nav-stat{font-family:'JetBrains Mono';font-size:13px;color:var(--gold);background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);padding:4px 12px;border-radius:20px;white-space:nowrap;}
.nav-user{font-size:12px;color:var(--txt2);font-weight:600;display:none;}
@media(min-width:600px){.nav-user{display:block;}}
.nav-btn{background:transparent;border:1px solid var(--bdr);color:var(--txt3);padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;transition:all .2s;}
.nav-btn:hover{border-color:var(--bdr2);color:var(--txt2);}

/* HOME */
.home-wrap{padding:76px 20px 48px;max-width:960px;margin:0 auto;}
.home-hero{text-align:center;margin-bottom:48px;animation:fadeUp .7s ease;}
.home-title{font-size:clamp(32px,7vw,60px);font-weight:800;letter-spacing:-2px;line-height:1;margin-bottom:12px;}
.home-title .g{background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;}
.home-sub{font-size:15px;color:var(--txt2);max-width:480px;margin:0 auto 28px;line-height:1.6;}
.profile-card{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin-bottom:40px;}
.pstat{text-align:center;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:14px 20px;min-width:100px;}
.pstat-num{font-family:'JetBrains Mono';font-size:24px;font-weight:700;display:block;color:var(--gold);}
.pstat-label{font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;}

/* LADDER PREVIEW */
.ladder-preview{background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:20px;margin-bottom:24px;max-width:560px;margin-left:auto;margin-right:auto;}
.ladder-preview-title{font-size:12px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;}
.ladder-mini{display:flex;flex-direction:column;gap:3px;}
.ladder-mini-item{display:flex;justify-content:space-between;align-items:center;padding:4px 10px;border-radius:6px;font-size:12px;}
.ladder-mini-item.safe{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);}
.ladder-mini-item .lv{color:var(--txt3);font-family:'JetBrains Mono';font-size:11px;}
.ladder-mini-item .am{font-family:'JetBrains Mono';font-weight:700;color:var(--gold2);}
.ladder-mini-item.safe .am{color:var(--safe);}

/* ══════════════════════════════════════════════
   MILLIONAIRE GAME SCREEN — Classic Design
   ══════════════════════════════════════════════ */
@keyframes mmAppear{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}
@keyframes mmPulseGold{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0),inset 0 1px 0 rgba(255,255,255,.15);}50%{box-shadow:0 0 28px 6px rgba(245,158,11,.35),inset 0 1px 0 rgba(255,255,255,.15);}}
@keyframes mmCorrect{0%{background:var(--mm-opt-bg);}30%{background:rgba(255,210,0,.25);}60%{background:rgba(16,185,129,.3);}100%{background:rgba(16,185,129,.18);}}
@keyframes mmWrong{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}
@keyframes timerBlink{0%,100%{opacity:1;}50%{opacity:.3;}}

:root{
  --mm-bg:#04060f;
  --mm-glow-blue:rgba(30,120,255,.18);
  --mm-glow-cyan:rgba(0,200,255,.12);
  --mm-opt-bg:linear-gradient(180deg,#0f1e3d 0%,#071228 100%);
  --mm-opt-border:#1a4080;
  --mm-opt-active:linear-gradient(180deg,#1a3a70 0%,#0d2550 100%);
  --mm-opt-hover-border:#4a90e2;
  --mm-ladder-bg:#050c1e;
  --mm-ladder-current:#1a4a00;
  --mm-ladder-safe:#0a3a1a;
  --mm-gold:#ffd700;
  --mm-gold2:#ffec6e;
  --mm-cyan:#00cfff;
  --mm-white:#e8f4ff;
  --mm-dim:#6a85aa;
}

/* Full-screen game layout */
.mm-game{
  min-height:100vh;
  background:var(--mm-bg);
  display:grid;
  grid-template-rows:auto 1fr auto;
  grid-template-columns:1fr;
  position:relative;
  overflow:hidden;
}
/* Starfield bg */
.mm-game::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,80,200,.22) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 50% 110%, rgba(0,40,120,.18) 0%, transparent 60%),
    radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,.35) 0%, transparent 100%),
    radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,.3) 0%, transparent 100%),
    radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,.25) 0%, transparent 100%),
    radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,.3) 0%, transparent 100%),
    #04060f;
}
.mm-game>*{position:relative;z-index:1;}

/* ── DESKTOP: side ladder ── */
@media(min-width:860px){
  .mm-game{
    grid-template-columns:1fr 200px;
    grid-template-rows:1fr;
  }
  .mm-main{grid-column:1;grid-row:1;}
  .mm-ladder{grid-column:2;grid-row:1;}
  .mm-lifelines-mobile{display:none;}
}

/* ── MAIN CENTER AREA ── */
.mm-main{
  display:flex;flex-direction:column;align-items:center;
  padding:24px 16px 20px;
  gap:16px;
  max-width:760px;margin:0 auto;width:100%;
}
@media(min-width:860px){.mm-main{padding:32px 40px 32px;max-width:none;}}

/* Logo / title bar */
.mm-topbar{
  width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
}
.mm-logo{
  font-size:clamp(18px,4vw,26px);font-weight:800;letter-spacing:-1px;
  background:linear-gradient(135deg,var(--mm-gold),var(--mm-gold2));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  white-space:nowrap;
}
.mm-prize-display{
  font-family:'JetBrains Mono';font-size:clamp(16px,3.5vw,24px);font-weight:700;
  color:var(--mm-gold);
  background:linear-gradient(135deg,rgba(120,80,0,.5),rgba(60,40,0,.6));
  border:1.5px solid rgba(200,150,0,.4);
  padding:6px 18px;border-radius:30px;
  text-shadow:0 0 20px rgba(255,210,0,.5);
  white-space:nowrap;
  animation:mmAppear .4s ease;
}
.mm-level-tag{
  font-size:11px;color:var(--mm-dim);font-weight:700;letter-spacing:1px;
  white-space:nowrap;
}

/* Timer bar */
.mm-timer-wrap{width:100%;display:flex;align-items:center;gap:10px;}
.mm-timer-track{flex:1;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;}
.mm-timer-fill{height:100%;border-radius:3px;transition:width 1s linear,background .4s;}
.mm-timer-num{
  font-family:'JetBrains Mono';font-size:15px;font-weight:700;
  min-width:26px;text-align:right;
}
.mm-timer-num.danger{animation:timerBlink .5s infinite;}

/* Question box — hexagonal top/bottom chrome */
.mm-qbox-wrap{width:100%;position:relative;}
.mm-qbox{
  width:100%;
  background:linear-gradient(180deg,#0d1f42 0%,#060e24 100%);
  border:2px solid rgba(50,120,255,.5);
  border-radius:16px;
  padding:clamp(16px,4vw,28px) clamp(18px,5vw,36px);
  text-align:center;
  box-shadow:
    0 0 0 1px rgba(0,150,255,.08),
    0 0 40px rgba(0,80,200,.2),
    inset 0 1px 0 rgba(100,180,255,.1);
  position:relative;overflow:hidden;
}
.mm-qbox::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(0,180,255,.6),rgba(255,210,0,.4),rgba(0,180,255,.6),transparent);
}
.mm-qbox::after{
  content:'';position:absolute;bottom:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(0,180,255,.4),transparent);
}
.mm-qnum{font-size:11px;color:var(--mm-dim);font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.mm-qtext{
  font-size:clamp(14px,2.8vw,20px);font-weight:700;
  color:var(--mm-white);line-height:1.5;
}

/* Lifelines */
.mm-lifelines{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.mm-ll-btn{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  background:rgba(255,255,255,.04);
  border:1.5px solid rgba(80,140,255,.3);
  border-radius:50%;width:62px;height:62px;
  font-size:11px;font-weight:700;color:rgba(200,220,255,.7);
  transition:all .22s;padding:0;justify-content:center;
}
.mm-ll-btn .ll-icon{font-size:20px;line-height:1;}
.mm-ll-btn:hover:not(:disabled){
  border-color:var(--mm-cyan);color:var(--mm-cyan);
  background:rgba(0,200,255,.08);
  transform:scale(1.08);
}
.mm-ll-btn:disabled{opacity:.2;cursor:not-allowed;}
.mm-ll-btn.used{opacity:.15;filter:grayscale(1);}
@media(min-width:860px){
  .mm-ll-btn{width:70px;height:70px;}
  .mm-ll-btn .ll-icon{font-size:22px;}
}

/* ── ANSWER OPTIONS — Diamond/Hexagon shapes ── */
.mm-opts{
  width:100%;display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}
@media(max-width:480px){.mm-opts{grid-template-columns:1fr;gap:8px;}}

.mm-opt{
  position:relative;
  background:var(--mm-opt-bg);
  border:2px solid var(--mm-opt-border);
  border-radius:0;
  clip-path:polygon(16px 0%,calc(100% - 16px) 0%,100% 50%,calc(100% - 16px) 100%,16px 100%,0% 50%);
  padding:14px 28px 14px 20px;
  font-size:clamp(12px,2.2vw,14px);font-weight:600;
  color:rgba(180,210,255,.9);
  text-align:left;
  transition:all .2s;
  display:flex;align-items:center;gap:10px;
  min-height:52px;
  cursor:pointer;
  overflow:hidden;
}
/* Glow border using pseudo */
.mm-opt::before{
  content:'';position:absolute;inset:0;
  clip-path:polygon(16px 0%,calc(100% - 16px) 0%,100% 50%,calc(100% - 16px) 100%,16px 100%,0% 50%);
  background:transparent;
  box-shadow:inset 0 0 0 2px var(--mm-opt-border);
  transition:box-shadow .2s;
}
.mm-opt::after{
  content:'';position:absolute;inset:0;opacity:0;
  background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%);
  transition:opacity .3s;
}
.mm-opt:hover:not(:disabled)::after{opacity:1;}
.mm-opt:hover:not(:disabled){
  background:var(--mm-opt-active);
  border-color:var(--mm-opt-hover-border);
  color:#fff;
  transform:scaleX(1.012);
  box-shadow:0 0 18px rgba(50,150,255,.25);
}
.mm-opt.correct{
  background:linear-gradient(180deg,rgba(16,185,129,.3) 0%,rgba(10,100,60,.35) 100%)!important;
  border-color:#10b981!important;
  color:#6ee7b7!important;
  animation:mmCorrect .7s ease forwards;
  box-shadow:0 0 24px rgba(16,185,129,.4)!important;
}
.mm-opt.wrong{
  background:linear-gradient(180deg,rgba(239,68,68,.25) 0%,rgba(120,20,20,.3) 100%)!important;
  border-color:#ef4444!important;
  color:#fca5a5!important;
  animation:mmWrong .5s ease;
}
.mm-opt.reveal{
  background:linear-gradient(180deg,rgba(16,185,129,.15) 0%,rgba(10,80,50,.2) 100%)!important;
  border-color:rgba(16,185,129,.5)!important;
  color:#6ee7b7!important;
}
.mm-opt.hidden{opacity:0;pointer-events:none;}
.mm-opt:disabled{cursor:default;}
.mm-opt-letter{
  font-family:'JetBrains Mono';font-size:11px;font-weight:700;
  color:var(--mm-dim);flex-shrink:0;width:18px;
}

/* Walk away */
.mm-walk-btn{
  background:transparent;
  border:1px solid rgba(239,68,68,.25);
  border-radius:8px;padding:9px 20px;
  font-size:12px;font-weight:600;color:rgba(239,68,68,.6);
  transition:all .2s;width:100%;
}
.mm-walk-btn:hover{border-color:rgba(239,68,68,.6);color:#fca5a5;background:rgba(239,68,68,.05);}

/* Crowd bars */
.crowd-bars{display:flex;gap:8px;align-items:flex-end;height:72px;margin:10px 0;justify-content:center;}
.crowd-bar-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
.crowd-bar{width:100%;max-width:36px;border-radius:3px 3px 0 0;transition:height .5s ease;min-height:4px;}
.crowd-pct{font-family:'JetBrains Mono';font-size:10px;color:var(--mm-dim);}
.crowd-opt{font-family:'JetBrains Mono';font-size:10px;color:rgba(100,140,180,.6);}
.call-bubble{
  background:rgba(255,255,255,.04);border:1px solid rgba(80,140,255,.25);
  border-radius:12px;padding:12px 16px;font-size:13px;
  color:rgba(180,210,255,.8);line-height:1.6;font-style:italic;
}
.mm-hint-box{
  background:rgba(255,255,255,.03);border:1px solid rgba(80,140,255,.2);
  border-radius:10px;padding:10px 14px;font-size:12px;color:var(--mm-dim);
  width:100%;
}
.mm-hint-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;color:rgba(100,160,255,.7);}

/* ── MONEY LADDER (right panel) ── */
.mm-ladder{
  background:var(--mm-ladder-bg);
  border-left:1px solid rgba(30,80,200,.25);
  display:flex;flex-direction:column;
  padding:12px 8px;gap:3px;
  overflow-y:auto;
}
/* Mobile: horizontal scroll strip at bottom */
@media(max-width:859px){
  .mm-ladder{
    border-left:none;border-top:1px solid rgba(30,80,200,.25);
    flex-direction:row;padding:10px 12px;
    overflow-x:auto;overflow-y:hidden;
    flex-wrap:nowrap;
  }
}

.mm-rung{
  display:flex;align-items:center;gap:6px;
  padding:5px 10px;border-radius:4px;
  border:1px solid transparent;
  transition:all .2s;flex-shrink:0;
}
/* Mobile rung sizing */
@media(max-width:859px){
  .mm-rung{min-width:110px;flex-direction:column;align-items:flex-start;padding:6px 10px;border-radius:6px;}
}
.mm-rung.passed{opacity:.3;}
.mm-rung.current{
  background:linear-gradient(135deg,rgba(255,210,0,.12),rgba(180,120,0,.1));
  border-color:rgba(255,210,0,.5);
  animation:mmPulseGold 2s infinite;
}
.mm-rung.current .rung-amt{color:var(--mm-gold);font-weight:800;}
.mm-rung.safe-rung{background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.2);}
.mm-rung.safe-rung .rung-amt{color:#10b981;}
.rung-num{
  font-family:'JetBrains Mono';font-size:10px;color:var(--mm-dim);
  min-width:18px;text-align:right;
}
.rung-dot{width:5px;height:5px;border-radius:50%;background:rgba(100,140,200,.35);flex-shrink:0;}
.mm-rung.current .rung-dot{background:var(--mm-gold);}
.mm-rung.safe-rung .rung-dot{background:#10b981;}
.rung-amt{
  font-family:'JetBrains Mono';font-size:clamp(11px,1.5vw,12px);
  font-weight:600;color:rgba(160,190,230,.7);flex:1;
  white-space:nowrap;
}


/* RESULT */
.result-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 50% 30%,rgba(245,158,11,.06),transparent 60%),var(--bg);}
.result-box{background:var(--card);border:1px solid var(--bdr);border-radius:24px;padding:48px 36px;text-align:center;max-width:480px;width:100%;animation:fadeUp .5s ease;box-shadow:0 40px 80px rgba(0,0,0,.6);}
.result-emoji{font-size:72px;display:block;margin-bottom:20px;}
.result-title{font-size:28px;font-weight:800;letter-spacing:-1px;margin-bottom:8px;}
.result-amount{font-family:'JetBrains Mono';font-size:clamp(36px,8vw,56px);font-weight:700;color:var(--gold);margin-bottom:8px;animation:moneyRise .5s ease .2s both;}
.result-sub{font-size:13px;color:var(--txt3);margin-bottom:24px;}
.result-stats{display:flex;justify-content:center;gap:20px;margin-bottom:28px;flex-wrap:wrap;}
.rstat{text-align:center;background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:12px 20px;min-width:90px;}
.rstat-num{font-family:'JetBrains Mono';font-size:20px;font-weight:700;display:block;}
.rstat-label{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
.result-btns{display:flex;gap:10px;flex-direction:column;}
@media(min-width:400px){.result-btns{flex-direction:row;}}

/* LEADERBOARD */
.lb-wrap{padding:76px 20px 48px;max-width:720px;margin:0 auto;}
.lb-header{text-align:center;margin-bottom:32px;animation:fadeUp .5s ease;}
.lb-title{font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-1px;margin-bottom:8px;}
.lb-sub{font-size:14px;color:var(--txt3);}
.lb-list{display:flex;flex-direction:column;gap:8px;}
.lb-item{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--bdr);border-radius:14px;padding:14px 18px;transition:all .3s;animation:fadeUp .4s ease both;}
.lb-item:hover{border-color:var(--bdr2);transform:translateX(4px);}
.lb-item.me{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.04);animation:glow 3s infinite;}
.lb-item.top1{border-color:var(--gold);background:rgba(245,158,11,.06);}
.lb-rank{font-family:'JetBrains Mono';font-size:18px;font-weight:700;min-width:36px;text-align:center;}
.lb-avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0;}
.lb-info{flex:1;}
.lb-name{font-size:14px;font-weight:700;}
.lb-detail{font-size:11px;color:var(--txt3);margin-top:2px;}
.lb-prize{text-align:right;}
.lb-prize-num{font-family:'JetBrains Mono';font-size:18px;font-weight:800;color:var(--gold);display:block;}
.lb-prize-label{font-size:10px;color:var(--txt3);}
.me-tag{display:inline-block;font-size:9px;font-weight:700;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);color:var(--gold);padding:1px 7px;border-radius:6px;margin-left:6px;vertical-align:middle;}
.lb-empty{text-align:center;padding:60px;color:var(--txt3);font-size:14px;}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:fadeIn .2s;}
.modal-box{background:var(--card);border:1px solid var(--bdr);border-radius:18px;padding:28px 24px;width:100%;max-width:400px;animation:fadeUp .3s ease;max-height:90vh;overflow-y:auto;}
.modal-title{font-size:18px;font-weight:800;margin-bottom:8px;}
.modal-sub{font-size:13px;color:var(--txt2);margin-bottom:20px;line-height:1.6;}
.modal-btns{display:flex;gap:10px;}
.modal-btns .btn-gold{margin-top:0;}
.btn-modal-cancel{background:transparent;border:1px solid var(--bdr);color:var(--txt3);padding:11px 20px;border-radius:9px;font-size:13px;font-weight:600;transition:all .2s;flex:1;}
.btn-modal-cancel:hover{border-color:var(--bdr2);color:var(--txt2);}

/* ── ADMIN PANEL ── */
.admin-wrap{padding:76px 20px 48px;max-width:1100px;margin:0 auto;}
.admin-header{margin-bottom:32px;animation:fadeUp .5s ease;}
.admin-title{font-size:clamp(22px,4vw,32px);font-weight:800;letter-spacing:-1px;margin-bottom:6px;}
.admin-title span{background:linear-gradient(135deg,var(--purple),var(--purple2));-webkit-background-clip:text;background-clip:text;color:transparent;}
.admin-tabs{display:flex;gap:4px;background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:3px;margin-bottom:28px;width:fit-content;}
.admin-tab{padding:8px 18px;border:none;background:transparent;color:var(--txt3);font-size:12px;font-weight:700;border-radius:7px;transition:all .2s;letter-spacing:.5px;text-transform:uppercase;}
.admin-tab.on{background:var(--surf);color:var(--purple2);box-shadow:0 2px 8px rgba(0,0,0,.4);}
.admin-stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:28px;}
.astat{background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:16px 20px;flex:1;min-width:120px;}
.astat-num{font-family:'JetBrains Mono';font-size:28px;font-weight:700;color:var(--purple2);display:block;}
.astat-label{font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;}

/* Question table */
.q-table{width:100%;border-collapse:collapse;}
.q-table-wrap{background:var(--card);border:1px solid var(--bdr);border-radius:14px;overflow:hidden;}
.q-table th{background:var(--bg2);padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--bdr);}
.q-table td{padding:12px 16px;font-size:13px;color:var(--txt2);border-bottom:1px solid var(--bdr);vertical-align:top;}
.q-table tr:last-child td{border-bottom:none;}
.q-table tr:hover td{background:rgba(255,255,255,.02);}
.q-text-cell{color:var(--txt);font-weight:500;max-width:280px;}
.diff-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:.5px;}
.diff-pill.d1{background:rgba(16,185,129,.15);color:var(--green);}
.diff-pill.d2{background:rgba(245,158,11,.15);color:var(--gold);}
.diff-pill.d3{background:rgba(239,68,68,.15);color:var(--red);}
.cat-pill{font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(124,58,237,.15);color:var(--purple2);}
.action-btns{display:flex;gap:6px;}
.btn-icon{background:transparent;border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;color:var(--txt3);transition:all .2s;}
.btn-icon:hover{border-color:var(--bdr2);color:var(--txt2);}
.btn-icon.del:hover{border-color:rgba(239,68,68,.5);color:var(--red);background:rgba(239,68,68,.05);}
.btn-icon.edit:hover{border-color:rgba(245,158,11,.5);color:var(--gold);background:rgba(245,158,11,.05);}

/* ADD QUESTION FORM */
.add-form{background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:24px;margin-bottom:24px;animation:fadeUp .4s ease;}
.add-form-title{font-size:15px;font-weight:700;margin-bottom:20px;color:var(--txt);}
.form-row{display:grid;gap:12px;margin-bottom:12px;}
@media(min-width:600px){.form-row.two{grid-template-columns:1fr 1fr;}}
@media(min-width:800px){.form-row.four{grid-template-columns:1fr 1fr 1fr 1fr;}}
.correct-radio{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
.radio-opt{display:flex;align-items:center;gap:6px;background:var(--bg2);border:1.5px solid var(--bdr);border-radius:8px;padding:7px 12px;cursor:pointer;transition:all .2s;font-size:12px;font-weight:600;color:var(--txt3);}
.radio-opt:hover{border-color:var(--bdr2);}
.radio-opt.selected{border-color:var(--green);background:rgba(16,185,129,.08);color:var(--green);}
.radio-dot{width:8px;height:8px;border-radius:50%;background:var(--bdr2);transition:all .2s;}
.radio-opt.selected .radio-dot{background:var(--green);}
.form-actions{display:flex;gap:10px;margin-top:16px;}
.form-actions .btn-gold{width:auto;padding:10px 24px;margin-top:0;}

/* JSON IMPORT */
.json-import{background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:24px;margin-bottom:24px;}
.json-import-title{font-size:15px;font-weight:700;margin-bottom:12px;}
.json-example{background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:12px;font-family:'JetBrains Mono';font-size:11px;color:var(--txt3);margin-bottom:12px;overflow-x:auto;white-space:pre;}
.json-textarea{width:100%;background:var(--bg2);border:1px solid var(--bdr);border-radius:9px;padding:12px;color:var(--txt);font-family:'JetBrains Mono';font-size:12px;outline:none;transition:all .2s;min-height:160px;resize:vertical;}
.json-textarea:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(124,58,237,.12);}

/* SEARCH & FILTER */
.q-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;}
.q-search{background:var(--bg2);border:1px solid var(--bdr);border-radius:9px;padding:9px 14px;color:var(--txt);font-size:13px;outline:none;transition:all .2s;flex:1;min-width:180px;}
.q-search:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(124,58,237,.1);}
.q-filter{background:var(--bg2);border:1px solid var(--bdr);border-radius:9px;padding:9px 14px;color:var(--txt2);font-size:12px;outline:none;cursor:pointer;}
.q-count{font-size:12px;color:var(--txt3);white-space:nowrap;}

/* TOGGLE SWITCH */
.toggle-wrap{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--txt2);}
.toggle{position:relative;width:36px;height:20px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;cursor:pointer;inset:0;background:var(--bdr2);border-radius:20px;transition:.2s;}
.toggle-slider:before{content:'';position:absolute;height:14px;width:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;}
.toggle input:checked+.toggle-slider{background:var(--green);}
.toggle input:checked+.toggle-slider:before{transform:translateX(16px);}

/* TOAST */
.toast-wrap{position:fixed;bottom:24px;right:24px;z-index:500;display:flex;flex-direction:column;gap:8px;pointer-events:none;}
.toast{background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 18px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;animation:slideIn .3s ease;box-shadow:0 8px 30px rgba(0,0,0,.5);}
.toast.success{border-color:rgba(16,185,129,.4);color:var(--green);}
.toast.error{border-color:rgba(239,68,68,.4);color:var(--red);}

/* PROFILE view */
.profile-wrap{padding:76px 20px 48px;max-width:600px;margin:0 auto;}
.profile-card-big{background:var(--card);border:1px solid var(--bdr);border-radius:20px;padding:32px;text-align:center;margin-bottom:24px;animation:fadeUp .5s ease;}
.profile-avatar{width:72px;height:72px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;}
.profile-name{font-size:22px;font-weight:800;margin-bottom:4px;}
.profile-email{font-size:12px;color:var(--txt3);margin-bottom:20px;}
.profile-stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.ps-item{background:var(--bg2);border:1px solid var(--bdr);border-radius:10px;padding:14px 8px;text-align:center;}
.ps-num{font-family:'JetBrains Mono';font-size:20px;font-weight:700;color:var(--gold);display:block;}
.ps-label{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;}
`;

// ── TOAST SYSTEM ─────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  return { toasts, addToast };
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? "✓" : "✕"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────
function AuthScreen() {
  const [tab, setTab]   = useState("login");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr]   = useState(""); const [load, setLoad]   = useState(false);
  const reset = t => { setTab(t); setErr(""); };
  const login = async () => {
    if (!email || !pass) { setErr("Бүх талбарыг бөглөнө үү."); return; }
    setLoad(true); setErr("");
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch (e) { setErr(e.code === "auth/invalid-credential" ? "Имэйл эсвэл нууц үг буруу." : "Нэвтрэхэд алдаа гарлаа."); }
    setLoad(false);
  };
  const register = async () => {
    if (!name || !email || !pass) { setErr("Бүх талбарыг бөглөнө үү."); return; }
    if (pass.length < 6) { setErr("Нууц үг 6+ тэмдэгт байх ёстой."); return; }
    setLoad(true); setErr("");
    try {
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(c.user, { displayName: name });
      await setDoc(doc(db, "users", c.user.uid), {
        name, email, totalPrize: 0, gamesPlayed: 0, bestPrize: 0,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e.code === "auth/email-already-in-use" ? "Энэ имэйл бүртгэлтэй байна." : "Бүртгэлд алдаа гарлаа.");
    }
    setLoad(false);
  };
  return (
    <div style={{ background: "var(--bg)" }}>
      <style>{styles}</style>
      <div className="auth-bg">
        <div className="auth-box">
          <div className="auth-logo">
            <span className="auth-logo-main">САЯТАН</span>
            <span className="auth-logo-sub">Нэг сая төгрөгийн тоглоом</span>
          </div>
          <div className="auth-tabs">
            <button className={"auth-tab"+(tab==="login"?" on":"")} onClick={()=>reset("login")}>Нэвтрэх</button>
            <button className={"auth-tab"+(tab==="register"?" on":"")} onClick={()=>reset("register")}>Бүртгүүлэх</button>
          </div>
          {err && <div className="err">{err}</div>}
          {tab==="register" && <div className="fg"><label>Нэр</label><input type="text" placeholder="Таны нэр" value={name} onChange={e=>setName(e.target.value)}/></div>}
          <div className="fg"><label>Имэйл</label><input type="email" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="fg"><label>Нууц үг</label><input type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(tab==="login"?login():register())}/></div>
          <button className="btn-gold" disabled={load} onClick={tab==="login"?login:register}>
            {load ? "Түр хүлээнэ үү..." : (tab==="login" ? "Тоглоомд нэвтрэх →" : "Бүртгүүлэх →")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NAVBAR ────────────────────────────────────────────────────
function Navbar({ user, profile, isAdmin, view, setView }) {
  return (
    <nav className="navbar">
      <div className="nav-logo" onClick={()=>setView("home")}>САЯТАН</div>
      <div className="nav-tabs">
        <button className={"nav-tab"+(view==="home"?" on":"")} onClick={()=>setView("home")}>🏠 Нүүр</button>
        <button className={"nav-tab"+(view==="rank"?" on":"")} onClick={()=>setView("rank")}>🏆 Ранк</button>
        <button className={"nav-tab"+(view==="profile"?" on":"")} onClick={()=>setView("profile")}>👤 Профайл</button>
        {isAdmin && (
          <button className={"nav-tab admin-tab"+(view==="admin"?" on":"")} onClick={()=>setView("admin")}>⚙️ Админ</button>
        )}
      </div>
      <div className="nav-right">
        <span className="nav-stat">💰 {(profile?.bestPrize||0).toLocaleString()}₮</span>
        <span className="nav-user">{user.displayName}</span>
        <button className="nav-btn" onClick={()=>signOut(auth)}>Гарах</button>
      </div>
    </nav>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomeView({ profile, onStart }) {
  return (
    <div className="home-wrap">
      <div className="home-hero">
        <div className="home-title"><span className="g">НЭГ САЯ</span><br/>ТӨГРӨГ</div>
        <div className="home-sub">15 асуулт зөв хариулж нэг сая төгрөгийн шагнал авах боломжтой. 3 тусламж ашиглаж болно.</div>
        <div className="profile-card">
          <div className="pstat"><span className="pstat-num">{profile?.gamesPlayed||0}</span><span className="pstat-label">Тоглолт</span></div>
          <div className="pstat"><span className="pstat-num" style={{color:"var(--gold)"}}>{(profile?.bestPrize||0).toLocaleString()}₮</span><span className="pstat-label">Шилдэг</span></div>
          <div className="pstat"><span className="pstat-num" style={{color:"var(--cyan)"}}>{(profile?.totalPrize||0).toLocaleString()}₮</span><span className="pstat-label">Нийт</span></div>
        </div>
      </div>
      <div className="ladder-preview" style={{maxWidth:480,margin:"0 auto 28px"}}>
        <div className="ladder-preview-title">💰 Мөнгөний шат</div>
        <div className="ladder-mini">
          {[...MONEY_LADDER].reverse().map(l=>(
            <div key={l.level} className={"ladder-mini-item"+(l.safe?" safe":"")}>
              <span className="lv">{l.level}</span>
              <span className="am">{l.safe?"🛡 ":""}{fmt(l.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{textAlign:"center"}}>
        <button className="btn-gold" style={{maxWidth:280,margin:"0 auto"}} onClick={onStart}>🎮 Тоглоом эхлүүлэх</button>
      </div>
    </div>
  );
}

// ── GAME ──────────────────────────────────────────────────────
function GameView({ user, onEnd, allQuestions }) {
  const questions  = useRef(getQuestionSet(allQuestions.length >= 15 ? allQuestions : DEFAULT_QUESTIONS));
  const [level, setLevel]           = useState(0);
  const [selected, setSelected]     = useState(null);
  const [answered, setAnswered]     = useState(false);
  const [timeLeft, setTimeLeft]     = useState(30);
  const [lifelines, setLifelines]   = useState({ half:false, crowd:false, call:false });
  const [hiddenOpts, setHiddenOpts] = useState([]);
  const [crowdData, setCrowdData]   = useState(null);
  const [callData, setCallData]     = useState(null);
  const [walkModal, setWalkModal]   = useState(false);
  const timerRef  = useRef(null);
  const endedRef  = useRef(false); // prevent double-fire

  const q         = questions.current[level];
  const ladder    = MONEY_LADDER[level];
  const timeLimit = TIME_LIMITS[DIFF_BY_LEVEL(level+1)];

  const safePrize = useCallback(() => {
    for (let i = level-1; i >= 0; i--) {
      if (MONEY_LADDER[i].safe) return MONEY_LADDER[i].amount;
    }
    return 0;
  }, [level]);

  // Reset per question
  useEffect(() => {
    setTimeLeft(timeLimit);
    setSelected(null);
    setAnswered(false);
    setHiddenOpts([]);
    setCrowdData(null);
    setCallData(null);
    endedRef.current = false;
  }, [level, timeLimit]);

  // Timer — only one interval active at a time
  useEffect(() => {
    if (answered) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [level, answered]); // eslint-disable-line

  const handleAnswer = sel => {
    if (answered || endedRef.current) return;
    clearInterval(timerRef.current);
    setSelected(sel);
    setAnswered(true);
    const correct = sel === q.a;
    setTimeout(() => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (correct) {
        if (level === 14) onEnd(1000000, "win", 15, 15);
        else setLevel(l => l + 1);
      } else {
        onEnd(safePrize(), "lose", level, level);
      }
    }, 900);
  };

  const use5050 = () => {
    if (lifelines.half) return;
    setLifelines(l => ({ ...l, half:true }));
    const wrong = [0,1,2,3].filter(i => i !== q.a);
    setHiddenOpts(shuffle(wrong).slice(0,2));
  };

  const useCrowd = () => {
    if (lifelines.crowd) return;
    setLifelines(l => ({ ...l, crowd:true }));
    const pcts = [0,0,0,0];
    pcts[q.a] = Math.floor(Math.random()*30)+55;
    let rem = 100 - pcts[q.a];
    const others = [0,1,2,3].filter(i => i !== q.a);
    others.forEach((i,idx) => {
      if (idx === others.length-1) { pcts[i] = rem; }
      else { const p = Math.floor(Math.random()*rem*.6); pcts[i] = p; rem -= p; }
    });
    setCrowdData(pcts);
  };

  const useCall = () => {
    if (lifelines.call) return;
    setLifelines(l => ({ ...l, call:true }));
    const conf = Math.random();
    const right = q.opts[q.a];
    let msg;
    if (conf > 0.7) msg = `Би найдтайгаар "${right}" гэж хэлж байна. Магадлал 90% орчим.`;
    else if (conf > 0.4) msg = `Боддоход "${right}" юм шиг санагдаж байна. 60-70% итгэлтэй.`;
    else msg = `Хэцүү байна... "${q.opts[Math.floor(Math.random()*4)]}" эсвэл "${right}" байж магадгүй.`;
    setCallData(msg);
  };

  const timerPct   = timeLeft / timeLimit * 100;
  const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "var(--mm-gold)" : "var(--mm-cyan)";

  return (
    <div className="mm-game">
      {/* ── CENTER MAIN ── */}
      <div className="mm-main">
        {/* Top bar */}
        <div className="mm-topbar">
          <span className="mm-logo">САЯТАН</span>
          <span className="mm-prize-display">{fmt(ladder.amount)}</span>
          <span className="mm-level-tag">{level+1} / 15</span>
        </div>

        {/* Timer */}
        <div className="mm-timer-wrap">
          <div className="mm-timer-track">
            <div className="mm-timer-fill" style={{width:timerPct+"%",background:timerColor}}/>
          </div>
          <span className={"mm-timer-num"+(timeLeft<=5?" danger":"")} style={{color:timerColor}}>{timeLeft}</span>
        </div>

        {/* Question */}
        <div className="mm-qbox-wrap">
          <div className="mm-qbox">
            <div className="mm-qnum">АСУУЛТ {level+1} &nbsp;·&nbsp; {DIFF_LABEL[DIFF_BY_LEVEL(level+1)]}</div>
            <div className="mm-qtext">{q.q}</div>
          </div>
        </div>

        {/* Crowd hint */}
        {crowdData && (
          <div className="mm-hint-box">
            <div className="mm-hint-label">👥 Залын санал</div>
            <div className="crowd-bars">
              {q.opts.map((_,i) => (
                <div key={i} className="crowd-bar-wrap">
                  <div className="crowd-pct">{crowdData[i]}%</div>
                  <div className="crowd-bar" style={{height:(crowdData[i]/100*56)+"px",background:crowdData[i]===Math.max(...crowdData)?"linear-gradient(to top,#92650a,#ffd700)":"rgba(50,100,180,.4)"}}/>
                  <div className="crowd-opt">{String.fromCharCode(65+i)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call hint */}
        {callData && (
          <div className="mm-hint-box">
            <div className="mm-hint-label">📞 Найзын хариулт</div>
            <div className="call-bubble">"{callData}"</div>
          </div>
        )}

        {/* Lifelines */}
        <div className="mm-lifelines">
          {[
            ["half","⚡","50:50",use5050],
            ["call","📞","Найз",useCall],
            ["crowd","👥","Зал",useCrowd],
          ].map(([key,icon,lbl,fn]) => (
            <button key={key} className={"mm-ll-btn"+(lifelines[key]?" used":"")} disabled={lifelines[key]||answered} onClick={fn}>
              <span className="ll-icon">{icon}</span>{lbl}
            </button>
          ))}
        </div>

        {/* Answer options */}
        <div className="mm-opts">
          {q.opts.map((opt,i) => {
            let cls = "mm-opt";
            if (hiddenOpts.includes(i)) cls += " hidden";
            if (answered) {
              if (i === q.a) cls += " correct";
              else if (i === selected && selected !== q.a) cls += " wrong";
            }
            return (
              <button key={i} className={cls} disabled={answered||hiddenOpts.includes(i)} onClick={()=>handleAnswer(i)}>
                <span className="mm-opt-letter">{String.fromCharCode(65+i)}:</span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* Walk away */}
        {level > 0 && !answered && (
          <button className="mm-walk-btn" onClick={()=>setWalkModal(true)}>
            🚶 {fmt(safePrize()>0?safePrize():0)} мөнгөтэй явах
          </button>
        )}
      </div>

      {/* ── MONEY LADDER (right/bottom) ── */}
      <div className="mm-ladder">
        {[...MONEY_LADDER].reverse().map((l,i) => {
          const ri = 14-i;
          return (
            <div key={l.level} className={"mm-rung"+(ri===level?" current":"")+(ri<level?" passed":"")+(l.safe?" safe-rung":"")}>
              <span className="rung-num">{l.level}</span>
              <span className="rung-dot"/>
              <span className="rung-amt">{l.safe?"🛡 ":""}{fmt(l.amount)}</span>
            </div>
          );
        })}
      </div>

      {/* Walk away modal */}
      {walkModal && (
        <div className="modal-bg" onClick={()=>setWalkModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">🚶 Явах уу?</div>
            <div className="modal-sub">
              Та одоо <strong style={{color:"var(--gold)"}}>{fmt(safePrize())}</strong> мөнгөтэй явж болно.
              Буруу хариулбал <strong style={{color:"var(--red)"}}>{fmt(safePrize())}-д буцна</strong>.
            </div>
            <div className="modal-btns">
              <button className="btn-modal-cancel" onClick={()=>setWalkModal(false)}>Тоглох</button>
              <button className="btn-gold" style={{flex:1,marginTop:0}} onClick={()=>{endedRef.current=true;onEnd(safePrize(),"walk",level,level);}}>
                {fmt(safePrize())} авч явах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESULT ────────────────────────────────────────────────────
function ResultView({ prize, reason, correctCount, totalCount, onPlay, onRank }) {
  const isWin  = reason === "win";
  const isWalk = reason === "walk";
  const emoji  = isWin ? "🏆" : isWalk ? "🚶" : prize > 0 ? "💰" : "😔";
  const title  = isWin ? "АВАРГА БОЛОВ!" : isWalk ? "Ухаалгаар явлаа" : prize > 0 ? "Оноотой буцлаа" : "Алдаа гаргав...";
  return (
    <div className="result-bg">
      <style>{styles}</style>
      <div className="result-box">
        <span className="result-emoji">{emoji}</span>
        <div className="result-title">{title}</div>
        <div className="result-amount">{fmt(prize)}</div>
        <div className="result-sub">{isWin?"Та бүх 15 асуултыг зөв хариуллаа!":isWalk?"Та аюулгүйгээр буцлаа.":"Тоглолтын дүн"}</div>
        <div className="result-stats">
          <div className="rstat">
            <span className="rstat-num" style={{color:"var(--gold)"}}>{fmt(prize)}</span>
            <span className="rstat-label">Авсан мөнгө</span>
          </div>
          <div className="rstat">
            <span className="rstat-num" style={{color:"var(--green)"}}>{correctCount}</span>
            <span className="rstat-label">Зөв хариулт</span>
          </div>
          <div className="rstat">
            <span className="rstat-num" style={{color:"var(--cyan)"}}>{totalCount}</span>
            <span className="rstat-label">Нийт асуулт</span>
          </div>
        </div>
        <div className="result-btns">
          <button className="btn-gold" onClick={onPlay}>🎮 Дахин тоглох</button>
          <button className="btn-outline-gold" onClick={onRank}>🏆 Ранк</button>
        </div>
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────
function LeaderboardView({ currentUid }) {
  const [leaders, setLeaders] = useState([]);
  const [load, setLoad]       = useState(true);
  useEffect(() => {
    const q = query(collection(db,"users"), orderBy("bestPrize","desc"), limit(50));
    const unsub = onSnapshot(q, snap => { setLeaders(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoad(false); });
    return unsub;
  }, []);
  if (load) return <><style>{styles}</style><div className="loading"><div className="spin"/></div></>;
  return (
    <div className="lb-wrap">
      <div className="lb-header">
        <div className="lb-title">🏆 Шилдэг Тоглогчид</div>
        <div className="lb-sub">Хамгийн их мөнгө авсан тоглогчдын ранк</div>
      </div>
      {leaders.length === 0
        ? <div className="lb-empty">Тоглогч байхгүй. Эхний тоглогч болоорой!</div>
        : <div className="lb-list">
            {leaders.map((u,i) => (
              <div key={u.id} className={"lb-item"+(u.id===currentUid?" me":"")+(i===0?" top1":"")} style={{animationDelay:i*.04+"s"}}>
                <div className="lb-rank">{i<3?MEDALS[i]:"#"+(i+1)}</div>
                <div className="lb-avatar" style={{background:`linear-gradient(135deg,hsl(${(u.name?.charCodeAt(0)||65)*5%360},60%,35%),hsl(${(u.name?.charCodeAt(0)||65)*7%360},60%,55%))`}}>
                  {(u.name||"T")[0].toUpperCase()}
                </div>
                <div className="lb-info">
                  <div className="lb-name">{u.name||"Тоглогч"}{u.id===currentUid&&<span className="me-tag">Та</span>}</div>
                  <div className="lb-detail">{u.gamesPlayed||0} тоглолт</div>
                </div>
                <div className="lb-prize">
                  <span className="lb-prize-num">{fmt(u.bestPrize||0)}</span>
                  <span className="lb-prize-label">шилдэг</span>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── PROFILE VIEW ──────────────────────────────────────────────
function ProfileView({ user, profile }) {
  const hue = (user.displayName?.charCodeAt(0)||65)*5%360;
  return (
    <div className="profile-wrap">
      <div className="profile-card-big">
        <div className="profile-avatar" style={{background:`linear-gradient(135deg,hsl(${hue},60%,30%),hsl(${hue+20},60%,50%))`}}>
          {(user.displayName||"T")[0].toUpperCase()}
        </div>
        <div className="profile-name">{user.displayName||"Тоглогч"}</div>
        <div className="profile-email">{user.email}</div>
        <div className="profile-stats-grid">
          <div className="ps-item"><span className="ps-num">{profile?.gamesPlayed||0}</span><span className="ps-label">Тоглолт</span></div>
          <div className="ps-item"><span className="ps-num" style={{color:"var(--gold)"}}>{fmt(profile?.bestPrize||0)}</span><span className="ps-label">Шилдэг</span></div>
          <div className="ps-item"><span className="ps-num" style={{color:"var(--cyan)"}}>{fmt(profile?.totalPrize||0)}</span><span className="ps-label">Нийт</span></div>
        </div>
      </div>
      <div style={{textAlign:"center"}}>
        <button className="nav-btn" style={{padding:"10px 24px",fontSize:13}} onClick={()=>signOut(auth)}>Гарах</button>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────
function AdminPanel({ addToast }) {
  const [tab, setTab]             = useState("list");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterCat, setFilterCat]   = useState("all");
  const [userCount, setUserCount]   = useState(0);
  const [editQ, setEditQ]           = useState(null);

  // form state
  const blankForm = { q:"", opts:["","","",""], a:0, diff:1, cat:"Ерөнхий" };
  const [form, setForm] = useState(blankForm);

  // json import
  const [jsonText, setJsonText]     = useState("");
  const [jsonError, setJsonError]   = useState("");
  const [importing, setImporting]   = useState(false);

  const CATEGORIES = ["Ерөнхий","Газарзүй","Түүх","Шинжлэх ухаан","Математик","Технологи","Спорт","Урлаг","Соёл","Хүүхдийн"];

  // Load questions realtime
  useEffect(() => {
    const q = query(collection(db,"questions"), orderBy("createdAt","desc"));
    const unsub = onSnapshot(q, snap => {
      setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Load user count
  useEffect(() => {
    getDocs(collection(db,"users")).then(s => setUserCount(s.size)).catch(()=>{});
  }, []);

  // Filtered questions
  const filtered = questions.filter(q => {
    const matchSearch = q.q?.toLowerCase().includes(search.toLowerCase());
    const matchDiff   = filterDiff === "all" || String(q.diff) === filterDiff;
    const matchCat    = filterCat  === "all" || q.cat === filterCat;
    return matchSearch && matchDiff && matchCat;
  });

  const cats = [...new Set(questions.map(q => q.cat).filter(Boolean))];

  // Save single question
  const saveQuestion = async () => {
    if (!form.q.trim()) { addToast("Асуулт оруулна уу", "error"); return; }
    if (form.opts.some(o => !o.trim())) { addToast("Бүх хариултыг бөглөнө үү", "error"); return; }
    try {
      if (editQ) {
        await updateDoc(doc(db,"questions",editQ), { ...form, updatedAt: new Date().toISOString() });
        addToast("Асуулт шинэчлэгдлээ");
      } else {
        await addDoc(collection(db,"questions"), { ...form, createdAt: new Date().toISOString() });
        addToast("Асуулт нэмэгдлээ");
      }
      setForm(blankForm);
      setEditQ(null);
      setTab("list");
    } catch (e) {
      addToast("Алдаа: "+e.message, "error");
    }
  };

  const startEdit = q => {
    setForm({ q:q.q, opts:[...q.opts], a:q.a, diff:q.diff||1, cat:q.cat||"Ерөнхий" });
    setEditQ(q.id);
    setTab("add");
  };

  const deleteQuestion = async id => {
    if (!window.confirm("Энэ асуултыг устгах уу?")) return;
    try {
      await deleteDoc(doc(db,"questions",id));
      addToast("Устгагдлаа");
    } catch(e) { addToast("Алдаа: "+e.message,"error"); }
  };

  // JSON import
  const importJSON = async () => {
    setJsonError(""); setImporting(true);
    try {
      const parsed = JSON.parse(jsonText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;
      for (const item of arr) {
        if (!item.q || !Array.isArray(item.opts) || item.opts.length !== 4 || item.a === undefined) {
          throw new Error(`Буруу формат: "${JSON.stringify(item).slice(0,60)}..."`);
        }
        await addDoc(collection(db,"questions"), {
          q:    String(item.q),
          opts: item.opts.map(String),
          a:    Number(item.a),
          diff: Number(item.diff)||1,
          cat:  item.cat||"Ерөнхий",
          createdAt: new Date().toISOString(),
        });
        count++;
      }
      addToast(`${count} асуулт нэмэгдлээ`);
      setJsonText("");
      setTab("list");
    } catch(e) {
      setJsonError(e.message);
      addToast("Import алдаа", "error");
    }
    setImporting(false);
  };

  const seedDefaults = async () => {
    if (!window.confirm(`${DEFAULT_QUESTIONS.length} анхдагч асуулт нэмэх үү?`)) return;
    try {
      for (const q of DEFAULT_QUESTIONS) {
        await addDoc(collection(db,"questions"), { ...q, createdAt: new Date().toISOString() });
      }
      addToast(`${DEFAULT_QUESTIONS.length} асуулт нэмэгдлээ`);
    } catch(e) { addToast("Алдаа: "+e.message,"error"); }
  };

  const diffCounts = [1,2,3].map(d => questions.filter(q=>q.diff===d).length);

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div className="admin-title">⚙️ <span>Админ Панел</span></div>
        <div style={{fontSize:13,color:"var(--txt3)"}}>Асуулт удирдах, статистик харах</div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="astat"><span className="astat-num">{questions.length}</span><span className="astat-label">Нийт асуулт</span></div>
        <div className="astat"><span className="astat-num" style={{color:"var(--green)"}}>{diffCounts[0]}</span><span className="astat-label">Хялбар</span></div>
        <div className="astat"><span className="astat-num" style={{color:"var(--gold)"}}>{diffCounts[1]}</span><span className="astat-label">Дунд</span></div>
        <div className="astat"><span className="astat-num" style={{color:"var(--red)"}}>{diffCounts[2]}</span><span className="astat-label">Хэцүү</span></div>
        <div className="astat"><span className="astat-num" style={{color:"var(--cyan)"}}>{userCount}</span><span className="astat-label">Хэрэглэгч</span></div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[["list","📋 Жагсаалт"],["add",editQ?"✏️ Засах":"➕ Нэмэх"],["json","📥 JSON Import"]].map(([k,l]) => (
          <button key={k} className={"admin-tab"+(tab===k?" on":"")} onClick={()=>{setTab(k);if(k!=="add"){setEditQ(null);setForm(blankForm);}}}>{l}</button>
        ))}
      </div>

      {/* ── LIST TAB ── */}
      {tab==="list" && (
        <>
          <div className="q-toolbar">
            <input className="q-search" placeholder="🔍 Асуулт хайх..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select className="q-filter" value={filterDiff} onChange={e=>setFilterDiff(e.target.value)}>
              <option value="all">Бүх хэцүүлэг</option>
              <option value="1">Хялбар</option>
              <option value="2">Дунд</option>
              <option value="3">Хэцүү</option>
            </select>
            <select className="q-filter" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">Бүх ангилал</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="q-count">{filtered.length} / {questions.length}</span>
            {questions.length === 0 && (
              <button className="btn-icon" onClick={seedDefaults} style={{color:"var(--purple2)",borderColor:"rgba(124,58,237,.4)"}}>
                🌱 Анхдагч асуулт нэмэх
              </button>
            )}
          </div>

          {loading ? <div className="loading" style={{height:200}}><div className="spin"/></div> : (
            <div className="q-table-wrap">
              <table className="q-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Асуулт</th>
                    <th>Ангилал</th>
                    <th>Хэцүүлэг</th>
                    <th>Хариулт</th>
                    <th>Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{textAlign:"center",padding:"40px",color:"var(--txt3)"}}>Асуулт олдсонгүй</td></tr>
                  ) : filtered.map((q,i) => (
                    <tr key={q.id}>
                      <td style={{color:"var(--txt3)",fontFamily:"'JetBrains Mono'",fontSize:11}}>{i+1}</td>
                      <td className="q-text-cell">{q.q}</td>
                      <td><span className="cat-pill">{q.cat||"—"}</span></td>
                      <td><span className={`diff-pill d${q.diff||1}`}>{DIFF_LABEL[q.diff||1]}</span></td>
                      <td style={{color:"var(--green)",fontSize:12,fontWeight:600}}>{q.opts?.[q.a]||"—"}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon edit" onClick={()=>startEdit(q)}>✏️</button>
                          <button className="btn-icon del" onClick={()=>deleteQuestion(q.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ADD / EDIT TAB ── */}
      {tab==="add" && (
        <div className="add-form">
          <div className="add-form-title">{editQ?"✏️ Асуулт засах":"➕ Шинэ асуулт нэмэх"}</div>

          <div className="fg">
            <label>Асуулт</label>
            <textarea value={form.q} onChange={e=>setForm(f=>({...f,q:e.target.value}))} placeholder="Асуулт энд бичнэ үү..."/>
          </div>

          <div className="form-row four">
            {[0,1,2,3].map(i => (
              <div className="fg" key={i}>
                <label>Хариулт {String.fromCharCode(65+i)}</label>
                <input value={form.opts[i]} onChange={e=>{const o=[...form.opts];o[i]=e.target.value;setForm(f=>({...f,opts:o}));}} placeholder={`Хариулт ${String.fromCharCode(65+i)}`}/>
              </div>
            ))}
          </div>

          <div className="fg">
            <label>Зөв хариулт</label>
            <div className="correct-radio">
              {[0,1,2,3].map(i => (
                <div key={i} className={"radio-opt"+(form.a===i?" selected":"")} onClick={()=>setForm(f=>({...f,a:i}))}>
                  <span className="radio-dot"/>
                  {String.fromCharCode(65+i)}: {form.opts[i]||"(хоосон)"}
                </div>
              ))}
            </div>
          </div>

          <div className="form-row two">
            <div className="fg">
              <label>Хэцүүлэг</label>
              <select value={form.diff} onChange={e=>setForm(f=>({...f,diff:Number(e.target.value)}))}>
                <option value={1}>1 — Хялбар</option>
                <option value={2}>2 — Дунд</option>
                <option value={3}>3 — Хэцүү</option>
              </select>
            </div>
            <div className="fg">
              <label>Ангилал</label>
              <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-gold" onClick={saveQuestion} style={{flex:1}}>
              {editQ ? "✅ Хадгалах" : "➕ Нэмэх"}
            </button>
            <button className="btn-modal-cancel" onClick={()=>{setEditQ(null);setForm(blankForm);setTab("list");}}>Болих</button>
          </div>
        </div>
      )}

      {/* ── JSON IMPORT TAB ── */}
      {tab==="json" && (
        <div className="json-import">
          <div className="json-import-title">📥 JSON форматаар асуулт оруулах</div>
          <div style={{fontSize:13,color:"var(--txt3)",marginBottom:12,lineHeight:1.6}}>
            Доорх форматаар JSON бичиж массив хэлбэрээр олон асуулт нэг дор оруулж болно.
            <br/><code style={{color:"var(--purple2)"}}>diff</code>: 1=Хялбар, 2=Дунд, 3=Хэцүү &nbsp;|&nbsp;
            <code style={{color:"var(--purple2)"}}>a</code>: зөв хариултын индекс (0-3)
          </div>
          <div className="json-example">{`[
  {
    "q": "Монгол улсын нийслэл хот аль вэ?",
    "opts": ["Дархан", "Эрдэнэт", "Улаанбаатар", "Чойбалсан"],
    "a": 2,
    "diff": 1,
    "cat": "Газарзүй"
  },
  {
    "q": "Дараагийн асуулт...",
    "opts": ["А", "Б", "В", "Г"],
    "a": 0,
    "diff": 2,
    "cat": "Түүх"
  }
]`}</div>
          {jsonError && <div className="err">{jsonError}</div>}
          <textarea className="json-textarea" value={jsonText} onChange={e=>{setJsonText(e.target.value);setJsonError("");}} placeholder="JSON массивыг энд буулгана уу..."/>
          <div className="form-actions" style={{marginTop:12}}>
            <button className="btn-gold" onClick={importJSON} disabled={!jsonText.trim()||importing} style={{flex:1}}>
              {importing?"Оруулж байна...":"📥 Import хийх"}
            </button>
            <button className="btn-modal-cancel" onClick={()=>{setJsonText("");setJsonError("");}}>Цэвэрлэх</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(undefined);
  const [profile, setProfile]   = useState(null);
  const [view, setView]         = useState("home");
  const [gameResult, setGameResult] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const { toasts, addToast }    = useToast();

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u || null);
      if (u) {
        try {
          const s = await getDoc(doc(db,"users",u.uid));
          if (s.exists()) setProfile(s.data());
        } catch {}
      } else {
        setProfile(null);
      }
    });
  }, []);

  // Profile realtime sync
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db,"users",user.uid), s => { if(s.exists()) setProfile(s.data()); });
    return unsub;
  }, [user]);

  // Load questions from Firestore
  useEffect(() => {
    const q = query(collection(db,"questions"), orderBy("diff"));
    const unsub = onSnapshot(q, snap => {
      setAllQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, () => {});
    return unsub;
  }, []);

  const handleEnd = async (prize, reason, correctCount, totalCount) => {
    setGameResult({ prize, reason, correctCount, totalCount });
    setView("result");
    if (user) {
      try {
        const ref  = doc(db,"users",user.uid);
        const snap = await getDoc(ref);
        const cur  = snap.data() || {};
        await updateDoc(ref, {
          totalPrize:  (cur.totalPrize||0) + prize,
          gamesPlayed: (cur.gamesPlayed||0) + 1,
          bestPrize:   Math.max(cur.bestPrize||0, prize),
          lastPlayedAt: new Date().toISOString(),
        });
      } catch(e) {
        addToast("Оноо хадгалахад алдаа гарлаа", "error");
      }
    }
  };

  if (user === undefined) return (
    <><style>{styles}</style>
      <div className="loading">
        <div className="loading-logo">САЯТАН</div>
        <div className="loading-bar"/>
      </div>
    </>
  );
  if (!user) return <><style>{styles}</style><AuthScreen/></>;

  return (
    <>
      <style>{styles}</style>
      <ToastContainer toasts={toasts}/>
      {view!=="game"&&view!=="result" && (
        <Navbar user={user} profile={profile} isAdmin={isAdmin} view={view} setView={setView}/>
      )}
      {view==="home"    && <HomeView profile={profile} onStart={()=>setView("game")}/>}
      {view==="game"    && <GameView user={user} onEnd={handleEnd} allQuestions={allQuestions}/>}
      {view==="result"  && gameResult && (
        <ResultView
          prize={gameResult.prize} reason={gameResult.reason}
          correctCount={gameResult.correctCount} totalCount={gameResult.totalCount}
          onPlay={()=>setView("game")} onRank={()=>setView("rank")}
        />
      )}
      {view==="rank"    && <LeaderboardView currentUid={user.uid}/>}
      {view==="profile" && <ProfileView user={user} profile={profile}/>}
      {view==="admin"   && isAdmin && <AdminPanel addToast={addToast}/>}
    </>
  );
}
