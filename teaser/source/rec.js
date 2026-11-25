const { chromium } = require('playwright');
const fs=require('fs'); const path=require('path'); const {execFileSync}=require('child_process');
const FF='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const OUT=path.join(__dirname,'clips'); fs.mkdirSync(OUT,{recursive:true});
const B='http://localhost:3000';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TOUCH=`(()=>{if(window.__tp)return;window.__tp=1;const st=document.createElement('style');st.textContent='.__t{position:fixed;z-index:999999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.9);pointer-events:none;animation:__t .6s ease-out forwards}@keyframes __t{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.6);opacity:0}}';document.head.appendChild(st);window.__touch=(x,y)=>{const d=document.createElement('div');d.className='__t';d.style.left=x+'px';d.style.top=y+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),700)}})()`;
async function tap(p,loc){await loc.scrollIntoViewIfNeeded(); const b=await loc.boundingBox(); const x=b.x+b.width/2,y=b.y+b.height/2; await p.evaluate(TOUCH); await p.evaluate(([x,y])=>window.__touch(x,y),[x,y]); await sleep(180); await loc.click(); }
async function scrollTo(p,y,ms=1800){await p.evaluate(([y,ms])=>new Promise(res=>{const el=document.scrollingElement;const s=el.scrollTop,t0=performance.now();const e=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;function f(n){const k=Math.min(1,(n-t0)/ms);el.scrollTop=s+(y-s)*e(k);k<1?requestAnimationFrame(f):res()}requestAnimationFrame(f)}),[y,ms]);}
async function record(p,name,fn){
 const dir=path.join(OUT,name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir);
 const cdp=await p.context().newCDPSession(p); const frames=[];
 cdp.on('Page.screencastFrame',async ev=>{frames.push({t:ev.metadata.timestamp,d:ev.data});cdp.send('Page.screencastFrameAck',{sessionId:ev.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,everyNthFrame:1});
 const t0=Date.now()/1000; await fn(); await sleep(400); const t1=Date.now()/1000;
 await cdp.send('Page.stopScreencast');
 let list='ffconcat version 1.0\n';
 frames.sort((a,b)=>a.t-b.t);
 frames.forEach((f,i)=>{const fn=`f${String(i).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(dir,fn),Buffer.from(f.d,'base64'));const dur=(i<frames.length-1?frames[i+1].t:t1)-f.t;list+=`file ${fn}\nduration ${Math.max(dur,0.001).toFixed(4)}\n`;});
 list+=`file f${String(frames.length-1).padStart(5,'0')}.jpg\n`;
 fs.writeFileSync(path.join(dir,'list.txt'),list);
 execFileSync(FF,['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-vf','fps=30,scale=780:1688:flags=lanczos,format=yuv420p','-c:v','libx264','-crf','14','-preset','medium',path.join(OUT,name+'.mp4')]);
 console.log(name,frames.length,'frames',(t1-t0).toFixed(1)+'s');
}
module.exports={record,tap,scrollTo,sleep,B,TOUCH};
if(require.main===module)(async()=>{
 const only=process.argv[2];
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'fa-IR',colorScheme:'dark',isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 // login (recorded as clip)
 await p.goto(B+'/login'); await sleep(1200);
 await record(p,'login',async()=>{await sleep(600);
   await tap(p,p.locator('input').first()); await p.keyboard.type('niloofar',{delay:90});
   await tap(p,p.locator('input[type=password]')); await p.keyboard.type('Player@12345',{delay:60});
   await tap(p,p.locator('button[type=submit]')); await p.waitForURL('**/home',{timeout:20000,waitUntil:'commit'}); await sleep(2200);});
 const flows=require('./flows.js');
 for(const [n,f] of Object.entries(flows)){ if(only&&!only.split(',').includes(n))continue; await record(p,n,()=>f(p)); }
 await b.close();})();
