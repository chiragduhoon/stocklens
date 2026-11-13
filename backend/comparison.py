from sqlalchemy import select
from .database import Stock
from .universe import BY_SYMBOL, metadata

def financial_row(stock):
    f=stock.financials
    return {
        'symbol':stock.symbol,'name':stock.name,'sector':stock.sector,
        'source_id':f'F-{stock.symbol}','nifty50_member':stock.symbol in BY_SYMBOL,
        'period':f['financial_period'],'basis':f['basis'],
        'revenue_crore':f['revenue_crore'],'net_profit_crore':f['net_profit_crore'],
        'revenue_growth_pct':f['revenue_growth_pct'],'profit_growth_pct':f['profit_growth_pct'],
        'net_margin_pct':f['net_margin_pct'],'roe_pct':f['roe_pct'],
        'pe_ratio':f['pe_ratio'],'eps':f['eps'],
        'debt_to_equity':f['debt_to_equity'] if f['debt_comparable'] else None,
        'roe_method':f['roe_method'],'simulated':bool(f.get('simulated',True)),
        'stale':bool(f.get('stale',False)),'as_of':stock.history[-1]['date'] if stock.history else None,
    }

def universe(db):
    companies=[financial_row(s) for s in db.scalars(select(Stock).order_by(Stock.name)).all() if s.symbol in BY_SYMBOL]
    return {'companies':companies,'sectors':sorted({c['sector'] for c in companies}),'metadata':metadata(),'as_of':max((c['as_of'] for c in companies if c['as_of']),default=None)}

def compare_rows(companies):
    sectors={c['sector'] for c in companies}
    simulated=any(c['simulated'] for c in companies)
    notes=([
        'All financial observations are generated. They are not actual quarterly company results.',
        'Growth is simulated year-on-year. ROE annualizes the quarter profit; revenue and net profit are in INR crore.',
    ] if simulated else [
        'Reported figures from Yahoo Finance for each company\'s latest available quarter; periods can differ between companies.',
        'Growth compares a quarter with the same quarter a year earlier. ROE and P/E are trailing twelve months. Revenue and net profit are in INR crore.',
    ])+['A lower P/E or higher growth rate alone does not establish a better investment.']
    if not simulated and any(c['stale'] for c in companies):notes.append('Some statements are more than six months old on the data source; treat those rows with caution.')
    if not simulated and len({c['period'] for c in companies})>1:notes.append('The selected companies report different latest quarters.')
    if len(sectors)>1:notes.append('These companies operate in different sectors. Business models and sector norms affect comparability.')
    if any(c['debt_to_equity'] is None for c in companies):notes.append('Debt/equity is omitted for financial-services companies; funding structures are not comparable to ordinary corporates.')
    observations=[]
    for key,label,unit,choose in [
        ('revenue_growth_pct','highest revenue growth','%',max),
        ('net_margin_pct','highest net margin','%',max),
        ('roe_pct','highest annualized ROE','%',max),
        ('pe_ratio','lowest P/E','×',min),
    ]:
        values=[c[key] for c in companies if c[key] is not None]
        if not values:continue  # metric unavailable for every selected company
        best=choose(values)
        leaders=[c for c in companies if c[key]==best]
        names=', '.join(c['symbol'] for c in leaders)
        observations.append({'metric':key,'text':f'{names} has the {label} in this selection: {best:.2f}{unit}.','source_ids':[c['source_id'] for c in companies]})
    return {'companies':companies,'observations':observations,'notes':notes,'mixed_sectors':len(sectors)>1,'metadata':metadata(),'as_of':max((c['as_of'] for c in companies if c['as_of']),default=None),'simulated':simulated}
