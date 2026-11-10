'use strict';
// Voices: Kokoro (free, offline, natural, Apache-2.0) or Piper (free, offline, robotic) make each line;
// FFmpeg can change the pitch (kid / deep voice) and trims silence.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOLS = process.env.AA_TOOLS || path.join(__dirname, '..', '..', 'tools');
const PIPER = process.env.PIPER || path.join(TOOLS, 'piper', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
const VOICES = process.env.PIPER_VOICES || path.join(TOOLS, 'piper-voices');
const KOKORO = process.env.KOKORO_DIR || path.join(TOOLS, 'kokoro');
const KOKORO_PY = process.env.KOKORO_PY || path.join(KOKORO, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

// the same clean-up for every voice: optional pitch change, trim the quiet bits at both ends, 44.1 kHz mono
function finish(raw, voice, outWav) {
  const af = [];
  if (voice.pitch && voice.pitch !== 1) af.push(`rubberband=pitch=${voice.pitch}`);
  af.push('silenceremove=start_periods=1:start_threshold=-50dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB', 'areverse');
  af.push('aresample=44100');
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', raw, '-af', af.join(','), '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
  return readWav(outWav);
}

// many lines at once: jobs = [{ text, voice, outWav }]. Kokoro lines go to one Python run (the model loads once).
// voice = { engine: "kokoro", voice: "am_michael", speed }  or  Piper: { model, speed, pitch }
function sayAll(jobs) {
  const kok = jobs.filter(j => j.voice.engine === 'kokoro');
  if (kok.length) {
    const model = path.join(KOKORO, 'models', 'kokoro-v1.0.onnx'), bank = path.join(KOKORO, 'models', 'voices-v1.0.bin');
    if (!fs.existsSync(model) || !fs.existsSync(KOKORO_PY)) throw new Error(`Kokoro not found in ${KOKORO}`);
    const list = kok.map(j => ({ text: j.text, voice: j.voice.voice, speed: j.voice.speed || 1, lang: j.voice.lang, out: j.outWav.replace(/\.wav$/, '.kokoro.wav') }));
    const jobsFile = path.join(path.dirname(kok[0].outWav), 'kokoro-jobs.json');
    fs.writeFileSync(jobsFile, JSON.stringify(list));
    execFileSync(KOKORO_PY, ['-I', path.join(__dirname, 'kokoro_say.py'), model, bank, jobsFile], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  return jobs.map(j => (j.voice.engine === 'kokoro' ? finish(j.outWav.replace(/\.wav$/, '.kokoro.wav'), j.voice, j.outWav) : say(j.text, j.voice, j.outWav)));
}

// one Piper line. voice = { model, speed (1 = normal, bigger = faster), pitch (1 = normal, 1.2 = higher) }
function say(text, voice, outWav) {
  if (voice.engine === 'kokoro') return sayAll([{ text, voice, outWav }])[0];
  const model = path.join(VOICES, `${voice.model}.onnx`);
  if (!fs.existsSync(model)) throw new Error(`voice not found: ${model}`);
  const raw = outWav.replace(/\.wav$/, '.piper.wav');
  execFileSync(PIPER, ['--model', model, '--output_file', raw, '--length_scale', String(1 / (voice.speed || 1)), '--sentence_silence', '0.12'],
    { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
  return finish(raw, voice, outWav);
}
function readWav(file) {
  const b = fs.readFileSync(file);
  let pos = 12, rate = 44100, ch = 1, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(pos + 10); rate = b.readUInt32LE(pos + 12); }
    if (id === 'data') { data = b.subarray(pos + 8, Math.min(b.length, pos + 8 + size)); break; }
    pos += 8 + size + (size & 1);
  }
  const n = Math.floor(data.length / 2 / ch);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = data.readInt16LE(i * 2 * ch) / 32768;
  return { file, rate, samples, duration: n / rate };
}

// Put every line at its start time and make one voice track, loudness like other shorts (-14 LUFS).
// Voices have sharp peaks, so plain loudnorm stopped at about -15.5 LUFS. Instead: a gentle compressor,
// gain to about -14, a -3 dB limiter, then a measured (two-pass) loudnorm sets it exactly.
function mixLines(lines, total, outWav) {
  const inputs = [];
  lines.forEach(l => inputs.push('-i', l.wav.file));
  const parts = lines.map((l, i) => `[${i}:a]adelay=${Math.round(l.start * 1000)}:all=1[a${i}]`);
  const base = lines.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}`;
  const LN = 'loudnorm=I=-14:TP=-1.5:LRA=11';
  const measure = chain => {
    const r = require('child_process').spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...inputs, '-filter_complex', parts.concat(`${base}${chain},${LN}:print_format=json[out]`).join(';'), '-map', '[out]', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const m = (r.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/);
    return m ? JSON.parse(m[0]) : null;
  };
  let chain = ',acompressor=threshold=0.1:ratio=3:attack=5:release=80:makeup=1', norm = LN;
  try {
    const m1 = measure(chain);
    if (m1 && isFinite(+m1.input_i)) chain += `,volume=${(-14 - m1.input_i).toFixed(2)}dB,alimiter=limit=0.708:attack=1:release=50:level=0`;
    const m = measure(chain);
    if (m) norm += `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  } catch (e) { /* fall back to one pass */ }
  execFileSync(FFMPEG, ['-y', '-v', 'error', ...inputs, '-filter_complex', parts.concat(`${base}${chain},${norm},aresample=48000[out]`).join(';'), '-map', '[out]', '-ac', '2', '-c:a', 'pcm_s16le', outWav]);
  return outWav;
}

module.exports = { say, sayAll, readWav, mixLines, FFMPEG };
