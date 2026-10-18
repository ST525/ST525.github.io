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
| `projects/`, `characters/`, `films/`, `about/` | Portfolio pages |

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
    poster: /assets/video/posters/new_clip.jpg
    type: video
    group: fx
```

The section count is computed from its `items` list, so it updates automatically.

## Deployment

Merge changes to `main`; GitHub Actions builds and deploys the site.
