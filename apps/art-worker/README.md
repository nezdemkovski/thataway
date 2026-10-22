# Art worker

Draws the places' illustrations on a Mac and hands them to the API. It needs no access to the
database or the bucket: it asks the API for the next place (`POST /art/jobs/claim`, bearer
token), draws it with [mflux](https://github.com/filipstrand/mflux) (Qwen Image 2.1 Turbo,
8-bit, from the place's Commons photo and the API's prompt), cuts the background away with
[rembg](https://github.com/danielgatis/rembg) (BiRefNet), crops to the landmark, measures
where its tallest point stands, and uploads the PNG (`POST /art/jobs/:id/complete`). The API
puts it in the bucket and points `place.art_url` at it. About a minute per picture on an
M-series Mac with 36 GB.

## Setup (once, on the Mac)

```bash
uv tool install --python 3.12 mflux --with hf_transfer --with "pillow<13"
uv tool install --python 3.12 "rembg[cli,cpu]" --with "pillow<13"
cp apps/art-worker/.env.example apps/art-worker/.env   # token from the thataway item in 1Password
```

The first run downloads the model weights (about 32 GB into `~/.cache/huggingface`).

## Run

```bash
bun run --cwd apps/art-worker once    # draw one place and exit
bun run --cwd apps/art-worker start   # keep drawing; sleeps IDLE_SECONDS when the queue is empty
```

To keep it running, `launchd/install.sh` installs a user agent that starts it at login and
restarts it if it stops; logs go to `~/Library/Logs/thataway-art-worker.log`.

## Queue

`GET /places` queues the most notable places of every answer that have no picture yet;
`bun run art:sweep -- --limit 200` queues the best places without one across the whole
database; `bun run art -- --place Q… --queue` redraws one. A job failed three times stays
failed until it is queued again by hand.
