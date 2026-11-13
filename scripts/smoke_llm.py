import json
import httpx
with httpx.Client(base_url='http://127.0.0.1:8000',timeout=150,trust_env=False) as client:
    health=client.get('/api/health').json()
    print('Connected:',health['llm']['connected'])
    for path,body in [('/api/stocks/INFY/explain',None),('/api/chat',{'question':'Why do the analyst reports disagree on INFY?'}),('/api/chat',{'question':'What is the weather in Tokyo tomorrow?'})]:
        response=client.post(path,json=body);response.raise_for_status();data=response.json()
        for source in data['source_ids']:
            assert client.get('/api/sources/'+source).status_code==200,source
        print(json.dumps({'path':path,'fallback':data['fallback'],'insufficient_evidence':data['insufficient_evidence'],'sources':data['source_ids'],'answer':data['answer']},ensure_ascii=False))
