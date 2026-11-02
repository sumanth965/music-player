// localAudioMetadata.js
// Handles metadata parsing for local audio files:
// - ID3v2.3/2.4 tags (Title, Artist, Album, embedded lyrics, cover art)
// - Vorbis comment tags (FLAC, Ogg)
// - MP4/M4A metadata tags
// - Filename heuristics for Artist - Title
// - Companion .lrc / .txt lyrics file parsing and matching
// - Recursive directory traversal for folder uploads / drag-and-drop

import { probeFile } from './audio-format.js';

const AUDIO_EXTS = new Set([
  'mp3', 'm4a', 'aac', 'wav', 'wave', 'ogg', 'oga', 'flac', 'opus',
  'aif', 'aiff', 'webm', 'caf', 'wma'
]);

const LYRIC_EXTS = new Set(['lrc', 'txt', 'srt']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']);

export const localAudioFilesCache = new Map();

/**
 * Retrieves the raw File or Blob for a given track
 */
export async function getAudioFileForTrack(track) {
  if (!track) return null;
  if (track.file instanceof Blob) return track.file;
  if (track.id && localAudioFilesCache.has(track.id)) return localAudioFilesCache.get(track.id);
  if (track.localUrl && localAudioFilesCache.has(track.localUrl)) return localAudioFilesCache.get(track.localUrl);

  if (track.localUrl && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(track.localUrl);
      const blob = await res.blob();
      const fileName = track.fileName || track.tags?.fileName || `${track.title || 'audio'}.mp3`;
      return new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Clean filename without extension and directory path
 */
export function getBaseName(fileName) {
  const withoutPath = String(fileName || '').replace(/^.*[/\\]/, '');
  return withoutPath.replace(/\.[^/.\\]+$/, '');
}

/**
 * Get file extension in lowercase without dot
 */
export function getExtension(fileName) {
  const match = String(fileName || '').match(/\.([^/.\\]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Checks if a file is an audio file
 */
export function isAudioFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('audio/')) return true;
  return AUDIO_EXTS.has(getExtension(file.name));
}

/**
 * Checks if a file is a lyrics/text file
 */
export function isLyricFile(file) {
  if (!file) return false;
  return LYRIC_EXTS.has(getExtension(file.name));
}

/**
 * Cleans unwanted junk suffixes and decoratives from song titles/artists
 */
export function cleanTitleArtifacts(text) {
  if (!text) return '';
  return text
    .replace(/\s*[([](?:official\s*(?:video|audio|music\s*video|lyric\s*video|visualizer)|lyrics?|4k|hd|hq|explicit|clean|audio|remaster(?:ed)?(?:\s*\d{4})?|album\s*version|single\s*version|radio\s*edit)[^)\]]*[)\]]/gi, '')
    .replace(/\s*\[(?:320kbps|flac|128k|mp3)\]/gi, '')
    .replace(/^(?:[a-z]?\d{1,3}[\s._-]+)+/i, '')
    .trim();
}

/**
 * Parses artist, title, and album from a file name
 * Examples:
 *   "Queen - Bohemian Rhapsody.mp3" -> artist: Queen, title: Bohemian Rhapsody
 *   "01. The Weeknd - Blinding Lights (Official Video).mp3" -> artist: The Weeknd, title: Blinding Lights
 *   "03 - Yesterday.mp3" -> artist: "", title: Yesterday
 *   "Coldplay - Parachutes - 01 - Don't Panic.flac" -> artist: Coldplay, album: Parachutes, title: Don't Panic
 */
export function parseTrackFromFilename(fileName) {
  const base = getBaseName(fileName);
  let cleaned = cleanTitleArtifacts(base);

  // Remove leading track numbers: "01. ", "01 - ", "01_ ", "1 - ", "A1 - "
  cleaned = cleaned.replace(/^(?:[a-z]?\d{1,3}[\s._-]+)+/i, '').trim();

  // Try split by common delimiters: " - ", " _ ", " ~ "
  const parts = cleaned.split(/\s*[-_~|]\s+/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 4) {
    // "Artist - Album - 01 - Title"
    if (/^\d+$/.test(parts[2])) {
      return {
        artist: parts[0],
        album: parts[1],
        title: cleanTitleArtifacts(parts.slice(3).join(' - '))
      };
    }
    return {
      artist: parts[0],
      album: parts[1],
      title: cleanTitleArtifacts(parts.slice(2).join(' - '))
    };
  }

  if (parts.length === 3) {
    // If middle part is just a track number (e.g. "Artist - 01 - Title")
    if (/^\d+$/.test(parts[1])) {
      return {
        artist: parts[0],
        title: cleanTitleArtifacts(parts[2]),
        album: ''
      };
    }
    // "Artist - Album - Title"
    return {
      artist: parts[0],
      album: parts[1],
      title: cleanTitleArtifacts(parts[2])
    };
  }

  if (parts.length === 2) {
    return {
      artist: parts[0],
      title: cleanTitleArtifacts(parts[1]),
      album: ''
    };
  }

  return {
    artist: '',
    title: cleanTitleArtifacts(cleaned || base),
    album: ''
  };
}

/**
 * Parses an LRC or plain text lyrics string into Swar structured lyrics format
 */
export function parseLrcText(lrcString) {
  if (!lrcString || typeof lrcString !== 'string') return null;

  const lines = [];
  let title = '';
  let artist = '';
  let album = '';
  let offset = 0; // in seconds

  const rawLines = lrcString.split(/\r?\n/);
  const timeRegex = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;
  let lineId = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Check tags: [ti:Title], [ar:Artist], [al:Album], [offset:+/-ms]
    const tagMatch = trimmed.match(/^\[(ti|ar|al|offset|by):([^\]]*)\]/i);
    if (tagMatch) {
      const key = tagMatch[1].toLowerCase();
      const val = tagMatch[2].trim();
      if (key === 'ti') title = val;
      else if (key === 'ar') artist = val;
      else if (key === 'al') album = val;
      else if (key === 'offset') {
        const ms = parseFloat(val);
        if (Number.isFinite(ms)) offset = ms / 1000;
      }
      continue;
    }

    // Check for timestamps: [00:12.34] or multiple [00:12.34][00:45.67]
    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim();
      for (const m of matches) {
        const minutes = parseFloat(m[1]);
        const seconds = parseFloat(m[2]);
        const time = Math.max(0, minutes * 60 + seconds + offset);
        lines.push({
          id: `line-${lineId++}`,
          time: Math.round(time * 100) / 100,
          text
        });
      }
    } else {
      // Plain line without timestamps
      lines.push({
        id: `line-${lineId++}`,
        time: 0,
        text: trimmed
      });
    }
  }

  // Sort timed lines chronologically
  const hasTimed = lines.some(l => l.time > 0);
  if (hasTimed) {
    lines.sort((a, b) => a.time - b.time);
  }

  return {
    source: 'Local file',
    sync: hasTimed ? 'line' : 'plain',
    lines: lines.map(l => ({ ...l, time: l.time })),
    plainLyrics: lines.map(l => l.text).join('\n'),
    title,
    artist,
    album,
    offset
  };
}

