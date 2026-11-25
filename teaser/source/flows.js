const {tap,scrollTo,sleep,B}=require('./rec.js');
module.exports={
 home: async p=>{await p.goto(B+'/home');await sleep(2500);await scrollTo(p,700,2600);await sleep(900);await scrollTo(p,1500,2400);await sleep(1000);await scrollTo(p,0,1800);await sleep(600);},
 booking: async p=>{await p.goto(B+'/booking');await sleep(1800);
   await tap(p,p.getByRole('button',{name:'۶',exact:true}).first());await sleep(1600);
   await tap(p,p.locator('button[aria-pressed]',{hasText:'۱۹:۰۰'}));await sleep(700);await tap(p,p.locator('button[aria-pressed]',{hasText:'۲۰:۳۰'}));await sleep(900);
   await tap(p,p.getByRole('button',{name:/انتخاب زمین/}));await sleep(1300);
   await tap(p,p.locator('button[aria-pressed]',{hasText:'زمین ۲'}));await sleep(900);
   await tap(p,p.getByRole('button',{name:/ادامه و پرداخت/}));await sleep(1500);
   await tap(p,p.getByRole('button',{name:/پرداخت و تأیید رزرو/}));await sleep(3500);},
 matches: async p=>{await p.goto(B+'/matches');await sleep(2200);await scrollTo(p,450,2200);await sleep(700);await scrollTo(p,0,1500);await sleep(500);
   await tap(p,p.getByRole('button',{name:/پیوستن/}).first());await sleep(2500);},
 tournaments: async p=>{await p.goto(B+'/tournaments');await sleep(1800);
   await tap(p,p.getByText('جام تابستانه پرشین پدل').first());await sleep(2500);await scrollTo(p,900,2800);await sleep(1200);},
 ranking: async p=>{await p.goto(B+'/ranking');await sleep(2000);await scrollTo(p,600,2200);await sleep(600);await scrollTo(p,0,1500);
   await tap(p,p.getByRole('button',{name:'زنان',exact:true}).or(p.getByRole('tab',{name:'زنان'})).first());await sleep(2000);},
 wallet: async p=>{await p.goto(B+'/wallet');await sleep(1800);
   await tap(p,p.getByRole('button',{name:/۱.۰۰۰.۰۰۰/}).first());await sleep(900);
   await tap(p,p.getByRole('button',{name:/پرداخت/}).last());await sleep(2500);
   await tap(p,p.getByRole('button',{name:'پرداخت موفق'}));await sleep(3500);},
};
