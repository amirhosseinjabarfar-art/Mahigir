(()=>{
"use strict";
const books=window.MAHIGIR_BOOKS||[];
const money=n=>Number(n||0).toLocaleString("fa-IR")+" تومان";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const legacy=window.MAHIGIR_LEGACY_BOOK_IDS||{};
const read=()=>{
 try{
  const raw=JSON.parse(localStorage.getItem("mh_cart")||"[]");
  const merged=new Map();
  raw.filter(x=>x&&typeof x.id==="string"&&Number(x.qty)>0).forEach(x=>{
   const id=legacy[x.id]||x.id,qty=Math.min(99,Math.floor(Number(x.qty)||1));
   merged.set(id,Math.min(99,(merged.get(id)||0)+qty));
  });
  return [...merged].map(([id,qty])=>({id,qty}));
 }catch{return[]}
};
const save=items=>{
 localStorage.setItem("mh_cart",JSON.stringify(items));
 const count=items.reduce((n,x)=>n+x.qty,0),badge=document.getElementById("cartCount");
 if(badge)badge.textContent=count.toLocaleString("fa-IR");
};
const find=id=>books.find(b=>String(b.id)===String(id));
const available=b=>b&&!b.comingSoon&&Number(b.stock??99)>0;
function renderCart(){
 const host=document.getElementById("cartList"),totalHost=document.getElementById("cartTotal");
 if(!host)return;
 const items=read(),rows=items.map(item=>({item,book:find(item.id)})).filter(x=>available(x.book));
 save(items);
 if(!rows.length){
  host.innerHTML='<div class="empty">سبد خریدت فعلاً خالی است.<br><a class="btn primary" style="margin-top:15px" href="index.html#catalog">رفتن به کتاب‌ها</a></div>';
  totalHost.innerHTML="";
  return;
 }
 const total=rows.reduce((n,x)=>n+x.book.price*x.item.qty,0);
 host.innerHTML=rows.map(x=>'<article class="cart-row"><div><h3>'+esc(x.book.title)+'</h3><small>'+money(x.book.price)+' · '+esc(x.book.category)+'</small></div><div class="cart-controls"><button type="button" data-dec="'+x.book.id+'">−</button><strong>'+x.item.qty.toLocaleString("fa-IR")+'</strong><button type="button" data-inc="'+x.book.id+'">+</button><button type="button" data-remove="'+x.book.id+'" title="حذف">×</button></div></article>').join("");
 totalHost.innerHTML='<div><small>جمع کتاب‌ها · هزینه ارسال تیپاکس در مرحله نهایی اضافه می‌شود</small><strong>'+money(total)+'</strong></div><a class="btn white" href="checkout.html">ادامه و ثبت سفارش ←</a>';
}
function renderDetail(){
 const host=document.getElementById("bookDetail");
 if(!host)return;
 const id=new URLSearchParams(location.search).get("id"),b=find(id);
 if(!b){
  host.innerHTML='<div class="empty">این کتاب پیدا نشد یا دیگر در فروشگاه موجود نیست.<br><a class="btn primary" href="index.html#catalog">بازگشت به کتاب‌ها</a></div>';
  return;
 }
 const soon=!!b.comingSoon||!available(b);
 const cover=b.image_url&&/^https?:\/\//i.test(b.image_url)?'<img src="'+esc(b.image_url)+'" alt="'+esc(b.title)+'" style="width:100%;height:100%;object-fit:contain;border-radius:20px;background:#fff">':'<div class="book-cover" style="height:390px;background:'+esc(b.color)+'"><strong style="font-size:42px">'+esc(b.title)+'<small>ماهیگیر</small></strong></div>';
 host.innerHTML='<div class="detail-layout" style="display:grid;grid-template-columns:minmax(220px,.8fr) 1.2fr;gap:25px;align-items:center"><div>'+cover+'</div><div><span class="eyebrow">MAHIGIR BOOK COLLECTION</span><h2 style="font-size:42px;margin:12px 0">'+esc(b.title)+'</h2><p style="line-height:2;color:var(--muted)">'+esc(b.description)+'</p><p><b>'+esc(b.category)+'</b></p>'+(soon?'<div class="notice">این کتاب فعلاً برای خرید موجود نیست.</div>':'<h3 style="font:900 25px Vazirmatn;color:#16834b">'+money(b.price)+'</h3><p>تعداد موردنظرت را انتخاب کن و به سبد خرید اضافه کن.</p><button class="btn primary" type="button" data-add="'+esc(b.id)+'">افزودن به سبد خرید 🛒</button>')+' <a class="btn white" href="index.html#catalog">بازگشت به کتاب‌ها</a></div></div>';
}
document.addEventListener("click",e=>{
 const add=e.target.closest("[data-add]");
 if(add){
  const b=find(add.dataset.add);
  if(!available(b)){add.disabled=true;return}
  const items=read(),old=items.find(x=>x.id===String(b.id)),qty=old?.qty||0,limit=Math.min(99,Number(b.stock)||99);
  if(qty>=limit){add.textContent="موجودی کافی نیست";return}
  if(old)old.qty++;else items.push({id:String(b.id),qty:1});
  save(items);add.textContent="اضافه شد ✓";setTimeout(()=>{if(add.isConnected)add.textContent="افزودن به سبد خرید 🛒"},1100);
 }
 const inc=e.target.closest("[data-inc]"),dec=e.target.closest("[data-dec]"),rem=e.target.closest("[data-remove]");
 if(inc||dec||rem){
  const button=inc||dec||rem,id=button.dataset.inc||button.dataset.dec||button.dataset.remove,items=read(),item=items.find(x=>x.id===id),book=find(id);
  if(rem)save(items.filter(x=>x.id!==id));
  else if(item){
   const next=item.qty+(inc?1:-1),limit=Math.min(99,Number(book?.stock)||99);
   if(next>limit)return;
   if(next<=0)save(items.filter(x=>x.id!==id));else{item.qty=next;save(items)}
  }
  renderCart();
 }
});
document.addEventListener("DOMContentLoaded",async()=>{
 if(window.MAHIGIR_BOOKS_READY)await window.MAHIGIR_BOOKS_READY;
 save(read());
 renderCart();
 renderDetail();
});
})();