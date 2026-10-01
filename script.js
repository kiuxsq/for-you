/* ═══════════════════════════════════════════════════════
   MEDINA — LITTLE UNIVERSE · script.js · v2 AURORA EDITION
   ═══════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ───────────────────────── utils ───────────────────────── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const rand = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const TAU = Math.PI*2;
const lerp = (a,b,t) => a+(b-a)*t;
const easeOutCubic = t => 1-Math.pow(1-t,3);
const easeInOutCubic = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const easeOutBack = t => { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
const isTouch = matchMedia('(hover:none)').matches;
const DPR = () => Math.min(devicePixelRatio||1, state.lite?1.5:2);
function vib(ms){ if (navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} }

/* tween engine */
const tweens = new Set();
function tween(dur, onUpdate, opts={}){
  const tw = { t0: performance.now()/1000 + (opts.delay||0), dur, onUpdate,
               ease: opts.ease||easeOutCubic, done: opts.onComplete, dead:false };
  tweens.add(tw); return tw;
}
function updateTweens(now){
  for (const tw of tweens){
    if (tw.dead){ tweens.delete(tw); continue; }
    let t = (now - tw.t0)/tw.dur;
    if (t < 0) continue;
    if (t >= 1) t = 1;
    tw.onUpdate(tw.ease(t));
    if (t === 1){ tweens.delete(tw); tw.done && tw.done(); }
  }
}

/* toast */
const toastEl = $('#toast'); let toastTimer=null;
function toast(html, sticky=false){
  toastEl.innerHTML = html; toastEl.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 3600);
}
function hideToast(){ toastEl.classList.remove('show'); }

/* screen flash */
const flashEl = $('#flash');
function flash(p=0.85, dur=0.7){
  tween(dur, e=> flashEl.style.opacity = p*(1-e));
}

/* ripple */
const rippleLayer = $('#ripple-layer');
function ripple(x, y, big=false){
  const el = document.createElement('div'); el.className='ripple';
  const s0 = big?30:10, s1 = big?190:76;
  el.style.left=x+'px'; el.style.top=y+'px'; el.style.width=el.style.height=s0+'px';
  rippleLayer.appendChild(el);
  tween(big?1:0.6, e=>{ const s=lerp(s0,s1,e); el.style.width=el.style.height=s+'px';
    el.style.opacity=1-e; }, {onComplete:()=>el.remove()});
}

/* split text into 3D chars */
function splitTitle(el){
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const txt = el.textContent; el.textContent='';
  el.classList.add('gtx');
  [...txt].forEach((ch,i)=>{
    const s=document.createElement('span'); s.className='ch';
    s.textContent = ch===' ' ? '\u00A0' : ch;
    s.style.transitionDelay = (i*0.07)+'s';
    el.appendChild(s);
  });
}

/* ───────────────────────── sound ───────────────────────── */
const Sound = {
  ctx:null, master:null, on:false,
  ensure(){
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    const c=this.ctx, g=c.createGain(); g.gain.value=.5;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=430; lp.Q.value=.6;
    [[55,.5],[82.41,.3],[110,.38],[164.81,.13],[220,.09],[277.18,.05]].forEach(([f,v])=>{
      const o=c.createOscillator(); o.type='sine'; o.frequency.value=f;
      const og=c.createGain(); og.gain.value=v; o.connect(og); og.connect(g); o.start();
    });
    const lfo=c.createOscillator(); lfo.frequency.value=.07;
    const lg=c.createGain(); lg.gain.value=.16; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    g.connect(lp); lp.connect(this.master);
    return true;
  },
  toggle(){
    if (!this.ensure()){ toast('Звук не поддерживается в этом браузере'); return false; }
    this.on = !this.on;
    if (this.ctx.state==='suspended') this.ctx.resume();
    const t=this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(this.on?0.15:0.0001, t+1.2);
    return this.on;
  },
  chime(f=880, v=.11){
    if (!this.on || !this.ctx) return;
    const c=this.ctx, t=c.currentTime;
    const o=c.createOscillator(), g=c.createGain();
    o.type='sine'; o.frequency.setValueAtTime(f,t);
    o.frequency.exponentialRampToValueAtTime(f*.5, t+1.3);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+1.5);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+1.6);
  },
  whoosh(){
    if (!this.on || !this.ctx) return;
    const c=this.ctx, t=c.currentTime;
    const len=c.sampleRate*.7, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=c.createBufferSource(); src.buffer=buf;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.2;
    bp.frequency.setValueAtTime(300,t); bp.frequency.exponentialRampToValueAtTime(2400,t+.5);
    const g=c.createGain(); g.gain.setValueAtTime(.09,t); g.gain.exponentialRampToValueAtTime(.0001,t+.7);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t);
  },
  tick(){ this.chime(1245,.05); }
};

/* ───────────────────────── state ───────────────────────── */
const state = {
  page:'home', busy:false, lite:false, hue:265,
  par:{x:0,y:0,tx:0,ty:0},
  touch:{x:innerWidth/2,y:innerHeight/2,active:false},
  universeOpen:false,
};
function weakDevice(){
  const hc = navigator.hardwareConcurrency||8;
  const dm = navigator.deviceMemory||8;
  return hc <= 4 || dm <= 4;
}

/* ═════════════════════ global bg canvas ═════════════════════ */
const bg = $('#bg-canvas'), bctx = bg.getContext('2d');
let stars=[], dust=[], links=[], sparks=[], shoot=null, shootTimer=4;

