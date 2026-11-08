import { useState, useRef, useEffect, useCallback } from 'react';
import { getSupportedAudioMimeType } from '../lib/vocalRecorder';

export function useVocalRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isPlayingTake, setIsPlayingTake] = useState(false);
  const [takeProgress, setTakeProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const streamRef = useRef(null);
  const ownsStreamRef = useRef(false);

  // Clear previous recording URL when replaced or unmounted
  const clearRecording = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setIsPlayingTake(false);
    setTakeProgress(0);
  }, [recordedUrl]);

  // Start recording
  const startRecording = useCallback(async (externalStream = null) => {
    clearRecording();
    audioChunksRef.current = [];

    let stream = externalStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Better vocal dynamics for singing
            autoGainControl: false,
          },
        });
        streamRef.current = stream;
        ownsStreamRef.current = true;
      } catch (err) {
        throw new Error(`Microphone access failed: ${err.message}`);
      }
    } else {
      ownsStreamRef.current = false;
    }

    const mimeType = getSupportedAudioMimeType() || undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.start(250); // Slice chunks every 250ms
    setIsRecording(true);
    setRecordingDuration(0);

    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
  }, [clearRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);

        if (ownsStreamRef.current && streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resolve({ blob, url, duration: recordingDuration });
      };

      recorder.stop();
    });
  }, [recordingDuration]);

  // Playback recorded take
  const playTake = useCallback(() => {
    if (!recordedUrl) return;

    if (!audioPlayerRef.current) {
      const audio = new Audio(recordedUrl);
      audioPlayerRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setTakeProgress(audio.currentTime / audio.duration);
        }
      };

      audio.onended = () => {
        setIsPlayingTake(false);
        setTakeProgress(0);
      };
    }

    audioPlayerRef.current.play().then(() => {
      setIsPlayingTake(true);
    }).catch(() => {
      setIsPlayingTake(false);
    });
  }, [recordedUrl]);

  const pauseTake = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingTake(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (ownsStreamRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    recordedBlob,
    recordedUrl,
    startRecording,
    stopRecording,
    clearRecording,
    playTake,
    pauseTake,
    isPlayingTake,
    takeProgress,
  };
}

