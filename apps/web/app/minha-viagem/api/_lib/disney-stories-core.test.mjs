import assert from "node:assert/strict";
import test from "node:test";
import {
  DISNEY_STORY_CALENDAR,
  deterministicStoryScript,
  episodeTitle,
  renderPodcastRss,
  spotifyEpisodeEmbedUrl,
  storyForDate
} from "./disney-stories-core.js";

test("Disney Stories calendar covers 12 Jul through 9 Aug", () => {
  assert.equal(DISNEY_STORY_CALENDAR.length, 29);
  assert.equal(storyForDate("2026-07-12").name, "Minnie");
  assert.equal(storyForDate("2026-07-20").name, "Cinderela");
  assert.equal(storyForDate("2026-08-09").name, "Surpresa");
  assert.equal(storyForDate("2026-07-11"), null);
});

test("fallback script is usable for TTS", () => {
  const item = storyForDate("2026-07-21");
  const script = deterministicStoryScript(item);
  assert.match(script, /Ariel|Luiza/);
  assert.equal(script.length > 400, true);
});

test("podcast RSS includes valid enclosure metadata", () => {
  const item = storyForDate("2026-07-20");
  const rss = renderPodcastRss({
    siteUrl: "https://example.com",
    feedUrl: "https://example.com/feed.xml",
    imageUrl: "https://example.com/cover.jpg",
    episodes: [{
      date: item.date,
      title: episodeTitle(item),
      description: "Teste",
      audioUrl: "https://example.com/audio.mp3",
      audioBytes: 1234,
      imageUrl: "https://example.com/image.jpg",
      guid: "episode-1"
    }]
  });
  assert.match(rss, /<rss version="2.0"/);
  assert.match(rss, /type="audio\/mpeg"/);
  assert.match(rss, /Cinderela/);
});

test("Spotify embed URL can be derived from an episode URL or id", () => {
  assert.equal(
    spotifyEpisodeEmbedUrl({ spotifyEpisodeUrl: "https://open.spotify.com/episode/abc123?si=x" }),
    "https://open.spotify.com/embed/episode/abc123"
  );
  assert.equal(
    spotifyEpisodeEmbedUrl({ spotifyEpisodeId: "xyz789" }),
    "https://open.spotify.com/embed/episode/xyz789"
  );
});