function buildBg(){
  const w=innerWidth, h=innerHeight;
  bg.width=w*DPR(); bg.height=h*DPR(); bctx.setTransform(DPR(),0,0,DPR(),0,0);
  stars=[]; dust=[]; links=[]; sparks=[];
  const layers = state.lite ? [70,45,25] : [150,90,50];
  const parF   = [0.012,0.028,0.05];
  layers.forEach((n,li)=>{
    for(let i=0;i<n;i++) stars.push({
      x:Math.random()*w, y:Math.random()*h,
      r:rand(.4, li===2?1.9:1.2), p:rand(0,TAU), sp:rand(.4,1.4),
      f:parF[li], a:rand(.3,.9), big: li===2 && Math.random()<.18
    });
  });
  const dn = state.lite?24:70;
  for(let i=0;i<dn;i++) dust.push({
    x:Math.random()*w, y:Math.random()*h,
    vx:rand(-.08,.08), vy:rand(-.06,.06),
    r:rand(1,2.4), p:rand(0,TAU), a:rand(.2,.6)
  });
}
function spawnBurst(x,y,n=26,big=false){
  for(let i=0;i<n;i++){
    const a=rand(0,TAU), sp=rand(1,big?7:4);
    links.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,r:rand(1,2.6)});
  }
}
function drawStar4(ctx,x,y,r,a){
  ctx.globalAlpha=a; ctx.fillStyle='#efeaff';
  ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill();
  ctx.globalAlpha=a*.55;
  ctx.beginPath();
  ctx.moveTo(x-r*4,y); ctx.lineTo(x+r*4,y);
  ctx.moveTo(x,y-r*4); ctx.lineTo(x,y+r*4);
  ctx.lineWidth=.8; ctx.strokeStyle='#e6dcff'; ctx.stroke();
}
function updateBg(now,dt){
  const w=innerWidth,h=innerHeight;
  bctx.clearRect(0,0,w,h);
  const px=state.par.x, py=state.par.y;
  for(const s of stars){
    const tw = .55+.45*Math.sin(now*s.sp+s.p);
    const sx=s.x+px*s.f*w, sy=s.y+py*s.f*h;
    if(s.big) drawStar4(bctx,sx,sy,s.r,s.a*tw);
    else{
      bctx.globalAlpha=s.a*tw; bctx.fillStyle='#e9e4ff';
      bctx.beginPath(); bctx.arc(sx,sy,s.r,0,TAU); bctx.fill();
    }
  }
  const n1=$('.n1'),n2=$('.n2'),n3=$('.n3');
  n1.style.transform=`translate(${px*-24}px,${py*-18}px)`;
  n2.style.transform=`translate(${px*30}px,${py*22}px)`;
  n3.style.transform=`translate(${px*-14}px,${py*26}px)`;
  if(!state.lite){
    bctx.lineWidth=.6;
    for(let i=0;i<dust.length;i++) for(let j=i+1;j<dust.length;j++){
      const a=dust[i],b=dust[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;
      if(d2<110*110){
        bctx.globalAlpha=(1-Math.sqrt(d2)/110)*.3;
        bctx.strokeStyle=`hsl(${state.hue},80%,75%)`;
        bctx.beginPath();bctx.moveTo(a.x,a.y);bctx.lineTo(b.x,b.y);bctx.stroke();
      }
    }
  }
  for(const d of dust){
    d.x+=d.vx+px*.06; d.y+=d.vy+py*.04;
    if(d.x<-10)d.x=w+10; if(d.x>w+10)d.x=-10;
    if(d.y<-10)d.y=h+10; if(d.y>h+10)d.y=-10;
    if(state.touch.active){
      const dx=d.x-state.touch.x, dy=d.y-state.touch.y, dist=Math.hypot(dx,dy);
      if(dist<90 && dist>1){ d.x+=dx/dist*.7; d.y+=dy/dist*.7; }
    }
    bctx.globalAlpha=d.a*(.6+.4*Math.sin(now+d.p));
    bctx.fillStyle=`hsl(${state.hue},85%,80%)`;
    bctx.beginPath();bctx.arc(d.x,d.y,d.r,0,TAU);bctx.fill();
  }
  for(let i=links.length-1;i>=0;i--){
    const p=links[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=.96; p.vy*=.96; p.life-=dt*.9;
    if(p.life<=0){links.splice(i,1);continue;}
    bctx.globalAlpha=p.life;
    bctx.fillStyle=`hsl(${state.hue+20},90%,82%)`;
    bctx.beginPath();bctx.arc(p.x,p.y,p.r*p.life,0,TAU);bctx.fill();
  }
  bctx.globalAlpha=1;
  shootTimer-=dt;
  if(shootTimer<=0 && state.universeOpen){
    shoot={x:rand(w*.2,w*.9),y:rand(0,h*.35),vx:-rand(5,8),vy:rand(2,3.4),life:1};
    shootTimer = state.lite? rand(14,22) : rand(5,10);
  }
  if(shoot){
    shoot.x+=shoot.vx; shoot.y+=shoot.vy; shoot.life-=dt*.9;
    if(shoot.life<=0) shoot=null;
    else{
      const g=bctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*9,shoot.y-shoot.vy*9);
      g.addColorStop(0,`rgba(240,235,255,${.9*shoot.life})`); g.addColorStop(1,'rgba(139,92,246,0)');
      bctx.strokeStyle=g; bctx.lineWidth=1.6;
      bctx.beginPath();bctx.moveTo(shoot.x,shoot.y);bctx.lineTo(shoot.x-shoot.vx*9,shoot.y-shoot.vy*9);bctx.stroke();
    }
  }
}

/* ═════════════════════ intro sequence ═════════════════════ */
const intro = $('#intro'), iCan = $('#intro-canvas'), ictx = iCan.getContext('2d');
let iStars=[], iRings=[];
function buildIntro(){
  iCan.width=innerWidth*DPR(); iCan.height=innerHeight*DPR();
  ictx.setTransform(DPR(),0,0,DPR(),0,0);
  const n = state.lite?200:480;
  const cx=innerWidth/2, cy=innerHeight/2;
  const maxR=Math.min(innerWidth,innerHeight)*.44;
  iStars=[]; iRings=[];
  for(let i=0;i<n;i++){
    const arm=i%5, t=i/n;
    const ang = t*TAU*3.1 + arm*(TAU/5);
    const r = Math.pow(t,.6)*maxR*rand(.82,1.14);
    iStars.push({
      tx:cx+Math.cos(ang)*r*1.3, ty:cy+Math.sin(ang)*r*.7,
      x:cx+rand(-1,1)*innerWidth*1.2, y:cy+rand(-1,1)*innerHeight*1.2,
      r:rand(.5,2), p:rand(0,TAU), delay:t*1.1, arm
    });
  }
  for(let k=0;k<3;k++) iRings.push({r:maxR*(.3+k*.3), p:rand(0,TAU), sp:rand(.3,.6)*(k%2?1:-1)});
}
let introT=-1, introDone=false, introStart=performance.now()/1000, introZoom=0.55;
function drawIntro(now){
  if(introDone) return;
  const w=innerWidth,h=innerHeight,cx=w/2,cy=h/2;
  ictx.clearRect(0,0,w,h);
  const t = now-introStart;
  introZoom = t<4.2 ? lerp(introZoom, 1, .04) : introZoom;
  ictx.save();
  ictx.translate(cx,cy); ictx.scale(introZoom,introZoom); ictx.translate(-cx,-cy);
  // orbit rings
  for(const rg of iRings){
    rg.p+=rg.sp*.016;
    ictx.globalAlpha=.14;
    ictx.strokeStyle=`hsl(${state.hue},80%,75%)`; ictx.lineWidth=1;
    ictx.beginPath(); ictx.ellipse(cx,cy,rg.r*1.3,rg.r*.7,0,0,TAU); ictx.stroke();
    const px=cx+Math.cos(rg.p)*rg.r*1.3, py=cy+Math.sin(rg.p)*rg.r*.7;
    ictx.globalAlpha=.9;
    ictx.beginPath(); ictx.arc(px,py,2,0,TAU); ictx.fillStyle='#efeaff'; ictx.fill();
  }
  // core star
  const coreR = lerp(2, 7.5, clamp(t/1.4,0,1)) * (1+.12*Math.sin(now*3));
  const cg=ictx.createRadialGradient(cx,cy,0,cx,cy,coreR*8);
  cg.addColorStop(0,'rgba(255,255,255,.95)');
  cg.addColorStop(.22,`hsla(${state.hue},92%,76%,.55)`);
  cg.addColorStop(.5,`hsla(${state.hue+30},85%,60%,.18)`);
  cg.addColorStop(1,'rgba(139,92,246,0)');
  ictx.fillStyle=cg;
  ictx.beginPath();ictx.arc(cx,cy,coreR*8,0,TAU);ictx.fill();
  ictx.fillStyle='#fff';
  ictx.beginPath();ictx.arc(cx,cy,coreR,0,TAU);ictx.fill();
  // spiral arms
  for(const s of iStars){
    const lt = clamp((t-1-s.delay)/2.8,0,1);
    if(lt<=0) continue;
    const e=1-Math.pow(1-lt,4);
    const sx=lerp(s.x,s.tx,e), sy=lerp(s.y,s.ty,e);
    const tw=.5+.5*Math.sin(now*2+s.p);
    ictx.globalAlpha=e*tw*.95;
    ictx.fillStyle=`hsl(${state.hue-14+s.arm*9},${rand(70,92)}%,${rand(74,92)}%)`;
    ictx.beginPath();ictx.arc(sx,sy,s.r,0,TAU);ictx.fill();
  }
  ictx.restore();
  ictx.globalAlpha=1;
}
function typewriter(el, text, cps=26){
  el.textContent=''; let i=0;
  const iv=setInterval(()=>{ el.textContent=text.slice(0,++i);
    if(i>=text.length) clearInterval(iv); }, 1000/cps);
}
function introReveal(){
  if(introT>=0) return;
  introT=0;
  splitTitle($('#intro-title'));
  const ic=$('.intro-content'), k=$('#intro-kicker'), ti=$('#intro-title'), su=$('#intro-sub'), bt=$('#open-universe');
  tween(1.2,e=>{ ic.style.opacity=e; });
  tween(1.4,e=>{ k.style.opacity=e; k.style.transform=`translateY(${(1-e)*14}px)`; },{delay:.2});
  tween(.5,e=> flash(.5*e),{delay:.9, onComplete:()=>flash(0)});
  setTimeout(()=> ti.classList.add('in'), 1000);
  tween(1,e=>{ su.style.opacity=e; },{delay:1.9, onComplete:()=>{
    typewriter($('#typewriter'),'Добро пожаловать в твою маленькую вселенную', 24);
  }});
  tween(1.2,e=>{ bt.style.opacity=e; bt.style.transform=`translateY(${(1-e)*18}px)`; },{delay:3.4});
}
function openUniverse(x,y){
  if(state.busy) return;
  state.busy=true; vib([12,40,22]); Sound.whoosh(); Sound.chime(660,.14);
  for(let i=0;i<(state.lite?60:150);i++) spawnBurst(x,y,1,true);
  flash(.9,.9);
  tween(1.15,e=>{ intro.style.opacity=1-e; intro.style.filter=`blur(${e*18}px)`; intro.style.transform=`scale(${1+e*.1})`; },
    {onComplete:()=>{
      intro.style.display='none'; introDone=true;
      state.universeOpen=true; state.busy=false;
      $('#nav-fab').classList.add('attention');
      enterPage('home');
      setTimeout(()=> toast('Нажми на звезду внизу экрана — она откроет карту вселенной ✦'), 1900);
      startFpsWatch();
    }});
}

/* ═════════════════════ pages manager ═════════════════════ */
const PAGE_META={
  home:['01','THE BEGINNING'], medina:['02','THE CORE'], memories:['03','MEMORY ARCHIVE'],
  constellation:['04','STAR BUILDER'], secret:['05','RESTRICTED AREA'], words:['06','WORD FIELD'],
  sky:['07','NIGHT SKY'], final:['08','FINAL TRANSMISSION'],
};
const BG_WORDS={home:'HELLO',medina:'MEDINA',memories:'MEMORY',constellation:'STARS',secret:'SECRET',words:'WORDS',sky:'SKY',final:'END'};
function pageEl(name){ return $(`#page-${name}`); }
/* inject giant bg words */
Object.keys(BG_WORDS).forEach(name=>{
  const d=document.createElement('div'); d.className='bg-word'; d.textContent=BG_WORDS[name];
  pageEl(name).querySelector('.page-inner').prepend(d);
});
function hudUpdate(){
  const [num,label]=PAGE_META[state.page];
  $('#hud-cur').textContent=num;
  $('#hud-sub').textContent=label;
}
function seqReveal(el, base=0.2, step=0.14){
  const items = el.querySelectorAll('.rv,.line,.f-line,.bp,.sr-line');
  items.forEach((it,i)=> setTimeout(()=> it.classList.add('in'), (base+i*step)*1000));
}
function clearReveals(el){ el.querySelectorAll('.in').forEach(it=> it.classList.remove('in')); }
const overlay=$('#trans-overlay'), sweep=$('#sweep');
function sweepAcross(mid){
  tween(.8,e=>{ sweep.style.opacity=Math.sin(e*Math.PI); sweep.style.left=lerp(-50,120,e)+'%'; },
    {ease:t=>t, onComplete:()=>{ sweep.style.opacity=0; mid&&mid(); }});
}
function goTo(name){
  if(state.busy) return;
  if(name===state.page){ closeMenu(); return; }
  state.busy=true; closeMenu(); vib(8); Sound.whoosh();
  const oldEl=pageEl(state.page), newEl=pageEl(name);
  tween(.5,e=>{ overlay.style.opacity=e*.92;
    oldEl.style.opacity=1-e*.7; oldEl.style.filter=`blur(${e*12}px)`; oldEl.style.transform=`scale(${1-e*.05})`; },
    {onComplete:()=>{
      sweepAcross(()=>{
        oldEl.classList.remove('active');
        ['opacity','filter','transform'].forEach(p=>oldEl.style[p]='');
        clearReveals(oldEl);
        newEl.classList.add('active');
        newEl.style.opacity=0; newEl.style.filter='blur(12px)'; newEl.style.transform='scale(1.05)';
        state.page=name; markNavCurrent(); hudUpdate();
        tween(.75,e=>{ overlay.style.opacity=(1-e)*.92;
          newEl.style.opacity=e; newEl.style.filter=`blur(${(1-e)*12}px)`; newEl.style.transform=`scale(${lerp(1.05,1,e)})`; },
          {onComplete:()=>{ ['opacity','filter','transform'].forEach(p=>newEl.style[p]=''); }});
        enterPage(name);
        setTimeout(()=> state.busy=false, 500);
      });
    }});
}
function enterPage(name){
  const el=pageEl(name);
  switch(name){
    case 'home': seqReveal(el); break;
    case 'medina': seqReveal(el,.15,.12); ensureThree(); break;
    case 'memories': seqReveal(el,.15,.12); layoutMem(); break;
    case 'constellation': resetConstellation(); break;
    case 'secret': seqReveal(el,.15,.14); break;
    case 'words': ensureWords(); seqReveal(el.querySelector('.page-inner'),.1,.1); break;
    case 'sky': resizeSky(); break;
    case 'final': runFinal(); break;
  }
}

/* ═════════════════════ circular nav ═════════════════════ */
const NAV=[
  ['home','HOME','M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z'],
  ['medina','MEDINA','M12 2l2.6 6.9L22 9.3l-5.4 4.8L18.2 22 12 17.9 5.8 22l1.6-7.9L2 9.3l7.4-.4z'],
  ['memories','MEMORY','M12 3l9 5-9 5-9-5z M3 13l9 5 9-5'],
  ['constellation','STARS','M5 17l4-8 5 5 5-9 M5 17h.01 M9 9h.01 M14 14h.01 M19 5h.01'],
  ['secret','SECRET','M7 11V8a5 5 0 0110 0v3 M5 11h14v9H5z M12 15v3'],
  ['words','WORDS','M5 6h14 M5 10h9 M5 14h14 M5 18h7'],
  ['sky','SKY','M20 14A8 8 0 1110 4a6.5 6.5 0 0010 10z'],
  ['final','FINAL','M4 4h16v4H4z M4 12h10 M4 16h7'],
];
const navMenu=$('#nav-menu'), navFab=$('#nav-fab');
NAV.forEach(([id,lbl,d])=>{
  const b=document.createElement('button');
  b.className='nav-item'; b.dataset.target=id;
  b.innerHTML=`<span class="nav-ico"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></span><span class="nav-lbl">${lbl}</span>`;
  b.addEventListener('click',e=>{ e.stopPropagation(); goTo(id); });
  navMenu.appendChild(b);
});
let navArc=null;
function layoutMenu(){
  const items=$$('.nav-item');
  const R=Math.min(innerWidth*.44,180);
  if(!navArc){
    navArc=document.createElementNS('http://www.w3.org/2000/svg','svg');
    navArc.id='nav-arc';
    navMenu.appendChild(navArc);
  }
  navArc.setAttribute('width',R*2+130); navArc.setAttribute('height',R+90);
  navArc.style.left=(-R-65)+'px'; navArc.style.top=(-R-60)+'px';
  const a0=(-160*Math.PI/180), a1=(-20*Math.PI/180);
  const x0=R+65+Math.cos(a0)*R, y0=R+60+Math.sin(a0)*R;
  const x1=R+65+Math.cos(a1)*R, y1=R+60+Math.sin(a1)*R;
  navArc.innerHTML=`<path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}" fill="none" stroke="rgba(196,181,253,.4)" stroke-width="1" stroke-dasharray="3 7"/>`;
  items.forEach((it,i)=>{
    const a=(-160+i*(140/(items.length-1)))*Math.PI/180;
    it.style.left=(Math.cos(a)*R)+'px';
    it.style.top=(Math.sin(a)*R)+'px';
    it.style.transitionDelay=(i*.045)+'s';
  });
}
let menuOpen=false;
function openMenu(){
  menuOpen=true; navMenu.classList.add('open'); navFab.classList.add('open');
  navFab.classList.remove('attention');
  layoutMenu();
  requestAnimationFrame(()=> $$('.nav-item').forEach(it=>{ it.style.opacity=1; it.style.transform='translate(-50%,-50%) scale(1)'; }));
  Sound.tick();
}
function closeMenu(){
  if(!menuOpen) return;
  menuOpen=false; navFab.classList.remove('open');
  $$('.nav-item').forEach(it=>{ it.style.opacity=0; it.style.transform='translate(-50%,-50%) scale(0)'; });
  setTimeout(()=> navMenu.classList.remove('open'), 450);
}
navFab.addEventListener('click',()=>{ vib(6); menuOpen?closeMenu():openMenu(); });
function markNavCurrent(){
  $$('.nav-item').forEach(it=> it.classList.toggle('current', it.dataset.target===state.page));
}
markNavCurrent(); hudUpdate();

/* long-press fab → secret */
let fabHold=null;
navFab.addEventListener('touchstart',()=>{ fabHold=setTimeout(()=>{ vib([15,30,15]);
  const r=navFab.getBoundingClientRect();
  spawnBurst(r.left+r.width/2, r.top, 70, true); flash(.5,.6);
  toast('Ты нашла скрытую анимацию. Даже кнопки здесь хранят секреты ✦'); Sound.chime(990,.13);
},650); },{passive:true});
['touchend','touchcancel','touchmove'].forEach(ev=> navFab.addEventListener(ev,()=> clearTimeout(fabHold),{passive:true}));
navFab.addEventListener('mouseup',()=> clearTimeout(fabHold));

/* ═════════════════════ PAGE 2 · three.js core ═════════════════════ */
let three=null;
function makeGlowTexture(){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.25,'rgba(216,204,255,.55)');
  g.addColorStop(.6,'rgba(139,92,246,.18)');
  g.addColorStop(1,'rgba(139,92,246,0)');
  x.fillStyle=g; x.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(c);
}
function ensureThree(){
  if(three){ return; }
  const canvas=$('#three-canvas');
  if(!window.THREE){ startOrb2D(canvas); return; }
  try{
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!state.lite});
    renderer.setPixelRatio(DPR());
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(48,1,.1,50);
    camera.position.z=5.4;
    const group=new THREE.Group(); scene.add(group);
    const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(1.12,1),
      new THREE.MeshBasicMaterial({color:0xc4b5fd,wireframe:true,transparent:true,opacity:.55}));
    group.add(wire);
    const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.74,2),
      new THREE.MeshBasicMaterial({color:0x8b5cf6,transparent:true,opacity:.22,blending:THREE.AdditiveBlending}));
    group.add(inner);
    // glow sprites
    const glowTex=makeGlowTexture();
    const glow1=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow1.scale.setScalar(4.6); group.add(glow1);
    const glow2=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow2.scale.setScalar(8.5); group.add(glow2);
    // rings
    const rings=[];
    [[2.0,.5,0,.3],[2.5,-.35,.6,.25],[3.0,.15,-.9,.18],[3.5,.8,.3,.12]].forEach(([r,rx,rz,op])=>{
      const pts=[]; for(let i=0;i<=100;i++){ const a=i/100*TAU; pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r)); }
      const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:0xa78bfa,transparent:true,opacity:op}));
      ring.rotation.x=rx; ring.rotation.z=rz; group.add(ring); rings.push(ring);
    });
    // floating shards
    const shards=[];
    const shardN=state.lite?6:14;
    for(let i=0;i<shardN;i++){
      const m=new THREE.Mesh(new THREE.OctahedronGeometry(rand(.05,.14),0),
        new THREE.MeshBasicMaterial({color: Math.random()<.5?0xc4b5fd:0x8b5cf6,transparent:true,opacity:.85}));
      m.userData={r:rand(1.6,3.2),a:rand(0,TAU),sp:rand(.2,.6),tilt:rand(-.6,.6),y:rand(-.7,.7),rs:rand(.5,2)};
      group.add(m); shards.push(m);
    }
    // ambient particles
    const pn=state.lite?160:500, pos=new Float32Array(pn*3);
    for(let i=0;i<pn;i++){
      const r=rand(1.5,3.4), th=rand(0,TAU), ph=Math.acos(rand(-1,1));
      pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.cos(ph)*.55; pos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    }
    const pGeo=new THREE.BufferGeometry(); pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const parts=new THREE.Points(pGeo,new THREE.PointsMaterial({color:0xd8ccff,size:.035,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}));
    group.add(parts);
    // burst particles
    const bn=state.lite?70:180, bpos=new Float32Array(bn*3), bvel=[];
    for(let i=0;i<bn;i++){ bpos[i*3+1]=999; bvel.push(new THREE.Vector3()); }
    const bGeo=new THREE.BufferGeometry(); bGeo.setAttribute('position',new THREE.BufferAttribute(bpos,3));
    const burst=new THREE.Points(bGeo,new THREE.PointsMaterial({color:0xffffff,size:.055,transparent:true,opacity:.95,blending:THREE.AdditiveBlending}));
    scene.add(burst);
    // pulse rings (tap shockwave)
    const pulses=[];
    for(let i=0;i<3;i++){
      const pts=[]; for(let k=0;k<=80;k++){ const a=k/80*TAU; pts.push(new THREE.Vector3(Math.cos(a),0,Math.sin(a))); }
      const pr=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:0xe9e4ff,transparent:true,opacity:0}));
      pr.visible=false; scene.add(pr); pulses.push({mesh:pr,t:99});
    }
    three={renderer,scene,camera,group,wire,inner,glow1,glow2,parts,rings,shards,burst,bpos,bvel,bn,pulses,
      rx:0,ry:0,trx:.4,try:0,vx:0,vy:0,glow:0,bt:99};
    resizeThree();
    let dragging=false,lx=0,ly=0,moved=0;
    canvas.addEventListener('pointerdown',e=>{ dragging=true; lx=e.clientX; ly=e.clientY; moved=0; });
    addEventListener('pointermove',e=>{ if(!dragging)return;
      const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
      three.vy=dx*.0045; three.vx=dy*.003; three.try+=dx*.004; three.trx+=dy*.0025; });
    addEventListener('pointerup',e=>{ if(!dragging)return; dragging=false;
      if(moved<8) orbTap(e.clientX,e.clientY); });
  }catch(err){ startOrb2D(canvas); }
}
function resizeThree(){
  if(!three||!three.renderer) return;
  const w=innerWidth,h=innerHeight;
  three.renderer.setSize(w,h,false);
  three.camera.aspect=w/h; three.camera.updateProjectionMatrix();
}
function orbTap(x,y){
  if(!three){ if(orb2d){orb2d.glow=1;} return; }
  vib(18); Sound.chime(rand(720,980),.12);
  ripple(x,y,true); flash(.28,.5);
  three.glow=1; three.bt=0;
  const p=three.pulses.find(p=>p.t>1); if(p) p.t=0;
  for(let i=0;i<three.bn;i++){
    const a=rand(0,TAU), ph=Math.acos(rand(-1,1)), sp=rand(1.6,4.4);
    three.bpos[i*3]=0; three.bpos[i*3+1]=0; three.bpos[i*3+2]=0;
    three.bvel[i].set(Math.sin(ph)*Math.cos(a)*sp, Math.cos(ph)*sp, Math.sin(ph)*Math.sin(a)*sp);
  }
  three.burst.geometry.attributes.position.needsUpdate=true;
  spawnBurst(x,y,16);
}
function updateThree(now,dt){
  if(!three||!three.renderer) return;
  const t=three;
  // inertia decay
  t.try+=t.vy; t.trx+=t.vx; t.vy*=.93; t.vx*=.93;
  t.ry=lerp(t.ry,t.try+now*.1,.07); t.rx=lerp(t.rx,t.trx,.07);
  t.group.rotation.y=t.ry; t.group.rotation.x=t.rx;
  t.rings.forEach((r,i)=> r.rotation.y+=dt*(.2+i*.07));
  t.parts.rotation.y-=dt*.05;
  for(const sh of t.shards){
    const u=sh.userData; u.a+=dt*u.sp;
    sh.position.set(Math.cos(u.a)*u.r, u.y+Math.sin(now*u.sp+u.r)*.15, Math.sin(u.a)*u.r);
    sh.rotation.x+=dt*u.rs; sh.rotation.y+=dt*u.rs*.7;
  }
  t.glow=Math.max(0,t.glow-dt*1.3);
  const s=1+t.glow*.3;
  t.group.scale.setScalar(s);
  t.wire.material.opacity=.55+t.glow*.45;
  t.inner.material.opacity=.22+t.glow*.6;
  t.glow1.material.opacity=.7+t.glow*.3;
  t.glow2.material.opacity=.3+t.glow*.45;
  // camera float
  t.camera.position.y=Math.sin(now*.5)*.08;
  t.camera.lookAt(0,0,0);
  // bursts
  if(t.bt<1.6){
    t.bt+=dt;
    for(let i=0;i<t.bn;i++){
      t.bvel[i].multiplyScalar(.965);
      t.bpos[i*3]+=t.bvel[i].x*dt*3; t.bpos[i*3+1]+=t.bvel[i].y*dt*3; t.bpos[i*3+2]+=t.bvel[i].z*dt*3;
    }
    t.burst.geometry.attributes.position.needsUpdate=true;
    t.burst.material.opacity=clamp(1.6-t.bt,0,1);
  }
  // pulses
  for(const p of t.pulses){
    if(p.t>1.1){ p.mesh.visible=false; continue; }
    p.t+=dt;
    const e=easeOutCubic(clamp(p.t/1.1,0,1));
    p.mesh.visible=true;
    p.mesh.scale.setScalar(1+e*5);
    p.mesh.material.opacity=(1-e)*.8;
    p.mesh.rotation.x=t.group.rotation.x*.4;
    p.mesh.rotation.z=t.group.rotation.z||.4;
  }
  t.renderer.render(t.scene,t.camera);
}
let orb2d=null;
function startOrb2D(canvas){
  const ctx=canvas.getContext('2d');
  orb2d={ctx,active:true,p:0,glow:0};
  canvas.addEventListener('pointerdown',e=>{ orb2d.glow=1; vib(15); ripple(e.clientX,e.clientY,true); Sound.chime(840,.12); });
}
function updateOrb2D(now,dt){
  if(!orb2d||!orb2d.active) return;
  const canvas=$('#three-canvas'), ctx=orb2d.ctx;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.floor(w*DPR())){ canvas.width=w*DPR(); canvas.height=h*DPR(); }
  ctx.setTransform(DPR(),0,0,DPR(),0,0); ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h*.36, R=Math.min(w,h)*.19*(1+orb2d.glow*.2);
  orb2d.glow=Math.max(0,orb2d.glow-dt*1.2);
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R*3.2);
  g.addColorStop(0,'rgba(255,255,255,.9)');
  g.addColorStop(.18,`hsla(${state.hue},90%,72%,${.55+orb2d.glow*.4})`);
  g.addColorStop(1,'rgba(139,92,246,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R*3.2,0,TAU); ctx.fill();
  ctx.strokeStyle=`hsla(${state.hue},85%,80%,.5)`; ctx.lineWidth=1;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.ellipse(cx,cy,R*(1.5+i*.45),R*(.5+i*.18),now*.15+i*1.1,0,TAU);
    ctx.stroke();
  }
}

