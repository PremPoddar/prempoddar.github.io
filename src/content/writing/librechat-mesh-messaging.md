---
title: A messenger where the phones are the network
description: How LibreChat floods messages across a Bluetooth mesh, holds them for a day when there's no path yet, and starts Signal-style encrypted chats with no server to hand out keys.
date: 2026-11-03T12:01:00Z
kind: post
tags: [Android, Kotlin, Bluetooth, Cryptography, LibreChat]
related: [librechat]
---

[LibreChat](/apps/librechat/) is a messenger that works with no internet, no mobile signal and no server. The phones around you become the network: a message for someone out of range is carried by the phones in between.

## What it solves

At a festival, on a trek, in a building with no signal or during a power cut, the network goes first. Everyone still has a phone in their pocket, and those phones can still reach each other over Bluetooth. They just have nothing to send through.

<figure class="shot"><img src="/apps/librechat/showcase.jpg" alt="LibreChat's setup screen, chats in dark and light, and appearance settings" loading="lazy" /><figcaption>Setup, chats in dark and light, and appearance.</figcaption></figure>

LibreChat gives them that. There's a public chat for everyone in range, signed so nobody can post as you. Direct messages and groups are end to end encrypted. Photos and voice notes, receipts, replies, reactions, disappearing messages, QR code verification and a radar of who's nearby all work without a single server.

## Built with

- **Kotlin and Jetpack Compose** with Material 3, on Android 10 and up.
- **Bluetooth Low Energy GATT** for the mesh, and **Wi-Fi Aware** for fast links when both phones support it.
- **BouncyCastle** for the primitives: X25519, Ed25519, ChaCha20-Poly1305 and HKDF-SHA256.
- **SQLCipher** for the message database, encrypted media files, and keys guarded by the **Android Keystore**.
- **Protocol Buffers** for packets and sessions on the wire and on disk.

<figure class="shot"><img src="/figures/librechat-architecture.jpg" alt="The layers inside each phone: ui, engine, crypto, mesh and protocol, over Bluetooth LE and Wi-Fi Aware" loading="lazy" /><figcaption>Every phone runs the whole stack. There's no server anywhere.</figcaption></figure>

## Flooding, carefully

Every phone is a Bluetooth server and a client at the same time: it advertises the LibreChat service and scans for it. Every 15 seconds it announces itself with its name and public keys, signed.

The simplest routing that works on a network nobody planned is flooding: send every packet to every neighbour. It needs two guards to stop it from melting the network. Each phone remembers the last 5,000 packets it has seen and ignores repeats, and every packet carries a hop limit that starts at 7 and drops by one at each phone.

<figure>
<div class="diagram"><svg viewBox="0 0 640 220" role="img" aria-label="A message hops from A through B to C, with the hop limit dropping at each step">
<g>
<circle cx="70" cy="90" r="34" class="accent"/><text x="70" y="96" text-anchor="middle" class="on-dark bold">You</text>
<circle cx="250" cy="90" r="34" class="box"/><text x="250" y="96" text-anchor="middle" class="bold">B</text>
<circle cx="430" cy="90" r="34" class="box"/><text x="430" y="96" text-anchor="middle" class="bold">C</text>
<circle cx="590" cy="90" r="34" class="accent-soft"/><text x="590" y="96" text-anchor="middle" class="bold">Friend</text>
</g>
<path d="M108 90 H210" class="accent-line"/><path d="M288 90 H390" class="accent-line"/><path d="M468 90 H550" class="accent-line"/>
<path d="M204 84 l8 6 l-8 6" class="accent-line"/><path d="M384 84 l8 6 l-8 6" class="accent-line"/><path d="M544 84 l8 6 l-8 6" class="accent-line"/>
<g class="mono small"><text x="160" y="76" text-anchor="middle">ttl 7</text><text x="340" y="76" text-anchor="middle">ttl 6</text><text x="510" y="76" text-anchor="middle">ttl 5</text></g>
<path d="M590 130 C 560 190, 120 190, 76 132" class="dash"/>
<path d="M82 140 l-6 -8 l-2 10" class="line"/>
<text x="330" y="200" text-anchor="middle" class="hand">signed acknowledgement comes back the same way</text>
<rect x="190" y="10" width="120" height="30" rx="6" class="note"/><text x="250" y="30" text-anchor="middle" class="small">keeps a copy, 24 h</text>
<rect x="370" y="10" width="120" height="30" rx="6" class="note"/><text x="430" y="30" text-anchor="middle" class="small">keeps a copy, 24 h</text>
</svg></div>
<figcaption>Each relay drops the hop limit by one and keeps a copy. The acknowledgement tells relays they can throw their copies away.</figcaption>
</figure>

