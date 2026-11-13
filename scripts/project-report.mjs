import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const html=`<!doctype html><html><head><meta charset="utf-8"><title>StockLens Project Report</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#26332c;font:10.5pt/1.4 Arial,sans-serif;background:white}.page{width:210mm;height:297mm;padding:18mm 19mm 17mm;position:relative;break-after:page}.page:last-child{break-after:auto}.kicker{font-size:9pt;letter-spacing:1.5px;color:#45624f;text-transform:uppercase;border-top:3px solid #45624f;padding-top:12px}h1{font-size:29pt;line-height:1.1;margin:15px 0 7px}h2{font-size:13pt;margin:15px 0 6px;color:#315c46}p{margin:0 0 8px}.subtitle{font-size:12pt;color:#667067;margin-bottom:20px}.note{background:#f0f2ed;border-left:3px solid #69806c;padding:10px 13px;margin-top:13px;font-size:10pt}.tools{border-collapse:collapse;width:100%;font-size:10pt}.tools td{padding:6px 8px;border-bottom:1px solid #dde2da;vertical-align:top}.tools td:first-child{width:35%;font-weight:bold}.footer{position:absolute;bottom:12mm;left:19mm;right:19mm;border-top:1px solid #dde2da;padding-top:7px;display:flex;justify-content:space-between;font-size:8pt;color:#687268}.flow{padding:12px;background:#f0f2ed;text-align:center;font-size:10pt;font-weight:bold;line-height:1.8}.problem{margin-bottom:9px}.problem b{color:#315c46}
</style></head><body>
<section class="page">
<div class="kicker">Project report · Financial research application</div>
<h1>StockLens</h1>
<p class="subtitle">A simple way to study and compare Nifty 50 companies</p>
<h2>1. Why I chose this project</h2>
<p>I chose this project because studying stocks can be confusing for a beginner. Company results, news, and analyst views are often spread across different places. It takes time to collect this information and understand what it means. I wanted to build one application where a user could explore companies, compare their financial figures, and ask questions in simple language.</p>
<p>This project also helped me connect finance with software development and artificial intelligence. My aim was to make financial research easier to understand, while learning how a website, a database, and an AI model work together.</p>
<h2>2. What the project does</h2>
<p>StockLens lists the 50 companies in a saved Nifty 50 membership list. Users can search for a company, filter by sector, and compare two to four companies at a time. The comparison includes revenue, net profit, growth, profit margin, return on equity (ROE), price-to-earnings ratio (P/E), and debt-to-equity ratio where suitable.</p>
<p>Users can also add, edit, or remove portfolio holdings, read sample news and analyst reports, export a comparison as a CSV file, and ask the assistant to explain the available information. Source buttons let users open the records used in an answer.</p>
<h2>3. Tools and technologies used</h2>
<table class="tools">
<tr><td>React and TypeScript</td><td>Build the screens, forms, search, and comparison features.</td></tr>
<tr><td>CSS, Recharts, Lucide</td><td>Create the grey design, financial charts, and icons.</td></tr>
<tr><td>Python and FastAPI</td><td>Handle requests, calculate figures, and connect the app to the AI model.</td></tr>
<tr><td>SQLite and SQLAlchemy</td><td>Store company records, sample reports, news, and portfolio holdings.</td></tr>
<tr><td>Qwen 2.5 7B and Ollama</td><td>Run the language model that explains the supplied records.</td></tr>
<tr><td>SSH connection to Chirag</td><td>Connect the application to the model running on the remote computer.</td></tr>
<tr><td>Pytest and Playwright</td><td>Check calculations, API responses, and browser actions.</td></tr>
</table>
<div class="note"><b>Data used:</b> Company membership comes from an official NSE Indices list saved on 30 October 2026. Financial figures, prices, news, and analyst reports are generated sample data. No paid news or model API is used.</div>
<div class="footer"><span>StockLens · Project report</span><span>Page 1 of 2</span></div>
</section>
<section class="page">
<div class="kicker">Working process · Challenges · Learning</div>
<h2>4. How the project works</h2>
<div class="flow">User chooses companies or asks a question<br>↓<br>FastAPI reads the saved records and calculates the figures<br>↓<br>The local AI model explains the selected information<br>↓<br>The app displays the result with supporting records</div>
<p style="margin-top:12px">Python handles the calculations so that the main figures do not depend on the AI model. The model mainly explains the information it receives. Simple greetings are handled separately. If the model is unavailable or its answer fails the checks, the app clearly labels a prepared response.</p>
<h2>5. Problems I faced and how I handled them</h2>
<p class="problem"><b>No suitable free news feed:</b> I did not have a suitable news API for this prototype. I used generated news, reports, and financial figures to show how the system works. These records are clearly marked as sample data.</p>
<p class="problem"><b>The assistant misunderstood greetings:</b> When I typed “hello,” it gave a long portfolio summary. Every message was being sent with financial records. I added a separate route for greetings and simple conversation, so these messages now get short replies without source buttons.</p>
<p class="problem"><b>AI answers could be inaccurate:</b> The model could mix up company details or make unclear statements. I kept calculations in Python, limited the records sent for each question, and checked the source IDs in responses. These checks help, but they do not guarantee that every AI sentence is correct.</p>
<p class="problem"><b>Expanding the company list:</b> The first version had only eight companies. I expanded it to all 50 companies in the saved Nifty 50 list. I also kept the old Tata Motors demo entry separately so that existing portfolio holdings were not lost or silently renamed.</p>
<p class="problem"><b>Comparing different types of companies:</b> A bank and an IT company have different business models. I added sector filters and comparison notes. Debt-to-equity is left out for financial-services companies, and the app does not declare one company the best investment.</p>
<p class="problem"><b>Connection and screen-size issues:</b> The AI needs the remote computer and SSH connection to be available. I added connection status and fallback messages. Wide comparison tables also needed horizontal scrolling inside the table to work on small screens.</p>
<h2>6. What I learned and future improvements</h2>
<p>I learned how to connect a user interface, a Python server, a database, and a local AI model. I also learned that clear data labels, correct calculations, and testing are as important as a good design. The latest checks passed 21 backend tests and 7 browser tests.</p>
<p>In the future, I would connect permitted real financial and news sources, verify analyst identities and SEBI registration before showing them as trusted, and improve follow-up conversations. The present version is a working learning prototype, not a source of live investment advice.</p>
<div class="footer"><span>StockLens · Project report</span><span>Page 2 of 2</span></div>
</section></body></html>`;
await writeFile('D:/FIN/StockLens_Project_Report.html',html);
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage();
await page.setContent(html);
const layout=await page.locator('.page').evaluateAll(pages=>pages.map(p=>({height:p.clientHeight,content:p.scrollHeight,footerTop:p.querySelector('.footer').offsetTop,lastContentBottom:p.querySelector('.footer').previousElementSibling.getBoundingClientRect().bottom-p.getBoundingClientRect().top})));
console.log(JSON.stringify(layout));
await page.pdf({path:'D:/FIN/StockLens_Project_Report.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
await browser.close();