/* portal + hue easter egg */
const portal=$('#portal');
portal.addEventListener('click',()=>{ portal.classList.toggle('open'); vib(10); Sound.tick(); });
let lastTap=0;
$('#medina-title').addEventListener('click',e=>{
  e.stopPropagation();
  const nowT=Date.now();
  if(nowT-lastTap<320){
    state.hue=(state.hue+140)%360;
    $$('.nebula').forEach(n=> n.style.filter=`blur(70px) hue-rotate(${(state.hue-265+360)%360}deg)`);
    flash(.3,.5);
    toast('Галактика сменила окраск. Только для тебя ✦'); Sound.chime(1046,.12);
  }
  lastTap=nowT;
});

/* ═════════════════════ PAGE 3 · memories ═════════════════════ */
const MEM=[
  ['01','Первый разговор','Кто-то просто появился… и разговор затянулся до самой ночи.',0],
  ['02','Смех','Тот момент, когда невозможно было перестать смеяться.',1],
  ['03','Город','Улицы, которые стали чуть роднее — просто потому что ты рядом.',2],
  ['04','Планы','Мечты, которые мы придумали «на потом». Они всё ещё ждут нас.',3],
  ['05','Тишина','Даже молчание с тобой — не пустое. Оно тоже считается.',4],
  ['06','Сейчас','А это момент, который мы записали в этот маленький мир.',5],
];
const memTrack=$('#mem-track'), memViewport=$('#mem-viewport'), memDots=$('#mem-dots');
let memIndex=0, memCards=[];
MEM.forEach(([num,title,phrase,pat])=>{
  const c=document.createElement('div'); c.className='mem-card';
  c.innerHTML=`<div class="mem-num">ENTRY · ${num}</div><div class="mem-title">${title}</div>
    <canvas></canvas><div class="mem-phrase">${phrase}</div>`;
  memTrack.appendChild(c);
  memCards.push({el:c,cv:c.querySelector('canvas'),ctx:c.querySelector('canvas').getContext('2d'),pat,ph:rand(0,TAU)});
});
MEM.forEach((_,i)=>{ const d=document.createElement('i'); if(i===0)d.className='on'; memDots.appendChild(d); });
let memDrag=null;
function cardStep(){ return memCards[0].el.offsetWidth+18; }
function trackX(i){ return memViewport.clientWidth/2 - memCards[0].el.offsetWidth/2 - i*cardStep(); }
function layoutMem(){
  memIndex=clamp(memIndex,0,MEM.length-1);
  setTrack(trackX(memIndex), true);
  updateDots();
}
function setTrack(x,immediate){
  memTrack.style.transition=immediate?'none':'transform .55s cubic-bezier(.2,.8,.2,1)';
  memTrack.style.transform=`translateX(${x}px)`;
  memCards.forEach((c,i)=> c.el.classList.toggle('center',i===memIndex));
}
function updateDots(){ Array.from(memDots.children).forEach((d,i)=> d.classList.toggle('on',i===memIndex)); }
memViewport.addEventListener('pointerdown',e=>{ memDrag={x0:e.clientX,t0:curTrackX()}; memTrack.style.transition='none'; });
function curTrackX(){ const m=/translateX\((-?[\d.]+)px\)/.exec(memTrack.style.transform); return m?parseFloat(m[1]):0; }
addEventListener('pointermove',e=>{ if(!memDrag)return;
  memTrack.style.transform=`translateX(${e.clientX-memDrag.x0+memDrag.t0}px)`; });
