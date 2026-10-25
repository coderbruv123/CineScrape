import re
import json
import subprocess

# Fetch the show-times page
r = subprocess.run(['curl', '-s', 'https://www.thefilmnepal.com/show-times', 
                    '-H', 'User-Agent: CinemaScrapper/1.0 (research; contact: dev@example.com)'],
                   capture_output=True, text=True)
html = r.stdout

# Extract the JSON data
# The data is embedded in the HTML as minified JSON
# Look for patterns that indicate theater data

# Find the pattern: {"branch":{"id":X,"title":"...","slug":"...","location":"...","city":"..."}
# This pattern appears in the show_times data

# Look for "branch":{"id":X,"title":"<title>","slug":"<slug>","city":"<city>"
branch_pattern = r'"branch":\{"id":\d+,"title":"([^"]+)","slug":"([^"]+)","location":"([^"]+)","city":"([^"]+)"'
branches = re.findall(branch_pattern, html)

print('Found', len(branches), 'branch records')
if branches:
    print('Sample:', branches[0])
    
    # Group by theater slug
    theaters = {}
    for title, slug, location, city in branches:
        if slug not in theaters:
            theaters[slug] = {
                'name': title,
                'slug': slug,
                'city': city,
                'location': location,
                'branch_count': 0
            }
        theaters[slug]['branch_count'] += 1
    
    print('\nTheater data:')
    for slug, data in sorted(theaters.items()):
        print(f"  {data['slug']}: {data['name']} ({data['city']}, {data['branch_count']} branches)")

# Also look for show_times data
# Find patterns like {"id":X,"time":"HH:MM"}
times_pattern = r'"time":"([0-9:]+)"'
times = re.findall(times_pattern, html)
print('\nFound', len(times), 'time records')

# Look for the show_times data structure
# Find patterns like "show_times":{"Today":[...]
show_times = re.findall(r'"show_times":\{"Today":\[\{"branch":\{"id":\d+,"title":"([^"]+)","slug":"([^"]+)"', html)
print('\nShow times records:', len(show_times))
if show_times:
    print('Sample:', show_times[0])
