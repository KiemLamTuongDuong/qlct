/* ===================== BẢN ĐỒ – xem, nhập track/vùng vi phạm, biên tập & in sơ đồ =====================
   Nạp khi bấm ô 🗺️ (index.html → bdHome). Dùng các hàm chung của index.html: el, show, $, boot, phien, thongBao, chiaSeFile, ZIPR.
   - Bản đồ nền: gói JSON theo xã trong thư mục bando/ của ứng dụng (xuất bằng QGIS/XuatGoiBanDo.py), tọa độ VN-2000 (mét).
     Service worker lưu gói vào bộ nhớ 'qlct-bando' → mở lại không cần mạng.
   - Lớp nhập: GPX, KML, KMZ, GeoJSON, MIF (MapInfo). WGS84 tự đổi sang VN-2000 theo kinh tuyến trục của gói.
   - Vị trí GPS chỉ hiện trên màn hình, KHÔNG đưa vào file xuất.
   - Biên tập: trang A4 (dọc/ngang) – tiêu đề 3 dòng, khung có tọa độ VN-2000, chú giải, thước tỷ lệ, thành phần tham gia → PDF / JPG. */
(function(){
'use strict';
var BD=window.BD={};

/* ---------- 1. TỌA ĐỘ: WGS84 ↔ VN-2000 (TM múi 3°, k0 = 0,9999, 7 tham số theo QĐ 05/2007/QĐ-BTNMT) ---------- */
var A=6378137,F=1/298.257223563,E2=F*(2-F),EP2=E2/(1-E2),K0=0.9999,FE=500000;
var HT=[-191.90441429,-39.30318279,-111.45032835],HR=[0.00928836,-0.01975479,0.00427372].map(function(x){return x/3600*Math.PI/180}),HS=0.252906278e-6;
function g2x(la,lo){var s=Math.sin(la),N=A/Math.sqrt(1-E2*s*s);return [N*Math.cos(la)*Math.cos(lo),N*Math.cos(la)*Math.sin(lo),N*(1-E2)*s]}
function x2g(X,Y,Z){var p=Math.hypot(X,Y),lo=Math.atan2(Y,X),la=Math.atan2(Z,p*(1-E2));
  for(var i=0;i<6;i++){var s=Math.sin(la),N=A/Math.sqrt(1-E2*s*s);la=Math.atan2(Z+E2*N*s,p)}return [la,lo]}
/* VN2000 → WGS84: X' = T + (1+s)·R·X  (quy ước vector vị trí, như +towgs84 của PROJ) */
function vn2w(X){var rx=HR[0],ry=HR[1],rz=HR[2],k=1+HS;
  return [HT[0]+k*(X[0]-rz*X[1]+ry*X[2]),HT[1]+k*(rz*X[0]+X[1]-rx*X[2]),HT[2]+k*(-ry*X[0]+rx*X[1]+X[2])]}
function w2vn(X){var rx=HR[0],ry=HR[1],rz=HR[2],k=1+HS,a=(X[0]-HT[0])/k,b=(X[1]-HT[1])/k,c=(X[2]-HT[2])/k;
  return [a+rz*b-ry*c,-rz*a+b+rx*c,ry*a-rx*b+c]}
var M1=1-E2/4-3*E2*E2/64-5*E2*E2*E2/256,M2=3*E2/8+3*E2*E2/32+45*E2*E2*E2/1024,M3=15*E2*E2/256+45*E2*E2*E2/1024,M4=35*E2*E2*E2/3072;
function cungKT(la){return A*(M1*la-M2*Math.sin(2*la)+M3*Math.sin(4*la)-M4*Math.sin(6*la))}
function tmXuoi(la,lo,lo0){
  var s=Math.sin(la),c=Math.cos(la),t=Math.tan(la),N=A/Math.sqrt(1-E2*s*s),T=t*t,C=EP2*c*c,Aa=(lo-lo0)*c;
  var x=K0*N*(Aa+(1-T+C)*Math.pow(Aa,3)/6+(5-18*T+T*T+72*C-58*EP2)*Math.pow(Aa,5)/120);
  var y=K0*(cungKT(la)+N*t*(Aa*Aa/2+(5-T+9*C+4*C*C)*Math.pow(Aa,4)/24+(61-58*T+T*T+600*C-330*EP2)*Math.pow(Aa,6)/720));
  return [x+FE,y];
}
function tmNguoc(E,Nn,lo0){
  var M=Nn/K0,mu=M/(A*M1),e1=(1-Math.sqrt(1-E2))/(1+Math.sqrt(1-E2));
  var la1=mu+(3*e1/2-27*Math.pow(e1,3)/32)*Math.sin(2*mu)+(21*e1*e1/16-55*Math.pow(e1,4)/32)*Math.sin(4*mu)+(151*Math.pow(e1,3)/96)*Math.sin(6*mu)+(1097*Math.pow(e1,4)/512)*Math.sin(8*mu);
  var s=Math.sin(la1),c=Math.cos(la1),t=Math.tan(la1),C1=EP2*c*c,T1=t*t,N1=A/Math.sqrt(1-E2*s*s),R1=A*(1-E2)/Math.pow(1-E2*s*s,1.5),D=(E-FE)/(N1*K0);
  var la=la1-(N1*t/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*EP2)*Math.pow(D,4)/24+(61+90*T1+298*C1+45*T1*T1-252*EP2-3*C1*C1)*Math.pow(D,6)/720);
  var lo=lo0+(D-(1+2*T1+C1)*Math.pow(D,3)/6+(5-2*C1+28*T1-3*C1*C1+8*EP2+24*T1*T1)*Math.pow(D,5)/120)/c;
  return [la,lo];
}
var RAD=Math.PI/180;
/* (vĩ độ, kinh độ WGS84, kinh tuyến trục) → [E (Y), N (X)] VN-2000 */
function w2v(lat,lon,ktt){var g=x2g.apply(null,w2vn(g2x(lat*RAD,lon*RAD)));return tmXuoi(g[0],g[1],ktt*RAD)}
function v2w(E,N,ktt){var g=tmNguoc(E,N,ktt*RAD),X=vn2w(g2x(g[0],g[1])),w=x2g(X[0],X[1],X[2]);return [w[0]/RAD,w[1]/RAD]}
BD.w2v=w2v;BD.v2w=v2w;
function kttChu(k){var d=Math.floor(k+1e-9),m=Math.round((k-d)*60);return d+'°'+(m<10?'0':'')+m+"'"}
function so(v,n){return Number(v).toFixed(n||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ')}
function soVN(v,n){return Number(v).toFixed(n).replace('.',',')}

/* ---------- 2. TRẠNG THÁI (lưu trên máy) ---------- */
var S=null,GOI=null,DS_GOI=null;
var FONT='"Times New Roman","Liberation Serif","Noto Serif",serif';
var TT_TEN={TXG:'Rừng gỗ tự nhiên lá rộng thường xanh giàu',TXB:'Rừng gỗ tự nhiên lá rộng thường xanh trung bình',TXN:'Rừng gỗ tự nhiên lá rộng thường xanh nghèo',
  TXK:'Rừng gỗ tự nhiên lá rộng thường xanh nghèo kiệt',TXP:'Rừng gỗ tự nhiên lá rộng thường xanh phục hồi',HG:'Rừng hỗn giao gỗ – tre nứa',TN:'Rừng tre nứa',
  TG:'Rừng gỗ trồng',TTN:'Rừng tre nứa trồng',DTTS:'Đất đã trồng chưa thành rừng',DTR:'Đất trống',DTK:'Đất khác',TXDP:'Rừng gỗ tự nhiên núi đá phục hồi',TXDK:'Rừng gỗ tự nhiên núi đá nghèo kiệt',
  DT1:'Đất trống (không có cây tái sinh)',DT2:'Đất có cây gỗ tái sinh',MN:'Mặt nước',NN:'Đất nông nghiệp'};
function khoa(){return 'qlct_bd:'+((phien()||{}).email||'')}
function macDinh(){return {goi:'',xem:null,lop:[],chu:[],bt:{loai:'tt',d1:'',d2:'',d3:'',ttg:'',coKy:true,kho:'doc',tyLe:0,cx:null,cy:null,N:10000,
  luoi:true,nhanTk:true,nhanKh:true,nhanDh:true,nhanLo:false,cgLo:true,cgTk:true,cgMau:false,thuoc:true,bac:true,vtCg:'dt',tuSua:{}}}}
function nap(){try{S=JSON.parse(localStorage.getItem(khoa())||'null')}catch(e){S=null}
  var d=macDinh();if(!S||typeof S!=='object')S=d;Object.keys(d).forEach(function(k){if(S[k]===undefined)S[k]=d[k]});
  Object.keys(d.bt).forEach(function(k){if(S.bt[k]===undefined)S.bt[k]=d.bt[k]});
  /* tắt hẳn ứng dụng rồi mở lại = phiên mới → tự làm sơ đồ mới (giữ bản đồ nền, khổ giấy, tùy chọn).
     Chuyển màn hình, ra trang chủ, tải lại trang, ẩn app xuống nền thì vẫn giữ sơ đồ đang làm. */
  var ph=phienBD();
  if(ph&&S.phien!==ph){if(S.lop.length||S.chu.length||S.bt.ttg||S.bt.d1||S.bt.cx!=null)lamMoi();S.phien=ph;luu(1)}}
/* mã phiên: sessionStorage còn khi tải lại trang / ẩn app, mất khi tắt hẳn ứng dụng (đóng tab) */
function phienBD(){try{var k='qlct_bd_phien',v=sessionStorage.getItem(k);
  if(!v){v=Date.now().toString(36)+Math.random().toString(36).slice(2,6);sessionStorage.setItem(k,v)}return v}catch(e){return ''}}
/* Làm sơ đồ mới: xóa lớp đã nhập, chữ, tiêu đề, thành phần tham gia, vị trí khung in.
   Giữ: bản đồ nền đang chọn, khổ giấy và các tùy chọn hiển thị / chú giải. */
function lamMoi(){
  var d=macDinh().bt,bt=S.bt;
  S.lop=[];S.chu=[];
  ['loai','d1','d2','d3','ttg','tyLe','cx','cy','N','tuSua'].forEach(function(k){bt[k]=JSON.parse(JSON.stringify(d[k]))});
  delete bt.lopKhop;luu(1);
}
var HEN_LUU=0;
function luu(ngay){clearTimeout(HEN_LUU);var f=function(){try{localStorage.setItem(khoa(),JSON.stringify(S))}catch(e){thongBao('Bộ nhớ máy đầy – chưa lưu được bản đồ. Hãy xóa bớt lớp đã nhập.',5000)}};if(ngay)f();else HEN_LUU=setTimeout(f,400)}
function ktt(){return GOI?GOI.g.ktt:104.75}

/* ---------- 3. GÓI BẢN ĐỒ NỀN ---------- */
function taiJson(url,moi){
  return fetch(url+(moi?(url.indexOf('?')<0?'?':'&')+'moi='+Date.now():''),{cache:moi?'reload':'default'}).then(function(r){
    if(!r.ok)throw new Error(r.status===404?'Chưa có file '+url+' trên máy chủ.':'Lỗi tải '+url+' ('+r.status+')');return r.json()});
}
function taiDs(){return taiJson('bando/ds.json',navigator.onLine).catch(function(e){return taiJson('bando/ds.json',false)}).then(function(d){DS_GOI=(d&&d.goi)||[];return DS_GOI})}
function dec(r,ox,oy){var a=new Float64Array(r.length),x=ox,y=oy;for(var i=0;i<r.length;i+=2){x+=r[i];y+=r[i+1];a[i]=x;a[i+1]=y}return a}
function vong(p,a,dong){p.moveTo(a[0],a[1]);for(var i=2;i<a.length;i+=2)p.lineTo(a[i],a[i+1]);if(dong)p.closePath()}
/* gói → các Path2D gom theo kiểu (vẽ rất nhanh); tọa độ trừ gốc để tránh sai số số thực của canvas */
function giaiMa(g){
  var o={g:g,ox:g.goc[0],oy:g.goc[1],lop:[],lo:[]};
  g.lop.forEach(function(L){
    var m={loai:L.loai,to:{},vien:{},duong:{},diem:[]};
    L.ds.forEach(function(f,i){
      var k=f[0],ky=g.kieu[k]||{};
      if(L.loai==='vung'){
        var rings=[],pt=m.to[k]||(m.to[k]=new Path2D()),vk=JSON.stringify([ky.s,ky.w]),pv=m.vien[vk]||(m.vien[vk]={k:ky,p:new Path2D()});
        f[1].forEach(function(poly){poly.forEach(function(r){var a=dec(r,0,0);rings.push(a);if(ky.f)vong(pt,a,1);if(ky.s)vong(pv.p,a,1)})});
        if(L.lo){var bb=hop(rings);o.lo.push({r:rings,bb:bb,tt:L.tt[i]})}
      }else if(L.loai==='duong'){
        var dk=JSON.stringify([ky.s,ky.w,ky.d]),pd=m.duong[dk]||(m.duong[dk]={k:ky,p:new Path2D()});
        f[1].forEach(function(r){vong(pd.p,dec(r,0,0),0)});
      }else if(L.loai==='chu'){   // lớp chữ (gói phiên bản 2): [kiểu, x, y, nội dung, góc xoay]
        (m.chu||(m.chu=[])).push({k:ky,x:f[1],y:f[2],t:String(f[3]),r:+f[4]||0});
      }else f[1].forEach(function(p){m.diem.push({k:ky,x:p[0],y:p[1]})});
    });
    o.lop.push(m);
  });
  o.tk=[];o.kh=[];
  Object.keys(g.nhan&&g.nhan.tk||{}).forEach(function(k){var p=g.nhan.tk[k];o.tk.push({t:k,x:p[0],y:p[1]})});
  Object.keys(g.nhan&&g.nhan.kh||{}).forEach(function(k){var p=g.nhan.kh[k];o.kh.push({tk:k.split('|')[0],t:k.split('|')[1],x:p[0],y:p[1]})});
  return o;
}
function hop(rings){var b=[1e18,1e18,-1e18,-1e18];rings.forEach(function(a){for(var i=0;i<a.length;i+=2){if(a[i]<b[0])b[0]=a[i];if(a[i]>b[2])b[2]=a[i];if(a[i+1]<b[1])b[1]=a[i+1];if(a[i+1]>b[3])b[3]=a[i+1]}});return b}
function trongVong(x,y,rings){var c=false;rings.forEach(function(a){var n=a.length;for(var i=0,j=n-2;i<n;j=i,i+=2){var yi=a[i+1],yj=a[j+1];
  if((yi>y)!==(yj>y)&&x<(a[j]-a[i])*(y-yi)/(yj-yi)+a[i])c=!c}});return c}
/* lô chứa điểm (tọa độ VN-2000 tuyệt đối) */
function loTai(E,N){if(!GOI)return null;var x=E-GOI.ox,y=N-GOI.oy;
  for(var i=0;i<GOI.lo.length;i++){var l=GOI.lo[i],b=l.bb;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;if(trongVong(x,y,l.r))return l}return null}
/* điểm đặt nhãn lô: giữa đoạn dài nhất của đường quét ngang qua giữa lô */
function diemNhan(l){if(l.dn)return l.dn;var b=l.bb,best=null;
  [0.5,0.35,0.65].forEach(function(f){if(best)return;var y=b[1]+(b[3]-b[1])*f,xs=[];
    l.r.forEach(function(a){var n=a.length;for(var i=0,j=n-2;i<n;j=i,i+=2){var yi=a[i+1],yj=a[j+1];if((yi>y)!==(yj>y))xs.push((a[j]-a[i])*(y-yi)/(yj-yi)+a[i])}});
    xs.sort(function(p,q){return p-q});var w=0;for(var k=0;k+1<xs.length;k+=2)if(xs[k+1]-xs[k]>w){w=xs[k+1]-xs[k];best=[(xs[k]+xs[k+1])/2,y,w]}});
  return l.dn=best||[(b[0]+b[2])/2,(b[1]+b[3])/2,0];
}
function moGoi(ma,moi){
  if(!ma){GOI=null;return Promise.resolve(null)}
  if(GOI&&GOI.g.ma===ma&&!moi)return Promise.resolve(GOI);
  var tt=(DS_GOI||[]).filter(function(x){return x.ma===ma})[0];
  return taiJson('bando/'+ma+'.json',moi).then(function(g){
    /* bản đang lưu trên máy cũ hơn danh sách → tải lại */
    if(!moi&&tt&&tt.ngay&&g.ngay&&g.ngay<tt.ngay&&navigator.onLine)return moGoi(ma,true);
    GOI=giaiMa(g);return GOI});
}

/* ---------- 4. VẼ BẢN ĐỒ ---------- */
/* vp: {x,y,w,h: khung (px canvas), cx,cy: tâm (VN-2000 tuyệt đối), s: px/m}; o: {mm: px/mm giấy, gps, nhanh, bt} */
function veBanDo(ctx,vp,o){
  var mm=o.mm,s=vp.s,bt=o.bt||S.bt;
  ctx.save();ctx.beginPath();ctx.rect(vp.x,vp.y,vp.w,vp.h);ctx.clip();
  ctx.fillStyle='#fff';ctx.fillRect(vp.x,vp.y,vp.w,vp.h);
  var X=function(e){return vp.x+vp.w/2+(e-vp.cx)*s},Y=function(n){return vp.y+vp.h/2-(n-vp.cy)*s};
  var N=1000*mm/s;   // mẫu số tỷ lệ trên giấy
  if(GOI){
    ctx.save();ctx.setTransform(s,0,0,-s,X(GOI.ox),Y(GOI.oy));
    GOI.lop.forEach(function(m){
      Object.keys(m.to).forEach(function(k){var ky=GOI.g.kieu[k];if(ky.f){ctx.fillStyle=ky.f;ctx.fill(m.to[k],'evenodd')}});
      Object.keys(m.vien).forEach(function(k){var v=m.vien[k];if(!v.k.s)return;ctx.strokeStyle=v.k.s;ctx.globalAlpha=N>40000?0.5:0.85;ctx.lineWidth=Math.max(v.k.w||0,0.08)*mm/s;ctx.stroke(v.p)});
      ctx.globalAlpha=1;
      Object.keys(m.duong).forEach(function(k){var v=m.duong[k];ctx.strokeStyle=v.k.s||'#000';ctx.lineWidth=Math.max(v.k.w||0,0.1)*mm/s;
        ctx.setLineDash(Array.isArray(v.k.d)?v.k.d.map(function(x){return Math.max(x,0.1)*mm/s}):v.k.d?[1.5*mm/s,0.8*mm/s]:[]);ctx.stroke(v.p)});
      ctx.setLineDash([]);
    });
    ctx.restore();
    GOI.lop.forEach(function(m){m.diem.forEach(function(d){ctx.fillStyle=d.k.f||'#000';ctx.beginPath();ctx.arc(X(d.x+GOI.ox),Y(d.y+GOI.oy),Math.max(0.6,(d.k.r||2)/2)*mm,0,7);ctx.fill()})});
    if(!o.nhanh)veNhanNen(ctx,X,Y,mm,N,bt,vp);
    if(!o.nhanh)veChuNen(ctx,X,Y,mm,N,bt,vp);
  }
  S.lop.forEach(function(L){if(L.hien!==false)veLop(ctx,L,X,Y,mm)});
  if(o.chu)S.chu.forEach(function(c){veChu(ctx,c,X,Y,mm)});
  if(o.gps&&GPS.e){var gx=X(GPS.e),gy=Y(GPS.n);ctx.fillStyle='rgba(30,120,255,.15)';ctx.beginPath();ctx.arc(gx,gy,Math.max(GPS.acc*s,0),0,7);ctx.fill();
    ctx.fillStyle='#1e78ff';ctx.strokeStyle='#fff';ctx.lineWidth=2.5*o.dpr;ctx.beginPath();ctx.arc(gx,gy,7*o.dpr,0,7);ctx.fill();ctx.stroke()}
  if(o.cham){var cx=X(o.cham.e),cy=Y(o.cham.n),r=9*o.dpr;ctx.strokeStyle='#d00';ctx.lineWidth=2*o.dpr;ctx.beginPath();
    ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke()}
  ctx.restore();
}
function vongTron(ctx,x,y,r,mauVien,lw,chu,co,mauChu){ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.strokeStyle=mauVien;ctx.lineWidth=lw;ctx.stroke();
  ctx.fillStyle=mauChu||mauVien;ctx.font=co+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(chu,x,y+co*0.05)}
function veNhanNen(ctx,X,Y,mm,N,bt,vp){
  var ox=GOI.ox,oy=GOI.oy,trong=function(x,y){return x>vp.x-50&&x<vp.x+vp.w+50&&y>vp.y-50&&y<vp.y+vp.h+50};
  if(bt.nhanLo&&N<=25000){
    ctx.textAlign='center';ctx.fillStyle='#000';
    GOI.lo.forEach(function(l){var b=l.bb,w=(b[2]-b[0])*1000/N,h=(b[3]-b[1])*1000/N;if(w<9||h<6)return;   // lô quá nhỏ trên giấy
      var p=diemNhan(l);if(p[2]*1000/N<9)return;var x=X(p[0]+ox),y=Y(p[1]+oy);if(!trong(x,y))return;
      var tt=l.tt,t1=(tt[2]||'')+(tt[3]?' - '+tt[3]:''),t2=tt[4]!=null?soVN(tt[4],2)+' ha':'',co=1.9*mm;
      ctx.font=co+'px '+FONT;var w1=Math.max(ctx.measureText(t1).width,ctx.measureText(t2).width);
      ctx.textBaseline='bottom';ctx.fillText(t1,x,y-0.25*mm);ctx.textBaseline='top';ctx.fillText(t2,x,y+0.25*mm);
      ctx.strokeStyle='#000';ctx.lineWidth=0.12*mm;ctx.beginPath();ctx.moveTo(x-w1/2,y);ctx.lineTo(x+w1/2,y);ctx.stroke()});
  }
  if(GOI.g.soHieu)return;   // gói có lớp chữ số hiệu riêng (vẽ trong veChuNen)
  if(bt.nhanKh&&N<=60000)GOI.kh.forEach(function(k){var x=X(k.x+ox),y=Y(k.y+oy);if(trong(x,y))vongTron(ctx,x,y,2.6*mm,'#000',0.2*mm,k.t,2.8*mm)});
  if(bt.nhanTk)GOI.tk.forEach(function(k){var x=X(k.x+ox),y=Y(k.y+oy);if(trong(x,y))vongTron(ctx,x,y,4.4*mm,'#1428d0',0.3*mm,k.t,3.6*mm)});
}
/* lớp chữ của bản đồ nền (tên sông suối, núi, độ cao đồng mức, số hiệu tiểu khu/khoảnh, tên xã…) – cỡ chữ theo mm trên giấy như nhãn QGIS */
function veChuNen(ctx,X,Y,mm,N,bt,vp){
  var ox=GOI.ox,oy=GOI.oy,m=60;
  GOI.lop.forEach(function(L){(L.chu||[]).forEach(function(c){
    var k=c.k,nh=k.nhom;
    if(nh==='tk'){if(!bt.nhanTk)return}
    else if(nh==='kh'){if(!bt.nhanKh||N>60000)return}
    else if(bt.nhanDh===false||N>60000)return;
    var x=X(c.x+ox),y=Y(c.y+oy);if(x<vp.x-m||x>vp.x+vp.w+m||y<vp.y-m||y>vp.y+vp.h+m)return;
    var co=(k.co||3)*mm;
    ctx.save();ctx.translate(x,y);if(c.r)ctx.rotate(c.r*Math.PI/180);
    if(k.vong){var v=k.vong;ctx.beginPath();ctx.arc(0,0,v.r*mm,0,7);if(v.f){ctx.fillStyle=v.f;ctx.fill()}if(v.s){ctx.strokeStyle=v.s;ctx.lineWidth=Math.max(v.w||0.2,0.1)*mm;ctx.stroke()}}
    ctx.font=(k.nghieng?'italic ':'')+(k.dam?'bold ':'')+co+'px "'+(k.font||'Arial')+'",'+(/times/i.test(k.font||'')?FONT:'Arial,sans-serif');
    ctx.textAlign='center';ctx.textBaseline='middle';
    var dong=c.t.split('\n'),h=co*1.15;
    dong.forEach(function(t,i){var yy=(i-(dong.length-1)/2)*h+co*0.05;
      if(k.vien){ctx.lineWidth=k.vien*2*mm;ctx.strokeStyle='#fff';ctx.lineJoin='round';ctx.strokeText(t,0,yy)}
      ctx.fillStyle=k.mau||'#000';ctx.fillText(t,0,yy)});
    ctx.restore();
  })});
}
/* lớp nhập: đường tuần tra, vùng vi phạm, điểm */
var MAU_GACH={};
function mauGach(ctx,mau,mm){var k=mau+'|'+Math.round(mm*100);if(MAU_GACH[k])return MAU_GACH[k];
  var d=Math.max(4,Math.round(1.6*mm)),c=document.createElement('canvas');c.width=c.height=d;var g=c.getContext('2d');
  g.strokeStyle=mau;g.lineWidth=Math.max(1,0.18*mm);g.beginPath();g.moveTo(-1,d+1);g.lineTo(d+1,-1);g.moveTo(-1,1);g.lineTo(1,-1);g.moveTo(d-1,d+1);g.lineTo(d+1,d-1);g.stroke();
  return MAU_GACH[k]=ctx.createPattern(c,'repeat')}
function hex2rgba(h,a){var n=parseInt(h.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'}
function toVung(ctx,L,mm){
  if(L.kieu==='gach'){ctx.fillStyle=mauGach(ctx,L.mau,mm);ctx.fill('evenodd')}
  else if(L.kieu==='to'){ctx.fillStyle=hex2rgba(L.mau,0.35);ctx.fill('evenodd')}
  else if(L.kieu==='dac'){ctx.fillStyle=L.mau;ctx.fill('evenodd')}
  ctx.strokeStyle=L.mau;ctx.lineWidth=(L.rong||0.5)*mm;ctx.setLineDash(L.net==='dut'?[2*mm,1*mm]:[]);ctx.stroke();ctx.setLineDash([]);
}
function veLop(ctx,L,X,Y,mm){
  ctx.lineJoin='round';ctx.lineCap='round';
  if(L.loai==='duong'){ctx.strokeStyle=L.mau;ctx.lineWidth=(L.rong||0.8)*mm;ctx.setLineDash(L.net==='dut'?[2.5*mm,1.2*mm]:[]);
    L.ds.forEach(function(a){ctx.beginPath();for(var i=0;i<a.length;i+=2)ctx[i?'lineTo':'moveTo'](X(a[i]),Y(a[i+1]));ctx.stroke()});ctx.setLineDash([])}
  else if(L.loai==='vung'){L.ds.forEach(function(poly){ctx.beginPath();poly.forEach(function(a){for(var i=0;i<a.length;i+=2)ctx[i?'lineTo':'moveTo'](X(a[i]),Y(a[i+1]));ctx.closePath()});toVung(ctx,L,mm)})}
  else L.ds.forEach(function(a){veDiem(ctx,L,X(a[0]),Y(a[1]),mm)});
}
function veDiem(ctx,L,x,y,mm){var r=(L.rong||1.6)*mm;ctx.fillStyle=L.mau;ctx.strokeStyle='#fff';ctx.lineWidth=0.35*mm;
  if(L.kieu==='tam'){ctx.beginPath();ctx.moveTo(x,y-r*1.2);ctx.lineTo(x+r*1.05,y+r*0.65);ctx.lineTo(x-r*1.05,y+r*0.65);ctx.closePath();ctx.fill();ctx.stroke()}
  else if(L.kieu==='vuong'){ctx.fillRect(x-r,y-r,2*r,2*r);ctx.strokeRect(x-r,y-r,2*r,2*r)}
  else{ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.stroke()}}
function veChu(ctx,c,X,Y,mm){var co=(c.co||3.5)*mm;ctx.font=(c.nghieng?'italic ':'')+(c.dam?'bold ':'')+co+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';
  var x=X(c.e),y=Y(c.n);ctx.lineWidth=0.6*mm;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineJoin='round';ctx.strokeText(c.t,x,y);ctx.fillStyle=c.mau||'#000';ctx.fillText(c.t,x,y);
  c._bb=[x-ctx.measureText(c.t).width/2,y-co/2,x+ctx.measureText(c.t).width/2,y+co/2]}

/* ---------- 5. NHẬP FILE (GPX, KML, KMZ, GeoJSON, MIF) ---------- */
var TCVN3={161:'Ă',162:'Â',163:'Ê',164:'Ô',165:'Ơ',166:'Ư',167:'Đ',168:'ă',169:'â',170:'ê',171:'ô',172:'ơ',173:'ư',174:'đ',181:'à',182:'ả',183:'ã',184:'á',185:'ạ',187:'ằ',188:'ẳ',189:'ẵ',190:'ắ',198:'ặ',
  199:'ầ',200:'ẩ',201:'ẫ',202:'ấ',203:'ậ',204:'è',206:'ẻ',207:'ẽ',208:'é',209:'ẹ',210:'ề',211:'ể',212:'ễ',213:'ế',214:'ệ',215:'ì',216:'ỉ',220:'ĩ',221:'í',222:'ị',223:'ò',225:'ỏ',226:'õ',227:'ó',228:'ọ',
  229:'ồ',230:'ổ',231:'ỗ',232:'ố',233:'ộ',234:'ờ',235:'ở',236:'ỡ',237:'ớ',238:'ợ',239:'ù',241:'ủ',242:'ũ',243:'ú',244:'ụ',245:'ừ',246:'ử',247:'ữ',248:'ứ',249:'ự',250:'ỳ',251:'ỷ',252:'ỹ',253:'ý',254:'ỵ'};
/* chữ TCVN3 (.VnTime) bị đọc thành ký tự Latin-1 → Unicode (chỉ khi chuỗi không có ký tự Unicode tiếng Việt) */
function doiTCVN3(s){s=String(s==null?'':s);if(/[^\x00-\xff]/.test(s)||!(/[\xa1-\xbf\xc4-\xc7\xcb\xce-\xd1\xd6-\xd8\xdb\xdc\xde\xdf\xe4-\xe7\xeb\xee-\xf1\xf6-\xf8\xfb\xfc\xfe]/.test(s)||/[a-z][\xc0-\xdd]/.test(s)))return s.trim();   // chữ Việt Unicode thường (à, ã, ê…) giữ nguyên
  return s.replace(/[\xa1-\xfe]/g,function(c){return TCVN3[c.charCodeAt(0)]||c}).trim()}
BD.doiTCVN3=doiTCVN3;
function ngayTu(s){if(!s)return null;var m=String(s).match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);if(m)return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  m=String(s).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);return m?m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2):null}
/* đọc file → [{ten, loai:'duong'|'vung'|'diem', ds (tọa độ VN-2000 tuyệt đối), ngay:[min,max]}] */
function docFile(file,dbf){
  var ten=file.name.toLowerCase();
  if(/\.shp$/.test(ten))return Promise.all([file.arrayBuffer(),dbf?dbf.arrayBuffer():null]).then(function(b){return docShp(b[0],b[1],file.name)});
  if(/\.kmz$/.test(ten))return file.arrayBuffer().then(function(b){return ZIPR.doc2(b)}).then(function(fs){
    var k=fs.filter(function(f){return /\.kml$/i.test(f.n)})[0];if(!k)throw new Error('Trong file KMZ không có KML.');return docKml(ZIPR.txt(k))});
  return file.text().then(function(t){
    if(/\.gpx$/.test(ten))return docGpx(t);
    if(/\.kml$/.test(ten))return docKml(t);
    if(/\.(geo)?json$/.test(ten))return docGeoJson(t);
    if(/\.mif$/.test(ten))return docMif(t);
    if(/<gpx/i.test(t))return docGpx(t);if(/<kml/i.test(t))return docKml(t);if(/^\s*\{/.test(t))return docGeoJson(t);
    throw new Error('Chưa đọc được loại file này. Dùng GPX, KML, KMZ, GeoJSON, SHP (chọn cùng file .dbf) hoặc MIF.');
  });
}
function xmlDoc(t){var d=new DOMParser().parseFromString(t,'application/xml');if(d.getElementsByTagName('parsererror').length)throw new Error('File hỏng (XML không hợp lệ).');return d}
function con(e,ten){var a=[],c=e.getElementsByTagName('*');for(var i=0;i<c.length;i++)if(c[i].localName===ten)a.push(c[i]);return a}
function con1(e,ten){for(var c=e.firstElementChild;c;c=c.nextElementSibling)if(c.localName===ten)return c;return null}
function chuCon(e,ten){var c=con1(e,ten);return c?c.textContent.trim():''}
function vnTuLL(lat,lon){var p=w2v(lat,lon,ktt());return [Math.round(p[0]*10)/10,Math.round(p[1]*10)/10]}
function docGpx(t){
  var d=xmlDoc(t),out=[];
  var ext=function(e){var x=con1(e,'extensions'),o={};if(x){var a=x.getElementsByTagName('*');for(var i=0;i<a.length;i++)if(!a[i].firstElementChild)o[a[i].localName]=a[i].textContent.trim()}return o};
  con(d,'trk').concat(con(d,'rte')).forEach(function(tr,i){
    var ex=ext(tr),ten=doiTCVN3(chuCon(tr,'name')||ex.a4TenDuong||ex.name||''),ngay=[],ds=[];
    var segs=con(tr,'trkseg');if(!segs.length)segs=[tr];
    segs.forEach(function(sg){var a=[];con(sg,sg===tr?'rtept':'trkpt').forEach(function(p){var la=+p.getAttribute('lat'),lo=+p.getAttribute('lon');if(isNaN(la)||isNaN(lo))return;
      var v=vnTuLL(la,lo);a.push(v[0],v[1]);var tm=chuCon(p,'time');if(tm)ngay.push(ngayTu(tm))});if(a.length>=4)ds.push(a)});
    var nk=ngayTu(ex.a2KhoiTao||ex.c3ThoiGianCapNhat||'');if(nk)ngay.push(nk);
    if(ds.length)out.push({ten:ten||('Đường '+(i+1)),loai:'duong',ds:ds,ngay:khoangNgay(ngay)});
  });
  var wp=con(d,'wpt');
  if(wp.length){var ds=[];wp.forEach(function(p){ds.push(vnTuLL(+p.getAttribute('lat'),+p.getAttribute('lon')))});out.push({ten:'Các điểm ('+wp.length+')',loai:'diem',ds:ds,ngay:khoangNgay(wp.map(function(p){return ngayTu(chuCon(p,'time'))}))})}
  return out;
}
function khoangNgay(a){a=a.filter(Boolean).sort();return a.length?[a[0],a[a.length-1]]:null}
function docKml(t){
  var d=xmlDoc(t),out=[];
  var toaDo=function(s){var a=[];String(s).trim().split(/\s+/).forEach(function(c){var p=c.split(',');if(p.length>=2&&!isNaN(+p[0])&&!isNaN(+p[1])){var v=vnTuLL(+p[1],+p[0]);a.push(v[0],v[1])}});return a};
  con(d,'Placemark').forEach(function(pm,i){
    var ten=doiTCVN3(chuCon(pm,'name')),dl={};
    con(pm,'SimpleData').forEach(function(s){dl[s.getAttribute('name')]=s.textContent.trim()});
    con(pm,'Data').forEach(function(s){dl[s.getAttribute('name')]=chuCon(s,'value')});
    if(!ten)ten=doiTCVN3(dl.a4TenDuong||dl.name||dl.Name||dl.TEN||'');
    var ngay=[];con(pm,'when').forEach(function(w){ngay.push(ngayTu(w.textContent))});var nk=ngayTu(dl.a2KhoiTao||'');if(nk)ngay.push(nk);
    var duong=[],vung=[],diem=[];
    con(pm,'LineString').forEach(function(l){var a=toaDo(chuCon(l,'coordinates'));if(a.length>=4)duong.push(a)});
    con(pm,'Track').forEach(function(tr){var a=[];con(tr,'coord').forEach(function(c){var p=c.textContent.trim().split(/\s+/);var v=vnTuLL(+p[1],+p[0]);a.push(v[0],v[1])});if(a.length>=4)duong.push(a)});
    con(pm,'Polygon').forEach(function(pg){var rs=[];con(pg,'LinearRing').forEach(function(r){var a=toaDo(chuCon(r,'coordinates'));if(a.length>=6)rs.push(a)});if(rs.length)vung.push(rs)});
    con(pm,'Point').forEach(function(p){var a=toaDo(chuCon(p,'coordinates'));if(a.length)diem.push(a)});
    ten=ten||('Đối tượng '+(i+1));var nn=khoangNgay(ngay);
    if(duong.length)out.push({ten:ten,loai:'duong',ds:duong,ngay:nn});
    if(vung.length)out.push({ten:ten,loai:'vung',ds:vung,ngay:nn});
    if(diem.length)out.push({ten:ten,loai:'diem',ds:diem,ngay:nn});
  });
  return out;
}
/* GeoJSON: kinh/vĩ độ (WGS84) hoặc mét VN-2000 (xuất thẳng từ QGIS) – tự nhận theo độ lớn tọa độ */
function docGeoJson(t){
  var j=JSON.parse(t),fs=j.type==='FeatureCollection'?j.features:j.type==='Feature'?[j]:[{type:'Feature',geometry:j,properties:{}}],out=[];
  var laMet=null;
  var d=function(c){if(laMet===null)laMet=Math.abs(c[0])>360||Math.abs(c[1])>360;return laMet?[Math.round(c[0]*10)/10,Math.round(c[1]*10)/10]:vnTuLL(c[1],c[0])};
  var phang=function(r){var a=[];r.forEach(function(c){var v=d(c);a.push(v[0],v[1])});return a};
  fs.forEach(function(f,i){
    var g=f.geometry;if(!g)return;var p=f.properties||{},ten=doiTCVN3(p.name||p.ten||p.Name||p.TEN||p.a4TenDuong||(p.lo!=null?('Lô '+p.lo+(p.khoanh!=null?', khoảnh '+p.khoanh:'')+(p.TK!=null?', TK '+p.TK:'')):'')||('Đối tượng '+(i+1)));
    var nn=khoangNgay([ngayTu(p.time||p.ngay||p.date||p.a2KhoiTao||'')]);
    var gs=g.type==='GeometryCollection'?g.geometries:[g];
    gs.forEach(function(g){var c=g.coordinates;
      if(g.type==='LineString')out.push({ten:ten,loai:'duong',ds:[phang(c)],ngay:nn});
      else if(g.type==='MultiLineString')out.push({ten:ten,loai:'duong',ds:c.map(phang),ngay:nn});
      else if(g.type==='Polygon')out.push({ten:ten,loai:'vung',ds:[c.map(phang)],ngay:nn});
      else if(g.type==='MultiPolygon')out.push({ten:ten,loai:'vung',ds:c.map(function(pg){return pg.map(phang)}),ngay:nn});
      else if(g.type==='Point')out.push({ten:ten,loai:'diem',ds:[d(c)],ngay:nn});
      else if(g.type==='MultiPoint')out.push({ten:ten,loai:'diem',ds:c.map(d),ngay:nn});
    });
  });
  return out;
}
/* Shapefile: .shp (hình) + .dbf (thuộc tính, không bắt buộc). Tọa độ độ (WGS84) hoặc mét VN-2000 – tự nhận theo độ lớn */
function docDbf(buf){
  if(!buf)return [];var v=new DataView(buf),u=new Uint8Array(buf),n=v.getUint32(4,true),hl=v.getUint16(8,true),rl=v.getUint16(10,true),f=[],p=32,o=1;
  while(p+32<=hl&&u[p]!==0x0D){var nm='';for(var i=0;i<11&&u[p+i];i++)nm+=String.fromCharCode(u[p+i]);f.push({n:nm,t:String.fromCharCode(u[p+11]),l:u[p+16],o:o});o+=u[p+16];p+=32}
  var utf=new TextDecoder('utf-8',{fatal:true}),lat=new TextDecoder('latin1'),out=[];
  for(var r=0;r<n;r++){var b=hl+r*rl,x={};if(b+rl>u.length)break;
    f.forEach(function(fd){var a=u.subarray(b+fd.o,b+fd.o+fd.l),s;try{s=utf.decode(a)}catch(e){s=lat.decode(a)}x[fd.n]=doiTCVN3(s.replace(/\0/g,''))});out.push(x)}
  return out;
}
function docShp(buf,dbfBuf,tenFile){
  var v=new DataView(buf),ds=docDbf(dbfBuf),out=[],p=100,i=0,laMet=null;
  var d=function(x,y){if(laMet===null)laMet=Math.abs(x)>360||Math.abs(y)>360;return laMet?[Math.round(x*10)/10,Math.round(y*10)/10]:vnTuLL(y,x)};
  var tenTu=function(a){if(!a)return '';var ks=Object.keys(a),k=ks.filter(function(k){return /^(a4TenDuong|TenDuong|ten|name|TEN|NAME|c1TenDoiTuong)$/i.test(k)&&a[k]})[0];
    return k?a[k]:''};
  while(p+12<=buf.byteLength){
    var len=v.getInt32(p+4,false)*2,c=p+8,t=v.getInt32(c,true),a=ds[i]||null,ten=tenTu(a)||((tenFile||'Đối tượng').replace(/\.shp$/i,'')+' '+(i+1));
    var ng=a?khoangNgay([ngayTu(a.a2KhoiTao||a.a3CapNhat||a.c3ThoiGian||a.ngay||a.NGAY||'')]):null;
    if(t===1||t===11||t===21)out.push({ten:ten,loai:'diem',ds:[d(v.getFloat64(c+4,true),v.getFloat64(c+12,true))],ngay:ng});
    else if(t===3||t===13||t===23||t===5||t===15||t===25){
      var np=v.getInt32(c+36,true),nn=v.getInt32(c+40,true),pp=c+44,pt=pp+4*np,parts=[];
      for(var k=0;k<np;k++){var s0=v.getInt32(pp+4*k,true),s1=k+1<np?v.getInt32(pp+4*k+4,true):nn,arr=[];
        for(var j=s0;j<s1;j++){var q=d(v.getFloat64(pt+16*j,true),v.getFloat64(pt+16*j+8,true));arr.push(q[0],q[1])}
        if(arr.length>=4)parts.push(arr)}
      if(parts.length)out.push(t%10===3?{ten:ten,loai:'duong',ds:parts,ngay:ng}:{ten:ten,loai:'vung',ds:[parts],ngay:ng});
    }
    p=c+len;i++;
  }
  return out;
}
/* MapInfo MIF: CoordSys Earth Projection 1 = kinh/vĩ độ; các hệ chiếu khác coi là mét VN-2000 */
function docMif(t){
  var L=t.split(/\r?\n/),i=0,out=[],ll=/CoordSys\s+Earth\s+Projection\s+1\s*,/i.test(t),n=0;
  var d=function(x,y){return ll?vnTuLL(+y,+x):[+x,+y]};
  while(i<L.length&&!/^\s*Data\s*$/i.test(L[i]))i++;i++;
  var doc=function(k){var a=[];for(var j=0;j<k&&i<L.length;j++,i++){var p=L[i].trim().split(/\s+/);var v=d(p[0],p[1]);a.push(v[0],v[1])}return a};
  while(i<L.length){var s=L[i].trim(),m;i++;
    if((m=s.match(/^Pline(\s+Multiple\s+(\d+))?(\s+(\d+))?/i))){n++;var ds=[];
      if(m[2]){for(var k=0;k<+m[2];k++){var c=+L[i].trim();i++;ds.push(doc(c))}}else{var c2=m[4]?+m[4]:+L[i++].trim();ds.push(doc(c2))}
      out.push({ten:'Đường '+n,loai:'duong',ds:ds,ngay:null})}
    else if((m=s.match(/^Region\s+(\d+)/i))){n++;var rs=[];for(var r=0;r<+m[1];r++){var c3=+L[i].trim();i++;rs.push(doc(c3))}out.push({ten:'Vùng '+n,loai:'vung',ds:[rs],ngay:null})}
    else if((m=s.match(/^Line\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i))){n++;var a=d(m[1],m[2]),b=d(m[3],m[4]);out.push({ten:'Đường '+n,loai:'duong',ds:[[a[0],a[1],b[0],b[1]]],ngay:null})}
    else if((m=s.match(/^Point\s+(\S+)\s+(\S+)/i))){n++;out.push({ten:'Điểm '+n,loai:'diem',ds:[d(m[1],m[2])],ngay:null})}
  }
  return out;
}
/* làm gọn đường (Douglas–Peucker, sai số 0,5 m) để tiết kiệm bộ nhớ máy */
function gon(a,tol){if(a.length<=6)return a;var n=a.length/2,giu=new Uint8Array(n),st=[[0,n-1]];giu[0]=giu[n-1]=1;
  while(st.length){var q=st.pop(),i0=q[0],i1=q[1],x0=a[2*i0],y0=a[2*i0+1],dx=a[2*i1]-x0,dy=a[2*i1+1]-y0,l2=dx*dx+dy*dy,mx=-1,mi=-1;
    for(var i=i0+1;i<i1;i++){var px=a[2*i]-x0,py=a[2*i+1]-y0,t=l2?Math.max(0,Math.min(1,(px*dx+py*dy)/l2)):0,ex=px-t*dx,ey=py-t*dy,dd=ex*ex+ey*ey;if(dd>mx){mx=dd;mi=i}}
    if(mx>tol*tol){giu[mi]=1;st.push([i0,mi],[mi,i1])}}
  var o=[];for(var k=0;k<n;k++)if(giu[k])o.push(a[2*k],a[2*k+1]);return o}
function dienTich(rings){var s=0;rings.forEach(function(a,ri){var t=0;for(var i=0,n=a.length;i<n;i+=2){var j=(i+2)%n;t+=a[i]*a[j+1]-a[j]*a[i+1]}s+=ri?-Math.abs(t)/2:Math.abs(t)/2});return s}
function doDai(a){var s=0;for(var i=2;i<a.length;i+=2)s+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);return s}
var KIEU_VAI={tt:{loai:'duong',mau:'#1a2ccc',rong:0.8,cg:'Đường tuần tra'},vp:{loai:'vung',mau:'#e00000',rong:0.5,kieu:'gach',cg:'Vị trí vi phạm'},
  diem:{loai:'diem',mau:'#e00000',rong:1.6,kieu:'tron',cg:'Điểm'},duong:{loai:'duong',mau:'#e00000',rong:0.6,cg:'Đường'}};
function themLop(it){
  var vai=it.loai==='duong'?'tt':it.loai==='vung'?'vp':'diem',k=KIEU_VAI[vai];
  var L={id:'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),ten:it.ten,loai:it.loai,vai:vai,mau:k.mau,rong:k.rong,kieu:k.kieu||'',net:'lien',cg:k.cg,hien:true,ngay:it.ngay};
  if(it.loai==='duong')L.ds=it.ds.map(function(a){return gon(a,0.5)});
  else if(it.loai==='vung')L.ds=it.ds.map(function(pg){return pg.map(function(a){return gon(a,0.3)})});
  else L.ds=it.ds;
  S.lop.push(L);return L;
}
function moTa(L){
  if(L.loai==='duong'){var d=0;L.ds.forEach(function(a){d+=doDai(a)});return d>=1000?soVN(d/1000,2)+' km':Math.round(d)+' m'}
  if(L.loai==='vung'){var s=0;L.ds.forEach(function(p){s+=dienTich(p)});return soVN(s/10000,s<1e4?3:2)+' ha'}
  return L.ds.length+' điểm';
}
function hopLop(ds){var b=[1e18,1e18,-1e18,-1e18],add=function(a){for(var i=0;i<a.length;i+=2){b[0]=Math.min(b[0],a[i]);b[1]=Math.min(b[1],a[i+1]);b[2]=Math.max(b[2],a[i]);b[3]=Math.max(b[3],a[i+1])}};
  ds.forEach(function(L){if(L.hien===false)return;if(L.loai==='duong')L.ds.forEach(add);else if(L.loai==='vung')L.ds.forEach(function(p){p.forEach(add)});else L.ds.forEach(add)});
  return b[0]<1e17?b:null}

/* ---------- 6. GPS ---------- */
var GPS={},GPS_ID=null,GPS_NGHE=[];
/* Nhiều màn hình cùng nghe GPS: cb trả false thì thôi nghe; không còn ai nghe thì tắt GPS.
   - maximumAge 0: luôn lấy vị trí mới, không dùng vị trí cũ trong bộ nhớ.
   - Bỏ qua điểm kém hơn hẳn điểm vừa có (<15 giây): thường là vị trí ước tính từ trạm điện thoại/Wi-Fi chen vào. */
function batGps(cb){
  if(cb)GPS_NGHE.push(cb);
  if(!navigator.geolocation){GPS.loi='Máy không hỗ trợ định vị.';baoGps();return}
  if(GPS_ID!==null)return;
  GPS_ID=navigator.geolocation.watchPosition(function(p){
    var c=p.coords,acc=c.accuracy||9999,now=Date.now();
    if(GPS.e&&now-GPS.t<15000&&acc>Math.max(30,GPS.acc*3))return;
    var v=w2v(c.latitude,c.longitude,ktt());
    GPS={e:v[0],n:v[1],lat:c.latitude,lon:c.longitude,acc:acc,h:c.altitude,t:now,tot:Math.min(acc,GPS.tot||9999),dau:GPS.dau||now};
    baoGps();
  },function(e){GPS.loi=e.code===1?'Chưa cho phép ứng dụng dùng vị trí (bấm biểu tượng ổ khóa cạnh địa chỉ → Vị trí → Cho phép).':'Chưa bắt được GPS ('+e.message+'). Ra chỗ thoáng, chờ thêm.';baoGps()},
  {enableHighAccuracy:true,maximumAge:0,timeout:60000});
}
function baoGps(){GPS_NGHE=GPS_NGHE.filter(function(f){try{return f(GPS)!==false}catch(e){return false}});if(!GPS_NGHE.length)tatGps()}
function tatGps(){GPS_NGHE=[];if(GPS_ID!==null){navigator.geolocation.clearWatch(GPS_ID);GPS_ID=null}GPS={}}
var HD_GPS='Cách để GPS chính xác hơn:\n\n'+
  '1. Cho Chrome dùng vị trí CHÍNH XÁC (quan trọng nhất): Cài đặt điện thoại → Ứng dụng → Chrome → Quyền → Vị trí → "Cho phép khi dùng ứng dụng" và BẬT "Dùng vị trí chính xác". Nếu chỉ cho vị trí gần đúng, sai số 1–3 km.\n\n'+
  '2. Bật độ chính xác của Google: Cài đặt → Vị trí → Dịch vụ vị trí → "Độ chính xác vị trí của Google" → Bật.\n\n'+
  '3. Mở bản đồ ở chỗ thoáng (đầu đồi, khoảng trống) và chờ 1–2 phút cho máy bắt đủ vệ tinh trước khi vào rừng. Dưới tán rừng dày, khe suối sâu sai số thường 10–30 m.\n\n'+
  '4. Cần tọa độ một điểm (vị trí vi phạm…): đứng yên, bấm "🎯 Đo điểm" và chờ 30–60 giây – ứng dụng lấy trung bình nhiều lần đo.\n\n'+
  'Ứng dụng web dùng chung GPS của điện thoại như vTools, nên lúc mới mở sẽ kém hơn vTools đang chạy liên tục; chờ một lúc sẽ tốt dần.';
/* Đo một điểm: đứng yên, lấy trung bình có trọng số (1/sai số²) các lần đo tốt trong khoảng thời gian chờ */
function doDiem(xong){
  var ds=[],t0=Date.now(),dung=false,kq=null;
  var tt=el('div',{style:'font-size:18px;margin:8px 0'}),ct=el('div',{class:'hint'}),nut=el('button',{class:'p',text:'✔ Dùng điểm này'});nut.disabled=true;
  var ov=el('div',{class:'xlov'},[el('div',{class:'xlbox'},[el('div',{class:'gt',text:'🎯 Đo tọa độ điểm'}),
    el('div',{class:'hint',text:'Đứng yên tại điểm cần đo, để điện thoại thoáng trời. Chờ 30–60 giây cho số lần đo tăng và sai số giảm, rồi bấm "Dùng điểm này".'}),
    tt,ct,nut,el('div',{style:'height:8px'}),el('button',{class:'s',text:'Hủy',onclick:function(){dung=true;ov.remove()}})])]);
  document.body.appendChild(ov);
  var tinh=function(){
    if(!ds.length){tt.textContent=GPS.loi||'Đang chờ GPS…';return}
    var tot=Math.min.apply(null,ds.map(function(d){return d.acc})),gh=Math.max(15,tot*2),dung2=ds.filter(function(d){return d.acc<=gh});
    var sw=0,se=0,sn=0;dung2.forEach(function(d){var w=1/(d.acc*d.acc);sw+=w;se+=d.e*w;sn+=d.n*w});
    var e=se/sw,n=sn/sw,ss=Math.max(2,1/Math.sqrt(sw));
    kq={e:e,n:n,acc:ss,so:dung2.length};
    tt.innerHTML='';tt.appendChild(el('b',{text:'X = '+so(n,1)+'   Y = '+so(e,1)}));
    ct.textContent='Đã đo '+ds.length+' lần ('+Math.round((Date.now()-t0)/1000)+' giây), dùng '+dung2.length+' lần tốt · sai số lần đo tốt nhất ±'+Math.round(tot)+' m · ước tính điểm trung bình ±'+Math.round(ss)+' m';
    nut.disabled=false;
  };
  nut.onclick=function(){dung=true;ov.remove();if(kq)xong(kq)};
  batGps(function(g){if(dung||!document.body.contains(ov))return false;
    if(g.e&&g.t>=t0&&!ds.some(function(d){return d.t===g.t}))ds.push({e:g.e,n:g.n,acc:g.acc,t:g.t});tinh()});
  tinh();
}

/* ---------- 7. CỬ CHỈ: kéo, chụm 2 ngón, lăn chuột, chạm ---------- */
function cuChi(cv,cb){
  var pts={},g=null,dpr=function(){return cv.width/cv.getBoundingClientRect().width};
  var vt=function(e){var r=cv.getBoundingClientRect(),k=dpr();return [(e.clientX-r.left)*k,(e.clientY-r.top)*k]};
  var tt=function(){var ks=Object.keys(pts),a=pts[ks[0]],b=pts[ks[1]]||a;return {m:[(a[0]+b[0])/2,(a[1]+b[1])/2],d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,n:ks.length}};
  cv.addEventListener('pointerdown',function(e){var p=vt(e);if(cb.cho&&!cb.cho(p[0],p[1]))return;cv.setPointerCapture(e.pointerId);pts[e.pointerId]=p;
    var t=tt();g={m0:t.m,d0:t.d,n:t.n,t0:Date.now(),di:0,p0:p};if(cb.bd)g.ctx=cb.bd(t.m[0],t.m[1])});
  cv.addEventListener('pointermove',function(e){if(!g||!pts[e.pointerId])return;pts[e.pointerId]=vt(e);var t=tt();
    if(t.n!==g.n){g.n=t.n;g.m0=t.m;g.d0=t.d;if(cb.bd)g.ctx=cb.bd(t.m[0],t.m[1]);return}
    g.di=Math.max(g.di,Math.hypot(t.m[0]-g.m0[0],t.m[1]-g.m0[1]));cb.keo(g.ctx,t.m[0]-g.m0[0],t.m[1]-g.m0[1],t.d/g.d0,g.m0)});
  var het=function(e){if(!pts[e.pointerId])return;delete pts[e.pointerId];if(Object.keys(pts).length){var t=tt();g.n=t.n;g.m0=t.m;g.d0=t.d;if(cb.bd)g.ctx=cb.bd(t.m[0],t.m[1]);return}
    if(g&&g.di<8*dpr()&&Date.now()-g.t0<500&&cb.cham)cb.cham(g.p0[0],g.p0[1]);g=null;cb.xong&&cb.xong()};
  cv.addEventListener('pointerup',het);cv.addEventListener('pointercancel',het);
  cv.addEventListener('wheel',function(e){e.preventDefault();var p=vt(e);if(cb.cho&&!cb.cho(p[0],p[1]))return;var c=cb.bd?cb.bd(p[0],p[1]):null;
    cb.keo(c,0,0,Math.pow(1.0015,-e.deltaY),p);cb.xong&&cb.xong()},{passive:false});
}
function moiKhung(fn){var cho=false;return function(){if(cho)return;cho=true;requestAnimationFrame(function(){cho=false;fn()})}}

/* ---------- 8. MÀN XEM BẢN ĐỒ ---------- */
var CSS_DA=false;
function css(){if(CSS_DA)return;CSS_DA=true;var s=document.createElement('style');s.textContent=
  'main.bd{max-width:none;padding:0}.bdbar{display:flex;gap:6px;padding:8px;flex-wrap:wrap;align-items:center;background:#fff;border-bottom:1px solid var(--line)}'+
  '.bdbar select{flex:1;min-width:150px;padding:8px}.bdbar button{padding:8px 10px}.bdcv{display:block;width:100%;touch-action:none;background:#eef2ef}'+
  '.bdinfo{background:#fff;border-top:1px solid var(--line);padding:6px 10px;font-size:15px;line-height:1.35}.bdinfo b{color:var(--g)}.bdinfo .mut{font-size:13px}'+
  '.bdlop{padding:10px}.bdlop .ln{display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:8px 0}.bdlop .ln .tn{flex:1;min-width:0}'+
  '.bdlop .sw{width:26px;height:16px;border-radius:3px;flex:none;border:1px solid #999}.bdbt{max-width:900px;margin:0 auto;padding:10px}'+
  '.bdtrang{display:block;width:100%;touch-action:none;box-shadow:0 1px 6px rgba(0,0,0,.25);background:#fff}'+
  '.bdf label{display:block;margin:8px 0 2px;font-size:14px;color:var(--mut)}.bdf input[type=text],.bdf textarea,.bdf select{width:100%}'+
  '.bdf .ck{display:inline-flex;align-items:center;gap:6px;margin:4px 14px 4px 0;font-size:15px;color:var(--tx)}.bdf .hang{display:flex;gap:8px;flex-wrap:wrap}.bdf .hang>*{flex:1;min-width:120px}'+
  '@media(min-width:980px){.bdbt.rong{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,1fr);gap:16px;max-width:1300px}}';
  document.head.appendChild(s)}

BD.mo=function(){
  css();nap();tatGps();
  show([msgCard('Đang mở bản đồ…')],boot);
  taiDs().catch(function(e){DS_GOI=[];return []}).then(function(ds){
    if(!S.goi&&ds.length)S.goi=ds[0].ma;
    return moGoi(S.goi).catch(function(e){thongBao(errMsg(e),5000);return null});
  }).then(manXem);
};

function manXem(){
  css();
  var sel=el('select',{onchange:function(){S.goi=sel.value;S.xem=null;luu(1);show([msgCard('Đang tải bản đồ nền…')],boot);
    moGoi(S.goi).catch(function(e){alert(errMsg(e));GOI=null}).then(manXem)}},[el('option',{value:'',text:DS_GOI&&DS_GOI.length?'— Không dùng bản đồ nền —':'(chưa có bản đồ nền)'})]);
  (DS_GOI||[]).forEach(function(g){sel.appendChild(el('option',{value:g.ma,text:g.ten}))});sel.value=GOI?GOI.g.ma:'';
  var cv=el('canvas',{class:'bdcv'}),info=el('div',{class:'bdinfo'}),cham=null;
  var oFile=el('input',{type:'file',multiple:'multiple',style:'display:none',
    onchange:function(){var fs=[].slice.call(oFile.files);oFile.value='';nhapFile(fs,function(){ve();veDsLop();vuaKhung()})}});
  var bar=el('div',{class:'bdbar'},[sel,
    el('button',{class:'s',text:'📍',title:'Về vị trí của tôi',onclick:function(){if(GPS.e){V.cx=GPS.e;V.cy=GPS.n;if(V.s<0.5)V.s=1;ve();luuXem()}else thongBao(GPS.loi||'Đang chờ GPS…',3000)}}),
    el('button',{class:'s',text:'🎯 Đo điểm',onclick:function(){doDiem(function(k){cham={e:k.e,n:k.n,acc:k.acc,so:k.so};V.cx=k.e;V.cy=k.n;if(V.s<1)V.s=2;ve();luuXem();themDiemDo(k)})}}),
    el('button',{class:'s',text:'➕ Nhập file',onclick:function(){oFile.click()}}),
    el('button',{class:'p',text:'🖨️ Biên tập & in',onclick:manBienTap}),nutLamMoi(function(){S.xem=null;manXem()}),oFile]);
  var dsLop=el('div',{class:'bdlop'});
  show([bar,cv,info,dsLop],function(){tatGps();boot()});
  $('app').className='bd';
  var V=S.xem;
  var dprNow=Math.min(window.devicePixelRatio||1,2.5);
  var coKhung=function(){var r=cv.getBoundingClientRect(),h=Math.max(260,Math.round(window.innerHeight-r.top-110));cv.style.height=h+'px';cv.width=Math.round(r.width*dprNow);cv.height=Math.round(h*dprNow)};
  coKhung();
  var vuaKhung=function(){var b=hopLop(S.lop)||(GOI?[GOI.g.bbox[0],GOI.g.bbox[1],GOI.g.bbox[2],GOI.g.bbox[3]]:null);if(!b){V={cx:500000,cy:2130000,s:0.02};return}
    V={cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2,s:Math.min(cv.width/Math.max(50,b[2]-b[0]),cv.height/Math.max(50,b[3]-b[1]))*0.88};ve();luuXem()};
  var luuXem=function(){S.xem=V;luu()};
  var ve=function(nhanh){var ctx=cv.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    veBanDo(ctx,{x:0,y:0,w:cv.width,h:cv.height,cx:V.cx,cy:V.cy,s:V.s},{mm:3.2*dprNow,dpr:dprNow,gps:1,cham:cham,nhanh:nhanh,chu:1,bt:{nhanTk:true,nhanKh:true,nhanDh:true,nhanLo:true}});
    veThuocManHinh(ctx,cv,V.s,dprNow);
    veInfo()};
  var veNhanh=moiKhung(function(){ve(true)});
  function veInfo(){
    var kq=[];
    if(GPS.e){kq.push(el('div',{},[el('b',{text:'📍 Vị trí của tôi: '}),'X = '+so(GPS.n,1)+'  Y = '+so(GPS.e,1)+' (±'+Math.round(GPS.acc)+' m)']));
      if(GPS.acc>30)kq.push(el('div',{class:'mut',style:'color:#a05a00'},[GPS.acc>=500?'⚠️ Sai số rất lớn – có thể Chrome chỉ được dùng vị trí gần đúng. ':'⚠️ GPS chưa ổn định, chờ thêm hoặc ra chỗ thoáng. ',
        el('span',{class:'link',text:'Cách khắc phục',onclick:function(){alert(HD_GPS)}})]));
      var l=loTai(GPS.e,GPS.n);if(l)kq.push(el('div',{class:'mut',text:'Đang đứng ở: TK '+l.tt[0]+', khoảnh '+l.tt[1]+', lô '+l.tt[2]+(l.tt[3]?' – '+l.tt[3]:'')+(l.tt[4]!=null?' ('+soVN(l.tt[4],2)+' ha)':'')}))}
    else kq.push(el('div',{class:'mut',text:GPS.loi||'Đang bắt GPS…'}));
    if(cham){var ll=v2w(cham.e,cham.n,ktt()),l2=loTai(cham.e,cham.n);
      kq.push(el('div',{},[el('b',{text:cham.so?'🎯 Điểm đo: ':'✛ Điểm chạm: ',style:'color:#d00'}),'X = '+so(cham.n,1)+'  Y = '+so(cham.e,1)+(cham.so?' (±'+Math.round(cham.acc)+' m, '+cham.so+' lần đo)':'')]),
        el('div',{class:'mut',text:'WGS84: '+ll[0].toFixed(6)+', '+ll[1].toFixed(6)+(l2?' · TK '+l2.tt[0]+', khoảnh '+l2.tt[1]+', lô '+l2.tt[2]+(l2.tt[3]?' – '+l2.tt[3]:'')+(l2.tt[4]!=null?' ('+soVN(l2.tt[4],2)+' ha)':''):'')}))}
    kq.push(el('div',{class:'mut',text:'VN-2000 múi 3°, KTT '+kttChu(ktt())+(GOI?' · '+GOI.g.ten:'')+' · Vị trí của bạn chỉ hiện trên màn hình, không đưa vào bản in.'}));
    info.innerHTML='';kq.forEach(function(x){info.appendChild(x)});
  }
  function veDsLop(){
    dsLop.innerHTML='';
    dsLop.appendChild(el('div',{class:'gt',text:'Lớp đã nhập ('+S.lop.length+')'}));
    if(!S.lop.length)dsLop.appendChild(el('div',{class:'hint',text:'Bấm "➕ Nhập file" để đưa đường tuần tra hoặc vùng vi phạm vào bản đồ: GPX, KML, KMZ, GeoJSON, SHP (chọn cả file .shp và .dbf cùng tên), MIF. Ghi track bằng ứng dụng GPS khác (vTools…) rồi xuất ra một trong các dạng này.'}));
    S.lop.forEach(function(L,i){
      var ck=el('input',{type:'checkbox'});ck.checked=L.hien!==false;ck.onchange=function(){L.hien=ck.checked;luu();ve()};
      dsLop.appendChild(el('div',{class:'ln'},[ck,el('span',{class:'sw',style:L.loai==='vung'?'background:'+hex2rgba(L.mau,0.35)+';border-color:'+L.mau:L.loai==='duong'?'background:'+L.mau+';height:5px':'background:'+L.mau+';border-radius:50%;width:14px;height:14px'}),
        el('div',{class:'tn'},[el('div',{text:L.ten}),el('div',{class:'hint',text:({tt:'Đường tuần tra',vp:'Vùng vi phạm',diem:'Điểm',duong:'Đường khác'})[L.vai]+' · '+moTa(L)+(L.ngay?' · '+ngayChu(L.ngay):'')})]),
        el('button',{class:'s',text:'🔍',title:'Xem',onclick:function(){var b=hopLop([L]);if(b){V={cx:(b[0]+b[2])/2,cy:(b[1]+b[3])/2,s:Math.min(cv.width/Math.max(50,b[2]-b[0]),cv.height/Math.max(50,b[3]-b[1]))*0.85};ve();luuXem();window.scrollTo(0,0)}}}),
        el('button',{class:'s',text:'✏️',title:'Sửa',onclick:function(){suaLop(L,function(){luu(1);ve();veDsLop()})}}),
        el('button',{class:'d',text:'🗑',title:'Xóa',onclick:function(){if(confirm('Xóa lớp "'+L.ten+'"?')){S.lop.splice(i,1);luu(1);ve();veDsLop()}}})]));
    });
    if(S.lop.length>1)dsLop.appendChild(el('p',{},[el('span',{class:'link',text:'Xóa tất cả các lớp đã nhập',onclick:function(){if(confirm('Xóa tất cả '+S.lop.length+' lớp đã nhập?')){S.lop=[];S.chu=[];luu(1);ve();veDsLop()}}})]));
    dsLop.appendChild(el('div',{class:'gt',text:'Bản đồ nền'}));
    dsLop.appendChild(el('div',{class:'hint',text:GOI?(GOI.g.ten+' – cập nhật '+fmtNgay(GOI.g.ngay)+', '+GOI.lo.length+' lô. Đã lưu trên máy, dùng được khi không có mạng.'):'Chưa có bản đồ nền. Quản trị xuất bằng QGIS (XuatGoiBanDo.py) rồi tải lên thư mục bando/ của ứng dụng.'}));
    if(GOI)dsLop.appendChild(el('p',{},[el('span',{class:'link',text:'⟳ Tải lại bản đồ nền từ máy chủ',onclick:function(){if(!navigator.onLine){alert('Cần có mạng.');return}
      show([msgCard('Đang tải lại…')],boot);taiDs().then(function(){return moGoi(S.goi,true)}).catch(function(e){alert(errMsg(e))}).then(manXem)}})]));
  }
  cuChi(cv,{bd:function(){return {cx:V.cx,cy:V.cy,s:V.s}},
    keo:function(c,dx,dy,k,m){var s=c.s*k,wx=c.cx+(m[0]-cv.width/2)/c.s,wy=c.cy-(m[1]-cv.height/2)/c.s;
      V.s=Math.max(0.002,Math.min(50,s));V.cx=wx-(m[0]+dx-cv.width/2)/V.s;V.cy=wy+(m[1]+dy-cv.height/2)/V.s;veNhanh()},
    xong:function(){ve();luuXem()},
    cham:function(x,y){cham={e:V.cx+(x-cv.width/2)/V.s,n:V.cy-(y-cv.height/2)/V.s};ve()}});
  window.addEventListener('resize',function rs(){if(!document.body.contains(cv)){window.removeEventListener('resize',rs);return}coKhung();ve()});
  batGps(function(){if(!document.body.contains(cv))return false;ve()});
  BD._xemLai=function(){if(document.body.contains(cv)){veDsLop();ve()}};
  if(!V||!V.s)vuaKhung();
  veDsLop();ve();
}
function nutLamMoi(sau){return el('button',{class:'d',text:'🔄 Làm sơ đồ mới',onclick:function(){
  if(!confirm('Bắt đầu sơ đồ mới?\n\nSẽ xóa: các đường/vùng/điểm đã nhập, chữ ghi trên bản đồ, tiêu đề, thành phần tham gia.\nGiữ lại: bản đồ nền, khổ giấy và các tùy chọn hiển thị.\n\nNên xuất PDF/ảnh sơ đồ hiện tại trước nếu cần. (Tắt hẳn ứng dụng rồi mở lại cũng tự bắt đầu sơ đồ mới.)'))return;
  lamMoi();thongBao('Đã bắt đầu sơ đồ mới.',2500);sau()}})}
function themDiemDo(k){
  setTimeout(function(){var ten=prompt('Đã đo: X = '+so(k.n,1)+', Y = '+so(k.e,1)+' (±'+Math.round(k.acc)+' m).\n\nĐưa điểm này vào bản đồ? Nhập tên điểm (để trống / Hủy: không đưa vào):','Điểm đo');
    if(!ten||!ten.trim())return;var h=new Date(),d=h.getFullYear()+'-'+('0'+(h.getMonth()+1)).slice(-2)+'-'+('0'+h.getDate()).slice(-2);
    var L=themLop({ten:ten.trim(),loai:'diem',ds:[[Math.round(k.e*10)/10,Math.round(k.n*10)/10]],ngay:[d,d]});L.cg=ten.trim();luu(1);
    if(BD._xemLai)BD._xemLai()},300);
}
function ngayChu(n){if(!n)return '';var a=n[0].split('-'),b=n[1].split('-');
  if(n[0]===n[1])return a[2]+'/'+a[1]+'/'+a[0];
  if(a[0]===b[0]&&a[1]===b[1])return a[2]+'-'+b[2]+'/'+a[1]+'/'+a[0];
  if(a[0]===b[0])return a[2]+'/'+a[1]+' - '+b[2]+'/'+b[1]+'/'+b[0];
  return a[2]+'/'+a[1]+'/'+a[0]+' - '+b[2]+'/'+b[1]+'/'+b[0]}
function fmtNgay(s){var m=String(s||'').split('-');return m.length===3?m[2]+'/'+m[1]+'/'+m[0]:s}
function veThuocManHinh(ctx,cv,s,dpr){var mpp=1/s,goal=110*dpr*mpp,b=[5,10,20,50,100,200,250,500,1000,2000,5000,10000,20000,50000];var d=b[0];b.forEach(function(x){if(x<=goal)d=x});
  var w=d*s,x=12*dpr,y=cv.height-14*dpr;ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(x-6*dpr,y-20*dpr,w+60*dpr,26*dpr);ctx.strokeStyle='#000';ctx.lineWidth=2*dpr;
  ctx.beginPath();ctx.moveTo(x,y-6*dpr);ctx.lineTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y-6*dpr);ctx.stroke();ctx.fillStyle='#000';ctx.font=(12*dpr)+'px Arial';ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.fillText(d>=1000?(d/1000)+' km':d+' m',x+w+6*dpr,y)}

/* hộp chọn đối tượng sau khi đọc file */
function nhapFile(fs,xong){
  if(!fs.length)return;
  var goc=function(f){return f.name.replace(/\.[^.]+$/,'').toLowerCase()},dbf={};
  fs.forEach(function(f){if(/\.dbf$/i.test(f.name))dbf[goc(f)]=f});
  var phu=fs.filter(function(f){return /\.(dbf|shx|prj|cpg|qix|sbn|sbx)$/i.test(f.name)});
  fs=fs.filter(function(f){return phu.indexOf(f)<0});
  if(!fs.length){alert('Hãy chọn file .shp (có thể chọn cùng lúc file .dbf cùng tên để lấy tên đường).');return}
  Promise.all(fs.map(function(f){return docFile(f,dbf[goc(f)]).then(function(a){a.forEach(function(x){x.file=f.name});return a})})).then(function(kq){
    var ds=[].concat.apply([],kq);
    if(!ds.length){alert('Không tìm thấy đường, vùng hay điểm nào trong file.');return}
    if(GOI){var b=GOI.g.bbox,ngoai=ds.filter(function(it){var h=hopLop([{loai:it.loai,ds:it.ds}]);return h&&(h[2]<b[0]-20000||h[0]>b[2]+20000||h[3]<b[1]-20000||h[1]>b[3]+20000)}).length;
      if(ngoai===ds.length&&!confirm('Các đối tượng trong file nằm xa vùng bản đồ nền ('+GOI.g.ten+'). Kiểm tra lại file hoặc kinh tuyến trục. Vẫn nhập?'))return}
    var cks=[],moi=ds.length<=6;
    var bang=el('div',{style:'max-height:50vh;overflow:auto;margin:8px 0'},ds.map(function(it,i){
      var c=el('input',{type:'checkbox'});c.checked=moi||i===ds.length-1;cks.push(c);
      var L={loai:it.loai,ds:it.ds};
      return el('label',{style:'display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)'},[c,el('div',{},[el('div',{text:it.ten}),
        el('div',{class:'hint',text:({duong:'Đường',vung:'Vùng',diem:'Điểm'})[it.loai]+' · '+moTa(L)+(it.ngay?' · '+ngayChu(it.ngay):'')})])]);
    }));
    var ov=el('div',{class:'xlov'},[el('div',{class:'xlbox'},[el('div',{class:'gt',text:'Chọn đối tượng cần đưa vào bản đồ ('+ds.length+')'}),
      ds.length>6?el('div',{class:'hint',text:'File có nhiều đường (ứng dụng ghi track lưu cả các lần trước). Đánh dấu những đường của đợt này.'}):null,bang,
      el('div',{style:'display:flex;gap:8px'},[el('button',{class:'p',text:'Đưa vào bản đồ',onclick:function(){
        var n=0;ds.forEach(function(it,i){if(cks[i].checked){themLop(it);n++}});ov.remove();if(!n)return;luu(1);thongBao('Đã thêm '+n+' lớp.',2500);xong&&xong()}}),
        el('button',{class:'s',text:'Hủy',onclick:function(){ov.remove()}})])])]);
    document.body.appendChild(ov);
  }).catch(function(e){alert('Không đọc được file: '+errMsg(e))});
}
/* sửa tên, vai trò, kiểu ký hiệu một lớp */
function suaLop(L,xong){
  var ten=el('input',{type:'text',value:L.ten}),cg=el('input',{type:'text',value:L.cg||''});
  var vai=el('select',{},(L.loai==='duong'?[['tt','Đường tuần tra'],['duong','Đường khác']]:L.loai==='vung'?[['vp','Vùng vi phạm / khoanh vùng']]:[['diem','Điểm']]).map(function(x){return el('option',{value:x[0],text:x[1]})}));vai.value=L.vai;
  var mau=el('input',{type:'color',value:L.mau,style:'width:60px;height:40px;padding:2px'});
  var rong=el('select',{},[0.3,0.5,0.8,1,1.2,1.6,2].map(function(x){return el('option',{value:x,text:soVN(x,1)+' mm'})}));rong.value=String(L.rong);
  var kieu=el('select',{},(L.loai==='vung'?[['gach','Gạch chéo'],['to','Tô màu nhạt'],['dac','Tô đặc'],['','Chỉ đường viền']]:L.loai==='diem'?[['tron','Hình tròn'],['tam','Tam giác'],['vuong','Hình vuông']]:[['','Nét liền']]).map(function(x){return el('option',{value:x[0],text:x[1]})}));kieu.value=L.kieu||'';
  var net=el('select',{},[['lien','Nét liền'],['dut','Nét đứt']].map(function(x){return el('option',{value:x[0],text:x[1]})}));net.value=L.net||'lien';
  vai.onchange=function(){var k=KIEU_VAI[vai.value];if(k&&(!cg.value||Object.keys(KIEU_VAI).some(function(v){return KIEU_VAI[v].cg===cg.value})))cg.value=k.cg};
  var ov=el('div',{class:'xlov'},[el('div',{class:'xlbox bdf'},[el('div',{class:'gt',text:'Sửa lớp'}),
    el('label',{text:'Tên lớp'}),ten,el('label',{text:'Loại'}),vai,el('label',{text:'Tên trong chú giải (để trống: không đưa vào chú giải)'}),cg,
    el('div',{class:'hang'},[el('div',{},[el('label',{text:'Màu'}),mau]),el('div',{},[el('label',{text:L.loai==='diem'?'Cỡ':'Độ rộng nét'}),rong]),
      L.loai!=='duong'?el('div',{},[el('label',{text:'Kiểu'}),kieu]):null,L.loai!=='diem'?el('div',{},[el('label',{text:'Nét'}),net]):null]),
    el('div',{style:'display:flex;gap:8px;margin-top:12px'},[el('button',{class:'p',text:'Lưu',onclick:function(){
      L.ten=ten.value.trim()||L.ten;L.vai=vai.value;L.cg=cg.value.trim();L.mau=mau.value;L.rong=+rong.value;L.kieu=kieu.value;L.net=net.value;ov.remove();xong&&xong()}}),
      el('button',{class:'s',text:'Hủy',onclick:function(){ov.remove()}})])])]);
  document.body.appendChild(ov);
}

/* ---------- 9. TRANG IN (mm) ---------- */
var THANG_TL=[2000,5000,10000,15000,20000,25000,30000,40000,50000,75000,100000];
/* bố cục trang: trả các khung theo mm */
function boCuc(bt){
  var doc=bt.kho!=='ngang',W=doc?210:297,H=doc?297:210,l=doc?18:15,r=10,t=10,b=10;
  var dong=[bt.d1,bt.d2,bt.d3].filter(function(x){return x&&x.trim()}).length;
  var tieuDe=t+(dong?3+dong*6.3:0);
  var ky=chiaKy(bt.ttg),cot=doc?3:4,soHang=Math.ceil(ky.length/cot),hk=doc?24:19;
  var duoi=6+(bt.coKy||ky.length?8+(ky.length?soHang*hk:(doc?22:16)):0);
  var ngoai={x:l,y:tieuDe+2,w:W-l-r,h:0};ngoai.h=H-b-duoi-ngoai.y;
  var bang=bt.luoi?5:0,trong={x:ngoai.x+bang,y:ngoai.y+bang,w:ngoai.w-2*bang,h:ngoai.h-2*bang};
  return {W:W,H:H,l:l,r:r,t:t,b:b,ngoai:ngoai,trong:trong,bang:bang,ky:ky,cot:cot,hk:hk,duoiY:ngoai.y+ngoai.h};
}
function chiaKy(t){return String(t||'').split(/\r?\n/).map(function(s){return s.trim()}).filter(Boolean).map(function(s){
  var p=s.split(/\s*[|:–]\s*/);return p.length>1?{cv:p[0],ten:p.slice(1).join(' ')}:{cv:'',ten:s}})}
/* vẽ cả trang; k = px/mm; o.gps: hiện vị trí (chỉ màn hình) */
function veTrang(ctx,k,o){
  var bt=S.bt,B=boCuc(bt),T=function(v){return v*k};
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,T(B.W),T(B.H));
  var cx=(B.l+B.W-B.r)/2;
  /* tiêu đề */
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  var y=B.t+5.2;
  [[bt.d1,'bold ',4.9],[bt.d2,'bold ',4.1],[bt.d3,'',4.1]].forEach(function(d){if(!d[0]||!d[0].trim())return;ctx.font=d[1]+T(d[2])+'px '+FONT;
    chuVua(ctx,d[0].trim(),T(cx),T(y),T(B.W-B.l-B.r));y+=6.3});
  /* bản đồ */
  var tr=B.trong,s=k*1000/bt.N;
  var vp={x:T(tr.x),y:T(tr.y),w:T(tr.w),h:T(tr.h),cx:bt.cx,cy:bt.cy,s:s};
  veBanDo(ctx,vp,{mm:k,dpr:o.dpr||1,gps:o.gps,nhanh:o.nhanh,chu:1,bt:bt});
  /* khung + tọa độ */
  ctx.strokeStyle='#000';ctx.lineWidth=T(0.5);ctx.strokeRect(vp.x,vp.y,vp.w,vp.h);
  if(B.bang){ctx.lineWidth=T(0.25);ctx.strokeRect(T(B.ngoai.x),T(B.ngoai.y),T(B.ngoai.w),T(B.ngoai.h));if(!o.nhanh)veLuoi(ctx,k,B,vp)}
  if(bt.bac)veBac(ctx,k,tr);
  if(bt.thuoc)veThuoc(ctx,k,tr,bt.N);
  if(!o.nhanh||o.cg)veChuGiai(ctx,k,tr,vp);
  /* chú thích hệ tọa độ, thành phần tham gia */
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#000';ctx.font='italic '+T(3.3)+'px '+FONT;
  ctx.fillText('Hệ tọa độ VN-2000, múi chiếu 3°, kinh tuyến trục '+kttChu(ktt()),T(B.l),T(B.duoiY+4.6));
  ctx.textAlign='right';ctx.fillText('Tỷ lệ 1:'+so(bt.N).replace(/ /g,'.'),T(B.W-B.r),T(B.duoiY+4.6));
  if(bt.coKy||B.ky.length){
    ctx.textAlign='center';ctx.font='bold '+T(3.9)+'px '+FONT;ctx.fillText('THÀNH PHẦN THAM GIA',T(cx),T(B.duoiY+11.5));
    var n=B.ky.length,C=B.cot,cot=Math.min(C,n),w=(B.W-B.l-B.r)/Math.max(cot,1);
    B.ky.forEach(function(p,i){var h=Math.floor(i/C),c=i%C,soTrongHang=Math.min(C,n-h*C),x0=B.l+(B.W-B.l-B.r-soTrongHang*w)/2+c*w+w/2,y0=B.duoiY+17.5+h*B.hk;
      if(p.cv){ctx.font='bold '+T(3.4)+'px '+FONT;chuVua(ctx,p.cv,T(x0),T(y0),T(w-3))}
      ctx.font='bold '+T(3.6)+'px '+FONT;chuVua(ctx,p.ten,T(x0),T(y0+B.hk-7),T(w-3))});
  }
  return B;
}
function chuVua(ctx,t,x,y,w){var m=ctx.measureText(t).width;if(m>w){ctx.save();ctx.translate(x,y);ctx.scale(w/m,1);ctx.fillText(t,0,0);ctx.restore()}else ctx.fillText(t,x,y)}
function buocLuoi(rong){var b=[100,200,250,500,1000,2000,2500,5000,10000,20000,25000,50000];for(var i=0;i<b.length;i++)if(rong/b[i]<=6)return b[i];return 100000}
function veLuoi(ctx,k,B,vp){
  var T=function(v){return v*k},s=vp.s,e0=vp.cx-vp.w/2/s,e1=vp.cx+vp.w/2/s,n0=vp.cy-vp.h/2/s,n1=vp.cy+vp.h/2/s,d=buocLuoi(Math.max(e1-e0,n1-n0));
  ctx.strokeStyle='#000';ctx.fillStyle='#000';ctx.lineWidth=T(0.2);ctx.font=T(2.3)+'px '+FONT;
  var X=function(e){return vp.x+(e-e0)*s},Y=function(n){return vp.y+vp.h-(n-n0)*s};
  var o=B.ngoai,ty=T(o.y),by=T(o.y+o.h),lx=T(o.x),rx=T(o.x+o.w);
  for(var e=Math.ceil(e0/d)*d;e<=e1;e+=d){var x=X(e);if(x<vp.x+T(1)||x>vp.x+vp.w-T(1))continue;
    ctx.beginPath();ctx.moveTo(x,vp.y);ctx.lineTo(x,ty);ctx.moveTo(x,vp.y+vp.h);ctx.lineTo(x,by);ctx.moveTo(x,vp.y);ctx.lineTo(x,vp.y+T(1.5));ctx.moveTo(x,vp.y+vp.h);ctx.lineTo(x,vp.y+vp.h-T(1.5));ctx.stroke();
    var t=so(e);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';var w=ctx.measureText(t).width;
    ctx.fillRect(x-w/2-T(0.4),(ty+vp.y)/2-T(1.3),w+T(0.8),T(2.6));ctx.fillRect(x-w/2-T(0.4),(by+vp.y+vp.h)/2-T(1.3),w+T(0.8),T(2.6));
    ctx.fillStyle='#000';ctx.fillText(t,x,(ty+vp.y)/2);ctx.fillText(t,x,(by+vp.y+vp.h)/2)}
  for(var n=Math.ceil(n0/d)*d;n<=n1;n+=d){var y=Y(n);if(y<vp.y+T(1)||y>vp.y+vp.h-T(1))continue;
    ctx.beginPath();ctx.moveTo(vp.x,y);ctx.lineTo(lx,y);ctx.moveTo(vp.x+vp.w,y);ctx.lineTo(rx,y);ctx.moveTo(vp.x,y);ctx.lineTo(vp.x+T(1.5),y);ctx.moveTo(vp.x+vp.w,y);ctx.lineTo(vp.x+vp.w-T(1.5),y);ctx.stroke();
    var t2=so(n),w2=ctx.measureText(t2).width;
    [[(lx+vp.x)/2,-Math.PI/2],[(rx+vp.x+vp.w)/2,Math.PI/2]].forEach(function(q){ctx.save();ctx.translate(q[0],y);ctx.rotate(q[1]);ctx.fillStyle='#fff';ctx.fillRect(-w2/2-T(0.4),-T(1.3),w2+T(0.8),T(2.6));
      ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t2,0,0);ctx.restore()})}
  /* dấu chữ thập tại giao điểm lưới */
  ctx.save();ctx.beginPath();ctx.rect(vp.x,vp.y,vp.w,vp.h);ctx.clip();ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=T(0.18);
  for(e=Math.ceil(e0/d)*d;e<=e1;e+=d)for(n=Math.ceil(n0/d)*d;n<=n1;n+=d){var cx=X(e),cy=Y(n);ctx.beginPath();ctx.moveTo(cx-T(1.6),cy);ctx.lineTo(cx+T(1.6),cy);ctx.moveTo(cx,cy-T(1.6));ctx.lineTo(cx,cy+T(1.6));ctx.stroke()}
  ctx.restore();
}
function veBac(ctx,k,tr){var T=function(v){return v*k},x=T(tr.x+tr.w-8),y=T(tr.y+5);
  ctx.save();ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.arc(x,y+T(6.5),T(5.2),0,7);ctx.fill();
  ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineWidth=T(0.25);
  ctx.beginPath();ctx.moveTo(x,y+T(1.5));ctx.lineTo(x+T(2.4),y+T(10.5));ctx.lineTo(x,y+T(8.5));ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x,y+T(1.5));ctx.lineTo(x-T(2.4),y+T(10.5));ctx.lineTo(x,y+T(8.5));ctx.closePath();ctx.stroke();
  ctx.font='bold '+T(3.4)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('B',x,y+T(1.3));ctx.restore()}
