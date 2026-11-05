(function(){
"use strict";
const PROJECT_URL="https://drwydadydhkdkrcdndrq.supabase.co";
const PUBLIC_KEY="sb_publishable_gd2B7ZWcbE1x6yo-JedAeQ_LTcK7dVk";
const colors=[
 "linear-gradient(145deg,#f77991,#7650dc 60%,#294f91)",
 "linear-gradient(145deg,#25365d,#6d79c9,#d58ac2)",
 "linear-gradient(145deg,#c66d54,#e5a36d,#6e477b)",
 "linear-gradient(145deg,#265e69,#5c9c90,#d6b87d)",
 "linear-gradient(145deg,#203c65,#467d9a,#d7a66b)",
 "linear-gradient(145deg,#263c4c,#568a87,#c7a36a)",
 "linear-gradient(145deg,#513d83,#8667bd,#e2ad7b)",
 "linear-gradient(145deg,#242c59,#7655b7,#e58db8)"
];
const fallback=[
 {id:"ab85e2c3-8032-45d9-b826-c182966f1642",title:"دوتا خفن",price:200000,category:"ماجراجویی",description:"کتاب دوتا خفن از انتشارات ماهیگیر",stock:100,color:colors[0]},
 {id:"b5209694-c890-4c43-a636-dde1720b309a",title:"شب‌های زکی‌آباد",price:190000,category:"داستانی",description:"کتاب شب‌های زکی‌آباد از انتشارات ماهیگیر",stock:100,color:colors[1]},
 {id:"2a0eb094-1c09-4e9e-b616-bde11a88a7f0",title:"دختر دارچینی",price:200000,category:"داستانی",description:"کتاب دختر دارچینی",stock:100,color:colors[2]},
 {id:"274e3312-3604-4139-89e1-64ed98a7de18",title:"جشنواره حسن",price:250000,category:"متفرقه",description:"کتاب جشنواره حسن",stock:100,color:colors[3]},
 {id:"1afe6a90-1c40-44bc-8a75-5de4791e0d4d",title:"ادوارد مونک",price:50000,category:"متفرقه",description:"کتاب ادوارد مونک",stock:100,color:colors[4]},
 {id:"074eb2bd-8cd7-40e2-a380-fdca1f2c4f00",title:"غواصان چرنوبیل",price:50000,category:"داستانی",description:"کتاب غواصان چرنوبیل",stock:6,color:colors[5]},
 {id:"ca5a991c-b93d-4a09-8df1-da3fb06950e8",title:"ارنو روبیک",price:50000,category:"متفرقه",description:"کتاب ارنو روبیک",stock:100,color:colors[6]},
 {id:"b58f08a1-690d-4c1a-b064-bd6d0105ad08",title:"دوتا خفن ۲",price:0,category:"ماجراجویی",description:"کتاب دوتا خفن ۲ در آینده منتشر می‌شود.",stock:0,color:colors[7],comingSoon:true}
];
const extraSoon={id:"amme-shorte-baba",title:"عمه‌ام و شورت بابام",price:0,category:"طنز",description:"یک عنوان طنز که به‌زودی به فروشگاه ماهیگیر اضافه می‌شود.",stock:0,color:"linear-gradient(145deg,#e8a23c,#d64d75,#7655b7)",comingSoon:true};
const legacy={
 "dota-khafe":"ab85e2c3-8032-45d9-b826-c182966f1642",
 "shabhaye-zakiabad":"b5209694-c890-4c43-a636-dde1720b309a",
 "dokhtar-darchini":"2a0eb094-1c09-4e9e-b616-bde11a88a7f0",
 "jashnvare-hasan":"274e3312-3604-4139-89e1-64ed98a7de18",
 "edvard-munk":"1afe6a90-1c40-44bc-8a75-5de4791e0d4d",
 "ghavvasan-chernobyl":"074eb2bd-8cd7-40e2-a380-fdca1f2c4f00",
 "arno-rubik":"ca5a991c-b93d-4a09-8df1-da3fb06950e8",
 "dota-khafe-2":"b58f08a1-690d-4c1a-b064-bd6d0105ad08"
};
window.MAHIGIR_LEGACY_BOOK_IDS=legacy;
window.MAHIGIR_BOOKS=fallback;
window.MAHIGIR_BOOKS_READY=(async()=>{
 try{
  if(!window.supabase?.createClient)return window.MAHIGIR_BOOKS;
  const client=window.supabase.createClient(PROJECT_URL,PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await client.from("mahigir_books").select("id,title,description,price,image_url,category,is_coming_soon,is_active,stock,sort_order").eq("is_active",true).order("sort_order");
  if(error)throw error;
  if(Array.isArray(data)&&data.length){
   const categoryById=new Map(fallback.map(b=>[b.id,b.category]));
   const mapped=data.map((b,i)=>({...b,id:String(b.id),price:Number(b.price)||0,stock:Number(b.stock)||0,category:categoryById.get(String(b.id))||b.category||"متفرقه",color:colors[i%colors.length],comingSoon:!!b.is_coming_soon}));
   const extra=mapped.some(b=>b.title===extraSoon.title)?[]:[extraSoon];
   window.MAHIGIR_BOOKS.splice(0,window.MAHIGIR_BOOKS.length,...mapped,...extra);
  }
 }catch(error){console.warn("Mahigir catalogue fallback is active:",error)}
 return window.MAHIGIR_BOOKS;
})();
})();