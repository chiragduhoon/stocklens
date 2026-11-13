"""Handle conversational messages before retrieving financial evidence."""
import re


def conversational_reply(question):
    text = re.sub(r'[^a-z0-9\s]', ' ', question.lower())
    text = ' '.join(text.split())
    greeting = r'(?:hello|hi|hey|hey there|hello there|hi there|good morning|good afternoon|good evening|namaste)'
    if re.fullmatch(r'(?:i (?:just )?said |i was (?:just )?saying |just saying )?' + greeting + r'(?: again| there| bro| man| sir)?', text):
        reply = 'Hello! What would you like to explore—your portfolio, a company, or a Nifty 50 financial comparison?'
    elif re.fullmatch(r'(?:thanks|thank you|thank you very much|thanks a lot|ok|okay|got it|great|cool)', text):
        reply = 'You’re welcome. Let me know what you’d like to explore next.'
    elif re.fullmatch(r'(?:how are you|how are you doing|hello how are you|hi how are you)', text):
        reply = 'I’m ready to help. What would you like to explore today?'
    elif re.fullmatch(r'(?:help|what can you do|how can you help(?: me)?)', text):
        reply = 'I can explain a company’s financials, review portfolio news, and help you understand Nifty 50 comparisons. Try “Explain INFY growth” or “Which holdings have negative news?” The project uses generated demonstration data.'
    else:
        return None
    return {'answer': reply, 'source_ids': [], 'sources': [], 'fallback': False,
            'model': 'StockLens assistant', 'simulated': True,
            'insufficient_evidence': False, 'mode': 'conversation'}
