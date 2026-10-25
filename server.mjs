import http from 'node:http';
import { createDiscovery, loadLatestDiscovery } from './discovery.mjs';
const discover = createDiscovery({token:process.env.APIFY_TOKEN});
let job = {status:'idle'};
const initialCache = loadLatestDiscovery().then(result=>{if(result && job.status==='idle')job={status:'complete',result};});
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
const allowed = new Set(['index.html','styles.css','app.js','matching.js','data.js','locations.js','planning.js','profiles.js','opportunity-facts.js','onboarding.js','opportunity-ui.js']);
const port = Number(process.env.PORT || 4173);
http.createServer(async (req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    if (pathname === '/api/discovery' && req.method === 'GET') { await initialCache; res.end(JSON.stringify(job)); return; }
    if (pathname === '/api/discovery' && req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {res.writeHead(403);res.end(JSON.stringify({error:'Origin not allowed'}));return;}
      if (!String(req.headers['content-type']).startsWith('application/json')) {res.writeHead(415);res.end(JSON.stringify({error:'JSON required'}));return;}
      if (job.status === 'running') {res.writeHead(409);res.end(JSON.stringify({error:'Discovery is already running'}));return;}
      try {
        let body=''; for await (const chunk of req) {body+=chunk;if(body.length>4096)throw new Error('Request too large');}
        const input=JSON.parse(body);
        if (!input || typeof input !== 'object' || !input.profile || typeof input.profile.category !== 'string') throw new Error('Business profile required');
        job={status:'running',startedAt:new Date().toISOString(),progress:{stage:'cache',message:'Checking for saved search results.'}};
        discover(input.profile,input.pilot===true,{onProgress:progress=>{job={...job,progress};}}).then(result=>{job={status:'complete',result};}).catch(error=>{job={status:'failed',error:error.message};});
        res.writeHead(202);res.end(JSON.stringify({status:'running'}));
      } catch(error) {res.writeHead(400);res.end(JSON.stringify({error:error.message}));}
      return;
    }
    res.writeHead(404);res.end(JSON.stringify({error:'Not found'}));return;
  }
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html';
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await readFile(path.join(root,name)); res.writeHead(200,{'Content-Type':types[path.extname(name)] || 'text/plain'}); res.end(data); }
  catch { res.writeHead(500); res.end('Unable to load app'); }
}).listen(port,'127.0.0.1',()=>console.log(`Gather: http://127.0.0.1:${port}`));