addEventListener('pointerup',e=>{
  if(!memDrag)return;
  const dx=e.clientX-memDrag.x0; memDrag=null;
  if(dx<-55) memIndex=Math.min(memIndex+1,MEM.length-1);
  else if(dx>55) memIndex=Math.max(memIndex-1,0);
  setTrack(trackX(memIndex)); updateDots(); vib(6);
});
function drawMemCard(c,now){
  const cv=c.cv, ctx=c.ctx, w=cv.clientWidth||260, h=130;
  if(cv.width!==Math.floor(w*DPR())){ cv.width=w*DPR(); cv.height=h*DPR(); }
  ctx.setTransform(DPR(),0,0,DPR(),0,0); ctx.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2, t=now+c.ph;
  ctx.strokeStyle=`hsla(${state.hue},80%,75%,.6)`; ctx.fillStyle=`hsla(${state.hue+15},85%,80%,.9)`;
  switch(c.pat){
    case 0:
      for(let i=0;i<3;i++){
        ctx.globalAlpha=.35; ctx.beginPath();
        ctx.ellipse(cx,cy,26+i*18,(10+i*7),i*.5,0,TAU); ctx.stroke();
        const a=t*(0.9-i*.22)+i*2;
        ctx.globalAlpha=1; ctx.beginPath();
        ctx.arc(cx+Math.cos(a)*(26+i*18), cy+Math.sin(a)*(10+i*7), 2.2,0,TAU); ctx.fill();
      } break;
    case 1:
      for(let l=0;l<4;l++){
        ctx.globalAlpha=.5-l*.08; ctx.beginPath();
        for(let x=0;x<=w;x+=4) ctx.lineTo(x, cy-24+l*16+Math.sin(x*.05+t*2+l)*7);
        ctx.stroke();
      } break;
    case 2:
      { const pts=[[.2,.3],[.42,.62],[.6,.25],[.78,.55],[.32,.8]];
        ctx.globalAlpha=.9;
        pts.forEach((p,i)=>{ const r=1.8+Math.sin(t*2+i)*.8;
          ctx.beginPath();ctx.arc(p[0]*w,p[1]*h,r,0,TAU);ctx.fill(); });
        ctx.globalAlpha=.3; ctx.beginPath();
        pts.forEach((p,i)=> i?ctx.lineTo(p[0]*w,p[1]*h):ctx.moveTo(p[0]*w,p[1]*h));
        ctx.stroke(); } break;
    case 3:
      ctx.globalAlpha=.8;
      for(let i=0;i<40;i++){ const a=i*.42+t*.8, r=i*1.15;
        ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.6,1.4,0,TAU); ctx.fill(); } break;
    case 4:
      for(let gx=0;gx<6;gx++) for(let gy=0;gy<3;gy++){
        const x=20+gx*(w-40)/5, y=22+gy*(h-44)/2;
        const r=1.4+2.2*Math.abs(Math.sin(t*1.6+gx*.7+gy*.9));
        ctx.globalAlpha=.5+.4*Math.sin(t*1.6+gx+gy);
        ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill(); } break;
    default:
      for(let i=0;i<24;i++){
        const x=((i*47+ t*12*(1+i%3))%(w+20))-10, y=(i*29)%h;
        ctx.globalAlpha=.3+.6*Math.abs(Math.sin(t*2+i));
        ctx.beginPath();ctx.arc(x,y,1.3,0,TAU);ctx.fill(); }
  }
  ctx.globalAlpha=1;
}

