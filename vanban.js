/* ===================== VĂN BẢN PHÁP LUẬT – tra cứu Luật, Nghị định, Thông tư =====================
   Nạp khi bấm ô ⚖️ (index.html → vbHome). Dùng các hàm chung của index.html: el, show, $, boot, thongBao, msgCard, retry, errMsg.
   - Dữ liệu: thư mục vanban/ của ứng dụng (ds.json + <mã>.json), tạo bằng KiemThu/vanban/chuyen_vb.py từ file Word.
     Service worker lưu vào bộ nhớ riêng 'qlct-vanban' → mất sóng vẫn đọc, tìm được. ?moi=<bản> bắt tải lại khi văn bản được cập nhật.
   - Mỗi văn bản: mục lục Chương/Mục/Điều, ô "Điều số" nhảy nhanh, liên kết dẫn chiếu (điểm/khoản/Điều, Mẫu số, Phụ lục) nhảy thẳng tới đích
     (kể cả sang văn bản khác), nút ↩ quay lại chỗ đang đọc, chú thích [n] của văn bản hợp nhất, tìm kiếm (có dấu/không dấu),
     chạm vào một khoản/điểm → chép trích dẫn (VD "điểm b khoản 3 Điều 20 Nghị định số 146/2026/NĐ-CP"). */
