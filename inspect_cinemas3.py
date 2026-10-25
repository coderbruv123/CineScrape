import sys
import re
import json
import subprocess

# Fetch the cinemas page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/cinemas', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout
print('Cinemas HTML length:', len(html))

# Find the big script with JSON data
script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
print('Number of script tags:', len(script_matches))

# Look at script 19 (the big one)
script = script_matches[19]
print('Script 19 length:', len(script))

# Look for the JSON structure
# Find patterns like "cinema" followed by "api" or "cinema" followed by "cinemas"
# The data might be embedded in a JSON-LD or a script tag

# Look for data in the format: {"cinema":{"title":"...","slug":"...","city":"..."}
# Find all occurrences of '"title":"' followed by cinema names
title_matches = re.findall(r'"title":"([^"]+)"', script)
print('\nTitle matches:', title_matches[:20])

# Look for the JSON-LD
jsonld_matches = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
print('\nJSON-LD scripts:', len(jsonld_matches))

# Check for data in the script tags
# The script 19 is 572865 chars - let's see what's in it
# Look for the JSON structure
for i, s in enumerate(script_matches):
    if len(s) > 50000:
        print(f'\nScript {i} is large ({len(s)} chars)')
        # Look for cinema data
        if '"cinema"' in s or '"cinemas"' in s:
            print('  Contains cinema data')
        # Look for URL patterns
        url_matches = re.findall(r'"/cinemas/[a-z0-9-]+"', s)
        print(f'  URL patterns: {len(url_matches)}')
        if url_matches:
            print(f'  Sample URLs: {url_matches[:5]}')

# Let's check the first 200k chars of script 19 for patterns
# Look for the actual cinema data
# The data might be like "cinemas": [{"slug": "...", "name": "..."}, ...]
print('\n\n=== Looking for actual cinema data ===')
# Search for patterns like "cinema": [{ or "cinemas": [{ or "cinemas": {
for pattern in ['"cinemas": [', '"cinemas": {', '"cinema": [{', '"cinema": {']:
    if pattern in script:
        idx = script.find(pattern)
        print(f'Found {pattern} at {idx}')
        print(f'Context: {script[idx:idx+200]}')

# Let's look for the JSON data more broadly
# The data might be in a different script tag
# Let's look at all script tags for URLs
for i, s in enumerate(script_matches):
    urls = re.findall(r'"/cinemas/[a-z0-9-]+"', s)
    if urls:
        print(f'\nScript {i} has cinema URLs: {len(urls)}')
        print(f'  Sample: {urls[:5]}')

# Also look for the data in the format: "cinemas": [{"slug": "...", ...}]
# Look for key-value pairs
kv_pairs = re.findall(r'"([^"]+)":\s*\[{"slug":\s*"([^"]+)"', script)
print('\nKey-value pairs with cinema slugs:', len(kv_pairs))
if kv_pairs:
    print(f'  Sample: {kv_pairs[0]}')
