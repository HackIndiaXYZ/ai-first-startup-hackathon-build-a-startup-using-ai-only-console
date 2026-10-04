import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Runtime locations come from the local Codex dependency/skill inventory.
// No machine-specific paths or bundled proprietary dependencies are stored here.
function requiredAbsolutePath(name) {
 const value = process.env[name];
 if (!value || !path.isAbsolute(value)) throw new Error(`Set ${name} to its absolute path from the Codex runtime inventory. See README.md.`);
 return path.normalize(value);
}
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(sourceDir, '../../..');
const buildDir = path.join(workspaceDir, '.cache', 'pharma-pitch');
const SKILL_DIR = requiredAbsolutePath('CODEX_PRESENTATIONS_SKILL_DIR');
const RUNTIME_PYTHON = requiredAbsolutePath('CODEX_ARTIFACT_PYTHON');
const runtimeModules = requiredAbsolutePath('RUNTIME_NODE_MODULES');
const requireFromRuntime = createRequire(path.join(runtimeModules, '.recallscope-pitch-resolver.cjs'));
const { Presentation, PresentationFile, FileBlob } = await import(pathToFileURL(requireFromRuntime.resolve('@oai/artifact-tool')).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
await fs.access(RUNTIME_PYTHON);
await fs.access(path.join(SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'));
await fs.access(path.join(SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'));
if (process.argv.includes('--check')) {
 console.log(JSON.stringify({ runtimeImports: 'ready', validators: 'available', outputDirectory: '.cache/pharma-pitch', sourceSlides: 8 }));
 process.exit(0);
}
const version = process.argv[2] || '1';
if (!/^[A-Za-z0-9_-]+$/.test(version)) throw new Error('Use a simple alphanumeric revision name, such as 1 or revised-2.');
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const c = { forest:'#1E3535', ink:'#203333', cream:'#F4F5F2', muted:'#667873', mint:'#92D0B4', pale:'#D7E7D5', green:'#17645B', border:'#DDE4DD', white:'#FFFFFF', dark:'#101A1A', darkLine:'#3C5651', gold:'#D4B479', subtle:'#E9F3ED' };
const ui = 'Segoe UI';
const editorial = 'Georgia';

function shape(s, name, x,y,w,h, fill='none', stroke='none', radius=0, geometry='rect') {
  return s.shapes.add({geometry,name,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1.4},...(radius?{borderRadius:radius}:{})});
}
function txt(s, value, x,y,w,h,size=26,color=c.ink,weight=false,font=ui,align='left') {
  const t=shape(s,value.slice(0,60),x,y,w,h);
  t.text=value;
  t.text.style={typeface:font,fontSize:size,color,bold:weight,alignment:align,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};
  return t;
}
function rule(s,x,y,w,color=c.border,thick=1.4){return shape(s,'rule',x,y,w,thick,color);}
function vRule(s,x,y,h,color=c.border,thick=1.4){return shape(s,'vertical rule',x,y,thick,h,color);}
function node(s,x,y,r,fill=c.green){return shape(s,'trace node',x-r,y-r,r*2,r*2,fill,'none',0,'ellipse');}
function addSlide(background=c.cream){const s=p.slides.add();s.background.fill=background;return s;}
function header(s,title,n,dark=false){
  txt(s,title,64,48,1152,90,46,dark?c.white:c.ink,false,editorial);
  txt(s,'RecallScope',64,676,960,22,15,dark?c.pale:c.muted,true);
  txt(s,String(n).padStart(2,'0'),1168,676,48,22,15,dark?c.pale:c.muted,false,ui,'right');
}
function notes(s,text){s.speakerNotes.textFrame.setText(text);}
function table(s,values,x,y,w,h,widths,size=24,dark=false){
  const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,columnWidths:widths,values});
  t.styleOptions={headerRow:true,bandedRows:false};
  t.borders.assign({style:'solid',fill:dark?c.darkLine:c.border,width:1});
  for(let r=0;r<values.length;r++){
    t.rows[r].height=h/values.length;
    for(let q=0;q<values[0].length;q++){
      const cell=t.getCell(r,q);
      cell.fill=r===0?c.forest:(dark?'#233D39':c.white);
      cell.text.style={typeface:ui,fontSize:size,color:r===0?c.white:(dark?c.white:c.ink),bold:r===0||q===0,autoFit:'none',verticalAlignment:'middle',insets:{left:16,right:12,top:8,bottom:8}};
    }
  }
  return t;
}
function document(s,x,y,w,h,title,lines,dark=false){
  shape(s,title,x,y,w,h,dark?'#213B37':c.white,dark?c.darkLine:c.border,5);
  txt(s,title,x+22,y+20,w-44,40,24,dark?c.mint:c.green,true);
  rule(s,x+22,y+66,w-44,dark?c.darkLine:c.border);
  lines.forEach((line,i)=>txt(s,line,x+22,y+86+i*40,w-44,35,22,dark?c.white:c.ink));
}

// 1. Minimal cover with an editable batch trace, not a webpage screenshot.
{
 const s=addSlide(c.forest);
 txt(s,'RecallScope',64,93,1160,120,92,c.white,true);
 txt(s,'Pharmaceutical distribution',69,222,1090,52,29,c.mint);
 txt(s,'Know where every affected batch went.\nAccount for what comes back.',68,333,960,133,38,c.white,false,editorial);
 rule(s,81,553,1040,c.darkLine,3);
 const stages=[['Receipt',81],['Batch',414],['Recipient',747],['Return',1121]];
 stages.forEach(([label,x])=>{node(s,x,554,8,c.mint);txt(s,label,x===1121?1050:x-4,579,180,38,24,c.pale);});
 txt(s,'Team Console',68,667,640,28,19,c.pale);
 txt(s,'October 2026',985,667,230,28,19,c.pale,false,ui,'right');
 notes(s,'RecallScope is a working workspace for pharmaceutical distributors and wholesalers. The deck follows the current product, using native editable PowerPoint text, tables, and diagrams instead of screenshots. All shown organisations and operational records are fictional. Product source: https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-console . Live product: https://recallscope.console3096.chatgpt.site/ .');
}

// 2. The problem is the evidence relationship, shown directly rather than as a list.
{
 const s=addSlide();header(s,'The recall evidence gap',2);
 txt(s,'A recall must connect the right medicine and batch\nto every recorded destination and return.',64,151,1100,91,31,c.ink);
 document(s,64,288,343,231,'Goods received',['PAR-500-100','PCR-260901','1,000 boxes']);
 document(s,469,288,343,231,'Dispatch records',['Same product and batch','4 recipient sites','600 boxes delivered']);
 document(s,874,288,342,231,'Returns',['Original dispatch reference','Quantity received back','Quarantine location']);
 rule(s,407,401,62,c.green,3);rule(s,812,401,62,c.green,3);
 txt(s,'Every return must match the correct product, batch and dispatch.',64,570,1140,52,28,c.green,true);
 txt(s,'Authored pharmaceutical example',64,637,900,25,16,c.muted);
 notes(s,'Problem definition: docs/SUBMISSION.md and product/lib/pharma/seed.ts. The 1,000-box receipt and 600-box delivered total belong to PAR-500-100 / PCR-260901. Four recipients: Aster Pharmacy, Brook Clinic, Cedar Hospital, Delta Distribution. No rate of errors or time savings is claimed. The slide demonstrates an operational record relationship, not an actual recall event.');
}

// 3. A native product-inspired workspace excerpt keeps product typography and layout identity.
{
 const s=addSlide();header(s,'A distributor’s working record',3);
 txt(s,'Product identity stays attached to the batch, location and destination.',64,142,1136,53,27,c.muted);
 shape(s,'workspace frame',64,218,1152,412,c.white,c.border,9);
 shape(s,'product navigation',64,218,202,412,c.forest,'none',8);
 txt(s,'RecallScope',83,243,173,38,25,c.white,true);
 txt(s,'Asterbridge',84,302,168,29,19,c.pale,true);
 txt(s,'Distribution',84,330,168,28,18,c.pale);
 const nav=['Overview','Products & batches','Stock','Deliveries','Recalls','Reports'];
 nav.forEach((v,i)=>{
   if(i===1)shape(s,'active nav',77,379+i*33,177,33,c.pale,'none',4);
   txt(s,v,86,383+i*33,166,29,18,i===1?c.ink:c.pale,i===1);
 });
 txt(s,'Products & batches',293,245,680,44,29,c.ink,true);
 txt(s,'Product identity includes strength, presentation and batch.',293,294,867,34,21,c.muted);
 table(s,[['Product','Batch','Received'],['Paracetamol 500 mg','PCR-260901','1,000 boxes'],['Amoxicillin 500 mg','PCR-260901','300 boxes']],293,351,889,168,[403,255,231],22);
 shape(s,'selected identity',293,544,889,55,c.subtle,'none',5);
 txt(s,'Same printed code. Separate product identity and stock.',309,559,855,34,22,c.green,true);
 txt(s,'Authored product records',64,638,700,24,16,c.muted);
 notes(s,'Product-inspired native vector excerpt, not a screenshot and not an additional interactive UI. The app uses Segoe UI / Segoe UI Variable and the palette from product/app/pharma.css. Source facts: product/lib/pharma/seed.ts. PAR-500-100 / PCR-260901 receives 1,000 boxes. AMX-500-100 / PCR-260901 receives 300 boxes. The matching printed batch text does not merge stock. The displayed Received column reflects original receipt amounts, not the current stock status. No production application font or layout has been changed for this deck.');
}

// 4. Live AI has a clear role and a concrete reviewed stock consequence.
{
 const s=addSlide(c.forest);header(s,'AI extraction, reviewed before posting',4,true);
 txt(s,'Fireworks or OpenAI reads a document and proposes structured fields.',64,144,1110,61,30,c.pale);
 const steps=[['Source',64],['AI proposal',359],['Review',654],['Stock ledger',949]];
 steps.forEach(([label,x],i)=>{
   node(s,x+17,257,9,i<2?c.mint:c.gold);
   if(i<3)rule(s,x+30,256,256,c.darkLine,3);
   txt(s,label,x,289,266,46,29,c.white,true);
 });
 document(s,64,379,468,222,'Proposed goods receipt',['PAR-500-100 / PCR-261001','40 boxes','Original source stays inspectable'],true);
 txt(s,'400',602,388,227,99,70,c.white,true);
 txt(s,'440',944,388,240,99,70,c.mint,true);
 rule(s,796,436,94,c.mint,4);
 shape(s,'posting direction',886,428,14,20,c.mint,'none',0,'triangle').position={left:886,top:428,width:14,height:20,rotation:90};
 txt(s,'boxes on hand',603,487,562,44,27,c.pale);
 txt(s,'Only explicit approval posts the receipt.',603,554,558,65,25,c.white);
 txt(s,'Keys stay on the server. Guided examples keep the review flow available without an API key.',64,628,1140,30,20,c.pale);
 notes(s,'Implemented live extraction paths: README.md and product/lib/pharma/intake.ts, with Fireworks and OpenAI adapters for text, images and PDF-derived inputs. Deterministic code validates source identity, units, dates, review fields and posting. Guided examples use pre-filled proposals and do not make an AI request. The shown 40-box receipt is the guided receipt example, not a claim of live model output. Recorded browser result: PCR-261001 increases from 400 to 440 boxes after operator review. Repeat posting is blocked. Server-side secrets and request budgets apply to live extraction. Source: docs/PHARMA-VALIDATION.md and README.md.');
}

// 5. Accounting is native table data with exact scoped units.
{
 const s=addSlide();header(s,'One recall, accounted for',5);
 txt(s,'1,000 boxes received',64,142,551,56,32,c.ink,true);
 txt(s,'600 boxes historically dispatched',631,142,585,56,30,c.green,true);
 table(s,[['Recorded measure','Before returns','Partial returns','All returned'],['Returned by recipients','0','100','600'],['Current stock on hand','400','500','1,000'],['Outstanding shipment accounting','600','500','0']],64,241,1152,293,[420,244,244,244],24);
 txt(s,'1,000 boxes recorded in quarantine',64,568,1100,47,32,c.green,true);
 txt(s,'Returns are already part of stock. Disposition remains a separate decision.',64,620,1117,35,23,c.muted);
 notes(s,'Authored complete recall scenario, PAR-500-100 / PCR-260901. All quantities are boxes. Source: product/lib/pharma/seed.ts and docs/PHARMA-VALIDATION.md. Receipt = 1,000. Historical dispatch = 250 + 150 + 100 + 100 = 600. Before returns, stock = 1,000 - 600 = 400. Partial returns = 100, current stock = 400 + 100 = 500, outstanding = 600 - 100 = 500. All returned = 600, current stock = 400 + 600 = 1,000, outstanding = 0. Returned quantities are not added again to current stock. Accounting closure leaves medicine in quarantine and does not authorize disposal, release, or use. These are authored records, not industrial validation.');
}

// 6. One source-to-report diagram and a small evidence record, no generic UI card grid.
{
 const s=addSlide();header(s,'Evidence behind each decision',6);
 const labels=[['Source document','Original file and source text'],['Review decision','Corrections, actor and reason'],['Movement ledger','Exact product, batch and units'],['Fixed snapshot','Captured quantities and history']];
 labels.forEach(([a,b],i)=>{
   const y=163+i*107;
   if(i<3)vRule(s,84,y+16,110,c.border,3);
   node(s,85,y+14,9,c.green);
   txt(s,a,124,y-6,516,45,31,c.ink,true);
   txt(s,b,125,y+42,522,38,23,c.muted);
 });
 vRule(s,731,162,424,c.border);
 txt(s,'143',793,161,385,124,96,c.green,true);
 txt(s,'automated tests passed',798,294,390,48,28,c.ink,true);
 txt(s,'Product-specific identity\nStock and return conservation\nDuplicate and stale-write protection\nImmutable report history',799,374,391,176,24,c.ink);
 txt(s,'Software checks use authored records and controlled provider responses.',797,580,390,66,19,c.muted);
 notes(s,'143/143 whole-project unit tests passed in the final integrated release and the 4 October interface follow-up. This count includes retained historical functionality alongside pharma domain, intake, store, exports and interoperability tests. Types and production build also passed, with browser evidence in docs/PHARMA-VALIDATION.md. This is a recorded software verification result, not industrial acceptance, live extraction accuracy, or regulatory certification. Sources and hashes remain inspectable, and fixed snapshots do not change when later returns arrive. Evidence: docs/PHARMA-VALIDATION.md, product/verification/pharma-evaluation.json and product/tests/.');
}

// 7. Commercial positioning explicitly separates the proposed offer from evidence.
{
 const s=addSlide();header(s,'A focused distributor business',7);
 txt(s,'Operations and quality teams',64,153,572,56,32,c.green,true);
 txt(s,'Document-to-recall accounting\nwith an inspectable source\nbehind each decision.',64,229,540,179,34,c.ink,false,editorial);
 txt(s,'Proposed commercial model',64,476,539,44,26,c.ink,true);
 txt(s,'Organisation subscription, warehouse\nallowances and optional metered extraction.',64,530,545,84,25,c.muted);
 txt(s,'Commercial hypothesis',64,633,520,27,17,c.muted);
 txt(s,'An established category',673,156,543,44,28,c.ink,true);
 table(s,[['Alternative','Documented focus'],['TraceLink','Targeted recalls'],['SAP ATTP','Serialization and integration'],['Odoo Inventory','Lots, expiry and FEFO']],673,219,543,343,[213,330],23);
 txt(s,'RecallScope focuses the experience on reviewed documents and return accounting.',673,590,543,67,23,c.green);
 notes(s,'Commercial hypothesis from docs/PHARMA-ALTERNATIVES.md, current desk research checked 3 October 2026. No current revenue, paying customers, market share, savings or price superiority is asserted. Primary sources: TraceLink Targeted Recalls, https://www.tracelink.com/products/product-orchestration/targeted-recalls ; SAP Advanced Track and Trace for Pharmaceuticals, https://www.sap.com/uk/products/scm/track-trace-pharmaceuticals.html ; Odoo expiration and FEFO, https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html and https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html . These sources establish the category and documented features. They do not prove competitor feature absence or RecallScope demand.');
}

// 8. AI authorship is prominent, while the CTA remains concrete and readable.
{
 const s=addSlide(c.forest);
 txt(s,'Built with agentic AI',64,62,1152,92,52,c.white,false,editorial);
 txt(s,'Codex agents designed and implemented the custom system\nunder the owner’s direction.',65,181,1125,94,31,c.pale);
 rule(s,65,321,1150,c.darkLine,2);
 txt(s,'Product and market research',65,352,517,47,27,c.white);
 txt(s,'Architecture, interface and backend',661,352,545,47,27,c.white);
 txt(s,'Tests and deployment',65,418,527,47,27,c.white);
 txt(s,'Pitch and demonstration materials',661,418,545,47,27,c.white);
 txt(s,'RecallScope',65,531,1130,71,54,c.mint,true);
 txt(s,'recallscope.console3096.chatgpt.site',66,615,1141,53,31,c.white);
 notes(s,'AI authorship record: docs/AI-USAGE.md. Codex agents performed product framing and market research, architecture, UI/UX design, custom frontend/backend coding, deterministic test work, deployment preparation and project materials under human direction. This is a description of documented work, not a measured authorship percentage. Live product: https://recallscope.console3096.chatgpt.site/ . Public custom code and evidence: https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-console . A judge can explore the complete guided document, review, stock, trace, recall and export workflow without providing an API key.');
}

await fs.mkdir(path.join(buildDir,`render-${version}`),{recursive:true});
const draft=path.join(buildDir,`candidate-${version}.pptx`);
await(await PresentationFile.exportPptx(p)).save(draft);
for(let i=0;i<p.slides.items.length;i++){
 const slide=p.slides.items[i];
 const image=await p.export({slide,format:'png',scale:1.5});
 await fs.writeFile(path.join(buildDir,`render-${version}`,`slide-${i+1}.png`),new Uint8Array(await image.arrayBuffer()));
 const layout=await slide.export({format:'layout'});
 await fs.writeFile(path.join(buildDir,`render-${version}`,`slide-${i+1}.layout.json`),await layout.text());
 console.log(JSON.stringify({stage:'rendered',slide:i+1}));
}
const finalPath=path.join(buildDir,'final',`RecallScope-Pharma-Pitch-v${version}.pptx`);
await fs.mkdir(path.dirname(finalPath),{recursive:true});
const result=await finalizePresentation({
 workspaceDir,candidatePath:draft,finalPath,pythonExecutable:RUNTIME_PYTHON,
 integrityValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','3','--require-native-table-slide','5','--require-native-table-slide','7'],
 explicitTotalSlideCount:8,requiredNativeTableOwnerSlides:[3,5,7],requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'design',families:[ui,editorial]},verifyArtifactToolImport:true,
 receiptPath:path.join(buildDir,`validation-${version}.json`)
});
console.log(JSON.stringify({stage:'finalized',finalPath,result}));
const final=await PresentationFile.importPptx(await FileBlob.load(finalPath));
await fs.mkdir(path.join(buildDir,`final-render-${version}`),{recursive:true});
for(let i=0;i<final.slides.items.length;i++){
 const slide=final.slides.items[i];
 const png=await final.export({slide,format:'png',scale:1.5});
 await fs.writeFile(path.join(buildDir,`final-render-${version}`,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
console.log(JSON.stringify({stage:'final-rendered',slides:8}));
