import sys
import re
import json
import subprocess

# Fetch the cinemas page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/cinemas', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout
print('HTML length:', len(html))

# Find the big script with JSON data
script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, script in enumerate(script_matches):
    if len(script) > 100000:  # The big scripts
        print(f'\nScript {i}: {len(script)} chars')
        # Look for cinema data
        # Find patterns like "cinema" followed by JSON
        # Look for the actual data structure
        if '"cinema"' in script:
            print('Contains "cinema"')
        if 'cinemas: [' in script:
            print('Contains cinemas: [')
        if 'cinemas:' in script:
            # Find where cinemas appears
            idx = script.find('cinemas:')
            print(f'  cinemas: found at {idx}')
            print(f'  context: {script[max(0,idx-100):idx+200]}')

# Let's check the show-times page data format and apply the same approach
print('\n\n=== Now checking show-times page ===')
r2 = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/show-times', 
                     '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                    capture_output=True, text=True)
html2 = r2.stdout
print('Show-times HTML length:', len(html2))

# The show-times page had large JSON with branch data
# Let's find the pattern
matches = re.findall(r'cinema.*title.*slug', html2)
print('Found cinema-title-slug patterns:', len(matches))
if matches:
    print('Sample:', matches[0][:200])
