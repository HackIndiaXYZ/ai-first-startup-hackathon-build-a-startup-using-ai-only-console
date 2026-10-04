/* RecallScope film: native Canvas reconstruction of the pharmaceutical interface.
 * No screenshots, raster UI textures, hidden network requests, or product changes.
 * Coordinates are authored at 1600 × 920. All fixture values are from pharma/seed.ts
 * and pharma/templates.ts; presentation fields intentionally identify sample records.
 */
'use strict';

const UI_WIDTH = 1600;
const UI_HEIGHT = 920;
const productPalette = {
  light: { bg:'#f4f5f2',card:'#ffffff',subtle:'#f8f9f6',ink:'#203333',muted:'#667873',border:'#dde4dd',accent:'#17645b',accentSoft:'#e9f3ed',nav:'#1e3535',good:'#277247',goodBg:'#eaf4ec',warn:'#936722',warnBg:'#faf2df',danger:'#ab4a3c',dangerBg:'#fbebe7' },
  dark: { bg:'#101a1a',card:'#182525',subtle:'#142020',ink:'#e0ebe5',muted:'#9aafa8',border:'#2e403d',accent:'#92d0b4',accentSoft:'#223d33',nav:'#142222',good:'#9acba2',goodBg:'#233e2d',warn:'#e4bc72',warnBg:'#3b3424',danger:'#eda692',dangerBg:'#3e2b28' }
};
const focusRects = {
  overview: { full:{x:0,y:0,w:1600,h:920},metrics:{x:322,y:307,w:1236,h:153},case:{x:322,y:485,w:718,h:389},accounting:{x:348,y:785,w:666,h:65} },
  catalogue: { identity:{x:340,y:577,w:1196,h:148},row:{x:342,y:580,w:1188,h:73},sameCode:{x:738,y:580,w:218,h:143} },
  trace: { modal:{x:354,y:115,w:1198,h:775},graph:{x:388,y:370,w:1130,h:455},supplier:{x:388,y:435,w:287,h:341},warehouses:{x:706,y:435,w:301,h:341},recipients:{x:1038,y:435,w:478,h:341} },
  intake: { modal:{x:340,y:116,w:1210,h:780},source:{x:369,y:345,w:440,h:450},review:{x:829,y:345,w:689,h:450},approve:{x:1242,y:830,w:275,h:48},quantity:{x:851,y:569,w:643,h:195} },
  recall: { metrics:{x:322,y:416,w:1236,h:155},returnRow:{x:350,y:712,w:1178,h:43},case:{x:322,y:309,w:1236,h:86},recipients:{x:322,y:594,w:1236,h:284} },
  reports: { snapshot:{x:346,y:455,w:1174,h:247},sources:{x:346,y:728,w:1174,h:115},audit:{x:338,y:461,w:1193,h:369},reason:{x:913,y:680,w:466,h:90} }
};
const NAV = [['overview','Overview','grid'],['catalogue','Products & batches','box'],['stock','Stock','boxes'],['deliveries','Deliveries','truck'],['recall','Recalls','shield'],['intake','Documents','folder'],['reports','Reports','chart'],['settings','Settings','sliders']];
const DESCRIPTIONS = {
  overview:['Your distribution desk','A clear view of every batch.','Stock, distribution and recall evidence in one connected workspace.'],
  catalogue:['Catalogue','Products & batches','Keep product identity, batch labels and expiry evidence together.'],
  trace:['Catalogue','Products & batches','Keep product identity, batch labels and expiry evidence together.'],
  intake:['Document workspace','Records with their evidence.','Start with guided examples, import structured records or use optional live AI.'],
  recall:['Quality operations','From recall to reconciliation.','Define the scope, coordinate recipients and account for every affected quantity.'],
  reports:['Evidence & reporting','A record you can explain.','Fixed snapshots, original sources and an inspectable decision history.']
};
const clamp = n => Math.min(1,Math.max(0,Number(n)||0));
const number = n => Number(n).toLocaleString('en-US');
function font(ctx,size=20,weight=400,mono=false) { ctx.font=`${Math.round(weight/100)*100} ${size}px ${mono?'Consolas':'"Segoe UI"'}, ${mono?'monospace':'Arial, sans-serif'}`; }
function pathRound(ctx,x,y,w,h,r=10) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
function rect(ctx,x,y,w,h,fill,stroke=null,r=10,line=1) { pathRound(ctx,x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();} }
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function text(ctx,value,x,y,opts={}) {
  const {size=20,weight=400,color='#203333',width=Infinity,maxLines=1,lineHeight=size*1.35,mono=false,align='left'}=opts;
  font(ctx,size,weight,mono);ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign=align;
  const paras=String(value).split('\n');const lines=[];
  for(const para of paras){let current='';for(const word of para.split(/\s+/)){const candidate=current?`${current} ${word}`:word;if(ctx.measureText(candidate).width<=width||!current){current=candidate;}else{lines.push(current);current=word;}}lines.push(current);}
  const shown=lines.slice(0,maxLines);
  if(lines.length>maxLines&&shown.length){let last=shown[shown.length-1];while(last.length&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);shown[shown.length-1]=last+'…';}
  shown.forEach((s,i)=>ctx.fillText(s,x,y+i*lineHeight));ctx.textAlign='left';return shown.length*lineHeight;
}
function icon(ctx,name,x,y,size=22,color='#667873') {
  ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.lineWidth=1.55;ctx.lineCap='round';ctx.lineJoin='round';
  const p=pts=>{ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.stroke();};
  if(name==='grid'){[[3,3],[14,3],[3,14],[14,14]].forEach(([a,b])=>rect(ctx,a,b,7,7,null,color,1,1.5));}
  else if(name==='box'||name==='boxes'){p([[12,2],[22,7],[22,17],[12,22],[2,17],[2,7],[12,2],[12,22]]);p([[2,7],[12,12],[22,7]]);if(name==='boxes')p([[7,4.5],[17,9.5],[17,19.5]]);}
  else if(name==='truck'){rect(ctx,1,5,13,12,null,color,1,1.5);p([[14,9],[19,9],[23,13],[23,17],[14,17]]);[6,19].forEach(a=>{ctx.beginPath();ctx.arc(a,18,2.3,0,Math.PI*2);ctx.stroke();});}
  else if(name==='shield'){p([[12,2],[21,6],[20,15],[17,20],[12,23],[7,20],[4,15],[3,6],[12,2]]);p([[8,12],[11,15],[16,9]]);}
  else if(name==='folder'){p([[2,7],[2,3],[9,3],[12,6],[22,6],[22,9]]);p([[2,7],[22,7],[19,21],[1,21],[2,7]]);}
  else if(name==='chart'){p([[2,2],[2,22],[23,22]]);p([[7,18],[7,11]]);p([[13,18],[13,5]]);p([[19,18],[19,9]]);}
  else if(name==='sliders'){[6,12,18].forEach((yy,i)=>{p([[2,yy],[22,yy]]);rect(ctx,5+i*4,yy-2.5,4,5,null,color,1,1.5);});}
  else if(name==='search'){ctx.beginPath();ctx.arc(10,10,7,0,Math.PI*2);ctx.stroke();p([[15,15],[22,22]]);}
  else if(name==='scan'){p([[2,8],[2,3],[8,3]]);p([[16,3],[22,3],[22,8]]);p([[22,16],[22,21],[16,21]]);p([[8,21],[2,21],[2,16]]);p([[8,12],[16,12]]);}
  else if(name==='document'){p([[4,2],[15,2],[21,8],[21,22],[4,22],[4,2]]);p([[15,2],[15,8],[21,8]]);[12,16].forEach(yy=>p([[8,yy],[17,yy]]));}
  else if(name==='calendar'){rect(ctx,2,4,20,18,null,color,2,1.5);p([[2,9],[22,9]]);p([[7,1],[7,6]]);p([[17,1],[17,6]]);p([[7,14],[10,14]]);p([[14,14],[17,14]]);}
  else if(name==='building'){rect(ctx,4,3,16,19,null,color,1,1.5);[7,12].forEach(yy=>{p([[8,yy],[9,yy]]);p([[15,yy],[16,yy]]);});p([[10,22],[10,17],[14,17],[14,22]]);}
  else if(name==='check'){p([[3,12],[9,18],[21,5]]);}
  else if(name==='lock'){rect(ctx,4,10,16,12,null,color,2,1.5);ctx.beginPath();ctx.arc(12,10,5,Math.PI,0);ctx.stroke();p([[12,15],[12,18]]);}
  else if(name==='download'){p([[12,2],[12,16],[6,10]]);p([[12,16],[18,10]]);p([[3,16],[3,22],[21,22],[21,16]]);}
  else if(name==='arrow'){p([[2,12],[22,12],[16,6]]);p([[22,12],[16,18]]);}
  else if(name==='return'){p([[20,5],[6,5],[6,19],[13,12]]);p([[6,19],[0,12]]);}
  else if(name==='moon'){ctx.beginPath();ctx.arc(13,12,9,.4,Math.PI*1.65);ctx.bezierCurveTo(9,9,12,3,18,3);ctx.stroke();}
  else if(name==='sparkles'){p([[12,1],[15,9],[23,12],[15,15],[12,23],[9,15],[1,12],[9,9],[12,1]]);}
  else if(name==='plus'){p([[12,3],[12,21]]);p([[3,12],[21,12]]);}
  else if(name==='close'){p([[5,5],[19,19]]);p([[19,5],[5,19]]);}
  ctx.restore();
}
function badge(ctx,label,x,y,p,tone='neutral',size=18){const c=tone==='good'?[p.goodBg,p.good]:tone==='warn'?[p.warnBg,p.warn]:tone==='accent'?[p.accentSoft,p.accent]:[p.subtle,p.muted];font(ctx,size,600);const w=ctx.measureText(label).width+20;rect(ctx,x,y,w,size+14,c[0],tone==='neutral'?p.border:null,4);text(ctx,label,x+10,y+5,{size,weight:600,color:c[1]});return w;}
function button(ctx,label,x,y,w,p,primary=false,ic=null,h=48){rect(ctx,x,y,w,h,primary?p.accent:p.card,primary?null:p.border,7);const col=primary?(p.bg==='#101a1a'?'#142222':'#ffffff'):p.ink;if(ic)icon(ctx,ic,x+15,y+(h-20)/2,20,col);text(ctx,label,x+(ic?45:w/2),y+(h-25)/2,{size:20,weight:primary?500:400,color:col,align:ic?'left':'center',width:w-(ic?55:20)});}
function panel(ctx,x,y,w,h,p){rect(ctx,x,y,w,h,p.card,p.border,12);}
function search(ctx,x,y,w,p,label){rect(ctx,x,y,w,47,p.card,p.border,7);icon(ctx,'search',x+15,y+12,22,p.muted);text(ctx,label,x+49,y+11,{size:19,color:p.muted,width:w-68});}
function tabs(ctx,labels,active,x,y,w,p){let xx=x;labels.forEach((label,i)=>{font(ctx,20,i===active?600:400);const ww=ctx.measureText(label).width+36;text(ctx,label,xx+18,y+18,{size:20,weight:i===active?600:400,color:i===active?p.accent:p.muted});if(i===active)line(ctx,xx,y+59,xx+ww,y+59,p.accent,3);xx+=ww+4;});line(ctx,x,y+61,x+w,y+61,p.border);}
function field(ctx,label,value,x,y,w,p,{mono=false,highlight=false}={}){text(ctx,label,x,y,{size:19,weight:500,color:p.ink});rect(ctx,x,y+30,w,48,p.card,highlight?p.accent:p.border,6,highlight?2:1);text(ctx,value,x+13,y+41,{size:20,color:p.ink,mono,width:w-26});}
function stat(ctx,label,value,note,x,y,w,p,ic='box',unit=''){icon(ctx,ic,x,y+2,19,p.muted);text(ctx,label,x+29,y,{size:18,color:p.muted,width:w-34,maxLines:2,lineHeight:22});text(ctx,number(value),x,y+48,{size:43,weight:600,color:p.ink});font(ctx,43,600);const width=ctx.measureText(number(value)).width;if(unit)text(ctx,unit,x+width+8,y+66,{size:20,color:p.muted});text(ctx,note,x,y+105,{size:17,color:p.muted,width:w,maxLines:2,lineHeight:22});}
function highlight(ctx,r,p,amount=1){if(!r||amount<=0)return;ctx.save();ctx.globalAlpha=.65*amount;rect(ctx,r.x,r.y,r.w,r.h,null,p.accent,9,3);ctx.restore();}

