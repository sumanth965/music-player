import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  FileAudio,
  Tag,
  Upload,
  Sparkles,
  Check,
  Copy,
  Mic,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { transcribeSongAudio } from "../lib/audioTranscription";
import { getAudioFileForTrack } from "../lib/localAudioMetadata";
import { buildApiUrl } from "../lib/api";

export default function SongTextData({ player, onClose }) {
  const track = player.track;
  const tags = track?.tags || {};
  const [pasting, setPasting] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [expandTranscript, setExpandTranscript] = useState(true);
  const [localTranscribing, setLocalTranscribing] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const [transcribeError, setTranscribeError] = useState("");
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [customTitle, setCustomTitle] = useState(track?.title || "");
  const [customArtist, setCustomArtist] = useState(track?.artist || "");
  const [showCustomSearch, setShowCustomSearch] = useState(false);
  const lrcInputRef = useRef(null);
  const hasAttemptedFetch = useRef(new Set());

  useEffect(() => {
    if (track) {
      setCustomTitle(track.title || "");
      setCustomArtist(track.artist || "");
    }
  }, [track?.id, track?.title, track?.artist]);

  const handleFetchOnlineLyrics = useCallback(async (isManual = false, overrideTitle, overrideArtist) => {
    if (!track) return;
    setIsFetchingLyrics(true);
    setTranscribeError("");

    try {
      const rawTitle = (overrideTitle !== undefined ? overrideTitle : track.title) || "";
      const rawArtist = (overrideArtist !== undefined ? overrideArtist : track.artist) || "";
      const videoId = track.videoId || "";
      const duration = track.duration || 0;

      // Extract cleaned title candidates to maximize hit-rate on server:
      // 1. Full original title
      // 2. First segment before "|" (e.g. "Bollywood New Hit Songs | Hindi Songs..." -> "Bollywood New Hit Songs")
      // 3. Segment after "-" (e.g. "Artist - Song Title" -> "Song Title")
      // 4. Title with common video decoration stripped
      const candidates = [
        rawTitle,
        rawTitle.split(/\s*\|\s*/)[0]?.trim(),
        rawTitle.split(/\s*[-–—]\s*/).slice(1).join(" - ").trim(),
        rawTitle.replace(/\s*[([](?:official|music|video|audio|lyrics?|jukebox|remix|hd|4k)[^)\]]*[)\]]/gi, "").trim(),
      ].filter((t, idx, arr) => t && arr.indexOf(t) === idx);

      let found = null;
      for (const candidateTitle of candidates) {
        try {
          const res = await fetch(
            buildApiUrl("/api/lyrics/structured", {
              title: candidateTitle,
              artist: rawArtist,
              duration,
              videoId,
            })
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.lines && data.lines.length > 0) {
              found = data;
              break;
            }
          }
        } catch {
          // Continue to next candidate
        }
      }

      if (found && found.lines && found.lines.length > 0) {
        track.lyrics = found;
        player.applyLyrics?.(found);
        if (onClose) onClose();
      } else if (isManual) {
        setTranscribeError(
          "No synchronized text found in online databases for this title. Click 'Transcribe with Swar AI' to listen and generate lyrics automatically."
        );
      }
    } catch (err) {
      if (isManual) {
        setTranscribeError(err.message || "Could not fetch lyrics from server.");
      }
    } finally {
      setIsFetchingLyrics(false);
    }
  }, [track, player, onClose]);

  // Attempt automatic online lyrics lookup when mounting for a song without lyrics
  useEffect(() => {
    if (!track) return;
    const key = `${track.id || track.title}:${track.artist}`;
    if (!track.lyrics?.lines?.length && !track.songText && !hasAttemptedFetch.current.has(key)) {
      hasAttemptedFetch.current.add(key);
      handleFetchOnlineLyrics(false);
    }
  }, [track, handleFetchOnlineLyrics]);

  if (!track) return null;

  const isTranscribing = Boolean(player.isTranscribingAudio || localTranscribing);
  const transcriptionStatus = player.transcriptionStatus || localStatus;
  const transcriptText =
    track.songText ||
    track.transcript ||
    player.lyrics?.transcript ||
    (player.lyrics?.lines?.length > 0
      ? player.lyrics.lines.map((l) => l.text).join("\n")
      : "");

  const handleLrcFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      player.applyLyrics?.(text);
    } catch {
      /* ignore read error */
    }
    e.target.value = "";
  };

  const handleApplyPaste = () => {
    if (pastedText.trim()) {
      player.applyLyrics?.(pastedText);
      setPasting(false);
      setPastedText("");
    }
  };

  const handleTranscribeClick = async () => {
    setTranscribeError("");
    setLocalTranscribing(true);
    setLocalStatus("Accessing audio track...");

    try {
      if (typeof player.transcribeTrackAudio === "function") {
        const res = await player.transcribeTrackAudio(track, true);
        if (res && res.lines?.length) return;
      }

      // Direct fallback
      setLocalStatus("Preparing audio file for AI Whisper...");
      const file = await getAudioFileForTrack(track);
      if (!file) {
        // If it's a streaming online video without local audio file, trigger server lyrics fetch
        await handleFetchOnlineLyrics(true);
        return;
      }

      setLocalStatus("Transcribing via Swar AI Whisper on server...");
      const result = await transcribeSongAudio(file, {
        onProgress: (msg) => setLocalStatus(msg),
      });

      if (result && result.lines?.length) {
        track.songText = result.transcript;
        track.transcript = result.transcript;
        track.lyrics = result;
        player.applyLyrics?.(result);
      } else {
        throw new Error("AI Whisper finished but found no speech in this audio track.");
      }
    } catch (err) {
      console.error("[SongTextData] Transcription error:", err);
      setTranscribeError(err.message || "Failed to transcribe audio.");
    } finally {
      setLocalTranscribing(false);
      setLocalStatus("");
    }
  };

  const facts = [
    { label: "Title", value: track.title || tags.title || "—" },
    { label: "Artist", value: track.artist || tags.artist || "On this device" },
    { label: "Album", value: track.album || tags.album || "Local audio" },
    { label: "File name", value: tags.fileName || track.fileName || "—" },
    {
      label: "File size",
      value:
        tags.fileSizeFormatted ||
        (track.fileSize ? `${(track.fileSize / (1024 * 1024)).toFixed(2)} MB` : "—"),
    },
    { label: "Format / Codec", value: tags.codec || track.format?.codec || "Audio" },
    tags.quality && { label: "Quality Specs", value: tags.quality },
    tags.genre && { label: "Genre", value: tags.genre },
    tags.year && { label: "Year", value: tags.year },
    tags.comment && { label: "Comment / Notes", value: tags.comment },
  ].filter(Boolean);

  const copyMetadata = () => {
    const text = facts.map((f) => `${f.label}: ${f.value}`).join("\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTranscript = () => {
    if (!transcriptText) return;
    navigator.clipboard?.writeText(transcriptText);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  return (
    <div className="song-text-data-container">
      {/* Header */}
      <div className="song-text-data-header">
        <div className="song-text-data-badge">
          <FileText size={14} />
          <span>Swar Song Text & Audio Transcription</span>
        </div>
        <div className="header-actions">
          <button
            className="secondary-pill-button sm-btn"
            onClick={() => handleFetchOnlineLyrics(true)}
            disabled={isFetchingLyrics}
            title="Fetch lyrics from Swar server API"
          >
            <RefreshCw size={13} className={isFetchingLyrics ? "spin" : ""} />
            <span>{isFetchingLyrics ? "Searching..." : "Fetch Lyrics"}</span>
          </button>
          <button
            className="copy-meta-btn"
            onClick={copyMetadata}
            title="Copy song metadata to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy details"}</span>
          </button>
        </div>
      </div>

      {/* Song Hero Info */}
      <div className="song-text-data-hero">
        <div className="song-text-data-icon">
          <FileAudio size={32} />
        </div>
        <div className="song-text-data-titles">
          <h3>{track.title || "Unknown Title"}</h3>
          <p>
            {track.artist || "On this device"}
            {track.album ? ` · ${track.album}` : ""}
          </p>
        </div>
      </div>

      {/* Search Alternative / Clean Song Title Card */}
      <div className="custom-search-container" style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowCustomSearch(!showCustomSearch)}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Search size={16} style={{ color: "var(--accent, #ea580c)" }} />
            <strong style={{ fontSize: "14px", color: "var(--text-primary, #ffffff)" }}>Fix Mismatched Lyrics (Search by Exact Title & Artist)</strong>
          </div>
          <button type="button" className="collapse-toggle-btn" style={{ background: "transparent", border: 0, color: "var(--accent, #ea580c)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
            {showCustomSearch ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showCustomSearch ? "Close" : "Search Alternative"}</span>
          </button>
        </div>
        {showCustomSearch && (
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "12.5px", color: "var(--text-secondary, #b3a598)", lineHeight: "1.5" }}>
              If the YouTube video title contains extra text (e.g. &ldquo;Official 4K Video&rdquo;, &ldquo;Lyrics&rdquo;, &ldquo;Remix&rdquo;, or channel names), type the clean song name and singer below to fetch the exact verified lyrics:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px" }}>
              <input
                type="text"
                placeholder="Song Title (e.g. Perfect)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#ffffff",
                  fontSize: "13px"
                }}
              />
              <input
                type="text"
                placeholder="Artist Name (e.g. Ed Sheeran)"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#ffffff",
                  fontSize: "13px"
                }}
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => handleFetchOnlineLyrics(true, customTitle, customArtist)}
                disabled={isFetchingLyrics || !customTitle.trim()}
                style={{ padding: "8px 18px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {isFetchingLyrics ? <RefreshCw size={13} className="spin" /> : <Search size={13} />}
                <span>Search</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Audio-to-Text Transcription Section */}
      <div className="transcription-card">
        <div className="transcription-card-header">
          <div className="transcription-card-title">
            <Mic size={16} className="mic-accent" />
            <h4>Swar AI Audio-to-Text Transcription</h4>
          </div>
          {transcriptText && (
            <div className="transcription-card-actions">
              <button
                className="secondary-pill-button sm-btn"
                onClick={copyTranscript}
                title="Copy full transcribed song text"
              >
                {copiedTranscript ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedTranscript ? "Copied Text" : "Copy Song Text"}</span>
              </button>
              <button
                className="secondary-pill-button sm-btn"
                onClick={handleTranscribeClick}
                disabled={isTranscribing}
                title="Re-run AI audio transcription"
              >
                <RefreshCw size={13} className={isTranscribing ? "spin" : ""} />
                <span>Re-transcribe</span>
              </button>
            </div>
          )}
        </div>

        {isTranscribing ? (
          <div className="transcribing-box">
            <div className="pulse-loader">
              <Sparkles size={24} className="spin-slow" />
            </div>
            <div className="transcribing-text">
              <h5>Listening to audio track…</h5>
              <p>{transcriptionStatus || "Generating synchronized lyrics with Swar AI Whisper"}</p>
            </div>
          </div>
        ) : transcriptText ? (
          <div className="transcript-display-box">
            <div className="transcript-meta-row">
              <span className="transcript-badge">
                {player.lyrics?.language ? `Language: ${player.lyrics.language}` : "Detected Speech"}
              </span>
              <span className="transcript-badge">
                {player.lyrics?.lines?.length || 0} lines ·{" "}
                {player.lyrics?.sync === "word" ? "Word-level sync" : "Line sync"}
              </span>
              <button
                className="collapse-toggle-btn"
                onClick={() => setExpandTranscript(!expandTranscript)}
              >
                {expandTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{expandTranscript ? "Collapse" : "Expand"}</span>
              </button>
            </div>

            {expandTranscript && (
              <div className="transcript-text-content">
                {player.lyrics?.lines?.length > 0 ? (
                  <div className="transcript-lines-list">
                    {player.lyrics.lines.map((line, idx) => (
                      <div key={line.id || idx} className="transcript-line-item">
                        <span className="transcript-timestamp">
                          {formatTimestamp(line.time || 0)}
                        </span>
                        <span className="transcript-line-text">{line.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="raw-transcript-pre">{transcriptText}</pre>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="transcription-empty-box">
            <p>
              No lyrics synchronized for this track yet. Swar AI Whisper transcribes sung words
              directly from the audio track using the server's cloud engine.
            </p>
            {transcribeError && (
              <div className="transcription-error-badge">
                <span>⚠️ {transcribeError}</span>
              </div>
            )}
            <div className="empty-box-actions" style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
              <button
                className="primary-button transcribe-action-btn"
                onClick={handleTranscribeClick}
                disabled={isTranscribing}
              >
                <Sparkles size={16} />
                <span>Transcribe with Swar AI</span>
              </button>
              <button
                className="secondary-pill-button"
                onClick={() => handleFetchOnlineLyrics(true)}
                disabled={isFetchingLyrics}
              >
                <Search size={15} className={isFetchingLyrics ? "spin" : ""} />
                <span>{isFetchingLyrics ? "Searching Server..." : "Search Server Lyrics"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Facts Grid */}
      <div className="song-text-data-grid">
        {facts.map((fact) => (
          <div key={fact.label} className="song-text-data-row">
            <span className="data-label">{fact.label}</span>
            <span className="data-value">{fact.value}</span>
          </div>
        ))}
      </div>

      {/* Companion or Manual Lyrics Actions */}
      <div className="song-text-data-actions">
        <input
          ref={lrcInputRef}
          type="file"
          accept=".lrc,.txt,.srt"
          hidden
          onChange={handleLrcFile}
        />
        <button
          className="secondary-pill-button"
          onClick={() => lrcInputRef.current?.click()}
        >
          <Upload size={15} />
          <span>Attach .LRC / .TXT File</span>
        </button>
        <button
          className="secondary-pill-button"
          onClick={() => setPasting(!pasting)}
        >
          <Tag size={15} />
          <span>{pasting ? "Cancel" : "Paste Song Text / Lyrics"}</span>
        </button>
      </div>

      {pasting && (
        <div className="paste-lyrics-box">
          <textarea
            placeholder="Paste your song lyrics, timestamps, or text data here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={5}
          />
          <button
            className="primary-button"
            onClick={handleApplyPaste}
            disabled={!pastedText.trim()}
          >
            <Sparkles size={15} />
            <span>Apply Text as Lyrics</span>
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s < 10 ? "0" : ""}${s}.${ms}`;
}
