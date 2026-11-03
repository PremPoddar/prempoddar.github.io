---
title: Duet
platform: [android]
tagline: Listen to music together, in sync
summary: The same song plays on up to eight phones at the same moment, on one sofa or in different cities.
order: 2
featured: true
icon: /apps/duet/icon.svg
screenshots: [/apps/duet/showcase.jpg]
accent: "#c8553d"
links:
  site: https://prempoddar.github.io/Duet/
  github: https://github.com/PremPoddar/Duet
related: [librechat]
---

## The problem

Listening to music "together" over a call usually means someone counts down from three and everyone presses play. It drifts within a minute.

## What I built

Start a session and Duet gives you six words. Read them out, let someone scan a code or send a link, and up to seven other people join. Pick a song from your phone, a YouTube video or a whole playlist, and it plays on every phone at the same moment. Anyone can pause, skip, seek, add songs or vote the next one up. There's no account and no server of mine in the middle.

## The hard parts

**Finding each other without a server.** The six words come from the BIP-39 list. Stretched with PBKDF2 they become a topic name and an AES-256 key. Phones swap WebRTC offers through a free public MQTT broker, sealed with that key, so the broker only ever sees noise. After that, music goes phone to phone. On the same Wi-Fi it works with no internet at all.

**Staying in sync.** Guests estimate the host's clock the way NTP does, trusting only the fastest pings and fitting a line over a few minutes so slow or fast clocks are followed too. Five times a second each phone checks where the song should be. Small drift gets eased out by playing up to 1.5% faster or slower, so you never hear a jump. Bluetooth headphones add 150 to 250 ms, so there's a per-output nudge for that.

**Being honest about limits.** Without a relay server, about one in ten network pairs (mostly strict mobile carriers) can't connect directly. Duet tells you that and suggests Wi-Fi on one side instead of failing quietly.
