import http from 'node:http';
import {createDiscovery} from './discovery.mjs';
import {createDiscoveryService} from './discovery-service.mjs';
import {cities} from './locations.js';
const discovery=createDiscoveryService({discover:createDiscovery({token:process.env.APIFY_TOKEN})});
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
const allowed = new Set(['index.html','styles.css','app.js','matching.js','data.js','locations.js','planning.js','profiles.js','opportunity-facts.js','onboarding.js','opportunity-ui.js','discovery-scope.js']);
const port = Number(process.env.PORT || 4173);
http.createServer(async (req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type','application/json');
    res.setHeader('Cache-Control','no-store');
    if (pathname === '/api/discovery' && req.method === 'GET') {
      const params=new URL(req.url,'http://localhost').searchParams;
      const profile={baseCity:params.get('baseCity')||'Berkeley',category:params.get('category')||'Coffee & beverages',organizationType:params.get('organizationType')||'Small business'};
      if(!Object.hasOwn(cities,profile.baseCity)){res.writeHead(400);res.end(JSON.stringify({error:'Choose a supported Bay Area city.'}));return;}
      res.end(JSON.stringify(await discovery.status(profile)));return;
    }
    if (pathname === '/api/discovery' && req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {res.writeHead(403);res.end(JSON.stringify({error:'Origin not allowed'}));return;}
      if (!String(req.headers['content-type']).startsWith('application/json')) {res.writeHead(415);res.end(JSON.stringify({error:'JSON required'}));return;}
      try {
        let body=''; for await (const chunk of req) {body+=chunk;if(body.length>4096)throw new Error('Request too large');}
        const input=JSON.parse(body);
        if (!input || typeof input !== 'object' || !input.profile || typeof input.profile.category !== 'string') throw new Error('Business profile required');
        if(!Object.hasOwn(cities,input.profile.baseCity))throw new Error('Choose a supported Bay Area city.');
        const job=await discovery.start(input.profile,{refresh:input.refresh===true});
        res.writeHead(job.status==='complete'?200:202);res.end(JSON.stringify(job));
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
