# Project architecture decisions

- Keep the authenticated experience in one shared mobile-first AppShell with a fixed five-item bottom navigation, because every main workflow should feel like one native app.
- Use the shared AvatarCropper for shop logos before upload or registration, rendered in a body portal so navigation cannot cover its controls.