function shell(ctx,view,p,state){
  rect(ctx,0,0,1600,920,p.bg,null,0);rect(ctx,0,0,282,920,p.nav,null,0);
  rect(ctx,28,32,41,41,null,'#819d8c',11);icon(ctx,'scan',38,42,22,'#b6d6ba');text(ctx,'RecallScope',81,33,{size:29,weight:700,color:'#ffffff'});
  line(ctx,29,118,253,118,'#ffffff20');text(ctx,'Asterbridge Distribution',29,145,{size:20,weight:600,color:'#e5ede6',width:225});text(ctx,'Pharmaceutical distribution',29,176,{size:17,color:'#9eb1a7',width:229});
  text(ctx,'WORKSPACE',31,234,{size:16,color:'#88a296'});const active=view==='trace'?'catalogue':view;
  NAV.forEach(([id,label,ic],i)=>{const yy=267+i*56;const on=active===id;if(on)rect(ctx,17,yy,248,51,'#d7e7d5',null,8);icon(ctx,ic,37,yy+15,23,on?'#213d34':'#bdcdc2');text(ctx,label,76,yy+13,{size:20,weight:on?600:400,color:on?'#213d34':'#bdcdc2',width:181});});
  text(ctx,'Know where every affected batch went. Account for what comes back.',31,760,{size:17,color:'#a2b6a8',width:225,maxLines:3,lineHeight:25});line(ctx,31,850,252,850,'#ffffff20');rect(ctx,31,870,33,33,'#8aa390',null,17);text(ctx,'EP',47.5,877,{size:14,weight:700,color:'#10251b',align:'center'});text(ctx,'Epsilon3096',77,865,{size:19,weight:600,color:'#dce6dd'});text(ctx,'Admin Workspace',77,891,{size:16,color:'#9eb1a7'});
  rect(ctx,282,0,1318,81,p.card,null,0);line(ctx,282,81,1600,81,p.border);text(ctx,'RecallScope',322,28,{size:19,color:p.muted});text(ctx,'›',437,26,{size:24,color:p.muted});text(ctx,NAV.find(n=>n[0]===active)?.[1]||'Overview',463,28,{size:19,weight:600,color:p.ink});search(ctx,1153,17,299,p,'Search workspace');icon(ctx,'moon',1480,28,23,p.ink);icon(ctx,'sliders',1534,28,23,p.muted);
  ctx.beginPath();ctx.arc(325,123,4,0,Math.PI*2);ctx.fillStyle=p.good;ctx.fill();text(ctx,'Saved workspace',337,111,{size:17,color:p.muted});badge(ctx,'Sample records',504,105,p,'neutral',16);icon(ctx,'calendar',1242,111,18,p.muted);text(ctx,'Reference date 3 Oct 2026',1273,111,{size:17,color:p.muted});
  const d=DESCRIPTIONS[view]||DESCRIPTIONS.overview;text(ctx,d[0].toUpperCase(),322,164,{size:17,weight:600,color:p.muted});text(ctx,d[1],322,203,{size:43,weight:600,color:p.ink,width:1185});text(ctx,d[2],322,257,{size:21,color:p.muted,width:1228});
}

