import React, { useState, useRef, useEffect } from 'react';
// Import Lucide icons properly
import { Mic, Square, Play, Pause, Share2, Clock, Save, Trash2, List, Info, ExternalLink, Check } from 'lucide-react';
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

  // Remove the old visualization data states
  // const [visualizationData, setVisualizationData] = useState([]);
  // const [recordingVisualizationData, setRecordingVisualizationData] = useState([]);
  // const [playbackVisualizationData, setPlaybackVisualizationData] = useState([]);

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

    // Set up event listeners for audio playback
    const handleAudioEnd = () => {
      setIsPlaying(false);
    };

    audioRef.current.addEventListener('ended', handleAudioEnd);

    return () => {
      // Clean up timer and audio listeners on component unmount
      if (timerRef.current) clearInterval(timerRef.current);
      audioRef.current.removeEventListener('ended', handleAudioEnd);

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

  // Update the togglePlayback function to handle mobile browser limitations
  const togglePlayback = async () => {
    if (!audioBlob) return;

    if (isPlaying) {
      console.log("Stopping playback");
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        console.log("Starting playback");

        // Instead of creating a new Audio element each time, reuse the existing one
        // This helps with mobile browser memory management
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }

        // Create a temporary URL for the audio blob
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current.src = audioUrl;

        // Reset the audio element
        audioRef.current.currentTime = 0;

        // Add explicit handling for mobile browsers
        audioRef.current.load();

        // Use a try-catch specifically for the play() method
        // This helps handle autoplay restrictions on mobile
        try {
          // Play the audio - this might be blocked on mobile without user interaction
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (playError) {
          console.error("Autoplay prevented:", playError);
          setErrorMessage("Tap the play button again to start playback (mobile browser restriction)");

          // On mobile, we might need a second user interaction
          // The error message above will guide the user
        }
      } catch (error) {
        console.error("Error playing audio:", error);
        setErrorMessage("Could not play the recording. Please try again.");
      }
    }
  };

  const startRecording = async () => {
    try {
      // Reset recording state
      setRecordingTime(0);
      setAudioBlob(null);
      setShareLink("");
      setErrorMessage("");
      audioChunksRef.current = [];

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

      mediaRecorder.onstop = () => {
        // Create a blob from the audio chunks
        // Change from WAV to MP3 or WebM for better mobile compatibility
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setAudioBlob(audioBlob);
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
      // Upload to Walrus
      const storageInfo = await storeBlob(audioBlob);

      if (storageInfo && storageInfo.info) {
        // Store the blockchain response data
        setBlockchainData(storageInfo.info);
        // Automatically show the blockchain data panel
        setShowBlockchainData(true);

        // Add the new recording to the list
        const timestamp = new Date().toISOString();
        const newRecording = {
          id: storageInfo.info.newlyCreated?.blobObject?.blobId ||
            storageInfo.info.alreadyCertified?.blobId ||
            `recording-${Date.now()}`,
          name: `Recording ${new Date().toLocaleString()}`,
          duration: recordingTime,
          timestamp,
          blobId: storageInfo.info.newlyCreated?.blobObject?.blobId ||
            storageInfo.info.alreadyCertified?.blobId || '',
          mediaType: audioBlob.type
        };

        setRecordings(prev => [newRecording, ...prev]);

        // Create shareable link using hash format instead of query parameters
        const shareUrl = `${window.location.origin}/#${newRecording.blobId}`;
        setShareLink(shareUrl);

        // Update the URL hash with the blob ID
        window.location.hash = newRecording.blobId;
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

  // Modify loadRecording to better handle mobile browsers
  const loadRecording = async (blobId) => {
    try {
      console.log("Loading recording:", blobId);
      setErrorMessage("");

      // Stop current playback if any
      audioRef.current.pause();
      setIsPlaying(false);
      console.log("Stopped current playback");

      // Clean up audio resources
      await cleanupAudioResources();
      console.log("Cleaned up audio resources");

      // Instead of creating a new Audio element, reuse the existing one
      // This is better for mobile browser memory management
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }

      console.log("Fetching recording from Walrus");
      const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`);

      if (response.ok) {
        console.log("Successfully fetched recording");
        const blob = await response.blob();
        setAudioBlob(blob);
        console.log("Set audio blob");

        // Set up for new playback
        const audioUrl = URL.createObjectURL(blob);
        audioRef.current.src = audioUrl;
        console.log("Set audio source to blob URL");

        // Explicitly set the MIME type if possible
        // This can help with format detection on mobile
        if (blob.type) {
          audioRef.current.type = blob.type;
        }

        // Preload the audio - use 'metadata' for faster loading on mobile
        audioRef.current.preload = 'metadata';
        audioRef.current.load();
        console.log("Loaded audio");

        // Update the URL hash to reflect the current recording
        window.location.hash = blobId;

        // Update share link using hash format
        const shareUrl = `${window.location.origin}/#${blobId}`;
        setShareLink(shareUrl);

        // Try to fetch blockchain metadata for this blob
        try {
          const metadataResponse = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}/metadata`);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            setBlockchainData(metadata);
            setShowBlockchainData(true);
          }
        } catch (metadataError) {
          console.error("Error fetching blockchain metadata:", metadataError);
          // Don't show an error to the user, just don't display blockchain data
          setBlockchainData(null);
          setShowBlockchainData(false);
        }

        // Add a custom play method to the component to handle playback properly
        console.log("Recording loaded and ready for playback");
      } else {
        throw new Error("Failed to load recording");
      }
    } catch (error) {
      console.error("Error loading recording:", error);
      setErrorMessage("Failed to load recording from storage");
    }
  };

  const deleteRecording = (id) => {
    setRecordings(prev => prev.filter(recording => recording.id !== id));
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        // Show toast instead of alert
        setToast({ visible: true, message: 'Link copied to clipboard!' });
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

    // Load recording from either source
    if (recordingId) {
      loadRecording(recordingId);
    } else if (hashId && hashId.length > 0) {
      loadRecording(hashId);
    }
  }, []);

  // Modify playRecording to better handle mobile browsers
  const playRecording = async (blobId) => {
    try {
      console.log("Playing recording:", blobId);

      // If already playing, stop first
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      // If we're playing a different recording than what's currently loaded
      if (window.location.hash.substring(1) !== blobId) {
        // Load the recording first
        await loadRecording(blobId);
      }

      // Make sure we have the recording loaded
      if (!audioRef.current.src) {
        console.error("No audio source available");
        return;
      }

      // For mobile browsers, we need to handle autoplay restrictions
      try {
        // First set the playing state to true
        setIsPlaying(true);

        // Then start the audio playback
        console.log("Starting audio playback");
        await audioRef.current.play();

        console.log("Audio playback started successfully");
      } catch (playError) {
        console.error("Autoplay prevented:", playError);
        setIsPlaying(false);
        setErrorMessage("Tap the play button again to start playback (mobile browser restriction)");
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

  // Add a function to reset the page for a new recording
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
    setRecordingTime(0);
    setShareLink("");
    setErrorMessage("");
    setBlockchainData(null);
    setShowBlockchainData(false);

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

  return (
    <div className="max-w-4xl mx-auto p-6 bg-walrus-darker shadow-lg rounded-lg border border-walrus-border">
      {/* Toast notification */}
      {toast.visible && (
        <div className="fixed top-4 right-4 bg-walrus-teal text-walrus-darker px-4 py-2 rounded-lg shadow-lg flex items-center animate-fade-in-out z-50">
          <Check className="w-4 h-4 mr-2" />
          {toast.message}
        </div>
      )}

      <div
        className="flex items-center justify-center mb-8 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={resetForNewRecording}
        title="Click to start a new recording"
      >
        <div className="w-12 h-12 mr-3">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path d="M12 2C8.14 2 5 5.14 5 9v7.4c0 2.63 3.58 3.46 7 3.46s7-.82 7-3.46V9c0-3.86-3.14-7-7-7zm.3 18c-2.99 0-5.3-.82-5.3-1.6V17h10.6v1.4c0 .78-2.31 1.6-5.3 1.6zm6.1-3H5.6v-4.4h12.8V17zM12 4c3.2 0 5.8 2.6 5.8 5.8v1.2H6.2V9.8C6.2 6.6 8.8 4 12 4z"
              fill="#7CFBFF" />
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
            {formatTime(recordingTime)}
          </div>
        </div>

        {/* Single Visualization Pane that switches between recording and playback */}
        <div className="mb-6">
          <h3 className="text-walrus-teal font-medium mb-2 text-center">
            {isRecording ? "Recording Visualization" : "Audio Visualization"}
          </h3>
          <div className="mx-auto w-2/3 bg-walrus-darker border border-walrus-border rounded-md overflow-hidden">
            {isRecording && mediaRecorderRef.current ? (
              <LiveAudioVisualizer
                mediaRecorder={mediaRecorderRef.current}
                width={600}
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
                  width={600}
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
                Start recording or load audio to see visualization
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center space-x-4 mb-6">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-3 px-6 rounded-md flex items-center transition-colors"
              disabled={uploading}
            >
              <Mic className="mr-2" /> Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500 font-medium py-3 px-6 rounded-md flex items-center transition-colors"
            >
              <Square className="mr-2" /> Stop Recording
            </button>
          )}

          {audioBlob && !isRecording && (
            <button
              onClick={togglePlayback}
              className="bg-walrus-purple/10 hover:bg-walrus-purple/20 text-walrus-purple border border-walrus-purple font-medium py-3 px-6 rounded-md flex items-center transition-colors"
              disabled={uploading}
            >
              {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          )}
        </div>

        {audioBlob && !isRecording && (
          <div className="flex justify-center space-x-4">
            <button
              onClick={saveRecording}
              className="bg-walrus-teal/10 hover:bg-walrus-teal/20 text-walrus-teal border border-walrus-teal font-medium py-2 px-6 rounded-md flex items-center transition-colors"
              disabled={uploading}
            >
              <Save className="mr-2" />
              {uploading ? 'Saving...' : 'Save to Walrus'}
            </button>
          </div>
        )}

        {shareLink && (
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
        {blockchainData && (
          <div className="mt-4">
            <button
              onClick={() => setShowBlockchainData(!showBlockchainData)}
              className="flex items-center justify-between w-full p-3 bg-walrus-darker border border-walrus-border rounded-md text-walrus-teal hover:bg-walrus-dark/50 transition-colors"
            >
              <span className="flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Walrus Blockchain Storage Information
              </span>
              <span>{showBlockchainData ? '▲' : '▼'}</span>
            </button>

            {showBlockchainData && (
              <div className="mt-2 p-4 bg-walrus-darker border border-walrus-border rounded-md overflow-auto">
                <div className="text-xs font-mono text-walrus-secondary whitespace-pre overflow-x-auto max-h-60">
                  {formatJSON(blockchainData)}
                </div>
                <div className="mt-3 text-xs text-walrus-secondary">
                  <p>This is the raw response from the Walrus blockchain after storing your recording.</p>
                  <p className="mt-1">The <code className="bg-walrus-dark/50 px-1 rounded">blobId</code> is a unique identifier for your recording on the decentralized storage network.</p>

                  {/* Add Walrus Explorer Link */}
                  {(blockchainData.newlyCreated?.blobObject?.blobId || blockchainData.alreadyCertified?.blobId) && (
                    <div className="mt-3 pt-3 border-t border-walrus-border">
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
            This application stores recordings on Walrus decentralized storage.
            Recordings can be up to 30 minutes long and are stored in a compressed format for browser compatibility.
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
      </footer>
    </div>
  );
};

// Main App component
const App = () => {
  return (
    <div className="min-h-screen bg-walrus-dark py-8">
      <AudioRecorder />
    </div>
  );
};

export default App;
