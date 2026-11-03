---
title: An arrow that admits when it doesn't know
description: How Loadstone turns noisy GPS into a pin with an honest radius, keeps a compass arrow steady without making it slow, and fits a place on Earth into seven silly words.
date: 2026-11-03T12:04:00Z
kind: post
tags: [Android, Kotlin, Kalman filter, Loadstone]
related: [loadstone]
---

[Loadstone](/apps/loadstone/) answers one question: which way, and how far? You save a spot, like the car on level 3 or the trailhead, and later you open it and follow one arrow back. No map tiles, no signal, and the whole app is under 2 MB.

That sounds like an afternoon's work. Read the GPS, save the coordinates, point at them later. Most of the real work went into one uncomfortable fact: GPS is often wrong in ways that look right, and an arrow that confidently points at the wrong bench is worse than no arrow at all.

## What it solves

Map apps are built for going somewhere new. Getting back to somewhere you've already been is a smaller problem, and a map is too much for it. It needs data you might not have, it shows streets you don't care about, and it still doesn't say "the car is 140 m that way".

<figure class="shot"><img src="/apps/loadstone/showcase.jpg" alt="Loadstone's screens: following a pin, saving one, the radar and appearance settings" loading="lazy" /><figcaption>Finding a pin, saving one, the radar, and appearance settings.</figcaption></figure>

So Loadstone does just that: drop a pin, add a photo or a voice note if you like ("level 3, blue pillar"), and walk back to it later. Around that sit a radar of nearby pins, a trail back along the path you walked, guidance with the screen off, folders, GPX and KML export, and a widget. Location is only used while the app is open, and nothing leaves the phone unless you share a pin.

## Built with

- **Kotlin and Jetpack Compose** with Material 3, in a single activity.
- **MVVM with `StateFlow`**, Hilt for dependency injection.
- **Room** for pins, **DataStore** for settings, the fused location provider for fixes.
- **Plain JVM tests** for everything in `core/`: the filter, the geo maths and the word codec have no Android imports, so they run in milliseconds on any machine.

<figure class="shot"><img src="/figures/loadstone-modules.jpg" alt="Loadstone's source packages and what each one does" loading="lazy" /><figcaption>The source packages. The interesting part lives in <code>core/geo</code>.</figcaption></figure>

## A GPS fix is a point and a promise

Every fix Android hands you comes with an accuracy radius. The obvious approach is to collect fixes for a few seconds and average them. I started there, and it fails in a specific, nasty way.

Fixes aren't independent. If the signal is bouncing off a wall, every fix for the next few minutes is wrong by the same 30 metres, in the same direction. They agree with each other perfectly, so an average of them looks tight. That's how you end up with a pin that says ±2 m and puts you on the wrong side of a car park.

So Loadstone runs fixes through a Kalman filter in a local east/north frame. The state is a position and a variance. Each fix is weighted by its own accuracy, and between fixes the variance grows by however far you could have walked:

```kotlin title="core/geo/PositionEstimator.kt"
private fun predictTo(timeMs: Long, speedMps: Float?) {
    val dt = ((timeMs - lastTimeMs).coerceAtLeast(0L)) / 1000.0
    lastTimeMs = timeMs
    if (dt <= 0.0) return
    val speed = speedMps?.takeIf { it.isFinite() && it >= 0f }?.toDouble() ?: 0.0
    moving = speed > WALKING_MPS
    // Just stopped: everything learnt while walking describes the path, not this spot.
    if (wasMoving && !moving) variance = max(variance, STOP_RESET_M * STOP_RESET_M)
    wasMoving = moving
    val drift = max(STILL_DRIFT_MPS, speed)
    // A steady 1.2 m/s for 5 s really can put you 6 m away, so square the whole displacement.
    variance += (drift * dt) * (drift * dt)
}
```

Then each new fix is checked before it's allowed in. The question is how surprising it is, measured in standard deviations rather than in metres I picked by hand. A multipath spike fails the gate. Three surprises in a row means the model is wrong, not the fixes, so the filter starts again from where the fixes say you are:

