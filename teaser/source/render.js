const { chromium } = require('../cap/node_modules/playwright');
const fs=require('fs'),path=require('path');
const D=__dirname;
const seg=(c,...r)=>r.flatMap(([a,b])=>Array.from({length:b-a},(_,i)=>`src/${c}/${String(a+i+1).padStart(4,'0')}.jpg`));
const T={f0:[12.05,16.05],f1:[16.05,24.05],f2:[24.05,30.05],f3:[30.05,36.05],f4:[36.05,42.05],f5:[42.05,48.05]};
const SRC={f0:seg('home',[30,230]),f1:seg('booking',[30,438]),f2:seg('matches',[20,314]),f3:seg('tournaments',[20,274]),f4:seg('ranking',[20,275]),f5:seg('wallet',[20,108],[196,302])};
const CLIPS={};for(const k in T){const n=Math.round((T[k][1]-T[k][0])*30)+2;const s=SRC[k];CLIPS[k]=Array.from({length:n},(_,i)=>s[Math.min(s.length-1,Math.floor(i*s.length/n))]);}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+D+'/index.html'); await p.evaluate(c=>{window.CLIPS=c},CLIPS); await p.evaluate(()=>document.fonts.ready);
 const cdp=await p.context().newCDPSession(p);
 const stills=process.argv[2]; const out=path.join(D,stills?'stills':'frames'); fs.mkdirSync(out,{recursive:true});
 const times=stills?stills.split(',').map(Number):Array.from({length:Math.round(55.5*30)},(_,i)=>i/30);
 let k=0;for(const t of times){await p.evaluate(t=>window.render(t),t);
  const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:stills?85:95});
  fs.writeFileSync(path.join(out,stills?`t${t}.jpg`:`${String(k).padStart(5,'0')}.jpg`),Buffer.from(r.data,'base64'));k++;
  if(!stills&&k%150===0)console.log(k);}
 await b.close();})();
