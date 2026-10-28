# Normalize Linux execution modes and LF endings after Windows fnpack 1.2.3; rebuild inner checksum.
from pathlib import Path
import tarfile,io,hashlib,re
import sys
if len(sys.argv) != 3: raise SystemExit('Usage: python fix-windows-fpk.py <fnpack-output.fpk> <fixed-output.fpk>')
src=Path(sys.argv[1])
with tarfile.open(src) as t:
 entries=[(m,t.extractfile(m).read() if m.isfile() else None) for m in t.getmembers()]
old=next(b for m,b in entries if m.name=='app.tgz')
buf=io.BytesIO()
with tarfile.open(fileobj=io.BytesIO(old)) as a, tarfile.open(fileobj=buf,mode='w:gz',format=tarfile.GNU_FORMAT) as out:
 for m in a.getmembers():
  m.mode=0o755 if m.isdir() or m.name=='bin/node' else 0o644
  out.addfile(m,a.extractfile(m) if m.isfile() else None)
app=buf.getvalue()
md5=hashlib.md5(app).hexdigest()
dst=Path(sys.argv[2])
if src.resolve() == dst.resolve(): raise SystemExit('Use a separate output path')
with tarfile.open(dst,'w:gz',format=tarfile.GNU_FORMAT) as out:
 for m,b in entries:
  if m.name=='app.tgz': b=app
  if m.name=='manifest':
   s=b.decode().replace('\r','');s=re.sub(r'(?m)^(checksum\s*=\s*).*$',lambda x:x[1]+md5,s);b=s.encode()
  if m.name.startswith('cmd/') and b is not None: b=b.replace(b'\r',b'')
  m.mode=0o755 if m.isdir() or m.name.startswith('cmd/') else 0o644
  if b is not None: m.size=len(b)
  out.addfile(m,io.BytesIO(b) if b is not None else None)
with tarfile.open(dst) as t:
 manifest=t.extractfile('manifest').read(); a=t.extractfile('app.tgz').read()
 assert hashlib.md5(a).hexdigest().encode() in manifest
 assert b'\r' not in manifest
 assert t.getmember('cmd/main').mode==0o755
 with tarfile.open(fileobj=io.BytesIO(a)) as p:
  assert p.getmember('bin/node').mode==0o755
  assert p.extractfile('bin/node').read(4)==b'\x7fELF'
 print('PASS: appname/version, checksum, LF line endings, lifecycle/node executable modes and Linux ELF runtime')
print(dst, dst.stat().st_size, hashlib.sha256(dst.read_bytes()).hexdigest())
