from statistics import median
import numpy as np
from sqlalchemy import select
from .database import Stock, Holding, Report, Article
from .universe import BY_SYMBOL

def as_of(stock_or_history):
    history=stock_or_history if isinstance(stock_or_history,list) else stock_or_history.history
    return history[-1]['date'] if history else None

def is_simulated(s):
    return bool(s.financials.get('simulated',True))

def consensus(reports,aggregate=None):
    if aggregate and aggregate.get('total'):
        # Real data: Yahoo Finance analyst counts and price-target range (no individual reports).
        counts=aggregate['counts'];n=aggregate['total']
        view=next((v for v in ['Buy','Sell'] if counts[v]>n/2),'Hold')
        return {'view':view,'counts':counts,'total':n,'median_target':aggregate.get('median_target'),'low_target':aggregate.get('low_target'),'high_target':aggregate.get('high_target'),'source':'Yahoo Finance analyst consensus'}
    counts={v:sum(r.recommendation==v for r in reports) for v in ['Buy','Hold','Sell']}
    n=len(reports)
    if not n:return {'view':'Unavailable','counts':counts,'total':0,'median_target':None,'low_target':None,'high_target':None}
    view=next((v for v in ['Buy','Sell'] if counts[v]>n/2),'Hold')
    return {'view':view,'counts':counts,'total':n,'median_target':median([r.target for r in reports]),'low_target':min(r.target for r in reports),'high_target':max(r.target for r in reports)}

def technicals(history):
    a=np.array([p['close'] for p in history],dtype=float)
    rsi=None
    if len(a)>=15:
        diff=np.diff(a);g=np.maximum(diff,0);l=np.maximum(-diff,0)
        gain=float(g[:14].mean());loss=float(l[:14].mean())
        for i in range(14,len(diff)):
            gain=(gain*13+float(g[i]))/14;loss=(loss*13+float(l[i]))/14
        rsi=50 if gain==loss==0 else (100 if loss==0 else 100-100/(1+gain/loss))
    return {'sma20':round(float(a[-20:].mean()),2) if len(a)>=20 else None,'sma50':round(float(a[-50:].mean()),2) if len(a)>=50 else None,'rsi14':round(rsi,1) if rsi is not None else None}

def report_dict(r):
    return {'id':r.id,'symbol':r.symbol,'analyst':r.analyst,'recommendation':r.recommendation,'target':r.target,'horizon_months':r.horizon_months,'thesis':r.thesis,'risks':r.risks,'published_at':r.published_at,'simulated':not r.id.endswith('-consensus'),'registration_verified':False}

def article_dict(a):
    return {'id':a.id,'symbols':a.symbols,'headline':a.headline,'body':a.body,'sentiment':a.sentiment,'category':a.category,'published_at':a.published_at,'takeaway':a.takeaway,'publisher':a.publisher or 'StockLens demo newsroom','url':a.url,'simulated':a.publisher is None}

def stock_summary(db,s):
    reports=db.scalars(select(Report).where(Report.symbol==s.symbol)).all()
    c=consensus(reports,s.financials.get('analyst'))
    prev=s.history[-2]['close'] if len(s.history)>1 else s.price
    return {'symbol':s.symbol,'name':s.name,'sector':s.sector,'price':s.price,'change':round(s.price-prev,2),'change_pct':round((s.price/prev-1)*100,2),'consensus':c['view'],'median_target':c['median_target'],'target_upside_pct':round((c['median_target']/s.price-1)*100,2) if c['median_target'] else None,'sparkline':[p['close'] for p in s.history[-20:]],'nifty50_member':s.symbol in BY_SYMBOL,'simulated':is_simulated(s)}

def stock_detail(db,s):
    reports=db.scalars(select(Report).where(Report.symbol==s.symbol)).all()
    news=[article_dict(a) for a in db.scalars(select(Article).order_by(Article.published_at.desc())).all() if s.symbol in a.symbols]
    return {**stock_summary(db,s),'history':s.history,'financials':s.financials,'technicals':technicals(s.history),'research':consensus(reports,s.financials.get('analyst')),'reports':[report_dict(r) for r in reports],'news':news,'as_of':as_of(s),'metrics_source_id':f'M-{s.symbol}'}

def portfolio(db):
    holdings=[]
    for h in db.scalars(select(Holding).order_by(Holding.id)).all():
        s=db.get(Stock,h.symbol)
        info=stock_summary(db,s);value=h.quantity*s.price;cost=h.quantity*h.purchase_price
        holdings.append({**info,'id':h.id,'quantity':h.quantity,'purchase_price':h.purchase_price,'value':round(value,2),'cost':round(cost,2),'pnl':round(value-cost,2),'pnl_pct':round((value/cost-1)*100,2),'day_pnl':round(h.quantity*(s.price-s.history[-2]['close']),2)})
    value=round(sum(h['value'] for h in holdings),2);cost=round(sum(h['cost'] for h in holdings),2)
    day=round(sum(h['day_pnl'] for h in holdings),2)
    sectors={}
    for h in holdings:
        h['weight_pct']=round(h['value']/value*100,2) if value else 0
        sectors[h['sector']]=sectors.get(h['sector'],0)+h['value']
    hist=[];stockmap={}
    if holdings:
        stockmap={h['symbol']:db.get(Stock,h['symbol']) for h in holdings}
        for i,p in enumerate(next(iter(stockmap.values())).history):
            hist.append({'date':p['date'],'value':round(sum(h['quantity']*stockmap[h['symbol']].history[i]['close'] for h in holdings),2)})
    return {'holdings':holdings,'value':value,'invested':cost,'pnl':round(value-cost,2),'pnl_pct':round((value/cost-1)*100,2) if cost else 0,'day_pnl':day,'day_pct':round(day/(value-day)*100,2) if value-day else 0,'history':hist,'sectors':[{'name':k,'value':round(v,2),'weight':round(v/value*100,1)} for k,v in sorted(sectors.items(),key=lambda x:-x[1])],'as_of':as_of(next(iter(stockmap.values()))) if holdings else None,'simulated':any(h['simulated'] for h in holdings),'history_method':'Current holdings repriced across '+('simulated' if any(h['simulated'] for h in holdings) else 'actual')+' historical closes; not a transaction-based return series.'}