(function(){
'use strict';
var VB=window.VB={};
var DS=null,KHO={},DANG_TAI={},CHUA=null;
var NGAN=[],TIM_CU='';          // ngăn xếp vị trí trước khi nhảy theo liên kết: {ma, y}
var MO=null;          // văn bản đang mở: {ma, goc (khung nội dung), tb (thanh công cụ)}
var LOP=null;         // lớp phủ đang mở (mục lục / tìm kiếm / chú thích)
var KB='qlct_vb_ban'; // {mã: bản đã lưu trên máy}

/* ---------- 1. GIAO DIỆN (CSS) ---------- */
function css(){
  if($('vb-css'))return;
  var s=document.createElement('style');s.id='vb-css';
  s.textContent=[
  '.vbtb{position:sticky;z-index:4;background:var(--bg);padding:6px 0 8px;display:flex;gap:6px;align-items:center}',
  '.vbtb button{padding:8px 10px;white-space:nowrap}.vbtb input{width:64px;text-align:center;padding:8px 4px}',
  '.vbtb .tt{flex:1;min-width:0;font-size:13px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.vbd{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px 40px;font-family:"Times New Roman",Times,"Noto Serif","Liberation Serif",serif;font-size:19px;line-height:1.5;overflow-wrap:anywhere}',
  '.vbd p{margin:7px 0}.vbd p.dm{padding-left:14px}.vbd p.g{padding-left:24px}',
  '.vbd p.qt{font-style:italic;padding-left:12px;border-left:3px solid #e1e8e4;color:#333}',
  '.vbd p.gc,.vbd p.pl.gc{text-align:center;font-style:italic;color:#444}',
  '.vbd .vhd{text-align:center;margin:6px 0 14px}.vbd .vhd .l{font-weight:bold;font-size:20px;color:var(--g)}.vbd .vhd .s{font-size:16px;color:#333}',
  '.vbd h3.vc{text-align:center;font-size:19px;margin:26px 0 8px;color:var(--g);line-height:1.35}',
  '.vbd h4.vm{text-align:center;font-size:18px;margin:18px 0 8px;line-height:1.35}',
  '.vbd .vdt{font-size:19px;margin:20px 0 6px;color:#123d27;font-weight:bold}',
  '.vbd a[data-r]{color:#0b5cad;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer}',
  '.vbd a[data-r].kh{color:#7a3ea1}.vbd a[data-r].kh:after{content:"↗";font-size:12px;vertical-align:super}',
  '.vbd sup[data-fn],.vbfn sup[data-fn]{color:#b35c00;cursor:pointer;font-size:12px;padding:0 3px;font-family:Arial,sans-serif;font-weight:bold}',
  '.vbd .tb{overflow-x:auto;margin:10px 0;-webkit-overflow-scrolling:touch}.vbd table{border-collapse:collapse;font-size:14px;line-height:1.35}',
  '.vbd td{border:1px solid #cfd8d3;padding:4px 6px;vertical-align:top;min-width:40px}',
  '.vbd details.md summary{cursor:pointer;color:var(--mut);font-family:Arial,sans-serif;font-size:15px;padding:6px 0}',
  '.vbd .vpl{border-top:3px double #b9c7bf;margin-top:26px;padding-top:6px}',
  '.vbd .vms{border-top:1px dashed #b9c7bf;margin-top:22px}',
  '.vbd .vms>.vdt{color:#5a3d00}',
  '.vflash{animation:vfl 2.8s ease-out}@keyframes vfl{0%,25%{background:#ffe27a}100%{background:transparent}}',
  'mark.vh{background:#fff0a0;color:inherit;padding:0}',
  '.vbve{position:fixed;left:12px;bottom:18px;z-index:20;background:var(--g);color:#fff;border:none;border-radius:24px;padding:11px 18px;box-shadow:0 3px 10px rgba(0,0,0,.3);font-size:16px}',
  '.vbov{position:fixed;inset:0;z-index:30;background:#fff;display:flex;flex-direction:column}',
  '.vbov .h{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--g);color:#fff}',
  '.vbov .h b{flex:1;font-size:17px}.vbov .h button{padding:6px 14px}',
  '.vbov .h2{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line)}.vbov .h2 input{flex:1}',
  '.vbov .b{flex:1;overflow:auto;padding:4px 12px 30px;-webkit-overflow-scrolling:touch}',
  '.ml-c{font-weight:bold;color:var(--g);margin:14px 0 4px;font-size:15px}.ml-m{font-weight:bold;margin:10px 0 2px 6px;font-size:14px;color:#33443b}',
  '.ml-d{padding:9px 4px;border-bottom:1px solid #eef2f0;cursor:pointer;font-size:15px}.ml-d b{color:var(--g)}.ml-d.cur{background:#e6f2ea}',
  '.ml-d.pl{color:#5a3d00}.ml-d.pl b{color:#5a3d00}.ml-d.ms{padding-left:18px}',
  '.vbfn{position:fixed;left:0;right:0;bottom:0;max-height:62vh;overflow:auto;background:#fffdf5;border-top:3px solid #e0c070;z-index:25;padding:10px 14px 20px;box-shadow:0 -4px 14px rgba(0,0,0,.18);font-family:"Times New Roman",serif;font-size:17px;line-height:1.45}',
  '.vbfn .x{float:right;font-family:Arial,sans-serif;font-size:14px;padding:4px 12px;margin:0 0 6px 8px}',
  '.vbfn a[data-r]{color:#0b5cad;text-decoration:underline;cursor:pointer}',
  '.vbtrich{position:fixed;left:10px;right:10px;bottom:14px;z-index:22;background:#1d2b24;color:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:8px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.35);font-size:14px}',
  '.vbtrich span{flex:1}.vbtrich button{padding:7px 12px;font-size:14px}',
  '.vbit{border:1px solid var(--line);border-left:5px solid var(--g2);border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#fff;cursor:pointer}',
  '.vbit .so{font-weight:bold;color:var(--g)}.vbit .tm{font-size:15px;margin-top:2px}.vbit .ng{font-size:13px;color:var(--mut);margin-top:3px}',
  '.vbit .pl{margin-top:8px;padding-top:7px;border-top:1px dashed var(--line);font-size:15px;color:#5a3d00}',
  '.vbkq{padding:9px 2px;border-bottom:1px solid #eef2f0;cursor:pointer}.vbkq .w{font-size:13px;color:var(--g);font-weight:bold}',
  '.vbkq .n{font-size:15px;margin-top:2px;font-family:"Times New Roman",serif}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ---------- 2. DỮ LIỆU ---------- */
function banDaLuu(){try{return JSON.parse(localStorage.getItem(KB)||'{}')||{}}catch(e){return {}}}
function ghiBan(ma,b){var o=banDaLuu();o[ma]=b;try{localStorage.setItem(KB,JSON.stringify(o))}catch(e){}}
function taiDs(){
  return fetch('vanban/ds.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(d){DS=d.vb||[];return DS});
}
function muc(ma){return (DS||[]).filter(function(x){return x.ma===ma})[0]}
function taiVb(ma){
  if(KHO[ma])return Promise.resolve(KHO[ma]);
  if(DANG_TAI[ma])return DANG_TAI[ma];
  var m=muc(ma);if(!m)return Promise.reject(new Error('Không có văn bản '+ma));
  var cu=banDaLuu()[ma],url='vanban/'+ma+'.json'+(cu!==m.ban?'?moi='+m.ban:'');
  var p=fetch(url,{cache:cu!==m.ban?'no-cache':'default'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(d){KHO[ma]=d;ghiBan(ma,m.ban);CHUA=null;delete DANG_TAI[ma];return d})
    .catch(function(e){delete DANG_TAI[ma];throw e});
  DANG_TAI[ma]=p;return p;
}
/* tải hết (để tìm kiếm & dùng khi mất sóng); fn(xong, tổng) báo tiến độ */
function taiHet(fn){
  var ds=(DS||[]).map(function(x){return x.ma}),xong=0,loi=0;
  var buoc=function(i){
    if(i>=ds.length)return Promise.resolve({xong:xong,loi:loi});
    return taiVb(ds[i]).then(function(){xong++},function(){loi++}).then(function(){if(fn)fn(xong,ds.length,loi);return buoc(i+1)});
  };
  return buoc(0);
}
function tenDayDu(d){return d.loai==='Luật'?d.ten:(d.loai==='Phụ lục'?d.ten:d.loai+' số '+d.so)}
function tenNgan(d){return d.loai==='Luật'?d.ten:d.ten}

/* mã định vị → lời trích dẫn: d20k3-b → "điểm b khoản 3 Điều 20"; d20k1a → "khoản 1a Điều 20" */
function loiTrich(id){
  var m=/^d(\d+[a-z]?)(?:k(\d+[a-z]?)(?:-(dd|[a-z]))?)?$/.exec(id||'');
  if(!m){var p=/^(?:pl([IVXLC]+[A-Z]?)-?)?(?:m(\d+\w*))?$/.exec(id||'');
    if(p&&(p[1]||p[2]))return (p[2]?'Mẫu số '+p[2].replace(/-\d+$/,'')+(p[1]?' ':''):'')+(p[1]?'Phụ lục '+p[1]:'');return ''}
  var s='Điều '+m[1];
  if(m[2]&&m[2]!=='0')s='khoản '+m[2]+' '+s;
  if(m[3])s='điểm '+(m[3]==='dd'?'đ':m[3])+' '+s;
  return s;
}

/* ---------- 3. MÀN DANH SÁCH VĂN BẢN ---------- */
VB.mo=function(){
  css();dongLop();NGAN=[];MO=null;
  show([msgCard('Đang mở kho văn bản…')],boot);
  taiDs().then(manDs).catch(function(e){
    show([msgCard('Không tải được danh sách văn bản ('+errMsg(e)+'). Lần mở đầu tiên cần có mạng.',true,[retry(VB.mo)])],boot);
  });
};
function manDs(){
  var o=banDaLuu(),daLuu=DS.filter(function(x){return o[x.ma]===x.ban}).length;
  var tt=el('div',{class:'hint'});
  var capTt=function(x,n,loi){tt.textContent=x>=n?('💾 Đã lưu đủ '+n+' văn bản trên máy – dùng được khi mất sóng.'):('⏳ Đang lưu văn bản về máy '+x+'/'+n+(loi?' (lỗi '+loi+')':'')+'…')};
  capTt(daLuu,DS.length);
  var o1=el('input',{type:'search',placeholder:'🔍 Tìm trong tất cả văn bản (VD: khai thác gỗ, vận chuyển)…',autocomplete:'off'});
  o1.value=TIM_CU;o1.style.width='100%';
  var kq=el('div',{});
  var ds=el('div',{});
  var hen=null;
  o1.addEventListener('input',function(){clearTimeout(hen);hen=setTimeout(function(){
    var q=o1.value.trim();TIM_CU=q;
    if(q.length<2){kq.innerHTML='';ds.style.display='';return}
    ds.style.display='none';veKetQua(kq,timKiem(q,null),q,null);
  },350)});
  // nhóm: Luật / Nghị định / Thông tư; phụ lục nằm dưới văn bản chính
  var nhom={};DS.forEach(function(d){if(!d.cha)(nhom[d.nhom]=nhom[d.nhom]||[]).push(d)});
  Object.keys(nhom).forEach(function(g){
    ds.appendChild(el('div',{class:'gt',text:g}));
    nhom[g].forEach(function(d){
      var con=DS.filter(function(x){return x.cha===d.ma});
      var kids=[el('div',{class:'so',text:tenNgan(d)}),el('div',{class:'tm',text:d.tom}),el('div',{class:'ng',text:'Ngày ban hành: '+d.ngay})];
      con.forEach(function(c){kids.push(el('div',{class:'pl',text:'📎 '+c.ten+' – '+c.tom,onclick:function(e){e.stopPropagation();VB.doc(c.ma)}}))});
      ds.appendChild(el('div',{class:'vbit',onclick:function(){VB.doc(d.ma)}},kids));
    });
  });
  show([el('div',{class:'card'},[el('div',{class:'hello',text:'⚖️ Văn bản pháp luật'}),
      el('div',{class:'mut',text:'Chạm vào văn bản để đọc. Trong văn bản: ☰ mục lục, ô "Điều" để nhảy nhanh, chạm chữ xanh để tới điểm/khoản/Điều được dẫn chiếu.'}),
      el('div',{style:'margin-top:10px'},[o1]),tt]),kq,ds],boot);
  if(TIM_CU.length>=2)o1.dispatchEvent(new Event('input'));
  if(daLuu<DS.length||Object.keys(KHO).length<DS.length)taiHet(function(x,n,loi){capTt(x,n,loi);if(o1.value.trim().length>=2&&kq.isConnected)veKetQua(kq,timKiem(o1.value.trim(),null),o1.value.trim(),null)});
}

/* ---------- 4. TÌM KIẾM ---------- */
function boDau(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D')}
function coDau(s){return boDau(s)!==s}
function chuThuong(s){return s.normalize('NFC').toLowerCase()}
/* chỉ mục: mỗi đoạn một dòng {ma, nut (mã Điều/phụ lục), id (đoạn), nhan, t, k (không dấu)} */
function chiMuc(){
  if(CHUA&&CHUA.n===Object.keys(KHO).length)return CHUA.ds;
  var ds=[],tam=document.createElement('div');
  (DS||[]).forEach(function(m){var d=KHO[m.ma];if(!d)return;
    d.n.forEach(function(n){
      var nhan=nhanNut(n);
      if(n.t){var t0=chuThuong(boThe(n.t));ds.push({ma:d.ma,nut:n.i,id:n.i,nhan:nhan,t:t0,k:boDau(t0),goc:boThe(n.t)})}
      if(!n.h)return;
      tam.innerHTML=n.h;
      [].forEach.call(tam.querySelectorAll('p,td'),function(p){
        if(p.tagName==='TD'&&p.querySelector('p'))return;
        var c=p.cloneNode(true);[].forEach.call(c.querySelectorAll('sup'),function(x){x.remove()});
        var g=c.textContent.replace(/\s+/g,' ').trim();if(!g)return;var t=chuThuong(g);
        ds.push({ma:d.ma,nut:n.i,id:p.id||n.i,nhan:nhan,t:t,k:boDau(t),goc:g});
      });
    });
  });
  CHUA={n:Object.keys(KHO).length,ds:ds};return ds;
}
function boThe(h){return String(h).replace(/<sup[^>]*>.*?<\/sup>/g,'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function nhanNut(n){
  if(n.l==='D')return 'Điều '+n.so+'. '+boThe(n.t||'');
  if(n.l==='P')return 'Phụ lục '+(n.so||'')+(n.t?' – '+boThe(n.t):'');
  if(n.l==='MS')return 'Mẫu số '+n.so+(n.t?' – '+boThe(n.t):'');
  if(n.l==='C')return 'Chương '+n.so+(n.t?' – '+boThe(n.t):'');
  if(n.l==='M')return 'Mục '+n.so+(n.t?' – '+boThe(n.t):'');
  return 'Phần mở đầu';
}
function timKiem(q,ma){
  var qq=chuThuong(q).trim(),khong=!coDau(qq),tu=qq.split(/\s+/).filter(Boolean);
  if(khong)tu=tu.map(boDau);
  var out=[];
  chiMuc().forEach(function(r){
    if(ma&&r.ma!==ma)return;
    var s=khong?r.k:r.t;
    // cụm nguyên văn trước, rồi đủ các từ
    var diem=s.indexOf(khong?boDau(qq):qq)>=0?2:(tu.every(function(w){return s.indexOf(w)>=0})?1:0);
    if(diem)out.push({r:r,d:diem});
  });
  out.sort(function(a,b){return b.d-a.d});
  return {ds:out,tu:tu,khong:khong,qq:khong?boDau(qq):qq};
}
function doanTrich(goc,kq){
  var s=kq.khong?boDau(chuThuong(goc)):chuThuong(goc),i=s.indexOf(kq.qq);
  if(i<0)i=Math.max(0,s.indexOf(kq.tu[0]));
  var a=Math.max(0,i-60),b=Math.min(goc.length,i+160);
  return (a>0?'…':'')+goc.slice(a,b)+(b<goc.length?'…':'');
}
function toSang(node,kq){
  // tô các từ tìm thấy trong một đoạn chữ (theo vị trí trên chuỗi đã chuẩn hóa – cùng độ dài với chuỗi gốc NFC)
  var g=node.textContent.normalize('NFC'),s=kq.khong?boDau(g.toLowerCase()):g.toLowerCase();
  var vung=[];(kq.d===2||kq.tu.length<2?[kq.qq]:kq.tu).forEach(function(w){if(!w)return;var i=0;while((i=s.indexOf(w,i))>=0){vung.push([i,i+w.length]);i+=w.length}});
  if(!vung.length||s.length!==g.length){node.textContent=g;return}
  vung.sort(function(a,b){return a[0]-b[0]});
  node.innerHTML='';var p=0;
  vung.forEach(function(v){if(v[0]<p)return;node.appendChild(document.createTextNode(g.slice(p,v[0])));node.appendChild(el('mark',{class:'vh',text:g.slice(v[0],v[1])}));p=v[1]});
  node.appendChild(document.createTextNode(g.slice(p)));
}
function veKetQua(hop,kq,q,maHienTai){
  hop.innerHTML='';
  var n=kq.ds.length,toiDa=200;
  var tongVb=(DS||[]).length,daTai=Object.keys(KHO).length;
  hop.appendChild(el('div',{class:'hint',text:(n?('Tìm thấy '+n+' đoạn'+(n>toiDa?' (hiện '+toiDa+' đoạn đầu)':'')):'Không tìm thấy “'+q+'”.')+(maHienTai?'':(daTai<tongVb?' – mới tìm trong '+daTai+'/'+tongVb+' văn bản đã tải.':''))+(kq.khong?' Tìm không dấu.':'')}));
  var tenCu='';
  kq.ds.slice(0,toiDa).forEach(function(x){
    var r=x.r,d=KHO[r.ma];
    if(!maHienTai&&r.ma!==tenCu){tenCu=r.ma;hop.appendChild(el('div',{class:'gt',text:tenNgan(d)}))}
    var tr=loiTrich(r.id),nhan=r.nhan+(tr&&r.id!==r.nut?' – '+tr.split(' Điều')[0]:'');
    var dn=el('div',{class:'n',text:doanTrich(r.goc,kq)});toSang(dn,{khong:kq.khong,qq:kq.qq,tu:kq.tu,d:x.d});
    hop.appendChild(el('div',{class:'vbkq',onclick:function(){dongLop();if(MO&&MO.goc.isConnected)ghiViTri();VB.doc(r.ma,r.id,{tim:kq,d:x.d})}},[el('div',{class:'w',text:nhan}),dn]));
  });
}

/* ---------- 5. ĐỌC VĂN BẢN ---------- */
/* opt: {tim: kết quả tìm kiếm để tô, y: vị trí cuộn (khi quay lại), giu: không ghi vị trí cũ} */
VB.doc=function(ma,id,opt){
  css();opt=opt||{};
  var mo=function(){
    if(KHO[ma])return Promise.resolve(KHO[ma]);
    show([msgCard('Đang mở văn bản…')],quayLai);
    return taiVb(ma);
  };
  (DS?Promise.resolve():taiDs()).then(mo).then(function(d){manDoc(d,id,opt)}).catch(function(e){
    show([msgCard('Không mở được văn bản ('+errMsg(e)+'). Lần mở đầu tiên cần có mạng.',true,[retry(function(){VB.doc(ma,id,opt)})])],quayLai);
  });
};
function quayLai(){
  var f=$('vb-fn');if(f){f.remove();return}
  if(LOP){dongLop();return}
  if(NGAN.length){veViTri(NGAN.pop());return}
  VB.mo();
}
/* vị trí đang đọc = đoạn đầu tiên còn thấy dưới thanh công cụ + độ lệch (không dùng số pixel cuộn: trang dựng dần nên chiều cao thay đổi) */
function viTri(){
  if(!MO||!MO.goc.isConnected)return null;
  var tb=MO.tb.getBoundingClientRect().bottom,ds=MO.goc.querySelectorAll('[id]');
  for(var i=0;i<ds.length;i++){var r=ds[i].getBoundingClientRect();if(r.bottom>tb+2&&r.height)return {ma:MO.ma,id:ds[i].id,off:Math.round(r.top-tb)}}
  return {ma:MO.ma,id:null,off:0};
}
function ghiViTri(){var v=viTri();if(v){NGAN.push(v);if(NGAN.length>50)NGAN.shift()}}
function veViTri(v){
  if(MO&&MO.goc.isConnected&&v.ma===MO.ma){denViTri(v);nutVe();return}
  VB.doc(v.ma,null,{vt:v});
}
function denViTri(v){
  var t=v.id?MO.goc.querySelector('[id="'+v.id+'"]'):null;
  if(!t){window.scrollTo(0,0);return}
  toi(t,false);window.scrollBy(0,6-v.off);
}
function manDoc(d,id,opt){
  dongLop();
  var goc=el('div',{class:'vbd'});
  goc.innerHTML=dungHtml(d);
  // liên kết sang văn bản khác: đánh dấu ↗
  [].forEach.call(goc.querySelectorAll('a[data-r]'),function(a){if(a.getAttribute('data-r').split('#')[0]!==d.ma)a.classList.add('kh')});
  var oDieu=el('input',{type:'text',inputmode:'numeric',placeholder:'Điều',onkeydown:function(e){if(e.key==='Enter')diDieu()}});
  var diDieu=function(){var v=oDieu.value.trim().replace(/^điều\s*/i,'');if(!v)return;
    var t=goc.querySelector('[id="d'+v.toLowerCase()+'"]');
    if(t){oDieu.blur();toi(t,true)}else thongBao('Văn bản này không có Điều '+v);};
  var coDieu=d.n.some(function(n){return n.l==='D'});
  var tb=el('div',{class:'vbtb'},[
    el('button',{class:'s',text:'☰ Mục lục',onclick:function(){mucLuc(d,goc)}}),
    coDieu?oDieu:null,coDieu?el('button',{class:'s',text:'→',onclick:diDieu}):null,
    el('span',{class:'tt',text:tenNgan(d)}),
    el('button',{class:'s',text:'🔍',onclick:function(){timTrong(d)}})
  ]);
  MO={ma:d.ma,goc:goc,tb:tb};
  show([tb,goc],quayLai);
  datTop();
  nutVe();
  goc.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[data-r]');
    if(a){e.preventDefault();nhay(a.getAttribute('data-r'));return}
    var f=e.target.closest&&e.target.closest('sup[data-fn]');
    if(f){chuThich(d,f.getAttribute('data-fn'));return}
    var p=e.target.closest&&e.target.closest('p[id],.vdt[data-i]');
    if(p&&!(window.getSelection&&String(window.getSelection())))trich(d,p.id||p.getAttribute('data-i'));
  });
  // tới đích
  setTimeout(function(){
    if(opt.vt){denViTri(opt.vt);return}
    var t=id?goc.querySelector('[id="'+id+'"]'):null;
    if(t){
      if(opt.tim){var sec=t.closest('section')||t;[].forEach.call(sec.querySelectorAll('p,td,.vdt'),function(x){if(!x.querySelector('a,sup,p'))toSang(x,{khong:opt.tim.khong,qq:opt.tim.qq,tu:opt.tim.tu,d:opt.d})})}
      toi(t,true);
    }
  },30);
}
function dungHtml(d){
  var h=['<div class="vhd"><div class="l">'+esc(d.loai==='Luật'?'LUẬT':d.loai.toUpperCase())+'</div><div class="s">'+esc(d.loai==='Luật'?d.ten.replace(/^Luật /,'').toUpperCase()+' (số '+d.so+')':'Số '+d.so+' – ngày '+d.ngay)+'</div><div class="s"><i>'+esc(d.tom)+'</i></div></div>'];
  var trongPl=false;
  d.n.forEach(function(n){
    if(n.l==='MD'){h.push('<details class="md"><summary>Căn cứ ban hành (chạm để xem)</summary><section id="md">'+(n.h||'')+'</section></details>');return}
    if(n.l==='C'){h.push('<h3 class="vc" id="'+n.i+'">Chương '+n.so+(n.t?'<br>'+n.t:'')+'</h3>');return}
    if(n.l==='M'){h.push('<h4 class="vm" id="'+n.i+'">Mục '+n.so+(n.t?'. '+n.t:'')+'</h4>');return}
    if(n.l==='D'){h.push('<section><div class="vdt" id="'+n.i+'" data-i="'+n.i+'">Điều '+n.so+'. '+(n.t||'')+'</div>'+(n.h||'')+'</section>');return}
    if(n.l==='P'){h.push('<section class="vpl"><h3 class="vc" id="'+n.i+'">PHỤ LỤC'+(n.so?' '+n.so:'')+(n.t?'<br>'+n.t:'')+'</h3>'+(n.h||'')+'</section>');return}
    if(n.l==='MS'){h.push('<section class="vms"><div class="vdt" id="'+n.i+'">Mẫu số '+n.so+(n.t?'. '+n.t:'')+'</div>'+(n.h||'')+'</section>');return}
  });
  var con=(DS||[]).filter(function(x){return x.cha===d.ma});
  con.forEach(function(c){h.push('<p style="margin-top:24px;font-family:Arial,sans-serif"><a data-r="'+c.ma+'#">📎 Mở '+esc(c.ten)+'</a></p>')});
  return h.join('');
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
/* thanh công cụ dính ngay dưới tiêu đề (tính cả phóng to chữ của #app – đổi cỡ chữ thì tính lại) */
function datTop(){
  if(!MO)return;var hd=document.querySelector('header'),z=parseFloat($('app').style.zoom)||1;
  MO.tb.style.top=((hd?hd.offsetHeight:0)/z)+'px';
}
window.addEventListener('resize',function(){datTop()});
try{new MutationObserver(function(){datTop()}).observe($('app'),{attributes:true,attributeFilter:['style']})}catch(e){}
/* cuộn tới phần tử, chừa chỗ cho tiêu đề + thanh công cụ */
function toi(t,sang){
  datTop();
  // mục trong "Căn cứ ban hành" đang thu gọn
  var dt=t.closest&&t.closest('details');if(dt)dt.open=true;
  t.scrollIntoView({block:'start'});
  var tb=MO&&MO.tb,b=tb?tb.getBoundingClientRect().bottom:0;
  window.scrollBy(0,-(b+6));
  if(sang){t.classList.remove('vflash');void t.offsetWidth;t.classList.add('vflash')}
}
function nhay(r){
  var p=r.split('#'),ma=p[0],id=p[1]||'';
  if(!MO)return;
  dongLop();ghiViTri();
  if(ma===MO.ma){
    var t=id?MO.goc.querySelector('[id="'+id+'"]'):null;
    if(t){toi(t,true);nutVe()}else{NGAN.pop();thongBao('Không tìm thấy vị trí được dẫn chiếu.')}
    return;
  }
  VB.doc(ma,id||null);
}
/* nút ↩ quay lại chỗ đang đọc trước khi nhảy */
function nutVe(){
  var b=$('vb-ve');
  if(!NGAN.length||!MO){if(b)b.remove();return}
  if(!b){b=el('button',{id:'vb-ve',class:'vbve',onclick:function(){if(NGAN.length)veViTri(NGAN.pop())}});document.body.appendChild(b)}
  var v=NGAN[NGAN.length-1];
  b.textContent='↩ Quay lại'+(v.ma!==MO.ma?' '+tenNgan(KHO[v.ma]||{ten:''}):'');
}
/* gỡ các phần tử nổi khi rời màn văn bản (show() của index.html thay #app nhưng không biết các phần tử này) */
var VIEW_CU=-1;
setInterval(function(){
  var o=$('app'),con=MO&&MO.goc&&MO.goc.isConnected;
  if(!con){var b=$('vb-ve');if(b)b.remove();var t=$('vb-trich');if(t)t.remove();if(LOP&&!LOP.giu)dongLop()}
},700);

/* ---------- 6. LỚP PHỦ: MỤC LỤC, TÌM TRONG VĂN BẢN, CHÚ THÍCH, TRÍCH DẪN ---------- */
function lop(tieuDe,than,phu){
  dongLop();
  var x=el('div',{class:'vbov'},[el('div',{class:'h'},[el('b',{text:tieuDe}),el('button',{class:'s',text:'Đóng',onclick:dongLop})])].concat(phu?[phu]:[]).concat([than]));
  document.body.appendChild(x);
  LOP={el:x,giu:false};
  return x;
}
function dongLop(){if(LOP&&LOP.el)LOP.el.remove();LOP=null;var f=$('vb-fn');if(f)f.remove()}
function mucLuc(d,goc){
  var b=el('div',{class:'b'}),cur=null;
  // Điều đang đọc
  var tb=MO.tb.getBoundingClientRect().bottom,dangDoc=null;
  [].some.call(goc.querySelectorAll('.vdt[id],h3.vc[id]'),function(x){if(x.getBoundingClientRect().top-tb<=40){dangDoc=x.id;return false}return true});
  d.n.forEach(function(n){
    var r=null;
    if(n.l==='C')r=el('div',{class:'ml-c'},[]),r.innerHTML='Chương '+n.so+(n.t?' – '+n.t:'');
    else if(n.l==='M')r=el('div',{class:'ml-m'}),r.innerHTML='Mục '+n.so+(n.t?'. '+n.t:'');
    else if(n.l==='D')r=el('div',{class:'ml-d'}),r.innerHTML='<b>Điều '+n.so+'.</b> '+(n.t||'');
    else if(n.l==='P')r=el('div',{class:'ml-d pl'}),r.innerHTML='<b>Phụ lục '+(n.so||'')+'</b>'+(n.t?' – '+n.t:'');
    else if(n.l==='MS')r=el('div',{class:'ml-d pl ms'}),r.innerHTML='<b>Mẫu số '+n.so+'</b>'+(n.t?' – '+n.t:'');
    else if(n.l==='MD')r=el('div',{class:'ml-d'},[el('i',{text:'Căn cứ ban hành'})]);
    if(!r)return;
    [].forEach.call(r.querySelectorAll('sup'),function(s){s.remove()});
    r.addEventListener('click',function(){dongLop();var t=goc.querySelector('[id="'+n.i+'"]');if(t)toi(t,true)});
    if(n.i===dangDoc){r.classList.add('cur');cur=r}
    b.appendChild(r);
  });
  (DS||[]).filter(function(x){return x.cha===d.ma}).forEach(function(c){
    b.appendChild(el('div',{class:'ml-d pl',onclick:function(){nhay(c.ma+'#')}},[el('b',{text:'📎 '+c.ten})]));
  });
  lop('Mục lục – '+tenNgan(d),b);
  if(cur)setTimeout(function(){cur.scrollIntoView({block:'center'})},0);
}
function timTrong(d){
  var b=el('div',{class:'b'}),o=el('input',{type:'search',placeholder:'Từ cần tìm…',autocomplete:'off'});
  var tatCa=el('input',{type:'checkbox'});tatCa.style.width='auto';
  var chay=function(){var q=o.value.trim();if(q.length<2){b.innerHTML='';return}
    var p=tatCa.checked?Promise.resolve():Promise.resolve();
    if(tatCa.checked&&Object.keys(KHO).length<(DS||[]).length){b.innerHTML='';b.appendChild(el('div',{class:'hint',text:'Đang tải các văn bản khác…'}));
      p=taiHet()}
    p.then(function(){veKetQua(b,timKiem(q,tatCa.checked?null:d.ma),q,tatCa.checked?null:d.ma)})};
  var hen=null;o.addEventListener('input',function(){clearTimeout(hen);hen=setTimeout(chay,300)});
  tatCa.addEventListener('change',chay);
  lop('Tìm trong văn bản',b,el('div',{class:'h2'},[o,el('label',{style:'display:flex;align-items:center;gap:4px;font-size:14px;white-space:nowrap'},[tatCa,'Mọi văn bản'])]));
  setTimeout(function(){o.focus()},50);
}
function chuThich(d,n){
  var f=$('vb-fn');if(f)f.remove();
  var h=(d.fn||{})[n];if(!h){thongBao('Không có chú thích ['+n+'].');return}
  f=el('div',{id:'vb-fn',class:'vbfn'});
  f.innerHTML='<button class="x s">Đóng</button><b style="font-family:Arial,sans-serif;font-size:14px;color:#8a5a00">Chú thích ['+n+']</b>'+h;
  f.querySelector('.x').onclick=function(){f.remove()};
  f.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-r]');if(a){f.remove();nhay(a.getAttribute('data-r'))}});
  document.body.appendChild(f);
}
/* chạm vào một khoản/điểm/Điều → thanh nhỏ: chép lời trích dẫn */
function trich(d,id){
  var tr=loiTrich(id);if(!tr)return;
  var s=tr+' '+tenDayDu(d);
  var x=$('vb-trich');if(x)x.remove();
  var an=null;
  x=el('div',{id:'vb-trich',class:'vbtrich'},[el('span',{text:s}),
    el('button',{class:'s',text:'📋 Chép',onclick:function(){chep(s);x.remove()}}),
    el('button',{text:'✕',onclick:function(){x.remove()}})]);
  document.body.appendChild(x);an=setTimeout(function(){if(x.isConnected)x.remove()},5000);
}
function chep(s){
  var xong=function(){thongBao('Đã chép: '+s)};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(xong,function(){chepCu(s);xong()})}
  else{chepCu(s);xong()}
}
function chepCu(s){var t=el('textarea',{});t.value=s;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(e){}t.remove()}

/* để kiểm thử */
VB._={loiTrich:loiTrich,timKiem:timKiem,taiHet:taiHet,kho:function(){return KHO},ngan:function(){return NGAN}};
})();
