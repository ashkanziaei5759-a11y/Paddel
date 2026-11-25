const { chromium } = require('../cap/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--allow-file-access-from-files']});
 // cover only
 let p=await b.newPage();await p.goto('file://'+__dirname+'/guide.html');await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>{document.querySelectorAll('body>section').forEach((s,i)=>{if(i>0)s.remove();});const st=document.createElement('style');st.textContent='@page{size:A4;margin:0}';document.head.appendChild(st);});
 await p.waitForTimeout(500);
 await p.pdf({path:__dirname+'/_cover.pdf',format:'A4',printBackground:true,margin:{top:0,right:0,bottom:0,left:0},pageRanges:'1'});await p.close();
 // body
 p=await b.newPage();await p.goto('file://'+__dirname+'/guide.html');await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>{document.querySelector('.cover').remove();const t=document.querySelector('body>section');t.style.pageBreakBefore='auto';const st=document.createElement('style');st.textContent='@page:first{margin:18mm 17mm 20mm 17mm}';document.head.appendChild(st);});
 await p.waitForTimeout(500);
 await p.pdf({path:__dirname+'/_body.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,
  headerTemplate:'<div></div>',
  footerTemplate:'<div style="width:100%;font-size:8px;color:#8a97a6;padding:0 17mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>App-e Hooshmand-e Zamin-e Padel — Windows Server Setup Guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
 await p.close();await b.close();})();
