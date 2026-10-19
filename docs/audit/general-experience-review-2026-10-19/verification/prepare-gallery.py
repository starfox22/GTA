from pathlib import Path
import json,hashlib,shutil
root=Path('/workspace/GTA');work=root/'work/general-review';audit=root/'docs/audit/general-experience-review-2026-10-19'
native=work/'native-graphics-final';smoke=work/'package-smoke';retry=work/'checkpoint-retry';m1=work/'native-integrated'
load=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
n=load(native/'graphics-review.json');s=load(smoke/'smoke.json');r=load(retry/'checkpoint.json');win=load(m1/'summary.json')
assert n['pass'] and len(n['captures'])==11 and len(n['renderChecks'])==10 and not n['errors']
assert len(s['captures'])==8 and len(s['errors'])==1 and s['errors'][0].startswith('[smoke] page.screenshot: Timeout 180000ms exceeded.')
assert r['pass'] and not r['errors'] and len(r['captures'])==1 and r['htmlSha256']==s['htmlSha256']
assert s['checks']['walk']['distance']>=16 and s['checks']['drive']['distance']>=24 and s['checks']['returnedToStreet']
assert all(x['readable']for x in s['checks']['credits']['monarch'])
images=audit/'images';images.mkdir(exist_ok=True)
rows=[];manifest=[]
def add(folder,receipt,filename,title,description,category,html_hash,recorder_hash):
 p=folder/filename
 dest='images/general-'+filename
 shutil.copyfile(p,audit/dest)
 rows.append({'file':dest,'title':title,'description':description})
 manifest.append({'file':dest,'sha256':sha(p),'captureReceipt':receipt,'originalFile':filename,'category':category,'htmlSha256':html_hash,'recorderSha256':recorder_hash,'viewport':[1000,700]})
captions=[
('01-opening-subtitle-high.png','Opening call and readable dialogue','Fresh public opening: the phone call is accepted with E and Enter. High graphics; the subtitle clears the mission card and minimap.'),
('02-summit-dig-high.png','High Ground: digging at the summit','A staged summit inspection followed by the normal held-E action. The digging prompt stays clear of terrain status and dialogue. High graphics.'),
('04-rear-cargo-retrieval-high.png','Recover the package from a stranded vehicle','The rear retrieval prompt appears after normal digging and loading in a staged vehicle fixture. The package can return to the player’s backpack. High graphics.'),
('07-records-rain-night-high.png','Fort Sentinel records office in rain','A staged view after the full ID inspection, with the normal records-entry prompt. High graphics at night in rain; the objective banner is the game’s normal briefing.'),
('10-blue-hour-terrace-high.png','A Seat at the Table: Blue Hour at dusk','Staged inspection of the second mission’s terrace, guests and city environment. High graphics. This image is separate from the recorded ordinary mission win.'),
('11-varga-meeting-high.png','Borrowed Stripes: the CIRRUS meeting','Staged inspection of the fourth mission’s seated meeting with Anton Varga. High graphics. The ordinary objective-to-completion run is retained separately in the audit.'),
]
for filename,title,description in captions:
 c=next(c for c in n['captures']if c['file']==filename)
 assert c['sha256']==sha(native/filename)
 add(native,'verification/native-graphics-final/graphics-review.json',filename,title,description,c['fixture'],n['htmlSha256'],n['recorderSha256'])
for filename,title,description,category in [
('08-backpack-clean-high.png','The recovered package stays with you','Final packaged build, High graphics: the fitted backpack remains visible on foot. Staged inspection camera after normal held-E digging, with the dialogue allowed to expire.','staged package inspection; not a mission win'),
('09-checkpoint-chase-high.png','Chase dialogue and checkpoint labels','Final packaged build, High graphics: chase dialogue clears the lower HUD and the full Fort Sentinel name stays clear of navigation. Staged uniform/checkpoint inspection.','staged checkpoint inspection; not a mission win')]:
 source,receipt,record=(retry,'verification/checkpoint-retry/checkpoint.json',r)if filename.startswith('09-')else(smoke,'verification/package-smoke/smoke.json',s)
 c=next(c for c in record['captures']if c['file']==filename);assert c['sha256']==sha(source/filename)
 add(source,receipt,filename,title,description,category,record['htmlSha256'],record['recorderSha256'])
add(m1,'verification/native-integrated/summary.json','03-integrated-mission1-complete.png','Dockside Favor completed with ordinary controls','Raw gameplay evidence from the successful first-mission run: pursued cargo delivery, sealed warehouse and back-door exit. Low graphics; 100 HP and wanted level zero. Failed attempts are retained separately.','ordinary mission win on source605b175e','c8565c1e0f4ed7dbf5a49ff14082e03e8c50c95426d1bce13bd96df5ce1fbfd9',sha(m1/'driver.mjs'))
data=load(audit/'gallery.json');data['screenshots']=rows;(audit/'gallery.json').write_text(json.dumps(data,indent=2)+'\n')
(audit/'verification/gallery-image-manifest.json').write_text(json.dumps({'kind':'Native unedited game captures; source versions and staged scenes are explicit','files':manifest},indent=2)+'\n')
print('Prepared',len(rows),'native gallery screenshots')