Here's the heart of the router. All of it is plain logic with no Bluetooth in sight, which is what made it testable:

```kotlin title="mesh/Router.kt"
val seenAt = seen[packet.key]
if (seenAt != null) {
    // The sender is retrying because our acknowledgement got lost.
    val again = packet.type == PacketType.DIRECT && packet.recipient == me
    // A retry of someone else's direct message: pass it on again,
    // but rarely enough that copies circling the mesh die out.
    val now = clock()
    if (packet.type == PacketType.DIRECT && !again && packet.ttl > 1 && now - seenAt > REFORWARD_MS) {
        seen[packet.key] = now
        val next = packet.copy(ttl = packet.ttl - 1)
        sends += targets(next, from = link).map { Send(it, next) }
    }
    return Routed(if (again) packet else null, sends, duplicate = again)
}
seen[packet.key] = clock()
if (packet.sender == me) return Routed(null, sends)

val forMe = packet.recipient == me
val deliver = if (packet.isBroadcast || forMe) packet else null
if (!forMe && packet.ttl > 1) {
    val next = packet.copy(ttl = packet.ttl - 1)
    val out = targets(next, from = link).map { Send(it, next) }
    sends += out
    remember(next, out, fromPeer = linkPeer[link])
}
```

Two details in there are easy to get wrong. A duplicate addressed *to me* still gets delivered again, because it means the sender never got my acknowledgement and is retrying. And a duplicate addressed to someone else is passed on again, but only if 20 seconds have passed, which lets retries cross the mesh without copies circling forever.

The `seen` set itself is a `LinkedHashMap` that drops its oldest entry past 5,000, which is the cheapest bounded memory I know of in Kotlin:

```kotlin title="mesh/Router.kt"
private val seen = object : LinkedHashMap<String, Long>(4096, 0.75f, false) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Long>?) = size > SEEN_MAX
}
```

## When there's no path yet

Flooding only helps if a path exists right now. At a festival, people walk in and out of range all the time. The friend you're messaging might not be reachable for an hour.

So every phone keeps a copy of what it relays, for up to 24 hours, within limits of 600 packets and 4 MB. When a new neighbour announces itself, it gets every stored packet it hasn't been given before:

```kotlin title="mesh/Router.kt"
private fun replayTo(link: String, peer: String): List<Send> {
    val now = clock()
    return store.values.filter { it.until >= now && peer !in it.sentToPeers && it.packet.sender != peer }
        .map { s ->
            s.sentToPeers += peer
            Send(link, s.packet)
        }
}
```

That's store and forward: a message can cross the mesh even when the path only ever exists in pieces, at different times. When the recipient finally gets it, their signed acknowledgement travels back and relays drop their copies.

## Encryption with nobody in the middle

Signal-style encryption normally relies on a server. Before your first message, you fetch the other person's prekeys from it. With no server, there's nowhere to fetch from.

The fix is to carry the server's job in the announcement. Each phone includes its signed prekey in the announcement it already broadcasts every 15 seconds, so anyone who can hear it has what they need to start a chat. LibreChat runs X3DH without one-time prekeys: three Diffie-Hellman agreements, mixed into one shared secret:

