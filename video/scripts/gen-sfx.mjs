/**
 * Procedural SFX generator for the Willow x Poly product film.
 *
 * Pure Node ESM, no third-party deps. Synthesizes calm, premium, subtle UI
 * sound effects as mono 16-bit PCM WAV files at 44100 Hz into public/sfx/.
 *
 * Run with: npm run gen:sfx
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const TWO_PI = Math.PI * 2;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "sfx");

// ----------------------------------------------------------------------------
// Core buffer + DSP helpers
// ----------------------------------------------------------------------------

const nSamples = (sec) => Math.max(1, Math.round(sec * SR));
const makeBuf = (sec) => new Float64Array(nSamples(sec));

// Resolve a value that may be either a constant or a fn(t, i) of time/index.
const asFn = (v) => (typeof v === "function" ? v : () => v);

// Small, fast, deterministic PRNG so output is reproducible run to run.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Additive oscillator with phase accumulation (so frequency can glide).
// type: "sine" | "tri". amp/freq may be constants or fns of (t, i).
function osc(buf, { freq, amp = 1, phase = 0, type = "sine", gain = 1 }) {
  const fFreq = asFn(freq);
  const fAmp = asFn(amp);
  const dt = 1 / SR;
  let ph = phase;
  for (let i = 0; i < buf.length; i++) {
    const t = i * dt;
    let s;
    if (type === "tri") {
      const frac = ph - Math.floor(ph + 0.5);
      s = 2 * Math.abs(2 * frac) - 1;
    } else {
      s = Math.sin(TWO_PI * ph);
    }
    buf[i] += gain * fAmp(t, i) * s;
    ph += fFreq(t, i) * dt;
  }
  return buf;
}

// Additive white noise.
function noise(buf, { amp = 1, gain = 1, rng = Math.random } = {}) {
  const fAmp = asFn(amp);
  const dt = 1 / SR;
  for (let i = 0; i < buf.length; i++) {
    buf[i] += gain * fAmp(i * dt, i) * (rng() * 2 - 1);
  }
  return buf;
}

// One-pole low-pass: y[n] = y[n-1] + a*(x[n]-y[n-1]).
// cutoff (Hz) may be a constant or a fn(t, i) to sweep the filter over time.
function lowpass(buf, cutoff) {
  const fc = asFn(cutoff);
  const dt = 1 / SR;
  const out = new Float64Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    let a = 1 - Math.exp(-TWO_PI * Math.max(1, fc(i * dt, i)) / SR);
    if (a > 1) a = 1;
    else if (a < 0) a = 0;
    y = y + a * (buf[i] - y);
    out[i] = y;
  }
  return out;
}

// One-pole high-pass derived from the low-pass (x - lowpass(x)).
function highpass(buf, cutoff) {
  const lp = lowpass(buf, cutoff);
  const out = new Float64Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] - lp[i];
  return out;
}

const expDecay = (tau) => (t) => Math.exp(-t / tau);

// Mix a source buffer into a destination at a sample offset.
function mixInto(dst, src, offset, gain = 1) {
  for (let i = 0; i < src.length; i++) {
    const j = offset + i;
    if (j < 0 || j >= dst.length) continue;
    dst[j] += gain * src[i];
  }
}

function peakOf(buf) {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > p) p = a;
  }
  return p;
}

function normalize(buf, targetPeak) {
  const p = peakOf(buf);
  if (p > 0) {
    const g = targetPeak / p;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  return buf;
}

// Short linear fades to kill boundary clicks. One-shots only (never on loops).
function fadeEdges(buf, fadeInMs, fadeOutMs) {
  const fi = Math.min(buf.length, Math.round((fadeInMs / 1000) * SR));
  const fo = Math.min(buf.length, Math.round((fadeOutMs / 1000) * SR));
  for (let i = 0; i < fi; i++) buf[i] *= i / fi;
  for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo;
  return buf;
}

// ----------------------------------------------------------------------------
// WAV (RIFF/WAVE, PCM, mono, 16-bit, 44100 Hz)
// ----------------------------------------------------------------------------

function encodeWavMono16(buf) {
  const len = buf.length;
  const bytesPerSample = 2;
  const dataSize = len * bytesPerSample;
  const blockAlign = bytesPerSample; // mono
  const byteRate = SR * blockAlign;
  const out = Buffer.alloc(44 + dataSize);

  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16); // PCM fmt chunk size
  out.writeUInt16LE(1, 20); // audio format = PCM
  out.writeUInt16LE(1, 22); // channels = mono
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(byteRate, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(16, 34); // bits per sample
  out.write("data", 36, "ascii");
  out.writeUInt32LE(dataSize, 40);

  let off = 44;
  for (let i = 0; i < len; i++) {
    let s = buf[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    const v = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    out.writeInt16LE(v, off);
    off += 2;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Sounds
// ----------------------------------------------------------------------------

// Soft, short UI cursor click/tap (~60 ms): high-ish sine tick + filtered noise.
function genClick() {
  const dur = 0.06;
  const buf = makeBuf(dur);
  osc(buf, { freq: 1850, amp: expDecay(0.007), gain: 0.9 });
  osc(buf, { freq: 3250, amp: expDecay(0.004), gain: 0.18 });

  const n = makeBuf(dur);
  noise(n, { amp: expDecay(0.004), rng: mulberry32(0x0c11c) });
  let nf = highpass(n, 1200);
  nf = lowpass(nf, 6000);
  for (let i = 0; i < buf.length; i++) buf[i] += 0.5 * nf[i];

  normalize(buf, 0.55);
  fadeEdges(buf, 0.5, 6);
  return buf;
}

// Soft "pop"/"thock" for an element appearing (~100 ms): sine with a tiny pitch
// drop + a hint of click at the very start.
function genPop() {
  const dur = 0.1;
  const buf = makeBuf(dur);
  osc(buf, {
    freq: (t) => 360 + 150 * Math.exp(-t / 0.03),
    amp: expDecay(0.03),
    gain: 1.0,
  });

  const c = makeBuf(0.02);
  osc(c, { freq: 1600, amp: expDecay(0.004), gain: 0.5 });
  const cn = makeBuf(0.02);
  noise(cn, { amp: expDecay(0.003), rng: mulberry32(0x90b) });
  const cnf = lowpass(highpass(cn, 1500), 7000);
  for (let i = 0; i < c.length; i++) c[i] += 0.4 * cnf[i];
  mixInto(buf, c, 0, 0.5);

  normalize(buf, 0.6);
  fadeEdges(buf, 0.5, 8);
  return buf;
}

// Airy transition whoosh (~450 ms): band-limited noise, swell-then-fade with a
// low-pass cutoff that opens then closes.
function genWhoosh() {
  const dur = 0.45;
  let buf = makeBuf(dur);
  noise(buf, { rng: mulberry32(0x3705) });
  buf = highpass(buf, 300); // keep it breathy, not rumbly
  const fc = (t) => 500 + 3200 * Math.sin(Math.PI * (t / dur)); // open -> close
  buf = lowpass(buf, fc);

  const env = (t) => Math.pow(Math.sin(Math.PI * (t / dur)), 1.3); // swell/fade
  for (let i = 0; i < buf.length; i++) buf[i] *= env(i / SR);

  normalize(buf, 0.5);
  fadeEdges(buf, 5, 12);
  return buf;
}

// Gentle riser for a big reveal (~850 ms): warm low pad + octave rising slightly
// in pitch/volume, faint noise wash in/out, soft resolve.
function genSwell() {
  const dur = 0.85;
  const buf = makeBuf(dur);
  osc(buf, { freq: (t) => 140 + 25 * (t / dur), gain: 1.0 });
  osc(buf, { freq: (t) => 280 + 50 * (t / dur), gain: 0.5 });
  osc(buf, { freq: (t) => 210 + 30 * (t / dur), gain: 0.22 });

  const env = (t) => {
    const x = t / dur;
    const rise = Math.pow(x, 0.8); // crescendo
    const rel = x < 0.85 ? 1 : 1 - (x - 0.85) / 0.15; // soft resolve
    return rise * rel;
  };
  for (let i = 0; i < buf.length; i++) buf[i] *= env(i / SR);

  const n = makeBuf(dur);
  noise(n, { rng: mulberry32(0x5e11) });
  const nf = lowpass(highpass(n, 400), (t) => 800 + 1500 * Math.sin(Math.PI * (t / dur)));
  for (let i = 0; i < buf.length; i++) {
    buf[i] += 0.1 * Math.sin(Math.PI * (i / SR / dur)) * nf[i];
  }

  normalize(buf, 0.6);
  fadeEdges(buf, 8, 30);
  return buf;
}

// LOOPABLE soft typing/streaming texture (~1.0 s). Irregular soft ticks; both
// ends sit in silence and trailing+leading gaps form a natural interval, so the
// rhythm stays continuous across the loop point (no fades on loops).
function genTyping() {
  const dur = 1.0;
  const buf = makeBuf(dur);
  const rng = mulberry32(1337);
  const tickTail = 0.03; // each tick fully decays within this window
  const avgGap = 0.085;

  let t = 0.04 + rng() * 0.03; // leading gap
  while (t < dur - tickTail) {
    const tick = makeBuf(tickTail);
    const f = 1200 + rng() * 900;
    osc(tick, { freq: f, amp: expDecay(0.005), gain: 0.6 + 0.4 * rng() });
    const tn = makeBuf(tickTail);
    noise(tn, { amp: expDecay(0.003), rng });
    const tnf = lowpass(highpass(tn, 1500), 6000);
    for (let i = 0; i < tick.length; i++) tick[i] += 0.25 * tnf[i];
    mixInto(buf, tick, Math.round(t * SR), 1);
    t += avgGap * (0.6 + 0.8 * rng());
  }

  const out = lowpass(buf, 7000); // soften
  normalize(out, 0.32); // quieter: it plays continuously
  return out;
}

// LOOPABLE warm ambient hum for Poly "speaking" (~1.8 s). All partials and the
// tremolo LFO complete an integer number of cycles over the duration, so the
// loop is mathematically seamless (no fades).
function genOrb() {
  const dur = 1.8; // 1.8 * 44100 = 79380 samples exactly
  const buf = makeBuf(dur);
  osc(buf, { freq: 110, gain: 1.0 }); // 110 * 1.8 = 198 cycles
  osc(buf, { freq: 165, gain: 0.5 }); // fifth, 297 cycles
  osc(buf, { freq: 220, gain: 0.35 }); // octave, 396 cycles
  osc(buf, { freq: 330, gain: 0.12 }); // octave+fifth, 594 cycles

  const lfoHz = (110 * 7) / 198; // ~3.89 Hz, exactly 7 cycles over dur
  const depth = 0.14; // shallow tremolo
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= 1 + depth * Math.sin(TWO_PI * lfoHz * (i / SR));
  }

  normalize(buf, 0.3); // quiet ambient bed
  return buf;
}

// Soft success chime (~850 ms): a small bell-like major arpeggio (D5/F#5/A5)
// with bell-ish decays and a faint inharmonic overtone for sparkle.
function genChime() {
  const dur = 0.85;
  const buf = makeBuf(dur);
  const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
  const onsets = [0.0, 0.085, 0.17];
  const gains = [0.9, 0.8, 0.95];

  for (let k = 0; k < notes.length; k++) {
    const f = notes[k];
    const note = makeBuf(dur - onsets[k]);
    osc(note, { freq: f, amp: expDecay(0.28), gain: 1.0 });
    osc(note, { freq: f * 2.0, amp: expDecay(0.16), gain: 0.3 });
    osc(note, { freq: f * 2.76, amp: expDecay(0.09), gain: 0.12 }); // inharmonic
    mixInto(buf, note, Math.round(onsets[k] * SR), gains[k]);
  }

  normalize(buf, 0.6);
  fadeEdges(buf, 2, 40);
  return buf;
}

// ----------------------------------------------------------------------------
// Verification (parse back the bytes we wrote)
// ----------------------------------------------------------------------------

function findChunk(b, id, start = 12) {
  let off = start;
  while (off + 8 <= b.length) {
    const cid = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (cid === id) return { off, size, dataOff: off + 8 };
    off += 8 + size + (size % 2);
  }
  return null;
}

function verifyWav(bytes) {
  const riff = bytes.toString("ascii", 0, 4);
  const wave = bytes.toString("ascii", 8, 12);
  const fmt = findChunk(bytes, "fmt ");
  const data = findChunk(bytes, "data");
  const result = {
    riff,
    wave,
    hasFmt: !!fmt,
    hasData: !!data,
    channels: null,
    sampleRate: null,
    bits: null,
    dataBytes: data ? data.size : 0,
    maxAbs: 0,
  };
  if (fmt) {
    result.channels = bytes.readUInt16LE(fmt.dataOff + 2);
    result.sampleRate = bytes.readUInt32LE(fmt.dataOff + 4);
    result.bits = bytes.readUInt16LE(fmt.dataOff + 14);
  }
  if (data) {
    const end = data.dataOff + data.size;
    let max = 0;
    for (let off = data.dataOff; off + 2 <= end; off += 2) {
      const a = Math.abs(bytes.readInt16LE(off));
      if (a > max) max = a;
    }
    result.maxAbs = max;
  }
  result.ok =
    riff === "RIFF" &&
    wave === "WAVE" &&
    result.hasFmt &&
    result.hasData &&
    result.channels === 1 &&
    result.sampleRate === SR &&
    result.bits === 16 &&
    result.dataBytes > 0 &&
    result.maxAbs > 0;
  return result;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

const SOUNDS = [
  ["click.wav", genClick],
  ["pop.wav", genPop],
  ["whoosh.wav", genWhoosh],
  ["swell.wav", genSwell],
  ["typing.wav", genTyping],
  ["orb.wav", genOrb],
  ["chime.wav", genChime],
];

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let totalBytes = 0;
  const rows = [];
  for (const [name, gen] of SOUNDS) {
    const wav = encodeWavMono16(gen());
    const path = join(OUT_DIR, name);
    writeFileSync(path, wav);

    const v = verifyWav(readFileSync(path));
    totalBytes += wav.length;
    rows.push({ name, bytes: wav.length, v });
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nGenerated ${rows.length} SFX -> ${OUT_DIR}\n`);
  console.log(
    pad("file", 13) +
      pad("bytes", 9) +
      pad("ms", 7) +
      pad("ch/sr/bits", 16) +
      pad("maxAbs", 9) +
      "ok",
  );
  console.log("-".repeat(62));
  let allOk = true;
  for (const { name, bytes, v } of rows) {
    const ms = Math.round((v.dataBytes / 2 / SR) * 1000);
    const fmt = `${v.channels}/${v.sampleRate}/${v.bits}`;
    const peakDbfs = v.maxAbs > 0 ? (20 * Math.log10(v.maxAbs / 32768)).toFixed(1) : "-inf";
    console.log(
      pad(name, 13) +
        pad(bytes, 9) +
        pad(ms, 7) +
        pad(fmt, 16) +
        pad(`${v.maxAbs} (${peakDbfs}dB)`, 9 + 9) +
        (v.ok ? "yes" : "NO"),
    );
    if (!v.ok) allOk = false;
  }
  console.log("-".repeat(62));
  console.log(`total: ${totalBytes} bytes (${(totalBytes / 1024).toFixed(1)} KB)\n`);

  if (!allOk) {
    console.error("ERROR: one or more WAV files failed validation.");
    process.exit(1);
  }
}

main();
