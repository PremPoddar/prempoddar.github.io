---
title: LibreChat, encrypted messages with no internet
description: Phones carrying messages for each other over Bluetooth, and doing Signal-style encryption when there's no server to hand out keys.
date: 2026-11-03T12:01:00Z
kind: post
tags: [Android, Kotlin, Bluetooth, Cryptography, LibreChat]
related: [librechat]
---

[LibreChat](/apps/librechat/) is a messenger that works with no internet, no mobile signal and no server. The phones around you become the network.

## What it solves

At a festival, on a trek, in a building with no signal or during a power cut, the network goes first. Everyone still has a phone, and those phones can reach each other over Bluetooth. They just have nothing to send through.

LibreChat gives them that. Everyone nearby who has it open forms a mesh. A message for someone out of range gets carried by the phones in between.

## What it does

- A public chat for everyone in range, signed so nobody can post as you.
- Direct messages and groups, end to end encrypted.
- Photos and voice notes, compressed for the mesh.
- Sent, delivered and read receipts, replies, reactions and delete for everyone.
- Disappearing messages after an hour, a day or a week.
- Verification by scanning each other's QR code or comparing a 60-digit safety number.
- A nearby radar showing who's in range, who's reachable through others, and how strong the link is.

## Built with

Kotlin and Jetpack Compose with Material 3, on Android 10 and up. Bluetooth Low Energy GATT for the mesh, and Wi-Fi Aware for fast links when it's available. BouncyCastle provides the primitives: X25519, Ed25519, ChaCha20-Poly1305 and HKDF-SHA256. On the phone, messages sit in a SQLCipher database, media is encrypted, and keys are guarded by the Android Keystore.

## How the mesh works

Every phone is a Bluetooth server and a client at the same time. It advertises the LibreChat service and scans for it. Every 15 seconds it announces itself with its name and public keys, signed.

Messages are flooded with duplicate suppression and a hop limit of 7. Direct messages to a phone that's already a neighbour go straight to it. If there's no path yet, each phone keeps a copy of what it relays for 24 hours and hands it to every new neighbour once. When the message arrives, the recipient sends back a signed acknowledgement, which is what turns the second tick on and also tells relays they can drop their copies.

When two phones that both support Wi-Fi Aware are close, they open a Wi-Fi data path and the router prefers it, so a photo moves in seconds instead of minutes.

## The hard part: encryption with nobody in the middle

Signal-style encryption normally leans on a server. You fetch someone's prekeys from it before sending your first message. With no server, there's nowhere to fetch from.

So each phone puts its signed prekey in the announcement it already broadcasts. Starting a chat runs X3DH with that prekey, and every message after that uses the Double Ratchet, including messages that arrive out of order and both sides starting at the same time. Groups use Sender Keys, shared over the one-to-one sessions and replaced whenever someone leaves. I implemented these from Signal's published specifications on top of BouncyCastle.

Relays can see the sender and recipient ids, sizes and timing. They can't see contents.

## Testing it

This is where most of the time went. Every primitive is checked against its RFC test vectors (7748, 8032, 5869, 4231 and 8439). The ratchet is tested for out of order delivery, skipped messages, replays, tampering and serialisation. Whole flows run over an in-memory mesh of three phones where A can only reach C through B: delivery ticks, store and forward, lost acknowledgements, groups, photos, disappearing messages, blocking and forged announcements.

Bluetooth itself still needs real hardware, so the last test is always the same. Install it on three phones and walk apart.

## Being clear about what it is

LibreChat is open source and has had outside contributors. It hasn't had an independent security audit, and the README says so in the encryption section. If you need audited encryption, use something that's been audited.

The source is [on GitHub](https://github.com/PremPoddar/LibreChat) under Apache 2.0.