function overview(ctx,p,state){
  const x=322,y=307,w=1236;panel(ctx,x,y,w,153,p);const labels=[['Products in catalogue',6,'9 distinct product batches','box'],['Recorded stock locations',2,'Quantities kept in their own units','building'],['Customer destinations',4,'4 linked dispatch records','truck'],['Recall accounting','100%','RC-2026-001 · Closed with evidence','shield']];
  labels.forEach((a,i)=>{if(i)line(ctx,x+w*i/4,y,x+w*i/4,y+153,p.border);const xx=x+27+i*w/4;icon(ctx,a[3],xx,y+27,20,p.muted);text(ctx,a[0],xx+29,y+27,{size:18,color:p.muted,width:250});text(ctx,String(a[1]),xx,y+65,{size:43,weight:600,color:p.ink});text(ctx,a[2],xx,y+122,{size:16,color:p.muted,width:265});});
  panel(ctx,322,485,718,389,p);text(ctx,'A complete recall record',349,512,{size:24,weight:650,color:p.ink});text(ctx,'One scope. Connected sources. Reconciled quantities.',349,550,{size:18,color:p.muted});text(ctx,'Open case ↗',905,516,{size:18,color:p.accent});badge(ctx,'RC-2026-001 · closed',349,595,p,'good',18);text(ctx,'Paracetamol 500 mg',349,644,{size:25,weight:650,color:p.ink});text(ctx,'Batch PCR-260901 · 4 recipient sites',349,681,{size:20,color:p.muted});icon(ctx,'shield',955,638,40,p.accent);rect(ctx,349,727,663,8,p.accent,null,5);text(ctx,'Affected shipment accounting',349,746,{size:17,color:p.muted});text(ctx,'100% accounted for',1012,746,{size:17,weight:600,color:p.ink,align:'right'});
  [['600','Dispatched'],['600','Returned'],['0','Outstanding']].forEach((a,i)=>{const xx=349+i*222;text(ctx,a[0],xx,785,{size:29,weight:600,color:p.ink});text(ctx,a[1],xx,830,{size:18,color:p.muted});});
  panel(ctx,1064,485,494,389,p);text(ctx,'Your next actions',1092,513,{size:24,weight:650,color:p.ink});text(ctx,'A focused view of operational work.',1092,552,{size:18,color:p.muted});
  [['calendar','2 batches in the expiry window','Expired or due within 90 days.'],['shield','0 active recall cases','Closed cases and evidence stay available.'],['sparkles','Try a guided document','Pre-filled records. No API key needed.']].forEach((a,i)=>{const yy=602+i*85;line(ctx,1064,yy-12,1558,yy-12,p.border);rect(ctx,1092,yy+4,37,37,p.subtle,p.border,6);icon(ctx,a[0],1100,yy+12,21,p.accent);text(ctx,a[1],1145,yy+1,{size:19,weight:600,color:p.ink,width:380});text(ctx,a[2],1145,yy+33,{size:17,color:p.muted,width:380});text(ctx,'›',1520,yy+12,{size:25,color:p.muted});});
}

