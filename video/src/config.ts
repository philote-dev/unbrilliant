/**
 * Knobs you can tweak without touching the scenes.
 *
 * MUSIC: I can't generate or license audio, so the film renders silent by
 * default. To add a music bed, drop an .mp3 into `video/public/` and set
 * MUSIC_FILE to its name (e.g. "music.mp3"). It is mixed in with a gentle
 * fade in/out automatically. Royalty-free sources: Uppbeat, Pixabay Music.
 */
export const MUSIC_FILE: string | null = null;
export const MUSIC_VOLUME = 0.55;

/** The end-card call to action. Swap in the real URL when you have it. */
export const CTA = "Start free · willow.app";
