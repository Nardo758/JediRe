import os, subprocess, json, sys

ARCHIVE = r'C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive'
URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/parse-om'
SECRET = 'jedire-archive-2026'

done_first_run = [
    'Addison on Long Beach', 'Alta Lakehouse', 'Alta Tech Ridge',
    'Ardmore at Flowers', 'Ashley River', 'Avril Cambridge',
    'Azola Palm Beach', 'Cadence at Nocatee', 'Carrington at Brier Creek',
    'Crescent', 'Debartolo Portfolio', 'East Point at Altamonte',
    'Enclave on East', 'Exchange Orange Park', 'Ferry Pike - Nashville',
    'Heron Pointe',
]

all_files = []
for entry in os.listdir(ARCHIVE):
    d = os.path.join(ARCHIVE, entry)
    if not os.path.isdir(d) or entry.startswith('_'): continue
    if entry in done_first_run: continue
    for f in os.listdir(d):
        upper = f.upper()
        if upper.endswith('.PDF') and ' OM' in upper and not f.startswith('~$'):
            all_files.append((entry, f, os.path.join(d, f)))

print(f'Remaining: {len(all_files)} files')
for p, f, fp in all_files:
    sz = os.path.getsize(fp) // 1024
    print(f'  {p} / {f} ({sz}KB)')

success = 0
failed = 0
yb_count = 0
errors = []

for i, (parcel, fname, fpath) in enumerate(all_files):
    sz = os.path.getsize(fpath) // 1024
    enc = parcel.replace('&', '%26').replace(' ', '%20')
    url = f'{URL}?parcel_id={enc}&observation_date=2025-01-01'
    sys.stdout.write(f'[{i+1}/{len(all_files)}] {parcel} / {fname} ({sz}KB)... ')
    sys.stdout.flush()

    # Try up to 2 times for empty responses
    for attempt in range(2):
        proc = subprocess.run(
            ['curl.exe', '-s', '-X', 'POST', url,
             '-H', f'x-ingest-secret: {SECRET}',
             '-F', f'file=@{fpath}',
             '--connect-timeout', '15', '--max-time', '300'],
            capture_output=True, text=True, timeout=310
        )
        if proc.stdout:
            break
        if attempt == 0:
            sys.stdout.write(f'EMPTY(retry)... ')
            sys.stdout.flush()

    if not proc.stdout:
        sys.stdout.write(f'EMPTY (exit {proc.returncode})\n')
        sys.stdout.flush()
        failed += 1
        errors.append((parcel, 'empty response'))
        continue

    try:
        j = json.loads(proc.stdout)
        if j.get('success'):
            yb = j.get('yearBuilt')
            ocr = j.get('usedOcr')
            dbw = j.get('dbWritten')
            if yb: yb_count += 1
            sys.stdout.write(f'OK yb={yb} ocr={ocr} dbw={dbw}\n')
            sys.stdout.flush()
            success += 1
        else:
            sys.stdout.write(f'ERR: {json.dumps(j)[:100]}\n')
            sys.stdout.flush()
            failed += 1
            errors.append((parcel, str(j)[:100]))
    except json.JSONDecodeError:
        sys.stdout.write(f'JSONERR: {proc.stdout[:80]}\n')
        sys.stdout.flush()
        failed += 1
        errors.append((parcel, f'JSONerr: {proc.stdout[:50]}'))

print(f'\nDone: {success} ok, {failed} failed, {yb_count} yearBuilt')
for p, e in errors:
    print(f'  FAIL {p}: {e}')