function veThuoc(ctx,k,tr,N){var T=function(v){return v*k},goal=N*0.03,b=[10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000];var d=b[0];b.forEach(function(x){if(x<=goal)d=x});
  var w=d*1000/N,x=tr.x+tr.w-4-2*w,y=tr.y+tr.h-5;
  ctx.save();ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(T(x-3),T(y-7.5),T(2*w+8),T(10));
  ctx.lineWidth=T(0.2);ctx.strokeStyle='#000';
  for(var i=0;i<2;i++){ctx.fillStyle=i%2?'#fff':'#000';ctx.fillRect(T(x+i*w),T(y-1.2),T(w),T(1.2));ctx.strokeRect(T(x+i*w),T(y-1.2),T(w),T(1.2))}
  ctx.fillStyle='#000';ctx.font=T(2.4)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText('0',T(x),T(y-1.6));ctx.fillText(so(d),T(x+w),T(y-1.6));ctx.fillText(so(2*d)+' m',T(x+2*w),T(y-1.6));
  ctx.textBaseline='top';ctx.fillText('1:'+so(N).replace(/ /g,'.'),T(x+w),T(y+0.6));ctx.restore()}
/* kiểu chữ số hiệu tiểu khu/khoảnh của gói (nếu có) */
function kieuSoHieu(nh){if(!GOI||!GOI.g.soHieu)return null;var a=GOI.g.kieu.filter(function(k){return k&&k.nhom===nh});return a[0]||null}
/* số tiểu khu làm mẫu trong chú giải: tiểu khu ở tâm khung (hoặc tiểu khu đầu tiên) */
function tkMau(vp){var l=loTai(vp.cx,vp.cy);return l&&l.tt[0]?l.tt[0]:((GOI.tk[0]||{}).t||'1')}
/* các mục chú giải theo loại bản đồ */
function mucChuGiai(vp){
  var bt=S.bt,a=[],da={};
  /* khung không có lô nào của bản đồ nền → bỏ các mục tiểu khu, khoảnh, lô */
  var coNen=GOI&&GOI.lo.some(function(l){var b=l.bb,ox=GOI.ox,oy=GOI.oy,hw=vp.w/2/vp.s,hh=vp.h/2/vp.s;
    return b[2]+ox>=vp.cx-hw&&b[0]+ox<=vp.cx+hw&&b[3]+oy>=vp.cy-hh&&b[1]+oy<=vp.cy+hh});
  var kTk=kieuSoHieu('tk'),kKh=kieuSoHieu('kh');
  var veSH=function(kk,r0,mv0,w0,co0,t){return function(ctx,x,y,w,h,k){
    if(kk&&kk.vong){var f=Math.min(1,(h/2-0.3*k)/(kk.vong.r*k));vongTron(ctx,x+w/2,y+h/2,kk.vong.r*k*f,kk.vong.s||kk.mau,(kk.vong.w||0.2)*k,t,(kk.co||3)*k*f,kk.mau)}
    else vongTron(ctx,x+w/2,y+h/2,r0*k,mv0,w0*k,t,co0*k)}};
  if(coNen&&bt.cgTk&&bt.nhanTk)a.push({ve:veSH(kTk,4.4,'#1428d0',0.3,3.6,tkMau(vp)),t:'Số hiệu tiểu khu',mau:kTk?kTk.mau:'#1428d0'});
  if(coNen&&bt.cgTk&&bt.nhanKh)a.push({ve:veSH(kKh,2.6,'#000',0.2,2.8,'8'),t:'Số hiệu khoảnh'});
  if(coNen&&bt.cgLo)a.push({ve:function(ctx,x,y,w,h,k){var cx=x+w/2,cy=y+h/2;ctx.fillStyle='#000';ctx.font=2.6*k+'px '+FONT;ctx.textAlign='center';
      ctx.textBaseline='bottom';ctx.fillText('2 - TXP',cx,cy-0.3*k);ctx.textBaseline='top';ctx.fillText('2,35 ha',cx,cy+0.3*k);ctx.lineWidth=0.15*k;ctx.strokeStyle='#000';ctx.beginPath();ctx.moveTo(cx-5.5*k,cy);ctx.lineTo(cx+5.5*k,cy);ctx.stroke()},
    t:'Lô rừng - Trạng thái',t2:'Diện tích lô',gach:1});
  S.lop.forEach(function(L){
    if(L.hien===false||!L.cg)return;var kk=[L.loai,L.cg,L.mau,L.rong,L.kieu,L.net].join('|');if(da[kk])return;da[kk]=1;
    a.push({t:L.cg,ve:function(ctx,x,y,w,h,k){var X=function(v){return v},Y=X;
      if(L.loai==='duong'){ctx.strokeStyle=L.mau;ctx.lineWidth=(L.rong||0.8)*k;ctx.lineCap='round';ctx.setLineDash(L.net==='dut'?[2.5*k,1.2*k]:[]);ctx.beginPath();ctx.moveTo(x+1*k,y+h/2);ctx.lineTo(x+w-1*k,y+h/2);ctx.stroke();ctx.setLineDash([])}
      else if(L.loai==='vung'){ctx.beginPath();ctx.rect(x+1.5*k,y+h/2-3.2*k,w-3*k,6.4*k);toVung(ctx,L,k)}
      else veDiem(ctx,L,x+w/2,y+h/2,k)}});
  });
  if(coNen&&bt.cgMau){
    var co={};GOI.lo.forEach(function(l){var b=l.bb,ox=GOI.ox,oy=GOI.oy,s=vp.s;
      var x1=vp.x+vp.w/2+(b[0]+ox-vp.cx)*s,x2=vp.x+vp.w/2+(b[2]+ox-vp.cx)*s,y1=vp.y+vp.h/2-(b[3]+oy-vp.cy)*s,y2=vp.y+vp.h/2-(b[1]+oy-vp.cy)*s;
      if(x2<vp.x||x1>vp.x+vp.w||y2<vp.y||y1>vp.y+vp.h)return;var tt=(l.tt[3]||'').toUpperCase();if(tt&&!co[tt])co[tt]=1});
    var mau={};GOI.g.lop.forEach(function(L){if(L.lo)L.ds.forEach(function(f,i){var t=(L.tt[i][3]||'').toUpperCase();if(t&&!mau[t])mau[t]=GOI.g.kieu[f[0]].f})});
    Object.keys(co).sort().forEach(function(t){a.push({t:t+(TT_TEN[t]?' – '+TT_TEN[t]:''),nho:1,ve:function(ctx,x,y,w,h,k){ctx.fillStyle=mau[t]||'#fff';ctx.strokeStyle='#000';ctx.lineWidth=0.15*k;
      ctx.fillRect(x+3*k,y+h/2-2.4*k,w-6*k,4.8*k);ctx.strokeRect(x+3*k,y+h/2-2.4*k,w-6*k,4.8*k)}})});
  }
  return a;
}
function veChuGiai(ctx,k0,tr,vp){
  var a=mucChuGiai(vp);if(!a.length)return;
  var cao=11+a.reduce(function(s,m){return s+(m.nho?6:m.t2?9:8.2)},0),f=Math.min(1,(tr.h-2)/cao,(tr.w*0.6)/70);
  var k=k0*f;tr={x:tr.x/f,y:tr.y/f,w:tr.w/f,h:tr.h/f};var T=function(v){return v*k};
  var wk=16,pad=3,coT=3.3,dongH=function(m){return m.nho?6:m.t2?9:8.2};
  ctx.font=T(coT)+'px '+FONT;var wt=0;a.forEach(function(m){ctx.font=T(m.nho?2.8:coT)+'px '+FONT;wt=Math.max(wt,ctx.measureText(m.t).width/k,m.t2?ctx.measureText(m.t2).width/k:0)});
  var W=Math.min(tr.w*0.62,pad*2+wk+4+wt+1),H=9+a.reduce(function(s,m){return s+dongH(m)},0)+2;
  var vt=S.bt.vtCg||'dt',x=vt[1]==='t'?tr.x:tr.x+tr.w-W,y=vt[0]==='d'?tr.y+tr.h-H:tr.y;
  ctx.save();ctx.fillStyle='#fff';ctx.fillRect(T(x),T(y),T(W),T(H));ctx.strokeStyle='#000';ctx.lineWidth=T(0.35);ctx.strokeRect(T(x),T(y),T(W),T(H));
  ctx.fillStyle='#000';ctx.font='bold '+T(4)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='alphabetic';var tx=T(x+W/2);ctx.fillText('CHÚ GIẢI',tx,T(y+6.5));
  var tw=ctx.measureText('CHÚ GIẢI').width;ctx.lineWidth=T(0.3);ctx.beginPath();ctx.moveTo(tx-tw/2,T(y+7.2));ctx.lineTo(tx+tw/2,T(y+7.2));ctx.stroke();
  var yy=y+9;
  a.forEach(function(m){var h=dongH(m);ctx.save();m.ve(ctx,T(x+pad),T(yy),T(wk),T(h),k);ctx.restore();
    ctx.fillStyle=m.mau||'#000';ctx.textAlign='left';ctx.font=T(m.nho?2.8:coT)+'px '+FONT;var x2=T(x+pad+wk+4),w2=T(W-pad*2-wk-4);
    if(m.t2){ctx.textBaseline='bottom';chuTrai(ctx,m.t,x2,T(yy+h/2-0.3),w2);ctx.textBaseline='top';chuTrai(ctx,m.t2,x2,T(yy+h/2+0.3),w2);
      if(m.gach){var w3=Math.max(ctx.measureText(m.t).width,ctx.measureText(m.t2).width);ctx.strokeStyle='#000';ctx.lineWidth=T(0.15);ctx.beginPath();ctx.moveTo(x2,T(yy+h/2));ctx.lineTo(x2+Math.min(w3,w2),T(yy+h/2));ctx.stroke()}}
    else{ctx.textBaseline='middle';chuTrai(ctx,m.t,x2,T(yy+h/2),w2)}
    yy+=h});
  ctx.restore();
}
function chuTrai(ctx,t,x,y,w){var m=ctx.measureText(t).width;if(m>w){ctx.save();ctx.translate(x,y);ctx.scale(w/m,1);ctx.fillText(t,0,0);ctx.restore()}else ctx.fillText(t,x,y)}