function catalogue(ctx,p,state){
  panel(ctx,322,309,1236,574,p);text(ctx,'Product catalogue & batch register',350,335,{size:24,weight:650,color:p.ink});button(ctx,'Add product',1339,325,191,p,false,'plus');tabs(ctx,['Batches','Products','Serialised units','Packages'],0,340,389,1200,p);search(ctx,350,467,498,p,'Search product, SKU or batch…');badge(ctx,'All batches',1350,474,p,'neutral',18);
  const xs=[350,752,964,1145,1361];const headers=['Product','Batch code','Expiry label','Recorded status','On hand'];rect(ctx,323,535,1234,45,p.subtle,null,0);headers.forEach((a,i)=>text(ctx,a,xs[i],547,{size:17,weight:600,color:p.muted}));
  const rows=[['Paracetamol 500 mg','PAR-500-100','PCR-260901','2027-09','Batch hold','1,000 box','warn'],['Amoxicillin 500 mg','AMX-500-100','PCR-260901','2027-11','Available','300 box','good'],['Paracetamol 500 mg','PAR-500-100','PCR-261001','2028-01','Available',state.approved?'440 box':'400 box','good'],['Cetirizine 10 mg','CET-10-100','CET-260701','2026-11','Available','180 box','good']];
  rows.forEach((r,i)=>{const yy=580+i*72;if(i===0)rect(ctx,324,yy,1232,72,p.accentSoft,null,0);line(ctx,323,yy+72,1557,yy+72,p.border);text(ctx,r[0],xs[0],yy+12,{size:21,weight:600,color:p.ink});text(ctx,r[1],xs[0],yy+42,{size:17,color:p.muted,mono:true});text(ctx,r[2],xs[1],yy+24,{size:20,color:p.ink,mono:true});text(ctx,r[3],xs[2],yy+24,{size:20,color:p.ink});badge(ctx,r[4],xs[3],yy+18,p,r[6],17);text(ctx,r[5],xs[4],yy+24,{size:20,weight:500,color:p.ink});});
}

