from contextlib import asynccontextmanager
from pathlib import Path
import re
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from .database import engine, get_db, SessionLocal, Stock, Holding, Article, Report, DATA_MODE, migrate
from .seed import seed
from .analytics import portfolio, stock_summary, stock_detail, article_dict, as_of, is_simulated
from . import llm
from .universe import metadata as universe_metadata, BY_SYMBOL
from .comparison import universe, financial_row, compare_rows
from .conversation import conversational_reply

@asynccontextmanager
async def lifespan(app):
    migrate(engine)
    with SessionLocal() as db:
        if DATA_MODE=='demo':seed(db)
        elif not db.scalars(select(Stock)).first():
            raise RuntimeError('No market data yet. Run: python -m backend.market_data  (or set STOCKLENS_DATA=demo for the offline demo).')
    yield

app=FastAPI(title='StockLens API',version='1.0.0',lifespan=lifespan,docs_url='/api/docs',openapi_url='/api/openapi.json')
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:5173','http://localhost:5173'],allow_methods=['GET','POST','PATCH','DELETE'],allow_headers=['Content-Type'])

class HoldingInput(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False,extra='forbid')
    symbol:str=Field(min_length=1,max_length=20)
    quantity:float=Field(gt=0,le=100000000)
    purchase_price:float=Field(gt=0,le=1000000000)

class HoldingUpdate(BaseModel):
    model_config=ConfigDict(allow_inf_nan=False,extra='forbid')
    quantity:float=Field(gt=0,le=100000000)
    purchase_price:float=Field(gt=0,le=1000000000)

class ChatInput(BaseModel):
    question:str=Field(min_length=1,max_length=2000,pattern=r'\S')
    symbol:str|None=None

class ComparisonInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    symbols:list[str]=Field(min_length=2,max_length=4)

def selected_comparison(db,data):
    symbols=[s.strip().upper() for s in data.symbols]
    if len(set(symbols))!=len(symbols):raise HTTPException(422,'Choose distinct companies for comparison.')
    if any(s not in BY_SYMBOL for s in symbols):raise HTTPException(422,'Choose companies from the pinned Nifty 50 universe.')
    return compare_rows([financial_row(require_stock(db,s)) for s in symbols])

def require_stock(db,symbol):
    s=db.get(Stock,symbol.upper())
    if not s:raise HTTPException(404,'Stock not found in the Nifty 50 universe')
    return s

@app.get('/api/health')
async def health():return {'service':'stocklens','status':'ok','data_mode':DATA_MODE,'simulated':DATA_MODE=='demo','llm':await llm.health()}

@app.get('/api/bootstrap')
def bootstrap(db:Session=Depends(get_db)):
    return {'portfolio':portfolio(db),'stocks':[stock_summary(db,s) for s in db.scalars(select(Stock)).all()],'news':[article_dict(a) for a in db.scalars(select(Article).order_by(Article.published_at.desc())).all()],'as_of':max((as_of(s) for s in db.scalars(select(Stock)).all()),default=None),'data_mode':DATA_MODE,'simulated':DATA_MODE=='demo','universe':universe_metadata(),'counts':{'stocks':db.scalar(select(func.count()).select_from(Stock)),'reports':db.scalar(select(func.count()).select_from(Report)),'articles':db.scalar(select(func.count()).select_from(Article))}}

@app.get('/api/nifty50')
def nifty50(db:Session=Depends(get_db)):
    return universe(db)

@app.post('/api/compare')
def compare(data:ComparisonInput,db:Session=Depends(get_db)):
    return selected_comparison(db,data)

@app.post('/api/compare/explain')
async def explain_comparison(data:ComparisonInput,db:Session=Depends(get_db)):
    comparison=selected_comparison(db,data)
    records=[source_record(db,c['source_id']) for c in comparison['companies']]
    facts=' '.join(o['text'] for o in comparison['observations'])
    answer=await llm.explain('Compare ONLY these selected companies using the supplied financial records: '+', '.join(c['symbol'] for c in comparison['companies'])+'. Explain trade-offs and sector comparability, not an overall winner or investment recommendation. These computed observations are authoritative: '+facts,records,facts+' These are prepared observations from the simulated financial dataset.','comparison')
    answer['comparison']=comparison
    return answer

@app.get('/api/portfolio')
def get_portfolio(db:Session=Depends(get_db)):return portfolio(db)

@app.post('/api/portfolio/holdings',status_code=201)
def add_holding(data:HoldingInput,db:Session=Depends(get_db)):
    s=require_stock(db,data.symbol)
    if db.scalar(select(Holding).where(Holding.symbol==s.symbol)):raise HTTPException(409,'This stock is already in your portfolio. Edit its quantity instead.')
    db.add(Holding(symbol=s.symbol,quantity=data.quantity,purchase_price=data.purchase_price))
    try:db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'This stock is already in your portfolio.')
    return portfolio(db)

