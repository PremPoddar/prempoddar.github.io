---
title: Eight phones, one song, the same millisecond
description: How Duet finds other phones with six words and no server, estimates another phone's clock the way NTP does, and keeps playback in step by easing speed instead of jumping.
date: 2026-11-03T12:02:00Z
kind: post
tags: [Android, Kotlin, WebRTC, Clock sync, Duet]
related: [duet]
---

[Duet](/apps/duet/) plays the same song on up to eight phones at once. Same sofa or different cities, every phone is at the same moment in the song, and stays there.

## What it solves

Listening to something together over a call usually goes like this: someone counts down from three, everyone presses play, and within a minute you're hearing each other's music half a second apart. Sharing your screen sounds worse and only works one way.

<figure class="shot"><img src="/apps/duet/showcase.jpg" alt="Duet's home screen, joining a session, and the sync settings" loading="lazy" /><figcaption>Home, joining with six words, and the sync settings.</figcaption></figure>

Start a session and Duet gives you six words. Read them out, show a QR code or send a link. Play a song from your phone, a YouTube video or a whole playlist. Anyone can pause, skip, seek, add their own songs or vote the next one up. There are synced lyrics, a small chat, floating emoji, and if the host leaves they can hand the session to someone else. On the same Wi-Fi it works with no internet at all.

## Built with

- **Kotlin and Jetpack Compose**, on Android 10 and up.
- **ExoPlayer** for playback, with a sync loop wrapped around it.
- **WebRTC data channels** for everything between phones, including the songs themselves.
- **A public MQTT broker over TLS**, only for introducing phones to each other.
- **NSD and TCP** for finding sessions on the local network.
- **A pure Kotlin `core/`** with session codes, sealing, clock sync, drift control and the protocol, all tested without a phone.

<figure class="shot"><img src="/figures/duet-modules.jpg" alt="Duet's source packages: core, net, data, play, session and ui" loading="lazy" /><figcaption>How the source is split. Everything that decides timing lives in <code>core/</code>.</figcaption></figure>

## Six words that find and unlock a session

Phones on different networks can't just connect to each other. WebRTC can open a direct link, but first the two sides have to swap a few messages describing how to reach each other, and that exchange needs somewhere to happen. I didn't want to run a server, and I didn't want whoever ran that somewhere to be able to read anything.

The six words solve both. They come from the BIP-39 word list, 2048 words, so six of them carry 66 bits. Duet stretches them with PBKDF2 into 48 bytes and splits the result: the first 16 bytes become a topic name, the other 32 an AES-256 key.

```kotlin title="core/SessionCode.kt"
val keys: SessionKeys by lazy {
    val spec = PBEKeySpec(toString().toCharArray(), "duet-v1".toByteArray(), ROUNDS, 48 * 8)
    val out = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    SessionKeys(
        topic = out.copyOfRange(0, 16).joinToString("") { "%02x".format(it) },
        key = out.copyOfRange(16, 48),
    )
}
```

Both phones post their WebRTC offers and answers to that topic on HiveMQ's free public broker, sealed with the key. The broker sees random bytes under a random topic name, and the topic reveals nothing about the key. Once WebRTC connects, the phones talk directly and the broker is out of the picture. Music never passes through it.

Typing the words is forgiving too. Every BIP-39 word is unique by its first four letters, so `abso` is enough for `absorb`, and case and separators don't matter.

## Whose clock?

Every phone has its own clock, and they disagree, often by seconds. The host owns the shared state: the queue, the current song, and where that song is at a given moment *on the host's clock*. So every guest has to know what time it is on the host.

The classic answer is what NTP does. The guest notes its own time, `t0`, and sends a ping. The host replies with its clock reading. The guest notes when the reply arrives, `t2`. If the trip was symmetric, the host's reading was taken halfway through:

<figure>
<div class="diagram"><svg viewBox="0 0 640 260" role="img" aria-label="A ping from guest to host and back, with the host's reading assumed to be at the midpoint">
<text x="10" y="44" class="bold">Guest</text><text x="10" y="184" class="bold">Host</text>
<line x1="70" y1="40" x2="630" y2="40" class="line"/>
<line x1="70" y1="180" x2="630" y2="180" class="line"/>
<path d="M140 40 L320 180" class="accent-line"/><path d="M320 180 L500 40" class="accent-line"/>
<g class="accent"><circle cx="140" cy="40" r="5"/><circle cx="320" cy="180" r="5"/><circle cx="500" cy="40" r="5"/></g>
<text x="140" y="26" text-anchor="middle" class="mono">t0</text>
<text x="500" y="26" text-anchor="middle" class="mono">t2</text>
<text x="320" y="206" text-anchor="middle" class="mono">hostTime</text>
<line x1="320" y1="40" x2="320" y2="180" class="dash"/>
<text x="320" y="30" text-anchor="middle" class="small mono muted">t0 + rtt/2</text>
<rect x="400" y="200" width="225" height="50" rx="8" class="note"/>
<text x="412" y="221" class="mono small">offset = hostTime</text>
<text x="412" y="239" class="mono small">       − (t0 + rtt / 2)</text>
<text x="20" y="236" class="hand">the error is at most rtt / 2</text>
</svg></div>
<figcaption>One ping gives one estimate of the offset. Its error can't be bigger than half the round trip.</figcaption>
</figure>

That last point is the whole game. A ping that came back in 8 ms is accurate to within 4 ms. A ping that got stuck behind a chunk of song data and came back in 900 ms is nearly useless. So Duet keeps up to ten minutes of pings and only trusts the ones that came back about as fast as the fastest:

