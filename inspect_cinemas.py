import sys
import re
import json

html = open('/home/dante/Documents/Projects/CineScrape/cinemas.html', 'r').read() if False else None

# We'll fetch the page first
import subprocess
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/cinemas', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout
print('HTML length:', len(html))

# Look for JSON data
# Find all script tags with JSON data
script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print('Number of script tags:', len(script_matches))

# Check for __NEXT_DATA__
if '__NEXT_DATA__' in html:
    print('Found __NEXT_DATA__')
    # Extract and parse
    idx = html.find('__NEXT_DATA__')
    end = html.find('</script>', idx)
    json_str = html[idx+len('__NEXT_DATA__='):end]
    try:
        data = json.loads(json_str)
        print('NEXT_DATA keys:', list(data.keys())[:10])
        print('Props:', list(data.get('props', {}).keys())[:10] if data.get('props') else 'None')
    except Exception as e:
        print('JSON parse error:', e)
else:
    print('No __NEXT_DATA__ found')

# Look for embedded JSON in any script
for i, script in enumerate(script_matches):
    if 'cinema' in script.lower()[:500] or 'cinema' in script.lower():
        print(f'Script {i} contains "cinema": {len(script)} chars')
        # Check for JSON structure
        if 'cinemas:[' in script or 'cinemas: [' in script:
            print('  Contains cinemas array')

# Look for JSON in the HTML directly
# Find the data after "window.__INITIAL_STATE__"
idx = html.find('window.__INITIAL_STATE__')
if idx != -1:
    print('Found window.__INITIAL_STATE__')
    # Extract the JSON
    end = html.find(';', idx)
    json_str = html[idx+len('window.__INITIAL_STATE__='):end]
    print('JSON length:', len(json_str))
else:
    print('No window.__INITIAL_STATE__ found')

# Check for other patterns
if '"cinema"' in html[:100000]:
    print('"cinema" found in first 100k chars')
    
if 'cinemas' in html[:100000]:
    print('cinemas found in first 100k chars')