/* ═════════════════════ PAGE 4 · constellation ═════════════════════ */
const cCan=$('#const-canvas'), cctx=cCan.getContext('2d');
const CPTS=[[.5,.1],[.63,.27],[.85,.3],[.7,.48],[.82,.68],[.58,.6],[.5,.88],[.42,.6],[.18,.68],[.3,.48],[.15,.3],[.37,.27]];
let cVisited=[], cComplete=false, cFlash=0;
const cWrap=$('#const-wrap');
function constPtsPx(){
  const w=cCan.clientWidth||300, h=cCan.clientHeight||300;
  return CPTS.map(p=>({x:p[0]*w, y:p[1]*h}));
}
function resizeConst(){
  const w=cWrap.clientWidth, h=cWrap.clientHeight;
  if(w===0||h===0) return;
  cCan.width=w*DPR(); cCan.height=h*DPR(); cctx.setTransform(DPR(),0,0,DPR(),0,0);
  drawConst(performance.now()/1000);
}
function starOrderLines(pts){
  const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length, cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
  return pts.map((p,i)=>({p,a:Math.atan2(p.y-cy,p.x-cx),i})).sort((a,b)=>a.a-b.a).map(o=>o.i);
}
function drawConst(now){
  const w=cCan.clientWidth, h=cCan.clientHeight;
  cctx.clearRect(0,0,w,h);
  // faint grid dots
  cctx.fillStyle='rgba(196,181,253,.08)';
  for(let gx=1;gx<8;gx++) for(let gy=1;gy<10;gy++){
    cctx.beginPath(); cctx.arc(gx*w/8, gy*h/10, 1, 0, TAU); cctx.fill();
  }
  const pts=constPtsPx();
  if(cComplete){
    const order=starOrderLines(pts);
    cctx.strokeStyle=`hsla(${state.hue},90%,78%,${.5+cFlash*.5})`;
    cctx.lineWidth=1.2; cctx.shadowColor=`hsla(${state.hue},90%,70%,.9)`; cctx.shadowBlur=16;
    cctx.beginPath();
    order.forEach((idx,k)=>{ const p=pts[idx]; k?cctx.lineTo(p.x,p.y):cctx.moveTo(p.x,p.y); });
    cctx.closePath(); cctx.stroke(); cctx.shadowBlur=0;
  }
  cctx.strokeStyle=`hsla(${state.hue+20},90%,82%,.9)`; cctx.lineWidth=1.4;
  cctx.shadowColor=`hsla(${state.hue},90%,75%,.8)`; cctx.shadowBlur=8;
  cctx.beginPath();
  cVisited.forEach((idx,k)=>{ const p=pts[idx]; k?cctx.lineTo(p.x,p.y):cctx.moveTo(p.x,p.y); });
  cctx.stroke(); cctx.shadowBlur=0;
  pts.forEach((p,i)=>{
    const vis=cVisited.includes(i);
    const tw=.6+.4*Math.sin(now*2.4+i);
    const r=vis?3.2:(2+tw*1.2);
    const g=cctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*5);
    g.addColorStop(0, vis?'rgba(255,255,255,.95)':`hsla(${state.hue},90%,80%,${.7*tw})`);
    g.addColorStop(1,'rgba(139,92,246,0)');
    cctx.fillStyle=g; cctx.beginPath(); cctx.arc(p.x,p.y,r*5,0,TAU); cctx.fill();
    cctx.fillStyle=vis?'#fff':`hsla(${state.hue},85%,85%,${.5+.5*tw})`;
    cctx.beginPath(); cctx.arc(p.x,p.y,r,0,TAU); cctx.fill();
    if(!vis){
      cctx.fillStyle='rgba(196,181,253,.4)';
      cctx.font='7px Manrope'; cctx.textAlign='center';
      cctx.fillText(String(i+1), p.x, p.y+14);
    }
  });
}
function constTouch(e){
  if(cComplete) return;
  const r=cCan.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  const pts=constPtsPx();
  let best=-1,bd=38;
  pts.forEach((p,i)=>{ if(cVisited.includes(i))return;
    const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d;best=i;} });
  if(best>=0){
    cVisited.push(best); vib(8); Sound.chime(700+best*40,.07);
    spawnBurst(e.clientX,e.clientY,6);
    if(cVisited.length===CPTS.length){
      cComplete=true; vib([20,40,20]); Sound.chime(1046,.14); flash(.35,.6);
      tween(1.8,e=>{ cFlash=e; },{onComplete:()=>{
        $('#const-msg').classList.remove('hidden');
        seqReveal($('#const-msg'),.1,.2);
      }});
    }
    drawConst(performance.now()/1000);
  }
}
cCan.addEventListener('pointerdown',constTouch);
cCan.addEventListener('pointermove',e=>{ if(e.pointerType==='touch') constTouch(e); });
function resetConstellation(){
  cVisited=[]; cComplete=false; cFlash=0;
  $('#const-msg').classList.add('hidden');
  clearReveals($('#const-msg'));
  resizeConst();
}
$('#const-reset').addEventListener('click',()=>{ vib(8); resetConstellation(); });

