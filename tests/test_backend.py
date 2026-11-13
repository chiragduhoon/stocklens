import json
import pytest
import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from backend.database import Base, get_db, Holding, Stock, Report
from backend.seed import seed
from backend.main import app
from backend.analytics import technicals, consensus
from backend import llm

@pytest.fixture
def client():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session=sessionmaker(engine,expire_on_commit=False)
    with session() as db:seed(db)
    def override():
        with session() as db:yield db
    app.dependency_overrides[get_db]=override
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()

def test_seed_and_portfolio_math(client):
    body=client.get('/api/bootstrap').json()
    assert len(body['stocks'])==51
    assert len(body['news'])==153
    p=body['portfolio']
    assert len(p['holdings'])==6
    assert p['value']==sum(h['quantity']*h['price'] for h in p['holdings'])
    assert p['pnl']==round(p['value']-p['invested'],2)
    assert p['history'][-1]['value']==p['value']
    assert abs(sum(s['weight'] for s in p['sectors'])-100)<.2

def test_holding_lifecycle_and_validation(client):
    start=client.get('/api/portfolio').json()['value']
    r=client.post('/api/portfolio/holdings',json={'symbol':'ICICIBANK','quantity':10,'purchase_price':1100})
    assert r.status_code==201
    assert r.json()['value']==start+12800
    h=next(h for h in r.json()['holdings'] if h['symbol']=='ICICIBANK')
    assert client.post('/api/portfolio/holdings',json={'symbol':'ICICIBANK','quantity':1,'purchase_price':1100}).status_code==409
    r=client.patch(f"/api/portfolio/holdings/{h['id']}",json={'quantity':20,'purchase_price':1200})
    assert r.json()['value']==start+25600
    assert client.patch(f"/api/portfolio/holdings/{h['id']}",json={'quantity':0,'purchase_price':1200}).status_code==422
    assert client.post('/api/portfolio/holdings',json={'symbol':'UNKNOWN','quantity':1,'purchase_price':100}).status_code==404
    assert client.delete(f"/api/portfolio/holdings/{h['id']}").json()['value']==start
    assert client.delete(f"/api/portfolio/holdings/{h['id']}").status_code==404

def test_empty_portfolio_is_consistent(client):
    for h in client.get('/api/portfolio').json()['holdings']:client.delete(f"/api/portfolio/holdings/{h['id']}")
    p=client.get('/api/portfolio').json()
    assert p['value']==p['invested']==p['pnl']==0
    assert p['history']==p['sectors']==[]
    assert client.post('/api/portfolio/briefing').json()['insufficient_evidence'] is True

def test_analysis_and_evidence_links(client):
    d=client.get('/api/stocks/INFY/analysis').json()
    assert d['median_target']==1650
    assert d['target_upside_pct']==10
    assert d['consensus']=='Buy'
    assert d['research']['counts']=={'Buy':2,'Hold':1,'Sell':0}
    for source in ['F-INFY','M-INFY','M-PORTFOLIO']+[r['id'] for r in d['reports']]+[a['id'] for a in d['news']]:
        assert client.get('/api/sources/'+source).status_code==200
    assert client.get('/api/sources/not-real').status_code==404
    assert client.get('/api/stocks/NOTREAL/analysis').status_code==404
    assert client.get('/api/stocks/TCS/analysis').json()['consensus']=='Hold'
    assert client.get('/api/stocks/TATAMOTORS/analysis').json()['consensus']=='Sell'

def test_news_filter(client):
    news=client.get('/api/news?symbol=INFY&sentiment=negative').json()
    assert len(news)==1
    assert news[0]['symbols']==['INFY'] and news[0]['sentiment']=='negative'

@pytest.mark.parametrize('question',['hello','i said hello','Hello!!!','hey there','hi','thank you','what can you do'])
def test_conversation_does_not_retrieve_or_call_model(client,monkeypatch,question):
    def unexpected(*args,**kwargs):raise AssertionError('Conversation must not retrieve financial records or call the LLM')
    monkeypatch.setattr('backend.main.context',unexpected)
    monkeypatch.setattr(llm,'explain',unexpected)
    result=client.post('/api/chat',json={'question':question})
    assert result.status_code==200
    answer=result.json()
    assert answer['mode']=='conversation'
    assert answer['source_ids']==answer['sources']==[]
    assert answer['model']=='StockLens assistant'
    assert not answer['fallback'] and not answer['insufficient_evidence']

def test_greeting_with_financial_question_still_uses_research(client,monkeypatch):
    async def explain(question,evidence,fallback,mode):
        assert 'INFY' in question and evidence
        return {'answer':'INFY research','mode':mode}
    monkeypatch.setattr(llm,'explain',explain)
    assert client.post('/api/chat',json={'question':'Hello, explain INFY growth'}).json()['mode']=='chat'

