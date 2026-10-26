# Submission media

This pack contains actual BriefCheck browser captures, not mockups. The labeled synthetic event demonstrates deterministic English analysis; it does not represent a real organizer pilot or a live model call.

- Public source: https://github.com/ankitlade12/briefcheck
- Media is local only under ignored `artifacts/submission/`. GitHub media releases were removed at the owner’s request.
- MP4: 2 minutes 41 seconds, H.264 video + AAC audio, 1440×1080, approximately 5.3 MB; narrated walkthrough of source input, review findings, a 180-second boundary scenario, exact evidence, local correction, rerun, baseline comparison and report download.
- Narration: locally generated synthetic Samantha voice; no music. On-screen chapter captions are part of the video; an SRT transcript is also included.
- Gallery: seven actual 1440×960 PNG screenshots (3:2), each below 5 MB, with captions in the ZIP.

Use the review-findings image as the project thumbnail. The gallery is ordered from inputs through verification and export.

The video is verified through browser assertions against actual exported data, duration/codec checks, audio checks, and visual inspection of representative frames. Upload the MP4 publicly to YouTube or Vimeo and use that link in Devpost's video field. Media must not be uploaded to GitHub without new authorization.

Reproduction: with the app running at http://127.0.0.1:5173, run `node scripts/record-submission.mjs` and `python3 scripts/package-submission.py`. Requires macOS `say` with Samantha, FFmpeg/FFprobe, and Playwright Chromium. Outputs are under ignored `artifacts/submission/`. The script asserts the review results and preserved history before completing.
