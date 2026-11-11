const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],output=process.argv[3];if(!root||!output)throw new Error('Pass material root and private output directory');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'02_Каталог/Учебная_подборка.json'),'utf8').replace(/^\uFEFF/,''));
const normalize=s=>String(s).replace(/\\/g,'/').normalize('NFC').toLowerCase();
const transcripts=new Map();
for(const name of fs.readdirSync(path.join(root,'03_Расшифровки')).filter(n=>n.endsWith('.json'))){try{const t=JSON.parse(fs.readFileSync(path.join(root,'03_Расшифровки',name),'utf8').replace(/^\uFEFF/,''));if(t.source)transcripts.set(normalize(t.source),{file:name,text:(t.segments||[]).map(s=>s.text||'').join(' ').trim(),automatic:t.automatic});}catch{}}
const records=catalog.map((c,index)=>{const ts=(c.files||[]).map(f=>transcripts.get(normalize(f))).filter(Boolean);const body=[c.title,c.text,...ts.map(t=>t.text)].join('\n');return {index,key:c.source+'/'+c.id,title:c.title,topic:c.topic,files:c.files,transcripts:ts.map(t=>t.file),text:body,hash:crypto.createHash('sha256').update((c.text||'').replace(/\s+/g,' ').trim()).digest('hex'),characters:body.length};});
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'source-review.json'),JSON.stringify(records,null,2));
console.log(JSON.stringify({cards:records.length,withTranscript:records.filter(r=>r.transcripts.length).length,transcriptsMatched:new Set(records.flatMap(r=>r.transcripts)).size,characters:records.reduce((s,r)=>s+r.characters,0),withoutTextOrTranscript:records.filter(r=>r.characters<50).map(r=>({index:r.index,title:r.title})),output},null,2));
