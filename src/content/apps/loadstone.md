---
title: Loadstone
platform: [android]
tagline: Find your way back
summary: Save a spot and one arrow walks you back to it, with no maps and no internet.
order: 4
featured: true
icon: /apps/loadstone/icon.png
screenshots: [/apps/loadstone/showcase.jpg]
accent: "#2f8f6b"
links:
  site: https://prempoddar.is-a.dev/Loadstone/
  github: https://github.com/PremPoddar/Loadstone
  store: https://play.google.com/store/apps/details?id=com.prempoddar.loadstone
related: [librechat]
---

## The problem

Where did I park? Which way was the tent? Map apps need signal and show you far more than you need. You want one thing: which way, and how far.

## What I built

Drop a pin and walk back to it later with one arrow and one distance. No map tiles, no signal needed, and the app is under 2 MB. You can add photos and voice notes to a pin, file pins in folders, retrace the path you walked, and share a place as seven silly words that work over any chat app or a phone call. Location is only used while the app is open, and nothing leaves the phone unless you share it. It's on Google Play.

## The hard parts

**Being honest about accuracy.** Every GPS fix comes with an accuracy radius, and that radius matters as much as the point. Loadstone runs fixes through a Kalman filter in a local east/north frame, so each pin is a position and an honest radius. It refuses to claim better than GPS can actually give. When you stand at the spot again later, you can "sharpen" the pin, because a second visit is wrong in a different direction and the two together land closer.

**A steady arrow.** One fixed smoothing strength is either jittery or laggy. The arrow uses a dead band for tiny sensor noise and opens up as you turn, so it's still when you're still and quick when you move. Once you're closer than the uncertainty, it stops pointing and tells you so.

**Places as sentences.** Seven words in a fixed grammar carry 49 bits, enough for about three metres anywhere on Earth, plus a checksum so a misremembered word gets rejected instead of sending you down the wrong street.
