'use strict';
const P={night:'#101a1a',forest:'#1e3535',paper:'#f4f5f2',white:'#ffffff',ink:'#203333',muted:'#a9bab1',mint:'#92d0b4',lime:'#d6e8c7',gold:'#e4bc72',line:'#38524b',coral:'#eda692'};
const clamp=x=>Math.max(0,Math.min(1,x));
const lerp=(a,b,p)=>a+(b-a)*p;
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const out=x=>1-(1-clamp(x))**4;
const progress=(t,s,d=1)=>clamp((t-s)/d);
function spring(x){x=clamp(x);return x===1?1:1-Math.exp(-7*x)*Math.cos(8*x)}
function rr(c,x,y,w,h,r,fill,stroke,lw=1){if(w<=0||h<=0)return;c.beginPath();c.roundRect(x,y,w,h,Math.min(r,h/2,w/2));if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()}}
function text(c,s,x,y,size=28,color=P.ink,weight=400,align='left',family='Segoe UI'){weight=Math.round(weight/100)*100;c.font=`${weight} ${size}px "${family}"`;c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=color;c.fillText(String(s),x,y)}
function serif(c,s,x,y,size=72,color=P.paper,italic=false){c.font=`${italic?'italic ':''}${size}px "Georgia"`;c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle=color;c.fillText(s,x,y)}
function wrap(c,s,x,y,maxWidth,size=26,color=P.muted,lineHeight=1.4,weight=400){c.font=`${weight} ${size}px "Segoe UI"`;let line='',row=0;for(const word of String(s).split(' ')){let next=line?line+' '+word:word;if(c.measureText(next).width>maxWidth&&line){text(c,line,x,y+row*size*lineHeight,size,color,weight);line=word;row++}else line=next}if(line)text(c,line,x,y+row*size*lineHeight,size,color,weight);return (row+1)*size*lineHeight}
function line(c,x1,y1,x2,y2,color=P.mint,width=2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke()}
function circle(c,x,y,r,color,stroke,lw=1){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(color){c.fillStyle=color;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()}}
function alpha(c,a,fn){if(a<=0)return;c.save();c.globalAlpha*=clamp(a);fn();c.restore()}
function label(c,s,x,y,color=P.mint,size=19){text(c,s.toUpperCase(),x,y,size,color,600)}
function check(c,x,y,s=1,color=P.mint){line(c,x-10*s,y,x-2*s,y+8*s,color,3*s);line(c,x-2*s,y+8*s,x+14*s,y-10*s,color,3*s)}
function mark(c,x,y,size=52,color=P.mint){const k=size/52;c.save();c.translate(x,y);c.scale(k,k);rr(c,0,0,52,52,14,null,color,1.5);for(const [a,b,dx,dy] of [[13,19,0,-6],[13,13,6,0],[39,19,0,-6],[39,13,-6,0],[13,33,0,6],[13,39,6,0],[39,33,0,6],[39,39,-6,0]])line(c,a,b,a+dx,b+dy,color,2);line(c,21,26,31,26,color,2);c.restore()}
function reveal(c,s,x,y,size,t,start,color=P.paper,family='Segoe UI'){const q=out(progress(t,start,.8));c.save();c.beginPath();c.rect(x-3,y-size-10,1600,size+20);c.clip();alpha(c,q,()=>text(c,s,x,y+(1-q)*60,size,color,500,'left',family));c.restore()}
function curved(c,a,b,bend=0,p=1,color=P.mint,width=3){const midx=(a.x+b.x)/2,midy=(a.y+b.y)/2+bend;c.beginPath();c.moveTo(a.x,a.y);const steps=48;for(let i=1;i<=Math.ceil(steps*clamp(p));i++){const u=Math.min(p,i/steps),v=1-u;c.lineTo(v*v*a.x+2*v*u*midx+u*u*b.x,v*v*a.y+2*v*u*midy+u*u*b.y)}c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke()}
function pill(c,s,x,y,{color=P.mint,fill='#20372e',height=42,size=19,pad=19}={}){c.font=`600 ${size}px "Segoe UI"`;const w=c.measureText(s).width+pad*2;rr(c,x,y,w,height,height/2,fill);text(c,s,x+pad,y+height*.68,size,color,600);return w}
function cursor(c,x,y,click=0){c.save();c.translate(x,y);if(click>0&&click<1){circle(c,0,0,10+click*36,null,'#92d0b4',3*(1-click))}c.beginPath();c.moveTo(0,0);c.lineTo(1,28);c.lineTo(8,21);c.lineTo(15,34);c.lineTo(21,31);c.lineTo(14,18);c.lineTo(26,17);c.closePath();c.fillStyle=P.ink;c.fill();c.lineWidth=2;c.strokeStyle=P.white;c.stroke();c.restore()}
module.exports={P,clamp,lerp,ease,out,progress,spring,rr,text,serif,wrap,line,circle,alpha,label,check,mark,reveal,curved,pill,cursor};