function modal(ctx,p,x,y,w,h){ctx.fillStyle=p.bg==='#101a1a'?'rgba(2,10,10,.62)':'rgba(19,42,40,.25)';ctx.fillRect(282,81,1318,839);ctx.save();ctx.shadowColor='rgba(7,26,24,.16)';ctx.shadowBlur=25;ctx.shadowOffsetY=12;panel(ctx,x,y,w,h,p);ctx.restore();}
function trace(ctx,p,state){
  modal(ctx,p,354,115,1198,775);text(ctx,'PARACETAMOL 500 MG · PAR-500-100',388,147,{size:18,weight:650,color:p.muted});text(ctx,'PCR-260901',388,183,{size:35,weight:600,color:p.ink});icon(ctx,'close',1498,153,24,p.muted);line(ctx,354,239,1552,239,p.border);
  [['Original printed code','PCR-260901'],['Manufacturer','Asterbridge Laboratories'],['Expiry label','2027-09 (month precision)']].forEach((a,i)=>{const xx=388+i*380;text(ctx,a[0],xx,265,{size:18,color:p.muted});text(ctx,a[1],xx,295,{size:21,color:p.ink,width:350});});
  rect(ctx,388,344,1129,61,p.warnBg,p.border,8);icon(ctx,'lock',405,363,23,p.warn);text(ctx,'Batch hold is active',442,356,{size:21,weight:600,color:p.warn});text(ctx,'Scope stays with this product and batch.',758,361,{size:19,color:p.warn});
  const cols=[{x:388,w:287,ic:'building',title:'Supplier receipt',value:'1,000 box received',lines:['Northstar Supply','GRN-001','Original source retained']},{x:706,w:301,ic:'boxes',title:'Warehouse ledger',value:'2 recorded locations',lines:['Central · A01','North · B02','Transfer does not add stock']},{x:1038,w:478,ic:'truck',title:'Customer destinations',value:'600 box dispatched',lines:[]}];
  cols.forEach(c=>{panel(ctx,c.x,435,c.w,341,p);icon(ctx,c.ic,c.x+23,456,28,p.accent);text(ctx,c.title,c.x+23,508,{size:22,weight:600,color:p.ink,width:c.w-46});text(ctx,c.value,c.x+23,554,{size:22,weight:650,color:p.ink,width:c.w-46});c.lines.forEach((l,i)=>text(ctx,l,c.x+23,611+i*45,{size:i===2?17:20,color:i===2?p.muted:p.ink,width:c.w-44,maxLines:2}));});
  icon(ctx,'arrow',682,547,20,p.muted);icon(ctx,'arrow',1013,547,20,p.muted);
  [['Aster Pharmacy','250 box'],['Brook Clinic','150 box'],['Cedar Hospital','100 box'],['Delta Distribution','100 box']].forEach((r,i)=>{const yy=599+i*41;text(ctx,r[0],1061,yy,{size:20,color:p.ink});text(ctx,r[1],1490,yy,{size:20,weight:500,color:p.ink,align:'right'});});
  rect(ctx,388,803,1129,56,p.subtle,p.border,7);icon(ctx,'document',406,820,21,p.accent);text(ctx,'Receipt → transfer → dispatch → return',446,819,{size:21,weight:600,color:p.ink});text(ctx,'Inspect original sources ↗',1494,820,{size:19,color:p.accent,align:'right'});
}