@app.patch('/api/portfolio/holdings/{holding_id}')
def edit_holding(holding_id:int,data:HoldingUpdate,db:Session=Depends(get_db)):
    h=db.get(Holding,holding_id)
    if not h:raise HTTPException(404,'Holding not found')
    h.quantity=data.quantity;h.purchase_price=data.purchase_price;db.commit()
    return portfolio(db)

@app.delete('/api/portfolio/holdings/{holding_id}')
def remove_holding(holding_id:int,db:Session=Depends(get_db)):
    h=db.get(Holding,holding_id)
    if not h:raise HTTPException(404,'Holding not found')
    db.delete(h);db.commit();return portfolio(db)

@app.get('/api/stocks/{symbol}/analysis')
def analysis(symbol:str,db:Session=Depends(get_db)):return stock_detail(db,require_stock(db,symbol))

@app.get('/api/news')
def news(symbol:str|None=None,sentiment:str|None=None,db:Session=Depends(get_db)):
    items=db.scalars(select(Article).order_by(Article.published_at.desc())).all()
    return [article_dict(a) for a in items if (not symbol or symbol.upper() in a.symbols) and (not sentiment or sentiment==a.sentiment)]

def source_record(db,source_id):
    if source_id=='M-PORTFOLIO':
        p=portfolio(db)
        counts={v:sum(h['consensus']==v for h in p['holdings']) for v in ['Buy','Hold','Sell']}
        return {'id':source_id,'kind':'metrics','title':'Calculated portfolio totals','body':f"Portfolio value INR {p['value']:,.2f}; invested INR {p['invested']:,.2f}; unrealized P/L INR {p['pnl']:,.2f}; {len(p['holdings'])} holdings. Research consensus counts: {counts}. Sector weights: {p['sectors']}. Current holdings repriced using "+('simulated' if p['simulated'] else 'actual end-of-day')+" prices.",'symbol':'PORTFOLIO','date':p['as_of'],'simulated':p['simulated']}
    if a:=db.get(Article,source_id):return {'id':a.id,'kind':'news','title':a.headline,'body':a.body,'symbol':a.symbols[0],'date':a.published_at,'sentiment':a.sentiment,'publisher':a.publisher,'url':a.url,'simulated':a.publisher is None}
    if r:=db.get(Report,source_id):return {'id':r.id,'kind':'report','title':f'{r.symbol} · {r.analyst} · {r.recommendation}','body':f'{r.analyst}: {r.recommendation}. Target: INR {r.target}, {r.horizon_months}-month horizon. {r.thesis} Risks: '+ ' '.join(r.risks),'symbol':r.symbol,'date':r.published_at,'simulated':not r.id.endswith('-consensus')}
    if source_id.startswith(('F-','M-')):
        if s:=db.get(Stock,source_id[2:]):
            d=stock_detail(db,s)
            if source_id.startswith('F-'):
                f=s.financials;debt=f['debt_to_equity'] if f.get('debt_comparable',True) else 'not comparable for financial services'
                basis='consolidated simulated data' if is_simulated(s) else f"{f.get('basis','reported')}, source {f.get('source','Yahoo Finance')}"+(' (statement older than six months)' if f.get('stale') else '')
                body=f"{s.symbol}, {s.name}, sector {s.sector}. {f['period']}, {basis}: revenue INR {f['revenue_crore']} crore; net profit INR {f['net_profit_crore']} crore; revenue growth {f['revenue_growth_pct']}% YoY; profit growth {f['profit_growth_pct']}% YoY; net margin {f['net_margin_pct']}%; annualized ROE {f['roe_pct']}%; P/E {f['pe_ratio']}; debt-to-equity {debt}; EPS INR {f['eps']}."
            else:body=f"{'Demo' if is_simulated(s) else 'Close'} price INR {s.price}; analyst consensus {d['consensus']}; analyst counts {d['research']['counts']}; median target INR {d['median_target']}; target range INR {d['research']['low_target']} to {d['research']['high_target']}; target upside {d['target_upside_pct']}%; technical indicators {d['technicals']}."
            return {'id':source_id,'kind':'financials' if source_id.startswith('F-') else 'metrics','title':f'{s.symbol} · '+('Financial statement' if source_id.startswith('F-') else 'Calculated metrics'),'body':body,'symbol':s.symbol,'date':as_of(s),'simulated':is_simulated(s)}
    raise HTTPException(404,'Evidence record not found')

@app.get('/api/sources/{source_id}')
def get_source(source_id:str,db:Session=Depends(get_db)):return source_record(db,source_id)

def context(db,symbols):
    result=[]
    for symbol in symbols:
        result.extend([source_record(db,f'F-{symbol}'),source_record(db,f'M-{symbol}')])
        result.extend(source_record(db,r.id) for r in db.scalars(select(Report).where(Report.symbol==symbol)).all())
        articles=[a for a in db.scalars(select(Article).order_by(Article.published_at.desc())).all() if symbol in a.symbols]
        result.extend(source_record(db,a.id) for a in articles[:3])
    return result