/* tự điền tiêu đề: loại bản đồ, tiểu khu & xã nơi có đường/vùng, ngày */
function tuDien(ep){
  var bt=S.bt,ts=bt.tuSua||{},coVp=S.lop.some(function(L){return L.hien!==false&&L.vai==='vp'});
  if(!ts.loai||ep)bt.loai=coVp?'vp':'tt';
  if(!ts.d1||ep)bt.d1=bt.loai==='vp'?'SƠ ĐỒ VỊ TRÍ VI PHẠM':'SƠ ĐỒ TUYẾN TUẦN TRA RỪNG';
  var tk={},xa=GOI&&(GOI.g.xa||GOI.g.ten)||'';
  S.lop.forEach(function(L){if(L.hien===false)return;var pts=[];
    if(L.loai==='duong')L.ds.forEach(function(a){for(var i=0;i<a.length;i+=Math.max(2,2*Math.floor(a.length/2/60)))pts.push([a[i],a[i+1]])});
    else if(L.loai==='vung')L.ds.forEach(function(p){var a=p[0];for(var i=0;i<a.length;i+=Math.max(2,2*Math.floor(a.length/2/20)))pts.push([a[i],a[i+1]])});
    else L.ds.forEach(function(a){pts.push(a)});
    pts.forEach(function(p){var l=loTai(p[0],p[1]);if(l&&l.tt[0])tk[l.tt[0]]=(tk[l.tt[0]]||0)+1})});
  var dsTk=Object.keys(tk).sort(function(a,b){return tk[b]-tk[a]}).slice(0,4).sort();
  xa=xa?xa.replace(/^Xã/,'xã').replace(/^Phường/,'phường'):'';
  if(!ts.d2||ep)bt.d2=(dsTk.length?'Tiểu khu '+dsTk.join(', ')+(xa?', ':''):'')+xa;
  var ng=[];S.lop.forEach(function(L){if(L.hien!==false&&L.ngay)ng.push(L.ngay[0],L.ngay[1])});ng.sort();
  if(!ts.d3||ep){var n=ng.length?[ng[0],ng[ng.length-1]]:null,h=new Date(),hn=h.getFullYear()+'-'+('0'+(h.getMonth()+1)).slice(-2)+'-'+('0'+h.getDate()).slice(-2);
    bt.d3='ngày '+ngayChu(n||[hn,hn])}
  if(ep)bt.tuSua={};
}
function vuaTrang(){
  var bt=S.bt,B=boCuc(bt),b=hopLop(S.lop)||(GOI?GOI.g.bbox.slice():null);if(!b)return;
  var tr=B.trong,mx=Math.max(80,(b[2]-b[0])*1.15),my=Math.max(80,(b[3]-b[1])*1.15),N=Math.max(mx/tr.w,my/tr.h)*1000;
  bt.cx=(b[0]+b[2])/2;bt.cy=(b[1]+b[3])/2;
  bt.N=bt.tyLe?bt.tyLe:Math.ceil(N/500)*500;
}

