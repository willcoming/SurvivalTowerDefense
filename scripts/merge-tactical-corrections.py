"""Merge bounded reruns from this development iteration, checking coverage before replacing rows."""
import json,glob,hashlib
from pathlib import Path
root=Path('artifacts/validation/tactical-rework')
def rows(folder,prefix='matrix'):
 return [r for file in sorted(folder.glob(prefix+'-*.json')) for r in json.load(open(file))]
def key(r): return (r['stage'],r['mode'],r['team'],r['policy'],r['cell'],r['seed'])
def probe_key(r): return (r['owner'],r['form'],r['budget'],r['scenario'],tuple(r['plan']))
assert len(rows(root))==48240
assert len(rows(root/'rescue'))==4020
counts={}
def merge(folder,patch_name,expected,prefix='matrix',id_fn=key):
 patch=rows(root/patch_name,prefix);assert len(patch)==expected,(patch_name,len(patch),expected)
 index={id_fn(r):r for r in patch};assert len(index)==expected
 replaced=0
 for file in sorted(folder.glob(prefix+'-*.json')):
  original=json.load(open(file));out=[]
  for r in original:
   identity=id_fn(r)
   if identity in index: out.append(index.pop(identity));replaced+=1
   else: out.append(r)
  file.write_text(json.dumps(out,separators=(',',':')))
 assert not index,patch_name
 counts[patch_name]=replaced
merge(root,'hundred-correction',360)
merge(root/'rescue','hundred-rescue-correction',60)
merge(root,'c08-correction',12060)
merge(root/'rescue','c08-rescue-correction',1650)
expected=sum(r['owner']=='C08' for r in rows(root,'probes'))
merge(root,'c08-probes-correction',expected,'probes',probe_key)
(root/'correction-receipt.json').write_text(json.dumps({'scopes':counts,'order':'hundred first, C08 second (includes latest hundred rules)','reason':'Cross-decade recovery windows; C08 cooling branch conditional effects','finalShardSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*root.glob('matrix-*.json'),*root.glob('probes-*.json'),*(root/'rescue').glob('matrix-*.json')]}},indent=2))
print(counts)
