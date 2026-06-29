# Round 3 Fixes — Implementation Plan

## Fix A: applyFlag race + wasUserPaused cleanup
**File**: `Apps/MoonlitApp/Sources/Components/MPVPlayerEngine.swift`

### A1. Fix applyFlag (line 560)
**Current**:
```swift
case "pause":
    if value == isPlaying { isPlaying = !value }
```
**Replace with**:
```swift
case "pause":
    isPlaying = !value
```
**Why**: The comparison `value == isPlaying` creates a race where a stale `pause=true` event from cache-buffering arrives after `play()` set `isPlaying = true`, sees `true == true`, and flips it back to `false`. By mirroring mpv's state directly, there's no comparison to go wrong.

### A2. Reset wasUserPaused in cleanup()
In `cleanup()`, after `lastStallPositionTime = 0` (line 785), add:
```swift
wasUserPaused = false
```
**Why**: `wasUserPaused` persists across `cleanup() → launch()` cycles, causing the foreground lifecycle handler to refuse auto-play on subsequent launches.

---

## Fix B: Blank backdrop — 3 sub-fixes

### B1. Preserve meta when name is raw ID
**File**: `Packages/MoonlitCore/Sources/MoonlitCore/Services/HomeRepository.swift`, lines 139-141

**Current**:
```swift
if let metaName = meta?.name, isRawId(metaName) {
    meta = nil
}
let cwBackground = meta?.background  // nil because meta was discarded
```
**Replace with**: Don't set `meta = nil`. Instead, only override the `name`:
```swift
var cwBackground = meta?.background
if let metaName = meta?.name, isRawId(metaName) {
    // Keep meta's artwork (poster, background, logo) but discard the bad name
}
```

### B2. Recover cwBackground from catalog fallback
**File**: Same file, lines 152-158

In the catalog fallback block, after `cwLogo` recovery, add:
```swift
if cwBackground == nil, let catalogBg = catalogItem.background {
    cwBackground = catalogBg
}
```
(Note: `MetaPreview` may not have a `background` field — check the model first. If it doesn't, skip this.)

### B3. Fix movie TMDB enrichment
**File**: `Packages/MoonlitCore/Sources/MoonlitCore/Services/MetaRepository.swift`

Find the `findTMDBId` function. The `FindResponse` struct only decodes `tv_results`. Add `movie_results`:
```swift
struct FindResponse: Codable {
    let tv_results: [TMDBTVResult]?
    let movie_results: [TMDBMovieResult]?
}
```
And add corresponding decoding for movies. (Need to inspect the exact struct to match.)

---

## Fix C: Bad stream auto-pick — add metadata check to cached launch
**File**: `Apps/MoonlitApp/Sources/Screens/PlayerScreen.swift`

In the cached source launch path (around line 290-318), before `mpvEngine.launch(activeLaunch)`:

If the cached source URL came from a stream in `streamRepo.streams`, check `isPendingDebrid` on that stream. Skip the cached URL if it's a pending-debrid stream.

Simpler alternative: Always run `fetchAndAutoLaunch()` for cached sources that fail preflight, rather than silently launching a bad URL. The preflight already catches most errors, but adding:
```swift
// After preflight success, also check metadata
if let matchingStream = streamRepo.streams.first(where: { $0.url == cachedUrl }),
   StreamSourceSelector.isPendingDebrid(matchingStream) {
    // Skip — this is a pending-debrid stream, fall through to fetchAndAutoLaunch
    await fetchAndAutoLaunch()
    return
}
```

---

## Fix D: Retry cache — query parentMetaId
**File**: `Apps/MoonlitApp/Sources/Screens/PlayerScreen.swift`, retry handler (~line 179-201)

In the `LastPlaybackSourceStore.shared.source()` query, add a fallback for parentMetaId:

**Current**:
```swift
if let profile = ProfileManager.shared.currentProfile,
   let cached = LastPlaybackSourceStore.shared.source(
       profileId: profile.id, mediaId: activeLaunch.videoId
   ),
```
**Replace with**:
```swift
if let profile = ProfileManager.shared.currentProfile,
   let cached = activeLaunch.parentMetaId.flatMap({ pid in
       LastPlaybackSourceStore.shared.source(profileId: profile.id, mediaId: pid)
   }) ?? LastPlaybackSourceStore.shared.source(
       profileId: profile.id, mediaId: activeLaunch.videoId
   ),
```
**Why**: For TV episodes, `LastPlaybackSourceStore` saves under `parentMetaId` (the series ID). The retry only queries by `videoId` (the episode ID), missing cached sources for other episodes of the same series.

---

## Fix E: Retry spinner — ensure FILE_LOADED path works
**File**: `Apps/MoonlitApp/Sources/Components/MPVPlayerEngine.swift`

`didScheduleFirstFrameReveal = false` is already in `loadURL()` (line 146). With the `applyFlag` race fixed (Fix A), the `MPV_EVENT_FILE_LOADED` → 350ms timer → `hasRenderedFrame = true` chain should work correctly.

No additional changes needed beyond Fix A. The `hasRenderedFrame` will correctly propagate to hide the spinner.

---

## Fix F: Orientation — verify existing fixes
**File**: `Apps/MoonlitApp/Sources/Components/MPVPlayerViewRepresentable.swift`

Already applied. The `updateUIView` now propagates frame changes, and `autoresizingMask = [.flexibleWidth, .flexibleHeight]` ensures the container fills its parent.

No additional changes needed. Nuvio's approach (`layoutMetalLayer()` called from `viewDidLayoutSubviews`) is equivalent to our `MPVContainerView.layoutSubviews()` — both resize the Metal layer when bounds change.
