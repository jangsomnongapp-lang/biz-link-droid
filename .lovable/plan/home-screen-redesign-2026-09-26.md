# Home screen redesign

## What will change

- Rebuild the Home screen to closely match the supplied mobile reference.
- Add a navy brand header with the BuildHub mark, name, short tagline, search, and alerts.
- Place a prominent search field below the header.
- Add five equal shortcut tiles: Find work, Post a job, Materials, Machinery & Tools, and Workers.
- Change stories into compact image cards with labels, including Create story first.
- Restyle existing posts and rentals into clean Facebook-style feed cards while preserving likes, comments, sharing, media viewers, supplier contact, reporting, editing, and deletion.
- Change the navigation to the reference structure: Home, Projects/Groups, central Post action, Chat, and Menu. Keep unread badges and refresh-on-tab-tap behavior.

## Visual direction

- **Layout:** Closely follow the supplied screenshot’s order, proportions, density, and mobile-first composition.
- **Colors:** Navy `#123F70`, gold `#FFD21A`, white, and cool gray `#EEF3F8`, translated into semantic theme tokens.
- **Typography:** Outfit headings and Figtree body text, with Noto Sans Khmer retained for Khmer readability.
- **Motion:** Subtle native-feeling press, feed entrance, and story-scroll behavior; reduced-motion preferences remain respected.

## Technical details

- Keep all current data loading, realtime updates, cache behavior, deep links, and bilingual content intact.
- Reuse existing routes for every shortcut and navigation destination.
- Update the shared Home shell and Home presentation only; no backend or business-rule changes.
- Verify the result at mobile and wider preview sizes, including loading, empty, focused-post, and populated-feed states.