/* ═════════════════════ PAGE 5 · secret room ═════════════════════ */
const doorScene=$('#door-scene');
let doorOpened=false;
$('#door').addEventListener('click',e=>{
  if(doorOpened) return; doorOpened=true;
  doorScene.classList.add('open'); vib([15,40,20]); Sound.chime(587,.13);
  ripple(e.clientX,e.clientY,true); flash(.4,.8);
  seqReveal($('#secret-reveal'),.9,.5);
});
const sCan=$('#secret-canvas'), sctx=sCan.getContext('2d');
let sDust=[];
function resizeSecret(){
  const w=sCan.clientWidth||220,h=sCan.clientHeight||300;
  sCan.width=w*DPR(); sCan.height=h*DPR(); sctx.setTransform(DPR(),0,0,DPR(),0,0);
  sDust=Array.from({length:state.lite?14:30},()=>({x:Math.random()*w,y:Math.random()*h,
    vx:rand(-.15,.15),vy:rand(-.25,-.05),r:rand(.6,1.8),p:rand(0,TAU)}));
}
function updateSecret(now,dt){
  if(!doorOpened) return;
  const w=sCan.clientWidth,h=sCan.clientHeight;
  sctx.clearRect(0,0,w,h);
  for(const d of sDust){
    d.x+=d.vx; d.y+=d.vy;
    if(d.y<-5){d.y=h+5;d.x=Math.random()*w;}
    if(d.x<-5)d.x=w+5; if(d.x>w+5)d.x=-5;
    sctx.globalAlpha=.4+.5*Math.sin(now*2+d.p);
    sctx.fillStyle=`hsla(${state.hue+10},85%,82%,1)`;
    sctx.beginPath();sctx.arc(d.x,d.y,d.r,0,TAU);sctx.fill();
  }
  sctx.globalAlpha=1;
}

/* ═════════════════════ PAGE 6 · words ═════════════════════ */
const WORDS=['дружба','смех','разговоры','воспоминания','поддержка','приключения','искренность','момент'];
const WORD_POS=[[22,30],[70,24],[28,52],[66,46],[22,70],[68,72],[48,34],[50,60]];
const wordsSpace=$('#words-space');
let wordEls=[];
function ensureWords(){
  if(wordEls.length) return;
  WORDS.forEach((txt,i)=>{
    const el=document.createElement('button'); el.className='word'; el.textContent=txt;
    wordsSpace.appendChild(el);
    const w={el,bx:WORD_POS[i][0]/100*innerWidth, by:WORD_POS[i][1]/100*innerHeight,
      ph:rand(0,TAU), sp:rand(.35,.6), collected:false};
    el.addEventListener('click',e=>{
      if(w.collected) return; w.collected=true;
      vib(12); Sound.chime(rand(600,900),.1);
      ripple(e.clientX,e.clientY,false);
      for(let k=0;k<12;k++){
        const p=document.createElement('div');
        p.style.cssText=`position:absolute;left:${w.bx}px;top:${w.by}px;width:4px;height:4px;border-radius:50%;
          background:hsl(${state.hue+15},90%,80%);box-shadow:0 0 10px 2px hsla(${state.hue},90%,70%,.8);
          pointer-events:none;transform:translate(-50%,-50%)`;
        wordsSpace.appendChild(p);
        const a=rand(0,TAU),d=rand(30,80);
        tween(.8,e2=>{ p.style.left=w.bx+Math.cos(a)*d*e2+'px'; p.style.top=w.by+Math.sin(a)*d*e2+'px';
          p.style.opacity=1-e2; },{onComplete:()=>p.remove()});
      }
      tween(.7,e2=>{ el.style.transform=`translate(-50%,-50%) scale(${1+e2*1.6})`;
        el.style.opacity=1-e2; el.style.filter=`blur(${e2*10}px)`; },
        {onComplete:()=>{ el.style.display='none';
          if(wordEls.every(x=>x.collected)){
            $('#words-msg').classList.remove('hidden');
            seqReveal($('#words-msg'),.1,.2);
          }}});
    });
    wordEls.push(w);
  });
}
function updateWords(now){
  if(state.page!=='words') return;
  for(const w of wordEls){
    if(w.collected) continue;
    const x=w.bx+Math.sin(now*w.sp+w.ph)*16;
    const y=w.by+Math.cos(now*w.sp*.8+w.ph)*11;
    const s=1+Math.sin(now*w.sp*1.3+w.ph)*.06;
    w.el.style.transform=`translate(-50%,-50%) translate(${x-w.bx}px,${y-w.by}px) scale(${s})`;
  }
}
$('#words-reset').addEventListener('click',()=>{
  vib(8);
  wordEls.forEach(w=>{ w.collected=false; w.el.style.display=''; w.el.style.opacity=1; w.el.style.filter='';
    w.el.style.transform='translate(-50%,-50%)'; });
  $('#words-msg').classList.add('hidden'); clearReveals($('#words-msg'));
});

/* ═════════════════════ PAGE 7 · sky ═════════════════════ */
const skyCan=$('#sky-canvas'), skctx=skyCan.getContext('2d');
let skyStars=[], skyTrails=[], skyFall=null, fallTimer=4, moonTaps=0, moonTapTimer=null;
const SKY_CONST=[[[.15,.25],[.28,.32],[.24,.48]],[[.62,.6],[.72,.5],[.84,.58],[.78,.72]]];
function resizeSky(){
  const w=skyCan.clientWidth||300,h=skyCan.clientHeight||400;
  if(w===0) return;
  skyCan.width=w*DPR(); skyCan.height=h*DPR(); skctx.setTransform(DPR(),0,0,DPR(),0,0);
  skyStars=Array.from({length:state.lite?80:170},()=>({x:Math.random()*w,y:Math.random()*h,
    r:rand(.4,1.4),p:rand(0,TAU),sp:rand(.6,1.8)}));
}
function skyMoon(){ const w=skyCan.clientWidth,h=skyCan.clientHeight;
  return {x:w*.74,y:h*.2,r:Math.min(w,h)*.09}; }
