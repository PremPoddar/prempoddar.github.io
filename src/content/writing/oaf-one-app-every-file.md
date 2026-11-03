---
title: How OAF opens almost any file, and saves without breaking it
description: Detecting file types from bytes instead of names, one engine registry, and why OAF patches Word and Excel files instead of rewriting them.
date: 2026-11-03T12:05:00Z
kind: guide
tags: [Android, Kotlin, OAF]
related: [oaf]
---

[OAF](/apps/oaf/) is an Android app that opens PDFs, Word, Excel, slides, e-books, archives, pictures, audio and video, and edits most of them. "Open everything" sounds like a list of parsers. In practice the interesting problems were somewhere else: working out what a file actually is, and saving a file you only half understand without damaging the rest.

## What it solves

A phone collects files from everywhere: email attachments, downloads, chat apps, a USB stick, a network drive. Opening them usually means one app for PDFs, another for Word, another for zips, and a few of those want an account or upload the file somewhere first. OAF is one app for all of it, and nothing leaves the phone.

## Built with

Kotlin and Jetpack Compose with Material 3, on Android 10 and up. Apache POI and PdfBox-Android for Office files and PDFs, Apache Commons Compress, XZ for Java and junrar for archives, SMBJ and JSch for network drives, and ML Kit for the on-device picture tools. The code is split by job: `format/` works out what a file is, `doc/`, `sheet/`, `pdf/` and `slides/` handle each family, and `engine/` decides which viewer opens what.

## Don't trust the file name

Files arrive with wrong extensions all the time. A `.doc` that's really a `.docx`, a download called `file` with no extension at all. So OAF ignores the name at first and looks at the contents:

- **The first bytes.** Most formats start with a signature. `%PDF` for PDFs, `PK` for zips, and so on.
- **Inside zips.** Word, Excel, PowerPoint and EPUB are all zip files underneath. Seeing `PK` only tells you it's a zip. Peeking at the entries tells you which: `word/document.xml` means Word, `xl/workbook.xml` means Excel, a `mimetype` entry saying `application/epub+zip` means an e-book.
- **Text heuristics** for everything else: is it valid UTF-8, does it look like JSON, XML, Markdown or code.

A misnamed file still ends up in the right viewer.

## One registry for every format

Every format goes through one registry in `engine/Engines.kt`, which decides which viewer and editor open what. OAF's own native viewers are the default. For PDFs, Word and Excel there are also bundled web engines (pdf.js, docx-preview and SheetJS) you can switch to for a second opinion. They're shipped inside the app, so this works offline too.

Having one place that owns "who opens what" made it easy to add formats later without touching the rest of the app.

## Saving what you don't understand

This is the part that matters most. A Word file can contain a huge amount that OAF doesn't model: fields, comments, headers and footers, section settings, odd formatting. If an editor reads a document into its own model and writes that model back out, everything it didn't understand is quietly lost.

So OAF doesn't rewrite. It patches.

**Word.** Each paragraph remembers the exact XML it came from. When you save, only the paragraphs you changed get rebuilt. Everything else, including pictures, fields, comments and formatting OAF doesn't know about, goes back out byte for byte. New tables and rows get proper XML, and undoing after a save never duplicates or loses paragraphs.

**Excel.** Cell data, column widths, merges and frozen panes are rewritten in each sheet's XML. Charts, drawings, defined names, conditional formats and shared strings are left alone, and the file asks Excel to recalculate when it's next opened.

**PDF.** Edits go through PDFBox, each one into a new working copy, so undo is just stepping back through copies. Protected PDFs open with their password and are protected again when saved.

## The spreadsheet engine

Editing spreadsheets on a phone is pointless if formulas don't work. OAF has its own formula engine with about a hundred functions (maths, statistics, logic, text, lookups including `XLOOKUP`, dates), cross-sheet references, error values and loop detection. Insert or delete a row and the formulas that point across it are rewritten, the way Excel does it.

## Testing the boring parts hard

There are more than 200 unit tests. The ones I'd point anyone to are the round trips: open a real `.docx` or `.xlsx`, change one thing, save, and check that only that thing changed. That's the test that proves the patching idea actually works. There are also tests for archives that try path traversal (a zip entry named `../../something`), because an app that extracts files has to assume someone will try.

## What it doesn't do

It's honest to say where it stops. There's no tracked changes review, comments, footnotes or charts in the editor. Slides and EPUBs are view only. A drawn signature is a picture on the page, not a cryptographic signature. RAR5 archives can't be opened.

OAF is [on GitHub](https://github.com/PremPoddar/OAF) under Apache 2.0, with no ads and no analytics.
