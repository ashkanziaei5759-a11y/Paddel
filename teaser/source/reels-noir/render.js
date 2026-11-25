const { chromium } = require('../cap/node_modules/playwright');
const fs=require('fs'),path=require('path');const D=__dirname;
const CLIPS={};for(const c of fs.readdirSync(path.join(D,'src')))CLIPS[c]=fs.readdirSync(path.join(D,'src',c)).filter(f=>f.endsWith('.jpg')).sort().map(f=>`src/${c}/${f}`);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 await p.goto('file://'+D+'/index.html');await p.evaluate(c=>{window.CLIPS=c},CLIPS);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 const cdp=await p.context().newCDPSession(p);const stills=process.argv[2];const out=path.join(D,stills?'stills':'frames');fs.mkdirSync(out,{recursive:true});
 const DUR=48,times=stills?stills.split(',').map(Number):Array.from({length:DUR*30},(_,i)=>i/30);
 const FROM=+(process.env.FROM||0),TO=+(process.env.TO||1e9);
 let k=0;for(const t of times){if(!stills&&(k<FROM||k>TO)){k++;continue;}await p.evaluate(t=>window.render(t),t);const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:stills?85:95});
  fs.writeFileSync(path.join(out,stills?`t${t}.jpg`:`${String(k).padStart(5,'0')}.jpg`),Buffer.from(r.data,'base64'));k++;if(!stills&&k%300===0)console.log(k);}
 await b.close();})();
