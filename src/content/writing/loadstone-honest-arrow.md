---
title: Loadstone, and why a pin needs an honest radius
description: An Android app that walks you back to a saved spot with one arrow, and the Kalman filter that stops it from overstating how sure it is.
date: 2026-11-03T12:04:00Z
kind: post
tags: [Android, Kotlin, Loadstone]
related: [loadstone]
---

[Loadstone](/apps/loadstone/) answers one question: which way, and how far? You save a spot, like the car on level 3 or the trailhead, and later you open it and follow an arrow back. No map tiles, no signal, and the whole app is under 2 MB.

## What it solves

Map apps are built for getting somewhere new. Getting back to a place you've already been is a smaller problem, and a map is too much for it. It needs data you might not have, it shows you streets you don't care about, and it still doesn't say "the car is 140 m that way".

A parking garage, a campsite after dark, a beach with no landmarks. In all of those you want an arrow and a number. That's the app.

## What it does

- Drop a pin with one tap, then add photos ("level 3, blue pillar") or a voice note.
- Walk back with one arrow pointing at true north, corrected for magnetic declination.
- See every pin around you on a radar, at its real direction and scaled distance.
- Retrace the path you walked, step by step.
- Keep guiding with the screen off. A notification shows the distance and the phone buzzes as you get close.
- Share a place as seven silly words.
- File pins in folders, back them up to one file, or export GPX and KML for map apps.

Location is only used while the app is open, and nothing leaves the phone unless you share a pin.

## Built with

Kotlin and Jetpack Compose with Material 3, in a single activity. MVVM with `StateFlow`, Hilt for dependency injection, Room for pins and DataStore for settings. Location comes from the fused location provider, and the compass is corrected to true north. Everything in `core/`, which is the filter, the geo maths and the word codec, has no Android dependencies, so it's covered by plain JVM tests. It runs on Android 8.0 and up and is on [Google Play](https://play.google.com/store/apps/details?id=com.prempoddar.loadstone).

## The hard part: being honest about accuracy

A GPS fix is a point plus an accuracy radius, and the radius matters as much as the point. The easy thing is to average a few fixes and show the result. The trouble is that fixes can all be wrong by the same 30 metres (a signal bouncing off a wall, bad satellite geometry) and still agree with each other perfectly. Average those and you get a pin that claims ±2 m and puts you on the wrong side of the car park.

So Loadstone runs fixes through a Kalman filter in a local east/north frame. The position is a mean and a variance. Each fix is weighted by its own accuracy, and the gap between fixes widens the variance by how far you could have walked in that time. Outliers fail a gate measured in standard deviations, not in hand-tuned metres. Then the filter refuses to claim better than the part of GPS error that repeated readings can't remove.

There's one thing that does remove it: coming back. Hours or days later the satellites have moved, so a new reading is wrong in a different direction. Stand on the spot again and tap **sharpen this pin**, and the two visits together land closer than either one.

## A steady arrow

A compass arrow with fixed smoothing is either jittery when you stand still or slow when you turn. Loadstone uses a dead band to ignore tiny sensor noise and opens up the smoothing as you turn, so it's still when you're still and quick when you move.

Close to the pin, the arrow stops pointing. If the pin is 4 m away and the uncertainty is 5 m, the direction can swing by tens of degrees, so pointing anyway would just be a confident guess. It tells you you're there instead.

## Places as sentences

A shared link only works if the other phone has the right app to open it. A sentence works anywhere, including read out over a phone call:

```
Grumpy walruses quietly juggle soggy waffles backwards.
```

That's a position to within about three metres, anywhere on Earth. Seven words from four fixed 128-word lists, always in the same grammar (adjective, noun, adverb, verb, adjective, noun, adverb), carry 49 bits: 23 for latitude, 23 for longitude and a 3-bit checksum. If someone gets one word wrong, the checksum rejects it instead of sending you to a different street. And because every adjective in the list fits every noun, the result is always a little ridiculous, which makes it easy to remember.

The source is [on GitHub](https://github.com/PremPoddar/Loadstone) under Apache 2.0.