function intake(ctx,p,state){
  const approved=!!state.approved;modal(ctx,p,340,116,1210,780);text(ctx,'Import a document',371,145,{size:29,weight:600,color:p.ink});icon(ctx,'close',1500,147,24,p.muted);text(ctx,'Inspect the source. Review each record. Approve before posting.',371,190,{size:20,color:p.muted});
  const modes=[['Guided examples','Pre-filled source records'],['Structured import','Map your CSV columns'],['Live AI assistance','Fireworks / OpenAI']];modes.forEach((a,i)=>{const xx=371+i*384;rect(ctx,xx,240,369,79,i===0?p.accentSoft:p.card,i===0?p.accent:p.border,8,i===0?2:1);icon(ctx,i===0?'sparkles':'document',xx+15,261,24,i===0?p.accent:p.muted);text(ctx,a[0],xx+51,252,{size:21,weight:600,color:p.ink});text(ctx,a[1],xx+51,286,{size:17,color:p.muted});});
  panel(ctx,371,344,438,453,p);text(ctx,'Original source',394,367,{size:23,weight:600,color:p.ink});badge(ctx,'CSV',700,363,p,'neutral',17);text(ctx,'recallscope-receipt-example.csv',394,407,{size:17,color:p.muted,width:391});line(ctx,372,448,808,448,p.border);
  const src=[['reference','GRN-GUIDED-1001'],['productSku','PAR-500-100'],['batchCode','PCR-261001'],['expiry','2028-01'],['quantity / unit','40 / box'],['location','Central · A01']];src.forEach((a,i)=>{const yy=469+i*45;text(ctx,a[0],394,yy,{size:17,color:p.muted,mono:true});text(ctx,a[1],783,yy,{size:18,color:p.ink,weight:500,mono:true,align:'right'});});text(ctx,'Guided example · fictional records',394,757,{size:17,color:p.muted});
  panel(ctx,829,344,688,453,p);text(ctx,'Goods receipt · GRN-GUIDED-1001',851,367,{size:22,weight:600,color:p.ink});badge(ctx,'Exact record match',1285,406,p,'good',16);text(ctx,'Source line 2',851,409,{size:17,color:p.muted});
  field(ctx,'Product SKU','PAR-500-100',851,466,305,p,{mono:true});field(ctx,'Batch code','PCR-261001',1177,466,317,p,{mono:true});field(ctx,'Quantity','40',851,569,148,p,{highlight:state.highlight==='quantity'});field(ctx,'Unit','box',1019,569,137,p);field(ctx,'Warehouse','Central · A01',1177,569,317,p);
  rect(ctx,851,676,643,88,approved?p.goodBg:p.subtle,p.border,7);text(ctx,approved?'Receipt approved and posted':'Posting preview',872,691,{size:21,weight:600,color:approved?p.good:p.ink});text(ctx,approved?'Recorded stock: 440 box':'Recorded stock: 400 → 440 box',872,730,{size:20,color:p.ink});
  line(ctx,341,813,1549,813,p.border);icon(ctx,approved?'check':'document',371,839,24,approved?p.good:p.muted);text(ctx,approved?'Operator approval recorded with original source.':'Review required before confirmed stock changes.',411,838,{size:20,color:p.muted,width:765});button(ctx,approved?'Posted to ledger':'Approve 1 receipt',1242,830,275,p,true,approved?'check':'plus');
}