<figure>
<div class="diagram"><svg viewBox="0 0 640 250" role="img" aria-label="X3DH: three Diffie-Hellman agreements between your keys and theirs">
<text x="100" y="24" text-anchor="middle" class="bold">Your keys</text>
<text x="540" y="24" text-anchor="middle" class="bold">Their keys</text><text x="540" y="40" text-anchor="middle" class="small muted">from their announcement</text>
<rect x="20" y="50" width="160" height="44" rx="8" class="box"/><text x="100" y="77" text-anchor="middle">identity key</text>
<rect x="20" y="150" width="160" height="44" rx="8" class="accent-soft"/><text x="100" y="170" text-anchor="middle">ephemeral key</text><text x="100" y="186" text-anchor="middle" class="small muted">made for this chat</text>
<rect x="460" y="50" width="160" height="44" rx="8" class="box"/><text x="540" y="77" text-anchor="middle">identity key</text>
<rect x="460" y="150" width="160" height="44" rx="8" class="box"/><text x="540" y="170" text-anchor="middle">signed prekey</text><text x="540" y="186" text-anchor="middle" class="small muted">checked against identity</text>
<path d="M180 72 L460 168" class="line"/><text x="214" y="74" class="mono small bold">DH1</text>
<path d="M180 172 L460 72" class="line"/><text x="214" y="148" class="mono small bold">DH2</text>
<path d="M180 172 H460" class="accent-line"/><text x="320" y="166" text-anchor="middle" class="mono small bold">DH3</text>
<text x="320" y="236" text-anchor="middle" class="hand">HKDF(DH1 ‖ DH2 ‖ DH3) becomes the first ratchet key</text>
</svg></div>
<figcaption>Both sides end up with the same secret without ever sending it. The first messages carry a small header with your identity and ephemeral key, so the other side can run the same three agreements.</figcaption>
</figure>

```kotlin title="crypto/Session.kt"
fun initiate(me: Identity, them: PublicIdentity, prekey: PublicPrekey): Started {
    if (!them.isValid()) throw CryptoException("their identity key is not signed correctly")
    if (!prekey.verify(them)) throw CryptoException("their prekey is not signed by them")
    val ek = X25519KeyPair.generate()
    val dh1 = X25519.agree(me.dh.private, prekey.key)
    val dh2 = X25519.agree(ek.private, them.dhKey)
    val dh3 = X25519.agree(ek.private, prekey.key)
    return Started(kdf(dh1, dh2, dh3), ek.public, ad(me.signing.public, them.signingKey))
}
```

After that, every message goes through the Double Ratchet, which handles messages arriving out of order and keeps keys for skipped ones. A mesh makes some things more likely than they'd be on a server, and the code has to expect them:

- **Both sides start at once.** Two people message each other before either has heard back, and now there are two sessions. LibreChat keeps up to three sessions per person, tries each one when decrypting, and sends with whichever last worked.
- **The first message gets lost.** The prekey header rides along on every message until the other side replies, so any of them can start the session.
- **An old first message is replayed.** Each session remembers the ephemeral key that started it, and a first message with the same key is refused.

Groups use Sender Keys: each member encrypts once for the whole group, the keys are shared over the one-to-one sessions, and they're replaced whenever someone leaves. Public chat is signed, not encrypted. Relays can see the sender and recipient ids, sizes and timing, but not contents.

## Testing it

This is where most of the time went. Every primitive is checked against its RFC test vectors (7748, 8032, 5869, 4231 and 8439). The ratchet is tested for out of order delivery, skipped messages, replays, tampering and serialisation. Sender Keys are tested for forgery, replay and late joiners.

Then whole flows run over an in-memory mesh of three phones, where A can only reach C through B: delivery ticks, waiting for an unknown recipient, store and forward, lost acknowledgements, groups and admin hand-over, photos and re-requesting lost pieces, disappearing messages, blocking and forged announcements. Because the router and the engine never touch Bluetooth directly, all of that runs on a laptop in seconds.

Bluetooth itself still needs real hardware, so the last test is always the same: install it on three phones and walk apart.

## Where it stops

LibreChat is open source and has had outside contributors. It hasn't had an independent security audit, and the README says so plainly in the encryption section. If you need audited encryption, use something that's been audited. Bluetooth is also slow, so photos over a long chain of phones take minutes unless Wi-Fi Aware can step in.

The source is [on GitHub](https://github.com/PremPoddar/LibreChat) under Apache 2.0.
