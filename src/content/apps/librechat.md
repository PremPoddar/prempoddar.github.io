---
title: LibreChat
platform: [android]
tagline: Messaging without internet
summary: Phones pass encrypted messages to each other over Bluetooth until they reach the right person.
order: 1
featured: true
icon: /apps/librechat/icon.svg
screenshots: [/apps/librechat/showcase.jpg]
accent: "#3b6df0"
links:
  site: https://prempoddar.is-a.dev/LibreChat/
  github: https://github.com/PremPoddar/LibreChat
related: [campfire, loadstone]
---

## The problem

At a festival, on a trek or during a power cut, the network is the first thing to go. Everyone still has a phone in their pocket, and those phones can still talk to each other. They just have nothing to talk through.

## What I built

LibreChat turns the phones around you into the network. Every phone is a Bluetooth server and a client at the same time. A message for someone out of range gets carried by the phones in between, up to seven hops. If there's no path right now, each phone holds a copy for up to a day and hands it on when one turns up.

It does public chat, direct messages, groups, photos, voice notes, read receipts, replies, reactions and disappearing messages. When two phones that support Wi-Fi Aware are close, they switch to a Wi-Fi link so photos move in seconds instead of minutes.

## The hard parts

There's no server, so there's nobody to hand out keys. I implemented X3DH and the Double Ratchet from Signal's published specs on BouncyCastle's primitives, and each phone puts its signed prekey in the announcement it broadcasts every 15 seconds. Groups use Sender Keys, which rotate when someone leaves.

Testing was the real work. Every primitive is checked against the RFC test vectors, and whole flows run over an in-memory mesh of three phones where A can only reach C through B. Bluetooth itself still needs real phones, so the last test is always the same: install it on three phones and walk apart.

LibreChat is open source and has had outside contributors. It hasn't had an independent security audit yet, and the README says so.
