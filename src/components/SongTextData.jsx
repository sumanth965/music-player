import React, { useState, useRef } from "react";
import {
  FileText,
  FileAudio,
  Tag,
  Upload,
  Sparkles,
  Check,
  Copy,
  Mic,
  Key,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getGroqApiKey, setGroqApiKey, transcribeSongAudio } from "../lib/audioTranscription";
import { getAudioFileForTrack } from "../lib/localAudioMetadata";

export default function SongTextData({ player }) {
  const track = player.track;
  const tags = track?.tags || {};
  const [pasting, setPasting] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [customKey, setCustomKey] = useState(() => getGroqApiKey());
  const [keySaved, setKeySaved] = useState(false);
  const [expandTranscript, setExpandTranscript] = useState(true);
  const [localTranscribing, setLocalTranscribing] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const [transcribeError, setTranscribeError] = useState("");
  const lrcInputRef = useRef(null);

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
        throw new Error("Could not access the raw audio file. Please re-upload or select the audio file.");
      }

      setLocalStatus("Transcribing with Groq AI Whisper (whisper-large-v3)...");
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

  const handleSaveApiKey = () => {
    setGroqApiKey(customKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
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
          <span>Song Text Data & Audio Transcription</span>
        </div>
        <div className="header-actions">
          <button
            className="secondary-pill-button sm-btn"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            title="Configure AI Whisper Transcription Settings"
          >
            <Key size={13} />
            <span>AI Model Key</span>
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

      {/* AI Key Configuration Drawer */}
      {showKeyConfig && (
        <div className="api-config-drawer">
          <div className="api-config-row">
            <span className="api-config-label">Groq Cloud Whisper API Key</span>
            <input
              type="password"
              placeholder="gsk_..."
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="api-config-input"
            />
            <button className="primary-pill-button sm-btn" onClick={handleSaveApiKey}>
              {keySaved ? <Check size={13} /> : <Sliders size={13} />}
              <span>{keySaved ? "Saved" : "Save"}</span>
            </button>
          </div>
          <p className="api-config-tip">
            Default uses Groq’s <code>whisper-large-v3</code> cloud engine. If a local LyricSense Python
            backend is running on port 8000, it automatically connects to it as well.
          </p>
        </div>
      )}

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

      {/* AI Audio-to-Text Transcription Section */}
      <div className="transcription-card">
        <div className="transcription-card-header">
          <div className="transcription-card-title">
            <Mic size={16} className="mic-accent" />
            <h4>AI Audio-to-Text Transcription</h4>
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
              <h5>Listening to audio waveform…</h5>
              <p>{transcriptionStatus || "Generating word-timed lyrics with AI Whisper"}</p>
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
              No text fetched from this song yet. Run AI Whisper to listen directly to the audio
              track and transcribe sung words into synchronized lyrics.
            </p>
            {transcribeError && (
              <div className="transcription-error-badge">
                <span>⚠️ {transcribeError}</span>
              </div>
            )}
            <button
              className="primary-button transcribe-action-btn"
              onClick={handleTranscribeClick}
              disabled={isTranscribing}
            >
              <Sparkles size={16} />
              <span>Transcribe Song Audio to Text</span>
            </button>
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
