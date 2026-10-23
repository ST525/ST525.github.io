# Space Traveller

Portfolio site for Andrew Yen, built with Jekyll and hosted on GitHub Pages.

## Structure

| Path | Purpose |
| --- | --- |
| `_data/` | Navigation, social links, and portfolio content |
| `_includes/` | Shared layout sections and reusable page components |
| `_layouts/` | Site-wide HTML layout |
| `_sass/` | Styles organized into Sass partials |
| `assets/` | Compiled stylesheet, JavaScript modules, images, and video |
| `projects/`, `films/`, `about/` | Published portfolio pages |

The Characters page is currently unpublished; its source, data, and styles
remain in the repository.

Theme tokens for both palettes live in `_sass/base/_variables.scss`.

## Run locally

Prerequisites: Ruby and Bundler (`gem install bundler` if needed).

```sh
bundle config set --local path vendor/bundle
bundle install
bundle exec jekyll serve
```

Open `http://localhost:4000` in a browser.

## Add a project clip

Add the clip and its poster under `assets/video/` and
`assets/video/posters/`. Add an item to the appropriate section's `items:`
list in `_data/projects.yml`:

```yaml
sections:
- id: '01'
  title: Effects Animation
  unit: clips
  items:
  - title: New clip
    meta: Animation · Compositing
    src: /assets/video/new_clip.mp4
    preview: /assets/video/previews/new_clip.mp4
    poster: /assets/video/posters/new_clip.jpg
    type: video
    group: fx
```

The section count is computed from its `items` list, so it updates automatically.

Generate lightweight grid previews and painting thumbnails with:

```sh
ffmpeg -y -i assets/video/new_clip.mp4 -vf "scale=960:-2:flags=lanczos" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -an -movflags +faststart assets/video/previews/new_clip.mp4
convert assets/images/new_paint.jpg -resize '1200x>' -strip -interlace Plane -quality 82 assets/images/thumbs/new_paint.jpg
```

Keep `src` pointed at the original so the lightbox retains full quality. Put
`preview:` after `src:` for videos and `thumb:` after `src:` for paintings.

## Deployment

Merge changes to `main`; GitHub Actions builds and deploys the site.
