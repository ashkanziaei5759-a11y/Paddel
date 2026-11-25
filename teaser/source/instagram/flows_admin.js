const {tap,scrollTo,sleep,B}=require('./rec.js');
module.exports={
 a_dash: async p=>{await p.goto(B+'/admin');await sleep(2200);await scrollTo(p,520,2200);await sleep(700);await scrollTo(p,1150,2200);await sleep(900);},
 a_finance: async p=>{await p.goto(B+'/admin/finance');await sleep(2000);await scrollTo(p,700,2600);await sleep(1000);},
 a_bookings: async p=>{await p.goto(B+'/admin/bookings');await sleep(2000);await scrollTo(p,380,1600);await sleep(500);await scrollTo(p,1300,2600);await sleep(800);},
 a_courts: async p=>{await p.goto(B+'/admin/courts');await sleep(1800);await tap(p,p.getByText('زمین ۱',{exact:true}).first());await sleep(2200);await scrollTo(p,650,2200);await sleep(1000);},
 a_store: async p=>{await p.goto(B+'/admin/store');await sleep(1800);await scrollTo(p,500,1800);await sleep(500);await scrollTo(p,0,1000);await tap(p,p.getByText(/سفارش‌ها/).first());await sleep(1600);await scrollTo(p,500,1800);await sleep(800);},
 a_notify: async p=>{await p.goto(B+'/admin/notifications');await sleep(1600);await tap(p,p.getByRole('button',{name:/همه‌ی بازیکنان/}));await sleep(700);
   const t=p.getByPlaceholder(/تعطیلی باشگاه/);await tap(p,t);await t.pressSequentially('۲۰٪ تخفیف سانس‌های صبح',{delay:70});
   const m=p.getByPlaceholder(/متن کامل/);await tap(p,m);await m.pressSequentially('فقط تا پایان هفته، سانس‌های ۱۰ تا ۱۴ با تخفیف ویژه.',{delay:45});await sleep(1200);},
 a_brand: async p=>{await p.goto(B+'/admin/branding');await sleep(1800);await scrollTo(p,600,2400);await sleep(800);},
 market: async p=>{await p.goto(B+'/market');await sleep(2000);await scrollTo(p,600,2400);await sleep(600);await scrollTo(p,0,1400);await sleep(500);},
};
