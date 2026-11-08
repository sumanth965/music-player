import React, { useState } from 'react';
import { Play, Pause, Download, Trash2, Mic, Volume2 } from 'lucide-react';
import { formatAudioDuration, getTakeFilename } from '../lib/vocalRecorder';

export default function VocalTakeReview({
  recordedBlob,
  recordedUrl,
  recordingDuration,
  isPlayingTake,
  takeProgress,
  onPlay,
  onPause,
  onClear,
  songTitle = 'Vocal Take',
}) {
  const [downloaded, setDownloaded] = useState(false);

  if (!recordedUrl) return null;

  const handleDownload = () => {
    if (!recordedBlob) return;
    const ext = recordedBlob.type?.includes('mp4') ? 'm4a' : 'webm';
    const filename = getTakeFilename(songTitle, ext);

    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="vocal-review-card">
      <div className="vocal-review-header">
        <div className="vocal-review-badge">
          <Mic size={14} className="vocal-mic-glow" />
          <span>Vocal Take Recorded</span>
        </div>
        <span className="vocal-duration-tag">
          {formatAudioDuration(recordingDuration)}
        </span>
      </div>

      <div className="vocal-review-controls">
        <button
          className="vocal-play-btn"
          onClick={isPlayingTake ? onPause : onPlay}
          title={isPlayingTake ? "Pause Take" : "Play Backing Take"}
          aria-label={isPlayingTake ? "Pause" : "Play"}
        >
          {isPlayingTake ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <div className="vocal-progress-track">
          <div
            className="vocal-progress-fill"
            style={{ width: `${Math.min(100, (takeProgress || 0) * 100)}%` }}
          />
        </div>

        <div className="vocal-review-actions">
          <button
            className="vocal-action-btn"
            onClick={handleDownload}
            title="Download Vocal Audio Take"
          >
            <Download size={15} />
            <span>{downloaded ? 'Saved!' : 'Save'}</span>
          </button>
          <button
            className="vocal-action-btn is-danger"
            onClick={onClear}
            title="Discard Take"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

