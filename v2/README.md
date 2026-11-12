# PolyMath v2

The rebuild of PolyMath, living alongside version 1 (the rest of this repository) until it is ready to replace it.

One loop: upload a book, learn it in small pieces, get tested on it, compete with friends on what you learned.

- `src/lib/memory/` : the single memory model. Every mode reports answers through `record` and asks `nextUp` what to do.
- `src/lib/data.ts` : books, profile and leaderboard. Version-1 books come across with `importV1`.
- `src/pages/` : Home, Study, Drill, Compete, You.
- `src/app.css` : design tokens. All colours, radii and type come from here.
- `../supabase/v2_schema.sql` : the v2 tables (already applied; additive, version 1 is untouched).

```
npm install
npm run dev      # local site
npm test         # memory model tests
npm run check    # types
npm run build
```

## Status

Done: project, design tokens, sign-in with existing accounts, the memory model and its tests, the v2 tables, the five-section shell, bringing version-1 books across, live IQ and leaderboard.

Next: process a book once on upload (sections, terms, questions), lessons and Shorts on top of that, Drill, then matches.
