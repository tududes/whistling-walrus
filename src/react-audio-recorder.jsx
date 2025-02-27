import React, { useState, useRef, useEffect } from 'react';
// Import Lucide icons properly
import { Mic, Square, Play, Pause, Share2, Clock, Save, Trash2, List, Info, ExternalLink, Check } from 'lucide-react';
// Import custom WalrusIcon
import WalrusIcon from './WalrusIcon';
// Import react-audio-visualize components
import { AudioVisualizer, LiveAudioVisualizer } from 'react-audio-visualize';

// Configuration for Walrus endpoints
const WALRUS_PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";
const DEFAULT_STORAGE_EPOCHS = 10; // Number of epochs to store the recording

/**
 * @typedef {Object} Recording
 * @property {string} id
 * @property {string} name
 * @property {number} duration
 * @property {string} timestamp
 * @property {string} timestampWithTZ
 * @property {string} blobId
 * @property {string} mediaType
 */

/**
 * @typedef {Object} StorageInfo
 * @property {Object} info
 * @property {Object} [info.newlyCreated]
 * @property {Object} [info.newlyCreated.blobObject]
 * @property {string} [info.newlyCreated.blobObject.blobId]
 * @property {Object} [info.alreadyCertified]
 * @property {string} [info.alreadyCertified.blobId]
 * @property {string} [media_type]
 */

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Add state for blockchain response data
  const [blockchainData, setBlockchainData] = useState(null);
  // Add state to control the visibility of the blockchain data panel
  const [showBlockchainData, setShowBlockchainData] = useState(false);
  // Add state for toast notification
  const [toast, setToast] = useState({ visible: false, message: '' });
  // Add loading state for blob fetching
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  // Add a new state variable to track when we have a valid blobId
  const [currentBlobId, setCurrentBlobId] = useState("");
  // Add state for recording title
  const [recordingTitle, setRecordingTitle] = useState("");

  // Add array of placeholder suggestions
  const titlePlaceholders = [
    "Sonic Tusk Masterpiece",
    "Walrus Whistle Symphony",
    "Tusked Tune #1",
    "Aquatic Aria",
    "Blubber Beat Remix",
    "Whistling Walrus Wonders",
    "Ocean Wave Opus",
    "Arctic Anthem",
    "Tusk Talk Episode 42"
  ];

  // Add state for current placeholder
  const [currentPlaceholder, setCurrentPlaceholder] = useState("");

  // Function to randomly select a placeholder
  const getRandomPlaceholder = () => {
    const randomIndex = Math.floor(Math.random() * titlePlaceholders.length);
    return titlePlaceholders[randomIndex];
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(new Audio());
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // We'll keep these refs for compatibility with existing code
  const canvasRef = useRef(null);
  const recordingCanvasRef = useRef(null);
  const playbackCanvasRef = useRef(null);

  // For recording visualization
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  // Maximum recording time (30 minutes in seconds)
  const MAX_RECORDING_TIME = 30 * 60;

  // For simulating visualization during playback
  const playbackVisualizationTimerRef = useRef(null);

  // Add a ref for the MediaRecorder stream
  const mediaRecorderStreamRef = useRef(null);

  // Add state for current playback time
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  useEffect(() => {
    // Load recordings from localStorage on component mount
    const savedRecordings = localStorage.getItem('recordings');
    if (savedRecordings) {
      setRecordings(JSON.parse(savedRecordings));
    }

    // Initialize random placeholder
    setCurrentPlaceholder(getRandomPlaceholder());

    // Set up event listeners for audio playback
    const handleAudioEnd = () => {
      setIsPlaying(false);
    };

    // Add event listener for loadedmetadata to get audio duration
    const handleLoadedMetadata = () => {
      if (audioRef.current && audioRef.current.duration) {
        // Round to nearest second for consistency with recording timer
        const durationInSeconds = Math.round(audioRef.current.duration);
        setRecordingTime(durationInSeconds);
        console.log("Audio duration loaded:", durationInSeconds);
      }
    };

    audioRef.current.addEventListener('ended', handleAudioEnd);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      // Clean up timer and audio listeners on component unmount
      if (timerRef.current) clearInterval(timerRef.current);
      audioRef.current.removeEventListener('ended', handleAudioEnd);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);

      // Clean up audio resources
      // Remove this call to the deleted function
      // stopPlaybackVisualization();

      // Release any media streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error("Error closing audio context:", err));
        audioContextRef.current = null;
      }

      // Release audio element
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
        audioRef.current.load();
      }
    };
  }, []);

  // Add useEffect to update currentPlaybackTime during playback
  useEffect(() => {
    let playbackTimer;

    if (isPlaying) {
      // Update currentPlaybackTime every 100ms during playback
      playbackTimer = setInterval(() => {
        setCurrentPlaybackTime(audioRef.current.currentTime || 0);
      }, 100);
    }

    return () => {
      if (playbackTimer) {
        clearInterval(playbackTimer);
      }
    };
  }, [isPlaying]);

  // Save recordings to localStorage whenever recordings state changes
  useEffect(() => {
    localStorage.setItem('recordings', JSON.stringify(recordings));
  }, [recordings]);

  // Clean up all audio resources
  const cleanupAudioResources = async () => {
    // Cancel any animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear any intervals
    if (playbackVisualizationTimerRef.current) {
      clearInterval(playbackVisualizationTimerRef.current);
      playbackVisualizationTimerRef.current = null;
    }

    // Disconnect and clean up audio nodes
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (error) {
        console.error("Error disconnecting source:", error);
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (error) {
        console.error("Error disconnecting analyser:", error);
      }
      analyserRef.current = null;
    }

    // Close audio context if it exists
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        await audioContextRef.current.close();
      } catch (error) {
        console.error("Error closing audio context:", error);
      }
      audioContextRef.current = null;
    }

    // Clean up audio element
    if (audioRef.current) {
      if (audioRef.current.src) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
        audioRef.current.load();
      }
    }
  };

  // Add a specialized function to analyze WebM files
  const analyzeWebMBlob = async (blob) => {
    try {
      console.log("--- WebM Analysis ---");

      // Read the entire blob as an ArrayBuffer
      const buffer = await blob.arrayBuffer();
      const view = new Uint8Array(buffer);

      // WebM is based on EBML (Extensible Binary Meta Language)
      // We'll look for some common EBML elements

      // Check for EBML header (0x1A 0x45 0xDF 0xA3)
      if (!(view[0] === 0x1A && view[1] === 0x45 && view[2] === 0xDF && view[3] === 0xA3)) {
        console.log("Not a valid WebM file (missing EBML header)");
        return;
      }

      console.log("Valid WebM file with EBML header detected");

      // Convert part of the buffer to a string to search for codec info
      const headerStr = new TextDecoder().decode(view.slice(0, 500));

      // Look for common WebM elements and codecs
      if (headerStr.includes("OPUS")) {
        console.log("Audio codec: Opus");
      } else if (headerStr.includes("Vorbis")) {
        console.log("Audio codec: Vorbis");
      }

      if (headerStr.includes("VP8")) {
        console.log("Video codec: VP8");
      } else if (headerStr.includes("VP9")) {
        console.log("Video codec: VP9");
      }

      // Check for audio track info
      if (headerStr.includes("Audio")) {
        console.log("Contains audio track");
      }

      // Check for video track info
      if (headerStr.includes("Video")) {
        console.log("Contains video track");
      }

      // Try to extract sampling rate and channels if present
      const samplingRateMatch = headerStr.match(/SamplingFrequency[^\d]+(\d+)/);
      if (samplingRateMatch && samplingRateMatch[1]) {
        console.log("Sampling rate:", samplingRateMatch[1], "Hz");
      }

      const channelsMatch = headerStr.match(/Channels[^\d]+(\d+)/);
      if (channelsMatch && channelsMatch[1]) {
        console.log("Channels:", channelsMatch[1]);
      }

      // Dump some key byte positions for debugging
      console.log("Key byte positions:");

      // Look for the Segment element (0x18 0x53 0x80 0x67)
      for (let i = 4; i < Math.min(100, view.length - 4); i++) {
        if (view[i] === 0x18 && view[i + 1] === 0x53 && view[i + 2] === 0x80 && view[i + 3] === 0x67) {
          console.log("  Segment element at position:", i);
          break;
        }
      }

      // Look for the Tracks element (0x16 0x54 0xAE 0x6B)
      for (let i = 4; i < Math.min(500, view.length - 4); i++) {
        if (view[i] === 0x16 && view[i + 1] === 0x54 && view[i + 2] === 0xAE && view[i + 3] === 0x6B) {
          console.log("  Tracks element at position:", i);
          break;
        }
      }

      // Look for the Cluster element (0x1F 0x43 0xB6 0x75)
      for (let i = 4; i < Math.min(1000, view.length - 4); i++) {
        if (view[i] === 0x1F && view[i + 1] === 0x43 && view[i + 2] === 0xB6 && view[i + 3] === 0x75) {
          console.log("  First Cluster element at position:", i);
          break;
        }
      }

      console.log("--- End WebM Analysis ---");
    } catch (error) {
      console.error("Error analyzing WebM blob:", error);
    }
  };

  // Enhance the helper function to dump blob data to the console with more detailed format analysis
  const dumpBlobData = async (blob, label = "Blob Data") => {
    try {
      console.log(`--- ${label} ---`);
      console.log("Blob type:", blob.type);
      console.log("Blob size:", blob.size, "bytes");

      // Read the first part of the blob to check for metadata
      const firstChunk = await blob.slice(0, 1000).text();
      console.log("First 1000 bytes:", firstChunk);

      // Check for JSON metadata at the beginning
      const firstLineEnd = firstChunk.indexOf('\n');
      if (firstLineEnd > 0) {
        const metadataStr = firstChunk.substring(0, firstLineEnd);
        try {
          const metadata = JSON.parse(metadataStr);
          console.log("Extracted JSON metadata:", metadata);
        } catch (jsonError) {
          console.log("No valid JSON metadata found in the blob:", jsonError.message);
        }
      }

      // Create a FileReader to read the blob as an ArrayBuffer for format detection
      const bufferReader = new FileReader();
      bufferReader.onload = async (e) => {
        const buffer = e.target.result;
        const view = new Uint8Array(buffer);

        // Check for common audio format signatures
        let formatInfo = "Unknown format";
        let isWebM = false;

        // WebM format detection (starts with 0x1A 0x45 0xDF 0xA3)
        if (view[0] === 0x1A && view[1] === 0x45 && view[2] === 0xDF && view[3] === 0xA3) {
          formatInfo = "WebM container format (likely with Opus or Vorbis audio)";
          console.log("Format detected:", formatInfo);
          isWebM = true;

          // Look for codec info in the WebM header
          const headerStr = new TextDecoder().decode(view.slice(0, 100));
          if (headerStr.includes("OPUS")) {
            console.log("Audio codec: Opus");
          } else if (headerStr.includes("Vorbis")) {
            console.log("Audio codec: Vorbis");
          }

          // Perform detailed WebM analysis
          await analyzeWebMBlob(blob);
        }
        // MP3 format detection (starts with ID3 or 0xFF 0xFB)
        else if (
          (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) || // ID3
          (view[0] === 0xFF && (view[1] & 0xE0) === 0xE0) // MPEG frame sync
        ) {
          formatInfo = "MP3 format";
          console.log("Format detected:", formatInfo);
        }
        // WAV format detection (RIFF header)
        else if (
          view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 && // "RIFF"
          view[8] === 0x57 && view[9] === 0x41 && view[10] === 0x56 && view[11] === 0x45 // "WAVE"
        ) {
          formatInfo = "WAV format";
          console.log("Format detected:", formatInfo);
        }
        // Ogg format detection
        else if (view[0] === 0x4F && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53) {
          formatInfo = "Ogg container format";
          console.log("Format detected:", formatInfo);
        } else {
          console.log("Format detection: No standard audio format signature found");
        }

        // Dump the first 20 bytes as hex for debugging
        let hexDump = "First 20 bytes (hex): ";
        for (let i = 0; i < Math.min(20, view.length); i++) {
          hexDump += view[i].toString(16).padStart(2, '0') + ' ';
        }
        console.log(hexDump);
      };

      // Read the blob as an ArrayBuffer for format detection
      bufferReader.readAsArrayBuffer(blob.slice(0, 100));

      // Create a FileReader to read the blob as text
      const textReader = new FileReader();
      textReader.onload = (e) => {
        // Get the first 100 characters of the content for preview
        const content = e.target.result;
        const preview = content.length > 100 ? content.substring(0, 100) + "..." : content;
        console.log("Content preview:", preview);

        // Try to detect if it's binary data
        const isBinary = /[\x00-\x08\x0E-\x1F]/.test(preview);
        console.log("Is binary data:", isBinary);
      };

      // Read a small slice of the blob as text
      textReader.readAsText(blob.slice(0, 200));

      // If the blob is an audio file, try to get its duration
      if (blob.type.startsWith('audio/') || blob.size > 1000) {
        try {
          const tempAudio = new Audio();
          tempAudio.onloadedmetadata = () => {
            console.log("Audio duration from browser:", tempAudio.duration, "seconds");
            URL.revokeObjectURL(tempAudio.src);
          };
          tempAudio.onerror = () => {
            console.log("Browser couldn't load audio for duration detection");
            URL.revokeObjectURL(tempAudio.src);
          };
          tempAudio.src = URL.createObjectURL(blob);
        } catch (audioError) {
          console.log("Error creating audio element for duration detection:", audioError);
        }
      }

      console.log(`--- End ${label} ---`);
    } catch (error) {
      console.error("Error dumping blob data:", error);
    }
  };

  // Add a function to get the duration of an audio blob
  const getAudioDuration = (blob) => {
    return new Promise((resolve, reject) => {
      try {
        // First check if this is a blob with metadata
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            // Check if the blob starts with JSON metadata
            const text = e.target.result;
            const firstLineEnd = text.indexOf('\n');

            if (firstLineEnd > 0) {
              const metadataStr = text.substring(0, firstLineEnd);
              try {
                const metadata = JSON.parse(metadataStr);
                if (metadata && metadata.duration && isFinite(metadata.duration)) {
                  // If we have duration in metadata, use it
                  console.log("Using duration from metadata:", metadata.duration);
                  resolve(metadata.duration);
                  return;
                }
              } catch (jsonError) {
                // Not valid JSON, continue to audio duration extraction
                console.log("No valid JSON metadata found for duration");
              }
            }

            // If we don't have metadata or it doesn't have duration, use the audio element
            // Create a temporary audio element
            const tempAudio = new Audio();

            // Set up event listeners
            tempAudio.addEventListener('loadedmetadata', () => {
              // Get the duration and clean up
              const duration = tempAudio.duration;

              // Check if duration is valid
              if (duration && isFinite(duration)) {
                const roundedDuration = Math.round(duration);
                console.log("Got audio duration from element:", roundedDuration);
                URL.revokeObjectURL(tempAudio.src);
                resolve(roundedDuration);
              } else {
                // If duration is invalid (Infinity, NaN), use a fallback value
                console.log("Invalid duration from audio element, using fallback");
                URL.revokeObjectURL(tempAudio.src);
                resolve(0); // Use 0 as a fallback
              }
            });

            tempAudio.addEventListener('error', (err) => {
              console.error("Error loading audio for duration:", err);
              URL.revokeObjectURL(tempAudio.src);
              // Use a fallback value instead of rejecting
              resolve(0);
            });

            // Load the blob
            const audioUrl = URL.createObjectURL(blob);
            tempAudio.src = audioUrl;
            tempAudio.preload = 'metadata';

            // Set a timeout in case the metadata never loads
            setTimeout(() => {
              if (!tempAudio.duration || !isFinite(tempAudio.duration)) {
                console.log("Timeout waiting for duration, using fallback");
                URL.revokeObjectURL(tempAudio.src);
                resolve(0); // Use 0 as a fallback
              }
            }, 3000); // 3 second timeout
          } catch (error) {
            console.error("Error in duration extraction:", error);
            resolve(0); // Use 0 as a fallback instead of rejecting
          }
        };

        reader.onerror = () => {
          console.error("Error reading blob for duration");
          resolve(0); // Use 0 as a fallback instead of rejecting
        };

        // Read the first 1000 bytes to check for metadata
        reader.readAsText(blob.slice(0, 1000));
      } catch (error) {
        console.error("Error in getAudioDuration:", error);
        resolve(0); // Use 0 as a fallback instead of rejecting
      }
    });
  };

  // Modify loadRecording to dump blob data
  const loadRecording = async (blobId, shouldFetchBlob = false) => {
    try {
      console.log("Loading recording:", blobId);
      setErrorMessage("");
      // Set loading state to true
      setIsLoadingBlob(true);

      // Set the current blobId
      setCurrentBlobId(blobId);

      // Stop current playback if any
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      console.log("Stopped current playback");

      // Clean up audio resources
      await cleanupAudioResources();
      console.log("Cleaned up audio resources");

      // Reset audioBlob when loading a new recording
      setAudioBlob(null);

      // Store the blobId for later use
      // This is a key change - we're not fetching the blob immediately
      if (!shouldFetchBlob) {
        // Just update the URL hash and set loading to false
        window.location.hash = blobId;

        // Update share link using hash format
        const shareUrl = `${window.location.origin}/#${blobId}`;
        setShareLink(shareUrl);

        // Set loading state to false
        setIsLoadingBlob(false);
        return;
      }

      // Only fetch the blob if shouldFetchBlob is true
      console.log("Fetching recording from Walrus");
      const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`);

      if (response.ok) {
        console.log("Successfully fetched recording");
        const blob = await response.blob();

        // Dump blob data to console
        await dumpBlobData(blob, `Fetched Blob (${blobId})`);

        // Try to extract metadata from the blob
        let title = null;
        let duration = null;
        let audioOnlyBlob = blob;

        try {
          // Read the first part of the blob to check for metadata
          const firstChunk = await blob.slice(0, 1000).text();
          const firstLineEnd = firstChunk.indexOf('\n');

          if (firstLineEnd > 0) {
            const metadataStr = firstChunk.substring(0, firstLineEnd);
            try {
              const metadata = JSON.parse(metadataStr);
              console.log("Extracted metadata:", metadata);

              // Extract title
              if (metadata && metadata.title) {
                title = metadata.title;
                console.log("Extracted title from metadata:", title);
                // Set the recording title
                setRecordingTitle(title);
              }

              // Extract duration
              if (metadata && metadata.duration && isFinite(metadata.duration)) {
                duration = metadata.duration;
                console.log("Extracted duration from metadata:", duration);
                setRecordingTime(duration);
              }

              // Update the recording in the list if it exists
              if (title) {
                setRecordings(prev =>
                  prev.map(rec =>
                    rec.blobId === blobId
                      ? { ...rec, name: title, ...(duration ? { duration } : {}) }
                      : rec
                  )
                );
              }

              // Create a new blob without the metadata line
              audioOnlyBlob = blob.slice(firstLineEnd + 1);
            } catch (jsonError) {
              console.log("No valid JSON metadata found in the blob:", jsonError.message);
            }
          }
        } catch (metadataError) {
          console.error("Error extracting metadata:", metadataError);
        }

        // Create a new blob with explicit MIME type for better mobile compatibility
        // iOS Safari has better support for MP3 than WAV
        const mimeType = blob.type || 'audio/mp3';
        const newBlob = new Blob([audioOnlyBlob], { type: mimeType });
        setAudioBlob(newBlob);
        console.log("Set audio blob with type:", mimeType);

        // Try to get the duration from the blob if we didn't get it from metadata
        if (!duration) {
          try {
            duration = await getAudioDuration(newBlob);
            console.log("Got audio duration:", duration);
            if (duration && isFinite(duration)) {
              setRecordingTime(duration);

              // Update the recording duration in the list if it exists
              setRecordings(prev =>
                prev.map(rec =>
                  rec.blobId === blobId
                    ? { ...rec, duration }
                    : rec
                )
              );
            } else {
              console.log("Invalid duration, using 0");
              setRecordingTime(0);
            }
          } catch (durationError) {
            console.error("Error getting audio duration:", durationError);
            setRecordingTime(0);
          }
        }

        // Set up for new playback
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        const audioUrl = URL.createObjectURL(newBlob);
        audioRef.current.src = audioUrl;
        console.log("Set audio source to blob URL");

        // Explicitly set the MIME type
        audioRef.current.type = mimeType;

        // Preload the audio - use 'auto' for better mobile compatibility
        audioRef.current.preload = 'auto';

        // For iOS Safari, we need to set these attributes
        audioRef.current.controls = true;
        audioRef.current.crossOrigin = 'anonymous';

        // Set playsinline attribute for iOS (important for mobile playback)
        audioRef.current.playsInline = true;

        // Force load the audio to ensure it's ready for playback
        audioRef.current.load();
        console.log("Loaded audio");

        // Update the URL hash to reflect the current recording
        window.location.hash = blobId;

        // Update share link using hash format
        const shareUrl = `${window.location.origin}/#${blobId}`;
        setShareLink(shareUrl);

        // Set loading state to false after everything is loaded
        setIsLoadingBlob(false);
      } else {
        console.error("Failed to fetch recording:", response.status);
        setErrorMessage(`Failed to load recording (${response.status}). Please try again.`);
        // Set loading state to false on error
        setIsLoadingBlob(false);
      }
    } catch (error) {
      console.error("Error loading recording:", error);
      setErrorMessage(`Error loading recording: ${error.message}`);
      // Set loading state to false on error
      setIsLoadingBlob(false);
    }
  };

  // Update the togglePlayback function to handle mobile browser limitations
  const togglePlayback = async () => {
    if (isPlaying) {
      console.log("Stopping playback");
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If we don't have the audio blob yet but we have a blobId, fetch it
    if ((!audioBlob || audioRef.current.src === '') && currentBlobId) {
      console.log("No audio blob available or audio source not set, fetching it first");
      await loadRecording(currentBlobId, true); // true means fetch the blob
    } else if (!audioBlob && !currentBlobId) {
      console.log("No audio blob available and no blobId");
      setErrorMessage("No recording available to play");
      return;
    }

    try {
      console.log("Starting playback");
      setErrorMessage(""); // Clear any previous error messages

      // Make sure we have a source set
      if (!audioRef.current.src || audioRef.current.src === '') {
        // If there's no source set, create one from the audioBlob
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current.src = audioUrl;

        // Explicitly set the MIME type if possible
        if (audioBlob.type) {
          audioRef.current.type = audioBlob.type;
        }

        // Reset the audio element
        audioRef.current.currentTime = 0;
        audioRef.current.load();

        // Try to get the duration from the audio element
        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
            const duration = Math.round(audioRef.current.duration);
            console.log("Setting duration from audio element:", duration);
            setRecordingTime(duration);

            // Update the recording duration in the list if it exists
            setRecordings(prev =>
              prev.map(rec =>
                rec.blobId === currentBlobId
                  ? { ...rec, duration }
                  : rec
              )
            );
          } else {
            console.log("Invalid duration from audio element");
          }
        }, { once: true });
      } else if (audioRef.current.duration && !isNaN(audioRef.current.duration) && recordingTime === 0) {
        // If we already have a source but the recording time is not set, set it now
        setRecordingTime(Math.round(audioRef.current.duration));
      }

      // Use a try-catch specifically for the play() method
      // This helps handle autoplay restrictions on mobile
      try {
        // Play the audio - this might be blocked on mobile without user interaction
        console.log("Attempting to play audio");
        await audioRef.current.play();
        setIsPlaying(true);
        console.log("Audio playback started successfully");
      } catch (playError) {
        console.error("Autoplay prevented:", playError);

        // On iOS Safari, we need to handle this differently
        // The error message will guide the user to tap again
        setErrorMessage("Please tap the play button again to start audio playback");

        // For iOS Safari, we need to make sure the audio is loaded and ready
        audioRef.current.load();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setErrorMessage("Could not play the recording. Please try again.");
    }
  };

  const startRecording = async () => {
    try {
      // Reset recording state
      setRecordingTime(0);
      setAudioBlob(null);
      setShareLink("");
      setErrorMessage("");
      setRecordingTitle(""); // Reset the recording title
      setCurrentPlaceholder(getRandomPlaceholder()); // Set a new random placeholder
      audioChunksRef.current = [];

      // Clear the URL hash if it exists
      if (window.location.hash) {
        window.history.pushState("", document.title, window.location.pathname + window.location.search);
      }

      // Clean up audio resources to ensure we're not using the previous recording
      await cleanupAudioResources();

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Create a blob from the audio chunks
        // Change from WAV to MP3 or WebM for better mobile compatibility
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setAudioBlob(audioBlob);

        // Dump the recorded blob data
        await dumpBlobData(audioBlob, "Recorded Audio Blob");

        // Set up the audio element with the new blob
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current.src = audioUrl;
        audioRef.current.type = 'audio/mp3';
        audioRef.current.load();

        // Get the duration from the audio element once it's loaded
        audioRef.current.onloadedmetadata = () => {
          if (audioRef.current.duration && isFinite(audioRef.current.duration)) {
            const duration = Math.round(audioRef.current.duration);
            console.log("Setting duration from recorded audio:", duration);
            // Update recordingTime with the actual audio duration
            setRecordingTime(duration);
          }
        };

        // As a backup, also try to get the duration directly from the blob
        try {
          const duration = await getAudioDuration(audioBlob);
          if (duration && isFinite(duration) && duration > 0) {
            console.log("Setting duration from blob analysis:", duration);
            setRecordingTime(duration);
          }
        } catch (error) {
          console.error("Error getting duration from blob:", error);
          // We already have recordingTime from the timer, so this is just a backup
        }
      };

      // Start recording with data available every 100ms
      mediaRecorder.start(100);
      setIsRecording(true);

      // Start the timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => {
          // Check if we've reached the maximum recording time
          if (prevTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return prevTime;
          }
          return prevTime + 1;
        });
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      setErrorMessage("Could not access microphone. Please check permissions and try again.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Store the final recording time before stopping
    const finalRecordingTime = recordingTime;
    console.log("Final recording time from timer:", finalRecordingTime);

    // Stop the MediaRecorder
    mediaRecorderRef.current.stop();

    // Stop all tracks in the media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear the recording timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Update state
    setIsRecording(false);
  };

  const saveRecording = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setErrorMessage("");
    // Reset blockchain data when starting a new upload
    setBlockchainData(null);
    setShowBlockchainData(false);

    try {
      // Create a new blob with metadata
      const finalTitle = recordingTitle.trim() || `Recording ${new Date().toLocaleString()}`;

      // Try to get the most accurate duration from the audio element first
      let finalDuration = recordingTime;

      if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
        finalDuration = Math.round(audioRef.current.duration);
        console.log("Using audio element duration for metadata:", finalDuration);
      } else {
        // As a backup, try to get the duration from the blob
        try {
          const blobDuration = await getAudioDuration(audioBlob);
          if (blobDuration && isFinite(blobDuration) && blobDuration > 0) {
            finalDuration = blobDuration;
            console.log("Using blob duration for metadata:", finalDuration);
          }
        } catch (error) {
          console.log("Using timer duration for metadata:", finalDuration);
        }
      }

      // Create a metadata object
      const metadata = {
        title: finalTitle,
        timestamp: new Date().toISOString(),
        timestampWithTZ: new Date().toString(), // Add timestamp with timezone info
        duration: finalDuration
      };

      // Convert metadata to JSON string
      const metadataStr = JSON.stringify(metadata);

      // Create a new blob with metadata header
      // We'll use a custom format where the first line is JSON metadata
      // followed by a newline and then the audio data
      const metadataBlob = new Blob([metadataStr + "\n"], { type: "application/json" });
      const finalBlob = new Blob([metadataBlob, audioBlob], { type: audioBlob.type });

      // Dump blob data to console before uploading
      await dumpBlobData(finalBlob, "Blob Before Upload");

      // Upload to Walrus
      const storageInfo = await storeBlob(finalBlob);

      if (storageInfo && storageInfo.info) {
        // Store the blockchain response data directly from the upload response
        setBlockchainData(storageInfo.info);
        // Automatically show the blockchain data panel
        setShowBlockchainData(true);

        // Get the blobId from the response
        const blobId = storageInfo.info.newlyCreated?.blobObject?.blobId ||
          storageInfo.info.alreadyCertified?.blobId || '';

        if (blobId) {
          // Set the current blobId
          setCurrentBlobId(blobId);

          // Add the new recording to the list
          const timestamp = new Date().toISOString();
          const timestampWithTZ = new Date().toString();
          const newRecording = {
            id: blobId,
            name: finalTitle,
            duration: recordingTime,
            timestamp,
            timestampWithTZ,
            blobId: blobId,
            mediaType: audioBlob.type
          };

          setRecordings(prev => [newRecording, ...prev]);

          // Create shareable link using hash format instead of query parameters
          const shareUrl = `${window.location.origin}/#${blobId}`;
          setShareLink(shareUrl);

          // Update the URL hash with the blob ID
          window.location.hash = blobId;

          // Reset the recording title
          setRecordingTitle("");
        } else {
          setErrorMessage("Failed to get a valid blob ID from the storage response.");
        }
      } else {
        setErrorMessage("Invalid response from storage service.");
      }
    } catch (error) {
      console.error("Error saving recording:", error);
      setErrorMessage("Failed to save recording. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const storeBlob = async (blob) => {
    // Implement Walrus storage logic based on the example
    try {
      // Submit a PUT request with the file's content as the body to the /v1/blobs endpoint
      const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${DEFAULT_STORAGE_EPOCHS}`, {
        method: "PUT",
        body: blob,
      });

      if (response.status === 200) {
        // Parse successful responses as JSON, and return it along with the
        // mime type from the the file input element.
        const info = await response.json();
        return { info: info, media_type: blob.type };
      } else {
        throw new Error("Something went wrong when storing the blob!");
      }
    } catch (error) {
      console.error("Error storing blob:", error);
      throw error;
    }
  };

  const deleteRecording = (id) => {
    // Check if the deleted recording is the one currently in the URL hash
    const hashBlobId = window.location.hash.substring(1);
    const recordingToDelete = recordings.find(recording => recording.id === id);

    // Remove the recording from the list
    setRecordings(prev => prev.filter(recording => recording.id !== id));

    // If we're deleting the currently active recording, clear the hash and reset the UI
    if (recordingToDelete && recordingToDelete.blobId === hashBlobId) {
      // Clear the URL hash
      window.history.pushState("", document.title, window.location.pathname + window.location.search);

      // Reset UI state
      setAudioBlob(null);
      setCurrentBlobId(""); // Clear the currentBlobId
      setRecordingTime(0);
      setShareLink("");
      setBlockchainData(null);
      setShowBlockchainData(false);

      // Stop any ongoing playback
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      // Clean up audio resources
      cleanupAudioResources();
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        // Show toast instead of alert
        setToast({ visible: true, message: 'Link copied!' });
        // Hide toast after 3 seconds
        setTimeout(() => {
          setToast({ visible: false, message: '' });
        }, 3000);
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
        setErrorMessage("Failed to copy link to clipboard");
      });
  };

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    // Handle invalid values
    if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
      return "00:00";
    }

    // Ensure seconds is a number and round it
    seconds = Math.round(Number(seconds));

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Check for recording ID in URL parameters or hash on component mount
  useEffect(() => {
    // Check URL query parameters
    const params = new URLSearchParams(window.location.search);
    const recordingId = params.get('recording');

    // Check URL hash (without the # symbol)
    const hashId = window.location.hash.substring(1);

    // Load recording from either source, but don't fetch the blob yet
    // We'll only fetch the blob when the user clicks play
    if (recordingId) {
      setIsLoadingBlob(true);
      setCurrentBlobId(recordingId);
      loadRecording(recordingId, false); // false means don't fetch the blob yet
    } else if (hashId && hashId.length > 0) {
      setIsLoadingBlob(true);
      setCurrentBlobId(hashId);
      loadRecording(hashId, false); // false means don't fetch the blob yet
    }
  }, []);

  // Modify playRecording to better handle mobile browsers
  const playRecording = async (blobId) => {
    try {
      console.log("Playing recording:", blobId);
      setErrorMessage(""); // Clear any previous error messages

      // If already playing, stop first
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);

        // If we're clicking the same recording that's already playing, just stop it
        if (currentBlobId === blobId) {
          console.log("Stopping current playback of the same recording");
          return;
        }
      }

      // Set the current blobId
      setCurrentBlobId(blobId);

      // Find the recording in our list to get its title
      const recording = recordings.find(rec => rec.blobId === blobId);
      if (recording && recording.name) {
        console.log("Setting title from recording:", recording.name);
        setRecordingTitle(recording.name);
      }

      // If we're playing a different recording than what's currently loaded
      const hashBlobId = window.location.hash.substring(1);
      if (hashBlobId !== blobId) {
        // Clean up audio resources before loading a new recording
        await cleanupAudioResources();

        // Just update the hash and metadata first, don't fetch the blob yet
        await loadRecording(blobId, false);
      }

      // Now fetch the blob if we don't have it yet
      if (!audioBlob || currentBlobId !== blobId) {
        console.log("No audio blob available or different recording selected, fetching it");
        await loadRecording(blobId, true); // true means fetch the blob
      }

      // Make sure we have the recording loaded
      if (!audioRef.current.src || audioRef.current.src === '') {
        // If there's no source set, create one from the audioBlob
        if (audioBlob) {
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current.src = audioUrl;

          // Explicitly set the MIME type if possible
          if (audioBlob.type) {
            audioRef.current.type = audioBlob.type;
          }

          // Reset the audio element
          audioRef.current.currentTime = 0;
          audioRef.current.load();

          // Try to get the duration from the audio element
          audioRef.current.addEventListener('loadedmetadata', () => {
            if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
              const duration = Math.round(audioRef.current.duration);
              console.log("Setting duration from audio element:", duration);
              setRecordingTime(duration);

              // Update the recording duration in the list if it exists
              setRecordings(prev =>
                prev.map(rec =>
                  rec.blobId === blobId
                    ? { ...rec, duration }
                    : rec
                )
              );
            } else {
              console.log("Invalid duration from audio element");
            }
          }, { once: true });
        } else {
          console.error("No audio blob available");
          setErrorMessage("Audio source not available. Please try again.");
          return;
        }
      } else if (audioRef.current.duration && !isNaN(audioRef.current.duration) && recordingTime === 0) {
        // If we already have a source but the recording time is not set, set it now
        setRecordingTime(Math.round(audioRef.current.duration));
      }

      // For mobile browsers, we need to handle autoplay restrictions
      try {
        // Reset the audio position
        audioRef.current.currentTime = 0;

        // Set volume to ensure it's not muted
        audioRef.current.volume = 1.0;

        // First set the playing state to true
        setIsPlaying(true);

        // Then start the audio playback
        console.log("Starting audio playback");
        const playPromise = audioRef.current.play();

        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log("Audio playback started successfully");
          }).catch(playError => {
            console.error("Autoplay prevented:", playError);
            setIsPlaying(false);

            // Show a more helpful message for mobile users
            setErrorMessage("Please tap the play button again to start audio playback");

            // For iOS Safari, we need to ensure the audio is ready for the next tap
            audioRef.current.load();
          });
        }
      } catch (playError) {
        console.error("Error during playback attempt:", playError);
        setIsPlaying(false);
        setErrorMessage("Playback failed. Please try again.");
      }
    } catch (error) {
      console.error("Error playing recording:", error);
      setErrorMessage("Could not play the recording");
      setIsPlaying(false);
    }
  };

  // Add a helper function to format JSON for display
  const formatJSON = (json) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (error) {
      return "Error formatting JSON data";
    }
  };

  // Update the resetForNewRecording function to reset the recording title
  const resetForNewRecording = async () => {
    // Stop any ongoing recording
    if (isRecording) {
      stopRecording();
    }

    // Stop any ongoing playback
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Clean up audio resources
    await cleanupAudioResources();

    // Reset all state related to the current recording/playback
    setAudioBlob(null);
    setCurrentBlobId(""); // Clear the currentBlobId
    setRecordingTime(0);
    setShareLink("");
    setErrorMessage("");
    setBlockchainData(null);
    setShowBlockchainData(false);
    setRecordingTitle(""); // Reset the recording title
    setCurrentPlaceholder(getRandomPlaceholder()); // Set a new random placeholder

    // Clear the URL hash
    if (window.location.hash) {
      // Use history API to avoid page reload
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }

    console.log("Reset for new recording");
  };

  // Add a useEffect to initialize audio context properly for mobile
  useEffect(() => {
    // Function to initialize audio context after user interaction
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          // Create audio context on user interaction
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
          console.log("AudioContext initialized on user interaction");

          // Remove the event listeners once initialized
          document.removeEventListener('click', initAudioContext);
          document.removeEventListener('touchstart', initAudioContext);
        } catch (error) {
          console.error("Failed to initialize AudioContext:", error);
        }
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', initAudioContext);
    document.addEventListener('touchstart', initAudioContext);

    // Clean up
    return () => {
      document.removeEventListener('click', initAudioContext);
      document.removeEventListener('touchstart', initAudioContext);
    };
  }, []);

  // Add a useEffect to handle iOS Safari's specific requirements for audio playback
  useEffect(() => {
    // Function to enable audio playback on iOS Safari
    const enableIOSAudio = () => {
      // Create a silent audio context and play it
      // This "unlocks" the audio on iOS Safari
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const silentBuffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      source.disconnect();

      // Also try to load and play a short silent audio
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Audio playback started successfully
            audioRef.current.pause();
            console.log("iOS audio unlocked");
          }).catch(error => {
            // Auto-play was prevented
            console.log("iOS audio unlock failed, will try again on next interaction");
          });
        }
      }

      // Remove the event listeners once we've tried to unlock audio
      document.removeEventListener('touchstart', enableIOSAudio);
      document.removeEventListener('touchend', enableIOSAudio);
      document.removeEventListener('click', enableIOSAudio);
    };

    // Add event listeners for user interaction
    document.addEventListener('touchstart', enableIOSAudio, { once: true });
    document.addEventListener('touchend', enableIOSAudio, { once: true });
    document.addEventListener('click', enableIOSAudio, { once: true });

    return () => {
      // Clean up event listeners
      document.removeEventListener('touchstart', enableIOSAudio);
      document.removeEventListener('touchend', enableIOSAudio);
      document.removeEventListener('click', enableIOSAudio);
    };
  }, []);

  // Add this function after the useEffect hooks to clear browser cache and storage except for recordings
  // Function to clear browser cache and storage except for recordings
  const clearBrowserCache = () => {
    // Save the recordings data temporarily
    const savedRecordings = localStorage.getItem('recordings');

    try {
      // Clear localStorage except for recordings
      localStorage.clear();
      if (savedRecordings) {
        localStorage.setItem('recordings', savedRecordings);
      }

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear cache via service worker if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE'
        });
      }

      console.log('Browser cache and storage cleared except for recordings');
    } catch (error) {
      console.error('Error clearing browser cache:', error);
    }
  };

  // Call clearBrowserCache on component mount
  useEffect(() => {
    clearBrowserCache();

    // Set up an interval to clear cache periodically (every 30 minutes)
    const cacheCleanupInterval = setInterval(clearBrowserCache, 30 * 60 * 1000);

    return () => {
      clearInterval(cacheCleanupInterval);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      {/* Toast notification - moved outside of the main container */}
      {toast.visible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-walrus-teal text-walrus-darker px-6 py-3 rounded-lg shadow-xl flex items-center animate-fade-in-out z-[9999] border-2 border-walrus-darker">
          <Check className="w-5 h-5 mr-2" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Main content container with semi-transparent background */}
      <div className="w-full max-w-3xl bg-black/60 backdrop-blur-sm p-6 rounded-xl shadow-2xl border border-walrus-teal/20">
        <div
          className="flex items-center justify-center mb-8 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={resetForNewRecording}
          title="Click to start a new recording"
        >
          <div className="w-12 h-12 mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-full h-full">
              <circle cx="12" cy="12" r="12" fill="#7CFBFF" />
              <g transform="scale(0.6) translate(8, 8)">
                {/* Walrus head */}
                <path d="M12 4C6 4 3 8 3 14C3 19 7 20 12 20C17 20 21 19 21 14C21 8 18 4 12 4Z" fill="#7CFBFF" stroke="#000" strokeWidth="1" />

                {/* Sunglasses */}
                <rect x="5" y="9" width="14" height="3" rx="0.5" fill="#000" />
                <rect x="5" y="9" width="6" height="3" rx="0.5" fill="#000" />
                <rect x="13" y="9" width="6" height="3" rx="0.5" fill="#000" />
                <line x1="12" y1="9" x2="12" y2="12" stroke="#7CFBFF" strokeWidth="0.5" />

                {/* Whiskers */}
                <line x1="5" y1="13" x2="2" y2="12" stroke="#000" strokeWidth="0.5" />
                <line x1="5" y1="14" x2="2" y2="14" stroke="#000" strokeWidth="0.5" />
                <line x1="5" y1="15" x2="2" y2="16" stroke="#000" strokeWidth="0.5" />
                <line x1="19" y1="13" x2="22" y2="12" stroke="#000" strokeWidth="0.5" />
                <line x1="19" y1="14" x2="22" y2="14" stroke="#000" strokeWidth="0.5" />
                <line x1="19" y1="15" x2="22" y2="16" stroke="#000" strokeWidth="0.5" />

                {/* Tusks */}
                <path d="M9 15C9 15 8 17 8 19C8 20 9 20 9 19C9 17 10 15 10 15" fill="#fff" stroke="#000" strokeWidth="0.5" />
                <path d="M15 15C15 15 16 17 16 19C16 20 15 20 15 19C15 17 14 15 14 15" fill="#fff" stroke="#000" strokeWidth="0.5" />

                {/* Nose */}
                <ellipse cx="12" cy="14.5" rx="2.5" ry="1.8" fill="#000" />

                {/* Music notes */}
                <g transform="translate(18, 12) scale(0.6)">
                  {/* First note */}
                  <path d="M0,0 C1,-1 2,0 2,1 L2,5 C2,6 1,7 0,7 C-1,7 -2,6 -2,5 C-2,4 -1,3 0,3 Z" fill="#000" />
                  <line x1="2" y1="1" x2="2" y2="-3" stroke="#000" strokeWidth="0.8" />
                  <line x1="2" y1="-3" x2="3" y2="-4" stroke="#000" strokeWidth="0.8" />

                  {/* Second note */}
                  <g transform="translate(5, -3)">
                    <path d="M0,0 C1,-1 2,0 2,1 L2,5 C2,6 1,7 0,7 C-1,7 -2,6 -2,5 C-2,4 -1,3 0,3 Z" fill="#000" />
                    <line x1="2" y1="1" x2="2" y2="-3" stroke="#000" strokeWidth="0.8" />
                    <line x1="2" y1="-3" x2="3" y2="-4" stroke="#000" strokeWidth="0.8" />
                  </g>

                  {/* Third note */}
                  <g transform="translate(10, -5)">
                    <path d="M0,0 C1,-1 2,0 2,1 L2,5 C2,6 1,7 0,7 C-1,7 -2,6 -2,5 C-2,4 -1,3 0,3 Z" fill="#000" />
                    <line x1="2" y1="1" x2="2" y2="-3" stroke="#000" strokeWidth="0.8" />
                    <line x1="2" y1="-3" x2="3" y2="-4" stroke="#000" strokeWidth="0.8" />
                  </g>

                  {/* Fourth note - smaller */}
                  <g transform="translate(14, -2) scale(0.8)">
                    <path d="M0,0 C1,-1 2,0 2,1 L2,5 C2,6 1,7 0,7 C-1,7 -2,6 -2,5 C-2,4 -1,3 0,3 Z" fill="#000" />
                    <line x1="2" y1="1" x2="2" y2="-3" stroke="#000" strokeWidth="0.8" />
                    <line x1="2" y1="-3" x2="3" y2="-4" stroke="#000" strokeWidth="0.8" />
                  </g>
                </g>
              </g>
            </svg>
          </div>
          <h1 className="text-3xl font-pixel font-bold text-walrus-teal">WHISTLING WALRUS</h1>
        </div>

        {errorMessage && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-md relative mb-4">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        <div className="bg-walrus-dark border border-walrus-border p-6 rounded-lg mb-8 shadow-md">
          <div className="flex justify-center items-center mb-6">
            <div className="text-5xl font-pixel font-bold text-walrus-teal">
              {isLoadingBlob ? "00:00" : isPlaying ? formatTime(currentPlaybackTime) : formatTime(recordingTime)}
            </div>
          </div>

          {/* Audio scope visualization */}
          <div className="mb-6">
            <div className="mx-auto w-[250px] bg-walrus-darker border border-walrus-border rounded-md overflow-hidden">
              {isRecording && mediaRecorderRef.current ? (
                <LiveAudioVisualizer
                  mediaRecorder={mediaRecorderRef.current}
                  width={250}
                  height={100}
                  barWidth={3}
                  gap={1}
                  barColor="rgb(124, 251, 255)"
                  className="w-full h-24"
                  fftSize={2048}
                  minDecibels={-85}
                  maxDecibels={-10}
                  smoothingTimeConstant={0.6}
                />
              ) : audioBlob ? (
                <div className="w-full h-24">
                  <AudioVisualizer
                    blob={audioBlob}
                    width={250}
                    height={100}
                    barWidth={3}
                    gap={1}
                    barColor="rgb(143, 124, 241)"
                    barPlayedColor="rgb(124, 251, 255)"
                    currentTime={currentPlaybackTime}
                    fftSize={2048}
                    minDecibels={-85}
                    maxDecibels={-10}
                    smoothingTimeConstant={0.6}
                  />
                </div>
              ) : (
                <div className="w-full h-24 flex items-center justify-center text-walrus-teal/50">
                  {isLoadingBlob ? "Diving for sonic treasure..." : currentBlobId ? "Ready to catch waves?" : "Sing to me, darling!"}
                </div>
              )}
            </div>
          </div>

          {/* Display recording title if available */}
          {!isRecording && recordingTitle && (audioBlob || currentBlobId) && (
            <div className="mb-4 text-center">
              <span className="text-walrus-teal font-medium text-sm italic">
                "{recordingTitle}"
              </span>
            </div>
          )}

          {/* First row of buttons - Play/Pause button */}
          {!isLoadingBlob && (audioBlob || currentBlobId) && !isRecording && (
            <div className="flex justify-center mb-4">
              <button
                onClick={togglePlayback}
                className="bg-walrus-purple/10 hover:bg-walrus-purple/20 text-walrus-purple border border-walrus-purple font-medium py-3 px-6 rounded-md flex items-center justify-center transition-colors mx-auto w-[250px]"
                disabled={uploading}
              >
                {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {isPlaying ? 'Pause' : 'Tap to Play'}
              </button>
            </div>
          )}

          {!isLoadingBlob && (
            <>
              {/* Second row of buttons - only show Start Recording if no recording is active */}
              {!currentBlobId && !audioBlob && !isRecording && (
                <div className="flex justify-center mb-6">
                  <button
                    onClick={() => {
                      // Clear the URL hash before starting a new recording
                      if (window.location.hash) {
                        window.history.pushState("", document.title, window.location.pathname + window.location.search);
                      }
                      startRecording();
                    }}
                    className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-3 px-6 rounded-md flex items-center justify-center transition-colors mx-auto w-[250px]"
                    disabled={uploading}
                  >
                    <Mic className="mr-2" /> Start Recording
                  </button>
                </div>
              )}

              {/* Show Stop Recording button when recording */}
              {isRecording && (
                <div className="flex justify-center mb-6">
                  <button
                    onClick={stopRecording}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500 font-medium py-3 px-6 rounded-md flex items-center justify-center transition-colors mx-auto w-[250px]"
                  >
                    <Square className="mr-2" /> Stop Recording
                  </button>
                </div>
              )}

              {/* Show New Recording button when a recording is active but not recording */}
              {(currentBlobId || audioBlob) && !isRecording && (
                <div className="flex justify-center mb-6">
                  <button
                    onClick={() => {
                      // Clear the URL hash before starting a new recording
                      if (window.location.hash) {
                        window.history.pushState("", document.title, window.location.pathname + window.location.search);
                      }
                      // Reset state
                      setAudioBlob(null);
                      setCurrentBlobId("");
                      setShareLink("");
                      // Start new recording
                      startRecording();
                    }}
                    className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-3 px-6 rounded-md flex items-center justify-center transition-colors mx-auto w-[250px]"
                    disabled={uploading}
                  >
                    <Mic className="mr-2" /> Start New Recording
                  </button>
                </div>
              )}
            </>
          )}

          {audioBlob && !isRecording && !isLoadingBlob && !shareLink && (
            <div className="flex flex-col items-center">
              {/* Add title input field */}
              <div className="mb-4 w-[250px]">
                <label htmlFor="recording-title" className="block text-walrus-teal text-sm font-medium mb-2">
                  Give your recording a title:
                </label>
                <input
                  type="text"
                  id="recording-title"
                  value={recordingTitle}
                  onChange={(e) => setRecordingTitle(e.target.value)}
                  placeholder={currentPlaceholder}
                  className="w-full p-2 border border-walrus-border rounded-md bg-walrus-darker text-walrus-text focus:outline-none focus:ring-2 focus:ring-walrus-teal"
                  maxLength={50}
                />
              </div>
              <button
                onClick={saveRecording}
                className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-2 px-6 rounded-md flex items-center justify-center transition-colors mx-auto w-[250px]"
                disabled={uploading}
              >
                <Save className="mr-2" />
                {uploading ? 'Saving...' : 'Save to Walrus'}
              </button>
            </div>
          )}

          {shareLink && !isLoadingBlob && (
            <div className="mt-6 p-4 bg-walrus-dark border border-walrus-border rounded-lg shadow-inner">
              <h3 className="font-medium text-walrus-teal mb-2 flex items-center">
                <Share2 className="mr-2" /> Shareable Link
              </h3>
              <div className="flex items-center">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-grow p-2 border border-walrus-border rounded-md mr-2 text-sm bg-walrus-darker text-walrus-secondary"
                />
                <button
                  onClick={copyShareLink}
                  className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Add blockchain data display */}
          {blockchainData && !isLoadingBlob && (
            <div className="mt-4">
              <button
                onClick={() => setShowBlockchainData(!showBlockchainData)}
                className="flex items-center justify-between w-full p-3 bg-walrus-darker border border-walrus-border rounded-md text-walrus-teal hover:bg-walrus-dark/50 transition-colors"
              >
                <span className="flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  Walrus Storage Information
                </span>
                <span>{showBlockchainData ? '▲' : '▼'}</span>
              </button>

              {showBlockchainData && (
                <div className="mt-2 p-4 bg-walrus-darker border border-walrus-border rounded-md overflow-auto">
                  {/* Add Walrus Explorer Link above the JSON data */}
                  {(blockchainData.newlyCreated?.blobObject?.blobId || blockchainData.alreadyCertified?.blobId) && (
                    <div className="mb-4 pb-3 border-b border-walrus-border">
                      <a
                        href={`https://walruscan.com/testnet/blob/${blockchainData.newlyCreated?.blobObject?.blobId || blockchainData.alreadyCertified?.blobId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-4 py-2 bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal rounded-full transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on Walrus Explorer
                      </a>
                    </div>
                  )}

                  <div className="text-xs font-mono text-walrus-secondary whitespace-pre overflow-x-auto max-h-60">
                    {formatJSON(blockchainData)}
                  </div>
                  <div className="mt-3 text-xs text-walrus-secondary">
                    <p>This is the response from the Walrus storage network after storing your recording.</p>
                    <p className="mt-1">The <code className="bg-walrus-dark/50 px-1 rounded">blobId</code> is a unique identifier for your recording on the decentralized storage network.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-pixel mb-4 flex items-center text-walrus-teal">
            <List className="mr-2" /> Recent Recordings
          </h2>

          {recordings.length > 0 ? (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div key={recording.id} className="bg-walrus-dark border border-walrus-border p-4 rounded-lg flex items-center justify-between shadow-md">
                  <div>
                    <h3 className="font-medium text-walrus-text">{recording.name}</h3>
                    <div className="text-sm text-walrus-secondary flex items-center">
                      <Clock className="w-4 h-4 mr-1" /> {formatTime(recording.duration)}
                    </div>
                    <div className="text-xs text-walrus-secondary mt-1">
                      {recording.timestampWithTZ ? recording.timestampWithTZ : new Date(recording.timestamp).toString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => playRecording(recording.blobId)}
                      className="bg-walrus-purple/10 hover:bg-walrus-purple/20 text-walrus-purple border border-walrus-purple p-2 rounded-md transition-colors"
                      title="Play"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRecording(recording.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500 p-2 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-walrus-secondary text-center py-8 border border-walrus-border rounded-lg bg-walrus-dark shadow-inner font-medium">
              No recordings yet
            </p>
          )}
        </div>

        <footer className="mt-12 pt-6 border-t border-walrus-border text-sm text-walrus-secondary">
          <div className="flex items-start">
            <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-walrus-secondary" />
            <span>
              This application stores ephemeral recordings on Walrus decentralized storage.
              Recordings can be up to 30 minutes long and are stored in a compressed format for browser compatibility.
              These ephemeral recordings will expire after 10 epochs on the Walrus blockchain.
            </span>
          </div>
          <div className="mt-2 flex items-center">
            <a
              href="https://docs.walrus.site"
              target="_blank"
              rel="noopener noreferrer"
              className="text-walrus-teal hover:text-walrus-teal/80 flex items-center transition-colors"
            >
              Learn more about Walrus Storage <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>

          {/* GitHub Contribute Section */}
          <div className="mt-4 pt-4 border-t border-walrus-border flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <span className="text-walrus-secondary mr-2">Contribute:</span>
                <a
                  href="https://github.com/tududes/whistling-walrus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-walrus-teal hover:text-walrus-teal/80 transition-colors"
                  title="Contribute on GitHub"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                </a>
              </div>

              <div className="flex items-center">
                <span className="text-walrus-secondary mr-2">Connect:</span>
                <a
                  href="https://x.com/0xTuDudes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-walrus-teal hover:text-walrus-teal/80 transition-colors"
                  title="Connect on X (formerly Twitter)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  return (
    <div className="min-h-screen h-full flex flex-col py-8">
      <AudioRecorder />
    </div>
  );
};

export default App;

