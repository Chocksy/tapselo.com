import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx0=1; const p = await (await b.newContext({ viewport:{width:1280,height:800}, locale:'ro-RO' })).newPage();
p.on('console',m=>{if(m.type()!=='log')console.log('C',m.text().slice(0,200))}); await p.goto('https://demo.tapselo.com/',{waitUntil:'networkidle',timeout:60000}).catch(e=>console.log(e.message));
await p.waitForTimeout(30000);
console.log(p.url()); console.log((await p.innerText('body')).slice(0,2000));
await p.screenshot({path:'/tmp/pd0.png'});
await b.close();
