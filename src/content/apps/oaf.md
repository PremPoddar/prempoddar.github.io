---
title: OAF
platform: [android]
tagline: Open All Files
summary: One Android app that opens and edits almost any file, with no ads and nothing uploaded.
order: 2
featured: false
icon: /apps/oaf/icon.svg
screenshots: [/apps/oaf/showcase.jpg]
accent: "#f2913f"
links:
  site: https://prempoddar.github.io/OAF/
  github: https://github.com/PremPoddar/OAF
related: [oaf-one-app-every-file]
---

## The problem

Phones collect files from everywhere: a PDF to sign, a spreadsheet from work, a zip from a friend, an EPUB. Most people end up with five apps, half of them full of ads, and some that quietly upload your documents.

## What I built

OAF opens PDFs, Word, Excel, slides, e-books, archives, pictures, music and video in one app, and edits most of them. You can sign and fill PDFs, scan paper with the camera, edit spreadsheets with real formulas, clean up photos and reach files on home or office drives over SMB, SFTP, FTP and WebDAV. Everything happens on the phone. No account, no analytics, no ads.

## The hard parts

**Knowing what a file is.** OAF looks at the first bytes, peeks inside zips (Word, Excel and EPUB are all zips underneath) and sniffs text, so a file with the wrong name still opens in the right viewer.

**Saving without breaking things.** A Word file has a lot OAF doesn't model. So each paragraph remembers the XML it came from, and only the ones you changed get rebuilt. Everything else is carried over untouched. Spreadsheets work the same way, and there's a formula engine with about a hundred functions behind them.

**Proving it.** There are more than 200 unit tests, covering type detection, the formula engine function by function, and DOCX and XLSX round trips that check only the edited parts changed.
