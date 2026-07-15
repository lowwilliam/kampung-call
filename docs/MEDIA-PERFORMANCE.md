# Media performance audit

Audit date: 2026-07-14

## Result

The runtime MP3 payload was reduced from 6,046,129 bytes (5.77 MiB) to
3,127,984 bytes (2.98 MiB), a saving of 2,918,145 bytes (48.3%). Filenames,
channel layouts, and intended durations are preserved, so no application-code
change is required.

| File | Previous | Current | Encoding |
| --- | ---: | ---: | --- |
| `island-signal.mp3` | 5,131,747 B | 2,566,312 B | 128 kbps stereo |
| `neighbourhood-ambience.mp3` | 481,581 B | 321,068 B | 128 kbps stereo |
| `van-engine.mp3` | 289,197 B | 168,716 B | 112 kbps stereo |
| `shift-complete.mp3` | 73,197 B | 36,620 B | 96 kbps stereo |
| `repair-success.mp3` | 34,029 B | 17,036 B | 96 kbps stereo |
| `diagnostic-scan.mp3` | 20,781 B | 10,412 B | 96 kbps stereo |
| `footstep.mp3` | 15,597 B | 7,820 B | 96 kbps stereo |

The outputs were produced deterministically with the installed FFmpeg build,
using `libmp3lame`, constant bitrates, and stripped input metadata. Each output
was then fully decoded with `ffmpeg -v error -i FILE -f null -` to catch corrupt
or truncated media.

## Loading audit

The HTML currently references 51 GLBs totalling 10,957,580 bytes (10.45 MiB).
All are requested by `loadAssets()` as soon as the script runs, including eight
`archive*` fallback models that do not appear to be needed for the initial
view. The largest referenced GLB is `hero-neighbourhood.glb` at 1,735,328 bytes,
so no individual geometry asset is currently an urgent compression target.

Audio creation is correctly deferred until the player presses Begin, but all
seven audio elements use `preload="auto"` at that point. The compressed audio
therefore directly reduces the first-play transfer without changing behavior.

The next high-value runtime change is staged GLB loading: load the player,
vehicle, active call district, and visible hero assets first; defer archive and
off-route models until idle time or until their district is approached. That
requires application loading-state work and was intentionally not mixed into
this media-only pass.

## Reproduction

Use the following bitrate policy when regenerating the audio:

- music and environmental ambience: 128 kbps;
- continuous vehicle loop: 112 kbps;
- short interaction effects: 96 kbps.

For each file, run this shape of command, replacing `BITRATE` and writing to a
temporary directory before replacing the original:

```sh
ffmpeg -hide_banner -loglevel error -y -i INPUT.mp3 \
  -map_metadata -1 -codec:a libmp3lame -b:a BITRATE OUTPUT.mp3
```

`npm run test:performance` inventories all referenced runtime media and enforces
the aggregate and single-asset budgets.