function recall(ctx,p,state){
  const complete=!!state.complete;const increment=Math.round(20*clamp(state.progress));const returned=complete?600:100+increment;const outstanding=600-returned;const onHand=400+returned;
  panel(ctx,322,309,1236,86,p);text(ctx,'Recall case',349,328,{size:18,color:p.muted});text(ctx,'RC-2026-001 · Paracetamol · packaging label recall',349,357,{size:23,weight:600,color:p.ink});badge(ctx,complete?'closed':'reconciling',1379,336,p,complete?'good':'warn',18);
  panel(ctx,322,416,1236,155,p);const vals=[['Historically dispatched',600,'4 affected recipient sites','truck'],['Returned to quarantine',returned,'Included in current on-hand stock','return'],['Recorded on hand',onHand,`${number(onHand)} box quarantined`,'boxes'],['Outstanding accounting',outstanding,complete?'All recorded quantities accounted for':'Recipient quantities to account for','shield']];vals.forEach((a,i)=>{const xx=349+i*309;if(i)line(ctx,322+i*309,416,322+i*309,571,p.border);stat(ctx,a[0],a[1],a[2],xx,436,262,p,a[3],'box');});
  panel(ctx,322,594,1236,284,p);text(ctx,'Customer reconciliation',349,616,{size:23,weight:650,color:p.ink});text(ctx,`${Math.round(returned/600*100)}% of shipped quantity returned`,1528,620,{size:19,weight:600,color:p.accent,align:'right'});rect(ctx,350,658,1178,6,p.border,null,4);rect(ctx,350,658,1178*returned/600,6,p.accent,null,4);
  ['Recipient','Dispatched','Returned','Outstanding'].forEach((s,i)=>text(ctx,s,[350,922,1120,1351][i],684,{size:17,weight:600,color:p.muted}));
  const rows=[['Aster Pharmacy',250,complete?250:50+increment],['Brook Clinic',150,complete?150:30],['Cedar Hospital',100,complete?100:0],['Delta Distribution',100,complete?100:20]];rows.forEach((a,i)=>{const yy=719+i*36;if(i===0&&increment>0)rect(ctx,341,yy-4,1197,36,p.accentSoft,null,2);text(ctx,a[0],350,yy,{size:20,color:p.ink,weight:i===0?600:400});text(ctx,`${a[1]} box`,922,yy,{size:20,color:p.ink});text(ctx,`${a[2]} box`,1120,yy,{size:20,color:p.ink,weight:i===0?650:400});text(ctx,`${a[1]-a[2]} box`,1351,yy,{size:20,color:p.ink});});
}

