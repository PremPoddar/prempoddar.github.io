---
title: Duet, and keeping eight phones on the same beat
description: Six words, no server, and a clock sync borrowed from NTP. How Duet plays one song on up to eight phones at the same moment.
date: 2026-11-03T12:02:00Z
kind: post
tags: [Android, Kotlin, WebRTC, Duet]
related: [duet]
---

[Duet](/apps/duet/) plays the same song on up to eight phones at once. Same sofa or different cities, it's the same moment on every phone.

## What it solves

Listening to something together over a call usually goes like this: someone counts down from three, everyone hits play, and within a minute you're hearing each other's music half a second apart. Screen sharing a music app sounds worse and only works for one listener.

Duet makes the phones agree on the time and keeps them agreeing.

## What it does

- Start a session and you get six words. Read them out, show a QR code or send a link.
- Play a song from your phone, a YouTube video or a whole playlist.
- Anyone can pause, skip, seek, add their own songs or vote the next one up.
- Synced lyrics, a small chat, floating emoji reactions and lock screen controls.
- Leaving? Hand the session to someone else and the music keeps going.
- On the same Wi-Fi, sessions show up by themselves and work with no internet at all.

There's no account, and there's no server of mine anywhere in the path.

## Built with

Kotlin and Jetpack Compose. ExoPlayer plays the music, with a sync loop wrapped around it. WebRTC data channels carry everything between phones. A public MQTT broker over TLS is used only to introduce phones to each other, and NSD finds sessions on the local network. All the logic that matters (session codes, sealing, clock sync, drift control, the protocol) lives in a pure Kotlin `core/` package with its own tests. It runs on Android 10 and up.

## Finding each other without a server

The six words come from the BIP-39 word list, which gives 66 bits. Duet stretches them with PBKDF2 into two things: a topic name and an AES-256 key. Both phones then post their WebRTC offers and answers to that topic on HiveMQ's free public broker, sealed with the key. The broker sees random bytes under a random topic, and once WebRTC connects, the phones talk directly. Music never touches the broker.

On the same Wi-Fi, the host also advertises the session locally. Someone without the words can tap it and ask to join, and if the host approves, the code is sent to them sealed with a one-off X25519 key.

## Staying in sync

The host owns the shared state: the queue, the current song, and where that song is at a given moment on the host's clock. Every guest needs to know the host's clock, so guests ping it the way NTP does. They only trust pings that came back nearly as fast as the fastest one, and they fit a line through a few minutes of them, so a clock that runs a little fast or slow is followed too. Pings that got stuck behind song data are thrown away.

Then, five times a second, each phone asks: where should the song be right now, and where is my player? Small drift is eased out by playing up to 1.5% faster or slower, which you can't hear. Only a large gap that doesn't go away causes a jump, and that jump is aimed ahead by however long jumps have been taking on that phone.

Bluetooth headphones add 150 to 250 ms of delay, so each output has its own small nudge setting.

YouTube was its own problem. Its embedded player reports the current time late, so Duet watches for the exact moment the reported time changes and uses the freshest reading. Drift there is eased with a 5% speed change where YouTube allows it.

## Sending the songs

The host sends each song to every guest before it plays, and sends the next one while the current one is playing. Songs are named by their SHA-256 hash and checked when they arrive, capped at 50 MB, and deleted when the session ends.

## Where it stops

Without a relay server of my own, about one in ten pairs of networks can't connect directly, mostly on strict mobile carriers. Duet says that when it happens and suggests putting one side on Wi-Fi, instead of spinning forever.

The source is [on GitHub](https://github.com/PremPoddar/Duet) under Apache 2.0.
