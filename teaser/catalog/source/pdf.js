const { chromium } = require('../cap/node_modules/playwright');
const fitz=null;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--allow-file-access-from-files']});
for(const [mode,w,h] of [['print',1146,817],['screen',1123,794]]){
 for(const idx of [0,1]){
  const p=await b.newPage();await p.goto('file://'+__dirname+'/trifold.html'+(mode==='screen'?'#screen':''));
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(i=>{document.querySelectorAll('.sheet').forEach((s,k)=>{s.style.display=k===i?'flex':'none';s.style.pageBreakAfter='auto';});},idx);
  await p.waitForTimeout(700);
  await p.pdf({path:__dirname+`/_${mode}_${idx}.pdf`,width:w+'px',height:h+'px',printBackground:true,margin:{top:0,right:0,bottom:0,left:0},pageRanges:'1'});
  await p.close();}}
await b.close();})();