def test_nifty_universe_and_comparison(client):
    u=client.get('/api/nifty50').json()
    symbols={c['symbol'] for c in u['companies']}
    assert len(symbols)==50
    assert {'SBIN','BSE','TMPV','M&M','BAJAJ-AUTO'} <= symbols
    assert 'TATAMOTORS' not in symbols
    result=client.post('/api/compare',json={'symbols':['INFY','TCS','SBIN']})
    assert result.status_code==200
    d=result.json()
    assert d['mixed_sectors'] and len(d['observations'])==4
    assert d['companies'][2]['debt_to_equity'] is None
    assert len({c['period'] for c in d['companies']})==1
    for c in d['companies']:
        assert abs(c['net_profit_crore']-c['revenue_crore']*c['net_margin_pct']/100)<.02
        assert client.get('/api/sources/'+c['source_id']).status_code==200
    for bad in [['INFY'],['INFY','INFY'],['INFY','UNKNOWN'],['INFY','TATAMOTORS'],['INFY','TCS','SBIN','ITC','BSE']]:
        assert client.post('/api/compare',json={'symbols':bad}).status_code==422
    for symbol in ['M&M','BAJAJ-AUTO','SBIN']:
        assert client.get('/api/stocks/'+symbol+'/analysis').status_code==200
        citation='F-'+symbol
        assert llm.validate_answer(json.dumps({'answer':'Evidence ['+citation+'].','source_ids':[citation],'insufficient_evidence':False}),{citation}).answer

def test_seed_preserves_existing_and_deleted_holdings(client):
    holdings=client.get('/api/portfolio').json()['holdings']
    client.delete('/api/portfolio/holdings/'+str(holdings[0]['id']))
    client.patch('/api/portfolio/holdings/'+str(holdings[1]['id']),json={'quantity':17,'purchase_price':1234})
    before=client.get('/api/portfolio').json()
    with next(app.dependency_overrides[get_db]()) as db:seed(db)
    assert client.get('/api/portfolio').json()==before
    assert len(client.get('/api/bootstrap').json()['stocks'])==51

def test_comparison_explanation_is_scoped(client,monkeypatch):
    async def fake(question,evidence,fallback,mode='analysis'):
        assert {e['id'] for e in evidence}=={'F-INFY','F-TCS'}
        assert mode=='comparison'
        return {'answer':fallback,'source_ids':[e['id'] for e in evidence],'fallback':False}
    monkeypatch.setattr(llm,'explain',fake)
    result=client.post('/api/compare/explain',json={'symbols':['INFY','TCS']})
    assert result.status_code==200
    assert len(result.json()['comparison']['companies'])==2

def test_technical_boundary_conditions():
    assert technicals([{'close':10}]*10)=={'sma20':None,'sma50':None,'rsi14':None}
    assert technicals([{'close':10}]*50)=={'sma20':10,'sma50':10,'rsi14':50}
    assert technicals([{'close':i} for i in range(1,51)])['rsi14']==100
    assert technicals([{'close':i} for i in range(50,0,-1)])['rsi14']==0

def test_unknown_and_missing_citations_rejected():
    valid={'answer':'Growth supports the view [F-INFY].','source_ids':['F-INFY'],'insufficient_evidence':False}
    assert llm.validate_answer(json.dumps(valid),{'F-INFY'}).answer
    with pytest.raises(ValueError):llm.validate_answer(json.dumps({**valid,'source_ids':['FAKE']}),{'F-INFY'})
    with pytest.raises(ValueError):llm.validate_answer(json.dumps({**valid,'source_ids':[]}),{'F-INFY'})
    with pytest.raises(ValueError):llm.validate_answer(json.dumps({**valid,'answer':'See [N-TCS-99].'}),{'F-INFY'})

def test_llm_offline_fallback(client,monkeypatch):
    class Offline:
        def __init__(self,*args,**kwargs):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,*args,**kwargs):raise httpx.ConnectError('offline')
    monkeypatch.setattr(llm.httpx,'AsyncClient',Offline)
    d=client.post('/api/stocks/INFY/explain').json()
    assert d['fallback'] is True
    assert d['source_ids']==[s['id'] for s in d['sources']]
    chat=client.post('/api/chat',json={'question':'Explain INFY'}).json()
    assert chat['fallback'] and chat['insufficient_evidence']
    assert chat['source_ids']==[]

def test_valid_model_response(client,monkeypatch):
    class Online:
        def __init__(self,*a,**k):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*a):pass
        async def post(self,url,json):
            return httpx.Response(200,request=httpx.Request('POST',url),json={'message':{'content':'{"answer":"INFY has 12% simulated revenue growth [F-INFY].","source_ids":["F-INFY"],"insufficient_evidence":false}'}})
    monkeypatch.setattr(llm.httpx,'AsyncClient',Online)
    r=client.post('/api/chat',json={'question':'Explain the growth for INFY'}).json()
    assert r['fallback'] is False and r['source_ids']==['F-INFY']

def test_news_matching_and_portfolio_facts_do_not_depend_on_model(client,monkeypatch):
    async def fake_explain(question,evidence,fallback,mode='analysis'):
        return {'answer':'A short focused explanation.','source_ids':[evidence[0]['id']],'sources':[evidence[0]],'fallback':False,'model':'test','simulated':True,'mode':mode,'insufficient_evidence':False}
    monkeypatch.setattr(llm,'explain',fake_explain)
    news=client.post('/api/chat',json={'question':'Which holdings have negative news?'}).json()
    assert '5 holdings' in news['answer']
    assert {s['symbol'] for s in news['sources']}=={'INFY','TCS','RELIANCE','ITC','TATAMOTORS'}
    assert all(s['sentiment']=='negative' for s in news['sources'])
    brief=client.post('/api/portfolio/briefing').json()
    assert '2 Buy, 3 Hold, and 1 Sell' in brief['answer']
    assert 'Focus: TATAMOTORS' in brief['answer']
    assert brief['source_ids'][0]=='M-PORTFOLIO'
