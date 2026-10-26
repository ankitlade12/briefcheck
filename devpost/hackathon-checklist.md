# Build With AI: Basics — submission checklist

Checked October 25, 2026. [Official rules](https://learn-ai-basics.devpost.com/rules) govern; [overview](https://learn-ai-basics.devpost.com/) and [required skill pack](https://github.com/challengepost/learn-ai-basics) provide setup guidance.

- Deadline: **October 26, 2026, 4 p.m. America/Chicago**.
- User attested registration, age/residency eligibility and conflict-of-interest compliance; agent cannot independently verify personal facts.
- New work during the submission window; disclose incorporated pre-existing work and respect third-party licenses.
- Required skill pack and `scope.md`, `prd.md`, `spec.md` are present; user delegated hands-on verification to the agent; this adaptation is documented.
- Public GitHub/GitLab/Bitbucket repository, complete run instructions and open-source license: published at https://github.com/ankitlade12/briefcheck.
- Public YouTube/Vimeo working demo, under three minutes: 2:41 narrated working demo recorded and retained locally; GitHub media releases removed at owner’s request; YouTube/Vimeo publication remains required. Use English and permitted assets.
- Provide free judging access through the judging period; text/video must match actual behavior.
- Rubric: design, potential impact, innovation/idea, presentation. Official rules include potential impact; the checked overview omitted it.
- Write submission fields and learning reflections yourself, as the skill pack requires.

Public source upload was performed by the agent. Registration/eligibility are user attestations. Final Devpost submission has not been performed.

## Local submission media

The narrated 2:41 MP4, seven 3:2 screenshots, captions, and subtitle file remain under ignored `artifacts/submission/`. Media must not be uploaded to GitHub without new authorization. The footage shows the running app with a labeled synthetic event and deterministic English analysis; the voiceover is synthetic. Browser assertions, video/audio checks, and screenshot inspection passed.

To reproduce locally, run `node scripts/record-submission.mjs` and `python3 scripts/package-submission.py` with the app running on port 5173. Requires macOS `say` with Samantha, FFmpeg/FFprobe, and Playwright Chromium.