/* ---------- 10. MÀN BIÊN TẬP ---------- */
function manBienTap(){
  css();var bt=S.bt;
  var dauLop=S.lop.filter(function(L){return L.hien!==false}).map(function(L){return L.id}).sort().join(',');
  if(bt.cx==null||!bt.N||bt.lopKhop!==dauLop){tuDien();vuaTrang();bt.lopKhop=dauLop}
  var cv=el('canvas',{class:'bdtrang'}),dpr=Math.min(window.devicePixelRatio||1,2.5),kTrang=1;
  var tlSel=el('select',{},[el('option',{value:'0',text:'Tự do (kéo, chụm để phóng to)'})].concat(THANG_TL.map(function(n){return el('option',{value:n,text:'1:'+so(n).replace(/ /g,'.')})})));tlSel.value=String(bt.tyLe||0);
  var oTl=el('span',{class:'hint'});
  var o=function(ten,nhan,sauKhi){var c=el('input',{type:'checkbox'});c.checked=!!bt[ten];c.onchange=function(){bt[ten]=c.checked;sauKhi&&sauKhi();doi()};return el('label',{class:'ck'},[c,nhan])};
  var inp=function(ten,ph){var i=el('input',{type:'text',value:bt[ten]||'',placeholder:ph||''});i.oninput=function(){bt[ten]=i.value;bt.tuSua[ten]=1;doi()};return i};
  var d1=inp('d1'),d2=inp('d2'),d3=inp('d3');
  var ttg=el('textarea',{rows:3,placeholder:'Mỗi người một dòng, có thể ghi chức danh trước dấu |\nVD: Kiểm lâm địa bàn | Nguyễn Văn A'});ttg.value=bt.ttg||'';ttg.oninput=function(){bt.ttg=ttg.value;doi(1)};
  var loai=el('select',{},[['tt','Sơ đồ tuần tra'],['vp','Sơ đồ vi phạm']].map(function(x){return el('option',{value:x[0],text:x[1]})}));loai.value=bt.loai;
  loai.onchange=function(){bt.loai=loai.value;bt.tuSua.loai=1;if(!bt.tuSua.d1){bt.d1=bt.loai==='vp'?'SƠ ĐỒ VỊ TRÍ VI PHẠM':'SƠ ĐỒ TUYẾN TUẦN TRA RỪNG';d1.value=bt.d1}doi()};
  var kho=el('select',{},[['doc','A4 dọc'],['ngang','A4 ngang']].map(function(x){return el('option',{value:x[0],text:x[1]})}));kho.value=bt.kho;kho.onchange=function(){bt.kho=kho.value;coKhung();doi(1)};
  var vtCg=el('select',{},[['dt','Dưới trái'],['dp','Dưới phải'],['tt','Trên trái'],['tp','Trên phải']].map(function(x){return el('option',{value:x[0],text:x[1]})}));vtCg.value=bt.vtCg;vtCg.onchange=function(){bt.vtCg=vtCg.value;doi()};
  tlSel.onchange=function(){bt.tyLe=+tlSel.value;if(bt.tyLe)bt.N=bt.tyLe;doi()};
  var dsLopCg=el('div',{});
  function veLopCg(){dsLopCg.innerHTML='';S.lop.forEach(function(L){
    var ck=el('input',{type:'checkbox'});ck.checked=L.hien!==false;ck.onchange=function(){L.hien=ck.checked;doi()};
    var cg=el('input',{type:'text',value:L.cg||'',placeholder:'(không đưa vào chú giải)'});cg.oninput=function(){L.cg=cg.value;doi()};
    dsLopCg.appendChild(el('div',{style:'border-bottom:1px solid var(--line);padding:6px 0'},[el('label',{class:'ck'},[ck,L.ten+' · '+moTa(L)]),
      el('div',{style:'display:flex;gap:6px'},[cg,el('button',{class:'s',text:'✏️',onclick:function(){suaLop(L,function(){luu(1);veLopCg();doi()})}})])]))});
    if(!S.lop.length)dsLopCg.appendChild(el('div',{class:'hint',text:'Chưa có lớp nào. Quay lại màn bản đồ, bấm "➕ Nhập file".'}))}
  veLopCg();
  var nutChu=el('button',{class:'s',text:'✏️ Thêm chữ lên bản đồ',onclick:function(){var t=prompt('Chữ ghi trên bản đồ (VD: XÃ LƯỢNG MINH):');if(!t)return;
    S.chu.push({t:t,e:bt.cx,n:bt.cy,co:4,nghieng:/^[A-ZÀ-Ỹ\s]+$/.test(t)?1:0,mau:'#000'});doi();thongBao('Kéo chữ đến chỗ cần đặt. Chạm vào chữ để sửa/xóa.',4000)}});
  var nutPdf=el('button',{class:'p',text:'📄 Xuất PDF',onclick:function(){xuat('pdf',nutPdf)}}),nutAnh=el('button',{class:'s',text:'🖼️ Xuất ảnh JPG',onclick:function(){xuat('jpg',nutAnh)}});
  var form=el('div',{class:'bdf'},[
    el('div',{class:'hang'},[el('div',{},[el('label',{text:'Loại sơ đồ'}),loai]),el('div',{},[el('label',{text:'Khổ giấy'}),kho])]),
    el('label',{text:'Tiêu đề (dòng 1, 2, 3)'}),d1,el('div',{style:'height:4px'}),d2,el('div',{style:'height:4px'}),d3,
    el('p',{style:'margin:4px 0'},[el('span',{class:'link',text:'↻ Tự điền lại tiêu đề theo các lớp đang hiện',onclick:function(){tuDien(true);d1.value=bt.d1;d2.value=bt.d2;d3.value=bt.d3;loai.value=bt.loai;doi()}})]),
    el('div',{class:'hang'},[el('div',{},[el('label',{text:'Tỷ lệ'}),tlSel]),el('div',{},[el('label',{text:'Vị trí chú giải'}),vtCg])]),oTl,
    el('p',{style:'margin:6px 0'},[el('button',{class:'s',text:'⤢ Vừa khít các lớp',onclick:function(){vuaTrang();doi()}}),' ',nutChu]),
    el('label',{text:'Lớp hiển thị & tên trong chú giải'}),dsLopCg,
    el('label',{text:'Hiển thị'}),
    el('div',{},[o('luoi','Khung tọa độ',coKhung),o('nhanTk','Số hiệu tiểu khu'),o('nhanKh','Số hiệu khoảnh'),o('nhanDh','Tên sông suối, núi, độ cao'),o('nhanLo','Nhãn lô (≤1:25.000)'),o('bac','Hướng Bắc'),o('thuoc','Thước tỷ lệ')]),
    el('label',{text:'Chú giải'}),
    el('div',{},[o('cgTk','Tiểu khu, khoảnh'),o('cgLo','Lô – trạng thái – diện tích'),o('cgMau','Màu trạng thái rừng')]),
    el('label',{text:'Thành phần tham gia (ký tên)'}),ttg,el('div',{},[o('coKy','Có phần "THÀNH PHẦN THAM GIA"')]),
    el('div',{class:'hint',text:'Kéo bằng 1 ngón để di chuyển bản đồ trong khung, chụm 2 ngón để phóng to/thu nhỏ (khi tỷ lệ "Tự do"). Vị trí GPS của bạn chỉ hiện khi xem, không có trong file xuất.'}),
    el('div',{style:'display:flex;gap:8px;margin:12px 0 10px'},[nutPdf,nutAnh]),
    el('div',{style:'margin:0 0 30px'},[nutLamMoi(function(){manXem()})])]);
  var oCanh=el('div',{class:'warn',style:'display:none;margin:0 0 8px'}),khungTrang=el('div',{});khungTrang.appendChild(oCanh);khungTrang.appendChild(cv);
  show([el('div',{class:'bdbt rong'},[khungTrang,form])],function(){luu(1);manXem()});
  $('app').className='bd';
  function coKhung(){var B=boCuc(bt),w=khungTrang.getBoundingClientRect().width||360;
    var h=w*B.H/B.W,maxH=window.innerHeight*(window.innerWidth>=980?0.9:1.6);if(h>maxH){w=maxH*B.W/B.H;h=maxH}
    cv.style.width=w+'px';cv.style.height=h+'px';cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);kTrang=cv.width/B.W}
  var nhanhCho=false;
  function ve(nhanh){var ctx=cv.getContext('2d');var B=veTrang(ctx,kTrang,{gps:1,dpr:dpr,nhanh:nhanh,cg:1});
    oTl.textContent='Tỷ lệ hiện tại 1:'+so(bt.N).replace(/ /g,'.')+(bt.tyLe?'':' (tự do)');
    /* các lớp đã nhập nằm ngoài khung in → nhắc */
    var b=hopLop(S.lop),t=B.trong,hw=t.w*bt.N/2000,hh=t.h*bt.N/2000;
    var ngoai=b&&(b[2]<bt.cx-hw||b[0]>bt.cx+hw||b[3]<bt.cy-hh||b[1]>bt.cy+hh);
    oCanh.style.display=ngoai?'':'none';
    if(ngoai&&!oCanh.firstChild)oCanh.appendChild(el('div',{},['⚠️ Đường/vùng đã nhập đang nằm ngoài khung bản đồ. ',
      el('span',{class:'link',text:'Đưa vào giữa khung',onclick:function(){vuaTrang();doi()}})]))}
  var veNhanh=moiKhung(function(){ve(true)});
  var HEN=0;function doi(boCucDoi){if(boCucDoi)coKhung();clearTimeout(HEN);HEN=setTimeout(function(){ve();luu()},60)}
  coKhung();ve();
  /* cử chỉ trong khung bản đồ; chạm/kéo chữ */
  var keoChu=null;
  var trongKhung=function(x,y){var B=boCuc(bt),t=B.trong;return x>=t.x*kTrang&&x<=(t.x+t.w)*kTrang&&y>=t.y*kTrang&&y<=(t.y+t.h)*kTrang};
  var chuTai=function(x,y){for(var i=S.chu.length-1;i>=0;i--){var b=S.chu[i]._bb;if(b&&x>=b[0]-6&&x<=b[2]+6&&y>=b[1]-6&&y<=b[3]+6)return S.chu[i]}return null};
  cuChi(cv,{cho:trongKhung,
    bd:function(x,y){keoChu=chuTai(x,y);return {cx:bt.cx,cy:bt.cy,N:bt.N,c:keoChu?{e:keoChu.e,n:keoChu.n}:null}},
    keo:function(c,dx,dy,k,m){var s0=kTrang*1000/c.N;
      if(c.c&&keoChu){keoChu.e=c.c.e+dx/s0;keoChu.n=c.c.n-dy/s0;veNhanh();return}
      var B=boCuc(bt),t=B.trong,mx=(t.x+t.w/2)*kTrang,my=(t.y+t.h/2)*kTrang;
      var N=bt.tyLe?c.N:Math.max(500,Math.min(500000,c.N/k)),s=kTrang*1000/N;
      var wx=c.cx+(m[0]-mx)/s0,wy=c.cy-(m[1]-my)/s0;bt.N=N;bt.cx=wx-(m[0]+dx-mx)/s;bt.cy=wy+(m[1]+dy-my)/s;veNhanh()},
    xong:function(){if(!bt.tyLe)bt.N=Math.max(500,Math.round(bt.N/100)*100);keoChu=null;ve();luu()},
    cham:function(x,y){var c=chuTai(x,y);if(!c)return;var t=prompt('Sửa chữ (để trống để xóa):',c.t);if(t===null)return;
      if(!t.trim())S.chu.splice(S.chu.indexOf(c),1);else c.t=t;doi()}});
  window.addEventListener('resize',function rs(){if(!document.body.contains(cv)){window.removeEventListener('resize',rs);return}coKhung();ve()});
  batGps(function(){if(!document.body.contains(cv))return false;veNhanh()});
  function xuat(kieu,nut){
    var cu=nut.textContent;nut.disabled=true;nut.textContent='Đang tạo…';
    setTimeout(function(){
      try{
        var B=boCuc(bt),dpi=kieu==='pdf'?300:250,k=dpi/25.4,c=document.createElement('canvas');c.width=Math.round(B.W*k);c.height=Math.round(B.H*k);
        veTrang(c.getContext('2d'),k,{gps:0,dpr:1});
        c.toBlob(function(b){
          nut.disabled=false;nut.textContent=cu;if(!b){alert('Máy không đủ bộ nhớ để tạo file.');return}
          var ten=tenFile(bt)+'.'+(kieu==='pdf'?'pdf':'jpg');
          if(kieu==='jpg'){chiaSeFile(b,ten,'🖼️');return}
          b.arrayBuffer().then(function(buf){chiaSeFile(pdfTuJpg(new Uint8Array(buf),c.width,c.height,B.W,B.H),ten,'📄')});
        },'image/jpeg',0.9);
      }catch(e){nut.disabled=false;nut.textContent=cu;alert('Lỗi tạo file: '+errMsg(e))}
    },30);
  }
}
function tenFile(bt){var t=(bt.loai==='vp'?'So_do_vi_pham':'So_do_tuan_tra')+'_'+(bt.d3||'').replace(/^ngày\s*/,'').replace(/[^\d]+/g,'-').replace(/^-|-$/g,'');return t.replace(/_$/,'')}
/* PDF 1 trang chứa ảnh JPEG (khổ theo mm) */
function pdfTuJpg(jpg,w,h,wmm,hmm){
  var W=(wmm*72/25.4).toFixed(2),H=(hmm*72/25.4).toFixed(2),enc=new TextEncoder(),parts=[],off=[],len=0;
  var add=function(x){var b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length};
  var obj=function(n,s){off[n]=len;add(n+' 0 obj\n'+s+'\nendobj\n')};
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  off[4]=len;add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');add(jpg);add('\nendstream\nendobj\n');
  var nd='q '+W+' 0 0 '+H+' 0 0 cm /Im0 Do Q';obj(5,'<< /Length '+nd.length+' >>\nstream\n'+nd+'\nendstream');
  var xr=len,x='xref\n0 6\n0000000000 65535 f \n';for(var i=1;i<=5;i++)x+=('000000000'+off[i]).slice(-10)+' 00000 n \n';
  add(x+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}
BD._t={gps:function(){return {GPS:GPS,dangBat:GPS_ID!==null,soNghe:GPS_NGHE.length}},veTrang:veTrang,boCuc:boCuc,giaiMa:giaiMa,docGpx:docGpx,docKml:docKml,docGeoJson:docGeoJson,docMif:docMif,themLop:themLop,tuDien:tuDien,vuaTrang:vuaTrang,
  S:function(){return S},datGoi:function(g){GOI=giaiMa(g)},nap:nap,pdfTuJpg:pdfTuJpg,loTai:loTai,manBienTap:function(){manBienTap()},manXem:function(){manXem()}};
})();
