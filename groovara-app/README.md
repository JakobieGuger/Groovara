Groovara

Private Alpha v1

Groovara is a music sharing app built around intentional listening.
Instead of sending someone a playlist they skim once and forget, Groovara lets you curate a listening experience—one song at a time, in order, with context.

This project is currently in private alpha. Core functionality works, but features are still being expanded and refined.

What Groovara Is (Conceptually)

Tracklists are your workspace
You build and edit these freely.

Mixlists are the finished artifact
A snapshot of a tracklist, frozen in time and meant to be shared.

Nothing mutates after sharing
Once a mixlist is created, it never changes—even if the original tracklist does.

Listening is intentional
Optional reveal mode prevents skipping ahead and encourages full attention.

Current Features (Alpha v1)
Authentication

Google OAuth via Supabase

Secure, user-specific data access

Works across devices

Tracklists (Authoring)

Create, edit, and delete tracklists

Add songs via Spotify search

Reorder songs

Edit tracklist title and description

All changes are live-editable until shared

Mixlists (Sharing)

Create a mixlist as a snapshot of a tracklist

Optional message (context for the listener)

Optional finishing note (revealed at the end)

Optional Reveal Mode (songs unlock one at a time)

Mixlists are immutable after creation

Reveal Mode

Songs are hidden until revealed

Encourages sequential, focused listening

Designed for gifting, storytelling, or emotional pacing

Sharing

Shareable link for each mixlist

One-click Copy Link button

Mixlists are readable by authenticated users

My Mixlists Page

View all mixlists you’ve created

See title, description, and creation time

Open or delete past mixlists

UX & Stability

Consistent global navigation

Clear empty states (no tracklists, no songs, etc.)

Inline error handling (no broken-feeling alerts)

Manual song entry is disabled in alpha (dev-only)

What This Alpha Does Not Yet Include

(These are intentional omissions, not bugs.)

YouTube or Apple Music search

Manual song entry for users

Reveal progress persistence after refresh

Public browsing or discovery

Analytics or usage tracking

Monetization

Mobile optimization pass

Onboarding/tutorial flow

Planned Features (Near-Term Roadmap)

These are planned for the next few updates, moving toward Beta.

Search & Platform Expansion

YouTube song search

Apple Music song search

Unified multi-platform search results

Reveal Improvements

Persist reveal progress across refreshes

Better feedback during reveal mode

Optional listener controls (replay, review)

Manual Add (User-Facing)

Re-enabled with:

Platform selector

URL validation

Proper metadata handling

Intended as a fallback, not the primary flow

UX Polish

Clear onboarding explanation for first-time users

Better copy explaining Tracklists vs Mixlists

Minor layout refinements

Mobile usability improvements

Stability & Feedback

Improved logging for edge cases

Better handling of rare network failures

Private user feedback loop during alpha/beta

Technology Stack (for the curious)

Frontend: Next.js (App Router), React, Tailwind CSS

Auth & Database: Supabase

Music Data: Spotify Web API

Hosting: Vercel

Status

Groovara Alpha v1 — Live

This alpha proves the core idea works.
The focus now is expanding platform support, improving the listening experience, and polishing the product into a feature-complete beta.