/**
 * Text decoder helper for ID3 string encodings
 */
function decodeId3String(bytes, encodingByte) {
  if (!bytes || !bytes.length) return '';
  try {
    if (encodingByte === 1) {
      // UTF-16 with BOM
      return new TextDecoder('utf-16').decode(bytes).replace(/\0+$/, '').trim();
    }
    if (encodingByte === 2) {
      // UTF-16BE without BOM
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0+$/, '').trim();
    }
    if (encodingByte === 3) {
      // UTF-8
      return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
    }
    // Default 0: ISO-8859-1
    return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

/**
 * Reads binary audio header and extracts ID3v2 tags (Title, Artist, Album, Lyrics, Artwork)
 */
export async function readAudioMetadata(file) {
  const result = {
    title: '',
    artist: '',
    album: '',
    lyrics: null,
    artwork: ''
  };

  if (!file) return result;

  try {
    // Read first 256 KB which usually holds all ID3v2 or FLAC header metadata
    const buffer = await file.slice(0, 262144).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 1. ID3v2 parsing
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) { // "ID3"
      const version = bytes[3]; // 3 = 2.3, 4 = 2.4, 2 = 2.2
      const tagSize = ((bytes[6] & 0x7f) << 21) |
                      ((bytes[7] & 0x7f) << 14) |
                      ((bytes[8] & 0x7f) << 7) |
                      (bytes[9] & 0x7f);

      const maxPos = Math.min(bytes.length, 10 + tagSize);
      let pos = 10;

      while (pos < maxPos - 10) {
        if (bytes[pos] === 0) break; // padding reached

        let frameId = '';
        let frameSize = 0;

        if (version === 3) {
          frameId = String.fromCharCode(...bytes.subarray(pos, pos + 4));
          frameSize = view.getUint32(pos + 4);
          pos += 10;
        } else if (version === 4) {
          frameId = String.fromCharCode(...bytes.subarray(pos, pos + 4));
          frameSize = ((bytes[pos + 4] & 0x7f) << 21) |
                      ((bytes[pos + 5] & 0x7f) << 14) |
                      ((bytes[pos + 6] & 0x7f) << 7) |
                      (bytes[pos + 7] & 0x7f);
          pos += 10;
        } else {
          // ID3v2.2 (3-char frame IDs, 3-byte size)
          frameId = String.fromCharCode(...bytes.subarray(pos, pos + 3));
          frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
          pos += 6;
        }

        if (frameSize <= 0 || pos + frameSize > maxPos) break;

        const frameBytes = bytes.subarray(pos, pos + frameSize);

        // TIT2 = Title, TT2 in v2.2
        if (frameId === 'TIT2' || frameId === 'TT2') {
          result.title = decodeId3String(frameBytes.subarray(1), frameBytes[0]);
        }
        // TPE1 = Artist, TP1 in v2.2
        else if (frameId === 'TPE1' || frameId === 'TP1') {
          result.artist = decodeId3String(frameBytes.subarray(1), frameBytes[0]);
        }
        // TALB = Album, TAL in v2.2
        else if (frameId === 'TALB' || frameId === 'TAL') {
          result.album = decodeId3String(frameBytes.subarray(1), frameBytes[0]);
        }
        // USLT = Unsynchronized Lyrics
        else if (frameId === 'USLT' || frameId === 'ULT') {
          const encoding = frameBytes[0];
          // Skip language (3 bytes) and descriptor
          let offset = 4;
          if (encoding === 1 || encoding === 2) {
            while (offset < frameBytes.length - 1 && !(frameBytes[offset] === 0 && frameBytes[offset + 1] === 0)) {
              offset += 2;
            }
            offset += 2;
          } else {
            while (offset < frameBytes.length && frameBytes[offset] !== 0) {
              offset++;
            }
            offset++;
          }
          if (offset < frameBytes.length) {
            const rawLyrics = decodeId3String(frameBytes.subarray(offset), encoding);
            if (rawLyrics) {
              result.lyrics = parseLrcText(rawLyrics);
            }
          }
        }
        // COMM = Comments
        else if (frameId === 'COMM' || frameId === 'COM') {
          const encoding = frameBytes[0];
          let offset = 4;
          if (encoding === 1 || encoding === 2) {
            while (offset < frameBytes.length - 1 && !(frameBytes[offset] === 0 && frameBytes[offset + 1] === 0)) offset += 2;
            offset += 2;
          } else {
            while (offset < frameBytes.length && frameBytes[offset] !== 0) offset++;
            offset++;
          }
          if (offset < frameBytes.length) {
            const comment = decodeId3String(frameBytes.subarray(offset), encoding);
            result.comment = comment;
            if (!result.lyrics && comment && (comment.includes('\n') || comment.length > 25)) {
              result.lyrics = parseLrcText(comment);
            }
          }
        }
        // TCON = Genre
        else if (frameId === 'TCON' || frameId === 'TCO') {
          result.genre = decodeId3String(frameBytes.subarray(1), frameBytes[0]);
        }
        // TYER / TDRC = Year
        else if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') {
          result.year = decodeId3String(frameBytes.subarray(1), frameBytes[0]);
        }
        // APIC = Attached picture (Artwork)
        else if ((frameId === 'APIC' || frameId === 'PIC') && !result.artwork) {
          try {
            const encoding = frameBytes[0];
            let offset = 1;
            let mime = 'image/jpeg';
            if (version === 2) {
              // 3-byte image format
              offset = 4;
            } else {
              // Null-terminated MIME string
              let mimeEnd = offset;
              while (mimeEnd < frameBytes.length && frameBytes[mimeEnd] !== 0) mimeEnd++;
              mime = new TextDecoder('iso-8859-1').decode(frameBytes.subarray(offset, mimeEnd)) || 'image/jpeg';
              offset = mimeEnd + 1;
            }
            // Picture type (1 byte, 3 = cover front)
            offset++;
            // Description (null-terminated)
            if (encoding === 1 || encoding === 2) {
              while (offset < frameBytes.length - 1 && !(frameBytes[offset] === 0 && frameBytes[offset + 1] === 0)) {
                offset += 2;
              }
              offset += 2;
            } else {
              while (offset < frameBytes.length && frameBytes[offset] !== 0) offset++;
              offset++;
            }
            if (offset < frameBytes.length) {
              const imgData = frameBytes.subarray(offset);
              const blob = new Blob([imgData], { type: mime });
              result.artwork = URL.createObjectURL(blob);
            }
          } catch {
            /* ignore artwork parse failure */
          }
        }

        pos += frameSize;
      }
    }

    // 2. FLAC Vorbis comment parsing
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) { // "fLaC"
      let pos = 4;
      while (pos < bytes.length - 4) {
        const header = bytes[pos];
        const isLast = (header & 0x80) !== 0;
        const blockType = header & 0x7f;
        const blockSize = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;

        if (pos + blockSize > bytes.length) break;

        // Block 4: VORBIS_COMMENT
        if (blockType === 4) {
          try {
            const commentBlock = bytes.subarray(pos, pos + blockSize);
            const cView = new DataView(commentBlock.buffer, commentBlock.byteOffset, commentBlock.byteLength);
            const vendorLen = cView.getUint32(0, true);
            let cPos = 4 + vendorLen;
            const count = cView.getUint32(cPos, true);
            cPos += 4;

            for (let i = 0; i < count && cPos < commentBlock.length - 4; i++) {
              const len = cView.getUint32(cPos, true);
              cPos += 4;
              if (cPos + len > commentBlock.length) break;
              const entry = new TextDecoder('utf-8').decode(commentBlock.subarray(cPos, cPos + len));
              cPos += len;
              const eq = entry.indexOf('=');
              if (eq > 0) {
                const key = entry.slice(0, eq).toUpperCase();
                const val = entry.slice(eq + 1).trim();
                if (key === 'TITLE' && !result.title) result.title = val;
                else if (key === 'ARTIST' && !result.artist) result.artist = val;
                else if (key === 'ALBUM' && !result.album) result.album = val;
                else if (key === 'GENRE' && !result.genre) result.genre = val;
                else if ((key === 'DATE' || key === 'YEAR') && !result.year) result.year = val;
                else if ((key === 'COMMENT' || key === 'DESCRIPTION') && !result.comment) {
                  result.comment = val;
                  if (!result.lyrics && (val.includes('\n') || val.length > 25)) {
                    result.lyrics = parseLrcText(val);
                  }
                }
                else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !result.lyrics) {
                  result.lyrics = parseLrcText(val);
                }
              }
            }
          } catch {
            /* ignore vorbis comment error */
          }
        }
        // Block 6: PICTURE
        else if (blockType === 6 && !result.artwork) {
          try {
            const pBlock = bytes.subarray(pos, pos + blockSize);
            const pView = new DataView(pBlock.buffer, pBlock.byteOffset, pBlock.byteLength);
            const mimeLen = pView.getUint32(4, false);
            const mime = new TextDecoder('ascii').decode(pBlock.subarray(8, 8 + mimeLen)) || 'image/jpeg';
            let pPos = 8 + mimeLen;
            const descLen = pView.getUint32(pPos, false);
            pPos += 4 + descLen + 16;
            const dataLen = pView.getUint32(pPos, false);
            pPos += 4;
            if (pPos + dataLen <= pBlock.length) {
              const imgData = pBlock.subarray(pPos, pPos + dataLen);
              const blob = new Blob([imgData], { type: mime });
              result.artwork = URL.createObjectURL(blob);
            }
          } catch {
            /* ignore flac picture error */
          }
        }

        if (isLast) break;
        pos += blockSize;
      }
    }

    // 3. MP4 / M4A metadata atoms
    if (bytes.length >= 8 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
      try {
        const atomText = new TextDecoder('iso-8859-1').decode(bytes);
        const findAtom = (name) => {
          const idx = atomText.indexOf(name);
          if (idx < 0) return '';
          const dataIdx = atomText.indexOf('data', idx);
          if (dataIdx > idx && dataIdx < idx + 40 && dataIdx + 12 < bytes.length) {
            const size = view.getUint32(dataIdx - 4);
            const contentLen = size - 16;
            if (contentLen > 0 && dataIdx + 12 + contentLen <= bytes.length) {
              return new TextDecoder('utf-8').decode(bytes.subarray(dataIdx + 12, dataIdx + 12 + contentLen)).trim();
            }
          }
          return '';
        };
        if (!result.title) result.title = findAtom('\xa9nam') || findAtom('nam');
        if (!result.artist) result.artist = findAtom('\xa9ART') || findAtom('ART');
        if (!result.album) result.album = findAtom('\xa9alb') || findAtom('alb');
        if (!result.comment) result.comment = findAtom('\xa9cmt') || findAtom('cmt');
        const m4aLyrics = findAtom('\xa9lyr') || findAtom('lyr');
        if (m4aLyrics && !result.lyrics) {
          result.lyrics = parseLrcText(m4aLyrics);
        }
      } catch {
        /* ignore m4a error */
      }
    }

    // 4. ID3v1 at the tail of the file (last 128 bytes)
    if ((!result.title || !result.artist) && file.size >= 128) {
      try {
        const tailBuf = await file.slice(file.size - 128).arrayBuffer();
        const tailBytes = new Uint8Array(tailBuf);
        if (tailBytes[0] === 0x54 && tailBytes[1] === 0x41 && tailBytes[2] === 0x47) { // "TAG"
          const dec = new TextDecoder('iso-8859-1');
          const cleanV1 = (b, s, len) => dec.decode(b.subarray(s, s + len)).replace(/\0+$/, '').trim();
          if (!result.title) result.title = cleanV1(tailBytes, 3, 30);
          if (!result.artist) result.artist = cleanV1(tailBytes, 33, 30);
          if (!result.album) result.album = cleanV1(tailBytes, 63, 30);
          if (!result.year) result.year = cleanV1(tailBytes, 93, 4);
          if (!result.comment) result.comment = cleanV1(tailBytes, 97, 28);
          if (!result.lyrics && result.comment && (result.comment.includes('\n') || result.comment.length > 20)) {
            result.lyrics = parseLrcText(result.comment);
          }
        }
      } catch {
        /* ignore ID3v1 error */
      }
    }
  } catch {
    /* ignore binary parse errors */
  }

  return result;
}

