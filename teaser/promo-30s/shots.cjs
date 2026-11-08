const { chromium } = require('playwright');
const B='http://127.0.0.1:3000', OUT=process.argv[2];
(async()=>{
 const b=await chromium.launch();
 async function ctxFor(u,p,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:2,locale:'fa-IR',colorScheme:'light'});
  const r=await c.request.post(B+'/api/auth/login',{data:{username:u,password:p},headers:{'x-forwarded-for':'10.8.0.'+Math.floor(Math.random()*200)}});if(r.status()!==200)throw new Error('login '+u+r.status());return c;}
 const phone=await ctxFor('ali','Player@12345',{width:390,height:844});
 for(const path of ['/home','/booking','/matches','/wallet','/notifications','/ranking','/tournaments','/market','/bookings']){
   const pg=await phone.newPage();await pg.goto(B+path,{waitUntil:'networkidle'});await pg.waitForTimeout(1200);
   await pg.screenshot({path:`${OUT}/p${path.replace(/\//g,'_')}.png`});await pg.close();}
 // booking with slot selected
 const pg=await phone.newPage();await pg.goto(B+'/booking',{waitUntil:'networkidle'});await pg.waitForTimeout(800);
 const btn=pg.locator('button:has-text(":")').filter({hasNotText:'رزرو'}).nth(3);
 try{await btn.click({timeout:3000});await pg.waitForTimeout(800);}catch(e){console.log('no slot click',e.message)}
 await pg.screenshot({path:`${OUT}/p_booking_sel.png`});await pg.close();
 const adm=await ctxFor('admin','Admin@12345',{width:390,height:844});
 for(const path of ['/admin/bookings/new','/admin']){const p=await adm.newPage();await p.goto(B+path,{waitUntil:'networkidle'});await p.waitForTimeout(1200);await p.screenshot({path:`${OUT}/a${path.replace(/\//g,'_')}.png`});await p.close();}
 const desk=await ctxFor('admin','Admin@12345',{width:1440,height:900});
 for(const path of ['/admin','/admin/bookings','/admin/finance','/admin/analytics']){const p=await desk.newPage();await p.goto(B+path,{waitUntil:'networkidle'});await p.waitForTimeout(1500);await p.screenshot({path:`${OUT}/d${path.replace(/\//g,'_')}.png`});await p.close();}
 await b.close();})();
