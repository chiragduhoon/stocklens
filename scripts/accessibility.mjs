import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const results=[];
for(const view of ['overview','holdings','research','assistant','connection']){
 await page.goto('http://127.0.0.1:8000/#'+view);
 await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 results.push({view,violations:scan.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
}
await mkdir('test-results',{recursive:true});
await writeFile('test-results/accessibility.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));await browser.close();
