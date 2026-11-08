import { execSync } from 'node:child_process';
const B='http://127.0.0.1:3000';
const sql=(q)=>execSync(`psql -h localhost -U postgres -d padel -Atc "${q.replace(/"/g,'\\"')}"`).toString().trim();
let n=1; const ip=()=>`10.9.0.${n++}`;
const ck=(r)=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function api(c,p,m='GET',b){const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json','x-forwarded-for':ip(),...(c?{cookie:c}:{})},body:b?JSON.stringify(b):undefined});let j=null;try{j=await r.json()}catch{};return {s:r.status,j,r};}
const login=async(u,p)=>ck((await api(null,'/api/auth/login','POST',{username:u,password:p})).r);
const day=(d)=>new Date(Date.now()+3.5*3600e3+d*86400e3).toISOString().slice(0,10);
sql(`update wallets set balance=25000000`);
const users=['ali','sara','reza','niloofar','mohammad','mina'];
const C={}; for(const u of users) C[u]=await login(u,'Player@12345');
const admin=await login('admin','Admin@12345');
let made=[];
for(const [i,u] of users.entries()){
  const av=await api(C[u],`/api/bookings/availability?date=${day(1+(i%3))}`);
  const court=av.j.data.courts[i%av.j.data.courts.length];
  const free=court.slots.filter(s=>s.available);
  const slot=free[Math.min(free.length-1, 4+i)];
  const bk=await api(C[u],'/api/bookings','POST',{courtId:court.court.id,slots:[slot.startsAt]});
  made.push([u,bk.s]);
  if(bk.s===201 && i<3){const m=await api(C[u],'/api/matches','POST',{bookingId:bk.j.data.id,capacity:4});made.push(['match',m.s,m.j?.error]);}
}
console.log(JSON.stringify(made));
const bc=await api(admin,'/api/admin/notifications','POST',{audience:'ALL_PLAYERS',title:'تورنومنت پاییزه پرشین پدل',body:'ثبت‌نام تورنومنت دونفره باز شد؛ ظرفیت محدود است.'});
console.log('broadcast',bc.s);