```kotlin title="core/Sync.kt"
fun add(t0: Long, hostTime: Long, t2: Long) {
    val rtt = (t2 - t0).coerceAtLeast(0)
    samples.addLast(Sample(t2, rtt, hostTime - (t0 + rtt / 2)))
    while (samples.size > keep || (samples.isNotEmpty() && t2 - samples.first().at > maxAgeMs)) samples.removeFirst()
    // The fastest round trip can only be trusted while it's in the window,
    // so a slower network later is accepted rather than every ping being refused.
    bestRtt = samples.minOf { it.rtt }
    fit()
}

private fun trusted(): List<Sample> {
    val limit = bestRtt + maxOf(4L, bestRtt / 2)
    return samples.filter { it.rtt <= limit }
}
```

## Clocks don't only disagree, they drift

This part is easy to miss. Even once you know the offset, it doesn't stay put. Phone clocks run at slightly different rates, tens of parts per million, which adds up to a hundred milliseconds or more over an hour. An offset measured at the start of an album is wrong by the end of it.

So once there are at least six trusted pings spread over at least a minute, Duet stops treating the offset as a number and fits a straight line through it with least squares. The slope is the difference in clock rates:

```kotlin title="core/Sync.kt"
origin = good.last().at
val xs = good.map { (it.at - origin).toDouble() }
val ys = good.map { it.offset.toDouble() }
val mx = xs.average(); val my = ys.average()
val sxx = xs.sumOf { (it - mx) * (it - mx) }
val raw = if (sxx > 0) xs.indices.sumOf { (xs[it] - mx) * (ys[it] - my) } / sxx else 0.0
// Real clocks differ by well under 200 ppm; a steeper line is noise.
slope = raw.coerceIn(-MAX_SKEW, MAX_SKEW)
base = my - slope * mx
```

The host's time at any moment is then the local time plus `base + slope × elapsed`.

## Correcting without anyone hearing it

Knowing where the song should be is half of it. Getting the player there without an audible jump is the other half. Five times a second, each phone compares where the song should be with where its player is, and decides what to do:

<figure>
<div class="diagram"><svg viewBox="0 0 640 190" role="img" aria-label="Drift zones: under 10 ms do nothing, over 30 ms ease speed by up to 1.5 percent, over 350 ms jump">
<rect x="20" y="50" width="70" height="60" class="soft"/>
<rect x="90" y="50" width="70" height="60" class="note" opacity="0.6"/>
<rect x="160" y="50" width="330" height="60" class="accent-soft"/>
<rect x="490" y="50" width="140" height="60" class="dark"/>
<text x="55" y="85" text-anchor="middle" class="small">in step</text>
<text x="125" y="78" text-anchor="middle" class="small">keep</text><text x="125" y="94" text-anchor="middle" class="small">going</text>
<text x="325" y="78" text-anchor="middle" class="bold">ease speed</text><text x="325" y="96" text-anchor="middle" class="small">play up to 1.5% faster or slower</text>
<text x="560" y="78" text-anchor="middle" class="on-dark bold">jump</text><text x="560" y="96" text-anchor="middle" class="on-dark small">aimed ahead</text>
<g class="mono small"><text x="20" y="130">0</text><text x="90" y="130" text-anchor="middle">10 ms</text><text x="160" y="130" text-anchor="middle">30 ms</text><text x="490" y="130" text-anchor="middle">350 ms</text></g>
<text x="20" y="34" class="small muted">how far this phone is from where the song should be</text>
<text x="160" y="170" class="hand">starts easing past 30, stops once back under 10</text>
</svg></div>
<figcaption>The gap between 10 and 30 ms is hysteresis: without it, a phone sitting near one threshold would keep switching speed on and off.</figcaption>
</figure>

A 1.5% speed change is inaudible for music. It closes a gap of a few tens of milliseconds within seconds, and nobody notices. Only a big gap that doesn't go away causes a jump, and jumps take a few hundred milliseconds before sound comes out, so the controller learns how long they take on this phone and aims ahead by that much:

```kotlin title="core/SyncController.kt"
if (measuringStart) {
    // Whatever is left over right after a start is how far off our start lead was.
    measuringStart = false
    startLeadMs = (startLeadMs + median).coerceIn(0, MAX_LEAD_MS)
}

if (abs(median) > SEEK_OVER_MS) {
    started()
    return Action.Seek(startLeadMs)
}
val size = abs(drift)
// Hysteresis: start easing past 30 ms, stop once within 10 ms.
if (!correcting && size > START_EASING_MS) correcting = true
if (correcting && size < STOP_EASING_MS) correcting = false
val wanted = if (!correcting) 1f
    else 1f + (drift / 4000f).coerceIn(-MAX_ADJUST, MAX_ADJUST).let { (it * 200).toInt() / 200f }
```

Readings of a player's position are noisy, so the decisions use the median of the last seven, which stops one wild reading from triggering a jump. Speed changes happen at most once a second, and the speed is rounded to half a percent so it doesn't wobble.

Bluetooth headphones add another 150 to 250 ms that the phone can't measure, so each output has its own small nudge you can set by ear. YouTube was its own problem: its embedded player reports the current time late, so Duet watches for the moment the reported time changes and trusts only that fresh reading.

## Sending the songs

The host sends each song to every guest over the data channel before it plays, and the next one while the current one is playing. Songs are named by their SHA-256 hash and checked on arrival, so a corrupted transfer is caught before it plays. They're capped at 50 MB and deleted when the session ends.

## Where it stops

Without a relay server of my own, about one in ten pairs of networks can't connect directly, mostly on strict mobile carriers. Duet says that when it happens and suggests putting one side on Wi-Fi, instead of spinning forever. Connecting across networks also needs two real phones to test, which no unit test can stand in for.

The source is [on GitHub](https://github.com/PremPoddar/Duet) under Apache 2.0.