@app.post('/api/stocks/{symbol}/explain')
async def explain_stock(symbol:str,db:Session=Depends(get_db)):
    s=require_stock(db,symbol);d=stock_detail(db,s)
    kind='simulated reports' if is_simulated(s) else 'analysts'
    target=f" The median 12-month target is INR {d['median_target']:,.0f}, {d['target_upside_pct']:.1f}% from the {'demo' if is_simulated(s) else 'latest'} price." if d['median_target'] else ''
    fallback=f"{s.name} has a {d['consensus']} consensus across {d['research']['total']} {kind}.{target} Reports disagree on execution and valuation; inspect the research and risks before interpreting the target. This is a prepared summary, not a live model response."
    return await llm.explain(f'Explain the research case for {symbol}, disagreements, and key risks.',context(db,[s.symbol]),fallback)

@app.post('/api/portfolio/briefing')
async def briefing(db:Session=Depends(get_db)):
    p=portfolio(db);symbols=[h['symbol'] for h in p['holdings']]
    if not symbols:return {'answer':'Add a holding to create a portfolio briefing.','source_ids':[],'sources':[],'fallback':True,'simulated':True,'insufficient_evidence':True,'mode':'briefing'}
    counts={v:sum(h['consensus']==v for h in p['holdings']) for v in ['Buy','Hold','Sell']}
    # Portfolio-wide facts are deterministic. Focus model reasoning on one company
    # to reduce cross-company attribution errors observed in real-model evaluation.
    intro=f"Your {len(symbols)} holdings have {counts['Buy']} Buy, {counts['Hold']} Hold, and {counts['Sell']} Sell research consensuses. Portfolio value is INR {p['value']:,.0f}, with unrealized P/L of INR {p['pnl']:,.0f}."
    if p['sectors']:
        sector=p['sectors'][0];intro+=f" The largest sector is {sector['name']} at {sector['weight']:.1f}%."
    focus=sorted(p['holdings'],key=lambda h:(h['consensus']=='Sell',h['weight_pct']),reverse=True)[0]['symbol']
    fallback=f"Focus on {focus}: inspect the analyst disagreement and the linked news before interpreting any target. This is a prepared research note."
    answer=await llm.explain(f'Write a focused research note ONLY about {focus}: explain its analyst consensus, disagreement, and the main risk. Do not mention other companies. Targets are hypothetical 12-month scenarios.',context(db,[focus]),fallback,'briefing')
    answer['answer']=intro+' [M-PORTFOLIO]\n\nFocus: '+focus+'\n'+answer['answer']
    answer['source_ids']=['M-PORTFOLIO']+answer['source_ids']
    answer['sources']=[source_record(db,'M-PORTFOLIO')]+answer['sources']
    return answer

@app.post('/api/chat')
async def chat(data:ChatInput,db:Session=Depends(get_db)):
    reply=conversational_reply(data.question)
    if reply is not None:return reply
    stocks=db.scalars(select(Stock)).all();q=data.question.lower()
    symbols=[s.symbol for s in stocks if re.search(r'\b'+re.escape(s.symbol.lower())+r'\b',q) or s.name.lower() in q]
    if data.symbol:
        sym=require_stock(db,data.symbol).symbol
        if sym not in symbols:symbols.append(sym)
    if not symbols:symbols=[h.symbol for h in db.scalars(select(Holding)).all()]
    if not symbols:return {'answer':'Your portfolio is empty. Add a holding or name a Nifty 50 stock.','source_ids':[],'sources':[],'fallback':True,'simulated':True,'insufficient_evidence':True,'mode':'chat'}
    sentiment=next((v for v in ['negative','positive','neutral'] if v in q),None)
    if sentiment and any(word in q for word in ['news','article','headline','development']):
        matched=[a for a in db.scalars(select(Article).order_by(Article.published_at.desc())).all() if a.sentiment==sentiment and any(s in symbols for s in a.symbols)]
        if not matched:return {'answer':f'No {sentiment} news records match the selected stocks.','source_ids':[],'sources':[],'fallback':False,'model':'Evidence lookup','simulated':True,'insufficient_evidence':True,'mode':'chat'}
        records=[source_record(db,a.id) for a in matched]
        matched_symbols=sorted({r['symbol'] for r in records})
        result=await llm.explain('Summarize these matched '+sentiment+' news articles. Keep each risk or development attributed to the correct stock. User question: '+data.question,records,'The model could not produce a validated narrative. The matched evidence records remain available below.','chat')
        result['answer']=f"{sentiment.capitalize()} news matches {len(matched_symbols)} holdings: "+', '.join(matched_symbols)+f" ({len(records)} articles).\n\n"+result['answer']
        result['source_ids']=[r['id'] for r in records];result['sources']=records
        return result
    records=context(db,symbols)
    return await llm.explain(data.question,records,'The research model is unavailable or its answer could not be validated. You can still inspect stock metrics, analyst reports, and news in Research.','chat')

DIST=Path(__file__).resolve().parents[1]/'dist'
if DIST.exists():
    app.mount('/assets',StaticFiles(directory=DIST/'assets'),name='assets')
    @app.get('/')
    def index():return FileResponse(DIST/'index.html')
