import re
import json
import subprocess

# Fetch the cinemas page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/cinemas', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout

# Find JSON-LD
jsonld_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
if jsonld_match:
    jsonld = jsonld_match.group(1)
    print('JSON-LD length:', len(jsonld))
    print('JSON-LD:', jsonld[:2000])

    # Try to parse it
    try:
        data = json.loads(jsonld)
        print('\nParsed JSON-LD structure:')
        print(json.dumps(data, indent=2)[:3000])
    except Exception as e:
        print('JSON parse error:', e)
        print('First 500 chars:', jsonld[:500])
else:
    print('No JSON-LD found')
    
    # Look for JSON-LD without type
    jsonld_match2 = re.search(r'<script[^>]*>\{', html)
    if jsonld_match2:
        print('\nFirst script tag context:')
        print(html[jsonld_match2.start():jsonld_match2.start()+500])