function updateSky(now,dt){
  if(state.page!=='sky') return;
  const w=skyCan.clientWidth,h=skyCan.clientHeight;
  skctx.clearRect(0,0,w,h);
  // milky way band
  skctx.save();
  skctx.translate(w*.45,h*.55); skctx.rotate(-.5);
  const mw=skctx.createLinearGradient(0,-h*.22,0,h*.22);
  mw.addColorStop(0,'rgba(139,92,246,0)');
  mw.addColorStop(.5,'rgba(196,181,253,.10)');
  mw.addColorStop(1,'rgba(139,92,246,0)');
  skctx.fillStyle=mw; skctx.fillRect(-w,-h*.22,w*2,h*.44);
  skctx.restore();
  let hz=skctx.createRadialGradient(w*.5,h*1.1,0,w*.5,h*1.1,h*1.2);
  hz.addColorStop(0,'rgba(96,165,250,.10)'); hz.addColorStop(1,'rgba(96,165,250,0)');
  skctx.fillStyle=hz; skctx.fillRect(0,0,w,h);
  hz=skctx.createRadialGradient(0,0,0,0,0,h*.9);
  hz.addColorStop(0,'rgba(139,92,246,.13)'); hz.addColorStop(1,'rgba(139,92,246,0)');
  skctx.fillStyle=hz; skctx.fillRect(0,0,w,h);
  skctx.strokeStyle='rgba(196,181,253,.16)'; skctx.lineWidth=1;
  SKY_CONST.forEach(shape=>{ skctx.beginPath();
    shape.forEach((p,i)=>{ const x=p[0]*w,y=p[1]*h; i?skctx.lineTo(x,y):skctx.moveTo(x,y); });
    skctx.stroke();
    shape.forEach(p=>{ skctx.fillStyle='rgba(196,181,253,.5)';
      skctx.beginPath();skctx.arc(p[0]*w,p[1]*h,1.4,0,TAU);skctx.fill(); });
  });
  for(const s of skyStars){
    skctx.globalAlpha=.35+.55*Math.abs(Math.sin(now*s.sp+s.p));
    skctx.fillStyle='#eae4ff';
    skctx.beginPath();skctx.arc(s.x,s.y,s.r,0,TAU);skctx.fill();
  }
  skctx.globalAlpha=1;
  const m=skyMoon();
  const mg=skctx.createRadialGradient(m.x,m.y,m.r*.4,m.x,m.y,m.r*3.4);
  mg.addColorStop(0,'rgba(245,240,255,.35)'); mg.addColorStop(1,'rgba(196,181,253,0)');
  skctx.fillStyle=mg; skctx.beginPath();skctx.arc(m.x,m.y,m.r*3.4,0,TAU);skctx.fill();
  skctx.fillStyle='#f2edff'; skctx.beginPath();skctx.arc(m.x,m.y,m.r,0,TAU);skctx.fill();
  skctx.fillStyle='rgba(196,181,253,.35)';
  [[-.3,-.15,.18],[.25,.2,.13],[.05,.45,.09]].forEach(([dx,dy,cr])=>{
    skctx.beginPath();skctx.arc(m.x+dx*m.r,m.y+dy*m.r,cr*m.r,0,TAU);skctx.fill(); });
  fallTimer-=dt;
  if(fallTimer<=0){
    skyFall={x:rand(w*.25,w*.95),y:rand(0,h*.3),vx:-rand(4,6.5),vy:rand(1.6,2.8),life:1};
    fallTimer=state.lite?rand(12,18):rand(4,8);
    if(Math.random()<.18) setTimeout(()=> toast('Падающая звезда услышала твоё желание ✦'), 900);
  }
  if(skyFall){
    skyFall.x+=skyFall.vx; skyFall.y+=skyFall.vy; skyFall.life-=dt*.8;
    if(skyFall.life<=0) skyFall=null;
    else{
      const g=skctx.createLinearGradient(skyFall.x,skyFall.y,skyFall.x-skyFall.vx*10,skyFall.y-skyFall.vy*10);
      g.addColorStop(0,`rgba(255,255,255,${skyFall.life})`); g.addColorStop(1,'rgba(139,92,246,0)');
      skctx.strokeStyle=g; skctx.lineWidth=1.8;
      skctx.beginPath();skctx.moveTo(skyFall.x,skyFall.y);skctx.lineTo(skyFall.x-skyFall.vx*10,skyFall.y-skyFall.vy*10);skctx.stroke();
    }
  }
  for(let i=skyTrails.length-1;i>=0;i--){
    const p=skyTrails[i]; p.life-=dt*1.6;
    if(p.life<=0){skyTrails.splice(i,1);continue;}
    const g=skctx.createRadialGradient(p.x,p.y,0,p.x,p.y,9*p.life);
    g.addColorStop(0,`hsla(${state.hue+20},95%,85%,${p.life*.8})`);
    g.addColorStop(1,'rgba(139,92,246,0)');
    skctx.fillStyle=g; skctx.beginPath();skctx.arc(p.x,p.y,9*p.life,0,TAU);skctx.fill();
  }
}
skyCan.addEventListener('pointermove',e=>{
  if(state.page!=='sky') return;
  const r=skyCan.getBoundingClientRect();
  skyTrails.push({x:e.clientX-r.left,y:e.clientY-r.top,life:1});
  if(skyTrails.length>70) skyTrails.shift();
});
skyCan.addEventListener('pointerdown',e=>{
  if(state.page!=='sky') return;
  const r=skyCan.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top, m=skyMoon();
  if(Math.hypot(x-m.x,y-m.y)<m.r*1.8){
    moonTaps++; vib(8); Sound.chime(880+moonTaps*60,.08);
    clearTimeout(moonTapTimer); moonTapTimer=setTimeout(()=> moonTaps=0, 2200);
    if(moonTaps>=7){ moonTaps=0;
      toast('Секрет луны: даже в самую тёмную ночь кто-то смотрит на тот же свет. — М.');
      spawnBurst(e.clientX,e.clientY,40,true); flash(.4,.7); Sound.chime(1318,.15);
    }
  }
});

/* ═════════════════════ PAGE 8 · final ═════════════════════ */
const fCan=$('#final-canvas'), fctx=fCan.getContext('2d');
let finalRan=false, finalDot=0, finale=null;
function runFinal(){
  finale=null;
  $('#final-msg').classList.add('hidden');
  $('#final-content').classList.remove('hidden');
  $('#not-yet').classList.add('hidden');
  splitTitle($('#final-title'));
  const ti=$('#final-title');
  ti.classList.remove('in'); ti.style.opacity=0;
  $$('#final-content .f-line').forEach(el=>{ el.style.opacity=0; el.style.filter=''; el.style.transform=''; });
  finalDot=0;
  tween(2.4,e=>{ finalDot=e; });
  tween(1.6,e=>{ ti.style.opacity=e; },{delay:1.0, onComplete:()=> ti.classList.add('in')});
  const lines=$$('#final-content .f-line');
  lines.forEach((el,i)=>{
    tween(1.4,e=>{ el.style.opacity=e; el.style.transform=`translateY(${(1-e)*22}px)`; el.style.filter=`blur(${(1-e)*12}px)`; },
      {delay:2.6+i*1.35});
  });
  tween(1.2,e=>{ $('#the-end').style.opacity=e; },{delay:2.6+lines.length*1.35+.4,
    onComplete:()=> $('#not-yet').classList.remove('hidden')});
  finalRan=true;
}
function updateFinal(now,dt){
  if(state.page!=='final'||!finalRan) return;
  const w=fCan.clientWidth,h=fCan.clientHeight;
  if(fCan.width!==Math.floor(w*DPR())){ fCan.width=w*DPR(); fCan.height=h*DPR(); }
  fctx.setTransform(DPR(),0,0,DPR(),0,0);
  fctx.clearRect(0,0,w,h);
  if(finale){
    const F=finale; F.t+=dt;
    const cx=w/2, cy=h/2;
    // core flare during/after formation
    if(F.t>F.form*.6){
      const fe=clamp((F.t-F.form*.6)/1.5,0,1)*(F.t>F.form+F.hold? clamp(1-(F.t-F.form-F.hold)/1.6,0,1):1);
      const fg=fctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*.28*fe);
      fg.addColorStop(0,`rgba(255,255,255,${.85*fe})`);
      fg.addColorStop(.4,`hsla(${state.hue},90%,72%,${.4*fe})`);
      fg.addColorStop(1,'rgba(139,92,246,0)');
      fctx.fillStyle=fg; fctx.beginPath();fctx.arc(cx,cy,Math.min(w,h)*.28*fe,0,TAU);fctx.fill();
    }
    // shockwave rings after formation
    if(F.t>F.form && F.t<F.form+2){
      const re=(F.t-F.form)/2;
      fctx.strokeStyle=`hsla(${state.hue},90%,80%,${(1-re)*.5})`; fctx.lineWidth=1.5;
      fctx.beginPath();fctx.arc(cx,cy,re*Math.min(w,h)*.55,0,TAU);fctx.stroke();
    }
    const fade=F.t>F.form+F.hold? clamp(1-(F.t-F.form-F.hold)/1.6,0,1):1;
    for(const p of F.parts){
      if(F.t<F.form){ const e=easeInOutCubic(clamp(F.t/F.form,0,1));
        p.x=lerp(p.sx,p.tx,e); p.y=lerp(p.sy,p.ty,e);
      } else {
        const a=p.ta+dt*1.15*(1.4-p.tr), r=p.tr*Math.min(w,h)*.4;
        p.x=cx+Math.cos(a)*r*1.35; p.y=cy+Math.sin(a)*r*.75;
        p.ta=a;
      }
      fctx.globalAlpha=p.a*fade;
      fctx.fillStyle=`hsl(${state.hue+rand(-20,30)},85%,${rand(75,92)}%)`;
      fctx.beginPath();fctx.arc(p.x,p.y,p.r,0,TAU);fctx.fill();
    }
    fctx.globalAlpha=1;
    if(F.t>F.form+F.hold+1.7 && !F.done){
      F.done=true;
      $('#final-content').classList.add('hidden');
      $('#final-msg').classList.remove('hidden');
      seqReveal($('#final-msg'),.1,.2);
    }
    return;
  }
  if(finalDot>0 && finalDot<1){
    const cx=w/2, cy=h*.4, r=2+finalDot*6;
    const g=fctx.createRadialGradient(cx,cy,0,cx,cy,r*9);
    g.addColorStop(0,'rgba(255,255,255,.9)');
    g.addColorStop(.3,`hsla(${state.hue},90%,74%,.4)`);
    g.addColorStop(1,'rgba(139,92,246,0)');
    fctx.fillStyle=g; fctx.beginPath();fctx.arc(cx,cy,r*9,0,TAU);fctx.fill();
  }
}
$('#not-yet').addEventListener('click',e=>{
  vib([15,40,15]); Sound.whoosh(); Sound.chime(784,.13); ripple(e.clientX,e.clientY,true); flash(.7,1.1);
  const n=state.lite?350:900, parts=[];
  const cx=innerWidth/2, cy=innerHeight/2;
  for(let i=0;i<n;i++){
    const arm=i%5, t=i/n, a=t*TAU*3.1+arm*TAU/5, r=Math.pow(t,.6);
    parts.push({sx:rand(0,innerWidth),sy:rand(0,innerHeight),
      tx:cx+Math.cos(a)*r*innerWidth*.4*1.35, ty:cy+Math.sin(a)*r*innerHeight*.4*.75,
      x:0,y:0,ta:a,tr:r,r:rand(.6,2),a:rand(.4,1)});
  }
  finale={parts,t:0,form:3.6,hold:2.8,done:false};
});
$('#final-home').addEventListener('click',()=>{ finale=null; goTo('home'); });

