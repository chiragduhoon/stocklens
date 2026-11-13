"""Deterministic, fictional market fixtures; never represent live market data."""
from datetime import date, timedelta
import random
import math
import hashlib
from sqlalchemy import select
from .database import Stock, Holding, Article, Report
from .universe import BY_SYMBOL, CONSTITUENTS

AS_OF = '2026-10-29'
SPECS = [
 ('INFY','Infosys','Information technology',1500,12,24,.2,'positive',40,1400),
 ('TCS','Tata Consultancy Services','Information technology',3600,8,27,.1,'mixed',12,3400),
 ('HDFCBANK','HDFC Bank','Financial services',1600,14,19,.8,'positive',65,1510),
 ('RELIANCE','Reliance Industries','Diversified',1425,9,22,.45,'mixed',50,1390),
 ('ICICIBANK','ICICI Bank','Financial services',1280,16,21,.7,'positive',40,1130),
 ('BHARTIARTL','Bharti Airtel','Telecommunications',1850,11,35,1.2,'positive',20,1740),
 ('ITC','ITC Limited','Consumer staples',425,5,25,.05,'mixed',80,438),
 ('TATAMOTORS','Tata Motors','Automobiles',685,-4,12,1.1,'negative',30,760),
]
HEADLINES = {
 'INFY': [('Deal pipeline strengthens as clients resume discretionary spending','positive','Earnings'),('Margin discipline supports the research case, but valuation divides analysts','neutral','Research'),('Delayed client approvals remain a risk to the recovery','negative','Demand')],
 'TCS': [('Steady order book offers visibility; near-term growth stays measured','neutral','Earnings'),('Cloud modernization demand supports the long-term outlook','positive','Strategy'),('Higher delivery costs could soften operating margins','negative','Margins')],
 'HDFCBANK': [('Deposit growth improves the funding outlook','positive','Earnings'),('Retail lending momentum supports earnings visibility','positive','Research'),('Funding competition remains the key risk to watch','neutral','Industry')],
 'RELIANCE': [('Retail expansion balances a softer energy environment','neutral','Strategy'),('Digital business supports a diversified earnings base','positive','Earnings'),('Capital expenditure keeps free-cash-flow expectations in focus','negative','Cash flow')],
 'ICICIBANK': [('Asset quality and loan growth underpin the positive research view','positive','Earnings'),('Higher fee income adds a second growth engine','positive','Research'),('Credit costs could normalize from unusually low levels','neutral','Risk')],
 'BHARTIARTL': [('Improving revenue per user supports the margin outlook','positive','Earnings'),('Network investment strengthens the premium-service proposition','positive','Strategy'),('Debt and spectrum costs remain important constraints','negative','Balance sheet')],
 'ITC': [('Consumer demand holds steady as growth expectations moderate','neutral','Demand'),('Cash generation supports a resilient balance sheet','positive','Research'),('Input-cost pressure narrows the near-term upside case','negative','Margins')],
 'TATAMOTORS': [('Softer volumes put the recovery timeline under pressure','negative','Earnings'),('Analysts lower targets as margin uncertainty persists','negative','Research'),('New launches provide a catalyst, but execution remains critical','neutral','Strategy')],
}

def stable_seed(symbol):
    return int(hashlib.sha256(symbol.encode()).hexdigest()[:12],16)

# Keep existing demo prices/holdings stable while extending the official universe.
for constituent in CONSTITUENTS:
    symbol=constituent['Symbol']
    if any(s[0]==symbol for s in SPECS):
        continue
    rng=random.Random(stable_seed(symbol))
    name=constituent['Company Name']
    growth=round(rng.uniform(-6,23),1)
    scenario='positive' if growth>11 else ('negative' if growth<1 else 'mixed')
    price=float(rng.randrange(250,6500,5))
    SPECS.append((symbol,name,constituent['Industry'],price,growth,round(rng.uniform(12,49),1),round(rng.uniform(.05,1.8),2),scenario,0,price))
    HEADLINES[symbol]=[
        (f'{name}: simulated earnings point to {growth}% revenue growth','positive' if growth>8 else ('negative' if growth<0 else 'neutral'),'Earnings'),
        (f'Valuation and execution assumptions divide the research view on {symbol}','neutral','Research'),
        (f'{symbol}: demand and cost assumptions remain the key risks to watch','negative','Risk'),
    ]