```kotlin title="core/geo/PositionEstimator.kt"
val innovation = hypot(zEast - east, zNorth - north)
val s = variance + r
if (accepted > 0 && innovation > GATE_SIGMAS * sqrt(s)) {
    consecutiveRejects++
    if (consecutiveRejects >= REJECTS_BEFORE_RESET) {
        frame = LocalFrame(fix.latitude, fix.longitude)
        initializeFrom(fix)
    }
    return
}

// Standard scalar Kalman update, both axes sharing one gain.
val gain = variance / (variance + r)
east += gain * (zEast - east)
north += gain * (zNorth - north)
variance *= (1 - gain)
```

## Refusing to claim too much

A Kalman filter assumes its measurements are independent, so left alone it grows more and more sure of itself. Feed it a minute of fixes that share the same 30 m error and it will happily report ±1 m.

The fix is one line, and it's the line I care most about in the whole app. The radius Loadstone shows can never be smaller than a floor: 55% of the best fix it has seen, and never under 3 m, because no phone GPS is honestly better than that.

```kotlin title="core/geo/PositionEstimator.kt"
private fun biasFloor(): Double =
    max(ABSOLUTE_FLOOR_M, bestAccuracy.toDouble() * CORRELATED_FRACTION)

private fun sigmaMeters(): Double = maxOf(sqrt(variance), biasFloor(), lagMeters())
```

<figure>
<div class="diagram"><svg viewBox="0 0 640 230" role="img" aria-label="The filter's uncertainty shrinks with each fix but stops at a floor">
<line x1="40" y1="120" x2="610" y2="120" class="dash"/>
<circle cx="80" cy="120" r="70" class="accent-soft" opacity="0.55"/>
<circle cx="200" cy="120" r="48" class="accent-soft" opacity="0.65"/>
<circle cx="300" cy="120" r="34" class="accent-soft" opacity="0.75"/>
<circle cx="390" cy="120" r="26" class="accent-soft" opacity="0.85"/>
<circle cx="470" cy="120" r="22" class="accent-soft"/>
<circle cx="550" cy="120" r="22" class="accent-soft"/>
<circle cx="550" cy="120" r="9" class="dash"/>
<g class="accent"><circle cx="80" cy="120" r="4"/><circle cx="200" cy="120" r="4"/><circle cx="300" cy="120" r="4"/><circle cx="390" cy="120" r="4"/><circle cx="470" cy="120" r="4"/><circle cx="550" cy="120" r="4"/></g>
<text x="80" y="212" text-anchor="middle" class="small">first fix</text>
<text x="300" y="212" text-anchor="middle" class="small">each fix shrinks it</text>
<text x="510" y="212" text-anchor="middle" class="small">stops at the floor</text>
<line x1="470" y1="98" x2="630" y2="98" class="pen-line" stroke-dasharray="3 4"/>
<text x="632" y="80" text-anchor="end" class="hand" style="fill: var(--pen)">the radius it reports</text>
<path d="M560 150 q30 30 60 26" class="line"/>
<text x="632" y="196" text-anchor="end" class="hand">what the maths alone would claim</text>
</svg></div>
<figcaption>The variance falls with every fix, but the radius Loadstone shows stops at the floor. The small dashed circle is the confident answer it refuses to give.</figcaption>
</figure>

## Coming back is the only real fix

If waiting longer can't remove the shared error, what can? Time. Hours or days later the satellites are somewhere else and the atmosphere has changed, so a new reading is wrong in a different direction. Two readings with independent errors, each weighted by how good it is, land closer than either one.

That's what **Sharpen this pin** does when you're standing on the spot again. It's plain inverse-variance weighting, done in a local frame so a degree of longitude isn't mistaken for a degree of latitude:

