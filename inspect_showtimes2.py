import re
import json
import subprocess

# Fetch the show-times page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/show-times', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout

# Find script tags
script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print('Number of scripts:', len(script_matches))

# Look at script 17 (the big one)
script = script_matches[17]
print('Script 17 length:', len(script))

# Find JSON data
# Look for patterns like {"branch":{"id":... or "show_times":{
# The data might be in a JSON-LD or a script tag

# Find "show_times" patterns
idx = script.find('show_times')
if idx != -1:
    print('Found show_times at:', idx)
    print('Context:')
    print(script[max(0,idx-200):idx+500])

# Look for JSON-LD
jsonld_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', script, re.DOTALL)
if jsonld_match:
    print('\nJSON-LD found in script 17:')
    print(jsonld_match.group(1)[:1000])
else:
    print('\nNo JSON-LD in script 17')

# Look for the JSON data
# Find the start of the JSON
# Look for patterns like {"branch": or "show_times":{"Today":
idx = script.find('"show_times":{"Today"')
if idx != -1:
    print('\nFound show_times data at:', idx)
    print('Context:')
    print(script[max(0,idx-100):idx+500])

# Try to extract the JSON
# Look for the pattern: {"branch":{"id":X,"title":"...","slug":"...","city":"..."}
# Find the start of the JSON
# The data might be in a variable
# Look for 'window.' patterns
window_matches = re.findall(r'window\.([a-zA-Z]+)\s*=', script)
print('\nWindow variables:', window_matches[:5])

# Look for the JSON data
# Find the pattern: {"id":X,"title":"...","slug":"...","city":"..."}
# The data might be embedded in a JSON-LD
# Let's try to find the JSON-LD in the script
jsonld = re.search(r'<script type="application/ld\+json">(.*?)</script>', script)
if jsonld:
    print('\nJSON-LD in script 17:')
    print(jsonld.group(1)[:1000])