function reports(ctx,p,state){
  panel(ctx,322,309,1236,574,p);text(ctx,'Snapshots & decision history',350,337,{size:24,weight:650,color:p.ink});button(ctx,'Ledger CSV',1118,325,184,p,false,'download');button(ctx,'Save snapshot',1319,325,211,p,true,'plus');tabs(ctx,['Case snapshots','Compare snapshots','Audit history'],state.audit?2:0,340,390,1200,p);
  if(state.audit){
    search(ctx,350,475,505,p,'Search decision, actor or reason…');rect(ctx,323,542,1234,48,p.subtle,null,0);const xx=[350,627,923,1400];['Decision','Recorded by','Reason','Time'].forEach((v,i)=>text(ctx,v,xx[i],557,{size:17,weight:600,color:p.muted}));
    const rows=[['report · create','Snapshot saved with evidence','3 Oct 2026'],['recall · close','Accounting complete with all 1,000 boxes recorded in quarantine; disposition remains a separate decision.','3 Oct 2026'],['return','Final authored return receipt for completed scenario','3 Oct 2026']];
    rows.forEach((r,i)=>{const yy=590+i*90;line(ctx,323,yy+90,1557,yy+90,p.border);text(ctx,r[0],350,yy+21,{size:20,weight:600,color:p.ink});text(ctx,i===0?'report snapshot':'recall-001',350,yy+55,{size:17,color:p.muted,mono:true});text(ctx,'Maya Chen',627,yy+21,{size:20,weight:600,color:p.ink});text(ctx,'Sample quality team',627,yy+52,{size:17,color:p.muted});text(ctx,r[1],923,yy+15,{size:18,color:p.ink,width:433,maxLines:3,lineHeight:23});text(ctx,r[2],1400,yy+21,{size:18,weight:500,color:p.ink});text(ctx,'Inspect ↗',1400,yy+54,{size:17,color:p.accent});});
  } else {
    rect(ctx,350,478,1180,211,p.subtle,p.border,8);text(ctx,'RC-2026-001 · completed accounting',375,500,{size:24,weight:600,color:p.ink});text(ctx,'3 Oct 2026 · Maya Chen · Sample quality team',375,540,{size:19,color:p.muted});text(ctx,'Reference date 3 Oct 2026 · unit: box',375,572,{size:18,color:p.muted});button(ctx,'PDF',1379,497,125,p,false,'download');
    [['600','Historically dispatched'],['600','Returned'],['0','Outstanding']].forEach((a,i)=>{const xx=375+i*324;text(ctx,a[0],xx,616,{size:34,weight:600,color:p.ink});text(ctx,a[1],xx+87,630,{size:18,color:p.muted,width:226});});
    text(ctx,'Original sources & decisions',350,726,{size:23,weight:600,color:p.ink});const entries=[['document','Goods received register'],['truck','Dispatch & return records'],['shield','Recall instruction & audit']];entries.forEach((a,i)=>{const xx=350+i*399;rect(ctx,xx,774,380,71,p.card,p.border,7);icon(ctx,a[0],xx+17,797,24,p.accent);text(ctx,a[1],xx+58,797,{size:19,weight:500,color:p.ink,width:310});});
  }
}

/** Draw a UI into the caller's context. No canvas allocations; safe for direct vector camera transforms.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{view?:string,width?:number,height?:number,theme?:'light'|'dark'|'night',state?:object}} options
 */
function drawUI(ctx,{view='overview',width=UI_WIDTH,height=UI_HEIGHT,theme='light',state={}}={}){
  const p=productPalette[theme==='night'?'dark':theme]||productPalette.light;
  ctx.save();ctx.scale(width/UI_WIDTH,height/UI_HEIGHT);ctx.beginPath();ctx.rect(0,0,UI_WIDTH,UI_HEIGHT);ctx.clip();shell(ctx,view,p,state);
  const draws={overview,catalogue,trace,intake,recall,reports};(draws[view]||overview)(ctx,p,state);
  const target=typeof state.highlight==='string'?focusRects[view]?.[state.highlight]:state.highlight;if(target)highlight(ctx,target,p,state.highlightAmount==null?1:clamp(state.highlightAmount));
  ctx.restore();
}
module.exports={drawUI,productPalette,UI_WIDTH,UI_HEIGHT,focusRects,views:Object.freeze(['overview','catalogue','trace','intake','recall','reports'])};