/**
 * Traverses file system entries (from drag-and-drop folders) recursively
 */
export async function scanEntriesRecursively(entries) {
  const files = [];

  async function traverse(entry) {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise(resolve => {
        entry.file(f => { files.push(f); resolve(); }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readAll = async () => {
        const batch = await new Promise(resolve => {
          reader.readEntries(res => resolve(res || []), () => resolve([]));
        });
        if (batch.length > 0) {
          for (const child of batch) {
            await traverse(child);
          }
          await readAll();
        }
      };
      await readAll();
    }
  }

  for (const item of entries) {
    await traverse(item);
  }

  return files;
}

/**
 * Process a list of uploaded/dropped files:
 * - Filters audio files
 * - Finds and pairs companion .lrc / .txt lyrics files
 * - Finds companion cover image files
 * - Reads ID3v2 / container metadata
 * - Falls back to intelligent filename parsing
 * - Probes audio codec format
 * - Returns ready Swar track objects
 */
export async function processLocalFiles(fileList) {
  const rawList = Array.from(fileList || []);
  if (!rawList.length) return [];

  const audioFiles = [];
  const lyricFiles = new Map(); // baseName -> File
  const imageFiles = new Map(); // baseName -> File

  for (const file of rawList) {
    if (isAudioFile(file)) {
      audioFiles.push(file);
    } else if (isLyricFile(file)) {
      const base = getBaseName(file.name).toLowerCase();
      lyricFiles.set(base, file);
    } else if (IMAGE_EXTS.has(getExtension(file.name))) {
      const base = getBaseName(file.name).toLowerCase();
      imageFiles.set(base, file);
    }
  }

  if (!audioFiles.length) return [];

  // Look for generic folder cover image: cover.jpg, folder.jpg, front.jpg
  let folderCoverUrl = '';
  for (const [name, file] of imageFiles.entries()) {
    if (/^(cover|folder|front|album|art)$/i.test(name)) {
      folderCoverUrl = URL.createObjectURL(file);
      break;
    }
  }

  // Pre-read all companion lyric text files for fast matching
  const parsedCompanionLyrics = new Map();
  for (const [name, file] of lyricFiles.entries()) {
    try {
      const text = await file.text();
      const parsed = parseLrcText(text);
      if (parsed) parsedCompanionLyrics.set(name, parsed);
    } catch {
      /* ignore read error */
    }
  }

  const tracks = [];

  for (const file of audioFiles) {
    const base = getBaseName(file.name).toLowerCase();
    const parsedFilename = parseTrackFromFilename(file.name);

    // 1. Check companion lyrics (.lrc or .txt)
    let matchedLyrics = parsedCompanionLyrics.get(base) || null;

    // Fuzzy matching if exact base not found and only 1 lyric file was uploaded
    if (!matchedLyrics && parsedCompanionLyrics.size === 1 && audioFiles.length === 1) {
      matchedLyrics = parsedCompanionLyrics.values().next().value;
    }

    // 2. Read embedded audio metadata (ID3, Vorbis, MP4)
    const tags = await readAudioMetadata(file).catch(() => ({}));

    // 3. Companion artwork
    let artwork = tags.artwork || '';
    if (!artwork && imageFiles.has(base)) {
      artwork = URL.createObjectURL(imageFiles.get(base));
    }
    if (!artwork && folderCoverUrl) {
      artwork = folderCoverUrl;
    }

    // 4. Resolve title, artist, album
    const title = tags.title || matchedLyrics?.title || parsedFilename.title || getBaseName(file.name);
    const artist = tags.artist || matchedLyrics?.artist || parsedFilename.artist || 'On this device';
    const album = tags.album || matchedLyrics?.album || parsedFilename.album || 'Local audio';

    // 5. Lyrics priority: companion file > embedded ID3 lyrics
    const lyrics = matchedLyrics || tags.lyrics || null;

    // 6. Audio format probe
    const format = await probeFile(file).catch(() => null);

    const localUrl = URL.createObjectURL(file);
    const trackId = `local-${crypto.randomUUID()}`;

    localAudioFilesCache.set(trackId, file);
    localAudioFilesCache.set(localUrl, file);

    tracks.push({
      id: trackId,
      file,
      title,
      artist,
      album,
      artwork,
      duration: 0,
      localUrl,
      lyrics,
      format,
      fileName: file.name,
      fileSize: file.size,
      tags: {
        title,
        artist,
        album,
        fileName: file.name,
        fileSize: file.size,
        fileSizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        comment: tags.comment || '',
        genre: tags.genre || '',
        year: tags.year || '',
        codec: format?.codec || getExtension(file.name).toUpperCase(),
        hasLyrics: Boolean(lyrics),
        lyricsSource: lyrics?.source || (lyrics ? 'Embedded / Local' : 'None')
      }
    });
  }

  return tracks;
}
