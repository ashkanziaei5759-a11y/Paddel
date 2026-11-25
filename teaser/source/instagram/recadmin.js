const { chromium } = require('playwright');const {record,sleep,B}=require('./rec.js');const {execSync}=require('child_process');
(async()=>{const only=process.argv[2];
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 async function ctxFor(u,pw){execSync(`psql -U postgres -h localhost padel -qc 'delete from rate_limits'`);const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'fa-IR',colorScheme:'dark',isMobile:true,hasTouch:true});await ctx.addInitScript(()=>{const fix=n=>{if(n.nodeType===3){if(n.data.includes('پرشین پدل'))n.data=n.data.replace(/باشگاه پرشین پدل/g,'باشگاه شما').replace(/پرشین پدل/g,'باشگاه');}else n.childNodes&&n.childNodes.forEach(fix)};
 new MutationObserver(ms=>ms.forEach(m=>{m.addedNodes.forEach(fix);if(m.type==='characterData')fix(m.target)})).observe(document,{subtree:true,childList:true,characterData:true});document.addEventListener('DOMContentLoaded',()=>fix(document.body));});
 const p=await ctx.newPage();
  await p.goto(B+'/login');await p.fill('input[name=username]',u);await p.fill('input[type=password]',pw);await p.click('button[type=submit]');await sleep(3500);return p;}
 const F=require('./flows_admin.js');
 const pa=await ctxFor('admin','Admin@12345');const pp=await ctxFor('niloofar','Player@12345');
 for(const [n,f] of Object.entries(F)){if(only&&!only.split(',').includes(n))continue;const p=n.startsWith('a_')?pa:pp;await record(p,n,()=>f(p));}
 await b.close();})();
