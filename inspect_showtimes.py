import sys
import re
import json
import subprocess

# Fetch the show-times page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/show-times', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout
print('Show-times HTML length:', len(html))

# Find large JSON blobs - look for 'cinema' with 'title' and 'slug'
# The data is in a format like {"branch":{"id":66,"title":"Qfx Guna Cinema","slug":"qfx-guna-cinema",...},"times":[...]}
# Let's find all occurrences of this pattern

# Look for "branch" with "title" and "slug" in the HTML
pattern = r'branch.*title.*slug'
matches = re.findall(pattern, html, re.DOTALL)
print('Found branch-title-slug patterns:', len(matches))
if matches:
    print('Sample:', matches[0][:300])

# The JSON data seems to be embedded in a large minified JSON structure
# Let's find the full JSON
# Look for '{"branch":{"id":' pattern
branch_matches = re.findall(r'\{"branch":\{"id":\d+"title":"[^"]+"', html)
print('\nFound branch records:', len(branch_matches))
if branch_matches:
    print('Sample:', branch_matches[0])

# Also look for the movie show_times data
movie_matches = re.findall(r'"show_times":\{"Today":\[\{"branch":\{"id":\d+"title":"[^"]+"', html)
print('\nFound show_times records:', len(movie_matches))
if movie_matches:
    print('Sample:', movie_matches[0])

# Let's extract the full JSON structure
# The data might be in a JSON string within the HTML
# Find the largest JSON object
# Look for '{"branch":{' patterns
branch_records = re.findall(r'\{"branch":\{"id":\d+,"title":"([^"]+)","slug":"([^"]+)"', html)
print('\nBranch records with titles and slugs:', len(branch_records))
if branch_records:
    print('Sample:', branch_records[0])
    # Count unique theaters
    unique_theaters = set(r[1] for r in branch_records)
    print('Unique theaters:', len(unique_theaters))

# Look for movie show_times data
showtime_records = re.findall(r'"show_times":\{"Today":\[\{"branch":\{"id":\d+,"title":"([^"]+)","slug":"([^"]+)"', html)
print('\nShow times records:', len(showtime_records))
if showtime_records:
    print('Sample:', showtime_records[0])

# Let's find the JSON in the script tags
script_matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
for i, script in enumerate(script_matches):
    if 'show_times' in script:
        print(f'\nScript {i} contains show_times: {len(script)} chars')
        # Find a sample
        idx = script.find('show_times')
        if idx != -1:
            print('  context:', script[max(0,idx-50):idx+300])
        break
