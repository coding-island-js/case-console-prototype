# Case Console — product exercise

A diagnosis and redesign of a complaint-case detail view, plus supporting write-ups,
built as a clickable prototype for a product exercise.

- `index.html` — hub page (start here)
- `task1.html` — diagnosis of the current screen and the design reasoning
- `prototype.html` + `proto.css` + `proto.js` + `case-data.js` — the redesigned case
  view. Plain HTML/CSS/JS, no frameworks, no build step: `case-data.js` plays the
  backend, `proto.js` renders one region per function from a single state object.
- `styles.css` — shared styles for the document pages

Run locally with any static server, e.g. `python -m http.server`, or just open
`index.html` in a browser.

Sample case content is invented. Deployed automatically to Netlify on push (see
`.github/workflows/deploy.yml`).