/* ═════════════════════ controls ═════════════════════ */
const modeBtn=$('#mode-btn');
function setMode(lite,silent){
  state.lite=lite;
  document.body.classList.toggle('lite',lite);
  modeBtn.querySelector('.c-label').textContent=lite?'LITE':'ULTRA';
  modeBtn.classList.toggle('on',!lite);
  buildBg();
  if(!introDone) buildIntro();
  if(three&&three.renderer){ three.renderer.setPixelRatio(DPR()); resizeThree(); }
  if(!silent) toast(lite?'Lite Mode: меньше частиц, та же вселенная ✦':'Ultra Mode: полная мощность ✦');
}
modeBtn.classList.add('on');
modeBtn.addEventListener('click',()=>{ vib(8); setMode(!state.lite); });
const soundBtn=$('#sound-btn');
soundBtn.addEventListener('click',()=>{
  const on=Sound.toggle(); vib(8);
  soundBtn.classList.toggle('on',on);
  $('#sound-label').textContent=on?'SOUND ON':'SOUND OFF';
  if(on) toast('Звук включён. Мягкий эмбиент для маленькой вселенной ✦');
});
function suggestLite(){
  toast('Похоже, устройство не самое мощное.<br><span style="opacity:.7;font-size:11px">Включить Lite Mode для плавности?</span><div class="t-btns"><button class="t-btn" id="tb-no">ОСТАВИТЬ ULTRA</button><button class="t-btn solid" id="tb-yes">ВКЛЮЧИТЬ LITE</button></div>', true);
  $('#tb-yes').addEventListener('click',()=>{ setMode(true); hideToast(); });
  $('#tb-no').addEventListener('click',()=>{ hideToast(); });
}
let fpsFrames=0,fpsStart=0;
function startFpsWatch(){
  if(weakDevice()){ setTimeout(suggestLite, 2500); return; }
  fpsStart=performance.now(); fpsFrames=0;
  const count=()=>{ fpsFrames++;
    const el=performance.now()-fpsStart;
    if(el<6000) requestAnimationFrame(count);
    else { const fps=fpsFrames/(el/1000);
      if(fps<38 && !state.lite) suggestLite(); }
  };
  requestAnimationFrame(count);
}

/* ═════════════════════ cursor / magnetic / touch ═════════════════════ */
if(!isTouch){
  const dot=$('#cursor .cursor-dot'),glow=$('#cursor .cursor-glow'),ring=$('#cursor .cursor-ring');
  let mx=innerWidth/2,my=innerHeight/2,gx=mx,gy=my,rx=mx,ry=my;
  addEventListener('mousemove',e=>{ mx=e.clientX; my=e.clientY;
    state.par.tx=(e.clientX/innerWidth-.5)*2; state.par.ty=(e.clientY/innerHeight-.5)*2;
    const hot=e.target.closest('button,.word,.door,.portal,.mem-card');
    document.body.classList.toggle('cursor-big',!!hot);
  });
  (function curLoop(){ gx=lerp(gx,mx,.18); gy=lerp(gy,my,.18);
    rx=lerp(rx,mx,.11); ry=lerp(ry,my,.11);
    dot.style.left=mx+'px'; dot.style.top=my+'px';
    glow.style.left=gx+'px'; glow.style.top=gy+'px';
    ring.style.left=rx+'px'; ring.style.top=ry+'px';
    requestAnimationFrame(curLoop); })();
  $$('.magnetic').forEach(b=>{
    b.addEventListener('mousemove',e=>{ const r=b.getBoundingClientRect();
      b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.15}px,${(e.clientY-r.top-r.height/2)*.2}px)`; });
    b.addEventListener('mouseleave',()=> b.style.transform='');
  });
}
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('#toast')) return;
  ripple(e.clientX,e.clientY,false);
  state.touch.x=e.clientX; state.touch.y=e.clientY; state.touch.active=true;
  if(e.pointerType==='touch'){ state.par.tx=(e.clientX/innerWidth-.5)*2; state.par.ty=(e.clientY/innerHeight-.5)*2; }
});
document.addEventListener('pointermove',e=>{
  state.touch.x=e.clientX; state.touch.y=e.clientY;
  if(e.pointerType==='touch'){ state.par.tx=(e.clientX/innerWidth-.5)*2; state.par.ty=(e.clientY/innerHeight-.5)*2; }
},{passive:true});
document.addEventListener('pointerup',()=> state.touch.active=false);
document.addEventListener('pointercancel',()=> state.touch.active=false);
document.addEventListener('contextmenu',e=>{ if(e.target.closest('#app')) e.preventDefault(); });

/* ═════════════════════ intro wiring ═════════════════════ */
$('#open-universe').addEventListener('click',e=>{
  openUniverse(e.clientX||innerWidth/2, e.clientY||innerHeight/2);
});

/* ═════════════════════ resize ═════════════════════ */
addEventListener('resize',()=>{
  buildBg(); resizeThree(); resizeConst(); resizeSky(); resizeSecret();
  if(wordEls.length) wordEls.forEach((w,i)=>{ w.bx=WORD_POS[i][0]/100*innerWidth; w.by=WORD_POS[i][1]/100*innerHeight; });
  if(menuOpen) layoutMenu();
  if(!introDone) buildIntro();
});

/* ═════════════════════ main loop ═════════════════════ */
let last=performance.now()/1000;
function loop(){
  const now=performance.now()/1000;
  const dt=Math.min(now-last,.05); last=now;
  state.par.x=lerp(state.par.x,state.par.tx,.06);
  state.par.y=lerp(state.par.y,state.par.ty,.06);
  updateTweens(now);
  if(!introDone) drawIntro(now);
  else updateBg(now,dt);
  switch(state.page){
    case 'medina': updateThree(now,dt); updateOrb2D(now,dt); break;
    case 'memories': if(!state.lite||Math.floor(now*30)%2===0) memCards.forEach(c=>drawMemCard(c,now)); break;
    case 'constellation': if(!cComplete) drawConst(now); else { cFlash=Math.max(0,cFlash-dt*.3); drawConst(now); } break;
    case 'secret': updateSecret(now,dt); break;
    case 'words': updateWords(now); break;
    case 'sky': updateSky(now,dt); break;
    case 'final': updateFinal(now,dt); break;
  }
  requestAnimationFrame(loop);
}

/* boot */
buildBg(); buildIntro();
pageEl('home').classList.add('active');
resizeConst(); resizeSky(); resizeSecret();
loop();
setTimeout(introReveal, 5400);

})();
