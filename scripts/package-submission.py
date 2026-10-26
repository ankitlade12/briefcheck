"""Package actual browser footage and locally generated synthetic narration."""
import json, subprocess, pathlib, zipfile
root=pathlib.Path('artifacts/submission')
t=json.loads((root/'timeline.json').read_text())
cmd=['ffmpeg','-y','-loglevel','error','-i',t['video']]
for item in t['timeline']:cmd+=['-i',str(root/'audio'/f"{item['index']}.aiff")]
filters=[]
for n,item in enumerate(t['timeline'],1):
 delay=round((item['start']+0.35)*1000)
 filters.append(f'[{n}:a]adelay={delay}:all=1[a{n}]')
filters.append(''.join(f'[a{n}]' for n in range(1,11))+'amix=inputs=10:normalize=0,alimiter=limit=0.95[audio]')
cmd+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[audio]','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(root/'briefcheck-walkthrough.mp4')]
subprocess.run(cmd,check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-show_entries','stream=codec_name,width,height','-of','json',str(root/'briefcheck-walkthrough.mp4')]))
assert 60<float(probe['format']['duration'])<180,probe
(root/'video-verification.json').write_text(json.dumps(probe,indent=2))
def stamp(seconds):
 ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
subs=[]
for item in t['timeline']:
 words=item['narration'].split();chunks=[' '.join(words[i:i+12]) for i in range(0,len(words),12)]
 length=t['durations'][item['index']]-1.2
 for i,chunk in enumerate(chunks):
  start=item['start']+.35+length*i/len(chunks);end=item['start']+.35+length*(i+1)/len(chunks)
  subs.append(f'{len(subs)+1}\n{stamp(start)} --> {stamp(end)}\n{chunk}\n')
(root/'briefcheck-captions.srt').write_text('\n'.join(subs))
(root/'narration.txt').write_text('\n\n'.join(x['narration'] for x in t['timeline']))
captions={
'01-source-workspace':'Bring event instructions into one review workspace. This labeled synthetic example compares an event overview with official rules.',
'02-review-findings':'Catch differences before participants do. BriefCheck surfaces a duration-boundary issue and a missing judging criterion, with source evidence.',
'03-boundary-test':'Test the consequence of a wording difference: exactly 180 seconds meets “at most three minutes” but fails “under three minutes.”',
'04-exact-evidence':'Inspect the original wording. Each finding links to a highlighted passage in the stored source version.',
'05-draft-correction':'Choose the intended boundary and review the original beside a local draft. Suggested edits do not change the published event website.',
'06-verified-resolution':'Rerun to verify the correction. The duration issue resolves while the unrelated judging-criterion omission remains.',
'07-export-record':'Share an inspectable review record with findings, evidence, revisions, and saved scenarios. Full source text is optional.'}
(root/'gallery-captions.txt').write_text('\n\n'.join(f'{k}.png\n{v}' for k,v in captions.items()))
for p in (root/'gallery').glob('*.png'):assert p.stat().st_size<5_000_000
with zipfile.ZipFile(root/'briefcheck-gallery.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((root/'gallery').glob('*.png')):z.write(p,'gallery/'+p.name)
 z.write(root/'gallery-captions.txt','gallery-captions.txt')
print(json.dumps(probe,indent=2))