def enrich_financials(stock):
    """Add internally consistent financial-comparison fields without resetting old data."""
    rng=random.Random(stable_seed(stock.symbol)+91)
    f=dict(stock.financials)
    revenue=f.get('revenue_crore',round(rng.uniform(2500,90000),2))
    margin=f.get('net_margin_pct',round(rng.uniform(6,25),2))
    profit=round(revenue*margin/100,2)
    roe=round(rng.uniform(8,29),2)
    additions={
        'net_profit_crore':profit,
        'profit_growth_pct':round(f['revenue_growth_pct']+rng.uniform(-5,8),2),
        'roe_pct':roe,
        'average_equity_crore':round(profit*4/(roe/100),2),
        'roe_method':'Annualized quarter net profit / average equity',
        'financial_period':'Q2 FY27',
        'basis':'Consolidated, simulated',
        'growth_basis':'Year-on-year, simulated',
        'fixture_version':2,
    }
    for key,value in additions.items():
        f.setdefault(key,value)
    if stock.symbol in BY_SYMBOL:
        stock.name=BY_SYMBOL[stock.symbol]['Company Name']
        stock.sector=BY_SYMBOL[stock.symbol]['Industry']
    f['debt_comparable']=stock.sector!='Financial Services'
    stock.financials=f

def seed(db):
    existing={s.symbol for s in db.scalars(select(Stock)).all()}
    fresh=not existing
    dates=[]; d=date.fromisoformat(AS_OF)
    while len(dates)<120:
        if d.weekday()<5:dates.append(d.isoformat())
        d-=timedelta(days=1)
    dates.reverse()
    for idx,(symbol,name,sector,price,growth,pe,debt,scenario,qty,buy) in enumerate(SPECS):
        if symbol in existing:
            continue
        rng=random.Random(72+idx)
        trend={'positive':.12,'mixed':.045,'negative':-.14}[scenario]
        values=[price*(1-trend+trend*i/119+.014*math.sin(i/6+idx)+rng.uniform(-.007,.007)) for i in range(120)]
        scale=price/values[-1]
        history=[]
        for i,(dt,v) in enumerate(zip(dates,values)):
            close=round(v*scale,2); opening=round(close*(1+rng.uniform(-.007,.007)),2)
            history.append({'date':dt,'open':opening,'high':round(max(close,opening)*1.006,2),'low':round(min(close,opening)*.994,2),'close':close,'volume':rng.randint(800000,4200000)})
        f={'source_id':f'F-{symbol}','period':'Q2 FY27 (simulated)','revenue_growth_pct':growth,'pe_ratio':pe,'debt_to_equity':debt,'eps':round(price/pe,2),'revenue_crore':round(21000+idx*5200,2),'net_margin_pct':round(12.5+growth*.35,2),'simulated':True}
        db.add(Stock(symbol=symbol,name=name,sector=sector,price=price,history=history,financials=f))
        if fresh and idx in [0,1,2,3,6,7]:
            db.add(Holding(symbol=symbol,quantity=qty,purchase_price=buy))
        views={'positive':['Buy','Buy','Hold'],'mixed':['Buy','Hold','Sell'],'negative':['Sell','Sell','Hold']}[scenario]
        multipliers={'positive':[1.14,1.10,1.0],'mixed':[1.11,1.03,.94],'negative':[.89,.93,1.01]}[scenario]
        if symbol=='INFY':multipliers=[1700/1500,1.10,1.0]
        for j,(view,multiple) in enumerate(zip(views,multipliers)):
            thesis={'Buy':f"The simulated research case for {name} emphasizes {growth}% revenue growth and operating execution. The target assumes demand stabilizes over the next 12 months.",'Hold':f"The report balances {name}'s operating fundamentals against valuation at {pe} times demo earnings. It favors waiting for clearer evidence of execution.",'Sell':f"The report sees limited valuation protection for {name} if growth or margins disappoint. Its target reflects a cautious 12-month scenario."}[view]
            risks=[HEADLINES[symbol][2][0],'The target depends on execution and is not a guaranteed outcome.']
            db.add(Report(id=f'R-{symbol}-{j+1}',symbol=symbol,analyst=['Research desk A','Research desk B','Research desk C'][j],recommendation=view,target=round(price*multiple,2),horizon_months=12,thesis=thesis,risks=risks,published_at=f'2026-10-{28-j:02}'))
        for j,(headline,sentiment,category) in enumerate(HEADLINES[symbol]):
            takeaway={'positive':'Supports the operating outlook; compare the assumptions with valuation.','neutral':'Adds context without resolving the disagreement between research views.','negative':'A risk to monitor alongside the positive parts of the investment case.'}[sentiment]
            body=(f"This fictional scenario concerns {name} ({symbol}). {headline}. "
                  f"The generated Q2 FY27 dataset shows revenue growth of {growth}% and a demo price-to-earnings ratio of {pe}. "
                  f"The event is relevant to the {sector.lower()} exposure in the portfolio. {takeaway} "
                  "This article was written for the StockLens demonstration. It is not an actual announcement or a report from a real publisher. "
                  "Compare it with the linked analyst reports; their price targets describe different scenarios rather than certain future prices.")
            db.add(Article(id=f'N-{symbol}-{j+1}',symbols=[symbol],headline=headline,body=body,sentiment=sentiment,category=category,published_at=f'2026-10-{29-j:02}T{9+idx%5:02}:30:00',takeaway=takeaway))
    db.flush()
    for stock in db.scalars(select(Stock)).all():
        enrich_financials(stock)
    db.commit()
