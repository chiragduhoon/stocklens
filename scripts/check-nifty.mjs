import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/previews',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();
await page.goto('http://127.0.0.1:8000/#nifty50');
await page.getByRole('checkbox').first().waitFor();
await page.evaluate(()=>document.fonts.ready);
const scans=[];
for(const view of ['explore','compare']){
 if(view==='compare'){
  await page.getByRole('button',{name:'Compare 3 companies'}).click();
  await page.locator('.comparison-table').waitFor();
 }
 await page.screenshot({path:`test-results/previews/nifty-${view}.png`,fullPage:true});
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 scans.push({view,violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
}
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'test-results/previews/nifty-mobile.png',fullPage:true});
await writeFile('test-results/nifty-accessibility.json',JSON.stringify(scans,null,2));
console.log(JSON.stringify(scans));
await browser.close();