```kotlin title="core/geo/PinRefinement.kt"
fun merge(stored: Observation, observed: Observation): Observation {
    val sa = max(stored.sigmaMeters, PositionEstimator.ABSOLUTE_FLOOR_M)
    val sb = max(observed.sigmaMeters, PositionEstimator.ABSOLUTE_FLOOR_M)
    val wa = 1.0 / (sa * sa)
    val wb = 1.0 / (sb * sb)
    val total = wa + wb

    val frame = LocalFrame(stored.latitude, stored.longitude)
    val east = (wa * frame.east(stored.longitude) + wb * frame.east(observed.longitude)) / total
    val north = (wa * frame.north(stored.latitude) + wb * frame.north(observed.latitude)) / total

    return Observation(
        latitude = frame.latitudeOf(north),
        longitude = frame.longitudeOf(east),
        sigmaMeters = max(sqrt(1.0 / total), PositionEstimator.ABSOLUTE_FLOOR_M),
    )
}
```

It also refuses to merge a second visit that's much worse than the pin, or one that disagrees by more than three combined standard deviations. In that case you're probably standing somewhere else.

## A steady arrow

The compass has the opposite problem. Raw headings shiver by a degree or two even when the phone is perfectly still. A strong low-pass filter hides the shiver but makes the arrow lag behind you when you turn, which feels like the app is slow.

The answer was to stop using one smoothing strength. Small changes are almost always noise, so they get a tiny gain. Big changes are almost always you turning, so they get a big one. In between, it blends so there's no visible gear change:

```kotlin title="core/geo/HeadingFilter.kt"
private fun alphaFor(delta: Double): Double = when {
    delta <= NOISE_BAND_DEG -> DEAD_BAND_ALPHA
    delta <= DRIFT_BAND_DEG -> lerp(DEAD_BAND_ALPHA, restAlpha, delta, NOISE_BAND_DEG, DRIFT_BAND_DEG)
    delta <= TURN_BAND_DEG -> lerp(restAlpha, turnAlpha, delta, DRIFT_BAND_DEG, TURN_BAND_DEG)
    else -> turnAlpha
}
```

<figure>
<div class="diagram"><svg viewBox="0 0 640 250" role="img" aria-label="Smoothing gain against heading change: 0.03 below 1.2 degrees, rising to 0.10 at 5 degrees and 0.55 at 18 degrees">
<line x1="60" y1="200" x2="610" y2="200" class="line"/>
<line x1="60" y1="200" x2="60" y2="30" class="line"/>
<rect x="60" y="30" width="27" height="170" class="note" opacity="0.6"/>
<polyline points="60,191 87,191 172,172 465,44 610,44" class="accent-line"/>
<g class="accent"><circle cx="87" cy="191" r="4"/><circle cx="172" cy="172" r="4"/><circle cx="465" cy="44" r="4"/></g>
<text x="87" y="220" text-anchor="middle" class="small mono">1.2°</text>
<text x="172" y="220" text-anchor="middle" class="small mono">5°</text>
<text x="465" y="220" text-anchor="middle" class="small mono">18°</text>
<text x="335" y="244" text-anchor="middle" class="small muted">change since the last reading</text>
<text x="52" y="194" text-anchor="end" class="small mono">0.03</text>
<text x="52" y="48" text-anchor="end" class="small mono">0.55</text>
<text x="100" y="80" class="hand">dead band: noise</text>
<text x="96" y="166" class="hand">drifting</text>
<text x="490" y="80" class="hand">you're turning</text>
</svg></div>
<figcaption>How much of each new reading the arrow takes in. Under 1.2° it barely moves. Past 18° it follows you almost at once.</figcaption>
</figure>

The smoothing runs on the heading's sine and cosine rather than on degrees, so going from 359° to 0° isn't a jump of 359°.

One more rule: once you're closer to the pin than the combined uncertainty, the arrow stops pointing. With a 5 m error seen from 4 m away, the true direction could be almost anywhere, so it says you're there instead of guessing.

## A place in seven words

A shared link only works if the other phone has something to open it. A sentence works anywhere, including read out over a phone call:

> Grumpy walruses quietly juggle soggy waffles backwards.

That's a position, anywhere on Earth, to within about three metres. Seven words come from four fixed lists of 128, always in the same grammar. Seven bits per word gives 49 bits: 23 for latitude, 23 for longitude and 3 for a checksum.

<figure>
<div class="diagram"><svg viewBox="0 0 640 190" role="img" aria-label="Seven words, each seven bits, carrying 23 bits of latitude, 23 of longitude and a 3 bit checksum">
<g>
<rect x="10" y="20" width="84" height="56" rx="8" class="box"/><text x="52" y="44" text-anchor="middle" class="bold">grumpy</text><text x="52" y="64" text-anchor="middle" class="small muted">adjective</text>
<rect x="100" y="20" width="84" height="56" rx="8" class="box"/><text x="142" y="44" text-anchor="middle" class="bold">walruses</text><text x="142" y="64" text-anchor="middle" class="small muted">noun</text>
<rect x="190" y="20" width="84" height="56" rx="8" class="box"/><text x="232" y="44" text-anchor="middle" class="bold">quietly</text><text x="232" y="64" text-anchor="middle" class="small muted">adverb</text>
<rect x="280" y="20" width="84" height="56" rx="8" class="box"/><text x="322" y="44" text-anchor="middle" class="bold">juggle</text><text x="322" y="64" text-anchor="middle" class="small muted">verb</text>
<rect x="370" y="20" width="84" height="56" rx="8" class="box"/><text x="412" y="44" text-anchor="middle" class="bold">soggy</text><text x="412" y="64" text-anchor="middle" class="small muted">adjective</text>
<rect x="460" y="20" width="84" height="56" rx="8" class="box"/><text x="502" y="44" text-anchor="middle" class="bold">waffles</text><text x="502" y="64" text-anchor="middle" class="small muted">noun</text>
<rect x="550" y="20" width="84" height="56" rx="8" class="box"/><text x="592" y="44" text-anchor="middle" class="bold">backwards</text><text x="592" y="64" text-anchor="middle" class="small muted">adverb</text>
</g>
<text x="322" y="100" text-anchor="middle" class="small mono muted">7 words × 7 bits = 49 bits</text>
<rect x="10" y="114" width="285" height="34" rx="6" class="accent-soft"/><text x="152" y="136" text-anchor="middle" class="mono">latitude, 23 bits</text>
<rect x="299" y="114" width="285" height="34" rx="6" class="accent-soft"/><text x="441" y="136" text-anchor="middle" class="mono">longitude, 23 bits</text>
<rect x="588" y="114" width="46" height="34" rx="6" class="dark"/><text x="611" y="136" text-anchor="middle" class="mono on-dark">3</text>
<text x="634" y="176" text-anchor="end" class="hand">checksum: one wrong word gets refused</text>
</svg></div>
<figcaption>The grammar is fixed, so a word in the wrong slot is wrong before any arithmetic runs. Any adjective in the list fits any noun, which is why every sentence comes out a bit ridiculous.</figcaption>
</figure>

Encoding is a few lines of bit packing:

```kotlin title="share/WordCode.kt"
fun encode(latitude: Double, longitude: Double): List<String> {
    val lat = ((latitude.coerceIn(-90.0, 90.0) + 90.0) / 180.0 * LAT_STEPS)
        .roundToLong().coerceIn(0, LAT_STEPS)
    val lon = ((longitude.coerceIn(-180.0, 180.0) + 180.0) / 360.0 * LON_STEPS)
        .roundToLong().coerceIn(0, LON_STEPS)

    var payload = (lat shl LON_BITS) or lon
    payload = (payload shl CHECK_BITS) or checksum(lat, lon)

    return (WORD_COUNT - 1 downTo 0).map { position ->
        val index = ((payload ushr (position * BITS_PER_WORD)) and WORD_MASK).toInt()
        slots[WORD_COUNT - 1 - position][index]
    }
}
```

The checksum folds the whole position down three bits at a time, so every bit of the position affects it. The usual mistake, one word remembered wrong, almost always produces a sentence the decoder rejects instead of a different real place. The decoder also searches the whole pasted message for seven words in a row, because people forward the entire text, not just the code.

## Where it stops

GPS under a concrete roof is still bad, and the floor can only stop Loadstone from pretending otherwise. It can't make the fix better. The word code is never tighter than about 2.7 m, which is fine for finding a car and not fine for finding a dropped key.

The source is [on GitHub](https://github.com/PremPoddar/Loadstone) under Apache 2.0, and the app is on [Google Play](https://play.google.com/store/apps/details?id=com.prempoddar.loadstone).
